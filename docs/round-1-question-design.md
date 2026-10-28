# Round 1 question design

Organiser requirements and the authored [Protocol Rebellion pack](../content/round-1/README.md).

## Statement readability

Use short sentences and familiar words. Keep the story brief, then state exactly
what the program should do. Define any necessary technical term when it first
appears. Explain input variables, indexing, boundaries, output order and tie rules.
Put code names and expressions in backticks, for example `n` and `a[i]`; the
question panel highlights these and separates the section headings. Follow the
same style in all three hints, keeping the repair out of the public statement.
The shared statement template is in `content/statement.mjs`.

## Question pool

- Create **50 questions**.
- Spread the questions across different domains.

## Four areas

Spread all 50 questions across the existing four areas:

| Area | Existing question category |
| --- | --- |
| Neon District | Arrays, strings and searching |
| Silicon Hive | Systems, memory and resource handling |
| Verdant Nexus | Graphs, trees and traversal |
| Zero-Day Core | Logic, state and concurrency |

Allocation: **13 Neon District, 13 Silicon Hive, 12 Verdant Nexus, 12 Zero-Day Core**. Every area has at least seven very easy questions; no region requires solving a harder question to enter another.

## Uniqueness

- Aim for 50 distinct questions with no repetitive tasks.
- Renaming variables, changing the story or replacing sample inputs does not make the same debugging task a new question.
- Review each question's underlying fault, required reasoning and repair against the rest of the pool.

## Connected story

- **Chosen story: Protocol Rebellion.** A defensive AI has classified its own operators as intruders. Contestants repair corrupted services across the four areas to recover control before its final containment protocol activates.
- Tell this connected story through all 50 bugs.
- **Any solving order:** every mission must stand alone and include all information needed to understand and solve it.
- Questions remain logically independent while their incidents, characters, clues and consequences connect through the narrative. No question requires another question's answer or a previously discovered story clue.
- Give each bug a distinct role in the larger story rather than repeating the same incident with different names.

## Languages and fairness

- Use **four languages only: C, C++, Java and Python**. JavaScript is excluded.
- Give each of the 50 logical questions an equivalent buggy-code version in all four languages: **200 code variants across 50 distinct questions**.
- Keep the same story, expected behaviour, difficulty and bounty across a question's four versions.
- Each version must test equivalent debugging reasoning so language choice does not change the intended challenge or earning opportunity.

## Difficulty distribution

| Group | Number of questions | Difficulty range |
| --- | --- | --- |
| Very easy | 35 | 1–20 |
| Easy | 10 | 21–30 |
| Moderate | 5 | 31–40 |

**Total: 50 questions.** This replaces the earlier 25/17/8 distribution and removes the 50–70 difficulty tier. Round 1 bounty is now **50 × difficulty**, equally across languages; lowering the question difficulty does not require low rewards.

## Rewards and Round 2 funds

- Round 1 uses a fivefold boost over the original 10 × difficulty scale. The authored pool offers **150–2,000 coins per question**, with **42,400 coins** available to each team before hint spending.
- The 35/10/5 difficulty distribution, statements, programs and tests are unchanged by this reward increase.
- Hint prices remain additional 10%, 30% and 40% of the actual bounty. A 1,000-coin question therefore charges 100, 300 and 400 coins; solving it still credits the full 1,000 once. Spending all three hints leaves a net 200 coins.
- Only the final **unspent** Round 1 wallet carries into Round 2. Round 2 starts at zero leaderboard points and retains its original bounty scale, hint prices and shop rules.
- Protected authoring accepts only reward multipliers 1 (legacy) or 5 (Round 1 boost). New Round 1 bugs in the staff editor default to 5; the real pack's preview setup requests 5 explicitly. Existing published snapshots and launched rounds retain their frozen rewards and hint prices.
- Migration `0081_round_one_reward_boost.sql` enables the new policy and raises exact amount bounds for 50 boosted bounties. It must be applied through the normal deployment process; local verification uses disposable databases only.

## Three-hour pacing target

- Target an ordinary two-member team solving **at least 30 questions in 180 minutes**. Faster teams can aim for all 50; neither outcome is guaranteed without participant pilot solves.
- Very easy questions should aim for roughly 2–4 minutes each, easy questions 4–6 minutes and moderate questions 6–9 minutes, including reading and repairing but excluding queue delays. These are authoring targets, not measured timings or participant promises.
- Thirty very easy solves at four minutes each leave about an hour for exploring, discussing, using hints and judging delays. Teams can work independently on separate questions.
- Every program is supplied and has a small intended logic repair. Each statement includes a short guide to the variables and loop structure; no algorithm must be invented or optimised.
- Replace harder scaffolding with simple bounded loops: Unbroken Channel tries each starting position; Cipher Multiplicity compares whole-message letter counts; Heavy Shortcut checks a direct link or one middle box; Rerouted Parent uses group labels rather than parent trees.
- Keep useful boundary tests and the same intended repair across C, C++, Java and Python. Easier questions must still reject the buggy starter; do not lower difficulty by weakening the checker.
- Run a short freshers/junior pilot, including at least one participant in each language, before claiming the target is met. Record reading, repair and judging times separately.

## What each question provides

- **A problem statement** describing the story incident, what is going wrong and the expected correct behaviour.
- **Buggy starter code** in the participant's selected language.
- Each statement explains its own story context, expected behaviour, observed fault, code-reading guide, input/output, a worked sample and simple limits. No earlier mission or unexplained story term is required.
- Use plain English and short paragraphs. Define technical terms that matter to the task, rather than hiding the task behind the story.
- Starter and reference programs use four-space indentation, clear spacing and one statement per line. Loops and branches are expanded instead of compressed onto one line.
- Hints use the same plain-English style: a small test to think about, a useful direction, then a near-solution explanation without a complete program.

## Participant task

- Read the statement and inspect the provided buggy code.
- Edit that code to fix the described problem.
- Use **Reset code** when needed to restore the original buggy code for the current question and selected language. Confirmation is required before replacing edits.
- Submit the corrected code for judging.

## Authored pack

- Audience: freshers through junior-year students. Round 1 prioritises accessible debugging and clear specifications over advanced implementation from scratch.
- The 50 authored missions and their private answers/tests are in `content/round-1/pack.json`.
- The application requires difficulty 1–100; this introductory round uses only **1–20** (35 questions), **21–30** (10 questions) and **31–40** (5 questions). No question has zero bounty.
- Each mission has equivalent complete programs in C, C++, Java and Python, two public samples, at least four hidden cases and three progressively more useful hints.
- Hint 1 is a small clue; Hint 2 gives substantial direction; Hint 3 explains a near-solution without complete source. Prices remain the architecture's additional 10%, 30% and 40% of base bounty.
- Systems questions use portable resource models; concurrency questions use deterministic event sequences. No language requires manual pointer management or real thread scheduling to match another language's task.
- Default participant and combined admin previews use this real pack. Old high-bounty graphic fixtures are retained only for isolated regression tests.
- Final organiser/pilot difficulty review and protected production-judge validation/publication remain required before event use. Preview judging remains explicitly simulated.
