# Protected Verdict Batch

Status: user-reported cloud PASS for all 80 bundled unit tests and all eighteen
fixed verdict cases. Evidence is sealed in `verdicts-v1`; preserve it and do not
repeat this completed controller. This is a fixed lab batch, not a
participant-ready worker. Do not replay the completed output controller or its
sealing continuation either.

## What This Adds

The protected collector can now return a normally completed Isolate phase with
exit code 0 or 1, including bounded output and observed identity. Its existing
`collect` caller still requires code 0, so earlier success-only callers keep
their strict behavior. Code 2, missing identity, timeout of the collector, missing
EOF or failed cleanup do not become participant errors.

The new caller observes the exact target command line, UID/GID 60000, empty
capabilities, no-new-privileges, seccomp and descriptor limits inside both job
controllers. Seeing only the trusted Python pipe handoff is not sufficient.
Very short programs that cannot be observed fail closed; they are not guessed
to have executed correctly.

The inner and outer checkers independently bind the fixed source hash, phase,
limits, metadata, aggregate cgroup counters, protected stream records and cleanup.
Compiler diagnostics are retained up to 64 KiB. Runtime stdout retains at most
1 MiB plus one overflow byte; runtime stderr retains up to 64 KiB. Neither an
error message written to stderr nor a bare SIGKILL proves a resource limit.

| Profile | Fixed cases |
| --- | --- |
| C | Compile error with clipped diagnostics; exit 7 |
| C++ | Compile error with clipped diagnostics; pass; wrong answer; exit 7; SIGSEGV; CPU limit; wall limit; job OOM; stdout overflow; ambiguous SIGKILL |
| Java | Compile error with clipped diagnostics; exit 7 |
| Python | Syntax error as runtime error; exit 7 |
| JavaScript | Syntax error as runtime error; exit 7 |

These are 18 cases. Identical reviewed native sources share a compiled artifact
within this fixed suite; each executed phase still gets fresh workspace and job
groups. This is not a production artifact cache or a compiler throughput test.

The three compile-error sources deliberately contain a known error marker.
Their source-bound rejection plus clipped diagnostics is a lab witness, not a
generic proof that any future compiler failure must be a participant mistake.
Generic compiler/startup infrastructure attribution remains an implementation
gate before participant use.

Verdict precedence is stdout overflow, proven job OOM, proven CPU/wall limit,
proved abnormal completion, then backend output comparison. The ambiguous kill
case must yield no participant verdict and `recovery_required: true`. This
checks classification only; it does not create a production recovery reservation.

## What Stays Unchanged

No schema, provider row, queue permit, image, policy, capability or cloud resource
is created or changed. The cached five-language image, private network, API
maintenance/restrictions and four-hour VM STOP guard remain in place. The batch
uses the existing 1536 MiB / 0.5 CPU / 128-task parent and a 420-second launcher
deadline. Only three fingerprinted read-only source bundles are mounted.

The new batch's Docker log is bounded to 4 MiB to accommodate its retained
overflow witness. This is not an increase to any participant output limit. The
combined compact evidence still uses the existing exclusive, 2 MiB storage
writer. The small recovery writer is unchanged.

The preflight revalidates all fifteen provider rows and earlier evidence, then
checks the completed `output-v1` execution and its separate `seal-fix-v1` proof
against their historical source fingerprints. The updated collector and launcher
are frozen separately for this new run, rather than silently reinterpreting old
evidence as evidence for the new source. The original entrypoints and sealed
output journal, log and evidence remain unchanged. Printed old-case PASS lines
recheck saved evidence; they do not launch those cases again.

## User-Reported Cloud Result

The user supplied `Ran 80 tests ... OK`, with no skips reported, followed by all
eighteen expected verdicts and the controller's final sealed-evidence PASS. This
includes clipped compile-error diagnostics in C/C++/Java, runtime errors in all
five profiles, correct/wrong answer controls, CPU/wall/job-memory limits and
protected stdout overflow. The ambiguous SIGKILL yielded `RECOVERY_REQUIRED`
without a participant verdict; this is not proof of a production recovery slot.

The supplied output reports protected bytes, cause, identity/accounting and
normal cleanup verified; all fifteen provider rows and prior evidence unchanged;
queue empty; and maintenance enabled. The original three-service inventory and
four private API gates passed. Repeated boundary/stream/output PASS lines are
read-only checks of saved evidence, not new runs of those completed controllers.

This records user-supplied controller output, not independent inspection of the
private VM journal/evidence. Keep the completed archive and `verdicts-v1` intact,
alongside all earlier evidence and the intentionally held reservation. No source,
image, runtime, policy, architecture, Git history or cloud resource was changed
to record this result. The next [protected-verdict HTTP/queue batch](VERDICT-HTTP-LAB.md)
is prepared and locally tested, with cloud execution pending. It uses fresh bound
records, not these completed execution permits. The remaining limits below still
apply.

## Historical One-Shot Procedure

This procedure has completed. It is retained as a record, not instructions to
repeat the run. The immutable public archive retains its original prepared
runbook; the reported completion above is the current status.

Upload only the public archive supplied in the chat, not private secrets or
anything from `/opt/ingenium-judge-spike`. Copy it through Cloud Shell/IAP to the
existing VM release directory. Keep the VM and original three services running.
If the VM's four-hour guard stopped it, start the existing VM, reconnect, then
use the [existing container-start procedure](README.md#restart-existing-lab-services).
Do not recreate services.

After verifying the supplied archive checksum, run on the VM:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 verdict-check-v1
  tar -xzf ingenium-judge-verdicts-20261018-01.tar.gz -C verdict-check-v1
  python3 -B -m unittest discover -s verdict-check-v1/test -p 'test_*.py'
  sudo python3 -B verdict-check-v1/verdicts.py
)
```

The two POSIX-only unit tests must run rather than skip on the VM. They exercise
real pipes with fixed trusted child programs and mocked identity, not Isolate.
All actual sandbox execution occurs only in the subsequent once-only controller.

It creates exclusive `/opt/ingenium-judge-spike/verdicts-v1`, freezes sources and
boot, executes the fixed batch, requires normal teardown, rechecks all earlier
evidence and the private API gates, then saves compact evidence. Expected final
output begins `PASS: eighteen protected verdict cases sealed` and confirms fifteen
unchanged provider rows, empty queue and maintenance enabled.

If any check fails or the connection drops, preserve this checkpoint and any
named resources. Share the output; do not rerun, delete the checkpoint, reset
permits, clear queues or force-clean. A new source extraction folder does not
authorize a second execution. Never start the stock Judge0 worker.

## Local Checks and Limits

220 Python tests: 218 passed, with the real FIFO and anonymous-pipe exercises
skipped on Windows. Eleven Node checks and 28 stubbed Bash launcher groups pass.
The launcher suite uses a cached, network-free, read-only image with a Bash
entrypoint, not a database or Judge0 worker. Frozen earlier profile/stream/policy
sources must remain unchanged. Architecture and unrelated editor/Compose changes
are untouched.

The supplied cloud output reports these fixed verdicts, modern compiler
diagnostic clipping and exact-command observations passed on the cached runtime.
It does not establish arbitrary compiler-failure attribution or end-to-end
protected failure transport. This batch does not finish production cancellation/drain,
host retirement, arbitrary compiler failure attribution, dependency/security
review, handoff-overhead calibration, language fairness or event-load testing.

Implementation reference: [Isolate v1.8.1 source](https://github.com/ioi/isolate/blob/v1.8.1/isolate.c).
Source review informs the checks; it is not evidence that the particular cached
binary or arbitrary hostile code has passed them.
