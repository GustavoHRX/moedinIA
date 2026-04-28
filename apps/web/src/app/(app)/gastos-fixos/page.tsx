"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, Badge, EmptyState, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function GastosFixosPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [autoCreateTransaction, setAutoCreateTransaction] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const [categoriesRes, fixedRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true }),
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

    if (categoriesRes.error || fixedRes.error) {
      setMessage(
        `Erro ao carregar gastos fixos: ${categoriesRes.error?.message ?? fixedRes.error?.message}`
      );
      return;
    }

    setCategories((categoriesRes.data ?? []) as Category[]);
    setItems((fixedRes.data ?? []) as FixedExpense[]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedAmount = Number(amount.replace(",", "."));
    const parsedDueDay = Number(dueDay);

    if (!title.trim()) {
      setSaving(false);
      setMessage("Informe o nome do gasto fixo.");
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setSaving(false);
      setMessage("Informe um valor válido.");
      return;
    }

    if (!parsedDueDay || parsedDueDay < 1 || parsedDueDay > 31) {
      setSaving(false);
      setMessage("Informe um dia de vencimento válido.");
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
      setMessage(`Erro ao salvar gasto fixo: ${error.message}`);
      return;
    }

    setTitle("");
    setDescription("");
    setAmount("");
    setDueDay("");
    setCategoryId("");
    setAutoCreateTransaction(false);
    setMessage("Gasto fixo cadastrado com sucesso.");
    await loadPage();
  }

  async function handleToggleStatus(item: FixedExpense) {
    const { error } = await supabase
      .from("fixed_expenses")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);

    if (error) {
      setMessage(`Erro ao atualizar status: ${error.message}`);
      return;
    }

    setMessage("Status atualizado com sucesso.");
    await loadPage();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Deseja excluir este gasto fixo?");
    if (!confirmed) return;

    const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
    if (error) {
      setMessage(`Erro ao excluir gasto fixo: ${error.message}`);
      return;
    }

    setMessage("Gasto fixo excluído com sucesso.");
    await loadPage();
  }

  const activeItems = items.filter((item) => item.is_active);
  const totalActiveFixed = activeItems.reduce((acc, item) => acc + Number(item.amount), 0);

  return (
    <PageFrame>
      <PageHeader
        title="Gastos fixos"
        description="Contas recorrentes com status claro e controle por categoria."
        eyebrow="Recorrências"
      />

      <div className="space-y-5">
        {message ? <div className="alert-info rounded-2xl px-4 py-3 text-sm">{message}</div> : null}

        <section className="flex flex-col justify-between gap-5 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(135deg,#ffffff_0%,#eefaf4_100%)] p-5 shadow-[var(--shadow-soft)] lg:flex-row lg:items-center">
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

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <Surface>
          <SectionHeader title="Novo gasto fixo" eyebrow="Recorrência" />
          <form onSubmit={handleSave} className="mt-4 space-y-3">
            <input
              className="control"
              type="text"
              placeholder="Nome do gasto fixo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="control min-h-[96px]"
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="control"
                type="text"
                placeholder="Valor"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                className="control"
                type="number"
                min={1}
                max={31}
                placeholder="Dia venc."
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
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
              <p className="text-sm text-[var(--muted)]">Carregando...</p>
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
