import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { newProof, sessionDelivery } from "../src/access/credentials.js";
import { staffTimeValid } from "../src/access/staff-service.js";
import { browserPolicy, csrfContext } from "../src/access/browser-policy.js";

test("staff delivery binds its audience, identity, recovery scope and incident independently of participant delivery",async() => {
  const codec=sessionDelivery("synthetic-staff",randomBytes(32)), session=newProof();
  const binding={ flowId:randomUUID(),sessionId:session.id,staffId:randomUUID(),credentialId:randomUUID(),credentialVersion:"1",expiresAt:new Date().toISOString(),mode:"CLOCK_RECOVERY" as const,generation:"1" };
  const ciphertext=await codec.encrypt(binding,session.cookie);
  assert.equal(await codec.decrypt(ciphertext,binding),session.cookie);
  for (const wrong of [{...binding,staffId:randomUUID()},{...binding,mode:"NORMAL" as const},{...binding,generation:"2"},
    {flowId:binding.flowId,sessionId:session.id,credentialId:binding.credentialId,credentialVersion:"1",expiresAt:binding.expiresAt,memberRoundId:binding.staffId}]) {
    await assert.rejects(codec.decrypt(ciphertext,wrong));
  }
  await assert.rejects(codec.encrypt({...binding,generation:"0"},session.cookie));
  await assert.rejects(codec.encrypt({...binding,memberRoundId:randomUUID()},session.cookie));
});

test("staff timeouts expire at equality and cannot grant backward-time grace",() => {
  const created=new Date("2026-10-19T00:00:00.000Z"), absolute=new Date(created.getTime()+28800000);
  const row={created_at:created,absolute_expires_at:absolute,last_activity_at:created};
  assert.equal(staffTimeValid(row,new Date(created.getTime()+899999)),true);
  assert.equal(staffTimeValid(row,new Date(created.getTime()+900000)),false);
  assert.equal(staffTimeValid({...row,last_activity_at:new Date(absolute.getTime()-1)},absolute),false);
  assert.throws(() => staffTimeValid(row,new Date(created.getTime()-1)),/CLOCK_UNTRUSTED/);
});

test("staff, participant and recovery CSRF contexts and cookie names never share an authority",() => {
  const policy=browserPolicy({mode:"production",origin:"https://ingenium.test",cookieKey:randomBytes(32),csrfKey:randomBytes(32)});
  assert.equal(new Set(Object.values(policy.names)).size,Object.values(policy.names).length);
  const id=randomUUID(), cookie=newProof().cookie;
  assert.equal(new Set((["ENTRY","PARTICIPANT","STAFF_ENTRY","STAFF","STAFF_RECOVERY_ENTRY","STAFF_RECOVERY"] as const)
    .map((audience) => csrfContext(policy,audience,id,cookie))).size,6);
});
