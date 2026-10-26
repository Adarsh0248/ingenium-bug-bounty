import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("candidate image runs fifteen exact trusted answers with all five actual toolchains while normal capsule entry refuses", { timeout: 90000 }, async () => {
  const image = process.env.INGENIUM_TEST_IMAGE; assert.match(image ?? "", /^sha256:[0-9a-f]{64}$/, "Pass an explicit candidate image ID; never a moving tag.");
  const exec = promisify(execFile), docker = async (args: string[]) => (await exec("docker", args, { timeout: 60000, maxBuffer: 32768, windowsHide: true })).stdout.trim();
  const nonce = randomUUID(), fixture = fileURLToPath(new URL("../../../../infra/judge-gateway/test/toolchains-linux.mjs", import.meta.url));
  const id = await docker(["create", "--pull=never", "--name", `ingenium-toolchain-test-${nonce}`, "--label", `ingenium.toolchain-test=${nonce}`,
    "--network", "none", "--read-only", "--user", "65534:65534", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true", "--restart", "no",
    "--memory", "768m", "--memory-swap", "768m", "--cpus", "0.75", "--pids-limit", "64", "--log-driver", "none",
    "--tmpfs", "/work:rw,nosuid,nodev,exec,size=64m,nr_inodes=256,uid=65534,gid=65534,mode=0700",
    "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=4m,nr_inodes=64,uid=65534,gid=65534,mode=0700",
    "--mount", `type=bind,src=${fixture},dst=/fixture/toolchains-linux.mjs,readonly`, "--entrypoint", "/usr/local/bin/node", image!, "/fixture/toolchains-linux.mjs"]);
  assert.match(id, /^[0-9a-f]{64}$/);
  try {
    const raw = await docker(["start", "--attach", id]); assert.ok(raw.startsWith("INGENIUM_TOOLCHAIN_REPORT "));
    const report = JSON.parse(raw.slice("INGENIUM_TOOLCHAIN_REPORT ".length));
    assert.equal(report.host_verified, false); assert.equal(report.results.length, 5); assert.ok(report.results.every((v: any) => v.exact_answers === 3));
    assert.equal(Object.keys(report.binaries).length, 8); assert.equal(report.gcc_error_json, true); assert.equal(report.capsule_refusal, true);
    const directory = fileURLToPath(new URL("../../test-results/", import.meta.url)); await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/toolchain-candidate-${nonce}.json`, JSON.stringify({ ...report, image_id: image }, null, 2) + "\n", { flag: "wx" });
  } finally {
    const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", id]));
    assert.equal(config.Image, image); assert.equal(config.Labels["ingenium.toolchain-test"], nonce);
    await docker(["stop", "--timeout", "2", id]); await docker(["rm", id]);
  }
});
