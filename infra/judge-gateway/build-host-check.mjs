import assert from "node:assert/strict";
import { createHash,randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";

assert.equal(process.argv.length,3,"Pass the reviewed native-tools export directory.");
const repo=fileURLToPath(new URL("../../",import.meta.url)), native=resolve(process.argv[2]);
const directory=join(repo,"build",`host-prerequisites-${randomUUID()}`);await mkdir(directory);
const binary=await readFile(join(native,"host-observe"));
assert.ok(binary.length<=1048576&&binary.subarray(0,4).equals(Buffer.from([127,69,76,70])));
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
await copyFile(join(native,"host-observe"),join(directory,"host-observe"));
await writeFile(join(directory,"observer.sha256"),hash(binary)+"\n");
await copyFile(new URL("ingenium-isolate-executor.apparmor",import.meta.url),join(directory,"apparmor"));
await copyFile(new URL("test/prepare-host-prerequisites.sh",import.meta.url),join(directory,"prepare.sh"));
await copyFile(new URL("test/toolchains-linux.mjs",import.meta.url),join(directory,"toolchains-linux.mjs"));
await copyFile(new URL("test/run-host-toolchains.sh",import.meta.url),join(directory,"run-toolchains.sh"));
await copyFile(new URL("test/prepare-host-installation.sh",import.meta.url),join(directory,"prepare-installation.sh"));
await writeFile(join(directory,"package.json"),'{"type":"module","private":true}\n');
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-prerequisites.ts"],outfile:join(directory,"check.js"),
  bundle:true,platform:"node",format:"esm",target:"node24",logLevel:"silent"});
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-peer-check.ts"],outfile:join(directory,"peer-check.js"),
  bundle:true,platform:"node",format:"esm",target:"node24",logLevel:"silent"});
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-image-check.ts"],outfile:join(directory,"image-check.js"),
  bundle:true,platform:"node",format:"esm",target:"node24",logLevel:"silent"});
await build({absWorkingDir:repo,entryPoints:["infra/judge-gateway/test/host-installation-check.ts"],outfile:join(directory,"installation-check.js"),
  bundle:true,platform:"node",format:"esm",target:"node24",logLevel:"silent"});
const exec=promisify(execFile);
await assert.rejects(exec(process.execPath,[join(directory,"check.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: host prerequisite caller; preserve the installation and output.\n");return true;
});
await assert.rejects(exec(process.execPath,[join(directory,"peer-check.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: native Docker peer/report probe (caller); preserve files, daemon and output.\n");return true;
});
await assert.rejects(exec(process.execPath,[join(directory,"image-check.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: image baseline caller; preserve the installation and any inspection container.\n");return true;
});
await assert.rejects(exec(process.execPath,[join(directory,"installation-check.js"),"--foreign"],{timeout:5000,windowsHide:true}),error=>{
  assert.equal(error.code,1);assert.equal(error.stdout,"");assert.equal(error.stderr,"FAIL: full host preparation caller; preserve the installation, its cache and inspection container.\n");return true;
});
const release=JSON.parse((await exec(process.execPath,["infra/judge-gateway/build-release.mjs"],{cwd:repo,timeout:30000,windowsHide:true})).stdout);
const names=["apparmor","check.js","host-observe","observer.sha256","package.json","prepare.sh","peer-check.js","image-check.js","toolchains-linux.mjs","run-toolchains.sh","installation-check.js","prepare-installation.sh"];
for(const path of ["app/judge/host-cli.js","app/judge/capsule-cli.js","app/package.json","security/apparmor","security/isolate","security/seccomp.json","security/LICENSE.moby","security/SOURCE.md"]){
  const name=`release/${path}`;await mkdir(dirname(join(directory,name)),{recursive:true});await copyFile(join(release.directory,path),join(directory,name));names.push(name);
}
const launch=await readFile(join(native,"launch"));
assert.ok(launch.length<=1048576&&launch.subarray(0,4).equals(Buffer.from([127,69,76,70])));
await copyFile(join(native,"launch"),join(directory,"release/launch"));names.push("release/launch");
const sums=await Promise.all(names.map(async name=>`${hash(await readFile(join(directory,name)))}  ${name}`));
await writeFile(join(directory,"SHA256SUMS"),sums.join("\n")+"\n");
console.log(JSON.stringify({directory,host_verified:false,files:names.length+1}));
