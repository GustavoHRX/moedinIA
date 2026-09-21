import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { getSupabaseKey } from "@/lib/supabase/env";

// Rotas que exigem sessão. Ao acrescentar uma aqui, acrescente o mesmo caminho
// (`/rota/:path*`) no `config.matcher` de `src/proxy.ts` — o Next só lê o matcher
// de lá e ele precisa ser literal. O teste `proxy-routes.test.ts` falha se as
// duas listas divergirem (foi exatamente essa divergência que deixou
// /onboarding, /limite e /whatsapp sem proteção no servidor).
export const PROTECTED_ROUTES = [
  "/dashboard",
  "/perfil",
  "/historico",
  "/metas",
  "/fixos",
  "/categorias",
  "/gastos-fixos",
  "/parcelamentos",
  "/planejamento-mensal",
  "/limite",
  "/whatsapp",
  "/onboarding",
];
export const AUTH_ROUTES = ["/login", "/cadastro", "/recuperar-senha"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const hasSupabaseSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  const hasSessionCookie = hasSupabaseSessionCookie;

  function redirect(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (!hasSessionCookie) {
    if (isProtectedRoute) {
      return redirect("/login");
    }

    return response;
  }

  // AUDITORIA A-2: removido o bypass incondicional de autenticação em
  // desenvolvimento. A validação de sessão agora roda em todos os ambientes; o
  // bloco catch abaixo ainda dá um fallback tolerante em dev quando o Supabase
  // fica inacessível (rede offline), sem nunca liberar rota privada sem sessão.

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseKey();

  // Variáveis do Supabase ausentes: não dá para validar a sessão. Antes o `!`
  // deixava isso estourar como 500 em toda rota protegida; agora rota protegida
  // vai para o login (nunca é liberada sem sessão) e o resto segue normal.
  if (!supabaseUrl || !key) {
    console.error("[proxy] NEXT_PUBLIC_SUPABASE_URL / chave pública do Supabase não configuradas.");
    return isProtectedRoute ? redirect("/login") : response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user: User | null = null;

  try {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          console.warn(
            "Supabase auth check failed in middleware. Using local dev session fallback."
          );
          user = session.user;
        }
      } catch {
        user = null;
      }
    }

    if (user) {
      if (isAuthRoute) {
        return redirect("/dashboard");
      }

      return response;
    }

    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Supabase auth check failed in middleware:",
        error instanceof Error ? error.message : error
      );
    }

    if (isProtectedRoute) {
      return redirect("/login");
    }

    return response;
  }

  if (user && isAuthRoute) {
    return redirect("/dashboard");
  }

  if (!user && isProtectedRoute) {
    return redirect("/login");
  }

  return response;
}
