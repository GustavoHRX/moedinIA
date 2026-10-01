"use client";

import { useId, useRef, useState } from "react";

/**
 * "Para quem é" — as 3 personas do TCC (PLANO DE CORREÇÃO §1.3) como abas.
 * São SITUAÇÕES, não depoimentos: nenhuma frase é atribuída a uma pessoa real.
 * Abas acessíveis (role=tablist, setas do teclado). A troca é um fade curto
 * via `key` + .chat-in (sem animação de teclado longa: só 280ms).
 */
const PERSONAS = [
  {
    tab: "Primeiro salário",
    pain: "Queria saber pra onde vai meu salário, mas esqueço os gastinhos do Pix e do cartão.",
    how: "Manda rápido, do jeito que escreve no zap. O Moedin-IA entende abreviação e valor quebrado.",
    examples: ["uber 18,90", "gastei 32 no ifood"],
  },
  {
    tab: "Renda que varia",
    pain: "Queria separar o que é do trabalho e o que é de casa, mas não tenho tempo de anotar.",
    how: "Manda áudio no meio do corre. Receita também entra: o painel mostra quanto entrou e quanto saiu.",
    examples: ["abasteci 150", "recebi 200 da corrida"],
  },
  {
    tab: "Pouca paciência pra app",
    pain: "Queria controlar as parcelas, mas esses aplicativos são complicados demais.",
    how: "Nada pra instalar. Escreve ou fala como falaria com alguém, e as parcelas ficam guardadas mês a mês.",
    examples: ["paguei cento e vinte da conta de luz", "comprei uma geladeira em 10 vezes"],
  },
];

export default function PersonaTabs() {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const persona = PERSONAS[active];

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (active + (event.key === "ArrowRight" ? 1 : PERSONAS.length - 1)) % PERSONAS.length;
    setActive(next);
    tabsRef.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Situações de uso"
        onKeyDown={onKeyDown}
        className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
      >
        {PERSONAS.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.tab}
              ref={(el) => {
                tabsRef.current[index] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              className={`press shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                selected
                  ? "border-transparent bg-[var(--primary)] text-[var(--on-primary)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--navy)]"
              }`}
            >
              {item.tab}
            </button>
          );
        })}
      </div>

      <div
        key={active}
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="chat-in mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center"
      >
        <div>
          <p className="font-display text-2xl font-semibold leading-snug text-[var(--navy)] sm:text-3xl" style={{ textWrap: "balance" }}>
            &ldquo;{persona.pain}&rdquo;
          </p>
          <p className="mt-5 max-w-[52ch] text-base font-medium leading-7 text-[var(--muted)]">{persona.how}</p>
        </div>

        <div className="rounded-[26px] bg-[#f5f1e8] p-4">
          <div className="flex flex-col gap-3">
            {persona.examples.map((text) => (
              <div
                key={text}
                className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-4 py-3 text-sm font-bold leading-6 text-[#1a1a1a] shadow-sm"
              >
                {text}
              </div>
            ))}
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm font-bold leading-6 text-[#26342d] shadow-sm">
              Anotado e organizado no seu mês.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
