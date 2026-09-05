"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

/**
 * Login/cadastro com Google via Supabase OAuth. Só funciona depois de o
 * provedor Google ser habilitado no painel do Supabase (Authentication →
 * Providers) — ver instruções no README. Até lá, o clique mostra o erro
 * que o Supabase devolver (provider not enabled).
 */
export default function GoogleSignInButton({ label = "Continuar com Google" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (oauthError) {
      setLoading(false);
      setError(
        /provider is not enabled/i.test(oauthError.message)
          ? "Login com Google ainda não está disponível. Use e-mail e senha por enquanto."
          : "Não conseguimos abrir o login do Google. Tenta de novo."
      );
    }
    // Em caso de sucesso o navegador é redirecionado pro Google — não há o que fazer aqui.
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-secondary inline-flex w-full items-center justify-center gap-2.5 px-5 py-3.5 disabled:opacity-70"
      >
        <GoogleGlyph />
        {loading ? "Abrindo o Google..." : label}
      </button>
      {error ? <p className="mt-2 text-center text-xs font-semibold text-expense">{error}</p> : null}
    </div>
  );
}
