import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { LANGUAGES } from "../../src/access/credentials.js";
import type { RegistrySettings } from "../../src/judge/registry.js";

// Test database bootstrap only; this never supplies readiness or consumes an execution permit.
export async function prepareRehearsalDatabase(owner:Pool,url:URL,settings:RegistrySettings,
  sql:(name:string)=>Promise<string>,save:(name:string,value:unknown)=>Promise<void>){
  for(const file of ["provider-structural.sql","001_registry.sql","002_queue.sql","003_execution_lookup.sql","004_launch_gate.sql","005_participant_payloads.sql","006_supervisor_service.sql","007_eight_slots.sql"]){
    await save(`before-${file}`,{file});await owner.query(await sql(file));await save(`after-${file}`,{file});
  }
  const accounts:URL[]=[];
  const suffix=settings.hostEpochId.replaceAll("-","").slice(0,12);
  for(const [prefix,role] of [["ingenium_rehearsal_ingress","ingenium_judge_gateway"],["ingenium_rehearsal_runner","ingenium_judge_supervisor"]] as const){
    const name=`${prefix}_${suffix}`;
    const secret=randomBytes(32).toString("hex");await save(`credential-${name}`,{secret});
    const statement=(await owner.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L IN ROLE %I',$1::text,$2::text,$3::text)",[name,secret,role])).rows[0].format;
    await owner.query(statement);const account=new URL(url);account.username=name;account.password=secret;accounts.push(account);
  }
  await owner.query("INSERT INTO ingenium_judge.control(id,epoch,boot_id,state) VALUES(1,$1,$2,'ACTIVE')",[settings.hostEpochId,settings.bootId]);
  for(const language of LANGUAGES){
    const id=(await owner.query("INSERT INTO public.languages(name,compile_cmd,run_cmd,source_file) VALUES($1,'protected fixture only','protected fixture only','fixture') RETURNING id",[`structural test ${language}`])).rows[0].id;
    const runtime=settings.runtimes.get(language)!;
    await owner.query("INSERT INTO ingenium_judge.runtimes SELECT $1,$2,$3,id,ingenium_judge.language_fingerprint(l) FROM public.languages l WHERE id=$4",[language,runtime.key,runtime.digest,id]);
  }
  return accounts;
}
