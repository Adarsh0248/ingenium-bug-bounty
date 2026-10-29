import { openStaffView } from "./browser-app.js";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import type { TestContext } from "node:test";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import {
  createOperationsStatus,
  readOperations,
} from "../../src/maintenance/operations.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { AccessError } from "../../src/access/transaction.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { withBrowserApp } from "./browser-app.js";

export async function operationsChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newStaff(
      role?: string,
    ): Promise<{ id: string; code: string; sessionCookie: string }>;
  },
) {
  const query = async (sql: string) => (await c.owner.query(sql)).rows;
  const operations = createOperationsStatus(c.api, c.clock, c.delivery),
    a = await c.newRound();
  await c.service.submit(
    a.aa,
    a.round,
    a.x,
    "// PRIVATE-OPERATIONS-SOURCE\n",
    randomUUID(),
  );
  await c.budgets();
  await c.service.run(
    a.ab,
    a.round,
    a.y,
    "// PRIVATE-OPERATIONS-SAMPLE\n",
    randomUUID(),
  );
  await t.test(
    "operations aggregates are exact, bounded and private without renewing activity",
    async () => {
      await c.budgets();
      const before = await query(
          "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
        ),
        value = await operations(c.staff.sessionCookie);
      const metrics = new Map(value.metrics.map((m) => [m.id, m]));
      assert.equal(metrics.get("OFFICIAL_PENDING")!.value, "1");
      assert.equal(metrics.get("SAMPLE_PENDING")!.value, "1");
      assert.equal(metrics.get("PHYSICAL_HOLDS")!.limit, "2");
      assert.equal(
        metrics.get("PARTICIPANT_ACCOUNTED_BYTES")!.value,
        (await query("SELECT workbench_usage(NULL)::text n"))[0].n,
      );
      assert.equal(
        metrics.get("OUTBOX_ACCOUNTED_ROWS")!.value,
        (
          await query(
            "SELECT (rows+reserved)::text n FROM live_control WHERE id=1",
          )
        )[0].n,
      );
      assert.notEqual(value.state, "OK");
      assert.equal(value.unverified.length, 5);
      assert.ok(Buffer.byteLength(JSON.stringify(value)) < 16384);
      assert.doesNotMatch(
        JSON.stringify(value),
        /PRIVATE-|sessionCookie|verifier|fingerprint|Synthetic competition|endpoint_ref/,
      );
      assert.deepEqual(
        await query(
          "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
        ),
        before,
      );
      await assert.rejects(
        operations(c.organiser.sessionCookie),
        (e: unknown) =>
          e instanceof AccessError && e.code === "ACCESS_UNAVAILABLE",
      );
      await assert.rejects(
        operations(a.aa),
        (e: unknown) =>
          e instanceof AccessError && e.code === "INVALID_SESSION",
      );
      await assert.rejects(
        c.judgePool.query("SELECT operations_observation()"),
        { code: "42501" },
      );
    },
  );
  await t.test(
    "offline read-only observation survives unavailable gameplay time without changing judging",
    async () => {
      const badClock = {
        assertHealthy() {
          throw new AccessError("CLOCK_UNTRUSTED");
        },
        async verify() {
          throw new AccessError("CLOCK_UNTRUSTED");
        },
        fault() {},
      };
      await assert.rejects(
        createOperationsStatus(
          c.api,
          badClock,
          c.delivery,
        )(c.staff.sessionCookie),
      );
      const client = await c.api.connect();
      try {
        await client.query("BEGIN READ ONLY");
        assert.equal(
          (await client.query("SELECT operations_observation() o")).rows[0].o
            .clock_state,
          "STOPPED",
        );
        await client.query("COMMIT");
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      assert.equal((await readOperations(c.api)).clock_state, "STOPPED");
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM participant_judging WHERE completed_at IS NULL",
          )
        )[0].n,
        2,
      );
    },
  );
  await t.test(
    "operations HTTP is private and noncacheable, refusing query overrides and HEAD",
    async () => {
      await c.budgets();
      const browser = {
          mode: "loopback" as const,
          origin: "http://127.0.0.1:5174",
          cookieKey: randomBytes(32),
          csrfKey: randomBytes(32),
        },
        policy = browserPolicy(browser);
      const app = buildApp({
        database: { async check() {}, async close() {} },
        entry: { pool: c.api, clock: c.clock, delivery: c.delivery, browser },
      });
      try {
        const path = "/api/v1/staff/maintenance/operations",
          cookie = `${policy.names.staff}=${c.staff.sessionCookie}`;
        assert.equal(
          (await app.inject({ method: "GET", url: path })).statusCode,
          401,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: path,
              headers: {
                cookie: `${policy.names.staff}=${c.organiser.sessionCookie}`,
              },
            })
          ).statusCode,
          403,
        );
        const response = await app.inject({
          method: "GET",
          url: path,
          headers: { cookie },
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.equal(response.json().data.metrics.length, 15);
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: `${path}?source=true`,
              headers: { cookie },
            })
          ).statusCode,
          400,
        );
        assert.equal(
          (await app.inject({ method: "HEAD", url: path, headers: { cookie } }))
            .statusCode,
          404,
        );
      } finally {
        await app.close();
      }
    },
  );
  if (process.env.INGENIUM_TEST_SUITE === "operations-browser")
    await t.test(
      "operations clears stale readings on errors and renders desktop/mobile without overlap",
      async () => {
        const actor = await c.newStaff();
        await c.budgets();
        await withBrowserApp(
          {
            pool: c.api,
            clock: c.clock,
            delivery: c.delivery,
            competition: c.deps,
          },
          async (browser, origin, policy) => {
            const context = await browser.newContext({
              viewport: { width: 1440, height: 1000 },
            });
            try {
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
                errors: string[] = [],
                writes: string[] = [];
              page.on("pageerror", (e) => errors.push(e.message));
              page.on("request", (r) => {
                if (r.method() === "POST" && r.url().includes("maintenance/"))
                  writes.push(r.url());
              });
              await page.goto(origin);
              await openStaffView(page, "System health");
              const panel = page.getByLabel("Event operations"),
                refresh = panel.getByRole("button", {
                  name: "Refresh operations status",
                  exact: true,
                });
              await expect(
                panel.getByText("Pending submissions", { exact: true }),
              ).toBeVisible();
              await expect(
                panel.getByText("Awaiting verification", { exact: true }),
              ).toBeVisible();
              const path = "**/api/v1/staff/maintenance/operations";
              await page.route(path, (route) => route.abort("failed"));
              await refresh.click();
              await expect(panel.getByRole("alert")).toBeVisible();
              await expect(
                panel.getByText("Pending submissions", { exact: true }),
              ).toHaveCount(0);
              await page.unroute(path);
              await refresh.click();
              await expect(panel.getByRole("alert")).toHaveCount(0);
              await expect(
                panel.getByText("Pending submissions", { exact: true }),
              ).toBeVisible();
              const output = fileURLToPath(
                new URL("../../test-results/", import.meta.url),
              );
              await mkdir(output, { recursive: true });
              await page.screenshot({
                path: `${output}/operations-desktop.png`,
                fullPage: true,
              });
              await page.setViewportSize({ width: 390, height: 844 });
              assert.ok(
                await panel.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
              );
              await page.screenshot({
                path: `${output}/operations-mobile.png`,
                fullPage: true,
              });
              await c.budgets();
              await createStaffService(c.api, c.clock, c.delivery).logout(
                actor.sessionCookie,
              );
              await refresh.click();
              await expect(
                page.getByRole("heading", {
                  name: "Session unavailable",
                  exact: true,
                }),
              ).toBeVisible();
              assert.deepEqual(errors, []);
              assert.deepEqual(writes, []);
            } finally {
              await context.close();
            }
          },
        );
      },
    );
}
