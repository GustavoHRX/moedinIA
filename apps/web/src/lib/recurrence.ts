/**
 * Regras de datas de recorrência, compartilhadas entre o modal de lançamento,
 * as páginas de gastos fixos / parcelamentos e o catch-up.
 *
 * Revisão externa (ago/2026):
 *  - achado 2.3: o modal gerava ocorrências na DATA INICIAL; o catch-up gerava
 *    no DIA DE VENCIMENTO. Mesmo gasto, datas diferentes. Agora todo mundo usa
 *    `monthlyOccurrences`.
 *  - achado 2.4: um gasto criado em 20/08 com vencimento dia 5 gerava uma
 *    ocorrência em 05/08 — antes do início. Agora a primeira ocorrência nunca
 *    é anterior a `startDate`.
 */
import { addMonthsClamped } from "./dates";

const HARD_CAP_MONTHS = 600;

function clampDay(year: number, month1to12: number, day: number): number {
  const lastDay = new Date(year, month1to12, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
}

function dueDateFor(monthAnchor: string, dueDay: number): string {
  const year = Number(monthAnchor.slice(0, 4));
  const month = Number(monthAnchor.slice(5, 7));
  const day = clampDay(year, month, dueDay);
  return `${monthAnchor.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

/**
 * Datas de ocorrência mensais de um gasto fixo ou receita fixa, da primeira
 * até `today` (inclusive), sempre no `dueDay` do mês (ajustado para meses
 * curtos). A primeira ocorrência cai no mês de `startDate` se o vencimento
 * desse mês for >= `startDate`; senão, no mês seguinte.
 */
export function monthlyOccurrences(params: {
  startDate: string; // YYYY-MM-DD
  dueDay: number; // 1..31
  today: string; // YYYY-MM-DD
  endDate?: string | null;
  monthsAhead?: number | null;
}): string[] {
  const { startDate, dueDay, today, endDate, monthsAhead } = params;
  if (!startDate || !dueDay) return [];

  const startMonthAnchor = `${startDate.slice(0, 7)}-01`;
  const dueThisMonth = dueDateFor(startMonthAnchor, dueDay);
  const firstAnchor =
    dueThisMonth >= startDate ? startMonthAnchor : addMonthsClamped(startMonthAnchor, 1);

  const cap = monthsAhead && monthsAhead > 0 ? Math.min(monthsAhead, HARD_CAP_MONTHS) : HARD_CAP_MONTHS;

  const out: string[] = [];
  for (let i = 0; i < cap; i++) {
    const occ = dueDateFor(addMonthsClamped(firstAnchor, i), dueDay);
    if (occ > today) break;
    if (endDate && occ > endDate) break;
    out.push(occ);
  }
  return out;
}

/**
 * Datas das parcelas de um parcelamento, da primeira (`startDate`, parcela 1)
 * até `today`. Não gera parcelas futuras.
 */
export function installmentOccurrences(params: {
  startDate: string;
  count: number;
  today: string;
}): Array<{ number: number; date: string }> {
  const { startDate, count, today } = params;
  const out: Array<{ number: number; date: string }> = [];
  const n = Math.max(0, Math.trunc(count));
  for (let i = 1; i <= n; i++) {
    const date = addMonthsClamped(startDate, i - 1);
    if (date > today) break;
    out.push({ number: i, date });
  }
  return out;
}
