import assert from "node:assert/strict";
import {hostname} from "node:os";
import {inspectRehearsalDatabase,rehearsalDocker} from "../../../apps/api/test/fixtures/host-database.js";
try{
  assert.equal(process.argv.length,2);assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");
  const before=await inspectRehearsalDatabase();assert.equal(before.row.State.Running,false);assert.equal(before.row.State.Pid,0);assert.equal(before.row.State.Status,"exited");
  assert.equal(await rehearsalDocker(["start",before.id]),before.id);
  const after=await inspectRehearsalDatabase();assert.equal(after.id,before.id);assert.equal(after.row.State.Running,true);
  const ports=after.row.NetworkSettings.Ports["5432/tcp"];assert.equal(ports.length,1);assert.equal(ports[0].HostIp,"127.0.0.1");assert.match(ports[0].HostPort,/^[1-9][0-9]{0,4}$/);
  console.log(JSON.stringify({scope:"OWNED_REHEARSAL_DATABASE_RESUMED",container_id:after.id,loopback_port:Number(ports[0].HostPort),no_create_or_migration:true}));
}catch(error){console.error(`FAIL: original database resumption; preserve all records and resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
