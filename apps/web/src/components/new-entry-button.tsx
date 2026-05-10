"use client";

import { useState } from "react";
import FinancialEntryModal from "@/components/financial-entry-modal";

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || "btn-primary px-5 py-3"}
      >
        {label}
      </button>

      <FinancialEntryModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={async () => {
          await onSaved?.();
          window.dispatchEvent(new CustomEvent("financial-entry-saved"));
        }}
      />
    </>
  );
}
