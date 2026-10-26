import { LANGUAGES, uuid } from "../access/credentials.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import { runtimeObject } from "../worker/config.js";
import { reviewedHostRelease } from "./host-installation.js";
import { ISOLATE_BINARIES } from "./isolate-context.js";

export function parseHostRuntime(value: unknown) {
  const v = runtimeObject(value, ["schema_version", "database_url", "host_epoch_id", "boot_id", "runtimes", "executables", "kernel_release", "image_tree_sha256", "release", "manifest"]);
  if (v.schema_version !== 1 || typeof v.database_url !== "string" || typeof v.kernel_release !== "string" || !/^6\.8\.[A-Za-z0-9._+-]{1,100}$/.test(v.kernel_release)
    || typeof v.image_tree_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.image_tree_sha256)) throw new Error("Invalid host runtime.");
  const url = new URL(v.database_url);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "[::1]"].includes(url.hostname) || !url.username || !url.password
    || url.pathname.length < 2 || url.search || url.hash) throw new Error("Restricted loopback judge database required.");
  const raw = runtimeObject(v.runtimes, [...LANGUAGES]), runtimes: JudgeRuntimes = new Map(LANGUAGES.map(language => {
    const row = runtimeObject(raw[language], ["key", "digest"]); return [language, { key: row.key as string, digest: row.digest as string }];
  }));
  runtimeRecord(runtimes);
  const tags = ["isolate", "phase_exec", "gcc", "gpp", "python", "node", "java", "javac"], executables = runtimeObject(v.executables, tags);
  const binaries = Object.fromEntries(ISOLATE_BINARIES.map((path, i) => {
    const hash = executables[tags[i]!]; if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) throw new Error("Invalid pinned runtime."); return [path, hash];
  })) as Record<typeof ISOLATE_BINARIES[number], string>;
  const rawRelease = runtimeObject(v.release, ["image_id", "digest"]);
  if (typeof rawRelease.image_id !== "string" || typeof rawRelease.digest !== "string") throw new Error("Invalid release.");
  const release = { imageId: rawRelease.image_id, digest: rawRelease.digest }, manifest = reviewedHostRelease(v.manifest, release);
  for (const [path, mode] of [["app/judge/host-cli.js", 0o444], ["host-observe", 0o555], ["python", 0o555], ["image-tree.py", 0o444], ["security/apparmor.bin", 0o444]] as const)
    if (!manifest.files.some(file => file.path === path && file.mode === mode && file.size > 0)) throw new Error("Complete host release required.");
  return { hostEpochId: uuid(v.host_epoch_id), bootId: uuid(v.boot_id), runtimes, binaries, databaseUrl: url.toString(), release, manifest,
    kernelRelease: v.kernel_release, imageTreeSha256: v.image_tree_sha256, observerSha256: manifest.files.find(file => file.path === "host-observe")!.sha256 };
}
