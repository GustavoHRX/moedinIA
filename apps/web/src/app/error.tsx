"use client";

import { useEffect } from "react";
import Link from "next/link";
import ThemedLogo from "@/components/themed-logo";

/**
 * AUDITORIA M-4: tela de erro global. Nunca mostra stack trace, mensagem crua
 * ou detalhe interno para o usuário — só um texto genérico no tom do produto.
 * O erro real vai para o console (e, quando houver, para o serviço de
 * observabilidade).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log local. Trocar por Sentry/observabilidade quando configurado.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-6 py-16 text-center text-[var(--text)]">
      <Link href="/" className="inline-flex" aria-label="Moedin.IA">
        <ThemedLogo className="h-10 w-[120px]" />
      </Link>
      <h1 className="font-display text-2xl font-bold">Algo saiu do trilho por aqui.</h1>
      <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
        Já registramos o problema. Você pode tentar de novo — se continuar, volte
        mais tarde.
      </p>
      {error.digest ? (
        <p className="text-xs text-[var(--muted)]">Código: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary px-5 py-3">
          Tentar de novo
        </button>
        <Link href="/dashboard" className="btn-secondary px-5 py-3">
          Ir para o painel
        </Link>
      </div>
    </main>
  );
}
