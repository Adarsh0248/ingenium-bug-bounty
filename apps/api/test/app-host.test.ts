import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const [name, entry, memory, tasks, cpu] of [
  ["api", "server.js", "768M", "128", "100%"],
  ["judging", "worker/server.js", "384M", "64", "50%"],
]) {
  test(`${name} host service keeps the fixed restricted process and bounded supervision policy`, async () => {
    const unit = await readFile(
      new URL(
        `../../../infra/app-host/ingenium-${name}.service`,
        import.meta.url,
      ),
      "utf8",
    );
    for (const line of [
      "Type=exec",
      `User=ingenium-${name}`,
      `Group=ingenium-${name}`,
      "WorkingDirectory=/opt/ingenium/release/apps/api",
      `ExecStart=/usr/local/bin/node /opt/ingenium/release/apps/api/dist/${entry}`,
      "Restart=on-failure",
      "RestartSec=5",
      "StartLimitIntervalSec=60",
      "StartLimitBurst=3",
      "TimeoutStopSec=45",
      "KillMode=control-group",
      "UMask=0077",
      "NoNewPrivileges=true",
      "CapabilityBoundingSet=",
      "AmbientCapabilities=",
      "ProtectSystem=strict",
      "ProtectHome=true",
      "PrivateTmp=true",
      "PrivateDevices=true",
      "ProtectControlGroups=true",
      `MemoryMax=${memory}`,
      `TasksMax=${tasks}`,
      `CPUQuota=${cpu}`,
      "LimitCORE=0",
    ])
      assert.ok(
        unit.split("\n").includes(line),
        `Missing reviewed directive: ${line}`,
      );
    assert.doesNotMatch(
      unit,
      /Exec(StartPre|StartPost|Stop|Reload)=|--env-file|npm |docker |db:migrate|staff:bootstrap|MemoryDenyWriteExecute|PrivateNetwork|ProcSubset|ProtectProc/,
    );
    if (name === "api") {
      assert.match(
        unit,
        /API_HOST=127\.0\.0\.1 API_PORT=3000 ENTRY_RUNTIME_FILE=\/etc\/ingenium\/api\/entry-runtime\.json COMPETITION_RUNTIME_FILE=\/etc\/ingenium\/api\/competition-runtime\.json/,
      );
      assert.ok(
        unit.includes("EnvironmentFile=/etc/ingenium/api/process.env\n"),
      );
      assert.ok(
        unit.includes(
          "InaccessiblePaths=-/etc/ingenium/judging -/run/docker.sock\n",
        ),
      );
      assert.doesNotMatch(unit, /JUDGING_RUNTIME_FILE/);
    } else {
      assert.ok(
        unit.includes(
          "JUDGING_RUNTIME_FILE=/etc/ingenium/judging/runtime.json\n",
        ),
      );
      assert.ok(
        unit.includes(
          "InaccessiblePaths=-/etc/ingenium/api -/run/docker.sock\n",
        ),
      );
      assert.doesNotMatch(
        unit,
        /EnvironmentFile=|DATABASE_URL|ENTRY_RUNTIME_FILE|COMPETITION_RUNTIME_FILE/,
      );
    }
  });
}
