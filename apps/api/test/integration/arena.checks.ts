import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { createArenaService } from "../../src/access/arena-service.js";
import type { ArenaSetupCommand } from "../../src/access/arena-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { newAccessCode, sessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { buildApp } from "../../src/app.js";
import { migrateDatabase } from "../../src/db/migrate.js";

export async function arenaChecks(t: TestContext, ownerConnection: string, apiConnection: string) {
  const name = `ingenium_arena_${randomUUID().replaceAll("-", "")}`, bootstrap = new Client({ connectionString: ownerConnection });
  await bootstrap.connect();
  try { await bootstrap.query(`CREATE DATABASE "${name}"`); } finally { await bootstrap.end(); }
  const ownerUrl = new URL(ownerConnection), apiUrl = new URL(apiConnection); ownerUrl.pathname = apiUrl.pathname = `/${name}`;
  await migrateDatabase(ownerUrl.toString());
  const owner = new Pool({ connectionString: ownerUrl.toString(), max: 2 }), api = new Pool({ connectionString: apiUrl.toString(), max: 4 });
  let healthy = true;
  const clock = { assertHealthy() { if (!healthy) throw new AccessError("CLOCK_UNTRUSTED"); }, async verify() {}, fault() {} };
  const delivery = sessionDelivery("synthetic-arena", randomBytes(32));
  const service = createArenaService(api, clock, delivery), staff = createStaffService(api, clock, delivery), entry = createEntryService(api, clock, delivery);
  const denied = (code: string) => (e: unknown) => e instanceof AccessError && e.code === code;
  async function person(role = "OWNER") {
    const id = randomUUID(), code = newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic arena staff',$2)", [id, role]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), id, code.verifier]);
    const flow = await entry.begin(code.code, { ip: "127.0.0.1", browserId: randomUUID() });
    if (flow.audience !== "STAFF") throw new Error("Synthetic arena staff routing failed");
    return { id, code: code.code, ...await staff.activate(flow.proofCookie, randomUUID()) };
  }
  async function team(complete = true) {
    const id = randomUUID(); await owner.query("INSERT INTO teams(id,display_name) VALUES($1,'Synthetic duplicate team label')", [id]);
    await owner.query("INSERT INTO team_members(id,team_id,position,display_name) VALUES($1,$2,1,'Synthetic duplicate member label')", [randomUUID(), id]);
    if (complete) await owner.query("INSERT INTO team_members(id,team_id,position,display_name) VALUES($1,$2,2,'Synthetic duplicate member label')", [randomUUID(), id]);
    return id;
  }
  async function create(patch: Partial<ArenaSetupCommand> = {}): Promise<ArenaSetupCommand> {
    return { action: "CREATE", roundId: null, requestKey: randomUUID(), expectedRevision: (await owner.query("SELECT revision FROM arena_control WHERE id=1")).rows[0].revision,
      durationMs: 5400000, teamIds: [], reason: "Synthetic draft setup", ...patch };
  }
  async function configure(roundId: string, patch: Partial<ArenaSetupCommand> = {}): Promise<ArenaSetupCommand> {
    return { action: "CONFIGURE", roundId, requestKey: randomUUID(), expectedRevision: (await owner.query("SELECT configuration_revision FROM rounds WHERE id=$1", [roundId])).rows[0].configuration_revision,
      durationMs: 3600000, teamIds: [], reason: "Synthetic draft update", ...patch };
  }
  try {
    await t.test("arena draft validation rejects malformed duration, duplicate/foreign teams and missing roles without reserving anything", async () => {
      const actor = await person(), organiser = await person("ORGANISER"), incomplete = await team(false);
      for (const durationMs of [0, -1, 18000001, 1.5, Number.NaN]) await assert.rejects(service.command(actor.sessionCookie, await create({ durationMs })), denied("INVALID_CONTEXT"));
      await assert.rejects(service.command(actor.sessionCookie, await create({ teamIds: [incomplete, incomplete] })), denied("INVALID_CONTEXT"));
      await assert.rejects(service.command(actor.sessionCookie, await create({ teamIds: Array.from({ length: 101 }, () => randomUUID()) })), denied("INVALID_CONTEXT"));
      await assert.rejects(service.command(actor.sessionCookie, await create({ teamIds: [randomUUID()] })), denied("ARENA_UNAVAILABLE"));
      await assert.rejects(service.command(organiser.sessionCookie, await create()), denied("ACCESS_UNAVAILABLE"));
      await assert.rejects(service.command("forged", await create()), denied("INVALID_SESSION"));
      const rejected = await service.command(actor.sessionCookie, await create({ teamIds: [incomplete] }));
      assert.equal(rejected.reason, "TEAM_INCOMPLETE");
      assert.equal((await service.current(actor.sessionCookie)).instance, null);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM arena_instances")).rows[0].n, 0);
    });

    const actor = await person(), other = await person("SUPER_ADMIN"), organiser = await person("ORGANISER"), a = await team(), b = await team();
    let roundId: string, instanceId: string;
    await t.test("concurrent creation reserves one SETUP with only a first-round draft and does not admit selected teams", async () => {
      const command = await create({ teamIds: [a, b] }), competing = { ...command, requestKey: randomUUID() };
      const replies = await Promise.all([service.command(actor.sessionCookie, command), service.command(other.sessionCookie, competing)]);
      const win = replies.find(r => r.outcome === "APPLIED")!, loss = replies.find(r => r.outcome === "REJECTED")!;
      assert.ok(win); assert.ok(loss); assert.equal(loss.reason, "STALE_VERSION");
      roundId = win.round_id!; instanceId = win.instance_id!;
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM arena_instances")).rows[0].n, 1);
      assert.deepEqual((await owner.query("SELECT kind,state,duration_ms,configuration_revision,started_at,closes_at FROM rounds")).rows,
        [{ kind: 1, state: "DRAFT", duration_ms: "5400000", configuration_revision: "1", started_at: null, closes_at: null }]);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM team_rounds")).rows[0].n, 0);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM member_rounds")).rows[0].n, 0);
      assert.equal((await service.current(organiser.sessionCookie)).round!.teams.length, 2);
      const reserved = await service.command(actor.sessionCookie, await create()); assert.equal(reserved.reason, "ARENA_RESERVED");
    });
    await t.test("configuration retries/restarts recover one receipt with canonical team order and reject changed intent", async () => {
      const command = await configure(roundId!, { durationMs: 18000000, teamIds: [b, a] });
      const replies = await Promise.all([service.command(actor.sessionCookie, command), service.command(actor.sessionCookie, { ...command, teamIds: [a, b] })]);
      assert.deepEqual(replies[0], replies[1]); assert.equal(replies[0].outcome, "APPLIED"); assert.equal(replies[0].configuration_revision, "2");
      const restarted = createArenaService(api, clock, delivery);
      assert.deepEqual(await restarted.command(actor.sessionCookie, command), replies[0]);
      assert.deepEqual((await restarted.outcome(actor.sessionCookie, "CONFIGURE", roundId!, command.requestKey)).outcome, replies[0]);
      assert.equal((await restarted.outcome(other.sessionCookie, "CONFIGURE", roundId!, command.requestKey)).status, "NOT_OBSERVED");
      await assert.rejects(service.command(actor.sessionCookie, { ...command, durationMs: 1 }), denied("INTENT_CONFLICT"));
      const unchanged = await service.command(actor.sessionCookie, await configure(roundId!, { durationMs: 18000000, teamIds: [a, b] }));
      assert.equal(unchanged.outcome, "UNCHANGED"); assert.equal(unchanged.configuration_revision, "2");
      assert.equal((await service.current(actor.sessionCookie)).round!.can_start, false);
    });
    await t.test("competing draft saves preserve one winner; stale rejection remains rejected after later edits", async () => {
      const command = await configure(roundId!, { teamIds: [a] });
      const competing = { ...command, requestKey: randomUUID(), teamIds: [b], durationMs: 7200000 };
      const replies = await Promise.all([service.command(actor.sessionCookie, command), service.command(other.sessionCookie, competing)]);
      assert.equal(replies.filter(r => r.outcome === "APPLIED").length, 1);
      const loss = replies.find(r => r.outcome === "REJECTED")!; assert.equal(loss.reason, "STALE_VERSION");
      await service.command(actor.sessionCookie, await configure(roundId!, { teamIds: [] }));
      const lostCommand = loss.request_key === command.requestKey ? command : competing, lostActor = loss.request_key === command.requestKey ? actor : other;
      assert.deepEqual(await service.command(lostActor.sessionCookie, lostCommand), loss);
    });
    await t.test("an actual draft edit invalidates READY; read, no-op and receipt recovery do not renew staff activity", async () => {
      const actor = await person();
      await owner.query("UPDATE rounds SET state='READY' WHERE id=$1", [roundId!]);
      const command = await configure(roundId!, { teamIds: [a], durationMs: 1 });
      await service.command(actor.sessionCookie, command);
      assert.equal((await service.current(actor.sessionCookie)).round!.state, "DRAFT");
      const before = (await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1", [actor.session.session_id])).rows;
      await service.current(actor.sessionCookie); await service.teams(actor.sessionCookie);
      await service.command(actor.sessionCookie, command);
      assert.equal((await service.command(actor.sessionCookie, await configure(roundId!, { teamIds: [a], durationMs: 1 }))).outcome, "UNCHANGED");
      assert.deepEqual((await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1", [actor.session.session_id])).rows, before);
    });
    await t.test("the API role cannot write arena state/rosters directly, fabricate partial receipts or erase audit payloads", async () => {
      await assert.rejects(api.query("UPDATE arena_control SET current_instance_id=NULL WHERE id=1"), { code: "42501" });
      await assert.rejects(api.query("INSERT INTO round_draft_teams(round_id,team_id) VALUES($1,$2)", [roundId!, b]), { code: "42501" });
      await assert.rejects(api.query("UPDATE rounds SET duration_ms=100 WHERE id=$1", [roundId!]), { code: "42501" });
      await assert.rejects(api.query("SELECT apply_arena_setup($1)", [randomUUID()]), { code: "P0001" });
      await assert.rejects(owner.query("UPDATE arena_setup_outcomes SET reason='rewritten'"), { code: "P0001" });
      await assert.rejects(owner.query("DELETE FROM arena_setup_teams"), { code: "P0001" });
      const applied = (await owner.query("SELECT id FROM arena_setup_outcomes WHERE action='CONFIGURE' AND outcome='APPLIED' LIMIT 1")).rows[0].id;
      await assert.rejects(api.query(`INSERT INTO arena_setup_outcomes SELECT $1,actor_id,session_id,credential_id,credential_version,action,control_id,round_id,$2,
        fingerprint,expected_revision,duration_ms,reason,outcome,denial_reason,date_trunc('milliseconds',clock_timestamp()),result_instance_id,result_round_id,result_revision
        FROM arena_setup_outcomes WHERE id=$3`, [randomUUID(), randomUUID(), applied]), { code: "23505" });
      await assert.rejects(api.query("INSERT INTO arena_setup_teams(outcome_id,team_id) VALUES($1,$2)", [applied, await team()]), { code: "P0001" });
      await assert.rejects(api.query(`INSERT INTO arena_setup_outcomes(id,actor_id,session_id,credential_id,credential_version,action,round_id,request_key,fingerprint,
        expected_revision,duration_ms,reason,outcome,recorded_at,result_instance_id,result_round_id,result_revision)
        SELECT $1,actor_id,session_id,credential_id,credential_version,'CONFIGURE',round_id,$2,fingerprint,
          (SELECT configuration_revision FROM rounds WHERE id=round_id),1000,'Synthetic incomplete effect','APPLIED',date_trunc('milliseconds',clock_timestamp()),
          result_instance_id,result_round_id,(SELECT configuration_revision+1 FROM rounds WHERE id=round_id) FROM arena_setup_outcomes WHERE id=$3`,
        [randomUUID(), randomUUID(), applied]), { code: "P0001" });
      await assert.rejects(owner.query("UPDATE arena_control SET current_instance_id=NULL,revision=revision+1 WHERE id=1"), { code: "P0001" });
      await assert.rejects(owner.query("DELETE FROM arena_control WHERE id=1"), { code: "P0001" });
    });
    await t.test("setup registration picker is bounded, keeps duplicate labels distinct and shows both named positions", async () => {
      for (let i = 0; i < 51; i++) await team();
      const page = await service.teams(organiser.sessionCookie); assert.equal(page.items.length, 50); assert.ok(page.next_after);
      const next = await service.teams(organiser.sessionCookie, page.next_after!);
      assert.equal(new Set([...page.items, ...next.items].map(t => t.team_id)).size, page.items.length + next.items.length);
      const complete = page.items.find(t => t.team_id === a) ?? next.items.find(t => t.team_id === a)!;
      assert.equal(complete.members.length, 2); assert.deepEqual(complete.members.map(m => m.position), [1, 2]);
      assert.notEqual(complete.members[0]!.member_id, complete.members[1]!.member_id);
      assert.doesNotMatch(JSON.stringify(page), /verifier|credential_id|ciphertext|secret/);
    });
    await t.test("a full 100-team draft retains all 200 member choices without granting participant access", async () => {
      const actor = await person();
      let complete = (await owner.query("SELECT t.id FROM teams t WHERE (SELECT count(*) FROM team_members m WHERE m.team_id=t.id)=2 ORDER BY t.id")).rows;
      while (complete.length < 100) { const id = await team(); complete.push({ id }); }
      const command = await configure(roundId!, { teamIds: complete.slice(0, 100).map(r => r.id), durationMs: 18000000 });
      assert.equal((await service.command(actor.sessionCookie, command)).outcome, "APPLIED");
      const snapshot = await service.current(actor.sessionCookie);
      assert.equal(snapshot.round!.teams.length, 100);
      assert.equal(snapshot.round!.teams.reduce((n, team) => n + team.members.length, 0), 200);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM team_rounds")).rows[0].n, 0);
    });

    const settings = { mode: "production" as const, origin: "https://ingenium.test", cookieKey: randomBytes(32), csrfKey: randomBytes(32) }, policy = browserPolicy(settings);
    const app = buildApp({ database: { async check() {}, async close() {} }, entry: { pool: api, clock, delivery, browser: settings } });
    await app.ready();
    try { await t.test("arena HTTP enforces staff CSRF, role, strict bounds and secret-free own outcome recovery", async () => {
      const actor = await person();
      const cookies = new Map<string, string>();
      async function send(url: string, body?: unknown, token?: string, origin = settings.origin) {
        const response = await app.inject({ method: body === undefined ? "GET" : "POST", url, headers: { origin,
          cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join(";"), ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { "x-csrf-token": token } : {}) },
          ...(body === undefined ? {} : { payload: JSON.stringify(body) }) });
        const lines = response.headers["set-cookie"]; for (const line of typeof lines === "string" ? [lines] : lines ?? []) {
          const pair = line.split(";")[0]!, at = pair.indexOf("="); cookies.set(pair.slice(0, at), pair.slice(at + 1));
        } return response;
      }
      const anonymous = await send("/api/v1/bootstrap?audience=ANONYMOUS"); cookies.set(policy.names.staff, actor.sessionCookie);
      const snapshot = await send("/api/v1/bootstrap?audience=STAFF"), token = snapshot.json().data.csrf_token;
      const current = await send("/api/v1/staff/arenas/current"); assert.equal(current.statusCode, 200);
      const path = `/api/v1/staff/arenas/rounds/${roundId!}/configuration`, body = { request_key: randomUUID(), expected_revision: current.json().data.round.configuration_revision,
        duration_ms: 3600000, team_ids: [a, b], reason: "Synthetic HTTP draft" };
      assert.equal((await send(path, body, anonymous.json().data.csrf_token)).statusCode, 403);
      assert.equal((await send(path, body, token, "https://foreign.test")).statusCode, 403);
      for (const patch of [{ duration_ms: "3600000" }, { duration_ms: 18000001 }, { team_ids: [a, a] }, { own_code: actor.code }, { kind: 2 }, { expected_revision: "01" }])
        assert.equal((await send(path, { ...body, ...patch }, token)).statusCode, 400);
      const saved = await send(path, body, token); assert.equal(saved.statusCode, 200); assert.equal(saved.json().data.outcome, "APPLIED");
      assert.equal(saved.headers["cache-control"], "no-store"); assert.doesNotMatch(saved.body, /verifier|credential_id|ciphertext/);
      const recovered = await send(`/api/v1/staff/outcomes/arena-setup/CONFIGURE/${roundId!}/${body.request_key}`);
      assert.deepEqual(recovered.json().data.outcome, saved.json().data);
      assert.equal((await send(path, { ...body, request_key: randomUUID() }, token)).statusCode, 409);
      assert.equal((await send(`/api/v1/staff/arenas/${instanceId!}/start`, {}, token)).statusCode, 404);
      const creation = await send("/api/v1/staff/arenas", { ...body, request_key: randomUUID(), expected_revision: current.json().data.control_revision }, token);
      assert.equal(creation.statusCode, 409); assert.equal(creation.json().data.reason, "ARENA_RESERVED");
      cookies.set(policy.names.staff, organiser.sessionCookie);
      const org = await send("/api/v1/bootstrap?audience=STAFF");
      assert.equal((await send(path, body, org.json().data.csrf_token)).statusCode, 403);
      assert.equal((await send("/api/v1/staff/arena-teams")).statusCode, 200);
      cookies.delete(policy.names.staff); cookies.set(policy.names.participant, actor.sessionCookie);
      assert.equal((await send("/api/v1/staff/arenas/current")).statusCode, 401);
    }); } finally { await app.close(); }

    await t.test("launch-shaped state locks duration/roster; a live or intermission parent never releases its reservation", async () => {
      const actor = await person();
      await owner.query("UPDATE arena_instances SET status='IN_PROGRESS',revision=revision+1 WHERE id=$1", [instanceId!]);
      await owner.query(`UPDATE rounds SET state='RUNNING',started_at=date_trunc('milliseconds',clock_timestamp()),
        closes_at=date_trunc('milliseconds',clock_timestamp())+duration_ms*interval '1 millisecond' WHERE id=$1`, [roundId!]);
      const locked = await service.command(actor.sessionCookie, await configure(roundId!, { teamIds: [a] })); assert.equal(locked.reason, "ROUND_UNAVAILABLE");
      await assert.rejects(owner.query("UPDATE rounds SET duration_ms=1000,configuration_revision=configuration_revision+1,revision=revision+1 WHERE id=$1", [roundId!]), { code: "P0001" });
      await assert.rejects(owner.query("DELETE FROM round_draft_teams WHERE round_id=$1", [roundId!]), { code: "P0001" });
      await owner.query("UPDATE rounds SET state='CLOSED' WHERE id=$1", [roundId!]);
      assert.equal((await service.command(actor.sessionCookie, await create())).reason, "ARENA_RESERVED");
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM rounds WHERE kind=2")).rows[0].n, 0);
    });
    await t.test("clock faults and revoked/changed staff authority deny configuration and own receipts", async () => {
      const actor = await person();
      const command = await create(); const saved = await service.command(actor.sessionCookie, command);
      healthy = false;
      try { await assert.rejects(service.current(actor.sessionCookie), denied("CLOCK_UNTRUSTED")); }
      finally { healthy = true; }
      await owner.query("UPDATE staff_identities SET role='ORGANISER' WHERE id=$1", [actor.id]);
      await assert.rejects(service.outcome(actor.sessionCookie, "CREATE", null, command.requestKey), denied("INVALID_SESSION"));
      assert.equal(saved.outcome, "REJECTED");
      const flow = await entry.begin(actor.code, { ip: "127.0.0.1", browserId: randomUUID() });
      if (flow.audience !== "STAFF") throw new Error("Synthetic role-change entry failed");
      const fresh = await staff.activate(flow.proofCookie, randomUUID());
      await assert.rejects(service.outcome(fresh.sessionCookie, "CREATE", null, command.requestKey), denied("ACCESS_UNAVAILABLE"));
    });
  } finally { await api.end(); await owner.end(); }
}
