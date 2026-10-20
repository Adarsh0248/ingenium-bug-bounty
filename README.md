# Ingenium Bug Bounty

A gamified bug-fixing competition platform for Ingenium, the college technical festival module.

## Status

Delivery target: **22 October 2026**, with the complete approved initial scope;
no additional features are silently dropped. See the current
[build and launch checklist](docs/build-status.md). The target is not a readiness
guarantee, and required security/capacity/recovery gates still apply.

Latest implementation batch: durable validation runs, full check admission,
leased workers, once-only send permission, bounded evidence/retries/polling and
deadline/physical-drain accounting. A synthetic driver exercises the real database
flow; the production cloud adapter/supervisor is not connected. No registered
compatible worker means no new admission. Publication remains blocked.
Existing immutable snapshots, draft authoring, reserved arena setup, browser replacement,
logout/keep-alive and staff management remain supported.
Tests use real disposable PostgreSQL with synthetic clock observations, not a
certified live cloud clock. Default Windows/local startup stays health/readiness
only. Exceptional operator recovery, participant/admin screens, live notifications and
actual host/browser/deployment checks remain. No existing database is migrated
on startup. See [validation runs](docs/validation-runs.md),
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
still exposes only health/readiness checks. Registration and entry now have migrations and tests;
the frontend, gameplay, production judge connection and full-app deployment are
not implemented yet. The following judge notes are historical checkpoints;
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
It checks registration/access migrations, concurrent entry/session commands and
the HTTP adapter through Fastify injection, not public hosting or a real browser.
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
