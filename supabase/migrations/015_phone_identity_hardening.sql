-- 015_phone_identity_hardening.sql
-- AUDITORIA (ago/2026) — item CRÍTICO C-2.
--
-- profiles.phone é digitado livremente no cadastro/perfil e NUNCA é verificado.
-- Não havia índice único e resolve_user_by_phone casava pelos "últimos 10/11
-- dígitos" com `limit 1` SEM `order by`. Consequências:
--   * dois perfis com o mesmo telefone -> o Postgres escolhe um ao acaso; os
--     lançamentos que a pessoa A manda pelo WhatsApp podem cair na conta de B,
--     e o relatório que B pede pode devolver dados de A;
--   * cadastro com o telefone de outra pessoa -> sequestro de identidade no bot.
--
-- Esta migration:
--   1) normaliza os telefones existentes para só dígitos;
--   2) desduplica: mantém o telefone no perfil que mais usa (mais transações,
--      depois mais antigo) e limpa os demais;
--   3) cria índice único parcial no telefone normalizado;
--   4) endurece resolve_user_by_phone: match exato pelos últimos 11 dígitos e
--      retorno "não encontrado" se houver ambiguidade.
--
-- O caminho recomendado de vínculo continua sendo o CÓDIGO DE ATIVAÇÃO
-- (migration 009 / whatsapp_links). O match por telefone permanece apenas como
-- conveniência para quem já tinha telefone confiável cadastrado.

-- 1) Normalização defensiva ------------------------------------------------
update public.profiles
   set phone = nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '')
 where phone is distinct from nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '');

-- 2) Desduplicação --------------------------------------------------------
-- ATENÇÃO (revisão externa de ago/2026): esta etapa APAGA o telefone dos
-- perfis perdedores. Ela é conservadora (mantém quem tem mais transações, e
-- em empate o mais antigo) e o telefone não é usado como credencial depois da
-- etapa 4 — mas ainda assim é perda de dado. ANTES de rodar em produção,
-- inspecione o que será afetado:
--
--   select regexp_replace(phone,'\D','','g') as norm,
--          array_agg(id order by created_at) as perfis, count(*)
--     from public.profiles
--    where phone is not null and regexp_replace(phone,'\D','','g') <> ''
--    group by 1 having count(*) > 1;
--
-- Se o resultado tiver perfis que você NÃO quer limpar, resolva-os à mão e
-- comente o bloco abaixo antes de aplicar.
do $$
declare
  r record;
begin
  for r in
    select regexp_replace(phone, '\D', '', 'g') as norm
    from public.profiles
    where phone is not null and regexp_replace(phone, '\D', '', 'g') <> ''
    group by 1
    having count(*) > 1
  loop
    update public.profiles p
       set phone = null
     where regexp_replace(p.phone, '\D', '', 'g') = r.norm
       and p.id <> (
         select p2.id
         from public.profiles p2
         where regexp_replace(p2.phone, '\D', '', 'g') = r.norm
         order by (select count(*) from public.transactions t where t.user_id = p2.id) desc,
                  p2.created_at asc
         limit 1
       );
    raise notice 'phone dedup: telefone % mantido em 1 perfil, limpo nos demais', r.norm;
  end loop;
end $$;

-- 3) Índice único parcial ----------------------------------------------------
-- IMMUTABLE wrapper: `regexp_replace(text, text, text, text)` (4 args) não é
-- immutable no Postgres, então não pode ir direto num índice. Esta função fixa
-- os argumentos e declara a imutabilidade.
create or replace function public.phone_digits(p text)
returns text
language sql
immutable
strict
as $$ select nullif(regexp_replace(p, '[^0-9]', '', 'g'), '') $$;

create unique index if not exists uq_profiles_phone_digits
  on public.profiles (public.phone_digits(phone))
  where phone is not null;

-- 4) resolve_user_by_phone endurecida -------------------------------------
create or replace function public.resolve_user_by_phone(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_key    text;
  v_count  int;
  v_id     uuid;
  v_name   text;
begin
  -- remove código de país 55 quando presente
  if length(v_digits) > 11 and left(v_digits, 2) = '55' then
    v_digits := right(v_digits, length(v_digits) - 2);
  end if;

  if v_digits = '' or length(v_digits) < 10 then
    return jsonb_build_object('found', false, 'user_id', null, 'full_name', null);
  end if;

  v_key := right(v_digits, 11);

  select count(*) into v_count
  from public.profiles p
  where p.phone is not null
    and right(regexp_replace(p.phone, '\D', '', 'g'), 11) = v_key;

  if v_count <> 1 then
    -- 0 = ninguém; >1 = ambíguo (não deveria ocorrer com o índice único,
    -- mas nunca resolvemos para uma conta no escuro).
    return jsonb_build_object('found', false, 'user_id', null, 'full_name', null);
  end if;

  select p.id, p.full_name into v_id, v_name
  from public.profiles p
  where p.phone is not null
    and right(regexp_replace(p.phone, '\D', '', 'g'), 11) = v_key;

  return jsonb_build_object('found', true, 'user_id', v_id, 'full_name', v_name);
end;
$function$;

-- grants: continua sem anon/authenticated (ver migration 014); só service_role.
revoke execute on function public.resolve_user_by_phone(text) from anon, authenticated;
grant  execute on function public.resolve_user_by_phone(text) to service_role;
