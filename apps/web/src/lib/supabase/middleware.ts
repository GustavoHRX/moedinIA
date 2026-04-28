import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const authRoutes = ["/login", "/cadastro", "/recuperar-senha"];
  const protectedRoutes = [
    "/dashboard",
    "/perfil",
    "/lancamentos",
    "/historico",
    "/metas",
    "/gastos-fixos",
    "/parcelamentos",
    "/planejamento-mensal",
  ];

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

  if (user && authRoutes.some((route) => pathname === route)) {
    return redirect("/dashboard");
  }

  if (!user && protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
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
    "/lancamentos/:path*",
    "/historico/:path*",
    "/metas/:path*",
    "/gastos-fixos/:path*",
    "/parcelamentos/:path*",
    "/planejamento-mensal/:path*",
  ],
};
