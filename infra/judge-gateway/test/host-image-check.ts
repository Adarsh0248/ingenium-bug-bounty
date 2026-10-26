import assert from "node:assert/strict";
import { constants } from "node:fs";
import { mkdir,open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { localDockerCommand } from "../../../apps/api/src/judge/docker-capsule.js";
import { dockerDaemonDigest,dockerImageConfigDigest,verifyDockerReports } from "../../../apps/api/src/judge/docker-host.js";
import { checkedImageTree,hashImageStream } from "../../../apps/api/src/judge/image-stream.js";
import { protectedDirectory } from "../../../apps/api/src/judge/isolate-context.js";

const files:FileHandle[]=[];let stage="caller",directory="";
try{
  assert.equal(process.argv.length,3);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");
  const image=process.argv[2]!;assert.match(image,/^sha256:[0-9a-f]{64}$/);
  const root="/opt/ingenium/judge-executor";await protectedDirectory(root);
  for(const [name,mode] of [["peer-exec",0o555],["docker",0o555],["dockerd",0o555],["python",0o555],["image-tree.py",0o444]] as const){
    const file=await open(`${root}/${name}`,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);files.push(file);
    const stat=await file.stat();assert.ok(stat.isFile()&&stat.uid===0&&stat.gid===0&&stat.nlink===1&&(stat.mode&0o7777)===mode&&stat.size>0&&stat.size<268435456);
  }
  const signal=AbortSignal.timeout(180000),command=localDockerCommand(files[1]!.fd,files[2]!.fd,files[0]!.fd);
  const call=(args:string[])=>command(args,Buffer.alloc(0),signal);
  stage="report-pins";
  const pins={daemon_sha256:dockerDaemonDigest(await call(["info","--format","{{json .}}"])),
    image_config_sha256:dockerImageConfigDigest(await call(["image","inspect","--format","{{json .}}",image]),image)};
  const nonce=randomUUID(),name=`ingenium-image-baseline-${nonce}`;
  directory=`/var/lib/ingenium/image-baseline-${nonce}`;await mkdir(directory,{mode:0o700});
  const save=async(name:string,value:unknown)=>{
    const file=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
    try{await file.writeFile(JSON.stringify(value)+"\n");await file.sync();}finally{await file.close();}
    const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await folder.sync();}finally{await folder.close();}
  };
  await save("intent",{scope:"IMAGE_BASELINE_ONLY",host_verified:false,image_id:image,nonce,name,...pins});
  stage="create-never-start";
  const id=(await call(["create","--pull=never","--name",name,"--label",`ingenium.image-baseline=${nonce}`,"--network","none","--read-only","--cap-drop","ALL",
    "--security-opt","no-new-privileges=true","--restart","no","--memory","33554432","--memory-swap","33554432","--cpus","0.1","--pids-limit","4","--log-driver","none",
    "--entrypoint","/ingenium-image-baseline-never-start",image])).toString("ascii").trim();
  assert.match(id,/^[0-9a-f]{64}$/);await save("container-id",{id});
  const verify=async()=>{
    await verifyDockerReports(command,image,pins,signal);
    const row=JSON.parse((await call(["inspect","--type","container","--format","{{json .}}",id])).toString("utf8"));
    assert.ok(row.Id===id&&row.Name===`/${name}`&&row.Image===image&&row.Config.Image===image&&row.Config.Labels["ingenium.image-baseline"]===nonce
      &&JSON.stringify(row.Config.Entrypoint)==='["/ingenium-image-baseline-never-start"]'&&row.State.Status==="created"&&row.State.Running===false&&row.State.Pid===0
      &&row.State.StartedAt==="0001-01-01T00:00:00Z"&&row.RestartCount===0&&row.HostConfig.ReadonlyRootfs===true&&row.HostConfig.Privileged===false
      &&row.HostConfig.NetworkMode==="none"&&row.HostConfig.RestartPolicy.Name==="no"&&JSON.stringify(row.Mounts)==="[]");
  };
  let first:Readonly<Record<string,unknown>>|undefined;const elapsed:number[]=[];
  for(const phase of ["first","second"]){
    stage=`${phase}-export`;await verify();const start=performance.now();
    const raw=await hashImageStream({file:"/proc/self/fd/3",args:["export",id],inheritedFds:files.slice(0,3).map(file=>file.fd)},
      {file:"/proc/self/fd/3",args:["-I","/proc/self/fd/4"],inheritedFds:files.slice(3).map(file=>file.fd)},signal);
    const value=JSON.parse(raw.toString("utf8")),expected=first?first.tree_sha256:value.tree_sha256;assert.ok(typeof expected==="string");
    const proof=checkedImageTree(raw,expected);
    if(first)assert.deepEqual(proof,first);else first=proof;
    elapsed.push(Math.round(performance.now()-start));await save(phase,proof);await verify();
  }
  stage="original-removal";assert.equal((await call(["rm",id])).toString("ascii").trim(),id);
  assert.equal((await call(["container","ls","--all","--no-trunc","--filter",`id=${id}`,"--format","{{.ID}}"])).length,0);
  await save("completed",{original_id:id,image:first,export_ms:elapsed});
  console.log("PASS: two actual image exports match; original inspection container never started and is absent");
  console.log(JSON.stringify({scope:"IMAGE_BASELINE_ONLY",host_verified:false,image_id:image,image:first,export_ms:elapsed,evidence:directory,...pins}));
}catch{
  console.error(`FAIL: image baseline ${stage}; preserve ${directory||"the installation"} and any inspection container.`);process.exitCode=1;
}finally{for(const file of files)await file.close();}
