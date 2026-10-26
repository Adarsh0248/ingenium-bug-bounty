import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { privateRuntimeJson } from "../runtime/private-file.js";
import { parseGatewayRuntime } from "./gateway-config.js";
import { buildJudgeGateway } from "./gateway.js";
import { createJudgeRegistry } from "./registry.js";
import { assertJudgeDatabaseRole, JUDGE_DATABASE_POOLS } from "./database-role.js";

async function start() {
  let pool: Pool | undefined, app: ReturnType<typeof buildJudgeGateway> | undefined;
  const stopped = new AbortController();
  const stop = () => { stopped.abort(); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const file = process.env.JUDGE_GATEWAY_RUNTIME_FILE;
    if (!file) throw new Error("Private gateway settings required.");
    const config = parseGatewayRuntime(await privateRuntimeJson(file, 131072));
    if ((await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim() !== config.bootId) throw new Error("Wrong judge boot.");
    pool = new Pool({ connectionString: config.databaseUrl, max: JUDGE_DATABASE_POOLS.gateway, connectionTimeoutMillis: 1000, query_timeout: 2500, application_name: "ingenium-judge-gateway" });
    pool.on("error", () => { process.exitCode = 1; stop(); });
    await assertJudgeDatabaseRole(pool, "gateway");
    stopped.signal.throwIfAborted();
    app = buildJudgeGateway({ ...config, registry: createJudgeRegistry(pool, config) });
    await app.listen({ host: config.listenAddress, port: config.port });
    if (!stopped.signal.aborted) console.log("Private judge gateway started; admission requires the supervisor's verified readiness.");
    if (!stopped.signal.aborted) await new Promise<void>(resolve => stopped.signal.addEventListener("abort", () => resolve(), { once: true }));
  } catch {
    process.exitCode = 1;
    console.error("Judge gateway refused or stopped. Review its private settings, restricted role, boot and TLS installation.");
  } finally {
    await app?.close(); await pool?.end();
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
  }
}
void start().catch(() => { process.exitCode = 1; console.error("Judge gateway shutdown was not acknowledged."); });
