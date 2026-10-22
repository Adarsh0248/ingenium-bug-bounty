import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { acceptExecutionReply, createProtectedExecutorClient, exchangeProtectedProcess, executionRequest } from "../src/judge/executor.js";
import { authoringRequest, judgeJson, readJudgeJson } from "../src/content/judge-protocol.js";
import { judgePayload, judgeReply, judgeRuntimes } from "./fixtures/judge.js";

const fixture = fileURLToPath(new URL("./fixtures/executor-child.cjs", import.meta.url));
const signal = () => AbortSignal.timeout(10000);
const command = (mode: string) => ({ file: process.execPath, args: [fixture, mode] });
const claim = () => ({ payload: judgePayload(), owner: randomUUID(), providerToken: randomUUID() });
function reply(c: ReturnType<typeof claim>, request: ReturnType<typeof executionRequest>) {
  return { protocol: request.protocol, operation: request.operation, request_id: request.request_id, host_epoch_id: request.host_epoch_id,
    boot_id: request.boot_id, permit_owner: request.permit_owner, reply: judgeReply(c.payload, request.request_id, undefined, c.providerToken) };
}

test("protected handoff binds frozen bytes, boot, owner, token, operation and a fresh challenge without expected answers or execution options", () => {
  const c = claim(), boot = randomUUID(), r = executionRequest(c, boot, judgeRuntimes(), "EXECUTE");
  assert.deepEqual(r.payload, authoringRequest(c.payload, r.request_id, judgeRuntimes()));
  assert.equal(r.boot_id, boot); assert.equal(r.permit_owner, c.owner); assert.equal(r.provider_token, c.providerToken);
  assert.doesNotMatch(judgeJson(r), /expected_output|callback|command|flags|path|password|credential/);
  assert.deepEqual(acceptExecutionReply(reply(c, r), c, r), reply(c, r).reply.evidence);
  for (const field of ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "permit_owner"] as const) assert.throws(() => acceptExecutionReply({ ...reply(c, r), [field]: randomUUID() }, c, r));
  assert.throws(() => acceptExecutionReply({ ...reply(c, r), extra: true }, c, r));
  const foreign = reply(c, r); foreign.reply.provider_token = randomUUID(); assert.throws(() => acceptExecutionReply(foreign, c, r));
});

test("missing retained evidence is recovery only, never an execution result or physical release", () => {
  const c = claim(), r = executionRequest(c, randomUUID(), judgeRuntimes(), "RECOVER");
  assert.equal(acceptExecutionReply({ ...reply(c, r), reply: null }, c, r), null);
  const run = { ...r, operation: "EXECUTE" as const };
  assert.throws(() => acceptExecutionReply({ ...reply(c, run), reply: null }, c, run));
});

test("real launcher pipes preserve a maximum frozen request, binary source/input and strict five-language result evidence", async () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
    const c = claim(); c.payload = judgePayload(language);
    if (language === "cpp") { c.payload.source = Buffer.alloc(131072, 255); c.payload.stdin = Buffer.alloc(1048576, 0); }
    const r = executionRequest(c, randomUUID(), judgeRuntimes(), "EXECUTE"), bytes = Buffer.from(judgeJson(r));
    assert.deepEqual(await exchangeProtectedProcess(command("echo"), bytes, signal()), bytes);
    const result = readJudgeJson(await exchangeProtectedProcess(command("reply"), bytes, signal()));
    const evidence = acceptExecutionReply(result, c, r) as { stdout_b64: string }; assert.equal(Buffer.from(evidence.stdout_b64, "base64").toString(), "12\n");
  }
});

test("launcher failures, oversized output/diagnostics and missing executables remain private errors, never normal results", async () => {
  for (const mode of ["exit", "oversize", "stderr", "stderr-overflow"]) {
    await assert.rejects(exchangeProtectedProcess(command(mode), Buffer.from("{}"), signal()), error => {
      assert.ok(error instanceof Error); assert.doesNotMatch(error.message, /private synthetic diagnostic|AAAA|ENOENT|source/); return true;
    });
  }
  await assert.rejects(exchangeProtectedProcess({ file: `${process.execPath}.absent`, args: [] }, Buffer.from("{}"), signal()), /uncertain/);
  await assert.rejects(exchangeProtectedProcess(command("echo"), Buffer.alloc(2097153), signal()), /bound/);
});

test("empty read-only commands close stdin without writing an empty frame, while exit/diagnostic errors still fail", async () => {
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(await exchangeProtectedProcess({ file: process.execPath, args: ["-e", "process.exit(0)"] }, Buffer.alloc(0), signal()), Buffer.alloc(0));
  }
  for (const mode of ["exit", "stderr-overflow"]) await assert.rejects(exchangeProtectedProcess(command(mode), Buffer.alloc(0), signal()), /uncertain/);
});

test("protected transport refuses duplicate, invalid or excessive inherited descriptors before spawning", async () => {
  for (const inheritedFds of [[2], [-1], [3.5], [NaN], [3, 3], [3, 4, 5, 6]]) {
    await assert.rejects(exchangeProtectedProcess({ ...command("echo"), inheritedFds }, Buffer.alloc(0), signal()), /descriptors/);
  }
  assert.deepEqual(await exchangeProtectedProcess({ ...command("echo"), inheritedFds: [] }, Buffer.from("fixed"), signal()), Buffer.from("fixed"));
});
test("partial or invalid-byte launcher responses cannot pass the canonical result decoder", async () => {
  for (const mode of ["partial", "binary"]) {
    const result = await exchangeProtectedProcess(command(mode), Buffer.from("{}"), signal());
    assert.throws(() => readJudgeJson(result));
  }
});

test("caller cancellation stops the launcher promptly and never treats its exit as sandbox cleanup", async () => {
  const controller = new AbortController(), started = performance.now();
  const result = exchangeProtectedProcess(command("hang"), Buffer.from("{}"), controller.signal);
  await setTimeout(100); controller.abort(); await assert.rejects(result, /uncertain/);
  assert.ok(performance.now() - started < 2000);
  await assert.rejects(exchangeProtectedProcess(command("echo"), Buffer.from("{}"), AbortSignal.abort()));
});

test("whole-launch deadline cannot be extended by an unresponsive helper", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const timed = assert.rejects(exchangeProtectedProcess(command("hang"), Buffer.from("{}"), new AbortController().signal), /uncertain/);
  try { t.mock.timers.tick(90001); await timed; } finally { t.mock.timers.reset(); }
});

test("normal local/Windows startup cannot construct a production executor without a reviewed Linux installation", () => {
  assert.throws(() => createProtectedExecutorClient({ hostEpochId: randomUUID(), bootId: randomUUID(), runtimes: judgeRuntimes(), launcherSha256: "invalid" }), /Linux installation/);
});
