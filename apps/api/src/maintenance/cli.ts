import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { privateRuntimeJson } from "../runtime/private-file.js";
import { linuxClockSource } from "../clock/linux-source.js";
import { createClockMonitor } from "../clock/monitor.js";
import { maintenanceLoop } from "./loop.js";
import { maintenanceConfig, offlineRetention } from "./offline.js";

let pool: Pool | undefined,
  monitor: ReturnType<typeof createClockMonitor> | undefined,
  stop: (() => Promise<void>) | undefined;
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
try {
  const { values } = parseArgs({
    options: {
      runtime: { type: "string" },
      confirm: { type: "string" },
      batches: { type: "string", default: "1" },
    },
  });
  if (
    process.platform !== "linux" ||
    values.confirm !== "RETIRED_PAYLOADS" ||
    !values.runtime ||
    !/^(?:[1-9][0-9]?|100)$/.test(values.batches!)
  )
    throw new Error("Explicit Linux maintenance invocation required.");
  const connection = maintenanceConfig(
      await privateRuntimeJson(values.runtime, 4096),
    ),
    source = await linuxClockSource();
  pool = new Pool({
    connectionString: connection,
    application_name: "ingenium-offline-retention",
    max: 2,
    connectionTimeoutMillis: 2000,
  });
  monitor = createClockMonitor(pool, source);
  pool.on("error", () => monitor?.guard.fault("DATABASE_UNAVAILABLE"));
  if (
    (await pool.query("SELECT current_user name")).rows[0]?.name !==
    "ingenium_api"
  )
    throw new Error("Restricted maintenance role required.");
  await monitor.start(true);
  stop = maintenanceLoop(
    () => monitor!.pollOnce(),
    5000,
    () => monitor!.guard.fault("PROBE_FAILED"),
  );
  const deadline = performance.now() + 45000;
  let ready = false;
  while (!ready && !controller.signal.aborted && performance.now() < deadline) {
    try {
      monitor.guard.assertHealthy();
      ready = true;
    } catch {
      await delay(250);
    }
  }
  if (!ready || controller.signal.aborted)
    throw new Error("Fresh normal clock trust is required.");
  const result = await offlineRetention(
    pool,
    monitor.guard,
    Number(values.batches),
    controller.signal,
  );
  console.log(JSON.stringify({ event: "retention_completed", ...result }));
  if (result.interrupted) process.exitCode = 1;
} catch {
  console.error(
    "Retention was not fully acknowledged. Preserve records and inspect maintenance status; never clear timing faults, reset permits or force-delete evidence to retry.",
  );
  process.exitCode = 1;
} finally {
  try {
    await stop?.();
    await monitor?.stop();
  } catch {
    console.error(
      "Clock shutdown was not acknowledged; operator review is required.",
    );
    process.exitCode = 1;
  }
  try {
    await pool?.end();
  } catch {
    console.error("Maintenance connection shutdown was not acknowledged.");
    process.exitCode = 1;
  }
}
