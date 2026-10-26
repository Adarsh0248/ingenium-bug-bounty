# Protected Execution Handoff

The supervisor execution/recovery worker, fixed Linux client, guarded launcher,
protected checkpoint store, outer capsule lifecycle/backend, per-capsule Isolate
backend, native host resource/config preparation, durable phase/storage identities,
recorded-empty-group/config retirement and read-only reference checks are implemented. **Real v1
verification, full physical retirement and installation are not complete.** The
actual cgroup-v1 execution path still needs VM verification. Historical lab
controllers are unchanged and must not become general-purpose executors. Normal
application startup still cannot run source.

The separate [continuous supervisor and private gateway](judge-supervisor.md)
now have guarded service entry points. The production full-host proof producer
and retirement composition are also implemented in `host-cli.ts`,
`host-verification.ts` and `host-backend.ts`. Their positive real-host evidence
and installation remain pending; see the [verification plan](judge-host-verification.md).

The native pre-exec handoff, bounded phase pipe collector and fixed Isolate
command builder, source workspace preparer and read-only cgroup-v1 observer are
implemented too. The backend connects them, but local component tests are not
runtime/image/kernel/security certification or permission to admit participants.

## Outer Capsule Lifecycle

`capsule-backend.ts` implements the existing `TrustedSandboxBackend` boundary for
the guarded launcher. It delegates actual host readiness, sends one original
request through the fixed capsule lifecycle, reads validated results from the
protected checkpoint rather than Docker output, and explicitly stops/removes the
container. It does **not** grant its own readiness lease or invent parent drain.
The explicit root host CLI constructs it after verified host preparation;
ordinary application startup does not. No host service has been installed yet.

`capsule-lifecycle.ts` and the separate `capsule-<epoch>-<attempt>` journal provide:

1. Persist an exclusive allocation directory, original plan/boot binding and
   random capsule identity before sending Docker create. Incomplete persistence
   stays held. A second EXECUTE cannot allocate again, even with the same input.
2. Pin the returned full container ID before writing a separate start receipt.
   Persist that receipt before sending the original input exactly once. Source
   and stdin are not copied into ownership labels or lifecycle journal records.
3. Resolve a lost create acknowledgement by exact name/labels/image/config,
   binding the original full ID. Recovery never fills an absent object by create,
   never sends input again and never starts even an unstarted original container.
4. For explicit removal, recheck the original ID/config, stop if running, require
   running=false and PID=0, then persist stopped and removal-intent receipts before
   `rm` without force or volume deletion. Verify absence and append removed.
   An absent object without those prior receipts is not successful cleanup.
5. A lost removal acknowledgement can reconcile absence against the prior stopped/
   removal intent. All records are mode-0400, write-once and fsynced. Retained
   verdict recovery reads these bindings and the original physical/result record
   without Docker, readiness, journal mutation, execution or automatic cleanup.
6. `createCapsuleBackend(...).retire(plan, signal)` is a separate internal
   maintenance call for the original capsule after an interrupted reply. It uses
   the same guarded removal flow, then returns only the saved result or null.
   It cannot create/start source or manufacture a result. Without the separate
   authority below it issues no positive drain; the gated handoff may append a
   certificate-backed extension only to an original saved result.
   Cancelled/overlapping execution and retirement calls are refused. No HTTP/IPC
   retirement endpoint or production startup wiring is added.

`docker-capsule.ts` fixes the container image ID, Node entry point, no shell,
network=none, read-only root, no restart/healthcheck/init/logging, exact eight setup
capabilities, NNP/AppArmor/seccomp, resource/descriptor limits and private mount/
tmpfs layout. Inspection rejects changed ownership, image, command, mount sources,
writability, capabilities, policy, restarts and extra mounts. The seccomp digest
binds the parsed/serialised policy returned by Docker, not merely a file path.
The command adapter requires an already verified open local Docker executable
and uses only the fixed local daemon/config path. Host installation must protect
that executable, socket/config, immutable image/dependencies, policy files and
all mount source identities. The mandatory preparation authority must verify the
actual boot, owned real v1 parents (including `parent/docker`), limits, config and
reviewed image/security before create **and** start. The native resource part
below is implemented; verified installation/image/security/readiness authority
is still not supplied by current application runtime.

The [Docker stop reference](https://docs.docker.com/reference/cli/docker/container/stop/)
documents the `--timeout` option used by the adapter. A local interruption test
confirmed that killing attached CLI transport does not itself stop the container.

**Removal is not capacity release.** Stopped/removal receipts alone contain no
drain proof or participant verdict. All original processes, namespace/mount/workspace
retirement, empty owned groups across every controller, protected parent inode
identities and irreversible no-future-start conditions still need the complete
host retirement authority before an append-only positive drain can be issued.
The certificate handoff below now transports that separate authority's proof;
its production kernel-backed implementation is still absent.
Unknown/failed states retain capacity. Parent provisioning/retirement, immutable
installation, genuine readiness/clock, cross-capsule UID/process fairness and
real VM/security/load verification remain required. Do not retrofit or rerun the
old lab controllers or reset their evidence/permits.

New checks cover synthetic once-only/order/corruption/failure cases, real Linux
disk journals after a killed synthetic controller, and read-only five-language
disk-result recovery. `npm run test:judge:capsule` additionally uses five owned
real Docker containers to verify lost create/start/remove replies and interrupted
attach, including a detached trusted child held until explicit original-ID
stop/removal. Only a hardcoded trusted Node program runs; the request is data, never
evaluated source. These deliberately smaller fixture containers do not certify
the production cgroup-v1/MAC/runtime configuration. No daemon socket is mounted
inside them. Label/image ownership is verified before every test cleanup.

Earlier outer-lifecycle batch verification: 137 unit/transport checks, 172 disposable database/queue/HTTP/
clock checks, 90 Linux/container checks (20 launcher/checkpoint/PID-1, 15 native
phase/filter, 52 workspace/quota and three Docker lifecycle checks), four Python
clock tests, type checks and build passed without skips. The container tests use
25 owned containers across four harnesses and one owned durable test volume;
all were removed after ownership checks. No cloud resources, persistent
development database, architecture, historical lab evidence or Git history changed.

## Host Resource Preparation

`host-resources.ts` supplies the mandatory `CapsuleResources` lifecycle boundary.
The outer backend requires it explicitly: preparation precedes Docker create,
read-only verification precedes the durable source-start receipt, and owned
resource retirement follows original-ID container removal. Verdict recovery calls
none of these hooks. Test-only authorities are explicitly synthetic and cannot
establish real host readiness or capacity release.

`host-cgroups.ts` requires the original boot, real writable v1 controller mounts
with canonical root topology, root ownership and original mount/inode identities.
It includes **all** mounted v1 hierarchies, not just budget controllers. It creates
fresh per-attempt parents, `docker` children on every hierarchy and `jobs` children
only for memory and combined CPU/accounting. Parent limits are 1,536 MiB memory
and memory+swap, 75,000/100,000 CPU quota/period and 128 tasks. Hierarchical memory
accounting must already be enabled; no host-root controller settings are changed.
Cpuset children receive the checked original root CPU/node masks before launch.
Limits are read back, and pre-start checks require empty groups and pristine
counters. No counter reset, task migration or old-parent adoption is performed.
See the kernel's [memory controller](https://www.kernel.org/doc/Documentation/cgroup-v1/memory.txt)
and [cpuset](https://www.kernel.org/doc/Documentation/cgroup-v1/cpusets.txt) references.
Real-kernel verification remains necessary; documentation is not test evidence.

`capsule-configuration.ts` produces the exact configuration accepted by the
private CLI for the original attempt/owner/provider/payload hash, boot, five
runtimes and eight executable hashes. It contains no source/stdin or expected
answers. A fresh nonce directory under the fixed protected
`/var/lib/ingenium/judge-executor/capsules` root is mode 0700; its immutable
`capsule.json` is mode 0400. File/directory fsync, ext4/XFS, original inode checks,
no symlinks and exact bytes are required. The trusted installer must establish
that root beforehand. Per-file size/headroom checks do not replace aggregate
host storage reservations, which remain an activation gate.

The capsule journal adds bounded 32-KiB `resource_intent` and `resources` records;
ordinary receipts keep their 4-KiB ceiling. Intent precedes configuration/group
creation, and the completed manifest binds every original resource identity.
An interrupted setup without a complete manifest stays held for inspection.
It is not automatically adopted, reset, recreated or cleaned by guessed paths.

After matching stopped/removal/removed container receipts, retirement verifies
the original boot and whole topology, journals `resource_remove`, and removes
only recorded **empty** docker/jobs/parent directories and the exact known
configuration. A recorded empty `jobs/box-0` can now be removed using the phase
identities below. Unrecorded/replaced Isolate groups, Docker child groups, unknown
files or tasks are refused, even when a child appears empty. No recursive delete
or process killing is used. Same-boot partial deletion can continue against the original manifest;
missing resources are accepted only within that already authorised removal.
An immutable `resource_removed` receipt is saved after successful removal.

That receipt is **not a full drain proof**. Real v1 creation/read-back/removal,
interrupted-child verification and cross-boot recovery, namespace/workspace
retirement, verified image/AppArmor/seccomp installation, host readiness/clock, concurrent UID/process
fairness and realistic capacity/security/load tests remain required. No production
startup enables this code. Do not run or modify the historical cloud lab to make
these tests pass.

Local checks exercise actual durable configuration files and interruption-safe
file removal, strict synthetic topology/config decoding, lifecycle ordering and
failure holds, and real refusal of local cgroup v2 **before any resource write**.
No positive kernel cgroup-v1 mutation/removal was tested locally.

Earlier host-resource batch verification: 146 unit/transport checks, 172 disposable database/queue/HTTP/
clock checks, 96 Linux/container checks (26 launcher/checkpoint/config/PID-1,
15 native phase/filter, 52 workspace/quota and three Docker lifecycle checks),
four Python clock tests, type checks and build passed without skips. The owned
container/volume harnesses clean up after ownership verification. No native v1
host, cloud resource, persistent development database, architecture, historical
lab state or Git history was modified.

## Interrupted Phase Recovery

`phase-resources.ts` defines four bounded 4-KiB write-once capsule records:
`compile_init`, `compile_groups`, `run_init` and `run_groups`. Before Isolate
`--init`, the producer durably saves the original epoch/attempt, boot, full
container ID, private parent and fresh phase nonce. After preparation, the
accounting observer verifies the original empty groups and zero counters, then
returns the device/inode identities of its pinned memory and CPU group handles.
Their immutable record binds the phase-init digest and is saved **before the
compiler or program is launched**. No source/input/output is stored here.

Recovery validates every saved binding. A compiled run requires the earlier
compiler group record. Most importantly, a newer run-init intent supersedes the
compiler's old `box-0` identity even if a crash left no run-group record. Missing
identities are not reconstructed by matching a path. Partial setup with unknown
remaining groups stays held; recovery never restarts Isolate or target code.

Only after the original capsule is verified stopped/removed may the same-boot
host authority remove a remaining `jobs/box-0`. It requires the recorded device/
inode, original protected parent, empty `tasks` and `cgroup.procs`, no nested
directories/symlinks and a final identity recheck before plain `rmdir`. All other
unexpected descendants remain refused. Interrupted partial deletion can resume
against the original manifest without recreating any resource or resetting a
consumed execution permit. This is not complete namespace/workspace/drain proof.

Local tests kill a real synthetic controller after saving these records and
verify immutable recovery without another allocation. Their inode values are
explicitly synthetic. Real Docker tests independently stop/remove the original
container containing a fixed detached trusted Node child after attach abort.
Neither fixture certifies native cgroup-v1 mutation/removal, all namespace/mount
retirement, concurrent UID-scoped process fairness or the event's runtime image.
Those still require VM/security/recovery/load verification. No positive drain or
default judging activation is added. Installation must pin a fresh reviewed
release/image; do not upgrade saved host epochs or retrofit historical lab state.

Earlier phase-recovery batch verification: 156 unit/transport tests, 172 disposable database/
queue/HTTP/clock checks, 99 Linux/container checks (28 launcher/checkpoint/config/
PID-1, 15 native phase/filter, 52 workspace/quota and four Docker lifecycle),
four Python clock tests, type checks and build passed without skips. The
production dependency audit reports no vulnerabilities. All owned harness
containers and the durable test volume were removed after ownership checks.
No live host, cloud resource, persistent development database, architecture,
historical lab evidence or Git history changed.

## Temporary Storage References

`capsule-storage.ts` captures the four original private tmpfs mounts before any
workspace write or target execution. Their fixed checkpoint keys `m0`..`m3`
follow `CAPSULE_TMPFS` order: workspace, control, Isolate state and `/tmp`.
The mode-0400, write-once 4-KiB `storage` record binds epoch/attempt, boot and
the digest of the original container/parent/namespace identity. Paths are never
accepted from a caller. Capture checks real tmpfs directories, root ownership,
distinct devices, mount-table stability and original namespaces. Mount IDs alone
are not global identities: Linux may reuse them, so device identity is retained
as well. See [proc mountinfo](https://man7.org/linux/man-pages/man5/proc_pid_mountinfo.5.html).

`capsule-residue.ts` is a read-only Linux observation used before the existing
`resource_removed` receipt. For a physically bound capsule, missing/invalid
storage is refused before any resource deletion. After verified Docker removal
and owned group/config removal, the observer checks the current boot and opens
real proc directories by pinned handles. It examines visible per-thread cgroups,
PID/mount/network/IPC namespace identities, mount tables and filesystem/namespace
references through cwd, root, executable and open FDs. The filesystem device, not
the displayed filename, catches renamed or deleted-but-open temporary files.
It never opens file contents, evaluates source, signals processes or deletes
anything. [Proc FD access](https://man7.org/linux/man-pages/man5/proc_pid_fd.5.html)
depends on ptrace access checks; an access error is refusal, not evidence of absence.

Inspection has explicit 16,384-process, 32,768-thread and 131,072-FD ceilings,
bounded per-file reads and cancellation/five-second elapsed checks between I/O
operations. Exceeding these limits holds the reservation; they do not kill or
drop a participant job. Vanished original proc entries are not rebound to a
reused numeric PID. Missing storage, boot drift, unreadable state or any remaining
original reference prevents the cleanup receipt. No counter/permit is reset.

This is **not a complete drain authority**. A proc scan cannot certify its own
full-host visibility, immutable installation, absence of escaped/unobserved
references or irreversible no-future-start protection. Those are trusted host
installation/containment and retirement gates, not caller flags. No positive
drain, registry slot release, public cleanup endpoint or default judging activation
is added. New reviewed release/image pins are required; do not retrofit old host
epochs or rerun historical controllers to supply missing records.

`npm run test:judge:storage` uses one owned bounded container with no network,
capabilities, writable image, Docker socket, secrets or submitted execution.
It verifies four real tmpfs devices, real namespace/mount refusal, bounded task/FD
inspection, an open namespace descriptor and cancellation/boot/record failures.
Its passing mechanical scan uses explicitly synthetic unmatched identities, not
proof that an actual host or general execution capsule has been drained.
The durable checkpoint test separately kills a synthetic controller after saving
storage and verifies immutable recovery without rerun/result/drain invention.

Earlier storage-reference verification: 166 unit/transport tests, 172 disposable service checks,
106 Linux/container checks (29 launcher/checkpoint/config/PID-1, 15 native phase,
52 workspace, four Docker lifecycle and six storage/proc), four Python clock
tests and type/build checks passed without skips. The production dependency audit
reports no vulnerabilities. An existing short-window quota fixture failed under
concurrent Docker contention and passed the complete isolated rerun; its timing
sensitivity is recorded in the build checklist, not hidden by changed limits.
All owned test containers/volume were removed after ownership checks. No cloud,
persistent development database, historical lab, architecture or Git mutation.

## Installation Integrity

`host-installation.ts` adds a read-only release-tree check, **not a production
installer, readiness/retirement authority or host certification**. The caller
supplies a trusted `CapsuleRelease` pin and an untrusted-to-be-checked manifest.
The strict version-3 manifest binds `image_id`, `daemon_sha256`,
`image_config_sha256` and a sorted `files` array; each
row contains only relative `path`, integer `size`, mode `0444`/`0555` and SHA-256.
The release digest is SHA-256 of the normalized manifest's JSON with that fixed
field order (`version`, `image_id`, `daemon_sha256`, `image_config_sha256`, `files`).
Versions 1/2 are refused; existing releases/checkpoints are not migrated or repinned.
This array format deliberately is not the array-free judge wire
format. Missing required artifacts, duplicate/unsorted paths, file/directory
collisions, traversal, extra fields or invalid bounds fail before any host access.
The limits are 32,768 files/directories, 256 MiB per file, 512 MiB total file
bytes and 512-byte relative paths. Empty non-required dependency files are allowed.

The fixed root is `/opt/ingenium/judge-executor`, on ext4/XFS with protected root
ancestors. Every installed directory must be root:root mode 0555, every regular
file root:root with one link and its manifest mode/size/hash. Exact tree listings
exclude unlisted/empty directories or files. Directory traversal uses protected
open descriptors without following child symlinks and with bounded simultaneous
descriptors. Metadata and directory membership are checked again after hashing.
No file is rewritten, installed, removed or repaired by verification.

Required paths are `launch`, `node`, `docker`, `dockerd`, `peer-exec`, `app/judge/capsule-cli.js`,
`docker-client/config.json` and `security/{apparmor,isolate,seccomp.json}`.
`node`, `docker`, `dockerd` and `peer-exec` must be reviewed ELF files, not wrapper scripts. Isolate
configuration must match the existing fixed contract. Docker client configuration
must be exactly `{}\n`, with no additional client files. This avoids ambient
contexts/credential helpers/proxy options from Docker's configurable client;
see [Docker CLI configuration](https://docs.docker.com/reference/cli/docker/).
The candidate AppArmor file and seccomp bytes are only hash-checked; these checks
do not demonstrate that a kernel loaded or enforced either policy.

`openHostInstallation` pins the original verified Docker CLI, daemon and native
wrapper open inodes and requires the
canonical `/run/docker.sock` to be a root:root mode-0600 Unix socket with one link;
the existing adapter still names `unix:///var/run/docker.sock` and the fixed
client directory. Group-writable standard Docker installations fail this policy;
the verifier never changes their permissions. Socket identity is checked around
each command. Pinned reported-state checks also surround every returned-driver command.
The returned `driver(prepared)` retains the separate mandatory
trusted preparation callback for image/daemon/MAC/cgroups/genuine readiness and
checks the release before/after that callback on create/start. `close` rejects
while verification/transport is active, then permanently invalidates old drivers.

`docker-host.ts` performs only read-only `info`, `image inspect` by full immutable
ID and another `info`; a changed report before/after inspection is refused.
The daemon digest normalizes the reported ID/name, engine/kernel, fixed root,
supported overlay storage, cgroup configuration, security options, runtime
configuration and component commit IDs. Dynamic workload counts are excluded.
It requires Linux/x86-64, cgroup-v1/cgroupfs, runc, reported memory/combined-swap/
CPU/PID support, AppArmor and builtin seccomp, inactive Swarm, no live restore,
experimental mode, extra runtime/security modes or warnings. Unsupported reports
fail before image inspection. See [Docker system information](https://docs.docker.com/reference/cli/docker/system/info/).

The image digest binds its ID, Linux/amd64 platform, complete configuration and
ordered rootfs layer list; inherited anonymous volumes are refused. Every config
field, including environment/entrypoint/commands/health checks and unknown future
fields, is hashed with recursively sorted object keys and preserved array order.
The `image_config_sha256` pin covers this complete normalized image report, not
only its `Config` member. Reports are bounded to 2 MiB, strict UTF-8 and supported
JSON types/depth/width. Unsupported shapes, invalid pins, cancellation, transport
failure or mismatches stop the check; no retry, pull, mutation or auto-enrolment
occurs. See [Docker image inspection](https://docs.docker.com/reference/cli/docker/image/inspect/).

These are **reported configuration pins**, not proofs of installed runtime binaries/image contents,
loaded AppArmor/seccomp rules, an initial host namespace or genuine readiness.
An image's expected configuration must still be independently reviewed; computing
a digest from an observed image is not a security review. Stable report digests
are not kernel observations and cannot serve as a retirement authority. The
separate native host preparation dependency is still required; normal startup
does not construct or enable any authority.

Root protection and matching bytes are not full immutability, a proof of initial
host namespace/proc visibility, a verified daemon endpoint, dependency closure
outside this tree, or no-future-start. The trusted installer, OS/runtime dependency
review, real image/loaded-policy checks, full-host authority and positive VM
verification remain required. No existing release pins are silently repurposed.
Full-tree hashing cost must be included in actual runtime/capacity calibration;
no event throughput has been established. The normal app still constructs none
of these production powers.

### Native Socket Peer Wrapper

Every installation-backed Docker CLI invocation goes through the static
`native/docker-peer-exec.c` helper. The existing bounded transport passes the three
reviewed executable descriptors as FDs 3 (helper), 4 (CLI), and 5 (daemon); no ambient
executable lookup is used. The helper fixes the local endpoint/client directory,
allows only the existing lifecycle and read-only inspection commands, and refuses
caller endpoint/context/config overrides. All three files must remain root:root
0555, single-linked, with no file capability xattr.

The helper connects to `/run/docker.sock` and obtains the socket's root peer
credentials and `SO_PEERPIDFD` directly from the kernel. The real procfs process
directory and original executable inode must match the reviewed daemon FD. The
peer must have all real/effective/saved/filesystem UIDs/GIDs zero and share the
helper's user/PID/mount/network/IPC namespaces. Socket identity, peer liveness,
executable metadata and these credentials/namespaces are checked while the CLI
runs and again before accepting its output. A numeric PID is used only to open
procfs while the directly acquired PIDFD guards liveness; `pidfd_open` is not a
fallback. Unsupported headers/kernel/socket facilities fail closed.
See [Unix socket credentials](https://man7.org/linux/man-pages/man7/unix.7.html)
and [Linux socket option definitions](https://github.com/torvalds/linux/blob/v6.8/include/uapi/asm-generic/socket.h).

The helper's only child is the trusted CLI, executed through FD 4 with a fixed
minimal environment. Parent-death signals and a checked parent identity stop that
child if the wrapper dies; command failure, cancellation, peer death/re-exec or
the 85-second helper deadline never signals the daemon or retries a mutation.
Outer transport bounds remain in force, and rejected output does not become a
verdict, full drain or released reservation. Capability-bearing/set-ID executables
are refused because an exec can otherwise change parent-death behaviour.
See [parent-death semantics](https://man7.org/linux/man-pages/man2/PR_SET_PDEATHSIG.2const.html).

Socket-activated/proxy listeners whose recorded peer executable is not the pinned
daemon are deliberately unsupported. This observes the kernel-recorded listener,
not universal proof of every acceptor if a listener delegates a socket. Namespace
equality is relative to the caller and does not certify initial host namespaces or
complete proc visibility. A reviewed fresh installation must run the exact pinned
daemon copy and static helper; the verifier never replaces, restarts, chmods or
reconfigures the real Docker service. Actual service control, OS/dependency/image
review, loaded policies, genuine readiness, full-host retirement authority and
positive VM rehearsal remain separate gates. No candidate AppArmor policy was
loaded or parser-certified by these checks.

`npm run test:judge:installation` uses an owned disposable ext4 volume and the
cached pinned Node image with no network, capabilities or host Docker socket.
Seventeen native checks use a synthetic release and fixed C daemon/CLI fixtures, real regular
files/links/permissions and a synthetic Unix listener. They cover hash/mode and
tree tampering, linked artifacts, immutable release binding, cancellation,
required preparation, descriptor closure/reuse, equal-byte executable replacement
and socket replacement, changed report refusal and failed metadata descriptor
cleanup, including an uncertain post-create report failure without a command
retry. They also cover all three equal-byte executable replacements, wrong peer
executable, peer exit/re-exec, forbidden endpoint overrides and cancellation that
stops the owned CLI without killing the peer. Two more read-only checks reject the actual local daemon against
synthetic approved pins and decode the cached real image's configuration without
executing it. Twenty rapid fixed empty-result queries exercise the
transport's empty-stdin close without a zero-byte write. These are integrity and
transport tests only, not a live daemon, sandbox, host or launch certificate.

Current verification: 200 unit/transport tests, 174 disposable service checks,
128 Linux/Docker checks (31 launcher/checkpoint/config/PID-1, 15 native phase,
52 workspace, five Docker lifecycle, six storage/proc, seventeen installation and
two real read-only metadata checks), plus four Python clock tests passed without
skips. Type checks/build passed and the production dependency audit reports no
vulnerabilities. All owned test containers/volumes were removed after ownership
checks. No cloud, persistent development database, historical lab, architecture
or Git mutation occurred; production host certification remains required.

Earlier installation-integrity verification: 190 unit/transport tests, 174 disposable service checks,
119 Linux/container checks (31 launcher/checkpoint/config/PID-1, 15 native phase,
52 workspace, five Docker lifecycle, six storage/proc and ten installation) plus
four Python clock tests passed without skips. Type checks/build passed and the
production dependency audit reports no vulnerabilities. All fixtures remain
owned/disposable; no real VM, cloud, production installation or historical lab
state was changed or certified.

## Authority-Gated Release

`capsule-retirement.ts` implements certificate persistence and the existing
drain/result handoff, **not the production full-host verifier**.
`TrustedHostRetirementAuthority` is a separate internal read-only dependency
bound to the original epoch, boot and immutable release. No current production
installer or normal runtime constructs that authority. A browser field, cached
health response, resource receipt or the earlier proc scan cannot replace it.
Matching digests alone authenticate neither a host nor a caller; never wire a
constant/random-digest test stub into production.

Before requesting proof, the handoff validates the reviewed plan, original
physical capsule, start/stopped/removal receipts, matching resource-manifest
digests, latest phase groups, storage and a real saved result. Its frozen request
contains only original identifiers and plan/context/result digests plus a nonce,
not source/input/output or expected answers. The authority must independently
load the bound records and prove complete host visibility/containment, no future
launch, stopped original processes and removed owned storage/groups. That native
implementation and its real-host verification are still required.

The Docker adapter independently checks absence of both full original ID and
exact name, before and after the new host probe. Name-only absence is not
enough: a renamed retained original must refuse removal reconciliation. The
queries use separate `id` and `name` filters with `--all --no-trunc`, not an AND
filter which could hide a renamed object. See [Docker container listing](https://docs.docker.com/reference/cli/docker/container/ls/).

The response must bind the exact request digest and a bounded observation digest.
Changed records during the probe are refused. The write-once 4-KiB `retirement`
certificate is persisted **before** the existing append-only `drain.json` file.
Its digest becomes the existing protocol's proof identifier; original result
bytes/accounting never change. A lost acknowledgement or interrupted final save
recovers that same complete certificate without re-probing or rerunning source.
Competing issuers cannot overwrite it or reset a consumed launch permission.
This recovery is not fresh admission readiness or automatic host-epoch retirement.

`createCapsuleBackend` may receive this separate trusted authority. Without it,
existing behavior stays fail-closed: cleanup can finish while the result remains
undrained. With it, normal completion or explicit maintenance retirement may
persist the certified extension. Read-only `recover` still reads checkpoints
only; it never invokes the authority, Docker or cleanup. No saved result means
no fabricated verdict/proof; unknown execution disposition and cross-boot host
fencing remain separate work. No public endpoint or default activation is added.

The guarded launcher and existing supervisor seal recover the resulting proof
into PostgreSQL. Integration tests fill both physical slots, keep a third attempt
pending, then use the synthetic-authority certificate path to free only its
original slot. Repeated recovery does not free another hold, change retained-byte
accounting or authorise a new launch of the old attempt. Lost PostgreSQL commit
acknowledgement resolves from the same persisted result/proof.

Unit and durable Linux tests use explicitly synthetic host observations. They
verify wrong identity/challenge, missing/conflicting records, cancellation,
competing certificates, a killed controller after certificate persistence, lost
drain acknowledgement, immutable result bytes and recovery without another probe.
A real Docker test renames one owned stopped trusted fixture and confirms its
still-present full ID prevents a false removal receipt. These are protocol and
lifecycle checks, not proof of production sandbox drain or permission to launch.

Earlier retirement-handoff verification: 182 unit/transport tests, 174 disposable service checks,
109 Linux/container checks (31 launcher/checkpoint/config/PID-1, 15 native phase,
52 workspace, five Docker lifecycle and six storage/proc), four Python clock
tests and type/build checks passed without skips. The production dependency audit
reports no vulnerabilities. The asynchronous backend guard stays held through
certificate persistence. The new PostgreSQL tests preserve the earlier unknown
held attempt rather than clearing it for capacity. All owned test containers and
the durable volume were removed after ownership checks. No cloud, persistent
development database, architecture, historical lab or Git mutation occurred.

## Implemented Flow

`apps/api/src/judge/execution-worker.ts` connects the guarded Redis receiver,
judge registry and `TrustedProtectedExecutor` boundary:

1. Check the executor's immutable epoch, boot and five runtime bindings. A fresh
   turn requires launcher preflight before requesting a launch permission. This
   does not grant the registry's separate readiness lease or bypass its gates.
2. Claim one delivery through PostgreSQL. Only a newly committed claim returns
   the payload. Empty, duplicate or physically held deliveries do not call EXECUTE.
3. Send the frozen source/input/limits, captured permit owner and provider token,
   with a fresh request UUID. No expected answer, shell command, option override,
   filename, credential or browser-selected destination enters this message.
4. Check the entire bound reply and the existing strict phase/capture evidence
   decoder before sealing. The backend checker, not a launcher success label,
   still decides acceptance. Unexpected diagnostics, transport errors and missing
   output never become a participant verdict or positive cleanup proof.
5. A lost reply, cancellation or process failure never causes an automatic second
   EXECUTE. Its consumed permit and potential physical reservation remain held.
   A worker refuses overlapping turns; another process cannot reclaim the permit.

The judge-only `003_execution_lookup.sql` follows migrations 001 and 002. It adds
one supervisor-only read function for the immutable owner/payload/provider/result
of an already consumed permit. It cannot reset, transfer or consume a permit and
is unavailable to the gateway/publisher roles. No migration is run automatically
or applied to an existing database by this batch.

## Recovery

`recover(attemptId)` reads the original claim; it never obtains a new permission.
Unknown/unclaimed attempts return NO_EXECUTION. Already sealed and drained results
return SEALED without a launcher call. Otherwise it requests only RECOVER, without
new-execution readiness, and validates retained evidence against the original
owner, payload and token before sealing. A missing checkpoint returns
RECOVERY_REQUIRED and retains capacity. Later positive cleanup must preserve the
sealed result; it cannot change bytes, attribution or accounting.

If database sealing committed but its acknowledgement was lost, the next lookup
can resolve that result without even reading a launcher checkpoint. If the result
never reached PostgreSQL, recovery can read its protected disk result checkpoint.
The actual kernel producer and physical resource checkpoint are still required; the application does not
invent a result, reset a permission or rerun code to fill missing evidence.

A trusted completed result may be sealed after caller cancellation: recording
already completed evidence is reconciliation, not another execution. Killing a
launcher process, receiving EOF or exceeding a transport deadline is never proof
that its sandbox descendants/workspace are gone.

## Fixed Linux Client

`createProtectedExecutorClient` requires Linux/root, an exact launcher SHA-256,
immutable boot/epoch and five runtime bindings. It accepts no configurable shell,
executable path or environment override. The only executable is
`/opt/ingenium/judge-executor/launch`:

- The launcher must be a regular root-owned mode-0555 file, at most 1 MiB, with
  the configured hash. Its canonical path and root-owned non-writable ancestor
  directories are checked. Symlinks, writable parents and changed files fail.
- The client opens with O_NOFOLLOW, verifies the open file, then passes that
  descriptor as child FD 3 and executes `/proc/self/fd/3`. There is no fallback
  to a separately reopened path. The launcher must be standalone or load only
  separately reviewed absolute installed dependencies, not relative paths based
  on its descriptor filename. The complete installation still needs immutable
  runtime/image/dependency verification, not just this one file hash.
- READY and EXECUTE require the current Linux boot UUID. RECOVER may read an
  original boot's retained evidence but cannot grant readiness or a new launch.
- Arguments are only `--ready`, `--execute` or `--recover`; shell execution is off.
  The child receives a fixed minimal environment, not PostgreSQL credentials,
  Node startup options or the parent's application environment.
- Input and stdout are bounded at 2 MiB, diagnostics at 16 KiB, with a 90-second
  total process deadline and caller cancellation. Nonzero exit, unexpected
  stderr, overflow or invalid canonical JSON fail closed. No diagnostic contents
  are included in the error. A timeout stops the launcher, not a proven sandbox
  tree; its reservation remains uncertain.

Descriptor inheritance uses Node's `spawn` stdio mapping. Linux documents the
[open descriptor filesystem](https://man7.org/linux/man-pages/man5/proc_pid_fd.5.html).
Local Linux tests exercise the actual descriptor dispatch, not a mocked pathname.

## General Launcher Core

`apps/api/src/judge/launcher.ts` implements strict READY/EXECUTE/RECOVER dispatch
against the original PostgreSQL owner, provider token and immutable payload. It
never trusts a second valid-but-different payload merely because its digest is
self-consistent. Unknown fields, modes, runtimes and bindings fail before start.

There are two distinct durable decisions: the worker claims a physical slot;
the launcher then consumes `begin_launch` immediately before the kernel backend
call. `004_launch_gate.sql` adds this once-only `launch_started_at` record and
prevents evidence from being sealed before it. The start cannot be cleared or
retimed. A lost commit acknowledgement holds the original reservation and never
authorises another call. No database transaction is held over the backend call.
This uses the existing judge PostgreSQL database, not another queue or database.

Migration 004 requires an empty general registry. Apply all four judge migrations
before provisioning a new host or admitting work. It refuses existing attempt
history; never delete rows, reset permits or modify the old lab to make it apply.
Old installations without the launch-gate schema cannot use the new execution
lookup. No migration is run automatically or against persistent data here.

The launcher snapshots and validates backend evidence, commits the sealed result
before sending its reply, and can return that same result with a fresh challenge
after a lost reply or expired readiness. Recovery never calls the execute method.
Missing checkpoints and invalid evidence retain uncertainty. Later cleanup can
only extend the same result, not rewrite its bytes/accounting.

`execution-plan.ts` supplies fixed C17, C++17, Java 21, Python 3.14 and Node 24
source names/argv, explicit compiler and run budgets, fixed environment and
isolation/output/workspace requirements. Source/stdin bytes are copied and never
interpolated into argv. Interpreter jobs have no compilation stage; compilation
witnesses have no run stage. Java requires retaining the full compiled workspace,
not only Main.class, so nested/package-generated classes are not silently lost.

`EXECUTION_PLAN_SHA256` identifies these command/restriction settings. A backend
with a different plan hash cannot attach. This is not an image/security attestation:
the actual backend must still verify pinned compiler/interpreter binaries, runtime
digests, kernel protections and genuinely observed evidence. The plan describes
required Linux enforcement; constructing it does not enforce those restrictions.

## Protected Result Checkpoints

`checkpoints.ts` stores result evidence under the fixed
`/var/lib/ingenium/judge-executor/checkpoints` directory. `checkpoint-backend.ts`
connects it to the existing kernel-backend contract; it is not a second executor,
queue, database or permission source. The real backend is still required.

- Opening requires Linux/root and an existing canonical root:root mode-0700
  store, with root-owned non-writable ancestors. File operations use the opened
  directory descriptors. No path, root or output filename comes from a request.
- Fresh execution additionally requires the original current boot, local ext4/XFS,
  available bytes/inodes and a successful directory sync. It rejects tmpfs,
  overlay and network filesystems. This storage check cannot mint registry or
  sandbox readiness. Actual backend preflight must still attest real protections.
- An exclusive per-attempt directory and synced binding record precede the
  backend call. The binding covers epoch, boot, attempt, owner, provider and the
  entire plan, including exact source/input hashes. It stores neither raw source
  nor input. Existing/partial receipts can never authorise another execution.
- Result bytes pass the same complete evidence decoder before retention, without
  depending on PostgreSQL. The file and parent directory are synced before
  returning. A hard-link publish cannot overwrite an original final record;
  private pending writes are not returned as completed results. Final files are
  root:root mode 0400, opened without following symlinks, and read with byte bounds.
- Result evidence and positive drain are separate immutable files. Late cleanup
  may append proof for the exact original result, but cannot rewrite bytes,
  attribution, accounting or an existing proof. Both records carry the original
  binding/result digests, so cross-attempt file copies and corrupted counters are
  rejected even when source/output match. The 2 MiB protocol bound also
  bounds a result file; binding/drain files have smaller explicit bounds.
- Complete disk recovery needs no backend call or fresh readiness. Incomplete
  executions can ask only the backend's non-executing retained-evidence reader.
  If that reader fails, an already stored partial result remains available without
  a drain claim. No result, corrupt data or interrupted write keeps uncertainty
  held; it never becomes a verdict or cleanup proof. Completed evidence is saved
  even after caller cancellation, because that does not launch source again.

The [Linux fsync contract](https://man7.org/linux/man-pages/man2/fsync.2.html)
requires syncing the containing directory too; [link does not replace an existing
destination](https://man7.org/linux/man-pages/man2/link.2.html). These are file-system
mechanisms, not evidence that a particular cloud disk survived a power loss.

The installer still must provision bounded persistent storage, a hard volume
quota, monitoring, retention/retirement and recovery of incomplete writes. This
module checks per-record size and available space, **not an aggregate disk quota**.
It does not save/verify native process, cgroup or workspace identities or prove
their cleanup. The per-capsule backend now saves an additional once-only
`physical.json` binding: original container ID, private cgroup parent and capsule
PID/mount/network/IPC namespace identities, bound to the same plan/boot/owner.
This survives producer failure and cannot be rebound or copied between attempts.
It does not authorise guessing PID ownership or claiming physical retirement.
No production path was installed here.

## Launcher Wire Contract

Input/output is one canonical ASCII JSON object, with no newline/framing extras,
using `ingenium-executor-v1`. No array, duplicate key, unknown field, alternate
Base64 or invalid UTF-8 is accepted. The implementation reuses `judgeJson` and the
strict authoring protocol rather than adding another source representation.

READY requests contain `protocol`, `operation`, `request_id`, `host_epoch_id`,
`boot_id` and `runtimes`. The response echoes those exact bindings plus `ready`
and a 64-hex `proof_digest`. This must attest real sandbox/runtime checks, not a
constant marker. A genuine health/clock/boot verifier and readiness-renewal
service are not implemented by this handoff.

EXECUTE/RECOVER requests contain `protocol`, `operation`, `request_id`,
`host_epoch_id`, `boot_id`, `permit_owner`, `provider_token` and `payload`. The
payload is the existing full frozen authoring request with the same request UUID.
The response echoes protocol/operation/request/epoch/boot/owner plus `reply`:
the strict FINISHED authoring response, matching provider token. Only RECOVER
may return a null reply, meaning no usable retained evidence, not physical drain.

## Native Phase Handoff

`infra/judge-gateway/native/phase-exec.c` is a small **statically linked** helper
for the inside of an already protected Isolate sandbox. It never drops a root
caller into a less privileged context: it refuses to run unless every real,
effective and saved UID/GID is 60000, supplementary groups are restricted, all
effective/permitted/inheritable/ambient capabilities are absent, no-new-privileges
is active and seccomp is in filter mode. Checking filter mode is not verification
of the actual filter rules. The host verifier must still check those rules.

It resets signal handling/masks, sets descriptor/core limits, selects `/box` as
the working directory and replaces the environment with the code-owned language
environment. Static linking matters here: an inherited dynamic-loader variable
must not execute code before those checks. The helper and all toolchains still
need immutable, verified installation, not just a file in a writable workspace.

The phase manager supplies separate output, manager diagnostics, witness and job
stderr channels. The helper accepts only writable anonymous pipes/unnamed local
stream sockets, keeps its witness separate from ordinary output, and makes **all**
descriptors above 2 close-on-exec, including pre-existing descriptors above the
new descriptor limit. After stderr redirection, programs inherit only stdin,
stdout and stderr, not the witness or any private control descriptor. A supported
Linux `close_range` is required; there is no weaker fallback that stops at 255.
Compiler stderr is duplicated onto the same protected stdout pipe, preserving
the actual write order in combined diagnostics. Run stdout/stderr remain separate.
See the [Linux close-range contract](https://man7.org/linux/man-pages/man2/close_range.2.html)
and [exec descriptor rules](https://man7.org/linux/man-pages/man2/execve.2.html).

The witness is one exact fresh 32-byte challenge record. Failed exec adds a
failure record, which is rejected. **A pre-exec witness alone is not proof that
the target ran**, runtime compatibility, complete-tree accounting, a participant
failure or physical cleanup. A kill between the witness and exec is still
uncertain. The collector emits observations only, never a verdict or drain proof.

`phase-pipes.ts` prepares fixed Isolate argv from a freshly reconstructed reviewed
execution plan, rejecting changed commands, source names, budgets or policy.
Inputs/outputs are pipes, not files that a program can replace. The workspace and
metadata paths are fixed inside a fresh dedicated private execution container;
source bytes and client options cannot become manager arguments. It does not run
`--init`, reset an old box or prepare/verify a container on its own.

The private capture primitive retains at most 1 MiB plus one stdout overflow byte,
64 KiB each of stderr/compiler diagnostics, 16 KiB manager diagnostics and 256
witness bytes. Output uses fixed-size buffers, not unbounded lists of chunks.
Excess diagnostic bytes are drained/discarded. On stdout overflow the read end is
closed and the overflow prefix retained; this does not prove the program stopped.
Exact EOF/process completion, a fixed total deadline and caller cancellation are
checked. A program ignoring stdin or closing output early cannot confuse transport
completion with program completion. Timeout/cancellation stops only the immediate
manager and **never releases capacity** or proves its descendants were stopped.

`capturePhaseProcess` is an internal primitive like the existing protected process
transport, not a command-execution endpoint. Only a separately verified kernel
backend chooses its actual process. The new per-capsule backend is that internal
caller, not a public command endpoint; no source runs outside Isolate as a fallback.
Host lifecycle, physical retirement and real installation/rehearsal remain required.

The helper now installs an additional x86-64 seccomp filter before its witness.
It blocks new namespaces, mounts, tracing/remote-memory access, new network
sockets and other privileged kernel interfaces. Namespace flags on legacy clone
are denied; clone3/io_uring return ENOSYS so supported libc/runtime code can use
its ordinary fallback. Normal fork and Node worker threads pass real native tests.
Alternate syscall ABIs cannot bypass the filter. This layers restrictions over
the outer filter rather than inheriting Isolate's namespace-setup permissions.
See the [Linux seccomp filtering contract](https://man7.org/linux/man-pages/man2/seccomp.2.html).

## Source Workspace And Accounting

`workspace.ts` is a root-only preparation step for a new private execution
container with no active sandbox. It reuses the same reviewed-plan reconstruction
as the Isolate command builder; source names, commands and quotas cannot come from
an option override. Preparation does not grant a launch or certify a container.

- `/run/ingenium/workspace` must be a dedicated empty executable tmpfs, with
  nosuid/nodev, exactly 64 MiB and 4,096 inodes. Its initial root:root mode is
  0755. Both available blocks and free inodes must be fresh. A directory inside
  another mount, a bind subtree, wrong quota or changed execution flags fails.
- `/run/ingenium/control` must be a distinct empty root:root mode-0700 tmpfs,
  noexec/nosuid/nodev, exactly 16 MiB and 256 inodes. The sandbox never receives
  a mapping to it. Mount IDs are read from pinned descriptors and matched against
  the actual mount table; directory/device/inode identity is retained too.
- An exclusively created private preparation receipt precedes source mutation.
  It binds the full frozen plan/source/input hashes and original mount identities.
  The source is written to one exclusive, no-follow file with exact bytes, then
  made root-owned mode-0444. The directory becomes UID/GID 60000 mode-0700, with
  permission changes performed before ownership transfer. A matching ready receipt
  follows successful preparation. No input, expected answer or secret file is
  written into the guest workspace.
- Before the first phase, verification checks original paths/inodes/mounts,
  ownership, flags, quotas, source bytes and both private receipts. Changed source
  buffers in the caller cannot change the prepared snapshot. Symlinks, links,
  replacement files, extra initial artifacts and altered receipts fail closed.
- The whole compiled directory remains available between compile and run,
  including nested/companion Java classes. First-phase verification is not reused
  after compilation. `close()` closes only controller descriptors; it does not
  delete workspaces or claim that their processes have stopped.

These are **volatile per-container receipts**, not durable physical checkpoints.
An interrupted, stale or competing preparation never resets or overwrites them.
The backend must prove the private container has no active/future job before
preparation/first-phase verification and separately retain physical identity on
persistent storage. Mount checks use the documented Linux
[mountinfo format](https://man7.org/linux/man-pages/man5/proc_pid_mountinfo.5.html)
and [tmpfs capacity controls](https://man7.org/linux/man-pages/man5/tmpfs.5.html).

`openPhaseAccounting` is a read-only observer of original cgroup-v1 job paths
`/run/ingenium/cgroups/memory/box-0` and `.../cpuacct/box-0`. It requires root-owned
non-writable ancestors, canonical directories and actual cgroup-v1 filesystem
magic; ordinary files and cgroup-v2 directories cannot supply positive evidence.
Directories are pinned and rechecked, with no child groups or symlinks accepted.
Counter pseudo-files are read with no-follow/nonblocking opens and a 4 KiB bound,
not their nominal on-disk size. The observer creates/resets/removes nothing.
`preparePhaseAccounting` additionally sets only the two reviewed memory caps on
new, empty, zero-counter groups after Isolate init; it never resets accounting.
Both RAM and memory+swap peaks are read, retaining their maximum as Isolate does.

The original memory and combined memory+swap limits must exactly match the
reviewed stage budget, with hierarchy enabled. Initial CPU, peak memory, failure
and OOM counters must be zero and both task lists empty. Later stopped snapshots
require those original empty groups, unchanged limits and nondecreasing counters.
Integer nanoseconds/bytes remain decimal strings, never floating point. Combined
memory-limit hits remain separate from memory-only hits; an OOM cannot be inferred
from a SIGKILL alone. See Linux's [hierarchical CPU accounting](https://www.kernel.org/doc/Documentation/cgroup-v1/cpuacct.txt)
and [legacy memory-controller interface](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html).

**Counters alone are observations only.** The separate active target observer now
checks an actual post-exec inode through pinned proc descriptors, original memory
and CPU task lists, all UID/GID values, no capabilities, protection/descriptor limits
and distinct PID/mount/network/IPC namespaces. A vanished process is not a positive
observation. This does not by itself prove whole-tree containment, all enforcement,
compiler blame, exit cause, no-future-launch or physical drain. Local tests exercise real
workspace mounts and refusal of fake groups, plus strict synthetic counter decoding;
they do not claim a successful cgroup-v1 enforcement or accounting test. The
actual delegated mounts and original job lifecycle still require VM verification.

## Per-Capsule Isolate Producer

`createIsolateBackend` is a backend for **one fresh private capsule**, not a Docker
provisioner, a primary-host service or a global readiness authority. It implements
the existing trusted backend contract. Do not wrap it in `createCheckpointedBackend`
again: it already begins/saves through that same protected checkpoint store.

1. Revalidate the original epoch/runtime/source plan. Verify Linux PID 1, boot,
   procfs, exact root capability set, no-new-privileges, filter presence and the
   enforced `ingenium-isolate-executor-v1` AppArmor profile. Check a read-only
   image with no injected toolchain submounts, loopback-only networking, immutable
   executable hashes, exact Isolate config and empty source/control mounts.
2. Check the original cgroupfs container identity below a unique private parent,
   read-only parent controller mounts and delegated jobs subtrees. Required parent
   bounds are 1,536 MiB RAM+swap total, 0.75 CPU and 128 tasks, with no memory/OOM/
   PID-limit failures. This is not permission to share or reuse an old lab parent.
3. Persist the permanent execution start and physical capsule identity before
   source preparation. Prepare the source once and verify it before the first
   phase. A source-buffer mutation cannot change this frozen execution.
4. For each needed phase, exclusively retain its start/metadata files, refuse
   existing Isolate state, initialise new groups and set their memory caps.
   Execute only the reviewed argv through the native helper and bounded pipes.
   Poll actual target identity; retain exact bytes and original kernel counters.
5. Require strict metadata/control/manager-diagnostic agreement, CPU-millisecond
   and peak-memory agreement with the kernel, stopped original groups and clean
   parent limits. Only then remove that phase's original Isolate state. The
   external compiled workspace, including all Java companions, stays intact.
6. Skip run after compiler failure; skip it for compilation-only checks. Pass the
   assembled bound evidence through the original strict decoder and save it before
   reply. Expected answers remain in the application's frozen checker, not here.

Isolate's [pinned cgroup implementation](https://raw.githubusercontent.com/ioi/isolate/ad39cc4/cg.c)
sets/resets job counters during entry. The producer must prepare before launch and
collect before cleanup; it does not treat init as a completed resource test.
The controller needs SYS_PTRACE only for proc inode/identity reads across the UID
change; the candidate AppArmor policy permits read, not attachment/tracing. Guest
processes have no capabilities and their added filter denies ptrace entirely.

The source-error path is deliberately conservative: C/C++ use complete GCC JSON
source diagnostics plus `-pass-exit-codes`; Java uses reviewed source diagnostic
codes. A checked normal compiler exit 1, original source location, intact capture,
clean resource counters and available storage are required. Internal/tool/IO,
truncated, linker-only and otherwise unrecognised failures remain infrastructure
uncertainty, never guessed participant blame. More attribution cases need their
own runtime tests. See [GCC phase exit codes](https://gcc.gnu.org/onlinedocs/gcc/Overall-Options.html#index-pass-exit-codes)
and [OpenJDK compiler result categories](https://raw.githubusercontent.com/openjdk/jdk21u/master/src/jdk.compiler/share/classes/com/sun/tools/javac/main/Main.java).

A verified full native witness plus a consistent normal target exit distinguishes
the target from helper setup/exec failure. Signals and forced termination additionally
need an observed post-exec inode; the pre-exec marker alone is insufficient. CPU,
wall and memory failures need corroborating counters; wall timeout also needs the
controller's monotonic elapsed budget. Unsupported or ambiguous evidence is held.

`capsule-cli.ts` is the private one-request entry point, not an HTTP route. Its
mode-0400 root configuration is fixed at `/opt/ingenium/judge-executor/capsule.json`
and binds schema/policy, epoch/boot, original attempt/owner/provider/payload digest,
five runtimes and eight fixed executable hashes. Only EXECUTE/RECOVER canonical
requests with those original bindings are accepted. No shell, configurable path,
callback, compiler override or browser credential enters this file format.

The CLI must be the capsule's PID 1. It has a fixed input buffer, total 80-second
exit deadline, bounded protocol output and private generic errors. It exits after
reply or failure, not just after killing the immediate Isolate manager. Linux
[terminates descendants when namespace init exits](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html).
The host still must verify physical retirement before releasing capacity; no result
from this backend invents a positive drain. Recovery reads retained disk evidence,
even without native readiness, and never initialises, compiles or launches a phase.

`ingenium-isolate-executor.apparmor` is an **unloaded candidate**, not a certified
production policy. It allows the controller's anonymous Unix stream pipes and
Isolate mount setup; it does not grant IP networking. Actual filter/profile
fingerprints, image/dependency provenance, a protected outer capsule lifecycle,
hard storage quota and clock/host readiness remain installer obligations. The
profile/parser and real cgroup-v1 positive path have not been tested locally.
Also verify UID-scoped process-limit fairness across concurrent capsules: an
individual parent pids.max alone does not prove independent RLIMIT_NPROC budgets.

The execution plan is now version 2 (structured compiler diagnostics and the new
native policy). Use a separately reviewed new immutable release/host binding;
never rewrite old epoch/runtime bindings, permits, records or retained results.

## Remaining Kernel Backend

Before enabling a real host, the protected kernel backend and installation must:

- Use the launcher's committed start decision as the only fresh entry to code
  execution; never start directly through a recovery or replacement path. RECOVER
  must read protected retained evidence without source execution. Persist process /
  workspace identities durably, including while PostgreSQL is offline. Integrate
  protected result storage with bounded-volume quotas and physical crash recovery.
  The start gate/result store cannot preserve a result never emitted by the
  backend or prove physical cleanup on its own.
- Select only reviewed fixed five-language source names, commands, images and
  presets. The existing profile/verdict lab is supporting evidence, not a generic
  implementation. Connect the verified once-only workspace preparer to the actual
  job lifecycle, preserving all necessary Java artifacts and exact byte inputs.
- Enforce compiler/run limits, UID/GID, namespace/network/filesystem isolation,
  seccomp/AppArmor, complete-tree CPU/RAM/PID bounds and protected output capture.
  Close inherited control descriptors before compilers or participant programs;
  they must never be able to write the trusted protocol stream or access secrets.
- Produce genuine observed phase/capture accounting and source/runtime binding.
  Attribute compiler failures from trustworthy execution evidence, not just exit
  1 or a diagnostic string. Ambiguous causes remain infrastructure uncertainty.
- Retain bound results durably before they can be lost to worker/host failure.
  Emit positive drain only after proving no future launch, all original processes
  stopped and owned workspaces/groups removed. No timeout/lease/absence shortcut.
- Pass real five-language, hostile-code, runtime drift, concurrent capacity,
  cancellation, crash/fencing/retirement, recovery and representative load tests.

Upstream [Isolate documents its Linux sandbox and installation requirements](https://github.com/ioi/isolate/blob/master/README.md).
The old fixed lab and the [Judge0 security advisories](https://github.com/judge0/judge0/security/advisories)
are reasons to review the actual deployed runtime, not assume a passing protocol
test makes the legacy image safe for arbitrary participants.

There is deliberately no installed launcher, production worker loop, heartbeat
daemon, deployment command or automatic migration in this batch. Do not install
the synthetic test launcher as a real producer or use it to mint readiness.

## Verification

`npm test` includes byte-preserving real child-process pipes, five-language
synthetic evidence, malformed/foreign replies, overflow, diagnostics, cancellation
and a timer-driven whole-process deadline check. `npm run test:db:schema` checks
the real Redis/registry/worker flow, lost replies and seal acknowledgements,
read-only recovery, physical uncertainty, immutable late cleanup and role limits.
These fixtures never compile or run the supplied source.

The suite also checks eight overlapping launcher requests producing one backend
start, sealing blocked before start, immutable start history, original-owner
recovery after lost replies, source/option substitution, backend evidence failure,
no open transaction during backend work and held uncertainty after a lost start
acknowledgement/cancellation. The backend in these tests is synthetic; it is not a
kernel isolation, compiler-failure attribution or hostile-code demonstration.

The Linux harness now includes real checkpoint files and a persistent owned
Docker volume. It kills actual synthetic producer processes and verifies saved
result recovery, held incomplete execution, eight concurrent start receipts,
database-seal failure, append-only cleanup, foreign bindings, interrupted writes,
permission-induced write failure, cancellation and linked/corrupt/oversized files.
The database-outage bridge uses a synthetic store; the separate registry suite
uses real PostgreSQL. No power-loss, VM-reboot or full-disk durability claim is made.

For the separate Linux adapter check, first run `npm run build`, then
`npm run test:judge:launcher`. It requires the cached pinned Node image listed in
`apps/api/test/integration/executor-linux.test.ts`; it never pulls implicitly.
The disposable container has no network, capabilities, Docker socket or project
secrets, a read-only root, bounded CPU/RAM/PIDs, an ephemeral executable `/opt`
for the trusted fixture and one owned persistent checkpoint volume. Only built
code, dependencies, package metadata and exact test files are mounted read-only.
Fifteen Linux checks run within its owned volume/container, including physical
identity survival after a killed synthetic producer and real disk recovery through
the production capsule reply path for all five languages. A second owned container
checks actual PID-1 refusal/exit with a live trusted child. These benign root fixtures are not an
isolate or arbitrary-code security test. Container and volume ownership are
checked before removal; no existing volume is reused or removed.

`npm run test:judge:phase` separately builds the new static helper with warnings
as errors inside the same cached pinned Node test image, verifies no ELF dynamic
interpreter, then runs thirteen native/pipe checks and two rejection checks in three
owned containers. It compiles only fixed reviewed C17/C++17 sum fixtures and
tests identity/environment, descriptor 400, exact binary I/O, boundary/overflow,
diagnostic bounds, overwritten output files, forged witness text, failed exec,
early EOF, deadlines and cancellation. Wrong UID and absent no-new-privileges
are deliberate rejection fixtures; none use privileged containers, network,
project secrets, Docker sockets or arbitrary participant code. All containers
retain capability, memory, CPU, PID, read-only root and logging bounds.

These are real native process/pipe checks, **not Isolate/cgroup tests**. The test
image's GCC/G++ are for trusted fixtures, not certification of the event's pinned
five-language toolchains. No live host, image release or participant verdict is
certified by them. The historical lab helper/controllers are unchanged.

After building, `npm run test:judge:workspace` runs 52 Linux checks across 17
fresh owned containers using that same cached image. It verifies all five fixed
source names, binary bytes, eight-way preparation races, mount/ownership/receipt
checks, same-inode corruption, symlink substitution, retained companion/nested
artifacts and fake-cgroup rejection. Separate fixtures actually exhaust the 64 MiB
tmpfs and 4,096-inode quota. Wrong mounts, stale state and failed ownership transfer
cannot become reusable preparations. The artifact-retention test uses synthetic
class bytes; it is not a new Java compiler/runtime test.

These root fixtures add only CHOWN and DAC_OVERRIDE to the otherwise dropped
capability set (CHOWN is deliberately absent for one failure test). They have no
network, Docker socket, project secrets, writable root, privileged mode or host
cgroup mounts. Source is never executed by this harness. Ownership labels are
verified before container removal. Production needs separately reviewed capability,
mount, filter and resource policies; these test settings are not a host installer.

The full local batch passes 123 unit/transport tests, 172 disposable service checks,
83 Linux checks across three harnesses, four Python clock tests and build/type
checks. Five-language producer-flow tests use synthetic phase observations; the
native tests execute fixed trusted C/C++/Node code, not participant code or the VM's
pinned five-language image. Local Docker uses cgroup v2, so these counts do not
include a real positive Isolate/cgroup-v1 execution, VM recovery or load rehearsal.
