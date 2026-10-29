import { supplyLegacyStaffCode } from "./browser-app.js";
import { openStaffView } from "./browser-app.js";
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
  teams: { id: string }[];
  service: ReturnType<typeof createCompetitionService>;
  budgets(): Promise<void>;
  judge: { claim(): Promise<unknown> };
}
export async function staffConsoleChecks(
  browser: Browser,
  origin: string,
  cookieName: string,
  c: Context,
) {
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    {
      name: cookieName,
      value: c.staff.sessionCookie,
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = async () =>
    (
      await c.owner
        .query(`SELECT r.id,r.state,r.revision,r.arena_instance_id,r.kind FROM rounds r
    JOIN arena_control a ON a.current_instance_id=r.arena_instance_id ORDER BY r.kind DESC LIMIT 1`)
    ).rows[0];
  async function confirm(sensitive = true) {
    if (!sensitive) return;
    const modal = page.getByRole("dialog");
    await modal
      .getByLabel("Change note")
      .fill("Disposable browser control-room check");
    if (sensitive) await supplyLegacyStaffCode(modal, c.staff.code);
    else await expect(modal.getByLabel("Your staff code")).toHaveCount(0);
    await c.budgets();
    await modal
      .getByRole("button", { name: /^(Start round|Pause actions|Resume actions|Close round|Finalise results|Lock qualification|Discard arena)$/ })
      .click();
    await expect(modal).not.toBeVisible();
  }
  async function command(name: string, sensitive = true) {
    await c.budgets();
    await page.getByRole("button", { name, exact: true }).click();
    await confirm(sensitive);
  }
  async function expectState(wanted: string) {
    await expect.poll(async () => (await state())?.state).toBe(wanted);
  }
  async function monitor() {
    await openStaffView(page, "Live overview");
  }
  try {
    await c.budgets();
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: "running", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".staff-header .connection")).toHaveText("Live");
    await expect(page.locator(".preview-label")).toHaveCount(0);
    const original = await state();
    const projection = await page.request.get(
      "/api/v1/staff/competition/control-room",
    );
    assert.equal(projection.status(), 200);
    const body = (await projection.json()).data;
    assert.equal(body.rounds[0].teams.length, 2);
    assert.ok(
      body.rounds[0].teams[0].members.every((m: any) => m.member_round_id),
    );
    assert.doesNotMatch(
      JSON.stringify(body),
      /source_code|source_b64|reference_code|verifier|csrf|issued_code/,
    );
    assert.equal(
      (
        await page.request.get(
          "/api/v1/staff/competition/control-room?arena_id=bad",
        )
      ).status(),
      400,
    );
    assert.equal(
      (
        await page.request.get("/api/v1/staff/competition/published?kind=3")
      ).status(),
      400,
    );
    assert.equal(
      (
        await page.request.get(
          `/api/v1/staff/competition/control-room?arena_id=${randomUUID()}`,
        )
      ).status(),
      403,
    );
    await page.screenshot({ path: "test-results/staff-desktop.png" });

    let releaseRead!: () => void;
    let delayRead = true,
      dropReply = false,
      writes = 0;
    const heldRead = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    await page.route("**/api/v1/staff/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (delayRead && path.endsWith("/competition/control-room"))
        await heldRead;
      const commandWrite =
        request.method() === "POST" && path.endsWith("/commands");
      if (commandWrite) writes++;
      if (dropReply && commandWrite) {
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{",
        });
        return;
      }
      await route.continue();
    });
    try {
      await page.getByRole("button", { name: "Reload verified state" }).click();
      await expect(
        page.getByRole("button", { name: "Reload verified state" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Pause round", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Pause round", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    } finally {
      delayRead = false;
      releaseRead();
    }

    dropReply = true;
    await command("Pause round");
    await expect.poll(() => writes).toBe(1);
    await expect(
      page.getByText("Command outcome unconfirmed.", { exact: true }),
    ).toBeVisible();
    await expectState("PAUSED");
    dropReply = false;
    await c.budgets();
    await page.getByRole("button", { name: "Check original command" }).click();
    await expect(
      page.getByText("Command outcome unconfirmed.", { exact: true }),
    ).toHaveCount(0);
    assert.equal(writes, 1);
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::integer n FROM competition_pauses WHERE round_id=$1 AND scope='GLOBAL' AND ended_at IS NULL",
          [original.id],
        )
      ).rows[0].n,
      1,
    );
    await command("Resume round");
    await expectState("RUNNING");
    await monitor();
    const team = page.locator(`tr[data-team-id="${c.teams[0]!.id}"]`);
    await team.getByRole("button", { name: /^Pause team/ }).click();
    await confirm();
    await expect(team.getByText("Team paused", { exact: true })).toBeVisible();
    await team.getByRole("button", { name: /^Resume team/ }).click();
    await confirm();
    await expect(team.getByText("Team paused", { exact: true })).toHaveCount(0);
    await team
      .getByRole("button", { name: "Pause member First", exact: true })
      .click();
    await confirm();
    await expect(team.locator(".staff-member").first()).toContainText("Paused");
    await team
      .getByRole("button", { name: "Resume member First", exact: true })
      .click();
    await confirm();
    await expect(team.locator(".staff-member").first()).not.toContainText(
      "Paused",
    );

    const readOnly = await browser.newContext();
    await readOnly.addCookies([
      {
        name: cookieName,
        value: c.organiser.sessionCookie,
        url: origin,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    const observer = await readOnly.newPage();
    await c.budgets();
    await observer.goto(origin);
    await expect(
      observer.getByRole("heading", { name: "running", exact: true }),
    ).toBeVisible();
    await expect(observer.locator(".staff-header .connection")).toHaveText(
      "Live",
    );
    await expect(
      observer.getByRole("button", { name: "Pause round", exact: true }),
    ).toBeVisible();
    await expect(
      observer.getByRole("button", { name: /^Pause member/ }),
    ).toHaveCount(4);
    await readOnly.close();

    await command("Close round");
    await expectState("CLOSING");
    await command("Finalise results");
    await expectState("CLOSED");
    await command("Lock qualification");
    await expect
      .poll(async () =>
        Number(
          (
            await c.owner.query(
              "SELECT count(*) n FROM qualification_decisions",
            )
          ).rows[0].n,
        ),
      )
      .toBeGreaterThan(0);
    await openStaffView(page, "Arena setup");
    await expect(page.getByLabel("Round 2 duration (minutes)")).toBeVisible();
    await page.getByLabel("Round 2 duration (minutes)").fill("90");
    await command("Save Round 2 setup", false);
    await expect.poll(async () => (await state()).kind).toBe(2);
    await expect(
      page.getByRole("button", { name: /^Round 2/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const second = await state();
    assert.equal(second.arena_instance_id, original.arena_instance_id);
    await openStaffView(page, "Round questions");
    const picks = page.getByRole("checkbox", { name: /^Select bug/ });
    await expect(picks).toHaveCount(2);
    await picks.nth(0).check();
    await picks.nth(1).check();
    await command("Save round questions", false);
    await command("Prepare configuration", false);
    await expectState("READY");
    await c.judge.claim();
    await command("Start round");
    await expectState("RUNNING");
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::integer n FROM arena_instances WHERE status='IN_PROGRESS'",
        )
      ).rows[0].n,
      1,
    );
    await monitor();
    await expect(
      page.getByRole("heading", { name: "Live standings", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".staff-overview strong").first()).toHaveText(
      /\d{2}:\d{2}:\d{2}/,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate<boolean>(
        "document.documentElement.scrollWidth <= innerWidth",
      ),
    );
    await page.screenshot({ path: "test-results/staff-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await command("Close round");
    await expectState("CLOSING");
    await command("Finalise results");
    await expect
      .poll(
        async () =>
          (
            await c.owner.query(
              "SELECT current_instance_id FROM arena_control WHERE id=1",
            )
          ).rows[0].current_instance_id,
      )
      .toBeNull();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "closed", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Final standings", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start round", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "New arena", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Create arena", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Duration (minutes)", { exact: true }).fill("30");
    const registered = page.getByRole("checkbox", { name: /^Select team/ });
    await expect(registered).toHaveCount(2);
    await registered.nth(0).check();
    await registered.nth(1).check();
    await command("Create arena", false);
    await expectState("DRAFT");
    assert.notEqual(
      (await state()).arena_instance_id,
      original.arena_instance_id,
    );
    await openStaffView(page, "Round questions");
    await page
      .getByRole("checkbox", { name: /^Select bug/ })
      .first()
      .check();
    const latest = await state();
    const snapshot = (
      await c.owner.query(
        `SELECT p.snapshot_id FROM competition_publications p JOIN validation_snapshots s ON s.id=p.snapshot_id WHERE s.round_type=1 ORDER BY p.snapshot_id LIMIT 1`,
      )
    ).rows[0].snapshot_id;
    await c.budgets();
    await c.service.command(c.staff.sessionCookie, {
      action: "CONFIGURE",
      roundId: latest.id,
      requestKey: randomUUID(),
      expectedRevision: latest.revision,
      reason: "Concurrent synthetic admin edit",
      payload: { snapshots: [snapshot] },
    });
    await command("Save round questions", false);
    await expect(page.getByRole("alert")).toContainText("stale version");
    await expect(
      page.getByText("Unsaved selection", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Discard local changes", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Discard local selections", exact: true })
      .click();
    await expect(
      page.getByText("Unsaved selection", { exact: true }),
    ).toHaveCount(0);
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({ path: "test-results/staff-failure.png" });
    console.error(
      "Staff view:",
      await page.locator(".staff-message").allTextContents(),
    );
    throw error;
  } finally {
    await context.close();
  }
}
