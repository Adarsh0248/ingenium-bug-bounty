# Locating a bounty from the list

Selecting an unsolved entry switches to its region, pans the map to its saved
current position and shows an information card anchored above the creature.
Only that creature pauses. The card includes the title, gold-coin bounty,
difficulty, region/category, creature identity, rarity, movement and a bounded
first-paragraph preview from the existing authenticated statement reader.

Selecting the list does not capture a bug, load private code, send editor presence
or submit code. Choose **Open question**, or click the located creature, to use
the existing capture and workbench flow. Captured but unsolved entries still use
the card. Solved entries continue opening the retained workbench directly.

Close the card or press Escape to resume roaming and return keyboard focus to the
list. Manual panning and region navigation also dismiss it. Reselecting an entry
locates the current creature again. A live claim or round cancellation removes
the card. Opening a question respects existing pause, round and capture gates.

The card flips below a target near the top map edge and keeps its action inside
the viewport. On smaller screens the target list temporarily yields space; the
card body scrolls when necessary. The close and open buttons remain available.
If WebGL is unavailable, a positioned DOM card and keyboard action still work.

Preview failures have an independent retry button and do not prevent attempting
to open the question. Late responses for dismissed cards are ignored. Statements
render as text; no HTML or hidden-case data is included in the card.

Unit checks cover bounded previews and card geometry. Browser checks cover the
four regions, no capture on list selection, selected-creature pause, both opening
actions, mobile/keyboard focus, preview failure/races, live claims and the graphics
fallback. Physical older-laptop performance remains unmeasured.
