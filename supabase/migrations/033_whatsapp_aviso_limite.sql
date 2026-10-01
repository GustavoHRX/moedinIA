-- 033_whatsapp_aviso_limite.sql — agente WhatsApp (30/09/2026)
-- Aviso de limite junto da confirmação do lançamento.
--
-- Contexto: neste mesmo dia os alertas automáticos (9h e resumo de domingo) foram desligados, para o número
-- não mandar mensagem por conta própria — é o que mais pesa para banimento na Evolution. O aviso de limite
-- passa a viver só aqui: é RESPOSTA a uma mensagem do usuário, nunca iniciativa do bot.
--
-- Antes (migration 029) o aviso só aparecia no instante em que o gasto CRUZAVA 80% ou 100%. Quem já tinha
-- estourado o limite lançava os gastos seguintes sem ouvir nada. Agora, para o limite da categoria e para o
-- limite geral do mês, cada um vira no máximo UMA linha:
--
--   🚨 Com esse gasto, passou do limite de *Lazer*: R$ 320,00 de R$ 300,00 (R$ 20,00 acima).   cruzou 100%
--   🚨 Com esse gasto, bateu exatamente o limite de *Lazer* (R$ 300,00).                       chegou a 100% em cheio
--   🚨 Já passou do limite de *Lazer*: R$ 420,00 de R$ 300,00 (R$ 120,00 acima).               já estava acima e o
--                                                                                              gasto é alto (≥ 10% do limite);
--                                                                                              gasto pequeno: silêncio
--   ⚠️ Com esse gasto, chegou a 85% do limite de *Lazer*: restam R$ 45,00 de R$ 300,00.         cruzou 80%
--   ⚠️ Já usou 92% do limite de *Lazer*: restam R$ 24,00.                                       entre 80% e 100%
--   ⚠️ Só esse gasto é 60% do limite de *Lazer*: restam R$ 400,00.                              gasto alto (≥ 50% sozinho)
--
-- O mês comparado é o do lançamento (um gasto com data de agosto conta contra o limite de agosto), e o
-- gasto é somado por transaction_date, igual a whatsapp_monthly_limit — o que o bot mostra em "qual meu
-- limite" e o que ele avisa batem. O site grava os limites na mesma tabela (budgets; category_id nulo =
-- limite geral), então limite definido pelo painel também vale aqui.
--
-- whatsapp_create_transaction é reescrita só no bloco do aviso; o resto é cópia fiel da versão no ar.
-- Idempotente. Grant só service_role.

create or replace function public.whatsapp_limit_alert_line(
  p_categoria text,   -- nome da categoria; NULL = limite geral do mês
  p_lim numeric,
  p_after numeric,    -- gasto do mês JÁ contando este lançamento
  p_amount numeric    -- valor deste lançamento
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_before numeric := p_after - p_amount;
  v_alvo text := case when p_categoria is null then '*limite geral do mês*'
                      else 'limite de *' || p_categoria || '*' end;
  v_pct int;
begin
  if p_lim is null or p_lim <= 0 or p_amount is null or p_amount <= 0 then
    return null;
  end if;
  v_pct := floor(p_after / p_lim * 100);

  if p_after = p_lim and v_before < p_lim then
    return '🚨 Com esse gasto, bateu exatamente o ' || v_alvo || ' (R$ ' || public.money_br(p_lim) || ').';
  elsif p_after > p_lim and v_before < p_lim then
    return '🚨 Com esse gasto, passou do ' || v_alvo || ': R$ ' || public.money_br(p_after) ||
           ' de R$ ' || public.money_br(p_lim) || ' (R$ ' || public.money_br(p_after - p_lim) || ' acima).';
  elsif v_before >= p_lim then
    -- Já estava acima: avisou uma vez, no gasto que estourou. Repetir a cada cafezinho vira ruído e a
    -- pessoa para de ler; então só volta a avisar quando o gasto em si é alto (10% do limite ou mais).
    if p_amount >= p_lim * 0.1 then
      return '🚨 Já passou do ' || v_alvo || ': R$ ' || public.money_br(p_after) ||
             ' de R$ ' || public.money_br(p_lim) || ' (R$ ' || public.money_br(p_after - p_lim) || ' acima).';
    end if;
    return null;
  elsif p_after >= p_lim * 0.8 and v_before < p_lim * 0.8 then
    return '⚠️ Com esse gasto, chegou a ' || v_pct || '% do ' || v_alvo || ': restam R$ ' ||
           public.money_br(p_lim - p_after) || ' de R$ ' || public.money_br(p_lim) || '.';
  elsif p_after >= p_lim * 0.8 then
    return '⚠️ Já usou ' || v_pct || '% do ' || v_alvo || ': restam R$ ' || public.money_br(p_lim - p_after) || '.';
  elsif p_amount >= p_lim * 0.5 then
    return '⚠️ Só esse gasto é ' || floor(p_amount / p_lim * 100) || '% do ' || v_alvo || ': restam R$ ' ||
           public.money_br(p_lim - p_after) || '.';
  end if;
  return null;
end;
$$;

create or replace function public.whatsapp_limit_alert(
  p_user_id uuid,
  p_cat_id uuid,
  p_month date,
  p_amount numeric
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', p_month)::date;
  v_fim date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_cat_name text;
  v_lim numeric;
  v_after numeric;
  v_linha text;
  v_linhas text[] := '{}';
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    return null;
  end if;

  -- 1) limite da categoria do lançamento
  if p_cat_id is not null then
    select amount into v_lim from public.budgets
     where user_id = p_user_id and category_id = p_cat_id and month_ref = v_mes;
    if v_lim > 0 then
      select coalesce(sum(amount), 0) into v_after from public.transactions
       where user_id = p_user_id and type = 'expense' and status = 'active' and category_id = p_cat_id
         and transaction_date >= v_mes and transaction_date < v_fim;
      select name into v_cat_name from public.categories where id = p_cat_id;
      v_linha := public.whatsapp_limit_alert_line(coalesce(v_cat_name, 'essa categoria'), v_lim, v_after, p_amount);
      if v_linha is not null then v_linhas := v_linhas || v_linha; end if;
    end if;
  end if;

  -- 2) limite geral do mês
  v_lim := null;
  select amount into v_lim from public.budgets
   where user_id = p_user_id and category_id is null and month_ref = v_mes;
  if v_lim > 0 then
    select coalesce(sum(amount), 0) into v_after from public.transactions
     where user_id = p_user_id and type = 'expense' and status = 'active'
       and transaction_date >= v_mes and transaction_date < v_fim;
    v_linha := public.whatsapp_limit_alert_line(null, v_lim, v_after, p_amount);
    if v_linha is not null then v_linhas := v_linhas || v_linha; end if;
  end if;

  return nullif(array_to_string(v_linhas, E'\n'), '');
end;
$$;

create or replace function public.whatsapp_create_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_date date default null,
  p_category text default null,
  p_external_id text default null,
  p_notes text default null,
  p_currency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := case when p_type = 'income' then 'income' else 'expense' end;
  v_date date := coalesce(p_date, public.whatsapp_today());
  v_month date;
  v_desc text := left(btrim(coalesce(p_description, '')), 255);
  v_amount numeric := p_amount;
  v_code text := public.whatsapp_currency_code(p_currency);
  v_rate numeric; v_fx_txt text := '';
  v_cat_id uuid;
  v_cat_name text;
  v_id uuid;
  v_aprendida boolean := false;
  v_alerta text := '';
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Valor inválido: informe um valor maior que zero.');
  end if;

  if v_code is not null and v_code <> 'BRL' then
    select rate_brl into v_rate from public.fx_rates where code = v_code;
    if v_rate is null then
      return jsonb_build_object('ok', false, 'mensagem',
        'Não tenho a cotação de ' || v_code || ' agora. Me diz o valor em reais que eu registro.');
    end if;
    v_amount := round(p_amount * v_rate, 2);
    v_fx_txt := ' (' || public.whatsapp_currency_symbol(v_code) || public.money_br(p_amount) ||
                ' × ' || replace(round(v_rate, 2)::text, '.', ',') || ')';
    v_desc := left(v_desc || ' (' || public.whatsapp_currency_symbol(v_code) || public.money_br(p_amount) || ')', 255);
  end if;
  v_month := date_trunc('month', v_date)::date;

  v_cat_id := public.whatsapp_apply_category_rule(p_user_id, v_desc, v_type);
  v_aprendida := v_cat_id is not null;
  if v_cat_id is null then v_cat_id := public.whatsapp_category_id(p_user_id, p_category, v_type); end if;
  select name into v_cat_name from public.categories where id = v_cat_id;
  if v_desc = '' then v_desc := coalesce(v_cat_name, 'Lançamento'); end if;

  if p_external_id is not null and btrim(p_external_id) <> '' then
    insert into public.transactions
      (user_id, type, amount, description, notes, transaction_date, competence_month,
       category_id, source, external_message_id, status, origin_type)
    values
      (p_user_id, v_type, round(v_amount, 2), v_desc, p_notes, v_date,
       v_month, v_cat_id, 'whatsapp', left(btrim(p_external_id), 120), 'active', 'manual')
    on conflict (user_id, external_message_id) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.transactions
       where user_id = p_user_id and external_message_id = left(btrim(p_external_id), 120);
      return jsonb_build_object('ok', true, 'duplicado', true, 'id', v_id,
        'mensagem', 'Esse lançamento já tinha sido registrado (mensagem repetida) — não dupliquei.');
    end if;
  else
    insert into public.transactions
      (user_id, type, amount, description, notes, transaction_date, competence_month,
       category_id, source, status, origin_type)
    values
      (p_user_id, v_type, round(v_amount, 2), v_desc, p_notes, v_date,
       v_month, v_cat_id, 'whatsapp', 'active', 'manual')
    returning id into v_id;
  end if;

  if v_type = 'expense' then
    v_alerta := coalesce(public.whatsapp_limit_alert(p_user_id, v_cat_id, v_month, round(v_amount, 2)), '');
  end if;

  return jsonb_build_object(
    'ok', true, 'duplicado', false, 'id', v_id, 'categoria_aprendida', v_aprendida,
    'tipo', v_type, 'valor', round(v_amount, 2), 'categoria', v_cat_name,
    'descricao', v_desc, 'data', to_char(v_date, 'DD/MM/YYYY'),
    'moeda', coalesce(v_code, 'BRL'), 'alerta', nullif(v_alerta, ''),
    'mensagem', case when v_type = 'income' then '✅ Receita' else '❌ Gasto' end ||
                ' de *R$ ' || public.money_br(v_amount) || '*' || v_fx_txt || ' em ' || coalesce(v_cat_name, 'Outras') ||
                ' registrad' || case when v_type = 'income' then 'a' else 'o' end ||
                case when v_date <> public.whatsapp_today() then ' (' || to_char(v_date, 'DD/MM') || ')' else '' end || '.' ||
                case when v_aprendida then ' 🧠' else '' end ||
                case when v_alerta <> '' then E'\n' || v_alerta else '' end);
end;
$$;

revoke all on function public.whatsapp_limit_alert_line(text, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.whatsapp_limit_alert(uuid, uuid, date, numeric) from public, anon, authenticated;
revoke all on function public.whatsapp_create_transaction(uuid, text, numeric, text, date, text, text, text, text) from public, anon, authenticated;

grant execute on function public.whatsapp_limit_alert_line(text, numeric, numeric, numeric) to service_role;
grant execute on function public.whatsapp_limit_alert(uuid, uuid, date, numeric) to service_role;
grant execute on function public.whatsapp_create_transaction(uuid, text, numeric, text, date, text, text, text, text) to service_role;
