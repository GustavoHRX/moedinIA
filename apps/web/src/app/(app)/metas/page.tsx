"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ActionButton, Badge, EmptyState, PageFrame, PageHeader, SectionHeader, StatCard, Surface } from "@/components/ui-kit";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  status: "active" | "completed" | "cancelled";
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string | null) {
  if (!date) return "Não definido";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function MetasPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

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

    setGoals((data ?? []) as Goal[]);
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedTarget = Number(targetAmount.replace(",", "."));

    if (!title.trim()) {
      setSaving(false);
      setMessage("Informe o título da meta.");
      return;
    }
    if (!parsedTarget || parsedTarget <= 0) {
      setSaving(false);
      setMessage("Informe um valor alvo válido.");
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
      setMessage(`Erro ao criar meta: ${error.message}`);
      return;
    }

    setTitle("");
    setDescription("");
    setTargetAmount("");
    setDeadline("");
    setMessage("Meta criada com sucesso.");
    await loadGoals();
  }

  async function handleUpdateProgress(goal: Goal) {
    const value = window.prompt(
      `Digite o novo valor acumulado para "${goal.title}":`,
      String(goal.current_amount)
    );
    if (value === null) return;

    const parsed = Number(value.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      setMessage("Valor inválido.");
      return;
    }

    const nextStatus = parsed >= Number(goal.target_amount) ? "completed" : "active";

    const { error } = await supabase
      .from("goals")
      .update({ current_amount: parsed, status: nextStatus })
      .eq("id", goal.id);

    if (error) {
      setMessage(`Erro ao atualizar progresso: ${error.message}`);
      return;
    }

    await loadGoals();
  }

  async function handleCancelGoal(goalId: string) {
    const confirmed = window.confirm("Deseja cancelar esta meta?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("goals")
      .update({ status: "cancelled" })
      .eq("id", goalId);

    if (error) {
      setMessage(`Erro ao cancelar meta: ${error.message}`);
      return;
    }

    await loadGoals();
  }

  const totalSaved = goals.reduce((acc, goal) => acc + Number(goal.current_amount), 0);
  const totalTargets = goals.reduce((acc, goal) => acc + Number(goal.target_amount), 0);
  const globalProgress = totalTargets > 0 ? Math.min((totalSaved / totalTargets) * 100, 100) : 0;

  return (
    <PageFrame>
      <PageHeader
        title="Metas"
        description="Defina objetivos, acompanhe progresso e mantenha foco no acumulado."
        eyebrow="Objetivos financeiros"
      />
      <div className="space-y-5">

      {message ? (
        <div className="alert-info rounded-2xl px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <Surface className="bg-[linear-gradient(135deg,#ffffff_0%,#eefaf4_100%)] p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Progresso geral</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-4xl font-black text-[var(--navy)]">{globalProgress.toFixed(0)}%</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{formatCurrency(totalSaved)} guardados de {formatCurrency(totalTargets)}</p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white lg:max-w-[360px]">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${globalProgress}%` }} />
            </div>
          </div>
        </Surface>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Total acumulado" value={formatCurrency(totalSaved)} tone="success" />
          <StatCard label="Total das metas" value={formatCurrency(totalTargets)} tone="brand" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <Surface>
          <SectionHeader title="Nova meta" eyebrow="Objetivo" />
          <form onSubmit={handleCreateGoal} className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
              type="text"
              placeholder="Titulo da meta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="min-h-[100px] w-full rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                type="text"
                placeholder="Valor alvo"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
              <input
                className="rounded-2xl border border-[var(--line)] px-4 py-3 outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <ActionButton
              type="submit"
              disabled={saving}
            >
              {saving ? "Criando..." : "Criar meta"}
            </ActionButton>
          </form>
        </Surface>

        <Surface>
          <SectionHeader title="Suas metas" eyebrow="Carteira de objetivos" />
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-[var(--muted)]">Carregando metas...</p>
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
                    <article key={goal.id} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-4 shadow-[0_7px_18px_rgba(9,42,32,0.04)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-[var(--text)]">{goal.title}</h3>
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
                        <p className="mt-1 text-sm text-[var(--muted)]">{goal.description}</p>
                      ) : null}
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {formatCurrency(Number(goal.current_amount))} de{" "}
                        {formatCurrency(Number(goal.target_amount))} - prazo {formatDate(goal.deadline)}
                      </p>
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-[var(--muted)]">Progresso</span>
                          <span className="font-semibold text-[var(--text)]">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[var(--bg-soft)]">
                          <div
                            className="h-2.5 rounded-full bg-[var(--success)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ActionButton
                          onClick={() => handleUpdateProgress(goal)}
                          tone="secondary"
                          className="px-3 py-2"
                        >
                          Atualizar progresso
                        </ActionButton>
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
