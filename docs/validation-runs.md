# Validation Run Queue

Current UI: [validation runs and publication review](content-validation-ui.md)
now connects bounded snapshot/run history, progress, human review and confirmed
publication. The non-executable preparation contract and report's `can_publish:
false` field remain unchanged: they never bypass the separate publication command.
Normal startup still installs no production judge/worker.

The backend now has durable validation runs, complete typed check jobs, execution
attempts, worker ownership, private progress reports and bounded recovery. This
extends [snapshot preparation](content-validation.md). It is not the production
cloud driver or a claim that arbitrary competition code can safely run today.

Default startup installs no host epoch, driver, worker loop or credentials. New
run admission returns a pre-admission 503 until a compatible registered host has
a current worker lease. There is no browser field, staff button or HTTP endpoint
for asserting runner readiness, injecting a result or marking a question passed.

## Admission And Identity

- A current normal Owner/Super Admin chooses a frozen snapshot, supplies its
  expected content revision, a UUID request key and a reason. Stale/current-draft
  mismatch, non-draft status and an active arena are durable domain rejections.
  Worker/capacity refusal rolls back the prospective receipt and job set.
- Known same-key requests recover the immutable original receipt before new
  capacity gates. Changed intent returns a key conflict. Reruns use a new run ID;
  a finished run is never reopened or made to describe later draft content.
- Admission copies every check template into owned `authoring_checks` in the same
  transaction as the run and receipt. At most one validation is active globally,
  with at most 115 required jobs within the approved 120-job authoring ceiling.
- The run pins its snapshot/fingerprint, host epoch, policy version and fixed
  ten-minute request-to-finish deadline. Source, runtime, limits, sample/hidden
  cases and expected results continue to resolve through the immutable snapshot.
  Expected answers are never included in the execution payload.
- ACTIVE host epochs have immutable endpoint references and five immutable
  language/runtime bindings. Driver readiness and runtime digests must match
  those registered records before obtaining a worker lease. No real compatible
  epoch is provisioned by these migrations or synthetic tests.

## Dispatch And Recovery

`createValidationWorker` is an internal orchestration component, not a participant
endpoint. A `TrustedAuthoringDriver` implementation must authenticate/verify the
general supervisor protocol and its evidence before returning an observation.
Stock Judge0 status JSON cannot satisfy that trust contract. The application-side
[pinned mutual-TLS client and strict protocol decoder](judge-protocol.md) now
implement this interface. A separate [gateway/registry](../infra/judge-gateway/README.md)
now provides transactional registration, private lookup and once-only permit
bookkeeping. Its judge-only Redis publisher and guarded receiver now reconcile
duplicate/lost deliveries through those permits, including reconstruction after
Redis loses acknowledged messages. The [execution/recovery handoff](judge-executor.md)
now connects that receiver to a fixed protected-launcher client with strict result
validation and no fresh launch during recovery. The launcher control core also
requires a separate committed once-only backend start and seals validated evidence
before reply. Protected disk checkpoints now retain validated results across a
producer crash or failed database seal; recovery never repeats execution. Fixed
language plans, result storage, native handoff, bounded phase I/O, once-only source
workspace preparation and cgroup-v1 accounting are connected by a per-capsule
Isolate backend and private one-job entry point. Results and physical capsule
identities are retained before reply; recovery never repeats a phase. Raw phase
capture still grants no verdict or release on its own. Actual VM enforcement,
outer host provisioning/retirement, complete runtime/security calibration and
service/deployment wiring remain gates. No production host is certified here.

The worker uses a persisted 30-second lease with increasing generation. Every
state-changing tick renews/rechecks current ownership. A successor can reconcile
an older attempt without rewriting its captured original worker/generation.
Accidentally overlapping processes cannot both own the current lease. One worker
instance refuses overlapping ticks; the initial authoring loop processes one
check at a time within the two stable development physical slots.

Before POST, a short transaction commits the owned attempt, physical reservation,
payload fingerprint and one-time `PREPARED -> SEND_STARTED` permission. Only the
freshly committed caller invokes `submit`. Neither database locks nor transactions
remain open during submission or observation. A lost commit acknowledgement does
not send; a lost POST reply does not resend. Successors call `observe` for that
same attempt ID/host/payload. Mere provider absence is pending, not proof that an
old sender cannot resume later.

Read tracking is separately rate-limited in PostgreSQL: first observation is no
earlier than 500 ms, then roughly one/two/five seconds with bounded jitter, capped
at five seconds. A duplicate or restarted caller cannot reset the saved gate or
poll counter. Only one read is in flight per initial worker. The bounded 10,000
poll-turn ceiling leaves unresolved physical work held for operator attention;
it does not fabricate a verdict or permit another POST. No raw heartbeat-response
history is retained.

Only a reliably recorded `INFRA_ERROR` with positive physical drain proof may
retry automatically. Backoff is two seconds, then five seconds; maximum three
attempts per check. Reliable wrong output, compilation/runtime/resource failures
and an unmatched defect witness do not retry. Other required checks continue
while a failed check waits. No retry changes the snapshot or whole-run deadline.

## Results And Physical Safety

The observation boundary rejects foreign attempt/host/runtime/source/input/payload
bindings, malformed counters, unknown categories and oversized streams. Reliable
normal completion uses the backend's frozen checker on full stdout, not a
provider acceptance label. Incomplete stdout is not an answer. Private storage
retains at most a labelled 16 KiB stdout prefix, 64 KiB stderr and compiler output
with truncation flags, bounded structured evidence and exact digests/accounting.
An attempt's sealed result bytes cannot change on a later poll.

Logical settlement and physical release are independent. Only positive evidence
that the attempt cannot start again, its processes stopped and its workspace was
removed releases its physical slot. A missing reply, lease expiry, result label,
deadline or parent completion is insufficient. The original barrier remains
reserved even after logical completion if physical uncertainty remains. A later
matching drain observation can release capacity without rewriting the result.
This requires verified supervisor proof; booleans in untrusted HTTP JSON are not
proof. The new decoder accepts only the pinned authenticated service's strict
bound contract; default startup still installs no driver or host.

Every reference must pass every case; at least one declared witness per starter
must match. Every required check is accounted for before final aggregation.
Infrastructure failure takes precedence over independent known code failures,
which remain in the report. Runs progress through `QUEUED`, `RUNNING` and one
immutable `PASSED`, `FAILED` or `INFRA_ERROR` result.

At the exact deadline, unfinished checks are recorded as infrastructure-incomplete,
new dispatch stops, and late results cannot change the final report. They may
still record original-attempt evidence and positive physical cleanup. Internal
`expireValidationRuns`, new-admission processing and authorised report reads can
record due expiry without a connected driver. The eventual worker service must
schedule this maintenance independently of runner health. Judge/round time
watermark reversal latches the shared clock fault instead of waiting to self-heal.

## Reservations And Privacy

Authoring storage is conservatively included in the existing 3 GiB catalogue
guard: 512 KiB run overhead plus 256 KiB per possible attempt, three per check.
The maximum 115-check run initially reserves 86.75 MiB. Reliable completion or
logical expiry releases unused dispatch allowance, retains actual bounded evidence
and keeps a full allowance for each physically unresolved attempt. A later drain
reduces that allowance to actual retained bytes. Sources, jobs, receipts and
budget changes must commit together. This is authoring accounting, not completion
of the separate whole-app 32 GiB/resource/outbox reservation subsystem.

Only the narrow worker functions can change run/job/attempt/slot state through
the application database role. Staff reports are authenticated, typed, source-free
and audited. They show each check's expected/observed category, attempts, progress
and physical-pending state, never hidden I/O, code, provider addresses or raw
diagnostics. A separate [authorised diagnostic viewer](validation-diagnostics.md)
now exposes one deliberately selected resolved dispatch's bounded output and
accounting, with reason-required audit and original-session receipt recovery.
No award, wallet entry, penalty, participant receipt or Run allowance is created.
`can_publish` remains false; human review/publication are separate required work.

## Staff HTTP

Paths have the `/api/v1` prefix and existing staff cookies, exact-origin/CSRF,
healthy-clock, body, shared quota and redaction rules.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/staff/content/validation-snapshots/:snapshot_id/runs` | Request a run with `request_key`, `expected_revision`, `reason` |
| GET | `/staff/outcomes/validation-run/:snapshot_id/:request_key` | Recover the current actor's original receipt |
| GET | `/staff/content/validation-runs/:run_id` | Audited private progress/result summary |

Domain rejections return 409. Unavailable/unregistered/stale-lease/incompatible
execution capacity returns 503 without a fake admission. Publication, manual
result entry, worker control and host-retirement endpoints are not exposed.

## Verification Boundary

Disposable PostgreSQL tests use an explicitly synthetic in-process driver. They
test real database coordination, exact once-only local send permission, lost reply
lookup, competing workers/late old senders, retry delays, evidence binding, logical
versus physical completion, clock faults, deadlines, budgets and HTTP access.
They do not compile fixtures or certify a real execution host. Owner-only helper
calls exercise exact deadline boundaries without changing the host clock or
exposing a production time-override setting.

The protected execution layer now includes a per-capsule Isolate producer and
outer durable Docker lifecycle/backend. It is not installed or certified: no
real host preparation authority currently enables it. Checkpoint results and
container removal do not imply full physical retirement or capacity release.

Still required: production sandbox/supervisor validation, real host resource/
config provisioning and full parent/storage retirement, actual runtime compatibility, worker
process/startup/heartbeat/maintenance scheduling, adversarial isolation and host
retirement/restore checks, participant queue integration, full-app resource/outbox
budgets, review/publication and authoring UI. The later arena-start service must
honour the same outstanding-work/physical barrier; it is not implemented yet.
No live lab controller is rerun and no cloud/persistent database is modified.
