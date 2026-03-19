"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Sparkles,
  Target,
} from "lucide-react";
import UserMenuButton from "./UserMenuButton";

const itens = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/gastos", label: "Lançamentos", icon: Receipt },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/relatorios", label: "Gráficos", icon: BarChart3 },
  { href: "/ajuda-ia", label: "Ajuda com IA", icon: Sparkles },
];

export default function DashboardHeader() {
  const pathname = usePathname();
  const [nomeUsuario, setNomeUsuario] = useState("Usuário");

  useEffect(() => {
    carregarUsuario();
  }, []);

  async function carregarUsuario() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const resposta = await fetch("http://localhost:8000/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) return;

      const dados = await resposta.json();
      if (dados?.nome) {
        setNomeUsuario(dados.nome);
      }
    } catch {
      // silencioso
    }
  }

  return (
    <header className="w-full border-b border-[var(--border)] bg-white">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-sm font-bold">
            IA
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-zinc-900">MOEDIN.IA</h1>
            <span className="rounded-md bg-[#2E9E4F] px-2 py-1 text-xs font-semibold text-white">
              IA Financeira
            </span>
          </div>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {itens.map((item) => {
            const Icon = item.icon;
            const ativo = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  ativo
                    ? "bg-[#2E9E4F]/15 text-[#2E9E4F]"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <UserMenuButton nome={nomeUsuario} />
      </div>
    </header>
  );
}