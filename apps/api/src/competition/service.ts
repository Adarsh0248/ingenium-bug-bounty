import type { Pool, PoolClient } from "pg";
import { canonicalCode, parseProof, sha256, uuid } from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { createStaffService, confirmStaffCode, staffOutcomeCapacity } from "../access/staff-service.js";
import { sessionRow, sessionValid, lockedRounds } from "../access/entry-service.js";
import { memberCommandQuota, memberReadQuota, staffQuota } from "../access/quotas.js";
import { AccessError, accessTransaction, decisionTime, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { boundedStaffText, staffRevision } from "../access/staff-management.js";
import { createDrawCipher, createDrawPlan, drawCommitment } from "./policy.js";
import { judgingFeedback } from "./feedback.js";
import { createStaffJudgingService } from "./staff-judging.js";
import type { FinalResults } from "./results.js";

export const STAFF_ACTIONS = ["CONFIGURE", "READY", "START", "PAUSE", "RESUME", "CLOSE", "FINALISE", "QUALIFY", "SETUP_R2", "DISCARD", "CANCEL_ROUND", "FINISH_CANCEL"] as const;
export interface CompetitionCommand {
  action: typeof STAFF_ACTIONS[number]; roundId: string; requestKey: string; expectedRevision: string; reason: string; payload: Record<string, unknown>; ownCode?: string;
}
export interface CompetitionDependencies {
  drawCipher: ReturnType<typeof createDrawCipher>;
  // This is a real readiness dependency, never a browser option or a synthetic production default.
  assertReady(signal: AbortSignal): Promise<void>;
}
interface Receipt { outcome_id: string; round_id: string; request_key: string; action: string; recorded_at: string; result: Record<string, unknown>; }
function receiptView(row: Receipt): Receipt {
  return { ...row, recorded_at: new Date(row.recorded_at).toISOString(), result: { ...row.result,
    ...(typeof row.result.received_at === "string" ? { received_at: new Date(row.result.received_at).toISOString() } : {}) } };
}
function exact(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...fields].sort().join()) throw new AccessError("INVALID_CONTEXT");
}
function identifiers(value: unknown, limit: number) {
  if (!Array.isArray(value) || value.length < 1 || value.length > limit) throw new AccessError("INVALID_CONTEXT");
  const ids = value.map(uuid); if (new Set(ids).size !== ids.length) throw new AccessError("INVALID_CONTEXT"); return ids;
}
function staffPayload(input: CompetitionCommand) {
  const p = input.payload;
  if (input.action === "CANCEL_ROUND") {
    exact(p, ["arena_id", "confirmed_round_id", "incident_ref"]);
    if (uuid(p.confirmed_round_id) !== input.roundId || typeof p.incident_ref !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(p.incident_ref)) throw new AccessError("INVALID_CONTEXT");
    return { arena_id: uuid(p.arena_id), confirmed_round_id: input.roundId, incident_ref: p.incident_ref };
  }
  if (input.action === "FINISH_CANCEL") {
    exact(p, ["arena_id", "cancellation_id"]);
    return { arena_id: uuid(p.arena_id), cancellation_id: uuid(p.cancellation_id) };
  }
  if (input.action === "CONFIGURE") { exact(p, ["snapshots"]); return { snapshots: identifiers(p.snapshots, 100) }; }
  if (input.action === "SETUP_R2") {
    exact(p, ["teams", "duration_ms"]);
    if (!Number.isSafeInteger(p.duration_ms) || (p.duration_ms as number) < 1 || (p.duration_ms as number) > 18000000) throw new AccessError("INVALID_CONTEXT");
    return { teams: identifiers(p.teams, 50).sort(), duration_ms: p.duration_ms };
  }
  if (input.action === "PAUSE" || input.action === "RESUME") {
    exact(p, ["scope", "target"]);
    if (!["GLOBAL", "TEAM", "MEMBER"].includes(p.scope as string) || ((p.scope === "GLOBAL") !== (p.target === null))) throw new AccessError("INVALID_CONTEXT");
    return { scope: p.scope, target: p.target === null ? null : uuid(p.target) };
  }
  exact(p, []); return {};
}
export function createCompetitionService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery, dependencies?: CompetitionDependencies) {
  const staff = createStaffService(pool, clock, delivery);
  const judgingMonitor = createStaffJudgingService(pool, clock, delivery);
  async function readBudget(cookie: unknown, audience: "STAFF" | "PARTICIPANT") {
    if (audience === "STAFF") { const actor = await staff.inspect(cookie); await staffQuota(pool, clock, actor.staff_id, "READ_STAFF"); }
    else {
      const proof = parseProof(cookie); if (!proof) throw new AccessError("INVALID_SESSION");
      const row = await accessTransaction(pool, clock, async client => {
        const row = await sessionRow(client, proof.id);
        if (!row || !await sessionValid(client, row, proof.verifier, await decisionTime(client, clock), clock)) throw new AccessError("INVALID_SESSION");
        return row;
      }, "SHARED");
      await memberReadQuota(pool, clock, row.member_id);
    }
  }
  async function participant(client: PoolClient, cookie: unknown, roundId: string, now: Date) {
    const proof = parseProof(cookie);
    const row = proof ? await sessionRow(client, proof.id) : undefined;
    if (!proof || !row || row.round_id !== roundId || !await sessionValid(client, row, proof.verifier, now, clock)) throw new AccessError("INVALID_SESSION");
    return row;
  }
  async function memberWrite(cookie: unknown, roundId: string, key: string, action: "HINT" | "SUBMIT" | "RUN", p: Record<string, unknown>) {
    uuid(roundId); uuid(key); uuid(p.bounty_id);
    const proof = parseProof(cookie);
    if (!proof) throw new AccessError("INVALID_SESSION");
    const identity = await accessTransaction(pool, clock, async client => participant(client, cookie, roundId, await decisionTime(client, clock)), "SHARED");
    await memberCommandQuota(pool, clock, identity.member_round_id);
    if (action === "SUBMIT" || action === "RUN") {
      const known = await accessTransaction(pool, clock, async client => {
        await participant(client, cookie, roundId, await decisionTime(client, clock));
        return first(client, "SELECT id FROM competition_outcomes WHERE round_id=$1 AND actor_id=$2 AND request_key=$3", [roundId, identity.member_round_id, key]);
      }, "SHARED");
      if (!known) {
        if (!dependencies) throw new AccessError("JUDGE_UNAVAILABLE");
        await dependencies.assertReady(AbortSignal.timeout(10000));
      }
    }
    return accessTransaction(pool, clock, async client => {
      await lockedRounds(client, [roundId]);
      const now = await decisionTime(client, clock, [roundId]), actor = await participant(client, cookie, roundId, now);
      const row = await first<{ value: Receipt }>(client, "SELECT competition_participant_command($1,$2,$3,$4,$5::jsonb) AS value", [actor.id, roundId, key, action, JSON.stringify(p)]);
      if (!row) throw new AccessError("SECURITY_UNAVAILABLE"); return receiptView(row.value);
    }, "SHARED");
  }
  return {
    async controlRoom(cookie: unknown, arenaId?: string) {
      if (arenaId !== undefined) uuid(arenaId);
      await readBudget(cookie, "STAFF");
      return accessTransaction(pool, clock, async client => {
        const gate = await first<{ revision: string; current_instance_id: string | null }>(client, "SELECT * FROM lock_arena_control(false)");
        if (!gate) throw new AccessError("SECURITY_UNAVAILABLE");
        const target = arenaId ?? gate.current_instance_id;
        const heads = (await client.query<{ round_id: string }>("SELECT id AS round_id FROM rounds WHERE arena_instance_id=$1 ORDER BY id", [target])).rows;
        await lockedRounds(client, heads.map(r => r.round_id), true);
        const rounds = (await client.query<{ round_id: string; kind: number; state: string; duration_ms: string; revision: string; configuration_revision: string }>(
          "SELECT id AS round_id,kind,state,duration_ms,revision,configuration_revision FROM rounds WHERE arena_instance_id=$1 ORDER BY kind", [target])).rows;
        const now = await decisionTime(client, clock, rounds.map(r => r.round_id));
        const actor = await staff.authorize(client, cookie, now);
        const instance = target ? await first<{ instance_id: string; status: string }>(client, "SELECT id AS instance_id,status FROM arena_instances WHERE id=$1", [target]) : null;
        if (target && !instance) throw new AccessError("ACCESS_UNAVAILABLE");
        const views = [];
        for (const round of rounds) {
          const selected = (await client.query(`SELECT s.id AS snapshot_id,s.definition_id,s.title,s.difficulty,s.base_bounty,s.round_type
            FROM bounties b JOIN validation_snapshots s ON s.id=b.snapshot_id WHERE b.round_id=$1 ORDER BY b.position`, [round.round_id])).rows;
          const teams = (await client.query(`SELECT t.id AS team_id,COALESCE(tr.display_name,t.display_name) AS team_name,cr.team_round_id,
            (SELECT jsonb_agg(jsonb_build_object('member_id',m.id,'member_name',COALESCE(mr.display_name,m.display_name),'position',m.position,
              'member_round_id',mr.id,'language',mr.language) ORDER BY m.position) FROM team_members m
              LEFT JOIN member_rounds mr ON mr.member_id=m.id AND mr.team_round_id=cr.team_round_id WHERE m.team_id=t.id) AS members
            FROM teams t LEFT JOIN competition_rosters cr ON cr.team_id=t.id AND cr.round_id=$1
            LEFT JOIN team_rounds tr ON tr.id=cr.team_round_id
            WHERE ($2=1 AND EXISTS(SELECT 1 FROM round_draft_teams d WHERE d.round_id=$1 AND d.team_id=t.id))
              OR ($2=2 AND cr.team_id IS NOT NULL) ORDER BY t.id LIMIT 100`, [round.round_id, round.kind])).rows;
          views.push({ ...round, selected, teams });
        }
        const qualification = await first<{ selected: string[] }>(client, `SELECT COALESCE(jsonb_agg(cr.team_id ORDER BY cr.team_id),'[]') AS selected
          FROM qualification_decisions q JOIN round_results rr ON rr.id=q.result_id JOIN rounds r ON r.id=rr.round_id
          JOIN competition_rosters cr ON cr.round_id=r.id AND q.selected @> jsonb_build_array(cr.team_round_id::text)
          WHERE r.arena_instance_id=$1 AND r.kind=1 HAVING count(*)>0`, [target]);
        return { server_time: now.toISOString(), session_id: actor.id, role: actor.role, control_revision: gate.revision,
          instance: instance ? { ...instance, current: target === gate.current_instance_id } : null,
          rounds: views, qualified_team_ids: qualification?.selected ?? null };
      }, "SHARED");
    },
    async published(cookie: unknown, kind: number, after?: string) {
      if (kind !== 1 && kind !== 2) throw new AccessError("INVALID_CONTEXT");
      if (after !== undefined) uuid(after);
      await readBudget(cookie, "STAFF");
      return accessTransaction(pool, clock, async client => {
        await staff.authorize(client, cookie, await decisionTime(client, clock));
        const rows = (await client.query(`SELECT s.id AS snapshot_id,s.definition_id,s.title,s.difficulty,s.base_bounty,s.round_type
          FROM competition_publications p JOIN validation_snapshots s ON s.id=p.snapshot_id
          WHERE s.round_type=$1 AND ($2::uuid IS NULL OR s.id>$2) ORDER BY s.id LIMIT 51`, [kind, after ?? null])).rows;
        const items = rows.slice(0, 50);
        return { items, next_after: rows.length > 50 ? items.at(-1)!.snapshot_id : null };
      }, "SHARED");
    },
    async command(cookie: unknown, input: CompetitionCommand) {
      uuid(input.roundId); uuid(input.requestKey); staffRevision(input.expectedRevision); boundedStaffText(input.reason, 1024);
      if (!(STAFF_ACTIONS as readonly string[]).includes(input.action)) throw new AccessError("INVALID_CONTEXT");
      let p: Record<string, unknown>; try { p = staffPayload(input); } catch { throw new AccessError("INVALID_CONTEXT"); }
      const initial = await staff.inspect(cookie); if (initial.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
      await staffQuota(pool, clock, initial.staff_id, "STAFF_COMMAND");
      const cancelling = ["CANCEL_ROUND", "FINISH_CANCEL"].includes(input.action);
      const sensitive = ["START", "PAUSE", "RESUME", "CLOSE", "FINALISE", "QUALIFY", "DISCARD", "CANCEL_ROUND", "FINISH_CANCEL"].includes(input.action);
      if (sensitive) await staffQuota(pool, clock, initial.staff_id, "STAFF_CONFIRM");
      const known = await accessTransaction(pool, clock, async client => {
        await staff.authorize(client, cookie, await decisionTime(client, clock));
        return first(client, "SELECT id FROM competition_outcomes WHERE round_id=$1 AND actor_id=$2 AND request_key=$3", [input.roundId, initial.staff_id, input.requestKey]);
      }, "SHARED");
      if (input.action === "START" && !known) {
        if (!dependencies) throw new AccessError("JUDGE_UNAVAILABLE");
        await dependencies.assertReady(AbortSignal.timeout(10000));
      }
      return accessTransaction(pool, clock, async client => {
        await client.query("SELECT * FROM lock_arena_control(true)"); await lockedRounds(client, [input.roundId]);
        const now = await decisionTime(client, clock, [input.roundId]), actor = await staff.authorize(client, cookie, now);
        if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
        if (sensitive) await confirmStaffCode(client, actor, input.ownCode);
        if (input.action === "CONFIGURE") {
          const round = await first<{ kind: number }>(client, "SELECT kind FROM rounds WHERE id=$1", [input.roundId]);
          if ((p.snapshots as string[]).length > (round?.kind === 2 ? 100 : 50)) throw new AccessError("INVALID_CONTEXT");
        }
        // Recover the original generated draw payload before generating any new randomness.
        const prior = await first<{ action: string; fingerprint: Buffer; result: unknown }>(client,
          "SELECT action,fingerprint,result FROM competition_outcomes WHERE round_id=$1 AND actor_id=$2 AND request_key=$3", [input.roundId, actor.staff_id, input.requestKey]);
        if (cancelling && !prior) await staffOutcomeCapacity(client);
        if (input.action === "START") {
          const r = await first<{ kind: number }>(client, "SELECT kind FROM rounds WHERE id=$1", [input.roundId]);
          if (r?.kind === 1) {
            if (!dependencies) throw new AccessError("JUDGE_UNAVAILABLE");
            const roster = (await client.query<{ team_round_id: string }>("SELECT team_round_id FROM competition_rosters WHERE round_id=$1 ORDER BY team_round_id", [input.roundId])).rows.map(r => r.team_round_id);
            const saved = await first<{ draw_ciphertext: string | null; draw_commitment: string | null }>(client, "SELECT draw_ciphertext,draw_commitment FROM competition_configs WHERE round_id=$1", [input.roundId]);
            if (prior && saved?.draw_ciphertext && saved.draw_commitment) p = { draw_ciphertext: saved.draw_ciphertext, draw_commitment: saved.draw_commitment };
            else { const plan = createDrawPlan(input.roundId, roster); p = { draw_ciphertext: dependencies.drawCipher.seal(plan), draw_commitment: drawCommitment(plan) }; }
          }
        }
        if (input.action === "QUALIFY") {
          if (!dependencies) throw new AccessError("DRAW_KEY_UNAVAILABLE");
          const config = await first<{ draw_ciphertext: string; draw_commitment: string }>(client, "SELECT draw_ciphertext,draw_commitment FROM competition_configs WHERE round_id=$1", [input.roundId]);
          const roster = (await client.query<{ team_round_id: string }>("SELECT team_round_id FROM competition_rosters WHERE round_id=$1 ORDER BY team_round_id", [input.roundId])).rows.map(r => r.team_round_id);
          if (!config) throw new AccessError("ROUND_UNAVAILABLE");
          p = { reveal: dependencies.drawCipher.open(config.draw_ciphertext, input.roundId, roster, config.draw_commitment) };
        }
        const row = await first<{ value: Receipt }>(client, cancelling ? "SELECT competition_cancel_command($1,$2,$3,$4,$5,$6::jsonb,$7,$8) AS value" : "SELECT competition_staff_command($1,$2,$3,$4,$5,$6::jsonb,$7,$8) AS value",
          [actor.id, input.roundId, input.requestKey, input.expectedRevision, input.action, JSON.stringify(p), input.reason, sensitive ? sha256(canonicalCode(input.ownCode)) : null]);
        if (!row) throw new AccessError("SECURITY_UNAVAILABLE"); return receiptView(row.value);
      }, "EXCLUSIVE");
    },
    async cancellation(cookie: unknown, roundId: string) {
      uuid(roundId); await readBudget(cookie, "STAFF");
      return accessTransaction(pool, clock, async client => {
        const gate = await first<{ current_instance_id: string | null }>(client, "SELECT * FROM lock_arena_control(false)");
        await lockedRounds(client, [roundId], true);
        const actor = await staff.authorize(client, cookie, await decisionTime(client, clock, [roundId]));
        if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
        const r = await first<{ arena_instance_id: string; state: string; revision: string }>(client, "SELECT arena_instance_id,state,revision FROM rounds WHERE id=$1", [roundId]);
        if (!r) throw new AccessError("ROUND_UNAVAILABLE");
        await client.query("SELECT cancellation_progress($1)", [roundId]);
        const record = await first<{ id: string; incident_ref: string; reason: string; started_at: Date; actor_name: string; finished_at: Date | null }>(client,
          `SELECT c.id,c.incident_ref,o.reason,o.recorded_at AS started_at,i.display_name AS actor_name,f.recorded_at AS finished_at
          FROM round_cancellations c JOIN competition_outcomes o ON o.id=c.source_id JOIN staff_identities i ON i.id=o.actor_id
          LEFT JOIN cancellation_finishes z ON z.cancellation_id=c.id LEFT JOIN competition_outcomes f ON f.id=z.source_id WHERE c.round_id=$1`, [roundId]);
        const counts = await first<{ held: number; cancelled: number; pending: number }>(client, `SELECT (SELECT count(*)::integer FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id
          JOIN participant_judging p ON p.id=j.parent_id JOIN rounds x ON x.id=p.round_id WHERE x.arena_instance_id=$2 AND a.released_at IS NULL) AS held,
          (SELECT count(*)::integer FROM participant_judging WHERE round_id=$1 AND status='CANCELLED') AS cancelled,
          (SELECT count(*)::integer FROM participant_judging p WHERE round_id=$1 AND (p.status NOT IN ('COMPLETED','CANCELLED') OR EXISTS(SELECT 1 FROM participant_jobs j WHERE j.parent_id=p.id AND j.status NOT IN ('COMPLETED','CANCELLED')))) AS pending`, [roundId, r.arena_instance_id]);
        return { arena_id: r.arena_instance_id, round_id: roundId, revision: r.revision, state: r.state, current: gate?.current_instance_id === r.arena_instance_id,
          held_executions: counts!.held, cancelled_work: counts!.cancelled, pending_work: counts!.pending, cancellation: record ? { cancellation_id: record.id, incident_ref: record.incident_ref,
            reason: record.reason, actor_name: record.actor_name, started_at: record.started_at.toISOString(), finished_at: record.finished_at?.toISOString() ?? null } : null };
      }, "SHARED");
    },
    async buyHint(cookie: unknown, roundId: string, bountyId: string, level: number, requestKey: string) {
      if (!Number.isInteger(level) || level < 1 || level > 3) throw new AccessError("INVALID_CONTEXT");
      return memberWrite(cookie, roundId, requestKey, "HINT", { bounty_id: uuid(bountyId), level });
    },
    async retryJob(cookie: unknown, roundId: string, jobId: string, requestKey: string, reason: string, ownCode: string) {
      uuid(roundId); uuid(jobId); uuid(requestKey); boundedStaffText(reason, 1024);
      const initial = await staff.inspect(cookie); if (initial.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
      await staffQuota(pool, clock, initial.staff_id, "STAFF_COMMAND"); await staffQuota(pool, clock, initial.staff_id, "STAFF_CONFIRM");
      return accessTransaction(pool, clock, async client => {
        await lockedRounds(client, [roundId]);
        const actor = await staff.authorize(client, cookie, await decisionTime(client, clock, [roundId]));
        if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
        await confirmStaffCode(client, actor, ownCode);
        if (!await first(client, "SELECT j.id FROM participant_jobs j JOIN participant_judging p ON p.id=j.parent_id WHERE j.id=$1 AND p.round_id=$2", [jobId, roundId])) throw new AccessError("ACCESS_UNAVAILABLE");
        const row = await first<{ value: Receipt }>(client, "SELECT participant_retry($1,$2,$3,$4,$5) value", [actor.id, jobId, requestKey, reason, sha256(canonicalCode(ownCode))]);
        if (!row) throw new AccessError("SECURITY_UNAVAILABLE"); return receiptView(row.value);
      }, "EXCLUSIVE");
    },
    async submit(cookie: unknown, roundId: string, bountyId: string, source: string, requestKey: string) {
      if (typeof source !== "string" || !source.isWellFormed() || !source.trim() || Buffer.byteLength(source) > 131072) throw new AccessError("INVALID_CONTEXT");
      return memberWrite(cookie, roundId, requestKey, "SUBMIT", { bounty_id: uuid(bountyId), source_b64: Buffer.from(source).toString("base64") });
    },
    async run(cookie: unknown, roundId: string, bountyId: string, source: string, requestKey: string) {
      if (typeof source !== "string" || !source.isWellFormed() || !source.trim() || Buffer.byteLength(source) > 131072) throw new AccessError("INVALID_CONTEXT");
      return memberWrite(cookie, roundId, requestKey, "RUN", { bounty_id: uuid(bountyId), source_b64: Buffer.from(source).toString("base64") });
    },
    async judging(cookie: unknown, roundId: string, parentId: string) {
      uuid(roundId); uuid(parentId); await readBudget(cookie, "PARTICIPANT");
      return accessTransaction(pool, clock, async client => {
        await lockedRounds(client, [roundId]);
        const actor = await participant(client, cookie, roundId, await decisionTime(client, clock, [roundId]));
        await client.query("SELECT participant_expire($1)", [roundId]);
        return judgingFeedback(client, roundId, actor.member_round_id, parentId);
      }, "SHARED");
    },
    judgeQueue: judgingMonitor.queue,
    judgeDetail: judgingMonitor.detail,
    recoveryAudit: judgingMonitor.audit,
    async results(cookie: unknown, roundId: string): Promise<FinalResults> {
      uuid(roundId); await readBudget(cookie, "STAFF");
      return accessTransaction(pool, clock, async client => {
        await lockedRounds(client, [roundId], true);
        await staff.authorize(client, cookie, await decisionTime(client, clock, [roundId]));
        const row = await first<{ arena_id: string; round_kind: 1 | 2; result_id: string; result_version: number; finalised_at: Date;
          standings: Omit<FinalResults["standings"][number], "qualified">[]; selected: string[] | null }>(client,
          `SELECT r.arena_instance_id AS arena_id,r.kind AS round_kind,f.id AS result_id,f.version+(SELECT count(*)::integer FROM score_adjustments WHERE round_id=r.id) AS result_version,f.finalised_at,
            competition_display_standings(r.id) AS standings,q.selected
          FROM rounds r JOIN round_results f ON f.round_id=r.id LEFT JOIN qualification_decisions q ON q.result_id=f.id
          WHERE r.id=$1 AND r.state='CLOSED'`, [roundId]);
        if (!row) throw new AccessError("ACCESS_UNAVAILABLE");
        const standings = row.standings.map(s => ({ team_round_id: s.team_round_id, team_id: s.team_id, team_name: s.team_name,
          rank: s.rank, points: s.points, solve_time_ms: s.solve_time_ms, penalty_ms: s.penalty_ms, effective_time_ms: s.effective_time_ms, difficulties: s.difficulties }));
        const value: FinalResults = {
          format_version: 1, state: "FINAL", arena_id: row.arena_id, round_id: roundId, round_kind: row.round_kind,
          result_id: row.result_id, result_version: row.result_version, finalised_at: row.finalised_at.toISOString(),
          // Hash only the public projection, not the private snapshot's wallet fields.
          standings_sha256: sha256(JSON.stringify(standings)).toString("hex"),
          qualification_status: row.round_kind === 2 ? "NOT_APPLICABLE" : row.selected === null ? "PENDING" : "LOCKED",
          standings: standings.map(s => ({ ...s, qualified: row.round_kind === 1 && row.selected !== null ? row.selected.includes(s.team_round_id) : null })),
        };
        if (value.standings.length > 100 || Buffer.byteLength(JSON.stringify(value)) > 262144) throw new AccessError("SECURITY_UNAVAILABLE");
        return value;
      }, "SHARED");
    },
    async standings(cookie: unknown, roundId: string, audience: "STAFF" | "PARTICIPANT") {
      uuid(roundId);
      await readBudget(cookie, audience);
      return accessTransaction(pool, clock, async client => {
        await lockedRounds(client, [roundId], true); const now = await decisionTime(client, clock, [roundId]);
        if (audience === "STAFF") await staff.authorize(client, cookie, now);
        else await participant(client, cookie, roundId, now);
        const row = await first<{ standings: unknown; final: boolean; cancelled: boolean }>(client, `SELECT competition_display_standings($1) AS standings,
          EXISTS(SELECT 1 FROM round_results WHERE round_id=$1) AS final,(SELECT state IN ('CANCELLING','CANCELLED') FROM rounds WHERE id=$1) AS cancelled`, [roundId]);
        if (!row || !Array.isArray(row.standings)) throw new AccessError("SECURITY_UNAVAILABLE");
        return { ...row, standings: row.standings.map(({ wallet: _privateWallet, ...standing }: { wallet: number }) => ({ ...standing, ...(row.cancelled ? { rank: null } : {}) })) };
      }, "SHARED");
    },
    async state(cookie: unknown, roundId: string, audience: "STAFF" | "PARTICIPANT") {
      uuid(roundId); await readBudget(cookie, audience);
      return accessTransaction(pool, clock, async client => {
        await lockedRounds(client, [roundId], true); const now = await decisionTime(client, clock, [roundId]);
        const actor = audience === "STAFF" ? null : await participant(client, cookie, roundId, now);
        if (audience === "STAFF") await staff.authorize(client, cookie, now);
        const round = await first(client, `SELECT r.id AS round_id,r.arena_instance_id,r.kind,r.state,r.duration_ms,r.started_at,r.closes_at,r.revision,
          c.draw_commitment,c.draw_reveal,EXISTS(SELECT 1 FROM round_results WHERE round_id=r.id) AS final FROM rounds r LEFT JOIN competition_configs c ON c.round_id=r.id WHERE r.id=$1`, [roundId]);
        const teamRound = actor ? await first<{ team_round_id: string }>(client, "SELECT team_round_id FROM member_rounds WHERE id=$1", [actor.member_round_id]) : null;
        const bounties = (await client.query(`SELECT b.id AS bounty_id,s.title,s.difficulty,s.base_bounty,s.manifest_text::jsonb#>>'{version,category}' AS category,
      EXISTS(SELECT 1 FROM workbench_activities w JOIN member_rounds m ON m.id=w.member_round_id WHERE w.bounty_id=b.id AND m.team_round_id=$2 AND w.request_key IS NOT NULL) AS captured,
          EXISTS(SELECT 1 FROM bounty_awards a WHERE a.bounty_id=b.id AND (r.kind=2 OR a.team_round_id=$2)) AS claimed,
          COALESCE((SELECT max(level) FROM hint_purchases WHERE bounty_id=b.id AND team_round_id=$2),0) AS hint_tier
          FROM bounties b JOIN rounds r ON r.id=b.round_id JOIN validation_snapshots s ON s.id=b.snapshot_id WHERE b.round_id=$1 ORDER BY b.position`, [roundId, teamRound?.team_round_id ?? null])).rows;
        const wallet = teamRound ? await first<{ balance: string }>(client, "SELECT competition_balance($1) AS balance", [teamRound.team_round_id]) : null;
        const pauses = (await client.query(`SELECT scope,team_round_id,member_round_id FROM competition_pauses WHERE round_id=$1 AND ended_at IS NULL
          AND ($2::uuid IS NULL OR scope='GLOBAL' OR team_round_id=$2 OR member_round_id IN(SELECT id FROM member_rounds WHERE team_round_id=$2))`, [roundId, teamRound?.team_round_id ?? null])).rows;
        return { round, bounties, pauses, wallet: wallet ? Number(wallet.balance) : null };
      }, "SHARED");
    },
    async hints(cookie: unknown, roundId: string, bountyId: string) {
      uuid(roundId); uuid(bountyId);
      await readBudget(cookie, "PARTICIPANT");
      return accessTransaction(pool, clock, async client => {
        await lockedRounds(client, [roundId], true); const actor = await participant(client, cookie, roundId, await decisionTime(client, clock, [roundId]));
        return (await client.query(`SELECT h.level,h.content,p.recorded_at FROM hint_purchases p JOIN bounties b ON b.id=p.bounty_id
          JOIN validation_snapshot_hints h ON h.snapshot_id=b.snapshot_id AND h.level=p.level JOIN member_rounds m ON m.team_round_id=p.team_round_id
          WHERE m.id=$1 AND b.round_id=$2 AND b.id=$3 ORDER BY h.level`, [actor.member_round_id, roundId, bountyId])).rows;
      }, "SHARED");
    },
    async outcome(cookie: unknown, roundId: string, requestKey: string, audience: "STAFF" | "PARTICIPANT") {
      uuid(roundId); uuid(requestKey); await readBudget(cookie, audience);
      return accessTransaction(pool, clock, async client => {
        await lockedRounds(client, [roundId], true); const now = await decisionTime(client, clock, [roundId]);
        const actor = audience === "STAFF" ? (await staff.authorize(client, cookie, now)).staff_id : (await participant(client, cookie, roundId, now)).member_round_id;
        const row = await first<{ id: string; action: string; recorded_at: Date; result: Record<string, unknown> }>(client,
          "SELECT id,action,recorded_at,result FROM competition_outcomes WHERE round_id=$1 AND actor_id=$2 AND request_key=$3", [roundId, actor, requestKey]);
        return { status: row ? "OBSERVED" : "NOT_OBSERVED", outcome: row ? receiptView({ outcome_id: row.id, round_id: roundId, request_key: requestKey, action: row.action, recorded_at: row.recorded_at.toISOString(), result: row.result }) : null };
      }, "SHARED");
    },
  };
}
