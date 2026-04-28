"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CadastroPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
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
      setMessage(error.message);
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
    <main className="grid min-h-screen bg-[var(--bg)] lg:grid-cols-[0.92fr_1fr]">
      <section className="flex items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-2xl rounded-[28px] border border-white bg-white/86 p-6 shadow-[var(--shadow-strong)] backdrop-blur sm:p-8">
          <Link href="/" className="mb-8 inline-flex">
            <Image src="/moedinha.png" alt="Moedin.IA" width={160} height={42} className="h-10 w-auto" priority />
          </Link>
          <h1 className="font-display text-4xl font-black text-[var(--navy)]">Criar conta</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Comece seu controle financeiro em poucos minutos.
          </p>

      <form onSubmit={handleRegister} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Nome</label>
            <input
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
              type="text"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Celular</label>
            <input
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
              type="text"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--text)]">
              Confirmar senha
            </label>
            <input
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
              type="password"
              placeholder="********"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full px-5 py-3 disabled:opacity-70"
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </button>

        {message ? (
          <div className="alert-info rounded-2xl px-4 py-3 text-sm">
            {message}
          </div>
        ) : null}

        <p className="text-sm text-[var(--muted)]">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-[var(--brand)]">
            Entrar
          </Link>
        </p>
      </form>
        </div>
      </section>

      <section className="hidden bg-[#1A1A1A] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.08] p-5">
          <Image src="/moedinhagrande.png" alt="IA" width={58} height={58} className="mb-5 h-14 w-14 rounded-full bg-white/90 p-1" />
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-white/86">Moedin.IA</p>
          <h2 className="mt-3 font-display text-4xl font-black leading-tight">Finanças, IA e WhatsApp em uma rotina simples.</h2>
        </div>
        <div className="grid gap-3">
          {["Registre gastos em linguagem natural", "Acompanhe orçamentos e metas", "Separe fixos, parcelas e histórico limpo"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-sm font-extrabold text-white">{item}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
