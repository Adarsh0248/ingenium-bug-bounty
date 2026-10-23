# Private Operations Observation

Owner and Super Admin can read Operations in the Maintenance view. Organisers,
participants and unauthenticated browsers cannot. The strict GET endpoint is
`/api/v1/staff/maintenance/operations`; responses are bounded, noncacheable and
contain counters/ages only. Reading it does not renew a staff session. Query
overrides and HEAD are refused. No public metrics endpoint was added.

The fifteen readings cover database bytes/connections, waiting locks, pending
official/sample/validation work, oldest official age, held physical slots,
quarantined epochs, committed plus reserved live deliveries, unpublished update
count/age, participant accounted storage, quota-key capacity and cleanup-scan age.

Warnings use the approved thresholds: 70% database connections, oldest official
work at five minutes, unpublished updates older than two seconds, cleanup scans
older than three minutes and 75% measured logical budgets. At 90% those budget
readings are critical. Quarantine or a clock fault is critical. A held execution
slot is **not by itself a failure** and never grants permission to release it.
The capacity shown for physical slots is the database's actual current two-slot
development limit, not the proposed eight-slot production target.

These are observations, not automatic pause, cancellation, penalty, retry or
spending commands. The report never gives a whole-event all-clear: host CPU/RAM/
disk, off-host backup/WAL integrity, real judge readiness, whole-app storage
reservation and external uptime/alert delivery are explicitly unverified. A
database-size reading is not free-disk headroom; participant accounted bytes
are not all decoded app data. Do not infer the full 32 GiB budget is implemented.
The existing live counter charges a conservative 16 KiB per row/reservation.

The UI refreshes every thirty seconds without overlapping requests. A failed
request clears the old readings and shows an error, not a stale green screen.
It uses normal protected authority and thus becomes unavailable during a clock
fault or restore quarantine. That is why the separate offline observer exists.

## Offline Observer

On a reviewed Linux installation, use a protected runtime file with exactly
`schema_version: 1` and `database_url` for the restricted `ingenium_api` role on
loopback PostgreSQL, following the [retention runtime rules](data-retention.md).
It must not contain a schema-owner credential. Run the built command explicitly:

```sh
npm run maintenance:observe --workspace @ingenium/api -- \
  --runtime /etc/ingenium/observer-runtime.json
```

The command creates no listener or clock runtime, uses read-only transactions,
has a two-second SQL deadline and prints one bounded source-free report. It can
inspect a stopped/faulted/quarantined app without granting access or starting
judging. Exit 1 means unavailable/stale observation; exit 2 means the report was
read but is not an all-clear because external checks remain unverified. There
is deliberately no exit-0 production-readiness signal. A future approved alert
collector must understand these states rather than treating any JSON as healthy.
No scheduler, notification destination or cloud monitoring service was installed.

## Recovery Inventory

The schema-owner quarantine CLI also supports read-only inspection:

```sh
npm run maintenance:restore-quarantine --workspace @ingenium/api -- \
  --runtime /etc/ingenium/restore-runtime.json \
  --inspect --request-key ORIGINAL_QUARANTINE_UUID
```

It requires the original receipt in the selected database and reads a consistent
snapshot of old access/capsules, reserved arenas, unfinished rounds/work,
unreleased attempts, held slots, epochs and clock-running state. No code, raw
verifier, endpoint address or secret is returned. Access invalidation and logical
epoch quarantine are derived from rows; external fencing, complete sporting WAL,
secret rotation, trusted current time and retention catch-up remain UNVERIFIED.
The report always keeps admission forbidden. It is not a reopen/clear command.

## Tests

```powershell
$env:INGENIUM_TEST_SUITE='operations-browser'
npm run test:db:schema
$env:INGENIUM_TEST_SUITE='restore'
npm run test:db:schema
$env:INGENIUM_TEST_SUITE='operations-linux'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

Both use disposable synthetic PostgreSQL and normal application code. Browser
checks cover desktop/mobile, failure/recovery, lost staff authority and no write
controls. Recovery tests verify held work remains unchanged while offline
observation is still possible. The Linux-container check executes the built
CLIs as UID 1000 with mode-600 runtime files, no ambient settings, restricted
roles and an isolated migrated database. It verifies original-receipt lookup,
read-only recovery inventory, quarantine observation, rejection of mixed modes,
wrong database roles and world-readable settings. These checks passed locally.
Real-host installation and real alert delivery remain deployment gates.

`infra/maintenance/test/cloud-operations.sh` is a deliberately test-only replay
for the existing `ingenium-judge-spike-01` host. It uses fresh UUID-labelled,
bounded containers, network-none PostgreSQL with no published ports and a Node
container sharing only that test network namespace. No old lab service is
started or connected. Only a successful run removes its own labelled test
containers; failures retain them for inspection. It does not start an app,
install a scheduler, certify the judge, consume a retained lab permit or open
participant admission. Uploaded bundles must exclude private runtime files.
