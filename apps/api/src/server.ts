import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database.js";

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
  });
  const app = buildApp({ database, logger: true });
  let closing = false;

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
