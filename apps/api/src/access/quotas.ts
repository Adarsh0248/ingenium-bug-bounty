import { isIP } from "node:net";
import type { Pool, PoolClient } from "pg";
import { sha256, uuid } from "./credentials.js";
import { AccessError, accessTransaction, decisionTime, first } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

const UNIT = 60000n;
interface Policy { kind: string; key: Buffer; rate: number; burst: number; }
interface Bucket { rate: number; burst: number; credits: string; refilled_at: Date; }

function clientIp(ip: string): string {
  const version = isIP(ip);
  if (!version) throw new AccessError("INVALID_CONTEXT");
  return version === 6 ? new URL(`http://[${ip}]`).hostname : ip;
}

export function refill(credits: bigint, elapsedMs: bigint, rate: bigint, burst: bigint): bigint {
  const capacity = burst * UNIT;
  if (credits < 0n || credits > capacity || elapsedMs < 0n || rate <= 0n || burst <= 0n) throw new AccessError("QUOTA_UNAVAILABLE");
  const fillTime = (capacity - credits + rate - 1n) / rate;
  const total = credits + (elapsedMs > fillTime ? fillTime : elapsedMs) * rate;
  return total > capacity ? capacity : total;
}

async function debit(client: PoolClient, clock: ClockGuard, now: Date, policies: Policy[]): Promise<{ allowed: boolean; retry: number; capacity: boolean }> {
  const rows: { policy: Policy; credits: bigint; retry: number }[] = [];
  for (const policy of policies.sort((a, b) => a.kind.localeCompare(b.kind) || Buffer.compare(a.key, b.key))) {
    let row = await first<Bucket>(client, "SELECT rate, burst, credits, refilled_at FROM quota_buckets WHERE kind = $1 AND key_hash = $2 FOR UPDATE", [policy.kind, policy.key]);
    if (!row) {
      const count = await first<{ count: number }>(client, "SELECT count(*)::integer AS count FROM quota_buckets");
      if (!count || count.count >= 100000) return { allowed: false, retry: 1, capacity: true };
      await client.query("INSERT INTO quota_buckets (kind,key_hash,rate,burst,credits,refilled_at,seen_at) VALUES ($1,$2,$3,$4,$5,$6,$6)", [policy.kind, policy.key, policy.rate, policy.burst, String(policy.burst * 60000), now]);
      row = { rate: policy.rate, burst: policy.burst, credits: String(policy.burst * 60000), refilled_at: now };
    }
    if (row.rate !== policy.rate || row.burst !== policy.burst) throw new AccessError("QUOTA_UNAVAILABLE");
    if (now < row.refilled_at) { clock.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }
    const credits = refill(BigInt(row.credits), BigInt(now.getTime() - row.refilled_at.getTime()), BigInt(policy.rate), BigInt(policy.burst));
    const retry = credits >= UNIT ? 0 : Math.max(1, Math.ceil(Number((UNIT - credits + BigInt(policy.rate) - 1n) / BigInt(policy.rate)) / 1000));
    rows.push({ policy, credits, retry });
  }
  const retry = Math.max(0, ...rows.map((row) => row.retry));
  for (const row of rows) await client.query("UPDATE quota_buckets SET credits=$3,refilled_at=$4,seen_at=$4 WHERE kind=$1 AND key_hash=$2", [row.policy.kind, row.policy.key, String(row.credits - (retry === 0 ? UNIT : 0n)), now]);
  return { allowed: retry === 0, retry, capacity: false };
}

export async function verificationQuota(pool: Pool, clock: ClockGuard, ip: string, browserId: string, codeVerifier: Buffer): Promise<void> {
  if (codeVerifier.length !== 32) throw new AccessError("INVALID_CONTEXT");
  uuid(browserId);
  const canonicalIp = clientIp(ip);
  const result = await accessTransaction(pool, clock, async (client) => {
    if ((await client.query("SELECT id FROM quota_control WHERE id=1 FOR UPDATE")).rowCount !== 1) throw new AccessError("QUOTA_UNAVAILABLE");
    const now = await decisionTime(client, clock);
    const ingress = await debit(client, clock, now, [{ kind: "AUTH_GLOBAL", key: sha256("AUTH_GLOBAL:v1"), rate: 2000, burst: 400 },
      { kind: "AUTH_IP", key: sha256(canonicalIp), rate: 600, burst: 200 }]);
    if (!ingress.allowed) return ingress;
    return debit(client, clock, now, [{ kind: "AUTH_BROWSER", key: sha256(browserId), rate: 20, burst: 5 },
      { kind: "AUTH_CODE", key: codeVerifier, rate: 10, burst: 4 }]);
  }, "QUOTA");
  if (!result.allowed) throw new AccessError(result.capacity ? "QUOTA_UNAVAILABLE" : "RATE_LIMITED", result.retry);
}

async function sharedQuota(pool: Pool, clock: ClockGuard, policies: Policy[]): Promise<void> {
  const result = await accessTransaction(pool, clock, async (client) => {
    if ((await client.query("SELECT id FROM quota_control WHERE id=1 FOR UPDATE")).rowCount !== 1) throw new AccessError("QUOTA_UNAVAILABLE");
    return debit(client, clock, await decisionTime(client, clock), policies);
  }, "QUOTA");
  if (!result.allowed) throw new AccessError(result.capacity ? "QUOTA_UNAVAILABLE" : "RATE_LIMITED", result.retry);
}

export async function browserHttpQuota(pool: Pool, clock: ClockGuard, ip: string): Promise<void> {
  await sharedQuota(pool, clock, [{ kind: "HTTP_GLOBAL", key: sha256("HTTP_GLOBAL:v1"), rate: 12000, burst: 600 },
    { kind: "HTTP_IP", key: sha256(clientIp(ip)), rate: 6000, burst: 400 }]);
}

export async function memberReadQuota(pool: Pool, clock: ClockGuard, memberId: string): Promise<void> {
  await sharedQuota(pool, clock, [{ kind: "READ_MEMBER", key: sha256(uuid(memberId)), rate: 600, burst: 30 }]);
}

export async function memberCommandQuota(pool: Pool, clock: ClockGuard, memberRoundId: string): Promise<void> {
  await sharedQuota(pool, clock, [{ kind: "MEMBER_COMMAND", key: sha256(uuid(memberRoundId)), rate: 60, burst: 6 }]);
}

export async function staffQuota(pool: Pool, clock: ClockGuard, id: string, kind: "READ_STAFF" | "STAFF_CONFIRM" | "STAFF_COMMAND"): Promise<void> {
  const [rate, burst] = kind === "READ_STAFF" ? [600, 30] : kind === "STAFF_CONFIRM" ? [10, 3] : [120, 10];
  await sharedQuota(pool, clock, [{ kind, key: sha256(uuid(id)), rate: rate!, burst: burst! }]);
}
