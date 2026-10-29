import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

async function enter(page: Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(8));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page
    .getByRole("button", { name: "Confirm and enter", exact: true })
    .click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}

test("search, topic tags, availability and difficulty sort keep original target identity and question access", async ({
  page,
}) => {
  await enter(page);
  const data = (
    await (
      await page.request.post("/api/v1/live/snapshot", {
        data: { sync_id: randomUUID() },
      })
    ).json()
  ).data;
  const bugs = data.bounties as {
    bounty_id: string;
    category: string;
    difficulty: number;
    title: string;
  }[];
  const targets = page.locator("button.target"),
    dock = page.getByRole("complementary", { name: "Bounty targets" });
  if (process.env.INGENIUM_PREVIEW_ROUND === "2")
    await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(targets).toHaveCount(bugs.length);
  await expect(
    page.getByLabel("Search questions", { exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByLabel("Sort questions", { exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page
    .getByLabel("Sort questions", { exact: true })
    .selectOption("easiest");
  const difficulties = await targets.evaluateAll((nodes) =>
    nodes.map((n) => Number(n.getAttribute("data-difficulty"))),
  );
  expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
  const firstId = await targets.first().getAttribute("data-bounty-id");
  await expect(targets.first().locator(".target-number")).toHaveText(
    String(bugs.findIndex((b) => b.bounty_id === firstId) + 1).padStart(2, "0"),
  );
  await page
    .getByLabel("Sort questions", { exact: true })
    .selectOption("hardest");
  const hard = await targets.evaluateAll((nodes) =>
    nodes.map((n) => Number(n.getAttribute("data-difficulty"))),
  );
  expect(hard).toEqual([...hard].sort((a, b) => b - a));
  await page.locator(".question-filters > summary").click();
  await page
    .getByRole("button", { name: "Arrays & strings", exact: true })
    .click();
  await expect(targets).toHaveCount(
    bugs.filter((b) => b.category === "ARRAYS").length,
  );
  await expect(dock.locator(".dock-heading")).toContainText(`/ ${bugs.length}`);
  await page
    .getByRole("button", { name: "Systems & memory", exact: true })
    .click();
  await expect(targets).toHaveCount(
    bugs.filter((b) => ["ARRAYS", "SYSTEMS"].includes(b.category)).length,
  );
  await page
    .getByLabel("Search questions", { exact: true })
    .fill("nothing matches this title");
  await expect(targets).toHaveCount(0);
  await expect(dock.getByRole("status")).toContainText("No questions match");
  if (process.env.INGENIUM_PREVIEW_ROUND === "2")
    await expect(page.locator("canvas.kernel-canvas")).toHaveAttribute(
      "data-actors",
      "100",
    );
  await page
    .getByRole("button", { name: "Clear filters & sort", exact: true })
    .click();
  await expect(targets).toHaveCount(bugs.length);
  await expect(page.getByLabel("Sort questions", { exact: true })).toHaveValue(
    "default",
  );
  await targets.first().click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await expect(page.locator(".workbench h2")).toHaveText(bugs[0].title);
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await page
    .getByLabel("Filter question status", { exact: true })
    .selectOption("captured");
  await expect(targets).toHaveCount(1);
  await expect(targets.first()).toHaveAttribute(
    "data-bounty-id",
    bugs[0].bounty_id,
  );
  await page
    .getByLabel("Filter question status", { exact: true })
    .selectOption("closed");
  await expect(targets).toHaveCount(0);
  await page.request.post("/api/v1/_fixture", {
    data: { action: "claim", bounty: bugs[1].bounty_id },
  });
  await expect(targets).toHaveCount(1);
  await expect(targets.first()).toHaveAttribute(
    "data-bounty-id",
    bugs[1].bounty_id,
  );
  await page
    .getByRole("button", { name: "Clear filters & sort", exact: true })
    .click();
  await expect(targets).toHaveCount(bugs.length);
});

test("the collapsible leaderboard shows five names and the own team's actual rank, follows updates and fits mobile", async ({
  page,
}) => {
  let ownRank = 8,
    cancelled = false;
  await page.route(/\/api\/v1\/live\/(snapshot|projection)$/, async (route) => {
    const response = await route.fetch(),
      body = await response.json();
    const own = { ...body.data.hud.standing, rank: ownRank };
    body.data.hud.standing = own;
    body.data.standings = Array.from({ length: 9 }, (_, i) =>
      i + 1 === ownRank
        ? own
        : {
            ...own,
            team_id: `synthetic-${i}`,
            team_round_id: `synthetic-round-${i}`,
            team_name: `Demo team ${i + 1}`,
            rank: i + 1,
          },
    );
    if (cancelled) body.data.round.state = "CANCELLED";
    await route.fulfill({ response, json: body });
  });
  await enter(page);
  const board = page.getByRole("complementary", { name: "Arena leaderboard" });
  await expect(board.getByRole("listitem")).toHaveCount(5);
  await expect(board.locator("li .arena-standing-name")).toHaveText([
    "Demo team 1",
    "Demo team 2",
    "Demo team 3",
    "Demo team 4",
    "Demo team 5",
  ]);
  await expect(board.getByLabel("Your team ranking")).toContainText("#8");
  await expect(board.getByLabel("Your team ranking")).toContainText(
    "Segfault Society",
  );
  await page.screenshot({ path: "test-results/arena-leaderboard-desktop.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    page.getByLabel("Search questions", { exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByLabel("Sort questions", { exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: "test-results/arena-leaderboard-compact.png" });
  const minimap = (await page.locator(".kernel-map-tools").count())
    ? await page.locator(".kernel-map-tools").boundingBox()
    : null;
  if (minimap) {
    const panel = (await board.boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(minimap.y + minimap.height);
  }
  await board
    .getByRole("button", { name: "Collapse leaderboard", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(board.getByRole("list")).toBeHidden();
  await expect(
    board.getByRole("button", { name: "Expand leaderboard", exact: true }),
  ).toContainText("#8");
  await board
    .getByRole("button", { name: "Expand leaderboard", exact: true })
    .click();
  ownRank = 3;
  await page.request.post("/api/v1/_fixture", { data: { action: "pause" } });
  await expect(board.getByLabel("Your team ranking")).toContainText("#3");
  await expect(board.locator("li[data-own]")).toContainText("Segfault Society");
  await board
    .getByRole("button", { name: "Full leaderboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Live standings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    board.getByRole("button", { name: "Collapse leaderboard", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/arena-leaderboard-mobile.png" });
  await board
    .getByRole("button", { name: "Collapse leaderboard", exact: true })
    .click();
  await expect(
    board.getByRole("button", { name: "Expand leaderboard", exact: true }),
  ).toBeInViewport();
  cancelled = true;
  await page.request.post("/api/v1/_fixture", { data: { action: "resume" } });
  await board
    .getByRole("button", { name: "Expand leaderboard", exact: true })
    .click();
  await expect(board.getByRole("listitem")).toHaveCount(0);
  await expect(board).toContainText("No competitive ranking");
  await expect(board.getByLabel("Your team ranking")).toContainText("—");
});
