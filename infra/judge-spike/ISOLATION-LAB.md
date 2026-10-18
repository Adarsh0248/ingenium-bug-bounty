# Shared Sandbox Boundary Batch

Status: user-reported cloud PASS on 2026-10-18. This completed one-shot batch must
not be rerun; preserve its `isolation-v1` checkpoint and prior evidence.
This is one fixed trusted-probe batch on the existing isolated VM, not a general
security audit or permission to execute participant code. No new cloud resource,
image pull/build, public port, provider record, schema or database write is added.
Keep the approved architecture, four-hour STOP guard and original maintenance/API
settings unchanged.

## Three Checks in One Run

| Case | Required observation |
| --- | --- |
| Boundary | UID/GID 60000, no supplementary groups or effective/permitted/inheritable capabilities, failed root-UID change, descriptor/core/process limits; four denied IPv4/IPv6 TCP/UDP socket creations; inaccessible private paths, denied `/usr` write and no private environment variables |
| Fork limit | Exactly seven children held alongside their parent; the next fork fails with `EAGAIN`; all seven are joined normally; outside observer sees all eight accounted tasks |
| Detached child | Child calls `setsid`, acknowledges startup and sleeps while its parent exits; outside observer sees both live tasks, then proves both job-controller task lists empty before cleanup |

All three use the cached modern Python interpreter inside the same shared Isolate,
directory mapping, AppArmor, seccomp and cgroup machinery already used by the five
profiles. There is no new compiler or dependency. The probe deliberately tightens
its process cap to eight while retaining the existing Python CPU/wall/memory and
descriptor limits. It attempts at most nine forks, not an unbounded fork storm.
No compiler or application-specific language escape is covered by this batch.

The outer runner independently observes Python task identity, zero capability
sets (including ambient), no-new-privileges, seccomp, the hard process limit and
membership in both memory/CPU job groups. Disappearing `/proc` tasks are skipped,
not counted as positive observations. Pre-exec Isolate tasks are not mistaken for
the submitted Python process. Empty-task proof has a bounded two-second wait;
it does not kill unknown tasks or infer cleanup from elapsed time.

The process limit is a real kernel limit, not just an expected error string:
Linux documents `RLIMIT_NPROC` and its `EAGAIN` failure in
[getrlimit](https://man7.org/linux/man-pages/man2/getrlimit.2.html) and
[fork](https://man7.org/linux/man-pages/man2/fork.2.html). Capability reads use the
Linux capability-v3 ABI and the pinned Linux/amd64 syscall number, without a new
package: [ABI](https://man7.org/linux/man-pages/man2/capget.2.html),
[x86-64 syscall table](https://github.com/torvalds/linux/blob/v6.8/arch/x86/entry/syscalls/syscall_64.tbl).
Isolate's PID-namespace proxy/exit handling motivates the detached-child check,
but its source is not proof that runtime cleanup passed:
[pinned Isolate source](https://github.com/ioi/isolate/blob/v1.8.1/isolate.c).

## No Outbound Requests or Secret Reads

The socket probes stop at socket creation and require an actual permission denial;
they do not connect, resolve names, send packets or request Google metadata. Since
metadata access requires networking, denied socket creation supports that scoped
boundary, not a claim that every metadata transport/escape has been tested.
[Google metadata overview](https://docs.cloud.google.com/compute/docs/metadata/overview).
Unsupported socket families, exhausted file descriptors or unrelated errors are
not counted as the required denial.

A synthetic, non-secret marker exists in the outer container's private `/tmp` and
environment. The inner sandbox must not see either. Protected-path probes only
attempt to open paths: an unexpected successful open is closed immediately and
fails the batch, without reading secret bytes. No real credential contents are
printed, exported, copied into the sandbox or used as canaries. Unexpected writes
use one fixed scratch filename only; no existing file is overwritten.

## Preservation and Scope

`isolation.py` first verifies the completed five-profile HTTP checkpoint, all
fifteen completed provider records, the five sealed associations, saved evidence
digests, prior schemas and the held reservation. Current source/checker/profile
identities must match that checkpoint; only the external launcher is allowed to
differ, because this batch adds a separately fingerprinted, fixed mode. The new
launcher still uses the same image/policy/capabilities and only adds a read-only
isolation source bundle alongside the existing read-only stream bundle.

The controller captures its own boot, image/manifest, source fingerprints and
old-state snapshot before allocation and compares them after normal cleanup.
All database/Redis operations are read-only. It creates only root-private
`/opt/ingenium-judge-spike/isolation-v1` evidence plus temporary owned sandbox
resources. Existing checkpoints block another run. On failure, no permit is reset,
queue/record cleared, unproved slot released or uncertain resource force-removed.
Bounded phase, probe-failure and Isolate metadata diagnostics enter the private
host log before container tmpfs disappears; no raw environment/config is logged.

Known limits remain explicit: this fixed probe does not replace/read from the
writable-box stdout/stderr FIFOs, test arbitrary malicious submissions, kernel or
compiler exploits, stale host epochs, supervisor cancellation or concurrent team
capacity. The existing trusted-fixture FIFO collector is not yet approved for
hostile producers. Legacy Isolate/provider dependencies, output-endpoint hardening,
broader failure/recovery and measured load still require work before participants.

## User-Reported Cloud Result

The user supplied PASS output for all three cases: `boundary`, `fork-limit` and
`detached-child`. Each reported fixed denials/child observations, accounting and
normal cleanup verified. The controller then reported all fifteen provider rows
and previous evidence unchanged, queue empty and maintenance enabled. Both the
original three-service checks and four private API gates passed before and after
the probes. No assistant cloud operation or independent evidence-file inspection
was performed; this checkpoint records the supplied controller output.

No additional sandbox run is needed for this checkpoint. The next implementation
gap is hostile-producer output capture, including replacement/interference with
the writable-box FIFOs. The scope limits above still apply.

## Historical One-Shot Procedure

The following commands are retained for provenance, not for another invocation.
Do not remove checkpoints or create a fresh extraction to repeat a completed run.

Upload the archive linked in the chat through Cloud Shell/IAP. Keep old extractions
and checkpoints untouched, and ensure the existing three services are running.
After checking the supplied archive checksum:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  mkdir -m 700 isolation-check-v1
  tar -xzf ingenium-judge-isolation-20261018-01.tar.gz -C isolation-check-v1
  python3 -B -m unittest discover -s isolation-check-v1/test -p 'test_*.py'
  sudo python3 -B isolation-check-v1/isolation.py
)
```

The packaged tests use stubs/pure checkers plus the existing real Linux FIFO test,
which must not be skipped on Linux. They do not execute the sandbox probe, create
sockets/children, invoke a compiler or connect to a database. The last command is
the actual three-case Isolate run. It should finish with fifteen provider records
unchanged, previous evidence intact, queue empty and maintenance enabled.

On any failure, preserve `isolation-v1` and any named container, profile, workspace
or cgroups. Send the PASS/FAIL output first, not private logs/configuration. Do not
rerun, reset anything, delete the checkpoint or weaken restrictions.

## Local Verification

190 Python tests: 189 passed and one Linux-only FIFO test skipped on Windows.
11 configuration tests and 24 stubbed Bash launcher groups passed. The latter
run in restricted, network-free Bash in the already cached PostgreSQL image,
never its database entrypoint. No native probe syscall, live socket, forked probe,
compiler, Isolate, database server or cloud operation was run by the assistant.
The new tests cover denial causes, cleanup of unexpectedly opened handles,
bounded fork/join logic, identity/capability/limit checks, outside observations,
capture integrity, live-task refusal, diagnostic retention and read-only old-state
verification. Local test coverage is separate from the user-reported VM result
recorded above.
