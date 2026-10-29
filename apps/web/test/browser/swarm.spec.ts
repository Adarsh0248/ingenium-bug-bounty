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
const areas = [
  ["neon", "Neon District"],
  ["foundry", "Silicon Hive"],
  ["verdant", "Verdant Nexus"],
  ["cryo", "Zero-Day Core"],
] as const;

test("overview tiles contain scenery only, open across their whole surface and never submit a catch", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  let opens = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/open")) opens++;
  });
  const nav = page.getByRole("navigation", { name: "Arena regions" });
  for (const [id, name] of areas) {
    if(await page.locator('.arena-canvas').count())await expect(page.locator(".arena-canvas")).toHaveCSS("visibility","hidden");
    else expect(id).toBe('neon');
    const tile = page.getByRole("button", {
      name: `Enter ${name}`,
      exact: true,
    });
    const box = await tile.boundingBox();
    await page.mouse.click(
      box!.x + box!.width * 0.5,
      box!.y + box!.height * 0.65,
    );
    await expect(page.locator(".region-arena")).toHaveAttribute(
      "data-map-region",
      id,
    );
    await expect(page.locator(".arena-canvas")).toHaveCSS(
      "visibility",
      "visible",
    );
    await expect(page.locator(".workbench")).toHaveCount(0);
    await nav.getByRole("button", { name: "World map", exact: true }).click();
    await expect(page.locator(".arena-canvas")).toHaveCSS(
      "pointer-events",
      "none",
    );
  }
  const visible = await page.evaluate(async () => {
    const source = "/test/scene-probe.ts",
      { motionState } = await import(source),
      ids = [...document.querySelectorAll<HTMLElement>("button.target")].map(
        (n) => n.dataset.bountyId!,
      );
    return motionState(ids).filter((s: any) => s.visible).length;
  });
  expect(visible).toBe(0);
  expect(opens).toBe(0);
  await page.screenshot({ path: "test-results/clean-world-overview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const tile = page.getByRole("button", {
    name: "Enter Verdant Nexus",
    exact: true,
  });
  await tile.focus();
  await tile.press("Enter");
  await expect(page.locator(".region-arena")).toHaveAttribute(
    "data-map-region",
    "verdant",
  );
  await expect(page.locator(".workbench")).toHaveCount(0);
  expect(opens).toBe(0);
});

test("roaming positions, heading and articulation survive all region changes; bodies keep clearance", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  const nav = page.getByRole("navigation", { name: "Arena regions" });
  await nav.getByRole("button", { name: "Neon District", exact: true }).click();
  await page.mouse.move(20, 190);
  const ids = await page
      .locator("button.target[data-region=neon]")
      .evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLElement).dataset.bountyId!),
      ),
    sample = (seconds = 0) =>
      page.evaluate(
        async ({ ids, seconds }) => {
          const source = "/test/scene-probe.ts",
            { motionState, advanceScene } = await import(source);
          if (seconds) advanceScene(seconds);
          return motionState(ids) as ReturnType<
            typeof import("../scene-probe").motionState
          >;
        },
        { ids, seconds },
      );
  await expect
    .poll(async () => (await sample()).filter((s) => s.roamer).length)
    .toBe(10);
  const initial = await sample(),
    advanced = await sample(18);
  expect(
    advanced.some(
      (s, i) =>
        Math.hypot(
          s.roamer!.x - initial[i].roamer!.x,
          s.roamer!.y - initial[i].roamer!.y,
        ) > 50,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const saved = await sample();
  for (const name of [
    "Silicon Hive",
    "Verdant Nexus",
    "Zero-Day Core",
    "World map",
    "Neon District",
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
  }
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  expect(await sample()).toEqual(saved);
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  const spacing = await page.evaluate(async (ids) => {
    const source = "/test/scene-probe.ts",
      { motionState, advanceScene } = await import(source);
    let smallest = Infinity;
    for (let step = 0; step < 60; step++) {
      advanceScene(0.5);
      const states = motionState(ids);
      for (let i = 0; i < states.length; i++)
        for (let j = i + 1; j < states.length; j++) {
          const a = states[i].roamer,
            b = states[j].roamer;
          smallest = Math.min(
            smallest,
            Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius,
          );
        }
    }
    return smallest;
  }, ids);
  expect(spacing).toBeGreaterThanOrEqual(2.8);
  expect(
    (await sample()).some(
      (s, i) => s.roamer!.distance > saved[i].roamer!.distance,
    ),
  ).toBe(true);
});
