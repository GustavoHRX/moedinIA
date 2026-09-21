import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * AUDITORIA A-7 (LGPD — direito de portabilidade/acesso).
 * Devolve, em JSON, todos os dados pessoais do usuário autenticado. Usa a
 * sessão do próprio usuário (o RLS garante que só os dados dele saem).
 */

// A exportação percorre 13 tabelas; damos folga ao limite da função.
export const maxDuration = 60;

const TABLES = [
  "profiles",
  "categories",
  "transactions",
  "goals",
  "budgets",
  "monthly_controls",
  "fixed_expenses",
  "fixed_incomes",
  "installments",
  "user_settings",
  "ai_insights",
  "message_logs",
  "whatsapp_links",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceRateLimit("export", user.id);
  if (limited) return limited;

  const dump: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
  };

  // Revisão externa (ago/2026): o PostgREST corta a resposta no limite máximo
  // de linhas (1000 por padrão), então um `select("*")` seco devolvia uma
  // exportação silenciosamente incompleta — e a rota respondia 200 mesmo com
  // tabela que falhou. Agora paginamos até o fim e reportamos o que falhou.
  //
  // As 13 tabelas são lidas em paralelo (antes era uma atrás da outra, e numa
  // conta grande o tempo somava até estourar o limite da função). A ordenação
  // por `id` é o que torna a paginação determinística: sem ela `.range()` pode
  // pular ou repetir linhas entre uma página e outra.
  const PAGE = 1000;
  const MAX_PAGES = 200; // teto de segurança: 200k linhas por tabela

  async function exportTable(table: (typeof TABLES)[number]) {
    const rows: unknown[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE;
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) return { table, rows: null, truncated: false };

      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < PAGE) return { table, rows, truncated: false };
    }
    return { table, rows, truncated: true };
  }

  const results = await Promise.all(TABLES.map(exportTable));

  const failures: string[] = [];
  let truncated = false;
  for (const { table, rows, truncated: hitCap } of results) {
    if (rows === null) {
      failures.push(table);
      dump[table] = { error: "não foi possível exportar esta tabela" };
      continue;
    }
    dump[table] = rows;
    if (hitCap) truncated = true;
  }

  dump.export_status = {
    complete: failures.length === 0 && !truncated,
    failed_tables: failures,
    truncated,
    note:
      failures.length === 0 && !truncated
        ? "Exportação completa."
        : "Exportação PARCIAL: alguma tabela falhou ou atingiu o teto de páginas. Tente de novo ou fale com o suporte.",
  };

  return new NextResponse(JSON.stringify(dump, null, 2), {
    // 207 = sucesso parcial. O cliente trata como erro para não entregar um
    // arquivo incompleto passando por completo.
    status: failures.length === 0 && !truncated ? 200 : 207,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="moedin-meus-dados-${user.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
