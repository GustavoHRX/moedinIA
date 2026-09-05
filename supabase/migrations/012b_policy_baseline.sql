-- 012b_policy_baseline.sql
-- REVISÃO EXTERNA (ago/2026) — achado 7.1: a migration 013 faz `alter policy`
-- em CINCO policies que nenhuma migration cria (foram feitas à mão no painel):
--
--   categories:    "Users can view own categories" / "Users can insert own categories"
--   user_settings: "Users can view own settings" / "Users can update own settings"
--                  / "Users can insert own settings"
--
-- Num banco novo (`supabase db reset`) a 013 abortava com "policy does not
-- exist". Este arquivo cria essas policies ANTES da 013 (ordena entre
-- 012_... e 013_...). Em produção é no-op — as policies já existem, então o
-- `drop ... if exists` + `create` só as recria idênticas.
--
-- As policies FOR ALL originais da 001 ("Users can manage own ...") são
-- substituídas pelas granulares (SELECT/INSERT/UPDATE/DELETE separadas), que é
-- o estado real de produção.

-- categories --------------------------------------------------------------
drop policy if exists "Users can manage own categories" on public.categories;

drop policy if exists "Users can view own categories" on public.categories;
create policy "Users can view own categories"
on public.categories for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own categories" on public.categories;
create policy "Users can insert own categories"
on public.categories for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories"
on public.categories for update
using (auth.uid() = user_id and is_default = false)
with check (auth.uid() = user_id and is_default = false);

drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories"
on public.categories for delete
using (auth.uid() = user_id and is_default = false);

-- user_settings ----------------------------------------------------------
drop policy if exists "Users can manage own settings" on public.user_settings;

drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings"
on public.user_settings for select
using (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
on public.user_settings for update
using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
on public.user_settings for insert
with check (auth.uid() = user_id);
