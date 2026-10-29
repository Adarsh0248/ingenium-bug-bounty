# Staff Control Room

The first normal-staff control room connects the existing competition APIs to
the React app. Additional visual polish is deferred while functional delivery
continues. The approved architecture and required features are unchanged.

## Connected Flow

1. A normal staff session opens the control room through the existing code entry
   and bootstrap flow. Exceptional recovery sessions remain in their restricted
   [timing-recovery view](clock-recovery-ui.md), not this panel.
2. Setup selects registered teams and a whole-minute duration from 1 to 300.
   Creating Round 1 reserves the singleton arena. Published-bug selection uses
   reviewed immutable snapshots, with at most 40 bugs and one version per family.
3. An Owner or Super Admin can prepare and start the round, pause/resume everyone,
   one team or one member, close the round and finalise its results. Sensitive
   commands require the operator's own code and an audit reason. Start still
   requires genuine backend readiness; the UI cannot override it.
4. Round 1's fixed result can be qualified. Round 2 setup selects only from that
   locked qualified roster, at most 50 teams, in the same arena instance. It has
   its own duration, compatible bug selection and controls.
5. Final Round 2 results complete the instance. Its bookmarked `?arena=<UUID>`
   remains read-only after reload; creating a new arena is a separate action.
   This URL contains an instance ID, never a code or session credential.

Organisers can monitor but cannot operate the controls. Both the browser and the
backend enforce their respective permission boundaries; hiding a button is not
the security check.

The [Staff and Access views](staff-access-ui.md) add Super Admin management of
Owners/Organisers and routine browser-replacement support for all normal staff.
They retain their separate backend permissions and do not grant Organisers round
control or staff-management access.

The [Judging view](staff-judging.md) adds filtered queue/status monitoring, safe
job/dispatch timelines and Owner/Super Admin recovery decisions. It reuses the
existing guarded extra-dispatch command and GET-only lost-reply recovery. It
does not expose participant source, hidden tests or raw judge diagnostics.

## State and Commands

- The bounded staff-only control-room projection contains instance/round
  revisions, selected published-bug metadata, rosters and stable participation
  IDs. It does not expose credentials, source, reference answers or hint bodies.
  The separate published-bug listing is filtered by round and paginated.
- The existing authenticated live stream supplies pauses, standings and recent
  judging. Live invalidations refresh control metadata. Stale/disconnected state
  disables commands; the server remains the authority for all effects.
- Unsaved selections retain the revision they were edited against. A concurrent
  change is rejected rather than silently overwritten. Discarding local changes
  reloads verified state; switching views warns about unsaved selections.
- A command gets one request key and one POST. If its response is lost, all
  further commands are blocked while the original receipt is checked by GET.
  Confirmation codes are cleared after dispatch and are not needed for receipt
  recovery. No unknown command is automatically resubmitted.
- A background metadata refresh does not flicker-disable already verified
  controls. Commands still carry their observed revision. While a write or
  receipt check is in progress, its waiting status is distinct from an unknown
  outcome and further commands remain blocked.
- Session expiry, keep-alive and sign-out use the existing protected session
  contracts. No browser-owned scoring, financial effect or claim is introduced.

## Verification and Local Use

For an interactive local admin and contestant session, use
`npm.cmd run preview:app` and follow the [local preview guide](local-preview.md).
It opens port 5175 with temporary demo accounts, a separate database and simulated
judging. The existing participant-only preview on 5174 remains independent.

`npm.cmd run test:browser:db` runs the real React/Fastify/Socket.IO flow with
synthetic identities and a disposable PostgreSQL database. It checks participant
draft privacy/pause/reload, the normal staff two-round lifecycle, singleton
reservation, qualification, scoped pauses, Organiser restrictions, lost-response
recovery without duplicate writes, historical reload and stale-edit rejection.
Read-only route validation and participant/staff separation are also checked.
Desktop and mobile screenshots are written under `apps/api/test-results/`.
The test owns and cleans its database and servers, not the development database.

The original arena-control batch passed all four real-backend browser checks, all twelve
participant browser scenarios, 232 API plus nine web client unit/transport tests
and all 225 backend integration checks. Type checks, both production builds and
the production bundle boundary check also passed. The build still reports large
lazy 3D/editor chunks; realistic device/load calibration remains required.

The loopback participant preview is still an in-memory visual fixture. It is not
a staff backend or an installed judge. Normal API startup remains health/readiness
only until its reviewed runtime dependencies are connected. This panel must not
be presented as a working public deployment or a production judge bypass.

## Remaining Work

This is the normal arena-control slice, not the complete admin application.
The normal [Bug Library](content-authoring-ui.md) covers draft authoring and
preparation; [validation history and publication review](content-validation-ui.md)
connect their protected commands. Registration/import, discipline, cancellation,
timing recovery, participant history and normal judging/recovery views now have
local UI/integration evidence. Exceptional operator credential recovery and
remaining purpose-specific diagnostic/audit integration still need work.
Production runtime/maintenance, real
judge installation, retention/resource guards, HTTPS deployment, backup recovery
and realistic event-capacity tests remain required. No development migration,
cloud operation, architecture edit or assistant Git mutation is part of this batch.


## Admin setup usability update — 29 October 2026

All normal Organiser, Owner and Super Admin sessions can manage teams, question
authoring/validation/publication and normal arena setup/lifecycle. Migration
0088 updates the matching named database guards without changing session,
clock, receipt or launch-readiness checks. Super Admin staff
management and separate incident/discipline/recovery powers remain restricted.

The main navigation now exposes Arena setup, Teams and Questions directly.
Secondary monitoring/support tools sit under More controls. Teams has a visible
Add team manually form with two member names;
CSV import remains available. Questions has a visible manual builder, direct
draft saves, four event languages, progress counts and explanations for starter
code, private solutions, tests and publication.

Creating an arena saves a draft. Its duration and roster remain editable in
DRAFT/READY before launch; a changed ready setup returns to DRAFT for a fresh
check. Save actions reload the authoritative revisions and keep the setup view
open. No arena, enrolment, score or source history is reset.

Routine setup/question saves automatically record a contextual reason. Optional
notes remain available on team/question forms; sensitive lifecycle and credential
operations retain confirmation. This removes repeated typing, not the audit
history or unknown-outcome recovery.

The organiser also approved session-based action authorization. After signing in,
normal staff actions use the active authenticated session and current credential
binding; no raw access code is cached or resent by the browser. Existing session
expiry, role/revocation checks, CSRF, audit records, request keys and database
authority checks remain enforced. Legacy clients may still send a code, which
must be correct if supplied. Exceptional clock recovery keeps explicit code
verification. Routine saves need no confirmation; destructive or sensitive actions
retain a clear confirmation step without another code field.

Verification: 367 API and 92 web unit checks, type checks and production builds
passed. Disposable PostgreSQL suites passed 145 foundation checks, 29 validation
and diagnostic checks, eight team checks and nine import checks. Real Chromium
covered the new regular-admin setup workflow, Super Admin staff creation without
code re-entry, desktop/mobile layout, and the complete existing two-round browser
flow including registration, discipline and cancellation recovery. Synthetic judge
fixtures in these checks do not qualify a production judge or real event capacity.
