import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { Pool } from "pg";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { parseProof } from "../../src/access/credentials.js";
import { createStaffManagement } from "../../src/access/staff-management.js";

interface Context {
  owner: Pool;
  api: Pool;
  clock: ClockGuard;
  delivery: SessionDelivery;
  organiser: { sessionCookie: string };
  teams: { id: string; code: string; members: string[] }[];
  budgets(): Promise<void>;
  newRound(): Promise<{ round: string; aa: string }>;
  newStaff(
    role?: string,
  ): Promise<{ id: string; code: string; sessionCookie: string }>;
}
export async function staffAccessChecks(
  browser: Browser,
  origin: string,
  cookieName: string,
  c: Context,
) {
  const arena = await c.newRound(),
    root = await c.newStaff("SUPER_ADMIN"),
    contexts: BrowserContext[] = [],
    errors: string[] = [];
  const management = createStaffManagement(c.api, c.clock, c.delivery);
  async function context(cookie?: string) {
    const value = await browser.newContext({
      baseURL: origin,
      viewport: { width: 1440, height: 1000 },
    });
    contexts.push(value);
    if (cookie)
      await value.addCookies([
        {
          name: cookieName,
          value: cookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
    const page = await value.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await c.budgets();
    await page.goto(origin);
    if (!cookie) {
      await expect(
        page.getByLabel("Team or staff code", { exact: true }),
      ).toBeVisible({ timeout: 15000 });
      for (const audience of ["STAFF_RECOVERY", "STAFF_RECOVERY_ENTRY"]) {
        assert.equal(
          (
            await page.request.get(`/api/v1/bootstrap?audience=${audience}`)
          ).status(),
          401,
        );
      }
    }
    return page;
  }
  const page = await context(root.sessionCookie);
  async function finish(sensitive = true, code = root.code) {
    const dialog = page.getByRole("dialog", {
      name: "Confirm access change",
      exact: true,
    });
    if (sensitive) await dialog.getByLabel("Your staff code").fill(code);
    await c.budgets();
    await dialog
      .getByRole("button", { name: "Confirm access change", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  async function review(name = "Synthetic access administration") {
    await page.getByLabel("Access audit reason").fill(name);
    await page
      .getByRole("button", { name: "Review access change", exact: true })
      .click();
  }
  async function closeCode() {
    const modal = page.getByRole("dialog", {
      name: "New staff code",
      exact: true,
    });
    await expect(modal).toBeVisible();
    const code = await modal.getByLabel("Issued staff code").inputValue();
    assert.match(code, /^[A-Z2-7]{32}$/);
    await expect(modal.getByLabel("Issued staff code")).toHaveAttribute(
      "type",
      "password",
    );
    await page.evaluate(
      "Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Synthetic clipboard denial'); } } })",
    );
    await modal
      .getByRole("button", { name: "Copy staff code", exact: true })
      .click();
    await expect(modal.getByRole("status")).toContainText(
      "Clipboard unavailable",
    );
    await expect(modal.getByLabel("Issued staff code")).toHaveValue(code);
    await modal.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByLabel("Issued staff code")).toHaveCount(0);
    assert.ok(
      !(await page.evaluate<boolean>(
        `JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes(${JSON.stringify(code)})`,
      )),
    );
    return code;
  }
  async function cancel() {
    await page
      .getByRole("button", { name: "Cancel changes", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Discard access changes", exact: true })
      .click();
    await expect(page.locator(".staff-access-form")).toHaveCount(0);
  }
  async function replacement(member: string) {
    const next = await context();
    await next
      .getByLabel("Team or staff code", { exact: true })
      .fill(c.teams[0]!.code);
    await c.budgets();
    await next
      .getByRole("button", { name: "Enter arena", exact: true })
      .click();
    await next.getByRole("radio", { name: member, exact: true }).check();
    await next.getByLabel("Language", { exact: true }).selectOption("cpp");
    await c.budgets();
    await next
      .getByRole("button", { name: "Confirm and enter", exact: true })
      .click();
    await expect(
      next.getByRole("button", {
        name: "Request browser replacement",
        exact: true,
      }),
    ).toBeVisible();
    await c.budgets();
    await next
      .getByRole("button", { name: "Request browser replacement", exact: true })
      .click();
    await expect(
      next.getByRole("heading", {
        name: "Awaiting organiser approval",
        exact: true,
      }),
    ).toBeVisible();
    return next;
  }
  try {
    await expect(page.locator(".staff-header .connection")).toHaveText("Live", {
      timeout: 20000,
    });
    await page.getByRole("button", { name: "staff", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Staff access", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(`[data-staff-id="${root.id}"] .icon-button`),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Staff name", { exact: true }).fill("Support Delta");
    await review();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm access change", exact: true }),
    ).toBeDisabled();
    await finish(true, "A".repeat(32));
    await expect(page.locator(".staff-access [role=alert]")).toContainText(
      "Confirmation failed",
    );
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::integer n FROM staff_identities WHERE display_name='Support Delta'",
        )
      ).rows[0].n,
      0,
    );
    await review();
    await finish();
    const issued = await closeCode();
    const target = (
      await c.owner.query(
        "SELECT id FROM staff_identities WHERE display_name='Support Delta'",
      )
    ).rows[0].id as string;
    const row = page.locator(`[data-staff-id="${target}"]`);
    await expect(row).toContainText("organiser");
    const support = await context();
    await support
      .getByLabel("Team or staff code", { exact: true })
      .fill(issued);
    await c.budgets();
    await support
      .getByRole("button", { name: "Enter arena", exact: true })
      .click();
    await support
      .getByRole("button", { name: "Open control room", exact: true })
      .click();
    await expect(support.locator(".staff-header .connection")).toHaveText(
      "Live",
      { timeout: 15000 },
    );
    await expect(
      support.getByRole("button", { name: "staff", exact: true }),
    ).toHaveCount(0);
    assert.equal(
      (await support.request.get("/api/v1/staff/staff-identities")).status(),
      403,
    );

    await row
      .getByRole("button", { name: "Edit staff Support Delta", exact: true })
      .click();
    await page.getByLabel("Staff role", { exact: true }).selectOption("OWNER");
    await page.getByLabel("Enabled", { exact: true }).uncheck();
    await review();
    await finish();
    await expect(row).toContainText("Disabled");
    await expect(
      support.getByRole("heading", {
        name: "Session unavailable",
        exact: true,
      }),
    ).toBeVisible({ timeout: 20000 });
    await row
      .getByRole("button", { name: "Edit staff Support Delta", exact: true })
      .click();
    await page.getByLabel("Enabled", { exact: true }).check();
    await review();
    await finish();
    await expect(row).toContainText("Enabled");

    await row
      .getByRole("button", { name: "Edit staff Support Delta", exact: true })
      .click();
    await page
      .getByLabel("Staff name", { exact: true })
      .fill("Local draft remains");
    const state = (
      await c.owner.query("SELECT revision FROM staff_identities WHERE id=$1", [
        target,
      ])
    ).rows[0];
    await c.budgets();
    await management.command(root.sessionCookie, {
      action: "UPDATE",
      targetId: target,
      requestKey: randomUUID(),
      expectedRevision: state.revision,
      ownCode: root.code,
      reason: "Synthetic competing edit",
      displayName: "Remote reviewed name",
      role: "OWNER",
      enabled: true,
    });
    await review();
    await finish();
    await expect(page.locator(".staff-access [role=alert]")).toContainText(
      "stale version",
    );
    await expect(page.getByLabel("Staff name", { exact: true })).toHaveValue(
      "Local draft remains",
    );
    await cancel();
    await expect(row).toContainText("Remote reviewed name");

    let drop = true,
      writes = 0;
    await page.route("**/api/v1/staff/**", async (route) => {
      const request = route.request();
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/v1/staff/staff-identities"
      ) {
        writes++;
        if (drop) {
          const reply = await route.fetch();
          assert.equal(reply.status(), 200);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "{",
          });
          return;
        }
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "Add staff", exact: true }).click();
    await page.getByLabel("Staff name", { exact: true }).fill("Relay Ops");
    await review();
    await finish();
    await expect(
      page.getByText("Access command outcome unconfirmed.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    drop = false;
    await c.budgets();
    await page
      .getByRole("button", {
        name: "Check original access command",
        exact: true,
      })
      .click();
    await expect(page.locator(".staff-access [role=status]")).toContainText(
      "Code delivery unavailable",
    );
    assert.equal(writes, 1);
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::integer n FROM staff_identities WHERE display_name='Relay Ops'",
        )
      ).rows[0].n,
      1,
    );
    await expect(page.getByLabel("Issued staff code")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Rotate code for Relay Ops", exact: true })
      .click();
    await review();
    await finish();
    await closeCode();
    await page.screenshot({ path: "test-results/staff-access-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate<boolean>(
        "document.documentElement.scrollWidth <= innerWidth",
      ),
    );
    await page.screenshot({ path: "test-results/staff-access-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });

    const waiting = await replacement("First"),
      org = await context(c.organiser.sessionCookie);
    const reference = await waiting
      .locator(".replacement-reference dd")
      .first()
      .innerText();
    assert.match(reference, /^[a-f0-9-]{36}$/);
    await expect(org.locator(".staff-header .connection")).toHaveText("Live", {
      timeout: 15000,
    });
    await org.getByRole("button", { name: "access", exact: true }).click();
    await expect(
      org.getByRole("heading", { name: "Browser replacements", exact: true }),
    ).toBeVisible();
    let decisions = 0,
      loseDecision = true;
    await org.route(
      "**/api/v1/staff/replacements/*/decision",
      async (route) => {
        if (route.request().method() === "POST") {
          decisions++;
          if (loseDecision) {
            const reply = await route.fetch();
            assert.equal(reply.status(), 200);
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: "{",
            });
            return;
          }
        }
        await route.continue();
      },
    );
    await expect(org.locator(`[data-request-id="${reference}"]`)).toContainText(
      "First",
    );
    await org
      .locator(`[data-request-id="${reference}"]`)
      .getByRole("button", {
        name: "approve replacement for First",
        exact: true,
      })
      .click();
    await org
      .getByLabel("Access audit reason")
      .fill("Verified member and browser in person");
    await org
      .getByRole("button", { name: "Review access change", exact: true })
      .click();
    await expect(org.getByRole("dialog")).toContainText(reference);
    await expect(
      org.getByRole("dialog").getByLabel("Your staff code"),
    ).toHaveCount(0);
    await c.budgets();
    await org
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm access change", exact: true })
      .click();
    await expect(
      org.getByText("Access command outcome unconfirmed.", { exact: true }),
    ).toBeVisible();
    loseDecision = false;
    await c.budgets();
    await org
      .getByRole("button", {
        name: "Check original access command",
        exact: true,
      })
      .click();
    await expect(
      org.getByText("Access command outcome unconfirmed.", { exact: true }),
    ).toHaveCount(0);
    assert.equal(decisions, 1);
    assert.ok(
      (
        await c.owner.query(
          "SELECT revoked_at FROM participant_sessions WHERE id=$1",
          [parseProof(arena.aa)!.id],
        )
      ).rows[0].revoked_at,
    );
    await expect(
      waiting.getByRole("button", { name: "Restore arena", exact: true }),
    ).toBeVisible({ timeout: 12000 });
    await c.budgets();
    await waiting
      .getByRole("button", { name: "Restore arena", exact: true })
      .click();
    await expect(
      waiting.getByText("STATE VERIFIED", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    const participant = await waiting.request.get(
      "/api/v1/bootstrap?audience=PARTICIPANT",
    );
    assert.equal(participant.status(), 200);
    const originalLanguage = (
      await c.owner.query(
        "SELECT m.language FROM member_rounds m JOIN participant_sessions s ON s.member_round_id=m.id WHERE s.id=$1",
        [parseProof(arena.aa)!.id],
      )
    ).rows[0].language;
    assert.equal(
      (await participant.json()).data.session.language,
      originalLanguage,
    );
    assert.equal(
      (await waiting.request.get("/api/v1/staff/replacements")).status(),
      401,
    );

    const second = await replacement("Second");
    await c.budgets();
    await org
      .getByRole("button", {
        name: "Refresh browser replacements",
        exact: true,
      })
      .click();
    await org
      .getByRole("button", {
        name: "reject replacement for Second",
        exact: true,
      })
      .click();
    const activeBefore = (
      await c.owner.query(
        "SELECT s.id FROM participant_sessions s JOIN member_rounds m ON m.id=s.member_round_id WHERE m.member_id=$1 AND s.revoked_at IS NULL",
        [c.teams[0]!.members[1]],
      )
    ).rows.map((row) => row.id);
    assert.equal(activeBefore.length, 1);
    await org
      .getByLabel("Access audit reason")
      .fill("Synthetic rejection after identity review");
    await org
      .getByRole("button", { name: "Review access change", exact: true })
      .click();
    await c.budgets();
    await org
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm access change", exact: true })
      .click();
    await expect(org.locator(".staff-access [role=status]")).toContainText(
      "reject: applied",
    );
    assert.deepEqual(
      (
        await c.owner.query(
          "SELECT s.id FROM participant_sessions s JOIN member_rounds m ON m.id=s.member_round_id WHERE m.member_id=$1 AND s.revoked_at IS NULL",
          [c.teams[0]!.members[1]],
        )
      ).rows.map((row) => row.id),
      activeBefore,
    );
    await expect(
      second.getByRole("button", { name: "Restore arena", exact: true }),
    ).toHaveCount(0);
    assert.deepEqual(errors, []);
  } catch (error) {
    for (const [index, context] of contexts.entries()) {
      for (const current of context.pages()) {
        console.error(
          "Access test page",
          index,
          await current.locator("h1, .error").allTextContents(),
        );
        if ((await current.getByLabel("Issued staff code").count()) === 0)
          await current.screenshot({
            path: `test-results/staff-access-context-${index}.png`,
          });
      }
    }
    // Never capture a one-time code modal in a failure screenshot.
    if ((await page.getByLabel("Issued staff code").count()) === 0)
      await page.screenshot({ path: "test-results/staff-access-failure.png" });
    throw error;
  } finally {
    for (const context of contexts) await context.close();
  }
}
