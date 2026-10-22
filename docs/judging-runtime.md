# Separate App-Side Judging Service

This completes the primary application's judging-service wiring. It is **not**
the judge VM's gateway/supervisor installation or a certification of its sandbox.
Those remain mandatory launch gates. Nothing here deploys a VM, provisions real
credentials, migrates development/cloud data or starts an old lab controller.

## What Runs Where

```text
API: entry/commands -> guarded PostgreSQL admission -> frozen jobs
                         |
separate app worker: shared lease -> validation or participant scheduler
                         |
                 pinned private mutual TLS
                         |
               installed judge gateway/supervisor
                         |
original evidence -> frozen checker -> existing result/economy/live rules
```

The worker has no HTTP listener, browser login route, shared API session key,
draw key, schema-owner password, Docker access or direct compiler invocation.
It uses a four-connection pool and a separately provisioned login belonging to
the new `ingenium_app_worker` NOLOGIN privilege group. Reviewed migration
`0062_app_judging_runtime` grants the existing narrow judging functions and
required frozen-input reads. It cannot read access credentials/staff sessions,
operate staff commands, purge history, grant retries or migrate the schema.
Startup rejects API/owner/privileged database credentials.

Validation and participant adapters use one process worker UUID and the existing
generation-fenced thirty-second lease. A turn checks the trusted clock, renews
private judge compatibility at least every five seconds, then runs the existing
validation/participant scheduler. Turns are non-overlapping and initially spaced
250 ms after completion; per-job polling/backoff and official/sample fairness
remain in PostgreSQL. An active validation still excludes participant execution.
No slot count, retry count, runtime limit or scoring rule is increased.

## Private Configuration

All real files stay outside Git. The checked-in examples are deliberately
unusable placeholders:

- `infra/clock-agent/entry-runtime.example.json`: existing API browser keys.
- `infra/clock-agent/competition-runtime.example.json`: API-only draw-purpose key
  and expected judge epoch/endpoint/five runtime digests. **No judge TLS key.**
- `infra/clock-agent/judging-runtime.example.json`: worker-only loopback database
  credentials, the same expected descriptor, private IP/port and pinned mutual
  TLS material. **No browser keys or draw key.**

The common Linux reader requires an absolute path, a restricted non-root service
UID, protected real parent directories and a private regular single-link file.
It rejects symlinks, hardlinks, FIFO/device targets, group/other permissions,
oversized files, malformed UTF-8 and changed opened-file identity. The existing
entry loader now uses this same stricter check. Secret mounts must satisfy it;
do not point it at a projected symlink or a world-writable temporary directory.
Files must also be readable by their intended service account.

The API enables competition wiring only when both `ENTRY_RUNTIME_FILE` and
`COMPETITION_RUNTIME_FILE` are explicitly supplied. Its readiness dependency
reads the current healthy database clock, active host, matching endpoint, all
five frozen manifests and current worker lease. It does **not** acquire the
worker's TLS key, proxy arbitrary judge requests or install a fake driver.
Readiness is a lease, not a promise that a remote outage is instantly visible;
admitted work still keeps its reservations and recovery rules.

The worker's `JUDGING_RUNTIME_FILE` has no fallback to `.env`, API credentials,
schema-owner credentials or synthetic execution. The existing private HTTPS
client checks its CA, exact leaf fingerprint, server name, epoch and profiles,
rejects redirects/compression/oversized transport and never blindly retries POST.

Keep the independent draw key while an unrevealed commitment depends on it.
The key ID identifies the operator's key copy; this initial loader does not
provide a multi-key rotation service. Losing/replacing it does not authorize a
new draw. Store it separately from session-delivery and judge TLS keys.

## Independent Clock Consumer

The API remains the only primary clock monitor/probe owner. The worker reads the
current protected report, checks the same Linux boot and suspend-inclusive uptime,
validates its bounds/source/report sequence, then independently requires seven
fresh observations at least five seconds apart spanning thirty seconds. A stored
`HEALTHY` row or repeated report does not establish/renew worker freshness.
Cold startup therefore includes the API's initial health period **and** the
worker's own health period. This is deliberate, not a startup timeout to bypass.

Each judging transaction rechecks current runtime/generation/health under the
existing security/clock locks. Faults immediately close the local gate; a narrow
source-bound, idempotent database operation persists the fault independently of
a rolled-back gameplay transaction. A lost fault acknowledgement uses its original
UUID and observed incident generation. A stale runtime/generation cannot fault a
replacement runtime or reset a later recovery streak. The worker can latch a
fault, never clear one, resume a round or renew a participant's login. Restored
observations still require the existing authorised staff clearance.

## Startup, Stop and Restart

After reviewed migrations, provisioning and installation on the **primary Linux
host**, the standalone entry point is:

```sh
JUDGING_RUNTIME_FILE=/etc/ingenium/judging-runtime.json node apps/api/dist/worker/server.js
```

`npm run start:judging` starts the same built entry point with the environment
already supplied by the protected service launcher. No real runtime file is
created here, and this command intentionally refuses ordinary Windows startup.
The production Compose/systemd installer, pinned release/image, credentials and
log/connection/resource supervision still require deployment review. Use one
separately supervised process, restart-on-failure with bounded backoff, and enough
stop time for bounded in-flight TLS/database calls; do not force a slot release
because the client process exited.

SIGINT/SIGTERM stops future turns, waits for active reconciliation, stops clock
polling, flushes any pending incident and closes the pool. If shutdown arrives
during validation, participant dispatch cannot start afterwards. It does not
delete jobs, release physical reservations or rewind the shared lease. A fresh
process initially waits for its own clock trust and any previous live lease.
Unknown submissions are recovered by original attempt identity/GET, never a new
POST. An interrupted compiler/program stays held until positive judge-side drain.

## Verification

The focused checks use disposable PostgreSQL, synthetic identities/observations,
real restricted roles, actual mutual TLS, and a networkless owned Linux fixture.
They do not execute participant programs or certify kernel isolation.

```powershell
$env:INGENIUM_TEST_SUITE='worker'
npm run test:db:schema
$env:INGENIUM_TEST_SUITE='worker-clock'
npm run test:db:schema
$env:INGENIUM_TEST_SUITE='worker-validation'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
npm run build
npm run test:worker:runtime
```

Required before launch: real judge-host readiness/installation/full physical
retirement, primary-host service/clock/certificate/credential rehearsal, realistic
load/reconnect tests, resource/retention work, backups and the actual deployment.
This scheduler cannot make an unverified judge ready by itself.
