import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  commandFingerprint,
  sameVerifier,
  uuid,
} from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { boundedStaffText } from "../access/staff-management.js";
import {
  createStaffService,
  staffOutcomeCapacity,
} from "../access/staff-service.js";
import { staffQuota } from "../access/quotas.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
} from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";

export interface DiagnosticInput {
  requestKey: string;
  confirmRunId: string;
  attemptId: string;
  reason: string;
}
interface Audit {
  id: string;
  run_id: string;
  attempt_id: string;
  session_id: string;
  request_key: string;
  fingerprint: Buffer;
  reason: string;
  result_digest: Buffer;
  recorded_at: Date;
}
export function validateDiagnostic(run: string, input: DiagnosticInput) {
  uuid(run);
  uuid(input.requestKey);
  uuid(input.confirmRunId);
  uuid(input.attemptId);
  boundedStaffText(input.reason, 1024);
  if (run !== input.confirmRunId) throw new AccessError("INVALID_CONTEXT");
}
export function createValidationDiagnosticService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  async function authorized<T>(
    cookie: unknown,
    run: string,
    write: boolean,
    work: (
      client: PoolClient,
      actor: Awaited<ReturnType<typeof staff.authorize>>,
      now: Date,
    ) => Promise<T>,
  ) {
    uuid(run);
    const initial = await staff.inspect(cookie);
    await staffQuota(
      pool,
      clock,
      initial.staff_id,
      write ? "STAFF_COMMAND" : "READ_STAFF",
    );
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        const now = await decisionTime(client, clock),
          actor = await staff.authorize(client, cookie, now);
        if (
          !(await first(client, "SELECT id FROM validation_runs WHERE id=$1", [
            run,
          ]))
        )
          throw new AccessError("CONTENT_UNAVAILABLE");
        return work(client, actor, now);
      },
      write ? "EXCLUSIVE" : "SHARED",
    );
  }
  async function payload(client: PoolClient, audit: Audit) {
    const row = await first<{
      result: string;
      result_digest: Buffer;
      stdout_prefix: Buffer | null;
      stderr: Buffer | null;
      compiler_output: Buffer | null;
      stdout_bytes: number;
      stdout_complete: boolean;
      stderr_truncated: boolean;
      compiler_output_truncated: boolean;
      cpu_ns: string;
      peak_bytes: string;
    }>(
      client,
      `SELECT a.result,a.result_digest,a.stdout_prefix,a.stderr,a.compiler_output,
      (a.evidence->>'stdout_bytes')::integer AS stdout_bytes,(a.evidence->>'stdout_complete')::boolean AS stdout_complete,
      (a.evidence->>'stderr_truncated')::boolean AS stderr_truncated,(a.evidence->>'compiler_output_truncated')::boolean AS compiler_output_truncated,
      a.evidence->>'cpu_ns' AS cpu_ns,a.evidence->>'peak_bytes' AS peak_bytes
      FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE a.id=$1 AND c.run_id=$2 AND a.resolved_at IS NOT NULL`,
      [audit.attempt_id, audit.run_id],
    );
    if (!row || !sameVerifier(row.result_digest, audit.result_digest))
      throw new AccessError("SECURITY_UNAVAILABLE");
    if (row.stdout_prefix === null || row.stderr === null || row.compiler_output === null) throw new AccessError("PAYLOAD_EXPIRED");
    return {
      audit_id: audit.id,
      run_id: audit.run_id,
      attempt_id: audit.attempt_id,
      request_key: audit.request_key,
      reason: audit.reason,
      recorded_at: audit.recorded_at.toISOString(),
      result: row.result,
      stdout_b64: row.stdout_prefix.toString("base64"),
      stderr_b64: row.stderr.toString("base64"),
      compiler_output_b64: row.compiler_output.toString("base64"),
      stdout_bytes: row.stdout_bytes,
      stdout_complete: row.stdout_complete,
      stdout_truncated: row.stdout_bytes > row.stdout_prefix.length,
      stderr_truncated: row.stderr_truncated,
      compiler_output_truncated: row.compiler_output_truncated,
      cpu_ns: row.cpu_ns,
      peak_bytes: row.peak_bytes,
    };
  }
  return {
    async open(cookie: unknown, run: string, input: DiagnosticInput) {
      validateDiagnostic(run, input);
      const fingerprint = commandFingerprint([
        "VALIDATION_DIAGNOSTIC_V1",
        run,
        input.attemptId,
        input.reason,
      ]);
      return authorized(cookie, run, true, async (client, actor, now) => {
        const prior = await first<Audit>(
          client,
          "SELECT * FROM validation_diagnostic_audits WHERE actor_id=$1 AND run_id=$2 AND request_key=$3",
          [actor.staff_id, run, input.requestKey],
        );
        if (prior) {
          if (!sameVerifier(prior.fingerprint, fingerprint))
            throw new AccessError("INTENT_CONFLICT");
          if (prior.session_id !== actor.id)
            throw new AccessError("ACCESS_UNAVAILABLE");
          return payload(client, prior);
        }
        const attempt = await first<{ result_digest: Buffer }>(
          client,
          `SELECT a.result_digest FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id
          WHERE a.id=$1 AND c.run_id=$2 AND a.resolved_at IS NOT NULL`,
          [input.attemptId, run],
        );
        if (!attempt) throw new AccessError("CONTENT_UNAVAILABLE");
        await staffOutcomeCapacity(client);
        const audit = await first<Audit>(
          client,
          `INSERT INTO validation_diagnostic_audits(id,run_id,attempt_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,reason,result_digest,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [
            randomUUID(),
            run,
            input.attemptId,
            actor.staff_id,
            actor.id,
            actor.credential_id,
            actor.credential_version,
            input.requestKey,
            fingerprint,
            input.reason,
            attempt.result_digest,
            now,
          ],
        );
        if (!audit) throw new AccessError("SECURITY_UNAVAILABLE");
        return payload(client, audit);
      });
    },
    async outcome(cookie: unknown, run: string, key: string) {
      uuid(key);
      return authorized(cookie, run, false, async (client, actor) => {
        const audit = await first<Audit>(
          client,
          "SELECT * FROM validation_diagnostic_audits WHERE actor_id=$1 AND run_id=$2 AND request_key=$3 AND session_id=$4",
          [actor.staff_id, run, key, actor.id],
        );
        return {
          status: audit ? "OBSERVED" : "NOT_OBSERVED",
          receipt: audit ? await payload(client, audit) : null,
        };
      });
    },
    async history(cookie: unknown, run: string, after?: string) {
      if (after !== undefined) uuid(after);
      return authorized(cookie, run, false, async (client) => {
        if (
          after &&
          !(await first(
            client,
            "SELECT id FROM validation_diagnostic_audits WHERE id=$1 AND run_id=$2",
            [after, run],
          ))
        )
          throw new AccessError("CONTENT_UNAVAILABLE");
        const rows = (
          await client.query(
            `SELECT a.id,a.attempt_id,i.display_name AS actor_name,a.reason,a.recorded_at FROM validation_diagnostic_audits a JOIN staff_identities i ON i.id=a.actor_id
          WHERE a.run_id=$1 AND ($2::uuid IS NULL OR (a.recorded_at,a.id)<(SELECT recorded_at,id FROM validation_diagnostic_audits WHERE id=$2))
          ORDER BY a.recorded_at DESC,a.id DESC LIMIT 41`,
            [run, after ?? null],
          )
        ).rows;
        return {
          items: rows
            .slice(0, 40)
            .map((r) => ({ ...r, recorded_at: r.recorded_at.toISOString() })),
          next_after: rows.length > 40 ? (rows[39]!.id as string) : null,
        };
      });
    },
  };
}
