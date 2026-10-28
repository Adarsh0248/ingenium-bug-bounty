# Bug movement and world navigation

Each participant arena keeps movement memory by bounty ID: world position,
heading, velocity, current destination, rests and travelled gait distance. A
region switch does not recreate this state or reset its visible creature poses.
Visited creature models stay mounted but hidden and paused outside their region.
Unvisited regions do not load creature models. A full reload or sign-out starts
a new visual simulation; this memory does not replace server capture records.

## Steering and collision avoidance

Bugs choose independent seeded destinations across their entire region. Their
family and individual pace control speed, turning and acceleration. They slow
near a destination, rest briefly and choose a fresh destination. Translation
follows the body's heading rather than sliding sideways while turning.

The simulation predicts nearby motion and steers around other bodies, including
hovered or frozen bugs. A clearance brake reserves room between physical body
footprints. Larger and longer bodies receive larger clearance; decorative auras,
trails and text labels are not solid objects. Overcrowded initial positions are
placed into available space before rendering. Compact viewports reduce drawing
scale and collision footprints together. Camera panning does not change gait
distance or physical positions.

Pointer selection uses the nearest creature footprint in the current region.
Transparent corners of a neighbouring drawing cannot steal its hover or click.

Only the visible region simulates movement. Pause, reduced motion, an open
workbench and hover retain their existing holds. Deferred termination uses the
stored actual position and can bring the target's full region into view.

## World map

The four overview tiles show animated scenery, category information and active
counts. They do not draw or accept clicks on bugs. The entire tile is one
keyboard-accessible navigation button. Clicking it opens that full region;
it does not capture a bounty or open the workbench. The target list remains an
alternative way to open questions. The hidden 3D layer uses demand rendering on
the overview, so it does not run a continuous creature animation loop there.

## Verification

Pure simulation checks cover thirty mixed bodies, head-on encounters, passing a
held body, forward-aligned travel, boundary limits, unchanged snapshot/capture
reconciliation, region changes and responsive layout. All four real creature
families are checked with thirty footprints at a compact 320x568 viewport.
Browser checks inspect actual actor state and rendered poses across navigation,
collision clearance, full-tile mouse/keyboard entry and the absence of accidental
capture requests. These checks do not measure frame rates on an actual old laptop.
