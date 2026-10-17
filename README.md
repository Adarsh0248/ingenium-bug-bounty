# Ingenium Bug Bounty

A gamified bug-fixing competition platform for Ingenium, the college technical festival module.

## Status

The architecture is approved. The first local backend foundation provides API liveness and a development PostgreSQL connectivity check, with automated tests. Competition features, frontend, Judge0 integration and cloud deployment are not implemented yet.

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
- `apps/api/src/database.ts`: the bounded `pg` connection pool and harmless readiness query. No competition schema or Drizzle migrations exist yet.
- `apps/api/src/config.ts`: validates settings and restricts this initial server to loopback addresses.
- `compose.yaml`: pinned PostgreSQL 17 image, local-only port 5433, a persistent named volume and bounded development resources. It is not a production deployment or a Judge0 sandbox.
- `infra/postgres/01-api-role.sql`: creates the restricted API login during first database initialisation. It cannot create databases/roles or objects in the public schema; competition tables and migration-owner tooling come later.

### Checks and Shutdown

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:db
```

Unit/configuration tests do not need PostgreSQL. `test:db` requires the development database and performs connectivity/role-permission reads, without adding tables or registration data. Tests use Node's built-in runner and Fastify injection. Type checking verifies types; building produces JavaScript under `apps/api/dist`; neither proves competition correctness.

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
