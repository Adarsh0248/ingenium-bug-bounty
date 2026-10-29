# Ingenium: local app startup, shutdown and debugging

Updated: 27 October 2026. Commands below are for **Windows PowerShell**, run from
this repository. This guide does not deploy the event or start a cloud VM.

## 1. Start here: choose the right mode

| What you want to do                                | Command                                     | Open in the browser                                       | Database                                              | Actual code execution?                                 |
| -------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Review the contestant interface quickly            | `npm.cmd run preview:participant`           | `http://127.0.0.1:5174`                                   | Synthetic data in memory                              | No                                                     |
| Review admin and contestants together              | `npm.cmd run preview:app`                   | `http://127.0.0.1:5175`                                   | Its own temporary PostgreSQL container                | No; judging is simulated                               |
| Work on the normal frontend and backend separately | `npm.cmd run dev:web` and `npm.cmd run dev` | UI: `http://127.0.0.1:5173`; API: `http://127.0.0.1:3000` | Persistent development PostgreSQL, normally port 5433 | Requires the separately configured Linux judge/runtime |

**For our current frontend review, use the first or second row.** Use 5175 when
you want an admin action to affect the contestant you are watching. Admin actions
on 5175 do not affect the independent contestant-only demo on 5174.

The normal Windows API starts with health/database checks by default. Starting
it and the normal frontend does not automatically install the protected event
runtime or enable staff/contestant login. Use the complete preview on 5175 to
review those panels locally.

## 2. What each part does

- **Frontend:** the interface in your browser: map, bugs, coding editor, admin
  screens and buttons. Source: `apps/web/src`.
- **Backend/API:** receives browser requests, checks access and applies the
  competition rules. Source: `apps/api/src`.
- **PostgreSQL/database:** stores durable event information, such as teams,
  questions, submissions, scores and receipts.
- **Judging worker and Linux judge:** process admitted jobs and compile/run
  participant programs on the separately configured judge host. They are not
  replaced by Docker Desktop merely being open.
- **Docker Desktop:** runs local Linux containers. Our development database and
  complete UI preview use it.

In the normal app, the browser talks to the API, and the API talks to PostgreSQL.
Judging follows a separate worker/gateway/executor path. A working frontend or a
healthy database alone does not mean that real judging is available.

## 3. Requirements and first-time preparation

Open a terminal and enter the project directory:

```powershell
cd "D:\College\Ingenium\Bug bounty"
```

Repeat that directory command in every new terminal used for this project. If
you move the repository, use its new location instead.

Check the installed tools:

```powershell
node --version
npm.cmd --version
docker version
docker compose version
```

The repository requires Node **24.22.0 or later within version 24**, and declares
npm **11.19.1**. Docker Desktop must use Linux containers. If `docker version`
prints client information followed by a server connection error, open Docker
Desktop and wait until its engine is running.

Install the repository's locked dependencies once after cloning, or after its
lockfile changes:

```powershell
npm.cmd ci
```

`npm.cmd` avoids PowerShell's sometimes-blocked `npm.ps1` wrapper. You do not
need to change the machine's execution policy to run these commands.

## 4. Contestant-only preview: quickest frontend review

From the project root:

```powershell
npm.cmd run preview:participant
```

Keep that terminal running and open **http://127.0.0.1:5174**.

Enter this synthetic team code:

```text
AAAAAAAA
```

Select Asha or Dev, choose a language, then confirm entry. Click a bug on the map
or in the target list to open its question and coding interface.

This mode:

- Does not require Docker or a database connection.
- Does not provide the working admin control room.
- Uses synthetic questions, teams, scores and judging responses.
- Starts with 40 dummy bugs, ten per area, covering all six creature types and all bounty tiers.
- Does not compile the code you type.
- Keeps practice data only while this preview process is running.

Each confirmed entry starts a fresh two-hour demo round. If the demo countdown
reaches zero and an uncaught bug will not open, sign out and enter again. If the
session itself expires, use **Return to entry**. Saved practice drafts survive
re-entry into the same preview session while the server remains running.

**Stop:** press **Ctrl+C** in its terminal. Starting it again resets its practice
data. Frontend changes normally reload automatically; changes to
`apps/web/test/preview-server.ts` require a restart.

## 5. Full local preview: admin and contestants together

Open Docker Desktop, wait for its engine, then run:

```powershell
cd "D:\College\Ingenium\Bug bounty"
npm.cmd run preview:app
```

Wait for setup to finish. The terminal prints:

- The URL, normally **http://127.0.0.1:5175**.
- A fresh **Super Admin code**.
- Fresh team codes and member names for the demo teams.

### Admin access

1. Open the printed URL in your normal browser profile.
2. Enter the printed Super Admin code in **Team or staff code**.
3. The app opens the control room based on the code's role; a separate admin URL
   is not required.
4. Keep that same code available for actions that ask you to confirm your own
   access code.

There is no permanent shared admin password. Codes from an earlier preview run
will not work after restarting it.

### Contestant access

1. Open the **same 5175 URL** in an incognito window or a different browser
   profile.
2. Enter a team code printed by that running preview.
3. Select a member and language, then enter the arena.
4. Use a genuinely separate profile/browser for another independently logged-in
   member. Two incognito windows can share one incognito cookie session.

Admin and contestant tabs in one profile share cookies and can replace each
other's login. Keep the roles in separate profiles. Also keep the hostname
consistent: use `127.0.0.1` throughout instead of mixing it with `localhost`.

This preview uses the actual API/database access rules and live updates, but a
temporary demo database and simulated clock/judging. It starts Round 1 with demo
teams and questions, and includes published Round 2 examples for reviewing the
normal progression. It does not contact the cloud judge or use the development
database. Submitted text containing `PREVIEW_WRONG` produces the preview's wrong
answer response; other output is canned, not evidence that the program is correct.

**Stop:** press **Ctrl+C** in this preview's terminal and let cleanup finish. It
stops its services and removes its own temporary database container. Restarting
creates new codes and fresh demo data. Its database is memory-backed and is not
a persistent store for work you want to keep.

Frontend edits reload normally. Backend/setup edits to the preview need a
restart, which resets its demo data. See [the full preview guide](docs/local-preview.md).

## 6. Normal development: database, API and frontend separately

Use this mode for development against the persistent local database. It is
separate from both preview modes above.

### A. Prepare the local environment files once

```powershell
cd "D:\College\Ingenium\Bug bounty"
npm.cmd run setup:env
```

This creates two ignored files with separate random local passwords:

| File                     | Used by                                    | Purpose                                                   |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------- |
| `.env`                   | API                                        | Its restricted database connection and local API settings |
| `.env.database`          | Docker Compose                             | Database initialization settings and owner credentials    |
| `.env.migration`         | Explicit migration command, if configured  | Separate schema-owner connection                          |
| `.env.staff-maintenance` | Restricted operator tooling, if configured | Separate staff-maintenance connection                     |

The setup command leaves an existing `.env`/`.env.database` pair unchanged. If
only one exists, it stops for review. Do not delete environment files to silence
that error, and do not commit their contents.

### B. Start the persistent development database

```powershell
npm.cmd run db:up
```

The command starts PostgreSQL in Docker and waits for its health check. Default
development connection values are:

| Setting                   | Default        |
| ------------------------- | -------------- |
| Host from Windows         | `127.0.0.1`    |
| Port from Windows         | `5433`         |
| Port inside the container | `5432`         |
| Database name             | `ingenium_dev` |
| Restricted API role       | `ingenium_api` |
| Development owner role    | `ingenium_dev` |

Your local files are authoritative if you changed these values. Passwords are
generated locally; there is no password to copy from this guide.

### C. Start the backend in terminal 1

```powershell
cd "D:\College\Ingenium\Bug bounty"
npm.cmd run dev
```

This runs the API on **http://127.0.0.1:3000** by default and watches its source
for changes. Keep the terminal open.

Check it from a second terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/ready
```

| Check                                   | Success means                                                               |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `/health` returns `status: ok`          | The API process is responding; this does not query PostgreSQL               |
| `/ready` returns `status: ready`        | Its database check passes; protected runtimes add their own readiness gates |
| `/ready` returns HTTP 503 / `not_ready` | A required dependency is unavailable; inspect the API/database logs         |

These URLs return JSON, not the game interface. A successful foundation readiness
check does not establish that event entry or a judge has been installed.

### D. Start the normal frontend in terminal 2

```powershell
cd "D:\College\Ingenium\Bug bounty"
npm.cmd run dev:web
```

Open the printed frontend URL, normally **http://127.0.0.1:5173**. Vite forwards
`/api` requests and live WebSocket traffic to `127.0.0.1:3000`.

The frontend/API/database are three separate pieces: starting the frontend does
not start the API, and starting the API does not start PostgreSQL. The previews
provide their own combined setup instead.

If the default normal API exposes only health/readiness endpoints, that is its
configured foundation mode. The reviewed Linux entry/competition runtime files,
trusted clock and judging dependencies are needed for the protected event flow.
Do not disable browser-origin checks or install synthetic judging into that mode.
For an immediate working local admin/contestant review, use **5175**.

## 7. Stop and restart without losing the development database

For the normal separate setup:

1. Press **Ctrl+C** in the frontend terminal.
2. Press **Ctrl+C** in the API terminal and let it close.
3. Stop the development database:

```powershell
npm.cmd run db:stop
```

That preserves the database's named volume. Next time, run `db:up`, `dev` and
`dev:web` in the same order. You do not need `npm ci`, environment setup or
migrations on every start.

For either preview, use Ctrl+C in that preview's own terminal. Stopping the
development database does not stop a preview's separately owned database.

Do not use `docker compose down -v`, delete Docker volumes, or run a global Docker
prune as a restart procedure. Those actions can remove data. Do not stop every
Node process to resolve one port conflict.

## 8. Check the database and inspect tables

### Persistent development database

```powershell
docker compose --env-file .env.database ps
npm.cmd run db:logs
```

Open a database terminal inside that specific container:

```powershell
docker compose --env-file .env.database exec postgres sh -lc 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Inside `psql`, these are useful inspection commands:

```sql
\conninfo
\dn
\dt public.*
\d public.teams
BEGIN READ ONLY;
SELECT current_database(), current_user;
SELECT count(*) AS team_count FROM public.teams;
ROLLBACK;
\q
```

`\dt` lists tables, `\d` describes a table, and `\q` exits. The `teams` example
requires the reviewed application migrations; a new foundation-only database
may not contain those tables yet. Keep inspection transactions read-only.

If using a database GUI you already have, connect to `127.0.0.1:5433` and use
the correct role/database and locally stored password. Do not use the schema-owner
connection as the API's connection.

### Temporary full-preview database

Find its labelled container:

```powershell
docker ps --filter label=ingenium.local-preview
```

Copy the name from that output into this variable:

```powershell
$demoContainer = "PASTE_THE_PREVIEW_CONTAINER_NAME"
docker logs --tail 50 $demoContainer
docker exec -it $demoContainer psql -X -U ingenium_schema_owner -d ingenium_ui_preview
```

Use the same read-only inspection commands inside `psql`. The preview database
is separate from `ingenium_dev`, uses a dynamically allocated host port, and is
removed when the full preview closes. The contestant-only preview has no
PostgreSQL database to inspect.

## 9. Database migrations: occasional, not part of daily startup

A migration changes database structure or stored database functions. API startup
does not apply migrations. Both disposable preview/test setups manage their own
migrations; do not run development migrations to repair a preview.

When deliberately preparing/updating your persistent development schema:

1. Review the target database and migration changes first.
2. If `.env.migration` does not already exist, copy `.env.migration.example`
   to that name without overwriting an existing file.
3. Edit its `MIGRATION_DATABASE_URL` privately to use the development owner's
   actual credentials from `.env.database`, with the correct host/port/database.
   URL-encode special characters if your password requires it.
4. With that database running, apply the reviewed migrations:

```powershell
npm.cmd run db:migrate
```

`setup:env` does not create `.env.migration`. Never replace the API's restricted
`DATABASE_URL` with an owner URL to make migrations work.

`npm.cmd run db:generate` is for intentionally authoring a schema change. It
generates migration files; it is not a repair or startup command.

## 10. Check frontend behaviour in the browser

Press **F12** or **Ctrl+Shift+I** in Chrome to open developer tools.

| Panel               | What to inspect                                               |
| ------------------- | ------------------------------------------------------------- |
| Console             | JavaScript errors and warnings; copy the first relevant error |
| Network → Fetch/XHR | The request that failed, its status and its error response    |
| Network → WS        | The live WebSocket connection, if updates stop arriving       |
| Elements            | Layout/styles when checking a visual problem                  |

When opening a question, look for its `/open` request and the reads for metadata,
`/statement`, `/starter` and `/draft`. The statement and starter code are loaded
separately from drawing the bug. Check both the map click and the target-list
entry to distinguish a map interaction issue from a shared access/data issue.

An unverified/reconnecting live state, an expired round, or a pause can prevent
new captures. Read the displayed notice and countdown before blaming the canvas.
For the 5174 synthetic demo only, signing in again starts a fresh practice clock.
Real event deadlines must be handled through the actual staff workflow.

Keep drafts saved before refreshing. Do not paste cookies, access codes, private
source or a full network/HAR export into a public issue or chat. A request's
path, HTTP status, generic error code and trace ID are usually enough to start.

## 11. Check backend and database problems

Read the terminal running the API or full preview first. The normal API logs
server errors there; `npm.cmd run db:logs` reads the development database's logs.

| Symptom                                                 | First checks                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Frontend cannot connect / proxy error                   | Is the API terminal running on port 3000? Does `/health` respond?                                                        |
| `/health` works but `/ready` fails                      | Is the correct database running? Check its health/logs and matching local credentials                                    |
| `/api/v1` returns 404 in normal development             | Is only the foundation API configured? Use 5175 for full local review or install the reviewed protected runtime          |
| HTTP 401 / session unavailable                          | Session expired or was revoked; use the appropriate entry/recovery flow                                                  |
| HTTP 403                                                | Check role, browser origin, CSRF and displayed restrictions; do not bypass them                                          |
| HTTP 409                                                | Review the conflict or original receipt; do not blindly repeat a submission/write                                        |
| HTTP 503                                                | Check readiness, the trusted clock, worker/judge availability, and the first relevant service error                      |
| Both bug and target-list clicks do nothing              | Check countdown, live-state status and the visible error notice; an expired 5174 demo round needs re-entry               |
| Admin changes do not appear for contestant              | Are both using 5175 and the same preview run, in separate profiles?                                                      |
| A previously printed admin code is rejected             | Was the full preview restarted? Use the new codes printed by its current process                                         |
| Database password fails after editing environment files | Existing PostgreSQL users keep their old passwords; environment changes do not rewrite credentials in an existing volume |

For a useful bug report, record the URL/port, role, steps, expected result, actual
result, first console error, failed request path/status and whether the problem
also occurs in the target list. Screenshots should not expose codes or private
source unnecessarily.

## 12. Find a port conflict safely

Check which process is listening:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,5173,5174,5175,5433 -ErrorAction SilentlyContinue |
    Select-Object LocalAddress,LocalPort,OwningProcess
```

Then inspect only the PID shown for the port you are investigating:

```powershell
$appPid = 12345 # Replace with the actual PID from the previous output.
Get-Process -Id $appPid
```

Stop your own app in its original terminal with Ctrl+C. Do not paste a stale PID
from an earlier chat into a stop command: Windows can reuse process IDs.

If it was started in the background and its original terminal is unavailable,
inspect its command line before doing anything else:

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId = $appPid" |
    Select-Object ProcessId,ParentProcessId,CommandLine
```

Only after confirming that this exact process is your intended local app, a
forced stop is possible with `Stop-Process -Id $appPid`. This can skip normal
cleanup, especially for a disposable preview, so prefer Ctrl+C and do not use a
forced stop as the normal shutdown procedure.

The normal frontend proxy expects API port 3000. If you deliberately change
`API_PORT`, review the proxy in `apps/web/vite.config.ts` too. The protected
browser origin must exactly match its reviewed configuration; port changes are
not permission to weaken that validation. Vite may print a different frontend
port if its default is occupied, so read its terminal output.

## 13. Tests and production builds

Run from the repository root:

| Command                                             | Checks                                                      | Needs Docker/database?                                |
| --------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| `npm.cmd run typecheck`                             | TypeScript across workspaces                                | No                                                    |
| `npm.cmd test`                                      | API and frontend unit checks                                | No                                                    |
| `npm.cmd run build`                                 | Compiled API and frontend assets                            | No                                                    |
| `npm.cmd run test:bundle --workspace @ingenium/web` | Public bundle policy after building                         | No                                                    |
| `npm.cmd run test:db`                               | Development database connectivity and API-role restrictions | Running configured development DB                     |
| `npm.cmd run test:db:schema`                        | Reviewed schema and integration suites                      | Docker; creates its own test DB                       |
| `npm.cmd run test:browser`                          | Synthetic participant/browser checks                        | Matching Playwright Chromium                          |
| `npm.cmd run test:browser:db`                       | Real API/database browser workflows                         | Docker and matching Playwright Chromium; own test DBs |

If Playwright reports that its browser executable is missing:

```powershell
npx.cmd playwright install chromium
```

Browser tests normally use port 5174. If your review preview is already using it,
put the tests on a separate free port in their terminal:

```powershell
$env:INGENIUM_PREVIEW_PORT = "5176"
npm.cmd run test:browser
Remove-Item Env:\INGENIUM_PREVIEW_PORT
```

To run just the region and demo-clock browser checks:

```powershell
$env:INGENIUM_PREVIEW_PORT = "5176"
npm.cmd run test:browser --workspace @ingenium/web -- separate-regions.spec.ts preview-clock.spec.ts
Remove-Item Env:\INGENIUM_PREVIEW_PORT
```

Screenshots/traces are generated under `apps/web/test-results` and other local
diagnostics under `apps/api/test-results`. They are ignored generated files and
can contain synthetic code or local test details. Browser checks do not certify
smooth frame rate on old physical laptops or full-event endurance.

`npm.cmd run start` runs the compiled API after a build. It does not start the
frontend, database or judge. Building a release with `npm.cmd run build:release`
creates an artifact; it does not deploy the app.

## 14. Real judging and first real Super Admin setup

There is no single Windows command that turns the previews into a live event.
The normal protected runtime needs the reviewed Linux clock, database roles,
private runtime files, application worker and installed judge services.

| Component                             | Existing command on its Linux host after installation/build | Configuration                                                              |
| ------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| API                                   | `npm run start`                                             | Restricted service settings; protected entry and competition runtime paths |
| Application judging coordinator       | `npm run start:judging`                                     | Private `JUDGING_RUNTIME_FILE`                                             |
| Judge supervisor on the judge host    | `npm run start:judge-supervisor`                            | Private `JUDGE_SUPERVISOR_RUNTIME_FILE`                                    |
| Judge HTTPS gateway on the judge host | `npm run start:judge-gateway`                               | Private `JUDGE_GATEWAY_RUNTIME_FILE`                                       |

These are an inventory, not an instruction to start services on the Windows
review laptop. Worker/judge processes do not load the API's `.env` as their
runtime configuration. Follow their installation/service guides on the correct
host instead of substituting API/owner credentials.

The first real Super Admin is created through restricted Linux operator tooling,
not a default public password or a SQL edit. Its existing `staff:bootstrap`
command requires deliberate first-setup confirmation and a private handoff path.
For everyday local admin review, use the automatically generated 5175 demo code.

Detailed references:

- [Local admin/contestant preview](docs/local-preview.md)
- [Participant interface and preview behaviour](docs/participant-ui.md)
- [Question reports and score corrections](docs/question-reports.md)
- [Primary-host service installation](infra/app-host/README.md)
- [App-side judging service](docs/judging-runtime.md)
- [Judge gateway installation](infra/judge-gateway/README.md)
- [Judge supervisor](docs/judge-supervisor.md)
- [Judge host verification](docs/judge-host-verification.md)
- [Staff operator recovery](docs/staff-operator-recovery.md)
- [Backup and restore](docs/backup-restore.md)
- [Current build/launch evidence](docs/build-status.md)

## 15. Useful source files

| Path                                       | What to look for                                             |
| ------------------------------------------ | ------------------------------------------------------------ |
| `package.json`                             | Root commands and workspace shortcuts                        |
| `compose.yaml`                             | Persistent local PostgreSQL service and port mapping         |
| `scripts/setup-env.mjs`                    | Safe creation of the paired local environment files          |
| `apps/api/src/server.ts`                   | Normal API startup/shutdown and optional runtime wiring      |
| `apps/api/src/config.ts`                   | Validated API host, port and runtime settings                |
| `apps/api/src/app.ts`                      | Health/readiness and protected route registration            |
| `apps/api/src/db/` and `apps/api/drizzle/` | Database schema/migration code and versioned SQL             |
| `apps/web/vite.config.ts`                  | Normal frontend port, API proxy and production asset policy  |
| `apps/web/src/Participant.tsx`             | Participant state, capture/open flow and workbench selection |
| `apps/web/src/Workbench.tsx`               | Question, editor, hints and judging interface                |
| `apps/web/src/Arena.tsx`                   | Map targets, pan/click interaction and termination effects   |
| `apps/web/test/preview-server.ts`          | Contestant-only synthetic preview backend                    |
| `apps/api/test/local-preview.ts`           | Complete local preview setup and temporary database          |

## Daily checklist

1. Open the repository in PowerShell.
2. Choose one mode; for admin plus contestants, open Docker Desktop and run
   `npm.cmd run preview:app`.
3. Use the correct printed URL and codes, with separate profiles for roles.
4. Keep the relevant terminals running while testing.
5. For a failure, check the countdown/live state, browser Console/Network, then
   the relevant backend/database terminal.
6. Save anything you want to keep before restarting a disposable preview.
7. Stop each foreground process with Ctrl+C; use `db:stop` only for the persistent
   development database. Keep its volume.
