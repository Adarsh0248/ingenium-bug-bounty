import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeFaultDiagnostic } from "../src/judge/fault-diagnostic.js";

test("judge fault logs keep only bounded internal locations and safe error codes", () => {
  const fault = new Error("postgres://owner:secret@127.0.0.1/db", { cause: {
    code: "ETIMEDOUT", exit_code: 125, signal: "SIGKILL",
    diagnostic_prefix: "submitted source and password secret\n at /opt/ingenium/judge-executor/app/judge/host-cli.js:42:6",
  } });
  const result = judgeFaultDiagnostic(fault);
  assert.deepEqual(result, { codes: ["ETIMEDOUT"], exit: 125, signal: "SIGKILL", frames: ["/opt/ingenium/judge-executor/app/judge/host-cli.js:42:6"] });
  assert.doesNotMatch(JSON.stringify(result), /secret|password|postgres|submitted/);
  const cycle: { cause?: unknown } = {}; cycle.cause = cycle;
  assert.equal(judgeFaultDiagnostic(cycle).frames.length, 0);
  assert.deepEqual(judgeFaultDiagnostic(null).codes, []);
});

test("nested launcher locations survive a long supervisor wrapper stack", () => {
  const stack = Array.from({ length: 20 }, (_, i) => `/opt/ingenium/service/executor.js:${i + 1}:1`).join("\n");
  const result = judgeFaultDiagnostic({ stack, cause: { diagnostic_prefix: "at /opt/ingenium/judge-executor/app/judge/host-cli.js:42:6" } });
  assert.equal(result.frames.length, 12);
  assert.equal(result.frames.at(-1), "/opt/ingenium/judge-executor/app/judge/host-cli.js:42:6");
});

test("safe host errno survives the stderr boundary without exposing arbitrary child text", () => {
  const result = judgeFaultDiagnostic({ diagnostic_prefix: 'Protected host diagnostic: {"codes":["EINVAL","secret token","EACCES"],"message":"private source"}\n' });
  assert.deepEqual(result.codes, ["EINVAL", "EACCES"]);
  assert.doesNotMatch(JSON.stringify(result), /secret|private|source/);
  assert.deepEqual(judgeFaultDiagnostic({ diagnostic_prefix: 'Protected host diagnostic: {broken}\n' }).codes, []);
});

test("only bounded proc inspection paths and read operations can enter diagnostics", () => {
  assert.deepEqual(judgeFaultDiagnostic({ code: "EACCES", syscall: "stat", path: "/proc/self/fd/18/exe" }).proc,
    [{ syscall: "stat", path: "/proc/self/fd/18/exe" }]);
  assert.equal(judgeFaultDiagnostic({ syscall: "stat", path: "/etc/private-password" }).proc, undefined);
  assert.equal(judgeFaultDiagnostic({ syscall: "write", path: "/proc/self/fd/18/exe" }).proc, undefined);
  const child = 'Protected host diagnostic: {"proc":[{"syscall":"readlink","path":"/proc/self/fd/22/cwd"},{"syscall":"stat","path":"secret source"}]}\n';
  assert.deepEqual(judgeFaultDiagnostic({ diagnostic_prefix: child }).proc, [{ syscall: "readlink", path: "/proc/self/fd/22/cwd" }]);
});
