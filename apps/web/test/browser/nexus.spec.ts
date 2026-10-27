import { test, expect, type Page } from "@playwright/test";

async function enter(page: Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page.getByRole("button", { name: "Confirm and enter" }).click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Verdant Nexus", exact: true })
    .click();
  await expect(page.locator(".nexus-network")).toBeVisible();
}

test("Nexus has a living graph, six cached cyber-anomalies, visible dummy questions and mobile/pause support", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await expect(page.locator("button.target[data-region=verdant]")).toHaveCount(
    10,
  );
  await expect(page.locator("canvas[data-nexus-creature]")).toHaveCount(10);
  await expect(page.locator(".nexus-root")).toContainText("ROOT CORE");
  await expect(
    page.locator(".nexus-network image,.nexus-network img,.city-vines"),
  ).toHaveCount(0);
  expect(await page.locator(".nexus-node").count()).toBeLessThanOrEqual(48);
  expect(await page.locator(".nexus-data-pulse").count()).toBeLessThanOrEqual(
    12,
  );
  const pulse = page.locator(".nexus-data-pulse").first();
  await expect(pulse).toHaveCSS("animation-play-state", "paused");
  const gallery = await page.evaluate(async () => {
    const source = "/src/nexus-creatures.ts",
      { nexusPlate, nexusKinds } = await import(source),
      canvas = document.createElement("canvas");
    canvas.id = "nexus-art-inspection";
    canvas.width = 1260;
    canvas.height = 700;
    canvas.style.cssText =
      "position:fixed;inset:0;z-index:99999;width:1260px;height:700px";
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#06181f";
    c.fillRect(0, 0, 1260, 700);
    c.fillStyle = "#d6fff1";
    c.font = "17px monospace";
    c.fillText("VERDANT NEXUS / ESCAPED NETWORK ANOMALIES", 24, 30);
    const result = Object.keys(nexusKinds).map((motion, i) => {
      const ink = nexusKinds[motion],
        x = (i % 3) * 420,
        y = 50 + Math.floor(i / 3) * 320;
      c.fillStyle = "#102c35";
      c.fillRect(x + 12, y, 396, 304);
      c.strokeStyle = ink.colour;
      c.lineWidth = 2;
      c.strokeRect(x + 12, y, 396, 304);
      c.drawImage(nexusPlate(motion), x + 95, y + 9, 230, 230);
      c.fillStyle = ink.light;
      c.font = "16px monospace";
      c.fillText(ink.name.toUpperCase(), x + 26, y + 260);
      c.fillStyle = ink.colour;
      c.font = "12px monospace";
      c.fillText(ink.signature.toUpperCase(), x + 26, y + 284);
      return ["body", "moving", "reaction", "all"].every((part) => {
        const image = nexusPlate(motion, part),
          data = image.getContext("2d")!.getImageData(0, 0, 256, 256).data;
        let count = 0;
        for (let p = 3; p < data.length; p += 4) if (data[p] > 32) count++;
        return (
          image === nexusPlate(motion, part) && count > 60 && count < 60000
        );
      });
    });
    document.body.append(canvas);
    return result;
  });
  expect(gallery).toEqual(Array(6).fill(true));
  await page
    .locator("#nexus-art-inspection")
    .screenshot({ path: "test-results/nexus-creature-gallery.png" });
  await page.locator("#nexus-art-inspection").evaluate((n) => n.remove());
  await page.screenshot({ path: "test-results/verdant-nexus-desktop.png" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  await expect(pulse).toHaveCSS("animation-play-state", "running");
  const before = await pulse.evaluate(
    (n) => getComputedStyle(n).strokeDashoffset,
  );
  await expect
    .poll(() => pulse.evaluate((n) => getComputedStyle(n).strokeDashoffset))
    .not.toBe(before);
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await expect(pulse).toHaveCSS("animation-play-state", "paused");
  const target = page.locator("button.target[data-region=verdant]").last();
  await target.click();
  await expect(page.locator(".statement")).toContainText("Repair the program");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Centre", exact: true }).click();
  await page.screenshot({ path: "test-results/verdant-nexus-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Nexus parts and signal footprints articulate, freeze on pause and hover, and the core remains clickable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.mouse.move(20, 200);
  const ids = await page
      .locator("button.target[data-region=verdant]")
      .evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLElement).dataset.bountyId!),
      ),
    sample = () =>
      page.evaluate(async (ids) => {
        const source = "/test/scene-probe.ts",
          { motionState } = await import(source);
        return motionState(ids) as ReturnType<
          typeof import("../scene-probe").motionState
        >;
      }, ids);
  await expect
    .poll(async () => (await sample()).filter((s) => s.nexus).length)
    .toBe(10);
  const animated = await page.evaluate(async (ids) => {
    const source = "/test/scene-probe.ts",
      { motionState, advanceScene } = await import(source),
      before = motionState(ids),
      changed = new Set();
    for (let step = 0; step < 8; step++) {
      advanceScene(2);
      for (const s of motionState(ids)) {
        const previous = before.find((b: any) => b.id === s.id);
        if (
          JSON.stringify(s.nexus.parts) !== JSON.stringify(previous.nexus.parts)
        )
          changed.add(s.motion);
      }
    }
    return {
      motions: [...changed].sort(),
      before: before.map((s: any) => ({
        motion: s.motion,
        count: s.nexus.parts.length,
        legs: s.legs.length,
      })),
    };
  }, ids);
  expect(animated.motions).toEqual([
    "DART",
    "DRAG",
    "FLY",
    "HOP",
    "SKITTER",
    "WALK",
  ]);
  expect(animated.before.every((s: { legs: number }) => s.legs === 0)).toBe(true);
  for (const s of animated.before)
    expect(s.count).toBe(
      (
        { DART: 1, DRAG: 5, FLY: 3, HOP: 1, SKITTER: 3, WALK: 4 } as Record<
          string,
          number
        >
      )[s.motion],
    );
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const frozen = await sample();
  await page.waitForTimeout(150);
  expect(await sample()).toEqual(frozen);
  const chosen = frozen.find((s) => s.motion === "SKITTER")!;
  for (let i = 0; i < 14; i++) {
    const s = (await sample()).find((s) => s.id === chosen.id)!;
    if (
      s.point.x > 500 &&
      s.point.x < 1220 &&
      s.point.y > 380 &&
      s.point.y < 750
    )
      break;
    const direction =
      s.point.x < 500
        ? "left"
        : s.point.x > 1220
          ? "right"
          : s.point.y < 380
            ? "up"
            : "down";
    await page
      .getByRole("button", { name: `Pan region ${direction}`, exact: true })
      .click();
  }
  const selected = (await sample()).find((s) => s.id === chosen.id)!,
    target = page.locator(`button.target[data-bounty-id="${chosen.id}"]`),
    title = await target.locator("strong").textContent();
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  await page.mouse.move(selected.point.x, selected.point.y);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const held = (await sample()).find((s) => s.id === chosen.id)!;
  await page.waitForTimeout(150);
  expect((await sample()).find((s) => s.id === chosen.id)).toEqual(held);
  await page.mouse.click(held.point.x, held.point.y);
  await expect(
    page.getByRole("heading", { name: title!, exact: true }),
  ).toBeVisible();
});
