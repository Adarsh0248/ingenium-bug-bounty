import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Pool } from "pg";
interface Context {
  owner: Pool;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string };
  teams: { id: string; members: string[] }[];
  budgets(): Promise<void>;
  newRound(): Promise<unknown>;
}
export async function disciplineBrowserChecks(
  browser: Browser,
  origin: string,
  cookieName: string,
  c: Context,
) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    errors: string[] = [];
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
    dialog = page.getByRole("dialog"),
    section = page.locator(".staff-discipline");
  page.on("pageerror", (e) => errors.push(e.message));
  async function confirm(code = c.staff.code) {
    await dialog
      .getByLabel("Discipline reason", { exact: true })
      .fill("Synthetic browser discipline");
    await dialog
      .getByLabel("Discipline staff code", { exact: true })
      .fill(code);
    await c.budgets();
    await dialog
      .getByRole("button", { name: "Confirm discipline", exact: true })
      .click();
  }
  try {
    await c.newRound();
    await c.budgets();
    await page.goto(origin);
    await page.getByRole("button", { name: "discipline", exact: true }).click();
    await section.getByLabel("Discipline team").selectOption(c.teams[0]!.id);
    await expect(
      section.getByRole("button", { name: "Add time penalty", exact: true }),
    ).toBeEnabled();
    await section
      .getByRole("button", { name: "Add time penalty", exact: true })
      .click();
    await dialog.getByLabel("Penalty minutes").fill("11");
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    await confirm("A".repeat(32));
    await expect(dialog.getByRole("alert")).toContainText(
      "Confirmation failed",
    );
    await expect(dialog.getByLabel("Penalty minutes")).toHaveValue("11");
    await confirm();
    await expect(dialog).not.toBeVisible();
    await expect(
      section.getByRole("heading", {
        name: "Manual time: 11 / 300 min",
        exact: true,
      }),
    ).toBeVisible();
    const refreshUrl=/\/api\/v1\/staff\/discipline\?/;
    let refreshing=false,release!:()=>void;
    const held=new Promise<void>(resolve=>{release=resolve;});
    await page.route(refreshUrl,async route=>{refreshing=true;await held;await route.continue();});
    try{
      await section.getByRole("button",{name:"Refresh discipline",exact:true}).click();
      await expect.poll(()=>refreshing,{timeout:5000}).toBe(true);
      await section.getByRole("button",{name:"Reverse 11 minute penalty",exact:true}).click();
      await dialog.getByLabel("Discipline reason",{exact:true}).fill("Synthetic browser discipline");
      await dialog.getByLabel("Discipline staff code",{exact:true}).fill(c.staff.code);
      await expect(dialog.getByRole("button",{name:"Confirm discipline",exact:true})).toBeEnabled();
      await confirm();await expect(dialog).not.toBeVisible();
    }finally{release();await page.unrouteAll({behavior:"wait"});}
    await expect(
      section.getByRole("heading", {
        name: "Manual time: 0 / 300 min",
        exact: true,
      }),
    ).toBeVisible();
    const member = (
      await c.owner.query("SELECT display_name FROM team_members WHERE id=$1", [
        c.teams[0]!.members[0],
      ])
    ).rows[0].display_name as string;
    await section
      .getByRole("button", { name: `Block ${member}`, exact: true })
      .click();
    await confirm();
    await expect(dialog).not.toBeVisible();
    await expect(
      section.getByRole("button", { name: `Unblock ${member}`, exact: true }),
    ).toBeEnabled();
    await section
      .getByRole("button", { name: `Unblock ${member}`, exact: true })
      .click();
    await confirm();
    await expect(dialog).not.toBeVisible();
    await expect(
      section.getByRole("button", { name: `Block ${member}`, exact: true }),
    ).toBeEnabled();
    let posts = 0;
    await page.route("**/api/v1/staff/discipline", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      posts++;
      await route.fetch();
      await route.abort("failed");
    });
    await section
      .getByRole("button", { name: "Add time penalty", exact: true })
      .click();
    await dialog.getByLabel("Penalty minutes").fill("13");
    await confirm();
    await expect(
      dialog.getByRole("button", { name: "Check outcome", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "monitor", exact: true }),
    ).toBeDisabled();
    await c.budgets();
    await dialog
      .getByRole("button", { name: "Check outcome", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    assert.equal(posts, 1);
    await expect(
      section.getByRole("heading", {
        name: "Manual time: 13 / 300 min",
        exact: true,
      }),
    ).toBeVisible();
    await page.unroute("**/api/v1/staff/discipline");
    await page.screenshot({
      path: "test-results/discipline-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/discipline-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        "document.documentElement.scrollWidth <= innerWidth + 1",
      ),
    );
    assert.deepEqual(errors, []);
    const other = await browser.newContext();
    try {
      await other.addCookies([
        {
          name: cookieName,
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
        p.getByRole("button", { name: "discipline", exact: true }),
      ).not.toBeVisible();
    } finally {
      await other.close();
    }
  } finally {
    await context.close();
  }
}
