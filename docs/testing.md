# Testing and reproducibility

Run from the repository root with the declared Node/npm versions and locked dependencies. None of these commands should target a former event deployment.

## Source checks

```sh
npm ci
npm run typecheck
npm test
npm run content:programs:test
npm run build
npm run test:bundle --workspace @ingenium/web
npm run docs:check
```

Unit suites cover protocol/batch binding, receipts, policy, rendering and recovery with isolated fixtures. The public-bundle check verifies that the frontend output does not include organiser-only content. These commands do not certify a sandbox or execute real participant programs.

## PostgreSQL and browser checks

`npm run test:db:schema` creates a uniquely named disposable PostgreSQL container on loopback, applies migrations and runs selected integration checks with restricted roles. Docker must be running in Linux-container mode. The pinned image must already be pulled:

```sh
docker pull postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826
npx playwright install chromium
```

Choose a focused suite using `INGENIUM_TEST_SUITE`. Examples on PowerShell:

```powershell
$env:INGENIUM_TEST_SUITE='foundation'
npm.cmd run test:db:schema
$env:INGENIUM_TEST_SUITE='live-questions-browser'
npm.cmd run test:db:schema
Remove-Item Env:INGENIUM_TEST_SUITE
```

On POSIX shells, use `INGENIUM_TEST_SUITE=foundation npm run test:db:schema`. Other selectors are dispatched in `apps/api/test/integration/schema.test.ts`, including `competition`, `participant-batch`, `history`, `reports`, `shop`, `admin-browser` and their relevant browser variants. The default combined matrix takes longer. Fixtures sometimes reset test-only quotas to bound test time; those operations must never be copied into an operational recovery.

The live-release suite installs migration 0094 over a populated running 100-question local round. It checks original records/timers, failed selections, concurrent revisions, durable retries, paused/running additions, 120 limits, two-team notifications, judging/awards and finalisation. Compiler observations in that suite are synthetic.

## Trusted organiser content

`npm run content:round1:verify` and `npm run content:round2:verify` compile and run organiser-authored programs using local GCC/G++, Java and Python. They never accept arbitrary submissions. Reports go to ignored test-evidence directories.

For the extra pack:

```sh
python content/round-2/additional-20/build.py
python content/verify.py --round=2 --pack=content/round-2/additional-20/pack.json --sanitizers
```

Undefined-behavior/bounds sanitizers require a compiler installation with the sanitizer runtime. A missing runtime is a failed check, not a passed task. The extra pack's summary remains pending until its complete check succeeds. Historical evidence is not silently promoted to a new validation receipt.

## Protected Linux judge

The `test:judge:*` scripts, native helpers under `infra/judge-gateway/test/`, frozen images, cgroups, AppArmor, namespaces and private runtime files have Linux-specific requirements. Read [executor](judge-executor.md), [host verification](judge-host-verification.md), [supervisor](judge-supervisor.md) and the [gateway guide](../infra/judge-gateway/README.md) before using them in isolated infrastructure.

Mock database/TLS observations are not compiler/kernel proof. A fresh qualifying host must verify runtime identities, physical limits, cleanup, private credentials and real executions. Never rerun old admitted participant source, reset permits, fabricate readiness or discard unresolved history to make checks green.

CI runs source checks only; it has no production secrets, infrastructure credentials or deployment action. Historical benchmark fixtures and event services are not restarted by CI.
