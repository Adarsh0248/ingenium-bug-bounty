import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";

export async function submissionReviewBrowserChecks(
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newStaff(
      role?: string,
    ): Promise<{ id: string; code: string; sessionCookie: string }>;
  },
  fixture: { round: string; parent: string; attempt: string; source: string },
) {
  const owner = await c.newStaff("OWNER");
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (browser, origin, policy) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addCookies([
        {
          name: policy.names.staff,
          value: owner.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      async function inspect() {
        await c.budgets();
        await page.goto(origin);
        await page
          .getByRole("button", { name: "judging", exact: true })
          .click();
        const section = page.locator(".staff-judging");
        await section.getByLabel("Judging view").selectOption("ALL");
        await section
          .locator(`[data-parent-id="${fixture.parent}"]`)
          .getByRole("button", { name: "Inspect jobs", exact: true })
          .click();
        return section;
      }
      const section = await inspect(),
        panel = section.getByLabel("Restricted submission review");
      await panel
        .getByRole("button", { name: "Review submitted program", exact: true })
        .click();
      const modal = page.getByRole("dialog", {
        name: "Private submission review",
        exact: true,
      });
      await modal
        .getByLabel("Private review reason")
        .fill("Synthetic browser incident investigation");
      await modal
        .getByLabel("Private review scope")
        .selectOption(fixture.attempt);
      const open = modal.getByRole("button", {
        name: "Open private review",
        exact: true,
      });
      await expect(open).toBeDisabled();
      await modal
        .getByLabel("Private review confirmation")
        .fill(fixture.parent);
      let posts = 0,
        key = "";
      const path = `**/api/v1/staff/competition/rounds/${fixture.round}/judging/${fixture.parent}/reviews`;
      await page.route(path, async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        posts++;
        key = route.request().postDataJSON().request_key;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await response.body();
        await route.abort();
      });
      await c.budgets();
      await open.click();
      await expect(modal.getByRole("alert")).toContainText(
        "Connection interrupted",
      );
      await expect(open).toBeDisabled();
      await expect(
        section.getByRole("button", { name: "Back to judging queue" }),
      ).toBeDisabled();
      await modal
        .getByRole("button", { name: "Check original review", exact: true })
        .click();
      await expect(modal).toHaveCount(0);
      await expect(panel.getByLabel("Submitted source")).toContainText(
        "immutable submitted program",
      );
      await expect(panel.getByLabel("Compiler output")).toContainText(
        "Private compiler diagnostic",
      );
      await expect(panel).toContainText("Compiler output (truncated)");
      assert.equal(posts, 1);
      assert.equal(
        (
          await c.owner.query(
            "SELECT count(*)::integer AS n FROM submission_review_audits WHERE request_key=$1",
            [key],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        await page.evaluate("window.privateReviewExecuted"),
        undefined,
      );
      assert.equal(await panel.locator("script,img").count(), 0);
      const output = fileURLToPath(
        new URL("../../test-results/", import.meta.url),
      );
      await mkdir(output, { recursive: true });
      await page.screenshot({
        path: `${output}/submission-review-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await panel.getByLabel("Submitted source").scrollIntoViewIfNeeded();
      assert.ok(
        await page.evaluate(
          "document.documentElement.scrollWidth <= innerWidth + 1",
        ),
      );
      await page.screenshot({
        path: `${output}/submission-review-mobile.png`,
        fullPage: true,
      });
      await panel
        .getByRole("button", { name: "Close private review", exact: true })
        .click();
      await expect(panel.getByLabel("Submitted source")).toHaveCount(0);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.unroute(path);
      await panel
        .getByRole("button", { name: "Review submitted program", exact: true })
        .click();
      await modal
        .getByLabel("Private review confirmation")
        .fill(fixture.parent);
      await modal
        .getByLabel("Private review reason")
        .fill("Synthetic transient access check");
      await c.budgets();
      await open.click();
      await expect(panel.getByLabel("Submitted source")).toBeVisible();
      const detailPath = `**/api/v1/staff/competition/rounds/${fixture.round}/judging/${fixture.parent}`;
      await page.route(detailPath, (route) => route.abort());
      await section
        .getByRole("button", { name: "Refresh judging", exact: true })
        .click();
      await expect(panel.getByLabel("Submitted source")).toHaveCount(0);
      await page.unroute(detailPath);
      await section
        .getByRole("button", { name: "Refresh judging", exact: true })
        .click();
      await expect(
        panel.getByRole("button", {
          name: "Review submitted program",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(panel.getByLabel("Submitted source")).toHaveCount(0);
      await panel
        .getByRole("button", { name: "Review submitted program", exact: true })
        .click();
      await modal
        .getByLabel("Private review confirmation")
        .fill(fixture.parent);
      await modal
        .getByLabel("Private review reason")
        .fill("Synthetic late private response after access interruption");
      let release!: () => void, acknowledged!: () => void;
      const barrier = new Promise<void>((resolve) => {
          release = resolve;
        }),
        accepted = new Promise<void>((resolve) => {
          acknowledged = resolve;
        });
      await page.route(path, async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        const response = await route.fetch();
        acknowledged();
        await barrier;
        await route.fulfill({ response }).catch(() => {});
      });
      try {
        await open.click();
        await accepted;
        await page.route(detailPath, (route) => route.abort());
        await section
          .getByRole("button", { name: "Refresh judging", exact: true })
          .evaluate("el=>el.click()");
        await expect(
          section
            .getByRole("alert")
            .filter({ hasText: "Connection interrupted" }),
        ).toHaveCount(1);
        await page.unroute(detailPath);
        const renewed = page.waitForResponse(
          (response) =>
            response.url().endsWith(`/judging/${fixture.parent}`) &&
            response.status() === 200,
        );
        await section
          .getByRole("button", { name: "Refresh judging", exact: true })
          .evaluate("el=>el.click()");
        await renewed;
        await expect(
          section
            .getByRole("alert")
            .filter({ hasText: "Connection interrupted" }),
        ).toHaveCount(0);
        release();
        await expect(modal.getByRole("alert")).toContainText(
          "Access changed while the review was loading",
        );
        await expect(panel.getByLabel("Submitted source")).toHaveCount(0);
      } finally {
        release();
        await page.unroute(path);
      }
      await modal
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await c.owner.query(
        "UPDATE staff_identities SET role='ORGANISER',revision=revision+1 WHERE id=$1",
        [owner.id],
      );
      await expect(
        page.getByRole("heading", { name: "Session unavailable", exact: true }),
      ).toBeVisible({ timeout: 12000 });
      await expect(page.getByLabel("Submitted source")).toHaveCount(0);
      assert.deepEqual(errors, []);
      await context.close();
      const organiser = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await organiser.addCookies([
        {
          name: policy.names.staff,
          value: c.organiser.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const support = await organiser.newPage();
      await c.budgets();
      await support.goto(origin);
      await support
        .getByRole("button", { name: "judging", exact: true })
        .click();
      await support.getByLabel("Judging view").selectOption("ALL");
      await support
        .locator(`[data-parent-id="${fixture.parent}"]`)
        .getByRole("button", { name: "Inspect jobs", exact: true })
        .click();
      await expect(
        support.getByLabel("Restricted submission review"),
      ).toHaveCount(0);
      const response = await support.request.get(
        `${origin}/api/v1/staff/competition/rounds/${fixture.round}/judging/${fixture.parent}/reviews`,
      );
      assert.equal(response.status(), 403);
      assert.doesNotMatch(
        await response.text(),
        /source_b64|Private compiler|incident investigation/,
      );
      await organiser.close();
    },
  );
}
