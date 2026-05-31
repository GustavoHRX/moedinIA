import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  CreditCard,
  History,
  LockKeyhole,
  MessageCircle,
  Mic,
  PieChart,
  Repeat2,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import ThemedLogo from "@/components/themed-logo";

const trustItems = ["Texto", "Áudio", "Imagem", "Painel"];

const quickBenefits = [
  {
    title: "Registre pelo WhatsApp",
    description: "Anote gastos do jeito que você fala, sem abrir planilha.",
    icon: MessageCircle,
  },
  {
    title: "IA para organizar",
    description: "O Moedin.IA interpreta, classifica e prepara o lançamento.",
    icon: Bot,
  },
  {
    title: "Alertas de rotina",
    description: "Acompanhe limites, gastos fixos e compras parceladas.",
    icon: Bell,
  },
  {
    title: "Dados protegidos",
    description: "Login, sessão e regras de acesso pensadas para privacidade.",
    icon: ShieldCheck,
  },
];

const flow = [
  {
    title: "Mande uma mensagem",
    description: "Exemplo: gastei 82 reais no mercado hoje.",
    icon: Send,
  },
  {
    title: "A IA entende",
    description: "O sistema identifica valor, tipo, categoria e data.",
    icon: Sparkles,
  },
  {
    title: "Você acompanha",
    description: "Tudo aparece no painel, histórico, metas e planejamento.",
    icon: BarChart3,
  },
];

const features = [
  {
    title: "Dashboard do mês",
    description: "Saldo, receitas, despesas e últimos lançamentos em uma visão simples.",
    icon: PieChart,
  },
  {
    title: "Metas e orçamentos",
    description: "Defina limites e acompanhe objetivos sem perder o controle.",
    icon: Target,
  },
  {
    title: "Gastos fixos",
    description: "Organize contas recorrentes e entenda o peso delas no mês.",
    icon: Repeat2,
  },
  {
    title: "Parcelamentos",
    description: "Veja compras parceladas e valores que ainda vão vencer.",
    icon: CreditCard,
  },
  {
    title: "Histórico limpo",
    description: "Consulte suas movimentações por período, tipo e categoria.",
    icon: History,
  },
  {
    title: "Planejamento mensal",
    description: "Tenha uma rotina financeira mais clara para decidir melhor.",
    icon: WalletCards,
  },
];

const chatMessages = [
  { text: "gastei 82 reais no mercado", fromUser: true },
  { text: "Pronto. Classifiquei como Mercado e atualizei seu mês.", fromUser: false },
  { text: "quanto ainda posso gastar essa semana?", fromUser: true },
  { text: "Você ainda tem R$ 418 dentro do limite planejado.", fromUser: false },
];

const entries = [
  { label: "Mercado", value: "-R$ 82,00", detail: "WhatsApp", positive: false },
  { label: "Freelance", value: "+R$ 480,00", detail: "Receita", positive: true },
  { label: "Streaming", value: "-R$ 29,90", detail: "Gasto fixo", positive: false },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="inline-flex min-w-0 items-center" aria-label="Moedin.IA">
            <ThemedLogo className="h-12 w-[142px] sm:h-14 sm:w-[168px]" priority />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-[var(--muted-strong)] md:flex">
            <a href="#como-funciona" className="transition hover:text-[var(--brand-strong)]">
              Como funciona
            </a>
            <a href="#recursos" className="transition hover:text-[var(--brand-strong)]">
              Recursos
            </a>
            <a href="#seguranca" className="transition hover:text-[var(--brand-strong)]">
              Segurança
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="btn-secondary px-4 py-2 text-sm">
              Entrar
            </Link>
            <Link href="/cadastro" className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <section className="relative border-b border-[var(--line)]">
        <div className="premium-grid pointer-events-none absolute inset-x-0 top-0 h-[640px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-[var(--bg)]" />

        <div className="relative mx-auto grid w-full max-w-[1180px] gap-10 px-5 pb-16 pt-10 sm:px-8 lg:min-h-[710px] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-20 lg:pt-14">
          <div className="min-w-0">
            <h1 className="max-w-3xl font-display text-4xl font-black leading-[1.02] text-[var(--navy)] sm:text-5xl lg:text-6xl">
              Controle seu dinheiro pelo WhatsApp, sem planilha complicada.
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-[var(--muted)] sm:text-lg">
              O Moedin.IA ajuda você a registrar gastos em segundos, organizar tudo com IA e acompanhar o mês em um
              painel simples, bonito e feito para a rotina real.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-4 text-sm">
                Criar conta
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
              <Link href="/login" className="btn-secondary inline-flex items-center justify-center px-6 py-4 text-sm">
                Já tenho conta
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {trustItems.map((item) => (
                <span key={item} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--muted-strong)] shadow-[var(--shadow-soft)]">
                  {item}
                </span>
              ))}
            </div>

            <p className="mt-5 max-w-lg text-sm font-bold leading-6 text-[var(--muted)]">
              Feito para transformar mensagem, recibo e rotina financeira em uma visão clara do seu mês.
            </p>
          </div>

          <div className="relative min-w-0">
            <div className="mx-auto grid max-w-[650px] gap-4 sm:grid-cols-[0.9fr_1.1fr] sm:items-end">
              <div className="order-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)] sm:order-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-strong)]">Resumo do mês</p>
                    <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">R$ 3.840</h2>
                  </div>
                  <PieChart className="h-9 w-9 text-[var(--brand)]" strokeWidth={2.2} />
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--line)]">
                  <div className="h-full w-[64%] rounded-full bg-[var(--brand)]" />
                </div>
                <div className="mt-2 flex justify-between text-xs font-bold text-[var(--muted)]">
                  <span>Orçamento usado</span>
                  <span>64%</span>
                </div>

                <div className="mt-5 space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
                      <div>
                        <p className="text-sm font-black text-[var(--navy)]">{entry.label}</p>
                        <p className="text-xs font-bold text-[var(--muted)]">{entry.detail}</p>
                      </div>
                      <p className={`text-sm font-black ${entry.positive ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                        {entry.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-1 rounded-[30px] border border-[var(--line)] bg-[#111c17] p-3 shadow-[var(--shadow-strong)] sm:order-2">
                <div className="rounded-[24px] bg-[#f5f1e8] p-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-[#0d6b45] px-4 py-3 text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/16">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black">Moedin.IA</p>
                      <p className="text-xs font-bold text-white/70">online agora</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {chatMessages.map((message) => (
                      <div
                        key={message.text}
                        className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm font-bold leading-6 shadow-sm ${
                          message.fromUser
                            ? "ml-auto rounded-tr-sm bg-[#dcf8c6] text-[#1a1a1a]"
                            : "rounded-tl-sm bg-white text-[#26342d]"
                        }`}
                      >
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                    <p className="flex-1 text-xs font-bold text-[#65736a]">Mensagem financeira...</p>
                    <Send className="h-4 w-4 text-[var(--brand)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-8 left-4 right-4 hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] lg:flex lg:items-center lg:justify-between">
              {[
                [Mic, "Áudio"],
                [Camera, "Imagem"],
                [Bot, "IA organiza"],
                [BarChart3, "Painel atualiza"],
              ].map(([Icon, label]) => {
                const ItemIcon = Icon as typeof Mic;
                return (
                  <div key={label as string} className="flex items-center gap-2">
                    <ItemIcon className="h-4 w-4 text-[var(--brand)]" />
                    <span className="text-sm font-black text-[var(--navy)]">{label as string}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1180px] gap-4 px-5 py-12 sm:px-8 md:grid-cols-4">
        {quickBenefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <div key={benefit.title} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                <Icon className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <h3 className="mt-5 font-display text-lg font-black text-[var(--navy)]">{benefit.title}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{benefit.description}</p>
            </div>
          );
        })}
      </section>

      <section id="como-funciona" className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div>
          <h2 className="font-display text-3xl font-black leading-tight text-[var(--navy)] sm:text-4xl">
            Seu controle financeiro em 3 passos.
          </h2>
          <p className="mt-4 text-base font-medium leading-7 text-[var(--muted)]">
            A ideia é simples: você registra sem atrito, a IA organiza o lançamento e o painel mostra onde seu dinheiro
            está indo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {flow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-sm font-black text-[var(--muted)]">0{index + 1}</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <Icon className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                </div>
                <h3 className="mt-8 font-display text-xl font-black text-[var(--navy)]">{step.title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="recursos" className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8">
          <div className="mb-9 max-w-3xl">
            <h2 className="font-display text-3xl font-black leading-tight text-[var(--navy)] sm:text-4xl">
              Tudo para cuidar do mês em um só lugar.
            </h2>
            <p className="mt-4 text-base font-medium leading-7 text-[var(--muted)]">
              O Moedin.IA junta os recursos que uma pessoa precisa no dia a dia: gastos, metas, fixos, parcelas,
              histórico e planejamento.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-soft)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                    <Icon className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-black text-[var(--navy)]">{feature.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="seguranca" className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <LockKeyhole className="h-10 w-10 text-[var(--brand)]" strokeWidth={2.4} />
          <h2 className="mt-5 font-display text-3xl font-black leading-tight text-[var(--navy)] sm:text-4xl">
            Clareza para você. Cuidado com seus dados.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
            O Moedin.IA não realiza pagamentos, transferências ou investimentos. Ele ajuda na organização financeira,
            mantendo autenticação, sessão e dados vinculados ao usuário logado.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-strong)]">
          {[
            "Login e rotas protegidas",
            "Dados financeiros ligados ao usuário",
            "Base preparada para LGPD",
            "IA como apoio, não como decisão financeira",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 border-t border-[var(--line)] py-4 first:border-t-0 first:pt-0 last:pb-0">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--brand)]" />
              <p className="font-display text-base font-black text-[var(--navy)]">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-5 pb-16 sm:px-8">
        <div className="grid gap-8 rounded-2xl border border-[var(--line)] bg-[var(--hero-gradient)] p-7 shadow-[var(--shadow-strong)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-black leading-tight text-[var(--navy)]">
              Organize seu dinheiro sem complicar sua rotina.
            </h2>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[var(--muted)]">
              Comece pelo básico: registre seus gastos, veja o resumo do mês e ganhe clareza para decidir melhor.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-4 text-sm">
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-secondary inline-flex items-center justify-center px-6 py-4 text-sm">
              Entrar
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 border-t border-[var(--line)] px-5 py-8 text-sm font-medium text-[var(--muted)] sm:px-8 md:flex-row md:items-center md:justify-between">
        <ThemedLogo className="h-[54px] w-[160px]" />
        <p className="max-w-md md:text-right">Controle financeiro com IA, WhatsApp e clareza.</p>
      </footer>
    </main>
  );
}
