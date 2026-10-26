import { Pool } from "pg";
import { rootRuntimeJson } from "../runtime/private-file.js";
import { createProtectedExecutorClient } from "./executor.js";
import { createJudgePublisherStore, createJudgeSupervisorStore } from "./registry.js";
import type { createJudgeQueue } from "./queue.js";
import { parseSupervisorRuntime } from "./supervisor-config.js";
import type { openSupervisorSession, startJudgeSupervisor } from "./supervisor.js";
import { assertJudgeDatabaseRole, JUDGE_DATABASE_POOLS } from "./database-role.js";

async function start() {
  const pools: Pool[] = [], queues: ReturnType<typeof createJudgeQueue>[] = [];
  let session: Awaited<ReturnType<typeof openSupervisorSession>> | undefined;
  let service: Awaited<ReturnType<typeof startJudgeSupervisor>> | undefined;
  let stopping = false;
  const interrupted = new AbortController();
  const stop = () => { stopping = true; interrupted.abort(); void service?.close(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const file = process.env.JUDGE_SUPERVISOR_RUNTIME_FILE;
    if (!file) throw new Error("Private supervisor settings required.");
    const config = parseSupervisorRuntime(await rootRuntimeJson(file, 131072));
    const { createJudgeQueue } = await import("./queue.js");
    const { openSupervisorSession, startJudgeSupervisor } = await import("./supervisor.js");
    const pool = (connectionString: string, max: number) => {
      const value = new Pool({ connectionString, max, connectionTimeoutMillis: 1000, query_timeout: 2500, application_name: "ingenium-judge-supervisor" });
      value.on("error", () => { process.exitCode = 1; stop(); }); pools.push(value); return value;
    };
    const supervisorPool = pool(config.supervisorDatabaseUrl, JUDGE_DATABASE_POOLS.supervisor), publisherPool = pool(config.publisherDatabaseUrl, JUDGE_DATABASE_POOLS.publisher);
    await assertJudgeDatabaseRole(publisherPool, "publisher");
    if (stopping) throw new Error("Startup interrupted.");
    session = await openSupervisorSession(supervisorPool, config);
    const queue = () => { const value = createJudgeQueue({ ...config, ...config.redis }); queues.push(value); return value; };
    if (stopping) throw new Error("Startup interrupted.");
    service = await startJudgeSupervisor({ store: createJudgeSupervisorStore(supervisorPool, config), publisher: createJudgePublisherStore(publisherPool, config),
      session, signal: interrupted.signal, queues: Array.from({length:9},queue), executors: Array.from({length:8},()=>createProtectedExecutorClient(config)), readiness: createProtectedExecutorClient(config) });
    if (stopping) await service.close();
    if (!stopping) console.log("Judge supervisor started; only the verified host can admit or execute work.");
    const result = await service.completion;
    if (result.failed || process.exitCode === 1) {
      console.error(`Judge supervisor fault stage: ${service.failureStage ?? "shutdown"}.`);
      throw new Error("Supervisor stopped after a fault.");
    }
  } catch {
    process.exitCode = 1;
    console.error("Judge supervisor refused or stopped. Preserve original attempts and physical holds; inspect the private host installation.");
  } finally {
    await service?.close();
    try { await session?.close(); } catch { process.exitCode = 1; }
    for (const queue of queues) queue.close();
    await Promise.all(pools.map(pool => pool.end()));
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
  }
}
void start().catch(() => { process.exitCode = 1; console.error("Judge supervisor shutdown was not acknowledged; retain its evidence."); });
