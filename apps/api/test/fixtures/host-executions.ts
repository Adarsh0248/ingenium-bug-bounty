import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
import { LANGUAGES,sha256 } from "../../src/access/credentials.js";
import { acceptAuthoringObservation,authoringPayloadDigest } from "../../src/content/execution-policy.js";
import type { AuthoringPayload } from "../../src/content/execution-policy.js";
import { acceptJudgeReply } from "../../src/content/judge-protocol.js";
import { acceptExecutionReply,createProtectedExecutorClient,executionRequest } from "../../src/judge/executor.js";
import type { parseHostRuntime } from "../../src/judge/host-config.js";
import { createJudgeRegistry,createJudgeSupervisorStore } from "../../src/judge/registry.js";
import { openSupervisorSession } from "../../src/judge/supervisor.js";
const root="/opt/ingenium/judge-executor";
export const FIXED_HOST_SOURCES={
  c:'#include <stdio.h>\n#include <unistd.h>\nint main(void){long long a,b;if(getuid()!=60000||getgid()!=60000)return 23;if(scanf("%lld%lld",&a,&b)!=2)return 2;printf("%lld\\n",a+b);}\n',
  cpp:'#include <iostream>\n#include <unistd.h>\nint main(){if(getuid()!=60000||getgid()!=60000)return 23;long long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}\n',
  java:'public class Main{public static void main(String[]a)throws Exception{String[]s=new String(System.in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).trim().split("\\\\s+");System.out.println(Long.parseLong(s[0])+Long.parseLong(s[1]));}}\n',
  python:'import os,sys\nassert os.getuid()==60000 and os.getgid()==60000\na,b=map(int,sys.stdin.buffer.read().split());print(a+b)\n',
  javascript:'if(process.getuid()!==60000||process.getgid()!==60000)process.exit(23);const[a,b]=require("node:fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a+b);\n',
};
export async function runFixedHostExecutions(parsed:ReturnType<typeof parseHostRuntime>,ingress:Pool,runner:Pool,proofDigest:string,
  save:(name:string,value:unknown)=>Promise<void>,progress:(stage:string)=>void){
  return runHostExecutionCases(parsed,ingress,runner,proofDigest,LANGUAGES.map(language=>({id:language,language,source:FIXED_HOST_SOURCES[language],result:"PASSED"})),save,progress);
}
export interface HostExecutionCase { id:string; language:typeof LANGUAGES[number]; source:string; result:string; cpuMs?:number; wallMs?:number; memoryKb?:number; }
export async function runHostExecutionCases(parsed:ReturnType<typeof parseHostRuntime>,ingress:Pool,runner:Pool,proofDigest:string,cases:readonly HostExecutionCase[],
  save:(name:string,value:unknown)=>Promise<void>,progress:(stage:string)=>void){
  const registry=createJudgeRegistry(ingress,parsed),supervisor=createJudgeSupervisorStore(runner,parsed),runtimes=Object.fromEntries(parsed.runtimes);
  const epoch=parsed.hostEpochId;
  const executor=createProtectedExecutorClient({...parsed,launcherSha256:sha256(await readFile(`${root}/launch`)).toString("hex")});
  const session=await openSupervisorSession(runner,parsed);
  try{
  assert.equal(await registry.ready(),false);
  const results=[];
  for(const item of cases){
    const {language,id}=item;assert.match(id,/^[a-z][a-z0-9-]{0,63}$/);
    progress(`${id}-readiness`);const proof=await executor.readiness(AbortSignal.timeout(5000));assert.equal(proof.toString("hex"),proofDigest);
    await session.heartbeat(proof,AbortSignal.timeout(5000));assert.equal(await registry.ready(),true);
    const p:AuthoringPayload={attemptId:randomUUID(),hostEpochId:epoch,runId:randomUUID(),checkId:randomUUID(),language,runtimeKey:runtimes[language]!.key,runtimeDigest:runtimes[language]!.digest,
    sourceRole:"REFERENCE",checkType:"TEST_CASE",source:Buffer.from(item.source),stdin:Buffer.from("7 5\n"),cpuMs:item.cpuMs??2000,wallMs:item.wallMs??10000,memoryKb:item.memoryKb??524288};
    await save(`${id}-intent`,{attempt_id:p.attemptId,payload_digest:authoringPayloadDigest(p).toString("hex")});
    progress(`${id}-admission`);const token=(await registry.admit(p,randomUUID())).value.provider_token as string;
    assert.equal((await registry.admit(p,randomUUID())).value.provider_token,token);
    const claim={payload:p,owner:randomUUID(),providerToken:token};await save(`${id}-claim`,{attempt_id:p.attemptId,provider_token:token,owner:claim.owner});
    assert.ok(await supervisor.claim(p.attemptId,token,claim.owner));assert.equal(await supervisor.claim(p.attemptId,token,randomUUID()),null);
    progress(`${id}-execution`);const start=performance.now(),request=executionRequest(claim,parsed.bootId,parsed.runtimes,"EXECUTE");
    // Deliberately lose the first result; recovery must use the original sealed execution.
    await executor.exchange(request,AbortSignal.timeout(80000));
    progress(`${id}-recovery`);const recover=executionRequest(claim,parsed.bootId,parsed.runtimes,"RECOVER");
    const recovered=acceptExecutionReply(await executor.exchange(recover,AbortSignal.timeout(10000)),claim,recover);assert.ok(recovered);
    const duplicate=executionRequest(claim,parsed.bootId,parsed.runtimes,"EXECUTE");
    assert.deepEqual(acceptExecutionReply(await executor.exchange(duplicate,AbortSignal.timeout(10000)),claim,duplicate),recovered);
    const nonce=randomUUID(),observed=await registry.observe(p.attemptId,authoringPayloadDigest(p).toString("hex"),nonce);
    const verdict=acceptAuthoringObservation(p,acceptJudgeReply(observed.value,p,nonce,observed.status),Buffer.from("12\n"),"EXACT_TEXT");
    assert.equal(verdict?.result,item.result);assert.ok(verdict.release);
    if(item.result==="PASSED")assert.equal(verdict.stderr.length,0);
    const record=await supervisor.execution(p.attemptId);assert.ok(record?.started&&record.evidence?.metadata.drain);assert.equal(record.owner,claim.owner);
    const result={id,language,attempt_id:p.attemptId,verdict:verdict.result,cpu_ns:verdict.metadata.cpu_ns,peak_bytes:verdict.metadata.peak_bytes,elapsed_ms:Math.round(performance.now()-start)};
    await save(`${id}-completed`,result);results.push(result);
    console.log(`PASS: ${id} -> ${verdict.result}; real guarded execution, consumed duplicate permit, lost-reply recovery and full cleanup`);
  }
  return results;
  }finally{await session.close();}
}
