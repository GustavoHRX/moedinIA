-- 012_fixed_incomes_extra_income.sql
-- BUG-01 (QA 11/ago/2026): a renda extra do planejamento mensal era gravada em
-- monthly_controls mas nunca virava lançamento — syncFixedIncomes() só
-- espelhava salário/vale-alimentação/vale-refeição. Decisão de produto:
-- renda extra é recorrente, igual ao salário. Adiciona o kind que faltava.

alter table public.fixed_incomes drop constraint if exists fixed_incomes_kind_check;
alter table public.fixed_incomes
  add constraint fixed_incomes_kind_check
  check (kind in ('salary', 'food_allowance', 'meal_allowance', 'extra_income', 'custom'));
