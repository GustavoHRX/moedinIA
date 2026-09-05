"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

export default function ThemeToggle({
  className = "",
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-fg transition hover:border-primary"
        }
        aria-label="Alternar tema"
        suppressHydrationWarning
      >
        <Moon className="h-4 w-4" strokeWidth={2.4} />
        {showLabel ? "Tema" : null}
      </button>
    );
  }

  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={
        className ||
        "inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-fg transition hover:border-primary"
      }
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      <Icon className="h-4 w-4" strokeWidth={2.4} />
      {showLabel ? (isDark ? "Tema claro" : "Tema escuro") : null}
    </button>
  );
}
