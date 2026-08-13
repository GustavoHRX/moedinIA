export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | null | undefined, fallback = "Não definido") {
  if (!date) return fallback;
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

/** "5000,5" | "5000.5" | 5000 → 5000.5. Vazio/ inválido vira 0. */
export function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formata um valor para exibição num campo de texto de dinheiro:
 * "5000" → "5.000,00". Usado tanto pra reformatar ao sair do campo (onBlur)
 * quanto pra pré-preencher formulários com valores vindos do banco — sem
 * isso um valor salvo como 5000 vira "5000" na tela em vez de "5.000,00"
 * (QA 11/ago/2026).
 */
export function formatMoneyInputValue(value: string | number | null | undefined) {
  const amount = parseMoneyInput(value);
  if (amount === 0 && (value === "" || value == null)) return "";
  return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
