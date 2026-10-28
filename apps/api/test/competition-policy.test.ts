import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { bounty, compareStandings, createDrawCipher, createDrawPlan, drawCommitment, hintPrice, qualifiers, ranked, solveTime, winPoints } from "../src/competition/policy.js";

test("boosted Round 1 rewards keep exact hint percentages while legacy snapshots and Round 2 stay unchanged", () => {
  for (const d of [1,3,20,40,100]) {
    const boosted=bounty(d,5);
    assert.equal(boosted,50*d);
    assert.deepEqual([1,2,3].map(level=>hintPrice(1,d,level,boosted)),[5*d,15*d,20*d]);
    assert.equal(winPoints(1,d,3,boosted),boosted);
    assert.equal(boosted-[1,2,3].reduce((n,level)=>n+hintPrice(1,d,level,boosted),0),10*d);
    assert.equal(winPoints(1,d,0),10*d);
    assert.equal(hintPrice(2,d,3),8*d);
    assert.throws(()=>hintPrice(2,d,1,boosted));
    assert.throws(()=>winPoints(2,d,0,boosted));
  }
  for (const multiplier of [0,2,6,1.5,NaN]) assert.throws(()=>bounty(20,multiplier));
  assert.throws(()=>hintPrice(1,20,1,999));
});

test("bounty, both hint schedules and admission-tier points are exact integer game units", () => {
  for (const d of [1, 80, 95, 100]) {
    assert.equal(bounty(d), 10 * d);
    assert.deepEqual([1, 2, 3].map(l => hintPrice(1, d, l)), [d, 3 * d, 4 * d]);
    assert.deepEqual([1, 2, 3].map(l => hintPrice(2, d, l)), [d, 3 * d, 8 * d]);
    assert.deepEqual([0, 1, 2, 3].map(t => winPoints(2, d, t)), [10 * d, 9 * d, 7 * d, 5 * d]);
    assert.equal(winPoints(1, d, 3), bounty(d));
  }
  for (const d of [0, -1, 101, 1.5, NaN, Infinity]) assert.throws(() => bounty(d));
  assert.throws(() => hintPrice(3, 50, 1)); assert.throws(() => hintPrice(1, 50, 4)); assert.throws(() => winPoints(2, 50, -1));
  assert.equal(bounty(100) - hintPrice(1, 100, 1) - hintPrice(1, 100, 2), 600);
});
test("ranking compares points, exact time and highest-first difficulties while true ties share rank", () => {
  const a = { team_round_id: randomUUID(), points: 100, effective_time_ms: 1000, difficulties: [60, 95] };
  const b = { ...a, team_round_id: randomUUID(), difficulties: [90, 85] };
  assert.ok(compareStandings(a, b) < 0);
  assert.ok(compareStandings({ ...a, points: 99 }, b) > 0);
  assert.ok(compareStandings({ ...a, effective_time_ms: 1001 }, b) > 0);
  const c = { ...a, team_round_id: randomUUID(), difficulties: [95, 60] };
  assert.deepEqual(ranked([b, a, c]).map(r => r.rank), [1, 1, 3]);
});
test("solve time subtracts only the clipped union of supplied global/team intervals", () => {
  assert.equal(solveTime(1000, 10000, [{ start: 0, end: 2000 }, { start: 1500, end: 3000 }, { start: 5000, end: 7000 }, { start: 6000, end: 8000 }, { start: 20000, end: null }]), 4000);
  assert.equal(solveTime(1000, 10000, [{ start: 8000, end: null }]), 7000);
  assert.throws(() => solveTime(1000, 0, [])); assert.throws(() => solveTime(0, 100, [{ start: 20, end: 10 }]));
});
test("qualification uses one authenticated precommitted permutation, never display order or a new draw", () => {
  const round = randomUUID(), ids: string[] = Array.from({ length: 51 }, () => randomUUID()), plan = createDrawPlan(round, ids), cipher = createDrawCipher(randomBytes(32));
  const commitment = drawCommitment(plan), sealed = cipher.seal(plan);
  assert.equal(JSON.stringify(cipher.open(sealed, round, ids, commitment)), JSON.stringify(plan));
  const rows = ids.map((id, i) => ({ team_round_id: id, points: i < 48 ? 100 : 0, effective_time_ms: 0, difficulties: [] }));
  const chosen = qualifiers(rows, plan); assert.equal(chosen.length, 50); assert.ok(ids.slice(0, 48).every(id => chosen.includes(id)));
  assert.deepEqual(chosen.filter(id => ids.slice(48).includes(id)), plan.permutation.filter(id => ids.slice(48).includes(id)).slice(0, 2));
  assert.deepEqual(qualifiers(rows, cipher.open(sealed, round, ids, commitment)), chosen);
  assert.throws(() => cipher.open(sealed, randomUUID(), ids, commitment));
  assert.throws(() => cipher.open(sealed, round, ids.slice(1), commitment));
  assert.throws(() => createDrawCipher(randomBytes(32)).open(sealed, round, ids, commitment));
  assert.throws(() => cipher.open(sealed, round, ids, "0".repeat(64)));
  const zeroRows = rows.map(r => ({ ...r, points: 0 }));
  assert.deepEqual(qualifiers(zeroRows, plan), plan.permutation.slice(0, 50));
  assert.equal(ranked(zeroRows).filter(r => r.rank === 1).length, 51);
});
