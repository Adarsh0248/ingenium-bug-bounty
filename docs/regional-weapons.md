# Regional termination weapons

Each region has a dedicated weapon and finishing sequence:

| Region | Weapon | Sequence |
| --- | --- | --- |
| Neon District | Vector Lance | Housing deploys, paired rails align and charge, a focused beam scans the target into a signal silhouette, and vertical streaks disperse before retraction |
| Silicon Hive | Polarity Crusher | Two piston housings deploy, magnetic jaws close around the chassis, its body compresses, and bounded metal fragments scatter and fall as the jaws withdraw |
| Verdant Nexus | Graph Reaper | Three anchor pods connect to the target, cutters travel down the links in sequence, and the silhouette separates into three branching fragment streams |
| Zero-Day Core | Nullpoint Cannon | A containment cannon deploys, four mechanical shutters converge, the target and orbiting fragments compress inward, and the remaining dark slit closes |

All weapons have directly drawn metallic housings, labels, vents, illuminated
components and articulated moving parts. A shared acquisition reticle and twelve
charge cells communicate deployment and charge. The target uses its actual
creature art for the fading scan silhouette; wings fold and the model reacts to
the selected weapon. The target's old position remains the focus of the camera.

The sequence lasts 5.5 seconds for Common targets and up to 6.1 seconds for Apex.
Higher tiers add a longer finishing window and additional debris. There is one
active sequence at a time, followed by retraction. A visible status panel names
the weapon and shows its phase and progress. Regional navigation, panning and
new question entry are held while the sequence plays.
On small screens, the target list and navigation temporarily yield their space
to the finish and return when it completes.

## Award and accessibility behaviour

- Only an acknowledged bounty award queues a sequence. Animation does not award
  or deduct points and does not submit or execute code.
- While the workbench is open, the sequence stays queued. Closing it reveals
  the full target region and starts the weapon; reopening a cleared question
  after completion does not replay it.
- Reduced-motion or reduced-target-motion users receive a compact, readable
  confirmation without the moving weapon, beam or debris.
- Weapon geometry ignores pointer hits. Decorative effects do not alter bug
  collisions, other targets or the saved question/capture records.
- Completion has a bounded timeout fallback so a failed visual cannot leave
  navigation locked indefinitely.

## Rendering and verification

Twelve weapon textures are cached by region/part. The target scan texture is
created once per sequence and disposed afterwards. Twelve charge cells and at
most 28 debris fragments use instanced draws; no dynamic lights or particle
library were added. Rendering cost is limited to the single active sequence.

Unit checks cover phase order, bounded continuous timing, rarity and distinct
target reactions. Browser checks inspect real weapon components, deployment
after IDE exit, charge/impact screenshots, target compression and removal,
cleared-question review without a second award, and the compact mobile
reduced-motion path. Physical old-laptop frame rates remain unmeasured.
