import type { Pool } from "pg";
import { boundedStaffText } from "./staff-management.js";
import { commandFingerprint, sameVerifier, uuid } from "./credentials.js";

export function maintenanceDatabaseUrl(environment:NodeJS.ProcessEnv) {
  const value=environment.STAFF_MAINTENANCE_DATABASE_URL;
  if(!value)throw new Error("Separate maintenance credentials required.");
  let url:URL;try{url=new URL(value);}catch{throw new Error("Invalid maintenance configuration.");}
  if(!["postgres:","postgresql:"].includes(url.protocol) || !["localhost","127.0.0.1","[::1]"].includes(url.hostname)
    || !url.username || url.username==="ingenium_api" || url.pathname.length<2 || url.search || url.hash)throw new Error("Local schema-owner maintenance configuration required.");
  return value;
}
export interface BootstrapInput {requestKey:string;staffId:string;credentialId:string;displayName:string;operator:string;osUser:string;reason:string;verifier:Buffer;}
export async function firstSuperAdmin(pool:Pool,input:BootstrapInput) {
  for(const id of [input.requestKey,input.staffId,input.credentialId])uuid(id);
  boundedStaffText(input.displayName,120);boundedStaffText(input.operator,120);boundedStaffText(input.osUser,120);boundedStaffText(input.reason,1024);
  if(!Buffer.isBuffer(input.verifier)||input.verifier.length!==32)throw new Error("Fresh credential verifier required.");
  const client=await pool.connect();
  const ignoreDisconnectedClient=()=>{};client.on("error",ignoreDisconnectedClient);let destroy=false;
  const fingerprint=commandFingerprint([input.operator,input.osUser,input.reason,input.displayName]);
  try{
    await client.query("BEGIN; SET LOCAL lock_timeout='750ms'; SET LOCAL statement_timeout='2s'; SET LOCAL transaction_timeout='3s'");
    const role=(await client.query("SELECT current_user<>'ingenium_api' AND has_schema_privilege(current_user,'public','CREATE') AS allowed")).rows[0];
    if(!role?.allowed)throw new Error("Schema-owner maintenance access required.");
    if((await client.query("SELECT id FROM security_control WHERE id=1 FOR UPDATE")).rowCount!==1)throw new Error("Security anchor missing.");
    const prior=(await client.query("SELECT id,staff_id,credential_id,fingerprint FROM operator_bootstraps WHERE request_key=$1",[input.requestKey])).rows[0];
    if(prior) {
      if(!sameVerifier(prior.fingerprint,fingerprint))throw new Error("Bootstrap intent differs; no changes made.");
      await client.query("COMMIT");return{status:"ALREADY_RECORDED" as const,outcome_id:prior.id,staff_id:prior.staff_id,credential_id:prior.credential_id};
    }
    if((await client.query("SELECT 1 FROM operator_bootstraps UNION ALL SELECT 1 FROM staff_identities WHERE role='SUPER_ADMIN' LIMIT 1")).rowCount)throw new Error("First Super Admin already provisioned; use operator recovery, never bootstrap again.");
    if(!(await client.query("SELECT id FROM clock_health WHERE id=1 AND NOT running")).rowCount
      ||(await client.query("SELECT id FROM arena_instances WHERE status IN ('SETUP','IN_PROGRESS') LIMIT 1")).rowCount)throw new Error("Stop protected services and leave no reserved arena before first setup.");
    if((await client.query("SELECT count(*)::integer AS n FROM staff_identities WHERE disabled_at IS NULL")).rows[0].n>=50)throw new Error("Staff capacity unavailable.");
    const now=(await client.query("SELECT date_trunc('milliseconds',clock_timestamp()) AS now")).rows[0].now;
    await client.query("INSERT INTO staff_identities(id,display_name,role,revision) VALUES($1,$2,'SUPER_ADMIN',1)",[input.staffId,input.displayName]);
    await client.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,$4)",[input.credentialId,input.staffId,input.verifier,now]);
    await client.query("INSERT INTO operator_bootstraps(id,control_id,request_key,operator,os_user,reason,recorded_at,staff_id,credential_id,fingerprint) VALUES($1,1,$1,$2,$3,$4,$5,$6,$7,$8)",
      [input.requestKey,input.operator,input.osUser,input.reason,now,input.staffId,input.credentialId,fingerprint]);
    await client.query("INSERT INTO staff_credential_issues(credential_id,bootstrap_id) VALUES($1,$2)",[input.credentialId,input.requestKey]);
    await client.query("UPDATE security_control SET revision=revision+1 WHERE id=1");
    await client.query("COMMIT");
    return{status:"CREATED" as const,outcome_id:input.requestKey,staff_id:input.staffId,credential_id:input.credentialId};
  }catch(error){try{await client.query("ROLLBACK");}catch{destroy=true;}throw error;}finally{client.removeListener("error",ignoreDisconnectedClient);client.release(destroy);}
}
