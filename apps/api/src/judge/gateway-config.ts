import { LANGUAGES, uuid } from "../access/credentials.js";
import { privateJudgeAddress } from "../content/judge-driver.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import { runtimeObject } from "../worker/config.js";

export function parseGatewayRuntime(value: unknown) {
  const v = runtimeObject(value, ["schema_version", "database_url", "host_epoch_id", "boot_id", "runtimes", "listen_address", "port", "tls"]);
  if (v.schema_version !== 1 || typeof v.database_url !== "string" || typeof v.listen_address !== "string"
    || !privateJudgeAddress(v.listen_address) || !Number.isInteger(v.port) || (v.port as number) < 1024 || (v.port as number) > 65535) throw new Error("Invalid private judge gateway.");
  const url = new URL(v.database_url);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "[::1]"].includes(url.hostname)
    || !url.username || !url.password || url.pathname.length < 2 || url.search || url.hash) throw new Error("Private loopback database required.");
  const raw = runtimeObject(v.runtimes, [...LANGUAGES]);
  const runtimes = new Map(LANGUAGES.map(language => {
    const row = runtimeObject(raw[language], ["key", "digest"]);
    return [language, { key: row.key, digest: row.digest }];
  })) as JudgeRuntimes;
  runtimeRecord(runtimes);
  const tls = runtimeObject(v.tls, ["server_name", "worker_address", "worker_certificate_sha256", "ca_pem", "certificate_pem", "private_key_pem"]);
  if (typeof tls.server_name !== "string" || !/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(tls.server_name)
    || typeof tls.worker_address !== "string" || !privateJudgeAddress(tls.worker_address)
    || typeof tls.worker_certificate_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(tls.worker_certificate_sha256)) throw new Error("Invalid gateway peer identity.");
  for (const name of ["ca_pem", "certificate_pem", "private_key_pem"]) {
    const pem = tls[name];
    if (typeof pem !== "string" || pem.length < 1 || Buffer.byteLength(pem) > 32768 || /[^\x09\x0a\x0d\x20-\x7e]/.test(pem)) throw new Error("Invalid private TLS material.");
  }
  return {
    databaseUrl: url.toString(), hostEpochId: uuid(v.host_epoch_id), bootId: uuid(v.boot_id), runtimes,
    listenAddress: v.listen_address, port: v.port as number, serverName: tls.server_name, workerAddress: tls.worker_address,
    workerCertificateSha256: tls.worker_certificate_sha256, ca: Buffer.from(tls.ca_pem as string), certificate: Buffer.from(tls.certificate_pem as string), privateKey: Buffer.from(tls.private_key_pem as string),
  };
}
