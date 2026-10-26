import assert from "node:assert/strict";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { hostname } from "node:os";
import { createHash } from "node:crypto";
import { localDockerCommand } from "../../../apps/api/src/judge/docker-capsule.js";
import { dockerDaemonDigest,dockerImageConfigDigest,verifyDockerReports } from "../../../apps/api/src/judge/docker-host.js";
import { protectedDirectory } from "../../../apps/api/src/judge/isolate-context.js";

const files:FileHandle[]=[];
let stage="caller";
try{
  assert.equal(process.argv.length,3);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);
  assert.equal(hostname(),"ingenium-judge-verification-01");const image=process.argv[2]!;assert.match(image,/^sha256:[0-9a-f]{64}$/);
  stage="executables";const root="/opt/ingenium/judge-executor",hashes:Record<string,string>={};await protectedDirectory(root);
  for(const name of ["peer-exec","docker","dockerd"]){
    const file=await open(`${root}/${name}`,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);files.push(file);
    const stat=await file.stat();assert.ok(stat.isFile()&&stat.uid===0&&stat.gid===0&&stat.nlink===1&&(stat.mode&0o7777)===0o555&&stat.size>0&&stat.size<268435456);
    const bytes=await file.readFile();assert.ok(bytes.subarray(0,4).equals(Buffer.from([127,69,76,70])));hashes[name]=createHash("sha256").update(bytes).digest("hex");
  }
  const signal=AbortSignal.timeout(20000),command=localDockerCommand(files[1]!.fd,files[2]!.fd,files[0]!.fd);
  stage="peer-info";const daemon=await command(["info","--format","{{json .}}"],Buffer.alloc(0),signal);
  stage="peer-image";const config=await command(["image","inspect","--format","{{json .}}",image],Buffer.alloc(0),signal);
  stage="daemon-report";const daemon_sha256=dockerDaemonDigest(daemon);
  stage="image-report";const pins={daemon_sha256,image_config_sha256:dockerImageConfigDigest(config,image)};
  stage="repeated-reports";await verifyDockerReports(command,image,pins,signal);
  console.log("PASS: actual kernel Docker peer/executable and repeated strict daemon/image reports");
  console.log(JSON.stringify({scope:"HOST_PEER_AND_REPORTS",host_verified:false,image_id:image,executables:hashes,...pins}));
}catch{
  console.error(`FAIL: native Docker peer/report probe (${stage}); preserve files, daemon and output.`);process.exitCode=1;
}finally{for(const file of files)await file.close();}
