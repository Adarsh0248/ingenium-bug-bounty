# Round 2 special items

Approved design and prices, 28 October 2026. The shop frontend and a separate
functional local preview now exist. Production item enforcement is not implemented.
Amounts are whole game coins, charged to the shared team wallet. Round 2 solves
continue to earn coins, and only committed funds can be spent.

## Latest purchase-flow decision

The user has changed bug-targeted purchases to **buy now, hold, then use from
the Round 2 question page**. Boundary Probe, Hex Scanner and Claim Lock must not
ask for a bug in the shop. Buying adds a consumable to the shared team inventory;
the question page provides **Use item** for the currently open bug. Activation
does not charge a second time. Probe/scanner intelligence and its scoring
assistance begin only when used, and Claim Lock's five-minute window begins on
successful activation, not purchase. Invalid or already-applied uses must keep
the held item. Both teammates must see the same remaining stock, and concurrent
uses must not consume or apply the same held unit twice. Owned items remain
usable during Black ICE, subject to the normal round and bug eligibility rules.

This supersedes immediate activation for those three items. The local preview
now implements inventory and question-page activation. Other items retain their
existing activation flow. Production persistence and multi-team enforcement
still require integration.
The requested single-map Round 2 arena is described, separately from the proposed
art direction, in [the arena design](round-2-arena-design.md).

## Approved prices

| Item | Price | Effect |
| --- | ---: | --- |
| Boundary Probe | 400 | Unlock one additional authored edge-case example for a bug; never expose a hidden judging test. |
| Hex Scanner | 750 | Highlight the broad code section containing the fault without supplying the fix. |
| Overdrive Core | 500 | Unlock enhanced finishers, a team aura and a glowing team name on leaderboards for the round; cosmetic only. |
| Ghost Scan | 1,500 | For 15 seconds, highlight unclaimed bugs with no detected rival activity. |
| Chrono Shield | 2,500 | Protect one selected future submission from the wrong-submission time penalty. |
| Claim Lock | 5,000 | Give the buying team a five-minute protected opportunity to solve a bug and earn its reward regardless of another team's claim during that window. |
| Black ICE / Credit Freeze | 15,000 | Block all new hint and shop purchases by one opponent team for 30 minutes. |

Black ICE's approved price is **15,000**, reduced from 20,000.
All other prices above were accepted unchanged.

Overdrive Core adds an amber glow to the equipped team's name in the small
leaderboard, full standings and results views. The glow has no scoring effect.
Reduced-motion settings keep the glow still. The frontend reads the team's
public `overdrive` standing flag; the local preview retains it with the original
purchase across reloads. Production publishing of this flag remains part of
the pending durable item integration.

## Hex Scanner balance correction

The price stays **750 coins** and activation still counts as Hint 2 assistance:
an otherwise eligible winning solve earns **70% of the base points**, or a lower
multiplier if Hint 3 is also used. Wallet payout, held inventory and all existing
eligibility gates remain unchanged. No new purchase cap is imposed by this change.

Each mission now has an authored subsystem label and explicit code boundaries,
covering several related state updates, conditions and calculations. All four
languages trace the same algorithmic phase. The selection is not centred on a
reference diff; a diff is used privately only to verify that the authored scope
contains the intended fault. The old predictable third-line locator is removed.
Reloading, repeat purchases and language variants do not supply independent
windows that can be intersected to narrow down the answer.

Across 400 variants, sections span 4–39 lines (median 13); the shortest scopes
belong to genuinely compact algorithms. The first faulty line occupies 20
different positions across the pack, instead of always being the third line.

The workbench shows that part of the **original buggy starter**, with its original
line range. Editing or inserting lines in the private draft cannot shift the
trace or overwrite its content. The original section is returned only after
activation, using the existing protected item-intelligence flow. It contains no
reference source, hidden tests or complete repair instructions.

Automated coverage and leakage checks are guardrails, not measured competitive
balance. Participant pilot solves must still compare time saved, claim rates and
coin use against unaided solving and ordinary hints.

## Approved limits and scoring

- Both teammates share purchases and their effects.
- Boundary Probe counts as Hint 1-level assistance and Hex Scanner as Hint
  2-level assistance for scoring. Use the highest assistance level, rather
  than stacking score reductions. These effects are demonstrated in the local
  preview; production awards and past submissions are unchanged.
- Chrono Shield, Claim Lock and outgoing Black ICE are each limited to one use
  per team per round. Ghost Scan has a two-minute cooldown.
- A target team can receive Black ICE only once per round across all attackers;
  freezes cannot stack or extend. Charge only for a successful activation.
- Black ICE blocks purchases for both members. Previously purchased hints remain
  readable and owned items remain usable. Correct solves still credit points and
  coins; spending unlocks when the effect ends. Coding, Run, Submit and the round
  clock continue normally.

## Ghost Scan

During the 15-second scan, update highlights on the map and target list. Rival
activity includes an open coding editor or unfinished Run/Submit, aggregated
across language variants. Exclude the buyer's own team. Return only the permitted
activity indication, never opponent identities, code or progress.

The label means **No rival activity detected**. It cannot guarantee that nobody
is thinking about the question or working outside the app. Existing presence
freshness and uncertain observations need explicit treatment in implementation.

## Claim Lock clarification

The agreed item is a protected scoring opportunity, not exclusive access. Other
teams may continue working and submitting. The buyer can still earn the normal
reward once if another team solves or claims the bug during the five-minute
window. A protected solve clears the bug for that solving team without removing
another team's protected opportunity.

Qualification uses original server receipt time: an eligible correct submission
received within the window still qualifies if judging finishes later. When the
window expires without a qualifying solve, the protection ends and normal bug
availability applies. Previously earned rewards remain valid.

## Implementation boundary

This document records decisions and a local preview, not production or balance evidence.
Durable protected activation/expiry, purchase recovery, simultaneous claims, new
award exceptions and assistance-tier handling require production implementation
and tests before event use. Exact timer behaviour during staff pauses and activation eligibility
must be settled before wiring the items into the round engine. No deployment or
database migration is authorised by this design record.

## Review the local shop

From the repository root:

```powershell
npm.cmd run preview:round2
```

Open **http://127.0.0.1:5176**, enter the preview-only team code
`AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, choose Asha or Dev and a language, then click
**Black Market**. The preview starts Round 2 with 35,000 demo coins and zero
competition points. Buying Boundary Probe, Hex Scanner or Claim Lock puts it in
the shared demo inventory, without a target or active timer. Open a question and
use **Team inventory**, choose the item and confirm its use. Claim Lock's window
starts then. Other purchases activate immediately. Purchases and activations
survive a page reload while the preview process is running.

This uses its own in-memory state and cookie, without Docker, real registration,
development database changes or a cloud judge. Each browser profile gets an
independent demonstration; cross-browser teammate/opponent enforcement is not
proved. Restarting the process clears its demo purchases and drafts. Existing
Round 1 previews are separate and are not reset by this command.

The seven cards include wallet checks, limits, confirmation and GET-only lost
purchase recovery. Ghost Scan highlights map rings and target rows; purchased
intel appears in the workbench; Overdrive adds the team/finisher accent; Claim
Lock preserves eligibility after a simulated rival claim; Chrono Shield covers
the next simulated official result. Incoming Black ICE blocks purchases and new
hints while allowing coding, submissions, owned intel and earnings.

The Kernel Breach map now contains the [100 authored Round 2 drafts](round-2-question-design.md),
with difficulty 25–100 and four language variants. Boundary Probe unlocks a
separate authored edge example, checked against all four references and distinct
from every judging input. It never exposes a hidden judging test. Hex Scanner
highlights a broad section around the intended fault in the enrolled language;
it does not return the reference program. These local item payloads remain private
until activation. Human clue/balance review and production item enforcement remain
required. Judging in this visual preview is still simulated:
`PREVIEW_WRONG` in submitted source demonstrates a wrong result, and
`PREVIEW_INFRA` demonstrates an infrastructure result. Other source is not executed.

Expand **Local preview controls** inside the shop to add demo coins, demonstrate
an incoming freeze, clear that simulated freeze, or let a rival claim the
protected bug. These controls are excluded from production assets. Timers use
wall time in this demonstration; final pause/expiry policy needs production work.
