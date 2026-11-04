# Private Judge Registry And Gateway

This is the new general authoring ingress/registry, not another historical lab
controller. The application-side client contract is in
[judge-protocol.md](../../docs/judge-protocol.md). The HTTPS server and PostgreSQL
access live under `apps/api/src/judge/` so they reuse the installed Node/Fastify/pg
tooling; they are **not mounted in the competition API**. Deployment must run the
gateway separately on the judge VM, with judge-only credentials and mounts.

## Implemented Flow

1. A pinned mutually authenticated TLS client calls the gateway. It checks the
   actual private peer address, exact authorised client leaf fingerprint, Host,
   epoch and fresh request UUID before parsing source. No forwarded identity,
   browser Origin, query string, compressed body or arbitrary execution option.
2. The same strict protocol code validates exact byte transport, frozen runtime,
   path/header/body identity and digest. PostgreSQL independently rechecks all
   immutable payload fields, limits and the typed payload digest.
3. One short judge-only transaction creates the actual `submissions` record,
   immutable attempt/provider association and durable outbox entry. A concurrent
   duplicate gets the original association; a different intent is rejected. A
   failed response or uncertain commit never authorises automatic POST retry.
4. The judge-only publisher redelivers identities after an ambiguous Redis
   acknowledgement, or reconstructs acknowledged unclaimed jobs after queue loss.
   `claim` gives only one delivery the durable launch permit;
   its result is returned to a launcher only after transaction commit succeeds.
   Duplicate delivery, the same owner or a replacement process cannot reclaim it.
5. The trusted supervisor may seal bounded validated evidence under its captured
   owner/token/attempt. Immutable result evidence excludes drain, allowing later
   positive cleanup proof without rewriting the result. No HTTP route can submit
   evidence, reset a permit, erase history or grant readiness.
6. GET resolves only that exact association and validates the saved evidence
   before returning it. Responses contain no submitted source or stdin. Missing
   records remain pending/uncertain at the application; they are not drain proof.

## Database Boundary

For a fresh production registry, `provider-schema.sql` contains the complete
association schema translated from Judge0 1.13.1's pinned `db/schema.rb`. It keeps
all upstream columns and the token index. Apply it once to a new, empty private
database, then apply registry migrations 001–007. The protected executor owns
compilation, verdict evidence and cleanup; no stock Judge0 worker is installed.
The smaller `test/provider-structural.sql` remains a rehearsal fixture and must
not be substituted for this production schema.

`001_registry.sql` is a separately reviewed **judge-database** migration, outside
the competition app's Drizzle history. It requires the pinned Judge0 provider
schema and creates `ingenium_judge`, four private tables and narrow functions.
Apply `002_queue.sql` after it to add the narrow publisher role and delivery-state
queries, then `003_execution_lookup.sql` for supervisor-only read access to an
already consumed execution's original owner and result. `004_launch_gate.sql`
then adds the immutable once-only backend-start field/function and forbids sealing
before start. All four migrations must be installed on the new empty general
registry before admitting attempts; 004 refuses existing history. Never clear
records to make it apply. These migrations create no host settings or credentials.
All four migrations are
deliberately not rerunnable and have no drop/reset or startup auto-migrate
path. Failure rolls back the installer. Do not apply it to the old experiment
database or any existing environment merely to try it.

`005_participant_payloads.sql` adds the strict sample/official payload roles;
`006_supervisor_service.sql` adds singleton service ownership, renewal and narrow
held-attempt inventory. `007_eight_slots.sql` installs the architecture's bounded
eight-permit ceiling while preserving every old owner/result/hold. Production
starts eight independent workers and nine queue clients; actual host calibration
is a separate gate. Fresh installers include all seven files, never an automatic
startup migration. The retained historical test databases are not upgraded.

- The installer creates no host, runtime mapping, LOGIN/password or credential.
  It creates only NOLOGIN privilege groups: `ingenium_judge_gateway` for
  readiness/admission/lookups and `ingenium_judge_supervisor` for heartbeat,
  outbox acknowledgement, one-time claim, evidence sealing and scoped lookup.
  The follow-up adds `ingenium_judge_publisher`, which can only list source-free
  unclaimed identities, inspect a delivery's permit state and acknowledge outbox
  publication. It cannot read payloads, heartbeat, claim or seal results. None of
  these groups can read tables, mutate history or assume another role.
- An operator must provision a new reviewed epoch with its actual Linux boot UUID
  and five immutable runtime mappings. Each mapping also pins the full provider
  language row fingerprint, not a guessed public language ID. Language command /
  archive drift invalidates readiness, new registration and dispatch.
- There is initially no readiness. A trusted supervisor must first verify its
  environment and then renew a thirty-second lease with its proof digest. Its
  continuous [supervisor](../../docs/judge-supervisor.md) now obtains fresh
  challenge-bound launcher evidence before renewing that lease. Its production
  full-host verifier/retirement composition is implemented, but its positive
  [real-host calibration](../../docs/judge-host-verification.md) and installation remain pending.
  Calling heartbeat with fabricated evidence cannot enable a real event safely.
- ACTIVE may become FENCED, never the reverse. Epoch/boot/runtime identity cannot
  be repurposed. Fencing blocks new admission/claims/deliveries but retains old
  reads and matching late cleanup. It does not stop a previously permitted
  process, prove the old sender cannot resume or retire a host. Real retirement
  still needs the approved process/ingress/queue/credential stop proofs.
- Initial authoring bounds: 120 physically unresolved records, two consumed but
  undrained launch permits, 10,000 retained rows and 4 GiB accounted payload/result
  space. Admission reserves the canonical payload, 2 MiB result allowance and
  8 KiB overhead; sealing releases unused allowance. Capacity refusal rolls back
  provider/outbox/budget together. No evidence is evicted or queued work dropped.
  These conservative implementation ceilings are not throughput/load evidence.
- Gateway process bounds are sixteen in-flight HTTP requests, two POST bodies,
  2 MiB body, 16 KiB headers and a ten-second request lifetime. Authority is checked
  before body parsing. Database functions are transactional with bounded lock and
  statement waits. The standalone gateway entry point now fixes a four-connection
  pool, one-second connection and 2.5-second query deadlines, a private listener,
  current Linux boot and restricted database-role preflight. Installed OS/network
  connection limits, disk monitoring and real-host calibration remain required.

The provider insert was checked against the upstream
[Judge0 1.13.1 schema](https://raw.githubusercontent.com/judge0/judge0/v1.13.1/db/schema.rb)
and [Submission model](https://raw.githubusercontent.com/judge0/judge0/v1.13.1/app/models/submission.rb).
Source/input are stored in the provider's Base64-backed fields; callbacks,
expected output, per-process budgets, network, extra flags/files and stderr merge
are not enabled. CPU milliseconds retain their fractional seconds. The provider
envelope uses at least one wall second and 2,048 KiB to satisfy its model floor;
the immutable actual execution payload retains its original exact lower limits.
The protected executor enforces those exact payload values. Neither
the provider envelope nor a stock worker may override them.

The new outbox/Redis stream is not the stock automatic `IsolateJob` queue. No code
publishes or starts a stock worker here. The protected executor and the bound
result/accounting mirror are implemented, with installed five-language evidence
and separately documented concurrency limits. Before deployment, qualify the
actual provider schema/configuration/image; the clean-host rehearsal uses an
explicit structural provider fixture. Registered stock rows remain queue
placeholders; ordinary stock status is not this protocol's result authority.

## Judge-Only Queue

`createJudgeQueue`, `publishJudgeTurn` and `claimJudgeDelivery` are internal
components, not HTTP endpoints, app services or background loops. They use the
official pinned `@redis/client` protocol client, not an additional queue framework.
Redis remains confined to the judge host's trusted local/container network with
its own generated 64-hex-character password. It must not be exposed to browsers,
the internet, participant code or the competition API. The client accepts only
a configured fixed private IPv4/loopback destination, not a supplied URL or DNS
name. This plaintext local transport is not suitable for an untrusted network;
review isolation/ACLs before installation. No production Redis or credentials
are installed by this batch.

- A stream key binds both immutable host epoch and Linux boot UUID. Entries have
  only attempt UUID and provider token, never code, stdin, expected answers or
  results. The stream has a hard 120-entry cap without trimming or eviction.
  Publication checks the bounded stream in Lua, returning an existing identical
  identity or adding one entry. Conflicts/corruption fail closed. The publish
  script has only one write; it does not rely on rollback of earlier Lua writes.
- A publication turn reconciles at most 120 entries, removes only messages whose
  PostgreSQL launch permit is already consumed, then republishes up to 120
  unclaimed registered jobs. Previously acknowledged jobs remain candidates:
  `published_at` is historical delivery evidence, not proof Redis retained data.
  Lost Redis or PostgreSQL acknowledgement is reconciled on the next explicit
  turn. No database transaction is held over a Redis request.
- A fixed consumer group and stable consumer name read pending messages before
  new ones, so a lost read response/restarted receiver finds the same message.
  Duplicate processes may receive it, but only one fresh committed PostgreSQL
  claim returns the frozen execution payload. That result is the only potential
  launch authority. A lost claim response leaves the consumed permit held.
  The receiver deliberately makes no extra Redis call after a fresh claim that
  could hide its return value; the next turn removes the consumed delivery.
- Delivery acknowledgement/deletion does not seal a result, prove cleanup or
  release a physical slot. Two consumed/undrained jobs still block another claim.
  Unknown identities are retained for inspection, not purged or executed. Expired
  readiness, foreign boots, runtime drift and fencing still prevent new claims.
- The client permits one operation at a time, bounds its command queue, disables
  offline replay/reconnection and destroys the connection on caller cancellation
  or a ten-second total operation deadline (two-second TCP connect timeout).
  A failed connection requires a new queue instance and explicit reconciliation.
  These are transport deadlines, never proof that a write did not happen.

The implementation follows the official [Node Redis client configuration](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md)
and [command cancellation limits](https://github.com/redis/node-redis/blob/master/docs/command-options.md).
Its whole-operation timer closes the socket because cancelling a command alone
does not cancel one already written. Redis documents [stream consumer groups](https://redis.io/docs/latest/commands/xreadgroup/)
and [atomic Lua execution](https://redis.io/docs/latest/develop/programmability/eval-intro/).
This authoring transport does not replace the approved application-side official /
sample scheduler, fair team rotation or 3:1 dispatch policy.

## Execution Handoff

The [execution/recovery worker and fixed Linux launcher client](../../docs/judge-executor.md)
now connect the guarded queue to validated result sealing. A fresh turn calls
the launcher only after a committed claim. Recovery can read the original permit
and retained evidence but never grants another launch. Lost sealing acknowledgements
resolve from the database; partial cleanup remains held until matching proof.

The actual root-owned general sandbox launcher and physical checkpoint producer are not yet
implemented or installed. The fixed historical lab controllers are not used as
general executors, and test fixtures must never be installed or mint real readiness.
The Linux client/descriptor tests use only benign synthetic protocol responses.

The general launcher **control core** now validates READY/EXECUTE/RECOVER requests
against the saved owner/token/payload, commits the immutable backend start before
calling a producer, and seals validated output before reply. Duplicate or uncertain
starts are not repeated. A code-owned five-language plan fixes filenames, argv,
environment and budgets, including retention of all Java artifacts. This is not
the actual Linux isolation/evidence backend; native enforcement and physical
checkpoint/recovery remain required. Protected result storage now saves validated
bytes before PostgreSQL sealing and recovers them after a producer failure,
without another backend start. Cleanup proof is append-only and separate from
the result. Native process/workspace identities, hard disk quota, production
installation and power-loss rehearsal remain required. Nothing is installed or
enabled by import. See [result checkpoints](../../docs/judge-executor.md#protected-result-checkpoints).

The native pre-exec helper and bounded phase pipe collector are now implemented.
Real fixed C17/C++17 fixtures test the restricted identity/environment and closure
of inherited control descriptors, including descriptor 400. The Isolate command
builder rejects altered plans. There is still no runnable general kernel backend:
source/workspace preparation, cgroup accounting, protected resource identities,
runtime/filter verification and immutable installation remain required. A native
witness is not evidence that the target ran, compiler blame or physical drain.
See [native phase handoff](../../docs/judge-executor.md#native-phase-handoff).

## Verification Boundary

Tests use an owned disposable PostgreSQL database, a minimal structural fixture
of provider tables, synthetic runtime records/evidence and temporary local mTLS
certificates. They prove atomic association/outbox, exact digest/bytes, duplicate
admission/delivery, one-time permits across replacement store instances, role
separation, immutable seals/later drain, physical/queue/storage limits, boot and
runtime drift, private response handling and the real HTTPS client/server flow.
Pre-existing synthetic provider data is preserved. No fixtures execute source.

The complete local suite after the native phase batch passed 105 unit/HTTPS/
transport tests, 172 PostgreSQL/Redis/HTTP/clock checks, twenty-five additional Linux
adapter/checkpoint/native checks (two harnesses) and four Python probe tests, with no skips. Type
checking/build, unchanged competition-schema generation and dependency audit
also passed. Owned test containers, the checkpoint volume and temporary credentials/certificates were
removed. Queue tests include real volatile Redis restarts, more than sixteen
registered jobs, concurrent receivers, lost publication/claim acknowledgements,
retained physical uncertainty, source-free payloads, role separation, malformed
entries and the hard 120-entry cap. Network tests use real unresponsive TCP peers
to check cancellation and the whole-operation deadline without reconnect/replay.
Execution tests also cover real child-process pipes, original-owner read-only
recovery, lost result/seal replies, malformed bindings and immutable late cleanup.

This is not a real Judge0 image/engine test or evidence that arbitrary compiler
failures are safely attributable. Required next work remains: protected general
isolate producer, supported five-language runtime verification,
actual supervisor health/clock/boot checks, service/secret/network installation,
physical crash/fencing/retirement and hostile-code/load rehearsals. There is no
gateway production CLI, real host registration or deploy command in this batch.
Normal app startup remains unchanged and cannot admit live validation work.
