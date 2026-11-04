import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Pool, QueryResultRow } from "pg";
import type { EntryHttpOptions } from "../../src/access/http.js";
import { parseProof } from "../../src/access/credentials.js";
import { createCompetitionService } from "../../src/competition/service.js";
import type { CompetitionCommand } from "../../src/competition/service.js";
import { createLiveService } from "../../src/live/service.js";
import { createHistoryService } from "../../src/workbench/history.js";
import { openStaffView, withBrowserApp } from "./browser-app.js";

type Person = { sessionCookie: string; code: string };
type Service = ReturnType<typeof createCompetitionService>;
export async function liveQuestionReleaseChecks(c: {
  owner: Pool; api: Pool; clock: EntryHttpOptions["clock"]; delivery: EntryHttpOptions["delivery"]; deps: NonNullable<EntryHttpOptions["competition"]>;
  service: Service; actor: Person; organiser: Person; participant: { sessionCookie: string }; other: { sessionCookie: string };
  command(actor: Person, action: CompetitionCommand["action"], round: string, payload?: Record<string, unknown>, patch?: Partial<CompetitionCommand>): ReturnType<Service["command"]>;
  budgets(): Promise<void>; assess(id: string, verdict?: string): Promise<unknown>;
  r2: string; before: QueryResultRow[]; extras: string[]; wrongRoundSnapshot: string;
}) {
  const { owner, api, r2, extras, service, organiser, command } = c;
  const rows = async () => (await owner.query("SELECT * FROM bounties WHERE round_id=$1 ORDER BY position", [r2])).rows;
  const round = async () => (await owner.query("SELECT * FROM rounds WHERE id=$1", [r2])).rows[0];
  const unchangedRound = (row: QueryResultRow) => { const { revision, trusted_time_at, ...rest } = row; return rest; };
  for (const snapshots of [[], Array.from({ length: 21 }, () => randomUUID()), [extras[0], extras[0]]])
    await assert.rejects(command(organiser, "APPEND_QUESTIONS", r2, { snapshots }), { code: "INVALID_CONTEXT" });
  assert.equal((await owner.query("SELECT status FROM validation_runs WHERE snapshot_id=$1", [extras[21]])).rows[0].status, "PASSED");
  assert.equal((await owner.query("SELECT count(*)::int n FROM competition_publications WHERE snapshot_id=$1", [extras[21]])).rows[0].n, 0);
  for (const snapshots of [[extras[0], randomUUID()], [c.before[0]!.snapshot_id], [c.wrongRoundSnapshot], [extras[21]]])
    assert.equal((await command(organiser, "APPEND_QUESTIONS", r2, { snapshots })).result.reason, "QUESTIONS_NOT_ELIGIBLE");
  assert.equal((await command(organiser, "APPEND_QUESTIONS", r2, { snapshots: [extras[0]] }, { expectedRevision: "0" })).result.reason, "STALE_VERSION");
  assert.deepEqual(await rows(), c.before);
  const transaction = await owner.connect();
  try {
    await transaction.query("BEGIN; SET LOCAL ROLE ingenium_api");
    const release = (await transaction.query("SELECT competition_staff_command($1,$2,$3,(SELECT revision FROM rounds WHERE id=$2),'APPEND_QUESTIONS',$4::jsonb,'Synthetic full batch rollback',NULL) value",
      [parseProof(organiser.sessionCookie)!.id, r2, randomUUID(), JSON.stringify({ snapshots: extras.slice(0, 20) })])).rows[0].value;
    assert.equal(release.result.added_count, 20); assert.equal(release.result.total_count, 120);
    await transaction.query("SET CONSTRAINTS ALL IMMEDIATE");
  } finally { await transaction.query("ROLLBACK"); transaction.release(); }
  assert.deepEqual(await rows(), c.before);
  await assert.rejects(owner.query("INSERT INTO bounties SELECT gen_random_uuid(),$1,s.definition_id,s.id,101 FROM validation_snapshots s WHERE s.id=$2", [r2, extras[0]]), /exact current release receipt/);
  await assert.rejects(owner.query("UPDATE bounties SET position=120 WHERE id=$1", [c.before[0]!.id]), /Launched selection is immutable/);
  const pending = await service.submit(c.participant.sessionCookie, r2, c.before[0]!.id, "synthetic pending original fix", randomUUID());
  assert.equal(pending.result.status, "ADMITTED");
  const source = (await owner.query("SELECT * FROM competition_submissions WHERE id=$1", [pending.result.submission_id])).rows[0];
  const config = (await owner.query("SELECT * FROM competition_configs WHERE round_id=$1", [r2])).rows[0];
  await command(c.actor, "PAUSE", r2, { scope: "GLOBAL", target: null });
  const paused = await round(), requestKey = randomUUID();
  await assert.rejects(service.command(c.participant.sessionCookie, { action: "APPEND_QUESTIONS", roundId: r2, requestKey: randomUUID(), expectedRevision: paused.revision, reason: "Synthetic participant denial", payload: { snapshots: [extras[0]] } }));
  const first = await command(organiser, "APPEND_QUESTIONS", r2, { snapshots: [extras[0]] }, { requestKey });
  assert.equal(first.result.status, "APPLIED"); assert.equal(first.result.added_count, 1);
  assert.equal((await round()).revision, String(BigInt(paused.revision) + 1n));
  assert.deepEqual(unchangedRound(await round()), unchangedRound(paused));
  assert.deepEqual(await command(organiser, "APPEND_QUESTIONS", r2, { snapshots: [extras[0]] }, { requestKey, expectedRevision: paused.revision }), first);
  await assert.rejects(command(organiser, "APPEND_QUESTIONS", r2, { snapshots: [extras[1]] }, { requestKey, expectedRevision: paused.revision }));
  await command(c.actor, "RESUME", r2, { scope: "GLOBAL", target: null });
  const running = await round();
  await c.budgets();
  const races = await Promise.all([1, 2].map(i => service.command(organiser.sessionCookie, {
    action: "APPEND_QUESTIONS", roundId: r2, requestKey: randomUUID(), expectedRevision: running.revision,
    reason: "Synthetic simultaneous release", payload: { snapshots: [extras[i]] },
  })));
  assert.deepEqual(races.map(r => r.result.status).sort(), ["APPLIED", "REJECTED"]);
  assert.equal(races.find(r => r.result.status === "REJECTED")!.result.reason, "STALE_VERSION");
  assert.deepEqual(unchangedRound(await round()), unchangedRound(running));
  const live = createLiveService(api, c.clock, c.delivery), history = createHistoryService(api, c.clock);
  const heads = await Promise.all([c.participant, c.other].map(p => live.guarded({ audience: "PARTICIPANT", cookie: p.sessionCookie, roundId: r2 }, async ctx => ctx.streams.find(s => s.kind === "ROUND")!)));
  const already = (await rows()).map(row => row.snapshot_id), remaining = extras.filter(id => !already.includes(id)).slice(0, 18);
  if (process.env.INGENIUM_TEST_SUITE === "live-questions-browser") {
    await withBrowserApp({ pool: api, clock: c.clock, delivery: c.delivery, competition: c.deps }, async (browser, origin, policy) => {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await context.addCookies([{ name: policy.names.staff, value: organiser.sessionCookie, url: origin, httpOnly: true, sameSite: "Strict" }]);
      const page = await context.newPage(), errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      try {
        await c.budgets(); await page.goto(origin); await openStaffView(page, "Round questions");
        await expect(page.getByRole("heading", { name: "Add questions to live Round 2", exact: true })).toBeVisible();
        while (await page.getByRole("button", { name: "More published bugs" }).count()) {
          const button = page.getByRole("button", { name: "More published bugs" });
          await button.click();
          await expect.poll(async () => !(await button.count()) || await button.isEnabled()).toBeTruthy();
        }
        const selected = page.getByRole("checkbox", { checked: true });
        assert.equal(await selected.count(), 102);
        for (const checkbox of await selected.all()) await expect(checkbox).toBeDisabled();
        const enabled = page.locator('input[type="checkbox"]:enabled');
        for (let i = 0; i < 18; i++) await enabled.nth(i).check();
        const review = page.getByRole("button", { name: "Review and release 18 questions", exact: true });
        await review.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator("li")).toHaveCount(18);
        await expect(dialog.getByLabel("Your staff code")).toHaveCount(0);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal((await rows()).length, 102);
        await review.click(); await c.budgets();
        const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/commands"));
        await page.getByRole("dialog").getByRole("button", { name: "Release new Round 2 questions", exact: true }).click();
        assert.equal((await response).status(), 200);
        await expect(page.getByText("18 new questions released to all teams. 120 questions in Round 2.", { exact: true })).toBeVisible();
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  } else {
    const released = await command(organiser, "APPEND_QUESTIONS", r2, { snapshots: remaining });
    assert.equal(released.result.added_count, 18); assert.equal(released.result.total_count, 120);
    assert.deepEqual((released.result.additions as { snapshot_id: string }[]).map(row => row.snapshot_id), remaining);
  }
  const final = await rows();
  assert.deepEqual(final.slice(0, 100), c.before);
  assert.deepEqual(final.map(row => row.position), Array.from({ length: 120 }, (_, i) => i + 1));
  assert.deepEqual(unchangedRound(await round()), unchangedRound(running));
  assert.deepEqual((await owner.query("SELECT * FROM competition_configs WHERE round_id=$1", [r2])).rows[0], config);
  assert.deepEqual((await owner.query("SELECT * FROM competition_submissions WHERE id=$1", [source.id])).rows[0], source);
  assert.equal((await command(organiser, "APPEND_QUESTIONS", r2, { snapshots: [extras.find(id => !final.some(row => row.snapshot_id === id))] })).result.reason, "QUESTION_CAPACITY");
  for (const [i, p] of [c.participant, c.other].entries()) {
    const cursor = heads[i]!;
    await live.guarded({ audience: "PARTICIPANT", cookie: p.sessionCookie, roundId: r2 }, async ctx => {
      const head = ctx.streams.find(s => s.kind === "ROUND")!;
      const events = await live.page(ctx, cursor.stream_id, cursor.head, head.head);
      assert.ok(events.events.some(event => event.patch.type === "INVALIDATE" && event.patch.projection === "competition"));
    });
    assert.deepEqual((await service.state(p.sessionCookie, r2, "PARTICIPANT")).bounties.map(b => b.bounty_id), final.map(b => b.id));
    assert.equal((await live.guarded({ audience: "PARTICIPANT", cookie: p.sessionCookie, roundId: r2 }, live.snapshot)).bounties.length, 120);
    assert.equal((await history.overview(p.sessionCookie, r2)).bounties.length, 120);
  }
  assert.equal((await service.controlRoom(organiser.sessionCookie)).rounds.find(r => r.round_id === r2)!.selected.length, 120);
  await c.assess(source.id);
  const added = await service.submit(c.other.sessionCookie, r2, final[119]!.id, "synthetic new question fix", randomUUID());
  assert.equal(added.result.status, "ADMITTED"); await c.assess(added.result.submission_id as string);
  assert.equal((await owner.query("SELECT count(*)::int n FROM bounty_awards WHERE submission_id=ANY($1::uuid[])", [[source.id, added.result.submission_id]])).rows[0].n, 2);
  const receipt = await command(organiser, "APPEND_QUESTIONS", r2, { snapshots: [extras[0]] }, { requestKey, expectedRevision: paused.revision });
  assert.deepEqual(receipt, first);
}
