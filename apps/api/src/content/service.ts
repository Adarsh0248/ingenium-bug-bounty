import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { commandFingerprint, sameVerifier, sha256, uuid } from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { boundedStaffText, staffRevision } from "../access/staff-management.js";
import { createStaffService, staffOutcomeCapacity } from "../access/staff-service.js";
import { staffQuota } from "../access/quotas.js";
import { AccessError, accessTransaction, decisionTime, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { ACTIONS, prepareContent } from "./policy.js";
import type { ContentAction } from "./policy.js";

export interface ContentCommand { action: ContentAction; targetId: string | null; requestKey: string; expectedRevision: string; reason: string; payload: unknown; }
interface Version { id: string; definition_id: string; content_revision: string; publication_status: string; }
interface ContentSummary {
  version_id: string; definition_id: string; version_number: number; category: string | null; title: string; difficulty: number; base_bounty: number;
  publication_status: "DRAFT" | "PUBLISHED"; content_revision: string; round_type: number; definition_revision: string;
}
interface ContentMetadata extends ContentSummary { statement: string; submission_format: string; checker_mode: string; checker_version: string; }
interface Receipt {
  id: string; action: ContentAction; request_key: string; fingerprint: Buffer; expected_revision: string; outcome: "APPLIED" | "UNCHANGED" | "REJECTED";
  denial_reason: string | null; recorded_at: Date; result_definition_id: string | null; result_version_id: string | null; result_revision: string | null; result_case_id: string | null;
}
function identifier(value: unknown): string { try { return uuid(value); } catch { throw new AccessError("INVALID_CONTEXT"); } }
function receiptView(row: Receipt) {
  return { outcome_id: row.id, action: row.action, request_key: row.request_key, expected_revision: row.expected_revision, outcome: row.outcome,
    reason: row.denial_reason, recorded_at: row.recorded_at.toISOString(), definition_id: row.result_definition_id, version_id: row.result_version_id,
    content_revision: row.result_revision, case_id: row.result_case_id };
}
const versionColumns = `v.id AS version_id,v.definition_id,v.version_number,v.category,v.title,v.difficulty,v.base_bounty,v.publication_status,v.content_revision,
  d.round_type,d.revision AS definition_revision`;

export function createContentService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery) {
  const staff = createStaffService(pool, clock, delivery);
  async function principal(client: PoolClient, cookie: unknown, now: Date) {
    const actor = await staff.authorize(client, cookie, now);
    return actor;
  }
  async function budget(cookie: unknown, command = false) {
    const actor = await staff.inspect(cookie);
    await staffQuota(pool, clock, actor.staff_id, command ? "STAFF_COMMAND" : "READ_STAFF");
  }
  async function version(client: PoolClient, id: string) {
    const row = await first<Version>(client, "SELECT * FROM bug_versions WHERE id=$1", [id]);
    if (!row) throw new AccessError("CONTENT_UNAVAILABLE");
    return row;
  }
  const service = {
    async command(cookie: unknown, input: ContentCommand) {
      if (!ACTIONS.includes(input.action) || (input.action === "CREATE") !== (input.targetId === null)) throw new AccessError("INVALID_CONTEXT");
      identifier(input.requestKey); if (input.targetId) identifier(input.targetId);
      staffRevision(input.expectedRevision); boundedStaffText(input.reason, 1024);
      const payload = prepareContent(input.action, input.payload), payloadText = JSON.stringify(payload), digest = sha256(payloadText);
      const fingerprint = commandFingerprint(["CONTENT", input.action, input.targetId, input.expectedRevision, input.reason, digest.toString("hex")]);
      await budget(cookie, true);
      try { return await accessTransaction(pool, clock, async client => {
        const gate = await first<{ revision: string }>(client, "SELECT revision FROM lock_catalogue()");
        if (!gate) throw new AccessError("SECURITY_UNAVAILABLE");
        const now = await decisionTime(client, clock), actor = await principal(client, cookie, now);
        const definitionId = input.action === "NEW_VERSION" ? input.targetId : null;
        const versionId = input.action !== "CREATE" && input.action !== "NEW_VERSION" ? input.targetId : null;
        const prior = await first<Receipt>(client, `SELECT * FROM content_outcomes WHERE actor_id=$1 AND action=$2
          AND definition_id IS NOT DISTINCT FROM $3::uuid AND version_id IS NOT DISTINCT FROM $4::uuid AND request_key=$5`,
          [actor.staff_id, input.action, definitionId, versionId, input.requestKey]);
        if (prior) { if (!sameVerifier(prior.fingerprint, fingerprint)) throw new AccessError("INTENT_CONFLICT"); return receiptView(prior); }
        // Edit keys are version-wide, so a changed operation cannot recycle a previous key.
        if (versionId && await first(client, "SELECT id FROM content_outcomes WHERE actor_id=$1 AND version_id=$2 AND request_key=$3", [actor.staff_id, versionId, input.requestKey])) throw new AccessError("INTENT_CONFLICT");
        const current = versionId ? await version(client, versionId) : undefined;
        const definition = definitionId ? await first<{ id: string; revision: string }>(client, "SELECT id,revision FROM bug_definitions WHERE id=$1", [definitionId]) : undefined;
        if (definitionId && !definition) throw new AccessError("CONTENT_UNAVAILABLE");
        if (input.action === "VARIANT" && payload.runtime_key !== null && !await first(client,
          "SELECT key FROM runtime_manifests WHERE key=$1 AND language=$2", [payload.runtime_key, payload.language])) throw new AccessError("INVALID_CONTEXT");
        let outcome: Receipt["outcome"] = "APPLIED", denial: string | null = null;
        if (input.expectedRevision !== (current?.content_revision ?? definition?.revision ?? gate.revision)) denial = "STALE_VERSION";
        else if (current) {
          const decision = await first<{ state: string }>(client, "SELECT content_edit_status($1,$2,$3::jsonb) AS state", [input.action, current.id, payloadText]);
          if (!decision) throw new AccessError("SECURITY_UNAVAILABLE");
          if (decision.state === "UNCHANGED") outcome = "UNCHANGED";
          else if (decision.state !== "APPLIED") denial = decision.state;
        }
        if (denial) outcome = "REJECTED";
        await staffOutcomeCapacity(client);
        const id = randomUUID(), resultVersion = outcome === "REJECTED" ? null : current?.id ?? randomUUID();
        const resultDefinition = outcome === "REJECTED" ? null : current?.definition_id ?? definitionId ?? randomUUID();
        const revision = outcome === "REJECTED" ? null : current ? (BigInt(current.content_revision) + (outcome === "APPLIED" ? 1n : 0n)).toString() : "1";
        const caseId = outcome !== "REJECTED" && input.action === "CASE" ? payload.case_id as string | null ?? randomUUID() : null;
        await client.query(`INSERT INTO content_outcomes(id,actor_id,session_id,credential_id,credential_version,action,control_id,definition_id,version_id,request_key,
          fingerprint,payload_digest,expected_revision,reason,outcome,denial_reason,recorded_at,result_definition_id,result_version_id,result_revision,result_case_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [id, actor.staff_id, actor.id, actor.credential_id, actor.credential_version, input.action, input.action === "CREATE" ? 1 : null, definitionId, versionId, input.requestKey,
            fingerprint, digest, input.expectedRevision, input.reason, outcome, denial, now, resultDefinition, resultVersion, revision, caseId]);
        if (outcome === "APPLIED") {
          await client.query("SELECT apply_content_edit($1,$2)", [id, payloadText]);
          await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1", [actor.id, now]);
        }
        const row = await first<Receipt>(client, "SELECT * FROM content_outcomes WHERE id=$1", [id]);
        if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
        return receiptView(row);
      }, "EXCLUSIVE"); } catch (error) {
        if (error && typeof error === "object" && "code" in error) {
          if (error.code === "54000") throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
          if (error.code === "22023") throw new AccessError("CONTENT_LIMIT_EXCEEDED");
        }
        throw error;
      }
    },
    async list(cookie: unknown, after?: string) {
      if (after) identifier(after); await budget(cookie);
      return accessTransaction(pool, clock, async client => {
        await principal(client, cookie, await decisionTime(client, clock));
        const rows = await client.query<ContentSummary>(`SELECT ${versionColumns} FROM bug_versions v JOIN bug_definitions d ON d.id=v.definition_id
          WHERE ($1::uuid IS NULL OR v.id>$1) ORDER BY v.id LIMIT 51`, [after ?? null]);
        const gate = await first<{ revision: string; committed_bytes: string }>(client, "SELECT revision,committed_bytes FROM catalogue_control WHERE id=1");
        if (!gate) throw new AccessError("SECURITY_UNAVAILABLE");
        const items = rows.rows.slice(0, 50);
        return { control_revision: gate.revision, catalogue_bytes: gate.committed_bytes, items, next_after: rows.rows.length > 50 ? items.at(-1)!.version_id : null };
      }, "SHARED");
    },
    async describe(cookie: unknown, versionId: string) {
      identifier(versionId); await budget(cookie);
      return accessTransaction(pool, clock, async client => {
        await principal(client, cookie, await decisionTime(client, clock)); await version(client, versionId);
        const metadata = await first<ContentMetadata>(client, `SELECT ${versionColumns},v.statement,v.submission_format,v.checker_mode,v.checker_version FROM bug_versions v
          JOIN bug_definitions d ON d.id=v.definition_id WHERE v.id=$1`, [versionId]);
        if (!metadata) throw new AccessError("SECURITY_UNAVAILABLE");
        const variants = (await client.query("SELECT language,runtime_key,octet_length(starter_code) AS starter_bytes,octet_length(reference_code) AS reference_bytes FROM language_variants WHERE version_id=$1 ORDER BY language", [versionId])).rows;
        const cases = (await client.query<{ case_id: string; position: number; visibility: string; input_bytes: number; expected_bytes: number }>("SELECT id AS case_id,position,visibility,octet_length(input_data) AS input_bytes,octet_length(expected_output) AS expected_bytes FROM test_cases WHERE version_id=$1 AND removed_at IS NULL ORDER BY position", [versionId])).rows;
        const hints = (await client.query("SELECT id AS hint_id,level,octet_length(content) AS content_bytes FROM bug_hints WHERE version_id=$1 ORDER BY level", [versionId])).rows;
        return { ...metadata, variants, cases, hints, can_publish: false as const };
      }, "SHARED");
    },
    async privateRead(cookie: unknown, versionId: string, section: "VARIANTS" | "CASES" | "HINTS" | "WITNESSES", target?: string) {
      identifier(versionId);
      if (section === "CASES") identifier(target);
      if (section === "VARIANTS" && !["c", "cpp", "java", "python", "javascript"].includes(target ?? "")) throw new AccessError("INVALID_CONTEXT");
      if (!["VARIANTS", "CASES", "HINTS", "WITNESSES"].includes(section)) throw new AccessError("INVALID_CONTEXT");
      await budget(cookie);
      return accessTransaction(pool, clock, async client => {
        const now = await decisionTime(client, clock), actor = await principal(client, cookie, now);
        await version(client, versionId); await staffOutcomeCapacity(client);
        let data: unknown, variantId: string | null = null;
        if (section === "VARIANTS") {
          const row = await first<{ id: string; starter_code: Buffer; reference_code: Buffer; defect_description: string; runtime_key: string | null; cpu_ms: number | null; wall_ms: number | null; memory_kb: number | null }>(client,
            "SELECT * FROM language_variants WHERE version_id=$1 AND language=$2", [versionId, target]);
          if (!row) throw new AccessError("CONTENT_UNAVAILABLE");
          variantId = row.id;
          data = { variant_id: row.id, language: target, starter_code: row.starter_code.toString("utf8"), reference_solution_code: row.reference_code.toString("utf8"),
            defect_description: row.defect_description, runtime_key: row.runtime_key, cpu_time_limit_ms: row.cpu_ms, wall_time_limit_ms: row.wall_ms, memory_limit_kb: row.memory_kb };
        } else if (section === "CASES") {
          const row = await first<{ id: string; position: number; visibility: string; input_data: Buffer; expected_output: Buffer }>(client,
            "SELECT * FROM test_cases WHERE version_id=$1 AND id=$2 AND removed_at IS NULL", [versionId, target]);
          if (!row) throw new AccessError("CONTENT_UNAVAILABLE");
          data = { case_id: row.id, position: row.position, visibility: row.visibility, input_data: row.input_data.toString("utf8"), expected_output: row.expected_output.toString("utf8") };
        } else if (section === "HINTS") data = (await client.query("SELECT id AS hint_id,level,content FROM bug_hints WHERE version_id=$1 ORDER BY level", [versionId])).rows;
        else data = (await client.query(`SELECT v.language,w.position,w.check_type,w.test_case_id,CASE WHEN w.expected_failure='WRONG_ANSWER' THEN 'WRONG_OUTPUT' ELSE w.expected_failure END AS expected_failure
          FROM failure_witnesses w JOIN language_variants v ON v.id=w.variant_id WHERE w.version_id=$1 ORDER BY v.language,w.position`, [versionId])).rows;
        await client.query("INSERT INTO content_read_audits(id,version_id,actor_id,session_id,section,variant_id,case_id,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [randomUUID(), versionId, actor.staff_id, actor.id, section, variantId, section === "CASES" ? target : null, now]);
        return { version_id: versionId, section, data };
      }, "EXCLUSIVE");
    },
    async outcome(cookie: unknown, action: ContentAction, targetId: string | null, key: string) {
      if (!ACTIONS.includes(action) || (action === "CREATE") !== (targetId === null)) throw new AccessError("INVALID_CONTEXT");
      identifier(key); if (targetId) identifier(targetId); await budget(cookie);
      return accessTransaction(pool, clock, async client => {
        const actor = await principal(client, cookie, await decisionTime(client, clock));
        const row = await first<Receipt>(client, `SELECT * FROM content_outcomes WHERE actor_id=$1 AND action=$2 AND request_key=$3
          AND definition_id IS NOT DISTINCT FROM $4::uuid AND version_id IS NOT DISTINCT FROM $5::uuid`,
          [actor.staff_id, action, key, action === "NEW_VERSION" ? targetId : null, action === "CREATE" || action === "NEW_VERSION" ? null : targetId]);
        return { status: row ? "OBSERVED" as const : "NOT_OBSERVED" as const, outcome: row ? receiptView(row) : null };
      }, "SHARED");
    },
  };
  return service;
}
