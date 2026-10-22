import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { AccessError, decisionTime, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { acceptAuthoringObservation, authoringPayloadDigest } from "../content/execution-policy.js";
import type { AuthoringPayload, TrustedAuthoringDriver } from "../content/execution-policy.js";
import { judgeTransaction } from "../content/judge-transaction.js";

export function createParticipantJudgeWorker(pool: Pool, clock: ClockGuard, driver: TrustedAuthoringDriver, workerId = randomUUID()) {
  let generation: string | undefined, busy = false;
  async function defer(attemptId: string) {
    await judgeTransaction(pool, clock, async client => {
      await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
      await client.query("SELECT participant_defer($1,$2,$3)", [workerId, generation, attemptId]);
    });
  }
  async function payload(client: PoolClient, jobId: string, attemptId: string) {
    const row = await first<{ id: string; lane: "OFFICIAL" | "SAMPLE"; source: Buffer; language: AuthoringPayload["language"]; host_epoch_id: string;
      runtime_key: string; runtime_digest: Buffer; input_data: Buffer; expected_output: Buffer; cpu_ms: number; wall_ms: number; memory_kb: number; checker_mode: "TOKENS" | "EXACT_TEXT" }>(client,
    `SELECT p.id,p.lane,p.source,p.language,p.host_epoch_id,p.runtime_key,p.runtime_digest,c.input_data,c.expected_output,v.cpu_ms,v.wall_ms,v.memory_kb,s.checker_mode
      FROM participant_jobs j JOIN participant_judging p ON p.id=j.parent_id JOIN validation_snapshots s ON s.id=p.snapshot_id
      JOIN validation_snapshot_variants v ON v.snapshot_id=p.snapshot_id AND v.language=p.language
      JOIN validation_snapshot_cases c ON c.snapshot_id=p.snapshot_id AND c.case_id=j.case_id WHERE j.id=$1`, [jobId]);
    if (!row || row.host_epoch_id !== driver.hostEpochId || driver.runtimes.get(row.language)?.key !== row.runtime_key
      || driver.runtimes.get(row.language)?.digest !== row.runtime_digest.toString("hex")) throw new AccessError("JUDGE_UNAVAILABLE");
    const value: AuthoringPayload = { attemptId, hostEpochId: row.host_epoch_id, runId: row.id, checkId: jobId, runtimeKey: row.runtime_key,
      runtimeDigest: row.runtime_digest.toString("hex"), language: row.language, sourceRole: row.lane, checkType: "TEST_CASE", source: row.source,
      stdin: row.input_data, cpuMs: row.cpu_ms, wallMs: row.wall_ms, memoryKb: row.memory_kb };
    return { value, expected: row.expected_output, checker: row.checker_mode };
  }
  return {
    workerId,
    async claim() {
      await driver.assertReady(AbortSignal.timeout(10000));
      generation = await judgeTransaction(pool, clock, async client => {
        await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
        const host = await first<{ endpoint_ref: string }>(client, "SELECT endpoint_ref FROM judge_host_epochs WHERE id=$1 AND state='ACTIVE'", [driver.hostEpochId]);
        const runtimes = (await client.query<{ language: AuthoringPayload["language"]; runtime_key: string; digest: Buffer }>(
          `SELECT h.language,h.runtime_key,m.digest FROM judge_host_runtimes h JOIN runtime_manifests m ON m.key=h.runtime_key AND m.language=h.language WHERE h.host_epoch_id=$1`, [driver.hostEpochId])).rows;
        if (host?.endpoint_ref !== driver.endpointRef || runtimes.length !== 5 || driver.runtimes.size !== 5
          || runtimes.some(r => driver.runtimes.get(r.language)?.key !== r.runtime_key || driver.runtimes.get(r.language)?.digest !== r.digest.toString("hex"))) throw new AccessError("JUDGE_UNAVAILABLE");
        return (await first<{ generation: string | null }>(client, "SELECT claim_validation_worker($1,$2) generation", [workerId, driver.hostEpochId]))?.generation ?? undefined;
      });
      return generation !== undefined;
    },
    async tick() {
      if (!generation) throw new AccessError("JUDGE_UNAVAILABLE");
      if (busy) return "BUSY" as const; busy = true;
      try {
        const dispatch = await judgeTransaction(pool, clock, async client => {
          await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
          const next = await first<{ value: { attempt_id?: string; job_id: string; fresh: boolean } | null }>(client, "SELECT participant_next($1,$2) value", [workerId, generation]);
          if (!next?.value) return null;
          const choice = next.value, p = await payload(client, choice.job_id, choice.attempt_id ?? randomUUID());
          if (choice.fresh) await client.query("SELECT participant_prepare($1,$2,$3,$4,$5)", [workerId, generation, choice.job_id, p.value.attemptId, authoringPayloadDigest(p.value)]);
          else {
            const old = await first<{ payload_digest: Buffer }>(client, "SELECT payload_digest FROM participant_attempts WHERE id=$1", [p.value.attemptId]);
            if (!old || !old.payload_digest.equals(authoringPayloadDigest(p.value))) throw new AccessError("JUDGE_UNAVAILABLE");
          }
          return { ...p, fresh: choice.fresh };
        });
        if (!dispatch) return "IDLE" as const;
        let observation: unknown;
        try { observation = await (dispatch.fresh ? driver.submit(dispatch.value, AbortSignal.timeout(10000)) : driver.observe(dispatch.value, AbortSignal.timeout(10000))); }
        catch { await defer(dispatch.value.attemptId); return "UNCERTAIN" as const; }
        let accepted: ReturnType<typeof acceptAuthoringObservation>;
        try { accepted = acceptAuthoringObservation(dispatch.value, observation, dispatch.expected, dispatch.checker); }
        catch { await defer(dispatch.value.attemptId); return "UNUSABLE_EVIDENCE" as const; }
        if (!accepted) return "PENDING" as const;
        await judgeTransaction(pool, clock, async client => {
          await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
          await client.query("SELECT participant_record($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)", [workerId, generation, dispatch.value.attemptId,
            accepted.result, JSON.stringify(accepted.metadata), accepted.stdoutPrefix, accepted.stderr, accepted.compilerOutput, accepted.release]);
        });
        return "OBSERVED" as const;
      } finally { busy = false; }
    },
  };
}
