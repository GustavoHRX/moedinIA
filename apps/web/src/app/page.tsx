import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  PieChart,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import ThemedLogo from "@/components/themed-logo";

const benefits = [
  {
    title: "Registro por linguagem natural no WhatsApp",
    description: "Anote gastos e receitas com frases simples, sem depender de planilhas ou formulários longos.",
    icon: MessageCircle,
  },
  {
    title: "Dashboard com gastos, receitas e recorrências",
    description: "Veja o mês financeiro com saldo, entradas, saídas, gastos fixos e últimos lançamentos.",
    icon: PieChart,
  },
  {
    title: "Orçamentos, metas e parcelamentos no mesmo lugar",
    description: "Organize limites, acompanhe objetivos e visualize compras parceladas com clareza.",
    icon: Target,
  },
];

const steps = [
  {
    title: "Registre em segundos",
    description: "Use o painel ou envie uma mensagem no WhatsApp com o lançamento em linguagem natural.",
  },
  {
    title: "A IA organiza",
    description: "O Moedin.IA ajuda a classificar, estruturar e manter o histórico financeiro consistente.",
  },
  {
    title: "Acompanhe tudo",
    description: "Dashboard, orçamento, metas, gastos fixos e parcelamentos ficam conectados em uma só visão.",
  },
];

const featureCards = [
  { label: "Orçamento mensal", value: "61%", icon: WalletCards },
  { label: "Gastos fixos", value: "12", icon: Repeat2 },
  { label: "Parcelamentos", value: "4", icon: CreditCard },
  { label: "Metas ativas", value: "3", icon: CalendarCheck },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center">
            <ThemedLogo className="h-16 w-[188px]" priority />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary px-4 py-2 text-sm">
              Entrar
            </Link>
            <Link href="/cadastro" className="btn-primary px-4 py-2 text-sm">
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto grid w-full max-w-[1440px] gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:pb-24 lg:pt-16">
        <div className="premium-grid pointer-events-none absolute inset-x-0 top-0 h-[560px]" />
        <div className="relative">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(46,158,79,0.22)] bg-[var(--surface)] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)] shadow-[var(--shadow-soft)]">
            <Sparkles className="h-4 w-4" />
            Finanças + IA + WhatsApp
          </div>
          <h1 className="max-w-4xl font-display text-5xl font-black leading-[1.02] text-[var(--navy)] sm:text-6xl lg:text-7xl">
            Seu painel financeiro continua daqui.
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[var(--muted)]">
            Uma plataforma para registrar gastos, acompanhar orçamento, metas, gastos fixos e parcelamentos com a ajuda da IA e a praticidade do WhatsApp.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-4 text-sm">
              Começar agora
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </Link>
            <Link href="/login" className="btn-secondary inline-flex items-center justify-center px-6 py-4 text-sm">
              Acessar minha conta
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Histórico limpo", "Categorias inteligentes", "Alertas de rotina"].map((item) => (
              <div key={item} className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
                <CheckCircle2 className="h-5 w-5 text-[var(--brand)]" />
                <p className="mt-3 text-sm font-extrabold text-[var(--navy)]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[var(--brand-glow)] blur-3xl" />
          <div className="relative rounded-[34px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-strong)] backdrop-blur-xl">
            <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
                <div>
                  <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">
                    Preview do dashboard
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">Resumo financeiro</h2>
                </div>
                <ThemedLogo variant="symbol" className="h-12 w-12 rounded-full bg-[var(--surface)] p-1 ring-1 ring-[var(--line)]" />
              </div>

              <div className="mt-6 rounded-[26px] border border-[var(--line)] bg-[var(--hero-gradient)] p-5">
                <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Saldo do mês</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <p className="font-display text-4xl font-black text-[var(--navy)]">R$ 3.840,00</p>
                  <span className="w-fit rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-strong)]">
                    +R$ 480 em receitas
                  </span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div className="h-full w-[61%] rounded-full bg-[var(--brand)]" />
                </div>
                <div className="mt-3 flex justify-between text-xs font-bold text-[var(--muted)]">
                  <span>Orçamento usado</span>
                  <span>61%</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {featureCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">{item.label}</p>
                          <p className="mt-2 font-display text-3xl font-black text-[var(--navy)]">{item.value}</p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                          <Icon className="h-5 w-5" strokeWidth={2.4} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-black text-[var(--navy)]">Últimos lançamentos</p>
                  <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-bold text-[var(--brand-strong)]">WhatsApp</span>
                </div>
                {["Mercado por voz", "Streaming recorrente", "Receita extra"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between border-t border-[var(--line)] py-3 first:border-t-0">
                    <span className="font-bold text-[var(--text)]">{item}</span>
                    <span className={index === 2 ? "font-black text-[var(--success)]" : "font-black text-[var(--danger)]"}>
                      {index === 2 ? "+R$ 480" : index === 1 ? "-R$ 29" : "-R$ 82"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1440px] gap-4 px-5 py-12 sm:px-8 md:grid-cols-3">
        {benefits.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-[26px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                <Icon className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <h3 className="mt-5 font-display text-xl font-black text-[var(--navy)]">{item.title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{item.description}</p>
            </div>
          );
        })}
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Como funciona</p>
          <h2 className="mt-2 font-display text-3xl font-black text-[var(--navy)] sm:text-4xl">
            Do lançamento rápido ao controle real.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-[26px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand)] font-display text-sm font-black text-white">
                {index + 1}
              </span>
              <h3 className="mt-5 font-display text-xl font-black text-[var(--navy)]">{step.title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8">
        <div className="overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--hero-gradient)] p-8 shadow-[var(--shadow-strong)] sm:p-10">
          <ShieldCheck className="h-10 w-10 text-[var(--brand)]" />
          <h2 className="mt-5 max-w-3xl font-display text-3xl font-black text-[var(--navy)] sm:text-4xl">
            Comece hoje com uma visão financeira mais clara.
          </h2>
          <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
            Crie sua conta e acompanhe suas finanças com uma experiência moderna, simples e conectada à sua rotina.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-4 text-sm">
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-secondary inline-flex items-center justify-center px-6 py-4 text-sm">
              Entrar
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 border-t border-[var(--line)] px-5 py-8 text-sm font-medium text-[var(--muted)] sm:px-8 md:flex-row md:items-center md:justify-between">
        <ThemedLogo className="h-[58px] w-[170px]" />
        <p className="max-w-md md:text-right">Finanças pessoais com IA, WhatsApp e clareza.</p>
      </footer>
    </main>
  );
}
