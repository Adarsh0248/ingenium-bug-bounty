import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const IMAGE =
  "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
const docker = async (args: string[]) =>
  (
    await exec("docker", args, {
      timeout: 45000,
      maxBuffer: 32768,
      windowsHide: true,
    })
  ).stdout.trim();
test(
  "private app runtime files and worker startup refuse unsafe Linux state in an owned networkless container",
  { timeout: 60000 },
  async () => {
    const bindings = [
      ["../../dist", "/workspace/apps/api/dist"],
      ["../../../../node_modules", "/workspace/node_modules"],
      ["../../package.json", "/workspace/apps/api/package.json"],
      [
        "../../../../infra/judge-gateway/test/app-runtime-linux.mjs",
        "/fixture/test.mjs",
      ],
    ].map(
      ([source, target]) =>
        [fileURLToPath(new URL(source!, import.meta.url)), target!] as const,
    );
    for (const [path] of bindings) await lstat(path);
    const nonce = randomUUID(),
      container = await docker([
        "create",
        "--pull=never",
        "--name",
        `ingenium-runtime-test-${nonce}`,
        "--label",
        `ingenium.runtime-test=${nonce}`,
        "--restart",
        "no",
        "--network",
        "none",
        "--read-only",
        "--user",
        "0:0",
        "--cap-drop",
        "ALL",
        "--cap-add",
        "CHOWN",
        "--cap-add",
        "SETUID",
        "--cap-add",
        "SETGID",
        "--security-opt",
        "no-new-privileges=true",
        "--memory",
        "192m",
        "--memory-swap",
        "192m",
        "--cpus",
        "0.5",
        "--pids-limit",
        "32",
        "--tmpfs",
        "/run:rw,nosuid,nodev,noexec,size=4m,mode=0755",
        ...bindings.flatMap(([source, target]) => [
          "--mount",
          `type=bind,src=${source},dst=${target},readonly`,
        ]),
        "--log-driver",
        "json-file",
        "--log-opt",
        "max-size=1m",
        "--log-opt",
        "max-file=1",
        "--entrypoint",
        "/usr/local/bin/node",
        IMAGE,
        "--test",
        "--test-reporter=tap",
        "/fixture/test.mjs",
      ]);
    assert.match(container, /^[a-f0-9]{64}$/);
    try {
      const output = await docker(["start", "--attach", container]);
      assert.match(output, /# pass 6\b/);
      assert.match(output, /# fail 0\b/);
    } finally {
      const config = JSON.parse(
        await docker(["inspect", "--format", "{{json .Config}}", container]),
      );
      assert.equal(config.Image, IMAGE);
      assert.equal(config.Labels["ingenium.runtime-test"], nonce);
      await docker(["stop", "--timeout", "2", container]);
      await docker(["rm", container]);
    }
  },
);
