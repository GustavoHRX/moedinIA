import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Surface({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={cx(
        "rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)] transition-colors duration-[var(--dur-fast)] hover:border-[rgba(16,185,129,0.32)] sm:p-6",
        className
      )}
      style={style}
    >
      {children}
    </section>
  );
}

export function PageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8", className)}>
      <div className="mx-auto w-full max-w-[1720px] space-y-6">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="relative overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-5 py-5 shadow-[var(--shadow-soft)] sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,var(--brand-glow),transparent_30rem)] opacity-70" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-strong)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-base font-medium leading-7 text-[var(--muted)]">{description}</p>
        </div>
        {actions ? <div className="flex w-full min-w-0 flex-wrap gap-2 sm:justify-end sm:gap-3 lg:w-auto">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  action,
  eyebrow,
}: {
  title: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-xl font-bold text-[var(--navy)] sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "neutral",
  detail,
  icon,
  className,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger" | "brand";
  detail?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "danger"
        ? "text-[var(--danger)]"
        : tone === "brand"
          ? "text-[var(--brand-strong)]"
          : "text-[var(--navy)]";

  return (
    <Surface className={cx("min-h-[136px] p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
          <p className={cx("money mt-2 truncate text-3xl sm:text-[2.4rem]", toneClass)}>{value}</p>
        </div>
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]">
            {icon}
          </div>
        ) : null}
      </div>
      {detail ? <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted)]">{detail}</p> : null}
    </Surface>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "brand";
}) {
  const style =
    tone === "success"
      ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
      : tone === "danger"
        ? "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger)]"
        : tone === "brand"
          ? "bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-1 ring-[rgba(16,185,129,0.16)]"
          : "bg-[var(--bg-soft)] text-[var(--muted-strong)]";

  return (
    <span className={cx("inline-flex items-center rounded-full px-3 py-1.5 font-display text-xs font-semibold", style)}>
      {children}
    </span>
  );
}

export function ActionButton({
  children,
  tone = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const style =
    tone === "primary"
      ? "btn-primary"
      : tone === "danger"
        ? "rounded-[16px] bg-[var(--danger)] text-white shadow-[0_16px_30px_rgba(235,64,75,0.2)] transition hover:brightness-105"
        : tone === "ghost"
          ? "rounded-[16px] text-[var(--navy)] transition hover:bg-[var(--bg-soft)]"
          : "btn-secondary";

  return (
    <button {...props} className={cx("inline-flex items-center justify-center gap-2 px-5 py-3 font-display text-sm font-semibold", style, className)}>
      {children}
    </button>
  );
}

export function Alert({
  children,
  type = "info",
}: {
  children: ReactNode;
  type?: "success" | "error" | "info";
}) {
  const style =
    type === "success"
      ? "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--primary-soft)] text-[var(--success)]"
      : type === "error"
        ? "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)]"
        : "border-[rgba(16,185,129,0.25)] bg-[var(--brand-soft)] text-[var(--brand-strong)]";

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm font-semibold", style)}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-[var(--bg-soft)] p-6">
      <p className="font-display text-base font-bold text-[var(--navy)]">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}
