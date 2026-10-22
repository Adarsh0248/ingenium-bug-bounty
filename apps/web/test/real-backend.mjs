import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
for (const suite of [
  "browser",
  "clock-browser",
  "history-browser",
  "judging-browser",
  "review-browser",
  "diagnostics-browser",
]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", "test/integration/schema.test.ts"],
      {
        cwd: fileURLToPath(new URL("../../api/", import.meta.url)),
        env: { ...process.env, INGENIUM_TEST_SUITE: suite },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (code !== 0) {
    process.exitCode = code;
    break;
  }
}
