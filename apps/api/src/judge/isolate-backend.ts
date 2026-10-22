import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, statfs } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { uuid } from "../access/credentials.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import { EXECUTION_PLAN_SHA256, reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import type { TrustedSandboxBackend } from "./launcher.js";
import { capsuleIdentity, protectedDirectory, protectedLinuxFile, verifyCapsule, verifyParentBudget } from "./isolate-context.js";
import type { IsolateSettings } from "./isolate-context.js";
import { capturePhaseProcess, isolatePhaseCommand } from "./phase-pipes.js";
import { preparePhaseAccounting } from "./cgroup-accounting.js";
import { executionEvidence, isolatePhaseEvidence } from "./isolate-evidence.js";
import type { IsolateObservation, IsolatePhaseEvidence, PhasePipes } from "./isolate-evidence.js";
import { prepareExecutionWorkspace } from "./workspace.js";
import { phaseInitialisation, phaseResourceRecord } from "./phase-resources.js";
import { captureStorage } from "./capsule-storage.js";

const ISOLATE = "/usr/local/bin/isolate", WORK = "/var/local/lib/isolate/0", CONTROL = "/run/ingenium/control";
const bad = (): never => { throw new Error("Isolate execution or cleanup uncertain; retain the original capsule and reservation."); };
const execute = promisify(execFile);
const absent = async (path: string) => {
  try { await lstat(path); return bad(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
};
async function manager(operation: "init" | "cleanup", signal: AbortSignal) {
  const result = await execute(ISOLATE, ["--cg", "--box-id=0", `--${operation}`], { env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8" },
    cwd: "/", shell: false, timeout: 5000, killSignal: "SIGKILL", maxBuffer: 16384, signal });
  if (result.stderr !== "" || result.stdout !== (operation === "init" ? `${WORK}\n` : "")) return bad();
}

// This private seam is exercised with synthetic observations too; only the real capsule factory below selects native commands.
export interface TrustedIsolateSession {
  verifySource(): Promise<void>;
  phase(kind: "compile" | "run", signal: AbortSignal): Promise<IsolateObservation>;
}
export async function runIsolatePhases(plan: ExecutionPlan, session: TrustedIsolateSession, signal: AbortSignal) {
  const safe = reviewedExecutionPlan(plan); signal.throwIfAborted(); await session.verifySource(); signal.throwIfAborted();
  type Result = { phase: IsolatePhaseEvidence; pipes: PhasePipes } | null;
  let compile: Result = null, run: Result = null;
  if (safe.compile) {
    const observation = await session.phase("compile", signal);
    compile = { phase: isolatePhaseEvidence(safe, "compile", observation), pipes: observation.pipes };
  }
  if (safe.run && (!compile || compile.phase.exit_code === 0 && !compile.phase.infrastructure_error)) {
    signal.throwIfAborted(); const observation = await session.phase("run", signal);
    run = { phase: isolatePhaseEvidence(safe, "run", observation), pipes: observation.pipes };
  }
  return executionEvidence(safe, compile, run);
}

async function nativePhase(plan: ExecutionPlan, kind: "compile" | "run", checkpoints: ExecutionCheckpoints, signal: AbortSignal): Promise<IsolateObservation> {
  signal.throwIfAborted(); await verifyParentBudget();
  await protectedDirectory(CONTROL); await protectedDirectory("/var/local/lib/isolate");
  for (const path of [WORK, "/run/ingenium/cgroups/memory/box-0", "/run/ingenium/cgroups/cpuacct/box-0"]) await absent(path);
  const nonce = randomBytes(32).toString("hex"), command = isolatePhaseCommand(plan, kind, nonce);
  const start = await open(`${CONTROL}/${kind}.started.json`, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_CREAT | constants.O_EXCL, 0o600);
  try {
    await start.writeFile(JSON.stringify({ attempt: plan.attemptId, owner: plan.owner, policy: plan.policySha256, nonce }));
    await start.chmod(0o400); await start.sync();
  } finally { await start.close(); }
  const metadata = await open(`${CONTROL}/${kind}.meta`, constants.O_RDONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let accounting: Awaited<ReturnType<typeof preparePhaseAccounting>> | undefined;
  try {
    const originalMetadata = await metadata.stat();
    const physical = await checkpoints.physical(plan); if (!physical) return bad();
    const initialisation = phaseInitialisation(plan, kind, checkpoints.bootId, physical, nonce);
    await checkpoints.saveCapsule(plan, `${kind}_init`, initialisation); signal.throwIfAborted();
    await manager("init", signal);
    const originalWork = await lstat(WORK);
    if (!originalWork.isDirectory() || originalWork.isSymbolicLink() || originalWork.uid !== 0 || originalWork.gid !== 0 || originalWork.mode & 0o022) return bad();
    accounting = await preparePhaseAccounting(plan, kind);
    await checkpoints.saveCapsule(plan, `${kind}_groups`, phaseResourceRecord(initialisation, await accounting.originalGroups()));
    signal.throwIfAborted();
    const cancel = new AbortController(), phaseSignal = AbortSignal.any([signal, cancel.signal]);
    let finished = false, failure: unknown = null, pipes: PhasePipes | undefined, targetObserved = false;
    const startedAt = process.hrtime.bigint();
    const capture = capturePhaseProcess(command, kind === "compile" ? Buffer.alloc(0) : plan.stdin,
      { kind, nonce, wallMs: command.wallMs }, phaseSignal).then(value => { pipes = value; }, error => { failure = error; }).finally(() => { finished = true; });
    try {
      while (!finished) { targetObserved = await accounting.observeTarget() || targetObserved; if (!finished) await setTimeout(2); }
    } catch (error) { cancel.abort(); failure = error; }
    await capture;
    const wallElapsedMs = Number((process.hrtime.bigint() - startedAt + 999999n) / 1000000n);
    if (failure || !pipes) return bad();
    const counters = await accounting.readStoppedCounters();
    await verifyParentBudget();
    const info = await lstat(`${CONTROL}/${kind}.meta`);
    if (!info.isFile() || info.isSymbolicLink() || info.dev !== originalMetadata.dev || info.ino !== originalMetadata.ino || info.uid !== 0 || info.gid !== 0
      || (info.mode & 0o7777) !== 0o600 || info.nlink !== 1 || info.size > 4096) return bad();
    const raw = await protectedLinuxFile(`${CONTROL}/${kind}.meta`, 4096), workspace = await statfs("/run/ingenium/workspace");
    const observation = { pipes, metadata: raw, counters, targetObserved, wallElapsedMs, workspaceHasRoom: workspace.bavail * workspace.bsize >= 65536 && workspace.ffree >= 8 };
    isolatePhaseEvidence(plan, kind, observation);
    // Cleanup is allowed only after original groups are empty and all result observations have been checked.
    const work = await lstat(WORK);
    if (work.dev !== originalWork.dev || work.ino !== originalWork.ino || work.isSymbolicLink()) return bad();
    await accounting.readStoppedCounters(); await accounting.close(); accounting = undefined;
    await manager("cleanup", signal);
    for (const path of [WORK, "/run/ingenium/cgroups/memory/box-0", "/run/ingenium/cgroups/cpuacct/box-0"]) await absent(path);
    return observation;
  } finally { await accounting?.close(); await metadata.close(); }
}

// Per-capsule backend, not a Docker provisioner or a primary-host readiness authority.
export function createIsolateBackend(settings: IsolateSettings, checkpoints: ExecutionCheckpoints): TrustedSandboxBackend {
  const copied: IsolateSettings = { hostEpochId: uuid(settings.hostEpochId), bootId: uuid(settings.bootId),
    runtimes: new Map([...settings.runtimes].map(([key, value]) => [key, { ...value }])), binaries: { ...settings.binaries } };
  runtimeRecord(copied.runtimes); let busy = false;
  if (checkpoints.hostEpochId !== copied.hostEpochId || checkpoints.bootId !== copied.bootId) return bad();
  function bound(plan: ExecutionPlan) {
    const safe = reviewedExecutionPlan(plan), runtime = copied.runtimes.get(safe.language);
    if (safe.hostEpochId !== copied.hostEpochId || !runtime || runtime.key !== safe.runtimeKey || runtime.digest !== safe.runtimeDigest) return bad();
    return safe;
  }
  return {
    policySha256: EXECUTION_PLAN_SHA256,
    async assertReady(signal) { await checkpoints.assertReady(); return verifyCapsule(copied, signal); },
    async execute(plan, signal) {
      signal.throwIfAborted(); if (busy) return bad(); busy = true;
      let workspace: Awaited<ReturnType<typeof prepareExecutionWorkspace>> | undefined;
      try {
        const safe = bound(plan); await verifyCapsule(copied, signal); await checkpoints.begin(safe, signal);
        const physical = await capsuleIdentity();
        await checkpoints.bindPhysical(safe, physical); signal.throwIfAborted();
        await checkpoints.saveCapsule(safe, "storage", await captureStorage(safe, copied.bootId, physical, signal));
        workspace = await prepareExecutionWorkspace(safe, signal);
        const evidence = await runIsolatePhases(safe, { verifySource: workspace.verifyBeforeFirstPhase, phase: (kind, phaseSignal) => nativePhase(safe, kind, checkpoints, phaseSignal) }, signal);
        // Save genuine completed bytes even after caller cancellation; this never launches another phase.
        return await checkpoints.save(safe, evidence);
      } finally { await workspace?.close(); busy = false; }
    },
    async recover(plan, signal) { signal.throwIfAborted(); return (await checkpoints.read(bound(plan))).evidence; },
  };
}
