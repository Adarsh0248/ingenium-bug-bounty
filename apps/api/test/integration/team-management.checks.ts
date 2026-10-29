import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { migrateDatabase } from "../../src/db/migrate.js";
import {
  newAccessCode,
  sessionDelivery,
} from "../../src/access/credentials.js";
import { createTeamManagement } from "../../src/access/team-management.js";
import type { TeamCommand } from "../../src/access/team-management.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createReplacementService } from "../../src/access/replacement-service.js";
import { AccessError } from "../../src/access/transaction.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";

export async function teamManagementChecks(
  t: TestContext,
  ownerConnection: string,
  apiConnection: string,
) {
  const name = `ingenium_teams_${randomUUID().replaceAll("-", "")}`,
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
    api = new Pool({ connectionString: apiUrl.toString(), max: 4 });
  let healthy = true;
  const clock = {
      assertHealthy() {
        if (!healthy) throw new AccessError("CLOCK_UNTRUSTED");
      },
      async verify() {},
      fault() {},
    },
    delivery = sessionDelivery("synthetic-teams", randomBytes(32)),
    staff = createStaffService(api, clock, delivery),
    entry = createEntryService(api, clock, delivery),
    raw = createTeamManagement(api, clock, delivery),
    replacements = createReplacementService(api, clock, delivery);
  // Synthetic checks exercise many confirmations immediately; production quotas stay unchanged.
  const service = {
    ...raw,
    async command(...args: Parameters<typeof raw.command>) {
      await owner.query("DELETE FROM quota_buckets");
      return raw.command(...args);
    },
  };
  const denied = (code: string) => (e: unknown) =>
    e instanceof AccessError && e.code === code;
  async function person(role = "OWNER") {
    const id = randomUUID(),
      code = newAccessCode();
    await owner.query(
      "INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic team manager',$2)",
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
    if (flow.audience !== "STAFF") throw Error("Synthetic staff route");
    return {
      id,
      code: code.code,
      ...(await staff.activate(flow.proofCookie, randomUUID())),
    };
  }
  async function input(
    code: string,
    patch: Partial<TeamCommand> = {},
  ): Promise<TeamCommand> {
    return {
      action: "CREATE",
      targetId: null,
      requestKey: randomUUID(),
      expectedRevision: (
        await owner.query("SELECT revision FROM security_control WHERE id=1")
      ).rows[0].revision,
      ownCode: code,
      teamName: "Synthetic registered team",
      memberOne: "Same member label",
      memberTwo: "Same member label",
      reason: "Synthetic registration approval",
      ...patch,
    };
  }
  try {
    const actor = await person(),
      other = await person("SUPER_ADMIN"),
      organiser = await person("ORGANISER");
    await t.test("staff edit team/member labels without changing identities or codes, and delete once without erasing history", async () => {
      const created = await service.command(organiser.sessionCookie, await input(organiser.code));
      const target = created.outcome.result_team_id!;
      const members = (await owner.query("SELECT id,position FROM team_members WHERE team_id=$1 ORDER BY position", [target])).rows;
      const credentials = (await owner.query("SELECT * FROM access_credentials WHERE team_id=$1", [target])).rows;
      const edit = await input(organiser.code, { action: "EDIT", targetId: target, teamName: "Renamed team", memberOne: "Updated first", memberTwo: "Updated second" });
      const replies = await Promise.all([service.command(organiser.sessionCookie, edit), service.command(organiser.sessionCookie, edit)]);
      assert.deepEqual(replies[0], replies[1]); assert.equal(replies[0].outcome.outcome, "APPLIED"); assert.equal(replies[0].issued_code, null);
      assert.deepEqual((await owner.query("SELECT id,position FROM team_members WHERE team_id=$1 ORDER BY position", [target])).rows, members);
      assert.deepEqual((await owner.query("SELECT * FROM access_credentials WHERE team_id=$1", [target])).rows, credentials);
      assert.deepEqual((await owner.query("SELECT display_name FROM team_members WHERE team_id=$1 ORDER BY position", [target])).rows.map(m => m.display_name), ["Updated first", "Updated second"]);
      const stale = await service.command(actor.sessionCookie, { ...edit, ownCode: actor.code, requestKey: randomUUID(), teamName: "Stale overwrite" });
      assert.equal(stale.outcome.reason, "STALE_VERSION");
      const remove = await input(organiser.code, { action: "DELETE", targetId: target, teamName: null, memberOne: null, memberTwo: null });
      const deleted = await service.command(organiser.sessionCookie, remove);
      assert.equal(deleted.outcome.outcome, "APPLIED"); assert.equal(deleted.issued_code, null);
      assert.deepEqual(await service.command(organiser.sessionCookie, remove), deleted);
      assert.ok((await owner.query("SELECT deleted_at FROM teams WHERE id=$1", [target])).rows[0].deleted_at);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM team_members WHERE team_id=$1", [target])).rows[0].n, 2);
      assert.equal((await service.list(organiser.sessionCookie, undefined, "Renamed team")).items.length, 0);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM access_credentials WHERE team_id=$1 AND revoked_at IS NULL", [target])).rows[0].n, 0);
      await assert.rejects(entry.begin(created.issued_code!, {ip:"127.0.0.1",browserId:randomUUID()}), denied("INVALID_CODE"));
      const retry = await service.command(actor.sessionCookie, await input(actor.code, { action: "DELETE", targetId: target, teamName: null, memberOne: null, memberTwo: null }));
      assert.equal(retry.outcome.reason, "TEAM_DELETED");
      await assert.rejects(api.query("UPDATE teams SET deleted_at=NULL WHERE id=$1", [target]), {code:"42501"});
      await assert.rejects(owner.query("DELETE FROM team_management_outcomes WHERE id=$1", [deleted.outcome.outcome_id]), {code:"P0001"});
    });
    await t.test(
      "team creation is atomic with two stable members, one-time codes and duplicate recovery",
      async () => {
        const command = await input(actor.code),
          replies = await Promise.all([
            service.command(actor.sessionCookie, command),
            service.command(actor.sessionCookie, command),
          ]);
        assert.deepEqual(replies[0].outcome, replies[1].outcome);
        assert.equal(replies.filter((r) => r.issued_code !== null).length, 1);
        const target = replies[0].outcome.result_team_id!,
          members = (
            await owner.query(
              "SELECT id,position,display_name FROM team_members WHERE team_id=$1 ORDER BY position",
              [target],
            )
          ).rows;
        assert.equal(members.length, 2);
        assert.notEqual(members[0].id, members[1].id);
        assert.deepEqual(
          members.map((m) => m.position),
          [1, 2],
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM member_session_slots WHERE member_id=ANY($1::uuid[])",
              [members.map((m) => m.id)],
            )
          ).rows[0].n,
          2,
        );
        assert.deepEqual(
          (await service.outcome(actor.sessionCookie, command.requestKey))
            .outcome,
          replies[0].outcome,
        );
        assert.equal(
          (await service.outcome(other.sessionCookie, command.requestKey))
            .status,
          "NOT_OBSERVED",
        );
        await assert.rejects(
          service.command(actor.sessionCookie, {
            ...command,
            memberOne: "Changed intent",
          }),
          { code: "P0002" },
        );
        const stored = JSON.stringify(
          (await owner.query("SELECT * FROM team_management_outcomes")).rows,
        );
        for (const code of [
          actor.code,
          replies.find((r) => r.issued_code)!.issued_code!,
        ])
          assert.equal(stored.includes(code), false);
        assert.equal(
          (await service.command(other.sessionCookie, await input(other.code)))
            .outcome.outcome,
          "APPLIED",
        );
      },
    );
    await t.test(
      "registration permissions, own-code, UTF-8 validation and immutable history are enforced",
      async () => {
        assert.ok((await service.list(organiser.sessionCookie)).total > 0);
        assert.equal((await service.command(organiser.sessionCookie, await input(organiser.code))).outcome.outcome,"APPLIED");
        await assert.rejects(
          service.command(actor.sessionCookie, await input(other.code)),
          denied("STAFF_CONFIRMATION_REQUIRED"),
        );
        for (const teamName of [
          " ",
          "x".repeat(121),
          "\u00e9".repeat(61),
          "bad\0name",
        ])
          await assert.rejects(
            service.command(
              actor.sessionCookie,
              await input(actor.code, { teamName }),
            ),
            denied("INVALID_CONTEXT"),
          );
        assert.equal(
          (
            await service.command(
              actor.sessionCookie,
              await input(actor.code, { teamName: "\u00e9".repeat(60) }),
            )
          ).outcome.outcome,
          "APPLIED",
        );
        await assert.rejects(
          api.query(
            "INSERT INTO teams(id,display_name) VALUES($1,'Forbidden')",
            [randomUUID()],
          ),
          { code: "42501" },
        );
        await assert.rejects(
          api.query(
            "INSERT INTO team_management_outcomes SELECT * FROM team_management_outcomes LIMIT 1",
          ),
          { code: "42501" },
        );
        await assert.rejects(
          owner.query("UPDATE team_management_outcomes SET reason='overwrite'"),
          { code: "P0001" },
        );
        await assert.rejects(
          owner.query("DELETE FROM team_management_outcomes"),
          { code: "P0001" },
        );
        healthy = false;
        await assert.rejects(
          service.list(actor.sessionCookie),
          denied("CLOCK_UNTRUSTED"),
        );
        healthy = true;
      },
    );
    await t.test(
      "stale creates and rotations reject durably without issuing another credential",
      async () => {
        const command = await input(actor.code),
          replies = await Promise.all([
            service.command(actor.sessionCookie, command),
            service.command(actor.sessionCookie, {
              ...command,
              requestKey: randomUUID(),
            }),
          ]);
        assert.equal(
          replies.filter((r) => r.outcome.outcome === "APPLIED").length,
          1,
        );
        assert.equal(
          replies.find((r) => r.outcome.outcome === "REJECTED")!.outcome.reason,
          "STALE_VERSION",
        );
        const created = replies.find((r) => r.issued_code)!,
          rotate = await input(actor.code, {
            action: "ROTATE",
            targetId: created.outcome.result_team_id,
            expectedRevision: "1",
            teamName: null,
            memberOne: null,
            memberTwo: null,
          });
        const rotated = await service.command(actor.sessionCookie, rotate);
        assert.equal(rotated.outcome.code_version, "2");
        assert.equal(
          (await service.command(actor.sessionCookie, rotate)).issued_code,
          null,
        );
        const stale = await service.command(actor.sessionCookie, {
          ...rotate,
          requestKey: randomUUID(),
        });
        assert.equal(stale.outcome.reason, "STALE_VERSION");
        assert.deepEqual(
          (
            await service.command(actor.sessionCookie, {
              ...rotate,
              requestKey: stale.outcome.request_key,
            })
          ).outcome,
          stale.outcome,
        );
      },
    );
    await t.test(
      "live rotation retires both sessions and approved/pending handoffs without changing enrollment",
      async () => {
        const made = await service.command(
            actor.sessionCookie,
            await input(actor.code),
          ),
          id = made.outcome.result_team_id!,
          members = (
            await owner.query(
              "SELECT id FROM team_members WHERE team_id=$1 ORDER BY position",
              [id],
            )
          ).rows.map((r) => r.id);
        const arena = randomUUID(),
          round = randomUUID(),
          teamRound = randomUUID();
        await owner.query(
          `WITH a AS (INSERT INTO arena_instances(id,status,created_by,created_at) VALUES($1,'IN_PROGRESS',$2,date_trunc('milliseconds',clock_timestamp())) RETURNING id)
        UPDATE arena_control SET current_instance_id=a.id,revision=revision+1 FROM a WHERE arena_control.id=1`,
          [arena, actor.id],
        );
        await owner.query(
          `INSERT INTO rounds(id,arena_instance_id,kind,state,duration_ms,started_at,closes_at) VALUES($1,$2,1,'RUNNING',3600000,date_trunc('milliseconds',clock_timestamp())-interval '1 minute',date_trunc('milliseconds',clock_timestamp())+interval '59 minutes')`,
          [round, arena],
        );
        await owner.query(
          "INSERT INTO team_rounds(id,team_id,round_id,display_name) VALUES($1,$2,$3,'Frozen team')",
          [teamRound, id, round],
        );
        for (const member of members)
          await owner.query(
            "INSERT INTO member_rounds(id,team_round_id,team_id,member_id,round_id,display_name) VALUES($1,$2,$3,$4,$5,'Frozen member')",
            [randomUUID(), teamRound, id, member, round],
          );
        async function flow(code = made.issued_code!) {
          const f = await entry.begin(code, {
            ip: "127.0.0.1",
            browserId: randomUUID(),
          });
          if (f.audience !== "TEAM") throw Error("Synthetic team route");
          return f;
        }
        for (const action of ["EDIT", "DELETE"] as const) {
          const result = await service.command(actor.sessionCookie, await input(actor.code, {
            action, targetId:id, ...(action === "DELETE" ? {teamName:null,memberOne:null,memberTwo:null} : {}),
          }));
          assert.equal(result.outcome.reason, "TEAM_IN_USE");
        }
        const sessions = [];
        for (const [i, member] of members.entries()) {
          const f = await flow(),
            s = await entry.activate(f.proofCookie, {
              memberId: member,
              language: i === 0 ? "cpp" : "python",
              requestKey: randomUUID(),
            });
          if (s.status !== "ACTIVATED") throw Error("Synthetic activation");
          sessions.push(s);
        }
        const pending = await replacements.request((await flow()).proofCookie, {
          memberId: members[0],
          requestKey: randomUUID(),
        });
        const approved = await replacements.request(
          (await flow()).proofCookie,
          { memberId: members[1], requestKey: randomUUID() },
        );
        if (pending.status !== "REQUESTED" || approved.status !== "REQUESTED")
          throw Error("Synthetic replacement");
        const request = (
          await replacements.list(actor.sessionCookie)
        ).items.find((r) => r.request_id === approved.request.request_id)!;
        await replacements.decide(actor.sessionCookie, {
          flowId: request.request_id,
          requestKey: randomUUID(),
          action: "APPROVE",
          expectedRevision: request.expected_revision,
          reason: "Synthetic handoff",
        });
        const before = (
          await owner.query(
            "SELECT * FROM member_rounds WHERE team_id=$1 ORDER BY id",
            [id],
          )
        ).rows;
        const rotated = await service.command(
          actor.sessionCookie,
          await input(actor.code, {
            action: "ROTATE",
            targetId: id,
            expectedRevision: "1",
            teamName: null,
            memberOne: null,
            memberTwo: null,
          }),
        );
        assert.equal(rotated.outcome.outcome, "APPLIED");
        for (const s of sessions)
          await assert.rejects(
            entry.inspect(s.sessionCookie),
            denied("INVALID_SESSION"),
          );
        await assert.rejects(flow(), denied("INVALID_CODE"));
        assert.deepEqual(
          (
            await owner.query(
              "SELECT * FROM member_rounds WHERE team_id=$1 ORDER BY id",
              [id],
            )
          ).rows,
          before,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM replacement_requests WHERE team_id=$1 AND (state IN ('PENDING','APPROVED') OR proof_ciphertext IS NOT NULL)",
              [id],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM member_session_slots WHERE member_id=ANY($1::uuid[]) AND (session_id IS NOT NULL OR reservation_flow_id IS NOT NULL)",
              [members],
            )
          ).rows[0].n,
          0,
        );
        assert.equal((await flow(rotated.issued_code!)).members.length, 2);
      },
    );
    await t.test(
      "team HTTP commands require exact origin and staff CSRF and never read back codes",
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
            const [pair] = line.split(";"),
              at = pair!.indexOf("=");
            cookies.set(pair!.slice(0, at), pair!.slice(at + 1));
          }
          return r;
        }
        try {
          assert.equal((await send("/api/v1/staff/teams")).statusCode, 401);
          const anon = await send("/api/v1/bootstrap?audience=ANONYMOUS");
          cookies.set(policy.names.staff, actor.sessionCookie);
          const boot = await send("/api/v1/bootstrap?audience=STAFF"),
            token = boot.json().data.csrf_token;
          const body = {
            request_key: randomUUID(),
            expected_revision: (await service.list(actor.sessionCookie))
              .control_revision,
            team_name: "Synthetic HTTP team",
            member_one: "One",
            member_two: "Two",
            reason: "Synthetic approval",
            own_code: actor.code,
          };
          assert.equal(
            (
              await send(
                "/api/v1/staff/teams",
                body,
                anon.json().data.csrf_token,
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (
              await send(
                "/api/v1/staff/teams",
                body,
                token,
                "https://foreign.test",
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (
              await send(
                "/api/v1/staff/teams",
                { ...body, member_three: "Three" },
                token,
              )
            ).statusCode,
            400,
          );
          assert.equal(
            (
              await send(
                "/api/v1/staff/teams",
                { ...body, own_code: other.code },
                token,
              )
            ).json().error.code,
            "STAFF_CONFIRMATION_REQUIRED",
          );
          await owner.query("DELETE FROM quota_buckets");
          const result = await send("/api/v1/staff/teams", body, token);
          assert.equal(result.statusCode, 200);
          assert.match(result.json().data.issued_code, /^[A-Z2-7]{8}$/);
          assert.equal(result.headers["cache-control"], "no-store");
          assert.equal(
            (await send("/api/v1/staff/teams", body, token)).json().data
              .issued_code,
            null,
          );
          const read = await send(
            `/api/v1/staff/outcomes/teams/${body.request_key}`,
          );
          assert.equal(read.json().data.status, "OBSERVED");
          assert.equal(
            read.body.includes(result.json().data.issued_code),
            false,
          );
          const listing = await send("/api/v1/staff/teams");
          assert.equal(listing.statusCode, 200);
          assert.doesNotMatch(
            listing.body,
            /verifier|credential_id|ciphertext|issued_code/,
          );
          cookies.set(policy.names.staff, organiser.sessionCookie);
          assert.equal((await send("/api/v1/staff/teams")).statusCode, 200);
        } finally {
          await app.close();
        }
      },
    );
    await t.test(
      "registration cap and pagination are bounded, while rotation remains possible at capacity",
      async () => {
        const count = (
          await owner.query("SELECT count(*)::int AS n FROM teams WHERE deleted_at IS NULL")
        ).rows[0].n;
        await owner.query(
          "INSERT INTO teams(id,display_name) SELECT gen_random_uuid(),'Synthetic capacity team' FROM generate_series(1,$1::int)",
          [1000 - count],
        );
        const command = await input(actor.code),
          reply = await service.command(actor.sessionCookie, command);
        assert.equal(reply.outcome.reason, "TEAM_CAPACITY");
        assert.equal(reply.issued_code, null);
        const page = await service.list(actor.sessionCookie);
        assert.equal(page.items.length, 50);
        assert.ok(page.next_after);
        assert.equal(page.total, 1000);
        const next = await service.list(actor.sessionCookie, page.next_after!);
        assert.equal(
          new Set([...page.items, ...next.items].map((r) => r.team_id)).size,
          100,
        );
        const team =
          page.items.find((r) => r.members.length === 2) ??
          (
            await owner.query(
              "SELECT id AS team_id FROM teams WHERE id IN (SELECT team_id FROM team_members GROUP BY team_id HAVING count(*)=2) LIMIT 1",
            )
          ).rows[0];
        const version = (
          await owner.query(
            "SELECT max(version)::text AS v FROM access_credentials WHERE team_id=$1",
            [team.team_id],
          )
        ).rows[0].v;
        assert.equal(
          (
            await service.command(
              actor.sessionCookie,
              await input(actor.code, {
                action: "ROTATE",
                targetId: team.team_id,
                expectedRevision: version,
                teamName: null,
                memberOne: null,
                memberTwo: null,
              }),
            )
          ).outcome.outcome,
          "APPLIED",
        );
        await owner.query(
          "DELETE FROM teams WHERE id IN (SELECT id FROM teams WHERE display_name='Synthetic capacity team' LIMIT 1)",
        );
        assert.deepEqual(
          (await service.command(actor.sessionCookie, command)).outcome,
          reply.outcome,
        );
      },
    );
    await t.test(
      "team code rotation refuses a reversed enrolled-round clock without changing credentials",
      async () => {
        const team = (
          await owner.query(
            "SELECT team_id,round_id FROM member_rounds LIMIT 1",
          )
        ).rows[0];
        const before = (
          await owner.query(
            "SELECT id,version,revoked_at FROM access_credentials WHERE team_id=$1 ORDER BY version",
            [team.team_id],
          )
        ).rows;
        await owner.query(
          "UPDATE rounds SET trusted_time_at=date_trunc('milliseconds',clock_timestamp())+interval '1 minute' WHERE id=$1",
          [team.round_id],
        );
        await assert.rejects(
          service.command(
            actor.sessionCookie,
            await input(actor.code, {
              action: "ROTATE",
              targetId: team.team_id,
              expectedRevision: before.at(-1)!.version,
              teamName: null,
              memberOne: null,
              memberTwo: null,
            }),
          ),
          denied("CLOCK_UNTRUSTED"),
        );
        assert.deepEqual(
          (
            await owner.query(
              "SELECT id,version,revoked_at FROM access_credentials WHERE team_id=$1 ORDER BY version",
              [team.team_id],
            )
          ).rows,
          before,
        );
      },
    );
  } finally {
    await api.end();
    await owner.end();
  }
}
