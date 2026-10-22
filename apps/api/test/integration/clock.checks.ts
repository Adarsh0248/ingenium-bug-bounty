import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { createClockMonitor } from "../../src/clock/monitor.js";
import type { ClockSource } from "../../src/clock/monitor.js";
import { SECOND } from "../../src/clock/policy.js";
import { AccessError, accessTransaction } from "../../src/access/transaction.js";
import { newAccessCode, sessionDelivery } from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createWorkerClock } from "../../src/clock/worker-consumer.js";

function syntheticSource() {
  let current = 100n * SECOND;
  let corrupt = false;
  const wallOrigin = BigInt(Date.now())*1000000n - current;
  const source: ClockSource = { bootId: randomUUID(), resolutionNs: 0n, nowNs: () => current,
    async sample(nonce, sequence) {
      return { policy: 1, boot_id: source.bootId, nonce: corrupt ? "wrong-nonce" : nonce, sequence: sequence.toString(),
        boottime_before_ns: current.toString(), boottime_after_ns: current.toString(), realtime_ns: (wallOrigin+current).toString(),
        system_offset_ns: "0", root_delay_ns: "0", root_dispersion_ns: "0", synchronised: true, source_ok: true };
    } };
  return { source, step: (amount = 5n*SECOND) => { current += amount; }, corrupt: (value = true) => { corrupt = value; } };
}
const clockDenied = (error: unknown) => error instanceof AccessError && error.code === "CLOCK_UNTRUSTED";

export async function clockChecks(t: TestContext, ownerConnection: string, apiConnection: string): Promise<void> {
  async function isolated(work: (owner: Pool, api: Pool, monitorPool: Pool, make: (fake?: ReturnType<typeof syntheticSource>) => { fake: ReturnType<typeof syntheticSource>; monitor: ReturnType<typeof createClockMonitor> }) => Promise<void>) {
    const name = `ingenium_clock_${randomUUID().replaceAll("-", "")}`;
    const bootstrap = new Client({ connectionString: ownerConnection });
    await bootstrap.connect();
    try { await bootstrap.query(`CREATE DATABASE "${name}"`); } finally { await bootstrap.end(); }
    const ownerUrl = new URL(ownerConnection), apiUrl = new URL(apiConnection);
    ownerUrl.pathname = `/${name}`; apiUrl.pathname = `/${name}`;
    await migrateDatabase(ownerUrl.toString());
    const owner = new Pool({ connectionString: ownerUrl.toString(), max: 2 });
    const api = new Pool({ connectionString: apiUrl.toString(), max: 4 });
    const monitorPool = new Pool({ connectionString: apiUrl.toString(), max: 2 });
    const monitors: ReturnType<typeof createClockMonitor>[] = [];
    const make = (fake = syntheticSource()) => {
      const monitor = createClockMonitor(monitorPool, fake.source); monitors.push(monitor);
      return { monitor, fake };
    };
    try { await work(owner, api, monitorPool, make); }
    finally {
      for (const monitor of monitors.reverse()) { await monitor.flush().catch(() => {}); await monitor.stop().catch(() => {}); }
      await monitorPool.end(); await api.end(); await owner.end();
    }
  }
  async function establish(monitor: ReturnType<typeof createClockMonitor>, fake: ReturnType<typeof syntheticSource>) {
    for (let index = 0; index < 7; index++) {
      if (index) fake.step();
      await monitor.pollOnce();
      if (index < 6) assert.throws(() => monitor.guard.assertHealthy(), clockDenied);
    }
    monitor.guard.assertHealthy();
  }

  await t.test("separate worker clock consumes fresh primary reports and persists one immutable fault outside gameplay rollback without clearance authority", async () => isolated(async(owner,_api,_monitorPool,make) => {
    const {monitor,fake}=make(); await monitor.start(); await establish(monitor,fake);
    const pool=new Pool({connectionString:owner.options.connectionString!,options:"-c role=ingenium_app_worker",max:2});
    try {
      const consumer=createWorkerClock(pool,fake.source);
      for(let i=0;i<7;i++){if(i){fake.step();await monitor.pollOnce();}await consumer.pollOnce();if(i<6)assert.throws(()=>consumer.guard.assertHealthy(),clockDenied);}
      await accessTransaction(pool,consumer.guard,async client=>{await client.query("SELECT 1");},"SHARED");
      consumer.guard.fault("CLOCK_REVERSED"); await consumer.flush(); await consumer.flush();
      const row=(await owner.query("SELECT runtime_id,fault_latched,fault_generation,fault_reason FROM clock_health WHERE id=1")).rows[0];
      assert.equal(row.fault_latched,true);assert.equal(row.fault_generation,"1");assert.equal(row.fault_reason,"CLOCK_REVERSED");
      const events=(await owner.query("SELECT id,reason FROM clock_events WHERE evidence->>'consumer'='APP_JUDGING'")).rows;
      assert.equal(events.length,1);
      assert.equal((await pool.query("SELECT record_worker_clock_fault($1,0,$2,$3) AS acknowledged",[row.runtime_id,events[0].id,events[0].reason])).rows[0].acknowledged,true);
      await assert.rejects(pool.query("SELECT record_worker_clock_fault($1,0,$2,$3)",[row.runtime_id,events[0].id,"WALL_STEP"]),{code:"P0001"});
      assert.equal((await pool.query("SELECT record_worker_clock_fault($1,0,$2,'WALL_STEP') AS acknowledged",[randomUUID(),randomUUID()])).rows[0].acknowledged,false);
      await assert.rejects(pool.query("UPDATE clock_health SET fault_latched=false"),{code:"42501"});
      await assert.rejects(_api.query("SELECT record_worker_clock_fault($1,0,$2,'WALL_STEP')",[row.runtime_id,randomUUID()]),{code:"42501"});
      for(let i=0;i<7;i++){fake.step();await monitor.pollOnce();await consumer.pollOnce();}
      assert.equal((await owner.query("SELECT healthy_count FROM clock_health WHERE id=1")).rows[0].healthy_count,7);
      assert.equal((await pool.query("SELECT record_worker_clock_fault($1,0,$2,'WALL_STEP') AS acknowledged",[row.runtime_id,randomUUID()])).rows[0].acknowledged,false);
      assert.equal((await owner.query("SELECT healthy_count FROM clock_health WHERE id=1")).rows[0].healthy_count,7);
      assert.throws(()=>consumer.guard.assertHealthy(),clockDenied);
      assert.equal((await owner.query("SELECT count(*)::int n FROM clock_events WHERE evidence->>'consumer'='APP_JUDGING'")).rows[0].n,1);
    } finally {await pool.end();}
  }));
  if(process.env.INGENIUM_TEST_SUITE==="worker-clock")return;

  if(process.env.INGENIUM_TEST_SUITE==="clock-browser") {
    await t.test("restricted timing recovery preserves its incident, resolves lost clearance replies without replay and requires normal sign-in",()=>isolated(async(owner,api,_pool,make)=>{
      const {monitor,fake}=make(); await monitor.start(); await establish(monitor,fake);
      const {clockRecoveryBrowserChecks}=await import("./clock-recovery-browser.checks.js");
      await clockRecoveryBrowserChecks({owner,api,monitor,fake});
    }));
    return;
  }

  await t.test("real clock guard permits entry only after fresh observations; round reversal persists independently of rollback", async () => isolated(async (owner, api, _pool, make) => {
    const { monitor, fake } = make();
    await monitor.start(); assert.throws(() => monitor.guard.assertHealthy(), clockDenied);
    await establish(monitor, fake);
    const health = (await owner.query("SELECT state,sequence,healthy_count FROM clock_health")).rows[0];
    assert.deepEqual(health, { state: "HEALTHY", sequence: "7", healthy_count: 7 });
    const staff = randomUUID(), arena = randomUUID(), round = randomUUID(), team = randomUUID(), member = randomUUID(), other = randomUUID(), tr = randomUUID(), code = newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic clock owner','SUPER_ADMIN')", [staff]);
    await owner.query(`WITH created AS (INSERT INTO arena_instances(id,status,created_by,created_at)
      VALUES($1,'IN_PROGRESS',$2,date_trunc('milliseconds',clock_timestamp())) RETURNING id)
      UPDATE arena_control SET current_instance_id=created.id,revision=revision+1 FROM created WHERE arena_control.id=1`, [arena, staff]);
    await owner.query("INSERT INTO rounds(id,arena_instance_id,kind,state,duration_ms,started_at,closes_at) VALUES($1,$2,1,'RUNNING',300000,date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',clock_timestamp())+interval '5 minutes')", [round, arena]);
    await owner.query("INSERT INTO teams(id,display_name) VALUES($1,'Synthetic clock team')", [team]);
    await owner.query("INSERT INTO team_members(id,team_id,position,display_name) VALUES($1,$3,1,'Synthetic first'),($2,$3,2,'Synthetic second')", [member, other, team]);
    await owner.query("INSERT INTO access_credentials(id,team_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), team, code.verifier]);
    await owner.query("INSERT INTO team_rounds(id,team_id,round_id,display_name) VALUES($1,$2,$3,'Synthetic clock team')", [tr, team, round]);
    await owner.query("INSERT INTO member_rounds(id,team_round_id,team_id,member_id,round_id,display_name) VALUES($1,$3,$4,$5,$7,'First'),($2,$3,$4,$6,$7,'Second')", [randomUUID(), randomUUID(), tr, team, member, other, round]);
    const codec = sessionDelivery("synthetic-clock-v1", randomBytes(32));
    const service = createEntryService(api, monitor.guard, codec);
    const flow = await service.begin(code.code, { ip: "127.0.0.1", browserId: randomUUID() });
    if (flow.audience !== "TEAM") throw new Error("Synthetic clock team routed incorrectly.");
    const active = await service.activate(flow.proofCookie, { memberId: member, language: "cpp", requestKey: randomUUID() });
    if (active.status !== "ACTIVATED") throw new Error("Synthetic clock entry failed.");
    const before = (await owner.query("SELECT trusted_time_at FROM rounds WHERE id=$1", [round])).rows;
    assert.ok(before[0].trusted_time_at instanceof Date);
    await service.inspect(active.sessionCookie);
    assert.deepEqual((await owner.query("SELECT trusted_time_at FROM rounds WHERE id=$1", [round])).rows, before);
    await assert.rejects(owner.query("UPDATE rounds SET trusted_time_at=NULL WHERE id=$1", [round]), { code: "P0001" });
    const another = await service.begin(code.code, { ip: "127.0.0.1", browserId: randomUUID() });
    if (another.audience !== "TEAM") throw new Error("Synthetic flow failed.");
    const failedBefore = (await owner.query("SELECT trusted_time_at,closes_at,state FROM rounds WHERE id=$1", [round])).rows;
    const failing = createEntryService(api, monitor.guard, { ...codec, async encrypt() { throw new Error("Synthetic delivery failure"); } });
    await assert.rejects(failing.activate(another.proofCookie, { memberId: other, language: "c", requestKey: randomUUID() }), /Synthetic delivery failure/);
    assert.deepEqual((await owner.query("SELECT trusted_time_at,closes_at,state FROM rounds WHERE id=$1", [round])).rows, failedBefore);
    await owner.query("UPDATE rounds SET trusted_time_at=date_trunc('milliseconds',clock_timestamp())+interval '1 hour' WHERE id=$1", [round]);
    await assert.rejects(service.inspect(active.sessionCookie), clockDenied);
    await monitor.flush();
    assert.deepEqual((await owner.query("SELECT fault_latched,fault_generation,fault_reason FROM clock_health")).rows[0], { fault_latched: true, fault_generation: "1", fault_reason: "CLOCK_REVERSED" });
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM clock_events WHERE kind='FAULT'")).rows[0].count, 1);
    assert.equal((await owner.query("SELECT revoked_at FROM participant_sessions WHERE id=$1", [active.session.sessionId])).rows[0].revoked_at, null);
    assert.deepEqual((await owner.query("SELECT closes_at,state FROM rounds WHERE id=$1", [round])).rows[0], { closes_at: failedBefore[0].closes_at, state: "RUNNING" });
    for (let index = 0; index < 7; index++) { fake.step(); await monitor.pollOnce(); }
    assert.throws(() => monitor.guard.assertHealthy(), clockDenied);
    await assert.rejects(api.query("UPDATE clock_health SET fault_latched=false,fault_reason=NULL,state='HEALTHY' WHERE id=1"), { code: "P0001" });
    await assert.rejects(owner.query("DELETE FROM clock_events"), { code: "P0001" });
  }));

  await t.test("stale clock reports fault at exact expiry without a gameplay admission and never auto-clear", async () => isolated(async (owner, _api, _pool, make) => {
    const { monitor, fake } = make(); await monitor.start(); await establish(monitor, fake);
    fake.step(15n*SECOND-1n); monitor.guard.assertHealthy();
    fake.step(1n); assert.throws(() => monitor.guard.assertHealthy(), clockDenied);
    await monitor.flush();
    assert.equal((await owner.query("SELECT fault_reason FROM clock_health")).rows[0].fault_reason, "STALE_REPORT");
    for (let index = 0; index < 7; index++) { fake.step(); await monitor.pollOnce(); }
    assert.throws(() => monitor.guard.assertHealthy(), clockDenied);
    const state = (await owner.query("SELECT fault_generation,healthy_count,state FROM clock_health")).rows[0];
    assert.deepEqual(state, { fault_generation: "1", healthy_count: 7, state: "FAULT" });
  }));

  await t.test("clean restart cannot reuse an old healthy row or another run's sequence", async () => isolated(async (owner, _api, _pool, make) => {
    const first = make(); await first.monitor.start(); await establish(first.monitor, first.fake); await first.monitor.stop();
    const next = make(first.fake); await next.monitor.start();
    assert.throws(() => next.monitor.guard.assertHealthy(), clockDenied);
    assert.equal((await owner.query("SELECT sequence,healthy_count FROM clock_health")).rows[0].sequence, "0");
    await establish(next.monitor, next.fake);
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM clock_runs")).rows[0].count, 2);
  }));

  await t.test("unclean restart holds a durable fault and the replaced monitor cannot authorise another transaction", async () => isolated(async (owner, api, _pool, make) => {
    const first = make(); await first.monitor.start(); await establish(first.monitor, first.fake);
    const next = make(first.fake); await next.monitor.start();
    await assert.rejects(accessTransaction(api, first.monitor.guard, async () => true, "SHARED"), clockDenied);
    await first.monitor.flush().catch(() => {});
    assert.equal((await owner.query("SELECT fault_reason FROM clock_health")).rows[0].fault_reason, "UNCLEAN_RESTART");
    for (let index = 0; index < 7; index++) { next.fake.step(); await next.monitor.pollOnce(); }
    assert.throws(() => next.monitor.guard.assertHealthy(), clockDenied);
  }));

  await t.test("a replayed probe binding cannot establish trust or advance the durable report sequence", async () => isolated(async (owner, _api, _pool, make) => {
    const { monitor, fake } = make(); await monitor.start(); fake.corrupt(); await monitor.pollOnce();
    assert.throws(() => monitor.guard.assertHealthy(), clockDenied);
    assert.deepEqual((await owner.query("SELECT fault_latched,sequence,state FROM clock_health")).rows[0], { fault_latched: true, sequence: "0", state: "FAULT" });
    fake.corrupt(false);
    for (let index = 0; index < 6; index++) { fake.step(); await monitor.pollOnce(); }
    assert.equal((await owner.query("SELECT healthy_count FROM clock_health")).rows[0].healthy_count, 6);
    fake.corrupt(); fake.step(); await monitor.pollOnce();
    assert.equal((await owner.query("SELECT healthy_count FROM clock_health")).rows[0].healthy_count, 0);
    fake.corrupt(false); fake.step(); await monitor.pollOnce();
    assert.equal((await owner.query("SELECT healthy_count FROM clock_health")).rows[0].healthy_count, 1);
  }));

  await t.test("failed clock persistence closes the local guard and records the fault once coordination is available", async () => isolated(async (owner, _api, _pool, make) => {
    const { monitor, fake } = make(); await monitor.start(); await establish(monitor, fake);
    const blocker = await owner.connect(); let poll: Promise<void> | undefined;
    try {
      await blocker.query("BEGIN"); await blocker.query("SELECT id FROM security_control WHERE id=1 FOR UPDATE");
      fake.step(); poll = monitor.pollOnce();
      let faulted = false;
      for (let index = 0; index < 100; index++) {
        try { monitor.guard.assertHealthy(); } catch { faulted = true; break; }
        await setTimeout(20);
      }
      assert.equal(faulted, true);
    } finally { await blocker.query("ROLLBACK"); blocker.release(); await poll; }
    await monitor.flush();
    assert.equal((await owner.query("SELECT fault_reason FROM clock_health")).rows[0].fault_reason, "DATABASE_UNAVAILABLE");
  }));

  await t.test("shutdown includes a fault detected by an in-flight request before recording its clean stop", async () => isolated(async (owner, _api, _pool, make) => {
    const { monitor, fake } = make(); await monitor.start(); await establish(monitor, fake);
    const blocker = await owner.connect(); let stopping: Promise<void> | undefined;
    try {
      await blocker.query("BEGIN"); await blocker.query("SELECT id FROM security_control WHERE id=1 FOR SHARE");
      stopping = monitor.stop();
      let waiting = false;
      for (let index = 0; index < 20; index++) {
        const row = (await owner.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock') AS waiting")).rows[0];
        if (row.waiting) { waiting = true; break; }
        await setTimeout(10);
      }
      assert.equal(waiting, true);
      monitor.guard.fault("CLOCK_REVERSED");
    } finally { await blocker.query("ROLLBACK"); blocker.release(); await stopping; }
    await monitor.flush();
    assert.deepEqual((await owner.query("SELECT running,fault_latched,fault_reason,state FROM clock_health")).rows[0], { running: false, fault_latched: true, fault_reason: "CLOCK_REVERSED", state: "STOPPED" });
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM clock_events WHERE kind='FAULT'")).rows[0].count, 1);
  }));

  await t.test("restored-time HTTP staff recovery clears exactly one bound incident without promoting the recovery grant",async() => isolated(async(owner,api,_pool,make) => {
    const {monitor,fake}=make(); await monitor.start(); await establish(monitor,fake);
    const delivery=sessionDelivery("synthetic-clock-recovery-v1",randomBytes(32));
    const staff=createStaffService(api,monitor.guard,delivery,monitor.recoveryGuard);
    const entry=createEntryService(api,monitor.guard,delivery);
    async function fixture(role:string) {
      const id=randomUUID(),code=newAccessCode();
      await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic clock staff',$2)",[id,role]);
      await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),id,code.verifier]);
      return {id,code:code.code};
    }
    const manager=await fixture("OWNER"), organiser=await fixture("ORGANISER"), other=await fixture("SUPER_ADMIN");
    const arena=randomUUID(),round=randomUUID();
    await owner.query(`WITH created AS (INSERT INTO arena_instances(id,status,created_by,created_at)
      VALUES($1,'IN_PROGRESS',$2,date_trunc('milliseconds',clock_timestamp())) RETURNING id)
      UPDATE arena_control SET current_instance_id=created.id,revision=revision+1 FROM created WHERE arena_control.id=1`,[arena,manager.id]);
    await owner.query(`INSERT INTO rounds(id,arena_instance_id,kind,state,duration_ms,started_at,closes_at,trusted_time_at)
      VALUES($1,$2,1,'PAUSED',300000,date_trunc('milliseconds',clock_timestamp())-interval '1 minute',date_trunc('milliseconds',clock_timestamp())+interval '4 minutes',date_trunc('milliseconds',clock_timestamp()))`,[round,arena]);
    const beforeRound=(await owner.query("SELECT * FROM rounds WHERE id=$1",[round])).rows;
    const initial=await entry.begin(manager.code,{ip:"127.0.0.1",browserId:randomUUID()});
    if(initial.audience!=="STAFF") throw new Error("Synthetic owner routing failed");
    const original=await staff.activate(initial.proofCookie,randomUUID());
    monitor.guard.fault("WALL_STEP"); await monitor.flush();
    await assert.rejects(staff.beginRecovery(manager.code,{ip:"127.0.0.1",browserId:randomUUID()}),clockDenied);
    for(let i=0;i<6;i++){fake.step();await monitor.pollOnce();}
    assert.throws(()=>monitor.recoveryGuard.assertHealthy(),clockDenied);
    fake.step();await monitor.pollOnce(); monitor.recoveryGuard.assertHealthy();
    assert.throws(()=>monitor.guard.assertHealthy(),clockDenied);
    await assert.rejects(staff.beginRecovery(organiser.code,{ip:"127.0.0.1",browserId:randomUUID()}),(error:unknown)=>error instanceof AccessError&&error.code==="INVALID_CODE");
    const settings={mode:"production" as const,origin:"https://ingenium.test",cookieKey:randomBytes(32),csrfKey:randomBytes(32)};
    const policy=browserPolicy(settings),cookies=new Map<string,string>();
    const app=buildApp({database:{async check(){},async close(){}},entry:{pool:api,clock:monitor.guard,recoveryClock:monitor.recoveryGuard,delivery,browser:settings}});
    await app.ready();
    async function send(url:string,body?:unknown,token?:string) {
      const result=await app.inject({method:body===undefined?"GET":"POST",url,headers:{origin:settings.origin,cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join(";"),
        ...(body===undefined?{}:{"content-type":"application/json"}),...(token?{"x-csrf-token":token}:{})},...(body===undefined?{}:{payload:JSON.stringify(body)})});
      const lines=result.headers["set-cookie"];
      for(const line of typeof lines==="string"?[lines]:lines??[]){const pair=line.split(";")[0]!,at=pair.indexOf("=");cookies.set(pair.slice(0,at),pair.slice(at+1));}
      return result;
    }
    try {
      const anonymous=await send("/api/v1/bootstrap?audience=ANONYMOUS"); assert.equal(anonymous.statusCode,200);
      const verified=await send("/api/v1/entry/verify",{code:manager.code},anonymous.json().data.csrf_token); assert.equal(verified.statusCode,200);
      assert.equal(verified.json().data.flow.mode,"CLOCK_RECOVERY");
      const active=await send("/api/v1/staff/recovery/entry/activate",{request_key:randomUUID()},verified.json().data.csrf_token); assert.equal(active.statusCode,200);
      const sessionCookie=cookies.get(policy.names.staffRecovery)!;
      const token=active.json().data.csrf_token;
      assert.equal(active.json().data.session.mode,"CLOCK_RECOVERY");
      await assert.rejects(staff.inspect(original.sessionCookie,true),(error:unknown)=>error instanceof AccessError&&error.code==="INVALID_SESSION");
      const status=await send("/api/v1/staff/recovery/clock"); assert.equal(status.statusCode,200);
      const state=status.json().data;
      const body={own_code:other.code,request_key:randomUUID(),runtime_id:state.runtime_id,generation:state.fault_generation,reason:"Synthetic operator confirmed restored primary time"};
      const outcomePath=`/api/v1/staff/recovery/clock/outcomes/${body.request_key}`;
      assert.deepEqual((await send(outcomePath)).json().data,{status:"NOT_OBSERVED",outcome:null});
      assert.equal((await send("/api/v1/staff/recovery/clock/outcomes/invalid")).statusCode,400);
      const refused=await send("/api/v1/staff/recovery/clock/clear",body,token);
      assert.equal(refused.statusCode,403); assert.equal(refused.json().error.code,"STAFF_CONFIRMATION_REQUIRED");
      assert.equal((await staff.inspect(sessionCookie,true)).session_id,active.json().data.session.session_id);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM clock_clearances")).rows[0].n,0);
      assert.equal((await send("/api/v1/staff/recovery/clock/clear",{...body,own_code:manager.code},verified.json().data.csrf_token)).statusCode,403);
      const valid={...body,own_code:manager.code};
      const otherFlow=await staff.beginRecovery(other.code,{ip:"127.0.0.1",browserId:randomUUID()});
      const otherSession=await staff.activate(otherFlow.proofCookie,randomUUID(),true);
      const cleared=await send("/api/v1/staff/recovery/clock/clear",valid,token); assert.equal(cleared.statusCode,200);
      const activity=(await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[active.json().data.session.session_id])).rows;
      const retry=await send("/api/v1/staff/recovery/clock/clear",valid,token); assert.equal(retry.statusCode,200); assert.deepEqual(retry.json().data,cleared.json().data);
      assert.deepEqual((await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[active.json().data.session.session_id])).rows,activity);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM clock_clearances")).rows[0].n,1);
      const recovered=await send(outcomePath); assert.equal(recovered.statusCode,200);
      assert.deepEqual(recovered.json().data,{status:"OBSERVED",outcome:cleared.json().data});
      assert.match(recovered.headers["cache-control"] as string,/no-store/);
      assert.deepEqual((await owner.query("SELECT last_activity_at FROM staff_sessions WHERE id=$1",[active.json().data.session.session_id])).rows,activity);
      assert.deepEqual(await staff.clockOutcome(otherSession.sessionCookie,body.request_key),{status:"NOT_OBSERVED",outcome:null});
      assert.doesNotMatch(recovered.body,/own_code|Synthetic operator|verifier|ciphertext/);
      assert.deepEqual((await owner.query("SELECT * FROM rounds WHERE id=$1",[round])).rows,beforeRound);
      await assert.rejects(owner.query("UPDATE clock_clearances SET reason='rewrite'"),{code:"P0001"});
      assert.equal((await send("/ready")).statusCode,503);
      fake.step();await monitor.pollOnce();monitor.guard.assertHealthy();
      assert.equal((await send("/ready")).statusCode,200);
      await assert.rejects(staff.inspect(sessionCookie),(error:unknown)=>error instanceof AccessError&&error.code==="ACCESS_UNAVAILABLE");
      cookies.set(policy.names.staff,sessionCookie);
      assert.equal((await send("/api/v1/bootstrap?audience=STAFF")).statusCode,403);
      const recoverySnapshot=await send("/api/v1/bootstrap?audience=STAFF_RECOVERY"); assert.equal(recoverySnapshot.statusCode,200);
      assert.equal((await send("/api/v1/staff/keep-alive",{request_key:randomUUID()},recoverySnapshot.json().data.csrf_token)).statusCode,403);
      const fullFlow=await entry.begin(manager.code,{ip:"127.0.0.1",browserId:randomUUID()}); if(fullFlow.audience!=="STAFF")throw new Error("Synthetic fresh staff flow failed");
      const full=await staff.activate(fullFlow.proofCookie,randomUUID()); assert.equal(full.session.mode,"NORMAL");
      assert.equal((await staff.inspect(full.sessionCookie)).staff_id,manager.id);
      monitor.guard.fault("WALL_STEP");await monitor.flush();
      assert.equal((await owner.query("SELECT fault_generation FROM clock_health")).rows[0].fault_generation,"2");
      assert.doesNotMatch(cleared.body,/own_code|Synthetic operator|verifier|ciphertext|v1\.[0-9a-f-]{36}\./);
    } finally {await app.close();}
  }));

  await t.test("a new fault just after clearance persists as a new incident before the monitor refreshes its old latch",async() => isolated(async(owner,api,_pool,make) => {
    const {monitor,fake}=make();await monitor.start();await establish(monitor,fake);
    const id=randomUUID(),code=newAccessCode(),delivery=sessionDelivery("synthetic-new-incident",randomBytes(32));
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic recovery owner','OWNER')",[id]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),id,code.verifier]);
    monitor.guard.fault("WALL_STEP");await monitor.flush();
    for(let i=0;i<7;i++){fake.step();await monitor.pollOnce();}
    const staff=createStaffService(api,monitor.guard,delivery,monitor.recoveryGuard);
    const flow=await staff.beginRecovery(code.code,{ip:"127.0.0.1",browserId:randomUUID()});
    const active=await staff.activate(flow.proofCookie,randomUUID(),true);
    await staff.clearClock(active.sessionCookie,{code:code.code,requestKey:randomUUID(),runtimeId:monitor.runtimeId,generation:"1",reason:"Synthetic timing review"});
    monitor.guard.fault("CLOCK_REVERSED");await monitor.flush();
    assert.deepEqual((await owner.query("SELECT fault_latched,fault_generation,fault_reason FROM clock_health")).rows[0],{fault_latched:true,fault_generation:"2",fault_reason:"CLOCK_REVERSED"});
    assert.throws(()=>monitor.recoveryGuard.assertHealthy(),clockDenied);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM clock_clearances")).rows[0].n,1);
    await assert.rejects(api.query("UPDATE clock_health SET fault_latched=false,fault_reason=NULL,state='HEALTHY' WHERE id=1"),{code:"P0001"});
  }));
}
