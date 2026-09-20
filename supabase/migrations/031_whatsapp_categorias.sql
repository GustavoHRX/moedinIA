-- 031_whatsapp_categorias.sql — agente WhatsApp v2.10 (21/09/2026)
-- Categorias pelo bot: consultar, criar e, quando a pessoa MUDA de categoria, consultar primeiro
-- e criar só se não existir.
--
-- Antes: o prompt mandava o modelo escolher de uma lista FECHADA, e o resolve_category comparava só
-- lower(name), sem olhar acento nem tipo. "Alimentacao" virava uma segunda categoria, uma despesa
-- chamada "Reembolso" reaproveitava a categoria de RECEITA de mesmo nome, e a categoria criada pelo
-- bot ficava sem cor e sem ícone no painel.
--
-- Agora (tudo por usuário, no mesmo padrão do site):
--  * nome comparado sem acento, sem caixa e sem o "s" final, DENTRO do mesmo tipo (despesa/receita);
--  * "Lazr" (parece erro de digitação de "Lazer") não vira categoria nova sozinha: o bot pergunta;
--  * ao criar, escolhe cor da paleta do site (a primeira ainda não usada) e um ícone pelo nome;
--  * teto de 60 categorias próprias por pessoa (proteção contra flood pelo WhatsApp);
--  * whatsapp_category_id (usada por lançamento, fixos, parcelas, importação, limite) passa a usar a
--    mesma resolução, sem a pergunta de erro de digitação (o modelo já escolheu o nome).
-- Não usa extensão nova (a distância de edição é uma função própria). Idempotente. Grant só service_role.

-- ---------------------------------------------------------------------------
-- Helpers puros
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_norm(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(lower(translate(coalesce(p, ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g'));
$$;

-- distância de edição (Levenshtein) para textos curtos
create or replace function public.whatsapp_lev(a text, b text)
returns int
language plpgsql
immutable
set search_path = public
as $$
declare
  la int := length(coalesce(a, ''));
  lb int := length(coalesce(b, ''));
  prev int[]; curr int[]; i int; j int; custo int;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  prev := array(select generate_series(0, lb));
  for i in 1..la loop
    curr := array[i];
    for j in 1..lb loop
      custo := case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end;
      curr := curr || least(prev[j + 1] + 1, curr[j] + 1, prev[j] + custo);
    end loop;
    prev := curr;
  end loop;
  return prev[lb + 1];
end;
$$;

-- ícone (chave do Lucide usada pelo site) escolhido pelo nome da categoria
create or replace function public.whatsapp_category_icon(p_name text, p_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when n ~ '(pet|cachorro|gato|racao|veterin|animal)' then 'PawPrint'
    when n ~ '(academia|treino|esporte|fitness|crossfit|pilates|muscula)' then 'Dumbbell'
    when n ~ '(viagem|viagens|passagem|hotel|turismo|ferias|hospedagem)' then 'Plane'
    when n ~ '(roupa|vestuario|moda|calcado|sapato|tenis)' then 'Shirt'
    when n ~ '(presente|doacao|doacoes|caridade|dizimo)' then 'Gift'
    when n ~ '(crianca|bebe|filho|filha|fralda|creche)' then 'Baby'
    when n ~ '(internet|wifi|telefone|plano de celular)' then 'Wifi'
    when n ~ '(celular|smartphone|eletronico|gadget)' then 'Smartphone'
    when n ~ '(assinatura|streaming|netflix|spotify|musica|show|cinema|teatro|festa)' then 'Music'
    when n ~ '(cafe|cafeteria|padaria|lanche)' then 'Coffee'
    when n ~ '(restaurante|ifood|delivery|comida|bar|pizza|churrasco|almoco|jantar)' then 'Utensils'
    when n ~ '(compra|shopping|loja|shopee|amazon|mercado livre)' then 'ShoppingBag'
    when n ~ '(mercado|supermercado|feira|hortifruti|acougue)' then 'ShoppingCart'
    when n ~ '(onibus|metro|trem|passe)' then 'Bus'
    when n ~ '(carro|combustivel|gasolina|estacionamento|pedagio|uber|taxi|moto|oficina|mecanico|seguro auto)' then 'Car'
    when n ~ '(beleza|salao|cabelo|estetica|maquiagem|barbearia|cosmetico|unha)' then 'Sparkles'
    when n ~ '(cartao|fatura|emprestimo|financiamento|divida)' then 'CreditCard'
    when n ~ '(saude|medico|farmacia|dentista|remedio|terapia|psicolog|exame|plano de saude)' then 'HeartPulse'
    when n ~ '(curso|livro|faculdade|escola|estudo|mensalidade)' then 'GraduationCap'
    when n ~ '(jogo|game|games|videogame)' then 'Gamepad2'
    when n ~ '(casa|aluguel|condominio|reforma|movel|moveis)' then 'House'
    when n ~ '(conta|boleto|imposto|taxa|luz|agua|gas|iptu|ipva)' then 'ReceiptText'
    when p_type = 'income' and n ~ '(freela|bico|renda extra|venda|comissao|servico)' then 'Briefcase'
    when p_type = 'income' and n ~ '(investimento|rendimento|dividendo|juros|acoes)' then 'TrendingUp'
    when p_type = 'income' and n ~ '(salario|pagamento|ordenado)' then 'Banknote'
    when p_type = 'income' and n ~ '(poupanca|reserva|guardado|cofrinho)' then 'PiggyBank'
    when p_type = 'income' and n ~ '(reembolso|estorno|devolucao)' then 'Undo2'
    when p_type = 'income' then 'CirclePlus'
    else 'Tag'
  end
  from (select public.whatsapp_norm(p_name) as n) s;
$$;

-- cor: primeira da paleta do site que a pessoa ainda não usa (cai no rodízio se todas estiverem em uso)
create or replace function public.whatsapp_category_color(p_user_id uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_paleta text[] := array['#10B981','#34D399','#6EE7B7','#14B8A6','#2DD4BF','#A3E635','#FBBF24','#FB923C',
                           '#F87171','#F472B6','#A78BFA','#818CF8','#60A5FA','#0EA5E9','#FACC15','#94A3B8'];
  v_cor text; v_total int;
begin
  foreach v_cor in array v_paleta loop
    if not exists (select 1 from public.categories where user_id = p_user_id and upper(color) = v_cor) then
      return v_cor;
    end if;
  end loop;
  select count(*) into v_total from public.categories where user_id = p_user_id;
  return v_paleta[(v_total % array_length(v_paleta, 1)) + 1];
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolução: acha a categoria da pessoa; se não existir, cria
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_resolve_category(
  p_user_id uuid,
  p_name text,
  p_type text,
  p_forcar boolean default false     -- true = não pergunta por nome parecido, cria direto
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := case when p_type = 'income' then 'income' else 'expense' end;
  v_raw text;
  v_norm text;
  v_id uuid; v_nome text; v_close text; v_count int; v_cor text; v_icone text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  v_raw := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]+', ' ', 'g')), 40);
  if v_raw = '' or lower(v_raw) in ('null', 'none', 'sem categoria') then
    v_raw := case when v_type = 'income' then 'Outras receitas' else 'Outras despesas' end;
  end if;
  v_norm := public.whatsapp_norm(v_raw);

  -- 1) já existe? (mesmo tipo, sem acento/caixa, e com ou sem o "s" final)
  select id, name into v_id, v_nome from public.categories
   where user_id = p_user_id and type = v_type
     and (public.whatsapp_norm(name) = v_norm
          or (length(v_norm) >= 3 and regexp_replace(public.whatsapp_norm(name), 's$', '') = regexp_replace(v_norm, 's$', '')))
   order by is_default desc, created_at limit 1;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'nome', v_nome, 'criada', false);
  end if;

  -- 2) parece erro de digitação de uma que existe? pergunta em vez de criar lixo
  if not coalesce(p_forcar, false) and length(v_norm) >= 4 then
    select string_agg(x.name, ', ' order by x.d) into v_close from (
      select c.name, public.whatsapp_lev(public.whatsapp_norm(c.name), v_norm) as d
        from public.categories c
       where c.user_id = p_user_id and c.type = v_type
         and public.whatsapp_lev(public.whatsapp_norm(c.name), v_norm) <= case when length(v_norm) >= 8 then 2 else 1 end
       order by d limit 3) x;
    if v_close is not null then
      return jsonb_build_object('ok', false, 'ambigua', true, 'parecidas', v_close,
        'mensagem', '🤔 Não achei a categoria *' || v_raw || '*, mas você tem *' || v_close || '*. Foi essa que quis dizer? ' ||
                    'Se *' || v_raw || '* é uma categoria nova mesmo, diga "cria a categoria ' || v_raw || '".');
    end if;
  end if;

  -- 3) cria (com teto e sem corrida entre duas mensagens seguidas)
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_type || v_norm, 0));
  select id, name into v_id, v_nome from public.categories
   where user_id = p_user_id and type = v_type and public.whatsapp_norm(name) = v_norm limit 1;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'nome', v_nome, 'criada', false);
  end if;

  select count(*) into v_count from public.categories where user_id = p_user_id and not is_default;
  if v_count >= 60 then
    return jsonb_build_object('ok', false,
      'mensagem', 'Você já tem 60 categorias próprias, que é o limite. Apague alguma no painel para criar outra.');
  end if;

  v_nome := upper(left(v_raw, 1)) || substr(v_raw, 2);
  v_cor := public.whatsapp_category_color(p_user_id);
  v_icone := public.whatsapp_category_icon(v_nome, v_type);
  insert into public.categories (user_id, name, type, color, icon, is_default)
  values (p_user_id, v_nome, v_type, v_cor, v_icone, false)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'nome', v_nome, 'criada', true, 'cor', v_cor, 'icone', v_icone);
end;
$$;

-- a função usada por lançamento, fixos, parcelas, importação e limite passa a usar a mesma resolução
create or replace function public.whatsapp_category_id(
  p_user_id uuid,
  p_name text,
  p_type text
)
returns uuid
language sql
security definer
set search_path = public
as $$
  -- nunca devolve nulo: se não der para achar nem criar (ex.: teto de 60 categorias), cai em "Outras"
  select coalesce(
    (public.whatsapp_resolve_category(p_user_id, p_name, p_type, true) ->> 'id')::uuid,
    (public.whatsapp_resolve_category(p_user_id, null, p_type, true) ->> 'id')::uuid);
$$;

-- ---------------------------------------------------------------------------
-- Ferramentas do bot
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_list_categories(
  p_user_id uuid,
  p_tipo text default 'ambas',
  p_busca text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text := case when p_tipo in ('expense', 'income') then p_tipo else 'ambas' end;
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_norm text;
  v_desp text; v_rec text; v_proprias int; v_msg text; v_ex text; v_par text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  -- consulta por nome: "existe categoria Pets?"
  if v_busca is not null then
    v_norm := public.whatsapp_norm(v_busca);
    select string_agg('*' || name || '* (' || case type when 'income' then 'receita' else 'despesa' end || ')', ', ' order by type, name)
      into v_ex from public.categories
     where user_id = p_user_id and (v_tipo = 'ambas' or type = v_tipo)
       and (public.whatsapp_norm(name) = v_norm
            or (length(v_norm) >= 3 and regexp_replace(public.whatsapp_norm(name), 's$', '') = regexp_replace(v_norm, 's$', '')));
    if v_ex is not null then
      return jsonb_build_object('ok', true, 'existe', true, 'categorias', v_ex,
        'mensagem', '✅ Você tem a categoria ' || v_ex || '.');
    end if;
    select string_agg('*' || name || '*', ', ' order by name) into v_par from public.categories
     where user_id = p_user_id and (v_tipo = 'ambas' or type = v_tipo)
       and length(v_norm) >= 3
       and (public.whatsapp_norm(name) like '%' || v_norm || '%'
            or v_norm like '%' || public.whatsapp_norm(name) || '%'
            or public.whatsapp_lev(public.whatsapp_norm(name), v_norm) <= case when length(v_norm) >= 8 then 2 else 1 end);
    return jsonb_build_object('ok', true, 'existe', false, 'parecidas', v_par,
      'mensagem', '🤔 Você não tem a categoria *' || v_busca || '*.' ||
                  case when v_par is not null then E'\n' || 'Parecidas: ' || v_par || '.' else '' end || E'\n' ||
                  'Quer que eu crie? Diga "cria a categoria ' || v_busca || '".');
  end if;

  -- lista completa
  select string_agg(name || case when is_default then '' else ' ✨' end, ' · ' order by is_default desc, name)
    into v_desp from public.categories where user_id = p_user_id and type = 'expense';
  select string_agg(name || case when is_default then '' else ' ✨' end, ' · ' order by is_default desc, name)
    into v_rec from public.categories where user_id = p_user_id and type = 'income';
  select count(*) into v_proprias from public.categories where user_id = p_user_id and not is_default;

  v_msg := '🏷️ *Suas categorias*' ||
           case when v_tipo in ('ambas', 'expense') then E'\n\n' || '💸 *Despesas*' || E'\n' || coalesce(v_desp, 'nenhuma ainda') else '' end ||
           case when v_tipo in ('ambas', 'income') then E'\n\n' || '💵 *Receitas*' || E'\n' || coalesce(v_rec, 'nenhuma ainda') else '' end ||
           case when v_proprias > 0 then E'\n\n' || '✨ = criada por você' else '' end || E'\n\n' ||
           'Para criar outra, diga "cria a categoria Pets".';
  return jsonb_build_object('ok', true, 'despesas', v_desp, 'receitas', v_rec, 'proprias', v_proprias, 'mensagem', v_msg);
end;
$$;

create or replace function public.whatsapp_create_category(
  p_user_id uuid,
  p_name text,
  p_tipo text default 'expense',
  p_forcar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text := case when p_tipo = 'income' then 'income' else 'expense' end;
  v_res jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Qual o nome da categoria que você quer criar?');
  end if;
  v_res := public.whatsapp_resolve_category(p_user_id, p_name, v_tipo, coalesce(p_forcar, false));
  if not coalesce((v_res ->> 'ok')::boolean, false) then return v_res; end if;
  return v_res || jsonb_build_object('mensagem',
    case when (v_res ->> 'criada')::boolean
         then '🆕 Categoria *' || (v_res ->> 'nome') || '* criada (' || case v_tipo when 'income' then 'receita' else 'despesa' end ||
              '). Já aparece no painel e pode usar nos lançamentos.'
         else 'Você já tem a categoria *' || (v_res ->> 'nome') || '* (' || case v_tipo when 'income' then 'receita' else 'despesa' end || ').' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trocar a categoria de um lançamento: consulta primeiro, cria se não existir
-- ---------------------------------------------------------------------------
drop function if exists public.whatsapp_set_category(uuid, text, text, boolean);
drop function if exists public.whatsapp_update_transaction(uuid, text, numeric, text, date, text, text);

create or replace function public.whatsapp_set_category(
  p_user_id uuid,
  p_alvo text,
  p_categoria text,
  p_lembrar boolean default true,
  p_forcar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_tx public.transactions%rowtype;
  v_cat uuid;
  v_cat_name text;
  v_pattern text;
  v_res jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if btrim(coalesce(p_categoria, '')) = '' then
    return jsonb_build_object('ok', false, 'mensagem', 'Qual categoria você quer usar?');
  end if;

  if v_alvo = '' or v_alvo ~ '(ultim|último|ultimo|mais recente)' then
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active' order by created_at desc limit 1;
  elsif v_alvo ~ '^[0-9a-f]{4,}$' then
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active' and id::text like v_alvo || '%'
     order by created_at desc limit 1;
    if v_tx.id is null then
      select * into v_tx from public.transactions
       where user_id = p_user_id and status = 'active' and lower(coalesce(description, '')) like '%' || v_alvo || '%'
       order by created_at desc limit 1;
    end if;
  else
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active'
       and lower(coalesce(description, '')) like '%' || v_alvo || '%'
     order by created_at desc limit 1;
  end if;
  if v_tx.id is null then
    return jsonb_build_object('ok', false, 'mensagem', '🤔 Não encontrei um lançamento com "' || coalesce(p_alvo, '') || '" para mudar a categoria.');
  end if;

  v_res := public.whatsapp_resolve_category(p_user_id, p_categoria, v_tx.type, coalesce(p_forcar, false));
  if not coalesce((v_res ->> 'ok')::boolean, false) then return v_res; end if;
  v_cat := (v_res ->> 'id')::uuid;
  v_cat_name := v_res ->> 'nome';
  update public.transactions set category_id = v_cat, updated_at = now() where id = v_tx.id;

  if coalesce(p_lembrar, true) then
    v_pattern := lower(btrim(coalesce(v_tx.description, '')));
    if length(v_pattern) >= 3 then
      insert into public.whatsapp_category_rules (user_id, pattern, category_id)
      values (p_user_id, v_pattern, v_cat)
      on conflict (user_id, pattern) do update set category_id = excluded.category_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_tx.id, 'categoria', v_cat_name, 'categoria_criada', (v_res ->> 'criada')::boolean,
    'mensagem', case when (v_res ->> 'criada')::boolean then '🆕 Criei a categoria *' || v_cat_name || '* (não existia).' || E'\n' else '' end ||
                '🏷️ "' || coalesce(v_tx.description, 'Lançamento') || '" (R$ ' || public.money_br(v_tx.amount) ||
                ') agora está em *' || v_cat_name || '*.' ||
                case when coalesce(p_lembrar, true) and length(coalesce(v_pattern, '')) >= 3
                     then E'\n' || '🧠 Vou lembrar: ' || v_tx.description || ' → ' || v_cat_name || '.' else '' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Editar lançamento (030) com a mesma regra: consulta a categoria e cria se não existir
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_update_transaction(
  p_user_id uuid,
  p_alvo text,
  p_amount numeric default null,
  p_description text default null,
  p_date date default null,
  p_category text default null,
  p_type text default null,
  p_forcar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo text := lower(btrim(coalesce(p_alvo, '')));
  v_tx public.transactions%rowtype;
  v_n int;
  v_lista text;
  v_desc text := nullif(left(btrim(coalesce(p_description, '')), 255), '');
  v_cat text := nullif(btrim(coalesce(p_category, '')), '');
  v_type text;
  v_cat_id uuid;
  v_cat_old text;
  v_cat_new text;
  v_new_date date;
  v_mud text := '';
  v_res jsonb;
  v_criada boolean := false;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_amount is null and v_desc is null and p_date is null and v_cat is null and p_type is null then
    return jsonb_build_object('ok', false,
      'mensagem', 'O que quer mudar: o valor, a descrição, a data ou a categoria?');
  end if;
  if p_amount is not null and p_amount <= 0 then
    return jsonb_build_object('ok', false, 'mensagem', 'O valor precisa ser maior que zero.');
  end if;
  if p_date is not null and p_date > public.whatsapp_today() then
    return jsonb_build_object('ok', false, 'mensagem', 'Não lanço com data no futuro. Qual a data certa?');
  end if;
  if p_type is not null and p_type not in ('income', 'expense') then
    return jsonb_build_object('ok', false, 'mensagem', 'O tipo é "gasto" ou "receita".');
  end if;

  -- resolver o alvo
  if v_alvo = '' or v_alvo ~ '(ultim|último|mais recente)' then
    select * into v_tx from public.transactions
     where user_id = p_user_id and status = 'active'
     order by created_at desc limit 1;
  else
    if v_alvo ~ '^[0-9a-f]{4,}$' then
      select * into v_tx from public.transactions
       where user_id = p_user_id and status = 'active' and id::text like v_alvo || '%'
       order by created_at desc limit 1;
    end if;
    if v_tx.id is null then
      select count(*) into v_n from public.transactions
       where user_id = p_user_id and status = 'active'
         and lower(coalesce(description, '')) like '%' || v_alvo || '%';
      if v_n > 1 then
        select string_agg(x.linha, E'\n' order by x.rn) into v_lista from (
          select row_number() over (order by created_at desc) as rn,
                 row_number() over (order by created_at desc) || '. (' || to_char(transaction_date, 'DD/MM') || ') ' ||
                 coalesce(nullif(description, ''), 'Lançamento') || ' — R$ ' || public.money_br(amount) ||
                 ' [' || left(id::text, 8) || ']' as linha
            from public.transactions
           where user_id = p_user_id and status = 'active'
             and lower(coalesce(description, '')) like '%' || v_alvo || '%'
           order by created_at desc limit 5) x;
        return jsonb_build_object('ok', false, 'ambiguo', true, 'encontrados', v_n,
          'mensagem', 'Encontrei ' || v_n || ' lançamentos com "' || p_alvo || '":' || E'\n' || v_lista ||
                      E'\n' || 'Qual deles quer alterar?');
      end if;
      select * into v_tx from public.transactions
       where user_id = p_user_id and status = 'active'
         and lower(coalesce(description, '')) like '%' || v_alvo || '%'
       order by created_at desc limit 1;
    end if;
  end if;

  if v_tx.id is null then
    return jsonb_build_object('ok', false, 'encontrados', 0,
      'mensagem', '🤔 Não encontrei um lançamento com "' || coalesce(p_alvo, '') ||
                  '". Diga "o último" ou uma palavra da descrição.');
  end if;

  if v_tx.origin_type <> 'manual' then
    return jsonb_build_object('ok', false, 'origem', v_tx.origin_type,
      'mensagem', case when v_tx.origin_type = 'installment'
        then 'Esse lançamento é uma parcela de um parcelamento, então não edito parcela solta. Se o parcelamento está errado, me diga para excluí-lo e criar de novo.'
        else 'Esse lançamento vem de um gasto ou receita fixa. Para mudar o valor ou o dia, diga por exemplo "muda o valor da internet pra 130": vale para as próximas ocorrências.' end);
  end if;

  v_type := coalesce(p_type, v_tx.type);
  v_new_date := coalesce(p_date, v_tx.transaction_date);

  if v_cat is not null then
    -- consulta primeiro; só cria se não existir (e avisa se o nome parece erro de digitação)
    v_res := public.whatsapp_resolve_category(p_user_id, v_cat, v_type, coalesce(p_forcar, false));
    if not coalesce((v_res ->> 'ok')::boolean, false) then return v_res; end if;
    v_cat_id := (v_res ->> 'id')::uuid;
    v_criada := coalesce((v_res ->> 'criada')::boolean, false);
  elsif v_type <> v_tx.type then
    v_cat_id := public.whatsapp_category_id(p_user_id, null, v_type);
  else
    v_cat_id := v_tx.category_id;
  end if;

  select name into v_cat_old from public.categories where id = v_tx.category_id;
  select name into v_cat_new from public.categories where id = v_cat_id;

  if p_amount is not null and round(p_amount, 2) <> v_tx.amount then
    v_mud := v_mud || '• Valor: R$ ' || public.money_br(v_tx.amount) || ' → *R$ ' || public.money_br(p_amount) || '*' || E'\n'; end if;
  if v_desc is not null and v_desc <> coalesce(v_tx.description, '') then
    v_mud := v_mud || '• Descrição: ' || coalesce(nullif(v_tx.description, ''), '—') || ' → *' || v_desc || '*' || E'\n'; end if;
  if v_new_date <> v_tx.transaction_date then
    v_mud := v_mud || '• Data: ' || to_char(v_tx.transaction_date, 'DD/MM') || ' → *' || to_char(v_new_date, 'DD/MM') || '*' || E'\n'; end if;
  if v_type <> v_tx.type then
    v_mud := v_mud || '• Tipo: ' || case v_tx.type when 'income' then 'receita' else 'gasto' end ||
             ' → *' || case v_type when 'income' then 'receita' else 'gasto' end || '*' || E'\n'; end if;
  if v_cat_id is distinct from v_tx.category_id then
    v_mud := v_mud || '• Categoria: ' || coalesce(v_cat_old, '—') || ' → *' || coalesce(v_cat_new, '—') || '*' || E'\n'; end if;

  if v_mud = '' then
    return jsonb_build_object('ok', true, 'sem_mudanca', true, 'id', v_tx.id,
      'mensagem', 'Já estava assim — nada para mudar em ' || coalesce(nullif(v_tx.description, ''), 'Lançamento') || '.');
  end if;

  update public.transactions
     set amount = coalesce(round(p_amount, 2), amount),
         description = coalesce(v_desc, description),
         transaction_date = v_new_date,
         competence_month = date_trunc('month', v_new_date)::date,
         type = v_type,
         category_id = v_cat_id,
         updated_at = now()
   where id = v_tx.id;

  return jsonb_build_object('ok', true, 'id', v_tx.id,
    'mensagem', '✏️ *Lançamento atualizado*' || E'\n' ||
                '📝 ' || coalesce(v_desc, nullif(v_tx.description, ''), 'Lançamento') || E'\n' ||
                rtrim(v_mud, E'\n') ||
                case when v_criada then E'\n' || '🆕 Criei a categoria *' || v_cat_new || '* (não existia).' else '' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões: só a service_role (n8n)
-- ---------------------------------------------------------------------------
revoke all on function public.whatsapp_norm(text) from public, anon, authenticated;
revoke all on function public.whatsapp_lev(text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_category_icon(text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_category_color(uuid) from public, anon, authenticated;
revoke all on function public.whatsapp_resolve_category(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.whatsapp_category_id(uuid, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_list_categories(uuid, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_create_category(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.whatsapp_set_category(uuid, text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public.whatsapp_update_transaction(uuid, text, numeric, text, date, text, text, boolean) from public, anon, authenticated;

grant execute on function public.whatsapp_norm(text) to service_role;
grant execute on function public.whatsapp_lev(text, text) to service_role;
grant execute on function public.whatsapp_category_icon(text, text) to service_role;
grant execute on function public.whatsapp_category_color(uuid) to service_role;
grant execute on function public.whatsapp_resolve_category(uuid, text, text, boolean) to service_role;
grant execute on function public.whatsapp_category_id(uuid, text, text) to service_role;
grant execute on function public.whatsapp_list_categories(uuid, text, text) to service_role;
grant execute on function public.whatsapp_create_category(uuid, text, text, boolean) to service_role;
grant execute on function public.whatsapp_set_category(uuid, text, text, boolean, boolean) to service_role;
grant execute on function public.whatsapp_update_transaction(uuid, text, numeric, text, date, text, text, boolean) to service_role;
