"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CalendarClock, TriangleAlert, X } from "lucide-react";
import { useAppData } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { addMonthsClamped, currentMonthRef, todayDateInput } from "@/lib/dates";
import { formatCurrency } from "@/lib/formatters";
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

  // Container do portal criado no cliente e anexado ao <body> — padrão à prova
  // de SSR. O rail e o header têm backdrop-filter, que recorta descendentes
  // position:fixed; o portal escapa disso.
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setPortalEl(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

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
        href: "/perfil",
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
    <div className="relative">
      {/* Clique para abrir — não hover: a partir do rail lateral (que também é
          hover) havia espaço morto entre o sino e o painel, e o mouseleave
          fechava antes de o rato lá chegar. */}
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
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
              {alerts.length > 9 ? "9+" : alerts.length}
            </span>
          ) : null}
        </span>
      </button>

      {open && portalEl
        ? createPortal(
            <>
              {/* Portal para o <body>: o rail e o header têm backdrop-filter,
                  que cria bloco de contenção e recortava o painel fixo. */}
              <button
                type="button"
                className="fixed inset-0 z-[90]"
                aria-label="Fechar avisos"
                onClick={() => setOpen(false)}
              />
              <div
                className={`fixed z-[91] w-[calc(100vw-1.5rem)] max-w-[320px] rounded-lg border border-line bg-surface p-3 shadow-pop ${
                  openUpward
                    ? "bottom-4 left-3 sm:left-[236px]"
                    : "left-1/2 top-[68px] -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0"
                }`}
              >
            <p className="eyebrow px-1 pb-2">Avisos</p>
            {alerts.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-fg-muted">
                Nada pendente por aqui.
              </p>
            ) : (
              <div className="max-h-[360px] space-y-2 overflow-y-auto">
                {alerts.map((alert) => {
                  const Icon = alert.title.includes("Orçamento") || alert.href === "/perfil" ? TriangleAlert : CalendarClock;
                  return (
                    <div key={alert.id} className="relative">
                      <Link
                        href={alert.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2.5 rounded-md border border-line bg-bg-soft py-2.5 pl-3 pr-8 transition hover:border-primary"
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            alert.tone === "danger" ? "bg-danger/10 text-expense" : "bg-warning/10 text-warning"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg">{alert.title}</span>
                          <span className="block text-xs text-fg-muted">{alert.detail}</span>
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
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-fg-muted transition hover:bg-surface-strong hover:text-fg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
              </div>
            </>,
            portalEl
          )
        : null}
    </div>
  );
}
