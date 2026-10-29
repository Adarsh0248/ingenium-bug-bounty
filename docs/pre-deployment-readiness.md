# Pre-deployment readiness

Updated 29 October 2026. Overall completion is roughly **96%**, an engineering
estimate rather than a launch certificate. The event remains undeployed. The
current work uses disposable application databases and the approved private
verification VM; it does not migrate the development or event database.

| Check | Current evidence |
| --- | --- |
| Judge claim/recovery race | Fixed the gap between a committed claim and its returned response: the execution worker reserves the original attempt before either claim or recovery lookup awaits. Two regressions failed before the fix and pass afterwards. The 20 focused queue/worker/supervisor checks pass. |
| Sustained real capacity | The 100-team Linux service burst admitted exactly 100 official receipts and refused 100 competing teammate requests, but missed its 20-minute settlement limit. All 100 original official receipts were subsequently reconciled to correct awards, without resubmission or permit resets. This preserves the original timing failure. The subsequent two-lane experiment also failed: 112 of 201 case jobs completed before shutdown, with 11 official results plus the sample passed and 89 official results unresolved. Eight original physical permits remain held; the three surviving execution containers are exited and retained. A smaller passing run cannot certify maximum capacity. |
| Bounded safety checks | The two-lane preclaim experiment was reverted after the fresh 100-team run hit the five-second reference-inspection limit and the supervisor withdrew readiness. Single-lane preparation is restored; all 20 focused checks pass. Neither inspection deadlines nor launch/cleanup guards were weakened. A read-only priority calibration did not demonstrate enough improvement to justify another runtime change. |
| Actual question packs | All 150 statements, constraints and three-step hint sequences reviewed. All 600 four-language variants were rerun on the pinned Linux toolchains: 1,200 programs, 4,540 reference cases, 600 hidden starter witnesses and 400 paid examples; C/C++ undefined-behaviour checks passed. See [question review](question-pack-review.md). |
| Production content services | All actual packs passed draft/snapshot guards in disposable PostgreSQL: 600 variants, 450 hints, 5,140 planned checks and 400 immutable paid-clue bindings. Two complete pack checks pass. They create no successful protected-host validation or publication. |
| Four-language validation | Migration 0087 aligns the minimum plan with the four event languages (12 checks), preserves older history and grants the restricted worker read-only slot visibility. Available validation slots can fill while older attempts wait for their permitted next observation. All 29 validation/recovery database checks pass. |
| Production Round 2 shop | All seven items use durable inventory and exact idempotent receipts. The 19 PostgreSQL/browser checks cover concurrent teams, wallet limits, freeze/expiry, owned clues and protected versus ordinary awards. The preview remains a separate simulator. |
| Live two-round/shop flow | Passed the extended real protected-compiler and production-service rehearsal: 12 independent Round 1 awards, shared/protected Round 2 awards, all seven items, concurrent teammate purchase, lost-reply recovery, credit freeze with continued coding, hints, shield consumption, wallet carryover, penalties and paused item clocks. Fixture authoring and the clock are explicitly synthetic (`readiness-rounds-completed-20261029.log`). |
| Browser and build checks | All 361 complete PostgreSQL regression checks, 365 API and 92 web unit checks passed; both builds/types and two compressed/public-bundle checks passed. All 19 focused Round 2 browser checks pass, including the actual 100-question pack. The actual 50-question Round 1 preview check passes. After 73 passing Round 1 checks, four targeted failures were resolved/rechecked in isolation; the interrupted concurrent browser run is not claimed as a clean full-suite result. |
| Slow-device/network emulation | At 1280×720 with 4× CPU throttling, warmed Round 1 districts measured about 21–30 FPS and Round 2 about 58 FPS. Tested a 150-ms/128-KB/s connection plus complete disconnection, local draft editing and reconnect without repeated submissions/purchases. No older laptop or campus LAN was available. These measurements do not certify physical-device smoothness. |
| Registration and pacing | Actual registration remains deferred until the organiser export is available. No student pilot has verified the difficulty ratings or 30-solves-in-three-hours goal. |
| Five-hour endurance | The earlier run ended after 82.6 minutes with 312 jobs, following the user's decision to prioritise other tests. Five uninterrupted hours remain unverified. |
| Deployment operations | Public DNS/TLS, installed primary-host clock/service checks, off-host backup, alert delivery, final registration/content publication and operator sign-off remain deployment work. No launch is authorised by a local or private test. |
| Verification VM | Stopped deliberately and independently confirmed TERMINATED (`readiness-vm-state-20261029.log`). Both failed burst databases have private, root-only, hash-verified disk backups. The old records, checkpoints, eight held permits and exited execution containers are retained. A future boot requires fresh host qualification. |

Evidence from this batch is under `apps/api/test-results/readiness-*20261029*`.
Both failed application databases have root-only, SHA-256-verified disk backups;
no source, private SQL dump or credential is included in the application release.
The earlier failure records remain unchanged. No failed probe is converted to a
PASS by resetting a permit, extending its measured deadline or inventing a
participant result.

## Remaining development/readiness gates

1. Fix sustained protected-executor throughput and repeat the intended team-load
   test under the original inspection deadlines. The claim-lifetime race fix is
   retained. In three sampled executions, the program result was written about
   12–16 seconds after capsule allocation, but the positive drain appeared about
   45–52 seconds after allocation; roughly 33–39 seconds followed the result.
   These are checkpoint timing samples, not a complete profiler or proof that
   removing any guard is safe. The current six-CPU host is not capacity-certified.
2. Run the frozen actual content plans through the protected judge before normal
   publication. The 5,140 planned checks have not been substituted with synthetic
   success or trusted local compiler results. Local content checks/staging passed.
3. Calibrate on actual older/integrated-GPU devices and the campus LAN when
   available; run the student pacing pilot. The two-round production-service flow
   and emulated disconnection checks passed, but do not establish those results.

## Build a reviewable application candidate

From the repository root:

```powershell
npm run build:release
```

This builds both workspaces, then copies reviewed public/build paths into a new
`build/app-release-<uuid>/` directory. `release.json` records every file's size
and SHA-256. The printed manifest hash identifies the exact candidate. The
manifest explicitly keeps `deployment_ready` and `dependencies_installed` false.
No service is installed, database migrated, code committed or site published.

On the future authorised primary host, install production dependencies from the
unchanged lockfile rather than copying Windows `node_modules`:

```bash
npm ci --omit=dev --ignore-scripts --workspace @ingenium/api --include-workspace-root
```

The 25 October Linux smoke test used Node 24.22.0/npm 11.19.1 under a non-root
account, checked every release hash first, installed with lifecycle scripts
disabled, and imported the compiled API for a local health request. No real DB
or event origin was used. Preserve the tested candidate and inventory; rebuilding
after a source or dependency change creates a different candidate to verify.

## Repeat the private checks safely

The local `round-flow-preflight` integration selector uses synthetic judging and
cannot certify real compilation. The Linux runner in
`infra/judge-gateway/test/host-round-flow-check.ts` has separate `--rounds` and
`--burst` modes and uses an isolated labelled PostgreSQL container plus the
private loopback/mTLS judge bridge. Build its reviewed bundle with
`node infra/judge-gateway/build-round-rehearsal.mjs`.

A failed run preserves its database, original submissions, source identities and
receipts. Inspect and reconcile those identities before starting any fresh test.
Never replay its submission admissions, reset permits or clean uncertain physical
resources. The failed database uses temporary storage: preserve a private,
hash-recorded dump on disk before stopping the VM. A successful runner removes
only its own labelled database container.

The bridge must close only after all accepted executions have drained. Collect
its terminal report, stop the verification VM and independently check its state.
A future boot requires fresh host qualification. Keep private descriptors, source,
SQL backups and credentials outside Git and public web assets.
