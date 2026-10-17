import Fastify, { LogController } from "fastify";
import type { Database } from "./database.js";

interface AppOptions {
  database: Database;
  logger?: boolean;
}

export function buildApp({ database, logger = false }: AppOptions) {
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 4096,
    requestTimeout: 15000,
    ajv: {
      customOptions: {
        coerceTypes: false,
        useDefaults: false,
        removeAdditional: false,
      },
    },
  });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.addHook("onClose", async () => {
    await database.close();
  });

  app.get("/health", {
    schema: {
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          required: ["status"],
          properties: { status: { type: "string", const: "ok" } },
        },
      },
    },
  }, async () => ({ status: "ok" }));

  app.get("/ready", {
    schema: {
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          required: ["status"],
          properties: { status: { type: "string", const: "ready" } },
        },
        503: {
          type: "object",
          additionalProperties: false,
          required: ["status"],
          properties: { status: { type: "string", const: "not_ready" } },
        },
      },
    },
  }, async (_request, reply) => {
    try {
      await database.check();
      return { status: "ready" };
    } catch {
      app.log.warn({ event: "database_readiness_failed" }, "Database readiness check failed.");
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  return app;
}
