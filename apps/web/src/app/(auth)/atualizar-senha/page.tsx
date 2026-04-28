"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AtualizarSenhaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Senha atualizada com sucesso. Redirecionando...");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--text)]">Atualizar senha</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Defina uma nova senha para continuar usando sua conta.
      </p>

      <form onSubmit={handleUpdate} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">Nova senha</label>
          <input
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text)]">
            Confirmar nova senha
          </label>
          <input
            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--ring)]"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full px-5 py-3 disabled:opacity-70"
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>

        {message ? (
          <div className="alert-info rounded-2xl px-4 py-3 text-sm">
            {message}
          </div>
        ) : null}
      </form>
    </div>
  );
}
