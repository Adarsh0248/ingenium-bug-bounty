import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  parseCompetitionRuntime,
  parseWorkerRuntime,
} from "../src/worker/config.js";
import { runtimeRecord } from "../src/content/judge-protocol.js";
import { judgeRuntimes } from "./fixtures/judge.js";
import { privateRuntimeJson } from "../src/runtime/private-file.js";
import { loadConfig } from "../src/config.js";

const descriptor = () => ({
  host_epoch_id: randomUUID(),
  endpoint_ref: "synthetic-worker",
  runtimes: runtimeRecord(judgeRuntimes()),
});
function worker() {
  return {
    schema_version: 1,
    database_url:
      "postgresql://synthetic_worker:synthetic_password@127.0.0.1/worker_test",
    judge: descriptor(),
    tls: {
      address: "10.42.0.5",
      port: 9443,
      server_name: "judge.test",
      server_certificate_sha256: "a".repeat(64),
      ca_pem: "SYNTHETIC",
      certificate_pem: "SYNTHETIC",
      private_key_pem: "SYNTHETIC",
    },
  };
}
test("worker configuration pins five runtimes, private TLS and separate loopback credentials without browser overrides", () => {
  const input = worker(),
    config = parseWorkerRuntime(input);
  assert.equal(config.driver.runtimes.size, 5);
  assert.equal(config.driver.address, "10.42.0.5");
  for (const patch of [
    { schema_version: 2 },
    { fake_driver: true },
    { database_url: "postgresql://ingenium_api:password@127.0.0.1/db" },
    { database_url: "postgresql://worker:password@example.com/db" },
    { database_url: `${input.database_url}?options=-c%20role%3Downer` },
    { tls: { ...input.tls, address: "169.254.169.254" } },
    { tls: { ...input.tls, port: "9443" } },
    { tls: { ...input.tls, private_key_pem: "x".repeat(32769) } },
    {
      judge: {
        ...input.judge,
        runtimes: { ...input.judge.runtimes, python: undefined },
      },
    },
    {
      judge: {
        ...input.judge,
        runtimes: { ...input.judge.runtimes, rust: {} },
      },
    },
  ])
    assert.throws(() => parseWorkerRuntime({ ...input, ...patch }));
  input.judge.runtimes.cpp!.digest = "b".repeat(64);
  assert.notEqual(
    config.driver.runtimes.get("cpp")!.digest,
    input.judge.runtimes.cpp!.digest,
  );
});
test("API competition configuration has a distinct draw purpose and rejects worker TLS/DB secrets", () => {
  const input = {
    schema_version: 1,
    judge: descriptor(),
    draw_key: randomBytes(32).toString("hex"),
    draw_key_id: "event-draw-v1",
  };
  const config = parseCompetitionRuntime(input);
  assert.equal(config.drawKey.length, 32);
  assert.equal("privateKey" in config, false);
  for (const patch of [
    { draw_key: "short" },
    { draw_key_id: "" },
    { private_key_pem: "not-for-api" },
    { database_url: worker().database_url },
    { bypass_readiness: true },
  ])
    assert.throws(() => parseCompetitionRuntime({ ...input, ...patch }));
});
test("competition runtime cannot be enabled without protected entry, and Windows cannot pretend to validate Linux private files", async () => {
  const env = {
    DATABASE_URL: worker().database_url,
    COMPETITION_RUNTIME_FILE:
      process.platform === "win32"
        ? "C:\\private\\competition.json"
        : "/etc/ingenium/competition.json",
  };
  assert.throws(() => loadConfig(env), /COMPETITION_RUNTIME_FILE/);
  assert.ok(
    loadConfig({ ...env, ENTRY_RUNTIME_FILE: env.COMPETITION_RUNTIME_FILE })
      .competitionRuntimeFile,
  );
  await assert.rejects(privateRuntimeJson("relative-file.json", 4096));
  if (process.platform !== "linux")
    await assert.rejects(
      privateRuntimeJson(env.COMPETITION_RUNTIME_FILE, 8192),
      /Restricted Linux/,
    );
});
