-- 034 — Revisão final (out/2026): busca do bot sem acento + repositório igual à produção
--
-- Duas coisas, as duas idempotentes (rodar de novo não muda nada):
--
-- PARTE 1 — BUG: o bot gravava "Café" e depois não achava "muda o cafe pra 15".
--   As RPCs comparavam `lower(descricao) like '%termo%'`, que diferencia acento.
--   Em vez de reescrever à mão cada função (são 10, algumas com 200 linhas), o bloco
--   abaixo lê a definição ATUAL de cada uma e troca só a comparação, usando o
--   helper `whatsapp_norm` que já existe desde a 031 (minúsculas, sem acento,
--   espaços normalizados). Todo o resto da função fica byte a byte igual.
--   Vale para descrição de lançamento, título de fixo/parcelamento/meta, nome de
--   categoria no relatório e o padrão das regras aprendidas.
--
-- PARTE 2 — RECONCILIAÇÃO: coisas que foram ajustadas à mão no banco de produção
--   e nunca voltaram para os arquivos. Em produção esta parte é um no-op; num
--   banco novo (cadeia 001…034) ela deixa o resultado igual ao que está no ar.

-- ===========================================================================
-- PARTE 1 — comparação sem acento nas RPCs do bot
-- ===========================================================================
do $$
declare
  r record;
  v_def text;
  v_new text;
  -- lower(<coluna>) ou lower(coalesce(<coluna>, '')) like '%' || <termo> || '%'
  c_pat constant text :=
    $re$lower\(((?:coalesce\()?[a-z_.]+(?:, ''\))?)\) like '%' \|\| ([a-z_.]+) \|\| '%'$re$;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'whatsapp\_%'
       and p.prosrc ~ c_pat
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(
      v_def, c_pat,
      $rep$public.whatsapp_norm(\1) like '%' || public.whatsapp_norm(\2) || '%'$rep$,
      'g');
    if v_new is distinct from v_def then
      execute v_new;  -- CREATE OR REPLACE: mantém dono, grants e search_path
      raise notice '034: busca sem acento aplicada em %', r.oid::regprocedure;
    end if;
  end loop;
end
$$;

-- ===========================================================================
-- PARTE 2 — o que só existia na produção
-- ===========================================================================

-- 2.1 ensure_activation_code: em 19/08/2026 a produção foi endurecida à mão
--     (migration manual "harden_ensure_activation_code"): o código é sempre do
--     usuário logado; o parâmetro continua na assinatura só por compatibilidade
--     e é ignorado. A 009 ainda tinha `coalesce(auth.uid(), p_user_id)`.
create or replace function public.ensure_activation_code(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_code text;
begin
  if v_uid is null then return jsonb_build_object('error','no_user'); end if;
  select activation_code into v_code from public.profiles where id = v_uid;
  if v_code is null or v_code = '' then
    loop
      v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
      begin
        update public.profiles set activation_code = v_code where id = v_uid;
        exit;
      exception when unique_violation then end;
    end loop;
  end if;
  return jsonb_build_object('code', v_code);
end; $$;

revoke all on function public.ensure_activation_code(uuid) from public, anon;
grant execute on function public.ensure_activation_code(uuid) to authenticated, service_role;

-- 2.2 budgets.category_id: produção usa ON DELETE CASCADE; a 001 dizia SET NULL.
--     CASCADE é o certo: com SET NULL, apagar uma categoria transformaria o
--     limite dela em "limite geral" e bateria no índice único da 021.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'budgets_category_id_fkey'
       and conrelid = 'public.budgets'::regclass
       and confdeltype <> 'c'
  ) then
    alter table public.budgets drop constraint budgets_category_id_fkey;
    alter table public.budgets
      add constraint budgets_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete cascade;
  end if;
end
$$;

-- 2.3 budgets.updated_at + gatilho (existem na produção, nunca estiveram em arquivo)
alter table public.budgets
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_budgets_updated_at on public.budgets;
create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- 2.4 índices criados à mão na produção
create index if not exists idx_budgets_category_id        on public.budgets (category_id);
create index if not exists idx_budgets_month_ref          on public.budgets (month_ref);
create index if not exists idx_fixed_expenses_category_id on public.fixed_expenses (category_id);
create index if not exists idx_fixed_expenses_due_day     on public.fixed_expenses (due_day);
create index if not exists idx_installments_category_id   on public.installments (category_id);
create index if not exists idx_monthly_controls_user_id   on public.monthly_controls (user_id);
create index if not exists idx_monthly_controls_month_ref on public.monthly_controls (month_ref);
create index if not exists idx_transactions_category_id   on public.transactions (category_id);
create index if not exists idx_transactions_status        on public.transactions (status);
create index if not exists idx_transactions_user_status_date
  on public.transactions (user_id, status, transaction_date desc);

-- FK sem índice apontada pelo advisor de performance
create index if not exists idx_wa_category_rules_category
  on public.whatsapp_category_rules (category_id);

-- 2.5 policy de UPDATE em categories: única que avaliava auth.uid() por linha
--     (a 018 a criou assim). Mesma regra, só embrulhada em (select …).
alter policy "Users can update own categories" on public.categories
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2.6 retenção de message_logs (180 dias): a 016 só agendava se o pg_cron já
--     existisse, e ele não existia — o descarte nunca rodou. Em 13/10/2026 a
--     extensão foi ativada no painel e o job criado. Aqui fica registrado: se a
--     extensão estiver disponível, garante o job (cron.schedule por nome é upsert).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-message-logs-daily', '17 3 * * *',
      'select public.purge_old_message_logs(180);');
  else
    raise notice '034: pg_cron não instalado — ative em Database > Extensions e rode esta migration de novo.';
  end if;
end
$$;
