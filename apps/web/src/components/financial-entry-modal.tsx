"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppData } from "@/components/app-data-provider";
import { addMonthsClamped, todayDateInput, toCompetenceMonth } from "@/lib/dates";
import { catchUpRecurrences } from "@/lib/recurrence-catchup";
import { splitInstallments } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";

type EntryMode =
  | "menu"
  | "expense_normal"
  | "expense_installment"
  | "expense_fixed"
  | "income_normal"
  | "income_fixed";

type FinancialEntryModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

function toMoney(value: string) {
  return parseMoneyInput(value);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-fg">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-line bg-surface-strong px-4 py-3 text-fg outline-none transition focus:border-primary focus:ring-4 focus:ring-ring ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-line bg-surface-strong px-4 py-3 text-fg outline-none transition focus:border-primary focus:ring-4 focus:ring-ring ${props.className ?? ""}`}
    />
  );
}

function ModeCard({
  title,
  description,
  onClick,
  tone = "expense",
}: {
  title: string;
  description: string;
  onClick: () => void;
  tone?: "expense" | "income";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-line bg-surface-strong p-4 text-left transition hover:-translate-y-0.5 hover:border-primary"
    >
      <span
        className={
          tone === "income"
            ? "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-lg font-semibold text-primary-strong"
            : "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-lg text-danger"
        }
      >
        {tone === "income" ? "+" : "-"}
      </span>
      <p className="text-base font-semibold text-fg">{title}</p>
      <p className="mt-1 text-sm leading-6 text-fg-muted">{description}</p>
    </button>
  );
}

export default function FinancialEntryModal({
  open,
  onClose,
  onSaved,
}: FinancialEntryModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const {
    user: cachedUser,
    loadingUser,
    categoriesLoaded,
    getCategoriesByType,
    refreshCategories,
    invalidateFinancialData,
  } = useAppData();
  const [mode, setMode] = useState<EntryMode>("menu");
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => todayDateInput());
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentCount, setInstallmentCount] = useState("2");

  const [fixedDueDay, setFixedDueDay] = useState("");
  const [fixedMonthsAhead, setFixedMonthsAhead] = useState("12");

  // AUDITORIA / achado 6.3 — acessibilidade do modal.
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Foco inicial + devolução de foco + Escape + trap de Tab.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    resetForm();
    setMode("menu");
    setMessage("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadCategories() {
      try {
        const cachedExpense = getCategoriesByType("expense");
        const cachedIncome = getCategoriesByType("income");

        if (categoriesLoaded && cachedExpense.length > 0 && cachedIncome.length > 0) {
          if (!cancelled) {
            setExpenseCategories(cachedExpense);
            setIncomeCategories(cachedIncome);
          }
          return;
        }

        const refreshed = await refreshCategories();
        if (cancelled) return;

        setExpenseCategories(refreshed.filter((category) => category.type === "expense"));
        setIncomeCategories(refreshed.filter((category) => category.type === "income"));
      } catch (error) {
        if (cancelled) return;

        setMessage(
          `Erro ao carregar categorias: ${error instanceof Error ? error.message : "erro desconhecido"}`
        );
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [categoriesLoaded, getCategoriesByType, open, refreshCategories]);

  useEffect(() => {
    setCategoryId("");
  }, [mode]);

  function resetForm() {
    setTitle("");
    setAmount("");
    setDate(todayDateInput());
    setCategoryId("");
    setNotes("");
    setInstallmentTotal("");
    setInstallmentCount("2");
    setFixedDueDay("");
    setFixedMonthsAhead("12");
  }

  async function getUserId() {
    if (cachedUser?.id) {
      return cachedUser.id;
    }

    if (loadingUser) {
      return null;
    }

    return null;
  }

  async function createManualTransaction(type: "income" | "expense") {
    const userId = await getUserId();
    if (!userId) {
      setMessage("Usuário não autenticado.");
      return false;
    }

    const parsedAmount = toMoney(amount);
    if (!title.trim()) {
      setMessage("Informe a descrição do lançamento.");
      return false;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("Informe um valor válido.");
      return false;
    }
    if (!date) {
      setMessage("Informe a data.");
      return false;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type,
      amount: parsedAmount,
      description: title.trim(),
      notes: notes.trim() || null,
      transaction_date: date,
      competence_month: toCompetenceMonth(date),
      category_id: categoryId || null,
      source: "web",
      status: "active",
      origin_type: "manual",
    });

    if (error) {
      setMessage(`Erro ao salvar lançamento: ${error.message}`);
      return false;
    }

    return true;
  }

  async function saveExpenseFixed() {
    const userId = await getUserId();
    if (!userId) {
      setMessage("Usuário não autenticado.");
      return;
    }

    const parsedAmount = toMoney(amount);
    const parsedDueDay = Number(fixedDueDay);
    const parsedMonths = Number(fixedMonthsAhead || 12);

    if (!title.trim()) {
      setMessage("Informe a descrição do gasto fixo.");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("Informe um valor válido.");
      return;
    }
    if (!date) {
      setMessage("Informe a data inicial.");
      return;
    }
    if (!parsedDueDay || parsedDueDay < 1 || parsedDueDay > 31) {
      setMessage("Informe um dia de vencimento válido.");
      return;
    }
    if (!parsedMonths || parsedMonths < 1) {
      setMessage("Informe a duração em meses.");
      return;
    }

    const { data: fixedExpense, error: fixedError } = await supabase
      .from("fixed_expenses")
      .insert({
        user_id: userId,
        category_id: categoryId || null,
        title: title.trim(),
        description: notes.trim() || null,
        amount: parsedAmount,
        due_day: parsedDueDay,
        is_active: true,
        auto_create_transaction: true,
        start_date: date,
        months_ahead: parsedMonths,
      })
      .select("id")
      .single();

    if (fixedError || !fixedExpense) {
      setMessage(`Erro ao salvar gasto fixo: ${fixedError?.message}`);
      return;
    }

    // Geração de transações é responsabilidade única do catch-up (mesma regra
    // de datas para criação e para os meses seguintes). Idempotente.
    try {
      await catchUpRecurrences(supabase, userId);
    } catch {
      finish("Gasto fixo salvo. Os lançamentos vencidos serão gerados ao abrir o app.");
      return;
    }

    finish("Gasto fixo salvo. Só os lançamentos vencidos até hoje foram criados.");
  }

  async function saveExpenseInstallment() {
    const userId = await getUserId();
    if (!userId) {
      setMessage("Usuário não autenticado.");
      return;
    }

    const parsedTotal = toMoney(installmentTotal);
    const parsedCount = Number(installmentCount);

    if (!title.trim()) {
      setMessage("Informe a descrição do gasto parcelado.");
      return;
    }
    if (!parsedTotal || parsedTotal <= 0) {
      setMessage("Informe o valor total.");
      return;
    }
    if (!parsedCount || parsedCount < 2) {
      setMessage("Informe uma quantidade válida de parcelas.");
      return;
    }
    if (!date) {
      setMessage("Informe a data da primeira parcela.");
      return;
    }

    // installment_amount guarda o valor "de referência" (1ª parcela); os
    // valores reais por parcela — com a última fechando o total — vêm de
    // splitInstallments no catch-up.
    const parcelas = splitInstallments(parsedTotal, parsedCount);

    const { data: installment, error: installmentError } = await supabase
      .from("installments")
      .insert({
        user_id: userId,
        category_id: categoryId || null,
        title: title.trim(),
        description: notes.trim() || null,
        total_amount: parsedTotal,
        installment_amount: parcelas[0],
        total_installments: parsedCount,
        start_date: date,
        is_active: true,
      })
      .select("id")
      .single();

    if (installmentError || !installment) {
      setMessage(`Erro ao salvar parcelamento: ${installmentError?.message}`);
      return;
    }

    try {
      await catchUpRecurrences(supabase, userId);
    } catch {
      finish("Parcelamento salvo. As parcelas vencidas serão geradas ao abrir o app.");
      return;
    }

    finish("Parcelamento salvo. Só as parcelas vencidas até hoje foram criadas.");
  }

  function finish(successMessage: string) {
    setMessage(successMessage);
    invalidateFinancialData();
    window.dispatchEvent(new CustomEvent("financial-data-invalidated"));
    setTimeout(() => {
      onClose();
      onSaved?.();
    }, 700);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      if (mode === "expense_normal") {
        const ok = await createManualTransaction("expense");
        if (ok) finish("Gasto normal registrado com sucesso.");
      }

      if (mode === "income_normal") {
        const ok = await createManualTransaction("income");
        if (ok) finish("Receita normal registrada com sucesso.");
      }

      if (mode === "income_fixed") {
        const ok = await createManualTransaction("income");
        if (ok) {
          // Temporary business rule: income recurrence is not modeled yet.
          finish(
            "Receita fixa salva como lançamento normal. A recorrência de receita será evoluída em etapa futura."
          );
        }
      }

      if (mode === "expense_fixed") {
        await saveExpenseFixed();
      }

      if (mode === "expense_installment") {
        await saveExpenseInstallment();
      }
    } finally {
      setSaving(false);
    }
  }

  // Próxima ocorrência do gasto fixo a partir do dia de vencimento informado —
  // alimenta o preview "R$ X por mês, próxima em DD/MM/AAAA". Precisa vir
  // antes do "if (!open) return null" abaixo — hooks não podem ser
  // condicionais, senão o React quebra ao reabrir o modal (erro #310).
  const nextFixedDueDate = useMemo(() => {
    const day = Number(fixedDueDay);
    if (!day || day < 1 || day > 31) return null;

    const today = todayDateInput();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const lastDayThisMonth = new Date(year, month, 0).getDate();
    const clampedDay = Math.min(day, lastDayThisMonth);

    const candidate = `${today.slice(0, 7)}-${String(clampedDay).padStart(2, "0")}`;
    return candidate >= today ? candidate : addMonthsClamped(candidate, 1);
  }, [fixedDueDay]);

  if (!open || !mounted) return null;

  const isExpense = mode.includes("expense");
  const isInstallment = mode === "expense_installment";
  const isFixedExpense = mode === "expense_fixed";
  const categoriesForMode = isExpense ? expenseCategories : incomeCategories;

  const titleMap: Record<EntryMode, string> = {
    menu: "Novo lançamento",
    expense_normal: "Gasto normal",
    expense_installment: "Gasto parcelado",
    expense_fixed: "Gasto fixo",
    income_normal: "Receita normal",
    income_fixed: "Receita fixa",
  };

  return createPortal(
    <div
      className="anim-modal-backdrop fixed inset-0 z-[100] bg-black/45 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex h-full max-w-5xl items-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="financial-entry-title"
          className="anim-modal-card max-h-[92vh] w-full overflow-hidden rounded-lg border border-line bg-surface-strong shadow-modal"
        >
          <header className="flex items-center justify-between bg-surface px-5 py-5 text-fg sm:px-6">
            <div>
              <p className="eyebrow">Moedin.IA</p>
              <h2 id="financial-entry-title" className="text-2xl font-semibold">{titleMap[mode]}</h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-xl font-semibold text-fg hover:bg-bg-soft focus:outline-none focus:ring-2 focus:ring-[var(--brand-strong)]"
              aria-label="Fechar"
            >
              X
            </button>
          </header>

          <div className="max-h-[calc(92vh-88px)] overflow-y-auto bg-bg-soft px-5 py-5 sm:px-6">
            {message ? (
              <div className={`mb-4 rounded-md border px-4 py-3 text-sm font-semibold ${
                message.startsWith("Erro") || message.startsWith("Informe") || message.startsWith("Usuário")
                  ? "border-danger/35 bg-danger/10 text-expense"
                  : "border-success/35 bg-success/10 text-income"
              }`}>
                {message}
              </div>
            ) : null}

            {mode === "menu" ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase text-fg-muted">Despesas</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <ModeCard
                      title="Gasto normal"
                      description="Um gasto único, que já aconteceu."
                      onClick={() => setMode("expense_normal")}
                    />
                    <ModeCard
                      title="Gasto parcelado"
                      description="Divide o valor em parcelas mensais."
                      onClick={() => setMode("expense_installment")}
                    />
                    <ModeCard
                      title="Gasto fixo"
                      description="Se repete todo mês, automaticamente."
                      onClick={() => setMode("expense_fixed")}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-fg-muted">Receitas</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <ModeCard
                      title="Receita normal"
                      description="Uma entrada única, sem repetição."
                      onClick={() => setMode("income_normal")}
                      tone="income"
                    />
                    <ModeCard
                      title="Receita fixa"
                      description="Entra todo mês, tipo salário."
                      onClick={() => setMode("income_fixed")}
                      tone="income"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-surface-strong p-4 sm:p-5">
                <div className="space-y-4">
                <Field label={isExpense ? "Descrição do gasto" : "Descrição da receita"}>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isExpense ? "Ex: mercado" : "Ex: salário"}
                  />
                </Field>

                {isInstallment ? (
                  <>
                    <Field label="Valor total da compra">
                      <Input
                        value={installmentTotal}
                        onChange={(e) => setInstallmentTotal(e.target.value)}
                        onBlur={(e) => setInstallmentTotal(formatMoneyInputValue(e.target.value))}
                        placeholder="0,00"
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Quantidade de parcelas">
                        <Input
                          type="number"
                          min={2}
                          value={installmentCount}
                          onChange={(e) => setInstallmentCount(e.target.value)}
                        />
                      </Field>
                      <Field label="Valor de cada parcela">
                        <Input
                          value={(() => {
                            const total = toMoney(installmentTotal);
                            const count = Number(installmentCount);
                            if (!(total > 0) || !(count >= 2)) return "";
                            const parts = splitInstallments(total, count);
                            const first = parts[0].toFixed(2).replace(".", ",");
                            const last = parts[parts.length - 1].toFixed(2).replace(".", ",");
                            return first === last ? first : `${first} (última ${last})`;
                          })()}
                          readOnly
                          placeholder="Auto"
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <Field label="Valor">
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onBlur={(e) => setAmount(formatMoneyInputValue(e.target.value))}
                      placeholder="0,00"
                    />
                  </Field>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Categoria">
                    <Select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Sem categoria</option>
                      {categoriesForMode.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                    {categoriesForMode.length === 0 ? (
                      <p className="text-xs leading-5 text-fg-muted">
                        Nenhuma categoria deste tipo cadastrada. O lançamento será salvo sem categoria.
                      </p>
                    ) : null}
                  </Field>

                  <Field label={isInstallment ? "Data da primeira parcela" : "Data"}>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                </div>

                {isFixedExpense ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Dia de vencimento">
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={fixedDueDay}
                          onChange={(e) => setFixedDueDay(e.target.value)}
                        />
                      </Field>
                      <Field label="Duração (meses)">
                        <Input
                          type="number"
                          min={1}
                          value={fixedMonthsAhead}
                          onChange={(e) => setFixedMonthsAhead(e.target.value)}
                        />
                      </Field>
                    </div>
                    {/* Preview do que será salvo — mesmo espírito do "valor de cada
                        parcela" do parcelamento, mas pro gasto fixo. */}
                    {toMoney(amount) > 0 && Number(fixedDueDay) >= 1 && Number(fixedDueDay) <= 31 ? (
                      <p className="rounded-md border border-line bg-bg-soft px-3 py-2 text-sm text-fg">
                        <strong className="text-fg">{formatCurrency(toMoney(amount))}</strong> por
                        mês, próxima em{" "}
                        <strong className="text-fg">{formatDate(nextFixedDueDate)}</strong>.
                      </p>
                    ) : null}
                  </>
                ) : null}

                <Field label="Observações (opcional)">
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalhes extras"
                  />
                </Field>

                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMessage("");
                      setMode("menu");
                    }}
                    className="rounded-md border border-line bg-surface-strong px-5 py-3 font-semibold text-fg transition hover:bg-bg-soft"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-5 py-3 disabled:opacity-70"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
