"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { CategoryIcon } from "@/components/category-icon";
import { SkeletonList } from "@/components/skeleton";
import { todayDateInput, toCompetenceMonth } from "@/lib/dates";
import { formatCurrency, formatDate, formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import NewEntryButton from "@/components/new-entry-button";
import { ActionButton, Alert, Badge, EmptyState, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";
import { HominhoTip } from "@/components/hominho-tip";
import { historicoTips } from "@/lib/tips";

type TransactionItem = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  transaction_date: string;
  status: string;
  category_id: string | null;
  origin_type?: "manual" | "fixed_expense" | "installment";
  installment_number?: number | null;
  installment_total?: number | null;
  categories: CategoryRelation;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type HistoryData = {
  transactions: TransactionItem[];
  categories: Category[];
};

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function monthLabel(dateStr: string) {
  const [year, month] = dateStr.slice(0, 7).split("-").map(Number);
  return `${MONTHS_PT[month - 1]} ${year}`;
}

export default function HistoricoPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const {
    user: cachedUser,
    loadingUser,
    categories: cachedCategories,
    categoriesLoaded,
    refreshCategories,
    financialVersion,
    lastRealtimeArrival,
    getFinancialCache,
    setFinancialCache,
    invalidateFinancialData,
  } = useAppData();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const PAGE_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<"income" | "expense">("income");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    setMessage("");

    if (loadingUser) return;

    const user = cachedUser;

    if (!user) {
      router.push("/login");
      return;
    }

    const today = todayDateInput();
    const cacheKey = `history:${user.id}:${today}`;
    const cachedHistory = forceRefresh
      ? null
      : getFinancialCache<HistoryData>(cacheKey);

    if (cachedHistory) {
      setTransactions(cachedHistory.transactions);
      setCategories(cachedHistory.categories);
      setLoading(false);
      return;
    }

    setLoading(true);

    const categoriesPromise =
      categoriesLoaded
        ? Promise.resolve(cachedCategories)
        : refreshCategories();

    const [transactionsRes, categoriesResult] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, type, amount, description, transaction_date, status, category_id, origin_type, installment_number, installment_total, categories(name)"
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .lte("transaction_date", today)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
      categoriesPromise,
    ]);

    setLoading(false);

    if (transactionsRes.error) {
      setMessage(
        `Erro ao carregar histórico: ${transactionsRes.error.message}`
      );
      return;
    }

    const nextHistory: HistoryData = {
      transactions: (transactionsRes.data ?? []) as TransactionItem[],
      categories: categoriesResult as Category[],
    };
    setTransactions(nextHistory.transactions);
    setCategories(nextHistory.categories);
    setFinancialCache(cacheKey, nextHistory);
  }, [
    cachedCategories,
    cachedUser,
    categoriesLoaded,
    getFinancialCache,
    loadingUser,
    refreshCategories,
    router,
    setFinancialCache,
    supabase,
  ]);

  useEffect(() => {
    loadData();
  }, [financialVersion, loadData]);

  // Exclusão já é lógica no banco (status='deleted'), então a exclusão é
  // imediata — sem confirm() bloqueante — e aparece um "Desfazer" por alguns
  // segundos. Some o medo de apagar a coisa errada sem adicionar fricção.
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoItem, setUndoItem] = useState<{ id: string; description: string } | null>(null);

  async function handleDelete(item: TransactionItem) {
    const { error } = await supabase
      .from("transactions")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("user_id", cachedUser!.id);

    if (error) {
      showMessage(`Erro ao excluir: ${error.message}`, "error");
      return;
    }

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoItem({ id: item.id, description: item.description });
    undoTimeoutRef.current = setTimeout(() => setUndoItem(null), 6000);

    invalidateFinancialData();
    await loadData(true);
  }

  async function handleDuplicate(item: TransactionItem) {
    const today = todayDateInput();
    const { error } = await supabase.from("transactions").insert({
      user_id: cachedUser!.id,
      type: item.type,
      description: item.description,
      amount: item.amount,
      transaction_date: today,
      competence_month: toCompetenceMonth(today),
      category_id: item.category_id,
      origin_type: "manual",
    });

    if (error) {
      showMessage(`Erro ao duplicar: ${error.message}`, "error");
      return;
    }

    showMessage("Lançamento duplicado com a data de hoje.", "success");
    invalidateFinancialData();
    await loadData(true);
  }

  async function handleUndoDelete() {
    if (!undoItem) return;
    const id = undoItem.id;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoItem(null);

    const { error } = await supabase
      .from("transactions")
      .update({ status: "active", deleted_at: null })
      .eq("id", id)
      .eq("user_id", cachedUser!.id);

    if (error) {
      showMessage(`Erro ao desfazer: ${error.message}`, "error");
      return;
    }

    invalidateFinancialData();
    await loadData(true);
  }

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  function startEdit(item: TransactionItem) {
    if (item.origin_type === "fixed_expense" || item.origin_type === "installment") {
      setMessage("Edição de lançamentos automáticos deve ser feita na tela de origem.");
      return;
    }

    setEditingId(item.id);
    setEditType(item.type);
    setEditDescription(item.description);
    setEditAmount(formatMoneyInputValue(item.amount));
    setEditDate(item.transaction_date);
    setEditCategoryId(item.category_id ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditType("income");
    setEditDescription("");
    setEditAmount("");
    setEditDate("");
    setEditCategoryId("");
    setSavingEdit(false);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSavingEdit(true);
    setMessage("");

    const parsedAmount = parseMoneyInput(editAmount);
    if (!editDescription.trim()) {
      setSavingEdit(false);
      showMessage("Informe uma descrição.", "error");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setSavingEdit(false);
      showMessage("Informe um valor válido.", "error");
      return;
    }
    if (!editDate) {
      setSavingEdit(false);
      showMessage("Informe a data.", "error");
      return;
    }
    if (editDate > todayDateInput()) {
      setSavingEdit(false);
      showMessage("A data não pode ser no futuro.", "error");
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        type: editType,
        description: editDescription.trim(),
        amount: parsedAmount,
        transaction_date: editDate,
        competence_month: toCompetenceMonth(editDate),
        category_id: editCategoryId || null,
      })
      .eq("id", editingId)
      .eq("user_id", cachedUser!.id);

    setSavingEdit(false);

    if (error) {
      showMessage(`Erro ao salvar edição: ${error.message}`, "error");
      return;
    }

    cancelEdit();
    showMessage("Lançamento atualizado com sucesso.", "success");
    invalidateFinancialData();
    await loadData(true);
  }

  function clearFilters() {
    setSearchText("");
    setFilterType("all");
    setFilterCategory("all");
    setStartDate("");
    setEndDate("");
  }

  const filteredTransactions = transactions.filter((item) => {
    const query = searchText.trim().toLowerCase();
    const byText =
      !query ||
      item.description.toLowerCase().includes(query) ||
      formatCurrency(item.amount).toLowerCase().replace(/\s/g, "").includes(query.replace(/\s/g, ""));
    const byType = filterType === "all" || item.type === filterType;
    const byCategory = filterCategory === "all" || item.category_id === filterCategory;
    const byStart = !startDate || item.transaction_date >= startDate;
    const byEnd = !endDate || item.transaction_date <= endDate;
    return byText && byType && byCategory && byStart && byEnd;
  });

  const filteredBalance = filteredTransactions.reduce(
    (acc, item) => acc + (item.type === "income" ? Number(item.amount) : -Number(item.amount)),
    0
  );
  const filteredExpenses = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const filteredIncome = filteredTransactions
    .filter((item) => item.type === "income")
    .reduce((acc, item) => acc + Number(item.amount), 0);

  // Volta para a 1ª página sempre que um filtro muda
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchText, filterType, filterCategory, startDate, endDate]);

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = filteredTransactions.length > visibleCount;

  // Agrupa os visíveis por mês mantendo a ordem (mais recente primeiro)
  const groupedTransactions = useMemo(() => {
    const groups: { key: string; label: string; items: TransactionItem[] }[] = [];
    for (const item of visibleTransactions) {
      const key = item.transaction_date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (!last || last.key !== key) {
        groups.push({ key, label: monthLabel(item.transaction_date), items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return groups;
  }, [visibleTransactions]);

  function handleExportCsv() {
    const header = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Origem"];
    const lines = filteredTransactions.map((item) => {
      const origem =
        item.origin_type === "fixed_expense" ? "Fixo" : item.origin_type === "installment" ? "Parcelado" : "Manual";
      return [
        item.transaction_date,
        `"${item.description.replace(/"/g, '""')}"`,
        categoryName(item.categories),
        item.type === "income" ? "Receita" : "Despesa",
        Number(item.amount).toFixed(2).replace(".", ","),
        origem,
      ].join(";");
    });
    const csv = [header.join(";"), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico-moedin-${todayDateInput()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageFrame>
      <PageHeader
        title="Histórico"
        description="Tudo que rolou nas suas finanças, fácil de filtrar e achar."
        eyebrow="Movimentações"
        actions={
          <>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredTransactions.length === 0}
              className="rounded-md border border-line bg-surface-strong px-5 py-3 text-sm font-semibold text-fg transition hover:border-primary disabled:opacity-50"
            >
              Exportar CSV
            </button>
            <NewEntryButton className="btn-primary px-5 py-3" label="+ Novo lançamento" />
          </>
        }
      />

      <div className="space-y-5">
        {message ? <Alert type={messageType}>{message}</Alert> : null}

        <HominhoTip
          page="historico"
          hominho="gustavo"
          tips={useMemo(
            () =>
              historicoTips({
                totalCount: transactions.length,
                monthKey: todayDateInput().slice(0, 7),
              }),
            [transactions.length]
          )}
        />

        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Surface className="min-w-0 bg-surface">
            <div className="divide-y divide-[var(--line)]">
              <div className="flex items-center justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-fg-muted">Saídas (filtro)</p>
                  <p className="text-[11px] text-fg-muted">Total de gastos no filtro atual</p>
                </div>
                <p className="shrink-0 text-xl font-semibold leading-tight tracking-tight text-fg tabular-nums">{formatCurrency(filteredExpenses)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <p className="text-xs font-semibold uppercase text-fg-muted">Entradas</p>
                <p className="shrink-0 text-xl font-semibold leading-tight tracking-tight text-income tabular-nums">{formatCurrency(filteredIncome)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 pt-3">
                <p className="text-xs font-semibold uppercase text-fg-muted">Saldo filtrado</p>
                <p className={`shrink-0 text-xl font-semibold leading-tight tracking-tight tabular-nums ${filteredBalance >= 0 ? "text-income" : "text-expense"}`}>
                  {formatCurrency(filteredBalance)}
                </p>
              </div>
            </div>
          </Surface>

          <Surface className="min-w-0">
            <SectionHeader
              title="Filtros"
              action={
                <button onClick={clearFilters} className="rounded-md border border-line bg-surface-strong px-3 py-2 text-sm font-semibold text-fg">
                  Limpar
                </button>
              }
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input className="control xl:col-span-2" placeholder="Buscar por descrição ou valor..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              <select className="control" value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | "income" | "expense")}>
                <option value="all">Todos</option>
                <option value="income">Entradas</option>
                <option value="expense">Saídas</option>
              </select>
              <select className="control" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="all">Categorias</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <input type="date" className="control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="date" className="control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </Surface>
        </div>

      {editingId ? (
        <Surface>
          <h2 className="text-xl font-semibold text-fg">Editar lançamento</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
              value={editType}
              onChange={(e) => {
                setEditType(e.target.value as "income" | "expense");
                setEditCategoryId("");
              }}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
            <input
              className="rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              onBlur={(e) => setEditAmount(formatMoneyInputValue(e.target.value))}
              placeholder="Valor"
            />
            <input
              className="rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring md:col-span-2"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Descrição"
            />
            <input
              type="date"
              className="rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
            <select
              className="rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
              value={editCategoryId}
              onChange={(e) => setEditCategoryId(e.target.value)}
            >
              <option value="">Sem categoria</option>
              {categories
                .filter((category) => category.type === editType)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton
              onClick={saveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? "Salvando..." : "Salvar edição"}
            </ActionButton>
            <ActionButton
              onClick={cancelEdit}
              tone="secondary"
            >
              Cancelar
            </ActionButton>
          </div>
        </Surface>
      ) : null}

      <Surface>
        {loading ? (
<SkeletonList rows={6} />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title="Nenhum resultado"
            description="Ajuste os filtros ou registre um novo lançamento."
          />
        ) : (
          <div className="space-y-5">
            {groupedTransactions.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center gap-3 pt-1">
                  <h3 className="eyebrow">
                    {group.label}
                  </h3>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>
                {group.items.map((item) => (
              <article
                key={item.id}
                className={`rounded-md border border-line bg-surface-strong px-4 py-4 transition hover:border-primary/30 ${
                  lastRealtimeArrival &&
                  item.id === lastRealtimeArrival.id &&
                  Date.now() - lastRealtimeArrival.at < 10_000
                    ? "anim-flash-in"
                    : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <CategoryIcon name={categoryName(item.categories, "")} />
                    <div>
                    <h3 className="font-semibold text-fg">
                      {item.description}
                    </h3>
                    <p className="mt-1 text-sm text-fg-muted">
                      {categoryName(item.categories)} - {formatDate(item.transaction_date)}
                      {item.origin_type === "installment" &&
                      item.installment_number &&
                      item.installment_total
                        ? ` - parcela ${item.installment_number}/${item.installment_total}`
                        : ""}
                    </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className={`font-semibold ${item.type === "income" ? "text-income" : "text-expense"}`}>
                      {item.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(item.amount))}
                    </p>
                    <div className="mt-2 flex gap-2 sm:justify-end">
                      <Badge tone={item.type === "income" ? "success" : "danger"}>
                        {item.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                      <Badge tone={item.origin_type === "installment" ? "brand" : "neutral"}>
                        {item.origin_type === "fixed_expense"
                          ? "Fixo"
                          : item.origin_type === "installment"
                          ? "Parcelado"
                          : "Manual"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    onClick={() => startEdit(item)}
                    tone="secondary"
                    className="px-3 py-2"
                  >
                    Editar
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleDuplicate(item)}
                    tone="secondary"
                    className="px-3 py-2"
                  >
                    Duplicar
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleDelete(item)}
                    tone="danger"
                    className="px-3 py-2"
                  >
                    Excluir
                  </ActionButton>
                </div>
              </article>
                ))}
              </div>
            ))}

            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-xs text-fg-muted">
                Mostrando {visibleTransactions.length} de {filteredTransactions.length} lançamentos
              </p>
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                  className="rounded-md border border-line bg-surface-strong px-5 py-3 text-sm font-semibold text-fg transition hover:border-primary hover:text-primary-strong"
                >
                  Exibir mais
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Surface>
      </div>

      {undoItem ? (
        <div
          role="status"
          className="anim-pop-in fixed inset-x-3 bottom-3 z-[150] flex items-center justify-between gap-3 rounded-md border border-line bg-surface-strong px-4 py-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-sm"
        >
          <p className="min-w-0 truncate text-sm text-fg">
            <span className="font-semibold text-fg">Excluído:</span> {undoItem.description}
          </p>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="shrink-0 rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-primary-strong transition hover:border-primary"
          >
            Desfazer
          </button>
        </div>
      ) : null}
    </PageFrame>
  );
}
