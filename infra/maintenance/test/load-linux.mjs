import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { competitionChecks } from "/workspace/test/integration/competition.checks.js";

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  assert.ok(Buffer.byteLength(input) <= 8192);
}
const settings = JSON.parse(input);
assert.ok(["load", "race-load", "load-soak"].includes(settings.suite));
for (const [name, user] of [
  ["owner", "ingenium_schema_owner"],
  ["api", "ingenium_api"],
]) {
  const url = new URL(settings[name]);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "5432");
  assert.equal(url.username, user);
  assert.equal(url.pathname, "/ingenium_schema_test");
}
assert.equal(process.platform, "linux");
assert.equal(process.getuid(), 1000);
process.env.INGENIUM_TEST_SUITE = settings.suite;
if (settings.generator) { assert.match(settings.generator, /^ingenium-load-[0-9a-f-]{36}$/); process.env.INGENIUM_LOAD_GENERATOR = settings.generator; }
await test(
  `${settings.suite} uses Linux loopback and disposable synthetic data`,
  { timeout: settings.suite === "load-soak" ? 4000000 : 480000 },
  async (t) => {
    await competitionChecks(t, settings.owner, settings.api);
  },
);
const report = await readFile(
  `/workspace/test-results/${settings.suite !== "race-load" ? "local-load" : "race-load"}.json`,
);
assert.ok(report.length <= 16384);
console.log(`INGENIUM_LOAD_REPORT ${report.toString("base64")}`);
