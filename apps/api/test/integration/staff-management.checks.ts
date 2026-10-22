import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client,Pool } from "pg";
import { migrateDatabase } from "../../src/db/migrate.js";
import { firstSuperAdmin } from "../../src/access/staff-bootstrap.js";
import { createStaffManagement } from "../../src/access/staff-management.js";
import type { StaffCommand } from "../../src/access/staff-management.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { newAccessCode,sessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";

export async function staffManagementChecks(t:TestContext,ownerConnection:string,apiConnection:string) {
  async function isolated(work:(owner:Pool,api:Pool)=>Promise<void>){
    const name=`ingenium_staff_${randomUUID().replaceAll("-","")}`,bootstrap=new Client({connectionString:ownerConnection});
    await bootstrap.connect();try{await bootstrap.query(`CREATE DATABASE "${name}"`);}finally{await bootstrap.end();}
    const ownerUrl=new URL(ownerConnection),apiUrl=new URL(apiConnection);ownerUrl.pathname=apiUrl.pathname=`/${name}`;
    await migrateDatabase(ownerUrl.toString());
    const owner=new Pool({connectionString:ownerUrl.toString(),max:2}),api=new Pool({connectionString:apiUrl.toString(),max:4});
    try{await work(owner,api);}finally{await api.end();await owner.end();}
  }
  await t.test("operator bootstrap is once-only, source-linked and unavailable to the API role",async()=>isolated(async(owner,api)=>{
    const code=newAccessCode(),input={requestKey:randomUUID(),staffId:randomUUID(),credentialId:randomUUID(),displayName:"Synthetic first admin",operator:"Synthetic operator",osUser:"synthetic-maintainer",reason:"Synthetic first setup",verifier:code.verifier};
    const result=await firstSuperAdmin(owner,input);assert.equal(result.status,"CREATED");
    assert.equal((await firstSuperAdmin(owner,input)).status,"ALREADY_RECORDED");
    await assert.rejects(firstSuperAdmin(owner,{...input,displayName:"Changed bootstrap intent"}),/intent differs/);
    await assert.rejects(firstSuperAdmin(owner,{...input,requestKey:randomUUID(),staffId:randomUUID(),credentialId:randomUUID()}),/already provisioned/);
    await assert.rejects(firstSuperAdmin(api,input),/Schema-owner/);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_credential_issues WHERE bootstrap_id=$1",[input.requestKey])).rows[0].n,1);
    assert.doesNotMatch(JSON.stringify((await owner.query("SELECT * FROM operator_bootstraps")).rows),new RegExp(code.code));
    await assert.rejects(owner.query("UPDATE operator_bootstraps SET reason='overwrite'"),{code:"P0001"});
    await assert.rejects(owner.query("UPDATE staff_identities SET disabled_at=clock_timestamp() WHERE id=$1",[input.staffId]),{code:"P0001"});
    await assert.rejects(owner.query("UPDATE staff_identities SET role='OWNER' WHERE id=$1",[input.staffId]),{code:"P0001"});
    await assert.rejects(owner.query("UPDATE access_credentials SET revoked_at=clock_timestamp() WHERE id=$1",[input.credentialId]),{code:"P0001"});
  }));
  await t.test("first setup refuses an active clock runtime and a reserved arena without issuing a credential",async()=>isolated(async(owner)=>{
    const input={requestKey:randomUUID(),staffId:randomUUID(),credentialId:randomUUID(),displayName:"Synthetic blocked first admin",operator:"Synthetic operator",osUser:"synthetic-maintainer",reason:"Synthetic setup refusal",verifier:newAccessCode().verifier};
    const run=randomUUID(),boot=randomUUID();
    await owner.query("INSERT INTO clock_runs(id,boot_id,started_observed_at) VALUES($1,$2,date_trunc('milliseconds',clock_timestamp()))",[run,boot]);
    await owner.query("UPDATE clock_health SET runtime_id=$1,boot_id=$2,running=true,state='STARTING' WHERE id=1",[run,boot]);
    await assert.rejects(firstSuperAdmin(owner,input),/Stop protected/);
    await owner.query("UPDATE clock_health SET running=false,state='STOPPED' WHERE id=1");
    const creator=randomUUID();await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic configured owner','OWNER')",[creator]);
    await owner.query(`WITH created AS (INSERT INTO arena_instances(id,status,created_by,created_at)
      VALUES($1,'SETUP',$2,date_trunc('milliseconds',clock_timestamp())) RETURNING id)
      UPDATE arena_control SET current_instance_id=created.id,revision=revision+1 FROM created WHERE arena_control.id=1`,[randomUUID(),creator]);
    await assert.rejects(firstSuperAdmin(owner,input),/Stop protected/);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM access_credentials")).rows[0].n,0);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM operator_bootstraps")).rows[0].n,0);
  }));
  await t.test("last Super Admin fencing survives concurrent deactivation and permits an atomic own-credential rotation",async()=>isolated(async(owner)=>{
    const people=[];
    for(let i=0;i<2;i++){
      const id=randomUUID(),credential=randomUUID();people.push({id,credential});
      await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic last-admin race','SUPER_ADMIN')",[id]);
      await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[credential,id,newAccessCode().verifier]);
    }
    const results=await Promise.allSettled(people.map(p=>owner.query("UPDATE staff_identities SET disabled_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1",[p.id])));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.equal(results.filter(r=>r.status==="rejected").length,1);
    const last=(await owner.query("SELECT id FROM staff_identities WHERE disabled_at IS NULL")).rows[0].id;
    const client=await owner.connect();try{
      await client.query("BEGIN");await client.query("SELECT id FROM security_control WHERE id=1 FOR UPDATE");
      await client.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE staff_id=$1 AND revoked_at IS NULL",[last]);
      await client.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,2,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),last,newAccessCode().verifier]);
      await client.query("COMMIT");
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    assert.equal((await owner.query("SELECT version FROM access_credentials WHERE staff_id=$1 AND revoked_at IS NULL",[last])).rows[0].version,"2");
    await assert.rejects(owner.query("DELETE FROM staff_identities WHERE id=$1",[last]),{code:"P0001"});
  }));

  await isolated(async(owner,api)=>{
    let healthy=true;
    const clock={assertHealthy(){if(!healthy)throw new AccessError("CLOCK_UNTRUSTED");},async verify(){},fault(){}};
    const delivery=sessionDelivery("synthetic-management",randomBytes(32)),staff=createStaffService(api,clock,delivery),entry=createEntryService(api,clock,delivery),service=createStaffManagement(api,clock,delivery);
    const denied=(code:string)=>(e:unknown)=>e instanceof AccessError&&e.code===code;
    async function person(role="SUPER_ADMIN"){
      const id=randomUUID(),code=newAccessCode();
      await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic managed staff',$2)",[id,role]);
      await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),id,code.verifier]);
      const flow=await entry.begin(code.code,{ip:"127.0.0.1",browserId:randomUUID()});if(flow.audience!=="STAFF")throw new Error("Synthetic staff failed");
      return{id,code:code.code,...await staff.activate(flow.proofCookie,randomUUID())};
    }
    async function input(code:string,patch:Partial<StaffCommand>={}):Promise<StaffCommand>{
      const revision=(await owner.query("SELECT revision FROM security_control WHERE id=1")).rows[0].revision;
      return{action:"CREATE",targetId:null,requestKey:randomUUID(),expectedRevision:revision,ownCode:code,reason:"Synthetic approved staff command",displayName:"Synthetic created owner",role:"OWNER",enabled:true,...patch};
    }
    await t.test("staff creation issues one code, concurrent retries recover one receipt and changed intents conflict",async()=>{
      const actor=await person(),command=await input(actor.code);
      const replies=await Promise.all([service.command(actor.sessionCookie,command),service.command(actor.sessionCookie,command)]);
      assert.deepEqual(replies[0].outcome,replies[1].outcome);assert.equal(replies.filter(r=>r.issued_code!==null).length,1);
      const target=replies[0].outcome.result_staff_id!;assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_identities WHERE id=$1",[target])).rows[0].n,1);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_credential_issues x JOIN staff_management_outcomes m ON m.id=x.management_id WHERE m.id=$1",[replies[0].outcome.outcome_id])).rows[0].n,1);
      assert.equal((await service.outcome(actor.sessionCookie,"CREATE",null,command.requestKey)).status,"OBSERVED");
      await assert.rejects(service.command(actor.sessionCookie,{...command,displayName:"Changed intent"}),denied("INTENT_CONFLICT"));
      const other=await person();assert.equal((await service.outcome(other.sessionCookie,"CREATE",null,command.requestKey)).status,"NOT_OBSERVED");
      const stored=JSON.stringify((await owner.query("SELECT * FROM staff_management_outcomes WHERE id=$1",[replies[0].outcome.outcome_id])).rows);
      assert.doesNotMatch(stored,new RegExp(actor.code));assert.doesNotMatch(stored,new RegExp(replies.find(r=>r.issued_code)!.issued_code!));
    });
    await t.test("stale concurrent creation is a durable rejection even after later state changes",async()=>{
      const actor=await person(),a=await input(actor.code),b={...a,requestKey:randomUUID()};
      const results=await Promise.all([service.command(actor.sessionCookie,a),service.command(actor.sessionCookie,b)]);
      assert.equal(results.filter(r=>r.outcome.outcome==="APPLIED").length,1);assert.equal(results.filter(r=>r.outcome.outcome==="REJECTED").length,1);
      const rejected=results.find(r=>r.outcome.outcome==="REJECTED")!,original=rejected.outcome.request_key===a.requestKey?a:b;
      assert.deepEqual((await service.command(actor.sessionCookie,original)).outcome,rejected.outcome);
      assert.equal(rejected.outcome.reason,"STALE_VERSION");
    });
    await t.test("only Super Admins can manage normal staff and own-code confirmation cannot switch actors",async()=>{
      const actor=await person(),other=await person(),ordinary=await person("OWNER"),organiser=await person("ORGANISER");
      await assert.rejects(service.command(ordinary.sessionCookie,await input(ordinary.code)),denied("ACCESS_UNAVAILABLE"));
      await assert.rejects(service.list(organiser.sessionCookie),denied("ACCESS_UNAVAILABLE"));
      await assert.rejects(service.command(actor.sessionCookie,await input(other.code)),denied("STAFF_CONFIRMATION_REQUIRED"));
      await assert.rejects(service.command(actor.sessionCookie,await input(actor.code,{role:"SUPER_ADMIN" as never})),denied("INVALID_CONTEXT"));
      await assert.rejects(service.command(actor.sessionCookie,await input(actor.code,{action:"ROTATE",targetId:other.id,expectedRevision:"0",displayName:null,role:null,enabled:null})),denied("STAFF_TARGET_UNAVAILABLE"));
      healthy=false;try{await assert.rejects(service.list(actor.sessionCookie),denied("CLOCK_UNTRUSTED"));}finally{healthy=true;}
      await assert.rejects(api.query("SELECT apply_staff_management($1,$2)",[randomUUID(),randomBytes(32)]),{code:"P0001"});
      await assert.rejects(api.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Forbidden','SUPER_ADMIN')",[randomUUID()]),{code:"42501"});
    });
    await t.test("code rotation revokes the old code, grant and capsule and cannot be repeated by an old intent",async()=>{
      const actor=await person(),target=await person("OWNER");
      const command=await input(actor.code,{action:"ROTATE",targetId:target.id,expectedRevision:"0",displayName:null,role:null,enabled:null});
      const result=await service.command(actor.sessionCookie,command);assert.ok(result.issued_code);assert.equal(result.outcome.after!.code_version,"2");
      await assert.rejects(staff.inspect(target.sessionCookie),denied("INVALID_SESSION"));
      await assert.rejects(entry.begin(target.code,{ip:"127.0.0.1",browserId:randomUUID()}),denied("INVALID_CODE"));
      assert.equal((await owner.query("SELECT ciphertext FROM staff_session_deliveries WHERE session_id=$1",[target.session.session_id])).rows[0].ciphertext,null);
      const again=await service.command(actor.sessionCookie,command);assert.equal(again.issued_code,null);assert.deepEqual(again.outcome,result.outcome);
      assert.equal((await owner.query("SELECT max(version)::text AS version FROM access_credentials WHERE staff_id=$1",[target.id])).rows[0].version,"2");
      const flow=await entry.begin(result.issued_code,{ip:"127.0.0.1",browserId:randomUUID()});assert.equal(flow.audience,"STAFF");
    });
    await t.test("updates revoke affected authority, re-enable requires fresh entry and unchanged commands do not renew the actor",async()=>{
      const actor=await person(),target=await person("OWNER");
      const first=await input(actor.code,{action:"UPDATE",targetId:target.id,expectedRevision:"0",displayName:"Synthetic renamed organiser",role:"ORGANISER",enabled:false});
      const changed=await service.command(actor.sessionCookie,first);assert.equal(changed.outcome.after!.enabled,false);
      await assert.rejects(staff.inspect(target.sessionCookie),denied("INVALID_SESSION"));
      await service.command(actor.sessionCookie,{...first,requestKey:randomUUID(),expectedRevision:"1",enabled:true});
      await assert.rejects(staff.inspect(target.sessionCookie),denied("INVALID_SESSION"));
      const before=(await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[actor.session.session_id])).rows;
      const unchanged=await service.command(actor.sessionCookie,{...first,requestKey:randomUUID(),expectedRevision:"2",enabled:true});
      assert.equal(unchanged.outcome.outcome,"UNCHANGED");assert.deepEqual((await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[actor.session.session_id])).rows,before);
      await assert.rejects(owner.query("UPDATE staff_management_outcomes SET reason='rewrite' WHERE id=$1",[changed.outcome.outcome_id]),{code:"P0001"});
    });
    await t.test("name-only changes also revoke the target's grant and API receipts cannot commit without their effect",async()=>{
      const actor=await person(),target=await person("OWNER");
      const command=await input(actor.code,{action:"UPDATE",targetId:target.id,expectedRevision:"0",displayName:"Synthetic name-only edit",role:"OWNER",enabled:true});
      const result=await service.command(actor.sessionCookie,command);assert.equal(result.outcome.after!.code_version,"1");
      await assert.rejects(staff.inspect(target.sessionCookie),denied("INVALID_SESSION"));
      const created=await service.command(actor.sessionCookie,await input(actor.code));
      const before=(await owner.query("SELECT count(*)::integer AS n FROM staff_management_outcomes")).rows[0].n;
      await assert.rejects(api.query(`INSERT INTO staff_management_outcomes(id,actor_id,session_id,credential_id,credential_version,control_id,target_staff_id,action,request_key,fingerprint,
        expected_revision,display_name,role,enabled,reason,outcome,denial_reason,recorded_at,result_staff_id,result_credential_id,before_state,after_state)
        SELECT $1,actor_id,session_id,credential_id,credential_version,control_id,NULL,'CREATE',$2,fingerprint,
          (SELECT revision FROM security_control WHERE id=1),display_name,role,enabled,reason,'APPLIED',NULL,date_trunc('milliseconds',clock_timestamp()),$3::uuid,$4::uuid,NULL,
          jsonb_set(after_state,'{staff_id}',to_jsonb($3::uuid::text)) FROM staff_management_outcomes WHERE id=$5`,[randomUUID(),randomUUID(),randomUUID(),randomUUID(),created.outcome.outcome_id]),
        (e:unknown)=>typeof e==="object"&&e!==null&&"code"in e&&["23503","P0001"].includes(String(e.code)));
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_management_outcomes")).rows[0].n,before);
    });
    await t.test("receipt reads require current Super Admin authority after a role change",async()=>{
      const actor=await person(),command=await input(actor.code);await service.command(actor.sessionCookie,command);
      await owner.query("UPDATE staff_identities SET role='OWNER' WHERE id=$1",[actor.id]);
      await assert.rejects(service.outcome(actor.sessionCookie,"CREATE",null,command.requestKey),denied("INVALID_SESSION"));
      const flow=await entry.begin(actor.code,{ip:"127.0.0.1",browserId:randomUUID()});if(flow.audience!=="STAFF")throw new Error("Synthetic re-entry failed");
      const current=await staff.activate(flow.proofCookie,randomUUID());
      await assert.rejects(service.outcome(current.sessionCookie,"CREATE",null,command.requestKey),denied("ACCESS_UNAVAILABLE"));
    });

    const settings={mode:"production" as const,origin:"https://ingenium.test",cookieKey:randomBytes(32),csrfKey:randomBytes(32)},policy=browserPolicy(settings);
    const app=buildApp({database:{async check(){},async close(){}},entry:{pool:api,clock,delivery,browser:settings}});await app.ready();
    try{await t.test("HTTP management enforces staff CSRF, strict roles, safe receipts and one-time code delivery",async()=>{
      const actor=await person(),cookies=new Map<string,string>();
      async function send(url:string,body?:unknown,token?:string,origin=settings.origin){
        const response=await app.inject({method:body===undefined?"GET":"POST",url,headers:{origin,cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join(";"),...(body===undefined?{}:{"content-type":"application/json"}),...(token?{"x-csrf-token":token}:{})},...(body===undefined?{}:{payload:JSON.stringify(body)})});
        const lines=response.headers["set-cookie"];for(const line of typeof lines==="string"?[lines]:lines??[]){const p=line.split(";")[0]!,at=p.indexOf("=");cookies.set(p.slice(0,at),p.slice(at+1));}return response;
      }
      const anon=await send("/api/v1/bootstrap?audience=ANONYMOUS");cookies.set(policy.names.staff,actor.sessionCookie);
      const snap=await send("/api/v1/bootstrap?audience=STAFF");assert.equal(snap.statusCode,200);
      const list=await send("/api/v1/staff/staff-identities");assert.equal(list.statusCode,200);assert.doesNotMatch(list.body,/verifier|access_code|credential_id|ciphertext/);
      const body={request_key:randomUUID(),expected_revision:list.json().data.control_revision,own_code:actor.code,reason:"Synthetic HTTP approval",display_name:"Synthetic HTTP organiser",role:"ORGANISER"};
      assert.equal((await send("/api/v1/staff/staff-identities",body,anon.json().data.csrf_token)).statusCode,403);
      assert.equal((await send("/api/v1/staff/staff-identities",{...body,role:"SUPER_ADMIN"},snap.json().data.csrf_token)).statusCode,400);
      assert.equal((await send("/api/v1/staff/staff-identities",body,snap.json().data.csrf_token,"https://foreign.test")).statusCode,403);
      const created=await send("/api/v1/staff/staff-identities",body,snap.json().data.csrf_token);assert.equal(created.statusCode,200);assert.match(created.json().data.issued_code,/^[A-Z2-7]{32}$/);
      const retry=await send("/api/v1/staff/staff-identities",body,snap.json().data.csrf_token);assert.equal(retry.statusCode,200);assert.equal(retry.json().data.issued_code,null);
      const read=await send(`/api/v1/staff/outcomes/staff/CREATE/security/${body.request_key}`);assert.equal(read.statusCode,200);assert.equal(read.json().data.status,"OBSERVED");
      assert.doesNotMatch(read.body,new RegExp(actor.code));assert.doesNotMatch(read.body,new RegExp(created.json().data.issued_code));
      assert.equal(created.headers["cache-control"],"no-store");
      const revised=await send("/api/v1/staff/staff-identities");
      const escaped=await send("/api/v1/staff/staff-identities",{...body,request_key:randomUUID(),expected_revision:revised.json().data.control_revision,reason:"\u0001".repeat(1023)+"x"},snap.json().data.csrf_token);
      assert.equal(escaped.statusCode,200);
      const nextActor=await person();cookies.set(policy.names.staff,nextActor.sessionCookie);
      const nextSnapshot=await send("/api/v1/bootstrap?audience=STAFF");
      const rejected=await send("/api/v1/staff/staff-identities",{...body,request_key:randomUUID(),own_code:nextActor.code},nextSnapshot.json().data.csrf_token);
      assert.equal(rejected.statusCode,409);assert.equal(rejected.json().data.outcome.reason,"STALE_VERSION");assert.equal(rejected.json().data.issued_code,null);
    });}finally{await app.close();}
    await t.test("the active-staff cap rejects durably and stable pagination does not expose codes",async()=>{
      const actor=await person();
      let count=(await owner.query("SELECT count(*)::integer AS n FROM staff_identities WHERE disabled_at IS NULL")).rows[0].n;
      while(count++<50)await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic capacity fixture','ORGANISER')",[randomUUID()]);
      const command=await input(actor.code),rejected=await service.command(actor.sessionCookie,command);
      assert.equal(rejected.outcome.reason,"STAFF_CAPACITY");assert.equal(rejected.issued_code,null);
      const target=(await owner.query("SELECT id FROM staff_identities WHERE display_name='Synthetic capacity fixture' LIMIT 1")).rows[0].id;
      await owner.query("UPDATE staff_identities SET disabled_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1",[target]);
      assert.deepEqual((await service.command(actor.sessionCookie,command)).outcome,rejected.outcome);
      assert.equal((await service.command(actor.sessionCookie,{...command,requestKey:randomUUID()})).outcome.outcome,"APPLIED");
      const first=await service.list(actor.sessionCookie);assert.equal(first.items.length,50);assert.ok(first.next_after);
      const next=await service.list(actor.sessionCookie,first.next_after!);
      assert.equal(new Set([...first.items,...next.items].map(x=>x.staff_id)).size,first.items.length+next.items.length);
      assert.doesNotMatch(JSON.stringify(first),/verifier|access_code|credential_id|ciphertext/);
    });
  });
}
