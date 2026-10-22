import { randomUUID } from "node:crypto";
import { LANGUAGES, sha256 } from "../../src/access/credentials.js";
import type { Language } from "../../src/access/credentials.js";
import { authoringPayloadDigest } from "../../src/content/execution-policy.js";
import type { AuthoringPayload } from "../../src/content/execution-policy.js";
import { JUDGE_PROTOCOL } from "../../src/content/judge-protocol.js";
import type { CapsuleResources } from "../../src/judge/capsule-lifecycle.js";

// Protocol/transport fixtures only: never a native host preparation or cleanup authority.
export const syntheticCapsuleResources: CapsuleResources = { async prepare() {}, async verify() {}, async retire() {} };

export function judgeRuntimes() { return new Map(LANGUAGES.map(language => [language, { key: `synthetic-${language}`, digest: sha256(language).toString("hex") }])); }
export function judgePayload(language: Language = "cpp"): AuthoringPayload {
  const runtime = judgeRuntimes().get(language)!;
  return { attemptId: randomUUID(), hostEpochId: randomUUID(), runId: randomUUID(), checkId: randomUUID(), language, runtimeKey: runtime.key, runtimeDigest: runtime.digest,
    sourceRole: "REFERENCE", checkType: "TEST_CASE", source: Buffer.from("synthetic fixture\0\r\n"), stdin: Buffer.from("7 5\n"), cpuMs: 1000, wallMs: 5000, memoryKb: 262144 };
}
export function judgePhase(limits: { cpu_ms: number; wall_ms: number; memory_kb: number }) {
  return { limits, identity_verified: true, tree_accounted: true, exit_code: 0 as number | null, exit_signal: null as number | null,
    cpu_limited: false, wall_limited: false, memory_limited: false, output_limited: false, infrastructure_error: false,
    failure_attribution: null as "PARTICIPANT" | "INFRASTRUCTURE" | null, cpu_ns: "10000", peak_bytes: "4096" };
}
export function judgeReply(p: AuthoringPayload, requestId: string, stdout = Buffer.from("12\n"), providerToken: string = randomUUID()) {
  const stderr = Buffer.alloc(0), compiler = Buffer.alloc(0);
  return { protocol: JUDGE_PROTOCOL, request_id: requestId, host_epoch_id: p.hostEpochId, attempt_id: p.attemptId,
    payload_digest: authoringPayloadDigest(p).toString("hex"), state: "FINISHED", provider_token: providerToken as string | null, execution_generation: "1" as string | null,
    evidence: { metadata: { runtime_digest: p.runtimeDigest, source_sha256: sha256(p.source).toString("hex"), stdin_sha256: sha256(p.stdin).toString("hex"),
      compile: ["c", "cpp", "java"].includes(p.language) ? judgePhase({ cpu_ms: 15000, wall_ms: 30000, memory_kb: 1048576 }) : null,
      run: p.checkType === "COMPILATION" ? null : judgePhase({ cpu_ms: p.cpuMs, wall_ms: p.wallMs, memory_kb: p.memoryKb }),
      captures: { stdout: { bytes: stdout.length, sha256: sha256(stdout).toString("hex"), complete: true },
        stderr: { bytes: 0, sha256: sha256(stderr).toString("hex"), truncated: false }, compiler: { bytes: 0, sha256: sha256(compiler).toString("hex"), truncated: false } },
      drain: { cannot_start: true, processes_stopped: true, workspace_removed: true, proof_digest: "c".repeat(64) } as null | { cannot_start: boolean; processes_stopped: boolean; workspace_removed: boolean; proof_digest: string } },
      stdout_b64: stdout.toString("base64"), stderr_b64: "", compiler_output_b64: "" } };
}
