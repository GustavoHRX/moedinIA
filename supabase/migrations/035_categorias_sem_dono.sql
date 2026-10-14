-- 035 — Categorias sem dono (correção de dados, out/2026)
--
-- Em abril de 2026 foram criadas 12 categorias "globais" (user_id nulo). A RLS
-- só mostra a cada usuário as próprias categorias, então essas ficaram
-- invisíveis — mas 17 lançamentos, 2 limites e 1 gasto fixo de 2 usuários ainda
-- apontavam para elas e apareciam "sem categoria" no painel.
--
-- Este script leva cada referência para a categoria do próprio usuário com o
-- mesmo nome ("Contas Fixas" vira "Contas"), cria a categoria padrão quando o
-- usuário ainda não a tinha (mesmos valores de /api/categories/ensure) e só
-- então apaga as globais. Se sobrar qualquer referência, aborta sem alterar nada.
--
-- Aplicado em produção em 13/10/2026, depois de um ensaio com rollback:
-- 17 lançamentos, 1 fixo e 2 limites remapeados; 2 categorias criadas; 12 apagadas.
-- Idempotente: sem categorias de user_id nulo, não faz nada.

do $t$
declare
  ENSAIO constant boolean := false;  -- true = só simula e desfaz
  n_criadas int := 0; n_tx int := 0; n_fx int := 0; n_inst int := 0; n_inc int := 0; n_rules int := 0;
  n_bud_remap int := 0; n_bud_del int := 0; n_resto int; n_glob int;
begin
  -- alvo de cada categoria global: mesmo nome (sem acento/caixa), com dois apelidos antigos
  create temp table _alvo on commit drop as
  select g.id as gid, g.type,
         case public.whatsapp_norm(g.name)
           when 'contas fixas' then 'contas'
           when 'outros' then 'outras despesas'
           else public.whatsapp_norm(g.name) end as nome_norm
    from public.categories g where g.user_id is null;

  create temp table _uso on commit drop as
  select distinct x.user_id, x.category_id as gid from (
    select user_id, category_id from public.transactions
    union all select user_id, category_id from public.budgets
    union all select user_id, category_id from public.fixed_expenses
    union all select user_id, category_id from public.installments
    union all select user_id, category_id from public.fixed_incomes
    union all select user_id, category_id from public.whatsapp_category_rules
  ) x join _alvo a on a.gid = x.category_id;

  -- cria a categoria padrão que o usuário ainda não tem (mesmos valores da rota /api/categories/ensure)
  insert into public.categories (user_id, name, type, color, icon, is_default)
  select u.user_id, d.name, d.type, d.color, d.icon, true
    from _uso u join _alvo a on a.gid = u.gid
    join (values
      ('Salário','income','Banknote','#34D399'),('Freelance','income','Laptop','#60A5FA'),
      ('Reembolso','income','Undo2','#14B8A6'),('Investimentos','income','TrendingUp','#6EE7B7'),
      ('Outras receitas','income','CirclePlus','#94A3B8'),('Alimentação','expense','Utensils','#FB923C'),
      ('Mercado','expense','ShoppingCart','#10B981'),('Transporte','expense','Car','#0EA5E9'),
      ('Moradia','expense','House','#818CF8'),('Contas','expense','ReceiptText','#FBBF24'),
      ('Saúde','expense','HeartPulse','#F87171'),('Educação','expense','GraduationCap','#A78BFA'),
      ('Lazer','expense','Gamepad2','#F472B6'),('Outras despesas','expense','Ellipsis','#94A3B8')
    ) as d(name, type, icon, color) on public.whatsapp_norm(d.name) = a.nome_norm and d.type = a.type
   where not exists (select 1 from public.categories o
                      where o.user_id = u.user_id and o.type = a.type
                        and public.whatsapp_norm(o.name) = a.nome_norm);
  get diagnostics n_criadas = row_count;

  create temp table _map on commit drop as
  select u.user_id, u.gid,
         (select o.id from public.categories o
           where o.user_id = u.user_id and o.type = a.type and public.whatsapp_norm(o.name) = a.nome_norm
           order by o.is_default desc, o.created_at limit 1) as oid
    from _uso u join _alvo a on a.gid = u.gid;

  if exists (select 1 from _map where oid is null) then
    raise exception 'há categoria global sem destino; nada foi alterado';
  end if;

  update public.transactions t set category_id = m.oid from _map m where t.user_id = m.user_id and t.category_id = m.gid;
  get diagnostics n_tx = row_count;
  update public.fixed_expenses t set category_id = m.oid from _map m where t.user_id = m.user_id and t.category_id = m.gid;
  get diagnostics n_fx = row_count;
  update public.installments t set category_id = m.oid from _map m where t.user_id = m.user_id and t.category_id = m.gid;
  get diagnostics n_inst = row_count;
  update public.fixed_incomes t set category_id = m.oid from _map m where t.user_id = m.user_id and t.category_id = m.gid;
  get diagnostics n_inc = row_count;
  update public.whatsapp_category_rules t set category_id = m.oid from _map m where t.user_id = m.user_id and t.category_id = m.gid;
  get diagnostics n_rules = row_count;

  -- limites: se já existe limite da categoria própria no mesmo mês, o da global é sobra
  delete from public.budgets b using _map m
   where b.user_id = m.user_id and b.category_id = m.gid
     and exists (select 1 from public.budgets b2 where b2.user_id = b.user_id and b2.month_ref = b.month_ref and b2.category_id = m.oid);
  get diagnostics n_bud_del = row_count;
  update public.budgets b set category_id = m.oid from _map m where b.user_id = m.user_id and b.category_id = m.gid;
  get diagnostics n_bud_remap = row_count;

  select count(*) into n_resto from (
    select category_id from public.transactions union all select category_id from public.budgets
    union all select category_id from public.fixed_expenses union all select category_id from public.installments
    union all select category_id from public.fixed_incomes union all select category_id from public.whatsapp_category_rules
  ) x join _alvo a on a.gid = x.category_id;
  if n_resto > 0 then raise exception 'sobraram % referências; nada foi alterado', n_resto; end if;

  delete from public.categories where user_id is null;
  get diagnostics n_glob = row_count;

  if ENSAIO then
    raise exception 'ENSAIO (rollback) | categorias criadas=% | tx=% fixos=% parcel=% rec_fixas=% regras=% | limites remapeados=% apagados=% | referências restantes=% | globais apagadas=%',
      n_criadas, n_tx, n_fx, n_inst, n_inc, n_rules, n_bud_remap, n_bud_del, n_resto, n_glob;
  end if;
  raise notice 'categorias criadas=% tx=% fixos=% limites remap=% apag=% globais apagadas=%', n_criadas, n_tx, n_fx, n_bud_remap, n_bud_del, n_glob;
end $t$;
