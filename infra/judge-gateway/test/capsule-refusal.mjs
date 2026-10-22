import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
assert.equal(process.pid, 1);
const child = spawn("/usr/local/bin/node", ["-e", "process.stdout.write('ready');setInterval(()=>{},1000)"], { stdio: ["ignore", "pipe", "ignore"], env: { PATH: "/usr/local/bin:/usr/bin:/bin" } });
await once(child.stdout, "data");
process.stdout.write("TRUSTED_CHILD_STARTED\n");
process.argv[1] = "/workspace/apps/api/dist/judge/capsule-cli.js";
await import("/workspace/apps/api/dist/judge/capsule-cli.js");
