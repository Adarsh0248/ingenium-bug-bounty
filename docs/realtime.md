# Live Competition State

This batch implements the realtime backend and a browser-independent client
controller. It does not implement the React arena, HUD, editor or admin panel.
It does not install or enable the cloud judge.

## How It Works

1. Existing protected HTTP commands still perform every durable action. A socket
   cannot submit code, buy a hint, award points, renew a login or pause a round.
2. Database triggers append small, typed, source-linked notifications in the
   same transaction as the source change. Each permitted stream has its own
   consecutive committed sequence. Rollback rolls back its sequence and budget.
3. A participant receives their round, team and member streams. Staff receive
   role-safe operations and their own control stream, optionally a selected
   round. Only current Super Admins receive the security-management stream.
4. Authenticated delivery wakes from PostgreSQL every 250 ms, in bounded batches
   with at most six recipient transactions in parallel. It rechecks current
   session, grant, role, access blocks and scope under the existing security
   locks before private enqueue. Database state remains authoritative.
5. The client refreshes one coherent projection after an invalidation. Wallet,
   score, standings, claim availability and hints are read together, not patched
   with browser-side additions or deductions. Only an observed own-team award
   can produce a deduplicated win animation; a rival claim is a different event.

R1 awards and official work are team-private. Samples are member-private. An R2
claim is round-visible so a rival editing that bounty can see it disappear.
No notification contains source code, hidden cases, hint text or another team's
wallet. Staff operations notifications do not carry credential verifiers.
Official per-case progress stays staff-only, including its invalidations, so
participants cannot count messages to discover hidden-suite progress.

## Connection And Recovery

The API must have the existing explicit entry security dependencies installed.
Without them, normal startup exposes no live routes, just as it exposes no entry
routes. No new environment secret, automatic migration or database is introduced.

Participant routes use `/api/v1/live`; staff use `/api/v1/staff/live`:

| Protected POST | Request | Purpose |
| --- | --- | --- |
| `/tickets` | `{}`; staff may supply `round_id` | One-use, ten-second ticket bound to current browser, cookie and audience |
| `/snapshot` | `sync_id` | Consistent permitted state and stream heads S |
| `/replay` | `sync_id`, `stream_id`, decimal `after` | Up to 100 retained events/256 KiB through captured barrier H |
| `/projection` | READY `sync_id` | Refresh the coherent current view after an invalidation |

All four routes use the existing Origin, audience-bound CSRF and shared read
quotas. Tickets are not standalone login credentials and never belong in a URL.
Staff cannot select arbitrary participant/private streams.

Socket.IO uses namespace `/live`, path `/api/v1/live/socket`, and **WebSocket-only
transport**. The reverse proxy must support WebSocket upgrades on that path.
Supply the ticket in `auth: { ticket }`, same-origin cookies, `autoConnect: false`
and `reconnection: false`, with `forceNew: true` for its owned transport.
Register listeners before connecting. The controller
obtains a new ticket and connection after failure rather than replaying an old
authentication or offline command buffer. No Redis application adapter is used;
this initial deployment supports one API/live process, not multiple replicas.

The server registers its bounded buffer before issuing `sync`. The protected
snapshot acquires shared SecurityControl, ArenaControl, sorted Round and stream
coordination locks, then reads state and S in that same transaction. Replay
captures H after that snapshot and requires consecutive sequences through H
before READY. Source/effect revisions are opaque decimal strings, never lossy JS
numbers or a globally filtered audience cursor.

The server reconciles authenticated heads at least every five seconds. Thus a
lost final event is detectable even without another event. The controller marks
state stale and disables its write-ready flag after ten seconds without a valid
head. A gap, missing retained prefix, schema/scope mismatch, overflowing buffer,
expired ten-second sync or process restart requires a fresh snapshot. None of
these failures pauses competition time. Editor source is owned separately by
the workbench and is never replaced by a live-state installation.

Use `src/live/client.ts` from the future frontend with its authenticated HTTP
wrapper and Socket.IO transport. `edit(bountyId)` announces a real opened editor;
`edit(null)` clears that tab. `close()` releases listeners/timers by disconnecting
its owned transport. The caller must use `replica.writable()` for write controls.
The controller coalesces projection refreshes and ignores stale sync generations.

## Presence And Bounds

- At most three sockets per current participant session and two per staff session.
  They do not create new member slots or change a member's locked language.
- One editor intent per socket. The client renews it every 15 seconds; the server
  expires it after 45 seconds without an accepted renewal. Tabs aggregate by
  member and bounty, visible only to the same team, including paused state.
- Presence rechecks both announcing and receiving authority. Claims, closing,
  cancellation, revoked access and disconnect deactivate ineligible intentions.
  Restart clears presence; resuming clients reannounce eligible opened editors.
- Presence, head checks, tickets, snapshots and replay never extend security idle
  time or create a durable presence heartbeat, economic effect or activity row.
- Each connection retains at most 256 unacknowledged events or 512 KiB. A slow
  consumer must resynchronise. Acknowledgements do not award money, release a
  login or delete canonical competition history.
- Each event is at most 16 KiB including its bounded metadata. Replay pages are
  at most 100 events/256 KiB. A snapshot/projection is at most 1 MiB.
- The delivery budget charges the complete 16 KiB ceiling for every committed or
  reserved delivery. This conservatively enforces 4 GiB and stays below the
  two-million-row ceiling; ordinary work cannot consume the last 256 MiB.
  Official/sample/validation admission reserves 1024/256/2048 deliveries. Terminal
  official parents retain a small tail for deferred scoring until arena closure.
- Maintenance removes only old published prefixes, retaining at least the latest
  15 minutes during play and the owning arena's streams until 24 hours after its
  terminal transition. Heads never rewind. Unreferenced delivery-only effect
  metadata is removed with bounded cleanup; canonical source histories remain.

## Verification And Remaining Gates

Unit tests cover consecutive/deduplicated replay, schema/scope/history failures,
stale authority, buffer overflow, lossless cursors and award-animation deduplication.
Disposable PostgreSQL plus real loopback Socket.IO tests cover HTTP/CSRF binding,
transaction rollback, control reserve, cross-team/member privacy, tab caps,
concurrent snapshot changes, hints/awards/status, pauses and editor expiry,
client refresh/reconnect/lost-final-event recovery, role revocation, clock faults,
overflow and process replacement without score loss.

Run the focused service suite with `INGENIUM_TEST_SUITE=live` and
`npm.cmd run test:db:schema`; remove that temporary environment variable before
the full suite. Neither command migrates the development database.

Browser UI/accessibility, actual proxy/network compatibility, realistic
100-team burst/reconnect load, installed judge runtime, whole-app storage
accounting and operator deployment/recovery rehearsals remain launch gates.
Do not infer event readiness from these local synthetic-judging tests.

References: [Socket.IO middleware](https://socket.io/docs/v4/middlewares/),
[delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/),
[server options](https://socket.io/docs/v4/server-options/).
