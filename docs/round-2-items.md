# Round 2 special items

Approved design and prices, 28 October 2026. The shop frontend, isolated preview
and durable application backend now exist. This is implementation status, not
event deployment or participant-pilot balance evidence.
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
are enforced by the guarded application backend.
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
purchase across reloads. Production live standings, the full standings endpoint
and participant results/history read the durable cosmetic flag. It never changes
the frozen sporting result or exported score digest.

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
  than stacking score reductions. The highest assistance tier is captured when
  the official submission is admitted; later purchases do not rewrite that attempt.
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

## Durable backend and timer policy

Reviewed migrations `0083`–`0086` add immutable purchases, single-use activations,
submission-bound protection/shield records, private snapshot intelligence and
once-only expiry notices. Wallet debits and receipts commit with the purchase;
activation consumes the original held purchase without charging it again. Both
members share inventory. The same round lock orders purchases, hints, activation,
admission and settlement, preventing overspending and competing Black ICE hits.
The API role cannot directly write shop tables or read unpurchased intelligence.

All timed shop effects and Ghost Scan's cooldown use the shared round clock:
global technical pauses freeze their remaining time; team/member pauses do not.
During any applicable pause a member cannot buy or activate new items. Previously
purchased intelligence remains readable. Effect eligibility is checked against
trusted time on every command, even if maintenance has not emitted the expiry
notice yet. The regular maintenance loop publishes bounded, once-only expiry
updates; neither a restart nor a reload resets an effect.

Chrono Shield attaches atomically to the next **admitted official** submission,
across both members. A rejected submission, sample Run or duplicate receipt does
not consume it. A correct result uses the shield without awarding a bonus;
an infrastructure failure does not rearm it or create a penalty. Retry recovery
stays attached to the original submission.

Claim Lock can be activated only on an eligible, unsolved, not already ordinarily
claimed bug. Its receipt-time protection is captured at admission. An eligible
submission received before expiry can earn its protected award after expiry.
Protected awards clear the target for that solving team, never emit a global
claim or prevent a separate ordinary winner. Ordinary claims still allow an
already protected team to keep editing and submit during its window. Each team
can earn that bug once. An earlier unresolved ordinary submission holds up later
ordinary claims; protected submissions do not hold up that ordinary race.

Ghost Scan combines unfinished rival sample/official work with authenticated
editor-presence leases across languages and tabs. Own-team activity is excluded.
A disconnected editor remains conservatively busy until its 45-second lease
expires; renewals use the existing 15-second live cadence. During an active scan
the browser refreshes its private indication every 1.5 seconds and hides it while
live authority is stale/offline. No identities, source, hints or progress are
returned. This is still an activity indication, not proof nobody is working
outside the application. No additional polling runs for teams without a scan.

The separate preview continues to use in-memory demo state. Production routes
use the database and contain no demo coin/freeze controls. Migrations have only
been exercised on disposable test databases; no event database or cloud host has
been changed. Participant balance review and existing event-capacity/host gates
remain separate.

## Protected clue installation

Probe/scanner content is authored separately from the hidden judging suite. A
schema-owner content operation installs reviewed JSON bindings for frozen,
unselected Round 2 snapshots. It checks snapshot/starter hashes, four supported
languages, clue bounds, broad faulty-code coverage and a probe input distinct
from every judging case. All bindings commit together or none do. An identical
import is a no-op; changed or already-selected bindings cannot replace content.
The importer never creates a question, publishes it or starts an arena.

Each array entry has this structure; use actual reviewed IDs/hashes and clue text:

```json
{
  "snapshot_id": "<frozen snapshot UUID>",
  "language": "cpp",
  "snapshot_fingerprint": "<64-character SHA-256>",
  "starter_sha256": "<64-character SHA-256>",
  "data": {
    "probe": {"input": "<separate authored input>", "output": "<verified output>"},
    "scanner": {
      "label": "<subsystem>", "text": "<broad direction, no repair>",
      "from_line": 4, "to_line": 16
    }
  }
}
```

Keep the complete bindings array outside public assets. With the normal private
schema-owner migration connection configured, the built operator entry point is:

```powershell
npm.cmd run content:shop-intel --workspace @ingenium/api -- --bindings <private-reviewed-json>
```

This command requires `MIGRATION_DATABASE_URL` in its environment, uses a loopback
schema-owner connection and prints only binding counts. It does not load `.env`
files or accept the API/worker role. Each probe's output must first pass its
reference-program checks; the importer does not execute arbitrary code.
The four-language authored pack already carries private `paid_intel` data, but
binding it to the final frozen production snapshots belongs to content publication.

Participant routes under `/api/v1/competition/rounds/:round_id/shop` are GET `/`,
POST `/purchases`, POST `/activations`, GET `/outcomes/:request_key` and GET
`/intel/:bounty_id`. Writes require normal Origin/CSRF and current authority.
After an uncertain reply, read the original outcome; do not issue another purchase.
Intel is fetched only for the open question after activation, rather than copying
private source into every live snapshot.

Run the isolated backend/browser integration checks with
`INGENIUM_TEST_SUITE=shop npm run test:db:schema` (set the environment variable
using the shell's syntax on Windows). These use a new disposable PostgreSQL
container and synthetic judging; they do not require the retained cloud lab.

## Verification recorded for this implementation

The focused durable-shop matrix passes 19 checks, including guarded private clue
installation, three independent teams, concurrent purchases/activations/attacks,
exact receipt recovery, all pause scopes and expiry, assistance at admission,
Chrono Shield consumption, normal/protected awards, and two real browser contexts
sharing inventory and reopening purchased clues after reload. Judging in this
matrix is synthetic. The wider 145 competition and 144 foundation checks pass,
as do six reward checks, 365 API/92 web unit checks, builds/typechecks and public
bundle checks. This does not rerun or certify the previously deferred real-host
maximum-load/endurance work. Nothing has been deployed.

The 29 October isolated Linux rehearsal additionally passed the two-round flow
against the real protected compiler and production shop/competition services.
It verified all seven items, simultaneous teammate purchase, exact lost-reply
recovery, owned clues, Black ICE with coding still allowed, one-use shield,
protected and ordinary rewards, wallet carryover and frozen clocks during pause.
Publication setup and the clock in that harness remain synthetic; this does not
certify maximum compiler capacity or a five-hour endurance window. Evidence:
`apps/api/test-results/readiness-rounds-completed-20261029.log`.

## Review the local shop

From the repository root:

```powershell
npm.cmd run preview:round2
```

Open **http://127.0.0.1:5176**, enter the preview-only team code
`AAAAAAAA`, choose Asha or Dev and a language, then click
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
until activation. Human clue/balance review and final published-content validation remain
required before event publication. Durable item enforcement is exercised separately
from this preview. Judging in this visual preview is still simulated:
`PREVIEW_WRONG` in submitted source demonstrates a wrong result, and
`PREVIEW_INFRA` demonstrates an infrastructure result. Other source is not executed.

Expand **Local preview controls** inside the shop to add demo coins, demonstrate
an incoming freeze, clear that simulated freeze, or let a rival claim the
protected bug. These controls are excluded from production assets. Timers use
wall time in this demonstration; the durable backend uses the shared round
clock and global-pause policy described above.
