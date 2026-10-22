import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { sha256 } from "../src/access/credentials.js";
import { judgeJson } from "../src/content/judge-protocol.js";
import { capsuleReference, createCapsuleLifecycle } from "../src/judge/capsule-lifecycle.js";
import { createCapsuleBackend } from "../src/judge/capsule-backend.js";
import type { CapsuleDriver, CapsuleState } from "../src/judge/capsule-lifecycle.js";
import type { ExecutionCheckpoints } from "../src/judge/checkpoints.js";
import { CAPSULE_APPARMOR, CAPSULE_CAPABILITIES, CAPSULE_ENTRY, CAPSULE_TMPFS, capsuleCreateArguments, capsuleMounts, createDockerCapsuleDriver, inspectDockerCapsule } from "../src/judge/docker-capsule.js";
import { createExecutionPlan } from "../src/judge/execution-plan.js";
import { executionRequest } from "../src/judge/executor.js";
import { judgePayload, judgeReply, judgeRuntimes, syntheticCapsuleResources } from "./fixtures/judge.js";

const release = { imageId: `sha256:${"a".repeat(64)}`, digest: "b".repeat(64) };
const seccomp = JSON.stringify({ defaultAction: "SCMP_ACT_ERRNO" }), seccompHash = sha256(seccomp).toString("hex");
const signal = () => AbortSignal.timeout(5000);
function fixture() {
  const c = { payload: judgePayload(), owner: randomUUID(), providerToken: randomUUID() }, boot = randomUUID(), plan = createExecutionPlan(c, judgeRuntimes());
  const intent = { version: 1, nonce: randomUUID(), image_id: release.imageId, release_sha256: release.digest };
  return { c, boot, plan, ref: capsuleReference(plan, intent), input: Buffer.from(judgeJson(executionRequest(c, boot, judgeRuntimes(), "EXECUTE"))) };
}
function harness() {
  const f = fixture(), events: string[] = [], records: Record<string, unknown> = {}; let allocated = false, state: CapsuleState | null = null;
  const store = { hostEpochId: f.plan.hostEpochId, bootId: f.boot,
    async reserveCapsule(_plan: unknown, intent: unknown) { if (allocated) throw new Error("already allocated"); allocated = true; records.intent = intent; events.push("intent"); },
    async capsule() { return allocated ? Object.fromEntries(["intent", "container", "start", "stopped", "remove", "removed"].map(key => [key, records[key] ?? null])) : null; },
    async saveCapsule(_plan: unknown, key: string, value: unknown) { if (Object.hasOwn(records, key)) assert.deepEqual(value, records[key]); else records[key] = structuredClone(value); events.push(key); },
    async physical() { return null; },
  } as unknown as ExecutionCheckpoints;
  const driver: CapsuleDriver = {
    async create() { events.push("create"); assert.ok(records.intent); state = { id: "c".repeat(64), running: false, pid: 0, status: "created", starts: 0 }; return state.id; },
    async inspect(_ref, id) { assert.equal(state?.id, id); return { ...state! }; },
    async find() { events.push("find"); return state ? { ...state } : null; },
    async start(_ref, _id, input) { assert.deepEqual(input, f.input); assert.ok(records.start); events.push("launch"); state = { ...state!, running: true, pid: 123, status: "running", starts: 1 }; },
    async stop() { events.push("stop"); state = { ...state!, running: false, pid: 0, status: "exited" }; },
    async remove() { assert.ok(records.stopped); assert.ok(records.remove); events.push("rm"); state = null; },
    async assertAbsent() { assert.equal(state, null); },
  };
  const resources = { ...syntheticCapsuleResources };
  return { ...f, store, driver, resources, records, events, lifecycle: () => createCapsuleLifecycle(store, driver, release, resources) };
}

test("a launch intent precedes create, the start receipt precedes input, and a replacement cannot execute again", async () => {
  const h = harness(); await h.lifecycle().execute(h.plan, h.input, signal());
  assert.deepEqual(h.events, ["intent", "create", "container", "start", "launch"]);
  await assert.rejects(h.lifecycle().execute(h.plan, h.input, signal()));
  const result = await h.lifecycle().recover(h.plan, signal()); assert.equal(result.state?.running, true); assert.equal(result.removed, false);
  assert.equal(h.events.filter(value => value === "launch").length, 1);
  assert.doesNotMatch(JSON.stringify(h.records), /source_b64|stdin_b64/);
});
test("a lost create acknowledgement binds the one existing container without starting it or repeating create", async () => {
  const h = harness(), create = h.driver.create;
  h.driver.create = async (...args) => { await create(...args); throw new Error("lost create acknowledgement"); };
  await assert.rejects(h.lifecycle().execute(h.plan, h.input, signal())); assert.equal(h.records.container, undefined);
  const result = await h.lifecycle().recover(h.plan, signal()); assert.equal(result.state?.status, "created");
  assert.deepEqual(h.records.container, { id: "c".repeat(64) }); assert.equal(h.records.start, undefined);
  await assert.rejects(h.lifecycle().execute(h.plan, h.input, signal())); assert.equal(h.events.filter(value => value === "create").length, 1);
});
test("an uncertain create with no container stays held; recovery never fills the gap by creating or starting code", async () => {
  const h = harness(); h.driver.create = async () => { throw new Error("request may not have reached daemon"); };
  await assert.rejects(h.lifecycle().execute(h.plan, h.input, signal()));
  assert.deepEqual(await h.lifecycle().recover(h.plan, signal()), { containerId: null, state: null, removed: false });
  await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal())); assert.equal(h.records.removed, undefined);
});
test("host resource preparation precedes Docker create and verified resources precede the irreversible source start", async () => {
  const h = harness();
  h.resources.prepare = async () => { assert.ok(h.records.intent); assert.equal(h.records.container, undefined); h.events.push("prepare"); };
  h.resources.verify = async () => { assert.ok(h.records.container); assert.equal(h.records.start, undefined); h.events.push("verify"); };
  h.resources.retire = async () => { assert.ok(h.records.removed); h.events.push("retire"); };
  await h.lifecycle().execute(h.plan, h.input, signal());
  assert.deepEqual(h.events, ["intent", "prepare", "create", "container", "verify", "start", "launch"]);
  await h.lifecycle().stopAndRemove(h.plan, signal()); assert.equal(h.events.at(-1), "retire");
});
test("resource preparation and verification failures cannot start source or silently allocate replacement resources", async () => {
  for (const stage of ["prepare", "verify"] as const) {
    const h = harness(); h.resources[stage] = async () => { throw new Error("uncertain resources"); };
    await assert.rejects(h.lifecycle().execute(h.plan, h.input, signal())); await assert.rejects(h.lifecycle().execute(h.plan, h.input, signal()));
    assert.equal(h.events.includes("launch"), false); assert.equal(h.records.start, undefined);
    assert.equal(h.events.includes("create"), stage === "verify");
  }
});
test("failed parent/config retirement stays held after Docker removal and explicit recovery never creates or starts another job", async () => {
  const h = harness(); let cleanups = 0;
  h.resources.retire = async () => { cleanups++; if (cleanups === 1) throw new Error("resource cleanup incomplete"); };
  await h.lifecycle().execute(h.plan, h.input, signal()); await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal()));
  assert.ok(h.records.removed); assert.equal(h.events.filter(value => value === "launch").length, 1);
  assert.equal((await h.lifecycle().stopAndRemove(h.plan, signal())).removed, true); assert.equal(cleanups, 2);
  assert.equal(h.events.filter(value => value === "rm").length, 1);
});
test("a lost start reply and repeated recovery never resubmit input; explicit retirement checks stopped state before removal", async () => {
  const h = harness(), start = h.driver.start;
  h.driver.start = async (...args) => { await start(...args); throw new Error("lost start reply"); };
  await assert.rejects(h.lifecycle().execute(h.plan, h.input, signal())); await h.lifecycle().recover(h.plan, signal());
  const result = await h.lifecycle().stopAndRemove(h.plan, signal()); assert.equal(result.removed, true);
  assert.equal(h.events.filter(value => value === "launch").length, 1); assert.ok(h.events.indexOf("stopped") < h.events.indexOf("rm"));
  assert.equal((await h.lifecycle().recover(h.plan, signal())).removed, true);
  assert.equal(Object.hasOwn(result, "drain"), false); assert.equal(Object.hasOwn(result, "evidence"), false);
});
test("a lost remove acknowledgement reconciles only with a durable stopped/removal intent; unexplained absence does not", async () => {
  const h = harness(), remove = h.driver.remove;
  await h.lifecycle().execute(h.plan, h.input, signal());
  h.driver.remove = async (...args) => { await remove(...args); throw new Error("lost removal acknowledgement"); };
  await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal())); assert.equal(h.records.removed, undefined);
  assert.equal((await h.lifecycle().recover(h.plan, signal())).removed, true); assert.ok(h.records.removed);
  const other = harness(); await other.lifecycle().execute(other.plan, other.input, signal()); other.driver.find = async () => null;
  assert.equal((await other.lifecycle().recover(other.plan, signal())).removed, false); await assert.rejects(other.lifecycle().stopAndRemove(other.plan, signal()));
});
test("a failed stop, nonzero PID or changed identity never records stopped/removal proof", async () => {
  for (const fault of ["stop", "pid", "identity"] as const) {
    const h = harness(); await h.lifecycle().execute(h.plan, h.input, signal());
    if (fault === "stop") h.driver.stop = async () => { throw new Error("stop failed"); };
    if (fault === "pid") h.driver.stop = async () => {};
    if (fault === "identity") h.driver.find = async () => ({ id: "d".repeat(64), running: false, pid: 0, status: "created", starts: 0 });
    await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal())); assert.equal(h.records.stopped, undefined); assert.equal(h.records.remove, undefined);
  }
});
test("foreign physical identity, changed release and corrupt retirement receipts refuse recovery and destructive calls", async () => {
  const h = harness(); await h.lifecycle().execute(h.plan, h.input, signal()); const before = [...h.events];
  await assert.rejects(createCapsuleLifecycle(h.store, h.driver, { ...release, digest: "f".repeat(64) }, h.resources).recover(h.plan, signal()));
  h.records.removed = { id: "c".repeat(64) }; await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal())); delete h.records.removed;
  h.store.physical = async () => ({ container_id: "d".repeat(64), cgroup_parent: "/ingenium-exec-" + "e".repeat(32), pid_namespace: "pid:[1]", mount_namespace: "mnt:[2]", network_namespace: "net:[3]", ipc_namespace: "ipc:[4]" });
  await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal())); assert.deepEqual(h.events, before);
});
test("foreign source, owner, boot, operation and malformed input are rejected before allocation; abort does not allocate", async () => {
  for (const change of ["source", "owner", "boot", "recover", "malformed"]) {
    const h = harness(), row = JSON.parse(h.input.toString());
    if (change === "source") row.payload.source_b64 = Buffer.from("changed").toString("base64");
    if (change === "owner") row.permit_owner = randomUUID();
    if (change === "boot") row.boot_id = randomUUID();
    if (change === "recover") row.operation = "RECOVER";
    await assert.rejects(h.lifecycle().execute(h.plan, change === "malformed" ? Buffer.from("{}") : Buffer.from(judgeJson(row)), signal())); assert.deepEqual(h.events, []);
  }
  const h = harness(); await assert.rejects(h.lifecycle().execute(h.plan, h.input, AbortSignal.abort())); assert.deepEqual(h.events, []);
});

function backendHarness() {
  const h = harness(); let value: ReturnType<typeof judgeReply>["evidence"] | null = null;
  h.store.assertReady = async () => {};
  h.store.read = async () => ({ begun: value !== null, evidence: value });
  h.store.physical = async () => value ? { container_id: "c".repeat(64), cgroup_parent: capsuleReference(h.plan, h.records.intent).parent,
    pid_namespace: "pid:[1]", mount_namespace: "mnt:[2]", network_namespace: "net:[3]", ipc_namespace: "ipc:[4]" } : null;
  const start = h.driver.start;
  h.driver.start = async (...args) => {
    // Synthetic observations only; this unit test never invokes submitted source.
    const request = JSON.parse(args[2].toString()); assert.equal(request.payload.source_b64, h.c.payload.source.toString("base64"));
    await start(args[0], args[1], h.input, args[3]); value = judgeReply(h.c.payload, h.c.owner).evidence; value.metadata.drain = null;
  };
  const backend = () => createCapsuleBackend(h.store, h.driver, release, judgeRuntimes(), async () => sha256("synthetic readiness"), h.resources);
  return { ...h, backend };
}
test("the outer backend returns only bound checkpoint evidence and removes the capsule without inventing full retirement", async () => {
  const h = backendHarness(), result = await h.backend().execute(h.plan, signal());
  assert.equal((result as ReturnType<typeof judgeReply>["evidence"]).stdout_b64, "MTIK");
  assert.equal((result as ReturnType<typeof judgeReply>["evidence"]).metadata.drain, null); assert.ok(h.records.removed);
  assert.equal(h.events.filter(value => value === "launch").length, 1);
});
test("outer backend recovery after a lost reply reads original evidence without readiness, Docker calls or more source execution", async () => {
  const h = backendHarness(), start = h.driver.start;
  h.driver.start = async (...args) => { await start(...args); throw new Error("lost reply after saved synthetic result"); };
  await assert.rejects(h.backend().execute(h.plan, signal())); const before = JSON.stringify(h.records);
  const forbidden = async (): Promise<never> => { throw new Error("must not call physical backend"); };
  const recovery = createCapsuleBackend(h.store, { create: forbidden, inspect: forbidden, find: forbidden, start: forbidden, stop: forbidden, remove: forbidden, assertAbsent: forbidden }, release, judgeRuntimes(), forbidden,
    { prepare: forbidden, verify: forbidden, retire: forbidden });
  const result = await recovery.recover(h.plan, signal()) as ReturnType<typeof judgeReply>["evidence"];
  assert.equal(result.stdout_b64, "MTIK"); assert.equal(result.metadata.drain, null); assert.equal(JSON.stringify(h.records), before);
  h.store.physical = async () => null; await assert.rejects(recovery.recover(h.plan, signal()));
});
test("the outer backend refuses missing results and unverified host readiness without claiming a verdict or releasing capacity", async () => {
  const h = backendHarness(); h.driver.start = async () => {};
  await assert.rejects(h.backend().execute(h.plan, signal())); assert.equal(h.records.removed, undefined);
  assert.equal(await h.backend().recover(h.plan, signal()), null);
  const blocked = backendHarness();
  const backend = createCapsuleBackend(blocked.store, blocked.driver, release, judgeRuntimes(), async () => Buffer.alloc(0), blocked.resources);
  await assert.rejects(backend.execute(blocked.plan, signal())); assert.deepEqual(blocked.events, []);
});
test("explicit backend retirement after a lost reply cleans the original capsule and returns saved evidence without creating a drain", async () => {
  const h = backendHarness(), start = h.driver.start, backend = h.backend();
  h.driver.start = async (...args) => { await start(...args); throw new Error("lost reply"); };
  await assert.rejects(backend.execute(h.plan, signal()));
  const result = await backend.retire(h.plan, signal()) as ReturnType<typeof judgeReply>["evidence"];
  assert.equal(result.stdout_b64, "MTIK"); assert.equal(result.metadata.drain, null); assert.ok(h.records.removed);
  assert.equal(h.events.filter(value => value === "launch").length, 1);
  const repeated = await backend.retire(h.plan, signal()); assert.deepEqual(repeated, result); assert.equal(h.events.filter(value => value === "rm").length, 1);
});
test("explicit retirement of a job without a saved result returns no verdict, while uncertain resource cleanup can resume", async () => {
  const h = backendHarness(), backend = h.backend(); h.driver.start = async () => {};
  await assert.rejects(backend.execute(h.plan, signal())); assert.equal(await backend.retire(h.plan, signal()), null); assert.ok(h.records.removed);
  const other = backendHarness(), recovery = other.backend(); let attempts = 0;
  other.resources.retire = async () => { attempts++; if (attempts === 1) throw new Error("interrupted cleanup"); };
  await assert.rejects(recovery.execute(other.plan, signal()));
  assert.equal((await recovery.retire(other.plan, signal()) as ReturnType<typeof judgeReply>["evidence"]).metadata.drain, null);
  assert.equal(attempts, 2); assert.equal(other.events.filter(value => value === "launch").length, 1);
});
test("retirement refuses cancelled and overlapping turns without interrupting a currently owned backend call", async () => {
  const h = backendHarness(), backend = h.backend(), start = h.driver.start;
  await assert.rejects(backend.retire(h.plan, AbortSignal.abort())); assert.deepEqual(h.events, []);
  let continueStart!: () => void, observed!: () => void;
  const waiting = new Promise<void>(resolve => { observed = resolve; }), release = new Promise<void>(resolve => { continueStart = resolve; });
  h.driver.start = async (...args) => { observed(); await release; await start(...args); };
  const execution = backend.execute(h.plan, signal());
  try { await waiting; await assert.rejects(backend.retire(h.plan, signal())); assert.equal(h.records.stopped, undefined); }
  finally { continueStart(); await execution; }
});

function dockerInspection(ref = fixture().ref) {
  return { Id: "c".repeat(64), Name: `/${ref.name}`, Image: ref.intent.image_id, RestartCount: 0,
    Config: { Image: ref.intent.image_id, User: "0:0", Tty: false, OpenStdin: true, StdinOnce: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
      Entrypoint: ["/usr/local/bin/node"], Cmd: [CAPSULE_ENTRY], Healthcheck: { Test: ["NONE"] }, Labels: Object.fromEntries(Object.entries(ref.labels).reverse()) },
    HostConfig: { Privileged: false, ReadonlyRootfs: true, NetworkMode: "none", CgroupnsMode: "host", CgroupParent: `${ref.parent}/docker`, PidMode: "", IpcMode: "private", UsernsMode: "",
      AutoRemove: false, PublishAllPorts: false, Memory: 1610612736, MemorySwap: 1610612736, CpuPeriod: 100000, CpuQuota: 75000, PidsLimit: 128, Init: false,
      LogConfig: { Type: "none" }, RestartPolicy: { Name: "no", MaximumRetryCount: 0 }, CapAdd: CAPSULE_CAPABILITIES.map(value => `CAP_${value}`), CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges=true", `apparmor=${CAPSULE_APPARMOR}`, `seccomp=${seccomp}`], Ulimits: [{ Name: "nofile", Soft: 1024, Hard: 1024 }, { Name: "core", Soft: 0, Hard: 0 }],
      Binds: null, VolumesFrom: null, Devices: [], DeviceRequests: null, Links: null, PortBindings: {}, Tmpfs: CAPSULE_TMPFS },
    State: { Status: "created", Running: false, Pid: 0, Paused: false, Restarting: false, Dead: false, StartedAt: "0001-01-01T00:00:00Z" }, NetworkSettings: { Ports: {} },
    Mounts: capsuleMounts(ref).map(mount => ({ Source: mount.source, Destination: mount.target, Type: "bind", RW: !mount.readonly, Propagation: "rprivate" })) };
}
test("the fixed Docker definition pins the image, command, ownership, no network/restarts/logs, limits and exact mounts", () => {
  const { ref } = fixture(), args = capsuleCreateArguments(ref), row = dockerInspection(ref);
  assert.equal(args.includes("--privileged"), false); assert.equal(args.includes("--rm"), false);
  assert.deepEqual(args.slice(-4), ["--entrypoint", "/usr/local/bin/node", release.imageId, CAPSULE_ENTRY]);
  assert.equal(args.includes("--pull=never"), true); assert.equal(args.includes("none"), true);
  assert.equal(inspectDockerCapsule(Buffer.from(JSON.stringify([row])), ref, seccompHash).status, "created");
  assert.doesNotMatch(JSON.stringify(ref), /source_b64|stdin_b64/);
});
test("Docker inspection rejects foreign labels/image, weakened protection, extra mounts, restarts, altered commands and resource policies", () => {
  const { ref } = fixture();
  const changes = [
    (r: any) => { r.Config.Labels["ingenium.executor.owner"] = randomUUID(); }, (r: any) => { r.Image = `sha256:${"d".repeat(64)}`; },
    (r: any) => { r.HostConfig.Privileged = true; }, (r: any) => { r.HostConfig.NetworkMode = "host"; }, (r: any) => { r.HostConfig.ReadonlyRootfs = false; },
    (r: any) => { r.HostConfig.SecurityOpt[2] = 'seccomp={"defaultAction":"SCMP_ACT_ALLOW"}'; },
    (r: any) => { r.HostConfig.CapAdd.push("CAP_NET_ADMIN"); }, (r: any) => { r.HostConfig.CgroupParent = "/docker"; }, (r: any) => { r.HostConfig.MemorySwap *= 2; },
    (r: any) => { r.RestartCount = 1; }, (r: any) => { r.HostConfig.RestartPolicy.Name = "always"; }, (r: any) => { r.HostConfig.Init = true; },
    (r: any) => { r.Config.Cmd = ["-e", "code"]; }, (r: any) => { r.Config.Healthcheck.Test = ["CMD", "code"]; },
    (r: any) => { r.Mounts.push({ Type: "bind", Source: "/var/run/docker.sock", Destination: "/socket", RW: true }); },
    (r: any) => { r.Mounts[0].RW = true; }, (r: any) => { r.Mounts[0].Source = "/other"; },
    (r: any) => { r.State.Running = true; }, (r: any) => { r.HostConfig.Ulimits[0].Hard = 4096; },
    (r: any) => { r.HostConfig.Tmpfs = { ...r.HostConfig.Tmpfs, "/run/ingenium/workspace": "rw,size=1g" }; },
  ];
  for (const change of changes) { const row = dockerInspection(ref); change(row); assert.throws(() => inspectDockerCapsule(Buffer.from(JSON.stringify([row])), ref, seccompHash)); }
});
test("the real Docker adapter uses original IDs only, never retries failed starts, and refuses before create when preparations fail", async () => {
  const { ref } = fixture(), row = dockerInspection(ref), calls: string[][] = []; let ready = false;
  const driver = createDockerCapsuleDriver(async (args, _input, s) => { s.throwIfAborted(); calls.push([...args]);
    if (args[0] === "inspect") return Buffer.from(JSON.stringify([row]));
    if (args[0] === "start") throw new Error("lost pipe");
    return Buffer.from(`${row.Id}\n`);
  }, seccompHash, async () => { if (!ready) throw new Error("not prepared"); });
  await assert.rejects(driver.create(ref, signal())); assert.equal(calls.length, 0); ready = true;
  assert.equal(await driver.create(ref, signal()), row.Id);
  await assert.rejects(driver.start(ref, row.Id, Buffer.alloc(0), signal())); assert.equal(calls.filter(args => args[0] === "start").length, 1);
  await assert.rejects(driver.inspect(ref, "different", signal())); await driver.remove(ref, row.Id, signal()); assert.deepEqual(calls.at(-1), ["rm", row.Id]);
});

test("removal reconciliation refuses a retained original ID even when its expected name is absent", async () => {
  const h = harness(), remove = h.driver.remove;
  h.driver.remove = async (...args) => { await remove(...args); throw new Error("Lost removal reply"); };
  await h.lifecycle().execute(h.plan, h.input, signal()); await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal()));
  h.driver.assertAbsent = async () => { throw new Error("Original ID remains under another name"); };
  await assert.rejects(h.lifecycle().recover(h.plan, signal())); await assert.rejects(h.lifecycle().stopAndRemove(h.plan, signal()));
  assert.equal(h.records.removed, undefined); assert.equal(h.events.filter(event => event === "launch").length, 1);
});
test("the shared absence check queries full original ID and exact name separately and rejects any nonempty or failed response", async () => {
  const { ref } = fixture(), id = "c".repeat(64), calls: string[][] = [];
  const empty = createDockerCapsuleDriver(async args => { calls.push([...args]); return Buffer.alloc(0); }, seccompHash, async () => {});
  await empty.assertAbsent(ref, id, signal());
  assert.deepEqual(calls.map(args => args[5]), [`id=${id}`, `name=^/${ref.name}$`]);
  for (const index of [0, 1]) {
    let n = 0; const present = createDockerCapsuleDriver(async () => n++ === index ? Buffer.from(`${id}\n`) : Buffer.alloc(0), seccompHash, async () => {});
    await assert.rejects(present.assertAbsent(ref, id, signal()));
  }
  const broken = createDockerCapsuleDriver(async () => { throw new Error("Daemon unavailable"); }, seccompHash, async () => {});
  await assert.rejects(broken.assertAbsent(ref, id, signal())); await assert.rejects(empty.assertAbsent(ref, "short", signal()));
});
