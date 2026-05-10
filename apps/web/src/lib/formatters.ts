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
