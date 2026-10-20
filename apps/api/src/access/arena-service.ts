import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { commandFingerprint, sameVerifier, uuid } from "./credentials.js";
import type { SessionDelivery } from "./credentials.js";
import { boundedStaffText, staffRevision } from "./staff-management.js";
import { createStaffService, staffOutcomeCapacity } from "./staff-service.js";
import { staffQuota } from "./quotas.js";
import { AccessError, accessTransaction, advanceRoundTime, decisionTime, first } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

export interface ArenaSetupCommand {
  action: "CREATE" | "CONFIGURE"; roundId: string | null; requestKey: string; expectedRevision: string;
  durationMs: number; teamIds: string[]; reason: string;
}
interface Round {
  id: string; arena_instance_id: string; kind: number; state: string; duration_ms: string; configuration_revision: string;
}
interface Receipt {
  id: string; action: ArenaSetupCommand["action"]; round_id: string | null; request_key: string; fingerprint: Buffer;
  expected_revision: string; outcome: "APPLIED" | "UNCHANGED" | "REJECTED"; denial_reason: string | null; recorded_at: Date;
  result_instance_id: string | null; result_round_id: string | null; result_revision: string | null;
}
interface Team {
  team_id: string; team_name: string; members: { member_id: string; position: number; member_name: string }[];
}
const teamProjection = `t.id AS team_id,t.display_name AS team_name,COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'member_id',m.id,'position',m.position,'member_name',m.display_name) ORDER BY m.position) FROM team_members m WHERE m.team_id=t.id),'[]'::jsonb) AS members`;

function receiptView(row: Receipt) {
  return { outcome_id: row.id, action: row.action, target_round_id: row.round_id, request_key: row.request_key, expected_revision: row.expected_revision,
    outcome: row.outcome, reason: row.denial_reason, recorded_at: row.recorded_at.toISOString(),
    instance_id: row.result_instance_id, round_id: row.result_round_id, configuration_revision: row.result_revision };
}
function validate(input: ArenaSetupCommand): string[] {
  try { uuid(input.requestKey); if (input.roundId !== null) uuid(input.roundId); }
  catch { throw new AccessError("INVALID_CONTEXT"); }
  if (!["CREATE", "CONFIGURE"].includes(input.action) || (input.action === "CREATE") !== (input.roundId === null)
    || !Number.isSafeInteger(input.durationMs) || input.durationMs < 1 || input.durationMs > 18000000
    || !Array.isArray(input.teamIds) || input.teamIds.length > 100) throw new AccessError("INVALID_CONTEXT");
  staffRevision(input.expectedRevision); boundedStaffText(input.reason, 1024);
  let ids: string[];
  try { ids = input.teamIds.map(uuid).sort(); } catch { throw new AccessError("INVALID_CONTEXT"); }
  if (new Set(ids).size !== ids.length) throw new AccessError("INVALID_CONTEXT");
  return ids;
}

export function createArenaService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery) {
  const sessions = createStaffService(pool, clock, delivery);
  async function principal(client: PoolClient, cookie: unknown, now: Date, edit = false) {
    const actor = await sessions.authorize(client, cookie, now);
    if (edit && actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    return actor;
  }
  async function readBudget(cookie: unknown) {
    const actor = await sessions.inspect(cookie);
    await staffQuota(pool, clock, actor.staff_id, "READ_STAFF");
  }
  async function control(client: PoolClient, write = false) {
    const row = await first<{ current_instance_id: string | null; revision: string }>(client,
      "SELECT current_instance_id,revision FROM lock_arena_control($1)", [write]);
    if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
    return row;
  }
  return {
    async command(cookie: unknown, input: ArenaSetupCommand) {
      const ids = validate(input), initial = await sessions.inspect(cookie);
      if (initial.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
      await staffQuota(pool, clock, initial.staff_id, "STAFF_COMMAND");
      const fingerprint = commandFingerprint(["ARENA_SETUP", input.action, input.roundId, input.expectedRevision, String(input.durationMs), input.reason, ...ids]);
      return accessTransaction(pool, clock, async (client) => {
        const gate = await control(client, true);
        const round = input.roundId ? await first<Round>(client, "SELECT * FROM rounds WHERE id=$1 FOR UPDATE", [input.roundId]) : undefined;
        const locked = round ? [round.id] : [], now = await decisionTime(client, clock, locked), actor = await principal(client, cookie, now, true);
        const prior = await first<Receipt>(client, `SELECT * FROM arena_setup_outcomes WHERE actor_id=$1 AND action=$2
          AND round_id IS NOT DISTINCT FROM $3::uuid AND request_key=$4`, [actor.staff_id, input.action, input.roundId, input.requestKey]);
        if (prior) { if (!sameVerifier(prior.fingerprint, fingerprint)) throw new AccessError("INTENT_CONFLICT"); return receiptView(prior); }
        if (input.roundId && !round) throw new AccessError("ARENA_UNAVAILABLE");
        const selected = await client.query<Team>(`SELECT ${teamProjection} FROM teams t WHERE t.id=ANY($1::uuid[]) ORDER BY t.id`, [ids]);
        if (selected.rowCount !== ids.length) throw new AccessError("ARENA_UNAVAILABLE");
        await staffOutcomeCapacity(client);
        let outcome: Receipt["outcome"] = "APPLIED", denial: string | null = null;
        const parent = round ? await first<{ status: string; frozen: boolean }>(client,
          "SELECT status,EXISTS(SELECT 1 FROM team_rounds WHERE round_id=$2) AS frozen FROM arena_instances WHERE id=$1", [round.arena_instance_id, round.id]) : undefined;
        if (input.expectedRevision !== (round?.configuration_revision ?? gate.revision)) denial = "STALE_VERSION";
        else if (input.action === "CREATE" && gate.current_instance_id) denial = "ARENA_RESERVED";
        else if (round && (gate.current_instance_id !== round.arena_instance_id || parent?.status !== "SETUP" || parent.frozen || round.kind !== 1 || !["DRAFT", "READY"].includes(round.state))) denial = "ROUND_UNAVAILABLE";
        else if (selected.rows.some(t => t.members.length !== 2)) denial = "TEAM_INCOMPLETE";
        if (denial) outcome = "REJECTED";
        else if (round && round.duration_ms === String(input.durationMs)) {
          const old = await client.query<{ team_id: string }>("SELECT team_id FROM round_draft_teams WHERE round_id=$1 ORDER BY team_id", [round.id]);
          if (old.rows.length === ids.length && old.rows.every((r, i) => r.team_id === ids[i])) outcome = "UNCHANGED";
        }
        const id = randomUUID(), resultInstance = outcome === "REJECTED" ? null : round?.arena_instance_id ?? randomUUID();
        const resultRound = outcome === "REJECTED" ? null : round?.id ?? randomUUID();
        const resultRevision = outcome === "REJECTED" ? null : outcome === "UNCHANGED" ? round!.configuration_revision : (BigInt(round?.configuration_revision ?? "0") + 1n).toString();
        await client.query(`INSERT INTO arena_setup_outcomes(id,actor_id,session_id,credential_id,credential_version,action,control_id,round_id,request_key,fingerprint,
          expected_revision,duration_ms,reason,outcome,denial_reason,recorded_at,result_instance_id,result_round_id,result_revision)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [id, actor.staff_id, actor.id, actor.credential_id, actor.credential_version, input.action, input.action === "CREATE" ? 1 : null, input.roundId,
            input.requestKey, fingerprint, input.expectedRevision, input.durationMs, input.reason, outcome, denial, now, resultInstance, resultRound, resultRevision]);
        await client.query("INSERT INTO arena_setup_teams(outcome_id,team_id) SELECT $1,unnest($2::uuid[])", [id, ids]);
        if (outcome === "APPLIED") {
          await client.query("SELECT apply_arena_setup($1)", [id]);
          await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1", [actor.id, now]);
        }
        await advanceRoundTime(client, locked, now);
        const row = await first<Receipt>(client, "SELECT * FROM arena_setup_outcomes WHERE id=$1", [id]);
        if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
        return receiptView(row);
      }, "EXCLUSIVE");
    },
    async current(cookie: unknown) {
      await readBudget(cookie);
      return accessTransaction(pool, clock, async (client) => {
        const gate = await control(client);
        const rows = await client.query<Round>("SELECT * FROM rounds WHERE arena_instance_id=$1 ORDER BY id FOR SHARE", [gate.current_instance_id]);
        await principal(client, cookie, await decisionTime(client, clock, rows.rows.map(r => r.id)));
        const instance = gate.current_instance_id ? await first<{ id: string; status: string; revision: string; created_at: Date }>(client,
          "SELECT id,status,revision,created_at FROM arena_instances WHERE id=$1", [gate.current_instance_id]) : undefined;
        if (gate.current_instance_id && !instance) throw new AccessError("SECURITY_UNAVAILABLE");
        const setup = rows.rows.find(r => r.kind === 1);
        const roster = setup ? (await client.query<Team>(`SELECT ${teamProjection} FROM round_draft_teams d JOIN teams t ON t.id=d.team_id WHERE d.round_id=$1 ORDER BY t.id LIMIT 100`, [setup.id])).rows : [];
        return { control_revision: gate.revision, instance: instance ? { instance_id: instance.id, status: instance.status, revision: instance.revision, created_at: instance.created_at.toISOString() } : null,
          round: setup ? { round_id: setup.id, kind: 1, state: setup.state, duration_ms: Number(setup.duration_ms), configuration_revision: setup.configuration_revision,
            teams: roster, can_start: false as const } : null };
      }, "SHARED");
    },
    async teams(cookie: unknown, afterId?: string) {
      try { if (afterId) uuid(afterId); } catch { throw new AccessError("INVALID_CONTEXT"); }
      await readBudget(cookie);
      return accessTransaction(pool, clock, async (client) => {
        await principal(client, cookie, await decisionTime(client, clock));
        const rows = await client.query<Team>(`SELECT ${teamProjection} FROM teams t WHERE ($1::uuid IS NULL OR t.id>$1) ORDER BY t.id LIMIT 51`, [afterId ?? null]);
        const items = rows.rows.slice(0, 50);
        return { items, next_after: rows.rows.length > 50 ? items.at(-1)!.team_id : null };
      }, "SHARED");
    },
    async outcome(cookie: unknown, action: ArenaSetupCommand["action"], roundId: string | null, key: string) {
      try { uuid(key); if (roundId) uuid(roundId); } catch { throw new AccessError("INVALID_CONTEXT"); }
      if (!["CREATE", "CONFIGURE"].includes(action) || (action === "CREATE") !== (roundId === null)) throw new AccessError("INVALID_CONTEXT");
      await readBudget(cookie);
      return accessTransaction(pool, clock, async (client) => {
        const actor = await principal(client, cookie, await decisionTime(client, clock), true);
        const row = await first<Receipt>(client, `SELECT * FROM arena_setup_outcomes WHERE actor_id=$1 AND action=$2
          AND round_id IS NOT DISTINCT FROM $3::uuid AND request_key=$4`, [actor.staff_id, action, roundId, key]);
        return { status: row ? "OBSERVED" as const : "NOT_OBSERVED" as const, outcome: row ? receiptView(row) : null };
      }, "SHARED");
    },
  };
}
