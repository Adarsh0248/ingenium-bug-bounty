import { test, expect, type Page } from "@playwright/test";

const bounty = "00000000-0000-4000-8000-000000000100";
const code = (page: Page) =>
  page.getByRole("textbox", { name: "Your private code", exact: true });
const reset = (page: Page) =>
  page.getByRole("button", { name: "Reset code", exact: true });
const confirmation = (page: Page) =>
  page.getByRole("dialog", { name: "Reset to original code?", exact: true });

async function enter(page: Page, language = "cpp") {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption(language);
  await page
    .getByRole("button", { name: "Confirm and enter", exact: true })
    .click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}
async function open(page: Page, id = bounty) {
  await page.locator(`[data-map-bounty="${id}"]`).click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(code(page)).not.toHaveValue("");
}
async function save(page: Page, source: string) {
  await code(page).fill(source);
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("saved");
}
async function restore(page: Page) {
  await reset(page).click();
  await confirmation(page)
    .getByRole("button", { name: "Restore original code", exact: true })
    .click();
  await expect(confirmation(page)).toHaveCount(0);
  await expect(page.locator(".save-status")).toHaveText("saved");
}

for (const language of ["c", "cpp", "java", "python"]) {
  test(`${language}: cancel preserves edits; confirmed reset restores and persists the original language-specific code`, async ({
    page,
  }) => {
    await enter(page, language);
    await open(page);
    const original = await code(page).inputValue(),
      changed = `${original}\nparticipant changes`;
    await save(page, changed);
    const writes: string[] = [];
    let judging = 0;
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      if (request.url().endsWith("/draft"))
        writes.push(request.postDataJSON().source);
      if (/\/(runs|submissions)$/.test(request.url())) judging++;
    });
    await reset(page).click();
    await expect(code(page)).toHaveValue(changed);
    await confirmation(page)
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(reset(page)).toBeFocused();
    await expect(code(page)).toHaveValue(changed);
    expect(writes).toEqual([]);
    await restore(page);
    await expect(code(page)).toHaveValue(original);
    expect(writes).toEqual([original]);
    expect(judging).toBe(0);
    await page.reload();
    await expect(
      page.getByText("STATE VERIFIED", { exact: true }),
    ).toBeVisible();
    await open(page);
    await expect(code(page)).toHaveValue(original);
    await expect(page.locator(".save-status")).toHaveText("saved");
  });
}

test("reset affects only the current question's private draft", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  await save(page, "first question's retained work");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  const other = (await page
    .locator("button.target")
    .nth(1)
    .getAttribute("data-bounty-id"))!;
  await open(page, other);
  const original = await code(page).inputValue();
  await save(page, "second question's discarded work");
  await restore(page);
  await expect(code(page)).toHaveValue(original);
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await open(page);
  await expect(code(page)).toHaveValue("first question's retained work");
});

test("failed or mismatched starter reads never replace the draft and can be retried", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  const original = await code(page).inputValue();
  await save(page, "keep this draft after a failed reset");
  const valid = { bounty_id: bounty, language: "cpp", source: original };
  let response: unknown = null;
  await page.route(`**/bounties/${bounty}/starter`, async (route) => {
    if (response === null) await route.abort();
    else
      await route.fulfill({
        json: { schema_version: 1, trace_id: "reset-fixture", data: response },
      });
  });
  for (const invalid of [
    null,
    { ...valid, bounty_id: "another-question" },
    { ...valid, language: "python" },
    { ...valid, source: null },
    { ...valid, source: "\ud800" },
    { ...valid, source: "x".repeat(131073) },
  ]) {
    response = invalid;
    await reset(page).click();
    await expect(page.locator(".workbench-error")).toBeVisible();
    await expect(reset(page)).toBeEnabled();
    await expect(confirmation(page)).toHaveCount(0);
    await expect(code(page)).toHaveValue(
      "keep this draft after a failed reset",
    );
  }
  await page.unroute(`**/bounties/${bounty}/starter`);
  await restore(page);
  await expect(code(page)).toHaveValue(original);
});

test("conflict, pause during confirmation and a live claim cannot discard current code", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  await code(page).fill("local work before a competing revision");
  await page.request.post("/api/v1/_fixture", {
    data: { action: "remote-draft", bounty, source: "other tab's copy" },
  });
  await expect(page.locator(".save-status")).toHaveText("conflict");
  await expect(reset(page)).toBeDisabled();
  await page.getByRole("button", { name: "Review competing draft" }).click();
  await page.getByRole("button", { name: "Keep my copy", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("saved");
  await reset(page).click();
  await expect(confirmation(page)).toBeVisible();
  await page.request.post("/api/v1/_fixture", { data: { action: "pause" } });
  await expect(
    confirmation(page).getByRole("button", {
      name: "Restore original code",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(code(page)).toHaveValue(
    "local work before a competing revision",
  );
  await page.keyboard.press("Escape");
  await expect(confirmation(page)).toHaveCount(0);
  await expect(reset(page)).toBeDisabled();
  await page.request.post("/api/v1/_fixture", { data: { action: "resume" } });
  await expect(reset(page)).toBeEnabled();
  await page.request.post("/api/v1/_fixture", {
    data: { action: "claim", bounty },
  });
  await expect(code(page)).toHaveAttribute("readonly");
  await expect(reset(page)).toBeDisabled();
  await expect(code(page)).toHaveValue(
    "local work before a competing revision",
  );
});

test("a lost reset-save reply uses existing outcome recovery without a duplicate write", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  const original = await code(page).inputValue();
  await save(page, "saved code before resetting");
  let writes = 0,
    release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/bounties/${bounty}/draft/outcomes/*`, (route) =>
    route.abort(),
  );
  await page.route(`**/bounties/${bounty}/draft`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++;
    await route.fetch();
    await held;
    await route.abort();
  });
  await reset(page).click();
  await confirmation(page)
    .getByRole("button", { name: "Restore original code", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("saving");
  await expect(reset(page)).toBeDisabled();
  release();
  await expect(page.locator(".save-status")).toHaveText("unresolved");
  await expect(reset(page)).toBeDisabled();
  await expect(code(page)).toHaveValue(original);
  await page.unroute(`**/bounties/${bounty}/draft/outcomes/*`);
  await expect(page.locator(".save-status")).toHaveText("saved");
  await expect(reset(page)).toBeEnabled();
  expect(writes).toBe(1);
});

test("reset updates Monaco and the plain editor and fits small-screen keyboard confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await open(page);
  const original = await code(page).inputValue();
  await page.getByRole("button", { name: "Code editor", exact: true }).click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(
    "// edited Monaco reset fixture\nint main() {}\n",
  );
  await expect(page.locator(".save-status")).toHaveText("saved");
  await expect(reset(page)).toBeInViewport();
  await reset(page).click();
  await expect(confirmation(page)).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      confirmation(page).getByRole("button", {
        name: "Restore original code",
        exact: true,
      }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "test-results/reset-mobile.png" });
  const confirm = confirmation(page).getByRole("button", {
    name: "Restore original code",
    exact: true,
  });
  await confirm.focus();
  await confirm.press("Enter");
  await expect(page.locator(".save-status")).toHaveText("saved");
  await expect(page.locator(".monaco-editor .view-lines")).not.toContainText(
    "edited Monaco reset fixture",
  );
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(code(page)).toHaveValue(original);
  await page.screenshot({ path: "test-results/reset-restored-mobile.png" });
});
