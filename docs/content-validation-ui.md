# Validation Runs and Publication Review

The Owner/Super Admin Bug Library now connects the full draft -> prepared snapshot
-> requested validation -> reviewed publication flow. Technical success and
human review are separate. Publication makes immutable content available for a
future arena selection; it does not start an arena or disclose hidden content.

## Normal Staff Flow

- Open a version's Validation section. Prepared snapshots are paginated, with
  exact revisions, fingerprints and creation times. Older snapshots remain
  inspectable but cannot validate or publish the changed draft.
- Select a snapshot to see its paginated run history. An admitted request uses
  the existing durable run queue, original request key and fixed ten-minute
  deadline. No browser control can install a runtime, assert runner readiness,
  write a check result or mark a run passed.
- The selected report shows each language/reference/starter check's expected and
  observed result, attempts and cleanup state. Visible pending reports refresh
  every five seconds without overlapping requests; fully settled/drained reports
  stop polling. Manual refresh remains available. Progress reads do not renew
  staff idle expiry. List status follows the displayed report.
- Review publication is available only for the current draft revision, exact
  snapshot/fingerprint, selected passed run and no outstanding physical work.
  The backend independently checks the same facts under its ordered locks.
- The reviewer explicitly acknowledges the statement, sample/hidden coverage,
  cross-language difficulty/fairness and all three hints, records bounded notes
  and confirms their own current staff code. Publication locks the version;
  corrections require a separate new draft, not editing a published snapshot.
- Reopening history shows the actual published run and timestamp. Arena bug
  selection refreshes on content invalidation and tab entry, without a page
  reload. It still pins the selected immutable snapshot and checks round category.

## Recovery and Permissions

One run request or publication command has one UUID request key. Unknown replies
block new commands and parent navigation; Recover validation receipt performs
only a GET for that original key. It never resends a write or a staff code.
Wrong own-code confirmation leaves the staff session valid and the review form
available. Code input is cleared after each send and is never persisted in a
receipt, URL or browser storage.

Publication now has actor-owned immutable applied/rejected receipts. A refusal
such as CLEANUP_PENDING stays refused after cleanup later succeeds; a deliberate
new command is required. A changed run/revision/review cannot reuse an old key.
Success, publication metadata, version locking and qualifying staff activity
commit together. Duplicate success preserves the original publisher/time and
does not renew activity. GET recovery requires current normal manager authority,
not a fresh own-code submission. Other actors cannot recover its receipt.

Organisers, participants and restricted recovery grants cannot read the private
history/report APIs or publish content. Safe history pages are capped at fifty
items and use audited reads. Reports contain identifiers/categories/accounting
state, not reference code, hidden I/O or raw judge diagnostics. A separate
[private diagnostic review](validation-diagnostics.md) now opens one resolved
dispatch with exact-run confirmation, a recorded reason, immutable access history
and original-session receipt recovery. General staff-operation audit navigation
remains separate work.

Local forms and unknown receipt identities are tab-local, with unload warnings;
forcing a reload can discard them. History restores committed runs/publication,
not an uncommitted form or an unknown tab-local key. No private payload is written
to local/session storage as a workaround.

## API and Migration Changes

All paths below have `/api/v1` prefix and the existing protected staff
cookie, exact-origin/CSRF, role, healthy-clock, quota and body limits.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/staff/content/versions/:version_id/validation-snapshots?after=UUID` | Bounded audited snapshot history |
| GET | `/staff/content/validation-snapshots/:snapshot_id/runs?after=UUID` | Bounded audited run history and actual publication binding |
| POST | `/staff/content/validation-snapshots/:snapshot_id/runs` | Existing admission command with reason/revision/key |
| GET | `/staff/content/validation-runs/:run_id` | Existing private check report |
| POST | `/staff/competition/publications/:snapshot_id` | Review command with `run_id`, `expected_revision`, `request_key`, `review`, `own_code` |
| GET | `/staff/outcomes/publication/:snapshot_id/:request_key` | Current actor's immutable publication outcome |

Migrations `0048_sharp_ezekiel.sql` and `0049_reviewed_publication.sql` add the
receipt table and narrow confirmed publication function. The old four-argument
`competition_publish` function is removed, so a stale application image must not
be deployed against this schema. Current callers/fixtures use the new reviewed
command. Application credentials can read receipts but cannot insert/update/delete
them or directly write publications. No previous publication is rewritten.
The shared staff audit capacity includes these new records and bounded history
audits. These files were tested only in disposable databases, not applied to the
development database or cloud. Review migrations and compatible deployment/backup
steps before applying them.

## Verification and Remaining Gates

The real React/Fastify/Socket.IO/PostgreSQL browser flow requests a run through
HTTP, deliberately loses its response, recovers one admission and processes its
fifteen checks through the existing synthetic validation worker. It verifies
passed-but-cleanup-pending refusal, later drain, an immutable original rejection,
stale/foreign-run refusal, wrong-code handling and one recovered publication after
a lost response. Reload restores history; published content is read-only and
selectable for a subsequent draft arena. The tests also check receipt immutability,
direct-write denial, removed legacy bypass and Organiser exclusion.

These are synthetic runner observations, not real C/C++/Java/Python/JavaScript
execution or production-host certification. Normal startup still installs no
driver/host; absent genuine readiness, admission refuses before creating a run.
The existing participant preview remains participant-only. Real judge installation,
worker/maintenance/runtime wiring, full resource/retention guards, exceptional
recovery/discipline, HTTPS hosting, backup restore and realistic event-load tests
remain required. Visual polish stays deferred, not removed from approved scope.
