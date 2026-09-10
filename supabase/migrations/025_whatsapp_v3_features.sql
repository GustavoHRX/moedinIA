-- 025_whatsapp_v3_features.sql — agente WhatsApp v2.4 (10/09/2026)
--  1. Categoria por aprendizado: tabela whatsapp_category_rules + whatsapp_set_category
--     (corrige a categoria de um lançamento e, se pedido, lembra "termo → categoria").
--     As regras são aplicadas em whatsapp_create_transaction e na importação.
--  2. Metas (tabela goals já existe): whatsapp_create_goal, whatsapp_add_to_goal,
--     whatsapp_list_goals; resumo do mês mostra o progresso.
--  3. Desfazer importação: a importação passa a registrar os ids criados em
--     message_logs.parsed_json.import_ids; whatsapp_undo_import reverte (soft).
--  4. Lembrete de fatura: whatsapp_daily_alerts avisa 2 dias antes do vencimento
--     guardado em parsed_json.vencimento; respeita whatsapp_muted_until.
--  5. Resumo semanal: whatsapp_weekly_summaries (domingo à noite, workflow).
--  6. Silenciar: coluna user_settings.whatsapp_muted_until + whatsapp_mute_alerts.
-- Idempotente. Só adiciona (tabela nova, coluna nova nullable, funções). Grant só service_role.

-- ---------------------------------------------------------------------------
-- Estruturas
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pattern text not null,                        -- termo em minúsculas; casa com like '%pattern%'
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, pattern)
);
create index if not exists idx_wa_category_rules_user on public.whatsapp_category_rules(user_id);
alter table public.whatsapp_category_rules enable row level security;
drop policy if exists "own category rules" on public.whatsapp_category_rules;
create policy "own category rules" on public.whatsapp_category_rules
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.user_settings add column if not exists whatsapp_muted_until timestamptz;

-- ---------------------------------------------------------------------------
-- 1. Regras de categoria
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_apply_category_rule(
  p_user_id uuid, p_description text, p_type text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.category_id
    from public.whatsapp_category_rules r
    join public.categories c on c.id = r.category_id
   where r.user_id = p_user_id
     and c.type = case when p_type = 'income' then 'income' else 'expense' end
     and lower(coalesce(p_description, '')) like '%' || r.pattern || '%'
   order by length(r.pattern) desc
   limit 1;
$$;

create or replace function public.whatsapp_set_category(
  p_user_id uuid,
  p_alvo text,
  p_categoria text,
  p_lembrar boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_tx public.transactions%rowtype;
  v_cat uuid;
  v_cat_name text;
  v_pattern text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if btrim(coalesce(p_categoria, '')) = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Qual categoria você quer usar?');
  end if;

  if v_alvo = '' or v_alvo ~ '(ultim|último|ultimo|mais recente)' then
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active' order by created_at desc limit 1;
  elsif v_alvo ~ '^[0-9a-f]{4,}$' then
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active' and id::text like v_alvo || '%'
     order by created_at desc limit 1;
  else
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active'
       and lower(coalesce(description, '')) like '%' || v_alvo || '%'
     order by created_at desc limit 1;
  end if;
  if v_tx.id is null then
    return jsonb_build_object('ok', false, 'mensagem', '🤔 Não encontrei um lançamento com "' || coalesce(p_alvo, '') || '" para mudar a categoria.');
  end if;

  v_cat := public.whatsapp_category_id(p_user_id, p_categoria, v_tx.type);
  select name into v_cat_name from public.categories where id = v_cat;
  update public.transactions set category_id = v_cat, updated_at = now() where id = v_tx.id;

  if coalesce(p_lembrar, true) then
    v_pattern := lower(btrim(coalesce(v_tx.description, '')));
    if length(v_pattern) >= 3 then
      insert into public.whatsapp_category_rules (user_id, pattern, category_id)
      values (p_user_id, v_pattern, v_cat)
      on conflict (user_id, pattern) do update set category_id = excluded.category_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_tx.id, 'categoria', v_cat_name,
    'mensagem', '🏷️ "' || coalesce(v_tx.description, 'Lançamento') || '" (R$ ' || public.money_br(v_tx.amount) ||
                ') agora está em *' || v_cat_name || '*.' ||
                case when coalesce(p_lembrar, true) and length(coalesce(v_pattern, '')) >= 3
                     then E'\n' || '🧠 Vou lembrar: ' || v_tx.description || ' → ' || v_cat_name || '.' else '' end);
end;
$$;

-- create_transaction passa a respeitar as regras aprendidas
create or replace function public.whatsapp_create_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_date date default null,
  p_category text default null,
  p_external_id text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := case when p_type = 'income' then 'income' else 'expense' end;
  v_date date := coalesce(p_date, public.whatsapp_today());
  v_desc text := left(btrim(coalesce(p_description, '')), 255);
  v_cat_id uuid;
  v_cat_name text;
  v_id uuid;
  v_aprendida boolean := false;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Valor inválido: informe um valor maior que zero.');
  end if;

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
      (p_user_id, v_type, round(p_amount, 2), v_desc, p_notes, v_date,
       date_trunc('month', v_date)::date, v_cat_id, 'whatsapp', left(btrim(p_external_id), 120),
       'active', 'manual')
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
      (p_user_id, v_type, round(p_amount, 2), v_desc, p_notes, v_date,
       date_trunc('month', v_date)::date, v_cat_id, 'whatsapp', 'active', 'manual')
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'duplicado', false, 'id', v_id, 'categoria_aprendida', v_aprendida,
    'tipo', v_type, 'valor', round(p_amount, 2), 'categoria', v_cat_name,
    'descricao', v_desc, 'data', to_char(v_date, 'DD/MM/YYYY'),
    'mensagem', case when v_type = 'income' then '✅ Receita' else '❌ Gasto' end ||
                ' de *R$ ' || public.money_br(p_amount) || '* em ' || coalesce(v_cat_name, 'Outras') ||
                ' registrad' || case when v_type = 'income' then 'a' else 'o' end ||
                case when v_date <> public.whatsapp_today() then ' (' || to_char(v_date, 'DD/MM') || ')' else '' end || '.' ||
                case when v_aprendida then ' 🧠' else '' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Metas
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_goal_bar(p_cur numeric, p_target numeric)
returns text language sql immutable as $$
  select repeat('▰', least(10, floor(case when p_target > 0 then p_cur / p_target * 10 else 0 end)::int)) ||
         repeat('▱', greatest(0, 10 - least(10, floor(case when p_target > 0 then p_cur / p_target * 10 else 0 end)::int))) ||
         ' ' || round(case when p_target > 0 then p_cur / p_target * 100 else 0 end) || '%';
$$;

create or replace function public.whatsapp_create_goal(
  p_user_id uuid, p_title text, p_target numeric, p_deadline date default null, p_initial numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_title text := left(btrim(coalesce(p_title, '')), 120);
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;
  if v_title = '' then return jsonb_build_object('ok', false, 'mensagem', 'Qual o nome da meta? (ex.: reserva de emergência, viagem)'); end if;
  if p_target is null or p_target <= 0 then return jsonb_build_object('ok', false, 'mensagem', 'Qual o valor que você quer juntar?'); end if;
  insert into public.goals (user_id, title, target_amount, current_amount, deadline, status)
  values (p_user_id, v_title, round(p_target, 2), greatest(coalesce(p_initial, 0), 0), p_deadline, 'active')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id,
    'mensagem', '🎯 *Meta criada*' || E'\n' || v_title || ' — R$ ' || public.money_br(p_target) ||
                case when p_deadline is not null then ' até ' || to_char(p_deadline, 'DD/MM/YYYY') else '' end || E'\n' ||
                public.whatsapp_goal_bar(greatest(coalesce(p_initial, 0), 0), p_target) || E'\n' ||
                'Quando guardar dinheiro, me diga "guardei 200 na ' || v_title || '".');
end;
$$;

create or replace function public.whatsapp_add_to_goal(
  p_user_id uuid, p_alvo text, p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_g public.goals%rowtype; v_alvo text := lower(btrim(coalesce(p_alvo, ''))); v_n int; v_new numeric;
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;
  if p_amount is null or p_amount = 0 then return jsonb_build_object('ok', false, 'mensagem', 'Quanto você guardou (ou retirou)?'); end if;
  select count(*) into v_n from public.goals where user_id = p_user_id and status = 'active';
  if v_n = 0 then return jsonb_build_object('ok', false, 'mensagem', 'Você ainda não tem meta ativa. Quer criar uma? Ex.: "meta: juntar 3000 para viagem".'); end if;
  if v_alvo = '' and v_n = 1 then
    select * into v_g from public.goals where user_id = p_user_id and status = 'active' limit 1;
  else
    select * into v_g from public.goals
     where user_id = p_user_id and status = 'active' and lower(title) like '%' || v_alvo || '%'
     order by created_at desc limit 1;
  end if;
  if v_g.id is null then
    return jsonb_build_object('ok', false, 'ambiguo', v_n > 1, 'mensagem',
      'Qual meta? ' || (select string_agg(title, ', ' order by created_at) from public.goals where user_id = p_user_id and status = 'active'));
  end if;
  v_new := greatest(v_g.current_amount + p_amount, 0);
  update public.goals set current_amount = v_new, updated_at = now(),
         status = case when v_new >= target_amount then 'completed' else status end
   where id = v_g.id;
  return jsonb_build_object('ok', true, 'id', v_g.id, 'atual', v_new, 'alvo', v_g.target_amount,
    'mensagem', case when p_amount > 0 then '💰 Guardado R$ ' || public.money_br(p_amount) else '↩️ Retirado R$ ' || public.money_br(-p_amount) end ||
                ' na meta *' || v_g.title || '*' || E'\n' || public.whatsapp_goal_bar(v_new, v_g.target_amount) ||
                ' (R$ ' || public.money_br(v_new) || ' de R$ ' || public.money_br(v_g.target_amount) || ')' ||
                case when v_new >= v_g.target_amount then E'\n' || '🎉 *Meta concluída!* Parabéns!' else '' end);
end;
$$;

create or replace function public.whatsapp_list_goals(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_txt text;
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;
  select string_agg('• *' || title || '* — R$ ' || public.money_br(current_amount) || ' de R$ ' || public.money_br(target_amount) ||
                    case when deadline is not null then ' (até ' || to_char(deadline, 'DD/MM/YYYY') || ')' else '' end || E'\n' ||
                    '  ' || public.whatsapp_goal_bar(current_amount, target_amount), E'\n' order by created_at)
    into v_txt from public.goals where user_id = p_user_id and status = 'active';
  return jsonb_build_object('ok', true,
    'mensagem', case when v_txt is null then '🎯 Você ainda não tem metas ativas. Crie uma: "meta: juntar 3000 para viagem até dezembro".'
                     else '🎯 *Suas metas*' || E'\n' || v_txt end);
end;
$$;

-- resumo do mês com metas
create or replace function public.whatsapp_month_summary(
  p_user_id uuid,
  p_ref date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref date := coalesce(p_ref, public.whatsapp_today());
  v_month date := date_trunc('month', v_ref)::date;
  v_next date := (v_month + interval '1 month')::date;
  v_in numeric; v_out numeric; v_saldo numeric;
  v_fixos_pend numeric; v_parc_pend numeric; v_receitas_pend numeric;
  v_livre numeric; v_limit numeric; v_goals text;
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;
  select coalesce(sum(amount) filter (where type = 'income'), 0), coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_in, v_out from public.transactions
   where user_id = p_user_id and status = 'active' and transaction_date >= v_month and transaction_date < v_next;
  v_saldo := v_in - v_out;
  select coalesce(sum(f.amount), 0) into v_fixos_pend from public.fixed_expenses f
   where f.user_id = p_user_id and f.is_active and coalesce(f.start_date, f.created_at::date) < v_next
     and (f.end_date is null or f.end_date >= v_month)
     and not exists (select 1 from public.transactions t where t.fixed_expense_id = f.id and t.competence_month = v_month);
  select coalesce(sum(i.installment_amount), 0) into v_parc_pend from public.installments i
   where i.user_id = p_user_id and i.is_active and i.start_date < v_next
     and (i.start_date + make_interval(months => i.total_installments - 1))::date >= v_month
     and not exists (select 1 from public.transactions t where t.installment_id = i.id and t.competence_month = v_month);
  select coalesce(sum(f.amount), 0) into v_receitas_pend from public.fixed_incomes f
   where f.user_id = p_user_id and f.is_active and f.amount > 0 and coalesce(f.start_date, f.created_at::date) < v_next
     and (f.end_date is null or f.end_date >= v_month)
     and not exists (select 1 from public.transactions t where t.fixed_income_id = f.id and t.competence_month = v_month);
  v_livre := v_saldo + v_receitas_pend - v_fixos_pend - v_parc_pend;
  select amount into v_limit from public.budgets where user_id = p_user_id and category_id is null and month_ref = v_month limit 1;
  select string_agg('• ' || title || ': ' || public.whatsapp_goal_bar(current_amount, target_amount), E'\n' order by created_at)
    into v_goals from (select * from public.goals where user_id = p_user_id and status = 'active' order by created_at limit 3) g;

  return jsonb_build_object(
    'ok', true, 'mes', to_char(v_month, 'MM/YYYY'), 'entradas', v_in, 'saidas', v_out, 'saldo', v_saldo,
    'fixos_pendentes', v_fixos_pend, 'parcelas_pendentes', v_parc_pend, 'receitas_pendentes', v_receitas_pend,
    'saldo_livre', v_livre, 'limite', v_limit,
    'mensagem', '📋 *Resumo de ' || to_char(v_month, 'MM/YYYY') || '*' || E'\n\n' ||
                '💰 Entradas: R$ ' || public.money_br(v_in) || E'\n' ||
                '💸 Saídas: R$ ' || public.money_br(v_out) || E'\n' ||
                '🧮 Saldo: *R$ ' || public.money_br(v_saldo) || '*' || E'\n\n' ||
                '📌 Fixos ainda por vencer: R$ ' || public.money_br(v_fixos_pend) ||
                case when v_parc_pend > 0 then E'\n' || '🧾 Parcelas por vencer: R$ ' || public.money_br(v_parc_pend) else '' end ||
                case when v_receitas_pend > 0 then E'\n' || '💵 A receber: R$ ' || public.money_br(v_receitas_pend) else '' end ||
                E'\n' || '🟢 Saldo livre estimado: *R$ ' || public.money_br(v_livre) || '*' ||
                case when v_limit is not null then E'\n\n' || '🎯 Limite do mês: R$ ' || public.money_br(v_limit) ||
                     ' (usado ' || round(case when v_limit > 0 then v_out / v_limit * 100 else 0 end) || '%)' else '' end ||
                case when v_goals is not null then E'\n\n' || '🏁 *Metas*' || E'\n' || v_goals else '' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Importação com registro de ids + desfazer
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_import_statement(
  p_user_id uuid,
  p_modo text default 'tudo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modo text := case when p_modo in ('tudo','parcelados','avulsos') then p_modo else 'tudo' end;
  v_today date := public.whatsapp_today();
  v_log record; v_item jsonb; v_idx int := 0;
  v_data date; v_desc text; v_valor numeric; v_tipo text; v_pa int; v_pt int;
  v_cat uuid; v_inst uuid; v_start date; v_total_inst int; v_first int; v_num int; v_id uuid;
  v_avulsos int := 0; v_parcelamentos int := 0; v_parcelas int := 0; v_anteriores int := 0; v_ignorados int := 0;
  v_total numeric := 0; v_ext text;
  v_tx_ids uuid[] := '{}'; v_inst_ids uuid[] := '{}';
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;

  select id, external_id, parsed_json into v_log from public.message_logs
   where user_id = p_user_id and direction = 'in'
     and parsed_json ? 'itens' and jsonb_typeof(parsed_json->'itens') = 'array'
     and coalesce((parsed_json->>'importado')::boolean, false) = false
     and created_at > now() - interval '3 hours'
   order by created_at desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'mensagem', 'Não encontrei uma fatura ou extrato recente para importar. Me manda o PDF (ou a foto) de novo e confirma em seguida.');
  end if;
  v_ext := coalesce(v_log.external_id, 'imp-' || v_log.id::text);

  for v_item in select * from jsonb_array_elements(v_log.parsed_json->'itens') loop
    v_idx := v_idx + 1;
    if coalesce((v_item->>'ignorar')::boolean, false) then v_ignorados := v_ignorados + 1; continue; end if;
    v_valor := nullif(btrim(coalesce(v_item->>'valor', '')), '')::numeric;
    v_desc := left(btrim(coalesce(v_item->>'descricao', '')), 120);
    if v_valor is null or v_valor <= 0 or v_desc = '' then v_ignorados := v_ignorados + 1; continue; end if;
    v_tipo := case when v_item->>'tipo' = 'income' then 'income' else 'expense' end;
    begin v_data := (v_item->>'data')::date; exception when others then v_data := v_today; end;
    if v_data is null or v_data > v_today + 1 then v_data := v_today; end if;
    v_pa := nullif(btrim(coalesce(v_item->>'parcela_atual', '')), '')::int;
    v_pt := nullif(btrim(coalesce(v_item->>'parcela_total', '')), '')::int;
    v_cat := coalesce(public.whatsapp_apply_category_rule(p_user_id, v_desc, v_tipo),
                      public.whatsapp_category_id(p_user_id, v_item->>'categoria', v_tipo));

    if v_pt is not null and v_pt > 1 and v_tipo = 'expense' then
      if v_modo = 'avulsos' then v_ignorados := v_ignorados + 1; continue; end if;
      v_pa := least(greatest(coalesce(v_pa, 1), 1), v_pt);
      select id, start_date, total_installments into v_inst, v_start, v_total_inst from public.installments
       where user_id = p_user_id and is_active and lower(title) = lower(v_desc) and description like '%[fatura:' || v_pt || 'x]%'
       order by created_at desc limit 1;
      if v_inst is not null then
        v_first := v_pt - v_total_inst + 1; v_num := v_pa - v_first + 1;
      else
        select id, start_date, total_installments into v_inst, v_start, v_total_inst from public.installments
         where user_id = p_user_id and is_active and lower(title) = lower(v_desc) and total_installments = v_pt
         order by created_at desc limit 1;
        if v_inst is not null then v_num := v_pa;
        else
          v_total_inst := v_pt - v_pa + 1; v_start := v_data;
          insert into public.installments (user_id, category_id, title, description, total_amount, installment_amount, total_installments, start_date, is_active)
          values (p_user_id, v_cat, v_desc,
                  'Importado da fatura em ' || to_char(v_data, 'DD/MM/YYYY') || ' (parcela ' || v_pa || ' de ' || v_pt ||
                  case when v_pa > 1 then '; ' || (v_pa - 1) || ' anteriores não lançadas' else '' end || ') [fatura:' || v_pt || 'x]',
                  round(v_valor * v_total_inst, 2), round(v_valor, 2), v_total_inst, v_start, true)
          returning id into v_inst;
          v_inst_ids := v_inst_ids || v_inst;
          v_parcelamentos := v_parcelamentos + 1; v_anteriores := v_anteriores + (v_pa - 1); v_num := 1;
        end if;
      end if;
      if v_num < 1 or v_num > v_total_inst then v_ignorados := v_ignorados + 1; continue; end if;
      if not exists (select 1 from public.transactions where installment_id = v_inst and installment_number = v_num) then
        insert into public.transactions
          (user_id, type, amount, description, transaction_date, competence_month, category_id,
           source, status, origin_type, installment_id, installment_number, installment_total, notes)
        values (p_user_id, 'expense', round(v_valor, 2), v_desc, v_data, date_trunc('month', v_data)::date, v_cat,
                'whatsapp', 'active', 'installment', v_inst, v_num, v_total_inst,
                'importado da fatura (parcela ' || v_pa || ' de ' || v_pt || ')')
        returning id into v_id;
        v_tx_ids := v_tx_ids || v_id; v_parcelas := v_parcelas + 1; v_total := v_total + round(v_valor, 2);
      else v_ignorados := v_ignorados + 1; end if;
    else
      if v_modo = 'parcelados' then v_ignorados := v_ignorados + 1; continue; end if;
      insert into public.transactions
        (user_id, type, amount, description, transaction_date, competence_month, category_id,
         source, external_message_id, status, origin_type, notes)
      values (p_user_id, v_tipo, round(v_valor, 2), v_desc, v_data, date_trunc('month', v_data)::date, v_cat,
              'whatsapp', left(v_ext || '#imp' || v_idx, 120), 'active', 'manual', 'importado de PDF')
      on conflict (user_id, external_message_id) do nothing
      returning id into v_id;
      if v_id is null then v_ignorados := v_ignorados + 1;
      else v_tx_ids := v_tx_ids || v_id; v_avulsos := v_avulsos + 1; v_total := v_total + round(v_valor, 2); end if;
    end if;
  end loop;

  update public.message_logs
     set parsed_json = parsed_json || jsonb_build_object('importado', true, 'importado_em', now(), 'modo', v_modo,
                                                         'import_ids', jsonb_build_object('tx', to_jsonb(v_tx_ids), 'inst', to_jsonb(v_inst_ids)))
   where id = v_log.id;

  return jsonb_build_object(
    'ok', true, 'avulsos', v_avulsos, 'parcelamentos', v_parcelamentos, 'parcelas', v_parcelas,
    'parcelas_anteriores_nao_lancadas', v_anteriores, 'ignorados', v_ignorados, 'total', v_total,
    'mensagem', '📥 *Importação concluída*' || E'\n' ||
                '• ' || v_avulsos || ' lançamento(s) avulso(s)' || E'\n' ||
                '• ' || v_parcelas || ' parcela(s) desta fatura' ||
                case when v_parcelamentos > 0 then ' (' || v_parcelamentos || ' parcelamento(s) novo(s) vinculado(s); as próximas parcelas entram no vencimento)' else '' end ||
                case when v_anteriores > 0 then E'\n' || '• ' || v_anteriores || ' parcela(s) anterior(es) ficaram fora do histórico, como combinado' else '' end ||
                case when v_ignorados > 0 then E'\n' || '• ' || v_ignorados || ' item(ns) ignorado(s) (já existiam, pagamentos ou fora do modo)' else '' end ||
                E'\n' || '💸 Total desta fatura importado: R$ ' || public.money_br(v_total) || E'\n' ||
                'Já está no seu painel. Se errou algo, diga *desfazer importação*.');
end;
$$;

create or replace function public.whatsapp_undo_import(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_log record; v_tx uuid[]; v_inst uuid[]; n1 int := 0; n2 int := 0;
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;
  select id, parsed_json into v_log from public.message_logs
   where user_id = p_user_id and direction = 'in' and coalesce((parsed_json->>'importado')::boolean, false)
     and parsed_json ? 'import_ids' and coalesce((parsed_json->>'desfeito')::boolean, false) = false
     and created_at > now() - interval '7 days'
   order by (parsed_json->>'importado_em') desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'mensagem', 'Não encontrei uma importação recente (últimos 7 dias) para desfazer.');
  end if;
  select coalesce(array_agg(x::uuid), '{}') into v_tx from jsonb_array_elements_text(v_log.parsed_json->'import_ids'->'tx') x;
  select coalesce(array_agg(x::uuid), '{}') into v_inst from jsonb_array_elements_text(v_log.parsed_json->'import_ids'->'inst') x;

  update public.transactions
     set status = 'deleted', deleted_at = now(), updated_at = now(),
         external_message_id = case when external_message_id is not null then left(external_message_id || ':undo' || extract(epoch from now())::bigint, 120) end
   where user_id = p_user_id and id = any(v_tx) and status = 'active';
  get diagnostics n1 = row_count;
  update public.installments set is_active = false, updated_at = now() where user_id = p_user_id and id = any(v_inst) and is_active;
  get diagnostics n2 = row_count;
  update public.message_logs set parsed_json = parsed_json || jsonb_build_object('desfeito', true, 'importado', false) where id = v_log.id;

  return jsonb_build_object('ok', true, 'lancamentos', n1, 'parcelamentos', n2,
    'mensagem', '↩️ *Importação desfeita*' || E'\n' || '• ' || n1 || ' lançamento(s) removido(s)' || E'\n' ||
                '• ' || n2 || ' parcelamento(s) desativado(s)' || E'\n' ||
                'Se quiser importar de novo, é só dizer "importa tudo" (a leitura do PDF continua guardada por 3 horas).');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4/6. Silenciar alertas
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_mute_alerts(
  p_user_id uuid, p_acao text, p_dias int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_until timestamptz; v_dias int := least(greatest(coalesce(p_dias, 1), 1), 90);
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;
  insert into public.user_settings (user_id) values (p_user_id) on conflict (user_id) do nothing;
  if p_acao = 'pausar' then
    update public.user_settings set whatsapp_notifications = false, updated_at = now() where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'mensagem', '🔕 Alertas pausados. Quando quiser, diga "reativar alertas".');
  elsif p_acao = 'reativar' then
    update public.user_settings set whatsapp_notifications = true, whatsapp_muted_until = null, updated_at = now() where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'mensagem', '🔔 Alertas reativados.');
  else
    v_until := ((public.whatsapp_today() + v_dias)::timestamp at time zone 'America/Sao_Paulo');
    update public.user_settings set whatsapp_muted_until = v_until, updated_at = now() where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'ate', v_until, 'mensagem',
      '🔕 Sem alertas até ' || to_char(v_until at time zone 'America/Sao_Paulo', 'DD/MM') || '. Depois disso voltam sozinhos.');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Alertas diários (+ lembrete de fatura, + mudo) e 5. resumo semanal
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_daily_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_month date := date_trunc('month', v_today)::date;
  v_out jsonb := '[]'::jsonb;
  r record; v_lista text; v_key text; v_limit numeric; v_spent numeric; v_pct numeric; f record;
begin
  for r in
    select distinct on (l.user_id) l.user_id, l.wa_id
      from public.whatsapp_links l
      join public.profiles p on p.id = l.user_id
      left join public.user_settings s on s.user_id = l.user_id
     where coalesce(s.whatsapp_notifications, true)
       and (s.whatsapp_muted_until is null or s.whatsapp_muted_until <= now())
     order by l.user_id, l.created_at desc
  loop
    -- (a) fixos vencendo hoje
    v_key := 'alert:due:' || to_char(v_today, 'YYYY-MM-DD');
    select string_agg('• ' || fx.title || ' — R$ ' || public.money_br(fx.amount), E'\n' order by fx.amount desc) into v_lista
      from public.fixed_expenses fx
     where fx.user_id = r.user_id and fx.is_active and public.whatsapp_due_date(v_today, fx.due_day) = v_today
       and coalesce(fx.start_date, fx.created_at::date) <= v_today and (fx.end_date is null or fx.end_date >= v_today);
    if v_lista is not null and not exists (select 1 from public.message_logs m where m.user_id = r.user_id and m.direction = 'out' and m.external_id = v_key) then
      v_out := v_out || jsonb_build_object('user_id', r.user_id, 'wa_id', r.wa_id, 'external_id', v_key,
        'mensagem', '📅 *Vence hoje*' || E'\n' || v_lista || E'\n\n' || 'O lançamento entra automaticamente no seu painel. Se já pagou, tá tudo certo. 👍');
    end if;

    -- (b) limite
    select amount into v_limit from public.budgets where user_id = r.user_id and category_id is null and month_ref = v_month limit 1;
    if v_limit is not null and v_limit > 0 then
      select coalesce(sum(amount), 0) into v_spent from public.transactions
       where user_id = r.user_id and type = 'expense' and status = 'active'
         and transaction_date >= v_month and transaction_date < (v_month + interval '1 month')::date;
      v_pct := round(v_spent / v_limit * 100, 1);
      v_key := case when v_pct >= 100 then 'alert:limit100:' || to_char(v_month, 'YYYY-MM')
                    when v_pct >= 80 then 'alert:limit80:' || to_char(v_month, 'YYYY-MM') end;
      if v_key is not null and not exists (select 1 from public.message_logs m where m.user_id = r.user_id and m.direction = 'out' and m.external_id = v_key) then
        v_out := v_out || jsonb_build_object('user_id', r.user_id, 'wa_id', r.wa_id, 'external_id', v_key,
          'mensagem', case when v_pct >= 100 then '🚨 *Limite do mês estourado*' else '⚠️ *Atenção ao limite*' end || E'\n' ||
                      'Você já usou *' || v_pct || '%* do seu limite de R$ ' || public.money_br(v_limit) || ' em ' || to_char(v_month, 'MM/YYYY') ||
                      ' (gasto: R$ ' || public.money_br(v_spent) || ').' || E'\n' ||
                      case when v_pct >= 100 then 'Que tal revisar os gastos? Diga *relatório* que eu mostro onde foi.'
                           else 'Ainda dá para gastar R$ ' || public.money_br(v_limit - v_spent) || '. Diga *relatório* para ver onde foi.' end);
      end if;
    end if;

    -- (c) fatura importada vencendo em 2 dias (ou amanhã/hoje, se ainda não avisou)
    for f in
      select m.id, m.parsed_json->>'vencimento' as venc, (m.parsed_json->>'total_documento')::numeric as total
        from public.message_logs m
       where m.user_id = r.user_id and m.direction = 'in' and m.parsed_json ? 'vencimento'
         and m.parsed_json->>'tipo_documento' = 'fatura_cartao'
         and (m.parsed_json->>'vencimento') ~ '^\d{4}-\d{2}-\d{2}$'
         and (m.parsed_json->>'vencimento')::date between v_today and v_today + 2
         and m.created_at > now() - interval '60 days'
    loop
      v_key := 'alert:fatura:' || f.id::text;
      if not exists (select 1 from public.message_logs m where m.user_id = r.user_id and m.direction = 'out' and m.external_id = v_key) then
        v_out := v_out || jsonb_build_object('user_id', r.user_id, 'wa_id', r.wa_id, 'external_id', v_key,
          'mensagem', '💳 *Fatura do cartão* vence ' ||
                      case when f.venc::date = v_today then 'HOJE' when f.venc::date = v_today + 1 then 'amanhã' else 'em 2 dias' end ||
                      ' (' || to_char(f.venc::date, 'DD/MM') || ')' ||
                      case when f.total is not null then ': R$ ' || public.money_br(f.total) else '' end || '.' || E'\n' ||
                      'Lembra de pagar pra não cair no rotativo. 😉');
      end if;
    end loop;
  end loop;
  return jsonb_build_object('ok', true, 'total', jsonb_array_length(v_out), 'alertas', v_out);
end;
$$;

create or replace function public.whatsapp_weekly_summaries()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_start date := v_today - 6;                 -- últimos 7 dias, inclusive hoje
  v_prev_start date := v_today - 13;
  v_out jsonb := '[]'::jsonb;
  r record; v_key text; v_total numeric; v_prev numeric; v_cats text; v_n int; v_delta text;
begin
  v_key := 'alert:week:' || to_char(v_today, 'IYYY-IW');
  for r in
    select distinct on (l.user_id) l.user_id, l.wa_id, coalesce(split_part(p.full_name, ' ', 1), '') as nome
      from public.whatsapp_links l join public.profiles p on p.id = l.user_id
      left join public.user_settings s on s.user_id = l.user_id
     where coalesce(s.whatsapp_notifications, true) and (s.whatsapp_muted_until is null or s.whatsapp_muted_until <= now())
     order by l.user_id, l.created_at desc
  loop
    if exists (select 1 from public.message_logs m where m.user_id = r.user_id and m.direction = 'out' and m.external_id = v_key) then continue; end if;
    select coalesce(sum(amount), 0), count(*) into v_total, v_n from public.transactions
     where user_id = r.user_id and type = 'expense' and status = 'active' and transaction_date between v_start and v_today;
    if v_n = 0 then continue; end if;
    select coalesce(sum(amount), 0) into v_prev from public.transactions
     where user_id = r.user_id and type = 'expense' and status = 'active' and transaction_date between v_prev_start and v_start - 1;
    select string_agg('• ' || cat || ' — R$ ' || public.money_br(soma), E'\n' order by soma desc) into v_cats
      from (select coalesce(c.name, 'Sem categoria') as cat, sum(t.amount) as soma
              from public.transactions t left join public.categories c on c.id = t.category_id
             where t.user_id = r.user_id and t.type = 'expense' and t.status = 'active' and t.transaction_date between v_start and v_today
             group by 1 order by 2 desc limit 5) s;
    v_delta := case when v_prev = 0 then '' when v_total > v_prev then ' (📈 +' || round((v_total - v_prev) / v_prev * 100) || '% vs semana anterior)'
                    when v_total < v_prev then ' (📉 −' || round((v_prev - v_total) / v_prev * 100) || '% vs semana anterior)' else ' (igual à semana anterior)' end;
    v_out := v_out || jsonb_build_object('user_id', r.user_id, 'wa_id', r.wa_id, 'external_id', v_key,
      'mensagem', '📆 *Sua semana* (' || to_char(v_start, 'DD/MM') || ' a ' || to_char(v_today, 'DD/MM') || ')' ||
                  case when r.nome <> '' then ', ' || r.nome else '' end || E'\n\n' || v_cats || E'\n\n' ||
                  '💸 Total: *R$ ' || public.money_br(v_total) || '* em ' || v_n || ' lançamento(s)' || v_delta || E'\n' ||
                  'Diga *resumo* para ver o mês inteiro ou *relatório* para os detalhes.');
  end loop;
  return jsonb_build_object('ok', true, 'total', jsonb_array_length(v_out), 'alertas', v_out);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.whatsapp_apply_category_rule(uuid, text, text)',
    'public.whatsapp_set_category(uuid, text, text, boolean)',
    'public.whatsapp_create_transaction(uuid, text, numeric, text, date, text, text, text)',
    'public.whatsapp_goal_bar(numeric, numeric)',
    'public.whatsapp_create_goal(uuid, text, numeric, date, numeric)',
    'public.whatsapp_add_to_goal(uuid, text, numeric)',
    'public.whatsapp_list_goals(uuid)',
    'public.whatsapp_month_summary(uuid, date)',
    'public.whatsapp_import_statement(uuid, text)',
    'public.whatsapp_undo_import(uuid)',
    'public.whatsapp_mute_alerts(uuid, text, int)',
    'public.whatsapp_daily_alerts()',
    'public.whatsapp_weekly_summaries()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
