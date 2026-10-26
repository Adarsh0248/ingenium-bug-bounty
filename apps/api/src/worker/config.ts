import { LANGUAGES, uuid } from "../access/credentials.js";
import { privateJudgeAddress } from "../content/judge-driver.js";
import type { JudgeDriverSettings } from "../content/judge-driver.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";

const invalid = () =>
  new Error("Invalid private judging runtime configuration.");
export function runtimeObject(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()
  )
    throw invalid();
  return value as Record<string, unknown>;
}
export function judgeDescriptor(value: unknown) {
  const v = runtimeObject(value, ["host_epoch_id", "endpoint_ref", "runtimes"]);
  if (
    typeof v.endpoint_ref !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(v.endpoint_ref)
  )
    throw invalid();
  const raw = runtimeObject(v.runtimes, [...LANGUAGES]);
  const runtimes = new Map(
    LANGUAGES.map((language) => {
      const r = runtimeObject(raw[language], ["key", "digest"]);
      return [language, { key: r.key, digest: r.digest }] as const;
    }),
  ) as JudgeRuntimes;
  runtimeRecord(runtimes);
  return {
    hostEpochId: uuid(v.host_epoch_id),
    endpointRef: v.endpoint_ref,
    runtimes,
  };
}
export function parseWorkerRuntime(value: unknown) {
  const v = runtimeObject(value, [
    "schema_version",
    "database_url",
    "judge",
    "tls",
  ]);
  if (v.schema_version !== 1 || typeof v.database_url !== "string")
    throw invalid();
  const url = new URL(v.database_url);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname) ||
    !url.username ||
    !url.password ||
    url.username === "ingenium_api" ||
    url.pathname.length < 2 ||
    url.search ||
    url.hash
  )
    throw invalid();
  const tls = runtimeObject(v.tls, [
    "address",
    "port",
    "server_name",
    "server_certificate_sha256",
    "ca_pem",
    "certificate_pem",
    "private_key_pem",
  ]);
  if (
    typeof tls.address !== "string" ||
    !privateJudgeAddress(tls.address) ||
    !Number.isInteger(tls.port) ||
    (tls.port as number) < 1 ||
    (tls.port as number) > 65535 ||
    typeof tls.server_name !== "string" ||
    !/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(tls.server_name) ||
    typeof tls.server_certificate_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(tls.server_certificate_sha256)
  )
    throw invalid();
  for (const key of ["ca_pem", "certificate_pem", "private_key_pem"])
    if (
      typeof tls[key] !== "string" ||
      !tls[key] ||
      Buffer.byteLength(tls[key]) > 32768 ||
      /[^\x09\x0a\x0d\x20-\x7e]/.test(tls[key])
    )
      throw invalid();
  const driver: JudgeDriverSettings = {
    ...judgeDescriptor(v.judge),
    address: tls.address,
    port: tls.port as number,
    serverName: tls.server_name,
    serverCertificateSha256: tls.server_certificate_sha256,
    ca: Buffer.from(tls.ca_pem as string),
    certificate: Buffer.from(tls.certificate_pem as string),
    privateKey: Buffer.from(tls.private_key_pem as string),
  };
  return { databaseUrl: v.database_url, driver };
}
export function parseCompetitionRuntime(value: unknown) {
  const v = runtimeObject(value, [
    "schema_version",
    "draw_key",
    "draw_key_id",
    "judge",
  ]);
  if (
    v.schema_version !== 1 ||
    typeof v.draw_key !== "string" ||
    !/^[0-9a-f]{64}$/.test(v.draw_key) ||
    typeof v.draw_key_id !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(v.draw_key_id)
  )
    throw invalid();
  return {
    ...judgeDescriptor(v.judge),
    drawKey: Buffer.from(v.draw_key, "hex"),
    drawKeyId: v.draw_key_id,
  };
}
