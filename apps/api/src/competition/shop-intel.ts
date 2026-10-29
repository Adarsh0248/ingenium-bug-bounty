import type { Pool } from "pg";
import { uuid } from "../access/credentials.js";

export interface ShopIntelBinding {
  snapshot_id: string;
  language: string;
  snapshot_fingerprint: string;
  starter_sha256: string;
  data: { probe: {input:string;output:string}; scanner: {label:string;text:string;from_line:number;to_line:number} };
}
export function shopIntelBindings(value:unknown):ShopIntelBinding[] {
  if(!Array.isArray(value)||value.length<1||value.length>400)throw new Error("Provide 1–400 reviewed snapshot/language intelligence bindings.");
  const seen=new Set<string>();
  for(const item of value){
    if(!item||typeof item!=="object"||Array.isArray(item)||Object.keys(item).sort().join()!=="data,language,snapshot_fingerprint,snapshot_id,starter_sha256")throw new Error("Invalid intelligence binding.");
    uuid(item.snapshot_id);
    if(!['c','cpp','java','python'].includes(item.language)||!/^[a-f0-9]{64}$/.test(item.snapshot_fingerprint)||!/^[a-f0-9]{64}$/.test(item.starter_sha256))throw new Error("Bind each reviewed language to exact snapshot and starter hashes.");
    const key=`${item.snapshot_id}:${item.language}`;
    if(seen.has(key))throw new Error("Duplicate snapshot/language binding.");seen.add(key);
    const data=item.data;
    if(!data||typeof data!=="object"||Array.isArray(data)||Object.keys(data).sort().join()!=="probe,scanner")throw new Error("Expected only probe and scanner intelligence.");
    if(!data.probe||Object.keys(data.probe).sort().join()!=="input,output"||!data.scanner||Object.keys(data.scanner).sort().join()!=="from_line,label,text,to_line")throw new Error("Invalid intelligence fields.");
    for(const [text,max] of [[data.probe.input,65536],[data.probe.output,65536],[data.scanner.label,160],[data.scanner.text,16384]] as const){
      if(typeof text!=="string"||!text.isWellFormed()||text.includes('\0')||Buffer.byteLength(text)>max)throw new Error("Invalid intelligence text.");
    }
    if(!data.scanner.label.trim()||!data.scanner.text.trim()||!Number.isSafeInteger(data.scanner.from_line)||!Number.isSafeInteger(data.scanner.to_line)
      ||data.scanner.from_line<1||data.scanner.to_line-data.scanner.from_line<3||data.scanner.to_line-data.scanner.from_line>79)throw new Error("Scanner needs a broad, bounded starter section.");
  }
  return value as ShopIntelBinding[];
}

// Installation is a reviewed content operation, never an app-role write or a runtime lookup into the answer pack.
export async function installShopIntel(pool:Pool,raw:unknown) {
  const bindings=shopIntelBindings(raw),client=await pool.connect();
  try{
    await client.query("BEGIN; SET LOCAL lock_timeout='750ms'; SET LOCAL statement_timeout='10s'");
    const role=(await client.query("SELECT current_user IN ('ingenium_api','ingenium_competition_worker') restricted,has_schema_privilege(current_user,'public','CREATE') allowed")).rows[0];
    if(role.restricted||!role.allowed)throw new Error("Schema-owner content installation is required.");
    await client.query("SELECT * FROM lock_arena_control(true)");
    let inserted=0;
    for(const row of bindings){
      await client.query("SELECT id FROM validation_snapshots WHERE id=$1 FOR UPDATE",[row.snapshot_id]);
      const prior=(await client.query("SELECT snapshot_fingerprint,starter_sha256,data FROM shop_snapshot_intel WHERE snapshot_id=$1 AND language=$2",[row.snapshot_id,row.language])).rows[0];
      if(prior){
        const exact=(await client.query("SELECT $1::jsonb=$2::jsonb same",[JSON.stringify(prior.data),JSON.stringify(row.data)])).rows[0].same;
        if(prior.snapshot_fingerprint.toString('hex')!==row.snapshot_fingerprint||prior.starter_sha256.toString('hex')!==row.starter_sha256||!exact)throw new Error("An immutable intelligence binding already exists with different content.");
        continue;
      }
      await client.query("INSERT INTO shop_snapshot_intel VALUES($1,$2,decode($3,'hex'),decode($4,'hex'),$5::jsonb)",
        [row.snapshot_id,row.language,row.snapshot_fingerprint,row.starter_sha256,JSON.stringify(row.data)]);inserted++;
    }
    await client.query("COMMIT");return {bindings:bindings.length,inserted};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
