import { test, expect } from "@playwright/test";
import { roundOnePack } from "../../../../content/round-1/load";
test.skip(
  process.env.INGENIUM_PREVIEW_FIXTURES !== "round1",
  "Run with INGENIUM_PREVIEW_FIXTURES=round1 for real content; other visual suites use isolated fixtures.",
);
test("real Round 1 pack exposes fifty missions across four regions, language-correct starters and private hints", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await expect(
    page.getByLabel("Language", { exact: true }).locator("option"),
  ).toHaveCount(4);
  await page.getByLabel("Language", { exact: true }).selectOption("python");
  await page
    .getByRole("button", { name: "Confirm and enter", exact: true })
    .click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await expect(page.locator("button.target")).toHaveCount(50);
  await expect(page.locator(".target-dock")).not.toContainText("Dummy");
  for (const [region, category, count] of [
    ["neon", "ARRAYS", 13],
    ["foundry", "SYSTEMS", 13],
    ["verdant", "GRAPHS", 12],
    ["cryo", "LOGIC", 12],
  ] as const) {
    await expect(
      page.locator('button.target[data-region="' + region + '"]'),
    ).toHaveCount(count);
    const q = roundOnePack.questions.find((q) => q.category === category)!;
    const path =
      "/api/v1/competition/rounds/00000000-0000-4000-8000-000000000001/bounties/" +
      q.id;
    await page.locator('[data-map-bounty="' + q.id + '"]').click();
    await page
      .getByRole("button", { name: "Open question", exact: true })
      .click();
    await expect(page.locator(".workbench h2")).toHaveText(q.title);
    await expect(page.locator(".statement")).toContainText("AEGIS");
    await expect(page.locator(".statement")).toContainText(
      "What the code should do",
    );
    await expect(page.locator(".statement")).toContainText(
      "What's going wrong",
    );
    await expect(page.locator(".statement")).toContainText(
      "How to read the code",
    );
    await expect(page.locator(".statement")).toContainText("Example explained");
    await expect(page.locator(".statement h4")).toHaveCount(8);
    expect(await page.locator(".statement code").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Plain text", exact: true }).click();
    const code = page.getByRole("textbox", {
      name: "Your private code",
      exact: true,
    });
    await expect(code).toHaveValue(q.variants.python.starter_code);
    if (region === "neon")
      await page.screenshot({
        path: "test-results/round1-readable-workbench.png",
      });
    const metadata = await (await page.request.get(path)).json();
    expect(JSON.stringify(metadata)).not.toMatch(
      /reference_solution|defect_description|HIDDEN/,
    );
    expect(
      (await (await page.request.get(path + "/hints")).json()).data,
    ).toEqual([]);
    await page.getByRole("button", { name: "Sample 1", exact: true }).click();
    await expect(page.locator(".sample pre").first()).toHaveText(
      q.cases[0].input_data.trimEnd(),
    );
    await page.getByRole("button", { name: /Run samples/ }).click();
    await expect(page.locator(".feedback-sample")).toHaveCount(2);
    await page.getByRole("button", { name: "hints 0/3", exact: true }).click();
    await expect(page.locator(".hint")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Purchase hint", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm purchase", exact: true })
      .click();
    await expect(page.locator(".hint").first()).toContainText(
      q.hints[0].content.replaceAll("`", ""),
    );
    const owned = await (await page.request.get(path + "/hints")).json();
    expect(owned.data).toEqual([q.hints[0]]);
    await code.fill("# participant edits");
    await page.getByRole("button", { name: "Reset code", exact: true }).click();
    await page
      .getByRole("button", { name: "Restore original code", exact: true })
      .click();
    await expect(code).toHaveValue(q.variants.python.starter_code);
    await page
      .getByRole("button", { name: "Close workbench", exact: true })
      .click();
  }
  const path =
    "/@fs/" +
    process
      .cwd()
      .replaceAll("\\", "/")
      .replace(/\/apps\/web$/, "") +
    "/content/round-1/pack.json";
  const blocked = await page.request.get(path);
  expect([403, 404]).toContain(blocked.status());
  const evidence = await page.request.get(
    path.replace(
      "content/round-1/pack.json",
      "apps/api/test-results/round1-linux/final-report.json",
    ),
  );
  expect([403, 404]).toContain(evidence.status());
  await page.screenshot({ path: "test-results/round1-real-map.png" });
});
