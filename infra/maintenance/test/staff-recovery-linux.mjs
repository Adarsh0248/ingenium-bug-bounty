import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, chown, readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { userInfo } from "node:os";
import { createRequire } from "node:module";
import { firstSuperAdmin } from "/workspace/apps/api/dist/access/staff-bootstrap.js";
import {
  newAccessCode,
  sessionDelivery,
} from "/workspace/apps/api/dist/access/credentials.js";
import { createEntryService } from "/workspace/apps/api/dist/access/entry-service.js";
import { createStaffService } from "/workspace/apps/api/dist/access/staff-service.js";

const require = createRequire("/workspace/apps/api/package.json"),
  { Pool } = require("pg");
let bytes = Buffer.alloc(0);
for await (const chunk of process.stdin) {
  bytes = Buffer.concat([bytes, chunk]);
  assert.ok(bytes.length <= 8192);
}
const settings = JSON.parse(bytes.toString("utf8"));
const root = "/run/operator-fixture";
await mkdir(root, { mode: 0o700 });
await writeFile(
  `${root}/runtime.json`,
  JSON.stringify({ schema_version: 1, database_url: settings.owner }),
  { mode: 0o600 },
);
await chown(`${root}/runtime.json`, 1000, 1000);
await chown(root, 1000, 1000);
process.setgid(1000);
process.setuid(1000);
const owner = new Pool({ connectionString: settings.owner, max: 2 }),
  api = new Pool({ connectionString: settings.api, max: 2 });
const exec = promisify(execFile);
const cli = (args) =>
  exec(
    process.execPath,
    ["/workspace/apps/api/dist/access/staff-recovery-cli.js", ...args],
    {
      env: {
        PATH: "/usr/local/bin:/usr/bin:/bin",
        STAFF_MAINTENANCE_RUNTIME_FILE: `${root}/runtime.json`,
      },
      timeout: 10000,
      maxBuffer: 16384,
    },
  );
const parsed = (result) => JSON.parse(result.stdout.split("\n")[0]);
const common = [
  "--confirm",
  "OPERATOR_SUPER_ADMIN",
  "--operator",
  "Synthetic Linux operator",
  "--verification",
  "Synthetic independent identity check",
  "--reason",
  "Synthetic CLI rehearsal",
];
try {
  const code = newAccessCode(),
    firstId = randomUUID();
  await firstSuperAdmin(owner, {
    requestKey: randomUUID(),
    staffId: firstId,
    credentialId: randomUUID(),
    displayName: "Synthetic CLI sole admin",
    operator: "Synthetic operator",
    osUser: userInfo().username,
    reason: "Synthetic Linux first setup",
    verifier: code.verifier,
  });
  const initial = parsed(await cli(["--inspect"]));
  assert.equal(initial.staff.length, 1);
  const key = randomUUID(),
    path = `${root}/backup.json`;
  const created = parsed(
    await cli([
      ...common,
      "--action",
      "CREATE",
      "--request-key",
      key,
      "--expected-revision",
      initial.security_revision,
      "--name",
      "Synthetic CLI backup",
      "--out",
      path,
    ]),
  );
  const candidate = JSON.parse(await readFile(path, "utf8"));
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(created.status, "RECORDED");
  assert.equal(created.outcome.credential_current, true);
  assert.equal(created.outcome.credential_id, candidate.input.credentialId);
  const state = await owner.query(
    "SELECT count(*)::integer AS n FROM access_credentials",
  );
  const resumed = parsed(
    await cli(["--confirm", "OPERATOR_SUPER_ADMIN", "--resume", path]),
  );
  assert.equal(resumed.outcome.request_key, key);
  assert.deepEqual(
    (await owner.query("SELECT count(*)::integer AS n FROM access_credentials"))
      .rows,
    state.rows,
  );
  const status = parsed(await cli(["--status", "--request-key", key]));
  assert.deepEqual(status, resumed);
  const delivery = sessionDelivery("synthetic-linux-operator", randomBytes(32)),
    clock = { assertHealthy() {}, async verify() {}, fault() {} };
  const entry = createEntryService(api, clock, delivery),
    staff = createStaffService(api, clock, delivery);
  const flow = await entry.begin(candidate.access_code, {
    ip: "127.0.0.1",
    browserId: randomUUID(),
  });
  assert.equal(flow.audience, "STAFF");
  const session = await staff.activate(flow.proofCookie, randomUUID());
  assert.equal(
    (await staff.inspect(session.sessionCookie)).role,
    "SUPER_ADMIN",
  );
  const first = parsed(await cli(["--inspect", "--staff-id", firstId]));
  const disabled = parsed(
    await cli([
      ...common,
      "--action",
      "DISABLE",
      "--staff-id",
      firstId,
      "--expected-revision",
      first.staff[0].revision,
      "--replacement-session",
      session.session.session_id,
      "--request-key",
      randomUUID(),
      "--out",
      `${root}/retire.json`,
    ]),
  );
  assert.equal(disabled.outcome.after_state.enabled, false);
  const retired = parsed(await cli(["--inspect", "--staff-id", firstId]));
  const rotated = parsed(
    await cli([
      ...common,
      "--action",
      "ROTATE",
      "--staff-id",
      firstId,
      "--expected-revision",
      retired.staff[0].revision,
      "--request-key",
      randomUUID(),
      "--out",
      `${root}/rotated.json`,
    ]),
  );
  const fresh = JSON.parse(await readFile(`${root}/rotated.json`, "utf8"));
  assert.notEqual(fresh.access_code, code.code);
  assert.equal(rotated.outcome.after_state.enabled, true);
  assert.equal(rotated.outcome.credential_current, true);
  await assert.rejects(
    entry.begin(code.code, { ip: "127.0.0.1", browserId: randomUUID() }),
  );
  const after = await owner.query(
    "SELECT count(*)::integer AS n FROM operator_staff_outcomes",
  );
  await assert.rejects(
    cli([
      ...common,
      "--action",
      "CREATE",
      "--request-key",
      randomUUID(),
      "--expected-revision",
      "0",
      "--name",
      "Never overwrite",
      "--out",
      path,
    ]),
    (e) => {
      assert.match(e.stderr, /Operator action not acknowledged/);
      assert.doesNotMatch(
        e.stdout + e.stderr,
        new RegExp(candidate.access_code),
      );
      return true;
    },
  );
  assert.deepEqual(
    (
      await owner.query(
        "SELECT count(*)::integer AS n FROM operator_staff_outcomes",
      )
    ).rows,
    after.rows,
  );
  await assert.rejects(cli(["--inspect", "--status", "--request-key", key]));
  assert.equal(
    (await cli(["--inspect"])).stdout.includes(candidate.access_code),
    false,
  );
  console.log(
    "PASS: restricted operator CLI lifecycle and original-candidate recovery",
  );
} catch {
  console.error(
    "FAIL: synthetic operator CLI rehearsal; no private configuration or code is printed.",
  );
  process.exitCode = 1;
} finally {
  await api.end();
  await owner.end();
}
