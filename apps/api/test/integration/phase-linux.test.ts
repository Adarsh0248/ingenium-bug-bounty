import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const IMAGE = "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
const docker = async (args: string[]) => (await exec("docker", args, { timeout: 60000, maxBuffer: 65536, windowsHide: true })).stdout.trim();
test("native exec and phase pipes run only fixed trusted fixtures in owned bounded Linux containers", { timeout: 180000 }, async () => {
  const bindings = [
    ["../../dist", "/workspace/apps/api/dist"], ["../../../../node_modules", "/workspace/node_modules"], ["../../package.json", "/workspace/apps/api/package.json"],
    ["../../../../infra/judge-gateway/native/phase-exec.c", "/run/phase-exec.c"], ["../../../../infra/judge-gateway/test/native-target.c", "/run/native-target.c"],
    ["../../../../infra/judge-gateway/test/sum.c", "/run/sum.c"], ["../../../../infra/judge-gateway/test/sum.cpp", "/run/sum.cpp"],
    ["../../../../infra/judge-gateway/test/phase-linux.mjs", "/run/verify-phase.mjs"],
  ].map(([source, target]) => [fileURLToPath(new URL(source!, import.meta.url)), target!] as const);
  for (const [source] of bindings) await lstat(source);
  // Missing NNP is only a trusted rejection fixture; no participant code is mounted or launched.
  for (const { uid, nnp, checks } of [{ uid: 60000, nnp: true, checks: 13 }, { uid: 0, nnp: true, checks: 1 }, { uid: 60000, nnp: false, checks: 1 }]) {
    const nonce = randomUUID(), container = await docker(["create", "--pull=never", "--name", `ingenium-phase-test-${nonce}`, "--label", `ingenium.phase-test=${nonce}`,
      "--restart", "no", "--network", "none", "--read-only", "--user", `${uid}:${uid}`, "--cap-drop", "ALL", ...(nnp ? ["--security-opt", "no-new-privileges=true"] : []),
      "--memory", "256m", "--memory-swap", "256m", "--cpus", "0.5", "--pids-limit", "32",
      "--tmpfs", `/box:rw,nosuid,nodev,exec,size=16m,nr_inodes=2048,mode=0700,uid=${uid},gid=${uid}`,
      "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777",
      ...(checks === 1 ? ["--env", "INGENIUM_NATIVE_EXPECT_DENIAL=1"] : []),
      ...bindings.flatMap(([source, target]) => ["--mount", `type=bind,src=${source},dst=${target},readonly`]),
      "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--entrypoint", "/usr/local/bin/node", IMAGE,
      "--test", "--test-concurrency=1", "--test-reporter=tap", "/run/verify-phase.mjs"]);
    assert.match(container, /^[a-f0-9]{64}$/);
    try {
      const output = await docker(["start", "--attach", container]); assert.match(output, new RegExp(`# pass ${checks}\\b`)); assert.match(output, /# fail 0\b/);
    } finally {
      const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", container]));
      assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.phase-test"], nonce);
      await docker(["stop", "--time", "5", container]); await docker(["rm", container]);
    }
  }
});
