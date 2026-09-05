-- 017_reconcile_schema.sql
-- AUDITORIA M-1 — reconciliar o SQL versionado com o banco real.
--
-- find_user_id_by_phone(text) existe no banco de produção mas não está em
-- nenhuma migration. É uma função SECURITY DEFINER com o mesmo match frouxo
-- de telefone que a migration 015 corrigiu em resolve_user_by_phone, e não é
-- referenciada por nenhum workflow do n8n nem pelo app. Removida para diminuir
-- superfície de ataque.

drop function if exists public.find_user_id_by_phone(text);
