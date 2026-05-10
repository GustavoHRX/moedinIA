"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { todayDateInput, toCompetenceMonth } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import NewEntryButton from "@/components/new-entry-button";
import { ActionButton, Badge, EmptyState, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";

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
    getFinancialCache,
    setFinancialCache,
    invalidateFinancialData,
  } = useAppData();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Deseja excluir este lançamento?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("transactions")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage(`Erro ao excluir: ${error.message}`);
      return;
    }

    invalidateFinancialData();
    await loadData();
  }

  function startEdit(item: TransactionItem) {
    if (item.origin_type === "fixed_expense" || item.origin_type === "installment") {
      setMessage("Edição de lançamentos automáticos deve ser feita na tela de origem.");
      return;
    }

    setEditingId(item.id);
    setEditType(item.type);
    setEditDescription(item.description);
    setEditAmount(String(item.amount));
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

    const parsedAmount = Number(editAmount.replace(",", "."));
    if (!editDescription.trim()) {
      setSavingEdit(false);
      setMessage("Informe uma descrição.");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setSavingEdit(false);
      setMessage("Informe um valor válido.");
      return;
    }
    if (!editDate) {
      setSavingEdit(false);
      setMessage("Informe a data.");
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
      .eq("id", editingId);

    setSavingEdit(false);

    if (error) {
      setMessage(`Erro ao salvar edição: ${error.message}`);
      return;
    }

    cancelEdit();
    setMessage("Lançamento atualizado com sucesso.");
    invalidateFinancialData();
    await loadData();
  }

  function clearFilters() {
    setSearchText("");
    setFilterType("all");
    setFilterCategory("all");
    setStartDate("");
    setEndDate("");
  }

  const filteredTransactions = transactions.filter((item) => {
    const byText = item.description.toLowerCase().includes(searchText.toLowerCase());
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

  return (
    <PageFrame>
      <PageHeader
        title="Histórico"
        description="Consulta de movimentações já ocorridas, com filtros rápidos e origem bem identificada."
        eyebrow="Movimentações"
        actions={
          <NewEntryButton className="btn-primary px-5 py-3" label="+ Novo lançamento" />
        }
      />

      <div className="space-y-5">
        {message ? (
          <div className="alert-info rounded-2xl px-4 py-3 text-sm">{message}</div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Surface className="bg-[var(--hero-gradient)]">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--muted)]">Valor total</p>
                <p className="mt-1 text-3xl font-extrabold text-[var(--navy)]">{formatCurrency(filteredExpenses)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Saídas no filtro atual</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[var(--muted)]">Entradas</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--success)]">{formatCurrency(filteredIncome)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[var(--muted)]">Saldo filtrado</p>
                <p className={`mt-1 text-2xl font-extrabold ${filteredBalance >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {formatCurrency(filteredBalance)}
                </p>
              </div>
            </div>
          </Surface>

          <Surface>
            <SectionHeader
              title="Filtros"
              action={
                <button onClick={clearFilters} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-bold text-[var(--navy)]">
                  Limpar
                </button>
              }
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input className="control xl:col-span-2" placeholder="Buscar transação..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
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
          <h2 className="text-xl font-bold text-[var(--text)]">Editar lançamento</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select
              className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
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
              className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="Valor"
            />
            <input
              className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)] md:col-span-2"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Descrição"
            />
            <input
              type="date"
              className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
            <select
              className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
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
          <p className="text-sm text-[var(--muted)]">Carregando histórico...</p>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            title="Nenhum resultado"
            description="Ajuste os filtros ou registre um novo lançamento."
          />
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((item) => (
              <article
                key={item.id}
                className="rounded-[18px] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4 shadow-[0_7px_18px_rgba(9,42,32,0.05)] transition hover:border-[rgba(46,158,79,0.35)] hover:shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-[var(--navy)]">
                      {item.description} <span className="font-semibold text-[var(--muted)]">#{item.id.slice(0, 6)}</span>
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {categoryName(item.categories)} - {formatDate(item.transaction_date)}
                      {item.origin_type === "installment" &&
                      item.installment_number &&
                      item.installment_total
                        ? ` - parcela ${item.installment_number}/${item.installment_total}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className={`font-bold ${item.type === "income" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
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
                    onClick={() => handleDelete(item.id)}
                    tone="danger"
                    className="px-3 py-2"
                  >
                    Excluir
                  </ActionButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </Surface>
      </div>
    </PageFrame>
  );
}
