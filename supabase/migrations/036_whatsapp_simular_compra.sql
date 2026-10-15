-- 036_whatsapp_simular_compra.sql — agente WhatsApp (15/10/2026)
-- "Posso comprar X?": simula a compra contra o limite geral, o limite da categoria e o saldo livre do mês.
--
-- Contexto: em 14/10 o João perguntou "posso fazer uma compra 3000 lazer?" e o bot entendeu como pedido de
-- registro ("foi à vista ou parcelado?"). Depois, "e meu limite de lazer" mostrou só o limite geral, sem
-- dizer que Lazer não tinha limite próprio. Faltava uma ferramenta que respondesse a pergunta de verdade.
--
-- whatsapp_simulate_purchase NÃO grava nada: não cria lançamento e não cria categoria (a busca da categoria
-- é só leitura, ao contrário de whatsapp_resolve_category). Compara:
--   1) limite geral do mês      (budgets com category_id nulo)
--   2) limite da categoria      (budgets da categoria, se houver)
--   3) saldo livre estimado     (mesma conta de whatsapp_month_summary: saldo + a receber − fixos e parcelas
--                                que ainda vão vencer). Só entra se a pessoa registrou alguma receita no mês;
--                                sem receita o saldo é sempre negativo e o aviso seria ruído.
-- Parcelado: o que pesa neste mês é a primeira parcela.
--
-- Veredito: 🚨 se passa de algum limite ou deixa o saldo livre negativo; ⚠️ se passa de 80% de algum limite;
-- ✅ caso contrário. Quando não cabe, diz quanto cabe neste mês e em quantas parcelas a parcela caberia.
-- Idempotente. Grant só service_role.

create or replace function public.whatsapp_simulate_purchase(
  p_user_id uuid,
  p_amount numeric,
  p_categoria text default null,
  p_parcelas int default 1,
  p_ref date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref date := coalesce(p_ref, public.whatsapp_today());
  v_mes date := date_trunc('month', v_ref)::date;
  v_fim date := (date_trunc('month', v_ref) + interval '1 month')::date;
  v_parc int := greatest(1, least(coalesce(p_parcelas, 1), 72));
  v_impacto numeric;
  v_raw text; v_norm text;
  v_cat_id uuid; v_cat_nome text;
  v_lim_g numeric; v_gasto_g numeric;
  v_lim_c numeric; v_gasto_c numeric;
  v_resumo jsonb; v_entradas numeric; v_livre numeric;
  v_nivel int := 0;              -- 0 ✅  1 ⚠️  2 🚨
  v_falta boolean := false;      -- saldo livre fica negativo (falta dinheiro, não só teto)
  v_cabe numeric;                -- quanto cabe neste mês sem estourar nada
  v_n int;
  v_linhas text[] := '{}';
  v_msg text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Me diga o valor da compra que eu simulo. Ex.: "posso gastar 300 em lazer?"');
  end if;

  v_impacto := round(p_amount / v_parc, 2);

  -- categoria: só procura, nunca cria
  v_raw := left(btrim(regexp_replace(coalesce(p_categoria, ''), '[[:cntrl:]]+', ' ', 'g')), 40);
  if v_raw <> '' and lower(v_raw) not in ('null', 'none', 'sem categoria') then
    v_norm := public.whatsapp_norm(v_raw);
    select id, name into v_cat_id, v_cat_nome from public.categories
     where user_id = p_user_id and type = 'expense'
       and (public.whatsapp_norm(name) = v_norm
            or (length(v_norm) >= 3 and regexp_replace(public.whatsapp_norm(name), 's$', '') = regexp_replace(v_norm, 's$', '')))
     order by is_default desc, created_at limit 1;
    -- erro de digitação ("laser" → Lazer): mesma tolerância de whatsapp_resolve_category
    if v_cat_id is null and length(v_norm) >= 4 then
      select id, name into v_cat_id, v_cat_nome from public.categories
       where user_id = p_user_id and type = 'expense'
         and public.whatsapp_lev(public.whatsapp_norm(name), v_norm) <= case when length(v_norm) >= 8 then 2 else 1 end
       order by public.whatsapp_lev(public.whatsapp_norm(name), v_norm), is_default desc limit 1;
    end if;
  end if;

  -- 1) limite geral
  select amount into v_lim_g from public.budgets
   where user_id = p_user_id and category_id is null and month_ref = v_mes and amount > 0 limit 1;
  select coalesce(sum(amount), 0) into v_gasto_g from public.transactions
   where user_id = p_user_id and type = 'expense' and status = 'active'
     and transaction_date >= v_mes and transaction_date < v_fim;

  -- 2) limite da categoria
  if v_cat_id is not null then
    select amount into v_lim_c from public.budgets
     where user_id = p_user_id and category_id = v_cat_id and month_ref = v_mes and amount > 0 limit 1;
    select coalesce(sum(amount), 0) into v_gasto_c from public.transactions
     where user_id = p_user_id and type = 'expense' and status = 'active' and category_id = v_cat_id
       and transaction_date >= v_mes and transaction_date < v_fim;
  end if;

  -- 3) saldo livre estimado do mês (mesma conta do resumo)
  v_resumo := public.whatsapp_month_summary(p_user_id, v_ref);
  v_entradas := coalesce((v_resumo ->> 'entradas')::numeric, 0) + coalesce((v_resumo ->> 'receitas_pendentes')::numeric, 0);
  if v_entradas > 0 then
    v_livre := (v_resumo ->> 'saldo_livre')::numeric;
  end if;

  -- linhas
  if v_lim_g is not null then
    v_linhas := v_linhas || ('🎯 *Limite do mês:* R$ ' || public.money_br(v_gasto_g) || ' de R$ ' || public.money_br(v_lim_g) ||
      ' → com a compra, R$ ' || public.money_br(v_gasto_g + v_impacto) ||
      case when v_gasto_g + v_impacto > v_lim_g then ' (🚨 R$ ' || public.money_br(v_gasto_g + v_impacto - v_lim_g) || ' acima)'
           when v_gasto_g + v_impacto >= v_lim_g * 0.8 then ' (⚠️ ' || floor((v_gasto_g + v_impacto) / v_lim_g * 100) || '%)'
           else ' (✅ sobram R$ ' || public.money_br(v_lim_g - v_gasto_g - v_impacto) || ')' end);
    v_nivel := greatest(v_nivel, case when v_gasto_g + v_impacto > v_lim_g then 2
                                      when v_gasto_g + v_impacto >= v_lim_g * 0.8 then 1 else 0 end);
    v_cabe := v_lim_g - v_gasto_g;
  else
    v_linhas := v_linhas || ('🎯 Você não tem limite geral para ' || to_char(v_mes, 'MM/YYYY') || '. Gasto do mês até agora: R$ ' ||
      public.money_br(v_gasto_g) || '.');
  end if;

  if v_cat_id is not null and v_lim_c is not null then
    v_linhas := v_linhas || ('📂 *Limite de ' || v_cat_nome || ':* R$ ' || public.money_br(v_gasto_c) || ' de R$ ' || public.money_br(v_lim_c) ||
      ' → com a compra, R$ ' || public.money_br(v_gasto_c + v_impacto) ||
      case when v_gasto_c + v_impacto > v_lim_c then ' (🚨 R$ ' || public.money_br(v_gasto_c + v_impacto - v_lim_c) || ' acima)'
           when v_gasto_c + v_impacto >= v_lim_c * 0.8 then ' (⚠️ ' || floor((v_gasto_c + v_impacto) / v_lim_c * 100) || '%)'
           else ' (✅ sobram R$ ' || public.money_br(v_lim_c - v_gasto_c - v_impacto) || ')' end);
    v_nivel := greatest(v_nivel, case when v_gasto_c + v_impacto > v_lim_c then 2
                                      when v_gasto_c + v_impacto >= v_lim_c * 0.8 then 1 else 0 end);
    v_cabe := least(coalesce(v_cabe, v_lim_c - v_gasto_c), v_lim_c - v_gasto_c);
  elsif v_cat_id is not null then
    v_linhas := v_linhas || ('📂 *' || v_cat_nome || '* não tem limite próprio. Já foram R$ ' || public.money_br(v_gasto_c) ||
      ' nela este mês. Se quiser um teto, diga "limite de 500 pro ' || lower(v_cat_nome) || '".');
  elsif v_raw <> '' and lower(v_raw) not in ('null', 'none', 'sem categoria') then
    v_linhas := v_linhas || ('📂 Não achei a categoria *' || v_raw || '*; olhei só o limite geral.');
  end if;

  if v_livre is not null then
    v_linhas := v_linhas || ('🟢 *Saldo livre do mês:* R$ ' || public.money_br(v_livre) || ' → depois da compra, R$ ' ||
      public.money_br(v_livre - v_impacto) || case when v_livre - v_impacto < 0 then ' 🚨' else '' end);
    if v_livre - v_impacto < 0 then v_nivel := 2; v_falta := true; end if;
    v_cabe := least(coalesce(v_cabe, v_livre), v_livre);
  end if;

  v_msg := '🛒 *Simulação: R$ ' || public.money_br(p_amount) ||
           case when v_cat_nome is not null then ' em ' || v_cat_nome else '' end || '*' ||
           case when v_parc > 1 then ' em ' || v_parc || 'x de R$ ' || public.money_br(v_impacto) ||
                                     E'\n_Neste mês conta só a 1ª parcela._' else ' à vista' end ||
           E'\n\n' || array_to_string(v_linhas, E'\n') || E'\n\n';

  if v_lim_g is null and v_lim_c is null and v_livre is null then
    v_msg := v_msg || '🤷 Sem limite e sem receita registrada no mês, não tenho com o que comparar. ' ||
             'Defina um limite ("meu limite é 2000") ou registre o que você recebe que eu consigo dizer se cabe.';
  elsif v_nivel = 2 then
    if v_falta then
      v_msg := v_msg || '🚨 *Não cabe no mês:* o saldo livre fica negativo.';
    elsif v_livre is not null then
      v_msg := v_msg || '🚨 *Passa do seu limite.* Dinheiro tem (o saldo livre fica em R$ ' ||
               public.money_br(v_livre - v_impacto) || '), mas estoura o teto que você definiu.';
    else
      v_msg := v_msg || '🚨 *Passa do seu limite.*';
    end if;
    if v_cabe is not null and v_cabe > 0 then
      v_msg := v_msg || ' Neste mês ainda cabem *R$ ' || public.money_br(v_cabe) || '*.';
      v_n := ceil(p_amount / v_cabe)::int;
      if v_n > v_parc and v_n <= 24 then
        v_msg := v_msg || ' Parcelando em *' || v_n || 'x* de R$ ' || public.money_br(round(p_amount / v_n, 2)) ||
                 ', a parcela cabe no que sobra deste mês (os próximos meses também vão ter essa parcela).';
      end if;
    else
      v_msg := v_msg || case when v_falta then ' Não sobra dinheiro livre neste mês.'
                              else ' O limite deste mês já foi; ele renova em *' || to_char(v_fim, 'DD/MM') || '*.' end;
    end if;
  elsif v_nivel = 1 then
    v_msg := v_msg || '⚠️ *Cabe, mas fica apertado.* Sobra pouco para o resto do mês.';
  else
    v_msg := v_msg || '✅ *Cabe no seu mês.*';
  end if;

  v_msg := v_msg || E'\n\n' || '_Só simulei, não registrei nada. Se comprar, é só me avisar._';

  return jsonb_build_object(
    'ok', true, 'simulacao', true, 'registrado', false,
    'valor', p_amount, 'parcelas', v_parc, 'impacto_no_mes', v_impacto,
    'categoria', v_cat_nome, 'limite_geral', v_lim_g, 'gasto_mes', v_gasto_g,
    'limite_categoria', v_lim_c, 'gasto_categoria', v_gasto_c, 'saldo_livre', v_livre,
    'veredito', case v_nivel when 2 then 'nao_cabe' when 1 then 'apertado' else 'cabe' end,
    'cabe_no_mes', v_cabe,
    'mensagem', v_msg);
end;
$$;

revoke all on function public.whatsapp_simulate_purchase(uuid, numeric, text, int, date) from public, anon, authenticated;
grant execute on function public.whatsapp_simulate_purchase(uuid, numeric, text, int, date) to service_role;
