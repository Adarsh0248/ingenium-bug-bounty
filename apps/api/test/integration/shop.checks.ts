import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { installShopIntel } from "../../src/competition/shop-intel.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { withBrowserApp } from "./browser-app.js";
import { expect } from "@playwright/test";
import { createShopService } from "../../src/competition/shop.js";
import { createWorkbenchService } from "../../src/workbench/service.js";
import { createLiveService } from "../../src/live/service.js";
import { parseProof } from "../../src/access/credentials.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";

type Arena = Awaited<ReturnType<Parameters<typeof participantJudgingChecks>[1]["newRound"]>> & {ca?:string|undefined};
type Context = Parameters<typeof participantJudgingChecks>[1] & {startRace(round:string):Promise<Arena>};
export async function shopChecks(t:TestContext,c:Context) {
  const shop=createShopService(c.api,c.clock), query=async(sql:string,args:unknown[]=[]) => (await c.owner.query(sql,args)).rows;
  let a:Arena;
  const purchase=async(cookie:string,item:string,target:string|null=null,key=randomUUID()) => {
    await c.budgets(); return await shop.command(cookie,a.round,key,"SHOP_PURCHASE",{item_id:item,target_id:target}) as any;
  };
  const activate=async(cookie:string,purchase:string,bounty=a.x,key=randomUUID()) => {
    await c.budgets(); return await shop.command(cookie,a.round,key,"SHOP_ACTIVATE",{purchase_id:purchase,bounty_id:bounty}) as any;
  };
  async function submit(cookie:string,bounty:string,verdict="PASSED") {
    await c.budgets();
    const member=(await query("SELECT member_round_id FROM participant_sessions WHERE id=$1",[parseProof(cookie)!.id]))[0].member_round_id;
    const latest=(await query("SELECT max(created_at) at FROM participant_judging WHERE member_round_id=$1 AND lane='OFFICIAL'",[member]))[0].at as Date|null;
    if(latest) await delay(Math.max(0,latest.getTime()+5010-Date.now()));
    await c.judge.claim();
    const receipt=await c.service.submit(cookie,a.round,bounty,"Synthetic shop test fix",randomUUID());
    assert.equal(receipt.result.status,"ADMITTED",JSON.stringify(receipt));
    c.answers.set(receipt.result.submission_id as string,verdict);
    return receipt.result.submission_id as string;
  }
  async function settle(ids:string[]) {
    const deadline=Date.now()+25000;
    while((await query("SELECT count(*)::int n FROM competition_assessments WHERE submission_id=ANY($1::uuid[])",[ids]))[0].n<ids.length) {
      assert.ok(Date.now()<deadline,"Synthetic shop judging timed out");
      const result=await c.judge.tick(); if(result==='IDLE'||result==='PENDING')await delay(50);
    }
  }
  async function funded() {
    const round=await c.newRound(); a=round;
    const bugs=(await query("SELECT id FROM bounties WHERE round_id=$1 ORDER BY position",[round.round])).map(b=>b.id as string);
    for(let i=0;i<bugs.length;i++) {
      const ids=[];
      for(const cookie of [round.aa,round.ba,(round as Arena).ca!])ids.push(await submit(cookie,bugs[i]!));
      await settle(ids);
    }
    const unused=await query("SELECT id,encode(fingerprint,'hex') fingerprint FROM validation_snapshots WHERE round_type=2 AND NOT EXISTS(SELECT 1 FROM bounties WHERE snapshot_id=validation_snapshots.id)");
    for(const snap of unused){
      const variants=await query("SELECT language,encode(sha256(starter_code),'hex') hash FROM validation_snapshot_variants WHERE snapshot_id=$1 AND language<>'javascript'",[snap.id]);
      const bindings=variants.map(v=>({snapshot_id:snap.id,language:v.language,snapshot_fingerprint:snap.fingerprint,starter_sha256:v.hash,
        data:{probe:{input:'10 8\n',output:'18\n'},scanner:{label:'Accumulator update',text:'Inspect how the accumulator changes inside this phase.',from_line:2,to_line:5}}}));
      await t.test('private clue installation refuses wrong hashes and reused judging inputs, commits atomically and is immutable/idempotent',async()=>{
        const first=bindings[0]!;
        await assert.rejects(installShopIntel(c.api,bindings),/owner/);
        await assert.rejects(installShopIntel(c.owner,[{...first,starter_sha256:'0'.repeat(64)}]),/matching frozen/);
        const input=(await query("SELECT convert_from(input_data,'UTF8') input FROM validation_snapshot_cases WHERE snapshot_id=$1 ORDER BY position LIMIT 1",[snap.id]))[0].input;
        await assert.rejects(installShopIntel(c.owner,[{...first,data:{...first.data,probe:{input,output:'12\n'}}}]),/separate bounded/);
        assert.equal((await query('SELECT count(*)::int n FROM shop_snapshot_intel WHERE snapshot_id=$1',[snap.id]))[0].n,0);
        assert.equal((await installShopIntel(c.owner,bindings)).inserted,4);
        assert.equal((await installShopIntel(c.owner,bindings)).inserted,0);
        await assert.rejects(installShopIntel(c.owner,[{...first,data:{...first.data,scanner:{...first.data.scanner,text:'different reviewed text'}}}]),/immutable/);
      });
    }
    a=await c.startRace(round.round);
    assert.ok(a.ca);
    assert.equal((await shop.view(a.aa,a.round)).wallet,29000);
    return a;
  }
  const view=(cookie=a.aa)=>shop.view(cookie,a.round);
  const control=async(action:"PAUSE"|"RESUME"|"CLOSE"|"FINALISE",payload:Record<string,unknown>={})=>{
    await c.budgets(); return c.service.command(c.staff.sessionCookie,{action,roundId:a.round,requestKey:randomUUID(),expectedRevision:(await query("SELECT revision FROM rounds WHERE id=$1",[a.round]))[0].revision,
      payload,reason:"Synthetic shop timing",ownCode:c.staff.code});
  };
  await funded();
  await t.test("shop refuses direct table writes and foreign scope; purchases survive service restart and exact receipt recovery",async()=>{
    await assert.rejects(c.api.query("INSERT INTO shop_purchases VALUES(gen_random_uuid(),$1,$2,'overdrive-core',500,gen_random_uuid(),now())",[a.round,(await query("SELECT team_round_id FROM member_rounds WHERE id=(SELECT member_round_id FROM participant_sessions WHERE id=$1)",[parseProof(a.aa)!.id]))[0].team_round_id]),{code:'42501'});
    await assert.rejects(c.api.query("SELECT * FROM shop_snapshot_intel"),{code:'42501'});
    const key=randomUUID(),result=await purchase(a.aa,"overdrive-core",null,key);
    assert.equal(result.result.status,"PURCHASED");
    assert.deepEqual(await purchase(a.aa,"overdrive-core",null,key),result);
    await assert.rejects(purchase(a.aa,"ghost-scan",null,key),{code:'P0002'});
    const restarted=createShopService(c.api,c.clock);
    assert.equal((await restarted.view(a.ab,a.round)).wallet,28500);
    assert.equal((await restarted.view(a.ab,a.round)).overdrive,true);
    assert.deepEqual(await restarted.outcome(a.aa,a.round,key),result);
    assert.equal(await restarted.outcome(a.ba,a.round,key),null);
    await assert.rejects(purchase(a.aa,"black-ice",randomUUID()));
  });
  await t.test("simultaneous teammates can acquire a once-per-round item only once and cannot overspend",async()=>{
    await c.budgets();
    const bought=await Promise.all([purchase(a.aa,"chrono-shield"),purchase(a.ab,"chrono-shield")]);
    assert.deepEqual(bought.map(x=>x.result.status).sort(),['PURCHASED','REJECTED']);
    assert.equal((await view()).wallet,26000);
    const owner=(await query("SELECT team_round_id FROM member_rounds WHERE id=(SELECT member_round_id FROM participant_sessions WHERE id=$1)",[parseProof(a.aa)!.id]))[0].team_round_id;
    const before=(await view()).wallet;
    await Promise.all(Array.from({length:3},(_,i)=>purchase(i%2?a.ab:a.aa,"claim-lock")));
    assert.equal((await view()).wallet,before-5000);
    assert.equal((await query("SELECT count(*)::int n FROM shop_purchases WHERE team_round_id=$1 AND item_id='claim-lock'",[owner]))[0].n,1);
  });
  await t.test("paid intelligence stays private until activation, is shared in each teammate's language and freezes assistance at admission",async()=>{
    const empty=await shop.intel(a.aa,a.round,a.x) as any;
    assert.equal(empty.assistance_tier,0);assert.equal(empty.scanner,undefined);assert.equal(empty.probe,undefined);
    const scanner=await purchase(a.aa,'hex-scanner');assert.equal(scanner.result.status,'PURCHASED');
    assert.equal((await shop.intel(a.aa,a.round,a.x) as any).scanner,undefined);
    const before=(await view()).wallet;
    const activations=await Promise.all([activate(a.aa,scanner.result.purchase_id),activate(a.ab,scanner.result.purchase_id)]);
    assert.deepEqual(activations.map(x=>x.result.status).sort(),['ACTIVATED','REJECTED']);
    assert.equal((await view()).wallet,before);
    for(const cookie of [a.aa,a.ab]){
      const intel=await shop.intel(cookie,a.round,a.x) as any;
      assert.equal(intel.assistance_tier,2);assert.equal(intel.scanner.label,'Accumulator update');
      assert.equal(intel.scanner.source.split('\n').length,4);assert.ok(!JSON.stringify(intel).includes('synthetic reference'));
    }
    assert.equal((await shop.intel(a.ba,a.round,a.x) as any).scanner,undefined);
    const duplicate=await purchase(a.aa,'hex-scanner');
    assert.equal((await activate(a.ab,duplicate.result.purchase_id)).result.reason,'ALREADY_APPLIED');
    assert.equal((await view()).purchases.find(p=>p.id===duplicate.result.purchase_id)!.activated_at,null);
    const probe=await purchase(a.aa,'boundary-probe');await activate(a.ab,probe.result.purchase_id);
    assert.equal((await shop.intel(a.ab,a.round,a.x) as any).assistance_tier,2);
    assert.equal((await shop.intel(a.ab,a.round,a.x) as any).probe.input,'10 8\n');
  });
  await t.test("Ghost Scan uses live rival activity across language variants, excludes its own team and preserves cooldown on recovery",async()=>{
    const key=randomUUID(),receipt=await purchase(a.aa,'ghost-scan',null,key);
    assert.equal(receipt.result.status,'PURCHASED');assert.ok((await view()).clear_bounty_ids.includes(a.x));
    const live=createLiveService(c.api,c.clock,c.delivery);
    const presence=async(cookie:string,connection:string,bounty:string|null)=>live.guarded({audience:'PARTICIPANT',cookie,roundId:a.round},context=>live.recordPresence(context,connection,bounty));
    await presence(a.aa,'own-editor',a.x);assert.ok((await view()).clear_bounty_ids.includes(a.x));
    await presence(a.ba,'rival-one',a.x);assert.ok(!(await view()).clear_bounty_ids.includes(a.x));
    await presence(a.bb,'rival-two',a.x);await presence(a.ba,'rival-one',null);
    assert.ok(!(await view()).clear_bounty_ids.includes(a.x));
    await presence(a.bb,'rival-two',null);assert.ok((await view()).clear_bounty_ids.includes(a.x));
    const run=await c.service.run(a.ba,a.round,a.y,'pending rival sample',randomUUID());
    assert.equal(run.result.status,'ADMITTED');assert.ok(!(await view()).clear_bounty_ids.includes(a.y));
    c.answers.set(run.result.run_id as string,'PASSED');
    for(let i=0;i<80;i++) {await c.judge.tick();if((await query('SELECT completed_at FROM participant_judging WHERE id=$1',[run.result.run_id]))[0].completed_at)break;}
    assert.ok((await view()).clear_bounty_ids.includes(a.y));
    const end=(await view()).ghost_until;
    assert.deepEqual(await purchase(a.aa,'ghost-scan',null,key),receipt);
    assert.equal((await view()).ghost_until,end);
    assert.equal((await purchase(a.ab,'ghost-scan')).result.reason,'SCAN_COOLDOWN');
  });
  await t.test("real browsers share permanent team inventory and display paid clues after activation and reload",async()=>{
    await withBrowserApp({pool:c.api,clock:c.clock,delivery:c.delivery,competition:c.deps},async(browser,origin,policy)=>{
      const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})]);
      const errors:string[]=[];
      try{
        const pages=[];
        for(const [i,cookie] of [a.aa,a.ab].entries()){
          await contexts[i]!.addCookies([{name:policy.names.participant,value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
          const page=await contexts[i]!.newPage();page.on('pageerror',error=>errors.push(error.message));pages.push(page);await page.goto(origin);
          await expect(page.getByText('STATE VERIFIED',{exact:true})).toBeVisible({timeout:15000});
        }
        const [buyer,mate]=pages as [typeof pages[number],typeof pages[number]];
        await buyer.getByRole('button',{name:'Black Market',exact:true}).click();
        const before=(await view()).wallet;
        await buyer.locator('[data-item="boundary-probe"]').getByRole('button',{name:'Buy & hold',exact:true}).click();
        await buyer.getByRole('button',{name:'Confirm purchase',exact:true}).click();
        await expect(buyer.locator('.shop-notice')).toContainText('inventory');
        await expect.poll(async()=>(await view(a.ab)).wallet).toBe(before-400);
        await mate.getByRole('button',{name:'Black Market',exact:true}).click();
        await expect(mate.locator('.shop-inventory')).toContainText('Held');
        await mate.getByRole('button',{name:'Close dialog',exact:true}).click();
        await mate.locator(`button.target[data-bounty-id="${a.y}"]`).click();
        await mate.getByRole('button',{name:'Open question',exact:true}).click();
        await expect(mate.getByRole('region',{name:'Use held items'})).toBeVisible();
        await mate.getByRole('region',{name:'Use held items'}).getByRole('button',{name:/Boundary Probe/}).click();
        await mate.getByRole('button',{name:'Confirm use',exact:true}).click();
        await expect(mate.getByRole('region',{name:'Purchased gear intelligence'})).toContainText('Boundary Probe');
        await mate.reload();await expect(mate.getByText('STATE VERIFIED',{exact:true})).toBeVisible({timeout:15000});
        await mate.locator(`button.target[data-bounty-id="${a.y}"]`).click();
        await mate.getByRole('button',{name:'Open question',exact:true}).click();
        await expect(mate.getByRole('region',{name:'Purchased gear intelligence'})).toContainText('Boundary Probe');
        assert.deepEqual(errors,[]);
      }finally{for(const context of contexts)await context.close();}
    });
  });
  await t.test("Claim Lock is shared inventory, activates once, and protected and ordinary awards coexist without duplicate team rewards",async()=>{
    const held=(await view()).purchases.find(p=>p.item_id==='claim-lock')!;
    assert.equal(held.activated_at,null);
    assert.equal((await view()).claim,null);
    const both=await Promise.all([activate(a.aa,held.id),activate(a.ab,held.id)]);
    assert.deepEqual(both.map(x=>x.result.status).sort(),['ACTIVATED','REJECTED']);
    const protectedId=await submit(a.aa,a.x);
    await settle([protectedId]);
    assert.equal((await query("SELECT protected FROM bounty_awards WHERE submission_id=$1",[protectedId]))[0].protected,true);
    assert.equal((await query("SELECT hint_tier FROM competition_submissions WHERE id=$1",[protectedId]))[0].hint_tier,2);
    assert.equal((await query("SELECT points FROM bounty_awards WHERE submission_id=$1",[protectedId]))[0].points,665);
    assert.equal((await createWorkbenchService(c.api,c.clock).metadata(a.ba,a.round,a.x)).writable,true);
    const rival=await submit(a.ba,a.x);await settle([rival]);
    const awards=await query("SELECT protected FROM bounty_awards WHERE bounty_id=$1 ORDER BY protected",[a.x]);
    assert.deepEqual(awards.map(x=>x.protected),[false,true]);
    assert.equal((await c.service.submit(a.ab,a.round,a.x,'duplicate',randomUUID())).result.reason,'BOUNTY_UNAVAILABLE');
    const live=createLiveService(c.api,c.clock,c.delivery);
    const state=await live.guarded({audience:'PARTICIPANT',cookie:a.ab,roundId:a.round},live.snapshot);
    assert.equal(state.shop?.overdrive,true);
    assert.equal(state.standings.find(row=>row.team_round_id===state.actor.team_round_id)?.overdrive,true);
  });
  await t.test("Chrono Shield attaches to the next admitted official attempt, survives a restart, and only suppresses that attempt's penalty",async()=>{
    // The preceding protected correct attempt consumed the shield, even though it needed no penalty waiver.
    assert.equal((await view()).shield_armed,false);
    const wrong=await submit(a.ab,a.y,'WRONG_ANSWER');await settle([wrong]);
    assert.equal((await query("SELECT count(*)::int n FROM wrong_submission_penalties WHERE submission_id=$1",[wrong]))[0].n,1);
    const shield=await purchase(a.ba,'chrono-shield');assert.equal(shield.result.status,'PURCHASED');
    const shielded=await submit(a.ba,a.y,'COMPILATION_ERROR');await settle([shielded]);
    assert.equal((await query("SELECT count(*)::int n FROM wrong_submission_penalties WHERE submission_id=$1",[shielded]))[0].n,0);
    assert.equal((await view(a.bb)).shield_armed,false);
  });
  await t.test("competing attackers can freeze a team once; frozen teammates cannot buy hints or items but can activate held inventory and run code",async()=>{
    const probe=await purchase(a.ba,'claim-lock');assert.equal(probe.result.status,'PURCHASED');
    await c.budgets();assert.equal((await c.service.buyHint(a.ba,a.round,a.y,1,randomUUID())).result.status,'PURCHASED');
    const target=(await query('SELECT m.team_round_id FROM member_rounds m JOIN participant_sessions s ON s.member_round_id=m.id WHERE s.id=$1',[parseProof(a.ba)!.id]))[0].team_round_id;
    const victim=(await query("SELECT s.id FROM participant_sessions s JOIN member_rounds m ON m.id=s.member_round_id WHERE m.team_round_id=$1",[target])).map(r=>r.id);
    assert.ok(victim.includes(parseProof(a.ba)!.id),'fixture target is second team');
    const outcomes=await Promise.all([purchase(a.aa,'black-ice',target),purchase(a.ca!,'black-ice',target)]);
    assert.deepEqual(outcomes.map(x=>x.result.status).sort(),['PURCHASED','REJECTED']);
    assert.equal((await purchase(a.bb,'boundary-probe')).result.reason,'CREDIT_FROZEN');
    assert.equal((await c.service.buyHint(a.ba,a.round,a.y,2,randomUUID())).result.reason,'CREDIT_FROZEN');
    assert.equal((await activate(a.bb,probe.result.purchase_id,a.y)).result.status,'ACTIVATED');
    assert.equal((await c.service.hints(a.bb,a.round,a.y)).length,1);
    const run=await c.service.run(a.ba,a.round,a.y,'sample during freeze',randomUUID());
    assert.equal(run.result.status,'ADMITTED');c.answers.set(run.result.run_id as string,'PASSED');
    for(let i=0;i<40;i++){await c.judge.tick();if((await query("SELECT completed_at FROM participant_judging WHERE id=$1",[run.result.run_id]))[0].completed_at)break;}
    assert.ok((await view(a.ba)).frozen_until);
  });
  await t.test("global technical breaks freeze item clocks; a team/member pause does not extend an economic effect",async()=>{
    const before=await view(a.ba),ms=Date.parse(before.frozen_until!)-Date.parse(before.server_time);
    await control('PAUSE',{scope:'GLOBAL',target:null});
    const first=await view(a.ba);await delay(120);const second=await view(a.ba);
    assert.equal(first.timers_paused,true);assert.equal(second.timers_paused,true);
    assert.ok(Math.abs((Date.parse(first.frozen_until!)-Date.parse(first.server_time))-(Date.parse(second.frozen_until!)-Date.parse(second.server_time)))<=2);
    assert.equal((await purchase(a.aa,'ghost-scan')).result.reason,'PAUSED');
    await control('RESUME',{scope:'GLOBAL',target:null});
    assert.ok(Date.parse((await view(a.ba)).frozen_until!)-Date.now()<=ms);
    const target=(await query('SELECT m.team_round_id,m.id member FROM member_rounds m JOIN participant_sessions s ON s.member_round_id=m.id WHERE s.id=$1',[parseProof(a.ba)!.id]))[0];
    for(const [scope,id] of [['TEAM',target.team_round_id],['MEMBER',target.member]]){
      await control('PAUSE',{scope,target:id});
      const start=await view(a.ba);await delay(100);const end=await view(a.ba);
      assert.equal(start.timers_paused,false);
      assert.ok((Date.parse(start.frozen_until!)-Date.parse(start.server_time))-(Date.parse(end.frozen_until!)-Date.parse(end.server_time))>=80);
      assert.equal((await purchase(a.ba,'boundary-probe')).result.reason,'PAUSED');
      await control('RESUME',{scope,target:id});
    }
  });
  await t.test("protected eligibility has an exact five-minute cutoff and maintenance emits each expiry only once",async()=>{
    const target=(await query('SELECT m.team_round_id FROM member_rounds m JOIN participant_sessions s ON s.member_round_id=m.id WHERE s.id=$1',[parseProof(a.ba)!.id]))[0].team_round_id;
    const activation=(await query("SELECT * FROM shop_activations WHERE team_round_id=$1 AND item_id='claim-lock'",[target]))[0];
    const pauses=(await query("SELECT coalesce(sum(extract(epoch from (ended_at-started_at))*1000),0)::text ms FROM competition_pauses WHERE round_id=$1 AND scope='GLOBAL' AND started_at>=$2",[a.round,activation.activated_at]))[0].ms;
    const end=new Date(activation.activated_at.getTime()+300000+Number(pauses));
    const observed=await query('SELECT shop_protection($1,$2,$3) before,shop_protection($1,$2,$4) after',
      [target,a.y,new Date(end.getTime()-1),end]);
    assert.equal(observed[0].before,activation.id);assert.equal(observed[0].after,null);
    const later=new Date(Date.now()+1900000);
    await query('SELECT shop_expire($1,$2)',[a.round,later]);
    const notices=(await query('SELECT * FROM shop_expiry_notices ORDER BY activation_id,kind'));
    assert.ok(notices.length>=4);
    const heads=(await query('SELECT id,head FROM live_streams ORDER BY id'));
    await query('SELECT shop_expire($1,$2)',[a.round,later]);
    assert.deepEqual(await query('SELECT * FROM shop_expiry_notices ORDER BY activation_id,kind'),notices);
    assert.deepEqual(await query('SELECT id,head FROM live_streams ORDER BY id'),heads);
    assert.equal((await query('SELECT shop_frozen($1,$2) value',[target,later]))[0].value,false);
  });
  await t.test("shop HTTP requires participant authority, strict fields and CSRF; receipt lookup never repeats a purchase",async()=>{
    const browser={mode:'production' as const,origin:'https://ingenium.test',cookieKey:randomBytes(32),csrfKey:randomBytes(32)},policy=browserPolicy(browser);
    const app=buildApp({database:{check:async()=>{},close:async()=>{}},entry:{pool:c.api,clock:c.clock,delivery:c.delivery,browser,competition:c.deps}});
    await app.ready();const cookies=new Map<string,string>();
    const base=`/api/v1/competition/rounds/${a.round}/shop`;
    const send=async(url:string,body?:unknown,token?:string)=>{
      const response=await app.inject({method:body===undefined?'GET':'POST',url,headers:{origin:browser.origin,
        cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(token?{'x-csrf-token':token}:{})},...(body===undefined?{}:{payload:body as never})});
      const lines=response.headers['set-cookie'];for(const line of typeof lines==='string'?[lines]:lines??[]){const pair=line.split(';')[0]!,i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
      return response;
    };
    try{
      await send('/api/v1/bootstrap?audience=ANONYMOUS');
      assert.notEqual((await send(base)).statusCode,200);
      cookies.set(policy.names.participant,a.ca!);
      const token=(await send('/api/v1/bootstrap?audience=PARTICIPANT')).json().data.csrf_token;
      const key=randomUUID(),body={request_key:key,item_id:'boundary-probe',target_id:null};
      assert.equal((await send(base+'/purchases',body)).statusCode,403);
      assert.equal((await send(base+'/purchases',{...body,price:1},token)).statusCode,400);
      const made=await send(base+'/purchases',body,token);assert.equal(made.statusCode,200,made.body);
      const read=await send(base);assert.equal(read.statusCode,200,read.body);assert.equal(read.headers['cache-control'],'no-store');
      assert.equal(read.json().data.preview,false);assert.ok(!read.body.includes('synthetic reference'));
      assert.deepEqual((await send(base+'/outcomes/'+key)).json().data,made.json().data);
      assert.deepEqual((await send(base+'/purchases',body,token)).json().data,made.json().data);
      const intel=await send(base+'/intel/'+a.y);assert.equal(intel.statusCode,200,intel.body);assert.equal(intel.json().data.scanner,undefined);
    }finally{await app.close();}
  });
  await t.test("a protected team can submit after a rival claim, while the rival keeps its normal award",async()=>{
    const ordinary=await submit(a.ca!,a.y);await settle([ordinary]);
    const metadata=await createWorkbenchService(c.api,c.clock).metadata(a.ba,a.round,a.y);
    assert.equal(metadata.writable,true);assert.equal(metadata.claimed,false);
    const protectedId=await submit(a.ba,a.y);await settle([protectedId]);
    assert.equal((await query('SELECT protected FROM bounty_awards WHERE submission_id=$1',[protectedId]))[0].protected,true);
    assert.equal((await query('SELECT count(*)::int n FROM bounty_awards WHERE bounty_id=$1',[a.y]))[0].n,2);
    assert.equal((await query('SELECT count(*)::int n FROM bounty_awards WHERE bounty_id=$1 AND NOT protected',[a.y]))[0].n,1);
    const effect=(await query('SELECT protection_id FROM shop_submission_effects WHERE submission_id=$1',[protectedId]))[0];
    assert.ok(effect.protection_id);
    await assert.rejects(c.api.query('UPDATE shop_submission_effects SET protection_id=NULL WHERE submission_id=$1',[protectedId]),{code:'42501'});
    await assert.rejects(c.owner.query('UPDATE shop_submission_effects SET protection_id=NULL WHERE submission_id=$1',[protectedId]),/immutable/);
  });
  await t.test("simultaneous different purchases share committed funds and never create a negative balance",async()=>{
    while((await view(a.ca!)).wallet>=1500)assert.equal((await purchase(a.ca!,'boundary-probe')).result.status,'PURCHASED');
    const before=(await view(a.ca!)).wallet;assert.ok(before>=750&&before<1500);
    const attempts=await Promise.all([purchase(a.ca!,'hex-scanner'),purchase(a.ca!,'hex-scanner')]);
    assert.deepEqual(attempts.map(x=>x.result.status).sort(),['PURCHASED','REJECTED']);
    assert.equal(attempts.find(x=>x.result.status==='REJECTED').result.reason,'INSUFFICIENT_FUNDS');
    assert.equal((await view(a.ca!)).wallet,before-750);
  });
  await t.test("closed rounds refuse fresh purchases but retain original outcomes and paid intelligence",async()=>{
    const key=randomUUID(),original=await purchase(a.aa,'boundary-probe',null,key);
    await control('CLOSE');
    assert.equal((await purchase(a.aa,'boundary-probe')).result.reason,'ROUND_CLOSED');
    assert.deepEqual(await purchase(a.aa,'boundary-probe',null,key),original);
    assert.equal((await shop.intel(a.ab,a.round,a.x) as any).assistance_tier,2);
    await control('FINALISE');
    assert.equal((await c.service.standings(c.staff.sessionCookie,a.round,'STAFF')).final,true);
  });
}
