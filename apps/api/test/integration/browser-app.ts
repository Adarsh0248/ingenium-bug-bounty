import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer as viteServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "@playwright/test";
import type { Browser, Page, Locator, Route } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { EntryHttpOptions } from "../../src/access/http.js";

export async function openStaffView(page: Page, name: string) {
  const button = page
    .getByRole("navigation", { name: "Control room views" })
    .getByRole("button", { name, exact: true });
  if (!(await button.isVisible()))
    await page.locator(".staff-more > summary").click();
  await button.click();
}

export async function fillStaffNote(
  scope: Page | Locator,
  label: string,
  value: string,
) {
  const field = scope.getByLabel(label, { exact: true });
  if (!(await field.isVisible())) {
    const note = scope.locator(".staff-note").filter({ hasText: label });
    if ((await note.getAttribute("open")) === null)
      await note.locator("summary").click();
  }
  await field.fill(value);
}

// Older API clients may still supply a code; the production UI never asks for it.
export async function supplyLegacyStaffCode(
  scope: Page | Locator,
  code: string,
) {
  const page = "route" in scope ? scope : scope.page();
  const pattern = "**/api/v1/staff/**";
  const action =
    /\/staff\/(?:staff-identities(?:\/[^/]+\/(?:update|rotate-code))?|teams(?:\/[^/]+\/(?:rotate|issue|revoke)-code)?|registrations\/import|discipline|competition\/(?:rounds\/[^/]+\/(?:commands|jobs\/[^/]+\/retry|reports\/[^/]+\/decision|score-adjustments)|publications\/[^/]+))$/;
  let supplied = false;
  const handler = async (route: Route) => {
    if (
      supplied ||
      route.request().method() !== "POST" ||
      !action.test(new URL(route.request().url()).pathname)
    )
      return route.fallback();
    supplied = true;
    if (route.request().postDataJSON().own_code !== undefined)
      return route.fallback();
    await route.fallback({
      postData: JSON.stringify({
        ...route.request().postDataJSON(),
        own_code: code,
      }),
    });
  };
  await page.route(pattern, handler);
}

export async function startBrowserApp(
  options: Omit<EntryHttpOptions, "browser">,
  port = 0,
  preview = false,
) {
  assert.ok(Number.isInteger(port) && port >= 0 && port <= 65535);
  let app: ReturnType<typeof buildApp> | undefined,
    vite: Awaited<ReturnType<typeof viteServer>> | undefined;
  const bridge = createServer((req, res) => {
    if (req.url?.startsWith("/api/")) {
      if (!app) {
        res.statusCode = 503;
        res.end();
        return;
      }
      app!.server.emit("request", req, res);
      return;
    }
    if (!vite) {
      res.statusCode = 503;
      res.end();
      return;
    }
    vite!.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    const results = await Promise.allSettled([vite?.close(), app?.close()]);
    bridge.closeAllConnections();
    if (bridge.listening)
      await new Promise<void>((resolve) => bridge.close(() => resolve()));
    for (const result of results)
      if (result.status === "rejected") throw result.reason;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      bridge.once("error", reject);
      bridge.listen(port, "127.0.0.1", () => {
        bridge.removeListener("error", reject);
        resolve();
      });
    });
    const address = bridge.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`,
      settings = {
        mode: "loopback" as const,
        origin,
        cookieKey: randomBytes(32),
        csrfKey: randomBytes(32),
      };
    vite = await viteServer({
      configFile: false,
      root: fileURLToPath(new URL("../../../web/", import.meta.url)),
      envDir: false,
      plugins: [react()],
      define: { __PREVIEW__: preview },
      server: {
        middlewareMode: true,
        hmr: { server: bridge },
        fs: {
          allow: [fileURLToPath(new URL("../../../../", import.meta.url))],
          deny: [
            "**/.env",
            "**/.env.*",
            "**/*.{crt,pem}",
            "**/.git/**",
            "**/content/round-1/**",
            "**/content/round-2/**",
            "**/test-results/**",
          ],
        },
      },
    });
    app = buildApp({
      database: { async check() {}, async close() {} },
      entry: { ...options, browser: settings },
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    bridge.on("upgrade", (req, socket, head) => {
      if (req.url?.startsWith("/api/"))
        app!.server.emit("upgrade", req, socket, head);
    });
    return { origin, policy: browserPolicy(settings), close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function withBrowserApp(
  options: Omit<EntryHttpOptions, "browser">,
  work: (
    browser: Browser,
    origin: string,
    policy: ReturnType<typeof browserPolicy>,
  ) => Promise<void>,
) {
  const server = await startBrowserApp(options);
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
        "--enable-unsafe-swiftshader",
      ],
    });
    await work(browser, server.origin, server.policy);
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
}
