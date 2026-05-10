"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { todayDateInput, toCompetenceMonth } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, Surface } from "@/components/ui-kit";

type Category = {
  id: string;
  name: string;
};

export default function LancamentosPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const {
    user: cachedUser,
    loadingUser,
    categoriesLoaded,
    getCategoriesByType,
    refreshCategories,
    invalidateFinancialData,
  } = useAppData();

  const [userId, setUserId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"expense" | "income">("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTransactionDate(todayDateInput());
  }, []);

  useEffect(() => {
    loadData();
  }, [type, loadingUser, cachedUser, categoriesLoaded]);

  async function loadData() {
    setLoading(true);

    if (loadingUser) return;

    const currentUser = cachedUser;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    setUserId(currentUser.id);

    const list = categoriesLoaded
      ? getCategoriesByType(type)
      : (await refreshCategories()).filter((category) => category.type === type);
    setCategories(list);
    setCategoryId(list[0]?.id ?? "");
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedAmount = Number(amount.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0) {
      setSaving(false);
      setMessage("Informe um valor válido.");
      return;
    }
    if (!description.trim()) {
      setSaving(false);
      setMessage("Informe uma descrição.");
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type,
      amount: parsedAmount,
      description: description.trim(),
      transaction_date: transactionDate,
      competence_month: toCompetenceMonth(transactionDate),
      category_id: categoryId || null,
      source: "web",
      status: "active",
      origin_type: "manual",
    });

    setSaving(false);

    if (error) {
      setMessage(`Erro ao salvar lançamento: ${error.message}`);
      return;
    }

    setAmount("");
    setDescription("");
    setMessage("Lançamento salvo com sucesso.");
    invalidateFinancialData();
    window.dispatchEvent(new CustomEvent("financial-entry-saved"));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lançamento manual"
        description="Entrada direta para receitas e despesas avulsas."
      />

      {message ? (
        <div className="alert-info rounded-2xl px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <Surface>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Carregando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                type="text"
                placeholder="Descrição"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <input
                className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                type="text"
                placeholder="Valor"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select
                className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                value={type}
                onChange={(e) => setType(e.target.value as "expense" | "income")}
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
              <input
                className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
              <select
                className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)] sm:col-span-2"
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
              {categories.length === 0 ? (
                <p className="text-sm text-[var(--muted)] sm:col-span-2">
                  Nenhuma categoria deste tipo cadastrada. O lançamento será salvo sem categoria.
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-5 py-3 disabled:opacity-70"
            >
              {saving ? "Salvando..." : "Salvar lançamento"}
            </button>
          </form>
        )}
      </Surface>
    </div>
  );
}
