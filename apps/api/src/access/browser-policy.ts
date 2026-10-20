import type { FastifyRequest } from "fastify";
import { parseProof, sha256, uuid } from "./credentials.js";
import { AccessError } from "./transaction.js";

export interface BrowserSettings {
  mode: "production" | "loopback";
  origin: string;
  cookieKey: Uint8Array;
  csrfKey: Uint8Array;
}
export type Audience = "ANONYMOUS" | "ENTRY" | "REPLACEMENT" | "PARTICIPANT" | "STAFF_ENTRY" | "STAFF" | "STAFF_RECOVERY_ENTRY" | "STAFF_RECOVERY";

export function browserPolicy(settings: BrowserSettings) {
  const url = new URL(settings.origin);
  if (url.origin !== settings.origin || !["production", "loopback"].includes(settings.mode)
      || (settings.mode === "production" && url.protocol !== "https:")
      || (settings.mode === "loopback" && (url.protocol !== "http:" || !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)))
      || !(settings.cookieKey instanceof Uint8Array) || !(settings.csrfKey instanceof Uint8Array)
      || settings.cookieKey.length !== 32 || settings.csrfKey.length !== 32
      || Buffer.from(settings.cookieKey).equals(Buffer.from(settings.csrfKey))) throw new Error("Invalid browser security settings.");
  const prefix = settings.mode === "production" ? "__Host-ingenium_" : "ingenium_local_";
  return {
    origin: settings.origin,
    cookieKey: Buffer.from(settings.cookieKey), csrfKey: Buffer.from(settings.csrfKey),
    names: { browser: `${prefix}browser`, csrf: `${prefix}csrf`, entry: `${prefix}entry`, replacement: `${prefix}replacement`, participant: `${prefix}participant`, staffEntry: `${prefix}staff_entry`, staff: `${prefix}staff`,
      staffRecoveryEntry: `${prefix}staff_recovery_entry`, staffRecovery: `${prefix}staff_recovery` },
    cookie: { path: "/", httpOnly: true, sameSite: "strict" as const, secure: settings.mode === "production" },
  };
}
export type BrowserPolicy = ReturnType<typeof browserPolicy>;

export function requestOrigin(request: Pick<FastifyRequest, "headers" | "method">, policy: BrowserPolicy): void {
  const origin = request.headers.origin;
  if (origin !== undefined) {
    if (origin !== policy.origin) throw new AccessError("ORIGIN_DENIED");
    return;
  }
  if (["GET", "HEAD"].includes(request.method)) {
    if (request.headers["sec-fetch-site"] === "cross-site") throw new AccessError("ORIGIN_DENIED");
    return;
  }
  const referer = request.headers.referer;
  if (typeof referer !== "string" || referer.length > 2048 || /[\\\s]/.test(referer)) throw new AccessError("ORIGIN_DENIED");
  let url: URL;
  try { url = new URL(referer); } catch { throw new AccessError("ORIGIN_DENIED"); }
  if (url.origin !== policy.origin || url.username || url.password) throw new AccessError("ORIGIN_DENIED");
}

export function browserId(request: FastifyRequest, policy: BrowserPolicy): string | null {
  const cookie = request.cookies[policy.names.browser];
  if (!cookie) return null;
  const result = request.unsignCookie(cookie);
  if (!result.valid || !result.value) return null;
  try { return uuid(result.value); } catch { return null; }
}

export function csrfContext(policy: BrowserPolicy, audience: Audience, id: string, credential?: string): string {
  uuid(id);
  if (audience !== "ANONYMOUS" && !parseProof(credential)) throw new AccessError("INVALID_AUTHORITY");
  return JSON.stringify([1, policy.origin, audience, id, audience === "ANONYMOUS" ? null : sha256(credential!).toString("hex")]);
}

export function boundedCookies(request: Pick<FastifyRequest, "headers">, policy: BrowserPolicy): void {
  const header = request.headers.cookie;
  if (header === undefined) return;
  if (typeof header !== "string" || Buffer.byteLength(header) > 8192) throw new AccessError("INVALID_HEADERS");
  const names = new Set<string>();
  for (const part of header.split(";")) {
    const name = part.slice(0, part.indexOf("=")).trim();
    if (!Object.values(policy.names).includes(name)) continue;
    if (names.has(name)) throw new AccessError("INVALID_HEADERS");
    names.add(name);
  }
}
