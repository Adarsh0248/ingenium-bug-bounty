import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";
import { sha256 } from "../../src/access/credentials.js";
import type { participantBrowserChecks } from "./frontend-browser.checks.js";
import { withHttpsApp } from "./https-app.js";

export async function httpsChecks(
  t: Parameters<typeof participantBrowserChecks>[0],
  c: Parameters<typeof participantBrowserChecks>[1],
) {
  const arena = await c.newRound();
  await withHttpsApp(
    t,
    { pool: c.api, clock: c.clock, delivery: c.delivery, competition: c.deps },
    async (edge) => {
      const { origin, policy, get } = edge;
      await t.test(
        "the real Caddy TLS edge serves only built public assets and never caches entry, errors or private routes",
        async () => {
          const home = await get("/");
          assert.equal(home.status, 200);
          assert.equal(home.headers["cache-control"], "no-store");
          assert.match(
            String(home.headers["content-security-policy"]),
            /frame-ancestors 'none'/,
          );
          assert.match(
            String(home.headers["strict-transport-security"]),
            /max-age=31536000/,
          );
          assert.equal(home.headers["server"], undefined);
          assert.doesNotMatch(
            home.body.toString(),
            /@vite|preview fixture|unsafe-eval/,
          );
          const asset = home.body
            .toString()
            .match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
          assert.ok(asset);
          const saved = await get(asset);
          assert.equal(saved.status, 200);
          assert.equal(
            saved.headers["cache-control"],
            "public, max-age=31536000, immutable",
          );
          assert.deepEqual(
            saved.body,
            await readFile(
              fileURLToPath(
                new URL(`../../../web/dist${asset}`, import.meta.url),
              ),
            ),
          );
          for (const path of [
            "/assets/missing-12345678.js",
            "/.env",
            "/.git/config",
            "/ready",
            "/health",
            "/metrics",
            "/admin/config",
            "/src/main.tsx",
            "/not-a-route",
          ]) {
            const reply = await get(path);
            assert.equal(reply.status, 404, path);
            assert.equal(reply.headers["cache-control"], "no-store", path);
            assert.doesNotMatch(
              reply.body.toString(),
              /DATABASE_URL|csrf_key|ingenium_schema_owner/,
            );
          }
          assert.equal(
            (await get("/", { method: "POST", body: "ignored" })).status,
            405,
          );
          const unknown = await get("/api/v1/not-a-route");
          assert.equal(unknown.status, 404);
          assert.match(String(unknown.headers["content-type"]), /json/);
          assert.equal(unknown.headers["cache-control"], "no-store");
        },
      );
      await t.test(
        "the edge overwrites forged client addresses and API and upgraded live quotas share the fixed trust boundary",
        async () => {
          await c.budgets();
          const bootstrap = await get("/api/v1/bootstrap?audience=ANONYMOUS", {
            headers: {
              "x-ingenium-client-ip": "198.51.100.9",
              "x-forwarded-for": "198.51.100.9",
              forwarded: "for=198.51.100.9",
            },
          });
          assert.equal(bootstrap.status, 200, bootstrap.body.toString());
          assert.ok(bootstrap.headers["set-cookie"]?.length);
          for (const cookie of bootstrap.headers["set-cookie"]!) {
            assert.match(cookie, /^__Host-ingenium_/);
            assert.match(cookie, /; Secure/);
            assert.match(cookie, /; HttpOnly/);
            assert.match(cookie, /; SameSite=Strict/i);
            assert.doesNotMatch(cookie, /; Domain=/i);
          }
          const rows = (
            await c.owner.query(
              "SELECT encode(key_hash,'hex') key FROM quota_buckets WHERE kind='HTTP_IP'",
            )
          ).rows;
          assert.deepEqual(rows, [
            { key: sha256("127.0.0.1").toString("hex") },
          ]);
          const direct = await edge.app.inject({
            url: "/api/v1/bootstrap?audience=ANONYMOUS",
          });
          assert.equal(direct.statusCode, 400);
          const encoded = await get("/api/v1/entry/verify", {
            method: "POST",
            headers: {
              "content-encoding": "gzip",
              "content-type": "application/json",
            },
            body: "{}",
          });
          assert.equal(encoded.status, 415);
          assert.equal(encoded.headers["cache-control"], "no-store");
        },
      );
      await t.test(
        "the production browser uses secure cookies, self-hosted Monaco and realtime updates through HTTPS without CSP failures",
        async () => {
          const browser = await chromium.launch({
            headless: true,
            args: [
              "--use-gl=angle",
              "--use-angle=swiftshader-webgl",
              "--enable-unsafe-swiftshader",
            ],
          });
          // Chromium does not install this disposable CA; the Node requests above verify its chain and IP SAN.
          const context = await browser.newContext({
            ignoreHTTPSErrors: true,
            viewport: { width: 1440, height: 1000 },
          });
          try {
            await context.addCookies([
              {
                name: policy.names.participant,
                value: arena.aa,
                url: origin,
                secure: true,
                httpOnly: true,
                sameSite: "Strict",
              },
            ]);
            const page = await context.newPage(),
              errors: string[] = [],
              sockets: string[] = [],
              workers: string[] = [],
              external: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("websocket", (socket) => sockets.push(socket.url()));
            page.on("worker", (worker) => workers.push(worker.url()));
            page.on("request", (req) => {
              if (
                !req.url().startsWith(origin) &&
                !req.url().startsWith("data:")
              )
                external.push(req.url());
            });
            await page.addInitScript(
              "window.edgeViolations=[]; document.addEventListener('securitypolicyviolation',e=>window.edgeViolations.push(e.violatedDirective));",
            );
            await c.budgets();
            await page.goto(origin);
            await expect(
              page.getByText("STATE VERIFIED", { exact: true }),
            ).toBeVisible({ timeout: 20000 });
            assert.ok(
              sockets.some((url) =>
                url.startsWith(origin.replace("https:", "wss:")),
              ),
            );
            await page.locator(`[data-bounty-id="${arena.x}"]`).click();
            await expect(page.locator(".monaco-editor")).toBeVisible({
              timeout: 20000,
            });
            // C++ rendering need not request a language worker; exercise the installed factory explicitly.
            const workerResponse = page.waitForResponse((response) =>
              /\/assets\/editor\.worker-.*\.js$/.test(response.url()),
            );
            await page.evaluate("void window.MonacoEnvironment.getWorker()");
            assert.equal((await workerResponse).status(), 200);
            await expect
              .poll(() =>
                workers.some((url) =>
                  /\/assets\/editor\.worker-.*\.js$/.test(url),
                ),
              )
              .toBe(true);
            await page
              .getByRole("button", { name: "Plain text", exact: true })
              .click();
            const editor = page.getByRole("textbox", {
                name: "Your private code",
                exact: true,
              }),
              source = "// HTTPS production draft\nint main() { return 0; }\n";
            await editor.fill(source);
            await expect(page.locator(".save-status")).toHaveText("saved", {
              timeout: 10000,
            });
            assert.equal(
              (
                await c.owner.query(
                  "SELECT convert_from(source_code,'UTF8') source FROM code_drafts WHERE bounty_id=$1",
                  [arena.x],
                )
              ).rows[0].source,
              source,
            );
            const control = async (action: "PAUSE" | "RESUME") => {
              await c.budgets();
              await c.service.command(c.staff.sessionCookie, {
                action,
                roundId: arena.round,
                requestKey: crypto.randomUUID(),
                expectedRevision: (
                  await c.owner.query(
                    "SELECT revision FROM rounds WHERE id=$1",
                    [arena.round],
                  )
                ).rows[0].revision,
                payload: { scope: "GLOBAL", target: null },
                reason: "Synthetic TLS realtime check",
                ownCode: c.staff.code,
              });
            };
            await delay(16000); // An HTTP upload deadline must not end an upgraded live connection.
            await control("PAUSE");
            await expect(editor).toHaveAttribute("readonly");
            await control("RESUME");
            await expect(editor).not.toHaveAttribute("readonly");
            await expect(editor).toHaveValue(source);
            const output = fileURLToPath(
              new URL("../../test-results/", import.meta.url),
            );
            await mkdir(output, { recursive: true });
            await page.screenshot({
              path: `${output}/https-desktop.png`,
              fullPage: true,
            });
            await page.setViewportSize({ width: 390, height: 844 });
            await page.screenshot({
              path: `${output}/https-mobile.png`,
              fullPage: true,
            });
            assert.deepEqual(await page.evaluate("window.edgeViolations"), []);
            assert.deepEqual(external, []);
            assert.deepEqual(errors, []);
            const cookies = await context.cookies(origin);
            assert.ok(
              cookies
                .filter((cookie) => cookie.name.startsWith("__Host-"))
                .every(
                  (cookie) =>
                    cookie.secure &&
                    cookie.httpOnly &&
                    cookie.sameSite === "Strict",
                ),
            );
          } finally {
            await context.close();
            await browser.close();
          }
        },
      );
      await t.test(
        "a lost upstream POST is never replayed and returns a generic non-cacheable failure",
        async () => {
          const reply = await get("/api/v1/edge-loss-fixture", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          assert.equal(reply.status, 502);
          assert.equal(reply.headers["cache-control"], "no-store");
          assert.equal(reply.body.toString(), "Request unavailable.");
          await delay(200);
          assert.equal(edge.lostRequests(), 1);
        },
      );
    },
  );
}
