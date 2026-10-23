# Restored Database Quarantine

This is the offline access-invalidation step, not a completed disaster-recovery
or event-reopening procedure. Never point production at a restored copy first
and run this command afterwards. Keep its network isolated and all app/worker
services stopped throughout. No cloud resources or real databases were changed
while implementing/testing this step.

## What It Does

Migration `0071_restore_quarantine.sql` adds an immutable singleton receipt and
an owner-only database operation. One atomic commit:

- Revokes every still-unrevoked participant/staff session, including recovery
  sessions. Already-revoked history is left intact.
- Revokes open/activated team/staff entry flows. Supersedes unconsumed/consumed
  replacement handoffs and clears their encrypted delivery material.
- Removes participant/staff session-delivery ciphertext and releases browser
  session/reservation pointers with the next slot revision.
- Quarantines every ACTIVE judge epoch, without marking it RETIRED.
- Records the original request key, bounded operator/OS-account/backup-reference/
  reason, observed time and affected counts; advances the security revision once.

The observed timestamp is explicitly **not verified competition time**. It cannot
backdate a pause, reduce a watermark, compensate a team or declare a host dead.
Session revocation timestamps cannot precede their recorded creation/activity.

Registrations, access-code ownership/verifiers, locked languages, drafts,
submissions, hints, wallets, penalties, results, original intent outcomes and
physical judging obligations remain unchanged. Revoked flow/session verifiers
may still exist until their normal retention deadline; they cannot authenticate
through their revoked state or the independent restore gate. This is access
invalidation, not secure erasure from backups/WAL.

All protected application transactions refuse the persistent gate, including
quotas, live snapshots, staff timing-recovery paths, admission and app-side worker
actions. Primary clock startup, retired maintenance startup and worker clock
polling also refuse it. A database trigger prevents restarting the stored clock;
the common arena/judge SQL coordination path rejects direct calls too. Normal
`/ready` reports 503, while `/health` may still report process liveness.

The application/competition-worker roles cannot read the operator receipt or
execute quarantine. They can ask only whether the gate is set. There is **no
HTTP endpoint, in-app toggle or command to clear this gate** in this batch.

## Operator Use

Use a reviewed Linux installation with the compiled API bundle. The CLI refuses
root, Windows, symlinked/unprotected runtime files, remote connection URLs and
runtime-role credentials. Actual table ownership and database function privileges
are checked, not inferred from the username. Do not reuse a production runtime
file or disclose its password.

A separate protected runtime file has exactly this shape, with real maintenance
credentials installed privately by the operator, not pasted into Git:

```json
{
  "schema_version": 1,
  "database_url": "postgresql://SCHEMA_OWNER:PRIVATE_PASSWORD@127.0.0.1/ISOLATED_RESTORED_DATABASE"
}
```

The file must be a single-link regular file, readable only by its non-root reader
or root, with protected ancestor directories. A 0600 operator-owned file in a
0700 operator directory is suitable. The database must already contain the
reviewed migration. This command never migrates, restores, starts or stops a
service itself, and it does not read `.env`.

After positively fencing old ingress/senders and preparing the isolated copy,
retain one UUIDv4 request key in the private incident record. Run from the repo:

```sh
npm run maintenance:restore-quarantine --workspace @ingenium/api -- \
  --runtime /etc/ingenium/restore-runtime.json \
  --request-key ORIGINAL_RETAINED_UUID \
  --backup-ref VERIFIED_BACKUP_AND_TARGET_REFERENCE \
  --operator OPERATOR_REFERENCE \
  --reason INCIDENT_REFERENCE \
  --confirm ISOLATED_RESTORE_QUARANTINE
```

The command refuses a database with a running primary clock. It serializes against
protected work through the security/clock anchors, but that refusal is **not proof
that other hosts, old queues, process trees or external network access are stopped**.
Those are separate operator gates. Stop/fence them rather than editing the clock
row to satisfy this precondition.

On a lost connection/reply, keep everything isolated and inspect the original key:

```sh
npm run maintenance:restore-quarantine --workspace @ingenium/api -- \
  --runtime /etc/ingenium/restore-runtime.json \
  --status --request-key ORIGINAL_RETAINED_UUID
```

`RECORDED` returns bounded counts and the receipt identity. `NOT_OBSERVED` means
only that this selected database did not return that receipt, not that a prior
request could not have committed elsewhere or in later missing WAL. Verify the
database/recovery target and incident evidence before deliberately continuing the
**same** intent. Concurrent/duplicate identical calls return the same receipt;
a changed payload or replacement key is refused. Never reset the receipt or
execution permits. Metadata passed on the command line must contain incident
references, not credentials, participant source or personal data.

Use `--inspect` instead of `--status` for the consistent source-free recovery
inventory described in [operations observation](operations-observation.md).
It derives access invalidation from rows and lists unresolved obligations, but
cannot supply an external fencing/integrity/rotation proof or authorise reopening.

## Still Required Before Reopening

The command always returns `admission_authorised=false`. It neither claims nor
proves any of the following:

- Physical old-host/process/queue fencing, retirement proof or release of a held
  execution slot. Old attempt IDs, permits and judge control stay unchanged.
- A complete sporting recovery point containing every accepted/committed decision.
  Possible lost progress forbids resuming an older active round.
- Rotation and verified installation of deployment/session-delivery/CSRF/epoch
  secret generations, protected re-entry and reconciliation of original intents.
- Verified current time, eligible payload-retention catch-up, authorised read-only
  results access or deliberate cancellation/fresh-instance recovery.

The controlled review/reopening workflow is still pending; do not bypass the
one-way quarantine by deleting its row, disabling triggers or restoring an older
database again. See [backup and recovery requirements](backup-restore.md).

## Local Evidence

Only disposable synthetic databases and the existing isolated backup drill are
used. The focused suite checks restricted-role/running-clock refusal, full
transaction rollback after an injected receipt failure, simultaneous duplicate
calls, lost-reply reconciliation, immutable receipts, revoked access,
pending/approved handoffs, HTTP refusal, clock restarts and held judging work.
It fingerprints sporting/source/intent/physical-work tables before and after.

```powershell
$env:INGENIUM_TEST_SUITE='restore'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

The encrypted physical-backup suite also invokes the **same database function**
on its network-disabled restored copy after exact table/guard comparison. It
checks old access/epochs are invalidated while the original source stays open.
The report labels physical fencing and admission as false. Neither this nor a
passing synthetic adapter is a production/Linux installation or venue rehearsal.

Verified locally: 285 unit/client tests, ten restore checks, seven physical-backup
checks, eleven clock/recovery checks, ten maintenance checks and twenty live-state
checks. Production builds/typechecks and new-code formatting pass. The full
global/browser/load matrix and the native Linux operator CLI were not rehearsed.
