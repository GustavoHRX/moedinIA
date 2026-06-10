"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { formatCurrency } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, Alert, Badge, EmptyState, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";

type Category = {
  id: string;
  name: string;
};

type FixedExpense = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  due_day: number;
  is_active: boolean;
  auto_create_transaction: boolean;
  category_id: string | null;
  categories: CategoryRelation;
};

type FixedExpensesPageData = {
  categories: Category[];
  items: FixedExpense[];
};

export default function GastosFixosPage() {
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
  const [items, setItems] = useState<FixedExpense[]>([]);
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
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [autoCreateTransaction, setAutoCreateTransaction] = useState(false);

  const loadPage = useCallback(async (forceRefresh = false) => {
    setMessage("");

    if (loadingUser) return;

    const user = cachedUser;

    if (!user) {
      router.push("/login");
      return;
    }

    const cacheKey = `fixed-expenses:${user.id}`;
    const cachedPage = forceRefresh ? null : getFinancialCache<FixedExpensesPageData>(cacheKey);

    if (cachedPage) {
      setCategories(cachedPage.categories);
      setItems(cachedPage.items);
      setLoading(false);
      return;
    }

    setLoading(true);

    const cachedExpenseCategories = getCategoriesByType("expense");
    const categoriesPromise =
      categoriesLoaded
        ? Promise.resolve(cachedExpenseCategories)
        : refreshCategories().then((items) => items.filter((category) => category.type === "expense"));

    const [categoriesResult, fixedRes] = await Promise.all([
      categoriesPromise,
      supabase
        .from("fixed_expenses")
        .select(
          "id, title, description, amount, due_day, is_active, auto_create_transaction, category_id, categories(name)"
        )
        .eq("user_id", user.id)
        .order("due_day", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    setLoading(false);

    if (fixedRes.error) {
      setMessage(
        `Erro ao carregar gastos fixos: ${fixedRes.error.message}`
      );
      return;
    }

    const nextPage: FixedExpensesPageData = {
      categories: categoriesResult as Category[],
      items: (fixedRes.data ?? []) as FixedExpense[],
    };
    setCategories(nextPage.categories);
    setItems(nextPage.items);
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

    const userId = cachedUser?.id;
    if (!userId) {
      showMessage("Usuário não autenticado.", "error");
      setSaving(false);
      return;
    }

    const parsedAmount = Number(amount.replace(",", "."));
    const parsedDueDay = Number(dueDay);

    if (!title.trim()) {
      setSaving(false);
      showMessage("Informe o nome do gasto fixo.", "error");
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setSaving(false);
      showMessage("Informe um valor válido.", "error");
      return;
    }

    if (!parsedDueDay || parsedDueDay < 1 || parsedDueDay > 31) {
      setSaving(false);
      showMessage("Informe um dia de vencimento válido.", "error");
      return;
    }

    const { error } = await supabase.from("fixed_expenses").insert({
      user_id: userId,
      category_id: categoryId || null,
      title: title.trim(),
      description: description.trim() || null,
      amount: parsedAmount,
      due_day: parsedDueDay,
      is_active: true,
      auto_create_transaction: autoCreateTransaction,
    });

    setSaving(false);

    if (error) {
      showMessage(`Erro ao salvar gasto fixo: ${error.message}`, "error");
      return;
    }

    setTitle("");
    setDescription("");
    setAmount("");
    setDueDay("");
    setCategoryId("");
    setAutoCreateTransaction(false);
    showMessage("Gasto fixo cadastrado com sucesso.", "success");
    invalidateFinancialData();
    await loadPage(true);
  }

  async function handleToggleStatus(item: FixedExpense) {
    const { error } = await supabase
      .from("fixed_expenses")
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
      title: "Excluir gasto fixo",
      message: "Deseja excluir este gasto fixo? As transações já geradas não serão removidas.",
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;

    const { error } = await supabase
      .from("fixed_expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", cachedUser!.id);

    if (error) {
      showMessage(`Erro ao excluir gasto fixo: ${error.message}`, "error");
      return;
    }

    showMessage("Gasto fixo excluído com sucesso.", "success");
    invalidateFinancialData();
    await loadPage(true);
  }

  const activeItems = items.filter((item) => item.is_active);
  const totalActiveFixed = activeItems.reduce((acc, item) => acc + Number(item.amount), 0);

  return (
    <PageFrame>
      <PageHeader
        title="Gastos fixos"
        description="Aquelas contas que voltam todo mês, sempre no seu controle."
        eyebrow="Recorrências"
      />

      <div className="space-y-5">
        {message ? <Alert type={messageType}>{message}</Alert> : null}

        <section className="flex flex-col justify-between gap-5 rounded-[24px] border border-[var(--line)] bg-[var(--hero-gradient)] p-5 shadow-[var(--shadow-soft)] lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--brand-soft)] text-2xl font-bold text-[var(--brand)]">
              ↻
            </div>
            <div>
              <p className="text-sm text-[var(--muted)]">Total mensal de gastos fixos</p>
              <p className="text-3xl font-extrabold text-[var(--navy)]">{formatCurrency(totalActiveFixed)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <Surface className="p-4 shadow-none">
              <p className="text-xs font-bold uppercase text-[var(--muted)]">Ativos</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--navy)]">{activeItems.length}</p>
            </Surface>
            <Surface className="p-4 shadow-none">
              <p className="text-xs font-bold uppercase text-[var(--muted)]">Cadastrados</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--navy)]">{items.length}</p>
            </Surface>
          </div>
        </section>

      <section className="grid items-start gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <Surface>
          <SectionHeader title="Novo gasto fixo" eyebrow="Recorrência" />
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Nome do gasto fixo</span>
              <input
                className="control"
                type="text"
                placeholder="Ex: Aluguel"
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
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Valor</span>
                <input
                  className="control"
                  type="text"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-[var(--text)]">Dia venc.</span>
                <input
                  className="control"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex: 10"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
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
            {categories.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Nenhuma categoria de despesa cadastrada. O gasto fixo será salvo sem categoria.
              </p>
            ) : null}

            <label className="flex items-center gap-3 rounded-[16px] border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
              <input
                type="checkbox"
                checked={autoCreateTransaction}
                onChange={(e) => setAutoCreateTransaction(e.target.checked)}
              />
              Permitir criação automática de transações vencidas
            </label>

            <ActionButton
              type="submit"
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar gasto fixo"}
            </ActionButton>
          </form>
        </Surface>

        <Surface>
          <SectionHeader title={`Gastos fixos (${items.length})`} eyebrow="Lista recorrente" />

          <div className="mt-4">
            {loading ? (
<SkeletonList rows={3} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nenhum gasto fixo cadastrado"
                description="Cadastre o primeiro gasto fixo para iniciar o acompanhamento."
              />
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <article key={item.id} className="rounded-[18px] border border-[var(--line)] px-4 py-4 transition hover:bg-[var(--bg-soft)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold text-[var(--navy)]">{item.title}</h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Dia {item.due_day} - {categoryName(item.categories)}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-extrabold text-[var(--navy)]">{formatCurrency(Number(item.amount))}</p>
                        <Badge tone={item.is_active ? "success" : "neutral"}>
                          {item.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                    {item.description ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
                      >
                        {item.is_active ? "Inativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Surface>
      </section>
      </div>
    </PageFrame>
  );
}
