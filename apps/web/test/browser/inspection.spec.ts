import { test, expect, type Page } from "@playwright/test";

async function enter(page: Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page
    .getByRole("button", { name: "Confirm and enter", exact: true })
    .click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}
const card = (page: Page) => page.locator(".bug-info-card");
async function pose(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const source = "/test/scene-probe.ts",
      { motionState } = await import(source);
    return motionState([id])[0];
  }, id);
}

test("unsolved list choices locate each real regional bug, pause its pose and preview without capturing", async ({
  page,
}) => {
  let captures = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/bounties\/[^/]+\/open$/.test(new URL(request.url()).pathname)
    )
      captures++;
  });
  await enter(page);
  for (const region of ["neon", "foundry", "verdant", "cryo"]) {
    const target = page
        .locator(`button.target[data-region="${region}"]`)
        .last(),
      id = (await target.getAttribute("data-bounty-id"))!,
      title = await target.locator(".target-copy > strong").innerText();
    await target.click();
    await expect(page.locator(".world-scenery")).toHaveAttribute(
      "data-world-view",
      region,
    );
    await expect(card(page)).toBeVisible();
    await expect(
      card(page).getByRole("heading", { name: title, exact: true }),
    ).toBeFocused();
    await expect(card(page)).toContainText(
      "A telemetry service combines two signed integers.",
    );
    await expect(card(page).locator(".intel-stats")).toContainText(
      "DIFFICULTY",
    );
    await expect(card(page).locator(".tecnoesis-coin")).toBeVisible();
    await expect(page.locator(".workbench")).toHaveCount(0);
    await expect.poll(async () => (await pose(page, id))?.visible).toBe(true);
    const before = (await pose(page, id))!;
    await page.waitForTimeout(450);
    const after = (await pose(page, id))!;
    expect(after.position).toEqual(before.position);
    expect(after.roamer).toEqual(before.roamer);
    await page.screenshot({ path: `test-results/inspect-${region}.png` });
  }
  expect(captures).toBe(0);
});

test("card action and clicking the located map bug both open the correct question", async ({
  page,
}) => {
  await enter(page);
  const target = page.locator('button.target[data-region="neon"]').first(),
    id = (await target.getAttribute("data-bounty-id"))!;
  await target.click();
  await expect(card(page)).toBeVisible();
  await card(page)
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(page.locator(".workbench h2")).toHaveText("The silent overflow");
  await expect(card(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await target.click();
  await expect(card(page)).toBeVisible();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const point = (await pose(page, id))!.point,
    canvas = await page.locator(".arena-canvas canvas").boundingBox();
  await page.screenshot({ path: "test-results/inspect-map-click.png" });
  await page.mouse.click(canvas!.x + point.x, canvas!.y + point.y);
  await expect(page.locator(".workbench h2")).toHaveText("The silent overflow");
});

test("cards stay usable on small screens and Escape restores the list and its focused item", async ({
  page,
}) => {
  await enter(page);
  for (const [width, height] of [
    [1280, 720],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    const target = page.locator('button.target[data-region="foundry"]').last();
    await target.focus();
    await target.press("Enter");
    await expect(card(page)).toBeInViewport();
    await expect(
      card(page).getByRole("button", { name: "Open question", exact: true }),
    ).toBeInViewport();
    if (height >= 720)
      await expect
        .poll(() =>
          page.locator(".bug-info-anchor").evaluate((node) => {
            const anchor = node as HTMLElement,
              x = Number(anchor.dataset.bugX),
              y = Number(anchor.dataset.bugY);
            return !!document.elementFromPoint(x, y)?.closest(".arena-canvas");
          }),
        )
        .toBe(true);
    if (width < 720)
      await expect(
        page.getByRole("complementary", { name: "Bounty targets" }),
      ).not.toBeVisible();
    await page.screenshot({ path: `test-results/inspect-${width}.png` });
    await card(page).getByRole("heading").press("Escape");
    await expect(card(page)).toHaveCount(0);
    await expect(target).toBeFocused();
  }
});

test("a failed statement preview retries without a capture or code read", async ({
  page,
}) => {
  await enter(page);
  let fail = true;
  await page.route("**/bounties/*/statement", async (route) => {
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.locator('button.target[data-region="neon"]').first().click();
  await expect(card(page)).toContainText("Question preview unavailable.");
  await expect(
    card(page).getByRole("button", { name: "Open question", exact: true }),
  ).toBeEnabled();
  fail = false;
  await card(page).getByRole("button", { name: "Retry preview" }).click();
  await expect(card(page)).toContainText("A telemetry service");
  await expect(page.locator(".workbench")).toHaveCount(0);
});

test("the information card and question remain accessible when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: any[]
    ) {
      return kind.includes("webgl")
        ? null
        : original.call(this, kind as any, ...args);
    } as typeof original;
  });
  await enter(page);
  await page.locator('button.target[data-region="neon"]').first().click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText("A telemetry service");
  await card(page)
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(page.locator(".workbench h2")).toHaveText("The silent overflow");
});

test("an older preview response cannot replace a newly selected bug and a live claim dismisses its card", async ({
  page,
}) => {
  await enter(page);
  const first = page.locator('button.target[data-region="neon"]').first(),
    second = page.locator('button.target[data-region="foundry"]').last(),
    firstId = (await first.getAttribute("data-bounty-id"))!,
    secondId = (await second.getAttribute("data-bounty-id"))!;
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/bounties/${firstId}/statement`, async (route) => {
    await held;
    await route.fulfill({
      json: {
        schema_version: 1,
        trace_id: "preview-old",
        data: {
          bounty_id: firstId,
          statement: "OLD PREVIEW MUST STAY DISMISSED",
        },
      },
    });
  });
  await first.click();
  await expect(card(page)).toContainText("Reading question preview");
  await second.click();
  await expect(card(page)).toContainText("A telemetry service");
  release!();
  await expect(card(page).getByRole("heading")).toHaveText(
    await second.locator(".target-copy > strong").innerText(),
  );
  await expect(card(page)).not.toContainText("OLD PREVIEW");
  await page.request.post("/api/v1/_fixture", {
    data: { action: "claim", bounty: secondId },
  });
  await expect(card(page)).toHaveCount(0);
  await second.click();
  await expect(page.locator(".workbench")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});
