# Engineering retrospective

The organiser closed the competition and requested an open-source handoff on 4 November 2026. This record summarizes implementation and observed limits; private participant cases and operational access details remain outside Git.

## From design to event

The project grew from two-round rules and a browser arena into a guarded competition system: team/member access, immutable content snapshots, receipts, hints, wallet ledgers, shared claims, staff controls, live projections and result exports. The full initial design remains in [the historical architecture](architecture-original.md), while [the current architecture](../../architecture.md) describes the actual service boundaries.

Source editing and sample practice were separated from official scoring. Official admission freezes the original program, language, question, runtime, assistance and server receipt order. A durable receipt lets a disconnected browser recover an action without duplicate execution or payment. Successful source cannot award twice, and later hints cannot retroactively rewrite an admitted attempt.

After Round 1, the organiser requested easier Round 2 content. A new 100-question version set was authored while preserving the previous harder drafts and original Round 1 records. Recorded publication finished all 100 revised questions, 3,600 genuine expected checks and 400 clues. The participant guide was shortened to one page and corrected to the final event schedule.

## Infrastructure failures and adjudication

Compiler diagnostics exposed cases where source errors had been classified as infrastructure failures. The diagnostic boundary was tightened and regression fixtures retained. Genuine uncertainty stayed separate from wrong answers. Recovery used the exact original request/result/physical state; consumed permits and immutable verdicts were not reset.

Some accepted solutions arrived through reports and external documents during disruption. The review method kept the original text, matched the team/question, checked logic/compiler behavior and existing awards, and recommended only the missing earned bounty. General infrastructure compensation was a separate organiser decision. Individual submissions, names, report identifiers and per-team amounts are not public release material.

Qualification also uncovered partial cleanup, checkpoint shape limits, process/UID resource accounting and host-proof issues. Corrections were qualified with fresh host identities where required. Failed receipts, unknown outcomes and already-started work remained preserved privately; new epochs did not erase them. A container exit was not treated as physical drain without evidence.

## Speed work

Shared readiness reduced repeated observations while retaining expiry from the actual request start, slow-response refusal and per-launch proofs. Compile-once participant batches retained individual case identities/limits and cleanup accounting. Expanding from eight to sixteen physical slots used the same 14-vCPU/56-GiB judge allocation, with bounded CPU/memory/process and database limits.

The final real-compiler 15-team fixture completed 15 official passes/awards, one sample, 16 batches and 122 member-attempt releases. Official median/peak changed from 26.730/42.045 seconds at eight slots to 15.683/22.254 seconds at sixteen; sample time changed from 11.921 to 12.920 seconds. A disposable PostgreSQL lock-timeout warning was retried and retained. There was no participant infrastructure verdict in that final fixture.

The under-10-second peak target was not met. Real compilers/capsules were used, but fixture publication/clock and service admission were synthetic/in-process. These measurements are not public-network, old-device or full event-load guarantees. Backup hash/listing checks do not establish a full restore of every later backup.

## Local-only follow-up

An append-only release action was implemented locally for a running/paused Round 2: up to 20 new approved questions per transaction, 120 total. It preserves original IDs/order, source, timer and financial history and notifies all teams. Upgrade/browser checks passed; this work did not deploy it.

A separate selection of twenty earlier-draft tasks spans difficulty 25–50, five per topic, with all four event languages, hints, samples and hidden cases. It remains unpublished, and its full sanitizer check remains incomplete because the attempted Windows toolchain lacked UBSan. Content and validation limitations remain explicit in [project status](../project-status.md).

## Lessons for a fork

- Measure queueing, admission, execution and result/cleanup separately; a larger worker count does not guarantee a faster sample or sub-10-second verdict.
- Keep financial and sporting truth in durable transactions, with recovery identity and original receipt order.
- Treat false infrastructure classifications as a distinct engineering problem; do not award incorrect programs as compensation.
- Preserve failure history and physical ownership through recovery. Fresh qualification is not a license to replay old work.
- Pilot challenge difficulty and language fairness with humans; author ratings and compiler passes are not measured solve times.
- Provide a quick local preview and clear documentation entrypoint, while keeping real execution installation separate.
