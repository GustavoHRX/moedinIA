-- 028_realtime_budgets_monthly_controls.sql
-- Completa o Realtime financeiro (010 e 027) com orçamentos e planejamento
-- mensal, para o site atualizar sozinho quando essas linhas mudam por
-- qualquer via (WhatsApp, outra aba, etc).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budgets'
  ) then
    execute 'alter publication supabase_realtime add table public.budgets';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'monthly_controls'
  ) then
    execute 'alter publication supabase_realtime add table public.monthly_controls';
  end if;
end $$;

-- REPLICA IDENTITY FULL: garante que eventos de DELETE tragam a linha antiga
-- completa (incluindo user_id), para o filtro do realtime funcionar.
alter table public.budgets replica identity full;
alter table public.monthly_controls replica identity full;
