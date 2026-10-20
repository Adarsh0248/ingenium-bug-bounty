import { constants } from "node:fs";
import { lstat,open,realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename,dirname,isAbsolute,join,relative } from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { newAccessCode,uuid } from "./credentials.js";
import { firstSuperAdmin,maintenanceDatabaseUrl } from "./staff-bootstrap.js";
import { boundedStaffText } from "./staff-management.js";

let pool:Pool|undefined;
try{
  const {values}=parseArgs({options:{name:{type:"string"},operator:{type:"string"},reason:{type:"string"},"request-key":{type:"string"},out:{type:"string"},confirm:{type:"string"},status:{type:"boolean"}}});
  if(process.platform!=="linux" || !process.getuid)throw new Error("Use the restricted Linux maintenance host.");
  const requestKey=uuid(values["request-key"]),connection=maintenanceDatabaseUrl(process.env);
  pool=new Pool({connectionString:connection,max:1,connectionTimeoutMillis:3000,application_name:"ingenium-staff-maintenance"});
  pool.on("error",()=>{console.error("Maintenance connection unavailable; reconcile the original request key before distributing a code.");process.exitCode=1;});
  if(values.status){
    const row=(await pool.query("SELECT id,staff_id,credential_id FROM operator_bootstraps WHERE request_key=$1",[requestKey])).rows[0];
    console.log(JSON.stringify({status:row?"RECORDED":"NOT_OBSERVED",outcome:row??null}));
  }else{
    if(values.confirm!=="FIRST_SUPER_ADMIN" || !values.out || !isAbsolute(values.out))throw new Error("Explicit first-setup confirmation and absolute private handoff path required.");
    const name=boundedStaffText(values.name,120),operator=boundedStaffText(values.operator,120),reason=boundedStaffText(values.reason,1024);
    const parent=await realpath(dirname(values.out)),info=await lstat(parent);
    const repo=fileURLToPath(new URL("../../../../",import.meta.url)),inside=relative(repo,parent);
    if(!info.isDirectory() || ![0,process.getuid()].includes(info.uid) || (info.mode&0o077) || !inside || (!inside.startsWith("..")&&!isAbsolute(inside)))throw new Error("Use an owner-only directory outside the repository.");
    for(let current=parent;;current=dirname(current)){
      const directory=await lstat(current);
      if(!directory.isDirectory() || ![0,process.getuid()].includes(directory.uid) || (directory.mode&0o022))throw new Error("Handoff ancestors must not be writable by other accounts.");
      if(dirname(current)===current)break;
    }
    const code=newAccessCode(),staffId=randomUUID(),credentialId=randomUUID();
    const file=await open(join(parent,basename(values.out)),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    try{await file.writeFile(JSON.stringify({schema_version:1,request_key:requestKey,staff_id:staffId,credential_id:credentialId,access_code:code.code})+"\n");await file.sync();}finally{await file.close();}
    const directory=await open(parent,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    try{await directory.sync();}finally{await directory.close();}
    const result=await firstSuperAdmin(pool,{requestKey,staffId,credentialId,displayName:name,operator,osUser:userInfo().username,reason,verifier:code.verifier});
    if(result.status!=="CREATED")throw new Error("Existing intent found; new candidate handoff is not active. Reconcile original IDs.");
    console.log("First Super Admin recorded. Verify the private handoff IDs before private distribution; no service was started.");
  }
}catch{
  console.error("Staff setup was not acknowledged. Preserve any private candidate handoff file; query the original request key with --status before distributing a code. Never overwrite the file or retry with a new key to guess completion.");
  process.exitCode=1;
}finally{await pool?.end();}
