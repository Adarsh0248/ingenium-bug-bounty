# Private Authoring Judge Protocol

The application-side client is implemented in `judge-driver.ts`, with strict wire
decoding and cause selection in `judge-protocol.ts`. It implements the existing
`TrustedAuthoringDriver` interface used by the durable validation worker. This is
not a deployed general supervisor, nor permission to send arbitrary code into the
historical Judge0 lab. No startup path constructs this client automatically.

## Connection And Trust

The operator supplies one immutable host epoch, endpoint reference, fixed private
IPv4 address/port, TLS DNS name, exact server leaf-certificate SHA-256, private CA,
epoch-specific client certificate/key and all five runtime key/digest bindings.
These are internal process inputs, never browser fields or public API options.
CA, key and certificate bytes and runtime bindings are copied at construction.

The client uses Node's HTTPS/TLS implementation, not a new HTTP dependency:

- TLS 1.3, normal CA/expiry/name verification **and** exact certificate pinning.
  The DNS name is verified against the certificate but never resolved to choose
  a destination. Only the configured IP is contacted.
- Mutual TLS presents the configured client certificate. The eventual gateway
  must require it and authorise its exact credential for this epoch; possession
  of any certificate from the same CA must not grant execution access.
- Address allowlist: RFC1918 IPv4, plus exactly `127.0.0.1` for local encrypted
  rehearsals. Production uses the separate judge VM's private address. Public,
  metadata, DNS destinations and IPv6 addresses are refused. This is not a
  substitute for the approved private firewall and sandbox network denial.
- Two-second TCP/TLS establishment and ten-second whole-request deadlines,
  including upload, headers and response. Caller cancellation also destroys
  the request. A trickling peer cannot keep resetting the total deadline.
- At most 16 KiB response headers and 2 MiB request/response bodies. Streamed
  responses are counted before retention. Declared excessive lengths, partial
  messages, trailers, compression and non-JSON media are rejected.
- No redirects, automatic POST retry, callbacks, environment proxy, arbitrary
  path/URL setting, shared socket/session cache or insecure TLS mode.

See the official [Node HTTPS documentation](https://r2.nodejs.org/docs/v24.0.1/api/https.html)
for the TLS verification/pinning APIs and [HTTP documentation](https://nodejs.org/api/http.html)
for request cancellation. Ordinary socket timeout notifications alone do not
abort work; this client explicitly destroys timed-out requests.

## Wire Encoding

Version: `ingenium-authoring-v1`. JSON is compact ASCII with recursively sorted
object keys, no whitespace, arrays, alternate number spellings or duplicate keys.
Strings in this control protocol are printable ASCII; source, stdin and streams
use canonical padded standard Base64. Decoding must reproduce the same Base64
text exactly. Empty strings represent real zero-byte captures, never JSON null.
Do not trim, normalise UTF-8/BOM/newlines, replace NUL or decode program output as
text in the transport. Exact integer resource values stay in milliseconds/KiB.

Every request sends `X-Ingenium-Request-Id` (fresh UUIDv4),
`X-Ingenium-Host-Epoch`, the fixed TLS `Host`, `Accept: application/json`,
`Accept-Encoding: identity`, `Cache-Control: no-store` and `Connection: close`.
Responses must echo the challenge and epoch in their JSON. Do not cache them.
Attempt requests additionally send `X-Ingenium-Payload-Digest` on both POST and
GET, so an absent-record lookup can echo the requested binding without storing
or guessing source. The gateway must compare header/path/body identities and
must reject a known association with a different digest.

Only these routes exist in this client:

| Method | Path | Accepted status |
| --- | --- | --- |
| GET | `/ingenium/v1/authoring/ready` | 200 |
| POST | `/ingenium/v1/authoring/attempts/<attempt UUID>` | 200, 201, 202 |
| GET | `/ingenium/v1/authoring/attempts/<attempt UUID>` | 200, 404 |

Readiness has exactly `protocol`, `request_id`, `host_epoch_id`, `ready` and
`runtimes`. `ready` must be true; `runtimes` has exactly `c`, `cpp`, `java`,
`python`, `javascript`, each with its pinned `key` and lowercase 64-hex `digest`.
The worker still independently checks these bindings against PostgreSQL before
claiming ownership. Readiness cannot register a host or change a manifest.

The POST has exactly these fields, generated from the frozen application payload:

```text
protocol, request_id, host_epoch_id, attempt_id, run_id, check_id,
payload_digest, runtime_key, runtime_digest, language, source_role, check_type,
source_b64, stdin_b64, cpu_ms, wall_ms, memory_kb,
number_of_runs (always 1), enable_network (always false)
```

`payload_digest` is the existing `authoringPayloadDigest`: typed length-prefixed
fields binding all identities, source/input hashes and byte lengths, runtime and
limits. It is not an authentication credential. Expected answers, witnesses,
hints, callbacks, shell commands, compiler flags and extra files are never sent.
The gateway must revalidate the payload, choose only reviewed fixed commands and
create the private Judge0 record with `wait=false`, `base64_encoded=true`,
`number_of_runs=1`, no expected output, no network and separate stderr.

## Association And Results

Every attempt response has exactly:

```text
protocol, request_id, host_epoch_id, attempt_id, payload_digest,
state, provider_token, execution_generation, evidence
```

Identity/challenge/digest must match the exact request. A canonical provider UUID
and execution generation string `"1"` are required once an association exists.
Version 1 authorises one provider launch per attempt; a safe application retry
gets a different attempt UUID, not another generation on the old record.

- `ABSENT`: GET 404 only; token/generation/evidence must all be null. Converted
  to pending, never a safe resend, negative execution proof or slot release.
- `PENDING`: an associated provider record, null evidence. No result or release.
- `FINISHED`: mandatory bounded evidence. A stock Judge0 status or terminal-looking
  label is not accepted. Unknown fields/states or malformed bodies are unusable
  infrastructure observations, not wrong submissions.

The **gateway** must durably bind epoch/attempt/payload to one provider token,
commit its outbox with admission, fence one launch before running isolate and
preserve that association/results across process restarts. GET must look up this
exact association, not compare source or guess the newest submission. The client
does not itself implement that provider-side store/permit. The application worker
already commits its local one-time send permission before POST and uses GET after
any ambiguous send; it never calls POST again merely because GET says absent.

## Evidence Shape

`evidence` has exactly `metadata`, `stdout_b64`, `stderr_b64`,
`compiler_output_b64`. Structured supporting evidence is limited to 32 KiB.
Decoded stdout is at most 1 MiB plus one overflow sentinel; each diagnostic is at
most 64 KiB. Capture metadata independently binds retained byte lengths/digests
and completeness/truncation flags before any output reaches the checker.

`metadata` has exactly:

```text
runtime_digest, source_sha256, stdin_sha256, compile, run, captures, drain
```

`captures` contains `stdout`, `stderr`, `compiler`. Each has `bytes`, `sha256`
and either `complete` (stdout) or `truncated` (diagnostics). Byte counts describe
the retained bytes, not an invented total after truncation.

Compiled languages require a compile phase with the approved 15,000 ms CPU,
30,000 ms wall and 1,048,576 KiB memory limits. Interpreters require null compile
and no compiler stream. A compilation-only check never creates a run phase.
Otherwise a successful compilation is followed by the exact variant run limits.
Each phase has exactly:

```text
limits: {cpu_ms, wall_ms, memory_kb}, identity_verified, tree_accounted,
exit_code, exit_signal, cpu_limited, wall_limited, memory_limited,
output_limited, infrastructure_error, failure_attribution, cpu_ns, peak_bytes
```

Identity/tree flags must be true. Exit code/signal are mutually exclusive nullable
bounded integers; accounting values are nonnegative signed-64-bit decimal strings.
`failure_attribution` is null, `PARTICIPANT` or `INFRASTRUCTURE`.

These assertions must come from the trusted reviewed supervisor, never program
stderr, a public JSON body, a stock status number or a guessed memory measurement.
In particular, generic compiler failure attribution remains a **required live
producer verification gate**; the old fixed compiler witness is not sufficient.
TLS authenticates the service, not the correctness of its implementation.

The client derives categories, rather than accepting a provider acceptance label:
infrastructure uncertainty first; then proven stdout overflow, memory, CPU/wall,
attributable abnormal exit, and only then complete normal output. Overflow needs
the actual sentinel byte. SIGKILL/SIGTERM/SIGXFSZ without an independent limit
cause remain infrastructure-uncertain. Failed compilation requires explicit
participant attribution or remains infrastructure error. Python/JS syntax errors
are attributable runtime failures. The application frozen checker alone selects
normal-output `PASSED`/`WRONG_ANSWER`, including invalid UTF-8 as wrong output.

`drain` is null or exactly `cannot_start: true`, `processes_stopped: true`,
`workspace_removed: true`, `proof_digest` of the durable supervisor cleanup proof.
The real producer must establish those facts with process/queue fencing and
physical cleanup. The client cannot infer them from an HTTP timeout or label.

Bounded supporting phases/provider identity are retained in the attempt's private
evidence, along with a digest of their canonical bound JSON. Request challenge and
drain are excluded from the immutable result digest: a later authentic drain can
release capacity without rewriting the result. The normal release fingerprint
still binds its proof to this attempt/epoch/payload. Ordinary staff progress
reports contain neither provider identities nor raw diagnostics/supporting data.

## Verification And Remaining Gate

Local tests exercise the real HTTPS client against a synthetic loopback mTLS
server: trusted/untrusted clients, CA/name/pin checks, five-language payloads,
maximum body sizes, binary/empty output, lost replies with GET recovery, bounded
headers/streams, redirects/compression, caller cancellation and real two/ten-second
timeouts. Test certificates are generated in an owned temporary directory using
OpenSSL (Git's bundled executable on Windows, `openssl` on Linux), removed at test
end and never installed or reused as event credentials. Tests fail if OpenSSL is
missing; there is no TLS-bypass fallback or skipped security assertion.

Disposable PostgreSQL tests also settle decoded synthetic wire evidence through
the real worker, retain it privately and keep normal reports source-free.
**These fixtures execute no submitted code.** No real host is registered, runtime
certified, historical controller rerun, cloud service changed or app route enabled.

The [general gateway/registry](../infra/judge-gateway/README.md) now implements
private HTTPS admission/lookup, durable association/outbox, once-only provider
permits and private sealed-result storage. Its local database/HTTPS tests use a
structural provider fixture and synthetic evidence, not the real engine. Its
judge-only Redis publisher/guarded receiver is also implemented and tested against
real disposable Redis and PostgreSQL; queue data contains only attempt/token
identities and cannot grant a second launch or prove physical cleanup. The
[execution/recovery handoff](judge-executor.md) connects those permits to a fixed
launcher client; real Linux descriptor/file/boot checks pass with a synthetic
launcher, not a general sandbox producer.
Next: implement and verify that protected isolate producer and supervisor
readiness, then connect the worker process with
independent maintenance scheduling. Real five-language,
adversarial isolation, drain/retirement, restart, deployment and load checks must
pass before publication or participant judging. This client alone is not an
event-ready judge.
