import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { catchUpRecurrences } from "@/lib/recurrence-catchup";
import { fetchAllRows } from "@/lib/supabase/paginate";

/**
 * REVISÃO EXTERNA (ago/2026) — achado 2.5: a geração de recorrências dependia
 * de alguém abrir o site (efeito no app-data-provider). Quem usa só o WhatsApp
 * podia consultar um mês sem os lançamentos fixos que deveriam existir.
 *
 * Esta rota roda no servidor, uma vez por dia (Vercel Cron — ver vercel.json),
 * e chama o mesmo `catchUpRecurrences` (idempotente) para cada usuário, com a
 * service_role. O catch-up do cliente continua como rede de segurança.
 *
 * Proteção: exige o header `Authorization: Bearer <CRON_SECRET>`. A Vercel
 * injeta esse header automaticamente nos cron jobs quando CRON_SECRET está
 * definido nas envs do projeto.
 */

export const maxDuration = 60; // segundos (plano Pro); no Hobby o teto é menor

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Comparação em tempo constante: esta rota roda com a service_role, então não
// vale vazar por timing quantos caracteres do segredo o chamador acertou.
function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function handle(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!CRON_SECRET || !safeEqual(auth, `Bearer ${CRON_SECRET}`)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "servidor não configurado" }, { status: 503 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Paginado: sem isso o PostgREST corta em 1000 perfis e quem está além da
  // primeira página nunca teria recorrência gerada, todo dia, em silêncio.
  let profiles: { id: string }[];
  try {
    profiles = await fetchAllRows<{ id: string }>((from, to) =>
      admin.from("profiles").select("id").order("id", { ascending: true }).range(from, to),
    );
  } catch {
    return NextResponse.json({ error: "falha ao listar usuários" }, { status: 500 });
  }

  const deadline = Date.now() + 50_000; // deixa margem antes do maxDuration
  let processed = 0;
  let created = 0;
  let failed = 0;
  let stoppedEarly = false;

  for (const { id } of profiles) {
    if (Date.now() > deadline) {
      stoppedEarly = true;
      break;
    }
    try {
      created += await catchUpRecurrences(admin, id as string);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    created,
    failed,
    stopped_early: stoppedEarly,
    total_users: profiles.length,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

// A Vercel dispara cron via GET; POST fica disponível para acionamento manual.
export async function POST(request: Request) {
  return handle(request);
}
