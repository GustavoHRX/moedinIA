-- 030_whatsapp_update_transaction.sql — agente WhatsApp v2.8 (20/09/2026)
-- Editar um lançamento já registrado: valor, descrição, data, categoria e tipo.
-- Antes só dava para excluir e lançar de novo.
--
-- Decisões:
--  * Só edita lançamento AVULSO (origin_type = 'manual'). Ocorrência de gasto fixo
--    ou receita fixa se altera pelo cadastro (editar_fixo); parcela de parcelamento
--    não se edita solta.
--  * Alvo: "ultimo", prefixo de id (vindo de buscar_lancamentos) ou trecho da
--    descrição. Diferente da exclusão, se o trecho bater em MAIS de um lançamento a
--    função não escolhe sozinha: devolve a lista para perguntar.
--  * Um prefixo que parece hexadecimal mas não é id ("cafe", "bebe") cai para a busca
--    por descrição, em vez de "não encontrei".
--  * Data no futuro é recusada. Mudar a data recalcula o mês de competência.
--  * Mudar o tipo (despesa <-> receita) sem dizer a categoria manda para "Outras".
--  * Não aprende regra de categoria: isso continua sendo do corrigir_categoria.
-- Idempotente. Grant só service_role.

create or replace function public.whatsapp_update_transaction(
  p_user_id uuid,
  p_alvo text,
  p_amount numeric default null,
  p_description text default null,
  p_date date default null,
  p_category text default null,
  p_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_tx public.transactions%rowtype;
  v_n int;
  v_lista text;
  v_desc text := nullif(left(btrim(coalesce(p_description, '')), 255), '');
  v_cat text := nullif(btrim(coalesce(p_category, '')), '');
  v_type text;
  v_cat_id uuid;
  v_cat_old text;
  v_cat_new text;
  v_new_date date;
  v_mud text := '';
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null and v_desc is null and p_date is null and v_cat is null and p_type is null then
    return jsonb_build_object('ok', false,
      'mensagem', 'O que quer mudar: o valor, a descrição, a data ou a categoria?');
  end if;
  if p_amount is not null and p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'O valor precisa ser maior que zero.');
  end if;
  if p_date is not null and p_date > public.whatsapp_today() then
    return jsonb_build_object('ok', false, 'mensagem', 'Não lanço com data no futuro. Qual a data certa?');
  end if;
  if p_type is not null and p_type not in ('income', 'expense') then
    return jsonb_build_object('ok', false, 'mensagem', 'O tipo é "gasto" ou "receita".');
  end if;

  -- resolver o alvo
  if v_alvo = '' or v_alvo ~ '(ultim|último|mais recente)' then
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active'
     order by created_at desc limit 1;
  else
    if v_alvo ~ '^[0-9a-f]{4,}$' then
      select * into v_tx from public.transactions
       where user_id = p_user_id and status = 'active' and id::text like v_alvo || '%'
       order by created_at desc limit 1;
    end if;
    if v_tx.id is null then
      select count(*) into v_n from public.transactions
       where user_id = p_user_id and status = 'active'
         and lower(coalesce(description, '')) like '%' || v_alvo || '%';
      if v_n > 1 then
        select string_agg(x.linha, E'\n' order by x.rn) into v_lista from (
          select row_number() over (order by created_at desc) as rn,
                 row_number() over (order by created_at desc) || '. (' || to_char(transaction_date, 'DD/MM') || ') ' ||
                 coalesce(nullif(description, ''), 'Lançamento') || ' — R$ ' || public.money_br(amount) ||
                 ' [' || left(id::text, 8) || ']' as linha
            from public.transactions
           where user_id = p_user_id and status = 'active'
             and lower(coalesce(description, '')) like '%' || v_alvo || '%'
           order by created_at desc limit 5) x;
        return jsonb_build_object('ok', false, 'ambiguo', true, 'encontrados', v_n,
          'mensagem', 'Encontrei ' || v_n || ' lançamentos com "' || p_alvo || '":' || E'\n' || v_lista ||
                      E'\n' || 'Qual deles quer alterar?');
      end if;
      select * into v_tx from public.transactions
       where user_id = p_user_id and status = 'active'
         and lower(coalesce(description, '')) like '%' || v_alvo || '%'
       order by created_at desc limit 1;
    end if;
  end if;

  if v_tx.id is null then
    return jsonb_build_object('ok', false, 'encontrados', 0,
      'mensagem', '🤔 Não encontrei um lançamento com "' || coalesce(p_alvo, '') ||
                  '". Diga "o último" ou uma palavra da descrição.');
  end if;

  if v_tx.origin_type <> 'manual' then
    return jsonb_build_object('ok', false, 'origem', v_tx.origin_type,
      'mensagem', case when v_tx.origin_type = 'installment'
        then 'Esse lançamento é uma parcela de um parcelamento, então não edito parcela solta. Se o parcelamento está errado, me diga para excluí-lo e criar de novo.'
        else 'Esse lançamento vem de um gasto ou receita fixa. Para mudar o valor ou o dia, diga por exemplo "muda o valor da internet pra 130": vale para as próximas ocorrências.' end);
  end if;

  v_type := coalesce(p_type, v_tx.type);
  v_new_date := coalesce(p_date, v_tx.transaction_date);

  if v_cat is not null then
    v_cat_id := public.whatsapp_category_id(p_user_id, v_cat, v_type);
  elsif v_type <> v_tx.type then
    v_cat_id := public.whatsapp_category_id(p_user_id, null, v_type);
  else
    v_cat_id := v_tx.category_id;
  end if;

  select name into v_cat_old from public.categories where id = v_tx.category_id;
  select name into v_cat_new from public.categories where id = v_cat_id;

  if p_amount is not null and round(p_amount, 2) <> v_tx.amount then
    v_mud := v_mud || '• Valor: R$ ' || public.money_br(v_tx.amount) || ' → *R$ ' || public.money_br(p_amount) || '*' || E'\n'; end if;
  if v_desc is not null and v_desc <> coalesce(v_tx.description, '') then
    v_mud := v_mud || '• Descrição: ' || coalesce(nullif(v_tx.description, ''), '—') || ' → *' || v_desc || '*' || E'\n'; end if;
  if v_new_date <> v_tx.transaction_date then
    v_mud := v_mud || '• Data: ' || to_char(v_tx.transaction_date, 'DD/MM') || ' → *' || to_char(v_new_date, 'DD/MM') || '*' || E'\n'; end if;
  if v_type <> v_tx.type then
    v_mud := v_mud || '• Tipo: ' || case v_tx.type when 'income' then 'receita' else 'gasto' end ||
             ' → *' || case v_type when 'income' then 'receita' else 'gasto' end || '*' || E'\n'; end if;
  if v_cat_id is distinct from v_tx.category_id then
    v_mud := v_mud || '• Categoria: ' || coalesce(v_cat_old, '—') || ' → *' || coalesce(v_cat_new, '—') || '*' || E'\n'; end if;

  if v_mud = '' then
    return jsonb_build_object('ok', true, 'sem_mudanca', true, 'id', v_tx.id,
      'mensagem', 'Já estava assim — nada para mudar em ' || coalesce(nullif(v_tx.description, ''), 'Lançamento') || '.');
  end if;

  update public.transactions
     set amount = coalesce(round(p_amount, 2), amount),
         description = coalesce(v_desc, description),
         transaction_date = v_new_date,
         competence_month = date_trunc('month', v_new_date)::date,
         type = v_type,
         category_id = v_cat_id,
         updated_at = now()
   where id = v_tx.id;

  return jsonb_build_object('ok', true, 'id', v_tx.id,
    'mensagem', '✏️ *Lançamento atualizado*' || E'\n' ||
                '📝 ' || coalesce(v_desc, nullif(v_tx.description, ''), 'Lançamento') || E'\n' ||
                rtrim(v_mud, E'\n'));
end;
$$;

revoke all on function public.whatsapp_update_transaction(uuid, text, numeric, text, date, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_update_transaction(uuid, text, numeric, text, date, text, text) to service_role;
