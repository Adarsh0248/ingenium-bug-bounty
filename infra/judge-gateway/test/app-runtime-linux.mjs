import assert from "node:assert/strict";
import {
  mkdir,
  writeFile,
  chown,
  chmod,
  link,
  symlink,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { privateRuntimeJson } from "/workspace/apps/api/dist/runtime/private-file.js";
import {
  readOperatorCandidate,
  writeOperatorCandidate,
} from "/workspace/apps/api/dist/access/staff-recovery-file.js";

// Disposable fixture setup only; no production runtime, database or submitted source is available.
const root = "/run/app-runtime-fixture";
await mkdir(root, { mode: 0o700 });
for (const [name, value, mode] of [
  ["valid.json", '{"schema_version":1}', 0o600],
  ["wide.json", "{}", 0o644],
  ["large.json", "x".repeat(8193), 0o600],
  ["linked.json", "{}", 0o600],
  ["invalid.json", Buffer.from([0xff]), 0o600],
]) {
  await writeFile(`${root}/${name}`, value, { mode });
  await chown(`${root}/${name}`, 1000, 1000);
}
await symlink(`${root}/valid.json`, `${root}/symlink.json`);
await promisify(execFile)("/usr/bin/mkfifo", [
  "-m",
  "600",
  `${root}/pipe.json`,
]);
await chown(`${root}/pipe.json`, 1000, 1000);
await mkdir(`${root}/open`, { mode: 0o777 });
await chmod(`${root}/open`, 0o777);
await chown(`${root}/open`, 1000, 1000);
await writeFile(`${root}/open/config.json`, "{}", { mode: 0o600 });
await chown(`${root}/open/config.json`, 1000, 1000);
await assert.rejects(
  privateRuntimeJson(`${root}/valid.json`, 8192),
  /Restricted Linux/,
);
await chown(root, 1000, 1000);
process.setgid(1000);
process.setuid(1000);
await link(`${root}/linked.json`, `${root}/hardlink.json`);

test("Linux runtime accepts only a bounded private owned regular JSON file in protected parents", async () => {
  assert.deepEqual(await privateRuntimeJson(`${root}/valid.json`, 8192), {
    schema_version: 1,
  });
  for (const file of [
    "wide.json",
    "large.json",
    "linked.json",
    "hardlink.json",
    "symlink.json",
    "pipe.json",
    "invalid.json",
    "open/config.json",
  ])
    await assert.rejects(privateRuntimeJson(`${root}/${file}`, 8192));
});
test("actual standalone worker startup refuses incomplete private configuration without printing runtime secrets", async () => {
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      ["/workspace/apps/api/dist/worker/server.js"],
      {
        env: {
          PATH: "/usr/local/bin:/usr/bin:/bin",
          JUDGING_RUNTIME_FILE: `${root}/valid.json`,
        },
        timeout: 10000,
        maxBuffer: 8192,
      },
    ),
    (error) => {
      assert.match(error.stderr, /App judging startup refused/);
      assert.doesNotMatch(
        error.stderr,
        /schema_version|password|cookie|postgresql:\/\//,
      );
      return true;
    },
  );
});

test("operator candidate delivery is private, durable, exclusive and round-trips the original intent without overwriting", async () => {
  const candidate = {
    schema_version: 1,
    access_code: "A".repeat(32),
    input: {
      requestKey: "a229b0ce-1df6-4c12-8702-04a046ad025f",
      action: "CREATE",
      staffId: "99c52f07-73c9-43f0-9469-5e5d27cc9e76",
      credentialId: "a329b0ce-1df6-4c12-8702-04a046ad025f",
      displayName: "Synthetic Linux handoff",
      expectedRevision: "0",
      replacementSessionId: null,
      operator: "Synthetic operator",
      osUser: "node",
      verification: "Synthetic identity check",
      reason: "Synthetic candidate check",
    },
  };
  const path = `${root}/candidate.json`;
  await writeOperatorCandidate(path, candidate);
  assert.equal(
    (await readOperatorCandidate(path)).accessCode,
    candidate.access_code,
  );
  assert.equal(
    (await readOperatorCandidate(path)).input.requestKey,
    candidate.input.requestKey,
  );
  await assert.rejects(writeOperatorCandidate(path, candidate), {
    code: "EEXIST",
  });
  await assert.rejects(
    writeOperatorCandidate(`${root}/open/unsafe.json`, candidate),
    /Owner-only/,
  );
  await assert.rejects(
    writeOperatorCandidate(
      "/workspace/apps/api/..private/candidate.json",
      candidate,
    ),
    /outside the repository/,
  );
  await link(path, `${root}/candidate-link.json`);
  await assert.rejects(readOperatorCandidate(path));
  await assert.rejects(readOperatorCandidate(`${root}/candidate-link.json`));
});

test("actual operator CLI refuses unsafe or incomplete runtime configuration without printing credentials", async () => {
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      ["/workspace/apps/api/dist/access/staff-recovery-cli.js", "--inspect"],
      {
        env: {
          PATH: "/usr/local/bin:/usr/bin:/bin",
          STAFF_MAINTENANCE_RUNTIME_FILE: `${root}/valid.json`,
        },
        timeout: 10000,
        maxBuffer: 8192,
      },
    ),
    (error) => {
      assert.match(error.stderr, /Operator action not acknowledged/);
      assert.doesNotMatch(
        error.stderr,
        /postgresql:\/\/|access_code|schema_version|password/,
      );
      return true;
    },
  );
});
