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
test("private workspaces enforce real tmpfs capacities, exact bytes, ownership and once-only preparation", { timeout: 240000 }, async () => {
  const bindings = [["../../dist", "/workspace/apps/api/dist"], ["../../../../node_modules", "/workspace/node_modules"], ["../../package.json", "/workspace/apps/api/package.json"],
    ["../../../../infra/judge-gateway/test/workspace-linux.mjs", "/run/verify-workspace.mjs"]]
    .map(([source, target]) => [fileURLToPath(new URL(source!, import.meta.url)), target!] as const);
  for (const [source] of bindings) await lstat(source);
  const scenarios = [...["c", "cpp", "java", "python", "javascript"].map(language => ({ scenario: "positive", language, checks: 8 })),
    ...["wrong-size", "wrong-inodes", "workspace-noexec", "control-exec", "control-public", "ordinary-directory", "stale", "preexisting", "symlink", "no-chown", "byte-quota", "inode-quota"]
      .map(scenario => ({ scenario, language: "cpp", checks: 1 }))];
  for (const { scenario, language, checks } of scenarios) {
    const nonce = randomUUID();
    const container = await docker(["create", "--pull=never", "--name", `ingenium-workspace-test-${nonce}`, "--label", `ingenium.workspace-test=${nonce}`,
      "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL", "--cap-add", "DAC_OVERRIDE",
      ...(scenario === "no-chown" ? [] : ["--cap-add", "CHOWN"]), "--security-opt", "no-new-privileges=true",
      "--memory", "256m", "--memory-swap", "256m", "--cpus", "0.5", "--pids-limit", "32",
      "--tmpfs", "/run/ingenium:rw,nosuid,nodev,noexec,size=1m,mode=0755",
      ...(scenario === "ordinary-directory" ? [] : ["--tmpfs", `/run/ingenium/workspace:rw,nosuid,nodev,${scenario === "workspace-noexec" ? "noexec" : "exec"},size=${scenario === "wrong-size" ? "32m" : "64m"},nr_inodes=${scenario === "wrong-inodes" ? 4097 : 4096},mode=0755`,
        "--tmpfs", `/run/ingenium/control:rw,nosuid,nodev,${scenario === "control-exec" ? "exec" : "noexec"},size=16m,nr_inodes=256,mode=${scenario === "control-public" ? "0755" : "0700"}`]),
      "--env", `INGENIUM_WORKSPACE_SCENARIO=${scenario}`, "--env", `INGENIUM_WORKSPACE_LANGUAGE=${language}`,
      ...bindings.flatMap(([source, target]) => ["--mount", `type=bind,src=${source},dst=${target},readonly`]),
      "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--entrypoint", "/usr/local/bin/node", IMAGE,
      "--test", "--test-concurrency=1", "--test-reporter=tap", "/run/verify-workspace.mjs"]);
    assert.match(container, /^[a-f0-9]{64}$/);
    try {
      const output = await docker(["start", "--attach", container]);
      assert.match(output, new RegExp(`# pass ${checks}\\b`), scenario); assert.match(output, /# fail 0\b/);
    } finally {
      const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", container]));
      assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.workspace-test"], nonce);
      await docker(["stop", "--time", "5", container]); await docker(["rm", container]);
    }
  }
});
