import type { Pool } from "pg";
import { canonicalCode, newAccessCode, sha256, uuid } from "./credentials.js";
import type { SessionDelivery } from "./credentials.js";
import { boundedStaffText, staffRevision } from "./staff-management.js";
import {
  createStaffService,
  confirmStaffCode,
  staffOutcomeCapacity,
} from "./staff-service.js";
import { staffQuota } from "./quotas.js";
import { lockedRounds } from "./entry-service.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
  advanceRoundTime,
} from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

export interface TeamCommand {
  action: "CREATE" | "ROTATE" | "ISSUE" | "REVOKE";
  targetId: string | null;
  requestKey: string;
  expectedRevision: string;
  teamName: string | null;
  memberOne: string | null;
  memberTwo: string | null;
  reason: string;
  ownCode: unknown;
}
interface Receipt {
  id: string;
  request_key: string;
  action: string;
  target_team_id: string | null;
  expected_revision: string;
  outcome: string;
  denial_reason: string | null;
  result_team_id: string | null;
  code_version: string | null;
  recorded_at: Date;
}
function view(r: Receipt) {
  return {
    outcome_id: r.id,
    request_key: r.request_key,
    action: r.action,
    target_team_id: r.target_team_id,
    expected_revision: r.expected_revision,
    outcome: r.outcome,
    reason: r.denial_reason,
    result_team_id: r.result_team_id,
    code_version: r.code_version,
    recorded_at: r.recorded_at.toISOString(),
  };
}
export function teamSearch(value: unknown = ""): string {
  if (
    typeof value !== "string" ||
    !value.isWellFormed() ||
    value.includes("\0") ||
    Buffer.byteLength(value) > 120
  )
    throw new AccessError("INVALID_CONTEXT");
  return value.trim();
}
const searchFilter = `($1::text='' OR strpos(lower(t.display_name),lower($1))>0
  OR EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.id AND strpos(lower(m.display_name),lower($1))>0)
  OR EXISTS(SELECT 1 FROM registration_sources s WHERE s.team_id=t.id AND strpos(lower(s.registration_id),lower($1))>0))`;
export function createTeamManagement(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  async function budget(cookie: unknown, write = false) {
    const actor = await staff.inspect(cookie);
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(
      pool,
      clock,
      actor.staff_id,
      write ? "STAFF_COMMAND" : "READ_STAFF",
    );
    if (write) await staffQuota(pool, clock, actor.session_id, "STAFF_CONFIRM");
  }
  async function principal(
    client: Parameters<typeof staff.authorize>[0],
    cookie: unknown,
  ) {
    const actor = await staff.authorize(
      client,
      cookie,
      await decisionTime(client, clock),
    );
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    return actor;
  }
  return {
    async command(cookie: unknown, input: TeamCommand) {
      uuid(input.requestKey);
      staffRevision(input.expectedRevision);
      boundedStaffText(input.reason, 1024);
      if (input.action === "CREATE") {
        if (input.targetId !== null) throw new AccessError("INVALID_CONTEXT");
        for (const name of [input.teamName, input.memberOne, input.memberTwo])
          boundedStaffText(name, 120);
      } else if (["ROTATE", "ISSUE", "REVOKE"].includes(input.action)) {
        uuid(input.targetId);
        if (
          input.teamName !== null ||
          input.memberOne !== null ||
          input.memberTwo !== null
        )
          throw new AccessError("INVALID_CONTEXT");
      } else throw new AccessError("INVALID_CONTEXT");
      await budget(cookie, true);
      const generated = input.action === "REVOKE" ? null : newAccessCode("TEAM");
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const rounds = input.targetId
            ? (
                await client.query<{ round_id: string }>(
                  "SELECT DISTINCT round_id FROM member_rounds WHERE team_id=$1 ORDER BY round_id",
                  [input.targetId],
                )
              ).rows.map((r) => r.round_id)
            : [];
          await lockedRounds(client, rounds);
          const now = await decisionTime(client, clock, rounds);
          const actor = await principal(client, cookie);
          await confirmStaffCode(client, actor, input.ownCode);
          const known = await first(
            client,
            "SELECT id FROM team_management_outcomes WHERE actor_id=$1 AND request_key=$2",
            [actor.staff_id, input.requestKey],
          );
          if (!known) await staffOutcomeCapacity(client);
          const row = await first<Receipt>(
            client,
            "SELECT * FROM manage_team_command($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            [
              actor.id,
              input.requestKey,
              input.action,
              input.targetId,
              input.expectedRevision,
              input.teamName,
              input.memberOne,
              input.memberTwo,
              input.reason,
              sha256(canonicalCode(input.ownCode)),
              generated?.verifier ?? null,
            ],
          );
          if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
          await advanceRoundTime(
            client,
            rounds,
            row.recorded_at > now ? row.recorded_at : now,
          );
          return {
            outcome: view(row),
            issued_code:
              !known && row.outcome === "APPLIED"
                ? (generated?.code ?? null)
                : null,
          };
        },
        "EXCLUSIVE",
      ).catch((error: unknown) => {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "22023"
        )
          throw new AccessError("INVALID_CONTEXT");
        throw error;
      });
    },
    async list(cookie: unknown, after?: string, search: unknown = "") {
      if (after) uuid(after);
      const term = teamSearch(search);
      await budget(cookie);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          await principal(client, cookie);
          if (
            after &&
            !(await first(
              client,
              `SELECT t.id FROM teams t WHERE ${searchFilter} AND t.id=$2`,
              [term, after],
            ))
          )
            throw new AccessError("INVALID_CONTEXT");
          const items = (
            await client.query(
              `SELECT t.id AS team_id,t.display_name AS team_name,
          (SELECT registration_id FROM registration_sources WHERE team_id=t.id) AS registration_id,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('member_id',m.id,'member_name',m.display_name,'position',m.position) ORDER BY m.position) FROM team_members m WHERE m.team_id=t.id),'[]'::jsonb) AS members,
          (SELECT COALESCE(max(version),0)::text FROM access_credentials WHERE team_id=t.id) AS code_version,
          EXISTS(SELECT 1 FROM access_credentials WHERE team_id=t.id AND revoked_at IS NULL) AS has_active_code
          FROM teams t WHERE ${searchFilter} AND ($2::uuid IS NULL OR t.id>$2) ORDER BY t.id LIMIT 51`,
              [term, after ?? null],
            )
          ).rows;
          const control = await first<{
            revision: string;
            count: number;
            matched: number;
          }>(
            client,
            `SELECT revision,(SELECT count(*)::integer FROM teams) AS count,(SELECT count(*)::integer FROM teams t WHERE ${searchFilter}) AS matched FROM security_control WHERE id=1`,
            [term],
          );
          if (!control) throw new AccessError("SECURITY_UNAVAILABLE");
          return {
            control_revision: control.revision,
            total: control.count,
            matched: control.matched,
            search: term,
            items: items.slice(0, 50),
            next_after: items.length > 50 ? items[49].team_id : null,
          };
        },
        "SHARED",
      );
    },
    async outcome(cookie: unknown, key: string) {
      uuid(key);
      await budget(cookie);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const actor = await principal(client, cookie),
            row = await first<Receipt>(
              client,
              "SELECT * FROM team_management_outcomes WHERE actor_id=$1 AND request_key=$2",
              [actor.staff_id, key],
            );
          return {
            status: row ? "OBSERVED" : "NOT_OBSERVED",
            outcome: row ? view(row) : null,
          };
        },
        "SHARED",
      );
    },
  };
}
