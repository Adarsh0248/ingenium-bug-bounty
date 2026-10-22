# Participant Workbench

This batch implements protected challenge reads, member-private PostgreSQL drafts
and a browser-independent autosave controller. It does not provide the visible
editor, arena or admin screens, install a judge or enable production entry.
No development database is migrated automatically.

Verified with 231 unit/transport tests and 225 full disposable database/queue/
HTTP/clock checks, including real loopback socket privacy checks. No tests were
skipped. Type checking, build, schema generation and the production dependency
audit also passed. This is local test evidence, not an event-readiness sign-off.

## Data Flow

1. The current participant session determines the member, team, round and locked
   language. The browser cannot select another draft owner or source variant.
2. Challenge metadata, statement, starter and each public sample field load
   separately. Hidden cases, reference solutions and unrevealed hints are never
   included. Background reads do not renew session activity.
3. Before the first save, the draft is the language's starter at virtual revision
   `0`, without a database row. First save creates revision `1`, even for empty
   text. Later changed saves increment the revision; clearing never deletes it.
4. A save supplies a fresh UUID request key, a decimal-string base revision and
   exact editor text. The server rechecks authority and write gates, then compares
   the revision and bytes in one transaction. A stale base conflicts even if the
   submitted text happens to equal the current source.
5. Source, receipt, qualifying activity and the owner's source-free live notice
   commit together. A current-revision identical save returns `UNCHANGED`, with
   no revision, timestamp or activity change. A repeated key with identical input
   recovers its original outcome; changing that input is refused.

The two teammates have separate working drafts, including when their languages
differ. Each may read their team's frozen official submitted source, read-only;
neither can read the other's working draft or sample source. Run/Submit still
receives actual editor text, independently of autosave. Draft writes cannot
change an admitted program, award points or allocate judging priority.

## Server Gates And Limits

- New saves require a valid current session, an active running round and an
  available bounty. Global, team and member pauses combine with OR. Pending
  judging alone does not prevent saving.
- This team's R1 award or any committed R2 claim makes that bounty read-only.
  Closure also denies new saves; arrival before closure grants no final-save
  exception. Already committed save receipts remain recoverable under current
  read authority, without replaying their effects.
- Approved browser replacement restores the same member's drafts and receipts.
  A valid R2 session can read only its own member's R1 drafts and its team's
  official source in the same instance. That historical access grants no R1
  write, revived old credential or different language.
- Drafts accept valid UTF-8, including empty text, NUL, BOM and CRLF, without
  normalisation. The decoded ceiling is 128 KiB. Save HTTP bodies are at most
  1 MiB; a bounded oversized source receives a durable `DRAFT_TOO_LARGE` receipt,
  while malformed or transport-rejected requests create no save receipt.
- Draft saves share a persistent member-round quota of 120/minute, burst four.
  Protected reads use the existing shared read quota. Deliberate opening uses
  the existing command quota; only a new authorised open or changed save
  qualifies as activity, never polling, unchanged saves or denials.
- Storage admission includes participant judging reservations, draft bytes and
  conservative row allowances in the same serialized budget check. It refuses
  beyond 192 MiB/team-round or 29 GiB across that participant family. Outcome
  capacity includes draft receipts and deliberate-open records. This is not a
  replacement for the pending whole-application resource/retention supervisor.

The API has read access but no direct write permission on draft tables. Only the
scoped command functions may mutate them. Deferred constraints bind a changed
source to its receipt and activity; capacity failure rolls all effects back.
Staff and competition workers receive no draft-source read API or new table grant.

## HTTP Contract

All paths below begin with
`/api/v1/competition/rounds/:round_id/bounties/:bounty_id`.
Writes use the existing exact-origin and participant CSRF protections. Responses
are explicit allowlists with `Cache-Control: no-store`; nothing is put in a URL
except the scoped identifiers and paging cursor.

| Method/path suffix | Purpose |
| --- | --- |
| `GET` root | Title, difficulty, bounty, locked language, limits, sample sizes and current gates |
| `GET /statement`, `/starter` | One permitted statement or language-specific starter |
| `GET /samples/:sample_number/:field` | One public sample's `input` or `expected_output`, never a hidden case |
| `GET /draft` | Own latest source, decimal revision and current write gate |
| `POST /open` | Deliberate opening with `{request_key}` |
| `POST /draft` | Save `{request_key, base_revision, source}` |
| `GET /draft/outcomes/:request_key` | Read-only original outcome lookup |
| `GET /submissions?after=...` | Up to 50 team official attempts, without source or hidden progress |
| `GET /submissions/:submission_id/source` | Team official source, exact and read-only |

Save success/no-op returns HTTP 200. Processed conflict/rejection returns HTTP
409 **with a typed save receipt**, not a generic error. An outcome lookup returns
`OBSERVED` plus that receipt, or `NOT_OBSERVED` with null. Absence is not proof a
timed-out request failed. Authentication, transport and storage failures are not
invented save outcomes. Ordinary workbench responses are bounded to 1 MiB;
one sample field may use up to 8 MiB of encoded response for escaped text.

## Client Controller

`apps/api/src/workbench/draft-client.ts` has no Node or UI dependency. Future
frontend code supplies authenticated load/save/outcome callbacks, a monotonic
clock, UUID generation and a state-change handler. The save callback must decode
typed 409 receipts, not discard them as generic transport failures.
Keep one controller per open member-round/bounty draft and one buffer store per tab.

- Autosave targets two idle seconds or ten seconds of continuous edits, with
  only one unresolved save per draft. Newer typing remains separate from the
  in-flight snapshot, so an old acknowledgement cannot label it Saved.
- A lost response retains its original key, base and source. Read-only lookups
  back off through 0.5/1/2/4/8 seconds. There is no automatic POST retry. Explicit
  retry first checks the outcome and current permission, then uses the exact
  original intent. Overlapping retries cannot dispatch another request.
- Conflicts stop autosave and preserve local text. `review()` loads the saved
  copy; `resolve(view, "LOCAL" | "SERVER")` represents an explicit user choice.
  A later server change still requires the normal conditional save; no force or
  automatic merge endpoint exists.
- Wire live invalidations to `refresh()` and current access restrictions to
  `availability()`. Reconnect refreshes authoritative draft state before new
  writes. Live snapshots carry only own draft revisions, never editor text.
  Offline edits are permitted only when the available local view was editable.
- Share one `DraftBuffers` per tab. It refuses a ninth dirty buffer or more than
  1 MiB of dirty text without eviction or truncation. Deliberate discard needs
  reviewed confirmation. No browser persistent storage is introduced.
- `close()` stops timers and ignores late responses without clearing retained
  local text. Unsaved text is not promised to survive browser closure or device
  loss; only acknowledged server drafts restore on another device.

## Remaining Launch Work

The React editor, source-as-text rendering, draft conflict/recovery dialogs and
[read-only results/history](participant-history.md) now have local browser tests.
Deeper keyboard/accessibility coverage and realistic burst/load tests remain.
The approved seven-day draft/source payload retention and longer canonical
receipt retention need the shared, dependency-aware maintenance implementation;
this batch does not delete any payload or certify that retention gate.
Production migration, real runtime wiring and full event rehearsal remain
separate launch requirements. Tests use disposable services and synthetic teams,
clock/runner observations, not actual competition source execution.
