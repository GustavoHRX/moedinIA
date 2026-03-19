"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    setMensagem("");

    if (!nome || !telefone || !email || !password) {
      setMensagem("Preencha todos os campos.");
      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch("http://localhost:8000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          telefone,
          email,
          password,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setMensagem(dados.detail || "Erro ao cadastrar");
        return;
      }

      localStorage.setItem("token", dados.access_token);
      window.location.href = "/dashboard";
    } catch (error) {
      setMensagem("Erro ao conectar com o servidor");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#2E9E4F] text-lg font-bold text-white">
            IA
          </div>

          <h1 className="text-3xl font-extrabold text-zinc-900">Criar conta</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Cadastre-se para começar a usar o Moedin.IA
          </p>
        </div>

        <form onSubmit={cadastrar} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Nome completo
            </label>
            <input
              type="text"
              placeholder="Digite seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Celular
            </label>
            <input
              type="text"
              placeholder="Digite seu celular"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Email
            </label>
            <input
              type="email"
              placeholder="Digite seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Senha
            </label>
            <input
              type="password"
              placeholder="Crie uma senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 outline-none focus:border-[#2E9E4F]"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-2xl bg-[#2E9E4F] py-3 font-semibold text-white transition hover:bg-[#277F40] disabled:opacity-60"
          >
            {carregando ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>

        {mensagem && (
          <p className="mt-4 text-center text-sm text-red-500">{mensagem}</p>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500">
          Já tem conta?{" "}
          <Link href="/" className="font-medium text-[#2E9E4F]">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}