"use client";

/**
 * Os bonequinhos Moedin — avatares line-art da equipe (Brand Book v1.3, pág. 09).
 * Linha única menta, espessura 2.2 no grid 100, olhos-ponto, busto em "U",
 * badge com anel + 5 frisos de moeda. Arte validada em
 * docs/design/hominhos/bonequinhos-board.svg.
 */

export type HominhoName = "alefe" | "gustavo" | "marcinho" | "joao" | "timachi";

export const HOMINHO_LABEL: Record<HominhoName, string> = {
  alefe: "Alefe",
  gustavo: "Gustavo",
  marcinho: "Marcinho",
  joao: "João",
  timachi: "Timachi",
};

function Ring() {
  return (
    <g className="coin-flip-target" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
      <circle cx="50" cy="50" r="47" />
      <line x1="87.7" y1="71.8" x2="90.7" y2="73.5" />
      <line x1="82.3" y1="79.1" x2="84.9" y2="81.4" />
      <line x1="75.6" y1="85.2" x2="77.6" y2="88" />
      <line x1="67.7" y1="89.7" x2="69.1" y2="93" />
      <line x1="59" y1="92.5" x2="59.8" y2="96" />
    </g>
  );
}

function Ears() {
  return (
    <>
      <path d="M35.6,36.5 A4.2,4.2 0 1 0 35.6,43.5" />
      <path d="M64.4,36.5 A4.2,4.2 0 1 1 64.4,43.5" />
    </>
  );
}

function Eyes({ y = 40, r = 1.7 }: { y?: number; r?: number }) {
  return (
    <>
      <circle cx="44.5" cy={y} r={r} fill="currentColor" stroke="none" />
      <circle cx="55.5" cy={y} r={r} fill="currentColor" stroke="none" />
    </>
  );
}

function Brows({ high = false }: { high?: boolean }) {
  return high ? (
    <>
      <path d="M41.8,33.8 Q44.5,32.4 47,33.6" />
      <path d="M53,33.6 Q55.5,32.4 58.2,33.8" />
    </>
  ) : (
    <>
      <path d="M41.5,35.3 Q44.5,33.6 47.3,35" />
      <path d="M52.7,35 Q55.5,33.6 58.5,35.3" />
    </>
  );
}

const BUST = "M30,86 C30,70 38,64 50,64 C62,64 70,70 70,86";

function Glasses({ r = 5.2 }: { r?: number }) {
  return (
    <>
      <circle cx="44.5" cy="40.5" r={r} />
      <circle cx="55.5" cy="40.5" r={r} />
      <path d="M49.2,39.6 Q50,38.9 50.8,39.6" />
      <path d="M39.3,40 L36,39.3" />
      <path d="M60.7,40 L64,39.3" />
    </>
  );
}

const FIGURES: Record<HominhoName, React.ReactNode> = {
  alefe: (
    <>
      <Ring />
      <circle cx="50" cy="40" r="15" />
      <Ears />
      <path d="M35.8,32.5 a3.6,3.6 0 1 1 5.4,-4.6 a3.6,3.6 0 1 1 6.4,-1.6 a3.6,3.6 0 1 1 6.4,1.6 a3.6,3.6 0 1 1 5.4,4.6" />
      <Brows />
      <Eyes />
      <path d="M44,45.2 Q47,43.6 50,45.2" />
      <path d="M50,45.2 Q53,43.6 56,45.2" />
      <path d="M45.5,48.2 Q50,51.6 54.5,48.2" />
      <path d={BUST} />
      <path d="M44,64.5 L50,69.5 L56,64.5" />
    </>
  ),
  gustavo: (
    <>
      <Ring />
      <circle cx="50" cy="40" r="15" />
      <path d="M34,53 C29,38 36,23.5 50,23.5 C64,23.5 71,38 66,53" />
      <path d="M34,53 C34,59 38,62.5 42.5,64.5" />
      <path d="M66,53 C66,59 62,62.5 57.5,64.5" />
      <path d="M46.5,65 L45.8,72" />
      <path d="M53.5,65 L54.2,72" />
      <circle cx="45.7" cy="73.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="54.3" cy="73.6" r="1.2" fill="currentColor" stroke="none" />
      <Brows high />
      <Glasses />
      <Eyes y={40.5} r={1.5} />
      <path d="M45,48.5 Q50,52.3 55,48.5" />
      <path d={BUST} />
    </>
  ),
  marcinho: (
    <>
      <Ring />
      <circle cx="50" cy="40" r="15" />
      <Ears />
      <path d="M38,30 Q50,24 62,30" />
      <Brows />
      <Eyes />
      <path d="M45,46.5 Q50,50.5 55,46.5" />
      <path d={BUST} />
      <path d="M40.5,63.5 L40.5,57.5 Q50,53.5 59.5,57.5 L59.5,63.5" />
      <path d="M32.6,76 C40,72.5 60,72.5 67.4,76" />
      <path d="M30.8,82 C40,78.5 60,78.5 69.2,82" />
      <path d="M50,57 L50,86" />
      <path d="M50,63.5 L52.3,66 L50,68.5" />
    </>
  ),
  joao: (
    <>
      <Ring />
      <circle cx="50" cy="40" r="15" />
      <Ears />
      <path d="M38,29.5 Q50,23.5 62,29.5" />
      <Brows />
      <Eyes />
      <path d="M45,46.5 Q50,50.5 55,46.5" />
      <path d={BUST} />
      <path d="M43.5,64.5 Q50,69 56.5,64.5" />
      <circle cx="41.5" cy="69.5" r="1.5" />
      <circle cx="44.6" cy="72.2" r="1.5" />
      <circle cx="48.1" cy="73.8" r="1.5" />
      <circle cx="51.9" cy="73.8" r="1.5" />
      <circle cx="55.4" cy="72.2" r="1.5" />
      <circle cx="58.5" cy="69.5" r="1.5" />
    </>
  ),
  timachi: (
    <>
      <Ring />
      <circle cx="50" cy="40" r="15" />
      <Ears />
      <path d="M39,31 Q50,25 61,31" />
      <Brows high />
      <Glasses r={5} />
      <Eyes y={40.5} r={1.5} />
      <path d="M37.8,40 C37.8,52 43,57.5 50,57.5 C57,57.5 62.2,52 62.2,40" />
      <path d="M44,45.6 Q50,48.4 56,45.6" />
      <path d="M46,49.5 Q50,52 54,49.5" />
      <path d={BUST} />
      <path d="M42,64.5 L50,74.5 L58,64.5" />
      <path d="M44.8,66.8 L48.4,71.2" />
      <path d="M55.2,66.8 L51.6,71.2" />
    </>
  ),
};

export function Hominho({
  name,
  size = 48,
  className = "",
}: {
  name: HominhoName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`Bonequinho ${HOMINHO_LABEL[name]}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--mint)" }}
    >
      {FIGURES[name]}
    </svg>
  );
}
