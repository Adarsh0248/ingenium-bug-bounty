# Team Registration and Code Management

New team login codes contain eight random uppercase Base32 characters (A-Z, 2-7).
Existing 32-character team codes still work until normal rotation; staff codes
remain 32 characters. Creating, importing, rotating or reissuing a team code uses
the new length. Internal team UUIDs remain stable.

## Available Now

Current normal Owners and Super Admins have a **Teams** control-room view.
Organisers and participant sessions cannot use its registration or code routes.

- Register one team with two member names, an audit reason and your own current
  staff code. This creates one team UUID, two distinct member UUIDs in positions
  1 and 2, their empty browser-session slots and the first random team code in
  one transaction. Duplicate team/member names are allowed; names are labels.
- The protected registration command caps the pool at 1,000 teams. This is a
  storage guard, not proof of event capacity. The separate arena roster still
  limits Round 1 to 100 selected teams and Round 2 to 50 qualifiers.
- Registration does not enrol a team or alter a frozen arena roster. Returning
  to Setup refreshes the registered-team selector without reloading the page.
- Rotate a selected team's code using its observed code version, an audit reason
  and your own staff code. Existing credentials, both members' sessions, entry
  proofs and pending/approved handoffs are retired together. Secret deliveries
  are purged and the same member slots are cleared, not recreated.
- Rotation preserves stable identities, frozen names, locked languages,
  competition state, scores, pauses, drafts and judging history. Already enrolled
  members still need the normal staff-approved browser replacement after fresh
  entry; a new code does not bypass their locked enrollment.
- An existing complete registration with no active credential uses **Issue team
  code**, not Rotate. First issuance uses observed code version zero; reissuance
  after revocation advances the previous credential version.
  Incomplete owner-created fixtures cannot receive a code through this route.
- **Revoke team code** deliberately retires the current code, both members'
  grants, entry proofs and browser handoffs without generating a replacement
  secret. It needs the exact team, observed code version, your own current staff
  code and an audited reason. The confirmation names the action and warns about
  its access effects. This is global credential revocation, not an arena-scoped
  block; neither action changes scores or pauses the arena.
- A revoked code stays unavailable until a fresh explicit Issue command. That
  command does not reactivate old sessions, clear disciplinary blocks, bypass
  same-round organiser approval or change the selected language. Admitted work
  continues under its original frozen source, settings and receipt priority.

## Private Search

Use **Find team** to search team names, registered member names or registration
IDs. Matching is case-insensitive substring matching, with whitespace around the
query trimmed. `%`, `_`, quotes and backslashes are literal characters, not SQL
patterns. Search text is limited to 120 UTF-8 bytes. There is no public member
directory, credential search or raw-code readback.

Pages stay capped at 50 registrations; the response includes the filtered match
count and total pool count. Cursors must belong to the current search result.
Changing/clearing the search returns to page one; a late response from an older
query cannot replace the current screen. Search/background refresh does not
renew the staff session, and a draft/unknown command locks search navigation.

Each issued code appears once in a masked private dialog. Reveal and Copy are
explicit; clipboard failure leaves it available for private manual copying.
Closing clears it. Codes never enter receipts, URLs, browser storage or the
registration list. Do not distribute them through a public sheet or shared chat.

## Concurrent Changes and Recovery

Creation uses the observed security-control revision; code actions use the
observed team code version and the action's required active/inactive state.
Rotate/Revoke require an active code; Issue requires no active code. A stale
rotation cannot silently issue a new code after revocation. Concurrent changes
produce an immutable rejection
instead of overwriting data. The editor keeps the unsent names and offers an
explicit review of the latest state before a new command.

Every command has an actor-owned request key and immutable source-linked receipt.
An identical concurrent/restarted request returns that receipt with no code;
changing any semantic field under its key is refused. Another staff identity
cannot recover the original actor's receipt. Authority is checked again on every
write, list and recovery read. Background reads do not renew staff sessions.

Unsent edits, uncertain commands and an open code dialog block control-room
navigation/sign-out and warn before unloading. An uncertain response allows only
GET recovery of its original receipt, never automatic POST retries or creation of
another team. If creation/rotation committed but its code response was lost,
recover the identity and deliberately rotate to obtain a new secret.
The pending request key is tab-local: forcing a reload loses that local recovery
handle; it does not make replaying or recreating a registration safe.

## HTTP and Storage

- `GET /api/v1/staff/teams?search=TEXT&after=UUID`: at most 50 matching
  registrations, safe code-version/active-state metadata, normalised query,
  matched/total counts and the observed creation revision. Both parameters are
  optional. The route remains Owner/Super-Admin-only and uncached.
- `POST /api/v1/staff/teams`: strict team/member names, request key, expected
  revision, own-code confirmation and audit reason.
- `POST /api/v1/staff/teams/:team_id/rotate-code`: strict observed code version,
  request key, own-code confirmation and audit reason.
- `POST /api/v1/staff/teams/:team_id/revoke-code`: the same protected confirmation,
  but no generated code or recoverable secret delivery.
- `POST /api/v1/staff/teams/:team_id/issue-code`: deliberate new issuance only when
  no code is currently active, with the observed version and confirmation.
- `GET /api/v1/staff/outcomes/teams/:request_key`: original actor's receipt or
  `NOT_OBSERVED`, never raw code delivery.

Writes require normal staff cookies, exact same-origin requests and staff CSRF.
Names are bounded to 120 UTF-8 bytes and reasons to 1,024 bytes; malformed Unicode,
NULs, unknown fields, arbitrary members and stale versions are refused. A
successful HTTP envelope can contain a durable `REJECTED` command receipt;
check its outcome rather than assuming that HTTP 200 issued a code.

Reviewed migrations `0050` and `0051` add immutable command receipts and a narrow
confirmed database writer. The runtime role cannot directly provision teams,
members or credentials, or insert/edit/delete these receipts. Existing
registrations and credentials are not rewritten by migration. These migrations
have only been applied to disposable test databases in this development batch.
Migration `0068_team_search_revocation` extends the existing confirmed writer and
immutable receipt shape. Revocations reference the affected credential; the
issuance-only unique index still prevents issuing it twice. Existing records,
verifiers and request-key fingerprints are preserved. No project/cloud database
has been migrated by this work.

## CSV Import

The user delegated choosing columns rather than supplying the actual export.
Use this canonical UTF-8 CSV target format:

```csv
registration_id,team_name,member_1_name,member_2_name
REG-DEMO-001,Synthetic Example Team,Example Member One,Example Member Two
```

`registration_id` is a stable ID from the registration process, not a team name or
row number generated afresh on each upload. The two names create separate stable
member identities even when they are identical. Do not include contact, payment
or unrelated form fields. Retain the ID when correcting or re-exporting the file.

In Teams, choose **Import CSV**. Download the template, choose a UTF-8 file and
select **Preview registrations**. The preview labels each valid record as New,
Existing or Conflict, with 50 rows per page. It does not persist registrations,
allocate codes, consume a command receipt or renew your staff session.

The accepted format has exactly those four columns, in that order, at most 100
teams per file and at most 1 MiB of UTF-8 text. The pool still supports 1,000
registered teams; use multiple files for larger lists. A near-1,000-row save
exceeded the unchanged two-second database statement budget during testing, so
the upload bound is 100 rather than extending security-lock/transaction deadlines.
A UTF-8 BOM, LF/CRLF and standard quoted
commas/quotes are accepted. IDs are case-sensitive ASCII letters/digits with
optional `.`, `_` and `-`, at most 64 characters, starting with a letter/digit.
Names preserve their exact values, use at most 120 UTF-8 bytes, cannot be blank
and cannot contain control characters. No automatic trimming, numeric conversion,
member-position swapping or name-based merging is performed.

Malformed CSV, wrong/extra columns, missing fields, invalid names and repeated IDs
within one file block the entire import. For a known ID, an exact team/member-name
match is unchanged. Any different detail is a conflict: the importer never edits
existing names, identities, codes, enrollments or a frozen roster. Correct the
source file or investigate the registration through authorised staff procedures.
Do not assign a different registration ID merely to bypass a conflict.

Registration IDs are matched only to earlier CSV imports. Manual registrations
have no external ID; identical names are deliberately not assumed to identify the
same people. Do not include an already manually registered team under a new CSV
ID: this would create a separate registration. Check the pool before importing;
manual-to-export reconciliation is not an automatic name-matching operation.

After reviewing, confirm with an audit reason and your current staff code. The
server rechecks the exact file digest, current security revision, existing IDs
and remaining pool capacity in the same atomic transaction. Any stale state,
conflict or capacity failure saves no part of the batch. Explicitly preview again
before issuing a new confirmation. A later upload of identical registrations is
an unchanged result, not another team or another code issuance; it remains valid
at the 1,000-team pool cap.

New codes appear once in a masked dialog with explicit reveal and private JSON
export. The export includes the import UUID, registration ID, team UUID and code;
it does not include member contact/payment data. It is a plaintext access-secret
file: distribute it privately and do not put it in Git or a public sheet. JSON
is used rather than exporting untrusted names into spreadsheet formulas. No file
is downloaded until you explicitly request the export. Closing clears the codes
from the screen; the server stores only their verifiers.

An uncertain import blocks navigation and new writes. **Check original import**
uses GET only. It returns saved registration/team references, never codes again.
If creation committed but code delivery was lost, deliberately rotate the affected
team codes using Teams. Re-uploading the file is not a secret-recovery mechanism.
The original receipt stays unchanged even after later registrations/code rotations.

Additional protected routes:

- `POST /api/v1/staff/registrations/preview`: CSV validation and current matching.
- `POST /api/v1/staff/registrations/import`: confirmed, actor-keyed atomic save.
- `GET /api/v1/staff/outcomes/registrations/:request_key`: actor-owned recovery.

Both POSTs require staff CSRF and normal Owner/Super Admin authority before large
bodies are accepted. They share the existing two-large-request admission bound,
staff quotas and transaction deadlines. Invalid/stale/overloaded operations do
not relax these restrictions or permit partial imports. Raw CSV and raw codes
are absent from immutable receipts and application request logs.

Reviewed migrations `0052` through `0054` add immutable external-ID mappings/import
receipts and a narrow confirmed bulk writer. They do not backfill, rewrite or
delete existing registrations. No real export has been mapped or imported, and
these migrations have not been applied to the development/cloud database.

The pinned server-only parser is `csv-parse` 7.0.3; the implementation follows its
[sync API](https://csv.js.org/parse/api/sync/) and
[bounded parsing options](https://csv.js.org/parse/options/). No CSV parser or
database code is shipped in the participant browser bundle.

## Verification

The focused search/revocation flow runs against disposable PostgreSQL and real
Chromium, not the project database:

```powershell
$env:INGENIUM_TEST_SUITE = 'team-access-browser'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

It exercises 58 synthetic imported registrations, literal/empty/member/ID search,
50-row paging and scope rejection, read-only session activity, role/own-code/
clock checks, once-only revoke receipts, stale and simultaneous revoke/rotate/
issue commands, immutable history and strict uncached HTTP/CSRF boundaries.
Live checks preserve both languages, drafts, round clocks, points and an admitted
program; the original job still completes with its once-only award. Both browser
grants, pending/approved handoffs and encrypted deliveries are invalidated. Fresh
code issuance still cannot reenrol an already-entered member without approval.
Real UI checks cover search/page reset, confirmation warnings, a lost committed
revoke response with GET-only recovery, both participant browsers losing access,
the other team staying connected, deliberate masked code issuance and mobile
layout. The existing team-registration, CSV-import and both-round browser suites
are separate regression checks, not evidence of full event-load readiness.

Disposable PostgreSQL checks exercise duplicate requests, changed intents,
owner-scoped recovery, normal role/own-code boundaries, UTF-8 limits, stale
commands, immutable receipts, capacity/pagination, and live code rotation with
both participant sessions and pending/approved replacements. A reversed enrolled
round clock must prevent credential changes.

The real React/Fastify/PostgreSQL browser flow covers wrong confirmation without
lost edits, masked reveal, denied clipboard, code rotation, stale-state review,
lost response with GET-only recovery, discard, refreshed Setup selection,
Organiser denial, reload without code readback and desktop/mobile layout.
The import checks additionally cover malformed UTF-8, duplicate/conflicting
registration IDs, BOM/quoted fields, own-code confirmation, private JSON download,
repeat uploads without code readback, stale preview, lost-save GET recovery,
immutable mappings, atomic rollback and filling the 1,000-team pool through
bounded files. Preview/code pagination was checked with 51 imported teams; the
mobile one-time-code dialog was inspected with secrets masked.
Parser/HTTP/database validation uses the same 100-team file bound.
This is not a production migration, real-judge/load test or deployment rehearsal.
