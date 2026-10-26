import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { CAPSULE_TMPFS } from "../../src/judge/docker-capsule.js";

const IMAGE = "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
const docker = async (args: string[]) => (await exec("docker", args, { timeout: 45000, maxBuffer: 65536, windowsHide: true })).stdout.trim();
test("temporary storage and bounded read-only proc checks use real Linux mounts/tasks/FDs, never submitted source", { timeout: 90000 }, async () => {
  const bindings = [["../../dist", "/workspace/apps/api/dist"], ["../../../../node_modules", "/workspace/node_modules"], ["../../package.json", "/workspace/apps/api/package.json"],
    ["../../../../infra/judge-gateway/test/storage-linux.mjs", "/run/verify-storage.mjs"]]
    .map(([source, target]) => [fileURLToPath(new URL(source!, import.meta.url)), target!] as const);
  for (const [source] of bindings) await lstat(source);
  const nonce = randomUUID(), container = await docker(["create", "--pull=never", "--name", `ingenium-storage-test-${nonce}`, "--label", `ingenium.storage-test=${nonce}`,
    "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--security-opt", "no-new-privileges=true",
    "--memory", "192m", "--memory-swap", "192m", "--cpus", "0.5", "--pids-limit", "32",
    ...Object.entries(CAPSULE_TMPFS).flatMap(([path, options]) => ["--tmpfs", `${path}:${options}`]),
    ...bindings.flatMap(([source, target]) => ["--mount", `type=bind,src=${source},dst=${target},readonly`]),
    "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--entrypoint", "/usr/local/bin/node", IMAGE, "/run/verify-storage.mjs"]);
  assert.match(container, /^[a-f0-9]{64}$/);
  try {
    const output = await docker(["start", "--attach", container]); assert.match(output, /^[#\u2139] pass 9$/m); assert.match(output, /^[#\u2139] fail 0$/m);
  } finally {
    const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", container]));
    assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.storage-test"], nonce);
    await docker(["stop", "--timeout", "2", container]); await docker(["rm", container]);
  }
});
