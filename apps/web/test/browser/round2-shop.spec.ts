import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { syncRoamers } from "../../src/bug-swarm";
import { kernelSpecs, kernelWorld } from "../../src/kernel-art";
import { roundTwoBugs, roundTwoPack } from "../../../../content/round-2/load";
import { writeFile } from "node:fs/promises";
// Trace screenshots distort the rendering probe in this file.
test.use({ trace: "off" });
test.skip(
  process.env.INGENIUM_PREVIEW_ROUND !== "2",
  "Run with INGENIUM_PREVIEW_ROUND=2 for the isolated shop preview.",
);
async function enter(page: any) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page
    .getByRole("button", { name: "Confirm and enter", exact: true })
    .click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await expect(page.locator(".topbar-center")).toContainText("ROUND 02");
}
async function buy(page: any, id: string) {
  await page
    .locator(`[data-item="${id}"]`)
    .getByRole("button", { name: /Acquire & activate|Buy & hold/ })
    .click();
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(page.locator(".shop-notice")).toContainText(
    /activated|inventory/,
  );
}
async function useGear(page: any, name: string) {
  await page
    .getByRole("region", { name: "Use held items" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await page.getByRole("button", { name: "Confirm use", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Use held items" }),
  ).toContainText("No additional coins charged");
}
async function openFirst(page: any) {
  await page.locator("button.target").first().click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
}
test("seven approved items can be bought, activated and retained after reload with correct coin prices", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await expect(page.locator(".shop-card")).toHaveCount(7);
  await expect(page.getByLabel(/target bug/)).toHaveCount(0);
  await expect(page.locator(".shop-wallet strong")).toContainText("35,000");
  await page.screenshot({ path: "test-results/round2-shop-desktop.png" });
  for (const id of [
    "boundary-probe",
    "hex-scanner",
    "overdrive-core",
    "ghost-scan",
    "chrono-shield",
    "claim-lock",
    "black-ice",
  ])
    await buy(page, id);
  await expect(page.locator(".shop-inventory")).toContainText(
    "Held · use on a question",
  );
  await expect(page.locator(".shop-wallet strong")).toContainText("9,350");
  await expect(page.locator(".shop-inventory li")).toHaveCount(7);
  await expect(page.locator('[data-item="black-ice"] button')).toHaveText(
    "Acquired",
  );
  await page.reload();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await expect(page.locator(".shop-inventory li")).toHaveCount(7);
  await expect(page.locator(".shop-wallet strong")).toContainText("9,350");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const first = page.locator("button.target").first();
  await first.click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Purchased gear intelligence" }),
  ).toHaveCount(0);
  await useGear(page, "Hex Scanner");
  await useGear(page, "Boundary Probe");
  await expect(
    page.getByRole("region", { name: "Purchased gear intelligence" }),
  ).toContainText("Hex Scanner");
  await expect(
    page.getByRole("region", { name: "Purchased gear intelligence" }),
  ).toContainText("Boundary Probe");
});

test("Overdrive lights only equipped team names, survives reload and respects reduced motion", async ({
  page,
}) => {
  let rivalOverdrive = false;
  await page.route(/\/api\/v1\/live\/(snapshot|projection)$/, async (route) => {
    const response = await route.fetch(),
      body = await response.json();
    const own = body.data.hud.standing.team_id;
    for (const row of body.data.standings)
      if (row.team_id !== own) row.overdrive = rivalOverdrive;
    await route.fulfill({ response, json: body });
  });
  await enter(page);
  const board = page.getByRole("complementary", { name: "Arena leaderboard" });
  const launcher = page.getByRole("button", {
    name: "Black Market",
    exact: true,
  });
  await expect(launcher.locator(".shop-launch-mark svg")).toBeVisible();
  await expect(board.locator(".overdrive-name")).toHaveCount(0);
  await launcher.click();
  await buy(page, "overdrive-core");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(board.locator("li[data-own] .overdrive-name")).toHaveText(
    "Segfault Society",
  );
  await expect(
    board.locator(".arena-standing-self .overdrive-name"),
  ).toHaveText("Segfault Society");
  await expect(board.locator("li:not([data-own]) .overdrive-name")).toHaveCount(
    0,
  );
  await expect(page.locator(".hud-score").first()).toContainText("0");
  await page.reload();
  await expect(
    board.locator(".arena-standing-self .overdrive-name"),
  ).toBeVisible();
  await expect(board.locator("li:not([data-own]) .overdrive-name")).toHaveCount(
    0,
  );
  await board
    .getByRole("button", { name: "Full leaderboard", exact: true })
    .click();
  await expect(
    page.locator(".leaderboard .own-standing .overdrive-name"),
  ).toHaveText("Segfault Society");
  await expect(page.locator(".leaderboard .overdrive-name")).toHaveCSS(
    "animation-name",
    "overdrive-name-glow",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.screenshot({ path: "test-results/overdrive-leaderboard.png" });
  rivalOverdrive = true;
  await page.request.post("/api/v1/_fixture", { data: { action: "pause" } });
  await expect(board.locator("li:not([data-own]) .overdrive-name")).toHaveText(
    "Bit Shift",
  );
  rivalOverdrive = false;
  await page.request.post("/api/v1/_fixture", { data: { action: "resume" } });
  await expect(board.locator("li:not([data-own]) .overdrive-name")).toHaveCount(
    0,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(board.locator(".arena-standing-self .overdrive-name")).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(
    await board
      .locator(".arena-standing-self .overdrive-name")
      .evaluate((el) => getComputedStyle(el).textShadow),
  ).not.toBe("none");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(launcher).toBeInViewport();
  await expect(launcher.locator(".shop-launch-mark svg")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/overdrive-mobile.png" });
});

test("Hex Scanner keeps its authored original-code trace after draft edits and reload, at the approved price", async ({
  page,
}) => {
  await enter(page);
  const question = roundTwoPack.questions[0],
    section = question.paid_intel.scanner.cpp;
  const original = question.variants.cpp.starter_code;
  const snippet = original
    .split("\n")
    .slice(section.from_line - 1, section.to_line)
    .join("\n");
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await buy(page, "hex-scanner");
  await expect(page.locator(".shop-wallet strong")).toContainText("34,250");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await openFirst(page);
  const intel = page.getByRole("region", {
    name: "Purchased gear intelligence",
  });
  await expect(intel).toHaveCount(0);
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  const edited = "// extra line one\n// extra line two\n" + original;
  await editor.fill(edited);
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("saved");
  await useGear(page, "Hex Scanner");
  await expect(
    intel.getByRole("heading", {
      name: `Hex Scanner · ${section.label}`,
      exact: true,
    }),
  ).toBeVisible();
  expect(await intel.locator("pre").first().textContent()).toBe(snippet);
  await expect(intel).toContainText("Your edits do not change this trace");
  await expect(editor).toHaveValue(edited);
  await page.reload();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await openFirst(page);
  expect(await intel.locator("pre").first().textContent()).toBe(snippet);
  await expect(page.locator(".hud-score.wallet")).toContainText("34,250");
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(editor).toHaveValue(edited);
});
test("scan updates, protected claims, freeze gates and lost purchase recovery remain server-controlled", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await buy(page, "ghost-scan");
  await expect
    .poll(() => page.locator("button.target.scan-clear").count())
    .toBeGreaterThan(0);
  await buy(page, "claim-lock");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await openFirst(page);
  await useGear(page, "Claim Lock");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await page.getByText("Local preview controls", { exact: true }).click();
  await page
    .getByRole("button", { name: "Rival claims protected bug", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const first = page.locator("button.target").first();
  await expect(first).toHaveAttribute("data-cleared", "false");
  const round = (
    await (
      await page.request.get("/api/v1/bootstrap?audience=PARTICIPANT")
    ).json()
  ).data.session.round_id;
  await page.request.post("/api/v1/_fixture", {
    data: { action: "shop-advance", ms: 300001 },
  });
  await expect(first).toHaveAttribute("data-cleared", "true");
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await page.getByText("Local preview controls", { exact: true }).click();
  await page
    .getByRole("button", { name: "Preview incoming Black ICE", exact: true })
    .click();
  await expect(page.locator(".shop-freeze")).toContainText("BLACK ICE ACTIVE");
  await expect(
    page.locator('[data-item="overdrive-core"] button'),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Clear simulated freeze", exact: true })
    .click();
  await page.request.post("/api/v1/_fixture", { data: { action: "drop" } });
  await page.locator('[data-item="overdrive-core"] button').click();
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check purchase outcome", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check purchase outcome", exact: true })
    .click();
  await expect(page.locator(".shop-notice")).toContainText("No second charge");
  const view = (
    await (
      await page.request.get(`/api/v1/competition/rounds/${round}/shop`)
    ).json()
  ).data;
  expect(
    view.purchases.filter((p: any) => p.item_id === "overdrive-core"),
  ).toHaveLength(1);
  expect(view.wallet).toBe(28000);
});
test("shop remains readable on a small viewport and keeps wallet deductions separate from score", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await page.getByRole("button", { name: "sabotage", exact: true }).click();
  await expect(page.locator(".shop-card")).toHaveCount(1);
  await expect(page.locator('[data-item="black-ice"]')).toContainText("15,000");
  const dialog = page.getByRole("dialog", {
    name: "Black Market",
    exact: true,
  });
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
  ).toBe(true);
  await page.screenshot({ path: "test-results/round2-shop-mobile.png" });
  await page.getByRole("button", { name: "All gear", exact: true }).click();
  await buy(page, "overdrive-core");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.locator(".hud-score").first()).toContainText("0");
});
test("frozen teams keep coding and earning; shields, assistance scoring and protected receipt-time awards work in the preview", async ({
  page,
}) => {
  await enter(page);
  const bootstrap = (
    await (
      await page.request.get("/api/v1/bootstrap?audience=PARTICIPANT")
    ).json()
  ).data;
  const round = bootstrap.session.round_id,
    base = `/api/v1/competition/rounds/${round}`;
  const headers = {
    origin: new URL(page.url()).origin,
    "x-csrf-token": bootstrap.csrf_token,
  };
  const post = async (path: string, data: unknown) =>
    (await (await page.request.post(path, { headers, data })).json()).data;
  const snapshot = () =>
    post("/api/v1/live/snapshot", { sync_id: "shop-test" });
  const bugs = (await snapshot()).bounties,
    [first, second] = bugs;
  const purchase = async (item_id: string, target_id: string | null = null) => {
    const result = await post(base + "/shop/purchases", {
      item_id,
      target_id: item_id === "black-ice" ? target_id : null,
      request_key: randomUUID(),
    });
    return target_id &&
      ["claim-lock", "hex-scanner", "boundary-probe"].includes(item_id) &&
      result.result.status === "PURCHASED"
      ? post(base + "/shop/activations", {
          purchase_id: result.result.purchase_id,
          bounty_id: target_id,
          request_key: randomUUID(),
        })
      : result;
  };
  await purchase("chrono-shield");
  await purchase("hex-scanner", first.bounty_id);
  await purchase("claim-lock", second.bounty_id);
  await post("/api/v1/_fixture", { action: "shop-incoming-freeze" });
  expect(
    (await purchase("boundary-probe", first.bounty_id)).result.reason,
  ).toBe("CREDIT_FROZEN");
  expect(
    (
      await post(`${base}/bounties/${first.bounty_id}/hints`, {
        level: 1,
        request_key: randomUUID(),
      })
    ).result.reason,
  ).toBe("CREDIT_FROZEN");
  async function submit(bounty: string, source: string) {
    const receipt = await post(`${base}/bounties/${bounty}/submissions`, {
      source,
      request_key: randomUUID(),
    });
    expect(receipt.result.status).toBe("ADMITTED");
    return receipt.result.submission_id;
  }
  const done = async (id: string) =>
    expect
      .poll(
        async () =>
          (await (await page.request.get(`${base}/judging/${id}`)).json()).data
            .status,
      )
      .toBe("COMPLETED");
  const wrong = await submit(first.bounty_id, "PREVIEW_WRONG");
  await done(wrong);
  expect((await snapshot()).hud.standing.penalty_ms).toBe(0);
  const nextWrong = await submit(first.bounty_id, "PREVIEW_WRONG again");
  await done(nextWrong);
  expect((await snapshot()).hud.standing.penalty_ms).toBe(300000);
  const correct = await submit(first.bounty_id, "preview correct");
  await done(correct);
  let state = await snapshot();
  expect(state.hud.wallet).toBe(26750 + first.base_bounty);
  expect(state.hud.standing.points).toBe(first.base_bounty * 0.7);
  await post("/api/v1/_fixture", { action: "claim", bounty: second.bounty_id });
  await post("/api/v1/_fixture", { action: "judge-delay", ms: 1000 });
  const protectedJob = await submit(second.bounty_id, "preview protected fix");
  await post("/api/v1/_fixture", { action: "shop-advance", ms: 300001 });
  await done(protectedJob);
  state = await snapshot();
  expect(state.hud.wallet).toBe(26750 + first.base_bounty + second.base_bounty);
  expect(state.hud.standing.points).toBe(
    first.base_bounty * 0.7 + second.base_bounty,
  );
  expect(state.shop.frozen_until).not.toBeNull();
});

test("a bounded layered arena carries 100 varied creatures, pans without zoom, and locates any authored question", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  const canvas = page.locator("canvas.kernel-canvas");
  await expect(canvas).toHaveAttribute("data-actors", "100");
  await expect(page.locator("button.target")).toHaveCount(100);
  await expect(
    page.getByRole("navigation", { name: "Arena regions" }),
  ).toBeHidden();
  expect(
    new Set(
      await page
        .locator("button.target")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-species")),
        ),
    ).size,
  ).toBe(8);
  const before = await canvas.getAttribute("data-camera");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => canvas.getAttribute("data-camera")).not.toBe(before);
  const size = await canvas.boundingBox();
  await canvas.hover();
  await page.mouse.wheel(0, 160);
  expect(await canvas.boundingBox()).toEqual(size);
  expect(Number(await canvas.getAttribute("data-tiles"))).toBeLessThanOrEqual(
    48,
  );
  expect(Number(await canvas.getAttribute("data-drawn"))).toBeLessThan(100);
  await page
    .getByRole("button", { name: "Centre on core", exact: true })
    .click();
  await expect(
    page.locator('.kernel-body[class*="kernel-skin-"]').first(),
  ).toBeAttached();
  const movement = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const previous = new Map<Element, string>(),
          changes = new Map<Element, number>();
        let frames = 0;
        function sample() {
          document
            .querySelectorAll<HTMLElement>(".kernel-body")
            .forEach((body) => {
              const transform = body.style.transform;
              if (previous.has(body) && previous.get(body) !== transform)
                changes.set(body, (changes.get(body) ?? 0) + 1);
              previous.set(body, transform);
            });
          if (++frames < 45) requestAnimationFrame(sample);
          else resolve(Math.max(0, ...changes.values()));
        }
        requestAnimationFrame(sample);
      }),
  );
  expect(movement).toBeGreaterThan(30);
  await page.screenshot({ path: "test-results/kernel-desktop.png" });
  const last = page.locator("button.target").last();
  await last.click();
  await expect(
    page.getByRole("region", {
      name: roundTwoPack.questions.at(-1)!.title,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(page.locator(".workbench")).toContainText("Mission brief");
  await expect(
    page.getByRole("region", { name: "Use held items" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("held activation survives an unknown reply and cannot be consumed again on another question", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Black Market", exact: true }).click();
  await buy(page, "hex-scanner");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await openFirst(page);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "shop-incoming-freeze" },
  });
  await page
    .getByRole("region", { name: "Use held items" })
    .getByRole("button", { name: /Hex Scanner/ })
    .click();
  await page.request.post("/api/v1/_fixture", { data: { action: "drop" } });
  await page.getByRole("button", { name: "Confirm use", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check item outcome", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await page.locator("button.target").nth(1).click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check item outcome", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check item outcome", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Use held items" })
      .getByRole("button", { name: /Hex Scanner/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("region", { name: "Purchased gear intelligence" }),
  ).toHaveCount(0);
  await expect(page.locator(".hud-score.wallet")).toContainText("34,250");
});

test("direct creature selection, reduced-motion panning, mobile layout and a deferred purge stay usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  const canvas = page.locator("canvas.kernel-canvas");
  await expect(canvas).toHaveAttribute("data-actors", "100");
  const memory = new Map();
  const bounties = roundTwoBugs();
  syncRoamers(memory, kernelSpecs(bounties), kernelWorld);
  const actor = memory.get(bounties[0].bounty_id)!;
  await page.locator("button.target").first().click();
  await expect(
    page.getByRole("region", { name: bounties[0].title, exact: true }),
  ).toBeVisible();
  const camera = (await canvas.getAttribute("data-view"))!
      .split(",")
      .map(Number),
    box = (await canvas.boundingBox())!;
  await page.mouse.click(
    box.x + actor.x - camera[0],
    box.y + actor.y - camera[1],
  );
  await expect(page.locator(".workbench")).toBeVisible();
  await page.getByRole("button", { name: "Submit fix", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /TARGET CLEARED/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await expect(page.locator(".participant")).toHaveAttribute(
    "data-terminating",
    "true",
  );
  await expect(page.locator(".participant")).not.toHaveAttribute(
    "data-terminating",
    "true",
    { timeout: 10000 },
  );
  await expect(canvas).toHaveAttribute("data-actors", "99");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Centre on core", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/kernel-mobile.png" });
  await page
    .getByRole("button", { name: "Show target list", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Bounty targets" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hide target list", exact: true })
    .click();
});

test.describe("render budget", () => {
  test("all eight armoured families render their articulated poses", async ({
    page,
  }) => {
    await enter(page);
    await page.evaluate(async () => {
      const modulePath = "/src/kernel-art.ts";
      const art = await import(modulePath);
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 650;
      canvas.id = "kernel-creature-review";
      canvas.style.cssText =
        "position:fixed;inset:0;z-index:9999;width:1200px;height:650px;background:#081522";
      document.body.append(canvas);
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#0b1929";
      c.fillRect(0, 0, 1200, 650);
      for (let i = 0; i < 8; i++) {
        const family = art.kernelCreatures[i],
          x = 150 + (i % 4) * 300,
          y = 160 + Math.floor(i / 4) * 310;
        const appearance = {
          ...family,
          kind: i,
          seed: i + 1,
          tier: i % 4,
          size: family.size * 2.2,
        };
        const actor = {
          x,
          y,
          heading: 0,
          distance: 1.1,
          moving: true,
          motion: family.motion,
        } as any;
        art.drawKernelBug(c, actor, appearance, 1.2);
        c.fillStyle = family.color;
        c.textAlign = "center";
        c.font = "15px monospace";
        c.fillText(family.name, x, y + 113);
      }
    });
    await page
      .locator("#kernel-creature-review")
      .screenshot({ path: "test-results/kernel-creature-review.png" });
    await page.evaluate(() =>
      document.querySelector("#kernel-creature-review")?.remove(),
    );
  });
  test("100-target panning records bounded rendering work under CPU throttling", async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await enter(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const canvas = page.locator("canvas.kernel-canvas");
    await canvas.focus();
    for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(550);
    }
    const samples: Record<string, string | undefined>[] = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(1000);
      samples.push(
        await canvas.evaluate((el) => ({
          ...(el as HTMLCanvasElement).dataset,
        })),
      );
    }
    const metrics = samples.at(-1)!;
    await writeFile(
      "test-results/kernel-render-budget.json",
      JSON.stringify(
        {
          scope: "HEADLESS_DESKTOP_4X_CPU_ONLY_NOT_OLD_HARDWARE",
          ...metrics,
          samples,
        },
        null,
        2,
      ),
    );
    expect(Number(metrics.actors)).toBe(100);
    expect(Number(metrics.tiles)).toBeLessThanOrEqual(48);
    expect(Number(metrics.drawn)).toBeLessThanOrEqual(100);
    expect(Number(metrics.spriteFrames)).toBeLessThanOrEqual(256);
    // Catch the HUD rebuilding every row each tick; this is a local probe, not hardware certification.
    expect(
      samples.map((s) => Number(s.fps)).sort((a, b) => a - b)[1],
    ).toBeGreaterThan(20);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  });
});
