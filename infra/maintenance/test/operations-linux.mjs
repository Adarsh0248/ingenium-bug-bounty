import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, chown, mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { migrateDatabase } from "/workspace/apps/api/dist/db/migrate.js";

const require = createRequire("/workspace/apps/api/package.json");
const { Pool } = require("pg");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  assert.ok(Buffer.byteLength(input) <= 8192);
}
const settings = JSON.parse(input);
const root = "/run/operations-fixture";
await mkdir(root, { mode: 0o700 });
for (const name of ["owner", "api"]) {
  await writeFile(
    `${root}/${name}.json`,
    JSON.stringify({ schema_version: 1, database_url: settings[name] }),
    { mode: 0o600 },
  );
  await chown(`${root}/${name}.json`, 1000, 1000);
}
await chown(root, 1000, 1000);
process.setgid(1000);
process.setuid(1000);
const exec = promisify(execFile);
const owner = new Pool({ connectionString: settings.owner, max: 1 });
const key = randomUUID();
const cli = async (name, args, expectedCode = 0) => {
  try {
    const reply = await exec(
      process.execPath,
      [`/workspace/apps/api/dist/maintenance/${name}-cli.js`, ...args],
      {
        env: { PATH: "/usr/local/bin:/usr/bin:/bin" },
        timeout: 45000,
        maxBuffer: 32768,
      },
    );
    assert.equal(expectedCode, 0);
    return JSON.parse(reply.stdout.split("\n")[0]);
  } catch (error) {
    assert.equal(error.code, expectedCode);
    if (expectedCode === 1) return;
    return JSON.parse(error.stdout.split("\n")[0]);
  }
};
try {
  await migrateDatabase(settings.owner);
  const initial = await cli("operations", ["--runtime", `${root}/api.json`], 2);
  assert.equal(initial.quarantined, false);
  assert.notEqual(initial.state, "OK");
  assert.ok(initial.unverified.includes("HOST_CPU_MEMORY_DISK"));
  const args = ["--runtime", `${root}/owner.json`, "--request-key", key];
  const receipt = await cli("restore", [
    ...args,
    "--confirm",
    "ISOLATED_RESTORE_QUARANTINE",
    "--backup-ref",
    "Synthetic isolated host rehearsal",
    "--operator",
    "Synthetic operator",
    "--reason",
    "Test-only quarantine, never production admission",
  ]);
  assert.equal(receipt.admission_authorised, false);
  const duplicate = await cli("restore", [...args, "--status"]);
  assert.equal(duplicate.status, "RECORDED");
  assert.equal(duplicate.outcome.request_key, receipt.request_key);
  assert.deepEqual(duplicate.outcome.effects, receipt.effects);
  const inventory = await cli("restore", [...args, "--inspect"]);
  assert.equal(inventory.admission_authorised, false);
  const observation = await cli(
    "operations",
    ["--runtime", `${root}/api.json`],
    2,
  );
  assert.equal(observation.quarantined, true);
  assert.equal(observation.state, "CRITICAL");
  await cli("restore", [...args, "--inspect", "--status"], 1);
  await cli(
    "restore",
    ["--runtime", `${root}/api.json`, "--request-key", key, "--inspect"],
    1,
  );
  await chmod(`${root}/api.json`, 0o644);
  await cli("operations", ["--runtime", `${root}/api.json`], 1);
  await chmod(`${root}/api.json`, 0o600);
  const state = (
    await owner.query("SELECT count(*)::int n FROM restore_quarantine")
  ).rows[0];
  assert.equal(state.n, 1);
  console.log(
    JSON.stringify({
      state: "PASSED",
      linux_nonroot_cli: true,
      private_runtime_permissions: true,
      migrations_applied: true,
      original_quarantine_receipt: true,
      readonly_inventory: true,
      observer_never_all_clear: true,
      admission_allowed: false,
      live_deployment_verified: false,
    }),
  );
} catch {
  console.error(
    "FAIL: isolated Linux operator rehearsal; preserve its test containers. No private settings are printed.",
  );
  process.exitCode = 1;
} finally {
  await owner.end();
}
