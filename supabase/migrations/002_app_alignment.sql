-- Align database schema with current web app usage

-- =========================
-- BUDGETS COMPATIBILITY
-- =========================
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'limit_amount'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'amount'
  ) then
    alter table public.budgets rename column limit_amount to amount;
  end if;
end $$;

alter table public.budgets
  add column if not exists amount numeric(12,2) check (amount >= 0);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'limit_amount'
  ) then
    execute 'update public.budgets set amount = limit_amount where amount is null';
  end if;
end $$;

update public.budgets
set amount = 0
where amount is null;

alter table public.budgets
  alter column amount set not null;

-- =========================
-- GOALS COMPATIBILITY
-- =========================
alter table public.goals
  add column if not exists description text;

-- =========================
-- MONTHLY CONTROLS
-- =========================
create table if not exists public.monthly_controls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_ref date not null,
  salary_amount numeric(12,2) not null default 0 check (salary_amount >= 0),
  extra_income_amount numeric(12,2) not null default 0 check (extra_income_amount >= 0),
  opening_balance numeric(12,2) not null default 0,
  payday_day integer check (payday_day between 1 and 31),
  food_allowance numeric(12,2) not null default 0 check (food_allowance >= 0),
  meal_allowance numeric(12,2) not null default 0 check (meal_allowance >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_ref)
);

-- =========================
-- FIXED EXPENSES
-- =========================
create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title varchar(120) not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  due_day integer not null check (due_day between 1 and 31),
  is_active boolean not null default true,
  auto_create_transaction boolean not null default false,
  start_date date,
  end_date date,
  months_ahead integer check (months_ahead is null or months_ahead > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- INSTALLMENTS
-- =========================
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title varchar(120) not null,
  description text,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  installment_amount numeric(12,2) not null check (installment_amount >= 0),
  total_installments integer not null check (total_installments > 0),
  start_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- TRANSACTIONS ENHANCEMENTS
-- =========================
alter table public.transactions
  add column if not exists origin_type varchar(20) not null default 'manual'
  check (origin_type in ('manual', 'fixed_expense', 'installment'));

alter table public.transactions
  add column if not exists fixed_expense_id uuid references public.fixed_expenses(id) on delete set null;

alter table public.transactions
  add column if not exists installment_id uuid references public.installments(id) on delete set null;

alter table public.transactions
  add column if not exists installment_number integer;

alter table public.transactions
  add column if not exists installment_total integer;

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================
drop trigger if exists trg_monthly_controls_updated_at on public.monthly_controls;
create trigger trg_monthly_controls_updated_at
before update on public.monthly_controls
for each row execute function public.set_updated_at();

drop trigger if exists trg_fixed_expenses_updated_at on public.fixed_expenses;
create trigger trg_fixed_expenses_updated_at
before update on public.fixed_expenses
for each row execute function public.set_updated_at();

drop trigger if exists trg_installments_updated_at on public.installments;
create trigger trg_installments_updated_at
before update on public.installments
for each row execute function public.set_updated_at();

-- =========================
-- INDEXES
-- =========================
create index if not exists idx_monthly_controls_user_month on public.monthly_controls(user_id, month_ref);
create index if not exists idx_fixed_expenses_user_id on public.fixed_expenses(user_id);
create index if not exists idx_installments_user_id on public.installments(user_id);
create index if not exists idx_transactions_origin_type on public.transactions(origin_type);
create index if not exists idx_transactions_installment_id on public.transactions(installment_id);
create index if not exists idx_transactions_fixed_expense_id on public.transactions(fixed_expense_id);

-- =========================
-- RLS
-- =========================
alter table public.monthly_controls enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.installments enable row level security;

drop policy if exists "Users can manage own monthly controls" on public.monthly_controls;
create policy "Users can manage own monthly controls"
on public.monthly_controls for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own fixed expenses" on public.fixed_expenses;
create policy "Users can manage own fixed expenses"
on public.fixed_expenses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own installments" on public.installments;
create policy "Users can manage own installments"
on public.installments for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
