# Build Status and 22 October Target

Updated: 20 October 2026. The user requires the full approved initial application
by 22 October, not a demo, silently reduced MVP or feature-skipping release.
The deadline is a target, not a completion or event-readiness guarantee.

The approved `architecture.md` remains the source of competition rules, scope
and launch gates. Features already explicitly deferred there remain deferred;
this checklist does not introduce further exclusions. No architecture change,
assistant Git operation, additional cloud spending or live launch is authorised
by this document.

## Delivery Method

- Work in larger coherent implementation batches, with a short explanation of
  each completed data flow instead of stopping for every small design question.
- Implement the critical path first, then finish every other required feature;
  ordering is not permission to omit animation, accessibility or admin controls.
- Use synthetic fixtures until real registration mapping and competition content
  are separately supplied/authorised. Never invent an actual team or live bug.
- Test alongside implementation. Passing lab tests does not replace full-app
  integration, security, real capacity and operator-recovery checks.
- The user owns branch changes, commits, PRs, pulls and pushes. Preserve existing
  user edits and completed judge evidence. Do not run historical lab controllers.
- Report a missed requirement or failed gate explicitly; do not call a partial
  app complete because the calendar reaches 22 October.

## Required Feature Inventory

| Area | Current evidence | Remaining required work |
| --- | --- | --- |
| Local API and PostgreSQL | Health/readiness routes and separate restricted API role tested | Production connection/process configuration |
| Registration storage | Reviewed Drizzle migration for teams and two stable member positions; disposable PostgreSQL constraints/repeat/lock tests | Authorised registration import mapping, capacity guards and staff-managed provisioning |
| Access and language lock | Persisted entry, explicit renewal/logout, expiry warnings, staff-approved browser replacement and immutable scoped receipts; Linux clock/secret runtime wiring tested with real PG and synthetic observations | Primary-host runtime rehearsal, participant/staff screens, other qualifying gameplay/draft activity, complete revocation/outbox and scheduled payload/quota cleanup |
| Content and authoring | Private drafts/checker and immutable configuration snapshots; durable validation runs/full check sets, worker/send fencing, evidence binding, retry/poll/deadline/physical-drain accounting and private reports, exercised with a synthetic driver and real PG | Real production driver/supervisor and runtime compatibility, worker runtime/maintenance scheduling, detailed evidence viewer, review/publication, whole-app resource reservations/cleanup and staff screens |
| Participant workbench | Not implemented | Entry, challenge details, Monaco editor, private drafts, penalty-free Run and official Submit with correct capacities |
| Judge boundary | User-reported protected HTTP batch passed: 33 provider rows, 17 new sealed results and one held uncertainty | General production gateway/supervisor, real app adapter/scheduling, remaining security, cancellation, fencing and retirement gates |
| R1/R2 competition | Approved rules only | Independent R1 awards, fixed results/qualification, same-instance R2, wallet carryover, shared earliest-receipt race and automatic penalties |
| Economy and standings | Approved exact integer formulas only | Atomic awards, ledger/wallet, sequential paid hints, R2 hint-tier points and ranking tie-breakers |
| Live state | Not implemented | Authorised Socket.IO delivery, durable outbox, snapshot/replay/reconciliation, teammate presence and no-refresh HUD/claims |
| Staff and round controls | Persisted staff grants, first-Super-Admin setup, Owner/Organiser management, last-admin guard, timing review and immutable receipts; singleton arena creation, R1 draft duration/100-team selection and stale-edit guards; no panel | Exceptional operator Super Admin recovery, remaining permission matrix, full arena lifecycle/qualification, content selection and start/freeze guards, global/team/member pauses, blocks, penalties, finalisation, full audit/live integration and UI |
| Visual arena and accessibility | Not implemented | Three.js roaming differentiated bugs, committed-award effects, minimisable HUD, responsive workbench, equivalent keyboard/reduced-motion navigation and verified assets |
| Hosting and event operations | Isolated judge lab; clock gate, durable incidents/watermarks, authorised clearance and private runtime loader tested with synthetic observations | Actual Linux clock/probe/service-ownership rehearsal, full-app HTTPS/private services, secret installation, monitoring/alerts, verified off-host backups/restoration and deployment |
| Event launch gates | Not completed | Full browser/concurrency/security tests, realistic 100-team load/reconnect/burst testing, recovery rehearsal and validated competition content |

## Current Validation Run Batch

The [validation run queue](validation-runs.md) admits the complete frozen plan
atomically, binds it to a compatible registered worker/host epoch, and tracks
attempts/results with durable leases and one-time send permission. Unknown sends
are observed by the original attempt ID, never blindly repeated. Infrastructure
retries, bounded polling, the fixed ten-minute deadline, sealed results and positive
physical-release evidence are distinct decisions. Uncertain physical work keeps
its barrier after logical completion/expiry. Staff get audited source-free progress
reports, not a manual pass button or automatic publication.

The test driver is synthetic and executes no code. The production transport,
general sandbox/supervisor, actual compatibility certification, worker process
runtime and off-host recovery/load gates remain required. No live worker or host
epoch is installed, so ordinary startup cannot admit unconsumable validation work.
Human review/publication, gameplay, live delivery, UI and deployment are still
unfinished requirements, not features removed from the approved scope.

Verified for this batch: 58 unit tests, 131 PostgreSQL/HTTP/clock integration
checks and four Python clock-probe tests passed without skips. Type checking,
build, unchanged-schema regeneration and dependency audit passed (zero reported
advisories). Tests used only owned disposable PostgreSQL and a synthetic driver;
no untrusted source was compiled, cloud experiment rerun, real host registered,
private environment changed or persistent database migrated. Test containers
were removed. Production safety, browser behaviour and event load remain unproven.

## Validation Preparation Batch

The [validation preparation backend](content-validation.md) captures complete
five-language drafts into immutable byte-preserving snapshots with exact runtime,
checker, hint, test and witness fingerprints. It plans every reference/case and
every declared starter witness, without creating execution jobs or running code.
Two short coordinated transactions surround completeness checks; concurrent edits
produce stale receipts, and duplicate/restarted requests cannot recapture or
overwrite newer content. Typed audits, private response bounds, shared quotas,
active-arena refusals and the catalogue byte guard apply to this stage.

This is not a successful validation report: `can_execute`/`can_publish` stay
false and there is no validation run ID. Production judge admission/execution,
protected evidence/recovery, review/publication, arena start, gameplay/live state,
the participant/admin UI and all deployment/launch gates remain required.

Verified locally for this batch: 53 unit tests, 120 PostgreSQL/HTTP/clock checks
and four Python clock-probe tests passed without skips. Type checking, build and
unchanged-schema regeneration passed; dependency audit reported zero known
advisories. The expanded isolated test suite outgrew its old temporary storage
cap, so its owned disposable PostgreSQL now uses a 512 MiB data tmpfs within a
768 MiB container memory limit. No existing database or cloud resource changed;
the owned test containers were removed. These checks are not real judge,
browser, deployment or event-load verification.

## Content Draft Batch

The [content authoring backend](content-authoring.md) adds private draft pool
records and source-linked commands for metadata, sources, runtime references,
case creation/edit/reorder/retirement, intended-defect declarations and hint text.
Owner/Super Admin permissions, exact-byte bounds, shared staff quotas, stale
revisions, immutable own-receipt recovery and typed private-read audits apply.
Large content operations are authenticated before parsing and capped at two in
flight. No actual competition question/toolchain is provisioned by the tests.

The versioned token/exact-text comparator is implemented and tested. It does not
establish reliable execution, compile/reference/starter results or publication.
Content remains DRAFT with `can_publish: false`; real validation and publication,
global resource reservations, selection/start, live delivery and UI remain work.

Verified locally for the content batch: 47 unit tests, 111 PostgreSQL/HTTP/clock
checks and four Python clock-probe tests passed without skips. Type checking,
build and unchanged-schema generation passed; dependency audit reported zero
known advisories. The tests use synthetic content, runtime records and clock
observations; they are not actual judge, browser, deployment or event-load proof.

## Arena Setup Batch

The [arena setup backend](arena-setup.md) now reserves a single `SETUP` instance
with one Round 1 `DRAFT`. Owner/Super Admin setup commands save a positive
whole-millisecond duration up to five active hours and zero to 100 complete
registered teams against exact configuration revisions. Empty setup is not ready.
Organisers have monitoring access only. Changed configuration invalidates
readiness; duplicate/restarted requests recover the same immutable receipt and
cannot overwrite newer edits. Draft selections grant no live participation.

The API has narrow locking/effect functions rather than direct reservation,
duration or roster-write privileges. Deferred checks bind the reserved instance,
current pointer and source-linked configuration effects. Registration-name
selection is bounded and separately paginated. No start/mark-ready/discard
endpoint, content validation, frozen live roster, outbox, live notification or
admin UI is claimed by this batch; those remain required before event launch.

No existing database, private environment, Git history or cloud lab is changed.

Verified locally for this batch: 41 unit tests, 98 PostgreSQL/HTTP/clock checks
and four Python clock-probe tests passed with no skips. Type checking, build,
unchanged-schema regeneration and dependency audit passed (zero reported
advisories). Owned disposable PostgreSQL containers were removed. These are
synthetic integration checks, not real-browser, cloud-clock or event-load proof.

## First Database Batch

The first batch introduced Drizzle ORM `0.45.4` and Drizzle Kit `0.31.11`, retaining
the existing node-postgres driver and API connection behaviour. Its registration
migration alone does not implement credentials, sessions, rounds or gameplay;
the separate access batch below adds the next persisted layer.

- `teams`: backend UUIDv4 identity, nonblank name bounded to 120 UTF-8 bytes,
  millisecond UTC creation instant. Team names are not unique identity keys.
- `team_members`: stable UUIDv4 identity, required restricted team FK, position
  1 or 2 unique within its team, bounded display name, and supporting `(id,
  team_id)` key for later same-team relationships. Member names may repeat.
- Exactly two members must still be checked by the later roster/start service;
  this schema prevents a third position but does not mistake an incomplete team
  for a launch-ready one. No private registration export or live code is added.
- `db:generate` produces SQL and metadata for review without connecting to a DB.
  `db:migrate` is an explicit **local-only** command requiring a separate
  `MIGRATION_DATABASE_URL` in the private `.env.migration` (or that command's
  environment), an owner role and a session-level migration lock. The API reads
  only `.env`; never put migration credentials in it.
  The API never migrates automatically. The registration migration alone grants
  no runtime access; the later access migration adds explicit registration reads,
  not registration provisioning. Do not use this as a production deployment mechanism
  until the required arena/drain/backup gates are implemented.
- Generated SQL is tracked with LF endings. No destructive reset, schema push,
  existing development DB change, cloud command or judge rerun is part of this
  batch. The real migration test creates and removes only its own labelled,
  memory-backed PostgreSQL container on a random loopback port.

Commands from the repository root:

```powershell
npm run typecheck
npm test
npm run build
npm run test:db:schema
npm run db:generate
```

Do not run `db:migrate` merely to try it: review
`apps/api/drizzle/0000_registration.sql` and deliberately supply the local owner
URL first. Existing `.env`/`.env.database` files and persistent data are preserved.

The schema test covers actual PostgreSQL constraints, duplicate display names,
UUID generation, extra/duplicate member slots, missing team references,
restricted deletes, UTF-8 byte limits/NUL refusal, millisecond precision,
repeat migration without data loss, restricted API privileges and migration-lock
contention. A deliberately conflicting table also verifies transactional rollback:
no partial member table or successful migration receipt remains, and the existing
test row is preserved. The registration importer remains unimplemented; the
subsequent access-service checks are described below.

Verified locally for this batch: 16 unit tests, six real PostgreSQL integration
checks, TypeScript checking and build, unchanged-schema regeneration and an npm
audit with zero reported advisories after the scoped override. Test containers
were stopped/removed; existing database services, secrets and data were not
changed. A clean dependency audit is not a complete application security review.

The migration tool's legacy loader otherwise pulls an older esbuild affected by
[GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99).
A scoped npm override pins that loader's esbuild to `0.25.12`, the same patched
family already used by Drizzle Kit. Generator, compilation and DB tests must
pass with the override; never apply an unreviewed `npm audit fix --force` downgrade.
Drizzle Studio/development servers are not started or exposed by this setup.

Tooling references: [Drizzle/node-postgres](https://orm.drizzle.team/docs/get-started-postgresql),
[reviewed migration workflow](https://orm.drizzle.team/docs/migrations).

## Persisted Entry Core

This is a backend-only batch, not a completed access subsystem or public deployment.
The HTTP adapter described below connects `createEntryService` when `buildApp`
receives explicit security dependencies. Ordinary server startup still leaves
entry routes disabled. The core requires a clock-health dependency and delivery
key; no always-healthy runtime default, real credential, private registration
import or production key is supplied.
Tests use synthetic identities, keys and an explicitly synthetic healthy guard.

Data flow:

1. Verify a strict ASCII Base32 team code against its stored SHA-256 verifier,
   after shared PostgreSQL verification quotas. Reveal only its two registered
   names through a limited, fixed ten-minute proof. A stored staff credential
   selects the staff audience only; it does not create a staff grant.
2. Confirm the registered member and one of the five languages against an already
   selected round roster. Commit the immutable member-round enrolment, one stable
   member slot, hashed session secret, encrypted delivery capsule and original
   outcome together. The two teammates may choose different languages.
3. A concurrent retry or same-proof reload recovery returns the exact original
   still-current cookie, without another grant or renewed deadlines. `jose` JWE
   uses `dir`/`A256GCM` and exact flow/session/member-round/credential/version/expiry
   binding; a missing key, invalid proof or mismatched capsule fails closed.
4. Session reads check the current slot, code/version, blocks, eight-hour absolute
   and two-hour idle deadlines. Reads and recovery do not renew activity. Expiry
   equality is expired. Re-entry after logout/expiry still needs the later approved
   organiser replacement path, not code/name-based takeover.
5. First entry on a separately prepared Round 2 roster permits a new language,
   revokes the prior grant and purges its old delivery capsule. This is not a
   Round 2 start/qualification implementation; those controls must validate the
   final Round 1 results and funding before such a roster is available.

Files:

- `apps/api/src/access/`: strict credential formats, temporary JWE delivery,
  bounded coordinated transactions, exact integer quota refill and entry service.
- `apps/api/src/db/access-schema.ts` and migrations `0001_access_core.sql` /
  `0002_access_guards.sql`: supporting access/roster anchors, composite ownership
  keys, immutable source/deadline/language rules, deferred activation bindings and
  explicit runtime privileges. They are not the complete competition schema.
- `apps/api/test/access-credentials.test.ts` and
  `apps/api/test/integration/access.checks.ts`: synthetic unit/security checks and
  real concurrent PostgreSQL checks through the existing disposable DB harness.

The HTTP adapter now covers exact-origin and maintained CSRF/cookie adapters,
explicit DTO/error projection and shared ingress/read quotas. Remaining before
ordinary browser entry is enabled: trusted clock monitoring and runtime secret
wiring; staff grants and approval handoffs; logout/keepalive; complete atomic
revocation, capsule purge and durable live notifications; bounded expired-capsule/
quota maintenance; actual browser/proxy/TLS and wider security tests.
The service's returned cookie is internal data only, never ordinary JSON for the
browser. Direct fixture updates are not production staff commands or revocation
workflows. No bypass or partial staff login is enabled on the server.

The real DB tests use separate pooled connections for racing activations and code
verification. They check exactly one grant/language, identical recovery after a
service restart, no new outcome after failed encryption, credential/block denial,
no self-service takeover, shared quota debits, immutable history/deadlines,
deferred refusal of broken enrolment/slots/activation sources, restricted runtime
privileges and Round 2 grant retirement. They do not replace load tests, prove
real clock health or prove a browser/TLS deployment is safe. Subsequent adapter
tests below exercise the HTTP boundary using injection, not a real browser.

Verified locally: 22 unit tests and 21 PostgreSQL integration checks passed, with
no skips. Type checking, build and unchanged-schema regeneration passed; the full
npm audit reported zero known advisories. The disposable test containers were
removed. No existing database, Git history, cloud service or judge lab was changed
by this access batch. Passing these checks is not a production security sign-off.

## Secure Entry HTTP Adapter

The optional `entryHttp` Fastify plugin now connects the persisted service to
reviewed `/api/v1` entry routes. `buildApp` accepts explicit pool, clock guard,
JWE delivery and browser-policy dependencies. `server.ts` does not supply them
yet, so a normal `npm run dev` still exposes health/readiness only. Tests supply
synthetic secrets and a synthetic healthy clock; they are not a production
clock-health implementation, event credential provisioning or launch permission.

The browser exchange is:

1. `GET /api/v1/bootstrap?audience=ANONYMOUS` installs a signed, HttpOnly anonymous
   browser context and a separately signed CSRF-secret cookie. JSON contains only
   the non-authorisation CSRF token and diagnostic envelope.
2. `POST /api/v1/entry/verify` sends the private code in its JSON body with exact
   Origin/Referer and the `x-csrf-token` header. Success sets the limited entry-proof
   cookie; JSON exposes only its own two-member selection view and entry-stage
   CSRF token. Staff verification fails closed until staff grants are implemented;
   no role-only or placeholder staff login is exposed.
3. `POST /api/v1/entry/activate` sends only `member_id`, `language`, `request_key`
   and the matching entry-stage CSRF header. The committed participant credential
   is delivered only in `Set-Cookie`, with the original absolute deadline. The
   JSON response contains a safe own-session projection and participant-stage
   CSRF token, never the proof, session secret, verifier or encrypted capsule.
4. `GET /api/v1/bootstrap?audience=ENTRY` validates an existing limited proof and
   restores selection/token context after reload. Protected `POST /api/v1/entry/recover`
   with an empty JSON object redelivers the exact original current grant, never a
   fresh enrolment. `audience=PARTICIPANT` returns the current valid own-session
   view after a shared member-read quota; it does not renew idle activity.

`browser-policy.ts` enforces separate production and loopback modes. Production
requires an exact canonical HTTPS origin and distinct 256-bit signing/CSRF keys.
All application cookies use distinct `__Host-` names, Secure, HttpOnly,
SameSite=Strict, Path=/ and no Domain. Loopback HTTP is an explicit alternative
with distinct development cookie names; it cannot silently weaken production.
The JWE key remains separately supplied to the service and must also be distinct.

The maintained Fastify cookie/CSRF/Helmet packages are pinned. CSRF uses a signed
secret cookie, separate HMAC key, custom-header-only token and context binding to
the audience, protected browser and exact entry/session credential. A token for
anonymous verification cannot activate a member or authorise a participant action.
Origin never uses substring/suffix matching or trusts a forwarded host header.
The current app does not trust forwarded IPs; ingress quotas use its actual peer.
Deployment still needs explicit reviewed reverse-proxy trust configuration.

The adapter rejects unknown application fields, malformed UTF-8/Unicode, unsafe
JSON keys, compressed incoming bodies, duplicate application cookies, oversized
cookie headers and auth bodies over 4 KiB. Explicit response schemas prevent row
or secret serialization. Errors are bounded and do not reflect submitted codes;
unknown infrastructure completion remains UNKNOWN rather than inventing a failed
activation. Trace IDs are server-generated, private responses are no-store, and
ordinary logs redact cookie/token/body/error fields. API-only CSP/header settings
are not yet the frontend's Monaco/Three.js CSP policy.

Shared PG HTTP buckets enforce 12,000/minute burst 600 app-wide and 6,000/minute
burst 400 per actual peer. Authorised member reads use 600/minute burst 30. A new
reviewed `0003_browser_quotas.sql` expands the permitted bucket kinds without
resetting existing credits or touching development data. There is no in-memory
quota fallback. The current entry plugin also bounds active requests to 128 and
returns a transient capacity refusal before another database operation.

Integration checks exercise two-member/language entry, cookie/header flags and
JSON privacy, simultaneous activation, exact-cookie recovery through a recreated
HTTP app, origin/Referer/CSRF and browser-context separation, malformed/oversized
bodies, unsafe keys and query secrets, generic foreign-member denial, original
intent conflict, no takeover, revoked credentials, unavailable time, spoofed
forwarded IPs, shared read quota refusal, 128-request capacity and explicit
loopback operation. The harness closes the HTTP apps and removes only its own
disposable database. No real browser, proxy/TLS, cloud service or judge executes
as part of these tests; those required gates remain open.

With the adapter supplied, `/ready` also checks its clock guard before and after
the database check; `/health` stays non-sensitive liveness. This is not full event
readiness, which still needs the remaining content/judge/backup/runtime gates.

Verified locally after this batch: 28 unit tests and 30 PostgreSQL/HTTP integration
checks passed with no skips. Type checking, build and unchanged-schema generation
passed; the full npm audit reported zero known advisories. All disposable test
containers were removed. No existing development DB, private environment file,
Git history, cloud service or completed judge evidence was changed. The real
clock-health agent, normal-server secret wiring, staff grant/replacement flow and
actual browser/HTTPS/load verification remain required next work, not exclusions
from the approved scope.

## Clock Gate and Runtime Wiring

The next backend batch implements the clock-health consumer, fixed read-only
Linux probe and explicit normal-server wiring described in
`infra/clock-agent/README.md`. It does not install/configure NTP, create a private
runtime file, migrate an existing database or enable participant event traffic.

- `ClockHealth`, immutable clock events and runtime records are added by reviewed
  migrations `0004_clock_health.sql` / `0005_clock_guards.sql`. A detected fault
  persists independently of gameplay rollback; a healthy report cannot clear it.
  Clock event timestamps are labelled observations, not trusted sporting receipts.
- Seven fresh observations spanning at least 30 seconds are required for initial
  trust and after clean restart. An unclean restart is held for review. Evidence
  binds host boot, policy, parent-owned pipe, nonce and increasing sequence; no
  participant/staff credential or public clock-report endpoint is reused.
- Report silence, source/sync/uncertainty failure and observed clock steps close
  the guard. Recovery streaks reset on failed observations. The consumer's own
  local freshness clock includes suspension; no retained wall timestamp proves
  freshness after restart. Hardware execution/calibration remains unverified.
- Access transactions now verify the current clock runtime as well as local
  freshness. Round watermarks reject observed backward candidates and advance
  only with committed new decisions. Reads, duplicate recovery and rollback do
  not advance them. Faults do not automatically pause, close, cancel, revoke
  grants, rewrite receipts or move shared deadlines.
- `server.ts` can construct the protected entry adapter only from an explicit
  private `ENTRY_RUNTIME_FILE` on a restricted Linux service account with the
  reviewed local probe and primary-host loopback PG. No healthy-test fallback,
  browser-selected time, fake production clock or secret-generation shortcut is
  present. Default Windows/local startup remains health/readiness only.
- The fixture suite uses separate fresh databases inside the existing disposable
  test container for fault scenarios. It never clears a recorded fault to make
  another scenario pass. The cloud lab, prior evidence and development DB stay
  untouched.

The subsequent staff batch below adds the staff-authenticated timing-review path.
There is deliberately no SQL/reset or master-code substitute. Full launch still
requires the remaining provisioning, gameplay, deployment and verification gates.

Verified locally after the clock batch: 33 unit tests, 37 disposable PostgreSQL /
HTTP / clock checks and four Python probe-parser tests passed without skips.
Type checking and the build passed. The database checks include fault persistence
after business rollback, stale/replayed reports, clean and unclean restart,
interrupted recovery evidence and an in-flight fault during shutdown. Generated
schema review found no pending changes; the npm audit reported zero advisories.
No existing development database, real runtime secret, Git history, cloud service
or completed judge evidence was changed. Linux/Chrony hardware calibration,
actual browser/TLS deployment and event-load verification remain unchecked.

## Staff Access and Timing Recovery

The common code endpoint now commits a separate protected staff flow for a stored
enabled staff credential. Activation commits one staff slot/session, matching
credential version, immutable intent/outcome, event and JWE delivery together.
Staff identity, role and scope never come from browser claims. Staff, participant
and recovery cookies/CSRF audiences are distinct and may coexist without role
promotion. The delivery encryption binds staff identity, normal/recovery purpose,
incident generation, original flow expiry and the exact granted cookie.

Normal staff sessions have an eight-hour absolute cap, fifteen-minute idle cap
and a two-minute warning instant. Reads, lost-response recovery and duplicate
keep-alive intents never renew activity. A new explicit keep-alive intent can
renew only a still-valid idle deadline. Logout revokes the current grant and
proofs without disabling the identity. A deliberate fresh own-code sign-in fences
the previous browser and purges old redelivery ciphertext. Role/state or code
revocation also invalidates existing staff grants and flows; promotion requires
fresh entry rather than upgrading an old cookie.

New routes under the existing protected entry adapter:

- `POST /api/v1/staff/entry/activate` with a request key; same-proof
  `POST /api/v1/staff/entry/recover` restores the exact current cookie.
- `GET /api/v1/bootstrap?audience=STAFF_ENTRY|STAFF` returns only the appropriate
  own-flow/session projection and CSRF token. It does not renew idle activity.
- `POST /api/v1/staff/keep-alive` with a request key and
  `POST /api/v1/staff/logout` with an empty body require staff-bound CSRF.
- Explicit `/api/v1/staff/recovery/entry/activate`, `/entry/recover`, `/logout`
  plus `STAFF_RECOVERY_ENTRY|STAFF_RECOVERY` bootstrap audiences use separate
  restricted proof/session cookies. They require fresh restored measurements,
  never a bypass during total clock loss or expired-session grace.
- `GET /api/v1/staff/recovery/clock` and
  `POST /api/v1/staff/recovery/clock/clear` are Owner/Super-Admin-only. Clearance
  binds `runtime_id`, positive decimal `generation`, `request_key`, a nonblank
  reason bounded to 1 KiB UTF-8 and the current actor's `own_code` confirmation.
  The code is not stored in its fingerprint, receipt or ordinary logs.

When normal clock trust is held by an incident, common code entry can issue only
Owner/Super Admin recovery flows, and only after seven fresh healthy samples at
five-second intervals spanning at least thirty seconds. Team/Organiser codes
cannot use that path. No recovered normal authority, keep-alive, gameplay, full
admin command or unrelated private read uses the recovery clock. Normal expiry,
credential version, slot and role checks remain mandatory. A successful clearance
creates an immutable typed source linked to the real actor/session/credential,
runtime, incident and report sequence in the same transaction as the effect.
Duplicate current-authority intents return that same receipt without another
effect or activity extension. Direct fault resets without that source fail.

Clearance does not change round state, deadlines, watermarks, scores, receipts or
budgets. The monitor must consume another fresh healthy report before normal
local authority reopens. The recovery-only session stays restricted; deliberately
enter the own staff code again for a fresh normal session. A new fault cannot
reuse the old incident's clearance or recovery scope.

Reviewed migrations `0006` through `0008` add staff records, exact owner/source
bindings, deferred activation checks, immutable history, once-only revocation,
restricted runtime grants and aggregate staff-outcome/active-flow checks. They
were applied only to disposable test data, not the existing development DB.
Staff and team flows share the 1,000-live-flow cap; implemented staff outcomes
share a 100,000-row cap. There is no automatic receipt purge.

The subsequent provisioning batch adds first-Super-Admin setup, normal staff
management and the last-admin safeguard. Exceptional operator recovery, the rest
of the permission matrix, full audit/outbox/cleanup integration and the admin UI
remain required. Tests provision only synthetic staff through disposable data.
No real staff code, privileged public bootstrap or master-code endpoint has been
created, and this batch does not make the app event-ready.

Verified after this batch: 36 unit tests, 47 disposable PostgreSQL/HTTP/clock
checks and four Python probe-parser tests passed without skips. Type checking,
build, unchanged-schema generation and the zero-advisory npm audit passed.
Checks include same-intent concurrency, lost reply/app restart, replacement
rollback, role/code revocation, no-op idle behaviour, audience/CSRF isolation,
own-code timing review, unchanged paused-round state and a new incident before
the cleared monitor's next poll. Test containers were removed. Existing private
environment files, development data, Git history and cloud services were not
changed; actual Linux/browser/load/operator rehearsals remain required.

## Staff Provisioning and Management

The next backend batch adds the operator first-setup tool and Super-Admin-only
Owner/Organiser management described in `docs/staff-access-operations.md`.

- The first Super Admin is created only through an explicit Linux maintenance
  command using a separate local schema-owner configuration. It refuses a prior
  first setup, existing Super Admin, running protected clock runtime or reserved
  arena. It never loads the normal API credentials, migrates, starts a service,
  creates a shared master code or exposes public signup.
- A private exclusive-create, owner-only handoff file outside the repo is flushed
  before commit. It contains a candidate code and exact preallocated IDs, not
  proof of a completed operation. Source-linked status lookup reconciles a lost
  acknowledgement without code readback or automatic new-identity creation.
- Current normal Super Admins may list safe staff metadata and create/update /
  deactivate/re-enable/rotate Owner/Organiser access only. Each new command binds
  own-code confirmation, real actor/session/credential, exact expected revision,
  typed target, bounded reason and a length-prefixed typed SHA-256 fingerprint.
  Super Admin targets/promotion remain outside ordinary HTTP authority.
- Applied create/rotation returns a random code once, never stores its raw value
  and creates a real credential-to-issuance source link. Retries return the old
  immutable receipt with no code; lost delivery requires a deliberate subsequent
  rotation after reconciliation. Stale-version/capacity rejections are durable,
  while unchanged/rejected/duplicate reads do not renew idle activity.
- API credentials retain no direct staff-identity/code writes. A narrow reviewed
  database effect function verifies current actor/target/source and only applies
  the permitted role family. Deferred checks require the matching effect/issue,
  and immutable source/history rows survive later revocation.
- Staff name/role/enabled/code changes invalidate affected old grants, proofs
  and capsules. Coordinated deferred last-admin checks prevent concurrent
  deactivation/demotion/revocation from leaving no enabled Super Admin with a
  current code. Atomic revoke-and-replace can retain that access without a gap.
- Staff-management outcomes join the shared 100,000-row retained staff-outcome
  bound. The 50-enabled-staff guard is enforced before the source decision and
  again in the database effect. Safe lists use at most 50 rows and UUID cursors.

No actual Linux maintenance command, private handoff, event code, deployment or
cloud operation was performed. Reviewed migrations `0009` through `0011` have
been applied only to disposable tests. The actual CLI host/file-permission and
crash rehearsal, additional/replacement/compromised Super Admin recovery, admin
screens, full audit/outbox/cleanup and the remaining event gates are unfinished.
Do not run setup merely to try it against an existing database or bypass a guard.

Verified after this batch: 39 unit tests and 59 disposable PostgreSQL/HTTP/clock
checks passed without skips, along with type checking, build and unchanged-schema
generation. Tests include once-only setup/denied API-role setup, active-service /
reserved-arena refusal, concurrent last-admin changes, atomic code replacement,
one-time delivery/retry, durable stale/capacity rejection, role/audience/own-code
denials, source/effect integrity, current-role receipt reads, name-only revocation,
large escaped bounded prose, 409 projections and stable pagination. Existing
development data, private environments, cloud services and Git history stay
untouched. The actual Linux CLI/private-file and exceptional recovery rehearsals
remain required; synthetic database checks do not prove those host operations.

## Participant Session Controls

The next completed backend slice adds explicit participant keep-signed-in and
logout, plus server-reported five-minute warning timestamps. The HTTP contract
and retry boundaries are in `docs/participant-session-controls.md`.

- Both commands bind the current protected participant cookie, exact original
  session UUID, request key, member-round quota and participant CSRF audience.
  A different session cookie cannot reinterpret an old logout as a new command.
- Keep-alive records actual trusted PostgreSQL time, only while the grant is
  valid. It extends the two-hour idle deadline but never the fixed eight-hour
  absolute deadline. Deliberate renewal works during a pause without changing
  arena clocks or granting paused gameplay permission.
- Logout atomically records its immutable source, revokes that exact grant,
  clears its member slot, revokes the activated entry proof and purges its
  encrypted delivery. It does not revoke the teammate, erase enrolment/language
  or permit another first entry within the same round.
- Same-intent retries and authorised outcome reads return the original receipt
  without fresh activity. A still-held old logout cookie has only a narrow
  same-receipt retry/read exception before its original security expiry and
  while its code/access remain valid; it never regains participant authority.
- A new immutable source table has a real session FK and deferred effect checks.
  Database guards reject source-free activity/logout and prevent renewal at an
  expired idle/absolute boundary. Source/effects roll back together on failure.
- Session outcomes share the existing four-million processed-outcome ceiling
  with entry outcomes; commands use the approved 60/minute, burst-six budget
  keyed by stable member-round. Reads use the separate member-read budget.

Migrations `0012` and `0013` are for reviewed owner application, never startup
auto-migration. Staff-approved replacement, expiry/logout warning screens,
other gameplay/draft activity sources, live revocation notices and scheduled
cleanup remain required. This is not a participant-ready login UI or launch.

Verified after this slice: 40 unit tests, 71 tests in the disposable
PostgreSQL/HTTP/clock suite and four Python probe tests passed without skips.
Type checking, build and unchanged-schema generation passed; npm audit reported
zero vulnerabilities. Checks include duplicate/restart response recovery,
immutable receipt lookup, concurrent logout/keep-alive, expired-grant refusal,
absolute-deadline capping, pause behaviour, direct-write source/effect guards,
shared quotas, current blocks/code revocation, exact-target Round 2 protection,
CSRF/audience binding and request limits. Owned test containers were removed.
No existing development database, private runtime file, cloud service, real code,
Git branch or history was changed. Real browser and primary-host operation,
full-capacity testing and the other launch gates remain unverified.

## Staff-Approved Participant Replacement

The browser-replacement backend is now implemented; its HTTP flow and operational
boundaries are in `docs/participant-replacement.md`. This supersedes the earlier
batch notes which correctly listed replacement as then-unimplemented.

- A verified ordinary entry proof and enrolled registered member may create at
  most two outstanding requests. Creation leaves the old session alone and
  issues a separate protected proof with one original ten-minute deadline.
  Matching retries recover that same encrypted proof without a new request.
- Current normal Organiser, Owner or Super Admin authority may approve/reject
  the specific request with a bounded verification reason and exact observed
  slot revision. A rejection preserves the grant; approval revokes its observed
  old grant, purges its delivery and reserves exactly this browser's handoff.
  Routine replacement does not ask for own-code sensitive-action confirmation.
- Redemption rechecks current proof/code/access, round availability, the exact
  reservation and original expiry. The new session inherits the existing
  member-round/language. Concurrent retries and lost replies recover one exact
  cookie from the existing encrypted-delivery mechanism with a distinct purpose.
- Applied/rejected staff decisions have real actor/session/credential/request
  references, typed immutable receipts and coordinated source/effect checks.
  Current staff authority is still required on retries and receipt reads.
- Stale competing requests are retired atomically. Logout and first Round 2
  entry also retire affected handoffs; all affected old/new rounds are gathered
  before member locks, including handoffs whose old session slot is empty.
  Neither an expired approval nor an old response restores a revoked grant.
- Deferred constraints bind first-entry and replacement grants to their own
  distinct source families, enforce one approved reservation and preserve the
  immutable original enrolment. Slot changes require the next revision.
- Replacement flows join the shared 1,000-live/eight-per-credential flow bounds,
  their own 50,000-retained flow family, existing session/outcome ceilings and
  shared member/staff quotas. No new dependency or application Redis was added.

Reviewed migrations `0014` and `0015` have been exercised only in disposable
databases. The user still owns all Git operations and real migration/deployment
decisions. Screens, authorised live revocation/status delivery, scheduled
expiry/ciphertext/quota cleanup, exceptional Super Admin recovery and the rest of
the approved app/launch gates remain required. No actual event credential,
private runtime configuration, existing database or cloud service was changed.

Verified after this batch: 41 unit tests, 87 tests in the disposable
PostgreSQL/HTTP/clock suite and four Python probe tests passed without skips.
Type checking, build and unchanged-schema generation passed; npm audit reported
zero vulnerabilities. New checks cover concurrent request/approval/activation,
lost replies and restart, exact redelivery, rejection, empty-slot recovery after
logout, expiry before/after approval, stale approvals after a later replacement,
foreign proofs/member IDs, immutable source/effect bindings, encryption rollback,
current staff/code/block/clock authority, distinct cookie/CSRF/JWE purposes,
bounded HTTP payloads and retirement of an approved R1 handoff on first R2 entry.
Owned test containers were removed. No real browser/host, load, live notification
or production deployment rehearsal is established by these synthetic tests.

Package references: [Fastify cookie](https://github.com/fastify/fastify-cookie),
[CSRF binding/configuration](https://github.com/fastify/csrf-protection),
[security headers](https://github.com/fastify/fastify-helmet).
