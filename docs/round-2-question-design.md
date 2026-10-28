# Round 2 question pack — The Kernel Breach

Confirmed: 100 distinct questions for Round 2, harder than Round 1, with integer
difficulty 25–100. Participants repair supplied buggy programs. Keep C, C++, Java
and Python, with equivalent defects, tests, difficulty and rewards across all four.

## Statement readability

Difficulty must come from the logic. Use simple English, explain technical terms
when they first appear, and keep story details separate from the exact rule.
Describe the input steps, variable meanings, indexing, boundaries and tie rules.
Mark code names and expressions with backticks, such as `n` and `distance[v]`;
the question panel highlights them and separates headings. Keep hints clear and
progressive without putting the repair into the public code-reading guide.
Both rounds use `content/statement.mjs` for their statement sections.

## Authoring allocation

| Difficulty | Per topic | Total |
| --- | ---: | ---: |
| 25–45 | 8 | 32 |
| 46–65 | 9 | 36 |
| 66–85 | 5 | 20 |
| 86–100 | 3 | 12 |

The four topics each receive 25 missions: arrays/strings, systems/resources,
graphs/trees, and logic/state. All live in the shared Kernel Breach arena, with
the existing list tags. This distribution is an authoring default, subject to
organiser and participant pilot review; it is not evidence of solve times.

Protocol Rebellion continues inside AEGIS, the rogue security AI. Mira, Patch
and Ishan investigate independent internal faults. Each statement supplies its
own context, expected behaviour, observed failure, code-reading guide, exact
input/output, worked example and limits. Solving another mission never provides
a required answer or unlocks a question. Harder reasoning must not mean obscure
English, language-specific tricks or unsafe starter behaviour.

Each mission has four readable starter/reference pairs, two public samples,
at least six distinct hidden inputs, a declared hidden starter failure and three
progressive hints following architecture.md §1.9. Hints move from an edge-case
clue, to useful direction, to near-solution reasoning without a complete program.
Systems/concurrency tasks use deterministic portable models. Numeric bounds and
data structures must make the same task feasible in all four languages.

Round 2 rewards remain `10 × difficulty`, or 250–1,000 coins. Additional hint
prices remain 10%, 30%, 80%, and winning score multipliers remain 90%, 70%, 50%.
The content pack does not change shop prices, claim protection, receipt ordering,
wrong-submission penalties or scoring authority.

Authoring sources, the generated private pack and review book belong in
`content/round-2/`. None may be served as public frontend assets. Local checks
compile/run only organiser-authored programs; real submissions and protected
production validation/publication remain on the existing judge path. Final
human review, pilot difficulty/language calibration and event-host validation
must be recorded separately from local compiler results.

Hex Scanner uses private, question-specific subsystem boundaries in
`scanner-arrays.mjs`, `scanner-systems.mjs`, `scanner-graphs.mjs` and
`scanner-logic.mjs`. These select meaningful phases in the supplied buggy bodies,
with equivalent C/C++/Java and Python scope. The builder translates their bounds
to starter-program line numbers and verifies fault coverage. It does not derive
the revealed region from the reference diff. The UI retains the original starter
excerpt after draft edits. Price and assistance remain 750 coins and Hint 2;
participant pilot balance review is still required.

## Authored artefacts and checks

- [Private catalogue](../content/round-2/README.md) and [complete review book](../content/round-2/questions.md).
- 100 new identities, 400 equivalent language variants, 800 starter/reference
  programs, 820 judging cases and 100 separate paid edge examples.
- The local Linux run uses GCC/G++ 15.3.0, Java 21.0.12.1 and Python 3.14.8.
  All 3,280 reference/case checks, 400 declared hidden starter witnesses and
  400 reference/probe checks pass. C/C++ checks include undefined-behaviour and
  array-bounds sanitizers. Exact source and pack hashes bind the evidence.
- Three Java loop guards were corrected during authoring. The twelve language
  variants of those three questions were rerun; all unchanged variants retain
  their matching complete-case evidence. The [summary](../content/round-2/validation-summary.json)
  records this rather than claiming a fresh full run after the corrections.
- The local Round 2 preview uses this pack. Its judging remains simulated;
  the content compiler checks do not authorise production publication.

The real round configuration supports up to 100 Round 2 bounties; Round 1 stays
at 50. This requires the new capacity migration through the normal deployment
process, not an automatic migration of an existing event database.
