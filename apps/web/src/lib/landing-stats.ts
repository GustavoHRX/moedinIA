import { createClient } from "@supabase/supabase-js";

/**
 * Total REAL de lançamentos registrados no Moedin (só o número agregado, sem
 * nenhum dado de usuário). Alimenta a prova social da landing — nada de número
 * inventado. Roda só no servidor (service_role nunca vai para o navegador) e a
 * página revalida de hora em hora, então isso é uma consulta por hora, não por
 * visita. Qualquer falha devolve null e a landing simplesmente esconde o número.
 */
export async function getRegisteredEntriesCount(): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  try {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { count, error } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .neq("status", "deleted");
    if (error || !count) return null;
    return count;
  } catch {
    return null;
  }
}
