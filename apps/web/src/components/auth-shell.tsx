import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import ThemedLogo from "@/components/themed-logo";
import { Hominho, HOMINHO_LABEL, type HominhoName } from "@/components/hominhos";

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
  hominho?: HominhoName;
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
  hominho = "joao",
}: AuthShellProps) {
  const formOrder = formSide === "left" ? "lg:order-1" : "lg:order-2";
  const heroOrder = formSide === "left" ? "lg:order-2" : "lg:order-1";
  const heroBorder = formSide === "left" ? "lg:border-l" : "lg:border-r";

  return (
    <main className="min-h-screen bg-[var(--shell-gradient)] px-4 py-4 sm:px-6 lg:px-0 lg:py-0">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-lg border border-line bg-bg-soft backdrop-blur-xl lg:min-h-screen lg:grid-cols-[1fr_0.92fr] lg:rounded-none lg:border-0">
        <section className={`${heroOrder} ${heroBorder} hidden overflow-hidden border-line bg-surface p-10 lg:flex lg:flex-col lg:justify-between`}>
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
              className="relative mb-6 h-16 w-16 rounded-lg bg-primary-soft p-2 ring-1 ring-line"
            />
            <p className="eyebrow">{eyebrow}</p>
            {/* Texto promocional do painel lateral — NÃO é o heading da página
                (esse é o <h1> dentro do formulário). Evita dois <h1> por página. */}
            <p className="mt-4 font-display text-5xl font-semibold leading-tight text-fg xl:text-6xl">{title}</p>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-fg-muted">{description}</p>
          </div>

          <div className="grid gap-4">
            <div className="anim-coin-flip flex items-start gap-4 rounded-lg border border-line bg-surface-strong p-5">
              <Hominho name={hominho} size={44} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="eyebrow">
                  {HOMINHO_LABEL[hominho]} · {spotlightTitle}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-fg-muted">{spotlightText}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {features.map((item) => (
                <div
                  key={item}
                  className="flex min-h-24 items-start gap-3 rounded-md border border-line bg-surface-strong p-4 text-sm font-semibold leading-5 text-fg"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${formOrder} flex items-center justify-center px-2 py-6 sm:px-6 lg:px-10`}>
          <div className={`w-full ${formMaxWidth} rounded-lg border border-line bg-surface p-6 backdrop-blur-xl sm:p-8`}>
            <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
              <Link href="/" className="inline-flex">
                <ThemedLogo className="h-[65px] w-[190px]" priority />
              </Link>
              <ThemeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface-strong text-fg" showLabel={false} />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
