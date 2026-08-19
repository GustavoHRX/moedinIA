-- 013 - Higiene de banco apontada pelo linter do Supabase (18/ago/2026)
--
-- 1) RLS "initplan": trocar auth.uid() por (select auth.uid()) nas policies.
--    Sem o select, o Postgres reavalia a função uma vez POR LINHA; com ele,
--    avalia uma vez só por query. Mesma semântica, ganho grande em tabelas
--    com muitas linhas (transactions é a mais afetada).
--    Usamos ALTER POLICY (e não drop/create) para nunca deixar a tabela
--    desprotegida, nem por um instante.
--
-- 2) Índices faltando em foreign keys usadas em filtro.
--
-- 3) Revoke defensivo do papel anon nas funções de WhatsApp/ativação.
--    Em produção já está assim, mas a migration 009 concedia a anon — sem
--    isso, subir o banco do zero reabriria a falha corrigida no QA de agosto.

-- ---------------------------------------------------------------- policies

alter policy "Users can manage own insights" on public.ai_insights
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can manage own budgets" on public.budgets
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Users can view own categories" on public.categories
  using (user_id = (select auth.uid()));

alter policy "Users can insert own categories" on public.categories
  with check (user_id = (select auth.uid()));

alter policy "Users can manage own fixed expenses" on public.fixed_expenses
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Users can manage own fixed incomes" on public.fixed_incomes
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can manage own goals" on public.goals
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Users can manage own installments" on public.installments
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Users can view own message logs" on public.message_logs
  using ((select auth.uid()) = user_id);

alter policy "Users can manage own monthly controls" on public.monthly_controls
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- profiles/user_settings: o UPDATE não define WITH CHECK de propósito —
-- sem ele o Postgres reaproveita o USING, que é o comportamento atual.
alter policy "Users can view own profile" on public.profiles
  using ((select auth.uid()) = id);

alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = id);

alter policy "Users can insert own profile" on public.profiles
  with check ((select auth.uid()) = id);

alter policy "Users can manage own transactions" on public.transactions
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Users can view own settings" on public.user_settings
  using ((select auth.uid()) = user_id);

alter policy "Users can update own settings" on public.user_settings
  using ((select auth.uid()) = user_id);

alter policy "Users can insert own settings" on public.user_settings
  with check ((select auth.uid()) = user_id);

alter policy "own wa links" on public.whatsapp_links
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------- índices

create index if not exists idx_ai_insights_user_id
  on public.ai_insights (user_id);

create index if not exists idx_fixed_incomes_category_id
  on public.fixed_incomes (category_id);

create index if not exists idx_message_logs_user_id
  on public.message_logs (user_id);

-- ------------------------------------------------------- grants defensivos

revoke execute on function public.ensure_activation_code(uuid)            from anon;
revoke execute on function public.link_whatsapp_by_code(text, text, text) from anon, authenticated;
revoke execute on function public.resolve_user_by_wa(text, text)          from anon, authenticated;
