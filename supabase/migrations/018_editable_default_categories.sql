-- 018_editable_default_categories.sql
-- REVISÃO EXTERNA (ago/2026) — achado 6.1: a UI deixa editar a COR e o ÍCONE
-- de uma categoria padrão, mas a policy de UPDATE (ver 012b) exige
-- `is_default = false`. Resultado: o update é recusado em silêncio (0 linhas,
-- sem erro) e a tela mostra "Categoria atualizada!" mesmo sem mudar nada.
--
-- Correção: UPDATE passa a valer para QUALQUER categoria do usuário, e um
-- trigger BEFORE UPDATE trava nome / tipo / is_default / user_id nas
-- categorias padrão — só cor e ícone podem mudar. DELETE continua bloqueado
-- para as padrão.
--
-- (O front também passou a conferir as linhas afetadas — não anuncia mais
-- sucesso quando o banco recusa.)

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories"
on public.categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.lock_default_category_identity()
returns trigger
language plpgsql
as $$
begin
  if old.is_default then
    new.name := old.name;
    new.type := old.type;
    new.is_default := true;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_default_category on public.categories;
create trigger trg_lock_default_category
before update on public.categories
for each row execute function public.lock_default_category_identity();
