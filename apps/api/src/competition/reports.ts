import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  commandFingerprint,
  sameVerifier,
  uuid,
} from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { boundedStaffText, staffRevision } from "../access/staff-management.js";
import {
  staffActionVerifier,
  createStaffService,
  staffOutcomeCapacity,
} from "../access/staff-service.js";
import { lockedRounds } from "../access/entry-service.js";
import { memberCommandQuota, staffQuota } from "../access/quotas.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
} from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { createParticipantReads } from "../workbench/scope.js";

const reportColumns = `q.id,q.round_id,q.bounty_id,q.team_round_id,q.submission_id,q.parent_id,q.message,q.recorded_at,
  s.title,t.display_name AS team_name,m.display_name AS reporter_name,p.language,p.result AS submission_result,
  encode(q.source_digest,'hex') AS source_sha256,coalesce(d.verdict,'OPEN') AS status,d.reason AS decision_note`;
const reportJoins = `FROM question_reports q JOIN bounties b ON b.id=q.bounty_id JOIN validation_snapshots s ON s.id=b.snapshot_id
  JOIN team_rounds t ON t.id=q.team_round_id JOIN member_rounds m ON m.id=q.member_round_id
  LEFT JOIN participant_judging p ON p.id=q.parent_id LEFT JOIN report_decisions d ON d.report_id=q.id`;
const view = (
  row: Record<string, any>,
): Record<string, any> & { recorded_at: string } => ({
  ...row,
  recorded_at: row.recorded_at.toISOString(),
});
const decisionView = (row: Record<string, any>) => ({
  id: row.id,
  report_id: row.report_id,
  request_key: row.request_key,
  verdict: row.verdict,
  reason: row.reason,
  recorded_at: row.recorded_at.toISOString(),
});
const scoreView = (row: Record<string, any>) => ({
  id: row.id,
  round_id: row.round_id,
  team_round_id: row.team_round_id,
  report_id: row.report_id,
  request_key: row.request_key,
  delta: row.delta,
  reason: row.reason,
  recorded_at: row.recorded_at.toISOString(),
});
export interface ReportInput {
  requestKey: string;
  submissionId: string | null;
  message: string;
}
export interface ScoreInput {
  requestKey: string;
  teamRoundId: string;
  reportId: string | null;
  delta: number;
  reason: string;
  expectedRevision: string;
  ownCode: unknown;
}
export function validateScore(input: ScoreInput) {
  uuid(input.requestKey);
  uuid(input.teamRoundId);
  if (input.reportId !== null) uuid(input.reportId);
  staffRevision(input.expectedRevision);
  boundedStaffText(input.reason, 1024);
  if (
    !Number.isInteger(input.delta) ||
    input.delta === 0 ||
    Math.abs(input.delta) > 1000000
  )
    throw new AccessError("INVALID_CONTEXT");
}
export function createReportService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const reads = createParticipantReads(pool, clock),
    staff = createStaffService(pool, clock, delivery);
  async function report(client: PoolClient, id: string) {
    const row = await first(
      client,
      `SELECT ${reportColumns} ${reportJoins} WHERE q.id=$1`,
      [id],
    );
    if (!row) throw new AccessError("ACCESS_UNAVAILABLE");
    return view(row);
  }
  async function staffScope<T>(
    cookie: unknown,
    round: string,
    write: boolean,
    work: (
      client: PoolClient,
      actor: Awaited<ReturnType<typeof staff.authorize>>,
      now: Date,
    ) => Promise<T>,
    allowOrganiser = false,
  ) {
    uuid(round);
    const actor = await staff.inspect(cookie);
    if (actor.role === "ORGANISER" && !allowOrganiser)
      throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(
      pool,
      clock,
      actor.staff_id,
      write ? "STAFF_COMMAND" : "READ_STAFF",
    );
    if (write) await staffQuota(pool, clock, actor.staff_id, "STAFF_CONFIRM");
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        await client.query("SELECT * FROM lock_arena_control(false)");
        await lockedRounds(client, [round], !write);
        const now = await decisionTime(client, clock, [round]),
          current = await staff.authorize(client, cookie, now);
        if (current.role === "ORGANISER" && !allowOrganiser)
          throw new AccessError("ACCESS_UNAVAILABLE");
        return work(client, current, now);
      },
      write ? "EXCLUSIVE" : "SHARED",
    );
  }
  return {
    async create(
      cookie: unknown,
      round: string,
      bounty: string,
      input: ReportInput,
    ) {
      uuid(round);
      uuid(bounty);
      uuid(input.requestKey);
      if (input.submissionId !== null) uuid(input.submissionId);
      boundedStaffText(input.message, 1024);
      const actor = await reads.principal(cookie);
      await memberCommandQuota(pool, clock, actor.member_round_id);
      const fingerprint = commandFingerprint([
        "QUESTION_REPORT_V1",
        round,
        bounty,
        input.submissionId,
        input.message,
      ]);
      return reads.scoped(cookie, round, true, async (c) => {
        const prior = await first(
          c.client,
          "SELECT * FROM question_reports WHERE member_round_id=$1 AND request_key=$2",
          [c.memberRoundId, input.requestKey],
        );
        if (prior) {
          if (!sameVerifier(prior.fingerprint, fingerprint))
            throw new AccessError("INTENT_CONFLICT");
          return report(c.client, prior.id);
        }
        if (
          await first(
            c.client,
            "SELECT id FROM question_reports WHERE team_round_id=$1 AND bounty_id=$2",
            [c.teamRoundId, bounty],
          )
        )
          throw new AccessError("REPORT_ALREADY_EXISTS");
        const bound =
          input.submissionId === null
            ? null
            : await first(
                c.client,
                `SELECT id,sha256(source) digest FROM participant_judging
          WHERE submission_id=$1 AND round_id=$2 AND bounty_id=$3 AND team_round_id=$4 AND lane='OFFICIAL' AND source IS NOT NULL`,
                [input.submissionId, round, bounty, c.teamRoundId],
              );
        if (input.submissionId !== null && !bound)
          throw new AccessError("ACCESS_UNAVAILABLE");
        const id = randomUUID();
        await c.client.query(
          `INSERT INTO question_reports(id,round_id,bounty_id,team_round_id,member_round_id,session_id,request_key,fingerprint,message,submission_id,parent_id,source_digest,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            id,
            round,
            bounty,
            c.teamRoundId,
            c.memberRoundId,
            c.sessionId,
            input.requestKey,
            fingerprint,
            input.message,
            input.submissionId,
            bound?.id ?? null,
            bound?.digest ?? null,
            c.now,
          ],
        );
        return report(c.client, id);
      });
    },
    async participant(cookie: unknown, round: string, bounty: string) {
      uuid(bounty);
      return reads.read(cookie, round, async (c) => {
        const row = await first(
          c.client,
          "SELECT id FROM question_reports WHERE team_round_id=$1 AND bounty_id=$2 AND round_id=$3",
          [c.teamRoundId, bounty, round],
        );
        return { report: row ? await report(c.client, row.id) : null };
      });
    },
    async reportOutcome(
      cookie: unknown,
      round: string,
      bounty: string,
      key: string,
    ) {
      uuid(key);
      uuid(bounty);
      return reads.read(cookie, round, async (c) => {
        const row = await first(
          c.client,
          "SELECT id FROM question_reports WHERE member_round_id=$1 AND bounty_id=$2 AND round_id=$3 AND request_key=$4",
          [c.memberRoundId, bounty, round, key],
        );
        return {
          status: row ? "OBSERVED" : "NOT_OBSERVED",
          receipt: row ? await report(c.client, row.id) : null,
        };
      });
    },
    async list(cookie: unknown, round: string, after?: string) {
      if (after !== undefined) uuid(after);
      return staffScope(cookie, round, false, async (client) => {
        if (
          after &&
          !(await first(
            client,
            "SELECT id FROM question_reports WHERE id=$1 AND round_id=$2",
            [after, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        const rows = (
          await client.query(
            `SELECT ${reportColumns} ${reportJoins} WHERE q.round_id=$1 AND ($2::uuid IS NULL OR
          (q.recorded_at,q.id)<(SELECT recorded_at,id FROM question_reports WHERE id=$2)) ORDER BY q.recorded_at DESC,q.id DESC LIMIT 41`,
            [round, after ?? null],
          )
        ).rows;
        return {
          items: rows.slice(0, 40).map(view),
          next_after: rows.length > 40 ? rows[39].id : null,
        };
      });
    },
    async decide(
      cookie: unknown,
      round: string,
      id: string,
      input: {
        requestKey: string;
        verdict: string;
        reason: string;
        ownCode: unknown;
      },
    ) {
      uuid(id);
      uuid(input.requestKey);
      boundedStaffText(input.reason, 1024);
      if (!["UPHELD", "DISMISSED"].includes(input.verdict))
        throw new AccessError("INVALID_CONTEXT");
      return staffScope(cookie, round, true, async (client, actor, now) => {
        await staffActionVerifier(client, actor, input.ownCode);
        const fingerprint = commandFingerprint([
          "REPORT_DECISION_V1",
          round,
          id,
          input.verdict,
          input.reason,
        ]);
        const prior = await first(
          client,
          "SELECT * FROM report_decisions WHERE actor_id=$1 AND request_key=$2",
          [actor.staff_id, input.requestKey],
        );
        if (prior) {
          if (!sameVerifier(prior.fingerprint, fingerprint))
            throw new AccessError("INTENT_CONFLICT");
          return decisionView(prior);
        }
        if (
          !(await first(
            client,
            "SELECT id FROM question_reports WHERE id=$1 AND round_id=$2",
            [id, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        if (
          await first(
            client,
            "SELECT id FROM report_decisions WHERE report_id=$1",
            [id],
          )
        )
          throw new AccessError("REPORT_ALREADY_DECIDED");
        await staffOutcomeCapacity(client);
        return decisionView(
          (
            await client.query(
              `INSERT INTO report_decisions(id,report_id,actor_id,session_id,request_key,fingerprint,verdict,reason,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
              [
                randomUUID(),
                id,
                actor.staff_id,
                actor.id,
                input.requestKey,
                fingerprint,
                input.verdict,
                input.reason,
                now,
              ],
            )
          ).rows[0],
        );
      });
    },
    async adjust(cookie: unknown, round: string, input: ScoreInput) {
      validateScore(input);
      return staffScope(cookie, round, true, async (client, actor, now) => {
        await staffActionVerifier(client, actor, input.ownCode);
        const fingerprint = commandFingerprint([
          "SCORE_ADJUSTMENT_V1",
          round,
          input.teamRoundId,
          input.reportId,
          String(input.delta),
          input.reason,
          input.expectedRevision,
        ]);
        const prior = await first(
          client,
          "SELECT * FROM score_adjustments WHERE actor_id=$1 AND request_key=$2",
          [actor.staff_id, input.requestKey],
        );
        if (prior) {
          if (!sameVerifier(prior.fingerprint, fingerprint))
            throw new AccessError("INTENT_CONFLICT");
          return scoreView(prior);
        }
        const row = await first(
          client,
          "SELECT state,revision FROM rounds WHERE id=$1",
          [round],
        );
        if (row?.state !== "CLOSED") throw new AccessError("ROUND_NOT_FINAL");
        if (row.revision !== input.expectedRevision)
          throw new AccessError("STALE_VERSION");
        if (
          !(await first(
            client,
            "SELECT id FROM team_rounds WHERE id=$1 AND round_id=$2",
            [input.teamRoundId, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        if (
          input.reportId !== null &&
          !(await first(
            client,
            `SELECT q.id FROM question_reports q JOIN report_decisions d ON d.report_id=q.id
          WHERE q.id=$1 AND q.round_id=$2 AND q.team_round_id=$3 AND d.verdict='UPHELD'`,
            [input.reportId, round, input.teamRoundId],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        await staffOutcomeCapacity(client);
        return scoreView(
          (
            await client.query(
              `INSERT INTO score_adjustments(id,round_id,team_round_id,report_id,actor_id,session_id,request_key,fingerprint,expected_revision,delta,reason,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
              [
                randomUUID(),
                round,
                input.teamRoundId,
                input.reportId,
                actor.staff_id,
                actor.id,
                input.requestKey,
                fingerprint,
                input.expectedRevision,
                input.delta,
                input.reason,
                now,
              ],
            )
          ).rows[0],
        );
      });
    },
    async outcome(
      cookie: unknown,
      round: string,
      kind: "decision" | "score",
      key: string,
    ) {
      uuid(key);
      return staffScope(cookie, round, false, async (client, actor) => {
        const row = await first(
          client,
          kind === "score"
            ? `SELECT a.* FROM score_adjustments a WHERE a.actor_id=$1 AND a.request_key=$2 AND a.round_id=$3`
            : `SELECT a.* FROM report_decisions a JOIN question_reports q ON q.id=a.report_id WHERE a.actor_id=$1 AND a.request_key=$2 AND q.round_id=$3`,
          [actor.staff_id, key, round],
        );
        return {
          status: row ? "OBSERVED" : "NOT_OBSERVED",
          receipt: row
            ? kind === "score"
              ? scoreView(row)
              : decisionView(row)
            : null,
        };
      });
    },
    async adjustments(
      cookie: unknown,
      round: string,
      audience: "STAFF" | "PARTICIPANT",
      after?: string,
    ) {
      if (after !== undefined) uuid(after);
      const load = async (client: PoolClient) => {
        if (
          after &&
          !(await first(
            client,
            "SELECT id FROM score_adjustments WHERE id=$1 AND round_id=$2",
            [after, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        const rows = (
          await client.query(
            `SELECT a.id,a.team_round_id,t.display_name AS team_name,a.delta,a.reason,a.report_id,i.display_name AS actor_name,a.recorded_at
          FROM score_adjustments a JOIN team_rounds t ON t.id=a.team_round_id JOIN staff_identities i ON i.id=a.actor_id
          WHERE a.round_id=$1 AND ($2::uuid IS NULL OR (a.recorded_at,a.id)<(SELECT recorded_at,id FROM score_adjustments WHERE id=$2))
          ORDER BY a.recorded_at DESC,a.id DESC LIMIT 41`,
            [round, after ?? null],
          )
        ).rows;
        return {
          items: rows.slice(0, 40).map(view),
          next_after: rows.length > 40 ? rows[39].id : null,
        };
      };
      return audience === "STAFF"
        ? staffScope(cookie, round, false, load, true)
        : reads.read(cookie, round, (c) => load(c.client));
    },
  };
}
