import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, rmdir, statfs, unlink } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { sha256, uuid } from "../access/credentials.js";
import { authoringPayloadDigest } from "../content/execution-policy.js";
import { judgeJson, runtimeRecord } from "../content/judge-protocol.js";
import { capsuleReference } from "./capsule-lifecycle.js";
import type { CapsuleReference } from "./capsule-lifecycle.js";
import { readCapsuleRequest } from "./capsule-request.js";
import { EXECUTION_PLAN_SHA256, reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { executionRequest } from "./executor.js";
import { ISOLATE_BINARIES, protectedDirectory } from "./isolate-context.js";
import type { IsolateSettings } from "./isolate-context.js";

export const CAPSULE_DIRECTORY = "/var/lib/ingenium/judge-executor/capsules";
const bad = (): never => { throw new Error("Private capsule configuration uncertain; preserve resources and reservation."); };
const fd = (file: FileHandle) => `/proc/self/fd/${file.fd}`;
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
export interface InodeIdentity { device: string; inode: string; }
export interface ConfigurationIdentity { directory: InodeIdentity; file: InodeIdentity; sha256: string; }
export async function inodeIdentity(handle: FileHandle): Promise<InodeIdentity> {
  const info = await handle.stat({ bigint: true }); return { device: info.dev.toString(), inode: info.ino.toString() };
}
export function capsuleConfiguration(settings: IsolateSettings, plan: ExecutionPlan, reference: CapsuleReference) {
  const safe = reviewedExecutionPlan(plan), ref = capsuleReference(safe, reference.intent);
  if (ref.name !== reference.name || settings.hostEpochId !== safe.hostEpochId || Object.keys(settings.binaries).length !== ISOLATE_BINARIES.length) return bad();
  const claim = { payload: { ...safe, ...safe.payloadLimits }, owner: safe.owner, providerToken: safe.providerToken };
  const tags = ["isolate", "phase_exec", "gcc", "gpp", "python", "node", "java", "javac"];
  const bytes = Buffer.from(judgeJson({ schema_version: 1, policy_sha256: EXECUTION_PLAN_SHA256, host_epoch_id: settings.hostEpochId,
    boot_id: settings.bootId, attempt_id: safe.attemptId, permit_owner: safe.owner, provider_token: safe.providerToken,
    payload_digest: authoringPayloadDigest(claim.payload).toString("hex"), runtimes: runtimeRecord(settings.runtimes),
    executables: Object.fromEntries(ISOLATE_BINARIES.map((path, i) => [tags[i]!, settings.binaries[path]])),
    ...(settings.batch?{batch:{batch_id:settings.batch.batchId,digest:settings.batch.digest,raw_b64:settings.batch.raw.toString('base64')}}:{}) }));
  readCapsuleRequest(bytes, Buffer.from(judgeJson(executionRequest(claim, settings.bootId, settings.runtimes, "EXECUTE"))));
  return bytes;
}
async function root(creating = false) {
  if (process.platform !== "linux" || process.getuid?.() !== 0) return bad();
  await protectedDirectory(CAPSULE_DIRECTORY);
  const handle = await open(CAPSULE_DIRECTORY, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY);
  try {
    const info = await handle.stat(), fs = await statfs(fd(handle));
    // shortcut: headroom is not an aggregate storage quota; require host-wide reservations before activation.
    if (info.gid !== 0 || (info.mode & 0o7777) !== 0o700 || ![0xef53, 0x58465342].includes(fs.type)
      || creating && (fs.bavail * fs.bsize < 65536 || fs.ffree < 4)) return bad();
    return handle;
  } catch (error) { await handle.close(); throw error; }
}
async function directory(parent: FileHandle, name: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(name)) return bad();
  const handle = await open(`${fd(parent)}/${name}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { const info = await handle.stat(); if (info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== 0o700) return bad(); return handle; }
  catch (error) { await handle.close(); throw error; }
}
async function originalDirectory(parent: FileHandle, name: string, identity: InodeIdentity) {
  const handle = await directory(parent, name);
  if (judgeJson(await inodeIdentity(handle)) !== judgeJson(identity)) { await handle.close(); return bad(); }
  return handle;
}
async function originalFile(folder: FileHandle, expected: ConfigurationIdentity, configuration: Buffer) {
  const handle = await open(`${fd(folder)}/capsule.json`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== 0o400 || info.nlink !== 1 || info.size !== configuration.length
      || info.size > 32768 || judgeJson(await inodeIdentity(handle)) !== judgeJson(expected.file)) return bad();
    const bytes = await handle.readFile(); if (!bytes.equals(configuration) || sha256(bytes).toString("hex") !== expected.sha256) return bad();
  } finally { await handle.close(); }
}
export async function prepareCapsuleConfiguration(reference: CapsuleReference, bytes: Buffer): Promise<ConfigurationIdentity> {
  const name = uuid(reference.intent.nonce), original = Buffer.from(bytes); if (original.length > 32768) return bad();
  const parent = await root(true); let folder: FileHandle | undefined;
  try {
    await mkdir(`${fd(parent)}/${name}`, { mode: 0o700 }); await parent.sync();
    folder = await directory(parent, name);
    const file = await open(`${fd(folder)}/capsule.json`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      await file.writeFile(original); await file.chmod(0o400); await file.sync(); await folder.sync();
      return { directory: await inodeIdentity(folder), file: await inodeIdentity(file), sha256: sha256(original).toString("hex") };
    } finally { await file.close(); }
  } finally { await folder?.close(); await parent.close(); }
}
export async function verifyCapsuleConfiguration(reference: CapsuleReference, bytes: Buffer, identity: ConfigurationIdentity) {
  uuid(reference.intent.nonce);
  const parent = await root(); let folder: FileHandle | undefined;
  try {
    folder = await originalDirectory(parent, reference.intent.nonce, identity.directory);
    if ((await readdir(fd(folder))).join(",") !== "capsule.json") return bad();
    await originalFile(folder, identity, bytes);
  } finally { await folder?.close(); await parent.close(); }
}
export async function assertCapsuleConfigurationAbsent(reference: CapsuleReference) {
  const name = uuid(reference.intent.nonce), parent = await root();
  try {
    try { await lstat(`${fd(parent)}/${name}`); } catch (error) { if (missing(error)) return; throw error; }
    return bad();
  } finally { await parent.close(); }
}
// Only the host retirement authority may call this after durable removal intent and verified container absence.
export async function removeCapsuleConfiguration(reference: CapsuleReference, bytes: Buffer, identity: ConfigurationIdentity) {
  uuid(reference.intent.nonce);
  const parent = await root(); let folder: FileHandle | undefined;
  try {
    try { folder = await originalDirectory(parent, reference.intent.nonce, identity.directory); }
    catch (error) { if (!missing(error)) throw error; await parent.sync(); return; }
    const names = await readdir(fd(folder)); if (names.some(name => name !== "capsule.json")) return bad();
    if (names.length) { await originalFile(folder, identity, bytes); await unlink(`${fd(folder)}/capsule.json`); await folder.sync(); }
    const current = await lstat(`${fd(parent)}/${reference.intent.nonce}`, { bigint: true });
    if (current.isSymbolicLink() || current.dev.toString() !== identity.directory.device || current.ino.toString() !== identity.directory.inode) return bad();
    await rmdir(`${fd(parent)}/${reference.intent.nonce}`); await parent.sync();
  } finally { await folder?.close(); await parent.close(); }
}
