-- 011_fixed_incomes.sql
-- Receitas fixas (salário, vale-alimentação, vale-refeição).
-- Até aqui a receita recorrente não existia: salário e vales ficavam apenas em
-- monthly_controls, que nenhuma outra tela lia — o salário nunca virava
-- lançamento e o dashboard mostrava "Entradas R$ 0,00".
-- Espelha fixed_expenses, com due_day = dia do pagamento.

create table if not exists public.fixed_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title varchar(120) not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  due_day integer not null check (due_day between 1 and 31),
  is_active boolean not null default true,
  -- identifica a origem no planejamento mensal (salary/food_allowance/meal_allowance)
  -- ou 'custom' para receitas fixas criadas manualmente.
  kind varchar(20) not null default 'custom'
    check (kind in ('salary', 'food_allowance', 'meal_allowance', 'custom')),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma receita fixa por tipo de origem do planejamento (salário, VA, VR).
create unique index if not exists uq_fixed_incomes_user_kind
  on public.fixed_incomes(user_id, kind)
  where kind <> 'custom';

create index if not exists idx_fixed_incomes_user_id on public.fixed_incomes(user_id);

drop trigger if exists trg_fixed_incomes_updated_at on public.fixed_incomes;
create trigger trg_fixed_incomes_updated_at
before update on public.fixed_incomes
for each row execute function public.set_updated_at();

-- Liga a transação gerada à receita fixa de origem (usado para não duplicar).
alter table public.transactions
  add column if not exists fixed_income_id uuid references public.fixed_incomes(id) on delete set null;

create index if not exists idx_transactions_fixed_income_id
  on public.transactions(fixed_income_id);

-- origin_type ganha 'fixed_income' além dos valores já existentes.
alter table public.transactions drop constraint if exists transactions_origin_type_check;
alter table public.transactions
  add constraint transactions_origin_type_check
  check (origin_type in ('manual', 'fixed_expense', 'installment', 'fixed_income'));

alter table public.fixed_incomes enable row level security;

drop policy if exists "Users can manage own fixed incomes" on public.fixed_incomes;
create policy "Users can manage own fixed incomes"
on public.fixed_incomes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
