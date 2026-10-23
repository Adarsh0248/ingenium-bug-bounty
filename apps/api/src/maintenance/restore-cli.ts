import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { privateRuntimeJson } from "../runtime/private-file.js";
import {
  quarantineRestoredDatabase,
  restoreConfig,
  restoreStatus,
  inspectRestoredDatabase,
} from "./restore.js";

async function main() {
  const { values } = parseArgs({
    options: {
      runtime: { type: "string" },
      "request-key": { type: "string" },
      "backup-ref": { type: "string" },
      operator: { type: "string" },
      reason: { type: "string" },
      confirm: { type: "string" },
      status: { type: "boolean" },
      inspect: { type: "boolean" },
    },
  });
  if (
    values.status || values.inspect
      ? Object.keys(values).some(
          (key) =>
            ![
              "runtime",
              "request-key",
              values.inspect ? "inspect" : "status",
            ].includes(key),
        )
      : values.confirm !== "ISOLATED_RESTORE_QUARANTINE"
  )
    throw new Error("Explicit offline restore mode required.");
  const connectionString = restoreConfig(
    await privateRuntimeJson(values.runtime ?? "", 8192),
  );
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 30000,
    lock_timeout: 1000,
    query_timeout: 35000,
    application_name: "ingenium-restore-quarantine",
  });
  pool.on("error", () => {
    process.exitCode = 1;
  });
  try {
    const result = values.inspect
      ? await inspectRestoredDatabase(pool, values["request-key"]!)
      : values.status
        ? await restoreStatus(pool, values["request-key"]!)
        : await quarantineRestoredDatabase(pool, {
            requestKey: values["request-key"]!,
            backupRef: values["backup-ref"]!,
            operator: values.operator!,
            osUser: userInfo().username,
            reason: values.reason!,
          });
    console.log(JSON.stringify(result));
    console.log(
      "Admission remains forbidden. This command does not prove old hosts stopped, rotate deployment keys or authorise reopening.",
    );
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "Restore quarantine not acknowledged. Keep the target isolated. Reconcile with --status and the original request key; do not start services, reset records or substitute a new key.",
  );
  process.exitCode = 1;
});
