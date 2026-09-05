import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Origem do Supabase (REST + Auth + Realtime websocket). Precisa entrar na CSP
// em connect-src. Derivada da env pública; cai para '' se não configurada.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseOrigin = "";
let supabaseWs = "";
try {
  if (supabaseUrl) {
    const u = new URL(supabaseUrl);
    supabaseOrigin = u.origin;
    supabaseWs = `wss://${u.host}`;
  }
} catch {
  // NEXT_PUBLIC_SUPABASE_URL inválida — segue sem adicionar à CSP.
}

// AUDITORIA A-3 — Content-Security-Policy.
// Começa em Report-Only (não bloqueia nada, só reporta no console do navegador)
// para validar que nenhum recurso legítimo é barrado. Depois de confirmar,
// troque a chave abaixo para "Content-Security-Policy".
const CSP_HEADER_NAME = "Content-Security-Policy-Report-Only";

const csp = [
  "default-src 'self'",
  // next/font self-hospeda as fontes; imagens locais + data URIs dos gráficos.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // 'unsafe-inline' e 'unsafe-eval' são exigidos pelo runtime do Next (dev) e
  // por libs de gráfico. Em produção o ideal é migrar para nonce; fica como
  // dívida registrada.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: CSP_HEADER_NAME, value: csp },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
