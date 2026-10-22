import { privateRuntimeJson } from "../runtime/private-file.js";
import { parseCompetitionRuntime } from "../worker/config.js";
import { competitionRuntime } from "../worker/readiness.js";
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
  return parseEntrySecrets(await privateRuntimeJson(path, 4096));
}

export async function createEntryRuntime(pool: Pool, monitorPool: Pool, path: string, competitionPath?: string) {
  const source = await linuxClockSource();
  const secrets = await readSecrets(path);
  const competition = competitionPath ? parseCompetitionRuntime(await privateRuntimeJson(competitionPath, 8192)) : undefined;
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
  const options: EntryHttpOptions = { pool, clock: monitor.guard, recoveryClock: monitor.recoveryGuard, ...secrets,
    ...(competition ? { competition: competitionRuntime(pool, monitor.guard, competition) } : {}) };
  return { options,
    async close() {
      closing = true;
      if (timer) clearTimeout(timer);
      await Promise.all([active, monitor.stop()]);
    },
  };
}
