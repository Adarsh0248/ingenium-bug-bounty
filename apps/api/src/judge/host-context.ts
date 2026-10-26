import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { sha256, uuid } from "../access/credentials.js";
import { judgeJson } from "../content/judge-protocol.js";
import { exchangeProtectedProcess } from "./executor.js";
import { protectedDirectory } from "./isolate-context.js";

const FILE = "/opt/ingenium/judge-executor/host-observe";
const INITIAL = { user: 0xeffffffd, pid: 0xeffffffc, cgroup: 0xeffffffb, ipc: 0xefffffff, uts: 0xeffffffe, time: 0xeffffffa };
const fail = (): never => { throw new Error("Full Linux host context unverified; retain execution holds."); };
export interface HostContextSettings { bootId: string; kernelRelease: string; observerSha256: string; }
export function readHostContext(raw:Buffer,nonce:string,settings:HostContextSettings){
  if(!Buffer.isBuffer(raw)||raw.length>4096)return fail();
  try{
    const text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(raw),value:unknown=JSON.parse(text);
    // The pinned C observer emits one JSON line; exact round-trip rejects duplicate keys and alternate encodings.
    if(JSON.stringify(value)+"\n"!==text)return fail();
    return checkedHostContext(value,nonce,settings);
  }catch{return fail();}
}
export function checkedHostContext(value: unknown, nonce: string, settings: HostContextSettings) {
  const names = [...Object.keys(INITIAL), "mnt", "net"], keys = ["protocol", "request_id", "boot_id", "kernel_release", "proc_mount_id", "cap_eff", ...names.map(name => `${name}_namespace`)];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return fail();
  const row = value as Record<string, unknown>;
  if (row.protocol !== "ingenium-host-context-v1" || row.request_id !== uuid(nonce) || row.boot_id !== uuid(settings.bootId)
    || row.kernel_release !== settings.kernelRelease || !/^6\.8\.[A-Za-z0-9._+-]{1,100}$/.test(settings.kernelRelease)
    || typeof row.proc_mount_id !== "string" || !/^[1-9][0-9]{0,9}$/.test(row.proc_mount_id)
    || typeof row.cap_eff !== "string" || !/^[0-9a-f]{16}$/.test(row.cap_eff)) return fail();
  const required = 1n << 2n | 1n << 19n | 1n << 21n;
  if ((BigInt(`0x${row.cap_eff}`) & required) !== required) return fail();
  for (const name of names) {
    const initial = INITIAL[name as keyof typeof INITIAL], field = row[`${name}_namespace`];
    if (typeof field !== "string" || !new RegExp(`^${name}:\\[[1-9][0-9]{0,18}\\]$`).test(field)
      || initial !== undefined && field !== `${name}:[${initial}]`) return fail();
  }
  return Object.freeze({ ...row });
}

export function createHostContextObserver(settings: HostContextSettings) {
  const pinned = { ...settings, bootId: uuid(settings.bootId) };
  if (process.platform !== "linux" || process.getuid?.() !== 0 || !/^6\.8\.[A-Za-z0-9._+-]{1,100}$/.test(pinned.kernelRelease)
    || !/^[0-9a-f]{64}$/.test(pinned.observerSha256)) return fail();
  return {
    async observe(signal: AbortSignal) {
      signal.throwIfAborted(); await protectedDirectory("/opt/ingenium/judge-executor");
      const file = await open(FILE, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const info = await file.stat();
        if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || info.nlink !== 1 || (info.mode & 0o7777) !== 0o555 || info.size < 4 || info.size > 1048576) return fail();
        const bytes = await file.readFile();
        if (!bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || sha256(bytes).toString("hex") !== pinned.observerSha256) return fail();
        const nonce = randomUUID(), bounded = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
        const raw = await exchangeProtectedProcess({ file: "/proc/self/fd/3", args: ["--observe", nonce], inheritedFds: [file.fd] }, Buffer.alloc(0), bounded);
        bounded.throwIfAborted(); if (raw.length > 4096) return fail();
        const result = readHostContext(raw, nonce, pinned), current = await file.stat();
        if (info.dev !== current.dev || info.ino !== current.ino || info.mtimeMs !== current.mtimeMs || info.ctimeMs !== current.ctimeMs
          || info.mode !== current.mode || info.size !== current.size || info.nlink !== current.nlink) return fail();
        return { observation: result, sha256: sha256(judgeJson(result)).toString("hex") };
      } finally { await file.close(); }
    },
  };
}
