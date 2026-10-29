import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {TestContext} from 'node:test';
import type {Pool} from 'pg';
import {EVENT_LANGUAGES,newAccessCode,sessionDelivery,sha256} from '../../src/access/credentials.js';
import {createEntryService} from '../../src/access/entry-service.js';
import {createStaffService} from '../../src/access/staff-service.js';
import {createContentService} from '../../src/content/service.js';
import {createValidationService} from '../../src/content/validation-service.js';
import {installShopIntel} from '../../src/competition/shop-intel.js';
import type {ShopIntelBinding} from '../../src/competition/shop-intel.js';
import {roundOnePack} from '../../../../content/round-1/load.js';
import {roundTwoPack} from '../../../../content/round-2/load.js';

export async function eventPackChecks(t:TestContext,owner:Pool,api:Pool){
  await t.test('all 150 actual missions freeze through production authoring guards with 600 variants, 450 hints and 400 immutable paid-clue bindings',async()=>{
    const clock={assertHealthy(){},async verify(){},fault(){}},delivery=sessionDelivery('isolated-pack-review',randomBytes(32));
    const entry=createEntryService(api,clock,delivery),staff=createStaffService(api,clock,delivery),content=createContentService(api,clock,delivery),validation=createValidationService(api,clock,delivery);
    const staffId=randomUUID(),code=newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Isolated content reviewer','OWNER')",[staffId]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),staffId,code.verifier]);
    const flow=await entry.begin(code.code,{ip:'127.0.0.1',browserId:randomUUID()});assert.equal(flow.audience,'STAFF');
    const actor=await staff.activate(flow.proofCookie,randomUUID());
    for(const language of EVENT_LANGUAGES)await owner.query("INSERT INTO runtime_manifests(key,language,manifest,digest,created_at) VALUES($1,$2,$3::jsonb,sha256(convert_to($3::jsonb::text,'UTF8')),clock_timestamp())",[`pack-review-${language}`,language,JSON.stringify({synthetic_pack_staging:language})]);
    const edit=async(action:Parameters<typeof content.command>[1]['action'],targetId:string|null,payload:unknown)=>{
      // This disposable authoring setup is not a measured participant load test.
      await owner.query('DELETE FROM quota_buckets');
      const revision=(await owner.query(action==='CREATE'?'SELECT revision FROM catalogue_control WHERE id=1':'SELECT content_revision revision FROM bug_versions WHERE id=$1',action==='CREATE'?[]:[targetId])).rows[0].revision;
      return content.command(actor.sessionCookie,{action,targetId,payload,expectedRevision:revision,requestKey:randomUUID(),reason:'Isolated full event-pack staging; no publication or participant execution'});
    };
    const bindings:ShopIntelBinding[]=[],titles=new Set<string>(),ids=new Set<string>();let checks=0;
    const digests=[];
    for(const pack of [roundOnePack,roundTwoPack]){
      assert.deepEqual(pack.languages,[...EVENT_LANGUAGES]);assert.equal(pack.questions.length,pack.round_type===1?50:100);
      digests.push(sha256(await readFile(new URL(`../../../../content/round-${pack.round_type}/pack.json`,import.meta.url))).toString('hex'));
      for(const question of pack.questions){
        assert.ok(!ids.has(question.id));ids.add(question.id);assert.ok(!titles.has(question.title));titles.add(question.title);
        const version=(await edit('CREATE',null,{round_type:question.round_type,title:question.title,statement:question.statement,difficulty:question.difficulty,category:question.category,checker_mode:question.checker_mode,reward_multiplier:question.round_type===1?5:1})).version_id!;
        for(const language of EVENT_LANGUAGES){const variant=question.variants[language];await edit('VARIANT',version,{language,starter_code:variant.starter_code,reference_solution_code:variant.reference_solution_code,defect_description:variant.defect_description,runtime_key:`pack-review-${language}`,cpu_time_limit_ms:2000,wall_time_limit_ms:10000,memory_limit_kb:524288});}
        const cases=new Map<number,string>();
        for(const testcase of question.cases)cases.set(testcase.position,(await edit('CASE',version,{case_id:null,...testcase})).case_id!);
        for(const hint of question.hints)await edit('HINT',version,hint);
        for(const language of EVENT_LANGUAGES){const witness=question.variants[language].witness_case_position;assert.equal(question.cases.find(c=>c.position===witness)?.visibility,'HIDDEN');await edit('WITNESSES',version,{language,witnesses:[{check_type:'TEST_CASE',test_case_id:cases.get(witness),expected_failure:'WRONG_OUTPUT'}]});}
        const revision=(await owner.query('SELECT content_revision FROM bug_versions WHERE id=$1',[version])).rows[0].content_revision;
        const result=await validation.prepare(actor.sessionCookie,{versionId:version,expectedRevision:revision,requestKey:randomUUID(),reason:'Full actual-pack preparation with no synthetic judge verdicts'});
        assert.ok(result.snapshot_id,JSON.stringify({title:question.title,issues:result.issues}));assert.deepEqual(result.issues,[]);
        const snapshot=(await owner.query("SELECT encode(fingerprint,'hex') fingerprint,(SELECT count(*)::int FROM validation_snapshot_checks WHERE snapshot_id=s.id) checks FROM validation_snapshots s WHERE s.id=$1",[result.snapshot_id])).rows[0];checks+=snapshot.checks;
        if('paid_intel' in question)for(const language of EVENT_LANGUAGES){const scanner=question.paid_intel.scanner[language];bindings.push({snapshot_id:result.snapshot_id,language,snapshot_fingerprint:snapshot.fingerprint,starter_sha256:sha256(question.variants[language].starter_code).toString('hex'),data:{probe:{input:question.paid_intel.probe.input_data,output:question.paid_intel.probe.expected_output},scanner:{...scanner,text:`Inspect the highlighted ${scanner.label.toLowerCase()} section. Follow how its values change before editing it.`}}});}
      }
    }
    assert.equal((await installShopIntel(owner,bindings)).inserted,400);assert.equal((await installShopIntel(owner,bindings)).inserted,0);
    await assert.rejects(api.query('SELECT * FROM shop_snapshot_intel'),{code:'42501'});
    assert.equal((await owner.query('SELECT count(*)::int n FROM bug_versions WHERE publication_status=\'DRAFT\'')).rows[0].n,150);
    assert.equal((await owner.query('SELECT count(*)::int n FROM validation_snapshot_variants')).rows[0].n,600);
    assert.equal((await owner.query('SELECT count(*)::int n FROM validation_snapshot_hints')).rows[0].n,450);
    assert.equal((await owner.query('SELECT count(*)::int n FROM validation_runs')).rows[0].n,0);
    assert.equal((await owner.query('SELECT count(*)::int n FROM bounties')).rows[0].n,0);
    assert.equal(checks,5140);
    console.log(JSON.stringify({scope:'FULL_ACTUAL_PACK_DATABASE_STAGING',questions:150,variants:600,hints:450,planned_checks:checks,paid_clue_bindings:400,pack_sha256:digests,production_judge_validated:false,published:false,event_deployed:false}));
  });
}
