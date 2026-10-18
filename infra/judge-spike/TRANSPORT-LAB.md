# Five-Profile HTTP and Bounded Evidence Lab

Status: user-reported cloud PASS on 2026-10-18. Preserve its evidence and do not
rerun this completed one-shot experiment or historical nine/ten-row probes.
This is a fixed trusted-fixture experiment, not participant execution or the
competition API. No new VM, image pull/build, public port or application migration
is needed. The approved architecture and all previous public archives stay intact.

## Recorded Cloud Result

The user supplied all final PASS lines from the archive-01 controller. The first
five ten-case lines revalidated the previous sealed stream log; they were not a
second execution of the fifty-case suite. The new experiment then admitted five
fresh real provider/outbox records. Lost token reply bodies and explicit identical
POSTs resolved to the same association for each job.

Two actual Redis deliveries per job reached guarded workers, but only one worker
executed each fixture. The committed worker replies were deliberately lost;
authenticated HTTP recovered the sealed full evidence, while the original Judge0
GET matched the actual retained Base64 bytes and measured accounting. The backend
checker reported exactly the intended results:

| Profile | Token mode | Exact mode |
| --- | --- | --- |
| C | `PASSED` | `PASSED` |
| C++ | `PASSED` | `PASSED` |
| Java | `WRONG_ANSWER` | `WRONG_ANSWER` |
| Python | `OUTPUT_LIMIT_EXCEEDED` | `OUTPUT_LIMIT_EXCEEDED` |
| JavaScript | `PASSED` | `WRONG_ANSWER` |

The non-passing verdicts above are successful negative-case checks, not failures
of this experiment. All five result seals completed. Final checks reported fifteen
provider rows, all ten earlier rows unchanged, earlier schemas/evidence preserved,
an empty queue and the original three services running. The four original private
API gates passed again with maintenance enabled.

Preserve `/opt/ingenium-judge-spike/transport-v1`, `ingenium_transport_v1`, the new
five provider rows and all previous evidence/reservations. No rerun, queue clearing,
permit reset or additional cleanup is needed. The immutable public archive is
`ingenium-judge-transport-20261018-01.tar.gz`, SHA-256
`40bb01cbeca711dc684eaea09f573814009ae25345f7760f07d25c47962c97e2`.

This records the user's terminal output, not independent assistant inspection
of private VM evidence, detailed metrics or billing. The run demonstrates the
fixed five-profile HTTP/queue/evidence/checker path, not generic participant
execution, broader failure mapping, adversarial isolation, cancellation/host
retirement or event capacity. Next prepare controlled network/metadata,
protected-file and child-process isolation checks, without repeating these jobs.

## Combined Path

```text
authenticated private POST -> provider row + immutable outbox
                           -> two real Redis deliveries
                           -> one positively claimed worker -> frozen profile
                           <- bounded raw streams + cleanup/accounting evidence
                           -> atomic provider result + sealed evidence
authenticated GET          <- lost-reply recovery -> shared backend checker
original Judge0 GET        <- matching Base64 bytes and accounting
```

The new root-only `transport.py` reuses the completed HTTP, permit, queue,
profile-image and stream-checker helpers. A separately loaded guard instance
targets only `ingenium_transport_v1.attempts`; it cannot redirect older controllers
to the new table. The controller verifies the completed stream seal, matching
old database records, private log/cleanup proof and cached image manifest before
making changes. An existing new schema/checkpoint blocks execution rather than
being deleted or reused.

The fixed context freezes all five payloads, runtime/image, source/input bytes,
helper and stream-bundle hashes, boot and unique attempt bindings. A bound job
file adds one private read-only container mount, not an extra capability or network
connection. It is never mounted into the inner submitted-program sandbox. The
runtime accepts only the five predefined profile/case pairs; arbitrary code,
commands and inputs are not supported. Limits, policy and cgroup protections are
unchanged; Docker logs for the bound job are capped at 2 MiB with one log file.

## Five New Jobs

| Profile | Existing fixed stream case | Expected backend result |
| --- | --- | --- |
| C | Empty stdout/stderr with real EOF | Pass in both modes |
| C++ | UTF-8 plus NUL | Pass in both modes |
| Java | Complete invalid UTF-8 stdout and diagnostic byte | Wrong answer in both modes |
| Python | Stdout 1 MiB plus one byte, stderr 64 KiB plus one byte | Output overflow in both modes |
| JavaScript | The six ASCII whitespace separators | Token pass; exact mismatch |

This is five fresh trusted jobs, not a replay of the completed fifty-case suite.
Each has its own real provider token/outbox and one execution permit. Each compiled
profile compiles once, then runs once; interpreted profiles run once. Jobs execute
sequentially, while the two competing duplicate-delivery workers race for the same
job's permit. No throughput or parallel-run capacity claim is made.

The temporary API's custom admission handler creates a real `Submission` and
serialized ActiveJob envelope in one transaction. Discarded token bodies are
resolved with GET by the saved attempt ID. An explicit identical POST injects a
duplicate to test idempotence; uncertain network operations are never automatically
retried. After dispatch is committed, two actual Redis deliveries must yield one
successful worker and one refused duplicate. A winner deliberately exits without
its reply only after normal cleanup and atomic result/evidence sealing. A fresh
claim after sealing must fail.

Full bounded capture envelopes, including strict Base64, byte counts, EOF,
truncation, digests, identity and accounting, are retained in the new private
evidence and served through the authenticated custom evidence route. HTTP bodies,
private evidence and database JSON each have a 2 MiB ceiling. The checker runs
again on the recovered raw evidence, never on a preview or inferred null field.
Compiler and stderr bytes remain separate; an overflow prefix is explicitly
partial and cannot become a passing answer.

The original Judge0 result read must independently match those retained bytes and
measured accounting. Its model stores Base64 text and its serializer exposes the
stored values in Base64 mode: [model](https://github.com/judge0/judge0/blob/v1.13.1/app/models/submission.rb),
[serializer](https://github.com/judge0/judge0/blob/v1.13.1/app/serializers/submission_serializer.rb).
Its provider status 3 records normal process completion only in this lab; it is
not the competition verdict. In particular, Java's invalid output and Python's
output overflow must still fail the backend checker.

The stock provider language rows are checked and left unchanged. Their IDs are
only family descriptors here; their older version names do not identify the
compiler actually used. The exact cached modern image/profile manifest and frozen
commands are authoritative for this custom adapter. This is not completed generic
provider language registration or an event-facing language catalogue.

## State That Must Remain

The completed run added a new lab schema and **five provider rows**, changing the
total from 10 to 15. All ten previous provider rows, all three earlier synthetic schemas,
completed HTTP/crash/stream evidence and the older deliberately held reservation
must remain unchanged. Immutable transition checks reject association/outbox
reset, sealed-evidence replacement and deletion. No old permit, queue or record
is reset or cleared. The final queue must be empty and the original three services
must still pass their maintenance/authentication gates.

Preserve `/opt/ingenium-judge-spike/transport-v1`, including its context/journal,
per-attempt job, sandbox log, full evidence, worker replies and temporary API log,
and the `ingenium_transport_v1` schema. Old ten-row baseline probes become
historical after a successful run; do not execute them against the new inventory.

## Historical Procedure: Do Not Repeat

The following archive-01 procedure has completed successfully as recorded above.
Keep it for provenance; it is not an instruction to run the experiment again.

Upload the new public archive linked in the chat to Cloud Shell, then transfer it
through the existing IAP connection. Keep the current four-hour STOP guard,
firewall, secrets, image cache and maintenance settings unchanged. The original
three services must be running. A stopped service is not permission to recreate
containers, reset data or rerun an older experiment.

After checking the supplied archive checksum on the VM:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 transport-check-v1
  tar -xzf ingenium-judge-transport-20261018-01.tar.gz -C transport-check-v1
  python3 -B -m unittest discover -s transport-check-v1/test -p 'test_*.py'
  sudo python3 -B transport-check-v1/transport.py
)
```

The packaged Python tests are stubs/pure checker tests plus the real Linux FIFO
test; they start no compiler, database connection or Judge0. The FIFO test must
not be skipped on Linux. Before schema writes, the controller also executes the
Ruby admission self-check inside the existing API container, with database/queue
operations stubbed. The last command is the actual five-job cloud experiment.

On any failure, preserve the checkpoint, schema, private logs and retained
resources. **Do not rerun, clear queue/records, reset permits, force-clean or weaken
restrictions.** Share only the PASS/FAIL output initially, not credentials or
private evidence/configuration. A lost result reply is a recovery problem, never
permission to re-execute code.

## Verification and Limits

Local checks: 178 Python tests, 177 passing plus one Linux-only FIFO skip;
11 configuration tests; 22 launcher orchestration/membership/result groups using
stubs, not Docker/Judge0 calls or host cgroup writes within that suite. The stub
launcher suite runs under restricted, network-free Bash in the already cached
PostgreSQL image, never its database entrypoint. No local compiler, submitted
program, Isolate, worker, Ruby runtime or database server was started. The later
user-reported cloud result covers this scoped Ruby/SQL/integrated execution path;
it is not independent inspection or a general database/security audit.

The tests cover changed bindings, wrong sources/inputs/boot/helpers, queue
tampering, duplicate/uncertain permits, one launch, uncertain cleanup, lost seal
replies, corrupt/partial evidence, strict and bounded transport, true empty
streams, atomic result/evidence writes and read-only preservation snapshots.
This is not a participant-ready generic adapter, scoring integration, adversarial
FIFO/escape test, failure-cause precedence matrix, compiler-diagnostic stress test,
complete cancellation/crash/host-retirement protocol or load benchmark. Older
Isolate and provider dependencies still need review before participant execution.
