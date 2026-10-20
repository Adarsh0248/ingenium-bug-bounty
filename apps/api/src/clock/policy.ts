import { uuid } from "../access/credentials.js";

export const SECOND = 1000000000n;
export const FRESHNESS = 15n * SECOND;
export const FAULTS = ["PROBE_FAILED", "INVALID_REPORT", "SOURCE_UNTRUSTED", "UNSYNCHRONISED", "ERROR_BOUND", "WALL_STEP", "MEASUREMENT_UNCERTAIN",
  "STALE_REPORT", "MONOTONIC_REVERSED", "CLOCK_REVERSED", "UNCLEAN_RESTART", "DATABASE_UNAVAILABLE", "RUNTIME_REPLACED"] as const;
export type ClockFault = typeof FAULTS[number];
export interface ClockReport {
  policy: 1; boot_id: string; nonce: string; sequence: string;
  boottime_before_ns: string; boottime_after_ns: string; realtime_ns: string;
  system_offset_ns: string; root_delay_ns: string; root_dispersion_ns: string;
  synchronised: boolean; source_ok: boolean;
}
const fields = ["policy", "boot_id", "nonce", "sequence", "boottime_before_ns", "boottime_after_ns", "realtime_ns", "system_offset_ns", "root_delay_ns", "root_dispersion_ns", "synchronised", "source_ok"].sort().join();

export function integer(value: unknown, signed = false): bigint {
  if (typeof value !== "string" || !(signed ? /^(?:0|-?[1-9]\d{0,18})$/ : /^(?:0|[1-9]\d{0,18})$/).test(value)) throw new Error("Invalid clock integer.");
  const number = BigInt(value);
  if (number < -9223372036854775807n || number > 9223372036854775807n) throw new Error("Clock integer overflow.");
  return number;
}

export function parseReport(value: unknown, bootId: string, nonce: string, sequence: bigint): ClockReport {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join() !== fields) throw new Error("Invalid clock report.");
  const r = value as ClockReport;
  uuid(r.boot_id);
  if (r.policy !== 1 || r.boot_id !== bootId || r.nonce !== nonce || !/^[A-Za-z0-9_-]{43}$/.test(r.nonce)
      || integer(r.sequence) !== sequence || sequence < 1n || typeof r.synchronised !== "boolean" || typeof r.source_ok !== "boolean") throw new Error("Clock report binding differs.");
  for (const field of [r.boottime_before_ns, r.boottime_after_ns, r.realtime_ns, r.root_delay_ns, r.root_dispersion_ns]) integer(field);
  integer(r.system_offset_ns, true);
  if (Buffer.byteLength(JSON.stringify(r)) > 2048) throw new Error("Oversized clock report.");
  return r;
}

export function assess(r: ClockReport, previous: ClockReport | undefined, started: bigint, received: bigint, resolution: bigint): { fault: ClockFault | null; warning: boolean } {
  const low = integer(r.boottime_before_ns), high = integer(r.boottime_after_ns);
  const offset = integer(r.system_offset_ns, true), absolute = offset < 0n ? -offset : offset;
  const error = absolute + integer(r.root_dispersion_ns) + (integer(r.root_delay_ns) + 1n) / 2n;
  let fault: ClockFault | null = null;
  if (received < started) fault = "MONOTONIC_REVERSED";
  else if (received - started + resolution > 2n * SECOND || high < low || high - low > 20000000n || low < started || high > received + resolution) fault = "MEASUREMENT_UNCERTAIN";
  else if (!r.source_ok) fault = "SOURCE_UNTRUSTED";
  else if (!r.synchronised) fault = "UNSYNCHRONISED";
  else if (error > 100000000n) fault = "ERROR_BOUND";
  else if (previous) {
    const oldLow = integer(previous.boottime_before_ns), oldHigh = integer(previous.boottime_after_ns);
    const wall = integer(r.realtime_ns) - integer(previous.realtime_ns);
    const stepLow = wall - (high - oldLow), stepHigh = wall - (low - oldHigh);
    if (low <= oldHigh) fault = "MONOTONIC_REVERSED";
    else if (stepLow >= 100000000n || stepHigh <= -100000000n) fault = "WALL_STEP";
    else if (stepHigh >= 100000000n || stepLow <= -100000000n) fault = "MEASUREMENT_UNCERTAIN";
  }
  return { fault, warning: absolute > 50000000n };
}
