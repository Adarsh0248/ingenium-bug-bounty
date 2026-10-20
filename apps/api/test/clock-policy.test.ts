import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test } from "node:test";
import { assess, integer, parseReport, SECOND } from "../src/clock/policy.js";
import type { ClockReport } from "../src/clock/policy.js";
import { parseUptime } from "../src/clock/linux-source.js";
import { parseEntrySecrets } from "../src/access/runtime.js";
import { loadConfig } from "../src/config.js";

function report(override: Partial<ClockReport> = {}): ClockReport {
  return { policy: 1, boot_id: randomUUID(), nonce: randomBytes(32).toString("base64url"), sequence: "1",
    boottime_before_ns: String(10n*SECOND), boottime_after_ns: String(10n*SECOND), realtime_ns: String(1000n*SECOND),
    system_offset_ns: "0", root_delay_ns: "0", root_dispersion_ns: "0", synchronised: true, source_ok: true, ...override };
}
const check = (value: ClockReport) => assess(value, undefined, 10n*SECOND, 10n*SECOND, 0n);

test("clock reports bind exact policy, boot, nonce and monotonic sequence with checked integer fields", () => {
  const r = report();
  assert.equal(parseReport(r, r.boot_id, r.nonce, 1n), r);
  for (const change of [{ policy: 2 }, { nonce: randomBytes(32).toString("base64url") }, { boot_id: randomUUID() },
    { sequence: "2" }, { sequence: "01" }, { root_delay_ns: "-1" }, { synchronised: "true" }, { extra: 1 }, { realtime_ns: "9223372036854775808" }]) {
    assert.throws(() => parseReport({ ...r, ...change }, r.boot_id, r.nonce, 1n));
  }
  for (const input of [0, "01", "-0", "NaN", "1e9", " 1", "-1"]) assert.throws(() => integer(input));
});

test("clock warning and error-bound thresholds use exact outward-rounded integer arithmetic", () => {
  assert.deepEqual(check(report({ system_offset_ns: "50000000" })), { warning: false, fault: null });
  assert.deepEqual(check(report({ system_offset_ns: "50000001" })), { warning: true, fault: null });
  assert.equal(check(report({ system_offset_ns: "-100000000" })).fault, null);
  assert.equal(check(report({ system_offset_ns: "100000001" })).fault, "ERROR_BOUND");
  assert.equal(check(report({ system_offset_ns: "100000000", root_delay_ns: "1" })).fault, "ERROR_BOUND");
  assert.equal(check(report({ synchronised: false })).fault, "UNSYNCHRONISED");
  assert.equal(check(report({ source_ok: false })).fault, "SOURCE_UNTRUSTED");
});

test("bracketed wall-step detection does not confuse process delays with observed clock steps", () => {
  const old = report();
  const r = { ...old, boottime_before_ns: String(15n*SECOND), boottime_after_ns: String(15n*SECOND), realtime_ns: String(1005n*SECOND) };
  assert.equal(assess(r, old, 15n*SECOND, 15n*SECOND, 0n).fault, null);
  for (const delta of [-100000000n, 100000000n]) assert.equal(assess({ ...r, realtime_ns: String(BigInt(r.realtime_ns)+delta) }, old, 15n*SECOND, 15n*SECOND, 0n).fault, "WALL_STEP");
  assert.equal(assess({ ...r, realtime_ns: String(BigInt(r.realtime_ns)+99999999n) }, old, 15n*SECOND, 15n*SECOND, 0n).fault, null);
  assert.equal(assess({ ...r, boottime_after_ns: String(15n*SECOND+20000001n) }, old, 15n*SECOND, 15n*SECOND+20000001n, 0n).fault, "MEASUREMENT_UNCERTAIN");
  assert.equal(assess(r, old, 15n*SECOND, 18n*SECOND, 0n).fault, "MEASUREMENT_UNCERTAIN");
});

test("Linux uptime parsing retains suspend-inclusive centiseconds without floating point", () => {
  assert.equal(parseUptime("123.45 678.90\n"), 123450000000n);
  assert.equal(parseUptime("0.00 0.00\n"), 0n);
  for (const value of ["123 2", "NaN 3.00", "1e9 0.00", "1.234 0.00", "-1.00 0.00", "1.00 0.00\nextra", "999999999999999999999.00 0.00"]) assert.throws(() => parseUptime(value));
});

test("entry runtime secrets are explicit, independently keyed and never inferred from a development environment", () => {
  const input = { schema_version: 1, mode: "production", origin: "https://ingenium.test", cookie_key: randomBytes(32).toString("hex"),
    csrf_key: randomBytes(32).toString("hex"), delivery_key: randomBytes(32).toString("hex"), delivery_key_id: "synthetic-v1" };
  assert.equal(parseEntrySecrets(input).browser.origin, input.origin);
  for (const change of [{ delivery_key: input.cookie_key }, { csrf_key: input.cookie_key }, { cookie_key: "replace-me" },
    { origin: "http://ingenium.test" }, { mode: "development" }, { bypass_clock: true }, { schema_version: 2 }]) assert.throws(() => parseEntrySecrets({ ...input, ...change }));
  const database = "postgresql://synthetic:synthetic@127.0.0.1:5433/synthetic";
  assert.equal(loadConfig({ DATABASE_URL: database, ENTRY_RUNTIME_FILE: resolve("synthetic-entry.json") }).entryRuntimeFile, resolve("synthetic-entry.json"));
  for (const path of ["", "relative-entry.json"]) assert.throws(() => loadConfig({ DATABASE_URL: database, ENTRY_RUNTIME_FILE: path }));
  assert.throws(() => loadConfig({ DATABASE_URL: "postgresql://synthetic:synthetic@remote.test/synthetic", ENTRY_RUNTIME_FILE: resolve("synthetic-entry.json") }));
});
