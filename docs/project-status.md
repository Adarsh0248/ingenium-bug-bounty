# Project status — 4 November 2026

The organiser confirmed that the competition is finished. Automated preparation follow-ups were cancelled. Open-source preparation is repository work; no former live application, server, database, competition or score is being changed.

## Delivered

- Participant/staff entry, team/member registration and language locks, control room, arena setup, pauses, discipline, cancellation, reports and result exports.
- Interactive arena, full-program editor, saved drafts, sample/official judging, private hints, shared team wallets and seven Round 2 items.
- Durable request receipts, live state/reconnection, source-linked awards/penalties, restricted review, immutable auditing and retention/restore quarantine.
- 50 Round 1 questions and 100 easier Round 2 questions, each in four event languages. Recorded Round 2 publication completed all 3,600 expected real checks and 400 clues; old harder drafts were preserved.
- A private gateway, durable native registry, separate supervisor, compile-once participant batches and a qualified 16-slot event setup. This describes recorded event work, not current server health.

## Local work preserved after the event

| Work | Status |
| --- | --- |
| Migration 0094 / live question release | Built and tested locally. Up to 20 additions per release, 120 total; existing questions, submissions, timer and ledger stay intact. No deployment or live release was performed. |
| Additional 20 archived missions | Separate pack at `content/round-2/additional-20/`; five per topic, original difficulty 25–50 and rewards 250–500. No import/publication. |
| Extra-pack validation | The original sanitizer attempt could not link the local Windows UBSan library. Java/Python checks passed in that attempt; full validation is explicitly still `RECHECK_REQUIRED`. No pass is fabricated or inferred from earlier content. |
| Original harder questions | Public archive at `content/round-2/archive/pack-original.json`, with SHA provenance. The existing 100-question pack has not been replaced. |

## Actual performance evidence

The last recorded comparable 15-team / 30-member compiler fixtures used eight official cases, real compiler/capsule execution and synthetic fixture publication/clock with in-process service admission.

| Setup | Sample | Official median | Official p95 / peak |
| --- | ---: | ---: | ---: |
| 8 physical slots | 11.921 s | 26.730 s | 42.045 s |
| 16 physical slots | 12.920 s | 15.683 s | 22.254 s |

All 15 official jobs passed and produced 15 awards in the final fixture. One disposable-database `security_control FOR UPDATE` lock-timeout warning occurred; normal retry completed. The sample did not improve. **Under 10 seconds at peak was not achieved.** These results do not certify campus/public-network latency, old devices, new deployments or every shared-claim race.

Read-only timing analysis attributed roughly 2.5–3.5 seconds to queue/prelaunch and 7.3–12.9 seconds to launch through result publication in retained examples. More physical slots alone cannot remove compiler/JVM/case lifecycle costs. This is attribution of old evidence, not a fresh benchmark.

## Validation boundary

Local source, database and browser checks are listed in [testing](testing.md) and the release verification note. Recorded 53 legacy and seven batch kernel qualifications belong to their exact event release/host epoch; a new host or protected-runtime change requires fresh proof and qualification.

Historical backups were hash-matched and archive-listed where stated. That is not a complete restore test of every later event backup. Earlier failed qualification attempts and unknown immutable outcomes were preserved privately; no source or consumed launch permit was reset to erase failure history.

Participant names, submitted programs, adjudication records, credentials, deployment descriptors, raw incident logs and backups are excluded from this public repository. Public documentation preserves the engineering method and aggregate results. The [event retrospective](history/event-retrospective.md) records the main lessons.
