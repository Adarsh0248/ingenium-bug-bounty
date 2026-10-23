import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { createAnnouncementService } from "../../src/access/announcements.js";
import type { AnnouncementCommand } from "../../src/access/announcements.js";
import { createLiveService } from "../../src/live/service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { AccessError } from "../../src/access/transaction.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { announcementBrowserChecks } from "./announcements-browser.checks.js";

export async function announcementChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newStaff(
      role?: string,
    ): Promise<{ id: string; code: string; sessionCookie: string }>;
    teams: { id: string }[];
    startRace(
      round: string,
    ): ReturnType<Parameters<typeof participantJudgingChecks>[1]["newRound"]>;
  },
) {
  const service = createAnnouncementService(c.api, c.clock, c.delivery),
    live = createLiveService(c.api, c.clock, c.delivery),
    actor = await c.newStaff("ORGANISER"),
    admin = await c.newStaff("SUPER_ADMIN"),
    a = await c.newRound(),
    query = async (sql: string, args: unknown[] = []) =>
      (await c.owner.query(sql, args)).rows,
    arena = (
      await query("SELECT arena_instance_id id FROM rounds WHERE id=$1", [
        a.round,
      ])
    )[0].id as string,
    denied = (code: string) => (e: unknown) =>
      e instanceof AccessError && e.code === code,
    input = (
      patch: Partial<AnnouncementCommand> = {},
    ): AnnouncementCommand => ({
      arenaId: arena,
      scope: "EVENT",
      roundId: null,
      teamId: null,
      requestKey: randomUUID(),
      message: "Synthetic event announcement",
      reason: "Synthetic organiser communication",
      ...patch,
    }),
    snapshot = (cookie: string) =>
      live.guarded(
        { audience: "PARTICIPANT", cookie, roundId: null },
        live.snapshot,
      );
  let event: Awaited<ReturnType<typeof service.send>>,
    privateMessage: Awaited<ReturnType<typeof service.send>>;
  await t.test(
    "all staff roles can send once; duplicate receipt recovery is actor-bound and never extends activity",
    async () => {
      await c.budgets();
      const cmd = input(),
        before = await query(
          "SELECT id,last_activity_at FROM participant_sessions ORDER BY id",
        );
      event = await service.send(actor.sessionCookie, cmd);
      assert.equal(event.outcome, "APPLIED");
      const activity = await query(
        "SELECT last_activity_at FROM staff_sessions WHERE id=$1",
        [actor.sessionCookie.split(".")[1]],
      );
      assert.deepEqual(await service.send(actor.sessionCookie, cmd), event);
      assert.deepEqual(
        (await service.outcome(actor.sessionCookie, arena, cmd.requestKey))
          .outcome,
        event,
      );
      assert.equal(
        (await service.outcome(admin.sessionCookie, arena, cmd.requestKey))
          .status,
        "NOT_OBSERVED",
      );
      await assert.rejects(
        service.send(actor.sessionCookie, { ...cmd, message: "Changed body" }),
        denied("INTENT_CONFLICT"),
      );
      assert.deepEqual(
        await query("SELECT last_activity_at FROM staff_sessions WHERE id=$1", [
          actor.sessionCookie.split(".")[1],
        ]),
        activity,
      );
      await service.send(
        admin.sessionCookie,
        input({ message: "Super admin communication" }),
      );
      await service.send(
        c.staff.sessionCookie,
        input({
          scope: "ROUND",
          roundId: a.round,
          message: "Round-one notice",
        }),
      );
      assert.deepEqual(
        await query(
          "SELECT id,last_activity_at FROM participant_sessions ORDER BY id",
        ),
        before,
      );
      assert.equal(
        (
          await query("SELECT count(*)::int n FROM announcements WHERE id=$1", [
            event.id,
          ])
        )[0].n,
        1,
      );
    },
  );
  await t.test(
    "private notice bodies, metadata, heads and deliveries stay within the selected team",
    async () => {
      await c.budgets();
      const before = await snapshot(a.ba),
        ownBefore = await snapshot(a.aa),
        text =
          "Private team-only text\n<script>window.noticeExecuted=true</script>";
      privateMessage = await service.send(
        actor.sessionCookie,
        input({ scope: "TEAM", teamId: c.teams[0]!.id, message: text }),
      );
      const own = await snapshot(a.aa),
        teammate = await snapshot(a.ab),
        other = await snapshot(a.ba);
      assert.equal(
        own.announcement_head,
        String(Number(ownBefore.announcement_head ?? "0") + 1),
      );
      assert.equal(teammate.announcement_head, own.announcement_head);
      assert.equal(other.announcement_head, before.announcement_head);
      assert.deepEqual(other.streams, before.streams);
      assert.notDeepEqual(own.streams, ownBefore.streams);
      for (const cookie of [a.aa, a.ab]) {
        assert.ok(
          (await service.participantList(cookie)).items.some(
            (i) => i.id === privateMessage.id,
          ),
        );
        assert.equal(
          (await service.participantDetail(cookie, privateMessage.id)).message,
          text,
        );
      }
      assert.ok(
        !(await service.participantList(a.ba)).items.some(
          (i) => i.id === privateMessage.id,
        ),
      );
      await assert.rejects(
        service.participantDetail(a.ba, privateMessage.id),
        denied("ACCESS_UNAVAILABLE"),
      );
      await assert.rejects(
        service.participantList(a.ba, privateMessage.id),
        denied("ACCESS_UNAVAILABLE"),
      );
      const deliveries = await query(
        `SELECT s.kind,s.team_round_id,d.patch FROM live_deliveries d JOIN live_effects e ON e.id=d.effect_id JOIN live_streams s ON s.id=d.stream_id WHERE e.announcement_id=$1`,
        [privateMessage.id],
      );
      assert.equal(deliveries.length, 2);
      assert.ok(deliveries.some((d) => d.kind === "STAFF_OPS"));
      assert.ok(
        deliveries.some(
          (d) =>
            d.kind === "TEAM" && d.team_round_id === own.actor.team_round_id,
        ),
      );
      assert.ok(
        !JSON.stringify([
          own,
          other,
          deliveries,
          await service.staffList(actor.sessionCookie, arena),
        ]).includes(text),
      );
    },
  );
  await t.test(
    "equal-time notices still advance the recipient notification revision and stay body-free in audit views",
    async () => {
      await c.budgets();
      const before = await snapshot(a.aa);
      const rows = await query(
        `INSERT INTO announcements SELECT gen_random_uuid(),arena_id,scope,round_id,team_id,actor_id,session_id,credential_id,credential_version,gen_random_uuid(),fingerprint,message,reason,outcome,denial_reason,date_trunc('milliseconds',statement_timestamp()) FROM announcements CROSS JOIN generate_series(1,2) WHERE id=$1 RETURNING id,recorded_at`,
        [event.id],
      );
      assert.equal(rows.length, 2);
      assert.equal(
        rows[0].recorded_at.toISOString(),
        rows[1].recorded_at.toISOString(),
      );
      assert.equal(
        (await snapshot(a.aa)).announcement_head,
        String(Number(before.announcement_head) + 2),
      );
      const { createStaffAuditService } =
        await import("../../src/access/audit-service.js");
      const audit = await createStaffAuditService(
        c.api,
        c.clock,
        c.delivery,
      ).list(c.staff.sessionCookie, "ANNOUNCEMENTS", arena);
      assert.ok(audit.items.some((i) => i.id === event.id));
      assert.doesNotMatch(
        JSON.stringify(audit),
        /message|fingerprint|request_key|credential_id/,
      );
    },
  );
  await t.test(
    "target validation, immutable history and ordinary delivery capacity fail without partial sends",
    async () => {
      await c.budgets();
      const count = (await query("SELECT count(*) n FROM announcements"))[0].n;
      for (const patch of [
        { roundId: a.round },
        { scope: "ROUND" as const, roundId: randomUUID() },
        { scope: "TEAM" as const, teamId: randomUUID() },
        { message: "\u00e9".repeat(2049) },
      ])
        await assert.rejects(service.send(actor.sessionCookie, input(patch)));
      assert.equal(
        (await query("SELECT count(*) n FROM announcements"))[0].n,
        count,
      );
      await assert.rejects(
        c.api.query("UPDATE announcements SET message='tampered' WHERE id=$1", [
          event.id,
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        c.owner.query("DELETE FROM announcements WHERE id=$1", [event.id]),
      );
      const client = await c.owner.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "UPDATE live_control SET rows=245760,reserved=0 WHERE id=1",
        );
        await assert.rejects(
          client.query(
            `INSERT INTO announcements SELECT gen_random_uuid(),arena_id,scope,round_id,team_id,actor_id,session_id,credential_id,credential_version,gen_random_uuid(),fingerprint,message,reason,outcome,denial_reason,date_trunc('milliseconds',statement_timestamp()) FROM announcements WHERE id=$1`,
            [event.id],
          ),
          { code: "54000" },
        );
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      assert.equal(
        (await query("SELECT count(*) n FROM announcements"))[0].n,
        count,
      );
    },
  );
  await t.test(
    "normal communication works during global pause while reads do not refresh any session",
    async () => {
      await c.budgets();
      async function control(action: "PAUSE" | "RESUME") {
        await c.budgets();
        return c.service.command(c.staff.sessionCookie, {
          action,
          roundId: a.round,
          requestKey: randomUUID(),
          expectedRevision: (
            await query("SELECT revision FROM rounds WHERE id=$1", [a.round])
          )[0].revision,
          payload: { scope: "GLOBAL", target: null },
          reason: "Synthetic technical break",
          ownCode: c.staff.code,
        });
      }
      await control("PAUSE");
      assert.equal(
        (
          await service.send(
            actor.sessionCookie,
            input({ message: "Technical break in progress" }),
          )
        ).outcome,
        "APPLIED",
      );
      await control("RESUME");
      const before = await query(
        "SELECT id,last_activity_at FROM staff_sessions UNION ALL SELECT id,last_activity_at FROM participant_sessions ORDER BY id",
      );
      await service.staffList(actor.sessionCookie, arena);
      await service.staffDetail(actor.sessionCookie, arena, event.id);
      await service.participantList(a.aa);
      await service.participantDetail(a.aa, event.id);
      assert.deepEqual(
        await query(
          "SELECT id,last_activity_at FROM staff_sessions UNION ALL SELECT id,last_activity_at FROM participant_sessions ORDER BY id",
        ),
        before,
      );
    },
  );
  await t.test(
    "bounded metadata pages use stable cursors and exclude message bodies",
    async () => {
      for (let i = 0; i < 42; i++) {
        await c.budgets();
        await service.send(
          actor.sessionCookie,
          input({ message: `Page fixture ${i}` }),
        );
      }
      const one = await service.staffList(actor.sessionCookie, arena);
      assert.equal(one.items.length, 40);
      assert.ok(one.next_after);
      await c.budgets();
      await service.send(
        actor.sessionCookie,
        input({ message: "Inserted after first page" }),
      );
      const two = await service.staffList(
        actor.sessionCookie,
        arena,
        one.next_after!,
      );
      assert.ok(two.items.length > 0);
      assert.ok(!two.items.some((i) => one.items.some((j) => i.id === j.id)));
      assert.doesNotMatch(
        JSON.stringify([one, two]),
        /message|reason|credential|request_key|fingerprint/,
      );
    },
  );
  await t.test(
    "HTTP uses CSRF, strict scopes, bounded plain text and no public or HEAD feed",
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
      const path = `/api/v1/staff/arenas/${arena}/announcements`;
      async function request(
        url: string,
        body?: object,
        csrf?: string,
        method?: "HEAD",
      ) {
        await c.budgets();
        const response = await app.inject({
          method: method ?? (body ? "POST" : "GET"),
          url,
          headers: {
            origin: browser.origin,
            cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; "),
            ...(body
              ? {
                  "content-type": "application/json",
                  "x-csrf-token": csrf ?? "",
                }
              : {}),
          },
          ...(body ? { payload: body } : {}),
        });
        for (const line of response.cookies) jar.set(line.name, line.value);
        return response;
      }
      try {
        assert.equal(
          (await request("/api/v1/participant/announcements")).statusCode,
          401,
        );
        await request("/api/v1/bootstrap?audience=ANONYMOUS");
        jar.set(policy.names.staff, actor.sessionCookie);
        const token = (await request("/api/v1/bootstrap?audience=STAFF")).json()
          .data.csrf_token;
        const body = {
          scope: "EVENT",
          round_id: null,
          team_id: null,
          request_key: randomUUID(),
          message: "\n".repeat(4095) + "x",
          reason: "Synthetic escaped transport boundary",
        };
        assert.equal((await request(path, body)).statusCode, 403);
        assert.equal(
          (await request(path, { ...body, extra: true }, token)).statusCode,
          400,
        );
        const response = await request(path, body, token);
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.headers["cache-control"], "no-store");
        const id = response.json().data.id;
        assert.equal(
          (await request(`${path}/${id}`)).json().data.message,
          body.message,
        );
        assert.equal(
          (await request(path, undefined, undefined, "HEAD")).statusCode,
          404,
        );
        jar.delete(policy.names.staff);
        jar.set(policy.names.participant, a.ba);
        const own = await request("/api/v1/participant/announcements");
        assert.equal(own.statusCode, 200);
        assert.doesNotMatch(
          own.body,
          /round_id|team_id|message|reason|actor_id/,
        );
        assert.equal(
          (
            await request(
              `/api/v1/participant/announcements/${privateMessage.id}`,
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await request(
              "/api/v1/participant/announcements?team_id=" + c.teams[0]!.id,
            )
          ).statusCode,
          400,
        );
      } finally {
        await app.close();
      }
    },
  );
  if (process.env.INGENIUM_TEST_SUITE === "announcements-browser")
    await t.test(
      "real staff and participant browsers deliver private live notices and recover one lost send",
      () =>
        announcementBrowserChecks(c, {
          arena,
          round: a.round,
          aa: a.aa,
          ba: a.ba,
          bug: a.x,
        }),
    );
  await t.test(
    "revoked staff and an untrusted clock cannot send or recover announcements",
    async () => {
      await c.budgets();
      const blocked = createAnnouncementService(
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
        blocked.send(actor.sessionCookie, input()),
        denied("CLOCK_UNTRUSTED"),
      );
      await createStaffService(c.api, c.clock, c.delivery).logout(
        actor.sessionCookie,
      );
      await assert.rejects(
        service.send(actor.sessionCookie, input()),
        denied("INVALID_SESSION"),
      );
      await assert.rejects(
        service.outcome(actor.sessionCookie, arena, event.request_key),
        denied("INVALID_SESSION"),
      );
    },
  );
  await t.test(
    "round two inherits event and own-team notices but never round-one-only notices; closed arenas are read-only",
    async () => {
      await c.budgets();
      const race = await c.startRace(a.round),
        items = await service.participantList(race.aa);
      assert.ok(items.items.length > 0);
      assert.equal(
        (await service.participantDetail(race.aa, event.id)).id,
        event.id,
      );
      assert.equal(
        (await service.participantDetail(race.aa, privateMessage.id)).id,
        privateMessage.id,
      );
      const roundNotice = (
        await query(
          "SELECT id FROM announcements WHERE arena_id=$1 AND scope='ROUND' LIMIT 1",
          [arena],
        )
      )[0].id;
      await assert.rejects(
        service.participantDetail(race.aa, roundNotice),
        denied("ACCESS_UNAVAILABLE"),
      );
      await assert.rejects(
        service.participantDetail(race.ba, privateMessage.id),
        denied("ACCESS_UNAVAILABLE"),
      );
      for (const action of ["CLOSE", "FINALISE"] as const) {
        await c.budgets();
        await c.service.command(c.staff.sessionCookie, {
          action,
          roundId: race.round,
          requestKey: randomUUID(),
          expectedRevision: (
            await query("SELECT revision FROM rounds WHERE id=$1", [race.round])
          )[0].revision,
          payload: {},
          reason: "Synthetic announcement history closure",
          ownCode: c.staff.code,
        });
      }
      const closed = await service.send(
        c.staff.sessionCookie,
        input({ message: "Must not be delivered after completion" }),
      );
      assert.equal(closed.outcome, "REJECTED");
      assert.equal(closed.reason, "ARENA_CLOSED");
      assert.ok(
        !(
          await query("SELECT id FROM live_effects WHERE announcement_id=$1", [
            closed.id,
          ])
        ).length,
      );
      assert.equal(
        (await service.staffDetail(c.staff.sessionCookie, arena, event.id)).id,
        event.id,
      );
      const fresh = await c.newRound();
      assert.deepEqual((await service.participantList(fresh.aa)).items, []);
      await assert.rejects(
        service.participantDetail(fresh.aa, event.id),
        denied("ACCESS_UNAVAILABLE"),
      );
      assert.equal((await snapshot(fresh.aa)).announcement_head, null);
    },
  );
}
