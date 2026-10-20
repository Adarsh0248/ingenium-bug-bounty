import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../src/app.js";

test("health reports API liveness without querying PostgreSQL", async (t) => {
  let checks = 0;
  const app = buildApp({ database: {
    async check() { checks += 1; throw new Error("Database is down"); },
    async close() {},
  } });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(checks, 0);
});

test("readiness checks PostgreSQL and returns a bounded response", async (t) => {
  let checks = 0;
  const app = buildApp({ database: {
    async check() { checks += 1; },
    async close() {},
  } });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ready" });
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(checks, 1);
});

test("database failure returns 503 without exposing the connection error", async (t) => {
  const app = buildApp({ database: {
    async check() { throw new Error("postgresql://private-user:private-password@private-host/private-db"); },
    async close() {},
  } });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { status: "not_ready" });
  assert.doesNotMatch(response.body, /private-/);
});

test("readiness can recover on a later request without restarting the API", async (t) => {
  let available = false;
  const app = buildApp({ database: {
    async check() { if (!available) throw new Error("Database is down"); },
    async close() {},
  } });
  t.after(() => app.close());

  assert.equal((await app.inject({ method: "GET", url: "/ready" })).statusCode, 503);
  available = true;
  assert.equal((await app.inject({ method: "GET", url: "/ready" })).statusCode, 200);
});

test("closing the application releases its database pool", async () => {
  let closes = 0;
  const app = buildApp({ database: {
    async check() {},
    async close() { closes += 1; },
  } });

  await app.ready();
  await app.close();
  assert.equal(closes, 1);
});

test("normal startup cannot expose entry routes without explicit security dependencies", async (t) => {
  const app = buildApp({ database: { async check() {}, async close() {} } });
  t.after(() => app.close());
  assert.equal((await app.inject({ method: "GET", url: "/api/v1/bootstrap?audience=ANONYMOUS" })).statusCode, 404);
});

test("the redacted runtime logger configuration starts successfully", async (t) => {
  const app = buildApp({ logger: true, database: { async check() {}, async close() {} } });
  t.after(() => app.close());
  assert.equal((await app.inject({ method: "GET", url: "/health" })).statusCode, 200);
});
