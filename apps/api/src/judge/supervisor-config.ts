import { LANGUAGES, uuid } from "../access/credentials.js";
import { privateJudgeAddress } from "../content/judge-driver.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import { runtimeObject } from "../worker/config.js";

export function parseSupervisorRuntime(value: unknown) {
  const v = runtimeObject(value, ["schema_version", "supervisor_database_url", "publisher_database_url", "host_epoch_id", "boot_id", "runtimes", "launcher_sha256", "redis"]);
  if (v.schema_version !== 1 || typeof v.launcher_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.launcher_sha256)) throw new Error("Invalid judge runtime.");
  function database(value: unknown) {
    if (typeof value !== "string") throw new Error("Invalid private database.");
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "[::1]"].includes(url.hostname)
      || !url.username || !url.password || url.pathname.length < 2 || url.search || url.hash) throw new Error("Private loopback database required.");
    return url;
  }
  const supervisor = database(v.supervisor_database_url), publisher = database(v.publisher_database_url);
  if (supervisor.username === publisher.username || supervisor.hostname !== publisher.hostname || supervisor.port !== publisher.port
    || supervisor.pathname !== publisher.pathname) throw new Error("Separate roles on one judge database required.");
  const raw = runtimeObject(v.runtimes, [...LANGUAGES]);
  const runtimes = new Map(LANGUAGES.map(language => {
    const row = runtimeObject(raw[language], ["key", "digest"]);
    return [language, { key: row.key, digest: row.digest }];
  })) as JudgeRuntimes;
  runtimeRecord(runtimes);
  const redis = runtimeObject(v.redis, ["address", "port", "password"]);
  if (typeof redis.address !== "string" || !privateJudgeAddress(redis.address) || !Number.isInteger(redis.port)
    || (redis.port as number) < 1 || (redis.port as number) > 65535 || typeof redis.password !== "string"
    || !/^[0-9a-f]{64}$/.test(redis.password)) throw new Error("Invalid private Redis.");
  return {
    hostEpochId: uuid(v.host_epoch_id), bootId: uuid(v.boot_id), runtimes, launcherSha256: v.launcher_sha256,
    supervisorDatabaseUrl: supervisor.toString(), publisherDatabaseUrl: publisher.toString(),
    redis: { address: redis.address, port: redis.port as number, password: redis.password },
  };
}
