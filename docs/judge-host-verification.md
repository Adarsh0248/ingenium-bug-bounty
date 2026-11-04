# Final judge verification handoff

This is a test plan, not permission to deploy the event. The user separately
approved the one temporary verification VM described below on 25 October.
Keep the existing `ingenium-judge-spike-01` VM, its Docker daemon and all retained
lab evidence unchanged. No participant registrations or event challenges are
needed: every program and input in this rehearsal is a fixed test fixture.

## Why a clean host is required

Local Docker has cgroups v2 and a different kernel/namespace context. It correctly
fails the production host observer. The existing lab daemon is also unsuitable:
the production peer check requires a daemon running from its immutable reviewed
executable and a root-only socket. Replacing the lab daemon to satisfy that check
would change retained lab state. Successful synthetic or toolchain-only tests do
not replace these checks.

The approved clean Ubuntu 22.04 x86-64 test VM is in Mumbai,
`asia-south1-a`, with Linux 6.8, cgroups v1, 2 vCPUs, 8 GiB RAM and a 60 GiB disk.
Use the existing private judge VPC and IAP SSH access, no public web listener,
no service account, no automatic restart and a three-hour stop limit. Its name
is `ingenium-judge-verification-01`. The operator confirmed it RUNNING and remotely
verified Ubuntu 22.04.5 with kernel `6.8.0-1070-gcp`. The initial filesystem was
`cgroup2fs`; the operator installed the dedicated GRUB v1 boot setting and
rebooted. The operator subsequently confirmed the kernel boot argument, tmpfs
cgroup root and actual v1 controller mounts on that VM. Cloud Shell's own hostname
starts with `cs-`; its kernel/cgroup results are not VM evidence.
Stop the VM after testing and preserve the evidence. The user subsequently
authorised direct SSH and completed CLI authentication, and approved a six-hour
stop limit on this same VM for the final uninterrupted five-hour test. The
extension was applied while the VM was stopped. A fresh six-hour window began
at 12:22:51 UTC on 25 October; the boot is
`6797c91f-0238-4016-80dd-0be86632c69d`. A duration runs from the VM's last start,
so the final test needs a fresh full window; changing the number late in a boot
does not provide six additional hours. This remains isolated testing with no
public event deployment.

The user subsequently approved resizing this same test VM to six CPUs/24 GiB
(`e2-custom-6-24576`) after the 2-CPU host repeatedly missed concurrent readiness
deadlines. It restarted with the six-hour stop limit and boot
`c0838d0f-8771-4260-b73f-d255968f434a`; its fresh v10 epoch passes all five
languages and three simultaneous readiness observations in 2.50–2.60 seconds.
The five-hour test began around 18:43 IST on 25 October and remains in progress.
No final endurance/capacity claim follows from its initial passing batches.

## Reviewable build artifacts

`npm run build:judge` typechecks/builds the API and produces an ignored unique
`build/judge-runtime-<uuid>/` directory. `bundle.json` lists exact hashes and sizes;
the command prints its own SHA-256. The bundled host/capsule programs do not need
the development `node_modules` directory. No private settings are packaged.

The frozen Dockerfile has two targets:

- `runtime`: the five-language candidate image and trusted phase helper.
- `host-tools`: only four statically linked executables: `launch`, `peer-exec`,
  `host-observe` and `ingenium-phase-exec`. Compilation uses the pinned GCC image
  and modern Linux headers, so the host's older compiler headers are not silently
  substituted. Exporting this target does not install the files.

Both targets support build-step network isolation. Pinned base images must first
be present or fetched by digest. Building or exporting either target cannot mint
readiness. The old Isolate binary remains explicitly pinned; it still needs the
actual containment and adversarial tests below before accepting hostile code.

## Observed verification-host progress, 25 October

The operator supplied successful real-VM outputs for the native observer and
then the production TypeScript readers: initial host context, all thirteen v1
controller mounts, enforced AppArmor raw policy hash and preallocated checkpoint
storage. The initial wrapper failed because the native program emits one JSON
line rather than the separate canonical judge wire format. Its exact-line
decoder was corrected with a failing-then-passing regression, preserving strict
shape, duplicate-field, UTF-8, length, nonce, boot and namespace checks. The v2
continuation retained `check.original-v1.js` and re-read existing resources;
it did not repeat storage or policy setup.

The report is `PREREQUISITES_PASSED`, explicitly `host_verified: false`:

- Boot: `242fd633-7f2f-4368-ae1d-8357d7e34f0e`; kernel `6.8.0-1070-gcp`.
- Profile: `ingenium-isolate-executor-v1`, enforced revision `72`, raw hash
  `c6252002e37b279e37fbddad7e1f0cfa0cae7c1c1d49bcbaca6fcb3001ed683e`.
- Checkpoint filesystem: 8,467,738,624 logical bytes, 65,536 inodes,
  actual loop backing/mount identity and admission headroom verified.

The operator installed pinned Docker CE/CLI 29.9.2, containerd.io
`2.4.2-3~ubuntu.22.04~jammy` and buildx `0.38.1-1~ubuntu.22.04~jammy` from
Docker's signed official Jammy repository. Default Docker service/socket remain
masked. A separate, manually started `ingenium-judge-docker.service` uses copies
of Docker/dockerd under the protected release directory, its own Unix listener
(not socket activation), cgroupfs and the existing containerd service. The socket
was observed as root:root 0600, cgroups 1, overlayfs, AppArmor and builtin seccomp.
It has not been enabled for boot. Actual kernel peer/executable authentication
and repeated strict daemon/image report checks now pass. The first report probe
refused the newly observed upstream v1 deprecation notice. Its exact wording is
accepted only for reviewed Docker 29.9.2 and is included in the frozen digest;
missing capability support or any other warning remains a refusal. See
[Moby issue 51111](https://github.com/moby/moby/issues/51111). The old probe is
retained as `peer-check.original-v1.js`; no daemon restart or restriction change
was used to make it pass.

Candidate source archive `ingenium-judge-runtime-20261025-v4.tar.gz` has SHA-256
`3515ff1a36707aeb8e5d89827899870d95fdf73b79426d11aaed4654befef405`;
its `bundle.json` hash is
`f7e0d7b0087c126b928aa6d53ad601aa835630589abeeb9fb728cb1f55be94b6`.
The runtime and host-tools targets both built. The immutable runtime image is
`sha256:2f1fedd67c258af86a0cad247c2e15a620c4523853f9ded5168e9a7640a72a88`.
The operator supplied all fifteen fixed toolchain answers, exact versions/binary
hashes, compiler diagnostics and normal owned-container removal. Evidence remains
at `/var/lib/ingenium/host-toolchains-ee23f5f2-7ff1-416a-ae4f-dd6ed08f229f`.
Actual daemon digest:
`97bbc5b0e94bdde2d619ecfb5bffd02ba5cbab341ba9b6ab60340a762be77fe1`;
image configuration digest:
`f05d688d32f4a4b005960a24e57ac41fb853d290b195086905d112aa59b0231f`.
Both actual exports through the production bounded pipe/TAR reader now match:
2,082,512,216 data bytes, 35,045 entries and 27,639 files. The tree SHA-256 is
`a2712c9fd25d92fabee4789a1397d72354baaa0e0b89ad490a67073375a02101`;
export times were 55,890 and 26,763 ms. The original inspection container was
verified never-started, then removed and confirmed absent. Its allocation and
export evidence remain at
`/var/lib/ingenium/image-baseline-9d8a0968-bd00-4eaf-8a95-a97f3eb82753`.
The report is `IMAGE_BASELINE_ONLY`, not readiness.
The complete immutable release and standalone boot preparation now pass. No
provider database or gateway has yet been installed; no participant code has run
on this host.

The once-only preparation installed only the missing protected release files,
preserving existing tools, policy, storage and earlier probe evidence. It used
the production complete-installation verifier and actual boot/image/policy/
storage readers with the observed hashes above. The unused test epoch
`bac6fb8c-6740-4c32-a415-f6cb860fe39a` retains its own intent and proof; fresh
readiness and lost-acknowledgement recovery match without another inspection
container. Preparation took 45,305 ms and fresh readiness 1,665 ms. Release hash:
`d3e22161024199246dfc6a7c8cacd885b90cddb836e86a0981808dedb57fbba3`;
proof: `ad6e9094abfb246c457b29b156e0848188dcc580e15529a6492c9d360b7ed2c0`.
Evidence remains at
`/var/lib/ingenium/host-installation-bac6fb8c-6740-4c32-a415-f6cb860fe39a`.
The result is
is `HOST_PREPARATION_REHEARSAL`, explicitly unregistered in the database and
with event admission and participant execution disabled. It does not create
provider records, service credentials or an event listener. Local shell syntax,
wrong-host refusal, standalone bundle entry-point checks and strict TypeScript
checks pass, followed by the positive real-VM result above. This is boot
preparation evidence, not database/service admission or execution calibration.

## Complete installation preparation: operator steps

Upload `build/ingenium-host-installation-20261025-v1.tar.gz` from this checkout to
Cloud Shell's home directory. Its SHA-256 is
`72e03d90347b1b806a548c785b220b0e65ded11b04c2293c722fd718622f19f8`.
The archive has 22 inventoried files and no private settings. Its capsule program
matches the already-built candidate image; no runtime image rebuild is required.
Local verification includes strict TypeScript checks for all four host probes,
standalone caller refusal and the three setup scripts' actual Linux syntax /
wrong-host refusal (`host-installation-refusal-final-20261025.log`).

In Cloud Shell:

```bash
gcloud compute scp ~/ingenium-host-installation-20261025-v1.tar.gz \
  ingenium-judge-verification-01:~/ \
  --project=EXAMPLE_CLOUD_PROJECT \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-verification-01 \
  --project=EXAMPLE_CLOUD_PROJECT \
  --zone=asia-south1-a --tunnel-through-iap
```

Inside that VM, run once:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-verification-01
  cd ~
  echo '72e03d90347b1b806a548c785b220b0e65ded11b04c2293c722fd718622f19f8  ingenium-host-installation-20261025-v1.tar.gz' | sha256sum -c -
  mkdir -m 700 ingenium-host-installation-v1
  tar -xzf ingenium-host-installation-20261025-v1.tar.gz \
    -C ingenium-host-installation-v1
  cd ingenium-host-installation-v1
  sudo bash prepare-installation.sh
)
```

Send the final PASS/JSON or first failure. Preserve any failed installation,
cache and original inspection container; do not repeat setup or reset records.
The approved three-hour VM stop limit remains unchanged.

## Database-backed fixed launcher: operator steps

The next archive is `build/ingenium-host-registry-20261025-v1.tar.gz`, SHA-256
`0e8662b1814951511bb75231c5f6578fe362f5b48e65b85617ababd866a60f31`.
It contains 11 inventoried files and no credentials. The operator uploads it to
Cloud Shell and uses the same scp/SSH commands above, substituting this filename.
Inside the already prepared verification VM, run once:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-verification-01
  cd ~
  echo '0e8662b1814951511bb75231c5f6578fe362f5b48e65b85617ababd866a60f31  ingenium-host-registry-20261025-v1.tar.gz' | sha256sum -c -
  mkdir -m 700 ingenium-host-registry-v1
  tar -xzf ingenium-host-registry-20261025-v1.tar.gz -C ingenium-host-registry-v1
  cd ingenium-host-registry-v1
  sudo bash prepare-registry.sh
)
```

This is a test-only PostgreSQL 17.11 container/volume on the approved VM, using
the reviewed image digest, 512 MiB memory, half a CPU, 64 tasks and a loopback-only
random port. It retains its generated credentials and owned allocation receipts
privately under `/var/lib/ingenium/registry-rehearsal-<uuid>`. It installs the
previously absent root-only `/etc/ingenium/judge-launcher.json` for this test boot
and existing prepared epoch; it changes no protected release files or old lab.

Its provider tables are explicitly a **structural fixture**, shared with neither
the old lab nor production registrations. They do not qualify the actual Judge0
engine/schema. The six real judge migrations, restricted service roles, runtime
fingerprints, execution permits and production fixed launcher are used. Only an
actual fresh launcher proof can renew the database lease. The five fixed source
fixtures are sent once each through real Isolate phases. Their first reply is
deliberately discarded; RECOVER and a duplicate EXECUTE must return the same
sealed evidence, exact answer and full physical cleanup. No Redis delivery,
private HTTPS ingress, real participant input or public event is involved.

Local evidence: `registry-rehearsal-bootstrap-20261025.log` passes the actual
shared database bootstrap on a new persistent disposable volume, including role
separation, five runtime mappings, empty provider/attempt tables and no readiness.
`registry-rehearsal-refusal-20261025.log` verifies all four setup scripts' real
Linux syntax and wrong-host refusal. Whole-app typechecking and standalone
bundled caller refusal pass. These are not positive real-host execution results.
The operator's first run stopped at `c-execution`. Read-only diagnostics confirmed
the missing 0700 `capsules` configuration root. Original attempt
`892f92fd-ef98-4857-8e43-d6be2e9e90e9` has a consumed/start-marked permit but no
result/drain. Its capsule checkpoint contains exactly `binding.json`,
`intent.json` and `resource_intent.json`; no container, execution checkpoint or
job cgroups were created. The capsule nonce is
`413ca06e-1f43-4853-963b-09f514b5e056`.

The original installer and preparation fixture now create/check this root for
future installations. Do not rerun them on the retained test. The exact-state
continuation archive is `build/ingenium-host-registry-20261025-v2.tar.gz`, SHA-256
`91758beee3d4e3f7627ce7186330db3d9fc61e8a6f3623b70a9fb92247879353`.
Transfer it to the same VM, verify the hash, extract to a new 0700
`~/ingenium-host-registry-v2` directory and run only
`sudo bash prepare-registry-fix.sh` there. It refuses a different boot, release,
checkpoint, controller state, database allocation or altered original record.
It retains a new private `setup-fix-v1` checkpoint before adding the missing root.
The shared fixture uses five fresh attempts; first replies are discarded, and
read-only recovery and duplicate EXECUTE must return identical sealed evidence.
The old association and held reservation remain intact. Expected success is six
attempts, five drained and the original held. This single-slot continuation does
not qualify two-job concurrency, the provider engine or HTTP/queue delivery. Its
v2 was subsequently run by the assistant over authenticated IAP SSH. It stopped
at the fresh C execution `ca2944d3-a1fd-4757-bc0d-6760eaf84bf9`, after writing
`resources.json` but before any execution container or in-capsule checkpoint.
Its nonce is `d811b853-4460-4f9d-8ab3-564a9412cc95`. The original attempt and this
second attempt are now both held; do not repeat v2 or admit another job here.

Read-only production-adapter verification of the retained private configuration,
all thirteen original controller allocations and old boot proof passes. The
failure was Docker CLI parsing: combined-controller paths contain the comma in
`cpu,cpuacct`, which must be quoted as one CSV source field in `--mount`.
The shared argument producer now quotes that field. The actual local Docker CLI
regression failed before the fix and passes after it; the same old/fixed parser
probe passes against the VM's Docker 29.9.2 with an unreachable socket, preventing
all Docker create/start requests. These checks grant no result or cleanup proof.
Evidence is in `vm-production-resource-check-20261025.log`,
`vm-docker-csv-check-20261025.log`, `capsule-csv-before-20261025.log` and
`capsule-csv-after-v2-20261025.log` under `apps/api/test-results/`.

The rebuilt release is `build/judge-runtime-cf5a0297-cb31-4878-81f7-35febb09eb5e`,
bundle SHA-256 `747a02eb702cb5e6742a2cec103bb4e901e046a23baa6bf01fb7961d12125685`.
Its host program hash is
`f8d4d2777d1370b34d62bc3b894517225a6cc90efeaf4e030a225ec41050da17`;
the capsule program remains byte-identical to the VM image
(`a110badda08365f13fca40998506ef1b35f410f9d1ab20875cc50db0bbb7a541`).
This release has not been installed on the VM. A subsequent rehearsal must
preserve the old complete release/configuration and immutable associations,
explicitly fence the old database epoch, and prepare a fresh reviewed release/
epoch before new execution. Never weaken verification or use a diagnostic
program as production launch authority. Full five-language success is open.

## Direct SSH access established, 25 October

The user authorised running these tests directly through SSH. This Windows
computer initially had neither Google CLI nor a local Google Cloud login.
The official portable Google CLI 590.0.1 Windows archive was verified against
Google's published SHA-256
`1a2891fe481b8e2f9c54db8e5aacfcd6b6d589688ecef0ca5d988631fa0ebcf0` and extracted
outside the checkout. An initial Windows tar extraction encountered documentation
link errors; that directory is preserved, and a separate complete extraction
passed the CLI version check. No system PATH or user shell profile was changed.

The working CLI is
`C:\Users\YOUR_USER\AppData\Local\ingenium-tools\gcloud590\google-cloud-sdk\bin\gcloud.cmd`,
with `CLOUDSDK_PYTHON=C:\Python314\python.exe`, usage reporting disabled and
separate private `CLOUDSDK_CONFIG` at
`C:\Users\YOUR_USER\AppData\Local\ingenium-tools\gcloud-config`. The user completed
Google's browser sign-in. Credentials and the generated test SSH key remain
outside the checkout and are never copied into reports. Native IAP SSH and SCP
now work for this approved VM/project. Windows' SCP client requires the observed
absolute remote home path rather than `~/...`. Authentication does not authorise
deployment, another VM or historical lab changes. The three-hour stop limit
remains unchanged; stop the verification VM after the current tests.
The assistant stopped it after these diagnostics and confirmed `TERMINATED`
through the Compute Engine API; the disk, database volume and evidence remain.

On a later restart, do not use this boot's old proof or replay either failed
execution. The daemon was not enabled for boot, and this rehearsal did not add
persistent mounting/loading for the checkpoint filesystem or AppArmor policy.
Restore only the verified existing backing filesystem without formatting it,
re-observe policy/storage/kernel/daemon identities, preserve all old records and
prepare a fresh epoch. A successful old JSON report cannot replace those steps.

Success must retain exactly five original provider/attempt/drain associations
and withdraw readiness. The private database container/volume and all checkpoints
remain for subsequent checks. Failure retains its original database, consumed
permits and any physical resources; send the first failure without rerunning,
resetting or force-cleaning. A later boot invalidates this boot's preparation;
do not repurpose its epoch or silently extend the three-hour VM window.

## First native context probe

The ignored `build/ingenium-host-context-20261025-v1.tar.gz` contains only the
freshly compiled static `host-observe` executable. Archive SHA-256:
`6c6e3b09199688f0c452d48281ec32c9d207665804cfc52e8cdbfe023fa4599d`.
Executable SHA-256:
`847d85cc15f6fac9b7dcf5eb57f5ae378a14f8d07d5778a2c06d9a958930f446`.
This first probe reads actual host kernel/capability/namespace/procfs state. It
does not install Docker, load policy, open a listener, admit code, issue a boot
certificate or create cgroups. It changes only its own no-new-privileges flag.

Upload that archive to Cloud Shell's home directory, then transfer it to the
approved verification VM:

```bash
gcloud compute scp ~/ingenium-host-context-20261025-v1.tar.gz \
  ingenium-judge-verification-01:~/ \
  --project=EXAMPLE_CLOUD_PROJECT \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-verification-01 \
  --project=EXAMPLE_CLOUD_PROJECT \
  --zone=asia-south1-a --tunnel-through-iap
```

Run the following only inside that VM, once. It stages the verified binary in a
new root-owned directory rather than executing a user-writable file as root.
If it fails, retain the files and output; do not modify the observer or retry
with fewer checks.

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-verification-01
  cd ~
  echo '6c6e3b09199688f0c452d48281ec32c9d207665804cfc52e8cdbfe023fa4599d  ingenium-host-context-20261025-v1.tar.gz' | sha256sum -c -
  mkdir -m 700 ingenium-host-context-v1
  tar -xzf ingenium-host-context-20261025-v1.tar.gz -C ingenium-host-context-v1
  echo '847d85cc15f6fac9b7dcf5eb57f5ae378a14f8d07d5778a2c06d9a958930f446  ingenium-host-context-v1/host-observe' | sha256sum -c -
  test ! -e /opt/ingenium-host-context-v1
  sudo install -d -o 0 -g 0 -m 0555 /opt/ingenium-host-context-v1
  sudo install -o 0 -g 0 -m 0555 ingenium-host-context-v1/host-observe /opt/ingenium-host-context-v1/host-observe
  echo '847d85cc15f6fac9b7dcf5eb57f5ae378a14f8d07d5778a2c06d9a958930f446  /opt/ingenium-host-context-v1/host-observe' | sudo sha256sum -c -
  sudo timeout 5s /opt/ingenium-host-context-v1/host-observe --observe "$(cat /proc/sys/kernel/random/uuid)"
)
```

## Bounded checkpoint storage

Full host readiness now also requires a dedicated 8 GiB preallocated ext4 loop
filesystem at `/var/lib/ingenium/judge-executor/checkpoints`, backed by the new
root-owned `checkpoints.ext4` file in its parent directory. This uses the approved
test VM's boot disk, not an extra cloud disk. Its test setup and production-reader
probe now passed on the verification VM, as recorded above.
The mount must be `rw,nosuid,nodev,noexec`, with a root-only 0700 directory and
0600 backing file. The observer checks the real kernel loop backing identity,
complete physical allocation, mount identity, total bytes/inodes and at least
32 MiB / 128 free inodes before admission. Per-record bounds alone do not cap
aggregate retained checkpoints. Missing or changed storage keeps judging closed.
The installer must create only this new owned file on the fresh verification VM;
it must never format a block disk or reuse a historical lab path.

## Required positive and failure cases

1. Verify the transferred inventory, actual kernel/boot and initial host context.
   Invalid ownership, modes, hashes, namespaces, procfs views and missing
   capabilities must fail before allocation.
2. Compile the candidate AppArmor policy without loading it, review the compiled
   bytes, then load only that exact new policy. The observer must see the actual
   enforced kernel profile/raw hash. Policy replacement/reload and drift must
   invalidate the old boot certificate.
3. Verify the dedicated daemon's actual kernel peer and immutable executable,
   root-only socket, frozen reports and runtime image configuration. Stream the
   actual candidate rootfs twice without starting its inspection containers;
   require matching canonical hashes and the original bounded deadlines.
4. Create only the new general judge database, its separate service logins and
   reviewed migrations. Never apply them to the historical lab database. Verify
   role separation and the once-only boot/image/release preparation certificate.
5. Execute C, C++, Java, Python and JavaScript through the full gateway, durable
   permit, fixed launcher, real Isolate phases and protected pipes. Check exact
   sample bytes, identities, compiler children, accounting and normal cleanup.
6. Exercise known compilation/wrong-answer/runtime/time/memory/output failures,
   malformed/hostile source fixtures, stream replacement attempts, child/fork
   limits, detached descendants and cross-job access denial. Use two concurrent
   jobs to calibrate shared UID/process constraints and resource accounting.
7. Lose HTTP/worker replies and stop a worker during execution. Duplicate
   deliveries must not launch twice. Ordinary RECOVER must stay read-only;
   explicit retirement must prove original-ID container, task, namespace,
   workspace and every-controller resource absence before releasing a slot.
   Missing evidence must remain held without an invented participant verdict.
8. Measure real five-language mixed queue latency/drain, storage/inode headroom,
   restart behaviour and an uninterrupted event-length soak. Record actual
   limits and unresolved failures; do not substitute a short smoke test.

Each step must have its own durable checkpoint and bounded source-free report.
On uncertain failure preserve the original state for inspection; do not repeat
admission, reset permits, force-delete resources or patch a positive proof.
All these host gates remain open until their actual evidence exists.
