import Image from "next/image";
import Link from "next/link";

const benefits = [
  "Registro por linguagem natural no WhatsApp",
  "Dashboard com gastos, receitas e recorrências",
  "Orçamentos, metas e parcelamentos no mesmo lugar",
];

const metrics = [
  { label: "Organização", value: "24/7" },
  { label: "Entrada", value: "WhatsApp" },
  { label: "Foco", value: "IA" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--bg)]">
      <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
        <Image src="/moedinha.png" alt="Moedin.IA" width={170} height={44} className="h-10 w-auto" priority />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-2xl px-4 py-2 text-sm font-extrabold text-[var(--navy)] hover:bg-white">
            Entrar
          </Link>
          <Link href="/cadastro" className="btn-primary px-4 py-2 text-sm">
            Criar conta
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-[1400px] gap-8 px-5 pb-10 pt-4 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:pb-16">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-full border border-[rgba(46,158,79,0.22)] bg-white/84 px-4 py-2 font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)] shadow-[var(--shadow-soft)]">
            Finanças pessoais com IA
          </p>
          <h1 className="font-display text-5xl font-black leading-[1.02] text-[var(--navy)] sm:text-6xl lg:text-7xl">
            Moedin.IA
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Uma plataforma SaaS financeira para registrar gastos pelo WhatsApp, organizar seu mês e transformar lançamentos soltos em decisões claras.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro" className="btn-primary inline-flex items-center justify-center px-6 py-4 text-sm">
              Começar agora
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-6 py-4 text-sm font-extrabold text-[var(--navy)] shadow-[var(--shadow-soft)]">
              Acessar minha conta
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {metrics.map((item) => (
              <div key={item.label} className="rounded-[20px] border border-white bg-white/82 p-4 shadow-[var(--shadow-soft)]">
                <p className="text-2xl font-black text-[var(--navy)]">{item.value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white bg-white/76 p-3 shadow-[var(--shadow-strong)]">
          <div className="relative overflow-hidden rounded-[26px] bg-[#1A1A1A] p-5 text-white sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-white/86">Dashboard</p>
                <h2 className="mt-1 font-display text-2xl font-black">Seu mês financeiro</h2>
              </div>
              <Image src="/moedinhagrande.png" alt="IA" width={42} height={42} className="h-11 w-11 rounded-full bg-white/90 p-1" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.08] p-4">
                <p className="text-xs font-semibold text-white/84">Saldo do mês</p>
                <p className="mt-2 font-display text-3xl font-black">R$ 3.840</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.08] p-4">
                <p className="text-xs font-semibold text-white/84">Orçamento usado</p>
                <p className="mt-2 font-display text-3xl font-black">61%</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] bg-white p-4 text-[var(--navy)]">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-black">Últimos lançamentos</p>
                <span className="text-xs font-bold text-[var(--brand-strong)]">WhatsApp</span>
              </div>
              {["Mercado por voz", "Uber para reunião", "Receita extra"].map((item, index) => (
                <div key={item} className="flex items-center justify-between border-t border-[var(--line)] py-3 first:border-t-0">
                  <span className="font-bold">{item}</span>
                  <span className={index === 2 ? "font-black text-[var(--success)]" : "font-black text-[var(--danger)]"}>
                    {index === 2 ? "+R$ 480" : "-R$ 82"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1400px] gap-4 px-5 pb-12 sm:px-8 md:grid-cols-3">
        {benefits.map((item) => (
          <div key={item} className="rounded-[24px] border border-[var(--line)] bg-white/82 p-5 shadow-[var(--shadow-soft)]">
            <p className="text-lg font-black text-[var(--navy)]">{item}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Desenhado para reduzir fricção e manter o controle financeiro fácil de consultar.
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
