# Protocol Rebellion — Round 2

Private organiser content. Never copy this directory into public assets.

100 independent debugging missions in The Kernel Breach, with 25 per topic and four equivalent language variants: C, C++, Java and Python. There are 32 questions at 25–45, 36 at 46–65, 20 at 66–85 and 12 at 86–100. Ratings are authoring targets, not measured pilot difficulty.

Each mission provides a plain-English incident, exact expected behaviour, buggy program, code-reading guide, two samples, at least six hidden tests and three progressive hints. Bounty remains 10 × difficulty (250–1,000 coins). Round 2's additional hint costs stay 10%, 30%, 80%, with winning score multipliers 90%, 70%, 50%. No scoring or shop rule is changed by the pack.

Use the [question book](questions.md) for review and [validation summary](validation-summary.json) for exact local check scope. Local compiler checks do not publish questions or verify the production judge. Organiser review, language-fairness pilots and protected publication validation are still required.

Rebuild: `npm.cmd run content:round2:build`. Authored bodies keep explicit four-space blocks and one statement per line; no external formatter is required. Verify all organiser-authored programs: `npm.cmd run content:round2:verify` (GCC, G++, Java and Python required). Detailed reports and temporary binaries go under ignored `apps/api/test-results/round2-validation/`.

| # | Topic | Mission | Difficulty | Bounty | Private defect |
| --- | --- | --- | ---: | ---: | --- |
| 1 | ARRAYS | Checkpoint Ledger | 25 | 250 | The prefix subtraction stops before l - 1 instead of before l, including an extra reading. |
| 2 | ARRAYS | Balanced Repair Bay | 30 | 300 | The current value is removed from the right total after comparing, so the comparison includes it. |
| 3 | ARRAYS | Dark-Pixel Budget | 38 | 380 | The shrinking threshold permits k + 1 dark pixels instead of k. |
| 4 | ARRAYS | Rescue Phrase | 45 | 450 | Removing a surplus copy increases missing even though the required count is still present. |
| 5 | ARRAYS | Zero-Length Phantom | 42 | 420 | The current prefix is inserted before querying, allowing it to pair with itself when target is zero. |
| 6 | ARRAYS | Duplicate Address Band | 35 | 350 | The upper-bound search moves right only for values below x, so it duplicates the lower-bound search. |
| 7 | ARRAYS | Sealed Corridor Coverage | 40 | 400 | Merging assigns the latest interval end instead of retaining the furthest end. |
| 8 | ARRAYS | Echo Pair Collapse | 36 | 360 | The pop removes two stack entries although the incoming matching letter was never pushed. |
| 9 | ARRAYS | Rotated Vault Index | 48 | 480 | When middle and right values tie, the search discards the left endpoint even though only the right endpoint is proven redundant. |
| 10 | ARRAYS | Moving Threat Ceiling | 56 | 560 | The deque expiration check retains the position exactly one step before the current window. |
| 11 | ARRAYS | Cooling Alarm Horizon | 51 | 510 | The stack resolves equal temperatures even though only a strictly higher reading is eligible. |
| 12 | ARRAYS | Coolant Between Walls | 55 | 550 | The suffix maximum is replaced with the neighboring raw height instead of the neighboring suffix maximum. A zero sentinel after the input keeps that faulty access bounded. |
| 13 | ARRAYS | Maintenance Slot Picker | 46 | 460 | Accepting a slot stores its start instead of its end as the next availability boundary. |
| 14 | ARRAYS | Overlapping Distress Calls | 65 | 650 | A complete match resets matched to zero instead of retaining the longest reusable border. |
| 15 | ARRAYS | Mirror Frame Repair | 64 | 640 | The matching-endpoint branch adds a repair cost instead of inheriting only the inner substring cost. |
| 16 | ARRAYS | Strict Upgrade Trail | 57 | 570 | The tails search skips equal entries, computing a nondecreasing subsequence instead of a strictly increasing one. |
| 17 | ARRAYS | Circular Power Reserve | 60 | 600 | The circular complement candidate is considered for an all-negative list, where it removes the entire list and represents an empty section. |
| 18 | ARRAYS | Crossed Arrival Records | 66 | 660 | A right-side merge choice counts the whole original left block instead of only its unmerged suffix. |
| 19 | ARRAYS | Patch Transcript Distance | 71 | 710 | The saved diagonal is overwritten with the current row result rather than the previous row cell. |
| 20 | ARRAYS | Firewall Plate Area | 76 | 760 | The popped rectangle width includes the remaining shorter stack-top position. |
| 21 | ARRAYS | Wildcard Quarantine Rule | 80 | 800 | The star transition consumes from the previous rule column instead of remaining on the star column, preventing repeated consumption. |
| 22 | ARRAYS | Signed Burst Recovery | 85 | 850 | Only one qualifying deque-front prefix is consumed at an endpoint, leaving potentially shorter qualifying starts unexamined. |
| 23 | ARRAYS | Suffix Archive Census | 90 | 900 | The Kasai-style scan carries the full previous common-prefix length to the next starting position instead of reducing it by one. |
| 24 | ARRAYS | Nested Signature Relay | 94 | 940 | Failure-link propagation replaces a node's terminal count instead of adding inherited suffix counts to its own count. |
| 25 | ARRAYS | Three-Image Recovery | 100 | 1000 | On suffix-link fallback the matched length becomes zero instead of the length of the retained suffix state, losing still-valid match evidence. |
| 26 | SYSTEMS | Aligned Rescue Span | 25 | 250 | The fit check uses the unaligned span start instead of the aligned candidate. |
| 27 | SYSTEMS | Fragment Tailroom | 29 | 290 | The final-fragment fit check uses the rounded nonfinal chunk size, discarding legal final tailroom. |
| 28 | SYSTEMS | Boundary Tag Reunion | 32 | 320 | The right boundary tag is set to one rather than the merged length, so later left-neighbor merges use stale information. |
| 29 | SYSTEMS | Wrapped Burst Admission | 35 | 350 | Admission also demands physically contiguous tailroom, although a circular queue can wrap. |
| 30 | SYSTEMS | Clean Fill, Dirty Ghost | 38 | 380 | A miss retains the evicted block's dirty bit instead of giving the incoming block a clean state. |
| 31 | SYSTEMS | Pinned Cache Refuge | 41 | 410 | Victim selection prefers the oldest resident without excluding pinned pages. |
| 32 | SYSTEMS | End-Around Carry | 43 | 430 | Folding discards the carry instead of adding it back into the low bits. |
| 33 | SYSTEMS | C-LOOK Return Journey | 45 | 450 | The wrap branch skips charging the physical seek back to the selected lower track. |
| 34 | SYSTEMS | Frequency Inheritance | 48 | 480 | A replacement increments the victim slot's old frequency instead of starting the new page at one. |
| 35 | SYSTEMS | Translation After Remap | 50 | 500 | A page-table change leaves its cached translation valid. |
| 36 | SYSTEMS | Recycled Badge Generation | 53 | 530 | Validation accepts any older generation instead of requiring exact equality with the current generation. |
| 37 | SYSTEMS | Undo in Reverse | 55 | 550 | Undo records are replayed oldest first, so later before-images overwrite the true original value. |
| 38 | SYSTEMS | Two Owners, One Frame | 58 | 580 | The copy-on-write guard excludes frames with exactly two owners. |
| 39 | SYSTEMS | Reservation Window Baseline | 60 | 600 | The query sweep starts accumulating differences only at left, losing the load already active there. |
| 40 | SYSTEMS | Length-Tagged Dispatch | 62 | 620 | The parser advances by only one header byte plus the payload length, although the header has two bytes. |
| 41 | SYSTEMS | Reassembly Must Remember | 64 | 640 | Conflict detection is disabled when all message positions have been filled. |
| 42 | SYSTEMS | Clock Hand Privilege | 65 | 650 | A newly installed page starts with reference bit zero instead of one. |
| 43 | SYSTEMS | Compactor's Interior Address | 70 | 700 | Relocation returns the new block base without adding the old address's interior offset. |
| 44 | SYSTEMS | The Last Strong Owner | 74 | 740 | Destruction tests external ownership instead of the total reference count, overlooking internal strong owners. |
| 45 | SYSTEMS | Idle Credit in the Router | 78 | 780 | Emptying a queue preserves its unused deficit, letting later arrivals inherit idle credit. |
| 46 | SYSTEMS | Committed Child, Aborted Parent | 82 | 820 | Every commit clears the undo log, including child commits whose history is still needed by a parent. |
| 47 | SYSTEMS | Buddy, Not Just Neighbor | 85 | 850 | The merge computes every buddy to the right, forgetting that an upper half's buddy is on its left. |
| 48 | SYSTEMS | Commit Order at Dawn | 90 | 900 | Recovery orders committed batches by first-write position instead of commit-marker position. |
| 49 | SYSTEMS | Disk Route State | 96 | 960 | A transition stores its result under the old endpoint rather than the newly serviced request. |
| 50 | SYSTEMS | The Black-to-White Breach | 100 | 1000 | The write barrier shades targets of gray owners instead of black owners, missing links added after an owner's scan. |
| 51 | GRAPHS | Twin Arrival Ledger | 25 | 250 | An equal-distance arrival replaces the accumulated route count instead of contributing to it. |
| 52 | GRAPHS | Repair Front Collision | 34 | 340 | The meeting cable is omitted when combining distances from two different owners. |
| 53 | GRAPHS | Even Pulse Corridor | 40 | 400 | Crossing a link keeps the old hop parity instead of switching to the other parity state. |
| 54 | GRAPHS | Parallel Repair Clock | 42 | 420 | The prerequisite merge adds finish times instead of keeping their maximum. |
| 55 | GRAPHS | Cycle Admission Desk | 39 | 390 | The cycle test compares immediate parent links rather than the roots already found. |
| 56 | GRAPHS | Two Phase Isolation | 35 | 350 | The conflict check treats opposite phases as a conflict instead of equal phases. |
| 57 | GRAPHS | Nested Repair Load | 45 | 450 | A child passes only its original load instead of its fully accumulated subtree total. |
| 58 | GRAPHS | Cooling Tree Core | 43 | 430 | Only one queued leaf is removed per round instead of the complete layer present at the round's start. |
| 59 | GRAPHS | Tentative Alarm Queue | 49 | 490 | The next settled relay is chosen by its label rather than its tentative cost. |
| 60 | GRAPHS | Zero Cost Fast Lane | 60 | 600 | The deque insertion ends are reversed, breaking the distance order required before finalisation. |
| 61 | GRAPHS | Worst Link Shield | 53 | 530 | When a new link is worse, its cost is added instead of replacing the previous maximum. |
| 62 | GRAPHS | Reachable Credit Spiral | 65 | 650 | The final improvement test performs arithmetic on the unreachable sentinel without checking reachability. |
| 63 | GRAPHS | Cheapest Repair Backbone | 58 | 580 | A frontier key stores the previous key plus the cable price instead of just the cable price. |
| 64 | GRAPHS | Backup Cable Pairing | 62 | 620 | The skipped-cable test removes every record with matching endpoints instead of only the chosen record index. |
| 65 | GRAPHS | Disconnected Junction Audit | 64 | 640 | Removal results are compared with one component instead of the measured original component count. |
| 66 | GRAPHS | Exact Hop Manifest | 56 | 560 | The new route-length layer is added to the old layer instead of replacing it. |
| 67 | GRAPHS | One Way Cluster Gates | 65 | 650 | The component membership test accepts reachability in either direction instead of requiring both directions. |
| 68 | GRAPHS | Condensed Service Tour | 78 | 780 | The DAG transition adds one for the next component instead of adding that component's relay count. |
| 69 | GRAPHS | Ancestor Jump Table | 74 | 740 | A doubled jump copies one half-jump instead of composing two half-jumps. |
| 70 | GRAPHS | Moving Root Repair Zones | 83 | 830 | The complement case removes x's whole original subtree instead of just the child branch leading to the temporary root. |
| 71 | GRAPHS | Equal Price Backbone Fork | 85 | 850 | The temporary batch forest starts with isolated vertices instead of preserving cheaper-edge contractions. |
| 72 | GRAPHS | Undoable Bandwidth Repair | 85 | 850 | Augmentation consumes forward capacity but fails to create the matching reverse residual capacity. |
| 73 | GRAPHS | Alternating Drone Assignments | 90 | 900 | Path reconstruction forgets the displaced job, so it stops after changing only the final assignment. |
| 74 | GRAPHS | Negative Echo Containment | 96 | 960 | Negative-cycle influence is propagated for only one edge-list sweep, which depends on input order. |
| 75 | GRAPHS | Priced Residual Treaty | 100 | 1000 | A reverse residual edge has the original positive price instead of the negative price needed to refund cancelled flow. |
| 76 | LOGIC | Clock Without a Wall | 25 | 250 | The receive branch adds a newer remote timestamp instead of adopting it before incrementing. |
| 77 | LOGIC | Recursive Service Latch | 29 | 290 | A release clears the owner even when the reentrant depth is still positive. |
| 78 | LOGIC | Barrier Generations | 32 | 320 | The per-worker arrival flags are retained when a new barrier generation begins. |
| 79 | LOGIC | Client Receipt Namespaces | 34 | 340 | The deduplication key omits the client namespace. |
| 80 | LOGIC | Half-Range Sequence Fence | 37 | 370 | The acceptance boundary includes the ambiguous half-range distance. |
| 81 | LOGIC | Binary Residue Gate | 40 | 400 | The transition adds the new bit without doubling the previous remainder for its binary place value. |
| 82 | LOGIC | Quiet Shift Planner | 43 | 430 | The take transition extends the best previous total rather than only the total that skipped the previous day. |
| 83 | LOGIC | Borrowed Quantum | 45 | 450 | Elapsed time advances by a full quantum even for a shorter final turn. |
| 84 | LOGIC | One-Use Repair Kits | 48 | 480 | Ascending in-place budget updates reuse the current kit within its own pass. |
| 85 | LOGIC | Unordered Power Credits | 50 | 500 | Putting the amount loop outside the denomination loop counts ordered sequences instead of denomination combinations. |
| 86 | LOGIC | Snapshot Write Sets | 52 | 520 | Commit copies clean snapshot cells as well as written cells, causing unrelated lost updates. |
| 87 | LOGIC | Causal Fingerprints | 54 | 540 | The BEFORE branch checks for a smaller component but does not exclude a greater component. |
| 88 | LOGIC | The First Release Rule | 56 | 560 | Shrinking begins only after the last held lock is released instead of after the first successful release. |
| 89 | LOGIC | Borrowed Resources Return | 59 | 590 | The completion step returns the remaining need instead of the resources originally allocated. |
| 90 | LOGIC | Distinct Recovery Phrases | 61 | 610 | Duplicate removal subtracts the count through the previous equal letter instead of the count just before it. |
| 91 | LOGIC | Compatible Maintenance Windows | 63 | 630 | Taking a job extends the unrestricted previous optimum instead of the last compatible prefix optimum. |
| 92 | LOGIC | Composite-Modulus Rosters | 65 | 650 | The recurrence reduces modulo modulus before an exact integer division, which does not preserve the quotient remainder. |
| 93 | LOGIC | Read Sets Against Write Skew | 69 | 690 | Commit validates only written cells and overlooks read-only dependencies, allowing write skew. |
| 94 | LOGIC | Adjacent Archive Fusion | 73 | 730 | The last merge is charged only the endpoint weights instead of the entire interval weight. |
| 95 | LOGIC | Crew Assignment Masks | 77 | 770 | The cost row uses the mask remainder instead of the count of already assigned jobs. |
| 96 | LOGIC | Sealed Credit Stocks | 81 | 810 | A denomination stage reads its own growing output, allowing same-stage choices to be reused beyond the stock limit. |
| 97 | LOGIC | Two-Ended Quarantine Game | 85 | 850 | The right-end transition adds the next player's interval advantage instead of subtracting it. |
| 98 | LOGIC | Atomic History Witness | 89 | 890 | A call is considered ready when any required predecessor is present rather than when all are present. |
| 99 | LOGIC | Count the Legal Interleavings | 95 | 950 | The acquisition test checks only the acting worker's prefix instead of locks held by all workers. |
| 100 | LOGIC | Exact Coverage Under Conflicts | 100 | 1000 | The coverage test rejects only full containment, allowing a partially overlapping switch to repair a module twice. |
