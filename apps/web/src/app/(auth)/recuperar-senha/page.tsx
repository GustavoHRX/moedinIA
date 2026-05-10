"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import AuthShell from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar-senha`,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      setIsError(true);
      return;
    }

    setMessage("Enviamos o link de redefinição para seu e-mail.");
  }

  return (
    <AuthShell
      eyebrow="Recuperação segura"
      title="Volte para seu painel sem perder o ritmo."
      description="Enviaremos um link pelo Supabase Auth para redefinir sua senha e manter sua sessão protegida."
      features={["Link seguro por e-mail", "Sessão protegida", "Volta rápida ao painel"]}
      spotlightTitle="Conta protegida"
      spotlightText="O fluxo de redefinição mantém sua conta do Moedin.IA conectada ao Supabase Auth."
    >
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Redefinir acesso</p>
      <h1 className="mt-3 font-display text-4xl font-black text-[var(--navy)]">Recuperar senha</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Informe o e-mail da conta para receber o link de redefinição.</p>

      <form onSubmit={handleReset} className="mt-7 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-extrabold text-[var(--text)]">E-mail</label>
          <input className="control" type="email" placeholder="email@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full px-5 py-3.5 disabled:opacity-70">
          {loading ? "Enviando..." : "Enviar link"}
        </button>
        {message ? (
          <div className={isError ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" : "alert-info rounded-2xl px-4 py-3 text-sm font-semibold"}>
            {message}
          </div>
        ) : null}
        <p className="text-center text-sm text-[var(--muted)]">
          <Link href="/login" className="font-extrabold text-[var(--brand)] hover:text-[var(--brand-strong)]">
            Voltar para login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
