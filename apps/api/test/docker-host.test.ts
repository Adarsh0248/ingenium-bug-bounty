import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dockerDaemonDigest, dockerImageConfigDigest, verifyDockerReports } from "../src/judge/docker-host.js";
import type { DockerCommand } from "../src/judge/docker-capsule.js";

const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
function fixture() {
  const { daemon, image } = JSON.parse(readFileSync(new URL("./fixtures/docker-reports.json", import.meta.url), "utf8"));
  const pins = { daemon_sha256: dockerDaemonDigest(bytes(daemon)), image_config_sha256: dockerImageConfigDigest(bytes(image), image.Id) };
  const calls: string[][] = [];
  const command: DockerCommand = async (args, input, signal) => {
    signal.throwIfAborted(); assert.equal(input.length, 0); calls.push([...args]);
    if (args[0] === "info") return bytes(daemon);
    assert.deepEqual(args, ["image", "inspect", "--format", "{{json .}}", image.Id]); return bytes(image);
  };
  return { daemon, image, pins, command, calls, signal: new AbortController().signal };
}

test("reviewed reports use read-only info/image/info and canonicalize object/security order without pinning changing workload counts", async () => {
  const f = fixture(), shuffled = { ...f.daemon, Containers: 123, Images: 456, SecurityOptions: [...f.daemon.SecurityOptions].reverse(),
    Runtimes: Object.fromEntries(Object.entries(f.daemon.Runtimes).reverse()) };
  assert.equal(dockerDaemonDigest(bytes(shuffled)), f.pins.daemon_sha256);
  const image = { ...f.image, Config: Object.fromEntries(Object.entries(f.image.Config).reverse()) };
  assert.equal(dockerImageConfigDigest(bytes(image), image.Id), f.pins.image_config_sha256);
  await verifyDockerReports(f.command, f.image.Id, f.pins, f.signal);
  assert.deepEqual(f.calls.map(args => args[0]), ["info", "image", "info"]);
  assert.equal(f.calls.some(args => args.some(value => ["pull", "create", "start", "run", "exec", "stop", "rm"].includes(value))), false);
});

test("unsupported engines and missing kernel/daemon protections fail even if a caller would hash those reports", () => {
  const f = fixture();
  for (const patch of [{ OSType: "windows" }, { Architecture: "aarch64" }, { CgroupVersion: "2" }, { CgroupVersion: 1 }, { CgroupDriver: "systemd" },
    { Driver: "aufs" }, { DockerRootDir: "/tmp/docker" }, { DefaultRuntime: "custom" }, { ExperimentalBuild: true }, { LiveRestoreEnabled: true },
    { Swarm: { LocalNodeState: "active" } }, { MemoryLimit: false }, { SwapLimit: false }, { CpuCfsPeriod: false }, { CpuCfsQuota: false }, { PidsLimit: false },
    { Warnings: ["unreviewed warning"] }, { Runtimes: { custom: {} } }, { Runtimes: { ...f.daemon.Runtimes, extra: {} } }, { Runtimes: { runc: "runc" } },
    { ID: "" }, { KernelVersion: "kernel\n" }, { ContainerdCommit: {} }, { RuncCommit: { ID: null } }]) {
    assert.throws(() => dockerDaemonDigest(bytes({ ...f.daemon, ...patch })), JSON.stringify(patch));
  }
  for (const security of [[], ["name=seccomp,profile=builtin"], [...f.daemon.SecurityOptions, "name=rootless"], [...f.daemon.SecurityOptions, "name=userns"],
    [...f.daemon.SecurityOptions, "name=apparmor"], ["name=apparmor", "name=seccomp,profile=custom"]]) {
    assert.throws(() => dockerDaemonDigest(bytes({ ...f.daemon, SecurityOptions: security })));
  }
});

test("daemon ID, kernel, engine/runtime versions and runtime configuration drift cannot match the approved report pin", async () => {
  for (const patch of [{ ID: "another-daemon" }, { ServerVersion: "29.9.2" }, { KernelVersion: "6.8.0-another" }, { Name: "another-host" },
    { RuncCommit: { ID: "new-commit" } }, { Runtimes: { runc: { path: "/tmp/runc" } } }]) {
    const f = fixture(); Object.assign(f.daemon, patch);
    await assert.rejects(verifyDockerReports(f.command, f.image.Id, f.pins, f.signal)); assert.equal(f.calls.length, 1);
  }
});

test("image ID/platform/layers and inherited writable volumes cannot be accepted as the pinned capsule image", () => {
  const f = fixture();
  for (const patch of [{ Id: `sha256:${"d".repeat(64)}` }, { Os: "windows" }, { Architecture: "arm64" }, { Variant: "v8" }, { Config: null },
    { RootFS: { Type: "layers", Layers: [] } }, { RootFS: { Type: "layers", Layers: ["mutable"] } }, { RootFS: { Type: "other", Layers: f.image.RootFS.Layers } },
    { Config: { ...f.image.Config, Volumes: { "/unreviewed": {} } } }]) {
    assert.throws(() => dockerImageConfigDigest(bytes({ ...f.image, ...patch }), f.image.Id));
  }
  assert.throws(() => dockerImageConfigDigest(bytes(f.image), "latest"));
});

test("every image config field is pinned, including environment, command, healthcheck, labels and unknown future settings", async () => {
  for (const patch of [{ Env: ["NODE_OPTIONS=--require=/tmp/hook"] }, { Entrypoint: ["/tmp/entry"] }, { Cmd: ["/bin/sh"] },
    { Healthcheck: { Test: ["CMD", "unreviewed"] } }, { Labels: { changed: "true" } }, { User: "65534" }, { FutureSetting: true }]) {
    const f = fixture(); Object.assign(f.image.Config, patch);
    await assert.rejects(verifyDockerReports(f.command, f.image.Id, f.pins, f.signal)); assert.equal(f.calls.length, 2);
  }
  const f = fixture(); f.image.RootFS.Layers = [`sha256:${"d".repeat(64)}`];
  await assert.rejects(verifyDockerReports(f.command, f.image.Id, f.pins, f.signal)); assert.equal(f.calls.length, 2);
});

test("a daemon switch during image inspection fails the second identity read instead of approving a mixed snapshot", async () => {
  const f = fixture(); let count = 0;
  const command: DockerCommand = async (...args) => { if (++count === 3) f.daemon.ID = "replacement"; return f.command(...args); };
  await assert.rejects(verifyDockerReports(command, f.image.Id, f.pins, f.signal)); assert.equal(count, 3);
});

test("malformed, invalid UTF-8, unsupported shapes and oversized/nested reports fail privately", () => {
  const f = fixture();
  for (const raw of [Buffer.alloc(0), Buffer.from("unfinished"), Buffer.from([255]), Buffer.from("[]"), Buffer.from("null"), Buffer.alloc(2097153, 65)]) {
    assert.throws(() => dockerDaemonDigest(raw), /Docker reports/); assert.throws(() => dockerImageConfigDigest(raw, f.image.Id), /Docker reports/);
  }
  let nested: unknown = {};
  for (let i = 0; i < 18; i++) nested = { nested };
  assert.throws(() => dockerImageConfigDigest(bytes({ ...f.image, Config: { ...f.image.Config, nested } }), f.image.Id));
  assert.throws(() => dockerImageConfigDigest(bytes({ ...f.image, Config: { ...f.image.Config, invalid: 1.5 } }), f.image.Id));
});

test("invalid pins and already-cancelled checks do no I/O; cancellation and transport failures never retry", async () => {
  const f = fixture();
  await assert.rejects(verifyDockerReports(f.command, f.image.Id, { ...f.pins, daemon_sha256: "bad" }, f.signal));
  await assert.rejects(verifyDockerReports(f.command, "latest", f.pins, f.signal));
  await assert.rejects(verifyDockerReports(f.command, f.image.Id, f.pins, AbortSignal.abort())); assert.equal(f.calls.length, 0);
  const controller = new AbortController();
  await assert.rejects(verifyDockerReports(async (...args) => { const result = await f.command(...args); controller.abort(); return result; }, f.image.Id, f.pins, controller.signal));
  assert.equal(f.calls.length, 1);
  let failed = 0;
  await assert.rejects(verifyDockerReports(async () => { failed++; throw new Error("offline"); }, f.image.Id, f.pins, f.signal)); assert.equal(failed, 1);
});

test("pins are captured before transport and cannot be replaced by the observed reports or mutated caller settings", async () => {
  const f = fixture(), command: DockerCommand = async (...args) => { f.pins.daemon_sha256 = "0".repeat(64); f.pins.image_config_sha256 = "0".repeat(64); return f.command(...args); };
  await verifyDockerReports(command, f.image.Id, f.pins, f.signal); assert.equal(f.calls.length, 3);
});
