"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Target,
  CreditCard,
  BarChart3,
  LogOut,
} from "lucide-react";

const itens = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gastos", label: "Gastos", icon: Wallet },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/cartao", label: "Cartão", icon: CreditCard },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("cpf");
    window.location.href = "/";
  }

  return (
    <aside className="w-full lg:w-64 bg-zinc-900 border-r border-zinc-800 p-4 lg:min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#2E9E4F]">Moedin.IA</h1>
        <p className="text-zinc-400 text-sm">Seu controle financeiro inteligente</p>
      </div>

      <nav className="space-y-2">
        {itens.map((item) => {
          const Icon = item.icon;
          const ativo = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                ativo
                  ? "bg-[#2E9E4F]/15 text-[#2E9E4F] border border-[#2E9E4F]/30"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Icon size={18} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={sair}
        className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 px-4 py-3 font-semibold transition"
      >
        <LogOut size={18} />
        Sair
      </button>
    </aside>
  );
}