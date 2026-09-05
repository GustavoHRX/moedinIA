import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/*
 * Rate limit por Upstash Redis.
 *
 * AUDITORIA: hoje as rotas /api/* são todas autenticadas (não há flood anónimo),
 * mas um utilizador autenticado ainda pode martelar /api/insight — que chama o
 * ai-service e custa dinheiro por chamada. Isto limita por utilizador.
 *
 * SE UPSTASH_REDIS_REST_URL / _TOKEN não estiverem definidos: o rate limit é
 * DESLIGADO (fail-open) — assim o dev local funciona sem Upstash. Em produção
 * as duas variáveis são OBRIGATÓRIAS; sem elas a app avisa no log de arranque.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
export const rateLimitEnabled = Boolean(url && token);

if (!rateLimitEnabled && process.env.NODE_ENV === "production") {
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN ausentes — rate limit DESLIGADO em produção. Configure no painel da Vercel.",
  );
}

const redis = rateLimitEnabled ? new Redis({ url: url!, token: token! }) : null;

function make(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1]) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: "moedin/rl",
  });
}

/** Perfis de limite por rota. Ajustar os números aqui. */
export const limiters = {
  // ai-service custa dinheiro por chamada
  insight: make(20, "1 h"),
  // export percorre todas as tabelas do utilizador — pesado
  export: make(6, "1 h"),
  // ação destrutiva
  delete: make(4, "1 h"),
  // leve, mas evita loop
  ensure: make(30, "1 m"),
};

/**
 * Verifica o limite para `identifier` (normalmente o user.id) usando o limiter
 * `name`. Devolve `null` se pode prosseguir, ou uma NextResponse 429 se não.
 */
export async function enforceRateLimit(
  name: keyof typeof limiters,
  identifier: string,
): Promise<NextResponse | null> {
  const limiter = limiters[name];
  if (!limiter) return null; // rate limit desligado

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  if (success) return null;

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { ok: false, erro: "Muitas requisições. Tente de novo daqui a pouco." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(remaining),
      },
    },
  );
}
