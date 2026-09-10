-- 026_whatsapp_identity_hardening.sql — 10/09/2026
--
-- ACHADO (revisão do fluxo login ↔ primeira mensagem): o celular do cadastro é
-- OPCIONAL e NUNCA verificado, mas `resolve_user_by_wa` caía nele quando não
-- havia vínculo por código. Consequência prática: quem digitasse o número de
-- outra pessoa no próprio perfil passava a receber os lançamentos dela, e o
-- "quanto gastei esse mês" dessa pessoa voltava com os dados de quem digitou.
-- O índice único `uq_profiles_phone_digits` (migration 015) garante um dono por
-- número, então valia quem cadastrasse primeiro — um sequestro de identidade
-- por digitação, sem nenhuma prova de posse do WhatsApp.
--
-- Correção: a identidade do WhatsApp passa a vir SÓ do vínculo explícito por
-- código (`whatsapp_links`), que é a única prova real de posse do número —
-- a pessoa precisa estar logada no painel para ver o código E ter o aparelho
-- para mandá-lo. `resolve_user_by_phone` continua existindo (usada em nada
-- hoje), mas sai do caminho de identificação.
--
-- Junto vêm as duas peças que faltavam para o usuário se defender sozinho:
-- regenerar o código (se vazou num print) e desvincular o WhatsApp (se perdeu
-- o aparelho). Ambas só operam sobre a própria conta: usam auth.uid() e NÃO
-- aceitam user_id por parâmetro.
--
-- Também corrige `whatsapp_goal_bar`, que subiu na migration 025 sem
-- `set search_path` (aviso do advisor de segurança do Supabase).
--
-- Idempotente. Não apaga dados.

-- ---------------------------------------------------------------------------
-- 1. Vínculo: quando foi feito (sinal de segurança no painel)
-- ---------------------------------------------------------------------------
alter table public.whatsapp_links add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. Identidade só por vínculo explícito
-- ---------------------------------------------------------------------------
-- Assinatura preservada (o workflow do n8n continua mandando p_phone); o
-- parâmetro é ignorado de propósito e documentado como tal.
create or replace function public.resolve_user_by_wa(
  p_wa_id text,
  p_phone text default null   -- IGNORADO desde a migration 026 (ver cabeçalho)
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_wa_id, ''), '\D', '', 'g');
  v_user public.profiles%rowtype;
begin
  if v_digits = '' then
    return jsonb_build_object('found', false, 'user_id', null, 'full_name', null, 'via', 'none');
  end if;

  select p.* into v_user
    from public.whatsapp_links l
    join public.profiles p on p.id = l.user_id
   where l.wa_id = v_digits
   limit 1;

  if found then
    return jsonb_build_object('found', true, 'user_id', v_user.id,
                              'full_name', coalesce(v_user.full_name, ''), 'via', 'link');
  end if;

  -- Sem vínculo = desconhecido. NÃO cai mais no telefone do perfil.
  return jsonb_build_object('found', false, 'user_id', null, 'full_name', null, 'via', 'none');
end;
$$;

-- Vincular por código: passa a registrar quando (re)vinculou e a avisar se o
-- número já pertencia a outra conta (troca de dono é legítima, mas fica visível).
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
  v_antigo uuid;
begin
  if v_digits = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_wa_id');
  end if;

  -- o código pode vir dentro de uma frase ("meu código é XXXXXXXX")
  select * into v_user from public.profiles
   where activation_code is not null
     and v_text ~ ('\y' || activation_code || '\y')
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  select user_id into v_antigo from public.whatsapp_links where wa_id = v_digits;

  insert into public.whatsapp_links (user_id, wa_id, label, updated_at)
  values (v_user.id, v_digits, p_label, now())
  on conflict (wa_id) do update
    set user_id = excluded.user_id, label = excluded.label, updated_at = now();

  return jsonb_build_object('ok', true, 'user_id', v_user.id,
                            'full_name', coalesce(v_user.full_name, ''),
                            'trocou_de_conta', (v_antigo is not null and v_antigo <> v_user.id));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Defesas do próprio usuário (site, logado). Só mexem na conta de auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_activation_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    begin
      update public.profiles set activation_code = v_code, updated_at = now() where id = v_uid;
      exit;
    exception when unique_violation then
      -- colisão raríssima: tenta de novo
    end;
  end loop;
  return jsonb_build_object('ok', true, 'code', v_code);
end;
$$;

create or replace function public.whatsapp_unlink()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  delete from public.whatsapp_links where user_id = v_uid;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'removidos', v_n);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Correção do advisor: whatsapp_goal_bar subiu sem search_path na 025
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_goal_bar(p_cur numeric, p_target numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select repeat('▰', least(10, floor(case when p_target > 0 then p_cur / p_target * 10 else 0 end)::int)) ||
         repeat('▱', greatest(0, 10 - least(10, floor(case when p_target > 0 then p_cur / p_target * 10 else 0 end)::int))) ||
         ' ' || round(case when p_target > 0 then p_cur / p_target * 100 else 0 end) || '%';
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
-- Identificação e vínculo: só o n8n (service_role).
revoke all on function public.resolve_user_by_wa(text, text) from public, anon, authenticated;
grant execute on function public.resolve_user_by_wa(text, text) to service_role;
revoke all on function public.link_whatsapp_by_code(text, text, text) from public, anon, authenticated;
grant execute on function public.link_whatsapp_by_code(text, text, text) to service_role;

-- Defesas do usuário: só quem está logado, e só na própria conta (auth.uid()).
revoke all on function public.regenerate_activation_code() from public, anon;
grant execute on function public.regenerate_activation_code() to authenticated;
revoke all on function public.whatsapp_unlink() from public, anon;
grant execute on function public.whatsapp_unlink() to authenticated;

revoke all on function public.whatsapp_goal_bar(numeric, numeric) from public, anon, authenticated;
grant execute on function public.whatsapp_goal_bar(numeric, numeric) to service_role;
