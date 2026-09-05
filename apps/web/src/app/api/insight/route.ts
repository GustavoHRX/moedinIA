import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * AUDITORIA A-1: antes o dashboard chamava o ai-service (`/insight`) direto do
 * navegador, o que obrigava o serviço a ser público e sem autenticação, com as
 * chaves de IA carregadas no processo. Agora a chamada passa por aqui:
 *  - exige sessão Supabase válida;
 *  - encaminha para o ai-service pela rede interna (AI_SERVICE_URL, sem prefixo
 *    NEXT_PUBLIC), então a URL do serviço nunca chega ao cliente;
 *  - o ai-service pode ficar restrito à rede interna + CORS por allowlist.
 */

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8000";

type InsightPayload = {
  month_label?: unknown;
  income_total?: unknown;
  expense_total?: unknown;
  budget_amount?: unknown;
  categories?: unknown;
};

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, erro: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceRateLimit("insight", user.id);
  if (limited) return limited;

  let body: InsightPayload;
  try {
    body = (await request.json()) as InsightPayload;
  } catch {
    return NextResponse.json({ ok: false, erro: "JSON inválido." }, { status: 400 });
  }

  // Normaliza e limita a carga antes de repassar (não confiamos no cliente).
  const categoriesInput = Array.isArray(body.categories) ? body.categories : [];
  const payload = {
    month_label: String(body.month_label ?? "").slice(0, 40),
    income_total: toNumber(body.income_total),
    expense_total: toNumber(body.expense_total),
    budget_amount: toNumber(body.budget_amount),
    categories: categoriesInput.slice(0, 12).map((item) => {
      const record = (item ?? {}) as { name?: unknown; total?: unknown };
      return {
        name: String(record.name ?? "").slice(0, 60),
        total: toNumber(record.total),
      };
    }),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const upstream = await fetch(`${AI_SERVICE_URL}/insight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return NextResponse.json({ ok: false, erro: "Serviço de IA indisponível." }, { status: 502 });
    }

    const data = (await upstream.json()) as { ok?: boolean; insight?: string };
    return NextResponse.json(data);
  } catch {
    // Falha de rede / timeout: o dashboard cai nas heurísticas locais.
    return NextResponse.json({ ok: false, erro: "Serviço de IA indisponível." }, { status: 502 });
  }
}
