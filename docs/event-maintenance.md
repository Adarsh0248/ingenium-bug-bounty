# Automatic Event Maintenance

The protected API server now starts bounded maintenance only after it has a real
entry runtime and has begun listening. Foundation-only startup and the synthetic
visual preview do not start it. No browser endpoint can run these tasks.

| Task | Delay after the previous batch finishes | Work per batch |
| --- | --- | --- |
| Round deadlines | 1 second | Up to ten round IDs; one separately guarded transaction per round |
| Validation deadline | 5 seconds | Existing active validation deadline function |
| Login delivery cleanup | 10 seconds | Up to 200 unusable encrypted payloads in each delivery family |
| Shared quota cleanup | 60 seconds | Up to 200 unused, fully refilled keys |
| Expired verifiers | 60 seconds | Up to twenty proof/session verifiers with immutable tombstones |
| Retired source/diagnostics | 60 seconds | Up to twenty selected rows; paired official sources can produce forty tombstones |

The two-connection monitor/maintenance pool is reused, not a pool per task or
request. Each task is non-overlapping. Failure logs contain only a fixed event
and task name, at most once per task per minute. A failed task retries on its
normal schedule; it never bypasses a failed clock or transaction guard. These
intervals are targets, not latency guarantees under database contention/outage.

## Competition Behaviour

The security, arena, ordered round, catalogue and judge anchors are the existing
ones. The database clock is checked under those locks. A running current round
becomes `CLOSING` when its effective close time is reached, without a browser
read or staff click. Global `PAUSED` remains paused; only the existing confirmed
resume command extends the close time. Timer closure increments the revision
once and uses the existing durable live notification trigger.

An expired sample Run becomes logically `COMPLETED / INFRA_ERROR` after its
original 120 seconds, at most twenty parents per round transaction. This does
not become a participant penalty, release an unsafe physical attempt, reset its
source/time/language, or authorize another execution. Expired samples from an
older round are also eligible for cleanup, including after results close.
Existing cancellation cleanup remains bounded to twenty parents and preserves
its original incident source. Maintenance cannot finish a cancellation, release
the singleton arena or fabricate sporting results.

Official work remains unresolved until the existing evidence-driven worker can
complete it safely. Staff still explicitly finalise results, qualify teams and
start Round 2. The separate [app-side judging service](judging-runtime.md) now
drives validation/participant work; the judge VM's gateway/supervisor/executor
installation and genuine host readiness are still separate requirements.
The existing live publisher/replay cleanup stays with the single API/live process.

## Cleanup Boundaries

Encrypted session-delivery and replacement-proof payloads are cleared only after
their original expiry or observed revocation/supersession. Valid handoffs remain
unchanged. Sessions, identity slots, enrolled languages, activity deadlines,
canonical receipts and audit history are never deleted or renewed by this task.

Quota cleanup locks the separate quota anchor, never a business/round lock. It
selects keys unused for at least fifteen minutes whose allowance has actually
refilled, calculated with overflow-safe numeric eligibility and the existing
integer refill check. A recent or still-depleted bucket cannot be deleted to
reset its allowance. Only this transient quota table receives a new delete
permission; canonical history remains protected.

The later [database payload retention](data-retention.md) batch implements the
seven-/thirty-day participant source/diagnostic policy, 24-hour verifier
tombstones, committed progress/status and a finite retired-only operator command.
Whole-dataset archive/restore, judge-host byte retirement, native installation
and load rehearsal remain open. Database purges do not erase backups.

## Shutdown and Verification

Shutdown cancels future timers and waits for active batches before stopping the
clock monitor and closing its pool. Restart rebuilds timers from database state;
there is no in-memory execution queue, retry counter or scoring state to replay.
Apply reviewed migration `0061_event_maintenance` before using the runtime. No
development/cloud database has been migrated by this implementation.

Focused disposable verification:

```powershell
$env:INGENIUM_TEST_SUITE='maintenance'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

The fixture uses synthetic identities and judge observations. It waits for the
real two-minute sample deadline instead of changing host time or shortening the
production policy. Unit tests separately exercise overlap, shutdown and retry.
Actual primary-host process startup and event-sized retained-data query plans still
need deployment rehearsal; passing these checks is not an event-ready claim.
