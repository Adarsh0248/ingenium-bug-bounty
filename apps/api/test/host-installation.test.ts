import assert from "node:assert/strict";
import { test } from "node:test";
import { sha256 } from "../src/access/credentials.js";
import { openHostInstallation, reviewedHostRelease } from "../src/judge/host-installation.js";
import type { HostReleaseManifest } from "../src/judge/host-installation.js";

function fixture() {
  const manifest: HostReleaseManifest = { version: 3, image_id: `sha256:${"a".repeat(64)}`, daemon_sha256: "c".repeat(64), image_config_sha256: "d".repeat(64), files:
    ["app/judge/capsule-cli.js", "docker", "docker-client/config.json", "dockerd", "launch", "node", "peer-exec", "security/apparmor", "security/isolate", "security/seccomp.json"]
      .map(path => ({ path, size: 8, mode: ["docker", "dockerd", "launch", "node", "peer-exec"].includes(path) ? 0o555 as const : 0o444 as const, sha256: "b".repeat(64) })) };
  return { manifest, release: pin(manifest) };
}
function pin(manifest: HostReleaseManifest) { return { imageId: manifest.image_id, digest: sha256(JSON.stringify(manifest)).toString("hex") }; }

test("host release is an ordered, copied and frozen complete file manifest bound to the trusted release and image", () => {
  const f = fixture(), result = reviewedHostRelease(f.manifest, f.release);
  assert.deepEqual(result, f.manifest); assert.notEqual(result.files, f.manifest.files);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.files)); assert.ok(result.files.every(Object.isFrozen));
  (f.manifest.files[0] as { sha256: string }).sha256 = "c".repeat(64);
  assert.equal(result.files[0]!.sha256, "b".repeat(64));
});

test("host release refuses mismatched image/digest, unknown fields and non-manifest data", () => {
  const f = fixture();
  for (const value of [null, [], {}, { ...f.manifest, ready: true }, { ...f.manifest, version: 1 }, { ...f.manifest, version: 2 }, { ...f.manifest, files: {} },
    { ...f.manifest, daemon_sha256: "bad" }, { ...f.manifest, image_config_sha256: null }]) {
    assert.throws(() => reviewedHostRelease(value, f.release));
  }
  for (const release of [{ ...f.release, digest: "c".repeat(64) }, { ...f.release, imageId: "latest" }, { ...f.release, imageId: `sha256:${"c".repeat(64)}` }]) {
    assert.throws(() => reviewedHostRelease(f.manifest, release));
  }
});

test("host manifest refuses traversal, aliases, unordered/duplicate names, files used as directories and extra client configuration", () => {
  for (const path of ["/tmp/escape", "app/../escape", "app/./escape", "app//escape", "app/", "app\\escape", "app/line\n", "app/space name", "app/\u00e9", "docker-client/contexts/meta.json", "docker/child"]) {
    const f = fixture(), manifest = { ...f.manifest, files: [...f.manifest.files, { path, size: 1, mode: 0o444 as const, sha256: "c".repeat(64) }].sort((a, b) => a.path < b.path ? -1 : 1) };
    assert.throws(() => reviewedHostRelease(manifest, pin(manifest)), path);
  }
  const f = fixture();
  for (const files of [[...f.manifest.files].reverse(), [...f.manifest.files, f.manifest.files[0]!], f.manifest.files.slice(1)]) {
    const manifest = { ...f.manifest, files }; assert.throws(() => reviewedHostRelease(manifest, pin(manifest)));
  }
});

test("every required artifact has its fixed mode and nonempty size; file metadata cannot be coerced", () => {
  for (const change of [{ size: -1 }, { size: "8" }, { size: 1.5 }, { size: 268435457 }, { size: 0 }, { mode: 0o644 }, { mode: 0o755 }, { mode: 0o444 }, { sha256: "B".repeat(64) }, { trusted: true }]) {
    const f = fixture(), files = f.manifest.files.map(file => file.path === "docker" ? { ...file, ...change } : file), manifest = { ...f.manifest, files };
    assert.throws(() => reviewedHostRelease(manifest, pin(manifest as HostReleaseManifest)));
  }
});

test("manifest bounds include all dependencies, not just the launcher; harmless empty dependency files remain supported", () => {
  const f = fixture(), extra = { path: "app/empty", size: 0, mode: 0o444 as const, sha256: sha256(Buffer.alloc(0)).toString("hex") };
  const manifest = { ...f.manifest, files: [extra, ...f.manifest.files] };
  assert.equal(reviewedHostRelease(manifest, pin(manifest)).files[0]!.size, 0);
  const large = { ...f.manifest, files: f.manifest.files.map(file => ({ ...file, size: 268435456 })) };
  assert.throws(() => reviewedHostRelease(large, pin(large)));
  assert.throws(() => reviewedHostRelease({ ...f.manifest, files: Array(32769).fill(extra) }, f.release));
  const directories = { ...f.manifest, files: [...f.manifest.files, ...Array.from({ length: 400 }, (_, i) => ({ ...extra, path: `app/d${String(i).padStart(3, "0")}/${"a/".repeat(90)}empty` }))]
    .sort((a, b) => a.path < b.path ? -1 : 1) };
  assert.throws(() => reviewedHostRelease(directories, pin(directories)));
});

test("manifest canonicalization uses fixed field order, not caller property order or mutable manifest references", () => {
  const f = fixture(), reordered = { files: f.manifest.files.map(file => ({ sha256: file.sha256, mode: file.mode, size: file.size, path: file.path })),
    image_config_sha256: f.manifest.image_config_sha256, daemon_sha256: f.manifest.daemon_sha256, image_id: f.manifest.image_id, version: 3 };
  assert.deepEqual(reviewedHostRelease(reordered, f.release), f.manifest);
});

test("cancelled/invalid installation requests fail without starting Docker or creating any installation", async () => {
  const f = fixture(), signal = AbortSignal.abort(new Error("cancelled installation"));
  await assert.rejects(openHostInstallation(f.manifest, f.release, signal), /cancelled installation/);
  await assert.rejects(openHostInstallation({}, f.release, new AbortController().signal), /installation/);
});
