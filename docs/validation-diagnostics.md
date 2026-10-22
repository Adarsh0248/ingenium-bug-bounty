# Private Validation Diagnostics

Owners and Super Admins can inspect one resolved authoring dispatch from a saved
validation run. In Bug Library, open the version, choose Validation and a run,
then Review validation output. Choose the completed dispatch, confirm the exact
run ID and record the investigation reason. This is a private read, not a rerun,
retry permission, publication approval or sandbox release.

## Data and Authority

The selected view contains the retained stdout prefix (16 KiB), stderr (64 KiB),
compiler output (64 KiB), result, CPU nanoseconds, peak memory, observed stdout
length and truncation/incomplete-capture flags. Exact bytes travel as Base64 and
render as text, never executable HTML. Output may itself contain hidden-test
values or reference-program text, so it must stay private. No automatic output
polling, export or browser-storage copy is provided.

Hidden input/expected-output records, reference/starter source fields, provider
tokens, host identities and raw supervisor evidence are not returned. The normal
report stays output-free; its bounded dispatch summaries identify attempt number,
result, resolution and physical-pending state. At most three dispatches per check
and 115 checks per run are possible.

Every read requires a healthy clock and a current normal Owner/Super Admin
session, credential and browser slot. Organisers, participants, clock-recovery
grants and replaced/revoked/expired or downgraded staff are excluded. Reads do not
renew staff idle or absolute expiry.

## Audit and Recovery

Migration `0065_validation_diagnostics.sql` adds immutable audit rows bound to
run, dispatch, result digest, actor, session, credential, reason and request key.
Database triggers independently reject incorrect authority, foreign/unresolved
dispatches and digest mismatches. The audit commits before payload delivery.
Shared staff audit capacity includes these rows.

One original key has one review. Changed purpose or dispatch cannot reuse it.
Lost POST replies recover through a GET for the original key; there is no POST
replay. Recovery requires the original still-current staff session. A replacement
sign-in needs a deliberate new audited review. An unobserved key creates nothing.

Metadata-only access history is ordered by recorded time and UUID, with 40 rows
per page and a run-bound cursor. It includes staff display name, time, dispatch
and reason, not private bytes or credentials. History refreshes every five
seconds. Access/history failures clear private output; a late response after
that change cannot redisplay it. Unknown replies block navigation and other
writes until resolved. Closing or switching the view discards its private bytes.

Routes use the `/api/v1` prefix, protected staff cookies and no-store responses.
POST also requires exact Origin and staff CSRF; bodies and responses are bounded.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/staff/content/validation-runs/:run_id/diagnostics` | Review with `request_key`, `confirm_run_id`, `attempt_id`, `reason` |
| GET | `/staff/content/validation-runs/:run_id/diagnostics/:request_key` | Original-session receipt recovery |
| GET | `/staff/content/validation-runs/:run_id/diagnostics?after=UUID` | Paged private-access metadata |

The service does not expire/advance validations, alter checks/results, renew a
worker lease, release capacity, admit jobs or write sporting state. Logical
completion with a physical hold remains a hold.

## Verification Boundary

Tests use disposable PostgreSQL, real HTTP and the real React browser with
explicitly synthetic worker observations. They cover byte bounds, audit/recovery,
roles/sessions, strict HTTP requests, immutable history, stable paging, read-only
judging state, hostile output text, lost replies, stale access and desktop/mobile
layout. These are not real compiler or installed-host tests. Development/cloud
migrations, real content, production deployment, backup/restore and event-load
testing remain separate gates.
