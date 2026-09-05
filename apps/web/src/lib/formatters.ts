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

/**
 * Interpreta um valor monetário digitado, aceitando tanto o formato BR
 * ("1.200,50") quanto o com ponto decimal ("1200.50" / "23.50"). Vazio ou
 * inválido vira 0. Sempre não-negativo (o tipo — receita/despesa — é separado).
 *
 * REVISÃO EXTERNA (ago/2026): a versão antiga fazia `.replace(/\./g, "")` cega,
 * então "23.50" virava 2350 — um lançamento colado em formato decimal com
 * ponto era gravado 100x maior. A regra abaixo é a mesma do parser do
 * ai-service (apps/ai-service/main.py::parse_amount), para o WhatsApp e o site
 * concordarem.
 *
 *   "1.200,50" -> 1200.5   (vírgula = decimal; pontos = milhar)
 *   "23.50"    -> 23.5     (1 ponto, 2 casas  = decimal)
 *   "5000.5"   -> 5000.5   (1 ponto, 1 casa   = decimal)
 *   "1.200"    -> 1200     (1 ponto, 3 casas  = milhar)
 *   "1.200.000"-> 1200000  (vários pontos     = milhar)
 *   "1200"     -> 1200
 */
export function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  // tira "R$", espaços, sinais e qualquer outra coisa que não seja dígito/./,
  let token = String(value ?? "").replace(/[^\d.,]/g, "");
  if (!token) return 0;

  if (token.includes(",")) {
    token = token.replace(/\./g, "").replace(",", ".");
  } else {
    const dotCount = (token.match(/\./g) ?? []).length;
    if (dotCount === 1) {
      const decimals = token.split(".")[1] ?? "";
      if (decimals.length !== 1 && decimals.length !== 2) {
        token = token.replace(/\./g, "");
      }
    } else if (dotCount > 1) {
      token = token.replace(/\./g, "");
    }
  }

  const parsed = Number(token);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
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
