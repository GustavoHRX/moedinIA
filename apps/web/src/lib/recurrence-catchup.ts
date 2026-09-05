import type { SupabaseClient } from "@supabase/supabase-js";
import { toCompetenceMonth, todayDateInput } from "@/lib/dates";
import { installmentOccurrences, monthlyOccurrences } from "@/lib/recurrence";
import { splitInstallments } from "@/lib/money";

/**
 * Gera as transações vencidas de gastos fixos e parcelamentos que ficaram para
 * trás. O app só criava as ocorrências no momento em que o lançamento era
 * cadastrado (e apenas as já vencidas naquele instante); nada gerava os meses
 * seguintes com o passar do tempo. Este catch-up preenche o que falta.
 *
 * É idempotente: consulta as transações que já existem (em qualquer status,
 * inclusive as excluídas pelo usuário) por origem + competência/parcela e só
 * insere o que estiver faltando — nunca duplica nem ressuscita algo apagado.
 *
 * Regras (datas vêm de lib/recurrence.ts — mesma lógica do modal):
 *  - Gastos fixos / receitas fixas: uma ocorrência por mês no `due_day`, a
 *    partir de `start_date` (ou do mês de `created_at`), nunca antes do início,
 *    até hoje, respeitando `end_date`/`months_ahead`. "Parar de gerar" = inativar
 *    ou excluir o registro de origem.
 *  - Parcelamentos: parcelas 1..N de `start_date` até hoje; valores de
 *    splitInstallments (a última fecha o total exato).
 *
 * Este é o ÚNICO ponto que gera transações de recorrência. O modal e as
 * páginas de cadastro só criam o registro de origem e chamam esta função.
 */

type FixedExpenseRow = {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  due_day: number;
  start_date: string | null;
  end_date: string | null;
  months_ahead: number | null;
  created_at: string;
};

type InstallmentRow = {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  installment_amount: number;
  total_amount: number;
  total_installments: number;
  start_date: string;
  created_at: string;
};

type FixedIncomeRow = {
  id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  amount: number;
  due_day: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type NewTransaction = Record<string, unknown>;

export async function catchUpRecurrences(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const today = todayDateInput();

  const [fixedRes, instRes, incomeRes] = await Promise.all([
    supabase
      .from("fixed_expenses")
      .select(
        "id, category_id, title, description, amount, due_day, start_date, end_date, months_ahead, created_at"
      )
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("installments")
      .select(
        "id, category_id, title, description, installment_amount, total_amount, total_installments, start_date, created_at"
      )
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("fixed_incomes")
      .select(
        "id, category_id, title, description, amount, due_day, start_date, end_date, created_at"
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .gt("amount", 0),
  ]);

  // REVISÃO EXTERNA (ago/2026) — achado 2.2: um erro numa das leituras de
  // origem não pode virar "lista vazia". "Não achei nada" e "não consegui
  // consultar" são coisas diferentes; tratar erro como vazio faz o catch-up
  // gerar ocorrências que talvez já existam.
  if (fixedRes.error) throw fixedRes.error;
  if (instRes.error) throw instRes.error;
  // fixed_incomes pode não existir ainda em bancos antigos (migration 011).
  // Só ignoramos o erro se for exatamente "relação não existe".
  if (incomeRes.error && !/relation .*fixed_incomes.* does not exist/i.test(incomeRes.error.message)) {
    throw incomeRes.error;
  }

  const fixedList = (fixedRes.data ?? []) as FixedExpenseRow[];
  const instList = (instRes.data ?? []) as InstallmentRow[];
  const incomeList = (incomeRes.data ?? []) as FixedIncomeRow[];
  if (fixedList.length === 0 && instList.length === 0 && incomeList.length === 0) return 0;

  // Transações de origem já existentes (qualquer status) para deduplicar.
  const originTypes = ["fixed_expense", "installment"];
  if (incomeList.length > 0) originTypes.push("fixed_income");
  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select(
      incomeList.length > 0
        ? "fixed_expense_id, installment_id, fixed_income_id, competence_month, installment_number"
        : "fixed_expense_id, installment_id, competence_month, installment_number"
    )
    .eq("user_id", userId)
    .in("origin_type", originTypes);

  // achado 2.2: SEM esta consulta o catch-up estava cego — antes ignorava o
  // erro e seguia inserindo tudo. Agora aborta e tenta de novo no próximo dia.
  if (existingError) throw existingError;

  const existingFixed = new Set<string>();
  const existingInst = new Set<string>();
  const existingIncome = new Set<string>();
  for (const row of existing ?? []) {
    const r = row as unknown as {
      fixed_expense_id: string | null;
      installment_id: string | null;
      fixed_income_id?: string | null;
      competence_month: string | null;
      installment_number: number | null;
    };
    if (r.fixed_expense_id && r.competence_month) {
      existingFixed.add(`${r.fixed_expense_id}:${r.competence_month.slice(0, 7)}`);
    }
    if (r.installment_id && r.installment_number != null) {
      existingInst.add(`${r.installment_id}:${r.installment_number}`);
    }
    if (r.fixed_income_id && r.competence_month) {
      existingIncome.add(`${r.fixed_income_id}:${r.competence_month.slice(0, 7)}`);
    }
  }

  const toInsert: NewTransaction[] = [];

  for (const fx of fixedList) {
    const startBase = (fx.start_date ?? fx.created_at).slice(0, 10);
    const occurrences = monthlyOccurrences({
      startDate: startBase,
      dueDay: fx.due_day,
      today,
      endDate: fx.end_date,
      monthsAhead: fx.months_ahead,
    });

    for (const txDate of occurrences) {
      const key = `${fx.id}:${txDate.slice(0, 7)}`;
      if (existingFixed.has(key)) continue;
      existingFixed.add(key);

      toInsert.push({
        user_id: userId,
        type: "expense",
        amount: fx.amount,
        description: fx.title,
        notes: fx.description ?? null,
        transaction_date: txDate,
        competence_month: toCompetenceMonth(txDate),
        category_id: fx.category_id,
        source: "web",
        status: "active",
        origin_type: "fixed_expense",
        fixed_expense_id: fx.id,
      });
    }
  }

  for (const inst of instList) {
    const startBase = (inst.start_date ?? inst.created_at).slice(0, 10);
    // Valores por parcela recomputados da regra única (última fecha o total).
    const amounts = splitInstallments(
      Number(inst.total_amount) || Number(inst.installment_amount) * inst.total_installments,
      inst.total_installments,
    );

    for (const { number, date } of installmentOccurrences({
      startDate: startBase,
      count: inst.total_installments,
      today,
    })) {
      const key = `${inst.id}:${number}`;
      if (existingInst.has(key)) continue;
      existingInst.add(key);

      toInsert.push({
        user_id: userId,
        type: "expense",
        amount: amounts[number - 1] ?? inst.installment_amount,
        description: inst.title,
        notes: inst.description ?? null,
        transaction_date: date,
        competence_month: toCompetenceMonth(date),
        category_id: inst.category_id,
        source: "web",
        status: "active",
        origin_type: "installment",
        installment_id: inst.id,
        installment_number: number,
        installment_total: inst.total_installments,
      });
    }
  }

  // Receitas fixas (salário, vale-alimentação, vale-refeição): uma por mês no
  // dia do pagamento, a partir do início, até hoje.
  for (const inc of incomeList) {
    const startBase = (inc.start_date ?? inc.created_at).slice(0, 10);
    const occurrences = monthlyOccurrences({
      startDate: startBase,
      dueDay: inc.due_day,
      today,
      endDate: inc.end_date,
    });

    for (const txDate of occurrences) {
      const key = `${inc.id}:${txDate.slice(0, 7)}`;
      if (existingIncome.has(key)) continue;
      existingIncome.add(key);

      toInsert.push({
        user_id: userId,
        type: "income",
        amount: inc.amount,
        description: inc.title,
        notes: inc.description ?? null,
        transaction_date: txDate,
        competence_month: toCompetenceMonth(txDate),
        category_id: inc.category_id,
        source: "web",
        status: "active",
        origin_type: "fixed_income",
        fixed_income_id: inc.id,
      });
    }
  }

  if (toInsert.length === 0) return 0;

  // Caminho normal: um lote só. Se outra aba/execução já criou alguma das
  // ocorrências, o índice único (migration 019) recusa o lote com 23505 — aí
  // caímos para inserção linha a linha, pulando as que já existem.
  const batch = await supabase.from("transactions").insert(toInsert);
  if (!batch.error) return toInsert.length;
  if (batch.error.code !== "23505") throw batch.error;

  let created = 0;
  for (const row of toInsert) {
    const { error } = await supabase.from("transactions").insert(row);
    if (error) {
      if (error.code === "23505") continue; // corrida perdida — ok
      throw error;
    }
    created += 1;
  }
  return created;
}
