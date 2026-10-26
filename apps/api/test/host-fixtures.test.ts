import assert from "node:assert/strict";
import { test } from "node:test";
import { FIXED_HOST_SOURCES } from "./fixtures/host-executions.js";
import { HOST_FAILURE_CASES } from "./fixtures/host-failures.js";
import { createExecutionPlan } from "../src/judge/execution-plan.js";
import { judgePayload, judgeRuntimes } from "./fixtures/judge.js";
import { randomUUID } from "node:crypto";

test("fixed host fixtures preserve Java string escaping and JavaScript whitespace expressions", () => {
  assert.ok(FIXED_HOST_SOURCES.java.includes('split("\\\\s+")'));
  assert.ok(!FIXED_HOST_SOURCES.java.includes('split("\\\\\\\\s+")'));
  assert.ok(FIXED_HOST_SOURCES.javascript.includes('split(/\\s+/)'));
  assert.ok(!FIXED_HOST_SOURCES.javascript.includes('split(/\\\\s+/)'));
});

test("failure fixtures have unique durable receipt names and pass the unchanged execution boundary", () => {
  assert.equal(new Set(HOST_FAILURE_CASES.map(item=>item.id)).size, HOST_FAILURE_CASES.length);
  for (const item of HOST_FAILURE_CASES) {
    const payload={...judgePayload(item.language),source:Buffer.from(item.source),cpuMs:item.cpuMs??2000,wallMs:item.wallMs??10000,memoryKb:item.memoryKb??524288};
    assert.match(item.id,/^[a-z][a-z0-9-]{0,63}$/);
    const plan=createExecutionPlan({payload,owner:randomUUID(),providerToken:randomUUID()},judgeRuntimes());
    assert.equal(plan.restrictions.network,false);assert.equal(plan.restrictions.uid,60000);
  }
});
