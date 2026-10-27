import { test, expect, type Page } from "@playwright/test";

const first = "00000000-0000-4000-8000-000000000100",
  second = "00000000-0000-4000-8000-000000000101";

async function enter(page: Page) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page.getByRole("button", { name: "Confirm and enter" }).click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}

test("a fresh preview entry renews an aged demo round; map and list open real question content and retain saved code", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await page.locator(`button.target[data-bounty-id="${first}"]`).click();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  const editor = page.getByRole("textbox", {
      name: "Your private code",
      exact: true,
    }),
    saved = "// retained across demo re-entry\nint main() {}\n";
  await editor.fill(saved);
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("saved");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  await page.request.post("/api/v1/_fixture", {
    data: { action: "age-round", ms: 10800000 },
  });
  await expect(page.locator(".hud-timer strong")).toHaveText("00:00:00");
  await page.locator(`button.target[data-bounty-id="${second}"]`).click();
  await expect(page.getByRole("alert")).toContainText(
    "Catching is unavailable",
  );
  await expect(page.locator(".workbench")).toHaveCount(0);

  await page.request.post("/api/v1/_fixture", { data: { action: "expire" } });
  await expect(
    page.getByRole("heading", { name: "Session unavailable", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to entry", exact: true })
    .click();
  await enter(page);
  await expect(page.locator(".hud-timer strong")).not.toHaveText("00:00:00");
  await page.locator(`button.target[data-bounty-id="${second}"]`).click();
  await expect(
    page.getByRole("heading", { name: "Off by one", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".statement")).toContainText("Repair the program");
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(editor).not.toHaveValue("");
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();

  await page
    .getByRole("navigation", { name: "Arena regions" })
    .getByRole("button", { name: "Neon District", exact: true })
    .click();
  const position = () =>
    page.evaluate(async (id) => {
      const source = "/test/scene-probe.ts",
        { motionState } = await import(source);
      return motionState([id])[0]?.point;
    }, first);
  await expect.poll(position).toBeTruthy();
  for (let i = 0; i < 12; i++) {
    const point = (await position())!;
    if (point.x > 500 && point.x < 1220 && point.y > 380 && point.y < 750)
      break;
    const direction =
      point.x < 500
        ? "left"
        : point.x > 1220
          ? "right"
          : point.y < 380
            ? "up"
            : "down";
    await page
      .getByRole("button", { name: `Pan region ${direction}`, exact: true })
      .click();
  }
  const point = (await position())!;
  await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole("heading", { name: "The silent overflow", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".statement")).toContainText("Repair the program");
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  await expect(editor).toHaveValue(saved);
});
