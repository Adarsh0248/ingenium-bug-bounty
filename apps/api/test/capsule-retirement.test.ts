import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { judgeJson } from "../src/content/judge-protocol.js";
import { sha256 } from "../src/access/credentials.js";
import { createCapsuleBackend } from "../src/judge/capsule-backend.js";
import { createCapsuleRetirement, retirementContext } from "../src/judge/capsule-retirement.js";
import { retirementFixture } from "./fixtures/retirement.js";
import { judgeRuntimes, judgePayload, syntheticCapsuleResources } from "./fixtures/judge.js";
import { phaseInitialisation, phaseResourceRecord } from '../src/judge/phase-resources.js';

const signal = () => AbortSignal.timeout(5000);
const issuer = (h: ReturnType<typeof retirementFixture>) => createCapsuleRetirement(h.store, h.driver, h.release, h.authority);

test("optional absent batch checkpoints preserve legacy retirement digests and complete the bounded certificate", async () => {
  const h = retirementFixture();
  const before = await retirementContext(h.store, h.release, h.plan);
  for (const key of ['batch_compile', 'batch_artifact', 'batch_result']) h.rows[key] = null;
  for (let i = 0; i < 20; i++) for (const field of ['init', 'groups', 'result']) h.rows[`b${String(i).padStart(2, '0')}_${field}`] = null;
  assert.ok(Object.keys(h.rows).length > 64);
  assert.deepEqual((await retirementContext(h.store, h.release, h.plan)).common, before.common);
  assert.ok((await issuer(h).seal(h.plan, signal())).metadata.drain);
});

test("Python batch retirement checks every case group and rejects missing or foreign retained phases", async () => {
  const payload = judgePayload('python');
  const h = retirementFixture({ payload, owner: randomUUID(), providerToken: randomUUID() });
  const init = phaseInitialisation(h.plan, 'run', h.boot, h.physical, 'a'.repeat(64));
  h.rows.run_init = null; h.rows.run_groups = null;
  h.rows.b00_init = init;
  h.rows.b00_groups = phaseResourceRecord(init, { memory: { device: '11', inode: '12' }, cpuacct: { device: '21', inode: '22' } });
  h.rows.b00_result = { result: 'PASSED' };
  const cases = [{ caseId: randomUUID(), position: 1, checker: 'TOKENS' as const, expected: Buffer.from('12\n'), payload }];
  const authority = { ...h.authority, batchCases: cases };
  const readCapsule = h.store.capsule.bind(h.store);
  h.store.capsule = async (plan, loadBatch = false) => {
    const row = await readCapsule(plan, loadBatch);
    if (!loadBatch && row) for (const key of Object.keys(row))
      if (key.startsWith('batch_') || /^b[0-9]{2}_/.test(key)) (row as Record<string, unknown>)[key] = null;
    return row;
  };
  const context = await retirementContext(h.store, h.release, h.plan, cases);
  assert.match(context.common.context_sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(retirementContext(h.store, h.release, h.plan));
  const groups = h.rows.b00_groups;
  h.rows.b00_groups = null;
  await assert.rejects(retirementContext(h.store, h.release, h.plan, cases));
  h.rows.b00_groups = groups;
  await assert.rejects(retirementContext(h.store, h.release, h.plan, [{ ...cases[0]!, payload: { ...payload, attemptId: randomUUID() } }]));
  assert.ok((await createCapsuleRetirement(h.store, h.driver, h.release, authority).seal(h.plan, signal())).metadata.drain);
});

test("complete retirement is challenge/identity-bound, certificate-first and append-only without changing original result bytes", async () => {
  const h = retirementFixture(), original = judgeJson(h.original), result = await issuer(h).seal(h.plan, signal());
  assert.deepEqual(h.events, ["absent", "prove", "absent", "retirement", "drain"]);
  const base = structuredClone(result); base.metadata.drain = null; assert.equal(judgeJson(base), original);
  assert.ok(result.metadata.drain); assert.equal(result.stdout_b64, h.original.stdout_b64);
  assert.doesNotMatch(judgeJson(h.rows.retirement), /source_b64|stdin_b64|stdout_b64|expected|synthetic fixture/);
});
test("repeated retirement reuses one immutable certificate without another host probe or execution", async () => {
  const h = retirementFixture(), first = await issuer(h).seal(h.plan, signal()), certificate = judgeJson(h.rows.retirement);
  h.authority.prove = async () => { throw new Error("The consumed certificate must be recovered"); };
  h.driver.assertAbsent = async () => { throw new Error("Certificate recovery does not call Docker"); };
  const result = await issuer(h).seal(h.plan, signal()); assert.deepEqual(result, first); assert.equal(judgeJson(h.rows.retirement), certificate);
  assert.equal(h.events.filter(event => event === "prove").length, 1);
});
test("a lost certificate-write acknowledgement recovers its exact proof without a new probe or result rewrite", async () => {
  const h = retirementFixture(), save = h.store.saveCapsule;
  h.store.saveCapsule = async (...args) => { await save(...args); throw new Error("Lost certificate acknowledgement"); };
  await assert.rejects(issuer(h).seal(h.plan, signal())); assert.ok(h.rows.retirement); assert.equal(h.evidence().metadata.drain, null);
  const original = judgeJson(h.rows.retirement); h.authority.prove = async () => { throw new Error("Do not probe again"); };
  const result = await issuer(h).seal(h.plan, signal()); assert.ok(result.metadata.drain); assert.equal(judgeJson(h.rows.retirement), original);
});
test("an interrupted final drain save retains the certificate and recovers without executing or probing again", async () => {
  const h = retirementFixture(), save = h.store.save;
  h.store.save = async () => { throw new Error("Fixed storage failure after certificate"); };
  await assert.rejects(issuer(h).seal(h.plan, signal())); assert.ok(h.rows.retirement); assert.equal(h.evidence().metadata.drain, null);
  h.store.save = save; h.authority.prove = async () => { throw new Error("No new host probe"); };
  assert.ok((await issuer(h).seal(h.plan, signal())).metadata.drain);
});
test("a missing, partial or conflicting lifecycle/resource/phase/storage record cannot become full retirement", async () => {
  for (const key of ["container", "start", "stopped", "remove", "removed", "resource_intent", "resources", "resource_remove", "resource_removed", "storage", "run_groups"]) {
    const h = retirementFixture(); h.rows[key] = null;
    await assert.rejects(issuer(h).seal(h.plan, signal())); assert.equal(h.rows.retirement, null); assert.equal(h.evidence().metadata.drain, null); assert.deepEqual(h.events, []);
  }
});
test("another host, boot, release or physical capsule cannot certify the original slot", async () => {
  const h = retirementFixture();
  for (const change of [{ hostEpochId: randomUUID() }, { bootId: randomUUID() }, { releaseSha256: "f".repeat(64) }]) {
    assert.throws(() => createCapsuleRetirement(h.store, h.driver, h.release, { ...h.authority, ...change }));
  }
  h.store.physical = async () => ({ ...h.physical, container_id: "f".repeat(64) });
  await assert.rejects(issuer(h).seal(h.plan, signal())); assert.deepEqual(h.events, []);
});
test("host refusal, stale challenge, malformed witness and cancelled verification leave capacity held", async () => {
  for (const answer of [null, true, Buffer.alloc(32), { request_sha256: "f".repeat(64), observation_sha256: "a".repeat(64) },
    { request_sha256: "f".repeat(64), observation_sha256: "bad" }, { request_sha256: "f".repeat(64), observation_sha256: "a".repeat(64), verified: true }]) {
    const h = retirementFixture(); h.authority.prove = async () => answer;
    await assert.rejects(issuer(h).seal(h.plan, signal())); assert.equal(h.rows.retirement, null); assert.equal(h.evidence().metadata.drain, null);
  }
  const h = retirementFixture(), cancel = new AbortController(), prove = h.authority.prove;
  for (const value of ["", 0, "A".repeat(64), "a".repeat(65)]) {
    const invalid = retirementFixture(); invalid.authority.prove = async request => ({ request_sha256: sha256(judgeJson(request)).toString("hex"), observation_sha256: value });
    await assert.rejects(issuer(invalid).seal(invalid.plan, signal())); assert.equal(invalid.rows.retirement, null);
  }
  h.authority.prove = async (...args) => { const answer = await prove(...args); cancel.abort(); return answer; };
  await assert.rejects(issuer(h).seal(h.plan, cancel.signal)); assert.equal(h.rows.retirement, null);
});
test("a still-present original container or a changed context after the host probe cannot save a certificate", async () => {
  for (const when of [1, 2]) {
    const h = retirementFixture(); let seen = 0;
    h.driver.assertAbsent = async () => { if (++seen === when) throw new Error("Original ID or name still present"); };
    await assert.rejects(issuer(h).seal(h.plan, signal())); assert.equal(h.rows.retirement, null); assert.equal(h.evidence().metadata.drain, null);
  }
  const h = retirementFixture(), prove = h.authority.prove;
  h.authority.prove = async (...args) => { const answer = await prove(...args); h.rows.storage = null; return answer; };
  await assert.rejects(issuer(h).seal(h.plan, signal())); assert.equal(h.rows.retirement, null);
});
test("a copied, corrupted or changed certificate is rejected instead of minting a different proof", async () => {
  const h = retirementFixture(); await issuer(h).seal(h.plan, signal()); const original = structuredClone(h.rows.retirement) as { request: Record<string, unknown>; observation_sha256: string };
  for (const change of [{ ...original, observation_sha256: "bad" }, { ...original, extra: true }, { ...original, request: { ...original.request, boot_id: randomUUID() } },
    { ...original, request: { ...original.request, evidence_sha256: "f".repeat(64) } }, { ...original, observation_sha256: "e".repeat(64) }]) {
    h.rows.retirement = change; await assert.rejects(issuer(h).seal(h.plan, signal()));
  }
  const other = retirementFixture(); other.rows.retirement = original; await assert.rejects(issuer(other).seal(other.plan, signal()));
});
test("no result, a foreign result or a pre-existing unbound drain cannot be converted into a participant verdict", async () => {
  for (const kind of ["missing", "foreign", "drain"]) {
    const h = retirementFixture(); h.store.read = async () => {
      const evidence = structuredClone(h.original);
      if (kind === "foreign") evidence.stdout_b64 = "eA==";
      if (kind === "drain") evidence.metadata.drain = { cannot_start: true, processes_stopped: true, workspace_removed: true, proof_digest: "f".repeat(64) };
      return { begun: true, evidence: kind === "missing" ? null : evidence };
    };
    await assert.rejects(issuer(h).seal(h.plan, signal())); assert.equal(h.rows.retirement, null); assert.equal(h.evidence().metadata.drain, null);
  }
});
test("a cancelled request cannot inspect resources and authority requests are frozen/source-free", async () => {
  const h = retirementFixture(); await assert.rejects(issuer(h).seal(h.plan, AbortSignal.abort())); assert.deepEqual(h.events, []);
  const prove = h.authority.prove;
  h.authority.prove = async (request, stopped) => { assert.equal(Object.isFrozen(request), true); assert.throws(() => { (request as { nonce: string }).nonce = randomUUID(); }); return prove(request, stopped); };
  assert.ok((await issuer(h).seal(h.plan, signal())).metadata.drain);
});
test("explicit outer retirement can publish the certified drain while ordinary result recovery cannot invoke the authority", async () => {
  const h = retirementFixture(), readiness = async (): Promise<never> => { throw new Error("Retirement does not ask for fresh admission readiness"); };
  const backend = createCapsuleBackend(h.store, h.driver, h.release, judgeRuntimes(), readiness, syntheticCapsuleResources, h.authority);
  const before = await backend.recover(h.plan, signal()); assert.equal((before as typeof h.original).metadata.drain, null); assert.deepEqual(h.events, []);
  const after = await backend.retire(h.plan, signal()); assert.ok((after as typeof h.original).metadata.drain);
  h.authority.prove = async () => { throw new Error("Read-only recovery cannot run any host authority"); };
  assert.deepEqual(await backend.recover(h.plan, signal()), after);
});

test("competing completion attempts keep one immutable certificate and later duplicates recover the same proof", async () => {
  const h = retirementFixture();
  const values = await Promise.allSettled(Array.from({ length: 8 }, () => issuer(h).seal(h.plan, signal())));
  assert.ok(values.some(value => value.status === "fulfilled"));
  const saved = structuredClone(h.rows.retirement), proof = h.evidence().metadata.drain; assert.ok(proof);
  const duplicates = await Promise.all(Array.from({ length: 8 }, () => issuer(h).seal(h.plan, signal())));
  for (const value of duplicates) assert.deepEqual(value.metadata.drain, proof);
  assert.deepEqual(h.rows.retirement, saved);
});

test("the outer backend stays busy until the asynchronous host certificate is durably saved", async () => {
  const h = retirementFixture(), prove = h.authority.prove;
  let entered!: () => void, release!: () => void;
  const observed = new Promise<void>(resolve => { entered = resolve; }), waiting = new Promise<void>(resolve => { release = resolve; });
  h.authority.prove = async (...args) => { entered(); await waiting; return prove(...args); };
  const backend = createCapsuleBackend(h.store, h.driver, h.release, judgeRuntimes(), async () => Buffer.alloc(32), syntheticCapsuleResources, h.authority);
  const retiring = backend.retire(h.plan, signal());
  try {
    await observed;
    await assert.rejects(backend.retire(h.plan, signal()), /busy/); await assert.rejects(backend.execute(h.plan, signal()), /busy/);
    assert.equal(h.evidence().metadata.drain, null);
  } finally { release(); await retiring; }
  assert.ok(h.evidence().metadata.drain);
});
