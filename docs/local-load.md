# Local Capacity Rehearsal

Run only against the disposable synthetic harness:

```powershell
$env:INGENIUM_TEST_SUITE='load'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

For a Linux-local comparison, select `load-linux` instead. The controller
compiles the existing test code, starts a non-root read-only Node container
sharing only the disposable database's private network namespace, and runs the
same scenarios there. Node and PostgreSQL each have a one-CPU/768 MiB ceiling;
the aggregate is two CPUs, including the in-process synthetic clients. The
Node container has no capabilities, Docker socket, private settings or public
API port. This removes Windows-to-Docker database forwarding from that run,
not the per-request security checks. It does not reproduce a public network,
disk durability, a real clock-health agent or real judge execution.

The Linux report is `apps/api/test-results/linux-load.json`; it is framed and
returned before the container's temporary output filesystem disappears. Each
controller run writes INCOMPLETE before launch, checks the child exit code and
the single matching report, and removes only its labelled test container.
Bounded synthetic diagnostics are retained in `linux-load-startup.log`.

This creates 100 teams, 200 distinct current member sessions and 40 selections
for each of the five languages. It uses the normal HTTP/CSRF/cookie boundary,
the event server's twelve-connection API budget (including its deadlines)
and PostgreSQL limited to one CPU and 768 MiB.
No development database, real registrations or participant code is used.

Phases cover 25/50/100-team metadata ramps, 200 private live sockets with global
pause/resume, 200 exact 128 KiB drafts and a 200-member official admission burst.
Both members target the same bug, so only one pending official intent per team
can be admitted; every admitted ID must match a persisted ordered receipt.
The synthetic judge does not execute submissions or manufacture participant
results. Fixture-only quota resets occur between phases, never inside a
measured request loop. This is not an uninterrupted event-length soak.

`apps/api/test-results/local-load.json` starts INCOMPLETE and becomes PASSED only
after every phase succeeds. Check the process exit code and matching run ID,
not an old report. A failed pause check restores the synthetic round and closes
its sockets so later phases can still expose independent errors. Diagnostic
counts exclude cookies, code, raw database errors and real team details.

The first four-connection HTTP-only baseline passed: metadata p95 was 386-435 ms, all 200 drafts
round-tripped and 100 official intents were admitted with 100 normal refusals.
Adding 200 live connections exposed a reconnect burst during global updates
under that foundation-preview pool. The full harness now uses the same twelve
connections and timeouts as `server.ts` with event entry enabled, not a larger
test-only allowance. The twelve-connection run also failed the live-update gate.
A ten-HTTP/two-live connection split and bounded socket-command experiment did
not pass either and was removed; it is not a production fix or a capacity claim.
The server now avoids a duplicate authority lookup used only to identify a
socket's quota bucket; the protected read still revalidates current authority.
Revocation, role changes, private scopes and normal realtime behaviour remain
covered by the focused live suite. Reconnect retries have bounded jitter to
avoid synchronising every participant behind one network address.
The Linux-local run also reproduced a client race: its stale timer could launch
another ticket request while one was still pending, and an expired reply could
install over a later connection. Regression tests first reproduced that defect.
The client now tracks connection generations, permits only one current ticket /
handshake, bounds that phase to ten seconds and ignores obsolete replies, even
after close. Waiting for a fresh sync also marks the client synchronising rather
than letting the stale timer race that request. This does not relax current
authority checks or replay durable actions. Passing the new unit tests does not
by itself prove the full load gate.
The client now retries only explicitly capacity/rate-refused read projections
with bounded backoff; authentication failures and exhausted retries still
resynchronise. No submission, purchase or other durable command is retried.
The retained read-backoff change does not raise the HTTP admission cap or extend the ten-second
stale-state guard.

The first complete Linux-local pass is run
`afd4fe21-6f48-4c3c-bcd6-728b428c7f3b`. Metadata p95 was 231-294 ms; all 200 private
socket projections received pause/resume, 200 maximum drafts matched, and the
official burst retained 100 admissions and 100 normal refusals with no wrong
penalties or synthetic verdicts. That run opened 398 connections including
recovery; it was not a zero-reconnect guarantee. A subsequent instrumented run
`c5eaca17-8dab-454d-9e58-48259057401d` failed when the synthetic judge-readiness
claim timed out waiting for the security anchor. Its earlier phases passed,
but the report correctly stayed INCOMPLETE. Its control-request-to-projection
pause/resume p95 values were 6,195 / 14,395 ms. These include command processing,
not just the commit-to-notification interval.

The retained heartbeat change adds `ack_required` to an authenticated server
head. It is false only when that peer has no buffered events. The client skips
that no-op acknowledgement; pending events keep requesting acknowledgements on
later heads, including after a lost volatile reply. Missing flags from an older
server retain the conservative acknowledgement behaviour. Every head and actual
acknowledgement still revalidates authority. No heartbeat, stale deadline, buffer
budget or database timeout was relaxed. The earlier failed experimental test was
replaced by an actual client/server test that drops one acknowledgement, observes
the repeated request, and verifies that requests stop only after the buffer clears.
All 22 focused realtime integration checks and 297 unit/client tests pass.

The previous Linux-local correctness pass is run
`d49a093a-a02c-4249-9a12-11502b137c3b`, with the same two aggregate test CPUs.
It retained all 200 exact drafts and 100 official admissions with no duplicate
team/bug admissions; the other 100 member attempts were refused. Metadata p95
was 345-413 ms, with no metadata refusals. The run opened 391 connections,
including recovery, and recorded one projection resynchronisation refusal.

| Measurement | p95 | p99 |
| --- | ---: | ---: |
| Control request to paused projection | 5,282 ms | 5,476 ms |
| Control request to resumed projection | 10,730 ms | 11,308 ms |
| Official admission response, including pending-intent refusals | 1,309 ms | 1,475 ms |

These delays do not establish the architecture's experience targets. Admission
p95 exceeds the initial one-second target, and the live measurements are not
isolated commit-to-claim measurements. PASSED means this bounded correctness
scenario passed, not that the event capacity/latency gate passed. Further load
tuning, actual claim timing, real judge drain and the full mixed soak are required.

## Delivery Stability Follow-Up

An initial heartbeat-timing/presence-query trial still failed the steady-live
check (run `e8d5ef34-b48e-4a71-a0b8-409cff3d10e3`). It was not a capacity pass.
The new regression then reproduced an ordering defect: checking transport
writability between the server's own writes could suppress a committed head
after sending its event. Moving only the head first also suppressed empty
presence updates, so that incomplete version was not retained.

Delivery now checks backpressure once before a bounded event/head/presence
batch. Existing retained event/byte limits still apply. The authenticated head
follows its events before optional presence lookups; the heartbeat timestamp is
the actual send time, not the start of a potentially long sweep. Each batch still
validates the recipient, every other announcing session is revalidated, and an
editor's own presence reuses only the permission result from that same transaction.
The session query returns the team ID it already joins, removing a redundant
lookup without caching authority or widening public responses.

The delivery-stability pass was `df16b57e-5b63-4000-9fcd-839c087cf9a7`:

| Measurement | Result |
| --- | ---: |
| Participant connections / connection attempts | 200 / 200 |
| Reconnects / stale transitions during the live phase | 0 / 0 |
| Recorded unavailable reads or warnings | 0 |
| Metadata p95 across the three ramps | 241-344 ms |
| Pause projection p95 / p99 | 6,435 / 6,642 ms |
| Resume projection p95 / p99 | 6,386 / 6,653 ms |
| Official admission-response p95 / p99 | 1,703 / 1,842 ms |

All 200 maximum drafts matched; 100 official receipts were preserved with no
duplicate team/bug admission and 100 other member attempts refused. The same CPU,
pool, buffer and database deadlines were used. The report now distinguishes
connection attempts from constructed connections and records reconnect phase /
stale cause counts without source, cookies or real participant identities.

All 22 focused realtime integration checks pass, including cursor-before-presence
ordering, final-editor leave, real 45-second expiry, lost acknowledgements, active
editor logout, role changes and shared claims. All 297 unit/client tests and the
production build pass. This is a measured stability improvement, not a latency
gate pass: pause and admission p95 did not improve in this run, resume remained
too slow, and actual commit-to-claim timing was not measured. Keep projection /
request contention, real judge throughput and full-soak verification open.

Migration 0073 aggregates standings per round rather than rescanning every
ledger for every team. Exact parity tests retain the original formula as an
independent oracle, including hints, wallet, penalties, difficulty order and
sporting ties. The migration itself adds no cache or delayed invalidation.

## Version-Bound Public Standings

The live service now retains one public standings calculation keyed by round ID,
round stream ID and committed head. Requests still validate current authority
and hold the existing round/live locks. Wallets are removed before retention;
private HUD balances are read separately. Concurrent same-version readers share
the calculation, receive independent copies, and never reuse a failed entry.
No session, code, hint or private authorisation is cached. Awards, hints, penalties,
controls and finalisation advance the source-linked round head and invalidate it.
Unit checks cover coalescing, replacement, private-field stripping, mutation and
failure eviction. Real PostgreSQL checks prime the cache across penalties/reversal
and provisional/frozen results while retaining exact SQL parity.

The subsequent bounded correctness pass is
`2fcd87b9-4815-4f9c-bbe0-971f01b5f4b9`, with unchanged CPU/pool/deadline budgets:

| Measurement | Result |
| --- | ---: |
| Participant connections / connection attempts | 200 / 200 |
| Live reconnects / stale transitions | 0 / 0 |
| Metadata p95 across the three ramps | 242-281 ms |
| Pause projection p95 / p99 | 4,544 / 4,705 ms |
| Resume projection p95 / p99 | 4,668 / 4,847 ms |
| Official admission-response p95 / p99 | 1,401 / 1,486 ms |

All 200 maximum drafts matched; the official burst retained 100 unique receipts
and 100 normal pending-intent refusals, without judging submissions. Eighteen
projection reads were refused (seventeen associated warnings); the report does
not attribute those refusals to a particular phase, so do not claim zero-refusal
delivery or assign a cause without more evidence. These are faster projection
measurements, not proof of the one-second experience target or real claim latency.

Local measurements do not establish public TLS/network performance, actual
judge throughput, reconnect storms after a network outage or two full event
sessions. Those remain separate host/load/soak launch gates.

## Fifty-Team Shared Race

Run the shared-round correctness scenario independently:

```powershell
$env:INGENIUM_TEST_SUITE='race-load-linux'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

This reuses the same restricted Linux controller, one-CPU/768 MiB API process,
one-CPU/768 MiB PostgreSQL and twelve API connections. It writes a separate
`apps/api/test-results/linux-race-load.json` and bounded startup log; it does not
overwrite the independent-arena report. The Windows-hosted equivalent selector
is `race-load`. Neither scenario contacts the retained cloud lab or real judge.

The fixture creates fifty teams, freezes their actual first-round results,
qualifies them and starts R2 through the normal same-instance controls. Its
empty R1 intentionally produces zero carryover; it is not an event-economy
balance test. All one hundred distinct members enter with independently locked
five-language choices and authenticated HTTP/CSRF/live connections. No quota
counter is reset inside a measured request batch.

Fifty teams submit the same shared bounty through real HTTP. The fixture holds
the oldest result unresolved while later correct results complete through the
normal participant worker. No award may appear until the older result is known
wrong. The second server receipt then wins once, every member receives the shared
claim, and only the winning team's two members receive award animation notices.
Original-key retries return the same receipt; claimed-bounty writes cannot create
another admission. All accepted work must settle, all physical test reservations
must drain, and final R2 must preserve the immutable R1 result.

Initial Linux run `1f7529fd-e09f-44d6-aaee-63b2a6ebdae9` failed its admission
burst with six unavailable HTTP replies. Its checkpoint remained INCOMPLETE and
the controller failure/run identity is retained as `race-load-linux-20261023-v1.log`.
Its detailed startup/report files were subsequently replaced by the next run;
the six refusals above were observed before that replacement. The controller
now also writes exclusive per-run report/log files so future failures survive a
later pass. A later pass does not explain or erase that capacity failure.

The next Linux run `0c700f5c-fa47-4e93-a1bc-c67c58f41df2` passed all six scenario
checks: fifty admitted/assessed submissions, one award, one hundred claim
recipients, exactly one hundred connections and no recorded HTTP refusals or
warnings. Assessment-request-to-all-claim-projections took 4,369 ms. This interval
includes synthetic assessment work and is **not commit-to-claim latency**.
No compiler ran, the clock is synthetic and TLS/public-network effects are absent.
Repeated stable runs, real judge drain, 600 sockets and the mixed-load soak remain
required; this single bounded pass is not the event capacity/latency gate.

A second consecutive bounded Linux pass is run
`5abecf50-a2ed-4339-9597-29ca8ca33ee2`: all six scenarios, one hundred claim
recipients/connections, no recorded HTTP refusals/warnings and 4,119 ms for the
same assessment-to-all-projections interval. Its nonce-specific report and startup
log were written with exclusive creation and remain alongside the latest report.
This does not remove the earlier failed run or replace a mixed-load soak.
