"use client";

import Link from "next/link";
import {
  CreditCard,
  History,
  LayoutDashboard,
  Menu,
  Repeat2,
  Tag,
  Target,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/logout-button";
import NotificationBell from "@/components/notification-bell";
import { useAppData } from "@/components/app-data-provider";
import ThemeToggle from "@/components/theme-toggle";
import ThemedLogo from "@/components/themed-logo";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/fixos", label: "Fixos", icon: Repeat2 },
  { href: "/parcelamentos", label: "Parcelamentos", icon: CreditCard },
  { href: "/categorias", label: "Categorias", icon: Tag },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/perfil", label: "Conta", icon: UserRound },
];

function NavList({
  pathname,
  collapsible = false,
  onNavigate,
}: {
  pathname: string;
  collapsible?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="scrollbar-none flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-2">
      {navItems.map((item, index) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const NavIcon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={onNavigate}
            title={collapsible ? item.label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={
              "rail-item relative flex items-center gap-3 rounded-md px-2 py-2 font-display text-sm font-medium transition-colors " +
              (isActive
                ? "text-primary-strong"
                : "text-fg-muted hover:bg-surface-strong hover:text-fg")
            }
          >
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
              />
            ) : null}
            <span
              className={
                "rail-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-md " +
                (isActive ? "bg-primary text-on-primary" : "bg-bg-soft text-fg-muted")
              }
            >
              <NavIcon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span
              className={collapsible ? "rail-label" : undefined}
              style={collapsible ? { transitionDelay: `${Math.min(index * 22, 120)}ms` } : undefined}
            >
              {item.label}
            </span>
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
    // Depois de navegar, o <Link> clicado fica com foco e o rail continua
    // aberto por causa do `focus-within`. Tira o foco para ele recolher.
    const active = document.activeElement as HTMLElement | null;
    if (active && active.closest("aside.rail")) active.blur();
  }, [pathname]);

  return (
    <main className="min-h-screen bg-[var(--shell-gradient)]">
      {/* Rail lateral: 72px de ícones, abre para 224px no hover/foco.
          Vidro fosco translúcido — o conteúdo transparece por trás.
          overflow-hidden corta os rótulos enquanto está recolhido. */}
      <aside className="rail group fixed left-0 top-0 z-40 hidden h-screen w-[72px] flex-col overflow-hidden border-r border-line bg-surface-glass backdrop-blur-xl hover:w-[224px] hover:shadow-pop focus-within:w-[224px] md:flex">
        <div className="shrink-0 px-2 pb-3 pt-4">
          <Link href="/dashboard" aria-label="Ir para o dashboard" className="relative flex h-10 items-center">
            <span className="rail-symbol absolute left-2 flex h-9 w-9 items-center justify-center">
              <ThemedLogo variant="symbol" className="h-9 w-9" priority />
            </span>
            <span className="rail-label absolute left-2">
              <ThemedLogo className="h-9 w-[116px]" priority />
            </span>
          </Link>
          <p className="rail-label mt-2.5 truncate px-2 text-xs font-normal text-fg-muted">
            {displayName}
          </p>
        </div>

        <NavList pathname={pathname} collapsible />

        <div className="shrink-0 space-y-1 border-t border-line p-2">
          <div className="rail-item flex items-center gap-3 rounded-md px-2 py-1.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <NotificationBell
                openUpward
                className="rail-icon inline-flex h-9 w-9 items-center justify-center rounded-md bg-bg-soft text-fg-muted transition hover:text-primary-strong"
              />
            </span>
            <span className="rail-label text-sm font-medium text-fg-muted">Avisos</span>
          </div>
          <div className="rail-item flex items-center gap-3 rounded-md px-2 py-1.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <ThemeToggle
                showLabel={false}
                className="rail-icon inline-flex h-9 w-9 items-center justify-center rounded-md bg-bg-soft text-fg-muted transition hover:text-primary-strong"
              />
            </span>
            <span className="rail-label text-sm font-medium text-fg-muted">Tema</span>
          </div>
          <LogoutButton
            labelClassName="rail-label"
            className="rail-item flex w-full items-center gap-3 whitespace-nowrap rounded-md py-2 pl-[19px] text-sm font-medium text-fg-muted transition hover:bg-danger/10 hover:text-danger"
          />
        </div>
      </aside>

      <div className="md:pl-[72px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface-glass px-4 backdrop-blur-xl sm:px-6 md:hidden">
          <Link href="/dashboard" aria-label="Ir para o dashboard">
            <ThemedLogo className="h-[51px] w-[150px]" priority />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-fg"
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-4 w-4" />
            </button>
            <NotificationBell className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-fg" />
            <ThemeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-fg" showLabel={false} />
            <LogoutButton className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg" />
          </div>
        </header>
        {children}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(84vw,320px)] flex-col border-r border-line bg-surface-glass shadow-modal backdrop-blur-xl">
            <div className="shrink-0 px-5 pb-4 pt-5">
              <div className="flex items-center justify-between gap-4">
                <Link href="/dashboard" aria-label="Ir para o dashboard" onClick={() => setMobileOpen(false)}>
                  <ThemedLogo className="h-[58px] w-[170px]" priority />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-fg"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="shrink-0 space-y-2 border-t border-line p-4">
              <ThemeToggle className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-sm font-medium text-fg" />
              <LogoutButton className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-sm font-medium text-fg" />
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
