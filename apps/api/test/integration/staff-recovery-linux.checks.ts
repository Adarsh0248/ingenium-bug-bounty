import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";
import { migrateDatabase } from "../../src/db/migrate.js";

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

export async function staffRecoveryLinuxChecks(
  t: TestContext,
  ownerConnection: string,
  apiConnection: string,
  databaseContainer: string,
) {
  await t.test(
    "real restricted Linux operator CLI creates, resumes, rotates and retires synthetic Super Admin access on disposable PostgreSQL",
    async () => {
      assert.match(databaseContainer, /^[a-f0-9]{64}$/);
      await exec(
        process.execPath,
        [
          fileURLToPath(
            new URL(
              "../../../../node_modules/typescript/bin/tsc",
              import.meta.url,
            ),
          ),
          "-p",
          fileURLToPath(new URL("../../tsconfig.build.json", import.meta.url)),
        ],
        { timeout: 45000, maxBuffer: 32768, windowsHide: true },
      );
      const name = `ingenium_cli_${randomUUID().replaceAll("-", "")}`,
        db = new Client({ connectionString: ownerConnection });
      await db.connect();
      try {
        await db.query(`CREATE DATABASE "${name}"`);
      } finally {
        await db.end();
      }
      const owner = new URL(ownerConnection),
        api = new URL(apiConnection);
      owner.pathname = api.pathname = `/${name}`;
      await migrateDatabase(owner.toString());
      owner.port = api.port = "5432";
      const nonce = randomUUID();
      const bindings = [
        ["../../dist", "/workspace/apps/api/dist"],
        ["../../../../node_modules", "/workspace/node_modules"],
        ["../../package.json", "/workspace/apps/api/package.json"],
        [
          "../../../../infra/maintenance/test/staff-recovery-linux.mjs",
          "/fixture/test.mjs",
        ],
      ].flatMap(([path, target]) => [
        "--mount",
        `type=bind,src=${fileURLToPath(new URL(path!, import.meta.url))},dst=${target},readonly`,
      ]);
      const container = await docker([
        "create",
        "--pull=never",
        "--name",
        `ingenium-operator-test-${nonce}`,
        "--label",
        `ingenium.operator-test=${nonce}`,
        "--restart",
        "no",
        "--network",
        `container:${databaseContainer}`,
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
        "256m",
        "--memory-swap",
        "256m",
        "--cpus",
        "0.5",
        "--pids-limit",
        "48",
        "--tmpfs",
        "/run:rw,nosuid,nodev,noexec,size=4m,mode=0755",
        ...bindings,
        "--log-driver",
        "json-file",
        "--log-opt",
        "max-size=1m",
        "--log-opt",
        "max-file=1",
        "--interactive",
        "--entrypoint",
        "/usr/local/bin/node",
        IMAGE,
        "/fixture/test.mjs",
      ]);
      assert.match(container, /^[a-f0-9]{64}$/);
      try {
        const result = exec(
          "docker",
          ["start", "--attach", "--interactive", container],
          { timeout: 45000, maxBuffer: 32768, windowsHide: true },
        );
        result.child.stdin!.end(
          JSON.stringify({ owner: owner.toString(), api: api.toString() }),
        );
        // Test-only credentials travel over stdin, never argv, Docker metadata or logs.
        assert.match(
          (await result).stdout,
          /PASS: restricted operator CLI lifecycle and original-candidate recovery/,
        );
      } finally {
        const config = JSON.parse(
          await docker(["inspect", "--format", "{{json .Config}}", container]),
        );
        assert.equal(config.Image, IMAGE);
        assert.equal(config.Labels["ingenium.operator-test"], nonce);
        await docker(["stop", "--timeout", "2", container]);
        await docker(["rm", container]);
      }
    },
  );
}
