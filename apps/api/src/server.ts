import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database.js";
import { createEntryRuntime } from "./access/runtime.js";
import { Pool } from "pg";

async function start() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid API configuration.");
    process.exitCode = 1;
    return;
  }

  const database = createDatabase(config.databaseUrl, () => {
    console.error("An idle PostgreSQL connection failed; readiness will check again on request.");
  }, config.entryRuntimeFile ? 12 : 4);
  let closing = false;
  let entry: Awaited<ReturnType<typeof createEntryRuntime>> | undefined;
  let monitorPool: Pool | undefined;
  if (config.entryRuntimeFile) {
    monitorPool = new Pool({ connectionString: config.databaseUrl, application_name: "ingenium-clock-monitor", max: 2, connectionTimeoutMillis: 1000 });
    monitorPool.on("error", () => { if (!closing) entry?.options.clock.fault("DATABASE_UNAVAILABLE"); });
    try { entry = await createEntryRuntime(database.pool, monitorPool, config.entryRuntimeFile); }
    catch {
      console.error("Event entry could not start. Review the private runtime file, Linux probe ownership and reviewed migrations.");
      await monitorPool.end(); await database.close(); process.exitCode = 1; return;
    }
  }
  const app = buildApp({ database, logger: true, ...(entry ? { entry: entry.options } : {}) });
  if (entry) app.addHook("preClose", async () => {
    try { await entry!.close(); }
    catch { console.error("Clock shutdown was not acknowledged; preserve its durable runtime for review."); process.exitCode = 1; }
  });
  if (monitorPool) app.addHook("onClose", async () => { await monitorPool!.end(); });

  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try {
      await app.close();
    } catch {
      console.error("The API could not close cleanly.");
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch {
    console.error("The API could not start. Check whether its local port is already in use.");
    process.exitCode = 1;
    await shutdown();
  }
}

start().catch(() => {
  console.error("The API encountered an unexpected startup failure.");
  process.exitCode = 1;
});
