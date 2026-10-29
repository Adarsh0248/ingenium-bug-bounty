import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import type { Browser } from "@playwright/test";
import type { Pool } from "pg";
import { openStaffView } from "./browser-app.js";

export async function adminSetupBrowserChecks(
  browser: Browser,
  origin: string,
  cookieName: string,
  c: {
    owner: Pool;
    organiser: { sessionCookie: string; code: string };
    root: { sessionCookie: string };
    budgets(): Promise<void>;
  },
) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  await context.addCookies([
    {
      name: cookieName,
      value: c.organiser.sessionCookie,
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = async () =>
    (
      await c.owner.query(
        "SELECT r.* FROM rounds r JOIN arena_control a ON a.current_instance_id=r.arena_instance_id WHERE r.kind=1",
      )
    ).rows[0];
  const form = () => page.locator(".staff-access-form");
  try {
    await c.budgets();
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: "Create arena", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Duration (minutes)")).toHaveValue("180");
    await openStaffView(page, "Teams");
    await page
      .getByRole("button", { name: "Add team manually", exact: true })
      .click();
    await form()
      .getByLabel("Team name", { exact: true })
      .fill("Manual admin team");
    await form().getByLabel("Member 1 name").fill("First member");
    await form().getByLabel("Member 2 name").fill("Second member");
    await expect(
      form().getByLabel("Your staff code", { exact: true }),
    ).toHaveCount(0);
    await c.budgets();
    await form()
      .getByRole("button", { name: "Create team", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName("New team code");
    assert.match(
      await dialog.getByLabel("Issued team code").inputValue(),
      /^[A-Z2-7]{8}$/,
    );
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(
      (
        await c.owner.query(
          "SELECT count(*)::int n FROM teams WHERE display_name='Manual admin team'",
        )
      ).rows[0].n,
      1,
    );

    await page
      .getByRole("button", { name: "Edit team Manual admin team", exact: true })
      .click();
    await form().getByLabel("Member 1 name").fill("Updated first member");
    await c.budgets();
    await form()
      .getByRole("button", { name: "Save team details", exact: true })
      .click();
    await expect(form()).toHaveCount(0);
    await expect(
      page.getByText("Team details saved. Its login code is unchanged.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add team manually", exact: true })
      .click();
    await form()
      .getByLabel("Team name", { exact: true })
      .fill("Delete demo team");
    await form().getByLabel("Member 1 name").fill("Demo one");
    await form().getByLabel("Member 2 name").fill("Demo two");
    await c.budgets();
    await form()
      .getByRole("button", { name: "Create team", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Delete team Delete demo team",
        exact: true,
      })
      .click();
    await form()
      .getByRole("button", { name: "Review deletion", exact: true })
      .click();
    await expect(dialog).toContainText("past results will be retained");
    await c.budgets();
    await dialog
      .getByRole("button", { name: "Confirm team change", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Delete team Delete demo team",
        exact: true,
      }),
    ).toHaveCount(0);
    assert.ok(
      (
        await c.owner.query(
          "SELECT deleted_at FROM teams WHERE display_name='Delete demo team'",
        )
      ).rows[0].deleted_at,
    );

    await openStaffView(page, "Questions");
    await page
      .getByRole("button", { name: "Add question manually", exact: true })
      .click();
    await page
      .getByLabel("Title", { exact: true })
      .fill("Manual admin question");
    await page
      .getByLabel("Statement", { exact: true })
      .fill(
        "Read two integers and print their sum. The starter subtracts instead of adding.",
      );
    await c.budgets();
    await form()
      .getByRole("button", { name: "Save question & add code", exact: true })
      .click();
    await expect(form()).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Language", { exact: true })).toBeVisible();
    assert.deepEqual(
      await page
        .getByLabel("Language", { exact: true })
        .locator("option")
        .evaluateAll((options) =>
          options.map((option) => option.getAttribute("value")),
        ),
      ["c", "cpp", "java", "python"],
    );
    await page
      .getByRole("button", { name: "Edit language variant", exact: true })
      .click();
    const starter = "int main() { return 1; }\n",
      reference = "int main() { return 0; }\n";
    await form().getByLabel("Starter code", { exact: true }).fill(starter);
    await form()
      .getByLabel("Reference solution", { exact: true })
      .fill(reference);
    await c.budgets();
    await form()
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(form()).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    const question = (
      await c.owner.query(
        "SELECT id,publication_status FROM bug_versions WHERE title='Manual admin question'",
      )
    ).rows[0];
    assert.equal(question.publication_status, "DRAFT");
    assert.ok(
      (
        await c.owner.query(
          "SELECT reason FROM content_outcomes WHERE result_version_id=$1",
          [question.id],
        )
      ).rows.every((row) => row.reason.trim()),
    );

    await openStaffView(page, "Arena setup");
    await page
      .getByRole("checkbox", {
        name: "Select team Manual admin team",
        exact: true,
      })
      .check();
    await c.budgets();
    await page
      .getByRole("button", { name: "Create arena", exact: true })
      .click();
    await expect.poll(async () => Boolean(await state())).toBe(true);
    await expect(
      page.getByRole("button", { name: "Save arena settings", exact: true }),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);
    const id = (await state()).id;
    const teamId = (
      await c.owner.query(
        "SELECT id FROM teams WHERE display_name='Manual admin team'",
      )
    ).rows[0].id;
    const bootstrap = await page.request.get(
      `${origin}/api/v1/bootstrap?audience=STAFF`,
    );
    const csrf = (await bootstrap.json()).data.csrf_token;
    await c.budgets();
    const refused = await page.request.post(
      `${origin}/api/v1/staff/teams/${teamId}/delete`,
      {
        data: {
          request_key: crypto.randomUUID(),
          expected_revision: (
            await c.owner.query(
              "SELECT revision FROM security_control WHERE id=1",
            )
          ).rows[0].revision,
          reason: "Attempt to remove a selected draft team",
        },
        headers: { Origin: origin, "x-csrf-token": csrf },
      },
    );
    assert.equal(refused.status(), 200);
    assert.equal((await refused.json()).data.outcome.reason, "TEAM_IN_USE");
    await page.getByLabel("Duration (minutes)").fill("120");
    await c.budgets();
    await page
      .getByRole("button", { name: "Save arena settings", exact: true })
      .click();
    await expect.poll(async () => (await state()).duration_ms).toBe("7200000");
    assert.equal((await state()).id, id);
    await openStaffView(page, "Round questions");
    await expect(
      page.getByRole("checkbox", { name: /^Select bug/ }).first(),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: /^Select bug/ })
      .first()
      .check();
    await c.budgets();
    await page
      .getByRole("button", { name: "Save round questions", exact: true })
      .click();
    await expect(
      page.getByText("Unsaved selection", { exact: true }),
    ).toHaveCount(0);
    await c.budgets();
    await page
      .getByRole("button", { name: "Prepare configuration", exact: true })
      .click();
    await expect.poll(async () => (await state()).state).toBe("READY");
    await openStaffView(page, "Arena setup");
    await page.getByLabel("Duration (minutes)").fill("180");
    await c.budgets();
    await page
      .getByRole("button", { name: "Save arena settings", exact: true })
      .click();
    await expect.poll(async () => (await state()).state).toBe("DRAFT");
    assert.equal((await state()).duration_ms, "10800000");
    assert.equal((await state()).started_at, null);
    assert.equal(
      (
        await page.request.get(`${origin}/api/v1/staff/staff-identities`)
      ).status(),
      403,
    );
    await page.screenshot({
      path: "test-results/admin-setup-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate<boolean>(
        "document.documentElement.scrollWidth <= innerWidth",
      ),
    );
    await page.screenshot({
      path: "test-results/admin-setup-mobile.png",
      fullPage: true,
    });
    const rootContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    });
    try {
      await rootContext.addCookies([
        {
          name: cookieName,
          value: c.root.sessionCookie,
          url: origin,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      const rootPage = await rootContext.newPage();
      await c.budgets();
      await rootPage.goto(origin);
      await openStaffView(rootPage, "Staff");
      await rootPage
        .getByRole("button", { name: "Add staff", exact: true })
        .click();
      await rootPage
        .getByLabel("Staff name", { exact: true })
        .fill("Session-authorised admin");
      await rootPage
        .getByRole("button", { name: "Review access change", exact: true })
        .click();
      const confirmation = rootPage.getByRole("dialog", {
        name: "Confirm access change",
        exact: true,
      });
      await expect(confirmation.getByLabel("Your staff code")).toHaveCount(0);
      await c.budgets();
      await confirmation
        .getByRole("button", { name: "Confirm access change", exact: true })
        .click();
      const issued = rootPage.getByRole("dialog", {
        name: "New staff code",
        exact: true,
      });
      await expect(issued).toBeVisible();
      await issued.getByRole("button", { name: "Done", exact: true }).click();
      assert.equal(
        (
          await c.owner.query(
            "SELECT role FROM staff_identities WHERE display_name='Session-authorised admin'",
          )
        ).rows[0].role,
        "ORGANISER",
      );
    } finally {
      await rootContext.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
