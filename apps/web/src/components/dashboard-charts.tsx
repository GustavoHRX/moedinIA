"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/formatters";

/**
 * Gráficos do dashboard isolados num só módulo, carregado sob demanda
 * (next/dynamic) — assim o Recharts, que é pesado e só existe aqui, fica
 * fora do bundle inicial e do login. Componentes puros: recebem os dados
 * já prontos (com as cores calculadas na página).
 */

export type PieDatum = { name: string; total: number; fill: string };
export type BarDatum = { name: string; total: number; fill: string };
export type MonthlyDatum = { mes: string; receitas: number; despesas: number };

const BAR_CURSOR = { fill: "rgba(16,185,129,0.08)", radius: 6 } as const;

type TooltipPayloadEntry = {
  color?: string;
  value?: number | string;
  dataKey?: string | number;
  payload?: { name?: string };
};

/**
 * Tooltip customizado da marca (book pág. 15): fundo da superfície, raio
 * 12px, borda sutil, valor em mono. O Tooltip padrão do Recharts pinta o
 * texto na cor da própria série (`item.color`), que em tons escuros fica
 * ilegível sobre o fundo escuro do tooltip — aqui o texto é sempre
 * `var(--text)`, só o pontinho usa a cor da série.
 */
function ChartTooltip({
  active,
  payload,
  label,
  labelMap,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  labelMap?: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-surface-strong px-3 py-2.5">
      {label ? <p className="mb-1.5 text-xs font-semibold text-fg-muted">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const key = entry.dataKey != null ? String(entry.dataKey) : undefined;
          const name = (key && labelMap?.[key]) || entry.payload?.name || "Total";
          return (
            <p key={index} className="flex items-center gap-2 text-sm text-fg">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-fg-muted">{name}</span>
              <span className="money ml-auto pl-2 font-semibold">{formatCurrency(Number(entry.value ?? 0))}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryDonut({ data }: { data: PieDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius={70}
          outerRadius={112}
          paddingAngle={1}
          stroke="none"
          animationDuration={450}
          animationEasing="ease-out"
        >
          {data.map((entry, index) => (
            <Cell key={`pie-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function IncomeExpenseBars({ data }: { data: BarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
      <BarChart data={data}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip content={<ChartTooltip />} cursor={BAR_CURSOR} />
        <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={32} animationDuration={450} animationEasing="ease-out">
          {data.map((entry, index) => (
            <Cell key={`bar-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ data }: { data: MonthlyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
      <BarChart data={data} barGap={6}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={48} />
        <Tooltip
          content={<ChartTooltip labelMap={{ receitas: "Receitas", despesas: "Despesas" }} />}
          cursor={BAR_CURSOR}
        />
        <Legend formatter={(value) => (value === "receitas" ? "Receitas" : "Despesas")} />
        <Bar dataKey="receitas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={32} animationDuration={450} animationEasing="ease-out" />
        <Bar dataKey="despesas" fill="var(--chart-6)" radius={[6, 6, 0, 0]} maxBarSize={32} animationDuration={450} animationEasing="ease-out" animationBegin={60} />
      </BarChart>
    </ResponsiveContainer>
  );
}
