import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createJudgeExecutionWorker } from "../src/judge/execution-worker.js";
import type { createJudgeSupervisorStore } from "../src/judge/registry.js";
import type { createJudgeQueue } from "../src/judge/queue.js";
import type { TrustedProtectedExecutor } from "../src/judge/executor.js";
import { judgePayload,judgeRuntimes } from "./fixtures/judge.js";

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test("a worker reserves its active identity before its committed claim becomes visible to recovery",async()=>{
  const payload=judgePayload(),bootId=randomUUID(),provider=randomUUID(),binding={hostEpochId:payload.hostEpochId,bootId,runtimes:judgeRuntimes()};
  const committed=deferred<void>(),release=deferred<void>(),controller=new AbortController();
  const store={...binding,async deliveryState(){return 'PREPARED';},async claim(){committed.resolve();await release.promise;return null;}} as unknown as ReturnType<typeof createJudgeSupervisorStore>;
  const queue={...binding,async receive(){return {id:'1-0',attempt_id:payload.attemptId,provider_token:provider};}} as unknown as ReturnType<typeof createJudgeQueue>;
  const executor={...binding,async assertReady(){},async exchange(){throw new Error('No launch is allowed in this fixture');}} as unknown as TrustedProtectedExecutor;
  const worker=createJudgeExecutionWorker(store,queue,executor),running=worker.run(controller.signal);
  try{await committed.promise;assert.equal(worker.activeAttempt,payload.attemptId);}
  finally{release.resolve();await running;}
  assert.equal(worker.activeAttempt,null);
});
test("recovery marks its attempt active while loading the original execution binding",async()=>{
  const payload=judgePayload(),binding={hostEpochId:payload.hostEpochId,bootId:randomUUID(),runtimes:judgeRuntimes()},loading=deferred<void>(),release=deferred<void>();
  const store={...binding,async execution(){loading.resolve();await release.promise;return null;}} as unknown as ReturnType<typeof createJudgeSupervisorStore>;
  const worker=createJudgeExecutionWorker(store,binding as unknown as ReturnType<typeof createJudgeQueue>,binding as unknown as TrustedProtectedExecutor);
  const running=worker.recover(payload.attemptId,new AbortController().signal);
  try{await loading.promise;assert.equal(worker.activeAttempt,payload.attemptId);}
  finally{release.resolve();await running;}
  assert.equal(worker.activeAttempt,null);
});
