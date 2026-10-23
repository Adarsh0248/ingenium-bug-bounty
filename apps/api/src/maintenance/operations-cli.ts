import { parseArgs } from "node:util";
import { Pool } from "pg";
import { privateRuntimeJson } from "../runtime/private-file.js";
import { maintenanceConfig } from "./offline.js";
import { readOperations } from "./operations.js";

async function main() {
  const { values } = parseArgs({ options: { runtime: { type: "string" } } });
  const connectionString = maintenanceConfig(
    await privateRuntimeJson(values.runtime ?? "", 4096),
  );
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 2000,
    options: "-c default_transaction_read_only=on",
    statement_timeout: 2000,
    query_timeout: 3000,
    application_name: "ingenium-operations-observer",
  });
  pool.on("error", () => {
    process.exitCode = 1;
  });
  try {
    const report = await readOperations(pool);
    console.log(JSON.stringify(report));
    process.exitCode = 2; // Unknown host/backup checks never become an all-clear signal.
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "Operational observation unavailable; treat monitoring as stale, not healthy.",
  );
  process.exitCode = 1;
});
