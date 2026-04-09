import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({
  logger: true,
});

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  await app.register(cors, {
    origin: true,
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