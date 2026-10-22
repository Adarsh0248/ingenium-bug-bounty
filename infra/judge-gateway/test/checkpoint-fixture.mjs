// Synthetic protocol producer only; it never executes source or invents a real sandbox observation.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sha256 } from "/workspace/apps/api/dist/access/credentials.js";
import { judgeJson, readAuthoringRequest, readJudgeJson } from "/workspace/apps/api/dist/content/judge-protocol.js";
import { executionRequest } from "/workspace/apps/api/dist/judge/executor.js";
import { createExecutionPlan, EXECUTION_PLAN_SHA256 } from "/workspace/apps/api/dist/judge/execution-plan.js";
import { openExecutionCheckpoints } from "/workspace/apps/api/dist/judge/checkpoints.js";
import { createCheckpointedBackend } from "/workspace/apps/api/dist/judge/checkpoint-backend.js";
import { capsuleReference } from "/workspace/apps/api/dist/judge/capsule-lifecycle.js";
import { phaseInitialisation, phaseResourceRecord } from "/workspace/apps/api/dist/judge/phase-resources.js";
import { storageRecord } from "/workspace/apps/api/dist/judge/capsule-storage.js";
import { CAPSULE_TMPFS } from "/workspace/apps/api/dist/judge/docker-capsule.js";
import { createCapsuleRetirement } from "/workspace/apps/api/dist/judge/capsule-retirement.js";
import fixture from "/run/fixture.cjs";

export const boot = (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim();
export const runtimes = new Map(["c", "cpp", "java", "python", "javascript"].map(language => [language, { key: `synthetic-${language}`, digest: sha256(language).toString("hex") }]));
export const signal = () => AbortSignal.timeout(15000);
// Test-only transport authority; never a substitute for real host resources.
export const syntheticResources = { async prepare() {}, async verify() {}, async retire() {} };
export function claim(epoch = randomUUID(), language = "cpp") {
  const runtime = runtimes.get(language);
  return { payload: { hostEpochId: epoch, attemptId: randomUUID(), runId: randomUUID(), checkId: randomUUID(), language,
    runtimeKey: runtime.key, runtimeDigest: runtime.digest, sourceRole: "REFERENCE", checkType: "TEST_CASE",
    source: Buffer.from("synthetic fixture; never executable\0\r\n"), stdin: Buffer.from([0, 255, 10]), cpuMs: 1000, wallMs: 5000, memoryKb: 262144 },
    owner: randomUUID(), providerToken: randomUUID() };
}
export const planFor = c => createExecutionPlan(c, runtimes);
export const syntheticPhysical = { container_id: "b".repeat(64), cgroup_parent: `/ingenium-exec-${"a".repeat(32)}`,
  pid_namespace: "pid:[12345]", mount_namespace: "mnt:[12346]", network_namespace: "net:[12347]", ipc_namespace: "ipc:[12348]" };
export async function evidence(plan) {
  const c = { payload: { ...plan, ...plan.payloadLimits }, owner: plan.owner, providerToken: plan.providerToken };
  const request = executionRequest(c, boot, runtimes, "EXECUTE");
  return fixture.reply(request).reply.evidence;
}
export function engine(overrides = {}) {
  return { policySha256: EXECUTION_PLAN_SHA256, async assertReady() { return sha256("Synthetic readiness only"); },
    async execute(plan) { return evidence(plan); }, async recover() { return null; }, ...overrides };
}

export async function syntheticRetirement(store, plan) {
  const release = { imageId: `sha256:${"a".repeat(64)}`, digest: "b".repeat(64) };
  const intent = { version: 1, nonce: randomUUID(), image_id: release.imageId, release_sha256: release.digest }, ref = capsuleReference(plan, intent);
  const physical = { ...syntheticPhysical, container_id: "c".repeat(64), cgroup_parent: ref.parent };
  const hash = value => sha256(judgeJson(value)).toString("hex");
  const resourceIntent = { version: 1, boot_id: boot, configuration_sha256: "d".repeat(64), roots: { synthetic: true } };
  const resources = { intent_sha256: hash(resourceIntent), configuration: { synthetic: true }, groups: { synthetic: true } };
  const removal = { version: 1, boot_id: boot, container_id: physical.container_id, resources_sha256: hash(resources) };
  await store.reserveCapsule(plan, intent, signal());
  for (const name of ["container", "start", "stopped", "remove", "removed"]) await store.saveCapsule(plan, name, { id: physical.container_id });
  await store.begin(plan, signal()); await store.bindPhysical(plan, physical);
  for (const [key, value] of Object.entries({ resource_intent: resourceIntent, resources, resource_remove: removal, resource_removed: removal })) await store.saveCapsule(plan, key, value);
  for (const phase of ["compile", "run"]) if (plan[phase]) {
    const init = phaseInitialisation(plan, phase, boot, physical, (phase === "compile" ? "e" : "f").repeat(64));
    await store.saveCapsule(plan, `${phase}_init`, init);
    await store.saveCapsule(plan, `${phase}_groups`, phaseResourceRecord(init, { memory: { device: "11", inode: "12" }, cpuacct: { device: "21", inode: "22" } }));
  }
  const table = Object.keys(CAPSULE_TMPFS).map((path, i) => `${100 + i} 99 0:${200 + i} / ${path} rw,nosuid,nodev - tmpfs tmpfs rw\n`).join("");
  await store.saveCapsule(plan, "storage", storageRecord(plan, boot, physical, table));
  const original = await evidence(plan); original.metadata.drain = null; await store.save(plan, original);
  const forbidden = async () => { throw new Error("Synthetic retirement cannot launch any code"); };
  const driver = { create: forbidden, inspect: forbidden, find: forbidden, start: forbidden, stop: forbidden, remove: forbidden, async assertAbsent() {} };
  const authority = { hostEpochId: plan.hostEpochId, bootId: boot, releaseSha256: release.digest,
    async prove(request) { return { request_sha256: hash(request), observation_sha256: hash({ synthetic: true }) }; } };
  return { release, driver, authority, original };
}

if (["--persist", "--unfinished", "--physical-unfinished", "--capsule-start", "--phase-groups-recorded", "--phase-init-uncertain", "--storage-recorded", "--retirement-certificate"].includes(process.argv[2])) {
  const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
  const r = readJudgeJson(Buffer.concat(chunks));
  const p = readAuthoringRequest(r.payload, r.request_id, r.host_epoch_id, r.payload.attempt_id, r.payload.payload_digest, runtimes);
  const store = await openExecutionCheckpoints(r.host_epoch_id, r.boot_id), plan = planFor({ payload: p, owner: r.permit_owner, providerToken: r.provider_token });
  if (process.argv[2] === "--retirement-certificate") {
    const f = await syntheticRetirement(store, plan);
    const interrupted = { ...store, async save() { process.stdout.write("started"); await new Promise(() => setInterval(() => {}, 1000)); } };
    await createCapsuleRetirement(interrupted, f.driver, f.release, f.authority).seal(plan, signal());
    throw new Error("Unreachable synthetic interrupted save");
  }
  if (["--phase-groups-recorded", "--phase-init-uncertain", "--storage-recorded"].includes(process.argv[2])) {
    const intent = { version: 1, nonce: randomUUID(), image_id: `sha256:${"a".repeat(64)}`, release_sha256: "b".repeat(64) }, ref = capsuleReference(plan, intent);
    const physical = { ...syntheticPhysical, container_id: "c".repeat(64), cgroup_parent: ref.parent };
    await store.reserveCapsule(plan, intent, signal());
    await store.saveCapsule(plan, "container", { id: physical.container_id }); await store.saveCapsule(plan, "start", { id: physical.container_id });
    await store.begin(plan, signal()); await store.bindPhysical(plan, physical);
    if (process.argv[2] === "--storage-recorded") {
      const table = Object.keys(CAPSULE_TMPFS).map((path, i) => `${100 + i} 99 0:${200 + i} / ${path} rw,nosuid,nodev - tmpfs tmpfs rw\n`).join("");
      await store.saveCapsule(plan, "storage", storageRecord(plan, boot, physical, table));
      process.stdout.write("started"); await new Promise(() => setInterval(() => {}, 1000));
    }
    const init = phaseInitialisation(plan, "compile", boot, physical, "e".repeat(64));
    await store.saveCapsule(plan, "compile_init", init);
    // Deliberately synthetic inode numbers: this fixture tests persistence, never real kernel creation/removal.
    await store.saveCapsule(plan, "compile_groups", phaseResourceRecord(init, { memory: { device: "11", inode: "12" }, cpuacct: { device: "21", inode: "22" } }));
    if (process.argv[2] === "--phase-init-uncertain") await store.saveCapsule(plan, "run_init", phaseInitialisation(plan, "run", boot, physical, "f".repeat(64)));
    process.stdout.write("started"); await new Promise(() => setInterval(() => {}, 1000));
  }
  if (process.argv[2] === "--capsule-start") {
    await store.reserveCapsule(plan, { version: 1, nonce: randomUUID(), image_id: `sha256:${"a".repeat(64)}`, release_sha256: "b".repeat(64) }, signal());
    await store.saveCapsule(plan, "container", { id: "c".repeat(64) });
    await store.saveCapsule(plan, "start", { id: "c".repeat(64) });
    process.stdout.write("started"); await new Promise(() => setInterval(() => {}, 1000));
  }
  const backend = createCheckpointedBackend(store, engine(process.argv[2] !== "--persist" ? {
    async execute(plan) {
      if (process.argv[2] === "--physical-unfinished") await store.bindPhysical(plan, syntheticPhysical);
      process.stdout.write("started"); await new Promise(() => setInterval(() => {}, 1000));
    },
  } : {}));
  await backend.execute(plan, signal()); process.stdout.write("saved"); setInterval(() => {}, 1000);
}
