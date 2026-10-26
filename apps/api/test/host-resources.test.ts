import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { cgroupMounts, cpusetRange } from "../src/judge/host-cgroups.js";
import { capsuleConfiguration } from "../src/judge/capsule-configuration.js";
import { capsuleReference } from "../src/judge/capsule-lifecycle.js";
import { createHostCapsuleResources } from "../src/judge/host-resources.js";
import { readCapsuleRequest } from "../src/judge/capsule-request.js";
import type { ExecutionCheckpoints } from "../src/judge/checkpoints.js";
import { createExecutionPlan } from "../src/judge/execution-plan.js";
import { executionRequest } from "../src/judge/executor.js";
import { ISOLATE_BINARIES } from "../src/judge/isolate-context.js";
import { judgeJson } from "../src/content/judge-protocol.js";
import { judgePayload, judgeRuntimes } from "./fixtures/judge.js";

const mounts = () => ["memory", "cpu,cpuacct", "cpuset", "pids", "devices", "freezer", "net_cls,net_prio", "systemd"].map((name, i) =>
  `${100 + i} 20 0:${30 + i} / /sys/fs/cgroup/${name} rw,nosuid,nodev,noexec,relatime - cgroup cgroup rw,${name === "systemd" ? "name=systemd" : name}\n`).join("");
function fixture(language: Parameters<typeof judgePayload>[0] = "cpp") {
  const claim = { payload: judgePayload(language), owner: randomUUID(), providerToken: randomUUID() }, plan = createExecutionPlan(claim, judgeRuntimes());
  const settings = { hostEpochId: plan.hostEpochId, bootId: randomUUID(), runtimes: judgeRuntimes(), binaries: Object.fromEntries(ISOLATE_BINARIES.map(path => [path, "a".repeat(64)])) as Record<typeof ISOLATE_BINARIES[number], string> };
  const reference = capsuleReference(plan, { version: 1, nonce: randomUUID(), image_id: `sha256:${"b".repeat(64)}`, release_sha256: "c".repeat(64) });
  return { claim, plan, settings, reference };
}
test("host topology retains every canonical v1 hierarchy, including cpuset and named controllers, rather than only three budget controllers", () => {
  const result = cgroupMounts(mounts()); assert.equal(result.length, 8);
  assert.deepEqual(new Set(result.map(row => row.path)), new Set(["memory", "cpu,cpuacct", "cpuset", "pids", "devices", "freezer", "net_cls,net_prio", "systemd"].map(name => `/sys/fs/cgroup/${name}`)));
  assert.equal(result.find(row => row.path.endsWith("/memory"))!.mount_id, "100");
});
test("host topology refuses cgroup v2, delegated/readonly/aliased mounts, duplicate hierarchies and missing required controllers", () => {
  for (const value of ["10 1 0:20 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n", mounts().replace("/ /sys/fs/cgroup/memory", "/delegated /sys/fs/cgroup/memory"),
    mounts().replace("memory rw,", "memory ro,"), mounts().replaceAll("/sys/fs/cgroup/cpu,cpuacct", "/sys/fs/cgroup/cpuacct"), mounts() + mounts(),
    mounts().split("\n").filter(line => !line.includes("/cpuset ")).join("\n"), mounts().replace("0:30 / /sys", "0:30 / /unsafe"), mounts().trimEnd()]) assert.throws(() => cgroupMounts(value));
});
test("cpuset masks keep exact bounded ordered kernel ranges without accepting coercion, overlap or line injection", () => {
  for (const value of ["0\n", "0-7\n", "0,2-4,7\n"]) assert.equal(cpusetRange(value), value);
  for (const value of ["", "0", "0\n1\n", "01\n", "-1\n", "2-1\n", "0-3,2\n", "1048576\n", "0,0\n", "all\n", "0 \n"]) assert.throws(() => cpusetRange(value));
});
test("source-free host configuration binds the original claim, boot, all five runtimes and eight executable hashes", () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
    const f = fixture(language), bytes = capsuleConfiguration(f.settings, f.plan, f.reference), row = JSON.parse(bytes.toString());
    assert.equal(row.attempt_id, f.plan.attemptId); assert.equal(row.boot_id, f.settings.bootId); assert.equal(row.permit_owner, f.claim.owner);
    assert.equal(Object.keys(row.executables).length, 8); assert.equal(Object.keys(row.runtimes).length, 5);
    assert.doesNotMatch(bytes.toString(), /source_b64|stdin_b64|synthetic fixture|cpu_ms|callback/);
    const accepted = readCapsuleRequest(bytes, Buffer.from(judgeJson(executionRequest(f.claim, f.settings.bootId, f.settings.runtimes, "EXECUTE"))));
    assert.deepEqual(accepted.claim.payload.source, f.claim.payload.source); assert.deepEqual(accepted.claim.payload.stdin, f.claim.payload.stdin);
  }
});
test("host configuration rejects changed epochs, profiles, executable manifests and malformed resource identity before filesystem access", () => {
  const f = fixture();
  assert.throws(() => capsuleConfiguration({ ...f.settings, hostEpochId: randomUUID() }, f.plan, f.reference));
  const extra = { ...f.settings.binaries, "/extra": "d".repeat(64) };
  assert.throws(() => capsuleConfiguration({ ...f.settings, binaries: extra }, f.plan, f.reference));
  assert.throws(() => capsuleConfiguration({ ...f.settings, binaries: { ...f.settings.binaries, "/usr/local/bin/isolate": "bad" } }, f.plan, f.reference));
  const runtimes = judgeRuntimes(); runtimes.set("cpp", { key: "changed", digest: "d".repeat(64) });
  assert.throws(() => capsuleConfiguration({ ...f.settings, runtimes }, f.plan, f.reference));
  assert.throws(() => capsuleConfiguration(f.settings, f.plan, { ...f.reference, intent: { ...f.reference.intent, nonce: "../../elsewhere" } }));
});
test("host authority copies its installation settings and refuses a foreign epoch or boot binding", () => {
  const f = fixture(), store = { hostEpochId: f.settings.hostEpochId, bootId: f.settings.bootId } as ExecutionCheckpoints;
  assert.ok(createHostCapsuleResources(store, f.settings));
  assert.throws(() => createHostCapsuleResources(store, { ...f.settings, hostEpochId: randomUUID() }));
  assert.throws(() => createHostCapsuleResources(store, { ...f.settings, bootId: randomUUID() }));
});
