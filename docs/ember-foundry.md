# Silicon Hive: motherboard and armoured fleet

Silicon Hive is a directly drawn 2D motherboard in dark PCB green, copper,
graphite and amber. It retains the SYSTEMS question category, its separate
four-by-four panning map, existing rarity/bounty rules and full-region roaming.
Neon, Verdant and Cryo keep their own creature/scenery designs.

## Board scenery

`FoundryBoard.tsx` draws memory modules, I/O headers, power capacitors, PCIe slots,
network ports and a central processor cooler. Its layout reuses the bounded
circuit layout through `foundry-circuit.ts`, with at most 48 peripheral modules,
fourteen background bus routes and twelve active port-to-port connections.
Each active trace starts/ends on a module's visible connector. Small hex packets
travel along these traces; processor fan blades turn and selected status LEDs
pulse. Hex/AES labels are decorative encrypted-traffic imagery, not a claim that
this SVG performs encryption or displays actual participant traffic.

The scene fills the actual world dimensions, keeping components at readable
sizes while panning. It uses SVG/CSS, without a background bitmap, video, glow
filters or remote asset downloads. Reduced motion, the manual motion toggle and
workbench entry pause the traffic, fan and LEDs.

## Mechanical creatures

`foundry-creatures.ts` paints six original armoured chassis, reused by the map
and target-list portraits. `FoundryCreature.tsx` replaces organic legs/wings in
this region only:

| Existing motion identity | Foundry species   | Design                                         |
| ------------------------ | ----------------- | ---------------------------------------------- |
| FLY                      | Ion orb           | Round teal optical drone with twin jets        |
| WALK                     | Magma dozer       | Wide crimson four-wheel hull and hazard blade  |
| HOP                      | Volt buggy        | Yellow open-frame four-wheel chassis           |
| SKITTER                  | Phase interceptor | Violet six-wheel hex chassis and energy core   |
| DRAG                     | Bastion carrier   | Olive/ivory eight-wheel cab and cargo sections |
| DART                     | Azure dart        | Blue/white split hull with twin jet thrusters  |

Wheel rotation follows distance travelled, and left/right wheels counter-rotate
when turning in place. Axles connect the wheels to the chassis. Separate tyre
and tread instances keep wheel centres fixed and bound the drawing work. The
armoured body does not stretch like an organic crawler. Jet exhaust pulses from
fixed nozzle anchors instead of flapping. Hover, manual pause and reduced motion
hold the current wheel/jet pose.

There are six shared body textures and two jet textures, each 256 × 256. Wheel
geometry is shared, and tyre/tread drawing is instanced. Static portraits use
the same cached artwork. Each family has its own silhouette and paint palette.
Foundry size and cruise pace follow the actual frozen base bounty. Low-value
scouts are visibly smaller and faster; valuable machines are larger and slower.
The family size multiplier adds silhouette variety without removing that bounty
progression. The same chassis at 1000 CR is over four times the scale of its
100-CR version. Other regions keep their previous size/speed rules.

| Bounty      | Scale before family multiplier | Armament              |
| ----------- | ------------------------------ | --------------------- |
| 10–390 CR   | 0.38–0.60                      | None; quick scouts    |
| 400–690 CR  | 0.78–0.96                      | None; medium machines |
| 700–890 CR  | 1.14–1.38                      | Mounted pulse cannon  |
| 900–1000 CR | 1.70–1.95                      | Twin siege cannons    |

Selection rings, label offsets and regional auras accommodate the different
footprints. Larger bots get a larger edge inset to keep their hulls inside the
board. Portraits show relative size and the appropriate mounted weapon too.
Category, capture, question difficulty, actual bounty, judging and scoring are
unchanged; language does not change the creature or its value.

## Cosmetic weapons

`FoundryWeapon.tsx` adds a rotating mount, barrel recoil, muzzle flash, travelling
shot and a short expanding impact ring for armed units. Cycles are staggered
between bots, with one active shot per unit. Shot frames are anchored to the
motherboard and adjusted for panning, so impacts do not follow a roaming bot.
Shots land inside the region's bounds and do not receive pointer hits. The
overview keeps the mounted weapons visible without firing effects; opening a
region enables their animation. Hover, reduced motion, manual pause and opening
the workbench hold their current pose.

These shots are presentation only: they do not damage questions, charge anyone,
change standings or create an execution/submission. Weapons use small primitive
geometry and existing palette colours, with no added lights or post-processing.

## Review and checks

Use `npm.cmd run preview:participant` on 5174 for a quick visual review, or
`npm.cmd run preview:app` on 5175 for the admin/contestant preview. Select
**Silicon Hive**. See [the local app guide](../LOCAL-APP-GUIDE.md) for entry,
startup and shutdown commands.

The Foundry tests cover six cached designs, actual port endpoints, bounded
scenery, wheel counts/distance/steering, rigid armour, visible rendered wheel/jet
animation, pause/hover, desktop/mobile rendering and opening a real question in
the synthetic preview. Generated galleries/screenshots are under
`apps/web/test-results`. These checks do not establish frame rate on old physical
laptops or real-event capacity.

Verification for this pass: 40 frontend unit checks, twelve browser scenarios,
production type/build and bundle-policy checks passed. This includes the two
Foundry scenarios plus cross-region navigation, panning, full-region roaming,
deferred termination, Neon/organic creature motion and expired-demo re-entry.
Desktop/mobile screenshots and the six-robot gallery were inspected.

The subsequent bounty-variety/armament pass passed 42 unit checks, thirteen
browser scenarios, production type/build and bundle policy. The gallery uses
actual bounty-based scene scales instead of normalising all six bots to the same
size. Checks compare the same chassis at low/high bounty, inspect real rendered
scale differences, and observe muzzle flash, recoil, projectile and ground-level
impact. Impacts remain anchored while the bot moves and track map panning;
pause/hover and question opening remain covered. Physical old-laptop performance
is still unmeasured.
