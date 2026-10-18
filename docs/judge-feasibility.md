# Judge Feasibility: First Checkpoint

Initial review: 2026-10-17. Latest user-reported checkpoint: 2026-10-18.
Status: user-reported fixed C++ API/queue/execution/result flow, all eight batched
failure/output-boundary cases, all five pinned language profiles, normal cleanup,
scoped retained-result/permit recovery, the fixed private HTTP/queue association
experiment, the fixed active-worker crash/drain continuation, all fifty bounded
stream/checker cases, five fixed HTTP/queue/profile/checker jobs and three fixed
shared sandbox boundary probes passed;
complete Judge0 runtime feasibility/security is not proved.

This records implementation evidence for `architecture.md` Sections 10.1 and 12.1.
It does not change the approved architecture or authorise cloud spending.

## Why This Comes Next

The local API and PostgreSQL foundation works. Before building submissions,
scoring or the arena, check that the execution engine can meet our requirements.
A feasibility spike is a small experiment that exposes risks before we build
features around an assumption.

The eventual path is:

```text
Browser -> API -> application PostgreSQL queue -> worker -> private Judge0
                                                       <- execution evidence
         <- result/leaderboard <- backend checker and competition rules
```

Judge0 executes code. Our backend compares output with private expected results
and decides scores. The browser never receives Judge0 credentials or hidden tests.

## Upstream Findings

| Observed in upstream | Consequence for our implementation |
| --- | --- |
| The releases page marks CE 1.13.1 as Latest; its notes describe three security fixes and a Linux/cgroup setup requirement. | Review dependencies, kernel and sandbox configuration; a release label is not a security sign-off. [Release](https://github.com/judge0/judge0/releases/tag/v1.13.1), [advisories](https://github.com/judge0/judge0/security/advisories). |
| The tagged Compose example uses floating Judge0 images, privileged services and a published API port. | Do not copy it into our Windows development stack or treat it as our production deployment. Build and pin reviewed images on a separate Linux execution host. [Compose source](https://github.com/judge0/judge0/blob/v1.13.1/docker-compose.yml). |
| The API supports asynchronous creation, status polling, selected response fields and Base64 text transport. | These fit our proposed transport. Base64 preserves bytes; it is not encryption. [API documentation](https://ce.judge0.com/). |
| The creation controller saves, enqueues and returns a token; its permitted parameters contain no application attempt/idempotency key. | A lost creation reply must not trigger an automatic second POST. Our approved provider association/reconciliation needs additional implementation. Deleting a record is not a process-cancellation API. [Controller source](https://github.com/judge0/judge0/blob/v1.13.1/app/controllers/submissions_controller.rb). |
| The worker contains retry handling, reads complete output files and represents empty streams as null. | Review queue redelivery, bounded capture and trustworthy completeness evidence. These approved safeguards are not supplied by an HTTP wrapper. [Worker source](https://github.com/judge0/judge0/blob/v1.13.1/app/jobs/isolate_job.rb). |
| Without expected output, the worker can return its success status without checking our answer. | Keep expected output private and apply our backend checker. Provider success is not competition acceptance. [Worker source](https://github.com/judge0/judge0/blob/v1.13.1/app/jobs/isolate_job.rb). |

The following are examples from the tagged language seed, not verified installed
toolchains or a manifest for our eventual private build:

| Language | Seed example | Approved target family |
| --- | --- | --- |
| C / C++ | GCC 9.2.0 | GCC 15, C17 / C++17 |
| Java | OpenJDK 13.0.1 | OpenJDK/Temurin 21 |
| Python | CPython 3.8.1 | CPython 3.14 |
| JavaScript | Node.js 12.14.0 | Node.js 24 |

Source: [tagged language definitions](https://github.com/judge0/judge0/blob/v1.13.1/db/languages/active.rb).
**Inference:** our target toolchains require a reviewed build and language mapping;
using example language IDs does not establish compatibility. Exact lab patches
and image identities were selected and tested in the later checkpoints below;
they are not a production build or security sign-off.

## Small Runtime Experiments

Run these sequentially on a disposable, isolated Linux host, not on the API or
competition database host. Use synthetic examples, not real competition tasks.

1. Inspect the host, cgroups, dependencies, private access and image provenance.
   Establish network/filesystem isolation before executing any test code.
2. Use one C++ program that reads two integers and prints their sum. Create one
   asynchronous execution, retain its token, poll and check the returned bytes.
   This is an API smoke test, not proof of a safe judge.
3. Repeat the smoke test in all five exact profiles. Record actual versions,
   fixed commands, limits, units and digests in the runtime manifest.
4. Test compilation errors, runtime failures, empty/invalid output, output limits,
   aggregate CPU/memory limits and process-tree cleanup against trusted evidence.
5. Exercise lost replies, duplicate delivery, worker/supervisor crashes, stale
   senders and host retirement. Prove safe reconciliation and physical drain
   before releasing slots or retrying uncertain execution.

Steps 4-5 need the trusted judge-side supervision/evidence extension described in
Section 10.1. A successful hello-world run cannot pass those gates. Concurrency
and event-load benchmarks follow correctness and isolation tests.

## Current Decision and Next Action

- Continue with a bounded Judge0 feasibility investigation, not production integration.
- Latest group: the [shared sandbox boundary batch](../infra/judge-spike/ISOLATION-LAB.md)
  has a user-reported cloud PASS for boundary denials/identity checks, the bounded
  fork limit and detached-child cleanup, with accounting and normal cleanup.
  All fifteen provider rows and previous evidence remained unchanged, the queue
  is empty and maintenance remains enabled. Preserve `isolation-v1`; do not rerun
  this completed one-shot batch. These are fixed shared-boundary probes, not a
  full hostile-code audit. Next harden output capture against hostile producers,
  including replacement or interference with the writable-box FIFOs. General
  failure mapping, dependency review, broader recovery and measured load remain open.
- Earlier group: the [five-profile HTTP/bounded evidence lab](../infra/judge-spike/TRANSPORT-LAB.md)
  now has a user-reported cloud PASS. Five real provider/outbox associations
  survived lost token bodies and explicit duplicate POSTs. Duplicate Redis
  deliveries produced one execution each; lost worker replies recovered through
  HTTP with matching retained bytes/accounting and expected checker verdicts.
  Fifteen provider rows remain (ten unchanged), with old schemas/evidence intact,
  queue empty and maintenance enabled. Preserve `transport-v1` and its schema;
  do not rerun it or historical ten-row probes. The later scoped isolation result
  is recorded above; participant execution remains unapproved.
- The [active worker crash/drain lab](../infra/judge-spike/CRASH-LAB.md) is now
  user-reported cloud PASS after correcting a copied-check name collision during
  the unstarted schema setup. The guarded continuation preserved the original
  context/journal and old records. Its killed host worker/launcher left the fixed
  sandbox pair alive with capacity reserved and replay refused. Positive process,
  workspace and owned-resource drain preceded a once-only release; losing that
  release reply did not reuse the permit or invent a verdict. Ten provider rows
  and earlier evidence stayed unchanged, the private API remained in maintenance
  and no participant code was enabled. Do not repeat either completed procedure.
- The earlier [bounded stream/checker lab](../infra/judge-spike/STREAMS-LAB.md)
  now has a user-reported cloud PASS for all fifty fixed cases across the five
  cached profiles. The guarded archive-02 recovery checked every controller before
  removing the exact stopped failed probe and preserved its original journal/log.
  The separate corrected `streams-v2` batch verified bounded retention, EOF,
  identity, checker results and normal cleanup, then sealed evidence with the ten
  provider rows and old schemas/evidence unchanged, queue empty and maintenance
  enabled. Preserve both checkpoints and do not repeat either controller. The
  later fixed HTTP integration is recorded above; broader crash/host retirement,
  adversarial isolation and load gates remain open.
- The [private HTTP association lab](../infra/judge-spike/HTTP-LAB.md) now has a
  user-reported cloud PASS. One real provider record/outbox survived a lost token
  body and duplicate POST; two Redis deliveries produced only one fixture
  execution. Its saved result was recovered after a lost worker reply through
  HTTP and the original Judge0 API. Ten provider records remain, with the old
  nine and old held reservation unchanged. Do not rerun the completed HTTP or
  historical whole-database nine-row checks. This uses the older trusted C++
  fixture, not the newer five-profile runtime.
- The user created the disposable cloud test host and performed the administration
  and boot-configuration steps below. The assistant has not operated cloud resources.
- At the API-only checkpoint, the user reported the corrected private API probe passing all four HTTP gates:
  authentication rejection, authenticated version, maintenance and disabled batches.
  No execution worker or submitted program had run at that stage; later fixed
  execution checks are recorded below.
- No Ingenium application endpoint/schema or Git history changed. The disposable
  Judge0 API startup ran its own database setup, separate from the application DB.
- The five fixed language-profile checks and scoped retained-result/permit
  recovery now pass as recorded below. General HTTP/queue recovery, security,
  participant execution and throughput remain unverified.
- The user reported recovery of the existing three lab containers and another
  successful four-gate HTTP probe. The earlier shutdown trigger and API exit
  code remain unconfirmed; recovery is not their root-cause diagnosis.
- The user reported the Isolate installation below. Its group-writable
  `/var/local` does not meet the documented sandbox-ancestor permissions.
- The first worker-preparation build failed its silent permission assertions.
  A local Linux regression reproduces a bug in its `chmod 0755` instruction;
  the correction uses `00755` to clear directory setgid explicitly.
- The user reported the corrected worker-prep image built successfully, with
  all directory mode checks and the helper fingerprint passing.
- The user reported both workspace creation and cleanup PASS lines from the
  temporary credential-free check; no submitted program or worker was run.
- The user reported `MemoryHierarchy=1` and all three empty-cgroup lifecycle
  PASS lines, including host-parent cleanup. No process entered the test groups.
- The user reported AppArmor parser 3.0.4, kernel enabled state `Y` and the API
  profile `docker-default` on the expected VM.
- The user reported all four fixed-command namespace PASS lines. The helper ran
  `/usr/bin/id -u` as UID 60000, verified its clean exit, removed the workspace,
  confirmed container completion and removed the container/test profile.
- The user reported stock GCC 9.2.0, target `x86_64-pc-linux-gnu`, its cc1plus
  and C++ runtime library paths, and assembler/linker program names `as`/`ld`.
- The user reported all six version-two namespace/C++ PASS lines: successful
  compilation, three exact answers with UID/GID checks, and normal cleanup.
- The user reported the running API's cgroup namespace as `host`, with consistent
  `/docker/<container-id>` membership in v1 controllers and the hybrid v2 entry.
  Docker reports 768 MiB RAM, 1,536 MiB combined RAM/swap, 0.75 CPU and 128 tasks.
- The user reported matching kernel controller values: memory 805306368,
  combined memory/swap 1610612736, memory hierarchy 1, CPU quota/period
  75000/100000 and PID limit 128. Host SwapTotal and SwapFree are both zero.
- The user reported all seven bounded-parent cgroup PASS lines, including actual
  UID 60000 execution/accounting and complete normal cleanup. Job peak memory was
  311296 bytes and CPU usage 2937729 ns (about 2.94 ms).
- The version-two CPU-limit probe passed. The memory probe reported the expected
  OOM/SIGKILL metadata but failed the result checker; its allocations were initially retained.
- Read-only inspection confirmed the checker bug: the job's RAM-only hits were
  zero and combined-memory hits were 38, with one job OOM kill. The aggregate
  parent had no limit hits/OOM kills, Docker was stopped without OOM, and job
  task lists were empty.
- The user reported the scoped cleanup PASS for the failed probe: its named
  container, empty cgroups, temporary profile and private files were removed.
- The user reported all nine version-three PASS lines: both limit classifications
  succeeded, and job/workspace/container/profile/host-group cleanup completed.
  CPU usage was 244452077 ns with both memory hit counters zero. The memory run
  recorded 45617241 CPU ns, zero RAM-only hits and 51 combined-memory hits.
- The user reported all eleven version-four PASS lines. A `cc1plus` child was
  observed in both job controllers; compilation, three exact answers and complete
  normal cleanup passed. Compile peak memory was 65892352 bytes and CPU usage
  650870152 ns. This is not an event-throughput or crash-recovery benchmark.
- The user reported the existing API, PostgreSQL and Redis containers exited,
  with codes 1, 0 and 0 respectively; no worker or published port was listed.
- The user reported successful post-restart recovery: both dependencies and the
  API healthy, followed by all four authentication/maintenance/batch probe gates.
- The user reported the queue-check archive checksum and all four read-only
  queue/C++ contract PASS lines: the three expected lab services, configured API
  restrictions/version, exact stock C++ profile with no submissions, and no
  pending/failed queue jobs or registered workers.
- The user reported the one-job version-two archive checksum OK and all 17 PASS
  lines: idle/config checks, original API gates, one API creation, temporary API
  removal, exact queue claim, bounded fixed C++ execution/normal cleanup, and
  byte/metric-checked result lookup with the original API still in maintenance.
  This is the custom fixed-fixture adapter, not a stock-worker or participant
  execution sign-off. No detailed new CPU/memory values were supplied.
- The user reported the failure-suite archive checksum OK and all 20 PASS lines:
  the existing services/restrictions, original API gates before and after, eight
  one-time API creations, temporary API removal, all eight classified outcomes
  with API-result/normal-cleanup checks, an unchanged successful baseline and an
  empty queue with maintenance still enabled.
- The user reported the five-language image built with exact pinned version and
  binary observations. C17/C++17 compilation and all six fixed answers passed;
  Java compilation stopped with exit 127 because `libjli.so` was not found.
  The named stopped probe, private files and cgroups were retained for inspection.
- The user reported the version-two archive checksum OK, successful scoped
  Java-failure cleanup and all fifteen exact answers across C, C++, Java, Python
  and JavaScript, with observed sandbox identity and accounted normal cleanup.
  The pinned lab manifest was saved, all nine old rows remained unchanged, the
  queue ended empty and the original API stayed in maintenance with all four
  HTTP gates passing before and after. No rerun or further cleanup is needed.
- Next: connect immutable attempt/provider association and one-time execution
  permits to the real private Judge0 HTTP creation/queue path, then fault-test
  lost HTTP creation replies and queue redelivery. The scoped lab checks below
  do not prove that integration, a mid-execution crash or epoch retirement. Recovery,
  security and event load remain separate gates. Preserve all nine rows and private checkpoint
  directories/logs; do not rerun either one-shot experiment or clear the database
  to satisfy the old empty-lab probe.
  The stock worker's retry loop, sandbox
  ID selection and default directory rules do not match the tested helper.
  Do not run the stock retrying
  worker loop on the strength of these helper checks. Keep API/DB/cache private
  and never use API container groups as execution
  target or source of writable delegated groups. Job groups and the temporary
  container must remain under the fresh common aggregate budget.
  Do not recreate API containers/volumes or change their limits/profiles. Keep
  execution workers stopped and maintenance enabled.
  Do not upgrade billing, broaden the bounded experiment or expose the judge API
  publicly as a setup shortcut.
- Prepared for the next user-operated cloud run: `recovery.py` and its private
  lab schema test immutable registration, competing worker permits, dropped
  acknowledgements and retained uncertainty against the cached five-language
  image. Local tests pass; the recovery cloud run is pending. This is a separate
  lab association, not a patch to Judge0's HTTP creation controller or queue.
- The user reported the recovery archive checksum and initial API gates passing,
  followed by `JSONDecodeError` before any grouped recovery PASS. Source-level
  reproduction identifies a SQL-NULL/JSON-null bug in rejected registration.
  The exact retained cloud stage is not yet inspected. A guarded continuation
  is prepared; it refuses anything except one unstarted bound record and the
  expected pre-launch journal/worker exit. Do not rerun the original experiment.
- The user then reported the corrected continuation confirming SQL NULL behavior,
  one unstarted bound record with no permit consumed, and successful registration
  reconciliation/mismatch rejection. Delivery subsequently stopped with
  `A recovery worker failed`. Worker replies, live/retained execution state and
  the private sandbox log need read-only inspection. A consumed permit, actual
  execution or completed cleanup cannot be inferred from this console output;
  no further continuation or cleanup is authorised by that partial success.
- Read-only user diagnostics subsequently showed one STARTED record/consumed
  permit, no sealed result, execution journal ending SANDBOX_FINISHED, and saved
  all-five-profile/normal-cleanup PASS lines. No replies were saved for workers
  1-3. A local regression reproduces a sorted-manifest profile-order checker bug;
  a guarded retained-evidence sealing package is prepared, with no sandbox replay.
  It must verify worker 0's exact error and physical quiescence before changing
  the result record. Its cloud run remains pending.
- The user subsequently reported the version-three checksum and all guarded
  retained-evidence recovery checks passing: fifteen saved answers revalidated,
  four duplicate-only workers refused, original-owner result sealed/reconciled
  after a deliberately dropped acknowledgement, stale seal rejected and the
  crash-before-launch reservation retained. No new sandbox launched; old evidence
  and all nine old records remained unchanged, queue empty and API in maintenance.
  No rerun or cleanup is needed. Preserve the two lab rows and all private
  checkpoints; the one deliberately uncertain reservation is expected test state.
- If the approved evidence/recovery requirements cannot be met, document the
  failed experiment and request an architecture decision rather than bypassing them.

## Proposed First Cloud Experiment

The table records the initial bounded proposal. The user has since created the
test host; observations are recorded separately below. Account billing, quotas
and resource state have not been independently inspected through authenticated APIs.

| Setting | Proposed value and purpose |
| --- | --- |
| VM name | `ingenium-judge-spike-01`; disposable test host only |
| Region / candidate zone | Mumbai `asia-south1` / `asia-south1-a`, subject to quota and availability |
| Machine | Standard on-demand `e2-standard-2`: 2 vCPUs, 8 GiB RAM; at most two development execution slots, not an event throughput claim |
| OS | Ubuntu 22.04 LTS, x86-64; upstream compatibility starting point, not approval of an unreviewed kernel/cgroup configuration |
| Disk | One 60 GiB balanced persistent boot disk; no application/registration data, no snapshots initially |
| Time limit | Four hours, termination action STOP; no automatic restart; verify the limit after creation and before each later start |
| VM identity | No attached service account; no app/DB/backup credentials or cloud key files |
| Network | Dedicated custom test VPC/subnet, no broad default-network allow rules; public HTTP/HTTPS/Judge0/DB/Redis ingress denied |
| Administration | OS Login and IAP SSH; ingress TCP 22 only from `35.235.240.0/20` to this tagged test host |
| Setup egress | One ephemeral IPv4 address for reviewed package/image downloads, not a public judge endpoint; no NAT gateway or reserved static address |

IAP can reach a VM without an external address. The proposed ephemeral address
is for setup downloads; it does not require opening public inbound services.
Before synthetic execution, separately verify sandbox network/metadata denial,
filesystem isolation and private authenticated judge access. A VPC firewall and
the absence of a service account do not establish a safe sandbox.
[IAP access](https://docs.cloud.google.com/iap/docs/using-tcp-forwarding).

### Observed Host Checkpoint

Evidence is the user's pasted console details, terminal outputs and confirmations
on 2026-10-17, not an assistant-operated remote inspection.

| Check | Observed result |
| --- | --- |
| Host and image | `ingenium-judge-spike-01`, Ubuntu 22.04.5 LTS; console image `ubuntu-2204-jammy-v20261016`, x86-64 |
| Machine and disk | `e2-standard-2`; 60 GiB balanced boot disk `ingenium-judge-ubuntu-2204`, delete with instance |
| Network and identity | One `nic0` in `ingenium-judge-test` / `ingenium-judge-mumbai`; network tag `ingenium-judge-admin`; no attached service account; `enable-oslogin=true` |
| Cost guard | Last supplied VM details show four-hour STOP limit and automatic restart off |
| Disk schedule | A default daily snapshot schedule appeared on the replacement disk; the user subsequently confirmed removing it |
| Administration | User connected through explicit IAP SSH; hostname inside the session matches the judge VM |
| Kernel | `6.8.0-1070-gcp`; kernel configuration reports cgroups, memory, CPU bandwidth/accounting, cpuset and PID features compiled in |
| Boot change | `/proc/cmdline` after reboot includes `systemd.unified_cgroup_hierarchy=0`; the existing Google serial-console option remains present |
| Mounted controllers | `/sys/fs/cgroup` is `tmpfs`; CPU/accounting, memory, pids and other controllers have v1 mounts. A separate `/sys/fs/cgroup/unified` v2 mount remains: a hybrid layout, not a completely v2-free host |
| Ubuntu package update | User's `apt update` completed successfully; `apt upgrade` reported zero upgrades, installations or removals for the configured repositories |
| Docker service and Engine | User's `systemctl is-active docker` returned `active`; client and server report Docker Engine Community `29.9.1`, Linux amd64, experimental mode off |
| Runtime components | Server reports containerd `v2.4.2`, runc `1.5.2` and docker-init `0.19.0`; Compose reports `v5.6.0` |
| Docker resource and storage configuration | `Cgroups=1`, `CgroupDriver=cgroupfs`, `Storage=overlayfs` |
| Trusted Docker smoke test | User ran the official `hello-world` image via `$HELLO_IMAGE` with no network, read-only root filesystem, UID/GID 65534, no extra capabilities, no-new-privileges and requested 32 MiB memory/no-swap, 16 PIDs and 0.5 CPU limits. Expected message printed; immediately reported exit code was 0 |
| Release download on VM | User downloaded the 4,581-byte `judge0-v1.13.1.zip`; supplied SHA-256 matches the reviewed asset and `unzip -l` lists only the two expected configuration files and their directory |
| Disk headroom | At this checkpoint, `df -h /` reports a 58 GiB root filesystem, 2.9 GiB used and 56 GiB available; this is not proof that later image builds fit |
| Local credential files | User reports mode 700 for `secrets` and mode 600 for each of the five password/token/key files under the extracted release directory. No secret values were supplied or inspected |
| Smoke-image identity | User's subsequent image inspection reports `hello-world@sha256:11a3eb1597e864c51b3f56733cb2e8a90bf0c284bfc05f9444d81c558bc848aa`; the smoke-test command explicitly selected Linux amd64 |

The user was given the upstream GRUB change after inspecting existing settings,
with an original-file backup step. No other boot options were intentionally changed.
Before IAP succeeded, the test-network classic firewall query returned no rules;
the user was given a narrowly scoped TCP 22 rule from `35.235.240.0/20` targeting
the admin tag. Post-change firewall rule details have not yet been supplied.

These observations establish host access, boot configuration, a running Docker
daemon and one successful trusted container execution. They do not prove sandbox
isolation, effective execution limits, package security,
trusted execution evidence, recovery or event throughput. Docker 29 deprecates
cgroup v1 support; treat this legacy dependency as a feasibility risk and review
the selected runtime version rather than assuming future releases work unchanged.
[Docker deprecation notice](https://docs.docker.com/engine/deprecated/#support-for-cgroup-v1).
Docker was installed by the user from its official signed Ubuntu Jammy repository.
The installation command selected exact candidate versions for Engine/CLI
`5:29.9.1-1~ubuntu.22.04~jammy`, containerd package
`2.4.2-2~ubuntu.22.04~jammy`, Buildx
`0.38.0-1~ubuntu.22.04~jammy` and Compose
`5.6.0-1~ubuntu.22.04~jammy`. Only the component versions in the table have been
verified by the supplied post-install output; Buildx's installed version has not
yet been checked separately. Explicit install versions do not hold future APT
upgrades, and this is not a production dependency-security sign-off.
[Docker installation](https://docs.docker.com/engine/install/ubuntu/),
[29.9.1 release and security notes](https://docs.docker.com/engine/release-notes/29/#2991).

The reported `overlayfs` backend is consistent with Docker 29's fresh-install
containerd image-store default; it is not evidence of a failed `overlay2` setup.
Do not switch storage backends merely to match older tutorials.
[Storage documentation](https://docs.docker.com/engine/storage/containerd/).
The smoke-test command used `--pull=never` and `--rm`; no host volume or Docker
socket was mounted. The subsequent image inspection supplied the repository
digest recorded above; the removed container's image ID was not separately captured.
A successful
short print-and-exit program does not demonstrate enforcement under resource
pressure or network/filesystem attacks. No participant submission was executed.
The old detached Ubuntu 26.04 disk's cleanup has not been confirmed.

### Release Archive Review

The assistant fetched the official `judge0-v1.13.1.zip` asset over HTTPS into memory
for inspection, without extracting files or running its contents. GitHub's release
API reported one uploaded asset of 4,581 bytes and a null `digest` field. The
locally computed SHA-256 of the inspected bytes is:

```text
d83f002c98f2c3935fc4fec3abcb863191e7c863ffcd202401d03a8f7e1fa513
```

This identifies the reviewed download; it is not a publisher-signed checksum or
independent authenticity proof. Transport and source trust remain separate.
[Release and asset link](https://github.com/judge0/judge0/releases/tag/v1.13.1).

The ZIP contains only `judge0-v1.13.1/docker-compose.yml` and
`judge0-v1.13.1/judge0.conf`, plus their directory entry. Unlike the tagged
repository Compose example described above, the uploaded archive's Compose file
uses `judge0/judge0:1.13.1`, not `latest`. It also uses `postgres:16.2` and
`redis:7.2.4`, privileges both server and workers, publishes `2358:2358` and uses
automatic restarts. Versioned tags are not immutable image digests. These
templates are review inputs, not our approved deployment configuration.

The tagged Dockerfile references `judge0/compilers:1.4.0` and Ruby 2.7.0 paths;
the current security/compatibility of that base and its dependencies has not been
established. No reviewed replacement build or production image is selected.
[Tagged Dockerfile](https://github.com/judge0/judge0/blob/v1.13.1/Dockerfile).
The user has reported a matching archive download/listing and private credential
files under the extracted release directory. No Judge0 service has been started.
Keep all judge/database/cache endpoints private; review image
provenance, credentials, feature restrictions and sandbox isolation before any
synthetic judge execution. The trusted supervision/evidence extension remains
required before the competition acceptance gates can pass.

An additional source-review concern is credential logging: `scripts/load-config`
exports the sourced configuration, and both `scripts/server` and `scripts/workers`
pipe `export` through `sudo tee /api/environment` without suppressing stdout.
This can put API tokens and database/cache passwords in container logs. Review
and patch startup logging and environment-file permissions in the trusted build
before starting services with real credentials. Do not request raw startup logs
or expanded Compose configuration containing secrets.
[Config loading](https://github.com/judge0/judge0/blob/v1.13.1/scripts/load-config),
[server startup](https://github.com/judge0/judge0/blob/v1.13.1/scripts/server),
[worker startup](https://github.com/judge0/judge0/blob/v1.13.1/scripts/workers).
The user generated local credentials and has now prepared a private operator
configuration with the helper below. Runtime ownership and deployed startup
fixes are still pending. No credential values should enter Git, chat or public
endpoints.

### Configuration Helper Checkpoint

`infra/judge-spike/prepare-config.sh` is a new trusted Linux configuration helper,
not a deployed judge. It validates the existing user-owned mode-700 secret
directory and five regular mode-600 hexadecimal credential files, without
sourcing them as code or printing their values. It creates `judge0.spike.conf`
with mode 600 through an exclusive hard link from a complete private temporary
file. Existing files, directories and symbolic-link destinations are rejected;
the downloaded template and input credentials remain unchanged.

The generated configuration retains maintenance mode, caps development workers
at two and runs at one, disables callbacks/batches/additional files/custom
options/network overrides, and records bounded program defaults/ceilings for
later runtime review. This is not proof of effective limits, full compile/output
supervision or per-language profile conformance. The operator-owned file is not
yet readable by the stock container's UID 1000: resolve runtime ownership and
startup before mounting, without broadening file permissions.

Fourteen focused Bash tests passed using synthetic credentials in an isolated,
unprivileged, network-disabled Linux container with a read-only source mount and
temporary test storage. The existing pinned development PostgreSQL image was
used only to supply Bash/coreutils; its database entrypoint was overridden. No
database server, Judge0 or participant program was started for these tests.
The tests cover mapping, Bash syntax, private permissions, no secret output,
overwrite refusal, invalid/missing inputs, symbolic links, directory destinations
and tracing suppression. `git diff --check` passed. No Git mutations were made.

Generated and temporary configuration filenames are Git-ignored; targeted Git
attributes preserve LF line endings for these Linux scripts on Windows. The user
uploaded the helper through Cloud Shell and IAP, ran it on the VM and reported
`Created judge0.spike.conf with mode 600.` and `600 judge0.spike.conf`. Maintenance
mode remains enabled and no services were started. The upload contained the
helper only, never the real secret directory. The helper README records current
limitations and the before-startup review gates.

### Startup Patch Preparation Checkpoint

Remote Docker registry metadata inspection, without pulling or executing Judge0,
resolved `docker.io/judge0/judge0:1.13.1` to this manifest digest:

```text
sha256:6b5d6a66aa19a8e878a52ea3c6a560afc1086734d96e2885b561fd5c6018f082
```

The manifest reports 49 layers totaling approximately 3.07 GiB compressed and
image config digest
`sha256:633138614f39c91fb9c8270c64d089da630e8f0eed0e82b5c8dae17e8e772837`.
Unpacking requires extra storage. Digest pinning identifies bytes, not publisher
attestation, reviewed image contents or vulnerability clearance.
[Docker image pinning](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions).

`infra/judge-spike/image` now contains an unbuilt lab-only derivative Dockerfile
and three startup scripts. The build context allows only those source files,
uses the pinned base and has no `RUN` instructions. The replacement entrypoint
requires UID 1000, a private UID-1000-owned configuration and an explicit
server/workers role. It skips upstream cron. The replacement scripts omit the
exported-environment dump and disable tracing before config loading. API startup
stops on migration failure without retrying. The worker retains upstream queue
supervision and its known recovery/drain limitations; those are not solved by
this patch. Disabling cron also leaves scheduled housekeeping unimplemented.

Eleven focused startup tests passed with fake credentials, a fake config loader
and stub commands in an unprivileged, network-disabled Linux container. Its
root filesystem and source bind mount were read-only, with disposable `/tmp`
and `/api` mounts. The existing pinned development PostgreSQL image supplied only
Bash/coreutils; its database entrypoint was overridden. The tests cover API
startup ordering, setup/server failures, role restriction, configuration access
rules, no environment dump, tracing suppression and stopping both real startup
scripts on config-loading failure. Worker dispatch uses a stub; its real
scheduler/worker loop, signals, Rails, base-image behavior and isolate are not
executed or verified. The fourteen configuration tests also still pass.

These local checks did not pull, build or run a Judge0 image. The subsequent VM
inspection is recorded below. No cloud resources, firewall rules, Git state,
credentials or running application services were changed. Upload/build, runtime
file ownership, separate database/cache images, private Compose networking and
all sandbox/trusted-supervision acceptance gates remain pending. Keep maintenance
mode enabled. This narrow logging patch does not make legacy dependencies,
privileged execution or participant use safe.

### VM Image Inspection Checkpoint

The user reported the downloaded base image's local inspection on the isolated
VM: image ID
`sha256:6b5d6a66aa19a8e878a52ea3c6a560afc1086734d96e2885b561fd5c6018f082`,
OS `linux`, architecture `amd64`, configured user `judge0`. The host disk report
was 58 GiB total, 17 GiB used and 42 GiB available (28% used). These are
user-supplied observations, not an assistant-run cloud inspection. No image build,
Judge0 startup or participant execution has been reported.

The username alone does not verify its numeric UID/GID. Next, inspect public
files from a newly created, never-started container with no network, host mounts
or injected credentials, then remove only that inspection container. The runtime
configuration must remain private and unchanged. Docker documents that `create`
does not start the container and `cp` can read a stopped container's files.
[Container creation](https://docs.docker.com/reference/cli/docker/container/create/),
[file copying](https://docs.docker.com/reference/cli/docker/container/cp/).

For comparison, SHA-256 values computed from the official v1.13.1 tagged source
bytes fetched over HTTPS, without executing them, are:

| Source file | SHA-256 |
| --- | --- |
| `scripts/load-config` | `5ec2079b28a10ce966be41e5c237f159f1a94ced3fd7cdd7d79afe4513898b04` |
| `scripts/server` | `24d7bb05b7ec8e3981a9dc251ba09d07071d9eb51f151730172494d61a30334d` |
| `scripts/workers` | `6c3944b5cc8e95b475831b4ac990733b76b4ab8bd18e0f1f4f99cde94714bc01` |
| `docker-entrypoint.sh` | `d9a61a63f7d4941046331dd8ea86652f755b5d1b6a1d4088206717640c6efc11` |

The user has now reported successful copies of these files from the
never-started inspection container, followed by removal of that container. All
four image-file hashes match the source-review fingerprints above. Its public
account file reports `judge0` as UID 1000 and GID 999; do not assume GID 1000 when
preparing runtime ownership. These checks cover only the selected startup files
and account entry, not the complete image, installed dependencies or sandbox.
All runtime acceptance gates remain open.

### Lab Image Transfer and Build

The next user-run step transfers a small archive containing only the six files
from `infra/judge-spike/image`: `.dockerignore`, `Dockerfile`, `LICENSE.judge0`,
`entrypoint.sh`, `server.sh` and `workers.sh`. The generated archive stays under
Git-ignored `runtime-data/judge-spike` locally. No private config, credentials,
application files or database data enter this archive or the build context.

Prepared artifact: `ingenium-judge-image-20261017-01.tar.gz` (13,603 bytes), SHA-256
`993580feae6358806b56eba3995c4e2c2c64e76a5044f7f273d8c39d3599f811`.
Its six-member listing was checked, and extraction into disposable Linux
temporary storage matched the source directory byte-for-byte. All packaged Bash
files parsed successfully. The fourteen configuration tests and eleven startup
tests also passed with synthetic fixtures at UID 1000, GID 999; no real Judge0 or
database binary was executed. The archive is Git-ignored.

Upload through Cloud Shell and copy to the existing VM through IAP. Verify the
archive hash before extraction into a new directory, then build the derivative
image on that VM only. The Dockerfile contains no `RUN` instructions: this step
copies startup files and metadata, without launching Judge0, connecting to a
database or executing a submission. The build requests no network for `RUN`
steps and no base-image update; registry metadata resolution may still occur.
The user subsequently reported the built derivative image's inspection:
`ID=sha256:1e91aa8647a728487bcc7259bc87762b06306193ba13d90fa6881b13462b8a54`,
OS `linux`, architecture `amd64`, user `judge0`. The complete build log was not
provided. This confirms the reported image is present; it does not verify runtime
behavior. No service startup or submission execution has been reported.

Next, prepare a separate runtime configuration at
`/opt/ingenium-judge-spike/judge0.conf`, owner UID 1000 / GID 999, mode 400, in a
new root-owned mode-700 parent directory. Validate the original regular,
operator-owned mode-600 file first and compare the copy without printing either
file. Refuse an existing parent rather than overwriting an earlier runtime setup.
Keep the original configuration and its credential inputs unchanged. The Docker
daemon can later bind-mount this individual file read-only; the container does
not need access to the host parent directory. The user confirmed metadata
`700 0:0 /opt/ingenium-judge-spike` and
`400 1000:999 /opt/ingenium-judge-spike/judge0.conf`. Runtime mounts, private
services and all execution gates remain pending; no judge container starts yet.

### Private Dependencies Preparation

`infra/judge-spike/dependencies.compose.yaml` defines only `db` and `redis` for
the isolated Linux VM, with no API, worker or published ports. Both services use
UID/GID 999, read-only root filesystems, dropped capabilities, no-new-privileges,
bounded CPU/memory/PIDs/logs and no automatic restart. Only their separate data
volumes and bounded tmpfs storage are writable. A project-private internal bridge
provides service discovery; it is not participant-code network isolation and
does not prevent host/Docker administrators accessing containers.
[Internal networks](https://docs.docker.com/reference/compose-file/networks/#internal).

Registry metadata selected these exact Linux/amd64 manifests, without pulling
or running either new image locally:

| Image | amd64 manifest digest |
| --- | --- |
| `postgres:16.15-bookworm` | `sha256:ec9f656f17c8b4dfebf49e58cf5c46d493d4846d4ea6d8b85d0637f68ee33bfc` |
| `redis:7.2.16-bookworm` | `sha256:6510e071eecd994fb187c15f126d424a293006669f590da800ca4a06564ae7d0` |

These retain the upstream example's major versions with maintained patches, not
its old 16.2/7.2.4 images. PostgreSQL lists 16.15 as the current supported 16 minor;
Redis 7.2.16 includes security fixes and the 7.2 line remains supported under its
published policy. This is not a comprehensive vulnerability clearance.
[PostgreSQL policy](https://www.postgresql.org/support/versioning/),
[Redis release](https://github.com/redis/redis/releases/tag/7.2.16),
[Redis policy](https://github.com/redis/redis/security).

The registry annotations reference PostgreSQL source revision
`9d15534160ade17f2b6c455a39ee967c49b1937d` and Redis revision
`09aa4e1a1bb278b1ad77bdeb43bde981fad64e49`; their Dockerfiles specify UID/GID
999 and owned data directories. `init-db.sh` creates the password-authenticated
`judge0` role with database ownership and CREATEDB but without superuser,
CREATEROLE, replication or row-security-bypass privileges. CREATEDB is needed
by this lab image's `rails db:create` startup. A separate new bootstrap password
protects the PostgreSQL administrator; the existing judge password is unchanged.
Passwords are mounted as private files, not embedded in Compose or arguments.
[Compose secret files](https://docs.docker.com/compose/how-tos/use-secrets/).

`redis-entrypoint.sh` validates the existing hexadecimal password, creates a
mode-600 requirepass configuration on private tmpfs and executes Redis without
the password in its arguments or environment. AOF uses every-second fsync and
no eviction; this does not prove loss-free recovery or safe job redelivery.
Both health checks require authenticated responses; runtime checks are pending.

Five Compose checks passed via Docker's parser and Node's built-in test runner.
Seven script checks passed using synthetic credentials and stub commands in an
unprivileged, network-disabled, read-only Linux container with disposable tmpfs.
No actual database/Redis process, Judge0 or participant code ran. The scripts
cover credential mapping/privacy, validation and error propagation; database SQL
privileges and real image startup still require VM verification. No new cloud
resources were created, services started, or Git mutations performed.

Prepared public transfer artifact:
`ingenium-judge-dependencies-20261017-01.tar.gz` (1,896 bytes), SHA-256
`609aecbc4775a9daabe025e16fd2d10dd00bf607f1eda39ee7b7a613338753d1`.
Its three-member listing and extracted bytes match the source files; packaged
shell syntax checks pass. It contains no credentials and is Git-ignored. The
previous fourteen configuration and eleven startup checks were also rerun and
passed, bringing this step's focused checks to 37. Upload and actual dependency
startup subsequently completed as reported below.

### Private Dependencies Runtime Checkpoint

The user reported a matching archive hash, both pinned images pulled, creation
of `ingenium-judge-spike_judge_private` plus the two project-scoped data volumes,
and healthy `ingenium-judge-spike-db-1` / `ingenium-judge-spike-redis-1` containers.
Compose `ps` shows only container ports `5432/tcp` and `6379/tcp`, with no host
bindings. These health checks require authenticated PostgreSQL/Redis replies;
the full role privilege audit and hostile-client tests remain pending. This is
user-provided VM evidence, not an assistant-operated cloud inspection. No judge
API, execution worker or participant program has been reported running yet.

### Maintenance API Preparation

`api.compose.yaml` adds only the API when merged with the dependencies file. It
uses the user-reported built image ID directly with pull policy `never`, UID
1000/GID 999, a read-only single-file config mount, bounded writable tmpfs, no
capabilities, no-new-privileges and bounded resources/logs. The initial override
requested `127.0.0.1:2358`, but the user-reported runtime did not publish it on
the internal-only bridge. The current override publishes no host port and the
VM host probes the container IP directly, not public ingress or the laptop.
No firewall rule changes, privileged mounts, Docker socket or execution worker
are included. The local-image reference is specific to this lab VM, not a
portable published image release.
[Bridge host access](https://docs.docker.com/engine/network/drivers/bridge/).

The API's health check uses its existing Ruby socket library to test listening;
it is liveness, not database/authentication/sandbox readiness. Startup first runs
the lab's schema migration and language seed. The upstream seed deletes and
recreates language definitions, so this lab startup is not an event restart
procedure. Keep all data synthetic and leave workers stopped.
[Seed behavior](https://github.com/judge0/judge0/blob/v1.13.1/db/seeds.rb).

Before starting, confirm maintenance is true and synchronous/batched submissions
are false in the existing private config. `probe-api.py` then uses only Python's
standard library, reads the operator's existing API-token file and talks directly
to an explicitly inspected private container IPv4 without proxy handling. It
checks missing-token rejection,
authenticated version metadata, maintenance rejection of an empty submission and
disabled batches. The two POSTs contain only `{}`, no language or program. It
does not enqueue intentional execution or retry requests. Response reads are
bounded and bodies/credentials are not printed on failure. This tests selected
API gates, not execution safety or the target toolchain profiles.
[Authentication and maintenance](https://github.com/judge0/judge0/blob/v1.13.1/app/controllers/sessions_controller.rb),
[submission gates](https://github.com/judge0/judge0/blob/v1.13.1/app/controllers/submissions_controller.rb).

Three new Compose checks and six mocked Python probe checks passed locally;
the five dependency Compose checks also still pass. They prove configuration
shape, unchanged dependency definitions and probe behavior only. No Judge0 image
or actual API was executed locally. The first VM probe failed as recorded below.
The Python probe needs the VM's system Python 3, not a new application
dependency. Git history and running local application services were not changed.

Prepared public API artifact: `ingenium-judge-api-20261017-01.tar.gz` (1,675
bytes), SHA-256
`52ad34ad4a045e06aa32f7c412e2c57976b776205b35632cab77ed15cde346d5`.
Only the Compose override and credential-free probe source are included; their
extracted bytes match the reviewed files. The archive is Git-ignored. A separate
offline Compose check with the existing trusted development PostgreSQL image
confirmed that an image-ID-only reference with pull policy `never` creates a
container in `created` state. That inspection container was never started and
was removed; no Judge0 image or database process ran for that check.

### Maintenance API Probe Correction

The user reported the v1 archive hash matched, Python 3.10.12 was available and
the API passed its inside-container socket health check. Compose listed only
`2358/tcp`, without a host mapping. The host probe then failed before its first
PASS; the error trap stopped the API and left healthy dependencies/data intact.
Successful startup alone therefore did not verify any authenticated HTTP gates.

A local reproduction on Docker Engine 29.6.2 used the existing trusted development
PostgreSQL image solely to run `/bin/sleep`, not PostgreSQL or Judge0. An internal
bridge plus requested loopback publication produced requested `PortBindings` but
no actual published host binding. Only that check's uniquely named container and
network were created and removed. This supports a port-publication failure as
the cause on the VM (Engine 29.9.1); the repaired live probe subsequently passed
as recorded below.
[Upstream report](https://github.com/moby/moby/issues/44986).

The correction removes `ports`, keeps the internal network unchanged and passes
the current API container IP from `docker inspect` to the host's Python probe.
It accepts only RFC1918 IPv4 before reading the API token and does not resolve
hostnames, follow redirects or retry requests. Public, loopback and link-local
metadata targets are rejected. Diagnostic categories distinguish refusal,
timeout, other transport errors and invalid JSON without printing raw responses
or exception details. Neither secrets nor dependency volumes are recreated.

Eight Compose checks and ten Python probe checks pass locally. These include
unchanged dependency definitions, no published API port, all four HTTP gates,
credential-safe failures, bounded reads and rejected probe destinations. No
Judge0 image, execution worker or participant code ran on the development host.

Corrected public artifact: `ingenium-judge-api-20261017-02.tar.gz` (1,995 bytes),
SHA-256 `96a2a07a1676a9346056e95e9babb71ff82de8c7ebcb619e84e195288d8eefaa`.
Only `api.compose.yaml` and `probe-api.py` are included; extracted bytes match the
current source. The archive is Git-ignored and contains no credentials. Preserve
the first archive and extract this correction into a new `api-v2` directory.

### Maintenance API Runtime Checkpoint

The user reported that the v2 artifact hash matched, all three containers were
healthy and the corrected VM-host probe printed all four expected PASS lines:

| Probe | User-reported result |
| --- | --- |
| No authentication token | Rejected with HTTP 401 |
| Authenticated `/about` | HTTP 200, Judge0 version 1.13.1 |
| Empty ordinary submission | Maintenance rejection, HTTP 503 |
| Empty batched submission | Disabled-batch rejection, HTTP 400 |

This verifies the tested private HTTP path and selected API gates at that time,
not all API routes, effective program limits or sandbox safety. No executable
source was sent by the probe. The assistant has not operated the VM or
independently inspected the user's cloud account. Repeated copies of the same
output are treated as one reported checkpoint, not separate test runs.

Before preparing a worker, inspect only selected non-secret Docker metadata:
the internal bridge, current service list, runtime identities, read-only roots,
capability/security settings, published ports and network attachments. The
commands are in `infra/judge-spike/README.md`. They do not start/restart services,
read credentials, execute a submission or prove isolation under attack. Keep
maintenance enabled and workers stopped until their separate review is complete.

### Stopped-Service Inspection Checkpoint

The user's subsequent inspection reports `Internal=true`, driver `bridge`,
and exactly the API, PostgreSQL and Redis containers, all now `exited` with
`Running=false`. Their saved runtime configurations match the requested users
(`1000:999` for API, `999:999` for dependencies), non-privileged/read-only roots,
no added capabilities, all capabilities dropped, no-new-privileges, empty host
port bindings and only the private bridge attachment. This is configuration
evidence, not proof of effective sandbox isolation or current service health.

The reason for stopping is unknown: no exit codes, OOM flags or start/finish
timestamps have been supplied yet. A VM/Docker restart is one possibility given
the explicit `restart: "no"` policies, not an established diagnosis. Next collect
only selected exit-state metadata and host boot/current time; do not request raw
logs or environment/configuration dumps. Do not automatically restart/recreate
the services, change restart policies, remove volumes or start workers.
[Restart policy behavior](https://docs.docker.com/engine/containers/start-containers-automatically/).

### Exit-State Follow-Up

The user supplied the expected VM hostname and current UTC time
`2026-10-17 16:47:14`. `uptime -s` reports boot at `2026-10-17 16:43:18` without
an explicit timezone. The containers' UTC finish timestamps fall within the same
second, `2026-10-17T12:36:30Z`: PostgreSQL and Redis exited 0, API exited 1.
All three report `OOMKilled=false` and restart policy `no`. PostgreSQL/Redis had
started around 10:45 UTC and the API around 11:32 UTC before this common stop.

This is consistent with a common shutdown followed by a later host boot, not
proof that the four-hour limit specifically caused it. Docker does not report
an OOM kill; that does not rule out every possible host/resource problem. The
API's nonzero exit during that interval is not independently diagnosed and must
not be described as a clean API shutdown. No raw logs or credentials were read.

Use the runbook's explicit `compose start` procedure only for these existing
synthetic lab services after confirming the VM's four-hour STOP guard remains
configured. It checks maintenance/batch/wait gates, starts healthy dependencies,
rechecks the judge role, starts the API and repeats the private HTTP probe. On
failure stop only the API; preserve dependencies, volumes, credentials and the
restart policy. This reexecutes the lab API's database setup/language seed and
is not an event recovery procedure. Live recovery has not yet been reported.
[Starting existing containers](https://docs.docker.com/reference/cli/docker/compose/start/).

### Existing-Service Recovery Checkpoint

The user reported both dependencies healthy after `compose start`, then the
API healthy, followed by all four expected probe PASS lines (401, authenticated
version 200, maintenance 503 and disabled batches 400). The supplied procedure
uses existing containers, unchanged credentials/volumes and no execution worker.
Its role privilege check must also have passed for the block to reach API startup.
This is user-reported runtime evidence, not an assistant-operated VM inspection.
It shows the API works after this restart, not why its earlier exit was nonzero
or proof that all stored data/production recovery semantics have been verified.

### Isolate Inspection Before Worker Preparation

The API's no-new-privileges policy intentionally prevents gaining privileges
from setuid helpers. The reviewed upstream compiler Dockerfile points to Isolate
commit `ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a`; its Makefile installs
`/usr/local/bin/isolate` mode 4755 and `/usr/local/etc/isolate` mode 644, with
default sandbox root `/var/local/lib/isolate`. The default configuration requires
that root and its ancestors be writable only by root. This is source-level
context, not proof that the pulled image has those exact helper bytes/settings.
[Compiler build source](https://github.com/judge0/compilers/blob/master/Dockerfile),
[helper install rules](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/Makefile),
[default configuration](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/default.cf),
[no-new-privileges behavior](https://docs.kernel.org/userspace-api/no_new_privs.html).

The next runbook command uses the existing API container only to print the
helper version, binary hash, selected file/directory modes and allowlisted
non-secret static sandbox settings. It does not load `judge0.conf`, call
`isolate --init`/`--run`, create a worker, compile a submission or change any
capability, namespace, mount or privilege setting. Results are recorded below. Worker
runtime design still needs review; do not copy the upstream privileged Compose
configuration or remove restrictions from the API as a shortcut.

### Isolate Installation Runtime Checkpoint

The user's VM inspection printed Isolate 1.8.1, built 2021-03-06 from
`v1.8.1-8-gad39cc4`. Binary SHA-256:
`c8ad768bf22499f579eb07be75379c890347272de8190302b48b2bc0bab8d1d3`.
Reported modes and numeric owners/groups:

| Path | Mode | UID:GID |
| --- | --- | --- |
| `/usr/local/bin/isolate` | 4755 | 0:0 |
| `/usr/local/etc/isolate` | 644 | 0:0 |
| `/var` | 755 | 0:0 |
| `/var/local` | 2775 | 0:50 |
| `/var/local/lib` | 2755 | 0:50 |
| `/var/local/lib/isolate` | 755 | 0:50 |

Static settings report sandbox root `/var/local/lib/isolate`, cgroup root
`/sys/fs/cgroup`, first UID/GID 60000 and 2147483647 boxes. The allowlisted grep
showed no active `cg_parent`. This identifies observed installation metadata,
not verified sandbox operation, helper security or an approved runtime manifest.

Mode 2775 makes `/var/local` group-writable, unlike Isolate's documented
root-only-write ancestor requirement. No sandbox has been initialised/run;
the API remains read-only/no-new-privileges, so this is an unmet worker
precondition, not evidence that a participant escaped a running sandbox.

### Worker Image Permission Preparation

The image Dockerfile now has `patched-startup`, `worker-prep` and final default
`startup` targets. Only `worker-prep` executes build-time directory ownership/
permission changes on the three fixed paths under `/var/local`. It asserts root
ownership/mode 0755 and non-symlink ancestors including `/` and `/var`, preserves
the root-owned mode-4755 helper and checks its user-reported fingerprint. The
default startup build and deployed API image reference remain unchanged. No
credentials, network access, worker startup or sandbox execution are included.

The runbook builds with the existing pinned base, no network or pull, under a
new worker-preparation tag/context on the isolated VM only. This is not a
maintained toolchain rebuild or the trusted supervisor. Do not add privileged
worker settings, start a queue consumer or disable maintenance yet. The actual
image build and verification are pending user-reported VM evidence.

Eleven focused Node checks passed: three worker-image source contracts and eight
existing API/dependency Compose checks. Git Bash parsed the extracted worker
`RUN` shell instruction without executing it. These are source/configuration
checks, not Linux filesystem enforcement tests or a local Judge0 build. The
build's own mode/ownership/hash assertions still need to run on the VM. No Git
mutations or cloud operations were performed by the assistant.

Prepared public artifact: `ingenium-judge-image-20261017-02.tar.gz` (13,868 bytes),
SHA-256 `c93a2e2b8450d766c15611596c4fdeef24ba9fb335ad3a617b993c8988d2d8ec`.
Its six allowlisted members and extracted bytes match the current source. There
are no credentials; the archive is Git-ignored, and the original v1 artifact is
preserved. Extract into a new `image-worker-prep-v1` directory and use the
explicit worker target/new tag; do not replace the running API image.

### Worker Preparation Build Failure And Correction

The user supplied a matching image-v2 archive hash and BuildKit output ending
in exit code 1 during the worker-only `RUN` instruction. Startup file copies
were cached. No successful worker image inspection or worker startup was
reported; the deployed API/dependencies were not changed by this build. The
original assertion output did not identify the failed path individually.

A local Linux reproduction with disposable directories modelled root ownership,
group 50, initial modes 2775/2755 and only CHOWN/FSETID capabilities. Applying
`chown 0:0` followed by `chmod 0755` retained mode 2755; `chmod 00755` produced
755. Without FSETID in the test container, chown cleared the bits, masking the
bug; the regression fixture explicitly rejects that unsuitable setup. This
reproduces a cause compatible with the VM's failed assertion, without proving
that every assertion will pass there after the correction.
[GNU Coreutils directory setgid behavior](https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html).

The worker stage now uses `chmod 00755` and prints selected path ownership/modes
before asserting them. It still verifies root-only-write paths, rejects
symlinks, preserves/checks the helper binary and does not start workers. No API
image reference or runtime privilege setting changed. A fresh v2 context/tag
keeps the failed v1 material available instead of editing it in place.

The new Linux regression failed against the original instruction and passes
after the correction: original behavior reproduced, all three directory modes
fixed and additional pre-existing special bits cleared. All eleven Node
source/Compose checks also pass. Only the existing trusted development
PostgreSQL image ran, with its database entrypoint replaced by the fixture test,
no network, read-only root/source and disposable tmpfs. No Judge0 image, real
database or participant program ran on the development host. Live worker-image
build/verification is still pending.

Corrected public artifact: `ingenium-judge-image-20261017-03.tar.gz` (13,904 bytes),
SHA-256 `1fad85bf963dd056f8109725a4f2fe8e7b295a13e0186f44b68d90f663b34654`.
All six allowlisted image-context members match source bytes. The archive is
Git-ignored and contains no credential files; earlier artifacts are preserved.
Extract into a new `image-worker-prep-v2` context and build only the worker target
under `ingenium/judge0-spike:worker-prep-v2`. No automatic retry, worker startup,
API image replacement or cloud resource change has been performed.

### Worker Preparation Image Runtime Checkpoint

The user supplied a matching image-v3 archive hash and successful BuildKit output.
All five checked directories (`/`, `/var`, `/var/local`, `/var/local/lib`,
`/var/local/lib/isolate`) printed `0:0:755`; the helper printed `0:0:4755` and
its fingerprint check passed. The image was tagged
`ingenium/judge0-spike:worker-prep-v2`. Reported local image ID:
`sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995`.
Inspection reports Linux/amd64, user `judge0`, default command
`["/api/scripts/workers"]`. No worker was reported started.

BuildKit separately printed image manifest `b31a39d83b75edfcf2a495ef78bd225404adebd99af2568890c459c4e7a02589`
and config `9c4023ea4150f0b46e5228a02e97c5c74007f0fdaca7df6f9e026b8c2f763ebf`.
Use the user-reported local image ID for this VM-only probe, not a guessed
replacement tag/digest. This establishes build-time permissions and helper byte
identity, not maintained dependencies, effective sandboxing or event readiness.

### Planned Workspace Lifecycle Check

The runbook's next command overrides the worker entrypoint/command with a bounded
workspace-only check. It calls the installed helper's `--init` and `--cleanup`
without `--cg` or `--run`. Assertions check the exact returned path, creation
of its `box` directory and removal afterward. The selected Isolate source keeps
workspace initialization/cleanup separate from process namespace execution.
[Helper source](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/isolate.c).

The one-off container uses the exact local image ID, no network/ports, no host
binds, no credentials and a read-only root. Only the workspace root and `/tmp`
are bounded noexec/nosuid/nodev tmpfs mounts. Root with only CHOWN and
no-new-privileges is for this helper-only metadata operation; it is not a worker
runtime policy. No SYS_ADMIN/privileged mode, host cgroup mount or security
profile disablement is requested. A 20-second timeout with a five-second kill
grace and outer container resource limits bound this synthetic check; that is
not the competition's trusted drain guarantee. Results remain pending.

The outer command and inner self-check parse as Bash locally. Docker accepted
the profile options on a never-started container using the existing trusted
development PostgreSQL image, with an additional disposable PGDATA tmpfs to
avoid an anonymous image volume. Selected inspection confirmed created state,
network none, read-only/non-privileged root, user 0:0, only CHOWN added, timeout
entrypoint and no host binds; that container was removed without starting it.
This validates CLI/configuration shape only, not the actual Judge0 helper or VM
runtime. No Judge0 image was pulled, built or executed on the development host.

### Workspace Lifecycle Runtime Checkpoint

The user reported both expected lines: `PASS: sandbox workspace created` and
`PASS: sandbox workspace removed`. With the supplied command, these assertions
establish the expected workspace path/box creation and its later removal in the
temporary mount. This is user-reported VM evidence, not an assistant-operated
inspection. No `--cg`, `--run`, worker queue or submitted program was involved.
It does not prove process namespaces, resource enforcement, execution cleanup
under faults or the event's trusted physical drain requirement.

### Cgroup Topology Before Delegation

The reviewed helper's `cg.c` requires v1 `memory` and `cpuacct` controllers and
optionally uses `cpuset`. It builds paths from `cg_root` and optional `cg_parent`,
creates/removes per-box groups, enters processes via `tasks`, updates memory
limits and reads/resets CPU accounting. The current non-cgroup workspace PASS
does not exercise any of these operations.
[Exact helper source](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/cg.c).

The next read-only VM commands inspect Docker cgroup/security metadata, mounted
controllers, resolved controller paths, ownership/modes and the memory hierarchy
flag. No cgroup directory, limit or process membership is changed. Resolve the
actual layout before selecting delegated test paths. Do not expose the whole
host hierarchy writable or disable security profiles as a setup shortcut.

For later execution, a delegated hierarchy must preserve reviewed aggregate
limits/accounting when Isolate moves processes between groups. Merely binding
writable controller directories or relying on a Docker limit that a process
leaves is not proof of enforcement. The scope/limit/cleanup design and live
evidence remain pending; no cgroup execution probe or worker is started here.
[Memory hierarchy behavior](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html).
That kernel page labels its legacy documentation outdated and the hierarchy
flag deprecated; treat the flag as diagnostic, not enforcement proof or a
recommendation to change it. Actual limits require runtime evidence.

### Cgroup Host Topology Runtime Checkpoint

The user's Docker metadata reports cgroup version 1, driver `cgroupfs`, default
AppArmor and built-in seccomp. Mount output retains a v2 `unified` mount alongside
v1 controllers, consistent with the previously reviewed hybrid configuration.
Memory, CPU/accounting and cpuset controller mounts are `rw,nosuid,nodev,noexec`.
Resolved paths are `/sys/fs/cgroup/memory`, `/sys/fs/cgroup/cpu,cpuacct` and
`/sys/fs/cgroup/cpuset`; their directory modes are all 555, UID/GID 0:0.
The pasted output includes the `memory.use_hierarchy` command but no result.
Do not infer its value or change controller-root modes to enable the test.

### Empty Cgroup Lifecycle Preparation

`infra/judge-spike/cgroup-preflight.sh` is a one-off, root-run helper restricted
to the named Linux judge VM, the exact inspected worker image and the current
v1 controller aliases/filesystems. It prints the memory hierarchy value and
requires the expected diagnostic value 1, then checks API maintenance, all
before any mutation. That flag is not treated as proof of limit enforcement.

The helper creates a fresh mode-700 memory parent and matching CPU-accounting
parent with a random suffix. It uses the `cpuacct` alias in Docker's bind syntax
so the comma in the resolved combined-controller path cannot split a `--mount`
argument. A private temporary `/run` directory holds root-owned mode-444 static
Isolate configuration, not API credentials. Only those two new parent subtrees
are writable binds into the test container, with the configuration bound
read-only. Controller-root permissions/limits and running services are not changed.

The temporary container is network-disabled, root-read-only, root UID/GID with
only CHOWN, no-new-privileges and bounded tmpfs/resources/timeout. It overrides
the worker entrypoint, calls only Isolate `--cg --init`/`--cleanup`, asserts that
the memory/CPU groups exist with empty task lists and then disappear, and never
uses `--run` or enters/moves a process into those groups. Optional cpuset is
deliberately not exposed/tested. No privileged mode, SYS_ADMIN, host cgroup root
bind, security-profile disablement or application database mount is requested.

On confirmed success, the host independently checks empty parent task lists
and absence of box groups, then removes only its allocated empty groups with
`rmdir` and its known temporary configuration file/directory. Failed allocation
does not remove a pre-existing CPU parent. A failed/uncertain Docker outcome or
unexpected remaining group state preserves all allocations and asks for
inspection, not automatic retry, forced process killing or recursive deletion.
This lifecycle check does not test cgroup entry, CPU/memory enforcement or
competition drain guarantees. Real execution will still need a hierarchy that
retains aggregate limits when a process leaves its Docker child group.

Six host-orchestration checks passed with command stubs in a network-disabled,
read-only trusted development PostgreSQL container used solely for Bash/coreutils;
no real cgroup changes, Docker service calls, database or Judge0 execution occurred
in those tests. The cases cover guard failures before mutation, private/scoped
configuration, successful cleanup, failed CPU allocation ownership, uncertain
Docker outcomes, remaining tasks and cleanup failures. Eleven existing Node
source/Compose checks also pass. The inner/outer live cgroup behavior remains
pending on the VM; no worker or program execution has been authorised.

Public transfer artifact: `ingenium-judge-cgroup-check-20261017-01.tar.gz`
(2,062 bytes), SHA-256
`5a83b737790096e4b0440f43259fd2aa9892371c91ee5f89f1a9f28823959612`.
It contains only `cgroup-preflight.sh`; the extracted bytes match source and
the archive is Git-ignored. No credential file is packaged. Extract into a new
`cgroup-check-v1` directory, verify the existing four-hour STOP guard, and run
with `sudo bash` only on the named isolated VM. Live cgroup results are pending.

### Empty Cgroup Lifecycle Runtime Checkpoint

The user reported `MemoryHierarchy=1` and all three expected PASS lines: empty
memory/CPU-accounting groups created, sandbox workspace/groups removed, and host
test groups removed. With the reviewed helper, these establish the asserted
empty-group lifecycle and its host cleanup. No submitted command, process entry,
worker queue, resource-limit enforcement or trusted physical drain was tested.
This is user-reported VM evidence, not an assistant-operated remote inspection.

Before a separate trusted-command namespace smoke test, inspect the host's
AppArmor parser/version, enabled state and the API container's recorded profile.
The default Docker profile denies mounts, while the selected Isolate execution
path creates a mount namespace and mounts its sandbox root. A separately named,
reviewed test profile may be needed; do not change the global Docker profile,
restart services, use privileged mode or disable AppArmor/seccomp to proceed.
[Docker AppArmor guidance](https://docs.docker.com/engine/security/apparmor/),
[default profile source](https://github.com/moby/profiles/blob/main/apparmor/template.go),
[helper execution source](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/isolate.c).
No execution profile or new program run is authorised by this read-only step.

### AppArmor Runtime Checkpoint And Trusted-Command Preparation

The user reported hostname `ingenium-judge-spike-01`, AppArmor parser 3.0.4,
kernel enabled state `Y` and API profile `docker-default`. Those observations
confirm the inspected tools/settings, not sandbox execution.

`namespace-smoke.sh` is a root-run helper restricted to that isolated VM, the
existing exact worker image, API maintenance and the unchanged API profile. It
copies the accompanying public `namespace-smoke.apparmor` into a fresh private
root-owned directory, compiles with `--skip-kernel-load --skip-cache`, then adds
the unique named profile. A previously loaded test profile blocks reruns rather
than being replaced. No daemon configuration, default profile or service changes.
[Parser modes](https://www.apparmor.net/man/master/apparmor_parser/).

The one-off container has no network, host binds, secrets or cgroup delegation.
It keeps a read-only root, no-new-privileges, Docker seccomp, bounded tmpfs and
128 MiB/no-extra-swap, 32-PID, 0.5-CPU and 20-second timeout settings. Seven added
capabilities cover ownership/traversal, UID/GID switching, namespace/mount/chroot
setup and signalling across UIDs; no privileged mode or unconfined profile is
used. The AppArmor profile denies networking and `/proc` writes and `/sys` access.
It permits private mount propagation at `/` and mounts only at the box-zero
sandbox root and its four selected directory targets. Broad file access and
SYS_ADMIN remain appropriate only for this fixed trusted-command investigation,
not approval to accept participant code.
[Mount-rule syntax](https://www.apparmor.net/man/3.0/apparmor.d/),
[helper mount implementation](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/rules.c).

Inside the container, assertions check the named enforcing profile,
no-new-privileges and an active seccomp filter. Isolate's non-cgroup execution
mode runs only `/usr/bin/id -u`, with selected read-only library/tool directories,
small time/address-space/file/stack limits and bounded output files. Assertions
require UID 60000, empty command stderr and clean exit metadata, then workspace
removal. The host confirms a stopped zero-exit container with the named profile,
removes it without force and unloads only that profile. Uncertain load/run/state
or removal failures retain the container/policy evidence for inspection.

No process is moved to the earlier test branches; it remains under Docker's
outer cgroup. This is a namespace/identity smoke test, not per-job cgroup
enforcement, hostile-code isolation, trusted drain or event readiness. Five
grouped orchestration/source checks pass using command stubs only in the trusted
development Bash environment; the actual AppArmor compilation and sandbox run
remain pending on the Linux VM. No Judge0 image ran on the development host.
The eleven existing Node image/Compose checks also pass.

Public transfer artifact: `ingenium-judge-namespace-check-20261017-01.tar.gz`
(2,612 bytes), SHA-256
`2d3967acb543b837fe35eb4ff33181e8fb1600ff12d144041661e5301135dfa0`.
It contains exactly the two public namespace helper/profile files, verified
byte-for-byte against LF source. No secrets or runtime configuration are included.
Extract into a fresh `namespace-check-v1` directory; do not overwrite prior probe
evidence. No real AppArmor compilation/loading or Judge0 execution occurred locally.

### Trusted-Command Namespace Runtime Checkpoint

The user reported the archive checksum matching and all four expected PASS
lines from `namespace-check-v1/namespace-smoke.sh`. Isolate also reported
`OK (0.003 sec real, 0.004 sec wall)`. With the reviewed helper, these assertions
confirm profile compilation, an enforcing named profile/no-new-privileges/seccomp
at the container check, execution of `/usr/bin/id -u` as UID 60000 with clean
metadata, workspace removal, stopped zero-exit container confirmation, and
container/profile removal. `ingenium-namespace-check-Dvm5fp` is the name printed
by successful `docker rm`, not an error. This is user-reported VM evidence.

The timing describes only this tiny command, not compiler latency or throughput.
No compiler, queue consumer or participant code ran. The test does not prove
hostile-code filesystem/network resistance, per-job cgroup enforcement, crash
cleanup, trusted evidence or event readiness. API maintenance and the default
API AppArmor profile remain required; no broader execution policy is approved.

Next inspect the pinned worker image's C++ compiler with no private mounts,
network, writable root or added capabilities, as UID/GID 65534 with an outer
timeout and resource limits. The fixed path comes from Judge0's tagged language
definition, not a verified runtime manifest. Request only version, target triple,
compiler/assembler/linker paths and C++ runtime library path; results are pending.
[Tagged C++ definition](https://github.com/judge0/judge0/blob/v1.13.1/db/languages/active.rb).
GCC 9.2.0 is a stock-image compatibility probe, not approval to replace the
architecture's GCC 15 target. No images are built or downloaded by this check.

### Stock C++ Compiler Runtime Checkpoint

The user reported `g++ (GCC) 9.2.0`, target `x86_64-pc-linux-gnu`, cc1plus under
`/usr/local/gcc-9.2.0/libexec/gcc/x86_64-pc-linux-gnu/9.2.0/`, program names
`as` and `ld`, and a C++ runtime library path resolving within the same GCC
prefix's `lib64` directory. Bare assembler/linker names are lookup results, not
proof those programs ran. No source was compiled in this metadata check.

### Trusted C++ Compile/Run Preparation

The version-two `namespace-smoke.sh` extends the existing helper rather than
introducing a new runtime or weakening the successful AppArmor profile. The
version-one archive/evidence is preserved. The new temporary container requests
256 MiB/no-extra-swap, 64 PIDs, one CPU, a 32 MiB nosuid/nodev executable workspace
and a 45-second timeout plus five-second kill grace. Those settings apply only
to the synthetic probe, not event limits or a proven aggregate enforcement policy.

After the earlier UID check, it writes a fixed C++ sum program inside the
temporary workspace. GCC's version/target and executable assembler/linker paths
are checked. Isolate runs GCC with C++17, eight allowed processes, five-second
CPU/fifteen-second wall requests, 128 MiB per-process address space, 16 MiB stack
and 1 MiB file-size limits. Only the known source is compiled; explicit PATH,
TMPDIR and LD_LIBRARY_PATH select the assembler/linker, workspace temp files and
the reviewed stock runtime path. The compiler needs children; the helper source
permits `--processes=8` without enabling cgroups.
[Helper option handling](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/isolate.c),
[GCC temporary files and tool lookup](https://gcc.gnu.org/onlinedocs/gcc-9.2.0/gcc/Environment-Variables.html).

Compiler exit metadata must be clean, both diagnostic streams empty and the
binary executable. Three separate sandbox executions check `7 + 5 = 12`,
`-9 + 4 = -5` and `2147483647 + 1 = 2147483648`. The program verifies real and
effective UID/GID 60000, then reads its input using C++ streams. Each run requests
one process, one-second CPU/three-second wall, 32 MiB address space, 8 MiB stack
and 8 KiB file size. Expected output stays outside the inner sandbox; `cmp`
checks exact bytes including the final newline, with clean metadata/empty stderr.
Normal workspace/container/profile cleanup and uncertain-state retention remain.

Six grouped local orchestration/checker tests pass using stubs and synthetic
metadata only, including rejection of nonzero/error/signal/empty/missing results.
No compiler or Judge0 ran locally. Actual C++ compilation and execution remain
pending on the isolated VM. No host cgroups are bound or process memberships
changed; non-cgroup process-tree accounting/fault cleanup is not approved for
participant code. The architecture's GCC 15 target remains unchanged.

The eleven existing Node image/Compose checks also pass. Public transfer
artifact: `ingenium-judge-namespace-check-20261017-02.tar.gz` (3,202 bytes), SHA-256
`ce0cd3c7004d7496e228dcb81429d60319b4a5fadbb1822987bca3266bbf9177`.
It contains exactly the public helper and unchanged profile, verified byte-for-byte
against LF source. The earlier archive's checksum remains unchanged. No secrets,
private configuration, compiled program or Judge0 image are packaged. Extract
into a fresh `namespace-check-v2` directory on the isolated VM.

### Trusted C++ Compile/Run Runtime Checkpoint

The user reported the version-two archive checksum matching and all six PASS
lines, including C++17 compilation, three byte-exact sum answers with real and
effective UID/GID checks, workspace removal and stopped container/profile removal.
Isolate reported compilation at 0.646 seconds labelled `real` and 1.075 seconds
`wall`; the three runs reported 0.004/0.014, 0.003/0.002 and 0.003/0.002 seconds
respectively. These labels are preserved as printed; the helper source computes
the first from resource usage. This is one synthetic example, not a throughput
or end-to-end Judge0 submission latency benchmark. The container name
`ingenium-namespace-check-jgjAwe` is normal successful removal output.

This is user-reported VM evidence. No Judge0 queue consumer/API submission,
participant source, event toolchain or application integration was exercised.
The checks did not deliberately hit CPU, memory, PID, file or output limits or
prove recovery after a crash. C++ compilation worked under the reviewed
non-cgroup test profile; it does not establish the approved per-job guarantees.

Before a cgroup execution probe, read the current API container's selected
resource configuration, cgroup namespace mode and `/proc/self/cgroup` membership.
The metadata-only `cat` process runs as UID/GID 65534 with the API's existing
security settings; no configuration/environment values are printed. The API is
only a Docker layout reference and must not be used for submitted code or
delegation. No controller path is bound, limit changed or process moved by this
inspection. Namespace-relative paths must not be mistaken for host paths.
[Docker membership and controller layout](https://docs.docker.com/engine/containers/runmetrics/).

Later job subgroups must retain verified aggregate budgets from bounded parents;
the earlier empty test groups outside Docker's child hierarchy are not reusable
execution destinations. Membership/configuration inspection alone is not runtime
enforcement proof. Keep API maintenance, worker shutdown and the four-hour STOP
guard unchanged while preparing that separate experiment.
[Hierarchical CPU budgets](https://docs.kernel.org/scheduler/sched-bwc.html),
[legacy memory hierarchy](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html).

### Docker Resource Membership Runtime Checkpoint

On 2026-10-18 the user reported `Running=true`, `CgroupNS=host`, an empty
`CgroupParent`, and these selected Docker configuration values:

| Field | Reported value | Meaning |
| --- | --- | --- |
| Memory | 805306368 | 768 MiB RAM ceiling |
| MemorySwap | 1610612736 | 1,536 MiB combined RAM/swap ceiling, not observed usage or allocated swap |
| NanoCPUs | 750000000 | 0.75 of one CPU core, not 75% of the two-core VM |
| PidsLimit | 128 | Task limit, including threads |

Memory/CPU/PID membership and the other listed controllers share
`/docker/7fafab546525d9bb7b45560efff4b86948b813234ab966883f6a80a9b396c82b`.
The CPU and CPU-accounting controllers are combined; the `0::` entry retains
the already-observed hybrid v2 hierarchy. Host cgroup-namespace visibility does
not grant privileged mode, writable controller mounts or host networking.
Empty CgroupParent selects Docker's default parent, not an absence of limits.
[Docker layout and namespace defaults](https://docs.docker.com/engine/containers/runmetrics/),
[memory/swap and CPU meanings](https://docs.docker.com/engine/containers/resource_constraints/),
[PID controller tasks](https://docs.kernel.org/admin-guide/cgroup-v1/pids.html).

This matches the configured API RAM/CPU/PID ceilings. Actual swap availability,
kernel controller values and enforcement under pressure were not shown. The next
read-only command resolves the current full container ID, validates its hex form,
then reads only known memory, combined CPU/accounting and PID controller files
under that `/docker/<id>` path, plus host SwapTotal/SwapFree. A missing path or
controller file is a diagnostic failure, not permission to create, remount or
change it. No API/controller policy is modified and no test program is run.
The next execution profile must still preserve reviewed aggregate budgets;
this inspection does not authorise writable API-group delegation.

### Kernel Resource Settings Runtime Checkpoint

The user supplied the six expected controller values under the same API
container ID: memory limit 805306368, memory-plus-swap limit 1610612736,
memory.use_hierarchy 1, CPU quota 75000/period 100000, and pids.max 128.
These agree with Docker's reported configuration. Host SwapTotal and SwapFree
both report 0 kB: no swap is currently enabled, despite the container's larger
configured combined ceiling. No swap setup or API limit change is needed.
Configuration agreement is not enforcement evidence under pressure.

### Bounded-Parent Cgroup Execution Preparation

`cgroup-smoke.sh` reuses the exact inspected image and unchanged named AppArmor
profile. It checks the VM, v1/cgroupfs layout, required controller aliases,
empty-controller hybrid v2 hierarchy, root memory hierarchy, cpuset values,
API profile/maintenance and absence of a previous test profile before mutation.
Its private public-only configuration/profile copy is compile-checked first.

It exclusively allocates a fresh common parent in every discovered v1 hierarchy
and the hybrid v2 hierarchy, tracking only successful allocations. Root cpuset
CPU/node masks are copied only to the new cpuset parent. Before starting Docker,
the new parents receive verified 128 MiB RAM/combined-memory limits, 50000/100000
CPU quota/period and 32-task PID limits. No root or existing API controller
setting is written. Two fresh `jobs` branches, below the bounded memory and
combined CPU parents, are the only writable controller binds in the container.
The aggregate budget files and the PID controller are not exposed writable.

```text
memory / combined CPU hierarchy:
  fresh bounded parent
    +-- Docker container leaf (keeper/proxy)
    +-- jobs/box-0 (sandbox process)
```

The container uses explicit `--cgroup-parent`, matching outer Docker limits,
host cgroup namespace visibility, no network, a read-only root, the same seven
capabilities, no-new-privileges/seccomp and a twenty-second timeout plus five-
second kill grace. The existing profile denies `/sys` access; only the fresh job
branches and read-only static Isolate configuration are bound. The earlier
unbounded empty-check branches are not reused. All processes retain the bounded
PID parent/container membership because Isolate moves only memory/CPU membership.
[Docker custom parents](https://docs.docker.com/reference/cli/docker/container/run/#cgroup-parent),
[hierarchical CPU budgets](https://docs.kernel.org/scheduler/sched-bwc.html).

Before execution, the inner check requires identical memory/CPU/PID membership
at the expected parent plus one full container-ID leaf. Isolate then runs only
`/usr/bin/id -u` with `--cg`, a 32 MiB job memory/combined-memory cap and small
time/address-space/file/stack limits. Assertions require UID 60000, clean exit
metadata/empty stderr, positive kernel memory/CPU accounting, the requested job
limits, empty task lists and removal of the job groups/workspace. Peak bytes and
CPU nanoseconds are printed; these are lab counters, not the approved trusted
execution evidence format. Optional per-job cpuset is not exposed or tested.
[Exact Isolate cgroup behavior](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/cg.c).

The host confirms stopped zero-exit state, expected profile/parent, unchanged
aggregate budgets and empty parent task lists before removing the container and
profile. Only successfully allocated empty groups are removed with `rmdir`,
including hybrid v2 bookkeeping; no recursive cgroup deletion or process killing
is used. Uncertain load/run/state/budget/teardown outcomes retain all allocations
and private diagnostic files for inspection. Pre-start failures clean only owned
empty allocations. No worker, API submission, image build or cloud resource is added.

Six grouped local orchestration/membership checks pass using stubbed commands
and controller files inside empty test tmpfs mounts. They exercise successful
scoping, wrong/absent membership, guards, allocation failures, budget mismatch,
nonempty tasks and uncertain cleanup. No real cgroup write or Judge0 execution
occurred locally. Actual VM execution/accounting, deliberate limit enforcement,
fault recovery and safe event operation remain unverified.

The eleven existing Node image/Compose checks also pass. Public artifact:
`ingenium-judge-cgroup-run-20261018-01.tar.gz` (4,183 bytes), SHA-256
`7fdbd2294d8438be2eed2e1bb46a3dbc3e2b0c295fc04690d99366350c2bd51b`.
It contains exactly `cgroup-smoke.sh` and the unchanged public AppArmor profile,
verified byte-for-byte against LF source. No secrets/configuration credentials,
images or compiled programs are included. Extract into fresh `cgroup-run-v1`;
keep earlier artifacts and the VM's four-hour STOP guard unchanged.

### Bounded Job Execution Runtime Checkpoint

On 2026-10-18 the user supplied a successful checksum and all seven version-one
PASS lines: profile compilation, aggregate limits, container membership, trusted
UID execution with accounting, workspace/job-group removal, container/profile
removal and host-parent/private-file cleanup. The reported counters were
`JobPeakBytes=311296` and `JobCpuNs=2937729` (about 2.94 ms CPU). The printed
container name `ingenium-cg-run-0NDwjN` is normal successful removal output.

This is user-reported evidence of one normal job run below a bounded parent,
not evidence of limit enforcement, malicious-code containment or crash recovery.
No execution worker, API submission or participant program was involved.

### Controlled CPU And Memory Limit Probe

Version two extends the same helper and keeps version one's archive unchanged.
No image, capability, mount target, AppArmor policy, API or cloud resource changes.
The outer timeout becomes thirty seconds plus five-second kill grace; the fresh
parent retains 128 MiB RAM/no-extra-swap, 0.5 CPU and 32 tasks. Its memory and
combined-memory limit-hit counters must remain zero, and Docker must not report
an OOM kill. These checks reject an aggregate failure as a successful job test.

After the normal identity check, two fixed Bash builtin programs run as UID/EUID
60000 in separate freshly initialized job groups. The stock interpreter path is
`/usr/local/bash-5.0/bin/bash`, checked executable before use; no dependency is
installed and the existing read-only `/usr` mapping suffices.
[Tagged interpreter definition](https://github.com/judge0/judge0/blob/v1.13.1/db/languages/active.rb).

- CPU: a fixed loop has a 0.2-second CPU / five-second wall limit and 32 MiB
  memory/address-space caps. Require helper exit 1, CPU-specific `TO` metadata,
  a keeper kill marker, at least 200 million accounted nanoseconds, and no
  memory-limit hits. A wall-clock timeout or infrastructure error is not a pass.
- Memory: a fixed builtin attempts a 32 MiB string with a 16 MiB job cap,
  256 MiB address-space cap and three-second CPU / eight-second wall limits.
  Require helper exit 1, signal 9, `SG` metadata, an OOM marker and positive job
  memory-limit hits. The larger address-space cap avoids treating malloc failure
  as memory-cgroup enforcement. Kernel OOM killing must already be enabled;
  no OOM/hierarchy policy is changed.

The checker rejects absent, contradictory or duplicate status/message evidence.
Each run permits one process and requires empty program output/diagnostics,
empty job task lists, and workspace/job-group removal before the next phase.
Unexpected outcomes stop and retain the container/logs, profile and host groups
for review. This tests two specific single-process failures, not aggregate
multi-process pressure or the approved crash/drain protocol.
[Exact helper error paths](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/isolate.c),
[OOM marker source](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/cg.c),
[kernel v1 limit-hit/OOM meanings](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html).

Seven local grouped checks pass using simulated commands/controllers and the
actual extracted membership/result checkers. Cases include missing/duplicate
metadata, wrong signals, wall-clock timeouts, missing OOM/kill evidence, invalid
counters, aggregate pressure, Docker OOM state and uncertain teardown. These
checks do not execute Judge0 or change real controller files. The real CPU/OOM
probe remains pending on the isolated VM.

The eleven existing Node image/Compose checks also pass. The public archive
`ingenium-judge-cgroup-run-20261018-02.tar.gz` is 5,063 bytes; SHA-256
`36b75814dcaf7385ef8d1851b9cfab173e99833d2a36bac43400d0a61de5c184`.
It contains only the two allowlisted public files, byte-checked against LF
source; its profile matches the earlier namespace archive exactly. No secrets,
binary image or compiled executable is included. Extract into `cgroup-run-v2`,
leaving earlier artifacts and the VM's four-hour STOP setting unchanged.

### Version-Two Partial Runtime Result And Counter Fix

The user reported a successful version-two checksum, normal identity/accounting,
and a CPU-limit PASS with `JobCpuNs=252347769` and `MemoryLimitHits=0`.
The memory run exited 1 with `time:0.041`, `cg-mem:16384`, `cg-oom-killed:1`,
`exitsig:9`, `status:SG` and `message:Caught fatal signal 9`. These match the
expected OOM failure metadata, but the checker rejected the result before its
output/task-list/cleanup assertions. Do not mark the whole memory test successful.

Retained identifiers are container `ingenium-cg-run-DbVTzW`, profile
`ingenium-isolate-smoke-v1`, parent `/ingenium-cg-run.DbVTzW` and private files
`/run/ingenium-cg-run.DbVTzW`. No cleanup, VM restart or new run is authorised
by this checkpoint. Inspect Docker state, actual job CPU usage, both memory
limit-hit counters, limits and task lists without mutation first.

The local checker incorrectly required a positive RAM-only `memory.failcnt`.
Linux 6.8's charging path checks the combined-memory counter before RAM when
that accounting is active. With equal limits, combined-memory rejection can
leave RAM-only hits at zero. This explains a possible false failure; the user's
counter values were not printed and still need confirmation.
[Kernel charging order](https://github.com/torvalds/linux/blob/v6.8/mm/memcontrol.c#L2570),
[separate limit-hit counters](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html#failcnt).

The source now reads, validates and prints both counters before classification.
The memory case requires either counter to be positive, while still requiring
the exact OOM/signal metadata and positive CPU accounting. The CPU case requires
both counters zero. Fresh groups must begin with both counters zero; aggregate
limits and all profile/capability/network/cleanup restrictions are unchanged.
Regression fixtures cover RAM-only, combined-only and both counters, malformed
or missing combined counters, and rejection of memory hits in a CPU test.
The new tests reject the old implementation; all seven grouped checks pass after
the correction. No real Judge0 execution or cgroup write occurred locally.

The immutable version-two archive is not modified or approved for rerunning.
Packaging the corrected source and any scoped cleanup follow evidence review.

### Retained Counter Diagnosis Confirmed

The user supplied these read-only results for `ingenium-cg-run-DbVTzW`:

| Scope | Observed |
| --- | --- |
| Docker | Stopped, exit 1, OOMKilled false, expected custom parent |
| Aggregate parent | RAM/combined limits 134217728 bytes; both fail counts 0; OOM kills 0 |
| Job | RAM/combined limits 16777216 bytes; RAM fail count 0; combined fail count 38; OOM kills 1 |
| Job CPU | 41170605 ns, matching the rounded 0.041-second metadata |
| Job tasks | No entries in the memory or CPU task-list output; no missing-file errors reported |

These confirm the false rejection of the combined-counter-only case. The fixed
memory allocation was killed within its job budget rather than the outer
container/parent. They do not complete the original probe: empty streams,
normal helper cleanup and all host parent removals were not checked after the
failed assertion. Runtime/classification validation of the corrected script
still requires a fresh run, not editing retained results into a pass.

The exact reported counters and metadata fields are now covered by the local
regression fixtures; all seven grouped checks pass. The runbook's one-off cleanup
first checks the exact stopped
container state/parent, exact profile fingerprint and expected cgroup mount
paths. It removes only that named container, known empty job branches and
exact-name parents, using non-recursive `rmdir`, then unloads only the test
profile and removes its two private public-content files. It starts no process,
changes no limit, and does not touch API/dependency containers or data volumes.
A failure stops cleanup; do not add force/recursive flags or blindly rerun it.
[Docker removal](https://docs.docker.com/reference/cli/docker/container/rm/),
[empty cgroup removal](https://docs.kernel.org/admin-guide/cgroup-v1/cgroups.html#basic-usage).

The corrected public archive `ingenium-judge-cgroup-run-20261018-03.tar.gz` is
5,160 bytes; SHA-256
`3a6aae11810a58be5936b420f64346193601e57e760be4f742faf5cd6d7d2b88`.
Its two members match the LF source bytes exactly, and the profile matches the
version-two archive. The runbook cleanup block was syntax-checked but not run
by the assistant; it uses assertions and empty-only removal, not a tested event
recovery controller. Both manual VM cleanup and the complete corrected probe
remain pending. Use fresh `cgroup-run-v3` only after cleanup confirmation.

### Failed-Probe Cleanup Runtime Checkpoint

The user reported `ingenium-cg-run-DbVTzW` followed by the final
`PASS: failed probe container, empty cgroups, profile and temporary files removed`.
This confirms completion of the scoped cleanup sequence without a reported
error; the container name is normal Docker removal output. No API/dependency
container, data volume, resource limit or VM runtime setting was changed by
that sequence. This is manual recovery of this known synthetic failure, not
proof of the approved automated crash/drain protocol.

The version-three archive checksum was reverified locally as
`3a6aae11810a58be5936b420f64346193601e57e760be4f742faf5cd6d7d2b88`.
The next user-run step is a fresh `cgroup-run-v3` execution, with the same
trusted programs, aggregate limits and security profile. It must pass all nine
checks including both limit classifications and normal cleanup. That complete
corrected VM run remains pending; workers stay stopped and maintenance enabled.

### Corrected CPU And Memory Probe Runtime Checkpoint

The user reported the expected version-three checksum and all nine PASS lines:
profile compilation, aggregate budgets, container membership, normal UID 60000
execution/accounting, CPU-limit termination/cleanup, memory-limit termination/
cleanup, all workspace/job-group removal, container/profile removal and final
host-group/private-file removal. Container `ingenium-cg-run-M0jV9v` was removed;
its printed name is normal removal output.

| Probe | Reported counters | Outcome |
| --- | --- | --- |
| Identity | Peak 311296 bytes; CPU 2756314 ns | Normal execution and accounting passed |
| CPU loop | CPU 244452077 ns; RAM hits 0; combined hits 0 | Expected CPU-time termination and cleanup passed |
| Memory allocation | CPU 45617241 ns; RAM hits 0; combined hits 51 | Expected job OOM termination and cleanup passed |

The deliberate `Time limit exceeded` and `Caught fatal signal 9` messages were
followed by their expected PASS lines. The corrected classifier handles the
observed combined-counter-only failure without loosening resource limits.
The helper's final success also confirms its post-run aggregate budget checks,
zero aggregate memory-limit hits, stopped non-OOM container state and empty
group removal. No retained failed-probe resources were reported in this run.

This is user-reported evidence for two fixed, single-process limits and normal
cleanup. It does not prove compiler-child/process-tree aggregate accounting,
crash/drain recovery, complete bounded output capture, final target toolchains,
Judge0 queue/API execution, participant isolation or event throughput. No
worker or participant code was started. The next proposed experiment combines
the earlier fixed C++ program with this bounded-parent design, after reviewing
its compiler-child and executable-workspace requirements. Keep maintenance,
worker shutdown, existing service configuration and four-hour STOP unchanged.
This checkpoint changes documentation only; no additional cloud action or Git
mutation was performed by the assistant.

### Bounded C++ Compilation Probe Prepared

Version four extends the existing `cgroup-smoke.sh`; it keeps all earlier public
archives unchanged and adds no worker, image build, dependency or network rule.
The same isolated VM/image/profile and seven capabilities are used. The new
aggregate parent/Docker limits are 256 MiB RAM and combined memory, 0.5 CPU and
32 tasks. Only this test's fresh cgroup parents receive new limits; API/global
controller configuration is not changed. The overall test timeout is sixty
seconds plus five-second kill grace, not a VM runtime extension.

The 16 MiB throwaway workspace is executable for the compiled program but retains
nosuid/nodev. The root filesystem and `/usr` mappings stay read-only, `/tmp` and
cgroup scratch stay noexec, and no additional host path is exposed. This follows
the earlier fixed C++ namespace experiment, not a general participant policy.
[Temporary mount options](https://docs.docker.com/engine/storage/tmpfs/).

After repeating the identity and deliberate CPU/memory tests, a fresh job/workspace
receives the same known C++ sum source. GCC 9.2.0/target and assembler/linker paths
are checked. The compile uses C++17, O0, warnings-as-errors, at most eight processes,
five-second CPU/fifteen-second wall limits, 128 MiB job/combined memory, 128 MiB
per-process address space, 16 MiB stack and 1 MiB file-size limits. Fixed PATH,
TMPDIR and LD_LIBRARY_PATH select the known compiler/runtime and workspace.
[Compiler temporary files](https://gcc.gnu.org/onlinedocs/gcc-9.2.0/gcc/Environment-Variables.html),
[helper cgroup accounting](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/cg.c).

An outer-container observer polls the job task list while compilation runs. It
requires a live `cc1plus` PID present in both memory and CPU job controllers;
the readable command-name file is checked through the container's existing
`/proc`. Nothing is mounted at `/proc` or the cgroup paths inside the inner
sandbox. Missing/vanished samples are ignored during polling, but a compile
without a confirmed observation fails after its process is waited for. No
additional permission is granted to make observation pass. This is a fixed-
compiler diagnostic, not a tamper-proof process identity or event evidence format.
[Namespace-relative cgroup PIDs](https://github.com/torvalds/linux/blob/v6.8/kernel/cgroup/cgroup-v1.c#L306),
[readable process command names](https://github.com/torvalds/linux/blob/v6.8/fs/proc/base.c#L3086).

Compile completion requires clean unique zero-exit metadata, empty output and
diagnostics, an executable binary, exact job limits, positive kernel memory/CPU
accounting, zero RAM/combined limit hits and empty task lists. Three executions
check `12`, `-5` and `2147483648` byte-for-byte including newlines and verify
real/effective UID/GID 60000. Each has a 32 MiB job/address-space cap, one process,
one-second CPU/three-second wall limits and 8 KiB regular files. Job accounting
is checked after every execution, followed by the existing complete cleanup.

Expect eleven PASS lines, including successful C++ compilation with observed
child membership and three exact answers. This repeats known limit probes under
the new outer cap; it does not replace the prior successful 128 MiB checkpoint.
On a failure, retain evidence and stop without increasing limits or weakening
profiles. Compiler-child pressure limits, crashes, arbitrary programs, all event
toolchains and event load are not proved by a successful fixed compilation.

Ten local grouped orchestration/checker tests pass with simulated controllers and
commands, including actual extracted compiler-child, successful-metadata and
accounting functions. Eleven existing Node image/Compose checks also pass. No
Judge0 image or C++ compiler was run locally and no real cgroup was written.
Actual VM compilation/observation remains pending; workers stay stopped, API
maintenance stays enabled and the VM's four-hour STOP guard remains unchanged.

Public artifact: `ingenium-judge-cgroup-run-20261018-04.tar.gz` (6,177 bytes),
SHA-256 `592e051eb51133c2e8b3763abdf86207b7311cfd04dd98504880a4c9e0eee76c`.
It contains only the extended helper and unchanged public AppArmor profile,
checked byte-for-byte against LF source. No credentials, image or executable
is included. Use fresh `cgroup-run-v4`, not an earlier extracted script.

### Bounded C++ Runtime Checkpoint

The user reported the expected version-four checksum and all eleven PASS lines.
The test verified the 256 MiB aggregate parent, 0.5 CPU and 32-task settings,
normal UID execution/accounting, both intentional limit failures, observed
compiler-child membership, exact C++ answers and all normal cleanup stages.
Container `ingenium-cg-run-xsVOOW` was removed; its printed name is normal
Docker removal output. The helper finished without retaining failed-test state.

| Phase | Job peak bytes | Job CPU ns | Other evidence |
| --- | --- | --- | --- |
| Identity | 577536 | 3222342 | UID 60000 check passed |
| CPU limit | Not separately printed | 251184421 | RAM/combined hits both 0; expected timeout passed |
| Memory limit | Not separately printed | 42264207 | RAM hits 0; combined hits 46; expected OOM passed |
| Compile | 65892352 | 650870152 | `cc1plus` PID 82 observed in both job controllers |
| Run 1 | 33275904 | 5299948 | Exact answer 12 |
| Run 2 | 33071104 | 2691256 | Exact answer -5 |
| Run 3 | 33071104 | 3010264 | Exact answer 2147483648 |

Compilation's reported CPU time is approximately 0.651 seconds and accounted
peak memory 62.84 MiB. Isolate separately printed 1.444 seconds wall time for
compilation; the per-run wall times were 0.019, 0.006 and 0.008 seconds. These
are measurements of this fixed lab program with the stock GCC 9.2.0, not a
capacity claim or the approved event GCC 15 profile.

The compile/run phase reused its job group, resetting peak/CPU counters and
lowering the memory cap before execution rather than creating fresh groups per
answer. Memory accounting can include page cache and retained group charges;
the near-32-MiB run peaks are not isolated program RSS or evidence that this
small sum program intrinsically needs that much memory. No cache flushing or
controller changes are needed to interpret these diagnostic measurements.
[Kernel memory-accounting details](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html#accounting-details).

All reported answers passed UID/GID checks, clean metadata, exact-byte comparison,
positive accounting, zero ordinary-run limit hits and empty job task lists.
Workspace/job groups, container, test profile, aggregate host groups and private
temporary files were removed normally. This does not establish malicious-code
isolation, forced compiler-child pressure limits, crash/drain recovery, complete
bounded output capture, all language profiles or full Judge0 API/queue behavior.

Before this run, the user reported the existing VM stopped with its 14400-second
STOP duration still configured, then started it using the existing instance.
The private IP remained 10.42.0.3 and its reported external IP became
34.180.60.26. No firewall modification or VM replacement was required to run the
probe. The assistant did not operate cloud resources. Service readiness has
not been established after this restart: the standalone probe only inspected
the retained API container's profile and maintenance configuration.

The next read-only inventory lists only this Compose project's container names,
states, health/status and ports. It prints no config, environment or credentials
and starts nothing. Keep maintenance enabled and workers stopped while reviewing
the fixed single-submission worker path. The existing worker script retains
upstream retry/scheduler behavior and is not approved as a supervised one-job
runner by the successful Isolate checks.

### Private Services Stopped After The VM Restart

The user supplied the scoped container inventory: the retained API was exited
with code 1, PostgreSQL and Redis with code 0, each displayed as ten hours old.
The three port columns were empty and no execution worker was listed. These
services use restart policy `no`; their absence from the running set after a VM
restart does not require container recreation. The API's earlier nonzero exit
has not been root-caused, and exit 0 alone does not establish database/cache
readiness or persisted-data health.

Reuse the runbook's existing restart block with an explicit VM-hostname guard.
It checks maintenance true and wait/batch creation disabled without printing
configuration, starts only the existing DB/Redis containers, waits for health,
and reads the `judge0` role flags. Only the expected non-superuser role with
CREATEDB but no CREATEROLE/REPLICATION/BYPASSRLS is accepted before API startup.
It then starts only the existing API, discovers its private container IP and
runs the existing four-gate HTTP probe. The probe enqueues no program; both
POST bodies are empty objects. On failure the existing trap stops only the API
and leaves the dependency volumes intact.

This does not add a worker, expose a port, alter credentials, delete a volume or
change cloud settings. API startup does run its own lab database setup and
language seed, so preserving containers/volumes is not a claim of zero database
writes or a production-safe restart. No new upload or image build is required.
The assistant has checked the existing source/procedure but has not operated
the VM. Successful service recovery and four-gate results are still pending.
[Starting existing services](https://docs.docker.com/reference/cli/docker/compose/start/).

### Post-C++ Private API Recovery Passed

The user reported the existing PostgreSQL and Redis containers healthy, then all
three services healthy after the retained API was started. The HTTP probe passed
unauthenticated rejection (401), authenticated Judge0 1.13.1 metadata (200),
maintenance rejection of empty submission creation (503), and disabled batches
(400). The supplied block also had to pass the maintenance/wait/batch config
guards and expected database-role flags to reach the API startup/probe.

This is user-reported recovery of the existing synthetic stack, not a recreation
or a new worker deployment. No executable submission was enqueued. It confirms
the tested private API path is working after this VM restart; it does not explain
the API's earlier exit code 1, prove all persisted data or establish judging
readiness. Do not repeat the restart/probe just to advance.

The next chunk is the reviewed single-job lab runner, not starting the retained
`scripts/workers` loop. Local source still contains its scheduler and worker
restart loop, while the tagged `IsolateJob` declares up to 100 RuntimeError
attempts, chooses a sandbox ID from the submission ID and invokes Isolate with
default directories plus `/etc`. Our successful helper instead used a fixed
box 0, explicit directory mappings, a bounded parent and verified cleanup.
These interfaces must be reconciled without loosening the API entrypoint's
UID/config checks, giving the API execution privileges or running code in its
container. No stock-worker startup or maintenance change follows from the four
HTTP passes.
[Tagged job source](https://github.com/judge0/judge0/blob/v1.13.1/app/jobs/isolate_job.rb),
[tagged submission creation](https://github.com/judge0/judge0/blob/v1.13.1/app/controllers/submissions_controller.rb).

Keep the first executable experiment restricted to one known C++ sum payload,
one execution and exact output checking, with no automatic replay after an
uncertain creation reply and no participant/competition data. Review code,
bounded runtime/cleanup and local tests before another operator-run archive.
The worker, API-to-queue-to-execution path, crash recovery and event profiles
remain unimplemented/unverified. Maintenance, worker shutdown, private ports
and the four-hour STOP setting remain unchanged at this checkpoint. Only
documentation changed locally; the assistant did not operate cloud resources.

### Idle Queue and C++ Contract Probe Prepared

`infra/judge-spike/probe-queue.py` is the next operator-run check. It has not
been run on the VM by the assistant or reported successful by the user. It
requires Linux, root and the exact isolated VM hostname before invoking Docker.
It reads only the existing lab services; it creates no container, starts no
worker and changes neither maintenance nor cloud settings.

The four checks are:

1. The running Compose-project inventory contains exactly the existing API,
   database and Redis containers, without an additional project worker.
2. A UID 1000 command checks the API config's ownership/mode and fixed restriction
   lines without sourcing or printing it, and checks image environment version
   `1.13.1`. This is a file/environment check, not a replacement for the already
   passed HTTP maintenance/authentication tests.
3. The existing database client's local TCP connection uses the `judge0` role,
   disables client startup files and uses a read-only transaction default plus
   connection/statement/lock deadlines. A fixed SELECT returns only booleans:
   confirmed read-only mode, exact stock C++ language 54 fields and no existing
   submissions. It does not fetch source, tokens, output or language commands.
4. The existing Redis client uses `EVAL_RO` to return only queue status. The Lua
   check first limits the keyspace to 32 keys, rejects unknown keys, limits the
   queue registry to one entry and permits only the expected versioned queue.
   Pending jobs, registered workers and failed jobs must each be zero. No queue
   payload is read, removed, pushed, retried or cleared.

The database schema and C++ definition come from the tagged
[schema](https://github.com/judge0/judge0/blob/v1.13.1/db/schema.rb) and
[language seed](https://github.com/judge0/judge0/blob/v1.13.1/db/languages/active.rb).
The tagged [config loader](https://github.com/judge0/judge0/blob/v1.13.1/scripts/load-config)
sets the worker queue from the image version. The Redis namespace/key assumptions
are reviewed against [Resque 2.0.0](https://github.com/resque/resque/blob/v2.0.0/lib/resque.rb)
and its [data store](https://github.com/resque/resque/blob/v2.0.0/lib/resque/data_store.rb).
[Redis EVAL_RO](https://redis.io/docs/latest/commands/eval_ro/) rejects dataset
writes; reading status does not mean the Redis process has no internal counters
or script-cache activity. PostgreSQL's
[transaction settings](https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-DEFAULT-TRANSACTION-READ-ONLY)
document the read-only default used by this client connection.

Unexpected data causes a failure, not a cleanup or repair. Preserve that data
for inspection; do not flush Redis or truncate submissions to make the check
pass. Diagnostics and credentials are not printed. Command calls have a
20-second caller deadline and returned status is limited to 8 KiB for acceptance.
The SQL query has its own five-second deadline; no Rails application, Resque
worker, compiler or submitted code runs in this check.

Local Python tests cover the successful call sequence, host/root guards, changed
config/profile, existing data/workers, malformed/duplicate JSON, strict field
types, command failures, output size and redacted errors. The complete API and
queue probe test suites total 20 passing tests. Bash syntax was checked for the
embedded API and client command scripts. These tests simulate Docker responses;
they do not establish that the SQL/Lua has passed against the cloud services.

Operator archive `ingenium-judge-queue-check-20261018-01.tar.gz` contains only
`probe-queue.py`. SHA-256:
`feee99904f00de3b059369f59952a8cfc34c8e4b00a5a7c0643b8faf6da8138f`.
It contains no credentials or runtime image. Follow the runbook's fresh
`queue-check-v1` extraction; no image rebuild or service restart is needed.

This is an idle-lab snapshot, not an atomic execution claim, proof of physical
drain, job-delivery test or permission to enable submissions. Queue format,
single-job adapter, API-to-execution/result flow, crash reconciliation and final
event toolchains remain pending. Maintenance, private ports, no worker startup
and the existing four-hour STOP guard remain unchanged.

### Idle Queue and C++ Contract Probe Passed

The user reported the expected archive checksum as OK and all four probe PASS
lines on the VM. The known Compose-project running inventory was exactly API,
PostgreSQL and Redis. The API config checks passed under UID 1000, including its
restriction lines, ownership/mode and image version `1.13.1`.

The live database SELECT confirmed a read-only connection, the exact tagged C++
language 54 definition and no submission records. The live Redis `EVAL_RO`
check confirmed the permitted idle keyspace/queue registry, with zero pending
jobs, zero registered workers and zero failed jobs. Unlike the earlier simulated
unit tests, this is user-reported success of the SQL/Lua checks against the
existing cloud services. The assistant has not accessed those services.

Nothing in this probe enqueued, dequeued or executed a program, cleared data,
started a worker or changed the maintenance setting. The checks are a snapshot,
not an atomic reservation or proof that every possible host process is drained.
They do not prove actual API job creation, message format, worker execution or
result lookup. No repeat inspection, service restart, data cleanup or image
rebuild is required merely to acknowledge this result.

Next implement and locally test the fixed single-job lab runner before any
executable API request. It must accept only the reviewed synthetic payload,
preserve the tested sandbox boundaries, avoid the stock retry loop and stop on
uncertain creation/execution rather than replaying work. Do not bypass the API's
UID/config guards or give its container execution privileges. Maintenance stays
enabled, workers stopped, ports private and the VM's four-hour STOP guard
unchanged. End-to-end execution, crash recovery and the final event profiles
remain unverified. This checkpoint changes documentation only, not Git history
or cloud state.

### Complete Fixed One-Job Lab Experiment Prepared

The user requested implementation and a faster pace. `one-job.py` now combines
the next transport/execution checks into one controlled experiment, rather than
another sequence of operator-run preflights. This is a custom lab adapter, not
the upstream `IsolateJob` implementation, a participant runner or the approved
production supervisor. No cloud run of this new code has been reported.

```text
temporary private API -> Judge0 DB + Redis envelope -> one-shot adapter
    (then removed)          -> existing bounded helper -> DB result
                            -> original maintenance API GET + byte/metric check
```

The runner has no CLI options or arbitrary source/language path. It requires
root on the exact disposable VM, the existing private runtime config's ownership
and mode, the pinned API image, internal bridge and passed idle-lab checks. It
verifies that its fixed source bytes appear exactly in the bounded helper. The
local approved fixture is the same UID/GID-checking C++ sum program; the queued
input is `7 5\n`, whose exact expected output is `12\n`. Expected output is not
sent to Judge0. This does not add an Ingenium endpoint, schema or scoring rule.

Before any executable POST, the runner exclusively creates the persistent
root-private `/opt/ingenium-judge-spike/one-job-v1` directory and an fsynced
journal. It refuses an existing record, including after VM restart. Creation,
queue claim, execution and result-save intent are recorded before their
respective side effects. This is a refusal-to-replay guard for one lab run,
not distributed exactly-once execution or crash reconciliation.

To leave the original API untouched, the runner makes a private copy of its
runtime config with only the exact maintenance line changed. It uses that copy
in one temporary API container with the same pinned startup image, original
entrypoint/UID/config guards, non-root user, dropped capabilities, NNP,
`docker-default`, read-only root, internal network, bounded RAM/CPU/PIDs/tmpfs,
rotated logs, no host ports and restart policy `no`. `lab-server.sh` is bound
read-only at the existing server-role path; it does not migrate or reseed the
database. This temporary API uses the same private credentials; they remain in
root-private files and are never put in host command arguments or printed.
It is a controlled single-client lab, not a new public admission gateway.

Only GET readiness checks may repeat. The fixed Base64 payload is POSTed once.
Whether that reply succeeds or fails, the temporary API is ownership-checked,
stopped, verified stopped, its last 80 log lines retained privately, and removed
before the runner can claim or execute a job. Its private config copy is then
unlinked. Uncertain allocation, ownership, shutdown or cleanup stops progression;
there is no force removal of other containers. A hard process/host crash can
leave this temporary resource for inspection, but cannot automatically replay
the experiment. The original API's file/container remain unchanged throughout.

The one database row must match the exact source, input, language, limits,
flags, token and unstarted status, with no expected output, callbacks, files or
command overrides. The Redis envelope must match the tagged Rails 5.2.4.3
Resque wrapper, versioned queue, first-delivery fields and that exact database
ID. Dynamic job-class lookup/deserialization is never invoked. A bounded-keyspace
Lua script atomically verifies the current queue and exact head before one LPOP.
Unknown replies, data, retries, workers, extra records or queue entries are
failures, not reasons to requeue, flush or truncate. Database status changes use
guarded single-row updates. The Redis/PostgreSQL operations are not one atomic
cross-service transaction; an interrupted claim/transition requires inspection.

Execution calls the existing tested `cgroup-smoke.sh`, preserving its budgets,
explicit mounts, fixed box 0, compiler-child accounting and normal cleanup
checks. The helper still runs the fixed CPU/memory and three-case C++ regression
checks; only the first case supplies this one queued job's result. Its new
structured evidence lines contain actual source hash, stdin/stdout Base64,
CPU nanoseconds, cgroup peak bytes and wall time. They are emitted by the outer
trusted helper, not supplied by program stdout. No credentials, DB/Redis access,
Docker socket or network are passed into the sandbox. The adapter accepts the
three exact fixtures only after helper exit 0 and confirmed host-group cleanup.

Only then does the adapter save the first case's measured output/accounting and
finished status to the same lab record, fetch it through the original API,
verify exact Base64-decoded bytes and metrics, verify the empty queue and repeat
the original four API gates. A provider `Accepted` label is not competition
acceptance. The reported memory is the reused job-cgroup peak rounded up to KiB,
including possible compile-cache charges; it is not isolated program RSS.

Local checks: 36 Python tests cover fixtures, strict queue/result/evidence
validation, read-only/writable client boundaries, config-copy isolation,
private API arguments/ownership cleanup, fsynced exclusive journaling, one-POST
behavior after reply loss, single execution and no replay after claim/save/read
failure, and wrong-host/root guards. Thirteen synthetic startup tests pass,
including the temporary API's original entrypoint guards/no DB reseeding.
Eleven Bash sandbox-orchestration groups pass, including actual evidence-emitter
bytes with stubs, plus eleven existing image/Compose tests. No Judge0 image,
Rails application, compiler, submitted program or real database was run locally.
These tests do not establish the new live API/SQL/Lua flow or crash recovery.

Archive `ingenium-judge-one-job-20261018-02.tar.gz` contains only six public
source/profile files. SHA-256:
`72bde9b89dcb99753db1b4d3fed402c170be50c8a633df519d4722695c1a8d26`.
It includes no secrets, image or test credentials. The operator runs it once
with a five-minute outer deadline; the existing VM four-hour STOP guard remains
unchanged. No VM, firewall, billing, application database or Git mutation is
performed by the assistant.

On success, preserve the lab row, journal and private logs. The old empty-database
queue probe is deliberately no longer the correct post-run check. On failure,
do not rerun, delete the marker, alter statuses or clear queues. Share only the
terminal PASS/FAIL lines first, not credentials or private logs. Production
execution permits, arbitrary source/profiles, complete stream bounds, physical
drain/recovery, all five event toolchains and throughput remain unimplemented or
unverified; this fixed fixture cannot sign off those gates.

Source contracts reviewed against the tagged
[Rails Resque adapter](https://github.com/rails/rails/blob/v5.2.4.3/activejob/lib/active_job/queue_adapters/resque_adapter.rb),
[job serialization](https://github.com/rails/rails/blob/v5.2.4.3/activejob/lib/active_job/core.rb),
[submission model](https://github.com/judge0/judge0/blob/v1.13.1/app/models/submission.rb),
[Base64 service](https://github.com/judge0/judge0/blob/v1.13.1/app/services/base64_service.rb),
[result serializer](https://github.com/judge0/judge0/blob/v1.13.1/app/serializers/submission_serializer.rb)
and [status definitions](https://github.com/judge0/judge0/blob/v1.13.1/app/enumerations/status.rb).

### Fixed One-Job Cloud Experiment Passed

The user reported `ingenium-judge-one-job-20261018-02.tar.gz: OK` and all 17
terminal PASS lines. The sequence was:

1. The existing three-service idle inventory, configured API restrictions,
   stock C++ definition/empty submissions, and idle Redis checks passed.
2. The original API passed all four authentication/version/maintenance/batch
   gates before executable job creation.
3. One asynchronous submission was created through the temporary private API;
   that API was stopped and removed before queue claim and execution.
4. The exact persisted payload and queue envelope matched; the single queued
   job was claimed without a retry.
5. The fixed C++ job produced the expected bytes and confirmed normal sandbox
   cleanup. This reuses the existing helper's fixed regression checks.
6. The original API passed all four gates again. Its result lookup matched
   actual stdout `12` plus newline and the stored execution evidence; the queue
   was empty and the original API remained in maintenance. No stock worker was
   started.

This is user-reported live evidence for the new API, PostgreSQL, Redis Lua,
fixed adapter and bounded helper working together, beyond local stub tests.
The assistant has not connected to the VM or independently inspected its private
journal/logs. The terminal completion lines occur after the runner's final
checks and fsynced COMPLETE event, but that is not an independent filesystem or
crash-durability inspection. New numeric CPU/memory/latency measurements were
not printed; do not substitute earlier helper-run values or call it a capacity
benchmark.

No extra rerun, image rebuild, cleanup, service restart or credential export is
needed to acknowledge success. Preserve the lab submission and root-private
`/opt/ingenium-judge-spike/one-job-v1` record/logs. The old empty-submission probe
will deliberately reject this now-nonempty lab; do not truncate data, clear
Redis or delete the run record to make it pass. The original API stays in
maintenance, ordinary workers stay stopped, ports stay private and the VM's
four-hour STOP guard stays unchanged.

The next useful implementation slice is controlled failure/output-limit
coverage through the same queue boundary, with fixed reviewed fixtures and
explicit cause/output checks. It must preserve the successful run and its
evidence, not replay it or loosen source guards for arbitrary code. The complete
production supervisor, all five exact event profiles, stream completeness,
failure/recovery/drain behavior and throughput still require implementation and
verification. One successful fixed C++ request does not approve participant
submissions or establish general Judge0 safety. This checkpoint updates
documentation only; no runtime code, Git history or cloud state changed.

### Batched Failure/Output Coverage Prepared

The user requested the next implementation at a faster pace. `failure-suite.py`
now combines eight controlled cases in one operator run instead of separate
uploads and repeated preflight conversations. At preparation the cloud result
was pending; the successful user-reported checkpoint is recorded below.

| Fixed fixture | Required evidence/outcome |
| --- | --- |
| Wrong subtraction output | Clean exit and exact `2\n`, not private expected `12\n`; private `WRONG_OUTPUT`. |
| Deliberate `#error` | Compiler exit 1, expected diagnostic marker, no runtime phase or invented runtime metrics. |
| SIGSEGV | Exact signal 11, no OOM marker or resource hit. |
| Nonzero exit | Exact exit 7, no signal or resource failure. |
| CPU limit | CPU timeout, positive usage at least 0.2 seconds, explicit kill evidence; wall-clock timeout is rejected. |
| Memory limit | Job OOM marker, signal 9 and positive RAM or combined-limit hit counter; aggregate parent must remain unhit. |
| Output overflow | SIGXFSZ/signal 25 and 8 KiB captured; incomplete stdout is withheld from the API result. |
| Exact output-cap control | Clean exit with exactly 8 KiB; complete output at the cap is not overflow. |

The Isolate error/control fields and exit distinctions follow the pinned
[Isolate source](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/isolate.c).
OOM/accounting evidence also uses its pinned
[cgroup implementation](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/cg.c).
Legacy Judge0 has no separate memory-limit status: the suite stores its `Other`
runtime status while keeping the precise private `MEMORY_LIMIT` outcome in the
journal. It stores output overflow as legacy `SIGXFSZ`. Wrong output remains
legacy `Accepted` because no expected output was sent to the provider; it must
not award a score. See the tagged
[status definitions](https://github.com/judge0/judge0/blob/v1.13.1/app/enumerations/status.rb).
This does not implement the final general-purpose competition checker.

The runner verifies the completed old checkpoint and hashes its entire matching
database row before making any new record. It uses the existing creator helper
once for eight sequential, non-retried POSTs, then removes that private API before
claiming any job. Each claim binds the exact FIFO envelope, persisted payload,
submission ID/token and total of nine records. Guarded processing/result writes
and original-API reads happen once per case. Finally it requires an empty queue,
unchanged baseline fingerprint and the original four API gates.

Each case uses the existing cgroup-smoke host lifecycle with a fingerprinted,
read-only source/helper mount. The common 256 MiB / 0.5 CPU / 32-task budget,
private job-group binds, named AppArmor profile, capabilities, default seccomp,
network-disabled sandbox and normal cleanup checks are unchanged. Compile and
runtime groups are separate so compiler cache charges do not contaminate the
16 MiB OOM probe. Core dumps are disabled. Source hashes are checked before host
allocation and again on the actual copied source before compilation. Unknown
fixtures, altered source, ambiguous metadata and incomplete cleanup stop the run.

The fsynced, root-private `failure-suite-v1` journal is an exclusive one-shot
record, not an automatic recovery mechanism. The completed `one-job-v1` row and
journal/logs are read only. All nine database rows remain after success. On an
uncertain create/claim/run/save, retain records, queue data and sandbox evidence;
do not rerun, requeue or clear data. No stock worker, new port, volume reset,
cloud resource or billing change is introduced.

Local checks passed: 52 Python tests; 14 grouped Bash orchestration/evidence
checks; 13 startup cases; 11 Node image/Compose checks. They cover fixed payloads,
all verdicts, boundary/overflow distinction, strict parsing/accounting, missing
or linked files, no-retry partial failures, baseline guards and batch ordering.
The Bash checks use stubs and temporary controller models, never real host
cgroups or Judge0. No C++ program was executed locally.

Archive `ingenium-judge-failures-20261018-01.tar.gz` contains exactly 16 public
regular files. SHA-256:
`6ed92087f8dd55245faa56dad3320224c5cc7821355f1a79ed7b98e9e03d4cde`.
Its source-byte equality, LF endings and Python 3.10 syntax were checked.
The full Cloud Shell/VM procedure is in `infra/judge-spike/README.md`.
The ten-minute caller deadline does not alter the VM's four-hour STOP guard.
General participant execution, all five exact profiles, trusted stream
completeness, crash reconciliation, physical drain and event throughput remain
unproved. The following checkpoint records the subsequent cloud report.

### Batched Failure/Output Cloud Run Passed

On 2026-10-18 the user reported the archive checksum OK and all 20 PASS lines.
All eight named outcomes matched: `WRONG_OUTPUT`, `COMPILATION_ERROR`,
`SIGNAL_CRASH`, `NONZERO_EXIT`, `CPU_TIME_LIMIT`, `MEMORY_LIMIT`, `OUTPUT_LIMIT`
and `EXACT_OUTPUT_BOUNDARY`. Each case reported an original-API result and normal
cleanup check. The original four authentication/version/maintenance/batch gates
passed before creation and after the suite. The temporary private creator was
removed, the successful baseline was unchanged and the queue ended empty with
maintenance still enabled.

No rerun, restart or cleanup is needed for this success. Preserve all nine
submissions, `/opt/ingenium-judge-spike/one-job-v1` and
`/opt/ingenium-judge-spike/failure-suite-v1`, including their private logs. Keep
the stock worker stopped, ports private and the four-hour STOP guard unchanged.
The old empty-database queue probe no longer applies. The assistant recorded the
provided terminal report; it did not access the VM or inspect private evidence.
Detailed per-case timing/memory measurements were not supplied, so this is not
a benchmark or event-capacity claim.

Next prepare one reviewed runtime-profile build for the approved C17/C++17
(GCC 15), Java 21, Python 3.14 and Node.js 24 target families, pin exact build
identities and test the five profiles together. The stock GCC 9.2 C++ lab result
does not establish those profiles. Generic trusted output evidence, one-time
execution permits, crash reconciliation, process-tree drain and realistic event
load remain required; this checkpoint does not approve participant execution or
change the architecture.

### Five-Language Build/Parity Package Prepared

The user approved preparing the five target profiles together. `profiles.py`
now builds a separate, unprivileged-by-default image and runs fifteen exact
fixed answers (three per language) under the existing host lifecycle. No cloud
resource was operated, image built locally, Git mutation performed or new cloud
PASS claimed by the assistant.

The public registry's Linux/amd64 manifests/configs were inspected on 2026-10-18.
The selected patches and exact image/config digests are in `profiles/lock.json`:
GCC 15.3.0, Temurin 21.0.12.1+1, CPython 3.14.8 and Node 24.22.0. The GCC/Python/
Node source images use Trixie, avoiding transplantation of newer glibc-dependent
tools into the old Buster Judge0 filesystem. Only the Jammy JDK tree is copied.
Compatibility remains to be demonstrated by the build and sandbox run, not
assumed from version strings. Official build references:
[GCC](https://github.com/docker-library/gcc/blob/5719f2f1af9000a4129748ce85656c7964b76c31/15/Dockerfile),
[Python](https://github.com/docker-library/python/blob/master/3.14/trixie/Dockerfile),
[Node](https://github.com/nodejs/docker-node/blob/main/24/trixie/Dockerfile),
[Temurin](https://github.com/adoptium/containers/blob/main/21/jdk/ubuntu/jammy/Dockerfile).

The build copies the previously fingerprinted legacy Isolate and its libcap
dependency, not Rails, Redis or provider credentials. Their legacy status remains
a security-review/upgrade requirement, not something a newer language image
fixes. Isolate's pinned source sets `RLIMIT_NOFILE` to 512. A small unprivileged
exec launcher checks sandbox UID/GID, lowers descriptor limits to 256 and core
limits to zero, then execs the frozen compiler/interpreter. No additional host
capability or alternate sandbox implementation is introduced. See
[the pinned limit setup](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/isolate.c).

Compiler/run commands and fixed source hashes are locked. C17/C++17 use `-O2`;
Java preserves public `Main`/`Main.java` and uses Serial GC, one active processor,
disabled container autodetection/performance data, a 256 MiB heap and 1 MiB
thread stack. Node uses a 256 MiB old-space cap and one V8/UV pool thread setting.
Those heap settings do not replace the 512 MiB aggregate run cgroup. No virtual
address cap is used; compiler cgroups have 1 GiB, and the new common parent is
bounded at 1,536 MiB / 0.5 CPU / 128 tasks. Normal operation verifies limits,
accounting, observed UID/GID/file limits and fresh-group cleanup. These are not
adversarial per-profile limit or process-tree-drain proofs. Java flag reference:
[Java 21 runtime options](https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html).

The operator command first verifies both completed old checkpoints, all nine
finished rows, an idle queue, current private API restrictions and 12 GiB free
disk. It fingerprints all old rows with read-only PostgreSQL SHA-256 before and
after. It never alters language/submission rows or creates new queue jobs. It
pulls only digest-pinned sources, builds with RUN-step network disabled and
executes the resulting immutable image ID. A private fsynced checkpoint refuses
overwrites/repeats. Success writes a lab runtime manifest with image/bundle,
actual binary/version, kernel and measured parity evidence; it does not register
the five profiles in the legacy provider or approve participant execution.

Local checks passed: 65 Python tests, 16 grouped Bash lifecycle/membership/
evidence checks, 13 startup checks and 11 Node configuration tests. They cover
source/command/image locks, exact patches/hashes, normal phase orchestration,
identity/descriptor/controller observation, private diagnostic prefix bounds,
all fifteen output checks, preservation failure and existing-checkpoint guards.
No new runtime image or language program executed locally. The pinned registry
metadata was read without pulling/executing its layers on the development laptop.

Public archive: `ingenium-judge-profiles-20261018-01.tar.gz`, 17 regular files,
SHA-256 `a50fb8c8d009c04cc11a98eeaba9ca1d229fab22cfdc900d70d041b8bb4e47d3`.
Exact archived source bytes, LF endings and Python 3.10 syntax were checked.
The complete Cloud Shell/VM procedure is in `infra/judge-spike/README.md`.
The 30-minute caller ceiling leaves the provider's four-hour STOP guard intact.
Additional image downloads/disk use happen only when the user runs that command.
If any step fails, retain private logs/checkpoints and sandbox evidence; do not
rerun, clear data, force-remove groups or claim a different profile is equivalent.
All-five runtime compatibility, generic bounded output evidence, provider
mapping, crash/uncertain-send reconciliation, physical drain and realistic event
load remain pending.

### Version-One Partial Parity And Java Loader Correction

The user reported the version-one archive checksum OK, successful source pulls
and image build, followed by a parity-stage failure. The supplied private log
then confirmed the expected GCC 15.3.0, Java 21.0.12.1+1, CPython 3.14.8 and Node
24.22.0 version observations and binary fingerprints. These version checks ran
outside the inner sandbox; they do not prove program execution in every profile.

C17 compilation used 149637169 accounted CPU ns and peaked at 42733568 bytes;
C++17 compilation used 754150883 ns and peaked at 68755456 bytes. Each profile
returned all three exact outputs with identity/accounting checks and normal
per-phase cleanup. This is fixed normal-path evidence, not an event benchmark.
Java's first compile exited 127 before compilation with a `libjli.so` loader
error; the sandbox metadata classified an error exit, not OOM or timeout.
Python/JavaScript program phases were not reached.

The explicit sandbox library path omitted `/usr/local/java/lib` and its `server`
subdirectory. The source correction adds these absolute paths in the shared
compile/run helper and matching image environment. They are already inside the
read-only `/usr` bind: no extra mount, `/proc` exposure, capability, toolchain
change or resource relaxation is introduced. This addresses the observed lookup
failure without claiming why every loader fallback behaved as it did.
[Dynamic-loader search rules](https://man7.org/linux/man-pages/man8/ld.so.8.html).

The user reported `ingenium-cg-run-zJHkFA` stopped with exit 1. Its bounded parent
is `/ingenium-cg-run.zJHkFA`, private files `/run/ingenium-cg-run.zJHkFA`, and
policy `ingenium-isolate-smoke-v1`. No safe cleanup is inferred merely from that
stopped state. The new fixed cleanup verifies the failed v1 journal/bundle,
exact decoded error/resource association, container image/state/PID/restart/OOM,
the nine preserved rows, idle queue, original policy/config and all owned task
lists/subtrees before removal. It refuses unrelated or nonempty groups. It saves
the verification and policy/config bytes in an exclusive fsynced cleanup journal,
then removes only the specific stopped container, unused test policy, empty
groups and temporary files without force/recursive operations. Existing images,
archives, database/queue data and original private logs/journal are preserved.
This is a specific synthetic-failure recovery, not production crash reconciliation.

The corrected runner uses separate `profiles-v2` image/checkpoint identities.
`--cached-images` requires the four already-pulled immutable bases and never
falls back to a pull. Build steps remain network-disabled. The old one-shot
guards are not disabled, and version-one evidence is not overwritten. The
operator's `set -e` block starts this new fixed test only after successful scoped
cleanup. If resources changed, a reboot removed them or any action is uncertain,
stop and inspect instead of forcing a retry. The four-hour STOP guard is intact.

The new regression reproduced the missing Java path in compile and run commands
and is now green. Local checks: 74 Python tests, 16 grouped shell checks, 13
startup checks and 11 Node configuration tests. New coverage includes exact
cleanup association, live/wrong container rejection, unknown/nonempty group
refusal, child-first empty cleanup, removal-failure stop ordering and cached
build separation. Tests use stubs/temporary models; no new image or language
program executed locally.

Prepared public archive: `ingenium-judge-profiles-20261018-02.tar.gz`, 18 regular
files, SHA-256 `3c21eda2832b1a3d5391815dae8679e55be0f3bdbf3c4ea9a59c1a5ba75dc234`.
Source equality, LF endings and Python 3.10 syntax were checked, and the original
version-one archive remains unchanged. See the correction procedure in
`infra/judge-spike/README.md`. The scoped cloud cleanup and corrected parity are
reported in the following checkpoint; this preparation alone was not a pass.

### Corrected Five-Language Cloud Run Passed

On 2026-10-18 the user reported the version-two archive checksum OK and successful
scoped removal of the stopped Java-failure probe after empty-task checks. The
old evidence and all nine database records were preserved. The cached build
completed without build-step network access, followed by these checks:

| Profile | User-reported result |
| --- | --- |
| C17 / GCC 15.3.0 | Three exact answers, observed sandbox identity and accounted normal cleanup |
| C++17 / GCC 15.3.0 | Three exact answers, observed sandbox identity and accounted normal cleanup |
| Java / Temurin 21.0.12.1+1 | Three exact answers, observed sandbox identity and accounted normal cleanup |
| Python / CPython 3.14.8 | Three exact answers, observed sandbox identity and accounted normal cleanup |
| JavaScript / Node 24.22.0 | Three exact answers, observed sandbox identity and accounted normal cleanup |

The original authentication/version/maintenance/batch gates passed before and
after parity. The runner reported the pinned runtime manifest saved, all nine
old rows unchanged, an empty queue and maintenance still enabled. Preserve
`/opt/ingenium-judge-spike/profiles-v2/runtime-manifest.json`, its private journal
and logs, plus the earlier checkpoints. No rerun, image replacement, provider
language registration or additional cleanup is needed for this success.

This closes the fixed normal-path five-language compatibility check, including
the Java loader correction. It does not prove generic submissions, bounded
stream completeness, once-only execution, crash recovery, adversarial isolation
or event capacity. Detailed version-two metrics/image identities were not pasted;
they remain in the VM's private manifest. The assistant recorded the terminal
report without operating the VM or independently inspecting that manifest.

The next implementation chunk should connect the tested runtime profiles to
trusted, identity-bound execution evidence and durable one-time guards, then
exercise lost creation replies, duplicate delivery and crash/drain boundaries.
An uncertain execution must retain its physical reservation rather than launch
again. Reuse the existing lab and fixed fixtures; no new cloud host or changes
to the approved architecture are required merely to record this checkpoint.

### Durable Guard And Recovery Batch Prepared

`recovery.py` adds one fixed, synthetic lab experiment. `recovery.sql` creates
`ingenium_recovery_v1.attempts` inside the existing isolated Judge0 database;
the application database and nine old submission rows are not changed. The
schema/table are private to the existing database owner. This is not the final
application migration, a new database service, or stock Judge0 token mapping.

Each lab application-attempt UUID has one generated lab provider UUID and an
immutable host-boot, payload and completed-runtime-manifest binding. Matching
registration reuses the same row/UUID; a changed binding returns no match.
An atomic conditional update grants only the transition `PREPARED -> STARTED`
to one owner, with permit count one. The guard never resets or reissues a permit.
A database trigger rejects binding edits, reverse transitions, sealed-result
replacement and row deletion. A normal verified execution may move
`STARTED -> SEALED` for the same owner; reservation state is derived from that
durable state, not a worker's age or existence. The design uses PostgreSQL's
atomic conflict handling and conditional update behavior, not an in-memory flag.
[INSERT concurrency](https://www.postgresql.org/docs/16/sql-insert.html),
[Read Committed updates](https://www.postgresql.org/docs/16/transaction-iso.html).

The grouped cloud test will:

1. Exit a worker after registration commits, deliberately discarding its reply.
   Reconcile through the unique attempt/binding and require the same lab UUID.
   Reject changed epoch, payload and manifest on registration and permit claim.
2. Release four separate Python worker processes through a start barrier. Only
   one may acquire the launch permit. That worker runs the existing fixed
   five-language/three-input harness using the previously verified image ID,
   with no build or pull. Existing cgroup/AppArmor/mount/limit/cleanup checks stay
   unchanged. This is a new guarded fixture experiment, not a rerun of the
   completed one-shot `profiles.py` checkpoint.
3. Fsync identity-bound evidence only after the existing parser proves all
   fifteen exact answers and normal host cleanup. Seal its fingerprint in the
   same owner's row, then deliberately exit before returning a success reply.
   Reconcile the sealed result without another launch. Exercise database guards
   against reset, payload edit and deletion inside rollback-safe test blocks.
4. Exit a second worker after its permit commits but before sandbox launch.
   A replacement must refuse another permit, and the second reservation must
   remain held with no invented result. A stale owner cannot seal that work.
5. Require exactly two lab records, unchanged hashes of all nine original rows,
   an empty original queue and all four original HTTP gates. Save private
   context, bounded worker replies, execution log/evidence and journal under
   `/opt/ingenium-judge-spike/recovery-v1`. No record/evidence is deleted.

The two deliberate nonzero worker exits around registration/permit and the one
after sealing are fixed fault hooks. They drop acknowledgements after real
database commits; they do not inject loss inside the Judge0 HTTP controller.
The retained second reservation is intentional conservative lab state: the
fixture did not launch a sandbox, but a successor is not permitted to infer
safety from the dead worker. This batch does not implement physical retirement
or demonstrate a crash while a sandbox is running. Its host boot ID is a lab
fence, not the complete endpoint/credential-epoch retirement protocol.

The runner refuses the wrong host/user, changed manifest/kernel/image, existing
checkpoint/schema, changed old data or unconfirmed permit reply. It creates no
listener, service, image, cloud resource or automatic retry. Credentials remain
outside the execution image; the original API stays private and in maintenance,
the stock worker stays stopped, and the four-hour VM STOP guard is unchanged.
Any partial failure preserves the checkpoint/schema/resources for inspection.

Local checks: 91 Python tests (17 new recovery tests), 16 shell groups, 13 startup
checks and 11 Node configuration tests passed. Coverage includes binding and
reply validation, no-launch-on-uncertainty, wrong boot/manifest, concurrent worker
orchestration, evidence/cleanup-before-seal ordering, failed seal handling,
retained reservations, preservation checks and no-reset guards. These use mocks
and temporary models: no local Judge0 image/program or PostgreSQL server ran,
and the new SQL/concurrency behavior still requires the cloud test.

Public archive: `ingenium-judge-recovery-20261018-01.tar.gz`, 19 regular files,
SHA-256 `c117d37dd119cfd010b2c98abec4da8c5590c117e3a45aeb2b18a997135c8976`.
Exact source bytes, LF/ASCII, Python 3.10 syntax and both unchanged old profile
archives were verified. See `infra/judge-spike/README.md` for the user-operated
upload/run procedure. No cloud or Git mutation was performed by the assistant.
Generic bounded stream evidence, Judge0 HTTP/queue integration, mid-execution
crash/drain, hostile-code isolation and event throughput remain open gates.

### Registration NULL Transport Correction Prepared

The user reported `ingenium-judge-recovery-20261018-01.tar.gz: OK`, the expected
three services/restrictions and all four initial HTTP gates, then
`FAIL: JSONDecodeError`. No grouped registration/permit/cleanup PASS was reported.
That output alone does not establish the exact journal stage, database state
or whether any process launched; preserve all retained evidence.

The registration query used a scalar JSON subquery. When the deliberate
wrong-binding conflict returns no row, the scalar is SQL NULL. The `psql`
transport renders that as an empty field, not the JSON bytes `null`, so the
strict JSON reader fails before the mismatch test finishes. The new regression
reproduced this using the actual `lab.db` decoder with modelled `psql` bytes;
the original test mocked the already-decoded Python value and missed this
boundary. The correction is `COALESCE(subquery, 'null'::json)` at the query, not
a global rule that accepts empty/malformed responses as valid data. A genuinely
empty transport reply still raises an error. References:
[psql NULL display](https://www.postgresql.org/docs/16/app-psql.html),
[COALESCE](https://www.postgresql.org/docs/16/functions-conditional.html).

`resume-registration.py` is restricted to the expected untouched pre-launch
checkpoint. Before any mutation it requires root-private directories, exactly
the original three files, journal events PREPARED/SCHEMA_CREATE_STARTED/
SCHEMA_CREATED, matching schema/manifest/data fingerprints, the original worker
exit 73 with empty output, one correctly bound PREPARED row with permit count
zero, the same VM boot/runtime image, unchanged nine old records and an idle
queue. It read-only checks the SQL NULL and JSON null transport behavior. Any
extra files, consumed permit, different stage, reboot, changed binding or
existing repair checkpoint blocks continuation without reset or cleanup.

Only after those guards does it create the exclusive private
`recovery-v1/registration-fix-v1` journal and continue the shared already-registered
portion of the original test. It does not recreate schema/rows, repeat the
registration worker, rebuild images, or overwrite the failed journal/context/
worker reply. The remaining competing-worker, evidence, guard and uncertainty
tests use the original binding; a consumed permit can never launch again.
Success verifies the original failed journal fingerprint, all nine old rows,
the empty queue and maintenance, then writes COMPLETE only in the repair journal.

Local verification passed: 96 Python tests and 11 Node configuration tests.
Five new tests cover the raw transport regression and guarded continuation,
including wrong stage/schema/worker exit, extra files/rows, consumed permits,
wrong directory ownership/link type, duplicate repair and no-schema-recreation
ordering. The shared continuation retains the earlier batch tests. These are
mock/temporary-model tests, not cloud SQL or execution proof. The unchanged
shell/startup helpers were not rerun in this correction turn.

Prepared archive `ingenium-judge-recovery-20261018-02.tar.gz` has 20 public regular
files. SHA-256:
`413e93df4adf0f239097588e5ccf673a2e9549e3cda0b6838bd0455f79da0dd6`.
The original archive/checkpoint remain intact. The guarded user-operated
procedure is in `infra/judge-spike/README.md`; the cloud stage diagnosis and
continuation are pending. No cloud operation, Git mutation, credential exposure,
database reset or resource/billing change was performed by the assistant.

### Corrected Registration Passed; Worker Delivery Needs Inspection

The user reported the version-two checksum and initial service/API gates passing.
The continuation positively verified the SQL NULL transport, the exact unstarted
record and unused permit, then reported successful lost-registration reply
reconciliation and mismatched-binding rejection. It subsequently failed during
worker delivery, before any grouped execution/cleanup or result-seal PASS.

Do not repeat either runner or reset the record: a competing worker may have
consumed the permit or still be running. The next action is read-only inspection
of the bounded `deliver-*.json` replies, recovery/execution journal events,
aggregate lab record states, retained sandbox log and test-container status.
No root cause, safe replay, physical drain or new runtime success is established
by the supplied error. The original maintenance/private-access and STOP guard
remain unchanged. No new fix package or cloud operation has been performed for
this second failure; inspection evidence is required first.

### Retained Completed Execution And Profile-Order Correction

The user's read-only diagnostics reported one recovery record, state STARTED,
one consumed permit and zero sealed records. The execution journal contained
LAUNCH_AUTHORISED, SANDBOX_STARTED and SANDBOX_FINISHED. Its sandbox log reported
all five profiles completing with exact answers, removal of
`ingenium-cg-run-icLa6c`, stopped-container/profile cleanup and final host-group/
temporary-file cleanup. Worker replies 1-3 were absent. Worker 0's saved error
text was not included in the supplied output; no complete recovery PASS or
independent process/cgroup inspection is inferred from those excerpts.

The source regression reproduces a post-run checker error: `runtime-manifest.json`
is saved with recursively sorted object keys, placing `javascript` before
`python`. The actual result array retains `c, cpp, java, python, javascript`.
The parser previously zipped that array with manifest dictionary iteration,
then rejected Python against JavaScript's definition. It now uses an explicit
fixed profile sequence and exact profile-key set, while retaining all result
order, source/input/output, identity/accounting and cleanup checks. The regression
passes a real sorted-JSON manifest roundtrip through both the parser and delivery
postprocessor; reversed result arrays still fail. No runtime image input, language
patch, command, resource cap, sandbox mount or security setting changes.

`seal-retained.py` is restricted to this completed-but-unsealed case. It requires
the exact retained file inventory and three journal stages, the prior registration
repair fingerprints/binding, matching row/owner/provider/image/manifest, one
consumed STARTED permit, the completed sandbox-log fingerprint and the reported
container identity. It reads worker 0's private reply and requires the reproduced
`Profile source/ordering differs` error. It revalidates all fifteen saved answers
with the corrected parser; it does not launch or claim the original fixture.

Before any repair write it also checks no lab sandbox containers, no loaded test
policy, no original cgroup in any inventoried controller/hybrid mount, no old
temporary directory and no active old recovery worker/registration-resumer.
An existing repair/evidence file, changed stage, reboot/runtime mismatch, wrong
worker error, remaining resource or active worker blocks sealing. No deletion,
forced termination, table/schema reset or permit reset is performed.

After these guards an exclusive `recovery-v1/evidence-fix-v1` journal records
the old file hashes and immutable owner/binding. The program fsyncs reconstructed
evidence once in the original execution folder. Four new `--duplicate-only`
processes attempt the consumed permit but cannot call a launcher, even if an
unexpected grant is returned. A `--seal-saved` process independently revalidates
the saved bytes against the original log, seals only for that original owner,
and deliberately exits before acknowledging success. Neither mode can execute
language fixtures. The shared existing completion checks reconcile that result,
reject overwrite/reset/deletion, and finish the second crash-before-launch probe.
That second lab reservation intentionally remains held without launching code.

Success requires two lab rows, unchanged original files and all nine old records,
an empty original queue, physical quiescence and the original HTTP gates. COMPLETE
is written only in the new repair journal, with `new_sandbox_launches=0`. Original
failed journals, worker reply and sandbox log remain unchanged. The initial race's
three unsaved replies are not reconstructed or claimed as observed; the four fresh
duplicate-only probes provide separate replay-refusal evidence.

Local checks: 104 Python tests and 11 Node configuration tests passed. Eight new
tests cover sorted-manifest parsing through the real postprocessor, both no-launch
worker modes, exact completed-evidence/owner guards, missing cleanup, changed old
files, physical quiescence models, refusal/partial-seal ordering and wrong-host
guards. No local Judge0, compiler, sandbox or SQL server ran. The unchanged
shell/startup helpers were not rerun in this turn.

Prepared archive `ingenium-judge-recovery-20261018-03.tar.gz`: 20 public files,
SHA-256 `b96356a8cf8d4cfefd555ec1400b56a6bd3de235b1d322261f5a851aa3f98bc2`.
The complete user-operated procedure is in `infra/judge-spike/README.md`. Cloud
sealing/recovery is pending; no assistant cloud or Git operation occurred.
Generic HTTP/queue integration, trusted stream completeness, mid-run crash and
retirement, adversarial isolation and load sign-off remain open gates.

### Guarded Retained-Result Recovery Cloud Run Passed

On 2026-10-18 the user reported the version-three archive checksum OK and all
guarded recovery PASS lines. The corrected parser revalidated three exact saved
answers per profile for C, C++, Java, Python and JavaScript, with observed sandbox
identity/accounting and normal cleanup. The original authentication/version/
maintenance/batch gates passed before and after result recovery.

The report then confirmed:

- Evidence was reconstructed from all fifteen saved answers and normal cleanup,
  without rerunning language fixtures or launching another sandbox.
- Four fresh duplicate-only worker processes refused the already-consumed permit;
  none of those modes can call a sandbox launcher.
- The original consumed permit was bound to the five-profile result and normal
  cleanup. The seal-only worker's deliberately lost acknowledgement was reconciled
  to the same evidence without another launch, and a stale seal was rejected.
- The second fixed worker exited after its permit committed and before sandbox
  launch. A replacement could not relaunch it, and its uncertain reservation
  remained held rather than inventing termination/result proof.
- The retained execution was sealed, original evidence and all nine old
  submissions were preserved, the original queue ended empty and maintenance
  remained enabled.

This closes the scoped lab retained-result/permit recovery check and confirms
the profile-order correction on the user's VM. It is a terminal report recorded
by the assistant, not an assistant-operated inspection of the private journal,
database, image, processes or billing. No new detailed runtime metrics or manifest
identities were supplied. The original initial-race replies for workers 1-3 remain
unobserved; the separate four duplicate-only probes do not fabricate those replies.

No rerun, permit reset, record deletion, image replacement or additional cleanup
is needed. Preserve both rows in `ingenium_recovery_v1.attempts` and the full
`/opt/ingenium-judge-spike/recovery-v1` tree, especially
`evidence-fix-v1/journal.jsonl`, `execution/evidence.json`, the sandbox log and old
failed journals/replies. COMPLETE belongs to the evidence-repair journal; earlier
failed journals correctly retain their old stage. The intentionally held second
lab reservation is not a deliberately running sandbox or permission to reuse it.
Keep private services/maintenance, stopped stock workers and the existing VM STOP
guard unchanged. No Git or cloud operation was performed by the assistant.

The next implementation chunk at that checkpoint was the real private Judge0 HTTP/queue association:
bind an admitted attempt to an authoritative provider record and carry the
one-time guard into dispatch, without retrying uncertain POSTs or enabling stock
job retries. Real HTTP token-loss/queue-redelivery tests, generic bounded stream
evidence, crashes during active execution, safe physical drain/epoch retirement,
hostile-code isolation and realistic event-load gates remain required. This lab
success does not mark the full feasibility gate or participant deployment ready.

### Private HTTP Association Cloud Run Passed

On 2026-10-18 the user reported the HTTP runner's final success output after
recovering the three stopped original lab services. The earlier invocation had
stopped at its service inventory check, before creating an HTTP checkpoint or
schema. The API's old exit code and the earlier shutdown trigger were not
independently diagnosed by restarting it.

The completed experiment used `ingenium-judge-http-20261018-01.tar.gz`, SHA-256
`61592b91657b51d44a2eae2152fd32a0a008d2eb7d2debe8e215114b6e45cc22`.
Its fixed admission endpoint runs only in a temporary private API copy and uses
the real Judge0 model/ActiveJob serialization. It does not enable stock worker
execution/retries, arbitrary submitted source or a public endpoint.

The reported PASS lines establish this scoped result:

- The fixed HTTP admission transaction created one real provider record and its
  durable attempt/token/outbox association. Losing the token reply body and
  explicitly repeating the identical lab POST resolved to the same record.
- Two real Redis deliveries reached separate guarded worker processes, but only
  one compiled and executed the fixture. The one-time permit prevented replay.
- The deliberately lost committed worker reply was reconciled through HTTP.
  The original Judge0 API returned real stdout `12` plus a newline with matching
  accounting, rather than a fabricated success response.
- The runner finished its normal result/cleanup checks. Ten provider records
  remain: one new row and all nine previous records unchanged. The prior held
  reservation remained unchanged; the queue ended empty and the original API
  stayed in maintenance. Its four authentication/version/maintenance/batch gates
  passed again at the end.

This is a user-supplied terminal report, not assistant-operated cloud inspection
or independent review of private rows, journals, process state or billing. No
new detailed metrics or runtime manifest identities were supplied. The fixture
deliberately uses the older C++/GCC 9.2 path; the five newer pinned profiles remain
separately verified, not all-five-language HTTP/queue integration.

Preserve `/opt/ingenium-judge-spike/http-v1`, `ingenium_http_v1`, the ten provider
rows and all previous recovery/profile evidence. Do not repeat this one-shot
experiment, reset permits/send markers, delete queue/records, replace images or
reapply historical empty/nine-row probes. The public archive remains unchanged;
only local documentation records the new outcome. No assistant cloud operation,
Git mutation, architecture change or new spending authorization occurred.

The next group at that checkpoint was to test a crash while trusted code is actually executing, retaining its
physical reservation until process-tree termination and cleanup are proven.
This is different from the already-tested crash before launch or lost reply
after successful cleanup. General bounded stream/completeness evidence, uncertain
outbox-send reconciliation, safe physical drain/epoch retirement, all-five-profile
end-to-end integration, hostile-code isolation and realistic load gates remain
open at that checkpoint. The active crash result below closes only its scoped
process/cleanup boundary, not the full feasibility gate.

### Active Worker Crash and Drain Cloud Run Passed

On 2026-10-18 the user reported all final PASS lines from the guarded schema
continuation in `ingenium-judge-active-crash-20261018-02.tar.gz`, SHA-256
`10df59b061103d663072b6e0616e1ccb76f1ea48e2a00104ed9c8437c8c01e57`.
The original invocation had failed because a new multi-column check received
the name `attempts_check`, already copied from the earlier recovery table.
Diagnostics found only `PREPARED`, no worker journal, no schema/table and no probe
container. Explicit names fixed the SQL without dropping constraints or changing
transitions. The continuation revalidated the original unstarted checkpoint,
same boot/runtime/fixtures, absent owned resources and unchanged earlier records;
it did not reset a permit or replace the old context/journal.

The user-reported result establishes:

- Killing the owned host-worker process group and launcher left the two observed
  UID-60000 sandbox processes alive. Their reservation remained held; an early
  release and a fresh replacement worker's attempt to reuse the permit failed.
- Stable process handles stopped the observed pair. Explicit workspace/job
  cleanup, stopped-container checks and empty-task checks across every owned
  controller preceded removal of only the owned container, profile and groups.
- The durable drain release committed once. Losing its acknowledgement was
  reconciled from the same saved proof; the execution permit stayed consumed,
  reset/deletion checks passed and no participant verdict was invented.
- The original context/main journal, ten provider rows and earlier schemas stayed
  unchanged. The original three lab services and all four private API gates passed
  again, with maintenance still enabled.

Preserve `/opt/ingenium-judge-spike/active-crash-v1`, including its completed
`schema-fix-v1/journal.jsonl`, original `PREPARED` journal, context, worker logs and
drain proof, and its `ingenium_active_crash_v1` schema. The synthetic row remains
`STARTED` with immutable drain fields recording release, not a resettable or
reusable permit. It does not release the older deliberately held crash-before-
launch reservation. Do not rerun either active-crash script or any old fixture.

This is a user-supplied terminal report, not independent inspection of private
evidence/process state or assistant-operated cloud work. No additional runtime
metrics, five-profile HTTP results, billing data or hostile-code evidence were
supplied. Only local documentation changed after the report; public archives,
runtime code, approved architecture, Git history and cloud settings are unchanged.

Next is reliable bounded capture/checker evidence across all five approved
profiles. This successful fixed waiting workload does not cover compile-phase
crashes, a crash during drain itself, uncertain outbox sends, host retirement,
general stream completeness, all-five-profile HTTP integration, adversarial
isolation or event throughput. The complete feasibility gate and participant
deployment remain unapproved.

### Stream Observer Failure and Guarded Correction Prepared

The first fifty-case cloud batch reported `ProcessLookupError`, retaining the
stopped `ingenium-cg-run-w7KHlq` probe and `streams-v1` journal/log. The user then
reported PID 0, exit 1, no container OOM and seven empty memory/CPU/pids task lists.
This does not prove all-controller cleanup or identify the original failing frame.
The pinned observer's disappearing-task read failure is reproduced locally; the
stream caller now handles only that race without inventing positive identity.

New archive 02 adds a scoped `repair-streams.py` entry point. Before removing any
resource it binds the exact failed journal/log, original mounted bundle, cached
image/manifest, boot, limits/mounts/policy and unchanged database records, then
checks every owned controller for live tasks or unexpected children. It preserves
the old journal/log and records cleanup separately under `streams-v1/cleanup-v1`.
Only a complete ready proof allows a new fixed-fixture batch under `streams-v2`;
no permit is reset, row/queue deleted, image rebuilt or restriction weakened.
Private bounded phase/frame summaries improve diagnosis if that new batch fails.
See [the recovery procedure](../infra/judge-spike/STREAMS-LAB.md).

Local checks: 159 Python tests, 158 passing and one Linux-only FIFO skip, plus
11 configuration tests. The 25 focused stream/recovery tests must all pass on the
Linux VM. Cleanup and corrected cloud execution are pending, not reported PASS.
No assistant cloud operation, Git mutation or architecture change occurred.

Prepared `ingenium-judge-streams-20261018-02.tar.gz`: 34 public files, 71,059 bytes,
SHA-256 `053d0aa2f1a5b8ff522038b2a6d8e929773da95b573e8c81414289ab029bcf28`.
The archive matches source bytes with ASCII/LF and Python 3.10 syntax; the frozen
profile inputs, launcher/policy and all other unchanged members match archive 01.
Five earlier public archive hashes remain unchanged. This verifies packaging,
not cloud cleanup, sandbox execution or participant readiness.

### Guarded Stream Recovery and Fifty-Case Cloud Run Passed

On 2026-10-18 the user reported the final success output from archive 02, SHA-256
`053d0aa2f1a5b8ff522038b2a6d8e929773da95b573e8c81414289ab029bcf28`.
The guarded recovery removed only the stopped failed stream probe after checking
empty task lists across every owned controller. Its original journal/log and the
ten provider records stayed intact. The separate corrected batch then passed ten
stream/checker cases each in C, C++, Java, Python and JavaScript, checking bounded
retention, EOF, identity and normal cleanup, and sealed all fifty cases.

Final checks reported all old schemas/evidence unchanged, an empty queue, the
original three services running and all four private API gates passing with
maintenance enabled. Preserve `streams-v1` and its completed `cleanup-v1` proof,
`streams-v2` with its sealed evidence, both extracted bundles and both immutable
archives. Do not rerun either stream controller or historical experiments, reset
permits or clear old records/queues.

This is a terminal report supplied by the user, not independent inspection of
private evidence, detailed metrics, billing or hostile-code behavior. No assistant
cloud operation occurred. Only local checkpoint documentation changed; runtime
code, public archives, approved architecture and Git history remain unchanged.
The fixed-suite success does not establish all-five-profile HTTP evidence
transport, large/failing modern compiler diagnostics, adversarial FIFO safety,
general cause mapping, wider recovery or load capacity. Next integrate the
five-profile runner and bounded checker evidence with the private HTTP/queue path
and its duplicate-delivery/lost-reply checks, without replaying completed fixtures.

### Five-Profile HTTP and Bounded Evidence Integration Prepared

The user approved combining the previously separate profile, stream/checker and
private HTTP/queue experiments. New root-only `transport.py`, a fixed five-job
Ruby admission/evidence handler and a new lab schema reuse the existing helpers.
The completed profile-image context stays byte-identical; only the external stream
runtime and launcher gain a fingerprinted fixed-job mode and one extra read-only
job mount. No image build, public endpoint or participant intake is introduced.

The controlled batch covers C empty output, C++ UTF-8/NUL, Java invalid UTF-8,
Python stdout/diagnostic overflow and JavaScript token-versus-exact matching.
Each real provider/outbox association survives deliberate loss of its token body
and an explicit duplicate POST. Two real Redis deliveries must produce only one
execution per job. A deliberately lost committed worker reply is recovered through
authenticated HTTP with full bounded stream envelopes, not count/digest summaries
alone. The backend checker rechecks those bytes; the original provider GET must
match retained Base64 output and measured accounting. Provider normal-completion
status is not a competition verdict, including wrong output and overflow.

All ten earlier provider rows, previous synthetic schemas, stream/crash evidence
and the older held reservation must remain unchanged. Success retains fifteen
provider rows, five sealed new attempts and an empty queue with maintenance still
enabled. Existing new checkpoints/schemas, changed bindings/boot/old evidence,
unconfirmed claims, incomplete cleanup and malformed/oversized transport fail
closed without retry/reset. After this batch, older ten-row probes are historical.

Local verification: 178 Python tests (177 passing, one Linux-only FIFO skip),
11 configuration tests and 22 stubbed Bash launcher groups. No local compiler,
program, Isolate, Ruby runtime or database server executed. A Ruby stub self-check
runs in the existing VM API before schema writes; real Ruby/SQL behavior and the
integrated execution still require the cloud run. No assistant Git/cloud operation
or architecture edit occurred. See [the procedure and limits](../infra/judge-spike/TRANSPORT-LAB.md).
This is not generic participant readiness, adversarial isolation, full recovery
or event capacity sign-off.

Prepared archive `ingenium-judge-transport-20261018-01.tar.gz`: 40 allowlisted
regular public files, 93,966 bytes, SHA-256
`40bb01cbeca711dc684eaea09f573814009ae25345f7760f07d25c47962c97e2`.
Exact source bytes, ASCII/LF and Python 3.10 syntax were verified. The ten frozen
profile-image inputs, policy, checker and fixed stream fixtures match stream
archive 02; six prior public archive hashes remain unchanged. A fresh extraction
passed its 38 packaged tests locally with the one Linux-only FIFO skip. The
package has no credentials/private checkpoint files. Cloud execution remains
pending; no assistant cloud access or Git mutation occurred.

### Five-Profile HTTP/Queue/Checker Cloud Run Passed

On 2026-10-18 the user supplied all final PASS lines from
`ingenium-judge-transport-20261018-01.tar.gz`, SHA-256
`40bb01cbeca711dc684eaea09f573814009ae25345f7760f07d25c47962c97e2`.
The initial five ten-case PASS lines revalidated retained stream evidence; they
did not rerun the completed fifty-case fixture batch.

The new batch admitted five actual provider/outbox records. Lost token bodies and
explicit duplicate POSTs resolved to one association each. Actual duplicate Redis
deliveries produced only one execution per job. Each lost committed worker reply
was recovered through authenticated HTTP with matching full retained output bytes
and accounting, also checked against the original Judge0 result read. Backend
token/exact results were C `PASSED/PASSED`, C++ `PASSED/PASSED`, Java
`WRONG_ANSWER/WRONG_ANSWER`, Python
`OUTPUT_LIMIT_EXCEEDED/OUTPUT_LIMIT_EXCEEDED` and JavaScript
`PASSED/WRONG_ANSWER`. The deliberately non-passing cases are the expected
negative-case results, not failed infrastructure or grounds for a rerun.

The controller sealed all five bound results and reported fifteen provider rows,
with the ten earlier rows and all earlier schemas/evidence unchanged. The queue
ended empty; the original three services and all four private API gates passed
again with maintenance enabled. Preserve `transport-v1`, its
`ingenium_transport_v1` schema, the five new rows, earlier held reservation and
all prior evidence. Do not rerun the transport controller or old nine/ten-row
experiments, reset permits, clear records/queues or replace public archives.

This records a user-supplied terminal report, not independent inspection of
private rows/journals, runtime metrics, source provenance or billing. Only local
checkpoint documentation changed; no runtime code, public archive, approved
architecture, Git history or cloud configuration was changed by the assistant.
This closes the fixed five-profile HTTP/queue/evidence/checker check, not generic
participant intake, full failure-cause/modern-compiler diagnostics, adversarial
FIFO safety, cancellation/crash/host retirement or measured event capacity.
Next prepare controlled network/metadata, protected-file and child-process
isolation checks; dependency review, broader recovery and load gates remain open.

### Shared Isolation Boundary Batch Prepared

The user requested a faster pace. New `isolation.py` groups three fixed trusted
probes into one guarded batch, without more operator preflight turns or weakening
security checks. The common Isolate boundary is tested rather than repeating the
five-language compatibility or HTTP batches. No participant code is accepted.

The cases cover refused IPv4/IPv6 TCP/UDP socket creation without connecting or
requesting metadata; protected-path opens and a non-overwriting scratch write;
synthetic file/environment canaries; UID/GID/groups, capabilities and limits;
seven held children with the next fork denied by the eight-process cap; and a
detached child still alive when its parent exits. An outside observer checks
actual Python UID/GID, zero capability sets, no-new-privileges, seccomp, hard
process limits and memory/CPU membership. Positive live-child observations and
empty job task lists must precede cleanup. The drain check only waits a bounded
two seconds and fails closed; it does not kill unrelated processes.

The batch reuses the exact cached profile image and policy. The external launcher
adds one fingerprinted mode and a read-only isolation source bundle, not extra
capabilities, a public port, compiler package or cloud resource. Before/after
checks preserve the fifteen provider rows, prior schema snapshots, held
reservation and saved HTTP/stream/crash evidence. All database/Redis operations
are read-only. A new root-private `isolation-v1` checkpoint is exclusive; failure
retains owned resources and bounded diagnostic evidence without resets/reruns.

Local verification: 190 Python tests (189 pass, one Linux-only FIFO skip),
11 configuration tests and 24 stubbed launcher groups. No native probe syscall,
socket/fork probe, compiler, Isolate, database server or cloud operation was run
by the assistant. The actual three-case VM run is pending. The writable-box FIFO
collector is still only trusted-fixture code: this batch does not sign off hostile
output producers, kernel/compiler escapes, dependency support, wider cancellation/
retirement recovery or event-load capacity. See [procedure and limits](../infra/judge-spike/ISOLATION-LAB.md).
The approved architecture and Git history remain unchanged.

Prepared `ingenium-judge-isolation-20261018-01.tar.gz`: 46 allowlisted regular
public files, 110,297 bytes, SHA-256
`38341dca0f0c67e8298139a53036a09d9f0544d36ff3e9aaacb5c587c13650af`.
Exact source bytes, ASCII/LF and Python 3.10 syntax were checked. The profile-image
inputs, policy, checker, fixtures and previous runtime/test sources match the
retained, previously verified transport extraction, except the explicitly extended
launcher. Earlier local archives were no longer present, so their hashes were not
reverified and no historical archive was recreated. A fresh extraction passed all
50 packaged tests locally except the one Linux-only FIFO skip. Actual probe
execution remains pending; no assistant cloud or Git operation occurred.

### Shared Sandbox Boundary Batch: User-Reported PASS

On 2026-10-18 the user supplied the complete controller PASS output for
`boundary`, `fork-limit` and `detached-child`. Each case reported fixed
denials/child observations, accounting and normal cleanup verified. Before and
after the probes, only the original three lab services were running, the API
restrictions remained set and the four private API gates passed. The final line
reported all three probes sealed, all fifteen provider rows and earlier evidence
unchanged, queue empty and maintenance enabled.

This records user-supplied controller output, not an independent assistant
inspection of private evidence or cloud resources. Preserve `isolation-v1` and
all earlier checkpoints, schemas and the intentionally held reservation. No
completed controller or historical nine/ten-row baseline should be repeated.
The approved architecture, runtime code, published archive and Git history were
not changed to record this result.

The fixed Python probes establish their scoped observations through the shared
boundary; they do not prove language-specific escape resistance, hostile FIFO
safety, kernel/compiler exploit resistance, cancellation/host retirement or event
capacity. The next concrete implementation gap is output capture that participant
code cannot replace, drain or otherwise interfere with. Dependency review,
broader failure/recovery and measured load remain separate gates. Maintenance
stays enabled; participant execution is not approved by this checkpoint.

### Cost Review Before Creation

Before creating the host, the user supplied a Mumbai console estimate of
USD 58.75/month for compute and USD 7.20/month for the 60 GiB balanced disk,
USD 65.95/month total. Using 730 hours/month and USD 0.005/hour for one in-use
external IPv4 gives about USD 0.38 for four hours, excluding traffic, taxes,
retained or overlapping disks and account-currency differences. This is arithmetic
from a user-provided quote, not an independently authenticated billing forecast.

The earlier publicly rendered regional tables defaulted to **Iowa**, not Mumbai.
The following is preserved reference arithmetic, not the actual Mumbai quote:

| Reference component | Published rate / calculation | Four hours |
| --- | --- | --- |
| VM | `e2-standard-2`: USD 0.06701142/hour | USD 0.26804568 |
| Disk | 60 GiB x USD 0.000136986/GiB-hour | USD 0.03287664 |
| Ephemeral IPv4 | USD 0.005/hour; conservatively ignore free allowance | USD 0.02000000 |
| Reference subtotal | Compute + disk + address | About USD 0.32 |

Sources: [compute pricing](https://cloud.google.com/products/compute/pricing/general-purpose),
[disk pricing](https://cloud.google.com/compute/disks-image-pricing),
[IPv4 pricing](https://cloud.google.com/vpc/network-pricing).
Traffic, taxes, retained storage and account-currency prices are additional.
Use the actual console/account rates when reviewing subsequent usage. The initial
proposal was a USD 2 credit allowance for this first experiment only, not an
automatic billing cap or authority to resize/extend it.

Check Billing Overview for an active Free Trial and sufficient unexpired credit.
Do not click Upgrade/Activate, buy commitments, request paid quota changes or
treat a friend's balance as pooled credit. Trial restrictions and account quotas
still apply. [Trial coverage](https://docs.cloud.google.com/free/docs/free-cloud-features),
[eight-core trial restriction](https://cloud.google.com/terms/free-trial).

### Shutdown and Cleanup

- Verify the provider-managed four-hour STOP setting. Budget alerts alone are
  not a hard cap. [VM time limits](https://docs.cloud.google.com/compute/docs/instances/limit-vm-runtime).
- Stop early when finished. STOP is only a cost guard for this synthetic test,
  not the complete execution-epoch retirement proof required for competition.
- Export only reviewed non-secret experiment evidence. Do not resume an old
  provider queue or use a stopped host as proof of safe application retry.
- Delete this test VM and its disposable boot disk after evidence review; verify
  that no test disks, snapshots, reserved addresses, NAT resources or other billed
  artifacts remain. Preserve unrelated project resources.
- Persistent storage continues to incur charges while a VM is stopped.
  [Stop behavior](https://docs.cloud.google.com/compute/docs/instances/stop-start-instance).
