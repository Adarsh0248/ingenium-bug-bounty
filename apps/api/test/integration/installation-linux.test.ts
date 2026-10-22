import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dockerDaemonDigest, dockerImageConfigDigest, verifyDockerReports } from "../../src/judge/docker-host.js";
import type { DockerCommand } from "../../src/judge/docker-capsule.js";

const IMAGE = "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
const docker = async (args: string[]) => (await exec("docker", args, { timeout: 45000, maxBuffer: 65536, windowsHide: true })).stdout.trim();

test("release integrity and fixed Docker wiring use real Linux files/ELF/socket metadata but no host daemon or participant code", { timeout: 90000 }, async () => {
  const bindings = [["../../dist", "/workspace/apps/api/dist"], ["../../../../node_modules", "/workspace/node_modules"], ["../../package.json", "/workspace/apps/api/package.json"],
    ["../../../../infra/judge-gateway/test/installation-linux.mjs", "/fixture/installation-linux.mjs"], ["../fixtures/docker-reports.json", "/fixture/docker-reports.json"],
    ["../../../../infra/judge-gateway/native/docker-peer-exec.c", "/fixture/docker-peer-exec.c"]]
    .map(([source, target]) => [fileURLToPath(new URL(source!, import.meta.url)), target!] as const);
  for (const [source] of bindings) await lstat(source);
  const nonce = randomUUID(), volume = `ingenium-installation-test-${nonce}`;
  assert.equal(await docker(["volume", "create", "--label", `ingenium.installation-test=${nonce}`, volume]), volume);
  let container: string | undefined;
  try {
    container = await docker(["create", "--pull=never", "--name", `ingenium-installation-test-${nonce}`, "--label", `ingenium.installation-test=${nonce}`,
      "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
      "--memory", "256m", "--memory-swap", "256m", "--cpus", "0.5", "--pids-limit", "32",
      "--tmpfs", "/run:rw,nosuid,nodev,noexec,size=4m,mode=0755", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m,mode=0700",
      "--mount", `type=volume,src=${volume},dst=/opt/ingenium`,
      ...bindings.flatMap(([source, target]) => ["--mount", `type=bind,src=${source},dst=${target},readonly`]),
      "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--entrypoint", "/usr/local/bin/node", IMAGE,
      "--test", "--test-concurrency=1", "--test-reporter=tap", "/fixture/installation-linux.mjs"]);
    assert.match(container, /^[a-f0-9]{64}$/);
    const output = await docker(["start", "--attach", container]); assert.match(output, /# pass 17\b/); assert.match(output, /# fail 0\b/);
  } finally {
    if (container) {
      const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", container]));
      assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.installation-test"], nonce);
      await docker(["stop", "--timeout", "2", container]); await docker(["rm", container]);
    }
    const config = JSON.parse(await docker(["volume", "inspect", "--format", "{{json .}}", volume]));
    assert.equal(config.Name, volume); assert.equal(config.Labels["ingenium.installation-test"], nonce); await docker(["volume", "rm", volume]);
  }
});

test("the real local Docker daemon cannot match synthetic reviewed-host pins; inspection performs no mutation", { timeout: 30000 }, async () => {
  const fixture = JSON.parse(await readFile(new URL("../fixtures/docker-reports.json", import.meta.url), "utf8"));
  const calls: string[][] = [], command: DockerCommand = async (args, input, signal) => {
    signal.throwIfAborted(); assert.equal(input.length, 0); assert.equal(args[0], "info"); calls.push([...args]);
    return Buffer.from(await docker([...args]));
  };
  const pins = { daemon_sha256: dockerDaemonDigest(Buffer.from(JSON.stringify(fixture.daemon))),
    image_config_sha256: dockerImageConfigDigest(Buffer.from(JSON.stringify(fixture.image)), fixture.image.Id) };
  await assert.rejects(verifyDockerReports(command, fixture.image.Id, pins, AbortSignal.timeout(20000)), /Docker reports/);
  assert.deepEqual(calls, [["info", "--format", "{{json .}}"]]);
});

test("the cached real image's config can be inspected without executing it, while a foreign ID or changed environment cannot share its digest", { timeout: 30000 }, async () => {
  const raw = Buffer.from(await docker(["image", "inspect", "--format", "{{json .}}", IMAGE]));
  const image = JSON.parse(raw.toString("utf8")), digest = dockerImageConfigDigest(raw, image.Id);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.throws(() => dockerImageConfigDigest(raw, `sha256:${"0".repeat(64)}`));
  const changed = { ...image, Config: { ...image.Config, Env: ["NODE_OPTIONS=--require=/tmp/unreviewed"] } };
  assert.notEqual(dockerImageConfigDigest(Buffer.from(JSON.stringify(changed)), image.Id), digest);
});
