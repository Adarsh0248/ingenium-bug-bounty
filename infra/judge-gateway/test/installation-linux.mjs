import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, copyFile, link, mkdir, open as openFile, readFile, readdir, readlink, rename, symlink, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { after, test } from "node:test";
import { promisify } from "node:util";
import { HOST_INSTALLATION as root, openHostInstallation } from "/workspace/apps/api/dist/judge/host-installation.js";
import { ISOLATE_CONFIGURATION } from "/workspace/apps/api/dist/judge/isolate-context.js";
import { capsuleReference } from "/workspace/apps/api/dist/judge/capsule-lifecycle.js";
import { createExecutionPlan } from "/workspace/apps/api/dist/judge/execution-plan.js";
import { dockerDaemonDigest, dockerImageConfigDigest } from "/workspace/apps/api/dist/judge/docker-host.js";
import { localDockerCommand } from "/workspace/apps/api/dist/judge/docker-capsule.js";

const hash = value => createHash("sha256").update(value).digest("hex"), signal = () => AbortSignal.timeout(15000);
const exec = promisify(execFile);
const reports = JSON.parse(await readFile("/fixture/docker-reports.json", "utf8"));
const daemonLine = JSON.stringify(reports.daemon) + "\n", imageLine = JSON.stringify(reports.image) + "\n";
const wrongDaemonLine = JSON.stringify({ ...reports.daemon, ID: "replacement-daemon" }) + "\n";
const wrongImageLine = JSON.stringify({ ...reports.image, Config: { ...reports.image.Config, Env: ["NODE_OPTIONS=--require=/tmp/hook"] } }) + "\n";
await mkdir(root, { mode: 0o755 });
await writeFile("/tmp/daemon-fixture.c", `#define _GNU_SOURCE
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <unistd.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
int main(void) {
  umask(0077);
  int listener = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0); if (listener < 0) return 1;
  struct sockaddr_un address = { .sun_family = AF_UNIX }; strcpy(address.sun_path, "/run/docker.sock");
  if (bind(listener, (struct sockaddr *)&address, sizeof address) || chmod(address.sun_path, 0600) || listen(listener, 64)) return 2;
  puts("READY"); fflush(stdout);
  for (;;) {
    if (access("/opt/ingenium/exit-peer", F_OK) == 0) return 0;
    if (access("/opt/ingenium/exec-peer", F_OK) == 0) { execl("/bin/sleep", "sleep", "20", (char *)NULL); return 3; }
    struct pollfd p = { .fd = listener, .events = POLLIN };
    if (poll(&p, 1, 20) > 0) { int client = accept4(listener, NULL, NULL, SOCK_CLOEXEC); if (client >= 0) close(client); }
  }
}
`);
await exec("gcc", ["-Wall", "-Wextra", "-Werror", "-O2", "/tmp/daemon-fixture.c", "-o", `${root}/dockerd`]);
await exec("gcc", ["-std=c17", "-Wall", "-Wextra", "-Werror", "-O2", "-static", "/fixture/docker-peer-exec.c", "-o", `${root}/peer-exec`]);
await writeFile("/tmp/docker-fixture.c", `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
int main(int argc, char **argv) {
  if (getenv("DOCKER_HOST") || getenv("DOCKER_CONFIG") || argc < 6 || strcmp(argv[1], "--host") || strcmp(argv[2], "unix:///var/run/docker.sock")
    || strcmp(argv[3], "--config") || strcmp(argv[4], "/opt/ingenium/judge-executor/docker-client")) return 7;
  FILE *changed = fopen("/opt/ingenium/changed-daemon", "r"); int bad_daemon = changed != NULL; if (changed) fclose(changed);
  changed = fopen("/opt/ingenium/changed-image", "r"); int bad_image = changed != NULL; if (changed) fclose(changed);
  if (!strcmp(argv[5], "info")) { fputs(bad_daemon ? ${JSON.stringify(wrongDaemonLine)} : ${JSON.stringify(daemonLine)}, stdout); return 0; }
  if (!strcmp(argv[5], "image")) { fputs(bad_image ? ${JSON.stringify(wrongImageLine)} : ${JSON.stringify(imageLine)}, stdout); return 0; }
  if (!strcmp(argv[5], "create")) {
    const char *faults[] = { "exit", "exec", "hold" };
    for (int i = 0; i < 3; i++) {
      char path[128]; snprintf(path, sizeof path, "/opt/ingenium/%s-on-create", faults[i]);
      if (access(path, F_OK) != 0) continue;
      FILE *marker = fopen("/opt/ingenium/command-child", "w"); if (!marker) return 8;
      fprintf(marker, "%ld", (long)getpid()); fclose(marker);
      if (i < 2) { snprintf(path, sizeof path, "/opt/ingenium/%s-peer", faults[i]); marker = fopen(path, "w"); if (!marker) return 8; fclose(marker); }
      sleep(20); return 8;
    }
    FILE *created = fopen("/opt/ingenium/created-ids", "a"); if (!created) return 8; fputs("created\\n", created); fclose(created);
    FILE *after = fopen("/opt/ingenium/fail-after-create", "r");
    if (after) { fclose(after); after = fopen("/opt/ingenium/changed-daemon", "w"); if (!after) return 8; fputs("changed", after); fclose(after); }
    puts("${"a".repeat(64)}"); return 0;
  }
  if (!strcmp(argv[5], "container")) return 0;
  return 9;
}
`);
await exec("gcc", ["-Wall", "-Werror", "-O2", "/tmp/docker-fixture.c", "-o", `${root}/docker`]);
const dockerBytes = await readFile(`${root}/docker`);
// These are trusted test artifacts, not a production image, daemon, policy or host authority.
const content = new Map([
  ["app/dependency/index.js", Buffer.from("export const fixture = true;\n")],
  ["app/judge/capsule-cli.js", Buffer.from("// non-executable fixture\n")],
  ["docker", dockerBytes], ["docker-client/config.json", Buffer.from("{}\n")], ["dockerd", await readFile(`${root}/dockerd`)],
  ["launch", Buffer.from("#!/opt/ingenium/judge-executor/node\n// fixture\n")], ["node", dockerBytes],
  ["peer-exec", await readFile(`${root}/peer-exec`)],
  ["security/apparmor", Buffer.from("# synthetic, never loaded\n")], ["security/isolate", Buffer.from(ISOLATE_CONFIGURATION)],
  ["security/seccomp.json", Buffer.from('{"defaultAction":"SCMP_ACT_ERRNO","syscalls":[]}\n')],
]);
const folders = ["", "app", "app/dependency", "app/judge", "docker-client", "security"];
for (const path of folders.slice(1)) await mkdir(`${root}/${path}`, { recursive: true, mode: 0o755 });
const mode = path => ["docker", "dockerd", "launch", "node", "peer-exec"].includes(path) ? 0o555 : 0o444;
for (const [path, bytes] of content) { await writeFile(`${root}/${path}`, bytes); await chmod(`${root}/${path}`, mode(path)); }
for (const path of folders) await chmod(path ? `${root}/${path}` : root, 0o555);
const manifest = { version: 3, image_id: reports.image.Id, daemon_sha256: dockerDaemonDigest(Buffer.from(daemonLine)),
  image_config_sha256: dockerImageConfigDigest(Buffer.from(imageLine), reports.image.Id),
  files: [...content].sort(([a], [b]) => a < b ? -1 : 1).map(([path, bytes]) => ({ path, size: bytes.length, mode: mode(path), sha256: hash(bytes) })) };
const release = { imageId: manifest.image_id, digest: hash(JSON.stringify(manifest)) };
async function startServer() {
  const child = spawn(`${root}/dockerd`, [], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("fixture peer did not start")), 5000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(new Error("fixture peer exited before readiness")); });
    child.stdout.once("data", bytes => { clearTimeout(timer); if (bytes.toString() !== "READY\n") reject(new Error("invalid fixture peer readiness")); else resolve(); });
  });
  return child;
}
let server = await startServer();
async function stopServer() {
  if (server.exitCode !== null || server.signalCode !== null) return;
  await new Promise(resolve => { server.once("close", resolve); server.kill("SIGTERM"); });
}
after(stopServer);
const runtimes = new Map(["c", "cpp", "java", "python", "javascript"].map(key => [key, { key: `synthetic-${key}`, digest: hash(key) }]));
const claim = { payload: { hostEpochId: randomUUID(), attemptId: randomUUID(), runId: randomUUID(), checkId: randomUUID(), language: "cpp", runtimeKey: runtimes.get("cpp").key,
  runtimeDigest: runtimes.get("cpp").digest, sourceRole: "REFERENCE", checkType: "TEST_CASE", source: Buffer.from("data, never submitted to a sandbox"), stdin: Buffer.alloc(0), cpuMs: 1000, wallMs: 5000, memoryKb: 262144 },
  owner: randomUUID(), providerToken: randomUUID() };
const ref = capsuleReference(createExecutionPlan(claim, runtimes), { version: 1, nonce: randomUUID(), image_id: release.imageId, release_sha256: release.digest });
const open = () => openHostInstallation(manifest, release, signal());

test("real protected release tree hashes every dependency and executes only the pinned trusted Docker fixture through its inherited descriptor", async () => {
  const installation = await open(); let preparations = 0;
  try {
    await installation.verify(signal());
    const driver = installation.driver(async () => { preparations++; });
    assert.equal(await driver.create(ref, signal()), "a".repeat(64));
    assert.equal(preparations, 1);
    for (let i = 0; i < 20; i++) assert.equal(await driver.find(ref, signal()), null);
  } finally { await installation.close(); }
});

test("changed dependency bytes or modes stop creation before invoking the separate preparation authority", async () => {
  const installation = await open(); let preparations = 0;
  const driver = installation.driver(async () => { preparations++; }), path = `${root}/app/dependency/index.js`;
  try {
    await chmod(path, 0o666); await assert.rejects(driver.create(ref, signal())); await chmod(path, 0o444);
    await chmod(path, 0o644); await writeFile(path, Buffer.alloc(content.get("app/dependency/index.js").length, 88)); await chmod(path, 0o444);
    await assert.rejects(driver.create(ref, signal())); assert.equal(preparations, 0);
  } finally {
    await chmod(path, 0o644); await writeFile(path, content.get("app/dependency/index.js")); await chmod(path, 0o444); await installation.close();
  }
});

test("unlisted files, empty directories and writable installation parents are rejected without deletion", async () => {
  const installation = await open();
  try {
    await chmod(`${root}/app`, 0o755); await assert.rejects(installation.verify(signal())); await chmod(`${root}/app`, 0o555);
    await chmod(root, 0o755); await assert.rejects(installation.verify(signal()));
    await writeFile(`${root}/unlisted`, "unreviewed"); await chmod(root, 0o555); await assert.rejects(installation.verify(signal()));
    assert.equal(await readFile(`${root}/unlisted`, "utf8"), "unreviewed");
    await chmod(root, 0o755); await unlink(`${root}/unlisted`); await mkdir(`${root}/empty`); await chmod(root, 0o555);
    await assert.rejects(installation.verify(signal()));
  } finally {
    const { rmdir } = await import("node:fs/promises"); await chmod(root, 0o755); await rmdir(`${root}/empty`); await chmod(root, 0o555); await installation.close();
  }
});

test("linked artifacts, hard links and linked directories cannot replace reviewed original files", async () => {
  const installation = await open(), path = `${root}/app/dependency/index.js`; let moved = false;
  try {
    await chmod(`${root}/app/dependency`, 0o755); await rename(path, "/opt/ingenium/original-dependency"); await symlink("/opt/ingenium/original-dependency", path);
    await chmod(`${root}/app/dependency`, 0o555); await assert.rejects(installation.verify(signal()));
    await chmod(`${root}/app/dependency`, 0o755); await unlink(path); await rename("/opt/ingenium/original-dependency", path); await chmod(`${root}/app/dependency`, 0o555);
    await link(path, "/opt/ingenium/duplicate-dependency"); await assert.rejects(installation.verify(signal())); await unlink("/opt/ingenium/duplicate-dependency");
    await chmod(`${root}/app`, 0o755); await chmod(`${root}/app/dependency`, 0o755);
    await rename(`${root}/app/dependency`, "/opt/ingenium/moved-dependency"); moved = true; await chmod("/opt/ingenium/moved-dependency", 0o555);
    await symlink("/opt/ingenium/moved-dependency", `${root}/app/dependency`); await chmod(`${root}/app`, 0o555);
    await assert.rejects(installation.verify(signal()));
  } finally {
    await chmod(`${root}/app`, 0o755);
    if (moved) { await unlink(`${root}/app/dependency`); await chmod("/opt/ingenium/moved-dependency", 0o755); await rename("/opt/ingenium/moved-dependency", `${root}/app/dependency`); }
    await chmod(`${root}/app/dependency`, 0o555);
    await chmod(`${root}/app`, 0o555); await installation.close();
  }
});

test("trusted preparation remains mandatory and foreign release bindings or later cancellation cannot start the fixture", async () => {
  const installation = await open(); let calls = 0;
  try {
    await assert.rejects(installation.driver(async () => { throw new Error("unverified host"); }).create(ref, signal()), /unverified host/);
    const driver = installation.driver(async () => { calls++; });
    await assert.rejects(driver.create({ ...ref, intent: { ...ref.intent, release_sha256: "f".repeat(64) } }, signal())); assert.equal(calls, 0);
    const controller = new AbortController();
    await assert.rejects(installation.driver(async () => controller.abort()).create(ref, controller.signal));
  } finally { await installation.close(); }
});

test("changed reported daemon/image configuration blocks creation before preparation without trusting a new observed pin", async () => {
  for (const flag of ["changed-daemon", "changed-image"]) {
    const installation = await open(), before = await readFile("/opt/ingenium/created-ids"); let preparations = 0;
    await writeFile(`/opt/ingenium/${flag}`, "synthetic drift");
    try {
      await assert.rejects(installation.driver(async () => { preparations++; }).create(ref, signal()));
      await assert.rejects(installation.driver(async () => {}).find(ref, signal()));
      assert.equal(preparations, 0); assert.deepEqual(await readFile("/opt/ingenium/created-ids"), before);
    } finally { await unlink(`/opt/ingenium/${flag}`); await installation.close(); }
  }
});

test("a report failure after the create reply keeps the outcome uncertain and never retries the completed command", async () => {
  const installation = await open(), before = await readFile("/opt/ingenium/created-ids", "utf8");
  await writeFile("/opt/ingenium/fail-after-create", "synthetic fault");
  try {
    const driver = installation.driver(async () => {});
    await assert.rejects(driver.create(ref, signal()));
    assert.equal(await readFile("/opt/ingenium/created-ids", "utf8"), before + "created\n");
    await assert.rejects(driver.find(ref, signal()));
    assert.equal(await readFile("/opt/ingenium/created-ids", "utf8"), before + "created\n");
  } finally { await unlink("/opt/ingenium/fail-after-create"); await unlink("/opt/ingenium/changed-daemon"); await installation.close(); }
});

test("report drift during trusted preparation is detected by the final check before create", async () => {
  const installation = await open(), before = await readFile("/opt/ingenium/created-ids");
  try {
    await assert.rejects(installation.driver(async () => writeFile("/opt/ingenium/changed-daemon", "synthetic drift")).create(ref, signal()));
    assert.deepEqual(await readFile("/opt/ingenium/created-ids"), before);
  } finally { await unlink("/opt/ingenium/changed-daemon"); await installation.close(); }
});

test("failed initial report checks do not leak the pinned Docker descriptor or return an installation", async () => {
  await writeFile("/opt/ingenium/changed-image", "synthetic drift");
  try {
    const before = (await readdir("/proc/self/fd")).length;
    for (let i = 0; i < 4; i++) await assert.rejects(open());
    assert.equal((await readdir("/proc/self/fd")).length, before);
  } finally { await unlink("/opt/ingenium/changed-image"); }
});

test("a release hash cannot enable Docker credential/context configuration or a changed Isolate policy", async () => {
  for (const [path, bytes] of [["docker-client/config.json", Buffer.from('{"credsStore":"fixture"}\n')], ["security/isolate", Buffer.from("num_boxes = 2\n")]]) {
    const target = `${root}/${path}`, changed = { ...manifest, files: manifest.files.map(file => file.path === path ? { ...file, size: bytes.length, sha256: hash(bytes) } : file) };
    await chmod(target, 0o644); await writeFile(target, bytes); await chmod(target, 0o444);
    try { await assert.rejects(openHostInstallation(changed, { imageId: changed.image_id, digest: hash(JSON.stringify(changed)) }, signal())); }
    finally { await chmod(target, 0o644); await writeFile(target, content.get(path)); await chmod(target, 0o444); }
  }
});

test("close refuses an in-flight verification, then permanently invalidates old drivers without descriptor reuse", async () => {
  const installation = await open(), driver = installation.driver(async () => {}), verifying = installation.verify(signal());
  await assert.rejects(installation.close()); await verifying; await installation.close(); await installation.close();
  await assert.rejects(installation.verify(signal())); await assert.rejects(driver.find(ref, signal())); await assert.rejects(driver.create(ref, signal()));
});

test("late malformed-policy failures close all opened directory/file/Docker descriptors without editing the installation", async () => {
  const path = "security/seccomp.json", target = `${root}/${path}`, bytes = Buffer.from("not JSON\n");
  const changed = { ...manifest, files: manifest.files.map(file => file.path === path ? { ...file, size: bytes.length, sha256: hash(bytes) } : file) };
  await chmod(target, 0o644); await writeFile(target, bytes); await chmod(target, 0o444);
  try {
    const before = (await readdir("/proc/self/fd")).length;
    for (let i = 0; i < 12; i++) await assert.rejects(openHostInstallation(changed, { imageId: changed.image_id, digest: hash(JSON.stringify(changed)) }, signal()));
    assert.equal((await readdir("/proc/self/fd")).length, before); assert.deepEqual(await readFile(target), bytes);
  } finally { await chmod(target, 0o644); await writeFile(target, content.get(path)); await chmod(target, 0o444); }
});

test("identical replacement bytes do not silently rebind any pinned Docker, daemon or peer-check executable", async () => {
  for (const name of ["docker", "dockerd", "peer-exec"]) {
  const installation = await open();
  try {
    await chmod(root, 0o755); await rename(`${root}/${name}`, "/opt/ingenium/original-executable"); await copyFile("/opt/ingenium/original-executable", `${root}/${name}`); await chmod(`${root}/${name}`, 0o555); await chmod(root, 0o555);
    await assert.rejects(installation.verify(signal())); await assert.rejects(installation.driver(async () => {}).find(ref, signal()));
  } finally {
    await installation.close(); await chmod(root, 0o755); await unlink(`${root}/${name}`); await rename("/opt/ingenium/original-executable", `${root}/${name}`); await chmod(root, 0o555);
  }
  }
});

async function waitFor(check) {
  const end = Date.now() + 5000;
  while (!await check()) { assert.ok(Date.now() < end, "fixture observation timed out"); await new Promise(resolve => setTimeout(resolve, 20)); }
}
async function childStopped(pid) {
  assert.match(pid, /^[1-9][0-9]*$/);
  try { return /^State:\s+Z/m.test(await readFile(`/proc/${pid}/status`, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return true; throw error; }
}

for (const fault of ["exit", "exec"]) test(`a socket peer that ${fault}s during a command is refused without signalling the peer or retrying create`, async () => {
  const installation = await open(), before = await readFile("/opt/ingenium/created-ids");
  const flag = `/opt/ingenium/${fault}-on-create`, trigger = `/opt/ingenium/${fault}-peer`;
  await writeFile(flag, "owned fixture fault");
  try {
    const started = Date.now(); await assert.rejects(installation.driver(async () => {}).create(ref, signal()));
    assert.ok(Date.now() - started < 10000, "peer failure must stop the held CLI before its own 20-second exit");
    assert.deepEqual(await readFile("/opt/ingenium/created-ids"), before);
    const pid = await readFile("/opt/ingenium/command-child", "utf8"); await waitFor(() => childStopped(pid));
    if (fault === "exec") { assert.equal(server.exitCode, null); assert.equal(server.signalCode, null); assert.match(await readlink(`/proc/${server.pid}/exe`), /\/sleep$/); }
  } finally {
    await installation.close(); await stopServer();
    await unlink(flag); await unlink(trigger); await unlink("/opt/ingenium/command-child");
    await unlink("/run/docker.sock"); server = await startServer();
  }
});

test("unsupported commands and endpoint overrides never run, and cancellation stops the owned CLI but not the peer", async () => {
  const files = [];
  try {
    for (const name of ["docker", "dockerd", "peer-exec"]) files.push(await openFile(`${root}/${name}`, "r"));
    const command = localDockerCommand(...files.map(file => file.fd));
    for (const args of [["pull", "ignored"], ["info", "--host=unix:///tmp/other"], ["info", "--context", "other"], ["info", "-Hother"], ["info", "--config=/tmp/other"]]) {
      await assert.rejects(command(args, Buffer.alloc(0), signal()));
    }
    const before = await readFile("/opt/ingenium/created-ids"), controller = new AbortController();
    await writeFile("/opt/ingenium/hold-on-create", "owned fixture fault");
    const running = assert.rejects(command(["create"], Buffer.alloc(0), controller.signal));
    try {
      await waitFor(async () => { try { await readFile("/opt/ingenium/command-child"); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } });
      controller.abort(); await running;
      const pid = await readFile("/opt/ingenium/command-child", "utf8"); await waitFor(() => childStopped(pid));
      assert.equal(server.exitCode, null); assert.equal(server.signalCode, null);
      assert.deepEqual(await readFile("/opt/ingenium/created-ids"), before);
    } finally { controller.abort(); await running; await unlink("/opt/ingenium/hold-on-create"); await unlink("/opt/ingenium/command-child"); }
  } finally { for (const file of files) await file.close(); }
});

test("non-root-accessible or replaced Unix sockets invalidate the installation rather than reconnecting to another daemon", async () => {
  const installation = await open();
  try {
    await chmod("/run/docker.sock", 0o666); await assert.rejects(open()); await assert.rejects(installation.verify(signal())); await chmod("/run/docker.sock", 0o600);
    await unlink("/run/docker.sock"); const replacement = createServer(socket => socket.destroy());
    await new Promise((resolve, reject) => replacement.once("error", reject).listen("/run/docker.sock", resolve)); await chmod("/run/docker.sock", 0o600); replacement.unref();
    try { await assert.rejects(open()); await assert.rejects(installation.verify(signal())); await assert.rejects(installation.driver(async () => {}).find(ref, signal())); }
    finally { await new Promise(resolve => replacement.close(resolve)); }
  } finally { await installation.close(); await stopServer(); }
});
