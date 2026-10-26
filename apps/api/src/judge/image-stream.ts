import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

interface Command { file: string; args: readonly string[]; inheritedFds?: readonly number[]; }
const unavailable = () => new Error("Image export could not be verified; preserve its inspection record.");

// Binary image bytes only cross bounded pipes; they are never extracted or retained in memory.
export async function hashImageStream(producer: Command, reader: Command, signal: AbortSignal): Promise<Buffer> {
  signal.throwIfAborted();
  const commands = [producer, reader];
  for (const command of commands) {
    const fds = command.inheritedFds ?? [];
    if (fds.length > 3 || fds.some(fd => !Number.isSafeInteger(fd) || fd < 3) || new Set(fds).size !== fds.length) throw unavailable();
  }
  const children: ChildProcess[] = [];
  try { for (const command of commands) children.push(spawn(command.file, [...command.args], {
    shell: false, windowsHide: true, cwd: process.platform === "win32" ? undefined : "/",
    env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8", ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {}) },
    stdio: ["pipe", "pipe", "pipe", ...(command.inheritedFds ?? [])],
  })); } catch {
    for (const child of children) { child.stdin?.destroy(); child.stdout?.destroy(); child.stderr?.destroy(); child.on("error", () => {}); child.kill("SIGKILL"); }
    throw unavailable();
  }
  let failed = false, bytes = 0, size = 0, diagnostic = 0;
  const exits: (number | null | undefined)[] = [undefined, undefined];
  const chunks: Buffer[] = [];
  const stop = () => {
    failed = true;
    for (const child of children) { child.stdin!.destroy(); child.stdout!.destroy(); child.stderr!.destroy(); child.kill("SIGKILL"); }
  };
  const timer = setTimeout(stop, 80000);
  signal.addEventListener("abort", stop, { once: true });
  const completions = children.map((child, index) => new Promise<void>(resolve => {
    child.on("error", stop);
    for (const stream of [child.stdin!, child.stdout!, child.stderr!]) stream.on("error", stop);
    child.stderr!.on("data", (chunk: Buffer) => { diagnostic += chunk.length; if (diagnostic > 16384) stop(); });
    child.once("close", (code, cause) => { exits[index] = code; if (code !== 0 || cause !== null) stop(); resolve(); });
  }));
  const [source, target] = children;
  const bound = new Transform({ transform(chunk: Buffer, _encoding, next) {
    bytes += chunk.length;
    if (bytes > 32 * 1024 ** 3 + 256 * 1024 ** 2) { next(unavailable()); return; }
    next(null, chunk);
  } });
  target!.stdout!.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 512) stop(); else chunks.push(Buffer.from(chunk)); });
  const transfer = pipeline(source!.stdout!, bound, target!.stdin!).catch(stop);
  source!.stdin!.end();
  if (signal.aborted) stop();
  try {
    await Promise.all([...completions, transfer]);
    if (failed || signal.aborted || !bytes || !size || diagnostic)
      throw new Error(unavailable().message, { cause: { bytes, reply_bytes: size, diagnostic_bytes: diagnostic, exits, cancelled: signal.aborted } });
    return Buffer.concat(chunks, size);
  } finally { clearTimeout(timer); signal.removeEventListener("abort", stop); }
}

export function checkedImageTree(raw: Buffer, expected: string) {
  if (!/^[0-9a-f]{64}$/.test(expected) || raw.length > 512) throw unavailable();
  let value: Record<string, unknown>;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); } catch { throw unavailable(); }
  if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "data_bytes,entries,files,protocol,tree_sha256"
    || value.protocol !== "ingenium-image-tree-v1" || value.tree_sha256 !== expected
    || !Number.isSafeInteger(value.entries) || (value.entries as number) < 1 || (value.entries as number) > 250000
    || !Number.isSafeInteger(value.files) || (value.files as number) < 1 || (value.files as number) > (value.entries as number)
    || !Number.isSafeInteger(value.data_bytes) || (value.data_bytes as number) < 1 || (value.data_bytes as number) > 32 * 1024 ** 3) throw unavailable();
  return Object.freeze(value);
}
