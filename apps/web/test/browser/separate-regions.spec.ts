import { test, expect } from "@playwright/test";
const first = "00000000-0000-4000-8000-000000000100";
async function enter(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page.getByRole("button", { name: "Confirm and enter" }).click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}
test("restored overview has four separate scenes and old region navigation on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [],
    rejected: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      /CyberWorld|cyber-billboards|connected-world-v1|creatures-v1/.test(
        r.url(),
      )
    )
      rejected.push(r.url());
  });
  await enter(page);
  await expect(page.locator("[data-region-tile]")).toHaveCount(4);
  await expect(page.locator(".world-scenery")).toHaveAttribute(
    "data-world-view",
    "all",
  );
  await expect(page.locator("button.target")).toHaveCount(40);
  await page.screenshot({ path: "test-results/restored-four-regions.png" });
  const nav = page.getByRole("navigation", { name: "Arena regions" });
  for (const [id, name] of [
    ["neon", "Neon District"],
    ["foundry", "Silicon Hive"],
    ["verdant", "Verdant Nexus"],
    ["cryo", "Zero-Day Core"],
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".world-scenery")).toHaveAttribute(
      "data-world-view",
      id,
    );
    await expect(page.locator(".cybercity > svg")).toHaveCount(1);
    await expect(page.locator("button.target")).toHaveCount(40);
    const targets = page.locator(`button.target[data-region="${id}"]`);
    await expect(targets).toHaveCount(10);
    const varieties = await targets.evaluateAll((nodes) =>
      nodes.map((node) => ({
        motion: (node as HTMLElement).dataset.motion,
        rank: (node as HTMLElement).dataset.bountyTier,
      })),
    );
    expect(new Set(varieties.map((b) => b.motion)).size).toBe(6);
    expect(new Set(varieties.map((b) => b.rank)).size).toBe(4);
    await page.screenshot({ path: `test-results/restored-${id}.png` });
    await targets.last().click();
    await page
      .getByRole("button", { name: "Open question", exact: true })
      .click();
    await expect(page.locator(".workbench")).toBeVisible();
    await expect(page.locator(".workbench h2")).toContainText("Dummy");
    await expect(page.locator(".statement")).toContainText(
      "Repair the program",
    );
    await page
      .getByRole("button", { name: "Close workbench", exact: true })
      .click();
  }
  await nav.getByRole("button", { name: "World map", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-region-tile]")).toHaveCount(4);
  await page.screenshot({ path: "test-results/restored-regions-mobile.png" });
  await page
    .getByRole("button", { name: "Enter Verdant Nexus", exact: true })
    .click();
  await expect(page.locator(".world-scenery")).toHaveAttribute(
    "data-world-view",
    "verdant",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(rejected).toEqual([]);
});
test("restored target list keeps captures, private code and deferred award in another region", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  const nav = page.getByRole("navigation", { name: "Arena regions" }),
    target = page.locator(`[data-bounty-id="${first}"]`);
  await nav.getByRole("button", { name: "Zero-Day Core", exact: true }).click();
  await target.click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "The silent overflow", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cybercity")).toHaveClass(/city-still/);
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await editor.fill("// retained through the visual rollback\nint main() {}\n");
  await expect(page.locator(".save-status")).toHaveText("saved");
  await page.getByRole("button", { name: "Close workbench" }).click();
  await nav.getByRole("button", { name: "Verdant Nexus", exact: true }).click();
  await target.click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(editor).toHaveValue(
    "// retained through the visual rollback\nint main() {}\n",
  );
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Target cleared", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Close workbench" }).click();
  await expect(
    page.getByText("TARGET TERMINATED", { exact: true }),
  ).toBeVisible();
  await expect(target).toHaveAttribute("data-cleared", "true");
});

test("each region has a fixed four by four map with thirty targets and saved panning", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  const map = page.getByLabel("Explorable region map", { exact: true }),
    nav = page.getByRole("navigation", { name: "Arena regions" });
  for (const [category, name, id, aura] of [
    ["ARRAYS", "Neon District", "neon", "Signal halo"],
    ["SYSTEMS", "Silicon Hive", "foundry", "Circuit corona"],
    ["GRAPHS", "Verdant Nexus", "verdant", "Branching signal"],
    ["LOGIC", "Zero-Day Core", "cryo", "Intrusion field"],
  ]) {
    await page.request.post("/api/v1/_fixture", {
      data: { action: "region-field", category },
    });
    await expect(page.locator("button.target")).toHaveCount(30);
    await expect(
      page.locator(`button.target[data-region="${id}"]`),
    ).toHaveCount(30);
    const creatures = await page.locator("button.target").evaluateAll((nodes) =>
      nodes.map((node) => ({
        motion: (node as HTMLElement).dataset.motion,
        rank: (node as HTMLElement).dataset.bountyTier,
        aura: (node as HTMLElement).dataset.aura,
      })),
    );
    expect(new Set(creatures.map((b) => b.motion)).size).toBe(6);
    expect(new Set(creatures.map((b) => b.rank))).toEqual(
      new Set(["Common", "Rare", "Elite", "Apex"]),
    );
    expect(
      creatures.every((b) => b.aura === (b.rank === "Common" ? "none" : aura)),
    ).toBe(true);
    await expect(page.getByLabel("Bounty appearance guide")).toContainText(
      "Apex 900+",
    );
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(map).toHaveAttribute("data-map-region", id);
    const world = page.locator(".region-map-world");
    const viewport = await page.locator(".region-map-viewport").boundingBox();
    await expect(world).toHaveCSS("width", `${viewport!.width * 4}px`);
    await expect(world).toHaveCSS("height", `${viewport!.height * 4}px`);
    const x = Number(await map.getAttribute("data-map-x")),
      y = Number(await map.getAttribute("data-map-y"));
    await page
      .getByRole("button", { name: "Pan region right", exact: true })
      .click();
    await expect
      .poll(async () => Number(await map.getAttribute("data-map-x")))
      .toBeLessThan(x);
    await page
      .getByRole("button", { name: "Pan region down", exact: true })
      .click();
    await expect
      .poll(async () => Number(await map.getAttribute("data-map-y")))
      .toBeLessThan(y);
    await page.screenshot({ path: `test-results/large-region-${id}.png` });
  }
  await expect(
    page.getByRole("button", { name: /Zoom region|Fit area/ }),
  ).toHaveCount(0);
  const originalY = Number(await map.getAttribute("data-map-y"));
  await page.mouse.move(1000, 650);
  await page.mouse.wheel(0, -250);
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-y")))
    .toBe(originalY + 250);
  expect(await worldTransform(page)).not.toContain("scale");
  const wheelX = Number(await map.getAttribute("data-map-x"));
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-x")))
    .toBe(wheelX - 100);
  const previousX = Number(await map.getAttribute("data-map-x"));
  await page.mouse.move(1000, 650);
  await page.mouse.down();
  await page.mouse.move(1090, 720, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await map.getAttribute("data-map-x")))
    .toBeGreaterThan(previousX);
  await expect(page.locator(".workbench")).toHaveCount(0);
  const saved = await worldTransform(page);
  await nav.getByRole("button", { name: "Neon District", exact: true }).click();
  await nav.getByRole("button", { name: "Zero-Day Core", exact: true }).click();
  expect(await worldTransform(page)).toEqual(saved);
  await map.focus();
  const fixed = await worldTransform(page);
  await page.keyboard.press("+");
  await page.keyboard.press("-");
  expect(await worldTransform(page)).toEqual(fixed);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Centre", exact: true }).click();
  const mobile = await page.locator(".region-map-viewport").boundingBox();
  await expect(page.locator(".region-map-world")).toHaveCSS(
    "width",
    `${mobile!.width * 4}px`,
  );
  await expect(page.locator(".region-map-world")).toHaveCSS(
    "height",
    `${mobile!.height * 4}px`,
  );
  await map.focus();
  const before = await map.getAttribute("data-map-x");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => map.getAttribute("data-map-x")).not.toBe(before);
  await page.screenshot({ path: "test-results/large-region-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
async function worldTransform(page: import("@playwright/test").Page) {
  return page
    .locator(".region-map-world")
    .evaluate((node) => (node as HTMLElement).style.transform);
}

test("panning never submits a catch and clicking a visible bug still opens its own question", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "region-field", category: "ARRAYS" },
  });
  await expect(page.locator("button.target")).toHaveCount(30);
  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Neon District", exact: true })
    .click();
  let openings = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/open") && request.method() === "POST")
      openings++;
  });
  await page.mouse.move(900, 650);
  await page.mouse.down();
  await page.mouse.move(1040, 700, { steps: 7 });
  await page.mouse.up();
  await page.mouse.move(1100, 730);
  expect(openings).toBe(0);
  const stopped = await worldTransform(page);
  await page.mouse.move(800, 600);
  expect(await worldTransform(page)).toBe(stopped);
  await page.getByRole("button", { name: "Centre", exact: true }).click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const point = await page.evaluate(async () => {
    const source = "/src/region-map.ts",
      { regionTarget, mapBounds } = await import(source),
      b = mapBounds(innerWidth, innerHeight),
      p = regionTarget(14, 30, b),
      root = document.querySelector(".region-arena") as HTMLElement;
    const x = b.left + Number(root.dataset.mapX) + p.x,
      y = b.top + Number(root.dataset.mapY) + p.y;
    return {
      x: innerWidth / 2 + ((x - innerWidth / 2) * 10) / 9.8,
      y: innerHeight / 2 + ((y - innerHeight / 2) * 10) / 9.8,
    };
  });
  await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole("heading", { name: "Region test bug 15", exact: true }),
  ).toBeVisible();
  expect(openings).toBe(1);
});

test("bugs roam beyond their starting cells and the camera finds a cleared roaming target", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "region-field", category: "ARRAYS" },
  });
  const targets = page.locator("button.target[data-region=neon]");
  await expect(targets).toHaveCount(30);
  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Neon District", exact: true })
    .click();
  await page.mouse.move(20, 200);
  const ids = await targets.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.bountyId!),
  );
  const sample = (seconds = 0) =>
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
  await expect.poll(async () => (await sample()).length).toBe(30);
  const before = await sample(),
    after = await sample(180);
  const box = await page.locator(".region-arena").boundingBox();
  const b = await page.evaluate(async ({ width, height }) => {
    const source = "/src/region-map.ts",
      { mapBounds } = await import(source);
    return mapBounds(width, height);
  }, box!);
  expect(
    after.some((s, i) => Math.abs(s.point.x - before[i].point.x) > b.width),
  ).toBe(true);
  expect(
    after.some((s, i) => Math.abs(s.point.y - before[i].point.y) > b.height),
  ).toBe(true);
  await page.screenshot({ path: "test-results/free-roaming-neon.png" });
  const offscreen = after.find((s) => !s.visible);
  expect(offscreen).toBeDefined();
  const target = page.locator(
      `button.target[data-bounty-id="${offscreen!.id}"]`,
    ),
    title = await target.locator("strong").innerText();
  await target.click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your private code", exact: true })
    .fill("int main() {}\n");
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Target cleared", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".termination-banner")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await expect(page.locator(".termination-banner")).toBeVisible();
  await expect
    .poll(async () => {
      const s = (await sample()).find((s) => s.id === offscreen!.id);
      return (
        !!s?.visible &&
        s.point.x > b.left &&
        s.point.x < b.left + b.width &&
        s.point.y > b.top &&
        s.point.y < b.top + b.height
      );
    })
    .toBe(true);
  await expect(target).toHaveAttribute("data-cleared", "true");
});

test("Neon is a live 2D circuit world with cached creatures and no city image", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "region-field", category: "ARRAYS" },
  });
  await expect(page.locator("button.target[data-region=neon]")).toHaveCount(30);
  const nav = page.getByRole("navigation", { name: "Arena regions" });
  await nav.getByRole("button", { name: "Neon District", exact: true }).click();
  await expect(page.locator(".neon-runtime")).toBeVisible();
  await expect(
    page.locator(".neon-runtime img, .neon-runtime image"),
  ).toHaveCount(0);
  await expect(page.locator(".neon-code-module").first()).toBeAttached();
  await expect(page.locator(".neon-runtime-core")).toContainText(
    "RUNTIME / CORE",
  );
  await expect(page.locator("canvas[data-neon-creature]")).toHaveCount(30);
  const packet = page.locator(".neon-data-packet").first();
  await expect(page.locator(".neon-data-packet")).toHaveCount(18);
  await expect(packet).toHaveCSS("animation-play-state", "paused");
  const plates = await page.evaluate(async () => {
    const source = "/src/neon-creatures.ts",
      { neonPlate, neonBodies } = await import(source);
    const gallery = document.createElement("canvas");
    gallery.id = "neon-art-inspection";
    gallery.width = 1200;
    gallery.height = 240;
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:99999;width:1200px;height:240px";
    const c = gallery.getContext("2d")!;
    c.fillStyle = "#071126";
    c.fillRect(0, 0, 1200, 240);
    const results = Object.keys(neonBodies).map((motion, i) => {
      c.drawImage(neonPlate(motion), i * 200, 0, 200, 200);
      c.fillStyle = "#a1ebff";
      c.font = "14px monospace";
      c.fillText(motion, i * 200 + 66, 220);
      return [
        "all",
        "body",
        "left",
        "right",
        ...(["FLY", "DART"].includes(motion) ? ["leftWing", "rightWing"] : []),
      ].every((part) => {
        const plate = neonPlate(motion, part),
          data = plate.getContext("2d")!.getImageData(0, 0, 256, 256).data;
        let opaque = 0;
        for (let p = 3; p < data.length; p += 4) if (data[p] > 32) opaque++;
        return (
          plate === neonPlate(motion, part) && opaque > 100 && opaque < 50000
        );
      });
    });
    document.body.append(gallery);
    return results;
  });
  expect(plates).toEqual(Array(6).fill(true));
  await page
    .locator("#neon-art-inspection")
    .screenshot({ path: "test-results/neon-creature-gallery.png" });
  await page.locator("#neon-art-inspection").evaluate((node) => node.remove());
  await page.screenshot({ path: "test-results/neon-runtime-desktop.png" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  await expect(packet).toHaveCSS("animation-play-state", "running");
  const original = await packet.evaluate(
    (node) => getComputedStyle(node).offsetDistance,
  );
  await expect
    .poll(() =>
      packet.evaluate((node) => getComputedStyle(node).offsetDistance),
    )
    .not.toBe(original);
  await page
    .getByRole("button", { name: "Reduce target motion", exact: true })
    .click();
  await expect(packet).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Centre", exact: true }).click();
  await page.screenshot({ path: "test-results/neon-runtime-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const name of ["Silicon Hive", "Verdant Nexus", "Zero-Day Core"]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".neon-runtime")).toHaveCount(0);
    await expect(page.locator(".cybercity > svg")).toHaveCount(1);
  }
});

test("rendered creature wings, legs and bodies articulate, then hold on pause and hover", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "region-field", category: "ARRAYS" },
  });
  await expect(page.locator("button.target[data-region=neon]")).toHaveCount(30);
  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Neon District", exact: true })
    .click();
  await page.mouse.move(20, 200);
  const creatures = await page.locator("button.target").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: (node as HTMLElement).dataset.bountyId!,
      motion: (node as HTMLElement).dataset.motion!,
    })),
  );
  const sample = (ids: string[]) =>
    page.evaluate(async (currentIds) => {
      const source = "/test/scene-probe.ts",
        { motionState } = await import(source);
      return motionState(currentIds);
    }, ids);
  const modes = new Map<string, string>();
  for (const creature of creatures)
    if (!modes.has(creature.motion)) modes.set(creature.motion, creature.id);
  expect(modes.size).toBe(6);
  for (const [motion, id] of modes) {
    await expect.poll(async () => (await sample([id])).length).toBe(1);
    const first = (await sample([id]))[0];
    if (motion === "FLY" || motion === "DART")
      expect(first.wing.geometry).toEqual(["PlaneGeometry"]);
    await expect
      .poll(async () => {
        await page.evaluate(async () => {
          const source = "/test/scene-probe.ts",
            { advanceScene } = await import(source);
          advanceScene(0.5);
        });
        const now = (await sample([id]))[0];
        if (motion === "FLY" || motion === "DART")
          return Math.abs(now.wing.fold - first.wing.fold) > 0.3;
        if (motion === "DRAG")
          return Math.abs(now.body.scaleY - first.body.scaleY) > 0.08;
        if (motion === "HOP")
          return Math.abs(now.elevation.z - first.elevation.z) > 0.1;
        return Math.abs(now.legs[0].foot[1] - first.legs[0].foot[1]) > 0.06;
      })
      .toBe(true);
    const now = (await sample([id]))[0];
    expect(now.legs.length).toBe(motion === "SKITTER" ? 8 : 6);
    for (let i = 0; i < now.legs.length; i++) {
      expect(
        Math.hypot(
          ...now.legs[i].hip.map(
            (v: number, j: number) => v - first.legs[i].hip[j],
          ),
        ),
      ).toBeLessThan(1e-6);
    }
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
  const ids = [...modes.values()],
    frozen = await sample(ids);
  await page.waitForTimeout(300);
  expect(await sample(ids)).toEqual(frozen);
  await page
    .getByRole("button", { name: "Enable animated targets", exact: true })
    .click();
  const flyingId = modes.get("FLY")!,
    fold = (await sample([flyingId]))[0].wing.fold;
  await expect
    .poll(async () => (await sample([flyingId]))[0].wing.fold)
    .not.toBe(fold);
  const visible = (await sample(creatures.map((c) => c.id))).find(
    (s: any) =>
      s.visible &&
      s.point.x > 420 &&
      s.point.x < 1300 &&
      s.point.y > 350 &&
      s.point.y < 780,
  );
  expect(visible).toBeDefined();
  const title = await page
    .locator(`[data-bounty-id="${visible.id}"] strong`)
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
  const hovered = await sample([visible.id]);
  await page.waitForTimeout(250);
  expect(await sample([visible.id])).toEqual(hovered);
  await page.mouse.click(visible.point.x, visible.point.y);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
});

test("Zero-Day panels, grippers and memory chambers articulate", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "region-field", category: "LOGIC" },
  });
  await expect(page.locator("button.target[data-region=cryo]")).toHaveCount(30);
  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Zero-Day Core", exact: true })
    .click();
  await page.mouse.move(20, 200);
  for (const motion of ["FLY", "WALK", "DRAG"]) {
    const id = await page
      .locator(`button.target[data-motion="${motion}"]`)
      .first()
      .getAttribute("data-bounty-id");
    const sample = () =>
      page.evaluate(async (targetId) => {
        const source = "/test/scene-probe.ts",
          { motionState } = await import(source);
        return motionState([targetId])[0];
      }, id);
    await expect.poll(async () => !!(await sample())?.body).toBe(true);
    const first = await sample();
    await expect
      .poll(async () => {
        const now = await sample();
        return motion === "FLY"
          ? Math.abs(now.wing.fold - first.wing.fold) > 0.06
          : motion === "WALK"
            ? Math.abs(now.legs[0].foot[1] - first.legs[0].foot[1]) > 0.06
            : JSON.stringify(now.zeroDay.parts) !==
              JSON.stringify(first.zeroDay.parts);
      })
      .toBe(true);
  }
});

test("walking and crawling face actual travel with fixed hip joints and bone lengths", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "region-field", category: "ARRAYS" },
  });
  await expect(page.locator("button.target[data-region=neon]")).toHaveCount(30);
  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Neon District", exact: true })
    .click();
  await page.mouse.move(20, 200);
  for (const motion of ["WALK", "DRAG"]) {
    const id = await page
      .locator(`button.target[data-motion="${motion}"]`)
      .first()
      .getAttribute("data-bounty-id");
    let observations = 0;
    await expect
      .poll(
        async () => {
          const pair = await page.evaluate(async (currentId) => {
            const source = "/test/scene-probe.ts",
              { motionState } = await import(source),
              before = motionState([currentId])[0];
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
            return { before, after: motionState([currentId])[0] };
          }, id);
          const { before: a, after: b } = pair;
          if (!a || !b) return observations;
          for (let i = 0; i < a.legs.length; i++) {
            for (const [p, q] of [
              ["hip", "knee"],
              ["knee", "foot"],
            ]) {
              const length = (leg: any) =>
                Math.hypot(
                  ...leg[p].map((v: number, j: number) => v - leg[q][j]),
                );
              expect(
                Math.abs(length(a.legs[i]) - length(b.legs[i])),
              ).toBeLessThan(1e-6);
            }
            expect(
              Math.hypot(
                ...a.legs[i].hip.map(
                  (v: number, j: number) => v - b.legs[i].hip[j],
                ),
              ),
            ).toBeLessThan(1e-6);
          }
          const dx = b.ground[0] - a.ground[0],
            dy = b.ground[1] - a.ground[1],
            length = Math.hypot(dx, dy);
          if (length > 1e-5 && Math.abs(b.heading - a.heading) < 0.05) {
            expect(
              (dx * -Math.sin(b.heading) + dy * Math.cos(b.heading)) / length,
            ).toBeGreaterThan(0.98);
            observations++;
          }
          return observations;
        },
        { timeout: 15000, intervals: [100, 150, 250] },
      )
      .toBeGreaterThan(3);
  }
});
