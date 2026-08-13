"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

export default function AtualizarSenhaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      setIsError(true);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(translateAuthError(error.message));
      setIsError(true);
      return;
    }

    setMessage("Senha atualizada com sucesso. Redirecionando...");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <AuthShell
      eyebrow="Nova senha"
      title="Defina um acesso seguro para continuar."
      description="Atualize sua senha e volte ao painel do Moedin.IA com seus dados financeiros protegidos."
      features={["Senha renovada", "Conta protegida", "Retorno ao login"]}
      spotlightTitle="Segurança"
      spotlightText="Depois de salvar a nova senha, você será levado para entrar novamente no Moedin.IA."
      hominho="timachi"
    >
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
        <KeyRound className="h-6 w-6" />
      </div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Atualização de senha</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-[var(--navy)]">Atualizar senha</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Defina uma nova senha para continuar usando sua conta.</p>

      <form onSubmit={handleUpdate} className="mt-7 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Nova senha</label>
          <input className="control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Confirmar nova senha</label>
          <input className="control" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full px-5 py-3.5 disabled:opacity-70">
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
        {message ? (
          <div className={isError ? "alert-error rounded-2xl px-4 py-3 text-sm font-semibold" : "alert-info rounded-2xl px-4 py-3 text-sm font-semibold"}>
            {message}
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}
