import { defineConfig } from "@playwright/test";
const port = Number(process.env.INGENIUM_PREVIEW_PORT ?? 5174);
export default defineConfig({
  testDir: "test/browser",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader-webgl",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    env: {
      INGENIUM_PREVIEW_FIXTURES:
        process.env.INGENIUM_PREVIEW_FIXTURES ?? "visual-tests",
    },
    command: "npm run preview:participant",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
