import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { commandFingerprint, sameVerifier, uuid } from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { boundedStaffText, staffRevision } from "../access/staff-management.js";
import { createStaffService, staffOutcomeCapacity } from "../access/staff-service.js";
import { staffQuota } from "../access/quotas.js";
import { AccessError, accessTransaction, advanceRoundTime, decisionTime, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { planValidation } from "./validation-policy.js";
import type { ValidationCapture, ValidationVersion, ValidationIssue, ValidationVariant, ValidationCase, ValidationHint, ValidationWitness } from "./validation-policy.js";

export interface PrepareValidationCommand { versionId: string; expectedRevision: string; requestKey: string; reason: string; }
interface Receipt {
  id: string; version_id: string; request_key: string; fingerprint: Buffer; expected_revision: string;
  outcome: "APPLIED" | "UNCHANGED" | "REJECTED"; denial_reason: string | null; issues: ValidationIssue[]; recorded_at: Date; result_snapshot_id: string | null;
}
function identifier(value: unknown) { try { return uuid(value); } catch { throw new AccessError("INVALID_CONTEXT"); } }
function receiptView(row: Receipt) {
  return { outcome_id: row.id, version_id: row.version_id, request_key: row.request_key, expected_revision: row.expected_revision,
    outcome: row.outcome, reason: row.denial_reason, issues: row.issues, recorded_at: row.recorded_at.toISOString(), snapshot_id: row.result_snapshot_id,
    can_execute: false as const, can_publish: false as const };
}

export function createValidationService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery) {
  const staff = createStaffService(pool, clock, delivery);
  async function principal(client: PoolClient, cookie: unknown, now: Date) {
    const actor = await staff.authorize(client, cookie, now);
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    return actor;
  }
  async function budget(cookie: unknown, command = false) {
    const actor = await staff.inspect(cookie);
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(pool, clock, actor.staff_id, command ? "STAFF_COMMAND" : "READ_STAFF");
  }
  async function coordinated(client: PoolClient, cookie: unknown, versionId: string) {
    await client.query("SELECT * FROM lock_arena_control(true)");
    const rounds = (await client.query<{ id: string; state: string }>(`SELECT r.id,r.state FROM rounds r JOIN arena_control a ON a.current_instance_id=r.arena_instance_id ORDER BY r.id FOR UPDATE OF r`)).rows;
    await client.query("SELECT * FROM lock_catalogue()");
    const roundIds = rounds.map(r => r.id), now = await decisionTime(client, clock, roundIds), actor = await principal(client, cookie, now);
    const version = await first<ValidationVersion>(client, "SELECT v.*,d.round_type FROM bug_versions v JOIN bug_definitions d ON d.id=v.definition_id WHERE v.id=$1", [versionId]);
    if (!version) throw new AccessError("CONTENT_UNAVAILABLE");
    return { actor, now, roundIds, version, active: rounds.some(r => ["RUNNING", "PAUSED", "CLOSING", "CANCELLING"].includes(r.state)) };
  }
  type Context = Awaited<ReturnType<typeof coordinated>>;
  async function known(client: PoolClient, actorId: string, input: PrepareValidationCommand, fingerprint: Buffer) {
    const prior = await first<Receipt>(client, "SELECT * FROM validation_preparation_outcomes WHERE actor_id=$1 AND version_id=$2 AND request_key=$3", [actorId, input.versionId, input.requestKey]);
    if (prior && !sameVerifier(prior.fingerprint, fingerprint)) throw new AccessError("INTENT_CONFLICT");
    return prior ? receiptView(prior) : undefined;
  }
  function denial(context: Context, input: PrepareValidationCommand) {
    return context.version.content_revision !== input.expectedRevision ? "STALE_VERSION" : context.version.publication_status !== "DRAFT" ? "CONTENT_LOCKED" : context.active ? "ARENA_ACTIVE" : null;
  }
  async function save(client: PoolClient, c: Context, input: PrepareValidationCommand, fingerprint: Buffer, outcome: Receipt["outcome"], reason: string | null,
    issues: ValidationIssue[] = [], snapshotId: string | null = null, manifest?: string) {
    await staffOutcomeCapacity(client);
    const id = randomUUID();
    await client.query(`INSERT INTO validation_preparation_outcomes(id,version_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,
      expected_revision,reason,outcome,denial_reason,issues,recorded_at,result_snapshot_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)`,
      [id,input.versionId,c.actor.staff_id,c.actor.id,c.actor.credential_id,c.actor.credential_version,input.requestKey,fingerprint,input.expectedRevision,input.reason,
        outcome,reason,JSON.stringify(issues),c.now,snapshotId]);
    if (outcome === "APPLIED") {
      await client.query("SELECT freeze_validation_snapshot($1,$2)", [id,manifest]);
      await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1", [c.actor.id,c.now]);
    }
    await advanceRoundTime(client,c.roundIds,c.now);
    const row = await first<Receipt>(client,"SELECT * FROM validation_preparation_outcomes WHERE id=$1",[id]);
    if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
    return receiptView(row);
  }
  return {
    async prepare(cookie: unknown, input: PrepareValidationCommand) {
      identifier(input.versionId); identifier(input.requestKey); staffRevision(input.expectedRevision); boundedStaffText(input.reason,1024);
      const fingerprint = commandFingerprint(["VALIDATION_PREPARATION",input.versionId,input.expectedRevision,input.reason]);
      await budget(cookie,true);
      try {
        // Release control locks before full-source UTF-8 and completeness checks.
        const captured = await accessTransaction(pool,clock,async client => {
          const c = await coordinated(client,cookie,input.versionId), prior = await known(client,c.actor.staff_id,input,fingerprint);
          if (prior) return { receipt: prior };
          const reason = denial(c,input);
          if (reason) return { receipt: await save(client,c,input,fingerprint,"REJECTED",reason) };
          await staffOutcomeCapacity(client);
          await client.query(`INSERT INTO validation_snapshot_audits(id,version_id,actor_id,session_id,credential_id,credential_version,section,recorded_at)
            VALUES($1,$2,$3,$4,$5,$6,'CAPTURE',$7)`,[randomUUID(),input.versionId,c.actor.staff_id,c.actor.id,c.actor.credential_id,c.actor.credential_version,c.now]);
          const variants = (await client.query<ValidationVariant>(`SELECT v.*,r.digest AS manifest_digest FROM language_variants v LEFT JOIN runtime_manifests r
            ON r.key=v.runtime_key AND r.language=v.language WHERE v.version_id=$1 ORDER BY v.language`,[input.versionId])).rows;
          const cases = (await client.query<ValidationCase>("SELECT * FROM test_cases WHERE version_id=$1 AND removed_at IS NULL ORDER BY position",[input.versionId])).rows;
          const hints = (await client.query<ValidationHint>("SELECT * FROM bug_hints WHERE version_id=$1 ORDER BY level",[input.versionId])).rows;
          const witnesses = (await client.query<ValidationWitness>("SELECT * FROM failure_witnesses WHERE version_id=$1 ORDER BY variant_id,position",[input.versionId])).rows;
          const manifest = await first<{ text: string }>(client,"SELECT validation_configuration_manifest($1,false)::text AS text",[input.versionId]);
          if (!manifest?.text) throw new AccessError("SECURITY_UNAVAILABLE");
          await advanceRoundTime(client,c.roundIds,c.now);
          return { capture: { version:c.version,variants,cases,hints,witnesses,manifest_text:manifest.text } satisfies ValidationCapture };
        },"EXCLUSIVE");
        if (captured.receipt) return captured.receipt;
        const capture = captured.capture!, plan = planValidation(capture);
        return await accessTransaction(pool,clock,async client => {
          const c = await coordinated(client,cookie,input.versionId), prior = await known(client,c.actor.staff_id,input,fingerprint);
          if (prior) return prior;
          const reason = denial(c,input);
          if (reason) return save(client,c,input,fingerprint,"REJECTED",reason);
          if (plan.issues.length) return save(client,c,input,fingerprint,"REJECTED","CONTENT_INCOMPLETE",plan.issues);
          const existing = await first<{ id:string; fingerprint:Buffer }>(client,"SELECT id,fingerprint FROM validation_snapshots WHERE version_id=$1 AND content_revision=$2",[input.versionId,input.expectedRevision]);
          if (existing && !sameVerifier(existing.fingerprint,plan.fingerprint)) throw new AccessError("SECURITY_UNAVAILABLE");
          return save(client,c,input,fingerprint,existing ? "UNCHANGED" : "APPLIED",null,[],existing?.id ?? randomUUID(),capture.manifest_text);
        },"EXCLUSIVE");
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "54000") throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
        throw error;
      }
    },
    async outcome(cookie: unknown, versionId: string, requestKey: string) {
      identifier(versionId); identifier(requestKey); await budget(cookie);
      return accessTransaction(pool,clock,async client => {
        const actor = await principal(client,cookie,await decisionTime(client,clock));
        const row = await first<Receipt>(client,"SELECT * FROM validation_preparation_outcomes WHERE actor_id=$1 AND version_id=$2 AND request_key=$3",[actor.staff_id,versionId,requestKey]);
        return { status:row ? "OBSERVED" as const : "NOT_OBSERVED" as const, outcome:row ? receiptView(row) : null };
      },"SHARED");
    },
    async describe(cookie: unknown, snapshotId: string, section: "SUMMARY" | "CHECKS") {
      identifier(snapshotId); if (!["SUMMARY","CHECKS"].includes(section)) throw new AccessError("INVALID_CONTEXT"); await budget(cookie);
      return accessTransaction(pool,clock,async client => {
        const now = await decisionTime(client,clock), actor = await principal(client,cookie,now);
        const s = await first<{ id:string; version_id:string; content_revision:string; fingerprint:Buffer; created_at:Date }>(client,
          "SELECT id,version_id,content_revision,fingerprint,created_at FROM validation_snapshots WHERE id=$1",[snapshotId]);
        if (!s) throw new AccessError("CONTENT_UNAVAILABLE");
        await staffOutcomeCapacity(client);
        await client.query(`INSERT INTO validation_snapshot_audits(id,version_id,snapshot_id,actor_id,session_id,credential_id,credential_version,section,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),s.version_id,s.id,actor.staff_id,actor.id,actor.credential_id,actor.credential_version,section,now]);
        const checks = (await client.query(`SELECT id AS check_id,position,variant_id,language,source_role,check_type,case_id,witness_position,expected_result
          FROM validation_snapshot_checks WHERE snapshot_id=$1 ORDER BY position`,[snapshotId])).rows;
        return { snapshot_id:s.id,version_id:s.version_id,content_revision:s.content_revision,fingerprint:s.fingerprint.toString("hex"),created_at:s.created_at.toISOString(),
          planned_checks:checks.length,checks:section === "CHECKS" ? checks : [],can_execute:false as const,can_publish:false as const,validation_run_id:null };
      },"EXCLUSIVE");
    },
  };
}
