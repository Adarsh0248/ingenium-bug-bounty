import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash,randomUUID } from "node:crypto";
import { copyFile,mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";

assert.equal(process.argv.length,2,"This fixed rehearsal builder accepts no settings or credentials.");
const repo=fileURLToPath(new URL("../../",import.meta.url)),directory=join(repo,"build",`host-registry-${randomUUID()}`);await mkdir(directory);
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-registry-check.ts"],outfile:join(directory,"registry-check.js"),bundle:true,
  platform:"node",format:"esm",target:"node24",external:["pg-native"],logLevel:"silent",
  banner:{js:"import {createRequire as __ingeniumRequire} from 'node:module';const require=__ingeniumRequire(import.meta.url);"}});
await writeFile(join(directory,"package.json"),'{"type":"module","private":true}\n');
const names=["registry-check.js","package.json","prepare-registry.sh","provider-structural.sql","001_registry.sql","002_queue.sql","003_execution_lookup.sql","004_launch_gate.sql","005_participant_payloads.sql","006_supervisor_service.sql","007_eight_slots.sql"];
await copyFile(new URL("test/prepare-host-registry.sh",import.meta.url),join(directory,"prepare-registry.sh"));
await copyFile(new URL("test/prepare-host-registry-fix.sh",import.meta.url),join(directory,"prepare-registry-fix.sh"));names.push("prepare-registry-fix.sh");
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-registry-fix.ts"],outfile:join(directory,"registry-fix.js"),bundle:true,
  platform:"node",format:"esm",target:"node24",external:["pg-native"],logLevel:"silent",
  banner:{js:"import {createRequire as __ingeniumRequire} from 'node:module';const require=__ingeniumRequire(import.meta.url);"}});names.push("registry-fix.js");
await copyFile(new URL("test/provider-structural.sql",import.meta.url),join(directory,"provider-structural.sql"));
for(const name of names.filter(name=>/^00/.test(name)))await copyFile(new URL(name,import.meta.url),join(directory,name));
const exec=promisify(execFile);
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-release-mode-fix.ts"],outfile:join(directory,"release-mode-fix.js"),bundle:true,
  platform:"node",format:"esm",target:"node24",external:["pg-native"],logLevel:"silent",
  banner:{js:"import {createRequire as __ingeniumRequire} from 'node:module';const require=__ingeniumRequire(import.meta.url);"}});names.push("release-mode-fix.js");
await copyFile(new URL("test/prepare-release-mode-fix.sh",import.meta.url),join(directory,"prepare-release-mode-fix.sh"));names.push("prepare-release-mode-fix.sh");
await assert.rejects(exec(process.execPath,[join(directory,"release-mode-fix.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: release mode continuation caller; preserve original and continuation evidence, records and resources. AssertionError\n");return true;
});
const release=JSON.parse((await exec(process.execPath,["infra/judge-gateway/build-release.mjs"],{cwd:repo,timeout:30000,windowsHide:true})).stdout);
await copyFile(join(release.directory,"app/judge/host-cli.js"),join(directory,"host-cli.js"));names.push("host-cli.js");
await copyFile(new URL("test/prepare-release-rehearsal.sh",import.meta.url),join(directory,"prepare-release-rehearsal.sh"));names.push("prepare-release-rehearsal.sh");
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-release-check.ts"],outfile:join(directory,"release-check.js"),bundle:true,
  platform:"node",format:"esm",target:"node24",external:["pg-native"],logLevel:"silent",
  banner:{js:"import {createRequire as __ingeniumRequire} from 'node:module';const require=__ingeniumRequire(import.meta.url);"}});names.push("release-check.js");
await assert.rejects(exec(process.execPath,[join(directory,"release-check.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: reviewed release rehearsal caller; preserve the installation, all releases, epochs, records and resources. AssertionError\n");return true;
});
await assert.rejects(exec(process.execPath,[join(directory,"registry-check.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: fixed database/launcher rehearsal caller; preserve the installation, database, permits and physical resources. AssertionError\n");return true;
});
await assert.rejects(exec(process.execPath,[join(directory,"registry-fix.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: fixed registry continuation caller; preserve all original and continuation records/resources. AssertionError\n");return true;
});
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
await writeFile(join(directory,"SHA256SUMS"),(await Promise.all(names.map(async name=>`${hash(await readFile(join(directory,name)))}  ${name}`))).join("\n")+"\n");
console.log(JSON.stringify({directory,provider_schema:"STRUCTURAL_TEST_FIXTURE",event_admission:false,files:names.length+1}));
