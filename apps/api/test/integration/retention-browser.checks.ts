import { openStaffView } from "./browser-app.js";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import { createStaffService } from "../../src/access/staff-service.js";
import type { retentionChecks } from "./retention.checks.js";

export async function retentionBrowserChecks(
  c: Parameters<typeof retentionChecks>[1],
  actor: { sessionCookie: string },
) {
  await c.budgets();
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (browser, origin, policy) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      try {
        await context.addCookies([
          {
            name: policy.names.staff,
            value: actor.sessionCookie,
            url: origin,
            httpOnly: true,
            sameSite: "Strict",
          },
        ]);
        const page = await context.newPage(),
          errors: string[] = [],
          writes: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (r) => {
          if (r.method() === "POST" && r.url().includes("/maintenance/"))
            writes.push(r.url());
        });
        await page.goto(origin);
        await openStaffView(page, "System health");
        const panel = page.getByLabel("Data maintenance"),
          refresh = panel.getByRole("button", {
            name: "Refresh maintenance status",
            exact: true,
          }),
          path = "**/api/v1/staff/maintenance/retention";
        await expect(
          panel.getByText("Recently completed", { exact: true }),
        ).toHaveCount(2, { timeout: 15000 });
        assert.equal(await panel.getByRole("button").count(), 1);
        await page.route(path, (route) => route.abort("failed"));
        await refresh.click();
        await expect(panel.getByRole("alert")).toBeVisible();
        await expect(
          panel.getByText("Recently completed", { exact: true }),
        ).toHaveCount(0);
        await page.unroute(path);
        await refresh.click();
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect(
          panel.getByText("Recently completed", { exact: true }),
        ).toHaveCount(2);
        const output = fileURLToPath(
          new URL("../../test-results/", import.meta.url),
        );
        await mkdir(output, { recursive: true });
        await page.screenshot({
          path: `${output}/retention-desktop.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await panel.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        );
        await page.screenshot({
          path: `${output}/retention-mobile.png`,
          fullPage: true,
        });
        await c.budgets();
        await createStaffService(c.api, c.clock, c.delivery).logout(
          actor.sessionCookie,
        );
        // Live revocation may already have removed the panel; never click a stale control.
        await expect(
          page.getByRole("heading", {
            name: "Session unavailable",
            exact: true,
          }),
        ).toBeVisible({ timeout: 15000 });
        assert.deepEqual(errors, []);
        assert.deepEqual(writes, []);
      } finally {
        await context.close();
      }
    },
  );
}
