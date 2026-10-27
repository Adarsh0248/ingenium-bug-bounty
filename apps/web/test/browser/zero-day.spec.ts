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
    .getByRole("button", { name: "Zero-Day Core", exact: true })
    .click();
  await expect(page.locator(".zero-day-core")).toBeVisible();
}

test("Zero-Day Core is a breached mainframe with six cached mechanical entities, mobile layout and question entry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await expect(page.locator("button.target[data-region=cryo]")).toHaveCount(10);
  await expect(page.locator("canvas[data-zero-day-entity]")).toHaveCount(10);
  await expect(page.locator(".zero-day-seal")).toContainText("ENCRYPTION SEAL");
  await expect(
    page.locator(".zero-day-core image,.zero-day-core img"),
  ).toHaveCount(0);
  expect(await page.locator(".zero-day-module").count()).toBeLessThanOrEqual(
    48,
  );
  expect(await page.locator(".zero-day-data-flow").count()).toBeLessThanOrEqual(
    8,
  );
  const stream = page.locator(".zero-day-data-flow").first();
  await expect(stream).toHaveCSS("animation-play-state", "paused");
  const art = await page.evaluate(async () => {
    const source = "/src/zero-day-entities.ts",
      { zeroDayPlate, zeroDayKinds } = await import(source),
      canvas = document.createElement("canvas");
    canvas.id = "zero-day-art-inspection";
    canvas.width = 1260;
    canvas.height = 740;
    canvas.style.cssText =
      "position:fixed;inset:0;z-index:99999;width:1260px;height:740px";
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#070d14";
    c.fillRect(0, 0, 1260, 740);
    c.fillStyle = "#bdd1db";
    c.font = "17px monospace";
    c.fillText("ZERO-DAY CORE / AUTONOMOUS INTRUSION ENTITIES", 24, 30);
    const result = Object.keys(zeroDayKinds).map((motion, i) => {
      const ink = zeroDayKinds[motion],
        x = (i % 3) * 420,
        y = 50 + Math.floor(i / 3) * 340,
        size = 240 * ink.scale;
      c.fillStyle = i % 2 ? "#111d29" : "#0d1823";
      c.fillRect(x + 12, y, 396, 324);
      c.strokeStyle = ink.colour;
      c.lineWidth = 2;
      c.strokeRect(x + 12, y, 396, 324);
      c.drawImage(
        zeroDayPlate(motion),
        x + 210 - size / 2,
        y + 142 - size / 2,
        size,
        size,
      );
      c.fillStyle = "#d5e2e6";
      c.font = "16px monospace";
      c.fillText(ink.name.toUpperCase(), x + 27, y + 283);
      c.fillStyle = ink.colour;
      c.font = "12px monospace";
      c.fillText(ink.signature.toUpperCase(), x + 27, y + 307);
      return [
        "body",
        "moving",
        "reaction",
        "all",
        ...(["FLY", "DART"].includes(motion) ? ["leftWing", "rightWing"] : []),
      ].every((part) => {
        const image = zeroDayPlate(motion, part),
          data = image.getContext("2d")!.getImageData(0, 0, 256, 256).data;
        let count = 0;
        for (let p = 3; p < data.length; p += 4) if (data[p] > 32) count++;
        return (
          image === zeroDayPlate(motion, part) && count > 50 && count < 60000
        );
      });
    });
    document.body.append(canvas);
    return result;
  });
  expect(art).toEqual(Array(6).fill(true));
  await page
    .locator("#zero-day-art-inspection")
    .screenshot({ path: "test-results/zero-day-entity-gallery.png" });
  await page.locator("#zero-day-art-inspection").evaluate((n) => n.remove());
  await page.screenshot({ path: "test-results/zero-day-core-desktop.png" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  await expect(stream).toHaveCSS("animation-play-state", "running");
  const before = await stream.evaluate(
    (n) => getComputedStyle(n).strokeDashoffset,
  );
  await expect
    .poll(() => stream.evaluate((n) => getComputedStyle(n).strokeDashoffset))
    .not.toBe(before);
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await expect(stream).toHaveCSS("animation-play-state", "paused");
  await page.locator("button.target[data-region=cryo]").last().click();
  await expect(page.locator(".statement")).toContainText("Repair the program");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Centre", exact: true }).click();
  await page.screenshot({ path: "test-results/zero-day-core-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Zero-Day phase panels, four-leg grippers and separate components animate, freeze and remain clickable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.mouse.move(20, 200);
  const ids = await page
      .locator("button.target[data-region=cryo]")
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
    .poll(async () => (await sample()).filter((s) => s.zeroDay).length)
    .toBe(10);
  const animation = await page.evaluate(async (ids) => {
    const source = "/test/scene-probe.ts",
      { motionState, advanceScene } = await import(source),
      before = motionState(ids),
      changed = new Set();
    let fourLegs = false,
      wingMoved = false;
    for (let step = 0; step < 8; step++) {
      advanceScene(2);
      for (const s of motionState(ids)) {
        const previous = before.find((p: any) => p.id === s.id);
        if (
          JSON.stringify(s.zeroDay.parts) !==
          JSON.stringify(previous.zeroDay.parts)
        )
          changed.add(s.motion);
        if (s.motion === "WALK")
          fourLegs ||=
            s.legs.length === 4 &&
            JSON.stringify(s.legs) !== JSON.stringify(previous.legs);
        if (s.motion === "FLY" || s.motion === "DART")
          wingMoved ||= Math.abs(s.wing.fold - previous.wing.fold) > 0.1;
      }
    }
    return { motions: [...changed].sort(), fourLegs, wingMoved };
  }, ids);
  expect(animation.motions).toEqual([
    "DART",
    "DRAG",
    "FLY",
    "HOP",
    "SKITTER",
    "WALK",
  ]);
  expect(animation.fourLegs).toBe(true);
  expect(animation.wingMoved).toBe(true);
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
  const chosen = frozen.find((s) => s.motion === "WALK")!;
  for (let i = 0; i < 15; i++) {
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
  const target = page.locator(`button.target[data-bounty-id="${chosen.id}"]`),
    title = await target.locator("strong").textContent(),
    point = (await sample()).find((s) => s.id === chosen.id)!.point;
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  await page.mouse.move(point.x, point.y);
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
