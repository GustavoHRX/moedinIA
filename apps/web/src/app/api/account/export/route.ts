import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * AUDITORIA A-7 (LGPD — direito de portabilidade/acesso).
 * Devolve, em JSON, todos os dados pessoais do usuário autenticado. Usa a
 * sessão do próprio usuário (o RLS garante que só os dados dele saem).
 */

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
  const PAGE = 1000;
  const failures: string[] = [];
  let truncated = false;

  for (const table of TABLES) {
    const rows: unknown[] = [];
    let from = 0;
    let failed = false;

    // teto de segurança: 200 páginas = 200k linhas por tabela
    for (let page = 0; page < 200; page++) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);

      if (error) {
        failures.push(table);
        dump[table] = { error: "não foi possível exportar esta tabela" };
        failed = true;
        break;
      }

      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;

      if (page === 199) truncated = true;
    }

    if (!failed) dump[table] = rows;
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
