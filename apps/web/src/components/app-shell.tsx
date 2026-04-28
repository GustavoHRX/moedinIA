"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  History,
  LayoutDashboard,
  MessageCircle,
  Repeat2,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/logout-button";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/planejamento-mensal", label: "Planejamento", icon: CalendarDays },
  { href: "/gastos-fixos", label: "Gastos fixos", icon: Repeat2 },
  { href: "/parcelamentos", label: "Parcelamentos", icon: CreditCard },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/perfil", label: "Conta", icon: UserRound },
];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen pb-20 md:pb-0">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[304px] flex-col border-r border-white/70 bg-[#f2f2f2]/92 shadow-[18px_0_60px_rgba(26,26,26,0.08)] backdrop-blur-xl md:flex">
        <div className="px-5 pb-5 pt-6">
          <div className="rounded-[28px] border border-white bg-white/88 p-5 shadow-[var(--shadow-soft)]">
            <Image
              src="/moedinha.png"
              alt="Moedin.IA"
              width={252}
              height={62}
              className="h-14 w-auto object-contain"
              priority
            />
            <p className="mt-3 font-display text-base font-extrabold text-[var(--navy)]">
              Assistente financeiro inteligente
            </p>
            <div className="mt-3 inline-flex rounded-full bg-[var(--brand-soft)] px-3 py-1.5 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--brand-strong)] ring-1 ring-[rgba(46,158,79,0.16)]">
              Finance + IA
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 px-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const NavIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "flex items-center gap-3 rounded-2xl border border-[rgba(46,158,79,0.25)] bg-white px-3.5 py-3 font-display text-sm font-extrabold text-[var(--navy)] shadow-[0_14px_30px_rgba(26,26,26,0.1)]"
                    : "flex items-center gap-3 rounded-2xl px-3.5 py-3 font-display text-sm font-bold text-[#2d332f] transition hover:bg-white/86 hover:text-[var(--brand-strong)]"
                }
              >
                <span className={isActive ? "flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "flex h-9 w-9 items-center justify-center rounded-xl bg-white/72 text-[#17251f]"}>
                  <NavIcon className="h-4 w-4" strokeWidth={2.4} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/70 p-4">
          <div className="mb-3 rounded-[20px] border border-[rgba(46,158,79,0.18)] bg-[var(--brand-soft)] p-3">
            <p className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--brand-strong)]">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--navy)]">Registre gastos por texto natural.</p>
          </div>
          <LogoutButton className="flex w-full items-center justify-center rounded-2xl border border-[var(--line)] bg-white px-3 py-3 text-sm font-extrabold text-[#17251f] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" />
        </div>
      </aside>

      <div className="md:pl-[304px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/70 bg-white/86 px-4 shadow-[0_10px_28px_rgba(8,36,29,0.06)] backdrop-blur sm:px-6 md:hidden">
          <Image
            src="/moedinha.png"
            alt="Moedin.IA"
            width={178}
            height={38}
            className="h-9 w-auto object-contain"
            priority
          />
          <LogoutButton />
        </header>
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/70 bg-white/94 px-2 py-2 shadow-[0_-12px_30px_rgba(8,36,29,0.08)] backdrop-blur md:hidden">
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const NavIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "whitespace-nowrap rounded-xl bg-[#1A1A1A] px-3 py-2 font-display text-xs font-extrabold text-white"
                    : "whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold text-[var(--muted)]"
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <NavIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
