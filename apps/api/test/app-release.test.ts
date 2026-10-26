import assert from "node:assert/strict";
import {test} from "node:test";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {createHash} from "node:crypto";
import {lstat,readFile} from "node:fs/promises";
import {resolve,dirname,basename} from "node:path";
import {fileURLToPath} from "node:url";

test("the app release has exact built-file hashes and excludes private settings, tests and local judge credentials",{timeout:30000},async()=>{
  const repo=fileURLToPath(new URL("../../../",import.meta.url)),exec=promisify(execFile),hash=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
  const result=await exec(process.execPath,["scripts/build-app-release.mjs"],{cwd:repo,timeout:25000,maxBuffer:8192,windowsHide:true});
  assert.equal(result.stderr,"");const output=JSON.parse(result.stdout);assert.equal(dirname(output.directory),resolve(repo,"build"));assert.match(basename(output.directory),/^app-release-[0-9a-f-]{36}$/);
  const bytes=await readFile(resolve(output.directory,"release.json")),manifest=JSON.parse(bytes.toString());assert.equal(hash(bytes),output.manifest_sha256);assert.equal(manifest.protocol,"ingenium-app-release-v1");assert.equal(manifest.deployment_ready,false);assert.equal(manifest.dependencies_installed,false);
  assert.equal(manifest.files.length,output.files);assert.ok(output.files>100);
  const names=new Set<string>();for(const file of manifest.files){assert.ok(!names.has(file.path));names.add(file.path);assert.doesNotMatch(file.path,/(^|\/)(?:\.env[^/]*|build|test-results|tests?|secrets|node_modules)(\/|$)/i);const path=resolve(output.directory,file.path);assert.equal((await lstat(path)).isFile(),true);const contents=await readFile(path);assert.equal(contents.length,file.size);assert.equal(hash(contents),file.sha256);}
  for(const name of ["apps/api/dist/server.js","apps/api/dist/worker/server.js","apps/web/dist/index.html","infra/clock-agent/probe.py","infra/backup/Dockerfile","infra/clock-agent/entry-runtime.example.json","infra/maintenance/staff-maintenance-runtime.example.json","package-lock.json"])assert.ok(names.has(name));
});
