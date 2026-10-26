import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { createReportService } from "../../src/competition/reports.js";
import { createSubmissionReviewService } from "../../src/competition/submission-review.js";
import { createLiveService } from "../../src/live/service.js";
import { createHistoryService } from "../../src/workbench/history.js";
import { createStaffAuditService } from "../../src/access/audit-service.js";
import { sha256 } from "../../src/access/credentials.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";

export async function reportChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    startRace(
      round: string,
    ): ReturnType<Parameters<typeof participantJudgingChecks>[1]["newRound"]>;
  },
) {
  const a = await c.newRound(),
    reports = createReportService(c.api, c.clock, c.delivery),
    review = createSubmissionReviewService(c.api, c.clock, c.delivery);
  const query = async (text: string, args: unknown[] = []) =>
    (await c.owner.query(text, args)).rows;
  const revision = async () =>
    (await query("SELECT revision FROM rounds WHERE id=$1", [a.round]))[0]
      .revision;
  const control = async (
    action: "CLOSE" | "FINALISE" | "QUALIFY" | "DISCARD",
  ) => {
    await c.budgets();
    return c.service.command(c.staff.sessionCookie, {
      action,
      roundId: a.round,
      requestKey: randomUUID(),
      expectedRevision: await revision(),
      payload: {},
      reason: "Synthetic report lifecycle",
      ownCode: c.staff.code,
    });
  };
  const source =
    "\uFEFF// Exact immutable reported answer\r\n<script>untrusted source</script>\r\n";
  await c.budgets();
  const submission = (
    await c.service.submit(a.aa, a.round, a.x, source, randomUUID())
  ).result.submission_id as string;
  const other = (
    await c.service.submit(
      a.ba,
      a.round,
      a.x,
      "OTHER TEAM PRIVATE SOURCE",
      randomUUID(),
    )
  ).result.submission_id as string;
  c.answers.set(submission, "WRONG_ANSWER");
  const sample = (
    await c.service.run(a.ab, a.round, a.y, "SAMPLE ONLY", randomUUID())
  ).result.run_id as string;
  c.answers.set(sample, "PASSED");
  c.answers.set(other, "WRONG_ANSWER");
  const bound = (
    await query("SELECT id FROM participant_judging WHERE submission_id=$1", [
      submission,
    ])
  )[0].id;
  let ticket: any, noAnswer: any;
  const reportInput = {
    requestKey: randomUUID(),
    submissionId: submission,
    message:
      "Unexpected result <img src=x onerror=alert(1)>; please review this exact answer.",
  };
  await t.test(
    "reports bind one team's exact official source, deduplicate teammates and reject foreign or sample attachments",
    async () => {
      await c.budgets();
      await assert.rejects(reports.create(a.aa, a.round, a.y, reportInput), {
        code: "ACCESS_UNAVAILABLE",
      });
      await assert.rejects(reports.create(a.ba, a.round, a.x, reportInput), {
        code: "ACCESS_UNAVAILABLE",
      });
      await assert.rejects(
        reports.create(a.aa, a.round, a.y, {
          ...reportInput,
          submissionId: sample,
        }),
        { code: "ACCESS_UNAVAILABLE" },
      );
      const outcomes = await Promise.all([
        reports.create(a.aa, a.round, a.x, reportInput),
        reports.create(a.aa, a.round, a.x, reportInput),
      ]);
      ticket = outcomes[0];
      assert.equal(outcomes[1].id, ticket.id);
      assert.equal(ticket.source_sha256, sha256(source).toString("hex"));
      assert.equal(ticket.parent_id, bound);
      assert.equal(
        (await reports.participant(a.ab, a.round, a.x)).report?.id,
        ticket.id,
      );
      assert.equal(
        (await reports.participant(a.ba, a.round, a.x)).report,
        null,
      );
      await c.budgets();
      await assert.rejects(
        reports.create(a.aa, a.round, a.x, {
          ...reportInput,
          message: "changed",
        }),
        { code: "INTENT_CONFLICT" },
      );
      await assert.rejects(
        reports.create(a.ab, a.round, a.x, {
          ...reportInput,
          requestKey: randomUUID(),
        }),
        { code: "REPORT_ALREADY_EXISTS" },
      );
      assert.equal(
        (
          await reports.reportOutcome(
            a.aa,
            a.round,
            a.x,
            reportInput.requestKey,
          )
        ).receipt?.id,
        ticket.id,
      );
      noAnswer = await reports.create(a.aa, a.round, a.y, {
        requestKey: randomUUID(),
        submissionId: null,
        message: "Statement formatting issue",
      });
      assert.equal(noAnswer.parent_id, null);
      assert.equal(noAnswer.source_sha256, null);
      assert.equal(
        (
          await query(
            "SELECT count(*)::integer n FROM question_reports WHERE round_id=$1",
            [a.round],
          )
        )[0].n,
        2,
      );
    },
  );
  await t.test(
    "staff see tickets without source leakage; source access reuses the existing audited private review",
    async () => {
      await c.budgets();
      await assert.rejects(reports.list(c.organiser.sessionCookie, a.round), {
        code: "ACCESS_UNAVAILABLE",
      });
      const listed = await reports.list(c.staff.sessionCookie, a.round);
      assert.equal(listed.items.length, 2);
      assert.doesNotMatch(
        JSON.stringify(listed),
        /OTHER TEAM PRIVATE SOURCE|source_b64|source_code|verifier/,
      );
      const read = await review.open(c.staff.sessionCookie, a.round, bound, {
        requestKey: randomUUID(),
        confirmParentId: bound,
        attemptId: null,
        reason: `Investigate ticket ${ticket.id}`,
      });
      assert.equal(Buffer.from(read.source_b64, "base64").toString(), source);
      assert.equal(
        (
          await query(
            "SELECT retention_eligible('participant_judging',$1,clock_timestamp()+interval '100 days') eligible",
            [bound],
          )
        )[0].eligible,
        false,
      );
      await assert.rejects(
        c.api.query(
          "UPDATE question_reports SET message='changed' WHERE id=$1",
          [ticket.id],
        ),
      );
      await assert.rejects(
        c.api.query("DELETE FROM question_reports WHERE id=$1", [ticket.id]),
      );
    },
  );
  const decision = {
    requestKey: randomUUID(),
    verdict: "UPHELD",
    reason: "Confirmed infrastructure issue; compensate after finalisation.",
    ownCode: c.staff.code,
  };
  await t.test(
    "only a current owner can decide a report, with its own code and an immutable idempotent note",
    async () => {
      await c.budgets();
      await assert.rejects(
        reports.decide(c.organiser.sessionCookie, a.round, ticket.id, decision),
        { code: "ACCESS_UNAVAILABLE" },
      );
      await assert.rejects(
        reports.decide(c.staff.sessionCookie, a.round, ticket.id, {
          ...decision,
          ownCode: "invalid",
        }),
        { code: "STAFF_CONFIRMATION_REQUIRED" },
      );
      const first = await reports.decide(
        c.staff.sessionCookie,
        a.round,
        ticket.id,
        decision,
      );
      await c.budgets();
      assert.equal(
        (
          await reports.decide(
            c.staff.sessionCookie,
            a.round,
            ticket.id,
            decision,
          )
        ).id,
        first.id,
      );
      assert.equal(
        (
          await reports.outcome(
            c.staff.sessionCookie,
            a.round,
            "decision",
            decision.requestKey,
          )
        ).receipt?.id,
        first.id,
      );
      await assert.rejects(
        reports.decide(c.staff.sessionCookie, a.round, ticket.id, {
          ...decision,
          requestKey: randomUUID(),
          verdict: "DISMISSED",
        }),
        { code: "REPORT_ALREADY_DECIDED" },
      );
      assert.equal(
        (await reports.participant(a.aa, a.round, a.x)).report?.decision_note,
        decision.reason,
      );
    },
  );
  const team = ticket.team_round_id;
  let input = {
    requestKey: randomUUID(),
    teamRoundId: team,
    reportId: ticket.id,
    delta: 175,
    reason: "Confirmed judge glitch: compensation +175",
    expectedRevision: await revision(),
    ownCode: c.staff.code,
  };
  await t.test(
    "score corrections refuse unfinished rounds, invalid team/report scope and stale final revisions",
    async () => {
      await c.budgets();
      await assert.rejects(
        reports.adjust(c.staff.sessionCookie, a.round, input),
        { code: "ROUND_NOT_FINAL" },
      );
      const end = Date.now() + 20000;
      while (
        (
          await query(
            "SELECT count(*)::integer n FROM participant_judging WHERE round_id=$1 AND completed_at IS NULL",
            [a.round],
          )
        )[0].n
      ) {
        assert.ok(Date.now() < end);
        await c.judge.tick();
      }
      await control("CLOSE");
      await control("FINALISE");
      input = { ...input, expectedRevision: await revision() };
      await c.budgets();
      await assert.rejects(
        reports.adjust(c.organiser.sessionCookie, a.round, input),
        { code: "ACCESS_UNAVAILABLE" },
      );
      await assert.rejects(
        reports.adjust(c.staff.sessionCookie, a.round, {
          ...input,
          teamRoundId: randomUUID(),
        }),
        { code: "ACCESS_UNAVAILABLE" },
      );
      await c.budgets();
      await assert.rejects(
        reports.adjust(c.staff.sessionCookie, a.round, {
          ...input,
          reportId: noAnswer.id,
        }),
        { code: "ACCESS_UNAVAILABLE" },
      );
      await assert.rejects(
        reports.adjust(c.staff.sessionCookie, a.round, {
          ...input,
          expectedRevision: "1",
        }),
        { code: "STALE_VERSION" },
      );
    },
  );
  await t.test(
    "signed final corrections rerank every public projection without changing frozen results, wallets, awards or solve times",
    async () => {
      await c.budgets();
      const original = (
        await query("SELECT * FROM round_results WHERE round_id=$1", [a.round])
      )[0];
      const wallet = (
        await query("SELECT competition_balance($1) balance", [team])
      )[0].balance;
      const live = createLiveService(c.api, c.clock, c.delivery),
        auth = {
          audience: "PARTICIPANT" as const,
          cookie: a.aa,
          roundId: a.round,
        };
      const before = await live.guarded(auth, live.snapshot);
      const added = await reports.adjust(c.staff.sessionCookie, a.round, input);
      assert.equal(added.delta, 175);
      await c.budgets();
      assert.equal(
        (await reports.adjust(c.staff.sessionCookie, a.round, input)).id,
        added.id,
      );
      assert.equal(
        (
          await reports.outcome(
            c.staff.sessionCookie,
            a.round,
            "score",
            input.requestKey,
          )
        ).receipt?.id,
        added.id,
      );
      await assert.rejects(
        reports.adjust(c.staff.sessionCookie, a.round, {
          ...input,
          delta: 176,
        }),
        { code: "INTENT_CONFLICT" },
      );
      const final = await c.service.results(c.staff.sessionCookie, a.round);
      assert.equal(final.result_version, 2);
      assert.equal(
        final.standings.find((x) => x.team_round_id === team)!.points,
        175,
      );
      const snapshot = await live.guarded(auth, live.snapshot);
      assert.equal(
        snapshot.standings.find((x) => x.team_round_id === team)!.points,
        175,
      );
      assert.notDeepEqual(snapshot.streams, before.streams);
      assert.equal(
        (
          (await createHistoryService(c.api, c.clock).overview(a.aa, a.round))
            .standings as Record<string, any>[]
        ).find((x) => x.team_round_id === team)!.points,
        175,
      );
      assert.equal(
        (await query("SELECT competition_balance($1) balance", [team]))[0]
          .balance,
        wallet,
      );
      assert.deepEqual(
        (
          await query("SELECT * FROM round_results WHERE round_id=$1", [
            a.round,
          ])
        )[0],
        original,
      );
      await c.budgets();
      await reports.adjust(c.staff.sessionCookie, a.round, {
        ...input,
        requestKey: randomUUID(),
        delta: -300,
        reason: "Correction to compensation amount: deduct 300",
        expectedRevision: await revision(),
      });
      const changed = await c.service.results(c.staff.sessionCookie, a.round);
      assert.equal(changed.result_version, 3);
      const own = changed.standings.find((x) => x.team_round_id === team)!;
      assert.equal(own.points, -125);
      assert.equal(own.rank, 2);
      assert.equal(
        own.effective_time_ms,
        original.standings.find((x: any) => x.team_round_id === team)
          .effective_time_ms,
      );
      const notes = await reports.adjustments(a.aa, a.round, "PARTICIPANT");
      assert.equal(notes.items.length, 2);
      assert.equal(
        notes.items[0]!.reason,
        "Correction to compensation amount: deduct 300",
      );
      const audit = await createStaffAuditService(
        c.api,
        c.clock,
        c.delivery,
      ).list(c.staff.sessionCookie, "SCORE_ADJUSTMENTS");
      assert.ok(audit.items.some((x) => x.reason === input.reason));
      await assert.rejects(
        c.api.query("UPDATE score_adjustments SET delta=999 WHERE id=$1", [
          added.id,
        ]),
      );
      await assert.rejects(
        c.api.query("DELETE FROM score_adjustments WHERE id=$1", [added.id]),
      );
      await assert.rejects(
        c.owner.query("UPDATE score_adjustments SET delta=0 WHERE id=$1", [
          added.id,
        ]),
      );
      await assert.rejects(
        c.api.query(
          `INSERT INTO score_adjustments(id,round_id,team_round_id,report_id,actor_id,session_id,request_key,fingerprint,expected_revision,delta,reason,recorded_at)
        SELECT gen_random_uuid(),round_id,team_round_id,NULL,actor_id,session_id,gen_random_uuid(),fingerprint,$2,1,'Backdated authority attempt',recorded_at-interval '1 hour' FROM score_adjustments WHERE id=$1`,
          [added.id, await revision()],
        ),
        { code: "42501" },
      );
    },
  );
  await t.test(
    "qualification uses corrected ranks, then remains locked through later final-score corrections",
    async () => {
      await control("QUALIFY");
      const selected = (
        await query(
          "SELECT selected FROM qualification_decisions WHERE result_id=(SELECT id FROM round_results WHERE round_id=$1)",
          [a.round],
        )
      )[0].selected;
      assert.equal(selected[1], team);
      await c.budgets();
      await reports.adjust(c.staff.sessionCookie, a.round, {
        ...input,
        requestKey: randomUUID(),
        delta: 500,
        reason: "Late audit correction; locked qualifications remain unchanged",
        expectedRevision: await revision(),
      });
      assert.deepEqual(
        (
          await query(
            "SELECT selected FROM qualification_decisions WHERE result_id=(SELECT id FROM round_results WHERE round_id=$1)",
            [a.round],
          )
        )[0].selected,
        selected,
      );
      const final = await c.service.results(c.staff.sessionCookie, a.round);
      assert.equal(
        final.standings.find((x) => x.team_round_id === team)!.rank,
        1,
      );
    },
  );
  await t.test(
    "unresolved reports pin exact submitted code past normal retention, then release that hold after a decision",
    async () => {
      await c.budgets();
      const pending = await reports.create(a.ba, a.round, a.x, {
        requestKey: randomUUID(),
        submissionId: other,
        message: "Keep this submitted answer available for later review",
      });
      await control("DISCARD");
      assert.equal(
        (
          await query(
            "SELECT retention_eligible('participant_judging',$1,clock_timestamp()+interval '100 days') eligible",
            [bound],
          )
        )[0].eligible,
        true,
      );
      for (const [kind, id] of [
        ["participant_judging", pending.parent_id],
        ["competition_submissions", other],
      ])
        assert.equal(
          (
            await query(
              "SELECT retention_eligible($1,$2,clock_timestamp()+interval '100 days') eligible",
              [kind, id],
            )
          )[0].eligible,
          false,
        );
      await c.budgets();
      await reports.decide(c.staff.sessionCookie, a.round, pending.id, {
        ...decision,
        requestKey: randomUUID(),
        reason: "Review completed; normal payload retention can resume",
      });
      assert.equal(
        (
          await query(
            "SELECT retention_eligible('participant_judging',$1,clock_timestamp()+interval '100 days') eligible",
            [pending.parent_id],
          )
        )[0].eligible,
        true,
      );
    },
  );
  await t.test(
    "Round 2 compensation can rerank completed results without taking another team's shared bounty or wallet",
    async () => {
      await c.budgets();
      const one = await c.newRound(),
        race = await c.startRace(one.round);
      const first = (
        await c.service.submit(
          race.aa,
          race.round,
          race.x,
          "FIRST CORRECT",
          randomUUID(),
        )
      ).result.submission_id as string;
      const second = (
        await c.service.submit(
          race.ba,
          race.round,
          race.x,
          "SECOND CORRECT",
          randomUUID(),
        )
      ).result.submission_id as string;
      c.answers.set(first, "PASSED");
      c.answers.set(second, "PASSED");
      const deadline = Date.now() + 20000;
      while (
        (
          await query(
            "SELECT count(*)::integer n FROM participant_judging WHERE round_id=$1 AND completed_at IS NULL",
            [race.round],
          )
        )[0].n
      ) {
        assert.ok(Date.now() < deadline);
        await c.judge.tick();
      }
      const original = await query(
        "SELECT a.* FROM bounty_awards a JOIN bounties b ON b.id=a.bounty_id WHERE b.round_id=$1",
        [race.round],
      );
      assert.equal(original.length, 1);
      assert.equal(original[0].submission_id, first);
      const appeal = await reports.create(race.ba, race.round, race.x, {
        requestKey: randomUUID(),
        submissionId: second,
        message: "Infrastructure delay appeal",
      });
      await c.budgets();
      await reports.decide(c.staff.sessionCookie, race.round, appeal.id, {
        ...decision,
        requestKey: randomUUID(),
        reason:
          "Compensate delay without changing the first team's claimed bug",
      });
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
          reason: "Final R2 compensation test",
          ownCode: c.staff.code,
        });
      }
      const balances = await query(
        "SELECT id,competition_balance(id) balance FROM team_rounds WHERE round_id=$1 ORDER BY id",
        [race.round],
      );
      await c.budgets();
      await reports.adjust(c.staff.sessionCookie, race.round, {
        ...input,
        requestKey: randomUUID(),
        teamRoundId: appeal.team_round_id,
        reportId: appeal.id,
        delta: 3000,
        reason: "R2 delay compensation",
        expectedRevision: (
          await query("SELECT revision FROM rounds WHERE id=$1", [race.round])
        )[0].revision,
      });
      const final = await c.service.results(c.staff.sessionCookie, race.round);
      assert.equal(final.standings[0]!.team_round_id, appeal.team_round_id);
      assert.deepEqual(
        await query(
          "SELECT id,competition_balance(id) balance FROM team_rounds WHERE round_id=$1 ORDER BY id",
          [race.round],
        ),
        balances,
      );
      assert.deepEqual(
        await query(
          "SELECT a.* FROM bounty_awards a JOIN bounties b ON b.id=a.bounty_id WHERE b.round_id=$1",
          [race.round],
        ),
        original,
      );
    },
  );
}
