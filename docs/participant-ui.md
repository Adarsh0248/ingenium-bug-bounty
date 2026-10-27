# Participant Interface

The first connected participant interface lives in `apps/web`. It includes common
code entry, the registered member/language step, session restoration and browser
replacement, the restored four-area pixel arena with separate region navigation, live/minimisable HUD, keyboard target
navigator, standings and the private code workbench. This is not a production
deployment or the complete staff console. No cloud or Git operation is included.

## How The Pieces Fit

- **React/TypeScript** renders forms and views. It does not decide scores, claims,
  eligibility, language locks or financial effects.
- **Three.js/React Three Fiber** draws articulated mechanical crawlers moving
  through a neon circuit-city/codebase. Difficulty changes their accent colour;
  committed availability changes their state. Live own-team awards carry their
  bounty ID into a presentation queue: the aimed weapon/burst plays only after
  the IDE closes, without delaying the actual server award. Replay/duplicate
  awards never trigger a new win. Cleared targets remain marked read-only in the
  navigator; their retained code can still be inspected.
  Graphics are independent of code buffers. The hidden scene pauses while editing.
  Reduced motion uses demand rendering and a static post-IDE confirmation;
  the same keyboard-accessible target navigator works without a functioning canvas.
- **Monaco** edits program text, with a plain-text alternative. Its worker and
  language assets are bundled locally, not fetched from a participant runtime CDN.
- **Vite** serves/transforms the local UI and builds static production assets.
  It is not the trusted API or a replacement for PostgreSQL.
- The existing browser-independent **live and draft controllers** remain the
  owners of replay/reconnect and conditional autosave behaviour. The frontend
  imports those pure modules rather than implementing different competition rules.

This pairing follows the [React Three Fiber version guidance](https://r3f.docs.pmnd.rs/getting-started/introduction).
Monaco uses its installed package's exported ESM paths and a local worker, as in
the [official worker integration](https://github.com/microsoft/monaco-editor/blob/main/samples/browser-esm-vite-react/src/userWorker.ts).

## Local Visual Preview

To review contestants alongside the working admin control room, use
`npm.cmd run preview:app` and the [local preview guide](local-preview.md).
Both roles use port 5175 in separate browser profiles, with a temporary demo
database and simulated judging. The lighter participant-only mode below remains
independent on port 5174.

From the repository root:

```powershell
npm.cmd run preview:participant
```

Open the printed loopback URL, normally `http://127.0.0.1:5174`. The **preview-only**
team code is:

```text
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

This separate test server holds synthetic teams/state in memory and displays a
permanent preview label. Its canned execution feedback does not compile or run
code. It never connects to the project database or judge and is not imported by
the production build. Restarting it clears its synthetic state. Do not use real
team codes or sensitive source in this preview.

The default demo has **40 dummy bugs: ten in each region**. Every region includes
all six creature families and Common, Rare, Elite and Apex bounties. Foundry also
includes small unarmed scouts, pulse cannons and heavy siege bots. Questions use
the same dummy addition exercise; these are visual-review fixtures, not event content.

Each confirmed entry starts a fresh two-hour synthetic round and session window,
independent of when the preview server was launched. If the demo timer has run
out, sign out and enter again; saved practice drafts survive re-entry while the
server stays running. Restarting the preview still clears its in-memory state.
An aged-round browser regression checks both map and target-list question entry,
loaded statement/starter code, and saved draft recovery after re-entry. Real
competition deadlines and permissions are unchanged.

## Normal Frontend

```powershell
npm.cmd run dev:web
```

The normal development UI is at the printed URL, normally
`http://127.0.0.1:5173`. `/api` and the WebSocket path proxy to the separately
configured local API on `127.0.0.1:3000`. The API's reviewed browser origin must
match the visible frontend origin exactly. Changing a port is not permission to
weaken Origin/CSRF checks. See the existing protected entry/runtime handoff;
normal API startup still refuses to enable entry/judging without its dependencies.
An unavailable real API shows an unavailable screen, never silent fake gameplay.

`npm.cmd run build` now builds both API and web workspaces. Serve `apps/web/dist`
and proxy `/api/v1` plus its WebSocket upgrades through the same reviewed HTTPS
origin. No Site registration, public hosting, production migration or credentials
are created here. The production HTML includes a restrictive self-hosted script/
worker policy; HTTP transport/frame/backup/runtime installation gates remain.

## Privacy And Recovery

- HttpOnly credentials stay in cookies, never URLs or browser storage. Audience
  CSRF tokens live in memory. Fetches are same-origin, no-store and bounded;
  malformed or interrupted responses do not imply success.
- Entry restores an existing grant before attempting member selection. A valid
  team code exposes only that team's registered members. The server chooses
  staff versus participant routing and authorises language enrolment.
- Editor buffers stay private per member-round/bounty in tab memory. Deliberate
  sign-out warns about dirty or unresolved work. Revoked access unmounts the
  private interface and clears its workspace. Browser closure warnings remain
  best effort, not a persistence guarantee.
- Draft revision conflicts require review. Pauses and claims retain code. New
  gameplay is disabled while live state is stale; no offline Run/Submit is queued.
  Run/Submit captures the actual current editor source, not a previous autosave.
- Unknown action replies retain the original key and payload across target
  navigation. Outcome recovery is GET-only, with no automatic new POST. A known
  domain refusal is distinct from transport uncertainty.
- Sample runs, official attempts and paid hints are distinct actions. Hint levels
  unlock sequentially; purchased text is fetched from the protected endpoint.
  Prices in the confirmation are explanatory; the backend still owns the debit.
- Run shows `Scanning samples` with pending-slot counts; Submit shows
  `Validating fix` until the official outcome. Live jobs, admission and feedback
  preserve these indicators across target navigation. Two pending sample runs
  are still allowed; one official attempt per team/bug remains enforced. A
  successful sample scan is not a cleared bounty. Unknown receipts/recovery
  holds are labelled separately, never presented as a successful verdict.
- Statements, sample/compiler output and historical source render as text, never
  executable HTML. The patched DOMPurify dependency is pinned for Monaco; see
  the [upstream advisory](https://github.com/advisories/GHSA-6688-9rhm-gjv2).

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:browser:db
```

The browser suite requires the matching Playwright Chromium installation. Its
twelve scenarios cover entry/restoration, actual Monaco keyboard editing, autosave/navigation, runs/hints,
pause/claim gates, competing revisions, HTML safety, lost replies, revocation,
responsive screenshots and actual canvas-pixel/motion checks at desktop/mobile
sizes, pending scans across IDE navigation, two sample slots, post-IDE termination
without replay, cleared read-only inspection and reduced-motion confirmation.
Screenshots and traces are ignored generated output in
`apps/web/test-results`, not committed participant data.

`test:browser:db` additionally opens the real React app with the actual Fastify
cookies/CSRF, Socket.IO and disposable PostgreSQL fixtures. It verifies private
save, live pause/resume and reload restoration without the visual preview API.
Only synthetic teams, clock/readiness and runner authorities are used. It never
reads environment secrets, migrates the development database or executes source.

## Remaining Required Work

The full staff management/authoring/operations console, complete results/history
navigation and session recovery edge coverage still need implementation/testing.
The staff entry currently ends at a protected identity/sign-out shell, not a
finished admin panel. No requested staff feature is removed by that ordering.

Real judge installation and retirement authority, runtime supervision/retention,
whole-app storage reservations, HTTPS/proxy installation, backups/restoration,
real-device graphics calibration, accessibility audit and 100-team capacity/
reconnect testing remain launch gates. Monaco and Three.js are lazy-loaded but
their sizeable bundles still require real-network/performance rehearsal.

Map categories, team captures, controls, artwork provenance and checks are documented in [neon-art-direction.md](neon-art-direction.md).

Focused regions support drag or scroll to pan, plus directional buttons and Centre. Each world spans four viewport widths and four viewport heights with room for 30 bugs; only one viewport-sized section is visible. Map scale stays fixed, with no zoom controls. Changing regions retains its view. The four-area overview and the existing competition rules are preserved.

Regions mix six creature types, with independent destinations across the whole region and individual speeds. [Silicon Hive](ember-foundry.md) uses armoured wheeled chassis and jetpack flyers on an animated motherboard. [Verdant Nexus](verdant-nexus.md) uses six geometric cyber-anomalies with articulated panels, rings and memory segments over a branching data-pulse network. [Zero-Day Core](zero-day-core.md) is a breached security mainframe with black glass, active memory channels and six mechanical intrusion entities. Neon retains its own insect movement. Bugs start spread out but are not confined to their initial patches. Journeys scale with map size, rest durations stay short, and bugs remain inside their category's region. The camera brings an off-screen cleared bug into view for its deferred termination. Common/Rare/Elite/Apex appearance is tied to the displayed base bounty, with regional auras from 400 CR upward. The target list shows both movement type and rarity in text. Hover and reduced motion keep selection accessible; these visuals do not change question or scoring rules.

The world overview now contains scenery-only navigation tiles: click anywhere on a tile to enter its full area, with no capture or question opening on the miniature. Bugs use shared size-aware steering and keep their positions and animation memory across region changes. See [bug movement and navigation](bug-movement.md) for collision behaviour and memory scope.

Ground creatures turn to face their path before moving. Jointed legs use a distance-driven planted-foot gait, while crawlers contract along their forward axis. Wing flapping is independent of leg motion. Hover and motion controls freeze the current pose.

Neon District's background is a dynamic 2D runtime/circuit world: memory banks, code traces, processor blocks and moving data packets in cyan, pink and violet. It uses directly drawn geometry rather than a city backdrop image. The existing fixed-scale panning and motion controls apply to this scenery.
