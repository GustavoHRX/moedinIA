      "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { CategoryIcon } from "@/components/category-icon";
import { useCategoryVisual } from "@/components/use-category-visual";
import { HominhoTip } from "@/components/hominho-tip";
import { AnimatedMoney } from "@/components/animated-money";
import { dashboardTips } from "@/lib/tips";
import { ArrowLeftRight, Lightbulb, TrendingUp, TriangleAlert } from "lucide-react";
import { Skeleton, SkeletonBlock, SkeletonList } from "@/components/skeleton";
import { addMonthsClamped, currentMonthRef, todayDateInput } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/components/app-data-provider";
import NewEntryButton from "@/components/new-entry-button";
import { EmptyState, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";

type TransactionItem = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string;
  category_id: string | null;
  origin_type?: "manual" | "fixed_expense" | "installment";
  installment_number?: number | null;
  installment_total?: number | null;
  fixed_expense_id?: string | null;
  installment_id?: string | null;
  categories: CategoryRelation;
};

type BudgetItem = {
  id: string;
  amount: number;
  month_ref: string;
  category_id: string | null;
  categories: CategoryRelation;
};

type FixedExpense = {
  id: string;
  title: string;
  amount: number;
  due_day: number;
  categories: CategoryRelation;
};

type Installment = {
  id: string;
  title: string;
  installment_amount: number;
  total_installments: number;
  start_date: string;
};

type CategoryTotal = {
  name: string;
  total: number;
};

type DashboardData = {
  transactions: TransactionItem[];
  budgets: BudgetItem[];
  fixedExpenses: FixedExpense[];
  installments: Installment[];
};

// Sequência de cores de gráficos do Brand Book v1.3 (pág. 15)
const CHART_COLORS = [
  "#10B981",
  "#6EE7B7",
  "#14B8A6",
  "#FBBF24",
  "#60A5FA",
  "#F87171",
];

// Gráficos (Recharts) carregados sob demanda — fora do bundle inicial.
const chartFallback = () => <div className="skeleton-shimmer h-full w-full rounded-lg" />;
const CategoryDonut = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.CategoryDonut),
  { ssr: false, loading: chartFallback }
);
const IncomeExpenseBars = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.IncomeExpenseBars),
  { ssr: false, loading: chartFallback }
);
const MonthlyBars = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.MonthlyBars),
  { ssr: false, loading: chartFallback }
);

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const resolveCategoryVisual = useCategoryVisual();
  const {
    user: cachedUser,
    loadingUser,
    financialVersion,
    lastRealtimeArrival,
    getFinancialCache,
    setFinancialCache,
  } = useAppData();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    // Espera o navegador pintar o layout antes de montar os gráficos. Sem
    // isso o ResizeObserver do Recharts mede o container antes dele ter
    // tamanho real e loga "width(-1) height(-1)" no console (QA 11/ago/2026).
    const frame = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const applyDashboardData = useCallback((data: DashboardData) => {
    setTransactions(data.transactions);
    setBudgets(data.budgets);
    setFixedExpenses(data.fixedExpenses);
    setInstallments(data.installments);
  }, []);

  const loadDashboard = useCallback(async (forceRefresh = false) => {
    setMessage("");

    if (loadingUser) return;

    const currentUser = cachedUser;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    const today = todayDateInput();
    const cacheKey = `dashboard:${currentUser.id}:${today}`;
    const cachedDashboard = forceRefresh
      ? null
      : getFinancialCache<DashboardData>(cacheKey);

    if (cachedDashboard) {
      applyDashboardData(cachedDashboard);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [transactionsRes, budgetsRes, fixedRes, installmentsRes] =
      await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id, type, amount, description, transaction_date, created_at, category_id, origin_type, installment_number, installment_total, fixed_expense_id, installment_id, categories(name)"
          )
          .eq("user_id", currentUser.id)
          .eq("status", "active")
          .lte("transaction_date", today)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("budgets")
          .select("id, amount, month_ref, category_id, categories(name)")
          .eq("user_id", currentUser.id)
          .order("month_ref", { ascending: false }),
        supabase
          .from("fixed_expenses")
          .select("id, title, amount, due_day, categories(name)")
          .eq("user_id", currentUser.id)
          .eq("is_active", true)
          .order("due_day", { ascending: true }),
        supabase
          .from("installments")
          .select("id, title, installment_amount, total_installments, start_date")
          .eq("user_id", currentUser.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

    setLoading(false);

    const error =
      transactionsRes.error ||
      budgetsRes.error ||
      fixedRes.error ||
      installmentsRes.error;

    if (error) {
      setMessage(`Erro ao carregar dashboard: ${error.message}`);
      return;
    }

    const nextDashboard: DashboardData = {
      transactions: (transactionsRes.data ?? []) as TransactionItem[],
      budgets: (budgetsRes.data ?? []) as BudgetItem[],
      fixedExpenses: (fixedRes.data ?? []) as FixedExpense[],
      installments: (installmentsRes.data ?? []) as Installment[],
    };
    applyDashboardData(nextDashboard);
    setFinancialCache(cacheKey, nextDashboard);
  }, [applyDashboardData, cachedUser, getFinancialCache, loadingUser, router, setFinancialCache, supabase]);

  useEffect(() => {
    loadDashboard();
  }, [financialVersion, loadDashboard]);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthRef());
  const monthRef = selectedMonth;
  const monthName = new Date(`${monthRef}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const monthlyTransactions = useMemo(
    () => transactions.filter((item) => item.transaction_date.slice(0, 7) === monthRef.slice(0, 7)),
    [transactions, monthRef]
  );

  // Soma receitas e despesas em uma única passada (em vez de 4 filter/reduce separados)
  const { incomeTotal, expenseTotal } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const item of monthlyTransactions) {
      if (item.type === "income") income += Number(item.amount);
      else expense += Number(item.amount);
    }
    return { incomeTotal: income, expenseTotal: expense };
  }, [monthlyTransactions]);

  const balance = incomeTotal - expenseTotal;
  const recentTransactions = useMemo(() => transactions.slice(0, 6), [transactions]);

  // Projeção de saldo até o fim do mês: saldo atual menos os gastos fixos e
  // parcelas que ainda vão vencer neste mês (ainda não viraram lançamento).
  const isCurrentMonth = monthRef.slice(0, 7) === currentMonthRef().slice(0, 7);
  const projectedBalance = useMemo(() => {
    if (!isCurrentMonth) return null;

    const fixedDoneIds = new Set(
      monthlyTransactions
        .filter((t) => t.origin_type === "fixed_expense" && t.fixed_expense_id)
        .map((t) => t.fixed_expense_id)
    );
    const pendingFixedTotal = fixedExpenses
      .filter((fe) => !fixedDoneIds.has(fe.id))
      .reduce((sum, fe) => sum + Number(fe.amount), 0);

    const paidCountByInstallment = new Map<string, number>();
    for (const t of transactions) {
      if (t.origin_type === "installment" && t.installment_id) {
        paidCountByInstallment.set(
          t.installment_id,
          (paidCountByInstallment.get(t.installment_id) ?? 0) + 1
        );
      }
    }
    const pendingInstallmentTotal = installments.reduce((sum, item) => {
      const paidCount = paidCountByInstallment.get(item.id) ?? 0;
      if (paidCount >= item.total_installments) return sum;
      const nextDueDate = addMonthsClamped(item.start_date, paidCount);
      if (nextDueDate.slice(0, 7) !== monthRef.slice(0, 7)) return sum;
      return sum + Number(item.installment_amount);
    }, 0);

    return balance - pendingFixedTotal - pendingInstallmentTotal;
  }, [isCurrentMonth, monthlyTransactions, fixedExpenses, transactions, installments, monthRef, balance]);

  const expensesByCategory = useMemo<CategoryTotal[]>(
    () =>
      Object.values(
        monthlyTransactions
          .filter((item) => item.type === "expense")
          .reduce((acc, item) => {
            const key = categoryName(item.categories);
            if (!acc[key]) acc[key] = { name: key, total: 0 };
            acc[key].total += Number(item.amount);
            return acc;
          }, {} as Record<string, CategoryTotal>)
      ).sort((a, b) => b.total - a.total),
    [monthlyTransactions]
  );

  const barData = useMemo(
    () => [
      { name: "Receitas", total: Number(incomeTotal.toFixed(2)) },
      { name: "Despesas", total: Number(expenseTotal.toFixed(2)) },
    ],
    [incomeTotal, expenseTotal]
  );

  const generalBudget = useMemo(
    () => budgets.find((b) => b.category_id === null && b.month_ref.slice(0, 7) === monthRef.slice(0, 7)),
    [budgets, monthRef]
  );
  const budgetAmount = Number(generalBudget?.amount ?? 0);
  const budgetProgress =
    budgetAmount > 0 ? Math.min((expenseTotal / budgetAmount) * 100, 100) : 0;

  const budgetRemaining = budgetAmount - expenseTotal;
  const topCategory = expensesByCategory[0];

  // Insight de IA real (ai-service /insight). Cai em silêncio para as
  // heurísticas locais se o serviço estiver fora ou sem chave configurada.
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  useEffect(() => {
    if (loading || monthlyTransactions.length === 0) return;

    const monthKey = monthRef.slice(0, 7);
    const cacheKey = `moedin-ai-insight:${cachedUser?.id}:${monthKey}:${Math.round(expenseTotal)}`;
    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        setAiInsight(cached);
        return;
      }
    } catch {}

    const aiUrl = process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8000";
    const controller = new AbortController();

    fetch(`${aiUrl}/insight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        month_label: monthName,
        income_total: incomeTotal,
        expense_total: expenseTotal,
        budget_amount: budgetAmount,
        categories: expensesByCategory.slice(0, 8).map((item) => ({
          name: item.name,
          total: item.total,
        })),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; insight?: string } | null) => {
        if (data?.ok && data.insight) {
          setAiInsight(data.insight);
          try {
            window.sessionStorage.setItem(cacheKey, data.insight);
          } catch {}
        }
      })
      .catch(() => {});

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, monthRef, Math.round(expenseTotal), Math.round(incomeTotal)]);

  // Orçamentos por categoria do mês, com gasto e uso calculados localmente
  const categoryBudgets = useMemo(() => {
    const monthKey = monthRef.slice(0, 7);
    return budgets
      .filter((item) => item.category_id !== null && item.month_ref.slice(0, 7) === monthKey)
      .map((item) => {
        const name = categoryName(item.categories);
        const spent = monthlyTransactions
          .filter((tx) => tx.type === "expense" && tx.category_id === item.category_id)
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
        return { id: item.id, name, limit: Number(item.amount), spent };
      })
      .sort(
        (a, b) => b.spent / Math.max(b.limit, 1) - a.spent / Math.max(a.limit, 1)
      );
  }, [budgets, monthlyTransactions, monthRef]);

  const hominhoTips = useMemo(
    () =>
      dashboardTips({
        monthKey: monthRef.slice(0, 7),
        expenseTotal,
        incomeTotal,
        budgetAmount,
        topCategory: topCategory ? { name: topCategory.name, total: topCategory.total } : null,
        transactionsCount: monthlyTransactions.length,
      }),
    [monthRef, expenseTotal, incomeTotal, budgetAmount, topCategory, monthlyTransactions.length]
  );

  // Dados com a cor já resolvida — os componentes de gráfico (lazy) recebem prontos.
  const pieData = useMemo(
    () =>
      expensesByCategory.map((entry, index) => ({
        name: entry.name,
        total: entry.total,
        fill: resolveCategoryVisual(entry.name).color || CHART_COLORS[index % CHART_COLORS.length],
      })),
    [expensesByCategory, resolveCategoryVisual]
  );
  const comparativoData = useMemo(
    () =>
      barData.map((entry) => ({
        name: entry.name,
        total: entry.total,
        fill: entry.name === "Receitas" ? "#34D399" : "#F87171",
      })),
    [barData]
  );

  // Série dos últimos 6 meses (receitas x despesas) a partir das transações já carregadas
  const monthlySeries = useMemo(() => {
    const map = new Map<string, { receitas: number; despesas: number }>();
    for (const t of transactions) {
      const key = t.transaction_date.slice(0, 7);
      const entry = map.get(key) ?? { receitas: 0, despesas: 0 };
      if (t.type === "income") entry.receitas += Number(t.amount);
      else entry.despesas += Number(t.amount);
      map.set(key, entry);
    }
    const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const [year, month] = monthRef.slice(0, 7).split("-").map(Number);
    const series: { mes: string; receitas: number; despesas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const e = map.get(key) ?? { receitas: 0, despesas: 0 };
      series.push({
        mes: labels[d.getMonth()],
        receitas: Number(e.receitas.toFixed(2)),
        despesas: Number(e.despesas.toFixed(2)),
      });
    }
    return series;
  }, [transactions, monthRef]);

  // Insights automáticos calculados a partir dos dados do mês
  const insights = useMemo(() => {
    const list: { tone: "warning" | "tip" | "info"; text: string }[] = [];

    if (budgetAmount > 0) {
      if (expenseTotal > budgetAmount) {
        list.push({ tone: "warning", text: `Você passou do orçamento do mês em ${formatCurrency(expenseTotal - budgetAmount)}.` });
      } else {
        list.push({ tone: "tip", text: `Ainda restam ${formatCurrency(budgetAmount - expenseTotal)} dentro do orçamento do mês.` });
      }
    }

    if (topCategory && expenseTotal > 0) {
      const pct = (topCategory.total / expenseTotal) * 100;
      list.push({ tone: "info", text: `Seu maior gasto é ${topCategory.name}: ${pct.toFixed(0)}% das despesas do mês.` });
    }

    const cur = monthlySeries[monthlySeries.length - 1];
    const prev = monthlySeries[monthlySeries.length - 2];
    if (cur && prev && prev.despesas > 0) {
      const diff = ((cur.despesas - prev.despesas) / prev.despesas) * 100;
      list.push({
        tone: diff > 0 ? "warning" : "tip",
        text: `Seus gastos ${diff >= 0 ? "subiram" : "caíram"} ${Math.abs(diff).toFixed(0)}% em relação ao mês anterior.`,
      });
    }

    if (incomeTotal > 0) {
      const rate = (balance / incomeTotal) * 100;
      if (balance >= 0) {
        list.push({ tone: "tip", text: `Você guardou ${rate.toFixed(0)}% da sua renda este mês.` });
      } else {
        list.push({ tone: "warning", text: "Suas despesas superaram a renda do mês." });
      }
    }

    return list;
  }, [budgetAmount, expenseTotal, topCategory, monthlySeries, incomeTotal, balance]);

  const insightStyle: Record<string, { Icon: typeof Lightbulb; color: string }> = {
    warning: { Icon: TriangleAlert, color: "#F87171" },
    tip: { Icon: TrendingUp, color: "#34D399" },
    info: { Icon: Lightbulb, color: "#FBBF24" },
  };

  // Persiste os insights do mês na tabela ai_insights (uma vez por mês/sessão)
  const insightsPersistRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !cachedUser || insights.length === 0) return;
    const key = `${cachedUser.id}:${monthRef}`;
    if (insightsPersistRef.current === key) return;
    insightsPersistRef.current = key;

    const kindMap = { warning: "warning", tip: "tip", info: "forecast" } as const;
    const titleMap = { warning: "Alerta", tip: "Dica", info: "Análise" } as const;

    void (async () => {
      await supabase
        .from("ai_insights")
        .delete()
        .eq("user_id", cachedUser.id)
        .eq("reference_month", monthRef);
      await supabase.from("ai_insights").insert(
        insights.map((ins) => ({
          user_id: cachedUser.id,
          kind: kindMap[ins.tone],
          title: titleMap[ins.tone],
          message: ins.text,
          reference_month: monthRef,
        }))
      );
    })();
  }, [loading, cachedUser, insights, monthRef, supabase]);

  return (
    <PageFrame>
      <PageHeader
        title="Visão geral"
        description="Num olhar, entenda seu mês: o que entrou, o que saiu e como está o seu saldo."
        eyebrow="Dashboard financeiro"
        actions={
          <div className="w-full sm:w-auto">
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Mês de referência</label>
            <input
              type="month"
              className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-[var(--text)] outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)] sm:w-[200px]"
              value={monthRef.slice(0, 7)}
              max={currentMonthRef().slice(0, 7)}
              onChange={(e) => setSelectedMonth(e.target.value ? `${e.target.value}-01` : currentMonthRef())}
            />
          </div>
        }
      />

      <div className="space-y-5">
        {message ? (
          <div className="alert-error rounded-2xl px-4 py-3 text-sm font-semibold">
            {message}
          </div>
        ) : null}

        <Surface className="relative min-w-0 overflow-hidden bg-[var(--hero-gradient)] p-6 text-[var(--text)] ring-1 ring-[rgba(16,185,129,0.12)] sm:p-7">
          {loading ? (
            // Enquanto carrega, mostra esqueleto em vez de "R$ 0,00" — evita
            // confundir "ainda carregando" com "saldo realmente zerado".
            <div className="flex h-full flex-col justify-between gap-6 lg:flex-row lg:items-stretch">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-12 w-40" />
                <Skeleton className="mt-4 h-3 w-28" />
                <Skeleton className="mt-3 h-10 w-56" />
                <Skeleton className="mt-4 h-4 w-full max-w-md" />
                <Skeleton className="mt-2 h-4 w-2/3 max-w-sm" />
                <div className="mt-5 flex gap-2">
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                </div>
              </div>
              <div className="flex w-full flex-col gap-4 lg:w-[340px]">
                <Skeleton className="h-[92px] w-full rounded-[22px]" />
                <Skeleton className="h-[92px] w-full rounded-[22px]" />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between gap-6 lg:flex-row lg:items-stretch">
              <div>
                <p className="font-display text-5xl font-bold leading-none text-[var(--navy)] sm:text-6xl">
                  Resumo
                </p>
                <p className="mt-3 font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Saldo do mês</p>
                <p className={`mt-3 text-4xl sm:text-5xl ${balance >= 0 ? "text-[var(--navy)]" : "text-[var(--danger)]"}`}>
                  <AnimatedMoney value={balance} />
                </p>
                <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-[var(--muted)]">
                  Uma leitura consolidada de {monthName}, com recorrências, parcelamentos e metas no mesmo fluxo.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-[var(--brand-strong)] ring-1 ring-[rgba(16,185,129,0.16)]">
                    Entradas <AnimatedMoney value={incomeTotal} />
                  </span>
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-1.5 text-[var(--danger)] ring-1 ring-[color-mix(in_srgb,var(--danger)_25%,transparent)]">
                    Saídas <AnimatedMoney value={expenseTotal} />
                  </span>
                  {projectedBalance !== null ? (
                    <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1.5 text-[var(--muted-strong)] ring-1 ring-[var(--line)]">
                      Previsão fim do mês <AnimatedMoney value={projectedBalance} />
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex w-full flex-col gap-4 lg:w-[340px]">
                <div className="flex flex-1 items-center gap-4 rounded-[22px] border border-[rgba(16,185,129,0.16)] bg-[var(--surface-muted)] p-6 shadow-[0_10px_24px_rgba(16,185,129,0.08)]">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <ArrowLeftRight className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Lançamentos</p>
                    <p className="font-display text-4xl font-bold leading-none text-[var(--navy)]">{monthlyTransactions.length}</p>
                    <p className="mt-1.5 text-xs text-[var(--muted)]">Em {monthName}</p>
                  </div>
                </div>
                <div className="flex flex-1 items-center gap-4 rounded-[22px] border border-[rgba(16,185,129,0.16)] bg-[var(--surface-muted)] p-6 shadow-[0_10px_24px_rgba(16,185,129,0.08)]">
                  {topCategory ? (
                    <CategoryIcon name={topCategory.name} box={56} size={26} />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-soft)] text-[var(--muted)]">--</span>
                  )}
                  <div className="min-w-0">
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Top categoria</p>
                    <p className="truncate font-display text-2xl font-bold leading-tight text-[var(--navy)]">{topCategory ? topCategory.name : "--"}</p>
                    <p className="mt-1.5 text-xs text-[var(--muted)]">{topCategory ? `${formatCurrency(topCategory.total)} no mês` : "Sem gastos ainda"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Surface>

        <section className="grid gap-5 sm:grid-cols-2">
          <NewEntryButton
            label={
              <span className="flex h-full flex-col items-start justify-center gap-2 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)] text-2xl text-[var(--on-primary)]">+</span>
                <span className="font-display text-2xl font-bold">Novo lançamento</span>
                <span className="text-sm font-semibold text-[var(--muted)]">Gasto, receita, fixo ou parcelado em um modal.</span>
              </span>
            }
            className="flex min-h-[150px] flex-col justify-center rounded-[22px] border border-[rgba(16,185,129,0.22)] bg-[var(--hero-gradient)] p-5 text-[var(--text)] shadow-[0_18px_38px_rgba(16,185,129,0.14)] ring-1 ring-[var(--line)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(16,185,129,0.2)]"
          />
          <button
            type="button"
            onClick={() => router.push("/historico")}
            className="flex min-h-[150px] flex-col justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-strong)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Histórico</p>
            <p className="mt-2 text-lg font-bold text-[var(--navy)]">Ver movimentações</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Lista limpa apenas com lançamentos ocorridos.</p>
          </button>
        </section>

        {!loading ? <HominhoTip page="dashboard" hominho="joao" tips={hominhoTips} /> : null}

        {!loading && (insights.length > 0 || aiInsight) ? (
          <Surface>
            <SectionHeader title="Insights" eyebrow="Análise automática do mês" />
            {aiInsight ? (
              <div className="anim-pop-in mb-3 flex items-start gap-3 rounded-2xl border border-[rgba(16,185,129,0.3)] bg-[var(--primary-soft)] px-4 py-3.5 shadow-[var(--glow)]">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm text-[var(--on-primary)]">
                  ✦
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--mint)]">
                    ✦ Insight da IA
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[var(--text)]">{aiInsight}</p>
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.map((ins, index) => {
                const { Icon, color } = insightStyle[ins.tone];
                return (
                  <div key={index} className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3">
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}1f`, color }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold leading-6 text-[var(--text)]">{ins.text}</p>
                  </div>
                );
              })}
            </div>
          </Surface>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Surface className="min-w-0">
            <SectionHeader title="Gastos por categoria" eyebrow="Distribuição" />
            <div className="h-[320px]">
              {loading || !chartsReady ? (
                <SkeletonBlock className="h-full" />
              ) : expensesByCategory.length === 0 ? (
                <EmptyState title="Sem despesas no mês" description="Os gastos por categoria aparecem aqui." />
              ) : (
                <CategoryDonut data={pieData} />
              )}
            </div>
            {expensesByCategory.length > 0 ? (
              <div className="mt-4 space-y-3">
                {expensesByCategory.slice(0, 6).map((item) => {
                  const percent = expenseTotal > 0 ? (item.total / expenseTotal) * 100 : 0;
                  const color = resolveCategoryVisual(item.name).color;
                  return (
                    <div key={item.name}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate font-bold text-[var(--navy)]">{item.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-[var(--muted)]">{formatCurrency(item.total)} · {percent.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Surface>

          <div className="grid min-w-0 gap-4">
            <Surface>
              <SectionHeader title="Receitas x despesas" eyebrow="Comparativo" />
              <div className="h-[220px]">
                {chartsReady ? (
                  <IncomeExpenseBars data={comparativoData} />
                ) : (
                  <SkeletonBlock className="h-full" />
                )}
              </div>
            </Surface>

            <Surface>
              <SectionHeader title="Orçamento do mês" eyebrow="Limite de gastos" />
              {generalBudget ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--navy)]">{budgetProgress.toFixed(0)}%</span>
                    <button onClick={() => router.push("/planejamento-mensal")} className="text-sm font-bold text-[var(--brand-strong)]">Ajustar</button>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                    <div className={`h-full ${budgetProgress >= 100 ? "bg-[var(--danger)]" : budgetProgress >= 80 ? "bg-[var(--warning)]" : "bg-[var(--brand)]"}`} style={{ width: `${budgetProgress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--muted)]">Usado <span className="font-semibold text-[var(--navy)]">{formatCurrency(expenseTotal)}</span></span>
                    <span className="text-[var(--muted)]">Resta <span className={`font-semibold ${budgetRemaining >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{formatCurrency(budgetRemaining)}</span></span>
                  </div>
                </div>
              ) : (
                <EmptyState title="Sem orçamento geral" description="Configure um limite mensal em planejamento." />
              )}

              {categoryBudgets.length > 0 ? (
                <div className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                    Por categoria
                  </p>
                  {categoryBudgets.slice(0, 5).map((item) => {
                    const percent = item.limit > 0 ? Math.min((item.spent / item.limit) * 100, 100) : 0;
                    const over = item.limit > 0 && item.spent > item.limit;
                    const color = resolveCategoryVisual(item.name).color;
                    return (
                      <div key={item.id}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                            <span className="truncate font-bold text-[var(--navy)]">{item.name}</span>
                          </span>
                          <span className={`shrink-0 font-semibold ${over ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                            {formatCurrency(item.spent)} de {formatCurrency(item.limit)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: over ? "var(--danger)" : color,
                              transition: "width var(--dur-slow) var(--ease-out)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Surface>
          </div>
        </section>

        <Surface>
            <SectionHeader title="Últimos lançamentos" eyebrow="Transações recentes" />
            {loading ? (
              <SkeletonList rows={5} />
            ) : recentTransactions.length === 0 ? (
              <EmptyState title="Sem lançamentos registrados" description="Use Novo lançamento para iniciar seu controle." />
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {recentTransactions.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-4 py-3 ${
                      lastRealtimeArrival &&
                      item.id === lastRealtimeArrival.id &&
                      Date.now() - lastRealtimeArrival.at < 10_000
                        ? "anim-flash-in -mx-2 rounded-xl px-2"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryIcon name={categoryName(item.categories, "")} box={34} size={15} />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--navy)]">{item.description}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatDate(item.transaction_date)} - {categoryName(item.categories)}
                        </p>
                      </div>
                    </div>
                    <p className={`shrink-0 text-sm font-semibold ${item.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {item.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(item.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
        </Surface>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface className="min-w-0">
            <SectionHeader
              title="Gastos fixos ativos"
              action={<button onClick={() => router.push("/gastos-fixos")} className="text-sm font-bold text-[var(--brand-strong)]">Ver todos</button>}
            />
            {fixedExpenses.length === 0 ? (
              <EmptyState title="Sem gastos fixos" description="Cadastre despesas recorrentes para acompanhar melhor o mês." />
            ) : (
              <div className="space-y-2">
                {fixedExpenses.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-[16px] border border-[var(--line)] px-4 py-3">
                    <div>
                      <p className="font-bold text-[var(--navy)]">{item.title}</p>
                      <p className="text-xs text-[var(--muted)]">Dia {item.due_day} - {categoryName(item.categories)}</p>
                    </div>
                    <p className="font-semibold text-[var(--navy)]">{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface className="min-w-0">
            <SectionHeader
              title="Parcelamentos ativos"
              action={<button onClick={() => router.push("/parcelamentos")} className="text-sm font-bold text-[var(--brand-strong)]">Ver todos</button>}
            />
            {installments.length === 0 ? (
              <EmptyState title="Sem parcelamentos" description="Adicione compras parceladas para visualizar parcelas e progresso." />
            ) : (
              <div className="space-y-2">
                {installments.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-[16px] border border-[var(--line)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-[var(--navy)]">{item.title}</p>
                      <p className="font-semibold text-[var(--navy)]">{formatCurrency(item.installment_amount)}</p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.total_installments}x - início em {formatDate(item.start_date)}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </section>

        <Surface>
          <SectionHeader title="Evolução dos últimos meses" eyebrow="Receitas x despesas no tempo" />
          <div className="h-[300px]">
            {chartsReady ? (
              <MonthlyBars data={monthlySeries} />
            ) : (
              <SkeletonBlock className="h-full" />
            )}
          </div>
        </Surface>
      </div>
    </PageFrame>
  );
}
