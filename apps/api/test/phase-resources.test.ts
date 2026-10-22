import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createExecutionPlan } from "../src/judge/execution-plan.js";
import { phaseInitialisation, phaseResourceRecord, retainedPhaseGroups } from "../src/judge/phase-resources.js";
import { judgePayload, judgeRuntimes } from "./fixtures/judge.js";

const physical = { container_id: "a".repeat(64), cgroup_parent: `/ingenium-exec-${"b".repeat(32)}` };
const groups = { memory: { device: "11", inode: "12" }, cpuacct: { device: "21", inode: "22" } };
const empty = () => ({ compile_init: null, compile_groups: null, run_init: null, run_groups: null }) as Record<"compile_init" | "compile_groups" | "run_init" | "run_groups", unknown | null>;
function fixture(language: Parameters<typeof judgePayload>[0] = "cpp") {
  const claim = { payload: judgePayload(language), owner: randomUUID(), providerToken: randomUUID() };
  return { plan: createExecutionPlan(claim, judgeRuntimes()), boot: randomUUID() };
}
test("pre-launch resource records bind the original attempt, boot, physical capsule and phase without source or output", () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
    const { plan, boot } = fixture(language), phase = plan.compile ? "compile" : "run";
    const init = phaseInitialisation(plan, phase, boot, physical, "c".repeat(64)), saved = phaseResourceRecord(init, groups), row = empty();
    row[`${phase}_init`] = init; row[`${phase}_groups`] = saved;
    assert.deepEqual(retainedPhaseGroups(plan, boot, physical, row), { phase, groups });
    assert.doesNotMatch(JSON.stringify({ init, saved }), /source_b64|stdin_b64|stdout|synthetic fixture/);
    saved.groups.memory.inode = "99"; assert.equal(groups.memory.inode, "12");
  }
});
test("a newer run-init intent fences the compiler identity even if a crash prevented saving new run groups", () => {
  const { plan, boot } = fixture(), compile = phaseInitialisation(plan, "compile", boot, physical, "c".repeat(64)), row = empty();
  row.compile_init = compile; row.compile_groups = phaseResourceRecord(compile, groups);
  row.run_init = phaseInitialisation(plan, "run", boot, physical, "d".repeat(64));
  assert.deepEqual(retainedPhaseGroups(plan, boot, physical, row), { phase: "run", groups: null });
  const runtime = { memory: { device: "11", inode: "13" }, cpuacct: { device: "21", inode: "23" } };
  row.run_groups = phaseResourceRecord(row.run_init as ReturnType<typeof phaseInitialisation>, runtime);
  assert.deepEqual(retainedPhaseGroups(plan, boot, physical, row), { phase: "run", groups: runtime });
});
test("missing initialisation means no known child identity; partial initialisation never invents one", () => {
  const { plan, boot } = fixture(); assert.deepEqual(retainedPhaseGroups(plan, boot, physical, empty()), { phase: null, groups: null });
  const row = empty(); row.compile_init = phaseInitialisation(plan, "compile", boot, physical, "c".repeat(64));
  assert.deepEqual(retainedPhaseGroups(plan, boot, physical, row), { phase: "compile", groups: null });
  row.compile_init = null; row.compile_groups = { init_sha256: "e".repeat(64), groups };
  assert.throws(() => retainedPhaseGroups(plan, boot, physical, row));
});
test("copied, stale or altered phase bindings cannot identify another attempt's groups", () => {
  const { plan, boot } = fixture(), init = phaseInitialisation(plan, "compile", boot, physical, "c".repeat(64)), row = empty();
  row.compile_init = init; row.compile_groups = phaseResourceRecord(init, groups);
  for (const [key, value] of [["attempt_id", randomUUID()], ["host_epoch_id", randomUUID()], ["boot_id", randomUUID()], ["container_id", "d".repeat(64)],
    ["cgroup_parent", `/ingenium-exec-${"e".repeat(32)}`], ["nonce", "f".repeat(64)], ["phase", "run"], ["version", 2], ["extra", true]] as const) {
    const changed = { ...row, compile_init: { ...init, [key]: value } }; assert.throws(() => retainedPhaseGroups(plan, boot, physical, changed));
  }
});
test("group snapshots reject malformed inode identities, unbound digests and undeclared nested fields", () => {
  const { plan, boot } = fixture(), init = phaseInitialisation(plan, "compile", boot, physical, "c".repeat(64));
  for (const value of [-1, "-1", "01", "18446744073709551616", "12\n", null]) {
    assert.throws(() => phaseResourceRecord(init, { ...groups, memory: { device: "11", inode: value as string } }));
  }
  const row = empty(); row.compile_init = init;
  row.compile_groups = { ...phaseResourceRecord(init, groups), init_sha256: "d".repeat(64) }; assert.throws(() => retainedPhaseGroups(plan, boot, physical, row));
  row.compile_groups = { ...phaseResourceRecord(init, groups), groups: { ...groups, extra: {} } }; assert.throws(() => retainedPhaseGroups(plan, boot, physical, row));
});
test("an impossible run-before-compiler chain and phases absent from the reviewed plan are rejected", () => {
  const { plan, boot } = fixture(), row = empty(); row.run_init = phaseInitialisation(plan, "run", boot, physical, "c".repeat(64));
  row.run_groups = phaseResourceRecord(row.run_init as ReturnType<typeof phaseInitialisation>, groups);
  assert.throws(() => retainedPhaseGroups(plan, boot, physical, row));
  const interpreted = fixture("python"); assert.throws(() => phaseInitialisation(interpreted.plan, "compile", interpreted.boot, physical, "c".repeat(64)));
  const claim = { payload: { ...judgePayload(), checkType: "COMPILATION" as const, stdin: Buffer.alloc(0) }, owner: randomUUID(), providerToken: randomUUID() };
  assert.throws(() => phaseInitialisation(createExecutionPlan(claim, judgeRuntimes()), "run", boot, physical, "c".repeat(64)));
});
test("resource initialisation rejects arbitrary paths, abbreviated IDs, malformed boot and nonce before native work", () => {
  const { plan, boot } = fixture();
  assert.throws(() => phaseInitialisation(plan, "compile", boot, { ...physical, cgroup_parent: "/sys/fs/cgroup" }, "c".repeat(64)));
  assert.throws(() => phaseInitialisation(plan, "compile", boot, { ...physical, container_id: "123" }, "c".repeat(64)));
  assert.throws(() => phaseInitialisation(plan, "compile", "boot", physical, "c".repeat(64)));
  assert.throws(() => phaseInitialisation(plan, "compile", boot, physical, "nonce"));
});
