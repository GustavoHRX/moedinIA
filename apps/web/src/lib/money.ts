/**
 * Regras monetárias compartilhadas. Extraídas para um módulo único e testável
 * (revisão externa ago/2026, achado 7.6) — antes a mesma lógica estava
 * duplicada no modal, na página de parcelamentos e no catch-up, e um ajuste
 * corrigia um lugar e deixava o outro errado.
 */

/** Arredonda para centavos, evitando lixo de ponto flutuante. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Divide `total` em `count` parcelas que somam EXATAMENTE o total.
 * O resto de centavos é distribuído nas ÚLTIMAS parcelas (1 centavo cada).
 *
 *   splitInstallments(100, 3)  -> [33.33, 33.33, 33.34]
 *   splitInstallments(10, 4)   -> [2.5, 2.5, 2.5, 2.5]
 *   splitInstallments(100.05, 2) -> [50.02, 50.03]
 *
 * Achado 2.7: antes cada parcela era `(total / count).toFixed(2)`, então
 * R$ 100 em 3x somava R$ 99,99 e a compra nunca "fechava".
 */
export function splitInstallments(total: number, count: number): number[] {
  const n = Math.max(1, Math.trunc(count));
  const cents = toCents(total);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n; // 0 <= remainder < n

  const parts: number[] = [];
  for (let i = 0; i < n; i++) {
    const extra = i >= n - remainder ? 1 : 0;
    parts.push(fromCents(base + extra));
  }
  return parts;
}

/** Valor exibido como "cada parcela" antes de salvar (o real vem de splitInstallments). */
export function installmentPreview(total: number, count: number): number {
  const parts = splitInstallments(total, count);
  return parts[0] ?? 0;
}
