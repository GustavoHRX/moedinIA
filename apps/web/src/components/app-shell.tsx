"use client";

import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  Crown,
  History,
  LayoutDashboard,
  Menu,
  Repeat2,
  Target,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/logout-button";
import { useAppData } from "@/components/app-data-provider";
import ThemeToggle from "@/components/theme-toggle";
import ThemedLogo from "@/components/themed-logo";

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
  { href: "/planos", label: "Planos", icon: Crown },
  { href: "/perfil", label: "Conta", icon: UserRound },
];

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="scrollbar-none flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-4 pb-3">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const NavIcon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={onNavigate}
            className={
              isActive
                ? "flex items-center gap-3 rounded-2xl border border-[rgba(46,158,79,0.32)] bg-[var(--brand-soft)] px-3.5 py-3 font-display text-sm font-extrabold text-[var(--brand-strong)] shadow-[var(--shadow-soft)]"
                : "flex items-center gap-3 rounded-2xl px-3.5 py-3 font-display text-sm font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--brand-strong)]"
            }
          >
            <span
              className={
                isActive
                  ? "flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-white shadow-[0_12px_24px_var(--brand-glow)]"
                  : "flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-soft)] text-[var(--muted-strong)]"
              }
            >
              <NavIcon className="h-4 w-4" strokeWidth={2.4} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, user } = useAppData();
  const displayName =
    profile?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "Moedin.IA";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <main className="min-h-screen bg-[var(--shell-gradient)]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[308px] flex-col border-r border-[var(--line)] bg-[var(--surface)] shadow-[18px_0_60px_rgba(26,26,26,0.08)] backdrop-blur-xl md:flex">
        <div className="shrink-0 px-5 pb-4 pt-5">
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[rgba(46,158,79,0.08)]">
            <ThemedLogo className="h-[54px] w-[160px]" priority />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-[var(--muted)]">
                {displayName}
              </p>
              <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-strong)] ring-1 ring-[rgba(46,158,79,0.16)]">
                Finance + IA
              </span>
            </div>
          </div>
        </div>

        <NavList pathname={pathname} />

        <div className="shrink-0 space-y-3 border-t border-[var(--line)] p-4">
          <ThemeToggle className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-3 text-sm font-extrabold text-[var(--text)] transition hover:border-[var(--brand)]" />
          <LogoutButton className="flex w-full items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-3 text-sm font-extrabold text-[var(--text)] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" />
        </div>
      </aside>

      <div className="md:pl-[308px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 shadow-[0_10px_28px_rgba(8,36,29,0.06)] backdrop-blur sm:px-6 md:hidden">
          <ThemedLogo className="h-[51px] w-[150px]" priority />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)]"
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-4 w-4" />
            </button>
            <ThemeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)]" showLabel={false} />
            <LogoutButton />
          </div>
        </header>
        {children}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(88vw,340px)] flex-col border-r border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-strong)] backdrop-blur-xl">
            <div className="shrink-0 px-5 pb-4 pt-5">
              <div className="flex items-center justify-between gap-4">
                <ThemedLogo className="h-[65px] w-[190px]" priority />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)]"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="shrink-0 px-5 pb-4">
              <div className="rounded-2xl border border-[rgba(46,158,79,0.18)] bg-[var(--brand-soft)] px-4 py-3">
                <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--brand-strong)]">Finance + IA</p>
                <p className="mt-1 text-sm font-bold text-[var(--navy)]">Seu painel financeiro inteligente.</p>
              </div>
            </div>
            <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="shrink-0 space-y-3 border-t border-[var(--line)] p-4">
              <ThemeToggle className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-3 text-sm font-extrabold text-[var(--text)]" />
              <LogoutButton className="flex w-full items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-3 text-sm font-extrabold text-[var(--text)]" />
            </div>
          </aside>
        </div>
      ) : null}

    </main>
  );
}
