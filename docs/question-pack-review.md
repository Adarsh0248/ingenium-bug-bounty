# Event question review — 29 October 2026

The private packs contain 50 Round 1 missions and 100 Round 2 missions, each in
C, C++, Java and Python. The story, rules, tests, difficulty, bounty and hints
are shared across languages. Missions stand alone in the Protocol Rebellion
story; earlier answers never unlock later missions.

## Completed checks

- Read all 150 task descriptions, constraints and three-step hint sequences.
  Reviewed index origins, ties, duplicate inputs, empty cases, interval endpoints,
  input ordering, special outputs and the difference between a simulation and
  real threads or memory access. No new statement correction was required.
- Reran all 600 starter/reference pairs on the pinned Linux toolchain image.
  The run checked 1,200 programs, 4,540 reference cases, 600 hidden starter
  witnesses and all 400 separately authored paid examples. C/C++ undefined
  behaviour checks passed. The reference and starter use the same bounded model
  in each language; these are trusted organiser-program checks.
- Staged all actual questions through the production authoring and snapshot
  services in a disposable PostgreSQL database: 600 frozen variants, 450 frozen
  hints and 5,140 planned validation checks. Every snapshot passed its guards.
- Installed all 400 Round 2 paid-clue bindings against exact snapshot/starter
  hashes. A second identical installation inserted nothing. The restricted API
  role cannot read the private clue table.
- Verified scanner sections cover the intended fault without narrowing to one
  line. The participant sees the approved broad section, not the reference diff.

Round 1 pack SHA-256:
`77c08e90d88d58969f2410a20f974ee495933bd68aafb8c3cc6683cf73f28f21`

Round 2 pack SHA-256:
`621ef0f33be6f4ab6c34d1c945c481af16dd0a0a229aba960f261fda5106b133`

The compiler reports are under the ignored
`apps/api/test-results/readiness-20261029/round1/` and `round2/` directories.
The full database-staging result is
`apps/api/test-results/readiness-event-packs-20261029.log`.

## Publication boundary

Database staging creates drafts and immutable snapshots, not successful judge
verdicts or publications. The protected host must validate each frozen plan
before the normal publication service can approve it. No validation result was
forged from the local compiler report, and no question was silently published.
The validation summaries retain `production_judge_validated: false` until that
separate run passes.

The four-language minimum plan has 12 checks: two reference cases and one
starter witness per language. Migration 0087 aligns database admission, the
table constraint and the HTTP summary with this minimum; existing five-language
history remains valid. The worker can fill available authoring slots while
other original attempts wait for their next allowed observation.

Difficulty ratings are editorial estimates. No student pilot has measured
completion time or proved that a typical team can solve 30 missions in three
hours. The two rounds intentionally share some concepts, such as circular
queues and caches, while their individual faults and tasks differ. Their
engineering checks do not replace an event organiser's pacing decision.

The checks above used disposable databases. The subsequent staff-library import
is documented in [event question library](event-question-library.md) and the
[production deployment record](production-deployment.md). Importing drafts does
not turn these compiler reports into protected validation or publication.
