import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Pool } from "pg";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { createContentService } from "../../src/content/service.js";
import { createPublicationService } from "../../src/content/publication-service.js";
import { createArenaService } from "../../src/access/arena-service.js";
import type { createValidationWorker } from "../../src/content/validation-worker.js";
import type { createCompetitionService } from "../../src/competition/service.js";

interface Context {
  owner: Pool;
  api: Pool;
  clock: ClockGuard;
  delivery: SessionDelivery;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string };
  service: ReturnType<typeof createCompetitionService>;
  validationWorker: ReturnType<typeof createValidationWorker>;
  held: Set<string>;
  teams: { id: string }[];
  budgets(): Promise<void>;
}
export async function staffContentChecks(
  browser: Browser,
  origin: string,
  cookieName: string,
  c: Context,
) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    errors: string[] = [],
    content = createContentService(c.api, c.clock, c.delivery);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addCookies([
    {
      name: cookieName,
      value: c.staff.sessionCookie,
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  // Preparation deliberately refuses active arenas; finish the preceding fixture normally.
  const current = (
    await c.owner.query(
      `SELECT r.id,r.state FROM rounds r JOIN arena_control a ON a.current_instance_id=r.arena_instance_id WHERE r.kind=1`,
    )
  ).rows[0];
  if (current) {
    for (const action of ["CLOSE", "FINALISE", "DISCARD"] as const) {
      const row = (
        await c.owner.query("SELECT state,revision FROM rounds WHERE id=$1", [
          current.id,
        ])
      ).rows[0];
      if (
        (action === "CLOSE" && row.state !== "RUNNING") ||
        (action === "FINALISE" && row.state !== "CLOSING")
      )
        continue;
      await c.budgets();
      await c.service.command(c.staff.sessionCookie, {
        action,
        roundId: current.id,
        requestKey: randomUUID(),
        expectedRevision: row.revision,
        reason: "Finish prior browser fixture",
        payload: {},
        ownCode: c.staff.code,
      });
    }
  }
  const title = "Synthetic browser-authored bug";
  let id: string;
  const editor = () => page.locator(".content-form");
  async function tab(name: string) {
    await page
      .getByRole("navigation", { name: "Bug sections" })
      .getByRole("button", { name, exact: true })
      .click();
  }
  async function save(action = "Review save") {
    await editor().getByRole("button", { name: action, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Audit reason", { exact: true })
      .fill("Synthetic browser content edit");
    await c.budgets();
    await dialog
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  async function done() {
    await expect(editor()).toHaveCount(0);
  }
  async function cancel(discard = false) {
    await editor()
      .getByRole("button", { name: "Cancel edit", exact: true })
      .click();
    if (discard)
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Discard draft changes", exact: true })
        .click();
    await done();
  }
  async function file(name: string, text: string) {
    await page.getByLabel(`File for ${name}`, { exact: true }).setInputFiles({
      name: "synthetic.txt",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(text),
    });
    await expect(
      editor().getByRole("button", { name: "Review save", exact: true }),
    ).toBeEnabled();
  }
  async function inspectBytes(section: "VARIANTS" | "CASES", target: string) {
    return (
      await content.privateRead(c.staff.sessionCookie, id, section, target)
    ).data as any;
  }
  try {
    await c.budgets();
    await page.goto(origin);
    await page.getByRole("button", { name: "library", exact: true }).click();
    await page.getByRole("button", { name: "New bug", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page
      .getByLabel("Statement", { exact: true })
      .fill("Synthetic full-program input/output statement.");
    await page.getByLabel("Difficulty", { exact: true }).fill("95");
    await expect(page.getByText("Bounty: 950", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    let posts = 0,
      drop = true;
    await page.route("**/api/v1/staff/content/definitions", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      posts++;
      const response = await route.fetch();
      if (drop) {
        drop = false;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{",
        });
      } else await route.fulfill({ response });
    });
    await save();
    await expect(
      page.getByText("Save outcome unknown", { exact: true }),
    ).toBeVisible();
    await expect(
      editor().getByRole("button", { name: "Review save", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Check original receipt", exact: true })
      .click();
    await done();
    assert.equal(posts, 1);
    const stored = (
      await c.owner.query(
        "SELECT id,base_bounty FROM bug_versions WHERE title=$1",
        [title],
      )
    ).rows;
    assert.equal(stored.length, 1);
    assert.equal(stored[0].base_bounty, 950);
    id = stored[0].id;

    await tab("Validation");
    await page
      .getByRole("button", { name: "Prepare validation", exact: true })
      .click();
    await save("Prepare snapshot");
    await done();
    await expect(
      page.getByRole("heading", { name: "Preparation declined", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".content-preparation")).toContainText(
      "language required",
    );
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::int n FROM validation_snapshots WHERE version_id=$1",
          [id],
        )
      ).rows[0].n,
      0,
    );

    await tab("Details");
    await page
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    await page
      .getByLabel("Title", { exact: true })
      .fill("Local conflicting title");
    const before = await content.describe(c.staff.sessionCookie, id);
    await c.budgets();
    await content.command(c.staff.sessionCookie, {
      action: "METADATA",
      targetId: id,
      expectedRevision: before.content_revision,
      requestKey: randomUUID(),
      reason: "Concurrent browser fixture",
      payload: {
        title,
        statement: "Concurrent approved statement",
        difficulty: 95,
        checker_mode: "TOKENS",
      },
    });
    await save();
    await expect(page.locator(".staff-content > .error")).toContainText(
      "stale version",
    );
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Local conflicting title",
    );
    await cancel(true);
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page
      .getByRole("button", { name: `Open ${title} version 1`, exact: true })
      .click();
    await expect(page.locator(".content-preview")).toContainText(
      "Concurrent approved statement",
    );

    await tab("Languages");
    const exact = "\ufeff// synthetic\r\n\0",
      reference = "// synthetic reference\r\n";
    for (const language of ["c", "cpp", "java", "python", "javascript"]) {
      await c.budgets();
      await page.getByLabel("Language", { exact: true }).selectOption(language);
      await page
        .getByRole("button", { name: "Edit language variant", exact: true })
        .click();
      await file("Starter code", exact);
      await file("Reference solution", reference);
      if (language === "c") {
        await page
          .getByLabel("File for Starter code", { exact: true })
          .setInputFiles({
            name: "invalid.txt",
            mimeType: "application/octet-stream",
            buffer: Buffer.from([0xc3, 0x28]),
          });
        await expect(page.locator(".staff-content > .error")).toBeVisible();
        const download = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Download Starter code", exact: true })
          .click();
        const stream = await (await download).createReadStream();
        assert.ok(stream);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        assert.deepEqual(Buffer.concat(chunks), Buffer.from(exact));
      }
      await page
        .getByLabel("Private defect description", { exact: true })
        .fill("Synthetic starter returns the wrong value.");
      await page
        .getByRole("checkbox", { name: "Runtime configured", exact: true })
        .check();
      await page
        .getByLabel("Registered runtime key", { exact: true })
        .fill(`competition-${language}`);
      await save();
      await done();
      const read = await inspectBytes("VARIANTS", language);
      assert.equal(read.starter_code, exact);
      assert.equal(read.reference_solution_code, reference);
    }
    await page
      .getByRole("button", { name: "Edit language variant", exact: true })
      .click();
    const revision = (await content.describe(c.staff.sessionCookie, id))
      .content_revision;
    await save();
    await done();
    assert.equal(
      (await content.describe(c.staff.sessionCookie, id)).content_revision,
      revision,
    );

    await tab("Test cases");
    for (const visibility of ["SAMPLE", "HIDDEN"]) {
      await c.budgets();
      await page
        .getByRole("button", { name: "Add test case", exact: true })
        .click();
      await page
        .getByLabel("Visibility", { exact: true })
        .selectOption(visibility);
      await file("Input", visibility === "SAMPLE" ? "" : "\ufeff7\0 5\r\n");
      await file("Expected output", "12\r\n");
      await save();
      await done();
    }
    const cases = (await content.describe(c.staff.sessionCookie, id)).cases;
    const hidden = cases.find((x) => x.visibility === "HIDDEN")!,
      sample = cases.find((x) => x.visibility === "SAMPLE")!;
    assert.equal(
      (await inspectBytes("CASES", hidden.case_id)).input_data,
      "\ufeff7\0 5\r\n",
    );
    assert.equal((await inspectBytes("CASES", sample.case_id)).input_data, "");
    await page
      .getByRole("button", { name: "Move up case 2", exact: true })
      .click();
    await save();
    await done();
    assert.equal(
      (await content.describe(c.staff.sessionCookie, id)).cases[0]!.case_id,
      hidden.case_id,
    );

    await tab("Starter failures");
    for (const language of ["c", "cpp", "java", "python", "javascript"]) {
      await c.budgets();
      await page.getByLabel("Language", { exact: true }).selectOption(language);
      await page
        .getByRole("button", { name: "Edit starter failures", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Add starter failure", exact: true })
        .click();
      await page
        .getByLabel("Failure 1", { exact: true })
        .selectOption(hidden.case_id);
      if (language === "c") {
        await page
          .getByRole("button", { name: "Add starter failure", exact: true })
          .click();
        await expect(
          editor().getByRole("button", { name: "Review save", exact: true }),
        ).toBeDisabled();
        await page
          .getByRole("button", { name: "Remove failure 2", exact: true })
          .click();
      }
      await expect(
        page
          .getByLabel("Failure 1", { exact: true })
          .locator("option[value='COMPILATION']"),
      ).toHaveCount(["c", "cpp", "java"].includes(language) ? 1 : 0);
      await save();
      await done();
    }
    await tab("Test cases");
    await page
      .locator(`[data-case-id="${hidden.case_id}"]`)
      .getByRole("button", { name: /^Retire case/ })
      .click();
    await save();
    await expect(page.locator(".staff-content > .error")).toContainText(
      "referenced case",
    );
    await cancel();
    await page
      .getByRole("button", { name: "Add test case", exact: true })
      .click();
    await save();
    await done();
    const added = (
      await content.describe(c.staff.sessionCookie, id)
    ).cases.find((x) => !cases.some((y) => y.case_id === x.case_id))!;
    await page
      .locator(`[data-case-id="${added.case_id}"]`)
      .getByRole("button", { name: /^Retire case/ })
      .click();
    await save();
    await done();
    await tab("Hints");
    for (const level of [1, 2, 3]) {
      await page
        .getByRole("button", { name: `Edit hint ${level}`, exact: true })
        .click();
      await page
        .getByLabel("Hint text", { exact: true })
        .fill(`Synthetic private hint ${level}`);
      await save();
      await done();
    }
    await tab("Validation");
    await page
      .getByRole("button", { name: "Prepare validation", exact: true })
      .click();
    await save("Prepare snapshot");
    await done();
    await expect(
      page.getByRole("heading", { name: "Snapshot prepared", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Inspect frozen check plan", exact: true })
      .click();
    await expect(page.locator(".staff-reference").last()).toContainText(
      "15 checks",
    );
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::int n FROM validation_runs r JOIN validation_snapshots s ON s.id=r.snapshot_id WHERE s.version_id=$1",
          [id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await c.owner.query(
          "SELECT publication_status FROM bug_versions WHERE id=$1",
          [id],
        )
      ).rows[0].publication_status,
      "DRAFT",
    );
    const snapshotId = (
      await c.owner.query(
        "SELECT id FROM validation_snapshots WHERE version_id=$1 ORDER BY content_revision DESC LIMIT 1",
        [id],
      )
    ).rows[0].id as string;
    await c.validationWorker.claim();
    let admissions = 0;
    await page.route(
      `**/api/v1/staff/content/validation-snapshots/${snapshotId}/runs`,
      async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        admissions++;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{",
        });
      },
    );
    await page
      .getByRole("button", { name: "Request validation run", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Validation reason", { exact: true })
      .fill("Synthetic reviewed browser run");
    await c.budgets();
    await page
      .getByRole("button", { name: "Confirm validation request", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Recover validation receipt", exact: true })
      .click();
    await expect(
      page.getByText("Validation admitted.", { exact: true }),
    ).toBeVisible();
    assert.equal(admissions, 1);
    const runId = (
      await c.owner.query(
        "SELECT id FROM validation_runs WHERE snapshot_id=$1",
        [snapshotId],
      )
    ).rows[0].id as string;
    await expect(page.locator("[data-validation-status]")).toHaveAttribute(
      "data-validation-status",
      "QUEUED",
    );
    await expect(
      page.getByRole("button", { name: "Review publication", exact: true }),
    ).toBeDisabled();
    async function completed() {
      return (
        await c.owner.query(
          "SELECT count(*)::int n FROM authoring_checks WHERE run_id=$1 AND result IS NOT NULL",
          [runId],
        )
      ).rows[0].n as number;
    }
    for (let i = 0; i < 80 && (await completed()) < 14; i++)
      await c.validationWorker.tick();
    assert.equal(await completed(), 14);
    c.held.add(runId);
    for (let i = 0; i < 10 && (await completed()) < 15; i++)
      await c.validationWorker.tick();
    assert.equal(await completed(), 15);
    await page
      .getByRole("button", { name: "Refresh validation report", exact: true })
      .click();
    await expect(page.locator("[data-validation-status]")).toHaveAttribute(
      "data-validation-status",
      "PASSED",
    );
    await expect(page.locator(`[data-run-id="${runId}"]`)).toContainText(
      "passed",
    );
    await expect(
      page.getByText("Pending - publication locked", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review publication", exact: true }),
    ).toBeDisabled();
    const publications = createPublicationService(c.api, c.clock, c.delivery),
      rev = (await content.describe(c.staff.sessionCookie, id))
        .content_revision;
    const heldIntent = {
      snapshotId,
      runId,
      requestKey: randomUUID(),
      expectedRevision: rev,
      review: "Synthetic premature cleanup review",
      ownCode: c.staff.code,
    };
    await c.budgets();
    await assert.rejects(
      publications.publish(c.organiser.sessionCookie, heldIntent),
      { code: "ACCESS_UNAVAILABLE" },
    );
    await assert.rejects(
      publications.publish(c.staff.sessionCookie, {
        ...heldIntent,
        snapshotId: randomUUID(),
      }),
      { code: "CONTENT_UNAVAILABLE" },
    );
    const stale = await publications.publish(c.staff.sessionCookie, {
      ...heldIntent,
      requestKey: randomUUID(),
      expectedRevision: (BigInt(rev) + 1n).toString(),
    });
    assert.equal(stale.reason, "STALE_VERSION");
    const foreignRun = (
      await c.owner.query(
        "SELECT id FROM validation_runs WHERE snapshot_id<>$1 LIMIT 1",
        [snapshotId],
      )
    ).rows[0].id;
    assert.equal(
      (
        await publications.publish(c.staff.sessionCookie, {
          ...heldIntent,
          runId: foreignRun,
          requestKey: randomUUID(),
        })
      ).reason,
      "VALIDATION_NOT_PASSED",
    );
    await c.budgets();
    assert.equal(
      (await publications.publish(c.staff.sessionCookie, heldIntent)).reason,
      "CLEANUP_PENDING",
    );
    c.held.delete(runId);
    for (let i = 0; i < 60; i++) {
      await c.validationWorker.tick();
      if (
        (
          await c.owner.query(
            "SELECT count(*)::int n FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1 AND a.released_at IS NULL",
            [runId],
          )
        ).rows[0].n === 0
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await page
      .getByRole("button", { name: "Refresh validation report", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Review publication", exact: true }),
    ).toBeEnabled();
    await c.budgets();
    assert.equal(
      (await publications.publish(c.staff.sessionCookie, heldIntent)).reason,
      "CLEANUP_PENDING",
    );
    await page.screenshot({
      path: "test-results/content-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/content-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        "document.documentElement.scrollWidth <= innerWidth + 1",
      ),
      true,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page
      .getByRole("button", { name: "Review publication", exact: true })
      .click();
    const review = page.getByRole("dialog", {
      name: "Publish reviewed bug",
      exact: true,
    });
    await review
      .getByLabel("Review notes", { exact: true })
      .fill("Synthetic full content and fairness review");
    await expect(
      review.getByRole("button", { name: "Confirm publication", exact: true }),
    ).toBeDisabled();
    for (const check of await review.getByRole("checkbox").all())
      await check.check();
    await review
      .getByLabel("Your staff code", { exact: true })
      .fill("A".repeat(32));
    await c.budgets();
    await review
      .getByRole("button", { name: "Confirm publication", exact: true })
      .click();
    await expect(review.getByRole("alert")).toContainText(
      "Confirmation failed",
    );
    await review
      .getByLabel("Your staff code", { exact: true })
      .fill(c.staff.code);
    let publicationPosts = 0;
    await page.route(
      `**/api/v1/staff/competition/publications/${snapshotId}`,
      async (route) => {
        publicationPosts++;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{",
        });
      },
    );
    await c.budgets();
    await review
      .getByRole("button", { name: "Confirm publication", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Recover validation receipt", exact: true })
      .click();
    await expect(
      page.getByText("Published for arena selection.", { exact: true }),
    ).toBeVisible();
    assert.equal(publicationPosts, 1);
    assert.equal(
      (await content.describe(c.staff.sessionCookie, id)).publication_status,
      "PUBLISHED",
    );
    const applied = (
      await c.owner.query(
        "SELECT * FROM content_publication_outcomes WHERE snapshot_id=$1 AND outcome='APPLIED'",
        [snapshotId],
      )
    ).rows;
    assert.equal(applied.length, 1);
    assert.equal(JSON.stringify(applied).includes(c.staff.code), false);
    const again = await publications.publish(c.staff.sessionCookie, {
      snapshotId,
      runId,
      requestKey: applied[0].request_key,
      expectedRevision: rev,
      review: applied[0].review,
      ownCode: c.staff.code,
    });
    assert.equal(again.outcome_id, applied[0].id);
    await assert.rejects(
      publications.publish(c.staff.sessionCookie, {
        snapshotId,
        runId,
        requestKey: applied[0].request_key,
        expectedRevision: rev,
        review: "Changed publication intent",
        ownCode: c.staff.code,
      }),
      { code: "P0002" },
    );
    await assert.rejects(
      c.api.query("DELETE FROM content_publication_outcomes WHERE id=$1", [
        applied[0].id,
      ]),
      { code: "42501" },
    );
    await assert.rejects(
      c.owner.query(
        "UPDATE content_publication_outcomes SET review='forged' WHERE id=$1",
        [applied[0].id],
      ),
      { code: "P0001" },
    );
    assert.equal(
      (
        await c.owner.query(
          "SELECT to_regprocedure('competition_publish(uuid,uuid,uuid,text)') old",
        )
      ).rows[0].old,
      null,
    );
    await page.reload();
    await page.getByRole("button", { name: "library", exact: true }).click();
    await page.locator(`[data-version-id="${id}"]`).getByRole("button").click();
    await tab("Validation");
    await expect(page.locator(`[data-run-id="${runId}"]`)).toBeVisible();
    await expect(page.locator(".content-validation")).toContainText(
      `Run ${runId}`,
    );
    await expect(
      page.getByRole("button", { name: "Review publication", exact: true }),
    ).toBeDisabled();

    await page
      .getByRole("button", { name: "New version", exact: true })
      .click();
    await save();
    await done();
    const second = (
      await c.owner.query(
        "SELECT id FROM bug_versions WHERE definition_id=$1 AND version_number=2",
        [(await content.describe(c.staff.sessionCookie, id)).definition_id],
      )
    ).rows[0].id;
    const blank = await content.describe(c.staff.sessionCookie, second);
    assert.deepEqual(blank.variants, []);
    assert.deepEqual(blank.cases, []);
    await page.getByRole("button", { name: "Library", exact: true }).click();
    const published = (
      await c.owner.query(
        "SELECT id,title,version_number FROM bug_versions WHERE publication_status='PUBLISHED' LIMIT 1",
      )
    ).rows[0];
    await page
      .getByRole("button", {
        name: `Open ${published.title} version ${published.version_number}`,
        exact: true,
      })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Edit details", exact: true }),
    ).toBeDisabled();
    await tab("Languages");
    await page
      .getByRole("button", { name: "Inspect language variant", exact: true })
      .click();
    await expect(
      page.getByLabel("Reference solution", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Close inspection", exact: true })
      .click();
    await c.budgets();
    await createArenaService(c.api, c.clock, c.delivery).command(
      c.staff.sessionCookie,
      {
        action: "CREATE",
        roundId: null,
        requestKey: randomUUID(),
        expectedRevision: (
          await c.owner.query("SELECT revision FROM arena_control WHERE id=1")
        ).rows[0].revision,
        durationMs: 900000,
        teamIds: c.teams.map((team) => team.id),
        reason: "Synthetic publication-to-selection verification",
      },
    );
    await page.getByRole("button", { name: "bounties", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: `Select bug ${title}`, exact: true }),
    ).toBeVisible();
    await context.clearCookies();
    await context.addCookies([
      {
        name: cookieName,
        value: c.organiser.sessionCookie,
        url: origin,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await page.reload();
    await expect(page.getByText("CONTROL ROOM", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "library", exact: true }),
    ).toHaveCount(0);
    assert.equal(
      (
        await page.request.get(`${origin}/api/v1/staff/content/versions`)
      ).status(),
      403,
    );
    for (const path of [
      `/staff/content/versions/${id}/validation-snapshots`,
      `/staff/content/validation-snapshots/${snapshotId}/runs`,
      `/staff/content/validation-runs/${runId}`,
      `/staff/outcomes/publication/${snapshotId}/${applied[0].request_key}`,
    ])
      assert.equal(
        (await page.request.get(`${origin}/api/v1${path}`)).status(),
        403,
      );
    assert.deepEqual(errors, []);
    for (const storage of ["localStorage", "sessionStorage"] as const)
      assert.equal(
        await page.evaluate(
          `Object.values(window.${storage}).some(v => String(v).includes('Synthetic private hint'))`,
        ),
        false,
      );
  } catch (e) {
    console.error(
      "Content browser:",
      await page
        .locator(".staff-content > .error, .staff-message")
        .allTextContents(),
    );
    await page.screenshot({
      path: "test-results/content-failure.png",
      fullPage: true,
    });
    throw e;
  } finally {
    await context.close();
  }
}
