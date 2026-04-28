"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonthsClamped, isPastOrToday, todayDateInput, toCompetenceMonth } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

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
  return Number(value.replace(",", ".") || 0);
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
      <span className="text-sm font-extrabold text-[var(--text)]">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)] ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)] ${props.className ?? ""}`}
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
      className="group rounded-[20px] border border-[var(--line)] bg-white p-4 text-left shadow-[0_8px_18px_rgba(9,42,32,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow-soft)]"
    >
      <span
        className={
          tone === "income"
            ? "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-lg font-black text-[var(--brand-strong)]"
            : "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-lg font-black text-red-600"
        }
      >
        {tone === "income" ? "+" : "-"}
      </span>
      <p className="text-base font-black text-[var(--navy)]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </button>
  );
}

export default function FinancialEntryModal({
  open,
  onClose,
  onSaved,
}: FinancialEntryModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<EntryMode>("menu");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);

  const today = todayDateInput();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentCount, setInstallmentCount] = useState("2");
  const [installmentValue, setInstallmentValue] = useState("");

  const [fixedDueDay, setFixedDueDay] = useState("");
  const [fixedMonthsAhead, setFixedMonthsAhead] = useState("12");
  const [fixedAutoCreate, setFixedAutoCreate] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Usuário não autenticado.");
        setExpenseCategories([]);
        setIncomeCategories([]);
        return;
      }

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, type")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });

      if (error) {
        setMessage(`Erro ao carregar categorias: ${error.message}`);
        return;
      }

      const all = (data ?? []) as Category[];
      setExpenseCategories(all.filter((c) => c.type === "expense"));
      setIncomeCategories(all.filter((c) => c.type === "income"));
    }

    if (open) {
      loadCategories();
      resetForm();
      setMode("menu");
      setMessage("");
    }
  }, [open, supabase]);

  useEffect(() => {
    setCategoryId("");
  }, [mode]);

  function resetForm() {
    setTitle("");
    setAmount("");
    setDate(today);
    setCategoryId("");
    setNotes("");
    setInstallmentTotal("");
    setInstallmentCount("2");
    setInstallmentValue("");
    setFixedDueDay("");
    setFixedMonthsAhead("12");
    setFixedAutoCreate(true);
  }

  async function getUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
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

    const endDate = addMonthsClamped(date, parsedMonths - 1);
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
        auto_create_transaction: fixedAutoCreate,
        start_date: date,
        end_date: endDate,
        months_ahead: parsedMonths,
      })
      .select("id")
      .single();

    if (fixedError || !fixedExpense) {
      setMessage(`Erro ao salvar gasto fixo: ${fixedError?.message}`);
      return;
    }

    if (!fixedAutoCreate) {
      finish(
        "Gasto fixo salvo sem gerar transações automáticas. Use automação futura para gerar as próximas."
      );
      return;
    }

    const dueTransactions = Array.from({ length: parsedMonths }, (_, index) => {
      const transactionDate = addMonthsClamped(date, index);
      if (!isPastOrToday(transactionDate)) return null;

      return {
        user_id: userId,
        type: "expense" as const,
        amount: parsedAmount,
        description: title.trim(),
        notes: notes.trim() || null,
        transaction_date: transactionDate,
        competence_month: toCompetenceMonth(transactionDate),
        category_id: categoryId || null,
        source: "web" as const,
        status: "active" as const,
        origin_type: "fixed_expense" as const,
        fixed_expense_id: fixedExpense.id,
      };
    }).filter(Boolean);

    if (dueTransactions.length > 0) {
      const { error: transactionsError } = await supabase
        .from("transactions")
        .insert(dueTransactions);

      if (transactionsError) {
        setMessage(`Erro ao gerar transações do gasto fixo: ${transactionsError.message}`);
        return;
      }
    }

    finish(
      dueTransactions.length > 0
        ? "Gasto fixo salvo. Apenas transações vencidas até hoje foram criadas para evitar poluição."
        : "Gasto fixo salvo. Nenhuma transação vencida até hoje para gerar."
    );
  }

  async function saveExpenseInstallment() {
    const userId = await getUserId();
    if (!userId) {
      setMessage("Usuário não autenticado.");
      return;
    }

    const parsedTotal = toMoney(installmentTotal);
    const parsedCount = Number(installmentCount);
    const parsedValue =
      toMoney(installmentValue) || Number((parsedTotal / parsedCount).toFixed(2));

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

    const { data: installment, error: installmentError } = await supabase
      .from("installments")
      .insert({
        user_id: userId,
        category_id: categoryId || null,
        title: title.trim(),
        description: notes.trim() || null,
        total_amount: parsedTotal,
        installment_amount: parsedValue,
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

    const dueTransactions = Array.from({ length: parsedCount }, (_, index) => {
      const transactionDate = addMonthsClamped(date, index);
      if (!isPastOrToday(transactionDate)) return null;

      return {
        user_id: userId,
        type: "expense" as const,
        amount: parsedValue,
        description: title.trim(),
        notes: notes.trim() || null,
        transaction_date: transactionDate,
        competence_month: toCompetenceMonth(transactionDate),
        category_id: categoryId || null,
        source: "web" as const,
        status: "active" as const,
        origin_type: "installment" as const,
        installment_id: installment.id,
        installment_number: index + 1,
        installment_total: parsedCount,
      };
    }).filter(Boolean);

    if (dueTransactions.length > 0) {
      const { error: txError } = await supabase
        .from("transactions")
        .insert(dueTransactions);
      if (txError) {
        setMessage(`Erro ao gerar parcelas vencidas: ${txError.message}`);
        return;
      }
    }

    finish(
      dueTransactions.length > 0
        ? "Parcelamento salvo. Apenas parcelas vencidas até hoje foram criadas."
        : "Parcelamento salvo. Parcelas futuras não foram criadas automaticamente."
    );
  }

  function finish(successMessage: string) {
    setMessage(successMessage);
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

  if (!open) return null;

  const isExpense = mode.includes("expense");
  const isInstallment = mode === "expense_installment";
  const isFixedExpense = mode === "expense_fixed";
  const isNormal = mode === "expense_normal" || mode === "income_normal" || mode === "income_fixed";
  const categoriesForMode = isExpense ? expenseCategories : incomeCategories;
  const titleMap: Record<EntryMode, string> = {
    menu: "Novo lançamento",
    expense_normal: "Gasto normal",
    expense_installment: "Gasto parcelado",
    expense_fixed: "Gasto fixo",
    income_normal: "Receita normal",
    income_fixed: "Receita fixa",
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/50 p-3 backdrop-blur-md sm:p-6">
      <div className="mx-auto flex h-full max-w-5xl items-center">
        <div className="max-h-[92vh] w-full overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_28px_70px_rgba(9,42,32,0.28)]">
          <header className="flex items-center justify-between bg-[#1A1A1A] px-5 py-5 text-white sm:px-6">
            <div>
              <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-white/78">Moedin.IA</p>
              <h2 className="text-2xl font-black">{titleMap[mode]}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xl font-bold text-white hover:bg-white/20"
              aria-label="Fechar"
            >
              X
            </button>
          </header>

          <div className="max-h-[calc(92vh-88px)] overflow-y-auto bg-[var(--bg-soft)] px-5 py-5 sm:px-6">
            {message ? (
              <div className="alert-info mb-4 rounded-2xl px-4 py-3 text-sm">
                {message}
              </div>
            ) : null}

            {mode === "menu" ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--muted)]">Despesas</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <ModeCard
                      title="Gasto normal"
                      description="Lançamento único em transactions."
                      onClick={() => setMode("expense_normal")}
                    />
                    <ModeCard
                      title="Gasto parcelado"
                      description="Cria installments e parcelas vencidas."
                      onClick={() => setMode("expense_installment")}
                    />
                    <ModeCard
                      title="Gasto fixo"
                      description="Cria recorrência em fixed_expenses."
                      onClick={() => setMode("expense_fixed")}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-[var(--muted)]">Receitas</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <ModeCard
                      title="Receita normal"
                      description="Lançamento único em transactions."
                      onClick={() => setMode("income_normal")}
                      tone="income"
                    />
                    <ModeCard
                      title="Receita fixa"
                      description="Regra temporária: salva como receita normal."
                      onClick={() => setMode("income_fixed")}
                      tone="income"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
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
                      <Field label="Valor de cada parcela (opcional)">
                        <Input
                          value={installmentValue}
                          onChange={(e) => setInstallmentValue(e.target.value)}
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
                      <p className="text-xs leading-5 text-[var(--muted)]">
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

                    <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={fixedAutoCreate}
                        onChange={(e) => setFixedAutoCreate(e.target.checked)}
                      />
                      Gerar apenas transações já vencidas em transactions
                    </label>
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
                    className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 font-semibold text-[var(--text)] transition hover:bg-[var(--bg-soft)]"
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
    </div>
  );
}
