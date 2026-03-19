"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function fazerLogin(e: FormEvent) {
    e.preventDefault();
    setMensagem("");
    setCarregando(true);

    try {
      const resposta = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setMensagem(dados.detail || "Erro ao fazer login");
        return;
      }

      localStorage.setItem("token", dados.access_token);
      localStorage.setItem("email", email);

      window.location.href = "/dashboard";
    } catch {
      setMensagem("Erro ao conectar com o servidor");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#2E9E4F] text-lg font-bold text-white">
            IA
          </div>

          <h1 className="text-3xl font-extrabold text-zinc-900">MOEDIN.IA</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Faça login para acessar seu painel financeiro
          </p>
        </div>

        <form onSubmit={fazerLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Email
            </label>
            <input
              type="email"
              placeholder="Digite seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 outline-none transition focus:border-[#2E9E4F]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Senha
            </label>
            <input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 outline-none transition focus:border-[#2E9E4F]"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-2xl bg-[#2E9E4F] py-3 font-semibold text-white transition hover:bg-[#277F40] disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {mensagem && (
          <p className="mt-4 text-center text-sm text-red-500">{mensagem}</p>
        )}

        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-zinc-500">
            Ainda não tem conta?{" "}
            <Link href="/register" className="font-medium text-[#2E9E4F]">
              Cadastre-se
            </Link>
          </p>

          <p className="text-sm text-zinc-500">
            <Link href="/forgot-password" className="underline text-zinc-700">
              Esqueci minha senha
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}