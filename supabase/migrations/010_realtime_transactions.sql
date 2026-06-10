-- 010_realtime_transactions.sql
-- Liga o Supabase Realtime na tabela transactions para o site atualizar
-- automaticamente quando lançamentos são criados/alterados/excluídos
-- (ex: pelo WhatsApp). O front (app-data-provider) escuta postgres_changes
-- filtrado por user_id e invalida o cache financeiro ao receber evento.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
  ) then
    execute 'alter publication supabase_realtime add table public.transactions';
  end if;
end $$;

-- REPLICA IDENTITY FULL: garante que eventos de DELETE tragam a linha antiga
-- completa (incluindo user_id), para o filtro do realtime funcionar.
alter table public.transactions replica identity full;
