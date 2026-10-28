# Round 2 arena: design proposal

28 October 2026. The user approved this environment and creature direction. The
Round 2 frontend and local item demonstration now implement it. Performance
measurements below do not establish old-hardware or production readiness.

## Confirmed requirements

- Round 2 uses one large, continuous shared arena instead of four separate maps.
- It must accommodate 100 active challenge bugs at once, with smooth exploration
  on ordinary laptops using integrated graphics and limited memory.
- Keep the established pan-only interaction; no zoom controls or player character.
- Preserve readable bounty differences, varied bodies and movement, avoidance,
  movement memory, list-to-bug navigation, readable information cards and the IDE.
- Bug-targeted shop items are held after purchase and activated on the question
  page. See [the updated item decision](round-2-items.md).
- Round 1's approved four-area frontend remains separate.

## Background: The Kernel Breach

Take Protocol Rebellion inside the rogue AI's mainframe. Build an explorable
circuit landscape, rather than a city or a flat wallpaper. A graphite floor
supports luminous cyan data channels, magenta security seams, acid-lime diagnostic
panels and occasional amber power relays. Bright channels and landmarks provide
colour; quiet spaces keep moving creatures and question cards readable.

The world is 4096 by 2560 logical pixels: four by four 1024x640 arena viewports.
All 100 authored bugs inhabit this world; the camera shows one portion. Smaller
viewports see a smaller portion at the same fixed scale, without zooming.
World coordinates remain stable when resizing the window. The final dimensions
must be tuned with 100 varied bodies, rather than shrinking bugs to fit them all
on screen. A small orientation map shows landmarks and the camera rectangle,
not a clutter of 100 clickable bugs; the target list can locate any available bug.

One continuous floor connects these landmarks, without separate district screens
or artificial category barriers:

- **Processing Core:** a central recessed processor with a slow rotating light
  ring and synchronised pulses. Keep its surrounding paths usable for hunting.
- **Memory Vaults:** raised memory banks, readable addresses and coloured buffer
  strips, with broad routes between them.
- **Packet Channels:** animated blocks of encrypted-looking data flowing between
  ports. Crossings connect both sides; data is decoration, not participant code.
- **Firewall Relays:** angular gate frames and short scan beams beside the paths,
  never a full-screen obstruction or flashing screen filter.

The background should move in small, deliberate places: packets travel, relays
blink, cooling grilles breathe and the core cycles. Avoid global fog, continuous
screen distortion, excessive bloom or hundreds of animated labels. Landmarks
should remain attractive with reduced motion enabled.

## Creatures

Make them corrupted software organisms with distinct silhouettes and articulated
parts. Their type is visual personality, not a new scoring or question rule.
Use several sizes within the roster, not the same model with different colours.

| Creature | Body and colours | Movement and identity |
| --- | --- | --- |
| Packet Runner | Small cyan dart with a white core and three swept plates | Quick forward bursts, short braking pauses, plates fold back during acceleration. |
| Stack Crawler | Long amber-and-black chain of flat armoured segments | Slow travelling compression along its direction of movement; each segment follows the preceding segment through turns. |
| Proxy Twin | Two unequal violet nodes linked by a thin tether | Both orbit one shared centre while travelling; one selectable creature and one question. |
| Cipher Ray | Broad translucent magenta fins around a narrow dark spine | Smooth gliding arcs; fins flex and bank with turns, with a ground shadow showing height. |
| Deadlock Walker | Low crimson chassis with four substantial jointed limbs | Deliberate alternating steps, feet planted during the supporting phase, body weight shifting before a turn. |
| Fork Wraith | Lean lime spearhead with two trailing fractured shells | Bursts followed by a short rest; a small fading afterimage suggests duplication without creating extra targets. |
| Cache Mimic | Blue-black folded hexagonal shell with a bright orange inner mechanism | Compact rolling travel; unfolds its plates when it stops, with clear body orientation. |
| Rootkit Sentinel | Large ivory-and-black armoured carrier with a suspended red kernel | Slow heavy movement, turning before travelling, with rotating restraint rings and a restrained ground field. |

Low-bounty creatures tend to be smaller and brisk. Higher bounties have visibly
larger silhouettes and stronger, bounded aura marks. Exact coin values remain
readable in the information card. Do not change a challenge's reward, supported
languages or difficulty based on its creature skin. Small targets retain generous
selection areas, and the target list offers a reliable way to locate them.

Reuse the existing hold while inspecting a bug, collision avoidance, deferred
finisher after leaving the IDE, and memory across navigation. Animation must
follow actual travel: no sideways crawling, sliding planted feet or limbs that
move like wings. Cosmetic movement does not expose rival activity; Ghost Scan
remains the permitted way to see that information.

## Rendering approach and checks

The separate Round 2 renderer combines a cached scenery canvas, a transparent
effects canvas and browser-positioned creature pose sheets. It retains the
2D/2.5D look without a live 3D scene. Scenery uses 512px tiles (at most 48
allocated, normally far fewer) and only repaints when the camera or viewport
changes. Deck bevels, fasteners, cable trunks, recessed chips, vents and the five
distinct mainframe modules are cached along with their lighting. Resolution is
capped at 1.25 device pixels per logical pixel; there is no full-world bitmap.

Steering runs at a fixed 20 Hz. Positions, heading and distance-driven gait are
interpolated between those updates, with presentation capped at 60 FPS. Most
armoured bodies reuse generated 128px pose sheets; the walker has 48 poses and
other articulated families use 32. The total cache stays below 256 poses, shared
across the 100 targets. Only visible creatures receive presentation work. The
crawler remains a live drawing so its segments can follow the actual travelled
path. Packets, auras and that drawing update at up to 30 Hz on their separate
layer. Offscreen bugs retain movement and collision state; panning does not reset
their positions. The renderer stops behind the IDE and in hidden tabs.

Use one animation clock, bounded effects and nearby-neighbour avoidance rather
than adding an animation loop or testing every possible pair for each creature.
The shared server must own challenge availability, item use, claims and awards;
continuous decorative animation should not require 100 movement broadcasts per
frame. Exact synchronisation of decorative positions is not assumed by this
proposal and needs a separate decision if it is wanted.

Performance targets are requirements to measure, not promises from the artwork:

- Exercise 100 mixed-size bugs, panning and selection on a 1280x720 viewport.
- Aim for stable roughly 30 FPS in the lightweight mode on older integrated
  graphics; confirm with an actual available low-end laptop before making a
  hardware support claim. A desktop throttling check is not equivalent evidence.
- Check the crowded viewport, not just bugs spread offscreen: labels, auras,
  packet effects, collision avoidance and a finisher have bounded workloads.
- Confirm retained positions, correct target selection and inventory activation
  during shared updates, reconnects and teammate actions.
- Support reduced motion and avoid continuous scene rendering behind the IDE or
  in a hidden tab. Exact live effects must still expire from authoritative time.

## Implementation status

The Round 2 frontend now has the single pan-only map, orientation map without bug
markers, eight creature families, full-world roaming, list-to-bug cards, direct
selection and a deferred quarantine/disintegration finisher. Scenery packets and
core rings animate; creature parts articulate. Offscreen bodies retain state and
avoidance while only visible bodies are drawn. Navigation and viewport changes
do not reset positions; a full reload starts a fresh visual simulation. Hidden
tabs and an open IDE do not paint the arena. Reduced motion retains panning and
selection with the ordinary scenery and creatures still.

The preview now supplies the [100 authored Round 2 missions](round-2-question-design.md)
from `content/round-2`, replacing the repeated Round 1 practice missions. There
are 25 questions per topic, difficulty 25–100, with equivalent C, C++, Java and
Python variants. The public map receives only safe question metadata. Hidden
tests, references and paid clue material stay private. No real challenge
publication or cloud deployment was made. See [local startup and item use](round-2-items.md#review-the-local-shop).

Round 2 visual rarity follows the new difficulty bands: Common through 450
coins, Enhanced from 460, Elite from 660 and Apex from 860. These are rendering
thresholds; rewards stay at ten times difficulty. The same thresholds drive the
legend and creature auras/sizes.

Checks cover all eight bodies, sizes, bounty auras, 100-body bounds/clearance,
retained positions, fixed-world camera clamping, held-item activation and receipt
recovery. Browser checks exercise the real renderer, navigation, shop and IDE;
desktop CPU throttling is only a local rendering probe. An actual older laptop,
production multi-team item enforcement, human approval of the authored pack and live-load
verification remain outside this local frontend milestone.

The local 1440x1000 headless probe applies 4x CPU throttling, retains 100 actors
and pans through the arena. It records actual visible bodies, cached tiles,
frame work and presentation rate in `apps/web/test-results/kernel-render-budget.json`,
with a median above 20 FPS required to pass. This is a regression check for that
viewport and machine, not evidence of 100 simultaneously drawn creatures or an
old laptop. A separate browser assertion checks that body positions continue to
change between physics ticks. Unchanged target-list elements are retained across
HUD clock ticks. Real integrated-graphics calibration remains required.
