import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { request } from "node:https";
import { isAbsolute, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { EntryHttpOptions } from "../../src/access/http.js";
import { randomBytes } from "node:crypto";
import { createTestTls } from "../fixtures/tls.js";

export async function withHttpsApp(
  t: TestContext,
  options: Omit<EntryHttpOptions, "browser">,
  work: (edge: {
    origin: string;
    policy: ReturnType<typeof browserPolicy>;
    app: ReturnType<typeof buildApp>;
    lostRequests(): number;
    get(
      path: string,
      options?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      },
    ): Promise<{
      status: number;
      headers: import("node:http").IncomingHttpHeaders;
      body: Buffer;
    }>;
  }) => Promise<void>,
) {
  const binary = process.env.INGENIUM_TEST_CADDY;
  assert.ok(
    binary && isAbsolute(binary),
    "HTTPS tests require an explicit verified Caddy 2.11.7 executable, never a production service.",
  );
  assert.match(
    (
      await promisify(execFile)(binary, ["version"], {
        timeout: 5000,
        windowsHide: true,
      })
    ).stdout,
    /^v2\.11\.7 /,
  );
  const tls = await createTestTls(t, "localhost"),
    edgeRoot = fileURLToPath(
      new URL("../../../../infra/app-edge/", import.meta.url),
    ),
    web = fileURLToPath(new URL("../../../web/dist/", import.meta.url));
  await readFile(join(web, "index.html")); // Require the real production build, never Vite or preview fixtures.
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  const origin = `https://localhost:${address.port}`,
    settings = {
      mode: "production" as const,
      origin,
      cookieKey: randomBytes(32),
      csrfKey: randomBytes(32),
    };
  const app = buildApp({
    database: { async check() {}, async close() {} },
    entry: { ...options, browser: settings, proxy: "loopback" },
  });
  let child: ReturnType<typeof spawn> | undefined;
  let lostRequests = 0;
  // Test-only socket failure after a POST; this route is never registered by the application.
  app.post("/api/v1/edge-loss-fixture", async (req, reply) => {
    lostRequests++;
    reply.hijack();
    req.raw.socket.destroy();
  });
  let logs = "";
  const get: Parameters<typeof work>[0]["get"] = (path, options = {}) =>
    new Promise((resolve, reject) => {
      const req = request(
        `${origin}${path}`,
        {
          ca: tls.ca,
          family: 4,
          timeout: 5000,
          method: options.method ?? "GET",
          headers: options.headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          res.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 16777216)
              req.destroy(new Error("Oversized edge test response"));
            else chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({
              status: res.statusCode!,
              headers: res.headers,
              body: Buffer.concat(chunks),
            }),
          );
          res.on("error", reject);
        },
      );
      req.on("timeout", () =>
        req.destroy(new Error("Edge test request timed out")),
      );
      req.on("error", reject);
      req.end(options.body);
    });
  try {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const api = app.server.address();
    assert.ok(api && typeof api !== "string");
    const slash = (path: string) => path.replaceAll("\\", "/"),
      config = join(tls.directory, "Caddyfile");
    await writeFile(
      config,
      `{
      import "${slash(join(edgeRoot, "global.caddy"))}"
      auto_https off
    }
    ${origin} {
      bind 127.0.0.1
      tls "${slash(join(tls.directory, "server.pem"))}" "${slash(join(tls.directory, "server.key"))}"
      import "${slash(join(edgeRoot, "site.caddy"))}"
    }
    `,
    );
    const env = {
      ...process.env,
      INGENIUM_API_PORT: String(api.port),
      INGENIUM_WEB_ROOT: slash(web),
    };
    await promisify(execFile)(
      binary,
      ["validate", "--config", config, "--adapter", "caddyfile"],
      { env, timeout: 10000, windowsHide: true },
    );
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    child = spawn(
      binary,
      ["run", "--config", config, "--adapter", "caddyfile"],
      { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let childError: Error | undefined;
    child.on("error", (error) => {
      childError = error;
    });
    for (const stream of [child.stdout, child.stderr])
      stream!.on("data", (chunk) => {
        logs = (logs + String(chunk)).slice(-8192);
      });
    for (let tries = 0; ; tries++) {
      try {
        assert.equal((await get("/")).status, 200);
        break;
      } catch (error) {
        if (childError || child.exitCode !== null || tries >= 40)
          throw new Error(
            `Disposable edge could not start: ${childError?.name ?? String(error)} ${logs}`,
          );
        await delay(100);
      }
    }
    await work({
      origin,
      get,
      app,
      lostRequests: () => lostRequests,
      policy: browserPolicy(settings),
    });
  } finally {
    if (child && child.exitCode === null && child.pid) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
    if (reservation.listening)
      await new Promise<void>((resolve) => reservation.close(() => resolve()));
    await app.close();
  }
}
