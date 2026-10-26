import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkedImageTree, hashImageStream } from "../../src/judge/image-stream.js";

const IMAGE = "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const SOURCE = "docker.io/library/redis:7.2.16-bookworm@sha256:6510e071eecd994fb187c15f126d424a293006669f590da800ca4a06564ae7d0";
const exec = promisify(execFile);
const CLI = (await exec(process.platform === "win32" ? "where.exe" : "which", ["docker"], { windowsHide: true })).stdout.trim().split(/\r?\n/)[0]!;
const docker = async (args: string[]) => (await exec("docker", args, { timeout: 45000, maxBuffer: 65536, windowsHide: true })).stdout.trim();
test("a never-started real image has a stable tree digest across two streamed Docker exports", { timeout: 180000 }, async () => {
  const nonce = randomUUID(), ids = new Map<string, string>();
  const script = fileURLToPath(new URL("../../../../infra/judge-gateway/image-tree.py", import.meta.url));
  try {
    const source = await docker(["create", "--pull=never", "--name", `ingenium-image-source-${nonce}`, "--label", `ingenium.image-test=${nonce}`,
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true", "--restart", "no",
      "--tmpfs", "/data:ro,nosuid,nodev,noexec,size=4k", "--entrypoint", "/does-not-exist", SOURCE]);
    assert.match(source, /^[0-9a-f]{64}$/); ids.set(source, SOURCE);
    const reader = await docker(["create", "--pull=never", "-i", "--name", `ingenium-image-reader-${nonce}`, "--label", `ingenium.image-test=${nonce}`,
      "--network", "none", "--read-only", "--user", "65534:65534", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true", "--restart", "no",
      "--memory", "512m", "--memory-swap", "512m", "--cpus", "1", "--pids-limit", "16", "--log-driver", "none",
      "--mount", `type=bind,src=${script},dst=/image-tree.py,readonly`, "--entrypoint", "/usr/bin/python3", IMAGE, "-I", "/image-tree.py"]);
    assert.match(reader, /^[0-9a-f]{64}$/); ids.set(reader, IMAGE);
    const observe = () => hashImageStream({ file: CLI, args: ["export", source] },
      { file: CLI, args: ["start", "--attach", "--interactive", reader] }, AbortSignal.timeout(75000));
    const first = JSON.parse((await observe()).toString("utf8"));
    const proof = checkedImageTree(Buffer.from(JSON.stringify(first)), first.tree_sha256);
    assert.ok((proof.files as number) > 1000); assert.ok((proof.data_bytes as number) > 1000000);
    assert.deepEqual(JSON.parse((await observe()).toString("utf8")), first);
    const state = JSON.parse(await docker(["inspect", "--format", "{{json .State}}", source]));
    assert.equal(state.Status, "created"); assert.equal(state.Pid, 0); assert.equal(state.StartedAt, "0001-01-01T00:00:00Z");
  } finally {
    for (const [id, image] of [...ids].reverse()) {
      const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", id]));
      assert.equal(config.Image, image); assert.equal(config.Labels["ingenium.image-test"], nonce);
      await docker(["stop", "--timeout", "2", id]); await docker(["rm", id]);
    }
  }
});
