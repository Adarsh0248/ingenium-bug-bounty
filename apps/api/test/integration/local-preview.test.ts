import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import type { Browser } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
import { startLocalPreview } from "../local-preview.js";

test(
  "local preview supports real code entry, live admin controls, simulated judging and isolated cleanup",
  { timeout: 240000 },
  async () => {
    const exec = promisify(execFile);
    const inventory = async () =>
      (
        await exec(
          "docker",
          [
            "ps",
            "-a",
            "--no-trunc",
            "--filter",
            "label=ingenium.local-preview",
            "--format",
            "{{.ID}}",
          ],
          { windowsHide: true },
        )
      ).stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .sort();
    const before = await inventory();
    const preview = await startLocalPreview(0, "visual-tests");
    let browser: Browser | undefined;
    const errors: string[] = [];
    const failedRequests: string[] = [];
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--use-gl=angle",
          "--use-angle=swiftshader-webgl",
          "--enable-unsafe-swiftshader",
        ],
      });
      const admin = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const participant = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      for (const [page, code] of [
        [admin, preview.adminCode],
        [participant, preview.teams[0]!.code],
      ] as const) {
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (response) => {
          if (response.status() >= 400)
            failedRequests.push(
              `${response.status()} ${new URL(response.url()).pathname}`,
            );
        });
        await page.goto(preview.origin);
        await expect(page.locator(".preview-label")).toContainText(
          "NO CODE EXECUTION",
        );
        await page.getByLabel("Team or staff code", { exact: true }).fill(code);
        await page
          .getByRole("button", { name: "Enter arena", exact: true })
          .click();
      }
      await admin
        .getByRole("button", { name: "Open control room", exact: true })
        .click();
      await expect(
        admin.getByRole("heading", { name: "running", exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await participant
        .getByRole("radio", { name: "Asha", exact: true })
        .check();
      await participant
        .getByLabel("Language", { exact: true })
        .selectOption("python");
      await participant
        .getByRole("button", { name: "Confirm and enter", exact: true })
        .click();
      await expect(
        participant.getByText("STATE VERIFIED", { exact: true }),
      ).toBeVisible({ timeout: 15000 });
      assert.equal(
        (
          await participant.request.get(
            `${preview.origin}/api/v1/staff/competition/control-room`,
          )
        ).status(),
        401,
      );

      await participant.locator("[data-map-bounty]").first().focus();
      await participant.locator("[data-map-bounty]").first().press("Enter");
      await participant.getByRole("button", {name:"Open question",exact:true}).click();
      await participant
        .getByRole("button", { name: "Plain text", exact: true })
        .click();
      const editor = participant.getByRole("textbox", {
        name: "Your private code",
        exact: true,
      });
      await expect(
        editor,
        "The loaded demo draft must be writable",
      ).toBeEditable({ timeout: 10000 });
      await editor.fill("a, b = map(int, input().split())\nprint(a + b)\n");
      await expect(participant.locator(".save-status")).toHaveText("saved", {
        timeout: 10000,
      });
      for (const name of ["Pause round", "Resume round"]) {
        await admin.getByRole("button", { name, exact: true }).click();
        const modal = admin.getByRole("dialog");
        await modal
          .getByLabel("Audit reason")
          .fill("Local preview live controls check");
        await modal.getByLabel("Your staff code").fill(preview.adminCode);
        await modal
          .getByRole("button", { name: "Confirm command", exact: true })
          .click();
        await expect(modal).not.toBeVisible();
        if (name === "Pause round")
          await expect(editor).toHaveAttribute("readonly", { timeout: 15000 });
        else
          await expect(editor).not.toHaveAttribute("readonly", {
            timeout: 15000,
          });
      }
      await participant
        .getByRole("button", { name: "Submit fix", exact: true })
        .click();
      await expect(
        participant.getByRole("button", {
          name: "Target cleared",
          exact: true,
        }),
      ).toBeVisible({ timeout: 20000 });
      await expect(editor).toHaveAttribute("readonly");
      await participant
        .getByRole("button", { name: "Report question", exact: true })
        .click();
      const reportDialog = participant.getByRole("dialog", {
        name: "Report question",
        exact: true,
      });
      await expect(
        reportDialog.getByLabel("Reported submission"),
      ).not.toHaveValue("");
      await reportDialog
        .getByLabel("Question report details")
        .fill(
          "Demo review: investigate the submitted answer <script>report text stays inert</script>.",
        );
      let reportPosts = 0,
        ticket: any;
      await participant.route("**/bounties/*/report", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        reportPosts++;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        ticket = (await response.json()).data;
        await route.abort("failed");
      });
      await reportDialog
        .getByRole("button", { name: "Raise ticket", exact: true })
        .click();
      await reportDialog
        .getByRole("button", { name: "Check original report", exact: true })
        .click();
      await expect(
        reportDialog.getByText(`Ticket ${ticket.id}`, { exact: false }),
      ).toBeVisible();
      assert.equal(
        reportPosts,
        1,
        "A lost report response must be recovered with GET, without another POST.",
      );
      await reportDialog
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await admin.getByRole("button", { name: "reports", exact: true }).click();
      await admin
        .getByRole("button", { name: "Open ticket", exact: true })
        .click();
      await expect(admin.locator(".report-message")).toContainText(
        "report text stays inert",
      );
      await admin
        .getByRole("button", { name: "Review submitted answer", exact: true })
        .click();
      await admin
        .getByRole("button", { name: "Review submitted program", exact: true })
        .click();
      const privateDialog = admin.getByRole("dialog", {
        name: "Private submission review",
        exact: true,
      });
      await privateDialog
        .getByLabel("Private review confirmation")
        .fill(ticket.parent_id);
      await privateDialog
        .getByLabel("Private review reason")
        .fill("Investigating the participant ticket");
      await privateDialog
        .getByRole("button", { name: "Open private review", exact: true })
        .click();
      await expect(
        admin.getByLabel("Submitted source", { exact: true }),
      ).toHaveText("a, b = map(int, input().split())\nprint(a + b)");
      await admin
        .getByRole("button", { name: "Close private review", exact: true })
        .click();
      await admin
        .getByRole("button", { name: "Uphold report", exact: true })
        .click();
      const decisionDialog = admin.getByRole("dialog", {
        name: "Confirm report decision",
        exact: true,
      });
      await decisionDialog
        .getByLabel("Report decision note")
        .fill(
          "Verified issue; award compensation when final standings are ready.",
        );
      await decisionDialog
        .getByLabel("Your staff code")
        .fill(preview.adminCode);
      let decisionPosts = 0;
      await admin.route("**/reports/*/decision", async (route) => {
        decisionPosts++;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.abort("failed");
      });
      await decisionDialog
        .getByRole("button", { name: "Confirm decision", exact: true })
        .click();
      await decisionDialog
        .getByRole("button", { name: "Check original decision", exact: true })
        .click();
      await expect(decisionDialog).not.toBeVisible();
      assert.equal(decisionPosts, 1);
      await expect(
        admin.getByText(
          "Decision note: Verified issue; award compensation when final standings are ready.",
          { exact: true },
        ),
      ).toBeVisible({ timeout: 10000 });
      await admin.screenshot({
        path: "test-results/question-report-review.png",
        fullPage: true,
      });
      await admin.getByRole("button", { name: "monitor", exact: true }).click();
      for (const name of ["Close round", "Finalise results"]) {
        await admin.getByRole("button", { name, exact: true }).click();
        const modal = admin.getByRole("dialog");
        await modal
          .getByLabel("Audit reason")
          .fill("Finish demo round for report compensation");
        await modal.getByLabel("Your staff code").fill(preview.adminCode);
        await delay(6500);
        await modal
          .getByRole("button", { name: "Confirm command", exact: true })
          .click();
        await expect(modal).not.toBeVisible();
      }
      await expect(
        admin.getByRole("heading", { name: "Final standings", exact: true }),
      ).toBeVisible();
      const round = ticket.round_id,
        baseline = (
          await (
            await admin.request.get(
              `${preview.origin}/api/v1/staff/competition/rounds/${round}/results`,
            )
          ).json()
        ).data;
      const originalPoints = baseline.standings.find(
        (s: any) => s.team_round_id === ticket.team_round_id,
      ).points;
      let scorePosts = 0;
      await admin.route("**/score-adjustments", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        scorePosts++;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await route.abort("failed");
      });
      await admin
        .getByRole("button", { name: "Adjust points", exact: true })
        .click();
      const scoreDialog = admin.getByRole("dialog", {
        name: "Adjust final points",
        exact: true,
      });
      await scoreDialog
        .getByLabel("Adjustment team")
        .selectOption(ticket.team_round_id);
      await scoreDialog
        .getByLabel("Point adjustment", { exact: true })
        .fill("175");
      await scoreDialog
        .getByLabel("Score adjustment reason")
        .fill("Ticket compensation +175");
      await scoreDialog.getByLabel("Related ticket ID").fill(ticket.id);
      await scoreDialog.getByLabel("Your staff code").fill(preview.adminCode);
      await admin.screenshot({
        path: "test-results/final-score-adjustment.png",
      });
      await delay(6500);
      await scoreDialog
        .getByRole("button", { name: "Confirm +175 points", exact: true })
        .click();
      // An uncertain correction stays blocked until the original receipt is recovered.
      await expect(
        scoreDialog.getByRole("button", {
          name: "Confirm +175 points",
          exact: true,
        }),
      ).toBeDisabled();
      await admin
        .getByRole("button", { name: "Check original adjustment", exact: true })
        .click();
      await expect(scoreDialog).not.toBeVisible();
      assert.equal(scorePosts, 1);
      const changed = (
        await (
          await admin.request.get(
            `${preview.origin}/api/v1/staff/competition/rounds/${round}/results`,
          )
        ).json()
      ).data;
      assert.equal(changed.result_version, 2);
      assert.equal(
        changed.standings.find(
          (s: any) => s.team_round_id === ticket.team_round_id,
        ).points,
        originalPoints + 175,
      );
      assert.notEqual(changed.standings_sha256, baseline.standings_sha256);
      await admin.unroute("**/score-adjustments");
      await admin
        .getByRole("button", { name: "Adjust points", exact: true })
        .click();
      await scoreDialog
        .getByLabel("Adjustment team")
        .selectOption(ticket.team_round_id);
      await scoreDialog
        .getByLabel("Point adjustment", { exact: true })
        .fill("-1000");
      await scoreDialog
        .getByLabel("Score adjustment reason")
        .fill("Deduct 1000 after final review");
      await scoreDialog.getByLabel("Your staff code").fill(preview.adminCode);
      await delay(6500);
      await scoreDialog
        .getByRole("button", { name: "Confirm -1000 points", exact: true })
        .click();
      await expect(scoreDialog).not.toBeVisible();
      const deducted = (
        await (
          await admin.request.get(
            `${preview.origin}/api/v1/staff/competition/rounds/${round}/results`,
          )
        ).json()
      ).data;
      assert.equal(deducted.result_version, 3);
      assert.equal(
        deducted.standings.find(
          (s: any) => s.team_round_id === ticket.team_round_id,
        ).points,
        originalPoints - 825,
      );
      const participantNotes = await participant.request.get(
        `${preview.origin}/api/v1/competition/rounds/${round}/score-adjustments`,
      );
      assert.equal(participantNotes.status(), 200);
      assert.equal(
        (await participantNotes.json()).data.items[0].reason,
        "Deduct 1000 after final review",
      );
      await participant
        .getByRole("button", { name: "Close workbench", exact: true })
        .click();
      await participant
        .getByRole("button", { name: "Results and history", exact: true })
        .click();
      const resultDialog = participant.getByRole("dialog", {
        name: "Results & history",
        exact: true,
      });
      await expect(
        resultDialog.getByRole("heading", {
          name: "Score corrections",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        resultDialog.getByText("Deduct 1000 after final review", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(resultDialog.locator(".own-standing")).toContainText(
        String(originalPoints - 825),
      );
      assert.equal(
        (
          await participant.request.get(
            `${preview.origin}/api/v1/staff/competition/rounds/${round}/reports`,
          )
        ).status(),
        401,
      );
      assert.deepEqual(errors, []);
    } catch (error) {
      console.error("Preview request failures:", failedRequests);
      for (const page of browser
        ?.contexts()
        .flatMap((context) => context.pages()) ?? []) {
        console.error(
          "Preview notices:",
          await page
            .locator(".error, .workbench-notice, .save-status, .sync-status")
            .allTextContents(),
        );
      }
      throw error;
    } finally {
      try {
        await browser?.close();
      } finally {
        await preview.close();
      }
    }
    assert.deepEqual(
      await inventory(),
      before,
      "Only this preview's database container is removed.",
    );
    await assert.rejects(
      fetch(preview.origin),
      "The preview HTTP listener must close.",
    );
  },
);
