import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {rootRuntimeJson} from "../../src/runtime/private-file.js";

const original="/var/lib/ingenium/registry-rehearsal-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb";
export const rehearsalDocker=async(args:string[])=>(await promisify(execFile)("/opt/ingenium/judge-executor/docker",["--host","unix:///run/docker.sock","--config","/opt/ingenium/judge-executor/docker-client",...args],{timeout:15000,maxBuffer:131072,env:{PATH:"/usr/bin:/bin",LANG:"C.UTF-8"}})).stdout.trim();
export async function inspectRehearsalDatabase(){
  const saved=await rootRuntimeJson(`${original}/container-id`,4096) as {id:string};assert.match(saved.id,/^[0-9a-f]{64}$/);
  const row=JSON.parse(await rehearsalDocker(["inspect","--format","{{json .}}",saved.id]));
  assert.equal(row.Id,saved.id);assert.equal(row.Name,"/ingenium-registry-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb");
  assert.equal(row.Config.Labels["ingenium.registry-rehearsal"],"a6bf44ef-1c3a-4ac5-a26d-adda369c87bb");
  assert.equal(row.Config.Image,"docker.io/library/postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826");
  assert.equal(row.HostConfig.RestartPolicy.Name,"no");assert.equal(row.HostConfig.Privileged,false);assert.equal(row.HostConfig.ReadonlyRootfs,true);assert.equal(row.Config.User,"999:999");
  const mounts=row.Mounts.filter((m:{Destination:string})=>m.Destination==="/var/lib/postgresql/data");assert.equal(mounts.length,1);
  assert.equal(mounts[0].Type,"volume");assert.equal(mounts[0].Name,"ingenium-registry-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb-data");
  return {id:saved.id,row};
}
