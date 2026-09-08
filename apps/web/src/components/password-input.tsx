"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Campo de senha com botão "olhinho" para revelar o que foi digitado.
 * Repassa todas as props de <input>; o `type` é controlado aqui.
 * O padding-direito extra vai por inline style porque `.control` (globals.css,
 * fora de @layer) ganha de utilities do Tailwind v4 na cascata.
 */
export default function PasswordInput({
  className = "control",
  style,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={className}
        style={{ paddingRight: "2.75rem", ...style }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        title={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] transition hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}
