import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { checkedExecutionEvidence, createExecutionPlan, EXECUTION_PLAN_SHA256 } from "../src/judge/execution-plan.js";
import { judgePayload, judgeReply, judgeRuntimes } from "./fixtures/judge.js";

const claim = (language: Parameters<typeof judgePayload>[0] = "cpp") => ({ payload: judgePayload(language), owner: randomUUID(), providerToken: randomUUID() });
test("general execution plans select only the reviewed five-language filenames, argv and compiler/run budgets", () => {
  assert.match(EXECUTION_PLAN_SHA256, /^[0-9a-f]{64}$/);
  const expected = { c: ["main.c", "gcc", "-std=c17"], cpp: ["main.cpp", "g++", "-std=c++17"], java: ["Main.java", "javac"], python: ["main.py", "python3.14"], javascript: ["main.cjs", "node"] };
  for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
    const c = claim(language), plan = createExecutionPlan(c, judgeRuntimes());
    assert.equal(plan.sourceFile, expected[language][0]);
    assert.equal((plan.compile?.argv[0] ?? plan.run!.argv[0])!.split("/").at(-1), expected[language][1]);
    if (language === "c" || language === "cpp") assert.ok(plan.compile!.argv.includes(expected[language][2]!));
    if (plan.compile) assert.deepEqual(plan.compile.limits, { cpuMs: 15000, wallMs: 30000, memoryKb: 1048576 });
    assert.deepEqual(plan.run!.limits, { cpuMs: c.payload.cpuMs, wallMs: c.payload.wallMs, memoryKb: c.payload.memoryKb });
    assert.equal(plan.restrictions.uid, 60000); assert.equal(plan.restrictions.gid, 60000); assert.equal(plan.restrictions.network, false);
    assert.equal(plan.restrictions.openFiles, 256); assert.equal(plan.restrictions.coreBytes, 0);
    assert.ok(Object.isFrozen(plan.run!.argv)); assert.ok(Object.isFrozen(plan.environment));
    assert.equal(plan.environment.TMPDIR, "/box"); assert.equal(plan.environment.UV_THREADPOOL_SIZE, "1");
  }
});

test("checkpoint validation preserves every original payload field and rejects unbound or incomplete evidence before retention", () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
    const c = claim(language), plan = createExecutionPlan(c, judgeRuntimes());
    const value = judgeReply(c.payload, c.owner, undefined, c.providerToken).evidence;
    const checked = checkedExecutionEvidence(plan, value);
    assert.deepEqual(checked, value); assert.notEqual(checked, value);
    value.stdout_b64 = "Y2hhbmdlZA=="; assert.equal(checked.stdout_b64, "MTIK");
    assert.throws(() => checkedExecutionEvidence(plan, value));
    value.stdout_b64 = "MTIK"; value.metadata.runtime_digest = "0".repeat(64);
    assert.throws(() => checkedExecutionEvidence(plan, value));
    assert.throws(() => checkedExecutionEvidence(plan, { ...checked, unexpected: true }));
  }
});
test("checkpoint compilation witnesses validate the original admitted limits without replacing them with compiler limits", () => {
  const c = claim("java"); c.payload.checkType = "COMPILATION"; c.payload.stdin = Buffer.alloc(0);
  const plan = createExecutionPlan(c, judgeRuntimes()), value = judgeReply(c.payload, c.owner, Buffer.alloc(0), c.providerToken).evidence;
  assert.deepEqual(plan.payloadLimits, { cpuMs: 1000, wallMs: 5000, memoryKb: 262144 });
  assert.ok(checkedExecutionEvidence(plan, value));
  value.metadata.compile!.limits.cpu_ms = 1; assert.throws(() => checkedExecutionEvidence(plan, value));
});
test("plans preserve exact input bytes without allowing source text to become an argument or environment option", () => {
  const c = claim(); c.payload.source = Buffer.from("'; /bin/sh\0\r\n"); c.payload.stdin = Buffer.from([0, 255, 10]);
  const plan = createExecutionPlan(c, judgeRuntimes());
  assert.deepEqual(plan.source, c.payload.source); assert.deepEqual(plan.stdin, c.payload.stdin);
  assert.notEqual(plan.source, c.payload.source); assert.notEqual(plan.stdin, c.payload.stdin);
  plan.source.fill(0); plan.stdin.fill(0); assert.notEqual(c.payload.source[0], 0); assert.equal(c.payload.stdin[1], 255);
  assert.doesNotMatch(JSON.stringify([plan.compile!.argv, plan.run!.argv, plan.environment]), /\/bin\/sh|expected_output|callback|NODE_OPTIONS|CLASSPATH/);
  assert.throws(() => createExecutionPlan({ ...c, providerToken: "not-a-token" }, judgeRuntimes()));
  assert.throws(() => createExecutionPlan({ ...c, payload: { ...c.payload, runtimeKey: "unregistered" } }, judgeRuntimes()));
});
test("compilation witnesses have no run phase and Java retains the whole compiled workspace, not only Main.class", () => {
  const c = claim("java"); c.payload.checkType = "COMPILATION"; c.payload.stdin = Buffer.alloc(0);
  const plan = createExecutionPlan(c, judgeRuntimes()); assert.ok(plan.compile); assert.equal(plan.run, null);
  assert.equal(plan.restrictions.retainCompiledWorkspace, true); assert.equal(plan.restrictions.workspaceInodes, 4096);
  assert.ok(plan.compile.argv.includes("-d"));
  const interpreted = claim("python"); interpreted.payload.checkType = "COMPILATION"; interpreted.payload.stdin = Buffer.alloc(0);
  assert.throws(() => createExecutionPlan(interpreted, judgeRuntimes()));
});
