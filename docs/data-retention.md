# Database Payload Retention

The app now separates byte expiry from permanent competition history. Migration
`0069_payload_retention` adds guarded nullable payloads and immutable purge
tombstones. `0070_retention_operations` records committed cleanup progress.
`0074_retention_batch_budget` reduces each transaction's candidate count without
changing eligibility, payload checks, permissions or transaction deadlines.
These migrations have only been applied to disposable synthetic databases.

## Policy

| Data | Earliest retirement |
| --- | --- |
| Expired participant/staff/replacement flow proof verifier | 24 hours after its original ten-minute deadline |
| Dead participant/staff session verifier | 24 hours after absolute expiry or recorded revocation, whichever is earlier |
| Participant drafts and sample source | 7 days after the owning arena is completed/discarded |
| Participant retained stdout/stderr/compiler diagnostics | 7 days after the owning arena is completed/discarded |
| Official source, in both admission and judging copies | 30 days after the owning arena is completed/discarded |
| Authoring retained stdout/stderr/compiler diagnostics | 7 days after validation ends, when physically safe and not selected in a reserved/live arena |

Idle expiry alone does not shorten session-verifier retention. Flow revocation
conservatively waits for the original deadline plus 24 hours; it does not give a
revoked proof another usable moment. Existing encrypted-handoff cleanup remains
separate and runs every ten seconds.

The retention origin is the actual applied terminal source: Round 2 finalisation,
discard or finished whole-round cancellation. Round 1 finalisation alone is not
arena completion. Overnight Round 1/2 intermission cannot start the seven-day
clock. Missing terminal provenance cannot authorize cleanup.

Every participant parent in the arena must be completed/cancelled, no round may
be live/closing/cancelling, and every physical attempt must have positive release
and no capacity-slot reference. A result or timeout alone is not drain proof.
Uncertain work blocks cleanup. There is no force flag, purge button, permit reset
or invented verdict.

## What Survives

Results, scores, ledgers, awards, purchases, names, stable identities, languages,
attempt metadata, case results, admission order, elapsed times, fingerprints,
immutable receipts and staff audit remain. Frozen challenge/reference/test
content is not deleted by this batch.

Each retired source/output field keeps its original byte length and SHA-256 in
`payload_purges`. Verifier tombstones keep only the former 32-byte length, not
another secret-derived verifier hash. Bytes become SQL NULL, never empty text,
a fake empty program or a replacement starter. An intentionally empty saved
draft remains distinguishable from an expired draft.

Purge records and effects commit atomically. Guards reject fake tombstones,
direct nulling, missing effects, changed verdicts/receipts and byte resurrection.
Both official-source copies retire in the same transaction. Existing guard
bodies are preserved with one narrowly source-bound retention transition
prepended; deferred plan/accounting checks remain enabled. Reservations use the
remaining fields, retaining their existing conservative base. History cannot be
deleted to free a physical slot or reset capacity.

Expired code/diagnostic reads return HTTP `410 / PAYLOAD_EXPIRED` after normal
authority and scope checks. Metadata/history/results remain available. Old
private-read receipts cannot recover expired bytes. Confirmed expiry clears only
that private-read recovery wait, never an uncertain submission/gameplay command.

## Automatic Maintenance And Status

The protected API schedules verifier and payload cleanup every sixty seconds
after the previous batch finishes. Each selects at most five rows; paired
official-source retirement can produce ten tombstones. The smaller batch leaves
room for deferred byte/source checks within the existing three-second transaction
limit. Security, arena,
ordered round, catalogue and judge anchors protect the eligibility recheck.
Clock trust is required before and after the transaction. Failures roll back
and retry normally. Backlogs drain across batches; intervals are not deletion
latency guarantees.

Owners/Super Admins can open **Maintenance** for the last committed completion,
last batch count, total retired payload records and physical-reservation count.
It is read-only, current-authority/quota protected, and never renews activity.
Refresh is thirty seconds, non-overlapping; failed/revoked reads clear status.
More than three minutes without completion is Overdue, not auto-repaired. A
recent zero-row batch proves a scan ran, not that all retained work is eligible.
No source, verifier, identity or diagnostic payload is exposed.

Purge tombstones have an eight-million-row ceiling and bounded manifests.
Remaining metadata is counted conservatively; whole-app capacity reservations
and event-sized query plans still need the separate production/load review.
At a limit, preserve records and use approved offline archival, never selective
deletion of canonical history.

## After The Website Stops

After deployment rehearsal, an operator can use the finite Linux-only command:

```sh
npm run maintenance:retention --workspace @ingenium/api -- \
  --runtime /etc/ingenium/retention-runtime.json \
  --confirm RETIRED_PAYLOADS --batches 10
```

This is documentation, not a command run against event data. The build must
already exist; no migration/service installation is automatic. The private JSON
has exactly `schema_version: 1` and `database_url`, a local `ingenium_api`
connection with a password. Keep it outside Git, shell arguments and logs.
The shared private-file reader requires a protected absolute Linux path and
owner-only permissions. No cookie, delivery, draw, worker TLS or owner DB secret
is needed.

Stop API/judging cleanly first. The command refuses a running clock monitor,
latched timing incident, reserved arena, unfinished participant/validation work
or physical reservation. It cannot take over a running monitor. Fresh normal
trust is established through the existing protected Linux clock probe, then
retired-only state is rechecked under every batch's locks. No HTTP listener or
participant execution is started. A new API runtime or timing fault fences it;
never clear an incident just to run cleanup.

`--batches` is 1..100, defaults to one, and stops early after an empty pair of
scans. SIGINT/SIGTERM prevents the next batch; an in-flight transaction finishes
before clock shutdown. Output contains only a fixed event and aggregate counts.
Lost acknowledgements reconcile through progress/tombstones. Repeating a scan
cannot resurrect bytes or apply scoring.

Arrange deliberate runs after the seven-/thirty-day deadlines when the API is
stopped. No cloud scheduler or billable service was created. Native Linux
CLI/probe/service-ownership rehearsal remains pending.

## Verification And Limits

```powershell
$env:INGENIUM_TEST_SUITE='retention'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

Fixtures are synthetic/disposable. They age only their own timestamp columns
under test-owner authority, without changing host time or shortening production
policy. Checks cover boundaries, intermission, holds, rollback, duplicates, both
source copies, byte/hash tombstones, empty drafts, no resurrection, verifier
safety, accounting, results, HTTP expiry/privacy and desktop/mobile status.
Offline controller/monitor checks use synthetic observations, not native Linux
clock or installed-judge evidence.

Verified locally: 278 unit/client tests, thirteen focused PostgreSQL/HTTP/browser
checks, ten existing maintenance checks, eleven clock checks and the existing
four-check full both-round/staff browser regression. Builds/typechecks, formatting,
schema consistency and production bundle-boundary checks pass. Desktop/mobile
screenshots were inspected. The complete global test matrix was not rerun.

Database expiry does not erase downloads, browser memory, logs, backups or judge
files. Judge-host source/evidence still needs positively verified retirement and
retention integration. Encrypted archival, off-host backups, restore-time purge /
revocation, backup/log lifetimes and full event-load/security/recovery rehearsal
remain required. No normal-panel restore/reset or unlimited metadata lifetime
is introduced here.
