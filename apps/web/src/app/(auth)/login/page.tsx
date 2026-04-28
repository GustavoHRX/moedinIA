"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className="grid min-h-screen bg-[var(--bg)] lg:grid-cols-[1fr_0.92fr]">
      <section className="hidden bg-[#1A1A1A] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="inline-flex w-fit">
          <span className="rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
            <Image src="/moedinha.png" alt="Moedin.IA" width={220} height={54} className="h-12 w-auto" priority />
          </span>
        </Link>
        <div className="max-w-xl">
          <Image src="/moedinhagrande.png" alt="IA" width={58} height={58} className="mb-5 h-14 w-14 rounded-full bg-white/90 p-1" />
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-white/86">Bem-vindo de volta</p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight">Seu painel financeiro continua daqui.</h1>
          <p className="mt-5 text-lg font-semibold leading-8 text-white/88">
            Entre para acompanhar lançamentos, recorrências, metas e orçamentos conectados à IA e ao WhatsApp.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["Dashboard", "WhatsApp", "IA"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-sm font-extrabold text-white">{item}</div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md rounded-[28px] border border-white bg-white/86 p-6 shadow-[var(--shadow-strong)] backdrop-blur sm:p-8">
          <Link href="/" className="mb-8 inline-flex lg:hidden">
            <Image src="/moedinha.png" alt="Moedin.IA" width={160} height={42} className="h-10 w-auto" priority />
          </Link>
          <h1 className="font-display text-4xl font-black text-[var(--navy)]">Entrar</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Acesse sua conta para continuar no Moedin.IA.
          </p>

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">E-mail</label>
          <input
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
            type="email"
            placeholder="email@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Senha</label>
          <input
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/recuperar-senha"
            className="text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-strong)]"
          >
            Esqueci minha senha
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full px-5 py-3 disabled:opacity-70"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <p className="text-sm text-[var(--muted)]">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-[var(--brand)]">
            Criar conta
          </Link>
        </p>
      </form>
        </div>
      </section>
    </main>
  );
}
