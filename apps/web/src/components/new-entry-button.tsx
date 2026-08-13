"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Carregado sob demanda: o modal (e a lógica de Supabase que ele traz) só entra
// no bundle quando o usuário abre um novo lançamento pela primeira vez.
const FinancialEntryModal = dynamic(() => import("@/components/financial-entry-modal"), {
  ssr: false,
});

type NewEntryButtonProps = {
  label?: React.ReactNode;
  className?: string;
  onSaved?: () => void | Promise<void>;
};

export default function NewEntryButton({
  label = "Novo lançamento",
  className = "",
  onSaved,
}: NewEntryButtonProps) {
  const [open, setOpen] = useState(false);
  // Só monta o modal depois do primeiro clique — aí o chunk é baixado sob demanda.
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className={className || "btn-primary px-5 py-3"}
      >
        {label}
      </button>

      {mounted ? (
        <FinancialEntryModal
          open={open}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            await onSaved?.();
            window.dispatchEvent(new CustomEvent("financial-entry-saved"));
          }}
        />
      ) : null}
    </>
  );
}
