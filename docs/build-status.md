# Build Status and 22 October Target

Updated: 26 October 2026. The user requires the full approved initial application
by 22 October, not a demo, silently reduced MVP or feature-skipping release.
The 22 October target was missed. It is not a completion or event-readiness guarantee.

The approved `architecture.md` remains the source of competition rules, scope
and launch gates. Features already explicitly deferred there remain deferred;
this checklist does not introduce further exclusions. No architecture change,
assistant Git operation, additional cloud spending or live launch is authorised
by this document.

## Delivery Method

- Current priority: finish connected functional MVP slices before additional
  frontend polish. This changes implementation order, not the approved feature
  inventory or the event-readiness gates.
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
- Include a brief rough whole-project completion estimate in each user-facing
  progress update and final reply, separate from test counts and launch readiness.

## Completion Estimate

Roughly **95% of the complete approved initial scope**, as an engineering estimate
on 26 October. Backend/access/authoring/judge components have substantial local
evidence, including the normal competition/economy backend and participant job
orchestration, private workbench drafts and local realtime synchronisation. The
first participant interface, 3D field, normal arena controls, staff-account and
browser-replacement views, draft authoring, validation history/reports, reviewed
publication, manual team registration/code management, CSV import and staff
block/manual-time discipline, whole-round cancellation and restricted timing
recovery, participant results/history, normal staff judging/recovery and bounded
automatic event maintenance and a separately runnable app-side judging service
and operator-only Super Admin credential recovery, audited submission review
and private authoring diagnostics, general staff audit navigation and scoped live
announcements, private registration search and standalone team-code revocation/
reissuance, safe final-results export and guarded database payload retention /
read-only cleanup operations and a locally tested same-origin production HTTPS
gateway, an encrypted physical backup/isolated restore drill and offline restored
access/epoch quarantine, private operations observation and offline read-only
recovery inventory, separate private judge gateway and continuous supervisor
entry points with protected runtime loading and bounded automatic work now exist;
exceptional recovery, installed judge and deployment/launch gates remain incomplete. This is
not a measured task percentage, a deadline promise or an event-readiness score.
Small internal batches do not automatically move the whole-project estimate.

## Continuous Judge Services Milestone

### Current verification boundary, 25 October

Latest update: the individually guarded v9 and v10 executions pass all five
languages. A startup-signal lifetime regression failed before its fix and the
Linux installation suite now passes 23 inner checks. The 2-CPU VM still missed
five-second concurrent readiness observations, so the user approved resizing the
same test VM to `e2-custom-6-24576`. That earlier test boot was
`c0838d0f-8771-4260-b73f-d255968f434a`; three concurrent observations then passed
in 2.50–2.60 seconds, including while an execution was active. The new epoch is
`3ced2a8c-8d52-4167-99b3-903b9bb5d24d`. The original failed attempts remain held
under their fenced epochs; no permit was reset.

The five-hour continuous two-worker test began around 13:13 UTC (18:43 IST) on
25 October. With the user's approval to use today's time efficiently, it stopped
after 52 complete batches / 312 jobs / 82.6 minutes, across all five languages
and fourteen negative/boundary fixtures, with actual mTLS, Redis, accounting and
physical cleanup. Every accepted record was drained before stopping. Five
uninterrupted hours remain **unverified**. These measurements
do not prove the architecture's target of eight execution slots or 100-team
mixed compiler capacity; that earlier run used two physical permits.

A new full two-round harness passes both its synthetic-judge preflight and actual
participant compilation through a private SSH/mTLS bridge, with
restricted database worker credentials: samples, independent awards, score reset,
wallet carryover, ordered paid hints, five-minute wrong penalties and one shared
winner. Its fixture setup respects real cooldowns and staff rate limits. This
fixture setup uses synthetic time and publication validation. No
competition database or browser service is installed on the judge VM.

The installed active-crash rehearsal now passes interruption with two UID-60000
processes, read-only recovery, explicit original-ID physical retirement and a
refused duplicate launch. Its original consumed permit stays held because no
reliable verdict exists. Original observer failures and records are preserved.
The 50-team Linux race now measures actual PostgreSQL transaction commits and
passes 300-tab claim-event/projection p95 of 814 ms and p99 of 835/836 ms with
browser generators separate from the API's CPU allowance. A stale editor
renewal after a claim previously caused reconnects; its regression fails before
the fix and all 25 live checks pass afterward. The local 600-tab mixed soak passes
3,607,324 actual milliseconds, 52,000 metadata reads, 1,040 drafts, 260 samples
and settlement of 100 original synthetic official submissions. Its clock and
judge are synthetic; reconnect/backpressure history remains reported. The latest
complete PostgreSQL suite passes 348 checks. The DB-backed browser matrix passes
116 checks across ten suites after fixing an admin background-refresh race.

The production judge now wires eight independent workers, nine queue clients and
the separately reviewed `007_eight_slots.sql` limit. The focused DB matrix passes
49 checks, including no change to old holds and concurrent refusal of a ninth
permit. The first actual eight-worker trial on a fresh epoch failed readiness
under load. Its 20 new associations, seven consumed permits and four started
executions remain preserved. Expensive pre-claim verification is now serialised
without removing any check or reducing the eight execution slots. That second
host trial also failed readiness: eight original permits remain held (seven
started), and all 25 provider/attempt/outbox associations are preserved. Idle
readiness passes, but eight concurrent observations take 4.3–4.6 seconds before
compiler load. Read-only scheduling calibration reduced the foreground check to
3.1 seconds by lowering background priority. Execution/recovery now yield CPU
priority while readiness retains its normal priority; all file, peer, boot,
policy, budget and five-second deadline checks remain. The Linux regression
fails before that fix and passes afterward, including 24 installation checks.
That next trial reached eight started jobs but stopped at worker retirement,
with six saved results and no sealed release. Read-only checkpoints place the
first failure after its original groups and configuration were removed, at the
full-host reference observation. All 25 database associations remain unchanged.
Whole-host inspections are now ordered with a session-owned advisory lock;
compilation retains eight slots and the observer keeps every check and its
five-second bound. The 50-check focused DB suite passes serialization, callback
failure, waiting cancellation, lost-session abort and original-history checks.
That coordinated trial also stopped at retirement. The captured storage devices
were reused by newer capsules before the original whole-host inspection finished.
The judge correctly kept the uncertain permits held; increasing the scan deadline
would not fix that identity collision. The host now retains four verified,
close-on-exec namespace handles until retirement, and the capsule waits for their
exact durable acknowledgement before exiting. Only those four original handles
in the owning host process are exempted from the negative reference census; live
tasks, foreign handles, mounts and cgroups still block it. Handles close before
any cleanup proof. A real-VM canary passes distinct storage identities, full
post-removal census, live-task/extra-handle refusal and owned cleanup
(`vm-namespace-pin-canary-v2-20261026.log`). All 349 API and 21 client unit checks,
the 50 focused DB checks pass. The v15 installed program compiled and saved its
result but the host rejected the deliberately transferred UID-60000 workspace.
A separate fixed diagnostic reproduced that exact owner-check failure; neither
consumed attempt was reset. The validator now accepts only that specific
0700 workspace ownership transition; foreign owners, writable workspace and
transferred control storage still fail. All eight native storage checks and the
full unit/type suites pass (`storage-owner-regressions-20261026.log`). The v16
installed candidate now passes all five languages, original-claim duplicates,
lost-reply recovery and complete cleanup in 17.4–19.5 seconds per fixture
(`vm-storage-owner-candidate-v16-20261026.log`). Both prior consumed attempts and
all earlier fenced histories remain unchanged. That eight-slot trial then hit
PostgreSQL's reserved-connection refusal with its twenty-connection test server.
The shared production/rehearsal pool budgets are now four supervisor, two
gateway and one publisher connection, leaving room for eight launchers and
readiness without changing the database or physical permits. All fifty DB
checks pass with those limits; v17 again passes all five installed languages.
The updated eight-slot run kept readiness below 1.7 seconds and used distinct
captured storage IDs, but stopped during the full reference census after the
first container, every owned cgroup and its configuration were gone. A separate
read-only calibration reproduced the census's five-second timeout under 24
concurrent health checks, with no submission or source execution. Metadata reads
now run directly in the isolated host CLI with bounded cancellation yields;
every task, FD, mount, namespace, cgroup and five-second deadline check remains.
The same calibration passes in 2,589 ms (`vm-census-metadata-calibration-20261026.log`),
and native regressions include exiting processes, 96 open descriptors and
cancellation. A full capacity PASS is still required.

The v18 trial completed six real mixed-language jobs but then stopped at a later
worker. Its unresolved records include completed first retirement scans; final
certification remained incomplete. Readiness stayed below 1,575 ms and the
database log showed no new connection refusal. A separate read-only calibration
of the same scan at normal scheduling priority passes in 1,675 ms. Only the
bounded reference observation is now temporarily promoted to normal priority,
with checked restoration afterward; source preparation keeps its lower priority.
All 349 API / 21 client checks and both workspace types pass. The v19 installed
trial now passes all twenty real mixed-language programs, using eight physical
slots, mTLS, Redis, exact compiler output, bound results and full cleanup in
126,527 ms. Its twenty readiness observations peak at 1,727 ms; the coordinator
RSS peaks at 192,315,392 bytes. The queue is empty and readiness withdrawn after
the completed batch (`vm-eight-slot-inspection-priority-capacity-20261026.log`).
This is a real eight-slot PASS; the 100-team compiler burst is still required.

The first application/compiler burst retained all 100 original official
receipts but exceeded its settlement deadline. It exposed an application-side
two-slot development ceiling, distinct from the already qualified cloud
judge's eight slots. The first roster expansion also exposed the deferred
authoring guard's exact-two requirement; both failures and their records remain
preserved. Migrations 0075/0076 now permit only complete two/eight rosters, with
the existing two-slot development default. An owner-only, idempotent event
script adds six slots without updating the original records. The focused
database regression checks owner-only access, original slot preservation,
normal accounting, partial-roster rejection and ninth-slot refusal. The
corrected eight-slot synthetic 100-team service burst passes all 100 awards,
with zero worker faults (`eight-slot-burst-integrity-preflight-20261026.log`).
The fresh real-compiler run uses new isolated records; it does not replay the
old failed attempts. The eight-slot run then stopped after forty new case
executions were sealed and drained, with six consumed reservations retained
after a worker fault during final verification. Its 100-team gate failed, and
all original records remain preserved. Read-only observation of the first
retained resource passes in 1,354 ms; a separate 24-readiness-observation load
calibration takes 3,055 ms, without admitting or running code. The inspection
budget now allows ten seconds, preserving all checks, the five-second readiness
limit and the eighty-second host-command deadline. Private bounded failure
locations make another refusal diagnosable without exposing program bytes.
The 24 targeted diagnostic/supervisor checks, 349 API/21 client checks, native
storage regression and workspace types pass. A separately fenced candidate is
being qualified; the real 100-team gate is still open.

The ten-second experiment passed five individual language executions but the
larger run failed again after four new cases were sealed/drained. The user then
deferred the 100-team compiler test. Its failure is not a PASS or a demonstrated
maximum roster; the sustained-load worker fault remains unresolved. The
inspection deadline has been restored to five seconds. Private error causes
are preserved through the launcher adapter rather than discarded. One original
saved result was recovered through explicit guarded retirement in 15,403 ms,
with a real cleanup certificate and no source re-execution
(`vm-explicit-retirement-diagnostic-v21-20261026.log`). Its remaining uncertain
reservations and original evidence stay preserved. No additional cloud test
window is being used for the deferred load test.

The final five-second-inspection candidate passes C, C++, Java, Python and
JavaScript with actual guarded execution, lost-reply recovery and full cleanup
(`vm-final-private-candidate-v22-20261026.log`). The original seventeen source
records, including the explicitly recovered result, remain unchanged under
their fenced epoch. Four installed compilation-error/CPU/output/boundary cases
also pass (`vm-final-guarded-failures-v22-20261026.log`). The final unit/client
run passes 349/21 checks and both workspace types pass; the current complete
database matrix passes 350 checks. None of these smaller passes replaces the
deferred maximum-load gate or resolves its observed worker fault.

The final installed crash test also passes with two UID-60000 processes,
original-launcher interruption, read-only recovery, guarded original-ID
retirement and duplicate refusal (`vm-final-installed-crash-v22-20261026.log`).
The original physical resources are removed, but the uncertain consumed permit
remains held and no participant verdict was invented. This concludes the
smaller private host checks; the 100-team test remains deferred at the user's
request and its observed load fault remains unresolved.

The verification VM was deliberately stopped and its status independently
confirmed `TERMINATED` on 26 October. Its disk and retained histories remain in
place; no extra test window, event deployment or assistant Git commit occurred.
Both application workspaces build successfully, with the existing editor/arena
size warnings. The release candidate is packaged from the final compiled files
with an explicit hash inventory and `deployment_ready=false`.

The 100-team service-burst preflight also passes: 200 requests at parallelism 16
admit 100 official receipts and refuse the competing 100 requests; all 100 jobs
settle with independent awards and no worker faults. Its judge/time/authoring
fixtures are synthetic and admission uses the authorised service directly. It
does not certify browser HTTP load or real compiler throughput.

`npm run build:release` now prepares a separate hash-inventoried application
candidate from explicit built/public paths. Its output says deployment_ready=false
and dependencies_installed=false. It excludes local settings, dependency folders,
test data, old lab evidence and one-use TLS credentials. Packaging self-checks
pass. The clean non-root Linux production-dependency installation, compiled API
health request and built public entry checks also pass. The full current unit
run passes 349 API plus 21 client tests. See
[the current pre-deployment handoff](pre-deployment-readiness.md) for the remaining
gates and exact boundaries of this evidence.

The entries below retain the sequence of earlier checks and failures; later
results supersede their pending wording. Local verification currently includes
363 unit/client tests, the full 348-test disposable PostgreSQL matrix, 23
participant browser scenarios and 116 database-backed browser checks. The real
installed v7 judge completed all five languages and the fourteen failure/boundary
cases (the corrected fork fixture used a new attempt; its original compile-error
record remains unchanged).

The first continuous two-worker service rehearsal failed before any of its five
programs started: two permits were reserved and three deliveries remained queued.
All records and evidence remain intact. Three concurrent read-only readiness
checks then reproduced the unchanged five-second deadline failure. The fix hashes
the protected release once per open installation, then rechecks the original
inode/device/ctime/mtime/ownership/mode and exact directory contents on every
later use. Kernel peer, daemon/image reports, host context, policy and storage
checks remain required. The Linux regression suite passes 22 inner checks,
including rejection of identical-byte dependency rewrites; a read-only VM
calibration completed three concurrent observations in 4.23–4.26 seconds. This
calibration is not a successful installed service or capacity result.

The old boot was stopped deliberately and the approved six-hour stop limit was
applied. The VM restarted at 12:22:51 UTC on 25 October with boot
`6797c91f-0238-4016-80dd-0be86632c69d`. The original database and checkpoint
filesystem were resumed without recreation or migration. A fresh v8 epoch is
being verified; the five-hour endurance run has not started. Deployment remains
unauthorised and the whole-project estimate remains roughly 91%.

### Host verifier implementation, 25 October

The production composition now exists in `host-cli.ts`, `host-backend.ts` and
`host-verification.ts`. The fixed native launcher accepts only its five named
operations. Startup uses a root-private configuration, a restricted judge
database role and the original immutable release. Ordinary RECOVER uses a
separate read-only backend; it cannot call Docker, establish readiness or retire
resources. Explicit root maintenance remains a separate operation.

The native observer checks real nsfs descriptors, reserved Linux 6.8 initial
namespace identities, the complete procfs mount and required host capabilities.
Loaded-policy observation reads the kernel's enforced AppArmor profile and raw
compiled-policy digest. Image observation streams a never-started owned Docker
container's exported filesystem into a bounded TAR reader, without extraction.
A once-only inspection intent and root-private, fsynced boot/epoch/release cache
prevent a missing acknowledgement from authorising a replacement inspection.
Fresh readiness rechecks the kernel context, policy revision, cgroup topology,
release tree and authenticated Docker reports against that original cache.

The retirement composition resolves the original consumed database permit,
checks the complete immutable lifecycle/result context, confirms original-ID
container absence, verifies that the original configuration and every controller
parent remain absent, and scans task/process references under the verified host
view. Only then can the existing certificate-first path append positive drain.
This is implemented code, **not a positive real-host certification**. Root in
the local Docker VM is correctly refused as an initial host. Positive v1/6.8
compiler, policy, concurrent-process and crash calibration is still required.

Evidence: all 358 unit/client checks pass, including explicit-capacity backoff,
physical checkpoint budgets, native report framing, import-only packaging and
the exact reviewed Docker notice (`final-reviewed-host-unit-20261025.log`).
Both application typechecks pass. The installation suite passes 21 inner component
checks plus its outer checks and a separate genuinely non-root native-launcher
refusal (`host-installation-linux-20261025-v5.log`). Nine Python TAR checks pass
on Windows and Linux. Two actual cached Redis-image exports produce the same
filesystem digest (`image-export-20261025-v3.log`). The larger Node-image export
hit the unchanged 75-second local pipe deadline; that failure is retained and
does not certify event-image throughput. No production limit was increased.

`npm run build:judge` creates an offline, hash-inventoried candidate build under
the ignored `build/` directory. It includes two standalone bundled programs,
native sources, a frozen five-language Dockerfile and the attributed upstream
Moby seccomp profile. Its output explicitly says `host_verified: false` and does
not install services, apply migrations, load policy or run participant code.
Bundle hashes, syntax and refusal behaviour pass their self-check. The full
candidate image builds successfully. Its stripped static observer is 803,168
bytes, below the unchanged 1 MiB bound; all four native tools compile with strict
warnings. The exact candidate image
`sha256:727b56f40ae170a74b61ed7cd9a87a6e05516909e7b4a75db5898d80aaca38b3`
passes fifteen trusted answers across C, C++, Java, Python and JavaScript, plus
binary ownership/mode/hash, compiler diagnostic and capsule-refusal checks
(`toolchains-final-20261025.log`). This is toolchain evidence, not Isolate/host
certification. The clean verification VM has now remotely confirmed the reviewed
6.8 kernel and actual v1 controller mounts after reboot. Full host gates stay open.

Readiness now observes an 8 GiB preallocated dedicated ext4 checkpoint volume,
its real kernel loop backing identity and minimum byte/inode headroom. It refuses
missing, substituted, sparse or unbounded storage. The operator supplied a
positive real-VM `PREREQUISITES_PASSED` report for production host-context,
all thirteen v1 controllers, enforced loaded-policy and storage readers. It
explicitly keeps `host_verified: false`. The initial native JSON/wire mismatch
was reproduced and fixed without changing the judge protocol or relaxing native
identity checks; v1 evidence was retained. The v4 candidate builds on that
host as `sha256:2f1fedd67c258af86a0cad247c2e15a620c4523853f9ded5168e9a7640a72a88`.
The actual native Docker peer check also passes. Strict daemon/image report
validation initially refused Docker 29.9.2's informational v1 deprecation notice.
The exact upstream notice is now accepted only for that reviewed version and
included in the daemon digest; every capability flag and rejection of other
warnings remains mandatory. Seventeen affected tests pass. The operator supplied
a positive native-peer/repeated-report result and all fifteen fixed toolchain
answers on the actual VM image. The exited original test container was verified
and removed; its evidence remains under `/var/lib/ingenium/host-toolchains-*`.
Both actual image exports now match: 2,082,512,216 data bytes, 35,045 entries and
27,639 files, with tree hash
`a2712c9fd25d92fabee4789a1397d72354baaa0e0b89ad490a67073375a02101`.
They took 55,890 and 26,763 ms. The never-started original inspection container
was verified and removed; its durable evidence remains on the VM. Complete
immutable installation and production boot preparation now pass on unused test
epoch `bac6fb8c-6740-4c32-a415-f6cb860fe39a`. Preparation took 45,305 ms, fresh
readiness 1,665 ms, and lost-acknowledgement recovery reused the original cache.
Release digest is `d3e22161024199246dfc6a7c8cacd885b90cddb836e86a0981808dedb57fbba3`;
proof is `ad6e9094abfb246c457b29b156e0848188dcc580e15529a6492c9d360b7ed2c0`.
No database readiness is issued; actual Isolate execution is the next open gate.

The fixed database/launcher rehearsal applied all six real judge migrations
on a separate retained PostgreSQL container/volume and created restricted service
accounts. It uses a structural provider fixture, not qualification of the actual
Judge0 engine/schema. Its first C attempt consumed a permit and stopped before
container creation: the installer omitted the required root-only `capsules`
directory. Read-only evidence showed only binding/intent/resource-intent records,
no execution checkpoint, no container and no allocated job cgroups. Original
attempt `892f92fd-ef98-4857-8e43-d6be2e9e90e9` remains held with no invented result
or drain. The installer now creates that root and the preparation fixture checks
it. A guarded v2 continuation verifies the exact old state, adds the missing
directory and uses five fresh attempts; the old permit and full association must
remain unchanged. Real execution/cleanup success is pending. Local shared
database-bootstrap, whole-app/fixture typechecks and five scripts' Linux syntax/
refusal checks pass. The operator then authorised direct SSH from this computer;
Google CLI authentication and IAP access now work. The assistant ran v2 itself.
It added the missing root, but its fresh C attempt
`ca2944d3-a1fd-4757-bc0d-6760eaf84bf9` stopped after recording resource allocations
and before container creation. Both permits remain held. Actual read-only
production verification confirms the private configuration, all thirteen
controller allocations and original host proof still match.

The root cause was an unquoted comma in `cpu,cpuacct` source paths in Docker's
CSV mount argument. The shared argument producer now quotes the source field;
no path or confinement requirement changes. The actual Docker CLI regression
fails before the fix and passes after it. The same negative/positive parser
check passes on the VM's Docker 29.9.2 against an intentionally unreachable
endpoint, so it cannot create or start a container. All 358 unit/client checks,
22 affected lifecycle tests and whole-app typechecks pass. The next installed
execution rehearsal must use a fresh reviewed release/epoch and preserve both
old failed associations; do not patch their proofs, reset permits or retry them.
Positive actual Isolate execution remains an open gate.

### Continued deployment-readiness verification, 25 October

The user authorised completion of all development/testing without deployment
and explicitly approved a six-hour stop limit on the same verification VM for
the final five-hour endurance test. That longer window has not yet been used.
The VM was restarted with the existing three-hour limit; the original checkpoint
filesystem was remounted without formatting, and its exact compiled policy and
dedicated daemon were restored. Actual boot is now
`20eb54b8-96c5-4442-ae16-5ff2034b0adc`.

The old epoch was fenced with its two associations unchanged. A complete copy
of the old release/configuration was retained before the quoting correction.
Fresh epoch `a16ecbec-9d8a-46e4-bd67-bfa4c0b28f86` passed real boot/image/policy/
storage preparation after correcting staging permissions to the reviewed 0444.
Its first C container was created, started and exited 125 before compilation.
Its original attempt/container/resources remain retained with no result or drain.
The production membership parser had rejected the genuine `name=systemd`
hierarchy. A regression fails before the fix and passes after it, including
duplicate/foreign hierarchy and missing PID-controller refusals. This changes
only parsing of the observed named hierarchy; confinement checks remain intact.

A separately labelled, fixed metadata-only probe with the same capability,
AppArmor/seccomp, controller and filesystem restrictions passed the updated
process/mount checks on the actual VM. It ran no submitted source, consumed no
database permit and supplied no readiness/drain verdict. Its original stopped
inspection container and empty owned resources were normally removed; evidence
is `/var/lib/ingenium/inspection-probe-6f2a459e-54a8-4e40-84f0-13e67df7a5de`.

Runtime v5 built on the VM as
`sha256:ad04714decd5690ebb9e95b09dfb7b317aa4fe08e2ba7b39596a2cbb54fdb9b6`.
Both real image exports agree: 2,082,512,229 bytes, 35,045 entries, 27,639 files,
tree `bd2ddd769c76e525eb97b96d15a4ad13082a5dbef81d1dc42abfb7ed81e1be00`.
They took 51,566 and 30,315 ms; the never-started original was verified/removed.
The v5 candidate is in the next guarded fresh-epoch rehearsal; it is not yet a
successful real five-language execution result.

All 23 participant browser tests passed again, including keyboard workbench
focus/return, denied WebGL fallback, reduced motion, mobile/HUD parity, revoked
access, uncertain-command recovery and all forty moving/reachable bounties
(`deployment-ready-browser-20261025.log`, 4.4 minutes). All 359 unit/client tests
pass after the named-hierarchy regression. The full disposable database matrix
passed all 348 tests in 747 seconds, with no skipped checks
(`deployment-ready-schema-20261025.log`). Real services, execution failures/concurrency/recovery,
endurance and final packaging remain required before deployment readiness.

The v5 epoch `4512cec7-26b5-42ca-9757-093a3e0a7315` passed preparation but its
first C capsule exited 125 before compilation. Two separate metadata-only
inspections isolated a shared validator defect: `runtimeObject` sorted its
caller's expected-key array in place, assigning sorted executable tags to the
original path order. Actual binaries match their original toolchain hashes;
the expected labels were wrong. The validator now sorts a copy. A regression
with eight distinct hashes fails before the fix and passes after it; all 16
affected configuration/worker/supervisor tests pass. Original failed attempts,
containers and resource receipts remain held. A fresh reviewed host release
is required; no old execution is replayed and no original proof is patched.

With that correction, epoch `03db5e3e-5fa7-480b-9fd6-027be168f611` compiled and
ran its C fixture at UID/GID 60000, saved exact stdout `12\n`, CPU/memory
accounting and normal Isolate phase cleanup, then removed its original Docker
container and all thirteen owned controller allocations/configuration. Its
reservation remains held: the final reference scan rejected a real unrelated
`nsfs` mount with kernel root `mnt:[...]`. The mount parser now recognises only
the known namespace-handle formats and the reference checker explicitly rejects
any handle matching the original capsule's namespace. The new regression fails
before the fix and all eleven storage tests pass afterward. A read-only scan
using the corrected parser passes on the actual retained C evidence, without
starting code, editing records or granting drain. Evidence is in
`vm-retirement-inspection-v3-20261025.log`. Runtime v7 was rebuilt for the next
fresh-epoch rehearsal. All 362 current unit/client checks pass. No event is
deployed, and all historical failed records remain preserved.

The v7 candidate passed all five installed executions on epoch
`f36c7cce-82cf-4ced-bce3-8acc220b173f`, image
`sha256:db5f53f248aa2e5a5dfaf95ff66aa6eba6720b2c6a9a745ec3a1a05cce54182b`.
Each used one durable consumed permit, genuine protected compile/run evidence,
the exact answer, read-only lost-reply recovery, a refused duplicate launch and
verified normal container/controller/configuration/reference cleanup. Original
fenced histories remain unchanged. Evidence is
`vm-candidate-v7-20261025.log`. End-to-end per-case times including repeated
verification/recovery were 37.7–44.2 seconds; these are not a throughput pass or
instantaneous judging claim. The fourteen failure/boundary cases and the private
continuous mTLS/Redis/two-worker test are separate subsequent gates.

Thirteen installed failure/boundary cases passed with real compiler/interpreter
causes, protected bytes, consumed duplicate permits, lost replies and normal
physical cleanup: C/C++/Java compilation errors, Python/JS syntax errors, wrong
output, nonzero exit, signal crash, CPU/wall limits, memory/output limits and
protected-path/write denial. The first fork fixture correctly failed compilation
because strict C17 hid `usleep`; that original result/record is preserved. The
fixture now uses declared POSIX `sleep`. Only the corrected fresh attempt ran,
passed the actual process-limit probe and completed cleanup; its continuation
asserts the original failed association is unchanged. Logs are
`vm-host-failures-v1-20261025.log` and `vm-host-fork-v1-20261025.log`.

The database-backed browser matrix also passed all 116 checks across its ten
suites (`deployment-ready-browser-db-20261025.log`): participant flow, clock
recovery, history, judging, admitted-source review, validation diagnostics, audit,
announcements, team-code access and final results export. These use disposable
synthetic data and judge fixtures; they do not replace the installed private
service/compiler gate or the event-length mixed workload.

The 600-tab gate now passes with a separate one-CPU
browser-generator process. API, generator and PostgreSQL each have one CPU;
the previous combined harness had two aggregate CPUs with clients sharing the
API CPU. Limits/roster/deadlines are unchanged. New regression tests expose and
remove two unnecessary replay reads after the first server barrier; changed
streams still replay and old awards still do not animate. Failed intermediate
reports remain retained. The server now bounds unfinished
joins at 32 after valid ticket/browser binding and returns a typed capacity hint
only for that refusal. The client uses the existing capped jitter window directly
for explicit HTTP/socket capacity or rate refusals, with a one-second minimum;
ordinary network failures retain fast initial recovery. The capacity regressions
failed before the change; all ten new backoff cases now pass. Authentication and tab
quota refusals keep their generic response. Reconnect recovery passed but then
pause/resume exposed another refresh burst. A one-second refresh-jitter experiment
did not fix it and was removed. Delivery now reads one coherent projection only
for identical currently authorised session/scope tabs within that transaction,
releases its locks, then sends the bounded packets. The client validates its
generation/stream watermarks, suppresses duplicate HTTP reads and prevents an old
HTTP success or failure from replacing that newer pushed view. Lost push delivery
still uses the existing read-only refresh/replay path. No permission cache was
introduced. The focused realtime suite passes all 25 checks, including privacy,
logout, role changes and rival claims (`live-push-db-20261025.log`).

Measured passing run `e9c63dda-7057-4d34-9764-0411aab47fee`, controller
`a670c5ce-54cb-4f5d-87a8-4d5ed4bda525`, retained in
`linux-load-a670c5ce-54cb-4f5d-87a8-4d5ed4bda525.json`:
600 sockets / 200 members / 100 teams, fourth-tab refusal, all private scopes,
simultaneous reconnect in 55,382 ms, 1,372 attempts below the unchanged 1,800 cap,
complete pause/resume delivery, 200 exact maximum drafts and 100 official
admissions with 100 normal refusals. Pause/resume request-to-projection p95 is
4,852 / 4,627 ms, not an instant-update claim. The complete local load process
passes (`live-load-push-20261025.log`). No roster, security, pool, retry-count or
timing ceiling was raised. It excludes real compiler execution/public TLS;
mixed event-length soak and real compiler drain remain open.

The user explicitly deferred creation of real statements, hints, reference/buggy
programs and cases, and will supply registration data after registration closes.
These inputs are excluded from this development batch at the user's request;
synthetic fixtures remain the only test data. Deployment and Git mutations are
still excluded. A generated Python cache file remains on disk because its
optional cleanup was blocked by automatic approval review. The standard
`__pycache__/` ignore rule now keeps generated bytecode out of source commits;
the rejected deletion was not retried.

The [continuous judge service](judge-supervisor.md) now connects fresh protected
launcher evidence, the registry's readiness lease, private outbox publication,
two independent execution workers and bounded read-only restart recovery. It
holds one database-session lock per epoch; another supervisor is refused, and a
lost session cannot reconnect to withdraw its replacement's readiness. Current
host/boot/runtime identity and a fresh nonce bind the actual readiness response.
Readiness renews independently while both workers are busy. Shutdown/faults stop
new work and withdraw readiness without resetting permits or inventing drain.

Both production commands exist separately from normal app startup:
`start:judge-supervisor` and `start:judge-gateway`. The former requires root-only
private settings and the fixed verified launcher; the HTTPS gateway requires a
restricted non-root account, its actual Linux boot, a private listen address and
the exact pinned worker certificate/address. All three judge database roles use
one preflight that rejects owner/administrative powers, overlapping service roles,
schema creation and direct access to control, attempt or provider-source tables.
Examples contain deliberately invalid placeholders. No real secret was loaded,
service installed, cloud resource started or original lab controller executed.

The new judge-only `006_supervisor_service.sql` adds narrow session-bound lease
and source-free held-attempt functions. It was applied only to disposable tests.
It does not belong to the application migration history and cannot reset permits,
modify sealed results or grant host verification. No startup applies migrations.

Current evidence under `apps/api/test-results/`:

- All 323 unit/client checks pass, including eleven supervisor/gateway cases
  (`judge-services-unit-20261025-final.log`). Both production builds, typechecks,
  the bundle policy and the dependency audit pass; the audit reports zero known
  advisories, not absence of every vulnerability.
- The 48-check judge database/Redis/TLS matrix passes
  (`judge-supervisor-20261025-v3.log`), including all three role preflights,
  singleton exclusion, actual session loss/replacement, four automatic jobs with
  two concurrent workers, heartbeat renewal during busy work and a preserved
  unstarted old permit. Responses/proofs are synthetic orchestration fixtures;
  no participant program or production compiler is executed by those tests.
- The fixed-launcher/checkpoint Linux suite passes
  (`supervisor-launcher-20261025-v1.log`), including the new receipt-returning
  readiness method through the real protected pipe. The separate networkless
  private-runtime suite passes all six inner checks
  (`supervisor-runtime-20261025-v6.log`): root-only and restricted file ownership,
  actual entry-point refusal and private operator file behaviour.
- An added startup-refusal check initially timed out before returning its message.
  Loading the queue/supervision runtime now follows private configuration
  validation. The final refusal checks pass under the same CPU, memory, task and
  ten-second subprocess limits. Failed logs remain retained; no production or
  test acceptance limit was relaxed to hide that failure.
- All 346 checks in the final combined database regression pass without skips
  or cancellations (`judge-services-full-schema-20261025-final.log`). This run
  includes the new judge-service checks alongside registration, access, browser,
  economy, competition, authoring, recovery and clock cases. This completes the
  continuous-service implementation milestone; it does not complete the separate
  physical judge, capacity or launch gates.
- The first combined run had 344 passes and one leaf quota-refusal failure (the
  parent also counts as failed). Its fixture emptied the bucket before another
  network round trip, but the real 600/minute policy refills one token every
  100 ms. The fixture now seeds zero credits at the request's real quota-decision
  timestamp inside its actual transaction, then checks HTTP 429, Retry-After,
  unchanged session count and persisted zero credits with the original policy.
  No production quota or timing rule changed. All 144 foundation checks pass
  (`judge-services-foundation-20261025-v1.log`); the failed full log remains
  separately retained as `supervisor-full-schema-20261025-v1.log`.

These entry points complete continuous orchestration code. The subsequent host
verifier implementation is recorded above; genuine positive Linux-host evidence
and the complete runtime rehearsal remain required.
The 600-tab reconnect failure, mixed soak, real compiler drain and actual event
content/device checks remain open. No readiness was fabricated to waive them.

## Non-Deployment Completion Boundary

The latest request excludes deployment, not unfinished application or judge code.
Cloud provisioning, service installation, DNS/TLS issuance and live migrations
are not authorised by that request. Git writes remain the user's responsibility.
The following must not be described as completed merely by excluding deployment:

- The production full-host proof producer and retirement composition now have
  implementations, but still need positive Linux-host calibration and the
  complete compiler/crash/recovery rehearsal. A mocked proof or a successful
  stock Judge0 status cannot release a physical reservation or substitute for
  those observations.
- The 600-tab reconnect, mixed-load soak, real-compiler queue drain and remaining
  recovery/accessibility checks are completion gates, not installation tasks.
- Actual challenge content and registration import/reconciliation are now
  explicitly deferred by the user until those inputs exist. Their eventual
  review and balance checks remain event preparations; synthetic fixtures do
  not claim to be actual competition content or registrations.

The completed local recovery batch adds GET-only challenge-load retry, verdict
polling recovery including a missing initial response, and a plain-text editor
fallback if the heavy Monaco module cannot load. The workspace retains its draft
controller, including unsaved code and unresolved autosaves, across read retries
and editor changes. No recovery read replays a Run, Submit, hint purchase or save.
Known hint ownership removes the repurchase control while protected content is
temporarily unavailable. Terminal feedback and capacity refresh recover together,
so an interrupted metadata read does not leave the Run allowance stale. The
existing arena error boundary is shared without changing its 3D fallback.

Live delivery groups tabs only when credentials, requested round and complete
private scope match. Current authority is checked under one guarded transaction,
never reused across transactions or other members. Each tab retains its own
cursor, replay buffer, backpressure and resynchronisation checks; one slow tab
does not disconnect healthy siblings. A failed shared poll emits no new heads or
data and waits for a fresh guarded turn instead of disconnecting every peer.
Clock failure and explicit authority errors still disconnect immediately; current
revocation checks and the ten-second client stale watchdog remain.

The client verifies the server's final READY heads rather than setting READY
unconditionally. This refreshes liveness, drains buffered replay without duplicate
award animation, and requires resynchronisation for missing events. Malformed or
foreign heads cannot unlock writes or presence. Initial connection is immediate;
failed connections use a random 250--1,250 ms first retry, exponentially widening
to a maximum 30,250 ms window. The counter resets only after a verified final
acknowledgement. The original handshake/stale thresholds, quotas, database pool
and 60-second load-recovery assertion are unchanged.

Final local results, with logs under `apps/api/test-results/`:

- All 312 unit/client checks passed: 291 API and 21 web checks
  (`unit-regression-20261025-final2.log`), including 26 focused live-client checks.
- All 342 checks in the complete disposable PostgreSQL matrix passed without
  skips or cancellations (`schema-regression-20261025-final.log`). These include
  the 23 live checks for three-tab private revisions, fourth-tab refusal,
  revocation, sibling isolation and an injected shared-read failure. They use
  synthetic judge observations and do not certify real language execution.
- All 23 participant browser scenarios passed together after the protocol and
  dependency changes (`participant-recovery-20261025-final2.log`). A subsequently
  strengthened unsaved-code regression also passed: an aborted autosave remains
  unresolved, a challenge-read retry preserves its text and no second save is
  sent (`unsaved-recovery-20261025-final.log`). Terminal-read failure was reproduced
  before its fix; the before/after regression logs are retained.
- Both production builds, typechecks and the production bundle policy passed.
  Desktop/mobile workbench screenshots were inspected and archived under
  `participant-visual-20261025/`. Large editor/arena bundle warnings remain.

The 600-tab reconnect gate is still **INCOMPLETE**. The harness binds three tabs
to each of 200 members, with 200 editors and 400 observers, and refuses a fourth
tab without changing enrolment. Later runs held all 600 through an eleven-second
steady observation, but none recovered all tabs by the unchanged 60-second
deadline. The latest report, `linux-load.json`, is run
`f96d94e4-cef2-4089-9755-c1299edc9e08`: 578 READY / 22 STALE and 1,213
connection attempts. Earlier runs, including the 589 READY / 9 STALE / 2 SYNCING
result, and their nonce-named reports/logs are retained. Experimental long first
retry windows were not kept; the final quick-first-retry policy above has unit,
browser and full database evidence, but has not passed a new 600-tab run.

This harness places the API and all client generators together in one one-CPU
Node container, with a separate one-CPU database. Its result is a conservative
combined stress observation, not an isolated production API capacity measurement
or proof of which production resource is limiting. Separate-generator/real-host
calibration and the mixed-load soak remain required. No roster, timeout, resource
budget or acceptance threshold was silently relaxed to manufacture a pass.

The dependency audit found the installed `fast-uri` 3.1.8 / 4.2.2 affected by the
maintainer's [URI parsing advisory](https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg)
and related reference-normalisation advisories. Both supported major lines are
now pinned to patch releases 3.1.9 / 4.2.3 through the existing override pattern;
only those two installed packages changed. Four regressions failed before the
patch and pass afterward, covering both serializer and validator resolution.
The final full npm audit reports zero known advisories. This is not proof of
application exploitability before the patch, absence of all vulnerabilities
afterward, or a native-image security audit. No cloud deployment, Git write,
development-database operation or architecture change was performed.

## Current Safeguards and Participant Coverage

Protected event startup now verifies the actual database role before launching
the clock or entry routes. It refuses schema owners, superusers, worker-role
members, schema/database creation rights and direct table/column writes to
credentials, awards, wallet entries, official submissions or final results.
Event-mode connection URLs must remain loopback, password-bearing and free of
query/fragment overrides. Foundation-only development remains unchanged. Nine
focused worker checks include real PostgreSQL role/grant refusals and restoration
of the normal restricted API permissions.

The live service keeps one public-standings entry keyed by the committed round
stream identity/head. Concurrent readers share that calculation; every request
still validates current authority and holds the existing round/live locks.
Private balances are stripped before retention, failed reads are evicted, callers
receive independent copies, and a new head/round invalidates the entry. Shared
discipline/live tests and thirteen focused result checks cover exact standings parity,
time penalties/reversal, shared claims and provisional-to-frozen finalisation.

All 323 unit/client tests, 346 full-matrix disposable database checks, typechecks,
both final production builds and the production bundle policy pass.
The full 23-scenario participant browser run passed. The browser checks include forty targets on desktop and
mobile, nonblank/moving canvas pixels, last-target keyboard access, focus into
the IDE and return to the selected target on close. Screenshots were inspected;
software-rendered browser checks do not establish participant-device frame rates
or complete the comprehensive accessibility audit. Existing large editor/arena
bundle warnings remain.

The mobile/minimised HUD previously hid rank. Its regression first failed on the
hidden value; full and compact HUDs now retain team name, score and rank at 320,
390, 768 and 1440 pixel widths without internal overflow. The current desktop /
mobile forty-target and keyboard workflows pass after that fix.

Separate [primary-host service definitions](../infra/app-host/README.md) now bind
the existing API and coordinator entry points to distinct restricted OS accounts,
private settings, fixed release paths, read-only host files and finite resource /
restart / graceful-stop policies. Policy checks pass against both definitions.
No installer, migration hook, root shell, automatic arena start or local sandbox
execution was added. Actual systemd parsing/execution, OS ownership/cross-account
checks, whole-host budgets and restart/clock calibration remain required.

The first combined database run exposed a fixture-composition error: the next
scenario tried to discard an instance whose second round was still live. The
production guard correctly refused. The shared test helper now completes active
R2 through normal close/finalise commands, preserving its frozen R1 result;
the regression also asserts that discarding the live instance remains forbidden.
No application rule, migration or request/operation timeout was relaxed. The
initial failed log is retained separately from subsequent runs.

The combined rerun passed 277 checks before its old ten-minute parent allowance
cancelled the remaining tests. That run is **not** an all-green matrix result.
The expanded full-matrix allowance is now fifteen minutes; individual API,
sandbox, judging, expiry and request deadlines are unchanged. A `foundation`
selector runs the original schema/access/staff/arena/content/validation/clock
checks independently of the already exercised long competition group. The new
whole-matrix allowance alone did not establish a one-shot full-suite pass.
Both failed/incomplete logs are retained; the subsequent complete pass is
recorded in the follow-up below.
The independent core run now passes all 144 checks without skips or cancellations,
including the restricted Linux recovery CLI, source/validation workflows and
clock fault/restart handling. The separate restricted app-runtime Linux suite
also passes. Those results do not relabel the cancelled combined run as a pass.

Linux-local run `2fcd87b9-4815-4f9c-bbe0-971f01b5f4b9` passed its bounded
correctness phases using the same two aggregate test CPUs and API deadlines.
It retained 200 connections/attempts, no live stale transitions or reconnects,
200 exact maximum drafts and 100 unique official receipts. Pause/resume projection
p95 was 4,544 / 4,668 ms; official admission-response p95 was 1,401 ms. The report
also records eighteen refused projection reads and seventeen associated warnings;
it is not a zero-refusal or latency-gate pass. Real claim timing, real judge drain,
600 sockets, full mixed soak and public-host measurements remain open.

The user selected manual Cloud Shell execution. On 23 October they returned the
expected PASS for the public-only v2 [isolated cloud CLI rehearsal](manual-cloud-rehearsal.md):
non-root CLI/private runtime permissions, migrations, quarantine receipt and
read-only inventory passed; admission remained disabled and live deployment was
explicitly unverified. This is user-reported VM evidence, not an independently
inspected host installation. The v2 bundle predates migration 0074 and does not
verify that newer retention change on the VM. Only the rehearsal's two labelled
temporary containers were reported removed; the old judge lab was untouched.
The user subsequently confirmed that the Cloud Shell status check printed
`TERMINATED`; shutdown is user-reported, not an independent API inspection.
The assistant has performed no cloud operation or Git write.

## Combined Regression and Shared-Race Follow-Up

A complete run reached all 341 checks without cancellation, but eight checks
failed (including the parent). It exposed a real payload-maintenance transaction
timeout with accumulated history, followed by temporary test-storage exhaustion
when several fully migrated clock databases remained allocated together.

Migration `0074_retention_batch_budget` reduces retention to five candidates per
transaction, at most ten paired tombstones. All age/provenance/byte/source guards,
permissions and production deadlines remain unchanged. The clock fixtures now
close their own pools and drop only each finished, nonce-named test database;
the PostgreSQL memory/storage/CPU ceilings were not raised. Two browser tests now
observe the revoked-session screen instead of clicking a control already removed
by valid live revocation. Test drain loops retain the same total candidate ceiling
despite the smaller production batch size.

The next complete run passed 338/341 checks and confirmed the retention timeout
and test-storage fixes. Its two remaining leaf failures were the export logout
test race and a test drain still using the old batch count. Both have been
corrected. The fresh `schema-regression-20261023-v5.log` run then passed all 341
checks in about 744 seconds with no failures, cancellations or skips. It exercised
the combined competition/access/authoring/clock matrix, including database-backed
browser checks, on a fresh disposable database. All 304 unit/client tests,
typechecks, production builds, public-bundle boundary and changed-code formatting
checks also pass. Earlier failed/incomplete logs remain under ignored test results;
this does not convert their failures into passes or replace the separate native
judge, public-host, device and load/soak suites.

The separate [fifty-team R2 Linux rehearsal](local-load.md#fifty-team-shared-race)
now exercises actual qualification, one hundred locked member grants, fifty real
HTTP admissions and the original participant-worker settlement path. Later correct
results cannot steal priority from an older unresolved receipt. All one hundred
members see the single claim, only the winner receives team award notices,
original-key retries retain their receipt, and all accepted work drains before
finalisation without changing frozen R1 results.

Its latest run `0c700f5c-fa47-4e93-a1bc-c67c58f41df2` passed all six scenario checks
within the existing two aggregate test CPUs, memory ceilings and twelve API
connections. It recorded one hundred connections, no HTTP refusals/warnings and
4,369 ms from the synthetic assessment request to all claim projections. That is
not commit-to-claim latency, real compilation, public networking or a sustained
capacity pass. An earlier run refused six admission requests and remained
INCOMPLETE; its cause/stability assessment remains open. New controller runs also
preserve exclusive per-run logs/reports instead of replacing the only record.

The rough estimate is 88%, not the requested 90%. Actual host/judge installation,
public HTTPS, off-host backup/recovery, real workload latency/soak and reviewed
event content remain required. The narrow cloud CLI PASS is recorded above; it
does not satisfy those separate deployment gates. This batch has
not changed the architecture, development database, real secrets, cloud resources
or Git history.

## Earlier Verification

Latest verification: the restricted offline observer/quarantine tools pass as
non-root processes in a real Linux container against disposable PostgreSQL.
The 100-team capacity harness passed its initial HTTP-only baseline and caught
a 200-live-socket failure with the foundation preview pool. The active-event
server already uses the approved twelve API connections; the harness now uses
that same pool and deadlines, and this run also failed live delivery. A reserved
connection/command-queue experiment failed and was removed. A subsequent Linux-local
run passed every phase with the retained reconnect-generation fix: 200 private
sockets saw pause/resume, 200 maximum drafts round-tripped and 100 teams retained
exactly one admitted receipt each in a 200-member burst. The initial passing
report is run `afd4fe21-6f48-4c3c-bcd6-728b428c7f3b`; a later instrumented run
failed its judge-readiness lock wait and correctly stayed INCOMPLETE. The retained
idle-acknowledgement change now passes a real lost-ack client/server regression:
the server requests another acknowledgement while events remain buffered, and
none for idle heads. Actual protected reads and acknowledgements still validate
current authority. All 22 focused realtime integration checks, 297 unit/client
tests, typechecks and production builds pass. Existing editor/arena bundle-size
warnings remain.

Previous Linux-local run `d49a093a-a02c-4249-9a12-11502b137c3b` passed every correctness
phase with unchanged test CPU, pool and timeout limits. All 200 drafts matched;
100 official receipts persisted with no duplicate team/bug admissions. Metadata
p95 was 345-413 ms. However, control-request-to-projection pause/resume p95 was
5,282 / 10,730 ms, admission-response p95 was 1,309 ms, and 391 connections were
opened including recoveries. One projection resynchronisation was refused. This
is not a passed latency gate, zero-reconnect guarantee or measured real claim
delivery.

The delivery-stability follow-up first reproduced suppressed cursor heads, then
fixed the transport check to precede one bounded event/head/presence batch.
Heartbeats use the actual send time; the current transaction's own editor authority
and already joined team ID are reused rather than queried again. Other announcing
sessions and every protected batch remain authorised; buffer/deadline limits are
unchanged. All 22 realtime integration checks, 297 unit/client tests, typechecks
and production builds pass. Latest Linux-local run
`df16b57e-5b63-4000-9fcd-839c087cf9a7` passed all correctness phases with exactly
200 connections/attempts, no live-phase stale/reconnect transitions and no recorded
unavailable reads/warnings. All 200 drafts and 100 official receipts remained
correct. Metadata p95 was 241-344 ms, but pause/resume projection p95 was still
6,435 / 6,386 ms and admission-response p95 was 1,703 ms. This fixes the observed
reconnect churn; it does not establish the experience targets or sustained event
capacity. No real judging throughput or public deployment is implied. Real public network,
600-socket, latency/queue-drain, mixed-soak and clock-agent gates remain open.
See [operations observation](operations-observation.md) and
[capacity rehearsal](local-load.md). Existing cloud-host use was separately
authorised only for isolated rehearsal; retained lab data remains untouched.
The existing VM was started for that rehearsal, but browser file upload required
the user and browser control subsequently became disabled. No rehearsal container
was launched there. The user confirmed stopping the idle VM afterward; this is
user-reported, not independently verified host state. Cloud rehearsal is unfinished.

Earlier batch: [offline restore quarantine](restore-quarantine.md). An owner-only,
atomic command revokes restored participant/staff sessions and flow/handoff
authority, purges encrypted browser delivery material, clears session pointers
and quarantines active execution epochs. Its immutable original-key receipt
survives duplicate/concurrent calls and lost replies. An independent persistent
gate refuses protected API/live/worker actions and clock/maintenance startup,
including the timing-recovery path; normal readiness returns 503. No old provider
queue is replayed, held slot released, verdict invented, code ownership/language
reset or sporting timestamp rewritten. Focused checks preserve byte/hash-bound
sporting/source/intent/physical-work records and prove injected receipt failure
rolls back every change. The encrypted physical restore drill now preserves all
110 app tables before applying the same quarantine operation to the isolated
copy. Ten restore checks, seven physical-backup checks and all 285 unit/client
tests pass; production builds/typechecks and new-code formatting pass. Eleven
shared clock/worker/timing-recovery checks, ten automatic-maintenance checks and
twenty live-state checks pass, including real timed expiry and shared R2 claims.
The complete global/browser/load matrix was not rerun. This is not a real host
fencing, Linux CLI installation or post-restore reopening rehearsal. Secret
rotation, integrity assessment, retention catch-up and a reviewed controlled
reopening procedure remain pending; the gate has no bypass/clear command.

Earlier batch: [encrypted backup and isolated restore](backup-restore.md). A
digest-pinned PostgreSQL image candidate installs and verifies the exact available
pgBackRest 2.59.3 package. Public-only build context, protected GCS configuration
placeholders, sixty-second WAL switching and dependency-aware fourteen-day
retention are prepared without installing a production secret or scheduler.
The disposable checks create a real source/award/hint/final result, take encrypted
full/differential/incremental backups and archive a WAL-only tail. Wrong-key and
damaged-manifest restore requests fail; valid recovery uses an exact LSN and
excludes a later synthetic marker. SHA256/count fingerprints match all 109 app
tables, migration history and one probe table; function/trigger/constraint/grant
definitions also match. The restricted API role still cannot create tables.
The restored copy has no network, public ports, app/worker, automatic restart or
repository-write permission; it does not authorise event resumption. Seven
focused backup checks, the eight-check normal stock-image/team-access regression
and all 282 unit/client tests pass; builds/typechecks and
new-code formatting pass. Local recovery took about seven seconds on this small
fixture, not a production RTO guarantee. The full global matrix was not rerun.
One initial setup's temporary directory with generated test-only keys remains
after a blocked filesystem cleanup; its labelled Docker container/volume were
verified and removed. No real data, cloud service, architecture or Git history
was changed. Actual encrypted off-host GCS verification, deployment/key inventory,
backup scheduling/lag alerts/budgets, physical old-epoch fencing and safe
reopening remain required, alongside real judge and
event-load/security gates. Ordinary database operation is still separate from
production backup readiness.

Earlier batch: [same-origin HTTPS edge](https-edge.md). Real Caddy serves the
built public frontend, proxies API/live WebSockets on one origin, overwrites the
client-address header and refuses arbitrary proxy trust. Both ordinary HTTP and
upgraded live quotas/code verification use the shared loopback-only boundary;
the normal production server enables it without weakening development mode.
Entry/API/errors remain non-cacheable, only existing hash-named assets receive
immutable caching, private/dot/source/health paths are not exposed, and upstream
POST retries are disabled. Production builds, secure cookie/Origin/CSRF policy,
real self-hosted editor workers and live pause/resume are exercised through TLS,
not Vite; the established socket survives the upload deadline. A socket-loss
fixture reaches the upstream once and returns a generic error. All seven focused
TLS/PostgreSQL/browser checks, 281 unit/client tests, twenty existing live-state
checks and the four-check full both-round/staff browser regression pass. Production
builds/typechecks, formatting and the bundle boundary check pass; desktop/mobile
screenshots were inspected. The complete global database/browser matrix was not
rerun. No migration, actual runtime secret, cloud resource,
architecture or Git history was changed. Native Linux installation, public
DNS/certificate/redirect renewal, host/proxy connection limits, monitoring,
encrypted backup/restore, judge retirement and full event-load/security/recovery
gates remain open. Existing editor/arena bundle warnings remain.

Earlier batch: [database retention and operations](data-retention.md). Expired
flow/session verifiers and eligible seven-/thirty-day source/diagnostic bytes
retire through immutable, byte/hash-bound tombstones. Official source copies
retire atomically, while source receipts, original results, awards, languages,
published tests and positive physical-release evidence remain. Technical timeouts
and Round 1 intermission cannot authorize expiry; unresolved/held work prevents
cleanup. Current-authority private reads return explicit retention unavailability,
not empty programs or starter substitution. Bounded scans record progress only
with commit, and Owners/Super Admins have read-only status without a purge button.
A finite Linux-only operator command needs protected local API-role configuration,
fresh normal clock trust, a stopped monitor and retired/no-uncertain-work state;
it starts no HTTP listener or participant execution. All 278 unit/client tests,
the thirteen-check retention/HTTP/browser suite, ten-check existing maintenance
regression, eleven-check clock regression and four-check full both-round/staff
browser regression pass. Builds/typechecks, schema consistency and the bundle
boundary check pass; desktop/mobile screenshots were inspected. The complete
global database/browser matrix was not rerun. Existing large editor/arena bundle
and Three.js deprecation warnings remain.
Migrations `0069`/`0070` have only run in disposable synthetic databases. Actual
Linux CLI/probe ownership, judge-host staging/byte retirement, full resource
budgets, encrypted archival/backup/restore and event load/security/recovery gates
remain required. No architecture, real database, cloud service or Git history
was changed.

Earlier batch: [final results export](results-export.md). Monitor now offers
CSV/JSON downloads of the selected round's immutable final standings, including
historical arenas, exact timing/difficulty tie-break values and result provenance.
Qualification is separately pending/locked for Round 1 and not applicable to
Round 2; tied ranks are preserved. Only current normal staff authority can read
the explicit bounded projection, never wallets, source, credentials or hidden
execution data. CSV quoting/formula protection and lossless JSON use no new
dependency. Browser downloads are generation-fenced, non-overlapping and
read-only; failed reads can be retried without a command or result mutation.
No migration is needed. All 275 unit/client tests, the twelve-check focused
PostgreSQL/HTTP/browser suite and the existing four-check full both-round/staff
browser regression pass. Typechecks, production builds, formatting and the bundle
boundary check pass; desktop/mobile screenshots were inspected. The checksum is
of the public sporting projection only, never the private snapshot/configuration
hashes. No real database, cloud host, architecture or Git history was changed.
The complete global test matrix was not rerun. Encrypted archive/backup/restore,
retention and installed-host/full event launch gates remain separate unfinished
work; existing large arena/editor bundle warnings remain.

Earlier batch: [private team search and code revocation](team-registration.md).
Owner/Super Admin registration search now matches literal team/member/registration
labels with 120-byte query bounds, scoped 50-row paging and no activity renewal or
public directory. Revocation issues no replacement secret and retires both members'
grants, proofs, encrypted handoffs and private live access. Deliberate Issue is
distinct from Rotate, so stale rotations cannot restore a revoked code; issuance
does not clear blocks or bypass same-round re-entry approval. Existing identities,
languages, saved drafts, round clocks, scores and admitted source are preserved;
already-admitted work still completes and receives its normal once-only award.
Original-key GET recovery never replays a write or reveals an old code. Migration
`0068_team_search_revocation` only extends immutable receipt constraints and the
existing confirmed writer; it has only run in disposable databases.
All 272 unit/client tests, the focused nine-check PostgreSQL/HTTP/browser suite,
the eight-check existing team-management suite, nine-check CSV-import suite and
four-check both-round/staff browser regression pass. Typechecks, production builds
and the bundle boundary check pass; desktop/mobile screenshots were inspected.
No real registration data, project/cloud database, architecture or Git history
was changed. Installed-host, retention and full event-load/security/recovery/
deployment gates remain open; existing large arena/editor bundle warnings remain.

Earlier batch: [arena announcements](announcements.md). All normal staff roles can
send event-wide, round-wide and private team notices with a separate staff reason,
audience review, immutable receipts and original-key GET-only recovery. Participants
have a live new-message marker and paged inbox/focused reader without losing the
editor buffer. Body text is loaded by ID, not broadcast in snapshots or events;
private notices cannot advance another team's streams or notification revision.
Equal-time sends, pause-time communication, revocation, cross-arena isolation and
round-two visibility are covered. Closed arenas reject new delivery and preserve
read-only history. Audit navigation gains an eighteenth record category.
Migration `0067_announcements` has only been applied in disposable databases.
All 271 unit/client tests, the 13-check focused PostgreSQL/HTTP/browser suite,
the 20-check live/replay regression, the existing four-check both-round/staff
browser regression, typechecks, production builds and the bundle boundary check
pass. Desktop/mobile screenshots were inspected. No real database,
cloud host, architecture or Git history was changed. Full-system/event-load and
installed-host/deployment gates remain open; existing large editor/arena bundle
warnings remain.

Earlier batch: [staff audit navigation](staff-audit.md). The protected Audit tab
browses seventeen existing immutable record families with bounded, source-free
projections, full-record metadata dialogs, role-filtered categories, current or
historical arena scope, stable time/UUID paging and non-overlapping refresh.
Normal staff management history remains Super-Admin-only; operator records and
private source/evidence grants are not broadened. Reads do not mutate canonical
state, replay commands or renew sessions. Index-only migration
`0066_staff_audit_navigation` has only been exercised in disposable databases.
All 270 unit/client checks, the ten-check focused PostgreSQL/HTTP/browser suite,
the existing four-check both-round/staff browser regression, typechecks,
production builds and the bundle boundary check pass. Desktop/mobile screenshots
were inspected; long hostile reasons are safely rendered and bounded in tables,
with full wrapping/scrolling in the detail dialog. No real database, cloud host,
architecture or Git history was changed. Full global database/browser coverage
was not rerun; existing large editor/arena bundle warnings remain.
Retention/archive, remaining event controls, installed-host service wiring and
full-system/security/recovery/deployment/load gates remain open.

Earlier batch: [private authoring diagnostics](validation-diagnostics.md).
Owners/Super Admins can deliberately review one resolved validation dispatch's
bounded output/accounting with exact-run confirmation, a reason and immutable
result-bound access history. Normal reports remain output-free and add bounded
dispatch metadata only. Recovery is original-key GET-only and original-session
bound; late/stale/revoked responses cannot reopen private output. Reads do not
renew staff activity, change validation state or release physical work. Migration
`0065_validation_diagnostics` has only been applied in disposable databases.
The 29-check focused PostgreSQL/HTTP/browser suite passes, including the existing
five-language validation lifecycle, protected output bounds, authority/expiry,
immutable audits, stable paging, response loss, revocation and mobile layout.
All 269 unit/client tests, typechecks, production builds, formatting and the
bundle boundary check pass. Desktop/mobile screenshots were inspected. The
settled report retries transient read failures without reopening private bytes.
The existing four-check real-browser regression also passes, covering both
rounds, authoring/publication and the connected staff workflows.
Installed-host, general staff audit navigation, retention, full-system regression
and load/security/recovery/deployment gates remain open.

Earlier batch: [restricted submission review](submission-review.md). Owner/Super
Admin can deliberately inspect an admitted program and one resolved dispatch's
retained feedback, with exact-parent confirmation, a bounded purpose, immutable
source/result-bound audit and same-current-session original-key recovery.
Organisers/participants, working drafts, hidden test records and raw provider
evidence remain excluded. Access history is paged and automatically refreshed;
private bytes are never auto-polled, cached in browser storage or redisplayed by
a late response after an access-state change. Reads never renew staff activity
or alter competition state. Migration `0064_submission_review` and all new data
have been exercised only in disposable fixtures, not the development/cloud DB.
All 268 unit/client tests, the thirteen-check focused database/browser suite,
typechecks, production builds and the bundle boundary check pass. Desktop/mobile
screenshots were inspected; the existing ten-check judging/recovery browser and
database regression also passes. Actual host installation, remaining authoring/audit
navigation, source/verifier retention, full-system regression and load/security/
recovery/deployment gates remain open. Existing large editor/arena bundle warnings
remain; this is not event readiness.

Earlier batch: [operator-only Super Admin recovery](staff-operator-recovery.md).
The restricted Linux maintenance CLI supports backup creation, lost/compromised
code rotation and verified retirement, without a public endpoint/master code or
last-admin exception. A private durable candidate precedes the transaction;
status/original-candidate resume reconcile lost replies without a new issuance.
Actual schema ownership, current replacement normal-session authority, revisions,
staff capacity, immutable source-bound history, shared audit capacity and existing
revocation triggers are enforced. Recovery never clears a time incident or
changes sporting state. Actual operator deployment remains required; this does
not provision a real administrator or migrate development/cloud data.
All 267 unit/client tests pass, together with nine focused PostgreSQL recovery
checks, a real restricted Linux CLI lifecycle check, four networkless Linux
runtime/handoff checks and the twelve-case existing staff-management regression.
Typechecks, production builds and bundle-boundary checks pass. The actual
maintenance host, operator identities/secret delivery, full global/browser
regression and production backup/load/security rehearsal remain unverified.

Earlier batch: [separate app-side judging service](judging-runtime.md). A private
Linux entry point now runs the existing validation and participant workers under
one generation-fenced lease, with non-overlapping turns, periodic pinned mutual
TLS readiness, restart-safe original-attempt recovery and graceful shutdown.
Migration `0062_app_judging_runtime` adds the restricted worker privilege group
and idempotent runtime-bound clock-fault persistence, not a new scoring or retry
policy. The worker independently establishes fresh primary-clock observations,
rechecks runtime/generation per transaction and cannot clear a clock incident.
API-only competition configuration supplies its separate draw key and expected
manifest/lease readiness; the API receives no judge TLS secret. The common
private-file loader rejects unsafe parents, links, FIFO/device targets, changed
opened-file identity, invalid UTF-8 and excessive payloads. Actual runtime files,
database logins, certificates and cloud services were not created.
All 264 unit/client tests pass, along with eight focused worker/TLS/database
checks, eleven primary/consumer clock checks and twenty-three validation checks,
including automatic full five-language validation. Linux file/startup refusal
checks, typechecks and production builds pass. The eleven-check participant
judging regression also passes. No persistent development/cloud database,
architecture or Git history was changed. The complete browser/global database
regression and actual primary-host process/Compose/systemd/credential rehearsal,
judge-VM installation/readiness/full physical retirement, load, retention and
deployment gates remain open. Existing large editor/arena bundle warnings remain.

Earlier batch: [automatic event maintenance](event-maintenance.md). Protected
startup/shutdown now connects non-overlapping, clock-guarded round deadline,
sample/validation expiry, cancellation progress, encrypted handoff cleanup and
quota cleanup. New migration `0061_event_maintenance` keeps sample expiry bounded
to twenty parents and exposes only the narrow maintenance operation. Expiry never
releases physical work, invents an official verdict or finalises sporting results.
Quota selection checks actual refill before its 200-row limit, avoiding depleted
keys starving eligible cleanup. Older-round cleanup locks affected rounds before
catalogue/judge budgets. The ten-check disposable maintenance suite passes,
including the real two-minute sample timeout, global pause/resume, concurrent
cleanup, valid-versus-revoked handoffs, unchanged sessions/slots/receipts, held
executions and restart without duplicate effects. All 257 unit/client tests,
typechecks, production builds, new-file formatting and bundle checks pass.
Production worker-daemon/host wiring, remaining source/verifier retention,
event-sized query plans and Linux/process/load/deployment rehearsal remain open.
No development/cloud migration, real data, architecture or Git mutation was
performed. The eleven-check participant judging regression also passes. The full
global database/browser regression was not rerun for this backend-only chunk.

Earlier batch: [staff judging/recovery](staff-judging.md). Normal staff get filtered
queue/status pages and safe job/dispatch timelines, including physical holds.
Owner/Super Admin approval uses the existing confirmed extra-dispatch command,
not a new execution path; selected-target confirmation, original-key GET recovery,
navigation fencing, stale-read gating and a private paged decision history are
connected. Organisers have monitoring metadata only. No participant source,
hidden case identity/I/O, raw execution evidence or provider secrets are returned.
The focused ten-check real-browser/database suite and eleven-check participant
judging regression pass. All 255 unit/client checks, typechecks, production builds,
new-file formatting and the bundle check pass. Screenshots cover desktop/mobile
timeline and confirmation states. Role downgrade revokes access; a lost approval
reply produces one authorisation with no extra execution until the real worker
is ticked with the explicitly synthetic test driver. No schema, migration, permissions, recovery policy, production limit,
architecture, development/cloud data or Git history was changed. The complete
four-check normal staff/participant browser workflow also passes. The full global
database regression and the other specialised browser suites were not rerun in
this batch. Large retained-data query plans and installed-worker/load/deployment
gates remain open. Existing large editor/arena and Three.js warnings remain.

Earlier batch: [participant results/history](participant-history.md). The read-only
screen connects standings, own sample Runs, team official submissions, immutable
source/feedback, committed wallet entries, saved drafts and purchased hints.
Current Round 2 authority reads only the permitted member/team history from
closed Round 1 in the same instance. Shared workbench authorisation rechecks
session/credential/expiry/blocks and both round rows. Pages are bounded to 50
records with scoped stable-time/UUID cursors and 1 MiB metadata responses (combined
source/public-sample feedback retains the 8 MiB public-I/O ceiling). Live projection
changes and a five-second fallback update results without refreshing; only the
actual final lock labels standings final. Cancellation never invents a winner.
All 254 unit/client checks, ten focused history database checks and eleven
history-browser checks pass, including actual React/Fastify/PostgreSQL interactions
and desktop/mobile screenshot inspection. The seventeen-check workbench and
eleven-check judging regression suites also pass, along with the targeted
synthetic history and desktop/mobile moving/nonblank 3D tests. Typechecks,
production builds, new-file formatting and bundle-boundary checks pass.
No migration, permission, real data,
development/cloud database, architecture or Git mutation was performed.
The full global database regression has not been rerun for this batch; the prior
255-check result below belongs to the earlier batch. Installed runtime, real
capacity, retention, backups and hosting remain launch requirements.

Earlier batch: [restricted timing recovery](clock-recovery-ui.md). The real browser
connects the existing guarded incident status and own-code clearance to a separate
recovery-only screen. A new actor-scoped GET lookup recovers the original clearance
without repeating its POST or retaining the staff code. Stale/offline state,
wrong confirmation, lost replies, interrupted sign-out and new-incident fencing
are handled; normal admin access still needs deliberate normal sign-in. The
entry handoff obtains a fresh request token and the expiry display reads server
deadlines. No clock policy, database schema, permission, migration or deployment
was changed. All 252 unit/client tests, the full 255-check disposable PostgreSQL
suite and both complete browser suites (four normal-workflow checks plus two
restricted-recovery checks) passed with no skips. Typechecks, production builds,
new-file formatting and bundle-boundary checks also pass. Desktop/mobile recovery
screenshots were inspected. The browser suite uses the real clock monitor with
explicitly synthetic observations and a disposable database, not repaired host
time. Operator-only credential recovery and actual host-clock/runtime rehearsal
remain required. Existing large editor/arena bundle and Three.js warnings remain.

Earlier batch: [whole-round cancellation](round-cancellation.md). Owner/Super Admin
confirmation atomically records the incident and fences gameplay, dispatch and
awards. Bounded 20-parent batches mark unfinished work CANCELLED without a verdict
or completion time. The singleton arena remains held until real execution drain
is proven; finishing archives it without a sporting final. Paused/deferred work,
completed evidence and balances are retained. Cancelling Round 2 preserves locked
Round 1, never a same-arena Round 2 replay. The real staff panel has exact-round
confirmation, current own-code checks and GET-only lost-reply recovery; participant
editors receive live read-only state without a stuck scan. No development/cloud
migration or deployment was applied.

Previous cancellation verification: all 251 unit/client tests, all 255 checks in the full
disposable PostgreSQL suite, ten focused cancellation database checks and all
four checks in the complete real-backend browser suite passed, with no skips.
The twelve synthetic participant browser scenarios also passed, including
desktop/mobile 3D pixel/motion checks, delayed termination, private drafts and
pending feedback. Typechecks, both production builds, formatting of the new files
and the bundle-boundary check passed. The loopback synthetic preview was restored
at `http://127.0.0.1:5174/`.

The initial complete browser run was interrupted by the local session restart
before its exit could be collected. A fresh complete rerun after Docker reopened
now passes, including the final archived-round reload assertion. A still-valid
participant grant restores the preserved draft read-only; gameplay remains
disabled and no sporting final is invented. Desktop/mobile cancellation
screenshots were inspected, including clearing the stale connection warning after
successful receipt recovery. This is not a production or persistent development
database run. Real installed-judge drain, hosted HTTPS, capacity, backups and
deployment gates remain open. Existing large arena/editor bundle and Three.js
deprecation warnings remain.

Earlier batch: [staff discipline](staff-discipline.md). Owners/Super Admins can
block a team or member in the current arena, revoke only its access and clear
an exact block without reviving old sessions. Admitted judging, points, bounty,
qualification and funding are preserved. Positive whole-minute ranking penalties
are capped at 300 unreversed minutes per team-round, with once-only linked
reversals. Both rounds share the normal standings calculation and final-lock
coordination. Private paginated history and GET-only original-receipt recovery
are connected to the real staff UI. No development/cloud migration was applied.

Earlier discipline verification: 250 unit/client tests, the full 248-check disposable
PostgreSQL suite and the four-check complete real-backend browser suite passed,
along with typechecks, production builds, formatting and bundle-boundary checks.
The initial combined SQL attempt exposed test ordering after the old live suite
left Round 2 active; the new batch now runs before that terminal fixture and the
complete rerun passed. Pending/approved handoff retirement is also covered.
Desktop/mobile discipline screenshots were inspected. Production judge, hosted
HTTPS, realistic event load and deployment remain unverified. Existing large
arena/editor bundle and Three.js deprecation warnings remain.

Earlier batch: [CSV registration import](team-registration.md#csv-import). The
Owner/Super Admin Teams view now uploads/validates UTF-8 CSV, previews 50 records
per page and saves a confirmed all-or-nothing batch. Stable external IDs recognise
repeat uploads; conflicts never overwrite names, codes or enrollments. Codes are
shown once and may be explicitly exported as private JSON. Unknown replies retain
the original GET-only recovery handle. Raw files/codes are absent from receipts.

Each CSV accepts at most 100 teams/1 MiB; the pool remains 1,000 teams. A near-1,000
single save exceeded the approved two-second statement limit in the disposable
test, so the upload bound is 100, not a longer security-lock deadline. Bulk SQL
preserves all normal constraints and live notifications. Focused tests filled
the pool to 1,000 through these batches and verified mid-save rollback.

Earlier CSV-batch verification: 250 unit/client tests, nine focused PostgreSQL import
checks, the four-check focused registration browser suite and the four-check
full real-backend browser suite passed, together with typechecks, builds and
bundle checks. Desktop/mobile preview screenshots were inspected. The initial
broader browser attempt timed out during participant live-state sync while the
laptop had low free RAM; its later complete rerun passed. The full database suite
below is evidence from the earlier batch, not a fresh full-suite run. Production
judge, hosted HTTPS, realistic event load and deployment are still unverified.

Earlier batch: [manual team registration and code management](team-registration.md).
Owner/Super Admin commands create two stable members atomically, issue a code
once, and rotate it without resetting enrollment or competition state. Retired
credentials, both browser sessions and pending/approved handoffs are invalidated
together. Safe pagination, a 1,000-team pool guard, current own-code confirmation,
stale-state review and GET-only original-receipt recovery are included.

Earlier-batch verification: 246 unit/client tests, the 231-check full PostgreSQL suite, the
eight-check focused registration suite (including an additional reversed-clock
case), the four-check real-backend browser suite, typechecks, production builds
and bundle boundary checks passed. The browser suite contains the new registration,
rotation, response-loss and desktop/mobile assertions. Test containers were
removed; no development database, real credentials, cloud runtime or architecture
file was changed. Existing large arena/editor bundle warnings remain.

The user delegated column selection. The implemented target is
`registration_id,team_name,member_1_name,member_2_name`; a real export has not been
mapped/imported. Manual registrations have no external ID: do not assume that
matching names automatically link them to a later CSV upload.

## Required Feature Inventory

| Area | Current evidence | Remaining required work |
| --- | --- | --- |
| Local API and PostgreSQL | Health/readiness routes, separate restricted API role and startup privilege preflight tested; native service candidates prepared | Actual host installation and process/connection rehearsal |
| Registration storage | Two stable member positions; Owner/Super Admin manual/CSV registration with stable import IDs, preview/conflict checks and atomic 100-team batches; one-time code issuance/rotation, standalone revocation and deliberate reissuance, 1,000-team pool guard, literal private team/member/registration search and scoped pagination | Actual event-export preparation and manual-to-export reconciliation where needed |
| Access and language lock | Persisted entry, renewal/logout, expiry warnings, approved replacement and immutable receipts; first participant entry/restoration UI; qualifying activity and Linux clock/secret wiring, scheduled encrypted-handoff and bounded quota cleanup tested with real PG and synthetic observations | Primary-host runtime rehearsal, deeper participant recovery coverage, exceptional recovery and remaining verifier/source retention |
| Content and authoring | Private draft editor/checker, immutable snapshots, validation history/reports, human review and own-code-confirmed recoverable publication; durable runs/full check sets, fencing/recovery/accounting; pinned client/registry, guarded queue, capsule/producer interfaces, execution/recovery handoff, automatic deadline maintenance and separate app-side validation worker tested with disposable services; reason-required private single-dispatch diagnostics and paged access audit; general source-free staff audit navigation | Real-host sandbox/producer installation and runtime compatibility, primary-host service installation/rehearsal and whole-app resource reservations/cleanup |
| Participant workbench | Backend admission/frozen jobs, scoped content, private conditional drafts/receipts and official source; React/Monaco connects live gates, autosave/conflicts, Run/Submit/hints, public feedback, paged results/attempt/wallet history, private saved work and current-grant same-instance R1/R2 history | Deeper recovery/accessibility/edge coverage, dependency-aware source retention and real load/performance checks |
| Judge boundary | Registry/queue, separate private HTTPS gateway and continuous supervisor entry points, singleton session-bound readiness renewal, two automatic workers and read-only held-attempt recovery; guarded lifecycle/backend, release-tree integrity, native socket-listener PIDFD/executable checks and pinned Docker/image reports, native host resource/config authority, phase/storage identities, Linux residue checks and authority-gated certificate-to-slot release handoff implemented; per-capsule producer/CLI, filter/pipes, workspace and checked evidence tested locally; real v1 path not VM-verified | Production full-host retirement authority and installation, real host/daemon compatibility and image contents/loaded-policy verification, positive real-host preparation/retirement and interrupted-child tests, unknown-child/cross-boot recovery, genuine host proof producer, native runtime/scheduling calibration and capacity/security/recovery tests |
| R1/R2 competition | Normal lifecycle, published selections, scoped pauses, frozen official/sample jobs, fair dispatch/recovery, private feedback, independent R1 awards, fixed final results/draw/qualification, same-instance R2/carryover, manual ranking-time additions/reversals, drain-gated whole-round cancellation, automatic timer/sample maintenance, separate app-side judging worker/readiness and global earliest-receipt race tested with real PG and synthetic driver observations | Actual primary-host/judge installation and rehearsal, remaining UI and launch tests |
| Economy and standings | Append-only source-linked awards/debits/opening funds, sequential team hints, exact frozen-tier R2 points, both ranking rules, private HTTP/live projections and read-only paged wallet/award and provisional/final standings UI tested | Full production resource reservations/retention, event-content balance and load/recovery rehearsal |
| Live state | Source-linked streams, protected Socket.IO, consistent snapshots/replay, live claims/economy/judging/control updates and temporary team presence; React HUD/workbench, browser reload/pause/privacy and real local production TLS/proxy checks | Full event integration and 100-team burst/reconnect testing |
| Staff and round controls | Persisted grants/management APIs; React singleton/round/pause controls; Super Admin normal staff management, code/revocation and replacements; authoring, validation/publication, manual/CSV registration, discipline, cancellation and timing recovery; filtered judging/job timelines, confirmed extra-dispatch authorisation and private recovery audit/GET-only receipt recovery; operator-only backup Super Admins, fresh-code recovery and verified retirement; audited admitted-program/single-dispatch review and paged private-access history; private validation diagnostics and general immutable staff audit navigation | Real operator/secret-delivery rehearsal, remaining event controls, installed maintenance and launch coverage |
| Visual arena and accessibility | Cyberpunk circuit-city/codebase with articulated roaming mechanical crawlers, difficulty accents, queued post-IDE aimed termination, explicit pending Run/Submit indicators and cleared read-only markers; minimisable HUD, keyboard navigator, reduced-motion confirmation and responsive workbench; desktop/mobile screenshot and canvas-pixel checks | Further visual feedback, real-device calibration, comprehensive keyboard/accessibility audit and realistic 40-target performance |
| Hosting and event operations | Isolated judge lab; clock gate, durable incidents/watermarks, authorised clearance and private runtime loader tested with synthetic observations; production Caddy configuration/shared client-address boundary/local TLS tests; pgBackRest image/config candidate and real local encrypted chain/WAL restore with table/guard integrity and failed-key/manifest checks; offline restored-access/epoch quarantine and persistent admission gate | Actual Linux clock/probe/service-ownership rehearsal, public DNS/certificate renewal, installed private services, connection ceilings, secret rotation, monitoring/alerts, off-host GCS checks, physical restore fencing and reviewed reopening, full recovery rehearsal and deployment |
| Event launch gates | Not completed | Full browser/concurrency/security tests, realistic 100-team load/reconnect/burst testing, recovery rehearsal and validated competition content |

## Current Validation and Publication Batch

The [validation/review view](content-validation-ui.md) connects bounded saved
snapshot/run history, original-key admission recovery, visible pending progress,
per-language check results and physical cleanup state. Publication requires current
matching passed evidence, positive cleanup, four human content-review acknowledgements,
bounded notes and the reviewer's own current code. It preserves immutable content
and updates arena selection without reloading. Reopen shows the actual published
run, not an assumed latest validation.

New migrations add actor-owned immutable applied/rejected publication receipts and
replace the legacy publication function with a narrow confirmed command. Sources,
version locking and activity are atomic; lost replies reconcile through GET only.
Wrong confirmation does not end the staff session. Role/history audits and the
shared staff audit capacity include the new records. No runtime-readiness assertion
or manual result-writing endpoint is exposed.

The disposable real-browser check uses the existing synthetic validation worker,
not real language execution. It covers lost run/publication replies, matching
fifteen-check results, held-cleanup refusal and later drain, durable rejection,
stale/foreign-run refusal, own-code errors, protected immutable receipts, history
reload and publication-to-selection. The production judge/host, runtime scheduling,
full resource/retention, exceptional staff controls and event-launch gates remain
open. Migrations were generated/reviewed and exercised only in disposable tests;
the development database, cloud lab, architecture and Git history were untouched.

Verification: 232 API plus fourteen web client tests passed, along with 225
isolated backend checks, twelve participant browser scenarios and all four checks
in the expanded real-backend browser suite. Type checks, both production builds
and desktop/mobile layout checks passed. All new database effects used disposable
fixtures and synthetic runner observations. Large editor/3D bundle warnings,
actual sandbox/runtime installation and deployment/load/recovery gates remain.

## Previous Bug Library Batch

The [Bug Library editor](content-authoring-ui.md) connects metadata, five-language
private sources/defects/runtime selections, cases/reordering/retirement, three
hints, typed starter failures and separate version creation. Normal Owner/Super
Admin authority is required; published bytes are read-only. All commands keep
observed revisions, audit reasons and original-receipt recovery without write
replay. Imported UTF-8 files retain exact bytes; invalid imports preserve the
previous field. Unsent edits and uncertain commands block navigation.

Validation preparation now shows typed missing-content issues or an immutable
frozen check plan. It cannot execute code, pass a run or publish content. The
remaining validation-run/history/review/publication UI is a separate required
slice, not a feature omission. Existing production installation, runtime,
maintenance/resource/retention and deployment/load gates remain open.

The real React/Fastify/Socket.IO/PostgreSQL browser suite covers the connected
draft flow alongside existing staff and participant workflows. Unit checks cover
exact UTF-8 decoding and the narrowly enlarged private-case response bound.
No migration, new dependency, architecture edit, development data change, cloud
operation or assistant Git mutation was needed.

Verification: 232 API plus thirteen web client tests passed, along with all 225
isolated backend checks, twelve participant browser scenarios and four checks in
the real-backend browser suite. The latter covers actual cookie/CSRF/API/database
behavior with synthetic identities and runtime records, not real code execution.
Type checks, both production builds and the production bundle boundary check
passed; desktop/mobile screenshots were inspected. Test containers and temporary
servers were cleaned up. The existing participant preview was left running.
Large editor/3D bundle warnings and the live-host/device/load gates remain open.

## Previous Staff Access Batch

The [Staff and Access views](staff-access-ui.md) connect normal staff-account
management and participant browser replacement to their existing protected APIs.
Only Super Admin can create/edit/disable/re-enable/rotate Owners and Organisers;
ordinary staff can review specific replacement requests. One-time codes stay in
memory, are masked initially and are not silently reissued after a lost response.
Pending commands and unsent selections prevent accidental navigation. Stale
edits retain their original revision, and uncertain writes use GET-only recovery.

Real-browser checks also found and fixed two shared transport issues: failed
own-code confirmation is now distinct from session expiry, and cold bootstrap
without an audience cookie no longer requires optional recovery services merely
to discover the absence. Actual invalid sessions still clear protected data and
actual recovery actions still require their installed guard. No new schema,
permission bypass, runtime dependency, cloud operation or Git mutation was needed.

Verification: all 232 API unit/transport tests and ten web client tests passed.
All 225 isolated backend integration checks passed without skips, including the
updated recovery-confirmation contract. All twelve participant Playwright
scenarios passed. The separate real React/Fastify/Socket.IO/PostgreSQL browser
suite passed all four checks with normal staff management and actual participant
replacement, exact request-reference matching, stale-edit protection, denied
clipboard handling and counted once-only writes after lost responses. Desktop
and mobile screenshots were inspected. Type checks, both production builds and
the production bundle boundary check passed. Tests used synthetic identities and
disposable services, not development registrations or an installed cloud judge.
Large lazy editor/3D bundle warnings and real event-load gates remain open.

## Previous Staff Control-Room Batch

The [staff control room](staff-console.md) connects normal staff entry to the
existing arena setup and competition commands. Owners/Super Admins can select
registered rosters, duration and published bugs, operate both rounds, qualify R1
results and apply global/team/member pauses. Organisers monitor read-only.
Authoritative live state drives the roster status, standings and judging view.
Sensitive commands retain own-code confirmation, audited reasons and observed
revision checks. Uncertain responses are recovered through the original receipt,
never an automatic duplicate POST. Stale edits retain local selections for review.

The bounded new read-only projections expose control metadata, not credentials,
source or private test content. Historical arena links remain authenticated.
There is no new migration, changed competition rule, readiness bypass or live
judge execution. The disposable real-browser test covers the normal two-round
lifecycle and core recovery/permission paths. Remaining staff screens and the
production runtime/installation still need implementation and verification.

Verification: 232 API unit/transport tests and nine web client tests passed.
All 225 backend PostgreSQL/Redis/HTTP integration checks passed without skips.
All twelve participant Playwright scenarios passed, including the rendered
3D/canvas checks. The separate real React/Fastify/Socket.IO/disposable-PostgreSQL
browser suite passed all four checks with the new normal staff flow, delayed
background reads, strict write counting and original-receipt recovery. Desktop
and mobile staff screenshots were inspected. Type checks, both production builds
and the production bundle boundary check passed. Large lazy 3D/editor chunk
warnings remain; this is not event-capacity or real-judge installation evidence.
No new dependency, migration, development data change, cloud operation or
assistant Git mutation was required.

## Previous Participant Interface Batch

The [participant interface](participant-ui.md) connects the existing protected
entry, live state and workbench contracts without browser-owned competition
effects. A separate loopback-only fixture preview enables visual review without
touching development data or enabling a fake production judge. The real browser/
Fastify/PostgreSQL check verifies actual cookie/CSRF and live draft behaviour.
The full staff panel and production runtime remain required, not silently skipped.

The visual follow-up replaces the rounded targets with mechanical crawlers and a
neon circuit-city/codebase. Own live award events now carry their bounty ID into
a presentation queue; the weapon waits until the IDE closes. The hidden scene
pauses during editing, and each new shot starts its own animation clock. Sample
scans and official validation have separate pending indicators, preserve the two
sample slots and show recovery uncertainty separately. Claimed targets show a
check mark/read-only state and cannot be attempted again. No scoring, hint cost,
authentication, database schema or judge-execution rule was changed.

Verification: 232 API unit/transport tests plus eight web client tests passed;
all twelve Playwright browser scenarios passed, including actual Monaco typing,
responsive screenshots, source privacy, desktop/mobile canvas pixels/motion,
two pending sample slots, a rendered laser after IDE exit and cleared inspection.
The separate real-API browser suite passed all four checks with disposable
PostgreSQL and real Fastify cookie/CSRF/live handling. Production bundle checks,
type checking and both builds passed. Dependencies were unchanged in this visual
follow-up; the dependency audit and full 225-check backend suite remain the prior
batch's evidence, not new reruns here.
No development database migration, cloud change or Git mutation was performed.

## Previous Workbench Batch

The [participant workbench](workbench.md) derives source ownership and language
from current session/round participation. Exact-byte private drafts use atomic
version checks, durable original-intent outcomes and normal pause/claim/closing
gates. Changed saves and deliberate openings qualify as activity; background
reads and unchanged/rejected saves do not. Valid R2 grants provide scoped R1
read-only history without reviving an old session. The browser-independent
controller preserves unsaved text, limits dirty buffers and reconciles lost
responses without automatic write replay. This is backend/controller work,
not a visible editor or event-ready deployment.

Verification: all 231 unit/transport tests and 225 disposable PostgreSQL/Redis/
HTTP/clock integration checks passed without skips. The latter includes the
new workbench and owner-only real socket delivery tests alongside all prior
regressions. Type checking, build, unchanged-schema generation and the production
dependency audit passed. Migrations 0043-0047 were applied only to disposable
test databases, whose owned services/volumes were cleaned. Development data,
cloud configuration, the approved architecture and Git history were unchanged.
The editor UI, seven-day payload-retention supervisor, full resource accounting,
real judge installation and browser/load/deployment gates remain required.

## Previous Realtime Batch

The [live state backend](realtime.md) connects committed changes to protected
round, team, member and role-safe staff streams. Snapshots and replay are
consistent under existing security/arena/round coordination. The client handles
missed events, duplicate awards, reconnects and coherent view refreshes; teammate
presence is transient and never renews a login. Delivery reservations, protected
control headroom and bounded replay retention are included. No frontend,
production migration, cloud change or Git mutation is implied by this batch.

Verification: 217 unit/transport checks and all 210 disposable PostgreSQL/queue/
HTTP/clock integration checks passed without skips. The final focused live suite
also passed all 19 checks after restricting official per-case invalidations to
staff, including protection against hidden progress inferred from message counts.
Type checking, build and unchanged-schema generation passed; the dependency audit
reported no known vulnerabilities. Real browser/proxy, full event load, installed
judge and production deployment gates remain open.

## Previous Participant Judging Batch

The [participant judging backend](participant-judging.md) connects Run/Submit to
durable case plans, two-per-member sample capacity, full-suite admission,
three-official/one-sample fair team rotation and shared physical reservations.
Once-only send records survive lost replies/replacement workers; checked results
settle through the existing competition engine. Sample expiry releases only its
logical allowance. Staff monitoring and one confirmed safe extra official dispatch
are behind protected APIs. Production installation, genuine retirement authority,
complete shared resource reservations, runtime supervision and launch tests remain
required. No new live execution authority is enabled.

Verification: 205 unit/transport checks and all 194 disposable PostgreSQL/queue/
HTTP/clock integration checks pass, with no skips. Typecheck/build pass and schema
generation reports no pending changes. The complete regression was rerun after
the final terminal-state constraints and polling-budget checks. Participant runner
observations are explicitly synthetic; no participant source or cloud host was
executed/certified. Migrations 0033-0038 were applied only to disposable databases.

## Previous Competition Engine Batch

The [competition engine](competition-engine.md) implements the normal connected
R1/R2 lifecycle and economics behind the existing protected API. Configuration
uses reviewed/published immutable validation snapshots; sensitive actions require
current Owner/Super Admin authority and code confirmation. Every official source
retains its original admitted order/time and hint tier. Reliable full case-set
assessment is restricted to a separate non-login worker privilege group, never an
HTTP verdict endpoint. R1 credits each team once; R2 waits for earlier unresolved
receipts and has one winner. Global pause defers automatic effects, and only a
global resume extends the shared closing time.

Hint/award/opening records require exact append-only ledger effects and nonnegative
balances. Standing order preserves the agreed points/time/difficulty priorities
and sporting ties. Finalisation refuses unresolved official work. Qualification
reveals one encrypted precommitted roster permutation, uses it only to decide
membership at a tied cutoff, and cannot reroll. R2 funding comes once from that
same instance's fixed R1 result while R2 points start at zero.

Normal startup does not install the injected competition readiness/draw-key
dependency, actual official/sample scheduler, deadline worker or live delivery.
No source is executed by these tests. Cancellation, discipline integration, full
resource/retention guards, workbench/admin screens, real judge/deployment and load
rehearsal remain required. No feature is silently removed and this is not a live
event-ready backend. The full implementation and verification boundaries are in
the linked handoff document.

Verification: 204 unit/transport checks and 185 disposable PostgreSQL/queue/HTTP/
clock checks passed, including eleven new competition scenarios. The final focused
competition rerun passed after confirmation-quota and concurrent-spending checks.
Type/build and schema-regeneration checks cover the new files. Earlier Linux
sandbox evidence remains separate; this batch does not certify live execution.
No new package dependency, cloud operation, persistent development migration,
architecture edit or assistant Git mutation was required.

## Earlier Native Docker Peer Batch

`native/docker-peer-exec.c` is a one-shot static Linux wrapper, not another
background service. Before a Docker CLI command, it connects to the protected
fixed socket and obtains `SO_PEERCRED` plus `SO_PEERPIDFD` directly from that
socket. There is deliberately no racy numeric-PID fallback. The pinned process
must be root in the wrapper's user/PID/mount/network/IPC namespaces, with the exact
reviewed daemon executable inode. That PIDFD and executable/socket observations
are checked throughout the command and after its exit.

The release manifest is version 3 and retains original verified open descriptors
for the static wrapper, Docker CLI and daemon. The native check also refuses
set-ID modes and file capabilities on those three executables. Old manifest versions are refused, with no host epoch/image or
checkpoint migration. Missing kernel support, a proxy/socket-activation listener,
peer death/re-exec, cancellation or command failure leaves the original outcome
uncertain. No automatic retry, permission change, new pin or cleanup authority is
introduced. Parent-death signals stop only the wrapper's own CLI child; the peer
daemon is never signalled.

The isolated Linux fixture compiles the actual wrapper and a fixed synthetic
daemon/CLI. It tests the protected-file/report flow, wrong listener executable,
peer exit and same-PID re-exec during a held command, forbidden endpoint overrides,
and cancellation without leaving a running CLI. This exercises kernel mechanics,
not the actual cloud daemon or participant source. The wrapper compares namespaces
to its caller, not a certified initial host. Socket peer credentials alone also
do not prove which acceptor serves every request if a trusted listener delegates
its socket. Full-host process/service control, loaded-policy verification,
dependency review, real VM compatibility, readiness/retirement and capacity gates
remain required. Normal startup still enables none of these production powers.

Verified: 200 unit/transport tests, 174 disposable database/queue/HTTP/clock checks,
128 Linux/Docker checks (31 launcher/checkpoint/config/PID-1, 15 native phase,
52 workspace/quota, five Docker lifecycle, six storage/proc, seventeen installation
fixtures and two real read-only metadata checks), plus four Python clock tests
passed without skips. Type checks/build passed; the production dependency audit
reports no vulnerabilities. These tests did not run participant source, certify
a real judge host, change the cloud/architecture or perform a Git mutation.

## Earlier Docker Report Batch

`docker-host.ts` validates bounded Docker reports without running, creating or
pulling an image. The reviewed daemon digest binds its reported ID/name, engine,
kernel, storage/cgroup configuration, security options, runtime configuration and
component commits. Changing workload counts do not alter that identity. Only the
reviewed Linux x86-64 cgroup-v1/cgroupfs/runc configuration with reported resource
support, AppArmor/builtin seccomp, inactive Swarm, no live restore/experimental
mode and no warnings is accepted. This is a deliberately narrow configuration,
not permission to change the actual host to make a test pass.

The image must report the original immutable ID and Linux/amd64 platform, valid
layers and no inherited anonymous volumes. Its entire configuration and ordered
layer list are pinned, including environment, command, health checks, labels and
future config fields. An info/image/info sequence checks the daemon report around
image inspection. Report pins are never learned from the response being checked.

The installation manifest is now version 2 and binds both report digests into its
release hash. Version 1 is refused; no old checkpoint, host epoch, image pin or
historical evidence is converted. Checks run on opening/verifying the installation
and around every driver command, using only the verified open Docker executable,
fixed local daemon/config and original socket identity. Separate native host
preparation remains mandatory before create/start.

Positive Linux tests use fixed synthetic reports through a real trusted C CLI
fixture. They cover changed reports before/during preparation, refused creation,
read-only queries and descriptor cleanup. Two additional read-only checks reject
the real local daemon against synthetic pins and inspect the cached real image
without executing it. Neither approves a production host or runtime. Authentication
of the actual daemon peer, immutable host/image contents, loaded policies, full
visibility/containment, retirement, VM calibration and load gates remain required.
No cloud, daemon mutation, startup activation, DB migration or Git mutation is
introduced by this batch.

Verified: 199 unit/transport tests, 174 disposable database/queue/HTTP/clock checks,
125 Linux/Docker checks (31 launcher/checkpoint/config/PID-1, 15 native phase,
52 workspace/quota, five Docker lifecycle, six storage/proc, fourteen installation
fixtures and two real read-only metadata checks), plus four Python clock tests
passed without skips. Type checks/build passed; the production dependency audit
reports no vulnerabilities. Owned test containers/volumes were removed after
ownership checks. No real host, loaded policy or event deployment was certified.

## Earlier Installation Integrity Batch

`host-installation.ts` verifies an ordered, bounded release manifest whose digest
comes from trusted host configuration. All installed files, including app
dependencies, must match reviewed bytes, exact modes and root ownership. No
unlisted files/directories, symlinks, hard links, traversal, writable installation
directories or alternate Docker-client configuration are accepted. The release
tree is read-only to non-root actors; this is not proof against a compromised host
or a guarantee that all operating-system dependencies are covered.

The verifier holds the reviewed Docker executable open, pins the root-only Unix
socket identity and uses the existing fixed daemon/config command adapter.
It rechecks the complete tree before and after the separate required preparation
authority at create/start. Changed executable/socket identities, closed handles,
aborts or failed checks cannot start the capsule. The shared process transport
now closes empty stdin without issuing an unnecessary zero-byte write; repeated
fast native read-only fixture commands test that path without masking exit,
diagnostic, cancellation or nonempty-request errors.

No installer, service, cloud change, daemon mutation, readiness lease or retirement
authority is added. The existing native full-host visibility/containment,
no-future-start, actual image/daemon/loaded-policy and VM/load verification gates
remain. Positive Linux tests use a clearly synthetic release, a fixed trusted C
CLI fixture and a disposable Unix socket, never the host Docker socket or
participant source. No real installation or host is certified by these tests.

Verified: 190 unit/transport tests, 174 disposable database/queue/HTTP/clock
checks, 119 Linux/container checks (31 launcher/checkpoint/config/PID-1,
15 native phase/filter, 52 workspace/quota, five Docker lifecycle, six storage/
proc and ten installation-integrity) and four Python clock tests passed without
skips. Type checks/build passed and the production dependency audit reports no
vulnerabilities. The installation tests also verify no descriptor leak after
repeated late policy failures. No cloud, persistent development database,
architecture, historical lab or Git mutation occurred.

## Earlier Retirement Handoff Batch

`capsule-retirement.ts` accepts only a separately supplied trusted host authority
bound to the original epoch, boot and release. It requires matching original-ID
container removal, resource/phase/storage records and an existing immutable result.
An exact source-free challenge binds all checkpoint/physical/result digests; a
stale, malformed or mismatched response cannot certify that execution.

The handoff saves a write-once mode-0400 retirement certificate before appending
drain proof through the existing checkpoint format. Lost certificate/drain replies
recover the same certificate without another host probe or any source execution.
Original result bytes stay unchanged. Cancellation, conflicting records/proofs,
missing results and failed checks keep the slot held. Read-only result recovery
cannot invoke this authority. No public maintenance endpoint or startup activation
is added. The default backend still emits no full drain.

Docker removal/reconciliation now verifies absence by full original ID as well
as exact name; a renamed retained original cannot produce a removal receipt.
The new real Docker regression uses only an owned stopped trusted fixture.

**The production full-host retirement authority remains unimplemented and
uninstalled.** A matching digest or callback is not proof of actual containment,
complete host visibility or no-future-start. Positive new protocol/durability/PG
tests use explicitly synthetic authorities, never production substitutes. Real
Linux host control/visibility verification, image/security installation, general
v1 execution/recovery, quotas/process fairness and cloud/security/load gates remain
required. Unknown executions with no reliable result stay held, not converted to
invented participant verdicts. Historical lab state and permits remain unchanged.

Verified: 182 unit/transport tests, 174 disposable database/queue/HTTP/clock
checks, 109 Linux/container checks (31 launcher/checkpoint/config/PID-1, 15 native
phase/filter, 52 workspace/quota, five Docker lifecycle and six storage/proc)
and four Python clock tests passed without skips. Type checks/build passed;
the production dependency audit reports no vulnerabilities. All owned test
containers and the durable volume were removed after ownership checks.
The backend busy guard is held through asynchronous certificate persistence.
The integration fixture preserves the earlier deliberately held unknown execution;
it never resets that permit or invents cleanup to make the new tests pass.
No cloud, persistent development database, architecture or Git mutation occurred.

## Earlier Storage Reference Batch

Before workspace writes or execution, the capsule now durably saves its four
private tmpfs device/mount identities, bound to the original attempt, boot and
physical identity. The record uses fixed canonical identifiers, not arbitrary
paths as JSON keys. Missing, partial, changed or aliased records are refused.

Explicit resource retirement validates this record before deletion and, after
original-ID Docker removal and owned group/config cleanup, performs a read-only
Linux proc observation. It checks visible threads, namespace identities, cgroup
membership, mount devices, open descriptors, cwd/root and executable references.
Original storage is recognized by device, not filename; a rename/unlink cannot
hide a still-open reference. Unreadable state, remaining references, boot drift,
cancellation or the bounded inspection limits prevent the cleanup receipt.

This observation does not prove complete host visibility or irreversibly fence
every future launcher/daemon. It neither releases capacity nor fabricates a
positive drain or participant verdict. Production installation must verify the
actual host proc/namespace/cgroup/MAC visibility and no-future-start boundary;
real v1 recovery, UID/process fairness, aggregate storage, security/load and
cross-boot host fencing remain required. Judging remains disabled.

New tests cover strict decoding/canonical checkpoint transport, real durable
records after a killed synthetic controller and real Linux tmpfs/proc/FD checks
inside an owned networkless container. Deliberately synthetic unmatched IDs
test the observer's mechanics only, not physical cleanup of a general sandbox.
No cloud resources, architecture, historical lab, persistent development database
or Git history were changed.

Verified: 166 unit/transport tests, 172 disposable database/queue/HTTP/clock
checks, 106 Linux/container checks (29 launcher/checkpoint/config/PID-1, 15 native
phase/filter, 52 workspace/quota, four Docker lifecycle and six storage/proc)
and four Python clock tests passed without skips. Type checks/build passed;
the production dependency audit reports no vulnerabilities. Owned test containers
and the durable volume were removed after ownership checks.

One earlier database run during concurrent heavy Docker tests failed an existing
100-ms quota-refill assertion; the full isolated rerun passed. No quota policy or
assertion was weakened. That timing-sensitive fixture still needs stabilisation
before treating a heavily loaded CI run as deterministic evidence.

## Earlier Interrupted-Phase Recovery Batch

Each compile/run now records a mode-0400 phase-init intent before Isolate setup,
then records the original empty memory/CPU job-group device/inode identities
before launching the target. Both records bind the original attempt, boot,
physical capsule and fresh nonce. They contain no source, input or output.
A newer run-init intent fences the compiler's older group identities even if
the process dies before recording the run groups. Recovery cannot guess them.

After verified original-ID container removal, same-boot resource retirement
can remove the recorded empty `jobs/box-0` children before their owned parents.
Nonempty, replaced, unrecorded or unexpected child groups remain held. No
recursive deletion, task migration, counter reset or guessed PID kill is added.
The backend exposes explicit internal maintenance retirement, separate from
read-only result recovery. It returns only saved evidence or no result; neither
cleanup receipts nor container removal invent a verdict or free capacity.

New tests cover strict phase bindings and stale-compiler fencing, real durable
records after a killed synthetic controller, explicit retirement failures and
one real detached trusted child in an owned Docker container. Saved test inode
values are synthetic, not proof of real v1 group removal. The Docker fixture
executes only hardcoded trusted Node code and tests lifecycle, not Isolate.

Full namespace/workspace/drain authority, real v1 interrupted-child verification,
cross-boot host fencing, immutable image/security installation, aggregate storage
reservations, process-limit fairness and realistic cloud/security/load tests
remain required. This batch adds no runtime activation or public cleanup endpoint.
Judging remains disabled. No architecture, persistent development database,
cloud resource, historical lab evidence or Git history was changed.

Verified: 156 unit/transport tests, 172 disposable database/queue/HTTP/clock
checks, 99 Linux/container checks (28 launcher/checkpoint/config/PID-1, 15 native
phase/filter, 52 workspace/quota and four Docker lifecycle checks) and four
Python clock tests passed without skips. Type checks/build passed; the production
dependency audit reports no vulnerabilities. Harness resources were removed
after ownership checks. Native positive cgroup-v1 removal is still untested.

## Earlier Host Resource Batch

The [host resource authority](judge-executor.md#host-resource-preparation) now plugs
into the outer lifecycle: prepare before Docker create, re-verify before the
source-start receipt, and retire owned resources only after verified original
container removal. Read-only verdict recovery still invokes none of these hooks.

Preparation requires the original boot and canonical real cgroup-v1 mounts for
every hierarchy, including cpuset/named controllers, not only memory/CPU/pids.
It journals the allocation plan before writes, creates fresh private bounded
parents, records original mount/inode identities and saves exact mode-0400
source-free configuration on protected durable storage. Verification is read-only;
no resetting counters, reusing partial setup or repairing mismatches to pass.

Cleanup journals intent before removing only original empty docker/jobs/parent
groups and the exact known configuration. Unexpected descendants/files, tasks,
changed topology/identity or incomplete setup remain held. A partial removal can
continue against the saved same-boot identities without execution or recreation.
The resource receipt is not a full drain/capacity-release certificate.

Native writes/removal on the actual v1 VM, interrupted-child and cross-boot
recovery, complete namespace/workspace retirement, image/security installation,
genuine clock/readiness, aggregate storage reservations, process-limit fairness
and real cloud/security/load rehearsal remain required. Local tests verify real
durable config handling and rejection of local v2, not a positive v1 kernel path.
Participant judging remains disabled. No architecture, persistent development
database, cloud resource, historical lab or Git history was changed.

Verified: 146 unit/transport tests, 172 disposable database/queue/HTTP/clock checks,
96 Linux/container checks and four Python clock tests passed without skips.
Type checks/build passed; the production dependency audit reports no vulnerabilities.
The six new Linux checks cover real durable config handling, bounded immutable
resource receipts and v2 refusal. Positive v1 kernel writes/removal remain untested.

## Earlier Outer Capsule Lifecycle Batch

The [outer capsule lifecycle](judge-executor.md#outer-capsule-lifecycle) saves an
exclusive allocation intent before Docker create and a separate once-only start
receipt before sending input. Lost create replies reconcile the original named,
labelled container; recovery never creates a replacement or resends source. An
interrupted create with no verified object remains held, not silently retried.

The fixed Docker adapter checks immutable image/command/ownership, exact mounts,
tmpfs and resource limits, network/restart/healthcheck/logging restrictions and
security settings. Its trusted host preparation boundary is required before both
create and start; no real installation supplies that authority yet. The outer
backend reads only original bound checkpoint/physical evidence for verdicts.
Read-only verdict recovery needs neither Docker nor readiness and changes no
receipts. Explicit stop/removal checks the same ID before each operation and
reconciles a lost remove reply only after durable stopped/removal receipts.

Container removal is **not** complete physical retirement. No new positive drain,
parent capacity release, result, score or participant admission is inferred.
Real host cgroup/config provisioning and empty-parent/storage removal, image/MAC/
filter installation, UID-scoped process-limit fairness and actual VM execution
remain required, followed by the full cloud/security/recovery/load rehearsals.

Verified: 137 unit/local-HTTPS/transport tests, 172 disposable PostgreSQL/Redis/HTTP/
clock checks, 90 Linux/container checks across four owned harnesses and four
Python clock tests passed without skips. Type checks/build passed; the production
dependency audit reports no vulnerabilities. The 90 checks include smaller trusted
Docker fixtures and synthetic evidence, not a certified general sandbox. Test
containers/volume were ownership-checked and removed. Details are recorded in
the execution-handoff document.
No architecture, historical lab, cloud resource, persistent development database
or Git history was changed. Participant execution remains disabled, and every
remaining approved application feature is still required.

## Earlier Per-Capsule Producer Batch

The [Isolate producer](judge-executor.md#per-capsule-isolate-producer) connects
once-only source preparation, fresh per-phase groups/limits, fixed native commands,
protected captures, original counters and checked result assembly. Its strict
compiler diagnostics distinguish supported source failures from unknown tool/IO/
resource failures, which remain infrastructure uncertainty. Wrong-answer checking
still belongs to the frozen backend checker, never the execution service.

The private one-job CLI binds root configuration to the original owner/provider/
attempt/full payload and version-2 policy. It saves results before replying and
exits on refusal/failure/deadline as namespace init. Physical capsule/namespace
identities are saved before code starts; recovery reads original disk evidence
without readiness, compilation, retries or automatic drain.

The native handoff now installs an additional syscall filter that denies new
namespaces, mounts, tracing and network creation while permitting ordinary fork
and supported runtime fallbacks. A candidate per-capsule AppArmor profile is saved,
not loaded or certified. These components do not certify their own host lease.

Verified: 123 unit/local-HTTPS/transport tests, 172 disposable PostgreSQL/Redis/HTTP/
clock checks, 83 Linux checks across three owned harnesses and four Python clock
tests passed without skips. Build/type checks passed. Real native fixtures execute
only fixed C/C++/Node programs; all-five-language flow tests use synthetic phase
observations. Saved physical identities survive an actual killed synthetic
producer; a real PID-1 refusal test starts a trusted child and leaves no running
container. No real Isolate/cgroup-v1 positive path was tested on local cgroup v2.

Next required work is the outer host capsule provisioner/launcher adapter and
guarded physical retirement, followed by immutable image/security installation
and real VM tests for all five languages, attribution, host clock, concurrency,
crash/retirement and load. Verify UID-scoped process-limit fairness across capsules;
parent pids.max alone is insufficient. Retained starts/uncertain results cannot be
reset to make these gates pass. Participant execution remains disabled.
No cloud resource, persistent database, architecture, historical lab state or Git
history was changed. All remaining approved app features are still required.

## Workspace And Accounting Batch

The [source workspace preparer](judge-executor.md#source-workspace-and-accounting)
now requires separate fresh quota-bound workspace/control tmpfs mounts, preserves
exact source bytes and checks private once-only preparation/ready receipts. It
pins original mounts/files and refuses concurrent reuse, stale/incomplete state,
source/path corruption and changed quotas/ownership. All compiled artifacts,
including nested/companion Java classes, remain in the same workspace. Closing
descriptors is not cleanup; no automatic reset or recursive deletion was added.

A read-only cgroup-v1 observer rejects fake groups, changed limits, nonempty job
groups and malformed/decreasing counters. It preserves CPU nanoseconds, peak
bytes, memory/combined-limit hits and OOM counts without inventing a verdict or
drain proof. Its successful kernel path is **not yet VM-verified**. Local tests
cover strict synthetic decoding and actual refusal of ordinary filesystem groups.

Verified: 108 unit/local-HTTPS/transport tests, 172 disposable PostgreSQL/Redis/HTTP/
clock checks, 77 Linux checks across three owned harnesses and four Python clock
tests passed without skips. The new harness contributes 52 checks across 17
fresh containers, including actual 64 MiB and 4,096-inode exhaustion. Other Linux
fixtures still execute only fixed trusted programs. Build/type checks passed.

The actual Isolate backend must still connect workspace and native phase I/O to
verified containment/accounting, target execution/attribution and durable physical
identities/recovery. Production installation/runtime/filter/security, full-tree
cleanup, resource/load and cloud rehearsal remain required. No cloud resources,
persistent database, historical lab state, architecture or Git history changed.
Participant and authoring execution remain disabled; this is not event readiness.

## Native Phase Batch

The [native handoff and phase collector](judge-executor.md#native-phase-handoff)
now validate restricted UID/GID, capabilities and kernel protection presence before
exec, replace inherited environment/signal state, set descriptor/core limits and
close all extra descriptors on exec. A separate challenge pipe cannot be forged
through ordinary output. A fixed Isolate command builder reconstructs and checks
the reviewed language plan, without accepting source-provided command overrides.
The collector preserves exact input/output bytes in fixed bounded buffers, keeps
manager diagnostics separate and handles overflow, early EOF and cancellation
without inventing verdicts or cleanup proof.

Verified: 105 unit/local-HTTPS/transport tests, 172 disposable PostgreSQL/Redis/HTTP/
clock checks, twenty-five Linux adapter/checkpoint/native checks across two owned
harnesses and four Python clock tests passed without skips. Build/type checks
passed. New native tests compile/run fixed trusted C17/C++17 programs; they do
not execute participant or authoring source and do not exercise Isolate/cgroups.

The kernel backend still must connect verified workspace/source preparation,
real resource accounting and physical checkpoints to this handoff; verify target
execution/attribution and full-tree cleanup; and complete runtime/filter checks,
immutable installation, storage quotas and cloud security/recovery/load rehearsal.
A pre-exec witness is not target execution or drain proof. No cloud, Git,
persistent database, architecture or historical lab state was changed.

## Result Checkpoint Batch

The [protected result store](judge-executor.md#protected-result-checkpoints) now
persists the original plan binding before backend execution and validated result
bytes before PostgreSQL sealing. Its root-only Linux files are bounded and
write-once, with synced file/directory publication. A producer killed after save
or a failed database seal recovers the original answer without another execution.
Incomplete starts and interrupted writes remain held. Positive cleanup is a
separate append-only record; it cannot rewrite bytes or resource accounting.

Verified: 100 unit/local-HTTPS/transport tests, 172 disposable PostgreSQL/Redis/HTTP/
clock checks, thirteen Linux adapter/checkpoint checks within one owned-container
harness and four Python clock tests passed without skips. Build/type checks
passed. Tests use real Linux files and killed synthetic processes, not supplied
source execution. Container and volume ownership is checked before cleanup.

The actual kernel compile/run backend, durable physical process/workspace
identities, hard storage quota/retention, production installation and cloud
power-loss/recovery/load rehearsal remain required. Per-record bounds/free-space
checks are not an aggregate volume quota. No VM, persistent database, historical
lab evidence, Git history or architecture was changed. This is not event readiness.

## Launcher Control Batch

The [general launcher control core](judge-executor.md#general-launcher-core) now
validates the exact original owner/token/payload and freezes the five-language
command/environment/budget plan. Source bytes cannot become command arguments.
Java's plan requires preserving the entire compiled workspace. The plan hash is
checked against the backend contract, not treated as proof of Linux isolation.

The launcher commits a separate immutable backend-start record before executing.
Concurrent/replacement calls cannot repeat that start, and claimed-but-unstarted
records cannot seal results. Verified evidence is snapshotted and committed before
reply, so lost output can reconcile directly from PostgreSQL without another run.
Missing evidence or a lost start acknowledgement keeps the reservation held.
Recovery reads/checks the original execution only; late cleanup cannot rewrite
sealed result bytes/accounting. No transaction stays open over backend work.

Verified: 98 unit/local-HTTPS/transport tests, 172 disposable PostgreSQL/Redis/HTTP/
clock checks, three Linux adapter checks (one owned-container harness) and four
Python clock-probe tests passed without skips. Type checking/build passed. The
judge-only start-gate migration is for fresh empty general registries and was
applied only inside owned disposable tests, never a persistent/cloud database.

The actual kernel sandbox backend, durable physical checkpoint implementation,
genuine health/runtime verification and production entry point/install/rehearsal
remain required. The backend used for new tests is synthetic and executes no
submitted source. No lab controller rerun, host registration, production enablement,
Git operation or edit to `architecture.md` was made. All full-app features remain
required; this control core is not an event-ready judging service.

## Execution Handoff Batch

The [supervisor execution/recovery worker](judge-executor.md) now connects a fresh
committed queue claim to a fixed protected-launcher client, validates the entire
bound result and seals it through the existing registry. Duplicate/overlapping
workers do not issue another execution. Lost launcher/seal replies recover only
the original owner's retained evidence; missing evidence keeps the reservation
held. A supervisor-only read function cannot transfer or reset a permit. Late
cleanup remains separate from immutable result bytes/accounting.

The Linux client accepts only the fixed root-owned mode-0555 launcher with the
configured hash, protected ancestors and exact boot for fresh execution. It
executes the verified open descriptor, with no shell or inherited app secrets,
bounded pipes/deadline/cancellation and fail-closed diagnostics. A separate
read-only recovery mode may inspect an old boot's retained evidence. Neither the
worker nor its launcher preflight grants the independent registry readiness lease.

Verified: 95 unit/local-HTTPS/transport tests, 164 disposable PostgreSQL/Redis/HTTP/
clock checks, three Linux adapter checks in one owned-container harness and four
Python clock-probe tests passed without skips. Type checking, build and unchanged
competition-schema generation (66 tables) passed; dependency audit was clean.
Owned containers and temporary credentials/certificates were removed.

The actual general sandbox launcher, durable protected checkpoint/evidence
producer, real runtime/health/clock verification and service/deployment wiring
remain required. No supplied source was compiled or run: real processes/containers
here execute only benign synthetic protocol fixtures. No live host was certified,
historical cloud lab rerun, persistent database migrated or production worker
enabled. All approved app features and launch gates remain required.

## Judge Queue Batch

The [judge-only queue](../infra/judge-gateway/README.md#judge-only-queue) now
publishes source-free attempt/provider identities and reconciles them against
PostgreSQL's durable one-time launch permits. Duplicate publications and lost
Redis/outbox acknowledgements keep one association. Even previously acknowledged
unclaimed jobs are reconstructed after a cold Redis restart; `published_at` never
means the queue is permanently durable. The full bounded backlog is considered,
not only the first sixteen unpublished rows.

The receiver recovers pending messages under its stable consumer identity. Only
a fresh committed permit returns the frozen payload once. Queue acknowledgement
does not release physical capacity or turn an uncertain execution into a verdict.
Unknown/corrupt deliveries remain held, the stream refuses a 121st entry without
trimming, and a separate restricted publisher role cannot read code, mint
readiness, claim a job or seal results. Transport has fixed private destinations,
generated authentication, bounded operations, total deadlines/cancellation and
no reconnect/offline replay. This is judge-internal authoring transport, not a
new application queue framework or replacement participant scheduler.

Verified after this batch: 87 unit/local-HTTPS/transport tests, 155 disposable
PostgreSQL/Redis/HTTP/clock checks and four Python clock-probe tests passed without
skips. Type checking, build and unchanged competition-schema generation (66
tables) passed; full dependency audit reported zero vulnerabilities. Owned test
PostgreSQL/Redis containers and temporary credentials/certificates were removed.

The real protected executor, supervisor environment/readiness checks, process and
secret installation, cloud wiring and execution/load/crash/retirement rehearsals
remain required. No source was executed, persistent database migrated, cloud lab
rerun, host certified or production service enabled. Git operations remain with
the user; `architecture.md` and unrelated user files are untouched.

## Judge Gateway Registry Batch

The [judge-only gateway/registry](../infra/judge-gateway/README.md) now atomically
registers the frozen payload with its provider record and durable outbox. Duplicate
admission resolves to the same association. A committed one-time launch permit
cannot be reclaimed by duplicate delivery or a restarted process. Private results
are immutable, later physical drain is independent, uncertain work holds its
capacity, and exact epoch/boot/runtime mapping is enforced. Separate database
privilege groups cannot forge each other's functions or change the tables.

The real pinned mTLS client now talks to the actual new gateway using a disposable
judge database in tests, including wrong credentials, byte bounds, strict fields
and private errors. Those tests use a structural provider table fixture and
synthetic evidence; they do not launch code or install the real Judge0 engine.
New registry SQL is separate from competition migrations and must not be applied
to the old lab. No host/runtime/login/credential is seeded by its installer.

The protected executor, Redis publisher, genuine supervisor health/clock/boot
verification, process/secret/runtime installation and real crash/retirement/load
gates remain required. No production gateway CLI is installed, no cloud resource
or persistent database changed, and ordinary application startup stays unchanged.
All other approved app features remain required.

Verified after this batch: 83 unit/local-HTTPS tests, 143 disposable
PostgreSQL/HTTP/clock checks and four Python clock-probe tests passed without
skips. Type checking, build and unchanged competition-schema generation (66
tables) passed; dependency audit reported zero vulnerabilities. Temporary test
certificates and owned database containers were removed. No submitted source was
executed, real Judge0 engine installed, host certified or deployment performed.

## Private Judge Client Batch

The [private judge protocol](judge-protocol.md) now has an application-side client
compatible with the durable validation worker. It enforces private fixed-IP
destinations, CA/name/certificate pinning and mutual TLS, two/ten-second deadlines,
bounded uncompressed JSON, canonical byte transport, exact host/attempt/provider
bindings, required phase/capture evidence and independent positive drain proof.
It neither retries POST nor treats a missing association as permission to resend.
Normal output still uses the backend checker. Supporting private result evidence
remains immutable when physical cleanup is proven later.

There is still no matching general gateway/supervisor installed, live host
registration, worker daemon/startup wiring or arbitrary-code execution proof.
The encrypted test server and wire fixtures are synthetic and execute no source.
Default startup, cloud services, private files, persistent databases, Git history/index
and `architecture.md` are not changed by this batch. The required real producer,
isolation/recovery/runtime checks and all remaining app features are not waived.

Verified after this batch: 82 unit/local-HTTPS tests, 132 disposable
PostgreSQL/HTTP/clock checks and four Python clock-probe tests passed with no
skips. Type checking, build and unchanged-schema generation (66 tables) passed;
dependency audit reported zero vulnerabilities. Test-only certificates and owned
database containers were removed. No competition source was compiled or cloud
execution certified by these checks.

## Validation Run Batch

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
