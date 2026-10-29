import { openStaffView } from "./browser-app.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import { createStaffManagement } from "../../src/access/staff-management.js";
import type { validationDiagnosticChecks } from "./validation-diagnostic.checks.js";

export async function validationDiagnosticBrowserChecks(
  c: Parameters<typeof validationDiagnosticChecks>[1] & {
    budgets(): Promise<void>;
    attempt: string;
  },
) {
  const actor = await c.person();
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery },
    async (browser, origin, policy) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
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
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        await c.budgets();
        await page.goto(origin);
        await openStaffView(page, "Questions");
        await page
          .locator(`[data-version-id="${c.version}"]`)
          .getByRole("button")
          .click();
        await page
          .getByRole("navigation", { name: "Bug sections" })
          .getByRole("button", { name: "Validation", exact: true })
          .click();
        await page
          .locator(`[data-run-id="${c.run}"]`)
          .getByRole("button", { name: "Open run", exact: true })
          .click();
        const panel = page.getByLabel("Private validation diagnostics"),
          modal = page.getByRole("dialog", {
            name: "Private validation diagnostic review",
            exact: true,
          });
        async function begin() {
          await panel
            .getByRole("button", {
              name: "Review validation output",
              exact: true,
            })
            .click();
          await modal
            .getByLabel("Validation diagnostic dispatch")
            .selectOption(c.attempt);
          await modal
            .getByLabel("Diagnostic review reason")
            .fill("Synthetic browser diagnostic investigation");
          const open = modal.getByRole("button", {
            name: "Open validation diagnostics",
            exact: true,
          });
          await expect(open).toBeDisabled();
          await modal.getByLabel("Diagnostic run confirmation").fill(c.run);
          return open;
        }
        const path = `**/api/v1/staff/content/validation-runs/${c.run}/diagnostics`;
        let posts = 0,
          key = "";
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
        const open = await begin();
        await open.click();
        await expect(modal.getByRole("alert")).toContainText(
          "Connection interrupted",
        );
        await expect(open).toBeDisabled();
        await expect(
          page.getByRole("button", { name: "Library", exact: true }),
        ).toBeDisabled();
        await modal
          .getByRole("button", {
            name: "Check original diagnostics",
            exact: true,
          })
          .click();
        await expect(modal).toHaveCount(0);
        await expect(
          panel.getByLabel("Validation compiler output"),
        ).toContainText("Synthetic private compiler diagnostic");
        await expect(panel.getByLabel("Validation stderr")).toContainText(
          "<script>window.diagnosticExecuted=true</script>",
        );
        await expect(panel).toContainText("Validation stdout (truncated)");
        assert.equal(posts, 1);
        assert.equal(
          (
            await c.owner.query(
              "SELECT count(*)::int n FROM validation_diagnostic_audits WHERE request_key=$1",
              [key],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          await page.evaluate("window.diagnosticExecuted"),
          undefined,
        );
        assert.equal(await panel.locator("script,img").count(), 0);
        const output = fileURLToPath(
          new URL("../../test-results/", import.meta.url),
        );
        await mkdir(output, { recursive: true });
        await page.screenshot({
          path: `${output}/validation-diagnostics-desktop.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await panel.getByLabel("Validation stderr").scrollIntoViewIfNeeded();
        assert.ok(
          await page.evaluate(
            "document.documentElement.scrollWidth <= innerWidth + 1",
          ),
        );
        await page.screenshot({
          path: `${output}/validation-diagnostics-mobile.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        const reportPath = `**/api/v1/staff/content/validation-runs/${c.run}`;
        let failReport = true;
        await page.route(reportPath, async (route) => {
          if (failReport) {
            failReport = false;
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                schema_version: 1,
                trace_id: randomUUID(),
                error: {
                  code: "SECURITY_UNAVAILABLE",
                  outcome: "NOT_PROCESSED",
                },
              }),
            });
          } else await route.continue();
        });
        await page
          .getByRole("button", {
            name: "Refresh validation report",
            exact: true,
          })
          .click();
        await expect(panel.locator(".private-review-payload")).toHaveCount(0);
        await expect(
          panel.getByRole("button", {
            name: "Review validation output",
            exact: true,
          }),
        ).toBeEnabled({ timeout: 10000 });
        await expect(panel.locator(".private-review-payload")).toHaveCount(0);
        await page.unroute(reportPath);
        await page.unroute(path);
        const reopened = await begin();
        await reopened.click();
        await expect(panel.locator(".private-review-payload")).toBeVisible();
        let fail = true;
        await page.route(path, async (route) => {
          if (route.request().method() === "GET" && fail) {
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: { code: "SECURITY_UNAVAILABLE" } }),
            });
          } else await route.continue();
        });
        await panel
          .getByRole("button", {
            name: "Refresh diagnostic access history",
            exact: true,
          })
          .click();
        await expect(panel.locator(".private-review-payload")).toHaveCount(0);
        fail = false;
        await panel
          .getByRole("button", {
            name: "Refresh diagnostic access history",
            exact: true,
          })
          .click();
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect(panel.locator(".private-review-payload")).toHaveCount(0);
        await page.unroute(path);
        let deliver!: () => void, arrived!: () => void;
        const held = new Promise<void>((resolve) => {
            deliver = resolve;
          }),
          reached = new Promise<void>((resolve) => {
            arrived = resolve;
          });
        fail = false;
        await page.route(path, async (route) => {
          if (route.request().method() === "POST") {
            const response = await route.fetch();
            assert.equal(response.status(), 200);
            arrived();
            await held;
            await route.fulfill({ response });
          } else if (fail) {
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: { code: "SECURITY_UNAVAILABLE" } }),
            });
          } else await route.continue();
        });
        await c.budgets();
        const heldOpen = await begin();
        await heldOpen.click();
        await reached;
        try {
          fail = true;
          await expect(panel.getByRole("alert")).toBeVisible({
            timeout: 10000,
          });
          fail = false;
        } finally {
          deliver();
        }
        await expect(modal.getByRole("alert")).toContainText(
          "Access changed while diagnostics were loading",
        );
        await expect(panel.locator(".private-review-payload")).toHaveCount(0);
        await modal
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await expect(panel.getByRole("alert")).toHaveCount(1, {
          timeout: 10000,
        });
        await expect(panel.getByRole("alert")).toContainText(
          "Access changed while diagnostics were loading",
        );
        await expect(panel.locator(".private-review-payload")).toHaveCount(0);
        await page.unroute(path);
        await c.budgets();
        const fresh = await begin();
        await fresh.click();
        await expect(panel.locator(".private-review-payload")).toBeVisible();
        const admin = await c.person("SUPER_ADMIN"),
          identity = (
            await c.owner.query("SELECT * FROM staff_identities WHERE id=$1", [
              actor.id,
            ])
          ).rows[0];
        await createStaffManagement(c.api, c.clock, c.delivery).command(
          admin.sessionCookie,
          {
            action: "UPDATE",
            targetId: actor.id,
            requestKey: randomUUID(),
            expectedRevision: identity.revision,
            ownCode: admin.code,
            reason: "Synthetic browser diagnostic access removal",
            displayName: identity.display_name,
            role: "ORGANISER",
            enabled: true,
          },
        );
        await panel
          .getByRole("button", {
            name: "Refresh diagnostic access history",
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Session unavailable",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator(".private-review-payload")).toHaveCount(0);
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    },
  );
}
