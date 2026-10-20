import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { newAccessCode, newProof, sessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";

export async function staffChecks(t: TestContext,owner:Pool,api:Pool) {
  const clock={assertHealthy(){},async verify(){},fault(){}}, delivery=sessionDelivery("synthetic-staff-v1",randomBytes(32));
  const entry=createEntryService(api,clock,delivery), staff=createStaffService(api,clock,delivery);
  const context=() => ({ip:"127.0.0.1",browserId:randomUUID()});
  const denied=(code:string) => (error:unknown) => error instanceof AccessError && error.code===code;
  async function fixture(role="OWNER") {
    const id=randomUUID(), credentialId=randomUUID(), access=newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic staff',$2)",[id,role]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[credentialId,id,access.verifier]);
    return {id,credentialId,code:access.code};
  }
  async function flow(code:string) { const f=await entry.begin(code,context()); if(f.audience!=="STAFF") throw new Error("Synthetic staff routing failed"); return f; }
  async function login(code:string) { const f=await flow(code); return {flow:f,...await staff.activate(f.proofCookie,randomUUID())}; }

  await t.test("staff concurrent activation and lost-response recovery preserve one grant and exact original deadlines",async() => {
    const person=await fixture(), f=await flow(person.code), key=randomUUID();
    const [a,b]=await Promise.all([staff.activate(f.proofCookie,key),staff.activate(f.proofCookie,key)]);
    assert.equal(a.sessionCookie,b.sessionCookie); assert.equal(a.session.mode,"NORMAL"); assert.equal(a.session.role,"OWNER");
    const before=(await owner.query("SELECT last_activity_at,absolute_expires_at FROM staff_sessions WHERE id=$1",[a.session.session_id])).rows;
    const restarted=createStaffService(api,clock,delivery);
    assert.equal((await restarted.recover(f.proofCookie)).sessionCookie,a.sessionCookie);
    await restarted.inspect(a.sessionCookie);
    assert.deepEqual((await owner.query("SELECT last_activity_at,absolute_expires_at FROM staff_sessions WHERE id=$1",[a.session.session_id])).rows,before);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_sessions WHERE staff_id=$1",[person.id])).rows[0].n,1);
    await assert.rejects(staff.activate(f.proofCookie,randomUUID()),denied("INTENT_CONFLICT"));
    await assert.rejects(owner.query("UPDATE staff_sessions SET absolute_expires_at=absolute_expires_at+interval '1 hour' WHERE id=$1",[a.session.session_id]),{code:"P0001"});
    await assert.rejects(owner.query("UPDATE staff_entry_outcomes SET recorded_at=recorded_at+interval '1 second' WHERE flow_id=$1",[f.flow_id]),{code:"P0001"});
    await assert.rejects(owner.query("UPDATE staff_session_slots SET session_id=NULL WHERE staff_id=$1",[person.id]),{code:"P0001"});
  });
  await t.test("deliberate fresh staff sign-in fences the previous browser and purges its delivery",async() => {
    const person=await fixture(), old=await login(person.code), next=await login(person.code);
    assert.notEqual(old.sessionCookie,next.sessionCookie);
    await assert.rejects(staff.inspect(old.sessionCookie),denied("INVALID_SESSION"));
    await assert.rejects(staff.recover(old.flow.proofCookie),denied("INVALID_FLOW"));
    assert.equal((await staff.inspect(next.sessionCookie)).staff_id,person.id);
    assert.equal((await owner.query("SELECT ciphertext FROM staff_session_deliveries WHERE session_id=$1",[old.session.session_id])).rows[0].ciphertext,null);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_sessions WHERE staff_id=$1 AND revoked_at IS NULL",[person.id])).rows[0].n,1);
  });
  await t.test("staff delivery encryption failure rolls back replacement without losing the original current session",async() => {
    const person=await fixture(), old=await login(person.code), f=await flow(person.code);
    const failing=createStaffService(api,clock,{...delivery,async encrypt(){throw new Error("Synthetic staff encryption failure");}});
    await assert.rejects(failing.activate(f.proofCookie,randomUUID()),/Synthetic staff encryption failure/);
    assert.equal((await staff.inspect(old.sessionCookie)).session_id,old.session.session_id);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_sessions WHERE staff_id=$1",[person.id])).rows[0].n,1);
  });
  await t.test("staff keep-alive renews only idle time once per intent; reads and duplicate delivery do not renew",async() => {
    const person=await fixture(), active=await login(person.code), key=randomUUID();
    const before=(await owner.query("SELECT last_activity_at,absolute_expires_at FROM staff_sessions WHERE id=$1",[active.session.session_id])).rows[0];
    await setTimeout(5); await staff.keepAlive(active.sessionCookie,key);
    const after=(await owner.query("SELECT last_activity_at,absolute_expires_at FROM staff_sessions WHERE id=$1",[active.session.session_id])).rows[0];
    assert.ok(after.last_activity_at>before.last_activity_at); assert.deepEqual(after.absolute_expires_at,before.absolute_expires_at);
    await setTimeout(5); await staff.keepAlive(active.sessionCookie,key); await staff.recover(active.flow.proofCookie); await staff.inspect(active.sessionCookie);
    assert.deepEqual((await owner.query("SELECT last_activity_at,absolute_expires_at FROM staff_sessions WHERE id=$1",[active.session.session_id])).rows[0],after);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM staff_keep_alive_outcomes WHERE session_id=$1",[active.session.session_id])).rows[0].n,1);
    await assert.rejects(owner.query("DELETE FROM staff_keep_alive_outcomes WHERE session_id=$1",[active.session.session_id]),{code:"P0001"});
  });
  await t.test("staff logout revokes its authority and proof without deactivating its identity",async() => {
    const person=await fixture("SUPER_ADMIN"), active=await login(person.code);
    assert.deepEqual(await staff.logout(active.sessionCookie),{signed_out:true});
    await assert.rejects(staff.inspect(active.sessionCookie),denied("INVALID_SESSION"));
    await assert.rejects(staff.recover(active.flow.proofCookie),denied("INVALID_FLOW"));
    assert.equal((await owner.query("SELECT disabled_at FROM staff_identities WHERE id=$1",[person.id])).rows[0].disabled_at,null);
    assert.equal((await owner.query("SELECT ciphertext FROM staff_session_deliveries WHERE session_id=$1",[active.session.session_id])).rows[0].ciphertext,null);
    assert.equal((await login(person.code)).session.staff_id,person.id);
  });
  await t.test("staff role and credential changes revoke old authority and encrypted redelivery, not historical identity",async() => {
    const person=await fixture("ORGANISER"), active=await login(person.code);
    await owner.query("UPDATE staff_identities SET role='OWNER' WHERE id=$1",[person.id]);
    await assert.rejects(staff.inspect(active.sessionCookie),denied("INVALID_SESSION"));
    await assert.rejects(staff.recover(active.flow.proofCookie),denied("INVALID_FLOW"));
    assert.equal((await owner.query("SELECT ciphertext FROM staff_session_deliveries WHERE session_id=$1",[active.session.session_id])).rows[0].ciphertext,null);
    const newActive=await login(person.code); assert.equal(newActive.session.role,"OWNER");
    await owner.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1",[person.credentialId]);
    await assert.rejects(staff.inspect(newActive.sessionCookie),denied("INVALID_SESSION"));
    await assert.rejects(entry.begin(person.code,context()),denied("INVALID_CODE"));
    assert.equal((await owner.query("SELECT ciphertext FROM staff_session_deliveries WHERE session_id=$1",[newActive.session.session_id])).rows[0].ciphertext,null);
  });

  const settings={mode:"production" as const,origin:"https://ingenium.test",cookieKey:randomBytes(32),csrfKey:randomBytes(32)};
  const policy=browserPolicy(settings);
  const create=() => buildApp({database:{async check(){},async close(){}},entry:{pool:api,clock,delivery,browser:settings}});
  const app=create(); await app.ready();
  function browser(instance=app) {
    const cookies=new Map<string,string>();
    async function send(url:string,body?:unknown,token?:string,origin=settings.origin) {
      const response=await instance.inject({method:body===undefined?"GET":"POST",url,headers:{origin,cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join(";"),
        ...(body===undefined?{}:{"content-type":"application/json"}),...(token?{"x-csrf-token":token}:{})},...(body===undefined?{}:{payload:JSON.stringify(body)})});
      const lines=response.headers["set-cookie"];
      for(const line of typeof lines==="string"?[lines]:lines??[]) { const pair=line.split(";")[0]!, at=pair.indexOf("="); cookies.set(pair.slice(0,at),pair.slice(at+1)); }
      return response;
    }
    async function start(code:string) {
      const anon=await send("/api/v1/bootstrap?audience=ANONYMOUS");
      const verified=await send("/api/v1/entry/verify",{code},anon.json().data.csrf_token); assert.equal(verified.statusCode,200); return verified.json().data;
    }
    return {cookies,send,start};
  }
  try {
    await t.test("HTTP staff sessions use distinct secure cookies, safe projections and stage-bound CSRF",async() => {
      const person=await fixture(), client=browser(), f=await client.start(person.code), key=randomUUID();
      assert.equal(f.audience,"STAFF"); assert.equal(f.flow.mode,"NORMAL");
      assert.equal((await client.send("/api/v1/staff/entry/activate",{request_key:key,role:"SUPER_ADMIN"},f.csrf_token)).statusCode,400);
      assert.equal((await client.send("/api/v1/staff/entry/activate",{request_key:key},f.csrf_token,"https://foreign.test")).statusCode,403);
      const response=await client.send("/api/v1/staff/entry/activate",{request_key:key},f.csrf_token);
      assert.equal(response.statusCode,200); assert.equal(response.json().data.session.role,"OWNER");
      assert.equal(client.cookies.has(policy.names.participant),false); assert.equal(client.cookies.has(policy.names.entry),false);
      const lines=response.headers["set-cookie"];
      for(const line of typeof lines==="string"?[lines]:lines??[]) { assert.match(line,/; Secure/); assert.match(line,/; HttpOnly/); assert.match(line,/; SameSite=Strict/); assert.doesNotMatch(line,/; Domain=/); }
      assert.doesNotMatch(response.body,/v1\.[0-9a-f-]{36}\.|verifier|ciphertext|credential_id|proofCookie|sessionCookie/);
      assert.equal((await client.send("/api/v1/bootstrap?audience=PARTICIPANT")).statusCode,401);
      assert.equal((await client.send("/api/v1/staff/keep-alive",{request_key:randomUUID()},f.csrf_token)).statusCode,403);
      assert.equal((await client.send("/api/v1/staff/recovery/clock")).statusCode,503);
      const snapshot=await client.send("/api/v1/bootstrap?audience=STAFF"); assert.equal(snapshot.statusCode,200);
      assert.equal((await client.send("/api/v1/staff/logout",{},snapshot.json().data.csrf_token)).statusCode,200);
      assert.equal((await client.send("/api/v1/bootstrap?audience=STAFF")).statusCode,401);
    });
    await t.test("HTTP same-proof staff recovery after app restart returns exact cookie without new activity",async() => {
      const person=await fixture(), client=browser(), f=await client.start(person.code);
      const active=await client.send("/api/v1/staff/entry/activate",{request_key:randomUUID()},f.csrf_token); assert.equal(active.statusCode,200);
      const original=client.cookies.get(policy.names.staff), id=active.json().data.session.session_id;
      const before=(await owner.query("SELECT last_activity_at,absolute_expires_at FROM staff_sessions WHERE id=$1",[id])).rows;
      const restarted=create();
      try {
        const next=browser(restarted); for(const [k,v] of client.cookies) if(k!==policy.names.staff) next.cookies.set(k,v);
        const view=await next.send("/api/v1/bootstrap?audience=STAFF_ENTRY"); assert.equal(view.statusCode,200);
        const recovered=await next.send("/api/v1/staff/entry/recover",{},view.json().data.csrf_token); assert.equal(recovered.statusCode,200);
        assert.equal(next.cookies.get(policy.names.staff),original);
        assert.deepEqual((await owner.query("SELECT last_activity_at,absolute_expires_at FROM staff_sessions WHERE id=$1",[id])).rows,before);
      } finally {await restarted.close();}
    });
  } finally {await app.close();}
}
