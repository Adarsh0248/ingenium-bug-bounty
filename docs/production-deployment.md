# Production deployment status

Verified 29 October 2026. The public website and first Super Admin access are
installed and tested. The competition is not ready to start: this database has
no registered judge epoch or published questions. Overall engineering completion
remains roughly 96%; it is not a launch certificate.

## Website and control room

- Website: https://8-231-75-42.sslip.io/
- Enter the privately delivered Super Admin code in **Team or staff code**,
  choose **Enter arena**, then **Open control room**.
- Staff access uses the main entry page. `/admin` deliberately returns 404.
- The Super Admin can configure the arena roster/duration and manage staff and
  content. Starting rounds still requires a healthy installed judge and published,
  protected-host-validated questions.
- No arena or round was created or started during administrator verification.

The code is outside Git in a private local handoff at
`C:\Users\adars\AppData\Local\Ingenium\private-access\super-admin-access.txt`.
Its Windows directory permits only the current user and SYSTEM. A matching
owner-only distribution file is retained in the operator's VM home. The original
root-only candidate and request are under `/var/lib/ingenium/operator-access`.
Never copy codes into this document, logs, test evidence or public files. Do not
run first-admin bootstrap again; use the reviewed recovery workflow if needed.

## Initial application installation

Project `project-8359d400-686c-4df3-a64`, zone `asia-south1-a`, VM
`ingenium-app-01`: Ubuntu 22.04, two CPUs, 8 GiB RAM, private IP `10.42.0.10`.
The external address `8.231.75.42` is reserved as `ingenium-app-ip` and attached
to this VM. Public web traffic reaches ports 80/443 only through the app tag;
administration uses IAP SSH. Both old judge labs remain stopped and preserved.

The data disk is mounted at `/srv/ingenium`. Docker/containerd and PostgreSQL
store persistent data there. PostgreSQL 17.11 listens on host loopback only;
all 88 migration hashes were checked. API and judging database accounts and
Linux users are distinct and restricted.

The installed, immutable application candidate is Git revision
`e5b0369270b51a9afb68d13e26abc98a73fe31d0`, under `/opt/ingenium/release`.
Its release manifest SHA-256 is
`be9ed6ae5dc6d6fbcaa482d5c609cb4eaff1a0ad7708e16e210503026590c7bf`.
The archive SHA-256 is
`a535dabf67d309f0d894b9cff2d2bb05c861e4db1129d3494da55081dbd728a6`.
Production dependencies were installed on Linux from the reviewed lockfile.

The API runs under systemd as `ingenium-api`, on `127.0.0.1:3000`.
`20-entry-setup.conf` intentionally removes `COMPETITION_RUNTIME_FILE` until
the real judge descriptor is available. Do not install placeholders or synthetic
readiness. Chrony uses Google's metadata time source; the API passed its normal
seven-observation qualification after the clean administrator-bootstrap restart.

Caddy 2.11.7 serves the public frontend and proxies `/api` to the private API.
Its certificate passed normal client verification. Hashed assets use immutable
caching and precompressed Brotli/gzip; the entry HTML is not cached. Caddy's
administration API is disabled, so validate configuration and use a controlled
restart for changes rather than `caddy reload`. `caddy-api.service` stays masked.

## Verification and remaining work

At initial installation, a real Chromium browser verified the privately issued code, normal staff entry,
Super Admin authority, the control room, arena configuration reads and staff
management. The smoke session signed out. Read-only database checks then confirmed
one committed bootstrap, one enabled Super Admin, zero active staff sessions,
zero arenas and a healthy clock. Public checks confirmed HTTPS, compression,
caching and six blocked private paths.

Source-free evidence is under ignored `apps/web/test-results/`:
`production-admin-smoke-20261029.json` and
`production-admin-control-room-20261029.png`. No credential appears in them.

Still required for full event deployment:

1. Install/qualify the separate judge and its private TLS connection, then wire
   the app judging worker and competition runtime to the actual descriptor.
2. Stage the actual question packs and complete protected validation/publication;
   local compiler success does not replace this.
3. Install encrypted off-host backups, verify restore, and configure operational
   alerts and bounded log retention.
4. Import the actual registration export and complete the outstanding capacity,
   device/network and operator launch checks in `pre-deployment-readiness.md`.

## Admin workspace release — 29 October 2026

The follow-up release improves manual teams/questions, editable arena drafts and
normal staff setup permissions, and replaces repeated staff-code entry with
session-based action authorization. Migration 0088 brings the total to 89.
See [staff console](staff-console.md) for the current permission and UI policy.

Deploy candidates into `/opt/ingenium/releases/<git-revision>`, verify every
manifest file and install Linux production dependencies before activation. Keep
the previous immutable release. During activation, stop the API cleanly, check
the clock stopped without a latched fault, take a private PostgreSQL custom-format
backup under `/srv/ingenium/backups/`, apply and verify migration hashes, then
switch `/opt/ingenium/release` to the new directory and restart. The normal clock
warm-up and public HTTPS checks must pass before declaring the update live.

The deployment receipt at `/var/lib/ingenium/deployments/current.json` records the
source revision, manifest/archive digests, previous release, backup and checks.
Existing staff credentials, teams and arena history must be preserved. The
pre-update inspection found three staff identities, two teams and three draft
arenas; no round was running. Do not bootstrap another Super Admin.

This website/admin update does not install the competition judge or start an
event. Keep `20-entry-setup.conf` until an actual qualified judge descriptor and
protected question publication are available.

The earlier failed judge-capacity records, held permits and old lab disks remain
untouched. No infrastructure guard, result or clock fault was bypassed.

## Event question library update — 29 October 2026

The next release separates the staff question library by round and adds an
authenticated, atomic question import using the existing authoring guards. No
additional database migration is needed; the migration count remains 89.
The production preflight found zero questions and zero runtime manifests.

Load the reviewed packs through `scripts/import-event-questions.mjs` after the
release passes readiness. Keep its private progress receipt outside the source
tree and verify the resulting 50/100 definitions, 600 language variants, 450
hints, 1,135 test cases and 600 hidden starter witnesses. All remain drafts until
actual runtime configuration and protected validation/publication. See
[event question library](event-question-library.md) for the import procedure.

The website release receipt remains `/var/lib/ingenium/deployments/current.json`.
A separate private post-import database backup and source-free verification
receipt retain the question counts and pack hashes. Existing arena/team/staff
rows are preserved, and importing does not configure or start any arena.
