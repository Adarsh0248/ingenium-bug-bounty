import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { maintenanceTasks } from "../../src/maintenance/tasks.js";
import { createWorkbenchService } from "../../src/workbench/service.js";
import { createSubmissionReviewService } from "../../src/competition/submission-review.js";
import { createValidationDiagnosticService } from "../../src/content/validation-diagnostics.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { AccessError } from "../../src/access/transaction.js";
import { parseProof, sha256 } from "../../src/access/credentials.js";
import type { CompetitionCommand } from "../../src/competition/service.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createRetentionStatus } from "../../src/maintenance/status.js";
import { retentionBrowserChecks } from "./retention-browser.checks.js";
import { offlineRetention } from "../../src/maintenance/offline.js";
import { createClockMonitor } from "../../src/clock/monitor.js";

export async function retentionChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newStaff(
      role?: string,
    ): Promise<{ id: string; code: string; sessionCookie: string }>;
  },
) {
  const query = async (sql: string, args: unknown[] = []) =>
      (await c.owner.query(sql, args)).rows,
    tasks = maintenanceTasks(c.api, c.clock),
    workbench = createWorkbenchService(c.api, c.clock),
    review = createSubmissionReviewService(c.api, c.clock, c.delivery),
    diagnostics = createValidationDiagnosticService(c.api, c.clock, c.delivery),
    a = await c.newRound(),
    source = "// Synthetic retention fixture\nint main(){return 0;}\n";
  const originalStaffCode = c.staff.code;
  async function control(action: CompetitionCommand["action"], payload = {}) {
    await c.budgets();
    return c.service.command(c.staff.sessionCookie, {
      action,
      roundId: a.round,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM rounds WHERE id=$1", [a.round])
      )[0].revision,
      reason: "Synthetic retention lifecycle",
      ownCode: c.staff.code,
      payload,
    });
  }
  async function complete(id: string) {
    c.answers.set(id, "PASSED");
    await c.judge.claim();
    for (
      let n = 0;
      n < 150 &&
      !(
        await query(
          "SELECT completed_at FROM participant_judging WHERE id=$1",
          [id],
        )
      )[0].completed_at;
      n++
    )
      await c.judge.tick();
    assert.ok(
      (
        await query(
          "SELECT completed_at FROM participant_judging WHERE id=$1",
          [id],
        )
      )[0].completed_at,
    );
  }
  await c.budgets();
  await workbench.save(a.aa, {
    roundId: a.round,
    bountyId: a.y,
    requestKey: randomUUID(),
    baseRevision: "0",
    source: "",
  });
  await workbench.save(a.ab, {
    roundId: a.round,
    bountyId: a.y,
    requestKey: randomUUID(),
    baseRevision: "0",
    source,
  });
  const official = (
    await c.service.submit(a.aa, a.round, a.x, source, randomUUID())
  ).result.submission_id as string;
  await complete(official);
  await c.budgets();
  const sample = (await c.service.run(a.ab, a.round, a.y, source, randomUUID()))
    .result.run_id as string;
  await complete(sample);
  const attempt = (
      await query(
        "SELECT a.* FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 ORDER BY j.position LIMIT 1",
        [official],
      )
    )[0],
    sampleAttempt = (
      await query(
        "SELECT a.* FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 LIMIT 1",
        [sample],
      )
    )[0],
    parent = (
      await query("SELECT * FROM participant_judging WHERE id=$1", [official])
    )[0],
    beforeCode = (
      await query(
        "SELECT * FROM code_drafts WHERE member_round_id=(SELECT member_round_id FROM participant_sessions WHERE id=$1)",
        [parseProof(a.ab)!.id],
      )
    )[0],
    auth = (
      await query("SELECT * FROM participant_sessions WHERE id=$1", [
        parseProof(a.aa)!.id,
      ])
    )[0],
    report = await review.open(c.staff.sessionCookie, a.round, official, {
      requestKey: randomUUID(),
      confirmParentId: official,
      attemptId: attempt.id,
      reason: "Synthetic before-retention review",
    }),
    authoring = (
      await query(
        "SELECT a.id,c.run_id FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id JOIN validation_runs v ON v.id=c.run_id JOIN bounties b ON b.snapshot_id=v.snapshot_id WHERE a.result IS NOT NULL AND b.round_id=$1 LIMIT 1",
        [a.round],
      )
    )[0];
  await diagnostics.open(c.staff.sessionCookie, authoring.run_id, {
    requestKey: randomUUID(),
    confirmRunId: authoring.run_id,
    attemptId: authoring.id,
    reason: "Synthetic before-retention diagnostics",
  });
  await t.test(
    "live and overnight-intermission payloads cannot expire, even with a future eligibility probe",
    async () => {
      const beforeClock = (
          await query("SELECT * FROM clock_health WHERE id=1")
        )[0],
        monitor = createClockMonitor(c.api, {
          bootId: randomUUID(),
          resolutionNs: 1n,
          nowNs: () => 0n,
          async sample() {
            throw new Error("No probe expected");
          },
        });
      await assert.rejects(monitor.start(true));
      assert.deepEqual(
        (await query("SELECT * FROM clock_health WHERE id=1"))[0],
        beforeClock,
      );
      await assert.rejects(
        offlineRetention(c.api, c.clock, 1, new AbortController().signal),
        { code: "MAINTENANCE_UNAVAILABLE" },
      );
      assert.equal(await tasks.payloads(), 0);
      assert.equal(await tasks.verifiers(), 0);
      for (const [kind, id] of [
        ["participant_judging", sample],
        ["participant_judging", official],
        ["code_drafts", beforeCode.id],
        ["participant_attempts", sampleAttempt.id],
        ["authoring_attempts", authoring.id],
      ])
        assert.equal(
          (
            await query(
              "SELECT retention_eligible($1,$2,clock_timestamp()+interval '60 days') eligible",
              [kind, id],
            )
          )[0].eligible,
          false,
        );
      await control("CLOSE");
      await control("FINALISE");
      assert.equal(await tasks.payloads(), 0);
      assert.equal(
        (
          await query(
            "SELECT retention_eligible('participant_judging',$1,clock_timestamp()+interval '60 days') eligible",
            [sample],
          )
        )[0].eligible,
        false,
      );
      await control("DISCARD");
    },
  );
  const frozen = (
      await query("SELECT * FROM round_results WHERE round_id=$1", [a.round])
    )[0],
    immutable = async () =>
      query(`SELECT (SELECT count(*) FROM competition_outcomes) receipts,(SELECT count(*) FROM wallet_entries) wallet_entries,
      (SELECT count(*) FROM bounty_awards) awards,(SELECT count(*) FROM draft_save_outcomes) draft_receipts,(SELECT count(*) FROM submission_review_audits) source_reads,
      (SELECT count(*) FROM validation_diagnostic_audits) diagnostic_reads,(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM execution_capacity_slots s) slots`),
    originals = await immutable();
  await t.test(
    "retention boundaries are inclusive, source classes are distinct and untrusted time cannot purge",
    async () => {
      for (const [kind, id, deadline] of [
        [
          "participant_sessions",
          auth.id,
          "least(absolute_expires_at,revoked_at)",
        ],
        ["entry_flows", auth.entry_flow_id, "expires_at"],
      ]) {
        const row = (
          await query(
            `SELECT retention_eligible($1,id,${deadline}+interval '24 hours'-interval '1 millisecond') early,
          retention_eligible($1,id,${deadline}+interval '24 hours') due FROM ${kind} WHERE id=$2`,
            [kind, id],
          )
        )[0];
        assert.equal(row.early, false);
        assert.equal(row.due, true);
      }
      for (const [kind, id, days] of [
        ["participant_judging", sample, 7],
        ["participant_judging", official, 30],
        ["code_drafts", beforeCode.id, 7],
        ["participant_attempts", attempt.id, 7],
      ] as const) {
        const row = (
          await query(
            "SELECT retention_eligible($1,$2,retention_terminal_at($3)+make_interval(days=>$4)-interval '1 millisecond') early,retention_eligible($1,$2,retention_terminal_at($3)+make_interval(days=>$4)) due",
            [kind, id, a.round, days],
          )
        )[0];
        assert.equal(row.early, false);
        assert.equal(row.due, true);
      }
      const failed = maintenanceTasks(c.api, {
        ...c.clock,
        assertHealthy() {
          throw new AccessError("CLOCK_UNTRUSTED");
        },
      });
      await assert.rejects(failed.verifiers(), { code: "CLOCK_UNTRUSTED" });
      await assert.rejects(failed.payloads(), { code: "CLOCK_UNTRUSTED" });
      assert.equal(
        (await query("SELECT count(*)::integer n FROM payload_purges"))[0].n,
        0,
      );
    },
  );
  async function ageFixture(days: number) {
    // Only this disposable synthetic database is aged; never alter host time or production retention policy.
    const client = await c.owner.connect();
    try {
      assert.match(
        (await client.query("SELECT current_database() name")).rows[0].name,
        /^ingenium_competition_[0-9a-f]+$/,
      );
      await client.query("BEGIN; SET LOCAL session_replication_role=replica");
      const tables = (
        await client.query(`SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) columns FROM information_schema.columns
        WHERE table_schema='public' AND data_type='timestamp with time zone' GROUP BY table_name ORDER BY table_name`)
      ).rows;
      for (const table of tables) {
        const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
        await client.query(
          `UPDATE public.${quote(table.table_name)} SET ${table.columns.map((column: string) => `${quote(column)}=${quote(column)}-make_interval(days=>$1)`).join(",")}`,
          [days],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await c.budgets();
    const staff = await c.newStaff();
    c.staff.sessionCookie = staff.sessionCookie;
    c.staff.code = staff.code;
  }
  await ageFixture(8);
  const aged = await immutable();
  assert.deepEqual(aged, originals);
  await t.test(
    "potential physical holds block an entire retired arena rather than deleting recovery evidence",
    async () => {
      const client = await c.owner.connect();
      try {
        await client.query("BEGIN; SET LOCAL session_replication_role=replica");
        await client.query(
          "UPDATE participant_attempts SET released_at=NULL,release_digest=NULL WHERE id=$1",
          [attempt.id],
        );
        await client.query(
          "UPDATE execution_capacity_slots SET participant_attempt_id=$1,revision=revision+1 WHERE id=1",
          [attempt.id],
        );
        await client.query("SET LOCAL session_replication_role=origin");
        assert.equal(
          (
            await client.query(
              "SELECT retention_eligible('participant_judging',$1,clock_timestamp()) eligible",
              [sample],
            )
          ).rows[0].eligible,
          false,
        );
        assert.equal(
          (
            await client.query(
              "SELECT retention_eligible('code_drafts',$1,clock_timestamp()) eligible",
              [beforeCode.id],
            )
          ).rows[0].eligible,
          false,
        );
        assert.equal(
          (
            await client.query(
              "SELECT retention_eligible('participant_attempts',$1,clock_timestamp()) eligible",
              [attempt.id],
            )
          ).rows[0].eligible,
          false,
        );
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    },
  );
  await t.test(
    "direct nulling, forged tombstones, early expiry and byte resurrection are denied",
    async () => {
      await assert.rejects(
        c.api.query("UPDATE participant_judging SET source=NULL WHERE id=$1", [
          official,
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        c.api.query(
          "INSERT INTO payload_purges VALUES('participant_judging',$1,'{}',clock_timestamp())",
          [official],
        ),
        { code: "42501" },
      );
      await assert.rejects(
        c.owner.query("UPDATE code_drafts SET source_code=NULL WHERE id=$1", [
          beforeCode.id,
        ]),
      );
      await assert.rejects(
        c.owner.query(
          "UPDATE participant_judging SET source=NULL WHERE id=$1",
          [sample],
        ),
      );
      await assert.rejects(
        c.owner.query(
          "INSERT INTO payload_purges VALUES('participant_judging',$1,'{}',date_trunc('milliseconds',statement_timestamp()))",
          [official],
        ),
      );
      assert.equal(
        (
          await query("SELECT retire_payload('participant_judging',$1) n", [
            official,
          ])
        )[0].n,
        0,
      );
      await assert.rejects(
        c.api.query("SELECT retire_payload('participant_judging',$1)", [
          sample,
        ]),
        { code: "42501" },
      );
    },
  );
  await t.test(
    "purge rollback retains original bytes and retry creates one immutable effect",
    async () => {
      const client = await c.owner.connect();
      try {
        await client.query("BEGIN");
        assert.equal(
          (
            await client.query(
              "SELECT retire_payload('participant_judging',$1) n",
              [sample],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await client.query(
              "SELECT source FROM participant_judging WHERE id=$1",
              [sample],
            )
          ).rows[0].source,
          null,
        );
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      assert.deepEqual(
        (
          await query("SELECT source FROM participant_judging WHERE id=$1", [
            sample,
          ])
        )[0].source,
        Buffer.from(source),
      );
      const batches = await Promise.all([tasks.payloads(), tasks.payloads()]);
      assert.ok(
        batches.every((count) => count >= 0 && count <= 10),
        "Five candidates can retire at most ten paired payloads per transaction.",
      );
      for (let n = 0; n < 120 && (await tasks.payloads()); n++) {}
      assert.equal(await tasks.payloads(), 0);
      for (const [table, id, field] of [
        ["participant_judging", sample, "source"],
        ["code_drafts", beforeCode.id, "source_code"],
        ["participant_attempts", attempt.id, "stdout_prefix"],
        ["authoring_attempts", authoring.id, "stdout_prefix"],
      ])
        assert.equal(
          (
            await query(`SELECT ${field} payload FROM ${table} WHERE id=$1`, [
              id,
            ])
          )[0].payload,
          null,
        );
      assert.deepEqual(
        (
          await query("SELECT source FROM participant_judging WHERE id=$1", [
            official,
          ])
        )[0].source,
        Buffer.from(source),
      );
      assert.deepEqual(
        (
          await query(
            "SELECT source FROM competition_submissions WHERE id=$1",
            [official],
          )
        )[0].source,
        Buffer.from(source),
      );
      const tombstone = (
        await query(
          "SELECT * FROM payload_purges WHERE kind='code_drafts' AND target_id=$1",
          [beforeCode.id],
        )
      )[0];
      assert.deepEqual(tombstone.manifest, {
        source_code: {
          bytes: Buffer.byteLength(source),
          sha256: sha256(source).toString("hex"),
        },
      });
      const empty = (
        await query(
          "SELECT p.manifest FROM payload_purges p JOIN code_drafts d ON d.id=p.target_id WHERE p.kind='code_drafts' AND d.member_round_id=$1",
          [auth.member_round_id],
        )
      )[0];
      assert.deepEqual(empty.manifest, {
        source_code: { bytes: 0, sha256: sha256("").toString("hex") },
      });
      assert.equal(
        (
          await query(
            "SELECT count(*)::integer n FROM payload_purges WHERE kind='code_drafts' AND target_id=$1",
            [beforeCode.id],
          )
        )[0].n,
        1,
      );
      await assert.rejects(
        c.owner.query("UPDATE code_drafts SET source_code=$2 WHERE id=$1", [
          beforeCode.id,
          Buffer.from(source),
        ]),
      );
      await assert.rejects(
        c.owner.query(
          "DELETE FROM payload_purges WHERE kind='code_drafts' AND target_id=$1",
          [beforeCode.id],
        ),
      );
      assert.deepEqual(await immutable(), originals);
    },
  );
  await t.test(
    "expired verifiers become non-secret tombstones without deleting identities, slots, credentials or receipts",
    async () => {
      const live = await c.newStaff(),
        activeId = parseProof(live.sessionCookie)!.id,
        before = (
          await query("SELECT * FROM staff_sessions WHERE id=$1", [activeId])
        )[0];
      // Preserve the original 1,600-candidate test drain bound with five-row batches.
      for (let n = 0; n < 320 && (await tasks.verifiers()); n++) {}
      assert.equal(await tasks.verifiers(), 0);
      assert.equal(
        (
          await query(
            "SELECT secret_verifier FROM participant_sessions WHERE id=$1",
            [auth.id],
          )
        )[0].secret_verifier,
        null,
      );
      assert.equal(
        (
          await query("SELECT proof_verifier FROM entry_flows WHERE id=$1", [
            auth.entry_flow_id,
          ])
        )[0].proof_verifier,
        null,
      );
      assert.deepEqual(
        (
          await query("SELECT * FROM staff_sessions WHERE id=$1", [activeId])
        )[0],
        before,
      );
      assert.equal(
        (
          await createStaffService(c.api, c.clock, c.delivery).inspect(
            live.sessionCookie,
          )
        ).staff_id,
        live.id,
      );
      await assert.rejects(c.service.state(a.aa, a.round, "PARTICIPANT"), {
        code: "INVALID_SESSION",
      });
      assert.deepEqual(
        (
          await query(
            "SELECT manifest FROM payload_purges WHERE kind='participant_sessions' AND target_id=$1",
            [auth.id],
          )
        )[0].manifest,
        { secret_verifier: { bytes: 32 } },
      );
      await assert.rejects(
        c.owner.query(
          "UPDATE participant_sessions SET secret_verifier=$2 WHERE id=$1",
          [auth.id, auth.secret_verifier],
        ),
      );
      await c.budgets();
      const flow = await createEntryService(c.api, c.clock, c.delivery).begin(
        originalStaffCode,
        { ip: "127.0.0.1", browserId: randomUUID() },
      );
      assert.equal(flow.audience, "STAFF");
      const renewed = await createStaffService(
        c.api,
        c.clock,
        c.delivery,
      ).activate(flow.proofCookie, randomUUID());
      assert.equal(
        (
          await createStaffService(c.api, c.clock, c.delivery).inspect(
            renewed.sessionCookie,
          )
        ).role,
        "OWNER",
      );
    },
  );
  await t.test(
    "expired diagnostics return controlled unavailability while metadata, frozen content and results survive",
    async () => {
      await c.budgets();
      await assert.rejects(
        review.open(c.staff.sessionCookie, a.round, official, {
          requestKey: randomUUID(),
          confirmParentId: official,
          attemptId: attempt.id,
          reason: "Synthetic expired private output",
        }),
        { code: "PAYLOAD_EXPIRED" },
      );
      await assert.rejects(
        diagnostics.open(c.staff.sessionCookie, authoring.run_id, {
          requestKey: randomUUID(),
          confirmRunId: authoring.run_id,
          attemptId: authoring.id,
          reason: "Synthetic expired authoring bytes",
        }),
        { code: "PAYLOAD_EXPIRED" },
      );
      const final = await c.service.results(c.staff.sessionCookie, a.round);
      assert.equal(final.result_id, frozen.id);
      assert.equal(final.standings.length, frozen.standings.length);
      assert.ok(
        (
          await query(
            "SELECT min(octet_length(reference_code)) n FROM validation_snapshot_variants",
          )
        )[0].n > 0,
      );
      assert.ok(
        (
          await query(
            "SELECT min(octet_length(input_data)) n FROM validation_snapshot_cases",
          )
        )[0].n > 0,
      );
      assert.deepEqual(
        (
          await query(
            "SELECT evidence,result_digest,release_digest FROM participant_attempts WHERE id=$1",
            [attempt.id],
          )
        )[0],
        {
          evidence: attempt.evidence,
          result_digest: attempt.result_digest,
          release_digest: attempt.release_digest,
        },
      );
      const settings = {
          mode: "production" as const,
          origin: "https://ingenium.test",
          cookieKey: randomBytes(32),
          csrfKey: randomBytes(32),
        },
        policy = browserPolicy(settings),
        app = buildApp({
          database: { async check() {}, async close() {} },
          entry: {
            pool: c.api,
            clock: c.clock,
            delivery: c.delivery,
            browser: settings,
            competition: c.deps,
          },
        });
      try {
        await app.ready();
        const url = `/api/v1/staff/competition/rounds/${a.round}/judging/${official}/reviews`,
          cookies = new Map<string, string>([
            [policy.names.staff, c.staff.sessionCookie],
          ]);
        async function send(path: string, body?: unknown, token?: string) {
          const response = await app.inject({
            method: body === undefined ? "GET" : "POST",
            url: path,
            headers: {
              origin: settings.origin,
              cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
              ...(token ? { "x-csrf-token": token } : {}),
            },
            ...(body === undefined ? {} : { payload: body as never }),
          });
          const lines = response.headers["set-cookie"];
          for (const line of typeof lines === "string"
            ? [lines]
            : (lines ?? [])) {
            const [name, value] = line.split(";")[0]!.split("=");
            cookies.set(name!, value!);
          }
          return response;
        }
        await send("/api/v1/bootstrap?audience=ANONYMOUS");
        const token = (await send("/api/v1/bootstrap?audience=STAFF")).json()
          .data.csrf_token;
        const response = await send(
          url,
          {
            request_key: randomUUID(),
            confirm_parent_id: official,
            attempt_id: attempt.id,
            reason: "Synthetic HTTP expired private output",
          },
          token,
        );
        assert.equal(response.statusCode, 410, response.body);
        assert.equal(response.json().error.code, "PAYLOAD_EXPIRED");
        assert.equal(response.headers["cache-control"], "no-store");
        assert.ok(
          !response.body.includes(Buffer.from(source).toString("base64")),
        );
        const recovered = await send(`${url}/${report.request_key}`);
        assert.equal(recovered.statusCode, 200);
        assert.equal(recovered.json().data.status, "NOT_OBSERVED");
        const status = await send("/api/v1/staff/maintenance/retention");
        assert.equal(status.statusCode, 200, status.body);
        assert.equal(status.headers["cache-control"], "no-store");
        assert.doesNotMatch(
          status.body,
          /source_b64|compiler_output|team_name|credential|request_key|target_id/,
        );
        assert.equal(
          (await send("/api/v1/staff/maintenance/retention?purge=true"))
            .statusCode,
          400,
        );
        assert.equal(
          (
            await app.inject({
              method: "HEAD",
              url: "/api/v1/staff/maintenance/retention",
            })
          ).statusCode,
          404,
        );
      } finally {
        await app.close();
      }
    },
  );
  await ageFixture(23);
  await t.test(
    "thirty-day official-source expiry removes both exact copies atomically and preserves byte hashes, admissions and awards",
    async () => {
      const offline = await offlineRetention(
        c.api,
        c.clock,
        1,
        new AbortController().signal,
      );
      assert.equal(offline.batches, 1);
      assert.ok(offline.purged >= 2);
      await Promise.all([tasks.payloads(), tasks.payloads()]);
      for (let n = 0; n < 30 && (await tasks.payloads()); n++) {}
      for (const kind of ["competition_submissions", "participant_judging"]) {
        assert.equal(
          (await query(`SELECT source FROM ${kind} WHERE id=$1`, [official]))[0]
            .source,
          null,
        );
        assert.deepEqual(
          (
            await query(
              "SELECT manifest FROM payload_purges WHERE kind=$1 AND target_id=$2",
              [kind, official],
            )
          )[0].manifest,
          {
            source: {
              bytes: Buffer.byteLength(source),
              sha256: sha256(source).toString("hex"),
            },
          },
        );
        await assert.rejects(
          c.owner.query(`UPDATE ${kind} SET source=$2 WHERE id=$1`, [
            official,
            Buffer.from(source),
          ]),
        );
      }
      assert.equal(
        (
          await query(
            "SELECT reserved_bytes=participant_accounted(id) exact FROM participant_judging WHERE id=$1",
            [official],
          )
        )[0].exact,
        true,
      );
      assert.equal(parent.id, official);
      assert.equal(
        (await c.service.results(c.staff.sessionCookie, a.round)).result_id,
        frozen.id,
      );
      assert.deepEqual(await immutable(), originals);
    },
  );
  await t.test(
    "offline clock startup cannot take over a running monitor or use owner-role cleanup",
    async () => {
      const source = {
          bootId: randomUUID(),
          resolutionNs: 1n,
          nowNs: () => 0n,
          async sample() {
            throw new Error("No probe expected");
          },
        },
        first = createClockMonitor(c.api, source),
        second = createClockMonitor(c.api, source);
      await first.start(true);
      const before = (await query("SELECT * FROM clock_health WHERE id=1"))[0];
      try {
        await assert.rejects(second.start(true));
        assert.deepEqual(
          (await query("SELECT * FROM clock_health WHERE id=1"))[0],
          before,
        );
      } finally {
        await first.stop();
      }
      await assert.rejects(
        offlineRetention(c.owner, c.clock, 1, new AbortController().signal),
        { code: "MAINTENANCE_UNAVAILABLE" },
      );
    },
  );
  await t.test(
    "committed maintenance progress is role-filtered, read-only and reconciles exactly to retained purge records",
    async () => {
      const read = createRetentionStatus(c.api, c.clock, c.delivery),
        actor = await c.newStaff(),
        organiser = await c.newStaff("ORGANISER");
      for (let n = 0; n < 320 && (await tasks.verifiers()); n++) {}
      await tasks.verifiers();
      await tasks.payloads();
      const value = await read(actor.sessionCookie),
        expected = (
          await query("SELECT count(*)::integer n FROM payload_purges")
        )[0].n;
      assert.equal(
        value.batches.reduce((sum, b) => sum + b.total_purged, 0),
        expected,
      );
      assert.ok(
        value.batches.every(
          (b) => b.last_completed_at !== null && b.last_batch_count === 0,
        ),
      );
      const old = (
        await query("SELECT last_activity_at FROM staff_sessions WHERE id=$1", [
          parseProof(actor.sessionCookie)!.id,
        ])
      )[0].last_activity_at;
      const { server_time: _time, ...state } = value,
        { server_time: _nextTime, ...again } = await read(actor.sessionCookie);
      assert.deepEqual(again, state);
      assert.deepEqual(
        (
          await query(
            "SELECT last_activity_at FROM staff_sessions WHERE id=$1",
            [parseProof(actor.sessionCookie)!.id],
          )
        )[0].last_activity_at,
        old,
      );
      await assert.rejects(read(organiser.sessionCookie), {
        code: "ACCESS_UNAVAILABLE",
      });
      await assert.rejects(read(a.aa));
      await assert.rejects(
        c.api.query("UPDATE retention_progress SET total_purged=0"),
        { code: "42501" },
      );
      await retentionBrowserChecks(c, actor);
    },
  );
}
