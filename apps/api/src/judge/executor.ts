import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { sha256, uuid } from "../access/credentials.js";
import type { AuthoringPayload } from "../content/execution-policy.js";
import { authoringPayloadDigest } from "../content/execution-policy.js";
import { acceptJudgeReply, authoringRequest, judgeJson, JUDGE_BODY_LIMIT, readAuthoringRequest, readJudgeJson, runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";

export const EXECUTOR_PROTOCOL = "ingenium-executor-v1";
const LAUNCHER = "/opt/ingenium/judge-executor/launch";
const TIMEOUT_MS = 90000;
export interface ExecutionClaim { payload: AuthoringPayload; owner: string; providerToken: string; }
export interface ExecutorSettings { hostEpochId: string; bootId: string; runtimes: JudgeRuntimes; launcherSha256: string; }
export interface TrustedProtectedExecutor {
  hostEpochId: string; bootId: string; readonly runtimes: JudgeRuntimes;
  assertReady(signal: AbortSignal): Promise<void>;
  exchange(request: ReturnType<typeof executionRequest>, signal: AbortSignal): Promise<unknown>;
}

function exact(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key))) throw new Error("Unusable protected executor reply.");
  return value as Record<string, unknown>;
}
export function executionRequest(claim: ExecutionClaim, bootId: string, runtimes: JudgeRuntimes, operation: "EXECUTE" | "RECOVER") {
  if (!["EXECUTE", "RECOVER"].includes(operation)) throw new Error("Invalid executor operation.");
  const nonce = randomUUID();
  return { protocol: EXECUTOR_PROTOCOL, operation, request_id: nonce, host_epoch_id: uuid(claim.payload.hostEpochId), boot_id: uuid(bootId),
    permit_owner: uuid(claim.owner), provider_token: uuid(claim.providerToken), payload: authoringRequest(claim.payload, nonce, runtimes) };
}
export function acceptExecutionReply(value: unknown, claim: ExecutionClaim, request: ReturnType<typeof executionRequest>) {
  const row = exact(value, ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "permit_owner", "reply"]);
  for (const key of ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "permit_owner"] as const) if (row[key] !== request[key]) throw new Error("Foreign protected executor reply.");
  if (row.reply === null && request.operation === "RECOVER") return null;
  const reply = exact(row.reply, ["protocol", "request_id", "host_epoch_id", "attempt_id", "payload_digest", "state", "provider_token", "execution_generation", "evidence"]);
  if (reply.state !== "FINISHED" || reply.provider_token !== claim.providerToken) throw new Error("Protected execution is not complete.");
  acceptJudgeReply(reply, claim.payload, request.request_id, 200);
  return reply.evidence;
}

// Only the fixed production factory below may choose the real launcher. This helper also tests real pipes.
export async function exchangeProtectedProcess(command: { file: string; args: readonly string[]; inheritedFds?: readonly number[] }, input: Buffer, signal: AbortSignal): Promise<Buffer> {
  signal.throwIfAborted(); if (input.length > JUDGE_BODY_LIMIT) throw new Error("Executor request exceeds its bound.");
  const descriptors = [...(command.inheritedFds ?? [])];
  if (descriptors.length > 3 || descriptors.some(fd => !Number.isSafeInteger(fd) || fd < 3) || new Set(descriptors).size !== descriptors.length) throw new Error("Invalid protected process descriptors.");
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command.file, [...command.args], { shell: false, windowsHide: true, cwd: process.platform === "win32" ? undefined : "/",
      env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8", ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {}) },
      stdio: ["pipe", "pipe", "pipe", ...descriptors] });
    let failed = false, size = 0, diagnostic = 0; const chunks: Buffer[] = [];
    const fail = () => { failed = true; child.stdin!.destroy(); child.stdout!.destroy(); child.stderr!.destroy(); child.kill("SIGKILL"); };
    const timer = setTimeout(fail, TIMEOUT_MS);
    signal.addEventListener("abort", fail, { once: true }); if (signal.aborted) fail();
    child.on("error", fail); child.stdin!.on("error", fail); child.stdout!.on("error", fail); child.stderr!.on("error", fail);
    child.stdout!.on("data", (chunk: Buffer) => { size += chunk.length; if (size > JUDGE_BODY_LIMIT) fail(); else chunks.push(chunk); });
    child.stderr!.on("data", (chunk: Buffer) => { diagnostic += chunk.length; if (diagnostic > 16384) fail(); });
    child.on("close", (code, cause) => {
      clearTimeout(timer); signal.removeEventListener("abort", fail);
      if (failed || code !== 0 || cause !== null || diagnostic !== 0) reject(new Error("Protected launcher failed; execution and cleanup remain uncertain."));
      else resolve(Buffer.concat(chunks, size));
    });
    // A fast read-only command may exit before an unnecessary zero-byte pipe write.
    if (input.length) child.stdin!.end(input); else child.stdin!.end();
  });
}

export function createProtectedExecutorClient(settings: ExecutorSettings): TrustedProtectedExecutor {
  if (process.platform !== "linux" || process.getuid?.() !== 0 || !/^[0-9a-f]{64}$/.test(settings.launcherSha256)) throw new Error("Protected execution requires the reviewed root-owned Linux installation.");
  const epoch = uuid(settings.hostEpochId), boot = uuid(settings.bootId), expected = settings.launcherSha256;
  const runtimes = new Map([...settings.runtimes].map(([key, value]) => [key, { ...value }])); runtimeRecord(runtimes);
  let busy = false;
  async function exchange(operation: "READY" | "EXECUTE" | "RECOVER", data: Buffer, signal: AbortSignal) {
    signal.throwIfAborted(); if (busy) throw new Error("Protected launcher is busy."); busy = true;
    let executable: Awaited<ReturnType<typeof open>> | undefined;
    try {
      if (operation !== "RECOVER" && (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim() !== boot) throw new Error("Wrong boot.");
      if (await realpath(LAUNCHER) !== LAUNCHER) throw new Error("Linked launcher.");
      for (let path = dirname(LAUNCHER); ; path = dirname(path)) {
        const info = await lstat(path);
        if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || info.mode & 0o022) throw new Error("Unprotected installation.");
        if (path === "/") break;
      }
      executable = await open(LAUNCHER, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = await executable.stat();
      if (!info.isFile() || info.uid !== 0 || (info.mode & 0o7777) !== 0o555 || info.size < 1 || info.size > 1048576
        || sha256(await executable.readFile()).toString("hex") !== expected) throw new Error("Changed launcher.");
      signal.throwIfAborted();
      // Execute the verified open inode, not a path that could be replaced between verification and exec.
      return readJudgeJson(await exchangeProtectedProcess({ file: "/proc/self/fd/3", args: [`--${operation.toLowerCase()}`], inheritedFds: [executable.fd] }, data, signal));
    } catch { throw new Error("Protected launcher unavailable or unusable; retain any consumed execution permit."); }
    finally { await executable?.close(); busy = false; }
  }
  return {
    hostEpochId: epoch, bootId: boot,
    get runtimes() { return new Map([...runtimes].map(([key, value]) => [key, { ...value }])); },
    async assertReady(signal: AbortSignal) {
      const request = { protocol: EXECUTOR_PROTOCOL, operation: "READY", request_id: randomUUID(), host_epoch_id: epoch, boot_id: boot, runtimes: runtimeRecord(runtimes) };
      const row = exact(await exchange("READY", Buffer.from(judgeJson(request)), signal), [...Object.keys(request), "ready", "proof_digest"]);
      for (const key of ["protocol", "operation", "request_id", "host_epoch_id", "boot_id"] as const) if (row[key] !== request[key]) throw new Error("Foreign launcher readiness.");
      if (row.ready !== true || judgeJson(row.runtimes) !== judgeJson(request.runtimes) || typeof row.proof_digest !== "string" || !/^[0-9a-f]{64}$/.test(row.proof_digest)) throw new Error("Unverified launcher readiness.");
    },
    async exchange(request, signal) {
      const frozen = readJudgeJson(Buffer.from(judgeJson(request))) as ReturnType<typeof executionRequest>;
      exact(frozen, ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "permit_owner", "provider_token", "payload"]);
      if (frozen.protocol !== EXECUTOR_PROTOCOL || frozen.host_epoch_id !== epoch || frozen.boot_id !== boot || !["EXECUTE", "RECOVER"].includes(frozen.operation)) throw new Error("Wrong executor binding.");
      uuid(frozen.permit_owner); uuid(frozen.provider_token); uuid(frozen.request_id);
      const p = readAuthoringRequest(frozen.payload, frozen.request_id, epoch, frozen.payload.attempt_id, frozen.payload.payload_digest, runtimes);
      if (frozen.payload.payload_digest !== authoringPayloadDigest(p).toString("hex")) throw new Error("Wrong executor payload.");
      return exchange(frozen.operation, Buffer.from(judgeJson(frozen)), signal);
    },
  };
}
