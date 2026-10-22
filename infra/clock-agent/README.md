# Primary-Host Clock Gate

This is application code and an operator handoff, not permission to provision a
VM, change NTP, deploy the event or run another historical judge experiment.
The primary application/PostgreSQL host is the target, **not the isolated judge**.
The actual Linux/chrony/cloud setup still requires a separate rehearsal.

## Why These Clocks Exist

PostgreSQL remains the clock that timestamps a decision. The probe only checks
whether the primary host's clock is trustworthy; it never supplies a replacement
receipt timestamp. A suspend-inclusive monotonic clock acts like a stopwatch:
it detects clock steps and report silence without assuming the wall clock is
correct. None of this pauses an arena, moves a closing time or resets a session.

## Data Flow

1. The API launches the fixed root-owned `probe.py` through the fixed protected
   `/usr/bin/python3`, in isolated/no-bytecode mode. Its minimal environment has
   no database credentials or browser keys. No shell, participant input, dynamic
   command or public reporting endpoint is involved.
2. The probe uses only chrony's read-only `tracking` and `sources -a` monitor
   commands over localhost. It requires the sole configured source to be selected
   Google internal time, and reports bounded integer offset/uncertainty values.
3. Each report binds policy version, host boot ID, a new parent-generated nonce
   and increasing sequence. The private parent-created stdout pipe and protected
   executable/source path establish provenance, independently of all web codes.
   The probe shares the service UID; this is not a sandbox against an OS/operator
   compromise. It receives no application credentials in argv or environment.
4. The API checks bracketing/freshness before committing `ClockHealth`, run and
   immutable event records under security coordination. Business transactions
   also verify the current clock runtime under a shared clock-row lock. An old
   API process cannot rely on its cached healthy state after replacement.
5. Enabling the guard requires seven fresh observations at least five seconds
   apart and spanning at least 30 seconds, also after a clean restart. A retained
   healthy DB row alone never enables a restarted process.

## Policy

- Warning when absolute reported offset exceeds 50 ms; fault when the estimated
  absolute error bound exceeds 100 ms, or sync/source checks fail.
- A wall-clock step of at least 100 ms, monotonic reversal, or report silence
  reaching 15 seconds is untrusted. Ambiguous step evidence also fails closed.
- Clock reads are bracketed; policy v1 refuses a bracket wider than 20 ms or an
  end-to-end probe measurement over two seconds. These conservative implementation
  bounds need host calibration; they are not a Google timing SLA.
- The Linux consumer uses `/proc/uptime` with a conservative 10 ms uncertainty
  allowance. The Python probe uses `CLOCK_BOOTTIME`. Report freshness includes
  suspension, not only API-process CPU/active time.
- A fault immediately closes the local guard, then persists independently of a
  rolled-back gameplay/entry transaction. Duplicate fault reports do not create
  duplicate incidents. Failed persistence keeps the guard closed.
- Unacknowledged/unclean API restart is conservatively held for review. A clean
  shutdown records its stop only after pending faults are persisted. Shutdown
  failure preserves the old running marker instead of claiming a clean stop.
- Healthy observations after a fault accumulate review evidence but never clear
  the latch. Failed observations interrupt that streak. The first incident reason
  and generation remain immutable in this batch.

The round's trusted-time watermark advances only with a committed new normal
decision, not reads, duplicate-cookie recovery or rolled-back work. A backward
candidate fails closed and records a clock incident. Neither code nor a trigger
can lower the retained watermark to make a retry pass.

## Explicit Runtime Wiring

Normal Windows/local development still starts the health/readiness foundation.
Event entry is opt-in through `ENTRY_RUNTIME_FILE`, pointing to an absolute private
file outside Git. `entry-runtime.example.json` contains deliberately invalid
placeholders, not working credentials. No real runtime file is created here.

The runtime loader requires a non-root Linux service account, primary-host
loopback PostgreSQL, a private owner/root-owned regular file with no group/other
permissions and three independent 256-bit keys: cookie signing, CSRF HMAC and JWE
delivery. Production requires a canonical HTTPS origin; explicit loopback mode
uses separate development cookies. Unknown fields and clock-bypass options fail.
Keep the real `entry-runtime.json` outside the repository; its name is ignored as
additional protection, not a secret-management substitute.

The shared loader now also requires protected real parent directories, a
single-link regular file and unchanged opened-file identity. FIFOs/devices and
symlinks are rejected before reading. Competition and the separate app-side
judging process use distinct private files; see
[judging runtime](../../docs/judging-runtime.md). The API owns this monitor;
the worker consumes its reports with independent freshness and cannot clear
faults or replace this monitor's runtime.

The deployed API code, probe, interpreter and their resolved parent directories
must be root-owned and not group/other-writable. The probe runs as the API's
restricted UID and cannot configure chrony through its selected monitor channel.
Copy the reviewed probe alongside the application layout; compiling TypeScript
does not itself install the probe, Python, chrony, TLS or secret files.

Enabled entry uses 12 API connections and two monitor connections. Missing
migrations, invalid permissions/keys, unsupported platform or unavailable probe
fail closed; the server never auto-migrates or installs packages. Readiness then
checks the current guarded clock record and database, but still does not replace
the full event content/judge/backup/readiness gates.

## Staff Timing Review

The protected entry adapter now includes a restricted recovery path after seven
fresh healthy observations spanning at least thirty seconds. During a latched
incident, common code entry accepts only a currently enabled Owner/Super Admin
credential for that restricted scope. Activation and bootstrap use distinct
recovery cookies and CSRF binding; normal staff/participant grants never inherit
this permission. No entry or expired-session grace is available while restored
measurements themselves are untrusted. Operators must repair the host first.

The authorised recovery session may inspect `/api/v1/staff/recovery/clock` and
submit `/api/v1/staff/recovery/clock/clear` with its own CSRF token, actor's own
code, exact runtime/incident generation, request key and bounded reason. The
immutable clearance source and clock effect commit together. Another staff code
cannot switch the actor. Duplicates recover the same source without renewing
activity; generations and time watermarks never reset. A new fault still closes
both guards and cannot reuse the earlier clearance.

Clearance leaves all arena states/deadlines/results untouched. Normal authority
reopens only after the monitor reads another fresh healthy report. A recovery
session does not become normal: fresh own-code entry is required for a full
staff session. Do not delete clock rows, disable triggers, lower watermarks,
manually set HEALTHY or use process restart as fault clearance.

## Still Required

First-Super-Admin setup and normal Owner/Organiser management now have a reviewed
backend implementation; see `../../docs/staff-access-operations.md`. Exceptional
operator recovery, the admin interface and the other event gates remain
unimplemented. Tests create only synthetic staff in disposable databases, not
working event credentials.

The actual primary-host chrony configuration, service ownership, probe execution,
suspend/restart behaviour, hardware thresholds, monitoring/alerts and HTTPS/load
rehearsal remain unverified. Current tests use synthetic observations and real
disposable PostgreSQL, plus independent Python parsing tests. No NTP service or
cloud resource is modified by those tests.

References: [Google internal time configuration](https://docs.cloud.google.com/compute/docs/instances/time-synchronization/configure-ntp),
[chrony monitor/CSV and error bounds](https://chrony-project.org/doc/4.2/chronyc.html),
[suspend-inclusive Python clock](https://docs.python.org/3/library/time.html#time.CLOCK_BOOTTIME).
