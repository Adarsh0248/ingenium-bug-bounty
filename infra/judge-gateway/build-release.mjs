import assert from "node:assert/strict";
import { build } from "esbuild";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isBuiltin } from "node:module";
import { ISOLATE_CONFIGURATION } from "../../apps/api/dist/judge/isolate-context.js";

assert.equal(process.argv.length, 2, "This builder takes no settings, credentials or installation options.");
const repo = fileURLToPath(new URL("../../", import.meta.url)), output = join(repo, "build", `judge-runtime-${randomUUID()}`);
await mkdir(join(output, "app", "judge"), { recursive: true });
const files = [];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for (const name of ["host-cli", "capsule-cli"]) {
  const result = await build({ absWorkingDir: repo, entryPoints: [`apps/api/src/judge/${name}.ts`], outfile: join(output, "app", "judge", `${name}.js`),
    bundle: true, platform: "node", format: "esm", target: "node24", external: ["pg-native"], metafile: true,
    banner: { js: "import {createRequire as __ingeniumRequire} from 'node:module';const require=__ingeniumRequire(import.meta.url);" }, logLevel: "silent" });
  for (const item of Object.values(result.metafile.outputs)) for (const dependency of item.imports)
    assert.ok(!dependency.external || isBuiltin(dependency.path) || dependency.path === "pg-native", "Unexpected external runtime dependency.");
  files.push(`app/judge/${name}.js`);
}
const copies = ["Dockerfile", "image-tree.py", "ingenium-isolate-executor.apparmor", "native/phase-exec.c", "native/host-observe.c", "native/docker-peer-exec.c", "native/launch.c",
  "security/seccomp.json", "security/LICENSE.moby", "security/SOURCE.md", "001_registry.sql", "002_queue.sql", "003_execution_lookup.sql", "004_launch_gate.sql", "005_participant_payloads.sql", "006_supervisor_service.sql", "007_eight_slots.sql"];
for (const name of copies) {
  const target = name === "ingenium-isolate-executor.apparmor" ? "security/apparmor" : name;
  await mkdir(dirname(join(output, target)), { recursive: true }); await copyFile(new URL(name, import.meta.url), join(output, target)); files.push(target);
}
await writeFile(join(output, "app/package.json"), '{"type":"module","private":true}\n'); files.push("app/package.json");
await writeFile(join(output, "security/isolate"), ISOLATE_CONFIGURATION); files.push("security/isolate");
await mkdir(join(output, "docker-client")); await writeFile(join(output, "docker-client/config.json"), "{}\n"); files.push("docker-client/config.json");
const records = [];
for (const path of files.sort()) { const bytes = await readFile(join(output, path)); assert.ok(bytes.length < 16777216); records.push({ path, size: bytes.length, sha256: hash(bytes) }); }
const manifest = JSON.stringify({ protocol: "ingenium-judge-build-v1", host_verified: false, files: records });
await writeFile(join(output, "bundle.json"), manifest + "\n");
console.log(JSON.stringify({ directory: output, bundle_sha256: hash(Buffer.from(manifest + "\n")), host_verified: false }));
