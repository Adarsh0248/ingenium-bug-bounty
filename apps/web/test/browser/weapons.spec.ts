import { test, expect, type Page } from "@playwright/test";

async function enter(page: Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page.getByRole("button", { name: "Confirm and enter" }).click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}
const weapons = [
  [
    "neon",
    "Neon District",
    "Vector Lance",
    [
      "termination-device",
      "termination-rail--1",
      "termination-beam",
      "termination-scanner",
    ],
  ],
  [
    "foundry",
    "Silicon Hive",
    "Polarity Crusher",
    [
      "termination-base--1",
      "termination-base-1",
      "termination-jaw--1",
      "termination-jaw-1",
    ],
  ],
  [
    "verdant",
    "Verdant Nexus",
    "Graph Reaper",
    [
      "termination-anchor-0",
      "termination-anchor-1",
      "termination-anchor-2",
      "termination-cutter-0",
    ],
  ],
  [
    "cryo",
    "Zero-Day Core",
    "Nullpoint Cannon",
    [
      "termination-device",
      "termination-shutter-0",
      "termination-shutter-3",
      "termination-null-slit",
    ],
  ],
] as const;

for (const [region, name, weapon, parts] of weapons)
  test(`${weapon} deploys only after IDE exit, reacts on the real target and finishes without a duplicate award`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await enter(page);
    await page
      .getByRole("navigation", { name: "Arena regions" })
      .getByRole("button", { name, exact: true })
      .click();
    const target = page
        .locator(`button.target[data-region="${region}"]`)
        .last(),
      id = await target.getAttribute("data-bounty-id");
    await target.click();
    await page
      .getByRole("button", { name: "Open question", exact: true })
      .click();
    await page.getByRole("button", { name: "Plain text", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Your private code", exact: true })
      .fill("int main() {}\n");
    await page.getByRole("button", { name: "Submit fix", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Target cleared", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".termination-banner")).toHaveCount(0);
    const before = await page.evaluate(async () => {
      const source = "/test/scene-probe.ts",
        { terminationState } = await import(source);
      return terminationState();
    });
    expect(before).toBeNull();
    await page
      .getByRole("button", { name: "Close workbench", exact: true })
      .click();
    await expect(page.locator(".termination-banner")).toHaveAttribute(
      "data-weapon",
      weapon,
    );
    const sample = (seconds = 0) =>
      page.evaluate(async (seconds) => {
        const source = "/test/scene-probe.ts",
          { terminationState, advanceScene } = await import(source);
        if (seconds) advanceScene(seconds);
        return terminationState() as ReturnType<
          typeof import("../scene-probe").terminationState
        >;
      }, seconds);
    await expect.poll(async () => !!(await sample())).toBe(true);
    let state = (await sample())!;
    expect(state.weapon).toBe(weapon);
    expect(state.names).toEqual(expect.arrayContaining([...parts]));
    expect(state.targetVisible).toBe(true);
    if (state.elapsed < 1.5) state = (await sample(1.5 - state.elapsed))!;
    await page.screenshot({ path: `test-results/${region}-weapon-charge.png` });
    state = (await sample())!;
    if (state.elapsed < 3.3) state = (await sample(3.3 - state.elapsed))!;
    expect(state.progress).toBeGreaterThan(0);
    expect(state.targetVisible).toBe(true);
    expect(state.scale!.some((v) => v < 0.99)).toBe(true);
    await page.screenshot({ path: `test-results/${region}-weapon-impact.png` });
    state = (await sample())!;
    if (state.elapsed < 4.5) state = (await sample(4.5 - state.elapsed))!;
    expect(state.targetVisible).toBe(false);
    await expect(page.locator(".termination-banner")).toHaveCount(0);
    await expect(target).toHaveAttribute("data-cleared", "true");
    await target.click();
    await expect(
      page.getByRole("button", { name: "Target cleared", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Close workbench", exact: true })
      .click();
    await expect(page.locator(".termination-banner")).toHaveCount(0);
    const remaining = await page.evaluate(async (id) => {
      const source = "/test/scene-probe.ts",
        { motionState } = await import(source);
      return motionState([id]);
    }, id);
    expect(remaining).toEqual([]);
    expect(errors).toEqual([]);
  });

test("reduced-motion clear uses a compact confirmation with no weapon rig or moving debris", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.locator('button.target[data-region="foundry"]').first().click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Target cleared", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  const banner = page.locator(".termination-banner");
  await expect(banner).toHaveAttribute("data-phase", "CONFIRMED");
  await expect(banner).toBeInViewport();
  await expect(banner).toContainText("POLARITY CRUSHER");
  const state = await page.evaluate(async () => {
    const source = "/test/scene-probe.ts",
      { terminationState } = await import(source);
    return terminationState();
  });
  expect(state).toBeNull();
  await page.screenshot({ path: "test-results/weapon-reduced-mobile.png" });
  await expect(banner).toHaveCount(0);
});

test("an Apex crusher stays framed on a small screen with the full finishing sequence", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page
    .locator('button.target[data-region="foundry"][data-bounty-tier="Apex"]')
    .last()
    .click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Target cleared", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  const banner = page.locator(".termination-banner");
  await expect(banner).toHaveAttribute("data-weapon", "Polarity Crusher");
  await expect(banner).toBeInViewport();
  await expect(
    page.getByRole("complementary", { name: "Bounty targets" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Arena regions" }),
  ).not.toBeVisible();
  const state = await page.evaluate(async () => {
    const source = "/test/scene-probe.ts",
      { terminationState, advanceScene } = await import(source);
    const initial = terminationState();
    if (initial && initial.elapsed < 3.3) advanceScene(3.3 - initial.elapsed);
    return terminationState();
  });
  expect(state?.debrisCount).toBe(28);
  expect(state?.targetVisible).toBe(true);
  await page.screenshot({ path: "test-results/weapon-apex-mobile.png" });
  await expect(banner).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Arena regions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Bounty targets" }),
  ).toBeVisible();
});
