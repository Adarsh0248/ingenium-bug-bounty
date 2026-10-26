import { constants } from "node:fs";
import { open, opendir, readlink, statfs } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { CAPSULE_APPARMOR } from "./docker-capsule.js";

const ROOT = "/sys/kernel/security/apparmor";
const fail = (): never => { throw new Error("Loaded AppArmor policy unverified; judging remains unavailable."); };
const fd = (file: FileHandle) => `/proc/self/fd/${file.fd}`;
export function checkedLoadedProfile(name: string, mode: string, target: string, hash: string, expected: string) {
  const match = /^\.\.\/\.\.\/raw_data\/(0|[1-9][0-9]{0,19})\/sha256$/.exec(target);
  if (name !== `${CAPSULE_APPARMOR}\n` || mode !== "enforce\n" || !match || !/^[0-9a-f]{64}$/.test(expected) || hash !== `${expected}\n`) return fail();
  return { profile: CAPSULE_APPARMOR, revision: match[1]!, raw_sha256: expected };
}

// Kernel-backed policy observation only; combine it with initial-host and image verification before granting readiness.
export async function observeLoadedAppArmor(expected: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (process.platform !== "linux" || process.getuid?.() !== 0 || !/^[0-9a-f]{64}$/.test(expected)) return fail();
  const deadline = performance.now() + 5000;
  function turn() { signal.throwIfAborted(); if (performance.now() >= deadline) return fail(); }
  async function text(path: string, limit: number) {
    turn();
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await file.stat();
      if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || info.mode & 0o022) return fail();
      const data = Buffer.alloc(limit + 1); let length = 0;
      while (length < data.length) {
        turn(); const row = await file.read(data, length, data.length - length, length);
        if (!row.bytesRead) {
          if (data.subarray(0, length).some(byte => byte > 127 || byte === 0)) return fail();
          return data.subarray(0, length).toString("ascii");
        }
        length += row.bytesRead;
      }
      return fail();
    } finally { await file.close(); }
  }
  async function initialNamespace() {
    turn();
    if ((await statfs("/sys/kernel/security")).type !== 0x73636673
      || await text(`${ROOT}/.ns_level`, 16) !== "0\n" || await text(`${ROOT}/.ns_stacked`, 16) !== "no\n"
      || !/^Y\n?$/.test(await text("/sys/module/apparmor/parameters/enabled", 16))
      || !/^enforce\n?$/.test(await text("/sys/module/apparmor/parameters/mode", 32))) return fail();
  }
  await initialNamespace();
  // This is the kernel's documented magic link from securityfs to its internal AppArmor policy filesystem.
  const policy = await open(`${ROOT}/policy`, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    if ((await statfs(fd(policy))).type !== 0x5a3c69f0) return fail();
    const profiles = await open(`${fd(policy)}/profiles`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      const list = await opendir(fd(profiles)); let count = 0;
      let found: { profile: string; revision: string; raw_sha256: string; policy_device: string; profile_inode: string } | undefined;
      for await (const entry of list) {
        turn(); if (++count > 4096 || !entry.isDirectory()) return fail();
        const profile = await open(`${fd(profiles)}/${entry.name}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        try {
          const name = await text(`${fd(profile)}/name`, 256);
          if (name !== `${CAPSULE_APPARMOR}\n`) continue;
          if (found) return fail();
          const link = await readlink(`${fd(profile)}/raw_sha256`);
          const match = /^\.\.\/\.\.\/raw_data\/(0|[1-9][0-9]{0,19})\/sha256$/.exec(link); if (!match) return fail();
          const raw = await open(`${fd(policy)}/raw_data/${match[1]}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
          try {
            const hash = await text(`${fd(raw)}/sha256`, 65), mode = await text(`${fd(profile)}/mode`, 32);
            const checked = checkedLoadedProfile(name, mode, link, hash, expected), info = await profile.stat({ bigint: true });
            if ((await statfs(fd(profile))).type !== 0x5a3c69f0 || (await statfs(fd(raw))).type !== 0x5a3c69f0 || info.nlink < 1n
              || await readlink(`${fd(profile)}/raw_sha256`) !== link || await text(`${fd(profile)}/mode`, 32) !== mode
              || await text(`${fd(profile)}/name`, 256) !== name || await text(`${fd(raw)}/sha256`, 65) !== hash) return fail();
            found = { ...checked, policy_device: String(info.dev), profile_inode: String(info.ino) };
          } finally { await raw.close(); }
        } finally { await profile.close(); }
      }
      if (!found) return fail();
      await initialNamespace(); return Object.freeze(found);
    } finally { await profiles.close(); }
  } finally { await policy.close(); }
}
