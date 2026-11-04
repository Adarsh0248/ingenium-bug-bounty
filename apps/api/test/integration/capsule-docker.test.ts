import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { judgeJson } from "../../src/content/judge-protocol.js";
import { capsuleReference, createCapsuleLifecycle } from "../../src/judge/capsule-lifecycle.js";
import { assertDockerCapsuleAbsent } from "../../src/judge/docker-capsule.js";
import type { CapsuleDriver, CapsuleReference, CapsuleState } from "../../src/judge/capsule-lifecycle.js";
import type { ExecutionCheckpoints } from "../../src/judge/checkpoints.js";
import { createExecutionPlan } from "../../src/judge/execution-plan.js";
import { executionRequest } from "../../src/judge/executor.js";
import { judgePayload, judgeRuntimes, syntheticCapsuleResources } from "../fixtures/judge.js";

const IMAGE = "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
async function command(args: string[], signal: AbortSignal, input: Buffer = Buffer.alloc(0)) {
  const task = exec("docker", args, { timeout: 20000, maxBuffer: 65536, windowsHide: true, signal }); task.child.stdin!.end(input);
  const result = await task; assert.equal(result.stderr, ""); return result.stdout.trim();
}
const signal = () => AbortSignal.timeout(20000);
async function fixture(wait = false, detachedChild = false) {
  const nonce = randomUUID(), image = await command(["image", "inspect", "--format", "{{.Id}}", IMAGE], signal());
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  const c = { payload: judgePayload(), owner: randomUUID(), providerToken: randomUUID() }, boot = randomUUID(), plan = createExecutionPlan(c, judgeRuntimes());
  // Journal durability is tested separately on real Linux/ext4; this fixture exercises actual Docker lifecycle only.
  const rows: Record<string, unknown> = {}; let reserved = false, creates = 0, starts = 0;
  const store = { hostEpochId: c.payload.hostEpochId, bootId: boot, async physical() { return null; },
    async reserveCapsule(_p: unknown, intent: unknown) { assert.equal(reserved, false); reserved = true; rows.intent = structuredClone(intent); },
    async capsule() { return reserved ? Object.fromEntries(["intent", "container", "start", "stopped", "remove", "removed"].map(key => [key, rows[key] ?? null])) : null; },
    async saveCapsule(_p: unknown, key: string, value: unknown) { if (rows[key]) assert.deepEqual(rows[key], value); else rows[key] = structuredClone(value); },
  } as unknown as ExecutionCheckpoints;
  async function inspect(ref: CapsuleReference, id: string) {
    assert.match(id, /^[a-f0-9]{64}$/);
    const [row] = JSON.parse(await command(["inspect", "--type", "container", id], signal()));
    assert.equal(row.Id, id); assert.equal(row.Name, `/${ref.name}`); assert.equal(row.Image, image);
    assert.equal(row.Config.Labels["ingenium.capsule-test"], nonce);
    for (const [key, value] of Object.entries(ref.labels)) assert.equal(row.Config.Labels[key], value);
    assert.equal(row.HostConfig.Privileged, false); assert.equal(row.HostConfig.ReadonlyRootfs, true); assert.equal(row.HostConfig.NetworkMode, "none");
    assert.equal(row.HostConfig.RestartPolicy.Name, "no"); assert.equal(row.RestartCount, 0); assert.equal(row.State.OOMKilled, false);
    assert.deepEqual(row.HostConfig.CapDrop, ["ALL"]); assert.deepEqual(row.HostConfig.CapAdd, null);
    assert.ok(row.HostConfig.SecurityOpt.includes("no-new-privileges=true")); assert.deepEqual(row.Mounts, []);
    return { id, status: row.State.Status, running: row.State.Running, pid: row.State.Pid, starts: row.State.Status === "created" ? 0 : 1 } as CapsuleState;
  }
  const driver: CapsuleDriver = {
    async create(ref, s) {
      creates++; assert.ok(rows.intent);
      // Only this hardcoded trusted Node program runs. The supplied source is consumed as data, never evaluated.
      const code = (detachedChild ? 'require("node:child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{detached:true,stdio:"ignore"}).unref();' : "")
        + 'process.stdin.resume();process.stdin.on("end",()=>process.stdout.write("TRUSTED_FIXTURE\\n"));' + (wait ? "setInterval(()=>{},1000);" : "");
      return command(["create", "--pull=never", "--name", ref.name, "--label", `ingenium.capsule-test=${nonce}`,
        ...Object.entries(ref.labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]),
        "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
        "--memory", "128m", "--memory-swap", "128m", "--cpus", "0.5", "--pids-limit", "32", "--log-driver", "none",
        "--interactive", "--attach", "stdin", "--attach", "stdout", "--attach", "stderr", "--entrypoint", "/usr/local/bin/node", image, "-e", code], s);
    },
    async inspect(ref, id) { return inspect(ref, id); },
    async find(ref, s) { const id = await command(["container", "ls", "--all", "--no-trunc", "--filter", `name=^/${ref.name}$`, "--format", "{{.ID}}"], s); return id ? inspect(ref, id) : null; },
    async start(ref, id, input, s) { assert.equal((await inspect(ref, id)).status, "created"); assert.ok(rows.start); starts++;
      assert.equal(await command(["start", "--attach", "--interactive", id], s, input), "TRUSTED_FIXTURE"); },
    async stop(ref, id, s) { await inspect(ref, id); assert.equal(await command(["stop", "--timeout", "1", id], s), id); },
    async remove(ref, id, s) { const state = await inspect(ref, id); assert.equal(state.running, false); assert.equal(state.pid, 0); assert.ok(rows.remove); assert.equal(await command(["rm", id], s), id); },
    assertAbsent: (ref, id, s) => assertDockerCapsuleAbsent(async (args, input, stopped) => {
      const task = exec("docker", [...args], { timeout: 20000, maxBuffer: 1048576, windowsHide: true, signal: stopped });
      task.child.stdin!.end(input);
      const result = await task;
      assert.equal(result.stderr, "");
      return Buffer.from(result.stdout);
    }, ref, id, s),
  };
  const lifecycle = () => createCapsuleLifecycle(store, driver, { imageId: image, digest: "a".repeat(64) }, syntheticCapsuleResources);
  async function cleanup() {
    const ids = await command(["container", "ls", "--all", "--no-trunc", "--filter", `label=ingenium.capsule-test=${nonce}`, "--format", "{{.ID}}"], signal());
    for (const id of ids.split("\n").map(value => value.trim()).filter(Boolean)) {
      const [row] = JSON.parse(await command(["inspect", "--type", "container", id], signal()));
      assert.equal(row.Id, id); assert.equal(row.Config.Labels["ingenium.capsule-test"], nonce); assert.equal(row.Image, image);
      await command(["stop", "--timeout", "1", id], signal()); await command(["rm", id], signal());
    }
  }
  return { plan, driver, rows, lifecycle, cleanup, counts: () => ({ creates, starts }), input: Buffer.from(judgeJson(executionRequest(c, boot, judgeRuntimes(), "EXECUTE"))) };
}

test("a real Docker create with lost acknowledgement is found once without ever running the trusted fixture", { timeout: 90000 }, async () => {
  const f = await fixture(), create = f.driver.create;
  try {
    f.driver.create = async (...args) => { await create(...args); throw new Error("synthetic lost acknowledgement after real create"); };
    await assert.rejects(f.lifecycle().execute(f.plan, f.input, signal()));
    const saved = await f.lifecycle().recover(f.plan, signal()); assert.equal(saved.state?.status, "created"); assert.equal(saved.removed, false);
    await assert.rejects(f.lifecycle().execute(f.plan, f.input, signal()));
    assert.equal((await f.lifecycle().stopAndRemove(f.plan, signal())).removed, true); assert.deepEqual(f.counts(), { creates: 1, starts: 0 });
  } finally { await f.cleanup(); }
});
test("real exited capsule recovery does not repeat input, and a lost Docker remove reply is reconciled", { timeout: 90000 }, async () => {
  const f = await fixture(), start = f.driver.start, remove = f.driver.remove;
  try {
    f.driver.start = async (...args) => { await start(...args); throw new Error("synthetic lost reply after real fixture exit"); };
    await assert.rejects(f.lifecycle().execute(f.plan, f.input, signal()));
    const result = await f.lifecycle().recover(f.plan, signal()); assert.equal(result.state?.status, "exited"); assert.equal(result.state.pid, 0);
    f.driver.remove = async (...args) => { await remove(...args); throw new Error("synthetic lost remove acknowledgement"); };
    await assert.rejects(f.lifecycle().stopAndRemove(f.plan, signal())); assert.equal(f.rows.removed, undefined);
    assert.equal((await f.lifecycle().recover(f.plan, signal())).removed, true); assert.deepEqual(f.counts(), { creates: 1, starts: 1 });
  } finally { await f.cleanup(); }
});
test("cancelling real Docker attach leaves the capsule held until explicit verified stop/removal; recovery never restarts it", { timeout: 90000 }, async () => {
  const f = await fixture(true), cancel = new AbortController();
  let pending: Promise<unknown> | undefined;
  try {
    pending = f.lifecycle().execute(f.plan, f.input, cancel.signal).then(() => assert.fail("waiting fixture unexpectedly ended"), () => null);
    let running = false;
    for (let i = 0; i < 25 && !running; i++) {
      await setTimeout(200);
      if (f.rows.start) running = (await f.lifecycle().recover(f.plan, signal())).state?.running === true;
    }
    assert.equal(running, true); cancel.abort(); await pending;
    const result = await f.lifecycle().recover(f.plan, signal()); assert.equal(result.state?.running, true); assert.equal(result.removed, false);
    assert.equal(f.rows.stopped, undefined); const removed = await f.lifecycle().stopAndRemove(f.plan, signal()); assert.equal(removed.removed, true);
    assert.equal(Object.hasOwn(removed, "drain"), false); assert.deepEqual(f.counts(), { creates: 1, starts: 1 });
  } finally { cancel.abort(); await pending; await f.cleanup(); }
});
test("a real detached trusted child remains in the original capsule and explicit retirement stops/removes that capsule without another start", { timeout: 90000 }, async () => {
  const f = await fixture(true, true), cancel = new AbortController(); let pending: Promise<unknown> | undefined;
  try {
    pending = f.lifecycle().execute(f.plan, f.input, cancel.signal).then(() => assert.fail("waiting fixture unexpectedly ended"), () => null);
    let id: string | undefined, processes = 0;
    for (let i = 0; i < 25 && processes < 2; i++) {
      await setTimeout(200); if (!f.rows.start) continue;
      const state = (await f.lifecycle().recover(f.plan, signal())).state; if (!state?.running) continue; id = state.id;
      const table = await command(["top", id, "-eo", "pid,args"], signal());
      processes = table.split("\n").filter(line => /^\s*[1-9][0-9]*\s+\/usr\/local\/bin\/node\s+-e\s/.test(line)).length;
    }
    assert.ok(id); assert.ok(processes >= 2); cancel.abort(); await pending;
    assert.equal((await f.lifecycle().recover(f.plan, signal())).state?.running, true);
    const removed = await f.lifecycle().stopAndRemove(f.plan, signal()); assert.equal(removed.removed, true); assert.equal(Object.hasOwn(removed, "drain"), false);
    assert.equal((await f.lifecycle().recover(f.plan, signal())).state, null); assert.deepEqual(f.counts(), { creates: 1, starts: 1 });
  } finally { cancel.abort(); await pending; await f.cleanup(); }
});

test("a renamed retained original cannot be mistaken for removal after its old name disappears", { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    await f.lifecycle().execute(f.plan, f.input, signal());
    const ref = capsuleReference(f.plan, f.rows.intent), id = (f.rows.container as { id: string }).id;
    const original = await f.driver.inspect(ref, id, signal()); assert.equal(original.running, false); assert.equal(original.pid, 0);
    f.rows.stopped = { id }; f.rows.remove = { id }; // Synthetic crash checkpoint after verified real exit, before removal.
    await command(["rename", id, `${ref.name}-retained-test`], signal());
    assert.equal(await f.driver.find(ref, signal()), null);
    await assert.rejects(f.lifecycle().recover(f.plan, signal())); await assert.rejects(f.lifecycle().stopAndRemove(f.plan, signal()));
    assert.equal(f.rows.removed, undefined); assert.deepEqual(f.counts(), { creates: 1, starts: 1 });
  } finally { await f.cleanup(); }
});
