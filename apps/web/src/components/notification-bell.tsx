"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, TriangleAlert, X } from "lucide-react";
import { useAppData } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { addMonthsClamped, currentMonthRef, todayDateInput } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { categoryName, type CategoryRelation } from "@/lib/categories";

const DUE_SOON_DAYS = 5;

type FixedExpenseRow = {
  id: string;
  title: string;
  amount: number;
  due_day: number;
};

type InstallmentRow = {
  id: string;
  title: string;
  installment_amount: number;
  total_installments: number;
  start_date: string;
};

type TxRow = {
  type: "income" | "expense";
  amount: number;
  category_id: string | null;
  origin_type: "manual" | "fixed_expense" | "installment" | null;
  fixed_expense_id: string | null;
  installment_id: string | null;
};

type BudgetRow = {
  id: string;
  category_id: string | null;
  amount: number;
  alert_percent: number;
  categories: CategoryRelation;
};

type Alert = {
  id: string;
  tone: "warning" | "danger";
  title: string;
  detail: string;
  href: string;
};

function daysUntil(dateStr: string) {
  const today = new Date(`${todayDateInput()}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dismissedKey(userId: string) {
  // Escopo por dia: um aviso apagado hoje pode voltar amanhã se ainda
  // estiver pendente — evita esconder algo importante pra sempre por engano.
  return `moedin-dismissed-alerts:${userId}:${todayDateInput()}`;
}

function readDismissed(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(dismissedKey(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export default function NotificationBell({
  className,
  openUpward = false,
}: {
  className?: string;
  openUpward?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { user, financialVersion } = useAppData();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const today = todayDateInput();
    const monthRef = currentMonthRef();
    const monthKey = monthRef.slice(0, 7);

    const [fixedRes, installmentsRes, txRes, allInstallmentTxRes, budgetsRes] = await Promise.all([
      supabase
        .from("fixed_expenses")
        .select("id, title, amount, due_day")
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("installments")
        .select("id, title, installment_amount, total_installments, start_date")
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("transactions")
        .select("type, amount, category_id, origin_type, fixed_expense_id, installment_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("transaction_date", `${monthKey}-01`)
        .lte("transaction_date", today),
      supabase
        .from("transactions")
        .select("installment_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("origin_type", "installment"),
      supabase
        .from("budgets")
        .select("id, category_id, amount, alert_percent, categories(name)")
        .eq("user_id", user.id)
        .eq("month_ref", monthRef),
    ]);

    const fixedExpenses = (fixedRes.data ?? []) as FixedExpenseRow[];
    const installments = (installmentsRes.data ?? []) as InstallmentRow[];
    const monthlyTx = (txRes.data ?? []) as TxRow[];
    const allInstallmentTx = (allInstallmentTxRes.data ?? []) as { installment_id: string | null }[];
    const budgets = (budgetsRes.data ?? []) as BudgetRow[];

    const next: Alert[] = [];

    const fixedDoneIds = new Set(
      monthlyTx.filter((t) => t.origin_type === "fixed_expense" && t.fixed_expense_id).map((t) => t.fixed_expense_id)
    );
    for (const item of fixedExpenses) {
      if (fixedDoneIds.has(item.id)) continue;
      const todayDay = Number(today.slice(8, 10));
      const diff = item.due_day - todayDay;
      // Só avisa do que ainda vai vencer. Se já passou do dia e não tem
      // lançamento, é o catch-up automático que vai resolver no próximo
      // carregamento — não é algo que precise de ação do usuário.
      if (diff < 0 || diff > DUE_SOON_DAYS) continue;
      next.push({
        id: `fixed:${item.id}`,
        tone: "warning",
        title: item.title,
        detail:
          diff === 0
            ? `Vence hoje - ${formatCurrency(item.amount)}`
            : `Vence em ${diff} dia${diff > 1 ? "s" : ""} - ${formatCurrency(item.amount)}`,
        href: "/gastos-fixos",
      });
    }

    const paidCountByInstallment = new Map<string, number>();
    for (const t of allInstallmentTx) {
      if (!t.installment_id) continue;
      paidCountByInstallment.set(t.installment_id, (paidCountByInstallment.get(t.installment_id) ?? 0) + 1);
    }
    for (const item of installments) {
      const paidCount = paidCountByInstallment.get(item.id) ?? 0;
      if (paidCount >= item.total_installments) continue;
      const nextDueDate = addMonthsClamped(item.start_date, paidCount);
      const diff = daysUntil(nextDueDate);
      if (diff < 0 || diff > DUE_SOON_DAYS) continue;
      const alreadyDone = monthlyTx.some((t) => t.origin_type === "installment" && t.installment_id === item.id);
      if (alreadyDone) continue;
      next.push({
        id: `installment:${item.id}`,
        tone: "warning",
        title: item.title,
        detail:
          diff === 0
            ? `Parcela vence hoje - ${formatCurrency(item.installment_amount)}`
            : `Parcela vence em ${diff} dia${diff > 1 ? "s" : ""} - ${formatCurrency(item.installment_amount)}`,
        href: "/parcelamentos",
      });
    }

    for (const budget of budgets) {
      const spent = monthlyTx
        .filter((t) => t.type === "expense" && (budget.category_id === null || t.category_id === budget.category_id))
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const amount = Number(budget.amount);
      if (amount <= 0) continue;
      const pct = (spent / amount) * 100;
      const alertPercent = budget.alert_percent || 80;
      if (pct < alertPercent) continue;
      const label = budget.category_id === null ? "Orçamento geral" : categoryName(budget.categories);
      next.push({
        id: `budget:${budget.id}`,
        tone: pct >= 100 ? "danger" : "warning",
        title: label,
        detail:
          pct >= 100
            ? `Estourou o limite: ${formatCurrency(spent)} de ${formatCurrency(amount)}`
            : `Perto do limite: ${formatCurrency(spent)} de ${formatCurrency(amount)} (${pct.toFixed(0)}%)`,
        href: "/planejamento-mensal",
      });
    }

    const dismissed = readDismissed(user.id);
    setAlerts(next.filter((alert) => !dismissed.has(alert.id)));
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load, financialVersion]);

  function dismiss(id: string) {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    if (!user) return;
    try {
      const dismissed = readDismissed(user.id);
      dismissed.add(id);
      window.localStorage.setItem(dismissedKey(user.id), JSON.stringify([...dismissed]));
    } catch {}
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={className}
        aria-label="Avisos"
        aria-expanded={open}
      >
        <span className="relative inline-flex">
          <Bell className="h-4 w-4" />
          {alerts.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Fechar avisos"
            onClick={() => setOpen(false)}
          />
          <div
            className={`fixed left-1/2 top-[72px] z-50 w-[calc(100vw-1.5rem)] max-w-[360px] -translate-x-1/2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-3 shadow-[var(--shadow-strong)] sm:absolute sm:left-auto sm:top-auto sm:w-[320px] sm:max-w-[calc(100vw-2rem)] sm:translate-x-0 ${
              openUpward ? "sm:bottom-full sm:left-0 sm:mb-2" : "sm:right-0 sm:top-full sm:mt-2"
            }`}
          >
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Avisos
            </p>
            {alerts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-4 text-center text-sm text-[var(--muted)]">
                Nada pendente por aqui.
              </p>
            ) : (
              <div className="max-h-[360px] space-y-2 overflow-y-auto">
                {alerts.map((alert) => {
                  const Icon = alert.title.includes("Orçamento") || alert.href === "/planejamento-mensal" ? TriangleAlert : CalendarClock;
                  return (
                    <div key={alert.id} className="relative">
                      <Link
                        href={alert.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] py-2.5 pl-3 pr-8 transition hover:border-[var(--brand)]"
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            alert.tone === "danger"
                              ? "bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]"
                              : "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[var(--navy)]">{alert.title}</span>
                          <span className="block text-xs text-[var(--muted)]">{alert.detail}</span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dismiss(alert.id);
                        }}
                        aria-label={`Apagar aviso: ${alert.title}`}
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--text)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
