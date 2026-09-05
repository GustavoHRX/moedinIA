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
