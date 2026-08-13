import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback do OAuth (Google). O Supabase redireciona pra cá com `?code=...`
 * depois do usuário aprovar no provedor; trocamos o code pela sessão e
 * mandamos pro destino final. `next` deixa o link "Entrar com Google"
 * devolver o usuário pra rota que ele tentou acessar antes do login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=oauth`);
}
