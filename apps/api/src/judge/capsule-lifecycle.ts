import { randomUUID } from "node:crypto";
import { sha256, uuid } from "../access/credentials.js";
import { readAuthoringRequest, readJudgeJson } from "../content/judge-protocol.js";
import { createExecutionPlan, reviewedExecutionPlan } from "./execution-plan.js";
import { EXECUTOR_PROTOCOL } from "./executor.js";
import type { ExecutionPlan } from "./execution-plan.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";

export interface CapsuleRelease { imageId: string; digest: string; }
export interface CapsuleIntent { version: 1; nonce: string; image_id: string; release_sha256: string; }
export interface CapsuleReference { intent: CapsuleIntent; name: string; parent: string; labels: Readonly<Record<string, string>>; }
export interface CapsuleState { id: string; running: boolean; pid: number; status: "created" | "running" | "exited"; starts: number; }
// Only trusted host adapters implement this boundary. It is not an HTTP/client-selected transport.
export interface CapsuleDriver {
  create(reference: CapsuleReference, signal: AbortSignal): Promise<string>;
  inspect(reference: CapsuleReference, id: string, signal: AbortSignal): Promise<CapsuleState>;
  find(reference: CapsuleReference, signal: AbortSignal): Promise<CapsuleState | null>;
  start(reference: CapsuleReference, id: string, request: Buffer, signal: AbortSignal): Promise<void>;
  stop(reference: CapsuleReference, id: string, signal: AbortSignal): Promise<void>;
  remove(reference: CapsuleReference, id: string, signal: AbortSignal): Promise<void>;
  assertAbsent(reference: CapsuleReference, id: string, signal: AbortSignal): Promise<void>;
}
export interface CapsuleResources {
  prepare(plan: ExecutionPlan, reference: CapsuleReference, signal: AbortSignal): Promise<void>;
  verify(plan: ExecutionPlan, reference: CapsuleReference, signal: AbortSignal): Promise<void>;
  retire(plan: ExecutionPlan, reference: CapsuleReference, signal: AbortSignal): Promise<void>;
}
const fail = (): never => { throw new Error("Capsule lifecycle uncertain; retain the original reservation and records."); };
const containerId = (value: unknown): string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value) ? value : fail();
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return fail();
  return value as Record<string, unknown>;
}
export function capsuleReference(plan: ExecutionPlan, value: unknown): CapsuleReference {
  const safe = reviewedExecutionPlan(plan), row = object(value, ["version", "nonce", "image_id", "release_sha256"]);
  if (row.version !== 1 || typeof row.image_id !== "string" || !/^sha256:[0-9a-f]{64}$/.test(row.image_id)
    || typeof row.release_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.release_sha256)) return fail();
  const nonce = uuid(row.nonce), name = `ingenium-exec-${nonce.replaceAll("-", "")}`;
  const intent: CapsuleIntent = { version: 1, nonce, image_id: row.image_id, release_sha256: row.release_sha256 };
  return { intent, name, parent: `/${name}`, labels: {
    "ingenium.executor.version": "1", "ingenium.executor.epoch": safe.hostEpochId, "ingenium.executor.attempt": safe.attemptId,
    "ingenium.executor.owner": safe.owner, "ingenium.executor.token": safe.providerToken,
    "ingenium.executor.plan": sha256(JSON.stringify({ ...safe, source: sha256(safe.source).toString("hex"), stdin: sha256(safe.stdin).toString("hex") })).toString("hex"),
    "ingenium.executor.release": intent.release_sha256, "ingenium.executor.nonce": nonce,
  } };
}
function checkedState(value: CapsuleState) {
  containerId(value.id);
  if (!Number.isSafeInteger(value.pid) || value.pid < 0 || ![0, 1].includes(value.starts)
    || !["created", "running", "exited"].includes(value.status)
    || value.running !== (value.status === "running") || value.running !== (value.pid > 0)
    || value.status === "created" && value.starts !== 0 || value.status !== "created" && value.starts !== 1) return fail();
  return value;
}

export async function readCapsuleJournal(checkpoints: ExecutionCheckpoints, release: CapsuleRelease, plan: ExecutionPlan) {
  const safe = reviewedExecutionPlan(plan), row = await checkpoints.capsule(safe); if (!row?.intent || safe.hostEpochId !== checkpoints.hostEpochId) return fail();
  const ref = capsuleReference(safe, row.intent);
  if (ref.intent.image_id !== release.imageId || ref.intent.release_sha256 !== release.digest) return fail();
  let id: string | null = null;
  if (row.container !== null) id = containerId(object(row.container, ["id"]).id);
  for (const name of ["start", "stopped", "remove", "removed"] as const)
    if (row[name] !== null && (id === null || object(row[name], ["id"]).id !== id)) return fail();
  if (row.remove !== null && row.stopped === null || row.removed !== null && row.remove === null) return fail();
  const physical = await checkpoints.physical(safe);
  if (physical !== null && (physical.container_id !== id || physical.cgroup_parent !== ref.parent)) return fail();
  return { row, ref, id };
}

// Docker removal proves only capsule removal. Parent groups/storage and positive drain are separate host duties.
export function createCapsuleLifecycle(checkpoints: ExecutionCheckpoints, driver: CapsuleDriver, release: CapsuleRelease, resources: CapsuleResources) {
  if (!/^sha256:[0-9a-f]{64}$/.test(release.imageId) || !/^[0-9a-f]{64}$/.test(release.digest)) return fail();
  const pinned = { imageId: release.imageId, digest: release.digest };
  function reference(plan: ExecutionPlan, intent: unknown) {
    if (plan.hostEpochId !== checkpoints.hostEpochId) return fail();
    const result = capsuleReference(plan, intent);
    if (result.intent.image_id !== pinned.imageId || result.intent.release_sha256 !== pinned.digest) return fail();
    return result;
  }
  async function saved(plan: ExecutionPlan) {
    return readCapsuleJournal(checkpoints, pinned, plan);
  }
  async function reconcile(plan: ExecutionPlan, signal: AbortSignal) {
    signal.throwIfAborted(); const record = await saved(plan), state = await driver.find(record.ref, signal);
    if (state) {
      checkedState(state);
      if (record.row.removed !== null || record.id !== null && state.id !== record.id) return fail();
      if (state.starts !== 0 && record.row.start === null) return fail();
      if (record.id === null) { await checkpoints.saveCapsule(plan, "container", { id: state.id }); record.id = state.id; }
    } else if (record.row.remove !== null) {
      await driver.assertAbsent(record.ref, record.id!, signal);
      await checkpoints.saveCapsule(plan, "removed", { id: record.id });
    }
    return { ...record, state };
  }
  return {
    async binding(plan: ExecutionPlan) {
      const record = await saved(reviewedExecutionPlan(plan));
      return { reference: record.ref, containerId: record.id, started: record.row.start !== null, removed: record.row.removed !== null };
    },
    async execute(plan: ExecutionPlan, request: Buffer, signal: AbortSignal) {
      signal.throwIfAborted(); const safe = reviewedExecutionPlan(plan);
      const input = Buffer.from(request), row = object(readJudgeJson(input), ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "permit_owner", "provider_token", "payload"]);
      if (row.protocol !== EXECUTOR_PROTOCOL || row.operation !== "EXECUTE" || row.host_epoch_id !== safe.hostEpochId || row.boot_id !== checkpoints.bootId
        || row.permit_owner !== safe.owner || row.provider_token !== safe.providerToken) return fail();
      const payload = row.payload as Record<string, unknown>;
      const original = readAuthoringRequest(payload, uuid(row.request_id), safe.hostEpochId, safe.attemptId, payload.payload_digest as string,
        new Map([[safe.language, { key: safe.runtimeKey, digest: safe.runtimeDigest }]]));
      if (JSON.stringify(createExecutionPlan({ payload: original, owner: safe.owner, providerToken: safe.providerToken },
        new Map([[safe.language, { key: safe.runtimeKey, digest: safe.runtimeDigest }]]))) !== JSON.stringify(safe)) return fail();
      const ref = reference(safe, { version: 1, nonce: randomUUID(), image_id: pinned.imageId, release_sha256: pinned.digest });
      await checkpoints.reserveCapsule(safe, ref.intent, signal);
      await resources.prepare(safe, ref, signal); signal.throwIfAborted();
      // No retries after this point: a lost create/start acknowledgement must use recovery, never EXECUTE again.
      const id = containerId(await driver.create(ref, signal));
      await checkpoints.saveCapsule(safe, "container", { id });
      const state = checkedState(await driver.inspect(ref, id, signal));
      if (state.id !== id || state.status !== "created") return fail();
      await resources.verify(safe, ref, signal);
      await checkpoints.saveCapsule(safe, "start", { id }); signal.throwIfAborted();
      await driver.start(ref, id, input, signal);
    },
    async recover(plan: ExecutionPlan, signal: AbortSignal) {
      const record = await reconcile(reviewedExecutionPlan(plan), signal);
      // Never create, start, attach input or infer a drain/result from container exit.
      return { containerId: record.id, state: record.state, removed: record.row.removed !== null || record.row.remove !== null && record.state === null };
    },
    async stopAndRemove(plan: ExecutionPlan, signal: AbortSignal) {
      const safe = reviewedExecutionPlan(plan), record = await reconcile(safe, signal);
      if (record.state === null) {
        if (record.row.remove === null) return fail();
        await resources.retire(safe, record.ref, signal);
        return { containerId: record.id!, removed: true as const };
      }
      const id = record.state.id;
      // Re-inspect the immutable ID/config immediately before any destructive request, including a repeated recovery.
      let state = checkedState(await driver.inspect(record.ref, id, signal)); if (state.id !== id) return fail();
      if (state.running) { await driver.stop(record.ref, id, signal); state = checkedState(await driver.inspect(record.ref, id, signal)); }
      if (state.id !== id || state.running || state.pid !== 0) return fail();
      await checkpoints.saveCapsule(safe, "stopped", { id });
      await checkpoints.saveCapsule(safe, "remove", { id }); signal.throwIfAborted();
      await driver.remove(record.ref, id, signal);
      if (await driver.find(record.ref, signal) !== null) return fail();
      await driver.assertAbsent(record.ref, id, signal);
      await checkpoints.saveCapsule(safe, "removed", { id });
      await resources.retire(safe, record.ref, signal);
      return { containerId: id, removed: true as const };
    },
  };
}
