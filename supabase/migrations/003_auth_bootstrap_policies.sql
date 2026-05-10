-- Ensure authenticated users can bootstrap their app data.

create or replace function public.handle_new_user_profile()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can manage own categories" on public.categories;
create policy "Users can manage own categories"
on public.categories for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
