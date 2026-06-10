-- 005_whatsapp_rpcs.sql
-- Versiona as funções RPC usadas pelo workflow n8n
-- "Moedin.IA - Lançamento por WhatsApp". Elas já existiam no banco mas não
-- estavam em nenhuma migration; este arquivo as documenta para que um
-- `supabase db reset` as recrie igual ao ambiente atual.
--
--   resolve_user_by_phone: liga o número do WhatsApp ao usuário (profiles.id).
--     O telefone é gravado em formatos variados ((11) 99999-9999, 19996409992)
--     e o WhatsApp manda 5511999999999, então comparamos só dígitos, removendo
--     o código de país 55 e casando pelos últimos 10/11 dígitos (cobre o 9º
--     dígito do celular).
--   resolve_category: encontra a categoria do usuário pelo nome (case-insensitive).

create or replace function public.resolve_user_by_phone(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with target as (
    select
      case
        when length(regexp_replace(p_phone, '\D', '', 'g')) > 11
             and left(regexp_replace(p_phone, '\D', '', 'g'), 2) = '55'
        then right(regexp_replace(p_phone, '\D', '', 'g'),
                   length(regexp_replace(p_phone, '\D', '', 'g')) - 2)
        else regexp_replace(p_phone, '\D', '', 'g')
      end as d
  ),
  hit as (
    select p.id, p.full_name
    from public.profiles p, target t
    where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') <> ''
      and (
        right(regexp_replace(p.phone, '\D', '', 'g'), 11) = right(t.d, 11)
        or right(regexp_replace(p.phone, '\D', '', 'g'), 10) = right(t.d, 10)
      )
    limit 1
  )
  select coalesce(
    (select jsonb_build_object('found', true, 'user_id', id, 'full_name', full_name) from hit),
    jsonb_build_object('found', false, 'user_id', null, 'full_name', null)
  );
$function$;

create or replace function public.resolve_category(p_user_id uuid, p_name text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'category_id',
    (select id from public.categories
      where user_id = p_user_id
        and p_name is not null
        and lower(name) = lower(p_name)
      limit 1)
  );
$function$;

grant execute on function public.resolve_user_by_phone(text)       to anon, authenticated, service_role;
grant execute on function public.resolve_category(uuid, text)      to anon, authenticated, service_role;
