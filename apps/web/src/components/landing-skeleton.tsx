"use client";

import { useEffect, useState } from "react";

/**
 * Skeleton de carregamento da landing. Aparece no primeiro paint espelhando
 * o layout do hero e some com um fade quando a página está pronta (fontes
 * carregadas). Respeita prefers-reduced-motion: some na hora, sem shimmer.
 */
export default function LandingSkeleton() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    const MIN_VISIBLE = 550; // splash mínimo agradável, evita flash de 1 frame

    function done() {
      if (cancelled) return;
      const wait = Math.max(0, MIN_VISIBLE - (performance.now() - start));
      setTimeout(() => !cancelled && setHidden(true), wait);
    }

    // Espera as fontes (evita "flash" do texto trocando de fonte) com teto de segurança.
    const fontsReady =
      typeof document !== "undefined" && "fonts" in document
        ? (document as Document & { fonts: FontFaceSet }).fonts.ready
        : Promise.resolve();

    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(done);

    return () => {
      cancelled = true;
    };
  }, []);

  // Remove do DOM após o fade terminar, para não capturar cliques.
  useEffect(() => {
    if (!hidden) return;
    const timeout = setTimeout(() => setRemoved(true), 420);
    return () => clearTimeout(timeout);
  }, [hidden]);

  if (removed) return null;

  const bar = "skeleton-shimmer rounded-lg";

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[300] overflow-hidden bg-[var(--bg)] ${
        hidden ? "landing-skeleton-hide" : ""
      }`}
    >
      <div className="premium-grid pointer-events-none absolute inset-x-0 top-0 h-[640px]" />

      {/* Header */}
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <div className={`${bar} h-11 w-[150px]`} />
        <div className={`${bar} h-9 w-24`} />
      </div>

      {/* Hero */}
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 pt-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pt-14">
        <div className="space-y-5">
          <div className={`${bar} h-12 w-11/12`} />
          <div className={`${bar} h-12 w-3/4`} />
          <div className="space-y-2 pt-2">
            <div className={`${bar} h-4 w-full`} />
            <div className={`${bar} h-4 w-10/12`} />
            <div className={`${bar} h-4 w-7/12`} />
          </div>
          <div className="flex gap-3 pt-3">
            <div className={`${bar} h-14 w-48`} />
            <div className={`${bar} h-14 w-44`} />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {[64, 72, 80, 68].map((w, i) => (
              <div key={i} className={`${bar} h-9`} style={{ width: w }} />
            ))}
          </div>
        </div>

        <div className="hidden gap-4 sm:grid sm:grid-cols-[0.9fr_1.1fr] sm:items-end lg:grid">
          <div className={`${bar} h-64 w-full`} />
          <div className={`${bar} h-80 w-full`} />
        </div>
      </div>
    </div>
  );
}
