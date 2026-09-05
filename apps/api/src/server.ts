import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({
  logger: true,
});

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

// AUDITORIA M-2: CORS por allowlist em vez de refletir qualquer origem.
// Defina API_ALLOWED_ORIGINS (separado por vírgula) em produção.
const allowedOrigins = (process.env.API_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

async function start() {
  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  });

  app.get("/", async () => {
    return {
      ok: true,
      service: "moedin-api",
      message: "API do Moedin funcionando",
      port: PORT,
    };
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "moedin-api",
    };
  });

  try {
    await app.listen({
      port: PORT,
      host: HOST,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();