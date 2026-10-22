import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  commandFingerprint,
  sameVerifier,
  sha256,
  uuid,
} from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { boundedStaffText } from "../access/staff-management.js";
import {
  createStaffService,
  staffOutcomeCapacity,
} from "../access/staff-service.js";
import { lockedRounds } from "../access/entry-service.js";
import { staffQuota } from "../access/quotas.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
} from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";

export interface SubmissionReviewInput {
  requestKey: string;
  confirmParentId: string;
  attemptId: string | null;
  reason: string;
}
interface Audit {
  session_id: string;
  id: string;
  parent_id: string;
  request_key: string;
  actor_id: string;
  reason: string;
  recorded_at: Date;
  source_digest: Buffer;
  attempt_id: string | null;
  result_digest: Buffer | null;
  fingerprint: Buffer;
}

export function validateSubmissionReview(
  parent: string,
  input: SubmissionReviewInput,
) {
  uuid(parent);
  uuid(input.requestKey);
  uuid(input.confirmParentId);
  if (input.confirmParentId !== parent)
    throw new AccessError("INVALID_CONTEXT");
  if (input.attemptId !== null) uuid(input.attemptId);
  boundedStaffText(input.reason, 1024);
}

export function createSubmissionReviewService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  async function authorized<T>(
    cookie: unknown,
    round: string,
    parent: string,
    exclusive: boolean,
    work: (
      client: PoolClient,
      actor: Awaited<ReturnType<typeof staff.authorize>>,
      now: Date,
    ) => Promise<T>,
  ) {
    uuid(round);
    uuid(parent);
    const initial = await staff.inspect(cookie);
    if (initial.role === "ORGANISER")
      throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(
      pool,
      clock,
      initial.staff_id,
      exclusive ? "STAFF_COMMAND" : "READ_STAFF",
    );
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        await lockedRounds(client, [round], true);
        const now = await decisionTime(client, clock, [round]),
          actor = await staff.authorize(client, cookie, now);
        if (actor.role === "ORGANISER")
          throw new AccessError("ACCESS_UNAVAILABLE");
        if (
          !(await first(
            client,
            "SELECT id FROM participant_judging WHERE id=$1 AND round_id=$2",
            [parent, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        return work(client, actor, now);
      },
      exclusive ? "EXCLUSIVE" : "SHARED",
    );
  }
  async function payload(client: PoolClient, audit: Audit) {
    const parent = await first<{
      source: Buffer;
      language: string;
      lane: string;
    }>(
      client,
      "SELECT source,language,lane FROM participant_judging WHERE id=$1",
      [audit.parent_id],
    );
    if (!parent || !sameVerifier(sha256(parent.source), audit.source_digest))
      throw new AccessError("SECURITY_UNAVAILABLE");
    let diagnostic: null | {
      attempt_id: string;
      result: string;
      stdout_b64: string;
      stderr_b64: string;
      compiler_output_b64: string;
      stdout_truncated: boolean;
      stderr_truncated: boolean;
      compiler_output_truncated: boolean;
    } = null;
    if (audit.attempt_id) {
      const attempt = await first<{
        result: string;
        result_digest: Buffer;
        stdout_prefix: Buffer;
        stderr: Buffer;
        compiler_output: Buffer;
        stdout_bytes: string;
        stderr_truncated: boolean;
        compiler_output_truncated: boolean;
      }>(
        client,
        `SELECT a.result,a.result_digest,a.stdout_prefix,a.stderr,a.compiler_output,
        a.evidence->>'stdout_bytes' AS stdout_bytes,(a.evidence->>'stderr_truncated')::boolean AS stderr_truncated,
        (a.evidence->>'compiler_output_truncated')::boolean AS compiler_output_truncated
        FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.parent_id=$2 AND a.resolved_at IS NOT NULL`,
        [audit.attempt_id, audit.parent_id],
      );
      if (!attempt || !sameVerifier(attempt.result_digest, audit.result_digest))
        throw new AccessError("SECURITY_UNAVAILABLE");
      diagnostic = {
        attempt_id: audit.attempt_id,
        result: attempt.result,
        stdout_b64: attempt.stdout_prefix.toString("base64"),
        stderr_b64: attempt.stderr.toString("base64"),
        compiler_output_b64: attempt.compiler_output.toString("base64"),
        stdout_truncated:
          Number(attempt.stdout_bytes) > attempt.stdout_prefix.length,
        stderr_truncated: attempt.stderr_truncated === true,
        compiler_output_truncated: attempt.compiler_output_truncated === true,
      };
    }
    return {
      audit_id: audit.id,
      request_key: audit.request_key,
      parent_id: audit.parent_id,
      recorded_at: audit.recorded_at.toISOString(),
      reason: audit.reason,
      source_sha256: audit.source_digest.toString("hex"),
      source_b64: parent.source.toString("base64"),
      language: parent.language,
      lane: parent.lane,
      diagnostic,
    };
  }
  return {
    async open(
      cookie: unknown,
      round: string,
      parent: string,
      input: SubmissionReviewInput,
    ) {
      validateSubmissionReview(parent, input);
      const fingerprint = commandFingerprint([
        "SUBMISSION_REVIEW_V1",
        round,
        parent,
        input.attemptId,
        input.reason,
      ]);
      return authorized(
        cookie,
        round,
        parent,
        true,
        async (client, actor, now) => {
          const prior = await first<Audit>(
            client,
            "SELECT * FROM submission_review_audits WHERE actor_id=$1 AND parent_id=$2 AND request_key=$3",
            [actor.staff_id, parent, input.requestKey],
          );
          if (prior) {
            if (!sameVerifier(prior.fingerprint, fingerprint))
              throw new AccessError("INTENT_CONFLICT");
            if (prior.session_id !== actor.id)
              throw new AccessError("ACCESS_UNAVAILABLE");
            return payload(client, prior);
          }
          let resultDigest: Buffer | null = null;
          if (input.attemptId) {
            const result = await first<{ result_digest: Buffer }>(
              client,
              `SELECT a.result_digest FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id
            WHERE a.id=$1 AND j.parent_id=$2 AND a.resolved_at IS NOT NULL`,
              [input.attemptId, parent],
            );
            if (!result) throw new AccessError("ACCESS_UNAVAILABLE");
            resultDigest = result.result_digest;
          }
          await staffOutcomeCapacity(client);
          const row = await first<Audit>(
            client,
            `INSERT INTO submission_review_audits(id,parent_id,round_id,actor_id,session_id,credential_id,credential_version,
          request_key,fingerprint,reason,source_digest,attempt_id,result_digest,recorded_at)
          SELECT $1,p.id,$2,$3,$4,$5,$6,$7,$8,$9,sha256(p.source),$10,$11,$12 FROM participant_judging p WHERE p.id=$13 RETURNING *`,
            [
              randomUUID(),
              round,
              actor.staff_id,
              actor.id,
              actor.credential_id,
              actor.credential_version,
              input.requestKey,
              fingerprint,
              input.reason,
              input.attemptId,
              resultDigest,
              now,
              parent,
            ],
          );
          if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
          return payload(client, row);
        },
      );
    },
    async outcome(cookie: unknown, round: string, parent: string, key: string) {
      uuid(key);
      return authorized(cookie, round, parent, false, async (client, actor) => {
        const row = await first<Audit>(
          client,
          "SELECT * FROM submission_review_audits WHERE actor_id=$1 AND parent_id=$2 AND request_key=$3 AND session_id=$4",
          [actor.staff_id, parent, key, actor.id],
        );
        return {
          status: row ? "OBSERVED" : "NOT_OBSERVED",
          receipt: row ? await payload(client, row) : null,
        };
      });
    },
    async history(
      cookie: unknown,
      round: string,
      parent: string,
      after?: string,
    ) {
      if (after !== undefined) uuid(after);
      return authorized(cookie, round, parent, false, async (client) => {
        if (
          after &&
          !(await first(
            client,
            "SELECT id FROM submission_review_audits WHERE id=$1 AND parent_id=$2 AND round_id=$3",
            [after, parent, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        const rows = (
          await client.query(
            `SELECT a.id,i.display_name AS actor_name,a.reason,a.recorded_at,a.attempt_id IS NOT NULL AS includes_diagnostics
          FROM submission_review_audits a JOIN staff_identities i ON i.id=a.actor_id WHERE a.parent_id=$1 AND a.round_id=$2
            AND ($3::uuid IS NULL OR (a.recorded_at,a.id)<(SELECT recorded_at,id FROM submission_review_audits WHERE id=$3))
          ORDER BY a.recorded_at DESC,a.id DESC LIMIT 41`,
            [parent, round, after ?? null],
          )
        ).rows;
        return {
          items: rows.slice(0, 40).map((row) => ({
            ...row,
            recorded_at: row.recorded_at.toISOString(),
          })),
          next_after: rows.length > 40 ? (rows[39]!.id as string) : null,
        };
      });
    },
  };
}
