import {constants} from "node:fs";
import type {Stats} from "node:fs";
import {lstat,mkdir,open,readdir,rmdir,unlink} from "node:fs/promises";
import type {FileHandle} from "node:fs/promises";
import {sha256} from "../access/credentials.js";
import {judgeJson} from "../content/judge-protocol.js";
import {protectedDirectory} from "./isolate-context.js";
import {reviewedExecutionPlan} from "./execution-plan.js";
import type {ExecutionPlan} from "./execution-plan.js";

const WORK="/run/ingenium/workspace",CONTROL="/run/ingenium/control";
const fail=():never=>{throw new Error("Compiled batch artifact changed or unavailable; retain its reservation.");};
const fd=(f:FileHandle)=>`/proc/self/fd/${f.fd}`;
const name=(s:string)=>s!=='.'&&s!=='..'&&s.isWellFormed()&&Buffer.byteLength(s)<=255&&!/[\/\\\0]/.test(s);
const stamp=(s:Stats)=>[s.dev,s.ino,s.size,s.uid,s.gid,s.mode,s.nlink,s.ctimeMs,s.mtimeMs].join(':');
type Entry={path:string;bytes:number;sha256:string;mode:number};

// The caller must prove every compile/run process stopped before snapshotting or replacing its private /box.
export async function openBatchArtifact(plan:ExecutionPlan,assertStopped:()=>Promise<void>,signal:AbortSignal){
  const safe=reviewedExecutionPlan(plan);
  if(process.platform!=='linux'||process.getuid?.()!==0)return fail();
  await protectedDirectory(CONTROL);signal.throwIfAborted();await assertStopped();
  const work=await open(WORK,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),control=await open(CONTROL,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  let artifact:FileHandle|undefined,closed=false;const entries:Entry[]=[];let total=0,objects=0;
  const original=await work.stat();
  async function checkWork(){
    if(closed)return fail();signal.throwIfAborted();const p=await lstat(WORK),h=await work.stat();
    if(p.isSymbolicLink()||p.dev!==original.dev||p.ino!==original.ino||h.dev!==original.dev||h.ino!==original.ino)return fail();
  }
  async function read(file:FileHandle,limit:number){
    const parts:Buffer[]=[];let length=0;
    while(true){signal.throwIfAborted();const b=Buffer.alloc(Math.min(65536,limit-length+1)),r=await file.read(b,0,b.length,length);
      if(!r.bytesRead)return Buffer.concat(parts,length);length+=r.bytesRead;if(length>limit)return fail();parts.push(b.subarray(0,r.bytesRead));}
  }
  async function snapshot(source:FileHandle,target:FileHandle,path:string,depth=0){
    if(depth>8)return fail();
    for(const n of (await readdir(fd(source))).sort()){
      signal.throwIfAborted();if(!name(n)||++objects>512)return fail();
      const full=path?`${path}/${n}`:n,info=await lstat(`${fd(source)}/${n}`);
      if(info.isSymbolicLink())return fail();
      if(info.isDirectory()){
        if(safe.language!=='java')continue;
        const child=await open(`${fd(source)}/${n}`,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
        try{
          const pinned=await child.stat();if(pinned.dev!==info.dev||pinned.ino!==info.ino)return fail();
          await mkdir(`${fd(target)}/${n}`,{mode:0o700});const out=await open(`${fd(target)}/${n}`,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
          try{await snapshot(child,out,full,depth+1);}finally{await out.close();}
        }finally{await child.close();}
        continue;
      }
      const retain=full===safe.sourceFile||(['c','cpp'].includes(safe.language)&&full==='main')||safe.language==='java'&&full.endsWith('.class');
      if(!retain)continue;
      if(!info.isFile()||info.nlink!==1||info.size>8388608-total||info.mode&0o7022||![0,60000].includes(info.uid)||![0,60000].includes(info.gid))return fail();
      const input=await open(`${fd(source)}/${n}`,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
      try{
        if(stamp(info)!==stamp(await input.stat()))return fail();const bytes=await read(input,8388608-total);
        if(bytes.length!==info.size||stamp(info)!==stamp(await input.stat()))return fail();
        if(full===safe.sourceFile&&!bytes.equals(safe.source))return fail();
        const mode=full==='main'&&['c','cpp'].includes(safe.language)?0o555:0o444;
        const output=await open(`${fd(target)}/${n}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
        try{await output.writeFile(bytes);await output.chmod(0o400);}finally{await output.close();}
        total+=bytes.length;entries.push({path:full,bytes:bytes.length,sha256:sha256(bytes).toString('hex'),mode});
      }finally{await input.close();}
    }
  }
  async function clear(folder:FileHandle,depth=0){
    // The verified workspace has only 4096 inodes; nested participant folders stay within that bound.
    if(depth>4096)return fail();
    for(const n of await readdir(fd(folder))){
      signal.throwIfAborted();if(!name(n))return fail();const path=`${fd(folder)}/${n}`,info=await lstat(path);
      if(info.isDirectory()&&!info.isSymbolicLink()){
        const child=await open(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
        try{const h=await child.stat();if(h.dev!==info.dev||h.ino!==info.ino)return fail();await clear(child,depth+1);}finally{await child.close();}
        const after=await lstat(path);if(after.dev!==info.dev||after.ino!==info.ino||after.isSymbolicLink())return fail();await rmdir(path);
      }else await unlink(path);
    }
  }
  try{
    await checkWork();await mkdir(`${fd(control)}/artifact`,{mode:0o700});artifact=await open(`${fd(control)}/artifact`,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    await snapshot(work,artifact,'');
    if(!entries.some(e=>e.path===safe.sourceFile)||['c','cpp'].includes(safe.language)&&!entries.some(e=>e.path==='main'))return fail();
    entries.sort((a,b)=>a.path.localeCompare(b.path));
    const manifest=Object.fromEntries(entries.map((entry,i)=>[`f${String(i).padStart(3,'0')}`,entry])),digest=sha256(judgeJson(manifest)).toString('hex');
    const pinnedArtifact=artifact;
    return {
      digest,
      async restoreCase(current:AbortSignal){
        current.throwIfAborted();await checkWork();await assertStopped();await work.chown(0,0);await work.chmod(0o700);await clear(work);
        for(const entry of entries){
          current.throwIfAborted();const parts=entry.path.split('/'),last=parts.pop()!;let source=await open(`${fd(pinnedArtifact)}/.`,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),target=await open(`${fd(work)}/.`,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
          try{
            for(const part of parts){
              try{await mkdir(`${fd(target)}/${part}`,{mode:0o755});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
              const a=await open(`${fd(source)}/${part}`,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),b=await open(`${fd(target)}/${part}`,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);await source.close();await target.close();source=a;target=b;
            }
            const input=await open(`${fd(source)}/${last}`,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
            try{
              const info=await input.stat();if(!info.isFile()||info.uid!==0||info.gid!==0||info.nlink!==1||(info.mode&0o7777)!==0o400||info.size!==entry.bytes)return fail();
              const data=await read(input,entry.bytes);if(sha256(data).toString('hex')!==entry.sha256||stamp(info)!==stamp(await input.stat()))return fail();
              const output=await open(`${fd(target)}/${last}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
              try{await output.writeFile(data);await output.chmod(entry.mode);
                if(entry.path==='main'&&['c','cpp'].includes(safe.language))await output.chown(60000,60000);
              }finally{await output.close();}
            }finally{await input.close();}
          }finally{await source.close();await target.close();}
        }
        // The capsule intentionally lacks CAP_FOWNER; finish mode changes while root still owns the directory.
        await work.chmod(0o700);await work.chown(60000,60000);current.throwIfAborted();await checkWork();
      },
      async close(){closed=true;await pinnedArtifact.close();await work.close();await control.close();},
    };
  }catch(error){await artifact?.close();await work.close();await control.close();throw error;}
}
