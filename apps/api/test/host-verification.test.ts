import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { sha256 } from "../src/access/credentials.js";
import { judgeJson } from "../src/content/judge-protocol.js";
import { checkedHostCertificate } from "../src/judge/host-verification.js";

// Certificate decoding fixtures; these never stand in for a real kernel observation or protected cache.
test("host certificate cannot survive a boot/release/image/policy/topology change or an incomplete inspection", () => {
  const binding = { version: 1, host_epoch_id: randomUUID(), boot_id: randomUUID(), release_sha256: "a".repeat(64), image_tree_sha256: "b".repeat(64) },
    intent = { binding, nonce: randomUUID() }, observation = { context: { boot: binding.boot_id }, policy: { revision: "7", raw_sha256: "c".repeat(64) }, roots: { h0: { inode: "12" } } },
    record = { binding, intent_sha256: sha256(judgeJson(intent)).toString("hex"), image: { protocol: "ingenium-image-tree-v1", tree_sha256: binding.image_tree_sha256, files: 1, entries: 2, data_bytes: 100 }, observation };
  assert.equal(checkedHostCertificate(record, intent, binding, observation).length, 32);
  for (const key of Object.keys(binding)) assert.throws(() => checkedHostCertificate(record, intent, { ...binding, [key]: "other" }, observation));
  for (const patch of [{ image: {} }, { image: { ...record.image, files: 0 } }, { intent_sha256: "d".repeat(64) }, { observation: {} }, { extra: true }])
    assert.throws(() => checkedHostCertificate({ ...record, ...patch }, intent, binding, observation));
  assert.throws(() => checkedHostCertificate(record, { ...intent, nonce: randomUUID() }, binding, observation));
  assert.throws(() => checkedHostCertificate(record, intent, binding, { ...observation, policy: { ...observation.policy, revision: "8" } }));
  assert.throws(() => checkedHostCertificate(null, intent, binding, observation));
});
