import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { commandFingerprint, sameVerifier, uuid } from "./credentials.js";
import type { SessionDelivery } from "./credentials.js";
import { boundedStaffText } from "./staff-management.js";
import { createStaffService, staffOutcomeCapacity } from "./staff-service.js";
import { staffQuota } from "./quotas.js";
import {
  AccessError,
  accessTransaction,
  advanceRoundTime,
  decisionTime,
  first,
} from "./transaction.js";
import type { ClockGuard } from "./transaction.js";
import { createParticipantReads } from "../workbench/scope.js";

export interface AnnouncementCommand {
  arenaId: string;
  scope: "EVENT" | "ROUND" | "TEAM";
  roundId: string | null;
  teamId: string | null;
  requestKey: string;
  message: string;
  reason: string;
}
interface Receipt {
  id: string;
  request_key: string;
  outcome: string;
  denial_reason: string | null;
  recorded_at: Date;
  fingerprint: Buffer;
}
const participantScope = `a.outcome='APPLIED' AND a.arena_id=(SELECT arena_instance_id FROM rounds WHERE id=$1)
  AND (a.scope='EVENT' OR (a.scope='ROUND' AND a.round_id=$1) OR (a.scope='TEAM' AND a.team_id=(SELECT team_id FROM team_rounds WHERE id=$2)))`;
const metadata = "a.id,a.scope,a.recorded_at";
const typedScope =
  "WITH scope AS (SELECT $1::uuid AS round_id,$2::uuid AS team_round_id,$3::uuid AS arena_id)";
export function validateAnnouncement(input: AnnouncementCommand) {
  uuid(input.arenaId);
  uuid(input.requestKey);
  if (input.roundId !== null) uuid(input.roundId);
  if (input.teamId !== null) uuid(input.teamId);
  if (!(
    (input.scope === "EVENT" &&
      input.roundId === null &&
      input.teamId === null) ||
    (input.scope === "ROUND" &&
      input.roundId !== null &&
      input.teamId === null) ||
    (input.scope === "TEAM" && input.teamId !== null && input.roundId === null)
  ))
    throw new AccessError("INVALID_CONTEXT");
  boundedStaffText(input.message, 4096);
  boundedStaffText(input.reason, 1024);
}
function receipt(row: Receipt) {
  return {
    id: row.id,
    request_key: row.request_key,
    outcome: row.outcome,
    reason: row.denial_reason,
    recorded_at: row.recorded_at.toISOString(),
  };
}
export async function announcementHead(
  client: PoolClient,
  round: string | null,
  team: string | null,
  arena: string | null,
) {
  // A visible count changes even when two immutable notices share a millisecond.
  const row = await first<{ revision: string }>(
    client,
    `${typedScope} SELECT count(*)::text AS revision FROM announcements a WHERE ${team ? participantScope : "a.outcome='APPLIED' AND a.arena_id=$3"}`,
    [round, team, arena],
  );
  return row?.revision === "0" ? null : (row?.revision ?? null);
}
export function createAnnouncementService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery),
    participant = createParticipantReads(pool, clock);
  async function staffRead<T>(
    cookie: unknown,
    work: (
      client: PoolClient,
      actor: Awaited<ReturnType<typeof staff.authorize>>,
    ) => Promise<T>,
  ) {
    const initial = await staff.inspect(cookie);
    await staffQuota(pool, clock, initial.staff_id, "READ_STAFF");
    return accessTransaction(
      pool,
      clock,
      async (client) =>
        work(
          client,
          await staff.authorize(
            client,
            cookie,
            await decisionTime(client, clock),
          ),
        ),
      "SHARED",
    );
  }
  async function list(
    client: PoolClient,
    where: string,
    args: unknown[],
    after?: string,
    staffView = false,
  ) {
    if (after !== undefined) uuid(after);
    if (
      after &&
      !(await first(
        client,
        `${typedScope} SELECT a.id FROM announcements a WHERE ${where} AND a.id=$4`,
        [...args, after],
      ))
    )
      throw new AccessError("ACCESS_UNAVAILABLE");
    const rows = (
      await client.query(
        `${typedScope} SELECT ${metadata}${staffView ? ",a.round_id,a.team_id" : ""} FROM announcements a WHERE ${where}
      AND ($4::uuid IS NULL OR (a.recorded_at,a.id)<(SELECT recorded_at,id FROM announcements WHERE id=$4)) ORDER BY a.recorded_at DESC,a.id DESC LIMIT 41`,
        [...args, after ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 40),
      next_after: rows.length > 40 ? rows[39]!.id : null,
    };
  }
  return {
    async send(cookie: unknown, input: AnnouncementCommand) {
      validateAnnouncement(input);
      const initial = await staff.inspect(cookie);
      await staffQuota(pool, clock, initial.staff_id, "STAFF_COMMAND");
      const fingerprint = commandFingerprint([
        "ANNOUNCE",
        input.arenaId,
        input.scope,
        input.roundId,
        input.teamId,
        input.message,
        input.reason,
      ]);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const gate = await first<{ current_instance_id: string | null }>(
            client,
            "SELECT * FROM lock_arena_control(true)",
          );
          const rounds = (
            await client.query<{ id: string }>(
              "SELECT id FROM rounds WHERE arena_instance_id=$1 ORDER BY id FOR UPDATE",
              [input.arenaId],
            )
          ).rows.map((r) => r.id);
          const now = await decisionTime(client, clock, rounds),
            actor = await staff.authorize(client, cookie, now);
          const prior = await first<Receipt>(
            client,
            "SELECT * FROM announcements WHERE actor_id=$1 AND arena_id=$2 AND request_key=$3",
            [actor.staff_id, input.arenaId, input.requestKey],
          );
          if (prior) {
            if (!sameVerifier(prior.fingerprint, fingerprint))
              throw new AccessError("INTENT_CONFLICT");
            return receipt(prior);
          }
          const arena = await first<{ status: string }>(
            client,
            "SELECT status FROM arena_instances WHERE id=$1",
            [input.arenaId],
          );
          if (
            !arena ||
            (input.roundId && !rounds.includes(input.roundId)) ||
            (input.teamId &&
              !(await first(
                client,
                `SELECT 1 FROM rounds r WHERE r.arena_instance_id=$1 AND (EXISTS(SELECT 1 FROM round_draft_teams d WHERE d.round_id=r.id AND d.team_id=$2)
          OR EXISTS(SELECT 1 FROM team_rounds t WHERE t.round_id=r.id AND t.team_id=$2))`,
                [input.arenaId, input.teamId],
              )))
          )
            throw new AccessError("ACCESS_UNAVAILABLE");
          await staffOutcomeCapacity(client);
          const id = randomUUID(),
            applied =
              gate?.current_instance_id === input.arenaId &&
              ["SETUP", "IN_PROGRESS"].includes(arena.status);
          const row = await first<Receipt>(
            client,
            `INSERT INTO announcements(id,arena_id,scope,round_id,team_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,message,reason,outcome,denial_reason,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
            [
              id,
              input.arenaId,
              input.scope,
              input.roundId,
              input.teamId,
              actor.staff_id,
              actor.id,
              actor.credential_id,
              actor.credential_version,
              input.requestKey,
              fingerprint,
              input.message,
              input.reason,
              applied ? "APPLIED" : "REJECTED",
              applied ? null : "ARENA_CLOSED",
              now,
            ],
          );
          if (applied)
            await client.query(
              "UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1",
              [actor.id, now],
            );
          await advanceRoundTime(client, rounds, now);
          return receipt(row!);
        },
        "EXCLUSIVE",
      );
    },
    async outcome(cookie: unknown, arena: string, key: string) {
      uuid(arena);
      uuid(key);
      return staffRead(cookie, async (client, actor) => {
        const row = await first<Receipt>(
          client,
          "SELECT * FROM announcements WHERE actor_id=$1 AND arena_id=$2 AND request_key=$3",
          [actor.staff_id, arena, key],
        );
        return {
          status: row ? "OBSERVED" : "NOT_OBSERVED",
          outcome: row ? receipt(row) : null,
        };
      });
    },
    async staffList(cookie: unknown, arena: string, after?: string) {
      uuid(arena);
      return staffRead(cookie, async (client) => {
        if (
          !(await first(client, "SELECT id FROM arena_instances WHERE id=$1", [
            arena,
          ]))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        return list(
          client,
          "a.outcome='APPLIED' AND a.arena_id=$3",
          [null, null, arena],
          after,
          true,
        );
      });
    },
    async staffDetail(cookie: unknown, arena: string, id: string) {
      uuid(arena);
      uuid(id);
      return staffRead(cookie, async (client) => {
        const row = await first(
          client,
          `SELECT ${metadata},a.round_id,a.team_id,a.message FROM announcements a WHERE a.arena_id=$1 AND a.id=$2 AND a.outcome='APPLIED'`,
          [arena, id],
        );
        if (!row) throw new AccessError("ACCESS_UNAVAILABLE");
        return row;
      });
    },
    async participantList(cookie: unknown, after?: string) {
      return participant.read(cookie, undefined, (c) =>
        list(
          c.client,
          participantScope,
          [c.roundId, c.teamRoundId, null],
          after,
        ),
      );
    },
    async participantDetail(cookie: unknown, id: string) {
      uuid(id);
      return participant.read(cookie, undefined, async (c) => {
        const row = await first(
          c.client,
          `SELECT ${metadata},a.message FROM announcements a WHERE ${participantScope} AND a.id=$3`,
          [c.roundId, c.teamRoundId, id],
        );
        if (!row) throw new AccessError("ACCESS_UNAVAILABLE");
        return row;
      });
    },
  };
}
