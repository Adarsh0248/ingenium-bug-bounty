# Restricted Submission Review

The Judging panel now connects an audited, read-only review of an admitted
participant program and optionally one resolved dispatch's retained feedback.
This does not enable rejudging, selective voiding, score/wallet edits, raw database
access, provider control, or access to a team's private working drafts.

## Access and Scope

- Only a current normal Owner or Super Admin session may open a review, recover
  its original response or read the selected submission's private-access history.
  Organisers retain the existing safe monitoring views only.
- A deliberate review specifies the exact submitted-parent ID, a non-empty reason
  of at most 1,024 UTF-8 bytes and either source only or one resolved attempt ID.
  The attempt must belong to that parent. Unknown/foreign/unresolved attempts do
  not reveal diagnostics or create a review record.
- Scope is the immutable program actually admitted for that official submission
  or sample Run, never the current editor, starter/reference implementation or
  another draft. SHA-256 and Base64 preserve the submitted bytes, including BOM
  and CRLF. The text viewer is presentation only, not a replacement source file.
- The optional feedback projection contains only the selected dispatch's result,
  retained stdout prefix, stderr, compiler output and explicit truncation flags.
  It excludes hidden input/expected-output records, case IDs, provider tokens,
  supervisor evidence, credential material, internal runtime/host configuration
  and another attempt's data. Program output can itself contain hidden values,
  so even these retained streams remain restricted to the audited reviewer.
- Round closure/cancellation does not create a sporting-edit permission. Supported
  historical private review remains read-only under current staff authority and
  the original retention policy.

## Audit and Lost Replies

Migration `0064_submission_review` adds immutable `submission_review_audits` with
actor/session/credential references, exact round/parent, original request key and
fingerprint, bounded reason, source digest, optional attempt/result digest and
recorded time. Raw source, output and secrets are not copied into the audit.
Source/round/attempt bindings and current normal-role authority are checked by a
database trigger; the API has SELECT/INSERT but no update/delete grant. The same
existing exclusive security coordination and global staff-audit capacity apply.

A fresh request commits the bound audit before its payload can be returned to the
browser. Matching concurrent/repeated requests recover one original logical
review, not another audit/permission. Changing its reason or selected dispatch
under the same key is an intent conflict. A source-only review never expands into
a feedback review because a job later finishes.

GET recovery rechecks current authority and verifies the retained source/result
digests. Payload recovery is bound to the **original current staff session**; a
replacement browser/sign-in needs a new deliberate review and audit. The older
receipt is not a portable private-data grant. Missing/corrupt/changed retained
bytes fail closed. Revoked, expired, recovery-only or downgraded sessions cannot
retrieve old private reviews. Reads and audited review creation do not extend
staff idle or absolute expiry.

## HTTP Contract

All paths below are under
`/api/v1/staff/competition/rounds/:round_id/judging/:parent_id`.

| Method / Path | Purpose |
| --- | --- |
| `POST /reviews` | Body: `request_key`, `confirm_parent_id`, nullable `attempt_id`, `reason`. STAFF Origin/CSRF checks, strict JSON and 16 KiB body cap apply. |
| `GET /reviews/:request_key` | Same-session original-key recovery: `OBSERVED` with `receipt`, or `NOT_OBSERVED`; no POST replay or new audit. |
| `GET /reviews?after=<optional audit UUID>` | At most 40 private-access metadata entries, newest first, with a stable timestamp/UUID cursor. A cursor from another parent is refused. |

Responses are no-store and capped at 1 MiB. The largest source is the existing
128 KiB program; retained streams remain limited to 16 KiB stdout and 64 KiB each
for stderr/compiler output. Byte truncation is not silently changed into a full
answer. Review/history routes do not expose an automatic HEAD equivalent.
Audited opening shares the staff-command quota; recovery/history use the staff
read quota. A refusal is not a competition penalty or a queued retry.

## Browser Flow

From a selected Judging detail, the authorised reviewer opens **Review submitted
program**, chooses source only or a resolved dispatch, confirms the submission
ID and provides the reason. Only the admitted source and chosen retained feedback
appear. Output is rendered as escaped plain text, not HTML, scripts or links to
internal resources. No code or review receipt is written to browser storage.

An interrupted POST retains only its original GET recovery handle and blocks
conflicting navigation/new review actions. **Check original review** retrieves the
existing bound response; reconnect never silently repeats the POST. Closing or
navigating away clears the private payload. Unavailable/stale authority also
clears it; a late response from an earlier access state cannot redisplay private
bytes after access returns. Revocation removes the entire protected screen.
These controls cannot erase bytes someone already copied or photographed.

Private-access metadata polls every five seconds without renewing activity;
private source/output is never auto-polled. History uses bounded pages and a
scrollable table on desktop/mobile rather than an unbounded list of payloads.

## Verification and Open Gates

Disposable tests cover exact bytes/hash, selected diagnostic binding and
truncation, once-only concurrent review/recovery, changed intent, same-actor
replacement-session refusal, all denied audiences, source/audit immutability,
foreign/unresolved attempts and cursors, stable paging, maximum response sizes,
CSRF/origin/HEAD boundaries, clock refusal, role revocation and unchanged final
results. The real React/Fastify/PostgreSQL browser check covers lost replies,
late replies after access changes, source clearing, escaped hostile text,
Organiser exclusion and desktop/mobile layouts.

These are synthetic local fixtures, not actual participant reviews or a deployed
judge. No development/cloud migration, real data, architecture or Git history was
changed. Production source/evidence retention, installed-host permissions,
full-system security/load/recovery rehearsal and launch gates remain open.
