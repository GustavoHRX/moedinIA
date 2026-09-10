-- 023_whatsapp_statement_import_alerts.sql
-- Aprimoramentos do agente WhatsApp v2 (09/09/2026):
--   1. whatsapp_import_statement  — importa a fatura de cartão / extrato lido de um PDF
--      (itens ficam em message_logs.parsed_json->'itens' pelo workflow; a RPC lê o
--      último não importado, cria lançamentos avulsos e VINCULA parcelados a
--      installments, sem passar 40 itens de novo pelo modelo).
--   2. whatsapp_monthly_report_v2 — relatório compacto (totais por categoria) com
--      opção de detalhar item por item (formato da 008).
--   3. whatsapp_daily_alerts       — alertas proativos: gasto fixo vencendo hoje e
--      limite mensal >= 80% / estourado, deduplicados por message_logs.
-- Mesmo padrão da 022: security definer, search_path fixo, jsonb {ok, mensagem},
-- grant só para service_role. Idempotente. Não altera tabelas nem apaga dados.

-- ---------------------------------------------------------------------------
-- 1. Importar fatura / extrato (itens extraídos do PDF pelo workflow)
--    p_modo: 'tudo' | 'parcelados' | 'avulsos'
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_import_statement(
  p_user_id uuid,
  p_modo text default 'tudo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modo text := case when p_modo in ('tudo','parcelados','avulsos') then p_modo else 'tudo' end;
  v_today date := public.whatsapp_today();
  v_log record;
  v_item jsonb;
  v_idx int := 0;
  v_data date;
  v_desc text;
  v_valor numeric;
  v_tipo text;
  v_pa int;
  v_pt int;
  v_cat uuid;
  v_inst uuid;
  v_start date;
  v_n int;
  v_date_n date;
  v_id uuid;
  v_avulsos int := 0;
  v_parcelamentos int := 0;
  v_parcelas int := 0;
  v_ignorados int := 0;
  v_total numeric := 0;
  v_ext text;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;

  select id, external_id, parsed_json into v_log
    from public.message_logs
   where user_id = p_user_id and direction = 'in'
     and parsed_json ? 'itens' and jsonb_typeof(parsed_json->'itens') = 'array'
     and coalesce((parsed_json->>'importado')::boolean, false) = false
     and created_at > now() - interval '3 hours'
   order by created_at desc limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'mensagem',
      'Não encontrei uma fatura ou extrato recente para importar. Me manda o PDF de novo e confirma em seguida.');
  end if;

  v_ext := coalesce(v_log.external_id, 'imp-' || v_log.id::text);

  for v_item in select * from jsonb_array_elements(v_log.parsed_json->'itens') loop
    v_idx := v_idx + 1;
    if coalesce((v_item->>'ignorar')::boolean, false) then v_ignorados := v_ignorados + 1; continue; end if;
    v_valor := nullif(btrim(coalesce(v_item->>'valor', '')), '')::numeric;
    v_desc := left(btrim(coalesce(v_item->>'descricao', '')), 255);
    if v_valor is null or v_valor <= 0 or v_desc = '' then v_ignorados := v_ignorados + 1; continue; end if;
    v_tipo := case when v_item->>'tipo' = 'income' then 'income' else 'expense' end;
    begin v_data := (v_item->>'data')::date; exception when others then v_data := v_today; end;
    if v_data is null or v_data > v_today + 1 then v_data := v_today; end if;
    v_pa := nullif(btrim(coalesce(v_item->>'parcela_atual', '')), '')::int;
    v_pt := nullif(btrim(coalesce(v_item->>'parcela_total', '')), '')::int;
    v_cat := public.whatsapp_category_id(p_user_id, v_item->>'categoria', v_tipo);

    if v_pt is not null and v_pt > 1 and v_tipo = 'expense' then
      -- PARCELADO: vincula a um installment existente (mesmo nome e nº de parcelas) ou cria
      if v_modo = 'avulsos' then v_ignorados := v_ignorados + 1; continue; end if;
      v_pa := least(greatest(coalesce(v_pa, 1), 1), v_pt);
      select id, start_date into v_inst, v_start from public.installments
       where user_id = p_user_id and is_active
         and lower(title) = lower(v_desc) and total_installments = v_pt
       order by created_at desc limit 1;
      if v_inst is null then
        v_start := (v_data - make_interval(months => v_pa - 1))::date;
        insert into public.installments
          (user_id, category_id, title, total_amount, installment_amount, total_installments, start_date, is_active)
        values (p_user_id, v_cat, v_desc, round(v_valor * v_pt, 2), round(v_valor, 2), v_pt, v_start, true)
        returning id into v_inst;
        v_parcelamentos := v_parcelamentos + 1;
      end if;
      -- lança as parcelas 1..atual que ainda não existem (qualquer status conta como existente)
      for v_n in 1..v_pa loop
        v_date_n := (v_start + make_interval(months => v_n - 1))::date;
        if extract(day from v_date_n) < extract(day from v_start) then
          v_date_n := (date_trunc('month', v_date_n) + interval '1 month - 1 day')::date;
        end if;
        exit when v_date_n > v_today + 1;
        if not exists (select 1 from public.transactions
                        where installment_id = v_inst and installment_number = v_n) then
          insert into public.transactions
            (user_id, type, amount, description, transaction_date, competence_month, category_id,
             source, status, origin_type, installment_id, installment_number, installment_total, notes)
          values
            (p_user_id, 'expense', round(v_valor, 2), v_desc, v_date_n, date_trunc('month', v_date_n)::date, v_cat,
             'whatsapp', 'active', 'installment', v_inst, v_n, v_pt, 'importado da fatura');
          v_parcelas := v_parcelas + 1;
          v_total := v_total + round(v_valor, 2);
        end if;
      end loop;
    else
      -- AVULSO: idempotente por external_message_id
      if v_modo = 'parcelados' then v_ignorados := v_ignorados + 1; continue; end if;
      insert into public.transactions
        (user_id, type, amount, description, transaction_date, competence_month, category_id,
         source, external_message_id, status, origin_type, notes)
      values
        (p_user_id, v_tipo, round(v_valor, 2), v_desc, v_data, date_trunc('month', v_data)::date, v_cat,
         'whatsapp', left(v_ext || '#imp' || v_idx, 120), 'active', 'manual', 'importado de PDF')
      on conflict (user_id, external_message_id) do nothing
      returning id into v_id;
      if v_id is null then v_ignorados := v_ignorados + 1;
      else v_avulsos := v_avulsos + 1; v_total := v_total + round(v_valor, 2); end if;
    end if;
  end loop;

  update public.message_logs
     set parsed_json = parsed_json || jsonb_build_object('importado', true, 'importado_em', now(), 'modo', v_modo)
   where id = v_log.id;

  return jsonb_build_object(
    'ok', true, 'avulsos', v_avulsos, 'parcelamentos', v_parcelamentos, 'parcelas', v_parcelas,
    'ignorados', v_ignorados, 'total', v_total,
    'mensagem', '📥 *Importação concluída*' || E'\n' ||
                '• ' || v_avulsos || ' lançamento(s) avulso(s)' || E'\n' ||
                '• ' || v_parcelamentos || ' parcelamento(s) novo(s), ' || v_parcelas || ' parcela(s) lançada(s)' ||
                case when v_ignorados > 0 then E'\n' || '• ' || v_ignorados || ' item(ns) ignorado(s) (já existiam, pagamentos ou fora do modo)' else '' end ||
                E'\n' || '💸 Total importado: R$ ' || public.money_br(v_total) || E'\n' ||
                'Já está tudo no seu painel. 🗑️ Errou? Diga *excluir o <nome>*.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Relatório compacto (totais por categoria) com opção de detalhar
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_monthly_report_v2(
  p_user_id uuid,
  p_ref date default null,
  p_detalhado boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref date := coalesce(p_ref, public.whatsapp_today());
  v_start date := date_trunc('month', v_ref)::date;
  v_end date := v_ref;
  v_total numeric;
  v_cats text;
  v_top text;
  v_count int;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.');
  end if;
  if p_detalhado then
    return public.whatsapp_monthly_report(p_user_id, v_ref);
  end if;

  select coalesce(sum(amount), 0), count(*) into v_total, v_count
    from public.transactions
   where user_id = p_user_id and type = 'expense' and status = 'active'
     and transaction_date between v_start and v_end;

  if v_total = 0 then
    return jsonb_build_object('ok', true, 'total', 0,
      'mensagem', '📊 Você ainda não registrou gastos em ' || to_char(v_start, 'MM/YYYY') ||
                  '. Manda um "gastei X em Y" que eu anoto! 💰');
  end if;

  select string_agg('• ' || cat || ' — R$ ' || public.money_br(soma) || ' (' || round(soma / v_total * 100) || '%)',
                    E'\n' order by soma desc)
    into v_cats
    from (select coalesce(c.name, 'Sem categoria') as cat, sum(t.amount) as soma
            from public.transactions t left join public.categories c on c.id = t.category_id
           where t.user_id = p_user_id and t.type = 'expense' and t.status = 'active'
             and t.transaction_date between v_start and v_end
           group by 1) s;

  select string_agg('• (' || to_char(transaction_date, 'DD/MM') || ') ' || coalesce(nullif(description, ''), 'Lançamento') ||
                    ' — R$ ' || public.money_br(amount), E'\n' order by amount desc)
    into v_top
    from (select transaction_date, description, amount
            from public.transactions
           where user_id = p_user_id and type = 'expense' and status = 'active'
             and transaction_date between v_start and v_end
           order by amount desc limit 3) t;

  return jsonb_build_object('ok', true, 'total', v_total, 'lancamentos', v_count,
    'mensagem', '📊 *Gastos de ' || to_char(v_start, 'MM/YYYY') || '* (até ' || to_char(v_end, 'DD/MM') || ')' || E'\n\n' ||
                v_cats || E'\n\n' ||
                '🔝 *Maiores gastos*' || E'\n' || v_top || E'\n\n' ||
                '💸 *Total: R$ ' || public.money_br(v_total) || '* em ' || v_count || ' lançamento(s)' || E'\n' ||
                '🔎 Diga *detalhar* para ver item por item.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Alertas diários (o workflow agendado chama 1x por dia e envia cada item)
--    Dedupe: o workflow registra em message_logs (direction out, external_id =
--    chave do alerta); esta função só devolve o que ainda não foi enviado.
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_daily_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.whatsapp_today();
  v_month date := date_trunc('month', v_today)::date;
  v_out jsonb := '[]'::jsonb;
  r record;
  v_lista text;
  v_key text;
  v_limit numeric;
  v_spent numeric;
  v_pct numeric;
begin
  for r in
    select distinct on (l.user_id) l.user_id, l.wa_id, p.full_name
      from public.whatsapp_links l
      join public.profiles p on p.id = l.user_id
      left join public.user_settings s on s.user_id = l.user_id
     where coalesce(s.whatsapp_notifications, true)
     order by l.user_id, l.created_at desc
  loop
    -- (a) gastos fixos que vencem hoje
    v_key := 'alert:due:' || to_char(v_today, 'YYYY-MM-DD');
    select string_agg('• ' || f.title || ' — R$ ' || public.money_br(f.amount), E'\n' order by f.amount desc)
      into v_lista
      from public.fixed_expenses f
     where f.user_id = r.user_id and f.is_active
       and public.whatsapp_due_date(v_today, f.due_day) = v_today
       and coalesce(f.start_date, f.created_at::date) <= v_today
       and (f.end_date is null or f.end_date >= v_today);
    if v_lista is not null and not exists (
         select 1 from public.message_logs m
          where m.user_id = r.user_id and m.direction = 'out' and m.external_id = v_key) then
      v_out := v_out || jsonb_build_object('user_id', r.user_id, 'wa_id', r.wa_id, 'external_id', v_key,
        'mensagem', '📅 *Vence hoje*' || E'\n' || v_lista || E'\n\n' ||
                    'O lançamento entra automaticamente no seu painel. Se já pagou, tá tudo certo. 👍');
    end if;

    -- (b) limite mensal >= 80% (uma vez por mês) e estourado (uma vez por mês)
    select amount into v_limit from public.budgets
     where user_id = r.user_id and category_id is null and month_ref = v_month limit 1;
    if v_limit is not null and v_limit > 0 then
      select coalesce(sum(amount), 0) into v_spent from public.transactions
       where user_id = r.user_id and type = 'expense' and status = 'active'
         and transaction_date >= v_month and transaction_date < (v_month + interval '1 month')::date;
      v_pct := round(v_spent / v_limit * 100, 1);
      if v_pct >= 100 then
        v_key := 'alert:limit100:' || to_char(v_month, 'YYYY-MM');
      elsif v_pct >= 80 then
        v_key := 'alert:limit80:' || to_char(v_month, 'YYYY-MM');
      else
        v_key := null;
      end if;
      if v_key is not null and not exists (
           select 1 from public.message_logs m
            where m.user_id = r.user_id and m.direction = 'out' and m.external_id = v_key) then
        v_out := v_out || jsonb_build_object('user_id', r.user_id, 'wa_id', r.wa_id, 'external_id', v_key,
          'mensagem', case when v_pct >= 100 then '🚨 *Limite do mês estourado*' else '⚠️ *Atenção ao limite*' end || E'\n' ||
                      'Você já usou *' || v_pct || '%* do seu limite de R$ ' || public.money_br(v_limit) ||
                      ' em ' || to_char(v_month, 'MM/YYYY') || ' (gasto: R$ ' || public.money_br(v_spent) || ').' || E'\n' ||
                      case when v_pct >= 100 then 'Que tal revisar os gastos? Diga *relatório* que eu mostro onde foi.'
                           else 'Ainda dá para gastar R$ ' || public.money_br(v_limit - v_spent) || '. Diga *relatório* para ver onde foi.' end);
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'total', jsonb_array_length(v_out), 'alertas', v_out);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões: SÓ service_role
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.whatsapp_import_statement(uuid, text)',
    'public.whatsapp_monthly_report_v2(uuid, date, boolean)',
    'public.whatsapp_daily_alerts()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
