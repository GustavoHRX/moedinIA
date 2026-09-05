"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useAppData } from "@/components/app-data-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton";
import { categoryName, type CategoryRelation } from "@/lib/categories";
import { formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import { Money } from "@/components/money";
import {
  ActionButton,
  Alert,
  Badge,
  EmptyState,
  PageFrame,
  PageHeader,
  SectionHeader,
  Segmented,
  StatTile,
  Surface,
} from "@/components/ui-kit";
import { catchUpRecurrences } from "@/lib/recurrence-catchup";

type Category = { id: string; name: string };

type FixedItem = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  due_day: number;
  is_active: boolean;
  category_id: string | null;
  categories: CategoryRelation;
};

type Mode = "expense" | "income";

const CONFIG = {
  expense: {
    table: "fixed_expenses",
    linkColumn: "fixed_expense_id",
    noun: "gasto fixo",
    nounPlural: "gastos fixos",
    catType: "expense" as const,
  },
  income: {
    table: "fixed_incomes",
    linkColumn: "fixed_income_id",
    noun: "receita fixa",
    nounPlural: "receitas fixas",
    catType: "income" as const,
  },
} as const;

export default function FixosPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const {
    user: cachedUser,
    loadingUser,
    getCategoriesByType,
    refreshCategories,
    categoriesLoaded,
    financialVersion,
    invalidateFinancialData,
  } = useAppData();
  const confirm = useConfirm();

  const [mode, setMode] = useState<Mode>("expense");
  const cfg = CONFIG[mode];

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<FixedItem[]>([]);
  const [incomes, setIncomes] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [startDate, setStartDate] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const items = mode === "expense" ? expenses : incomes;

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  const loadPage = useCallback(async () => {
    if (loadingUser) return;
    const user = cachedUser;
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    if (!categoriesLoaded) await refreshCategories();

    const select = "id, title, description, amount, due_day, is_active, category_id, categories(name)";
    const [expRes, incRes] = await Promise.all([
      supabase.from("fixed_expenses").select(select).eq("user_id", user.id).order("due_day", { ascending: true }),
      supabase.from("fixed_incomes").select(select).eq("user_id", user.id).order("due_day", { ascending: true }),
    ]);

    setLoading(false);

    if (expRes.error) {
      showMessage(`Erro ao carregar gastos fixos: ${expRes.error.message}`, "error");
      return;
    }
    setExpenses((expRes.data ?? []) as FixedItem[]);
    setIncomes(incRes.error ? [] : ((incRes.data ?? []) as FixedItem[]));
  }, [cachedUser, categoriesLoaded, loadingUser, refreshCategories, router, supabase]);

  useEffect(() => {
    loadPage();
  }, [financialVersion, loadPage]);

  useEffect(() => {
    setCategories(getCategoriesByType(cfg.catType).map((c) => ({ id: c.id, name: c.name })));
  }, [cfg.catType, getCategoriesByType, categoriesLoaded]);

  function resetForm() {
    setTitle("");
    setAmount("");
    setDueDay("");
    setStartDate("");
    setCategoryId("");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const userId = cachedUser?.id;
    if (!userId) return showMessage("Usuário não autenticado.", "error");

    const parsedAmount = parseMoneyInput(amount);
    const parsedDueDay = Number(dueDay);

    if (!title.trim()) return showMessage(`Informe o nome d${mode === "expense" ? "o" : "a"} ${cfg.noun}.`, "error");
    if (!parsedAmount || parsedAmount <= 0) return showMessage("Informe um valor válido.", "error");
    if (!parsedDueDay || parsedDueDay < 1 || parsedDueDay > 31) return showMessage("Informe um dia entre 1 e 31.", "error");

    setSaving(true);
    const { error } = await supabase.from(cfg.table).insert({
      user_id: userId,
      category_id: categoryId || null,
      title: title.trim(),
      amount: parsedAmount,
      due_day: parsedDueDay,
      is_active: true,
      start_date: startDate || null,
      ...(mode === "expense" ? { auto_create_transaction: true } : { kind: "custom" }),
    });

    if (error) {
      setSaving(false);
      return showMessage(`Erro ao salvar: ${error.message}`, "error");
    }

    let generationOk = true;
    try {
      await catchUpRecurrences(supabase, userId);
    } catch {
      generationOk = false;
    }
    setSaving(false);
    resetForm();
    showMessage(
      generationOk
        ? `${cap(cfg.noun)} cadastrad${mode === "expense" ? "o" : "a"}. Os lançamentos vencidos até hoje foram gerados.`
        : `${cap(cfg.noun)} cadastrad${mode === "expense" ? "o" : "a"}. Os lançamentos vencidos serão gerados ao reabrir a página.`,
      "success",
    );
    invalidateFinancialData();
    await loadPage();
  }

  async function handleToggle(item: FixedItem) {
    const { error } = await supabase
      .from(cfg.table)
      .update({ is_active: !item.is_active })
      .eq("id", item.id)
      .eq("user_id", cachedUser!.id);
    if (error) return showMessage(`Erro ao atualizar: ${error.message}`, "error");
    invalidateFinancialData();
    await loadPage();
  }

  async function handleDelete(item: FixedItem) {
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq(cfg.linkColumn, item.id)
      .eq("user_id", cachedUser!.id);
    const hasLinked = (count ?? 0) > 0;

    const confirmed = await confirm({
      title: hasLinked ? `Inativar ${cfg.noun}` : `Excluir ${cfg.noun}`,
      message: hasLinked
        ? `Já gerou lançamentos no histórico. Vai ser inativad${mode === "expense" ? "o" : "a"} em vez de excluíd${mode === "expense" ? "o" : "a"} — para de gerar novos lançamentos, mas o histórico continua explicável.`
        : `Ainda não gerou nenhum lançamento. Deseja excluir?`,
      confirmLabel: hasLinked ? "Inativar" : "Excluir",
    });
    if (!confirmed) return;

    const { error } = hasLinked
      ? await supabase.from(cfg.table).update({ is_active: false }).eq("id", item.id).eq("user_id", cachedUser!.id)
      : await supabase.from(cfg.table).delete().eq("id", item.id).eq("user_id", cachedUser!.id);

    if (error) return showMessage(`Erro: ${error.message}`, "error");
    showMessage(hasLinked ? `${cap(cfg.noun)} inativad${mode === "expense" ? "o" : "a"}.` : `${cap(cfg.noun)} excluíd${mode === "expense" ? "o" : "a"}.`, "success");
    invalidateFinancialData();
    await loadPage();
  }

  const active = items.filter((i) => i.is_active);
  const totalActive = active.reduce((acc, i) => acc + Number(i.amount), 0);

  return (
    <PageFrame>
      <PageHeader title="Fixos" description="O que entra e o que sai todo mês, no automático." />

      <div className="space-y-4">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "expense", tone: "expense", label: (<><ArrowDownRight className="h-4 w-4" /> Gastos fixos</>) },
            { value: "income", tone: "income", label: (<><ArrowUpRight className="h-4 w-4" /> Receitas fixas</>) },
          ]}
        />

        {message ? <Alert type={messageType}>{message}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label={mode === "expense" ? "Sai por mês" : "Entra por mês"}
            value={<Money value={totalActive} size="md" tone={mode === "expense" ? "expense" : "income"} />}
          />
          <StatTile label="Ativos" value={active.length} />
          <StatTile label="Cadastrados" value={items.length} />
        </div>

        <section className="grid items-start gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Surface>
            <SectionHeader title={`Nov${mode === "expense" ? "o" : "a"} ${cfg.noun}`} />
            <form onSubmit={handleSave} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-fg-muted">Nome</span>
                <input className="control" type="text" placeholder={mode === "expense" ? "Ex: Aluguel" : "Ex: Salário"} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-fg-muted">Valor</span>
                  <input className="control" type="text" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={(e) => setAmount(formatMoneyInputValue(e.target.value))} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-fg-muted">Dia do mês</span>
                  <input className="control" type="number" min={1} max={31} placeholder="Ex: 10" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-fg-muted">Categoria</span>
                <select className="control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-fg-muted">A partir de <span className="text-fg-soft">(opcional)</span></span>
                <input className="control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <ActionButton type="submit" disabled={saving}>
                {saving ? "Salvando..." : `Salvar ${cfg.noun}`}
              </ActionButton>
            </form>
          </Surface>

          <Surface>
            <SectionHeader title={`${cap(cfg.nounPlural)} (${items.length})`} />
            {loading ? (
              <SkeletonList rows={3} />
            ) : items.length === 0 ? (
              <EmptyState
                title={`Nenhum${mode === "income" ? "a" : ""} ${cfg.noun} ainda`}
                description={`Cadastre ${mode === "expense" ? "o primeiro gasto que se repete" : "a primeira renda que se repete"} todo mês.`}
              />
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <article key={item.id} className="rounded-md border border-line px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-fg">{item.title}</h3>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          Dia {item.due_day} · {categoryName(item.categories)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Money value={Number(item.amount)} size="sm" tone={mode === "expense" ? "expense" : "income"} />
                        {!item.is_active ? <Badge tone="neutral">Inativo</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => handleToggle(item)} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg">
                        {item.is_active ? "Inativar" : "Ativar"}
                      </button>
                      <button onClick={() => handleDelete(item)} className="rounded-md border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10">
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Surface>
        </section>
      </div>
    </PageFrame>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
