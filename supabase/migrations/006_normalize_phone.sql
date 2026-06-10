-- 006_normalize_phone.sql
-- Deixa a validação de usuário por telefone (WhatsApp) à prova de formato.
--
-- 1) Normaliza profiles.phone para SÓ DÍGITOS ao inserir/atualizar (cadastro e
--    perfil), removendo máscara "(11) 99999-9999", "+55", espaços, etc.
--    A RPC resolve_user_by_phone já remove o 55 e compara os últimos 10/11
--    dígitos, então guardar só dígitos torna o match estável.
-- 2) Remove o trigger duplicado de criação de profile no auth.users.
-- 3) Padroniza os telefones já existentes.

-- 1) Trigger de normalização ------------------------------------------------
create or replace function public.normalize_profile_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), '');
  return new;
end;
$$;

drop trigger if exists trg_normalize_profile_phone on public.profiles;
create trigger trg_normalize_profile_phone
before insert or update of phone on public.profiles
for each row execute function public.normalize_profile_phone();

-- 2) Remove o trigger/func duplicado (mantemos handle_new_user, que é mais
--    completo — faz update-on-conflict do phone). Não mexe nas policies.
drop trigger if exists on_auth_user_created_profile on auth.users;
drop function if exists public.handle_new_user_profile();

-- 3) Backfill dos telefones já gravados
update public.profiles
   set phone = nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
 where phone is distinct from nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '');
