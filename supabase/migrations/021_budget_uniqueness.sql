-- 021_budget_uniqueness.sql
-- REVISÃO EXTERNA (ago/2026) — achado 2.10: `budgets` não tem unicidade por
-- usuário/mês/categoria, e a tela faz "consulta e depois insere". Gravações
-- concorrentes criam orçamentos duplicados e quebram consultas que esperam um
-- único registro (o dashboard usa `budgets.find(...)`).
--
-- `monthly_controls` já tem `unique (user_id, month_ref)` desde a migration 002.
--
-- Dois índices parciais porque `category_id` pode ser NULL (orçamento geral do
-- mês) e NULLs não conflitam entre si num índice comum.

create unique index if not exists uq_budgets_user_month_category
  on public.budgets (user_id, month_ref, category_id)
  where category_id is not null;

create unique index if not exists uq_budgets_user_month_general
  on public.budgets (user_id, month_ref)
  where category_id is null;
