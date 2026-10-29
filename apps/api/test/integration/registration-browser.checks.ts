import { supplyLegacyStaffCode } from "./browser-app.js";
import { fillStaffNote } from "./browser-app.js";
import { openStaffView } from "./browser-app.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import type { Browser, Download } from "@playwright/test";
import type { Pool } from "pg";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { createRegistrationImport } from "../../src/access/registration-import.js";

interface Context {
  owner: Pool;
  api: Pool;
  clock: ClockGuard;
  delivery: SessionDelivery;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string };
  budgets(): Promise<void>;
}
const header = "registration_id,team_name,member_1_name,member_2_name";
async function downloadText(download: Download) {
  const stream = await download.createReadStream(),
    chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of stream) {
    const b = Buffer.from(chunk);
    length += b.length;
    assert.ok(length < 1048576);
    chunks.push(b);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function registrationBrowserChecks(
  browser: Browser,
  origin: string,
  cookieName: string,
  c: Context,
) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors: string[] = [],
    service = createRegistrationImport(c.api, c.clock, c.delivery);
  await context.addCookies([
    {
      name: cookieName,
      value: c.staff.sessionCookie,
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  page.on("pageerror", (e) => errors.push(e.message));
  const csv = `\ufeff${header}\r\nBROWSER-REG-1,"Browser, Imported Team",First Member,Second Member\r\nBROWSER-REG-2,Other Imported Team,Same Member,Same Member\r\n`;
  async function upload(value: string | Buffer) {
    await page
      .getByLabel("Registration CSV file", { exact: true })
      .setInputFiles({
        name: "registrations.csv",
        mimeType: "text/csv",
        buffer: typeof value === "string" ? Buffer.from(value) : value,
      });
    await expect(
      page.getByRole("button", { name: "Preview registrations", exact: true }),
    ).toBeEnabled();
  }
  async function preview() {
    await c.budgets();
    await page
      .getByRole("button", { name: "Preview registrations", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Preview registrations", exact: true }),
    ).toBeEnabled();
  }
  async function confirm(code = c.staff.code) {
    await page
      .getByRole("button", { name: "Review import", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await fillStaffNote(d, "Import note", "Synthetic browser CSV import");
    await supplyLegacyStaffCode(d, code);
    await c.budgets();
    await d
      .getByRole("button", { name: "Confirm import", exact: true })
      .click();
  }
  try {
    await c.budgets();
    await page.goto(origin);
    await openStaffView(page, "Teams");
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Import registrations", exact: true }),
    ).toBeVisible();
    const template = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "CSV template", exact: true })
      .click();
    assert.match(
      await downloadText(await template),
      new RegExp(`^${header}\\r\\n`),
    );
    await page
      .getByLabel("Registration CSV file", { exact: true })
      .setInputFiles({
        name: "invalid.csv",
        mimeType: "text/csv",
        buffer: Buffer.from([0xff, 0xfe, 0x61]),
      });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review import", exact: true }),
    ).toHaveCount(0);
    await upload(`${header}\nDUP,Team,One,Two\nDUP,Other,One,Two`);
    await preview();
    await expect(page.getByText(/duplicate registration id/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review import", exact: true }),
    ).toBeDisabled();
    await upload(csv);
    await preview();
    await expect(page.getByText("New: 2", { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-registration-id="BROWSER-REG-1"]'),
    ).toContainText("Browser, Imported Team");
    await expect(
      page.getByRole("button", { name: "Live overview", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: "test-results/registration-preview-desktop.png",
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
      path: "test-results/registration-preview-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await confirm("A".repeat(32));
    await expect(page.getByRole("alert")).toContainText("Confirmation failed");
    await expect(page.getByText("New: 2", { exact: true })).toBeVisible();
    await confirm();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Imported team codes");
    const code = dialog.getByLabel("Code for BROWSER-REG-1", { exact: true });
    await expect(code).toHaveAttribute("type", "password");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          "document.documentElement.scrollWidth <= window.innerWidth",
        ),
      )
      .toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Export private codes", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/registration-codes-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await dialog
      .getByRole("button", { name: "Reveal imported codes", exact: true })
      .click();
    await expect(code).toHaveAttribute("type", "text");
    const codeValue = await code.inputValue(),
      exported = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "Export private codes", exact: true })
      .click();
    const payload = JSON.parse(await downloadText(await exported));
    assert.equal(payload.codes.length, 2);
    assert.equal(
      payload.codes.find((v: any) => v.registration_id === "BROWSER-REG-1")
        .code,
      codeValue,
    );
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await upload(csv);
    await preview();
    await expect(page.getByText("Unchanged: 2", { exact: true })).toBeVisible();
    await confirm();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "No teams or codes were created" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await upload(
      csv.replace("Browser, Imported Team", "Changed Existing Team"),
    );
    await preview();
    await expect(page.getByRole("alert")).toContainText(
      /registration conflict/i,
    );
    await expect(
      page.getByRole("button", { name: "Review import", exact: true }),
    ).toBeDisabled();
    const lostCsv = `${header}\nBROWSER-REG-3,Lost Reply Team,One,Two\n`;
    await upload(lostCsv);
    await preview();
    await c.budgets();
    const otherCsv = `${header}\nBROWSER-CONCURRENT,Concurrent Team,One,Two\n`,
      p = await service.preview(c.staff.sessionCookie, otherCsv);
    await service.commit(c.staff.sessionCookie, {
      csv: otherCsv,
      csvDigest: p.csv_digest,
      expectedRevision: p.control_revision,
      requestKey: randomUUID(),
      ownCode: c.staff.code,
      reason: "Synthetic concurrent registration",
    });
    await confirm();
    await expect(page.getByRole("alert")).toContainText(/stale version/i);
    await expect(
      page.getByRole("button", { name: "Review import", exact: true }),
    ).toBeDisabled();
    await preview();
    let posts = 0;
    await page.route("**/api/v1/staff/registrations/import", async (route) => {
      posts++;
      await route.fetch();
      await route.abort("failed");
    });
    await confirm();
    await expect(
      page.getByRole("button", { name: "Check original import", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to teams", exact: true }),
    ).toBeDisabled();
    await c.budgets();
    await page
      .getByRole("button", { name: "Check original import", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Code delivery unavailable" }),
    ).toBeVisible();
    assert.equal(posts, 1);
    await expect(page.getByRole("dialog")).not.toBeVisible();
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::int AS n FROM registration_sources WHERE registration_id='BROWSER-REG-3'",
        )
      ).rows[0].n,
      1,
    );
    await page.unroute("**/api/v1/staff/registrations/import");
    const paged = `${header}\n${Array.from({ length: 51 }, (_, i) => `BROWSER-PAGE-${i},Paged Team ${i},One,Two`).join("\n")}\n`;
    await upload(paged);
    await preview();
    await page
      .getByRole("button", { name: "Next import page", exact: true })
      .click();
    await expect(
      page.locator('[data-registration-id="BROWSER-PAGE-50"]'),
    ).toBeVisible();
    await confirm();
    await expect(dialog).toHaveAccessibleName("Imported team codes");
    await expect(
      dialog.getByLabel("Code for BROWSER-PAGE-0", { exact: true }),
    ).toHaveAttribute("type", "password");
    await dialog
      .getByRole("button", { name: "Next code page", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Code for BROWSER-PAGE-50", { exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Previous code page", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Code for BROWSER-PAGE-0", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", { name: "Back to teams", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Live overview", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await upload(csv);
    await preview();
    await page
      .getByRole("button", { name: "Back to teams", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Discard import preview", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Teams", exact: true }),
    ).toBeVisible();
    await page.reload();
    await openStaffView(page, "Teams");
    await expect(page.getByRole("dialog")).not.toBeVisible();
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
        p.getByRole("button", { name: "Teams", exact: true }),
      ).toBeVisible();
      assert.equal(
        (
          await p.request.post(`${origin}/api/v1/staff/registrations/preview`, {
            data: { csv },
          })
        ).status(),
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
