/*
 * Paleta de gráficos — uma cor por série, ligada aos tokens do tema.
 * O Recharts aceita custom properties em fill/stroke (acabam em atributos de
 * apresentação SVG), portanto isto muda de cor no tema claro sem JS.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

export const CHART_INCOME = "var(--chart-1)";
export const CHART_EXPENSE = "var(--chart-6)";
