# Ingenium Bug Bounty Architecture

Status: planning. Sections are discussed and agreed incrementally before implementation.

Planning boundary: finish and review the core architecture before scaffolding the application, creating database migrations, authoring competition bug code, or deploying services. Architecture examples may clarify a contract without becoming implementation. The remaining work and completion criteria are tracked in Section 4.

## 1. Competition Requirements

### 1.1 Purpose

Build a gamified bug-fixing competition. Participants select animated bugs, inspect the corresponding coding challenge, and submit corrected code. Verified solves produce points and visual feedback.

#### Confirmed Initial Challenge and Submission Scope

- Initial coding languages are C, C++, Java, Python, and console JavaScript. HTML/CSS/React browser challenges and their browser-rendering grader are excluded from this initial scope.
- This exclusion concerns participant challenges, not the platform's implementation: the planned React/TypeScript frontend and Three.js arena remain unchanged.
- Initial official submissions are complete programs using the challenge's specified standard-input/standard-output contract. Starter code must include the required language entry point and I/O rather than presenting a function-only task as already supported.
- The user wants a path to both complete-program and function-only submissions. Function-only execution, language-specific wrappers/signatures, and its authoring UI are deferred, not implemented or enabled by this decision.
- Proposed extension boundary: store an explicit submission format on the versioned challenge definition and freeze it with the round bounty/judging configuration. Initially only full-program is supported; any future function-only format requires its own validated execution contract. Do not guess the mode from source text or let a participant select a mode incompatible with the bounty.
- Confirmed: provide a penalty-free Run action for published sample test cases in both rounds, separate from official Submit. Sample runs do not use hidden tests, score points, award bounty, or establish submission priority. Custom-input runs are not approved by this decision.
- Confirmed output comparison: default to whitespace-separated token matching, with exact-text matching configurable per bug for formatting-sensitive tasks. Token order, token values, and letter case must match; ignore only whitespace separation in token mode. Section 3.5 defines the shared, versioned checker boundary.
- Confirmed participant feedback: sample Run can show public sample inputs, expected/actual output, and safe diagnostics; official Submit shows overall verdict and general failure category without hidden inputs, expected answers, or raw execution output. Enforce this on server responses and live updates, not only the visible UI.
- Confirmed bug-readiness gate: every supported language needs a correct private reference solution that passes all sample/hidden tests and a supplied starter that demonstrates the intended defect by failing at least one relevant test or compilation/runtime check. Section 3.4 defines validation boundaries; equivalent difficulty still requires human review.

### 1.2 Teams and Access

- Round 1 supports up to 100 teams, with two members per team.
- Teams enter using a private access code rather than email/password registration.
- The same code-entry screen also accepts administrator access codes. The backend determines the credential's permissions: team access continues to member/language selection; administrator access opens the admin panel directly. A browser-supplied role or URL never grants staff access. See Section 5.
- Organisers will already have team information from the event registration form, including team names and the two registered members' names. Preload the required registration data and associate each private access code with its registered team so the backend resolves the team automatically.
- Participants do not need to register a new account, type their team name again, or select their team from a public list. After a valid team code is entered, show that team's registered member names and let the participant select their own name on the entry page.
- A team can have at most two active member sessions, one for each registered member. Multiple tabs in the same browser session must not consume additional member slots.
- Teammates can work on different challenges and independently choose supported languages. The entry flow is team code, registered member selection, then language selection if that member has not already chosen for this round.
- The team HUD displays the team name, competition score, spendable bounty balance, and rank, and can be minimised. In Round 2, score and spendable balance are distinct values.
- Confirmed teammate coordination: when a member takes on a bug, show their teammate that they are working on that bounty, with live updates rather than a page refresh. Section 2.3 proposes the trigger, display, and stale-status handling; it is not an exclusive bounty reservation.

#### Confirmed Per-Member Language Lock

- The language choice belongs to the individual member's participation in a round, not to the entire team. Two teammates using the same team code may choose different languages.
- Once confirmed on entry, that member's selection stays locked until the round ends. A new round permits a fresh selection; it does not change the previous round's history.
- Serve each bounty's starter code and configure the editor and judging for that member's selected language only. These remain variants of the same bounties, with shared team progress, hints, and Round 2 claim availability.
- Enforce the lock on the backend using a durable member-round association, not just a disabled selector, browser storage, or a temporary connection. Refreshing, reconnecting, opening a tab, or re-entering must not reset the choice.
- The entry flow restores the selected registered member's recorded choice rather than offering a new language for that round. Approved session/device replacement must preserve that choice. Session lifetime and the secure recovery handoff still need detailed design.

### 1.3 Two Competition Rounds

| Rule | Round 1: Qualifier | Round 2: Final |
| --- | --- | --- |
| Teams | Up to 100 | At most 50 qualifying teams |
| Arena | Independent team arena | Shared arena for all finalists |
| Bounties | Each team can solve the available bounties independently | Teams race for shared bounties |
| Effect of a solve | Updates that team's progress without removing another team's opportunity | A confirmed winning solve removes that bounty for every finalist |
| Leaderboard | Round 1 results | Separate leaderboard starting from zero |
| Spendable bounty | Earned bounty minus hint spending | Unspent Round 1 bounty carried forward, plus Round 2 earnings, minus purchases |
| Wrong-submission time penalty | None | 5 minutes per wrong submission |
| Paid hints | Three levels, purchased on the bounty's page | Three levels, purchased on the bounty's page |
| General shop | Not planned | Special items; catalogue and effects to be decided |

- Round 1 competition points do not carry into the Round 2 leaderboard. Each qualifying team's unspent Round 1 bounty does carry into its Round 2 spendable balance.
- Spending power rewards Round 1 performance, while Round 2 ranking depends on Round 2 solves rather than the opening wallet balance.
- Round 1 results remain recorded separately; starting Round 2 does not delete them.
- Both modes belong to the same application. The backend enforces the active round's rules.

#### Confirmed Admin-Configured Arena

- An arena instance contains Round 1 and Round 2 of one competition run. Creating a new instance permits only Round 1 to start; the earlier standalone Round 1/2 start selector is replaced by this sequential flow.
- The organiser selects registered participants from the database, bugs from the matching round's pool, and a duration for each round. Every instance has its own admin controls and separate Round 1 and Round 2 leaderboards.
- Finishing Round 1 does not end or release the arena instance. After its results are finalised, show the option to configure/start Round 2 in the same instance, or discard this instance and begin Round 1 in a fresh one.
- At most one arena instance can be current across the application, not one per admin or round. The between-round interval and global pauses must not make room for a second current instance. Section 6 defines the proposed lifecycle and database enforcement.
- Round 2 requires finalised Round 1 results from the same arena instance. Results from an older, discarded, or different instance cannot unlock it. Selecting participants or sending a direct request cannot bypass the sequence.
- Confirmed end-of-round flow: when time expires, stop new submissions and purchases, finish judging already-admitted submissions, then lock results. Round 2 remains unavailable while Round 1 is finalising, and the arena-instance reservation stays held.
- Round 1's independent team arena views are private progress views inside this one instance, not additional running instances. Round 2 switches to shared claims within the same instance.
- Bugs in the pool must distinguish Round 1 from Round 2. Only the bugs selected for the chosen round are loaded into its arena when it starts; unselected pool content is not automatically exposed.
- Participant selection must preserve the existing team structure, round capacity, and Round 2 qualification rules. Team-based selection with member names shown is the proposed interpretation, not approval of arbitrary individual regrouping or qualification overrides.

### 1.4 Round 1 Qualification

At most the top 50 eligible teams advance after applying this ranking priority:

1. Higher net leaderboard points after hint spending.
2. Lower cumulative solve time, when points are equal.
3. Higher solved-difficulty profile, compared highest-first, when points and cumulative solve time are equal.

The ranking priority, comparison methods, original server-receipt solve-time basis, and earliest-correct-receipt credit within each Round 1 team/bounty are confirmed. Timestamp precision and receipt/admission coordination still need implementation contracts below. Round 1 has no wrong-submission penalty.

#### Cumulative Solve Time

- Each distinct, point-earning coding bounty contributes one elapsed solve time, measured from the round start to the original server receipt time of its credited correct submission. This timestamp rule is confirmed for both rounds, not the browser click, judging completion, award commit, or a later retry time.
- Add those elapsed times across both teammates to obtain the team's cumulative solve time.
- Repeated accepted submissions and additional language variants of an already-scored bounty do not add points or another solve time.
- Failed submissions do not contribute a solve time or an additional penalty in Round 1.
- Example: scoring solves at 5 minutes and 12 minutes give a cumulative solve time of 17 minutes, not 12 minutes.
- Confirmed team-pause rule: exclude that team's applicable paused duration from each solve's elapsed-time contribution. Only intervals before that solve count; later pauses do not rewrite earlier contributions. In Round 2, a team pause does not extend the common closing time and other teams can still claim bounties. Section 5.4 separates this clock adjustment from global/member pauses and absolute receipt order.
- Confirmed global-pause rule: global pauses are technical breaks. They stop the shared active-play clock and extend everyone's common closing time by the actual paused duration. Global-break intervals before a scoring solve do not consume its active elapsed time; overlapping global/team intervals must not be subtracted twice.

```text
solve_time = credited_submission.original_server_receipt_time
             - round.start_time
             - applicable_paused_duration_before_that_receipt

cumulative_solve_time = sum(solve_time for distinct point-earning bounties)
```

- Applicable paused duration is the union of that round's global pauses and that team's pauses, clipped between the round start and the credited submission's original receipt. Do not subtract another team's pauses or any break after the receipt, even if judging finishes during or after that break.
- Example without pauses: received at minute 20 and judged correct at minute 23 contributes 20 minutes. An infrastructure retry completing at minute 25 still contributes 20 minutes; completion time is retained separately for audit.

#### Highest-First Difficulty Comparison

- Collect one difficulty rating for each distinct, point-earning coding bounty solved by the team.
- Sort the ratings from highest to lowest.
- Compare the two sorted lists lexicographically: at the first differing position, the higher rating wins.
- If one list is an exact prefix of the other, the longer list wins. Identical lists leave the teams tied.
- Example: `[95, 60]` ranks ahead of `[90, 85]` when points and cumulative solve time are equal.

### 1.5 Difficulty Ratings

- Each coding bounty has a difficulty rating out of 100.
- Participants can see the difficulty rating before attempting the bounty.
- Difficulty is used for the second qualification tie-breaker.
- Higher-difficulty coding bounties should have higher base rewards, so percentage-based hint prices also increase with difficulty.
- The exact mapping from difficulty ratings to base rewards has not yet been defined. They must not silently be treated as the same value.

### 1.6 Scoring and Judging Boundaries

- Submitted code is evaluated against server-side test cases.
- The backend, not a browser animation, decides whether points are awarded.
- Confirmed revised official limit: a team can have at most one queued or running official submission for a particular bounty, shared across both members and language variants. The same member/team can submit different bugs while earlier ones are being judged. This replaces the one-official-attempt-per-member and two-per-team total caps. Release the team/bounty slot when the aggregate judging verdict is recorded, not when a pending award decision finishes.
- Confirmed sample-Run limit: each member can have at most two queued or running sample Run requests, independently of official submissions. This allows up to four sample Runs per team. Count requests across all bounties/tabs/sessions, not individual test cases; worker/global queue limits remain separate.
- Confirmed judge scheduling: when both queues have eligible work, dispatch three official execution jobs then one sample job, rotating fairly between teams within each queue. If one queue is empty, the other may use available capacity. Running jobs are not interrupted merely to change priority; this is dispatch order, not a runtime guarantee or a change to receipt-order awards.
- In Round 1, a team receives a coding bounty's points at most once, including when teammates solve different language variants of that bounty.
- In Round 2, a shared coding bounty has at most one winning team and one winning award.
- Bonus puzzle/trivia bugs are planned, but their rewards and fairness rules are not defined yet.

#### Confirmed Round 1 Team Credit Order

- For each team and bounty, credit the earliest correct official submission received by the server across both members and all language variants. The team receives one award, wallet payout, solve-time contribution, and difficulty contribution for that bounty.
- A later correct result waits if an earlier submission from that same team for that bounty is unresolved. If earlier attempts prove incorrect, the next correct receipt can receive credit. Judge completion order and internal retries must not choose a later solve-time basis.
- Coordinate this ordering within the team-round/bounty, not across unrelated teams. Another team's unresolved attempt does not prevent this team from earning its own Round 1 award. Round 2 instead has the already-confirmed global race for a single winner.
- The teammate work indicator does not choose the credited attempt, grant ownership, or prevent the other member from working/submitting. Opening a bug first is not submission receipt priority.

#### Confirmed Round 2 Winning Claim Order

- For each shared bounty, the earliest correct official submission received by our server wins, across all language variants.
- Server receipt order determines priority, not the participant's clock, browser click time, or judging completion order. Opening a bounty or submitting incorrect code does not reserve its award.
- Do not award a later correct submission while an earlier submission for that same bounty remains unresolved. Once earlier attempts are definitively incorrect, the next correct attempt in receipt order can win.
- Keep the winner pending until that ordering can be resolved and the unique winning claim commits. No provisional points or winning animation should be issued merely because a later result finishes first.
- The exact server-ordering mechanism for simultaneous receipts and persistent infrastructure failures during finalisation remain to be designed. Already-admitted attempts finish judging after the deadline before results lock, as confirmed in Section 6.8. Both rounds use the credited attempt's original server receipt for pause-adjusted solve time; raw judge-status mapping remains a separate implementation contract. Competition penalty categories are confirmed in Section 1.7.

### 1.7 Wrong-Submission Penalties

- Round 1: no wrong-submission penalty.
- Round 2: each wrong submission adds 5 minutes (300 seconds) to the team's time penalty.
- The Round 2 penalty is shared by the team, including wrong submissions from either teammate.
- Count each wrong submission once, not once per failed test case or internal judging retry.
- Confirmed: Run on sample cases is not an official submission and never adds a wrong-submission penalty, including for compilation/runtime errors or time/memory-limit failures during that sample run. Only official Submit outcomes enter the Round 2 penalty calculation.
- Confirmed: judge/server infrastructure failures carry no wrong-submission penalty. Recovery retries remain part of the original official attempt; preserve its source, judging configuration, receipt time/order, and hint tier rather than creating a new submission or penalty opportunity.
- This is an addition to penalty time, not a five-minute submission lockout or a points deduction.
- Example: three wrong submissions add 15 minutes to the Round 2 time penalty.

#### Confirmed Round 2 Verdict Classification

| Official Submission Outcome | Time Penalty |
| --- | --- |
| Wrong output under the configured test comparison | 5 minutes |
| Participant-code compilation error | 5 minutes |
| Participant-code runtime error | 5 minutes |
| Participant-code time limit exceeded | 5 minutes |
| Participant-code memory limit exceeded | 5 minutes |
| Correct solution, whether it wins or loses the shared bounty race | None |
| Judge/server infrastructure failure | None; recover/retry the original attempt |

- This classification is confirmed. Apply at most one 5-minute addition per wrong official attempt, regardless of the number of failed tests, internal jobs, retries, or duplicate result notifications. Round 1 remains free of automatic wrong-submission penalties for every outcome above.
- Waiting/queued/judging states are not wrong verdicts and must not incur a provisional penalty. If an infrastructure retry later establishes a participant-code failure, apply that final verdict's penalty once, not once per infrastructure failure.
- Distinguish program failures under the configured limits from platform/compiler/worker faults. Exact mapping and aggregation of raw judge statuses, including ambiguous failures, still need design; do not classify every unsuccessful job as a participant wrong answer.

### 1.8 Round 2 Final Ranking

Apply this confirmed ranking priority to the separate Round 2 leaderboard:

1. Higher Round 2 competition score from winning bounty solves, applying the confirmed per-bounty hint multipliers in Section 1.9.
2. Lower adjusted time, when points are equal.
3. Higher highest-first solved-difficulty profile, when points and adjusted time are equal.

```text
adjusted_time = cumulative_solve_time + (wrong_submission_count * 5 minutes)
```

- Use the cumulative solve-time and highest-first comparison definitions from Section 1.4, considering only point-earning Round 2 coding bounties.
- Penalty time is separate from cumulative solve time; adjusted time is their sum.
- A time penalty affects ranking only when points are equal. It does not outweigh a higher points total.
- No Round 1 points, solve times, or solved-difficulty ratings contribute to this leaderboard.
- Carryover bounty, wallet earnings, and shop purchases do not themselves add or subtract Round 2 competition points. Purchased hints reduce the points awarded for that particular bounty when won, according to the confirmed hint-score rule.
- Example: scoring solves at 20 and 35 minutes, plus two wrong submissions, give an adjusted time of `20 + 35 + (2 * 5) = 65 minutes`.

### 1.9 Spendable Bounty, Hints, and the Round 2 Shop

- Provide three hint levels per coding bounty in both Round 1 and Round 2.
- Show hints and their individual prices on the relevant bounty's detail/editor page, not in the general shop.
- Pay for purchases using the team's earned, spendable bounty. There is no separate coin conversion, but Round 2 spending balance and competition score must be tracked separately.
- In Round 1, deduct hint prices immediately from the spendable balance and net qualification score, updating the ranking live.
- In Round 2, deduct hint prices immediately from the spendable balance only. Do not subtract the purchase price from the Round 2 leaderboard.
- Hint 1 provides a small clue.
- Hint 2 provides substantial direction without a complete solution.
- Hint 3 provides a near-solution explanation without supplying the complete answer.
- Hint content must be written and reviewed for each bounty so the information increases meaningfully with the hint level. A precise percentage of a problem being solved is not an objectively measurable content guarantee.

#### Proposed Round 1 Pricing

Let `B` be the original base reward of the bounty. Each level below is an additional purchase price, not a percentage of the remaining reward or the team's balance. This earlier price proposal remains for Round 1; confirmed Round 2 pricing is specified separately below.

| Hint Level | Additional Cost | Total Cost Through This Level | Wallet Gain If Bounty Is Eventually Won, After These Costs |
| --- | --- | --- | --- |
| 1 | 10% of B | 10% of B | 90% of B |
| 2 | 30% of B | 40% of B | 60% of B |
| 3 | 40% of B | 80% of B | 20% of B |

- These proposed percentages leave 60%, not 40%, after the first two hints. Confirm the intended percentages before treating the prices as final.
- Higher base rewards already produce higher hint costs; do not silently add another difficulty multiplier.
- The last column describes the net wallet gain after hint costs. It is not the Round 2 competition score or an instruction to deduct the same cost twice. A team that does not win the bounty receives no bounty payout.
- Price rounding and the smallest currency unit still need agreement.

#### Accounting Under the Revised Round Rules

- A hint purchase debits the spendable balance at purchase time. An eventual winning or otherwise point-earning solve credits the full original base bounty to that balance; do not also subtract the already-paid hint price from the payout.
- In Round 1, each team can earn the bounty once. In Round 2, only the confirmed winning team earns it; another team's correct solution does not create a second award.
- Round 1 qualification points remain earned bounty minus Round 1 hint spending. Preserve the full-value award records and separate purchase records for audit.
- At the round transition, preserve the final Round 1 standings and record each qualifier's remaining bounty as its Round 2 opening wallet balance. This carryover is not a Round 2 solve or competition point award.
- Round 2 spendable balance is opening carryover plus Round 2 bounty earnings and any other agreed wallet rewards, minus hint and shop purchases.
- Round 2 competition score starts at zero and sums points awarded for Round 2 winning bounty solves. Keep each original base bounty and its applied hint-related score adjustment separately auditable.
- Example: in Round 2 a team starts with 500 carried-over bounty, buys Hint 1 for 100 and Hint 2 for 300 on a 1,000-bounty challenge, and has 100 left. Winning credits the full 1,000 to its wallet, leaving 1,100, and awards 700 competition points under the confirmed two-hint multiplier.
- Hint purchases debit the wallet and, in Round 1, the net qualification score. They do not directly change elapsed solve time or the wrong-submission time penalty.

#### Confirmed Round 2 Hint Economics

The user approved the following Round 2 prices and score multipliers. They replace the rejected proposal that retained 90% of competition points after all three hints.

- Increasing only the leaderboard penalty does not stop wallet replenishment. With full wallet payout `B` and total hint cost `0.8 * B`, every successful all-hint claim still increases the wallet by `0.2 * B`.
- Increasing the base bounty alone does not fix this ratio if both hint prices and wallet payouts scale with that bounty.
- Preserve the agreed full base-bounty wallet payout, but apply a stronger score trade-off and a total all-hint cost above that payout in Round 2.

| Highest Hint Level Unlocked for This Bounty | Total Wallet Cost | Competition Points If Won | Net Wallet Change If Won, After Hint Costs |
| --- | --- | --- | --- |
| None | 0 | 100% of B | +100% of B |
| Hint 1 | 10% of B | 90% of B | +90% of B |
| Hint 2 | 40% of B | 70% of B | +60% of B |
| Hint 3 | 120% of B | 50% of B | -20% of B |

- The confirmed additional Round 2 prices are 10%, 30%, and 80% of `B`. The third-hint price rises from the earlier 40% proposal to 80%; Round 1 pricing is unchanged by this decision.
- Competition score percentages in the table are final multipliers for the highest unlocked tier, not cumulative deductions. They affect only that bounty's winning score, not unrelated solves.
- The wallet still receives the full `B` on a winning claim. Subtract each hint purchase only once, when purchased; the negative net change above is a comparison with the balance before any hints were bought, not another debit on winning.
- Example: for `B = 1,000`, all three hints cost `100 + 300 + 800 = 1,200`. A team starting with 2,000 spends down to 800, then receives the full 1,000 if it wins, finishing with 1,800 and earning 500 competition points.
- Repeated successful all-three-hint claims now consume savings instead of growing them. Unaided and partially hinted wins can still fund later purchases; this rule does not eliminate every route to earning spendable bounty.
- If another team wins first, the buyer receives no bounty payout and the already-unlocked hints are not refunded, following the existing claim/refund rule.
- Use the highest hint tier already unlocked by the team when the server admits the official submission, as confirmed in Section 3.6. Hints unlocked by either teammate apply across that bounty's language variants; later purchases do not change an earlier attempt's multiplier. Rounding remains open.
- These figures are agreed for the initial design, not evidence of overall balance. In a first-claim arena, hints may still be disproportionately valuable if they greatly shorten solve time or deny many rival teams a scoring opportunity. Playtest unaided, selective-hint, and all-hint strategies, including teams with different Round 1 balances; any later rate changes require an explicit decision.

#### Round 2 Shop and Additional Earnings

- The Round 2 shop contains special items only. Hints remain attached to their own bounty pages because prices and content vary by bounty.
- Special item types, costs, limits, and effects are deferred. No item that changes ranking or another team's opportunities has been approved.
- Round 2 winning solves provide fresh spendable bounty, so teams are not limited to their Round 1 carryover for purchases.
- Additional earning opportunities are planned, but their challenges, rewards, and any eligibility for competition points remain undecided. Do not automatically turn a wallet-only reward into leaderboard points.

#### Confirmed Team Hint Scope

- Purchases and unlocked hint levels are shared by both teammates and apply across language variants of the same bounty within that round.
- Each official submission records the team's highest unlocked hint tier when the server admits it. The award uses that frozen tier, not the team's later hint state.

#### Confirmed Purchase Funding

- Hint and shop purchases require enough currently committed spendable bounty to cover the full purchase price. A balance exactly equal to the price is sufficient.
- Reject an unaffordable purchase without charging the wallet or unlocking the hint/item. Do not allow a negative balance, loans, or borrowing against pending wins or uncommitted awards.
- A team with no spendable bounty must earn enough before purchasing. In Round 2, recorded opening carryover is available for purchases. No additional opening grant has been agreed.

#### Confirmed Hint Sequence

- Strictly require Hint 1, then Hint 2, then Hint 3 in both rounds, using successful purchases for that team and bounty.
- Initially, Hint 2 and Hint 3 are prerequisite-locked. A committed Hint 1 purchase makes Hint 2 eligible; a committed Hint 2 purchase makes Hint 3 eligible, subject to the other purchase checks.
- Use visible but disabled later-tier controls with prices as the initial UI choice, so teams can see the costs ahead. Their content remains server-side until purchased. A click or pending lower-tier purchase is not proof of ownership.
- Enforce these prerequisites on the backend as well as in the UI. Reject an invalid skip-tier request without charging or unlocking anything; do not automatically buy the missing levels.

#### Confirmed Round 2 Claim and Refund Policy

- Once a hint purchase commits and unlocks the hint for the team, do not refund its cost merely because another team later wins the bounty. The purchase pays for information, not a guaranteed bounty reward.
- If the winning claim commits before a new hint purchase, reject that purchase without charging or unlocking another hint.
- Coordinate purchases and claims using the database's consistent processing order, not a participant's click time or the arrival time of a notification.
- Keep already-purchased hints and their purchase history accessible to the purchasing team after the bounty is claimed. This does not reopen submission or award eligibility.

### 1.10 Open Decisions

Resolve these explicitly before implementing the corresponding rules:

- Round 2 competition penalty categories are confirmed in Section 1.7, including penalty-free correct losing attempts and infrastructure failures. Define raw judge-status mapping/aggregation, authoritative penalty records, and ambiguous-failure handling without changing those categories or charging per test/retry.
- Define how bonus awards, if any, contribute to cumulative solve time and the solved-difficulty profile.
- Both rounds' receipt-based cumulative solve time is confirmed in Section 1.4. Define timestamp storage/display precision and the common receipt/admission ordering contract without replacing original receipt times with browser clocks, retry times, or judging completion.
- Round 1 earliest-correct-receipt credit within each team/bounty is confirmed in Section 1.6. Define its pending-attempt coordination and simultaneous-receipt mechanism alongside Round 2's global race, without letting unrelated teams block each other's Round 1 awards.
- Teammate work visibility is confirmed. Finalise Section 2.3's proposed editor-open/leave trigger, per-tab presence tracking, renewal/expiry timings, and stale/reconnecting display; it must not become a scoring reservation or leak private activity to other teams.
- Full-program console submissions, the five-language scope, sample-only Run, and default token/configurable exact-text comparison are confirmed. Define entry points, test records, output decoding/newline conventions and limits, Run access/queue limits, and versioned submission/checker fields. Custom-input runs are not approved; function-only execution remains a future extension.
- Confirmed caps are one queued/running official attempt per team/bounty and two sample Runs per member; different bugs can be submitted without waiting. The 3:1 official/sample dispatch policy and fair team rotation are confirmed. Design atomic admission/release, retry recovery, job granularity/within-team ordering, request-rate limits, total worker concurrency, and global queue/backpressure bounds; load testing is still required.
- Define the server-ordering mechanism for simultaneous receipts, exact deadline/admission boundary, and recovery/timeout/escalation policy for infrastructure failures during finalisation. Finishing already-admitted judging before result lock is confirmed; do not reinterpret it as rejecting pending attempts at the deadline or waiting indefinitely without a recovery policy.
- Finalise session lifetime, the organiser-approved replacement handoff, staff authorisation, and registration import validation. Registration-based team lookup, selecting a registered member by name, and preserving identity/language during an approved replacement are confirmed; selecting a name alone must not bypass an existing session.
- Administrator-code entry is confirmed. Finalise staff credential issuance/revocation, permissions, and session expiry; the detailed protection and console design in Section 5 remain proposals.
- Global, team, and member pause/resume controls are confirmed. Global technical breaks stop active play and extend the shared closing time by their duration. Team-paused duration reduces that team's cumulative solve time without an individual deadline extension. Finalise remaining participant-action/member-clock details, permitted technical-break controls, overlapping interval implementation, and already-admitted judging behaviour without changing the confirmed Round 2 claim order.
- The confirmed arena flow is one instance containing Round 1 then optional Round 2, with no release between rounds, same-instance Round 1 results required for Round 2, and an option to discard after Round 1 and start a fresh instance. Review Section 6's proposed instance/round states, non-destructive discard, singleton protection, roster/version locking, technical-break recovery details, and finalisation rules before implementation.
- Define permitted manual disciplinary penalties, their effects on ranking versus wallet balance, reversal rules, and corrections to published bugs. These new admin capabilities do not silently change the existing scoring formulas or Round 1's lack of automatic wrong-submission penalties.
- Define what happens if all qualification tie-breakers are still equal at the 50-team cutoff without exceeding the cap.
- Define what happens if all Round 2 final-ranking criteria are still equal.
- Confirm the Round 1 hint percentages, given the 60%-versus-40% remaining-reward discrepancy after two hints.
- Define rounding and the implementation of consistently ordered hint purchases and submission admission. The team-level hint cutoff at server admission is confirmed; judging delays must not change the frozen tier.
- Define the Round 1 standings/carryover lock procedure, additional Round 2 earning opportunities, and special item rules before implementing them.
- Balance the shared bounty pool for up to 50 teams and load-test realistic simultaneous submissions. The team cap alone does not establish judge capacity or sufficient scoring opportunities.
- Define the difficulty-to-base-reward mapping and hint price rounding.

## 2. System Components and Live Updates

### 2.1 Responsibilities

| Component | Responsibility |
| --- | --- |
| Browser: React, Three.js, and Monaco | Render the arena, HUD, editor, and notifications; collect participant actions and display confirmed state. |
| Backend: Fastify with Socket.IO | Authenticate sessions, enforce round rules, coordinate judging, calculate rankings, and distribute live updates. |
| Competition database: PostgreSQL | Persist arena instances, their rounds, teams, submissions, score awards, wallet activity, purchases, penalties, and competition history. |
| Judge0 on an isolated server | Compile and execute submitted programs and return execution/test results; do not decide competition points or bounty ownership. |

These are logical responsibilities, not four separate machines. The initial deployment can place the backend and competition database on one VM and Judge0 with its supporting services on another. The browser does not connect directly to either database or to Judge0.

### 2.2 Two Communication Paths

```text
Browser -- HTTPS API requests --> Backend --> Competition PostgreSQL
Browser <-- Socket.IO updates -- Backend <--> Private Judge0
```

- Use the HTTPS API for initial state and explicit actions such as submitting a solution.
- Save an authorised submission before dispatching it for judging. Do not hold a database transaction open while waiting for Judge0.
- Use Socket.IO for live notifications, submission progress, team HUD changes, and leaderboard updates. It runs within the backend rather than requiring another application server.
- Browser-side bug movement is cosmetic. Server-controlled bounty availability, ownership, scores, and round state determine competition outcomes.

### 2.3 No Manual Refresh Required

- Participants must receive live competition updates without refreshing the page.
- In Round 1, a solve updates both teammates' arena progress without removing the bounty from another team's arena.
- In Round 2, once a winning claim is confirmed, broadcast the claimed bounty to every authorised finalist session, including sessions currently editing that bounty.
- A claim applies to the bounty across all its language variants, not just the winning submission's language.
- Remove or mark the claimed bug as unavailable in every finalist's arena and update the affected scores and leaderboard.
- If the coding panel is open, show a persistent claimed-bounty notice, disable further submission for that bounty, and preserve the participant's draft. Do not close the panel or erase their code automatically.
- The winning team's success animation follows the confirmed award; animations never create awards themselves.
- Updates are near-real-time after the winning claim is confirmed, subject to judging, network, and reconnection delays. Do not promise zero latency.
- Show a bounty's team-shared queued/judging state to both teammates and prevent another official Submit for that same bug until its judging slot is released. Other bugs remain submittable under their own eligibility checks. This durable submission status is distinct from the soft work indicator below; neither update may overwrite a teammate's editor draft.

#### Teammate Work Indicator

- Confirmed requirement: show that a teammate has taken on a bounty in both rounds. Proposed display is a small member-name/status indicator on the bug and its detail/editor panel, such as Aman is working on this bug; update it live for the team's authorised sessions.
- Proposed trigger: opening that bounty's coding editor declares work intent; closing/leaving the editor withdraws that editor's intent. Mere browsing of the challenge summary need not mark it taken on. The precise trigger still needs review; the signal describes declared editor activity, not proof that a person is typing or present.
- Scope the indicator to the shared bounty family, not one language variant. A member working in C++ can be shown to their teammate using Python. If both are working on the same bug, show both rather than overwriting one member's state with the other.
- This is a soft coordination signal, not an exclusive lock, claimed bounty, submission, or reward. It does not reserve a Round 2 bug, alter receipt priority, start a separate clock, charge a wallet, or prevent either teammate from submitting under the normal rules.
- Derive team, member, round, and instance from the authenticated session and validated bounty access. Notify only that team's authorised sessions, not rival teams or a public leaderboard. Do not broadcast editor keystrokes/source or implement collaborative code editing merely to display this status.
- Proposed reliability model: track work intent per authenticated editor/tab with a renewable short expiry, then aggregate by member and bounty. Leaving one tab must not clear a member still working in another. Explicit leave clears only that editor's intent; abrupt disconnection/closed browsers lose stale intent after the agreed grace/expiry. Exact intervals and storage remain undecided.
- Work-presence expiry does not expire/revoke the member's login, release their registered member slot, or reset their language/draft. On reconnect or backend restart, rebuild current indicators from revalidated editor intents rather than showing an old status indefinitely. A reconnecting/stale label may be shown during the grace period; do not promise instantaneous disconnect detection.
- End or mark intent inactive when the bounty becomes solved/unavailable to the team, the round closes, or the relevant access is revoked; proposed pause display is paused rather than actively working. Keep drafts intact. All signals remain instance/round scoped and cannot leak into a new instance.
- Presence is transient coordination state, not authoritative competition history. Its refresh/expiry must not require a new award, wallet transaction, or durable outbox event for every heartbeat. Authoritative solve/claim notifications retain the existing committed-state and recovery rules.

### 2.4 Event Audiences

Event names below are provisional; their audiences are part of the architecture.

| Event | Audience |
| --- | --- |
| `submission.updated` | The submitting team only, with permitted progress/verdict/claim state and no hidden inputs, expected answers, or raw execution output. |
| `team.updated` | That team's authorised sessions and tabs. |
| `wallet.updated` | That team's authorised sessions and tabs only. |
| `hint.unlocked` | The purchasing team's authorised sessions and tabs only. |
| `bounty.work.updated` (proposed) | That team's authorised sessions/tabs only, across its bounty language variants. Include the validated member/bounty work status, not live source code. |
| `bounty.solved` in Round 1 | The solving team's authorised sessions and tabs. |
| `bounty.claimed` in Round 2 | All authorised finalists in that round. |
| `leaderboard.updated` | Authorised viewers of that round's leaderboard. |
| `pause.updated` (proposed) | All authorised round participants for a global pause; that team's authorised sessions for a team or member pause; staff with the relevant monitoring permission. Include scope and effective paused state, not private staff notes. |

- Use authenticated Socket.IO rooms to select audiences. The backend derives room membership from the session and round eligibility, not from an unverified team ID supplied by a client.
- Scope competition snapshots, notifications, and room membership to the arena instance and round as well as the team/member. A stale event or judging callback from an archived instance must not update the current instance's HUD, leaderboard, claims, or wallet.
- Public claim notifications may identify the bounty and winning team's public name. Never broadcast submitted source code, access codes, hidden test cases, or credentials to other teams.
- A Round 1 hint purchase changes the net qualification score and public ranking. A Round 2 purchase changes the private team wallet and unlocked hints, not the public competition score at purchase time.

### 2.5 Reliable State and Delivery

- PostgreSQL is authoritative. Commit the winning claim and score award before broadcasting a success event.
- Record a durable notification event alongside the claim/award in the same transaction, then publish it after commit. Retrying publication must not create another award.
- Give events stable identifiers and state versions so duplicate or older notifications do not apply changes twice or overwrite newer state.
- Revalidate bounty availability and team eligibility on every submission. A stale browser or a disabled-button bypass cannot claim an already-awarded bounty.
- Resolve already-pending Round 2 submissions according to the confirmed earliest-correct-server-receipt rule and Section 1.7's confirmed penalty categories. Receiving a notification is not what determines a submission's outcome; raw judge-status mapping remains a separate implementation contract.
- On connection loss, show that live state may be stale, retain drafts, and reconnect automatically. Require resynchronisation before re-enabling official submission controls; do not silently queue fresh offline submissions.
- On initial connection or reconnection, obtain the current authorised state automatically. Coordinate room subscription, a versioned state snapshot, and buffered/replayed newer events so an update cannot be lost between fetching state and starting live delivery.
- Socket.IO connection recovery is an optimisation, not the only recovery mechanism. A backend restart or failed packet recovery must still recover through a fresh authoritative state snapshot without a manual page reload.
- Recheck authorisation after reconnecting. A revoked session or non-qualifying team must not regain access through recovered room membership.
- Restore the current member's locked round language with the authorised state; reconnecting must not create a new language choice for that round.
- Test an open editor when another team claims its bounty, simultaneous claims, duplicate events, missed events, backend restart, and reconnecting after several bounties were claimed. Measure notification latency under realistic load.

### 2.6 Hint Purchase Boundaries

- The backend checks the active round, session, team balance, hint ownership, and all required earlier hint levels using committed team purchases before allowing a purchase.
- In Round 2, coordinate hint purchases and winning claims against the same bounty so their database decisions are ordered consistently. If the claim commits first, reject the new purchase without any charge or new hint unlock.
- Calculate prices on the backend from the agreed base reward and pricing rule; do not trust a price or balance supplied by a browser.
- Coordinate purchases with submission admission so each official attempt records the team's highest already-unlocked hint tier at its confirmed cutoff. Purchases recorded afterward must not modify that attempt's snapshot.
- Debit the spendable wallet, record the purchase, unlock the hint, and record its notification events together in a database transaction. Apply the corresponding Round 1 net-score change, but do not debit Round 2 competition points at purchase time.
- Concurrent clicks by teammates or retries of the same purchase must not charge twice or overspend the wallet under the confirmed sufficient-balance rule. Purchases for different bounties and future shop items must also coordinate against the same team balance.
- Return only purchased hint text to the authorised team. Locked hint text must not be bundled into frontend assets, page markup, or initial challenge responses.
- After a committed purchase, update both teammates' wallet and unlocked hints live. Update the public leaderboard for a Round 1 net-score change; in Round 2, the confirmed hint-related score adjustment is applied only to the eventual winning solve's point award. Never broadcast private hint text to other teams.
- Apply the confirmed Round 2 no-refund rule to purchases committed before another team wins. A later claim must not automatically reverse those wallet debits.
- Test both purchase/claim orderings, duplicate purchase retries, simultaneous purchases by teammates, and purchases ordered just before or after submission admission. Verify the charge, hint unlock, frozen submission tier, claim, and live notifications remain consistent.

### 2.7 References

- [Socket.IO rooms](https://socket.io/docs/v4/rooms/)
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
- [Socket.IO connection state recovery](https://socket.io/docs/v4/connection-state-recovery/)

## 3. Data Model

Status: conceptual draft for discussion. This section does not create database tables or fix final column types, ID formats, or ORM mappings. Round 2 hint prices and score multipliers are agreed; record design continues incrementally, with the remaining open rules identified in Section 1.10.

### 3.1 Foundational Records

| Record | Meaning | Initial Information |
| --- | --- | --- |
| `Team` | The registered team itself, shared across both rounds. | A unique internal identifier, public team name from registration, and a registration-source reference if available. Associate its private access code with this record; credential/session details are discussed in the conceptual draft in Section 3.9. |
| `TeamMember` | One registered member belonging to a team. | A stable internal member identifier, team reference, and display name from registration. Use the identifier, not the name text, for session and round relationships. |
| `ArenaInstance` | One competition run containing its own Round 1 and optional Round 2. | A unique instance identity, display name/reference, lifecycle status, creation/completion/discard audit, and child rounds. It remains current between rounds; exact fields and status representation are proposed in Section 6. |
| `Round` | One configured stage belonging to a specific arena instance. | A unique round identifier, required arena-instance reference, Round 1/2 kind, arena mode, status, and round-specific duration/roster/content/timing. Allow at most one Round 1 and one Round 2 per instance. |
| `TeamRound` | One team's participation in one round. | A team reference and round reference. The pair must be unique and neither reference can be missing. |
| `BugDefinition` | The reusable bug identity in the organiser's pool. | Stable identity and Round 1/2 category, separate from its content revisions and competition progress. The conceptual record split is confirmed; individual fields remain proposed below. |
| `BugVersion` | One specific content revision of a pool bug. | Its title/statement, difficulty, base bounty, hints, submission format, and checker, with associated language variants and tests. Exact fields and publishing lifecycle still need discussion. |
| `LanguageVariant` | One language's implementation of a particular bug version. | Version reference, buggy starter, private correct reference solution, and language/runtime/execution settings. It belongs to `BugVersion`, not separately to each arena selection. |
| `TestCase` | One sample or hidden test belonging to a particular bug version. | Version reference, input, expected output, and SAMPLE/HIDDEN visibility. The version's test suite and checker are shared across its language variants. |
| `BugValidationRun` | Organiser validation evidence for an exact challenge configuration. | The selected version/configuration, reference-solution checks, intended starter failures, and validation outcomes. This is separate from participant sample Runs. Exact report structure remains proposed. |
| `Bounty` | One selected coding challenge and reward offered in one round. | A unique bounty identifier, round reference, and exact selected `BugVersion`, with round-bound rule configuration. Resolve content from that pinned version rather than mutable pool content; final reference/snapshot field mappings remain to be designed. |

### 3.2 Relationships

```text
Team (1) ---- (many) TeamRound (many) ---- (1) Round
                                              |
                                             (1)
                                              |
                                            (many)
                                              |
                                            Bounty

ArenaInstance (1) ---- (up to 2) Round
                      One Round 1; at most one subsequent Round 2
```

- A team can participate in more than one round, but has at most one `TeamRound` record per round.
- Each `Round` belongs to exactly one `ArenaInstance`; the pair `(arena_instance_id, round_kind)` must be unique. The current-instance lifecycle is separate from whether a child round is running or closed.
- A round has many participating teams. Only the qualifying teams receive an eligible Round 2 participation record.
- A round offers many bounties. In this initial model, each bounty record belongs to exactly one round.
- The confirmed conceptual pool-to-arena relationship is `BugDefinition -> BugVersion <- selected Bounty -> Round`: a definition has revisions, and each round selection pins one exact revision. A pool record is not itself a live claim or team solve; Section 6 explains selection and version locking. The round-bound `Bounty` remains the submission, award, and purchase boundary used below.
- `TeamRound` is a linking record, also called a junction record. Its lookup key is the pair `(team_id, round_id)` rather than the team alone.
- A primary key identifies a record. A foreign key references an existing related record; PostgreSQL can enforce these relationships and prevent duplicate team-round pairs.

### 3.3 Separate Round Histories

- Do not keep the competition's only score on `Team`, or reset a team-wide score when the final begins.
- Attach later score awards, wallet activity, purchases, and penalties to the appropriate team-round participation.
- Create a new participation entry for each finalist in Round 2. It begins with no Round 2 competition point awards, purchases, solves, or penalties; Round 1's records stay intact.
- Separately record the qualifier's opening Round 2 wallet balance from the final, unspent Round 1 bounty. Preserve its source and the locked Round 1 result rather than counting the transfer as a Round 2 solve or changing historical standings when it is spent.
- Carryover and qualification must link Round 1 and Round 2 of the same arena instance. A fresh instance creates fresh round identities and histories: Round 1 starts from zero, and prior solves, wallets, penalties, hints, and member language locks are not carried into it. Registered teams/member identities and the organiser's bug pool can still be reused.
- Round 1 net points, Round 2 competition points, spendable balances, cumulative solve times, and difficulty profiles have different derivations. The conceptual submission, award, wallet activity, and hint purchase records are discussed in Sections 3.5 through 3.8; any cached summary is not a replacement for history.

Illustrative leaderboard values, not additional stored columns at this stage:

| Team | Round | Leaderboard Points | Spendable Bounty |
| --- | --- | --- | --- |
| Team 17 | Round 1, at qualification lock | 1,200 | 1,200 remaining |
| Team 17 | Round 2, before any purchases or solves | 0 | 1,200 carried over |

### 3.4 Bounty Boundaries

- A bounty represents the shared challenge and reward, not one team's progress or a single language's source code.
- Language variants belong to the selected `BugVersion`; a `Bounty` resolves its available variants through that version. Two teammates can use different variants of the same bounty without creating two scoring opportunities for their team or duplicating pool variants for every arena.
- The challenge family defines a consistent submission contract across its language variants. Initially every supported variant supplies a complete runnable program and matching I/O specification. Function-only variants are not enabled; later support must explicitly version its mode, signatures, wrappers, and tests rather than silently changing an active bounty.
- Do not use a single global `solved` flag on `Bounty` to represent Round 1 progress. Different teams can solve the same bounty independently; solve records will represent that relationship.
- Round 2 additionally needs a unique winning claim for the bounty. Submission and conceptual award records are discussed separately in Sections 3.5 and 3.6.
- Round 1 and Round 2 pool categories are distinct, and the selected definition must match the arena's round. Do not silently reuse or relabel a Round 1 selection as a Round 2 bug. A strict policy on duplicate/closely related content across separately authored definitions still needs review; any later permitted reuse must preserve earlier versions and round history.

#### Confirmed Bug-Readiness Gate

- A bug cannot be marked arena-ready unless every required language variant has a private correct reference solution that passes all published sample and hidden tests under the selected checker and execution configuration.
- Each supplied buggy starter must demonstrate its intended defect by failing at least one relevant validated case or intended compilation/runtime check. A starter that already passes every required check unchanged cannot satisfy readiness merely because its reference solution also passes.
- An intentionally faulty starter may have a compilation/runtime defect; do not require it to compile successfully when that is the intended bug. Its corrected reference still must compile/run and pass all tests. Judge/worker/network failures are not evidence of an intended starter defect and cannot satisfy this gate.
- These checks are mandatory. Proposed validation records bind the outcome to the exact starter/reference sources, test inputs/expected outputs, checker version, language/runtime, and execution limits being validated, with a staff/validation-run identity and result details. Exact record design and processing mechanics remain conceptual.
- Changes to code, tests/expected outputs, checker, runtime, or limits invalidate readiness for the changed configuration until validation succeeds again. A cached ready flag or a report for a different revision is insufficient. Recheck the selected version/report at arena start; retain the immutable versions used by already-started or historical bounties.
- Keep reference solutions and hidden validation data server-side and staff-permission protected. Authoring validation is not a participant Run/Submit, does not claim a bounty, and must not change competition scores, wallets, penalties, or receipt priority.
- Drafts remain editable/storable before readiness. A successful technical validation does not itself guarantee a correct problem statement, adequate test coverage, equivalent difficulty across languages, or good hints. Human review remains necessary before the bug is published/selected for a competition.

#### Confirmed Challenge Record Structure

The separation of responsibilities above is approved at the conceptual level. It does not yet settle physical tables, column types, IDs, publication states, or database constraints. We will discuss each record's fields separately.

```text
BugDefinition (1) ---- (many) BugVersion
                              |
                              +---- language variants
                              +---- shared sample/hidden tests
                              +---- organiser validation runs

Round (1) ---- (many) Bounty ---- (1) selected BugVersion
```

- Example: an arena using Bug 12 version 1 continues to use version 1 when an organiser prepares version 2. Changes must not silently change the active or historical challenge.
- Hints are versioned content, but unrevealed hints remain private until the team's purchase authorises access. Reference solutions and hidden tests remain staff/server-only; a version relationship is not permission to expose every related record.
- Readiness evidence must match the exact selected configuration. Changing an editable configuration invalidates readiness for that changed configuration, not the preserved configuration of an existing bounty.
- Selecting two versions of the same definition must not create duplicate bounties for that definition in one round. The physical enforcement mechanism remains open.

#### Proposed BugDefinition Fields

This is the first field-level proposal for review, not an approved physical schema.

| Field | Purpose |
| --- | --- |
| `id` | Stable internal identity shared by all versions of this bug. |
| `round_type` | Classifies the pool bug for Round 1 or Round 2. |
| `archived_at` | Empty while available for future selection; otherwise records when it was archived. Exact archival behaviour remains proposed. |
| `created_by_staff_id` | References the organiser who created it, never their raw admin access code. |
| `created_at` | Server-recorded creation time. |

- Keep the public title, statement, difficulty, reward, hints, and checker in `BugVersion`, not as mutable content on this parent record. The pool interface can display a version's title without another independent title field here.
- Do not store team scores, wallet balances, a global solved flag, or a winning team on `BugDefinition`; those belong to competition-specific records.
- Proposed archival removes the definition from future selection without deleting earlier versions or changing already-selected bounties and their history.
- Open policy: should the Round 1/2 category become immutable once the first version is published? Recommendation: yes, with genuinely different-round content authored as a separate definition subject to the cross-round content-review policy. This recommendation is not yet confirmed.

### 3.5 Submissions and Judging

Status: conceptual proposal for this discussion chunk, not a database migration or a final schema. Full-program submissions for the five console languages are confirmed, as are Round 1 per-team/Round 2 global receipt-order credit and both rounds' original-receipt solve times. Entry-point conventions, raw result contracts, precision, receipt/admission coordination, pending processing, and recovery mechanics still need design.

#### Confirmed Sample Run Versus Official Submit

| Action | Test Access | Competition Effects |
| --- | --- | --- |
| Run | Published sample cases only, with their public inputs and expected outputs | No award, wallet/score change, solve time, race priority, or wrong-submission penalty, even when the sample execution fails |
| Submit | The configured official judging suite, including server-private tests | One admitted official attempt, frozen source/receipt/hint tier, and the previously agreed verdict, award, and penalty rules |

- This separation is confirmed for both rounds. Running samples successfully is not an official solve and must not trigger a winning animation, reserve a bounty, or automatically submit the code. Participants must explicitly Submit to enter the official judging/credit flow.
- An official Submit has its own original receipt/order and team hint snapshot at admission. Never reuse an earlier sample Run time or hint tier, or convert its sample-only pass into hidden-test acceptance. Capture the actual submitted source; edits after a Run cannot inherit its success as proof of correctness.
- Custom-input execution is not part of the confirmed Run scope. Resolve sample identifiers/content on the server from the published challenge version; do not let a forged case identifier, test payload, or mode parameter access hidden tests or promote a Run into an official attempt.
- Proposed tracking keeps sample executions distinguishable from official `Submission` records, even if their internal execution-job infrastructure is shared. Exact record/table names remain undecided. Run callbacks must never enter the official award/penalty coordinator or delay finalisation merely because a sample result is pending.
- Confirmed sample feedback shows public sample input, expected/actual output, per-sample result, and safe compilation/runtime diagnostics. Do not expose private test data, organiser solutions, worker paths/secrets, or execution credentials. The shared participant-feedback contract below defines the official Submit boundary; sanitisation/output caps still need design.
- Confirmed: admit at most two queued/running sample Run requests per member, independent of the team/bounty official-submission guard. Penalty-free does not mean unlimited server use: rate/output/resource and worker/global queue bounds still need design/load testing. The official/sample 3:1 dispatch policy is confirmed below.
- Run must still validate the current instance, round/team/member eligibility, selected language, and frozen challenge configuration. Proposed initial availability is only while the round and bounty are available and the member is not paused/blocked; pause, claim, post-close behaviour, and pending sample-work handling still require review. Preserve drafts regardless of a rejected Run.

#### Confirmed Participant Feedback

| Action | Participant-Visible Result | Private Data Boundary |
| --- | --- | --- |
| Sample Run | Public sample input, expected output, actual output, per-sample outcome, and safe compilation/runtime diagnostics | Only the published sample execution; no platform secrets, organiser solutions, or hidden-suite data |
| Official Submit | Overall judging verdict and general failure category, with separate pending/won/lost claim state as applicable | No hidden test inputs, expected answers, raw program stdout/stderr, or raw execution/worker messages |

- This visibility split is confirmed in both rounds and applies to the team's authorised participant access, not just the submitting browser's first response. Keep a correct verdict distinct from a lost bounty race or an award still waiting on earlier attempts.
- Submitted programs can print their received input or include it in error messages. Therefore hidden-test stdout, stderr, and raw runtime messages must not be forwarded as helpful diagnostics, including on a failed or timed-out run. Official compile failures receive their general category; detailed debugging remains available through sample Run.
- Enforce an explicit server-side participant result shape across HTTP status/history reads, Socket.IO events, reconnect snapshots, errors, and any participant downloads/exports. Hiding a panel or field in the frontend is not sufficient. Do not forward a raw Judge0 result object and expect the browser to remove private fields.
- Proposed internal storage may retain restricted execution details for authorised organiser debugging, with staff permissions and later retention/output-cap rules. Those records must not become participant-accessible merely because the submission belongs to their team. Their raw job tokens, paths, infrastructure messages, and credentials remain private as well.
- Treat permitted sample output/diagnostics as untrusted display text with sanitisation, safe rendering, and size limits. The implementation mechanisms remain to be designed. Always select the feedback policy from the server-owned execution purpose and published sample membership, not a client-provided visibility flag.
- Additional official per-case breakdowns, counts, timing/memory statistics, or diagnostic detail are not introduced by this decision. Review any later extension against the hidden-data boundary and actual execution strategy rather than silently expanding the approved result contract.

#### Confirmed Output Comparison

| Mode | Matching Rule |
| --- | --- |
| Token comparison (default) | Split expected and actual output into whitespace-separated tokens. Require the same token count, order, values, and letter case. Extra separating spaces, tabs, or line breaks do not cause a mismatch. |
| Exact-text comparison (per-bug option) | Treat formatting as part of the answer, including significant spaces and line breaks; do not silently apply token matching or trim away formatting. |

- This choice is confirmed. A token checker must not sort output, ignore extra/missing tokens, ignore case, or coerce numeric values: `1` and `1.0` are different tokens. Floating-point tolerances, multiple-valid-answer checkers, or other custom modes require a separate decision and are not silently enabled.
- Configure one comparison mode on the versioned bug family and apply it consistently across its language variants, sample Run results, and official tests. Describe formatting requirements in the challenge's I/O contract. Participant requests cannot select a weaker checker or replace expected outputs.
- Freeze the checker mode/version with the selected round bounty and each admitted judging configuration. Pool edits or future checker additions must not reinterpret active/historical attempts. Defaulting to token comparison must be explicit, not dependent on a browser setting.
- The backend owns the authoritative output-match decision after successful execution; output matching cannot turn a compilation/runtime/resource failure into an accepted solution. All required official tests must pass both execution and the configured checker.
- Proposed Judge0 integration: obtain program execution results and apply the chosen checker on the backend, rather than assuming the service's generic Accepted status proves our output rule. Judge0 documents that omitting `expected_output` disables its output comparison; that execution-only path can support our explicit checker, but the exact job/status integration must be validated before implementation. See [Judge0 submission attributes](https://ce.judge0.com/).
- Define output decoding, exact-mode newline conventions, complete-output limits, and invalid/truncated-output handling in the test/execution contract. Never accept a matching truncated prefix as a complete correct answer or normalise significant exact-mode formatting without an explicit documented rule. These technical details are still open, not implemented here.

#### What a Submission Represents

- One `Submission` represents one official solution attempt admitted by the backend, not one individual test case or one Judge0 execution job.
- Save the attempt before dispatching any judging work. A later editor change must not change the source code being judged for that attempt.
- Associate the attempt with the authenticated team's participation in the active round and arena instance. Check that the bounty belongs to that same round and that the selected language variant belongs to the bounty's pinned `BugVersion`, not merely the same pool definition or language.
- Check that the variant's language matches the submitting member's recorded language for this round. Select the execution configuration on the backend; a forged language or variant parameter must not bypass the lock.
- Check the bounty's server-controlled, versioned submission format. Initially accept complete-program submissions only; reject unsupported function-only/browser challenge configurations rather than guessing a wrapper or accepting a client-supplied mode override. Exact format field names and validation are still conceptual.
- A language variant identifies the chosen implementation of a bounty, not a separate scoring opportunity. Its detailed record is outside this chunk.

#### Confirmed Team-Per-Bug Official Submission Limit

- Allow at most one queued or running official submission for the pair `TeamRound + Bounty`, across both registered members, tabs/sessions, and language variants. Selecting another language/member does not provide a second pending slot for the same bug.
- A member can submit Bug B or C while their Bug A is still queued/judging, provided each target bug has no pending official submission from that team and normal eligibility checks pass. There is no retained one-official-attempt-per-member or two-per-team total cap; global queue/resource admission limits remain to be defined.
- Release the team/bounty slot when the authoritative aggregate judging verdict is recorded. An award still waiting on an earlier receipt does not itself retain the judging slot; release does not grant an award or bypass solved/claimed-bounty eligibility checks.
- While the slot is occupied, reject either teammate's genuinely new Submit for that bug as busy, preserve their draft, and show the existing queued/judging status to both. A busy rejection has no penalty or receipt priority. Do not automatically queue a second official attempt or submit it later with an old receipt/hint snapshot.
- Recognise retries of an already-admitted request under the existing request-key/payload rules rather than creating another attempt or incorrectly blocking recovery. A genuinely new request must pass this team/bounty guard and the normal session, round, language, and bounty rules.
- Proposed database coordination acquires the durable team/bounty guard together with submission creation in a short transaction. Simultaneous submits from both members, multiple tabs, device replacement, and restart must not bypass it. The exact constraints/record layout remain conceptual.
- Infrastructure recovery retains the original attempt and team/bounty slot while judging remains unresolved. It does not prevent the same member/team from submitting a different bug. A browser disconnect or one failed internal job must not silently release this slot; persistent-failure terminal recovery is still open.
- Proposed verdict processing releases only the guard owned by that completed attempt, consistently with recording the aggregate result. Duplicate/late callbacks must not clear a newer attempt for that bug. Update both teammates' controls live after the committed change.
- One official attempt may involve several execution jobs. This admission rule is not the number of jobs that execute simultaneously and does not establish capacity for 100 teams. Sample Runs remain separate, penalty-free, and limited to two requests per member; they never reserve an official slot or receipt priority.

#### Confirmed Per-Member Sample Run Limit

- Allow at most two queued or running sample Run requests for each durable `MemberRound`, across all bounties, tabs, and authorised/replacement sessions. Each teammate has independent capacity, giving up to four sample Runs per team. This replaces the proposed one-Run limit; it is not two runs for the whole round or two sample test cases.
- Count one admitted Run request as one run, even when it executes several published sample cases. A member may have two sample Runs alongside official attempts for different bugs, subject to the team/bounty guard and additional global backpressure/resource rules. Logical request counts are not simultaneous judge-job counts.
- Proposed admission coordinates the member's outstanding sample requests atomically, recognises retries of an existing request, and rejects a genuinely third outstanding Run as busy with no penalty or competition effect. Refreshing, multiple tabs, replacement, or restart must not provide extra slots.
- Proposed completion releases the capacity owned by that Run once its aggregate sample outcome is terminal. One sample-case completion or a duplicate/late notification must not free an unrelated run's capacity. Retry, timeout, and cancellation mechanics remain part of the execution/recovery design.
- Keep a Run identity and fixed source/configuration snapshot so feedback from two concurrent Runs remains associated with the correct code and sample cases. Older results must not be shown as successful validation of newly edited code. Runs remain sample-only and cannot acquire official receipt priority, hint snapshots, or awards.
- The two-per-member cap does not decide cooldowns, total worker concurrency, global queues, or Run availability while paused/claimed/closed. Those policies still need review/load testing. Pending sample work remains outside official result-finalisation requirements.

#### Confirmed Global Judge Scheduling Policy

- Maintain separate logical queues for official judging and sample execution. When both have eligible waiting work, dispatch three official execution jobs followed by one sample job. This is a 3:1 dispatch-turn policy, not a ratio of whole submissions, a CPU-time reservation, or a guaranteed response time.
- Rotate fairly between eligible teams within each queue rather than letting a team consume every dispatch turn by submitting many different bugs. Team identity comes from authenticated participation, not a client-selected queue identity. Exact job granularity and within-team ordering remain implementation contracts to define.
- If one queue is empty, let the other use available execution capacity; do not leave workers idle simply to maintain the ratio. Do not interrupt a running job merely because higher-priority work arrives. Normal execution/security limits still apply.
- Dispatch only up to the configured global worker/in-flight bound; do not dump an unbounded sample backlog into a downstream queue that cannot enforce our policy. Choose worker/queue/rate bounds through realistic language/test-workload measurements, not team count alone. No additional overall per-team cap is silently introduced here.
- Scheduling affects execution order only. Preserve original receipt/order and hint snapshots; both rounds' credit coordinators still apply their confirmed receipt rules. A later correct result cannot win a Round 2 bounty while an earlier eligible attempt remains unresolved, and waiting for an award must not occupy an execution worker.
- Proposed durable job tracking preserves execution purpose, actor/team/instance/round, attempt/run association, and retry identity through failures/restarts. Retry backoff/limits, authoring-validation scheduling, precise backpressure behaviour, and the physical queue mechanism still need design. Capacity rejection must not become a wrong answer or silently discard an already-admitted official attempt.

#### Proposed Submission Information

| Information | Why It Is Needed |
| --- | --- |
| Submission identifier | Identify one competition attempt independently of its internal execution jobs. |
| Team-round reference | Associate the attempt with the correct team and round without relying on a client-supplied team identity. |
| Bounty and language-variant reference | Identify the challenge and supported language being attempted. |
| Submitting member/session reference | Distinguish the teammates' attempts and resolve the submitting member's durable round language choice. The access/session model will define the exact references. |
| Frozen source code and judging configuration reference | Preserve the complete program and fixed submission format, language/runtime, entry point, tests, and output-checker mode/version. Detailed records are to be designed; future format/checker additions must not reinterpret an earlier attempt. |
| Server receipt time and ordering information | Preserve the original receipt for confirmed Round 2 claim priority and both rounds' cumulative solve-time calculation. Do not substitute browser, judging completion, retry, or award recording timestamps. Precision and simultaneous-receipt ordering still need design. |
| Request key | Recognise a network retry of the same Submit action instead of creating another official attempt. |
| Judging progress, aggregate verdict, and completion time | Separate work still waiting/running from completed code results, and preserve when judging actually finished. |
| Hint-level snapshot | Record the team's highest unlocked hint tier when the server admits the official submission, under the confirmed cutoff. Do not read a possibly changed tier when judging finishes. |

#### Proposed Judging Lifecycle

```text
Participant presses Submit
          |
Backend validates access, round, bounty, language, and request key
          |
Submission saved as queued, with its fixed source code
          |
Judging work dispatched and tracked
          |
Aggregate verdict recorded
          |
Backend decides award eligibility under the round's rules
          |
Committed result delivered to the team's browser sessions
```

- `queued`, `judging`, and `completed` are provisional application-level processing states, not a copy of the Judge0 status list. Judging is asynchronous; the API can acknowledge a saved submission before the result is ready.
- Judge0 returns a token for an execution job so the backend can retrieve its result. A competition submission may require several jobs, for example when separate hidden test cases are dispatched; retain those job references server-side and associate them with the same competition attempt.
- The competition verdict is accepted only when every required test has been verified under its frozen token/exact-text rule. Passing one job or merely executing successfully is not enough; the competition backend must establish both execution success and output correctness under the contract above.
- Confirmed: distinguish judge/server infrastructure failures from participant-code failures. Infrastructure failures incur no wrong-submission penalty, and recovery retries remain within the original official attempt. Participant-code wrong output, compilation/runtime errors, and time/memory-limit failures each incur one 5-minute penalty in Round 2 under Section 1.7; raw status mapping/aggregation still needs design.
- Preserve pending work and known job references so a backend restart can recover dispatch/result tracking. The recovery and retry mechanism will be designed with the judging worker; do not depend on one browser connection staying open.

#### Confirmed Infrastructure Failure and Retry Rules

- Retry the original admitted submission using its unchanged source, challenge/test/execution version, original server receipt time/order, and frozen team hint tier. A retry does not consume a new official attempt, move the team to the back of a bounty race, or apply a later hint purchase.
- An internal failure adds no wrong-submission time penalty. If recovery eventually produces a participant-code verdict, apply that verdict's agreed rules once for the original attempt; do not count failed infrastructure jobs as additional wrong answers.
- Retry after the deadline is recovery of already-admitted work, not permission to submit edited code or admit a new attempt. Preserve the closing/finalising phase and the current-instance reservation while scoring-impacting work remains unresolved.
- Persistent failures require organiser attention and keep affected results provisional. They must not silently become wrong answers or be skipped to award a later Round 2 submission. Retry counts, delays, alert thresholds, and permitted terminal organiser actions remain to be agreed; no force-award/cancel policy is approved here.
- Proposed execution tracking: record internal retries beneath the same official submission, recover known job/result state where possible, and reconcile delayed/duplicate results before posting one authoritative outcome. A lost response alone is not evidence that participant code failed. Exact worker/job reconciliation mechanics still need design.
- A participant's genuinely new Submit action is still a new official attempt under the admission rules. Do not deduplicate distinct attempts solely because their code happens to match.

#### Correctness Is Not a Bounty Award

- Keep the judging verdict separate from the eventual award decision. An accepted verdict means the submitted program passed the required tests, not that points or spendable bounty have already been credited.
- In Round 1, choose the earliest correct receipt within that team/bounty, waiting for earlier unresolved attempts from that team rather than choosing the first result to finish. Other teams remain independent. A later accepted attempt for an already-credited bounty creates no additional award, including when it uses another language.
- In Round 2, a correct attempt can receive no award because another team wins the shared claim. Preserve its correct verdict; do not relabel it as a wrong answer. Confirmed: a correct losing attempt receives no wrong-submission penalty, even though it earns no bounty.
- Where earlier attempts for the same bounty are unresolved under the confirmed receipt-order race rule, a correct result may be awaiting an award decision. Do not show the winning animation or grant provisional points before the winning claim commits.
- The conceptual award record and duplicate-award requirements are discussed in Section 3.6. The submission verdict is not a replacement for that award history.

#### Duplicate Requests and Privacy

- For a retry of the same Submit action, reuse its request key and return the existing attempt. Scope this identity to the authenticated team-round and verify the submitted payload matches; reject reuse with different source code, bounty, or language.
- A retry must retain that existing attempt's original receipt time, order, and hint snapshot; it must not receive a new position in the bounty race or a new hint multiplier.
- A genuinely new Submit action is a new attempt. Do not merge different attempts merely because their source code is identical.
- A repeated judge result notification or polling response must not finalise an attempt, award, or penalty twice.
- Expose the team's own progress and permitted feedback only to its authorised sessions, using the confirmed Run/Submit result shapes above. Do not expose hidden inputs/expected answers, raw hidden-execution stdout/stderr/messages, internal job tokens, or another team's source code through live events, history, reconnect state, or result endpoints.

#### Confirmed Round 2 Race Timing Example

- Team A submits at 10:01 and receives a correct result at 10:06. Team B submits at 10:02 and receives a correct result at 10:04.
- Under the confirmed earliest-correct-server-receipt rule, A wins. B's earlier judging completion must not award the bounty while A's earlier attempt is unresolved.
- If A's earlier attempt is instead definitively incorrect, B can win once no earlier eligible attempt remains unresolved.
- Simultaneous-receipt ordering and terminal recovery of persistent infrastructure failures remain to be specified. Infrastructure failures are confirmed penalty-free retries of the original attempt, including during finalisation; the receipt-order winning rule itself is unchanged.

### 3.6 Bounty Awards

Status: conceptual design proposal, not a database migration or a final schema. The payout amounts, round-specific award limits, and team-level hint snapshot cutoff follow confirmed competition rules. Record layout and enforcement details remain for discussion.

#### What an Award Represents

- One `BountyAward` records that a particular team earned a particular coding bounty through one credited, accepted submission. Failed attempts and correct attempts that earn no bounty remain submission records, not zero-value bounty awards.
- Keep an award separate from the judging verdict. Passing tests establishes correctness; the backend must also establish eligibility and the appropriate receipt-order priority: within the team/bounty in Round 1, or globally within the bounty in Round 2, before committing the award.
- In Round 2, the winning award can serve as the authoritative claim. Avoid independently editable winner fields that could disagree with the award; the exact physical claim/award storage layout is not chosen yet.

#### Proposed Award Information

| Information | Why It Is Needed |
| --- | --- |
| Award identifier | Identify one committed earning event and link its payout without applying it twice. |
| Team-round and bounty references | Identify the recipient and scored challenge; their rounds must match. |
| Credited submission reference | Explain which accepted attempt earned the award. It must belong to the same team-round and bounty. |
| Original base bounty and wallet credit | Preserve the reward basis and full bounty amount credited to the spendable wallet. |
| Competition points awarded | Preserve the separate leaderboard contribution: full base bounty in Round 1, or the confirmed hint-adjusted amount in Round 2. |
| Applicable hint tier, multiplier, and scoring-rule reference | Explain the Round 2 score calculation using the submission's frozen team hint tier under the confirmed admission-time cutoff, not whatever hint state happens to exist later. |
| Difficulty and timing context | Preserve the applicable difficulty and reference the credited attempt's original server receipt, round start, and applicable pause intervals for cumulative solve time. Credit uses confirmed Round 1 per-team or Round 2 global receipt order; timestamp precision and coordination mechanics remain open. |
| Award recording time | Audit when the backend recorded the award, separately from the credited submission's original receipt. Award commit/completion time is not the leaderboard solve-time timestamp. |

#### One Award Under the Correct Scope

- Round 1: at most one award for the combination of team-round and bounty. Other teams can still earn that bounty independently.
- Round 2: at most one winning award for the bounty across all finalist teams and language variants.
- One credited submission must not generate multiple coding-bounty awards. The references used to establish these identities must be required, not optional.
- Enforce the appropriate uniqueness restrictions in PostgreSQL, in addition to backend checks. Checking for an existing award and later inserting one without concurrency protection is not sufficient.
- The two round scopes need different enforcement. A global unique-bounty restriction on every award would incorrectly stop other teams earning Round 1 rewards; a team-bounty restriction alone would allow multiple teams to win in Round 2. Choose the exact schema/index arrangement when designing the physical tables.
- Uniqueness prevents duplicate awards but does not choose the credited correct submission. Both rounds must follow their confirmed receipt-order scope and coordinate with admission so earlier attempts are not overlooked. In Round 1, an unrelated team's pending attempt must not delay another team's independent award.

#### Wallet Credit and Competition Points

- Round 1: an award credits the full base bounty to the wallet and contributes that full amount before the separate hint-spending deductions used for qualification. Do not deduct purchased hints again when awarding.
- Round 2: an award credits the full base bounty to the wallet and contributes 100%, 90%, 70%, or 50% of the base bounty to the leaderboard according to the applicable zero/one/two/three-hint tier.
- Example: a 1,000-bounty Round 2 win after two hints records a 1,000 wallet credit and 700 competition points. Its earlier 400 hint cost remains a separate purchase, not another deduction during payout.
- Each credited bounty contributes once to the team's solved-difficulty profile and cumulative solve time under the agreed calculation rules. Additional accepted attempts create no additional solve contribution.
- Award records explain earnings; the wallet activity draft in Section 3.7 explains credits and spending. A linked wallet credit and its award describe the same payout, not two amounts to add to the balance.

#### Proposed Atomic Award Flow

```text
Accepted submission is ready for an award decision
          |
Start a short database transaction
          |
Recheck eligibility, receipt-order priority, and existing awards
          |
Create the award and its single linked wallet credit
          |
Update any stored score/balance summaries and save notification events
          |
Commit all changes together
          |
Publish the confirmed result and live updates
```

- A transaction makes the grouped database changes all-or-nothing. It does not replace the uniqueness restrictions or the receipt-order checks.
- Do not hold this transaction open while waiting for Judge0 or for earlier submissions to finish. Keep the award decision pending, and retry finalisation after the necessary results are available.
- Only a newly created award may produce its new payout. A repeated result or a retried finalisation must recognise the existing outcome without crediting the wallet, leaderboard, or solve statistics again.
- Record the notification events in the same transaction as the award, then publish after commit, following Section 2.5. If the backend stops after commit but before publication, event delivery can resume without re-awarding the bounty.
- Test concurrent accepted submissions from teammates, different-language attempts, out-of-order judging results, repeated finalisation, transaction rollback, and restart after commit but before notification. These are implementation test requirements, not tests already run.

#### Confirmed Hint Snapshot Cutoff

- Capture the highest hint tier already unlocked by the team when the server admits the official submission, coordinated with hint purchases using a consistent processing order.
- Calculate any eventual award from that attempt's frozen hint tier. A hint bought while that attempt is being judged applies to attempts admitted after that purchase, not retroactively to already-submitted code.
- Example: a Round 2 attempt admitted with Hint 1 unlocked retains the 90% score multiplier even if the teammate buys Hint 2 while it is being judged. A new attempt admitted after that purchase uses the two-hint 70% multiplier. Each attempt still needs to earn the bounty under the round's award rules.
- This team-level cutoff is confirmed. It does not change the agreed prices, score multipliers, full wallet payout, or no-refund policy for purchased hints.

### 3.7 Wallet Transactions

Status: conceptual design proposal, not database tables or application code. The separation of spending balance and Round 2 competition score is confirmed, as is sufficient-balance purchasing without debt or borrowing against pending wins. Rounding, transition operations, and the physical schema are not finalised.

#### Ownership and Balance

- Each team-round participation has one logical spendable wallet, shared by both teammates. The existing `TeamRound` record can identify this account; a separate wallet table is not required by this conceptual design.
- One `WalletEntry` records one committed change to that wallet. Credits are positive amounts and purchases are negative amounts. Preserve the actual amount charged or credited, not just a percentage that might be recalculated differently later.
- Treat the entry history as authoritative. If a balance summary is stored for faster reads, update it in the same transaction as its entries and verify it against the history.

```text
wallet_balance = sum(committed entry amounts for this team-round)
```

- Round 1 begins at zero unless a separate opening grant is explicitly agreed. Round 2 includes its carried-over bounty as an opening entry, counted once in the sum, not as both an entry and another added opening balance.
- Do not calculate Round 2 leaderboard points by summing wallet entries. Its score comes from the competition-point values on winning bounty awards, not carryover or purchases.

#### Proposed Wallet Entry Information

| Information | Why It Is Needed |
| --- | --- |
| Entry identifier | Identify one recorded balance change. |
| Team-round reference | Identify whose wallet changed and in which round. |
| Entry kind | Distinguish a bounty payout, hint purchase, shop purchase, or opening carryover. |
| Signed amount | Record the exact credit or debit in the eventual agreed currency unit. |
| Source reference | Link the entry to its award, purchase, or round-transition record so its reason can be verified and retries cannot post it twice. Exact foreign-key layout remains to be designed. |
| Server recording time | Audit when the change was recorded; this does not determine claim priority or solve time. |

#### Sources and Duplicate Protection

| Source | Wallet Effect | Required Duplicate Protection |
| --- | --- | --- |
| Committed bounty award | Credit the full base bounty | One payout entry per award, including repeated judge results. |
| Successful hint purchase | Debit that tier's price | One purchase per team-round, bounty, and hint tier, shared across language variants; one debit per purchase. |
| Successful Round 2 shop purchase | Debit its agreed price | One debit per purchase action; whether an item can be bought repeatedly depends on its later item rules. |
| Qualifier's opening Round 2 carryover | Credit the final unspent Round 1 bounty | One opening carryover per destination team-round, linked to its finalised Round 1 source. |

- Shop purchase records do not define any item, price, or effect yet. Additional bonus earning types must wait for their own reward rules rather than silently creating competition points.
- Keep action request keys and source uniqueness checks: two requests with different keys can still be attempts to buy the same hint tier twice. A retry must return its recorded result without charging again or changing the original price.
- The hint definition, ownership, and purchase draft is described in Section 3.8.

#### Proposed Purchase Transaction

- Validate the active round, session, purchase eligibility, price, and existing ownership on the backend. Under the confirmed sufficient-balance rule, reject unaffordable purchases without creating a debit or unlocking anything. Pending judging results do not count as spendable funds.
- Coordinate all changes to the same team-round wallet in a short database transaction, for example by locking its `TeamRound` row before reading the current balance and posting entries. All wallet writers must follow the same protocol, including purchases for different bounties and shop items.
- Checking the balance before that coordination is not sufficient. Example: a team has 500 and both teammates attempt different 300-cost purchases. After one commits, the second must see 200 and be rejected under the confirmed rule, not spend the original 500 again.
- Commit the purchase, debit, hint unlock or item entitlement, any corresponding Round 1 score change, and notification events together. A failure must not leave a charge without its purchased benefit or a benefit without its charge.
- Coordinate with the confirmed bounty-claim and submission hint-snapshot rules. If both bounty and wallet records need locking, use a consistent lock order across operations; the exact SQL and retry handling will be designed during implementation.
- After commit, update both teammates' wallet and purchased content live. A Round 2 debit does not immediately lower competition points. Never broadcast another team's private purchase details.

#### Round 1 Carryover Without Changing History

- Confirmed prerequisite: finish already-admitted judging before locking Round 1 results. Proposed transition mechanics then select eligible finalists and record each qualifier's remaining bounty as the source of its Round 2 opening entry. Persistent judge failures, exact finalisation transactions, and tied-cutoff handling still need decisions.
- Preserve Round 1's final standings and wallet history. Do not debit its historical balance when Round 2 purchases occur; spending belongs to the new round, while the closed round is no longer available for purchases.
- This is an opening allocation from a fixed result, not a live link between balances and not a Round 2 bounty award. Repeating transition processing must not allocate it again or grant leaderboard points.

#### Illustrative Round 2 History

For a team carrying over 2,000 and winning a 1,000-bounty bug after two hints:

| Entry | Amount | Wallet Balance After Entry |
| --- | --- | --- |
| Opening carryover | +2,000 | 2,000 |
| Hint 1 purchase | -100 | 1,900 |
| Hint 2 purchase | -300 | 1,600 |
| Winning bounty payout | +1,000 | 2,600 |

The Round 2 competition score is 0 before the win and 700 afterward, not the 2,600 wallet balance. Do not count the award's recorded payout a second time on top of its linked wallet entry.

#### History, Precision, and Verification

- Proposed history policy: preserve committed entries rather than editing or deleting them to repair a balance. Any correction needs an explicitly authorised, linked adjustment with an audit reason; the correction workflow is not designed yet. This does not introduce refunds when another team claims a bounty.
- Recommend exact integer units, with a fixed smaller unit if needed, rather than binary floating-point amounts. The unit and percentage-rounding rule still require agreement.
- Required implementation tests include duplicate payouts, duplicate hint purchases, concurrent purchases on different bounties, award-versus-purchase races, purchase rollback, repeated carryover processing, restart recovery, and comparison of any stored balance summary with the entry sum. No such tests or database tables are created by this document.

### 3.8 Hint Definitions and Purchases

Status: conceptual design proposal, not database tables or application code. Team-wide access, sufficient funds, submission-time hint snapshots, the Round 2 claim/refund policy, and strict sequential purchasing in both rounds are confirmed. The physical schema and implementation remain drafts.

#### Hint Content Versus Purchased Access

- A `Hint` defines one bounty's content at one level: 1, 2, or 3. It belongs to the bounty, not to a particular purchasing team. Keep its text on the server and preserve the content/version applicable to purchases; the exact versioning scheme is not fixed yet.
- A committed `HintPurchase` records that a particular team-round bought access to that hint. It is both the purchase receipt and the authoritative access entitlement, not another copy of the hint text.
- Both teammates and all language variants of that bounty share this entitlement. The teammate using another language, opening another tab, or reconnecting must not require another purchase. An individual member still cannot change language within the round.
- Do not require an independent editable unlock flag or extra unlock record that can disagree with the committed purchase. Derive access from the purchase history; any cached access summary must remain consistent with it.

```text
Bounty ---- Hint (one definition for each level)
               |
TeamRound ---- HintPurchase ---- one linked WalletEntry debit
```

#### Proposed Hint Purchase Information

| Information | Why It Is Needed |
| --- | --- |
| Purchase identifier | Identify one successful unlock and its single wallet charge. |
| Team-round reference | Identify the team receiving access in this round. |
| Hint reference | Identify the bounty and level purchased; the bounty must belong to the same round as the team participation. |
| Actual price and pricing-rule reference | Preserve exactly what was charged and why; do not recalculate old purchases using later prices. |
| Linked wallet debit | Trace the purchase's single charge; the precise foreign-key direction will be chosen with the schema. |
| Request key | Recognise retries of the same purchase action and reject reuse for a different hint. |
| Purchasing member/session reference | Audit which authorised session initiated the purchase without making ownership member-specific. |
| Server purchase time/order | Explain when access became effective relative to a submission's frozen hint tier and any Round 2 winning claim. |

#### Identity and Duplicate Protection

- Allow at most one successful purchase for the combination of team-round and hint. Define the active hint levels uniquely per bounty so different language variants cannot create duplicate paid access to the same tier.
- Enforce purchase and linked-debit uniqueness in the database, alongside backend validation. Two teammates using different request keys must still produce only one purchase and one charge for the same hint tier.
- After authorising the team, recognise an existing matching request or owned hint before attempting a new charge. Return the existing access without requiring funds again, including when the original response was lost.
- A genuine new purchase must still pass current-round, bounty availability, prerequisite, and sufficient-balance checks. An existing valid purchase is not a new purchase attempt just because a claim happened after it committed.
- An unaffordable or otherwise rejected new request creates no successful purchase, wallet debit, or access entitlement. Failure/request audit logging, if needed, is separate from ownership.

#### Purchase, Access, and Live Updates

- Follow the transaction boundaries from Sections 2.6 and 3.7: create the purchase and single wallet debit, establish access, update any Round 1 net-score summary, and record private notifications together. Do not charge based only on a browser-supplied price or balance.
- A new purchase in Round 2 must be ordered consistently with claims for that bounty. If the claim commits first, reject the new purchase without charging. If the purchase commits first, preserve it without refund merely because another team later wins.
- Coordinate the effective purchase order with official submission admission. A purchase affects the hint snapshot of attempts admitted afterward, not an already-admitted attempt.
- Return locked hints only as authorised metadata such as level and price, never their content. Fetch purchased text through an authenticated, team-authorised response; hiding text in the UI is not access control.
- After commit, notify both teammates and their tabs, and recover owned hints automatically after reconnecting. Other teams must not receive the private hint content or purchase event.
- Preserve access to previously purchased hints after another team claims the bounty, without reopening official submission or award eligibility. A new unlock still remains prohibited after the claim.

#### Confirmed Sequential Purchasing

- Require Hint 1 before Hint 2, and both earlier hints before Hint 3, in both rounds. Show the later tiers as prerequisite-locked until the preceding purchases have committed.
- The initial UI keeps later tiers visible with their prices but disables purchase controls until their prerequisites are owned. Do not send the locked hint text to the browser. If a prerequisite purchase is still pending or fails, the later tier stays locked until successful ownership is confirmed.
- The backend must validate committed prerequisite ownership as part of the coordinated purchase transaction. Direct requests that try to bypass the UI cannot skip tiers, debit the wallet, or unlock content without the required earlier purchases.
- Prices are incremental, not standalone alternatives. With the agreed Round 2 rates, the additional charges are `0.10 * B`, `0.30 * B`, and `0.80 * B`, giving a total of `1.20 * B` for all three.
- Allowing Hint 3 to be bought alone for `0.80 * B` would bypass the intended total cost and restore positive wallet growth on successful full-assistance claims. The confirmed prerequisite rule prevents that skip-tier route.
- Example: for a 1,000-bounty Round 2 bug, the team buys Hint 1 for 100, Hint 2 for an additional 300, and Hint 3 for an additional 800. Reaching Hint 3 costs 1,200 in total and a subsequent eligible winning attempt earns 500 competition points plus the full 1,000 wallet payout.
- This sequence is confirmed. No skip-tier or automatic multi-hint purchase feature is agreed; a higher-tier request must not silently purchase its missing prerequisites.

#### Verification Requirements

- Test same-hint purchases by both teammates, retries with the same and different request keys, changed payloads reusing a key, insufficient funds, and cross-language access by the other teammate without a second charge. Test that an individual member cannot change the round language through the UI or direct requests.
- Test purchase-versus-claim and purchase-versus-submission orderings, a lost purchase response, reconnecting, and transaction rollback. Verify no private hint leaks to locked responses or other teams. Also test skipping levels, failed prerequisite purchases, and a higher-tier request arriving before its prerequisite purchase commits; access must never be granted before the required earlier purchases have committed.
- These are future implementation tests. This document creates no purchase endpoints, database tables, or running features.

### 3.9 Registration Lookup and Member Mapping

Status: registration-based team lookup, selecting a registered member by name, per-member round language locking, and organiser-approved session/device replacement are confirmed. Record layout, cookie/session configuration, expiry, and secure replacement handoff are conceptual drafts, not implemented features or final physical tables. Registered member selection replaces the earlier anonymous automatic-slot proposal.

#### Registered Team Lookup

- Use the organiser's registration data as the source of team identity and public team name. Confirm the export format and available columns before designing the import; no registration export has been supplied or imported yet.
- Associate each private team access code with exactly one registered team. Look up that record on the backend after validating the code; do not derive team identity from a typed public name or accept an arbitrary team ID from a browser.
- Registration supplies the two member names for each team. Import each as a distinct `TeamMember` with a stable internal identifier and team reference; names are display labels, not unique identifiers or authentication secrets. Confirm any additional verification fields and the source-column mapping when the export is available.
- Show the member-name list only after validating the team's private code, and only for that team. Do not expose a searchable public member directory or unrelated registration details.
- Keep private registration exports, actual team access codes, and session secrets out of Git and public responses. Public leaderboard identity remains the team's approved public name.

#### Confirmed Member Selection Flow

- Validate the private team code and display that team's two registered member names.
- The participant selects their own name. The backend validates that the selected stable member identifier belongs to the resolved team; do not trust arbitrary member IDs or name strings supplied by a browser.
- On a member's first entry for a round, record the selected language against that member's round participation. Subsequent entry and approved replacement restore that same language instead of making another choice.
- A valid existing browser session resumes its registered member. A member selecting their name on a different browser does not, by itself, authorise takeover or create another member identity; use the replacement procedure when needed.
- Keep the code and member-selection steps on the entry page. No separate email/password account or anonymous first-browser/second-browser assignment is required.

#### Proposed Session Mechanics

- Issue each authorised browser its own random opaque session token in a secure, HttpOnly cookie, with an appropriate SameSite policy. Keep its member association, authorisation, expiry, and revocation state on the backend. Store the round language durably in `MemberRound`, independently of a temporary session. Exact expiry and cookie configuration still need design.
- Allow at most one active authorised browser session per registered member and two per team. Coordinate simultaneous entries so selecting the same member cannot create two active sessions. Session renewal replaces a credential, not the registered member or their round record.
- Multiple tabs share the browser session; a dropped live connection does not erase the member association, free a third place, or reset the language lock.
- Recognise a valid returning credential before creating any replacement. After credentials are lost or a device changes, selecting an already-enrolled member follows organiser-approved recovery rather than silently replacing the earlier session. Detailed expiry/re-authentication behaviour remains to be specified.

```text
Private team code -> Registered Team -> Shared team-round progress/wallet

Browser session -> Selected TeamMember -> MemberRound -> Locked round language
```

#### Proposed Record Responsibilities

| Record | Responsibility |
| --- | --- |
| `Team` | Registered team identity and the association with its private entry credential. |
| `TeamMember` | One of the team's two named registered participants, identified by an internal member ID rather than name text. |
| `MemberRound` | That registered member's participation and locked language in a particular team-round. |
| `BrowserSession` | Revocable server-side authorisation connecting a browser credential to the selected registered member. |

- Final keys, token-verifier storage, expiry rules, and relationship constraints remain part of the physical-model/security review. These names do not create additional tables yet.
- The shared team code identifies the team, the member selection identifies the requested registered participant, and the session credential authorises that browser to act as the member. Do not use a shared IP address, browser fingerprint, language selection, or member name as a substitute for the credential.
- Name selection does not independently verify which human is at the keyboard or prevent participants deliberately sharing credentials. Do not claim that displaying names or a two-session cap alone proves personal identity.

#### Confirmed Replacement Policy and Handoff Draft

- A participant enters the private team code and selects their registered name to identify the member whose access needs recovery. Selecting a name is not automatic approval to replace another browser.
- Require organiser approval for replacement of an enrolled member after device/browser change or credential loss. After verification, revoke the old session and authorise the new browser for the same `TeamMember` and existing `MemberRound`.
- Preserve the current-round language, drafts where saved, purchases, and team progress. Do not create a third member or reset the language choice as a side effect of replacement.
- Revoke the old credential on the backend and require subsequent HTTP requests and live connections to honour that revocation; merely changing a cookie on the new browser is insufficient.
- Bind approval to a specific pending replacement request and new browser, not a generally freed member position that any holder of the team code could claim. The detailed handoff proposal is in Section 3.10; it is not implemented or fully approved yet.
- Required implementation tests include simultaneous entry under the same name, selecting a member from another team, restoring a locked language, replacement with an old live connection, and a different browser trying to redeem someone else's approval. No import, session endpoint, or recovery feature is implemented by this document.

### 3.10 Session Lifecycle and Replacement Approval

Status: conceptual proposal for this architecture chunk. The requirement for organiser-approved replacement is confirmed. The handoff sequence, request expiry, session lifecycle details, and staff-console boundaries below require review; no endpoints, credentials, or database tables are created here.

#### Session State Versus Connection State

- A valid session is server-side authorisation associated with a registered member, not a particular Socket.IO connection. A temporary Wi-Fi loss, tab close, or failed notification does not by itself log the member out, revoke their credential, or release their identity for takeover.
- Track server-enforced expiry and revocation independently of connection status. A present cookie is not sufficient if the corresponding session is expired, revoked, or no longer authorised for that round.
- Check session status and round eligibility on protected HTTP requests and live commands. Revoked connections must lose private room access; a delayed disconnect notification cannot authorise further actions.
- Use fresh opaque credentials on authentication or privilege changes, protected cookies, and server-side token verification. The credential and CSRF library choices remain for the security/physical-model review.

#### Proposed Round and Expiry Boundaries

- Scope competition permissions to the appropriate round and its eligible `MemberRound`. Ending a round stops new participant submissions and purchases even if a browser still has an unexpired session cookie.
- Keep registered identity, language records, drafts where saved, and committed competition history when a session expires. Never clear a language lock merely to resolve a timeout.
- Normal entry into a new eligible round permits that round's new language choice without requiring device-replacement approval solely because the previous round ended. Retire or replace the earlier session grant consistently so this does not create multiple active sessions for the member.
- Define absolute expiry, inactivity/re-authentication behaviour, and any read-only results grace period alongside the round schedule. Use server-recorded, validated activity rather than client-reported timestamps; an open live connection does not prove a person is present. These timeout values are not agreed yet and must be resolved before implementation.

#### Proposed Replacement Request

- After validating the team code and selected registered member, let the new browser request replacement of that member's current-round session. Creating a request does not revoke the existing session or grant arena access.
- Create a server-generated request identity and a separate short-lived browser proof. Retain a verifier on the backend and keep the proof in a protected cookie; a displayed request reference is not itself a takeover credential.
- Associate the request with the target member-round, requesting-browser proof, expected session being replaced, creation/expiry times, state, and any approving staff identity and audit reason.
- Propose a 10-minute lifetime from request creation, covering both pending approval and redemption. Polling does not extend it. Reject expired, rejected, or stale requests; a pending request may read only its own limited approval status, not team secrets or arena content.

```text
New browser requests replacement
              |
Organiser verifies the participant and this specific request
              |
Organiser approves: record approval and revoke the old session
              |
Requesting browser redeems its approved, browser-bound handoff
              |
Issue a fresh session for the same member and locked round language
```

#### Approval and Activation Boundaries

- In a short database transaction, verify the staff permission, request validity, target member-round, and expected old-session association; record approval, revoke the old credential, and save notification/audit events together. A duplicate approval must not revoke a later replacement session.
- The new browser proves possession of its request credential before redemption. A different browser cannot redeem approval using only the team code, member name, or displayed request reference.
- Activate the replacement in a coordinated transaction: recheck approval, expiry, and current member/session state, create the single new authorised session, mark the request consumed, and record its events. Retrying must not create a second active session or repeat any competition effects.
- Rotate from the limited request credential to a fresh authenticated session credential. Do not turn an arbitrary client-supplied request ID into a full session.
- Preserve existing `MemberRound` language and all shared team progress. Attempts admitted before revocation remain recorded; replacement must not delete or resubmit them. Coordinate revocation and new action admission so an old browser cannot submit after its authorisation is revoked.
- Invalidate conflicting stale replacement requests when the member's session changes. Rejected or unapproved expired requests leave the current session untouched. Expiry after approval must not automatically restore the revoked old credential.
- Define same-browser recovery if the activation response is lost: recognise the authorised handoff without creating another active session or allowing another browser to replay it. The exact replay/response mechanism remains a session-library design requirement.

#### Proposed Organiser Console Boundaries

- Provide a separately authenticated staff area with a replacement-request queue showing only the information staff need to identify the team, member, request, and its age/status. Participant team codes and name selection never grant staff permissions.
- Staff can approve or reject the specific request after verification. Record the staff actor, target, time, reason, and outcome; do not log raw team codes, browser proofs, or session tokens.
- Enforce permission checks on the backend, not just by hiding staff pages. Protect approval and redemption commands against cross-site request forgery; use established framework/library support rather than custom authentication or cryptography. Administrator-code entry through the common entry screen is confirmed in Section 5; credential provisioning and the detailed permission/session design still need review.
- Rate-limit team-code validation and replacement creation, and prevent request spam from automatically disabling a valid session. Exact limits are part of the security review.
- Required tests include unauthorised approval, simultaneous requests/approvals, approval after a target session changes, expiry before/after approval, foreign-browser redemption, lost activation responses, old live connections, and preserving the locked language. These are future tests, not features already implemented.

### 3.11 References

- [PostgreSQL primary keys, foreign keys, and unique constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL transactions and all-or-nothing updates](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgreSQL row-level locking and consistent lock order](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Judge0 submissions, execution results, and batches](https://ce.judge0.com/)
- [OWASP session management: opaque identifiers, server-side state, and cookie protection](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP cross-site request forgery prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP authorisation: least privilege and backend permission checks on every request](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## 4. Architecture Completion Roadmap

Status: planning checklist, not a declaration that the architecture is complete. Existing sections contain a mixture of confirmed rules and conceptual drafts; approval of a rule does not automatically approve every proposed field or implementation detail.

### 4.1 Working Agreement

- Finish the core architecture in understandable chunks, explaining each component's purpose and trade-offs before implementation.
- Do not start application scaffolding, migrations, endpoints, arena implementation, competition bug authoring, or cloud deployment while this architecture review is in progress.
- Keep confirmed decisions, proposals, and deliberately deferred features clearly distinguished. Preserve existing decisions unless the user explicitly changes them.
- The user performs all Git mutations, including staging, commits, branch changes, pushes, pulls, and pull requests. Assistant Git use remains read-only; provide guidance when requested.

### 4.2 Remaining Design Chunks

| Order | Area | Remaining Architecture Work |
| --- | --- | --- |
| 1 | Member identity and access | The confirmed entry/replacement rules are in Section 3.9; review the detailed handoff in Section 3.10 and admin-code/console design in Section 5. Finalise absolute/inactivity expiry with the round schedule, activation-response recovery, staff credential provisioning, and permissions; record layouts remain conceptual. |
| 2 | Arena and round lifecycle | Review Section 6's parent-instance/child-round lifecycle, same-instance Round 2 prerequisites, singleton reservation through intermission, and non-destructive discard. Global technical breaks now have confirmed active-clock/deadline effects; finalise their recovery/control details, receipt ordering, pending judging at close, qualification cutoffs, result locking, and one-time within-instance carryover. |
| 3 | Challenge and judging contracts | Full-program/Run/checker/feedback/readiness rules, one pending official attempt per team/bounty, two Runs per member, and fair-team 3:1 official/sample dispatch are confirmed. Browser challenges are excluded; function-only support is deferred. Define records, entry points/output processing, atomic admission/release, job granularity, rate/worker/queue bounds, and recovery. Do not author competition bugs yet. |
| 4 | Complete data and scoring model | Consolidate relationships/constraints and penalty records implementing confirmed verdict categories, receipt-based solve times, and Round 1 per-team/Round 2 global credit order. Finalise raw mapping, timestamp precision/coordination, amount rounding, Round 1 hint prices, reward mapping, and bonus eligibility. Decide the database access approach and physical model before migrations. |
| 5 | API and browser boundaries | Define entry, arena, editor, purchase, submission, leaderboard, and staff workflows; command/event boundaries; draft ownership/recovery; team-private work-presence triggers/expiry; authoritative snapshots; and client-side animation/performance responsibilities. |
| 6 | Deployment, security, and operation | Define the app/database and isolated judge topology, private connections, HTTPS, credentials, untrusted-code limits, request limits, logs, monitoring, backups/restoration, and recovery from service failures. Do not provision resources as part of this design chunk. |
| 7 | Verification and final review | Produce the consolidated system/data diagrams and critical-flow descriptions, specify concurrency and recovery tests, plan realistic load/performance checks, identify remaining risks, and obtain approval of the implementation-ready core design. |

- This order is a working sequence, not a requirement to finish every detail of an area before recording a dependency in another.
- Member identity and access are being discussed in Sections 3.9, 3.10, and 5. Review the proposed browser-bound replacement handoff and its 10-minute request lifetime, then resolve session timeout values alongside round timing. Admin-code entry is confirmed; staff credential/session protection and activation-response recovery remain explicit implementation-blocking details, not completed features.
- Special item types and effects remain deliberately deferred as agreed. Design their future boundaries without inventing or activating a catalogue. Other non-core features may be deferred only explicitly, not silently treated as implemented.
- Function-only submissions are a deliberate future extension. Keep an explicit challenge-format boundary in this architecture, but do not build wrappers, function signatures, browser grading, or a mode selector as part of the initial full-program implementation.

### 4.3 Completion Criteria

- Agreed rules are reflected consistently in the component responsibilities, data relationships, and API/live-update contracts.
- The design explains team entry/recovery, language locking, submitting/judging, receipt-order claims, single award/payout, hint purchasing, leaderboard updates, and round transitions, including concurrent actions and failures.
- Core identity, integrity, security, timing, and recovery decisions are resolved before their corresponding implementation begins. Each remaining open item is labelled with its impact; do not call a blocking omission a deferred detail.
- The initial deployment and verification plans are documented. Capacity remains an assumption to validate through load testing, not a guarantee derived from the 50-team cap.
- The user reviews and approves the core architecture before application implementation starts. Architecture approval does not authorise the assistant to perform Git mutations or spend cloud credits.

## 5. Admin Panel and Event Controls

Status: an admin panel, administrator-code entry, blocking, bug management, and manual penalties are requested requirements. Global, team, and member pause/resume controls, team-time compensation, and global technical-break clock/deadline effects are confirmed in Section 5.4. Admin-configured arena launch is confirmed in Section 6. Remaining detailed controls, security design, and pause/penalty semantics are proposals for review. No panel, staff credentials, or administrative endpoints are implemented here.

### 5.1 Common Entry, Separate Permissions

```text
                     Enter access code
                            |
                   Backend verifies code
                     /              \
              Team access        Staff access
                   |                  |
           Choose member name    Staff session
                   |                  |
           Round language lock    Admin panel
                   |
                 Arena
```

- A valid admin code skips participant member and language selection. It authenticates a staff identity, not a hidden participant team with elevated browser settings.
- Treat an admin code as a privileged secret: knowing it grants its owner's access. Recommend a separate, long, randomly generated code per organiser so actions have an attributable staff actor and one leaked code can be revoked independently.
- Keep credential verifiers on the backend, not raw access codes in frontend bundles, public files, URLs, Git, or logs. Code creation/storage must use an established security library; no custom cryptography. Credential lookup must not ambiguously match both team and staff access.
- After verification, issue a protected, revocable staff session. Do not send the access code with every command or allow a participant session to promote itself. Apply server-side expiry, rotation, rate limits, and CSRF protection as appropriate to the selected session mechanism.
- Check the staff session and permission on every protected HTTP action and live connection/command. Opening `/admin`, changing a client-side role, or guessing a record identifier must grant nothing.
- Proposed permission split: the event owner can issue/revoke staff access and control high-impact round/results actions; delegated organisers receive only the capabilities they need. Exact roles and permissions remain to be agreed.

### 5.2 Control Groups

| Area | Proposed Controls and Boundaries |
| --- | --- |
| Instance dashboard | Current and historical arena instances, per-instance controls, Round 1 and Round 2 leaderboard tabs, round status/time, participating teams, admitted/judging submissions, judge failures, and recent staff actions. A live connection count is not proof that a participant is present. |
| Teams and members | Import/review registration data, search teams, inspect member sessions, rotate/revoke team codes, approve the specific replacement requests described in Section 3.10, and block/unblock access. |
| Bugs and hints | Create drafts with language variants, buggy starters, private reference solutions, tests, difficulty, bounty, and three hints; run mandatory readiness validation and review before publishing/selection; withdraw faulty content without deleting history. |
| Instance and round controls | Create an instance and start Round 1; after finalised Round 1 results, configure/start Round 2 in that same instance or discard it to begin again in a fresh instance. Select the round roster, bugs, and duration; pause/resume by scope; end/finalise rounds. Completed/discarded instance dashboards retain results without live controls. Section 6 contains the lifecycle draft. |
| Discipline | Record a warning, access block, or authorised manual penalty with a reason. Disqualification and penalty effects need explicit rules rather than an unrestricted edit to a team's totals. |
| Communication | Send event-wide, round-wide, or private team announcements; show pause/resume and bug-withdrawal notices without requiring refresh. |
| Judging support | Inspect queue/error status and retry eligible infrastructure failures without manufacturing a new official attempt, receipt order, or wrong-submission penalty. Rejudging completed attempts requires a separate correction policy. |
| Records and recovery | Review audit history, export results, and monitor backups/recovery status. A destructive live reset or restore must not be an ordinary one-click operation. |

The additional control groups are recommendations, not approval of every feature or a special-item catalogue. The panel uses the same backend and competition database; it must not bypass competition rules through direct browser access to PostgreSQL or Judge0.

### 5.3 Blocking Is Not Clock Control

- Propose separate member and whole-team access blocks. A member block stops that member's authorised competition actions and private live access; the teammate may continue unless the whole team is blocked. Define whether blocked members retain a limited read-only status screen.
- Enforce a block on the server and revoke the affected session grants/live access. Unblocking should require normal authorised re-entry, not reactivate a previously revoked credential.
- Blocking access does not, by itself, pause elapsed solve time, remove previous awards, change language locks, disqualify the team, or delete already-admitted submissions. Each of those is a different operation with its own policy.
- Record scope, reason, staff actor, and start/end times. Any automatic block expiry must be server enforced and separately defined.

### 5.4 Pauses and Competition Time

- Confirmed: provide three independent admin controls, not a single ambiguous individual-freeze option: global pause/resume, selected-team pause/resume, and selected-member pause/resume. Global pauses are technical breaks that stop the shared active-play clock and extend the common closing time by the paused duration. Team-paused duration reduces cumulative solve time without giving that team a later Round 2 deadline. Participant-action restrictions and member-only clock behaviour below remain proposed.

| Scope | Proposed Action Restriction | Clock Behaviour and Decision Status |
| --- | --- | --- |
| Global | Pause official actions for every participant in the active round. | Confirmed: freeze the shared countdown and extend everyone's common closing time by the technical break's duration. |
| Team | Pause official actions for both registered members of the selected team; other teams continue. | Confirmed: exclude team-paused duration from cumulative solve time; do not extend that team's Round 2 closing time. |
| Member | Pause official actions only for the selected member; their teammate can continue. | Keep the shared team clock running; do not create a separate member scoring clock. |

- For an affected member, reject new official submissions, hint/shop purchases, and bonus claims on the backend. Preserve the session, selected language, existing code, and recorded progress; show a live paused status. Proposed UI behaviour is read-only while paused. A pause is not a disciplinary block and resuming it must not require device replacement or language reselection.
- Scoring, the wallet, and hint ownership remain team-wide. An unpaused teammate's permitted actions still update their shared state; a member pause does not create a separate wallet or prevent that teammate from legitimately buying a hint.
- A member remains effectively paused while any applicable global, team, or member pause is active. Resuming one scope clears only that scope, not another active pause, an access block, an expired session, or a closed round. Pausing both members independently must not silently create an unapproved team-clock discount.
- Record durable, round-scoped pause intervals with scope, target, staff actor, reason, start/end times, and state version. Duplicate pause/resume requests must not open duplicate intervals or repeatedly shift time. Resuming or restarting the backend must not reset the clock, and a stale browser must not bypass a committed pause.
- Implement global and team elapsed-time exclusions using the union of applicable intervals, never double-counting overlap. Only global intervals extend the common closing time; an overlapping team interval creates no additional deadline extension. Member-only intervals do not reduce shared team time under the proposed model. Clip exclusions to the credited attempt's confirmed original server receipt; never alter that absolute timestamp or an earlier solve because of a later pause.
- Confirmed: other teams can continue claiming bounties during a team pause, and the Round 2 closing time remains common to everyone. A local pause cannot reserve bugs, undo another team's claim, or move a later receipt ahead of an earlier correct submission. Solve-time compensation uses the credited attempt's original server receipt in both rounds, without modifying absolute claim order.
- Prefer a global pause for event-wide server/network incidents, a team pause for a problem affecting both teammates, and a member pause for a problem affecting one participant. Define staff permission, eligible reasons, maximum duration, and any recovery compensation before implementation. Pausing the application cannot prevent offline thinking or coding, so clock compensation also needs organiser supervision and clear event rules.
- Technical breaks are organiser-controlled incident handling, not an automatic response to a participant's compile/runtime error. Whether monitoring can request or trigger a global pause, and how to recover an outage before a pause was recorded, still need explicit policy. A restart must preserve an already-recorded break, not silently resume it or add the same time twice.
- Already-admitted judging needs a specific pause policy. Proposal for a global pause: execution may finish, but claim/award finalisation waits for resume while preserving original receipt order. A team-specific pause must not indefinitely hold the shared claim queue; the handling of that team's earlier admitted attempts remains to be agreed. Do not silently cancel them or treat later judging completion as later receipt.
- Distinguish pausing the competition from freezing only the displayed leaderboard. Display-only standings freezes are optional and do not stop judging, claims, wallet updates, or official time; no such feature is approved yet.

### 5.5 Penalties and Live Content Corrections

- Keep automatic Round 2 wrong-submission penalties separate from manual disciplinary actions. Round 1 still has no automatic wrong-submission penalty.
- Proposed manual penalty choices are a team time addition and/or a score deduction. Their permitted rounds, ranking formula, limits, and reversal rules must be agreed before implementation. A score deduction is not a wallet debit, and a wallet debit is not automatically a Round 2 score change.
- Never implement penalties as an unexplained overwrite of points, solve times, or spendable balance. Use an attributed adjustment record and a linked reversal/correction when appropriate; preserve the original history. Any approved wallet correction must preserve the no-negative-balance rule and define recovery when an earlier reward has already been spent.
- Once a bug is published, preserve the content/test/rule version used by each admitted submission. Do not silently replace tests, bounty, difficulty, hints, or language variants during a live race or rewrite previously awarded points.
- Draft edits are straightforward; withdrawing or correcting a published bug needs participant notification and an explicit policy for admitted submissions, paid hints, prior awards, and any rejudge. Hard-deleting a solved bug or arbitrarily assigning a Round 2 winner is not a standard admin action.

### 5.6 Auditing, Live Updates, and Verification

- For privileged changes, record staff identity, action, affected round/team/member/bug, server time, reason, request identity, outcome, and relevant before/after values or references. Exclude raw access codes, session credentials, and unnecessary registration information.
- Require explicit scope and confirmation for high-impact operations such as global pause/close, disqualification, code revocation, and result changes. A repeated click/retry must not apply the same penalty or transition twice.
- Coordinate each administrative change with the same submission, wallet, and claim integrity rules used elsewhere. Commit its audit and durable notification records with the state change; publish after commit. Restrict staff feeds and private disciplinary details to authorised recipients.
- Reconnecting participants must obtain current block, pause, bug-availability, and round state, not rely solely on having received the original notification. Admin permissions and revocation must also be rechecked after reconnect.
- Future tests must cover participant-to-admin access attempts, revoked staff codes/sessions, unauthorised staff actions, duplicate penalties, concurrent pause/submit and block/submit commands, all three pause scopes, duplicate pause/resume commands, overlapping pauses and partial resumes, paused-server restarts, an unpaused teammate's shared-state updates, and corrections that would conflict with earlier claims or wallet spending. These are verification requirements, not tests already run.

## 6. Arena Instances and Round Lifecycle

Status: the confirmed flow is one current arena instance containing Round 1 followed by optional Round 2. New instances start with Round 1 only; Round 1 completion keeps the instance current; finalised same-instance results unlock Round 2; the admin may instead discard the instance and start fresh. Every instance has its own controls and both round leaderboards. This replaces the earlier standalone Round 1/2 start selector. State names, storage, non-destructive discard, and transaction details below remain proposals; nothing is implemented here.

### 6.1 Instance and Round Flow

```text
Create arena instance A
          |
Select Round 1 teams, bugs, and duration
          |
Start Round 1 (the only initial start option)
          |
Round 1 ends -> finish judging and finalise results
          |
Instance A remains current, between rounds
          |
          +--> Configure and start Round 2 in A
          |               |
          |       Finalise Round 2 -> complete A
          |
          +--> Discard A -> create instance B -> start Round 1
```

- An `ArenaInstance` is the parent competition run; its `Round` records own stage-specific rules, duration, roster, bug selections, clocks, leaderboards, and history. Neither is a new server process per team.
- Initial setup has no Round 2 start selector. Stage progression determines the available start action. After finalised Round 1 results, reveal Configure/Start Round 2 and Discard Instance on that same instance's dashboard.
- For either stage, review selected teams/member count, ready matching-round bugs, language coverage, difficulty/reward distribution, and a positive duration before launch. Scheduled future starts remain unapproved.
- A failed setup/start does not expose bugs, start clocks, change balances, or partially admit teams. Successful transitions update the admin and eligible participant views live without refresh.

### 6.2 Participant Selection and Round 2 Prerequisites

- Proposed selector: registered teams from the database, with both member names shown. Selecting a team does not regroup individuals or bypass member identity, language locking, or session limits.
- Round 1 supports at most 100 selected teams. Round 2 supports at most 50 eligible qualifiers from this instance's finalised Round 1 ranking, using the already-agreed tie-breakers and eligibility rules.
- Round 2 may start only inside the current instance, after its own Round 1 is closed with finalised results, qualification is locked, and selected qualifiers' one-time wallet carryover is ready. It must not already have started or completed.
- Reject absent/provisional results or results belonging to another instance, including an earlier discarded run with identical team names. A final result with zero-scoring teams is not the same as missing results. Bind qualification and carryover to one fixed same-instance Round 1 result version.
- Default the Round 2 picker to that instance's qualifiers. Manual selection cannot admit an unqualified team, provide an opening grant, or skip Round 1. Exceptions and tied-cutoff handling still require explicit policy.
- Selected `TeamRound` records determine live access. A valid team code without eligibility for the current instance/round is insufficient for state reads, submissions, purchases, or private live rooms.
- Propose locking each round's roster when that round starts. Eligible members may join/reconnect later without restarting time; new late admissions need a reviewed policy. A new instance gets new round participation and language records, even when registrations are reused.

### 6.3 Bug Pool and Per-Round Configuration

- The reusable organiser pool remains separate from arena-instance history. The confirmed conceptual split uses `BugDefinition` for identity/category; `BugVersion` for versioned public content, hints, difficulty, rewards, submission format, and checker; version-owned `LanguageVariant` and shared `TestCase` records; and `BugValidationRun` for readiness evidence. Individual fields and publication mechanics remain under discussion in Section 3.4. The initial authoring/start flow supports full-program console challenges only.
- Filter the picker by the stage being configured, and reject wrong-round, unpublished, duplicate, incomplete, or unvalidated selections on the backend. Require Section 3.4's successful reference/starter validation for the exact selected configuration and all required languages; equivalent difficulty still needs author review/playtesting.
- Each selected `BugVersion` is pinned by a `Bounty` belonging to that instance's chosen `Round`. Its variants/tests resolve through that version. Do not select multiple versions of one definition in the same round; one challenge family has language variants, not independently payable bounties per language. Exact uniqueness constraints still need physical-model design.
- Only selected content is loaded when that round starts. Round 1 keeps independent team progress; Round 2 has globally single-winner claims scoped to this instance's Round 2, not every historical use of a pool bug.
- Draft configuration can change before its round starts. Track revisions to reject stale admin forms. Freeze the roster, duration, content/tests, rewards, difficulty, hints/pricing, submission format, output-checker mode/version, and execution configuration at launch; pool edits must not change active or historical judging.
- Round 2 configuration can be chosen after Round 1 finalisation without changing Round 1. Each round has its own duration/start time, not a single countdown covering the intermission and both stages.
- Participants receive only authorised, selected content and their language variant, never hidden tests/answers, unrevealed hints, organiser solutions, unused pool content, or judge credentials. Proposed pre-start/intermission views are waiting/results screens, not permission to submit early.

### 6.4 Parent Instance and Child Round States

- Proposed parent states are `SETUP`, `IN_PROGRESS`, `COMPLETED`, and `DISCARDED`. The current instance stays `IN_PROGRESS` throughout both stages and the between-round interval; child state and available actions identify its current phase.
- Proposed child lifecycle is `DRAFT -> READY -> RUNNING <-> PAUSED -> CLOSING -> CLOSED`, with running or paused rounds also able to enter `CLOSING` through an authorised end action. Team/member pauses do not globally pause the child round.
- Proposed single-current-instance reservation starts at setup and stays held until the parent is completed or discarded. Saving configuration grants no participant action permissions. Final reservation/storage details need physical-model review.
- Confirmed: closing Round 1 stops new submissions/purchases, finishes already-admitted judging, and only then locks results. It does not complete the parent or release the instance reservation. The interval before Round 2, including an overnight gap, is not Round 2 solve time.
- Starting Round 2 changes the child stage within the same parent. Closing/finalising Round 2 can mark the parent `COMPLETED` and release the reservation in one coordinated transition; completion mechanics remain proposed.
- Never reopen/reset a closed child round to restart the competition. To repeat Round 1, discard the existing instance through the supported flow and create a new parent with fresh round identities. Pending-judging failure/timeout rules still need agreement so finalisation cannot wait forever.

### 6.5 Singleton and Transition Safety

- Confirmed: no overlapping arena instances or rounds. In particular, Round 1 ending, a global pause, intermission, or pending finalisation cannot allow another instance to start. Round 2 is a continuation of the reserved instance, not an attempt to acquire a second arena slot.
- Use one PostgreSQL-backed current-instance guard across creation, stage starts, completion, and discard, rather than independent per-round/admin flags. Recheck the parent identity and legal child transition in the same short coordinated transaction. Exact SQL/constraints remain to be designed.
- Create/start Round 1 only for the current new instance and only once. Start Round 2 only for that current parent with its own finalised Round 1 results, no running/paused/closing sibling, and valid roster, bug/configuration versions, qualification, and one-time carryover readiness.
- Never use a generic no-running-round check as permission to create another instance between stages, or as permission to start Round 2 without its parent prerequisites.
- Check staff permissions, configuration revision, parent/child status, eligibility, and timing on the server, not just in button visibility. Commit state, audit, and durable notification records together; publish after commit. A rejected or duplicate request must not create rounds, reset clocks, or credit carryover again.
- Concurrent Start Round 2 and Discard Instance actions must be ordered against the same parent. If discard wins, start is rejected; if the start wins, a stale intermission discard is rejected rather than destroying a running round. Concurrent fresh-instance creation must also preserve the single-current-instance rule.
- Restore the current parent and child timing from the database after a restart. Protected commands and callbacks must check their bound instance/round; historical data remains historical, and an old callback cannot award a new instance's team or mutate its active state.
- The database building blocks remain [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) and [coordinated row locking](https://www.postgresql.org/docs/current/explicit-locking.html); they require a consistent transition/admission protocol, not just an isolated uniqueness check.

### 6.6 Discard and Fresh Instances

- Confirmed flow: after finalised Round 1 results, the admin may discard this instance instead of starting Round 2, then create a fresh instance whose only initial start option is Round 1.
- Recommended meaning of discard: terminal, inactive archival, not hard deletion. Keep the instance identity, Round 1 results, existing wallet/submission/audit history, and a not-started Round 2 view for inspection. Retention/deletion policy still needs explicit agreement.
- Require staff permission, confirmation of the instance/reference and effect, and an audit reason. Mark the parent discarded and release its reservation consistently. Do not permit a stale dashboard to discard a different current instance.
- Proposed cleanup revokes that instance's live action grants, prevents new submissions/purchases, and sends participants an inactive-instance notice. Preserve code where saved and historical records; a past session or replacement request must not grant action access in the next instance.
- A fresh instance can reuse registered teams and the bug pool, but starts its own Round 1 score/wallet at zero with no inherited hints, penalties, solves, or language selections. Its later Round 2 may draw carryover only from its own Round 1.
- Discarding an in-progress or still-finalising round is outside the confirmed intermission flow. Define a separate safe abort/admitted-work policy before enabling it; do not release the reservation while unresolved work can still post live awards. A discarded instance is never resumed.

### 6.7 Per-Instance Admin Dashboard

- Show the current instance and a historical instance list. Each instance opens its own dashboard with identity/status, current phase, selected teams/bugs, round clocks, judging status, purchases/penalties, announcements, and audit history, subject to staff permission.
- Provide separate Round 1 and Round 2 leaderboard tabs for every instance. Before a stage starts, show Not Started rather than borrowing results from another instance or treating missing results as final standings.
- The available controls follow that instance's state: initial setup/start Round 1; live-round pause/resume/member/team/penalty controls; round ending/finalisation; intermission Configure/Start Round 2 or Discard; then read-only historical controls after completion/discard. A historical dashboard must not expose a working Start/Resume action.
- Keep Round 1 standings visible when Round 2 starts. The Round 2 leaderboard begins at zero while eligible teams receive the agreed within-instance wallet carryover; switching tabs must never recompute or overwrite historical results using another round's rules.
- Scope every command and live feed to the displayed instance and round, with a stale-state check for destructive transitions. Showing the controls for an instance does not itself authorise an operation or permit changes in a different instance.

### 6.8 Round Time, Pauses, and Closing

- Use one server start time and the selected duration for each child round, not a new timer per member entry. Enforce deadlines on every official action and retain timing through restarts. Intermission consumes neither round's solve time.
- Confirmed duration meaning: active playing time. A global technical break freezes the shared countdown and extends that round's common wall-clock closing time by its actual duration, giving everyone the full configured playing time. Use server-recorded intervals, not a participant's browser clock.
- Example: a 90-minute round with one 10-minute global technical break lasts 100 minutes of wall-clock time. Multiple breaks extend the shared close by their total distinct duration; duplicate pause/resume requests or overlapping records must not add it twice. While the round remains globally paused, its frozen countdown must not expire merely because the original closing instant passes.
- Confirmed: exclude applicable team-paused duration up to the credited attempt's original server receipt, without giving that team a later Round 2 closing instant than everyone else. Other teams can claim bugs. Global/team overlap is excluded once from active solve time. Both rounds use original receipt rather than judging/retry completion; preserve absolute receipt order separately for winning claims.
- Example without a global pause: a team paused from minute 10 to 13 has a 12-minute elapsed contribution for a scoring solve at minute 15. Its earlier minute-5 solve remains 5 minutes, and a 60-minute round still closes at shared minute 60.
- Proposed HUD shows shared round time remaining separately from cumulative effective solve time and penalties. Member-only pauses do not stop the shared team clock under the proposed model. Pauses and blocks from one child round must not silently become pauses in the next child or a new instance; cross-round disciplinary scope needs explicit policy.

#### Confirmed End-of-Round Flow

```text
Time expires -> stop new submissions and purchases
             -> finish judging already-admitted submissions
             -> settle eligible awards and penalties
             -> lock final results
```

- This closing flow is confirmed for both rounds. Do not discard queued or running official attempts merely because their judging completes after the deadline. The exact server admission boundary, including requests racing the deadline, still needs a precise contract.
- Keep the child round in its closing/finalising phase and the parent instance reserved. No new official submissions, hint/shop purchases, or bonus claims are permitted during settlement; this is not extra playing time.
- Retain each admitted attempt's frozen source, original receipt/order, and hint tier. Judging after closing must not change race priority, invent a later admission time, or apply later hint purchases. If credited, its cumulative solve-time contribution uses the confirmed original receipt and only applicable pauses before that receipt, not its post-deadline completion time.
- Round 2 awards still follow earliest-correct-server-receipt order. A later correct result cannot win merely because an earlier attempt is still queued or unresolved at the deadline.
- Before locking results, finish all scoring-impacting admitted judging and dependent claim/award/penalty decisions, posting their effects exactly once. Do not publish final standings or final carryover while an unresolved eligible attempt can still change them.
- Proposed participant display: show Round Ended - Results Finalising and continuing status updates, with standings explicitly provisional until the lock. The admin sees remaining work/errors; participants must not refresh to receive the final result.
- Finalised Round 1 results unlock the same-instance Configure/Start Round 2 option. Round 2 finalisation completes that instance under the proposed parent lifecycle. Late duplicate callbacks must not re-award points or silently revise locked results; exceptional corrections require the separate audited correction policy.
- Confirmed: judge/server infrastructure failures have no wrong-submission penalty and retry the same admitted attempt with its original code, configuration, receipt order, and hint tier. Persistent failures need organiser review while affected results stay provisional. Retry limits, escalation timing, and authorised terminal resolution still need agreement; an unresolved eligible attempt cannot be bypassed to declare results final or select a later Round 2 winner.

### 6.9 Verification Requirements

- Planned lifecycle tests include concurrent create/start actions, duplicate/lost-response retries, stale forms, restart recovery during each child/intermission, and retaining the singleton reservation after Round 1 closes, during pauses, and during finalisation.
- Reject initial Round 2 starts, starts with missing/provisional/other-instance/discarded-instance results, duplicate child stages, overlapping rounds, and historical-instance Start/Resume requests. Valid final zero-score results must not be mistaken for absent results; all other eligibility checks still apply.
- Test Start Round 2 versus Discard races, discard versus fresh-instance creation, stage-scoped code/session/replacement grants, and late judge callbacks/events from discarded or completed instances. A fresh instance must not inherit claims, scores, wallets, hints, penalties, or language locks.
- Test wrong/unpublished/duplicate bug selections, language coverage, frozen pool versions, hidden-content boundaries, roster/cap/qualifier checks, deadline admission, and one-time same-instance carryover. Both instance leaderboard tabs must always show their own records, including Not Started and final zero-score states.
- Test that variants from another bug version cannot be submitted against a bounty, that all language variants use the version's shared tests/checker, that readiness matches the selected configuration, and that two versions of one definition cannot bypass the round's duplicate-selection rule. These are future verification requirements, not executed tests.
- Test pause-adjusted cumulative time separately from absolute claim order, including overlapping intervals, pauses after earlier solves, a team paused at shared close, and a long between-round interval. These are future verification requirements, not tests already run.
- Test that global technical breaks preserve remaining play time, extend the shared close once per distinct interval, survive restart/reconnect, and can span the original deadline without prematurely closing the paused round. Team/member pauses must not independently extend the shared deadline. These are planned tests, not executed behaviour.
- Planned closing tests must cover queued/running attempts at expiry, correct results arriving after the deadline, earlier unresolved Round 2 attempts, rejected post-close submissions/purchases, duplicate judging callbacks, restart during settlement, provisional-to-final live updates, and blocking Round 2/result locks until admitted scoring work is settled. Infrastructure-failure tests depend on the recovery policy still to be agreed.
- Required infrastructure-recovery tests must verify zero penalty for internal failures; unchanged official attempt identity, source/configuration, receipt priority, and hint snapshot across retries; no new submission after closing; one eventual award/participant-code penalty at most; reconciliation of lost/duplicate results; and provisional standings/admin attention for persistent failures. Retry-limit and terminal-resolution cases await the remaining policy decisions; no tests are implemented here.
- Planned verdict tests must cover every confirmed Round 2 category, correct race losers with zero penalty, all categories remaining penalty-free in Round 1, many failed tests producing only one penalty, duplicate verdict delivery, and infrastructure failures followed by a real participant-code result. Raw/ambiguous status cases require the pending mapping contract; a provisional processing state must never create a wrong-answer penalty.
- Planned timing tests must verify that a credited minute-20 receipt judged at minute 23 contributes 20 minutes before pause adjustments in either round; retries/late awards do not change it; pauses after receipt are not subtracted; overlapping applicable pauses are subtracted once; and only distinct point-earning bounties contribute. Verify that out-of-order correct Round 1 results credit the earliest correct receipt within the team, earlier incorrect attempts unblock the next correct one, and another team's pending attempt does not block this team's award.
- Planned work-indicator tests cover team-private delivery, different languages, both members working on one bounty, forged team/member/bounty identifiers, multiple tabs and partial leaves, lost connections/stale expiry, reconnect/restart, pauses/revocation, solved/claimed bugs, round/instance changes, and preserving drafts/language/session grants. Presence must never reserve a bounty, award points, expose live source, or change submission eligibility/receipt order.
- Planned submission-format tests must verify complete-program starter/entry-point and I/O handling for all five initial languages, frozen format/runtime/test versions, rejection of unsupported function-only/browser definitions and client mode overrides, and no reinterpretation of historical attempts by later format additions. Entry-point/comparison details await their contracts; these are not implemented tests.
- Planned Run/Submit tests must verify no sample-run penalties for any outcome; no points, wallet effects, awards, or receipt priority from Run; explicit official submission with fresh admission-time source/receipt/hint snapshot; no hidden-test access through forged sample identifiers; and no official result/finalisation effects from sample callbacks. Test declared Run resource/queue and state restrictions after those details are agreed.
- Planned checker tests must cover token whitespace equivalence, exact-mode significant formatting, missing/extra/reordered tokens, case differences, numeric token spelling, empty output, shared rules across languages/Run/Submit, forged checker overrides, frozen versions, execution failures despite matching output, and invalid/truncated output. Newline/decoding edge cases await the technical contract; no checker is implemented here.
- Planned feedback tests must verify detailed feedback only for public sample execution; official responses/events/history/reconnect/errors/downloads expose only permitted state; a program echoing hidden input through stdout/stderr or an exception cannot leak it; forged visibility/sample flags cannot widen access; and staff/raw execution records stay private. Test safe rendering and output limits once their mechanisms are selected. These are future tests, not implemented behaviour.
- Planned authoring-validation tests must reject missing language/reference coverage, references failing any required sample/hidden test, starters passing unchanged, infrastructure failures masquerading as intended defects, and reports stale after source/test/checker/runtime/limit changes. Verify valid intended compilation/runtime starter defects, private reference/hidden-data access, zero competition effects, and start-time revalidation of the selected revision. No validator or competition bug is implemented here.
- Planned official-cap tests must admit only one queued/running attempt per team/bounty across members/languages/tabs, while permitting that same member/team to submit other bugs without waiting. Cover replacement/restart, idempotent request recovery, no penalty/priority for busy rejections, infrastructure recovery retaining only that bug's guard, release after verdict despite a pending award, and stale callbacks unable to release a newer attempt. Global bounds remain to be defined; no guard is implemented here.
- Planned sample-cap tests must admit at most two concurrent Runs per member, reject a third without penalty, allow independent teammate capacity alongside official attempts for different bugs, preserve counts across tabs/replacement/restart, deduplicate request retries, distinguish multi-case runs from request counts, release capacity once, and associate out-of-order feedback with the correct source. Run state/rate/global-queue tests await their remaining policies; no guard is implemented here.
- Planned scheduler tests must verify the 3:1 dispatch cycle when both queues are backlogged, fair team rotation, empty-queue capacity sharing, no priority-based interruption of running jobs, bounded in-flight work, retry/restart recovery, and unchanged receipt-order awards despite different completion order. Many queued bugs from one team must not monopolise turns; this plan does not assert measured throughput.
