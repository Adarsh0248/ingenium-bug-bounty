import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createExecutionPlan, EXECUTION_PLAN_SHA256 } from "../src/judge/execution-plan.js";
import { createIsolateBackend, runIsolatePhases } from "../src/judge/isolate-backend.js";
import { readCapsuleRequest } from "../src/judge/capsule-cli.js";
import { executionRequest } from "../src/judge/executor.js";
import { checkCapsuleMounts, checkCapsuleProcess, ISOLATE_BINARIES } from "../src/judge/isolate-context.js";
import { isolatePhaseEvidence, readIsolateMetadata, sourceCompilationError } from "../src/judge/isolate-evidence.js";
import type { IsolateObservation, PhasePipes } from "../src/judge/isolate-evidence.js";
import type { ExecutionCheckpoints } from "../src/judge/checkpoints.js";
import { acceptJudgeReply, JUDGE_PROTOCOL, judgeJson, runtimeRecord } from "../src/content/judge-protocol.js";
import { acceptAuthoringObservation, authoringPayloadDigest } from "../src/content/execution-policy.js";
import { judgePayload, judgeRuntimes } from "./fixtures/judge.js";

function claim(language: Parameters<typeof judgePayload>[0] = "cpp") {
  const payload = judgePayload(language), owner = randomUUID(), providerToken = randomUUID();
  return { payload, owner, providerToken, plan: createExecutionPlan({ payload, owner, providerToken }, judgeRuntimes()) };
}
function observation(kind: "compile" | "run", extra: { code?: number; signal?: number; timeout?: "cpu" | "wall"; oom?: boolean; overflow?: boolean; compiler?: Buffer; stdout?: Buffer } = {}): IsolateObservation {
  const code = extra.code ?? 0, cpu = extra.timeout === "cpu" ? "1100000000" : "10000000", wall = extra.timeout === "wall" ? "5.100" : "0.020";
  const controls = extra.timeout ? `status:TO\nmessage:Time limit exceeded${extra.timeout === "wall" ? " (wall clock)" : ""}\nkilled:1\n`
    : extra.signal ? `status:SG\nexitsig:${extra.signal}\nmessage:Caught fatal signal ${extra.signal}\n`
      : code ? `status:RE\nexitcode:${code}\nmessage:Exited with error status ${code}\n` : "exitcode:0\n";
  const failed = Boolean(extra.timeout || extra.signal || code);
  const time = extra.timeout === "cpu" ? "1.100" : "0.010";
  const diagnostic = extra.timeout ? `Time limit exceeded${extra.timeout === "wall" ? " (wall clock)" : ""}\n`
    : extra.signal ? `Caught fatal signal ${extra.signal}\n` : code ? `Exited with error status ${code}\n` : `OK (${time} sec real, ${wall} sec wall)\n`;
  return { metadata: Buffer.from(`time:${time}\ntime-wall:${wall}\nmax-rss:4\ncsw-voluntary:1\ncsw-forced:0\ncg-mem:4\n${controls}${extra.oom ? "cg-oom-killed:1\n" : ""}`),
    counters: { cpuNs: cpu, peakBytes: "4096", memoryHits: "0", combinedHits: extra.oom ? "38" : "0", oomKills: extra.oom ? "1" : "0" },
    targetObserved: true, workspaceHasRoom: true, wallElapsedMs: extra.timeout === "wall" ? 5110 : 30,
    pipes: { managerExitCode: failed ? 1 : 0, managerExitSignal: null, managerDiagnostics: Buffer.from(diagnostic),
      stdout: kind === "compile" ? Buffer.alloc(0) : extra.overflow ? Buffer.alloc(1048577, 65) : extra.stdout ?? Buffer.from("12\n"),
      stderr: Buffer.alloc(0), compiler: extra.compiler ?? Buffer.alloc(0), stdoutComplete: !extra.overflow, stderrTruncated: false, compilerTruncated: false,
      handoffVerified: true, outputLimitObserved: Boolean(extra.overflow) } };
}
const compilerError = (name = "main.cpp") => Buffer.from(JSON.stringify([{ kind: "error", locations: [{ caret: { file: `/box/${name}`, line: 1, column: 2 } }], children: [], message: "expected semicolon" }]));
function accepted(c: ReturnType<typeof claim>, evidence: unknown) {
  return acceptJudgeReply({ protocol: JUDGE_PROTOCOL, request_id: c.owner, host_epoch_id: c.payload.hostEpochId, attempt_id: c.payload.attemptId,
    payload_digest: authoringPayloadDigest(c.payload).toString("hex"), state: "FINISHED", provider_token: c.providerToken, execution_generation: "1", evidence }, c.payload, c.owner, 200);
}
test("the complete five-language phase flow preserves exact bytes and leaves acceptance to the frozen checker, not a runner label", async () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
    const c = claim(language), called: string[] = [];
    const value = await runIsolatePhases(c.plan, { async verifySource() { called.push("source"); }, async phase(kind) { called.push(kind); return observation(kind); } }, new AbortController().signal);
    assert.deepEqual(called, c.plan.compile ? ["source", "compile", "run"] : ["source", "run"]);
    const decoded = accepted(c, value); assert.equal(decoded.execution_result, "NORMAL");
    assert.equal(acceptAuthoringObservation(c.payload, decoded, Buffer.from("12\n"), "EXACT_TEXT")!.result, "PASSED");
    assert.equal(acceptAuthoringObservation(c.payload, decoded, Buffer.from("13\n"), "EXACT_TEXT")!.result, "WRONG_ANSWER");
    assert.equal(value.metadata.drain, null); assert.equal(acceptAuthoringObservation(c.payload, decoded, Buffer.from("12\n"), "EXACT_TEXT")!.release, null);
  }
});
test("verified source compilation errors skip the run, while unknown compiler exits remain infrastructure failures", async () => {
  for (const language of ["c", "cpp", "java"] as const) {
    for (const sourceFault of [true, false]) {
      const c = claim(language), output = sourceFault ? language === "java" ? Buffer.from("Main.java:1:2: compiler.err.expected: ';'\n1 error\n") : compilerError(c.plan.sourceFile)
        : Buffer.from("unattributed compiler failure");
      let calls = 0;
      const value = await runIsolatePhases(c.plan, { async verifySource() {}, async phase(kind) { calls++; assert.equal(kind, "compile"); return observation(kind, { code: 1, compiler: output }); } }, new AbortController().signal);
      assert.equal(calls, 1); assert.equal(accepted(c, value).execution_result, sourceFault ? "COMPILATION_ERROR" : "INFRA_ERROR");
    }
  }
});
test("compilation-only checks stop after the compiler and never invent run output", async () => {
  const c = claim("java"); c.payload.checkType = "COMPILATION"; c.payload.stdin = Buffer.alloc(0);
  const plan = createExecutionPlan(c, judgeRuntimes()); let calls = 0;
  const result = await runIsolatePhases(plan, { async verifySource() {}, async phase(kind) { calls++; assert.equal(kind, "compile"); return observation(kind); } }, new AbortController().signal);
  assert.equal(calls, 1); assert.equal(result.stdout_b64, ""); assert.equal(accepted(c, result).execution_result, "NORMAL");
});
test("runtime limits and nonzero/signal outcomes cross the original decoder with overflow/memory/time precedence", async () => {
  for (const [extra, expected] of [[{ code: 3 }, "RUNTIME_ERROR"], [{ signal: 11 }, "RUNTIME_ERROR"], [{ timeout: "cpu" }, "TIME_LIMIT_EXCEEDED"],
    [{ timeout: "wall" }, "TIME_LIMIT_EXCEEDED"], [{ signal: 9, oom: true }, "MEMORY_LIMIT_EXCEEDED"], [{ signal: 13, overflow: true }, "OUTPUT_LIMIT_EXCEEDED"],
    [{ signal: 9 }, "INFRA_ERROR"]] as const) {
    const c = claim("python");
    const value = await runIsolatePhases(c.plan, { async verifySource() {}, async phase() { return observation("run", extra); } }, new AbortController().signal);
    assert.equal(accepted(c, value).execution_result, expected);
  }
});
test("an already cancelled request or failed source verification cannot start even a compiler", async () => {
  const c = claim(); let calls = 0;
  const session = { async verifySource() { throw new Error("source changed"); }, async phase() { calls++; return observation("run"); } };
  await assert.rejects(runIsolatePhases(c.plan, session, AbortSignal.abort()));
  await assert.rejects(runIsolatePhases(c.plan, session, new AbortController().signal)); assert.equal(calls, 0);
});
test("cancellation after compilation never starts the run; failed phase evidence is not converted into a verdict", async () => {
  const c = claim(), cancel = new AbortController(); let calls = 0;
  await assert.rejects(runIsolatePhases(c.plan, { async verifySource() {}, async phase() { calls++; cancel.abort(); return observation("compile"); } }, cancel.signal));
  assert.equal(calls, 1);
  await assert.rejects(runIsolatePhases(c.plan, { async verifySource() {}, async phase() { return { ...observation("compile"), metadata: Buffer.from("status:XX\n") }; } }, new AbortController().signal));
});
test("normal fast exits prove the checked handoff completed; signalled jobs still require an actual post-exec observation", () => {
  const c = claim(); const normal = observation("run"); normal.targetObserved = false;
  assert.equal(isolatePhaseEvidence(c.plan, "run", normal).exit_code, 0);
  const uncertain = observation("run", { signal: 11 }); uncertain.targetObserved = false;
  assert.throws(() => isolatePhaseEvidence(c.plan, "run", uncertain));
});
test("metadata transport is bounded ASCII with exact unique keys, supported controls and integer time precision", () => {
  const valid = observation("run").metadata; assert.equal(readIsolateMetadata(valid).exitcode, "0");
  for (const raw of [Buffer.alloc(0), Buffer.alloc(4097), Buffer.from([255, 10]), valid.subarray(0, -1), Buffer.concat([valid, Buffer.from("time:0.010\n")]),
    Buffer.concat([valid, Buffer.from("unknown:1\n")]), Buffer.from(valid.toString().replace("time:0.010", "time:1e-2")), Buffer.from(valid.toString().replace("cg-mem:4", "cg-mem:01"))]) assert.throws(() => readIsolateMetadata(raw));
});
test("mismatched counters, manager errors, changed exits and unsupported resource causes cannot produce trusted evidence", () => {
  const c = claim(), valid = observation("run");
  for (const wrong of [{ ...valid, counters: { ...valid.counters, cpuNs: "11000000" } }, { ...valid, counters: { ...valid.counters, peakBytes: "8192" } },
    { ...valid, pipes: { ...valid.pipes, managerExitCode: 1 } }, { ...valid, pipes: { ...valid.pipes, managerDiagnostics: Buffer.from("unexpected\n") } },
    { ...valid, pipes: { ...valid.pipes, handoffVerified: false } }, { ...valid, pipes: { ...valid.pipes, stdoutComplete: false } },
    { ...valid, metadata: Buffer.from(valid.metadata.toString().replace("exitcode:0", "status:SG\nexitsig:11\nmessage:Stopped by signal 11")) }]) {
    assert.throws(() => isolatePhaseEvidence(c.plan, "run", wrong as IsolateObservation));
  }
  const premature = observation("run", { timeout: "wall" }); premature.wallElapsedMs = 100;
  assert.throws(() => isolatePhaseEvidence(c.plan, "run", premature));
  const unsupportedOom = observation("run", { signal: 9, oom: true }); unsupportedOom.counters = { ...unsupportedOom.counters, combinedHits: "0" };
  assert.throws(() => isolatePhaseEvidence(c.plan, "run", unsupportedOom));
});
test("compiler blame needs source-bound structured bytes, a normal exit one, complete diagnostics and available storage", () => {
  const c = claim(), good = compilerError(); assert.equal(sourceCompilationError(c.plan, good, false), true);
  for (const bytes of [Buffer.from("error in main.cpp"), compilerError("foreign.cpp"), Buffer.from("[]"), Buffer.from([255]), Buffer.alloc(65537)]) assert.equal(sourceCompilationError(c.plan, bytes, false), false);
  assert.equal(sourceCompilationError(c.plan, good, true), false);
  const full = observation("compile", { code: 1, compiler: good }); full.workspaceHasRoom = false;
  assert.equal(isolatePhaseEvidence(c.plan, "compile", full).infrastructure_error, true);
  const ice = observation("compile", { code: 4, compiler: good }); assert.equal(isolatePhaseEvidence(c.plan, "compile", ice).failure_attribution, "INFRASTRUCTURE");
});
const parent = `/ingenium-exec-${"a".repeat(32)}`, container = "b".repeat(64);
const status = "Uid:\t0\t0\t0\t0\nGid:\t0\t0\t0\t0\nCapPrm:\t00000000002c00e3\nCapEff:\t00000000002c00e3\nCapBnd:\t00000000002c00e3\nCapInh:\t0000000000000000\nCapAmb:\t0000000000000000\nNoNewPrivs:\t1\nSeccomp:\t2\n";
const groups = `3:memory:${parent}/docker/${container}\n2:cpu,cpuacct:${parent}/docker/${container}\n1:pids:${parent}/docker/${container}\n`;
test("capsule process checks refuse ordinary Docker, v2, changed capabilities, foreign parents or missing enforced protections", () => {
  const profile = "ingenium-isolate-executor-v1 (enforce)\n";
  assert.deepEqual(checkCapsuleProcess(status, groups, profile), { parent, container });
  for (const changed of [status.replace("00000000002c00e3", "000001ffffffffff"), status.replace("NoNewPrivs:\t1", "NoNewPrivs:\t0"), status.replace("Seccomp:\t2", "Seccomp:\t0")]) assert.throws(() => checkCapsuleProcess(changed, groups, profile));
  for (const changed of ["0::/\n", groups.replace(/ingenium-exec-/g, "other-"), groups.replace("1:pids:", "1:devices:")]) assert.throws(() => checkCapsuleProcess(status, changed, profile));
  assert.throws(() => checkCapsuleProcess(status, groups, "unconfined\n"));
});
const mounts = () => ["1 0 0:1 / / ro - overlay overlay ro", ...["memory", "cpuacct", "pids"].map((key, i) => `${i + 2} 1 0:${i + 2} ${parent} /run/ingenium/parent/${key} ro,nosuid,nodev,noexec - cgroup cgroup rw,${key === "cpuacct" ? "cpu,cpuacct" : key}`),
  ...["memory", "cpuacct"].map((key, i) => `${i + 5} 1 0:${i + 2} ${parent}/jobs /run/ingenium/cgroups/${key} rw,nosuid,nodev,noexec - cgroup cgroup rw,${key}`)].join("\n") + "\n";
test("capsule mount checks require original read-only parents, bounded delegated v1 subtrees and a read-only image", () => {
  checkCapsuleMounts(mounts(), parent);
  for (const wrong of [mounts().replace("/ / ro", "/ / rw"), mounts().replace("/jobs", "/foreign"), mounts().replace("- cgroup cgroup", "- tmpfs tmpfs"),
    mounts().replace("/parent/memory ro,", "/parent/memory rw,"), mounts() + mounts().split("\n")[0] + "\n"]) assert.throws(() => checkCapsuleMounts(wrong, parent));
});
test("backend recovery is read-only even on an unavailable native platform, and settings bind the original epoch and boot", async () => {
  const c = claim(), boot = randomUUID(); let reads = 0, starts = 0;
  const checkpoints = { hostEpochId: c.plan.hostEpochId, bootId: boot, async read() { reads++; return { begun: true, evidence: null }; }, async begin() { starts++; } } as unknown as ExecutionCheckpoints;
  const settings = { hostEpochId: c.plan.hostEpochId, bootId: boot, runtimes: judgeRuntimes(), binaries: Object.fromEntries(ISOLATE_BINARIES.map(path => [path, "0".repeat(64)])) as Record<typeof ISOLATE_BINARIES[number], string> };
  const backend = createIsolateBackend(settings, checkpoints);
  assert.equal(await backend.recover(c.plan, new AbortController().signal), null); assert.equal(reads, 1); assert.equal(starts, 0);
  await assert.rejects(backend.execute(c.plan, new AbortController().signal)); assert.equal(starts, 0);
  assert.throws(() => createIsolateBackend({ ...settings, bootId: randomUUID() }, checkpoints));
  await assert.rejects(backend.recover({ ...c.plan, hostEpochId: randomUUID() }, new AbortController().signal));
});
function configuration(c: ReturnType<typeof claim>, boot: string) {
  return { schema_version: 1, policy_sha256: EXECUTION_PLAN_SHA256, host_epoch_id: c.plan.hostEpochId, boot_id: boot, attempt_id: c.plan.attemptId,
    permit_owner: c.owner, provider_token: c.providerToken, payload_digest: authoringPayloadDigest(c.payload).toString("hex"), runtimes: runtimeRecord(judgeRuntimes()),
    executables: Object.fromEntries(["isolate", "phase_exec", "gcc", "gpp", "python", "node", "java", "javac"].map(tag => [tag, "0".repeat(64)])) };
}
test("capsule configuration binds one original attempt, owner, provider, complete payload and code policy before any file or process access", () => {
  const c = claim(), boot = randomUUID(), config = configuration(c, boot), bytes = Buffer.from(judgeJson(config));
  for (const operation of ["EXECUTE", "RECOVER"] as const) {
    const request = executionRequest(c, boot, judgeRuntimes(), operation), decoded = readCapsuleRequest(bytes, Buffer.from(judgeJson(request)));
    assert.deepEqual(decoded.claim.payload.source, c.payload.source); assert.equal(decoded.claim.owner, c.owner); assert.equal(decoded.request.operation, operation);
    assert.deepEqual(Object.keys(decoded.settings.binaries), [...ISOLATE_BINARIES]);
  }
  for (const changed of [{ owner: randomUUID() }, { providerToken: randomUUID() }, { payload: { ...c.payload, source: Buffer.from("valid-but-different") } },
    { payload: { ...c.payload, stdin: Buffer.from("changed") } }, { payload: { ...c.payload, cpuMs: 1 } }]) {
    const request = executionRequest({ ...c, ...changed }, boot, judgeRuntimes(), "EXECUTE");
    assert.throws(() => readCapsuleRequest(bytes, Buffer.from(judgeJson(request))));
  }
});
test("capsule admission refuses old policies, extra fields, runtime substitution, malformed secrets and browser-like configuration overrides", () => {
  const c = claim(), boot = randomUUID(), config = configuration(c, boot), request = executionRequest(c, boot, judgeRuntimes(), "EXECUTE");
  for (const changed of [{ policy_sha256: "0".repeat(64) }, { schema_version: 2 }, { extra: true }, { attempt_id: randomUUID() }, { provider_token: "invalid" },
    { executables: { ...config.executables, custom: "0".repeat(64) } }, { runtimes: { ...config.runtimes, cpp: { key: "foreign", digest: "a".repeat(64) } } }]) {
    assert.throws(() => readCapsuleRequest(Buffer.from(judgeJson({ ...config, ...changed })), Buffer.from(judgeJson(request))));
  }
  for (const changed of [{ operation: "READY" }, { callback_url: "http://example.invalid" }, { boot_id: randomUUID() }, { payload: { ...request.payload, command: "/bin/sh" } }]) {
    assert.throws(() => readCapsuleRequest(Buffer.from(judgeJson(config)), Buffer.from(judgeJson({ ...request, ...changed }))));
  }
});
