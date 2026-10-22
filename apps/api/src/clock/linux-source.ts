import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { uuid } from "../access/credentials.js";
import type { ClockSource } from "./monitor.js";

const execute = promisify(execFile);

async function protectedFile(path: string): Promise<string> {
  const resolved = await realpath(path);
  const file = await lstat(resolved);
  if (!file.isFile() || file.uid !== 0 || (file.mode & 0o022)) throw new Error("Clock probe must be root-owned and protected from runtime edits.");
  let parent = dirname(resolved);
  for (;;) {
    const stat = await lstat(parent);
    if (!stat.isDirectory() || stat.uid !== 0 || (stat.mode & 0o022)) throw new Error("Unprotected clock probe directory.");
    const next = dirname(parent);
    if (next === parent) return resolved;
    parent = next;
  }
}

export function parseUptime(text: string): bigint {
  if (text.length > 128 || !/^\d+\.\d{2} \d+\.\d{2}\n?$/.test(text)) throw new Error("Invalid Linux uptime report.");
  const [seconds, fraction] = text.split(" ")[0]!.split(".");
  const value = BigInt(seconds!) * 1000000000n + BigInt(fraction!) * 10000000n;
  if (value > 9223372036854775807n) throw new Error("Linux uptime is outside the clock policy range.");
  return value;
}

export function linuxClockReference() {
  if (process.platform !== "linux" || process.getuid?.() === 0) throw new Error("Event entry requires a restricted Linux service account and the primary-host clock probe.");
  return { bootId: uuid(readFileSync("/proc/sys/kernel/random/boot_id", "ascii").trim()), resolutionNs: 10000000n,
    nowNs: () => parseUptime(readFileSync("/proc/uptime", "ascii")) };
}

export async function linuxClockSource(): Promise<ClockSource> {
  const reference = linuxClockReference();
  const python = await protectedFile("/usr/bin/python3");
  const probe = await protectedFile(fileURLToPath(new URL("../../../../infra/clock-agent/probe.py", import.meta.url)));
  await protectedFile("/usr/bin/chronyc");
  return {
    ...reference,
    async sample(nonce, sequence) {
      const result = await execute(python, ["-I", "-B", probe, nonce, sequence.toString()], {
        timeout: 1800, killSignal: "SIGKILL", maxBuffer: 4096, encoding: "buffer", env: { PATH: "/usr/bin:/bin", LC_ALL: "C" },
      });
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(result.stdout));
    },
  };
}
