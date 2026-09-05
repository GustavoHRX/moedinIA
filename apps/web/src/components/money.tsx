import { AnimatedMoney } from "@/components/animated-money";
import { formatCurrency } from "@/lib/formatters";

/*
 * Todo valor em R$ passa por aqui.
 *
 * A JetBrains Mono é a fonte de número da marca (book pág. 05) mas estava a ser
 * usada em 2 sítios na app inteira — numa app de finanças. Além da identidade,
 * `tabular-nums` faz os dígitos terem todos a mesma largura, o que alinha as
 * colunas de valores em listas e tabelas.
 */

const SIZES = {
  xs: "text-xs font-medium",
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-xl font-semibold",
  xl: "text-2xl font-semibold sm:text-3xl",
} as const;

const TONES = {
  neutral: "text-fg",
  muted: "text-fg-muted",
  income: "text-income",
  expense: "text-expense",
  primary: "text-primary-strong",
} as const;

export function Money({
  value,
  tone = "neutral",
  size = "sm",
  signed = false,
  animate = false,
  className,
}: {
  value: number;
  /** `auto` decide pelo sinal do valor. */
  tone?: keyof typeof TONES | "auto";
  size?: keyof typeof SIZES;
  /** Mostra "+" nos positivos (útil em livro-razão). */
  signed?: boolean;
  /** Conta do valor anterior até ao novo — só onde o valor muda em resposta a algo. */
  animate?: boolean;
  className?: string;
}) {
  const resolved = tone === "auto" ? (value < 0 ? "expense" : "income") : tone;
  const cls = ["money", SIZES[size], TONES[resolved], className].filter(Boolean).join(" ");

  if (animate) return <AnimatedMoney value={value} className={cls} />;

  return (
    <span className={cls}>
      {signed && value > 0 ? "+" : ""}
      {formatCurrency(value)}
    </span>
  );
}
