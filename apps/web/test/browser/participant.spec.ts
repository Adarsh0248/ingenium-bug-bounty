import { test, expect } from "@playwright/test";
const bounty = "00000000-0000-4000-8000-000000000100";
async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha" }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page.getByRole("button", { name: "Confirm and enter" }).click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}
async function open(page: import("@playwright/test").Page) {
  await page.locator(`[data-map-bounty="${bounty}"]`).focus();
  await page.locator(`[data-map-bounty="${bounty}"]`).press("Enter");
  if (
    (await page
      .locator(`[data-map-bounty="${bounty}"]`)
      .getAttribute("data-cleared")) !== "true"
  )
    await page
      .getByRole("button", { name: "Open question", exact: true })
      .click();
  await expect(
    page.getByRole("heading", { name: "The silent overflow", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Your private code", exact: true }),
  ).toBeVisible();
}

test("an expired demo session returns to code entry and re-enters with a fresh expiry and saved draft", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  const source = "// saved before preview expiry\nint main() { return 0; }\n";
  await page
    .getByRole("textbox", { name: "Your private code", exact: true })
    .fill(source);
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("saved");
  await page.request.post("/api/v1/_fixture", { data: { action: "expire" } });
  await expect(
    page.getByRole("heading", { name: "Session unavailable", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to entry", exact: true })
    .click();
  await expect(page.getByLabel("Team or staff code")).toBeVisible();
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha" }).check();
  await page
    .getByRole("button", { name: "Confirm and enter", exact: true })
    .click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await open(page);
  await expect(
    page.getByRole("textbox", { name: "Your private code", exact: true }),
  ).toHaveValue(source);
  await expect(
    page.getByRole("heading", { name: "Session unavailable", exact: true }),
  ).toHaveCount(0);
});

test("a failed challenge read can be retried without discarding its private draft", async ({
  page,
}) => {
  await enter(page);
  await page.route(`**/bounties/${bounty}/statement`, async (route) => {
    await route.abort();
  });
  await open(page);
  const code = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await expect(code).not.toHaveValue("");
  let saves = 0;
  await page.route(`**/bounties/${bounty}/draft`, async (route) => {
    if (route.request().method() === "POST") {
      saves++;
      await route.abort();
    } else await route.continue();
  });
  const local =
    "// unsaved during challenge recovery\n" + (await code.inputValue());
  await code.fill(local);
  await expect(page.locator(".save-status")).toHaveText("unresolved");
  await page.unroute(`**/bounties/${bounty}/statement`);
  await page.getByRole("button", { name: "Retry challenge" }).click();
  await expect(
    page.getByText("Repair the program", { exact: false }),
  ).toBeVisible();
  await expect(code).toHaveValue(local);
  expect(saves).toBe(1);
  await expect(
    page.getByRole("button", { name: "Submit fix", exact: true }),
  ).toBeEnabled();
});

test("question reports attach a submitted answer and recover a lost receipt without another POST", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  await page
    .getByRole("textbox", { name: "Your private code", exact: true })
    .fill("// fixed answer\nint main(){return 0;}\n");
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Target cleared", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Report question", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Report question",
    exact: true,
  });
  await expect(modal.getByLabel("Reported submission")).not.toHaveValue("");
  await modal
    .getByLabel("Question report details")
    .fill("Preview glitch report with attached answer");
  let posts = 0;
  await page.route(`**/bounties/${bounty}/report`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    posts++;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await modal
    .getByRole("button", { name: "Raise ticket", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Check original report", exact: true })
    .click();
  await expect(
    modal.getByText("Preview glitch report with attached answer", {
      exact: true,
    }),
  ).toBeVisible();
  expect(posts).toBe(1);
  await expect(
    modal.getByText("Attached submission:", { exact: false }),
  ).toBeVisible();
  await modal
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Report question", exact: true })
    .click();
  await expect(
    modal.getByText("Preview glitch report with attached answer", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "Raise ticket", exact: true }),
  ).toHaveCount(0);
});

test("verdict polling recovers a failed GET without sending another run", async ({
  page,
}) => {
  let failNext = false,
    failed = 0,
    posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/runs")) posts++;
  });
  await page.route("**/judging/*", async (route) => {
    if (failNext) {
      failNext = false;
      failed++;
      await route.abort();
    } else await route.continue();
  });
  await enter(page);
  await open(page);
  await page.getByRole("button", { name: /Run samples/ }).click();
  await expect(page.locator(".feedback-heading")).toContainText("queued");
  failNext = true;
  await expect.poll(() => failed).toBe(1);
  await expect(page.locator(".feedback-heading")).toContainText("passed", {
    timeout: 12000,
  });
  expect(posts).toBe(1);
});

test("a missing code-editor chunk falls back to an editable draft and still obeys live read-only gates", async ({
  page,
}) => {
  await page.route("**/src/CodeEditor.tsx*", (route) => route.abort());
  await enter(page);
  await page.locator(`[data-map-bounty="${bounty}"]`).focus();
  await page.locator(`[data-map-bounty="${bounty}"]`).press("Enter");
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  const code = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await expect(
    page.getByRole("status").filter({ hasText: "code editor unavailable" }),
  ).toBeVisible();
  await expect(code).toHaveValue(/long long a, b/);
  await code.fill(
    "// retained through editor failure\nint main() { return 0; }\n",
  );
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("saved");
  await page.request.post("/api/v1/_fixture", { data: { action: "pause" } });
  await expect(code).toHaveAttribute("readonly", "");
  await expect(code).toHaveValue(/retained through editor failure/);
  await page.request.post("/api/v1/_fixture", { data: { action: "resume" } });
  await expect(code).toBeEditable();
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await page.locator(`[data-map-bounty="${bounty}"]`).focus();
  await page.locator(`[data-map-bounty="${bounty}"]`).press("Enter");
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(code).toHaveValue(/retained through editor failure/);
});

test("a run with no initial feedback response recovers by its known receipt and stops polling on close", async ({
  page,
}) => {
  let blocked = true,
    reads = 0,
    posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/runs")) posts++;
  });
  await page.route("**/judging/*", async (route) => {
    reads++;
    if (blocked) await route.abort();
    else await route.continue();
  });
  await enter(page);
  await open(page);
  await page.getByRole("button", { name: /Run samples/ }).click();
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  blocked = false;
  await expect(page.locator(".feedback-heading")).toContainText("passed", {
    timeout: 12000,
  });
  expect(posts).toBe(1);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "judge-delay", ms: 10000 },
  });
  await page.getByRole("button", { name: /Run samples/ }).click();
  await expect(page.locator(".feedback-heading")).toContainText("queued");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  const closedReads = reads;
  await page.waitForTimeout(2500);
  expect(reads).toBe(closedReads);
  expect(posts).toBe(2);
});

test("a failed terminal capacity read recovers the verdict and run allowance without another action", async ({
  page,
}) => {
  let failedReads = 0,
    posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/runs")) posts++;
  });
  await enter(page);
  await open(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "judge-delay", ms: 3000 },
  });
  await page.getByRole("button", { name: /Run samples/ }).click();
  await expect(page.locator(".feedback-heading")).toContainText("queued");
  await expect(
    page.getByRole("button", { name: /Scanning samples 1\/2/ }),
  ).toBeVisible();
  await page.route(`**/bounties/${bounty}`, async (route) => {
    failedReads++;
    await route.abort();
  });
  await expect
    .poll(() => failedReads, { timeout: 15000 })
    .toBeGreaterThanOrEqual(2);
  await page.unroute(`**/bounties/${bounty}`);
  await expect(page.locator(".feedback-heading")).toContainText("passed", {
    timeout: 12000,
  });
  await expect(
    page.getByRole("button", { name: "Run samples 0/2", exact: true }),
  ).toBeEnabled();
  expect(posts).toBe(1);
});

test("a paid hint with a failed content read is recovered without a second purchase or draft replacement", async ({
  page,
}) => {
  let purchases = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith(`/bounties/${bounty}/hints`)
    )
      purchases++;
  });
  await enter(page);
  await open(page);
  const code = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await code.fill("// keep my hint investigation\n");
  await page.getByRole("button", { name: /^hints/ }).click();
  await page.route(`**/bounties/${bounty}/hints`, async (route) => {
    if (route.request().method() === "GET") await route.abort();
    else await route.continue();
  });
  await page
    .locator(".hint")
    .first()
    .getByRole("button", { name: "Purchase hint" })
    .click();
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "hints 1/3", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hint").first()).toContainText(
    "Purchased / content pending",
  );
  await expect(
    page
      .locator(".hint")
      .first()
      .getByRole("button", { name: "Purchase hint" }),
  ).toHaveCount(0);
  await expect(page.locator(".hud-score.wallet strong")).toHaveText("1,165");
  await page.unroute(`**/bounties/${bounty}/hints`);
  await page
    .getByRole("button", { name: "Retry challenge", exact: true })
    .click();
  await expect(
    page.getByText("Check the arithmetic operation on the two inputs.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(code).toHaveValue("// keep my hint investigation\n");
  await expect(page.locator(".hud-score.wallet strong")).toHaveText("1,165");
  expect(purchases).toBe(1);
});

test("terrain rendering failure preserves keyboard capture and private editing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: any[]
    ) {
      if (kind.includes("webgl")) return null;
      return original.call(this, kind as any, ...args);
    } as typeof original;
  });
  await enter(page);
  const target = page.locator(`[data-map-bounty="${bounty}"]`);
  await target.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "The silent overflow", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your private code", exact: true })
    .fill("// accessible without WebGL\n");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await expect(target).toBeFocused();
});

test("keyboard target entry focuses the workbench and closing returns to the same bounty", async ({
  page,
}) => {
  await enter(page);
  const target = page.locator(`[data-map-bounty="${bounty}"]`);
  await target.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "The silent overflow", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close workbench" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".workbench")).toHaveCount(0);
  await expect(target).toBeFocused();
});

test("team score and ranking remain visible in full and minimised HUDs at every viewport", async ({
  page,
}) => {
  await enter(page);
  const hud = page.getByRole("region", { name: "Team HUD" });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    for (const compact of [false, true]) {
      if (compact)
        await hud.getByRole("button", { name: "Minimise HUD" }).click();
      await expect(
        hud.getByText("Segfault Society", { exact: true }),
      ).toBeInViewport();
      await expect(hud.locator(".hud-score:not(.wallet) strong")).toHaveText(
        "1,350",
      );
      await expect(hud.locator(".hud-rank strong")).toBeInViewport();
      await expect(hud.locator(".hud-rank strong")).toHaveText("#2");
      expect(
        await hud.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      if (viewport.width === 390)
        await page.screenshot({
          path: `test-results/hud-${compact ? "compact" : "full"}-mobile.png`,
        });
      if (compact)
        await hud.getByRole("button", { name: "Expand HUD" }).click();
    }
  }
});

test("synthetic preview history retains original attempts and purchased hints without changing the editor", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  const editor = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await editor.fill("// frozen sample source\nint main() {}\n");
  await page.getByRole("button", { name: /Run samples/ }).click();
  await expect(page.locator(".feedback-heading")).toContainText("passed");
  await editor.fill("// newer saved draft\nint main() { return 0; }\n");
  await expect(page.locator(".save-status")).toHaveText("saved");
  await page.getByRole("button", { name: /^hints/ }).click();
  await page
    .getByRole("button", { name: "Purchase hint", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(page.locator(".hint").first()).toContainText(
    "Check the arithmetic operation",
  );
  await page.getByRole("button", { name: "Close workbench" }).click();
  await page
    .getByRole("button", { name: "Results and history", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Results & history" });
  await dialog.getByRole("button", { name: "attempts", exact: true }).click();
  await dialog
    .getByRole("button", { name: "View attempt", exact: true })
    .click();
  await expect(dialog.locator(".source-review")).toHaveText(
    "// frozen sample source\nint main() {}\n",
  );
  await dialog.getByRole("button", { name: "Back to history" }).click();
  await dialog.getByRole("button", { name: "wallet", exact: true }).click();
  await expect(dialog.getByText("-35 CR", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "saved work", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Review saved work" })
    .first()
    .click();
  await expect(dialog.locator(".source-review")).toContainText(
    "newer saved draft",
  );
  await expect(
    dialog.getByText("Check the arithmetic operation on the two inputs.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await open(page);
  await expect(editor).toHaveValue(
    "// newer saved draft\nint main() { return 0; }\n",
  );
});
test("real browser entry, Monaco, private autosave, target navigation and acknowledged restoration", async ({
  page,
}) => {
  await enter(page);
  await page.screenshot({ path: "test-results/arena-desktop.png" });
  await open(page);
  const editor = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await editor.fill(
    "// exact private draft\n#include <iostream>\nint main() {}\n",
  );
  await expect(page.locator(".save-status")).toHaveText("saved");
  await page.getByRole("button", { name: "Close workbench" }).click();
  await open(page);
  await expect(editor).toHaveValue(/exact private draft/);
  await page.screenshot({ path: "test-results/workbench-desktop.png" });
  await page.reload();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await open(page);
  await expect(editor).toHaveValue(/exact private draft/);
});
test("public sample runs and sequential purchases use separate explicit commands", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  await page.getByRole("button", { name: /Run samples/ }).click();
  await expect(page.locator(".feedback-heading")).toContainText("passed");
  await page.getByRole("button", { name: "hints 0/3" }).click();
  await expect(page.locator(".hint").nth(1).getByRole("button")).toBeDisabled();
  await page
    .getByRole("button", { name: "Purchase hint", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm purchase" }).click();
  await expect(page.locator(".hint").first()).toContainText(
    "Check the arithmetic",
  );
  await expect(page.locator(".hint").nth(1).getByRole("button")).toBeEnabled();
  await expect(page.locator(".hud .wallet")).toContainText("1,165");
});
test("an authoritative pause and claim retain current code and disable new gameplay", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  const editor = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await editor.fill("unsaved text kept");
  await page.request.post("/api/v1/_fixture", { data: { action: "pause" } });
  await expect(
    page.getByText("Your actions are paused", { exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveValue("unsaved text kept");
  await expect(editor).toHaveAttribute("readonly");
  await expect(page.getByRole("button", { name: /Submit fix/ })).toBeDisabled();
  await page.request.post("/api/v1/_fixture", { data: { action: "resume" } });
  await expect(editor).not.toHaveAttribute("readonly");
  await page.request.post("/api/v1/_fixture", {
    data: { action: "claim", bounty },
  });
  await expect(
    page.getByText("TARGET CLEARED. Bounty claimed; your code is retained."),
  ).toBeVisible();
  await expect(editor).toHaveValue("unsaved text kept");
  await page.getByRole("button", { name: "Close workbench" }).click();
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await expect(page.locator(`[data-bounty-id="${bounty}"]`)).toContainText(
    "CLEARED / READ ONLY",
  );
});

test("pending sample scans stay visible across IDE navigation without claiming a bounty", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "judge-delay", ms: 7000 },
  });
  await page.getByRole("button", { name: /Run samples/ }).click();
  const scanning = page.getByRole("button", { name: /Scanning samples/ });
  await expect(scanning).toHaveAttribute("aria-busy", "true");
  await expect(scanning).toContainText("1/2");
  await expect(scanning).toBeEnabled();
  await scanning.click();
  await expect(scanning).toContainText("2/2");
  await expect(scanning).toBeDisabled();
  await expect(
    page.getByText("Sample scan active. Awaiting test results."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close workbench" }).click();
  await open(page);
  await expect(scanning).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".feedback-heading")).toContainText("passed");
  await expect(page.getByRole("button", { name: /Run samples/ })).toBeEnabled();
  await expect(page.locator(`[data-bounty-id="${bounty}"]`)).toHaveAttribute(
    "data-cleared",
    "false",
  );
});

test("a solved target waits for IDE exit, terminates visibly once and remains read only", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "judge-delay", ms: 6000 },
  });
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  const validating = page.getByRole("button", {
    name: "Validating fix",
    exact: true,
  });
  await expect(validating).toHaveAttribute("aria-busy", "true");
  await expect(validating).toBeDisabled();
  await expect(
    page.getByText("Fix uplink active. Awaiting official verdict."),
  ).toBeVisible();
  await expect(page.locator(".cleared-notice")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Target cleared", exact: true }),
  ).toBeDisabled();
  await page.waitForTimeout(2600);
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await page.screenshot({ path: "test-results/cleared-ide.png" });
  await page.getByRole("button", { name: "Close workbench" }).click();
  await expect(page.locator(".field-weapon")).toHaveClass(/firing/);
  await expect(
    page.getByText("TARGET TERMINATED", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".termination-banner")).toBeVisible();
  await page.screenshot({ path: "test-results/termination-desktop.png" });
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  const cleared = page.locator(`[data-bounty-id="${bounty}"]`);
  await expect(cleared).toHaveAttribute("data-cleared", "true");
  await expect(cleared).toContainText("CLEARED / READ ONLY");
  await cleared.click();
  await expect(
    page.getByRole("button", { name: "Target cleared", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close workbench" }).click();
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await expect(cleared).toHaveAttribute("data-cleared", "true");
});

test("reduced-motion participants receive a visible cleared confirmation after IDE exit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await open(page);
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(page.locator(".cleared-notice")).toBeVisible();
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Close workbench" }).click();
  await expect(
    page.getByText("TARGET TERMINATED", { exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/termination-mobile.png" });
});
test("competing revision and malicious statement stay reviewable text, not executable HTML", async ({
  page,
}) => {
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: {
      action: "statement",
      text: '<img src=x onerror="window.__xss=1"> statement\n\nInput\nRead `n`, the number of values.\n\nOutput\nPrint `n < 5`.',
    },
  });
  await open(page);
  await expect(page.locator(".statement")).toContainText("<img");
  expect(await page.locator(".statement img").count()).toBe(0);
  await expect(page.locator(".statement h4")).toHaveText(["Input", "Output"]);
  await expect(page.locator(".statement code")).toHaveText(["n", "n < 5"]);
  const editor = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await editor.fill("local changes");
  await page.request.post("/api/v1/_fixture", {
    data: { action: "remote-draft", bounty, source: "other tab copy" },
  });
  await expect(page.locator(".save-status")).toHaveText("conflict");
  await expect(editor).toHaveValue("local changes");
  await page.getByRole("button", { name: "Review competing draft" }).click();
  await expect(page.getByRole("dialog")).toContainText("other tab copy");
  await page.getByRole("button", { name: "Keep my copy" }).click();
  await expect(editor).toHaveValue("local changes");
});
test("unknown submission response reconciles the original action without an automatic duplicate POST", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  let submissions = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/submissions"))
      submissions++;
  });
  await page.request.post("/api/v1/_fixture", { data: { action: "drop" } });
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(
    page.getByText("Previous action outcome unknown. No automatic retry."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check original action" }).click();
  await expect(
    page.getByText("Previous action outcome unknown. No automatic retry."),
  ).not.toBeVisible();
  expect(submissions).toBe(1);
});
test("keyboard/reduced-motion and mobile layouts retain equivalent target/editor actions without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.screenshot({ path: "test-results/arena-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await open(page);
  await page
    .getByRole("textbox", { name: "Your private code", exact: true })
    .fill("mobile draft");
  await page.screenshot({ path: "test-results/workbench-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Close workbench" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: /Run samples/ }),
  ).toBeInViewport();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("revoked access clears private UI rather than keeping an editable source panel", async ({
  page,
}) => {
  await enter(page);
  await open(page);
  await page
    .getByRole("textbox", { name: "Your private code", exact: true })
    .fill("private revoked source");
  await page.request.post("/api/v1/_fixture", { data: { action: "revoke" } });
  await expect(
    page.getByRole("heading", { name: "Session unavailable" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("textbox", { name: "Your private code", exact: true }),
  ).not.toBeVisible();
});
test("the actual Monaco editor accepts keyboard text and acknowledges its own snapshot without a page error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enter(page);
  await page.locator(`[data-map-bounty="${bounty}"]`).focus();
  await page.locator(`[data-map-bounty="${bounty}"]`).press("Enter");
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(
    "// Monaco keyboard fixture\nint main() { return 0; }\n",
  );
  await expect(page.locator(".save-status")).toHaveText("saved");
  await page.screenshot({ path: "test-results/monaco-desktop.png" });
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Your private code", exact: true }),
  ).toHaveValue(/Monaco keyboard fixture/);
  expect(errors).toEqual([]);
});
