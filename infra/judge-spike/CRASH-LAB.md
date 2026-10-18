# Active Worker Crash and Drain Lab

Status: user-reported cloud PASS on 2026-10-18 after the guarded continuation
corrected the unstarted schema failure. Both run procedures below are historical;
do not repeat them or reset the consumed permit.
This is a fixed trusted workload on the existing isolated VM, not participant
execution or a permanent worker service. No new VM, compiler image, network,
credential, public port or approved architecture change is needed.

## Reported Cloud Result

The user supplied all final PASS lines for archive 02, SHA-256
`10df59b061103d663072b6e0616e1ccb76f1ea48e2a00104ed9c8437c8c01e57`.
The reported result establishes this fixed workload's boundary:

- Corrected named checks created the new schema using the original unstarted
  context; no permit or existing record was reset.
- The host worker and launcher were killed while two observed UID-60000 sandbox
  processes stayed alive. Capacity remained reserved, early release was refused
  and a fresh replacement worker could not relaunch the consumed permit.
- The controller stopped the original pair through stable process handles,
  explicitly cleaned the workspace/job groups, then removed the owned stopped
  container, profile and every empty owned cgroup.
- One durable release was reconciled after deliberately losing its reply. The
  permit remained consumed; no normal result or participant verdict was invented.
- The original context/main journal, ten provider rows and earlier recovery
  evidence stayed unchanged. Only the original three lab services remained
  running, and all four authentication/version/maintenance/batch gates passed
  again. The final API was still in maintenance.

The completed continuation journal is
`/opt/ingenium-judge-spike/active-crash-v1/schema-fix-v1/journal.jsonl`. The original
main journal intentionally still records `PREPARED`; preserving it was part of
the repair, not evidence that the continuation did not run. Preserve both journals,
the saved context, worker logs and drain proof, and `ingenium_active_crash_v1`.
This synthetic row remains `STARTED` with a separate committed drain proof; that
is not a reusable permit or the older intentionally held reservation.

This is a user-supplied terminal report, not independent assistant inspection of
private files, database state, process handles or cloud billing. No execution
timings, new language integration results or adversarial isolation proof were
supplied. Public archives remain unchanged snapshots from before this report;
only local documentation records the outcome.

## The Failure Being Tested

```text
register one new synthetic attempt and consume its one-time execution permit
  -> start a fixed shell and its sleeping child inside the existing sandbox
  -> observe both real processes as UID/GID 60000 in the owned job cgroups
  -> kill the host worker's isolated process group, including its launcher
  -> confirm the sandbox pair is still alive and capacity remains reserved
  -> refuse an early release and a fresh duplicate worker's launch claim
  -> stop only the observed pair through stable process handles
  -> wait for Isolate to finish; explicitly remove its workspace/job groups
  -> stop/remove the owned outer container; verify every owned controller empty
  -> unload its exact profile and remove only empty owned groups/private files
  -> save drain proof, then commit the once-only reservation release
  -> drop that release reply and reconcile the same proof without another launch
```

A dead host worker is not proof that Docker's remaining execution stopped. The
test deliberately demonstrates that distinction. The workload is a bounded
shell/sleep pair, not arbitrary C++ code or a CPU-heavy benchmark. The inner
wall limit is 120 seconds, the child waits at most 90 seconds, and the outer
container has a 150-second deadline. Elapsed time never releases capacity.

The shared launcher retains its original network-none, read-only filesystem,
AppArmor/seccomp, capability and 256 MiB/0.5 CPU/32-task parent settings. The new
mode adds only a fingerprinted, read-only trusted script bind. The script copies
the fixed image's existing sleep executable into its sandbox; it does not add a
host binary or expose `/proc`, cgroups, credentials or network to that workload.

Before signalling the sandbox pair, the controller opens stable Linux process
handles and verifies start identity, UID/GID and owned cgroup membership. A
recycled numeric PID is not a kill target. See Python's
[process-handle signalling](https://docs.python.org/3.10/library/signal.html#signal.pidfd_send_signal).
The explicit workspace cleanup runs only after trusted outer completion and
empty job groups, then checks the workspace and job groups are absent. See the
[Isolate cleanup implementation](https://github.com/ioi/isolate/blob/v1.8.1/isolate.c).
Stopping the outer container alone is not the release proof; recursive empty-task
checks and exact owned-resource removal must also succeed.

## Data and Evidence

- Preserve all ten real Judge0 submission rows and both earlier recovery schemas
  byte-for-byte. Do not rerun the HTTP fixture or any old nine-row/empty probes.
- New private checkpoint: `/opt/ingenium-judge-spike/active-crash-v1`.
- New private schema: `ingenium_active_crash_v1`, containing one synthetic permit
  and reservation row, not another real Judge0 submission.
- The consumed permit stays consumed after drain. The row's execution state
  remains `STARTED`; a separate immutable `drained_at`/proof digest records safe
  physical release. It cannot acquire another permit or invent `Accepted` or any
  participant verdict. This is not a complete application scheduler/schema.
- Preserve `context.json`, the main/worker/drain journals, `worker-output.log`,
  the worker's sandbox log and `drain-evidence.json`. These are private, not Git
  artifacts. A failure retains reservations and uncertain resources for review.
- The old intentionally held crash-before-launch reservation remains unchanged.
  This new proof cannot release or reset another attempt's reservation.

The existing cached worker-preparation image is reused. All ten files defining
the five newer pinned runtime profiles remain unchanged. The shared launcher has
a new fixed mode; unpack this archive separately rather than replacing source
files in old completed experiments. Old public archives must remain unchanged.

## Historical Schema Continuation: Do Not Repeat

The user reported only `PREPARED` in the main journal, no worker journal, no
active-crash schema/table, no probe container and cgroup v1/cgroupfs. PostgreSQL
then confirmed `constraint "attempts_check" for relation "attempts" already
exists`. The new multi-column check received the name of a check copied by
`LIKE ... INCLUDING ALL`. The corrected SQL names all three new checks
explicitly; it does not drop constraints or change the permitted transitions.
The older `database "judge0" already exists` log entries are separate startup
messages, not the reported schema failure.

The completed continuation used archive **02**. Do not rerun either script, delete
the failed checkpoint, replace archive 01, or apply the SQL manually.
`resume-crash-schema.py` requires exactly the original two private files, a
single matching `PREPARED` record, an absent schema and absent owned sandbox
resources. It revalidates the saved boot, runtime/fixture hashes and original
records before creating an exclusive `schema-fix-v1` journal. An existing repair
journal, schema, worker file, changed boot or changed baseline refuses further
action. A lost schema acknowledgement cannot lead to execution or an automatic
retry. The original `context.json` and main journal stay unchanged.

Upload the archive linked in the chat to **Cloud Shell**, then:

```bash
gcloud compute scp ~/ingenium-judge-active-crash-20261018-02.tar.gz \
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
  mkdir -m 700 active-crash-check-v2
  tar -xzf ingenium-judge-active-crash-20261018-02.tar.gz -C active-crash-check-v2
  python3 -B -m unittest discover -s active-crash-check-v2/test -p test_active_crash.py
  sudo python3 -B active-crash-check-v2/resume-crash-schema.py
)
```

Do not replace the original extracted files. The continuation preserves its
original evidence and records new progress in
`/opt/ingenium-judge-spike/active-crash-v1/schema-fix-v1`. All previous failure
rules still apply: stop on any failure and share only the PASS/FAIL output.

## Historical First Run: Do Not Repeat

Upload the new archive linked in the chat to your Cloud Shell home directory.
The same VM and three original lab services must be running. Keep the VM's
existing four-hour STOP guard and firewall unchanged. A stopped/rebooted VM is
not an execution-epoch retirement proof or permission to reset old records.

In **Cloud Shell**:

```bash
gcloud compute scp ~/ingenium-judge-active-crash-20261018-01.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

On **the VM**, first verify the checksum supplied in the chat, then:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 active-crash-check-v1
  tar -xzf ingenium-judge-active-crash-20261018-01.tar.gz -C active-crash-check-v1
  python3 -B -m unittest discover -s active-crash-check-v1/test -p test_active_crash.py
  sudo python3 -B active-crash-check-v1/active-crash.py
)
```

The first command runs mock-only unit checks on the VM's Python/Linux version;
it cannot launch a sandbox, contact PostgreSQL or send a real signal. The final
command runs the actual experiment only if those checks pass.

Share terminal PASS/FAIL output only, not tokens, configs, private journals or
database dumps. **On any failure, stop.** Do not rerun, reset permits/send states,
clear queues/records, remove live groups, force-remove containers or weaken the
security policy. The controller removes only its verified owned resources after
positive termination/cleanup evidence. It never recursively deletes cgroups.

## Remaining Limits

Local mocks do not prove Linux process, Docker, Isolate or PostgreSQL behavior.
Before the cloud continuation, correction checks passed: 134 Python tests and 11 configuration tests. The
unchanged launcher previously passed 18 stubbed sandbox-orchestration groups;
it was not rerun for this SQL/continuation-only correction. The archive includes the 19 focused Python
tests so the same mock-only checks can run on the VM before real execution.
No Judge0, compiler, submitted program or database server was run locally. The
cloud continuation now has the reported scoped PASS above. Only that specifically
reported, unstarted schema failure had the guarded continuation. There is no general
automatic resume/cleanup procedure; preserve evidence and inspect the exact
boundary first.

The successful result covers only this trusted active-run crash/drain
boundary. Compile-phase crashes, a controller crash during drain, host-epoch
retirement, uncertain outbox-send recovery, general stream completeness, all
five profiles through the full HTTP path, hostile-code isolation and event-load
testing remain open. No live competition or participant code is enabled.
