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
  suite: "load" | "race-load" | "load-soak" = "load",
) {
  await t.test(
    `${suite !== "race-load" ? "100-team arena" : "50-team shared race"} with separate browser generators and three aggregate CPUs runs within a private Linux namespace`,
    async () => {
      assert.match(databaseContainer, /^[a-f0-9]{64}$/);
      const nonce = randomUUID();
      const code = `../../test-results/linux-code-${nonce}`;
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
          "--outDir",
          fileURLToPath(new URL(code, import.meta.url)),
        ],
        { timeout: 45000, maxBuffer: 65536, windowsHide: true },
      );
      const bindings = [
        [`${code}/src`, "/workspace/src"],
        [`${code}/test`, "/workspace/test"],
        ["../../../../node_modules", "/workspace/node_modules"],
        ["../../package.json", "/workspace/package.json"],
        ["../../drizzle", "/workspace/drizzle"],
        [
          "../../../../infra/maintenance/test/load-linux.mjs",
          "/fixture/test.mjs",
        ],
        ["../../../../infra/maintenance/test/load-generator-linux.mjs", "/fixture/generator.mjs"],
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
      let generator: string | undefined;
      let generatorRun: Promise<{ stdout: string; stderr: string; failed: boolean }> | undefined;
      try {
        {
          generator = await docker(["create", "--pull=never", "--name", `ingenium-linux-generator-${nonce}`, "--label", `ingenium.linux-load=${nonce}`,
            "--restart", "no", "--network", `container:${databaseContainer}`, "--read-only", "--user", "1000:1000", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
            "--memory", "768m", "--memory-swap", "768m", "--cpus", "1", "--pids-limit", "64", ...bindings,
            "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--interactive", "--entrypoint", "/usr/local/bin/node", IMAGE, "/fixture/generator.mjs"]);
          assert.match(generator, /^[a-f0-9]{64}$/);
          const task = exec("docker", ["start", "--attach", "--interactive", generator], { timeout: suite === "load-soak" ? 4200000 : 510000, maxBuffer: 16384, windowsHide: true });
          generatorRun = task.then(result => ({ ...result, failed: false }), () => ({ stdout: "", stderr: "", failed: true }));
          const ready = new Promise<void>((resolve, reject) => {
            let output = "";
            const timer = setTimeout(() => reject(new Error("Separate generator startup deadline")), 10000);
            task.child.stdout!.on("data", chunk => { output += chunk; if (output === "INGENIUM_GENERATOR_READY\n") { clearTimeout(timer); resolve(); } });
            task.child.once("error", () => { clearTimeout(timer); reject(new Error("Separate generator startup failed")); });
            task.child.once("close", () => { clearTimeout(timer); reject(new Error("Separate generator exited during startup")); });
          });
          task.child.stdin!.end(JSON.stringify({ name: `ingenium-load-${nonce}`, ...(suite === "load-soak" ? { soak: true } : {}) }));
          await ready;
        }
        const running = exec(
          "docker",
          ["start", "--attach", "--interactive", container],
          { timeout: suite === "load-soak" ? 4100000 : 500000, maxBuffer: 65536, windowsHide: true },
        );
        running.child.stdin!.end(
          JSON.stringify({
            owner: owner.toString(),
            api: api.toString(),
            suite,
            ...(generator ? { generator: `ingenium-load-${nonce}` } : {}),
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
        if (generatorRun) {
          assert.equal(report.clients_share_api_cpu, false); assert.equal(report.generator_cpu_limit, 1);
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const result = await Promise.race([generatorRun, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Separate generator shutdown deadline")), 10000); })]);
            assert.equal(result.failed, false); assert.equal(result.stderr, ""); assert.equal(result.stdout, "INGENIUM_GENERATOR_READY\n");
          } finally { clearTimeout(timer); }
        }
      } finally {
        if (generator) {
          const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", generator]));
          assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.linux-load"], nonce);
          await docker(["stop", "--timeout", "2", generator]); await docker(["rm", generator]); await generatorRun;
        }
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
