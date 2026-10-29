import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { createContentService } from "../../src/content/service.js";
import type { ContentCommand } from "../../src/content/service.js";
import { createValidationService } from "../../src/content/validation-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { LANGUAGES, newAccessCode, sessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { buildApp } from "../../src/app.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { validationRunChecks } from "./validation-run.checks.js";

export async function validationChecks(t:TestContext,ownerConnection:string,apiConnection:string) {
  const name=`ingenium_validation_${randomUUID().replaceAll("-","")}`,bootstrap=new Client({connectionString:ownerConnection});
  await bootstrap.connect();try {await bootstrap.query(`CREATE DATABASE "${name}"`);} finally {await bootstrap.end();}
  const ownerUrl=new URL(ownerConnection),apiUrl=new URL(apiConnection);ownerUrl.pathname=apiUrl.pathname=`/${name}`;
  await migrateDatabase(ownerUrl.toString());
  const owner=new Pool({connectionString:ownerUrl.toString(),max:2}),api=new Pool({connectionString:apiUrl.toString(),max:4});
  let healthy=true;
  const clock={assertHealthy(){if(!healthy)throw new AccessError("CLOCK_UNTRUSTED");},async verify(){},fault(){}};
  const delivery=sessionDelivery("synthetic-validation",randomBytes(32)),content=createContentService(api,clock,delivery),service=createValidationService(api,clock,delivery);
  const staff=createStaffService(api,clock,delivery),entry=createEntryService(api,clock,delivery);
  const denied=(code:string)=>(e:unknown)=>e instanceof AccessError && e.code===code;
  const metadata={title:"Synthetic validation fixture",statement:"Synthetic private statement",difficulty:50,checker_mode:"EXACT_TEXT"};
  const exact="\ufeffsynthetic private source\0\r\n",io="\ufeffprivate expected bytes\0\r\n";
  async function person(role="OWNER") {
    const id=randomUUID(),code=newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic validator',$2)",[id,role]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),id,code.verifier]);
    const flow=await entry.begin(code.code,{ip:"127.0.0.1",browserId:randomUUID()});if(flow.audience!=="STAFF")throw new Error("Synthetic staff routing failed");
    return {id,code:code.code,...await staff.activate(flow.proofCookie,randomUUID())};
  }
  type Person=Awaited<ReturnType<typeof person>>;
  async function command(actor:Person,action:ContentCommand["action"],targetId:string|null,payload:unknown) {
    const table=action==="CREATE"?"catalogue_control":"bug_versions",column=action==="CREATE"?"revision":"content_revision";
    const expectedRevision=(await owner.query(`SELECT ${column} AS revision FROM ${table} WHERE id=$1`,[targetId??1])).rows[0].revision;
    return content.command(actor.sessionCookie,{action,targetId,payload,expectedRevision,requestKey:randomUUID(),reason:"Synthetic validation setup"});
  }
  async function intent(versionId:string) {return {versionId,expectedRevision:(await owner.query("SELECT content_revision FROM bug_versions WHERE id=$1",[versionId])).rows[0].content_revision as string,requestKey:randomUUID(),reason:"Synthetic preparation"};}
  let version="",snapshot="";
  let maintainer:Person,original:Awaited<ReturnType<typeof intent>>,originalReceipt:Awaited<ReturnType<typeof service.prepare>>;
  try {
    await t.test("incomplete drafts get durable field-only preparation receipts, with role checks and actor-owned recovery",async()=>{
      const actor=await person(),organiser=await person("ORGANISER"),d=await command(actor,"CREATE",null,{round_type:1,...metadata}),input=await intent(d.version_id!);
      assert.equal((await service.prepare(organiser.sessionCookie,input)).reason,"CONTENT_INCOMPLETE");
      await assert.rejects(service.prepare(actor.sessionCookie,{...input,versionId:"invalid"}),denied("INVALID_CONTEXT"));
      const before=(await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[actor.session.session_id])).rows;
      const result=await service.prepare(actor.sessionCookie,input);assert.equal(result.reason,"CONTENT_INCOMPLETE");assert.equal(result.snapshot_id,null);
      assert.ok(result.issues.some(i=>i.code==="LANGUAGE_REQUIRED"));assert.ok(result.issues.some(i=>i.code==="HINT_REQUIRED"));
      assert.deepEqual(await service.prepare(actor.sessionCookie,input),result);
      assert.deepEqual((await service.outcome(actor.sessionCookie,input.versionId,input.requestKey)).outcome,result);
      assert.equal((await service.outcome((await person()).sessionCookie,input.versionId,input.requestKey)).status,"NOT_OBSERVED");
      await assert.rejects(service.prepare(actor.sessionCookie,{...input,reason:"Changed intent"}),denied("INTENT_CONFLICT"));
      assert.deepEqual((await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[actor.session.session_id])).rows,before);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_snapshots")).rows[0].n,0);
    });
    await t.test("complete five-language preparation freezes exact byte content and fifteen immutable check templates once, without executing code",async()=>{
      const actors=[await person(),await person(),await person()];let index=0;
      const edit=(action:ContentCommand["action"],id:string|null,payload:unknown)=>command(actors[Math.floor(index++/7)]!,action,id,payload);
      for(const language of LANGUAGES) await owner.query(`INSERT INTO runtime_manifests(key,language,manifest,digest,created_at) SELECT $1,$2,$3::jsonb,
        sha256(convert_to($3::jsonb::text,'UTF8')),date_trunc('milliseconds',clock_timestamp())`,[`synthetic-${language}`,language,JSON.stringify({schema_version:1,synthetic_test_only:true})]);
      version=(await edit("CREATE",null,{round_type:1,...metadata})).version_id!;
      for(const language of LANGUAGES) await edit("VARIANT",version,{language,starter_code:exact,reference_solution_code:exact,defect_description:"Synthetic private defect",
        runtime_key:`synthetic-${language}`,cpu_time_limit_ms:1000,wall_time_limit_ms:5000,memory_limit_kb:262144});
      const sample=(await edit("CASE",version,{case_id:null,position:1,visibility:"SAMPLE",input_data:"",expected_output:io})).case_id!;
      const hidden=(await edit("CASE",version,{case_id:null,position:2,visibility:"HIDDEN",input_data:"\0\r\n",expected_output:io})).case_id!;
      for(const level of [1,2,3])await edit("HINT",version,{level,content:`Synthetic private hint ${level}`});
      for(const language of LANGUAGES)await edit("WITNESSES",version,{language,witnesses:[{check_type:"TEST_CASE",test_case_id:hidden,expected_failure:"WRONG_OUTPUT"}]});
      maintainer=await person("SUPER_ADMIN");original=await intent(version);
      const replies=await Promise.all([service.prepare(maintainer.sessionCookie,original),service.prepare(maintainer.sessionCookie,original)]);
      originalReceipt=replies[0]!;assert.deepEqual(replies[0],replies[1]);assert.equal(originalReceipt.outcome,"APPLIED");snapshot=originalReceipt.snapshot_id!;
      assert.equal(originalReceipt.can_execute,false);assert.equal(originalReceipt.can_publish,false);
      assert.deepEqual(await createValidationService(api,clock,delivery).prepare(maintainer.sessionCookie,original),originalReceipt);
      const frozen=(await owner.query("SELECT * FROM validation_snapshots WHERE id=$1",[snapshot])).rows[0];
      assert.equal(frozen.content_revision,original.expectedRevision);assert.equal(frozen.fingerprint.length,32);
      assert.equal((await owner.query("SELECT manifest_text::jsonb=validation_configuration_manifest(id,true) AS exact FROM validation_snapshots WHERE id=$1",[snapshot])).rows[0].exact,true);
      const variants=(await owner.query("SELECT starter_code,reference_code FROM validation_snapshot_variants WHERE snapshot_id=$1",[snapshot])).rows;
      assert.equal(variants.length,5);for(const row of variants){assert.deepEqual(row.starter_code,Buffer.from(exact));assert.deepEqual(row.reference_code,Buffer.from(exact));}
      const cases=(await owner.query("SELECT case_id,input_data,expected_output FROM validation_snapshot_cases WHERE snapshot_id=$1 ORDER BY position",[snapshot])).rows;
      assert.equal(cases[0].case_id,sample);assert.deepEqual(cases[0].input_data,Buffer.alloc(0));assert.deepEqual(cases[1].expected_output,Buffer.from(io));
      const checks=await service.describe(maintainer.sessionCookie,snapshot,"CHECKS");assert.equal(checks.planned_checks,15);assert.equal(checks.checks.length,15);assert.equal(checks.validation_run_id,null);
      assert.equal(checks.checks.filter(c=>c.source_role==="REFERENCE").length,10);assert.equal(checks.checks.filter(c=>c.source_role==="STARTER").length,5);
      assert.doesNotMatch(JSON.stringify(checks),/synthetic private source|private expected bytes|Synthetic private hint|Synthetic private defect/);
      assert.equal((await content.describe(maintainer.sessionCookie,version)).publication_status,"DRAFT");
    });
    await t.test("same-revision preparation with a new key shares the snapshot and does not renew staff idle time or duplicate checks",async()=>{
      const actor=await person(),before=(await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[actor.session.session_id])).rows;
      const result=await service.prepare(actor.sessionCookie,await intent(version));assert.equal(result.outcome,"UNCHANGED");assert.equal(result.snapshot_id,snapshot);
      await service.describe(actor.sessionCookie,snapshot,"SUMMARY");
      assert.deepEqual((await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[actor.session.session_id])).rows,before);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_snapshots WHERE version_id=$1",[version])).rows[0].n,1);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_snapshot_checks WHERE snapshot_id=$1",[snapshot])).rows[0].n,15);
    });
    await t.test("later draft edits cannot rewrite old snapshot bytes or re-use its fingerprint; stale requests are rejected without recapture",async()=>{
      const actor=await person(),old=(await owner.query("SELECT manifest_text,content_bytes FROM validation_snapshots WHERE id=$1",[snapshot])).rows;
      await command(actor,"HINT",version,{level:1,content:"Synthetic changed hint"});
      assert.deepEqual((await owner.query("SELECT manifest_text,content_bytes FROM validation_snapshots WHERE id=$1",[snapshot])).rows,old);
      assert.equal((await owner.query("SELECT content FROM validation_snapshot_hints WHERE snapshot_id=$1 AND level=1",[snapshot])).rows[0].content,"Synthetic private hint 1");
      const stale=await service.prepare(actor.sessionCookie,{...original,requestKey:randomUUID()});assert.equal(stale.reason,"STALE_VERSION");
      assert.deepEqual(await service.prepare(maintainer.sessionCookie,original),originalReceipt);
      const result=await service.prepare(actor.sessionCookie,await intent(version));assert.equal(result.outcome,"APPLIED");assert.notEqual(result.snapshot_id,snapshot);
      const fingerprints=(await owner.query("SELECT encode(fingerprint,'hex') AS fingerprint FROM validation_snapshots WHERE version_id=$1",[version])).rows;
      assert.notEqual(fingerprints[0].fingerprint,fingerprints[1].fingerprint);
      assert.equal((await owner.query(`SELECT committed_bytes=(SELECT sum(content_bytes) FROM (SELECT content_bytes FROM bug_versions UNION ALL SELECT content_bytes FROM validation_snapshots) t) AS exact FROM catalogue_control`)).rows[0].exact,true);
    });
    await t.test("an edit between capture and commit produces a stale rejection, never a snapshot of mixed revisions",async()=>{
      const actor=await person(),editor=await person(),input=await intent(version);let changed=false;
      const racing=new Proxy(api,{get(target,key){
        if(key!=="connect")return Reflect.get(target,key,target);
        return async()=>{
          const client=await api.connect();let captured=false;
          return new Proxy(client,{get(clientTarget,property){
            if(property!=="query")return Reflect.get(clientTarget,property,clientTarget);
            return async(...args:unknown[])=>{
              const text=typeof args[0]==="string"?args[0]:"";
              const result=await (client.query as (...values:unknown[])=>Promise<unknown>)(...args);
              if(text.includes("INSERT INTO validation_snapshot_audits") && text.includes("CAPTURE"))captured=true;
              if(text==="COMMIT" && captured && !changed){changed=true;await command(editor,"HINT",version,{level:2,content:"Synthetic concurrent edit"});}
              return result;
            };
          }});
        };
      }});
      const before=(await owner.query("SELECT count(*)::integer AS n FROM validation_snapshots WHERE version_id=$1",[version])).rows[0].n;
      const result=await createValidationService(racing,clock,delivery).prepare(actor.sessionCookie,input);
      assert.equal(changed,true);assert.equal(result.reason,"STALE_VERSION");
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_snapshots WHERE version_id=$1",[version])).rows[0].n,before);
    });
    await t.test("frozen rows, receipts and audits are immutable and restricted API credentials cannot bypass the snapshot writer",async()=>{
      for(const table of ["validation_snapshots","validation_snapshot_variants","validation_snapshot_cases","validation_snapshot_hints","validation_snapshot_witnesses","validation_snapshot_checks"]){
        await assert.rejects(owner.query(`DELETE FROM ${table}`),{code:"P0001"});
        await assert.rejects(api.query(`DELETE FROM ${table}`),{code:"42501"});
      }
      await assert.rejects(owner.query("UPDATE validation_snapshots SET title='changed'"),{code:"P0001"});
      await assert.rejects(owner.query("UPDATE validation_preparation_outcomes SET reason='changed'"),{code:"P0001"});
      await assert.rejects(owner.query("DELETE FROM validation_snapshot_audits"),{code:"P0001"});
      await assert.rejects(api.query("SELECT freeze_validation_snapshot($1,'{}')",[originalReceipt.outcome_id]),{code:"P0001"});
      await assert.rejects(api.query("INSERT INTO validation_snapshot_cases SELECT * FROM validation_snapshot_cases"),{code:"42501"});
      await assert.rejects(api.query("UPDATE catalogue_control SET committed_bytes=0"),{code:"42501"});
    });

    const settings={mode:"production" as const,origin:"https://ingenium.test",cookieKey:randomBytes(32),csrfKey:randomBytes(32)},policy=browserPolicy(settings);
    const app=buildApp({database:{async check(){},async close(){}},entry:{pool:api,clock,delivery,browser:settings}});await app.ready();
    async function browser(actor:Person) {
      const cookies=new Map<string,string>();
      async function send(url:string,body?:unknown,token?:string){
        const response=await app.inject({method:body===undefined?"GET":"POST",url,headers:{origin:settings.origin,cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join(";"),
          ...(body===undefined?{}:{"content-type":"application/json"}),...(token?{"x-csrf-token":token}:{})},...(body===undefined?{}:{payload:JSON.stringify(body)})});
        const lines=response.headers["set-cookie"];for(const line of typeof lines==="string"?[lines]:lines??[]){const pair=line.split(";")[0]!,i=pair.indexOf("=");cookies.set(pair.slice(0,i),pair.slice(i+1));}return response;
      }
      await send("/api/v1/bootstrap?audience=ANONYMOUS");cookies.set(policy.names.staff,actor.sessionCookie);
      const response=await send("/api/v1/bootstrap?audience=STAFF");assert.equal(response.statusCode,200);return {send,token:response.json().data.csrf_token as string};
    }
    try {
      await t.test("preparation HTTP requires current owner authority, CSRF and exact fields; private summaries expose no raw bytes",async()=>{
        const actor=await person(),client=await browser(actor),input=await intent(version),url=`/api/v1/staff/content/versions/${version}/prepare-validation`;
        const body={request_key:input.requestKey,expected_revision:input.expectedRevision,reason:input.reason};
        assert.equal((await client.send(url,body)).statusCode,403);
        assert.equal((await client.send(url,{...body,passed:true},client.token)).statusCode,400);
        const response=await client.send(url,body,client.token);assert.equal(response.statusCode,200,response.body);assert.equal(response.headers["cache-control"],"no-store");
        const data=response.json().data;assert.equal(data.can_execute,false);assert.equal(data.outcome,"APPLIED");
        const summary=await client.send(`/api/v1/staff/content/validation-snapshots/${data.snapshot_id}/checks`);assert.equal(summary.statusCode,200,summary.body);
        assert.equal(summary.json().data.checks.length,15);assert.equal(summary.json().data.validation_run_id,null);
        assert.doesNotMatch(summary.body,/private source|private expected|private hint|private defect|manifest_text|credential/);
        const recovery=await client.send(`/api/v1/staff/outcomes/validation-preparation/${version}/${body.request_key}`);assert.deepEqual(recovery.json().data.outcome,data);
        const stale=await client.send(url,{...body,request_key:randomUUID(),expected_revision:"0"},client.token);assert.equal(stale.statusCode,409);assert.equal(stale.json().data.reason,"STALE_VERSION");
        const organiser=await browser(await person("ORGANISER"));assert.equal((await organiser.send(url,body,organiser.token)).statusCode,200);
        assert.equal((await organiser.send(`/api/v1/staff/content/validation-snapshots/${data.snapshot_id}/summary`)).statusCode,200);
      });
    } finally {await app.close();}
    const runnable=(await owner.query("SELECT id FROM validation_snapshots WHERE version_id=$1 ORDER BY content_revision DESC LIMIT 1",[version])).rows[0].id;
    await validationRunChecks(t,owner,api,clock,delivery,person,runnable,io);
    await t.test("snapshot capacity refusal rolls back the source and accounting; retired draft cases stay frozen but cannot validate a new incomplete revision",async()=>{
      const current=(await owner.query("SELECT * FROM validation_snapshots WHERE version_id=$1 ORDER BY content_revision DESC LIMIT 1",[version])).rows[0];
      const totals=(await owner.query("SELECT committed_bytes,revision FROM catalogue_control")).rows;
      const sources=(await owner.query("SELECT count(*)::integer AS n FROM validation_preparation_outcomes")).rows[0].n;
      const client=await owner.connect();
      try {
        await client.query("BEGIN");await client.query("SELECT * FROM lock_arena_control(true)");await client.query("SELECT * FROM lock_catalogue()");
        await client.query("UPDATE catalogue_control SET committed_bytes=3221225471 WHERE id=1");
        const source=randomUUID();
        await client.query(`INSERT INTO validation_preparation_outcomes SELECT $1,version_id,actor_id,session_id,credential_id,credential_version,$2,fingerprint,
          expected_revision,reason,outcome,denial_reason,issues,date_trunc('milliseconds',clock_timestamp()),$3 FROM validation_preparation_outcomes WHERE id=$4`,
          [source,randomUUID(),randomUUID(),current.source_id]);
        await assert.rejects(client.query("SELECT freeze_validation_snapshot($1,$2)",[source,current.manifest_text]),{code:"54000"});
      } finally {await client.query("ROLLBACK");client.release();}
      assert.deepEqual((await owner.query("SELECT committed_bytes,revision FROM catalogue_control")).rows,totals);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_preparation_outcomes")).rows[0].n,sources);
      const actor=await person(),sample=(await owner.query("SELECT id FROM test_cases WHERE version_id=$1 AND visibility='SAMPLE' AND removed_at IS NULL",[version])).rows[0].id;
      await command(actor,"DELETE_CASE",version,{case_id:sample});
      const result=await service.prepare(actor.sessionCookie,await intent(version));assert.equal(result.reason,"CONTENT_INCOMPLETE");assert.ok(result.issues.some(i=>i.code==="SAMPLE_REQUIRED"));
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_snapshot_cases WHERE snapshot_id=$1 AND case_id=$2",[snapshot,sample])).rows[0].n,1);
    });
    await t.test("running, paused, closing and cancelling arenas reject preparation; clock and revocation faults also block private access",async()=>{
      const actor=await person(),arena=randomUUID(),round=randomUUID();
      await owner.query(`WITH created AS (INSERT INTO arena_instances(id,status,created_by,created_at) VALUES($1,'IN_PROGRESS',$2,date_trunc('milliseconds',clock_timestamp())) RETURNING id)
        UPDATE arena_control SET current_instance_id=(SELECT id FROM created),revision=revision+1 WHERE id=1`,[arena,actor.id]);
      await owner.query("INSERT INTO rounds(id,arena_instance_id,kind,state,duration_ms,started_at,closes_at) VALUES($1,$2,1,'RUNNING',300000,date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',clock_timestamp())+interval '5 minutes')",[round,arena]);
      for(const state of ["RUNNING","PAUSED","CLOSING","CANCELLING"]){
        await owner.query("UPDATE rounds SET state=$2 WHERE id=$1",[round,state]);
        const result=await service.prepare(actor.sessionCookie,await intent(version));assert.equal(result.reason,"ARENA_ACTIVE",state);
      }
      healthy=false;try{await assert.rejects(service.describe(actor.sessionCookie,snapshot,"SUMMARY"),denied("CLOCK_UNTRUSTED"));}finally{healthy=true;}
      await owner.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE staff_id=$1",[actor.id]);
      await assert.rejects(service.describe(actor.sessionCookie,snapshot,"SUMMARY"),denied("INVALID_SESSION"));
    });
  } finally {await api.end();await owner.end();}
}
