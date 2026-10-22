# Competition Engine

This batch implements the normal two-round competition backend, not the participant
workbench, live Socket.IO delivery, full staff console or an installed event judge.
The approved architecture is unchanged. No production defaults fabricate judging
results, readiness, finalisation, a draw or opening funds.

## Data Flow

1. An Owner reviews an exact, successful, physically drained validation run and
   publishes its immutable snapshot. Published draft content cannot be edited.
2. The existing reserved arena setup selects R1 teams/duration. Competition setup
   selects 1-40 matching-round published snapshots, without multiple versions of
   the same challenge family. Preparation binds the roster, snapshots, rewards,
   rules and duration. Changed selections invalidate readiness.
3. A sensitive confirmed start rechecks readiness, freezes both registered member
   positions, and opens one shared clock. R1 supports 100 teams; R2 supports 50.
   Duration remains a positive number of milliseconds, capped at five hours.
4. Official admission derives the member's locked language. It stores the exact
   UTF-8 source, authoritative post-lock receipt time/order and current team hint
   tier. One unresolved official per team/bounty does not block different bounties.
5. A separate trusted checker supplies the complete frozen set of reliable case
   results. Only the non-login `ingenium_competition_worker` privilege group can
   call the assessment function. The competition API cannot post a verdict.
6. The backend aggregates the lowest-position failing case, then settles automatic
   effects. R1 rewards each team once; R2 rewards the earliest correct receipt
   globally. An earlier unresolved receipt blocks a later correct award. Global
   pause defers effects, but team/member pause alone does not. Reliable R2 wrong
   outcomes add 300,000 ms once; infrastructure uncertainty is not a wrong verdict.
7. Closing refuses new play, but already admitted work continues. Finalisation
   refuses unresolved official work and locks exact standings/digests. R1 retains
   the instance reservation; R2 finalisation completes it and releases the pointer.

SQL functions serialize competition writes under the round gate and use existing
security/clock transactions. Source records, command receipts, economic effects
and source-free outbox notifications commit together. There is no automatic
request retry, result override, refund, negative wallet or reset of old history.

## Economy And Ranking

- `B = 10 * difficulty`, with integer difficulty 1-100. No floating-point money.
- R1 hint increments: `D`, `3D`, `4D`. Purchases immediately lower wallet and net
  points; a solve still credits the full `10D` once.
- R2 hint increments: `D`, `3D`, `8D`. Wallet payout is always `10D`; winning points
  are `10D`, `9D`, `7D` or `5D` for the admitted tier 0-3. Later hints do not alter
  an already admitted attempt.
- Purchases are sequential and team-shared. Same-key recovery preserves the
  original response, including rejection. Distinct keys for an owned hint return
  its original purchase without another debit, even during pause/closure/claim.
- Wallets are calculated from append-only source-linked ledger entries, not a
  browser total. Deferred checks require exact purchase debits, full award credits,
  correct opening allocations and nonnegative committed balances.
- Rank by points descending, exact effective time ascending, then sorted
  highest-first difficulty profile. Complete ties share sporting rank; stable
  display order never decides advancement.
- Solve time uses the original receipt minus the clipped union of global/team
  pauses. Member-only pauses do not discount the shared team clock. Only global
  resume extends the common closing time. Pauses never reset session lifetimes.

## Qualification And Carryover

Before R1 starts, generate one unbiased shuffled permutation of its preallocated
team-round IDs and a 32-byte random salt. Publish its SHA-256 commitment and store
the plan encrypted with AES-256-GCM under a separately injected draw key. The
round ID is authenticated associated data. The application does not generate,
install, print or persist that key automatically.

After final R1 results, an Owner confirms qualification with their current code.
The decrypted plan must match the original round/roster/commitment. Every strictly
better team qualifies; only a complete tie crossing place 50 uses the committed
permutation for the remaining places. Save and reveal that same plan/selection
once. Wrong/missing keys, mismatched rosters or changed commitments stop the
operation, never reroll it. This relies on trusted organisers/deployment keys,
not a public randomness beacon.

R2 can be configured/reconfigured only after its own R1 final result and locked
qualification. Launch allocates each selected qualifier's frozen final R1 wallet
once, including zero without a fake ledger entry. R1 history stays unchanged and
R2 score starts at zero. R2 sporting ties are shared, not broken by this draw.

## API Surface

All routes remain inside the existing same-origin, secure-cookie, CSRF, quota,
strict-body and redacted-error boundary. Reads do not renew sessions. Committed
submissions/new hint purchases count as activity; rejected/no-charge retries do not.

| Route | Purpose |
| --- | --- |
| `POST /api/v1/staff/competition/publications/:snapshot_id` | Review and publish an exact passed/drained run with request key, revision and own-code confirmation |
| `POST /api/v1/staff/competition/rounds/:round_id/commands` | Configure, prepare, start, scoped pause/resume, close, finalise, qualify, prepare R2 or permitted discard |
| `GET /api/v1/{staff/}competition/rounds/:round_id` | Authorised round/catalogue/pause state; participants get only their wallet/hint tier |
| `GET /api/v1/{staff/}competition/rounds/:round_id/standings` | Provisional/final standings without private wallet balances |
| `GET /api/v1/{staff/}competition/rounds/:round_id/outcomes/:request_key` | Read only the actor's stored receipt |
| `POST /api/v1/competition/rounds/:round_id/bounties/:bounty_id/hints` | Buy the next tier or resolve existing ownership |
| `GET /api/v1/competition/rounds/:round_id/bounties/:bounty_id/hints` | Reveal only committed team-owned hints |
| `POST /api/v1/competition/rounds/:round_id/bounties/:bounty_id/submissions` | Admit bounded exact source under an explicit installed readiness dependency |

The normal app has no such competition readiness dependency installed, so new
starts/submissions remain unavailable rather than queueing work to a fake judge.
Lost-response receipt reads remain independent of readiness. `competition_tick`
provides the restricted authoritative deadline/settlement turn; it is not an
automatically installed worker or browser-driven timer.

## Verification And Remaining Integration

New migrations 0029-0032 were applied only to disposable databases. They add
competition records, narrow SQL functions, non-login worker permissions, immutable
history, source/ledger checks and the publication bridge. The API role cannot write
the tables directly or call the trusted result function. Schema regeneration
reports no pending differences. Installation needs reviewed role-provisioning
permissions; migrations do not issue a worker login/password.

Tests exercise the entire normal R1-to-R2 flow with real PostgreSQL and an explicit
synthetic checker that never executes submitted code. Coverage includes duplicate
starts/receipts, frozen tier/receipt, same/different-purchase races, insufficient
funds, independent R1 awards, global/scoped pauses, deadline equality, all six wrong
categories, infrastructure refusal, earlier-unresolved precedence, immutable final
results, the 48-plus-three draw, same-instance carryover and private HTTP projections.

The later [participant judging batch](participant-judging.md) adds official/sample
case plans, fair dispatch, checked-evidence binding/recovery and physical reservations.
Both competition-round tests now exercise this worker with a synthetic driver,
rather than injecting the reliable aggregate directly.

Still required before live use: installed real-host execution and orchestration,
deadline maintenance, global variable-data/retention guards, live event
delivery/replay, cancellation and exceptional discipline workflows, participant/
staff UI, real host verification, deployment and load/recovery rehearsal. These
are remaining work, not removed features. A logical assessment or completed round
does not certify that a sandbox is drained. No existing cloud lab, secrets,
development database or architecture has been changed, and no Git mutation was run.
