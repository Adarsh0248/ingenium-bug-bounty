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
  await page.getByRole("button", { name: /01 The silent overflow/ }).click();
  await expect(
    page.getByRole("heading", { name: "The silent overflow", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Your private code", exact: true }),
  ).toBeVisible();
}

test("keyboard target entry focuses the workbench and closing returns to the same bounty", async ({
  page,
}) => {
  await enter(page);
  const target = page.getByRole("button", { name: /01 The silent overflow/ });
  await target.focus();
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
    data: { action: "judge-delay", ms: 1500 },
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
  const beam = await page.waitForFunction(
    () => {
      const canvas = document.querySelector("canvas");
      const gl = canvas?.getContext("webgl2");
      if (!canvas || !gl) return false;
      const width = Math.min(160, canvas.width),
        height = Math.min(160, canvas.height);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(
        Math.floor((canvas.width - width) / 2),
        0,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      let white = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] > 210 && pixels[i + 1] > 235 && pixels[i + 2] > 225)
          white++;
      return white > 8 ? canvas.toDataURL("image/png") : false;
    },
    undefined,
    { timeout: 8000, polling: "raf" },
  );
  await test.info().attach("visible-aimed-laser", {
    body: Buffer.from(
      ((await beam.jsonValue()) as string).split(",")[1],
      "base64",
    ),
    contentType: "image/png",
  });
  await expect(
    page.getByText("TARGET TERMINATED", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".field-weapon")).toHaveClass(/firing/);
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
      text: '<img src=x onerror="window.__xss=1"> statement',
    },
  });
  await open(page);
  await expect(page.locator(".statement")).toContainText("<img");
  expect(await page.locator(".statement img").count()).toBe(0);
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
test("3D canvas renders distinct nonblank pixels and moves on desktop and mobile", async ({
  page,
}) => {
  await enter(page);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(1000);
    const pixels = () =>
      page.locator("canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const gl = canvas.getContext("webgl2")!;
        const out = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(
          0,
          0,
          canvas.width,
          canvas.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          out,
        );
        let bright = 0,
          hash = 0;
        const colors = new Set<number>();
        for (let n = 0; n < out.length; n += 16) {
          const color = (out[n] << 16) | (out[n + 1] << 8) | out[n + 2];
          colors.add(color);
          if (out[n] > 70 && out[n + 1] > 70) bright++;
          hash = (hash + Math.imul(color, n + 1)) | 0;
        }
        return { colors: colors.size, bright, hash };
      });
    const first = await pixels();
    expect(first.colors).toBeGreaterThan(20);
    expect(first.bright).toBeGreaterThan(100);
    await page.waitForTimeout(700);
    const second = await pixels();
    expect(second.hash).not.toBe(first.hash);
  }
});

test("all forty bounties remain rendered, moving and keyboard reachable on desktop and mobile", async ({
  page,
}) => {
  test.setTimeout(90000);
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "full-field" },
  });
  const targets = page.getByRole("complementary", { name: "Bounty targets" });
  await expect(targets.getByRole("button")).toHaveCount(40);
  const measurements = [];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(1000);
    const inspect = () =>
      page.locator("canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const gl = canvas.getContext("webgl2")!;
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(
          0,
          0,
          canvas.width,
          canvas.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        let hash = 0,
          bright = 0;
        for (let i = 0; i < pixels.length; i += 16) {
          const color =
            (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
          hash = (hash + Math.imul(color, i + 1)) | 0;
          if (pixels[i] > 70 && pixels[i + 1] > 70) bright++;
        }
        return { hash, bright, contextLost: gl.isContextLost() };
      });
    const first = await inspect();
    expect(first.contextLost).toBe(false);
    expect(first.bright).toBeGreaterThan(100);
    await page.waitForTimeout(700);
    expect((await inspect()).hash).not.toBe(first.hash);
    const frame = await page.evaluate(async () => {
      const samples: number[] = [];
      let previous = performance.now();
      for (let i = 0; i < 12; i++) {
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        samples.push(now - previous);
        previous = now;
      }
      return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
    });
    measurements.push({
      ...viewport,
      targets: 40,
      median_frame_ms: frame,
      renderer: "headless-software-test-only",
    });
    await page.screenshot({
      path: `test-results/arena-40-${viewport.width}.png`,
    });
    const last = targets.getByRole("button").last();
    await last.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Race condition / 40", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close workbench" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await test
    .info()
    .attach("forty-target-frame-samples-not-device-calibration", {
      body: Buffer.from(JSON.stringify(measurements)),
      contentType: "application/json",
    });
});

test("the actual Monaco editor accepts keyboard text and acknowledges its own snapshot without a page error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enter(page);
  await page.locator(`[data-bounty-id="${bounty}"]`).click();
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
