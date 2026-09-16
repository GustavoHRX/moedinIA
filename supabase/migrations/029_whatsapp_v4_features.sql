-- 029_whatsapp_v4_features.sql — agente WhatsApp v2.6 (15/09/2026)
--  1. Moeda estrangeira: tabela fx_rates (cotação diária, 1 unidade = X BRL),
--     whatsapp_fx_upsert (alimentada pelo workflow de alertas), whatsapp_fx_quote
--     e whatsapp_create_transaction com p_currency (converte e anota o original).
--  2. Limite por categoria (a tela /limite do site grava budgets.category_id):
--     whatsapp_set_monthly_limit ganha p_category (0 = remover), whatsapp_monthly_limit
--     mostra a seção por categoria, create_transaction devolve 'alerta' quando o
--     lançamento CRUZA 80%/100% de um limite, e whatsapp_daily_alerts cobre categorias.
--  3. Comparar meses: whatsapp_compare_months (mesmo período quando o mês é o atual).
--  4. Editar gasto/receita fixa: whatsapp_update_recurrence (valor, dia, nome, categoria).
--  5. Pausar sem excluir: whatsapp_toggle_recurrence. Pausado = is_active=false sem
--     end_date (é o mesmo "Inativo" da tela /fixos, que tem o botão Ativar). Reativar
--     move start_date para o mês atual para o catch-up do site NÃO preencher os meses
--     pausados. Excluir pelo bot agora apaga de vez quando não há histórico e, quando
--     há, inativa COM end_date = hoje (é assim que se distingue de pausado).
--  6. Consulta livre: whatsapp_query_transactions (categoria/termo/período/tipo).
--  7. Dados do relatório em PDF: whatsapp_report_pdf_data (o PDF é montado no n8n).
-- Idempotente. Duas funções mudam de assinatura (create_transaction e
-- set_monthly_limit) e por isso são DROPADAS antes — senão o PostgREST veria duas
-- sobrecargas e não saberia qual chamar. Grant só service_role.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_month_name(p_date date)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['janeiro','fevereiro','março','abril','maio','junho','julho',
                'agosto','setembro','outubro','novembro','dezembro'])[extract(month from p_date)::int];
$$;

-- Normaliza como o usuário fala a moeda ("dólar", "US$", "euros") num código ISO.
create or replace function public.whatsapp_currency_code(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when v ~ '^(usd|us\$|\$|d[oó]lar(es)?|dollars?|dolares?)$' then 'USD'
    when v ~ '^(eur|€|euros?)$' then 'EUR'
    when v ~ '^(gbp|£|libras?( esterlinas?)?|pounds?)$' then 'GBP'
    when v ~ '^(ars|pesos? argentinos?)$' then 'ARS'
    when v ~ '^(jpy|¥|ienes?|yens?)$' then 'JPY'
    when v ~ '^(cad|d[oó]lar(es)? canadenses?)$' then 'CAD'
    when v ~ '^(aud|d[oó]lar(es)? australianos?)$' then 'AUD'
    when v ~ '^(chf|francos? su[ií]ços?)$' then 'CHF'
    when v ~ '^(cny|yuan|yuans|rmb)$' then 'CNY'
    when v ~ '^(mxn|pesos? mexicanos?)$' then 'MXN'
    when v ~ '^(clp|pesos? chilenos?)$' then 'CLP'
    when v ~ '^(uyu|pesos? uruguaios?)$' then 'UYU'
    when v ~ '^(pyg|guaran[ií]s?)$' then 'PYG'
    when v ~ '^(cop|pesos? colombianos?)$' then 'COP'
    when v ~ '^(pen|so(l|les)( peruanos?)?)$' then 'PEN'
    when v ~ '^(brl|r\$|reais?|real)$' then 'BRL'
    when v ~ '^[a-z]{3}$' then upper(v)
    else null end
  from (select lower(btrim(coalesce(p_raw, ''))) as v) s;
$$;

create or replace function public.whatsapp_currency_symbol(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_code when 'USD' then 'US$ ' when 'EUR' then '€ ' when 'GBP' then '£ '
                     when 'JPY' then '¥ ' when 'BRL' then 'R$ ' else coalesce(p_code, '') || ' ' end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Câmbio
-- ---------------------------------------------------------------------------
create table if not exists public.fx_rates (
  code text primary key,
  rate_brl numeric(18, 8) not null,      -- 1 unidade da moeda = rate_brl reais
  updated_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;   -- sem policy: só a service_role lê/escreve
revoke all on public.fx_rates from anon, authenticated;

-- Recebe o objeto "rates" da API (base BRL: 1 BRL = r unidades da moeda) e grava 1/r.
create or replace function public.whatsapp_fx_upsert(p_rates jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
begin
  if p_rates is null or jsonb_typeof(p_rates) <> 'object' then
    return jsonb_build_object('ok', false, 'mensagem', 'rates inválido');
  end if;
  insert into public.fx_rates (code, rate_brl, updated_at)
  select upper(key), round(1 / value::numeric, 8), now()
    from jsonb_each_text(p_rates)
   where value ~ '^[0-9.]+$' and value::numeric > 0
  on conflict (code) do update set rate_brl = excluded.rate_brl, updated_at = excluded.updated_at;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'moedas', v_n);
end;
$$;

-- Converte um valor para reais com a última cotação guardada.
create or replace function public.whatsapp_fx_quote(p_amount numeric, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.whatsapp_currency_code(p_currency);
  v_rate numeric; v_at timestamptz; v_brl numeric;
begin
  if v_code is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Não reconheci a moeda "' || coalesce(p_currency, '') || '". Diga o código (USD, EUR, GBP...) ou o nome (dólar, euro).');
  end if;
  if v_code = 'BRL' then
    return jsonb_build_object('ok', true, 'moeda', 'BRL', 'valor_brl', round(coalesce(p_amount, 0), 2), 'cotacao', 1,
      'mensagem', 'Já está em reais: R$ ' || public.money_br(coalesce(p_amount, 0)) || '.');
  end if;
  select rate_brl, updated_at into v_rate, v_at from public.fx_rates where code = v_code;
  if v_rate is null then
    return jsonb_build_object('ok', false, 'moeda', v_code,
      'mensagem', 'Ainda não tenho a cotação de ' || v_code || '. Tenta de novo mais tarde ou me diz o valor em reais.');
  end if;
  v_brl := round(coalesce(p_amount, 0) * v_rate, 2);
  return jsonb_build_object('ok', true, 'moeda', v_code, 'valor_original', round(coalesce(p_amount, 0), 2),
    'valor_brl', v_brl, 'cotacao', round(v_rate, 4), 'data_cotacao', to_char(v_at at time zone 'America/Sao_Paulo', 'DD/MM'),
    'mensagem', '💱 ' || public.whatsapp_currency_symbol(v_code) || public.money_br(coalesce(p_amount, 0)) ||
                ' = *R$ ' || public.money_br(v_brl) || '* (cotação ' || replace(round(v_rate, 4)::text, '.', ',') ||
                ' de ' || to_char(v_at at time zone 'America/Sao_Paulo', 'DD/MM') || ')');
end;
$$;

-- ---------------------------------------------------------------------------
-- 1+2. Lançamento avulso: moeda estrangeira + alerta de limite (geral e por categoria)
-- ---------------------------------------------------------------------------
drop function if exists public.whatsapp_create_transaction(uuid, text, numeric, text, date, text, text, text);

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
  v_lim numeric; v_before numeric; v_after numeric; v_alerta text := '';
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Valor inválido: informe um valor maior que zero.');
  end if;

  -- moeda estrangeira → converte pela última cotação e guarda o original na descrição
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

  -- alerta só quando ESTE lançamento cruza 80% ou 100% de um limite do mês
  if v_type = 'expense' then
    select amount into v_lim from public.budgets
     where user_id = p_user_id and category_id = v_cat_id and month_ref = v_month;
    if v_lim is not null and v_lim > 0 then
      select coalesce(sum(amount), 0) into v_after from public.transactions
       where user_id = p_user_id and type = 'expense' and status = 'active' and category_id = v_cat_id
         and transaction_date >= v_month and transaction_date < (v_month + interval '1 month')::date;
      v_before := v_after - round(v_amount, 2);
      if v_after >= v_lim and v_before < v_lim then
        v_alerta := '🚨 ' || v_cat_name || ' estourou o limite do mês: R$ ' || public.money_br(v_after) || ' de R$ ' || public.money_br(v_lim) || '.';
      elsif v_after >= v_lim * 0.8 and v_before < v_lim * 0.8 then
        v_alerta := '⚠️ ' || v_cat_name || ' já está em ' || round(v_after / v_lim * 100) || '% do limite (R$ ' ||
                    public.money_br(v_after) || ' de R$ ' || public.money_br(v_lim) || ').';
      end if;
    end if;
    select amount into v_lim from public.budgets
     where user_id = p_user_id and category_id is null and month_ref = v_month;
    if v_lim is not null and v_lim > 0 then
      select coalesce(sum(amount), 0) into v_after from public.transactions
       where user_id = p_user_id and type = 'expense' and status = 'active'
         and transaction_date >= v_month and transaction_date < (v_month + interval '1 month')::date;
      v_before := v_after - round(v_amount, 2);
      if v_after >= v_lim and v_before < v_lim then
        v_alerta := v_alerta || case when v_alerta <> '' then E'\n' else '' end ||
                    '🚨 Limite geral do mês estourado: R$ ' || public.money_br(v_after) || ' de R$ ' || public.money_br(v_lim) || '.';
      elsif v_after >= v_lim * 0.8 and v_before < v_lim * 0.8 then
        v_alerta := v_alerta || case when v_alerta <> '' then E'\n' else '' end ||
                    '⚠️ Você já usou ' || round(v_after / v_lim * 100) || '% do limite geral do mês.';
      end if;
    end if;
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

-- ---------------------------------------------------------------------------
-- 2. Limite geral e por categoria
-- ---------------------------------------------------------------------------
drop function if exists public.whatsapp_set_monthly_limit(uuid, numeric, int);

create or replace function public.whatsapp_set_monthly_limit(
  p_user_id uuid,
  p_amount numeric,
  p_months int default 13,
  p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', public.whatsapp_today())::date;
  v_months int := least(greatest(coalesce(p_months, 13), 1), 60);
  v_cat text := nullif(btrim(coalesce(p_category, '')), '');
  v_cat_id uuid; v_cat_name text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null or p_amount < 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'Informe um valor de limite (ou 0 para remover).');
  end if;
  if v_cat is not null and lower(v_cat) not in ('geral', 'total', 'mês', 'mes') then
    v_cat_id := public.whatsapp_category_id(p_user_id, v_cat, 'expense');
    select name into v_cat_name from public.categories where id = v_cat_id;
  end if;

  if v_cat_id is null then
    delete from public.budgets where user_id = p_user_id and category_id is null and month_ref >= v_start;
  else
    delete from public.budgets where user_id = p_user_id and category_id = v_cat_id and month_ref >= v_start;
  end if;

  if p_amount = 0 then
    return jsonb_build_object('ok', true, 'removido', true, 'categoria', v_cat_name,
      'mensagem', '🎯 Limite ' || coalesce('de *' || v_cat_name || '*', 'geral') || ' removido a partir de ' || to_char(v_start, 'MM/YYYY') || '.');
  end if;

  insert into public.budgets (user_id, category_id, month_ref, amount)
  select p_user_id, v_cat_id, (v_start + make_interval(months => g))::date, round(p_amount, 2)
    from generate_series(0, v_months - 1) g;

  return jsonb_build_object('ok', true, 'limite', round(p_amount, 2), 'meses', v_months, 'categoria', v_cat_name,
    'mensagem', '🎯 Limite ' || coalesce('de *' || v_cat_name || '*', 'mensal') || ' definido: *R$ ' || public.money_br(p_amount) || '*/mês' || E'\n' ||
                'Vale a partir de ' || to_char(v_start, 'MM/YYYY') || '. Já aparece na tela Limite do site.');
end;
$$;

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
  v_limit numeric; v_spent numeric; v_rest numeric; v_pct numeric; v_bar text;
  v_cats text; v_msg text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  select amount into v_limit from public.budgets
   where user_id = p_user_id and category_id is null and month_ref = v_month limit 1;

  select coalesce(sum(amount), 0) into v_spent from public.transactions
   where user_id = p_user_id and type = 'expense' and status = 'active'
     and transaction_date >= v_month and transaction_date < (v_month + interval '1 month')::date;

  -- seção por categoria (só as que têm limite neste mês)
  select string_agg('• ' || c.name || ' — R$ ' || public.money_br(g.gasto) || ' de R$ ' || public.money_br(b.amount) ||
                    ' (' || round(case when b.amount > 0 then g.gasto / b.amount * 100 else 0 end) || '%)' ||
                    case when g.gasto >= b.amount then ' 🚨' when g.gasto >= b.amount * 0.8 then ' ⚠️' else '' end,
                    E'\n' order by (g.gasto / nullif(b.amount, 0)) desc nulls last, c.name)
    into v_cats
    from public.budgets b
    join public.categories c on c.id = b.category_id
    cross join lateral (
      select coalesce(sum(t.amount), 0) as gasto from public.transactions t
       where t.user_id = p_user_id and t.type = 'expense' and t.status = 'active' and t.category_id = b.category_id
         and t.transaction_date >= v_month and t.transaction_date < (v_month + interval '1 month')::date) g
   where b.user_id = p_user_id and b.category_id is not null and b.month_ref = v_month and b.amount > 0;

  if v_limit is null then
    v_msg := '🎯 Você não tem limite geral para ' || to_char(v_month, 'MM/YYYY') || '. Já gastou *R$ ' ||
             public.money_br(v_spent) || '* no mês.' ||
             case when v_cats is null then E'\n' || 'Quer definir? Diga, por exemplo: "meu limite é 2000" ou "limite de 300 pro lazer".' else '' end;
  else
    v_rest := v_limit - v_spent;
    v_pct := case when v_limit > 0 then round(v_spent / v_limit * 100, 1) else 0 end;
    v_bar := repeat('▰', least(10, floor(v_pct / 10)::int)) || repeat('▱', greatest(0, 10 - least(10, floor(v_pct / 10)::int)));
    v_msg := '🎯 *Limite de ' || to_char(v_month, 'MM/YYYY') || '*' || E'\n' || v_bar || ' ' || v_pct || '%' || E'\n\n' ||
             '🧾 Limite: R$ ' || public.money_br(v_limit) || E'\n' ||
             '💸 Gasto: R$ ' || public.money_br(v_spent) || E'\n' ||
             case when v_rest >= 0 then '✅ Ainda pode gastar: *R$ ' || public.money_br(v_rest) || '*'
                  else '🚨 Estourou o limite em *R$ ' || public.money_br(-v_rest) || '*' end;
  end if;
  if v_cats is not null then
    v_msg := v_msg || E'\n\n' || '📂 *Por categoria*' || E'\n' || v_cats;
  end if;

  return jsonb_build_object('ok', true, 'tem_limite', v_limit is not null, 'mes', to_char(v_month, 'MM/YYYY'),
    'limite', v_limit, 'gasto', v_spent, 'restante', v_limit - v_spent, 'tem_categorias', v_cats is not null,
    'mensagem', v_msg);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Comparar dois meses
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_compare_months(
  p_user_id uuid,
  p_ref_a date default null,   -- mês mais recente (padrão: atual)
  p_ref_b date default null    -- mês de comparação (padrão: anterior ao A)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_a date := date_trunc('month', coalesce(p_ref_a, v_today))::date;
  v_b date := date_trunc('month', coalesce(p_ref_b, v_a - interval '1 month'))::date;
  v_dia int := null;   -- quando um dos meses é o atual, compara o mesmo período (dia 1..hoje)
  v_a_end date; v_b_end date;
  v_ga numeric; v_gb numeric; v_ra numeric; v_rb numeric;
  v_cats text; v_msg text; v_periodo text := '';
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_a = v_b then
    return jsonb_build_object('ok', false, 'mensagem', 'Me diga dois meses diferentes para comparar (ex.: "setembro x agosto").');
  end if;
  if v_a = date_trunc('month', v_today)::date or v_b = date_trunc('month', v_today)::date then
    v_dia := extract(day from v_today)::int;
    v_periodo := ' (dias 1 a ' || v_dia || ')';
  end if;
  v_a_end := case when v_dia is null then (v_a + interval '1 month - 1 day')::date else public.whatsapp_due_date(v_a, v_dia) end;
  v_b_end := case when v_dia is null then (v_b + interval '1 month - 1 day')::date else public.whatsapp_due_date(v_b, v_dia) end;

  select coalesce(sum(amount) filter (where type = 'expense'), 0), coalesce(sum(amount) filter (where type = 'income'), 0)
    into v_ga, v_ra from public.transactions
   where user_id = p_user_id and status = 'active' and transaction_date between v_a and v_a_end;
  select coalesce(sum(amount) filter (where type = 'expense'), 0), coalesce(sum(amount) filter (where type = 'income'), 0)
    into v_gb, v_rb from public.transactions
   where user_id = p_user_id and status = 'active' and transaction_date between v_b and v_b_end;

  if v_ga = 0 and v_gb = 0 and v_ra = 0 and v_rb = 0 then
    return jsonb_build_object('ok', true, 'vazio', true,
      'mensagem', '📊 Não encontrei lançamentos em ' || public.whatsapp_month_name(v_a) || ' nem em ' || public.whatsapp_month_name(v_b) || '.');
  end if;

  select string_agg('• ' || cat || ': R$ ' || public.money_br(gb) || ' → R$ ' || public.money_br(ga) ||
                    case when ga > gb then ' (▲ R$ ' || public.money_br(ga - gb) || ')'
                         when ga < gb then ' (▼ R$ ' || public.money_br(gb - ga) || ')' else ' (=)' end,
                    E'\n' order by abs(ga - gb) desc)
    into v_cats
    from (
      select coalesce(c.name, 'Sem categoria') as cat,
             coalesce(sum(t.amount) filter (where t.transaction_date between v_a and v_a_end), 0) as ga,
             coalesce(sum(t.amount) filter (where t.transaction_date between v_b and v_b_end), 0) as gb
        from public.transactions t left join public.categories c on c.id = t.category_id
       where t.user_id = p_user_id and t.type = 'expense' and t.status = 'active'
         and ((t.transaction_date between v_a and v_a_end) or (t.transaction_date between v_b and v_b_end))
       group by 1
       order by abs(coalesce(sum(t.amount) filter (where t.transaction_date between v_a and v_a_end), 0)
                  - coalesce(sum(t.amount) filter (where t.transaction_date between v_b and v_b_end), 0)) desc
       limit 6) s;

  v_msg := '📊 *' || initcap(public.whatsapp_month_name(v_b)) || ' → ' || initcap(public.whatsapp_month_name(v_a)) || '*' || v_periodo || E'\n' ||
           '💸 Gastos: R$ ' || public.money_br(v_gb) || ' → R$ ' || public.money_br(v_ga) ||
           case when v_gb > 0 then ' (' || case when v_ga >= v_gb then '+' else '' end || round((v_ga - v_gb) / v_gb * 100) || '%)' else '' end || E'\n' ||
           '💰 Receitas: R$ ' || public.money_br(v_rb) || ' → R$ ' || public.money_br(v_ra) || E'\n' ||
           '🏦 Saldo: R$ ' || public.money_br(v_rb - v_gb) || ' → R$ ' || public.money_br(v_ra - v_ga) ||
           case when v_cats is not null then E'\n\n' || '📂 *Onde mais mudou*' || E'\n' || v_cats else '' end || E'\n\n' ||
           case when v_ga < v_gb then '👏 Você gastou R$ ' || public.money_br(v_gb - v_ga) || ' a menos.'
                when v_ga > v_gb then '👀 Você gastou R$ ' || public.money_br(v_ga - v_gb) || ' a mais.'
                else '🟰 Mesmo total de gastos.' end;

  return jsonb_build_object('ok', true, 'mes_a', to_char(v_a, 'MM/YYYY'), 'mes_b', to_char(v_b, 'MM/YYYY'),
    'gastos_a', v_ga, 'gastos_b', v_gb, 'receitas_a', v_ra, 'receitas_b', v_rb, 'mensagem', v_msg);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Editar gasto fixo / receita fixa
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_update_recurrence(
  p_user_id uuid,
  p_kind text,
  p_alvo text,
  p_amount numeric default null,
  p_due_day int default null,
  p_title text default null,
  p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when p_kind = 'income' then 'income' else 'expense' end;
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_ids uuid[]; v_titles text[]; v_id uuid;
  v_old_amount numeric; v_old_day int; v_old_title text;
  v_title text := nullif(left(btrim(coalesce(p_title, '')), 120), '');
  v_cat_id uuid; v_cat_name text;
  v_mud text := '';
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_alvo = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Diga qual gasto fixo (ou receita fixa) quer alterar.');
  end if;
  if p_amount is null and p_due_day is null and v_title is null and nullif(btrim(coalesce(p_category, '')), '') is null then
    return jsonb_build_object('ok', false, 'mensagem', 'O que quer mudar: o valor, o dia de vencimento, o nome ou a categoria?');
  end if;
  if p_amount is not null and p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'O valor precisa ser maior que zero.');
  end if;
  if p_due_day is not null and (p_due_day < 1 or p_due_day > 31) then
    return jsonb_build_object('ok', false, 'mensagem', 'O dia de vencimento precisa estar entre 1 e 31.');
  end if;

  if v_kind = 'expense' then
    select array_agg(id), array_agg(title) into v_ids, v_titles from public.fixed_expenses
     where user_id = p_user_id and is_active and lower(title) like '%' || v_alvo || '%';
  else
    select array_agg(id), array_agg(title) into v_ids, v_titles from public.fixed_incomes
     where user_id = p_user_id and is_active
       and (lower(title) like '%' || v_alvo || '%'
            or (v_alvo ~ 'sal[aá]rio' and kind = 'salary')
            or (v_alvo ~ 'alimenta' and kind = 'food_allowance')
            or (v_alvo ~ 'refei' and kind = 'meal_allowance'));
  end if;

  if v_ids is null then
    return jsonb_build_object('ok', false, 'encontrados', 0,
      'mensagem', '🤔 Não encontrei ' || case v_kind when 'income' then 'receita fixa' else 'gasto fixo' end || ' ativo com "' || p_alvo || '".');
  end if;
  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('ok', false, 'ambiguo', true, 'candidatos', to_jsonb(v_titles),
      'mensagem', 'Encontrei mais de um: ' || array_to_string(v_titles, ', ') || '. Qual deles?');
  end if;
  v_id := v_ids[1];

  if nullif(btrim(coalesce(p_category, '')), '') is not null then
    v_cat_id := public.whatsapp_category_id(p_user_id, p_category, v_kind);
    select name into v_cat_name from public.categories where id = v_cat_id;
  end if;

  if v_kind = 'expense' then
    select amount, due_day, title into v_old_amount, v_old_day, v_old_title from public.fixed_expenses where id = v_id;
    update public.fixed_expenses
       set amount = coalesce(p_amount, amount), due_day = coalesce(p_due_day, due_day),
           title = coalesce(v_title, title), category_id = coalesce(v_cat_id, category_id), updated_at = now()
     where id = v_id;
  else
    select amount, due_day, title into v_old_amount, v_old_day, v_old_title from public.fixed_incomes where id = v_id;
    update public.fixed_incomes
       set amount = coalesce(p_amount, amount), due_day = coalesce(p_due_day, due_day),
           title = coalesce(v_title, title), category_id = coalesce(v_cat_id, category_id), updated_at = now()
     where id = v_id;
  end if;

  if p_amount is not null and p_amount <> v_old_amount then
    v_mud := v_mud || '• Valor: R$ ' || public.money_br(v_old_amount) || ' → *R$ ' || public.money_br(p_amount) || '*' || E'\n'; end if;
  if p_due_day is not null and p_due_day <> v_old_day then
    v_mud := v_mud || '• Vencimento: dia ' || v_old_day || ' → *dia ' || p_due_day || '*' || E'\n'; end if;
  if v_title is not null and v_title <> v_old_title then
    v_mud := v_mud || '• Nome: ' || v_old_title || ' → *' || v_title || '*' || E'\n'; end if;
  if v_cat_name is not null then
    v_mud := v_mud || '• Categoria: *' || v_cat_name || '*' || E'\n'; end if;
  if v_mud = '' then
    return jsonb_build_object('ok', true, 'sem_mudanca', true, 'mensagem', 'Já estava assim — nada para mudar em ' || v_old_title || '.');
  end if;

  return jsonb_build_object('ok', true, 'id', v_id,
    'mensagem', '✏️ *' || coalesce(v_title, v_old_title) || '* atualizado' || E'\n' || rtrim(v_mud, E'\n') || E'\n' ||
                'Vale para as próximas ocorrências; o que já foi lançado não muda.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Pausar / reativar (e excluir com distinção)
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_toggle_recurrence(
  p_user_id uuid,
  p_kind text,
  p_alvo text,
  p_active boolean          -- false = pausar, true = reativar
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when p_kind = 'income' then 'income' else 'expense' end;
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_today date := public.whatsapp_today();
  v_month date := date_trunc('month', v_today)::date;
  v_ids uuid[]; v_titles text[]; v_id uuid; v_title text; v_amount numeric;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_alvo = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Diga qual gasto fixo (ou receita fixa) quer ' || case when p_active then 'reativar' else 'pausar' end || '.');
  end if;

  -- pausar procura entre os ativos; reativar procura entre os pausados (inativos sem end_date passado)
  if v_kind = 'expense' then
    select array_agg(id), array_agg(title) into v_ids, v_titles from public.fixed_expenses
     where user_id = p_user_id and is_active = (not p_active) and lower(title) like '%' || v_alvo || '%'
       and (p_active = false or end_date is null or end_date > v_today);
  else
    select array_agg(id), array_agg(title) into v_ids, v_titles from public.fixed_incomes
     where user_id = p_user_id and is_active = (not p_active)
       and (p_active = false or end_date is null or end_date > v_today)
       and (lower(title) like '%' || v_alvo || '%'
            or (v_alvo ~ 'sal[aá]rio' and kind = 'salary')
            or (v_alvo ~ 'alimenta' and kind = 'food_allowance')
            or (v_alvo ~ 'refei' and kind = 'meal_allowance'));
  end if;

  if v_ids is null then
    return jsonb_build_object('ok', false, 'encontrados', 0,
      'mensagem', case when p_active then '🤔 Não encontrei nada pausado com "' || p_alvo || '".'
                       else '🤔 Não encontrei ' || case v_kind when 'income' then 'receita fixa' else 'gasto fixo' end || ' ativo com "' || p_alvo || '".' end);
  end if;
  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('ok', false, 'ambiguo', true, 'candidatos', to_jsonb(v_titles),
      'mensagem', 'Encontrei mais de um: ' || array_to_string(v_titles, ', ') || '. Qual deles?');
  end if;
  v_id := v_ids[1];

  if v_kind = 'expense' then
    update public.fixed_expenses
       set is_active = p_active, updated_at = now(),
           end_date = case when p_active then null else end_date end,
           -- ao reativar, recomeça do mês atual: o catch-up do site NÃO preenche os meses pausados
           start_date = case when p_active then greatest(coalesce(start_date, created_at::date), v_month) else start_date end
     where id = v_id returning title, amount into v_title, v_amount;
  else
    update public.fixed_incomes
       set is_active = p_active, updated_at = now(),
           end_date = case when p_active then null else end_date end,
           start_date = case when p_active then greatest(coalesce(start_date, created_at::date), v_month) else start_date end
     where id = v_id returning title, amount into v_title, v_amount;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'ativo', p_active,
    'mensagem', case when p_active
      then '▶️ *' || v_title || '* reativado (R$ ' || public.money_br(v_amount) || '/mês). Volta a contar a partir deste mês.'
      else '⏸️ *' || v_title || '* pausado. Não vou lançar os próximos meses até você dizer "reativa o ' || v_title || '".' end);
end;
$$;

-- Excluir: apaga de vez quando não há histórico; senão inativa com end_date = hoje
-- (assim não aparece como "pausado").
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
  v_today date := public.whatsapp_today();
  v_ids uuid[]; v_titles text[]; v_id uuid; v_title text; v_amount numeric; v_n int;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_alvo = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Diga qual recorrência quer remover (ex.: "remove o gasto fixo internet").');
  end if;

  if v_kind = 'expense' then
    select array_agg(id), array_agg(title) into v_ids, v_titles from public.fixed_expenses
     where user_id = p_user_id and is_active and lower(title) like '%' || v_alvo || '%';
  elsif v_kind = 'income' then
    select array_agg(id), array_agg(title) into v_ids, v_titles from public.fixed_incomes
     where user_id = p_user_id and is_active
       and (lower(title) like '%' || v_alvo || '%'
            or (v_alvo ~ 'sal[aá]rio' and kind = 'salary')
            or (v_alvo ~ 'alimenta' and kind = 'food_allowance')
            or (v_alvo ~ 'refei' and kind = 'meal_allowance'));
  else
    select array_agg(id), array_agg(title) into v_ids, v_titles from public.installments
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
    select title, amount into v_title, v_amount from public.fixed_expenses where id = v_id;
    select count(*) into v_n from public.transactions where fixed_expense_id = v_id;
    if v_n = 0 then delete from public.fixed_expenses where id = v_id;
    else update public.fixed_expenses set is_active = false, end_date = v_today, updated_at = now() where id = v_id; end if;
  elsif v_kind = 'income' then
    select title, amount into v_title, v_amount from public.fixed_incomes where id = v_id;
    select count(*) into v_n from public.transactions where fixed_income_id = v_id;
    if v_n = 0 then delete from public.fixed_incomes where id = v_id;
    else update public.fixed_incomes set is_active = false, end_date = v_today, updated_at = now() where id = v_id; end if;
  else
    select title, installment_amount into v_title, v_amount from public.installments where id = v_id;
    select count(*) into v_n from public.transactions where installment_id = v_id;
    if v_n = 0 then delete from public.installments where id = v_id;
    else update public.installments set is_active = false, updated_at = now() where id = v_id; end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'apagado', v_n = 0,
    'mensagem', '🗑️ Removido: ' || v_title || ' (R$ ' || public.money_br(v_amount) || ').' ||
                case when v_n = 0 then '' else E'\n' || 'Os lançamentos já feitos continuam no histórico; não gero mais os próximos.' end);
end;
$$;

-- Lista com a seção de pausados
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
  v_today date := public.whatsapp_today();
  v_exp text; v_exp_total numeric := 0;
  v_inc text; v_inc_total numeric := 0;
  v_par text; v_par_total numeric := 0;
  v_paused text;
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

  select string_agg(x, ', ' order by x) into v_paused from (
    select title as x from public.fixed_expenses
     where user_id = p_user_id and not is_active and (end_date is null or end_date > v_today) and v_kind in ('expense','both')
    union all
    select title from public.fixed_incomes
     where user_id = p_user_id and not is_active and (end_date is null or end_date > v_today) and v_kind in ('income','both')) p;

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
  if v_paused is not null then
    v_msg := v_msg || E'\n\n' || '⏸️ Pausados: ' || v_paused;
  end if;

  return jsonb_build_object('ok', true, 'mensagem', v_msg,
                            'total_gastos_fixos', v_exp_total, 'total_receitas_fixas', v_inc_total,
                            'total_parcelas_mes', v_par_total, 'pausados', v_paused);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Consulta livre: categoria e/ou termo, num período qualquer
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_query_transactions(
  p_user_id uuid,
  p_inicio date default null,
  p_fim date default null,
  p_categoria text default null,
  p_termo text default null,
  p_tipo text default 'expense',
  p_limit int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_ini date := coalesce(p_inicio, date_trunc('month', v_today)::date);
  v_fim date := least(coalesce(p_fim, v_today), v_today);
  v_cat text := lower(nullif(btrim(coalesce(p_categoria, '')), ''));
  v_termo text := lower(nullif(btrim(coalesce(p_termo, '')), ''));
  v_tipo text := case when p_tipo in ('income','both') then p_tipo else 'expense' end;
  v_total numeric; v_count int; v_top text; v_por_mes text; v_filtro text; v_media numeric;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_ini > v_fim then v_ini := v_fim; end if;

  select coalesce(sum(t.amount), 0), count(*) into v_total, v_count
    from public.transactions t left join public.categories c on c.id = t.category_id
   where t.user_id = p_user_id and t.status = 'active'
     and (v_tipo = 'both' or t.type = v_tipo)
     and t.transaction_date between v_ini and v_fim
     and (v_cat is null or lower(coalesce(c.name, '')) like '%' || v_cat || '%')
     and (v_termo is null or lower(coalesce(t.description, '')) like '%' || v_termo || '%');

  v_filtro := coalesce(initcap(v_cat), '') || case when v_cat is not null and v_termo is not null then ' / ' else '' end ||
              coalesce('"' || v_termo || '"', '');
  if v_filtro = '' then v_filtro := case v_tipo when 'income' then 'Receitas' when 'both' then 'Lançamentos' else 'Gastos' end; end if;

  if v_count = 0 then
    return jsonb_build_object('ok', true, 'total', 0, 'quantidade', 0,
      'mensagem', '🔎 Nada encontrado para *' || v_filtro || '* entre ' || to_char(v_ini, 'DD/MM/YYYY') || ' e ' || to_char(v_fim, 'DD/MM/YYYY') || '.');
  end if;

  select string_agg('• (' || to_char(transaction_date, 'DD/MM') || ') ' || coalesce(nullif(description, ''), 'Lançamento') ||
                    ' — R$ ' || public.money_br(amount), E'\n' order by amount desc)
    into v_top
    from (select t.transaction_date, t.description, t.amount
            from public.transactions t left join public.categories c on c.id = t.category_id
           where t.user_id = p_user_id and t.status = 'active'
             and (v_tipo = 'both' or t.type = v_tipo)
             and t.transaction_date between v_ini and v_fim
             and (v_cat is null or lower(coalesce(c.name, '')) like '%' || v_cat || '%')
             and (v_termo is null or lower(coalesce(t.description, '')) like '%' || v_termo || '%')
           order by t.amount desc limit greatest(coalesce(p_limit, 5), 1)) s;

  -- quebra por mês quando o período cruza mais de um mês
  if date_trunc('month', v_ini) <> date_trunc('month', v_fim) then
    select string_agg('• ' || initcap(public.whatsapp_month_name(m)) || case when extract(year from m) <> extract(year from v_today) then '/' || to_char(m, 'YY') else '' end ||
                      ': R$ ' || public.money_br(soma), E'\n' order by m)
      into v_por_mes
      from (select date_trunc('month', t.transaction_date)::date as m, sum(t.amount) as soma
              from public.transactions t left join public.categories c on c.id = t.category_id
             where t.user_id = p_user_id and t.status = 'active'
               and (v_tipo = 'both' or t.type = v_tipo)
               and t.transaction_date between v_ini and v_fim
               and (v_cat is null or lower(coalesce(c.name, '')) like '%' || v_cat || '%')
               and (v_termo is null or lower(coalesce(t.description, '')) like '%' || v_termo || '%')
             group by 1) s;
  end if;
  v_media := round(v_total / v_count, 2);

  return jsonb_build_object('ok', true, 'total', v_total, 'quantidade', v_count, 'media', v_media,
    'inicio', to_char(v_ini, 'DD/MM/YYYY'), 'fim', to_char(v_fim, 'DD/MM/YYYY'),
    'mensagem', '🔎 *' || v_filtro || '* de ' || to_char(v_ini, 'DD/MM') || case when extract(year from v_ini) <> extract(year from v_fim) then '/' || to_char(v_ini, 'YY') else '' end ||
                ' a ' || to_char(v_fim, 'DD/MM') || E'\n' ||
                '💸 Total: *R$ ' || public.money_br(v_total) || '* em ' || v_count || ' lançamento(s) (média R$ ' || public.money_br(v_media) || ')' ||
                case when v_por_mes is not null then E'\n\n' || '📅 *Por mês*' || E'\n' || v_por_mes else '' end ||
                E'\n\n' || '🔝 *Maiores*' || E'\n' || v_top);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Dados estruturados para o relatório em PDF (o n8n monta o arquivo)
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_report_pdf_data(
  p_user_id uuid,
  p_ref date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_ref date := coalesce(p_ref, v_today);
  v_start date := date_trunc('month', v_ref)::date;
  v_end date := least((v_start + interval '1 month - 1 day')::date, v_today);
  v_nome text; v_rec numeric; v_desp numeric; v_limite numeric;
  v_cats jsonb; v_itens jsonb; v_metas jsonb; v_fixos numeric;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if v_start > v_today then
    return jsonb_build_object('ok', false, 'mensagem', 'Esse mês ainda não começou.');
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'Usuário') into v_nome from public.profiles where id = p_user_id;

  select coalesce(sum(amount) filter (where type = 'income'), 0), coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_rec, v_desp from public.transactions
   where user_id = p_user_id and status = 'active' and transaction_date between v_start and v_end;

  select amount into v_limite from public.budgets where user_id = p_user_id and category_id is null and month_ref = v_start;

  select coalesce(jsonb_agg(jsonb_build_object('categoria', cat, 'total', soma,
           'pct', case when v_desp > 0 then round(soma / v_desp * 100) else 0 end, 'limite', lim) order by soma desc), '[]'::jsonb)
    into v_cats
    from (select coalesce(c.name, 'Sem categoria') as cat, sum(t.amount) as soma,
                 (select b.amount from public.budgets b where b.user_id = p_user_id and b.category_id = t.category_id and b.month_ref = v_start) as lim
            from public.transactions t left join public.categories c on c.id = t.category_id
           where t.user_id = p_user_id and t.type = 'expense' and t.status = 'active'
             and t.transaction_date between v_start and v_end
           group by c.name, t.category_id) s;

  select coalesce(jsonb_agg(jsonb_build_object('data', to_char(t.transaction_date, 'DD/MM'), 'descricao', coalesce(nullif(t.description, ''), 'Lançamento'),
           'categoria', coalesce(c.name, '—'), 'tipo', t.type, 'valor', t.amount) order by t.transaction_date, t.created_at), '[]'::jsonb)
    into v_itens
    from public.transactions t left join public.categories c on c.id = t.category_id
   where t.user_id = p_user_id and t.status = 'active' and t.transaction_date between v_start and v_end;

  select coalesce(jsonb_agg(jsonb_build_object('titulo', title, 'atual', current_amount, 'alvo', target_amount,
           'pct', case when target_amount > 0 then least(100, round(current_amount / target_amount * 100)) else 0 end) order by created_at), '[]'::jsonb)
    into v_metas from public.goals where user_id = p_user_id and status = 'active';

  select coalesce(sum(amount), 0) into v_fixos from public.fixed_expenses where user_id = p_user_id and is_active;

  return jsonb_build_object('ok', true,
    'nome', v_nome,
    'titulo_mes', initcap(public.whatsapp_month_name(v_start)) || ' de ' || extract(year from v_start),
    'arquivo', 'moedin-relatorio-' || to_char(v_start, 'YYYY-MM') || '.pdf',
    'periodo', to_char(v_start, 'DD/MM/YYYY') || ' a ' || to_char(v_end, 'DD/MM/YYYY'),
    'gerado_em', to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'receitas', v_rec, 'despesas', v_desp, 'saldo', v_rec - v_desp, 'limite', v_limite,
    'gastos_fixos_mes', v_fixos,
    'categorias', v_cats, 'lancamentos', v_itens, 'metas', v_metas,
    'quantidade', jsonb_array_length(v_itens));
end;
$$;

-- ---------------------------------------------------------------------------
-- Alertas diários: limite por categoria (80% / 100%), uma vez por mês por categoria
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
  r record; v_lista text; v_key text; v_limit numeric; v_spent numeric; v_pct numeric; f record; cb record;
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

    -- (b) limite geral
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

    -- (b2) limites por categoria
    for cb in
      select b.category_id, c.name, b.amount as lim,
             (select coalesce(sum(t.amount), 0) from public.transactions t
               where t.user_id = r.user_id and t.type = 'expense' and t.status = 'active' and t.category_id = b.category_id
                 and t.transaction_date >= v_month and t.transaction_date < (v_month + interval '1 month')::date) as gasto
        from public.budgets b join public.categories c on c.id = b.category_id
       where b.user_id = r.user_id and b.category_id is not null and b.month_ref = v_month and b.amount > 0
    loop
      v_pct := round(cb.gasto / cb.lim * 100, 1);
      v_key := case when v_pct >= 100 then 'alert:cat100:' || to_char(v_month, 'YYYY-MM') || ':' || cb.category_id
                    when v_pct >= 80 then 'alert:cat80:' || to_char(v_month, 'YYYY-MM') || ':' || cb.category_id end;
      if v_key is not null and not exists (select 1 from public.message_logs m where m.user_id = r.user_id and m.direction = 'out' and m.external_id = v_key) then
        v_out := v_out || jsonb_build_object('user_id', r.user_id, 'wa_id', r.wa_id, 'external_id', v_key,
          'mensagem', case when v_pct >= 100 then '🚨 *' || cb.name || ' estourou o limite*' else '⚠️ *' || cb.name || ' perto do limite*' end || E'\n' ||
                      'R$ ' || public.money_br(cb.gasto) || ' de R$ ' || public.money_br(cb.lim) || ' (' || v_pct || '%) em ' || to_char(v_month, 'MM/YYYY') || '.' ||
                      case when v_pct < 100 then E'\n' || 'Ainda dá para gastar R$ ' || public.money_br(cb.lim - cb.gasto) || ' nessa categoria.' else '' end);
      end if;
    end loop;

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

-- ---------------------------------------------------------------------------
-- Permissões: só a service_role (n8n). Helpers puros ficam sem grant a anon.
-- ---------------------------------------------------------------------------
revoke all on function public.whatsapp_month_name(date) from public, anon, authenticated;
revoke all on function public.whatsapp_currency_code(text) from public, anon, authenticated;
revoke all on function public.whatsapp_currency_symbol(text) from public, anon, authenticated;
revoke all on function public.whatsapp_fx_upsert(jsonb) from public, anon, authenticated;
revoke all on function public.whatsapp_fx_quote(numeric, text) from public, anon, authenticated;
revoke all on function public.whatsapp_create_transaction(uuid, text, numeric, text, date, text, text, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_set_monthly_limit(uuid, numeric, int, text) from public, anon, authenticated;
revoke all on function public.whatsapp_monthly_limit(uuid, date) from public, anon, authenticated;
revoke all on function public.whatsapp_compare_months(uuid, date, date) from public, anon, authenticated;
revoke all on function public.whatsapp_update_recurrence(uuid, text, text, numeric, int, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_toggle_recurrence(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.whatsapp_delete_recurrence(uuid, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_list_recurrences(uuid, text) from public, anon, authenticated;
revoke all on function public.whatsapp_query_transactions(uuid, date, date, text, text, text, int) from public, anon, authenticated;
revoke all on function public.whatsapp_report_pdf_data(uuid, date) from public, anon, authenticated;
revoke all on function public.whatsapp_daily_alerts() from public, anon, authenticated;

grant execute on function public.whatsapp_month_name(date) to service_role;
grant execute on function public.whatsapp_currency_code(text) to service_role;
grant execute on function public.whatsapp_currency_symbol(text) to service_role;
grant execute on function public.whatsapp_fx_upsert(jsonb) to service_role;
grant execute on function public.whatsapp_fx_quote(numeric, text) to service_role;
grant execute on function public.whatsapp_create_transaction(uuid, text, numeric, text, date, text, text, text, text) to service_role;
grant execute on function public.whatsapp_set_monthly_limit(uuid, numeric, int, text) to service_role;
grant execute on function public.whatsapp_monthly_limit(uuid, date) to service_role;
grant execute on function public.whatsapp_compare_months(uuid, date, date) to service_role;
grant execute on function public.whatsapp_update_recurrence(uuid, text, text, numeric, int, text, text) to service_role;
grant execute on function public.whatsapp_toggle_recurrence(uuid, text, text, boolean) to service_role;
grant execute on function public.whatsapp_delete_recurrence(uuid, text, text) to service_role;
grant execute on function public.whatsapp_list_recurrences(uuid, text) to service_role;
grant execute on function public.whatsapp_query_transactions(uuid, date, date, text, text, text, int) to service_role;
grant execute on function public.whatsapp_report_pdf_data(uuid, date) to service_role;
grant execute on function public.whatsapp_daily_alerts() to service_role;
