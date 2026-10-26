import { constants } from "node:fs";
import { open, realpath, statfs } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { CHECKPOINT_DIRECTORY } from "./checkpoints.js";
import { protectedDirectory, protectedLinuxFile } from "./isolate-context.js";

const BACKING = "/var/lib/ingenium/judge-executor/checkpoints.ext4", SIZE = 8 * 1024 ** 3;
const fail = (): never => { throw new Error("Bounded durable checkpoint storage unavailable; keep new judging unavailable."); };
export function checkedCheckpointBudget(fs: { type: number; bsize: number; blocks: number; bavail: number; files: number; ffree: number }) {
  if (Object.values(fs).some(value => !Number.isSafeInteger(value) || value < 0) || fs.type !== 0xef53 || fs.bsize < 512
    || fs.bsize * fs.blocks < 7 * 1024 ** 3 || fs.bsize * fs.blocks > SIZE || fs.bavail > fs.blocks || fs.ffree > fs.files
    || fs.files < 4096 || fs.ffree < 128 || fs.bavail * fs.bsize < 32 * 1024 ** 2) return fail();
  // Two consumed permits can still finish their bounded records without exhausting the preallocated volume.
  return { total_bytes: fs.bsize * fs.blocks, total_inodes: fs.files };
}

export async function observeCheckpointStorage(signal: AbortSignal) {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(5000)]); bounded.throwIfAborted();
  if (process.platform !== "linux" || process.getuid?.() !== 0) return fail();
  await protectedDirectory(CHECKPOINT_DIRECTORY); await protectedDirectory("/var/lib/ingenium/judge-executor");
  const table = (await protectedLinuxFile("/proc/self/mountinfo", 1048576)).toString("ascii");
  const matches = table.trimEnd().split("\n").filter(line => line.split(" ")[4] === CHECKPOINT_DIRECTORY);
  if (matches.length !== 1) return fail();
  const [left, right] = matches[0]!.split(" - "), fields = left!.split(" "), after = right?.split(" "), flags = fields[5]?.split(",");
  if (fields[3] !== "/" || !/^[1-9][0-9]*$/.test(fields[0]!) || !/^[0-9]{1,10}:[0-9]{1,10}$/.test(fields[2]!)
    || after?.[0] !== "ext4" || !/^\/dev\/loop[0-9]{1,5}$/.test(after[1]!) || !["rw", "nosuid", "nodev", "noexec"].every(flag => flags?.includes(flag))) return fail();
  const loop = `/sys/devices/virtual/block/${after[1]!.slice(5)}`;
  if ((await statfs("/sys")).type !== 0x62656572 || await realpath(`/sys/dev/block/${fields[2]}/loop`) !== `${loop}/loop`) return fail();
  const kernel = async () => {
    for (const [name, expected] of [["loop/backing_file", BACKING + "\n"], ["loop/offset", "0\n"], ["loop/sizelimit", "0\n"], ["ro", "0\n"]])
      if ((await protectedLinuxFile(`${loop}/${name}`, 4096)).toString("ascii") !== expected) return fail();
  };
  await kernel(); bounded.throwIfAborted();
  const root = await open(CHECKPOINT_DIRECTORY, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let backing:FileHandle|undefined;
  try {
    backing = await open(BACKING, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const directory = await root.stat({ bigint: true }), file = await backing.stat({ bigint: true });
    if (directory.uid !== 0n || directory.gid !== 0n || (directory.mode & 0o7777n) !== 0o700n || !file.isFile()
      || file.uid !== 0n || file.gid !== 0n || file.nlink !== 1n || (file.mode & 0o7777n) !== 0o600n || file.size !== BigInt(SIZE) || file.blocks * 512n < file.size) return fail();
    const fs = await statfs(`/proc/self/fd/${root.fd}`), budget = checkedCheckpointBudget({ type: fs.type, bsize: fs.bsize, blocks: fs.blocks, bavail: fs.bavail, files: fs.files, ffree: fs.ffree });
    await kernel(); bounded.throwIfAborted();
    const current = await backing.stat({ bigint: true });
    const mounts = (await protectedLinuxFile("/proc/self/mountinfo", 1048576)).toString("ascii").trimEnd().split("\n").filter(line => line.split(" ")[4] === CHECKPOINT_DIRECTORY);
    const pathRoot = await open(CHECKPOINT_DIRECTORY, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      const path = await pathRoot.stat({ bigint:true });
      if (path.dev!==directory.dev || path.ino!==directory.ino || path.uid!==0n || path.gid!==0n || (path.mode & 0o7777n)!==0o700n
        || mounts.length!==1 || mounts[0]!==matches[0]) return fail();
    } finally { await pathRoot.close(); }
    if (current.dev !== file.dev || current.ino !== file.ino || current.size !== file.size || current.blocks * 512n < current.size
      || current.uid !== 0n || current.gid !== 0n || current.nlink !== 1n || (current.mode & 0o7777n) !== 0o600n) return fail();
    return { ...budget, mount_id: fields[0]!, device: directory.dev.toString(), inode: directory.ino.toString(), backing_device: file.dev.toString(), backing_inode: file.ino.toString() };
  } finally { try { await backing?.close(); } finally { await root.close(); } }
}
