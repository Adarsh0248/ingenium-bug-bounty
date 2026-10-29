import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Pool } from "pg";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { createTeamManagement } from "../../src/access/team-management.js";

interface Context {
  owner: Pool;
  api: Pool;
  clock: ClockGuard;
  delivery: SessionDelivery;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string };
  budgets(): Promise<void>;
}
export async function staffTeamsChecks(
  browser: Browser,
  origin: string,
  cookieName: string,
  c: Context,
) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    errors: string[] = [],
    service = createTeamManagement(c.api, c.clock, c.delivery);
  await context.addCookies([
    {
      name: cookieName,
      value: c.staff.sessionCookie,
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const form = () => page.locator(".staff-access-form"),
    dialog = () => page.getByRole("dialog"),
    title = "Synthetic browser registered team";
  async function review(code = c.staff.code) {
    await form()
      .getByLabel("Registration audit reason")
      .fill("Synthetic browser registration approval");
    await form()
      .getByRole("button", { name: "Review team change", exact: true })
      .click();
    await dialog().getByLabel("Your staff code").fill(code);
    await c.budgets();
    await dialog()
      .getByRole("button", { name: "Confirm team change", exact: true })
      .click();
  }
  async function create(name = title) {
    await page
      .getByRole("button", { name: "Register team", exact: true })
      .click();
    await form().getByLabel("Team name", { exact: true }).fill(name);
    await form().getByLabel("Member 1 name").fill("Synthetic member one");
    await form().getByLabel("Member 2 name").fill("Synthetic member two");
  }
  async function find(id: string) {
    for (let i = 0; i < 21; i++) {
      const row = page.locator(`[data-team-id="${id}"]`);
      if (await row.count()) return row;
      const next = page.getByRole("button", {
        name: "Next team page",
        exact: true,
      });
      if (await next.isDisabled()) break;
      const response = page.waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          r.url().includes("/api/v1/staff/teams?after="),
      );
      await next.click();
      await response;
      await expect(
        page.getByRole("button", { name: "Refresh teams", exact: true }),
      ).toBeEnabled();
    }
    throw Error("Synthetic registered team not in bounded pages");
  }
  try {
    await c.budgets();
    await page.goto(origin);
    await page.getByRole("button", { name: "teams", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Team registrations", exact: true }),
    ).toBeVisible();
    await create();
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    await review("A".repeat(32));
    await expect(page.getByRole("alert")).toContainText("Confirmation failed");
    await expect(form().getByLabel("Team name", { exact: true })).toHaveValue(
      title,
    );
    const created = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/staff/teams" &&
        r.request().method() === "POST",
    );
    await review();
    const result = (await (await created).json()).data;
    await expect(dialog()).toHaveAccessibleName("New team code");
    const code = dialog().getByLabel("Issued team code");
    await expect(code).toHaveAttribute("type", "password");
    await dialog()
      .getByRole("button", { name: "Reveal team code", exact: true })
      .click();
    await expect(code).toHaveAttribute("type", "text");
    assert.match(await code.inputValue(), /^[A-Z2-7]{8}$/);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(
      "navigator.clipboard.writeText = () => Promise.reject(new Error('synthetic denied clipboard'))",
    );
    await dialog()
      .getByRole("button", { name: "Copy team code", exact: true })
      .click();
    await expect(dialog().getByRole("status")).toContainText(
      "Clipboard unavailable",
    );
    await dialog().getByRole("button", { name: "Done", exact: true }).click();
    const id = result.outcome.result_team_id;
    await find(id);
    await page.screenshot({
      path: "test-results/teams-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          "document.documentElement.scrollWidth <= window.innerWidth",
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: "test-results/teams-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", {
        name: `Rotate team code for ${title}`,
        exact: true,
      })
      .click();
    await review();
    await expect(dialog()).toHaveAccessibleName("New team code");
    const rotated = await dialog().getByLabel("Issued team code").inputValue();
    assert.notEqual(rotated, result.issued_code);
    await dialog().getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(
      (
        await c.owner.query(
          "SELECT version FROM access_credentials WHERE team_id=$1 AND revoked_at IS NULL",
          [id],
        )
      ).rows[0].version,
      "2",
    );
    await create("Synthetic stale browser team");
    await c.budgets();
    const revision = (await service.list(c.staff.sessionCookie))
      .control_revision;
    await service.command(c.staff.sessionCookie, {
      action: "CREATE",
      targetId: null,
      requestKey: randomUUID(),
      expectedRevision: revision,
      ownCode: c.staff.code,
      teamName: "Concurrent synthetic team",
      memberOne: "One",
      memberTwo: "Two",
      reason: "Synthetic stale edit",
    });
    await review();
    await expect(page.getByRole("alert")).toContainText(/stale version/i);
    await expect(form().getByLabel("Team name", { exact: true })).toHaveValue(
      "Synthetic stale browser team",
    );
    await form()
      .getByRole("button", {
        name: "Use latest registration state",
        exact: true,
      })
      .click();
    let posts = 0;
    await page.route("**/api/v1/staff/teams", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      await route.fetch();
      await route.abort("failed");
    });
    await review();
    await expect(
      page.getByRole("button", {
        name: "Check original team command",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    await c.budgets();
    await page
      .getByRole("button", { name: "Check original team command", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Code delivery unavailable" }),
    ).toBeVisible();
    assert.equal(posts, 1);
    await expect(dialog()).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeEnabled();
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::int AS n FROM teams WHERE display_name='Synthetic stale browser team'",
        )
      ).rows[0].n,
      1,
    );
    await page.unroute("**/api/v1/staff/teams");
    await create("Discarded synthetic team");
    await form()
      .getByRole("button", { name: "Cancel registration change", exact: true })
      .click();
    await dialog()
      .getByRole("button", {
        name: "Discard registration changes",
        exact: true,
      })
      .click();
    await expect(form()).toHaveCount(0);
    await c.budgets();
    await page.getByRole("button", { name: "setup", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.reload();
    await c.budgets();
    await page.getByRole("button", { name: "teams", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Team registrations", exact: true }),
    ).toBeVisible();
    await expect(dialog()).not.toBeVisible();
    assert.equal(
      await page.evaluate(
        "Object.keys(localStorage).length + Object.keys(sessionStorage).length",
      ),
      0,
    );
    const organiser = await browser.newContext();
    try {
      await organiser.addCookies([
        {
          name: cookieName,
          value: c.organiser.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const p = await organiser.newPage();
      await c.budgets();
      await p.goto(origin);
      await expect(
        p.getByRole("navigation", { name: "Control room views" }),
      ).toBeVisible();
      await expect(
        p.getByRole("button", { name: "teams", exact: true }),
      ).toHaveCount(0);
      assert.equal(
        (await p.request.get(`${origin}/api/v1/staff/teams`)).status(),
        403,
      );
    } finally {
      await organiser.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
