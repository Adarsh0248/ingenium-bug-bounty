# Encrypted Backup and Isolated Restore Drill

This batch adds a PostgreSQL/pgBackRest image candidate, the approved GCS backup
configuration template and a real encrypted physical restore test. It does not
provision a bucket, install a production secret, schedule backups, restore a real
database or authorise traffic to a restored app. The app's post-restore
credential invalidation, epoch fencing and admission procedure remain unfinished.

## The Basics

A full backup copies a consistent database cluster. A differential copies changes
since its full backup; an incremental depends on earlier backups in that chain.
WAL is PostgreSQL's record of subsequent changes. Keeping both the backup chain
and required WAL lets PostgreSQL recover changes made after a backup completed.
WAL can contain private code and credentials too; it belongs in the encrypted,
restricted repository, not a public log or Git.

Encryption protects the repository copy, not the running database. The backup
passphrase must have an independent, protected operator copy outside both the
database and VM. Losing that key prevents recovery. A local backup volume is a
test fixture, not protection against losing the laptop or app VM.

## Added Configuration

`infra/backup/Dockerfile` extends the existing digest-pinned PostgreSQL 17.11
Bookworm image with exactly `pgbackrest=2.59.3-1.pgdg12+1`. The build checks both
versions; missing packages fail instead of selecting a floating replacement.
The harness resolves the built image to an immutable ID before allocating data.
Only the Dockerfile and public PostgreSQL configuration enter the build context.

The version is an available tested PGDG package, not a claim to be the newest
upstream release. Its upstream [2.59.3 release notes](https://pgbackrest.org/release.html)
include fixes for weak encryption subkeys/salts. Before production, review the
complete image/dependency/security inventory and publish an approved image digest.
Transitive APT packages are not individually snapshot-pinned by this candidate.

`postgresql.conf` includes the normal cluster configuration, then enables replica
WAL, synchronous archive pushing and a sixty-second segment-switch setting. It
keeps PostgreSQL on loopback and sets the approved forty-connection ceiling.
The data path is fixed at `/var/lib/postgresql/data`; this is not a config for a
different cluster layout. It must be explicitly selected by the reviewed service
launcher. Nothing modifies the existing development Compose file.

`pgbackrest.conf.example` is intentionally unusable. An operator-owned, private
copy outside Git must replace the bucket, deployment prefix, independent random
cipher key and protected GCS credential-file reference. The template uses:

- A private GCS repository and verified storage TLS.
- Client-side `aes-256-cbc` encryption, separate from browser/draw/judge keys.
- A fourteen-day, dependency-aware full-backup retention policy. Archive
  retention stays at pgBackRest's chain-aware default; no independent age rule
  removes WAL or incremental objects.
- No automatic expiration after a backup. An operator first verifies the chain,
  restore evidence, actual storage budget and any retained references; only then
  uses the explicit pgBackRest expiration procedure.
- No asynchronous archive queue that can silently discard required WAL on a
  queue-size policy. If archiving fails, preserve WAL and alert before disk fills.
- Two backup processes, archive checking/copying, and no ordinary file/console
  payload logs. Errors still require a protected, monitored operational channel.

The database/backup service, not the API or app worker, reads the backup key and
GCS credential. Protect the real directory and files with restrictive ownership
and permissions; do not install real files under `infra/backup` or bake keys into
an image. Review the local database role/socket authentication independently.
The checked-in role name is not a password or a new permission grant.

These settings follow the official [configuration reference](https://pgbackrest.org/configuration.html)
and [backup, encryption, WAL and restore guide](https://pgbackrest.org/user-guide.html).

## Production Installation Gates

Before installing this candidate, the operator must verify the approved project,
costs and storage allowance, the private bucket's identity/location, public-access
prevention, scoped credential permissions, credential/key recovery copies, VM
service ownership and outbound network policy. A judge service must not receive
the competition backup identity. This work has not created or changed GCP IAM.

Review [GCS soft delete](https://docs.cloud.google.com/storage/docs/soft-delete),
[Object Versioning](https://docs.cloud.google.com/storage/docs/object-versioning)
and object retention/holds before promising deletion dates or repository size.
Deleted or superseded objects can remain retained and billable. Do not add a
generic object-age deletion rule that can break a live pgBackRest chain, and do
not disable protection or apply a bucket lifecycle without separate approval.

Use the approved 256-GiB combined backup/archive allowance, warnings at 75% and
90%, and a normal WAL-recovery-point target of at most sixty seconds. Alert on
archive lag above ninety seconds during writes, backup/chain failures and stale
monitoring. These monitors and hard resource/admission integration are not yet
installed. `archive_timeout=60s` alone does not prove a recovery point: archive
transfer, repository availability and successful WAL verification matter too.

The deployment runbook must schedule a verified full before event day, daily
differentials, a fresh incremental/check before each round and after safe event
completion. Periodic new full backups are also necessary while retained online;
a weekly full is the initial operational schedule candidate. With no later full,
dependency-aware expiration cannot discard the sole original base safely.
No scheduler or paid resource was created by this batch.

Fourteen days is the target recovery window, not a guarantee that every object
is erased exactly fourteen days after creation. A boundary full/WAL dependency
can be older; report the actual earliest/latest verified recoverable positions.
Physical backups, WAL, old snapshots and even dead database pages may contain
bytes no longer exposed by logical payload retention. Do not call a row purge
secure physical erasure. The real storage/privacy lifecycle remains a launch
review, separate from the longer-lived metadata archive policy.

## Isolated Local Drill

Build the candidate deliberately, then select its immutable image ID:

```powershell
docker build --pull=false --platform=linux/amd64 --tag ingenium/postgres-backup-test:17.11-2.59.3 --file infra/backup/Dockerfile infra/backup
$env:INGENIUM_TEST_BACKUP_IMAGE = docker image inspect ingenium/postgres-backup-test:17.11-2.59.3 --format '{{.Id}}'
$env:INGENIUM_TEST_SUITE='backup'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
Remove-Item Env:INGENIUM_TEST_BACKUP_IMAGE
```

The harness never reads `.env`, imports a real registration, downloads an image
implicitly or runs a participant compiler. Its existing synthetic competition
fixture creates real reviewed migrations, frozen bugs/languages, a submission,
award, hint purchase and final Round 1 result in disposable PostgreSQL.
The source is freshly initialized with PostgreSQL data-page checksums enabled;
the test verifies that setting. Production must enable/check page checksums in
its separate cluster installation review, never reinitialize an existing database
just to apply this example.

The test then:

1. Creates a full, differential and incremental backup in a separately labelled,
   encrypted local repository volume, with fresh generated test-only keys.
2. Checks actual pgBackRest JSON status, cipher, chain references and an encrypted
   repository header. A successful `info` process exit is not enough: unavailable
   encrypted repositories can be represented by an error inside otherwise valid
   JSON. Malformed error JSON is also unusable and must not be repaired into
   a guessed successful/empty inventory. Never interpret that exit code as readiness.
3. Commits a WAL-only marker after the incremental, archives it and records an
   exact LSN target. A later synthetic marker tests that point-in-time recovery
   stops at the requested boundary, not the latest convenient state.
4. Refuses a wrong decryption key and a damaged copy of the encrypted manifest,
   without modifying the original repository. The normal key must still work.
5. Restores into an empty, network-disabled container with no published ports,
   restart policy or app/worker process. Its repository mount is read-only and
   PostgreSQL archiving stays off, so the copy cannot push a new timeline into
   the original chain.
6. Replays the exact target and compares SHA256/row-count fingerprints for every
   application and migration table, plus the synthetic marker. It also compares
   function/trigger/constraint definitions and function grants, and checks the
   restricted API role cannot create tables after restoration.
7. Applies the owner-only [restore quarantine](restore-quarantine.md) to that
   isolated copy, revoking old access, purging delivery capsules and quarantining
   active epochs without changing the source or replaying old execution work.

Only the original test source has a loopback-published PostgreSQL port, needed
by the existing migration/test runner. The restored database has only its local
Unix socket. All Docker cleanup verifies the exact original test identities and
labels; the test does not enumerate/delete production volumes. Fixture keys stay
outside PGDATA and outside the encrypted repository, as required for real backups.

A successful run writes a small source-free report to
`apps/api/test-results/backup-drill.json`. Require `state=PASSED`, its run ID and
the corresponding complete successful test output; an old report is not evidence
that a later failed run passed. `admission_authorised` and `off_host_verified`
remain **false**. Local restore timing measures only this small synthetic dataset,
not the production thirty-minute recovery-time target.

Verified locally: seven focused backup/database checks, the earlier eight-check normal
stock-image/team-access regression, all 285 current unit/client tests, production
builds/typechecks and new-code formatting. The successful fixture
preserved all 110 application tables, migration history and the probe table; its
data restoration/verification took about seven seconds. This is not an actual
GCS restore, venue benchmark or full production-recovery rehearsal. One initial
failed setup left `ingenium-backup-test-DmWuzE` under the Windows temporary
directory after filesystem cleanup was blocked; it contains only generated
test configuration/keys, and its Docker container/repository volume were removed.

## Real Restore Must Stay Quarantined

An isolated physical restore is not safe event resumption. Before any actual
restored traffic, the operator must fence old API/worker access and judge epochs,
prove the selected recovery position includes every admitted/committed sporting
decision, establish trusted current time, invalidate all restored sessions/flows/
delivery capsules, rotate the required deployment/session/CSRF/epoch generation,
reconcile retained intents and physical work, and reapply expiry/payload retention.
Preserve registrations, original locked languages, code ownership and results.

The offline invalidation step is now implemented and exercised on the isolated
copy, with a durable gate against app/worker/clock startup. It does not authorise
admission: physical fencing, secret-generation rotation, retention catch-up,
integrity review and controlled reopening remain unverified/incomplete. Revoked
access verifiers may remain under normal retention, but cannot revive old access.
The drill does not restore or replay any judge PG/Redis execution queue.

If any committed competition progress may be missing, do not resume an older
active round or reinsert guessed receipts. Preserve evidence and use the approved
trusted-authentication, physical-fencing and deliberate cancellation/fresh-instance
incident process. Read-only final results require their own integrity/access
review. This guide provides no force-restore, live database overwrite, automatic
promotion into production or sporting rollback command.
