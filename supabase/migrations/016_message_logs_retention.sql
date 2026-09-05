-- 016_message_logs_retention.sql
-- AUDITORIA A-7 (LGPD — minimização e retenção).
--
-- message_logs guarda o TEXTO BRUTO das mensagens de WhatsApp (raw_text) e o
-- JSON interpretado (parsed_json), que podem conter dados financeiros e
-- pessoais. Não havia política de descarte. Esta migration:
--   1) cria a função purge_old_message_logs() que apaga registros com mais de
--      180 dias;
--   2) agenda a execução diária via pg_cron, quando a extensão estiver
--      disponível (ativável no painel Supabase: Database > Extensions > pg_cron).
--
-- Se pg_cron não estiver ativo, rode manualmente de tempos em tempos:
--   select public.purge_old_message_logs();

create or replace function public.purge_old_message_logs(p_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.message_logs
   where created_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_old_message_logs(integer) from anon, authenticated;
grant  execute on function public.purge_old_message_logs(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-message-logs-daily',
      '17 3 * * *',
      $cron$ select public.purge_old_message_logs(180); $cron$
    );
  else
    raise notice 'pg_cron não instalado — agende purge_old_message_logs() manualmente ou ative a extensão.';
  end if;
exception when others then
  raise notice 'não foi possível agendar via pg_cron: %', sqlerrm;
end $$;
