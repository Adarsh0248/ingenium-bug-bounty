# Protocol Rebellion — Round 1

Private organiser content. Do not copy this directory into public assets.

A defensive AI, AEGIS, has mistaken its operators for intruders. Operator Mira, maintenance drone Patch and network analyst Ishan coordinate repairs in four sectors. Every mission is self-contained and can be attempted in any order. Solving one never unlocks another question or changes its tests.

50 questions: 35 very easy at difficulty 1–20, 10 easy at 21–30 and 5 moderate at 31–40. The three-hour round targets at least 30 solves for a typical team; completing all 50 is an optional goal for faster teams, not a guaranteed solve time. Four equivalent variants per question: C, C++, Java and Python. Round 1 bounty is fifty times difficulty (5× the original reward scale). Hint percentages stay the same; unspent earnings carry into Round 2, whose reward and hint rates remain unchanged. Older published snapshots retain their original rewards. Each question has two public samples, at least four hidden cases and three progressive hints. No language-specific pointer syntax, manual-memory task or nondeterministic thread scheduling is required.

Hints follow architecture.md §1.9: clue, substantial direction, then near-solution reasoning without complete code. Additional prices are 10%, 30% and 40% of base bounty.

Local content checks are not production publication: use the protected authoring validation and organiser review before event selection. Pilot solves must calibrate difficulty and language fairness.

| # | Region | Mission | Difficulty | Bounty | Defect |
| --- | --- | --- | ---: | ---: | --- |
| 1 | Neon District | The Last Beacon | 3 | 150 | The accumulation loop excludes the last element. |
| 2 | Neon District | Cold Signal | 5 | 250 | The maximum starts at zero instead of an observed value. |
| 3 | Neon District | First Witness | 7 | 350 | A later match overwrites the first saved index. |
| 4 | Neon District | Silent Slots | 8 | 400 | The zero-reading branch adds the reading instead of one to the counter. |
| 5 | Neon District | Mirror Credential | 10 | 500 | Each character is compared with itself instead of its mirrored character. |
| 6 | Neon District | Case-Cloaked Orders | 10 | 500 | Only the lowercase form is recognised. |
| 7 | Neon District | Repeated Alarm | 12 | 600 | Run detection compares against the first value rather than the previous input. |
| 8 | Neon District | Circular Dispatch | 24 | 1200 | The source index uses a left-rotation offset. |
| 9 | Neon District | Window Leakage | 25 | 1250 | The sliding update removes the incoming value rather than the outgoing value. |
| 10 | Neon District | Frequency Impostor | 16 | 800 | An equal-frequency candidate replaces the earlier smaller candidate. |
| 11 | Neon District | Twin Archives | 28 | 1400 | The equality branch advances both streams while emitting only one value. |
| 12 | Neon District | Unbroken Channel | 30 | 1500 | A repeated letter is skipped instead of ending the current consecutive piece. |
| 13 | Neon District | Cipher Multiplicity | 18 | 900 | Required character multiplicities are collapsed to one. |
| 14 | Silicon Hive | Stolen Charge | 3 | 150 | Consumed charge is added instead of subtracted. |
| 15 | Silicon Hive | Crossed Airlocks | 5 | 250 | The second assignment uses an already overwritten value instead of the saved temporary value. |
| 16 | Silicon Hive | The Final Battery | 7 | 350 | Integer division rounds down when a partial final battery must be counted. |
| 17 | Silicon Hive | Reversed Backup | 10 | 500 | The copy assignment sends the empty backup into the live bank rather than copying live data into the backup. |
| 18 | Silicon Hive | Residue Meter | 12 | 600 | The per-batch accumulator is not reset between batches. |
| 19 | Silicon Hive | Permission Fuse | 18 | 900 | Bitwise OR sets masked bits instead of clearing them. |
| 20 | Silicon Hive | Wire Order | 12 | 600 | The two byte weights are reversed. |
| 21 | Silicon Hive | Ring Courier | 28 | 1400 | The enqueue cursor advances from head rather than its own tail position. |
| 22 | Silicon Hive | Overlapping Transfer | 26 | 1300 | An overlapping rightward copy runs forwards instead of backwards. |
| 23 | Silicon Hive | Ownership Leak | 16 | 800 | Release decrements the count without checking whether the resource is owned. |
| 24 | Silicon Hive | Signed Sensor | 14 | 700 | The signed conversion subtracts 128 rather than 256. |
| 25 | Silicon Hive | Cache Rebellion | 34 | 1700 | Cache-hit timestamps are not refreshed. |
| 26 | Silicon Hive | Lifetime Fence | 20 | 1000 | The interval end is treated as inclusive. |
| 27 | Verdant Nexus | Return Wire | 5 | 250 | An undirected edge is inserted in only one direction. |
| 28 | Verdant Nexus | False Connections | 6 | 300 | The self-link exclusion condition is inverted. |
| 29 | Verdant Nexus | Origin Hop | 18 | 900 | The starting relay is assigned distance one instead of zero. |
| 30 | Verdant Nexus | False Leaves | 12 | 600 | The leaf test accepts nodes with one child. |
| 31 | Verdant Nexus | Echo Fanout | 15 | 750 | Adjacency accumulates duplicate records instead of storing presence. |
| 32 | Verdant Nexus | Wrong Way Courier | 18 | 900 | Directed edges are stored in reverse orientation. |
| 33 | Verdant Nexus | Backfeed Census | 20 | 1000 | The source is queued without marking it visited. |
| 34 | Verdant Nexus | Dependency Debt | 32 | 1600 | Completing a prerequisite increments remaining dependency counts instead of decrementing them. |
| 35 | Verdant Nexus | Heavy Shortcut | 24 | 1200 | A cheaper two-link route never replaces a previously found route. |
| 36 | Verdant Nexus | Rerouted Parent | 27 | 1350 | Joining two labelled groups changes only the input box rather than every member of its group. |
| 37 | Verdant Nexus | Rescue Origins | 36 | 1800 | Only the first source is included in the multi-source traversal. |
| 38 | Verdant Nexus | Critical Link Audit | 40 | 2000 | A temporarily removed edge is not restored before testing the next edge. |
| 39 | Zero-Day Core | Revoked Operator | 4 | 200 | Permission combines the two conditions with OR instead of AND. |
| 40 | Zero-Day Core | Emergency Priority | 8 | 400 | Lockdown is checked before the higher-priority emergency condition. |
| 41 | Zero-Day Core | Toggle Storm | 10 | 500 | The loop sets the state to one instead of inverting it. |
| 42 | Zero-Day Core | Clock Translation | 8 | 400 | Hours are added without conversion into minutes. |
| 43 | Zero-Day Core | Decimal Fingerprint | 12 | 600 | The digit accumulator adds the quotient rather than the last digit remainder. |
| 44 | Zero-Day Core | Broken Handshake | 22 | 1100 | ACK establishes a connection without checking the WAITING state. |
| 45 | Zero-Day Core | Atomic Withdrawal | 18 | 900 | The failure branch retains partially applied state instead of rolling back. |
| 46 | Zero-Day Core | Midnight Token | 16 | 800 | Elapsed time is not wrapped across midnight. |
| 47 | Zero-Day Core | Withdrawn Quorum | 18 | 900 | Every vote update is stored as approval, ignoring the supplied withdrawal value. |
| 48 | Zero-Day Core | Window of Consent | 24 | 1200 | The intersection extends its upper bound instead of shrinking it to the earliest expiry. |
| 49 | Zero-Day Core | Escaped Directive | 34 | 1700 | The parser checks for a backslash before consuming the existing escape state, so escaped backslashes incorrectly extend escaping. |
| 50 | Zero-Day Core | Versioned Truce | 20 | 1000 | A successful compare-and-set does not increment the stored version. |

## Files

- pack.json: complete private statements, hints, tests and starter/reference variants.
- neon.mjs, silicon.mjs, nexus.mjs, core.mjs: editable authoring sources.
- build.mjs: rebuilds the pack and catalogue without database writes.
- verify.py: compiles/runs only these organiser-authored programs locally and saves exact evidence.

Review the full [question book](questions.md) and [local validation summary](validation-summary.json). The declared hidden failure cases are recorded in witnesses.json.

Rebuild with `npm.cmd run content:round1:build`. Run trusted local checks with `npm.cmd run content:round1:verify` (requires GCC, G++, Java and Python). Linux compiler checks may use the existing isolated test image; these are content checks, not event-host verification.

## Readability

Every mission explains its own story, the expected behaviour, the fault, the input/output and the first sample in plain English. Hints follow the same style. All four language versions use four-space indentation and expanded statements. Rebuilding needs Python and clang-format; set `CLANG_FORMAT` to the formatter executable if it is not on PATH. The generator uses the Python standard library and the installed formatter, with no new application dependency.
