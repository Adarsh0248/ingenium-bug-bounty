import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { LANGUAGES, sha256 } from "../src/access/credentials.js";
import { acceptAuthoringObservation } from "../src/content/execution-policy.js";
import { acceptJudgeReady, acceptJudgeReply, authoringRequest, judgeJson, readAuthoringRequest, readJudgeJson, runtimeRecord, JUDGE_BODY_LIMIT, JUDGE_PROTOCOL } from "../src/content/judge-protocol.js";
import { judgePayload, judgeReply, judgeRuntimes } from "./fixtures/judge.js";

test("participant provenance is digest-bound, round-trips exactly and cannot become an authoring compilation check", () => {
  const p = judgePayload("cpp"), nonce = randomUUID(), runtimes = judgeRuntimes();
  const digests = new Set<string>();
  for (const sourceRole of ["REFERENCE", "STARTER", "OFFICIAL", "SAMPLE"] as const) {
    const value = { ...p, sourceRole }, wire = authoringRequest(value, nonce, runtimes);
    digests.add(wire.payload_digest);
    assert.deepEqual(readAuthoringRequest(wire, nonce, p.hostEpochId, p.attemptId, wire.payload_digest, runtimes), value);
    assert.equal(acceptAuthoringObservation(value, acceptJudgeReply(judgeReply(value, nonce), value, nonce, 200), Buffer.from("12\n"), "EXACT_TEXT")!.result, "PASSED");
    if (sourceRole === "OFFICIAL" || sourceRole === "SAMPLE") assert.throws(() => authoringRequest({ ...value, checkType: "COMPILATION", stdin: Buffer.alloc(0) }, nonce, runtimes));
  }
  assert.equal(digests.size, 4);
});

test("judge requests preserve exact bytes and frozen settings without expected answers, callbacks or arbitrary options", () => {
  for (const language of LANGUAGES) {
    const p = judgePayload(language), requestId = randomUUID(), encoded = authoringRequest(p, requestId, judgeRuntimes());
    assert.deepEqual(Buffer.from(encoded.source_b64, "base64"), p.source);
    assert.deepEqual(Buffer.from(encoded.stdin_b64, "base64"), p.stdin);
    assert.equal(encoded.request_id, requestId); assert.equal(encoded.enable_network, false); assert.equal(encoded.number_of_runs, 1);
    assert.equal("expected_output" in encoded, false); assert.equal("callback_url" in encoded, false);
    assert.deepEqual(readJudgeJson(Buffer.from(judgeJson(encoded))), encoded);
    assert.throws(() => authoringRequest({ ...p, runtimeDigest: "0".repeat(64) }, requestId, judgeRuntimes()));
    for (const changed of [{ cpuMs: 0 }, { wallMs: 16000 }, { memoryKb: 524289 }, { source: Buffer.alloc(131073) }, { stdin: Buffer.alloc(1048577) }, { attemptId: "../escape" }]) {
      assert.throws(() => authoringRequest({ ...p, ...changed }, requestId, judgeRuntimes()));
    }
  }
  const p = judgePayload();
  assert.throws(() => authoringRequest({ ...p, checkType: "COMPILATION" }, randomUUID(), judgeRuntimes()));
  assert.throws(() => authoringRequest({ ...judgePayload("python"), checkType: "COMPILATION", stdin: Buffer.alloc(0) }, randomUUID(), judgeRuntimes()));
});
test("strict canonical judge JSON rejects duplicates, malformed UTF-8, alternate Base64, unknown data shapes and oversized transport", () => {
  for (const text of ['{"state":1,"state":2}', '{ "state":1}', '{"state":1.0}', '{"state":-0}', '{"state":"\\u0061"}', '{"__proto__":{}}', '{"state":[]}', '{"state":"\\ud800"}']) {
    assert.throws(() => readJudgeJson(Buffer.from(text)), text);
  }
  assert.throws(() => readJudgeJson(Buffer.from([255]))); assert.throws(() => readJudgeJson(Buffer.alloc(JUDGE_BODY_LIMIT + 1)));
  const p = judgePayload(), nonce = randomUUID(), valid = judgeReply(p, nonce);
  for (const encoded of ["MTIK\n", "MTI", "MTI_", "MTJ=", "====", "*", "A".repeat(1500000)]) {
    assert.throws(() => acceptJudgeReply({ ...valid, evidence: { ...valid.evidence, stdout_b64: encoded } }, p, nonce, 200));
  }
});
test("gateway request decoding binds path, headers, payload, fields and exact bytes before registration", () => {
  for (const language of LANGUAGES) {
    const p = judgePayload(language), nonce = randomUUID(), runtimes = judgeRuntimes(), value = authoringRequest(p, nonce, runtimes);
    assert.deepEqual(readAuthoringRequest(value, nonce, p.hostEpochId, p.attemptId, value.payload_digest, runtimes), p);
    for (const changed of [{ expected_output: "hidden" }, { request_id: randomUUID() }, { number_of_runs: 2 }, { enable_network: true },
      { runtime_digest: "0".repeat(64) }, { source_b64: value.source_b64 + "\n" }, { cpu_ms: "1000" }, { payload_digest: "0".repeat(64) }]) {
      assert.throws(() => readAuthoringRequest({ ...value, ...changed }, nonce, p.hostEpochId, p.attemptId, value.payload_digest, runtimes));
    }
    assert.throws(() => readAuthoringRequest(value, nonce, randomUUID(), p.attemptId, value.payload_digest, runtimes));
    assert.throws(() => readAuthoringRequest(value, nonce, p.hostEpochId, randomUUID(), value.payload_digest, runtimes));
  }
});
test("readiness proves the current challenge/host and all five immutable runtime bindings", () => {
  const p = judgePayload(), nonce = randomUUID(), runtimes = judgeRuntimes();
  const ready = { protocol: JUDGE_PROTOCOL, request_id: nonce, host_epoch_id: p.hostEpochId, ready: true, runtimes: runtimeRecord(runtimes) };
  acceptJudgeReady(ready, nonce, p.hostEpochId, runtimes);
  for (const changed of [{ ready: false }, { request_id: randomUUID() }, { host_epoch_id: randomUUID() }, { protocol: "stock-judge0" }, { extra: true }, { runtimes: {} }]) {
    assert.throws(() => acceptJudgeReady({ ...ready, ...changed }, nonce, p.hostEpochId, runtimes));
  }
  runtimes.set("cpp", { key: "changed", digest: "a".repeat(64) });
  assert.throws(() => acceptJudgeReady(ready, nonce, p.hostEpochId, runtimes));
});
test("finished evidence binds epoch/attempt/payload, one provider generation, captures, limits and source/runtime hashes", () => {
  const p = judgePayload(), nonce = randomUUID(), good = judgeReply(p, nonce);
  const reject = (value: unknown) => assert.throws(() => acceptJudgeReply(value, p, nonce, 200));
  for (const changed of [{ host_epoch_id: randomUUID() }, { attempt_id: randomUUID() }, { request_id: randomUUID() }, { payload_digest: "a".repeat(64) },
    { provider_token: null }, { execution_generation: "2" }, { extra: true }, { protocol: "stock" }]) reject({ ...good, ...changed });
  for (const changed of [{ source_sha256: "f".repeat(64) }, { stdin_sha256: "f".repeat(64) }, { runtime_digest: "f".repeat(64) }, { extra: true }]) {
    reject({ ...good, evidence: { ...good.evidence, metadata: { ...good.evidence.metadata, ...changed } } });
  }
  for (const changed of [{ tree_accounted: false }, { identity_verified: false }, { cpu_ns: "1.5" }, { peak_bytes: "9223372036854775808" },
    { exit_code: 0, exit_signal: 11 }, { limits: { cpu_ms: 1000, wall_ms: 5001, memory_kb: 262144 } }]) {
    reject({ ...good, evidence: { ...good.evidence, metadata: { ...good.evidence.metadata, run: { ...good.evidence.metadata.run, ...changed } } } });
  }
  const altered = structuredClone(good); altered.evidence.metadata.captures.stdout.sha256 = "0".repeat(64); reject(altered);
  const partial = structuredClone(good); partial.evidence.metadata.captures.stdout.complete = false; reject(partial);
});
test("all five languages preserve empty/binary stdout; only the backend frozen checker selects the answer", () => {
  for (const language of LANGUAGES) for (const bytes of [Buffer.alloc(0), Buffer.from([0, 255, 13, 10]), Buffer.from("12\n")]) {
    const p = judgePayload(language), nonce = randomUUID(), wire = judgeReply(p, nonce, bytes);
    const observation = acceptJudgeReply(wire, p, nonce, 200);
    assert.deepEqual(observation.stdout, bytes);
    const checked = acceptAuthoringObservation(p, observation, bytes, "EXACT_TEXT")!;
    assert.equal(checked.result, bytes.includes(255) ? "WRONG_ANSWER" : "PASSED");
    assert.equal(checked.metadata.supervisor_evidence, observation.supervisor_evidence);
  }
});
test("run causes use overflow/memory/time/abnormal precedence; ambiguous kills and infrastructure faults never invent participant verdicts", () => {
  const p = judgePayload(), nonce = randomUUID();
  const checks = [
    { cause: { output_limited: true, memory_limited: true, cpu_limited: true }, answer: "OUTPUT_LIMIT_EXCEEDED", overflow: true },
    { cause: { memory_limited: true, cpu_limited: true }, answer: "MEMORY_LIMIT_EXCEEDED" },
    { cause: { cpu_limited: true }, answer: "TIME_LIMIT_EXCEEDED" }, { cause: { wall_limited: true }, answer: "TIME_LIMIT_EXCEEDED" },
    { cause: { exit_code: 2, failure_attribution: "PARTICIPANT" }, answer: "RUNTIME_ERROR" },
    { cause: { exit_code: null, exit_signal: 11, failure_attribution: "PARTICIPANT" }, answer: "RUNTIME_ERROR" },
    { cause: { exit_code: null, exit_signal: 9 }, answer: "INFRA_ERROR" }, { cause: { exit_code: null, exit_signal: 15, failure_attribution: "PARTICIPANT" }, answer: "INFRA_ERROR" },
    { cause: { exit_code: null, exit_signal: 25 }, answer: "INFRA_ERROR" }, { cause: { exit_code: 2 }, answer: "INFRA_ERROR" },
    { cause: { infrastructure_error: true, memory_limited: true }, answer: "INFRA_ERROR" },
  ];
  for (const check of checks) {
    const wire = judgeReply(p, nonce, check.overflow ? Buffer.alloc(1048577) : Buffer.alloc(0));
    Object.assign(wire.evidence.metadata.run!, check.cause); wire.evidence.metadata.captures.stdout.complete = false;
    assert.equal(acceptJudgeReply(wire, p, nonce, 200).execution_result, check.answer);
  }
  const unsupported = judgeReply(p, nonce); unsupported.evidence.metadata.run!.output_limited = true;
  assert.throws(() => acceptJudgeReply(unsupported, p, nonce, 200));
});
test("compiler attribution is explicit, no run is invented, and interpreted syntax failures stay runtime failures", () => {
  for (const language of ["c", "cpp", "java"] as const) {
    const p = judgePayload(language), nonce = randomUUID(), wire = judgeReply(p, nonce, Buffer.alloc(0));
    wire.evidence.metadata.compile!.exit_code = 1; wire.evidence.metadata.run = null;
    assert.equal(acceptJudgeReply(wire, p, nonce, 200).execution_result, "INFRA_ERROR");
    wire.evidence.metadata.compile!.failure_attribution = "PARTICIPANT";
    assert.equal(acceptJudgeReply(wire, p, nonce, 200).execution_result, "COMPILATION_ERROR");
    wire.evidence.metadata.compile!.infrastructure_error = true;
    assert.equal(acceptJudgeReply(wire, p, nonce, 200).execution_result, "INFRA_ERROR");
    const compilation = { ...p, checkType: "COMPILATION" as const, stdin: Buffer.alloc(0) };
    assert.equal(acceptJudgeReply(judgeReply(compilation, nonce, Buffer.alloc(0)), compilation, nonce, 200).execution_result, "NORMAL");
  }
  for (const language of ["python", "javascript"] as const) {
    const p = judgePayload(language), nonce = randomUUID(), wire = judgeReply(p, nonce, Buffer.alloc(0));
    wire.evidence.metadata.run!.exit_code = 1; wire.evidence.metadata.run!.failure_attribution = "PARTICIPANT";
    assert.equal(acceptJudgeReply(wire, p, nonce, 200).execution_result, "RUNTIME_ERROR");
  }
});
test("absence is pending only, positive drain is separate, and a later cleanup proof leaves sealed evidence unchanged", () => {
  const p = judgePayload(), nonce = randomUUID(), wire = judgeReply(p, nonce);
  for (const state of ["PENDING", "ABSENT"]) {
    const pending = { ...wire, state, evidence: null, ...(state === "ABSENT" ? { provider_token: null, execution_generation: null } : {}) };
    assert.deepEqual(acceptJudgeReply(pending, p, nonce, state === "ABSENT" ? 404 : 202), { state: "PENDING" });
    assert.throws(() => acceptJudgeReply({ ...pending, payload_digest: "0".repeat(64) }, p, nonce, 404));
  }
  const proof = wire.evidence.metadata.drain; wire.evidence.metadata.drain = null;
  const held = acceptJudgeReply(wire, p, nonce, 200), result = acceptAuthoringObservation(p, held, Buffer.from("12\n"), "EXACT_TEXT")!;
  assert.equal(result.release, null);
  wire.evidence.metadata.drain = proof;
  const drained = acceptJudgeReply(wire, p, nonce, 200), released = acceptAuthoringObservation(p, drained, Buffer.from("12\n"), "EXACT_TEXT")!;
  assert.deepEqual(result.metadata, released.metadata); assert.equal(released.release!.length, 32);
  wire.evidence.metadata.drain!.processes_stopped = false;
  assert.throws(() => acceptJudgeReply(wire, p, nonce, 200));
});
test("full stdout/diagnostics stay bounded; private evidence preserves byte counts and truncation rather than clipping answers", () => {
  const p = judgePayload(), nonce = randomUUID(), wire = judgeReply(p, nonce, Buffer.alloc(1048576, 65));
  const bytes = Buffer.alloc(65536, 66), metadata = wire.evidence.metadata;
  wire.evidence.stderr_b64 = wire.evidence.compiler_output_b64 = bytes.toString("base64");
  metadata.captures.stderr = metadata.captures.compiler = { bytes: bytes.length, sha256: sha256(bytes).toString("hex"), truncated: true };
  const observation = acceptJudgeReply(readJudgeJson(Buffer.from(judgeJson(wire))), p, nonce, 200);
  const checked = acceptAuthoringObservation(p, observation, Buffer.alloc(1048576, 65), "TOKENS")!;
  assert.equal(checked.result, "PASSED"); assert.equal(checked.stdoutPrefix.length, 16384); assert.equal(checked.stderr.length, 65536);
  assert.equal(checked.metadata.stderr_truncated, true);
  wire.evidence.stderr_b64 = Buffer.alloc(65537).toString("base64");
  assert.throws(() => acceptJudgeReply(wire, p, nonce, 200));
  assert.throws(() => acceptAuthoringObservation(p, { ...observation, supervisor_evidence: { oversized: "a".repeat(32768) } }, Buffer.alloc(0), "TOKENS"));
});
