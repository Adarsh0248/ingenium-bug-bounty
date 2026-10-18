# Bounded Output and Shared Checker Lab

Status: user-reported cloud PASS on 2026-10-18. Guarded archive-02 recovery removed
only the stopped failed probe after all-controller empty-task checks, preserving
its original journal/log. The separate corrected `streams-v2` batch passed all
fifty cases and sealed evidence. This is one fixed trusted suite, not participant
execution, a public endpoint or Fastify verdict settlement. Both stream procedures
below are historical one-shot experiments: do not rerun either controller.
Keep the completed HTTP, profile, recovery and active-crash evidence as well.

The new [five-profile HTTP/bounded evidence lab](TRANSPORT-LAB.md) reuses this
completed result but runs five separate bound jobs. Its preparation extends the
current stream runtime and launcher; the archived/extracted stream-02 sources and
sealed evidence remain unchanged. It does not repeat this fifty-case controller.

## Corrected Cloud Batch Passed

The user supplied the final PASS output for the guarded recovery and ten cases
each in C, C++, Java, Python and JavaScript. The host validated bounded retention,
EOF, identity, checker results and normal cleanup for all fifty cases, then sealed
the new evidence. The ten provider rows and all old schemas/evidence stayed
unchanged. The queue finished empty, the original three lab services remained
running and all four private API gates passed again with maintenance enabled.

Preserve `/opt/ingenium-judge-spike/streams-v1`, including its original failed
`journal.jsonl`/`streams.log` and separate completed `cleanup-v1` proof, and
`/opt/ingenium-judge-spike/streams-v2`, including its journal, bounded log and
sealed `evidence.json`. Keep both extracted bundles and immutable public archives.
Archive 02 is `ingenium-judge-streams-20261018-02.tar.gz`, SHA-256
`053d0aa2f1a5b8ff522038b2a6d8e929773da95b573e8c81414289ab029bcf28`.
No further cleanup, rerun, permit reset or record/queue deletion is needed.

This records user-supplied terminal output, not independent inspection of private
VM evidence, detailed metrics or billing. It closes the fixed fifty-case
capture/checker check, not adversarial FIFO safety, general cause mapping,
all-five-profile HTTP evidence transport or participant readiness. Next combine
the five-profile runner and bounded checker evidence with the private HTTP/queue
path, including duplicate delivery and lost-reply recovery. The original failed
batch had no traceback; the passing correction does not retrospectively prove
its exact failing frame.

## What This Adds

`streams/capture.py` owns the byte accounting, strict Base64 evidence validation
and shared version-1 checker for all five languages. Exact mode preserves every
UTF-8 character, NUL, whitespace and newline. Token mode uses only space, tab,
LF, CR, form feed and vertical tab. It does not perform numeric coercion, Unicode
normalization, BOM removal or replacement decoding. Complete invalid program
UTF-8 is wrong output; corrupt/missing evidence raises an infrastructure error.

`streams/runtime.py` reuses the completed cached five-language image and its
fixed commands, limits, metadata/identity helpers and original Isolate. It adds
no compiler image, package installation or change to the ten frozen image inputs.
Separate nonblocking FIFO readers drain real stdout and stderr concurrently.
A trusted writer stays open until Isolate exits, preventing pre-launch silence
from being accepted as EOF. Success additionally requires observed UID/GID 60000,
descriptor limits, normal phase metadata, accounted memory/CPU, empty job task
lists and explicit workspace/job-group cleanup. The FD/open and selector APIs
are standard-library interfaces: [file descriptors](https://docs.python.org/3.10/library/os.html#os.open)
and [selectors](https://docs.python.org/3.10/library/selectors.html).

Stdout retains at most 1 MiB plus one sentinel byte. Runtime stderr retains at
most 64 KiB. During compilation, stdout/stderr feed a separate combined compiler
diagnostic pipe with a single 64 KiB retention budget. Counters continue while
excess data is discarded, so truncation is explicit and producers cannot fill an
unbounded output file. The frozen CPU/wall limits still bound execution; this
lab drains rather than immediately killing at the first excess stdout byte.
Exactly 1 MiB is allowed; observing any additional stdout byte establishes
overflow before answer comparison, even if the retained prefix matches.

The evidence envelope is serialized and validated locally as bounded JSON/Base64
within 2 MiB, preserving raw bytes before checking. Strict decoding and canonical
re-encoding reject corrupt transport; see [Base64 validation](https://docs.python.org/3.10/library/base64.html#base64.b64decode).
Only private count/digest/verdict summaries enter the host log, not full output.
This is not yet transport through the Judge0 HTTP API.

`streams.py` is a root-only one-shot controller for the existing VM. It checks
the original three services, maintenance/API restrictions, completed active-crash
continuation, prior drain proof, ten provider rows and earlier schemas. It freezes
the current boot, manifest/image, bundle and launcher/policy hashes; validates all
fifty saved summaries on the host; then rechecks old state before sealing evidence.
All database/Redis checks are read-only. There is no migration, submission POST,
queue insertion, new execution permit or change to the older held reservation.

## Fixed Cases

Each profile compiles once where needed and runs ten fresh sandbox invocations:

| Case | What must be demonstrated |
| --- | --- |
| Empty | Actual EOF with zero bytes, not a guessed null/absent field |
| Text plus stderr | CRLF and debugging diagnostics stay separate |
| UTF-8 plus NUL | Exact raw bytes survive capture and Base64 |
| Invalid UTF-8 | Complete invalid stdout is wrong; bad diagnostic bytes are not the answer |
| Boundary | Exactly 1 MiB stdout and 64 KiB stderr are retained completely |
| Overflow | 1 MiB plus one byte is output overflow; diagnostics can clip independently |
| Drain both | More than 2 MiB stdout and 128 KiB stderr drain without unbounded retention |
| Wrong answer | Normal execution does not imply a correct answer |
| ASCII whitespace | Token mode passes while exact mode preserves differences |
| Unicode whitespace | Non-breaking space remains token data, not a separator |

Compiler phases use the bounded diagnostic collector but these fixed sources
compile cleanly with empty diagnostics. Large/failing modern-compiler diagnostics
are not a claimed cloud result; diagnostic retention boundaries are unit-tested.

## First Cloud Failure and Local Correction

The user reported an 8,293-byte log, successful AppArmor parsing and the bounded
1536 MiB/0.5 CPU/128-task parent check, then `ProcessLookupError`. The retained
container is `ingenium-cg-run-w7KHlq`, reported exited with code 1; parent and
private runtime paths end in `ingenium-cg-run.w7KHlq`. The filtered output does
not establish completed profiles, phase metadata, final cleanup or a sealed result.
Do not infer output overflow from the wrapper's generic failure message.

The pinned identity helper catches `FileNotFoundError` but not the `ESRCH`
(`ProcessLookupError`) possible when a task disappears during `/proc` reads.
This observer defect is reproduced locally and is consistent with the reported
error; the original VM log has no traceback establishing its exact failing frame.
See the kernel's [dead-process descriptor behavior](https://docs.kernel.org/filesystems/proc.html#process-specific-subdirectories).
The stream caller now tolerates only that disappearing-task exception, preserving
any earlier positive observation and still requiring one before a successful
phase. Wrong identity, permission failures, incomplete EOF, phase failures and
resource/cleanup checks still fail. The completed pinned image/profile inputs
are unchanged; the correction does not silently rebuild or modify their manifest.

Local correction checks: 159 Python tests with one Linux-only skip; the 25 focused
stream/recovery tests include vanished-then-observed, observed-then-vanished,
never-observed, wrong identity, permission failures, altered resources/evidence,
live tasks and incomplete cleanup. Original archive 01 remains unchanged, SHA-256
`d2edb8edfd4309bc0c66c177094f46f1ee5df68a1f06c649118cc4b85f493328`.
Do not copy edited files over the failed extraction or rerun its controller.
The user subsequently reported `Running=false`, PID 0, exit 1 and no container
OOM. Seven task lists under the owned memory, CPU-accounting and pids parents/jobs
contained zero entries. This is not an all-controller check or completed cleanup;
the guarded recovery below verifies the other controllers before any removal.

## Historical Guarded Recovery: Do Not Repeat

The following archive-02 procedure completed successfully as recorded above.
Keep it for provenance, not as a command to execute again.

Use only new archive `ingenium-judge-streams-20261018-02.tar.gz`, uploaded through
Cloud Shell/IAP as in the chat. Extract it into a new sibling `streams-check-v2`
directory; leave `streams-check-v1` unchanged. The recovery validates that exact
original mounted bundle, failed log, journal stages, current boot, cached image,
manifest, limits, mounts and loaded profile. It checks every owned v1/unified
controller for empty task lists and unexpected subdirectories. Live tasks,
changed evidence or an existing recovery/corrected checkpoint block removal.

Only the exact stopped `ingenium-cg-run-w7KHlq` container, its unused profile,
verified-empty owned groups and two private runtime files may be removed. No
force removal, recursive cgroup deletion, permit reset, queue deletion or database
write is used. The original `streams-v1` journal and log remain byte-identical;
`streams-v1/cleanup-v1` separately records the checks/removal and ready proof.

After that proof and old-record checks pass, the same command explicitly starts
one new fifty-case fixed-fixture batch under `streams-v2`. It does not resume an
uncertain participant submission. It reuses the same cached five-profile image,
Isolate, limits and policy; no image rebuild or weakened isolation is involved.
The stream caller tolerates only the disappearing-task observation race and still
requires positive identity evidence. Bounded private phase/frame diagnostics now
identify future errors without printing output, inputs, locals or secrets.

On the VM, after verifying the archive checksum supplied in the chat:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 streams-check-v2
  tar -xzf ingenium-judge-streams-20261018-02.tar.gz -C streams-check-v2
  python3 -B -m unittest discover -s streams-check-v2/test -p 'test_*streams*.py'
  sudo python3 -B streams-check-v2/repair-streams.py
)
```

The 25 focused tests start no compiler, Judge0 or database connection. The real
Linux FIFO test must pass on the VM rather than be skipped. The final command
does the guarded removal and actual fixed-suite execution. Keep the three original
services running and retain the four-hour STOP guard, firewall and maintenance
configuration. If a precondition differs, stop and share PASS/FAIL output, not
private logs or configuration. Do not repeat the command, remove checkpoints or
force-clean if any stage fails, even if earlier cleanup steps succeeded.

## Historical First Run: Do Not Repeat

The following describes the failed archive-01 attempt only. Do not execute it
again. That procedure required uploading to **Cloud Shell** without replacing any
old extracted directory. The existing VM and three original lab services must be
running; retain the four-hour STOP guard, firewall and maintenance configuration.
If they stopped, use the saved existing-service restart procedure, not container
recreation, queue clearing or a permit reset.

```bash
gcloud compute scp ~/ingenium-judge-streams-20261018-01.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

On **the VM**, verify the checksum supplied in the chat, then:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 streams-check-v1
  tar -xzf ingenium-judge-streams-20261018-01.tar.gz -C streams-check-v1
  python3 -B -m unittest discover -s streams-check-v1/test -p test_streams.py
  sudo python3 -B streams-check-v1/streams.py
)
```

The 18 focused unit tests never start a compiler, Judge0 or database connection.
One test uses real Linux FIFOs and a fixed writer thread; it is skipped on Windows
and must pass on the Linux VM. The final command is the actual isolated fifty-case
experiment. Share only its PASS/FAIL output, not configs, tokens or private logs.

The new root-private checkpoint is `/opt/ingenium-judge-spike/streams-v1`.
Preserve its journal, bounded `streams.log`, final `evidence.json` and any retained
sandbox on failure. **Do not rerun, remove the checkpoint, force-clean resources,
reset old permits or weaken the sandbox.** No automatic retry/cleanup of an
uncertain failure is implemented. Old public archives remain immutable.

## Verification and Limits

Original preparation checks: 152 Python tests with one Linux-only FIFO skip, 11 configuration
tests and 20 stubbed launcher groups. A separate capability-free local Docker
check also created/removed a FIFO under default seccomp. That used only Bash in
the cached PostgreSQL image, never its database entrypoint. No local compiler,
submitted program, Isolate, Judge0 worker or database server was started.

The shared checker is a lab implementation of the approved contract, not a newly
wired application endpoint, score/penalty rule, authoring validator or browser
preview. Runtime failures are intentionally fatal to this fixed-success suite;
generic cause precedence and modern compiler-error mapping remain separate work.
The suite's controlled programs do not attack/replace FIFO paths or open competing
readers, spawn hostile writers, or attempt filesystem/network/metadata escapes.
A passing result does not sign off those boundaries. All-five-profile HTTP
integration, authenticated generic stream evidence, broader crash/cancellation/
host-retirement recovery, modern dependency review and realistic load tests still
block participant readiness. No additional cloud resource or budget is requested.
