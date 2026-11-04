# Participant case batching

The current participant path groups a frozen program and its case identities into one compile-once job. The batch retains exact original source/runtime/limits and per-case input/checker identity. It runs every required case rather than stopping early after a wrong result. Individual result/physical-release accounting is retained in the application and native registry.

## Code map

- `apps/api/src/content/batch-protocol.ts` / `batch-result.ts`: canonical binding and result acceptance.
- `apps/api/src/judge/native-batch.ts`, `batch-runner.ts`, `batch-artifact.ts`: protected native execution and artifacts.
- `apps/api/src/competition/judging-worker.ts`: application planning, observation and settlement.
- Application migrations 0092/0093 and native migrations 008/009: batch lifecycle and sixteen-slot integrity.
- `apps/api/test/integration/participant-batch.checks.ts` and `judge-batch.checks.ts`: restricted PostgreSQL lifecycle/boundary checks; separate Linux artifact/kernel checks provide different evidence.

## Failure and identity rules

A once-only atomic launch binds the original attempt/owner/token. A duplicate delivery or uncertain HTTP response does not authorize another execution. A result can be durably sealed before later physical retirement; an accepted result is not proof of cleanup. Retained case groups, checkpoints and positive drain evidence must all match. Missing/foreign records refuse release rather than inventing a verdict or free slot.

Readiness sharing expires from the actual request start, never from cache hits. Slow replies cannot extend validity, and every real launch retains its complete proof. Sixteen slots require matching application/native capacity and reviewed CPU/memory/process/connection accounting; changing a number in one scheduler is insufficient.

## Recorded event evidence

The final sixteen-slot event release completed 53 genuine legacy and seven genuine batch kernel qualifications with positive drains. A fifteen-team fixture completed fifteen official passes/awards, one sample, sixteen batches and 122 original member releases. Sample 12.920 seconds; official median 15.683 and p95/peak 22.254 seconds. Eight-slot median/peak had been 26.730/42.045 seconds; its sample was faster at 11.921 seconds. The under-ten-second target was not achieved.

Compiler/kernel execution was real; fixture publication/clock and in-process admission were synthetic. One disposable database lock-timeout warning was retried and preserved. This is not campus-network, public-device or complete shared-race proof. A new protected release/host needs fresh qualification. Failed historical controller/epoch records remain private and must not be reset or replayed.

See [the current architecture](../architecture.md), [project status](project-status.md), [testing](testing.md) and [the retrospective](history/event-retrospective.md).
