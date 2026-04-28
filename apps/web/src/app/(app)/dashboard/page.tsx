"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { currentMonthRef, todayDateInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import NewEntryButton from "@/components/new-entry-button";
import { Badge, EmptyState, PageFrame, PageHeader, SectionHeader, StatCard, Surface } from "@/components/ui-kit";

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
  categories: CategoryRelation;
};

type GoalItem = {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  status: "active" | "completed" | "cancelled";
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

const CHART_COLORS = [
  "#2E9E4F",
  "#1A1A1A",
  "#6E746F",
  "#8BCB9C",
  "#B8DFC3",
  "#e0a128",
  "#ef5d77",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const today = todayDateInput();

      const [transactionsRes, goalsRes, budgetsRes, fixedRes, installmentsRes] =
        await Promise.all([
          supabase
            .from("transactions")
            .select(
              "id, type, amount, description, transaction_date, created_at, category_id, origin_type, installment_number, installment_total, categories(name)"
            )
            .eq("user_id", user.id)
            .eq("status", "active")
            .lte("transaction_date", today)
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("goals")
            .select("id, title, target_amount, current_amount, status")
            .eq("user_id", user.id)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false }),
          supabase
            .from("budgets")
            .select("id, amount, month_ref, category_id, categories(name)")
            .eq("user_id", user.id)
            .order("month_ref", { ascending: false }),
          supabase
            .from("fixed_expenses")
            .select("id, title, amount, due_day, categories(name)")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("due_day", { ascending: true }),
          supabase
            .from("installments")
            .select("id, title, installment_amount, total_installments, start_date")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);

      setLoading(false);

      const error =
        transactionsRes.error ||
        goalsRes.error ||
        budgetsRes.error ||
        fixedRes.error ||
        installmentsRes.error;

      if (error) {
        setMessage(`Erro ao carregar dashboard: ${error.message}`);
        return;
      }

      setTransactions((transactionsRes.data ?? []) as TransactionItem[]);
      setGoals((goalsRes.data ?? []) as GoalItem[]);
      setBudgets((budgetsRes.data ?? []) as BudgetItem[]);
      setFixedExpenses((fixedRes.data ?? []) as FixedExpense[]);
      setInstallments((installmentsRes.data ?? []) as Installment[]);
    }

    loadDashboard();
    window.addEventListener("financial-entry-saved", loadDashboard);

    return () => {
      window.removeEventListener("financial-entry-saved", loadDashboard);
    };
  }, [router, supabase]);

  const monthRef = currentMonthRef();
  const monthlyTransactions = transactions.filter(
    (item) => item.transaction_date.slice(0, 7) === monthRef.slice(0, 7)
  );

  const incomeTotal = monthlyTransactions
    .filter((item) => item.type === "income")
    .reduce((acc, item) => acc + Number(item.amount), 0);

  const expenseTotal = monthlyTransactions
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => acc + Number(item.amount), 0);

  const balance = incomeTotal - expenseTotal;
  const recentTransactions = transactions.slice(0, 6);

  const expensesByCategory: CategoryTotal[] = Object.values(
    monthlyTransactions
      .filter((item) => item.type === "expense")
      .reduce((acc, item) => {
        const key = categoryName(item.categories);
        if (!acc[key]) acc[key] = { name: key, total: 0 };
        acc[key].total += Number(item.amount);
        return acc;
      }, {} as Record<string, CategoryTotal>)
  ).sort((a, b) => b.total - a.total);

  const barData = [
    { name: "Receitas", total: Number(incomeTotal.toFixed(2)) },
    { name: "Despesas", total: Number(expenseTotal.toFixed(2)) },
  ];

  const currentMonthBudgets = budgets.filter(
    (budget) => budget.month_ref.slice(0, 7) === monthRef.slice(0, 7)
  );

  const generalBudget = currentMonthBudgets.find((b) => b.category_id === null);
  const categoryBudgets = currentMonthBudgets.filter((b) => b.category_id !== null);
  const budgetAmount = Number(generalBudget?.amount ?? 0);
  const budgetProgress =
    budgetAmount > 0 ? Math.min((expenseTotal / budgetAmount) * 100, 100) : 0;

  function spentByCategory(categoryId: string | null) {
    return monthlyTransactions
      .filter((item) => item.type === "expense" && item.category_id === categoryId)
      .reduce((acc, item) => acc + Number(item.amount), 0);
  }

  const budgetRemaining = budgetAmount - expenseTotal;
  const topCategory = expensesByCategory[0];

  return (
    <PageFrame>
      <PageHeader
        title="Visão geral"
        description="Seu mês financeiro em uma tela ampla, com entradas, saídas, recorrências e metas sem futuros poluindo a leitura."
        eyebrow="Dashboard financeiro"
      />

      <div className="space-y-5">
        {message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
          <Surface className="relative overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#eefaf4_58%,#dff4e6_100%)] p-6 text-[#1A1A1A] ring-1 ring-[rgba(46,158,79,0.12)] sm:p-7">
            <div className="flex h-full flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Saldo do mês</p>
                <p className={`mt-3 text-4xl font-black sm:text-5xl ${balance >= 0 ? "text-[var(--navy)]" : "text-[var(--danger)]"}`}>
                  {formatCurrency(balance)}
                </p>
                <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-[#5F6662]">
                  Uma leitura consolidada do mês atual, com recorrências, parcelamentos e metas no mesmo fluxo.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-extrabold">
                  <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-[var(--brand-strong)] ring-1 ring-[rgba(46,158,79,0.16)]">
                    Entradas {formatCurrency(incomeTotal)}
                  </span>
                  <span className="rounded-full bg-red-50 px-3 py-1.5 text-[var(--danger)] ring-1 ring-red-100">
                    Saídas {formatCurrency(expenseTotal)}
                  </span>
                </div>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[420px]">
                <div className="rounded-[20px] border border-[rgba(46,158,79,0.16)] bg-white/76 p-4 shadow-[0_10px_24px_rgba(46,158,79,0.08)]">
                  <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-[#5F6662]">Lançamentos</p>
                  <p className="mt-2 text-3xl font-black text-[var(--navy)]">{monthlyTransactions.length}</p>
                  <p className="mt-1 text-xs text-[#5F6662]">No mês atual</p>
                </div>
                <div className="rounded-[20px] border border-[rgba(46,158,79,0.16)] bg-white/76 p-4 shadow-[0_10px_24px_rgba(46,158,79,0.08)]">
                  <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-[#5F6662]">Top categoria</p>
                  <p className="mt-2 truncate text-2xl font-black text-[var(--navy)]">{topCategory ? topCategory.name : "--"}</p>
                  <p className="mt-1 text-xs text-[#5F6662]">{topCategory ? formatCurrency(topCategory.total) : "Sem gastos"}</p>
                </div>
              </div>
            </div>
          </Surface>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <NewEntryButton
              label={
                <span className="flex h-full flex-col items-start justify-center gap-2 text-left">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#21773b] text-2xl text-white">+</span>
                      <span className="font-display text-2xl font-black">Novo lançamento</span>
                  <span className="text-sm font-semibold text-[#5F6662]">Gasto, receita, fixo ou parcelado em um modal.</span>
                </span>
              }
              className="min-h-[170px] rounded-[22px] border border-[rgba(46,158,79,0.22)] bg-[linear-gradient(135deg,#ffffff_0%,#eefaf4_100%)] p-5 text-[#1A1A1A] shadow-[0_18px_38px_rgba(46,158,79,0.14)] ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(46,158,79,0.2)]"
            />
            <button
              type="button"
              onClick={() => router.push("/historico")}
              className="rounded-[22px] border border-[var(--line)] bg-white/90 p-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-strong)]"
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">Histórico</p>
              <p className="mt-4 text-lg font-black text-[var(--navy)]">Ver movimentações</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Lista limpa apenas com lançamentos ocorridos.</p>
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Surface>
            <SectionHeader
              title="Últimos lançamentos"
              eyebrow="Transações recentes"
            />
            {loading ? (
              <p className="text-sm text-[var(--muted)]">Carregando...</p>
            ) : recentTransactions.length === 0 ? (
              <EmptyState title="Sem lançamentos registrados" description="Use Novo lançamento para iniciar seu controle." />
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {recentTransactions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--navy)]">{item.description}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDate(item.transaction_date)} - {categoryName(item.categories)}
                      </p>
                    </div>
                    <p className={`shrink-0 text-sm font-extrabold ${item.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {item.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(item.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface className="bg-white/92">
            <SectionHeader title="Orçamento do mês" eyebrow="Limite de gastos" />
            {generalBudget ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--navy)]">
                    {budgetProgress.toFixed(0)}%
                  </span>
                  <button
                    onClick={() => router.push("/planejamento-mensal")}
                    className="text-sm font-bold text-[var(--brand-strong)]"
                  >
                    Ajustar
                  </button>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                  <div
                    className={`h-full ${budgetProgress >= 100 ? "bg-[var(--danger)]" : budgetProgress >= 80 ? "bg-[var(--warning)]" : "bg-[var(--brand)]"}`}
                    style={{ width: `${budgetProgress}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[var(--muted)]">Utilizado</p>
                    <p className="font-extrabold text-[var(--navy)]">{formatCurrency(expenseTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--muted)]">Disponível</p>
                    <p className={`font-extrabold ${budgetRemaining >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {formatCurrency(budgetRemaining)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="Sem orçamento geral" description="Configure um limite mensal em planejamento." />
            )}
          </Surface>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Surface>
            <SectionHeader title="Gastos por categoria" eyebrow="Distribuição" />
            <div className="h-[320px]">
              {loading || !chartsReady ? (
                <p className="text-sm text-[var(--muted)]">Carregando gráfico...</p>
              ) : expensesByCategory.length === 0 ? (
                <EmptyState title="Sem despesas no mês" description="Os gastos por categoria aparecem aqui." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensesByCategory} dataKey="total" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={2}>
                      {expensesByCategory.map((_, index) => (
                        <Cell key={`pie-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {expensesByCategory.length > 0 ? (
              <div className="mt-2 space-y-2">
                {expensesByCategory.slice(0, 4).map((item, index) => {
                  const percent = expenseTotal > 0 ? (item.total / expenseTotal) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <Badge tone={index === 0 ? "brand" : "neutral"}>{item.name}</Badge>
                        <span className="font-bold text-[var(--navy)]">{formatCurrency(item.total)} ({percent.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                        <div className="h-full bg-[var(--brand)]" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Surface>

          <div className="grid gap-4">
            <Surface>
              <SectionHeader title="Receitas x despesas" eyebrow="Comparativo" />
              <div className="h-[220px]">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid stroke="#edf1ef" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                      <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.name === "Receitas" ? "#2E9E4F" : "#ff4f55"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Carregando grÃ¡fico...</p>
                )}
              </div>
            </Surface>

            <section className="grid gap-4 lg:grid-cols-3">
              <StatCard label="Metas ativas" value={String(goals.filter((goal) => goal.status === "active").length)} tone="brand" />
              <StatCard label="Gastos fixos" value={String(fixedExpenses.length)} detail={fixedExpenses.slice(0, 1)[0]?.title ?? "Sem recorrências"} />
              <StatCard label="Parcelamentos" value={String(installments.length)} detail={installments.slice(0, 1)[0]?.title ?? "Sem compras ativas"} />
            </section>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Surface>
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
                    <p className="font-extrabold text-[var(--navy)]">{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface>
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
                      <p className="font-extrabold text-[var(--navy)]">{formatCurrency(item.installment_amount)}</p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.total_installments}x - início em {formatDate(item.start_date)}</p>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </section>
      </div>
    </PageFrame>
  );
}
