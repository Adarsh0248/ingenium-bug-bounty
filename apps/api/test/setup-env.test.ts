import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { parseEnv } from "node:util";

async function fixture(t: TestContext) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, "ingenium-env-test-"));
  assert.equal(dirname(resolve(directory)), parent);
  assert.ok(basename(directory).startsWith("ingenium-env-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "scripts"));
  await copyFile(new URL("../../../scripts/setup-env.mjs", import.meta.url), join(directory, "scripts/setup-env.mjs"));
  await copyFile(new URL("../../../.env.example", import.meta.url), join(directory, ".env.example"));
  await copyFile(new URL("../../../.env.database.example", import.meta.url), join(directory, ".env.database.example"));
  return directory;
}

function runSetup(directory: string) {
  return spawnSync(process.execPath, [join(directory, "scripts/setup-env.mjs")], {
    cwd: directory,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 64 * 1024,
  });
}

test("environment setup creates separate random owner/API passwords without printing them", async (t) => {
  const directory = await fixture(t);
  const result = runSetup(directory);
  assert.equal(result.status, 0, result.stderr);
  const api = parseEnv(await readFile(join(directory, ".env"), "utf8"));
  const database = parseEnv(await readFile(join(directory, ".env.database"), "utf8"));
  const url = new URL(api.DATABASE_URL!);

  assert.equal(url.username, "ingenium_api");
  assert.equal(url.password, database.POSTGRES_API_PASSWORD);
  assert.match(database.POSTGRES_PASSWORD!, /^[a-f0-9]{48}$/);
  assert.match(url.password, /^[a-f0-9]{48}$/);
  assert.notEqual(url.password, database.POSTGRES_PASSWORD);
  assert.equal(api.POSTGRES_PASSWORD, undefined);
  assert.ok(!result.stdout.includes(url.password));
  assert.ok(!result.stdout.includes(database.POSTGRES_PASSWORD!));
});

test("running environment setup again preserves both existing files", async (t) => {
  const directory = await fixture(t);
  assert.equal(runSetup(directory).status, 0);
  const apiBefore = await readFile(join(directory, ".env"), "utf8");
  const databaseBefore = await readFile(join(directory, ".env.database"), "utf8");

  assert.equal(runSetup(directory).status, 0);
  assert.equal(await readFile(join(directory, ".env"), "utf8"), apiBefore);
  assert.equal(await readFile(join(directory, ".env.database"), "utf8"), databaseBefore);
});

for (const existingFile of [".env", ".env.database"]) {
  test(`an incomplete environment pair preserves ${existingFile} and stops for review`, async (t) => {
    const directory = await fixture(t);
    await writeFile(join(directory, existingFile), "EXISTING=value\n");
    const missingFile = existingFile === ".env" ? ".env.database" : ".env";

    const result = runSetup(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Only one environment file exists/);
    assert.equal(await readFile(join(directory, existingFile), "utf8"), "EXISTING=value\n");
    await assert.rejects(readFile(join(directory, missingFile)), { code: "ENOENT" });
  });
}
