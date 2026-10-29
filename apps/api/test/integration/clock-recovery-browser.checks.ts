import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Pool } from "pg";
import type { createClockMonitor } from "../../src/clock/monitor.js";
import {
  newAccessCode,
  sessionDelivery,
} from "../../src/access/credentials.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { withBrowserApp } from "./browser-app.js";

export async function clockRecoveryBrowserChecks({
  owner,
  api,
  monitor,
  fake,
}: {
  owner: Pool;
  api: Pool;
  monitor: ReturnType<typeof createClockMonitor>;
  fake: { step(): void };
}) {
  const id = randomUUID(),
    code = newAccessCode(),
    delivery = sessionDelivery("synthetic-browser-clock", randomBytes(32));
  await owner.query(
    "INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic timing owner','OWNER')",
    [id],
  );
  await owner.query(
    "INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",
    [randomUUID(), id, code.verifier],
  );
  const staff = createStaffService(
      api,
      monitor.guard,
      delivery,
      monitor.recoveryGuard,
    ),
    entry = createEntryService(api, monitor.guard, delivery);
  const flow = await entry.begin(code.code, {
    ip: "127.0.0.1",
    browserId: randomUUID(),
  });
  if (flow.audience !== "STAFF") throw Error("Synthetic owner entry");
  const original = await staff.activate(flow.proofCookie, randomUUID());
  const arena = randomUUID(),
    round = randomUUID();
  await owner.query(
    "WITH created AS (INSERT INTO arena_instances(id,status,created_by,created_at) VALUES($1,'IN_PROGRESS',$2,date_trunc('milliseconds',clock_timestamp())) RETURNING id) UPDATE arena_control SET current_instance_id=created.id,revision=revision+1 FROM created WHERE arena_control.id=1",
    [arena, id],
  );
  await owner.query(
    "INSERT INTO rounds(id,arena_instance_id,kind,state,duration_ms,started_at,closes_at,trusted_time_at) VALUES($1,$2,1,'PAUSED',300000,date_trunc('milliseconds',clock_timestamp())-interval '1 minute',date_trunc('milliseconds',clock_timestamp())+interval '4 minutes',date_trunc('milliseconds',clock_timestamp()))",
    [round, arena],
  );
  const before = (
    await owner.query("SELECT * FROM rounds WHERE id=$1", [round])
  ).rows;
  monitor.guard.fault("WALL_STEP");
  await monitor.flush();
  for (let i = 0; i < 7; i++) {
    fake.step();
    await monitor.pollOnce();
  }
  const budgets = async () => {
    await owner.query("DELETE FROM quota_buckets");
  };
  await withBrowserApp(
    {
      pool: api,
      clock: monitor.guard,
      recoveryClock: monitor.recoveryGuard,
      delivery,
    },
    async (browser, origin, policy) => {
      const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
        }),
        errors: string[] = [];
      await context.addCookies([
        {
          name: policy.names.staff,
          value: original.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const page = await context.newPage(),
        panel = page.locator(".clock-recovery"),
        dialog = page.getByRole("dialog");
      page.on("pageerror", (e) => errors.push(e.message));
      async function enter() {
        await budgets();
        await page.getByLabel("Team or staff code").fill(code.code);
        await page
          .getByRole("button", { name: "Enter arena", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Open control room", exact: true })
          .click();
      }
      try {
        await page.goto(origin);
        await expect(page.getByLabel("Team or staff code")).toBeVisible();
        await enter();
        await expect(
          panel.getByRole("heading", { name: "Timing recovery", exact: true }),
        ).toBeVisible();
        await expect(
          panel.getByText("Awaiting clearance", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Live overview", exact: true }),
        ).toHaveCount(0);
        await page.route("**/api/v1/staff/recovery/clock", (route) =>
          route.abort("failed"),
        );
        await page
          .getByRole("button", { name: "Refresh timing state", exact: true })
          .click();
        await expect(panel.getByRole("alert")).toContainText(
          "Connection interrupted",
        );
        await expect(
          page.getByRole("button", {
            name: "Review clock clearance",
            exact: true,
          }),
        ).toHaveCount(0);
        await page.unroute("**/api/v1/staff/recovery/clock");
        await page
          .getByRole("button", { name: "Refresh timing state", exact: true })
          .click();
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await page
          .getByRole("button", { name: "Review clock clearance", exact: true })
          .click();
        await dialog
          .getByLabel("Timing clearance reason")
          .fill("Synthetic primary-host timing reviewed");
        await dialog
          .getByLabel("Timing clearance staff code")
          .fill("Z".repeat(32));
        await budgets();
        await dialog
          .getByRole("button", {
            name: "Confirm timing clearance",
            exact: true,
          })
          .click();
        await expect(dialog.getByRole("alert")).toContainText(
          "Confirmation failed",
        );
        await expect(
          dialog.getByLabel("Timing clearance staff code"),
        ).toHaveValue("");
        await expect(dialog.getByLabel("Timing clearance reason")).toHaveValue(
          "Synthetic primary-host timing reviewed",
        );
        let posts = 0;
        await page.route(
          "**/api/v1/staff/recovery/clock/clear",
          async (route) => {
            posts++;
            await route.fetch();
            await route.abort("failed");
          },
        );
        await dialog.getByLabel("Timing clearance staff code").fill(code.code);
        await budgets();
        await dialog
          .getByRole("button", {
            name: "Confirm timing clearance",
            exact: true,
          })
          .click();
        await expect(
          dialog.getByRole("button", {
            name: "Check clearance outcome",
            exact: true,
          }),
        ).toBeEnabled();
        const activity = (
          await owner.query(
            "SELECT last_activity_at FROM staff_sessions WHERE staff_id=$1 AND revoked_at IS NULL",
            [id],
          )
        ).rows;
        await expect(
          panel.getByRole("button", {
            name: "Sign out and return to entry",
            exact: true,
          }),
        ).toHaveCount(0);
        await budgets();
        await dialog
          .getByRole("button", { name: "Check clearance outcome", exact: true })
          .click();
        await expect(dialog).not.toBeVisible();
        assert.equal(posts, 1);
        await page.unroute("**/api/v1/staff/recovery/clock/clear");
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect(
          panel.getByText(/Clearance recorded for incident 1/),
        ).toBeVisible();
        await expect(
          panel.getByText(/Timing fault cleared\. Sign out/),
        ).toBeVisible();
        assert.deepEqual(
          (
            await owner.query(
              "SELECT last_activity_at FROM staff_sessions WHERE staff_id=$1 AND revoked_at IS NULL",
              [id],
            )
          ).rows,
          activity,
        );
        assert.deepEqual(
          (await owner.query("SELECT * FROM rounds WHERE id=$1", [round])).rows,
          before,
        );
        assert.equal(
          (await owner.query("SELECT count(*)::int n FROM clock_clearances"))
            .rows[0].n,
          1,
        );
        await page.screenshot({
          path: "test-results/clock-recovery-desktop.png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({
          path: "test-results/clock-recovery-mobile.png",
          fullPage: true,
        });
        assert.ok(
          await page.evaluate(
            "document.documentElement.scrollWidth <= innerWidth + 1",
          ),
        );
        fake.step();
        await monitor.pollOnce();
        monitor.guard.assertHealthy();
        await budgets();
        await page.reload();
        await expect(
          panel.getByText(/Timing fault cleared\. Sign out/),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Live overview", exact: true }),
        ).toHaveCount(0);
        let signouts = 0;
        await page.route("**/api/v1/staff/recovery/logout", async (route) => {
          signouts++;
          await route.abort("failed");
        });
        await budgets();
        await panel
          .getByRole("button", {
            name: "Sign out and return to entry",
            exact: true,
          })
          .click();
        await panel
          .getByRole("button", { name: "Check sign-out outcome", exact: true })
          .click();
        await expect(
          panel
            .getByRole("status")
            .filter({ hasText: "Session is still active" }),
        ).toBeVisible();
        assert.equal(signouts, 1);
        await page.unroute("**/api/v1/staff/recovery/logout");
        await budgets();
        await panel
          .getByRole("button", {
            name: "Sign out and return to entry",
            exact: true,
          })
          .click();
        await expect(page.getByLabel("Team or staff code")).toBeVisible();
        await enter();
        await expect(
          page.getByRole("button", { name: "Live overview", exact: true }),
        ).toBeVisible();
        const active = (
          await owner.query(
            "SELECT mode FROM staff_sessions WHERE staff_id=$1 AND revoked_at IS NULL",
            [id],
          )
        ).rows;
        assert.deepEqual(active, [{ mode: "NORMAL" }]);
        // A new incident cannot reuse the old recovery grant or its saved clearance.
        monitor.guard.fault("WALL_STEP");
        await monitor.flush();
        for (let i = 0; i < 7; i++) {
          fake.step();
          await monitor.pollOnce();
        }
        const next = await staff.beginRecovery(code.code, {
            ip: "127.0.0.1",
            browserId: randomUUID(),
          }),
          recovered = await staff.activate(
            next.proofCookie,
            randomUUID(),
            true,
          );
        await context.addCookies([
          {
            name: policy.names.staffRecovery,
            value: recovered.sessionCookie,
            url: origin,
            httpOnly: true,
            sameSite: "Strict",
          },
        ]);
        await budgets();
        await page.reload();
        await expect(
          panel.getByText("Awaiting clearance", { exact: true }),
        ).toBeVisible();
        await budgets();
        await staff.clearClock(recovered.sessionCookie, {
          code: code.code,
          requestKey: randomUUID(),
          runtimeId: monitor.runtimeId,
          generation: "2",
          reason: "Synthetic second incident reviewed in another tab",
        });
        fake.step();
        await monitor.pollOnce();
        monitor.guard.fault("WALL_STEP");
        await monitor.flush();
        for (let i = 0; i < 7; i++) {
          fake.step();
          await monitor.pollOnce();
        }
        await budgets();
        await page
          .getByRole("button", { name: "Refresh timing state", exact: true })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Session unavailable",
            exact: true,
          }),
        ).toBeVisible();
        await expect(panel).toHaveCount(0);
        assert.equal(
          (await owner.query("SELECT count(*)::int n FROM clock_clearances"))
            .rows[0].n,
          2,
        );
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    },
  );
}
