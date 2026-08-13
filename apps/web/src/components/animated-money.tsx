"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/formatters";

/**
 * Count-up da marca (book pág. 08): o valor "conta" do anterior até o novo
 * em 450ms com ease-out. Respeita prefers-reduced-motion (troca instantânea).
 */
export function AnimatedMoney({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const previousRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = previousRef.current;
    const to = value;
    previousRef.current = value;

    if (from === to) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(to);
      return;
    }

    const duration = 450;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <span className={`money tabular-nums ${className}`}>{formatCurrency(display)}</span>;
}
