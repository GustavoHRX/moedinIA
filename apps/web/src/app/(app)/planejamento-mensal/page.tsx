"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { currentMonthRef } from "@/lib/dates";
import { formatCurrency, formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import { Alert, EmptyState, PageFrame, PageHeader, SectionHeader, StatCard, Surface } from "@/components/ui-kit";
import { HominhoTip } from "@/components/hominho-tip";
import { planejamentoTips } from "@/lib/tips";
import { catchUpRecurrences } from "@/lib/recurrence-catchup";

type MonthlyControl = {
  id: string;
  month_ref: string;
  salary_amount: number;
  extra_income_amount: number;
  opening_balance: number;
  payday_day: number | null;
  food_allowance: number;
  meal_allowance: number;
  notes: string | null;
};

type Category = {
  id: string;
  name: string;
};

type BudgetItem = {
  id: string;
  category_id: string | null;
  month_ref: string;
  amount: number;
  categories: CategoryRelation;
};

type FixedExpense = {
  id: string;
  amount: number;
};

type FixedIncome = {
  id: string;
  kind: "salary" | "food_allowance" | "meal_allowance" | "extra_income" | "custom";
  title: string;
  amount: number;
  due_day: number;
  is_active: boolean;
  category_id: string | null;
  categories: CategoryRelation;
};

type MonthlyPlanningData = {
  control: MonthlyControl | null;
  categories: Category[];
  budgets: BudgetItem[];
  fixedExpenses: FixedExpense[];
  fixedIncomes: FixedIncome[];
};

function formatMonthLabel(monthRef: string) {
  return new Date(`${monthRef}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export default function PlanejamentoMensalPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const {
    user: cachedUser,
    loadingUser,
    categoriesLoaded,
    getCategoriesByType,
    refreshCategories,
    financialVersion,
    getFinancialCache,
    setFinancialCache,
    invalidateFinancialData,
  } = useAppData();
  const confirm = useConfirm();

  const [messageType, setMessageType] = useState<"success" | "error">("success");

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }
  const [monthRef, setMonthRef] = useState(currentMonthRef());

  const [controlId, setControlId] = useState<string | null>(null);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [extraIncomeAmount, setExtraIncomeAmount] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [paydayDay, setPaydayDay] = useState("");
  const [foodAllowance, setFoodAllowance] = useState("");
  const [mealAllowance, setMealAllowance] = useState("");
  const [notes, setNotes] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [fixedIncomes, setFixedIncomes] = useState<FixedIncome[]>([]);

  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCategoryId, setBudgetCategoryId] = useState("general");

  // Edição/criação de receitas fixas (salário, vales e receitas fixas customizadas)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editIncomeTitle, setEditIncomeTitle] = useState("");
  const [editIncomeAmount, setEditIncomeAmount] = useState("");
  const [editIncomeDueDay, setEditIncomeDueDay] = useState("");
  const [editIncomeCategoryId, setEditIncomeCategoryId] = useState("");
  const [savingIncomeEdit, setSavingIncomeEdit] = useState(false);

  const [newIncomeTitle, setNewIncomeTitle] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState("");
  const [newIncomeDueDay, setNewIncomeDueDay] = useState("");
  const [newIncomeCategoryId, setNewIncomeCategoryId] = useState("");
  const [savingNewIncome, setSavingNewIncome] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingControl, setSavingControl] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [message, setMessage] = useState("");

  const applyPlanningData = useCallback((data: MonthlyPlanningData) => {
    setCategories(data.categories);
    setBudgets(data.budgets);
    setFixedExpenses(data.fixedExpenses);
    setFixedIncomes(data.fixedIncomes);

    const item = data.control;
    if (item) {
      setControlId(item.id);
      setSalaryAmount(formatMoneyInputValue(item.salary_amount ?? 0));
      setExtraIncomeAmount(formatMoneyInputValue(item.extra_income_amount ?? 0));
      setOpeningBalance(formatMoneyInputValue(item.opening_balance ?? 0));
      setPaydayDay(item.payday_day ? String(item.payday_day) : "");
      setFoodAllowance(formatMoneyInputValue(item.food_allowance ?? 0));
      setMealAllowance(formatMoneyInputValue(item.meal_allowance ?? 0));
      setNotes(item.notes ?? "");
      return;
    }

    setControlId(null);
    setSalaryAmount("");
    setExtraIncomeAmount("");
    setOpeningBalance("");
    setPaydayDay("");
    setFoodAllowance("");
    setMealAllowance("");
    setNotes("");
  }, []);

  const loadPage = useCallback(async (selectedMonth?: string, forceRefresh = false) => {
    setMessage("");
    const month = selectedMonth || monthRef;

    if (loadingUser) return;

    const user = cachedUser;

    if (!user) {
      router.push("/login");
      return;
    }

    const cacheKey = `monthly-planning:${user.id}:${month}`;
    const cachedPage = forceRefresh ? null : getFinancialCache<MonthlyPlanningData>(cacheKey);

    if (cachedPage) {
      applyPlanningData(cachedPage);
      setLoading(false);
      return;
    }

    setLoading(true);

    const cachedExpenseCategories = getCategoriesByType("expense");
    const categoriesPromise =
      categoriesLoaded
        ? Promise.resolve(cachedExpenseCategories)
        : refreshCategories().then((items) => items.filter((category) => category.type === "expense"));

    const [controlRes, categoriesResult, budgetsRes, fixedRes, incomesRes] = await Promise.all([
      supabase
        .from("monthly_controls")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_ref", month)
        .maybeSingle(),
      categoriesPromise,
      supabase
        .from("budgets")
        .select("id, category_id, month_ref, amount, categories(name)")
        .eq("user_id", user.id)
        .eq("month_ref", month)
        .order("created_at", { ascending: false }),
      supabase
        .from("fixed_expenses")
        .select("id, amount")
        .eq("user_id", user.id)
        .eq("is_active", true),
      // fixed_incomes pode não existir ainda (migration 011 pendente) — erro
      // aqui não deve bloquear o resto do planejamento.
      supabase
        .from("fixed_incomes")
        .select("id, kind, title, amount, due_day, is_active, category_id, categories(name)")
        .eq("user_id", user.id)
        .order("kind", { ascending: true }),
    ]);

    setLoading(false);

    if (controlRes.error || budgetsRes.error || fixedRes.error) {
      setMessage(
        `Erro ao carregar planejamento: ${
          controlRes.error?.message ||
          budgetsRes.error?.message ||
          fixedRes.error?.message
        }`
      );
      return;
    }

    const nextPage: MonthlyPlanningData = {
      control: controlRes.data as MonthlyControl | null,
      categories: categoriesResult as Category[],
      budgets: (budgetsRes.data ?? []) as BudgetItem[],
      fixedExpenses: (fixedRes.data ?? []) as FixedExpense[],
      fixedIncomes: incomesRes.error ? [] : ((incomesRes.data ?? []) as FixedIncome[]),
    };
    applyPlanningData(nextPage);
    setFinancialCache(cacheKey, nextPage);
  }, [
    applyPlanningData,
    cachedUser,
    categoriesLoaded,
    getCategoriesByType,
    getFinancialCache,
    loadingUser,
    monthRef,
    refreshCategories,
    router,
    setFinancialCache,
    supabase,
  ]);

  useEffect(() => {
    loadPage();
  }, [financialVersion, loadPage]);

  async function handleChangeMonth(nextMonth: string) {
    const finalMonth = `${nextMonth}-01`;
    setMonthRef(finalMonth);
    await loadPage(finalMonth);
  }

  async function handleSaveControl(e: FormEvent) {
    e.preventDefault();
    setSavingControl(true);
    setMessage("");

    const userId = cachedUser?.id;
    if (!userId) {
      showMessage("Usuário não autenticado.", "error");
      setSavingControl(false);
      return;
    }

    const payload = {
      user_id: userId,
      month_ref: monthRef,
      salary_amount: parseMoneyInput(salaryAmount),
      extra_income_amount: parseMoneyInput(extraIncomeAmount),
      opening_balance: parseMoneyInput(openingBalance),
      payday_day: paydayDay ? Number(paydayDay) : null,
      food_allowance: parseMoneyInput(foodAllowance),
      meal_allowance: parseMoneyInput(mealAllowance),
      notes: notes.trim() || null,
    };

    const response = controlId
      ? await supabase.from("monthly_controls").update(payload).eq("id", controlId)
      : await supabase.from("monthly_controls").insert(payload);

    setSavingControl(false);

    if (response.error) {
      showMessage(`Erro ao salvar controle mensal: ${response.error.message}`, "error");
      return;
    }

    // Salário e vales viram receitas fixas recorrentes (uma por mês, no dia do
    // pagamento). Sem isso eles ficariam só no planejamento, sem virar lançamento.
    await syncFixedIncomes(userId);

    showMessage("Planejamento mensal salvo com sucesso.", "success");
    invalidateFinancialData();
    await loadPage(monthRef, true);
  }

  /**
   * Espelha salário / vale-alimentação / vale-refeição em `fixed_incomes`
   * (uma linha por tipo) e gera de imediato as receitas já vencidas.
   * Valor zerado ou sem dia de pagamento => a receita fixa é desativada.
   */
  async function syncFixedIncomes(userId: string) {
    const payday = paydayDay ? Number(paydayDay) : null;
    const incomeCategories = getCategoriesByType("income");
    const salaryCategory = incomeCategories.find((c) =>
      c.name.toLowerCase().startsWith("sal")
    );

    const items = [
      { kind: "salary", title: "Salário", amount: parseMoneyInput(salaryAmount), category_id: salaryCategory?.id ?? null },
      { kind: "food_allowance", title: "Vale alimentação", amount: parseMoneyInput(foodAllowance), category_id: null },
      { kind: "meal_allowance", title: "Vale refeição", amount: parseMoneyInput(mealAllowance), category_id: null },
      { kind: "extra_income", title: "Renda extra", amount: parseMoneyInput(extraIncomeAmount), category_id: null },
    ];

    try {
      const { data: existing, error } = await supabase
        .from("fixed_incomes")
        .select("id, kind")
        .eq("user_id", userId)
        .in("kind", ["salary", "food_allowance", "meal_allowance", "extra_income"]);

      // Tabela ainda não existe (migration 011 pendente): não bloqueia o save.
      if (error) return;

      const byKind = new Map((existing ?? []).map((r) => [(r as { kind: string }).kind, (r as { id: string }).id]));

      for (const item of items) {
        const active = item.amount > 0 && payday != null;
        const existingId = byKind.get(item.kind);

        if (existingId) {
          await supabase
            .from("fixed_incomes")
            .update({
              title: item.title,
              amount: item.amount,
              due_day: payday ?? 1,
              category_id: item.category_id,
              is_active: active,
            })
            .eq("id", existingId)
            .eq("user_id", userId);
        } else if (active) {
          await supabase.from("fixed_incomes").insert({
            user_id: userId,
            kind: item.kind,
            title: item.title,
            amount: item.amount,
            due_day: payday,
            category_id: item.category_id,
            is_active: true,
            start_date: monthRef,
          });
        }
      }

      await catchUpRecurrences(supabase, userId);
    } catch {
      /* nunca bloqueia o salvamento do planejamento */
    }
  }

  const incomeKindLabel: Record<FixedIncome["kind"], string> = {
    salary: "Salário",
    food_allowance: "Vale alimentação",
    meal_allowance: "Vale refeição",
    extra_income: "Renda extra",
    custom: "Receita fixa",
  };

  async function handleToggleIncomeActive(item: FixedIncome) {
    const userId = cachedUser?.id;
    if (!userId) return;

    const { error } = await supabase
      .from("fixed_incomes")
      .update({ is_active: !item.is_active })
      .eq("id", item.id)
      .eq("user_id", userId);

    if (error) {
      showMessage(`Erro ao atualizar receita fixa: ${error.message}`, "error");
      return;
    }

    invalidateFinancialData();
    await loadPage(monthRef, true);
  }

  async function handleDeleteIncome(item: FixedIncome) {
    const userId = cachedUser?.id;
    if (!userId) return;

    const confirmed = await confirm({
      title: "Excluir receita fixa",
      message:
        item.kind === "custom"
          ? `Deseja excluir "${item.title}"? As transações já geradas não serão removidas.`
          : `Deseja excluir "${item.title}"? Se você salvar o planejamento novamente com esse campo preenchido, ela volta a ser criada.`,
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;

    const { error } = await supabase.from("fixed_incomes").delete().eq("id", item.id).eq("user_id", userId);
    if (error) {
      showMessage(`Erro ao excluir receita fixa: ${error.message}`, "error");
      return;
    }

    if (editingIncomeId === item.id) setEditingIncomeId(null);
    showMessage("Receita fixa excluída.", "success");
    invalidateFinancialData();
    await loadPage(monthRef, true);
  }

  function startEditIncome(item: FixedIncome) {
    setEditingIncomeId(item.id);
    setEditIncomeTitle(item.title);
    setEditIncomeAmount(formatMoneyInputValue(item.amount));
    setEditIncomeDueDay(String(item.due_day));
    setEditIncomeCategoryId(item.category_id ?? "");
  }

  function cancelEditIncome() {
    setEditingIncomeId(null);
  }

  async function saveEditIncome(item: FixedIncome) {
    const userId = cachedUser?.id;
    if (!userId) return;

    const parsedAmount = parseMoneyInput(editIncomeAmount);
    const parsedDueDay = Number(editIncomeDueDay);

    if (item.kind === "custom" && !editIncomeTitle.trim()) {
      showMessage("Informe o nome da receita fixa.", "error");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      showMessage("Informe um valor válido.", "error");
      return;
    }
    if (!parsedDueDay || parsedDueDay < 1 || parsedDueDay > 31) {
      showMessage("Informe um dia de recebimento válido.", "error");
      return;
    }

    setSavingIncomeEdit(true);
    const payload: Record<string, unknown> = {
      amount: parsedAmount,
      due_day: parsedDueDay,
      category_id: editIncomeCategoryId || null,
    };
    if (item.kind === "custom") payload.title = editIncomeTitle.trim();

    const { error } = await supabase
      .from("fixed_incomes")
      .update(payload)
      .eq("id", item.id)
      .eq("user_id", userId);

    if (!error) {
      try {
        await catchUpRecurrences(supabase, userId);
      } catch {
        /* segue mesmo se o catch-up falhar */
      }
    }

    setSavingIncomeEdit(false);

    if (error) {
      showMessage(`Erro ao salvar receita fixa: ${error.message}`, "error");
      return;
    }

    setEditingIncomeId(null);
    showMessage("Receita fixa atualizada.", "success");
    invalidateFinancialData();
    await loadPage(monthRef, true);
  }

  async function handleCreateCustomIncome(e: FormEvent) {
    e.preventDefault();
    const userId = cachedUser?.id;
    if (!userId) {
      showMessage("Usuário não autenticado.", "error");
      return;
    }

    const parsedAmount = parseMoneyInput(newIncomeAmount);
    const parsedDueDay = Number(newIncomeDueDay);

    if (!newIncomeTitle.trim()) {
      showMessage("Informe o nome da receita fixa.", "error");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      showMessage("Informe um valor válido.", "error");
      return;
    }
    if (!parsedDueDay || parsedDueDay < 1 || parsedDueDay > 31) {
      showMessage("Informe um dia de recebimento válido.", "error");
      return;
    }

    setSavingNewIncome(true);
    const { error } = await supabase.from("fixed_incomes").insert({
      user_id: userId,
      kind: "custom",
      title: newIncomeTitle.trim(),
      amount: parsedAmount,
      due_day: parsedDueDay,
      category_id: newIncomeCategoryId || null,
      is_active: true,
      start_date: monthRef,
    });

    if (!error) {
      try {
        await catchUpRecurrences(supabase, userId);
      } catch {
        /* segue mesmo se o catch-up falhar */
      }
    }

    setSavingNewIncome(false);

    if (error) {
      showMessage(`Erro ao criar receita fixa: ${error.message}`, "error");
      return;
    }

    setNewIncomeTitle("");
    setNewIncomeAmount("");
    setNewIncomeDueDay("");
    setNewIncomeCategoryId("");
    showMessage("Receita fixa criada.", "success");
    invalidateFinancialData();
    await loadPage(monthRef, true);
  }

  async function handleSaveBudget(e: FormEvent) {
    e.preventDefault();
    setSavingBudget(true);
    setMessage("");

    const userId = cachedUser?.id;
    if (!userId) {
      showMessage("Usuário não autenticado.", "error");
      setSavingBudget(false);
      return;
    }

    const parsedAmount = parseMoneyInput(budgetAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      setSavingBudget(false);
      showMessage("Informe um valor de orçamento válido.", "error");
      return;
    }

    const category = budgetCategoryId === "general" ? null : budgetCategoryId;
    let query = supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .eq("month_ref", monthRef);

    query = category === null ? query.is("category_id", null) : query.eq("category_id", category);
    const existing = await query.maybeSingle();

    if (existing.error) {
      setSavingBudget(false);
      showMessage(`Erro ao verificar orçamento existente: ${existing.error.message}`, "error");
      return;
    }

    const response = existing.data?.id
      ? await supabase.from("budgets").update({ amount: parsedAmount }).eq("id", existing.data.id)
      : await supabase
          .from("budgets")
          .insert({ user_id: userId, category_id: category, month_ref: monthRef, amount: parsedAmount });

    setSavingBudget(false);

    if (response.error) {
      showMessage(`Erro ao salvar orçamento: ${response.error.message}`, "error");
      return;
    }

    setBudgetAmount("");
    setBudgetCategoryId("general");
    showMessage("Orçamento salvo com sucesso.", "success");
    invalidateFinancialData();
    await loadPage(monthRef, true);
  }

  async function handleDeleteBudget(id: string) {
    const confirmed = await confirm({
      title: "Excluir orçamento",
      message: "Deseja excluir este orçamento do mês?",
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;

    const { error } = await supabase.from("budgets").delete().eq("id", id).eq("user_id", cachedUser!.id);
    if (error) {
      showMessage(`Erro ao excluir orçamento: ${error.message}`, "error");
      return;
    }

    showMessage("Orçamento excluído com sucesso.", "success");
    invalidateFinancialData();
    await loadPage(monthRef, true);
  }

  const generalBudget = budgets.find((budget) => budget.category_id === null) || null;
  const plannedIncome =
    parseMoneyInput(salaryAmount) + parseMoneyInput(extraIncomeAmount) + parseMoneyInput(openingBalance);
  const benefits = parseMoneyInput(foodAllowance) + parseMoneyInput(mealAllowance);
  const fixedTotal = fixedExpenses.reduce((acc, item) => acc + Number(item.amount), 0);
  const balanceAfterFixed = plannedIncome - fixedTotal;

  return (
    <PageFrame>
      <PageHeader
        title="Planejamento mensal"
        description="Planeje seu mês com calma: renda, benefícios e quanto dá pra gastar."
        eyebrow="Plano do mês"
        actions={
          <div className="w-full sm:w-auto">
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Mês de referência</label>
            <input
              className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)] sm:w-[220px]"
              type="month"
              value={monthRef.slice(0, 7)}
              onChange={(e) => handleChangeMonth(e.target.value)}
            />
          </div>
        }
      />

      <div className="space-y-5">
      {message ? <Alert type={messageType}>{message}</Alert> : null}

      <HominhoTip
        page="planejamento-mensal"
        hominho="timachi"
        tips={useMemo(
          () =>
            planejamentoTips({
              monthKey: monthRef.slice(0, 7),
              hasSalary: parseMoneyInput(salaryAmount) > 0,
              hasCategoryBudgets: budgets.some((item) => item.category_id !== null),
            }),
          [monthRef, salaryAmount, budgets]
        )}
      />

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Surface className="min-w-0 bg-[var(--hero-gradient)] p-6 text-[var(--text)]">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Base financeira</p>
          <p className="mt-3 text-4xl font-bold">{formatCurrency(plannedIncome)}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{formatMonthLabel(monthRef)} com benefícios, saldo inicial e renda extra.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Benefícios</p>
              <p className="font-bold">{formatCurrency(benefits)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Fixos ativos</p>
              <p className="font-bold">{formatCurrency(fixedTotal)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Saldo após fixos</p>
              <p className="font-bold">{formatCurrency(balanceAfterFixed)}</p>
            </div>
          </div>
        </Surface>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <StatCard label="Orçamento geral" value={formatCurrency(Number(generalBudget?.amount ?? 0))} tone="brand" />
          <StatCard label="Limites cadastrados" value={String(budgets.length)} detail="Geral e por categoria" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Surface className="min-w-0">
          <SectionHeader title="Entradas e benefícios" eyebrow={`Base financeira de ${formatMonthLabel(monthRef)}`} />
          <form onSubmit={handleSaveControl} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Salário mensal</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  onBlur={(e) => setSalaryAmount(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Renda extra</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={extraIncomeAmount}
                  onChange={(e) => setExtraIncomeAmount(e.target.value)}
                  onBlur={(e) => setExtraIncomeAmount(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Saldo inicial</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  onBlur={(e) => setOpeningBalance(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Dia do pagamento</span>
                <input
                  className="control"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex: 5"
                  value={paydayDay}
                  onChange={(e) => setPaydayDay(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Vale alimentação</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={foodAllowance}
                  onChange={(e) => setFoodAllowance(e.target.value)}
                  onBlur={(e) => setFoodAllowance(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Vale refeição</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={mealAllowance}
                  onChange={(e) => setMealAllowance(e.target.value)}
                  onBlur={(e) => setMealAllowance(formatMoneyInputValue(e.target.value))}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Observações</span>
              <textarea
                className="control min-h-[108px]"
                placeholder="Anotações do mês (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={savingControl}
              className="btn-primary px-5 py-3 disabled:opacity-70"
            >
              {savingControl ? "Salvando..." : "Salvar planejamento"}
            </button>
          </form>
        </Surface>

        <div className="min-w-0 space-y-4">
          <Surface>
            <SectionHeader title="Orçamentos do mês" eyebrow="Limites" />
            <form onSubmit={handleSaveBudget} className="mt-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Aplicar em</span>
                <select
                  className="control"
                  value={budgetCategoryId}
                  onChange={(e) => setBudgetCategoryId(e.target.value)}
                >
                  <option value="general">Geral do mês</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      Categoria: {category.name}
                    </option>
                  ))}
                </select>
              </label>
              {categories.length === 0 ? (
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Nenhuma categoria de despesa cadastrada. Ainda é possível criar o orçamento geral do mês.
                </p>
              ) : null}
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Valor do orçamento</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  onBlur={(e) => setBudgetAmount(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <button
                type="submit"
                disabled={savingBudget}
                className="btn-primary px-5 py-3 disabled:opacity-70"
              >
                {savingBudget ? "Salvando..." : "Salvar orçamento"}
              </button>
            </form>
          </Surface>

          <Surface>
            <SectionHeader title="Limites cadastrados" eyebrow={`Mês selecionado: ${formatMonthLabel(monthRef)}`} />
            <div className="mt-4">
              {loading ? (
<SkeletonList rows={2} />
              ) : budgets.length === 0 ? (
                <EmptyState
                  title="Sem limites cadastrados"
                  description="Crie um orçamento geral ou por categoria."
                />
              ) : (
                <div className="space-y-2">
                  {budgets.map((budget) => (
                    <div
                      key={budget.id}
                      className="flex flex-col gap-2 rounded-[16px] border border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-[var(--text)]">
                          {categoryName(budget.categories, "Orçamento geral")}
                        </p>
                        <p className="text-sm text-[var(--muted)]">{formatCurrency(Number(budget.amount))}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteBudget(budget.id)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Surface>
        </div>
      </section>

      <Surface>
        <SectionHeader
          title="Receitas fixas"
          eyebrow="Salário, vales e outras entradas recorrentes"
        />
        <p className="mt-1 text-sm text-[var(--muted)]">
          Salário e vales vêm do formulário acima; aqui você ajusta valor, dia e categoria de cada
          uma, ativa/inativa ou exclui. Pode cadastrar outras receitas fixas também.
        </p>

        <div className="mt-4">
          {loading ? (
            <SkeletonList rows={2} />
          ) : fixedIncomes.length === 0 ? (
            <EmptyState
              title="Sem receitas fixas ainda"
              description="Preencha o salário no formulário acima ou crie uma receita fixa abaixo."
            />
          ) : (
            <div className="space-y-2">
              {fixedIncomes.map((item) => {
                const isEditing = editingIncomeId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-[16px] border border-[var(--line)] px-4 py-3"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        {item.kind === "custom" ? (
                          <label className="block space-y-1.5">
                            <span className="text-xs font-semibold text-[var(--text)]">Nome</span>
                            <input
                              className="control"
                              type="text"
                              value={editIncomeTitle}
                              onChange={(e) => setEditIncomeTitle(e.target.value)}
                            />
                          </label>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="block space-y-1.5">
                            <span className="text-xs font-semibold text-[var(--text)]">Valor</span>
                            <input
                              className="control"
                              type="text"
                              placeholder="0,00"
                              value={editIncomeAmount}
                              onChange={(e) => setEditIncomeAmount(e.target.value)}
                              onBlur={(e) => setEditIncomeAmount(formatMoneyInputValue(e.target.value))}
                            />
                          </label>
                          <label className="block space-y-1.5">
                            <span className="text-xs font-semibold text-[var(--text)]">Dia</span>
                            <input
                              className="control"
                              type="number"
                              min={1}
                              max={31}
                              value={editIncomeDueDay}
                              onChange={(e) => setEditIncomeDueDay(e.target.value)}
                            />
                          </label>
                          <label className="block space-y-1.5">
                            <span className="text-xs font-semibold text-[var(--text)]">Categoria</span>
                            <select
                              className="control"
                              value={editIncomeCategoryId}
                              onChange={(e) => setEditIncomeCategoryId(e.target.value)}
                            >
                              <option value="">Sem categoria</option>
                              {getCategoriesByType("income").map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditIncome(item)}
                            disabled={savingIncomeEdit}
                            className="btn-primary px-4 py-2 text-sm disabled:opacity-70"
                          >
                            {savingIncomeEdit ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditIncome}
                            className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[var(--text)]">
                            {item.title}
                            {item.kind !== "custom" ? (
                              <span className="ml-2 rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                                {incomeKindLabel[item.kind]}
                              </span>
                            ) : null}
                            {!item.is_active ? (
                              <span className="ml-2 rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                                Inativa
                              </span>
                            ) : null}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {formatCurrency(Number(item.amount))} · dia {item.due_day} ·{" "}
                            {categoryName(item.categories, "Sem categoria")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditIncome(item)}
                            className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleIncomeActive(item)}
                            className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                          >
                            {item.is_active ? "Inativar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteIncome(item)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleCreateCustomIncome} className="mt-5 space-y-4 border-t border-[var(--line)] pt-5">
          <p className="text-sm font-semibold text-[var(--text)]">Nova receita fixa</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Nome</span>
              <input
                className="control"
                type="text"
                placeholder="Ex: Aluguel recebido, Pensão..."
                value={newIncomeTitle}
                onChange={(e) => setNewIncomeTitle(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Valor</span>
              <input
                className="control"
                type="text"
                placeholder="0,00"
                value={newIncomeAmount}
                onChange={(e) => setNewIncomeAmount(e.target.value)}
                onBlur={(e) => setNewIncomeAmount(formatMoneyInputValue(e.target.value))}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Dia do recebimento</span>
              <input
                className="control"
                type="number"
                min={1}
                max={31}
                placeholder="Ex: 5"
                value={newIncomeDueDay}
                onChange={(e) => setNewIncomeDueDay(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Categoria</span>
              <select
                className="control"
                value={newIncomeCategoryId}
                onChange={(e) => setNewIncomeCategoryId(e.target.value)}
              >
                <option value="">Sem categoria</option>
                {getCategoriesByType("income").map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={savingNewIncome}
            className="btn-primary px-5 py-3 disabled:opacity-70"
          >
            {savingNewIncome ? "Salvando..." : "Criar receita fixa"}
          </button>
        </form>
      </Surface>
      </div>
    </PageFrame>
  );
}
