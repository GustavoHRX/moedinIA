"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "brand";
};

type ConfirmFn = (options: string | ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [mounted, setMounted] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const confirm = useCallback<ConfirmFn>((input) => {
    const next = typeof input === "string" ? { message: input } : input;
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    if (!options) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options, close]);

  const tone = options?.tone ?? "danger";
  const confirmClass =
    tone === "danger"
      ? "bg-[var(--danger)] text-white hover:brightness-105"
      : "btn-primary";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {mounted && options
        ? createPortal(
            <div
              className="anim-modal-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
              onClick={() => close(false)}
            >
              <div
                className="anim-modal-card w-full max-w-md rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-[0_28px_70px_rgba(9,42,32,0.28)]"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
              >
                <h2 className="font-display text-xl font-bold text-[var(--navy)]">
                  {options.title ?? "Confirmar ação"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{options.message}</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3 font-semibold text-[var(--text)] transition hover:bg-[var(--bg-soft)]"
                  >
                    {options.cancelLabel ?? "Cancelar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => close(true)}
                    className={`rounded-2xl px-5 py-3 font-display font-semibold transition ${confirmClass}`}
                  >
                    {options.confirmLabel ?? "Confirmar"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm deve ser usado dentro de ConfirmProvider");
  }
  return ctx;
}
