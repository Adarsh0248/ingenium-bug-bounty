import { sha256 } from "../access/credentials.js";
import { checkedExecutionEvidence, reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import type { capturePhaseProcess } from "./phase-pipes.js";
import type { decodeCgroupCounters } from "./cgroup-accounting.js";

export type PhasePipes = Awaited<ReturnType<typeof capturePhaseProcess>>;
export type JobCounters = ReturnType<typeof decodeCgroupCounters>;
const fail = (): never => { throw new Error("Isolate evidence incomplete or inconsistent; retain the execution reservation."); };
const number = (text: string | undefined) => {
  if (typeof text !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(text) || BigInt(text) > 9223372036854775807n) return fail();
  return BigInt(text);
};
const milliseconds = (text: string | undefined) => {
  if (!text || !/^(0|[1-9][0-9]{0,5})\.[0-9]{3}$/.test(text)) return fail();
  return BigInt(text.replace(".", ""));
};
export function readIsolateMetadata(bytes: Buffer) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 4096 || bytes.some(byte => byte !== 10 && (byte < 32 || byte > 126)) || bytes.at(-1) !== 10) return fail();
  const result: Record<string, string> = Object.create(null);
  const numeric = ["max-rss", "csw-voluntary", "csw-forced", "cg-mem", "exitcode", "exitsig", "killed", "cg-oom-killed"];
  for (const line of bytes.toString("ascii").slice(0, -1).split("\n")) {
    const colon = line.indexOf(":"); if (colon < 1) return fail();
    const key = line.slice(0, colon), value = line.slice(colon + 1);
    if (![...numeric, "time", "time-wall", "status", "message"].includes(key) || Object.hasOwn(result, key)) return fail();
    result[key] = value;
    if (numeric.includes(key)) number(value);
  }
  for (const key of ["max-rss", "csw-voluntary", "csw-forced", "cg-mem"]) number(result[key]);
  milliseconds(result.time); milliseconds(result["time-wall"]);
  if (result["cg-oom-killed"] !== undefined && result["cg-oom-killed"] !== "1" || result.killed !== undefined && result.killed !== "1") return fail();
  return result;
}

// Only trusted compiler bytes plus a verified normal compiler exit can reach this check.
export function sourceCompilationError(plan: ExecutionPlan, output: Buffer, truncated: boolean): boolean {
  if (truncated || output.length > 65536) return false;
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(output); } catch { return false; }
  if (plan.language === "c" || plan.language === "cpp") {
    try {
      const rows: unknown = JSON.parse(text);
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > 128) return false;
      let errors = 0;
      for (const row of rows) {
        if (!row || typeof row !== "object" || !["error", "warning", "note"].includes(row.kind) || !Array.isArray(row.locations)) return false;
        if (row.kind !== "error") continue;
        const caret = row.locations[0]?.caret;
        if (!caret || caret.file !== `/box/${plan.sourceFile}` || !Number.isSafeInteger(caret.line) || caret.line < 1
          || caret.line > plan.source.length + 1 || !Number.isSafeInteger(caret.column) || caret.column < 1 || caret.column > plan.source.length + 1) return false;
        if (!Array.isArray(row.children) || row.children.some((child: { kind?: unknown }) => child?.kind !== "note")) return false;
        errors++;
      }
      return errors > 0;
    } catch { return false; }
  }
  if (plan.language === "java") {
    // Conservative source-error codes only; tool, IO, processor and VM failures are not participant mistakes.
    const lines = text.trimEnd().split("\n"), summary = lines.pop();
    if (!summary || !/^[1-9][0-9]{0,2} errors?$/.test(summary) || lines.length !== Number(summary.split(" ")[0])) return false;
    return lines.every(line => /^Main\.java:[1-9][0-9]*:[1-9][0-9]*: compiler\.err\.(?:expected|illegal\.start\.of\.(?:expr|type)|cant\.resolve(?:\.location)?|incompatible\.types|prob\.found\.req|not\.stmt|premature\.eof|unclosed\.(?:str|char)\.lit|class\.public\.should\.be\.in\.file|doesnt\.exist)(?::|$)/.test(line));
  }
  return false;
}

export interface IsolateObservation {
  pipes: PhasePipes;
  metadata: Buffer;
  counters: JobCounters;
  targetObserved: boolean;
  workspaceHasRoom: boolean;
  wallElapsedMs: number;
}
export function isolatePhaseEvidence(plan: ExecutionPlan, kind: "compile" | "run", observation: IsolateObservation) {
  const stage = reviewedExecutionPlan(plan)[kind]; if (!stage) return fail();
  const { pipes, counters, targetObserved, workspaceHasRoom, wallElapsedMs } = observation, meta = readIsolateMetadata(observation.metadata);
  if (pipes.handoffVerified !== true || pipes.managerExitSignal !== null || ![0, 1].includes(pipes.managerExitCode!)
    || typeof targetObserved !== "boolean" || typeof workspaceHasRoom !== "boolean" || !Number.isSafeInteger(wallElapsedMs) || wallElapsedMs < 0 || wallElapsedMs > stage.limits.wallMs + 5000) return fail();
  const cpu = number(counters.cpuNs), peak = number(counters.peakBytes), oom = number(counters.oomKills);
  const hits = number(counters.memoryHits) + number(counters.combinedHits);
  // Isolate reports CPU milliseconds and the larger RAM/memsw peak in KiB; all job tasks must already be gone.
  if (cpu < 1n || peak < 1n || peak > BigInt(stage.limits.memoryKb) * 1024n
    || milliseconds(meta.time) !== cpu / 1000000n || number(meta["cg-mem"]) !== peak / 1024n
    || milliseconds(meta["time-wall"]) > BigInt(stage.limits.wallMs + 2000)
    || cpu > BigInt(stage.limits.cpuMs + 1000) * 1000000n || (meta["cg-oom-killed"] === "1") !== (oom > 0n) || oom > 0n && hits === 0n) return fail();
  let code: number | null = null, signal: number | null = null, cpuLimited = false, wallLimited = false;
  const controls = Object.fromEntries(["status", "message", "exitcode", "exitsig", "killed"].filter(key => Object.hasOwn(meta, key)).map(key => [key, meta[key]]));
  const exact = (expected: Record<string, string>) => Object.keys(controls).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => controls[key] === value);
  if (!meta.status) {
    if (pipes.managerExitCode !== 0 || !exact({ exitcode: "0" }) || oom || hits) return fail();
    code = 0;
  } else if (meta.status === "RE") {
    code = Number(number(meta.exitcode));
    if (pipes.managerExitCode !== 1 || code < 1 || code > 255 || !exact({ status: "RE", exitcode: String(code), message: `Exited with error status ${code}` })) return fail();
  } else if (meta.status === "SG") {
    signal = Number(number(meta.exitsig));
    if (pipes.managerExitCode !== 1 || signal < 1 || signal > 64 || !exact({ status: "SG", exitsig: String(signal), message: `Caught fatal signal ${signal}` })) return fail();
  } else if (meta.status === "TO") {
    if (pipes.managerExitCode !== 1 || Object.keys(controls).some(key => !["status", "message", "killed"].includes(key))) return fail();
    if (meta.message === "Time limit exceeded") {
      cpuLimited = true; if (cpu < BigInt(stage.limits.cpuMs) * 1000000n || milliseconds(meta.time) < BigInt(stage.limits.cpuMs)) return fail();
    } else if (meta.message === "Time limit exceeded (wall clock)") {
      wallLimited = true; if (milliseconds(meta["time-wall"]) < BigInt(stage.limits.wallMs) || wallElapsedMs < stage.limits.wallMs) return fail();
    } else return fail();
  } else return fail();
  const diagnostic = meta.status ? `${meta.message}\n` : `OK (${meta.time} sec real, ${meta["time-wall"]} sec wall)\n`;
  if (!pipes.managerDiagnostics.equals(Buffer.from(diagnostic))) return fail();
  // Only the verified handoff's exec-error record can return normally without executing its target.
  // Signals/forced kills need an observed post-exec inode, not just the pre-exec challenge.
  if (code === null && !targetObserved) return fail();
  const outputLimited = kind === "run" && pipes.outputLimitObserved;
  if (outputLimited !== (pipes.stdout.length === 1048577) || kind === "compile" && (pipes.stdout.length || pipes.stderr.length)
    || !outputLimited && kind === "run" && !pipes.stdoutComplete) return fail();
  const forced = signal !== null && [9, 15, 25].includes(signal), memoryLimited = oom > 0n;
  const sourceError = kind === "compile" && code === 1 && !memoryLimited && !cpuLimited && !wallLimited && hits === 0n
    && workspaceHasRoom && sourceCompilationError(plan, pipes.compiler, pipes.compilerTruncated);
  const infrastructure = kind === "compile" ? code !== 0 && !sourceError || hits > 0n || !workspaceHasRoom
    : forced && !outputLimited && !memoryLimited && !cpuLimited && !wallLimited || hits > 0n && !memoryLimited;
  return { limits: { cpu_ms: stage.limits.cpuMs, wall_ms: stage.limits.wallMs, memory_kb: stage.limits.memoryKb }, identity_verified: true, tree_accounted: true,
    exit_code: code, exit_signal: signal, cpu_limited: cpuLimited, wall_limited: wallLimited, memory_limited: memoryLimited, output_limited: outputLimited,
    infrastructure_error: infrastructure, failure_attribution: infrastructure ? "INFRASTRUCTURE" as const : code === 0 ? null : "PARTICIPANT" as const,
    cpu_ns: counters.cpuNs, peak_bytes: counters.peakBytes };
}
export type IsolatePhaseEvidence = ReturnType<typeof isolatePhaseEvidence>;
export function executionEvidence(plan: ExecutionPlan, compile: { phase: IsolatePhaseEvidence; pipes: PhasePipes } | null, run: { phase: IsolatePhaseEvidence; pipes: PhasePipes } | null) {
  const safe = reviewedExecutionPlan(plan);
  if (Boolean(safe.compile) !== Boolean(compile)) return fail();
  const failedCompile = compile && (compile.phase.exit_code !== 0 || compile.phase.exit_signal !== null || compile.phase.infrastructure_error);
  if (Boolean(safe.run && !failedCompile) !== Boolean(run)) return fail();
  const stdout = run?.pipes.stdout ?? Buffer.alloc(0), stderr = run?.pipes.stderr ?? Buffer.alloc(0), compiler = compile?.pipes.compiler ?? Buffer.alloc(0);
  const capture = (bytes: Buffer) => ({ bytes: bytes.length, sha256: sha256(bytes).toString("hex") });
  return checkedExecutionEvidence(safe, { metadata: { runtime_digest: safe.runtimeDigest, source_sha256: sha256(safe.source).toString("hex"), stdin_sha256: sha256(safe.stdin).toString("hex"),
    compile: compile?.phase ?? null, run: run?.phase ?? null,
    captures: { stdout: { ...capture(stdout), complete: run?.pipes.stdoutComplete ?? true }, stderr: { ...capture(stderr), truncated: run?.pipes.stderrTruncated ?? false },
      compiler: { ...capture(compiler), truncated: compile?.pipes.compilerTruncated ?? false } }, drain: null },
    stdout_b64: stdout.toString("base64"), stderr_b64: stderr.toString("base64"), compiler_output_b64: compiler.toString("base64") });
}
