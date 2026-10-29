import { supplyLegacyStaffCode } from "./browser-app.js";
import { fillStaffNote } from "./browser-app.js";
import { openStaffView } from "./browser-app.js";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import type { teamAccessChecks } from "./team-access.checks.js";

export async function teamAccessBrowserChecks(
  c: Parameters<typeof teamAccessChecks>[1],
) {
  const a = await c.newRound(),
    team = c.teams[0]!,
    errors: string[] = [];
  await c.budgets();
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (browser, origin, policy) => {
      const contexts = [];
      try {
        const pages = [];
        for (const [i, cookie] of [
          c.staff.sessionCookie,
          a.aa,
          a.ab,
          a.ba,
        ].entries()) {
          const context = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
          });
          contexts.push(context);
          await context.addCookies([
            {
              name: i === 0 ? policy.names.staff : policy.names.participant,
              value: cookie,
              url: origin,
              httpOnly: true,
              sameSite: "Strict",
            },
          ]);
          const page = await context.newPage();
          pages.push(page);
          page.on("pageerror", (e) => errors.push(e.message));
          await page.goto(origin);
          if (i > 0)
            await expect(
              page.getByText("STATE VERIFIED", { exact: true }),
            ).toBeVisible({ timeout: 15000 });
        }
        const [operator, one, two, other] = pages as [
          (typeof pages)[number],
          (typeof pages)[number],
          (typeof pages)[number],
          (typeof pages)[number],
        ];
        await openStaffView(operator, "Teams");
        const panel = operator.locator(".staff-teams"),
          find = panel.getByLabel("Find team", { exact: true });
        async function search(term: string) {
          await expect(find).toBeEnabled();
          await find.fill(term);
          const response = operator.waitForResponse(
            (r) =>
              r.request().method() === "GET" &&
              new URL(r.url()).pathname === "/api/v1/staff/teams" &&
              (new URL(r.url()).searchParams.get("search") ?? "") ===
                term.trim(),
          );
          await panel
            .getByRole("button", { name: "Search teams", exact: true })
            .click();
          await response;
          await expect(
            panel.getByRole("button", { name: "Refresh teams", exact: true }),
          ).toBeEnabled();
        }
        await search("POOL-");
        await expect(panel.locator("tbody tr")).toHaveCount(50);
        await panel
          .getByRole("button", { name: "Next team page", exact: true })
          .click();
        await expect(panel.locator("tbody tr")).toHaveCount(7);
        await search("Precise Person");
        await expect(panel.locator("tbody tr")).toHaveCount(1);
        await expect(panel).toContainText("Page 1");
        await expect(panel).toContainText("Literal%_name");
        await search("No matching registration");
        await expect(panel.locator("tbody tr")).toHaveCount(0);
        await search("competition");
        const row = panel.locator(`[data-team-id="${team.id}"]`);
        await expect(row).toBeVisible();
        let posts = 0;
        const revokePath = `/api/v1/staff/teams/${team.id}/revoke-code`;
        await operator.route(`**${revokePath}`, async (route) => {
          posts++;
          const response = await route.fetch();
          assert.equal(response.status(), 200);
          assert.equal((await response.json()).data.issued_code, null);
          await route.abort("failed");
        });
        await row.getByRole("button", { name: /^Revoke team code/ }).click();
        const form = panel.locator(".staff-access-form");
        await fillStaffNote(form, "Registration note", "Synthetic browser access revocation");
        await form
          .getByRole("button", { name: "Review team change", exact: true })
          .click();
        const dialog = operator.getByRole("dialog", {
          name: "Confirm team change",
          exact: true,
        });
        await expect(dialog).toContainText(
          "No replacement code will be issued",
        );
        const output = fileURLToPath(
          new URL("../../test-results/", import.meta.url),
        );
        await mkdir(output, { recursive: true });
        await operator.screenshot({
          path: `${output}/team-revocation-desktop.png`,
          fullPage: true,
        });
        await operator.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        );
        await operator.screenshot({
          path: `${output}/team-revocation-mobile.png`,
          fullPage: true,
        });
        await supplyLegacyStaffCode(dialog, c.staff.code);
        await c.budgets();
        await dialog
          .getByRole("button", { name: "Confirm team change", exact: true })
          .click();
        await expect(
          panel.getByRole("button", {
            name: "Check original team command",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          operator.getByRole("button", { name: "Live overview", exact: true }),
        ).toBeDisabled();
        await panel
          .getByRole("button", {
            name: "Check original team command",
            exact: true,
          })
          .click();
        await expect(panel.getByRole("status").filter({ hasText: "No replacement code was issued" })).toContainText(
          "No replacement code was issued",
        );
        assert.equal(posts, 1);
        await expect(row).toContainText("No active code");
        await expect(
          row.getByRole("button", { name: /^Revoke team code/ }),
        ).toBeDisabled();
        for (const page of [one, two])
          await expect(
            page.getByRole("heading", {
              name: "Session unavailable",
              exact: true,
            }),
          ).toBeVisible({ timeout: 15000 });
        await expect(
          other.getByText("STATE VERIFIED", { exact: true }),
        ).toBeVisible();
        await row.getByRole("button", { name: /^Issue team code/ }).click();
        await fillStaffNote(form, "Registration note", "Synthetic deliberate new code issuance");
        await form
          .getByRole("button", { name: "Review team change", exact: true })
          .click();
        await supplyLegacyStaffCode(dialog, c.staff.code);
        const issuedReply = operator.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
              `/api/v1/staff/teams/${team.id}/issue-code` &&
            r.request().method() === "POST",
        );
        await c.budgets();
        await dialog
          .getByRole("button", { name: "Confirm team change", exact: true })
          .click();
        team.code = (await (await issuedReply).json()).data.issued_code;
        assert.match(team.code, /^[A-Z2-7]{8}$/);
        const issued = operator.getByRole("dialog", {
          name: "New team code",
          exact: true,
        });
        await expect(issued.getByLabel("Issued team code")).toHaveAttribute(
          "type",
          "password",
        );
        await issued.getByRole("button", { name: "Done", exact: true }).click();
        await expect(
          row.getByRole("button", { name: /^Rotate team code/ }),
        ).toBeEnabled();
        await expect(
          one.getByRole("heading", {
            name: "Session unavailable",
            exact: true,
          }),
        ).toBeVisible();
        await panel
          .getByRole("button", { name: "Clear team search", exact: true })
          .click();
        await expect(find).toHaveValue("");
        await expect(panel.locator("tbody tr")).toHaveCount(50);
        assert.ok(
          await operator.evaluate(
            "document.documentElement.scrollWidth<=innerWidth+1",
          ),
        );
        await operator.screenshot({
          path: `${output}/team-search-mobile.png`,
          fullPage: true,
        });
        assert.deepEqual(errors, []);
      } finally {
        for (const context of contexts) await context.close();
      }
    },
  );
}
