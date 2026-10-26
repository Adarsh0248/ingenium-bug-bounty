# Pre-deployment readiness

Updated 26 October 2026. The user requires the complete approved application and
has not authorised event deployment. This page separates completed development
evidence from the remaining real-host checks; it is not a launch certificate.

The user deferred further 100-team compiler testing after an observed worker
fault. That fault remains unresolved; a smaller passing batch does not establish
safe maximum capacity. The final application candidate is packaged for review,
with no event deployment or live admission authorised by these results.

| Check | Current evidence |
| --- | --- |
| Application build and types | Both workspaces build and typecheck (`final-release-types-20261026.log`). The large editor/arena bundle warnings remain. |
| Unit/client regressions | Final 349 API and 21 client checks pass with private failure causes preserved (`final-release-units-20261026.log`). The 24 targeted executor/supervisor checks and native Linux storage regression also pass. The experimental inspection increase has been reverted. |
| Database and browser suites | Complete current matrix: 350 PostgreSQL checks pass after the event-capacity migrations (`final-event-capacity-schema-20261026.log`); the focused judge DB matrix passes 50 checks, including inspection session loss/cancellation. The combined DB-backed browser matrix passes all 116 checks in ten suites after the background-refresh fix (`final-browser-refresh-fix-20261025.log`). |
| Individual installed judge executions | The final five-second-inspection candidate passes C, C++, Java, Python and JavaScript, including original permit binding, lost-reply recovery and physical cleanup (`vm-final-private-candidate-v22-20261026.log`). Four installed compilation/CPU/output/boundary cases also pass (`vm-final-guarded-failures-v22-20261026.log`). |
| Continuous judge concurrency | All twenty real mixed-language programs pass through eight physical slots in 126,527 ms, with mTLS, Redis, exact results and full cleanup. Twenty readiness observations peak at 1,727 ms, coordinator RSS at 192,315,392 bytes; the queue empties and readiness withdraws (`vm-eight-slot-inspection-priority-capacity-20261026.log`). Earlier failures remain preserved. |
| Endurance | With the user's approval to prioritise the remaining checks, stopped after 52 complete batches / 312 jobs / 82.6 minutes. All 317 original/current records were sealed and drained; no execution container remained. Five uninterrupted hours remain unverified. |
| Complete two-round flow | Actual participant compilation through the private SSH/mTLS bridge passes samples, independent/shared awards, score reset, carryover, paid sequential hints and wrong-answer penalties (`real-two-round-flow-20261025.log`). Fixture publication validation and clock are explicitly synthetic. |
| Claim delivery | The 50-team/100-member/300-tab Linux race with a separate browser generator passes actual commit-to-event/projection p95 of 814 ms and p99 of 835/836 ms (`round-two-isolated-generator-20261025.log`). All 300 tabs receive the single claim; no recorded warnings/refusals. Public-network effects remain unverified. |
| Real clock probe | Seven restricted-user observations pass on the busy verification VM, taking 60–90 ms each. This is read-only probe calibration, not the future primary host's installed database clock monitor. |
| Release package | Explicit allowlist, SHA-256 inventory, no local settings/test credentials. Clean Linux production dependency installation and compiled API health/public entry checks pass. |
| Installed crash recovery | The final candidate passes interruption with two UID-60000 processes, read-only recovery, explicit original-ID retirement and duplicate refusal (`vm-final-installed-crash-v22-20261026.log`). With no reliable result, the original permit remains consumed/held; no participant verdict was invented. Earlier failures and all original evidence remain preserved. |
| Local mixed capacity | The 100-team/200-member/600-tab test passes a 3,607,324-ms steady phase: 52,000 metadata reads, 1,040 drafts, 260 samples and the original 100 official jobs settled. Metadata p95/p99 is 110/176 ms; coordinator RSS peaks around 260 MiB. Judge and clock remain synthetic. Reconnect/backpressure counts remain in the report; it does not claim zero disruptions. |
| Real compiler capacity | Deferred by the user after failed 100-team compiler runs. The earlier eight-slot / twenty-program batch passes, but sustained-load worker failure remains unresolved. A ten-second inspection experiment did not fix it and has been reverted to five seconds. One original saved result was recovered by guarded retirement without re-execution. Remaining held records/evidence are preserved; do not claim maximum capacity or enable eight slots on the smaller pass alone. |
| 100-team service-burst preflight | Passes with the eight-slot application roster: 200 requests at parallelism 16, 100 original receipts, 100 competing team/bug refusals, a sample, 100 settled official results/awards and zero worker faults (`eight-slot-burst-integrity-preflight-20261026.log`). Normal fresh staff sign-in precedes finalisation rather than extending idle expiry. Judge/time/authoring are synthetic; this directly calls the authorised service, rather than browser HTTP. |
| Event content and registration | Explicitly deferred by the user. No actual challenge pack or registration export is available yet. |
| Deployment-specific operations | Public DNS/TLS, primary-host clock/service installation, off-host GCS backup, alert delivery and operator sign-off remain deployment work. Local TLS/backup/restore tests do not certify those installations. |
| Verification VM | Deliberately stopped and independently confirmed `TERMINATED` on 26 October (`final-verification-vm-state-20261026.log`). Disk, old evidence and held records are retained. A future boot needs fresh host qualification. |

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

## Finish the real-host checks

The user chose efficient use of today's remaining time. The endurance controller
was stopped only after a complete batch, with all accepted records sealed and
drained and no execution containers. Its original intent/log remain unchanged;
`interrupted-after-drain` records a partial run, not a five-hour PASS. A stop-report
check initially required a vanished `/proc` entry, but the dead controller was a
zombie waiting for its stopped `sudo` parent. Read-only checks confirmed the
terminal state and resumed that original reaper; no job or permit was reset.
The verification VM has a six-hour automatic stop window; collect evidence and
stop it deliberately when testing finishes. A reboot invalidates the old proof.

The two-round integration harness has two explicit modes:

```powershell
$env:INGENIUM_TEST_SUITE='round-flow-preflight'
npm run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

The preflight is synthetic and cannot certify compilation. The separate
`real-round-flow` selector requires `INGENIUM_REAL_JUDGE_FIXTURE`, a one-use
private TLS/epoch descriptor outside Git and a local SSH tunnel. Run it only
against the authorised private test judge. Do not print or commit that file.
It uses its own local PostgreSQL container and new fixture database; a failed
run preserves its original container and records for inspection. It must not
reuse an old failed permit or alter a retained cloud lab.

The subsequent separate private service window completed the real two-round
flow in about five minutes. It used a disposable local competition database;
only the judge ran on the cloud VM. Keep the event undeployed.
