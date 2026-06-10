-- 007_resolve_category_create.sql
-- resolve_category passa a CRIAR a categoria do usuário quando ela não existe,
-- usando o tipo (expense/income) informado. Antes só fazia SELECT, então
-- lançamentos de usuários sem categorias pré-criadas ficavam com category_id
-- nulo (ex: usuário que se cadastrou pelo WhatsApp e nunca abriu o app).
-- Os nomes vêm de uma lista fixa do ai-service, então o conjunto é limitado.

drop function if exists public.resolve_category(uuid, text);

create or replace function public.resolve_category(
  p_user_id uuid,
  p_name text,
  p_type text default 'expense'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_type text := case when p_type = 'income' then 'income' else 'expense' end;
begin
  if p_user_id is null or p_name is null or btrim(p_name) = '' then
    return jsonb_build_object('category_id', null);
  end if;

  select id into v_id
    from public.categories
   where user_id = p_user_id
     and lower(name) = lower(btrim(p_name))
   limit 1;

  if v_id is null then
    insert into public.categories (user_id, name, type, is_default)
    values (p_user_id, btrim(p_name), v_type, false)
    returning id into v_id;
  end if;

  return jsonb_build_object('category_id', v_id);
end;
$$;

grant execute on function public.resolve_category(uuid, text, text) to anon, authenticated, service_role;
