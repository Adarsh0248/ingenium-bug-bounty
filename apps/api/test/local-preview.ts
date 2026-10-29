import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  LANGUAGES,
  newAccessCode,
  sessionDelivery,
} from "../src/access/credentials.js";
import { createEntryService } from "../src/access/entry-service.js";
import { createStaffService } from "../src/access/staff-service.js";
import { createArenaService } from "../src/access/arena-service.js";
import { createContentService } from "../src/content/service.js";
import { createValidationService } from "../src/content/validation-service.js";
import { createValidationRunService } from "../src/content/validation-runs.js";
import { createPublicationService } from "../src/content/publication-service.js";
import { createDrawCipher } from "../src/competition/policy.js";
import { migrateDatabase } from "../src/db/migrate.js";
import {
  createJudgingCoordinator,
  assertWorkerDatabase,
} from "../src/worker/judging.js";
import { maintenanceLoop } from "../src/maintenance/loop.js";
import { startEventMaintenance } from "../src/maintenance/runtime.js";
import { acceptJudgeReply } from "../src/content/judge-protocol.js";
import type {
  AuthoringPayload,
  TrustedAuthoringDriver,
} from "../src/content/execution-policy.js";
import { judgeReply } from "./fixtures/judge.js";
import { startBrowserApp } from "./integration/browser-app.js";
import { roundOnePack } from "../../../content/round-1/load.js";
import type { Language } from "../src/access/credentials.js";

const IMAGE =
  "postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";
const sources = {
  c: '#include <stdio.h>\nint main(void) {\n    long long a, b;\n    scanf("%lld %lld", &a, &b);\n    printf("%lld\\n", a + b);\n    return 0;\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << "\\n";\n}\n',
  java: "import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        long a = sc.nextLong(), b = sc.nextLong();\n        System.out.println(a + b);\n    }\n}\n",
  python: "a, b = map(int, input().split())\nprint(a + b)\n",
  javascript:
    "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(BigInt);\nconsole.log(String(a + b));\n",
};

// This entry point lives under test/: production startup never imports its accounts, clock or simulated driver.
export async function startLocalPreview(
  port = 5175,
  contentMode: "round1" | "visual-tests" = "round1",
) {
  assert.ok(Number.isInteger(port) && port >= 0 && port <= 65535);
  const exec = promisify(execFile),
    nonce = randomUUID(),
    name = `ingenium-ui-preview-${nonce}`;
  const run = async (args: string[], env = process.env) =>
    (
      await exec("docker", args, {
        env,
        timeout: 120000,
        maxBuffer: 1048576,
        windowsHide: true,
      })
    ).stdout.trim();
  const context = await run(["context", "show"]);
  const [description] = JSON.parse(await run(["context", "inspect", context]));
  assert.match(
    description.Endpoints.docker.Host,
    /^(npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+|unix:\/\/\/[^\r\n]+)$/,
    "Use a local Docker Desktop/Linux engine for this preview.",
  );
  const docker = (args: string[], env = process.env) =>
    run(["--context", context, ...args], env);
  assert.equal(
    await docker(["info", "--format", "{{.OSType}}"]),
    "linux",
    "Docker must use Linux containers.",
  );
  const pools: Pool[] = [];
  let server: Awaited<ReturnType<typeof startBrowserApp>> | undefined;
  let coordinator: ReturnType<typeof createJudgingCoordinator> | undefined,
    stopWorker: (() => Promise<void>) | undefined;
  let maintenance: ReturnType<typeof startEventMaintenance> | undefined,
    closed = false;
  const pool = (connectionString: string, max = 4) => {
    const p = new Pool({
      connectionString,
      max,
      connectionTimeoutMillis: 1000,
      query_timeout: 5000,
    });
    pools.push(p);
    p.on("error", () =>
      console.error("Local preview database connection unavailable."),
    );
    return p;
  };
  async function close() {
    if (closed) return;
    closed = true;
    coordinator?.stop();
    const results = await Promise.allSettled([
      server?.close(),
      stopWorker?.(),
      maintenance?.close(),
    ]);
    results.push(...(await Promise.allSettled(pools.map((p) => p.end()))));
    const ids = await docker([
      "ps",
      "-a",
      "--no-trunc",
      "--filter",
      `label=ingenium.local-preview=${nonce}`,
      "--format",
      "{{.ID}}",
    ]);
    if (ids) {
      assert.match(
        ids,
        /^[a-f0-9]{64}$/,
        "Unexpected preview container inventory; preserve it.",
      );
      const [row] = JSON.parse(await docker(["inspect", ids]));
      assert.equal(row.Name, `/${name}`);
      assert.equal(row.Config.Labels["ingenium.local-preview"], nonce);
      assert.equal(row.Config.Image, IMAGE);
      await docker(["stop", "--time", "5", ids]);
      await docker(["rm", ids]);
    }
    for (const result of results)
      if (result.status === "rejected") throw result.reason;
  }
  try {
    const password = randomBytes(24).toString("hex"),
      apiPassword = randomBytes(24).toString("hex");
    const roleScript = fileURLToPath(
      new URL("../../../infra/postgres/01-api-role.sql", import.meta.url),
    );
    await docker(
      [
        "create",
        "--pull=missing",
        "--name",
        name,
        "--label",
        `ingenium.local-preview=${nonce}`,
        "--restart",
        "no",
        "--read-only",
        "--user",
        "999:999",
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
        "--publish",
        "127.0.0.1::5432",
        "--env",
        "POSTGRES_USER=ingenium_schema_owner",
        "--env",
        "POSTGRES_DB=ingenium_ui_preview",
        "--env",
        "POSTGRES_PASSWORD",
        "--env",
        "POSTGRES_API_PASSWORD",
        "--tmpfs",
        "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=512m,uid=999,gid=999,mode=0700",
        "--tmpfs",
        "/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700",
        "--mount",
        `type=bind,src=${roleScript},dst=/docker-entrypoint-initdb.d/01-api-role.sql,readonly`,
        "--log-driver",
        "json-file",
        "--log-opt",
        "max-size=1m",
        "--log-opt",
        "max-file=1",
        IMAGE,
      ],
      {
        ...process.env,
        POSTGRES_PASSWORD: password,
        POSTGRES_API_PASSWORD: apiPassword,
      },
    );
    await docker(["start", name]);
    const dbPort = await docker([
      "inspect",
      "--format",
      '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
      name,
    ]);
    assert.match(dbPort, /^[1-9]\d{0,4}$/);
    const ownerUrl = new URL(
      `postgresql://127.0.0.1:${dbPort}/ingenium_ui_preview`,
    );
    ownerUrl.username = "ingenium_schema_owner";
    ownerUrl.password = password;
    const owner = pool(ownerUrl.toString());
    for (let i = 0; ; i++) {
      try {
        await owner.query("SELECT 1");
        break;
      } catch (error) {
        if (i === 59) throw error;
        await delay(500);
      }
    }
    await migrateDatabase(ownerUrl.toString());
    const apiUrl = new URL(ownerUrl);
    apiUrl.username = "ingenium_api";
    apiUrl.password = apiPassword;
    const api = pool(apiUrl.toString(), 12);
    const workerUrl = new URL(ownerUrl),
      workerRole = `ingenium_preview_worker_${nonce.replaceAll("-", "")}`,
      workerPassword = randomBytes(24).toString("hex");
    await owner.query(
      (
        await owner.query(
          "SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L IN ROLE ingenium_app_worker',$1::text,$2::text) sql",
          [workerRole, workerPassword],
        )
      ).rows[0].sql,
    );
    workerUrl.username = workerRole;
    workerUrl.password = workerPassword;
    const workerPool = pool(workerUrl.toString());
    await assertWorkerDatabase(workerPool);
    const clock = {
        assertHealthy() {},
        async verify() {},
        fault() {
          throw new Error("Local preview clock unavailable.");
        },
      },
      delivery = sessionDelivery("local-ui-preview", randomBytes(32));
    const entry = createEntryService(api, clock, delivery),
      staff = createStaffService(api, clock, delivery),
      content = createContentService(api, clock, delivery);
    const hostEpochId = randomUUID(),
      runtimes = new Map<string, { key: string; digest: string }>();
    await owner.query(
      "INSERT INTO judge_host_epochs(id,state,endpoint_ref,created_at) VALUES($1,'ACTIVE','local-ui-preview-only',date_trunc('milliseconds',clock_timestamp()))",
      [hostEpochId],
    );
    for (const language of LANGUAGES) {
      const key = `local-preview-${language}`,
        manifest = { synthetic_only: true, language };
      const row = (
        await owner.query(
          "INSERT INTO runtime_manifests(key,language,manifest,digest,created_at) VALUES($1,$2,$3::jsonb,sha256(convert_to($3::jsonb::text,'UTF8')),date_trunc('milliseconds',clock_timestamp())) RETURNING encode(digest,'hex') digest",
          [key, language, JSON.stringify(manifest)],
        )
      ).rows[0];
      runtimes.set(language, { key, digest: row.digest });
      await owner.query("INSERT INTO judge_host_runtimes VALUES($1,$2,$3)", [
        hostEpochId,
        language,
        key,
      ]);
    }
    const referenceOutputs = new Map<string, Buffer>();
    const outputKey = (language: string, source: string, input: string) =>
      JSON.stringify([language, source, input]);
    async function simulated(p: AuthoringPayload, signal: AbortSignal) {
      signal.throwIfAborted();
      const request = randomUUID();
      const wrong =
        p.sourceRole === "STARTER" ||
        p.source.toString("utf8").includes("PREVIEW_WRONG");
      return acceptJudgeReply(
        judgeReply(
          p,
          request,
          Buffer.from(
            wrong
              ? "SIMULATED_WRONG\n"
              : (referenceOutputs.get(
                  outputKey(
                    p.language,
                    p.source.toString("utf8"),
                    p.stdin.toString("utf8"),
                  ),
                ) ?? "12\n"),
          ),
        ),
        p,
        request,
        200,
      );
    }
    const driver: TrustedAuthoringDriver = {
      hostEpochId,
      endpointRef: "local-ui-preview-only",
      runtimes: runtimes as TrustedAuthoringDriver["runtimes"],
      async assertReady() {},
      submit: simulated,
      observe: simulated,
    };
    coordinator = createJudgingCoordinator(workerPool, clock, driver);
    assert.equal(await coordinator.tick(), "TICKED");
    async function identity(displayName: string, role: string) {
      const id = randomUUID(),
        code = newAccessCode();
      await owner.query(
        "INSERT INTO staff_identities(id,display_name,role) VALUES($1,$2,$3)",
        [id, displayName, role],
      );
      await owner.query(
        "INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",
        [randomUUID(), id, code.verifier],
      );
      return { id, code: code.code };
    }
    const seed = await identity("Preview setup owner", "OWNER"),
      admin = await identity("Demo Super Admin", "SUPER_ADMIN");
    const flow = await entry.begin(seed.code, {
      ip: "127.0.0.1",
      browserId: randomUUID(),
    });
    assert.equal(flow.audience, "STAFF");
    const actor = await staff.activate(flow.proofCookie, randomUUID());
    const teams = [];
    for (const [name, members] of [
      ["Neon Hunters", ["Asha", "Dev"]],
      ["Syntax Raiders", ["Mira", "Kabir"]],
    ] as const) {
      const id = randomUUID(),
        code = newAccessCode("TEAM");
      await owner.query("INSERT INTO teams(id,display_name) VALUES($1,$2)", [
        id,
        name,
      ]);
      for (const [index, member] of members.entries())
        await owner.query(
          "INSERT INTO team_members(id,team_id,position,display_name) VALUES($1,$2,$3,$4)",
          [randomUUID(), id, index + 1, member],
        );
      await owner.query(
        "INSERT INTO access_credentials(id,team_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",
        [randomUUID(), id, code.verifier],
      );
      teams.push({ id, name, code: code.code, members: [...members] });
    }
    async function edit(
      action: Parameters<typeof content.command>[1]["action"],
      targetId: string | null,
      payload: unknown,
    ) {
      // Fixture setup only; normal interactive requests keep all real quotas and cooldowns.
      await owner.query("DELETE FROM quota_buckets");
      const revision = (
        await owner.query(
          targetId
            ? "SELECT content_revision revision FROM bug_versions WHERE id=$1"
            : "SELECT revision FROM catalogue_control WHERE id=1",
          targetId ? [targetId] : [],
        )
      ).rows[0].revision;
      return content.command(actor.sessionCookie, {
        action,
        targetId,
        payload,
        expectedRevision: revision,
        requestKey: randomUUID(),
        reason: "Local UI preview fixture",
      });
    }
    const roundOne: string[] = [];
    const fixtures = [
      [1, "Signal checksum", 35],
      [1, "Overflow alert", 80],
      [2, "Race for the checksum", 55],
      [2, "The final signal", 95],
    ] as const;
    const missions =
      contentMode === "round1"
        ? roundOnePack.questions
        : fixtures.map(([round_type, title, difficulty]) => ({
            round_type,
            title,
            difficulty,
            category: "LOGIC",
            checker_mode: "EXACT_TEXT",
            statement:
              "A telemetry service combines two signed integers, but its program subtracts them. Fix it to print their sum.\n\nInput: two integers a and b.\nOutput: a + b followed by a newline.\n\nLocal UI demo only: Run/Submit is simulated. Add PREVIEW_WRONG to your code to preview a wrong answer.",
            variants: Object.fromEntries(
              LANGUAGES.map((language) => [
                language,
                {
                  starter_code: sources[language].replaceAll("a + b", "a - b"),
                  reference_solution_code: sources[language],
                  defect_description:
                    "Subtraction is used where addition is required.",
                },
              ]),
            ),
            cases: [
              {
                position: 1,
                visibility: "SAMPLE",
                input_data: "7 5\n",
                expected_output: "12\n",
              },
              {
                position: 2,
                visibility: "HIDDEN",
                input_data: "5 7\n",
                expected_output: "12\n",
              },
            ],
            hints: [
              "Compare the required arithmetic operation with the implemented one.",
              "The input parsing is correct; inspect the operator used for the result.",
              "Replace subtraction with addition, keeping the input/output format unchanged.",
            ].map((content, index) => ({ level: index + 1, content })),
          }));
    for (const mission of missions) {
      const { round_type: round, title, difficulty } = mission;
      const selectedLanguages = Object.keys(mission.variants) as Language[];
      for (const language of selectedLanguages) {
        const variant = (
          mission.variants as Record<
            string,
            { reference_solution_code: string }
          >
        )[language]!;
        for (const c of mission.cases)
          referenceOutputs.set(
            outputKey(language, variant.reference_solution_code, c.input_data),
            Buffer.from(c.expected_output),
          );
      }
      const version = (
        await edit("CREATE", null, {
          round_type: round,
          category: mission.category,
          title,
          difficulty,
          reward_multiplier: "base_bounty" in mission ? mission.base_bounty / (difficulty * 10) : 1,
          checker_mode: mission.checker_mode,
          statement: mission.statement,
        })
      ).version_id!;
      for (const language of selectedLanguages) {
        const variant = (
          mission.variants as Record<
            string,
            {
              starter_code: string;
              reference_solution_code: string;
              defect_description: string;
            }
          >
        )[language]!;
        await edit("VARIANT", version, {
          language,
          starter_code: variant.starter_code,
          reference_solution_code: variant.reference_solution_code,
          defect_description: variant.defect_description,
          runtime_key: runtimes.get(language)!.key,
          cpu_time_limit_ms: 2000,
          wall_time_limit_ms: 10000,
          memory_limit_kb: 524288,
        });
      }
      let hidden: string | undefined;
      const caseIds = new Map<number, string>();
      for (const c of mission.cases) {
        const result = await edit("CASE", version, { case_id: null, ...c });
        caseIds.set(c.position, result.case_id!);
        if (c.visibility === "HIDDEN" && !hidden) hidden = result.case_id!;
      }
      assert.ok(hidden);
      for (const hint of mission.hints) await edit("HINT", version, hint);
      for (const language of selectedLanguages) {
        const position = (
          mission.variants as Record<string, { witness_case_position?: number }>
        )[language]!.witness_case_position;
        await edit("WITNESSES", version, {
          language,
          witnesses: [
            {
              check_type: "TEST_CASE",
              test_case_id: position ? caseIds.get(position)! : hidden,
              expected_failure: "WRONG_OUTPUT",
            },
          ],
        });
      }
      const revision = (
        await owner.query(
          "SELECT content_revision FROM bug_versions WHERE id=$1",
          [version],
        )
      ).rows[0].content_revision;
      const snapshot = (
        await createValidationService(api, clock, delivery).prepare(
          actor.sessionCookie,
          {
            versionId: version,
            requestKey: randomUUID(),
            expectedRevision: revision,
            reason: "Local preview preparation",
          },
        )
      ).snapshot_id!;
      const run = (
        await createValidationRunService(api, clock, delivery).admit(
          actor.sessionCookie,
          {
            snapshotId: snapshot,
            requestKey: randomUUID(),
            expectedRevision: revision,
            reason: "Local simulated validation",
          },
        )
      ).run_id!;
      for (
        let i = 0;
        i < 100 &&
        (
          await owner.query("SELECT status FROM validation_runs WHERE id=$1", [
            run,
          ])
        ).rows[0].status !== "PASSED";
        i++
      )
        await coordinator.tick();
      assert.equal(
        (
          await owner.query("SELECT status FROM validation_runs WHERE id=$1", [
            run,
          ])
        ).rows[0].status,
        "PASSED",
      );
      await createPublicationService(api, clock, delivery).publish(
        actor.sessionCookie,
        {
          snapshotId: snapshot,
          runId: run,
          requestKey: randomUUID(),
          expectedRevision: revision,
          review: "Demo fixture only; no real compiler validation",
          ownCode: seed.code,
        },
      );
      if (round === 1) roundOne.push(snapshot);
    }
    const deps = {
        drawCipher: createDrawCipher(randomBytes(32)),
        async assertReady() {},
      },
      arena = createArenaService(api, clock, delivery);
    const { createCompetitionService } =
      await import("../src/competition/service.js");
    const competition = createCompetitionService(api, clock, delivery, deps);
    await owner.query("DELETE FROM quota_buckets");
    const round = (
      await arena.command(actor.sessionCookie, {
        action: "CREATE",
        roundId: null,
        requestKey: randomUUID(),
        expectedRevision: "0",
        durationMs: 18000000,
        teamIds: teams.map((t) => t.id),
        reason: "Local UI preview arena",
      })
    ).round_id!;
    for (const [action, payload] of [
      ["CONFIGURE", { snapshots: roundOne }],
      ["READY", {}],
      ["START", {}],
    ] as const) {
      const revision = (
        await owner.query("SELECT revision FROM rounds WHERE id=$1", [round])
      ).rows[0].revision;
      await competition.command(actor.sessionCookie, {
        action,
        roundId: round,
        requestKey: randomUUID(),
        expectedRevision: revision,
        payload,
        reason: "Start local preview",
        ownCode: seed.code,
      });
    }
    await owner.query("DELETE FROM quota_buckets");
    stopWorker = maintenanceLoop(
      () => coordinator!.tick(),
      250,
      () =>
        console.error(
          "Simulated preview worker unavailable; restart this preview if it persists.",
        ),
    );
    maintenance = startEventMaintenance(
      pool(apiUrl.toString(), 2),
      clock,
      (task) => console.error(`Local preview maintenance unavailable: ${task}`),
    );
    server = await startBrowserApp(
      { pool: api, clock, delivery, competition: deps },
      port,
      true,
    );
    return { origin: server.origin, adminCode: admin.code, teams, close };
  } catch (error) {
    await close();
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const stopped = new Promise<void>((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });
  let preview: Awaited<ReturnType<typeof startLocalPreview>> | undefined;
  try {
    console.log(
      "Preparing the local admin/contestant preview. Docker Desktop must be running.",
    );
    preview = await startLocalPreview();
    console.log(
      `\nLOCAL UI PREVIEW — demo data, simulated clock/judging; no code execution\nOpen: ${preview.origin}\nSuper Admin code: ${preview.adminCode}`,
    );
    for (const team of preview.teams)
      console.log(
        `${team.name} (${team.members.join(" / ")}) team code: ${team.code}`,
      );
    console.log(
      "Use separate browser profiles for admin and contestants. Ctrl+C stops the preview and removes only its demo database.",
    );
    await stopped;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Local preview could not start.",
    );
    process.exitCode = 1;
  } finally {
    await preview?.close();
  }
}
