import { createCipheriv, createDecipheriv, randomBytes, randomInt } from "node:crypto";
import { sha256, uuid } from "../access/credentials.js";

export const COMPETITION_RULES = "ingenium-competition-v1";
export const VERDICTS = ["PASSED", "WRONG_ANSWER", "COMPILATION_ERROR", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "OUTPUT_LIMIT_EXCEEDED"] as const;
export type Verdict = typeof VERDICTS[number];
export function bounty(difficulty: number, multiplier = 1) {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 100) throw new Error("Invalid difficulty.");
  if (![1,5].includes(multiplier)) throw new Error("Invalid reward multiplier.");
  return difficulty * 10 * multiplier;
}
export function hintPrice(round: number, difficulty: number, level: number, baseBounty = bounty(difficulty)) {
  bounty(difficulty);
  if (![1, 2].includes(round) || !Number.isInteger(level) || level < 1 || level > 3) throw new Error("Invalid hint.");
  if (baseBounty !== bounty(difficulty) && !(round === 1 && baseBounty === bounty(difficulty,5))
    && !(round === 2 && Number.isInteger(baseBounty) && baseBounty >= 250 && baseBounty <= 1000 && baseBounty % 10 === 0)) throw new Error("Invalid frozen bounty.");
  return baseBounty / 10 * [1, 3, round === 1 ? 4 : 8][level - 1]!;
}
export function winPoints(round: number, difficulty: number, tier: number, baseBounty = bounty(difficulty)) {
  bounty(difficulty);
  if (![1, 2].includes(round) || !Number.isInteger(tier) || tier < 0 || tier > 3) throw new Error("Invalid tier.");
  if (baseBounty !== bounty(difficulty) && !(round === 1 && baseBounty === bounty(difficulty,5))
    && !(round === 2 && Number.isInteger(baseBounty) && baseBounty >= 250 && baseBounty <= 1000 && baseBounty % 10 === 0)) throw new Error("Invalid frozen bounty.");
  return baseBounty / 10 * (round === 1 ? 10 : [10, 9, 7, 5][tier]!);
}
export interface Standing { team_round_id: string; points: number; effective_time_ms: number; difficulties: number[]; }
export function compareStandings(a: Standing, b: Standing) {
  if (a.points !== b.points) return b.points - a.points;
  if (a.effective_time_ms !== b.effective_time_ms) return a.effective_time_ms - b.effective_time_ms;
  const aa = [...a.difficulties].sort((x, y) => y - x), bb = [...b.difficulties].sort((x, y) => y - x);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) if ((aa[i] ?? 0) !== (bb[i] ?? 0)) return (bb[i] ?? 0) - (aa[i] ?? 0);
  return 0;
}
export function ranked<T extends Standing>(rows: readonly T[]) {
  const sorted = [...rows].sort((a, b) => compareStandings(a, b) || a.team_round_id.localeCompare(b.team_round_id));
  let rank = 0;
  return sorted.map((row, i) => { if (i === 0 || compareStandings(sorted[i - 1]!, row)) rank = i + 1; return { ...row, rank }; });
}
export interface Pause { start: number; end: number | null; }
export function solveTime(start: number, receipt: number, pauses: readonly Pause[]) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(receipt) || receipt < start) throw new Error("Invalid receipt clock.");
  const spans = pauses.map(p => {
    if (!Number.isSafeInteger(p.start) || (p.end !== null && (!Number.isSafeInteger(p.end) || p.end < p.start))) throw new Error("Invalid pause.");
    return [Math.max(start, p.start), Math.min(receipt, p.end ?? receipt)] as const;
  }).filter(([a, b]) => a < b).sort(([a], [b]) => a - b);
  let discount = 0, end = start;
  for (const [a, b] of spans) { discount += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
  return receipt - start - discount;
}

export interface DrawPlan { version: 1; round_id: string; roster: string[]; permutation: string[]; salt: string; }
function parsePlan(value: unknown, roundId: string, roster: readonly string[]): DrawPlan {
  const p = value as DrawPlan;
  const expected = [...roster].map(uuid).sort();
  if (!p || JSON.stringify(Object.keys(p).sort()) !== JSON.stringify(["permutation", "roster", "round_id", "salt", "version"])
    || p.version !== 1 || p.round_id !== uuid(roundId) || !/^[0-9a-f]{64}$/.test(p.salt)
    || !Array.isArray(p.roster) || !Array.isArray(p.permutation) || expected.length < 1 || expected.length > 100
    || new Set(expected).size !== expected.length || JSON.stringify(p.roster) !== JSON.stringify(expected)
    || JSON.stringify([...p.permutation].map(uuid).sort()) !== JSON.stringify(expected)) throw new Error("Invalid committed draw.");
  return { version: 1, round_id: roundId, roster: expected, permutation: [...p.permutation], salt: p.salt };
}
export function createDrawPlan(roundId: string, roster: readonly string[]) {
  const permutation = [...roster].sort();
  for (let i = permutation.length - 1; i > 0; i--) { const j = randomInt(i + 1); [permutation[i], permutation[j]] = [permutation[j]!, permutation[i]!]; }
  return parsePlan({ version: 1, round_id: roundId, roster: [...roster].sort(), permutation, salt: randomBytes(32).toString("hex") }, roundId, roster);
}
export const drawCommitment = (plan: DrawPlan) => sha256(JSON.stringify(parsePlan(plan, plan.round_id, plan.roster))).toString("hex");
export function createDrawCipher(key: Buffer) {
  if (key.length !== 32) throw new Error("A separate 32-byte draw key is required.");
  const secret = Buffer.from(key);
  return {
    seal(plan: DrawPlan) {
      const checked = parsePlan(plan, plan.round_id, plan.roster), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", secret, iv);
      cipher.setAAD(Buffer.from(`ingenium-draw-v1:${plan.round_id}`));
      const bytes = Buffer.concat([cipher.update(JSON.stringify(checked), "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
    },
    open(text: string, roundId: string, roster: readonly string[], commitment: string) {
      if (typeof text !== "string" || text.length > 16384 || !/^[0-9a-f]{64}$/.test(commitment)) throw new Error("Invalid draw envelope.");
      const bytes = Buffer.from(text, "base64");
      if (bytes.length < 29 || bytes.toString("base64") !== text) throw new Error("Invalid draw envelope.");
      const decipher = createDecipheriv("aes-256-gcm", secret, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(`ingenium-draw-v1:${roundId}`)); decipher.setAuthTag(bytes.subarray(12, 28));
      const plan = parsePlan(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")), roundId, roster);
      if (drawCommitment(plan) !== commitment) throw new Error("Draw commitment mismatch.");
      return plan;
    },
  };
}
export function qualifiers<T extends Standing>(rows: readonly T[], plan: DrawPlan, cap = 50) {
  if (cap !== 50) throw new Error("Unsupported qualifier cap.");
  parsePlan(plan, plan.round_id, rows.map(r => r.team_round_id));
  const standings = ranked(rows), selected: string[] = [];
  for (let i = 0; i < standings.length && selected.length < cap;) {
    const first = standings[i]!, group = standings.filter(row => row.rank === first.rank), places = cap - selected.length;
    if (group.length <= places) selected.push(...group.map(row => row.team_round_id));
    else { const ids = new Set(group.map(row => row.team_round_id)); selected.push(...plan.permutation.filter(id => ids.has(id)).slice(0, places)); }
    i += group.length;
  }
  return selected;
}
