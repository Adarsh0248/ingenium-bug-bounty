import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer as viteServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "@playwright/test";
import type { Browser } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { EntryHttpOptions } from "../../src/access/http.js";

export async function withBrowserApp(
  options: Omit<EntryHttpOptions, "browser">,
  work: (
    browser: Browser,
    origin: string,
    policy: ReturnType<typeof browserPolicy>,
  ) => Promise<void>,
) {
  let app: ReturnType<typeof buildApp> | undefined,
    vite: Awaited<ReturnType<typeof viteServer>> | undefined;
  const bridge = createServer((req, res) => {
    if (req.url?.startsWith("/api/")) {
      app!.server.emit("request", req, res);
      return;
    }
    vite!.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
  let browser: Browser | undefined;
  try {
    await new Promise<void>((resolve) =>
      bridge.listen(0, "127.0.0.1", resolve),
    );
    const address = bridge.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`,
      settings = {
        mode: "loopback" as const,
        origin,
        cookieKey: randomBytes(32),
        csrfKey: randomBytes(32),
      };
    browser = await chromium.launch({
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
        "--enable-unsafe-swiftshader",
      ],
    });
    vite = await viteServer({
      configFile: false,
      root: fileURLToPath(new URL("../../../web/", import.meta.url)),
      envDir: false,
      plugins: [react()],
      define: { __PREVIEW__: false },
      server: {
        middlewareMode: true,
        hmr: { server: bridge },
        fs: {
          allow: [fileURLToPath(new URL("../../../../", import.meta.url))],
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
    await work(browser, origin, browserPolicy(settings));
  } finally {
    await browser?.close();
    await vite?.close();
    await app?.close();
    bridge.closeAllConnections();
    if (bridge.listening)
      await new Promise<void>((resolve) => bridge.close(() => resolve()));
  }
}
