import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { migrateDatabase } from "../../src/db/migrate.js";
import { createRegistrationImport } from "../../src/access/registration-import.js";
import { createTeamManagement } from "../../src/access/team-management.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import {
  newAccessCode,
  sessionDelivery,
  sha256,
} from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { registrationCsv } from "../../src/access/registration-csv.js";

const header = "registration_id,team_name,member_1_name,member_2_name";
const file = (...rows: string[]) => `${header}\r\n${rows.join("\r\n")}\r\n`;
export async function registrationImportChecks(
  t: TestContext,
  ownerConnection: string,
  apiConnection: string,
) {
  const name = `ingenium_import_${randomUUID().replaceAll("-", "")}`,
    bootstrap = new Client({ connectionString: ownerConnection });
  await bootstrap.connect();
  try {
    await bootstrap.query(`CREATE DATABASE "${name}"`);
  } finally {
    await bootstrap.end();
  }
  const ownerUrl = new URL(ownerConnection),
    apiUrl = new URL(apiConnection);
  ownerUrl.pathname = apiUrl.pathname = `/${name}`;
  await migrateDatabase(ownerUrl.toString());
  const owner = new Pool({ connectionString: ownerUrl.toString(), max: 2 }),
    api = new Pool({ connectionString: apiUrl.toString(), max: 4 }),
    clock = { assertHealthy() {}, async verify() {}, fault() {} },
    delivery = sessionDelivery(
      "synthetic-registration-import",
      randomBytes(32),
    ),
    service = createRegistrationImport(api, clock, delivery),
    teams = createTeamManagement(api, clock, delivery),
    staff = createStaffService(api, clock, delivery),
    entry = createEntryService(api, clock, delivery);
  const denied = (code: string) => (e: unknown) =>
    e instanceof AccessError && e.code === code;
  async function budgets() {
    await owner.query("DELETE FROM quota_buckets");
  }
  async function person(role = "OWNER") {
    await budgets();
    const id = randomUUID(),
      code = newAccessCode();
    await owner.query(
      "INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic import staff',$2)",
      [id, role],
    );
    await owner.query(
      "INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",
      [randomUUID(), id, code.verifier],
    );
    const flow = await entry.begin(code.code, {
      ip: "127.0.0.1",
      browserId: randomUUID(),
    });
    if (flow.audience !== "STAFF") throw Error("Synthetic staff entry");
    return {
      id,
      code: code.code,
      ...(await staff.activate(flow.proofCookie, randomUUID())),
    };
  }
  type Actor = Awaited<ReturnType<typeof person>>;
  async function intent(actor: Actor, csv: string) {
    await budgets();
    const preview = await service.preview(actor.sessionCookie, csv);
    return {
      csv,
      csvDigest: preview.csv_digest,
      expectedRevision: preview.control_revision,
      requestKey: randomUUID(),
      ownCode: actor.code,
      reason: "Synthetic registration import",
    };
  }
  try {
    const actor = await person(),
      other = await person("SUPER_ADMIN"),
      organiser = await person("ORGANISER");
    await t.test(
      "registration preview is non-mutating and classifies stable IDs rather than names",
      async () => {
        const before = (
          await owner.query(
            "SELECT last_activity_at FROM staff_sessions WHERE id=$1",
            [actor.session.session_id],
          )
        ).rows;
        const preview = await service.preview(
          actor.sessionCookie,
          file(
            "REG-1,Same team,Same member,Same member",
            "REG-2,Same team,Same member,Same member",
          ),
        );
        assert.equal(preview.can_import, true);
        assert.equal(preview.new_count, 2);
        assert.deepEqual(
          preview.rows.map((r) => r.status),
          ["NEW", "NEW"],
        );
        assert.equal(
          (await owner.query("SELECT count(*)::int AS n FROM teams")).rows[0].n,
          0,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM registration_import_outcomes",
            )
          ).rows[0].n,
          0,
        );
        assert.deepEqual(
          (
            await owner.query(
              "SELECT last_activity_at FROM staff_sessions WHERE id=$1",
              [actor.session.session_id],
            )
          ).rows,
          before,
        );
        const invalid = await service.preview(
          actor.sessionCookie,
          file("REG-1,One,Two,Three", "REG-1,Other,Two,Three"),
        );
        assert.equal(invalid.can_import, false);
        assert.equal(invalid.issues[0]!.code, "DUPLICATE_REGISTRATION_ID");
        assert.equal(invalid.rows.length, 0);
      },
    );
    await t.test(
      "concurrent duplicate imports issue codes once and recover the original atomic result without secrets",
      async () => {
        const input = await intent(
          actor,
          file(
            "REG-1,Same team,Same member,Same member",
            "REG-2,Same team,Same member,Same member",
          ),
        );
        const responses = await Promise.all([
          service.commit(actor.sessionCookie, input),
          service.commit(actor.sessionCookie, input),
        ]);
        assert.deepEqual(responses[0].outcome, responses[1].outcome);
        assert.equal(
          responses.filter((r) => r.issued_codes.length === 2).length,
          1,
        );
        assert.equal(responses[0].outcome.outcome, "APPLIED");
        assert.equal(
          new Set(responses[0].outcome.items.map((r) => r.team_id)).size,
          2,
        );
        assert.equal(
          (await owner.query("SELECT count(*)::int AS n FROM team_members"))
            .rows[0].n,
          4,
        );
        const issued = responses.find(
          (r) => r.issued_codes.length,
        )!.issued_codes;
        for (const c of issued)
          assert.equal(
            (
              await owner.query(
                "SELECT encode(verifier,'hex') AS v FROM access_credentials WHERE team_id=$1 AND version=1",
                [c.team_id],
              )
            ).rows[0].v,
            sha256(c.code).toString("hex"),
          );
        const recovered = await createRegistrationImport(
          api,
          clock,
          delivery,
        ).outcome(actor.sessionCookie, input.requestKey);
        assert.deepEqual(recovered.outcome, responses[0].outcome);
        const evidence = JSON.stringify(
          (await owner.query("SELECT * FROM registration_import_outcomes"))
            .rows,
        );
        for (const c of issued) assert.equal(evidence.includes(c.code), false);
        assert.equal(evidence.includes(actor.code), false);
        assert.equal(
          (await service.outcome(other.sessionCookie, input.requestKey)).status,
          "NOT_OBSERVED",
        );
        await budgets();
        await assert.rejects(
          service.commit(actor.sessionCookie, {
            ...input,
            reason: "Changed intent",
          }),
          { code: "P0002" },
        );
        await budgets();
        const replay = await service.commit(
          actor.sessionCookie,
          await intent(actor, input.csv),
        );
        assert.equal(replay.outcome.outcome, "UNCHANGED");
        assert.deepEqual(replay.issued_codes, []);
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM access_credentials WHERE team_id IS NOT NULL",
            )
          ).rows[0].n,
          2,
        );
      },
    );
    await t.test(
      "existing IDs with changed names block the complete batch and never overwrite member identity",
      async () => {
        const csv = file(
            "REG-1,Changed team,Same member,Same member",
            "REG-3,New team,One,Two",
          ),
          preview = await service.preview(actor.sessionCookie, csv);
        assert.equal(preview.can_import, false);
        assert.equal(preview.reason, "REGISTRATION_CONFLICT");
        assert.deepEqual(
          preview.rows.map((r) => r.status),
          ["CONFLICT", "NEW"],
        );
        const rejected = await service.commit(
          actor.sessionCookie,
          await intent(actor, csv),
        );
        assert.equal(rejected.outcome.reason, "REGISTRATION_CONFLICT");
        assert.deepEqual(rejected.issued_codes, []);
        assert.equal(
          (await owner.query("SELECT count(*)::int AS n FROM teams")).rows[0].n,
          2,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM registration_sources WHERE registration_id='REG-3'",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT display_name FROM teams WHERE id=(SELECT team_id FROM registration_sources WHERE registration_id='REG-1')",
            )
          ).rows[0].display_name,
          "Same team",
        );
      },
    );
    await t.test(
      "stale preview is a durable refusal and explicit re-preview creates only genuinely new registrations",
      async () => {
        const input = await intent(
          actor,
          file(
            "REG-1,Same team,Same member,Same member",
            "REG-3,Third team,One,Two",
          ),
        );
        await budgets();
        await service.commit(
          other.sessionCookie,
          await intent(other, file("REG-4,Fourth team,Three,Four")),
        );
        await budgets();
        const stale = await service.commit(actor.sessionCookie, input);
        assert.equal(stale.outcome.reason, "STALE_VERSION");
        assert.deepEqual(stale.issued_codes, []);
        await budgets();
        const applied = await service.commit(
          actor.sessionCookie,
          await intent(actor, input.csv),
        );
        assert.equal(applied.issued_codes.length, 1);
        assert.equal(applied.issued_codes[0]!.registration_id, "REG-3");
        await budgets();
        assert.deepEqual(
          (await service.commit(actor.sessionCookie, input)).outcome,
          stale.outcome,
        );
        const team = applied.issued_codes[0]!.team_id,
          members = (
            await owner.query(
              "SELECT id,display_name FROM team_members WHERE team_id=$1 ORDER BY position",
              [team],
            )
          ).rows;
        await budgets();
        await teams.command(actor.sessionCookie, {
          action: "ROTATE",
          targetId: team,
          requestKey: randomUUID(),
          expectedRevision: "1",
          teamName: null,
          memberOne: null,
          memberTwo: null,
          reason: "Synthetic rotation after import",
          ownCode: actor.code,
        });
        await budgets();
        const repeated = await service.commit(
          actor.sessionCookie,
          await intent(actor, input.csv),
        );
        assert.equal(repeated.outcome.outcome, "UNCHANGED");
        assert.deepEqual(repeated.issued_codes, []);
        assert.deepEqual(
          (
            await owner.query(
              "SELECT id,display_name FROM team_members WHERE team_id=$1 ORDER BY position",
              [team],
            )
          ).rows,
          members,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT max(version) AS v FROM access_credentials WHERE team_id=$1",
              [team],
            )
          ).rows[0].v,
          "2",
        );
      },
    );
    await t.test(
      "all import boundaries enforce role, confirmation, immutable mappings and current authority",
      async () => {
        const input = await intent(actor, file("REG-5,Fifth team,One,Two"));
        await assert.rejects(
          service.preview(organiser.sessionCookie, input.csv),
          denied("ACCESS_UNAVAILABLE"),
        );
        await assert.rejects(
          service.commit(organiser.sessionCookie, input),
          denied("ACCESS_UNAVAILABLE"),
        );
        await budgets();
        await assert.rejects(
          service.commit(actor.sessionCookie, {
            ...input,
            ownCode: other.code,
          }),
          denied("STAFF_CONFIRMATION_REQUIRED"),
        );
        await budgets();
        await assert.rejects(
          service.commit(actor.sessionCookie, {
            ...input,
            csv: input.csv + "\n",
          }),
          denied("INVALID_CONTEXT"),
        );
        await assert.rejects(
          api.query(
            "INSERT INTO registration_sources(registration_id,team_id,import_id) SELECT 'FORGED',team_id,import_id FROM registration_sources LIMIT 1",
          ),
          { code: "42501" },
        );
        await assert.rejects(
          api.query(
            "INSERT INTO registration_import_outcomes SELECT * FROM registration_import_outcomes LIMIT 1",
          ),
          { code: "42501" },
        );
        await assert.rejects(
          owner.query(
            "UPDATE registration_sources SET registration_id='overwrite'",
          ),
          { code: "P0001" },
        );
        await assert.rejects(
          owner.query("DELETE FROM registration_import_outcomes"),
          { code: "P0001" },
        );
        await assert.rejects(
          api.query("SELECT registration_import_preview($1)", [
            JSON.stringify([
              {
                row: 2,
                registration_id: "REG-X",
                team_name: "Team",
                member_1_name: "One",
                member_2_name: "Two",
                extra: true,
              },
            ]),
          ]),
          { code: "22023" },
        );
        const doomed = await person(),
          done = await service.commit(
            doomed.sessionCookie,
            await intent(doomed, file("REG-5,Fifth team,One,Two")),
          );
        await owner.query(
          "UPDATE staff_identities SET disabled_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1",
          [doomed.id],
        );
        await assert.rejects(
          service.outcome(doomed.sessionCookie, done.outcome.request_key),
          denied("INVALID_SESSION"),
        );
      },
    );
    await t.test(
      "a mid-import credential failure rolls back every new team, source and receipt",
      async () => {
        const csv = file(
            "ROLLBACK-1,First rollback team,One,Two",
            "ROLLBACK-2,Second rollback team,One,Two",
          ),
          parsed = registrationCsv(csv),
          revision = (await service.preview(actor.sessionCookie, csv))
            .control_revision,
          before = (
            await owner.query(
              "SELECT (SELECT count(*) FROM teams)::int AS teams,(SELECT count(*) FROM registration_sources)::int AS sources,(SELECT count(*) FROM registration_import_outcomes)::int AS receipts",
            )
          ).rows;
        await assert.rejects(
          api.query(
            "SELECT * FROM import_registrations_command($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              actor.session.session_id,
              randomUUID(),
              revision,
              Buffer.from(parsed.digest, "hex"),
              JSON.stringify(parsed.rows),
              "Synthetic atomic rollback",
              sha256(actor.code),
              JSON.stringify([
                {
                  registration_id: "ROLLBACK-1",
                  verifier: newAccessCode().verifier.toString("hex"),
                },
                {
                  registration_id: "ROLLBACK-2",
                  verifier: sha256(actor.code).toString("hex"),
                },
              ]),
            ],
          ),
          { code: "23505" },
        );
        assert.deepEqual(
          (
            await owner.query(
              "SELECT (SELECT count(*) FROM teams)::int AS teams,(SELECT count(*) FROM registration_sources)::int AS sources,(SELECT count(*) FROM registration_import_outcomes)::int AS receipts",
            )
          ).rows,
          before,
        );
      },
    );
    await t.test(
      "CSV HTTP preview/import bind staff CSRF, strict fields and no-store one-time delivery",
      async () => {
        const settings = {
            mode: "production" as const,
            origin: "https://ingenium.test",
            cookieKey: randomBytes(32),
            csrfKey: randomBytes(32),
          },
          policy = browserPolicy(settings),
          cookies = new Map<string, string>(),
          app = buildApp({
            database: { async check() {}, async close() {} },
            entry: { pool: api, clock, delivery, browser: settings },
          });
        await app.ready();
        async function send(
          url: string,
          body?: unknown,
          token?: string,
          origin = settings.origin,
        ) {
          const r = await app.inject({
            method: body === undefined ? "GET" : "POST",
            url,
            headers: {
              origin,
              cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join(";"),
              ...(body === undefined
                ? {}
                : {
                    "content-type": "application/json",
                    "x-csrf-token": token ?? "",
                  }),
            },
            ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
          });
          const lines = r.headers["set-cookie"];
          for (const line of typeof lines === "string"
            ? [lines]
            : (lines ?? [])) {
            const pair = line.split(";")[0]!,
              at = pair.indexOf("=");
            cookies.set(pair.slice(0, at), pair.slice(at + 1));
          }
          return r;
        }
        try {
          await budgets();
          const anon = await send("/api/v1/bootstrap?audience=ANONYMOUS");
          cookies.set(policy.names.staff, actor.sessionCookie);
          const token = (await send("/api/v1/bootstrap?audience=STAFF")).json()
              .data.csrf_token,
            csv = file('HTTP-1,"HTTP, team",One,Two');
          assert.equal(
            (
              await send(
                "/api/v1/staff/registrations/preview",
                { csv },
                anon.json().data.csrf_token,
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (
              await send(
                "/api/v1/staff/registrations/preview",
                { csv },
                token,
                "https://foreign.test",
              )
            ).statusCode,
            403,
          );
          const preview = await send(
            "/api/v1/staff/registrations/preview",
            { csv },
            token,
          );
          assert.equal(preview.statusCode, 200);
          assert.equal(preview.json().data.can_import, true);
          assert.equal(
            (
              await send(
                "/api/v1/staff/registrations/preview",
                { csv: header + ",email\nR,Team,One,Two,email" },
                token,
              )
            ).json().data.issues[0].code,
            "EXPECTED_COLUMNS",
          );
          const b = {
            csv,
            csv_digest: preview.json().data.csv_digest,
            request_key: randomUUID(),
            expected_revision: preview.json().data.control_revision,
            own_code: actor.code,
            reason: "Synthetic HTTP import",
          };
          assert.equal(
            (
              await send(
                "/api/v1/staff/registrations/import",
                { ...b, force: true },
                token,
              )
            ).statusCode,
            400,
          );
          await budgets();
          const result = await send(
            "/api/v1/staff/registrations/import",
            b,
            token,
          );
          assert.equal(result.statusCode, 200);
          assert.equal(result.headers["cache-control"], "no-store");
          assert.equal(result.json().data.issued_codes.length, 1);
          const read = await send(
            `/api/v1/staff/outcomes/registrations/${b.request_key}`,
          );
          assert.equal(read.json().data.status, "OBSERVED");
          assert.equal(
            read.body.includes(result.json().data.issued_codes[0].code),
            false,
          );
          assert.deepEqual(
            (await send("/api/v1/staff/registrations/import", b, token)).json()
              .data.issued_codes,
            [],
          );
          cookies.set(policy.names.staff, organiser.sessionCookie);
          assert.equal(
            (
              await send(
                `/api/v1/staff/outcomes/registrations/${b.request_key}`,
              )
            ).statusCode,
            403,
          );
        } finally {
          await app.close();
        }
      },
    );
    await t.test(
      "capacity refuses a whole batch but repeated uploads still work at the 1000-team cap",
      async () => {
        const count = (
          await owner.query("SELECT count(*)::int AS n FROM teams")
        ).rows[0].n;
        for (let start = count; start < 999; start += 100) {
          const length = Math.min(100, 999 - start),
            bulk = file(
              ...Array.from(
                { length },
                (_, i) => `BULK-${start + i},Synthetic import capacity,One,Two`,
              ),
            );
          const bulkResult = await service.commit(
            actor.sessionCookie,
            await intent(actor, bulk),
          );
          assert.equal(bulkResult.outcome.outcome, "APPLIED");
          assert.equal(bulkResult.issued_codes.length, length);
        }
        const csv = file("CAP-1,New one,One,Two", "CAP-2,New two,One,Two"),
          input = await intent(actor, csv);
        assert.equal(
          (await service.preview(actor.sessionCookie, csv)).reason,
          "TEAM_CAPACITY",
        );
        const rejected = await service.commit(actor.sessionCookie, input);
        assert.equal(rejected.outcome.reason, "TEAM_CAPACITY");
        assert.deepEqual(rejected.issued_codes, []);
        assert.equal(
          (await owner.query("SELECT count(*)::int AS n FROM teams")).rows[0].n,
          999,
        );
        await budgets();
        await service.commit(
          actor.sessionCookie,
          await intent(actor, file("CAP-1,New one,One,Two")),
        );
        await budgets();
        const repeated = await service.commit(
          actor.sessionCookie,
          await intent(actor, file("REG-1,Same team,Same member,Same member")),
        );
        assert.equal(repeated.outcome.outcome, "UNCHANGED");
        assert.equal(
          (await owner.query("SELECT count(*)::int AS n FROM teams")).rows[0].n,
          1000,
        );
      },
    );
  } finally {
    await api.end();
    await owner.end();
  }
}
