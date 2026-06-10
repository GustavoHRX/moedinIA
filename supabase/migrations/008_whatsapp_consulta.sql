-- 008_whatsapp_consulta.sql
-- Agente de consulta do WhatsApp: relatório mensal de gastos e exclusão de
-- lançamento. As funções devolvem o TEXTO pronto pra enviar (formatação em SQL,
-- sem gastar IA). Soft-delete consistente com o site (status='deleted').

-- Helper: formata número no padrão BR (1.780,65) ---------------------------
create or replace function public.money_br(v numeric)
returns text
language sql
immutable
as $$
  select replace(replace(replace(
           to_char(coalesce(v, 0), 'FM999G999G990D00'),
           ',', '|'), '.', ','), '|', '.');
$$;

-- Relatório mensal de gastos (estilo Porquim) ------------------------------
create or replace function public.whatsapp_monthly_report(
  p_user_id uuid,
  p_ref date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', p_ref)::date;
  v_end   date := p_ref;
  v_total numeric;
  v_body  text;
  v_msg   text;
begin
  select coalesce(sum(amount), 0) into v_total
    from public.transactions
   where user_id = p_user_id and type = 'expense' and status = 'active'
     and transaction_date between v_start and v_end;

  if v_total = 0 then
    return jsonb_build_object(
      'ok', true,
      'mensagem', '📊 Você ainda não registrou gastos em ' ||
                  to_char(v_start, 'MM/YYYY') || '. Manda um "gastei X em Y" que eu anoto! 💰'
    );
  end if;

  -- Monta um bloco por categoria, com os itens dentro
  select string_agg(bloco, E'\n\n' order by ordem)
    into v_body
  from (
    select
      coalesce(c.name, 'Sem categoria') as cat,
      sum(t.amount) as ordem,
      coalesce(c.name, 'Sem categoria') || ' → (R$ ' || public.money_br(sum(t.amount)) || ')' ||
      E'\n' ||
      string_agg(
        '  - (' || to_char(t.transaction_date, 'DD/MM') || ') - ' ||
        coalesce(nullif(t.description, ''), 'Lançamento') || ': R$ ' || public.money_br(t.amount),
        E'\n' order by t.transaction_date, t.created_at
      ) as bloco
    from public.transactions t
    left join public.categories c on c.id = t.category_id
    where t.user_id = p_user_id and t.type = 'expense' and t.status = 'active'
      and t.transaction_date between v_start and v_end
    group by coalesce(c.name, 'Sem categoria')
  ) blocos;

  v_msg := '📊 *Relatório de Gastos* 🔴' || E'\n' ||
           '🗓 Período: ' || to_char(v_start, 'DD/MM/YYYY') || ' a ' || to_char(v_end, 'DD/MM/YYYY') ||
           E'\n\n' || v_body || E'\n\n' ||
           '💸 *Total Gasto no Período: R$ ' || public.money_br(v_total) || '*';

  return jsonb_build_object('ok', true, 'mensagem', v_msg, 'total', v_total);
end;
$$;

-- Exclusão de lançamento (soft-delete) -------------------------------------
-- p_alvo: termo da descrição, "ultimo", ou um id/prefixo de id.
create or replace function public.whatsapp_delete_transaction(
  p_user_id uuid,
  p_alvo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_tx   public.transactions%rowtype;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  if v_alvo = '' or v_alvo ~ '(ultim|último|ultimo|mais recente)' then
    -- último lançamento ativo
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active'
     order by created_at desc limit 1;
  elsif v_alvo ~ '^[0-9a-f]{4,}$' then
    -- prefixo de id (ex: f747ef)
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active' and id::text like v_alvo || '%'
     order by created_at desc limit 1;
  else
    -- por descrição (mais recente que casa)
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active'
       and lower(coalesce(description, '')) like '%' || v_alvo || '%'
     order by created_at desc limit 1;
  end if;

  if v_tx.id is null then
    return jsonb_build_object(
      'ok', false,
      'mensagem', '🤔 Não encontrei um gasto com "' || coalesce(p_alvo, '') ||
                  '" pra excluir. Tenta com a descrição exata ou diz "exclui o último".'
    );
  end if;

  update public.transactions
     set status = 'deleted', deleted_at = now(), updated_at = now()
   where id = v_tx.id;

  return jsonb_build_object(
    'ok', true,
    'mensagem', '❌ Gasto excluído com sucesso!' || E'\n' ||
                '📝 ' || coalesce(nullif(v_tx.description, ''), 'Lançamento') ||
                ' — R$ ' || public.money_br(v_tx.amount),
    'id', v_tx.id
  );
end;
$$;

grant execute on function public.money_br(numeric)                          to anon, authenticated, service_role;
grant execute on function public.whatsapp_monthly_report(uuid, date)        to anon, authenticated, service_role;
grant execute on function public.whatsapp_delete_transaction(uuid, text)    to anon, authenticated, service_role;
