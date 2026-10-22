import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { decodeCgroupCounters, openPhaseAccounting } from "../src/judge/cgroup-accounting.js";
import { createExecutionPlan } from "../src/judge/execution-plan.js";
import { prepareExecutionWorkspace } from "../src/judge/workspace.js";
import { judgePayload, judgeRuntimes } from "./fixtures/judge.js";

const files = () => ({ cpu: "123456789\n", peak: "1048576\n", combinedPeak: "1048576\n", memoryLimit: "16777216\n", combinedLimit: "16777216\n", hierarchy: "1\n",
  memoryHits: "0\n", combinedHits: "38\n", oom: "oom_kill_disable 0\nunder_oom 0\noom_kill 1\n", memoryTasks: "", cpuTasks: "" });
test("v1 counter decoding preserves nanoseconds and combined-memory hits without inventing a verdict", () => {
  assert.deepEqual(decodeCgroupCounters(files(), 16384), { cpuNs: "123456789", peakBytes: "1048576", memoryHits: "0", combinedHits: "38", oomKills: "1" });
  const data = files(); data.cpu = "9223372036854775807\n";
  assert.equal(decodeCgroupCounters(data, 16384).cpuNs, "9223372036854775807");
  assert.equal(decodeCgroupCounters({ ...files(), combinedPeak: "2097152\n" }, 16384).peakBytes, "2097152");
  assert.ok(!Object.hasOwn(decodeCgroupCounters(files(), 16384), "tree_accounted"));
});
test("counter decoding refuses missing, malformed, oversized, nonempty, changed-limit or still-OOM observations", () => {
  for (const [key, value] of [["cpu", "-1\n"], ["cpu", "01\n"], ["cpu", "1"], ["cpu", "9223372036854775808\n"], ["cpu", "1\n2\n"],
    ["peak", "16777217\n"], ["memoryLimit", "33554432\n"], ["combinedLimit", "33554432\n"], ["memoryHits", "1.0\n"], ["combinedHits", ""],
    ["hierarchy", "0\n"], ["memoryTasks", "1\n"], ["cpuTasks", "2\n"], ["oom", "oom_kill_disable 1\nunder_oom 0\noom_kill 0\n"],
    ["oom", "oom_kill_disable 0\nunder_oom 1\noom_kill 0\n"], ["oom", "oom_kill_disable 0\nunder_oom 0\noom_kill 0\nextra 1\n"]] as const) {
    assert.throws(() => decodeCgroupCounters({ ...files(), [key]: value }, 16384), key);
  }
  for (const value of [0, -1, 1.5, 1048577, NaN, Infinity]) assert.throws(() => decodeCgroupCounters(files(), value));
});
test("workspace and accounting refuse unavailable native boundaries and pre-cancelled preparation", async () => {
  const plan = createExecutionPlan({ payload: judgePayload(), owner: randomUUID(), providerToken: randomUUID() }, judgeRuntimes());
  await assert.rejects(prepareExecutionWorkspace(plan, AbortSignal.abort()));
  // No real host paths are created or modified; native positive checks live in the owned Linux harness.
  if (process.platform !== "linux" || process.getuid?.() !== 0) {
    await assert.rejects(prepareExecutionWorkspace(plan, new AbortController().signal));
    await assert.rejects(openPhaseAccounting(plan, "run"));
  }
});
