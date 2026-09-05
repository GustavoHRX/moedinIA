"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/app-data-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton";
import { todayDateInput } from "@/lib/dates";
import { formatCurrency, formatDate, formatMoneyInputValue, parseMoneyInput } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, Alert, Badge, EmptyState, PageFrame, PageHeader, SectionHeader, StatCard, Surface } from "@/components/ui-kit";
import { HominhoTip } from "@/components/hominho-tip";
import { CelebrateBurst } from "@/components/celebrate";
import { metasTips } from "@/lib/tips";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  status: "active" | "completed" | "cancelled";
};

// Calcula dias restantes até o prazo (negativo = vencido)
function daysUntil(deadline: string) {
  const today = new Date(`${todayDateInput()}T00:00:00`);
  const target = new Date(`${deadline.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function MetasPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const {
    user: cachedUser,
    loadingUser,
    financialVersion,
    getFinancialCache,
    setFinancialCache,
    invalidateFinancialData,
  } = useAppData();
  const confirm = useConfirm();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);
  const [celebrateGoalId, setCelebrateGoalId] = useState<string | null>(null);
  const [progressInput, setProgressInput] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  const loadGoals = useCallback(async (forceRefresh = false) => {
    if (loadingUser) return;

    const user = cachedUser;

    if (!user) {
      router.push("/login");
      return;
    }

    const cacheKey = `goals:${user.id}`;
    const cachedGoals = forceRefresh ? null : getFinancialCache<Goal[]>(cacheKey);

    if (cachedGoals) {
      setGoals(cachedGoals);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setMessage(`Erro ao carregar metas: ${error.message}`);
      return;
    }

    const nextGoals = (data ?? []) as Goal[];
    setGoals(nextGoals);
    setFinancialCache(cacheKey, nextGoals);
  }, [cachedUser, getFinancialCache, loadingUser, router, setFinancialCache, supabase]);

  useEffect(() => {
    loadGoals();
  }, [financialVersion, loadGoals]);

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const userId = cachedUser?.id;
    if (!userId) {
      showMessage("Usuário não autenticado.", "error");
      setSaving(false);
      return;
    }

    const parsedTarget = parseMoneyInput(targetAmount);

    if (!title.trim()) {
      setSaving(false);
      showMessage("Informe o título da meta.", "error");
      return;
    }
    if (!parsedTarget || parsedTarget <= 0) {
      setSaving(false);
      showMessage("Informe um valor alvo válido.", "error");
      return;
    }

    const { error } = await supabase.from("goals").insert({
      user_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      target_amount: parsedTarget,
      current_amount: 0,
      deadline: deadline || null,
      status: "active",
    });

    setSaving(false);

    if (error) {
      showMessage(`Erro ao criar meta: ${error.message}`, "error");
      return;
    }

    setTitle("");
    setDescription("");
    setTargetAmount("");
    setDeadline("");
    showMessage("Meta criada com sucesso.", "success");
    invalidateFinancialData();
    await loadGoals(true);
  }

  function startUpdateProgress(goal: Goal) {
    setUpdatingGoalId(goal.id);
    setProgressInput(formatMoneyInputValue(goal.current_amount));
    setMessage("");
  }

  function cancelUpdateProgress() {
    setUpdatingGoalId(null);
    setProgressInput("");
  }

  async function saveProgress(goal: Goal) {
    const parsed = parseMoneyInput(progressInput);
    if (Number.isNaN(parsed) || parsed < 0) {
      showMessage("Valor inválido. Digite um número maior ou igual a zero.", "error");
      return;
    }

    setSavingProgress(true);
    const nextStatus = parsed >= Number(goal.target_amount) ? "completed" : "active";

    const { error } = await supabase
      .from("goals")
      .update({ current_amount: parsed, status: nextStatus })
      .eq("id", goal.id)
      .eq("user_id", cachedUser!.id);

    setSavingProgress(false);

    if (error) {
      showMessage(`Erro ao atualizar progresso: ${error.message}`, "error");
      return;
    }

    setUpdatingGoalId(null);
    setProgressInput("");
    showMessage(
      nextStatus === "completed" ? "Meta concluída! Parabéns." : "Progresso atualizado.",
      "success"
    );
    if (nextStatus === "completed") {
      setCelebrateGoalId(goal.id);
      setTimeout(() => setCelebrateGoalId(null), 1800);
    }
    invalidateFinancialData();
    await loadGoals(true);
  }

  async function handleCancelGoal(goalId: string) {
    const confirmed = await confirm({
      title: "Cancelar meta",
      message: "Deseja cancelar esta meta? Ela ficará marcada como cancelada.",
      confirmLabel: "Cancelar meta",
      cancelLabel: "Voltar",
    });
    if (!confirmed) return;

    const { error } = await supabase
      .from("goals")
      .update({ status: "cancelled" })
      .eq("id", goalId)
      .eq("user_id", cachedUser!.id);

    if (error) {
      showMessage(`Erro ao cancelar meta: ${error.message}`, "error");
      return;
    }

    showMessage("Meta cancelada.", "success");
    invalidateFinancialData();
    await loadGoals(true);
  }

  const totalSaved = goals.reduce((acc, goal) => acc + Number(goal.current_amount), 0);
  const totalTargets = goals.reduce((acc, goal) => acc + Number(goal.target_amount), 0);
  const globalProgress = totalTargets > 0 ? Math.min((totalSaved / totalTargets) * 100, 100) : 0;

  return (
    <PageFrame>
      <PageHeader
        title="Metas"
        description="Crie objetivos e acompanhe seu progresso até realizar cada um."
        eyebrow="Objetivos financeiros"
      />
      <div className="space-y-5">
        <HominhoTip
          page="metas"
          hominho="marcinho"
          tips={useMemo(
            () => metasTips({ goals, todayISO: new Date().toISOString().slice(0, 10) }),
            [goals]
          )}
        />

      {message ? <Alert type={messageType}>{message}</Alert> : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <Surface className="min-w-0 bg-surface p-6">
          <p className="eyebrow">Progresso geral</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-4xl font-semibold text-fg">{globalProgress.toFixed(0)}%</p>
              <p className="mt-1 text-sm text-fg-muted">{formatCurrency(totalSaved)} guardados de {formatCurrency(totalTargets)}</p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-strong lg:max-w-[360px]">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${globalProgress}%` }} />
            </div>
          </div>
        </Surface>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <StatCard label="Total acumulado" value={formatCurrency(totalSaved)} tone="success" />
          <StatCard label="Total das metas" value={formatCurrency(totalTargets)} tone="brand" />
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <Surface className="min-w-0">
          <SectionHeader title="Nova meta" eyebrow="Objetivo" />
          <form onSubmit={handleCreateGoal} className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-fg">Título da meta</span>
              <input
                className="w-full rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                type="text"
                placeholder="Ex: Reserva de emergência"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-fg">Descrição (opcional)</span>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                placeholder="Detalhes da meta"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-fg">Valor alvo</span>
                <input
                  className="w-full rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                  type="text"
                  placeholder="0,00"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  onBlur={(e) => setTargetAmount(formatMoneyInputValue(e.target.value))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-fg">Prazo (opcional)</span>
                <input
                  className="w-full rounded-md border border-line px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
            </div>
            <ActionButton
              type="submit"
              disabled={saving}
            >
              {saving ? "Criando..." : "Criar meta"}
            </ActionButton>
          </form>
        </Surface>

        <Surface className="min-w-0">
          <SectionHeader title="Suas metas" eyebrow="Carteira de objetivos" />
          <div className="mt-4">
            {loading ? (
<SkeletonList rows={3} />
            ) : goals.length === 0 ? (
              <EmptyState
                title="Nenhuma meta cadastrada"
                description="Crie sua primeira meta para acompanhar crescimento."
              />
            ) : (
              <div className="space-y-2">
                {goals.map((goal) => {
                  const progress =
                    Number(goal.target_amount) > 0
                      ? Math.min(
                          (Number(goal.current_amount) / Number(goal.target_amount)) * 100,
                          100
                        )
                      : 0;

                  return (
                    <article
                      key={goal.id}
                      className={`relative rounded-md border border-line bg-surface-strong px-4 py-4 ${
                        celebrateGoalId === goal.id ? "anim-card-pulse" : ""
                      }`}
                    >
                      <CelebrateBurst trigger={celebrateGoalId === goal.id ? goal.id : null} />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-fg">{goal.title}</h3>
                        <Badge
                          tone={
                            goal.status === "completed"
                              ? "success"
                              : goal.status === "cancelled"
                              ? "neutral"
                              : "brand"
                          }
                        >
                          {goal.status === "completed"
                            ? "Concluída"
                            : goal.status === "cancelled"
                            ? "Cancelada"
                            : "Ativa"}
                        </Badge>
                      </div>
                      {goal.description ? (
                        <p className="mt-1 text-sm text-fg-muted">{goal.description}</p>
                      ) : null}
                      <p className="mt-2 text-sm text-fg-muted">
                        {formatCurrency(Number(goal.current_amount))} de{" "}
                        {formatCurrency(Number(goal.target_amount))} - prazo {formatDate(goal.deadline)}
                      </p>
                      {goal.status === "active" && goal.deadline
                        ? (() => {
                            const dias = daysUntil(goal.deadline);
                            const vencido = dias < 0;
                            const proximo = dias >= 0 && dias <= 30;
                            const cor = vencido ? "var(--danger)" : proximo ? "var(--warning)" : "var(--muted)";
                            const texto = vencido
                              ? `Prazo vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`
                              : dias === 0
                              ? "Vence hoje"
                              : `Faltam ${dias} dia${dias === 1 ? "" : "s"}`;
                            return (
                              <p className="mt-1 text-xs font-semibold" style={{ color: cor }}>
                                {texto}
                              </p>
                            );
                          })()
                        : null}
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-fg-muted">Progresso</span>
                          <span className="font-semibold text-fg">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-bg-soft">
                          <div
                            className="h-2.5 rounded-full bg-[var(--success)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {updatingGoalId === goal.id ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-36 rounded-md border border-line bg-surface-strong px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-ring"
                            placeholder="Valor acumulado"
                            value={progressInput}
                            onChange={(e) => setProgressInput(e.target.value)}
                            onBlur={(e) => setProgressInput(formatMoneyInputValue(e.target.value))}
                            autoFocus
                          />
                          <ActionButton
                            onClick={() => saveProgress(goal)}
                            disabled={savingProgress}
                            className="px-3 py-2"
                          >
                            {savingProgress ? "Salvando..." : "Salvar"}
                          </ActionButton>
                          <ActionButton
                            onClick={cancelUpdateProgress}
                            tone="secondary"
                            className="px-3 py-2"
                          >
                            Cancelar
                          </ActionButton>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {goal.status === "active" ? (
                            <ActionButton
                              onClick={() => startUpdateProgress(goal)}
                              tone="secondary"
                              className="px-3 py-2"
                            >
                              Atualizar progresso
                            </ActionButton>
                          ) : null}
                          {goal.status !== "cancelled" && goal.status !== "completed" ? (
                            <ActionButton
                              onClick={() => handleCancelGoal(goal.id)}
                              tone="danger"
                              className="px-3 py-2"
                            >
                              Cancelar
                            </ActionButton>
                          ) : null}
                        </div>
                      )}
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
