import assert from "node:assert/strict";
import { chmod, mkdir, readFile, rename, symlink, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { createProtectedExecutorClient, executionRequest, acceptExecutionReply } from "/workspace/apps/api/dist/judge/executor.js";

const launcher = "/opt/ingenium/judge-executor/launch";
const source = Buffer.from("#!/usr/local/bin/node\n" + await readFile("/run/fixture.cjs", "utf8"));
await mkdir("/opt/ingenium/judge-executor", { recursive: true, mode: 0o755 });
await writeFile(launcher, source, { mode: 0o555 });
const hash = value => createHash("sha256").update(value).digest("hex");
const runtimes = new Map(["c", "cpp", "java", "python", "javascript"].map(language => [language, { key: `synthetic-${language}`, digest: hash(language) }]));
const settings = { hostEpochId: randomUUID(), bootId: (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim(), runtimes, launcherSha256: hash(source) };
const client = createProtectedExecutorClient(settings), signal = () => AbortSignal.timeout(10000);
const claim = { payload: { hostEpochId: settings.hostEpochId, attemptId: randomUUID(), runId: randomUUID(), checkId: randomUUID(),
  language: "cpp", runtimeKey: runtimes.get("cpp").key, runtimeDigest: runtimes.get("cpp").digest, sourceRole: "REFERENCE", checkType: "TEST_CASE",
  source: Buffer.from("not executable; this fixture never runs submitted source"), stdin: Buffer.from([0, 255, 10]), cpuMs: 1000, wallMs: 5000, memoryKb: 262144 },
  owner: randomUUID(), providerToken: randomUUID() };

test("Linux executes the verified open launcher inode through its inherited descriptor and accepts bound synthetic evidence", async () => {
  assert.deepEqual(await client.readiness(signal()), Buffer.alloc(32, 0xcc));
  await client.assertReady(signal());
  const request = executionRequest(claim, settings.bootId, runtimes, "EXECUTE");
  const result = await client.exchange(request, signal());
  assert.equal(Buffer.from(acceptExecutionReply(result, claim, request).stdout_b64, "base64").toString(), "12\n");
});
test("Linux refuses a changed hash, writable launcher/parent, symlink or wrong boot before granting fresh execution", async () => {
  await assert.rejects(createProtectedExecutorClient({ ...settings, launcherSha256: "0".repeat(64) }).assertReady(signal()));
  await chmod(launcher, 0o755);
  try { await assert.rejects(client.assertReady(signal())); } finally { await chmod(launcher, 0o555); }
  await chmod("/opt/ingenium", 0o777);
  try { await assert.rejects(client.assertReady(signal())); } finally { await chmod("/opt/ingenium", 0o755); }
  await rename(launcher, `${launcher}.original`); await symlink(`${launcher}.original`, launcher);
  try { await assert.rejects(client.assertReady(signal())); } finally { await unlink(launcher); await rename(`${launcher}.original`, launcher); }
  const boot = randomUUID(), wrong = createProtectedExecutorClient({ ...settings, bootId: boot });
  await assert.rejects(wrong.assertReady(signal()));
  await assert.rejects(wrong.exchange(executionRequest(claim, boot, runtimes, "EXECUTE"), signal()));
});
test("Linux read-only recovery can bind an old boot without granting readiness or a new launch", async () => {
  const boot = randomUUID(), old = createProtectedExecutorClient({ ...settings, bootId: boot });
  const request = executionRequest(claim, boot, runtimes, "RECOVER");
  assert.ok(acceptExecutionReply(await old.exchange(request, signal()), claim, request));
});
