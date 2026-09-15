-- 027_realtime_metas_fixos.sql
-- Estende o Realtime (ligado em transactions na 010) para metas e recorrências
-- fixas, para o site atualizar sozinho quando essas linhas mudam por qualquer
-- via (WhatsApp, outra aba, etc), igual já acontece com lançamentos.
-- O front (app-data-provider) escuta postgres_changes nessas tabelas e
-- invalida o cache financeiro ao receber evento.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'goals'
  ) then
    execute 'alter publication supabase_realtime add table public.goals';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fixed_expenses'
  ) then
    execute 'alter publication supabase_realtime add table public.fixed_expenses';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fixed_incomes'
  ) then
    execute 'alter publication supabase_realtime add table public.fixed_incomes';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'installments'
  ) then
    execute 'alter publication supabase_realtime add table public.installments';
  end if;
end $$;

-- REPLICA IDENTITY FULL: garante que eventos de DELETE tragam a linha antiga
-- completa (incluindo user_id), para o filtro do realtime funcionar.
alter table public.goals replica identity full;
alter table public.fixed_expenses replica identity full;
alter table public.fixed_incomes replica identity full;
alter table public.installments replica identity full;
