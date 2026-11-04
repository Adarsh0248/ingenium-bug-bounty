# Protocol Rebellion — Round 2

Private organiser content. Never copy this directory into public assets.

100 independent debugging missions in The Kernel Breach, with 25 per topic and four equivalent language variants: C, C++, Java and Python. There are 70 questions at 1–20, 20 at 21–30 and 10 at 31–40, matching the easier Round 1 style requested after the first event. Ratings are authoring targets, not measured pilot difficulty.

Each mission provides a plain-English incident, exact expected behaviour, buggy program, code-reading guide, two samples, at least six hidden tests and three progressive hints. Bounties range from 250–1,000 coins independently of difficulty so Round 2 shop items remain affordable. Round 2's additional hint costs stay 10%, 30%, 80%, with winning score multipliers 90%, 70%, 50%. Existing hint percentages, winning score multipliers and shop prices stay unchanged.

Use the [question book](questions.md) for review and [validation summary](validation-summary.json) for exact local check scope. Local compiler checks do not publish questions or verify the production judge. Organiser review, language-fairness pilots and protected publication validation are still required.

Rebuild: `npm.cmd run content:round2:build`. Authored bodies keep explicit four-space blocks and one statement per line; no external formatter is required. Verify all organiser-authored programs: `npm.cmd run content:round2:verify` (GCC, G++, Java and Python required). Detailed reports and temporary binaries go under ignored `apps/api/test-results/round2-validation/`.

| # | Topic | Mission | Difficulty | Bounty | Private defect |
| --- | --- | --- | ---: | ---: | --- |
| 1 | ARRAYS | Alternating Supply Ribbons | 10 | 340 | Both outputs in a pair read from the first ribbon. |
| 2 | ARRAYS | Marked Cargo Removal | 11 | 360 | The retention condition selects removal flags instead of keep flags. |
| 3 | ARRAYS | Step Change Tape | 12 | 380 | The subtraction uses previous minus current instead of current minus previous. |
| 4 | ARRAYS | Missing Crate Insertion | 14 | 430 | The insertion condition compares the loop position to the following gap. |
| 5 | ARRAYS | Local Mirror Strip | 18 | 510 | The second half of a swap reads an entry that has already been overwritten. |
| 6 | ARRAYS | Two Lane Unpacking | 16 | 470 | Each lane pass starts at position zero instead of its lane number. |
| 7 | ARRAYS | Missing Reading Carry | 17 | 490 | The remembered reading is updated on missing entries instead of real entries. |
| 8 | ARRAYS | Delta Tape Reconstruction | 19 | 540 | Each change is subtracted from the reconstructed value. |
| 9 | ARRAYS | Trailing Padding Cutter | 13 | 400 | The trimming condition inspects the first character rather than the current final retained character. |
| 10 | ARRAYS | Transcript Difference Markers | 13 | 400 | The difference check accepts equal letters. |
| 11 | ARRAYS | Wildcard Badge Stencil | 18 | 510 | The mismatch condition rejects wildcard positions regardless of their matching rule. |
| 12 | ARRAYS | Ordered Rescue Letters | 23 | 630 | A match resets progress to one instead of advancing the saved position. |
| 13 | ARRAYS | Packed Run Expansion | 20 | 560 | The copy loop stops before the final required copy. |
| 14 | ARRAYS | Addressed Shelf Picks | 14 | 430 | The output uses a position directly instead of looking up its value. |
| 15 | ARRAYS | Vertical Log Reader | 12 | 380 | The flat position uses the column number as the row number. |
| 16 | ARRAYS | Transposed Control Sheet | 24 | 650 | The source address uses transposed dimensions instead of original dimensions. |
| 17 | ARRAYS | Snake Row Patrol | 18 | 510 | The reversal branch selects even rows rather than odd rows. |
| 18 | ARRAYS | Shared Header Length | 16 | 470 | The prefix loop no longer stops when corresponding letters differ. |
| 19 | ARRAYS | Damaged Span Removal | 15 | 450 | The retention test includes positions equal to the deletion endpoints. |
| 20 | ARRAYS | Ascending Shelf Passes | 28 | 740 | The candidate comparison selects the largest remaining entry. |
| 21 | ARRAYS | Dictionary Gate Order | 26 | 690 | The scan continues replacing a decision after the first unequal letters. |
| 22 | ARRAYS | Single Pass Sensor Smoothing | 32 | 820 | The left term is read from the partially updated result rather than the original input. |
| 23 | ARRAYS | Two Token Packet Folding | 29 | 760 | A successful fold consumes only its first token. |
| 24 | ARRAYS | Settling Storage Columns | 35 | 890 | A crate is written back to its source row rather than to the next free bottom destination. |
| 25 | ARRAYS | Safe Range Labels | 10 | 340 | The upper-bound branch assigns the lower endpoint. |
| 26 | SYSTEMS | Sector Offset Split | 8 | 290 | The offset calculation uses the quotient rather than the remainder within a sector. |
| 27 | SYSTEMS | Payload Only Meter | 10 | 340 | Each frame's payload length is left equal to its full length, so headers are counted as data. |
| 28 | SYSTEMS | Truncate Without Growth | 12 | 380 | The trim guard accepts any unequal limit, including limits that extend the file. |
| 29 | SYSTEMS | Overwrite End Marker | 16 | 470 | Extension is tested using the write's starting position instead of its ending position. |
| 30 | SYSTEMS | Cursor at End | 18 | 510 | The cursor advances by the requested amount rather than the clipped amount actually returned. |
| 31 | SYSTEMS | Severity Byte Filter | 9 | 320 | The severity filter uses a strict comparison and drops records at the threshold. |
| 32 | SYSTEMS | Checksum Byte Wrap | 12 | 380 | The checksum wraps using 255 possible states instead of 256. |
| 33 | SYSTEMS | Minimum Packet Padding | 14 | 430 | A short packet receives a full minimum's worth of extra bytes instead of being raised to the minimum. |
| 34 | SYSTEMS | Final Buffer Dispatch | 20 | 560 | The final flush is performed only for a completely full buffer. |
| 35 | SYSTEMS | Clean After Flush | 17 | 490 | A successful flush leaves the buffer marked dirty, so later flushes save it again. |
| 36 | SYSTEMS | Rejected Byte Ledger | 14 | 430 | Each rejected packet contributes one to a counter that is supposed to measure bytes. |
| 37 | SYSTEMS | Partial Buffer Drain | 16 | 470 | An oversized drain is reduced to zero instead of to the number of queued bytes. |
| 38 | SYSTEMS | Suppressed Log Clock | 20 | 560 | The last-written time is updated for suppressed attempts as well as written logs. |
| 39 | SYSTEMS | Empty File Still Exists | 14 | 430 | The existence test excludes zero-length files along with unused slots. |
| 40 | SYSTEMS | One Terminator per Record | 10 | 340 | The record size omits its one-byte ending marker. |
| 41 | SYSTEMS | Drive Travel Ledger | 18 | 510 | The negative movement adjustment leaves the signed difference negative instead of making it a distance. |
| 42 | SYSTEMS | Block Wear Allowance | 19 | 540 | The wear guard checks the global acceptance total instead of the target block's write count. |
| 43 | SYSTEMS | Shared Log Header | 20 | 560 | The header charge is added for every candidate record instead of only while the log is empty. |
| 44 | SYSTEMS | Seek from File End | 23 | 630 | The end-relative branch chooses the current cursor rather than the fixed file length as its base. |
| 45 | SYSTEMS | Arrivals Before Service | 24 | 650 | The service amount is based on the old queue rather than the queue after admitting this tick's arrivals. |
| 46 | SYSTEMS | Whole Range Reservation | 22 | 600 | Encountering an occupied block leaves the reservation marked possible instead of rejecting it. |
| 47 | SYSTEMS | Checkpoint Log Tail | 24 | 650 | The recovery branch copies the current length into the checkpoint instead of restoring the current length from it. |
| 48 | SYSTEMS | Packed Record Boundary | 26 | 690 | The completeness check rejects a record whose end is exactly the buffer length. |
| 49 | SYSTEMS | Cancel a Waiting Print | 31 | 800 | The cancellation shift starts after the cancelled position, leaving that position unchanged. |
| 50 | SYSTEMS | Discard the Pending Slot | 32 | 820 | Discard marks a slot as having a pending edit instead of clearing that status. |
| 51 | GRAPHS | Reciprocal Door Pairs | 8 | 290 | The pair test accepts either direction instead of requiring both. |
| 52 | GRAPHS | One Way Dead Ends | 12 | 380 | The final test includes isolated vertices because it ignores incoming links. |
| 53 | GRAPHS | Zone Exit Wires | 9 | 320 | The zone test exchanges the sender and receiver roles. |
| 54 | GRAPHS | Shared Rescue Neighbours | 11 | 360 | The shared-neighbour condition accepts a cable to either post. |
| 55 | GRAPHS | Triangle Lock Census | 19 | 540 | The triangle check omits the cable joining the first and last vertices. |
| 56 | GRAPHS | Missing Mesh Cables | 7 | 270 | The pair loop includes both orders of every missing pair. |
| 57 | GRAPHS | Incident Power Ledger | 10 | 340 | The row total counts cables instead of adding their power values. |
| 58 | GRAPHS | Sibling Pair Roster | 15 | 450 | The child-pair formula counts both orders without dividing by two. |
| 59 | GRAPHS | Parent Label Cards | 6 | 250 | The parent assignment stores the relationship in the wrong direction. |
| 60 | GRAPHS | Inbound Outbound Balance | 12 | 380 | Incoming links are added rather than subtracted. |
| 61 | GRAPHS | Signed Walk Receipt | 13 | 400 | A later valid step overwrites an earlier failure. |
| 62 | GRAPHS | Hub And Rim Seal | 18 | 510 | The pair check ignores unexpected cables between outer vertices. |
| 63 | GRAPHS | Odd Socket Census | 10 | 340 | The odd-degree test accepts only degree one. |
| 64 | GRAPHS | Cable Colour Split | 14 | 430 | The violation condition rejects different colours instead of equal colours. |
| 65 | GRAPHS | Tile Boundary Fence | 18 | 510 | A shared side removes only one of its two contributions. |
| 66 | GRAPHS | Fixed Step Conveyor | 9 | 320 | The crossing loop makes one fewer move than requested. |
| 67 | GRAPHS | Immediate Return Log | 10 | 340 | The check compares the end of the two-move section with its middle instead of its beginning. |
| 68 | GRAPHS | Two Link Promise | 24 | 650 | The missing-shortcut test wrongly requires both first-leg table entries instead of the two consecutive legs. |
| 69 | GRAPHS | Four Door Circuit | 27 | 710 | The final cable returning to the first vertex is not checked. |
| 70 | GRAPHS | First Crossing Toll | 22 | 600 | The payment table marks only the travel direction, although a cable is shared by both directions. |
| 71 | GRAPHS | Synchronous Relay Lamps | 26 | 690 | Neighbour counting reads partially updated lamps from the new round. |
| 72 | GRAPHS | Junction Switch Patrol | 24 | 650 | The switch update toggles the arrival vertex instead of the saved departure vertex. |
| 73 | GRAPHS | Discovery Sender Cards | 31 | 800 | A newly discovered vertex records the global start instead of the relay currently processing it. |
| 74 | GRAPHS | Largest Floor Island | 33 | 850 | The left-neighbour offset is zero, so that direction checks the current tile instead. |
| 75 | GRAPHS | Simultaneous Twig Trim | 32 | 820 | Selection deletes vertices immediately, so later degree checks see a partially trimmed round. |
| 76 | LOGIC | Single Pilot Signal | 6 | 250 | The decision accepts every positive request total instead of exactly one. |
| 77 | LOGIC | Inspection Bit | 9 | 320 | The isolated bit is compared with the integer one instead of being tested for a nonzero value. |
| 78 | LOGIC | Complete Permit Set | 15 | 450 | The test accepts any shared permit and also rejects an empty requirement. |
| 79 | LOGIC | Heat Band Labels | 7 | 270 | The warm-band branch excludes its lower boundary of twenty. |
| 80 | LOGIC | Calendar Relay | 8 | 290 | The wrap step subtracts seven once rather than handling every complete week. |
| 81 | LOGIC | Minute Carry Panel | 12 | 380 | The hour carry uses the remainder of minutes instead of the number of complete hours. |
| 82 | LOGIC | Latched Distress Light | 10 | 340 | Every report replaces the stored light state instead of preserving earlier alarms. |
| 83 | LOGIC | Pause Aware Meter | 14 | 430 | The pause command leaves the running flag enabled. |
| 84 | LOGIC | Bounded Lift Buttons | 11 | 360 | The move guard checks the upper bound but omits the lower bound. |
| 85 | LOGIC | Fresh Cooldown Pulse | 19 | 540 | Cooldown decreases only on slots containing a pulse. |
| 86 | LOGIC | Single Use Silencer | 18 | 510 | Suppressing an alarm leaves the silencer armed. |
| 87 | LOGIC | Neighboring Enabled Lamps | 18 | 510 | The pair test accepts one set bit instead of requiring both bits. |
| 88 | LOGIC | Two Bit Mode Field | 15 | 450 | The extraction mask retains only the lower field bit. |
| 89 | LOGIC | Equalizer Tick | 17 | 490 | The downward branch includes equality and moves a dial that is already at its target. |
| 90 | LOGIC | Leap Day Access | 12 | 380 | The ordinary four-year rule fails to exclude century years. |
| 91 | LOGIC | Periodic Bell Phase | 8 | 290 | The phase test uses the quotient rather than the remainder. |
| 92 | LOGIC | Nearest Calibration Mark | 13 | 400 | The upward-rounding check excludes exact halfway ties. |
| 93 | LOGIC | Remembered Fan Band | 23 | 630 | Every reading below the high threshold is treated as a switch-off reading. |
| 94 | LOGIC | Pending Rescue Batch | 26 | 690 | Discard is routed through the publication branch. |
| 95 | LOGIC | Muted Desk Rotation | 27 | 710 | The skip check advances past at most one disabled desk. |
| 96 | LOGIC | Failure Streak Siren | 22 | 600 | Every failure at or above the threshold raises another siren. |
| 97 | LOGIC | Consumed Double Tap | 28 | 740 | A completed pair keeps its second tap waiting instead of consuming it. |
| 98 | LOGIC | Relay Timer Phases | 31 | 800 | The timer-advance phase runs after commands, aging new timers immediately. |
| 99 | LOGIC | Lift Direction Interlock | 32 | 820 | A successful move stores a stopped direction instead of the movement direction. |
| 100 | LOGIC | One Step Undo Console | 33 | 850 | An edit leaves the redo availability flag unchanged. |
