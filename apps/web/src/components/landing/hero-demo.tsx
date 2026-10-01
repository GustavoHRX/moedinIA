"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Bot, Camera, MessageCircle, Mic, PieChart, Play, ReceiptText, Send } from "lucide-react";

/**
 * Demo do hero: o "zap" + o card "Resumo do mês". É o ÚNICO loop da página
 * (regra do DESIGN.md: 1 loop por tela). Mostra os 3 jeitos de registrar —
 * texto, áudio e foto — e o painel reagindo a cada lançamento.
 *
 * - O primeiro paint (servidor) é a cena de texto completa, igual à landing
 *   antiga: sem JS ou com prefers-reduced-motion a demo fica parada nela.
 * - Só anima enquanto está na tela e com a aba visível (IntersectionObserver +
 *   visibilitychange) — não gasta CPU com o hero fora de vista.
 * - Nada aqui é tocado pelo GSAP (só o wrapper [data-hero-mock]); as transições
 *   são CSS/rAF, então não há briga de `transform` (ver nota do cofre).
 */

type InputKind = "text" | "audio" | "photo";
type Msg =
  | { from: "user"; kind: "text"; text: string }
  | { from: "user"; kind: "audio"; transcript: string; duration: string }
  | { from: "user"; kind: "photo"; caption: string }
  | { from: "bot"; text: string };
type Entry = { label: string; detail: string; value: number };
type CardState = { total: number; budget: number; entries: Entry[] };
type Scene = { input: InputKind; msgs: Msg[]; before: CardState; after: CardState };

const MERCADO: Entry = { label: "Mercado", detail: "WhatsApp", value: -82 };
const FREELANCE: Entry = { label: "Freelance", detail: "Receita", value: 480 };
const STREAMING: Entry = { label: "Streaming", detail: "Gasto fixo", value: -29.9 };
const FARMACIA: Entry = { label: "Farmácia", detail: "Painel", value: -23.4 };
const COMBUSTIVEL: Entry = { label: "Combustível", detail: "Áudio", value: -150 };
const LUZ: Entry = { label: "Conta de luz", detail: "Foto", value: -120 };

const INITIAL: CardState = { total: 3840, budget: 64, entries: [MERCADO, FREELANCE, STREAMING] };

const SCENES: Scene[] = [
  {
    input: "text",
    msgs: [
      { from: "user", kind: "text", text: "gastei 82 reais no mercado" },
      { from: "bot", text: "Pronto. Classifiquei como Mercado e atualizei seu mês." },
      { from: "user", kind: "text", text: "quanto ainda posso gastar essa semana?" },
      { from: "bot", text: "Você ainda tem R$ 418 dentro do limite planejado." },
    ],
    before: { total: 3922, budget: 62, entries: [FREELANCE, STREAMING, FARMACIA] },
    after: INITIAL,
  },
  {
    input: "audio",
    msgs: [
      { from: "user", kind: "audio", transcript: "abasteci 150", duration: "0:04" },
      { from: "bot", text: "Anotado. Combustível, R$ 150,00, hoje." },
    ],
    before: INITIAL,
    after: { total: 3690, budget: 68, entries: [COMBUSTIVEL, MERCADO, FREELANCE] },
  },
  {
    input: "photo",
    msgs: [
      { from: "user", kind: "photo", caption: "foto do comprovante" },
      { from: "bot", text: "Li o comprovante: conta de luz, R$ 120,00. Lancei em Contas." },
    ],
    before: { total: 3690, budget: 68, entries: [COMBUSTIVEL, MERCADO, FREELANCE] },
    after: { total: 3570, budget: 71, entries: [LUZ, COMBUSTIVEL, MERCADO] },
  },
];

type Highlight = "audio" | "photo" | "ia" | "painel" | null;

const STRIP: { key: Highlight; label: string; Icon: typeof Mic }[] = [
  { key: "audio", label: "Áudio", Icon: Mic },
  { key: "photo", label: "Imagem", Icon: Camera },
  { key: "ia", label: "IA organiza", Icon: Bot },
  { key: "painel", label: "Painel atualiza", Icon: BarChart3 },
];

function brl(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MessageBubble({ msg, animate }: { msg: Msg; animate: boolean }) {
  const enter = animate ? " chat-in" : "";
  if (msg.from === "bot") {
    return (
      <div className={`max-w-[86%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm font-bold leading-6 text-[#26342d] shadow-sm${enter}`}>
        {msg.text}
      </div>
    );
  }
  const userBox = `ml-auto max-w-[86%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-4 py-3 text-sm font-bold leading-6 text-[#1a1a1a] shadow-sm${enter}`;
  if (msg.kind === "audio") {
    return (
      <div className={userBox}>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d6b45] text-white">
            <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
          </span>
          <span aria-hidden="true" className="flex h-6 items-center gap-[3px]">
            {[8, 14, 20, 11, 17, 24, 13, 9, 18, 22, 12, 7, 15, 10].map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-[#0d6b45]/70" style={{ height: h }} />
            ))}
          </span>
          <span className="text-xs text-[#4b5a52]">{msg.duration}</span>
        </div>
        <p className="mt-1.5 text-xs font-semibold italic text-[#4b5a52]">&ldquo;{msg.transcript}&rdquo;</p>
      </div>
    );
  }
  if (msg.kind === "photo") {
    return (
      <div className={`${userBox} !p-1.5`}>
        <div className="flex h-24 w-44 flex-col items-center justify-center gap-1.5 rounded-xl bg-[#c9e9b4] text-[#2f5a3f]">
          <ReceiptText className="h-7 w-7" strokeWidth={1.8} />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Comprovante</span>
        </div>
        <p className="px-2 pb-1 pt-1.5 text-xs font-semibold text-[#4b5a52]">{msg.caption}</p>
      </div>
    );
  }
  return <div className={userBox}>{msg.text}</div>;
}

function TypingBubble() {
  return (
    <div className="inline-flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[#0d6b45] shadow-sm">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}

export default function HeroDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const shownTotal = useRef(INITIAL.total);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(SCENES[0].msgs.length);
  const [typing, setTyping] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [card, setCard] = useState<CardState>(INITIAL);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [animated, setAnimated] = useState(false);

  // Loop das cenas
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let inView = false;
    const io = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting), { threshold: 0.25 });
    io.observe(root);

    // Espera `ms` de tela ativa: pausa enquanto o hero está fora de vista ou a aba escondida.
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        let left = ms;
        const tick = () => {
          if (cancelled) return;
          if (inView && !document.hidden) left -= 100;
          if (left <= 0) resolve();
          else window.setTimeout(tick, 100);
        };
        window.setTimeout(tick, 100);
      });

    (async () => {
      await wait(4200); // deixa a cena inicial ser lida antes de girar
      let index = 0;
      while (!cancelled) {
        index = (index + 1) % SCENES.length;
        const scene = SCENES[index];

        setLeaving(true);
        setHighlight(null);
        await wait(240);
        if (cancelled) return;
        setAnimated(true);
        setTyping(false);
        setSceneIndex(index);
        setVisibleCount(0);
        setCard(scene.before);
        setLeaving(false);
        await wait(450);

        let cardUpdated = false;
        for (let i = 0; i < scene.msgs.length && !cancelled; i++) {
          const msg = scene.msgs[i];
          if (msg.from === "user") {
            setHighlight(scene.input === "text" ? null : scene.input);
            setVisibleCount(i + 1);
            await wait(750);
            setTyping(true);
            await wait(950);
          } else {
            setTyping(false);
            setHighlight("ia");
            setVisibleCount(i + 1);
            await wait(550);
            if (!cardUpdated) {
              cardUpdated = true;
              setCard(scene.after);
              setHighlight("painel");
            }
            await wait(1300);
          }
        }
        if (cancelled) return;
        setHighlight(null);
        await wait(3600);
      }
    })();

    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  // Count-up do total do card (rAF direto no texto: sem re-render por frame)
  useEffect(() => {
    const el = totalRef.current;
    if (!el) return;
    const from = shownTotal.current;
    const to = card.total;
    if (from === to) return;
    const start = performance.now();
    const duration = 450;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (to - from) * eased);
      el.textContent = `R$ ${value.toLocaleString("pt-BR")}`;
      shownTotal.current = value;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [card.total]);

  const scene = SCENES[sceneIndex];

  return (
    <div ref={rootRef} data-hero-mock className="relative min-w-0">
      <div className="mx-auto grid max-w-[650px] gap-4 sm:grid-cols-[0.9fr_1.1fr] sm:items-end">
        <div className="order-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)] sm:order-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-strong)]">Resumo do mês</p>
              <p className="money mt-1 text-2xl font-semibold text-[var(--navy)]">
                <span ref={totalRef}>R$ {INITIAL.total.toLocaleString("pt-BR")}</span>
              </p>
            </div>
            <PieChart className="h-9 w-9 text-[var(--brand)]" strokeWidth={2.2} />
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--line)]">
            <div
              className="budget-fill h-full w-full origin-left rounded-full bg-[var(--brand)]"
              style={{ transform: `scaleX(${card.budget / 100})` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs font-bold text-[var(--muted)]">
            <span>Orçamento usado</span>
            <span className="money">{card.budget}%</span>
          </div>

          <div className="mt-5 space-y-2" aria-live="off">
            {card.entries.map((entry) => (
              <div
                key={entry.label}
                className={`flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-3${animated ? " chat-in" : ""}`}
              >
                <div>
                  <p className="text-sm font-bold text-[var(--navy)]">{entry.label}</p>
                  <p className="text-xs font-bold text-[var(--muted)]">{entry.detail}</p>
                </div>
                <p className={`money whitespace-nowrap text-sm font-semibold ${entry.value > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {entry.value > 0 ? "+" : "-"}R$ {brl(Math.abs(entry.value))}
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
                <p className="font-bold">Moedin-IA</p>
                <p className="text-xs font-bold text-white/70">{typing ? "digitando..." : "online agora"}</p>
              </div>
            </div>

            {/* A altura vem de uma cópia invisível da cena mais longa (a de texto):
                nunca corta mensagem em tela estreita e não mexe no layout ao trocar de cena. */}
            <div className="relative mt-5" aria-label="Exemplo de conversa com o Moedin-IA no WhatsApp">
              <div aria-hidden="true" className="invisible flex flex-col gap-3">
                {SCENES[0].msgs.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} animate={false} />
                ))}
                <TypingBubble />
              </div>
              <div className={`absolute inset-0 flex flex-col gap-3 transition-opacity duration-200 ${leaving ? "opacity-0" : "opacity-100"}`}>
                {scene.msgs.slice(0, visibleCount).map((msg, i) => (
                  <MessageBubble key={`${sceneIndex}-${i}`} msg={msg} animate={animated} />
                ))}
                {typing ? <TypingBubble /> : null}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
              <p className="flex-1 text-xs font-bold text-[#65736a]">Mensagem financeira...</p>
              <Send className="h-4 w-4 text-[var(--brand)]" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 left-4 right-4 hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)] lg:flex lg:items-center lg:justify-between">
        {STRIP.map(({ key, label, Icon }) => {
          const active = highlight === key;
          return (
            <div
              key={label}
              className={`strip-item flex items-center gap-2 rounded-lg px-3 py-2 ${active ? "bg-[var(--brand-soft)]" : ""}`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-[var(--brand-strong)]" : "text-[var(--brand)]"}`} />
              <span className={`text-sm font-bold ${active ? "text-[var(--brand-strong)]" : "text-[var(--navy)]"}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
