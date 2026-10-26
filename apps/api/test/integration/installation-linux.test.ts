import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { dockerDaemonDigest, dockerImageConfigDigest, verifyDockerReports } from "../../src/judge/docker-host.js";
import type { DockerCommand } from "../../src/judge/docker-capsule.js";

const IMAGE = "docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
const exec = promisify(execFile);
const docker = async (args: string[]) => (await exec("docker", args, { timeout: 45000, maxBuffer: 65536, windowsHide: true })).stdout.trim();

test("host prerequisite preparation has valid shell syntax and refuses an ordinary Linux container before mutation",{timeout:30000},async()=>{
  const nonce=randomUUID(),script=fileURLToPath(new URL("../../../../infra/judge-gateway/test/prepare-host-prerequisites.sh",import.meta.url)),toolchains=fileURLToPath(new URL("../../../../infra/judge-gateway/test/run-host-toolchains.sh",import.meta.url)),installation=fileURLToPath(new URL("../../../../infra/judge-gateway/test/prepare-host-installation.sh",import.meta.url));
  const registry=fileURLToPath(new URL("../../../../infra/judge-gateway/test/prepare-host-registry.sh",import.meta.url));
  const continuation=fileURLToPath(new URL("../../../../infra/judge-gateway/test/prepare-host-registry-fix.sh",import.meta.url));
  const id=await docker(["create","--pull=never","--label",`ingenium.installation-test=${nonce}`,"--restart","no","--network","none","--read-only","--user","0:0",
    "--cap-drop","ALL","--security-opt","no-new-privileges=true","--memory","32m","--memory-swap","32m","--cpus","0.1","--pids-limit","16","--log-driver","none",
    "--mount",`type=bind,src=${script},dst=/fixture/prepare.sh,readonly`,"--mount",`type=bind,src=${toolchains},dst=/fixture/toolchains.sh,readonly`,"--mount",`type=bind,src=${installation},dst=/fixture/installation.sh,readonly`,"--mount",`type=bind,src=${registry},dst=/fixture/registry.sh,readonly`,"--mount",`type=bind,src=${continuation},dst=/fixture/continuation.sh,readonly`,"--entrypoint","/bin/bash",IMAGE,"-c","bash -n /fixture/prepare.sh && bash -n /fixture/toolchains.sh && bash -n /fixture/installation.sh && bash -n /fixture/registry.sh && bash -n /fixture/continuation.sh && ! bash /fixture/continuation.sh && ! bash /fixture/registry.sh && ! bash /fixture/installation.sh && ! bash /fixture/toolchains.sh && exec bash /fixture/prepare.sh"]);
  try{
    await assert.rejects(exec("docker",["start","--attach",id],{timeout:10000,windowsHide:true}),(error:any)=>{
      assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"Registry continuation requires the approved verification VM and root.\nRegistry rehearsal requires the approved verification VM and root.\nHost installation probe requires the approved verification VM and root.\nToolchain probe requires the verification VM, root and one immutable image ID.\nPrerequisite setup requires the approved clean verification VM and root.\n");return true;
    });
  }finally{
    const config=JSON.parse(await docker(["inspect","--format","{{json .Config}}",id]));assert.equal(config.Image,IMAGE);assert.equal(config.Labels["ingenium.installation-test"],nonce);
    await docker(["stop","--timeout","2",id]);await docker(["rm",id]);
  }
});

test("release integrity and fixed Docker wiring use real Linux files/ELF/socket metadata but no host daemon or participant code", { timeout: 90000 }, async () => {
  const bindings = [["../../dist", "/workspace/apps/api/dist"], ["../../../../node_modules", "/workspace/node_modules"], ["../../package.json", "/workspace/apps/api/package.json"],
    ["../../../../infra/judge-gateway/test/installation-linux.mjs", "/fixture/installation-linux.mjs"], ["../fixtures/docker-reports.json", "/fixture/docker-reports.json"],
    ["../../../../infra/judge-gateway/native/docker-peer-exec.c", "/fixture/docker-peer-exec.c"],
    ["../../../../infra/judge-gateway/native/host-observe.c", "/fixture/host-observe.c"],
    ["../../../../infra/judge-gateway/native/launch.c", "/fixture/launch.c"],
    ["../../../../infra/judge-gateway/image-tree.py", "/fixture/image-tree.py"],
    ["../../../../infra/judge-gateway/test/test_image_tree.py", "/fixture/test/test_image_tree.py"]]
    .map(([source, target]) => [fileURLToPath(new URL(source!, import.meta.url)), target!] as const);
  for (const [source] of bindings) await lstat(source);
  const nonce = randomUUID(), volume = `ingenium-installation-test-${nonce}`;
  assert.equal(await docker(["volume", "create", "--label", `ingenium.installation-test=${nonce}`, volume]), volume);
  let container: string | undefined, unprivileged: string | undefined;
  try {
    container = await docker(["create", "--pull=never", "--name", `ingenium-installation-test-${nonce}`, "--label", `ingenium.installation-test=${nonce}`,
      "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
      "--memory", "256m", "--memory-swap", "256m", "--cpus", "0.5", "--pids-limit", "32",
      "--tmpfs", "/run:rw,nosuid,nodev,noexec,size=4m,mode=0755", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m,mode=0700",
      "--mount", `type=volume,src=${volume},dst=/opt/ingenium`,
      ...bindings.flatMap(([source, target]) => ["--mount", `type=bind,src=${source},dst=${target},readonly`]),
      "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", "--entrypoint", "/usr/local/bin/node", IMAGE,
      "--test", "--test-concurrency=1", "--test-reporter=tap", "/fixture/installation-linux.mjs"]);
    assert.match(container, /^[a-f0-9]{64}$/);
    const output = await docker(["start", "--attach", container]); assert.match(output, /# pass 24\b/); assert.match(output, /# fail 0\b/);
    unprivileged = await docker(["create", "--pull=never", "--name", `ingenium-installation-refusal-${nonce}`, "--label", `ingenium.installation-test=${nonce}`,
      "--restart", "no", "--network", "none", "--read-only", "--user", "65534:65534", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
      "--memory", "32m", "--memory-swap", "32m", "--cpus", "0.1", "--pids-limit", "4", "--log-driver", "none",
      "--mount", `type=volume,src=${volume},dst=/opt/ingenium,readonly`, "--entrypoint", "/opt/ingenium/launch-native", IMAGE, "--ready"]);
    assert.match(unprivileged, /^[a-f0-9]{64}$/);
    await assert.rejects(exec("docker", ["start", "--attach", unprivileged], { timeout: 10000, windowsHide: true }), (error: any) => {
      assert.equal(error.code, 125); assert.equal(error.stdout, ""); assert.equal(error.stderr, "Protected host launcher unavailable; retain original execution state.\n"); return true;
    });
  } finally {
    for (const id of [unprivileged, container].filter((id): id is string => Boolean(id))) {
      const config = JSON.parse(await docker(["inspect", "--format", "{{json .Config}}", id]));
      assert.equal(config.Image, IMAGE); assert.equal(config.Labels["ingenium.installation-test"], nonce);
      await docker(["stop", "--timeout", "2", id]); await docker(["rm", id]);
    }
    const config = JSON.parse(await docker(["volume", "inspect", "--format", "{{json .}}", volume]));
    assert.equal(config.Name, volume); assert.equal(config.Labels["ingenium.installation-test"], nonce); await docker(["volume", "rm", volume]);
  }
});

test("the real local Docker daemon cannot match synthetic reviewed-host pins; inspection performs no mutation", { timeout: 30000 }, async () => {
  const fixture = JSON.parse(await readFile(new URL("../fixtures/docker-reports.json", import.meta.url), "utf8"));
  const calls: string[][] = [], command: DockerCommand = async (args, input, signal) => {
    signal.throwIfAborted(); assert.equal(input.length, 0); assert.equal(args[0], "info"); calls.push([...args]);
    return Buffer.from(await docker([...args]));
  };
  const pins = { daemon_sha256: dockerDaemonDigest(Buffer.from(JSON.stringify(fixture.daemon))),
    image_config_sha256: dockerImageConfigDigest(Buffer.from(JSON.stringify(fixture.image)), fixture.image.Id) };
  await assert.rejects(verifyDockerReports(command, fixture.image.Id, pins, AbortSignal.timeout(20000)), /Docker reports/);
  assert.deepEqual(calls, [["info", "--format", "{{json .}}"]]);
});

test("the cached real image's config can be inspected without executing it, while a foreign ID or changed environment cannot share its digest", { timeout: 30000 }, async () => {
  const raw = Buffer.from(await docker(["image", "inspect", "--format", "{{json .}}", IMAGE]));
  const image = JSON.parse(raw.toString("utf8")), digest = dockerImageConfigDigest(raw, image.Id);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.throws(() => dockerImageConfigDigest(raw, `sha256:${"0".repeat(64)}`));
  const changed = { ...image, Config: { ...image.Config, Env: ["NODE_OPTIONS=--require=/tmp/unreviewed"] } };
  assert.notEqual(dockerImageConfigDigest(Buffer.from(JSON.stringify(changed)), image.Id), digest);
});
