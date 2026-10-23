import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import type { resultsExportChecks } from "./results-export.checks.js";
import type { FinalResults } from "../../src/competition/results.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { withBrowserApp } from "./browser-app.js";

export async function resultsExportBrowserChecks(
  c: Parameters<typeof resultsExportChecks>[1],
  f: {
    actor: { sessionCookie: string };
    first: string;
    final: FinalResults;
  },
) {
  await c.budgets();
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (browser, origin, policy) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      });
      try {
        await context.addCookies([
          {
            name: policy.names.staff,
            value: f.actor.sessionCookie,
            url: origin,
            httpOnly: true,
            sameSite: "Strict",
          },
        ]);
        const page = await context.newPage(),
          errors: string[] = [],
          downloaded: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("download", (d) => downloaded.push(d.suggestedFilename()));
        await page.goto(`${origin}/?arena=${f.final.arena_id}`);
        const panel = page.getByLabel("Final results export"),
          button = panel.getByRole("button", {
            name: "Download final results",
            exact: true,
          }),
          format = panel.getByLabel("Results file format", { exact: true }),
          path = `/api/v1/staff/competition/rounds/${f.final.round_id}/results`;
        await expect(button).toBeEnabled({ timeout: 15000 });
        await expect(
          page.getByRole("heading", { name: "Final standings", exact: true }),
        ).toBeVisible();
        async function file(type: "csv" | "json", round: string) {
          await format.selectOption(type);
          await c.budgets();
          const wait = page.waitForEvent("download");
          await button.click();
          const download = await wait,
            at = await download.path();
          assert.ok(at);
          assert.ok(download.suggestedFilename().endsWith(`.${type}`));
          const text = await readFile(at, "utf8");
          if (type === "json") assert.equal(JSON.parse(text).round_id, round);
          else assert.ok(text.includes(`"${round}"`));
          await expect(button).toBeEnabled();
          return text;
        }
        assert.deepEqual(
          JSON.parse(await file("json", f.final.round_id)),
          f.final,
        );
        assert.ok(
          (await file("csv", f.final.round_id)).includes('"NOT_APPLICABLE"'),
        );
        await page.getByRole("button", { name: /^Round 1/ }).click();
        await expect(button).toBeEnabled();
        assert.equal(
          JSON.parse(await file("json", f.first)).qualification_status,
          "LOCKED",
        );
        await page.getByRole("button", { name: /^Round 2/ }).click();
        await expect(button).toBeEnabled();
        let release!: () => void, arrived!: () => void, finished!: () => void;
        const held = new Promise<void>((r) => {
            release = r;
          }),
          reached = new Promise<void>((r) => {
            arrived = r;
          }),
          delivered = new Promise<void>((r) => {
            finished = r;
          });
        await page.route(`**${path}`, async (route) => {
          const response = await route.fetch();
          assert.equal(response.status(), 200);
          arrived();
          await held;
          try {
            await route.fulfill({ response });
          } finally {
            finished();
          }
        });
        await button.click();
        await reached;
        await expect(panel.getByRole("status")).toHaveText(
          "Fetching results...",
        );
        const count = downloaded.length;
        try {
          await page.getByRole("button", { name: /^Round 1/ }).click();
          await expect(button).toBeEnabled();
        } finally {
          release();
        }
        await delivered;
        await page.unroute(`**${path}`);
        await page.waitForTimeout(200);
        assert.equal(downloaded.length, count);
        await page.getByRole("button", { name: /^Round 2/ }).click();
        await expect(button).toBeEnabled();
        await page.route(`**${path}`, (route) => route.abort("failed"));
        await button.click();
        await expect(panel.getByRole("alert")).toBeVisible();
        assert.equal(downloaded.length, count);
        await page.unroute(`**${path}`);
        await file("json", f.final.round_id);
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await page.route(`**${path}`, async (route) => {
          const response = await route.fetch(),
            body = await response.json();
          body.data.round_id = f.first;
          await route.fulfill({ response, body: JSON.stringify(body) });
        });
        await button.click();
        await expect(panel.getByRole("alert")).toBeVisible();
        assert.equal(downloaded.length, count + 1);
        await page.unroute(`**${path}`);
        await file("json", f.final.round_id);
        const output = fileURLToPath(
          new URL("../../test-results/", import.meta.url),
        );
        await mkdir(output, { recursive: true });
        await page.screenshot({
          path: `${output}/results-export-desktop.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await panel.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        );
        await page.screenshot({
          path: `${output}/results-export-mobile.png`,
          fullPage: true,
        });
        await c.budgets();
        await createStaffService(c.api, c.clock, c.delivery).logout(
          f.actor.sessionCookie,
        );
        // Current-authority live delivery may remove the export panel before another click.
        await expect(
          page.getByRole("heading", {
            name: "Session unavailable",
            exact: true,
          }),
        ).toBeVisible({ timeout: 15000 });
        assert.equal(downloaded.length, count + 2);
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    },
  );
}
