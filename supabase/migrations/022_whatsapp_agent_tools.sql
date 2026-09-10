-- 022_whatsapp_agent_tools.sql
-- RPCs que o AGENTE de IA do WhatsApp (workflow n8n "moedin-agente-v2") chama
-- como ferramentas. Mesmo padrão das RPCs 008/009: security definer,
-- search_path fixo, retorno jsonb {ok, mensagem, ...} com a MENSAGEM JÁ
-- FORMATADA em pt-BR (formatar em SQL economiza tokens e mantém o visual igual
-- ao relatório existente). Grant SÓ para service_role: o n8n chama com a
-- service_role; anon/authenticated não enxergam nada daqui.
--
-- Idempotente: create or replace / if not exists. Pode rodar duas vezes.
-- Não altera tabela nenhuma e não apaga dado nenhum.
--
-- Convenções replicadas do site (apps/web/src/lib/recurrence*.ts, perfil):
--  * ocorrência de gasto fixo/receita fixa = 1 por mês no due_day, nunca antes
--    de start_date, nunca no futuro; origin_type + *_id + competence_month
--    sempre preenchidos (senão o catch-up do site duplica).
--  * parcelas: parcela i em start_date + (i-1) meses (dia limitado ao fim do
--    mês); valores = splitInstallments (as últimas parcelas fecham o total).
--  * limite mensal: apaga orçamentos gerais >= mês atual e grava N meses.
--  * "hoje" é sempre em America/Sao_Paulo (o banco roda em UTC).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Categoria fechada (bate com o site e o system prompt). Nunca devolve null:
-- cai em "Outras despesas"/"Outras receitas". Reaproveita resolve_category
-- (cria a categoria do usuário quando ela não existe).
create or replace function public.whatsapp_category_id(
  p_user_id uuid,
  p_name text,
  p_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := case when p_type = 'income' then 'income' else 'expense' end;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_name = '' or lower(v_name) in ('null', 'none', 'sem categoria') then
    v_name := case when v_type = 'income' then 'Outras receitas' else 'Outras despesas' end;
  end if;
  v_id := (public.resolve_category(p_user_id, v_name, v_type) ->> 'category_id')::uuid;
  return v_id;
end;
$$;

-- Dia de vencimento limitado ao último dia do mês (igual ao clampDay do site).
create or replace function public.whatsapp_due_date(p_month_anchor date, p_due_day int)
returns date
language sql
immutable
set search_path = public
as $$
  select (date_trunc('month', p_month_anchor)::date
          + (least(greatest(p_due_day, 1),
                   extract(day from (date_trunc('month', p_month_anchor) + interval '1 month - 1 day'))::int) - 1));
$$;

-- ---------------------------------------------------------------------------
-- 1. Lançamento avulso (idempotente por external_message_id)
-- ---------------------------------------------------------------------------
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
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Valor inválido: informe um valor maior que zero.');
  end if;

  v_cat_id := public.whatsapp_category_id(p_user_id, p_category, v_type);
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
      return jsonb_build_object(
        'ok', true, 'duplicado', true, 'id', v_id,
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
    'ok', true, 'duplicado', false, 'id', v_id,
    'tipo', v_type, 'valor', round(p_amount, 2), 'categoria', v_cat_name,
    'descricao', v_desc, 'data', to_char(v_date, 'DD/MM/YYYY'),
    'mensagem', case when v_type = 'income' then '✅ Receita' else '❌ Gasto' end ||
                ' de *R$ ' || public.money_br(p_amount) || '* em ' || coalesce(v_cat_name, 'Outras') ||
                ' registrad' || case when v_type = 'income' then 'a' else 'o' end ||
                case when v_date <> public.whatsapp_today()
                                      then ' (' || to_char(v_date, 'DD/MM') || ')' else '' end || '.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Buscar lançamentos (para confirmar antes de excluir)
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_find_transactions(
  p_user_id uuid,
  p_termo text default null,
  p_limit int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_termo text := lower(btrim(coalesce(p_termo, '')));
  v_rows jsonb;
  v_count int;
  v_msg text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  with base as (
    select t.id, t.transaction_date, t.description, t.amount, t.type, c.name as categoria, t.created_at
      from public.transactions t
      left join public.categories c on c.id = t.category_id
     where t.user_id = p_user_id and t.status = 'active'
       and (v_termo = ''
            or lower(coalesce(t.description, '')) like '%' || v_termo || '%'
            or lower(coalesce(c.name, '')) like '%' || v_termo || '%')
     order by t.created_at desc
     limit greatest(coalesce(p_limit, 5), 1)
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
           'id_prefixo', left(id::text, 8),
           'data', to_char(transaction_date, 'DD/MM'),
           'descricao', description,
           'valor', amount,
           'tipo', type,
           'categoria', categoria)), '[]'::jsonb)
    into v_count, v_rows
    from base;

  if v_count = 0 then
    return jsonb_build_object('ok', true, 'total', 0, 'itens', v_rows,
      'mensagem', '🤔 Não encontrei lançamento com "' || coalesce(p_termo, '') || '".');
  end if;

  select string_agg(
           n::text || '. (' || (i ->> 'data') || ') ' || (i ->> 'descricao') ||
           ' — R$ ' || public.money_br((i ->> 'valor')::numeric) ||
           ' [' || (i ->> 'id_prefixo') || ']', E'\n' order by n)
    into v_msg
    from jsonb_array_elements(v_rows) with ordinality as e(i, n);

  return jsonb_build_object('ok', true, 'total', v_count, 'itens', v_rows, 'mensagem', v_msg);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Gasto fixo
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_create_fixed_expense(
  p_user_id uuid,
  p_title text,
  p_amount numeric,
  p_due_day int,
  p_category text default null,
  p_create_now boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_title text := left(btrim(coalesce(p_title, '')), 120);
  v_due int := least(greatest(coalesce(p_due_day, 1), 1), 31);
  v_cat_id uuid;
  v_cat_name text;
  v_fx_id uuid;
  v_occ date;
  v_created boolean := false;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Valor inválido: informe um valor maior que zero.');
  end if;
  if v_title = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Diga o nome do gasto fixo (ex.: aluguel, internet).');
  end if;

  v_cat_id := public.whatsapp_category_id(p_user_id, p_category, 'expense');
  select name into v_cat_name from public.categories where id = v_cat_id;

  -- Já existe um gasto fixo ativo com o mesmo nome? Atualiza em vez de duplicar.
  select id into v_fx_id from public.fixed_expenses
   where user_id = p_user_id and is_active and lower(title) = lower(v_title)
   order by created_at desc limit 1;

  if v_fx_id is not null then
    update public.fixed_expenses
       set amount = round(p_amount, 2), due_day = v_due, category_id = v_cat_id, updated_at = now()
     where id = v_fx_id;
  else
    insert into public.fixed_expenses
      (user_id, category_id, title, amount, due_day, is_active, start_date)
    values
      (p_user_id, v_cat_id, v_title, round(p_amount, 2), v_due, true,
       case when p_create_now then date_trunc('month', v_today)::date else v_today end)
    returning id into v_fx_id;
  end if;

  -- Ocorrência deste mês (só quando o usuário diz que já pagou / quer contar agora).
  if p_create_now then
    v_occ := least(public.whatsapp_due_date(v_today, v_due), v_today);
    insert into public.transactions
      (user_id, type, amount, description, transaction_date, competence_month, category_id,
       source, status, origin_type, fixed_expense_id)
    select p_user_id, 'expense', round(p_amount, 2), v_title, v_occ,
           date_trunc('month', v_occ)::date, v_cat_id, 'whatsapp', 'active', 'fixed_expense', v_fx_id
    where not exists (
      select 1 from public.transactions
       where fixed_expense_id = v_fx_id and origin_type = 'fixed_expense'
         and competence_month = date_trunc('month', v_occ)::date);
    v_created := found;
  end if;

  return jsonb_build_object(
    'ok', true, 'id', v_fx_id, 'ocorrencia_criada', v_created,
    'mensagem', '📌 *Gasto fixo salvo*' || E'\n' ||
                v_title || ' — R$ ' || public.money_br(p_amount) || ' todo dia ' || v_due ||
                ' (' || coalesce(v_cat_name, 'Outras despesas') || ')' ||
                case when v_created then E'\n' || '✅ A parcela deste mês já foi lançada.'
                     else E'\n' || '📅 O lançamento do mês aparece automaticamente no vencimento.' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Receita fixa (upsert por kind: 1 salário, 1 VA, 1 VR por usuário)
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_create_fixed_income(
  p_user_id uuid,
  p_title text,
  p_amount numeric,
  p_due_day int,
  p_kind text default 'custom'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_kind text := case when p_kind in ('salary','food_allowance','meal_allowance','extra_income','custom')
                      then p_kind else 'custom' end;
  v_title text := left(btrim(coalesce(p_title, '')), 120);
  v_due int := least(greatest(coalesce(p_due_day, 1), 1), 31);
  v_id uuid;
  v_updated boolean := false;
  v_label text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Valor inválido: informe um valor maior que zero.');
  end if;
  if v_title = '' then
    v_title := case v_kind when 'salary' then 'Salário'
                           when 'food_allowance' then 'Vale-alimentação'
                           when 'meal_allowance' then 'Vale-refeição'
                           when 'extra_income' then 'Renda extra'
                           else 'Receita fixa' end;
  end if;

  if v_kind <> 'custom' then
    insert into public.fixed_incomes (user_id, title, amount, due_day, kind, is_active, start_date)
    values (p_user_id, v_title, round(p_amount, 2), v_due, v_kind, true, v_today)
    on conflict (user_id, kind) where (kind <> 'custom')
    do update set title = excluded.title, amount = excluded.amount, due_day = excluded.due_day,
                  is_active = true, updated_at = now()
    returning id, (xmax <> 0) into v_id, v_updated;
  else
    select id into v_id from public.fixed_incomes
     where user_id = p_user_id and kind = 'custom' and is_active and lower(title) = lower(v_title)
     order by created_at desc limit 1;
    if v_id is not null then
      update public.fixed_incomes
         set amount = round(p_amount, 2), due_day = v_due, updated_at = now()
       where id = v_id;
      v_updated := true;
    else
      insert into public.fixed_incomes (user_id, title, amount, due_day, kind, is_active, start_date)
      values (p_user_id, v_title, round(p_amount, 2), v_due, 'custom', true, v_today)
      returning id into v_id;
    end if;
  end if;

  v_label := case v_kind when 'salary' then 'Salário' when 'food_allowance' then 'Vale-alimentação'
                         when 'meal_allowance' then 'Vale-refeição' when 'extra_income' then 'Renda extra'
                         else v_title end;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'atualizado', v_updated, 'kind', v_kind,
    'mensagem', '💵 *Receita fixa ' || case when v_updated then 'atualizada' else 'salva' end || '*' || E'\n' ||
                v_label || ' — R$ ' || public.money_br(p_amount) || ' todo dia ' || v_due || '.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Parcelamento
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_create_installment(
  p_user_id uuid,
  p_title text,
  p_total numeric default null,
  p_installment_amount numeric default null,
  p_count int default null,
  p_start_date date default null,
  p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_title text := left(btrim(coalesce(p_title, '')), 120);
  v_count int := coalesce(p_count, 0);
  v_total numeric;
  v_start date := coalesce(p_start_date, v_today);
  v_cat_id uuid;
  v_cat_name text;
  v_inst_id uuid;
  v_cents bigint;
  v_base bigint;
  v_rem bigint;
  v_i int;
  v_date date;
  v_amount numeric;
  v_generated int := 0;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_count < 2 then
    return jsonb_build_object('ok', false, 'mensagem', 'Informe o número de parcelas (2 ou mais).');
  end if;
  if v_title = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Diga o que foi comprado (ex.: celular, fone).');
  end if;
  v_total := coalesce(p_total, p_installment_amount * v_count);
  if v_total is null or v_total <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Informe o valor total ou o valor de cada parcela.');
  end if;

  v_cat_id := public.whatsapp_category_id(p_user_id, p_category, 'expense');
  select name into v_cat_name from public.categories where id = v_cat_id;

  v_cents := round(v_total * 100)::bigint;
  v_base := v_cents / v_count;               -- floor
  v_rem := v_cents - v_base * v_count;       -- 0 <= rem < count

  insert into public.installments
    (user_id, category_id, title, total_amount, installment_amount, total_installments, start_date, is_active)
  values
    (p_user_id, v_cat_id, v_title, round(v_total, 2), (v_base::numeric / 100), v_count, v_start, true)
  returning id into v_inst_id;

  -- Parcelas já vencidas até hoje (a mesma regra do catch-up do site).
  for v_i in 1..v_count loop
    v_date := (v_start + make_interval(months => v_i - 1))::date;
    -- addMonthsClamped: se o dia estourou o mês, cai no último dia
    if extract(day from v_date) <> extract(day from v_start)
       and extract(day from v_start) > extract(day from v_date) then
      v_date := (date_trunc('month', v_date) + interval '1 month - 1 day')::date;
    end if;
    exit when v_date > v_today;
    v_amount := (v_base + case when v_i > v_count - v_rem then 1 else 0 end)::numeric / 100;
    insert into public.transactions
      (user_id, type, amount, description, transaction_date, competence_month, category_id,
       source, status, origin_type, installment_id, installment_number, installment_total)
    values
      (p_user_id, 'expense', v_amount, v_title, v_date, date_trunc('month', v_date)::date, v_cat_id,
       'whatsapp', 'active', 'installment', v_inst_id, v_i, v_count);
    v_generated := v_generated + 1;
  end loop;

  return jsonb_build_object(
    'ok', true, 'id', v_inst_id, 'parcelas_lancadas', v_generated,
    'mensagem', '🧾 *Parcelamento salvo*' || E'\n' ||
                v_title || ' — ' || v_count || 'x de R$ ' || public.money_br(v_base::numeric / 100) ||
                ' (total R$ ' || public.money_br(v_total) || ', ' || coalesce(v_cat_name, 'Outras despesas') || ')' ||
                E'\n' || '📅 1ª parcela em ' || to_char(v_start, 'DD/MM/YYYY') ||
                case when v_generated > 0 then ' — ' || v_generated || ' parcela(s) já lançada(s).' else '.' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Listar recorrências
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_list_recurrences(
  p_user_id uuid,
  p_kind text default 'both'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when p_kind in ('expense','income','both') then p_kind else 'both' end;
  v_exp text; v_exp_total numeric := 0;
  v_inc text; v_inc_total numeric := 0;
  v_par text; v_par_total numeric := 0;
  v_msg text := '';
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  if v_kind in ('expense','both') then
    select string_agg('• ' || f.title || ' — R$ ' || public.money_br(f.amount) || ' (dia ' || f.due_day ||
                      coalesce(', ' || c.name, '') || ')', E'\n' order by f.due_day, f.title),
           coalesce(sum(f.amount), 0)
      into v_exp, v_exp_total
      from public.fixed_expenses f left join public.categories c on c.id = f.category_id
     where f.user_id = p_user_id and f.is_active;

    select string_agg('• ' || i.title || ' — ' || i.total_installments || 'x de R$ ' ||
                      public.money_br(i.installment_amount) ||
                      ' (' || coalesce((select count(*) from public.transactions t
                                         where t.installment_id = i.id and t.status = 'active'), 0) ||
                      '/' || i.total_installments || ' pagas)', E'\n' order by i.start_date desc),
           coalesce(sum(i.installment_amount), 0)
      into v_par, v_par_total
      from public.installments i
     where i.user_id = p_user_id and i.is_active
       and (select count(*) from public.transactions t
             where t.installment_id = i.id and t.status = 'active') < i.total_installments;
  end if;

  if v_kind in ('income','both') then
    select string_agg('• ' || case f.kind when 'salary' then 'Salário' when 'food_allowance' then 'Vale-alimentação'
                                          when 'meal_allowance' then 'Vale-refeição' when 'extra_income' then 'Renda extra'
                                          else f.title end ||
                      ' — R$ ' || public.money_br(f.amount) || ' (dia ' || f.due_day || ')',
                      E'\n' order by f.due_day, f.title),
           coalesce(sum(f.amount), 0)
      into v_inc, v_inc_total
      from public.fixed_incomes f
     where f.user_id = p_user_id and f.is_active and f.amount > 0;
  end if;

  if v_kind in ('expense','both') then
    v_msg := v_msg || '📌 *Gastos fixos*' || E'\n' ||
             coalesce(v_exp, 'Nenhum gasto fixo cadastrado.') ||
             case when v_exp is not null then E'\n' || '💸 Total: R$ ' || public.money_br(v_exp_total) || '/mês' else '' end;
    if v_par is not null then
      v_msg := v_msg || E'\n\n' || '🧾 *Parcelamentos em andamento*' || E'\n' || v_par ||
               E'\n' || '💸 Parcelas do mês: R$ ' || public.money_br(v_par_total);
    end if;
  end if;
  if v_kind in ('income','both') then
    v_msg := v_msg || case when v_msg <> '' then E'\n\n' else '' end ||
             '💵 *Receitas fixas*' || E'\n' ||
             coalesce(v_inc, 'Nenhuma receita fixa cadastrada.') ||
             case when v_inc is not null then E'\n' || '💰 Total: R$ ' || public.money_br(v_inc_total) || '/mês' else '' end;
  end if;

  return jsonb_build_object('ok', true, 'mensagem', v_msg,
                            'total_gastos_fixos', v_exp_total, 'total_receitas_fixas', v_inc_total,
                            'total_parcelas_mes', v_par_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Remover recorrência (soft: is_active = false)
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_delete_recurrence(
  p_user_id uuid,
  p_kind text,
  p_alvo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when p_kind in ('expense','income','installment') then p_kind else 'expense' end;
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_ids uuid[];
  v_titles text[];
  v_id uuid;
  v_title text;
  v_amount numeric;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_alvo = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Diga qual recorrência quer remover (ex.: "remove o gasto fixo internet").');
  end if;

  if v_kind = 'expense' then
    select array_agg(id), array_agg(title) into v_ids, v_titles
      from public.fixed_expenses
     where user_id = p_user_id and is_active and lower(title) like '%' || v_alvo || '%';
  elsif v_kind = 'income' then
    select array_agg(id), array_agg(title) into v_ids, v_titles
      from public.fixed_incomes
     where user_id = p_user_id and is_active
       and (lower(title) like '%' || v_alvo || '%'
            or (v_alvo ~ 'sal[aá]rio' and kind = 'salary')
            or (v_alvo ~ 'alimenta' and kind = 'food_allowance')
            or (v_alvo ~ 'refei' and kind = 'meal_allowance'));
  else
    select array_agg(id), array_agg(title) into v_ids, v_titles
      from public.installments
     where user_id = p_user_id and is_active and lower(title) like '%' || v_alvo || '%';
  end if;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return jsonb_build_object('ok', false, 'encontrados', 0,
      'mensagem', '🤔 Não encontrei recorrência ativa com "' || coalesce(p_alvo, '') || '".');
  end if;
  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('ok', false, 'ambiguo', true, 'encontrados', array_length(v_ids, 1),
      'candidatos', to_jsonb(v_titles),
      'mensagem', 'Encontrei mais de uma: ' || array_to_string(v_titles, ', ') || '. Qual delas?');
  end if;

  v_id := v_ids[1];
  if v_kind = 'expense' then
    update public.fixed_expenses set is_active = false, updated_at = now() where id = v_id
      returning title, amount into v_title, v_amount;
  elsif v_kind = 'income' then
    update public.fixed_incomes set is_active = false, updated_at = now() where id = v_id
      returning title, amount into v_title, v_amount;
  else
    update public.installments set is_active = false, updated_at = now() where id = v_id
      returning title, installment_amount into v_title, v_amount;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id,
    'mensagem', '🗑️ Removido: ' || v_title || ' (R$ ' || public.money_br(v_amount) || ').' || E'\n' ||
                'Os lançamentos já feitos continuam no histórico; não gero mais os próximos.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Limite mensal — consultar
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_monthly_limit(
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
  v_limit numeric;
  v_spent numeric;
  v_rest numeric;
  v_pct numeric;
  v_bar text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  select amount into v_limit from public.budgets
   where user_id = p_user_id and category_id is null and month_ref = v_month
   limit 1;

  select coalesce(sum(amount), 0) into v_spent from public.transactions
   where user_id = p_user_id and type = 'expense' and status = 'active'
     and transaction_date >= v_month and transaction_date < (v_month + interval '1 month')::date;

  if v_limit is null then
    return jsonb_build_object('ok', true, 'tem_limite', false, 'gasto', v_spent, 'mes', to_char(v_month, 'MM/YYYY'),
      'mensagem', '🎯 Você ainda não definiu um limite de gastos para ' || to_char(v_month, 'MM/YYYY') || '.' || E'\n' ||
                  'Já gastou *R$ ' || public.money_br(v_spent) || '* no mês. Quer definir? Me diga, por exemplo: "meu limite é 2000".');
  end if;

  v_rest := v_limit - v_spent;
  v_pct := case when v_limit > 0 then round(v_spent / v_limit * 100, 1) else 0 end;
  v_bar := repeat('▰', least(10, floor(v_pct / 10)::int)) || repeat('▱', greatest(0, 10 - least(10, floor(v_pct / 10)::int)));

  return jsonb_build_object(
    'ok', true, 'tem_limite', true, 'mes', to_char(v_month, 'MM/YYYY'),
    'limite', v_limit, 'gasto', v_spent, 'restante', v_rest, 'percentual', v_pct,
    'mensagem', '🎯 *Limite de ' || to_char(v_month, 'MM/YYYY') || '*' || E'\n' ||
                v_bar || ' ' || v_pct || '%' || E'\n\n' ||
                '🧾 Limite: R$ ' || public.money_br(v_limit) || E'\n' ||
                '💸 Gasto: R$ ' || public.money_br(v_spent) || E'\n' ||
                case when v_rest >= 0
                     then '✅ Ainda pode gastar: *R$ ' || public.money_br(v_rest) || '*'
                     else '🚨 Estourou o limite em *R$ ' || public.money_br(-v_rest) || '*' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Limite mensal — definir (convenção do site: apaga gerais >= mês atual e
--    grava o mesmo valor para N meses; default 13 = atual + 12)
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_set_monthly_limit(
  p_user_id uuid,
  p_amount numeric,
  p_months int default 13
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', public.whatsapp_today())::date;
  v_months int := least(greatest(coalesce(p_months, 13), 1), 60);
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Informe um valor de limite maior que zero.');
  end if;

  delete from public.budgets
   where user_id = p_user_id and category_id is null and month_ref >= v_start;

  insert into public.budgets (user_id, category_id, month_ref, amount)
  select p_user_id, null, (v_start + make_interval(months => g))::date, round(p_amount, 2)
    from generate_series(0, v_months - 1) g;

  return jsonb_build_object('ok', true, 'limite', round(p_amount, 2), 'meses', v_months,
    'mensagem', '🎯 Limite mensal definido: *R$ ' || public.money_br(p_amount) || '*' || E'\n' ||
                'Vale a partir de ' || to_char(v_start, 'MM/YYYY') || ' (' || v_months || ' meses). Já aparece no seu perfil no site.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Resumo do mês (entradas, saídas, saldo, fixos ainda por vir, saldo livre)
-- ---------------------------------------------------------------------------
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
  v_livre numeric;
  v_limit numeric;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  select coalesce(sum(amount) filter (where type = 'income'), 0),
         coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_in, v_out
    from public.transactions
   where user_id = p_user_id and status = 'active'
     and transaction_date >= v_month and transaction_date < v_next;
  v_saldo := v_in - v_out;

  -- Gastos fixos ativos que ainda NÃO têm ocorrência neste mês (vão cair ainda).
  select coalesce(sum(f.amount), 0) into v_fixos_pend
    from public.fixed_expenses f
   where f.user_id = p_user_id and f.is_active
     and coalesce(f.start_date, f.created_at::date) < v_next
     and (f.end_date is null or f.end_date >= v_month)
     and not exists (select 1 from public.transactions t
                      where t.fixed_expense_id = f.id and t.competence_month = v_month);

  -- Parcelas deste mês ainda não lançadas.
  select coalesce(sum(i.installment_amount), 0) into v_parc_pend
    from public.installments i
   where i.user_id = p_user_id and i.is_active
     and i.start_date < v_next
     and (i.start_date + make_interval(months => i.total_installments - 1))::date >= v_month
     and not exists (select 1 from public.transactions t
                      where t.installment_id = i.id and t.competence_month = v_month);

  -- Receitas fixas ainda não recebidas neste mês.
  select coalesce(sum(f.amount), 0) into v_receitas_pend
    from public.fixed_incomes f
   where f.user_id = p_user_id and f.is_active and f.amount > 0
     and coalesce(f.start_date, f.created_at::date) < v_next
     and (f.end_date is null or f.end_date >= v_month)
     and not exists (select 1 from public.transactions t
                      where t.fixed_income_id = f.id and t.competence_month = v_month);

  v_livre := v_saldo + v_receitas_pend - v_fixos_pend - v_parc_pend;

  select amount into v_limit from public.budgets
   where user_id = p_user_id and category_id is null and month_ref = v_month limit 1;

  return jsonb_build_object(
    'ok', true, 'mes', to_char(v_month, 'MM/YYYY'),
    'entradas', v_in, 'saidas', v_out, 'saldo', v_saldo,
    'fixos_pendentes', v_fixos_pend, 'parcelas_pendentes', v_parc_pend,
    'receitas_pendentes', v_receitas_pend, 'saldo_livre', v_livre, 'limite', v_limit,
    'mensagem', '📋 *Resumo de ' || to_char(v_month, 'MM/YYYY') || '*' || E'\n\n' ||
                '💰 Entradas: R$ ' || public.money_br(v_in) || E'\n' ||
                '💸 Saídas: R$ ' || public.money_br(v_out) || E'\n' ||
                '🧮 Saldo: *R$ ' || public.money_br(v_saldo) || '*' || E'\n\n' ||
                '📌 Fixos ainda por vencer: R$ ' || public.money_br(v_fixos_pend) ||
                case when v_parc_pend > 0 then E'\n' || '🧾 Parcelas por vencer: R$ ' || public.money_br(v_parc_pend) else '' end ||
                case when v_receitas_pend > 0 then E'\n' || '💵 A receber: R$ ' || public.money_br(v_receitas_pend) else '' end ||
                E'\n' || '🟢 Saldo livre estimado: *R$ ' || public.money_br(v_livre) || '*' ||
                case when v_limit is not null
                     then E'\n\n' || '🎯 Limite do mês: R$ ' || public.money_br(v_limit) ||
                          ' (usado ' || round(case when v_limit > 0 then v_out / v_limit * 100 else 0 end) || '%)'
                     else '' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Exclusão de lançamento (redefinida: ícone 🗑️ e o tipo certo — a versão
--     da 008 dizia "Gasto excluído" com ❌ até para receita)
-- ---------------------------------------------------------------------------
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
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active'
     order by created_at desc limit 1;
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
    return jsonb_build_object(
      'ok', false,
      'mensagem', '🤔 Não encontrei um lançamento com "' || coalesce(p_alvo, '') ||
                  '" pra excluir. Tenta com a descrição exata ou diz "exclui o último".');
  end if;

  update public.transactions
     set status = 'deleted', deleted_at = now(), updated_at = now()
   where id = v_tx.id;

  return jsonb_build_object(
    'ok', true,
    'mensagem', '🗑️ ' || case when v_tx.type = 'income' then 'Receita excluída' else 'Gasto excluído' end || '!' || E'\n' ||
                '📝 ' || coalesce(nullif(v_tx.description, ''), 'Lançamento') ||
                ' — R$ ' || public.money_br(v_tx.amount) ||
                case when v_tx.origin_type <> 'manual' then E'\n' || '(era uma ocorrência de gasto fixo/parcela; o próximo mês continua sendo gerado)' else '' end,
    'id', v_tx.id, 'tipo', v_tx.type
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões: SÓ service_role (o n8n). Nada para anon/authenticated/public.
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.whatsapp_today()',
    'public.whatsapp_category_id(uuid, text, text)',
    'public.whatsapp_due_date(date, int)',
    'public.whatsapp_create_transaction(uuid, text, numeric, text, date, text, text, text)',
    'public.whatsapp_find_transactions(uuid, text, int)',
    'public.whatsapp_create_fixed_expense(uuid, text, numeric, int, text, boolean)',
    'public.whatsapp_create_fixed_income(uuid, text, numeric, int, text)',
    'public.whatsapp_create_installment(uuid, text, numeric, numeric, int, date, text)',
    'public.whatsapp_list_recurrences(uuid, text)',
    'public.whatsapp_delete_recurrence(uuid, text, text)',
    'public.whatsapp_monthly_limit(uuid, date)',
    'public.whatsapp_set_monthly_limit(uuid, numeric, int)',
    'public.whatsapp_month_summary(uuid, date)',
    'public.whatsapp_delete_transaction(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
