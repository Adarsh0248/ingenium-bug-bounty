import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

async function runtimeJson(
  path: string,
  limit: number,
  root: boolean,
): Promise<unknown> {
  if (
    process.platform !== "linux" ||
    !process.getuid ||
    (root ? process.getuid() !== 0 : process.getuid() === 0) ||
    !isAbsolute(path)
  )
    throw new Error("Restricted Linux runtime required.");
  let parent = dirname(path);
  for (;;) {
    const stat = await lstat(parent);
    if (
      !stat.isDirectory() ||
      ![0, process.getuid()].includes(stat.uid) ||
      stat.mode & 0o022
    )
      throw new Error("Unprotected runtime directory.");
    const next = dirname(parent);
    if (next === parent) break;
    parent = next;
  }
  const original = await lstat(path);
  if (
    !original.isFile() ||
    original.nlink !== 1 ||
    original.size < 1 ||
    original.size > limit ||
    original.mode & 0o077 ||
    ![0, process.getuid()].includes(original.uid)
  )
    throw new Error("Private runtime file required.");
  const file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await file.stat();
    if (
      stat.dev !== original.dev ||
      stat.ino !== original.ino ||
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.size < 1 ||
      stat.size > limit ||
      stat.mode & 0o077 ||
      ![0, process.getuid()].includes(stat.uid)
    )
      throw new Error("Private runtime file required.");
    const buffer = Buffer.alloc(limit + 1),
      result = await file.read(buffer, 0, buffer.length, 0);
    if (result.bytesRead > limit) throw new Error("Oversized runtime file.");
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, result.bytesRead),
      ),
    );
  } finally {
    await file.close();
  }
}

export function privateRuntimeJson(path: string, limit: number) { return runtimeJson(path, limit, false); }
export function rootRuntimeJson(path: string, limit: number) { return runtimeJson(path, limit, true); }
