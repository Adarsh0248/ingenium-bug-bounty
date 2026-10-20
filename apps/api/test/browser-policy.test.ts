import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { browserPolicy, boundedCookies, csrfContext, requestOrigin } from "../src/access/browser-policy.js";
import { newProof } from "../src/access/credentials.js";

const keys = () => ({ cookieKey: randomBytes(32), csrfKey: randomBytes(32) });

test("production cookies have host-only secure settings and development must explicitly use a loopback origin", () => {
  const key = keys();
  const policy = browserPolicy({ mode: "production", origin: "https://ingenium.test", ...key });
  assert.deepEqual(policy.cookie, { path: "/", httpOnly: true, sameSite: "strict", secure: true });
  assert.ok(Object.values(policy.names).every((name) => name.startsWith("__Host-")));
  assert.equal(browserPolicy({ mode: "loopback", origin: "http://127.0.0.1:3000", ...key }).cookie.secure, false);
  for (const settings of [
    { mode: "production" as const, origin: "http://ingenium.test" },
    { mode: "loopback" as const, origin: "http://ingenium.test" },
    { mode: "loopback" as const, origin: "http://127.0.0.1.evil.test" },
    { mode: "production" as const, origin: "https://ingenium.test/" },
    { mode: "production" as const, origin: "https://user@ingenium.test" },
  ]) assert.throws(() => browserPolicy({ ...settings, ...key }));
  assert.throws(() => browserPolicy({ mode: "production", origin: policy.origin, cookieKey: key.cookieKey, csrfKey: key.cookieKey }));
  assert.throws(() => browserPolicy({ mode: "production", origin: policy.origin, cookieKey: randomBytes(16), csrfKey: key.csrfKey }));
});

test("writes require an exact Origin or parsed same-origin Referer, never null, suffix matches or forwarded headers", () => {
  const policy = browserPolicy({ mode: "production", origin: "https://ingenium.test", ...keys() });
  requestOrigin({ method: "POST", headers: { origin: policy.origin } }, policy);
  requestOrigin({ method: "POST", headers: { referer: `${policy.origin}/arena?panel=entry` } }, policy);
  for (const headers of [{}, { origin: "null" }, { origin: "https://ingenium.test.evil.test" }, { origin: `${policy.origin}/` },
    { origin: "https://evil.test", referer: `${policy.origin}/` }, { referer: "https://ingenium.test@evil.test/" },
    { referer: "https://evil.test/ingenium.test" }, { referer: "https://user:pass@ingenium.test/" },
    { "x-forwarded-host": "ingenium.test", "x-forwarded-proto": "https" }]) assert.throws(() => requestOrigin({ method: "POST", headers }, policy), /ORIGIN_DENIED/);
  assert.throws(() => requestOrigin({ method: "GET", headers: { "sec-fetch-site": "cross-site" } }, policy), /ORIGIN_DENIED/);
});

test("CSRF contexts bind audience, protected browser and exact credential without exposing its secret", () => {
  const policy = browserPolicy({ mode: "production", origin: "https://ingenium.test", ...keys() });
  const id = randomUUID(), proof = newProof().cookie;
  const values = [csrfContext(policy, "ANONYMOUS", id), csrfContext(policy, "ENTRY", id, proof),
    csrfContext(policy, "PARTICIPANT", id, proof), csrfContext(policy, "ENTRY", randomUUID(), proof),
    csrfContext(policy, "ENTRY", id, newProof().cookie), csrfContext(policy, "REPLACEMENT", id, proof)];
  assert.equal(new Set(values).size, 6);
  assert.ok(values.every((value) => !value.includes(proof)));
  assert.throws(() => csrfContext(policy, "ENTRY", id), /INVALID_AUTHORITY/);
});

test("duplicate application cookies and oversized cookie headers are rejected before lookup", () => {
  const policy = browserPolicy({ mode: "production", origin: "https://ingenium.test", ...keys() });
  boundedCookies({ headers: { cookie: `${policy.names.entry}=first; unrelated=x` } }, policy);
  assert.throws(() => boundedCookies({ headers: { cookie: `${policy.names.entry}=first; ${policy.names.entry}=second` } }, policy), /INVALID_HEADERS/);
  assert.throws(() => boundedCookies({ headers: { cookie: "x".repeat(8193) } }, policy), /INVALID_HEADERS/);
});
