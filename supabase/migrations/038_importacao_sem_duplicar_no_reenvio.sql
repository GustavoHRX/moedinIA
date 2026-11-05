-- 038: importação de fatura/extrato/planilha não duplica no reenvio do arquivo (05/11/2026)
--
-- Achado na validação do TCC (perfil Marta): mandar o MESMO PDF de novo e confirmar duplicava todos os
-- itens avulsos. A chave antiga era o id da mensagem do WhatsApp + a posição do item; um reenvio é
-- outra mensagem, com outro id. Agora, antes de gravar um item avulso, a função conta os lançamentos
-- importados ativos com a mesma data, valor, descrição e tipo; se já houver tantos quanto a ordem
-- deste item no arquivo, ele é ignorado. Vale também para itens importados antes desta migration.
-- Parcelas já eram protegidas por (installment_id, installment_number).
-- A mensagem final passa a separar saídas de entradas (antes somava a receita no "total").
-- Base: a função da 025 (versão em produção, conferida pela mensagem que o bot devolveu em 05/11).

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
  v_log record; v_item jsonb; v_idx int := 0;
  v_data date; v_desc text; v_valor numeric; v_tipo text; v_pa int; v_pt int;
  v_cat uuid; v_inst uuid; v_start date; v_total_inst int; v_first int; v_num int; v_id uuid;
  v_avulsos int := 0; v_parcelamentos int := 0; v_parcelas int := 0; v_anteriores int := 0; v_ignorados int := 0;
  v_total numeric := 0; v_ext text;
  v_entradas numeric := 0; v_sig text; v_seen jsonb := '{}'::jsonb; v_nth int; v_ja int;
  v_tx_ids uuid[] := '{}'; v_inst_ids uuid[] := '{}';
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'mensagem', 'Usuário não identificado.'); end if;

  select id, external_id, parsed_json into v_log from public.message_logs
   where user_id = p_user_id and direction = 'in'
     and parsed_json ? 'itens' and jsonb_typeof(parsed_json->'itens') = 'array'
     and coalesce((parsed_json->>'importado')::boolean, false) = false
     and created_at > now() - interval '3 hours'
   order by created_at desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'mensagem', 'Não encontrei uma fatura ou extrato recente para importar. Me manda o PDF (ou a foto) de novo e confirma em seguida.');
  end if;
  v_ext := coalesce(v_log.external_id, 'imp-' || v_log.id::text);

  for v_item in select * from jsonb_array_elements(v_log.parsed_json->'itens') loop
    v_idx := v_idx + 1;
    if coalesce((v_item->>'ignorar')::boolean, false) then v_ignorados := v_ignorados + 1; continue; end if;
    v_valor := nullif(btrim(coalesce(v_item->>'valor', '')), '')::numeric;
    v_desc := left(btrim(coalesce(v_item->>'descricao', '')), 120);
    if v_valor is null or v_valor <= 0 or v_desc = '' then v_ignorados := v_ignorados + 1; continue; end if;
    v_tipo := case when v_item->>'tipo' = 'income' then 'income' else 'expense' end;
    begin v_data := (v_item->>'data')::date; exception when others then v_data := v_today; end;
    if v_data is null or v_data > v_today + 1 then v_data := v_today; end if;
    v_pa := nullif(btrim(coalesce(v_item->>'parcela_atual', '')), '')::int;
    v_pt := nullif(btrim(coalesce(v_item->>'parcela_total', '')), '')::int;
    v_cat := coalesce(public.whatsapp_apply_category_rule(p_user_id, v_desc, v_tipo),
                      public.whatsapp_category_id(p_user_id, v_item->>'categoria', v_tipo));

    if v_pt is not null and v_pt > 1 and v_tipo = 'expense' then
      if v_modo = 'avulsos' then v_ignorados := v_ignorados + 1; continue; end if;
      v_pa := least(greatest(coalesce(v_pa, 1), 1), v_pt);
      select id, start_date, total_installments into v_inst, v_start, v_total_inst from public.installments
       where user_id = p_user_id and is_active and lower(title) = lower(v_desc) and description like '%[fatura:' || v_pt || 'x]%'
       order by created_at desc limit 1;
      if v_inst is not null then
        v_first := v_pt - v_total_inst + 1; v_num := v_pa - v_first + 1;
      else
        select id, start_date, total_installments into v_inst, v_start, v_total_inst from public.installments
         where user_id = p_user_id and is_active and lower(title) = lower(v_desc) and total_installments = v_pt
         order by created_at desc limit 1;
        if v_inst is not null then v_num := v_pa;
        else
          v_total_inst := v_pt - v_pa + 1; v_start := v_data;
          insert into public.installments (user_id, category_id, title, description, total_amount, installment_amount, total_installments, start_date, is_active)
          values (p_user_id, v_cat, v_desc,
                  'Importado da fatura em ' || to_char(v_data, 'DD/MM/YYYY') || ' (parcela ' || v_pa || ' de ' || v_pt ||
                  case when v_pa > 1 then '; ' || (v_pa - 1) || ' anteriores não lançadas' else '' end || ') [fatura:' || v_pt || 'x]',
                  round(v_valor * v_total_inst, 2), round(v_valor, 2), v_total_inst, v_start, true)
          returning id into v_inst;
          v_inst_ids := v_inst_ids || v_inst;
          v_parcelamentos := v_parcelamentos + 1; v_anteriores := v_anteriores + (v_pa - 1); v_num := 1;
        end if;
      end if;
      if v_num < 1 or v_num > v_total_inst then v_ignorados := v_ignorados + 1; continue; end if;
      if not exists (select 1 from public.transactions where installment_id = v_inst and installment_number = v_num) then
        insert into public.transactions
          (user_id, type, amount, description, transaction_date, competence_month, category_id,
           source, status, origin_type, installment_id, installment_number, installment_total, notes)
        values (p_user_id, 'expense', round(v_valor, 2), v_desc, v_data, date_trunc('month', v_data)::date, v_cat,
                'whatsapp', 'active', 'installment', v_inst, v_num, v_total_inst,
                'importado da fatura (parcela ' || v_pa || ' de ' || v_pt || ')')
        returning id into v_id;
        v_tx_ids := v_tx_ids || v_id; v_parcelas := v_parcelas + 1; v_total := v_total + round(v_valor, 2);
      else v_ignorados := v_ignorados + 1; end if;
    else
      if v_modo = 'parcelados' then v_ignorados := v_ignorados + 1; continue; end if;
      -- 038: mesmo item (data, valor, descrição, tipo) já importado antes, por qualquer mensagem ou arquivo,
      -- não entra de novo. Repetições legítimas dentro do mesmo arquivo contam pela ordem (1ª, 2ª...).
      v_sig := v_data::text || '|' || round(v_valor, 2)::text || '|' || lower(v_desc) || '|' || v_tipo;
      v_nth := coalesce((v_seen->>v_sig)::int, 0) + 1;
      v_seen := v_seen || jsonb_build_object(v_sig, v_nth);
      select count(*) into v_ja from public.transactions t
       where t.user_id = p_user_id and t.status = 'active' and t.source = 'whatsapp'
         and t.notes like 'importado de PDF%' and t.transaction_date = v_data and t.type = v_tipo
         and t.amount = round(v_valor, 2) and lower(t.description) = lower(v_desc);
      if v_ja >= v_nth then v_ignorados := v_ignorados + 1; continue; end if;
      insert into public.transactions
        (user_id, type, amount, description, transaction_date, competence_month, category_id,
         source, external_message_id, status, origin_type, notes)
      values (p_user_id, v_tipo, round(v_valor, 2), v_desc, v_data, date_trunc('month', v_data)::date, v_cat,
              'whatsapp', left(v_ext || '#imp' || v_idx, 120), 'active', 'manual', 'importado de PDF')
      on conflict (user_id, external_message_id) do nothing
      returning id into v_id;
      if v_id is null then v_ignorados := v_ignorados + 1;
      else v_tx_ids := v_tx_ids || v_id; v_avulsos := v_avulsos + 1;
        if v_tipo = 'income' then v_entradas := v_entradas + round(v_valor, 2); else v_total := v_total + round(v_valor, 2); end if;
      end if;
    end if;
  end loop;

  update public.message_logs
     set parsed_json = parsed_json || jsonb_build_object('importado', true, 'importado_em', now(), 'modo', v_modo,
                                                         'import_ids', jsonb_build_object('tx', to_jsonb(v_tx_ids), 'inst', to_jsonb(v_inst_ids)))
   where id = v_log.id;

  return jsonb_build_object(
    'ok', true, 'avulsos', v_avulsos, 'parcelamentos', v_parcelamentos, 'parcelas', v_parcelas,
    'parcelas_anteriores_nao_lancadas', v_anteriores, 'ignorados', v_ignorados, 'total', v_total, 'entradas', v_entradas,
    'mensagem', '📥 *Importação concluída*' || E'\n' ||
                '• ' || v_avulsos || ' lançamento(s) avulso(s)' || E'\n' ||
                '• ' || v_parcelas || ' parcela(s) desta fatura' ||
                case when v_parcelamentos > 0 then ' (' || v_parcelamentos || ' parcelamento(s) novo(s) vinculado(s); as próximas parcelas entram no vencimento)' else '' end ||
                case when v_anteriores > 0 then E'\n' || '• ' || v_anteriores || ' parcela(s) anterior(es) ficaram fora do histórico, como combinado' else '' end ||
                case when v_ignorados > 0 then E'\n' || '• ' || v_ignorados || ' item(ns) ignorado(s) (já importados antes, pagamentos ou fora do modo)' else '' end ||
                E'\n' || '💸 Saídas importadas: R$ ' || public.money_br(v_total) ||
                case when v_entradas > 0 then E'\n' || '💰 Entradas importadas: R$ ' || public.money_br(v_entradas) || ' (não somam nos gastos)' else '' end || E'\n' ||
                'Já está no seu painel. Se errou algo, diga *desfazer importação*.');
end;
$$;
