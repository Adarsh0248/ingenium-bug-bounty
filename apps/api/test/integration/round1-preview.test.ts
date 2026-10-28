import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { startLocalPreview } from "../local-preview.js";
import { roundOnePack } from "../../../../content/round-1/load.js";

test(
  "all fifty real Round 1 missions load through the protected database preview with four variants",
  { timeout: 600000 },
  async () => {
    const preview = await startLocalPreview(0);
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
        "--enable-unsafe-swiftshader",
      ],
    });
    try {
      const page = await browser.newPage({ reducedMotion: "reduce" });
      await page.goto(preview.origin);
      await page.getByLabel("Team or staff code").fill(preview.teams[0]!.code);
      await page
        .getByRole("button", { name: "Enter arena", exact: true })
        .click();
      await page.getByRole("radio", { name: "Asha", exact: true }).check();
      assert.equal(
        await page
          .getByLabel("Language", { exact: true })
          .locator("option")
          .count(),
        4,
      );
      const entry = (
        await (
          await page.request.get(
            preview.origin + "/api/v1/bootstrap?audience=ENTRY",
          )
        ).json()
      ).data;
      const excluded = await page.request.post(
        preview.origin + "/api/v1/entry/activate",
        {
          headers: { origin: preview.origin, "x-csrf-token": entry.csrf_token },
          data: {
            member_id: entry.flow.members[0].id,
            language: "javascript",
            request_key: randomUUID(),
          },
        },
      );
      assert.equal(
        excluded.status(),
        400,
        "New enrolment cannot bypass the four-language choice",
      );
      await page.getByLabel("Language", { exact: true }).selectOption("python");
      await page
        .getByRole("button", { name: "Confirm and enter", exact: true })
        .click();
      await page
        .getByText("STATE VERIFIED", { exact: true })
        .waitFor({ timeout: 15000 });
      assert.equal(await page.locator("button.target").count(), 50);
      const first = roundOnePack.questions[0]!;
      await page
        .locator("button.target")
        .filter({ hasText: first.title })
        .click();
      await page
        .getByRole("button", { name: "Open question", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Plain text", exact: true })
        .click();
      const editor = page.getByRole("textbox", {
        name: "Your private code",
        exact: true,
      });
      await editor.waitFor();
      assert.equal(
        await editor.inputValue(),
        first.variants.python.starter_code,
      );
      const statement = await page.locator(".statement").innerText();
      assert.match(statement, /AEGIS/);
    assert.match(statement, /power reading/);
    assert.match(statement, /What the code should do/);
    assert.match(statement, /Example explained/);
      assert.doesNotMatch(statement, /reference_solution|defect_description/);
      console.log(
        "PASS: fifty real missions stored through authoring, four-language preparation, protected snapshots and arena selection; preview judging remains simulated.",
      );
    } finally {
      await browser.close();
      await preview.close();
    }
  },
);
