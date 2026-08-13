"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Animação "celebrate" do Brand Book (pág. 08): moedinhas caem e o card
 * pulsa 1x. Renderize dentro de um container com position: relative;
 * `trigger` muda (ex: id da meta batida) → dispara uma vez e some sozinho.
 */
export function CelebrateBurst({ trigger }: { trigger: string | null }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!trigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setActive(trigger);
    const timeout = setTimeout(() => setActive(null), 1700);
    return () => clearTimeout(timeout);
  }, [trigger]);

  const coins = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        left: 4 + ((index * 37) % 92),
        delay: (index * 73) % 420,
        size: 10 + ((index * 29) % 8),
      })),
    []
  );

  if (!active) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]">
      {coins.map((coin, index) => (
        <svg
          key={`${active}-${index}`}
          viewBox="0 0 24 24"
          width={coin.size}
          height={coin.size}
          className="absolute top-0"
          style={{
            left: `${coin.left}%`,
            animation: `coin-fall 1.2s cubic-bezier(0.16, 1, 0.3, 1) ${coin.delay}ms both`,
          }}
        >
          <circle cx="12" cy="12" r="10" fill="none" stroke="var(--primary)" strokeWidth="2.4" />
          <circle cx="12" cy="12" r="5.5" fill="none" stroke="var(--mint)" strokeWidth="1.8" />
        </svg>
      ))}
    </div>
  );
}
