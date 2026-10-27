import { test, expect } from "@playwright/test";

async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page.getByRole("button", { name: "Confirm and enter" }).click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await page.request.post("/api/v1/_fixture", {
    data: { action: "region-field", category: "SYSTEMS" },
  });
  await expect(page.locator("button.target[data-region=foundry]")).toHaveCount(
    30,
  );
  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Silicon Hive", exact: true })
    .click();
  await expect(page.locator(".foundry-board")).toBeVisible();
}

test("Foundry is a live motherboard with port traffic, cached robotic portraits and paused/mobile equivalents", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await expect(page.locator(".foundry-cpu")).toContainText("SECURE PROCESSOR");
  await expect(page.locator(".foundry-component").first()).toBeAttached();
  await expect(page.locator(".foundry-port").first()).toBeAttached();
  await expect(page.locator("canvas[data-foundry-creature]")).toHaveCount(30);
  await expect(
    page.locator(".foundry-board image,.foundry-board img"),
  ).toHaveCount(0);
  const packet = page.locator(".foundry-data-packet").first();
  expect(
    await page.locator(".foundry-data-packet").count(),
  ).toBeLessThanOrEqual(12);
  await expect(packet).toHaveCSS("animation-play-state", "paused");
  const cached = await page.evaluate(async () => {
    const source = "/src/foundry-creatures.ts",
      { foundryPlate, foundryBodies, foundryTraits, foundryPaint } =
        await import(source),
      gallery = document.createElement("canvas");
    gallery.id = "foundry-art-inspection";
    gallery.width = 1260;
    gallery.height = 680;
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:99999;width:1260px;height:680px";
    const c = gallery.getContext("2d")!;
    c.fillStyle = "#0a1d1c";
    c.fillRect(0, 0, 1260, 680);
    c.fillStyle = "#e4f0dc";
    c.font = "16px monospace";
    c.fillText("HIVE FLEET / ACTUAL BOUNTY SIZE SCALE", 22, 26);
    const valid = Object.keys(foundryBodies).map((motion, i) => {
      const bounty = [150, 850, 100, 700, 1000, 450][i],
        traits = foundryTraits(motion, bounty, 173),
        x = (i % 3) * 420,
        y = 44 + Math.floor(i / 3) * 316,
        size = 144 * traits.size;
      c.fillStyle = "#102723";
      c.fillRect(x + 12, y, 396, 300);
      c.strokeStyle = foundryPaint[motion].paint;
      c.lineWidth = 2;
      c.strokeRect(x + 12, y, 396, 300);
      c.drawImage(
        foundryPlate(motion, "all", traits.weapon),
        x + 210 - size / 2,
        y + 134 - size / 2,
        size,
        size,
      );
      c.font = "14px monospace";
      c.fillStyle = foundryPaint[motion].light;
      c.fillText(
        `${["ION ORB", "MAGMA DOZER", "VOLT BUGGY", "PHASE INTERCEPTOR", "BASTION CARRIER", "AZURE DART"][i]} / ${bounty} CR`,
        x + 27,
        y + 265,
      );
      c.fillStyle = "#9cbbaf";
      c.font = "12px monospace";
      c.fillText(
        `${traits.weapon === "none" ? "UNARMED / QUICK SCOUT" : traits.weapon === "siege" ? "TWIN SIEGE CANNONS / HEAVY" : "PULSE CANNON / ARMOURED"}`,
        x + 27,
        y + 284,
      );
      return (
        [
          "all",
          "body",
          ...(["FLY", "DART"].includes(motion) ? ["jet"] : []),
        ].every((part) => {
          const plate = foundryPlate(motion, part),
            data = plate.getContext("2d")!.getImageData(0, 0, 256, 256).data;
          let opaque = 0;
          for (let j = 3; j < data.length; j += 4) if (data[j] > 32) opaque++;
          return (
            plate === foundryPlate(motion, part) &&
            opaque > 100 &&
            opaque < 50000
          );
        }) &&
        ["none", "pulse", "siege"].every(
          (weapon) =>
            foundryPlate(motion, "all", weapon) ===
            foundryPlate(motion, "all", weapon),
        )
      );
    });
    document.body.append(gallery);
    return valid;
  });
  expect(cached).toEqual(Array(6).fill(true));
  await page
    .locator("#foundry-art-inspection")
    .screenshot({ path: "test-results/foundry-robot-gallery.png" });
  await page
    .locator("#foundry-art-inspection")
    .evaluate((node) => node.remove());
  await page.screenshot({
    path: "test-results/foundry-motherboard-desktop.png",
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  await expect(packet).toHaveCSS("animation-play-state", "running");
  const offset = await packet.evaluate(
      (n) => getComputedStyle(n).offsetDistance,
    ),
    fan = page.locator(".foundry-fan"),
    rotation = await fan.evaluate((n) => getComputedStyle(n).transform);
  await expect
    .poll(() => packet.evaluate((n) => getComputedStyle(n).offsetDistance))
    .not.toBe(offset);
  await expect
    .poll(() => fan.evaluate((n) => getComputedStyle(n).transform))
    .not.toBe(rotation);
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await expect(packet).toHaveCSS("animation-play-state", "paused");
  await expect(fan).toHaveCSS("animation-play-state", "paused");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Centre", exact: true }).click();
  await page.screenshot({
    path: "test-results/foundry-motherboard-mobile.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Foundry uses rolling wheels and pulsing jets, keeps armour rigid, and freezes on pause/hover before opening a question", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.mouse.move(20, 200);
  const entries = await page.locator("button.target").evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: (n as HTMLElement).dataset.bountyId!,
        motion: (n as HTMLElement).dataset.motion!,
      })),
    ),
    ids = entries.map((e) => e.id),
    sample = () =>
      page.evaluate(async (ids) => {
        const source = "/test/scene-probe.ts",
          { motionState } = await import(source);
        return motionState(ids);
      }, ids);
  await expect.poll(async () => (await sample()).length).toBe(30);
  for (const motion of ["FLY", "WALK", "HOP", "SKITTER", "DRAG", "DART"]) {
    const id = entries.find((e) => e.motion === motion)!.id,
      first = (await sample()).find((s: any) => s.id === id);
    expect(first.legs).toEqual([]);
    expect(first.wing).toBeNull();
    expect(first.body.scaleY).toBe(1);
    const flying = motion === "FLY" || motion === "DART";
    expect(first.wheels.length).toBe(
      flying ? 0 : motion === "DRAG" ? 8 : motion === "SKITTER" ? 6 : 4,
    );
    await expect
      .poll(async () => {
        const now = (await sample()).find((s: any) => s.id === id);
        expect(now.body.scaleY).toBe(1);
        if (flying) return Math.abs(now.jet.scaleY - first.jet.scaleY) > 0.1;
        now.wheels.forEach((w: any, i: number) => {
          expect(w.x).toBeCloseTo(first.wheels[i].x, 6);
          expect(w.y).toBeCloseTo(first.wheels[i].y, 6);
        });
        return Math.abs(now.wheels[0].angle - first.wheels[0].angle) > 0.1;
      })
      .toBe(true);
  }
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const stopped = await sample();
  await page.waitForTimeout(250);
  expect(await sample()).toEqual(stopped);
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  const visible = (await sample()).find(
    (s: any) =>
      s.visible &&
      s.point.x > 420 &&
      s.point.x < 1300 &&
      s.point.y > 350 &&
      s.point.y < 780,
  );
  expect(visible).toBeDefined();
  const title = await page
    .locator(`button.target[data-bounty-id="${visible.id}"] strong`)
    .innerText();
  await page.mouse.move(visible.point.x, visible.point.y);
  await expect
    .poll(() => page.evaluate(() => document.body.style.cursor))
    .toBe("pointer");
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const hovered = (await sample()).find((s: any) => s.id === visible.id);
  await page.waitForTimeout(250);
  expect((await sample()).find((s: any) => s.id === visible.id)).toEqual(
    hovered,
  );
  await page.mouse.click(visible.point.x, visible.point.y);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".statement")).toContainText("Repair the program");
});

test("bounty size differences render on the map and mounted weapons recoil, fire and hit the board without blocking question entry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.mouse.move(20, 200);
  const ids = await page
      .locator("button.target")
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
  await expect.poll(async () => (await sample()).length).toBe(30);
  const fleet = await sample();
  expect(
    Math.max(...fleet.map((s) => s.scale!)) /
      Math.min(...fleet.map((s) => s.scale!)),
  ).toBeGreaterThan(3.5);
  expect(fleet.some((s) => s.weapon === "pulse")).toBe(true);
  expect(fleet.some((s) => s.weapon === "siege")).toBe(true);
  expect(
    fleet.filter((s) => s.weapon === "none").every((s) => s.fx === null),
  ).toBe(true);
  const armed = fleet.find((s) => s.weapon === "pulse")!;
  for (let i = 0; i < 12; i++) {
    const s = (await sample()).find((s) => s.id === armed.id)!;
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
  const evidence = await page.evaluate(async (id) => {
    const source = "/test/scene-probe.ts",
      { advanceScene, motionState } = await import(source),
      seen = { flash: false, flight: false, impact: false, recoil: false };
    let found = false;
    for (let i = 0; i < 360; i++) {
      advanceScene(0.05);
      const s = motionState([id])[0],
        fx = s.fx;
      seen.flash ||= fx.flash;
      seen.flight ||= fx.flight;
      seen.impact ||= fx.impact;
      seen.recoil ||= fx.recoil < -0.01;
      if (
        Object.values(seen).every(Boolean) &&
        fx.impact &&
        fx.impactScale > 0.85 &&
        fx.impactScale < 1.4
      ) {
        found = true;
        break;
      }
    }
    const before = motionState([id])[0];
    advanceScene(0.1);
    const after = motionState([id])[0];
    return { seen, found, before, after };
  }, armed.id);
  expect(evidence.found).toBe(true);
  expect(Object.values(evidence.seen).every(Boolean)).toBe(true);
  const { before, after } = evidence;
  for (let axis = 0; axis < 3; axis++)
    expect(after.fx.impactPoint[axis]).toBeCloseTo(
      before.fx.impactPoint[axis],
      5,
    );
  expect(after.fx.impactPoint[2]).toBeCloseTo(-0.15, 5);
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const frozen = (await sample()).find((s) => s.id === armed.id)!;
  await page.waitForTimeout(150);
  expect((await sample()).find((s) => s.id === armed.id)).toEqual(frozen);
  await page
    .getByRole("button", { name: "Pan region left", exact: true })
    .click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const panned = (await sample()).find((s) => s.id === armed.id)!;
  expect(panned.fx!.impactPoint![0] - frozen.fx!.impactPoint![0]).toBeCloseTo(
    panned.ground[0] - frozen.ground[0],
    5,
  );
  await page.screenshot({ path: "test-results/foundry-armed-impact.png" });
  const title = await page
    .locator(`button.target[data-bounty-id="${armed.id}"] strong`)
    .innerText();
  await page.mouse.click(panned.point.x, panned.point.y);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".statement")).toContainText("Repair the program");
});
