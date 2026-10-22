import { Pool } from "pg";
import { performance } from "node:perf_hooks";
import { privateRuntimeJson } from "../runtime/private-file.js";
import { linuxClockReference } from "../clock/linux-source.js";
import { createWorkerClock } from "../clock/worker-consumer.js";
import { createAuthoringJudgeDriver } from "../content/judge-driver.js";
import { maintenanceLoop } from "../maintenance/loop.js";
import { parseWorkerRuntime } from "./config.js";
import { assertWorkerDatabase, startJudgingWorker } from "./judging.js";

async function start() {
  let pool: Pool | undefined;
  let clock: ReturnType<typeof createWorkerClock> | undefined;
  let worker: ReturnType<typeof startJudgingWorker> | undefined;
  let stopClock: (() => Promise<void>) | undefined;
  let closing = false;
  try {
    const source = linuxClockReference();
    const path = process.env.JUDGING_RUNTIME_FILE;
    if (!path) throw new Error("Private judging runtime required.");
    const config = parseWorkerRuntime(await privateRuntimeJson(path, 131072));
    const driver = createAuthoringJudgeDriver(config.driver);
    pool = new Pool({
      connectionString: config.databaseUrl,
      application_name: "ingenium-app-judging",
      max: 4,
      connectionTimeoutMillis: 1000,
      query_timeout: 2500,
    });
    pool.on("error", () => clock?.guard.fault("DATABASE_UNAVAILABLE"));
    await assertWorkerDatabase(pool);
    clock = createWorkerClock(pool, source);
    let reported = -Infinity;
    stopClock = maintenanceLoop(
      () => clock!.pollOnce(),
      1000,
      () => {
        if (performance.now() - reported >= 60000) {
          reported = performance.now();
          console.error(
            "Judging clock observation unavailable; timed work remains blocked.",
          );
        }
      },
    );
    worker = startJudgingWorker(pool, clock.guard, driver, () =>
      console.error(
        "Judging worker unavailable; original work and physical holds remain preserved.",
      ),
    );
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      try {
        await worker?.close();
        await stopClock?.();
        await clock?.flush();
      } catch {
        console.error(
          "Judging shutdown was not acknowledged; preserve its durable work for inspection.",
        );
        process.exitCode = 1;
      } finally {
        try {
          await pool?.end();
        } catch {
          console.error("Judging database shutdown was not acknowledged.");
          process.exitCode = 1;
        }
      }
    };
    process.once("SIGINT", () => {
      void shutdown();
    });
    process.once("SIGTERM", () => {
      void shutdown();
    });
    // A separately supervised worker must stay alive even while its unreferenced timers are idle.
    const keepAlive = setInterval(() => {}, 60000);
    process.once("SIGINT", () => clearInterval(keepAlive));
    process.once("SIGTERM", () => clearInterval(keepAlive));
    console.log(
      "App judging service started; fresh clock and private judge readiness are required before dispatch.",
    );
  } catch {
    await worker?.close();
    await stopClock?.();
    await pool?.end();
    console.error(
      "App judging startup refused. Review the private configuration, restricted database role and Linux clock installation.",
    );
    process.exitCode = 1;
  }
}
void start().catch(() => {
  console.error("App judging encountered an unexpected startup failure.");
  process.exitCode = 1;
});
