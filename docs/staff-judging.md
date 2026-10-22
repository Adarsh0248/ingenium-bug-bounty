# Staff Judging and Recovery

Owners/Super Admins can now also open the separate
[restricted submission review](submission-review.md) from a selected parent.
Its reason-required source/diagnostic payload is audited and is never included
in the safe monitoring/timeline responses described below.

The control room's **Judging** tab connects the normal staff session to the
existing protected competition worker/recovery model. It does not run code in
the browser or add another judge driver.

## Monitoring

- Active view includes unfinished work and completed/cancelled parents whose
  physical execution reservations are still held. All, recovery/attention,
  completed and cancelled views are available, filtered by team and lane.
- Summary counts cover the selected team/lane, not only the visible page.
  Queue pages contain at most 40 parents with stable server queue-order cursors.
  The cursor must belong to the selected round; a changed status does not erase
  its pagination anchor.
- Inspecting a parent shows its original receipt/time, locked language, job
  status and dispatch count. A selected job shows at most four dispatch records:
  preparation/send state, outcome category, resolution and physical release time.
- Infrastructure failures are labelled separately from trustworthy code errors.
  Logical completion is not physical release. A held execution cannot be cleared
  by a timer, a session change, a staff button or a positive code verdict alone.
- Live projection changes trigger fresh reads; non-overlapping five-second
  polling updates the open queue/detail and recovery-decision page. Read failure
  visibly disables approval. Background reads do not renew staff activity.

These purpose-specific views contain no participant source, private drafts,
hidden case IDs/I/O, expected answers, compiler output, provider credentials,
runtime/payload digests, worker IDs or raw execution evidence. Organisers may
monitor but cannot view private recovery reasons or authorise extra execution.

## One Controlled Extra Dispatch

The existing transactional `participant_retry` command remains the authority.
The new eligibility field is advisory UI metadata, never an execution permit.

Owner/Super Admin approval is available only for an unresolved official job in
RUNNING, PAUSED or CLOSING, after exactly three safely drained infrastructure
failures, without an existing extra-dispatch authorisation. Settled/code-failure
jobs, samples, cancelled/closed rounds and uncertain physical work are refused.
An authorised fourth attempt is still scheduled and checked by the original
worker; the approval POST itself does not prepare or execute it.

The confirmation names the exact job UUID, requires that ID to be entered again,
and requires a bounded audit reason and the operator's own current code. Closing
or navigating away is blocked while a command outcome is uncertain. Confirmation
codes are cleared after sending. Wrong confirmation retains the reason, not the
code, and does not sign out the operator.

One command gets one request key and POST. Lost replies are recovered only by
the existing actor-scoped outcome GET. Unknown/not-yet-observed outcomes never
trigger another POST, release capacity or create a new submission. Existing
source, receipt order/time, language, hint tier, completed jobs and sporting
effects remain unchanged. No force-verdict, force-award, counter reset, selective
voiding or discretionary rejudge is introduced.

## Recovery Decisions

Owner/Super Admin can page through applied and rejected decisions for a selected
job, including operator name, reason and original recorded time. Legacy rejected
receipts bind their target through the existing canonical structured fingerprint;
the read compares that binding instead of guessing a target from free-form text.
The audit cursor must belong to that same round/job. Pages are capped at 40.
Query plans at retained-data scale remain part of the production load gate.

## HTTP Boundary

All routes require a current normal staff session, normal read/command quotas
and healthy authoritative time. Recovery-only grants and participant cookies
are not staff authority. Each read rechecks role/session/credential/revocation
under the existing security gate and round lock. Responses are no-store,
explicitly serialized and bounded to 1 MiB.

| Route under `/api/v1/staff/competition/rounds/:round_id` | Purpose |
| --- | --- |
| `GET /judging?view=ACTIVE&team_id=UUID&lane=OFFICIAL&after=UUID` | Safe filtered monitoring |
| `GET /judging/:parent_id` | Bound job/dispatch metadata and current recovery eligibility |
| `GET /jobs/:job_id/recovery-history?after=UUID` | Owner/Super Admin scoped decision history |
| `POST /jobs/:job_id/retry` | Existing CSRF/own-code-confirmed extra-dispatch command |
| `GET /outcomes/:request_key` | Existing actor-scoped lost-reply recovery |

No schema, migration, permission grant, production limit or worker recovery policy
was changed. Normal readiness is not overridden by this UI.

## Verification and Limits

The `judging` and `judging-browser` focused disposable PostgreSQL suites exercise
safe DTOs, filters/cursors, no read activity, physical uncertainty, reliable code
failures, exhausted automatic recovery, wrong code/CSRF refusal, role restrictions,
lost replies, original-receipt preservation and 42 paged immutable decisions.
The browser suite uses actual React/Fastify/cookie/Socket.IO/database interaction
with an explicitly synthetic execution driver, not real participant execution.
The complete `test:browser:db` command includes this new suite.

Screenshots are generated under `apps/api/test-results/`. The normal loopback
participant preview remains a visual fixture, not an interactive staff backend.
Verified in this batch: 255 unit/client tests, ten focused judging/database/browser
checks, eleven participant-judging regression checks, the four-check complete
normal browser workflow, typechecks, production builds, formatting and the bundle
boundary check. Desktop/mobile screenshots were inspected. Disposable test
containers were removed. The full global database regression and other specialised
browser suites were not rerun.
Real installed-worker compatibility/drain, large-dataset query plans, resource
retention, realistic event load, HTTPS deployment and recovery rehearsal remain
required before hosting the event.
