"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { addMonthsClamped, isPastOrToday, toCompetenceMonth, todayDateInput } from "@/lib/dates";
import { formatCurrency, formatDate, formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, Alert, Badge, EmptyState, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";
import { HominhoTip } from "@/components/hominho-tip";
import { parcelamentosTips } from "@/lib/tips";

type InstallmentItem = {
  id: string;
  title: string;
  description: string | null;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  start_date: string;
  is_active: boolean;
  category_id: string | null;
  categories: CategoryRelation;
};

type Category = {
  id: string;
  name: string;
};

type TransactionInstallment = {
  installment_id: string | null;
  installment_number: number | null;
  amount: number;
};

type InstallmentsPageData = {
  categories: Category[];
  items: InstallmentItem[];
  transactions: TransactionInstallment[];
};

export default function ParcelamentosPage() {
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<InstallmentItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [startDate, setStartDate] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const loadPage = useCallback(async (forceRefresh = false) => {
    setMessage("");

    if (loadingUser) return;

    const user = cachedUser;

    if (!user) {
      router.push("/login");
      return;
    }

    const cacheKey = `installments:${user.id}`;
    const cachedPage = forceRefresh ? null : getFinancialCache<InstallmentsPageData>(cacheKey);

    if (cachedPage) {
      setCategories(cachedPage.categories);
      setItems(cachedPage.items);
      setTransactions(cachedPage.transactions);
      setLoading(false);
      return;
    }

    setLoading(true);

    const cachedExpenseCategories = getCategoriesByType("expense");
    const categoriesPromise =
      categoriesLoaded
        ? Promise.resolve(cachedExpenseCategories)
        : refreshCategories().then((items) => items.filter((category) => category.type === "expense"));

    const [categoriesResult, installmentsRes, txRes] = await Promise.all([
      categoriesPromise,
      supabase
        .from("installments")
        .select(
          "id, title, description, total_amount, installment_amount, total_installments, start_date, is_active, category_id, categories(name)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("installment_id, installment_number, amount")
        .eq("user_id", user.id)
        .eq("origin_type", "installment")
        .eq("status", "active"),
    ]);

    setLoading(false);

    if (installmentsRes.error || txRes.error) {
      setMessage(
        `Erro ao carregar parcelamentos: ${
          installmentsRes.error?.message ||
          txRes.error?.message
        }`
      );
      return;
    }

    const nextPage: InstallmentsPageData = {
      categories: categoriesResult as Category[],
      items: (installmentsRes.data ?? []) as InstallmentItem[],
      transactions: (txRes.data ?? []) as TransactionInstallment[],
    };
    setCategories(nextPage.categories);
    setItems(nextPage.items);
    setTransactions(nextPage.transactions);
    setFinancialCache(cacheKey, nextPage);
  }, [
    categoriesLoaded,
    cachedUser,
    getCategoriesByType,
    getFinancialCache,
    loadingUser,
    refreshCategories,
    router,
    setFinancialCache,
    supabase,
  ]);

  useEffect(() => {
    loadPage();
  }, [financialVersion, loadPage]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedTotal = parseMoneyInput(totalAmount);
    const parsedInstallments = Number(totalInstallments);

    if (!title.trim()) {
      setSaving(false);
      setMessage("Informe o nome do parcelamento.");
      return;
    }
    if (!parsedTotal || parsedTotal <= 0) {
      setSaving(false);
      setMessage("Informe um valor total válido.");
      return;
    }
    if (!parsedInstallments || parsedInstallments <= 0) {
      setSaving(false);
      setMessage("Informe a quantidade de parcelas.");
      return;
    }
    if (!startDate) {
      setSaving(false);
      setMessage("Informe a data inicial.");
      return;
    }

    const userId = cachedUser?.id;
    if (!userId) {
      setSaving(false);
      showMessage("Usuário não autenticado.", "error");
      return;
    }

    const installmentAmount = Number((parsedTotal / parsedInstallments).toFixed(2));

    const { data: installment, error } = await supabase
      .from("installments")
      .insert({
        user_id: userId,
        category_id: categoryId || null,
        title: title.trim(),
        description: description.trim() || null,
        total_amount: parsedTotal,
        installment_amount: installmentAmount,
        total_installments: parsedInstallments,
        start_date: startDate,
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !installment) {
      setSaving(false);
      showMessage(`Erro ao salvar parcelamento: ${error?.message ?? "registro não retornado"}`, "error");
      return;
    }

    const dueTransactions = Array.from({ length: parsedInstallments }, (_, index) => {
      const transactionDate = addMonthsClamped(startDate, index);
      if (!isPastOrToday(transactionDate)) return null;

      return {
        user_id: userId,
        type: "expense" as const,
        amount: installmentAmount,
        description: title.trim(),
        notes: description.trim() || null,
        transaction_date: transactionDate,
        competence_month: toCompetenceMonth(transactionDate),
        category_id: categoryId || null,
        source: "web" as const,
        status: "active" as const,
        origin_type: "installment" as const,
        installment_id: installment.id,
        installment_number: index + 1,
        installment_total: parsedInstallments,
      };
    }).filter((transaction) => transaction !== null);

    if (dueTransactions.length > 0) {
      const { error: txError } = await supabase.from("transactions").insert(dueTransactions);

      if (txError) {
        setSaving(false);
        showMessage(`Parcelamento salvo, mas houve erro ao gerar parcelas vencidas: ${txError.message}`, "error");
        return;
      }
    }

    setSaving(false);

    setTitle("");
    setDescription("");
    setTotalAmount("");
    setTotalInstallments("");
    setStartDate("");
    setCategoryId("");
    showMessage(
      dueTransactions.length > 0
        ? "Parcelamento cadastrado e parcelas vencidas geradas com sucesso."
        : "Parcelamento cadastrado. Parcelas futuras não foram geradas automaticamente.",
      "success"
    );
    invalidateFinancialData();
    await loadPage(true);
  }

  async function handleToggleStatus(item: InstallmentItem) {
    const { error } = await supabase
      .from("installments")
      .update({ is_active: !item.is_active })
      .eq("id", item.id)
      .eq("user_id", cachedUser!.id);

    if (error) {
      showMessage(`Erro ao atualizar status: ${error.message}`, "error");
      return;
    }

    showMessage("Status atualizado com sucesso.", "success");
    invalidateFinancialData();
    await loadPage(true);
  }

  async function handleDelete(id: string) {
    const confirmed = await confirm({
      title: "Excluir parcelamento",
      message: "Deseja excluir este parcelamento? As parcelas já lançadas não serão removidas.",
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;

    const { error } = await supabase
      .from("installments")
      .delete()
      .eq("id", id)
      .eq("user_id", cachedUser!.id);

    if (error) {
      showMessage(`Erro ao excluir parcelamento: ${error.message}`, "error");
      return;
    }

    showMessage("Parcelamento excluído com sucesso.", "success");
    invalidateFinancialData();
    await loadPage(true);
  }

  async function handleSettleEarly(item: InstallmentItem) {
    const { paidCount, paidAmount } = getInstallmentProgress(item);
    const remainingCount = item.total_installments - paidCount;
    if (remainingCount <= 0) {
      showMessage("Esse parcelamento já está quitado.", "success");
      return;
    }

    const confirmed = await confirm({
      title: "Quitar parcelamento antecipado",
      message: `Isso lança as ${remainingCount} parcelas restantes de "${item.title}" hoje, de uma vez, e marca o parcelamento como quitado. Deseja continuar?`,
      confirmLabel: "Quitar agora",
    });
    if (!confirmed) return;

    const userId = cachedUser!.id;
    const today = todayDateInput();
    const remainingAmount = Number(item.total_amount) - paidAmount;

    const newTransactions = Array.from({ length: remainingCount }, (_, index) => {
      const installmentNumber = paidCount + index + 1;
      const isLast = index === remainingCount - 1;
      const amount = isLast
        ? Number((remainingAmount - item.installment_amount * (remainingCount - 1)).toFixed(2))
        : item.installment_amount;
      return {
        user_id: userId,
        type: "expense" as const,
        amount,
        description: item.title,
        notes: item.description || null,
        transaction_date: today,
        competence_month: toCompetenceMonth(today),
        category_id: item.category_id,
        source: "web" as const,
        status: "active" as const,
        origin_type: "installment" as const,
        installment_id: item.id,
        installment_number: installmentNumber,
        installment_total: item.total_installments,
      };
    });

    const { error: txError } = await supabase.from("transactions").insert(newTransactions);
    if (txError) {
      showMessage(`Erro ao quitar parcelamento: ${txError.message}`, "error");
      return;
    }

    const { error } = await supabase
      .from("installments")
      .update({ is_active: false })
      .eq("id", item.id)
      .eq("user_id", userId);

    if (error) {
      showMessage(`Parcelas lançadas, mas houve erro ao inativar o parcelamento: ${error.message}`, "error");
      invalidateFinancialData();
      await loadPage(true);
      return;
    }

    showMessage("Parcelamento quitado! As parcelas restantes foram lançadas hoje.", "success");
    invalidateFinancialData();
    await loadPage(true);
  }

  function getInstallmentProgress(item: InstallmentItem) {
    const related = transactions.filter((tx) => tx.installment_id === item.id);
    const paidCount = related.length;
    const paidAmount = related.reduce((acc, tx) => acc + Number(tx.amount), 0);
    const remainingAmount = Number(item.total_amount) - paidAmount;
    const progress =
      Number(item.total_installments) > 0
        ? Math.min((paidCount / Number(item.total_installments)) * 100, 100)
        : 0;
    return { paidCount, paidAmount, remainingAmount, progress };
  }

  const activeItems = items.filter((item) => item.is_active);
  const totalOpen = activeItems.reduce((acc, item) => acc + Number(item.total_amount), 0);
  const parsedTotalPreview = parseMoneyInput(totalAmount);
  const parsedInstallmentsPreview = Number(totalInstallments);
  const installmentPreview =
    parsedTotalPreview > 0 && parsedInstallmentsPreview > 0
      ? Number((parsedTotalPreview / parsedInstallmentsPreview).toFixed(2))
      : null;

  return (
    <PageFrame>
      <PageHeader
        title="Parcelamentos"
        description="Suas compras parceladas com o progresso e o que ainda falta pagar."
        eyebrow="Compras em parcelas"
      />

      <div className="space-y-5">
      {message ? <Alert type={messageType}>{message}</Alert> : null}

      <HominhoTip
        page="parcelamentos"
        hominho="alefe"
        tips={useMemo(
          () =>
            parcelamentosTips({
              installments: items.map((item) => ({
                id: item.id,
                title: item.title,
                installment_amount: Number(item.installment_amount),
                total_installments: Number(item.total_installments),
                paid_installments: getInstallmentProgress(item).paidCount,
                is_active: item.is_active,
              })),
            }),
          // getInstallmentProgress depende só de transactions, já listado abaixo
          [items, transactions]
        )}
      />

      <section className="grid gap-5 lg:grid-cols-3">
        <Surface className="bg-[var(--hero-gradient)] p-6 text-[var(--text)] lg:col-span-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Total parcelado ativo</p>
          <p className="mt-2 text-4xl font-bold">{formatCurrency(totalOpen)}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{activeItems.length} parcelamentos ativos em acompanhamento.</p>
        </Surface>
        <Surface>
          <p className="text-xs font-bold uppercase text-[var(--muted)]">Parcelas geradas</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--brand-strong)]">{transactions.length}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Somente registros já vencidos/ocorridos.</p>
        </Surface>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <Surface>
          <SectionHeader title="Novo parcelamento" eyebrow="Compra parcelada" />
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Nome</span>
              <input
                className="control"
                type="text"
                placeholder="Ex: Notebook"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Descrição (opcional)</span>
              <textarea
                className="control min-h-[96px]"
                placeholder="Detalhes extras"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Valor total</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  onBlur={(e) => setTotalAmount(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Quantidade de parcelas</span>
                <input
                  className="control"
                  type="number"
                  placeholder="Ex: 12"
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Data da 1ª parcela</span>
                <input
                  className="control"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Categoria</span>
                <select
                  className="control"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {installmentPreview !== null ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Este parcelamento será salvo como {parsedInstallmentsPreview}x de{" "}
                {formatCurrency(installmentPreview)}, totalizando {formatCurrency(parsedTotalPreview)}.
              </p>
            ) : null}
            {categories.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Nenhuma categoria de despesa cadastrada. O parcelamento será salvo sem categoria.
              </p>
            ) : null}
            <ActionButton
              type="submit"
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar parcelamento"}
            </ActionButton>
          </form>
        </Surface>

        <Surface>
          <SectionHeader title={`Parcelamentos cadastrados (${items.length})`} eyebrow="Progresso" />
          <div className="mt-4">
            {loading ? (
<SkeletonList rows={3} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Sem parcelamentos cadastrados"
                description="Cadastre um parcelamento para visualizar progresso e saldo."
              />
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const stats = getInstallmentProgress(item);
                  return (
                    <article key={item.id} className="rounded-[18px] border border-[var(--line)] px-4 py-4 transition hover:bg-[var(--bg-soft)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-[var(--navy)]">{item.title}</h3>
                        <Badge tone={item.is_active ? "success" : "neutral"}>
                          {item.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {categoryName(item.categories)} - início {formatDate(item.start_date)}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl bg-[var(--bg-soft)] p-3">
                          <p className="text-xs text-[var(--muted)]">Valor total</p>
                          <p className="text-sm font-semibold text-[var(--text)]">{formatCurrency(item.total_amount)}</p>
                        </div>
                        <div className="rounded-xl bg-[var(--bg-soft)] p-3">
                          <p className="text-xs text-[var(--muted)]">Parcela</p>
                          <p className="text-sm font-semibold text-[var(--text)]">{formatCurrency(item.installment_amount)}</p>
                        </div>
                        <div className="rounded-xl bg-[var(--bg-soft)] p-3">
                          <p className="text-xs text-[var(--muted)]">Progresso</p>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {stats.paidCount}/{item.total_installments}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-[var(--muted)]">Pago</span>
                          <span className="font-semibold text-[var(--text)]">{stats.progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[var(--bg-soft)]">
                          <div
                            className="h-2.5 rounded-full bg-[var(--brand)]"
                            style={{ width: `${stats.progress}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-[var(--success)]">Pago: {formatCurrency(stats.paidAmount)}</span>
                          <span className="text-[var(--danger)]">Restante: {formatCurrency(stats.remainingAmount)}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.is_active && stats.paidCount < item.total_installments ? (
                          <ActionButton
                            onClick={() => handleSettleEarly(item)}
                            tone="primary"
                            className="px-3 py-2"
                          >
                            Quitar antecipado
                          </ActionButton>
                        ) : null}
                        <ActionButton
                          onClick={() => handleToggleStatus(item)}
                          tone="secondary"
                          className="px-3 py-2"
                        >
                          {item.is_active ? "Inativar" : "Ativar"}
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
                  );
                })}
              </div>
            )}
          </div>
        </Surface>
      </section>
      </div>
    </PageFrame>
  );
}
