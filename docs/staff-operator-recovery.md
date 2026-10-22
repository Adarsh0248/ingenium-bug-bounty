# Operator-Only Super Admin Recovery

This completes the code path for additional/replacement Super Admins and lost or
compromised codes. It is not permission to provision actual staff, migrate an
existing database or touch cloud services. No new public/admin HTTP endpoint,
master code, clock clearance, scoring change or last-admin bypass exists.

## Actions and Authority

| Action | Effect |
| --- | --- |
| `CREATE` | Add a fresh Super Admin after first setup, within the existing 50-enabled-staff limit. No existing identity is promoted. |
| `ROTATE` | Replace the selected Super Admin's code, including when the old code is lost/compromised. A disabled identity is re-enabled only with this fresh code and available staff capacity. |
| `DISABLE` | Retire an enabled Super Admin only after another Super Admin has a current, unrevoked, normal signed-in session. Revoke the retired code as well as sessions/flows. No identity or audit history is deleted. |

Only a separately approved non-root Linux maintenance account with actual local
ownership of the security/identity/credential/recovery tables can use the tool.
Ordinary API/worker database roles cannot issue these operations or read the
private operator audit. Merely granting CREATE on the public schema is not enough.
Normal Super Admin browser controls still manage only Owners/Organisers.

Verify the named operator and intended staff identity out of band before every
operation. Record the verification method/reference, not personal documents or
secrets, in `--verification`. It is an operator attestation, not automated identity
verification. The recorded OS account comes from the actual process account.
Use a separately approved and audited host session; in-app Super Admin authority
does not grant operating-system or cloud administration.

The transaction locks the existing exclusive security anchor, checks the exact
expected revision, applies the change and records immutable before/after state,
operator/OS identity, verification, reason, database-observed audit time and typed
credential issuance together. A fresh CREATE checks the security revision; ROTATE
and DISABLE check the target identity revision. Concurrent intents cannot both
consume the same target revision. Recovery records share the existing staff audit
capacity, but the API receives only an aggregate count, not operator details.

Rotation revokes the old verifier and its sessions, pending sign-in proofs and
encrypted delivery capsules in the same commit that installs the fresh verifier.
The last-active-admin guard remains unchanged: the transaction never needs to
disable it or keep a compromised old code valid. Other staff, participants,
arenas, admitted work, wallets and results are not changed.

## Private Configuration and Delivery

Build the API first. Install a private runtime JSON file outside the repository
and web roots, following `infra/maintenance/staff-maintenance-runtime.example.json`.
It contains exactly `schema_version: 1` and `database_url`, using the separately
approved local schema-owner account. Set `STAFF_MAINTENANCE_RUNTIME_FILE` in the
maintenance process environment to its absolute path. The command does not load
`.env`, `.env.staff-maintenance`, normal API credentials or migration configuration.

The runtime reader requires Linux, a non-root account, protected real ancestor
directories, a private regular single-link file and at most 8 KiB. No symlinks,
hardlinks, FIFO/devices, invalid UTF-8, writable ancestors or remote database URLs.
The database URL is never a command argument or printed by the tool.

For each new action choose one UUIDv4 request key and one absolute candidate file
path in an existing 0700 owner-controlled directory outside the checkout/web root.
The tool creates the candidate exclusively, mode 0600, and flushes both file and
parent directory **before** database mutation. It never overwrites or prints a code.
CREATE/ROTATE candidates contain the newly generated 160-bit code and exact original
intent/IDs; DISABLE candidates contain the original intent but no code. PostgreSQL
stores only the verifier, fingerprint and source-linked metadata.

These are command shapes for an independently authorised deployment, not commands
to execute on the development machine:

```text
npm run staff:recover --workspace @ingenium/api -- --inspect
npm run staff:recover --workspace @ingenium/api -- --inspect --staff-id <target-super-admin-uuid>
```

`--inspect` returns the security revision and up to 50 enabled Super Admin identity
snapshots; target lookup also finds a disabled identity. It returns no access code,
verifier, browser cookie, secret database URL or operator history.

```text
npm run staff:recover --workspace @ingenium/api -- --confirm OPERATOR_SUPER_ADMIN --action CREATE --request-key <uuid-v4> --expected-revision <security-revision> --name "<verified display name>" --operator "<operator label>" --verification "<out-of-band verification reference>" --reason "<reason>" --out /absolute/private/directory/backup-candidate.json

npm run staff:recover --workspace @ingenium/api -- --confirm OPERATOR_SUPER_ADMIN --action ROTATE --staff-id <target-uuid> --request-key <uuid-v4> --expected-revision <target-revision> --operator "<operator label>" --verification "<identity verification reference>" --reason "<loss or compromise reason>" --out /absolute/private/directory/replacement-candidate.json
```

Before distribution, compare request/staff/credential IDs to the committed status
and confirm `credential_current: true`. A retained file alone is not activation
proof; an old receipt is not proof its code is still current. Distribute privately
to the verified person, confirm normal sign-in and permitted admin-screen access,
then protect/remove the handoff according to the operator's secret-handling policy.
The CLI does not silently purge the sole recovery copy before acknowledgement.

## Verified Handover and Compromise

1. Create and privately deliver the replacement identity's code.
2. Verify that the intended person can freshly sign in normally and access the
   permitted admin screen. Obtain that current session's non-secret ID from the
   authenticated session projection or the approved operator diagnostic process.
   Merely inserting an identity/credential is not evidence of usable access.
3. Reinspect the old identity revision and deliberately retire it with the new
   identity's current session ID and a new request key:

```text
npm run staff:recover --workspace @ingenium/api -- --confirm OPERATOR_SUPER_ADMIN --action DISABLE --staff-id <old-super-admin-uuid> --replacement-session <verified-new-session-uuid> --request-key <uuid-v4> --expected-revision <old-target-revision> --operator "<operator label>" --verification "<verified handover reference>" --reason "<retirement reason>" --out /absolute/private/directory/retirement-candidate.json
```

Self-replacement, ordinary Owner/Organiser access, recovery-only sessions, expired
or revoked sessions/credentials and stale revisions cannot prove handover. A
latched clock incident blocks retirement: repair time and verify normal access
first. Credential rotation is still available out of band during access/time loss;
it does not clear a clock fault or grant normal timed access. Restore time through
the separate approved process before legitimate entry. Database timestamps here
are operational audit observations, never invented sporting timestamps.

For compromise of the sole administrator, **rotate its code immediately through
this protected procedure**, rather than leaving the compromised code usable while
waiting for a replacement identity. Deliver the fresh candidate privately and
verify entry. For total code loss, rotate a verified existing Super Admin identity;
no old application code/cookie is required. Never rerun first setup as a repair.
Host/schema-owner compromise is outside this tool's protection: isolate the host,
preserve evidence and use the independent infrastructure incident procedure.

## Lost Replies and Interrupted Commands

```text
npm run staff:recover --workspace @ingenium/api -- --status --request-key <original-uuid-v4>
```

Status is metadata-only and never repeats a mutation. `NOT_OBSERVED` is not proof
that an in-flight transaction failed. Preserve the original candidate and key,
reconcile the intended database/target, then use only that retained candidate for
an explicitly reviewed continuation:

```text
npm run staff:recover --workspace @ingenium/api -- --confirm OPERATOR_SUPER_ADMIN --resume /absolute/private/directory/original-candidate.json
```

Resume uses the original intent, IDs, code/verifier, expected revision and OS
account. Under the security lock, an existing matching outcome returns its original
record without issuing/revoking anything again. Changed intent/code under the same
key is a conflict. An obsolete receipt remains obsolete; resume cannot reactivate
a later-rotated or disabled credential. A partial/unsafe candidate is refused.

If the candidate/code is missing, first reconcile the original request; do not
guess completion, read a secret back from PostgreSQL or fabricate the candidate.
After the state is known, a separately reviewed fresh rotation issues a new code.
Stale/invalid/capacity refusals make no database changes; they are not an admitted
pending operation or an automatically retried queue. Review current state before
any deliberate replacement intent.

## Verification and Remaining Gates

Disposable tests cover real PostgreSQL ownership/grants, last-admin protection,
revocation, immutable/source-bound audit, exact-key duplicates/lost replies,
different-intent conflicts, revision races, capacity, verified retirement and
unchanged clock incidents. A restricted Linux container exercises the actual CLI
with a disposable database, including inspect, private candidate creation, resume,
status, normal replacement sign-in, retirement and fresh-code recovery. Separate
networkless Linux checks cover file permissions, exclusive creation and bad links.
The clocks and staff in these tests are explicitly synthetic, not actual host
repair or real staff provisioning.

No actual primary-host account, runtime file, database migration, staff code,
cloud resource or Git mutation has been performed. Named operators, private code
delivery, a backup person's real rehearsal, production time/service permissions,
backup/restore and full event-load/security checks remain launch requirements.
