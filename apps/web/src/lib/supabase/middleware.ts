import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const pathname = request.nextUrl.pathname;
  const authRoutes = ["/login", "/cadastro", "/recuperar-senha"];
  const protectedRoutes = [
    "/dashboard",
    "/perfil",
    "/historico",
    "/metas",
    "/fixos",
    "/categorias",
    "/gastos-fixos",
    "/parcelamentos",
    "/planejamento-mensal",
  ];
  const isAuthRoute = authRoutes.some((route) => pathname === route);
  const isProtectedRoute = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const hasSupabaseSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  const hasSupabaseSessionHeader = request.headers
    .get("cookie")
    ?.includes("auth-token");
  const hasSessionCookie = Boolean(hasSupabaseSessionCookie || hasSupabaseSessionHeader);

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

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!,
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

export const config = {
  matcher: [
    "/login",
    "/cadastro",
    "/recuperar-senha",
    "/dashboard/:path*",
    "/perfil/:path*",
    "/historico/:path*",
    "/metas/:path*",
    "/fixos/:path*",
    "/categorias/:path*",
    "/gastos-fixos/:path*",
    "/parcelamentos/:path*",
    "/planejamento-mensal/:path*",
  ],
};
