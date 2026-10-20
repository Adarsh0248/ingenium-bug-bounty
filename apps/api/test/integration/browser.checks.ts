import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { newAccessCode, newProof, sha256 } from "../../src/access/credentials.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";

interface Team { id: string; first: string; second: string; code: string; credentialId: string; }
const ORIGIN = "https://ingenium.test";

export async function browserChecks(t: TestContext, owner: Pool, api: Pool, delivery: SessionDelivery, fixture: () => Promise<Team>): Promise<void> {
  const settings = { mode: "production" as const, origin: ORIGIN, cookieKey: randomBytes(32), csrfKey: randomBytes(32) };
  const policy = browserPolicy(settings);
  let healthy = true;
  const clock = { assertHealthy() { if (!healthy) throw new AccessError("CLOCK_UNTRUSTED"); }, async verify() {}, fault() {} };
  const create = () => buildApp({ database: { async check() {}, async close() {} }, entry: { pool: api, clock, delivery, browser: settings } });
  const app = create();
  await app.ready();

  function browser(instance = app, origin = ORIGIN) {
    const cookies = new Map<string, string>();
    async function send(url: string, options: { body?: unknown; raw?: Buffer | string; token?: string; origin?: string | null; headers?: Record<string, string>; method?: "GET" | "POST" } = {}) {
      const method = options.method ?? (options.body !== undefined || options.raw !== undefined ? "POST" : "GET");
      const headers: Record<string, string> = { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join(";"), ...options.headers };
      if (options.origin !== null) headers.origin = options.origin ?? origin;
      if (method === "POST") headers["content-type"] ??= "application/json";
      if (options.token !== undefined) headers["x-csrf-token"] = options.token;
      const response = await instance.inject({ method, url, headers,
        ...(options.raw !== undefined ? { payload: options.raw } : options.body !== undefined ? { payload: JSON.stringify(options.body) } : {}) });
      const lines = response.headers["set-cookie"];
      for (const line of typeof lines === "string" ? [lines] : lines ?? []) {
        const pair = line.slice(0, line.indexOf(";"));
        const equals = pair.indexOf("=");
        cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
      }
      return response;
    }
    async function start(code: string) {
      const bootstrap = await send("/api/v1/bootstrap?audience=ANONYMOUS");
      assert.equal(bootstrap.statusCode, 200);
      const verified = await send("/api/v1/entry/verify", { body: { code }, token: bootstrap.json().data.csrf_token });
      assert.equal(verified.statusCode, 200);
      return verified.json().data;
    }
    return { cookies, send, start };
  }

  try {
    await t.test("HTTP code entry and two independent member languages use secure cookies, never JSON secrets", async () => {
      const team = await fixture(), first = browser(), second = browser();
      const entry = await first.start(team.code), otherEntry = await second.start(team.code);
      assert.deepEqual(entry.flow.members.map((member: { id: string }) => member.id).sort(), [team.first, team.second].sort());
      const a = await first.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "cpp", request_key: randomUUID() }, token: entry.csrf_token });
      const b = await second.send("/api/v1/entry/activate", { body: { member_id: team.second, language: "python", request_key: randomUUID() }, token: otherEntry.csrf_token });
      assert.equal(a.statusCode, 200); assert.equal(b.statusCode, 200);
      assert.equal(a.json().data.session.language, "cpp"); assert.equal(b.json().data.session.language, "python");
      for (const response of [a, b]) {
        assert.equal(response.headers["cache-control"], "no-store");
        assert.equal(response.headers["x-content-type-options"], "nosniff");
        assert.match(String(response.headers["content-security-policy"]), /default-src 'none'/);
        assert.match(String(response.headers["strict-transport-security"]), /max-age=31536000/);
        assert.equal(response.headers["access-control-allow-origin"], undefined);
        assert.doesNotMatch(response.body, /proofCookie|sessionCookie|verifier|ciphertext|credential_id|v1\.[0-9a-f-]{36}\./);
        const lines = response.headers["set-cookie"];
        for (const line of typeof lines === "string" ? [lines] : lines ?? []) {
          assert.match(line, /; Secure/); assert.match(line, /; HttpOnly/); assert.match(line, /; SameSite=Strict/); assert.match(line, /; Path=\//);
          assert.doesNotMatch(line, /; Domain=/);
        }
      }
      const snapshot = await first.send("/api/v1/bootstrap?audience=PARTICIPANT");
      assert.equal(snapshot.statusCode, 200);
      assert.equal(snapshot.json().data.session.member_id, team.first);
      assert.equal((await first.send("/api/v1/bootstrap?audience=ENTRY")).statusCode, 200);
      assert.equal((await first.send("/api/v1/bootstrap?audience=PARTICIPANT", { headers: { "x-request-id": "untrusted-trace-id" } })).json().trace_id === "untrusted-trace-id", false);
    });

    await t.test("HTTP lost-response recovery after restart redelivers exactly one original cookie without renewing activity", async () => {
      const team = await fixture(), client = browser(), entry = await client.start(team.code);
      const body = { member_id: team.first, language: "javascript", request_key: randomUUID() };
      const replies = await Promise.all([client.send("/api/v1/entry/activate", { body, token: entry.csrf_token }), client.send("/api/v1/entry/activate", { body, token: entry.csrf_token })]);
      assert.ok(replies.every((reply) => reply.statusCode === 200));
      const original = client.cookies.get(policy.names.participant);
      const sessionId = replies[0]!.json().data.session.session_id;
      const before = (await owner.query("SELECT last_activity_at,absolute_expires_at FROM participant_sessions WHERE id=$1", [sessionId])).rows;
      const restarted = create();
      try {
        const reloaded = browser(restarted);
        for (const [key, value] of client.cookies) if (key !== policy.names.participant) reloaded.cookies.set(key, value);
        const bootstrap = await reloaded.send("/api/v1/bootstrap?audience=ENTRY");
        assert.equal(bootstrap.statusCode, 200);
        const recovered = await reloaded.send("/api/v1/entry/recover", { body: {}, token: bootstrap.json().data.csrf_token });
        assert.equal(recovered.statusCode, 200);
        assert.equal(reloaded.cookies.get(policy.names.participant), original);
        assert.equal(recovered.json().data.session.session_id, sessionId);
        assert.deepEqual((await owner.query("SELECT last_activity_at,absolute_expires_at FROM participant_sessions WHERE id=$1", [sessionId])).rows, before);
        assert.equal((await owner.query("SELECT count(*)::integer AS count FROM participant_sessions WHERE member_id=$1", [team.first])).rows[0].count, 1);
      } finally { await restarted.close(); }
    });

    await t.test("HTTP participant keep-alive binds the exact session and CSRF audience, with immutable outcome reads", async () => {
      const team = await fixture(), client = browser(), entry = await client.start(team.code);
      const active = await client.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "cpp", request_key: randomUUID() }, token: entry.csrf_token });
      assert.equal(active.statusCode, 200);
      const data = active.json().data, body = { session_id: data.session.session_id, request_key: randomUUID() };
      const before = (await owner.query("SELECT last_activity_at,absolute_expires_at FROM participant_sessions WHERE id=$1", [body.session_id])).rows[0];
      assert.equal(new Date(data.session.expires_at).getTime() - new Date(data.session.warning_at).getTime(), 300000);
      for (const token of [undefined, entry.csrf_token, "forged"]) assert.equal((await client.send("/api/v1/participant/keep-alive", { body, token })).statusCode, 403);
      assert.equal((await client.send("/api/v1/participant/keep-alive", { body, token: data.csrf_token, origin: "https://evil.test" })).statusCode, 403);
      assert.equal((await client.send("/api/v1/participant/keep-alive", { body: { ...body, session_id: randomUUID() }, token: data.csrf_token })).statusCode, 401);
      const missing = await client.send(`/api/v1/participant/session-outcomes/${body.session_id}/${body.request_key}`);
      assert.deepEqual(missing.json().data, { status: "NOT_OBSERVED", receipt: null });
      const kept = await client.send("/api/v1/participant/keep-alive", { body, token: data.csrf_token });
      assert.equal(kept.statusCode, 200);
      assert.equal(kept.json().data.receipt.action, "KEEP_ALIVE");
      assert.equal(kept.json().data.session.absolute_expires_at, before.absolute_expires_at.toISOString());
      assert.equal(kept.headers["cache-control"], "no-store");
      assert.doesNotMatch(kept.body, /verifier|ciphertext|sessionCookie|credential_id|v1\.[0-9a-f-]{36}\./);
      const recorded = (await owner.query("SELECT last_activity_at,absolute_expires_at FROM participant_sessions WHERE id=$1", [body.session_id])).rows;
      assert.deepEqual((await client.send("/api/v1/participant/keep-alive", { body, token: data.csrf_token })).json().data, kept.json().data);
      assert.equal((await client.send(`/api/v1/participant/session-outcomes/${body.session_id}/${body.request_key}`)).json().data.status, "OBSERVED");
      await client.send("/api/v1/bootstrap?audience=PARTICIPANT");
      assert.deepEqual((await owner.query("SELECT last_activity_at,absolute_expires_at FROM participant_sessions WHERE id=$1", [body.session_id])).rows, recorded);
      assert.equal((await client.send("/api/v1/participant/logout", { body, token: data.csrf_token })).statusCode, 409);
    });

    await t.test("HTTP participant logout clears only participant entry cookies and reconciles a lost response without takeover", async () => {
      const team = await fixture(), client = browser(), teammate = browser();
      const entry = await client.start(team.code), mateEntry = await teammate.start(team.code);
      const active = await client.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "java", request_key: randomUUID() }, token: entry.csrf_token });
      const mate = await teammate.send("/api/v1/entry/activate", { body: { member_id: team.second, language: "python", request_key: randomUUID() }, token: mateEntry.csrf_token });
      const body = { session_id: active.json().data.session.session_id, request_key: randomUUID() }, token = active.json().data.csrf_token;
      const lost = browser();
      for (const [key, value] of client.cookies) lost.cookies.set(key, value);
      assert.equal((await client.send("/api/v1/participant/logout", { body, token: entry.csrf_token })).statusCode, 403);
      const logout = await client.send("/api/v1/participant/logout", { body, token });
      assert.equal(logout.statusCode, 200);
      assert.equal(logout.json().data.signed_out, true);
      assert.equal(logout.json().data.receipt.action, "LOGOUT");
      const lines = logout.headers["set-cookie"];
      for (const line of typeof lines === "string" ? [lines] : lines ?? []) {
        assert.match(line, /; HttpOnly/); assert.match(line, /; Secure/); assert.match(line, /; SameSite=Strict/);
        assert.match(line, /Expires=Thu, 01 Jan 1970/);
        assert.ok(line.startsWith(`${policy.names.participant}=`) || line.startsWith(`${policy.names.entry}=`));
      }
      assert.equal((await client.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 401);
      assert.equal((await lost.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 401);
      const receipt = await lost.send(`/api/v1/participant/session-outcomes/${body.session_id}/${body.request_key}`);
      assert.deepEqual(receipt.json().data, { status: "OBSERVED", receipt: logout.json().data.receipt });
      assert.equal((await lost.send("/api/v1/participant/keep-alive", { body: { ...body, request_key: randomUUID() }, token })).statusCode, 401);
      const retried = await lost.send("/api/v1/participant/logout", { body, token });
      assert.equal(retried.statusCode, 200);
      assert.deepEqual(retried.json().data, logout.json().data);
      assert.equal((await teammate.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 200);
      const stale = await teammate.send("/api/v1/participant/logout", { body, token: mate.json().data.csrf_token });
      assert.equal(stale.statusCode, 401); assert.equal(stale.headers["set-cookie"], undefined);
      assert.equal((await teammate.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 200);
      const another = browser(), reentry = await another.start(team.code);
      assert.equal((await another.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "c", request_key: randomUUID() }, token: reentry.csrf_token })).json().data.reason, "ALREADY_ENROLLED");
    });

    await t.test("HTTP participant commands enforce exact bodies, 16 KiB limits and current cookie authority", async () => {
      const team = await fixture(), client = browser(), entry = await client.start(team.code);
      const active = await client.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "c", request_key: randomUUID() }, token: entry.csrf_token });
      const body = { session_id: active.json().data.session.session_id, request_key: randomUUID() }, token = active.json().data.csrf_token;
      for (const url of ["/api/v1/participant/keep-alive", "/api/v1/participant/logout"]) {
        assert.equal((await client.send(url, { body: { ...body, member_id: team.first }, token })).statusCode, 400);
        assert.equal((await client.send(url, { body: { request_key: body.request_key }, token })).statusCode, 400);
        assert.equal((await client.send(url, { raw: " ".repeat(16385), token })).statusCode, 413);
        assert.equal((await client.send(url, { raw: '{"session_id":"\\ud800"}', token })).statusCode, 400);
        assert.equal((await client.send(url, { body, token, headers: { "content-encoding": "gzip" } })).statusCode, 415);
      }
      const kept = await client.send("/api/v1/participant/keep-alive", { raw: " ".repeat(8192) + JSON.stringify(body), token });
      assert.equal(kept.statusCode, 200);
      const cookie = client.cookies.get(policy.names.participant)!;
      client.cookies.set(policy.names.participant, newProof().cookie);
      assert.equal((await client.send("/api/v1/participant/logout", { body: { ...body, request_key: randomUUID() }, token })).statusCode, 403);
      client.cookies.set(policy.names.participant, cookie);
      healthy = false;
      try { assert.equal((await client.send("/api/v1/participant/logout", { body: { ...body, request_key: randomUUID() }, token })).statusCode, 503); }
      finally { healthy = true; }
      assert.equal((await client.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 200);
    });

    await t.test("HTTP origins, CSRF stages and protected browser contexts cannot be interchanged", async () => {
      const team = await fixture(), client = browser();
      const anonymous = await client.send("/api/v1/bootstrap?audience=ANONYMOUS");
      const anonymousToken = anonymous.json().data.csrf_token;
      const signedCsrf = client.cookies.get(policy.names.csrf)!;
      client.cookies.set(policy.names.csrf, "forged-secret");
      assert.equal((await client.send("/api/v1/entry/verify", { body: { code: team.code }, token: anonymousToken })).statusCode, 403);
      client.cookies.set(policy.names.csrf, signedCsrf);
      for (const options of [{ origin: "https://evil.test", token: anonymousToken }, { origin: "null", token: anonymousToken },
        { origin: null, token: anonymousToken }, {}, { token: "forged" }]) {
        const response = await client.send("/api/v1/entry/verify", { body: { code: team.code }, ...options });
        assert.equal(response.statusCode, 403);
        assert.doesNotMatch(response.body, new RegExp(team.code));
      }
      const verified = await client.send("/api/v1/entry/verify", { body: { code: team.code }, token: anonymousToken,
        origin: null, headers: { referer: `${ORIGIN}/arena` } });
      assert.equal(verified.statusCode, 200);
      const intent = { member_id: team.first, language: "c", request_key: randomUUID() };
      assert.equal((await client.send("/api/v1/entry/activate", { body: intent, token: anonymousToken })).statusCode, 403);
      const saved = client.cookies.get(policy.names.entry)!;
      client.cookies.set(policy.names.entry, newProof().cookie);
      assert.equal((await client.send("/api/v1/entry/activate", { body: intent, token: verified.json().data.csrf_token })).statusCode, 403);
      client.cookies.set(policy.names.entry, saved);
      const protectedId = client.cookies.get(policy.names.browser)!;
      client.cookies.set(policy.names.browser, randomUUID());
      assert.equal((await client.send("/api/v1/entry/activate", { body: intent, token: verified.json().data.csrf_token })).statusCode, 401);
      client.cookies.set(policy.names.browser, protectedId);
      assert.equal((await client.send("/api/v1/entry/activate", { body: intent, token: verified.json().data.csrf_token })).statusCode, 200);
      assert.equal((await client.send("/api/v1/entry/recover", { body: {}, token: anonymousToken })).statusCode, 403);
    });

    await t.test("HTTP replacement requires normal staff approval, preserves its deadline and recovers the exact new cookie", async () => {
      const team = await fixture(), original = browser(), entry = await original.start(team.code);
      const active = await original.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "cpp", request_key: randomUUID() }, token: entry.csrf_token });
      assert.equal(active.statusCode, 200);
      const client = browser(), parent = await client.start(team.code), body = { member_id: team.first, request_key: randomUUID() };
      const requested = await client.send("/api/v1/entry/replacement", { body, token: parent.csrf_token });
      assert.equal(requested.statusCode, 200);
      const limited = requested.json().data, id = limited.request.request_id;
      const proofCookie = client.cookies.get(policy.names.replacement)!;
      assert.equal(limited.request.state, "PENDING");
      assert.deepEqual(Object.keys(limited.request).sort(), ["expires_at", "request_id", "state"]);
      assert.doesNotMatch(requested.body, /proofCookie|ciphertext|verifier|credential_id|v1\.[0-9a-f-]{36}\./);
      assert.match(String(requested.headers["set-cookie"]), /; HttpOnly/); assert.match(String(requested.headers["set-cookie"]), /; Secure/);
      assert.equal((await client.send("/api/v1/entry/replacement/activate", { body: { request_key: randomUUID() }, token: parent.csrf_token })).statusCode, 403);
      assert.equal((await client.send("/api/v1/entry/replacement/activate", { body: { request_key: randomUUID() }, token: limited.csrf_token })).json().error.code, "HANDOFF_NOT_READY");
      assert.equal((await original.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 200);
      const access = newAccessCode(), actorId = randomUUID();
      await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic HTTP replacement staff','ORGANISER')", [actorId]);
      await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), actorId, access.verifier]);
      const staff = browser(), staffFlow = await staff.start(access.code);
      const signedIn = await staff.send("/api/v1/staff/entry/activate", { body: { request_key: randomUUID() }, token: staffFlow.csrf_token });
      assert.equal(signedIn.statusCode, 200);
      const token = signedIn.json().data.csrf_token, list = await staff.send("/api/v1/staff/replacements");
      assert.equal(list.statusCode, 200);
      const item = list.json().data.items.find((r: { request_id: string }) => r.request_id === id);
      assert.ok(item);
      const decision = { request_key: randomUUID(), action: "APPROVE", expected_revision: item.expected_revision, reason: "Verified " + String.fromCharCode(1).repeat(1000) };
      assert.equal((await staff.send(`/api/v1/staff/replacements/${id}/decision`, { body: decision, token: limited.csrf_token })).statusCode, 403);
      const approved = await staff.send(`/api/v1/staff/replacements/${id}/decision`, { body: decision, token });
      assert.equal(approved.statusCode, 200); assert.equal(approved.json().data.outcome, "APPLIED");
      assert.equal((await original.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 401);
      const status = await client.send("/api/v1/bootstrap?audience=REPLACEMENT");
      assert.equal(status.statusCode, 200); assert.equal(status.json().data.request.expires_at, limited.request.expires_at);
      assert.equal(status.json().data.request.state, "APPROVED");
      const activated = await client.send("/api/v1/entry/replacement/activate", { body: { request_key: randomUUID() }, token: status.json().data.csrf_token });
      assert.equal(activated.statusCode, 200); assert.equal(activated.json().data.session.language, "cpp");
      const exact = client.cookies.get(policy.names.participant), sessionId = activated.json().data.session.session_id;
      const before = (await owner.query("SELECT last_activity_at,absolute_expires_at FROM participant_sessions WHERE id=$1", [sessionId])).rows;
      const restarted = create();
      try {
        const recovered = browser(restarted);
        for (const [key, value] of client.cookies) if (key !== policy.names.participant) recovered.cookies.set(key, value);
        const bootstrap = await recovered.send("/api/v1/bootstrap?audience=REPLACEMENT");
        const result = await recovered.send("/api/v1/entry/replacement/recover", { body: {}, token: bootstrap.json().data.csrf_token });
        assert.equal(result.statusCode, 200); assert.equal(recovered.cookies.get(policy.names.participant), exact);
        assert.equal(recovered.cookies.get(policy.names.replacement), proofCookie);
        assert.equal(result.json().data.session.session_id, sessionId);
      } finally { await restarted.close(); }
      assert.deepEqual((await staff.send(`/api/v1/staff/replacements/${id}/decision`, { body: decision, token })).json().data, approved.json().data);
      assert.equal((await staff.send(`/api/v1/staff/outcomes/replacements/${decision.request_key}`)).json().data.status, "OBSERVED");
      assert.deepEqual((await owner.query("SELECT last_activity_at,absolute_expires_at FROM participant_sessions WHERE id=$1", [sessionId])).rows, before);
    });

    await t.test("HTTP replacement resumes current cookies and rejects foreign members, wrong stages and oversized requests", async () => {
      const team = await fixture(), client = browser(), entry = await client.start(team.code);
      const active = await client.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "python", request_key: randomUUID() }, token: entry.csrf_token });
      const parent = await client.start(team.code), body = { member_id: team.first, request_key: randomUUID() };
      const resumed = await client.send("/api/v1/entry/replacement", { body, token: parent.csrf_token });
      assert.equal(resumed.statusCode, 200); assert.equal(resumed.json().data.status, "RESUME");
      assert.equal(resumed.json().data.session.session_id, active.json().data.session.session_id);
      assert.equal(client.cookies.has(policy.names.replacement), false);
      const other = await fixture(), entrant = browser(), selection = await entrant.start(team.code);
      assert.equal((await entrant.send("/api/v1/entry/replacement", { body: { ...body, member_id: other.first }, token: selection.csrf_token })).statusCode, 404);
      for (const extra of [{ language: "java" }, { role: "SUPER_ADMIN" }, { expected_revision: "1" }]) {
        assert.equal((await entrant.send("/api/v1/entry/replacement", { body: { ...body, ...extra }, token: selection.csrf_token })).statusCode, 400);
      }
      assert.equal((await entrant.send("/api/v1/entry/replacement", { raw: " ".repeat(16385), token: selection.csrf_token })).statusCode, 413);
      const pending = await entrant.send("/api/v1/entry/replacement", { body, token: selection.csrf_token });
      assert.equal(pending.statusCode, 200);
      assert.equal((await entrant.send("/api/v1/staff/replacements")).statusCode, 401);
      assert.equal((await entrant.send("/api/v1/entry/replacement/activate", { body: { request_key: randomUUID(), language: "c" }, token: pending.json().data.csrf_token })).statusCode, 400);
      entrant.cookies.set(policy.names.replacement, pending.json().data.request.request_id);
      assert.equal((await entrant.send("/api/v1/entry/replacement/recover", { body: {}, token: pending.json().data.csrf_token })).statusCode, 401);
      assert.equal((await client.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 200);
    });

    await t.test("HTTP structural and byte limits reject malformed requests without enrolment or secret reflection", async () => {
      const team = await fixture(), client = browser();
      const bootstrap = await client.send("/api/v1/bootstrap?audience=ANONYMOUS");
      const token = bootstrap.json().data.csrf_token;
      for (const body of [{ code: team.code, role: "SUPER_ADMIN" }, { code: [team.code] }, { code: team.code, _csrf: token }]) {
        const response = await client.send("/api/v1/entry/verify", { body, token });
        assert.equal(response.statusCode, 400); assert.doesNotMatch(response.body, new RegExp(team.code));
      }
      assert.equal((await client.send("/api/v1/entry/verify", { raw: Buffer.from([0x7b, 0xff, 0x7d]), token })).statusCode, 400);
      assert.equal((await client.send("/api/v1/entry/verify", { raw: '{"code":"\\ud800"}', token })).statusCode, 400);
      assert.equal((await client.send("/api/v1/entry/verify", { raw: '{"__proto__":{},"code":"' + team.code + '"}', token })).statusCode, 400);
      assert.equal((await client.send("/api/v1/entry/verify", { raw: " ".repeat(4097), token })).statusCode, 413);
      assert.equal((await client.send("/api/v1/entry/verify", { body: { code: team.code }, token, headers: { "content-type": "text/plain" } })).statusCode, 415);
      assert.equal((await client.send("/api/v1/entry/verify", { body: { code: team.code }, token, headers: { "content-encoding": "gzip" } })).statusCode, 415);
      assert.equal((await client.send(`/api/v1/entry/verify?code=${team.code}`, { body: { code: team.code }, token })).statusCode, 400);
      const unknown = await client.send(`/api/v1/not-found/${team.code}`);
      assert.equal(unknown.statusCode, 404); assert.doesNotMatch(unknown.body, new RegExp(team.code));
      assert.equal((await owner.query("SELECT count(*)::integer AS count FROM entry_flows WHERE team_id=$1", [team.id])).rows[0].count, 0);
      assert.equal((await client.send("/api/v1/bootstrap?audience=STAFF")).statusCode, 401);
    });

    await t.test("HTTP foreign members, stale language changes, revoked grants and untrusted time never acquire authority", async () => {
      const team = await fixture(), other = await fixture(), client = browser(), entry = await client.start(team.code);
      const foreign = await client.send("/api/v1/entry/activate", { body: { member_id: other.first, language: "java", request_key: randomUUID() }, token: entry.csrf_token });
      assert.equal(foreign.statusCode, 404);
      assert.equal(foreign.json().error.outcome, "NOT_PROCESSED");
      const intent = { member_id: team.first, language: "java", request_key: randomUUID() };
      assert.equal((await client.send("/api/v1/entry/activate", { body: intent, token: entry.csrf_token })).statusCode, 200);
      const changed = await client.send("/api/v1/entry/activate", { body: { ...intent, language: "python" }, token: entry.csrf_token });
      assert.equal(changed.statusCode, 409); assert.equal(changed.json().error.code, "INTENT_KEY_REUSED");
      const another = browser(), anotherEntry = await another.start(team.code);
      const denied = await another.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "c", request_key: randomUUID() }, token: anotherEntry.csrf_token });
      assert.equal(denied.statusCode, 409); assert.equal(denied.json().data.reason, "ALREADY_ENROLLED");
      healthy = false;
      try {
        const unavailable = await client.send("/api/v1/bootstrap?audience=PARTICIPANT");
        assert.equal(unavailable.statusCode, 503); assert.equal(unavailable.json().data, undefined);
        assert.equal((await client.send("/health")).statusCode, 200);
        assert.equal((await client.send("/ready")).statusCode, 503);
      } finally { healthy = true; }
      await owner.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [team.credentialId]);
      assert.equal((await client.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 401);
      assert.equal((await client.send("/api/v1/entry/recover", { body: {}, token: entry.csrf_token })).statusCode, 401);
    });

    await t.test("HTTP ingress uses the actual peer, persists shared read budgets and separates limited staff flows", async () => {
      const team = await fixture(), client = browser(), entry = await client.start(team.code);
      assert.equal((await client.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "c", request_key: randomUUID() }, token: entry.csrf_token })).statusCode, 200);
      await client.send("/api/v1/bootstrap?audience=PARTICIPANT", { headers: { "x-forwarded-for": "198.51.100.27" } });
      const buckets = (await owner.query("SELECT kind,rate,burst FROM quota_buckets WHERE kind IN ('HTTP_GLOBAL','HTTP_IP','READ_MEMBER') GROUP BY kind,rate,burst ORDER BY kind")).rows;
      assert.deepEqual(buckets, [{ kind: "HTTP_GLOBAL", rate: 12000, burst: 600 }, { kind: "HTTP_IP", rate: 6000, burst: 400 }, { kind: "READ_MEMBER", rate: 600, burst: 30 }]);
      assert.equal((await owner.query("SELECT count(*)::integer AS count FROM quota_buckets WHERE kind='HTTP_IP'")).rows[0].count, 1);
      const credential = newAccessCode(), staffId = randomUUID();
      await owner.query("INSERT INTO staff_identities (id,display_name,role) VALUES ($1,'Synthetic HTTP staff','ORGANISER')", [staffId]);
      await owner.query("INSERT INTO access_credentials (id,staff_id,verifier,version,issued_at) VALUES ($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), staffId, credential.verifier]);
      const staff = browser(), anonymous = await staff.send("/api/v1/bootstrap?audience=ANONYMOUS");
      const unavailable = await staff.send("/api/v1/entry/verify", { body: { code: credential.code }, token: anonymous.json().data.csrf_token });
      assert.equal(unavailable.statusCode, 200);
      assert.equal(unavailable.json().data.audience,"STAFF");
      assert.equal(staff.cookies.has(policy.names.staffEntry),true);
      assert.equal(staff.cookies.has(policy.names.staff),false);
      assert.equal(staff.cookies.has(policy.names.entry), false); assert.equal(staff.cookies.has(policy.names.participant), false);
    });

    await t.test("HTTP read-limit refusal is shared, bounded and never returns the private session projection", async () => {
      const team = await fixture(), client = browser(), entry = await client.start(team.code);
      assert.equal((await client.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "c", request_key: randomUUID() }, token: entry.csrf_token })).statusCode, 200);
      assert.equal((await client.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 200);
      await owner.query("UPDATE quota_buckets SET credits=0,refilled_at=date_trunc('milliseconds',clock_timestamp()),seen_at=date_trunc('milliseconds',clock_timestamp()) WHERE kind='READ_MEMBER' AND key_hash=$1", [sha256(team.first)]);
      const response = await client.send("/api/v1/bootstrap?audience=PARTICIPANT");
      assert.equal(response.statusCode, 429); assert.equal(response.headers["retry-after"], "1");
      assert.equal(response.json().data, undefined);
      assert.equal((await owner.query("SELECT count(*)::integer AS count FROM participant_sessions WHERE member_id=$1", [team.first])).rows[0].count, 1);
    });

    await t.test("HTTP refuses a 129th active request without queueing another database operation", async () => {
      const blocker = await owner.connect();
      let pending: Promise<Awaited<ReturnType<ReturnType<typeof browser>["send"]>>>[] = [];
      try {
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM quota_control WHERE id=1 FOR UPDATE");
        pending = Array.from({ length: 128 }, () => browser().send("/api/v1/bootstrap?audience=ANONYMOUS"));
        await setImmediate();
        const refused = await browser().send("/api/v1/bootstrap?audience=ANONYMOUS");
        assert.equal(refused.statusCode, 503); assert.equal(refused.json().error.code, "CAPACITY_UNAVAILABLE");
        assert.equal(refused.json().error.outcome, "NOT_PROCESSED");
      } finally {
        await blocker.query("ROLLBACK"); blocker.release();
        await Promise.all(pending);
      }
      assert.equal((await browser().send("/api/v1/bootstrap?audience=ANONYMOUS")).statusCode, 200);
    });

    await t.test("explicit loopback HTTP uses distinct development cookies without weakening production policy", async () => {
      const localSettings = { ...settings, mode: "loopback" as const, origin: "http://127.0.0.1:3000" };
      const local = buildApp({ database: { async check() {}, async close() {} }, entry: { pool: api, clock, delivery, browser: localSettings } });
      try {
        const team = await fixture(), client = browser(local, localSettings.origin), entry = await client.start(team.code);
        const response = await client.send("/api/v1/entry/activate", { body: { member_id: team.first, language: "cpp", request_key: randomUUID() }, token: entry.csrf_token });
        assert.equal(response.statusCode, 200);
        const header = String(response.headers["set-cookie"]);
        assert.match(header, /^ingenium_local_participant=/);
        assert.doesNotMatch(header, /; Secure|__Host-/);
        assert.match(header, /; HttpOnly/); assert.match(header, /; SameSite=Strict/);
        assert.equal(response.headers["strict-transport-security"], undefined);
        assert.equal((await client.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode, 200);
      } finally { await local.close(); }
    });
  } finally { await app.close(); }
}
