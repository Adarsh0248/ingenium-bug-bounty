import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { base32 } from "@scure/base";
import { CompactEncrypt, compactDecrypt } from "jose";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const LANGUAGES = ["c", "cpp", "java", "python", "javascript"] as const;
export const EVENT_LANGUAGES = ["c", "cpp", "java", "python"] as const;
export type Language = typeof LANGUAGES[number];

export function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error("Invalid identifier.");
  return value;
}

export function language(value: unknown): Language {
  if (typeof value !== "string" || !(LANGUAGES as readonly string[]).includes(value)) throw new Error("Unsupported language.");
  return value as Language;
}

export function canonicalCode(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z2-7 -]{32,96}$/.test(value)) throw new Error("Invalid access code.");
  const code = value.replace(/[ -]/g, "").toUpperCase();
  if (code.length !== 32) throw new Error("Invalid access code.");
  return code;
}

export function sha256(value: string | Uint8Array): Buffer {
  return createHash("sha256").update(value).digest();
}

export function commandFingerprint(fields: readonly (string | boolean | null)[]): Buffer {
  const parts: Buffer[] = [Buffer.from("ingenium-command-v1", "ascii")];
  for (const value of fields) {
    const bytes = Buffer.from(value === null ? "" : typeof value === "boolean" ? value ? "1" : "0" : value, "utf8");
    const header = Buffer.alloc(5);
    header[0] = value === null ? 0 : typeof value === "boolean" ? 1 : 2;
    header.writeUInt32BE(bytes.length, 1); parts.push(header, bytes);
  }
  return sha256(Buffer.concat(parts));
}

export function newAccessCode(): { code: string; verifier: Buffer } {
  const code = base32.encode(randomBytes(20));
  return { code, verifier: sha256(code) };
}

export function newProof(): { id: string; cookie: string; verifier: Buffer } {
  const id = randomUUID();
  const secret = randomBytes(32);
  return { id, cookie: `v1.${id}.${secret.toString("base64url")}`, verifier: sha256(secret) };
}

export function parseProof(value: unknown): { id: string; verifier: Buffer } | null {
  if (typeof value !== "string" || value.length !== 83) return null;
  const match = /^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match || !match[1] || !match[2] || !UUID.test(match[1])) return null;
  const secret = Buffer.from(match[2], "base64url");
  if (secret.length !== 32 || secret.toString("base64url") !== match[2]) return null;
  return { id: match[1], verifier: sha256(secret) };
}

export function sameVerifier(first: unknown, second: unknown): boolean {
  return Buffer.isBuffer(first) && Buffer.isBuffer(second) && first.length === 32 && second.length === 32 && timingSafeEqual(first, second);
}

interface CommonBinding {
  flowId: string;
  sessionId: string;
  credentialId: string;
  credentialVersion: string;
  expiresAt: string;
}
export type DeliveryBinding = CommonBinding & ({ memberRoundId: string } | { memberRoundId: string; handoff: "REQUEST" | "SESSION" }
  | { staffId: string; mode: "NORMAL" | "CLOCK_RECOVERY"; generation: string });

function purpose(binding: DeliveryBinding): string { return "staffId" in binding ? "STAFF_ENTRY" : "handoff" in binding ? `REPLACEMENT_${binding.handoff}` : "TEAM_ENTRY"; }

function validateBinding(value: DeliveryBinding): void {
  const fields = ["flowId", "sessionId", "credentialId", "credentialVersion", "expiresAt",
    ...("staffId" in value ? ["staffId", "mode", "generation"] : "handoff" in value ? ["memberRoundId", "handoff"] : ["memberRoundId"])].sort().join();
  if (Object.keys(value).sort().join() !== fields) throw new Error("Invalid delivery binding fields.");
  for (const name of ["flowId", "sessionId", "credentialId"] as const) uuid(value[name]);
  if ("staffId" in value) {
    uuid(value.staffId);
    if (!["NORMAL", "CLOCK_RECOVERY"].includes(value.mode) || !/^(0|[1-9]\d{0,18})$/.test(value.generation)
        || BigInt(value.generation) > 9223372036854775807n || (value.mode === "CLOCK_RECOVERY" && value.generation === "0")) throw new Error("Invalid staff delivery binding.");
  } else {
    uuid(value.memberRoundId);
    if ("handoff" in value && !["REQUEST", "SESSION"].includes(value.handoff)) throw new Error("Invalid handoff binding.");
  }
  if (typeof value.credentialVersion !== "string" || typeof value.expiresAt !== "string"
      || !/^[1-9]\d{0,18}$/.test(value.credentialVersion) || BigInt(value.credentialVersion) > 9223372036854775807n
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.expiresAt)
      || !Number.isFinite(Date.parse(value.expiresAt)) || new Date(value.expiresAt).toISOString() !== value.expiresAt) throw new Error("Invalid delivery binding.");
}

export function sessionDelivery(keyId: string, key: Uint8Array) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyId) || key.length !== 32) throw new Error("Invalid session delivery key.");
  const privateKey = Uint8Array.from(key);
  return {
    keyId,
    async encrypt(binding: DeliveryBinding, cookie: string): Promise<string> {
      validateBinding(binding);
      if (parseProof(cookie)?.id !== binding.sessionId) throw new Error("Delivery session differs.");
      return new CompactEncrypt(Buffer.from(JSON.stringify({ schema: 1, purpose: purpose(binding), ...binding, cookie }), "utf8"))
        .setProtectedHeader({ alg: "dir", enc: "A256GCM", kid: keyId, typ: "ingenium-session-delivery-v1" }).encrypt(privateKey);
    },
    async decrypt(ciphertext: string, binding: DeliveryBinding): Promise<string> {
      validateBinding(binding);
      if (typeof ciphertext !== "string" || Buffer.byteLength(ciphertext) > 4096) throw new Error("Invalid session delivery.");
      const result = await compactDecrypt(ciphertext, privateKey, { keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"] });
      const header = result.protectedHeader;
      if (header.kid !== keyId || header.typ !== "ingenium-session-delivery-v1" || Object.keys(header).sort().join() !== "alg,enc,kid,typ"
          || result.plaintext.length > 2048) throw new Error("Invalid session delivery.");
      const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(result.plaintext));
      const keys = ["cookie", "purpose", "schema", ...Object.keys(binding)].sort().join();
      if (!value || typeof value !== "object" || Object.keys(value).sort().join() !== keys) throw new Error("Invalid session delivery.");
      const record = value as Record<string, unknown>;
      if (record.schema !== 1 || record.purpose !== purpose(binding) || Object.entries(binding).some(([name, expected]) => record[name] !== expected)
          || parseProof(record.cookie)?.id !== binding.sessionId) throw new Error("Delivery binding differs.");
      return record.cookie as string;
    },
  };
}

export type SessionDelivery = ReturnType<typeof sessionDelivery>;
