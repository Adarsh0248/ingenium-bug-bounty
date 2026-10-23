# Primary Application Services

These are deployment candidates for the **primary application/PostgreSQL host**,
not the isolated judge VM. They do not install or start anything. The existing
cloud operations rehearsal must not install these units, create service users,
change chrony or replace the retained judge lab.

## Two Separate Processes

`ingenium-api.service` runs the compiled API, its clock monitor and scheduled
event maintenance. `ingenium-judging.service` runs the existing app-side judging
coordinator, which contacts the separate private judge. Neither service compiles
participant code locally, mounts Docker or gets the judge host's root authority.

The definitions use systemd's direct process execution and finite restart policy,
not an npm shell or a custom supervisor. Starting a process is not application
readiness. These choices follow the [service documentation](https://www.freedesktop.org/software/systemd/man/249/systemd.service.html).

## Required Installation Layout

| Path | Purpose and ownership |
| --- | --- |
| `/usr/local/bin/node` | Reviewed Node 24.22.x executable; root-owned and protected parents |
| `/opt/ingenium/release` | Reviewed compiled API, public web build, production dependencies, migrations and `infra/clock-agent/probe.py`; read-only to service accounts, protected root-owned tree |
| `/etc/ingenium/api` | API-private directory: `entry-runtime.json`, `competition-runtime.json` and `process.env` |
| `/etc/ingenium/judging` | Worker-private directory: `runtime.json` with its own DB login and private judge TLS material |

Provision distinct non-login `ingenium-api` and `ingenium-judging` OS accounts
without sudo or Docker-group membership. Private directories must be mode 0700
and readable only by their own service account/root. Runtime JSON files must be
single-link regular files, mode 0400 or 0600, owned/readable by their intended
account with protected real parent directories. Keep deployment files and the
Node/Python/chrony executables root-owned and not group/other-writable.

`process.env` is root-owned mode 0600 and contains **only** the API's loopback
`DATABASE_URL`. The service manager reads it; it is not a repository `.env`.
Never put an owner/migration URL or worker TLS secrets in it. API startup verifies
the restricted connected role. The worker's separate private JSON must use its
dedicated restricted login. Follow the [runtime file shapes](../../docs/judging-runtime.md)
and [clock requirements](../clock-agent/README.md); no real secrets are generated
by these files. The API URL is present in that process's environment, so OS/root
is part of its trust boundary; do not expose environment/debug dumps in support
output. See [execution environment security](https://www.freedesktop.org/software/systemd/man/249/systemd.exec.html).

The shared host network remains available for loopback PostgreSQL/chrony and
the worker's configured private judge endpoint. Firewall review is still required.
Do not enable a private network namespace: a different `127.0.0.1` cannot reach
the host's DB or clock monitor. `/proc/uptime` and the host boot ID must remain
readable. V8 needs executable JIT memory; do not add `MemoryDenyWriteExecute`.

## Resource and Shutdown Policy

The API's initial ceiling matches its Linux-local load harness: one CPU, 768 MiB
and 128 tasks, with twelve API plus two clock-monitor database connections.
The coordinator has a half-CPU/384 MiB/64-task ceiling and four DB connections.
These are candidates, not a measured whole-host budget or throughput promise.
Allow separately for PostgreSQL, Caddy, operators, backups and the OS; keep
total connection headroom rather than increasing pools to hide contention.

Both units have three starts per minute, a five-second restart delay and a
45-second graceful-stop allowance. Restart does not clear a clock incident,
resubmit code, release held physical slots or make an uncertain result reliable.
After forced termination, inspect the saved clock/worker/recovery state. Do not
repeat migrations, bootstrap credentials, reset permits or clear history as a
restart hook. The units deliberately contain no such hooks.

Journald receives the existing bounded application diagnostics, not raw proxy
access logs. Production journal size, seven-day retention, alert delivery and
operator access still need installation and verification.

## Future Authorised Host Rehearsal

Only after the primary host, accounts, reviewed files, DB, private settings and
chrony are separately provisioned and approved, validate the definitions there:

```bash
sudo systemd-analyze verify /opt/ingenium/release/infra/app-host/ingenium-api.service \
  /opt/ingenium/release/infra/app-host/ingenium-judging.service
```

Do not enable these on boot or start an arena as part of syntax validation. A
reviewed deployment must still install the units into `/etc/systemd/system`,
test ownership/cross-account denials, verify real clock warm-up and deliberate
fault/restart handling, observe local readiness, exercise the private judge and
run the built web app through the [same-origin HTTPS edge](../../docs/https-edge.md).
The official Caddy service remains separate; do not replace it with an app unit.

Local policy tests check the fixed definitions against the actual source entry
points and resource/security boundary. They do **not** replace systemd parser
validation or service execution on the actual primary host. No service has been
installed, enabled or started by this batch.

## Local Regression Checks

The default disposable database suite still runs the complete matrix. Its
fifteen-minute outer allowance includes deliberate cooldown/expiry waits; none
of the application's request or judging deadlines is changed. To run just the
core host-facing database/access/clock checks in a fresh disposable database:

```powershell
$env:INGENIUM_TEST_SUITE='foundation'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

This selector does not test real systemd, public HTTPS, the installed judge or
production data. Keep a timed-out/cancelled full run marked incomplete even when
separate groups pass.

The 23 October follow-up now has an uncancelled full run: all 341 combined
database checks passed. Finished clock fixtures release their own migrated
databases instead of accumulating them inside the unchanged bounded test store.
That result does not validate these service units on the actual primary host.
