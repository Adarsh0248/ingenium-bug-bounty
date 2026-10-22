import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Pool } from "pg";
import type { createCompetitionService } from "../../src/competition/service.js";
interface Context {
  owner: Pool;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string };
  budgets(): Promise<void>;
  service: ReturnType<typeof createCompetitionService>;
  newRound(): Promise<{ round: string; aa: string; x: string }>;
}
export async function cancellationBrowserChecks(
  browser: Browser,
  origin: string,
  cookieNames: { staff: string; participant: string },
  c: Context,
) {
  const a = await c.newRound(),
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    participant = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    errors: string[] = [];
  await context.addCookies([
    {
      name: cookieNames.staff,
      value: c.staff.sessionCookie,
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const page = await context.newPage(),
    dialog = page.getByRole("dialog"),
    section = page.locator(".staff-incidents");
  page.on("pageerror", (e) => errors.push(e.message));
  async function confirm(code = c.staff.code) {
    await dialog
      .getByLabel("Cancellation reason")
      .fill("Synthetic browser incident");
    await dialog.getByLabel("Cancellation staff code").fill(code);
    await c.budgets();
    await dialog
      .getByRole("button", { name: "Confirm cancellation", exact: true })
      .click();
  }
  try {
    await participant.addCookies([
      {
        name: cookieNames.participant,
        value: a.aa,
        url: origin,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    const arena = await participant.newPage();
    arena.on("pageerror", (e) => errors.push(e.message));
    await c.budgets();
    await arena.goto(origin);
    await expect(
      arena.getByText("STATE VERIFIED", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await arena.locator(`[data-bounty-id="${a.x}"]`).click();
    await arena
      .getByRole("button", { name: "Plain text", exact: true })
      .click();
    const editor = arena.getByRole("textbox", {
      name: "Your private code",
      exact: true,
    });
    await editor.fill("int main() { return 0; }\n");
    await expect(arena.locator(".save-status")).toHaveText("saved", {
      timeout: 10000,
    });
    await c.budgets();
    await arena.getByRole("button", { name: /Run samples/ }).click();
    await expect(
      arena.getByRole("button", { name: /Scanning samples/ }),
    ).toHaveAttribute("aria-busy", "true");
    await c.budgets();
    await page.goto(origin);
    await page.getByRole("button", { name: "incidents", exact: true }).click();
    await section
      .getByRole("button", { name: "Cancel whole round", exact: true })
      .click();
    await dialog
      .getByLabel("Cancellation incident reference")
      .fill("BROWSER-OPS-1");
    await dialog
      .getByLabel("Cancellation round confirmation")
      .fill(randomUUID());
    await dialog
      .getByLabel("Cancellation reason")
      .fill("Synthetic browser incident");
    await dialog.getByLabel("Cancellation staff code").fill(c.staff.code);
    await expect(
      dialog.getByRole("button", { name: "Confirm cancellation", exact: true }),
    ).toBeDisabled();
    await dialog.getByLabel("Cancellation round confirmation").fill(a.round);
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    await confirm("A".repeat(32));
    await expect(dialog.getByRole("alert")).toContainText(
      "Confirmation failed",
    );
    await expect(
      dialog.getByLabel("Cancellation round confirmation"),
    ).toHaveValue(a.round);
    let posts = 0;
    await page.route(
      `**/api/v1/staff/competition/rounds/${a.round}/commands`,
      async (route) => {
        posts++;
        await route.fetch();
        await route.abort("failed");
      },
    );
    await confirm();
    await expect(
      dialog.getByRole("button", {
        name: "Check cancellation outcome",
        exact: true,
      }),
    ).toBeVisible();
    await c.budgets();
    await dialog
      .getByRole("button", { name: "Check cancellation outcome", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    assert.equal(posts, 1);
    await expect(section.getByRole("alert")).toHaveCount(0);
    await expect(
      arena.getByText("Round cancelled. No competitive result or winner.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(editor).toHaveAttribute("readonly");
    await expect(
      arena.getByRole("button", { name: /Run samples/ }),
    ).toBeDisabled();
    await expect(
      arena.getByRole("button", { name: /Submit fix/ }),
    ).toBeDisabled();
    await expect(arena.locator(".judging-notice")).toHaveCount(0);
    await expect(arena.locator(".feedback-heading")).toContainText("cancelled");
    await expect(editor).toHaveValue("int main() { return 0; }\n");
    await page.unroute(
      `**/api/v1/staff/competition/rounds/${a.round}/commands`,
    );
    await expect(
      section.getByText("BROWSER-OPS-1", { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "Finish cancellation", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: "test-results/cancellation-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/cancellation-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        "document.documentElement.scrollWidth <= innerWidth + 1",
      ),
    );
    await section
      .getByRole("button", { name: "Finish cancellation", exact: true })
      .click();
    await confirm();
    await expect(dialog).not.toBeVisible();
    await expect(
      section.getByRole("status").filter({ hasText: "No competitive result" }),
    ).toBeVisible();
    assert.equal(
      (
        await c.owner.query(
          "SELECT current_instance_id FROM arena_control WHERE id=1",
        )
      ).rows[0].current_instance_id,
      null,
    );
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::int n FROM round_results WHERE round_id=$1",
          [a.round],
        )
      ).rows[0].n,
      0,
    );
    await c.budgets();
    await arena.reload();
    await expect(
      arena.getByText("STATE VERIFIED", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      arena.getByText("Round cancelled. No competitive result or winner.", {
        exact: true,
      }),
    ).toBeVisible();
    await arena.locator(`[data-bounty-id="${a.x}"]`).click();
    await arena
      .getByRole("button", { name: "Plain text", exact: true })
      .click();
    await expect(editor).toHaveAttribute("readonly");
    await expect(editor).toHaveValue("int main() { return 0; }\n");
    await expect(
      arena.getByRole("button", { name: /Submit fix/ }),
    ).toBeDisabled();
    assert.deepEqual(errors, []);
    const other = await browser.newContext();
    try {
      await other.addCookies([
        {
          name: cookieNames.staff,
          value: c.organiser.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const p = await other.newPage();
      await c.budgets();
      await p.goto(origin);
      await expect(
        p.getByRole("button", { name: "access", exact: true }),
      ).toBeVisible();
      await expect(
        p.getByRole("button", { name: "incidents", exact: true }),
      ).not.toBeVisible();
    } finally {
      await other.close();
    }
  } finally {
    await participant.close();
    await context.close();
  }
}
