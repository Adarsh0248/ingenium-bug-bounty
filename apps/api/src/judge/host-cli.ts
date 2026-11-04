import { writeSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setPriority } from "node:os";
import { rootRuntimeJson } from "../runtime/private-file.js";
import { judgeJson, JUDGE_BODY_LIMIT, readJudgeJson } from "../content/judge-protocol.js";
import { parseHostRuntime } from "./host-config.js";
import { openExecutionCheckpoints } from "./checkpoints.js";
import { createCapsuleRecovery } from "./capsule-backend.js";
import { createGuardedLauncher } from "./launcher.js";
import { createExecutionPlan } from "./execution-plan.js";
import { judgeFaultDiagnostic } from "./fault-diagnostic.js";
import {readParticipantBatch,participantBatchWallBudget} from '../content/batch-protocol.js';

const FILE = "/etc/ingenium/judge-launcher.json";
async function main() {
  const option = process.argv[2];
  if (process.platform !== "linux" || process.getuid?.() !== 0 || process.argv.length !== 3
    || !["--ready", "--execute", "--recover", "--prepare-host", "--retire"].includes(option!)) throw new Error("Protected host command required.");
  // Keep fresh health observations responsive when all eight execution slots verify their installations.
  if (["--execute", "--recover", "--retire"].includes(option!)) setPriority(0, 10);
  process.umask(0o077);
  const stop = new AbortController(), abort = () => stop.abort();
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  let deadline = setTimeout(() => process.exit(125), 85000); deadline.unref();
  let signal = AbortSignal.any([stop.signal, AbortSignal.timeout(80000)]);
  const config = parseHostRuntime(await rootRuntimeJson(FILE, 4194304));
  const { Pool } = await import("pg"), { assertJudgeDatabaseRole } = await import("./database-role.js"),
    { createJudgeSupervisorStore } = await import("./registry.js");
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1000, query_timeout: 2500, application_name: "ingenium-protected-launcher" });
  pool.on("error", abort);
  let checkpoints: Awaited<ReturnType<typeof openExecutionCheckpoints>> | undefined;
  let host: Awaited<ReturnType<typeof import("./host-verification.js")["openVerifiedHost"]>> | undefined;
  let active: ReturnType<typeof import("./host-backend.js")["createHostBackend"]> | undefined;
  try {
    await assertJudgeDatabaseRole(pool, "supervisor"); signal.throwIfAborted();
    const store = createJudgeSupervisorStore(pool, config);
    checkpoints = await openExecutionCheckpoints(config.hostEpochId, config.bootId);
    let output: Buffer;
    if (option === "--prepare-host") {
      const { openVerifiedHost } = await import("./host-verification.js");
      host = await openVerifiedHost(config, config.release, config.manifest, signal);
      output = Buffer.from(judgeJson({ protocol: "ingenium-host-preparation-v1", proof_digest: (await host.prepare(signal)).toString("hex") }));
    } else {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of process.stdin) { signal.throwIfAborted(); const bytes = Buffer.from(chunk); size += bytes.length; if (size > JUDGE_BODY_LIMIT) throw new Error("Oversized host request."); chunks.push(bytes); }
      const raw = Buffer.concat(chunks, size), operation = option === "--retire" ? "RECOVER" : option!.slice(2).toUpperCase() as "READY" | "EXECUTE" | "RECOVER";
      let batch:Awaited<ReturnType<typeof store.batchForAttempt>>=null;
      if(operation!=='READY'){
        const request=readJudgeJson(raw) as {payload?:{attempt_id?:string}};
        if(request.payload?.attempt_id)batch=await store.batchForAttempt(request.payload.attempt_id);
        if(batch&&operation==='EXECUTE'){
          const decoded=readParticipantBatch(batch.raw,{...batch,hostEpochId:config.hostEpochId},config.runtimes),budget=participantBatchWallBudget(decoded.cases)+60000;
          clearTimeout(deadline);deadline=setTimeout(()=>process.exit(125),budget+5000);deadline.unref();
          signal=AbortSignal.any([stop.signal,AbortSignal.timeout(budget)]);
        }
      }
      let backend = createCapsuleRecovery(checkpoints, config.release, config.runtimes);
      const recovery=backend;
      if(batch)backend={...recovery,async recover(plan,current){
        const evidence=await recovery.recover(plan,current);
        if(evidence!==null){
          const result=await checkpoints!.readCapsuleRecord(plan,'batch_result');
          if(result===null)throw new Error('Original batch result checkpoint missing.');
          await store.sealBatch(plan.attemptId,plan.providerToken,plan.owner,result);
        }
        return evidence;
      }};
      if (option !== "--recover") {
        const { openVerifiedHost } = await import("./host-verification.js"), { createHostBackend } = await import("./host-backend.js");
        host = await openVerifiedHost(config, config.release, config.manifest, signal);
        active = createHostBackend(store, checkpoints, host, {...config,...(batch?{batch}:{})}, config.release); backend = active;
      }
      const launcher = createGuardedLauncher(store, backend);
      output = await launcher.handle(raw, operation, signal);
      if (option === "--retire") {
        // Only this explicit root maintenance command mutates old resources; ordinary RECOVER stays read-only.
        const request = readJudgeJson(raw) as { payload: { attempt_id: string } }, original = await store.execution(request.payload.attempt_id);
        if (!original?.started) throw new Error("Original execution required.");
        const plan = createExecutionPlan({ payload: original.payload, owner: original.owner, providerToken: original.providerToken }, store.runtimes);
        const evidence = await active!.retire(plan, signal);
        if (evidence !== null) await store.seal(original.payload, original.providerToken, original.owner, evidence);
        output = await launcher.handle(raw, "RECOVER", signal);
      }
    }
    signal.throwIfAborted();
    await new Promise<void>((done, reject) => process.stdout.write(output, error => error ? reject(error) : done()));
  } finally {
    const closed = await Promise.allSettled([active?.close(), host?.close(), checkpoints?.close(), pool.end()]);
    clearTimeout(deadline);
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
    if (closed.some(result => result.status === "rejected")) throw new Error("Protected host close uncertain; retain its reservation.");
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { try {
    writeSync(2, "Protected host refused; preserve original attempts, inspection intents and physical holds.\n");
    writeSync(2, "Protected host diagnostic: " + JSON.stringify(judgeFaultDiagnostic(error)) + "\n");
    const frames=error instanceof Error?error.stack?.split("\n").slice(1).filter(line=>/\/opt\/ingenium\/judge-executor\/app\/[a-zA-Z0-9_./-]+\.js:\d+:\d+/.test(line)).slice(0,6):[];
    for(const frame of frames??[])writeSync(2,frame.slice(0,256)+"\n");
  } finally { process.exit(125); } });
