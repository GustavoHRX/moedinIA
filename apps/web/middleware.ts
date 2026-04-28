import { type NextRequest } from "next/server";
import { middleware as supabaseMiddleware } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await supabaseMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
