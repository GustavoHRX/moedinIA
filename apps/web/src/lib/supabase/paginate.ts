/**
 * REVISÃO EXTERNA (ago/2026) — achado 4.1 / 4.2: o PostgREST limita a resposta
 * (1000 linhas por padrão), então um `.select()` seco de uma tabela grande
 * volta TRUNCADO sem ninguém perceber. Este helper pagina com `.range()` até
 * trazer tudo.
 *
 * Recebe uma FUNÇÃO que monta a query do zero (para não reaproveitar um builder
 * já consumido) e devolve o `.range(from, to)` aplicado:
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase
 *       .from("transactions")
 *       .select("id, amount")
 *       .eq("user_id", id)
 *       .order("transaction_date", { ascending: false })
 *       .order("id", { ascending: false })
 *       .range(from, to)
 *   );
 *
 * A ordenação determinística é obrigatória para a paginação não pular/repetir.
 */

type RangeResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllRows<T>(
  makeRangeQuery: (from: number, to: number) => RangeResult<T>,
  { pageSize = 1000, maxPages = 200 }: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await makeRangeQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}
