# Protected Verdicts Over HTTP and Queue

Status: archive 02 passed all 95 VM tests and the corrected Ruby preflight.
Admission stopped at `cpp-wall`: Judge0 rejected its 0.3-second wall field.
The retained checkpoint has 23 provider rows, eight unstarted associations and
zero permits consumed. Archive 03 passed all 107 VM tests but its strict
validation-output comparison stopped before creating the continuation checkpoint
or admitting anything. Archive 04 accepts one exact validation-success line
alongside runtime logs; nonzero exits, absent or duplicate markers still stop.
Use only the guarded continuation below, not either original controller. No
frozen admission, worker, launcher or sandbox runtime source changes.
This fixed synthetic batch is not a participant endpoint or production
supervisor. Do not rerun any completed historical controller, including
`verdicts.py`.

## Retained Admission Continuation

The user's read-only diagnostic confirmed eight `HTTP_RECONCILED` entries followed
by `HTTP_SEND_STARTED` for `cpp-wall` and `CREATOR_REMOVED`. The model rejects only
that case: `wall_time_limit` must be at least one second in
[Judge0 1.13.1](https://github.com/judge0/judge0/blob/v1.13.1/app/models/submission.rb).
The fixed sandbox case intentionally has a 300 ms wall timeout. These are two
separate limits; the continuation sets the unregistered provider envelope to
one second, while keeping the actual 300 ms sandbox limit and all fixture
sources unchanged. It recalculates only that absent attempt's payload hash.

`resume-verdict-http.py` verifies the exact failed journal, current boot/runtime,
original frozen sources, absence of execution resources, all eight unstarted
provider/outbox associations, unchanged prior fifteen rows and earlier evidence,
and an idle private queue. A read-only Rails model check validates all eighteen
corrected payloads before any new checkpoint or admission. It creates no schema
and changes no existing binding or execution permit.

The separate root-private `verdict-http-v1/admission-fix-v1` checkpoint preserves
hashes of the original journal, both original contexts and original creator log.
Those four files are never overwritten. The original eight admissions are
reconciled using GET only. Each of the remaining ten must be positively absent
in both HTTP and PostgreSQL before its once-only POST. Full hashes of the
original eight attempt/provider rows must still match after those admissions.

Only then does the continuation use the existing frozen worker, guarded queue,
protected sandbox and result verification for all eighteen previously unstarted
cases. Every duplicate worker rechecks the separately pinned continuation and
corrected context before claiming a permit. Seventeen results must seal and the
ambiguous kill must remain held without a participant verdict. Completion is
stored only in the continuation checkpoint, not the failed parent journal.

### Validation Output Correction

Archive 03's reported error follows a successful validation-command exit but a
failed whole-output equality check. Judge0's
[configuration loader](https://github.com/judge0/judge0/blob/v1.13.1/scripts/load-config)
enables Rails logging to stdout. Such messages are not the validation result.
The corrected parser requires exactly one complete success-marker line, still
uses the existing checked subprocess exit and 8192-byte response bound, and
prints only the marker. Missing or ambiguous replies show byte/marker counts,
not private log contents. The Ruby validation itself and read-only mode are
unchanged. This addresses the brittle output assumption; actual cloud recovery
is still pending, not a claimed completed diagnosis of unseen stdout contents.

Regression tests reproduced the old rejection with startup/SQL log lines and
cover clean output, CRLF, missing markers, embedded or incomplete markers,
duplicates and a failed command even when its output contains a success marker.
The failure is before `Journal(FIX)`, so this run created no continuation
checkpoint, API container, provider record or execution permit. The corrected
entrypoint still independently refuses any existing checkpoint or changed state.
Preserve archive 03 and its extraction; never delete a private checkpoint to
permit a start. All 73 other archive-03 files remain byte-for-byte unchanged.

Upload archive 04, check the supplied checksum, and run once on the already
running VM with its original three services healthy:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 verdict-http-check-v4
  tar -xzf ingenium-judge-verdict-http-20261018-04.tar.gz -C verdict-http-check-v4
  python3 -B -m unittest discover -s verdict-http-check-v4/test -p 'test_*.py'
  sudo python3 -B verdict-http-check-v4/resume-verdict-http.py
)
```

Do not run `verdict-http.py` again. A changed boot, unexpected row, existing
continuation, timeout, failure or lost reply stops without retry or permit reset.
Preserve all resources and report the output. Keep the four-hour VM guard; this
procedure does not authorize extending it. The new cloud continuation is pending
until its final PASS is reported. The original first-start procedure below is
historical documentation, not the next command for this retained state.

## Preflight Correction

The user reported all 95 bundled unit tests passing on the VM, followed by the
earlier evidence/API gates and `CalledProcessError`. The separate stub-only
diagnostic showed Ruby 2.7.0p0 and `Expected 503, got 400`; `CheckpointExists`
was false. The controller runs this test before checkpoint/schema creation or
admission. The diagnostic did not run a sandbox or submission.

The context parser uses `UniqueObject`, a Hash subclass that rejects assigning
an existing key. `payload.dup` retained that subclass, so decoding an existing
Base64 field raised `ArgumentError` and returned 400 before the stub's intended
database failure could return 503. The one-line correction uses `payload.to_h`
to obtain a plain mutable copy for normalization. Duplicate-key rejection stays
at JSON parsing. See [Ruby 2.7 Hash#to_h](https://docs.ruby-lang.org/en/2.7.0/Hash.html#method-i-to_h).

Regression assertions reproduce the protected-copy overwrite rejection, require
a separate plain Hash, retain duplicate JSON-key rejection, require a plain
decoded payload at submission creation and verify that the entire frozen context
is unchanged after all eighteen stub admissions. All existing rollback,
duplicate-admission and held-evidence checks remain.

Archive 01 and its extraction remain unchanged. Use archive 02 in the new public
`verdict-http-check-v2` extraction; do not delete or reset a private checkpoint
to permit it. The unchanged controller independently refuses an existing
checkpoint or schema before any new admission. If either now exists, stop and
inspect rather than treating this as a fresh start. No permit reset, queue
clearing, resource cleanup or database migration is required for this correction.

## Combined Check

The earlier eighteen verdict cases passed as a standalone execution batch. This
new controller creates eighteen fresh provider associations for the same frozen
fixture sources, now each bound to its own HTTP admission, immutable queue
envelope, one-time execution permit, protected evidence and backend verdict.
It does not replay a completed execution checkpoint or reuse its permit.

```text
Private authenticated POST -> provider row + immutable outbox
                           -> two real Redis deliveries
                           -> one positively claimed worker
                           -> one fixed protected compile/run job
                           -> atomic evidence/provider commit, or held uncertainty
Private authenticated GET  <- recovered evidence after deliberately lost reply
Original Judge0 GET        <- matching execution bytes and accounting
Backend checker            <- independently verified verdict, never status alone
```

Each fixed case has its own provider record; compilable sources compile within
that record's one execution, with no artifact shared between jobs. Cases execute
sequentially. The two competing delivery workers race only for the same job's
permit; this is not a concurrency or throughput benchmark.

The case inventory is unchanged: C/C++/Java clipped compiler errors, runtime
failures in all five languages, passed/wrong-answer controls, SIGSEGV, CPU and
wall limits, job OOM, stdout overflow and ambiguous SIGKILL. Python/JavaScript
syntax failures remain runtime errors. Source hashes, fixed limits, exact target
identity, accounting, protected pipes, EOF and normal cleanup remain required.

## Uncertain Is Not Wrong

Seventeen jobs must reach `SEALED`, with one consumed execution permit and a
matching final provider projection. The ambiguous kill instead keeps `STARTED`,
its consumed permit and held reservation. Its verified uncertainty evidence is
stored separately in write-once held fields, recovered over authenticated HTTP
with `recovery_required: true` and no participant verdict. The original provider
row stays `Processing`, with no invented outputs, timings or final status.

No held result can be cleared, replaced, sealed, deleted or claimed for execution
again by this batch. Normal physical cleanup does not automatically resolve an
uncertain participant result or release its logical reservation. The earlier
intentionally held recovery record is separate and remains untouched.

Legacy provider statuses describe execution only. A normally exiting wrong
answer or stdout overflow may still have provider status `Accepted`; the backend
uses the protected evidence to return `WRONG_ANSWER` or `OUTPUT_LIMIT_EXCEEDED`.
Likewise, a memory kill uses its actual signal projection, not an invented legacy
memory status. Neither the browser nor scoring should trust a provider label.

The compiler-error witnesses are still source-bound fixtures, not a general
compiler/infrastructure-failure attribution mechanism. The existing exact-command
observer may fail closed on very short targets. Production startup attribution,
cancellation, host retirement and recovery are not completed by this test.

## Preserved State and Changes

Preflight revalidates the completed output and verdict seals using their exact
historical source fingerprints. Earlier printed PASS lines validate saved logs;
they do not execute old controllers. The current collector, stream checker and
verdict sources remain unchanged; only a separately fingerprinted bound-job
wrapper and launcher dispatch are added.

Before any mutation, a new root-private checkpoint and schema must both be
absent. The controller freezes its context, helpers, all four source bundles,
runtime manifest, boot, bindings and prior evidence. It then creates only
`/opt/ingenium-judge-spike/verdict-http-v1` and `ingenium_verdict_http_v1` plus
the eighteen new synthetic provider records. The final provider count must be
33: all fifteen earlier rows byte-for-byte unchanged, seventeen new final rows
and one new uncertain row still processing.

All earlier association/recovery tables and selected sealed context, journal,
log, worker and evidence files are snapshotted before admission and checked
afterward. The original queue must be empty; only the original three services
may remain running; the four private API restriction gates must pass again.
The new records, schema, held reservation and journals remain for inspection.

The temporary admission API reuses the existing private internal bridge, cached
API image and non-root restrictions, with no published port. It admits only the
eighteen frozen bindings. The original API remains in maintenance. Stock workers
never start. No image pull/build, new VM, cloud networking or public port is
needed. The four-hour VM STOP guard remains unchanged.

Each sandbox uses the existing 1536 MiB / 0.5 CPU / 128-task bounded parent,
unchanged policy and capabilities. The wrapper and bound job add two read-only
mounts alongside the stream/output/verdict bundles. Docker logs are capped at
2 MiB per bound job; participant capture and storage limits are unchanged. The
larger frozen admission context uses the existing 2 MiB private writer instead
of the small 64 KiB recovery writer.

## Historical First-Start Procedure

Upload only the supplied public archive to Cloud Shell, then copy it to the
existing VM release directory through IAP. Do not transfer private configuration,
secrets or checkpoint contents. Confirm the VM and original three containers are
running. If needed use the [existing start procedure](README.md#restart-existing-lab-services),
not container recreation. Keep the four-hour guard enabled.

After checking the supplied archive checksum, run on the VM:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 verdict-http-check-v2
  tar -xzf ingenium-judge-verdict-http-20261018-02.tar.gz -C verdict-http-check-v2
  python3 -B -m unittest discover -s verdict-http-check-v2/test -p 'test_*.py'
  sudo python3 -B verdict-http-check-v2/verdict-http.py
)
```

The controller also runs the new Ruby middleware's stub checks inside the
existing API container before creating its schema or admitting submissions.
All unit tests use stubs/fixed trusted pipe children, not Isolate. The actual
fixed sandbox jobs run only after the controller's preflight.

Expected completion reports `thirty-three provider rows retained (fifteen
unchanged)`, seventeen sealed verdicts, one uncertain result held, queue empty
and maintenance enabled. This is the success criterion; seeing early old-case
PASS lines is not enough.

Any failure, timeout or lost connection requires preserving the new checkpoint,
schema, consumed permits, rows, queues and named resources for inspection. Share
the output; do not rerun, reset, clear, force-clean or make a new extraction
directory to bypass an execution checkpoint. An uncertain send is not retried.

## Local Checks and Limits

The Python suite exercises binding/cause validation, independent verdict mapping,
atomic seal versus held commits, lost reply recovery, swapped evidence refusal,
duplicate worker refusal, context/source/boot guards, scoped prior snapshots,
legacy seal checks and refusal to finish after changed prior state. The launcher
suite stubs Docker and host cgroups. A disposable local PostgreSQL instance also
loads the actual schema inheritance chain, verifies final/held transitions and
rejects ten forbidden mutations; it never connects to an existing database.

Ruby is not installed locally. Its middleware stub checks therefore run on the
VM before changes; the actual Rails/PostgreSQL/Redis integration and pinned
sandbox execution remain pending until the user reports the new controller's
result. Security/dependency review, arbitrary compiler failure attribution,
production cancellation/retirement, calibrated language budgets and realistic
event-load capacity remain open. Do not admit participant code yet.

Local verification: 235 Python tests (233 passed, two POSIX-only skips on
Windows), eleven Node checks, thirty stubbed Bash launcher groups and the real
disposable PostgreSQL schema/transition check. No cloud or Git mutation was
performed. Approved architecture and unrelated user changes are untouched.
