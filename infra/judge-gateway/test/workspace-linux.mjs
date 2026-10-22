import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rmdir, statfs, symlink, unlink, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { createExecutionPlan } from "/workspace/apps/api/dist/judge/execution-plan.js";
import { prepareExecutionWorkspace } from "/workspace/apps/api/dist/judge/workspace.js";
import { openPhaseAccounting } from "/workspace/apps/api/dist/judge/cgroup-accounting.js";

const workspace = "/run/ingenium/workspace", control = "/run/ingenium/control";
const scenario = process.env.INGENIUM_WORKSPACE_SCENARIO, language = process.env.INGENIUM_WORKSPACE_LANGUAGE || "cpp";
const payload = { hostEpochId: randomUUID(), attemptId: randomUUID(), runId: randomUUID(), checkId: randomUUID(), language,
  runtimeKey: `synthetic-${language}`, runtimeDigest: "a".repeat(64), sourceRole: "REFERENCE", checkType: "TEST_CASE",
  source: Buffer.from([0, 255, 13, 10, 65, 66]), stdin: Buffer.from("private input must not become a workspace file"), cpuMs: 1000, wallMs: 5000, memoryKb: 16384 };
const plan = () => createExecutionPlan({ payload, owner: randomUUID(), providerToken: randomUUID() },
  new Map([[language, { key: payload.runtimeKey, digest: payload.runtimeDigest }]]));
const signal = () => new AbortController().signal;

if (scenario === "ordinary-directory") {
  await mkdir(workspace, { mode: 0o755 }); await mkdir(control, { mode: 0o700 });
}
if (scenario === "stale") await writeFile(`${control}/preparing.json`, "retained interrupted intent", { mode: 0o400 });
if (scenario === "preexisting") await writeFile(`${workspace}/retained.txt`, "must not be overwritten");
if (scenario === "symlink") await symlink("/etc/passwd", `${workspace}/${plan().sourceFile}`);

if (!["positive", "byte-quota", "inode-quota"].includes(scenario)) {
  test(`workspace refuses ${scenario} without weakening mounts or discarding retained state`, async () => {
    const beforeWorkspace = await readdir(workspace), beforeControl = await readdir(control);
    await assert.rejects(prepareExecutionWorkspace(plan(), signal()));
    if (scenario === "no-chown") {
      assert.deepEqual((await readdir(control)).sort(), ["preparing.json"]);
      assert.deepEqual(await readdir(workspace), [plan().sourceFile]);
      await assert.rejects(prepareExecutionWorkspace(plan(), signal()));
      assert.deepEqual(await readdir(control), ["preparing.json"]);
    } else {
      assert.deepEqual(await readdir(workspace), beforeWorkspace); assert.deepEqual(await readdir(control), beforeControl);
    }
    if (scenario === "stale") assert.equal(await readFile(`${control}/preparing.json`, "ascii"), "retained interrupted intent");
    if (scenario === "preexisting") assert.equal(await readFile(`${workspace}/retained.txt`, "ascii"), "must not be overwritten");
  });
} else if (scenario === "byte-quota" || scenario === "inode-quota") {
  test(`workspace enforces a real tmpfs ${scenario} rather than an application-only estimate`, async () => {
    const handle = await prepareExecutionWorkspace(plan(), signal());
    try {
      if (scenario === "byte-quota") {
        const file = await open(`${workspace}/fill`, "wx"), chunk = Buffer.alloc(1048576, 65); let written = 0;
        try { await assert.rejects(async () => { for (let i = 0; i < 65; i++) { await file.writeFile(chunk); written++; } }, { code: "ENOSPC" }); }
        finally { await file.close(); }
        assert.ok(written < 65); assert.equal((await statfs(workspace)).bavail, 0);
      } else {
        let written = 0;
        await assert.rejects(async () => { for (let i = 0; i < 4096; i++) { await writeFile(`${workspace}/inode-${i}`, "", { flag: "wx" }); written++; } }, { code: "ENOSPC" });
        assert.equal(written, 4094); assert.equal((await statfs(workspace)).ffree, 0);
      }
      assert.deepEqual(await readFile(`${workspace}/${plan().sourceFile}`), payload.source);
    } finally { await handle.close(); }
  });
} else {
  const p = plan(); let handle;
  test("workspace rejects changed reviewed commands or source paths before creating files", async () => {
    await assert.rejects(prepareExecutionWorkspace({ ...p, sourceFile: "../escape" }, signal()));
    await assert.rejects(prepareExecutionWorkspace({ ...p, restrictions: { ...p.restrictions, workspaceBytes: 134217728 } }, signal()));
    assert.deepEqual(await readdir(workspace), []); assert.deepEqual(await readdir(control), []);
  });
  test(`${language}: eight overlapping preparations produce exactly one source workspace and one private binding`, async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => prepareExecutionWorkspace(p, signal())));
    const successes = results.filter(result => result.status === "fulfilled");
    assert.equal(successes.length, 1, results.filter(result => result.status === "rejected").map(result => result.reason.stack).join("\n")); handle = successes[0].value;
    assert.deepEqual(await readFile(`${workspace}/${p.sourceFile}`), payload.source);
    assert.equal(handle.sourceSha256, createHash("sha256").update(payload.source).digest("hex")); assert.equal(handle.sourceBytes, 6);
    const info = await lstat(workspace), source = await lstat(`${workspace}/${p.sourceFile}`), privateInfo = await lstat(control);
    assert.equal(info.uid, 60000); assert.equal(info.gid, 60000); assert.equal(info.mode & 0o7777, 0o700);
    assert.equal(source.uid, 0); assert.equal(source.mode & 0o7777, 0o444); assert.equal(source.nlink, 1);
    assert.equal(privateInfo.uid, 0); assert.equal(privateInfo.mode & 0o7777, 0o700);
    assert.deepEqual((await readdir(control)).sort(), ["preparing.json", "ready.json"]);
    const receipt = await readFile(`${control}/ready.json`, "ascii"); assert.equal(receipt, await readFile(`${control}/preparing.json`, "ascii"));
    assert.ok(!receipt.includes(payload.stdin.toString())); assert.ok(!receipt.includes(p.providerToken));
    await assert.rejects(prepareExecutionWorkspace(p, signal()));
  });
  test("source verification uses pinned bytes, not buffers later changed by its caller", async () => {
    p.source.fill(90); p.stdin.fill(90); await handle.verifyBeforeFirstPhase();
    assert.deepEqual(await readFile(`${workspace}/${p.sourceFile}`), payload.source);
  });
  test("ordinary files pretending to be job counters are rejected, not certified as cgroup accounting", async () => {
    await mkdir("/run/ingenium/cgroups/memory/box-0", { recursive: true, mode: 0o755 });
    await mkdir("/run/ingenium/cgroups/cpuacct/box-0", { recursive: true, mode: 0o755 });
    await assert.rejects(openPhaseAccounting(plan(), "run"), /accounting unavailable/);
  });
  test("same-inode source corruption is rejected even when its filename, owner and size still match", async () => {
    await writeFile(`${workspace}/${p.sourceFile}`, Buffer.alloc(payload.source.length, 90));
    await assert.rejects(handle.verifyBeforeFirstPhase());
    await writeFile(`${workspace}/${p.sourceFile}`, payload.source); await handle.verifyBeforeFirstPhase();
  });
  test("a changed private ready receipt cannot authorise the original source", async () => {
    const original = await readFile(`${control}/ready.json`);
    await writeFile(`${control}/ready.json`, Buffer.alloc(original.length, 90)); await assert.rejects(handle.verifyBeforeFirstPhase());
    await writeFile(`${control}/ready.json`, original); await handle.verifyBeforeFirstPhase();
  });
  test("compiled nested and companion artifacts remain intact; nothing filters Java down to Main.class", async () => {
    await mkdir(`${workspace}/package`, { mode: 0o700 });
    for (const name of ["Main.class", "Main$Helper.class", "package/Companion.class"]) await writeFile(`${workspace}/${name}`, Buffer.from([202, 254, 186, 190]));
    for (const name of ["Main.class", "Main$Helper.class", "package/Companion.class"]) assert.deepEqual(await readFile(`${workspace}/${name}`), Buffer.from([202, 254, 186, 190]));
    await assert.rejects(handle.verifyBeforeFirstPhase());
    // Only fixture artifacts are removed here; production preparation exposes no reset/recursive-cleanup operation.
    for (const name of ["Main.class", "Main$Helper.class", "package/Companion.class"]) await unlink(`${workspace}/${name}`);
    await rmdir(`${workspace}/package`); await handle.verifyBeforeFirstPhase();
  });
  test("source path replacement and closed handles cannot be reused as a fresh first phase", async () => {
    await unlink(`${workspace}/${p.sourceFile}`); await symlink("/etc/passwd", `${workspace}/${p.sourceFile}`);
    await assert.rejects(handle.verifyBeforeFirstPhase());
    await handle.close(); await handle.close(); await assert.rejects(handle.verifyBeforeFirstPhase());
    assert.equal(await readFile(`${control}/preparing.json`, "ascii"), await readFile(`${control}/ready.json`, "ascii"));
  });
}
