import { constants } from "node:fs";
import { lstat, mkdir, open, statfs } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { sha256, uuid } from "../access/credentials.js";
import { judgeJson, readJudgeJson } from "../content/judge-protocol.js";
import { createHostContextObserver } from "./host-context.js";
import type { HostContextSettings } from "./host-context.js";
import { observeLoadedAppArmor } from "./loaded-policy.js";
import { openHostInstallation, reviewedHostRelease } from "./host-installation.js";
import type { CapsuleRelease } from "./capsule-lifecycle.js";
import { inspectHostCgroups } from "./host-cgroups.js";
import { protectedDirectory } from "./isolate-context.js";
import { checkedImageTree } from "./image-stream.js";
import { observeCheckpointStorage } from "./host-storage.js";

const ROOT = "/var/lib/ingenium/judge-executor/host-verification";
const fail = (): never => { throw new Error("This boot's complete host verification is missing or changed; keep judging unavailable."); };
const hash = (value: unknown) => sha256(judgeJson(value)).toString("hex");
export interface HostVerificationSettings extends HostContextSettings { hostEpochId: string; imageTreeSha256: string; }

export function checkedHostCertificate(record: unknown, intent: unknown, binding: Record<string, unknown>, observation: unknown) {
  if (!record || typeof record !== "object" || !intent || typeof intent !== "object") return fail();
  const row = record as Record<string, unknown>, original = intent as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "binding,image,intent_sha256,observation" || Object.keys(original).sort().join(",") !== "binding,nonce"
    || judgeJson(row.binding) !== judgeJson(binding) || judgeJson(original.binding) !== judgeJson(binding) || row.intent_sha256 !== hash(original)) return fail();
  uuid(original.nonce);
  checkedImageTree(Buffer.from(JSON.stringify(row.image)), binding.image_tree_sha256 as string);
  if (judgeJson(observation) !== judgeJson(row.observation)) return fail();
  return sha256(judgeJson({ record_sha256: hash(row), observation }));
}

export async function openVerifiedHost(settings: HostVerificationSettings, release: CapsuleRelease, value: unknown, signal: AbortSignal) {
  const pinned = { ...settings, hostEpochId: uuid(settings.hostEpochId), bootId: uuid(settings.bootId) },
    bundle = { imageId: release.imageId, digest: release.digest }, manifest = reviewedHostRelease(value, bundle);
  if (!/^[0-9a-f]{64}$/.test(pinned.imageTreeSha256)) return fail();
  const file = (path: string, mode: number) => {
    const found = manifest.files.find(file => file.path === path);
    if (!found || found.mode !== mode) return fail(); return found;
  };
  if (file("host-observe", 0o555).sha256 !== pinned.observerSha256) return fail();
  file("python", 0o555); file("image-tree.py", 0o444);
  const policyHash = file("security/apparmor.bin", 0o444).sha256;
  const observer = createHostContextObserver(pinned), installation = await openHostInstallation(manifest, bundle, signal);
  let closed = false;
  const binding = { version: 1, host_epoch_id: pinned.hostEpochId, boot_id: pinned.bootId, release_sha256: bundle.digest, image_tree_sha256: pinned.imageTreeSha256 };
  const folder = `${ROOT}/${pinned.hostEpochId}`;
  async function directory() {
    await protectedDirectory(folder);
    for (const path of [ROOT, folder]) {
      const info = await lstat(path);
      if ((info.mode & 0o7777) !== 0o700 || ![0xef53, 0x58465342].includes((await statfs(path)).type)) return fail();
    }
    return open(folder, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  }
  async function read(name: "intent" | "verified") {
    const parent = await directory();
    try {
      const file = await open(`/proc/self/fd/${parent.fd}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const info = await file.stat({ bigint: true });
        if (!info.isFile() || info.uid !== 0n || info.gid !== 0n || info.nlink !== 1n || (info.mode & 0o7777n) !== 0o400n || info.size < 1n || info.size > 32768n) return fail();
        const bytes = Buffer.alloc(32769), result = await file.read(bytes, 0, bytes.length, 0), after = await file.stat({ bigint: true });
        if (result.bytesRead !== Number(info.size) || info.ctimeNs !== after.ctimeNs || info.mtimeNs !== after.mtimeNs || info.size !== after.size) return fail();
        return readJudgeJson(bytes.subarray(0, result.bytesRead));
      } finally { await file.close(); }
    } finally { await parent.close(); }
  }
  async function write(name: "intent" | "verified", value: unknown) {
    const parent = await directory(), bytes = Buffer.from(judgeJson(value));
    if (bytes.length > 32768) { await parent.close(); return fail(); }
    try {
      const file = await open(`/proc/self/fd/${parent.fd}/${name}`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(bytes); await file.chmod(0o400); await file.sync(); await parent.sync(); }
      finally { await file.close(); }
    } finally { await parent.close(); }
  }
  async function observe(signal: AbortSignal) {
    signal.throwIfAborted(); if (closed) return fail();
    const context = async () => { const { request_id: _nonce, ...stable } = (await observer.observe(signal)).observation; return stable; };
    const before = await context(), policy = await observeLoadedAppArmor(policyHash, signal), roots = await inspectHostCgroups(pinned.bootId), storage = await observeCheckpointStorage(signal);
    await installation.verify(signal);
    if (judgeJson(before) !== judgeJson(await context())) return fail();
    return { context: before, policy, roots, storage };
  }
  async function assertReady(signal: AbortSignal) {
    const record = await read("verified"), intent = await read("intent");
    return checkedHostCertificate(record, intent, binding, await observe(signal));
  }
  return {
    installation, assertReady,
    async prepare(signal: AbortSignal) {
      // A once-only inspection intent survives a lost Docker acknowledgement. Never recreate an uncertain inspection.
      await observe(signal);
      await protectedDirectory("/var/lib/ingenium/judge-executor");
      try { await mkdir(ROOT, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      await protectedDirectory(ROOT);
      const root = await open(ROOT, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try {
        try { await mkdir(`/proc/self/fd/${root.fd}/${pinned.hostEpochId}`, { mode: 0o700 }); await root.sync(); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          return assertReady(signal);
        }
      } finally { await root.close(); }
      const intent = { binding, nonce: randomUUID() }; await write("intent", intent);
      const before = await observe(signal), image = await installation.observeImage(intent.nonce, pinned.imageTreeSha256, signal);
      const after = await observe(signal); if (judgeJson(before) !== judgeJson(after)) return fail();
      await write("verified", { binding, intent_sha256: hash(intent), image, observation: after });
      return assertReady(signal);
    },
    async close() { await installation.close(); closed = true; },
  };
}
