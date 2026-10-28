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

for (const [tier, layout, coins] of [
  ["Common", "single", 1],
  ["Rare", "pile", 3],
  ["Elite", "stack", 6],
  ["Apex", "heap", 14],
] as const) {
  test(`${tier} confirmed bounty shows a ${layout} for two seconds, with the earned amount over the IDE`, async ({
    page,
  }) => {
    await enter(page);
    const target = page
      .locator(`button.target[data-region="neon"][data-bounty-tier="${tier}"]`)
      .first();
    const amount = Number(
      (await target.locator(".coin-value").innerText()).replaceAll(",", ""),
    );
    await expect(target.locator(".tecnoesis-coin")).toBeVisible();
    await target.click();
    await page
      .getByRole("button", { name: "Open question", exact: true })
      .click();
    await expect(
      page.locator(".workbench-stats .tecnoesis-coin"),
    ).toBeVisible();
    if (tier === "Common") {
      await page.getByRole("button", { name: "hints 0/3" }).click();
      await page
        .getByRole("button", { name: "Purchase hint", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm purchase", exact: true })
        .click();
      await expect(page.locator(".hint").first()).toContainText(
        "Check the arithmetic",
      );
    }
    await page.evaluate(() => {
      const times: { start?: number; end?: number } = {};
      (window as any).__rewardTimes = times;
      const observer = new MutationObserver(() => {
        const popup = document.querySelector(".bounty-reward");
        if (popup && times.start === undefined) times.start = performance.now();
        if (!popup && times.start !== undefined) {
          times.end = performance.now();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole("button", { name: "Submit fix", exact: true }).click();
    const popup = page.locator(".bounty-reward");
    await expect(popup).toHaveAttribute("data-coins", layout);
    await expect(popup).toContainText(`+${amount.toLocaleString()} coins`);
    await expect(popup.locator(".tecnoesis-coin")).toHaveCount(coins);
    await expect(page.locator(".workbench")).toBeVisible();
    await expect(page.locator(".termination-banner")).toHaveCount(0);
    await page.waitForTimeout(350); // Capture the settled entrance, within its two-second window.
    await page.screenshot({ path: `test-results/coins-${layout}.png` });
    await expect(popup).toHaveCount(0);
    const duration = await page.evaluate(() => {
      const { start, end } = (window as any).__rewardTimes;
      return end - start;
    });
    expect(duration).toBeGreaterThanOrEqual(1900);
    expect(duration).toBeLessThan(3000);
    if (tier === "Common") {
      await expect(page.locator(".hud-score.wallet strong")).toHaveText(
        (1200 - 35 + amount).toLocaleString(),
      );
      await page.reload();
      await expect(
        page.getByText("STATE VERIFIED", { exact: true }),
      ).toBeVisible();
      await expect(popup).toHaveCount(0);
      await target.click();
      await expect(
        page.getByRole("button", { name: "Target cleared", exact: true }),
      ).toBeDisabled();
      await expect(popup).toHaveCount(0);
    }
  });
}

test("sample runs and another team's claim do not announce earned coins", async ({
  page,
}) => {
  await enter(page);
  const target = page.locator('button.target[data-region="neon"]').first(),
    bounty = await target.getAttribute("data-bounty-id");
  await target.click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: /Run samples/ }).click();
  await expect(page.locator(".feedback-heading")).toContainText("passed");
  await expect(page.locator(".bounty-reward")).toHaveCount(0);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "claim", bounty },
  });
  await expect(page.locator(".cleared-notice")).toBeVisible();
  await expect(page.locator(".bounty-reward")).toHaveCount(0);
  await expect(page.locator(".hud-score.wallet strong")).toHaveText("1,200");
});

test("closing the IDE during the reward waits for its two-second popup before deploying the weapon", async ({
  page,
}) => {
  await enter(page);
  await page.locator('button.target[data-region="neon"]').first().click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(page.locator(".bounty-reward")).toBeVisible();
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await expect(page.locator(".bounty-reward")).toBeVisible();
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await expect(page.locator(".bounty-reward")).toHaveCount(0);
  await expect(page.locator(".termination-banner")).toHaveAttribute(
    "data-weapon",
    "Vector Lance",
  );
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Arena regions" })
      .getByRole("button", { name: "World map", exact: true }),
  ).toBeEnabled();
});

test("mobile reduced-motion rewards stay visible with no animated coins and dismiss automatically", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.locator('button.target[data-bounty-tier="Apex"]').first().click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  const popup = page.locator(".bounty-reward");
  await expect(popup).toBeInViewport();
  await expect(popup).toHaveAttribute("data-coins", "heap");
  expect(
    await popup.evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.screenshot({ path: "test-results/coins-mobile.png" });
  await expect(popup).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Close workbench", exact: true }),
  ).toBeEnabled();
});
