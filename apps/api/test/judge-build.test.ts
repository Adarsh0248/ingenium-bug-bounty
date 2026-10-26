import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash,randomUUID } from "node:crypto";
import { lstat, readFile, realpath,writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { basename, dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

test("bundling a host resource reader cannot activate a capsule CLI through a transitive import",async()=>{
  const repo=fileURLToPath(new URL("../../../",import.meta.url)),file=resolve(repo,"build",`host-import-${randomUUID()}.mjs`);
  const bundle=await build({absWorkingDir:repo,stdin:{contents:"import {inodeIdentity} from './apps/api/src/judge/capsule-configuration.ts';console.log(typeof inodeIdentity);",resolveDir:repo,sourcefile:"host-reader.ts"},
    bundle:true,platform:"node",format:"esm",target:"node24",write:false,logLevel:"silent"});
  await writeFile(file,bundle.outputFiles[0]!.contents);
  const result=await promisify(execFile)(process.execPath,[file],{timeout:5000,windowsHide:true});
  assert.equal(result.stdout,"function\n");assert.equal(result.stderr,"");
});

test("offline judge packaging includes bounded standalone programs and exact source/policy hashes without installation or readiness", { timeout: 30000 }, async () => {
  const exec = promisify(execFile), repo = fileURLToPath(new URL("../../../", import.meta.url));
  const result = await exec(process.execPath, ["infra/judge-gateway/build-release.mjs"], { cwd: repo, timeout: 20000, maxBuffer: 8192, windowsHide: true });
  assert.equal(result.stderr, ""); const output = JSON.parse(result.stdout);
  assert.equal(output.host_verified, false); assert.equal(dirname(output.directory), resolve(repo, "build"));
  assert.match(basename(output.directory), /^judge-runtime-[0-9a-f-]{36}$/); assert.equal(await realpath(output.directory), output.directory);
  const raw = await readFile(resolve(output.directory, "bundle.json")), bundle = JSON.parse(raw.toString("utf8"));
  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(raw), output.bundle_sha256); assert.equal(bundle.protocol, "ingenium-judge-build-v1"); assert.equal(bundle.host_verified, false);
  assert.equal(bundle.files.length, 22);
  assert.deepEqual(bundle.files.filter((f:{path:string})=>f.path.endsWith(".sql")).map((f:{path:string})=>f.path),["001_registry.sql","002_queue.sql","003_execution_lookup.sql","004_launch_gate.sql","005_participant_payloads.sql","006_supervisor_service.sql","007_eight_slots.sql"]);
  for (const file of bundle.files) {
    assert.match(file.path, /^[A-Za-z0-9._/-]+$/); assert.ok(!file.path.split("/").includes(".."));
    const path = resolve(output.directory, file.path); assert.equal((await lstat(path)).isFile(), true);
    const bytes = await readFile(path); assert.equal(bytes.length, file.size); assert.equal(hash(bytes), file.sha256);
  }
  for (const name of ["host-cli", "capsule-cli"]) {
    const file = resolve(output.directory, `app/judge/${name}.js`);
    await exec(process.execPath, ["--check", file], { timeout: 5000, windowsHide: true });
    await assert.rejects(exec(process.execPath, [file, "--foreign"], { timeout: 5000, windowsHide: true }), (error: any) => {
      assert.equal(error.code, 125); assert.equal(error.stdout, "");
      assert.equal(error.stderr,name==="host-cli"?"Protected host refused; preserve original attempts, inspection intents and physical holds.\n":"Protected capsule unavailable; retain its original reservation.\n");return true;
    });
  }
});
