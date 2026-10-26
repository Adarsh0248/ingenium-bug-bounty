import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { observeDockerImage } from "../src/judge/inspect-image.js";
import type { DockerCommand } from "../src/judge/docker-capsule.js";

function fixture() {
  const id = "a".repeat(64), image = `sha256:${"b".repeat(64)}`, nonce = randomUUID(), expected = "c".repeat(64), calls: string[][] = [];
  const row = { Id: id, Image: image, Name: `/ingenium-image-observation-${nonce}`, RestartCount: 0, Mounts: [],
    Config: { Image: image, Labels: { "ingenium.image-observation": nonce, inherited: "reviewed image label" }, Entrypoint: ["/ingenium-inspection-never-start"] },
    State: { Status: "created", Running: false, Pid: 0, StartedAt: "0001-01-01T00:00:00Z" },
    HostConfig: { RestartPolicy: { Name: "no" }, NetworkMode: "none", ReadonlyRootfs: true, Privileged: false } };
  const command: DockerCommand = async (args, input, signal) => {
    signal.throwIfAborted(); assert.equal(input.length, 0); calls.push([...args]);
    if (args[0] === "create" || args[0] === "rm") return Buffer.from(id + "\n");
    if (args[0] === "inspect") return Buffer.from(JSON.stringify(row));
    assert.equal(args[0], "container"); return Buffer.alloc(0);
  };
  const tree = { protocol: "ingenium-image-tree-v1", tree_sha256: expected, entries: 2, files: 1, data_bytes: 16 };
  let exports = 0;
  const exportTree = async (actual: string) => { assert.equal(actual, id); exports++; return Buffer.from(JSON.stringify(tree)); };
  return { id, image, nonce, expected, calls, row, command, tree, exportTree, exports: () => exports };
}
test("image inspection exports and removes only its exact, never-started original container", async () => {
  const f = fixture(); assert.deepEqual(await observeDockerImage(f.command, f.exportTree, f.image, f.nonce, f.expected, AbortSignal.timeout(5000)), f.tree);
  assert.equal(f.exports(), 1); assert.deepEqual(f.calls.map(v => v[0]), ["create", "inspect", "inspect", "rm", "container"]);
  assert.ok(f.calls.every(v => !["start", "run", "exec"].includes(v[0]!)));
});
test("an altered, mounted, running, restarted or relabelled inspection is never exported or deleted", async () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.row.State.Status = "exited"; },
    (f: ReturnType<typeof fixture>) => { f.row.State.Pid = 7; },
    (f: ReturnType<typeof fixture>) => { f.row.RestartCount = 1; },
    (f: ReturnType<typeof fixture>) => { f.row.Id = "d".repeat(64); },
    (f: ReturnType<typeof fixture>) => { f.row.Config.Labels["ingenium.image-observation"] = randomUUID(); },
    (f: ReturnType<typeof fixture>) => { f.row.HostConfig.Privileged = true; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(observeDockerImage(f.command, f.exportTree, f.image, f.nonce, f.expected, AbortSignal.timeout(5000)));
    assert.equal(f.exports(), 0); assert.ok(f.calls.every(v => v[0] !== "rm"));
  }
});
test("lost creation acknowledgement, changed image bytes and cancelled export preserve original inspection state", async () => {
  const f = fixture();
  await assert.rejects(observeDockerImage(async (...args) => { await f.command(...args); throw new Error("lost reply"); }, f.exportTree, f.image, f.nonce, f.expected, AbortSignal.timeout(5000)));
  assert.equal(f.calls.length, 1); assert.equal(f.exports(), 0);
  for (const exporter of [async () => { throw new Error("lost export"); }, async () => Buffer.from(JSON.stringify({ ...f.tree, tree_sha256: "d".repeat(64) }))]) {
    const f = fixture();
    await assert.rejects(observeDockerImage(f.command, exporter, f.image, f.nonce, f.expected, AbortSignal.timeout(5000)));
    assert.deepEqual(f.calls.map(v => v[0]), ["create", "inspect"]);
  }
});
