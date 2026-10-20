import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { Pool } from "pg";
import { browserPolicy } from "./browser-policy.js";
import { sessionDelivery } from "./credentials.js";
import { linuxClockSource } from "../clock/linux-source.js";
import { createClockMonitor } from "../clock/monitor.js";
import type { EntryHttpOptions } from "./http.js";

export function parseEntrySecrets(value: unknown) {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join() !== "cookie_key,csrf_key,delivery_key,delivery_key_id,mode,origin,schema_version") throw new Error("Invalid entry runtime configuration.");
  const v = value as Record<string, unknown>;
  if (v.schema_version !== 1 || !["production", "loopback"].includes(String(v.mode)) || typeof v.origin !== "string"
      || ![v.cookie_key, v.csrf_key, v.delivery_key].every((key) => typeof key === "string" && /^[0-9a-f]{64}$/.test(key))
      || new Set([v.cookie_key, v.csrf_key, v.delivery_key]).size !== 3 || typeof v.delivery_key_id !== "string") throw new Error("Invalid entry runtime configuration.");
  const browser = { mode: v.mode as "production" | "loopback", origin: v.origin, cookieKey: Buffer.from(v.cookie_key as string, "hex"), csrfKey: Buffer.from(v.csrf_key as string, "hex") };
  browserPolicy(browser);
  return { browser, delivery: sessionDelivery(v.delivery_key_id, Buffer.from(v.delivery_key as string, "hex")) };
}

async function readSecrets(path: string) {
  if (!isAbsolute(path)) throw new Error("Entry runtime file must be an absolute private path.");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > 4096 || (stat.mode & 0o077) || ![0, process.getuid?.()].includes(stat.uid)) throw new Error("Entry runtime file must be a private service-owned regular file.");
    const buffer = Buffer.alloc(4097);
    const result = await file.read(buffer, 0, buffer.length, 0);
    if (result.bytesRead > 4096) throw new Error("Oversized entry runtime file.");
    return parseEntrySecrets(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, result.bytesRead))));
  } finally { await file.close(); }
}

export async function createEntryRuntime(pool: Pool, monitorPool: Pool, path: string) {
  const source = await linuxClockSource();
  const secrets = await readSecrets(path);
  const monitor = createClockMonitor(monitorPool, source);
  await monitor.start();
  let closing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  const tick = () => {
    active = monitor.pollOnce().catch(() => { monitor.guard.fault("PROBE_FAILED"); }).finally(() => {
      if (!closing) { timer = setTimeout(tick, 5000); timer.unref(); }
    });
  };
  tick();
  const options: EntryHttpOptions = { pool, clock: monitor.guard, recoveryClock: monitor.recoveryGuard, ...secrets };
  return { options,
    async close() {
      closing = true;
      if (timer) clearTimeout(timer);
      await Promise.all([active, monitor.stop()]);
    },
  };
}
