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
