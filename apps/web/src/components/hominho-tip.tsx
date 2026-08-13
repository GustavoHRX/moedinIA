"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Hominho, HOMINHO_LABEL, type HominhoName } from "@/components/hominhos";
import type { HominhoTipItem } from "@/lib/tips";

const STORAGE_PREFIX = "hominho";

function storageKey(page: string, tipId: string) {
  return `${STORAGE_PREFIX}:${page}:${tipId}`;
}

/**
 * Card de dica contextual com o hominho "padrinho" da página.
 * Mostra a primeira dica ainda não dispensada; a dispensa fica no
 * localStorage e a dica só volta se surgir uma dica nova (id novo).
 */
export function HominhoTip({
  page,
  hominho,
  tips,
  className = "",
}: {
  page: string;
  hominho: HominhoName;
  tips: HominhoTipItem[];
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const dismissed = tips
        .filter((tip) => window.localStorage.getItem(storageKey(page, tip.id)) === "1")
        .map((tip) => tip.id);
      setDismissedIds(dismissed);
    } catch {
      setDismissedIds([]);
    }
    setReady(true);
  }, [page, tips]);

  const tip = useMemo(
    () => tips.find((item) => !dismissedIds.includes(item.id)) ?? null,
    [tips, dismissedIds]
  );

  if (!ready || !tip) return null;

  function handleDismiss() {
    if (!tip) return;
    try {
      window.localStorage.setItem(storageKey(page, tip.id), "1");
    } catch {
      /* sem localStorage, a dica só some nesta sessão */
    }
    setDismissedIds((current) => [...current, tip.id]);
  }

  return (
    <div className={`anim-pop-in anim-coin-flip relative flex items-start gap-4 ${className}`}>
      <div className="relative z-10 mt-1 shrink-0">
        <Hominho name={hominho} size={56} />
      </div>
      <div className="relative flex-1 rounded-[16px] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3.5 pr-10">
        <span
          aria-hidden="true"
          className="absolute -left-[7px] top-6 h-3.5 w-3.5 rotate-45 border-b border-l border-[var(--line)] bg-[var(--surface-strong)]"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--mint)]">
          {HOMINHO_LABEL[hominho]} · dica
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">{tip.text}</p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dispensar dica"
          title="Dispensar dica"
          className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-[var(--text-soft)] transition hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
