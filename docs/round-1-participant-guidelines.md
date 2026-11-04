# INGENIUM - Bug Bounty
## Round 1 participant guide

**Tecnoesis | Friday, 30 October 2026 | Venue: CC 05**

| Schedule | Time (IST) |
| --- | --- |
| Recommended reporting time | **9:00 AM - arrive early for setup** |
| Round starts | **10:00 AM sharp** |
| Playing time | **3 hours** |
| Scheduled finish | **1:00 PM**, unless organisers announce an official technical pause |

**Bring your own laptop and charger.** Both teammates should bring their own laptops so they can work at the same time. Login, registration checks and network setup can take time. Do not arrive at 10:00 AM expecting the round to wait.

**Late arrival does not extend your time.** Everyone shares the same round clock. If you join at 10:30 AM, you have only 2 hours 30 minutes left in the scheduled playing window, minus any setup time you still need.

### Before you leave

- Charge your laptop and carry its charger. Bring a mouse if you prefer one.
- Have an updated Chrome or Edge browser ready. A local IDE, compiler or language installation is not required for the browser-based contest.
- Keep your registration details and team access code available privately. Do not post or share the code with other teams.
- Both registered teammates should arrive together and complete setup before the start.
- Phones may be brought, but must be kept on silent and put away during the round. **Using a phone during the round without organiser permission means instant disqualification.** Ask first, including for connectivity or setup help.

### At CC 05: complete setup first

1. Report to the organisers and complete the registration/check-in instructions.
2. Connect to the network specified at the venue. Ask for help early if it does not work.
3. Open the event website: **https://8-231-75-42.sslip.io/**. Use any updated official link announced at the venue.
4. Enter your team's access code. Each member must select their own registered name, not their teammate's name.
5. Choose **C, C++, Java or Python** carefully. Each member's language stays fixed for Round 1; teammates may choose different languages. JavaScript is not supported.
6. Check your team/member details and wait for the organiser's start announcement. If a detail is wrong, ask an organiser before the round begins.

**Need help? Speak to the organisers in CC 05. Do not wait until the start to report a setup problem.**

<!-- pagebreak -->

## Your mission: find, fix, submit

Round 1 is a two-person team debugging contest. You receive a problem statement and a buggy program. Your task is to repair the program so that it produces the required output. The story is **Protocol Rebellion**: restore systems corrupted by a rogue AI.

### The 50-question arena

| Area | Main topics | Questions |
| --- | --- | ---: |
| Neon District | Arrays, strings and searching | 13 |
| Silicon Hive | Systems, memory and resource handling | 13 |
| Verdant Nexus | Graphs, trees and traversal | 12 |
| Zero-Day Core | Logic, state and concurrency | 12 |

- Attempt questions in **any order**. Each question stands alone; no earlier answer is needed to unlock another.
- The pool contains 35 very easy, 10 easy and 5 moderate questions. Use the displayed difficulty and bounty to choose your next target.
- Every question has versions in all four supported languages, with the same intended task, difficulty and reward.
- **Other teams cannot take away your Round 1 questions.** Your team's progress is independent. You do not need to solve all 50 to compete for qualification.

### How to open a question

- Select an area, then drag to pan around its map. The map does not use zoom controls.
- Click a bug on the main map to open its question.
- Clicking an unsolved bug in the left-hand list takes you to it and shows its information card. Choose **Open question**, or click the bug itself.
- The mini-map is for navigation. Open questions from the main map or question list, not from mini-map bug markers.

### For each repair

1. Read the expected behaviour, input/output format, examples and limits.
2. Inspect the supplied starter code and edit it in the coding workspace.
3. Use **Run samples** to test the provided public examples. A sample pass does not guarantee that all hidden tests will pass.
4. Use **Submit fix** for official judging. Saving code or running samples alone does not submit a solution or earn coins.
5. Check the submission status and final result. If it fails, review the code and try again. Follow any waiting/cooldown message instead of repeatedly clicking.

Submit a complete program that reads and writes exactly as the statement asks. Do not hard-code sample answers or leave extra debug output in the result.

**Work as a team:** divide questions between the two of you. You have separate drafts, but share points, coins and purchased hints. Only one official attempt for the same team/question can be queued or running at once; you can work on other questions while it is judged.

<!-- pagebreak -->

## Coins, hints and qualification

### Earning points

- A correct official repair earns the question's displayed bounty **once per team**. A second solve by your teammate or in another language does not earn it again.
- The Round 1 pack offers **150 to 2,000 in-game coins per question**. The 50 questions total 42,400 coins before hint spending.
- **Wrong submissions have no automatic time penalty in Round 1.** You may repair and resubmit after judging finishes. Sample runs do not earn points or coins.
- Coins are game currency, not cash. Paid hints spend the team's earned coins and reduce its Round 1 net score.

### Optional paid hints

There are three progressively stronger hints per question. Buy them in order from that question's hints panel. Prices are based on the original bounty, not your current balance.

| Hint | Additional cost | Total spent so far |
| --- | ---: | ---: |
| Hint 1: a small clue | 10% of the bounty | 10% |
| Hint 2: more direction | Another 30% | 40% |
| Hint 3: near-solution guidance | Another 40% | 80% |

**Example:** a 1,000-coin question charges 100, then 300, then 400 coins. Buying all three costs 800. A correct solve still credits the full 1,000 once, giving a net gain of 200 after those purchases. If you do not solve it, the spent hint coins remain spent.

- You need enough coins to make a purchase. There is no need to buy hints to solve a question.
- A purchased hint is shared with your teammate; do not pay for it twice.
- Hint purchases are not refunded by resetting your code or leaving the question.
- The special-item shop belongs to Round 2; it is not part of Round 1.

### How teams are ranked

1. **Higher net points:** earned bounty minus Round 1 hint spending, with any recorded organiser correction.
2. **Lower cumulative solve time**, if points are equal. This adds the elapsed time from the round start to each credited correct submission. For example, solves at minutes 10 and 25 add up to 35 minutes, not 25.
3. **Harder solved-question profile**, if points and cumulative time are equal. Solved difficulties are compared from highest to lowest; the higher value at the first difference wins.

The server's confirmed receipt time is used, not your device's clock or the time the result animation appears. Official technical pauses are handled by the event system.

**Up to 50 eligible teams qualify for Round 2.** If teams are still fully tied across the qualification cutoff, a recorded draw decides the remaining places. Do not treat a live leaderboard position as final qualification.

Your team's final **unspent Round 1 coins** carry into Round 2 if it qualifies. Round 2 leaderboard points start from zero. Wait for the organisers' final results and next-round instructions.

<!-- pagebreak -->

## Technical help, fair play and the finish

### Keep your work and session safe

- Watch the save indicator. Code in the editor is not necessarily saved yet, and a saved draft is not an official submission.
- Use **Reset code** only if you want the original buggy starter back. Confirming it replaces your current draft for that question; it does not reset the round, undo hints or refund coins.
- Keep your contest tab open. If the map feels slow, use the question list; use the plain-text editor option if needed.
- Avoid logging out, clearing site data, changing browser/profile or moving to another device during the round. Re-entry or browser replacement may need organiser approval.
- Use **Keep signed in** if the app prompts you. Staying signed in does not extend the round deadline.

### If the connection drops or a result is delayed

Keep the tab open and tell an organiser. Already-loaded code may remain editable during a brief outage, but **you cannot submit or buy hints offline**. Offline edits are not proof of server saving and may be lost if the browser closes.

After reconnecting, wait for the app to restore its verified state. Check the previous submission/save outcome using the recovery button shown before trying again. Do not repeatedly submit the same fix because a response is slow. Pending judging can finish while you work on another question.

There is **no automatic extra time** for a personal setup or connection delay. Only organisers can announce a technical pause or schedule adjustment. If you need to use your phone to troubleshoot or change connectivity, get permission first.

### If a question seems faulty

Use **Report question** on its page. Describe the issue clearly. Attach the relevant official submission if you have one; the report preserves that exact submitted code. A question-only report is also possible. There is one report per team/question.

Tell an organiser if it blocks you, then continue with other questions where possible. A report does not automatically award points, refund hints or pause the clock. Organisers review it and may record an explained score correction after the round.

### Fair-play rules

- Work only with your registered teammate. Do not share codes, answers or solutions with another team, or obtain help from anyone outside your team.
- **AI tools and external websites are banned during Round 1**, including search engines, online documentation, solution sites and AI assistants. Use the event website and materials supplied by the organisers.
- **Phone use during the round without organiser permission results in instant disqualification.** Bringing a phone does not permit using it. Keep it silent and put away.
- Do not interfere with other teams, their devices, the network or the event platform. Follow organiser instructions and raise disputes through the reporting process.

### At 1:00 PM / the official closing time

Submit early enough for the server to confirm receipt before the deadline. Clicking just before the timer ends does not guarantee receipt. Unsaved drafts and offline work do not count as submissions. New submissions and purchases close when the round ends; already-admitted submissions finish judging before results are finalised.

**Final reminder: CC 05. Bring your laptop and charger. Report early, preferably by 9:00 AM. Round 1 starts strictly at 10:00 AM; late arrivals have less time.**
