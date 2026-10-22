# Whole-Round Cancellation

Owners and Super Admins have an **Incidents** tab for an arena round. Use the
normal pause controls for a recoverable technical break. Cancellation is the
last-resort decision that the whole round has lost competitive validity, not a
way to reset one team's submission or award a disputed shared bounty.

## Confirm and Fence

- Only a current normal Owner/Super Admin session can cancel. Organisers cannot
  read the private incident details or run cancellation commands.
- Cancellation is allowed in RUNNING, PAUSED or CLOSING, never after a locked
  final result. It needs the acting staff member's own current code, a reason,
  the exact arena/round, a reviewed revision and a unique request key.
- Type the complete round ID in the confirmation. The incident reference is an
  existing external ticket/reference, at most 120 ASCII letters, digits or
  `._/-`, starting with a letter or digit. This is not a new ticketing system.
- The receipt, immutable incident source, CANCELLING state and live notice
  commit together. All new gameplay, dispatch, recovery launches and competition
  effects are fenced immediately, even while a logical backlog remains.
- A paused round is not resumed: no pause interval is closed, no closing time
  is extended and no deferred award is settled by cancellation.

Unfinished official and sample processing becomes CANCELLED, without inventing
a verdict or completion time. Already reliable completed results, admissions,
submitted source, receipts, purchases, wallets, awards and penalties are retained.
Ranks are hidden and the round has no competitive final or winner. Participants
receive live invalidation; open editors become read-only and cancelled jobs stop
showing a pending scan. Existing valid sessions can read history only within
their normal expiry/block rules, not through a perpetual history grant.

## Drain Before Archive

Logical cleanup is bounded to 20 parent runs/submissions per batch. The initial
command, normal judge maintenance and private incident-state polling advance it
under the original authorised cancellation source. Polling does not renew staff
idle time. It does not execute participant code or relax transaction deadlines.

CANCELLING keeps the arena reservation. **Finish cancellation** remains disabled
while logical work remains or any execution from either round still lacks safe
release evidence. A stopped web request, elapsed timeout or logical CANCELLED
status is not proof that a physical process has stopped. Late private evidence
can prove drain but cannot revive a cancelled job, create a new participant
verdict or award bounty. Never force-clear a held slot or reset a permit.

Finishing requires another current own-code confirmation and reason. It records
a linked immutable finish, sets the round to CANCELLED, archives its parent as
DISCARDED and releases the singleton arena reservation. A prior DRAIN_PENDING
receipt stays rejected; review current state and create a deliberate new intent
after drain, rather than replaying that old command.

- Cancelling Round 1 produces no qualification or carryover.
- Cancelling Round 2 preserves locked Round 1 results, but produces no Round 2
  winner and permits no same-arena Round 2 replay.
- A new event starts with a fresh Round 1 and fresh balances.

## Recovery and Privacy

The normal competition command/outcome endpoints are reused:

- `POST /api/v1/staff/competition/rounds/:round_id/commands`
- `GET /api/v1/staff/competition/rounds/:round_id/outcomes/:request_key`
- `GET /api/v1/staff/competition/rounds/:round_id/cancellation`

POST uses the existing exact-origin, CSRF, private-cookie, quota and clock gates.
Metadata and outcomes are no-store. Participant live notices contain no private
incident reference, reason or staff identity. The API database role cannot write
cancellation tables directly; source and terminal-state integrity are enforced
in PostgreSQL as well as the application.

A lost reply retains its original request key in the open page. **Check
cancellation outcome** uses GET only; it never sends a second cancellation POST.
Unresolved commands block navigation. This recovery handle is in memory:
refreshing/closing the tab loses it. Stale revisions require a fresh review.

## Verification Boundary

Disposable PostgreSQL checks cover once-only concurrent commands, queued and
running cancellation, held execution drain, preserved completed/deferred work,
both rounds, wrong authority/confirmation/clock/target, stale versions, CSRF,
immutable sources, private live messages and a 50-parent bounded backlog.
Real React/Fastify/PostgreSQL browser checks cover lost replies, confirmation
errors, participant live read-only feedback, stopped scan indicators, preserved
drafts, Organiser exclusion and desktop/mobile layout.

Verification collected: 251 unit/client tests, the full 255-check disposable
PostgreSQL suite, ten focused cancellation database checks and twelve synthetic
participant browser scenarios passed. Typechecks, production builds and the
bundle-boundary check passed. All four checks in the complete real-backend
browser suite passed in a fresh rerun after Docker reopened, including the final
archive/reload assertion. The original run's exit was lost during a local session
restart; its result was not assumed. A still-valid participant session restores
the saved draft read-only after archiving, with gameplay disabled and no final
result. Desktop/mobile cancellation screenshots were inspected.

These fixtures use synthetic teams and judge observations. They do not validate
real-host process termination, installed judge capacity, hosted HTTPS, backups
or event readiness. No development/cloud migration or deployment was performed.
