import { sha256, uuid } from "../access/credentials.js";
import { acceptJudgeReply, authoringRequest, judgeJson, JUDGE_PROTOCOL, readJudgeJson } from "../content/judge-protocol.js";
import { authoringPayloadDigest } from "../content/execution-policy.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import type { ExecutionClaim } from "./executor.js";

const javaOptions = ["-XX:-UseContainerSupport", "-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-XX:-UsePerfData", "-Xmx256m", "-Xss1m", "-Djava.io.tmpdir=/box"];
const profiles = {
  c: { source: "main.c", compile: ["/usr/local/bin/gcc", "-std=c17", "-O2", "-pass-exit-codes", "-fdiagnostics-format=json", "-fdiagnostics-color=never", "/box/main.c", "-o", "/box/main"], run: ["/box/main"] },
  cpp: { source: "main.cpp", compile: ["/usr/local/bin/g++", "-std=c++17", "-O2", "-pass-exit-codes", "-fdiagnostics-format=json", "-fdiagnostics-color=never", "/box/main.cpp", "-o", "/box/main"], run: ["/box/main"] },
  java: { source: "Main.java", compile: ["/usr/local/java/bin/javac", ...javaOptions.map(option => `-J${option}`), "-XDrawDiagnostics", "-encoding", "UTF-8", "-d", "/box", "/box/Main.java"],
    run: ["/usr/local/java/bin/java", ...javaOptions, "-Dfile.encoding=UTF-8", "-cp", "/box", "Main"] },
  python: { source: "main.py", compile: null, run: ["/usr/local/bin/python3.14", "-I", "-B", "/box/main.py"] },
  javascript: { source: "main.cjs", compile: null, run: ["/usr/local/bin/node", "--max-old-space-size=256", "--v8-pool-size=1", "/box/main.cjs"] },
} as const;
const compilerLimits = { cpuMs: 15000, wallMs: 30000, memoryKb: 1048576 };
const restrictions = { uid: 60000, gid: 60000, processes: 64, stackKb: 65536, fileKb: 16384, openFiles: 256, coreBytes: 0,
  network: false, stdoutBytes: 1048577, diagnosticBytes: 65536, workspaceBytes: 67108864, workspaceInodes: 4096, retainCompiledWorkspace: true } as const;
const environment = { PATH: "/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin", LD_LIBRARY_PATH: "/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server",
  HOME: "/box", TMPDIR: "/box", LANG: "C.UTF-8", JAVA_HOME: "/usr/local/java", UV_THREADPOOL_SIZE: "1" };

export const EXECUTION_PLAN_SHA256 = sha256(JSON.stringify({ version: 2, profiles, compilerLimits, restrictions, environment })).toString("hex");
export function createExecutionPlan(claim: ExecutionClaim, runtimes: JudgeRuntimes) {
  const p = claim.payload; uuid(claim.providerToken); authoringRequest(p, claim.owner, runtimes);
  const profile = profiles[p.language];
  return Object.freeze({ hostEpochId: p.hostEpochId, attemptId: p.attemptId, runId: p.runId, checkId: p.checkId,
    language: p.language, sourceRole: p.sourceRole, checkType: p.checkType, owner: claim.owner, providerToken: claim.providerToken,
    policySha256: EXECUTION_PLAN_SHA256, runtimeKey: p.runtimeKey, runtimeDigest: p.runtimeDigest, sourceFile: profile.source,
    payloadLimits: Object.freeze({ cpuMs: p.cpuMs, wallMs: p.wallMs, memoryKb: p.memoryKb }),
    source: Buffer.from(p.source), stdin: Buffer.from(p.stdin),
    compile: profile.compile ? Object.freeze({ argv: Object.freeze([...profile.compile]), limits: Object.freeze({ ...compilerLimits }) }) : null,
    run: p.checkType === "COMPILATION" ? null : Object.freeze({ argv: Object.freeze([...profile.run]), limits: Object.freeze({ cpuMs: p.cpuMs, wallMs: p.wallMs, memoryKb: p.memoryKb }) }),
    restrictions: Object.freeze({ ...restrictions }), environment: Object.freeze({ ...environment }) });
}
export type ExecutionPlan = ReturnType<typeof createExecutionPlan>;

// Reconstruct at each native boundary; TypeScript types do not protect received objects.
export function reviewedExecutionPlan(plan: ExecutionPlan) {
  const safe = createExecutionPlan({ payload: { ...plan, ...plan.payloadLimits }, owner: plan.owner, providerToken: plan.providerToken },
    new Map([[plan.language, { key: plan.runtimeKey, digest: plan.runtimeDigest }]]));
  if (JSON.stringify({ ...plan, source: null, stdin: null }) !== JSON.stringify({ ...safe, source: null, stdin: null })) {
    throw new Error("Execution plan changed; retain the execution reservation.");
  }
  return safe;
}

// Check before retaining bytes, not only when PostgreSQL is available to seal them.
export function checkedExecutionEvidence(plan: ExecutionPlan, value: unknown) {
  // A compilation witness still carries the original admission limits, not the compiler budget.
  const payload = { ...plan, ...plan.payloadLimits };
  const evidence = readJudgeJson(Buffer.from(judgeJson(value))) as { metadata: { drain: unknown }; stdout_b64: string; stderr_b64: string; compiler_output_b64: string };
  acceptJudgeReply({ protocol: JUDGE_PROTOCOL, request_id: plan.owner, host_epoch_id: plan.hostEpochId, attempt_id: plan.attemptId,
    payload_digest: authoringPayloadDigest(payload).toString("hex"), state: "FINISHED", provider_token: plan.providerToken,
    execution_generation: "1", evidence }, payload, plan.owner, 200);
  return evidence;
}
