import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hostname, release } from "node:os";
import { protectedLinuxFile } from "../../../apps/api/src/judge/isolate-context.js";
import { createHostContextObserver } from "../../../apps/api/src/judge/host-context.js";
import { inspectHostCgroups } from "../../../apps/api/src/judge/host-cgroups.js";
import { observeLoadedAppArmor } from "../../../apps/api/src/judge/loaded-policy.js";
import { observeCheckpointStorage } from "../../../apps/api/src/judge/host-storage.js";

// Rehearsal only: this uses the production readers but cannot issue readiness or touch a registry.
let stage="caller";
try {
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);
  assert.equal(hostname(),"ingenium-judge-verification-01");
  const signal=AbortSignal.timeout(25000), base="/opt/ingenium-host-prerequisites-v1";
  const bootId=(await protectedLinuxFile("/proc/sys/kernel/random/boot_id",128)).toString("ascii").trimEnd();
  const observerSha256=(await protectedLinuxFile(`${base}/observer.sha256`,65)).toString("ascii").trimEnd();
  assert.match(observerSha256,/^[0-9a-f]{64}$/);
  stage="host_context";
  const observer=createHostContextObserver({bootId,kernelRelease:release(),observerSha256});
  const context=await observer.observe(signal);console.log("PASS: production native host-context reader");
  stage="cgroup_roots";const roots=await inspectHostCgroups(bootId);console.log("PASS: production v1 controller reader");
  stage="loaded_policy";
  const compiled=await protectedLinuxFile(`${base}/apparmor.bin`,16777216), hash=createHash("sha256").update(compiled).digest("hex");
  const policy=await observeLoadedAppArmor(hash,signal);console.log("PASS: production loaded AppArmor policy reader");
  stage="checkpoint_storage";const storage=await observeCheckpointStorage(signal);console.log("PASS: production bounded checkpoint-storage reader");
  stage="host_recheck";const second=await observer.observe(signal);
  const stable=({request_id:_nonce,...value}:Readonly<Record<string,unknown>>)=>value;
  assert.deepEqual(stable(context.observation),stable(second.observation));signal.throwIfAborted();
  console.log(JSON.stringify({state:"PREREQUISITES_PASSED",host_verified:false,boot_id:bootId,kernel_release:release(),
    controllers:Object.values(roots).map(root=>root.path),policy,storage}));
} catch {
  console.error(`FAIL: host prerequisite ${stage}; preserve the installation and output.`);process.exitCode=1;
}
