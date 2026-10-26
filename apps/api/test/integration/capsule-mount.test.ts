import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";
import { capsuleReference } from "../../src/judge/capsule-lifecycle.js";
import { capsuleCreateArguments } from "../../src/judge/docker-capsule.js";
import { createExecutionPlan } from "../../src/judge/execution-plan.js";
import { judgePayload,judgeRuntimes } from "../fixtures/judge.js";

test("actual Docker CLI parses combined CPU controller mount paths before contacting an intentionally unavailable daemon",{timeout:30000},async()=>{
  const exec=promisify(execFile),nonce=randomUUID(),name=`ingenium-mount-parse-${nonce}`;
  const image="docker.io/library/node:24.22.0-trixie@sha256:a3e43f3f15bea8c59c689afeebe63c945885677ae469ae8d12578567ef18f1df";
  const ref=capsuleReference(createExecutionPlan({payload:judgePayload(),owner:randomUUID(),providerToken:randomUUID()},judgeRuntimes()),
    {version:1,nonce,image_id:`sha256:${"1".repeat(64)}`,release_sha256:"2".repeat(64)});
  const args=capsuleCreateArguments(ref),mounts=args.filter((value,i)=>args[i-1]==="--mount"&&value.includes("cpu,cpuacct"));assert.equal(mounts.length,2);
  for(const mount of mounts){
    await assert.rejects(exec("docker",["--host","tcp://127.0.0.1:1","create","--pull=never","--name",name,"--label",`ingenium.mount-parse=${nonce}`,"--network","none","--read-only","--user","65534:65534",
      "--cap-drop","ALL","--security-opt","no-new-privileges=true","--memory","32m","--memory-swap","32m","--pids-limit","4","--log-driver","none",
      "--mount",mount,"--entrypoint","/usr/bin/false",image],{timeout:10000,maxBuffer:16384,windowsHide:true,env:{...process.env,DOCKER_API_VERSION:"1.56"}}),error=>{
      assert.equal((error as any).stdout,"");assert.match((error as any).stderr,/127\.0\.0\.1:1/);assert.doesNotMatch((error as any).stderr,/invalid (?:argument|field)/);return true;
    });
  }
  const absent=await exec("docker",["container","ls","--all","--filter",`name=^/${name}$`,"--format","{{.ID}}"],{timeout:10000,windowsHide:true});assert.equal(absent.stdout,"");
});
