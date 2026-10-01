import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Check,
  KeyRound,
  Landmark,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import ThemedLogo from "@/components/themed-logo";
import LandingMotion from "@/components/landing-motion";
import LandingSkeleton from "@/components/landing-skeleton";
import HeroDemo from "@/components/landing/hero-demo";
import PersonaTabs from "@/components/landing/persona-tabs";
import { categoryVisual } from "@/lib/categories";
import { getRegisteredEntriesCount } from "@/lib/landing-stats";

/*
 * Landing de venda — plano único (decidido em 30/09/2026).
 * Leitura de design: landing de assinatura B2C para brasileiros sem planilha,
 * tom acolhedor e direto, dark-first esverdeado do brand book (Poppins/Inter/
 * JetBrains Mono, verde #10B981 como único acento). Dials: variância 7,
 * motion 6, densidade 4. Motion via GSAP em <LandingMotion/>; a demo do hero
 * é o único loop. Regras de honestidade: nada de depoimento, nota ou número
 * inventado — o único número de "prova" vem do banco (getRegisteredEntriesCount).
 */

// O contador real é recalculado no máximo 1x por hora (ISR).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Moedin-IA | Controle de gastos pelo WhatsApp com IA" },
  description:
    "Mande seus gastos por texto, áudio ou foto no WhatsApp e veja seu mês num painel claro. Plano único: R$ 29,90 a cada 3 meses, com 7 dias de garantia.",
  alternates: { canonical: "/" },
};

const PRICE = "29,90";
const CTA_LABEL = "Quero organizar meu mês";

const PIX_CHIPS = [
  { label: "Pix padaria", value: 12 },
  { label: "iFood", value: 32.9 },
  { label: "Uber", value: 18.9 },
  { label: "Café", value: 7.5 },
  { label: "App de música", value: 19.9 },
  { label: "Farmácia", value: 23.4 },
  { label: "Lanche", value: 15 },
  { label: "Estacionamento", value: 10 },
  { label: "Pix amigo", value: 25 },
  { label: "Sorvete", value: 9 },
  { label: "Recarga", value: 14.9 },
  { label: "Chiclete", value: 6.5 },
];
const PIX_TOTAL = PIX_CHIPS.reduce((sum, chip) => sum + chip.value, 0);

const STEPS = [
  {
    title: "Manda do seu jeito",
    body: "Texto, áudio ou foto do comprovante, no WhatsApp que você já usa. Escreve como fala, sem formato certo.",
  },
  {
    title: "A IA entende",
    body: "Ela acha o valor, a categoria e a data. Errou alguma coisa? É só corrigir ali mesmo, pelo chat.",
  },
  {
    title: "Aparece no painel",
    body: "Na hora, no painel: saldo do mês, categoria e limite atualizados. Sem você abrir nada.",
  },
];

const PLAN_ITEMS = [
  "Registro pelo WhatsApp: texto, áudio e foto",
  "IA que entende, categoriza e lança por você",
  "Painel completo: resumo, histórico e planejamento",
  "Limite por categoria com aviso na hora do lançamento",
  "Metas, gastos fixos e parcelamentos",
  "Pergunte pelo chat quanto gastou e quanto sobra",
];

const SAFETY = [
  { icon: KeyRound, title: "Não pedimos senha de banco", body: "O Moedin-IA não se conecta ao seu banco. Ele só sabe o que você manda." },
  { icon: Ban, title: "Não mexemos no seu dinheiro", body: "Nada de Pix, pagamento ou investimento. A gente organiza, só isso." },
  { icon: Trash2, title: "Seus dados são seus", body: "Você pode apagar a conta e os dados quando quiser, pelo perfil." },
  { icon: UserRoundCheck, title: "A IA ajuda, a decisão é sua", body: "Ela organiza e mostra os números. Quem decide o que fazer é você." },
];

const FAQ = [
  {
    q: "Preciso instalar algum aplicativo?",
    a: "Não. O registro é pelo WhatsApp que você já tem, e o painel abre no navegador, no celular ou no computador.",
  },
  {
    q: "Vocês acessam a minha conta do banco?",
    a: "Não. O Moedin-IA não pede senha de banco e não se conecta a banco nenhum. Ele só registra o que você manda pra ele.",
  },
  {
    q: "Ele entende áudio e foto mesmo?",
    a: "Sim. O áudio vira texto e a foto do comprovante é lida para achar valor e data. Se algo sair errado, você corrige pelo chat ou pelo painel.",
  },
  {
    q: "Como funciona a garantia de 7 dias?",
    a: "Você tem 7 dias a partir da assinatura. Se não gostar, é só pedir pelo e-mail de contato e devolvemos o valor inteiro, sem pergunta.",
  },
  {
    q: "Por que o plano é a cada 3 meses?",
    a: "Porque hábito leva umas semanas pra pegar. Três meses é o tempo de ver o primeiro mês, ajustar no segundo e sentir a diferença no terceiro.",
  },
  {
    q: "É consultoria financeira?",
    a: "Não. O Moedin-IA organiza e mostra os seus números de um jeito claro. As decisões continuam sendo suas.",
  },
  {
    q: "E se eu quiser parar?",
    a: "Sem fidelidade. Você para quando quiser e pode apagar a conta e todos os seus dados pelo perfil.",
  },
];

const BENTO_CATEGORIES = ["Mercado", "Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Contas", "Salário"];
const BENTO_BARS = [46, 72, 58, 88, 64, 40];

function CtaButton({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <Link
      href="/cadastro"
      data-cta
      className={`btn-primary press inline-flex items-center justify-center gap-2 whitespace-nowrap ${
        size === "lg" ? "px-7 py-4 text-base" : "px-6 py-3.5 text-sm"
      } ${className}`}
    >
      {CTA_LABEL}
      <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
    </Link>
  );
}

export default async function LandingPage() {
  const entriesCount = await getRegisteredEntriesCount();
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contato@moedin.ia";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Moedin-IA",
    description: "Assistente de controle financeiro pessoal pelo WhatsApp, com painel web.",
    offers: { "@type": "Offer", price: "29.90", priceCurrency: "BRL" },
  };

  return (
    <main className="min-h-screen overflow-x-clip text-[var(--text)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingSkeleton />
      <LandingMotion />

      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="inline-flex min-w-0 items-center" aria-label="Moedin-IA">
            <ThemedLogo className="h-12 w-[142px] sm:h-14 sm:w-[168px]" priority />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--muted)] lg:flex">
            <a href="#como-funciona" className="transition-colors hover:text-[var(--brand-strong)]">Como funciona</a>
            <a href="#painel" className="transition-colors hover:text-[var(--brand-strong)]">Painel</a>
            <a href="#preco" className="transition-colors hover:text-[var(--brand-strong)]">Preço</a>
            <a href="#duvidas" className="transition-colors hover:text-[var(--brand-strong)]">Dúvidas</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="btn-secondary press inline-flex items-center px-4 py-2 text-sm">
              Entrar
            </Link>
            <Link href="/cadastro" data-cta className="btn-primary press hidden px-4 py-2 text-sm md:inline-flex">
              {CTA_LABEL}
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section data-hero className="relative border-b border-[var(--line)]">
        <div className="premium-grid pointer-events-none absolute inset-x-0 top-0 h-[640px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-[var(--bg)]" />

        <div className="relative mx-auto grid w-full max-w-[1180px] gap-10 px-5 pb-16 pt-10 sm:px-8 lg:min-h-[690px] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-20 lg:pt-12">
          <div className="min-w-0">
            <p data-hero-eyebrow className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-strong)]">
              Seu dinheiro, sem mistério.
            </p>
            <h1
              data-hero-title
              className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.06] text-[var(--navy)] sm:text-5xl lg:text-6xl"
              style={{ textWrap: "balance" }}
            >
              Mandou no WhatsApp,{" "}
              <span className="relative inline-block text-[var(--primary)]">
                tá anotado.
                <Sparkles className="absolute -right-6 -top-3 h-5 w-5 text-[var(--mint)] motion-reduce:hidden" strokeWidth={2.4} />
              </span>
            </h1>
            <p data-hero-sub className="mt-6 max-w-xl text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
              Texto, áudio ou foto do recibo. A IA organiza tudo e o seu mês aparece num painel claro.
            </p>

            <div data-hero-cta className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaButton />
              <a href="#como-funciona" className="btn-secondary press inline-flex items-center justify-center whitespace-nowrap px-6 py-3.5 text-sm">
                Ver funcionando
              </a>
            </div>
          </div>

          <HeroDemo />
        </div>
      </section>

      {/* ---------- Faixa de prova (só fatos verificáveis) ---------- */}
      <section data-reveal className="mx-auto w-full max-w-[1180px] px-5 pb-6 pt-16 sm:px-8 lg:pt-20">
        <div className="grid gap-6 border-y border-[var(--line)] py-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-[var(--line)]">
          {entriesCount ? (
            <div data-reveal-item className="lg:pr-6">
              <p className="money text-3xl font-semibold text-[var(--navy)]">
                <span data-count-to={entriesCount}>{entriesCount.toLocaleString("pt-BR")}</span>
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">lançamentos já registrados no Moedin-IA</p>
            </div>
          ) : null}
          {[
            { icon: Smartphone, title: "Sem instalar app", body: "Funciona no WhatsApp que você já usa" },
            { icon: Landmark, title: "Sem senha de banco", body: "A gente nunca pede, nem conecta" },
            { icon: Check, title: "7 dias de garantia", body: "Não curtiu, devolvemos tudo" },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} data-reveal-item className="flex items-start gap-3 lg:px-6 lg:last:pr-0">
              <Icon className="mt-1 h-5 w-5 shrink-0 text-[var(--brand)]" strokeWidth={2.2} />
              <div>
                <p className="font-display text-base font-semibold text-[var(--navy)]">{title}</p>
                <p className="mt-0.5 text-sm font-medium text-[var(--muted)]">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Problema: os gastos pequenos somem ---------- */}
      <section data-pix className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl" style={{ textWrap: "balance" }}>
            Não é o gasto grande que bagunça o mês.
          </h2>
          <p className="mt-5 max-w-[48ch] text-base font-medium leading-7 text-[var(--muted)]">
            São os R$ 12 do Pix, os R$ 30 do lanche. Sozinhos não parecem nada. Juntos, viram o que falta no fim do mês.
          </p>
          <p className="mt-4 max-w-[48ch] text-base font-semibold leading-7 text-[var(--navy)]">
            No Moedin-IA, cada um vira registro em segundos. E para de sumir.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex flex-wrap gap-2">
            {PIX_CHIPS.map((chip) => (
              <span
                key={chip.label}
                data-pix-chip
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-sm font-medium text-[var(--muted)]"
              >
                {chip.label}
                <span className="money font-semibold text-[var(--danger)]">
                  R$ {chip.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--line)] pt-5">
            <p className="text-sm font-medium text-[var(--muted)]">Só de gastinho, em 10 dias</p>
            <p className="money text-4xl font-semibold text-[var(--navy)]">
              R$ <span data-count-to={PIX_TOTAL} data-count-format="brl">{PIX_TOTAL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
          <p className="mt-3 text-xs font-medium text-[var(--muted)]">Valores de exemplo.</p>
        </div>
      </section>

      {/* ---------- Como funciona: celular fixo + passos ---------- */}
      <section id="como-funciona" className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8">
          <h2 data-reveal className="max-w-2xl font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl">
            Três passos. Nenhum deles é abrir planilha.
          </h2>

          <div data-hiw data-active="0" className="mt-12 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            {/* Celular fixo (só desktop): a tela troca conforme o passo ativo */}
            <div className="hidden lg:block">
              <div className="sticky top-[calc(50vh-200px)]">
                <div className="mx-auto w-[330px] rounded-[34px] border border-[var(--line)] bg-[#111c17] p-3 shadow-[var(--shadow-strong)]">
                  <div className="relative h-[420px] overflow-hidden rounded-[26px] bg-[#f5f1e8]">
                    <StepScreen index={0} />
                    <StepScreen index={1} />
                    <StepScreen index={2} />
                  </div>
                </div>
              </div>
            </div>

            <ol className="grid gap-6 lg:gap-0">
              {STEPS.map((step, index) => (
                <li key={step.title} data-hiw-step={index} className="hiw-step lg:flex lg:min-h-[62vh] lg:items-center">
                  <div>
                    <span className="money inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-strong)] text-sm font-semibold text-[var(--brand-strong)]">
                      {index + 1}
                    </span>
                    <h3 className="mt-5 font-display text-2xl font-bold text-[var(--navy)] sm:text-3xl">{step.title}</h3>
                    <p className="mt-3 max-w-[44ch] text-base font-medium leading-7 text-[var(--muted)]">{step.body}</p>
                    <div className="mt-6 overflow-hidden rounded-[22px] bg-[#f5f1e8] lg:hidden">
                      <div className="relative h-[300px]">
                        <StepScreen index={index} inline />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- Painel (bento) ---------- */}
      <section id="painel" className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8">
        <div data-reveal className="max-w-2xl">
          <h2 data-reveal-item className="font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl">
            Você conversa. O painel se arruma sozinho.
          </h2>
          <p data-reveal-item className="mt-4 text-base font-medium leading-7 text-[var(--muted)]">
            Tudo que você manda no WhatsApp cai no painel na hora, já separado e somado.
          </p>
        </div>

        <div data-reveal className="mt-10 grid gap-4 lg:grid-cols-6 lg:grid-rows-[auto_auto_auto]">
          {/* Resumo + gráfico */}
          <div data-reveal-item className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-4 lg:row-span-2">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgb(16_185_129/0.14),transparent_55%)]" />
            <div className="relative">
              <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Resumo do mês</h3>
              <div className="mt-5 grid grid-cols-2 gap-6 sm:max-w-md">
                <div>
                  <p className="text-sm font-medium text-[var(--muted)]">Entrou</p>
                  <p className="money mt-1 text-2xl font-semibold text-[var(--success)]">R$ 4.320,00</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--muted)]">Saiu</p>
                  <p className="money mt-1 text-2xl font-semibold text-[var(--danger)]">R$ 2.876,40</p>
                </div>
              </div>
              <div className="mt-8 flex h-44 items-end gap-3 sm:gap-5" aria-hidden="true">
                {BENTO_BARS.map((height, index) => (
                  <div key={index} className="flex h-full flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div
                        data-bar
                        className={`w-full max-w-[32px] origin-bottom rounded-t-md ${index === 3 ? "bg-[var(--primary)]" : "bg-[var(--line-strong)]"}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[var(--muted)]">S{index + 1}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--muted)]">Gastos por semana. A mais alta fica em destaque.</p>
            </div>
          </div>

          {/* Limite com aviso */}
          <div data-reveal-item className="rounded-2xl border border-[rgb(16_185_129/0.35)] bg-[var(--brand-soft)] p-6 lg:col-span-2">
            <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Limite com aviso na hora</h3>
            <div className="mt-4 rounded-xl rounded-tl-sm bg-white px-4 py-3 text-sm font-bold leading-6 text-[#26342d]">
              ⚠️ Lazer: você usou 86% do limite do mês.
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgb(0_0_0/0.15)]">
              <div data-progress className="h-full w-[86%] origin-left rounded-full bg-[var(--warning)]" />
            </div>
          </div>

          {/* Fixos e parcelas */}
          <div data-reveal-item className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-2">
            <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Fixos e parcelas</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["Aluguel", "todo dia 5", "R$ 1.150,00"],
                ["Geladeira", "parcela 4 de 10", "R$ 289,90"],
                ["Internet", "todo dia 12", "R$ 99,90"],
              ].map(([label, when, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--navy)]">{label}</p>
                    <p className="text-xs font-medium text-[var(--muted)]">{when}</p>
                  </div>
                  <p className="money font-semibold text-[var(--navy)]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Categorias */}
          <div data-reveal-item className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-3">
            <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Cada gasto com a sua cor</h3>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">A IA escolhe a categoria. Você pode criar as suas.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {BENTO_CATEGORIES.map((name) => {
                const { Icon, color } = categoryVisual(name);
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold"
                    style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                    {name}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Meta */}
          <div data-reveal-item className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 lg:col-span-3">
            <h3 className="font-display text-lg font-semibold text-[var(--navy)]">Metas que andam</h3>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">Reserva de emergência</p>
            <p className="money mt-4 text-2xl font-semibold text-[var(--navy)]">
              R$ 1.240,00 <span className="text-base text-[var(--muted)]">de R$ 3.000,00</span>
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div data-progress className="h-full w-[41%] origin-left rounded-full bg-[var(--primary)]" />
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-[var(--muted)]">Telas com valores de exemplo.</p>
      </section>

      {/* ---------- Para quem é ---------- */}
      <section className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
        <div data-reveal className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8">
          <h2 data-reveal-item className="max-w-2xl font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl">
            Feito pra quem nunca aguentou planilha.
          </h2>
          <div data-reveal-item className="mt-8">
            <PersonaTabs />
          </div>
        </div>
      </section>

      {/* ---------- Preço (plano único) ---------- */}
      <section id="preco" className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgb(16_185_129/0.10),transparent_45%)]" />
        <div className="relative mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div data-reveal>
            <p data-reveal-item className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-strong)]">Plano único</p>
            <h2 data-reveal-item className="mt-4 font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-5xl" style={{ textWrap: "balance" }}>
              Um plano. Tudo dentro.
            </h2>
            <p data-reveal-item className="mt-5 max-w-[46ch] text-base font-medium leading-7 text-[var(--muted)]">
              Sem versão capada, sem letra miúda. Você paga a cada 3 meses e usa tudo: WhatsApp, IA e o painel inteiro.
            </p>
          </div>

          <div data-price-card className="relative rounded-3xl border border-[rgb(16_185_129/0.42)] bg-[var(--surface)] p-7 shadow-[var(--shadow-strong)] sm:p-9">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-[var(--muted)]">R$</span>
                <span className="money text-6xl font-semibold leading-none text-[var(--navy)]">
                  {PRICE}
                </span>
              </p>
              <p className="pb-1 text-base font-semibold text-[var(--muted)]">a cada 3 meses</p>
            </div>
            <p className="mt-3 text-sm font-medium text-[var(--muted)]">
              Dá uns <span className="money font-semibold text-[var(--brand-strong)]">R$ 9,97</span> por mês. Menos de 34 centavos por dia.
            </p>

            <ul data-reveal className="mt-7 grid gap-3 border-t border-[var(--line)] pt-7 sm:grid-cols-2">
              {PLAN_ITEMS.map((item) => (
                <li key={item} data-reveal-item className="flex gap-3 text-sm font-semibold leading-6 text-[var(--navy)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" strokeWidth={2.6} />
                  {item}
                </li>
              ))}
            </ul>

            <CtaButton size="lg" className="mt-8 w-full" />

            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--brand-soft)] p-4">
              <span data-coin className="block h-10 w-10 shrink-0">
                <ThemedLogo variant="symbol" className="h-full w-full" />
              </span>
              <div>
                <p className="font-display text-base font-semibold text-[var(--navy)]">Garantia de 7 dias</p>
                <p className="mt-0.5 text-sm font-medium leading-6 text-[var(--muted)]">
                  Não gostou? Pede pelo e-mail e devolvemos o valor inteiro, sem pergunta.
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs font-medium leading-5 text-[var(--muted)]">
              O pagamento online ainda está sendo liberado. Crie sua conta agora e já comece a usar.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Segurança ---------- */}
      <section className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8">
          <h2 data-reveal className="max-w-2xl font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl">
            Não somos banco. E nem queremos ser.
          </h2>
          <div data-reveal className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {SAFETY.map(({ icon: Icon, title, body }) => (
              <div key={title} data-reveal-item className="flex gap-4">
                <Icon className="mt-1 h-6 w-6 shrink-0 text-[var(--brand)]" strokeWidth={2} />
                <div>
                  <h3 className="font-display text-lg font-semibold text-[var(--navy)]">{title}</h3>
                  <p className="mt-1 max-w-[46ch] text-base font-medium leading-7 text-[var(--muted)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Dúvidas ---------- */}
      <section id="duvidas" className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl">Dúvidas comuns</h2>
          <p className="mt-4 text-base font-medium leading-7 text-[var(--muted)]">
            Não achou a sua? Escreve pra{" "}
            <a href={`mailto:${contactEmail}`} className="font-semibold text-[var(--brand-strong)] underline-offset-4 hover:underline">
              {contactEmail}
            </a>
            .
          </p>
        </div>
        <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {FAQ.map((item) => (
            <details key={item.q} className="faq group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-base font-semibold text-[var(--navy)] sm:text-lg">
                {item.q}
                <Plus className="faq-icon h-5 w-5 shrink-0 text-[var(--brand)]" strokeWidth={2.4} />
              </summary>
              <p className="faq-body max-w-[62ch] pb-5 text-base font-medium leading-7 text-[var(--muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- CTA final ---------- */}
      <section data-final-cta className="mx-auto w-full max-w-[1180px] px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-[rgb(16_185_129/0.35)] bg-[var(--surface)] px-7 py-14 sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgb(16_185_129/0.18),transparent_50%),radial-gradient(circle_at_100%_100%,rgb(20_184_166/0.12),transparent_45%)]" />
          <div data-reveal className="relative max-w-2xl">
            <h2 data-reveal-item className="font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-5xl" style={{ textWrap: "balance" }}>
              Seu próximo gasto já pode ir pro lugar certo.
            </h2>
            <p data-reveal-item className="mt-5 text-base font-medium leading-7 text-[var(--muted)] sm:text-lg">
              R$ {PRICE} a cada 3 meses, com 7 dias de garantia.
            </p>
            <div data-reveal-item className="mt-8">
              <CtaButton size="lg" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Rodapé ---------- */}
      <footer className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 border-t border-[var(--line)] px-5 pb-28 pt-8 text-sm font-medium text-[var(--muted)] sm:px-8 md:flex-row md:items-start md:justify-between lg:pb-8">
        <div className="space-y-2">
          <ThemedLogo className="h-[54px] w-[160px]" />
          <p className="max-w-md">Controle financeiro com IA, WhatsApp e clareza.</p>
        </div>
        <div className="space-y-1 text-xs md:text-right">
          <p>
            <Link href="/termos" className="font-semibold hover:text-[var(--brand-strong)]">
              Termos de Uso e Privacidade
            </Link>
          </p>
          <p>
            Dados e privacidade:{" "}
            <a href={`mailto:${contactEmail}`} className="font-semibold hover:text-[var(--brand-strong)]">
              {contactEmail}
            </a>
          </p>
          <p>© {new Date().getFullYear()} Moedin-IA</p>
        </div>
      </footer>

      {/* ---------- CTA fixo no celular (aparece depois do hero, some no preço) ---------- */}
      <div data-sticky-cta className="sticky-cta fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3">
          <p className="text-sm font-semibold leading-5 text-[var(--navy)]">
            <span className="money">R$ {PRICE}</span>
            <span className="block text-xs font-medium text-[var(--muted)]">a cada 3 meses</span>
          </p>
          <Link href="/cadastro" data-cta className="btn-primary press inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm">
            {CTA_LABEL}
          </Link>
        </div>
      </div>
    </main>
  );
}

/* Telas do celular do "Como funciona". Mesmo conteúdo no desktop (empilhadas,
   troca por data-active) e no mobile (uma por passo, `inline`). */
function StepScreen({ index, inline = false }: { index: number; inline?: boolean }) {
  const base = inline ? "absolute inset-0 p-4" : "hiw-screen absolute inset-0 p-4";
  const userBubble = "ml-auto w-fit max-w-[88%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-4 py-2.5 text-sm font-bold text-[#1a1a1a] shadow-sm";
  const botBubble = "w-fit max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm font-bold leading-6 text-[#26342d] shadow-sm";

  if (index === 0) {
    return (
      <div data-screen="0" className={base}>
        <div className="flex flex-col gap-3 pt-2">
          <div className={userBubble}>gastei 32 no ifood</div>
          <div className={userBubble}>
            <span className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[#0d6b45]" />
              <span className="flex h-5 items-center gap-[3px]" aria-hidden="true">
                {[7, 12, 18, 10, 15, 20, 9, 13].map((h, i) => (
                  <span key={i} className="w-[3px] rounded-full bg-[#0d6b45]/70" style={{ height: h }} />
                ))}
              </span>
              <span className="text-xs text-[#4b5a52]">0:03</span>
            </span>
          </div>
          <div className={`${userBubble} flex items-center gap-2`}>
            <span className="flex h-12 w-16 items-center justify-center rounded-lg bg-[#c9e9b4] text-[10px] font-bold uppercase text-[#2f5a3f]">Recibo</span>
            <span className="text-xs text-[#4b5a52]">foto</span>
          </div>
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div data-screen="1" className={base}>
        <div className="flex flex-col gap-3 pt-2">
          <div className={userBubble}>gastei 32 no ifood</div>
          <div className={botBubble}>
            Anotado.
            <span className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-semibold text-[#4b5a52]">
              <span>Valor</span>
              <span className="font-mono text-[#1a1a1a]">R$ 32,00</span>
              <span>Categoria</span>
              <span className="text-[#1a1a1a]">Alimentação</span>
              <span>Data</span>
              <span className="text-[#1a1a1a]">hoje</span>
            </span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div data-screen="2" className={`${base} !bg-[#0c1210]`}>
      <div className="rounded-2xl border border-[#24322b] bg-[#161f1a] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#34d399]">Este mês</p>
        <p className="mt-1 font-mono text-xl font-semibold text-[#f2f6f4]">R$ 1.208,40</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#121a16]">
          <div className="h-full w-[58%] rounded-full bg-[#10b981]" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {[
          ["Alimentação", "agora", "-R$ 32,00", true],
          ["Transporte", "ontem", "-R$ 18,90", false],
          ["Mercado", "ontem", "-R$ 82,00", false],
        ].map(([label, when, value, fresh]) => (
          <div
            key={label as string}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${fresh ? "border-[#10b981]/50 bg-[#0f2e22]" : "border-[#24322b] bg-[#161f1a]"}`}
          >
            <div>
              <p className="text-sm font-semibold text-[#f2f6f4]">{label as string}</p>
              <p className="text-xs text-[#9fb0a8]">{when as string}</p>
            </div>
            <p className="font-mono text-sm font-semibold text-[#f87171]">{value as string}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
