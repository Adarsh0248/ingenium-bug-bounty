import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { CompactEncrypt } from "jose";
import { canonicalCode, language, newAccessCode, newProof, parseProof, sameVerifier, sessionDelivery, sha256, uuid } from "../src/access/credentials.js";
import { refill } from "../src/access/quotas.js";
import { participantDeadlines, participantTimeValid } from "../src/access/entry-service.js";

test("staff and legacy codes contain 160 random bits with strict ASCII-only display normalisation", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 100; index++) {
    const result = newAccessCode();
    assert.match(result.code, /^[A-Z2-7]{32}$/);
    assert.equal(result.verifier.length, 32);
    assert.deepEqual(result.verifier, sha256(result.code));
    assert.equal(canonicalCode(result.code.toLowerCase().match(/.{4}/g)!.join(" - ")), result.code);
    seen.add(result.code);
  }
  assert.equal(seen.size, 100);
  for (const value of [null, {}, "A".repeat(31), "A".repeat(33), "0".repeat(32), "1".repeat(32), "A".repeat(31) + "\u00df", "A".repeat(31) + "\n", "A".repeat(31) + "\t", "-".repeat(97)]) assert.throws(() => canonicalCode(value));
});

test("new team codes have eight random Base32 characters and preserve strict display normalisation", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 100; index++) {
    const result = newAccessCode("TEAM");
    assert.match(result.code, /^[A-Z2-7]{8}$/);
    assert.deepEqual(result.verifier, sha256(result.code));
    assert.equal(canonicalCode(result.code.toLowerCase().match(/.{4}/g)!.join(" - ")), result.code);
    seen.add(result.code);
  }
  assert.equal(seen.size, 100);
  for (const value of ["A".repeat(7), "A".repeat(9), "0".repeat(8), "1".repeat(8), "A".repeat(7) + "\u00df", "A".repeat(7) + "\n", "A".repeat(7) + "\t", "-".repeat(8)]) assert.throws(() => canonicalCode(value));
  assert.equal(newAccessCode("STAFF").code.length, 32);
});

test("opaque credentials require the version, a UUIDv4 lookup and a canonical 32-byte secret", () => {
  const proof = newProof();
  assert.equal(proof.cookie.length, 83);
  assert.deepEqual(parseProof(proof.cookie), { id: proof.id, verifier: proof.verifier });
  assert.ok(sameVerifier(parseProof(proof.cookie)?.verifier, proof.verifier));
  assert.equal(sameVerifier(Buffer.alloc(31), Buffer.alloc(31)), false);
  assert.equal(sameVerifier(Buffer.alloc(32), Buffer.alloc(32, 1)), false);
  assert.equal(sameVerifier("a", "a"), false);
  for (const input of [undefined, proof.id, proof.cookie.replace("v1.", "v2."), proof.cookie + "=", proof.cookie + "\n", "x".repeat(4096), proof.cookie.replace(proof.id, "ABCDEFAB-1234-4234-8234-ABCDEFABCDEF")]) assert.equal(parseProof(input), null);
  const noncanonical = proof.cookie.slice(0, -1) + "B";
  assert.equal(parseProof(noncanonical), null);
});

test("language and identity parsing does not coerce other values or accept a browser-selected role", () => {
  for (const input of ["c", "cpp", "java", "python", "javascript"]) assert.equal(language(input), input);
  for (const input of ["react", "html", "Python", null, ["java"], "ADMIN"]) assert.throws(() => language(input));
  const id = randomUUID();
  assert.equal(uuid(id), id);
  for (const value of ["ABCDEFAB-1234-4234-8234-ABCDEFABCDEF", "not-a-uuid", 1]) assert.throws(() => uuid(value));
});

test("delivery encrypts one exact cookie and rejects tampering, wrong keys and every changed binding", async () => {
  const key = randomBytes(32);
  const codec = sessionDelivery("local-test-v1", key);
  const session = newProof();
  const binding = { flowId: randomUUID(), sessionId: session.id, memberRoundId: randomUUID(), credentialId: randomUUID(), credentialVersion: "1", expiresAt: "2026-10-19T08:10:00.000Z" };
  const ciphertext = await codec.encrypt(binding, session.cookie);
  assert.equal(ciphertext.includes(session.cookie), false);
  assert.equal(await codec.decrypt(ciphertext, binding), session.cookie);
  await assert.rejects(sessionDelivery("local-test-v1", randomBytes(32)).decrypt(ciphertext, binding));
  await assert.rejects(sessionDelivery("wrong-id", key).decrypt(ciphertext, binding));
  for (const name of ["flowId", "sessionId", "memberRoundId", "credentialId"] as const) await assert.rejects(codec.decrypt(ciphertext, { ...binding, [name]: randomUUID() }));
  for (const override of [{ credentialVersion: "2" }, { expiresAt: "2026-10-19T08:11:00.000Z" }]) await assert.rejects(codec.decrypt(ciphertext, { ...binding, ...override }));
  const parts = ciphertext.split(".");
  parts[3] = (parts[3]!.startsWith("A") ? "B" : "A") + parts[3]!.slice(1);
  await assert.rejects(codec.decrypt(parts.join("."), binding));
  await assert.rejects(codec.decrypt("x".repeat(4097), binding));
  await assert.rejects(codec.encrypt(binding, newProof().cookie));
  assert.throws(() => sessionDelivery("bad key id", key));
  assert.throws(() => sessionDelivery("valid", Buffer.alloc(16)));
  const foreign = await new CompactEncrypt(Buffer.from(JSON.stringify({ schema: 1, purpose: "TEAM_ENTRY", ...binding, cookie: session.cookie })))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", kid: "local-test-v1", typ: "another-purpose" }).encrypt(key);
  await assert.rejects(codec.decrypt(foreign, binding));
});

test("quota refill uses exact bounded integer arithmetic and cannot mint credit on clock reversal", () => {
  assert.equal(refill(0n, 3000n, 20n, 5n), 60000n);
  assert.equal(refill(12000n, 10n ** 30n, 20n, 5n), 300000n);
  assert.equal(refill(300000n, 0n, 20n, 5n), 300000n);
  assert.equal(refill(59999n, 1n, 10n, 4n), 60009n);
  for (const [credits, elapsed, rate, burst] of [[0n, -1n, 20n, 5n], [-1n, 1n, 20n, 5n], [300001n, 0n, 20n, 5n], [0n, 0n, 0n, 5n]] as const) assert.throws(() => refill(credits, elapsed, rate, burst));
});

test("participant expiry equality is expired and activity cannot extend the eight-hour deadline", () => {
  const start = new Date("2026-10-19T08:00:00.000Z");
  const row = { created_at: start, last_activity_at: start, absolute_expires_at: new Date(start.getTime() + 28800000) };
  assert.equal(participantTimeValid(row, new Date(start.getTime() + 7199999)), true);
  assert.equal(participantTimeValid(row, new Date(start.getTime() + 7200000)), false);
  row.last_activity_at = new Date(start.getTime() + 7 * 3600000);
  assert.equal(participantTimeValid(row, new Date(start.getTime() + 28800000 - 1)), true);
  assert.equal(participantTimeValid(row, row.absolute_expires_at), false);
  assert.throws(() => participantTimeValid(row, new Date(start.getTime() - 1)), /CLOCK_UNTRUSTED/);
});

test("participant warnings follow the earlier deadline and remain five minutes before absolute expiry", () => {
  const start = new Date("2026-10-19T08:00:00.000Z");
  const row = { last_activity_at: start, absolute_expires_at: new Date("2026-10-19T16:00:00.000Z") };
  assert.deepEqual(participantDeadlines(row), { expiresAt: "2026-10-19T10:00:00.000Z", absoluteExpiresAt: "2026-10-19T16:00:00.000Z", warningAt: "2026-10-19T09:55:00.000Z" });
  row.last_activity_at = new Date("2026-10-19T15:00:00.000Z");
  assert.deepEqual(participantDeadlines(row), { expiresAt: "2026-10-19T16:00:00.000Z", absoluteExpiresAt: "2026-10-19T16:00:00.000Z", warningAt: "2026-10-19T15:55:00.000Z" });
});

test("replacement proof and session deliveries cannot be replayed as each other or as ordinary entry", async () => {
  const codec = sessionDelivery("synthetic-handoff-v1", randomBytes(32)), proof = newProof();
  const common = { flowId: proof.id, sessionId: proof.id, memberRoundId: randomUUID(), credentialId: randomUUID(), credentialVersion: "1", expiresAt: "2026-10-19T08:10:00.000Z" };
  const bound = { ...common, handoff: "REQUEST" as const }, saved = await codec.encrypt(bound, proof.cookie);
  assert.equal(await codec.decrypt(saved, bound), proof.cookie);
  await assert.rejects(codec.decrypt(saved, { ...common, handoff: "SESSION" }));
  await assert.rejects(codec.decrypt(saved, common));
  await assert.rejects(codec.decrypt(saved, { ...bound, expiresAt: "2026-10-19T08:11:00.000Z" }));
  await assert.rejects(codec.encrypt({ ...common, handoff: "OTHER" } as never, proof.cookie));
});
