import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { expect } from "@playwright/test";
import {
  EVENT_LANGUAGES,
  newAccessCode,
  sessionDelivery,
} from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createContentService } from "../../src/content/service.js";
import { roundOnePack } from "../../../../content/round-1/load.js";
import { roundTwoPack } from "../../../../content/round-2/load.js";
import { openStaffView, withBrowserApp } from "./browser-app.js";

const keys = [
  "id",
  "round_type",
  "title",
  "statement",
  "difficulty",
  "category",
  "checker_mode",
  "variants",
  "cases",
  "hints",
];
const importData = (q: object) =>
  Object.fromEntries(
    [...keys, ...((q as { round_type?: number }).round_type === 2 ? ["base_bounty"] : [])].map((key) => [key, (q as Record<string, unknown>)[key]]),
  );

export async function eventImportChecks(
  t: TestContext,
  owner: Pool,
  api: Pool,
) {
  // This isolated authoring fixture does not claim protected judge readiness.
  const clock = { assertHealthy() {}, async verify() {}, fault() {} },
    delivery = sessionDelivery("event-import-test", randomBytes(32));
  const staff = createStaffService(api, clock, delivery),
    entry = createEntryService(api, clock, delivery),
    content = createContentService(api, clock, delivery);
  async function person(role: string) {
    const id = randomUUID(),
      code = newAccessCode();
    await owner.query(
      "INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Event pack reviewer',$2)",
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
    return staff.activate(flow.proofCookie, randomUUID());
  }
  const actor = await person("ORGANISER"),
    other = await person("OWNER");
  const budgets = () => owner.query("DELETE FROM quota_buckets");
  const all = [...roundOnePack.questions, ...roundTwoPack.questions];
  await t.test(
    "the actual 150-question import is atomic, idempotent across staff and retains four-language code, cases, hints and witnesses",
    async () => {
      for (const q of all) {
        await budgets();
        const result = await content.importQuestion(
          actor.sessionCookie,
          importData(q),
        );
        assert.equal(result.outcome, "APPLIED");
        const version = result.version_id!;
        const saved = (
          await owner.query("SELECT * FROM bug_versions WHERE id=$1", [version])
        ).rows[0];
        assert.equal(saved.title, q.title);
        assert.equal(saved.statement, q.statement);
        assert.equal(saved.base_bounty, q.base_bounty);
        assert.equal(saved.publication_status, "DRAFT");
        for (const language of EVENT_LANGUAGES) {
          const variant = (
            await owner.query(
              "SELECT * FROM language_variants WHERE version_id=$1 AND language=$2",
              [version, language],
            )
          ).rows[0];
          assert.equal(
            variant.starter_code.toString("utf8"),
            q.variants[language].starter_code,
          );
          assert.equal(
            variant.reference_code.toString("utf8"),
            q.variants[language].reference_solution_code,
          );
          assert.equal(variant.runtime_key, null);
        }
        const cases = (
          await owner.query(
            "SELECT position,visibility,input_data,expected_output FROM test_cases WHERE version_id=$1 ORDER BY position",
            [version],
          )
        ).rows;
        assert.deepEqual(
          cases.map((c) => ({
            ...c,
            input_data: c.input_data.toString("utf8"),
            expected_output: c.expected_output.toString("utf8"),
          })),
          q.cases,
        );
        assert.deepEqual(
          (
            await owner.query(
              "SELECT level,content FROM bug_hints WHERE version_id=$1 ORDER BY level",
              [version],
            )
          ).rows,
          q.hints,
        );
      }
      await budgets();
      const first = importData(all[0]!);
      const replies = await Promise.all([
        content.importQuestion(actor.sessionCookie, first),
        content.importQuestion(other.sessionCookie, first),
      ]);
      assert.deepEqual(replies[0], replies[1]);
      await assert.rejects(
        content.importQuestion(actor.sessionCookie, {
          ...first,
          title: "Changed source content",
        }),
        { code: "INTENT_CONFLICT" },
      );
      assert.equal(
        (await owner.query("SELECT count(*)::integer n FROM bug_versions"))
          .rows[0].n,
        150,
      );
      assert.equal(
        (await owner.query("SELECT count(*)::integer n FROM language_variants"))
          .rows[0].n,
        600,
      );
      assert.equal(
        (await owner.query("SELECT count(*)::integer n FROM failure_witnesses"))
          .rows[0].n,
        600,
      );
      assert.equal(
        (await owner.query("SELECT count(*)::integer n FROM bug_hints")).rows[0]
          .n,
        450,
      );
      assert.equal(
        (await owner.query("SELECT count(*)::integer n FROM validation_runs"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (
          await owner.query(
            "SELECT count(*)::integer n FROM content_publication_outcomes",
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await t.test(
    "an import failure rolls back the whole question without replacing existing drafts",
    async () => {
      await owner.query(
        "CREATE FUNCTION reject_import_hint() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.content='Synthetic import failure' THEN RAISE EXCEPTION 'Synthetic import failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_import_hint BEFORE INSERT ON bug_hints FOR EACH ROW EXECUTE FUNCTION reject_import_hint();",
      );
      try {
        const q = structuredClone(importData(all[0]!));
        q.id = randomUUID();
        q.title = "Must roll back";
        (q.hints as { content: string }[])[2]!.content =
          "Synthetic import failure";
        await budgets();
        await assert.rejects(content.importQuestion(actor.sessionCookie, q), {
          code: "P0001",
        });
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer n FROM bug_versions WHERE title='Must roll back'",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer n FROM content_outcomes WHERE request_key=$1",
              [q.id],
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await owner.query(
          "DROP TRIGGER reject_import_hint ON bug_hints; DROP FUNCTION reject_import_hint()",
        );
      }
      await assert.rejects(
        content.importQuestion(actor.sessionCookie, {
          ...importData(all[0]!),
          extra: true,
        }),
        { code: "INVALID_CONTEXT" },
      );
      await assert.rejects(
        content.importQuestion("invalid", importData(all[0]!)),
        { code: "INVALID_SESSION" },
      );
    },
  );
  await t.test(
    "round filters and pagination never mix rounds, and the browser shows separate 50/100 question libraries",
    async () => {
      await budgets();
      const r1 = await content.list(actor.sessionCookie, undefined, 1),
        r2 = await content.list(actor.sessionCookie, undefined, 2);
      assert.deepEqual(r1.round_counts, { round_1: 50, round_2: 100 });
      assert.equal(r1.items.length, 50);
      assert.equal(r1.next_after, null);
      assert.ok(r1.items.every((q) => q.round_type === 1));
      assert.ok(r2.items.every((q) => q.round_type === 2));
      const second = await content.list(actor.sessionCookie, r2.next_after!, 2);
      assert.equal(second.items.length, 50);
      assert.equal(second.next_after, null);
      assert.equal(
        new Set([...r2.items, ...second.items].map((q) => q.version_id)).size,
        100,
      );
      await assert.rejects(content.list(actor.sessionCookie, undefined, 3), {
        code: "INVALID_CONTEXT",
      });
      await withBrowserApp(
        { pool: api, clock, delivery },
        async (browser, origin, policy) => {
          const context = await browser.newContext({
            viewport: { width: 1366, height: 900 },
          });
          await context.addCookies([
            {
              name: policy.names.staff,
              value: actor.sessionCookie,
              url: origin,
              httpOnly: true,
              sameSite: "Strict",
            },
          ]);
          const page = await context.newPage();
          try {
            await budgets();
            await page.goto(origin);
            await openStaffView(page, "Questions");
            const rounds = page.getByRole("navigation", {
              name: "Question rounds",
            });
            await expect(
              rounds.getByRole("button", {
                name: "Round 1 questions",
                exact: true,
              }),
            ).toContainText("50 questions");
            await expect(
              rounds.getByRole("button", {
                name: "Round 2 questions",
                exact: true,
              }),
            ).toContainText("100 questions");
            await expect(
              page.locator(".staff-content tr[data-version-id]"),
            ).toHaveCount(50);
            await rounds
              .getByRole("button", { name: "Round 2 questions", exact: true })
              .click();
            await expect(
              page.locator(
                ".staff-content tr[data-version-id] td:nth-child(2)",
              ),
            ).toHaveText(Array(50).fill("Round 2"));
            await page
              .getByRole("button", { name: "Next bug page", exact: true })
              .click();
            await expect(page.locator(".staff-pagination")).toContainText(
              "Page 2",
            );
            await rounds
              .getByRole("button", { name: "Round 1 questions", exact: true })
              .click();
            await expect(
              page.locator(
                ".staff-content tr[data-version-id] td:nth-child(2)",
              ),
            ).toHaveText(Array(50).fill("Round 1"));
            await expect(page.locator(".staff-pagination")).toContainText(
              "Page 1",
            );
            const bootstrap = await page.request.get(
              `${origin}/api/v1/bootstrap?audience=STAFF`,
            );
            const token = (await bootstrap.json()).data.csrf_token;
            const endpoint = `${origin}/api/v1/staff/content/import-question`;
            const body = { question: importData(all[0]!) };
            assert.equal(
              (
                await page.request.post(endpoint, {
                  data: body,
                  headers: { Origin: origin },
                })
              ).status(),
              403,
            );
            await budgets();
            const accepted = await page.request.post(endpoint, {
              data: body,
              headers: { Origin: origin, "x-csrf-token": token },
            });
            assert.equal(accepted.status(), 200);
            assert.ok(
              !JSON.stringify(await accepted.json()).includes(
                "reference_solution_code",
              ),
            );
            assert.equal(
              (
                await page.request.get(
                  `${origin}/api/v1/staff/content/versions?round_type=3`,
                )
              ).status(),
              400,
            );
            await page.screenshot({
              path: "test-results/event-import-round1.png",
              fullPage: true,
            });
          } finally {
            await context.close();
          }
        },
      );
    },
  );
}
