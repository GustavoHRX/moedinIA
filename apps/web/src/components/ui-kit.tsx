import type { ReactNode } from "react";

/*
 * Primitivos partilhados do painel.
 *
 * Regra do sistema (docs/design/hominhos/design-philosophy.md): "um ou dois
 * atributos, jamais três". Cada elemento pode ter no máximo DOIS de: borda,
 * preenchimento, sombra, brilho, peso forte. Antes o Surface tinha quatro ao
 * mesmo tempo (borda + fundo translúcido + borrão de 44px + brilho no hover)
 * e o conteúdo era todo a 600 — era esse o "poluído".
 *
 * Elevação é feita por LINHA e por degrau de fundo, nunca por sombra. Só o
 * modal e o popover têm sombra (shadow-modal / shadow-pop).
 */

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Contentores                                                                */
/* -------------------------------------------------------------------------- */

export function Surface({
  children,
  className,
  style,
  tone = "default",
  interactive = false,
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** `muted` = tile interior sem borda (absorve os antigos mini-cards). */
  tone?: "default" | "muted";
  /** Card clicável — ganha o cursor de ponteiro. */
  interactive?: boolean;
  /** Neon verde no hover. Ligado por omissão (pedido do utilizador: no sistema todo). */
  glow?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-lg p-4 sm:p-5",
        tone === "muted" ? "bg-bg-soft" : "border border-line bg-surface",
        glow && tone !== "muted" && "glow-card",
        interactive && "cursor-pointer",
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
    <div className={cx("min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-7", className)}>
      {/* Dois ritmos e só dois: 20px entre blocos, 12px dentro de um bloco. */}
      <div className="mx-auto w-full max-w-app space-y-5">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cabeçalhos                                                                 */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** @deprecated O rótulo maiúsculo foi removido — o título basta. */
  eyebrow?: string;
}) {
  return (
    <header className="glow-card relative overflow-hidden rounded-lg border border-line bg-surface px-5 py-4 sm:px-6 sm:py-5">
      {/* O único brilho decorativo permitido, uma vez por página. */}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--hero-glow)]" />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight text-fg sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm font-normal leading-6 text-fg-muted">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 flex-wrap gap-2 sm:justify-end lg:w-auto">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** @deprecated O rótulo maiúsculo foi removido — o título basta. */
  eyebrow?: string;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-sm font-normal text-fg-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Rótulo pequeno em maiúsculas. Usar com muita parcimónia — no dashboard
 *  existiam 14 destes, com 3 valores de tracking diferentes. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/* -------------------------------------------------------------------------- */
/* Segmentado (Entradas / Saídas)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Controlo segmentado — o organizador de vista (padrão Porquim).
 * `tone` pinta o segmento ativo: "income" verde, "expense" coral, "neutral".
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: ReactNode; tone?: "income" | "expense" | "neutral" }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx("flex gap-1 rounded-lg border border-line bg-bg-soft p-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const tone = opt.tone ?? "neutral";
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 font-display text-sm font-medium transition-colors",
              active
                ? tone === "income"
                  ? "bg-surface text-income"
                  : tone === "expense"
                    ? "bg-surface text-expense"
                    : "bg-surface text-fg"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ícone                                                                      */
/* -------------------------------------------------------------------------- */

const ICON_BOX = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

/**
 * Caixa de ícone. Substitui 9 reimplementações à mão que usavam 5 tamanhos
 * (h-8/11/12/14/16) e 4 raios diferentes.
 */
export function IconBox({
  children,
  size = "md",
  shape = "square",
  tone = "muted",
  color,
  className,
}: {
  children: ReactNode;
  size?: keyof typeof ICON_BOX;
  shape?: "square" | "circle";
  tone?: "brand" | "muted" | "solid" | "custom";
  /** Só para tone="custom" — cor da categoria. */
  color?: string;
  className?: string;
}) {
  const toneClass =
    tone === "brand"
      ? "bg-primary/10 text-primary-strong"
      : tone === "solid"
        ? "bg-primary text-on-primary"
        : tone === "custom"
          ? ""
          : "bg-bg-soft text-fg-muted";

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center",
        ICON_BOX[size],
        shape === "circle" ? "rounded-full" : "rounded-md",
        toneClass,
        className
      )}
      style={tone === "custom" && color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Números                                                                    */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  tone = "neutral",
  detail,
  icon,
  className,
}: {
  label: string;
  /** ReactNode para aceitar <Money size="xl" /> directamente. */
  value: ReactNode;
  tone?: "neutral" | "success" | "danger" | "brand";
  detail?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-income"
      : tone === "danger"
        ? "text-expense"
        : tone === "brand"
          ? "text-primary-strong"
          : "text-fg";

  return (
    <Surface className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-normal text-fg-muted">{label}</p>
          <p className={cx("money mt-1 truncate text-2xl font-semibold sm:text-3xl", toneClass)}>{value}</p>
        </div>
        {icon ? (
          <IconBox tone="brand" size="md">
            {icon}
          </IconBox>
        ) : null}
      </div>
      {detail ? <p className="mt-2 text-sm font-normal leading-6 text-fg-muted">{detail}</p> : null}
    </Surface>
  );
}

/** Irmão pequeno do StatCard, para tiles dentro de um card.
 *  Substitui as 4 versões diferentes de mini-tile espalhadas pelas páginas. */
export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cx("rounded-md bg-bg-soft px-3 py-2.5", className)}>
      <p className="text-xs font-normal text-fg-muted">{label}</p>
      <p className="money mt-0.5 truncate text-base font-semibold text-fg">{value}</p>
      {hint ? <p className="mt-0.5 text-xs font-normal text-fg-soft">{hint}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Linha de lista                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Linha de lista. Substitui 3 variantes quase idênticas que diferiam só no
 * raio (16/18/16px) e no alfa da sombra (0.04 vs 0.05).
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  className,
  highlight = false,
  glow = false,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  highlight?: boolean;
  /** Linhas clicáveis podem acender no hover. */
  glow?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-md border border-line px-4 py-3",
        glow ? "glow-card" : "transition-colors",
        highlight && "anim-flash-in",
        className
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-fg">{title}</div>
        {subtitle ? <div className="mt-0.5 truncate text-xs font-normal text-fg-muted">{subtitle}</div> : null}
      </div>
      {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Controlos                                                                  */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "brand" | "warning" | "info";
}) {
  const style = {
    success: "bg-success/10 text-income",
    danger: "bg-danger/10 text-expense",
    brand: "bg-primary/10 text-primary-strong",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
    neutral: "bg-bg-soft text-fg-muted",
  }[tone];

  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", style)}>
      {children}
    </span>
  );
}

const BUTTON_SIZE = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
} as const;

export function ActionButton({
  children,
  tone = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "primary" | "secondary" | "danger" | "ghost";
  size?: keyof typeof BUTTON_SIZE;
}) {
  const style =
    tone === "primary"
      ? "btn-primary"
      : tone === "danger"
        ? // Contorno, não preenchido: o vermelho cheio competia com o verde da ação.
          "rounded-md border border-danger/40 text-danger transition-colors hover:bg-danger/10"
        : tone === "ghost"
          ? "rounded-md text-fg transition-colors hover:bg-bg-soft"
          : "btn-secondary";

  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-display font-medium disabled:opacity-60",
        BUTTON_SIZE[size],
        style,
        className
      )}
    >
      {children}
    </button>
  );
}

export function Alert({
  children,
  type = "info",
}: {
  children: ReactNode;
  type?: "success" | "error" | "info" | "warning";
}) {
  // `info` usa azul, não verde: no tema escuro --primary-strong e --success são
  // a mesma cor (#34d399), o que tornava info e success indistinguíveis.
  const style = {
    success: "border-success/35 bg-success/10 text-income",
    error: "border-danger/35 bg-danger/10 text-expense",
    warning: "border-warning/35 bg-warning/10 text-warning",
    info: "border-info/30 bg-info/10 text-info",
  }[type];

  return <div className={cx("rounded-md border px-4 py-3 text-sm font-normal", style)}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-8 text-center">
      {icon ? <div className="mb-3 flex justify-center text-fg-soft">{icon}</div> : null}
      <p className="font-display text-base font-semibold text-fg">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm font-normal leading-6 text-fg-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
