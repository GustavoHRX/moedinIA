import { type NextRequest } from "next/server";
import { middleware as supabaseMiddleware } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await supabaseMiddleware(request);
}

export const config = {
  matcher: [
    "/login",
    "/cadastro",
    "/recuperar-senha",
    "/dashboard/:path*",
    "/perfil/:path*",
    "/historico/:path*",
    "/metas/:path*",
    "/gastos-fixos/:path*",
    "/parcelamentos/:path*",
    "/planejamento-mensal/:path*",
    "/planos/:path*",
  ],
};
