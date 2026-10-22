// Protocol/pipe fixture only. It never compiles or runs the supplied source.
const { createHash } = require("node:crypto");
if (require.main === module) {
const argument = process.argv[2], mode = ["--execute", "--recover"].includes(argument) ? "reply" : argument === "--ready" ? "ready" : argument;
const chunks = [];
process.stdin.on("data", chunk => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = Buffer.concat(chunks);
  if (mode === "hang") return setInterval(() => {}, 1000);
  if (mode === "exit") return process.exit(1);
  if (mode === "oversize") return process.stdout.end(Buffer.alloc(2097153, 65));
  if (mode === "stderr") { process.stderr.write("private synthetic diagnostic must never escape"); return process.stdout.end(input); }
  if (mode === "stderr-overflow") { process.stderr.write(Buffer.alloc(16385, 65)); return process.stdout.end(input); }
  if (mode === "partial") return process.stdout.end("{\"unfinished\":");
  if (mode === "binary") return process.stdout.end(Buffer.from([255, 0]));
  if (mode === "echo") return process.stdout.end(input);
  if (mode === "ready") {
    const r = JSON.parse(input);
    return process.stdout.end(canonical({ ...r, ready: true, proof_digest: "c".repeat(64) }));
  }
  if (mode !== "reply") return process.exit(2);
  process.stdout.end(canonical(reply(JSON.parse(input))));
});
}
function reply(request) {
  const p = request.payload;
  const hash = raw => createHash("sha256").update(raw).digest("hex");
  const out = p.check_type === "COMPILATION" ? Buffer.alloc(0) : Buffer.from("12\n"), empty = Buffer.alloc(0);
  const phase = limits => ({ limits, identity_verified: true, tree_accounted: true, exit_code: 0, exit_signal: null,
    cpu_limited: false, wall_limited: false, memory_limited: false, output_limited: false, infrastructure_error: false,
    failure_attribution: null, cpu_ns: "10000", peak_bytes: "4096" });
  const response = { protocol: request.protocol, operation: request.operation, request_id: request.request_id, host_epoch_id: request.host_epoch_id,
    boot_id: request.boot_id, permit_owner: request.permit_owner, reply: {
      protocol: "ingenium-authoring-v1", request_id: request.request_id, host_epoch_id: p.host_epoch_id, attempt_id: p.attempt_id,
      payload_digest: p.payload_digest, state: "FINISHED", provider_token: request.provider_token, execution_generation: "1", evidence: {
        metadata: { runtime_digest: p.runtime_digest, source_sha256: hash(Buffer.from(p.source_b64, "base64")), stdin_sha256: hash(Buffer.from(p.stdin_b64, "base64")),
          compile: ["c", "cpp", "java"].includes(p.language) ? phase({ cpu_ms: 15000, wall_ms: 30000, memory_kb: 1048576 }) : null,
          run: p.check_type === "COMPILATION" ? null : phase({ cpu_ms: p.cpu_ms, wall_ms: p.wall_ms, memory_kb: p.memory_kb }),
          captures: { stdout: { bytes: out.length, sha256: hash(out), complete: true }, stderr: { bytes: 0, sha256: hash(empty), truncated: false }, compiler: { bytes: 0, sha256: hash(empty), truncated: false } },
          drain: { cannot_start: true, processes_stopped: true, workspace_removed: true, proof_digest: "c".repeat(64) } },
        stdout_b64: out.toString("base64"), stderr_b64: "", compiler_output_b64: "" } } };
  return response;
}
module.exports = { reply };
function canonical(value) { return value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value); }
