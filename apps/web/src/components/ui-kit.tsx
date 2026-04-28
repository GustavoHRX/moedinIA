import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-[24px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)] sm:p-6",
        className
      )}
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
    <div className={cx("min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-7", className)}>
      <div className="mx-auto w-full max-w-[1680px] space-y-5">{children}</div>
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
    <header className="flex flex-col gap-4 rounded-[28px] border border-white bg-white/90 px-5 py-5 shadow-[var(--shadow-soft)] backdrop-blur sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-strong)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-black text-[var(--navy)] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-base font-medium leading-7 text-[var(--muted)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end sm:gap-3">{actions}</div> : null}
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
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-lg font-black text-[var(--navy)] sm:text-xl">{title}</h2>
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
    <Surface className={cx("min-h-[128px] p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
          <p className={cx("mt-2 truncate font-display text-3xl font-black sm:text-4xl", toneClass)}>{value}</p>
        </div>
        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)] shadow-[inset_0_0_0_1px_rgba(46,158,79,0.12)]">
            {icon}
          </div>
        ) : null}
      </div>
      {detail ? <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted)]">{detail}</p> : null}
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
      ? "bg-red-100 text-red-700"
      : tone === "brand"
      ? "bg-[var(--brand-soft)] text-[var(--brand-strong)] ring-1 ring-[rgba(46,158,79,0.16)]"
      : "bg-slate-100 text-slate-600";

  return (
    <span className={cx("inline-flex items-center rounded-full px-3 py-1.5 font-display text-xs font-extrabold", style)}>
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
      ? "rounded-[16px] bg-[var(--danger)] text-white shadow-[0_16px_30px_rgba(235,64,75,0.2)] transition hover:bg-[#d93742]"
      : tone === "ghost"
      ? "rounded-[16px] text-[var(--navy)] transition hover:bg-[var(--bg-soft)]"
      : "rounded-[16px] border border-[var(--line)] bg-white text-[var(--navy)] shadow-[0_10px_22px_rgba(26,26,26,0.06)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]";

  return (
    <button {...props} className={cx("inline-flex items-center justify-center gap-2 px-5 py-3 font-display text-sm font-extrabold", style, className)}>
      {children}
    </button>
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
      <p className="font-display text-base font-black text-[var(--navy)]">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}
