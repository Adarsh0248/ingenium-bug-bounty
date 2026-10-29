import type { Pool, PoolClient } from "pg";
import { uuid } from "../access/credentials.js";
import { memberCommandQuota } from "../access/quotas.js";
import { AccessError, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { createParticipantReads } from "../workbench/scope.js";

export const SHOP_PRICES = { "boundary-probe": 400, "hex-scanner": 750, "overdrive-core": 500, "ghost-scan": 1500,
  "chrono-shield": 2500, "claim-lock": 5000, "black-ice": 15000 } as const;

export async function shopView(client: PoolClient, round: string, team: string, now: Date) {
  const stage = await first<{ kind: number; paused: boolean }>(client,
    "SELECT kind,state='PAUSED' AS paused FROM rounds WHERE id=$1", [round]);
  if (stage?.kind !== 2) return null;
  const time = (await first<{ tick: string }>(client, "SELECT shop_clock($1,$2)::text tick", [round, now]))!;
  const tick = Number(time.tick);
  const rows = (await client.query(`SELECT p.id,p.item_id,p.purchased_at,a.activated_at,a.active_ms::text,a.expires_ms::text,
    coalesce(a.bounty_id,a.target_team_round_id) target_id,a.id activation_id,
    EXISTS(SELECT 1 FROM shop_submission_effects WHERE shield_id=a.id) shield_used
    FROM shop_purchases p LEFT JOIN shop_activations a ON a.purchase_id=p.id WHERE p.team_round_id=$1 ORDER BY p.purchased_at,p.id LIMIT 1024`, [team])).rows;
  const until = (end: unknown) => end !== null && end !== undefined && Number(end) > tick
    ? new Date(now.getTime() + Number(end) - tick).toISOString() : null;
  const ghost = rows.filter(p => p.item_id === "ghost-scan").at(-1);
  const claim = rows.find(p => p.item_id === "claim-lock" && p.activated_at && Number(p.expires_ms) > tick);
  const incoming = await first(client, "SELECT expires_ms::text FROM shop_activations WHERE target_team_round_id=$1 AND item_id='black-ice'", [team]);
  const clear = ghost && until(ghost.expires_ms) ? (await client.query(`SELECT b.id FROM bounties b WHERE b.round_id=$1
    AND NOT EXISTS(SELECT 1 FROM bounty_awards WHERE bounty_id=b.id AND (NOT protected OR team_round_id=$2))
    AND NOT EXISTS(SELECT 1 FROM participant_judging WHERE bounty_id=b.id AND team_round_id<>$2 AND completed_at IS NULL AND status<>'CANCELLED')
    AND NOT EXISTS(SELECT 1 FROM shop_presence p JOIN member_rounds m ON m.id=p.member_round_id
      JOIN participant_sessions s ON s.id=p.session_id JOIN member_session_slots slot ON slot.session_id=s.id
      JOIN access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version
      WHERE p.bounty_id=b.id AND m.team_round_id<>$2 AND p.expires_at>$3 AND s.revoked_at IS NULL AND c.revoked_at IS NULL)
    ORDER BY b.position`, [round, team, now])).rows.map(r => r.id as string) : [];
  const targets = (await client.query(`SELECT t.id,t.display_name name,a.expires_ms::text,a.id IS NOT NULL already_targeted
    FROM team_rounds t LEFT JOIN shop_activations a ON a.target_team_round_id=t.id AND a.item_id='black-ice'
    WHERE t.round_id=$1 AND t.id<>$2 ORDER BY t.id LIMIT 50`, [round, team])).rows;
  return { preview: false, server_time: now.toISOString(), timers_paused: stage.paused,
    wallet: Number((await first(client, "SELECT competition_balance($1) balance", [team]))!.balance),
    purchases: rows.map(p => ({ id: p.id, item_id: p.item_id, target_id: p.target_id ?? null,
      purchased_at: p.purchased_at.toISOString(), activated_at: p.activated_at?.toISOString() ?? null,
      expires_at: p.expires_ms === null ? null : until(p.expires_ms) ?? now.toISOString() })),
    intel: [], ghost_until: until(ghost?.expires_ms), ghost_cooldown_until: ghost ? until(Number(ghost.active_ms) + 120000) : null,
    clear_bounty_ids: clear, claim: claim ? { bounty_id: claim.target_id, expires_at: until(claim.expires_ms)! } : null,
    shield_armed: rows.some(p => p.item_id === "chrono-shield" && p.activated_at && !p.shield_used),
    overdrive: rows.some(p => p.item_id === "overdrive-core"), frozen_until: until(incoming?.expires_ms), incoming_freeze_used: !!incoming,
    targets: targets.map(t => ({ id: t.id, name: t.name, frozen_until: until(t.expires_ms), already_targeted: t.already_targeted })) };
}

export function createShopService(pool: Pool, clock: ClockGuard) {
  const reads = createParticipantReads(pool, clock);
  return {
    async view(cookie: unknown, round: string) {
      return reads.read(cookie, round, async c => {
        if (c.historical) throw new AccessError("WORKBENCH_UNAVAILABLE");
        const view = await shopView(c.client, round, c.teamRoundId, c.now);
        if (!view) throw new AccessError("WORKBENCH_UNAVAILABLE");
        return view;
      });
    },
    async command(cookie: unknown, round: string, key: string, action: "SHOP_PURCHASE" | "SHOP_ACTIVATE", payload: Record<string, unknown>) {
      uuid(round); uuid(key);
      const actor = await reads.principal(cookie);
      await memberCommandQuota(pool, clock, actor.member_round_id);
      return reads.scoped(cookie, round, true, async c => {
        if (c.historical) throw new AccessError("WORKBENCH_UNAVAILABLE");
        const value = (await first<{ value: Record<string, unknown> & {recorded_at:string} }>(c.client, "SELECT shop_command($1,$2,$3,$4,$5::jsonb) value",
          [c.sessionId, round, key, action, JSON.stringify(payload)]))!.value;
        return {...value,recorded_at:new Date(value.recorded_at).toISOString()};
      });
    },
    async outcome(cookie: unknown, round: string, key: string) {
      uuid(key);
      return reads.read(cookie, round, async c => {
        const row = await first(c.client, `SELECT id outcome_id,round_id,action,request_key,recorded_at,result FROM competition_outcomes
          WHERE round_id=$1 AND actor_id=$2 AND request_key=$3 AND action IN ('SHOP_PURCHASE','SHOP_ACTIVATE')`, [round, c.memberRoundId, key]);
        return row ? { ...row, recorded_at: row.recorded_at.toISOString() } : null;
      });
    },
    async intel(cookie: unknown, round: string, bounty: string) {
      uuid(bounty);
      return reads.read(cookie, round, async c => (await first<{ value: unknown }>(c.client,
        "SELECT shop_intelligence($1,$2,$3,$4) value", [c.sessionId, round, bounty, c.now]))!.value);
    },
  };
}
