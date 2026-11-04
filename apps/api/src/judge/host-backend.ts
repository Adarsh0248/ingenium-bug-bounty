import { sha256, uuid } from "../access/credentials.js";
import { setTimeout as delay } from "node:timers/promises";
import { getPriority, setPriority } from "node:os";
import { judgeJson } from "../content/judge-protocol.js";
import { createCapsuleBackend } from "./capsule-backend.js";
import type { CapsuleRelease } from "./capsule-lifecycle.js";
import { retirementContext } from "./capsule-retirement.js";
import type { RetirementRequest, TrustedHostRetirementAuthority } from "./capsule-retirement.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import { createExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { createHostCapsuleResources } from "./host-resources.js";
import { openCapsuleNamespacePins } from "./host-storage-pins.js";
import { storageAcknowledgement } from "./capsule-storage.js";
import { verifyNoCapsuleReferences } from "./capsule-residue.js";
import { readParticipantBatch } from '../content/batch-protocol.js';
import type { openVerifiedHost } from "./host-verification.js";
import type { IsolateSettings } from "./isolate-context.js";
import type { createJudgeSupervisorStore } from "./registry.js";

const fail = (): never => { throw new Error("Original host execution cannot be fully retired; retain its consumed permit."); };
const hash = (value: unknown) => sha256(judgeJson(value)).toString("hex");
export function checkedRetirementRequest(request: Readonly<RetirementRequest>, common: Omit<RetirementRequest, "nonce">) {
  if (judgeJson(request) !== judgeJson({ ...common, nonce: uuid(request.nonce) })) return fail();
  return request;
}

// The only production composition: observations come from kernel/daemon adapters, never request flags.
export function createHostBackend(store: ReturnType<typeof createJudgeSupervisorStore>, checkpoints: ExecutionCheckpoints,
  host: Awaited<ReturnType<typeof openVerifiedHost>>, settings: IsolateSettings, release: CapsuleRelease) {
  const pinned = { imageId: release.imageId, digest: release.digest };
  const batchCases = settings.batch ? readParticipantBatch(settings.batch.raw, { ...settings.batch, hostEpochId: settings.hostEpochId }, settings.runtimes).cases : undefined;
  if (store.hostEpochId !== settings.hostEpochId || store.bootId !== settings.bootId || checkpoints.hostEpochId !== store.hostEpochId
    || checkpoints.bootId !== store.bootId || judgeJson(Object.fromEntries(store.runtimes)) !== judgeJson(Object.fromEntries(settings.runtimes))) return fail();
  let namespacePins: { attempt: string; handles: Awaited<ReturnType<typeof openCapsuleNamespacePins>> } | null = null;
  const closePins = async () => { const original = namespacePins; namespacePins = null; await original?.handles.close(); };
  const physicalResources = createHostCapsuleResources(checkpoints, settings, async (plan, boot, physical, storage, signal) => {
    if (namespacePins && namespacePins.attempt !== plan.attemptId) return fail();
    const priority = getPriority(), inspectionPriority = Math.min(priority, 0);
    try {
      // A bounded safety inspection must not compete at background priority with new job preparations.
      setPriority(0, inspectionPriority); if (getPriority() !== inspectionPriority) return fail();
      const references = await namespacePins?.handles.references(signal);
      await verifyNoCapsuleReferences(plan, boot, physical, storage, signal, references);
      await namespacePins?.handles.references(signal);
    } finally { setPriority(0, priority); if (getPriority() !== priority) return fail(); }
  });
  const resources = { ...physicalResources,
    retire: (plan: ExecutionPlan, ref: Parameters<typeof physicalResources.retire>[1], signal: AbortSignal) =>
      store.withRetirementInspection(signal, current => physicalResources.retire(plan, ref, current), parseInt(plan.attemptId.slice(-1), 16) % 2),
    assertRetired: (plan: ExecutionPlan, ref: Parameters<typeof physicalResources.assertRetired>[1], signal: AbortSignal) =>
      store.withRetirementInspection(signal, current => physicalResources.assertRetired(plan, ref, current), parseInt(plan.attemptId.slice(-1), 16) % 2),
  };
  async function original(attempt: string) {
    const record = await store.execution(uuid(attempt));
    if (!record?.started || await store.deliveryState({ attempt_id: attempt, provider_token: record.providerToken }) !== "CONSUMED") return fail();
    return createExecutionPlan({ payload: record.payload, owner: record.owner, providerToken: record.providerToken }, store.runtimes);
  }
  const physicalDriver = host.installation.driver(async (ref, signal) => {
    const plan = await original(ref.labels["ingenium.executor.attempt"]!);
    await resources.verify(plan, ref, signal); await host.assertReady(signal);
  });
  const driver = { ...physicalDriver, async start(ref: Parameters<typeof physicalDriver.start>[0], id: string, input: Buffer, signal: AbortSignal) {
    if (namespacePins) return fail();
    const plan = await original(ref.labels["ingenium.executor.attempt"]!), cancelled = new AbortController();
    const current = AbortSignal.any([signal, cancelled.signal]); let pinsReady = false;
    const started = physicalDriver.start(ref, id, input, current);
    void started.then(() => { if (!pinsReady) cancelled.abort(); }, error => cancelled.abort(error));
    try {
      while (true) {
        current.throwIfAborted(); const physical = await checkpoints.physical(plan);
        const storage = physical ? await checkpoints.readCapsuleRecord(plan, "storage") : null;
        if (physical && storage) {
          if (physical.container_id !== id) return fail();
          const state = await physicalDriver.inspect(ref, id, current);
          if (!state.running || state.pid < 1) return fail();
          namespacePins = { attempt: plan.attemptId, handles: await openCapsuleNamespacePins(plan, settings.bootId, physical, storage, state.pid, current) };
          pinsReady = true;
          await checkpoints.saveCapsule(plan, "storage_ack", storageAcknowledgement(plan, settings.bootId, physical, storage));
          await started; return;
        }
        await delay(100, undefined, { signal: current });
      }
    } catch (error) {
      cancelled.abort(); await started.catch(() => {}); throw error;
    }
  } };
  const authority: TrustedHostRetirementAuthority = {
    hostEpochId: store.hostEpochId, bootId: store.bootId, releaseSha256: pinned.digest,
    ...(batchCases ? { batchCases } : {}),
    async prove(request, signal) {
      signal.throwIfAborted();
      const plan = await original(request.attempt_id), before = await retirementContext(checkpoints, pinned, plan, batchCases);
      checkedRetirementRequest(request, before.common);
      const readiness = await host.assertReady(signal);
      await driver.assertAbsent(before.ref, request.container_id, signal);
      await resources.assertRetired(plan, before.ref, signal);
      await driver.assertAbsent(before.ref, request.container_id, signal);
      const after = await retirementContext(checkpoints, pinned, await original(request.attempt_id), batchCases);
      checkedRetirementRequest(request, after.common);
      if (!readiness.equals(await host.assertReady(signal))) return fail();
      // Drop the only exempted references before certifying that the original workspace is gone.
      await closePins();
      signal.throwIfAborted();
      return { request_sha256: hash(request), observation_sha256: hash({ request, host_readiness: readiness.toString("hex"), original_consumed_permit: true,
        removed_resources_sha256: before.common.context_sha256, no_remaining_references: true }) };
    },
  };
  return { ...createCapsuleBackend(checkpoints, driver, pinned, store.runtimes, host.assertReady, resources, authority, async (plan, evidence) => {
    const record = await store.execution(plan.attemptId);
    if (!record?.started || record.owner !== plan.owner || record.providerToken !== plan.providerToken) return fail();
    if(settings.batch){
      const result=await checkpoints.readCapsuleRecord(plan,'batch_result');if(result===null)return fail();
      await store.sealBatch(plan.attemptId,plan.providerToken,plan.owner,result);
    }
    await store.seal(record.payload, record.providerToken, record.owner, evidence);
  }), close: closePins };
}
