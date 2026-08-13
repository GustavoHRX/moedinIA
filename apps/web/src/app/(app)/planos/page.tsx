"use client";

import { CheckCircle2, CreditCard, Crown } from "lucide-react";
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
        description="Escolha o plano ideal e deixe o Moedin cuidar do resto."
      />

      <section className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <Surface
            key={plan.name}
            className={
              plan.highlighted
                ? "anim-pop-in relative overflow-hidden border-[rgba(16,185,129,0.42)] bg-[linear-gradient(145deg,var(--surface-strong),var(--brand-soft))] p-6 shadow-[var(--shadow-glow)] ring-1 ring-[rgba(16,185,129,0.22)] lg:-translate-y-3"
                : "anim-pop-in p-6"
            }
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="flex min-h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Plano
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-[var(--navy)]">{plan.name}</h2>
                </div>
                {plan.badge ? (
                  <Badge tone={plan.highlighted ? "brand" : "neutral"}>{plan.badge}</Badge>
                ) : null}
              </div>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="money text-4xl text-[var(--navy)]">{plan.price}</span>
                <span className="text-sm font-semibold text-[var(--muted)]">{plan.period}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--text-soft)]">{plan.note}</p>

              <div className="mt-5 mb-6 h-px bg-[var(--line)]" />

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
