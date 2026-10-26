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
  await expect(page.locator("button.target")).toHaveCount(6);
  await page.screenshot({ path: "test-results/restored-four-regions.png" });
  const nav = page.getByRole("navigation", { name: "Arena regions" });
  for (const [id, name] of [
    ["neon", "Neon District"],
    ["foundry", "Ember Foundry"],
    ["verdant", "Verdant Circuit"],
    ["cryo", "Cryo Vault"],
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".world-scenery")).toHaveAttribute(
      "data-world-view",
      id,
    );
    await expect(page.locator(".cybercity > svg")).toHaveCount(1);
    await expect(page.locator("button.target")).toHaveCount(6);
    await page.screenshot({ path: `test-results/restored-${id}.png` });
  }
  await nav.getByRole("button", { name: "World map", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-region-tile]")).toHaveCount(4);
  await page.screenshot({ path: "test-results/restored-regions-mobile.png" });
  await page
    .getByRole("button", { name: "Enter Verdant Circuit", exact: true })
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
  await nav.getByRole("button", { name: "Cryo Vault", exact: true }).click();
  await target.click();
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
  await nav
    .getByRole("button", { name: "Verdant Circuit", exact: true })
    .click();
  await target.click();
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
