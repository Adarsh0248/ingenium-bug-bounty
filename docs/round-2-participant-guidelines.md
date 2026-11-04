# INGENIUM - Bug Bounty
## Round 2 participant guide

Tecnoesis | Saturday, 31 October 2026 | Venue: CC 05 | Start: 10:00 AM IST

Recommended reporting time: 9:00 AM. Playing time: three hours, from 10:00 AM
to 1:00 PM IST, unless organisers announce an official technical pause or change.
Arrive early; joining late does not give extra time. Follow the official arena timer.

## 1. Before the round

- Bring your own laptop and charger. Each participant should have their own device;
  registered pairs may work on different questions at the same time.
- Use an updated Chrome or Edge browser. The contest works in the browser; you do
  not need to install a compiler or a local IDE.
- Website: https://8-231-75-42.sslip.io/ . Follow an updated official link if announced.
- Keep your team access code private. Sign in as your own registered member, then
  confirm your team and Round 2 language before the start.
- Supported languages: C, C++, Java and Python. JavaScript is not supported.
  Your member's selected language stays fixed for the round; teammates may differ.
- Check the network, editor and team details before 10:00 AM. Tell an organiser
  about setup problems immediately. Do not wait for the round to begin.

## 2. The shared arena

Round 2 has a 100-question shared debugging arena. Each question provides a clear
task, buggy code, public examples and optional paid hints. Repair the code and
submit a complete program with the required input and output. Questions can be
attempted in any order, in all four supported languages.

This round is a race for claims. Normally, the earliest correct official submission
received by the server wins that bug's reward. A faster result animation does not
decide the winner. An earlier pending submission may need judging before a claim
can be settled. Opening a question or running samples does not reserve it.

Once an ordinary claim is awarded, other teams normally cannot earn that bug.
Claim Lock is the exception explained below. A team can earn a bug only once;
switching members or languages does not create another reward.

1. Use tags, difficulty sorting and the question list to find a target.
2. Click a bug on the main map, or choose it in the list and use Open question.
3. Read the statement, examples and limits; edit the supplied buggy code.
4. Run samples checks public examples only. Passing them is not a guaranteed pass.
5. Submit fix enters official judging. Saving a draft or running samples earns no reward.
6. Watch for the confirmed result. Work on another question while a result is pending.

Both teammates share the wallet, score, hints and inventory. They have separate
drafts. Only one official submission for the same team and bug can be unfinished
at a time. Solo entrants work alone; pairs may divide the questions.

## 3. Coins, points and ranking

Your final unspent Round 1 coins carry into Round 2. Round 2 leaderboard points
start at zero. An eligible correct repair credits the bug's full displayed bounty
to the shared wallet; the pack offers 250-1,000 game coins per bug. These are game
coins, not cash. You can spend new Round 2 earnings during the round.

Competition points and spendable coins are different. Assistance can reduce a
bug's awarded points while its full bounty is still credited to the wallet.
Buying hints or shop items spends coins; it does not directly deduct Round 2
leaderboard points. Probe/scanner assistance can affect the solved bug's points.

### Paid hints

Buy the three hints in order. Each listed cost is an additional purchase, based
on the question's original bounty. Purchased hints are shared with your teammate.

| Highest hint used | Additional hint cost | Points for an eligible correct solve |
| --- | ---: | ---: |
| None | 0 | 100% of base points |
| Hint 1 | 10% of bounty | 90% |
| Hint 2 | Another 30% | 70% |
| Hint 3 | Another 80% | 50% |

Example: on a 1,000-coin bug, the hints cost 100, 300 and 800. All three cost
1,200 coins in total. With Hint 2 as your highest assistance, an eligible correct
solve adds 1,000 coins to the wallet and 700 points to the leaderboard. The hint
purchases remain spent, even if you do not solve the bug.

Boundary Probe counts as Hint 1 assistance; Hex Scanner counts as Hint 2.
Use the highest applicable assistance level, not stacked percentage reductions.
The assistance level is captured when the official submission is received;
a later purchase does not rewrite an earlier attempt.

### Wrong submissions and tie-breaks

- An incorrect official submission adds five minutes to the team's ranking time.
  It does not lock the editor for five minutes or remove five minutes from the round.
  This includes compilation, runtime and limit failures.
- Run samples has no official wrong-submission penalty. Infrastructure errors
  and correct submissions that lose the claim race do not get that penalty.
- Chrono Shield can protect the next admitted official submission from this penalty.
- Rank is decided by more Round 2 points, then lower cumulative solve time plus
  penalties, then the harder solved-question profile compared highest-first.
  Fully tied teams share a rank. Recorded organiser corrections may affect final points.
- Cumulative solve time adds the elapsed round time of each credited submission;
  it is not just the time of your last solve. The server's receipt time is used.

## 4. Black Market: shop quick reference

All prices are in shared team coins. Read the purchase confirmation before buying.

| Item | Price | Effect and limit |
| --- | ---: | --- |
| Boundary Probe | 400 | One extra practice input/output example for the chosen bug. Not a hidden judging test. Counts as Hint 1 assistance. Held item. |
| Hex Scanner | 750 | Shows a broad section of the original buggy code to investigate. It does not supply the fix or exact faulty line. Counts as Hint 2 assistance. Held item. |
| Overdrive Core | 500 | Makes your team name glow on the leaderboard and upgrades its visual effects for this round. Cosmetic only; no points or speed bonus. |
| Ghost Scan | 1,500 | For 15 seconds, highlights unclaimed bugs with no detected rival activity. Two-minute cooldown. It does not reveal opponent names, code or progress. |
| Chrono Shield | 2,500 | Protects the next admitted official submission by either teammate from a wrong-submission time penalty. One per team per round. |
| Claim Lock | 5,000 | A five-minute protected chance to earn one chosen bug, even if another team claims it. Other teams can keep solving. Held item; one per team per round. |
| Black ICE | 15,000 | Freezes one rival team's new hint and shop purchases for 30 minutes. One outgoing attack per team; each target can be hit only once in the round. |

### Buy now, use later

Boundary Probe, Hex Scanner and Claim Lock go into your shared inventory. Buy
them in the shop, open the target question, then choose Use item. Activation
does not charge again. A rejected activation keeps the held item.

Claim Lock's five minutes start on successful activation, not on purchase.
Chrono Shield is armed when bought and attaches to the next admitted official
submission across both teammates. Coordinate before either member submits.
A rejected request, duplicate receipt or sample Run does not consume the shield.
A correct submission uses it too; it is not a bonus or a reusable shield.

Ghost Scan starts on a successful purchase. For Black ICE, choose the rival team
when buying; its freeze starts on success. Overdrive Core equips immediately.

## 5. Important item details

### Claim Lock is protection, not exclusive access

Activate it on an eligible, unsolved and not already ordinarily claimed bug.
During the window, your team can earn that bug once even if another team wins
its ordinary claim. Other teams can still edit, run and submit. Your protected
solve does not remove their ordinary scoring opportunity.

Example: your lock is active from 10:20 to 10:25. Another team claims the bug at
10:22. Your correct submission can still earn its protected reward if the server
receives it within your active window, even if judging finishes later. After
expiry, protection ends and normal availability applies. Existing rewards stay.

### Black ICE freezes spending, not participation

Both rival members are blocked from making new shop or hint purchases. They can
still code, Run, Submit, earn rewards, read hints already bought and use items
already held. Black ICE does not steal coins, stop the round clock, log anyone
out or stack with another freeze on the same team.

### Ghost Scan is an activity signal

No rival activity detected does not promise that nobody is thinking about that
bug or working outside the app. The scan gives no exclusive claim. Information
can change, so do not treat a highlight as a guaranteed easy reward.

Timed shop effects and Ghost Scan's cooldown follow the shared round clock.
A global technical pause freezes their remaining time. A personal or team pause
does not freeze those timers. During an applicable pause, new purchases and item
activations are blocked; previously bought intelligence remains readable.

## 6. Technical help and fair play

- Watch the draft save indicator. A saved draft is not an official submission.
  Reset code restores the original buggy program and replaces your current draft;
  it does not undo purchases, reset the round or refund coins.
- If the network drops, keep the tab open and tell an organiser. Already-loaded
  code may remain editable, but submitting, purchasing and confirmed server saves
  require a connection. Offline work may be lost if you close or reload the tab.
- After reconnecting, check the original request/submission outcome before trying
  again. Do not spam Submit or Run because a response is slow. Follow cooldowns.
- For a faulty question, use Report question. Include a clear description and the
  relevant submitted fix if available. A report does not automatically award
  points, refund a purchase or pause the clock. Staff review and record corrections.
- Use the question list if the map feels slow, and the plain-text editor if needed.
  Ask before changing device/browser or clearing site data; session recovery may
  require organiser help. Keep your team code private.
- Work only with your registered teammate. AI tools, external websites, online
  documentation, searches and outside help are banned during the round.
- You may bring a phone, but keep it silent and put away. Using it during the round
  without organiser permission means instant disqualification. Ask first, including
  for network or setup help.
- Do not interfere with other teams, their devices, the network or the platform.
  Use only the provided game mechanics to compete.

At the official closing time, new submissions and purchases stop. Submit early
enough for the server to confirm receipt; clicking at the last moment is not a
guarantee. Already-admitted submissions finish judging before results are final.
Only organisers can announce a technical pause, extension or schedule change.

Final checklist: CC 05; laptop + charger; private team code; report by 9:00 AM;
10:00 AM sharp start; scheduled finish 1:00 PM;
watch the official timer; fix code, spend wisely, and play fair.
