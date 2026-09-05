import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

// AUDITORIA M-5. Só a landing e /termos são públicas e indexáveis; todo o resto
// exige login e não deve aparecer em buscador.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/termos"],
      disallow: [
        "/dashboard",
        "/perfil",
        "/historico",
        "/metas",
        "/fixos",
        "/categorias",
        "/gastos-fixos",
        "/parcelamentos",
        "/planejamento-mensal",
        "/login",
        "/cadastro",
        "/recuperar-senha",
        "/atualizar-senha",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
