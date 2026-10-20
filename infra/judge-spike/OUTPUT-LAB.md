# Protected Output Batch

Status: user-reported cloud PASS after the guarded sealing continuation. All
fifty language cases and three output probes are sealed without a sandbox rerun.
Preserve `output-v1` and `output-v1/seal-fix-v1`; do not repeat either procedure.
This is a fixed lab experiment, not permission to run participant code. Keep the
four-hour VM STOP guard, private network, maintenance/API restrictions and all
earlier evidence unchanged. No image pull/build, new cloud resource, database
write, submission, schema or public port is needed.

## What Changes

The historical stream collector used named FIFOs inside the writable `/box`.
Those historical sources and checkpoints stay frozen. The new collector uses
anonymous pipes: the root collector owns the readers, and the program receives
only write-only stdout/stderr handles. Replacing, unlinking or creating a file
called `/box/stdout` cannot replace an already inherited anonymous pipe.

The existing `Capture` implementation still bounds retained bytes: stdout keeps
at most 1 MiB plus its overflow sentinel, while stderr/compiler diagnostics keep
at most 64 KiB. All bytes are drained and counted through EOF without retaining
an unbounded buffer. EOF alone does not prove the process finished; the collector
also waits for Isolate exit and the phase still requires accounting, empty job
groups and explicit normal workspace/group cleanup.

Isolate 1.8.1 normally closes extra descriptors. This batch narrowly enables
`--inherit-fds` after `Popen(close_fds=True, pass_fds=(error_writer,))` selects just
one extra writer below descriptor 64. The existing UID-60000 execution helper
starts a fixed isolated Python handoff, which redirects that writer onto stderr,
closes descriptors 3 through 255, then directly executes the original program.
No shell or participant-supplied handoff source is involved. Descriptor limits
remain 256, and the program never receives a reader or the Isolate diagnostic
file. The fixed Python bootstrap adds measured startup CPU/memory to every
phase; this is not a runtime-overhead or fairness benchmark.

The Isolate keeper keeps its own stderr directed to a private log, separate from
the program's stderr. Compiler stdout/stderr share one anonymous writer, as the
historical checker expects. Failure diagnostics retain only bounded prefixes and
fixed metadata in the private host log, never configuration/environment dumps.

References: [Python descriptor inheritance](https://docs.python.org/3.10/library/subprocess.html#subprocess.Popen),
[anonymous pipes](https://man7.org/linux/man-pages/man2/pipe.2.html),
[pinned Isolate descriptor setup](https://github.com/ioi/isolate/blob/v1.8.1/isolate.c).
Source review motivates this design; it is not a substitute for scoped runtime
evidence or a general hostile-code security review.

## One Batch

The private driver substitutes only the new collector when reusing the frozen
fifty-case stream/checker fixtures across C, C++, Java, Python and JavaScript.
Compilation and execution still use fresh accounted job groups, the cached
five-profile image, the same policy/capabilities and aggregate budgets.

It then runs three fixed Python probes through the same collector:

| Probe | Required result |
| --- | --- |
| `replace-paths` | Write/rename/unlink fake output files, create/drain an unrelated FIFO, install a symlink/directory; captured bytes still match only the real stdout/stderr writes |
| `read-and-leak` | Both outputs are write-only pipes; reading them fails with `EBADF`; descriptors 3 through 255 are closed |
| `early-close` | Close both output descriptors, wait, then create a completion marker; the collector cannot report success before program completion |

The launcher adds one read-only output-source bundle alongside the existing
read-only stream bundle. No policy, runtime binary, capability or resource-limit
relaxation is made. The selected descriptor inheritance and trusted handoff are
the explicit execution change under test.

## Evidence and Failure

The host controller first revalidates the completed HTTP associations and sealed
isolation evidence using read-only operations. Printed preflight isolation PASS
lines validate saved evidence; they do not rerun those earlier probes. It freezes
the new sources, launcher and boot, then creates exclusive root-private
`/opt/ingenium-judge-spike/output-v1`. Completion requires 50 language results,
three exact probe results, normal cleanup, all fifteen provider rows and all
earlier evidence unchanged, empty queue, original three services and four API
gates. The old intentionally held reservation is not reset or released.

Any failure, lost connection or timeout requires inspection of that private
checkpoint and named resources. Do not rerun, reset permits, clear records/queues,
force-clean resources or delete old checkpoints. Public source/extraction folders
are not a replacement for the private execution journal.

## User-Reported Sealing Result

The user supplied the completed continuation's PASS output. It reconstructed all
fifty language cases and three tampering/EOF probes from the already completed
log, without rerunning code, then sealed compact evidence. The original
journal/log and fifteen provider rows remained unchanged; queue empty and
maintenance enabled were rechecked. Original three-service checks, the four
private API gates and saved isolation-evidence checks passed. The repeated
isolation PASS lines refer to saved evidence verification, not new sandbox runs.

This records user-supplied controller output; the assistant did not independently
inspect private VM evidence. The original `output-v1/journal.jsonl` remains at
`OUTPUT_FINISHED`. The completed seal is recorded separately in
`output-v1/seal-fix-v1/journal.jsonl`, with its compact `evidence.json`. Preserve
both locations and the older held reservation. No new cloud command or runtime
change is required to record this checkpoint.

The success-only collector from this completed package is preserved in its
immutable archive. The later [protected-verdict batch](VERDICTS-LAB.md) extends
capture in a separately fingerprinted bundle and has a user-reported cloud PASS
for all eighteen fixed cases. Preserve both completed checkpoints; do not replay
either controller. The calibration, recovery, dependency and load limits below
still apply.

## Historical Sealing-Only Continuation

The following describes the completed recovery, not instructions to repeat it.

The supplied output reaches both final service/API checks, then fails with
`Oversized fixed recovery evidence.` The original entrypoint selected the small
64 KiB, pretty-printed recovery writer for the combined 53-case report. That
helper checks size before creating a file, so the expected retained inventory is
only `journal.jsonl` and `output.log`, with events `PREPARED`, `OUTPUT_STARTED`,
`OUTPUT_FINISHED`. The continuation verifies this state rather than assuming it.

The entrypoint's one-line correction uses the existing compact `transport.save`
writer, still bounded to 2 MiB. The small recovery writer and all execution/output
limits remain unchanged. Neither the old archive nor runtime/policy/bundle source
has been replaced. The correction applies to future fresh lab runs, not permission
to replay this checkpoint.

`seal-output.py` verifies the original entrypoint hash, the exact corrected
entrypoint, unchanged launcher/policy/bundles, original host boot, retained log
digest, all 53 saved results and prior fifteen-record state. It also checks that
no sandbox container, loaded probe policy or owned controller/runtime directory
remains. It never calls the execution launcher or changes a provider record.

After all checks, it creates only `output-v1/seal-fix-v1`, writes compact evidence
there and journals completion. Original `output-v1/journal.jsonl` and `output.log`
remain byte-for-byte unchanged. Lost connections/failures preserve both folders;
do not rerun or delete them to retry. Keep the existing VM running during sealing.

Upload the supplied archive 02, verify its supplied checksum, then run inside the
VM with the existing three services running:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 output-seal-v1
  tar -xzf ingenium-judge-output-20261018-02.tar.gz -C output-seal-v1
  python3 -B -m unittest discover -s output-seal-v1/test -p 'test_*.py'
  sudo python3 -B output-seal-v1/seal-output.py
)
```

At preparation the VM seal was pending; its subsequent user-reported PASS is
recorded above. Local tests include a large report
that exceeds the old pretty writer's cap but fits compactly, overwrite refusal,
the unchanged storage ceiling, incomplete/changed source/state/log refusal and
proof that the continuation cannot launch code. There are now 208 Python tests
(206 pass, two Linux/POSIX skips on Windows). Existing launcher/config sources
were not changed for this correction.

## Historical One-Shot Procedure

Do not run this completed execution batch again. The commands below describe the
original invocation, not the sealing continuation.

Upload the archive supplied in the chat through Cloud Shell and copy it to the
existing VM release directory through IAP. Confirm the VM and original three
lab services are running. Use the supplied checksum before extracting:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 output-check-v1
  tar -xzf ingenium-judge-output-20261018-01.tar.gz -C output-check-v1
  python3 -B -m unittest discover -s output-check-v1/test -p 'test_*.py'
  sudo python3 -B output-check-v1/output.py
)
```

The two POSIX/Linux-only tests must run on this VM, not be skipped. The real pipe
unit test uses fixed trusted child programs with a mocked identity check; it
tests actual descriptor closure, bounded draining and EOF waiting, not UID
isolation. Actual UID/accounting assertions happen only in the subsequent
sandbox batch. No compiler, Isolate, socket or native probe runs locally through
the other packaged unit tests.

## Local Verification and Limits

202 Python tests: 200 passed, with the real FIFO and anonymous-pipe tests skipped
on Windows. Eleven Node configuration/image checks and 26 stubbed Bash launcher
groups passed. The launcher tests run only stubs inside the already cached,
network-free, read-only PostgreSQL image with a Bash entrypoint; they never start
its database or any Judge0 process. All 24 frozen profile/stream/isolation/policy
inputs match the previously verified isolation extraction. Architecture and the
user's unrelated local/editor changes were not modified.

This batch does not implement nonzero-result mapping, large/failing modern
compiler diagnostics, durable supervisor cancellation, host retirement, arbitrary
malicious-code safety, dependency review or event-load capacity. The Python
handoff overhead also needs calibration before participant time/memory budgets
are approved. Keep maintenance enabled after a successful fixed run.
