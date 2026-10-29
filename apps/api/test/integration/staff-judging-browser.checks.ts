import { supplyLegacyStaffCode } from "./browser-app.js";
import { openStaffView } from "./browser-app.js";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";

export async function staffJudgingBrowserChecks(
  c: Parameters<typeof participantJudgingChecks>[1],
  fixture: {
    round: string;
    parent: string;
    job: string;
    heldParent: string;
    heldJob: string;
  },
) {
  let key = "";
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (browser, origin, policy) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addCookies([
        {
          name: policy.names.staff,
          value: c.staff.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await c.budgets();
      await page.goto(origin);
      await openStaffView(page, "Submissions");
      const section = page.locator(".staff-judging"),
        inspect = async (id: string) =>
          section
            .locator(`[data-parent-id="${id}"]`)
            .getByRole("button", { name: "Inspect jobs", exact: true })
            .click();
      await expect(
        section.getByRole("heading", { name: "Judging & recovery" }),
      ).toBeVisible();
      await inspect(fixture.heldParent);
      await section
        .locator(`[data-job-id="${fixture.heldJob}"]`)
        .getByRole("button")
        .click();
      await expect(
        section.getByRole("button", {
          name: "Authorise one extra dispatch",
          exact: true,
        }),
      ).toBeDisabled();
      await expect(section.getByLabel("Selected judging job")).toContainText(
        "Physical execution remains unresolved",
      );
      await section
        .getByRole("button", { name: "Back to judging queue" })
        .click();
      await inspect(fixture.parent);
      await section
        .locator(`[data-job-id="${fixture.job}"]`)
        .getByRole("button")
        .click();
      const authorise = section.getByRole("button", {
        name: "Authorise one extra dispatch",
        exact: true,
      });
      await expect(authorise).toBeEnabled();
      const detailPath = `**/api/v1/staff/competition/rounds/${fixture.round}/judging/${fixture.parent}`;
      await page.route(detailPath, (route) => route.abort());
      await section
        .getByRole("button", { name: "Refresh judging", exact: true })
        .click();
      await expect(section.getByRole("alert")).toContainText(
        "Connection interrupted",
      );
      await expect(authorise).toBeDisabled();
      await page.unroute(detailPath);
      await section
        .getByRole("button", { name: "Refresh judging", exact: true })
        .click();
      await expect(authorise).toBeEnabled();
      await authorise.click();
      const modal = page.getByRole("dialog", {
        name: "Authorise one extra dispatch",
      });
      await modal
        .getByLabel("Recovery audit reason")
        .fill("Synthetic browser recovery after verified physical drain");
      await supplyLegacyStaffCode(modal, "WRONG-STAFF-CODE");
      const confirm = modal.getByRole("button", {
        name: "Confirm extra dispatch",
        exact: true,
      });
      await expect(confirm).toBeDisabled();
      await modal.getByLabel("Recovery job confirmation").fill(fixture.job);
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect(modal.getByRole("alert")).toContainText(
        "Confirmation failed",
      );
      await expect(modal.getByLabel("Recovery staff code")).toHaveCount(0);
      await expect(modal.getByLabel("Recovery audit reason")).toHaveValue(
        "Synthetic browser recovery after verified physical drain",
      );
      const output = fileURLToPath(
        new URL("../../test-results/", import.meta.url),
      );
      await mkdir(output, { recursive: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `${output}/staff-judging-mobile-confirmation.png`,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      let posts = 0;
      const retryPath = `**/api/v1/staff/competition/rounds/${fixture.round}/jobs/${fixture.job}/retry`;
      await page.route(retryPath, async (route) => {
        posts++;
        key = (route.request().postDataJSON() as { request_key: string })
          .request_key;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await response.body();
        await route.abort();
      });
      await c.budgets();
      await supplyLegacyStaffCode(modal, c.staff.code);
      await confirm.click();
      await expect(modal.getByLabel("Recovery staff code")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Live overview", exact: true }),
      ).toBeDisabled();
      await expect(confirm).toBeDisabled();
      await expect(
        modal.getByRole("button", {
          name: "Check original recovery action",
          exact: true,
        }),
      ).toBeEnabled();
      await modal
        .getByRole("button", {
          name: "Check original recovery action",
          exact: true,
        })
        .click();
      await expect(modal).toHaveCount(0);
      await expect(
        section.getByText(
          "One extra dispatch authorised. The original worker still performs all safety checks.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(authorise).toBeDisabled();
      await expect(section.getByLabel("Recovery audit history")).toContainText(
        "Synthetic browser recovery after verified physical drain",
      );
      assert.equal(posts, 1);
      await page.screenshot({
        path: `${output}/staff-judging-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `${output}/staff-judging-mobile.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(() => {
          const w = globalThis as unknown as {
            innerWidth: number;
            document: { documentElement: { scrollWidth: number } };
          };
          return w.document.documentElement.scrollWidth > w.innerWidth;
        }),
        false,
      );
      assert.deepEqual(errors, []);
      await context.close();
      const organiser = await browser.newContext();
      await organiser.addCookies([
        {
          name: policy.names.staff,
          value: c.organiser.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const monitoring = await organiser.newPage();
      await c.budgets();
      await monitoring.goto(origin);
      await openStaffView(monitoring, "Submissions");
      await monitoring
        .locator(`[data-parent-id="${fixture.parent}"]`)
        .getByRole("button", { name: "Inspect jobs" })
        .click();
      await monitoring
        .locator(`[data-job-id="${fixture.job}"]`)
        .getByRole("button")
        .click();
      await expect(
        monitoring.getByRole("heading", { name: "Dispatch timeline" }),
      ).toBeVisible();
      await expect(
        monitoring.getByRole("button", {
          name: "Authorise one extra dispatch",
        }),
      ).toHaveCount(0);
      await expect(monitoring.getByLabel("Recovery audit history")).toHaveCount(
        0,
      );
      await organiser.close();
    },
  );
  assert.ok(key);
  return key;
}
