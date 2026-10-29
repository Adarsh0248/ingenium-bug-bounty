import { openStaffView } from "./browser-app.js";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { withBrowserApp } from "./browser-app.js";
import type { announcementChecks } from "./announcements.checks.js";
import { createAnnouncementService } from "../../src/access/announcements.js";

export async function announcementBrowserChecks(
  c: Parameters<typeof announcementChecks>[1],
  f: { arena: string; round: string; aa: string; ba: string; bug: string },
) {
  const staff = await c.newStaff("ORGANISER"),
    errors: string[] = [];
  await c.budgets();
  await withBrowserApp(
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (browser, origin, policy) => {
      const contexts = await Promise.all(
        [0, 1, 2].map(() =>
          browser.newContext({ viewport: { width: 1440, height: 1000 } }),
        ),
      );
      try {
        const pages = [];
        for (const [i, cookie] of [staff.sessionCookie, f.aa, f.ba].entries()) {
          await contexts[i]!.addCookies([
            {
              name: i === 0 ? policy.names.staff : policy.names.participant,
              value: cookie,
              url: origin,
              httpOnly: true,
              sameSite: "Strict",
            },
          ]);
          const page = await contexts[i]!.newPage();
          page.on("pageerror", (e) => errors.push(e.message));
          pages.push(page);
          await page.goto(i === 0 ? `${origin}/?arena=${f.arena}` : origin);
        }
        const [operator, own, other] = pages as [
          (typeof pages)[number],
          (typeof pages)[number],
          (typeof pages)[number],
        ];
        for (const page of [own, other]) {
          await expect(
            page.getByText("STATE VERIFIED", { exact: true }),
          ).toBeVisible({ timeout: 15000 });
          await page
            .getByRole("button", { name: "Announcements", exact: true })
            .click();
          await expect(
            page
              .getByRole("dialog", { name: "Announcements", exact: true })
              .locator(".announcement-list li")
              .first(),
          ).toBeVisible();
          await expect(
            page.getByLabel("New announcement", { exact: true }),
          ).toHaveCount(0);
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Close dialog", exact: true })
            .click();
        }
        await own.locator(`[data-bounty-id="${f.bug}"]`).click();
        await own
          .getByRole("button", { name: "Plain text", exact: true })
          .click();
        const editor = own.getByRole("textbox", {
            name: "Your private code",
            exact: true,
          }),
          source =
            "// Private buffer survives announcement\nint main(){return 0;}\n";
        await editor.fill(source);
        await expect(own.locator(".save-status")).toHaveText("saved", {
          timeout: 10000,
        });
        await openStaffView(operator, "Announcements");
        const panel = operator.getByLabel("Staff announcements"),
          text =
            "<script>window.noticeExecuted=true</script>\n" + "x".repeat(1800);
        await panel
          .getByLabel("Announcement audience", { exact: true })
          .selectOption("TEAM");
        await panel
          .getByLabel("Announcement team", { exact: true })
          .selectOption(c.teams[0]!.id);
        await panel.getByLabel("Announcement text", { exact: true }).fill(text);
        await panel
          .getByLabel("Announcement reason", { exact: true })
          .fill("Synthetic private browser communication");
        const path = `/api/v1/staff/arenas/${f.arena}/announcements`;
        let posts = 0;
        await operator.route(`**${path}`, async (route) => {
          if (route.request().method() !== "POST") {
            await route.continue();
            return;
          }
          posts++;
          const response = await route.fetch();
          assert.equal(response.status(), 200);
          await route.abort("failed");
        });
        await panel
          .getByRole("button", { name: "Review send", exact: true })
          .click();
        const review = operator.getByRole("dialog", {
          name: "Send announcement?",
          exact: true,
        });
        await expect(review).toContainText("Private:");
        await review
          .getByRole("button", { name: "Send announcement", exact: true })
          .click();
        await expect(
          panel.getByRole("button", {
            name: "Check original send",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          own.getByLabel("New announcement", { exact: true }),
        ).toBeVisible({ timeout: 10000 });
        await expect(
          other.getByLabel("New announcement", { exact: true }),
        ).toHaveCount(0);
        await panel
          .getByRole("button", { name: "Check original send", exact: true })
          .click();
        await expect(
          panel.getByText("Announcement sent.", { exact: true }),
        ).toBeVisible();
        assert.equal(posts, 1);
        const rows = (
          await c.owner.query(
            "SELECT id FROM announcements WHERE arena_id=$1 AND message=$2",
            [f.arena, text],
          )
        ).rows;
        assert.equal(rows.length, 1);
        const id = rows[0].id;
        await own
          .getByRole("button", { name: "Announcements", exact: true })
          .click();
        const inbox = own.getByRole("dialog", {
          name: "Announcements",
          exact: true,
        });
        await inbox
          .getByRole("button", { name: `Read announcement ${id}`, exact: true })
          .click();
        const article = inbox.getByLabel("Announcement message", {
          exact: true,
        });
        await expect(article).toContainText(text);
        await expect(article).toBeFocused();
        await expect(article.locator("strong")).toBeInViewport();
        assert.equal(await article.locator("script,img").count(), 0);
        assert.equal(await own.evaluate("window.noticeExecuted"), undefined);
        await expect(
          own.getByLabel("New announcement", { exact: true }),
        ).toHaveCount(0);
        const output = fileURLToPath(
          new URL("../../test-results/", import.meta.url),
        );
        await mkdir(output, { recursive: true });
        await expect(
          panel.locator(".announcement-list li").first(),
        ).toBeVisible();
        await operator.screenshot({
          path: `${output}/announcements-staff-desktop.png`,
          fullPage: true,
        });
        await own.screenshot({
          path: `${output}/announcements-participant-desktop.png`,
          fullPage: true,
        });
        await own.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await inbox.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        );
        assert.ok(
          await own.evaluate(
            "document.documentElement.scrollWidth <= innerWidth + 1",
          ),
        );
        await own.screenshot({
          path: `${output}/announcements-participant-mobile.png`,
          fullPage: true,
        });
        await inbox
          .getByRole("button", { name: "Back to announcements", exact: true })
          .click();
        const incoming = await createAnnouncementService(
          c.api,
          c.clock,
          c.delivery,
        ).send(c.staff.sessionCookie, {
          arenaId: f.arena,
          scope: "TEAM",
          teamId: c.teams[0]!.id,
          roundId: null,
          requestKey: randomUUID(),
          message: "A second live private message",
          reason: "Synthetic open-inbox update",
        });
        await expect(
          inbox.getByRole("button", {
            name: `Read announcement ${incoming.id}`,
            exact: true,
          }),
        ).toBeVisible({ timeout: 10000 });
        await expect(
          other.getByLabel("New announcement", { exact: true }),
        ).toHaveCount(0);
        await inbox
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await expect(editor).toHaveValue(source);
        await operator.setViewportSize({ width: 390, height: 844 });
        await expect(
          panel.locator(".announcement-list li").first(),
        ).toBeVisible();
        assert.ok(
          await operator.evaluate(
            "document.documentElement.scrollWidth <= innerWidth + 1",
          ),
        );
        await operator.screenshot({
          path: `${output}/announcements-staff-mobile.png`,
          fullPage: true,
        });
        assert.deepEqual(errors, []);
      } finally {
        for (const context of contexts) await context.close();
      }
    },
  );
}
