import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import ThemedLogo from "@/components/themed-logo";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  features: string[];
  formMaxWidth?: string;
  formSide?: "left" | "right";
  spotlightTitle?: string;
  spotlightText?: string;
};

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  features,
  formMaxWidth = "max-w-md",
  formSide = "right",
  spotlightTitle = "Finance + IA",
  spotlightText = "Organize gastos, metas, fixos e parcelas com uma rotina simples conectada ao WhatsApp.",
}: AuthShellProps) {
  const formOrder = formSide === "left" ? "lg:order-1" : "lg:order-2";
  const heroOrder = formSide === "left" ? "lg:order-2" : "lg:order-1";
  const heroBorder = formSide === "left" ? "lg:border-l" : "lg:border-r";

  return (
    <main className="min-h-screen bg-[var(--shell-gradient)] px-4 py-4 sm:px-6 lg:px-0 lg:py-0">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--surface-muted)] shadow-[var(--shadow-strong)] backdrop-blur-xl lg:min-h-screen lg:grid-cols-[1fr_0.92fr] lg:rounded-none lg:border-0">
        <section className={`${heroOrder} ${heroBorder} hidden overflow-hidden border-[var(--line)] bg-[var(--surface)] p-10 lg:flex lg:flex-col lg:justify-between`}>
          <div className="flex items-center justify-between gap-6">
            <Link href="/" className="inline-flex">
              <ThemedLogo className="h-[72px] w-[210px]" priority />
            </Link>
            <ThemeToggle />
          </div>

          <div className="relative max-w-2xl py-12">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--brand-glow)] blur-3xl" />
            <ThemedLogo
              variant="symbol"
              className="relative mb-6 h-16 w-16 rounded-3xl bg-[var(--brand-soft)] p-2 ring-1 ring-[var(--line)]"
            />
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-strong)]">{eyebrow}</p>
            <h1 className="mt-4 font-display text-5xl font-black leading-tight text-[var(--navy)] xl:text-6xl">{title}</h1>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-[var(--muted)]">{description}</p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-strong)]">{spotlightTitle}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">{spotlightText}</p>
                </div>
                <span className="rounded-2xl bg-[var(--brand-soft)] px-3 py-2 text-sm font-black text-[var(--brand-strong)]">IA</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {features.map((item) => (
                <div
                  key={item}
                  className="flex min-h-24 items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm font-extrabold leading-5 text-[var(--navy)] shadow-[var(--shadow-soft)]"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${formOrder} flex items-center justify-center px-2 py-6 sm:px-6 lg:px-10`}>
          <div className={`w-full ${formMaxWidth} rounded-[30px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-strong)] backdrop-blur-xl sm:p-8`}>
            <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
              <Link href="/" className="inline-flex">
                <ThemedLogo className="h-[65px] w-[190px]" priority />
              </Link>
              <ThemeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)]" showLabel={false} />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
