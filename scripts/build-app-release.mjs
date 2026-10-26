import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {copyFile,lstat,mkdir,readdir,readFile,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";

assert.equal(process.argv.length,2,"The release packager accepts no paths or private settings.");
const repo=fileURLToPath(new URL("../",import.meta.url)),output=join(repo,"build",`app-release-${randomUUID()}`);
const inputs=["package.json","package-lock.json","apps/api/package.json","apps/api/dist","apps/api/drizzle","apps/web/package.json","apps/web/dist","infra/app-host","infra/app-edge","infra/backup/Dockerfile","infra/backup/postgresql.conf","infra/backup/pgbackrest.conf.example","infra/clock-agent/probe.py","infra/clock-agent/entry-runtime.example.json","infra/clock-agent/competition-runtime.example.json","infra/clock-agent/judging-runtime.example.json","infra/maintenance/staff-maintenance-runtime.example.json","infra/postgres/01-api-role.sql","docs","architecture.md","README.md"];
const files=[];let total=0;
async function copy(path){
  assert.ok(!path.split("/").some(part=>part.startsWith(".")||/^(node_modules|test-results|test|build|secrets)$/i.test(part)));
  const source=join(repo,path),info=await lstat(source);assert.equal(info.isSymbolicLink(),false,"Linked release input refused.");
  if(info.isDirectory()){for(const name of (await readdir(source)).sort())await copy(`${path}/${name}`);return;}
  assert.ok(info.isFile()&&info.size<=134217728);total+=info.size;assert.ok(total<=1073741824);
  const bytes=await readFile(source);assert.equal(bytes.length,info.size);const target=join(output,path);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
  const sha256=createHash("sha256").update(bytes).digest("hex");assert.equal(createHash("sha256").update(await readFile(target)).digest("hex"),sha256);
  files.push({path,size:bytes.length,sha256});
}
// Only reviewed source/build paths are copied; no repository, local settings, dependencies or test artifacts.
await mkdir(output,{recursive:true});for(const path of inputs)await copy(path);files.sort((a,b)=>a.path.localeCompare(b.path,"en"));
const manifest=JSON.stringify({protocol:"ingenium-app-release-v1",deployment_ready:false,dependencies_installed:false,files})+"\n";
await writeFile(join(output,"release.json"),manifest,{flag:"wx"});
console.log(JSON.stringify({directory:output,manifest_sha256:createHash("sha256").update(manifest).digest("hex"),files:files.length,bytes:total,deployment_ready:false}));
