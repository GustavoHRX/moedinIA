-- 009_whatsapp_onboarding.sql
-- Onboarding por CÓDIGO de ativação (à prova de LID/Business).
-- O usuário pega um código no site e manda pro bot; o bot vincula o
-- identificador do WhatsApp (wa_id = dígitos do remoteJid, seja telefone ou LID)
-- à conta. A resolução passa a olhar primeiro o vínculo, depois o telefone.

-- Código de ativação por usuário (estável, regenerável) --------------------
alter table public.profiles add column if not exists activation_code text;
create unique index if not exists profiles_activation_code_key
  on public.profiles (activation_code) where activation_code is not null;

-- Vínculos WhatsApp ↔ usuário ----------------------------------------------
create table if not exists public.whatsapp_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wa_id text not null,                 -- dígitos do remoteJid (telefone OU lid)
  label text,                          -- pushName, p/ referência
  created_at timestamptz not null default now(),
  unique (wa_id)
);
create index if not exists whatsapp_links_user_id_idx on public.whatsapp_links (user_id);

alter table public.whatsapp_links enable row level security;
drop policy if exists "own wa links" on public.whatsapp_links;
create policy "own wa links" on public.whatsapp_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Gera (ou devolve) o código de ativação do usuário ------------------------
create or replace function public.ensure_activation_code(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(auth.uid(), p_user_id);
  v_code text;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'no_user');
  end if;
  select activation_code into v_code from public.profiles where id = v_uid;
  if v_code is null or v_code = '' then
    -- código de 8 chars, hex maiúsculo (ex: 3DD46944)
    loop
      v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
      begin
        update public.profiles set activation_code = v_code where id = v_uid;
        exit;
      exception when unique_violation then
        -- colisão raríssima: tenta de novo
      end;
    end loop;
  end if;
  return jsonb_build_object('code', v_code);
end;
$$;

-- Vincula um WhatsApp (wa_id) a um usuário pelo código ---------------------
create or replace function public.link_whatsapp_by_code(
  p_code text,
  p_wa_id text,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.profiles%rowtype;
  v_digits text := regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g');
  v_text text := upper(coalesce(p_code, ''));
begin
  if v_digits = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_wa_id');
  end if;

  -- acha o perfil cujo código de ativação aparece na mensagem (token isolado),
  -- para o usuário poder mandar "meu código é XXXX" e não só o código puro.
  select * into v_user from public.profiles
   where activation_code is not null
     and v_text ~ ('\y' || activation_code || '\y')
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  insert into public.whatsapp_links (user_id, wa_id, label)
  values (v_user.id, v_digits, p_label)
  on conflict (wa_id) do update set user_id = excluded.user_id, label = excluded.label;

  return jsonb_build_object('ok', true, 'user_id', v_user.id,
                            'full_name', coalesce(v_user.full_name, ''));
end;
$$;

-- Resolve usuário por wa_id (vínculo) com fallback no telefone -------------
create or replace function public.resolve_user_by_wa(
  p_wa_id text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g');
  v_user public.profiles%rowtype;
begin
  -- 1) vínculo explícito por código
  if v_digits <> '' then
    select p.* into v_user
      from public.whatsapp_links l
      join public.profiles p on p.id = l.user_id
     where l.wa_id = v_digits
     limit 1;
    if found then
      return jsonb_build_object('found', true, 'user_id', v_user.id,
                                'full_name', coalesce(v_user.full_name, ''), 'via', 'link');
    end if;
  end if;

  -- 2) fallback: telefone visível que casa com profiles.phone
  return public.resolve_user_by_phone(coalesce(p_phone, p_wa_id)) || jsonb_build_object('via', 'phone');
end;
$$;

grant execute on function public.ensure_activation_code(uuid)            to anon, authenticated, service_role;
grant execute on function public.link_whatsapp_by_code(text, text, text) to anon, authenticated, service_role;
grant execute on function public.resolve_user_by_wa(text, text)          to anon, authenticated, service_role;
