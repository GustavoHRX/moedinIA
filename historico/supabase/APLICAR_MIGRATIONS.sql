-- =============================================================================
-- Moedin.IA — migrations da auditoria (012b, 014–021), consolidadas.
-- Cole TUDO isto no SQL Editor do Supabase e clique em RUN uma vez.
-- O Supabase roda como uma transação: se qualquer passo falhar, NADA é aplicado.
--
-- ANTES: rode primeiro a query de inspeção que está no arquivo
--        015_phone_identity_hardening.sql (bloco comentado "ANTES: inspecione")
--        para ver quais perfis perderiam o telefone na desduplicação.
--
-- Este script NÃO registra as migrations na tabela supabase_migrations —
-- se você usa a CLI, rode depois: supabase migration repair --status applied <versao>
-- (ou ignore, se administra o banco pelo painel).
-- =============================================================================


-- ####################################################################
-- ## 012b_policy_baseline.sql
-- ####################################################################

-- 012b_policy_baseline.sql
-- REVISÃO EXTERNA (ago/2026) — achado 7.1: a migration 013 faz `alter policy`
-- em CINCO policies que nenhuma migration cria (foram feitas à mão no painel):
--
--   categories:    "Users can view own categories" / "Users can insert own categories"
--   user_settings: "Users can view own settings" / "Users can update own settings"
--                  / "Users can insert own settings"
--
-- Num banco novo (`supabase db reset`) a 013 abortava com "policy does not
-- exist". Este arquivo cria essas policies ANTES da 013 (ordena entre
-- 012_... e 013_...). Em produção é no-op — as policies já existem, então o
-- `drop ... if exists` + `create` só as recria idênticas.
--
-- As policies FOR ALL originais da 001 ("Users can manage own ...") são
-- substituídas pelas granulares (SELECT/INSERT/UPDATE/DELETE separadas), que é
-- o estado real de produção.

-- categories --------------------------------------------------------------
drop policy if exists "Users can manage own categories" on public.categories;

drop policy if exists "Users can view own categories" on public.categories;
create policy "Users can view own categories"
on public.categories for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own categories" on public.categories;
create policy "Users can insert own categories"
on public.categories for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories"
on public.categories for update
using (auth.uid() = user_id and is_default = false)
with check (auth.uid() = user_id and is_default = false);

drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories"
on public.categories for delete
using (auth.uid() = user_id and is_default = false);

-- user_settings ----------------------------------------------------------
drop policy if exists "Users can manage own settings" on public.user_settings;

drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings"
on public.user_settings for select
using (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
on public.user_settings for update
using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
on public.user_settings for insert
with check (auth.uid() = user_id);


-- ####################################################################
-- ## 014_revoke_anon_rpcs.sql
-- ####################################################################

-- 014_revoke_anon_rpcs.sql
-- AUDITORIA (ago/2026) — item CRÍTICO C-1.
--
-- As migrations 005/007/008 concederam EXECUTE a `anon` (e a `authenticated`)
-- em funções SECURITY DEFINER que recebem um user_id arbitrário. A migration
-- 013 só revogou 3 das funções de WhatsApp; estas 4 continuavam abertas no
-- SQL versionado. Com a chave anônima (pública, embutida no bundle do site)
-- qualquer visitante conseguia:
--   * resolve_user_by_phone      -> descobrir nome + user_id por telefone;
--   * whatsapp_monthly_report    -> ler o extrato mensal de qualquer usuário;
--   * whatsapp_delete_transaction-> apagar lançamentos de qualquer usuário;
--   * resolve_category           -> criar categorias na conta de qualquer usuário.
--
-- O banco de produção já estava corrigido manualmente no painel; esta migration
-- alinha o SQL versionado ao estado seguro para que `supabase db reset`, um
-- ambiente novo ou um restore não reabram a falha.
--
-- Quem PRECISA chamar estas funções é o n8n, sempre com a service_role (que
-- ignora grants). Nenhum papel de usuário final deve ter acesso.

revoke execute on function public.resolve_user_by_phone(text)              from public, anon, authenticated;
revoke execute on function public.resolve_category(uuid, text, text)       from public, anon, authenticated;
revoke execute on function public.whatsapp_monthly_report(uuid, date)      from public, anon, authenticated;
revoke execute on function public.whatsapp_delete_transaction(uuid, text)  from public, anon, authenticated;

-- money_br é só formatação de número (sem acesso a dados) — pode continuar
-- liberada, mas não há motivo para expô-la na API pública.
revoke execute on function public.money_br(numeric)                        from public, anon, authenticated;

-- resolve_category(uuid, text) foi DROPADA pela migration 007 (substituída pela
-- assinatura com 3 argumentos). Num banco novo ela não existe; revogar sem
-- guard quebraria o `db reset`. (Achado da revisão externa de ago/2026.)
do $$
begin
  revoke execute on function public.resolve_category(uuid, text) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  -- resolve_user_by_wa e link_whatsapp_by_code já foram revogados na 013;
  -- reforço defensivo aqui para o caso de a 013 não ter rodado.
  begin
    revoke execute on function public.resolve_user_by_wa(text, text)         from public, anon, authenticated;
  exception when undefined_function then null;
  end;
  begin
    revoke execute on function public.link_whatsapp_by_code(text, text, text) from public, anon, authenticated;
  exception when undefined_function then null;
  end;
end $$;


-- ####################################################################
-- ## 015_phone_identity_hardening.sql
-- ####################################################################

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


-- ####################################################################
-- ## 016_message_logs_retention.sql
-- ####################################################################

-- 016_message_logs_retention.sql
-- AUDITORIA A-7 (LGPD — minimização e retenção).
--
-- message_logs guarda o TEXTO BRUTO das mensagens de WhatsApp (raw_text) e o
-- JSON interpretado (parsed_json), que podem conter dados financeiros e
-- pessoais. Não havia política de descarte. Esta migration:
--   1) cria a função purge_old_message_logs() que apaga registros com mais de
--      180 dias;
--   2) agenda a execução diária via pg_cron, quando a extensão estiver
--      disponível (ativável no painel Supabase: Database > Extensions > pg_cron).
--
-- Se pg_cron não estiver ativo, rode manualmente de tempos em tempos:
--   select public.purge_old_message_logs();

create or replace function public.purge_old_message_logs(p_days integer default 180)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.message_logs
   where created_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_old_message_logs(integer) from anon, authenticated;
grant  execute on function public.purge_old_message_logs(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-message-logs-daily',
      '17 3 * * *',
      $cron$ select public.purge_old_message_logs(180); $cron$
    );
  else
    raise notice 'pg_cron não instalado — agende purge_old_message_logs() manualmente ou ative a extensão.';
  end if;
exception when others then
  raise notice 'não foi possível agendar via pg_cron: %', sqlerrm;
end $$;


-- ####################################################################
-- ## 017_reconcile_schema.sql
-- ####################################################################

-- 017_reconcile_schema.sql
-- AUDITORIA M-1 — reconciliar o SQL versionado com o banco real.
--
-- find_user_id_by_phone(text) existe no banco de produção mas não está em
-- nenhuma migration. É uma função SECURITY DEFINER com o mesmo match frouxo
-- de telefone que a migration 015 corrigiu em resolve_user_by_phone, e não é
-- referenciada por nenhum workflow do n8n nem pelo app. Removida para diminuir
-- superfície de ataque.

drop function if exists public.find_user_id_by_phone(text);


-- ####################################################################
-- ## 018_editable_default_categories.sql
-- ####################################################################

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


-- ####################################################################
-- ## 019_recurrence_uniqueness.sql
-- ####################################################################

-- 019_recurrence_uniqueness.sql
-- REVISÃO EXTERNA (ago/2026) — achado 2.1: nada no banco impede duas execuções
-- concorrentes (duas abas, ou catch-up + modal ao mesmo tempo) de inserirem a
-- MESMA ocorrência de um gasto fixo / parcela / receita fixa. A dedução era
-- feita só no cliente: consulta as existentes, insere as que faltam — sem
-- travamento entre o "consulta" e o "insere".
--
-- Estes índices únicos parciais garantem, no banco, "no máximo UMA ocorrência
-- ATIVA por origem + competência (ou número da parcela)". Só contam linhas
-- `status = 'active'`: assim os soft-deletes históricos não quebram a criação
-- do índice, e o cliente continua livre para deixar de gerar algo que o
-- usuário apagou (essa lógica olha qualquer status).
--
-- Já existe 1 duplicata real em produção (parcela regenerada após exclusão —
-- achado 2.6): 1 linha 'deleted' + 1 'active'. Como o índice ignora 'deleted',
-- ele sobe sem conflito.

create unique index if not exists uq_tx_fixed_expense_month
  on public.transactions (fixed_expense_id, competence_month)
  where origin_type = 'fixed_expense'
    and status = 'active'
    and fixed_expense_id is not null;

create unique index if not exists uq_tx_installment_number
  on public.transactions (installment_id, installment_number)
  where origin_type = 'installment'
    and status = 'active'
    and installment_id is not null
    and installment_number is not null;

create unique index if not exists uq_tx_fixed_income_month
  on public.transactions (fixed_income_id, competence_month)
  where origin_type = 'fixed_income'
    and status = 'active'
    and fixed_income_id is not null;


-- ####################################################################
-- ## 020_message_idempotency.sql
-- ####################################################################

-- 020_message_idempotency.sql
-- REVISÃO EXTERNA (ago/2026) — achado 3.6: nada garante que uma mensagem de
-- WhatsApp seja processada só uma vez. O workflow compara o TEXTO da última
-- mensagem (duas iguais passam duas vezes), não persiste o id da mensagem no
-- lançamento e não há unicidade no banco. Reenvio, repetição ou concorrência
-- duplicam o gasto.
--
-- `transactions.external_message_id` já existe (migration 001) mas nunca era
-- preenchido. Este índice único torna o id da mensagem a chave de
-- idempotência: o n8n passa a gravar o id e a usar
-- `on_conflict=user_id,external_message_id` + `resolution=ignore-duplicates`,
-- então o segundo processamento da mesma mensagem não cria nada.
--
-- Índice NÃO parcial de propósito: no Postgres, várias linhas com
-- external_message_id NULL não conflitam entre si (lançamentos do site ficam
-- livres), e só os não-nulos (WhatsApp/n8n) são desduplicados. Isso também
-- deixa o `on_conflict` do PostgREST simples.

create unique index if not exists uq_tx_user_external_message
  on public.transactions (user_id, external_message_id);

comment on index public.uq_tx_user_external_message is
  'Idempotência de mensagens WhatsApp — ver migration 020 e o workflow n8n.';


-- ####################################################################
-- ## 021_budget_uniqueness.sql
-- ####################################################################

-- 021_budget_uniqueness.sql
-- REVISÃO EXTERNA (ago/2026) — achado 2.10: `budgets` não tem unicidade por
-- usuário/mês/categoria, e a tela faz "consulta e depois insere". Gravações
-- concorrentes criam orçamentos duplicados e quebram consultas que esperam um
-- único registro (o dashboard usa `budgets.find(...)`).
--
-- `monthly_controls` já tem `unique (user_id, month_ref)` desde a migration 002.
--
-- Dois índices parciais porque `category_id` pode ser NULL (orçamento geral do
-- mês) e NULLs não conflitam entre si num índice comum.

create unique index if not exists uq_budgets_user_month_category
  on public.budgets (user_id, month_ref, category_id)
  where category_id is not null;

create unique index if not exists uq_budgets_user_month_general
  on public.budgets (user_id, month_ref)
  where category_id is null;

