# Staff Discipline

The normal staff console has a **Discipline** tab for Owners and Super Admins
when viewing an arena round. Organisers cannot read this private history or run
these commands. Every change needs the acting staff member's current code,
a nonblank reason, an expected revision and a unique request key.

## Access Blocks

- Select the registered team, then block the entire team or one member. Stable
  team ID suffixes distinguish duplicate team names. Member names are display
  labels, not identifiers.
- Blocks belong to the current reserved arena instance, across both rounds.
  They do not carry into a new arena. Historical controls cannot revoke access
  in a newer instance.
- Blocking revokes affected participant sessions, pending/approved replacement
  requests, entry flows, slot reservations and encrypted delivery capsules in
  that instance. A member block leaves the other teammate's access usable.
- Team and member blocks may overlap. Unblocking clears one exact source;
  it never clears another scope or reactivates a revoked session. Same-round
  access still requires the normal staff replacement/recovery process.
- Clocks, admitted judging, points, wallets, qualification and funding are not
  changed. A blocked team's admitted correct submission can still earn bounty.
  Blocking is not disqualification or a transfer of a shared bounty.

The existing participant session/live checks stop private access after a block.
No disciplinary reason, actor or staff audit record is sent in participant live
notifications. Existing operator-provisioned historical block rows remain
readable; new panel blocks and their once-only unblocks have linked receipts.

## Manual Time

- Add 1 to 300 whole minutes to one enrolled team in one round. The total
  unreversed manual additions cannot exceed 300 minutes per team-round.
- Allowed states are RUNNING, PAUSED and CLOSING, in either round. Cancellation
  states and locked final results are not editable.
- Standings retain points as the primary key. Ranking time is cumulative
  effective solve time plus automatic wrong-submission time plus unreversed
  manual additions. Original receipt and solve durations are not rewritten.
- A reversal names one original applied addition and removes exactly that
  addition once. There is no arbitrary negative-time adjustment, score edit,
  wallet deduction, participant pause purchase or post-final correction.
- The cap, additions, reversals and finalisation share the normal security,
  arena, round and team coordination. Round 2 starts its own manual total;
  Round 1's locked standings and funding remain unchanged.

## History and Recovery

Audit history is newest first, paginated at 50 rows. It includes the staff
identity, timestamp, reason, scope, outcome and original reversal link. Receipts
are immutable, foreign-key bound to real staff credentials/sessions and targets,
and contain no confirmation code. The runtime database role can only use the
narrow command function, not insert or rewrite discipline history.

A lost write reply retains its original request key in the open page. **Check
outcome** performs a GET-only read of that actor's receipt, not another POST.
An unresolved command blocks navigation and further changes. Refreshing or
closing the tab loses this in-memory handle; it is not cross-reload recovery.

Protected endpoints:

- `GET /api/v1/staff/discipline?arena_id=...&team_id=...&round_id=...`
- `POST /api/v1/staff/discipline`
- `GET /api/v1/staff/outcomes/discipline/:request_key`

POSTs use the existing exact-origin, CSRF, private-cookie and shared quota
controls. Responses are no-store. Reads do not renew staff idle time. Stale
revisions require a fresh review and a deliberate new intent. Security/clock
faults do not bypass normal authority. No timeout limits were relaxed.

## Verification Boundary

The focused disposable PostgreSQL checks cover overlapping blocks, scope-only
revocation, continued admitted judging, unchanged enrollment, immutable history,
pending/approved handoff retirement and encrypted-proof purging,
roles/confirmation/CSRF, duplicate and stale commands, cap/reversal accounting,
Round 2 separation and finalisation races. Real React/Fastify/PostgreSQL browser
checks cover confirmation errors, add/reverse/block/unblock, GET-only lost-reply
recovery, navigation guards, Organiser exclusion and desktop/mobile layout.

The complete disposable PostgreSQL suite passed all 248 checks. Unit/client
tests passed all 250 checks; the complete real-backend browser workflow,
typechecks, production builds and client bundle-boundary checks also passed.

These checks use synthetic teams and judge observations only. The development
database and cloud runtime have not been migrated. They do not establish hosted
HTTPS, real installed-judge safety/capacity or event readiness.
