# Judge Spike Preparation

This is preparation for the isolated Linux feasibility VM, not a Judge0
production deployment or an implementation of the trusted supervisor.
The configuration helper never starts Docker, creates cloud resources or executes
submissions. The image files below are lab-only patches, not a production judge
or security-approved participant runtime.

Earlier user-reported checkpoint (2026-10-18): the [five-profile HTTP/bounded
evidence lab](TRANSPORT-LAB.md) passed. Five real provider/outbox associations
survived lost token bodies and explicit duplicate POSTs. Duplicate Redis deliveries
produced one execution per job; lost worker replies recovered through HTTP with
matching raw bytes/accounting and expected backend checker results. Fifteen
provider rows remain, including the ten earlier rows unchanged, with the queue
empty and maintenance enabled. Preserve `transport-v1` and its schema; this is a
completed one-shot experiment, not a procedure to repeat. General failure mapping,
wider recovery, adversarial isolation, dependency review and load gates remain open.

Earlier user-reported checkpoint (2026-10-18): the [shared sandbox boundary
batch](ISOLATION-LAB.md) passed all three fixed probes: boundary denials/identity
checks, the bounded fork limit and detached-child cleanup. Accounting and normal
cleanup passed, all fifteen provider rows and earlier evidence remained unchanged,
the queue is empty and maintenance remains enabled. Preserve `isolation-v1`;
this is a completed one-shot experiment, not a procedure to repeat. It reused the
cached image and unchanged policy, with no provider record/schema added or
external network request. The later scoped protected-output result is below.
Dependencies, wider recovery and measured load remain open; these
fixed probes do not approve arbitrary participant execution.

Latest user-reported checkpoint (2026-10-18): all 80 bundled VM unit tests and
the [eighteen fixed protected verdict cases](VERDICTS-LAB.md) passed. Compilation
and runtime errors, answer checks, CPU/wall/job-memory limits and stdout overflow
matched expectations; the ambiguous kill produced `RECOVERY_REQUIRED`, not a
participant verdict. Evidence was sealed with all fifteen provider rows and
earlier evidence unchanged, queue empty and maintenance enabled. Preserve
`verdicts-v1`; do not rerun this completed controller. Repeated earlier-case PASS
lines validate saved evidence, not new executions. The next
[protected-verdict HTTP/queue batch](VERDICT-HTTP-LAB.md) passed its 95 VM unit
tests and Ruby preflight, but admission stopped at the rejected 0.3-second wall
envelope. The diagnosed retained state is 23 provider rows, eight unstarted
associations and zero consumed permits. The separate
[guarded continuation](VERDICT-HTTP-LAB.md#retained-admission-continuation)
corrects only that absent provider envelope while preserving the actual 300 ms
sandbox limit and original eight bindings. Do not rerun the original controller.
Archive 03's 107 VM tests passed, but its whole-stdout model-validation check
rejected the reply before continuation checkpoint creation or admission.
Archive 04 accepts exactly one complete validation-success line alongside logs,
while retaining checked exit, read-only mode, output bounds and all state guards.
Cloud continuation is pending. Archive 01 stopped before checkpoint creation;
archive 02 corrected the payload-hash copy without relaxing
duplicate JSON-key rejection; its corrected preflight/cloud result is pending.
Arbitrary compiler
failure attribution, broader recovery, calibration, dependency/security review
and event-load verification remain open.

Earlier user-reported checkpoint (2026-10-18): the [protected-output sealing
continuation](OUTPUT-LAB.md) passed. Fifty language cases and three tampering/EOF
probes were reconstructed from the completed log, without code rerun. Compact
evidence was sealed with the original journal/log and all fifteen provider rows
unchanged, queue empty and maintenance enabled. Preserve `output-v1` and its
completed `seal-fix-v1` evidence; neither controller nor continuation should be
repeated. The earlier size-cap failure and its one-line writer correction remain
documented. The later [18-case protected-verdict batch](VERDICTS-LAB.md) also has
a user-reported cloud PASS, as recorded above. Runtime-overhead calibration,
broader recovery, dependency
review and measured load remain open.

The earlier guarded [stream recovery and
fifty-case checker suite](STREAMS-LAB.md) passed across all five cached profiles.
All-controller empty-task checks preceded removal of only the stopped failed
probe; its old journal/log remain intact. The corrected batch verified bounded
retention, EOF, identity, checker results and normal cleanup, then sealed evidence
with ten provider rows and earlier schemas/evidence unchanged, queue empty and
maintenance enabled. Preserve `streams-v1/cleanup-v1` and `streams-v2`; neither
controller is a procedure to repeat. The later fixed HTTP integration is recorded
above; general recovery, isolation and load verification remain open.

The completed integration reused the cached images and private network and added
five provider rows (10 to 15) plus `ingenium_transport_v1`. Do not rerun it or
earlier controllers, reset permits, clear records/queues or reuse historical
ten-row postconditions. The later scoped isolation result is recorded above;
neither checkpoint authorises participant code or proves adversarial safety.

The earlier guarded [active worker crash/drain continuation](CRASH-LAB.md) passed.
Killing the host worker and its
launcher left two observed UID-60000 sandbox processes alive; the reservation
stayed held and a replacement could not relaunch. Stable process handles,
explicit workspace cleanup and empty owned-resource checks established drain
before a once-only release. The lost release acknowledgement was reconciled;
the permit stayed consumed and no participant verdict was invented. The original
context/journal, ten provider rows and earlier evidence stayed unchanged, and
the original three services and four private API gates passed again.

The earlier [private HTTP association
lab](HTTP-LAB.md) passed after the earlier five-language and retained-result
checks. One real provider record/outbox association survived a lost token body
and duplicate POST; two Redis deliveries reached guarded workers but only one
executed the trusted C++ fixture. The committed result was recovered after a
lost worker reply, with exact stdout and matching accounting read through the
original API. Ten provider records remain, including all nine original records
unchanged; the old held reservation is unchanged, the queue is empty and the
original API remains in maintenance.

Preserve `/opt/ingenium-judge-spike/active-crash-v1`, including the completed
`schema-fix-v1` journal and drain proof, its `ingenium_active_crash_v1` schema,
`/opt/ingenium-judge-spike/http-v1`, its `ingenium_http_v1` schema and
the earlier evidence. The procedures below and the HTTP lab's run instructions
are now historical one-shot experiments, not instructions to repeat them. Do not
reset the deliberate crash-before-launch reservation or rerun whole-database
empty/nine-row checks. Trusted general stream evidence, broader crash/host
retirement recovery and security/load verification remain open.

The first active-crash invocation stopped during schema creation because a new
check collided with a copied check name. Explicit names and a guarded unstarted
continuation resolved that failure without resetting a permit or replacing old
evidence. Both active-crash procedures are now historical; do not repeat them.
The first [stream/checker](STREAMS-LAB.md) batch failed with `ProcessLookupError`.
The caller now tolerates only a disappearing-task observation race, without
inventing positive identity evidence. The successful guarded archive-02 recovery
removed the exact stopped `ingenium-cg-run-w7KHlq` probe after checking every
controller. Preserve its original `streams-v1` journal/log, separate cleanup proof
and corrected `streams-v2` evidence. Both procedures are now historical; do not
rerun them or clear checkpoints. No new image, database write or permit reset was
needed for this fifty-case experiment.
This fixed workload does not approve general participant execution.

## Inputs and Output

Run as the VM user who generated these files, without `sudo`, from the extracted
release directory. Its `secrets` directory must belong to that user with mode 700.
The regular, non-symlink credential files must belong to the same user with mode
600. The four passwords/tokens contain 64 lowercase hexadecimal characters; the
Rails secret contains 128. A final newline is optional.

| Input file | Judge0 setting |
| --- | --- |
| `secrets/postgres-password` | `POSTGRES_PASSWORD` |
| `secrets/redis-password` | `REDIS_PASSWORD` |
| `secrets/api-token` | `AUTHN_TOKEN` |
| `secrets/admin-token` | `AUTHZ_TOKEN` |
| `secrets/rails-secret` | `SECRET_KEY_BASE` |

```bash
bash prepare-config.sh
stat -c '%a %n' judge0.spike.conf
```

An optional first argument supplies the directory containing `secrets`. The
helper validates all inputs before preparing a temporary mode-600 file and
publishing it with an exclusive hard link. Existing destinations, including
symbolic links, are never replaced. Temporary files are cleaned up on exit.
Neither credential values nor generated file contents are printed. The original
upstream `judge0.conf` is left untouched. This does not rotate credentials.

## What It Configures

- Maintenance mode stays enabled: ordinary submission creation is not enabled.
- Two development workers, one run per execution and no submission cache.
- Callbacks, batches, additional files, arbitrary compiler options/arguments,
  deletion, telemetry and submission-network overrides are disabled.
- Fixed internal database/cache names and distinct authentication/authorization
  tokens. Judge0's admin token is not an Ingenium staff login code.
- C++ smoke-test defaults of 2 CPU seconds and 10 wall seconds; overall request
  ceilings of 4 CPU seconds and 15 wall seconds for later profile review, no CPU
  grace period, 512 MiB memory, 64 MiB stack, 64 processes/threads and 16 MiB
  regular files. Per-process CPU/memory modes and their overrides are disabled.
- `RAILS_ENV=production` selects Judge0's PostgreSQL runtime behavior; it does
  not mean that this setup is production-approved.

These are configuration requests, not tested enforcement. The final per-language
toolchains and commands, compile limits, aggregate supervision, 1 MiB stdout /
64 KiB diagnostic capture, file-descriptor/workspace/inode limits, one-time
execution permits and trusted completeness/drain evidence remain unimplemented.

## Before Any Service Starts

Do not run the downloaded upstream Compose file with these credentials. Its
server/worker scripts can log exported credentials. Startup must be reviewed and
patched, and the image provenance/dependencies and private network reviewed.

The generated file is mode 600 and owned by the host operator. It is deliberately
not yet a bind-mount-ready runtime secret: the stock image's `judge0` account has
UID 1000, which need not match the OS Login user. Resolve runtime ownership and
startup identity without making the configuration world-readable. Do not paste
expanded Compose configuration, raw credential files or unreviewed startup logs
into chat. No readiness gate is passed by generating this file.

The generated configuration and temporary names are Git-ignored. Keep live secret
files only on the isolated VM, never in the repository or browser frontend.

## Lab Startup Patch

The `image` directory is a separate, allowlisted Docker build context with no
credentials. It is not a Compose deployment. Do not build or run Judge0 on the
Windows development machine or alongside the competition database.

- `Dockerfile`: pins the upstream `judge0/judge0:1.13.1` manifest by digest and
  copies three root-owned, mode-555 startup files. The default `startup` target
  has no `RUN` instructions, package updates, embedded secrets or database
  connection during build. The separate `worker-prep` target below adds only
  directory hardening and build-time assertions; it does not start a worker.
- `entrypoint.sh`: accepts only the server or workers role, requires UID 1000 and
  a regular readable configuration owned by that UID with mode 400 or 600. It
  does not start upstream cron. Runtime mounts and ownership are still pending.
- `server.sh`: loads configuration without printing or saving exported values,
  runs database setup once, stops on setup failure and replaces the startup shell
  with the API process. There is no automatic server-startup retry.
- `workers.sh`: removes the exported-environment dump and disables tracing before
  config loading. The upstream scheduler/worker loop is otherwise retained for
  review; its shutdown, restart and redelivery behavior are not trusted drain or
  one-time execution guarantees.

The worker script is adapted from the upstream
[GPL-3.0 source](https://github.com/judge0/judge0/blob/v1.13.1/scripts/workers).
Its upstream license text is preserved in `image/LICENSE.judge0` and copied into
the lab image as `/api/INGENIUM-STARTUP-LICENSE`.

Disabling cron also disables its scheduled housekeeping. No periodic cleanup is
provided by this bounded lab patch; it is not an event retention implementation.
Only the identified startup environment-dump path has been addressed. Rails,
dependency logs, privileged worker behavior and sandbox credential isolation have
not been runtime-audited. Old upstream dependencies and language profiles remain
unchanged: this is not a maintained production rebuild or the trusted supervisor.

The reviewed manifest digest is
`sha256:6b5d6a66aa19a8e878a52ea3c6a560afc1086734d96e2885b561fd5c6018f082`.
Its remote metadata reports 49 layers totaling about 3.07 GiB compressed;
unpacking needs additional disk space. Registry metadata inspection did not pull
or execute the image. Pinning identifies bytes, not a security sign-off. Before
building on the VM, download by this digest and inspect the image identity,
architecture and configured user. Do not start it yet.

The user has reported the base image available on the VM as Linux/amd64 with
configured user `judge0` and 42 GiB free host storage. Inspection of a never-started
container confirmed UID 1000, GID 999 and matching hashes for the four reviewed
upstream startup/config-loader files. See the VM image inspection checkpoint in
`docs/judge-feasibility.md`. The user subsequently reported the patched image
built on the VM as Linux/amd64, user `judge0`, image ID
`sha256:1e91aa8647a728487bcc7259bc87762b06306193ba13d90fa6881b13462b8a54`.
The later dependency and maintenance-only API checkpoints are recorded below;
no execution worker or sandboxed program run is confirmed.

For transfer, package only the six files in `image`, including `.dockerignore`
and `LICENSE.judge0`. Keep the archive under ignored `runtime-data/judge-spike`.
Verify its SHA-256 on the VM before extracting into a new directory. Build with
that extracted directory as context, never the release/config/secret directory:

```bash
sudo docker build --network=none --pull=false --platform=linux/amd64 \
  -t ingenium/judge0-spike:startup-v1 image-startup-v1
sudo docker image inspect ingenium/judge0-spike:startup-v1 \
  --format 'ID={{.Id}} OS={{.Os}} Architecture={{.Architecture}} User={{.Config.User}}'
```

This default startup build copies files and sets metadata; the current BuildKit
build graph does not run the separate worker-preparation stage. Registry metadata
resolution can still occur.
It does not start a service, prove the image works or pass any execution gate.
Leave the built image stopped; resolve runtime secret ownership and private
service configuration in the next step.

## Runtime Configuration Copy

The operator's original `judge0.spike.conf` must remain mode 600 and unchanged.
Prepare a separate runtime copy only on the VM: first validate the original is a
regular, non-symlink file owned by the operator with mode 600, then create a new
root-owned mode-700 `/opt/ingenium-judge-spike` directory without `-p` (stop if it
already exists). Use `sudo install -o 1000 -g 999 -m 400` to copy the original to
`/opt/ingenium-judge-spike/judge0.conf`. Verify equality with `sudo cmp -s` and
print only ownership/mode metadata with `stat`, never file contents.

The Docker daemon will later mount that file read-only at `/api/judge0.conf`.
The host parent directory remains root-only, while the mounted file's owner
matches the container's UID. GID 999 matches the inspected account; mode 400
grants no group or other access. This is file preparation, not a running service
or proof of participant sandbox isolation.

The user has confirmed the private parent as `700 0:0` and runtime file as
`400 1000:999` on the VM. The dependency startup checkpoint below followed this.

## Private PostgreSQL and Redis

Three public files prepare only the judge's dependencies:

- `dependencies.compose.yaml`: pinned PostgreSQL 16.15 and Redis 7.2.16 images,
  an internal bridge, separate persistent volumes, private secret-file mounts,
  resource limits and authenticated health checks. No public ports or judge
  API/workers are defined. Both services run as UID/GID 999.
- `init-db.sh`: uses the PostgreSQL administrator only during empty-volume
  initialization to create `judge0` and its database. The judge role is not a
  superuser; CREATEDB supports the current lab image's startup command.
- `redis-entrypoint.sh`: reads a validated password from a secret file, writes a
  private temporary config and starts Redis with AOF and no eviction. The
  password is not a Redis process argument.

These are different from the competition application's database and durable
queue. Redis is Judge0's internal queue, not the approved application queue.
The internal Docker network also differs from the Google VPC: it connects
containers inside this VM. It does not establish participant sandbox isolation.

Transfer an archive containing only those three public files through Cloud Shell
and IAP. Verify its hash before extraction into a new `dependencies-v1`
directory under the extracted release. Do not use the upstream Compose file.
Run the following later on the VM, after reviewing this preparation step:

```bash
(
  set -euo pipefail
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  umask 077
  set -C
  openssl rand -hex 32 > secrets/postgres-bootstrap-password

  sudo mkdir -m 700 /opt/ingenium-judge-spike/dependencies
  for name in postgres-bootstrap-password postgres-password redis-password; do
    sudo install -o 999 -g 999 -m 400 "secrets/$name" \
      "/opt/ingenium-judge-spike/dependencies/$name"
  done
  sudo install -o 0 -g 0 -m 444 dependencies-v1/init-db.sh \
    /opt/ingenium-judge-spike/dependencies/init-db.sh
  sudo install -o 0 -g 0 -m 555 dependencies-v1/redis-entrypoint.sh \
    /opt/ingenium-judge-spike/dependencies/redis-entrypoint.sh

  sudo docker compose -f dependencies-v1/dependencies.compose.yaml config --quiet
  sudo docker compose -f dependencies-v1/dependencies.compose.yaml pull db redis
  sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    up -d --pull never --no-build --wait --wait-timeout 120 db redis
  sudo docker compose -f dependencies-v1/dependencies.compose.yaml ps
)
```

Noclobber (`set -C`) refuses to replace an existing bootstrap password, and mkdir
without `-p` refuses an existing runtime dependency directory. Stop on errors;
do not delete volumes or rotate existing passwords to retry. Initialization runs
only on an empty PostgreSQL volume; changing files later does not rotate a stored
role password. Health checks show service readiness, not sandbox/event readiness.
Do not paste raw credential files or unreviewed logs. Bounded Docker logs are not
a full audit of dependency logging.

To stop only these services and keep their data:

```bash
sudo docker compose -f dependencies-v1/dependencies.compose.yaml stop db redis
```

The user has now reported both dependency containers healthy, using the pinned
images and project-scoped volumes/internal network. Their listed container ports
have no host mappings. The subsequent API startup/probe outcome is recorded below.

Local checks do not start services:

```powershell
node --test infra/judge-spike/test/dependencies.test.mjs
```

`test/dependency-scripts.test.sh` additionally requires a disposable Linux
container as UID/GID 999 with an empty `/run/secrets` tmpfs and executable
temporary storage for known command stubs. It uses fake passwords and no real
database/Redis server, judge image or data volumes.

## Maintenance API Only

`api.compose.yaml` is an override, always used together with the dependencies
file. It adds one non-privileged API service using the exact local image ID
reported by the user; there is no worker. Do not replace the image ID with a
floating upstream tag. It publishes no host port and remains attached only to
the internal bridge. The VM host probes the container's private IPv4 directly;
no external firewall rule or SSH tunnel needs to change. The config file is
mounted read-only and only bounded tmpfs directories are writable.

The first transfer (`api-v1`) requested loopback publication, but the user
reported a healthy API with no actual host mapping, followed by a failed probe
and an automatic API stop. A separate local reproduction with a trusted image
running only `sleep` confirmed that Docker omitted the requested mapping on an
internal-only network. The corrected override removes this ineffective request;
it does not weaken the network isolation or alter dependency volumes.
[Bridge host access](https://docs.docker.com/engine/network/drivers/bridge/),
[internal-network publication report](https://github.com/moby/moby/issues/44986).

Transfer only `api.compose.yaml` and `probe-api.py`, verify the archive hash and
extract into a new `api-v2` directory under the release. Keep `api-v1` unchanged.
Before starting, verify
the judge role's privilege flags, maintenance mode and disabled batch/synchronous
execution. No API config or password is regenerated:

```bash
(
  set -euo pipefail
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  python3 --version
  role="$(sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    exec -T db psql -X -U postgres -d postgres -Atqc \
    "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='judge0';")"
  [[ "$role" == 'f|t|f|f|f' ]]
  sudo grep -qx 'MAINTENANCE_MODE=true' /opt/ingenium-judge-spike/judge0.conf
  sudo grep -qx 'ENABLE_WAIT_RESULT=false' /opt/ingenium-judge-spike/judge0.conf
  sudo grep -qx 'ENABLE_BATCHED_SUBMISSIONS=false' /opt/ingenium-judge-spike/judge0.conf
  trap 'sudo docker compose -f dependencies-v1/dependencies.compose.yaml -f api-v2/api.compose.yaml stop api' ERR
  sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    -f api-v2/api.compose.yaml up -d --pull never --no-build \
    --wait --wait-timeout 180 api
  sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    -f api-v2/api.compose.yaml ps
  api_id="$(sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    -f api-v2/api.compose.yaml ps -q api)"
  api_ip="$(sudo docker inspect "$api_id" \
    --format '{{(index .NetworkSettings.Networks "ingenium-judge-spike_judge_private").IPAddress}}')"
  python3 -B api-v2/probe-api.py "$api_ip"
)
```

The socket health check means only that the API is listening. The separate probe
uses the existing operator-owned API token in memory, prints no raw responses or
credentials and checks authentication plus selected submission restrictions. The
explicit IP must come from the current API container inspection, not a copied
old address. Before reading credentials, the probe rejects non-RFC1918 IPv4,
including loopback, public IPs, hostnames and metadata/link-local addresses. Its
POST bodies are `{}` only, never executable source. An API pass is not sandbox,
modern language-profile, trusted supervision or event readiness. The upstream
seed replaces language definitions on startup; this is a disposable lab workflow,
not a safe event restart procedure. Do not start workers or submit programs yet.
The startup block stops only the API if startup or probing fails; dependencies
and data volumes remain intact.

The user has now reported a matching v2 archive hash, three healthy containers
and all four probe PASS lines. This confirms the tested private HTTP path and
selected API restrictions, not worker or sandbox readiness.

Stop only the API with both files supplied:

```bash
sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
  -f api-v2/api.compose.yaml stop api
```

Checks without a live API:

```powershell
node --test infra/judge-spike/test/api-compose.test.mjs
python -B -m unittest discover -s infra/judge-spike/test -p test_probe_api.py -v
```

## Pre-Worker Runtime Inspection

The API receives requests; the worker compiles and executes programs. Before
preparing that more powerful service, inspect the current runtime configuration
on the judge VM. These commands display selected non-secret metadata only:

```bash
sudo docker network inspect ingenium-judge-spike_judge_private \
  --format 'Internal={{.Internal}} Driver={{.Driver}}'

sudo docker inspect --type container \
  ingenium-judge-spike-api-1 \
  ingenium-judge-spike-db-1 \
  ingenium-judge-spike-redis-1 \
  --format 'Name={{.Name}} Running={{.State.Running}} User={{.Config.User}} Privileged={{.HostConfig.Privileged}} ReadOnly={{.HostConfig.ReadonlyRootfs}} CapAdd={{json .HostConfig.CapAdd}} CapDrop={{json .HostConfig.CapDrop}} Security={{json .HostConfig.SecurityOpt}} HostPorts={{json .HostConfig.PortBindings}} Networks={{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}'

sudo docker ps -a \
  --filter label=com.docker.compose.project=ingenium-judge-spike \
  --format 'Name={{.Names}} State={{.State}}'
```

Expected: an internal bridge; only the three known services; each running with
`Privileged=false`, `ReadOnly=true`, no added capabilities, `CapDrop=["ALL"]`
and `no-new-privileges:true`. API user is `1000:999`; dependency users are
`999:999`. Host port bindings are empty (`{}` or `null`), and each service is
attached only to `ingenium-judge-spike_judge_private`. A stopped service needs
investigation, not an automatic restart of the lab stack.

Do not print full `docker inspect`, expanded configuration or raw logs: those
may expose credentials. This inspection changes nothing and does not prove
network/filesystem/resource enforcement for future submitted programs. Keep
maintenance enabled, workers stopped and the VM's four-hour STOP guard in place.

## Restart Existing Lab Services

The user later reported all three containers stopped in the same UTC second,
with no Docker-reported OOM kills; PostgreSQL/Redis exited 0 and API exited 1.
Host boot output is consistent with a later boot, but the shutdown trigger and
API's nonzero exit have not been independently diagnosed. Keep restart policies
unchanged. After reviewing that evidence, restart only the existing synthetic
lab services, not a worker or event stack.

Before running, confirm the existing VM still has its four-hour STOP guard and
no participant data. `compose start` reuses containers; it does not create or
rebuild them. API startup still runs its database setup and replaces the language
seed, so this is not an event restart procedure. No new upload is needed.
[Compose start](https://docs.docker.com/reference/cli/docker/compose/start/).

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  sudo grep -qx 'MAINTENANCE_MODE=true' /opt/ingenium-judge-spike/judge0.conf
  sudo grep -qx 'ENABLE_WAIT_RESULT=false' /opt/ingenium-judge-spike/judge0.conf
  sudo grep -qx 'ENABLE_BATCHED_SUBMISSIONS=false' /opt/ingenium-judge-spike/judge0.conf
  trap 'sudo docker compose -f dependencies-v1/dependencies.compose.yaml -f api-v2/api.compose.yaml stop api' ERR

  sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    start --wait --wait-timeout 120 db redis
  role="$(sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    exec -T db psql -X -U postgres -d postgres -Atqc \
    "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='judge0';")"
  [[ "$role" == 'f|t|f|f|f' ]]

  sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    -f api-v2/api.compose.yaml start --wait --wait-timeout 180 api
  api_id="$(sudo docker compose -f dependencies-v1/dependencies.compose.yaml \
    -f api-v2/api.compose.yaml ps -q api)"
  api_ip="$(sudo docker inspect "$api_id" \
    --format '{{(index .NetworkSettings.Networks "ingenium-judge-spike_judge_private").IPAddress}}')"
  python3 -B api-v2/probe-api.py "$api_ip"
)
```

Expect the same four probe PASS lines. If a gate or startup fails, the block
stops the API and leaves existing dependency data intact; do not automatically
retry, delete volumes, alter credentials or print raw logs to diagnose it.

The user has now reported successful recovery: all three services healthy and
the same four HTTP probe PASS lines. This does not identify the earlier shutdown
trigger or independently explain the API's earlier exit code.

## Inspect Isolate Before Preparing A Worker

Isolate is the helper Judge0 uses for sandbox setup/execution and resource limits.
The worker cannot simply inherit the API's runtime settings: the API blocks
privilege escalation, while the upstream helper installation uses a root-owned
setuid binary. Keep the API restrictions unchanged; inspect the installed helper
before reviewing a separate worker runtime.
[Upstream installation](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/Makefile),
[no-new-privileges](https://docs.kernel.org/userspace-api/no_new_privs.html).

Run on the VM while the existing API is healthy:

```bash
sudo docker exec ingenium-judge-spike-api-1 /bin/bash -c '
  set -euo pipefail
  bin="$(command -v isolate)"
  "$bin" --version
  sha256sum "$bin"
  stat -Lc "%a %u:%g %n" "$bin" /usr/local/etc/isolate \
    /var /var/local /var/local/lib /var/local/lib/isolate
  grep -E "^[[:space:]]*(box_root|cg_root|cg_parent|first_uid|first_gid|num_boxes)[[:space:]]*=" \
    /usr/local/etc/isolate
'
```

This prints a trusted helper's version and selected non-secret installation
metadata. The file `/usr/local/etc/isolate` is its static sandbox configuration,
not the private `judge0.conf`. No credentials are read, sandbox initialised,
submission compiled/run or service configuration changed. If a file is missing
or a command fails, stop and report the output rather than changing permissions.
No worker or privilege expansion is authorised by this inspection.

## Prepare The Worker Image Only

The reported helper is Isolate 1.8.1, build `v1.8.1-8-gad39cc4`, SHA-256
`c8ad768bf22499f579eb07be75379c890347272de8190302b48b2bc0bab8d1d3`.
The root-owned mode-4755 binary and mode-644 static configuration match the
reviewed installation pattern. However, `/var/local` is mode 2775, group 50:
group-writable, violating the documented root-only-write condition for sandbox
ancestors. The API's read-only root and no-new-privileges remain in place; this
does not establish an active exploit or a failed sandbox execution.
[Isolate directory requirement](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/default.cf).

The `worker-prep` target derives from the existing pinned startup stage, fixes
ownership/mode of exactly `/var/local`, `/var/local/lib` and its `isolate`
directory to root:root 0755 using `chmod 00755`, and checks those paths plus `/` and `/var` for
root ownership, exact mode and absence of symlinks. It also checks the helper
mode and reported binary fingerprint. It returns to the `judge0` user. There
is no recursive permission change, package installation or sandbox execution.
The final default `startup` target remains the API image; existing API Compose
still uses its original image ID. Do not update that ID or mount configuration.

Transfer the six allowlisted public image files in a new archive. Verify its
hash and extract under a new `image-worker-prep-v2` directory, not the release
root or previous image context. Build only on the isolated VM with its existing
four-hour STOP guard and unchanged synthetic-only scope:

```bash
sudo docker build --progress=plain --network=none --pull=false --platform=linux/amd64 \
  --target worker-prep -t ingenium/judge0-spike:worker-prep-v2 \
  image-worker-prep-v2
sudo docker image inspect ingenium/judge0-spike:worker-prep-v2 \
  --format 'ID={{.Id}} OS={{.Os}} Architecture={{.Architecture}} User={{.Config.User}} Command={{json .Config.Cmd}}'
```

The build runs trusted `chown`, `chmod`, `stat`, shell tests and `sha256sum`
inside a temporary image-build container with no network or runtime secrets.
It does not run the worker entrypoint, connect to PostgreSQL/Redis or alter any
running container or host directory. A successful build is only permission-fix
evidence, not a complete security sign-off. Worker capabilities, cgroup mounts,
effective isolation/limits and safe cleanup remain unverified. Do not run the
new image or disable maintenance yet.

Offline source-contract checks (no Docker daemon or Judge0 execution):

```powershell
node --test infra/judge-spike/test/worker-image.test.mjs
```

The first worker-preparation archive (`image-20261017-02`, context/tag v1)
failed in the permission assertion before producing an image. The original
`chmod 0755` can preserve directory setgid with the build container's privileges,
leaving mode 2755. The corrected `chmod 00755` explicitly clears special bits.
Build output now prints each checked path's actual ownership/mode. Preserve the
failed context; use the corrected archive and new v2 context/tag, not weaker
assertions or broader worker privileges.
[GNU directory mode behavior](https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html).

`test/worker-permissions.test.sh` reproduces the original failure and checks the
actual chmod mode extracted from our Dockerfile against disposable Linux fixtures.
Its root user with only CHOWN/FSETID capabilities models the relevant build
behavior, not a proposed worker runtime. The existing trusted development
PostgreSQL image supplies only Bash/coreutils; its database entrypoint is replaced:

```powershell
docker run --rm --pull=never --network none --read-only `
  --user 0:0 --cap-drop ALL --cap-add CHOWN --cap-add FSETID `
  --security-opt no-new-privileges=true --memory 64m --pids-limit 32 --cpus 0.5 `
  --tmpfs '/tmp:rw,nosuid,nodev,noexec,size=4m' `
  --tmpfs '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1m' `
  --mount "type=bind,source=$($PWD.Path)\infra\judge-spike,target=/work,readonly" `
  --entrypoint /bin/bash `
  'postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826' `
  /work/test/worker-permissions.test.sh
```

Only a uniquely created test directory under container `/tmp` is changed/removed;
no real sandbox directory, credential, database or Judge0 image is used.

The user has now reported the corrected worker image built with every directory
assertion and helper fingerprint passing. Local image ID:
`sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995`.
It is Linux/amd64, configured user `judge0`, command `/api/scripts/workers`;
the worker itself has not been started. Keep the API image reference unchanged.

## Check Workspace Creation And Cleanup Only

On the isolated VM, use the exact local image ID in a separate disposable
container. The command overrides both the worker entrypoint and its default
command: it starts no queue consumer and loads no private configuration. It
uses only Isolate's non-cgroup initialization/cleanup modes, not `--run`.
[Helper commands](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/isolate.c).

```bash
sudo docker run --rm --pull=never --platform linux/amd64 \
  --name ingenium-sandbox-workspace-check \
  --network none --read-only --user 0:0 \
  --cap-drop ALL --cap-add CHOWN \
  --security-opt no-new-privileges=true \
  --memory 128m --memory-swap 128m --pids-limit 32 --cpus 0.5 \
  --tmpfs /var/local/lib/isolate:rw,nosuid,nodev,noexec,size=16m,uid=0,gid=0,mode=0755 \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=4m,uid=0,gid=0,mode=0700 \
  --entrypoint /usr/bin/timeout \
  sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995 \
  --signal=TERM --kill-after=5s 20s /bin/bash -c '
    set -euo pipefail
    test ! -e /var/local/lib/isolate/0
    workspace="$(/usr/local/bin/isolate --box-id=0 --init)"
    test "$workspace" = /var/local/lib/isolate/0
    test -d "$workspace/box"
    printf "PASS: sandbox workspace created\n"
    /usr/local/bin/isolate --box-id=0 --cleanup
    test ! -e "$workspace"
    printf "PASS: sandbox workspace removed\n"
  '
```

No new upload is required. Root with only CHOWN is for this bounded helper-only
check, not an approved worker process or submitted-program identity. There are
no host mounts, database credentials, network connection, SYS_ADMIN capability,
privileged mode or disabled security profiles. Workspaces are temporary memory,
not the image's persistent layer or a host sandbox directory. The timeout and
resource settings bound this check, not event recovery/drain semantics.

Expect two PASS lines. If the check fails, report its output without rerunning
with extra capabilities or weaker restrictions. It verifies only workspace
creation/cleanup: namespace execution, per-job cgroups, network/filesystem
isolation during execution, effective resource enforcement and trusted evidence
are still untested. Keep API maintenance enabled and queue workers stopped.

The user has now reported both expected workspace PASS lines. This proves the
tested directory creation/removal path only; no cgroup or submitted program has
been exercised.

## Inspect Host Cgroup Topology

This Isolate version uses cgroup-v1 `memory` and `cpuacct` controller paths, with
optional `cpuset`. Inspect the current VM layout before selecting a dedicated
test hierarchy; do not grant writable access to the whole host hierarchy.
[Helper cgroup implementation](https://github.com/judge0/isolate/blob/ad39cc4d0fbb577fb545910095c9da5ef8fc9a1a/cg.c).

Run these read-only commands on the VM host, not inside the API container:

```bash
sudo docker info --format 'CgroupVersion={{.CgroupVersion}} Driver={{.CgroupDriver}} Security={{json .SecurityOptions}}'
findmnt -rn -t cgroup,cgroup2 -o TARGET,FSTYPE,OPTIONS
readlink -f /sys/fs/cgroup/memory /sys/fs/cgroup/cpuacct /sys/fs/cgroup/cpuset
stat -Lc '%a %u:%g %n' /sys/fs/cgroup/memory /sys/fs/cgroup/cpuacct /sys/fs/cgroup/cpuset
cat /sys/fs/cgroup/memory/memory.use_hierarchy
```

These display mount/permission metadata and one hierarchy flag, not credentials.
The legacy hierarchy flag is diagnostic only, not proof of effective limits.
They create no group, change no limit and move no process. A missing path or
changed cgroup version needs review, not an automatic remount/reboot or a switch
to privileged containers. Later delegation must retain effective aggregate
limits when processes change group and must include verified cleanup. Keep
workers stopped and maintenance enabled pending that review.

The supplied VM output confirms v1/cgroupfs with default AppArmor/seccomp, the
expected memory and combined CPU/accounting aliases, and mode-555 root-owned
controller roots. The final memory hierarchy value was not included; the helper
below prints and validates it before making changes. Do not chmod the global
controller roots.

## Check Empty Cgroup Creation And Cleanup

Transfer only `cgroup-preflight.sh` as a reviewed public archive, verify its hash
and extract into a new `cgroup-check-v1` directory under the release. No image
rebuild, service restart or private-config transfer is needed. Run only on the
isolated VM with its four-hour STOP guard unchanged:

```bash
sudo bash cgroup-check-v1/cgroup-preflight.sh
```

The helper creates two fresh mode-700 cgroup parents, plus a private temporary
static configuration under `/run`. It binds only the fresh memory/CPU-accounting
parents writable into a timeout-bounded, network-disabled container. The helper
uses the existing exact worker image ID but overrides its entrypoint/command;
no worker queue starts and no credentials enter the container. Root has only
CHOWN, no-new-privileges and no SYS_ADMIN/privileged mode or disabled profiles.

Inside the container it creates and removes empty groups using Isolate's `--cg`
initialization/cleanup modes, with assertions on workspace, group paths and empty
task lists. It does not use `--run`, move a PID, change resource limits or expose
optional cpuset. After confirmed success the host verifies the groups are empty
and removes only its new allocations with `rmdir`, never recursive deletion.
Controller-root permissions/limits, API image, secrets and data volumes remain unchanged.

Expected: `MemoryHierarchy=1` and three PASS lines for empty-group creation,
sandbox/group cleanup and host-parent cleanup. A failed or uncertain Docker
outcome preserves the allocated paths for inspection. Stop and share output;
do not rerun, kill processes, remove directories or weaken privileges to recover
automatically. The first two new cgroup parents are outside Docker's own child
group, so this empty-only test is NOT an execution profile or proof that later
program limits would be retained there. No submitted program is run.

Host-orchestration unit checks require a disposable root test container with
empty `/run` and `/tmp` tmpfs mounts, a read-only source mount and no network.
They export command stubs; no actual cgroup mutation, Docker call or Judge0
execution occurs. From the repository root in PowerShell:

```powershell
docker run --rm --pull=never --network none --read-only `
  --user 0:0 --cap-drop ALL --security-opt no-new-privileges=true `
  --memory 128m --pids-limit 64 --cpus 1 `
  --tmpfs '/tmp:rw,nosuid,nodev,noexec,size=8m' `
  --tmpfs '/run:rw,nosuid,nodev,noexec,size=4m,uid=0,gid=0,mode=0755' `
  --tmpfs '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=1m' `
  --mount "type=bind,source=$($PWD.Path)\infra\judge-spike,target=/work,readonly" `
  --entrypoint /bin/bash `
  'postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826' `
  /work/test/cgroup-preflight.test.sh
```

The user has reported `MemoryHierarchy=1` and all three PASS lines, including
host-parent cleanup. The empty-group lifecycle check is complete; it has not
tested process execution, effective per-job limits or cleanup after a crash.

## Inspect AppArmor Before Execution

Run these read-only commands on the isolated VM, not Cloud Shell:

```bash
hostname
sudo apparmor_parser --version
sudo cat /sys/module/apparmor/parameters/enabled
sudo docker inspect --type container ingenium-judge-spike-api-1 \
  --format 'AppArmor={{.AppArmorProfile}}'
```

Share the output, including any missing-tool error. The hostname must match
`ingenium-judge-spike-01`. These commands inspect the parser, kernel setting and
current container profile; they load no policy, change no service and run no
submitted program. Docker's default AppArmor profile denies mounts needed by
Isolate's execution mode. Review a separate test profile before proceeding;
do not disable AppArmor/seccomp or alter the global Docker policy. Keep API
maintenance enabled, queue workers stopped and the four-hour STOP guard intact.
[Docker guidance](https://docs.docker.com/engine/security/apparmor/),
[default profile source](https://github.com/moby/profiles/blob/main/apparmor/template.go).

The user has reported parser 3.0.4, enabled state `Y` and API profile
`docker-default` on the expected VM. No policy was changed by that inspection.

## Run One Trusted Command In A Namespace

Transfer `namespace-smoke.sh` and `namespace-smoke.apparmor` together in the
reviewed public archive. Verify its checksum and extract into a new
`namespace-check-v1` directory under the VM release directory. Keep the existing
four-hour STOP guard; no new VM, service, image build or credentials are needed.
Archive: `ingenium-judge-namespace-check-20261017-01.tar.gz`, 2,612 bytes;
SHA-256 `2d3967acb543b837fe35eb4ff33181e8fb1600ff12d144041661e5301135dfa0`.

```bash
sudo bash namespace-check-v1/namespace-smoke.sh
```

The helper compile-checks its private copy of the profile without loading it,
then loads the separately named `ingenium-isolate-smoke-v1` profile for one
temporary container. Docker's default profile and API remain unchanged. The
temporary container has no network, host binds or secrets, retains Docker
seccomp/no-new-privileges, and has bounded memory/PIDs/CPU/tmpfs/time. It needs
selected capabilities, including SYS_ADMIN, for Isolate's namespace setup.
This is only a fixed trusted-command lab profile, not safe event-worker approval.

Expected four PASS lines: profile compiled; `/usr/bin/id -u` returned sandbox UID
60000 with clean exit metadata; workspace removed; stopped container and profile
removed. Isolate may also print its own `OK` timing line. No participant source,
compiler or queue worker starts. No `--cg` is used; all processes stay under the
outer Docker limits instead of entering the earlier empty test branches.

If any step fails, share the output and do not rerun, remove the retained profile
or container, or disable AppArmor/seccomp. An uncertain state deliberately retains
evidence for inspection. Actual per-job cgroup enforcement and crash cleanup are
still separate, unproved requirements.

The local orchestration checks use command stubs only, in the same trusted root
test container and empty `/run`/`/tmp` mounts as the cgroup checks above. Replace
the final test filename with `/work/test/namespace-smoke.test.sh` to run them.
They do not compile/load AppArmor policy or execute Judge0 locally.

The user has reported all four PASS lines, including workspace and test
container/profile removal. Isolate's `OK` timing and the removed container name
are normal output. This establishes the fixed-command path only, not approval
for participant submissions or proof of resource enforcement under load.

## Inspect The Stock C++ Compiler

Run on the isolated VM. This asks the existing compiler for metadata only, with
no source input, no worker, no mounts/secrets and no new image or profile:

```bash
sudo docker run --rm --pull=never --platform linux/amd64 \
  --network none --read-only --user 65534:65534 \
  --cap-drop ALL --security-opt no-new-privileges=true \
  --memory 128m --memory-swap 128m --pids-limit 16 --cpus 0.5 \
  --entrypoint /usr/bin/timeout \
  sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995 \
  --signal=TERM --kill-after=2s 10s /bin/bash -c '
    set -euo pipefail
    compiler=/usr/local/gcc-9.2.0/bin/g++
    "$compiler" --version
    "$compiler" -dumpmachine
    "$compiler" -print-prog-name=cc1plus
    "$compiler" -print-prog-name=as
    "$compiler" -print-prog-name=ld
    "$compiler" -print-file-name=libstdc++.so.6
  '
```

Share the output, including missing-tool errors; do not install a different
compiler to bypass an error. The selected path comes from the tagged language
seed and still needs runtime confirmation. This stock GCC 9.2.0 probe does not
change our GCC 15 event target. Keep maintenance enabled, queue workers stopped
and the four-hour STOP guard unchanged.
[Tagged language seed](https://github.com/judge0/judge0/blob/v1.13.1/db/languages/active.rb).

The user reported GCC 9.2.0, target `x86_64-pc-linux-gnu`, the expected cc1plus
and C++ library paths, and names `as`/`ld`. These last two are tool lookup names,
not errors; they have not yet been exercised by compilation.

## Compile And Run The Trusted C++ Program

The version-two public archive contains the extended `namespace-smoke.sh` and
the unchanged `namespace-smoke.apparmor`. Verify its checksum and extract into
a fresh `namespace-check-v2`, preserving `namespace-check-v1` and its evidence.
No rebuild, new VM, dependency installation or API configuration change is needed.
Run on the isolated VM with the four-hour STOP guard unchanged:

Archive: `ingenium-judge-namespace-check-20261017-02.tar.gz`, 3,202 bytes;
SHA-256 `ce0cd3c7004d7496e228dcb81429d60319b4a5fadbb1822987bca3266bbf9177`.

```bash
sudo bash namespace-check-v2/namespace-smoke.sh
```

Expected six PASS lines: profile compiled; sandbox identity command passed;
C++17 program compiled; three answers matched exactly with real/effective
UID/GID checks; workspace removed; stopped container and profile removed.
Isolate also prints its own timing lines. Share any failure without rerunning,
removing retained evidence or weakening restrictions.

Only a fixed sum program is compiled. The test checks positive, negative and
64-bit results, clean exit metadata, empty diagnostics and exact output bytes.
The temporary container has 256 MiB/no-extra-swap, 64 PIDs, one CPU, a 32 MiB
nosuid/nodev executable workspace and a 45-second timeout plus five-second kill
grace. Compiler subprocesses are allowed only within this bounded experiment;
the same seven capabilities, named AppArmor, seccomp, no-new-privileges,
read-only root, no network and no host binds/secrets remain. TMPDIR points to
the sandbox workspace; expected output remains outside the inner sandbox.

There is still no worker queue, participant code, API submission or writable
host cgroup delegation. A successful compile/run is not proof of effective
per-job limits, crash cleanup or safe event execution. The GCC 15 event target
does not change. Local checks use stubs, not an actual compiler or Judge0.

The user has now reported all six PASS lines on the isolated VM. Compilation
took 1.075 seconds wall time for this tiny program; the three exact-output and
identity checks plus normal cleanup passed. This is not an event-load benchmark.

## Inspect Docker Resource Membership

Run these read-only commands on the VM. The existing API container is only a
reference for Docker's layout; its limits and security policy must not change.

```bash
sudo docker inspect --type container ingenium-judge-spike-api-1 \
  --format 'Running={{.State.Running}} CgroupNS={{.HostConfig.CgroupnsMode}} Memory={{.HostConfig.Memory}} MemorySwap={{.HostConfig.MemorySwap}} NanoCPUs={{.HostConfig.NanoCpus}} PidsLimit={{.HostConfig.PidsLimit}} CgroupParent={{.HostConfig.CgroupParent}}'

sudo docker exec --user 65534:65534 ingenium-judge-spike-api-1 \
  /bin/cat /proc/self/cgroup
```

Share the output, including a stopped-container error if present. This prints
selected resource configuration and process membership only, not secrets or
environment values. It starts no worker, compiles nothing, writes no controller
file and changes no service. Container paths may be namespace-relative; review
them before selecting any host path. The API must never be the destination for
test program execution or writable cgroup delegation.

The next isolated probe needs job groups below a bounded execution container's
own parents, with runtime evidence that aggregate limits remain effective.
Do not reuse the earlier empty groups outside Docker's child hierarchy for
execution, expose the whole host controller tree or change API/global limits.
Keep maintenance enabled, queue workers stopped and the four-hour STOP guard.
[Docker cgroup layout](https://docs.docker.com/engine/containers/runmetrics/).

The user has reported a running API in the host cgroup namespace, with matching
`/docker/<id>` controller membership. Docker reports 768 MiB RAM, 1,536 MiB combined
RAM/swap, 0.75 CPU and 128 tasks. The combined memory/swap ceiling is not usage or
proof that the VM has swap. Host cgroup visibility is not host networking or
privileged mode. No settings need changing from this output.

## Read Kernel Resource Settings

Run on the isolated VM. This reads the API's controller values as a layout
reference, not as a target for test execution or delegation. A current full
container ID avoids hard-coding an ID from an earlier boot/recreation.

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  id="$(sudo docker inspect --type container ingenium-judge-spike-api-1 --format '{{.Id}}')"
  [[ "$id" =~ ^[0-9a-f]{64}$ ]]
  memory="/sys/fs/cgroup/memory/docker/$id"
  cpu="/sys/fs/cgroup/cpu,cpuacct/docker/$id"
  pids="/sys/fs/cgroup/pids/docker/$id"

  sudo grep -H . "$memory"/memory.{limit_in_bytes,memsw.limit_in_bytes,use_hierarchy} \
    "$cpu"/cpu.cfs_{quota,period}_us "$pids"/pids.max
  grep -E '^Swap(Total|Free):' /proc/meminfo
)
```

Share the output, including missing files. Do not create controller paths,
change hierarchy flags/limits, add swap or restart/recreate services to make
the inspection pass. These are configured kernel values, not an enforcement
stress test. Keep maintenance enabled, workers stopped and the four-hour STOP
guard unchanged. No new archive, image, privileges or network access is needed.

The user reported all six expected kernel values and no host swap (SwapTotal
and SwapFree both zero). They agree with Docker configuration; no API/controller
change or swap installation is needed. Actual enforcement remains untested.

## Run A Trusted Command In Bounded Job Cgroups

Transfer `cgroup-smoke.sh` and the unchanged `namespace-smoke.apparmor` in the
reviewed public archive. Verify the checksum and extract into a new
`cgroup-run-v1` directory under the VM release directory. No service restart,
image build, dependency installation or API configuration change is needed.
Keep the VM's four-hour STOP guard unchanged, then run on that isolated VM:

Archive: `ingenium-judge-cgroup-run-20261018-01.tar.gz`, 4,183 bytes;
SHA-256 `7fdbd2294d8438be2eed2e1bb46a3dbc3e2b0c295fc04690d99366350c2bd51b`.

```bash
sudo bash cgroup-run-v1/cgroup-smoke.sh
```

This allocates only fresh, tracked controller parents. The host sets and verifies
an aggregate 128 MiB RAM/no-extra-swap, 0.5 CPU and 32-task budget before Docker
starts. A custom Docker parent places both its keeper/proxy processes and the
job's memory/CPU groups below that budget. Only two fresh `jobs` branches are
bound writable; the aggregate limit files are not exposed. The hybrid v2
bookkeeping group is tracked for cleanup as well. Root/existing API settings,
profiles, credentials and data volumes are not changed.

Expect seven PASS lines: profile compiled; aggregate budgets verified; container
membership verified; UID 60000 command executed with positive job accounting;
job groups/workspace removed; container/profile removed; host groups/files
removed. The helper also prints job peak-memory bytes and CPU nanoseconds.

This is an identity/accounting check, not an exhaustion test. It runs only
`/usr/bin/id -u` with a 32 MiB job cap, no worker queue or participant code.
The existing named AppArmor, seccomp, no-new-privileges, read-only root, no
network and bounded timeout remain. Host cgroup namespace visibility does not
grant writable access to the whole host hierarchy. Optional per-job cpuset is
not tested. Do not reuse the earlier unbounded empty-check groups for execution.

On any failure, share the output and do not rerun, weaken restrictions or
manually delete the retained groups/container/profile. Uncertain results keep
their state for inspection; successful cleanup uses only `rmdir` on owned empty
groups. This is not proof of crash recovery or event readiness.

Local checks use the same trusted Bash/coreutils test container and empty
`/run`/`/tmp` mounts as earlier, with at least 16 MiB for test `/tmp`. Run
`/work/test/cgroup-smoke.test.sh`. Commands and controller files are simulated;
no Docker call, real controller mutation or Judge0 execution occurs in those checks.

## Check Controlled CPU And Memory Failures

The user reported all seven version-one bounded-job PASS lines, including
311296 peak job bytes, 2937729 CPU nanoseconds and normal cleanup. Preserve that
archive and its `cgroup-run-v1` directory as the earlier experiment.

The new public version-two archive contains the extended `cgroup-smoke.sh` and
the unchanged AppArmor profile. Transfer it as before, verify its checksum and
extract into a new `cgroup-run-v2` directory. Run only on the isolated judge VM:

Archive: `ingenium-judge-cgroup-run-20261018-02.tar.gz`, 5,063 bytes;
SHA-256 `36b75814dcaf7385ef8d1851b9cfab173e99833d2a36bac43400d0a61de5c184`.

```bash
sudo bash cgroup-run-v2/cgroup-smoke.sh
```

No service restart, image build, installation, new firewall rule or API change
is needed. Keep maintenance enabled, workers stopped and the four-hour STOP
guard unchanged. The same aggregate 128 MiB/no-extra-swap, 0.5 CPU, 32-task
budget and security profile remain. The outer test timeout is thirty seconds
with five-second kill grace, not a VM runtime extension.

After repeating the identity/accounting check, this deliberately runs:

- A fixed loop that must be terminated by its 0.2-second CPU limit, not its
  five-second wall fallback. It has a 32 MiB memory/address-space cap.
- A fixed 32 MiB allocation that must be killed by its 16 MiB job memory limit.
  Address space is capped at 256 MiB, with three-second CPU/eight-second wall
  fallback limits. The kernel OOM killer is not disabled or modified.

Each program runs as UID/EUID 60000 with one allowed process. The checks require
specific failure metadata, kernel accounting, empty task lists and fresh-group
cleanup. Overall parent memory-limit hits and Docker-reported OOM kills must
not occur. No participant program, secret or worker queue is involved.

Expect nine PASS lines, including the new `cpu job limit` and `memory job limit`
successes. Isolate will intentionally print `Time limit exceeded` and
`Caught fatal signal 9`; these are expected only when followed by their PASS
lines and successful final cleanup. Any unexpected failure retains evidence:
share it without rerunning, deleting groups or loosening restrictions.

Local coverage now has seven grouped orchestration/membership/result checks;
run the same test command as above. They use synthetic evidence, not actual
CPU/memory pressure or Judge0. Passing this VM probe would still not prove
participant isolation, process-tree/crash recovery or event throughput.

### Version-Two Failure: Inspect Before Rerunning

The actual version-two run passed its CPU-limit check, then reported expected
OOM/SIGKILL metadata but failed memory-result classification. Cleanup did not
complete. Leave container `ingenium-cg-run-DbVTzW`, profile
`ingenium-isolate-smoke-v1`, host parent `/ingenium-cg-run.DbVTzW` and private
files `/run/ingenium-cg-run.DbVTzW` untouched pending read-only inspection.

The source checker has been corrected to inspect both `memory.failcnt` and
`memory.memsw.failcnt`: the combined limit can be hit before RAM's counter
increments. At that checkpoint, local regression checks passed but retained VM
counter values and remaining cleanup checks were not yet known. Do not rerun the version-two
archive, restart services, change limits or unload the retained profile to
bypass the guard. The subsequent diagnosis and corrected archive are recorded below.

### Confirmed Counter Bug: Remove The Failed Probe

The user confirmed RAM-only hits 0, combined-memory hits 38 and one OOM kill in
the 16 MiB job. Both aggregate hit counters and aggregate OOM kills stayed zero.
Docker is stopped with exit 1 and OOMKilled false; job task lists are empty.
This confirms the checker bug, not a completed end-to-end probe. Preserve earlier
archives and the recorded evidence. This one-off cleanup applies only to that
exact failed test on the isolated VM; stop on any failure without adding force
or recursive deletion. It does not start code or change resource limits.

```bash
sudo bash <<'BASH'
set +x
set -euo pipefail
test "$(hostname)" = ingenium-judge-spike-01
name=ingenium-cg-run.DbVTzW
container=ingenium-cg-run-DbVTzW
runtime="/run/$name"
test "$(stat -c '%u:%g:%a' "$runtime")" = 0:0:700
test ! -L "$runtime"
test "$(sha256sum "$runtime/profile" | cut -d ' ' -f 1)" = 20c07caaefcebcd4b8b8a402952965fd9e41bda18874e3924ed13c6964572818
test "$(docker inspect --type container "$container" --format '{{.State.Running}}|{{.State.ExitCode}}|{{.State.OOMKilled}}|{{.AppArmorProfile}}|{{.HostConfig.CgroupParent}}')" = "false|1|false|ingenium-isolate-smoke-v1|/$name"

mounts="$(findmnt -rn -t cgroup -o TARGET)"
mapfile -t roots <<< "$mounts"
roots+=(/sys/fs/cgroup/unified)
for root in "${roots[@]}"; do
  [[ "$root" =~ ^/sys/fs/cgroup/[a-z_,]+$ ]]
  test "$(readlink -f "$root/$name")" = "$root/$name"
  expected=cgroupfs
  [[ "$root" != /sys/fs/cgroup/unified ]] || expected=cgroup2fs
  test "$(stat -fc %T "$root")" = "$expected"
  test -d "$root/$name"
done

docker rm "$container"
for controller in memory cpu,cpuacct; do
  rmdir -- "/sys/fs/cgroup/$controller/$name/jobs/box-0"
  rmdir -- "/sys/fs/cgroup/$controller/$name/jobs"
done
for root in "${roots[@]}"; do rmdir -- "$root/$name"; done
apparmor_parser --remove --skip-cache "$runtime/profile"
rm -- "$runtime/profile" "$runtime/isolate.conf"
rmdir -- "$runtime"
printf 'PASS: failed probe container, empty cgroups, profile and temporary files removed\n'
BASH
```

`rmdir` refuses nonempty/live cgroups; do not replace it with recursive deletion.
Share the final PASS or any failure before running the corrected probe. This
manual recovery is not a demonstration of the event supervisor's crash protocol.

### Fresh Corrected Probe After Cleanup

The user has reported the failed-probe cleanup PASS, including container,
empty-group, profile and temporary-file removal. Do not repeat that cleanup.
Transfer the new public
`ingenium-judge-cgroup-run-20261018-03.tar.gz` archive (5,160 bytes), SHA-256
`3a6aae11810a58be5936b420f64346193601e57e760be4f742faf5cd6d7d2b88`.
Verify it and extract into a fresh `cgroup-run-v3` directory, preserving older
archives/directories. It contains only `cgroup-smoke.sh` and the unchanged
AppArmor profile; no cleanup script or secrets are included.

Run `sudo bash cgroup-run-v3/cgroup-smoke.sh` only after cleanup is confirmed.
Expect nine PASS lines as before. Both `MemoryLimitHits` and `CombinedLimitHits`
are now printed before result classification. The memory case accepts either
positive counter with the same strict OOM/signal requirements; the CPU case
requires both counters zero. The trusted programs, security controls, outer
aggregate limits and timeouts are unchanged. Keep workers stopped, maintenance
enabled and the VM's four-hour STOP guard unchanged. A complete corrected VM
run is still pending; stop and report any new failure without rerunning.

### Corrected Probe Passed

The user subsequently reported all nine version-three PASS lines and complete
normal cleanup. Identity accounting reported 311296 peak bytes and 2756314 CPU
ns. The CPU loop stopped with 244452077 CPU ns and both memory-hit counters
zero; the memory allocation stopped with 45617241 CPU ns, zero RAM-only hits
and 51 combined-memory hits. Container `ingenium-cg-run-M0jV9v`, its test profile,
job/workspace groups, host parents and temporary files were removed.

Do not repeat these checks or the earlier manual cleanup just to advance.
The next proposed chunk is a separately reviewed fixed C++ compile/run using
bounded job groups, including compiler-child accounting and exact output.
No queue worker, participant submission or production toolchain is approved
by these fixed-program results. Keep maintenance enabled and the four-hour
STOP guard unchanged; automatic crash recovery and event load remain untested.

### Compile And Run C++ In Bounded Job Groups

Version four extends the same helper with the earlier known C++ program; older
archives/directories remain unchanged. Transfer the new public archive, check
its checksum and extract into fresh `cgroup-run-v4` on the isolated VM, then run:

Archive: `ingenium-judge-cgroup-run-20261018-04.tar.gz`, 6,177 bytes;
SHA-256 `592e051eb51133c2e8b3763abdf86207b7311cfd04dd98504880a4c9e0eee76c`.

```bash
sudo bash cgroup-run-v4/cgroup-smoke.sh
```

The compiler has a 128 MiB aggregate job cap and 128 MiB per-process address
space, with up to eight processes and five CPU/fifteen wall seconds. The overall
fresh test parent/container is now 256 MiB/no-extra-swap, still 0.5 CPU and 32
tasks. A 16 MiB temporary workspace permits execution of the compiled binary;
nosuid/nodev remain, and other temporary mounts remain noexec. The outer timeout
is sixty seconds plus five-second kill grace. No VM resize, API change, new
capability, security-profile change, dependency installation or image build occurs.

The helper repeats the earlier CPU/memory checks, then compiles a fixed sum
program with the known GCC 9.2.0. It observes a `cc1plus` child in both job
controllers from outside the inner sandbox; no `/proc` or controller mount is
added inside it. Clean compile metadata, empty diagnostics, positive accounting
and empty job task lists are required. Three separately checked answers include
positive, negative and 64-bit sums, with UID/GID 60000 checks and 32 MiB job caps.

Expect eleven PASS lines plus diagnostic/timing output. New output includes
`CompilerChildPid=... MemoryAndCpuGroups=verified`, `CppPhase=compile`, three
`CppPhase=run` lines, and the compilation/exact-answer PASS lines. The earlier
intentional timeout/SIGKILL messages must still be followed by their PASS lines.
Do not infer success from just seeing compiler output; final cleanup must pass.

Missing child observation, compile failure, limit hit, wrong output or uncertain
cleanup fails and retains evidence. Share it without rerunning, raising limits,
disabling profiles or deleting retained groups. This is a fixed-program lab
experiment, not automated crash recovery, event capacity or participant safety
approval. Keep maintenance enabled, workers stopped and four-hour STOP unchanged.

Local coverage is now ten grouped tests in `/work/test/cgroup-smoke.test.sh`,
using the same trusted Bash/coreutils environment as before, not real Judge0.

### Bounded C++ Probe Passed

The user reported all eleven version-four PASS lines and complete normal
cleanup. `cc1plus` PID 82 was observed in both job controllers. Compilation
reported peak memory 65892352 bytes (62.84 MiB), CPU 650870152 ns and wall time
1.444 seconds. All three exact answers, UID/GID checks, ordinary-run accounting
and empty-task checks passed; container `ingenium-cg-run-xsVOOW` and all test
groups/profile/files were removed.

The run peaks include charges in a group reused after compilation; do not read
them as the sum program's isolated RSS or an event capacity benchmark. No extra
cleanup or repeat compilation is needed to advance. The final language profiles,
complete API/queue flow, crash recovery and participant safety remain unverified.

The VM was restarted before this successful probe, but the private lab services'
current health was not checked. On that VM, inspect only their existing state:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  sudo docker ps -a \
    --filter label=com.docker.compose.project=ingenium-judge-spike \
    --format 'Name={{.Names}} State={{.State}} Status={{.Status}} Ports={{.Ports}}'
)
```

Share the inventory before starting or recreating services. This reads no
credentials, exposes no port and starts no worker. Preparing a fixed single-job
worker/API experiment is the next chunk, not permission to start the stock
worker loop or send participant source. Keep maintenance and four-hour STOP
unchanged.

The user reported all three existing services exited after the VM restart:
API exit 1, PostgreSQL exit 0 and Redis exit 0, all shown as ten hours old.
No worker or published port was listed. Use the earlier **Restart Existing Lab
Services** block, not `compose up`, to start only the retained dependencies and
API and repeat the four maintenance/authentication gates. It reuses existing
containers/volumes, but API startup still runs lab database setup/language seed.
The API's prior nonzero exit cause is not diagnosed by this inventory. Keep its
failure-stop trap and do not delete data, change secrets or start a worker to
make recovery pass. Successful post-restart recovery remains pending.

### Post-C++ Service Recovery Passed

The user has now reported both dependencies healthy, followed by the API healthy
and all four HTTP probe PASS lines: unauthenticated 401, authenticated version
200, maintenance creation rejection 503 and batches disabled 400. No executable
payload was submitted, worker started or container/volume recreated. The API's
previous exit code 1 is still not independently explained.

No further restart/probe is needed for this checkpoint. Next prepare the fixed
single-job lab runner; do not start the existing worker script. Its upstream
restart/retry behavior and the job's sandbox-ID/default-mount assumptions differ
from our successful bounded helper. Keep maintenance enabled, workers stopped,
ports private and the four-hour STOP guard unchanged while that code is prepared.

### Read-Only Queue and C++ Contract Check

Before writing the one-job adapter, check the live lab's idle state and language
definition with `probe-queue.py`. This is not a worker: it never removes a queue
item, runs a program, boots Rails or changes maintenance. No new Docker image
or service restart is required. It uses the clients already installed in the
database and Redis containers, with credentials read inside those containers
and never placed in host command arguments or printed.

Local archive:
`runtime-data/judge-spike/ingenium-judge-queue-check-20261018-01.tar.gz`.
It contains only the Python probe, without credentials.

Archive checksum (SHA-256):
`feee99904f00de3b059369f59952a8cfc34c8e4b00a5a7c0643b8faf6da8138f`.

Upload that archive to Cloud Shell using its file-upload menu. From Cloud Shell,
not from the VM:

```bash
gcloud compute scp ~/ingenium-judge-queue-check-20261018-01.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then, inside the existing VM:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo 'feee99904f00de3b059369f59952a8cfc34c8e4b00a5a7c0643b8faf6da8138f  ingenium-judge-queue-check-20261018-01.tar.gz' | sha256sum -c -
  mkdir -m 700 queue-check-v1
  tar -xzf ingenium-judge-queue-check-20261018-01.tar.gz -C queue-check-v1
  sudo python3 -B queue-check-v1/probe-queue.py
)
```

Expect four PASS lines: only the three lab services running, configured API
restrictions/version unchanged, the exact stock C++ profile with no submission
records, and no queued/failed jobs or registered workers. The database command
uses a verified read-only connection default; Redis uses `EVAL_RO`, which cannot
write dataset keys. The keyspace check is intentionally limited to the known
idle lab, not a general queue monitor. Unknown keys, existing submissions or
other work are reasons to inspect, not flush/truncate/delete.

The assistant's local tests simulate command responses. The user has now
reported the archive checksum OK and all four PASS lines against the existing
VM services, including the live SQL/Lua checks. No program was submitted,
dequeued or executed by this probe; no cleanup or repeat run is needed for this
checkpoint.

A pass is only an idle snapshot: it is not a lock, proof of physical process
drain or approval to start the stock worker. Next prepare and locally test the
fixed single-job lab runner before enabling any executable API request. Keep
maintenance enabled, workers stopped, ports private and the four-hour STOP guard
unchanged. API job creation, queue message format, execution/result lookup and
crash recovery are not verified by this read-only check.

Run both Python probe suites locally without Docker or real credentials:

```powershell
python -B -m unittest discover -s infra/judge-spike/test -p 'test_probe_*.py'
```

## One Complete Fixed-Job Lab Run

`one-job.py` now joins API creation, queue validation/claim, the already-tested
bounded C++ helper, result storage and original-API result lookup in one operator
run. This is a fixed trusted fixture and custom lab adapter, not the stock
retrying worker or a general participant runner. The user has now reported the
version-two archive and full sequence passing; see the checkpoint below.

The original API stays in maintenance. A temporary API uses a private config
copy and the original entrypoint guards, with no published ports or DB reseeding;
it posts one known job, then is stopped/removed before sandbox execution. Only
the exact sum source/input/limits and first-delivery queue envelope are accepted.
The sandbox remains credential-free and networkless. Its existing CPU/memory
and three-case checks remain; the queued `7 5` case's real `12\n` output and
measured accounting are saved only after confirmed normal cleanup.

This run intentionally creates a disposable Judge0 submission and consumes its
one queue item. It does not alter the application DB or delete any existing
service/volume. `/opt/ingenium-judge-spike/one-job-v1` is an exclusive persistent
run record, not a folder to remove for retries. Stages are fsynced before side
effects; ambiguous creation/claim/execution/save does not automatically replay.
Private API/sandbox logs and the final lab row are retained for inspection.

Upload local archive
`runtime-data/judge-spike/ingenium-judge-one-job-20261018-02.tar.gz` to Cloud Shell.
It contains only `one-job.py`, `lab-server.sh`, `cgroup-smoke.sh`, the existing
AppArmor profile and the two existing Python probes. It contains no credential
values and requires no image rebuild or dependency installation.

From **Cloud Shell**, not inside the VM:

```bash
gcloud compute scp ~/ingenium-judge-one-job-20261018-02.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then run **once inside the VM**, with the existing lab services healthy:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo '72bde9b89dcb99753db1b4d3fed402c170be50c8a633df519d4722695c1a8d26  ingenium-judge-one-job-20261018-02.tar.gz' | sha256sum -c -
  mkdir -m 700 one-job-v2
  tar -xzf ingenium-judge-one-job-20261018-02.tar.gz -C one-job-v2
  sudo timeout --signal=TERM --kill-after=30s 300s python3 -B one-job-v2/one-job.py
)
```

The script repeats the existing read-only preflight and original four API gates,
then reports creation/temporary API cleanup, exact queue claim, sandbox execution
and cleanup, byte-exact original-API result lookup and the final idle queue with
maintenance still enabled. Sandbox detail is retained in its root-private log,
not dumped to the terminal. This five-minute caller deadline does not remove or
extend the VM's four-hour STOP setting.

Share the terminal PASS/FAIL output. If anything fails or the command times out,
do not rerun, clear data, delete the persistent record or force-remove retained
containers/cgroups. A stopped or restarted VM does not authorise a retry. After
success the submission/journal remain, so do not rerun the earlier empty-database
queue probe and then erase data to satisfy it. The old helper archives remain
unchanged; this new archive adds structured result evidence to the helper.

Local checks (no Judge0 or submitted code execution):

```powershell
python -B -m unittest discover -s infra/judge-spike/test -p 'test_*.py'
node --test infra/judge-spike/test/worker-image.test.mjs infra/judge-spike/test/api-compose.test.mjs infra/judge-spike/test/dependencies.test.mjs
```

The documented isolated Bash/coreutils test containers also pass the updated
13 startup cases and 11 grouped cgroup-orchestration checks. Those local tests
simulate runtime boundaries; the cloud checkpoint below is separate evidence.

### Fixed One-Job Cloud Run Passed

The user reported the version-two archive checksum OK and all 17 PASS lines:
the idle preflight and original four API gates, one asynchronous creation and
temporary API removal, exact persisted-payload/envelope validation and queue
claim, bounded C++ execution with confirmed normal cleanup, repeated original
API gates, exact real stdout `12\n` on result lookup, and an empty queue with
maintenance still enabled. No stock worker was started. Detailed new timing or
memory values were not supplied; this is not an event-load benchmark.

Do not repeat the run or delete its record. Preserve the lab submission and
root-private journal/logs; no further service restart, upload or cleanup is
needed for this success. The earlier empty-database probe is no longer the
right post-run check. Keep the existing API in maintenance, workers stopped,
ports private and the four-hour STOP guard unchanged.

The prepared batch below extends controlled failure/output-limit coverage through
the queued path without allowing arbitrary source or erasing this evidence. Final event
toolchains, general participant execution, stream completeness, recovery/drain
and event throughput remain unverified. The assistant has recorded the user's
output, not accessed the VM or inspected the private run files.

### Batched Failure Suite Prepared

**This one-shot batch has now passed. Do not repeat the historical first-run
procedure below; see the cloud checkpoint after it.**

This is one new run, not a repeat of `one-job.py`. Eight fingerprinted C++
fixtures cover wrong output, compilation error, SIGSEGV, nonzero exit, CPU
timeout, job OOM, output overflow and a normal exit producing exactly 8 KiB.
The last two distinguish incomplete output from valid output at the cap.
Only the supplied fixtures may run; there is no arbitrary-source option.

The runner requires the completed baseline journal and its exact successful
database row. It creates eight jobs once through one temporary private API,
removes that API before any claim, then validates, claims, executes, saves and
reads each result sequentially. It reuses the tested sandbox parent, profile,
capabilities and cleanup rules. A fresh runtime job group separates compiler
cache charges from the 16 MiB memory test. Core dumps are disabled.

The wrong-output fixture receives legacy provider status `Accepted` because
expected output is deliberately not sent to Judge0; the private fixture check
records `WRONG_OUTPUT`, not competition acceptance. OOM maps to the legacy
`Runtime Error (Other)`, with the private outcome `MEMORY_LIMIT` backed by
job OOM metadata and kernel hit counters. Output overflow maps to `SIGXFSZ`;
its incomplete stdout is retained only in the private log and not forwarded.
This is fixed-fixture evidence, not the final generic checker or stream protocol.

Upload `runtime-data/judge-spike/ingenium-judge-failures-20261018-01.tar.gz`
through the Cloud Shell upload menu. It contains 16 public source/profile files,
no images or credentials. From **Cloud Shell**:

```bash
gcloud compute scp ~/ingenium-judge-failures-20261018-01.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then run **once inside the VM**, with the existing three services healthy:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo '6ed92087f8dd55245faa56dad3320224c5cc7821355f1a79ed7b98e9e03d4cde  ingenium-judge-failures-20261018-01.tar.gz' | sha256sum -c -
  mkdir -m 700 failure-suite-v1
  tar -xzf ingenium-judge-failures-20261018-01.tar.gz -C failure-suite-v1
  sudo timeout --signal=TERM --kill-after=30s 600s python3 -B failure-suite-v1/failure-suite.py
)
```

The persistent checkpoint is `/opt/ingenium-judge-spike/failure-suite-v1`;
it is separate from the extracted source directory. Each creation/claim/run/save
intent is fsynced. Existing checkpoints refuse another run, including after a
VM restart. On timeout, a lost reply or any unexpected result, stop and report
the terminal output. Do not rerun, clear queues, delete records, force-remove
resources or change the VM's four-hour STOP guard. The runner does not resume
or retry an uncertain execution.

Success means eight classified results read through the original API, all normal
cleanup checks passed, an empty queue, maintenance still enabled and the baseline
row unchanged. All nine records and both private journals/logs remain. Do not use
the old empty-database probe afterward. No stock worker starts or port is exposed.

Local verification: 52 Python tests, 14 grouped Bash orchestration/evidence checks,
13 startup checks and 11 Node configuration/image tests passed with stubs. No
Judge0 or C++ program was executed locally. The archive was checked against its
16-file allowlist, source bytes, LF endings and Python 3.10 syntax. The subsequent
cloud report is recorded below. Exact event profiles, generic output evidence,
crash reconciliation, physical drain and event throughput remain separate work.

### Batched Failure Suite Cloud Run Passed

The user reported the archive checksum OK and all 20 PASS lines, including all
eight named outcomes, API-result/normal-cleanup checks, the original four API
gates before and after, creator removal, an unchanged baseline and an empty
queue with maintenance still enabled. This is reported fixed-fixture C++
evidence, not an assistant-operated VM inspection or performance benchmark.

Do not rerun either one-shot experiment, restart services or remove evidence for
this success. Preserve all nine submission rows and both root-private checkpoint
directories, `one-job-v1` and `failure-suite-v1`, with their journals/logs. Keep
the API in maintenance, stock worker stopped, ports private and the existing
four-hour STOP guard unchanged. The old empty-database probe is not applicable.

The five-profile build/parity package below is now prepared; its cloud run is
pending. The stock GCC 9.2 result
does not prove the target C17/C++17 GCC 15, Java 21, Python 3.14 or Node.js 24
profiles. Generic evidence, crash recovery, physical drain and event-load gates
still block participant execution; no production-readiness claim is made.

### Five-Language Build And Parity Prepared

**The version-one image built and C/C++ passed, but Java stopped with a loader
error. Do not repeat the historical version-one procedure below. Use the scoped
correction after it.**

`profiles.py` builds a separate image and tests C17, C++17, Java, Python and
CommonJS JavaScript in one run. It does not replace the working API/worker-prep
images, change provider language rows, create submissions or start a stock
worker. The existing nine completed rows are fingerprinted with read-only SQL
before/after; the queue must remain empty and the original API in maintenance.

The exact Linux/amd64 source-image digests and registry config identities are
recorded in `profiles/lock.json`: GCC 15.3.0, Temurin 21.0.12.1+1, CPython 3.14.8
and Node 24.22.0. These are selected test patches, not floating major-version
tags. GCC, Python and Node use Debian Trixie images; only the JDK tree is copied
from Temurin's Jammy image. Actual binary versions/hashes and console Python
standard-library dependencies are checked in the resulting image. The trusted
RUN steps have network disabled; pinned base pulls happen first. No package
installation or compiler rebuild from Internet sources occurs in the build.

The pinned legacy Isolate binary and its libcap dependency are copied from the
already-used image and fingerprinted. This deliberately retains a legacy
dependency for compatibility; it is not a fully maintained or security-approved
participant image. The image defaults to an unprivileged user and `/usr/bin/false`.
The host helper overrides that only for the fixed, fingerprinted lab command.

The new profile mode keeps the same named AppArmor profile, seven capabilities,
default seccomp, no network and three scoped mounts. Its separate common parent
is 1,536 MiB, 0.5 CPU and 128 tasks. Fresh compilation groups use 1 GiB / 15 CPU
seconds / 30 wall seconds; fresh runtime groups use 512 MiB and the approved
2/10-second C/C++ or 4/15-second interpreter/Java ceilings. Jobs have 64 tasks,
64 MiB stack/workspace, 4,096 workspace inodes and 16 MiB regular-file limits.
Isolate hard-codes 512 file descriptors; the tiny trusted `limits.c` launcher
checks UID/GID 60000 and lowers that to 256, disables core dumps, then replaces
itself with the fixed executable. No new sandbox or host capability is added.
No `RLIMIT_AS` is imposed: reserved JVM/V8 address space is not resident RAM.

Three shared cases per language cover positive, negative and 32-bit-boundary
answers. Fixed probes sleep 100 ms so the trusted observer can check the actual
executable's UID/GID, 256-file limit and membership in both job controllers.
Every phase requires clean success metadata, positive bounded accounting,
unhit RAM/combined limits, empty task lists and normal group/workspace cleanup.
Interpreters do not invent a compilation phase. This is normal-path parity,
not hostile-code isolation, resource-exhaustion coverage or an event benchmark.

Upload `runtime-data/judge-spike/ingenium-judge-profiles-20261018-01.tar.gz` to
Cloud Shell. The archive has 17 public source/profile files, no images or secrets.
The VM needs at least 12 GiB free disk and the existing three services running.
Expect additional image downloads/storage; the first build is not instantaneous.
Do not delete old evidence or alter the four-hour STOP guard to make it run.

From **Cloud Shell**:

```bash
gcloud compute scp ~/ingenium-judge-profiles-20261018-01.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then run **once inside the VM**:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo 'a50fb8c8d009c04cc11a98eeaba9ca1d229fab22cfdc900d70d041b8bb4e47d3  ingenium-judge-profiles-20261018-01.tar.gz' | sha256sum -c -
  mkdir -m 700 profiles-v1
  tar -xzf ingenium-judge-profiles-20261018-01.tar.gz -C profiles-v1
  sudo timeout --signal=TERM --kill-after=30s 1800s python3 -B profiles-v1/profiles.py
)
```

Progress messages identify image pulls/building; private build/parity logs are
under `/opt/ingenium-judge-spike/profiles-v1`. Successful completion saves
`runtime-manifest.json` there, containing the built image ID, source-lock/bundle
identities, actual version/binary hashes, kernel, measured parity results and
preserved-row fingerprint. This is lab evidence, not the final production
manifest/provider language registration. The journal and tag are exclusive;
another run refuses to overwrite them. On any failure or timeout, share terminal
output and stop. Do not rerun, remove checkpoints, clear data or force-remove
retained resources. Bounded, labelled diagnostic prefixes are saved in the
private log before temporary sandbox files disappear.

Local checks passed: 65 Python tests, 16 grouped shell lifecycle checks, 13
startup checks and 11 Node configuration tests. Tests use stubs/temporary models;
no new image, compiler or program was run locally. The 17-file archive's exact
source bytes, LF endings and Python 3.10 syntax were checked. The cloud build
and all-five-language parity remain pending. Generic output evidence, provider
mapping, crash recovery, safe physical drain and event-load gates remain open.

### Java Loader Failure And Scoped Correction

The user reported a successful image build and exact pinned versions, followed
by successful C17/C++17 compilation and all six answers. The first Java compile
then exited 127 with:

```text
javac: error while loading shared libraries: libjli.so: cannot open shared object file
```

This is a runtime-environment problem, not a wrong answer or evidence of a Java
memory limit. The sandbox's explicit `LD_LIBRARY_PATH` omitted the JDK's `lib`
and `lib/server` directories. Both are already inside the existing read-only
`/usr` bind. The correction adds those two absolute library directories in the
shared compile/run helper and matching image environment. It does not add a
mount, expose `/proc`, change language versions or relax any resource/security
limit. Loader search-path reference:
[ld.so documentation](https://man7.org/linux/man-pages/man8/ld.so.8.html).

The failed probe is specifically `ingenium-cg-run-zJHkFA`, with parent
`/ingenium-cg-run.zJHkFA` and private files `/run/ingenium-cg-run.zJHkFA`.
`cleanup-profiles-v1.py` is deliberately restricted to that report. Before any
removal it checks the original exclusive journal/bundle, exact decoded loader
error/resource names, immutable image association, stopped non-restarting
container/PID zero, no container OOM, unchanged nine database records, an idle
queue, the original policy/config bytes, and every owned controller subtree's
empty task lists. Unknown children, running tasks, another container using the
policy or an existing repair checkpoint stop it without beginning removal.

The cleanup fsyncs a private verification record containing the policy/config
bytes and old-log fingerprint under `profiles-v1/cleanup-v1`. It removes only the
identified stopped container, its unused lab policy, exact empty cgroup folders
and two temporary files. There is no forced or recursive removal. The old image,
database rows, source archive, parity log and original journal remain. Partial
cleanup failures stop and retain the new checkpoint for inspection.

Upload `runtime-data/judge-spike/ingenium-judge-profiles-20261018-02.tar.gz` to
Cloud Shell. It contains 18 public files. From **Cloud Shell**, not the VM:

```bash
gcloud compute scp ~/ingenium-judge-profiles-20261018-02.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then **once inside the VM**:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo '3c21eda2832b1a3d5391815dae8679e55be0f3bdbf3c4ea9a59c1a5ba75dc234  ingenium-judge-profiles-20261018-02.tar.gz' | sha256sum -c -
  mkdir -m 700 profiles-v2
  tar -xzf ingenium-judge-profiles-20261018-02.tar.gz -C profiles-v2
  sudo python3 -B profiles-v2/cleanup-profiles-v1.py
  sudo timeout --signal=TERM --kill-after=30s 1800s python3 -B profiles-v2/profiles.py --cached-images
)
```

The second command runs only if cleanup succeeds. It requires the already-pulled
digest-pinned bases and performs no pull/fallback. It builds under the separate
`ingenium/judge0-spike:profiles-v2` tag, with a fresh root-private `profiles-v2`
checkpoint/manifest. It never overwrites version one. This is an explicitly
reviewed retry of fixed synthetic programs after physical cleanup, not permission
to repeat uncertain participant execution. The VM's STOP guard remains unchanged.
If the VM restarted or any resource no longer matches, stop and report the
failure rather than bypassing a guard or forcing cleanup.

The new regression failed for the old Java compile/run environment and is now
green. All 74 Python tests, 16 shell groups, 13 startup checks and 11 Node checks
pass locally using stubs. No new image/program was run locally. The version-two
archive's allowlist/source bytes/LF/Python 3.10 syntax and unchanged version-one
archive were verified. **Scoped cleanup and the corrected cloud parity run are
reported successful in the following checkpoint.** This preparation was not
itself proof of cloud execution.

### Corrected Five-Language Parity Passed

The user reported the version-two checksum OK, successful scoped Java-failure
cleanup, and all five profile PASS lines: C, C++, Java, Python and JavaScript each
returned three exact answers with observed sandbox identity, accounting and
normal cleanup. The original four HTTP gates passed before and after the run.
The pinned lab manifest was saved, all nine old records remained unchanged, the
queue ended empty and maintenance remained enabled.

No further cleanup or rerun is needed. Preserve the private
`/opt/ingenium-judge-spike/profiles-v2/runtime-manifest.json`, journal/logs and old
checkpoints. The assistant has not accessed the VM or independently inspected
the manifest; the report did not include new detailed metrics or the image ID.
This passes fixed normal-path compatibility, not participant readiness.

Next reuse the pinned profiles/helpers for trusted identity-bound evidence and
durable one-time dispatch/execution guards. Fault tests must cover lost replies,
duplicate delivery, worker crashes and physical drain before a retry can be
authorised. Keep the stock worker stopped, services private, maintenance enabled
and the four-hour VM STOP guard unchanged. Generic capture, adversarial isolation
and realistic event load remain required; no new cloud resource is requested.

### Durable Guard And Recovery Batch

Historical first-run procedure below: the user reported a JSON decoding failure.
Do not rerun that procedure. Use the following correction section, whose guards
refuse uncertain/already-started work rather than clearing the checkpoint.

The next fixed lab batch is ready, but has not run on the cloud VM. It adds
`recovery.py` and `recovery.sql`, reusing the completed `profiles-v2` manifest
and cached image ID. There is no pull/build, stock-worker start, public port or
new cloud resource. The approved architecture is unchanged.

The SQL creates one private `ingenium_recovery_v1.attempts` table in the existing
isolated Judge0 database. It does not modify the application database, existing
submissions or original queue. Its generated provider UUIDs identify this lab
extension's records, not Judge0 submission tokens. The state progression is:

```text
PREPARED -> STARTED -> SEALED
              |
              +-- uncertain: retain reservation; do not launch again
```

An immutable attempt/boot/payload/manifest binding makes repeated matching
registration return the same lab record. A conditional database update grants
the one-time launch permit to one owner. Only that owner may seal evidence after
normal cleanup. Database constraints/triggers reject reset, binding changes,
result replacement and deletion. PostgreSQL's conflict/update rules supply the
coordination, not an in-memory busy flag:
[INSERT](https://www.postgresql.org/docs/16/sql-insert.html),
[transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html).

This single batch will test:

- Lost registration acknowledgement: a worker exits after commit; the observer
  finds the same uniquely bound lab UUID without creating another record.
- Duplicate delivery: four worker processes race through a start barrier; one
  consumes the permit and runs all fifteen fixed answers through the already
  tested helper. No security, mount or resource restriction changes.
- Lost result acknowledgement: the winning worker seals identity-bound evidence
  after normal cleanup, then exits before replying. The observer reads the same
  evidence without relaunching, and tries forbidden mutations in rollback-safe
  test blocks.
- Consumed permit plus worker crash: a second worker exits before sandbox launch
  after committing its permit. A replacement must refuse to launch; its lab
  reservation remains held, with no fabricated result or automatic cleanup.
- Preservation: exactly two lab rows, all nine old submissions unchanged, an
  empty original queue and the original four HTTP gates still passing.

The deliberate worker exits are fault hooks around real database commits, not
Judge0 HTTP fault injection. This does not yet prove HTTP token-loss recovery,
stock queue redelivery, a crash during running code, physical retirement or
general bounded-output capture. The boot binding is not a full credential-epoch
retirement mechanism. Do not describe this batch as participant readiness.

Upload `runtime-data/judge-spike/ingenium-judge-recovery-20261018-01.tar.gz` to
Cloud Shell. It contains 19 public regular files, no images, credentials or old
runtime data. Keep the existing three lab services running. From **Cloud Shell**:

```bash
gcloud compute scp ~/ingenium-judge-recovery-20261018-01.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then **once inside the VM**:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo 'c117d37dd119cfd010b2c98abec4da8c5590c117e3a45aeb2b18a997135c8976  ingenium-judge-recovery-20261018-01.tar.gz' | sha256sum -c -
  mkdir -m 700 recovery-v1
  tar -xzf ingenium-judge-recovery-20261018-01.tar.gz -C recovery-v1
  sudo timeout --signal=TERM --kill-after=30s 900s python3 -B recovery-v1/recovery.py
)
```

Progress/PASS lines report grouped outcomes rather than every database call.
Private evidence is retained under `/opt/ingenium-judge-spike/recovery-v1`:
`context.json`, `journal.jsonl`, bounded worker-reply records and
`execution/{journal.jsonl,sandbox.log,evidence.json}`. The final expected line is:

```text
PASS: recovery checkpoint saved; nine old records unchanged; queue empty; maintenance enabled
```

The intentionally uncertain second lab record remains reserved even when the
batch succeeds. This does not leave a deliberately running sandbox: that worker
exits before launch. Do not clear its row/checkpoint to make another run pass.
On any failure, retain all schema/checkpoint/container/cgroup evidence and share
the terminal output; do not rerun, reset records or force-remove resources.
The existing four-hour VM STOP guard and maintenance/private-access settings
remain unchanged. This procedure needs no Git operation.

Local verification passed: 91 Python tests, 16 shell groups, 13 startup checks
and 11 Node configuration tests. They use mocks/temporary models and the cached
development image solely for Bash stubs, never local Judge0/code execution or
a PostgreSQL server. The archive allowlist, exact source bytes, LF/ASCII, Python
3.10 syntax and SHA-256 were checked. Cloud SQL/concurrency/guarded execution
are still pending; no PASS is inferred from these local tests.

### Registration NULL Failure And Guarded Continuation

The user has now run the correction below: NULL diagnosis and registration
reconciliation passed, but worker delivery failed. Do not repeat this procedure.
Inspect private worker replies, journal/record states and the sandbox log read
only before any further continuation; another worker may still be active.

The first cloud recovery run passed its checksum, service/restriction checks and
initial HTTP gates, then reported `JSONDecodeError`. No grouped recovery PASS
was supplied, so the exact retained stage is not inferred from the console alone.

The query's wrong-binding branch returned SQL NULL, which `psql` displays as an
empty field. That is not JSON. The correction explicitly returns JSON `null`
through `COALESCE(..., 'null'::json)`; empty/malformed transport remains an error.
The old test mocked decoded `None` rather than checking the transport; the new
regression reaches the actual decoder and failed before this fix.
[psql NULL output](https://www.postgresql.org/docs/16/app-psql.html),
[COALESCE](https://www.postgresql.org/docs/16/functions-conditional.html).

The new `resume-registration.py` first checks the existing state read only. It
requires exactly the expected pre-launch journal/files, completed registration
worker exit, one PREPARED row with zero consumed permits, matching payload/
manifest/schema/boot and unchanged old records. No extra files/rows or existing
repair checkpoint are allowed. It verifies the NULL transport on this database.
If any guard fails, stop and share the output; do not remove files or force it.

After successful guards it creates a separate private repair journal and
continues the shared tests from registration reconciliation. It never repeats
the registration worker, recreates schema/data, resets a permit, overwrites old
evidence or builds/pulls an image. The original failed journal stays untouched;
success is recorded under `recovery-v1/registration-fix-v1`. The intentionally
uncertain final test record remains reserved as described above.

Upload `runtime-data/judge-spike/ingenium-judge-recovery-20261018-02.tar.gz` to
Cloud Shell. From **Cloud Shell**, not the judge VM:

```bash
gcloud compute scp ~/ingenium-judge-recovery-20261018-02.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then **once inside the VM**:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo '413e93df4adf0f239097588e5ccf673a2e9549e3cda0b6838bd0455f79da0dd6  ingenium-judge-recovery-20261018-02.tar.gz' | sha256sum -c -
  mkdir -m 700 recovery-fix-v1
  tar -xzf ingenium-judge-recovery-20261018-02.tar.gz -C recovery-fix-v1
  sudo timeout --signal=TERM --kill-after=30s 900s python3 -B recovery-fix-v1/resume-registration.py
)
```

No separate cleanup or original runner command is needed. A reboot or any state
other than the verified unstarted case blocks this continuation. The script
preserves both original and repair evidence on failure. The unchanged four-hour
STOP guard, private services, maintenance mode and stopped stock worker remain
required; no new cloud or Git action is bundled into this correction.

Local checks: 96 Python tests and 11 Node configuration tests passed. The source
query fix and guarded continuation use mocks/temporary models; no local Judge0,
language program, SQL server or cloud resources were executed. The unchanged
shell/startup checks were not rerun in this turn. This 20-file public archive
contains no credentials/runtime data. Cloud diagnosis/continuation remain pending.

### Seal Retained Completed Execution Without Replay

Completed on the user's VM: all version-three recovery checks passed. This
procedure is historical; do not repeat it or reset its checkpoints. See the
completion note below for what to preserve and what remains unverified.

The subsequent user diagnostics reported one STARTED record/consumed permit and
no sealed result. The execution journal ended SANDBOX_FINISHED. Its saved log
reported all five profiles completing with exact answers and full normal cleanup
for `ingenium-cg-run-icLa6c`. Worker replies 1-3 were not saved. Do not rerun either
earlier recovery procedure, delete the permit or launch the fixtures again.

The post-run parser has a locally reproduced object-order bug: canonical JSON
sorts the manifest's language keys, whereas the result array preserves execution
order. It compared Python's result with JavaScript's definition. The correction
uses the fixed profile sequence, not object iteration; all source/output/identity/
accounting/cleanup validation remains intact. The runtime build context is unchanged.

`seal-retained.py` will first read/check the exact saved journal/file inventory,
worker 0's expected checker error, original owner/binding/provider, immutable log
fingerprint, fifteen exact results and same runtime/boot. It additionally requires
no active old workers, sandbox containers, test policy, old controller groups or
temporary directory. Missing/different evidence or any remaining resource blocks
the repair without removing anything. It cannot reset or reclaim the consumed
permit and does not call a sandbox launcher.

Only after validation does it write a new exclusive private `evidence-fix-v1`
journal and reconstruct the missing evidence file. It launches four small
duplicate-only control processes which must refuse the existing permit, then a
seal-only process which validates the saved log and commits the original owner's
result before dropping its acknowledgement. Neither mode can run language code.
It finishes the existing guard/crash-before-launch checks, retains the intentional
second uncertain reservation, and verifies all old files/records/queue/API gates.
The three original unsaved replies remain unobserved; they are not fabricated.

Upload `runtime-data/judge-spike/ingenium-judge-recovery-20261018-03.tar.gz` to
Cloud Shell. From **Cloud Shell**:

```bash
gcloud compute scp ~/ingenium-judge-recovery-20261018-03.tar.gz \
  ingenium-judge-spike-01:~/ingenium-judge-spike/judge0-v1.13.1/ \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap

gcloud compute ssh ingenium-judge-spike-01 \
  --project=project-8359d400-686c-4df3-a64 \
  --zone=asia-south1-a --tunnel-through-iap
```

Then **once inside the VM**:

```bash
(
  set -euo pipefail
  test "$(hostname)" = ingenium-judge-spike-01
  cd ~/ingenium-judge-spike/judge0-v1.13.1
  echo 'b96356a8cf8d4cfefd555ec1400b56a6bd3de235b1d322261f5a851aa3f98bc2  ingenium-judge-recovery-20261018-03.tar.gz' | sha256sum -c -
  mkdir -m 700 recovery-evidence-fix-v1
  tar -xzf ingenium-judge-recovery-20261018-03.tar.gz -C recovery-evidence-fix-v1
  sudo timeout --signal=TERM --kill-after=30s 900s python3 -B recovery-evidence-fix-v1/seal-retained.py
)
```

Success is recorded under
`/opt/ingenium-judge-spike/recovery-v1/evidence-fix-v1/journal.jsonl` and ends with:

```text
PASS: retained execution sealed with no new sandbox launch; old evidence and nine records preserved; queue empty; maintenance enabled
```

All original journals/logs/replies stay unchanged; `execution/evidence.json` is
new, not overwritten. An existing repair or partially completed seal must be
inspected, not retried. If worker 0 reports a different cause, a process/resource
remains or the VM rebooted, the guard stops. Share the output without cleanup or
permit reset. The existing STOP guard/private services/maintenance settings stay
unchanged; no image pull/build, new cloud resource or Git operation is needed.

Local checks passed: 104 Python tests and 11 Node configuration tests. These
include real postprocessor parsing with synthetic saved logs and mocked physical/
database state, not local program execution or cloud proof. The unchanged shell/
startup checks were not rerun. Cloud sealing/recovery and wider readiness gates
remain pending.

### Retained-Result Recovery Passed

The user reported the version-three checksum OK and all recovery PASS lines:
all fifteen saved answers/identity/accounting/cleanup checks, four duplicate-only
worker refusals, the original permit/result binding, lost-seal acknowledgement
reconciliation, stale seal rejection and retained crash-before-launch uncertainty.
The original HTTP gates passed before/after. Final status confirmed no new sandbox
launch, unchanged old evidence and nine old records, empty queue and maintenance.

No further rerun or cleanup is needed. Preserve both synthetic recovery rows and
all of `/opt/ingenium-judge-spike/recovery-v1`, including the completed
`evidence-fix-v1/journal.jsonl`, `execution/evidence.json`, old journals, replies
and sandbox log. One deliberately uncertain test reservation remains held; that
is the intended no-replay result, not evidence of a still-running fixture. Earlier
failed journals retain their original stages. The three missing original race
replies remain unobserved; the fresh duplicate-only test is separate evidence.

The assistant recorded the provided terminal report and changed documentation
only. It did not access the VM, independently inspect private evidence, operate
cloud resources or mutate Git. Runtime tests were not rerun for this doc update.
Keep the private services, maintenance mode, stopped stock worker and VM STOP
guard unchanged. Next is the real Judge0 HTTP/queue association and fault testing;
generic stream evidence, active-execution crashes, retirement/drain, security
review and event-load verification remain open. This is not participant readiness.

## Focused Tests

On Linux, run with synthetic fixtures only:

```bash
bash infra/judge-spike/test/prepare-config.test.sh
```

The configuration tests create and remove only their own `/tmp/ingenium-judge-config-tests.*`
directory. They do not read real credentials, start a judge or change a database.

Startup tests must run in a disposable Linux container as UID 1000 with an empty
`/api` tmpfs. They use our patched scripts, synthetic credentials, a fake config
loader and command stubs, not Judge0/Rails binaries or a PostgreSQL server. The
worker loop itself is not exercised: the tests check worker role dispatch and
that config-loading failure stops the real worker script before its loop.

From the repository root in PowerShell, using the already-present pinned
development image only as a Bash/coreutils environment:

```powershell
docker run --rm --pull=never --network none --read-only `
  --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges=true `
  --memory 128m --pids-limit 64 --cpus 1 `
  --tmpfs '/tmp:rw,exec,nosuid,nodev,size=16m' `
  --tmpfs '/api:rw,nosuid,nodev,noexec,size=4m,uid=1000,gid=1000,mode=0700' `
  --mount "type=bind,source=$($PWD.Path)\infra\judge-spike,target=/work,readonly" `
  --entrypoint /bin/bash `
  'postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826' `
  /work/test/startup.test.sh
```

Only the known fake command stubs need executable temporary storage. The `/api`
test mount remains `noexec`, and no real credentials, Docker socket, database
volume or Judge0 image are mounted. This is startup unit coverage, not an image
build, integration test or sandbox verification.
