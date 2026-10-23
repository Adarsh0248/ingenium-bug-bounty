import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const IMAGE =
  "node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
const docker = async (args: string[]) =>
  (
    await exec("docker", args, {
      timeout: 45000,
      maxBuffer: 65536,
      windowsHide: true,
    })
  ).stdout.trim();

export async function linuxLoadChecks(
  t: TestContext,
  ownerConnection: string,
  apiConnection: string,
  databaseContainer: string,
  suite: "load" | "race-load" = "load",
) {
  await t.test(
    `${suite === "load" ? "100-team independent arena" : "50-team shared race"} runs within a private Linux namespace and two aggregate test CPUs`,
    async () => {
      assert.match(databaseContainer, /^[a-f0-9]{64}$/);
      await exec(
        process.execPath,
        [
          fileURLToPath(
            new URL(
              "../../../../node_modules/typescript/bin/tsc",
              import.meta.url,
            ),
          ),
          "-p",
          fileURLToPath(
            new URL("../../tsconfig.test-build.json", import.meta.url),
          ),
        ],
        { timeout: 45000, maxBuffer: 65536, windowsHide: true },
      );
      const nonce = randomUUID();
      const bindings = [
        ["../../test-results/linux-code/src", "/workspace/src"],
        ["../../test-results/linux-code/test", "/workspace/test"],
        ["../../../../node_modules", "/workspace/node_modules"],
        ["../../package.json", "/workspace/package.json"],
        ["../../drizzle", "/workspace/drizzle"],
        [
          "../../../../infra/maintenance/test/load-linux.mjs",
          "/fixture/test.mjs",
        ],
      ].flatMap(([path, target]) => [
        "--mount",
        `type=bind,src=${fileURLToPath(new URL(path!, import.meta.url))},dst=${target},readonly`,
      ]);
      const container = await docker([
        "create",
        "--pull=never",
        "--name",
        `ingenium-linux-load-${nonce}`,
        "--label",
        `ingenium.linux-load=${nonce}`,
        "--restart",
        "no",
        "--network",
        `container:${databaseContainer}`,
        "--read-only",
        "--user",
        "1000:1000",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges=true",
        "--memory",
        "768m",
        "--memory-swap",
        "768m",
        "--cpus",
        "1",
        "--pids-limit",
        "128",
        "--tmpfs",
        "/workspace/test-results:rw,nosuid,nodev,noexec,size=4m,uid=1000,gid=1000,mode=0700",
        ...bindings,
        "--log-opt",
        "max-size=1m",
        "--log-opt",
        "max-file=1",
        "--interactive",
        "--entrypoint",
        "/usr/local/bin/node",
        IMAGE,
        "/fixture/test.mjs",
      ]);
      assert.match(container, /^[a-f0-9]{64}$/);
      const owner = new URL(ownerConnection),
        api = new URL(apiConnection);
      owner.port = api.port = "5432";
      const output = fileURLToPath(
        new URL(`../../test-results/linux-${suite}.json`, import.meta.url),
      );
      await mkdir(
        fileURLToPath(new URL("../../test-results", import.meta.url)),
        { recursive: true },
      );
      await writeFile(
        output,
        JSON.stringify({ state: "INCOMPLETE", controller_run_id: nonce }) +
          "\n",
      );
      try {
        const running = exec(
          "docker",
          ["start", "--attach", "--interactive", container],
          { timeout: 500000, maxBuffer: 65536, windowsHide: true },
        );
        running.child.stdin!.end(
          JSON.stringify({
            owner: owner.toString(),
            api: api.toString(),
            suite,
          }),
        );
        let failed = false;
        let stdout = "";
        let stderr = "";
        try {
          const result = await running;
          stdout = result.stdout;
          stderr = result.stderr;
        } catch (error) {
          failed = true;
          stdout = String((error as { stdout?: string }).stdout ?? "");
          stderr = String((error as { stderr?: string }).stderr ?? "");
        }
        await writeFile(
          fileURLToPath(
            new URL(
              `../../test-results/linux-${suite}-startup.log`,
              import.meta.url,
            ),
          ),
          stdout + stderr,
          { mode: 0o600 },
        );
        await writeFile(
          fileURLToPath(
            new URL(
              `../../test-results/linux-${suite}-${nonce}-startup.log`,
              import.meta.url,
            ),
          ),
          stdout + stderr,
          { mode: 0o600, flag: "wx" },
        );
        const records = stdout
          .split("\n")
          .filter((line) => line.startsWith("INGENIUM_LOAD_REPORT "));
        assert.equal(
          records.length,
          1,
          "Linux test did not return one bounded source-free report.",
        );
        const bytes = Buffer.from(
          records[0]!.slice("INGENIUM_LOAD_REPORT ".length),
          "base64",
        );
        assert.ok(bytes.length <= 16384);
        const report = {
          ...JSON.parse(bytes.toString("utf8")),
          controller_run_id: nonce,
        };
        await writeFile(output, JSON.stringify(report, null, 2) + "\n");
        await writeFile(
          fileURLToPath(
            new URL(
              `../../test-results/linux-${suite}-${nonce}.json`,
              import.meta.url,
            ),
          ),
          JSON.stringify(report, null, 2) + "\n",
          { mode: 0o600, flag: "wx" },
        );
        t.diagnostic(
          JSON.stringify({
            state: report.state,
            run_id: report.run_id,
            live_failure: report.live_failure ?? null,
          }),
        );
        const state = JSON.parse(
          await docker(["inspect", "--format", "{{json .State}}", container]),
        );
        assert.equal(
          failed,
          false,
          "Linux load process did not finish normally; inspect its source-free report.",
        );
        assert.equal(
          state.ExitCode,
          0,
          "Linux load assertions failed; inspect the retained report.",
        );
        assert.equal(report.state, "PASSED");
        assert.equal(report.execution_platform, "linux");
        assert.equal(report.real_judge_execution, false);
        assert.equal(report.event_launch_authorised, false);
      } finally {
        const config = JSON.parse(
          await docker(["inspect", "--format", "{{json .Config}}", container]),
        );
        assert.equal(config.Image, IMAGE);
        assert.equal(config.Labels["ingenium.linux-load"], nonce);
        await docker(["stop", "--timeout", "2", container]);
        await docker(["rm", container]);
      }
    },
  );
}
