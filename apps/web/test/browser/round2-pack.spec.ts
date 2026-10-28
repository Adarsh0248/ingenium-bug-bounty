import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { roundTwoPack } from "../../../../content/round-2/load";

test.skip(
  process.env.INGENIUM_PREVIEW_ROUND !== "2",
  "Run with the isolated Round 2 preview.",
);

test("all 100 authored Round 2 missions are offered with four-language starters, samples, reset and protected private content", async ({
  browser,
}) => {
  test.setTimeout(120000);
  for (const language of roundTwoPack.languages) {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 1000 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await page.getByLabel("Team or staff code").fill("A".repeat(32));
      await page
        .getByRole("button", { name: "Enter arena", exact: true })
        .click();
      await page.getByRole("radio", { name: "Asha", exact: true }).check();
      await expect(
        page.getByLabel("Language", { exact: true }).locator("option"),
      ).toHaveCount(4);
      await page.getByLabel("Language", { exact: true }).selectOption(language);
      await page
        .getByRole("button", { name: "Confirm and enter", exact: true })
        .click();
      await expect(
        page.getByText("STATE VERIFIED", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("button.target")).toHaveCount(100);
      expect(
        await page
          .locator("button.target")
          .evaluateAll((nodes) =>
            nodes.map((n) => n.getAttribute("data-bounty-id")),
          ),
      ).toEqual(roundTwoPack.questions.map((q) => q.id));
      await expect(page.locator(".target-dock")).not.toContainText("Practice");
      for (const category of ["ARRAYS", "SYSTEMS", "GRAPHS", "LOGIC"]) {
        await expect(
          page.locator(`button.target[data-category="${category}"]`),
        ).toHaveCount(25);
        const q = roundTwoPack.questions.find((q) => q.category === category)!;
        const base = `/api/v1/competition/rounds/00000000-0000-4000-8000-000000010001/bounties/${q.id}`;
        const metadataResponse = await page.request.get(base);
        expect(metadataResponse.ok()).toBe(true);
        const metadata = (await metadataResponse.json()).data;
        expect(metadata.difficulty).toBe(q.difficulty);
        expect(metadata.base_bounty).toBe(q.difficulty * 10);
        expect(JSON.stringify(metadata)).not.toMatch(
          /reference_solution_code|defect_description|paid_intel|expected_output|HIDDEN/,
        );
        expect(
          (await (await page.request.get(base + "/hints")).json()).data,
        ).toEqual([]);
        await page.locator(`button.target[data-bounty-id="${q.id}"]`).click();
        await page
          .getByRole("button", { name: "Open question", exact: true })
          .click();
        await expect(page.locator(".workbench h2")).toHaveText(q.title);
        await expect(page.locator(".statement")).toContainText(
          "THE KERNEL BREACH",
        );
        await expect(page.locator(".statement")).toContainText(
          "What the code should do",
        );
        await expect(page.locator(".statement h4")).toHaveCount(8);
        expect(await page.locator(".statement code").count()).toBeGreaterThan(
          0,
        );
        await page
          .getByRole("button", { name: "Plain text", exact: true })
          .click();
        const code = page.getByRole("textbox", {
          name: "Your private code",
          exact: true,
        });
        await expect(code).toHaveValue(q.variants[language].starter_code);
        await page
          .getByRole("button", { name: "Sample 1", exact: true })
          .click();
        await expect(page.locator(".sample pre").first()).toHaveText(
          q.cases[0].input_data.trimEnd(),
        );
        if (category === "ARRAYS") {
          await code.fill(
            language === "python"
              ? "# reset test\nprint(0)\n"
              : "// reset test\nint main() {}\n",
          );
          await page
            .getByRole("button", { name: "Save private draft", exact: true })
            .click();
          await expect(page.locator(".save-status")).toHaveText("saved");
          await page
            .getByRole("button", { name: "Reset code", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Restore original code", exact: true })
            .click();
          await expect(
            page.getByRole("dialog", {
              name: "Reset to original code?",
              exact: true,
            }),
          ).toHaveCount(0);
          await expect(page.locator(".save-status")).toHaveText("saved");
          await expect(code).toHaveValue(q.variants[language].starter_code);
          await page.screenshot({
            path: `test-results/round2-${language}-mission.png`,
          });
        }
        await page
          .getByRole("button", { name: "Close workbench", exact: true })
          .click();
      }
      const path = fileURLToPath(
        new URL("../../../../content/round-2/pack.json", import.meta.url),
      ).replaceAll("\\", "/");
      expect((await page.request.get("/@fs/" + path)).status()).toBe(403);
    } finally {
      await context.close();
    }
  }
});
