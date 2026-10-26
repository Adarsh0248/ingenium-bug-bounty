import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { sha256 } from "../src/access/credentials.js";
import { runtimeRecord } from "../src/content/judge-protocol.js";
import { parseHostRuntime } from "../src/judge/host-config.js";
import { ISOLATE_BINARIES } from "../src/judge/isolate-context.js";
import { runtimeObject } from "../src/worker/config.js";
import { judgeRuntimes } from "./fixtures/judge.js";

function fixture() {
  const executable = ["docker", "dockerd", "host-observe", "launch", "node", "peer-exec", "python"],
    names = [...executable, "app/judge/capsule-cli.js", "app/judge/host-cli.js", "docker-client/config.json", "image-tree.py", "security/apparmor", "security/apparmor.bin", "security/isolate", "security/seccomp.json"].sort();
  const manifest = { version: 3, image_id: `sha256:${"a".repeat(64)}`, daemon_sha256: "b".repeat(64), image_config_sha256: "c".repeat(64),
    files: names.map(path => ({ path, size: 100, mode: executable.includes(path) ? 0o555 : 0o444, sha256: "d".repeat(64) })) };
  return { schema_version: 1, database_url: "postgres://judge_launcher:synthetic@127.0.0.1/judge_test", host_epoch_id: randomUUID(), boot_id: randomUUID(),
    runtimes: runtimeRecord(judgeRuntimes()), executables: Object.fromEntries(["isolate", "phase_exec", "gcc", "gpp", "python", "node", "java", "javac"].map(tag => [tag, "e".repeat(64)])),
    kernel_release: "6.8.0-1070-gcp", image_tree_sha256: "f".repeat(64), release: { image_id: manifest.image_id, digest: sha256(JSON.stringify(manifest)).toString("hex") }, manifest };
}
test("host configuration fixes its complete release, five languages, eight executable hashes and restricted database", () => {
  const v = fixture(), parsed = parseHostRuntime(v);
  assert.equal(parsed.runtimes.size, 5); assert.equal(Object.keys(parsed.binaries).length, 8); assert.equal(parsed.observerSha256, "d".repeat(64));
  for (const patch of [{ extra: true }, { schema_version: 2 }, { database_url: "postgres://owner:secret@8.8.8.8/judge" }, { database_url: v.database_url + "?options=-crole=owner" },
    { database_url: "postgres://runner@127.0.0.1/judge" }, { kernel_release: "6.6.0" }, { image_tree_sha256: "latest" }, { executables: {} }, { runtimes: {} },
    { release: { ...v.release, digest: "0".repeat(64) } }, { manifest: { ...v.manifest, files: v.manifest.files.slice(1) } }]) assert.throws(() => parseHostRuntime({ ...v, ...patch }));
});

test("strict object validation preserves caller order and each executable keeps its own pinned hash", () => {
  const tags = ["isolate", "phase_exec", "gcc", "gpp", "python", "node", "java", "javac"], original = [...tags];
  const hashes = tags.map((_tag, index) => String(index + 1).repeat(64));
  const executables = Object.fromEntries(tags.map((tag, index) => [tag, hashes[index]]));
  runtimeObject(executables, tags);
  assert.deepEqual(tags, original);
  const parsed = parseHostRuntime({ ...fixture(), executables });
  assert.deepEqual(ISOLATE_BINARIES.map(path => parsed.binaries[path]), hashes);
});
