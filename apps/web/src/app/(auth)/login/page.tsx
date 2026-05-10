"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <AuthShell
      eyebrow="Bem-vindo de volta"
      title="Seu painel financeiro continua daqui."
      description="Entre para acompanhar lançamentos, recorrências, metas e orçamentos conectados à IA e ao WhatsApp."
      features={["Dashboard do mês", "WhatsApp integrado", "IA para categorizar"]}
    >
      <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Acessar conta</p>
      <h1 className="mt-3 font-display text-4xl font-black text-[var(--navy)]">Entrar</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Acesse sua conta para continuar no Moedin.IA.</p>

      <form onSubmit={handleLogin} className="mt-7 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">E-mail</label>
          <input className="control" type="email" placeholder="email@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Senha</label>
          <input className="control" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} />
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
        {message ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}
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
