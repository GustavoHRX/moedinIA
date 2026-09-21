import { describe, expect, it } from "vitest";
import { AUTH_ROUTES, PROTECTED_ROUTES } from "@/lib/supabase/middleware";
import { config } from "@/proxy";

// O Next só lê o `config.matcher` do proxy.ts, e ele precisa ser literal — então
// a lista de rotas protegidas existe em dois lugares. Este teste impede que
// voltem a divergir.
describe("proxy: matcher x rotas protegidas", () => {
  const matcher = config.matcher as string[];

  it("toda rota protegida está no matcher", () => {
    for (const route of PROTECTED_ROUTES) {
      expect(matcher, `falta ${route}/:path* no matcher`).toContain(`${route}/:path*`);
    }
  });

  it("toda rota de auth está no matcher", () => {
    for (const route of AUTH_ROUTES) {
      expect(matcher, `falta ${route} no matcher`).toContain(route);
    }
  });

  it("o matcher não tem rota que o proxy desconheça", () => {
    const known = new Set([...AUTH_ROUTES, ...PROTECTED_ROUTES.map((r) => `${r}/:path*`)]);
    for (const entry of matcher) {
      expect(known.has(entry), `${entry} está no matcher mas não em PROTECTED_ROUTES/AUTH_ROUTES`).toBe(true);
    }
  });
});
