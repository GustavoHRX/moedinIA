"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { createClient } from "@/lib/supabase/client";
import { Wallet } from "lucide-react";
import { ActionButton, Alert, IconBox, PageFrame, PageHeader, SectionHeader, Surface } from "@/components/ui-kit";
import { Skeleton } from "@/components/skeleton";
import { Money } from "@/components/money";
import { formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";
import { currentMonthRef } from "@/lib/dates";
import { categoryVisualFrom } from "@/lib/categories";
import { categoryIconByName } from "@/lib/category-palette";

// Grava o mesmo valor para o mês atual + 12 meses seguintes — mesma convenção
// usada pelo limite geral (e espelhada no RPC whatsapp_set_monthly_limit).
function buildMonthlyRows(userId: string, categoryId: string | null, amount: number) {
  const startMonth = currentMonthRef();
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(`${startMonth}T00:00:00`);
    d.setMonth(d.getMonth() + i);
    return {
      user_id: userId,
      category_id: categoryId,
      month_ref: `${d.toISOString().slice(0, 7)}-01`,
      amount,
    };
  });
}

function CategoryLimitRow({
  categoryId,
  name,
  color,
  icon,
  currentLimit,
  onSave,
}: {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  currentLimit: number | null;
  onSave: (categoryId: string, amount: number) => Promise<boolean>;
}) {
  const { Icon, color: resolvedColor } = categoryVisualFrom(name, color, categoryIconByName(icon));
  const [input, setInput] = useState(currentLimit != null ? formatMoneyInputValue(String(currentLimit)) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInput(currentLimit != null ? formatMoneyInputValue(String(currentLimit)) : "");
  }, [currentLimit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseMoneyInput(input);
    if (!parsed || parsed <= 0) return;
    setSaving(true);
    const ok = await onSave(categoryId, parsed);
    setSaving(false);
    if (ok) setInput(formatMoneyInputValue(String(parsed)));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-line bg-bg-soft px-4 py-3 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${resolvedColor}1f`, color: resolvedColor }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{name}</p>
          <p className="text-xs text-fg-muted">
            {currentLimit != null ? <Money value={currentLimit} size="xs" /> : "Sem limite definido"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:w-56">
        <input
          className="control"
          type="text"
          inputMode="decimal"
          placeholder="Ex: 300,00"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={(e) => setInput(formatMoneyInputValue(e.target.value))}
        />
        <ActionButton type="submit" size="sm" tone="secondary" disabled={saving}>
          {saving ? "..." : "Salvar"}
        </ActionButton>
      </div>
    </form>
  );
}

export default function LimitePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user: cachedUser, loadingUser, categories, categoriesLoaded } = useAppData();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [limitInput, setLimitInput] = useState("");
  const [limitValue, setLimitValue] = useState<number | null>(null);
  const [savingLimit, setSavingLimit] = useState(false);

  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  useEffect(() => {
    if (loadingUser) return;
    if (!cachedUser) {
      router.push("/login");
      return;
    }
    loadLimits(cachedUser.id);
  }, [loadingUser, cachedUser]);

  async function loadLimits(userId: string) {
    setLoading(true);

    const { data: budgetRow } = await supabase
      .from("budgets")
      .select("amount")
      .eq("user_id", userId)
      .is("category_id", null)
      .order("month_ref", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (budgetRow?.amount != null) {
      setLimitValue(Number(budgetRow.amount));
      setLimitInput(formatMoneyInputValue(String(budgetRow.amount)));
    }

    const { data: categoryRows } = await supabase
      .from("budgets")
      .select("category_id, amount, month_ref")
      .eq("user_id", userId)
      .not("category_id", "is", null)
      .order("month_ref", { ascending: false });

    // Mantém só a linha mais recente por categoria (já vem ordenado desc).
    const latestByCategory: Record<string, number> = {};
    for (const row of categoryRows ?? []) {
      const id = row.category_id as string;
      if (!(id in latestByCategory)) latestByCategory[id] = Number(row.amount);
    }
    setCategoryLimits(latestByCategory);

    setLoading(false);
  }

  async function handleSaveLimit(e: React.FormEvent) {
    e.preventDefault();
    const userId = cachedUser?.id;
    if (!userId) return;
    const parsed = parseMoneyInput(limitInput);
    if (!parsed || parsed <= 0) {
      showMessage("Informe um valor de limite válido.", "error");
      return;
    }

    setSavingLimit(true);
    const startMonth = currentMonthRef();
    await supabase
      .from("budgets")
      .delete()
      .eq("user_id", userId)
      .is("category_id", null)
      .gte("month_ref", startMonth);

    const { error } = await supabase.from("budgets").insert(buildMonthlyRows(userId, null, parsed));
    setSavingLimit(false);

    if (error) {
      showMessage(`Erro ao salvar limite: ${error.message}`, "error");
      return;
    }
    setLimitValue(parsed);
    setLimitInput(formatMoneyInputValue(String(parsed)));
    showMessage("Limite de gasto mensal atualizado.", "success");
  }

  async function handleSaveCategoryLimit(categoryId: string, amount: number) {
    const userId = cachedUser?.id;
    if (!userId) return false;

    const startMonth = currentMonthRef();
    await supabase
      .from("budgets")
      .delete()
      .eq("user_id", userId)
      .eq("category_id", categoryId)
      .gte("month_ref", startMonth);

    const { error } = await supabase.from("budgets").insert(buildMonthlyRows(userId, categoryId, amount));
    if (error) {
      showMessage(`Erro ao salvar limite da categoria: ${error.message}`, "error");
      return false;
    }
    setCategoryLimits((prev) => ({ ...prev, [categoryId]: amount }));
    showMessage("Limite da categoria atualizado.", "success");
    return true;
  }

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories]
  );

  return (
    <PageFrame>
      <PageHeader
        title="Limite de gasto"
        description="Um teto geral para o mês e, se quiser, um teto separado por categoria."
        eyebrow="Orçamento"
      />
      <div className="space-y-5">
        {message ? <Alert type={messageType}>{message}</Alert> : null}

        <Surface>
          <SectionHeader
            title="Limite de gasto mensal"
            description="Um teto para o mês. O alerta de 'perto do limite' usa esse valor. Vale para todos os meses."
          />
          {loading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <form onSubmit={handleSaveLimit} className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex items-center gap-3">
                <IconBox tone="brand" size="lg">
                  <Wallet className="h-5 w-5" strokeWidth={2.2} />
                </IconBox>
                {limitValue != null ? (
                  <Money value={limitValue} size="lg" />
                ) : (
                  <span className="text-sm text-fg-muted">Sem limite definido</span>
                )}
              </div>
              <label className="block flex-1 space-y-1.5">
                <span className="text-xs font-medium text-fg-muted">Novo valor</span>
                <input
                  className="control"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 3.500,00"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  onBlur={(e) => setLimitInput(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <ActionButton type="submit" disabled={savingLimit}>
                {savingLimit ? "Salvando..." : "Salvar limite"}
              </ActionButton>
            </form>
          )}
        </Surface>

        <Surface>
          <SectionHeader
            title="Limite por categoria"
            description="Defina um teto mensal para categorias específicas, como Alimentação ou Games. Vale para todos os meses."
          />
          {loading || !categoriesLoaded ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : expenseCategories.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-4 py-5 text-center text-sm text-fg-muted">
              Você ainda não tem categorias de despesa cadastradas.
            </p>
          ) : (
            <div className="space-y-2">
              {expenseCategories.map((category) => (
                <CategoryLimitRow
                  key={category.id}
                  categoryId={category.id}
                  name={category.name}
                  color={category.color}
                  icon={category.icon}
                  currentLimit={categoryLimits[category.id] ?? null}
                  onSave={handleSaveCategoryLimit}
                />
              ))}
            </div>
          )}
        </Surface>
      </div>
    </PageFrame>
  );
}
