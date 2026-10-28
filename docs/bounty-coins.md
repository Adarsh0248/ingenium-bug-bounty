# Bounty coins

Bounty values in the target list, workbench header and wallet now use an original
gold SVG coin. Its stamped three-panel mark is a simplified vector interpretation
of the [Tecnoesis emblem](https://tecnoesis.co.in/TecnoLogoFull.png), referenced from
the [official event site](https://tecnoesis.co.in/). The coin is served locally;
there are no external image requests during play.

A fresh, confirmed team award shows a non-blocking reward for 2,000 ms, including
while the workbench is open. The popup displays `+amount coins` and the question
title. Its arrangement follows the existing bounty bands:

| Amount | Arrangement |
| --- | --- |
| Below 400 | Single coin |
| 400–699 | Small pile |
| 700–899 | Stack |
| 900 and above | Heap of stacks and loose coins |

The amount is the frozen base bounty, which is the existing server settlement's
wallet credit. Hint discounts affect round points separately. This presentation
does not create rewards, adjust scores or derive earnings from wallet differences.
The existing live client deduplicates award IDs and suppresses historical replay.
Queued notifications each receive their own two-second window; round cancellation
clears pending rewards. Sample runs, rejected fixes and another team's claim do
not create a reward popup. Weapon sequences wait for workbench exit and the
coin popup to finish, so the reward cannot obscure their charge-up.

Reduced-motion users receive the same two-second confirmation without movement.
At most fourteen cached SVG images are displayed in one notification. Unit checks
cover all four layouts; browser checks cover timing, earned amount, replay,
sample/claim exclusions and mobile reduced-motion presentation.
