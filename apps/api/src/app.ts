import { randomUUID } from "node:crypto";
import Fastify, { LogController } from "fastify";
import type { Database } from "./database.js";
import { entryHttp } from "./access/http.js";
import type { EntryHttpOptions } from "./access/http.js";
import { accessTransaction } from "./access/transaction.js";

interface AppOptions {
  database: Database;
  logger?: boolean;
  entry?: EntryHttpOptions;
}

export function buildApp({ database, logger = false, entry }: AppOptions) {
  const app = Fastify({
    logger: logger ? { redact: { paths: ["req.headers.cookie", "req.headers.authorization", "req.headers['x-csrf-token']", "res.headers['set-cookie']", "req.body", "body", "err"], remove: true } } : false,
    genReqId: () => randomUUID(),
    requestIdHeader: false,
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

  if (entry) app.register(entryHttp, { ...entry, prefix: "/api/v1" });

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
      if (entry) await accessTransaction(entry.pool, entry.clock, async (client) => { await client.query("SELECT 1"); }, "SHARED");
      else await database.check();
      return { status: "ready" };
    } catch {
      app.log.warn({ event: "readiness_failed" }, "Readiness check failed.");
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  return app;
}
