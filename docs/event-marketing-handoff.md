# INGENIUM Bug Bounty — event, marketing and media handoff

Updated: 28 October 2026. Internal working brief, prepared for continuing in another chat.

This file contains the event context needed to plan publicity, PR, posters, videos, brochures and other media. It is not a public rulebook or a claim that the event is deployed. Confirmed decisions, proposed copy and missing information are separated below. The brief is self-contained; repository links are optional background.

## 1. Start here in a new chat

Copy or attach this entire file, then use this prompt:

> Help me market INGENIUM Bug Bounty using the attached event brief. We are now working on publicity, PR and creative media, not rebuilding the application. Preserve the confirmed event rules, four supported languages, Protocol Rebellion story and cyberpunk visual identity. Propose a coherent campaign and help produce posters, videos, a brochure and outreach copy. Use simple English and make the debugging gameplay clear. Ask for missing dates, registration details, prizes and approved branding before finalising publishable materials. Do not invent those facts. Treat suggested slogans and campaign formats as drafts. Never expose challenge answers, hidden tests, paid hint contents, credentials or private participant details. Distinguish game coins from any separately announced real prizes, and do not describe this as penetration testing or a real vulnerability-bounty programme.

The organiser may change campaign priorities and supply missing details in that chat. Changes to competition rules require an explicit decision; marketing copy should not silently create new mechanics.

## 2. Event identity and core pitch

| Field | Current information |
| --- | --- |
| Working event name | **INGENIUM — Bug Bounty**; repository name: Ingenium Bug Bounty. Confirm the final printed title/lockup. |
| Festival branding | **Tecnoesis**, displayed in the current application. |
| Institution/edition in the app | **NIT Silchar / 2026**. This is existing UI branding; confirm the official host credit, edition and logo usage before publication. |
| Event type | A gamified team programming and debugging competition. |
| Core task | Read a clear problem statement, inspect supplied buggy code, repair it and submit the corrected program for judging. |
| Team structure | Two registered members per team. Teammates can work on different questions. |
| Languages | **C, C++, Java and Python only.** JavaScript was removed from the event. |
| Audience | College students, including freshers through junior-year students; varied programming experience is expected. This is the design audience, not an approved restriction on other years or colleges. |
| Format | Two rounds: an approachable qualifier, followed by a harder shared-arena final with strategic items. |
| Delivery | Browser-based competition application with a coding workspace, animated cyberbugs, game coins and leaderboards. The physical venue and remote/on-campus participation policy are still unconfirmed. |
| Public launch status | Development and local testing exist; production deployment and final event sign-off remain pending. |

**Plain-English explanation:** Participants hunt cyberbugs representing broken programs. They open a mission, fix the supplied code and earn game coins for correct repairs. Round 1 builds their team's funds. Qualifiers then enter a shared Round 2 arena, where choosing a target, solving accurately and spending wisely all matter.

**Positioning:** Coding and debugging presented as a competitive game, with an accessible first round and a more demanding strategic final. The challenge comes from reasoning about code, not deciphering complicated English.

This is not a real-world security-testing event. There is no authorised attack on websites, college systems, participants' devices or networks. “Bugs,” “Black ICE” and “bounty” describe the fictional game and its mechanics. Coins are not cash, cryptocurrency or a promise of financial payment.

## 3. Confirmed competition format

| Feature | Round 1 — Qualifier | Round 2 — Final |
| --- | --- | --- |
| Team capacity | Up to 100 teams | At most 50 qualifying teams |
| Authored questions | 50 distinct logical questions | 100 distinct logical questions |
| Language versions | Equivalent versions in all four languages: 200 variants | Equivalent versions in all four languages: 400 variants |
| Arena | Four themed areas; each team has independent progress | One large shared arena: **The Kernel Breach** |
| Competition | Another team's solve does not remove your opportunity | Normally a race for the earliest eligible correct official submission received by the server; Claim Lock creates a specific protected exception |
| Difficulty | Introductory: 35 questions at 1–20, 10 at 21–30, 5 at 31–40 | Harder: 25–100 |
| Duration | Designed around a three-hour playing window; confirm the actual announced schedule | Not yet supplied for publicity |
| Wrong official submission | No automatic wrong-submission time penalty | Adds five minutes to the team's ranking time, not a five-minute lockout |
| Starting score | Zero | Separate score starting from zero |
| Game funds | Earn coins; hints cost coins | Unspent Round 1 coins carry over, and Round 2 solves earn more |
| Shop | No general item shop | Seven approved special items; see Section 7 |

The application lets organisers configure round durations. Three hours is the Round 1 authoring/pacing target, not evidence of the final published timetable. Do not announce a total event duration until both rounds and the interval are confirmed.

### Solving, language choice and fairness

- Each question provides a problem statement, a buggy starter program, public samples and three progressively stronger paid hints. Official judging also uses private test cases.
- Participants edit the starter rather than needing to invent and implement an entire program from scratch. **Reset code** restores the original starter after confirmation.
- Each member chooses their own language on entering a round. It stays fixed for that round; teammates may choose different languages. A new round allows a new choice.
- The four variants share the logical task, intended difficulty and bounty. A team earns a question's reward once, not four times for four languages or twice for two members.
- **Run** checks supplied samples without an official wrong-submission penalty. **Submit** enters official judging and scoring.
- Missions can be attempted in any order. Earlier answers and story discoveries are never prerequisites.
- Round 1 aims to let an ordinary two-member team solve at least 30 questions in three hours, with faster teams attempting all 50. This is an unverified design target, **not a promise to participants**.
- Intended language parity and difficulty ratings still need human pilot review. Do not claim experimentally proven fairness or guaranteed solve times.

### Ranking and qualification

Round 1 ranks teams by net points after hint spending, then lower cumulative solve time, then the solved-difficulty profile compared highest-first. Cumulative solve time adds each credited solve's elapsed time from the round start; it is not just the time of the last solve. At most the top 50 eligible teams advance. A fully tied group crossing that boundary uses one recorded draw for the remaining places.

Round 2 ranks teams by competition points, then cumulative solve time plus wrong-submission penalties, then the highest-first solved-difficulty profile. Round 1 score does not carry into this ranking. Fully tied finalists share a rank. Prize splitting or a separate playoff has not been agreed and must not be invented in publicity.

Infrastructure failures and correct solutions that lose a shared claim race do not incur a wrong-submission penalty. Server receipt order, not animation speed or judging completion order, establishes normal claim priority.

## 4. Story: Protocol Rebellion

**Confirmed premise:** A defensive AI, **AEGIS**, has classified its own human operators as intruders. Corrupted services and security controls now work against them. Contestants repair the broken systems to recover control before the AI's final containment protocol activates.

The story connects the missions without forcing a linear playthrough. Each question gives enough context to make sense alone. Recurring characters include **Mira, Patch and Ishan**. Do not create new canon, character artwork or major plot twists and present them as previously approved; new creative proposals can be reviewed separately.

Round 1 takes place across four parts of the compromised system. Round 2 continues inside AEGIS as **Protocol Rebellion: The Kernel Breach**, escalating from local repairs to a shared final confrontation.

Suggested narrative structure for publicity, not a new gameplay rule:

1. **Threat:** The system built to protect its operators has turned against them.
2. **Mission:** Find corrupted programs and repair their logic.
3. **Progress:** Earn coins and restore control across four sectors.
4. **Finale:** Qualify for the shared Kernel Breach arena and outthink rival teams.

Keep story lines short. A poster should still explain “fix buggy code” even if the viewer knows nothing about AEGIS. Never imply that questions unlock sequentially or that contestants must solve all 50 to advance.

## 5. Round 1 areas and distinctive imagery

These are the current names. Older names and abandoned map concepts should not appear in new materials.

| Area | Question domain | Background and creature identity | Signature weapon |
| --- | --- | --- | --- |
| **Neon District** | Arrays, strings and searching; 13 questions | Internal coding/circuit space, memory banks and corrupted signals. Magenta, cyan, violet and deep navy. Signal-swarm creatures with varied wings, legs, crawling motion and signal halos. | **Vector Lance** — paired rails charge a focused beam that dissolves the target into signal streaks. |
| **Silicon Hive** | Systems, memory and resource handling; 13 questions | Motherboard, copper traces, ports and animated encrypted-looking traffic. Armoured mechanical entities with wheels, jetpacks and heavier weapon-bearing forms. Amber/copper with technological light accents. | **Polarity Crusher** — magnetic piston jaws compress the chassis and scatter metal fragments. |
| **Verdant Nexus** | Graphs, trees and traversal; 12 questions | A living data network with branching pulses. Abstract cyber anomalies rather than a literal jungle; green/teal network identity. | **Graph Reaper** — linked anchor pods and travelling cutters split a target into branching streams. |
| **Zero-Day Core** | Logic, state and concurrency; 12 questions | Compromised memory, security countermeasures and intrusion entities. Dark hacker aesthetic with acid-lime signals and cold blue-grey armour. | **Nullpoint Cannon** — shutters contain the target, compress its fragments and close the remaining dark slit. |

The final Round 1 presentation uses four separate, large **pan-only** areas. It is not the abandoned connected forest/desert/ice world or a zoomable isometric city. Neon District's current direction is a dynamic internal coding environment, not a static skyline photo.

Bug silhouettes, size, movement and aura vary. Smaller, faster targets and larger, more imposing targets provide visual personality; displayed bounty and difficulty remain the authoritative values. Artwork must not imply that clicking difficulty, creature speed or catching skill changes the programming score.

## 6. Round 2 world and gameplay hooks

**The Kernel Breach** is a single large, pan-only mainframe arena built for 100 bugs, with processing cores, memory vaults, packet channels and firewall relays. The four question domains have 25 missions each, together in the same arena.

The authored difficulty allocation is 32 questions at 25–45, 36 at 46–65, 20 at 66–85 and 12 at 86–100. These are authoring ratings, not measured solve-time bands.

Creature identities include Packet Runner, Stack Crawler, Proxy Twin, Cipher Ray, Deadlock Walker, Fork Wraith, Cache Mimic and Rootkit Sentinel. Think corrupted software organisms: articulated armour, synthetic fins, linked nodes, segmented chassis and contained energy cores. They should look formidable and distinct, not like identical recoloured icons or cute toys.

Useful promotional hooks:

- You usually cannot tell which rival is working on the question you chose.
- Normal claims are shared: another team can win a bug before you do.
- Coins earned in the qualifier create spending choices in the final.
- The shop offers information, protection, cosmetic flair and a limited economic attack.
- Finding a balance between speed, accuracy and spending is part of the final.

Do not portray the map as a combat game where shooting earns points. Code repairs earn rewards; weapons are celebratory finishers.

## 7. Bounty economy, hints and approved special items

All amounts below are **in-game coins**, using a gold coin bearing a stylised Tecnoesis emblem. Real prizes, if any, are a separate unconfirmed announcement.

### Rewards and hints

- Round 1 bounty: **50 × difficulty**. The current authored pack offers 150–2,000 coins per question and 42,400 total before hint spending. This is a game-economy total, not a cash prize pool.
- Round 1 hint tiers cost an additional **10%, 30%, 40%** of the question's base bounty. Buying all three costs 80% in total. Solving credits the bounty once; spending reduces the team's net Round 1 result and remaining wallet.
- Only a qualifying team's **unspent** Round 1 wallet carries forward. Round 2 starts with zero competition points.
- Round 2 bounty: **10 × difficulty**, or 250–1,000 coins. Round 2 solves continue to fund purchases.
- Round 2 hint tiers cost an additional **10%, 30%, 80%**. A winning solve earns 100%, 90%, 70% or 50% of base competition points at assistance levels 0, 1, 2 or 3. Do not confuse a tier's purchase cost with its score multiplier.
- Round 2 wallet and score are different. Buying ordinary items does not itself deduct leaderboard points; assistance can reduce a particular winning solve's awarded points.

### Item catalogue — latest approved prices

| Item | Coins | Accurate description |
| --- | ---: | --- |
| **Boundary Probe** | 400 | One extra authored edge-case example for a question, never a hidden judging test. Activation counts as Hint 1 assistance. |
| **Hex Scanner** | 750 | Reveals a broad code section containing the fault, not the exact faulty line or a fix. Activation counts as Hint 2 assistance. |
| **Overdrive Core** | 500 | Cosmetic team aura, enhanced finishers and a glowing team name on leaderboards for the round. No score advantage. |
| **Ghost Scan** | 1,500 | For 15 seconds, highlights unclaimed bugs with **no rival activity detected**. Two-minute cooldown. Does not reveal identities, code or progress. |
| **Chrono Shield** | 2,500 | Protects a future official submission from the wrong-submission time penalty; the current preview applies it to the next admitted official submission. One use per team per round. |
| **Claim Lock** | 5,000 | Five minutes of protected scoring opportunity on a selected bug, even if another team claims it during that window. It does **not** block other teams. One use per team per round. |
| **Black ICE / Credit Freeze** | **15,000** | Freezes one opponent team's new shop and hint purchases for 30 minutes. One outgoing use per team per round; any target can be affected only once per round across all attackers. |

Boundary Probe, Hex Scanner and Claim Lock are bought into shared team inventory and activated later from a question's page. Claim Lock's five minutes begin on successful activation, not when bought. The other team's coding and normal opportunities continue; once protection expires, normal availability rules apply. Already earned rewards remain valid.

Black ICE does not stop coding, sample runs, official submissions, earning rewards, reading purchased hints or using already-owned items. It cannot stack or extend on the same target. Do not advertise it as kicking opponents out, disabling their computer, stealing coins or stopping their round clock.

Ghost Scan's wording matters: the app can detect activity signals, not guarantee that nobody is thinking about or working on a question elsewhere. Hex Scanner's reveal is deliberately broad and does not supply a solution. Assistance uses the highest relevant tier, not stacked point reductions.

**Implementation boundary:** This catalogue is approved, demonstrated in the preview and implemented in the durable application backend. Isolated database and browser checks cover shared inventory and competing teams. Production-host deployment, final content publication and participant balance review remain separate. Obtain organiser confirmation before publishing a shop feature as launch-ready. Chrono Shield protects the next admitted official submission.

## 8. What the experience looks and feels like

The approved direction is **neon cyberpunk with an internal-computer/hacker identity**: circuitry, data pulses, memory, processors, corrupted code and synthetic creatures. It should feel competitive and polished, not childish, muddy or like a generic corporate coding poster.

### Visual starting palette

These colours are taken from current regional UI accents; they are working art references, not an externally approved brand manual.

| Role | Reference |
| --- | --- |
| Deep navy background | `#060C22` |
| Neon magenta | `#FF4ED6` |
| Electric cyan | `#49E9FF` |
| Violet atmosphere | `#442460` |
| Silicon amber | `#FFC477` |
| Network green | `#A9F6A0` |
| Intrusion lime | `#B9FF4F` |
| Bounty accent | Metallic gold; use the existing Tecnoesis-stamped game coin as a reference |

Use strong hierarchy, a small number of bright accents and readable type. A monospaced accent can signal code, but body text, dates and registration instructions should remain easy to read. Avoid long all-caps paragraphs, tiny legal text, excessive glitch effects and glow behind important copy.

Modern game presentation is the reference, not a literal retro 8-bit requirement. Earlier forest/desert/ice proposals, Prism Cascade and generic neon skyline artwork were superseded. Clash of Clans screenshots were mood references only: do not copy its art, logos, interface or claim an affiliation. Use original event artwork and approved festival marks.

### Moments worth capturing for trailers and social media

1. A cyberbug roaming an animated circuit environment, with its difficulty and coin bounty visible.
2. A question opening into readable buggy code; a participant makes a repair.
3. A confirmed successful result and a two-second **+coins** reward popup.
4. The participant exits the editor and watches the region's weapon deploy and terminate the bug. The finisher waits for editor exit; it does not play unseen behind the code window.
5. Four visually different sectors, then the shared Kernel Breach final.
6. Strategic shop items, the Black Market circuit-mask identity and an Overdrive team-name glow.
7. A compact leaderboard showing leading teams and the participant team's own rank.

Show actual current UI or clearly labelled concept footage. Use staged teams and non-secret sample code. Never show an unreleased question's repair, a hidden test, a private ticket, an admin credential or a participant's personal details.

## 9. Public messaging and draft copy

The following are **suggestions**, not previously approved slogans or ready-to-publish announcements. Replace placeholders and obtain sign-off first.

### Useful message hierarchy

1. **What:** A team debugging competition with a game-like cyberpunk arena.
2. **Action:** Fix supplied buggy code; earn coins; qualify for the strategic final.
3. **Accessibility:** Two-member teams; C, C++, Java or Python; approachable qualifier.
4. **Urgency and logistics:** Actual date, registration deadline, venue and link, once confirmed.

### Draft tagline options

- **Fix the code. Break the rebellion.**
- **Two coders. One rogue AI.**
- **Hunt bugs. Earn bounty. Breach the core.**

“Hunt” is a visual metaphor; add “debugging competition” nearby so the activity is unambiguous.

### Short event description

> INGENIUM Bug Bounty turns debugging into a team challenge. Repair supplied buggy code in C, C++, Java or Python, earn game coins and take on the rogue AI AEGIS. Explore four sectors in an approachable qualifier, then race other finalists in The Kernel Breach, where accurate fixes and strategic spending shape the competition.

### Draft poster copy skeleton

```text
[APPROVED FESTIVAL / HOST LOGOS]
INGENIUM — BUG BOUNTY
Fix the code. Break the rebellion.

A gamified debugging competition for teams of two.
C • C++ • Java • Python
50 qualifier missions. A 100-question shared final.

[DATE]  |  [TIME + TIME ZONE]  |  [VENUE / PARTICIPATION MODE]
[CONFIRMED REAL PRIZES, IF ANNOUNCED]
Register by [DEADLINE]: [PUBLIC LINK / VERIFIED QR]
[FEE OR FREE ENTRY, ONLY WHEN CONFIRMED]
[ORGANISER CONTACT]
```

Counts refer to the authored pools, not a requirement to solve every question. Publish them only after confirming that those full pools are selected for the event. Do not add “win ₹42,400” or turn the shop's coin amounts into prize claims.

### Draft social caption

> AEGIS has locked out its own operators. Your way back in? Fix the code. Team up for INGENIUM Bug Bounty: a cyberpunk debugging competition with four languages, game coins and a strategic shared-arena final. [DATE / VENUE]. Register: [LINK]. Full rules: [LINK].

### PR angle

Lead with the student experience: a familiar programming skill turned into an original team competition. Explain the approachable qualifier, independent language choices and story-led interface. Use “debugging” before “hacker” in press-facing explanations. Claims about reach, past editions, originality awards, sponsors or institutional endorsement need evidence supplied by the organiser. Quotes require a named speaker's approval; do not invent testimonials.

## 10. Suggested media package for the next chat

These are proposed deliverables to choose and produce, not files already created. Sizes are convenient working canvases, not a claim about every platform's current upload specifications.

| Deliverable | What it should communicate |
| --- | --- |
| Main announcement poster | Event name, debugging concept, two-member teams, four languages, confirmed logistics, registration CTA and host branding. |
| Portrait social poster, e.g. 1080 × 1350 | One strong creature/circuit scene, readable hook and registration details. Avoid squeezing the rulebook into it. |
| Story/reel cover, e.g. 1080 × 1920 | Same identity with concise copy; leave room for interface overlays and readable captions. |
| Print poster, e.g. A3/A4 | Confirm printer bleed, resolution and colour requirements; verify the QR from a printed-size proof. |
| 15-second teaser | Rogue-AI hook, glimpse of bugs and code, event title, then registration CTA. |
| 30–45-second gameplay trailer | Show the complete bug → code repair → judged result → reward → visible finisher loop, then the strategic final. |
| 60–90-second explainer | Explain teams, languages, round difference, coins versus points and sample Run versus official Submit. Use captions. |
| Brochure / short PDF | What it is, story, who it is for, format, participant journey, key rules, schedule, prerequisites and registration/contact details. |
| FAQ carousel | Do I need advanced algorithms? Which languages? Do I write from scratch? What are coins? How do the rounds differ? Answer accurately without promising easy wins. |
| Outreach pack | A brief department/club announcement, email invitation, WhatsApp-sized message and an approved press note, all with the same verified CTA. |
| Reminder set | Registration opening, gameplay reveal, actual deadline reminder and event-day instructions. Use real dates and real availability only. |

### Suggested 30-second trailer structure

| Time | Visual | Message |
| --- | --- | --- |
| 0–4 s | AEGIS lockout / corrupted circuit pulse | “The system has turned against its operators.” |
| 4–10 s | Two-member team; bug opens into readable starter code | “Find the bug. Repair the code.” |
| 10–17 s | Successful result, coin popup, regional finisher | “Earn bounty. Restore control.” |
| 17–24 s | Four sector cuts, then the shared arena and item choices | “Qualify for The Kernel Breach.” |
| 24–30 s | Clear title card and confirmed logistics | “[DATE]. Teams of two. Register: [LINK].” |

Use original/licensed audio and artwork, readable captions and a version understandable without sound. Avoid rapid full-screen flashes. Do not make fake prize/score changes appear to be genuine gameplay evidence.

## 11. Missing information to collect before publication

No old development deadline or timestamp should be treated as the competition date. This file's date is its update date only.

| Required information | Status / placeholder |
| --- | --- |
| Approved printed event title and festival/department hierarchy | `[CONFIRM OFFICIAL NAME AND HOST CREDIT]` |
| Approved institution/festival logos and usage permissions | `[LOGO FILES / BRAND GUIDELINES]` |
| Event date, year and time zone | `[DATE / YEAR / TIME ZONE]` |
| Reporting time, start/end times, break and Round 2 duration | `[FULL SCHEDULE]`; Round 1 has a three-hour design target only |
| Venue, room, campus directions; physical/online participation policy | `[VENUE / MODE]` |
| Registration URL and final QR target | `[PUBLIC REGISTRATION LINK]` |
| Registration opening and closing date/time | `[REGISTRATION WINDOW]`; registration was intended to close one day before the competition, but actual dates are not confirmed |
| Entry fee or confirmed free entry | `[FEE / FREE]` |
| Real prize amounts, categories, sponsors and prize-tie policy | `[CONFIRMED PRIZES AND TERMS]`; game coins are separate |
| Eligibility, participating colleges/years and team formation rules | `[ELIGIBILITY]`; two members per team is confirmed |
| Actual participant cap and whether entries remain available | `[REGISTRATION CAP / AVAILABILITY]`; platform capacity is not proof of remaining seats |
| Equipment, power, network, browser and connectivity instructions | `[PARTICIPANT CHECKLIST]`; ask whether one laptop per member is required |
| Rules on external tools, AI assistance, internet/reference use and collaboration between teams | `[APPROVED CONDUCT / ASSISTANCE POLICY]`; do not invent an AI ban or permission |
| Organiser names, approved quotes, contact details and help desk | `[PUBLIC CONTACTS]` |
| Official social handles, publicity channels and approved hashtags | `[HANDLES / CHANNELS]` |
| Public event/rules link, accessibility accommodations and support process | `[PUBLIC INFORMATION LINKS]` |
| Media deadline, distribution plan, language needs, budget and approval owner | `[CAMPAIGN BRIEF]` |
| Current safe gameplay captures and approved recording consent | `[MEDIA ASSETS]` |

At the next chat's start, prioritise the event name, date, venue, registration link, prizes and requested first deliverable. Design drafts may use explicit placeholders while these are pending; publication must use verified details.

## 12. Internal readiness, assets and source notes

### What is ready versus what should not be promised yet

- Both authored question pools and local contestant previews exist. Statements use simple English, highlighted code names, readable starters and progressive hints.
- Current previews demonstrate maps, moving creatures, the editor, rewards, regional finishers, filters, leaderboards and the Round 2 shop.
- Production deployment has not been authorised. Durable shop enforcement is implemented and tested separately from the simulated preview; that preview is not proof that the live event judge and economy have been signed off.
- Human question review, participant pilot testing, difficulty/language calibration and production release checks remain separate from compiler and browser tests.
- Performance work adds compressed downloads, public-asset caching and lighter loading. Actual older-laptop and campus-network conditions are not yet certified. Do not advertise “zero lag,” a guaranteed frame rate or a verified minimum laptop specification.
- Brief connection losses can preserve loaded questions and edits while the tab stays open. Fresh judging, new purchases and unopened questions need a connection; refreshing/closing/crashing offline can lose unsaved edits. Do not claim a fully offline competition or backdated offline submissions.
- Participants can report a suspected question glitch for staff review. Organisers can make documented post-round score adjustments; a report does not automatically grant compensation or a solve.
- The current overall development estimate is roughly **96%** after the durable shop integration. It is an internal rough estimate, not an audited readiness measure or a publicity claim.

### Existing assets and local references

Repository location for a chat with local access: `D:\College\Ingenium\Bug bounty`.

| Reference | Purpose |
| --- | --- |
| `apps/web/public/graphics/tecnoesis-coin.svg` | Existing original game coin with stylised emblem. It is not a replacement for an approved official festival logo. |
| `apps/web/src/regions.ts` | Current region names, families, descriptions and palette references. |
| `apps/web/src/Entry.tsx`, `apps/web/src/ui.tsx` | Current entry-screen identity and branding. |
| `docs/local-preview.md` | Current local preview and access instructions; internal use only. |
| `docs/round-1-question-design.md` | Latest Round 1 counts, difficulty, rewards, audience and story decisions. |
| `docs/round-2-question-design.md` | Round 2 count, topics, story and authoring/validation boundaries. |
| `docs/round-2-items.md` | Approved item prices, protection/freeze limits and implementation status. |
| `docs/round-2-arena-design.md` | Shared-arena landmarks and creature identities. |
| `docs/regional-weapons.md`, `docs/bounty-coins.md` | Finisher names, visual sequences and reward behaviour. |
| `docs/participant-ui.md` | Current participant interaction and UI behaviour. |
| `docs/performance-and-reconnection.md` | Accurate performance and short-outage support limits. |
| `architecture.md` | Detailed competition, ranking, access and operational rules. Read its latest amendments alongside older sections. |

These are internal references, not links for registration posters. Do not put local preview addresses, demo access codes, admin routes or private repository URLs in public media. This brief deliberately does not include question solutions, hidden tests, passwords, keys or real registration records.

### Final consistency checks for every medium

- Four languages, two members, 50 Round 1 questions and 100 Round 2 questions; no obsolete JavaScript or five-language copy.
- Use current names: Neon District, Silicon Hive, Verdant Nexus, Zero-Day Core and The Kernel Breach.
- Distinguish real prizes, game coins, wallet balance and competition score.
- Black ICE costs **15,000 game coins**, not the superseded 20,000. Claim Lock is protected opportunity, not an exclusive lockout.
- Keep date, schedule, fee, prizes, eligibility and registration link consistent across poster, caption, brochure, video and QR.
- Verify any feature-specific promise against production sign-off before publication.
- Label concept art and staged demonstrations appropriately. Use original/approved assets and public-safe code.
- Keep the call to action visible and understandable. Do not rely on the lore to explain what participants actually do.
