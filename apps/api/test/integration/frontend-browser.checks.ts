import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import type {
  CompetitionDependencies,
  createCompetitionService,
} from "../../src/competition/service.js";
import { staffConsoleChecks } from "./staff-console.checks.js";
import { staffAccessChecks } from "./staff-access.checks.js";
import { staffContentChecks } from "./staff-content.checks.js";
import { staffTeamsChecks } from "./staff-teams.checks.js";
import { registrationBrowserChecks } from "./registration-browser.checks.js";
import { disciplineBrowserChecks } from "./discipline-browser.checks.js";
import { cancellationBrowserChecks } from "./cancellation-browser.checks.js";
import type { createValidationWorker } from "../../src/content/validation-worker.js";
interface Context {
  owner: Pool;
  api: Pool;
  clock: ClockGuard;
  delivery: SessionDelivery;
  deps: CompetitionDependencies;
  service: ReturnType<typeof createCompetitionService>;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string };
  teams: { id: string; code: string; members: string[] }[];
  newStaff(
    role?: string,
  ): Promise<{ id: string; code: string; sessionCookie: string }>;
  judge: { claim(): Promise<unknown> };
  validationWorker: ReturnType<typeof createValidationWorker>;
  held: Set<string>;
  budgets(): Promise<void>;
  newRound(): Promise<{ round: string; aa: string; x: string }>;
}
export async function participantBrowserChecks(t: TestContext, c: Context) {
  await t.test(
    process.env.INGENIUM_TEST_SUITE==="registration-browser"?"the real registration screen validates, imports, exports and recovers without replaying writes":"the real React/Fastify/PostgreSQL flow preserves private drafts and operates both rounds without replaying uncertain commands",
    async () => {
      const arena = await c.newRound(),
        errors: string[] = [];
      await withBrowserApp({pool:c.api,clock:c.clock,delivery:c.delivery,competition:c.deps},async (browserProcess,origin,policy) => {
        if(process.env.INGENIUM_TEST_SUITE==="cancellation-browser") {
          await cancellationBrowserChecks(browserProcess,origin,policy.names,c);
          return;
        }
        if(process.env.INGENIUM_TEST_SUITE==="discipline-browser") {
          await disciplineBrowserChecks(browserProcess,origin,policy.names.staff,c);
          return;
        }
        if(process.env.INGENIUM_TEST_SUITE==="registration-browser") {
          await registrationBrowserChecks(browserProcess,origin,policy.names.staff,c);
          return;
        }
        const context = await browserProcess.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        await context.addCookies([
          {
            name: policy.names.participant,
            value: arena.aa,
            url: origin,
            httpOnly: true,
            sameSite: "Strict",
          },
        ]);
        const page = await context.newPage();
        page.on("pageerror", (e) => errors.push(e.message));
        await c.budgets();
        await page.goto(origin);
        await expect(
          page.getByText("STATE VERIFIED", { exact: true }),
        ).toBeVisible({ timeout: 15000 });
        await expect(page.locator(".preview-label")).toHaveCount(0);
        await page.locator(`[data-bounty-id="${arena.x}"]`).click();
        await page
          .getByRole("button", { name: "Plain text", exact: true })
          .click();
        const source =
            "// real browser -> HTTP -> PostgreSQL\nint main() { return 0; }\n",
          editor = page.getByRole("textbox", {
            name: "Your private code",
            exact: true,
          });
        await editor.fill(source);
        await expect(page.locator(".save-status")).toHaveText("saved", {
          timeout: 10000,
        });
        assert.equal(
          (
            await c.owner.query(
              "SELECT convert_from(source_code,'UTF8') source FROM code_drafts WHERE bounty_id=$1",
              [arena.x],
            )
          ).rows[0].source,
          source,
        );
        const command = async (action: "PAUSE" | "RESUME") => {
          await c.budgets();
          await c.service.command(c.staff.sessionCookie, {
            action,
            roundId: arena.round,
            requestKey: randomUUID(),
            expectedRevision: (
              await c.owner.query("SELECT revision FROM rounds WHERE id=$1", [
                arena.round,
              ])
            ).rows[0].revision,
            payload: { scope: "GLOBAL", target: null },
            reason: "Synthetic real-browser pause",
            ownCode: c.staff.code,
          });
        };
        await command("PAUSE");
        await expect(editor).toHaveAttribute("readonly");
        await expect(
          page.getByRole("button", { name: /Submit fix/ }),
        ).toBeDisabled();
        await expect(editor).toHaveValue(source);
        await command("RESUME");
        await expect(editor).not.toHaveAttribute("readonly");
        await page.reload();
        await expect(
          page.getByText("STATE VERIFIED", { exact: true }),
        ).toBeVisible({ timeout: 15000 });
        await page.locator(`[data-bounty-id="${arena.x}"]`).click();
        await page
          .getByRole("button", { name: "Plain text", exact: true })
          .click();
        await expect(editor).toHaveValue(source);
        for (const path of [
          "/api/v1/staff/competition/control-room",
          "/api/v1/staff/competition/published?kind=1",
        ]) {
          assert.equal(
            (await page.request.get(`${origin}${path}`)).status(),
            401,
          );
        }
        assert.deepEqual(errors, []);
        await context.close();
        await staffConsoleChecks(browserProcess, origin, policy.names.staff, c);
        await staffAccessChecks(browserProcess, origin, policy.names.staff, c);
        await staffContentChecks(browserProcess, origin, policy.names.staff, c);
        await staffTeamsChecks(browserProcess, origin, policy.names.staff, c);
        await registrationBrowserChecks(browserProcess, origin, policy.names.staff, c);
        await disciplineBrowserChecks(browserProcess, origin, policy.names.staff, c);
        await cancellationBrowserChecks(browserProcess, origin, policy.names, c);
      });
    },
  );
}
