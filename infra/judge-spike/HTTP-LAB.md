# Private HTTP Association Lab

Status: user-reported cloud run passed on 2026-10-18; preserve its evidence and
do not rerun this completed experiment.
This is one experiment on the existing isolated VM, not an event deployment.
It adds no public ports, new VM, dependency, compiler image or application schema.
The approved architecture is unchanged.

## Recorded Result

The user reported all final PASS lines from the prepared runner:

- Authenticated HTTP admission committed one real provider record and durable
  outbox association. Discarding the token reply body and explicitly injecting
  the same POST again resolved to that same record.
- Two actual Redis deliveries reached separate guarded worker processes; only
  one compiled and executed the trusted fixture.
- After that worker's committed reply was deliberately lost, HTTP lookup
  recovered its result. The original Judge0 API returned `12` plus a newline,
  with accounting matching the execution evidence.
- Ten provider records were retained: one new row and all nine earlier rows
  unchanged. The old held reservation was unchanged, the queue ended empty and
  the original API remained in maintenance. The original authentication/version/
  maintenance/batch checks passed again at the end.

This records the user's terminal report, not an independent assistant inspection
of private database rows, processes, journals or billing. No new detailed runtime
measurements or manifest identities were supplied. This closes the fixed HTTP
association experiment only, not the remaining proof limits listed below.

Preserve `/opt/ingenium-judge-spike/http-v1`, `ingenium_http_v1` and all earlier
evidence. The completed archive remains unchanged:
`ingenium-judge-http-20261018-01.tar.gz`, SHA-256
`61592b91657b51d44a2eae2152fd32a0a008d2eb7d2debe8e215114b6e45cc22`.

## What This Tests

```text
fixed authenticated HTTP request
  -> one PostgreSQL transaction
     -> real Judge0 submission + immutable attempt/token link + outbox envelope
  -> token reply body deliberately discarded
  -> GET by the saved attempt ID resolves the same record
  -> commit one-time send marker before touching Redis
  -> inject two identical queue messages deliberately
  -> deliver them to two separate guarded worker processes
     -> only the acknowledged permit winner can launch
     -> trusted C++ fixture + accounted sandbox cleanup
     -> one transaction seals evidence and updates the real Judge0 result
  -> worker exits without returning its committed reply
  -> HTTP lookup and original Judge0 result read recover the saved result
```

The endpoint is a read-only initializer mounted into a temporary private copy of
the existing API image. It accepts only one frozen lab binding, never arbitrary
source code. The original API remains unchanged and in maintenance. Stock
submission creation stays in maintenance in the temporary copy too. The custom
endpoint uses the existing authentication token only through its header.

The middleware uses Judge0's real `Submission` model and serializes its real
ActiveJob envelope without starting the stock retrying worker. Both the mapping
and envelope commit with the new submission. A repeated identical lab request
returns the same token; mismatched bindings are rejected. Real client recovery
uses GET, not an automatic POST retry.

This deliberately reuses the earlier trusted C++/GCC 9.2 fixture to isolate the
HTTP/association question. The five newer pinned runtime profiles are preserved,
not rebuilt or connected to this old stock language ID. This is not evidence of
arbitrary submissions or all-five-language end-to-end dispatch.

## Preserved and New Data

- All nine existing provider rows must remain byte-for-byte unchanged.
- Both prior recovery rows, including the intentionally held reservation, must
  remain unchanged. No old probe or repair procedure is rerun.
- New schema: `ingenium_http_v1`. Its single row has a real provider token/ID,
  immutable binding/envelope, one-time send marker and the existing permit states.
- New private checkpoint: `/opt/ingenium-judge-spike/http-v1`, created exclusively.
  Evidence and worker replies are fsynced and retained, not overwritten.
- On success, there are **ten** real Judge0 submission rows, not nine. Earlier
  whole-database empty/nine-row probes are historical and must not be rerun.
- Only the temporary API created by this run is stopped/removed. Its captured
  bounded logs remain private. The API secret copy is unlinked after removal.

Before changing the database, the script runs the Ruby request-handler checks
inside the existing API container with fake credentials and database stubs.
Those checks cannot launch a sandbox or access the database. The real HTTP and
database checks follow only if this preflight passes.

## Historical Run Procedure

**Completed: do not repeat these commands.** They record how this checkpoint was
obtained. In particular, do not recreate the checkpoint/schema or run historical
whole-database empty/nine-row checks against the now-ten-row lab.

Use the new archive linked in the chat. Upload it to your Cloud Shell home
directory. The existing VM must be running; its three original lab services must
already be healthy. Keep its current four-hour stop guard, network and firewall.

In **Cloud Shell**:

```bash
gcloud compute scp ~/ingenium-judge-http-20261018-01.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

On **the VM**, use the archive checksum shown in the chat:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  # First verify the exact SHA-256 using the command supplied with the archive.
  mkdir -m 700 http-check-v1
  tar -xzf ingenium-judge-http-20261018-01.tar.gz -C http-check-v1
  sudo python3 -B http-check-v1/http-flow.py
)
```

Share the terminal PASS/FAIL lines only, not private configs, tokens, context
files or database dumps. The script refuses another host, root directory mode,
boot/runtime identity, nonempty queue, existing checkpoint/schema, changed old
evidence or unexpected running Compose services.

**On failure, stop and share the output.** Do not repeat the script, clear its
records/queue, force-remove resources, reset a send marker/permit, or loosen
AppArmor, seccomp or cgroup restrictions. A committed permit with no confirmed
result is deliberately not reusable.

## Limits of This Proof

This is a fixed, bounded experiment. It does not provide a public admission
service, general source/test-case validation, a permanent worker loop, outbox
recovery after a lost send acknowledgement, an active-execution crash/drain
proof, host retirement, general stream completeness, adversarial isolation or
capacity results. A stopped VM does not by itself authorize resetting a permit.

Local checks alone cannot prove Rails/PostgreSQL/container behavior on the VM.
The reported cloud run exercised those real components for this fixed fixture;
it does not generalize to all profiles, arbitrary source or untested failures.
No Judge0, compiler, submitted program or database server was run locally.

The implementation follows the pinned upstream
[submission model](https://github.com/judge0/judge0/blob/v1.13.1/app/models/submission.rb)
and [Rails job serialization](https://github.com/rails/rails/blob/v5.2.4.3/activejob/lib/active_job/core.rb).
It deliberately does not invoke the stock
[IsolateJob retry/execution path](https://github.com/judge0/judge0/blob/v1.13.1/app/jobs/isolate_job.rb).
