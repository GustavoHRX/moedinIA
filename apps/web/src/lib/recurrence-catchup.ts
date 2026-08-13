import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonthsClamped, toCompetenceMonth, todayDateInput } from "@/lib/dates";

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
 * Regras:
 *  - Gastos fixos: todos os ativos. A partir de `start_date` (ou do mês de
 *    `created_at`, quando criado pela página sem data), uma ocorrência por mês
 *    no `due_day`, até hoje, respeitando `end_date`/`months_ahead`. O controle
 *    de "não gerar mais" é feito inativando ou excluindo o gasto fixo.
 *  - Parcelamentos: todas as parcelas de `start_date` até hoje.
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

const MAX_MONTHS = 600; // teto de segurança para fixos sem fim definido

function clampDueDay(year: number, month: number, dueDay: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(dueDay, lastDay);
}

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
        "id, category_id, title, description, installment_amount, total_installments, start_date, created_at"
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

  const fixedList = (fixedRes.data ?? []) as FixedExpenseRow[];
  const instList = (instRes.data ?? []) as InstallmentRow[];
  // fixed_incomes pode não existir ainda (migration 011 pendente) — segue sem receitas.
  const incomeList = (incomeRes.data ?? []) as FixedIncomeRow[];
  if (fixedList.length === 0 && instList.length === 0 && incomeList.length === 0) return 0;

  // Transações de origem já existentes (qualquer status) para deduplicar.
  const originTypes = ["fixed_expense", "installment"];
  if (incomeList.length > 0) originTypes.push("fixed_income");
  const { data: existing } = await supabase
    .from("transactions")
    .select(
      incomeList.length > 0
        ? "fixed_expense_id, installment_id, fixed_income_id, competence_month, installment_number"
        : "fixed_expense_id, installment_id, competence_month, installment_number"
    )
    .eq("user_id", userId)
    .in("origin_type", originTypes);

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
    const startMonth = `${startBase.slice(0, 7)}-01`;
    const cap = fx.months_ahead ?? MAX_MONTHS;

    for (let i = 0; i < cap; i++) {
      const monthAnchor = addMonthsClamped(startMonth, i);
      const year = Number(monthAnchor.slice(0, 4));
      const month = Number(monthAnchor.slice(5, 7));
      const day = clampDueDay(year, month, fx.due_day);
      const txDate = `${monthAnchor.slice(0, 7)}-${String(day).padStart(2, "0")}`;

      if (txDate > today) break;
      if (fx.end_date && txDate > fx.end_date) break;

      const key = `${fx.id}:${monthAnchor.slice(0, 7)}`;
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
    for (let n = 1; n <= inst.total_installments; n++) {
      const txDate = addMonthsClamped(startBase, n - 1);
      if (txDate > today) break;

      const key = `${inst.id}:${n}`;
      if (existingInst.has(key)) continue;
      existingInst.add(key);

      toInsert.push({
        user_id: userId,
        type: "expense",
        amount: inst.installment_amount,
        description: inst.title,
        notes: inst.description ?? null,
        transaction_date: txDate,
        competence_month: toCompetenceMonth(txDate),
        category_id: inst.category_id,
        source: "web",
        status: "active",
        origin_type: "installment",
        installment_id: inst.id,
        installment_number: n,
        installment_total: inst.total_installments,
      });
    }
  }

  // Receitas fixas (salário, vale-alimentação, vale-refeição): uma por mês no
  // dia do pagamento, a partir do mês de início, até hoje.
  for (const inc of incomeList) {
    const startBase = (inc.start_date ?? inc.created_at).slice(0, 10);
    const startMonth = `${startBase.slice(0, 7)}-01`;

    for (let i = 0; i < MAX_MONTHS; i++) {
      const monthAnchor = addMonthsClamped(startMonth, i);
      const year = Number(monthAnchor.slice(0, 4));
      const month = Number(monthAnchor.slice(5, 7));
      const day = clampDueDay(year, month, inc.due_day);
      const txDate = `${monthAnchor.slice(0, 7)}-${String(day).padStart(2, "0")}`;

      if (txDate > today) break;
      if (inc.end_date && txDate > inc.end_date) break;

      const key = `${inc.id}:${monthAnchor.slice(0, 7)}`;
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

  const { error } = await supabase.from("transactions").insert(toInsert);
  if (error) throw error;
  return toInsert.length;
}
