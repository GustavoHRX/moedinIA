"use client";

import { CheckCircle2, CreditCard, Crown, Sparkles } from "lucide-react";
import { ActionButton, Badge, PageFrame, PageHeader, Surface } from "@/components/ui-kit";

type Plan = {
  name: string;
  price: string;
  period: string;
  note: string;
  badge?: string;
  highlighted?: boolean;
  features: string[];
  button: string;
};

const plans: Plan[] = [
  {
    name: "Mensal",
    price: "R$ 29,90",
    period: "/ mês",
    note: "Flexível, sem compromisso.",
    features: [
      "Controle financeiro completo",
      "Dashboard",
      "Histórico",
      "Metas",
      "Gastos fixos",
      "Parcelamentos",
      "Orçamentos",
    ],
    button: "Começar agora",
  },
  {
    name: "Semestral",
    price: "R$ 19,90",
    period: "/ mês",
    note: "Cobrado a cada 6 meses.",
    badge: "Recomendado",
    highlighted: true,
    features: [
      "Todos os recursos do mensal",
      "Economia em relação ao mensal",
      "Preparado para IA e WhatsApp",
      "Dashboard, metas e orçamentos",
      "Fixos e parcelamentos no mesmo lugar",
    ],
    button: "Assinar plano",
  },
  {
    name: "Anual",
    price: "R$ 14,90",
    period: "/ mês",
    note: "Cobrado anualmente.",
    badge: "Melhor valor",
    features: [
      "Todos os recursos",
      "Maior economia",
      "Prioridade em recursos futuros",
      "Preparado para automações com IA",
      "Gestão completa pelo painel",
    ],
    button: "Assinar plano",
  },
];

function handlePaymentClick() {
  window.alert("Integração de pagamento em desenvolvimento.");
}

export default function PlanosPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Assinatura"
        title="Escolha seu plano"
        description="Controle suas finanças com mais clareza, automação e inteligência."
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Surface className="relative overflow-hidden bg-[var(--hero-gradient)] p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--brand-glow)] blur-3xl" />
          <div className="relative">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-[0_18px_36px_var(--brand-glow)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
              Finance + IA
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-black leading-tight text-[var(--navy)] sm:text-4xl">
              Uma assinatura para organizar gastos, metas, fixos e parcelamentos sem complicar sua rotina.
            </h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[var(--muted)]">
              Os botões ainda são visuais enquanto a integração de pagamento é preparada.
            </p>
          </div>
        </Surface>

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-3">
          {[
            ["Dashboard", "Visão mensal clara"],
            ["WhatsApp", "Registro natural"],
            ["IA", "Mais automação"],
          ].map(([title, text]) => (
            <Surface key={title} className="p-5">
              <p className="font-display text-lg font-black text-[var(--navy)]">{title}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">{text}</p>
            </Surface>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <Surface
            key={plan.name}
            className={
              plan.highlighted
                ? "relative overflow-hidden border-[rgba(46,158,79,0.42)] bg-[linear-gradient(145deg,var(--surface-strong),var(--brand-soft))] p-6 shadow-[var(--shadow-glow)] ring-1 ring-[rgba(46,158,79,0.22)] lg:-translate-y-3"
                : "p-6"
            }
          >
            <div className="flex min-h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Plano
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-black text-[var(--navy)]">{plan.name}</h2>
                </div>
                {plan.badge ? (
                  <Badge tone={plan.highlighted ? "brand" : "neutral"}>{plan.badge}</Badge>
                ) : null}
              </div>

              <div className="mt-7">
                <div className="flex items-end gap-2">
                  <span className="font-display text-4xl font-black text-[var(--navy)] sm:text-5xl">{plan.price}</span>
                  <span className="pb-2 text-sm font-bold text-[var(--muted)]">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{plan.note}</p>
              </div>

              <div className="my-6 h-px bg-[var(--line)]" />

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm font-semibold leading-6 text-[var(--muted-strong)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-7">
                <ActionButton
                  type="button"
                  onClick={handlePaymentClick}
                  tone={plan.highlighted ? "primary" : "secondary"}
                  className="w-full"
                >
                  {plan.highlighted ? <Crown className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  {plan.button}
                </ActionButton>
                <p className="mt-3 text-center text-xs font-semibold text-[var(--muted)]">
                  Pagamento em desenvolvimento
                </p>
              </div>
            </div>
          </Surface>
        ))}
      </section>
    </PageFrame>
  );
}
