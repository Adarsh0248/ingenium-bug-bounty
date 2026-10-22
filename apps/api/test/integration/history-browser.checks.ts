import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import type { workbenchChecks } from "./workbench.checks.js";

export async function historyBrowserChecks(
  c: Parameters<typeof workbenchChecks>[1],
  fixture: {
    round: string;
    aa: string;
    previous: string;
    ownRun: string;
    official: string;
    draftBounty: string;
  },
  close: () => Promise<unknown>,
  finalise: () => Promise<unknown>,
) {
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (browser, origin, policy) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      await context.addCookies([
        {
          name: policy.names.participant,
          value: fixture.aa,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const page = await context.newPage(),
        errors: string[] = [],
        historyWrites: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().includes("/competition/") && r.method() !== "GET")
          historyWrites.push(r.url());
      });
      await c.budgets();
      await page.goto(origin);
      await expect(
        page.getByText("STATE VERIFIED", { exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await page
        .getByRole("button", { name: "Results and history", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Results & history" });
      await expect(
        dialog.getByRole("heading", { name: "Provisional results" }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "wallet", exact: true }).click();
      await expect(
        dialog.getByText("Round 1 carryover", { exact: true }),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Round 1", exact: true })
        .click();
      await expect(
        dialog.getByRole("heading", { name: "Final results" }),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "saved work", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Review saved work" })
        .first()
        .click();
      await expect(dialog.locator(".source-review")).toHaveText(
        "newer private draft",
      );
      await expect(dialog.getByRole("textbox")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Back to history" }).click();
      await dialog
        .getByRole("button", { name: "Review saved work" })
        .nth(1)
        .click();
      await expect(
        dialog.getByText("Synthetic protected hint 1", { exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByText("Synthetic protected hint 2", { exact: true }),
      ).toHaveCount(0);
      await dialog.getByRole("button", { name: "Back to history" }).click();
      await dialog
        .getByRole("button", { name: "attempts", exact: true })
        .click();
      await expect(dialog.locator(".history-row")).toHaveCount(50);
      await dialog.getByRole("button", { name: "Next history page" }).click();
      await expect(dialog.getByText("Page 2", { exact: true })).toBeVisible();
      await expect(dialog.locator(".history-row")).toHaveCount(1);
      await dialog
        .getByRole("button", { name: "Previous history page" })
        .click();
      await expect(dialog.locator(".history-row")).toHaveCount(50);
      await dialog
        .locator(".history-row")
        .filter({ hasText: "My sample run" })
        .first()
        .getByRole("button", { name: "View attempt" })
        .click();
      await expect(dialog.locator(".source-review")).toHaveText(
        "original private sample",
      );
      await expect(
        dialog.getByRole("heading", { name: "Sample 1 / passed", exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByText("teammate private sample", { exact: true }),
      ).toHaveCount(0);
      await dialog.getByRole("button", { name: "Back to history" }).click();
      await dialog
        .locator(".history-row")
        .filter({ hasText: "Team submission" })
        .getByRole("button", { name: "View attempt" })
        .click();
      await expect(dialog.locator(".source-review")).toHaveText(
        "team official source",
      );
      await expect(
        dialog.getByRole("heading", { name: /Sample 1/ }),
      ).toHaveCount(0);
      await dialog
        .getByRole("button", { name: "Round 2", exact: true })
        .click();
      await expect(
        dialog.getByRole("heading", { name: "Provisional results" }),
      ).toBeVisible();
      await close();
      await expect(
        dialog.getByRole("heading", {
          name: "Results finalising",
          exact: true,
        }),
      ).toBeVisible({ timeout: 12000 });
      await finalise();
      await expect(
        dialog.getByRole("heading", { name: "Final results", exact: true }),
      ).toBeVisible({ timeout: 12000 });
      const output = fileURLToPath(
        new URL("../../test-results/", import.meta.url),
      );
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/history-desktop.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await dialog.getByRole("button", { name: "wallet", exact: true }).click();
      await expect(
        dialog.getByText("Round 1 carryover", { exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: `${output}/history-mobile.png` });
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
      assert.equal(
        await dialog.evaluate((e) => e.scrollWidth > e.clientWidth + 1),
        false,
      );
      assert.deepEqual(historyWrites, []);
      assert.deepEqual(errors, []);
      await context.close();
    },
  );
}
