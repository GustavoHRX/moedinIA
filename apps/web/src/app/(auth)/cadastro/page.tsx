"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import AuthShell from "@/components/auth-shell";
import GoogleSignInButton from "@/components/google-signin-button";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

export default function CadastroPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      setIsError(true);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });
    setLoading(false);

    if (error) {
      setMessage(translateAuthError(error.message));
      setIsError(true);
      return;
    }

    setMessage("Conta criada. Confirme seu e-mail para liberar o acesso.");
    setFullName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <AuthShell
      eyebrow="Comece agora"
      title="Finanças, IA e WhatsApp em uma rotina simples."
      description="Crie sua conta para registrar gastos em linguagem natural, acompanhar orçamento e organizar fixos, parcelas e metas."
      features={["Registro pelo WhatsApp", "Orçamentos e metas", "Histórico limpo"]}
      formMaxWidth="max-w-2xl"
      formSide="left"
      hominho="gustavo"
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-strong)]">Nova conta</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-[var(--navy)]">Criar conta</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Comece seu controle financeiro em poucos minutos.</p>

      <div className="mt-7">
        <GoogleSignInButton label="Criar conta com Google" />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        ou
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Nome</label>
            <input className="control" type="text" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Celular</label>
            <input className="control" type="text" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">E-mail</label>
          <input className="control" type="email" placeholder="email@dominio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Senha</label>
            <input className="control" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Confirmar senha</label>
            <input className="control" type="password" placeholder="********" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full px-5 py-3.5 disabled:opacity-70">
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
        {message ? (
          <div className={isError ? "alert-error rounded-2xl px-4 py-3 text-sm font-semibold" : "alert-info rounded-2xl px-4 py-3 text-sm font-semibold"}>
            {message}
          </div>
        ) : null}
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" />
          Já tem conta?
          <Link href="/login" className="font-bold text-[var(--brand)]">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
