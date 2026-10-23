import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createTeamManagement } from "../../src/access/team-management.js";
import type { TeamCommand } from "../../src/access/team-management.js";
import { createRegistrationImport } from "../../src/access/registration-import.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createReplacementService } from "../../src/access/replacement-service.js";
import { createLiveService } from "../../src/live/service.js";
import { AccessError } from "../../src/access/transaction.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { teamAccessBrowserChecks } from "./team-access-browser.checks.js";

export async function teamAccessChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    teams: { id: string; code: string; members: string[] }[];
  },
) {
  const service = createTeamManagement(c.api, c.clock, c.delivery),
    importer = createRegistrationImport(c.api, c.clock, c.delivery),
    entry = createEntryService(c.api, c.clock, c.delivery),
    replacements = createReplacementService(c.api, c.clock, c.delivery),
    live = createLiveService(c.api, c.clock, c.delivery),
    query = async (sql: string, p: unknown[] = []) =>
      (await c.owner.query(sql, p)).rows,
    denied = (code: string) => (e: unknown) =>
      e instanceof AccessError && e.code === code;
  const csv =
    "registration_id,team_name,member_1_name,member_2_name\r\n" +
    [
      ...Array.from(
        { length: 57 },
        (_, i) =>
          `POOL-${i},Locator Team ${i},Search participant ${i},Partner ${i}`,
      ),
      "LITERAL-EXACT,Literal%_name,Precise Person,Another Member",
    ].join("\r\n") +
    "\r\n";
  await c.budgets();
  const preview = await importer.preview(c.staff.sessionCookie, csv);
  const imported = await importer.commit(c.staff.sessionCookie, {
    csv,
    csvDigest: preview.csv_digest,
    expectedRevision: preview.control_revision,
    requestKey: randomUUID(),
    ownCode: c.staff.code,
    reason: "Synthetic search fixtures",
  });
  assert.equal(imported.issued_codes.length, 58);
  async function input(
    team: string,
    action: TeamCommand["action"],
    patch: Partial<TeamCommand> = {},
  ): Promise<TeamCommand> {
    return {
      action,
      targetId: team,
      requestKey: randomUUID(),
      expectedRevision: (
        await query(
          "SELECT coalesce(max(version),0)::text v FROM access_credentials WHERE team_id=$1",
          [team],
        )
      )[0].v,
      teamName: null,
      memberOne: null,
      memberTwo: null,
      reason: "Synthetic team access change",
      ownCode: c.staff.code,
      ...patch,
    };
  }
  async function command(p: TeamCommand) {
    await c.budgets();
    return service.command(c.staff.sessionCookie, p);
  }
  await t.test(
    "private search covers team/member/registration labels, literal wildcards and scoped bounded pages without renewing activity",
    async () => {
      await c.budgets();
      const before = await query(
          "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
        ),
        one = await service.list(c.staff.sessionCookie, undefined, "pool-");
      assert.equal(one.matched, 57);
      assert.equal(one.items.length, 50);
      assert.ok(one.next_after);
      assert.equal(one.search, "pool-");
      const two = await service.list(
        c.staff.sessionCookie,
        one.next_after!,
        "pool-",
      );
      assert.equal(two.items.length, 7);
      assert.equal(two.matched, 57);
      assert.equal(
        new Set([...one.items, ...two.items].map((i) => i.team_id)).size,
        57,
      );
      for (const term of ["literal%_NAME", "Precise Person", "LITERAL-EXACT"]) {
        const page = await service.list(c.staff.sessionCookie, undefined, term);
        assert.equal(page.matched, 1);
        assert.equal(page.items[0].team_name, "Literal%_name");
      }
      assert.equal(
        (await service.list(c.staff.sessionCookie, undefined, "%_")).matched,
        1,
      );
      assert.equal(
        (await service.list(c.staff.sessionCookie, undefined, "' OR true --"))
          .matched,
        0,
      );
      await assert.rejects(
        service.list(c.staff.sessionCookie, one.next_after!, "Precise Person"),
        denied("INVALID_CONTEXT"),
      );
      await assert.rejects(
        service.list(c.organiser.sessionCookie, undefined, "POOL"),
        denied("ACCESS_UNAVAILABLE"),
      );
      assert.deepEqual(
        await query(
          "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
        ),
        before,
      );
      assert.doesNotMatch(
        JSON.stringify([one, two]),
        /verifier|credential_id|ciphertext|issued_code/,
      );
    },
  );
  await t.test(
    "revoke has an immutable original receipt, issues no secret and fences stale rotation and duplicate issuance",
    async () => {
      const team = imported.issued_codes[0]!.team_id,
        p = await input(team, "REVOKE"),
        before = await query(
          "SELECT * FROM access_credentials WHERE team_id=$1",
          [team],
        );
      const untrusted = createTeamManagement(
        c.api,
        {
          ...c.clock,
          assertHealthy() {
            throw new AccessError("CLOCK_UNTRUSTED");
          },
        },
        c.delivery,
      );
      await assert.rejects(
        untrusted.command(c.staff.sessionCookie, p),
        denied("CLOCK_UNTRUSTED"),
      );
      await c.budgets();
      await assert.rejects(
        service.command(c.organiser.sessionCookie, p),
        denied("ACCESS_UNAVAILABLE"),
      );
      await assert.rejects(
        command({ ...p, ownCode: "A".repeat(32) }),
        denied("STAFF_CONFIRMATION_REQUIRED"),
      );
      const result = await command(p);
      assert.equal(result.outcome.outcome, "APPLIED");
      assert.equal(result.issued_code, null);
      assert.equal(
        (
          await query("SELECT * FROM access_credentials WHERE team_id=$1", [
            team,
          ])
        ).length,
        before.length,
      );
      assert.ok(
        (
          await query(
            "SELECT revoked_at FROM access_credentials WHERE team_id=$1",
            [team],
          )
        )[0].revoked_at,
      );
      const activity = await query(
        "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
      );
      assert.deepEqual(await command(p), result);
      assert.deepEqual(
        (await service.outcome(c.staff.sessionCookie, p.requestKey)).outcome,
        result.outcome,
      );
      assert.deepEqual(
        await query(
          "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
        ),
        activity,
      );
      await assert.rejects(command({ ...p, reason: "Changed intent" }), {
        code: "P0002",
      });
      assert.equal(
        (await command({ ...p, requestKey: randomUUID(), action: "ROTATE" }))
          .outcome.reason,
        "CODE_INACTIVE",
      );
      assert.equal(
        (await command({ ...p, requestKey: randomUUID() })).outcome.reason,
        "CODE_INACTIVE",
      );
      const issued = await command(await input(team, "ISSUE"));
      assert.equal(issued.outcome.code_version, "2");
      assert.ok(issued.issued_code);
      assert.equal(
        (await command(await input(team, "ISSUE"))).outcome.reason,
        "CODE_ACTIVE",
      );
      assert.equal((await command(p)).issued_code, null);
      await assert.rejects(
        c.api.query(
          "UPDATE access_credentials SET revoked_at=NULL WHERE team_id=$1",
          [team],
        ),
        { code: "42501" },
      );
      await assert.rejects(
        c.owner.query("DELETE FROM team_management_outcomes WHERE id=$1", [
          result.outcome.outcome_id,
        ]),
      );
    },
  );
  await t.test(
    "simultaneous revoke/rotate or issue commands serialize without restoring a revoked code through stale intent",
    async () => {
      const team = imported.issued_codes[1]!.team_id,
        revoke = await input(team, "REVOKE"),
        rotate = {
          ...revoke,
          action: "ROTATE" as const,
          requestKey: randomUUID(),
        };
      await c.budgets();
      const outcomes = await Promise.all([
        service.command(c.staff.sessionCookie, revoke),
        service.command(c.staff.sessionCookie, rotate),
      ]);
      assert.equal(
        outcomes.filter((v) => v.outcome.outcome === "APPLIED").length,
        1,
      );
      const refused = outcomes.find((v) => v.outcome.outcome === "REJECTED")!;
      assert.ok(
        ["STALE_VERSION", "CODE_INACTIVE"].includes(refused.outcome.reason!),
      );
      if (
        (
          await query(
            "SELECT id FROM access_credentials WHERE team_id=$1 AND revoked_at IS NULL",
            [team],
          )
        ).length
      )
        await command(await input(team, "REVOKE"));
      const p = await input(team, "ISSUE");
      await c.budgets();
      const issues = await Promise.all([
        service.command(c.staff.sessionCookie, p),
        service.command(c.staff.sessionCookie, {
          ...p,
          requestKey: randomUUID(),
        }),
      ]);
      assert.equal(
        issues.filter((v) => v.outcome.outcome === "APPLIED").length,
        1,
      );
      assert.equal(
        (
          await query(
            "SELECT id FROM access_credentials WHERE team_id=$1 AND revoked_at IS NULL",
            [team],
          )
        ).length,
        1,
      );
    },
  );
  await t.test(
    "live revocation retires both members and pending/approved handoffs but preserves frozen jobs, drafts, languages, points and time",
    async () => {
      const a = await c.newRound(),
        team = c.teams[0]!,
        oldCode = team.code;
      await c.budgets();
      const { createWorkbenchService } =
        await import("../../src/workbench/service.js");
      await createWorkbenchService(c.api, c.clock).save(a.aa, {
        roundId: a.round,
        bountyId: a.y,
        requestKey: randomUUID(),
        baseRevision: "0",
        source: "Private retained draft",
      });
      const admitted = await c.service.submit(
          a.aa,
          a.round,
          a.x,
          "Synthetic frozen official source",
          randomUUID(),
        ),
        parent = admitted.result.submission_id as string;
      assert.equal(admitted.result.status, "ADMITTED");
      async function flow() {
        await c.budgets();
        const f = await entry.begin(oldCode, {
          ip: "127.0.0.1",
          browserId: randomUUID(),
        });
        if (f.audience !== "TEAM") throw Error("Fixture team flow");
        return f;
      }
      const pending = await replacements.request((await flow()).proofCookie, {
          memberId: team.members[0]!,
          requestKey: randomUUID(),
        }),
        approved = await replacements.request((await flow()).proofCookie, {
          memberId: team.members[1]!,
          requestKey: randomUUID(),
        });
      if (pending.status !== "REQUESTED" || approved.status !== "REQUESTED")
        throw Error("Fixture handoff");
      const request = (
        await replacements.list(c.staff.sessionCookie)
      ).items.find((r) => r.request_id === approved.request.request_id)!;
      await replacements.decide(c.staff.sessionCookie, {
        flowId: request.request_id,
        requestKey: randomUUID(),
        action: "APPROVE",
        expectedRevision: request.expected_revision,
        reason: "Synthetic approved handoff",
      });
      const saved = async () => ({
        members: await query(
          "SELECT * FROM member_rounds WHERE round_id=$1 ORDER BY id",
          [a.round],
        ),
        drafts: await query("SELECT * FROM code_drafts ORDER BY id"),
        jobs: await query(
          "SELECT id,source,language,created_at FROM participant_judging WHERE id=$1",
          [parent],
        ),
        sport: await query("SELECT competition_standings($1) rows", [a.round]),
        round: await query(
          "SELECT state,started_at,closes_at FROM rounds WHERE id=$1",
          [a.round],
        ),
      });
      const before = await saved(),
        revoked = await command(await input(team.id, "REVOKE"));
      assert.equal(revoked.outcome.outcome, "APPLIED");
      assert.equal(revoked.issued_code, null);
      assert.deepEqual(await saved(), before);
      for (const cookie of [a.aa, a.ab]) {
        await assert.rejects(entry.inspect(cookie), denied("INVALID_SESSION"));
        await assert.rejects(
          live.guarded(
            { audience: "PARTICIPANT", cookie, roundId: null },
            live.snapshot,
          ),
          denied("INVALID_SESSION"),
        );
      }
      assert.ok(await entry.inspect(a.ba));
      await assert.rejects(flow(), denied("INVALID_CODE"));
      for (const p of [pending, approved])
        await assert.rejects(replacements.describe(p.proofCookie));
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM replacement_requests WHERE team_id=$1 AND (state IN ('PENDING','APPROVED') OR proof_ciphertext IS NOT NULL)",
            [team.id],
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM session_deliveries d JOIN participant_sessions s ON s.id=d.session_id WHERE s.team_id=$1 AND d.ciphertext IS NOT NULL",
            [team.id],
          )
        )[0].n,
        0,
      );
      const issued = await command(await input(team.id, "ISSUE"));
      team.code = issued.issued_code!;
      assert.ok(team.code);
      const f = await entry.begin(team.code, {
        ip: "127.0.0.1",
        browserId: randomUUID(),
      });
      if (f.audience !== "TEAM") throw Error("Fixture reissued code");
      const reenrol = await entry.activate(f.proofCookie, {
        memberId: team.members[0]!,
        language: before.members.find((m) => m.member_id === team.members[0])!
          .language,
        requestKey: randomUUID(),
      });
      assert.equal(reenrol.status, "REJECTED");
      if (reenrol.status === "REJECTED")
        assert.equal(reenrol.reason, "ALREADY_ENROLLED");
      c.answers.set(parent, "PASSED");
      await c.judge.claim();
      const deadline = Date.now() + 15000;
      while (
        !(
          await query(
            "SELECT completed_at FROM participant_judging WHERE id=$1",
            [parent],
          )
        )[0].completed_at
      ) {
        assert.ok(Date.now() < deadline);
        await c.judge.tick();
        await delay(25);
      }
      assert.equal(
        (
          await query("SELECT result FROM participant_judging WHERE id=$1", [
            parent,
          ])
        )[0].result,
        "PASSED",
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1",
            [parent],
          )
        )[0].n,
        1,
      );
    },
  );
  await t.test(
    "HTTP search/revocation require private current authority, exact CSRF and strict bounded fields",
    async () => {
      const browser = {
          mode: "loopback" as const,
          origin: "http://127.0.0.1:3000",
          cookieKey: randomBytes(32),
          csrfKey: randomBytes(32),
        },
        policy = browserPolicy(browser),
        app = buildApp({
          database: { async check() {}, async close() {} },
          entry: {
            pool: c.api,
            clock: c.clock,
            delivery: c.delivery,
            browser,
            competition: c.deps,
          },
        }),
        jar = new Map<string, string>();
      async function request(url: string, body?: object, token?: string) {
        await c.budgets();
        const r = await app.inject({
          method: body ? "POST" : "GET",
          url,
          headers: {
            origin: browser.origin,
            cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; "),
            ...(body
              ? {
                  "content-type": "application/json",
                  "x-csrf-token": token ?? "",
                }
              : {}),
          },
          ...(body ? { payload: body } : {}),
        });
        for (const cookie of r.cookies) jar.set(cookie.name, cookie.value);
        return r;
      }
      try {
        assert.equal(
          (await request("/api/v1/staff/teams?search=POOL")).statusCode,
          401,
        );
        await request("/api/v1/bootstrap?audience=ANONYMOUS");
        jar.set(policy.names.staff, c.staff.sessionCookie);
        const token = (await request("/api/v1/bootstrap?audience=STAFF")).json()
          .data.csrf_token;
        const term = await request("/api/v1/staff/teams?search=LITERAL-EXACT");
        assert.equal(term.statusCode, 200);
        assert.equal(term.json().data.matched, 1);
        assert.equal(term.headers["cache-control"], "no-store");
        assert.equal(
          (
            await request(
              "/api/v1/staff/teams?search=" +
                encodeURIComponent("\u00e9".repeat(61)),
            )
          ).statusCode,
          400,
        );
        assert.equal(
          (await request("/api/v1/staff/teams?search=POOL&unknown=true"))
            .statusCode,
          400,
        );
        const team = imported.issued_codes[2]!.team_id,
          body = {
            request_key: randomUUID(),
            expected_revision: "1",
            reason: "Synthetic HTTP revocation",
            own_code: c.staff.code,
          },
          path = `/api/v1/staff/teams/${team}/revoke-code`;
        assert.equal((await request(path, body)).statusCode, 403);
        assert.equal(
          (await request(path, { ...body, team_name: "untrusted" }, token))
            .statusCode,
          400,
        );
        const result = await request(path, body, token);
        assert.equal(result.statusCode, 200, result.body);
        assert.equal(result.json().data.issued_code, null);
        assert.equal(
          (
            await request(`/api/v1/staff/outcomes/teams/${body.request_key}`)
          ).json().data.outcome.action,
          "REVOKE",
        );
        jar.set(policy.names.staff, c.organiser.sessionCookie);
        assert.equal(
          (await request("/api/v1/staff/teams?search=POOL")).statusCode,
          403,
        );
      } finally {
        await app.close();
      }
    },
  );
  if (process.env.INGENIUM_TEST_SUITE === "team-access-browser")
    await t.test(
      "real search and revoke/reissue screens recover a lost reply and revoke both participant browsers",
      () => teamAccessBrowserChecks(c),
    );
}
