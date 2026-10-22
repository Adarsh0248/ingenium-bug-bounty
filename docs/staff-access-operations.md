# Staff Provisioning and Management

This is an implementation/operator handoff, not approval to provision live staff,
apply migrations to an existing database or open event traffic. No real staff
credential has been created by these implementation tests. The normal
[browser staff-management view](staff-access-ui.md) now connects the routes below;
the separate [operator recovery command](staff-operator-recovery.md) now covers
backup/replacement Super Admin access. Actual host installation and deployment
rehearsal remain required.

## Authority Boundaries

- A protected operating-system/schema-owner maintenance command provisions the
  first Super Admin. Public visitors, team codes and the normal API database role
  cannot perform first setup. There is no master code or signup endpoint.
- A normal, current Super Admin session can create, rename, change the Owner /
  Organiser role, deactivate/re-enable and rotate codes for Owners/Organisers.
  Every new management command requires the acting identity's own current code,
  a reason, request key and expected revision. Another staff code cannot switch
  the actor. Owners, Organisers and recovery-only grants cannot use these routes.
- Browser management cannot create, promote, disable, demote, rename or rotate a
  Super Admin. The list may show their safe identity/status metadata, not codes.
  Additional/replacement Super Admins and compromised/total-loss access recovery
  use the separate protected operator workflow, not a browser workaround.
- Database guards preserve the last enabled Super Admin with an unrevoked code
  through coordinated concurrent changes. A credential rotation can revoke and
  replace its old verifier atomically; normal logout/expiry is never prohibited.
  Direct deletion of historical staff identities and receipts is forbidden.

## First Setup Prerequisites

Use a deliberately approved Linux maintenance session with named operator access
and separate local schema-owner credentials. Stop protected app services first;
the command refuses a running clock runtime or a reserved SETUP/IN_PROGRESS arena.
Verify the primary host's time and the intended empty-first-setup database before
running it. It does not run migrations, start a service, install software or
repair a broken clock. The schema must already include reviewed migrations.

The private `.env.staff-maintenance` supplies only
`STAFF_MAINTENANCE_DATABASE_URL`. It must be a loopback PostgreSQL URL with an
actual non-API schema owner; the command never falls back to `DATABASE_URL` or
migration configuration. Keep this file owner-readable only and out of the API
service environment. `.env.staff-maintenance.example` contains placeholders.
The Windows/local foundation deliberately cannot execute this operator CLI.

Choose a fresh UUIDv4 request key once and an absolute handoff file path in an
existing owner-only directory outside the repository. Its parent must be owned
by the maintenance user or root, without group/other permissions. Resolved
ancestor directories must also belong to that user or root and not be writable
by other accounts. The command
creates that file exclusively with mode 0600, never overwrites it and never
prints the access code. No secret is accepted as an argument.

After separately approving those prerequisites, the command shape from the
repository root is:

```text
npm run staff:bootstrap --workspace @ingenium/api -- --confirm FIRST_SUPER_ADMIN --request-key <uuid-v4> --name "<staff display name>" --operator "<verified operator label>" --reason "<setup reason>" --out /absolute/private/directory/first-staff-handoff.json
```

The candidate file contains the request, staff and credential IDs plus the new
random code. It is flushed before the database commit, so it can survive a lost
acknowledgement without needing secret readback from PostgreSQL. A candidate
file alone is not evidence of an active credential. The successful database
transaction links the first identity, verifier, operator receipt and issuance
source, then advances the security revision. Ordinary logs/receipts contain no
raw code. Distribute privately only after matching the committed receipt IDs.

## Unknown Setup Completion

Preserve the candidate file and original request key. Do not overwrite it, rerun
with a new key, delete staff rows or set a bootstrap flag manually. Query metadata
using the same restricted maintenance configuration:

```text
npm run staff:bootstrap --workspace @ingenium/api -- --status --request-key <original-uuid-v4>
```

`RECORDED` returns only the original source/staff/credential IDs; compare all of
them to the retained candidate file before distributing its code. `NOT_OBSERVED`
is not proof that an in-flight transaction failed. A missing/different candidate
file or lost code requires the separately protected operator recovery workflow;
the first-setup command cannot create another Super Admin as a repair. Do not
weaken the last-admin guard or introduce a guessed replacement code. The actual
operator host/file-permission and crash/recovery rehearsal is still required.

## Normal Staff Management API

All routes use the explicit STAFF cookie audience, configured same origin,
staff-bound CSRF for writes, JSON schemas, non-sensitive errors and no-store
responses. The 16 KiB ordinary-command body allowance does not relax the 120-byte
UTF-8 name or 1 KiB reason limits. Big integers are canonical decimal strings.

| Route | Purpose |
| --- | --- |
| `GET /api/v1/staff/staff-identities?after=<optional UUID>` | At most 50 safe identity/status records, security revision and stable UUID continuation. No offset pagination, raw code, verifier or session cookie. |
| `POST /api/v1/staff/staff-identities` | Create OWNER/ORGANISER using `request_key`, security `expected_revision`, `display_name`, `role`, `reason`, `own_code`. |
| `POST /api/v1/staff/staff-identities/:staff_id/update` | Set reviewed name, OWNER/ORGANISER role and `enabled`, with that identity's `expected_revision` and the same command controls. |
| `POST /api/v1/staff/staff-identities/:staff_id/rotate-code` | Issue a fresh code with that identity's expected revision; revoke the old code, sessions, proofs and encrypted deliveries atomically. |
| `GET /api/v1/staff/outcomes/staff/CREATE/security/:request_key` | Current actor's original create receipt, or NOT_OBSERVED. No code redelivery. |
| `GET /api/v1/staff/outcomes/staff/UPDATE/:staff_id/:request_key` and `ROTATE` | Current actor's original target-bound receipt under current Super Admin permission. |

New commands use the current expected revision from a fresh authorised read.
Matching concurrent retries return one original immutable outcome. A different
payload/expected revision with that same scoped key is a conflict. Stale version
and staff-capacity rejections persist: later state changes cannot make the old
intent execute. Deliberate revised intent uses a new key only after reviewing
the known result/current state. Initial capacity is 50 enabled identities;
deactivated history is retained and can still appear on paginated reads.

An applied create/rotate response includes `issued_code` once. PostgreSQL retains
only its verifier and a typed issuance link. A retry or outcome read returns the
original receipt without another code or another rotation. If delivery is lost,
first reconcile the identity/outcome, then deliberately rotate its code using a
new reviewed intent. An original receipt is not a current-resource snapshot.
Unchanged updates, rejections, reads and duplicate receipts never renew idle
activity. Successful new management changes may renew only the acting valid
session's idle deadline, not its absolute expiry.

Name, role, enabled-state and code changes revoke affected existing grants and
pending proofs/capsules. Re-enabling an identity never restores its old cookie;
it permits fresh normal own-code staff entry. Removal of access never deletes
the identity's prior sources/audit. The API role retains no direct identity/code
write permission; the scoped database effect operation rejects Super Admin
targets and requires a real bound source/current normal Super Admin actor.

## Remaining Launch Work

The first-setup and recovery tools have not been run against the actual primary
Linux host. Recovery now has disposable PostgreSQL and real restricted Linux CLI
coverage, not a live operator deployment. Full role-filtered audit views,
production revocation/delivery rehearsal, event-load and backup/restore checks
remain required. There is no supported SQL/master-code shortcut for those gates.
