"use client";

import { FormEvent, useState } from "react";

export default function Home() {
  const [telefone, setTelefone] = useState("");
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
          telefone,
          password,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setMensagem(dados.detail || "Erro ao fazer login");
        setCarregando(false);
        return;
      }

      localStorage.setItem("token", dados.access_token);
      localStorage.setItem("telefone", telefone);

      setMensagem("Login realizado com sucesso!");
      window.location.href = "/dashboard";
    } catch (erro) {
      setMensagem("Erro ao conectar com o servidor");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl shadow-xl p-6 border border-zinc-800">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-emerald-400">Moedin.IA</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Controle financeiro pessoal com IA
          </p>
        </div>

        <form onSubmit={fazerLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Telefone</label>
            <input
              type="text"
              placeholder="Digite seu telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-zinc-300">Senha</label>
            <input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-emerald-500 hover:bg-emerald-600 transition rounded-xl py-3 font-semibold text-black disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {mensagem && (
          <p className="text-center text-sm mt-4 text-zinc-300">{mensagem}</p>
        )}

        <p className="text-center text-sm text-zinc-400 mt-6">
          Use o usuário que você cadastrou no Swagger
        </p>
      </div>
    </main>
  );
}