import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const IMAGE = "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
const docker = async (args: string[]) => (await exec("docker", args, { timeout: 45000, maxBuffer: 65536, windowsHide: true })).stdout.trim();
test("protected launcher and durable checkpoints work in disposable Linux without network, secrets or submitted execution", { timeout: 90000 }, async () => {
  const bindings = [
    ["../../dist", "/workspace/apps/api/dist"], ["../../../../node_modules", "/workspace/node_modules"],
    ["../../package.json", "/workspace/apps/api/package.json"], ["../fixtures/executor-child.cjs", "/run/fixture.cjs"],
    ["../../../../infra/judge-gateway/test/executor-linux.mjs", "/run/verify.mjs"],
    ["../../../../infra/judge-gateway/test/checkpoints-linux.mjs", "/run/checkpoints.mjs"],
    ["../../../../infra/judge-gateway/test/checkpoint-fixture.mjs", "/run/checkpoint-fixture.mjs"],
  ].map(([source, target]) => [fileURLToPath(new URL(source!, import.meta.url)), target!] as const);
  for (const [source] of bindings) await lstat(source);
  const nonce = randomUUID(), volume = `ingenium-checkpoint-test-${nonce}`;
  assert.equal(await docker(["volume", "create", "--label", `ingenium.launcher-test=${nonce}`, volume]), volume);
  let container: string | undefined;
  try {
    container = await docker(["create", "--pull=never", "--name", `ingenium-launcher-test-${nonce}`, "--label", `ingenium.launcher-test=${nonce}`,
    "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
    "--memory", "256m", "--memory-swap", "256m", "--cpus", "0.5", "--pids-limit", "32",
    "--tmpfs", "/opt:rw,nosuid,nodev,exec,size=4m,mode=0755", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m,mode=0700",
    "--mount", `type=volume,src=${volume},dst=/var/lib/ingenium/judge-executor/checkpoints`,
    "--mount", `type=volume,src=${volume},dst=/var/lib/ingenium/judge-executor/capsules`,
    ...bindings.flatMap(([source, target]) => ["--mount", `type=bind,src=${source},dst=${target},readonly`]),
    "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--entrypoint", "/usr/local/bin/node", IMAGE,
    "--test", "--test-concurrency=1", "--test-reporter=tap", "/run/verify.mjs", "/run/checkpoints.mjs"]);
    assert.match(container, /^[a-f0-9]{64}$/);
    const output = await docker(["start", "--attach", container]); assert.match(output, /# pass 31\b/); assert.match(output, /# fail 0\b/);
  } finally {
    if (container) {
      const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", container]));
      assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.launcher-test"], nonce);
      await docker(["stop", "--time", "5", container]); await docker(["rm", container]);
    }
    const config = JSON.parse(await docker(["volume", "inspect", "--format", "{{json .}}", volume]));
    assert.equal(config.Name, volume); assert.equal(config.Labels["ingenium.launcher-test"], nonce);
    await docker(["volume", "rm", volume]);
  }
});
test("standalone capsule refusal exits its real namespace-init process and does not leave a trusted fixture child running", { timeout: 60000 }, async () => {
  const nonce = randomUUID();
  const bindings = [["../../dist", "/workspace/apps/api/dist"], ["../../../../node_modules", "/workspace/node_modules"], ["../../package.json", "/workspace/apps/api/package.json"],
    ["../../../../infra/judge-gateway/test/capsule-refusal.mjs", "/run/capsule-refusal.mjs"]]
    .map(([source, target]) => [fileURLToPath(new URL(source!, import.meta.url)), target!] as const);
  for (const [path] of bindings) await lstat(path);
  const container = await docker(["create", "--pull=never", "--name", `ingenium-capsule-exit-test-${nonce}`, "--label", `ingenium.launcher-test=${nonce}`,
    "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
    "--memory", "192m", "--memory-swap", "192m", "--cpus", "0.5", "--pids-limit", "32",
    ...bindings.flatMap(([source, target]) => ["--mount", `type=bind,src=${source},dst=${target},readonly`]),
    "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--entrypoint", "/usr/local/bin/node", IMAGE, "/run/capsule-refusal.mjs"]);
  try {
    await assert.rejects(docker(["start", "--attach", container]), error => {
      const failure = error as Error & { stdout: string; stderr: string };
      assert.match(failure.stdout, /TRUSTED_CHILD_STARTED/); assert.match(failure.stderr, /Protected capsule unavailable/); return true;
    });
    const state = JSON.parse(await docker(["inspect", "--format", "{{json .State}}", container]));
    assert.equal(state.Running, false); assert.equal(state.Pid, 0); assert.equal(state.ExitCode, 125); assert.equal(state.OOMKilled, false);
  } finally {
    const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", container]));
    assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.launcher-test"], nonce);
    await docker(["stop", "--time", "5", container]); await docker(["rm", container]);
  }
});
