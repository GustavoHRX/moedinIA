-- Extensões úteis
create extension if not exists "pgcrypto";

-- =========================
-- PROFILES
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(150) not null,
  email varchar(255) not null,
  phone varchar(20),
  avatar_url text,
  currency varchar(10) not null default 'BRL',
  timezone varchar(60) not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- CATEGORIES
-- =========================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name varchar(80) not null,
  type varchar(20) not null check (type in ('income', 'expense')),
  color varchar(20),
  icon varchar(50),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================
-- TRANSACTIONS
-- =========================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type varchar(20) not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount >= 0),
  description varchar(255) not null,
  notes text,
  transaction_date date not null,
  competence_month date not null,
  category_id uuid references public.categories(id) on delete set null,
  source varchar(20) not null default 'web' check (source in ('web', 'whatsapp', 'n8n', 'import')),
  external_message_id varchar(120),
  status varchar(20) not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- =========================
-- GOALS
-- =========================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(120) not null,
  target_amount numeric(12,2) not null check (target_amount >= 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  deadline date,
  status varchar(20) not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- BUDGETS
-- =========================
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  month_ref date not null,
  limit_amount numeric(12,2) not null check (limit_amount >= 0),
  alert_percent integer not null default 80 check (alert_percent between 1 and 100),
  created_at timestamptz not null default now()
);

-- =========================
-- AI INSIGHTS
-- =========================
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind varchar(20) not null check (kind in ('warning', 'tip', 'forecast', 'goal')),
  title varchar(120) not null,
  message text not null,
  reference_month date,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================
-- MESSAGE LOGS
-- =========================
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  channel varchar(20) not null check (channel in ('whatsapp', 'web')),
  direction varchar(10) not null check (direction in ('in', 'out')),
  raw_text text,
  parsed_json jsonb,
  external_id varchar(120),
  created_at timestamptz not null default now()
);

-- =========================
-- USER SETTINGS
-- =========================
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  email_notifications boolean not null default true,
  whatsapp_notifications boolean not null default true,
  monthly_report_enabled boolean not null default true,
  dark_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- UPDATED_AT TRIGGER
-- =========================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- =========================
-- INDEXES
-- =========================
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_date on public.transactions(transaction_date);
create index if not exists idx_transactions_competence_month on public.transactions(competence_month);
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_budgets_user_id on public.budgets(user_id);
create index if not exists idx_ai_insights_user_id on public.ai_insights(user_id);
create index if not exists idx_message_logs_user_id on public.message_logs(user_id);

-- =========================
-- RLS
-- =========================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.budgets enable row level security;
alter table public.ai_insights enable row level security;
alter table public.message_logs enable row level security;
alter table public.user_settings enable row level security;

-- PROFILES
create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

-- CATEGORIES
create policy "Users can manage own categories"
on public.categories for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- TRANSACTIONS
create policy "Users can manage own transactions"
on public.transactions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- GOALS
create policy "Users can manage own goals"
on public.goals for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- BUDGETS
create policy "Users can manage own budgets"
on public.budgets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- AI INSIGHTS
create policy "Users can manage own insights"
on public.ai_insights for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- MESSAGE LOGS
create policy "Users can view own message logs"
on public.message_logs for select
using (auth.uid() = user_id);

-- USER SETTINGS
create policy "Users can manage own settings"
on public.user_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);