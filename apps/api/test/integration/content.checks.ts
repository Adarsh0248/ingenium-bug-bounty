import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { createContentService } from "../../src/content/service.js";
import type { ContentCommand } from "../../src/content/service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { newAccessCode, sessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { buildApp } from "../../src/app.js";
import { migrateDatabase } from "../../src/db/migrate.js";

export async function contentChecks(t: TestContext, ownerConnection: string, apiConnection: string) {
  const name = `ingenium_content_${randomUUID().replaceAll("-", "")}`, bootstrap = new Client({ connectionString: ownerConnection });
  await bootstrap.connect(); try { await bootstrap.query(`CREATE DATABASE "${name}"`); } finally { await bootstrap.end(); }
  const ownerUrl = new URL(ownerConnection), apiUrl = new URL(apiConnection); ownerUrl.pathname = apiUrl.pathname = `/${name}`;
  await migrateDatabase(ownerUrl.toString());
  const owner = new Pool({ connectionString: ownerUrl.toString(), max: 2 }), api = new Pool({ connectionString: apiUrl.toString(), max: 4 });
  let healthy = true;
  const clock = { assertHealthy() { if (!healthy) throw new AccessError("CLOCK_UNTRUSTED"); }, async verify() {}, fault() {} };
  const delivery = sessionDelivery("synthetic-content", randomBytes(32)), service = createContentService(api, clock, delivery);
  const staff = createStaffService(api, clock, delivery), entry = createEntryService(api, clock, delivery);
  const denied = (code: string) => (e: unknown) => e instanceof AccessError && e.code === code;
  const metadata = { title: "Synthetic fixture, not an event question", statement: "Synthetic input/output description\r\n", difficulty: 95, checker_mode: "TOKENS" };
  const variant = (language: string, text = "") => ({ language, starter_code: text, reference_solution_code: text, defect_description: "", runtime_key: null,
    cpu_time_limit_ms: null, wall_time_limit_ms: null, memory_limit_kb: null });
  async function person(role = "OWNER") {
    const id = randomUUID(), code = newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic author',$2)", [id, role]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), id, code.verifier]);
    const flow = await entry.begin(code.code, { ip: "127.0.0.1", browserId: randomUUID() }); if (flow.audience !== "STAFF") throw new Error("Synthetic author routing failed");
    return { id, code: code.code, ...await staff.activate(flow.proofCookie, randomUUID()) };
  }
  async function command(action: ContentCommand["action"], targetId: string | null, payload: unknown): Promise<ContentCommand> {
    const table = action === "CREATE" ? "catalogue_control" : action === "NEW_VERSION" ? "bug_definitions" : "bug_versions";
    const column = table === "bug_versions" ? "content_revision" : "revision";
    const row = (await owner.query(`SELECT ${column} AS revision FROM ${table} WHERE id=$1`, [targetId ?? 1])).rows[0];
    return { action, targetId, requestKey: randomUUID(), expectedRevision: row.revision, reason: "Synthetic authoring test", payload };
  }
  async function draft(actor: Awaited<ReturnType<typeof person>>, round = 1) {
    const result = await service.command(actor.sessionCookie, await command("CREATE", null, { round_type: round, ...metadata }));
    assert.equal(result.outcome, "APPLIED"); return { version: result.version_id!, definition: result.definition_id! };
  }
  async function edit(actor: Awaited<ReturnType<typeof person>>, version: string, action: ContentCommand["action"], payload: unknown) {
    return service.command(actor.sessionCookie, await command(action, version, payload));
  }
  async function addCase(actor: Awaited<ReturnType<typeof person>>, version: string, position: number, visibility = "HIDDEN", input = "", expected = "") {
    const result = await edit(actor, version, "CASE", { case_id: null, position, visibility, input_data: input, expected_output: expected });
    assert.equal(result.outcome, "APPLIED"); return result.case_id!;
  }
  try {
    await t.test("content roles and structural validation cannot create a public/ready version or accept browser-owned rewards", async () => {
      const actor = await person(), organiser = await person("ORGANISER"), create = await command("CREATE", null, { round_type: 1, ...metadata });
      await assert.rejects(service.command(organiser.sessionCookie, create), denied("ACCESS_UNAVAILABLE"));
      await assert.rejects(service.command(actor.sessionCookie, { ...create, payload: { round_type: 1, ...metadata, publication_status: "PUBLISHED" } }), denied("INVALID_CONTEXT"));
      await assert.rejects(service.command(actor.sessionCookie, { ...create, payload: { round_type: 1, ...metadata, base_bounty: 99999 } }), denied("INVALID_CONTEXT"));
      const saved = await service.command(actor.sessionCookie, create);
      const view = await service.describe(actor.sessionCookie, saved.version_id!);
      assert.equal(view.base_bounty, 950); assert.equal(view.publication_status, "DRAFT"); assert.equal(view.can_publish, false);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_sessions")).rows[0].n, 0);
      await assert.rejects(service.describe(organiser.sessionCookie, saved.version_id!), denied("ACCESS_UNAVAILABLE"));
      await assert.rejects(service.describe("invalid", saved.version_id!), denied("INVALID_SESSION"));
    });
    await t.test("concurrent creation and replay commit one source; changed intents cannot reuse a key after restart", async () => {
      const actor = await person(), create = await command("CREATE", null, { round_type: 2, ...metadata });
      const results = await Promise.all([service.command(actor.sessionCookie, create), service.command(actor.sessionCookie, create)]);
      assert.deepEqual(results[0], results[1]);
      assert.deepEqual(await createContentService(api, clock, delivery).command(actor.sessionCookie, create), results[0]);
      await assert.rejects(service.command(actor.sessionCookie, { ...create, payload: { round_type: 1, ...metadata } }), denied("INTENT_CONFLICT"));
      assert.deepEqual((await service.outcome(actor.sessionCookie, "CREATE", null, create.requestKey)).outcome, results[0]);
      const other = await person("SUPER_ADMIN"); assert.equal((await service.outcome(other.sessionCookie, "CREATE", null, create.requestKey)).status, "NOT_OBSERVED");
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM content_outcomes WHERE actor_id=$1", [actor.id])).rows[0].n, 1);
    });
    await t.test("metadata saves reject stale competing edits durably; new versions retain separate identities and configuration", async () => {
      const actor = await person(), other = await person(), d = await draft(actor);
      const a = await command("METADATA", d.version, { ...metadata, title: "Synthetic first edit" }), b = { ...a, requestKey: randomUUID(), payload: { ...metadata, title: "Synthetic competing edit" } };
      const results = await Promise.all([service.command(actor.sessionCookie, a), service.command(other.sessionCookie, b)]);
      assert.equal(results.filter(r => r.outcome === "APPLIED").length, 1); const lost = results.find(r => r.outcome === "REJECTED")!; assert.equal(lost.reason, "STALE_VERSION");
      await edit(actor, d.version, "HINT", { level: 1, content: "Synthetic hint" });
      assert.deepEqual(await service.command(lost.request_key === a.requestKey ? actor.sessionCookie : other.sessionCookie, lost.request_key === a.requestKey ? a : b), lost);
      await assert.rejects(service.command(actor.sessionCookie, { ...a, action: "HINT", payload: { level: 1, content: "Changed operation" } }), denied("INTENT_CONFLICT"));
      const next = await command("NEW_VERSION", d.definition, { ...metadata, title: "Synthetic second version" });
      const replies = await Promise.all([service.command(actor.sessionCookie, next), service.command(actor.sessionCookie, next)]);
      assert.deepEqual(replies[0], replies[1]); assert.notEqual(replies[0].version_id, d.version);
      assert.equal((await service.describe(actor.sessionCookie, replies[0].version_id!)).version_number, 2);
      assert.equal((await service.describe(actor.sessionCookie, d.version)).version_number, 1);
    });
    await t.test("five exact byte-backed variants and same-language registered runtime references do not claim execution readiness", async () => {
      const actor = await person(), d = await draft(actor), exact = "\ufeff\t synthetic private source\r\n\0" + String.fromCodePoint(0x00e9);
      for (const lang of ["c", "cpp", "java", "python", "javascript"]) assert.equal((await edit(actor, d.version, "VARIANT", variant(lang, exact))).outcome, "APPLIED");
      const read = await service.privateRead(actor.sessionCookie, d.version, "VARIANTS", "cpp");
      assert.equal((read.data as { starter_code: string }).starter_code, exact);
      assert.equal((read.data as { reference_solution_code: string }).reference_solution_code, exact);
      assert.doesNotMatch(JSON.stringify(await service.describe(actor.sessionCookie, d.version)), /private source/);
      await owner.query(`INSERT INTO runtime_manifests(key,language,manifest,digest,created_at) SELECT 'synthetic-cpp-v1','cpp',$1::jsonb,
        sha256(convert_to($1::jsonb::text,'UTF8')),date_trunc('milliseconds',clock_timestamp())`, [JSON.stringify({ schema_version: 1, synthetic_test_only: true })]);
      const configured = { ...variant("cpp", exact), runtime_key: "synthetic-cpp-v1", cpu_time_limit_ms: 2000, wall_time_limit_ms: 10000, memory_limit_kb: 524288 };
      assert.equal((await edit(actor, d.version, "VARIANT", configured)).outcome, "APPLIED");
      await assert.rejects(edit(actor, d.version, "VARIANT", { ...configured, runtime_key: "not-installed" }), denied("INVALID_CONTEXT"));
      await assert.rejects(edit(actor, d.version, "VARIANT", { ...configured, language: "java" }), denied("INVALID_CONTEXT"));
      await assert.rejects(owner.query("UPDATE runtime_manifests SET manifest='{}'"), { code: "P0001" });
      assert.equal((await service.describe(actor.sessionCookie, d.version)).can_publish, false);
    });
    await t.test("cases preserve empty/NUL/CRLF input and declared witnesses cannot escape their version or reference a removed case", async () => {
      const actor = await person(), d = await draft(actor), foreign = await draft(actor);
      await edit(actor, d.version, "VARIANT", variant("cpp", "synthetic"));
      const id = await addCase(actor, d.version, 1, "SAMPLE", "", "\0\r\n"), outside = await addCase(actor, foreign.version, 1);
      const read = await service.privateRead(actor.sessionCookie, d.version, "CASES", id);
      assert.equal((read.data as { input_data: string }).input_data, ""); assert.equal((read.data as { expected_output: string }).expected_output, "\0\r\n");
      const declaration = { language: "cpp", witnesses: [{ check_type: "TEST_CASE", test_case_id: id, expected_failure: "WRONG_OUTPUT" }] };
      assert.equal((await edit(actor, d.version, "WITNESSES", declaration)).outcome, "APPLIED");
      const bad = await edit(actor, d.version, "WITNESSES", { ...declaration, witnesses: [{ ...declaration.witnesses[0], test_case_id: outside }] }); assert.equal(bad.reason, "CASE_UNAVAILABLE");
      assert.equal((await edit(actor, d.version, "DELETE_CASE", { case_id: id })).reason, "REFERENCED_CASE");
      assert.equal((await service.privateRead(actor.sessionCookie, d.version, "WITNESSES")).data instanceof Array, true);
      assert.equal((await owner.query("SELECT expected_failure FROM failure_witnesses WHERE test_case_id=$1", [id])).rows[0].expected_failure, "WRONG_ANSWER");
    });
    await t.test("draft case reordering keeps witness IDs stable; retirement preserves original receipts and cannot revive cases", async () => {
      const actor = await person(), d = await draft(actor), first = await addCase(actor, d.version, 1), second = await addCase(actor, d.version, 2);
      await edit(actor, d.version, "VARIANT", variant("cpp"));
      await edit(actor, d.version, "WITNESSES", { language: "cpp", witnesses: [{ check_type: "TEST_CASE", test_case_id: second, expected_failure: "WRONG_OUTPUT" }] });
      const source = (await owner.query("SELECT request_key FROM content_outcomes WHERE result_case_id=$1", [first])).rows[0].request_key;
      const changed = await edit(actor, d.version, "REORDER_CASES", { case_ids: [second, first] }); assert.equal(changed.outcome, "APPLIED");
      assert.deepEqual((await service.describe(actor.sessionCookie, d.version)).cases.map(c => c.case_id), [second, first]);
      assert.equal((await owner.query("SELECT test_case_id FROM failure_witnesses WHERE version_id=$1", [d.version])).rows[0].test_case_id, second);
      assert.equal((await edit(actor, d.version, "REORDER_CASES", { case_ids: [first] })).reason, "INVALID_ORDER");
      const removed = await edit(actor, d.version, "DELETE_CASE", { case_id: first }); assert.equal(removed.outcome, "APPLIED");
      assert.equal((await service.outcome(actor.sessionCookie, "CASE", d.version, source)).outcome!.case_id, first);
      await assert.rejects(service.privateRead(actor.sessionCookie, d.version, "CASES", first), denied("CONTENT_UNAVAILABLE"));
      assert.equal((await edit(actor, d.version, "CASE", { case_id: first, position: 1, visibility: "HIDDEN", input_data: "", expected_output: "" })).reason, "CASE_UNAVAILABLE");
      const replacement = await addCase(actor, d.version, 2); assert.notEqual(replacement, first);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM test_cases WHERE version_id=$1", [d.version])).rows[0].n, 3);
    });
    await t.test("the fourth sample is refused atomically, including its source, revision and byte accounting", async () => {
      const actor = await person(), d = await draft(actor);
      for (let i = 1; i <= 3; i++) await addCase(actor, d.version, i, "SAMPLE");
      const before = (await owner.query("SELECT content_revision,content_bytes,last_source_id FROM bug_versions WHERE id=$1", [d.version])).rows;
      const count = (await owner.query("SELECT count(*)::integer AS n FROM content_outcomes")).rows[0].n;
      await assert.rejects(edit(actor, d.version, "CASE", { case_id: null, position: 4, visibility: "SAMPLE", input_data: "", expected_output: "" }), denied("CONTENT_LIMIT_EXCEEDED"));
      assert.deepEqual((await owner.query("SELECT content_revision,content_bytes,last_source_id FROM bug_versions WHERE id=$1", [d.version])).rows, before);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM content_outcomes")).rows[0].n, count);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM test_cases WHERE version_id=$1", [d.version])).rows[0].n, 3);
    });
    await t.test("the decoded 16 MiB suite ceiling includes compressed/repeated content and rolls back an oversized addition", async () => {
      const actor = await person(), d = await draft(actor), text = "x".repeat(1048576);
      for (let i = 1; i <= 8; i++) await addCase(actor, d.version, i, "HIDDEN", text, text);
      const another = await person(), before = (await owner.query("SELECT content_revision,content_bytes FROM bug_versions WHERE id=$1", [d.version])).rows;
      await assert.rejects(edit(another, d.version, "CASE", { case_id: null, position: 9, visibility: "HIDDEN", input_data: "x", expected_output: "" }), denied("CONTENT_LIMIT_EXCEEDED"));
      assert.deepEqual((await owner.query("SELECT content_revision,content_bytes FROM bug_versions WHERE id=$1", [d.version])).rows, before);
      const accounting = (await owner.query("SELECT committed_bytes=(SELECT sum(content_bytes) FROM bug_versions) AS exact FROM catalogue_control")).rows[0]; assert.equal(accounting.exact, true);
    });
    await t.test("three hints, private read audits and unchanged/recovered commands cannot renew staff idle time", async () => {
      const actor = await person(), d = await draft(actor);
      for (let level = 1; level <= 3; level++) await edit(actor, d.version, "HINT", { level, content: `Synthetic private hint ${level}` });
      const hintIds = (await owner.query("SELECT id FROM bug_hints WHERE version_id=$1 ORDER BY level", [d.version])).rows;
      await edit(actor, d.version, "HINT", { level: 2, content: "Synthetic revised hint 2" });
      assert.deepEqual((await owner.query("SELECT id FROM bug_hints WHERE version_id=$1 ORDER BY level", [d.version])).rows, hintIds);
      const noop = await command("HINT", d.version, { level: 3, content: "Synthetic private hint 3" });
      const before = (await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1", [actor.session.session_id])).rows;
      assert.equal((await service.command(actor.sessionCookie, noop)).outcome, "UNCHANGED");
      await service.command(actor.sessionCookie, noop); await service.describe(actor.sessionCookie, d.version);
      assert.equal((await service.privateRead(actor.sessionCookie, d.version, "HINTS")).data instanceof Array, true);
      assert.deepEqual((await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1", [actor.session.session_id])).rows, before);
      const audit = (await owner.query("SELECT actor_id,session_id,section FROM content_read_audits WHERE version_id=$1", [d.version])).rows;
      assert.deepEqual(audit, [{ actor_id: actor.id, session_id: actor.session.session_id, section: "HINTS" }]);
      await assert.rejects(owner.query("DELETE FROM content_read_audits WHERE version_id=$1", [d.version]), { code: "P0001" });
      assert.doesNotMatch(JSON.stringify(await service.list(actor.sessionCookie)), /Synthetic private hint/);
    });
    await t.test("restricted runtime permissions and source guards reject direct edits, forged publication and duplicate applied revisions", async () => {
      const actor = await person(), d = await draft(actor);
      await assert.rejects(api.query("UPDATE bug_versions SET publication_status='PUBLISHED' WHERE id=$1", [d.version]), { code: "42501" });
      await assert.rejects(api.query("INSERT INTO bug_hints(version_id,level,content) VALUES($1,1,'bypass')", [d.version]), { code: "42501" });
      await assert.rejects(api.query("SELECT apply_content_edit($1,'{}')", [randomUUID()]), { code: "P0001" });
      await assert.rejects(owner.query("UPDATE bug_versions SET publication_status='PUBLISHED',published_by=$2,published_at=clock_timestamp() WHERE id=$1", [d.version, actor.id]), { code: "P0001" });
      await assert.rejects(owner.query("UPDATE bug_versions SET title='bypass' WHERE id=$1", [d.version]), { code: "P0001" });
      await assert.rejects(owner.query("UPDATE content_outcomes SET reason='rewrite'"), { code: "P0001" });
      await assert.rejects(owner.query("DELETE FROM catalogue_control"), { code: "23503" });
      await assert.rejects(api.query(`INSERT INTO content_outcomes SELECT $1,actor_id,session_id,credential_id,credential_version,action,control_id,definition_id,version_id,$2,
        fingerprint,payload_digest,expected_revision,reason,outcome,denial_reason,date_trunc('milliseconds',clock_timestamp()),result_definition_id,result_version_id,result_revision,result_case_id
        FROM content_outcomes WHERE result_version_id=$3 AND action='CREATE'`, [randomUUID(), randomUUID(), d.version]), { code: "23505" });
    });
    await t.test("clock faults and revoked staff credentials deny private reads and receipt recovery", async () => {
      const actor = await person(), d = await draft(actor), c = await command("HINT", d.version, { level: 1, content: "synthetic" }); await service.command(actor.sessionCookie, c);
      healthy = false; try { await assert.rejects(service.describe(actor.sessionCookie, d.version), denied("CLOCK_UNTRUSTED")); } finally { healthy = true; }
      await owner.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE staff_id=$1", [actor.id]);
      await assert.rejects(service.outcome(actor.sessionCookie, "HINT", d.version, c.requestKey), denied("INVALID_SESSION"));
    });

    const settings = { mode: "production" as const, origin: "https://ingenium.test", cookieKey: randomBytes(32), csrfKey: randomBytes(32) }, policy = browserPolicy(settings);
    const app = buildApp({ database: { async check() {}, async close() {} }, entry: { pool: api, clock, delivery, browser: settings } });
    let held = 0, entered!: () => void, release!: () => void;
    const reached = new Promise<void>(r => { entered = r; }), barrier = new Promise<void>(r => { release = r; });
    app.addHook("preParsing", async request => { if (request.headers["x-synthetic-hold"] === "yes") { if (++held === 2) entered(); await barrier; } });
    await app.ready();
    async function browser(actor: Awaited<ReturnType<typeof person>>) {
      const cookies = new Map<string, string>();
      async function send(url: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
        const response = await app.inject({ method: body === undefined ? "GET" : "POST", url, headers: { origin: settings.origin,
          cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join(";"), ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { "x-csrf-token": token } : {}), ...headers },
          ...(body === undefined ? {} : { payload: typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body) }) });
        const lines = response.headers["set-cookie"]; for (const line of typeof lines === "string" ? [lines] : lines ?? []) { const pair = line.split(";")[0]!, i = pair.indexOf("="); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
        return response;
      }
      const anonymous = await send("/api/v1/bootstrap?audience=ANONYMOUS"); cookies.set(policy.names.staff, actor.sessionCookie);
      const snapshot = await send("/api/v1/bootstrap?audience=STAFF"); assert.equal(snapshot.statusCode, 200);
      return { send, token: snapshot.json().data.csrf_token as string, anonymous: anonymous.json().data.csrf_token as string };
    }
    try {
      await t.test("content HTTP authenticates before large parsing, enforces exact bodies/CSRF and exposes private text only through audited reads", async () => {
        const actor = await person(), client = await browser(actor);
        const revision = (await client.send("/api/v1/staff/content/versions")).json().data.control_revision;
        const body = { request_key: randomUUID(), expected_revision: revision, reason: "Synthetic HTTP content", payload: { round_type: 1, ...metadata } };
        assert.equal((await client.send("/api/v1/staff/content/definitions", body, client.anonymous)).statusCode, 403);
        assert.equal((await client.send("/api/v1/staff/content/definitions", { ...body, payload: { ...body.payload, published: true } }, client.token)).statusCode, 400);
        assert.equal((await client.send("/api/v1/staff/content/definitions", Buffer.from([0xc0, 0x80]), client.token)).statusCode, 400);
        assert.equal((await client.send("/api/v1/staff/content/definitions", " ".repeat(524289), client.token)).statusCode, 413);
        const saved = await client.send("/api/v1/staff/content/definitions", body, client.token); assert.equal(saved.statusCode, 200); assert.equal(saved.headers["cache-control"], "no-store");
        const id = saved.json().data.version_id;
        const change = { request_key: randomUUID(), expected_revision: "1", reason: "Synthetic HTTP source", payload: variant("cpp", "\ufeff\0synthetic secret\r\n") };
        const written = await client.send(`/api/v1/staff/content/versions/${id}/VARIANT`, change, client.token); assert.equal(written.statusCode, 200);
        assert.doesNotMatch(written.body, /synthetic secret|starter_code|reference_solution|verifier|credential_id/);
        const summary = await client.send(`/api/v1/staff/content/versions/${id}`); assert.equal(summary.statusCode, 200); assert.doesNotMatch(summary.body, /synthetic secret/);
        const read = await client.send(`/api/v1/staff/content/versions/${id}/variants/cpp`); assert.equal(read.statusCode, 200); assert.equal(read.json().data.data.starter_code, change.payload.starter_code);
        const receipt = await client.send(`/api/v1/staff/outcomes/content/VARIANT/${id}/${change.request_key}`); assert.deepEqual(receipt.json().data.outcome, written.json().data);
        assert.equal((await client.send(`/api/v1/staff/content/versions/${id}/publish`, {}, client.token)).statusCode, 400);
        const organiser = await browser(await person("ORGANISER"));
        assert.equal((await organiser.send(`/api/v1/staff/content/versions/${id}/variants/cpp`)).statusCode, 403);
        assert.equal((await organiser.send("/api/v1/staff/content/definitions", " ".repeat(524289), organiser.token)).statusCode, 403);
        assert.equal((await owner.query("SELECT count(*)::integer AS n FROM content_read_audits WHERE version_id=$1", [id])).rows[0].n, 1);
      });
      await t.test("a third large content request is refused before parsing and capacity returns after the first two finish", async () => {
        const actor = await person(), client = await browser(actor), revision = (await service.list(actor.sessionCookie)).control_revision;
        const body = { request_key: randomUUID(), expected_revision: revision, reason: "Synthetic held request", payload: { round_type: 1, ...metadata } };
        const pending = [client.send("/api/v1/staff/content/definitions", body, client.token, { "x-synthetic-hold": "yes" }),
          client.send("/api/v1/staff/content/definitions", { ...body, request_key: randomUUID() }, client.token, { "x-synthetic-hold": "yes" })];
        try {
          await Promise.race([reached, new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("Held authoring requests did not reach parsing")), 5000); timer.unref(); })]);
          const third = await client.send("/api/v1/staff/content/definitions", { ...body, request_key: randomUUID() }, client.token);
          assert.equal(third.statusCode, 503); assert.equal(third.json().error.outcome, "NOT_PROCESSED");
        } finally { release(); await Promise.all(pending); }
        const next = await client.send("/api/v1/staff/content/definitions", { ...body, request_key: randomUUID(), expected_revision: (await service.list(actor.sessionCookie)).control_revision }, client.token);
        assert.equal(next.statusCode, 200);
      });
    } finally { release(); await app.close(); }
  } finally { await api.end(); await owner.end(); }
}
