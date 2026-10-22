# Participant Results and History

Open **Results and history** from the arena toolbar. This is a read-only view:
it never runs code, purchases hints, saves a draft or renews the session.
Closing it returns to the existing arena/workbench without discarding local code.

## Views

- Standings show provisional results during play, **Results finalising** during
  closing, and **Final results** only when the authoritative result is locked.
  Cancelled rounds have no competitive final and all ranks are null.
- Attempts include this member's sample Runs and both teammates' official
  submissions. An original attempt keeps its admitted language, source and time,
  independently of later draft edits. Passed code is not described as a bounty
  win unless its actual award exists. Pending/cancelled/recovery states remain
  explicit rather than inventing a verdict.
- Wallet history shows committed awards, hint debits and Round 1 carryover.
  Awarded round points are distinct from currency; no other team's wallet is
  returned. The balance is read from the ledger, not summed from the current page.
- Saved work shows the current member's acknowledged server draft (or clearly
  labelled starter), problem statement and only hints already purchased by the
  team. Source and diagnostics are rendered as text, never executable HTML.

Live projection changes trigger fresh authorised reads. While the view is open,
a non-overlapping five-second polling fallback updates the visible page and
pending attempt. Read failures are visible; source/detail actions are disabled
until the page can be read again. No write is automatically repeated.

## Access Boundary

The existing workbench and the new history endpoints share one current-session
and target-round membership check. Each request rechecks the current session
slot, verifier, credential, expiry, access blocks, clock and enrolled language.
Both round rows are locked in deterministic order for historical access.

A valid Round 2 grant may read the same member/team's closed Round 1 history in
the same arena instance. It does not revive a retired Round 1 cookie, permit
Round 1 edits or grant another team's/instance's history. Closing, pausing or
archiving does not create a security-timeout exception. No permanent/public
history credential or spectator route is added.

Sample source/feedback stays member-private. Official source/status is scoped
to the team; its feedback contains no hidden test IDs, counts, expected answers,
stdout, stderr, compiler diagnostics, provider tokens or reference solutions.
The existing official/public-sample feedback projection is reused, not copied
into a broader history serializer. Drafts and hint reads remain separately scoped.

## API

All paths below are under `/api/v1/competition`, require the current participant
cookie, use no-store responses, consume the normal member read quota and expose
explicit DTOs bounded to 1 MiB for metadata/source. The combined original-source
and public-sample feedback response uses the existing 8 MiB public-I/O ceiling:
JSON-escaped source plus permitted diagnostics can exceed 1 MiB without any
individual field exceeding its own limit. Reads never count as session activity.

| GET path | Content |
| --- | --- |
| `/history/rounds` | Current round and authorised same-instance Round 1 |
| `/rounds/:round_id/history` | Round status, public standings, own wallet and bounty work metadata |
| `/rounds/:round_id/history/attempts?after=UUID` | Own samples and team official attempts |
| `/rounds/:round_id/history/wallet?after=UUID` | Own team's committed wallet entries |
| `/rounds/:round_id/history/judging/:parent_id` | Original source/status and permitted public-sample bytes |
| `/rounds/:round_id/history/hints/:bounty_id` | Only purchased hints |

Attempt and wallet pages return at most 50 rows. Cursors identify an authorised
row and use stable `(recorded time, UUID)` ordering, not offsets or arbitrary
team/member/language overrides. Foreign, nonexistent and malformed anchors fail
closed. Draft and statement details reuse existing workbench GET routes.

## Verification

The focused `history` database suite uses real admissions and an explicitly
synthetic judge in a disposable PostgreSQL container. The 51-attempt pagination
fixture obeys the real three-second Run cooldown; no production limit is relaxed.
`history-browser` adds actual React/Fastify/cookie/database browser interaction,
Round 1/2 navigation, source and hint privacy, pagination, wallet carryover,
closing/final transitions and desktop/mobile screenshots. The complete
`test:browser:db` command includes that suite after the existing browser suites.

This adds no dependency, migration, database permission or live deployment.
Verified locally: 254 unit/client tests; focused history (10), history plus real
browser (11), workbench (17) and judging (11) suites; two targeted synthetic
history/3D browser scenarios; production builds, typechecks and bundle checks.
Desktop/mobile history screenshots were inspected. The full global database and
complete all-feature browser suites were not rerun in this batch.
Production retention, installed-judge execution, 100-team load, real device
accessibility/performance, backups and hosted event rehearsal remain launch gates.
