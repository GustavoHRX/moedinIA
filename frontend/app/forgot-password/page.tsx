"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  function enviar(e: FormEvent) {
    e.preventDefault();
    setCarregando(true);

    setTimeout(() => {
      setMensagem(
        "Solicitação registrada. No próximo passo vamos conectar essa tela ao envio real por email."
      );
      setCarregando(false);
    }, 700);
  }

  return (
    <main className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#2E9E4F] text-lg font-bold text-white">
            IA
          </div>

          <h1 className="text-3xl font-extrabold text-zinc-900">
            Recuperar senha
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Informe seu email para receber instruções de recuperação
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-4">
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

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-2xl bg-[#2E9E4F] py-3 font-semibold text-white transition hover:bg-[#277F40] disabled:opacity-60"
          >
            {carregando ? "Enviando..." : "Enviar recuperação"}
          </button>
        </form>

        {mensagem && (
          <div className="mt-4 rounded-2xl bg-[#2E9E4F]/10 px-4 py-3 text-sm text-zinc-700">
            {mensagem}
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-500">
            Lembrou sua senha?{" "}
            <Link href="/" className="font-medium text-[#2E9E4F]">
              Voltar para o login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}