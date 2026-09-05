import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * AUDITORIA A-7 (LGPD — direito de eliminação).
 * Apaga a conta do usuário autenticado e todos os dados associados.
 *
 * Todas as tabelas têm FK `on delete cascade` até `profiles`, e `profiles` tem
 * `on delete cascade` de `auth.users` — então apagar o usuário do Auth remove
 * tudo. A remoção do usuário do Auth exige a service_role (admin API), que só
 * existe no servidor.
 *
 * Requer a env `SUPABASE_SERVICE_ROLE_KEY` (NUNCA com prefixo NEXT_PUBLIC).
 * Confirmação: o corpo precisa trazer { confirm: "APAGAR" }.
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceRateLimit("delete", user.id);
  if (limited) return limited;

  let body: { confirm?: unknown };
  try {
    body = (await request.json()) as { confirm?: unknown };
  } catch {
    body = {};
  }
  if (body.confirm !== "APAGAR") {
    return NextResponse.json(
      { error: 'Confirmação ausente. Envie { "confirm": "APAGAR" }.' },
      { status: 400 },
    );
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Exclusão de conta indisponível: servidor não configurado." },
      { status: 503 },
    );
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Revisão externa (ago/2026): `message_logs.user_id` é ON DELETE SET NULL, ao
  // contrário das outras tabelas (CASCADE). Sem este passo, apagar a conta
  // deixaria para trás as mensagens de WhatsApp do usuário — com o texto bruto
  // do que ele escreveu — órfãs no banco, contradizendo a promessa de "apagar
  // tudo". Apagamos explicitamente ANTES de remover o usuário do Auth.
  const { error: logsError } = await admin
    .from("message_logs")
    .delete()
    .eq("user_id", user.id);

  if (logsError) {
    return NextResponse.json(
      { error: "Não foi possível apagar a conta agora." },
      { status: 500 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "Não foi possível apagar a conta agora." }, { status: 500 });
  }

  // Encerra a sessão local.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
