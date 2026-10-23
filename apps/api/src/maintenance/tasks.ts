import type { Pool } from "pg";
import { refill } from "../access/quotas.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
} from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { judgeTransaction } from "../content/judge-transaction.js";

export function maintenanceTasks(pool: Pool, clock: ClockGuard) {
  return {
    async verifiers() {
      return judgeTransaction(pool, clock, async (client) => {
        await decisionTime(client, clock);
        return (
          await client.query<{ count: number }>(
            "SELECT maintain_payload_retention('SECRETS') AS count",
          )
        ).rows[0]!.count;
      });
    },
    async payloads() {
      return judgeTransaction(pool, clock, async (client) => {
        await decisionTime(client, clock);
        return (
          await client.query<{ count: number }>(
            "SELECT maintain_payload_retention('PAYLOADS') AS count",
          )
        ).rows[0]!.count;
      });
    },
    async rounds() {
      const rounds = await accessTransaction(
        pool,
        clock,
        async (client) =>
          (
            await client.query<{ id: string }>(`
        SELECT r.id FROM rounds r WHERE
          (r.state IN ('RUNNING','PAUSED','CLOSING','CANCELLING') AND EXISTS(SELECT 1 FROM arena_control a WHERE a.id=1 AND a.current_instance_id=r.arena_instance_id))
          OR EXISTS(SELECT 1 FROM participant_judging p WHERE p.round_id=r.id AND p.lane='SAMPLE' AND p.completed_at IS NULL AND p.status<>'CANCELLED'
            AND p.created_at<=clock_timestamp()-interval '120 seconds')
        ORDER BY CASE WHEN r.state IN ('RUNNING','PAUSED','CLOSING','CANCELLING') THEN 0 ELSE 1 END,r.id LIMIT 10`)
          ).rows,
        "SHARED",
      );
      for (const round of rounds)
        await judgeTransaction(pool, clock, async (client) => {
          await client.query("SELECT * FROM lock_arena_control(true)");
          const locked = (
            await client.query<{ id: string }>(
              `SELECT r.id FROM rounds r CROSS JOIN arena_control a
            WHERE a.id=1 AND (r.id=$1 OR r.arena_instance_id=a.current_instance_id) ORDER BY r.id FOR UPDATE OF r`,
              [round.id],
            )
          ).rows;
          await decisionTime(
            client,
            clock,
            locked.map((r) => r.id),
          );
          await client.query("SELECT maintain_competition_round($1)", [
            round.id,
          ]);
        });
    },
    async validation() {
      await judgeTransaction(pool, clock, async (client) => {
        await client.query("SELECT * FROM lock_validation_judge()");
        await decisionTime(client, clock);
        await client.query("SELECT expire_validation_run()");
      });
    },
    async deliveries() {
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const now = await decisionTime(client, clock);
          // Purge only unusable encrypted handoffs, never the session, slot or canonical receipt.
          const participant = await client.query(
            `WITH expired AS (
          SELECT d.flow_id FROM session_deliveries d JOIN participant_sessions s ON s.id=d.session_id
            JOIN entry_flows f ON f.id=d.flow_id JOIN access_credentials c ON c.id=s.credential_id
          WHERE d.ciphertext IS NOT NULL AND (d.expires_at<=$1 OR s.revoked_at IS NOT NULL OR c.revoked_at IS NOT NULL OR f.state NOT IN ('OPEN','ACTIVATED'))
          ORDER BY d.expires_at,d.flow_id LIMIT 200
        ) UPDATE session_deliveries SET ciphertext=NULL,purged_at=$1 WHERE flow_id IN(SELECT flow_id FROM expired)`,
            [now],
          );
          const staff = await client.query(
            `WITH expired AS (
          SELECT d.flow_id FROM staff_session_deliveries d JOIN staff_sessions s ON s.id=d.session_id
            JOIN staff_entry_flows f ON f.id=d.flow_id JOIN access_credentials c ON c.id=s.credential_id
          WHERE d.ciphertext IS NOT NULL AND (d.expires_at<=$1 OR s.revoked_at IS NOT NULL OR c.revoked_at IS NOT NULL OR f.state NOT IN ('OPEN','ACTIVATED'))
          ORDER BY d.expires_at,d.flow_id LIMIT 200
        ) UPDATE staff_session_deliveries SET ciphertext=NULL,purged_at=$1 WHERE flow_id IN(SELECT flow_id FROM expired)`,
            [now],
          );
          const replacement = await client.query(
            `WITH expired AS (
          SELECT r.flow_id FROM replacement_requests r JOIN entry_flows f ON f.id=r.flow_id JOIN access_credentials c ON c.id=f.credential_id
          WHERE r.proof_ciphertext IS NOT NULL AND (f.expires_at<=$1 OR c.revoked_at IS NOT NULL OR f.state NOT IN ('OPEN','ACTIVATED') OR r.state NOT IN ('PENDING','APPROVED','ACTIVATED'))
          ORDER BY f.expires_at,r.flow_id LIMIT 200
        ) UPDATE replacement_requests SET proof_ciphertext=NULL,proof_purged_at=$1 WHERE flow_id IN(SELECT flow_id FROM expired)`,
            [now],
          );
          return (
            (participant.rowCount ?? 0) +
            (staff.rowCount ?? 0) +
            (replacement.rowCount ?? 0)
          );
        },
        "EXCLUSIVE",
      );
    },
    async quotas() {
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          if (
            (
              await client.query(
                "SELECT id FROM quota_control WHERE id=1 FOR UPDATE",
              )
            ).rowCount !== 1
          )
            throw new AccessError("QUOTA_UNAVAILABLE");
          const now = await decisionTime(client, clock);
          const rows = (
            await client.query<{
              kind: string;
              key_hash: Buffer;
              rate: number;
              burst: number;
              credits: string;
              refilled_at: Date;
            }>(
              `
          SELECT kind,key_hash,rate,burst,credits,refilled_at FROM quota_buckets
          WHERE seen_at<=$1::timestamptz-interval '15 minutes'
            AND burst::numeric*60000-credits<=floor(extract(epoch FROM ($1::timestamptz-refilled_at))*1000)*rate
          ORDER BY kind,key_hash LIMIT 200 FOR UPDATE`,
              [now],
            )
          ).rows;
          const full = rows.filter(
            (row) =>
              refill(
                BigInt(row.credits),
                BigInt(now.getTime() - row.refilled_at.getTime()),
                BigInt(row.rate),
                BigInt(row.burst),
              ) ===
              BigInt(row.burst) * 60000n,
          );
          return (
            (
              await client.query(
                `DELETE FROM quota_buckets WHERE (kind,key_hash) IN
          (SELECT kind,decode(key,'hex') FROM jsonb_to_recordset($1::jsonb) AS x(kind text,key text))`,
                [
                  JSON.stringify(
                    full.map((row) => ({
                      kind: row.kind,
                      key: row.key_hash.toString("hex"),
                    })),
                  ),
                ],
              )
            ).rowCount ?? 0
          );
        },
        "QUOTA",
      );
    },
  };
}
