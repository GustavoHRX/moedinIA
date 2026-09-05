"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/auth-shell";
import GoogleSignInButton from "@/components/google-signin-button";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import {
  EMAIL_MAX,
  PASSWORD_MAX,
  firstError,
  validateEmail,
  validateLoginPassword,
} from "@/lib/auth-validation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setMessage("");
    const validationError = firstError(
      validateEmail(email),
      validateLoginPassword(password),
    );
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    }).catch((error: unknown) => ({
      error: error instanceof Error ? error : new Error("Nao foi possivel conectar ao Supabase."),
    }));

    setLoading(false);
    if (error) {
      setMessage(translateAuthError(error.message));
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="Bem-vindo de volta"
      title="Seu painel financeiro continua daqui."
      description="Entre para acompanhar lançamentos, recorrências, metas e orçamentos conectados à IA e ao WhatsApp."
      features={["Dashboard do mês", "WhatsApp integrado", "IA para categorizar"]}
      hominho="joao"
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Acessar conta</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-[var(--navy)]">Entrar</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Acesse sua conta para continuar no Moedin.IA.</p>

      <div className="mt-7">
        <GoogleSignInButton label="Entrar com Google" />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        ou
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-[var(--text)]">E-mail</label>
          <input id="login-email" name="email" className="control" type="email" autoComplete="email" required maxLength={EMAIL_MAX} placeholder="email@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="login-senha" className="mb-2 block text-sm font-semibold text-[var(--text)]">Senha</label>
          <input id="login-senha" name="current-password" className="control" type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX} placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Link href="/recuperar-senha" className="text-sm font-bold text-[var(--brand)] hover:text-[var(--brand-strong)]">
            Esqueci minha senha
          </Link>
        </div>
        <button type="submit" disabled={loading} className="btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 disabled:opacity-70">
          {loading ? "Entrando..." : "Entrar"}
          <ArrowRight className="h-4 w-4" />
        </button>
        {message ? <div className="alert-error rounded-2xl px-4 py-3 text-sm font-semibold">{message}</div> : null}
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" />
          Ainda não tem conta?
          <Link href="/cadastro" className="font-bold text-[var(--brand)]">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
