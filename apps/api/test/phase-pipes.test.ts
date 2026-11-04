import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { acceptNativeStart, isolatePhaseCommand, PhaseCapture, capturePhaseProcess } from "../src/judge/phase-pipes.js";
import { createExecutionPlan } from "../src/judge/execution-plan.js";
import { judgePayload, judgeRuntimes } from "./fixtures/judge.js";

const nonce = () => randomBytes(32).toString("hex");
const plan = (language: Parameters<typeof judgePayload>[0] = "cpp") => createExecutionPlan({ payload: judgePayload(language), owner: randomUUID(), providerToken: randomUUID() }, judgeRuntimes());
test("native start records require one exact fresh challenge and reject forged, missing, oversized or failed exec records", () => {
  const n = nonce(), record = Buffer.from(`INGENIUM_EXEC_V1 ${n}\n`);
  acceptNativeStart(record, n);
  for (const wrong of [Buffer.alloc(0), Buffer.from(`INGENIUM_EXEC_V1 ${nonce()}\n`), Buffer.concat([record, Buffer.from("EXEC_ERROR 2\n")]), Buffer.concat([record, record]), Buffer.from([255]), Buffer.alloc(257)]) {
    assert.throws(() => acceptNativeStart(wrong, n));
  }
  assert.throws(() => acceptNativeStart(record, "bad"));
});
test("stdout retention keeps exact byte boundaries plus one overflow byte, copies chunks and requires EOF for completeness", () => {
  const capture = new PhaseCapture("stdout"), data = Buffer.alloc(1048576, 65);
  assert.equal(capture.push(data), false); data.fill(0);
  assert.equal(capture.snapshot().complete, false); assert.equal(capture.snapshot().bytes[0], 65);
  capture.end(); assert.equal(capture.snapshot().complete, true); assert.throws(() => capture.push(Buffer.alloc(0)));
  const overflow = new PhaseCapture("stdout"); assert.equal(overflow.push(Buffer.alloc(1048578, 255)), true);
  assert.equal(overflow.snapshot().bytes.length, 1048577); overflow.end(); assert.equal(overflow.snapshot().complete, false);
});
test("diagnostics retain at most 64 KiB while detecting truncation without clipping or normalising binary bytes", () => {
  const capture = new PhaseCapture("diagnostic"); capture.push(Buffer.from([0, 255, 13, 10]));
  capture.push(Buffer.alloc(65532, 65)); capture.end(); assert.equal(capture.snapshot().truncated, false);
  assert.deepEqual(capture.snapshot().bytes.subarray(0, 4), Buffer.from([0, 255, 13, 10]));
  const longer = new PhaseCapture("diagnostic"); longer.push(Buffer.alloc(65537)); longer.end();
  assert.equal(longer.snapshot().bytes.length, 65536); assert.equal(longer.snapshot().truncated, true);
});
test("Isolate phase commands use only frozen plans, protected pipes and fixed private paths, never source-provided options", () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
    const p = plan(language), n = nonce(), command = isolatePhaseCommand(p, "run", n);
    assert.equal(command.file, "/usr/local/bin/isolate"); assert.equal(command.wallMs, p.run!.limits.wallMs + 5000);
    assert.ok(command.args.includes("--cg")); assert.ok(command.args.includes("--inherit-fds"));
    assert.equal(p.restrictions.processes,64); assert.ok(command.args.includes("--processes=1024"));
    assert.ok(command.args.includes("--time=1.000")); assert.ok(command.args.includes("--meta=/run/ingenium/control/run.meta"));
    assert.doesNotMatch(command.args.join(" "), /--(?:share-net|full-env|stdin|stdout|stderr|wait)|synthetic fixture/);
    assert.deepEqual(command.args.slice(command.args.indexOf("/usr/local/bin/ingenium-phase-exec") + 1), [n, "3", "4", "--", ...p.run!.argv]);
    if (p.compile) {
      const compile = isolatePhaseCommand(p, "compile", n); assert.equal(compile.wallMs, 35000);
      assert.deepEqual(compile.args.slice(compile.args.indexOf("/usr/local/bin/ingenium-phase-exec") + 1), [n, "3", "1", "--", ...p.compile.argv]);
    }
    else assert.throws(() => isolatePhaseCommand(p, "compile", n));
    assert.throws(() => isolatePhaseCommand({ ...p, run: { ...p.run!, argv: ["/bin/sh"] } }, "run", n));
    assert.throws(() => isolatePhaseCommand({ ...p, sourceFile: "../source" as typeof p.sourceFile }, "run", n));
  }
});
test("phase capture refuses unsafe bounds or cancellation before starting any process", async () => {
  const command = { file: "not-an-executable", args: [] }, base = { nonce: nonce(), kind: "run" as const, wallMs: 1000 };
  for (const options of [{ ...base, wallMs: 35001 }, { ...base, wallMs: 0 }, { ...base, nonce: "wrong" }]) {
    await assert.rejects(capturePhaseProcess(command, Buffer.alloc(0), options, new AbortController().signal));
  }
  await assert.rejects(capturePhaseProcess(command, Buffer.alloc(1048577), base, new AbortController().signal));
  await assert.rejects(capturePhaseProcess(command, Buffer.from("unexpected compiler input"), { ...base, kind: "compile" }, new AbortController().signal));
  await assert.rejects(capturePhaseProcess(command, Buffer.alloc(0), base, AbortSignal.abort()));
});
