import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { promisify } from "node:util";
import { capturePhaseProcess } from "/workspace/apps/api/dist/judge/phase-pipes.js";
import { createExecutionPlan } from "/workspace/apps/api/dist/judge/execution-plan.js";
import { sourceCompilationError } from "/workspace/apps/api/dist/judge/isolate-evidence.js";

const exec = promisify(execFile);
const environment = { PATH: "/usr/bin:/bin", LANG: "C.UTF-8" };
const tool = async (file, args) => (await exec(file, args, { timeout: 15000, maxBuffer: 16384, cwd: "/box", env: environment })).stdout;
await tool("/usr/bin/gcc", ["-std=c17", "-O2", "-Wall", "-Wextra", "-Werror", "-static", "-D_FORTIFY_SOURCE=3", "-fstack-protector-strong", "-Wl,-z,noexecstack", "/run/phase-exec.c", "-o", "/box/phase-exec"]);
await chmod("/box/phase-exec", 0o555);
assert.doesNotMatch(await tool("/usr/bin/readelf", ["-l", "/box/phase-exec"]), /INTERP/);
await tool("/usr/bin/gcc", ["-std=c17", "-O2", "-Wall", "-Wextra", "-Werror", "/run/native-target.c", "-o", "/box/native-target"]);
const nonce = () => randomBytes(32).toString("hex");
const signal = () => AbortSignal.timeout(15000);
const invoke = (target, args = [], input = Buffer.alloc(0), options = {}) => {
  const n = nonce();
  return capturePhaseProcess({ file: "/box/phase-exec", args: [n, "3", options.kind === "compile" ? "1" : "4", "--", target, ...args] }, input,
    { nonce: n, kind: "run", wallMs: 10000, ...options }, signal());
};
if (process.env.INGENIUM_NATIVE_EXPECT_DENIAL === "1") {
  test("native exec refuses the deliberately wrong identity or missing no-new-privileges before target startup", async () => {
    const status = await readFile("/proc/self/status", "ascii");
    assert.ok(process.getuid() === 0 || /^NoNewPrivs:\s+0$/m.test(status));
    await assert.rejects(invoke("/box/native-target", ["identity"]), /handoff missing/);
  });
} else {
  test("native handoff enforces post-exec identity, limits, signal defaults, exact environment and closure of descriptor 400", async () => {
    const n = nonce(), result = await capturePhaseProcess({ file: "/box/native-target", args: ["--wrap", n, "identity"] }, Buffer.alloc(0),
      { nonce: n, kind: "run", wallMs: 10000 }, signal());
    assert.equal(result.managerExitCode, 0); assert.equal(result.managerExitSignal, null); assert.equal(result.handoffVerified, true);
    const lines = result.stdout.toString("ascii").trimEnd().split("\n"); assert.equal(lines.shift(), "IDENTITY_AND_FDS_OK");
    const actual = Object.fromEntries(lines.map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
    const payload = { hostEpochId: randomUUID(), attemptId: randomUUID(), runId: randomUUID(), checkId: randomUUID(), language: "cpp", runtimeKey: "synthetic-cpp",
      runtimeDigest: "c".repeat(64), sourceRole: "REFERENCE", checkType: "TEST_CASE", source: Buffer.from("fixture"), stdin: Buffer.alloc(0), cpuMs: 1000, wallMs: 5000, memoryKb: 262144 };
    const expected = createExecutionPlan({ payload, owner: randomUUID(), providerToken: randomUUID() }, new Map([["cpp", { key: payload.runtimeKey, digest: payload.runtimeDigest }]])).environment;
    assert.equal(lines.length, Object.keys(expected).length); assert.deepEqual(actual, expected);
    assert.equal(result.managerDiagnostics.length, 0); assert.equal(result.stderr.length, 0);
  });
  test("real fixed C17 and C++17 programs compile through the native handoff and produce three exact 64-bit sums", async () => {
    for (const [language, compiler, standard, source] of [["c", "/usr/bin/gcc", "-std=c17", "/run/sum.c"], ["cpp", "/usr/bin/g++", "-std=c++17", "/run/sum.cpp"]]) {
      const target = `/box/sum-${language}`;
      const compiled = await invoke(compiler, [standard, "-O2", source, "-o", target], Buffer.alloc(0), { kind: "compile", wallMs: 15000 });
      assert.equal(compiled.managerExitCode, 0); assert.equal(compiled.compiler.length, 0); assert.equal(compiled.handoffVerified, true);
      for (const [input, expected] of [["7 5\n", "12\n"], ["-9 4\n", "-5\n"], ["2147483647 1\n", "2147483648\n"]]) {
        const result = await invoke(target, [], Buffer.from(input)); assert.equal(result.managerExitCode, 0);
        assert.equal(result.stdout.toString(), expected); assert.equal(result.stdoutComplete, true); assert.equal(result.stderr.length, 0);
      }
    }
  });
  test("stdin and stdout preserve the maximum 1 MiB input including NUL, invalid UTF-8 and CRLF", async () => {
    const input = Buffer.alloc(1048576); for (let i = 0; i < input.length; i++) input[i] = i % 256;
    const result = await invoke("/box/native-target", ["echo"], input);
    assert.equal(result.managerExitCode, 0); assert.deepEqual(result.stdout, input); assert.equal(result.stdoutComplete, true);
    const ignored = await invoke("/box/native-target", ["boundary"], input);
    assert.equal(ignored.managerExitCode, 0); assert.equal(ignored.stdoutComplete, true); assert.equal(ignored.stdout.length, 1048576);
  });
  test("real C17/C++17 syntax failures produce complete source-bound structured diagnostics, not generic error-string guesses", async () => {
    for (const [language, compiler] of [["c", "/usr/bin/gcc"], ["cpp", "/usr/bin/g++"]]) {
      const payload = { hostEpochId: randomUUID(), attemptId: randomUUID(), runId: randomUUID(), checkId: randomUUID(), language, runtimeKey: `synthetic-${language}`,
        runtimeDigest: "c".repeat(64), sourceRole: "REFERENCE", checkType: "TEST_CASE", source: Buffer.from("int main(void) { return 0 }\n"), stdin: Buffer.alloc(0), cpuMs: 1000, wallMs: 5000, memoryKb: 262144 };
      const plan = createExecutionPlan({ payload, owner: randomUUID(), providerToken: randomUUID() }, new Map([[language, { key: payload.runtimeKey, digest: payload.runtimeDigest }]]));
      await writeFile(`/box/${plan.sourceFile}`, payload.source);
      const result = await invoke(compiler, plan.compile.argv.slice(1), Buffer.alloc(0), { kind: "compile" });
      assert.equal(result.managerExitCode, 1); assert.equal(result.compilerTruncated, false);
      assert.equal(sourceCompilationError(plan, result.compiler, false), true);
    }
  });
  test("the additional real syscall filter blocks new namespaces, tracing and networking while permitting ordinary fork", async () => {
    const result = await invoke("/box/native-target", ["syscall-filter"]);
    assert.equal(result.managerExitCode, 0); assert.equal(result.stdout.toString(), "FILTER_AND_FORK_OK\n");
  });
  test("real Node console IO and worker threads function behind the additional syscall filter", async () => {
    const code = "const {Worker}=require('node:worker_threads');const w=new Worker('require(\"node:worker_threads\").parentPort.postMessage(12)',{eval:true});w.once('message',n=>process.stdout.write(n+'\\n'));";
    const result = await invoke("/usr/local/bin/node", ["--max-old-space-size=128", "--v8-pool-size=1", "-e", code]);
    assert.equal(result.managerExitCode, 0); assert.equal(result.stdout.toString(), "12\n"); assert.equal(result.stderr.length, 0);
  });
  test("stdout at exactly 1 MiB is complete; overflow retains one proof byte without unbounded buffering", async () => {
    const exact = await invoke("/box/native-target", ["boundary"]); assert.equal(exact.stdout.length, 1048576);
    assert.equal(exact.stdoutComplete, true); assert.equal(exact.outputLimitObserved, false);
    const overflow = await invoke("/box/native-target", ["overflow"]);
    assert.equal(overflow.stdout.length, 1048577); assert.equal(overflow.stdoutComplete, false); assert.equal(overflow.outputLimitObserved, true);
  });
  test("stderr and combined compiler diagnostics are drained but retained only up to 64 KiB", async () => {
    const result = await invoke("/box/native-target", ["diagnostics"]);
    assert.equal(result.managerExitCode, 0); assert.equal(result.stderr.length, 65536); assert.equal(result.stderrTruncated, true);
    const compiled = await invoke("/box/native-target", ["mixed"], Buffer.alloc(0), { kind: "compile" });
    assert.equal(compiled.managerExitCode, 0); assert.equal(compiled.compiler.length, 65536); assert.equal(compiled.compilerTruncated, true);
    const ordered = await invoke("/box/native-target", ["ordered"], Buffer.alloc(0), { kind: "compile" });
    assert.equal(ordered.compiler.toString(), Array.from({ length: 1000 }, (_, i) => `out:${i}\nerr:${i}\n`).join(""));
    assert.equal(ordered.compilerTruncated, false);
  });
  test("replacing workspace stdout/stderr files cannot replace captured bytes", async () => {
    const result = await invoke("/box/native-target", ["replace"]);
    assert.equal(result.stdout.toString(), "12\n"); assert.equal(result.stderr.toString(), "real error\n");
    assert.equal(await readFile("/box/stdout", "ascii"), "forged file output");
  });
  test("target text cannot forge the protected witness and inherited control descriptors are inaccessible after exec", async () => {
    const result = await invoke("/box/native-target", ["forge"]); assert.equal(result.managerExitCode, 0);
    assert.equal(result.stdout.toString(), "INGENIUM_EXEC_V1 forged\nFD_CLOSED\n"); assert.equal(result.handoffVerified, true);
  });
  test("failed exec, wrong challenge and invalid descriptors stay infrastructure uncertainty, never compiler/program verdicts", async () => {
    await assert.rejects(invoke("/unmapped/missing-executable"), /handoff missing/);
    for (const [nativeNonce, witness] of [[nonce(), "3"], ["z".repeat(64), "3"], [nonce(), "1"], [nonce(), "03"]]) {
      await assert.rejects(capturePhaseProcess({ file: "/box/phase-exec", args: [nativeNonce, witness, "4", "--", "/box/native-target", "identity"] }, Buffer.alloc(0),
        { nonce: nonce(), kind: "run", wallMs: 1000 }, signal()));
    }
    await assert.rejects(capturePhaseProcess({ file: "/unmapped/missing-manager", args: [] }, Buffer.alloc(0), { nonce: nonce(), kind: "run", wallMs: 1000 }, signal()));
  });
  test("closing output early cannot finish a live process, and the whole-phase deadline remains bounded", async () => {
    const start = performance.now(); await assert.rejects(invoke("/box/native-target", ["hang"], Buffer.alloc(0), { wallMs: 300 }), /uncertain/);
    assert.ok(performance.now() - start < 3000);
  });
  test("caller cancellation stops collection without treating manager exit as a physical drain proof", async () => {
    const n = nonce(), controller = new AbortController();
    const promise = capturePhaseProcess({ file: "/box/phase-exec", args: [n, "3", "4", "--", "/box/native-target", "hang"] }, Buffer.alloc(0),
      { nonce: n, kind: "run", wallMs: 10000 }, controller.signal);
    const rejected = assert.rejects(promise, /uncertain/); setTimeout(() => controller.abort(), 200); await rejected;
  });
}
