# Ingenium Bug Bounty

A gamified bug-fixing competition platform for Ingenium, the college technical festival module.

## Status

Current update, 25 October: roughly **91%** complete; event deployment remains on
hold. Individual real executions pass for all five languages, and the approved
6-CPU/24-GiB test VM is running the five-hour concurrent judge rehearsal. The
endurance, real full-round integration and measured event-capacity gates remain
open. See [current verification evidence](docs/build-status.md) for the latest
status; percentages and pending statements in the historical batches below refer
to their original dates. `npm run build:release` creates an offline application
candidate with a SHA-256 inventory; it does not deploy or certify readiness.

Delivery target: **22 October 2026**, with the complete approved initial scope;
no additional features are silently dropped. See the current
[build and launch checklist](docs/build-status.md). The target is not a readiness
guarantee, and required security/capacity/recovery gates still apply.

Latest implementation batch: [private operations observation](docs/operations-observation.md)
adds bounded Owner/Super Admin counters, stale/unknown warnings, an offline
read-only observer and original-receipt recovery inventory. Linux-container
CLI checks pass with restricted roles and private runtime files. The
[capacity harness](docs/local-load.md) exercises 100 teams/200 members; its
Linux-local live-socket rehearsal has passed with exact draft/receipt checks.
A reconnect race and redundant idle acknowledgements are fixed and covered by
regressions. A bounded public-standings cache now shares only committed public
scores, never session authority or private balances. The latest run retained
200 connections without reconnects and exact draft/submission receipts, with
faster pause/resume projections but some refused projection reads still recorded.
Protected API startup now refuses owner/worker database credentials and expanded
direct-write privileges. The participant browser suite also covers forty moving
targets on desktop/mobile and keyboard focus into/out of the workbench.
The user-reported [isolated cloud CLI rehearsal](docs/manual-cloud-rehearsal.md)
passed; it deliberately kept admission disabled and did not verify live deployment.
The [fifty-team shared-race rehearsal](docs/local-load.md#fifty-team-shared-race)
has two consecutive bounded Linux passes with one hundred claim recipients and
exactly one winner; an earlier capacity refusal remains recorded. Retention now
uses smaller transactions without extending production deadlines. Separate restricted
[primary-host service definitions](infra/app-host/README.md) are also prepared,
not installed. Mobile and minimised HUDs now retain team rank as well as score;
four viewport checks cover those layouts and workbench keyboard navigation.
Delivery/admission latency still needs
improvement; this is not a passed event-capacity gate. Overall completion is
roughly **88%**, not event readiness. A fresh combined disposable-database run
passes all 341 checks without cancellations/skips, alongside 304 unit/client
checks, builds/typechecks and the public-bundle boundary check. The 22 October
target was not met. Real hosting, alert delivery, complete
judge installation and full event-length capacity/recovery checks remain open.

Earlier implementation batch: [offline restore quarantine](docs/restore-quarantine.md)
atomically invalidates restored browser access/delivery capsules and quarantines
old judge epochs. A persistent independent gate blocks app/worker actions and
clock restart, without changing scores, locked languages, admitted intents or
held execution slots. The same operation passes on an actual encrypted physical
restore into isolation. Overall completion is roughly **81%**, not event readiness.
Physical old-host fencing, secret rotation and controlled reopening still need
verification; no real database, deployment or Git history was changed.

Earlier implementation batch: [encrypted backup and isolated restore](docs/backup-restore.md)
adds a PostgreSQL/pgBackRest image candidate, protected GCS configuration template
and real full/differential/incremental plus WAL recovery drill. The local restore
preserves all 109 application tables, migration history and database guards,
rejects a wrong key/damaged manifest, and stays network-isolated. Overall completion
is roughly **80%**, not event readiness. Cloud repository installation,
deployment-secret rotation and safe reopening remain unfinished; nothing was deployed.

Earlier implementation batch: [same-origin HTTPS gateway](docs/https-edge.md)
adds the real Caddy configuration for the built frontend, protected API and live
WebSockets. Production requests use a checked same-host client-address boundary;
secure cookies, CSP/editor workers, private draft updates, cache rules and lost
POST handling pass local TLS/browser checks. Overall completion is roughly **79%**,
not a measured readiness score. This does not deploy a cloud host or install a
public certificate; real judge/host, backups, monitoring and event-load gates remain.

Earlier implementation batch: [database retention and operations](docs/data-retention.md)
adds guarded 24-hour verifier and 7/30-day source/diagnostic expiry, immutable
byte/hash tombstones, paired official-source retirement and controlled expired
reads. Staff have read-only cleanup status; a finite Linux operator command
supports post-event maintenance without opening a website or executing code.
Overall completion is roughly **78%**, not a measured readiness score. Local
database/browser and shared clock/maintenance regressions pass. Production-host byte retirement, native command
rehearsal, encrypted backups/archive/restore and full event launch gates remain.

Earlier implementation batch: [final results export](docs/results-export.md)
adds staff CSV/JSON downloads of either round's frozen standings, historical
arena scope, exact tie-break data and separate qualification status. Private
balances, code and execution data are excluded; CSV names are spreadsheet-safe.
Overall completion is roughly **72%** after this verified batch,
not an event-readiness score. No migration or live database change is needed.
Installed hosting, retention and full launch/load/security gates remain open.

Earlier implementation batch: [private team search and code revocation](docs/team-registration.md)
adds bounded team/member/registration-ID search, confirmed code revocation without
secret issuance, deliberate reissuance and race-safe active/inactive checks.
Existing grants/handoffs are retired without changing enrolled languages, saved
code, sporting state or admitted work. Overall completion is roughly **71%**,
not an event-readiness score. Only disposable synthetic databases were migrated;
production installation, retention and launch/load/security gates remain open.

Earlier implementation batch: [arena announcements](docs/announcements.md)
adds event-wide, round-wide and private team messages, scoped live notification,
a participant inbox and protected staff sending/history. Unknown sends recover
the original receipt without reposting; opening a message preserves the editor.
Overall completion is roughly **70%**, not an event-readiness score. The migration
has only been exercised in disposable test databases. Installed hosting,
retention and full event-load/security/recovery verification remain open.

Earlier implementation batch: [staff audit history](docs/staff-audit.md)
adds role-filtered browsing of seventeen immutable record categories, historical
arena scope, stable paging and source-free detail dialogs. It reads existing
records without changing commands, sessions or competition state. Overall
completion is roughly **69%**, not an event-readiness score. Installed hosting,
remaining event controls, retention and launch/load verification remain open.

Earlier implementation batch: [private validation diagnostics](docs/validation-diagnostics.md)
adds reason-required Owner/Super Admin review of one resolved authoring dispatch,
bounded output/accounting, immutable access history and original-session GET-only
receipt recovery. It never reruns code, changes a result or bypasses publication
and physical-cleanup gates. Overall completion is roughly **68%**, not an
event-readiness score. Production hosting and event-load rehearsal remain open.

Earlier implementation batch: [restricted submission review](docs/submission-review.md)
adds reason-required Owner/Super Admin review of admitted source and one resolved
dispatch's retained feedback, with immutable access history, original-session
receipt recovery and stale/revoked browser-data clearing. It cannot read working
drafts, change verdicts or grant Organiser private-source access. Overall completion
is roughly **67%**, not an event-readiness score.

Earlier implementation batch: [operator-only Super Admin recovery](docs/staff-operator-recovery.md)
adds backup administrators, lost/compromised-code rotation and verified retirement,
with private candidate delivery, original-key recovery and immutable audit. No
public recovery endpoint or master code exists. Real operator deployment and the
remaining hosting/security/load gates are still required. Overall completion is
roughly **66%** for that batch, not an event-readiness score.

Earlier implementation batch: [separate app-side judging service](docs/judging-runtime.md)
connects the existing validation/participant schedulers to automatic, non-overlapping
worker turns, restricted database credentials, private mutual TLS, independent
clock freshness and graceful shutdown. API competition wiring uses the live worker
lease and frozen manifests without receiving its TLS key. Judge-VM installation,
retention, deployment and event-sized testing remain required. Overall completion
for that batch was roughly **65%**, not an event-readiness score.

Earlier implementation batch: [automatic event maintenance](docs/event-maintenance.md)
connects timer closure, sample/validation expiry, bounded cancellation progress,
expired encrypted handoff cleanup and shared quota cleanup to protected server
startup/shutdown. It preserves physical holds and staff-only finalisation.
Production judging daemons, payload retention and deployment gates remain open.
That batch's completion estimate was roughly **64%**, not an event-readiness score.

Earlier implementation batch: [staff judging and recovery](docs/staff-judging.md)
adds filtered queues, safe dispatch timelines, physical-hold visibility and
paged recovery decisions. Owner/Super Admin confirmation reuses the existing
extra-dispatch command; it never sets a verdict or bypasses the worker's safety
checks. Organisers can monitor but cannot authorise recovery. Overall completion
is roughly **64%**, not an event-readiness score.

Earlier implementation batch: [participant results and history](docs/participant-history.md)
adds round standings, paged private Runs/team submissions, original source and
feedback, wallet entries, saved drafts and purchased hints. Current Round 2
access can read authorised Round 1 history without reviving its old credential.
Live updates preserve provisional/final/cancelled distinctions. No schema,
permission or deployment change was needed.

Earlier implementation batch: [restricted timing recovery](docs/clock-recovery-ui.md)
connects incident review, own-code clearance, original GET-only receipt recovery,
safe sign-out and explicit fresh normal sign-in. Recovery grants never become
normal admin grants. The clock-monitor policy and transaction limits are unchanged.

Earlier implementation batch: [whole-round cancellation](docs/round-cancellation.md)
adds confirmed Owner/Super Admin incident controls, immediate gameplay fencing,
bounded logical cleanup and a drain-gated archive. Cancelled work has no invented
verdict; existing evidence and balances are retained. Participants receive live
read-only feedback. Lost replies use original GET-only recovery.
No development/cloud migration or deployment was performed.

Earlier implementation batch: [staff discipline](docs/staff-discipline.md) adds
instance-scoped team/member blocking, exact unblocking, reversible ranking-time
penalties, the 300-minute team-round cap and private audit/recovery controls.
Admitted judging and earned points/bounty survive access blocks. Locked results
are not editable. Tests use disposable synthetic data, not development/cloud data.

Earlier implementation batch: [CSV registration import](docs/team-registration.md#csv-import)
adds upload/preview, stable external registration IDs, duplicate/conflict checks,
confirmed atomic saves and private one-time JSON code export. Each file supports
up to 100 teams; the pool remains capped at 1,000. Repeated imports do not replace
names, enrollments or codes, and lost replies use original GET-only recovery.
No real registrations or development/cloud database were changed.

Earlier implementation batch: [team registration and code management](docs/team-registration.md)
adds the Owner/Super Admin Teams screen, atomic two-member registration, one-time
codes, deliberate rotation and original-receipt recovery. Rotation revokes old
access without resetting languages or competition history. The CSV column format
is now implemented in the batch above. No real registrations,
credentials or development/cloud database were changed.

Earlier implementation batch: [validation runs and publication review](docs/content-validation-ui.md)
adds saved snapshot/run history, live progress polling, cleanup-aware publication
locks, explicit human review and own-code confirmation. Run/publication response
loss uses original GET-only receipt recovery. New reviewed migrations are tested
only in disposable databases; no development/cloud migration was applied.

Earlier implementation batch: the [Bug Library and draft editor](docs/content-authoring-ui.md)
connects five-language private variants, metadata, samples/hidden cases, starter
failure declarations, hints, versioning and immutable validation preparation.
Exact UTF-8 file import/export, stale-edit protection and original-receipt recovery
are covered by real-browser checks. Preparation does not run code or publish a
question. Production installation and launch verification remain open.

Earlier implementation batch: [Staff and Access screens](docs/staff-access-ui.md)
connect Super Admin management of Owners/Organisers, one-time code delivery and
revocation, plus normal staff approval/rejection of browser replacements. Lost
replies recover the original receipt without another write. Real browser checks
also corrected cold-session discovery and confirmation-vs-expiry handling.
Remaining staff controls, production runtime and launch verification remain unfinished.

Earlier implementation batch: the normal [staff control room](docs/staff-console.md)
connects registered team/duration setup, published bugs, both round lifecycles,
qualification, all three pause scopes, live monitoring and audited commands.
Organisers monitor read-only. Lost replies use original-receipt recovery without
replaying writes; concurrent edits are rejected. Remaining staff screens and the
production runtime are unfinished. Further visual polish is deferred while
functional delivery continues, without removing approved requirements.

Earlier implementation batch: `apps/web` adds the React participant interface:
code/member/language entry, a full-screen Three.js field, live/minimisable HUD,
standings, Monaco/plain-text editing, private autosave, sample runs, submission
recovery and sequential hints. The labelled synthetic visual preview is separate
from the normal protected API. The full staff console and production installation
remain required. See [participant interface and local preview](docs/participant-ui.md).

Earlier implementation batch: the participant workbench now loads the locked
language's challenge/starter/public samples, stores member-private conditional
drafts with durable save recovery, and exposes team official source read-only.
A tested browser-independent autosave controller preserves local text on
conflicts, response loss, pauses and reconnects. Own draft live notices carry
revisions, never source. The visible editor and retention/deployment work remain.
See [participant workbench](docs/workbench.md).

Earlier implementation batch: protected Socket.IO delivery now connects committed
claims, scores, hints, judging and control changes to scoped live streams, with
consistent snapshot/replay, reconnect recovery and temporary teammate editor
presence. A tested client controller refreshes coherent projections without a
page reload. The participant/admin screens and real deployment remain required.
See [live state](docs/realtime.md).

Earlier implementation batch: participant Run/Submit now create durable frozen
case jobs with 3:1 fair scheduling, guarded once-only sends, checked results,
bounded recovery, sample expiry and private result APIs. Official results feed the
existing atomic scoring/claim path; staff can monitor and safely authorise the one
extra recovery dispatch. This remains a backend tested with synthetic runner
observations, not an installed event judge. See [participant judging](docs/participant-judging.md).

Earlier implementation batch: the normal two-round competition backend now has
protected lifecycle commands, published-snapshot selection, atomic bounty/hint
ledgers, receipt-order R2 claims, exact standings, a committed cutoff draw and
once-only wallet carryover. Real PostgreSQL/HTTP tests cover both rounds and
concurrent/recovered effects. This is not the finished game: the installed
worker runtime, live delivery, cancellation/discipline integration and UI remain
required. Normal startup still refuses new live starts/submissions without an
explicit verified readiness dependency. See the [competition engine](docs/competition-engine.md).

Earlier implementation batch: every installation-backed Docker command now runs
through a native Linux socket-peer wrapper. It holds a kernel-provided peer handle,
checks the listener's exact reviewed executable/root identity/namespaces, and
refuses a peer that exits or changes executable while the command runs. Cancelling
the wrapper stops its owned CLI child, never the daemon. Fixed endpoint/config and
reported daemon/image pins remain. The version-3 release pins the CLI, daemon and
wrapper executables; versions 1/2 are refused, not silently upgraded. Socket
activation/proxy peers and missing kernel support fail closed. This does not prove
initial-host visibility, loaded policies, full dependency closure, genuine
readiness or retirement. No cloud daemon is changed or certified, and no installer,
judging activation, drain or registry slot is granted.
See [installation integrity](docs/judge-executor.md#installation-integrity).

The earlier authority-gated retirement handoff saves one
immutable cleanup certificate before appending drain proof to the original result.
Lost replies and duplicate completion attempts recover that certificate without
rerunning code or changing result bytes. PostgreSQL integration checks that proof
releases only its original physical slot. Docker absence now checks both the full
original ID and exact name, so renaming cannot masquerade as removal. The earlier
phase/storage records, reference checks and guarded resource cleanup remain.
Read-only result recovery still cannot invoke Docker, host probes or source.
No resource receipt or proc observation alone releases the parent reservation or
invents full drain; full host visibility and no-future-start authority remain gates.
The new handoff requires a separate trusted kernel-backed retirement authority.
**Its production implementation and installation do not exist yet.** Tests use
explicit synthetic authorities; normal startup does not grant this power.
Real disposable Docker tests execute only hardcoded trusted Node fixtures; Linux
disk/recovery tests use explicitly synthetic five-language evidence. The earlier
per-capsule Isolate producer, native C/C++/Node checks and syscall filter remain.
The actual general cgroup-v1 path has not been exercised on the VM. Native
preparation/recorded-empty-group/config cleanup and reference checks are implemented
but unverified there; complete host visibility/drain authority, real interrupted-child and cross-boot
recovery, immutable image/security installation, runtime calibration and cloud/
load rehearsal remain required. This code is not an installed event-ready judge.
At that earlier judge batch, completion was estimated at **51%**; the current
whole-project estimate is in Status above. Neither estimate is an event-readiness
score or deadline guarantee.
No participant/authoring source is executed and no live sandbox is certified.
No registered
compatible worker means no new validation admission. Publication requires its
exact successful, drained validation and authorised review; no live bypass is installed.
Existing immutable snapshots, draft authoring, reserved arena setup, browser replacement,
logout/keep-alive and staff management remain supported.
Tests use real disposable PostgreSQL with synthetic clock observations, not a
certified live cloud clock. Default Windows/local startup stays health/readiness
only. Exceptional operator recovery, the full admin console, remaining history/recovery UI and
actual host/browser/deployment checks remain. No existing database is migrated
on startup. See [judge gateway/registry](infra/judge-gateway/README.md),
[protected execution handoff](docs/judge-executor.md),
[private judge protocol](docs/judge-protocol.md),
[validation runs](docs/validation-runs.md),
[validation preparation](docs/content-validation.md),
[content authoring](docs/content-authoring.md),
[arena setup](docs/arena-setup.md),
[browser replacement](docs/participant-replacement.md),
[participant session controls](docs/participant-session-controls.md),
[staff provisioning](docs/staff-access-operations.md) and
[operator handoff](infra/clock-agent/README.md).

Latest user-reported judge result: all 108 packaged VM tests and the archive-04
continuation passed. There are 33 provider records, including the prior fifteen
unchanged, seventeen new sealed verdicts and one deliberately held uncertain
result. Original failed evidence is preserved, the queue is empty and maintenance
is enabled. Preserve the completed `admission-fix-v1`; do not rerun it. This is
synthetic lab evidence, not production judge or event-readiness sign-off.

The architecture is approved. Without explicit reviewed runtime wiring, the API
still exposes only health/readiness checks. Registration, competition, judging
orchestration and workbench APIs now have migrations and tests; the first
participant frontend is implemented, while the full staff console, production
judge installation and full-app deployment remain unfinished.
The following judge notes are historical checkpoints;
the latest completed result above supersedes their then-pending status.

Current milestone: [Judge0 feasibility](docs/judge-feasibility.md). The isolated cloud lab has passed the fixed C++ API/queue/result flow, eight failure/output cases, all five pinned language profiles, scoped retained-result/permit recovery, the [private HTTP/queue association experiment](infra/judge-spike/HTTP-LAB.md), a fixed [active worker crash/drain test](infra/judge-spike/CRASH-LAB.md), the fifty-case [bounded output/shared checker suite](infra/judge-spike/STREAMS-LAB.md), the fixed [five-profile HTTP/bounded evidence integration](infra/judge-spike/TRANSPORT-LAB.md), three fixed [shared sandbox boundary probes](infra/judge-spike/ISOLATION-LAB.md), the guarded seal of [protected-output evidence](infra/judge-spike/OUTPUT-LAB.md) and eighteen fixed [protected verdict cases](infra/judge-spike/VERDICTS-LAB.md). Fifteen provider records are retained, including all ten earlier records unchanged. These are synthetic checks, not a participant-ready deployment. End-to-end protected failure evidence, arbitrary compiler-failure attribution, broader crash/retirement recovery, adversarial isolation, dependency review, runtime-budget calibration and load verification remain open. Preserve completed evidence and the earlier intentionally held lab reservation; do not repeat completed experiments or historical nine/ten-row probes. Any additional cloud resources or budget changes need separate approval.

The earlier guarded stream recovery and fifty-case suite passed. Its failed journal/log, separate `streams-v1/cleanup-v1` proof and sealed `streams-v2` evidence remain preserved; do not rerun either controller.

The earlier five-profile HTTP/queue/checker integration passed. Lost token bodies and duplicate deliveries/replies resolved to one execution per job with matching retained bytes/accounting and expected checker results. Preserve `transport-v1` and its schema; do not rerun it.

The earlier [shared-boundary batch](infra/judge-spike/ISOLATION-LAB.md) passed boundary denials/identity checks, the bounded fork limit and detached-child cleanup, with accounting, normal cleanup and prior evidence unchanged. Preserve `isolation-v1`; do not rerun it. These fixed probes are not a full hostile-code/security sign-off.

Latest user-reported checkpoint (2026-10-18): the [protected-verdict HTTP/queue batch](infra/judge-spike/VERDICT-HTTP-LAB.md) passed its 95 VM tests and corrected Ruby preflight. Admission then stopped at `cpp-wall`, whose 0.3-second provider field is below Judge0's one-second model minimum. The read-only diagnostic confirms 23 provider rows, eight unstarted associations and zero consumed permits. The [guarded continuation](infra/judge-spike/VERDICT-HTTP-LAB.md#retained-admission-continuation) preserves the original failed context/journal and eight bindings, changes only the absent provider envelope and keeps the actual sandbox wall timeout at 300 ms. Its cloud run remains pending. Do not rerun `verdict-http.py` or any completed historical controller. No Git or cloud operation has been performed by the assistant.

The original public transfer package remains unchanged: ignored `runtime-data/judge-spike/ingenium-judge-output-20261018-01.tar.gz`, SHA-256 `3dc22c1f34cd5a14e5c73deeff7f9d119616163e9ff62eb4b98996d170de16e6`. Its controller is historical; do not rerun it or transfer private configuration/runtime evidence.

The completed sealing-only package is ignored `runtime-data/judge-spike/ingenium-judge-output-20261018-02.tar.gz`, SHA-256 `acdd843dbfaad6993730f347b0f5c2263bf76a75380e5a276c8ef0eb5c6ae82b`. Its `seal-output.py` entrypoint is also historical, not an instruction to repeat it.

The completed verdict package is ignored `runtime-data/judge-spike/ingenium-judge-verdicts-20261018-01.tar.gz`, SHA-256 `27484849e988a366472d25f67bfecdf942c6385fbe99400e76e1ec76794cc1a1`. Its 62 regular public files were extracted and byte-checked; 80 bundled Python tests passed on the VM without skips. Its controller is now historical, not an instruction to rerun. Keep all public archives and private checkpoints unchanged.

The original [protected-verdict HTTP/queue package](infra/judge-spike/VERDICT-HTTP-LAB.md) is ignored `runtime-data/judge-spike/ingenium-judge-verdict-http-20261018-01.tar.gz`, SHA-256 `ef2d1ca3a626a9018207d085153ee0e496f9dd39ce6e37665a5f2285ec36cace`. Its 95 bundled tests passed on the VM, but the Ruby preflight stopped before checkpoint/schema creation. The user confirmed no new checkpoint exists. Preserve this immutable archive/extraction; do not run it again. Archive 02 replaces only the parser-specific payload copy and expands Ruby regression checks; actual cloud admission/execution remains pending. Duplicate JSON-key rejection and all execution protections remain unchanged.

Corrected first-start package: ignored `runtime-data/judge-spike/ingenium-judge-verdict-http-20261018-02.tar.gz`, 176302 bytes, SHA-256 `a584e10bdaa51892c2504a13cece968971cf87c512d2e4783fbc52d5e9a07925`. All 74 public files were extracted/byte-checked and pass ASCII/LF plus Python 3.10 checks; 71 files are unchanged from archive 01. The full 235-test Python suite and 95 bundled tests pass locally with two POSIX-only Windows skips. Ruby execution is unavailable locally; its expanded preflight must pass on the VM before admission. Use a new public extraction, never delete/reset private state to allow a start.

Archive 03 provides the separately guarded admission continuation, not a fresh start. Use its `resume-verdict-http.py` entrypoint only after the packaged tests. It requires the exact diagnosed unstarted state, validates all eighteen corrected payloads read-only, reconciles the original eight using GET only, and admits only the ten positively absent attempts. Seventeen sealed results and one held uncertain result are still required; local tests do not establish participant readiness.

Continuation package: ignored `runtime-data/judge-spike/ingenium-judge-verdict-http-20261018-03.tar.gz`, 184786 bytes, SHA-256 `2df601cf0635a4221ce86425443f4cb67774a4cc3f12329d88955da055dea33f`. All 76 files were extracted/byte-checked; all 73 original non-document inputs are unchanged. The full 247-test suite and 107 bundled Python tests pass locally with two POSIX-only Windows skips. Actual Rails model validation and cloud execution remain pending.

Archive 03 subsequently passed all 107 VM tests but stopped at its strict whole-output validation check, before any new checkpoint or admission. Archive 04 corrects only that output handling: exactly one complete validation-success line is required, with checked command exit and bounded output unchanged. Use the updated [continuation procedure](infra/judge-spike/VERDICT-HTTP-LAB.md#retained-admission-continuation); do not reset private state or rerun an old controller. Cloud continuation remains pending.

Corrected continuation package: ignored `runtime-data/judge-spike/ingenium-judge-verdict-http-20261018-04.tar.gz`, 185620 bytes, SHA-256 `195155c158b4c0e39564e968fc6fd1aee33768f46dd95dd4f5de7dd71484a58f`. Only the continuation, its regression test and runbook changed; the other 73 files and all earlier archives are unchanged. The full 248-test suite and 108 extracted-package tests pass locally with two POSIX-only Windows skips. Ruby/Rails and the actual cloud continuation remain pending.

## First Local Milestone

Requirements: Node.js 24.22.x (npm included) and running Docker Desktop with Linux containers. Run these from this repository's root in PowerShell; use `npm.cmd` if PowerShell blocks the `npm.ps1` wrapper.

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd run db:up
npm.cmd run dev
```

`setup:env` creates ignored `.env` (API) and `.env.database` (Docker/database owner) files with separate random local passwords, and never overwrites an existing pair. The API loads only its restricted role's connection URL, not the database-owner password. Both example files contain placeholders only. If only one actual file exists, setup stops for review rather than guessing or replacing credentials. Database initialisation runs the role SQL only on an empty named volume; editing environment passwords later does not change an existing user's password.

Open [API liveness](http://127.0.0.1:3000/health) or [database readiness](http://127.0.0.1:3000/ready). These are JSON API responses, not the game UI. If port 3000 is busy, change `API_PORT` in the local `.env` before starting; never terminate an unrelated server.

| Request | Meaning |
| --- | --- |
| `GET /health` | The API is responding. It does not query PostgreSQL. |
| `GET /ready` | Executes `SELECT 1` through the connection pool. Returns 200 when reachable, or a generic 503 when unavailable; no credentials or database errors are exposed. |

### How the Files Fit Together

- Root `package.json`: npm workspace and shortcuts for the API, tests and development database.
- `apps/api/src/server.ts`: loads local settings, creates the database pool and starts/stops the HTTP server.
- `apps/api/src/app.ts`: defines HTTP routes; tests can exercise them without opening a network port.
- `apps/api/src/database.ts`: the bounded `pg` connection pool and harmless readiness query; startup never applies migrations.
- `apps/api/src/db/` and `apps/api/drizzle/`: reviewed registration/access schema, owner-only migration runner and versioned SQL.
- `apps/api/src/access/`: entry/session core, strict browser policy, opt-in HTTP routes/schemas, credential verifiers, encrypted delivery and shared PostgreSQL quotas. The normal server keeps the adapter disabled until its required dependencies are wired.
- `apps/api/src/config.ts`: validates settings and restricts this initial server to loopback addresses.
- `compose.yaml`: pinned PostgreSQL 17 image, local-only port 5433, a persistent named volume and bounded development resources. It is not a production deployment or a Judge0 sandbox.
- `infra/postgres/01-api-role.sql`: creates the restricted API login during first database initialisation. It cannot create databases/roles or objects in the public schema; reviewed migrations grant only the specific data access each implementation batch needs.

### Checks and Shutdown

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:db
npm.cmd run test:db:schema
```

Unit/configuration tests do not need PostgreSQL. `test:db` requires the development
database and performs connectivity/role-permission reads without adding data.
`test:db:schema` uses a separate, labelled, memory-backed PostgreSQL test container
and the cached pinned Docker image; it never migrates the development database.
It checks registration/access migrations, concurrent entry/session commands,
the HTTP adapter and database-backed protected browser workflows. These synthetic
checks do not verify public hosting or the production judge.
Tests use Node's built-in runner. Building
produces JavaScript under `apps/api/dist`; compilation is not event-readiness proof.

Stop a foreground API with Ctrl+C. `npm.cmd run db:stop` stops only this project's PostgreSQL service and preserves its volume. Restart it with `npm.cmd run db:up`. Do not remove the named volume to fix credentials without deliberately deciding to discard its development data. This milestone does not execute participant code.

If the API was started in the background during guided setup, use the specific process ID provided in the chat to stop that copy before running `npm.cmd run dev`; do not stop unrelated Node processes. The background demonstration runs the compiled build, while `dev` runs TypeScript with automatic restart on source changes.

## Initial Competition Scope

- Coding languages: C, C++, Java, Python, and console JavaScript.
- Submissions: complete programs using the specified standard input/output format.
- Run: published samples only, no penalties/rewards, and up to two queued/running Runs per member.
- Official Submit: one queued/running submission per team per bug; different bugs may be submitted without waiting.
- Judging queue: 3:1 official/sample dispatch when both have work, with fair turns between teams; worker limits need load testing.
- Function-only submissions are a planned future extension, not initial support.
- HTML/CSS/React challenges are excluded; React remains the planned platform frontend.

## Planned Stack

- Frontend: React, TypeScript, and Vite.
- Interactive arena: Three.js through React Three Fiber.
- Backend: Node.js, Fastify, and Socket.IO.
- Application database: PostgreSQL.
- Code judging: self-hosted Judge0 on a separate, isolated server.

The approved competition, security, data and operational contracts are recorded in `architecture.md`. Build small verified slices against that design; local health/readiness endpoints are not evidence that the arena or judge is ready for an event.

## Sensitive Data

Keep credentials, real team access codes, and private event data out of Git. Use local environment files or the ignored `secrets/` and `runtime-data/` directories instead.
