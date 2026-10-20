# Validation Preparation

This is the private preparation stage, not a completed validation run. It copies
an exact draft revision into an immutable snapshot and builds the checks that a
future execution run must perform. It never compiles code, calls the cloud judge,
creates queued execution work or marks a question passed/published.

The subsequent [durable run queue](validation-runs.md) now provides conditional
run admission and a tested worker lifecycle. It still has no production driver or
live supervisor binding; this preparation endpoint's non-executable semantics
have not changed.

## Flow

1. A current normal Owner or Super Admin supplies the version UUID, expected
   content revision, fresh request UUID and a reason. Organisers, participants
   and restricted clock-recovery sessions cannot prepare or inspect snapshots.
2. The server locks Security, ArenaControl, current-instance rounds in UUID order,
   then catalogue control. It first recovers a known matching command receipt.
   A changed intent cannot reuse its key. New stale, non-draft or active-arena
   requests receive durable rejections, without capturing private bytes.
3. It captures the draft's exact source/test bytes, hints, declarations and runtime
   digests in a short transaction, with a typed private-read audit. Full UTF-8 and
   completeness checks happen after releasing the control locks.
4. A second coordinated transaction checks current staff authority, revision and
   arena state again. A concurrent edit produces `STALE_VERSION`, not a new
   capture that silently approves the edited draft. Concurrent/restarted matching
   requests recover one receipt. Another key for the same revision shares the
   existing snapshot without another data copy or activity renewal.
5. A narrow database function copies the still-current draft rows and creates
   the full plan atomically with its receipt and catalogue byte reservation.
   Deferred guards verify the frozen manifest, complete plan and exact budget.

`RUNNING`, `PAUSED`, `CLOSING` and `CANCELLING` rounds prevent new preparation.
These commands do not pause, start, extend or otherwise control a competition.

## Required Content

- All five languages: C, C++, Java, Python and JavaScript. Each needs nonblank
  starter/reference source, a defect description, a registered same-language
  immutable runtime manifest and complete limits within the approved ceilings.
- One to three sample cases and at least one hidden case, at most twenty active
  cases total. Existing per-field and 16 MiB decoded suite bounds apply. Empty
  I/O, BOM, NUL and line-ending bytes are preserved; invalid UTF-8 is refused.
- Exactly three nonblank hints. Later hint edits change the configuration identity.
- One to three typed starter witnesses per language. A test witness must point
  to an active case of this version. Compilation witnesses are only for C/C++/Java.
  Declarations are not evidence that the starter actually has that defect.

Every reference is planned against every active case. Every declared starter
witness is planned, even if another witness could already establish the defect.
The largest plan has 115 checks. These immutable templates have no execution
status, permit or job delivery. Preparing them does not start the later ten-minute
validation deadline or reserve the not-yet-implemented execution capacity.

The pure aggregation policy is unit-tested: wait for all checks, require every
reference to pass and at least one matching declared witness per language, and
keep final infrastructure uncertainty distinct from code failure. It has no HTTP
result-writing endpoint and cannot be used to manually mark a question passed.

## Frozen Identity And Privacy

The database produces a bounded canonical manifest of metadata, stable IDs,
source/test/hint SHA-256 digests and lengths, immutable runtime digests, limits,
checker version and witness declarations. The exact manifest text is retained
and fingerprinted; no later JSON reserialization is used to identify the snapshot.
All private source/test/hint bytes are copied separately and never returned by
ordinary snapshot summaries or receipt errors. Private summary/check-plan reads
are authenticated and audited. Errors identify fields/languages/case IDs only.

Saved snapshots, children, check templates, preparation receipts and audits cannot
be rewritten/deleted by application commands. Retiring or editing an original
draft case does not remove its frozen bytes. The restricted API role has no
direct frozen-row write or catalogue-counter update privilege. Sources and their
effects must commit together.

The 3 GiB catalogue guard now counts both mutable version storage (including
retired cases) and immutable snapshots. Snapshot accounting includes exact payload
and manifest bytes plus a conservative 64 KiB base reserve for rows/check plans.
Capacity failure rolls back the attempted source and effect. This does not yet
implement the separate whole-app storage reservation/cleanup subsystem.

## Staff HTTP

All paths below have the `/api/v1` prefix. Existing HTTPS cookies, exact-origin
policy, audience-bound CSRF, healthy-clock checks, bounded pending requests,
shared staff quotas and redacted responses apply. Preparation uses the existing
two-operation large-content gate because its server-side capture can be large;
the request body itself is capped at 16 KiB.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/staff/content/versions/:version_id/prepare-validation` | Body: `request_key`, `expected_revision`, `reason`; immutable preparation receipt |
| GET | `/staff/outcomes/validation-preparation/:version_id/:request_key` | Current actor's receipt or `NOT_OBSERVED` |
| GET | `/staff/content/validation-snapshots/:snapshot_id/summary` | Fingerprint, exact revision, creation time and check count |
| GET | `/staff/content/validation-snapshots/:snapshot_id/checks` | Same summary plus private plan identifiers/categories; no raw I/O/source |

Receipts report `APPLIED`, `UNCHANGED` or `REJECTED`. Rejections return HTTP 409;
pre-admission capacity refusal returns 503 without pretending to have committed
an outcome. Both receipts and summaries explicitly return `can_execute: false`
and `can_publish: false`. Summaries return `validation_run_id: null`.

Migrations `0024`/`0025` are generated/reviewed source files only. This batch does
not migrate an existing development database or install a production runtime.

## Still Required

The [run queue](validation-runs.md) adds conditional admission, internal capacity,
retry/deadline and evidence/recovery bookkeeping, tested with a synthetic driver.
The production judge adapter/supervisor, real runtime compatibility, worker runtime,
review/publication, selection/start validation, authoring screens and real-host,
browser/load/deployment verification remain required. Synthetic test runtime rows
are not real toolchain certification. The approved architecture and full launch
scope have not been changed.
