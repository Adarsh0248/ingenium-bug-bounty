# Final Results Export

In the staff console, select an arena and round, open **Monitor**, choose CSV or
JSON beside **Final standings**, then use the download icon. Organisers, Owners
and Super Admins have the same safe standings-read authority. No access code,
extra confirmation or privileged source access is needed for this read.

The server requires a current normal staff session on every request. Participant
cookies, recovery-only sessions and expired/revoked staff sessions cannot export.
The route is `GET /api/v1/staff/competition/rounds/:round_id/results`, with no
query parameters, public alias, HEAD route or write action. It uses the existing
shared staff-read quota, security coordination and trusted-clock checks. Reads
do not renew activity or change sporting state, wallets, receipts or judge work.

## What The File Contains

- Explicit `FINAL` state, format version, arena/round IDs and round number.
- The immutable result ID, result version and finalisation time in UTC.
- A SHA-256 checksum of only the exported sporting standings, not the private
  internal snapshot/configuration hashes or the downloaded file as a whole.
  This is a consistency check, not a digital signature or backup.
- Stable team/team-round IDs and frozen team display names, tied rank, points,
  cumulative solve milliseconds, penalty milliseconds, effective milliseconds
  and solved difficulties in their original descending tie-break order.
- Separate qualification status: Round 1 is `PENDING` until the qualification
  decision is committed, then `LOCKED` with explicit per-team booleans. Round 2
  is `NOT_APPLICABLE` with null qualification fields. Rank is never substituted
  for qualification or a new tie-break draw.

The results come from `round_results`, not a fresh calculation from live scores.
Qualification may move from pending to locked without changing the underlying
final-result ID, checksum or sporting standings. Do not confuse pending with
false. CSV uses an empty qualification cell for unknown/not applicable and
`true`/`false` for the locked decision. The `qualification_status` column removes
that ambiguity.

`standings_sha256` hashes UTF-8 `JSON.stringify` of the ordered standings array,
with each object's fields in this exact order: `team_round_id`, `team_id`,
`team_name`, `rank`, `points`, `solve_time_ms`, `penalty_ms`, `effective_time_ms`,
`difficulties`. It excludes `qualified`, which belongs to the later qualification
decision. Use JSON, not spreadsheet-transformed names, to reproduce this check.

Both rounds and historical completed/discarded arenas use the selected round's
own snapshot. Draft, ready, running, paused, closing, cancelling and cancelled
rounds cannot produce a competitive final file. A cancelled round's existing
read-only history remains available through the normal monitoring views.

No member/contact/registration export, code, verifier, wallet balance, hint,
working draft, submitted source, hidden case, reference answer or private judge
output is included. The JSON response is an explicit allowlist with at most 100
standings and a 256 KiB data budget, plus a bounded transport envelope.

## File Safety And Recovery

CSV is UTF-8 with a BOM, comma-separated, CRLF-terminated and fully quoted.
Embedded quotes/newlines are escaped as CSV, not HTML. Potential spreadsheet
formula names receive a leading apostrophe; the JSON version preserves the
original name exactly. Difficulties use semicolons within their one CSV cell.
Times are integer milliseconds, not rounded display times.

Filenames contain server IDs and the round number, never registration names.
The browser downloads directly from memory and releases its temporary object
URL. It keeps no export in local/session storage. The downloaded file itself
remains on the staff device and is not a public results-publishing feature.

While fetching, the download control shows progress and refuses overlapping
clicks. Failed reads can be retried because no competition command is performed.
Switching round, leaving the view or losing current authority discards late
responses; a mismatched arena/round response cannot download a different result.

## Verification

Use disposable synthetic databases only:

```powershell
$env:INGENIUM_TEST_SUITE='results-browser'
npm run test:db:schema
```

The focused suite covers result finality, tied ranks, qualification transitions,
real synthetic award/hint accounting, both rounds, cancellation, historical
scope, current-role/session checks, unchanged state, strict HTTP privacy and
real browser downloads/error/stale-response handling. Unit checks cover CSV
quoting, formula names and lossless JSON. Browser files/screenshots stay in the
ignored test output area.

This chunk needs no schema migration. A standings download is not the approved
encrypted canonical archive, backup, restore rehearsal, retention worker or
production-readiness proof; those remain separate unfinished work.
