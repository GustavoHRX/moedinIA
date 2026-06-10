"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { currentMonthRef } from "@/lib/dates";
import { formatCurrency } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import { Alert, EmptyState, PageFrame, PageHeader, SectionHeader, StatCard, Surface } from "@/components/ui-kit";

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

type MonthlyPlanningData = {
  control: MonthlyControl | null;
  categories: Category[];
  budgets: BudgetItem[];
  fixedExpenses: FixedExpense[];
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

  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCategoryId, setBudgetCategoryId] = useState("general");

  const [loading, setLoading] = useState(true);
  const [savingControl, setSavingControl] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [message, setMessage] = useState("");

  const applyPlanningData = useCallback((data: MonthlyPlanningData) => {
    setCategories(data.categories);
    setBudgets(data.budgets);
    setFixedExpenses(data.fixedExpenses);

    const item = data.control;
    if (item) {
      setControlId(item.id);
      setSalaryAmount(String(item.salary_amount ?? 0));
      setExtraIncomeAmount(String(item.extra_income_amount ?? 0));
      setOpeningBalance(String(item.opening_balance ?? 0));
      setPaydayDay(item.payday_day ? String(item.payday_day) : "");
      setFoodAllowance(String(item.food_allowance ?? 0));
      setMealAllowance(String(item.meal_allowance ?? 0));
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

    const [controlRes, categoriesResult, budgetsRes, fixedRes] = await Promise.all([
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
      salary_amount: Number(salaryAmount.replace(",", ".") || 0),
      extra_income_amount: Number(extraIncomeAmount.replace(",", ".") || 0),
      opening_balance: Number(openingBalance.replace(",", ".") || 0),
      payday_day: paydayDay ? Number(paydayDay) : null,
      food_allowance: Number(foodAllowance.replace(",", ".") || 0),
      meal_allowance: Number(mealAllowance.replace(",", ".") || 0),
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

    showMessage("Planejamento mensal salvo com sucesso.", "success");
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

    const parsedAmount = Number(budgetAmount.replace(",", "."));
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
    Number(salaryAmount || 0) + Number(extraIncomeAmount || 0) + Number(openingBalance || 0);
  const benefits = Number(foodAllowance || 0) + Number(mealAllowance || 0);
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

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Surface className="bg-[var(--hero-gradient)] p-6 text-[var(--text)]">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Base financeira</p>
          <p className="mt-3 text-4xl font-black">{formatCurrency(plannedIncome)}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{formatMonthLabel(monthRef)} com benefícios, saldo inicial e renda extra.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Benefícios</p>
              <p className="font-black">{formatCurrency(benefits)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Fixos ativos</p>
              <p className="font-black">{formatCurrency(fixedTotal)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold text-[var(--muted)]">Saldo após fixos</p>
              <p className="font-black">{formatCurrency(balanceAfterFixed)}</p>
            </div>
          </div>
        </Surface>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Orçamento geral" value={formatCurrency(Number(generalBudget?.amount ?? 0))} tone="brand" />
          <StatCard label="Limites cadastrados" value={String(budgets.length)} detail="Geral e por categoria" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Surface>
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

        <div className="space-y-4">
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
      </div>
    </PageFrame>
  );
}
