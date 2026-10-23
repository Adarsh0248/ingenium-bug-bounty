import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import type { staffAuditChecks } from "./staff-audit.checks.js";
import { withBrowserApp } from "./browser-app.js";
import { createStaffManagement } from "../../src/access/staff-management.js";

export async function staffAuditBrowserChecks(
  c: Parameters<typeof staffAuditChecks>[1],
  fixture: { arena: string; teamOutcome: string },
) {
  const owner = await c.newStaff("OWNER"),
    admin = await c.newStaff("SUPER_ADMIN");
  await c.budgets();
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
        errors: string[] = [],
        methods = new Set<string>();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (request) => {
        if (request.url().includes("/api/v1/staff/audit?"))
          methods.add(request.method());
      });
      try {
        await page.goto(`${origin}/?arena=${fixture.arena}`);
        await page.getByRole("button", { name: "audit", exact: true }).click();
        const panel = page.getByLabel("Staff audit history"),
          category = panel.getByLabel("Audit category"),
          scope = panel.getByLabel("Audit arena scope");
        await expect(scope).toHaveValue("SELECTED");
        await expect(panel.locator("tbody tr").first()).toBeVisible();
        assert.equal(
          await category.locator('option[value="STAFF"]').count(),
          0,
        );
        await category.selectOption("TEAMS");
        const row = panel.locator(`[data-audit-id="${fixture.teamOutcome}"]`);
        await expect(row).toContainText(
          "<script>window.auditExecuted=true</script>",
        );
        await row.getByRole("button").click();
        const modal = page.getByRole("dialog", {
          name: "Audit record",
          exact: true,
        });
        await expect(modal).toContainText(fixture.teamOutcome);
        assert.ok(
          await modal.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        );
        assert.equal(await page.evaluate("window.auditExecuted"), undefined);
        assert.equal(await modal.locator("script,img").count(), 0);
        const output = fileURLToPath(
          new URL("../../test-results/", import.meta.url),
        );
        await mkdir(output, { recursive: true });
        await page.screenshot({
          path: `${output}/staff-audit-desktop.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await modal.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        );
        assert.ok(
          await page.evaluate(
            "document.documentElement.scrollWidth <= innerWidth + 1",
          ),
        );
        await page.screenshot({
          path: `${output}/staff-audit-mobile.png`,
          fullPage: true,
        });
        await modal
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await page.setViewportSize({ width: 1440, height: 1000 });
        await category.selectOption("CONTENT_READS");
        await expect(panel.locator("tbody tr")).toHaveCount(40);
        const firstIds = await panel
          .locator("tbody tr")
          .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-audit-id")),
          );
        await panel
          .getByRole("button", { name: "Next audit page", exact: true })
          .click();
        await expect(panel.getByText("Page 2", { exact: true })).toBeVisible();
        await expect(panel.locator("tbody tr")).not.toHaveCount(40);
        const secondIds = await panel
          .locator("tbody tr")
          .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-audit-id")),
          );
        assert.ok(secondIds.length > 0);
        assert.equal(
          firstIds.some((id) => secondIds.includes(id)),
          false,
        );
        await panel
          .getByRole("button", { name: "Previous audit page", exact: true })
          .click();
        await expect(panel.locator("tbody tr")).toHaveCount(40);
        let deliver!: () => void, arrived!: () => void;
        const held = new Promise<void>((resolve) => {
            deliver = resolve;
          }),
          reached = new Promise<void>((resolve) => {
            arrived = resolve;
          });
        await page.route(
          "**/api/v1/staff/audit?family=TEAMS",
          async (route) => {
            const response = await route.fetch();
            assert.equal(response.status(), 200);
            arrived();
            await held;
            await route.fulfill({ response });
          },
        );
        await category.selectOption("TEAMS");
        await reached;
        try {
          await category.selectOption("CONTENT");
          await expect(panel.locator("tbody tr").first()).toBeVisible();
        } finally {
          deliver();
        }
        await expect(category).toHaveValue("CONTENT");
        await expect(
          panel.locator(`[data-audit-id="${fixture.teamOutcome}"]`),
        ).toHaveCount(0);
        await page.unroute("**/api/v1/staff/audit?family=TEAMS");
        await category.selectOption("ROUND");
        await scope.selectOption("ALL");
        await expect(panel.locator("tbody tr").first()).toBeVisible();
        await scope.selectOption("SELECTED");
        await panel.locator("tbody tr").first().getByRole("button").click();
        await expect(modal).toContainText(fixture.arena);
        await modal
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        let fail = true;
        await page.route("**/api/v1/staff/audit?**", async (route) => {
          if (fail)
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
          else await route.continue();
        });
        await panel
          .getByRole("button", { name: "Refresh audit history", exact: true })
          .click();
        await expect(panel.getByRole("alert")).toBeVisible();
        await expect(panel.locator("tbody tr")).toHaveCount(0);
        fail = false;
        await panel
          .getByRole("button", { name: "Refresh audit history", exact: true })
          .click();
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect(panel.locator("tbody tr").first()).toBeVisible();
        await page.unroute("**/api/v1/staff/audit?**");
        await page.route("**/api/v1/staff/audit?**", async (route) => {
          const response = await route.fetch(),
            body = await response.json();
          body.data.family = "CONTENT";
          await route.fulfill({ response, body: JSON.stringify(body) });
        });
        await panel
          .getByRole("button", { name: "Refresh audit history", exact: true })
          .click();
        await expect(panel.getByRole("alert")).toBeVisible();
        await expect(panel.locator("tbody tr")).toHaveCount(0);
        await page.unroute("**/api/v1/staff/audit?**");
        await panel
          .getByRole("button", { name: "Refresh audit history", exact: true })
          .click();
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect(panel.locator("tbody tr").first()).toBeVisible();
        const identity = (
          await c.owner.query("SELECT * FROM staff_identities WHERE id=$1", [
            owner.id,
          ])
        ).rows[0];
        await c.budgets();
        await createStaffManagement(c.api, c.clock, c.delivery).command(
          admin.sessionCookie,
          {
            action: "UPDATE",
            targetId: owner.id,
            requestKey: randomUUID(),
            expectedRevision: identity.revision,
            ownCode: admin.code,
            displayName: identity.display_name,
            role: "ORGANISER",
            enabled: true,
            reason: "Synthetic audit browser revocation",
          },
        );
        await panel
          .getByRole("button", { name: "Refresh audit history", exact: true })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Session unavailable",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator(".staff-audit")).toHaveCount(0);
        assert.deepEqual([...methods], ["GET"]);
        assert.deepEqual(errors, []);
        const superContext = await browser.newContext();
        try {
          await superContext.addCookies([
            {
              name: policy.names.staff,
              value: admin.sessionCookie,
              url: origin,
              httpOnly: true,
              sameSite: "Strict",
            },
          ]);
          const superPage = await superContext.newPage();
          await superPage.goto(origin);
          await superPage
            .getByRole("button", { name: "audit", exact: true })
            .click();
          await superPage.getByLabel("Audit category").selectOption("STAFF");
          await expect(
            superPage.locator(".staff-audit tbody tr").first(),
          ).toBeVisible();
        } finally {
          await superContext.close();
        }
        const org = await browser.newContext();
        try {
          await org.addCookies([
            {
              name: policy.names.staff,
              value: c.organiser.sessionCookie,
              url: origin,
              httpOnly: true,
              sameSite: "Strict",
            },
          ]);
          const orgPage = await org.newPage();
          await orgPage.goto(origin);
          await expect(
            orgPage.getByRole("button", { name: "monitor", exact: true }),
          ).toBeVisible();
          assert.equal(
            await orgPage
              .getByRole("button", { name: "audit", exact: true })
              .count(),
            0,
          );
          assert.equal(
            (
              await orgPage.request.get(
                `${origin}/api/v1/staff/audit?family=ROUND`,
              )
            ).status(),
            403,
          );
        } finally {
          await org.close();
        }
      } finally {
        await context.close();
      }
    },
  );
}
