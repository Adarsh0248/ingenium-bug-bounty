import assert from "node:assert/strict";
import { createHash,randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat,mkdir,open,readFile,statfs } from "node:fs/promises";
import { hostname,release as kernelRelease } from "node:os";
import { openVerifiedHost } from "../../../apps/api/src/judge/host-verification.js";
import { reviewedHostRelease } from "../../../apps/api/src/judge/host-installation.js";
import { protectedDirectory } from "../../../apps/api/src/judge/isolate-context.js";

let stage="caller",directory="";
try{
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");
  const root="/opt/ingenium/judge-executor",image="sha256:2f1fedd67c258af86a0cad247c2e15a620c4523853f9ded5168e9a7640a72a88";
  await protectedDirectory(root);
  stage="configuration-root";
  const configurationRoot="/var/lib/ingenium/judge-executor/capsules";await protectedDirectory(configurationRoot);
  const configurationInfo=await lstat(configurationRoot);
  assert.equal(configurationInfo.mode&0o7777,0o700);assert.equal(configurationInfo.uid,0);assert.equal(configurationInfo.gid,0);
  assert.ok([0xef53,0x58465342].includes((await statfs(configurationRoot)).type));
  const executables=new Set(["docker","dockerd","host-observe","launch","node","peer-exec","python"]);
  const names=[...executables,"app/judge/capsule-cli.js","app/judge/host-cli.js","app/package.json","docker-client/config.json","image-tree.py",
    "security/apparmor","security/apparmor.bin","security/isolate","security/seccomp.json","security/LICENSE.moby","security/SOURCE.md"].sort();
  const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex"),files=[];
  stage="manifest";
  for(const path of names){
    const file=await open(`${root}/${path}`,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    try{
      const info=await file.stat(),mode=executables.has(path)?0o555:0o444;
      assert.ok(info.isFile()&&info.uid===0&&info.gid===0&&info.nlink===1&&(info.mode&0o7777)===mode&&info.size>0&&info.size<=268435456);
      files.push({path,size:info.size,mode,sha256:hash(await file.readFile())});
    }finally{await file.close();}
  }
  const manifest={version:3,image_id:image,daemon_sha256:"97bbc5b0e94bdde2d619ecfb5bffd02ba5cbab341ba9b6ab60340a762be77fe1",
    image_config_sha256:"f05d688d32f4a4b005960a24e57ac41fb853d290b195086905d112aa59b0231f",files};
  const release={imageId:image,digest:hash(Buffer.from(JSON.stringify(manifest)))};reviewedHostRelease(manifest,release);
  const settings={hostEpochId:randomUUID(),bootId:(await readFile("/proc/sys/kernel/random/boot_id","ascii")).trimEnd(),kernelRelease:kernelRelease(),
    observerSha256:files.find(file=>file.path==="host-observe")!.sha256,imageTreeSha256:"a2712c9fd25d92fabee4789a1397d72354baaa0e0b89ad490a67073375a02101"};
  directory=`/var/lib/ingenium/host-installation-${settings.hostEpochId}`;await mkdir(directory,{mode:0o700});
  const save=async(name:string,value:unknown)=>{
    const file=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
    try{await file.writeFile(JSON.stringify(value)+"\n");await file.sync();}finally{await file.close();}
    const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await folder.sync();}finally{await folder.close();}
  };
  await save("intent",{scope:"HOST_PREPARATION_REHEARSAL",database_registered:false,event_admission:false,settings,release,manifest});
  stage="open-full-installation";const host=await openVerifiedHost(settings,release,manifest,AbortSignal.timeout(10000));
  try{
    stage="prepare";const start=performance.now(),proof=await host.prepare(AbortSignal.timeout(80000)),preparation_ms=Math.round(performance.now()-start);
    const cache=`/var/lib/ingenium/judge-executor/host-verification/${settings.hostEpochId}`;
    const before=hash(await readFile(`${cache}/verified`));
    stage="fresh-ready";const fresh=performance.now();assert.ok(proof.equals(await host.assertReady(AbortSignal.timeout(5000))));const fresh_ready_ms=Math.round(performance.now()-fresh);
    stage="lost-acknowledgement";assert.ok(proof.equals(await host.prepare(AbortSignal.timeout(10000))));assert.equal(hash(await readFile(`${cache}/verified`)),before);
    await save("completed",{proof_digest:proof.toString("hex"),preparation_ms,fresh_ready_ms});
    console.log("PASS: full immutable installation and actual boot/image/policy/storage preparation; fresh readiness and original cache recovery match");
    console.log(JSON.stringify({scope:"HOST_PREPARATION_REHEARSAL",host_verified:false,database_registered:false,event_admission:false,participant_execution_tested:false,
      host_epoch_id:settings.hostEpochId,release_sha256:release.digest,proof_digest:proof.toString("hex"),preparation_ms,fresh_ready_ms,evidence:directory}));
  }finally{await host.close();}
}catch{
  console.error(`FAIL: full host preparation ${stage}; preserve ${directory||"the installation"}, its cache and inspection container.`);process.exitCode=1;
}
