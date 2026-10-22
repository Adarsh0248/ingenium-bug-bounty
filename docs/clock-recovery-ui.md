# Restricted Timing Recovery

The common code-entry screen can open a restricted timing-recovery view for an
Owner or Super Admin after the primary clock monitor has obtained seven fresh
healthy samples spanning the approved thirty-second recovery window. The normal
clock-fault latch remains closed until an authorised clearance is committed.
Organisers and participants have no timing-clearance authority.

This is not host-time repair, a way around clock readiness, or lost/compromised
Super Admin credential recovery. Operator-only credential recovery and the real
Linux clock/runtime installation remain separate unfinished work.

## Flow

1. Correct the primary host's time through the approved host procedure, outside
   the website. A browser cannot set system time, manufacture healthy samples,
   reset the monitor or edit a trusted-time watermark.
2. Use the normal code-entry page with the acting Owner/Super Admin's own code.
   During a latched incident, the server can issue only its restricted recovery
   flow, using separate cookies and CSRF audience. A previous normal-session
   cookie cannot hide an available recovery flow behind a generic offline page.
3. Review the runtime, incident generation, measured-health state and fault
   latch. The server's existing recovery guard verifies sample freshness and
   the healthy window on each protected request. Polling does not renew idle
   expiry. The displayed expiry follows the server's current session deadline.
4. **Review clock clearance** opens a confirmation tied to that exact runtime
   and incident. Enter an audit reason and the same staff identity's current
   code. A stale incident, foreign code, revoked session or unsafe clock cannot
   clear it. A wrong confirmation clears the password field, not the review.
5. The existing backend records one immutable clearance and clears only that
   reviewed fault latch. It does not resume the round, adjust its deadline,
   grant bounty, alter source/results or promote the recovery session.
6. After the normal monitor accepts clearance, explicitly sign out and sign in
   normally. The entry screen obtains a fresh anonymous request token before
   verifying another code. A fresh normal grant is required for the control room.

The existing fifteen-minute idle and eight-hour absolute staff-session limits
apply. The view shows the two-minute warning, but the browser countdown is not
authority. Background reads and duplicate recovery never extend those limits.
A newly latched incident invalidates an older incident's recovery grant; a
previous clearance cannot clear the new generation.

## Lost Replies

The review uses the existing one-shot command controller with the distinct
STAFF_RECOVERY audience. An uncertain clearance retains its original request
key in the open page and removes the one-shot confirmation code from retained
command state. **Check clearance outcome** makes a GET-only lookup of the acting
staff identity's original receipt. It never repeats the clearance POST or reads
back the staff code. Unresolved clearance blocks closing the review or signing
out. Refreshing/closing the tab loses this in-memory command handle; this is not
cross-reload command recovery.

An uncertain sign-out also requires checking current recovery authority before
another deliberate sign-out. It never automatically replays the POST. Session
revocation/expiry clears the private screen and requires fresh entry.

## Routes and Privacy

- `GET /api/v1/staff/recovery/clock` returns safe health/incident metadata and
  current session expiry/warning times, not the raw timing report.
- `POST /api/v1/staff/recovery/clock/clear` keeps the existing own-code, reason,
  runtime, generation and request-key contract.
- `GET /api/v1/staff/recovery/clock/outcomes/:request_key` returns OBSERVED with
  that actor's original clearance, or NOT_OBSERVED. It grants no write authority
  and does not renew idle time.
- Existing restricted activation, bootstrap and logout routes are unchanged.

All responses remain no-store. POSTs retain exact-origin/CSRF checks and shared
quotas; outcome reads recheck current session, credential, role and recovery-clock
authority. Specific CLOCK_UNTRUSTED errors preserve the existing 503/UNKNOWN
classification without exposing a private cause or authorising a write retry.
No new tables, migrations, dependencies or runtime-readiness bypass were added.

## Verification Boundary

The focused real React/Fastify/PostgreSQL browser test covers an old normal cookie
during a fault, restricted entry, wrong own-code confirmation, a committed
clearance whose response is lost, GET-only recovery, preserved paused-round
state, unchanged read activity, interrupted sign-out, fresh normal sign-in,
read-only recovery restoration after reload, new-incident invalidation and
desktop/mobile overflow checks. Backend checks cover receipt scope, malformed
keys, no-store responses, unchanged idle activity, foreign-actor absence and
immutable clearance history.

Verification: 252 unit/client tests, all 255 full disposable PostgreSQL checks
and all six checks across the complete normal/recovery browser suites passed.
Typechecks, both production builds, formatting and the bundle-boundary check
passed. Desktop/mobile screenshots were inspected. The recovery flow also
refuses clearance during a lost status read and clears that warning after a
fresh read, independently of a wrong-code confirmation error.

These tests use disposable databases and synthetic clock observations, not the
actual primary host. Real clock/probe installation, runtime scheduling, host
repair/recovery rehearsal and event launch gates still require verification.
