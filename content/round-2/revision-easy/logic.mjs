// Private organiser missions. Cases 1-2 are samples; witness indices are one-based.
export const logic = [
  {
    title: "Single Pilot Signal",
    difficulty: 6,
    guide: "`a`, `b`, `c`, and `d` are four request flags. `requests` records their total, and `allowed` is the printed decision.",
    incident: "AEGIS forged cockpit requests. Mira checks whether exactly one pilot requested control.",
    symptom: "Several simultaneous requests can receive the same decision as one request.",
    task: "Print `1` if exactly one of the four flags is `1`. Print `0` if none or more than one are `1`.",
    input: "Read four integers: `a b c d`.",
    output: "Print one integer, `1` or `0`.",
    example: "For `0 1 0 0`, only one pilot requests control. Print `1`.",
    constraints: "Every flag is `0` or `1`.",
    defect: "The decision accepts every positive request total instead of exactly one.",
    hints: ["Compare one request with two requests.", "The decision depends on the total number of active flags.", "The accepted total is one specific value, rather than every value above zero."],
    c: `int a;
int b;
int c;
int d;
READ(a);
READ(b);
READ(c);
READ(d);
int requests = a + b + c + d;
int allowed = 0;
if (requests == 1) {
    allowed = 1;
}
OUT(allowed);`,
    py: `a = read_int()
b = read_int()
c = read_int()
d = read_int()
requests = a + b + c + d
allowed = 0
if requests == 1:
    allowed = 1
print(allowed)`,
    cbug: ["requests == 1", "requests >= 1"],
    pybug: ["requests == 1", "requests >= 1"],
    cases: [["0 1 0 0", "1"], ["0 0 0 0", "0"], ["1 1 0 0", "0"], ["1 0 0 0", "1"], ["0 0 1 0", "1"], ["0 0 0 1", "1"], ["1 1 1 1", "0"], ["0 1 0 1", "0"]],
    witness: 3,
    probe: ["1 0 1 1", "0"]
  },
  {
    title: "Inspection Bit",
    difficulty: 9,
    guide: "`mask` stores eight on/off flags in binary. `bit` selects a position, `selected` isolates its value, and `answer` records the decision.",
    incident: "AEGIS hid a lamp status inside a control byte. Patch checks the requested lamp.",
    symptom: "An enabled lamp above position zero can be reported as disabled.",
    task: "Print `1` when bit position `bit` is set in `mask`, otherwise print `0`. Position `0` is the rightmost binary digit.",
    input: "Read `mask` and `bit`.",
    output: "Print one integer, `1` or `0`.",
    example: "The binary form of `mask = 10` is `00001010`. Position `3` is set, so print `1`.",
    constraints: "`0 <= mask <= 255`; `0 <= bit <= 7`.",
    defect: "The isolated bit is compared with the integer one instead of being tested for a nonzero value.",
    hints: ["Try a set bit that is not the rightmost bit.", "An isolated set bit keeps its original place value.", "The test should accept any nonzero isolated value."],
    c: `int mask;
int bit;
READ(mask);
READ(bit);
int selected = mask & (1 << bit);
int answer = 0;
if (selected != 0) {
    answer = 1;
}
OUT(answer);`,
    py: `mask = read_int()
bit = read_int()
selected = mask & (1 << bit)
answer = 0
if selected != 0:
    answer = 1
print(answer)`,
    cbug: ["selected != 0", "selected == 1"],
    pybug: ["selected != 0", "selected == 1"],
    cases: [["10 3", "1"], ["10 2", "0"], ["128 7", "1"], ["1 0", "1"], ["0 0", "0"], ["255 6", "1"], ["64 5", "0"], ["2 1", "1"]],
    witness: 3,
    probe: ["129 7", "1"]
  },
  {
    title: "Complete Permit Set",
    difficulty: 15,
    guide: "`held` and `required` are bit masks. `shared` contains positions set in both. `allowed` is the final yes/no decision.",
    incident: "AEGIS removed some launch permits. Ishan checks whether every required permit remains.",
    symptom: "A partial set of permits can be accepted.",
    task: "A set bit represents one permit. Print `1` only if every set bit of `required` is also set in `held`. Extra held permits are allowed. If `required` is zero, print `1`.",
    input: "Read `held` and `required`.",
    output: "Print one integer, `1` or `0`.",
    example: "With `held = 7` and `required = 5`, both required positions are present. Print `1`.",
    constraints: "`0 <= held, required <= 255`.",
    defect: "The test accepts any shared permit and also rejects an empty requirement.",
    hints: ["Try holding only one of two required permits.", "The shared positions must cover the entire requirement.", "Compare the shared mask with the required mask, including the zero requirement."],
    c: `int held;
int required;
READ(held);
READ(required);
int shared = held & required;
int allowed = 0;
if (shared == required) {
    allowed = 1;
}
OUT(allowed);`,
    py: `held = read_int()
required = read_int()
shared = held & required
allowed = 0
if shared == required:
    allowed = 1
print(allowed)`,
    cbug: ["shared == required", "shared != 0"],
    pybug: ["shared == required", "shared != 0"],
    cases: [["7 5", "1"], ["0 8", "0"], ["1 3", "0"], ["0 0", "1"], ["255 128", "1"], ["128 129", "0"], ["4 4", "1"], ["5 2", "0"]],
    witness: 3,
    probe: ["15 10", "1"]
  },
  {
    title: "Heat Band Labels",
    difficulty: 7,
    guide: "`temperature` is the reading. `band` starts at the coolest label and may be changed by the classification branches.",
    incident: "AEGIS corrupted a cooling panel. Mira checks its simple heat labels.",
    symptom: "A reading at a band boundary can receive the cooler label.",
    task: "Print band `0` for temperatures below `20`, band `1` for temperatures from `20` through `49`, and band `2` for temperatures at least `50`.",
    input: "Read one integer, `temperature`.",
    output: "Print the band number.",
    example: "A temperature of `50` belongs to band `2`.",
    constraints: "`-50 <= temperature <= 150`.",
    defect: "The warm-band branch excludes its lower boundary of twenty.",
    hints: ["Check the first temperature in each band.", "The hot-band branch runs before the warm-band branch.", "Twenty belongs to the warm band; it must not remain in the initial band."],
    c: `int temperature;
READ(temperature);
int band = 0;
if (temperature >= 50) {
    band = 2;
} else if (temperature >= 20) {
    band = 1;
}
OUT(band);`,
    py: `temperature = read_int()
band = 0
if temperature >= 50:
    band = 2
elif temperature >= 20:
    band = 1
print(band)`,
    cbug: ["temperature >= 20", "temperature > 20"],
    pybug: ["temperature >= 20", "temperature > 20"],
    cases: [["50", "2"], ["19", "0"], ["20", "1"], ["49", "1"], ["-50", "0"], ["0", "0"], ["150", "2"], ["21", "1"]],
    witness: 3,
    probe: ["51", "2"]
  },
  {
    title: "Calendar Relay",
    difficulty: 8,
    guide: "`day` is a weekday number. `advance` is a number of whole days, and `next_day` holds the computed weekday.",
    incident: "AEGIS shifted a maintenance calendar. Patch restores its weekday calculation.",
    symptom: "An advance longer than one week can leave an invalid weekday number.",
    task: "Weekdays are numbered `0` through `6` and repeat every seven days. Print the weekday reached after moving forward `advance` days from `day`.",
    input: "Read `day` and `advance`.",
    output: "Print one weekday number from `0` through `6`.",
    example: "From day `5`, moving forward `3` days reaches day `1`.",
    constraints: "`0 <= day <= 6`; `0 <= advance <= 10000`.",
    defect: "The wrap step subtracts seven once rather than handling every complete week.",
    hints: ["Try advancing by three full weeks.", "The intermediate value may contain more than one complete week.", "Keep only the part left after removing all full groups of seven."],
    c: `int day;
int advance;
READ(day);
READ(advance);
int next_day = day + advance;
if (next_day >= 7) {
    next_day %= 7;
}
OUT(next_day);`,
    py: `day = read_int()
advance = read_int()
next_day = day + advance
if next_day >= 7:
    next_day %= 7
print(next_day)`,
    cbug: ["next_day %= 7;", "next_day -= 7;"],
    pybug: ["next_day %= 7", "next_day -= 7"],
    cases: [["5 3", "1"], ["2 0", "2"], ["0 21", "0"], ["6 1", "0"], ["3 7", "3"], ["0 0", "0"], ["6 10000", "3"], ["4 10", "0"]],
    witness: 3,
    probe: ["1 29", "2"]
  },
  {
    title: "Minute Carry Panel",
    difficulty: 12,
    guide: "`total` combines the current minute field with the advance. `hour` and `minute` are the two clock fields printed at the end.",
    incident: "AEGIS stalled the clock display. Ishan checks how minute advances affect its hour field.",
    symptom: "The minute field changes while the hour field can remain behind.",
    task: "Advance a 24-hour clock by `advance` minutes. Carry complete groups of sixty minutes into the hour field. Wrap hours after `23`. Print the resulting hour and minute without leading zeroes.",
    input: "Read `hour`, `minute`, and `advance`.",
    output: "Print the resulting hour and minute, separated by a space.",
    example: "Advancing `10 50` by `20` minutes gives `11 10`.",
    constraints: "`0 <= hour <= 23`; `0 <= minute <= 59`; `0 <= advance <= 10000`.",
    defect: "The hour carry uses the remainder of minutes instead of the number of complete hours.",
    hints: ["Trace a clock that crosses an hour boundary.", "The same total supplies a whole-hour carry and a leftover minute field.", "The hour update needs the number of complete groups of sixty."],
    c: `int hour;
int minute;
int advance;
READ(hour);
READ(minute);
READ(advance);
int total = minute + advance;
hour = (hour + total / 60) % 24;
minute = total % 60;
OUT(hour);
OUT(minute);`,
    py: `hour = read_int()
minute = read_int()
advance = read_int()
total = minute + advance
hour = (hour + total // 60) % 24
minute = total % 60
print(hour, minute)`,
    cbug: ["hour + total / 60", "hour + total % 60"],
    pybug: ["hour + total // 60", "hour + total % 60"],
    cases: [["10 50 20", "11 10"], ["0 0 0", "0 0"], ["23 59 1", "0 0"], ["5 0 120", "7 0"], ["0 0 1440", "0 0"], ["12 30 30", "13 0"], ["23 0 60", "0 0"], ["0 59 10000", "23 39"]],
    witness: 3,
    probe: ["2 45 135", "5 0"]
  },
  {
    title: "Latched Distress Light",
    difficulty: 10,
    guide: "`alarm` is the current report. `latched` is the stored light state, initially off. The loop processes reports in order.",
    incident: "AEGIS is hiding distress reports. Mira needs a light that remembers any alarm.",
    symptom: "A later normal report can erase an earlier alarm.",
    task: "Start the distress light off (`0`). Each alarm report of `1` turns it on. A normal report of `0` leaves it unchanged. Once on, it stays on for the rest of the input.",
    input: "Read `n`, then `n` report flags.",
    output: "Print the final light state, `0` or `1`.",
    example: "Reports `1 0 0` leave the light on. Print `1`.",
    constraints: "`0 <= n <= 100`; each report is `0` or `1`.",
    defect: "Every report replaces the stored light state instead of preserving earlier alarms.",
    hints: ["Place a normal report after an alarm.", "The stored light and the latest report describe different things.", "An on light must remain on when the next report is zero."],
    c: `int n;
READ(n);
int latched = 0;
for (int i = 0; i < n; i++) {
    int alarm;
    READ(alarm);
    latched = latched | alarm;
}
OUT(latched);`,
    py: `n = read_int()
latched = 0
for _ in range(n):
    alarm = read_int()
    latched = latched | alarm
print(latched)`,
    cbug: ["latched = latched | alarm;", "latched = alarm;"],
    pybug: ["latched = latched | alarm", "latched = alarm"],
    cases: [["3\n1 0 0", "1"], ["2\n0 0", "0"], ["2\n1 0", "1"], ["0", "0"], ["1\n1", "1"], ["1\n0", "0"], ["4\n0 1 0 1", "1"], ["5\n1 1 0 0 0", "1"]],
    witness: 3,
    probe: ["4\n0 0 1 0", "1"]
  },
  {
    title: "Pause Aware Meter",
    difficulty: 14,
    guide: "`running` stores whether the meter is enabled. `ticks` counts recorded tick events, and `event` is the current command.",
    incident: "AEGIS scrambled a test meter. Patch checks its pause and resume controls.",
    symptom: "Ticks received during a pause can be counted.",
    task: "The meter starts running. Event `1` resumes it, event `2` pauses it, and event `3` records one tick only while running. Repeated pause or resume commands have no extra effect.",
    input: "Read `n`, then `n` event codes.",
    output: "Print the number of recorded ticks.",
    example: "For events `3 2 3 1 3`, only the first and last ticks count. Print `2`.",
    constraints: "`0 <= n <= 100`; each event is `1`, `2`, or `3`.",
    defect: "The pause command leaves the running flag enabled.",
    hints: ["Put a tick between a pause and a resume.", "The count branch depends on the stored running flag.", "After a pause, the flag must represent the disabled state until a resume arrives."],
    c: `int n;
READ(n);
int running = 1;
int ticks = 0;
for (int i = 0; i < n; i++) {
    int event;
    READ(event);
    if (event == 1) {
        running = 1;
    } else if (event == 2) {
        running = 0;
    } else if (running == 1) {
        ticks++;
    }
}
OUT(ticks);`,
    py: `n = read_int()
running = 1
ticks = 0
for _ in range(n):
    event = read_int()
    if event == 1:
        running = 1
    elif event == 2:
        running = 0
    elif running == 1:
        ticks += 1
print(ticks)`,
    cbug: ["running = 0;", "running = 1;"],
    pybug: ["running = 0", "running = 1"],
    cases: [["5\n3 2 3 1 3", "2"], ["2\n3 3", "2"], ["2\n2 3", "0"], ["0", "0"], ["4\n2 2 3 3", "0"], ["3\n1 1 3", "1"], ["5\n2 1 3 2 3", "1"], ["4\n2 1 2 1", "0"]],
    witness: 3,
    probe: ["6\n3 2 3 3 1 3", "2"]
  },
  {
    title: "Bounded Lift Buttons",
    difficulty: 11,
    guide: "`floor` is the current position and `top` is the highest allowed floor. Each `step` requests one upward or downward move.",
    incident: "AEGIS disturbed a service lift. Ishan checks that its buttons respect both ends of the shaft.",
    symptom: "The displayed floor can go below ground level.",
    task: "The lift starts at floor `0` and may use floors `0` through `top`. For each step, try moving by that step. Ignore a move whose destination is outside that range.",
    input: "Read `top` and `n`, then `n` steps. A step of `1` moves up and `-1` moves down.",
    output: "Print the final floor.",
    example: "With `top = 2` and steps `1 1 1 -1`, the third step is ignored. Print `1`.",
    constraints: "`1 <= top <= 20`; `0 <= n <= 100`; each step is `-1` or `1`.",
    defect: "The move guard checks the upper bound but omits the lower bound.",
    hints: ["Try moving down at floor zero.", "The candidate floor must satisfy two separate boundaries.", "Keep the upper check and also reject negative destinations."],
    c: `int top;
int n;
READ(top);
READ(n);
int floor = 0;
for (int i = 0; i < n; i++) {
    int step;
    READ(step);
    int candidate = floor + step;
    if (candidate >= 0 && candidate <= top) {
        floor = candidate;
    }
}
OUT(floor);`,
    py: `top = read_int()
n = read_int()
floor = 0
for _ in range(n):
    step = read_int()
    candidate = floor + step
    if candidate >= 0 and candidate <= top:
        floor = candidate
print(floor)`,
    cbug: ["candidate >= 0 && candidate <= top", "candidate <= top"],
    pybug: ["candidate >= 0 and candidate <= top", "candidate <= top"],
    cases: [["2 4\n1 1 1 -1", "1"], ["3 1\n1", "1"], ["2 1\n-1", "0"], ["1 0", "0"], ["1 3\n1 1 1", "1"], ["4 3\n-1 -1 1", "1"], ["2 3\n1 -1 -1", "0"], ["2 5\n1 1 -1 1 -1", "1"]],
    witness: 3,
    probe: ["3 4\n-1 1 1 -1", "1"]
  },
  {
    title: "Fresh Cooldown Pulse",
    difficulty: 19,
    guide: "`remaining` is the cooldown counter. Each loop iteration is one time slot. `pulse` is that slot's request and `accepted` counts accepted requests.",
    incident: "AEGIS flooded a beacon with pulses. Mira checks its short cooldown rule.",
    symptom: "Quiet slots can fail to move the beacon toward readiness.",
    task: "Start with cooldown zero. At the start of every slot, reduce a positive cooldown by one. Then, if the slot contains a pulse (`1`) and the cooldown is zero, accept it and set the cooldown to `gap`. A zero slot has no pulse. Print the number accepted.",
    input: "Read `gap` and `n`, then `n` pulse flags in time order.",
    output: "Print the accepted pulse count.",
    example: "For `gap = 2` and flags `1 0 1`, the middle quiet slot still advances the cooldown. Both pulses are accepted. Print `2`.",
    constraints: "`1 <= gap <= 10`; `0 <= n <= 100`; every flag is `0` or `1`.",
    defect: "Cooldown decreases only on slots containing a pulse.",
    hints: ["Insert quiet slots between two pulses.", "Time passes once per slot, even when no request arrives.", "The cooldown update must depend on its counter, without requiring a pulse in that slot."],
    c: `int gap;
int n;
READ(gap);
READ(n);
int remaining = 0;
int accepted = 0;
for (int i = 0; i < n; i++) {
    int pulse;
    READ(pulse);
    if (remaining > 0) {
        remaining--;
    }
    if (pulse == 1 && remaining == 0) {
        accepted++;
        remaining = gap;
    }
}
OUT(accepted);`,
    py: `gap = read_int()
n = read_int()
remaining = 0
accepted = 0
for _ in range(n):
    pulse = read_int()
    if remaining > 0:
        remaining -= 1
    if pulse == 1 and remaining == 0:
        accepted += 1
        remaining = gap
print(accepted)`,
    cbug: ["if (remaining > 0)", "if (remaining > 0 && pulse == 1)"],
    pybug: ["if remaining > 0:", "if remaining > 0 and pulse == 1:"],
    cases: [["2 3\n1 0 1", "2"], ["1 3\n1 1 1", "3"], ["3 4\n1 0 0 1", "2"], ["2 0", "0"], ["4 3\n0 0 0", "0"], ["2 5\n1 1 1 1 1", "3"], ["3 5\n1 0 1 0 1", "2"], ["10 1\n1", "1"]],
    witness: 3,
    probe: ["4 5\n1 0 0 0 1", "2"]
  },
  {
    title: "Single Use Silencer",
    difficulty: 18,
    guide: "`silent` records whether a silencer is armed. `heard` counts alarms that are actually heard. `event` selects arming or an alarm.",
    incident: "AEGIS damaged a console silencer. Patch checks that one arming hides only one alarm.",
    symptom: "One armed silencer can hide several later alarms.",
    task: "Start with no silencer armed. Event `1` arms one silencer; arming again does not stack extra uses. Event `2` is an alarm: if armed, suppress that alarm and consume the silencer; otherwise count it as heard.",
    input: "Read `n`, then `n` event codes.",
    output: "Print the number of heard alarms.",
    example: "Events `1 2 2` suppress the first alarm only. Print `1`.",
    constraints: "`0 <= n <= 100`; every event is `1` or `2`.",
    defect: "Suppressing an alarm leaves the silencer armed.",
    hints: ["Send two alarms after one arming.", "Suppression spends the stored one-use permission.", "The suppressed-alarm branch must leave the silencer unarmed."],
    c: `int n;
READ(n);
int silent = 0;
int heard = 0;
for (int i = 0; i < n; i++) {
    int event;
    READ(event);
    if (event == 1) {
        silent = 1;
    } else if (silent == 1) {
        silent = 0;
    } else {
        heard++;
    }
}
OUT(heard);`,
    py: `n = read_int()
silent = 0
heard = 0
for _ in range(n):
    event = read_int()
    if event == 1:
        silent = 1
    elif silent == 1:
        silent = 0
    else:
        heard += 1
print(heard)`,
    cbug: ["silent = 0;\n    } else", "silent = 1;\n    } else"],
    pybug: ["silent = 0\n    else:", "silent = 1\n    else:"],
    cases: [["3\n1 2 2", "1"], ["2\n2 2", "2"], ["4\n1 2 2 2", "2"], ["0", "0"], ["4\n1 1 2 2", "1"], ["6\n2 1 2 2 1 2", "2"], ["3\n1 1 1", "0"], ["4\n1 2 1 2", "0"]],
    witness: 3,
    probe: ["7\n1 1 2 2 2 1 2", "2"]
  },
  {
    title: "Neighboring Enabled Lamps",
    difficulty: 18,
    guide: "`mask` stores eight lamp flags. `pair` isolates two neighboring positions, and `found` remembers whether any tested pair qualifies.",
    incident: "AEGIS overloaded a lamp strip. Ishan checks whether two neighboring lamps are both on.",
    symptom: "A pair with only one enabled lamp can trigger the warning.",
    task: "Inspect all neighboring pairs among bit positions `0` through `7`. Print `1` if at least one pair contains two set bits, otherwise print `0`. Positions `7` and `0` are not neighbors.",
    input: "Read one integer, `mask`.",
    output: "Print one integer, `1` or `0`.",
    example: "The binary form of `12` is `00001100`. Positions `2` and `3` are both on, so print `1`.",
    constraints: "`0 <= mask <= 255`.",
    defect: "The pair test accepts one set bit instead of requiring both bits.",
    hints: ["Compare binary `10` with binary `11`.", "A two-bit value can be zero, one, two, or three.", "Only the value with both two-bit positions set represents a qualifying pair."],
    c: `int mask;
READ(mask);
int found = 0;
for (int bit = 0; bit < 7; bit++) {
    int pair = (mask >> bit) & 3;
    if (pair == 3) {
        found = 1;
    }
}
OUT(found);`,
    py: `mask = read_int()
found = 0
for bit in range(7):
    pair = (mask >> bit) & 3
    if pair == 3:
        found = 1
print(found)`,
    cbug: ["pair == 3", "pair != 0"],
    pybug: ["pair == 3", "pair != 0"],
    cases: [["12", "1"], ["0", "0"], ["2", "0"], ["3", "1"], ["170", "0"], ["129", "0"], ["192", "1"], ["255", "1"]],
    witness: 3,
    probe: ["85", "0"]
  },
  {
    title: "Two Bit Mode Field",
    difficulty: 15,
    guide: "`word` is an eight-bit value. `offset` locates the lower of two field bits. `shifted` brings the field to the right edge, and `mode` is the extracted value.",
    incident: "AEGIS mixed mode flags with unrelated controls. Mira extracts the two-bit mode field.",
    symptom: "Modes requiring the upper field bit can be shortened to the wrong value.",
    task: "Extract the two consecutive bits at positions `offset` and `offset + 1`. Treat the lower position as value one and the upper as value two. Ignore all other bits and print a value from `0` through `3`.",
    input: "Read `word` and `offset`.",
    output: "Print the extracted mode.",
    example: "For `word = 44` (binary `00101100`) and `offset = 2`, the selected bits are `11`. Print `3`.",
    constraints: "`0 <= word <= 255`; `0 <= offset <= 6`.",
    defect: "The extraction mask retains only the lower field bit.",
    hints: ["Try a field whose two bits are both on.", "Shifting puts the field in place but does not select its width.", "The final mask must retain two low bits rather than one."],
    c: `int word;
int offset;
READ(word);
READ(offset);
int shifted = word >> offset;
int mode = shifted & 3;
OUT(mode);`,
    py: `word = read_int()
offset = read_int()
shifted = word >> offset
mode = shifted & 3
print(mode)`,
    cbug: ["shifted & 3", "shifted & 1"],
    pybug: ["shifted & 3", "shifted & 1"],
    cases: [["44 2", "3"], ["1 0", "1"], ["128 6", "2"], ["0 4", "0"], ["255 0", "3"], ["255 6", "3"], ["32 4", "2"], ["5 1", "2"]],
    witness: 3,
    probe: ["72 3", "1"]
  },
  {
    title: "Equalizer Tick",
    difficulty: 17,
    guide: "`value` is the current dial reading and `target` is fixed. Each loop iteration represents one adjustment tick.",
    incident: "AEGIS jammed a calibration dial. Patch checks its one-unit approach to the target.",
    symptom: "The dial can move away from the target after reaching it.",
    task: "For each of `ticks` steps, increase `value` by one if it is below `target`, decrease it by one if it is above `target`, and leave it unchanged if equal. Make at most one adjustment per tick.",
    input: "Read `value`, `target`, and `ticks`.",
    output: "Print the value after all ticks.",
    example: "Starting at `2` with target `5`, two ticks reach `4`.",
    constraints: "`-100 <= value, target <= 100`; `0 <= ticks <= 200`.",
    defect: "The downward branch includes equality and moves a dial that is already at its target.",
    hints: ["Trace a tick starting exactly at the target.", "An equal reading needs neither upward nor downward movement.", "The downward branch should cover values strictly above the target."],
    c: `int value;
int target;
int ticks;
READ(value);
READ(target);
READ(ticks);
for (int i = 0; i < ticks; i++) {
    if (value < target) {
        value++;
    } else if (value > target) {
        value--;
    }
}
OUT(value);`,
    py: `value = read_int()
target = read_int()
ticks = read_int()
for _ in range(ticks):
    if value < target:
        value += 1
    elif value > target:
        value -= 1
print(value)`,
    cbug: ["value > target", "value >= target"],
    pybug: ["value > target", "value >= target"],
    cases: [["2 5 2", "4"], ["5 5 3", "5"], ["0 0 1", "0"], ["9 3 2", "7"], ["-5 -2 1", "-4"], ["2 5 0", "2"], ["2 5 10", "5"], ["100 -100 200", "-100"]],
    witness: 3,
    probe: ["-10 10 7", "-3"]
  },
  {
    title: "Leap Day Access",
    difficulty: 12,
    guide: "`year` is the calendar year and `leap` is the decision flag. The divisibility tests describe the calendar rules.",
    incident: "AEGIS altered the archive calendar. Ishan checks whether February may contain day twenty-nine.",
    symptom: "Some century years can incorrectly receive a leap day.",
    task: "A year is a leap year if divisible by `400`, or if divisible by `4` but not by `100`. Print `1` for a leap year and `0` otherwise.",
    input: "Read one integer, `year`.",
    output: "Print one integer, `1` or `0`.",
    example: "Year `2000` is divisible by `400`, so print `1`. Year `1900` is a century not divisible by `400`, so print `0`.",
    constraints: "`1 <= year <= 9999`.",
    defect: "The ordinary four-year rule fails to exclude century years.",
    hints: ["Compare years 1900 and 2000.", "Divisibility by four alone is not enough for every year.", "Keep the four-hundred-year exception and exclude other multiples of one hundred from the ordinary branch."],
    c: `int year;
READ(year);
int leap = 0;
if (year % 400 == 0 || (year % 4 == 0 && year % 100 != 0)) {
    leap = 1;
}
OUT(leap);`,
    py: `year = read_int()
leap = 0
if year % 400 == 0 or (year % 4 == 0 and year % 100 != 0):
    leap = 1
print(leap)`,
    cbug: ["year % 4 == 0 && year % 100 != 0", "year % 4 == 0"],
    pybug: ["year % 4 == 0 and year % 100 != 0", "year % 4 == 0"],
    cases: [["2000", "1"], ["2023", "0"], ["1900", "0"], ["2024", "1"], ["2100", "0"], ["2400", "1"], ["1", "0"], ["9999", "0"]],
    witness: 3,
    probe: ["2200", "0"]
  },
  {
    title: "Periodic Bell Phase",
    difficulty: 8,
    guide: "`period` is the repeating cycle length and `phase` is the ringing position inside it. `time` is one query and `ring` is its decision.",
    incident: "AEGIS shifted a warning bell. Mira checks which queried times should ring.",
    symptom: "The bell can use whole cycle counts instead of positions within a cycle.",
    task: "For each queried nonnegative time, print `1` if its remainder on division by `period` equals `phase`; otherwise print `0`. Queries are independent and need not be sorted.",
    input: "Read `period`, `phase`, and `n`, then `n` query times.",
    output: "Print one decision per query, in input order, separated by whitespace.",
    example: "For period `5`, phase `2`, and times `2 7 8`, print `1 1 0`.",
    constraints: "`2 <= period <= 20`; `0 <= phase < period`; `1 <= n <= 100`; `0 <= time <= 10000`.",
    defect: "The phase test uses the quotient rather than the remainder.",
    hints: ["Compare two ringing times separated by one full period.", "A phase repeats after each complete cycle.", "Use the position left within the cycle, rather than the count of complete cycles."],
    c: `int period;
int phase;
int n;
READ(period);
READ(phase);
READ(n);
for (int i = 0; i < n; i++) {
    int time;
    READ(time);
    int ring = 0;
    if (time % period == phase) {
        ring = 1;
    }
    OUT(ring);
}`,
    py: `period = read_int()
phase = read_int()
n = read_int()
for _ in range(n):
    time = read_int()
    ring = 0
    if time % period == phase:
        ring = 1
    print(ring)`,
    cbug: ["time % period == phase", "time / period == phase"],
    pybug: ["time % period == phase", "time // period == phase"],
    cases: [["5 2 3\n2 7 8", "1 1 0"], ["4 0 3\n0 4 8", "1 1 1"], ["3 1 1\n1", "1"], ["20 0 1\n10000", "1"], ["2 1 4\n3 2 1 0", "1 0 1 0"], ["7 6 2\n6 7", "1 0"], ["20 19 2\n19 39", "1 1"], ["3 2 1\n0", "0"]],
    witness: 3,
    probe: ["5 4 4\n9 4 14 0", "1 1 1 0"]
  },
  {
    title: "Nearest Calibration Mark",
    difficulty: 13,
    guide: "`lower` is the last complete calibration mark at or below `value`. `remainder` is the distance above that mark and `rounded` is the selected result.",
    incident: "AEGIS displaced calibration readings. Patch checks rounding to evenly spaced marks.",
    symptom: "A reading exactly halfway between marks can round downward.",
    task: "Marks occur at `0`, `spacing`, `2 * spacing`, and so on. Print the nearest mark to `value`. When exactly halfway between two marks, choose the higher mark.",
    input: "Read `value` and `spacing`.",
    output: "Print the chosen mark as an integer.",
    example: "With `value = 15` and `spacing = 10`, the marks `10` and `20` tie. Print `20`.",
    constraints: "`0 <= value <= 10000`; `1 <= spacing <= 100`.",
    defect: "The upward-rounding check excludes exact halfway ties.",
    hints: ["Try a spacing of ten and a remainder of five.", "Doubling the remainder allows a comparison without fractions.", "Equality in the doubled-distance test belongs with the higher mark."],
    c: `int value;
int spacing;
READ(value);
READ(spacing);
int lower = value / spacing * spacing;
int remainder = value % spacing;
int rounded = lower;
if (2 * remainder >= spacing) {
    rounded += spacing;
}
OUT(rounded);`,
    py: `value = read_int()
spacing = read_int()
lower = value // spacing * spacing
remainder = value % spacing
rounded = lower
if 2 * remainder >= spacing:
    rounded += spacing
print(rounded)`,
    cbug: ["2 * remainder >= spacing", "2 * remainder > spacing"],
    pybug: ["2 * remainder >= spacing", "2 * remainder > spacing"],
    cases: [["15 10", "20"], ["12 10", "10"], ["5 2", "6"], ["0 9", "0"], ["17 10", "20"], ["10 10", "10"], ["14 3", "15"], ["10000 100", "10000"]],
    witness: 3,
    probe: ["25 10", "30"]
  },
  {
    title: "Remembered Fan Band",
    difficulty: 23,
    guide: "`on` stores the fan state. `low` and `high` are different thresholds. A middle-band reading has a different role from a low or high reading.",
    incident: "AEGIS rewrote a cooling controller. Mira checks that the fan remembers its state between thresholds.",
    symptom: "The fan can stop during a middle-band reading.",
    task: "The fan starts off. A reading at least `high` turns it on. A reading at most `low` turns it off. Any reading strictly between `low` and `high` leaves it unchanged. Print the final state.",
    input: "Read `low`, `high`, and `n`, then `n` readings.",
    output: "Print `1` for on or `0` for off.",
    example: "With `low = 3`, `high = 7`, readings `8 5` leave the fan on. Print `1`.",
    constraints: "`0 <= low < high <= 100`; `0 <= n <= 100`; each reading is from `0` to `100`.",
    defect: "Every reading below the high threshold is treated as a switch-off reading.",
    hints: ["Compare a middle reading before and after the fan has turned on.", "Some readings must preserve memory rather than assign a new state.", "Limit the switch-off branch to the lower threshold and values below it."],
    c: `int low;
int high;
int n;
READ(low);
READ(high);
READ(n);
int on = 0;
for (int i = 0; i < n; i++) {
    int reading;
    READ(reading);
    if (reading >= high) {
        on = 1;
    } else if (reading <= low) {
        on = 0;
    }
}
OUT(on);`,
    py: `low = read_int()
high = read_int()
n = read_int()
on = 0
for _ in range(n):
    reading = read_int()
    if reading >= high:
        on = 1
    elif reading <= low:
        on = 0
print(on)`,
    cbug: ["else if (reading <= low)", "else"],
    pybug: ["elif reading <= low:", "else:"],
    cases: [["3 7 2\n8 5", "1"], ["3 7 1\n5", "0"], ["3 7 3\n7 6 4", "1"], ["0 1 0", "0"], ["3 7 2\n7 3", "0"], ["0 100 3\n0 100 50", "1"], ["3 7 3\n8 2 5", "0"], ["3 7 3\n7 7 7", "1"]],
    witness: 3,
    probe: ["2 8 4\n9 6 5 4", "1"]
  },
  {
    title: "Pending Rescue Batch",
    difficulty: 26,
    guide: "`pending` holds unpublished units and `published` holds committed units. Every row supplies `op` and `amount`; only add operations use the amount.",
    incident: "AEGIS mixed draft rescue counts with published counts. Patch checks the small batch controls.",
    symptom: "Discarding a draft can make its units appear in the published total.",
    task: "Both totals start at zero. Operation `1 amount` adds to `pending`. Operation `2 0` publishes all pending units and clears `pending`. Operation `3 0` discards all pending units without publishing them. Unpublished units at the end remain pending.",
    input: "Read `n`, then `n` pairs `op amount`.",
    output: "Print `published` and `pending`, in that order.",
    example: "For operations `1 5`, `2 0`, `1 9`, `3 0`, the final totals are `5 0`.",
    constraints: "`0 <= n <= 100`; `op` is `1`, `2`, or `3`; add amounts are from `0` to `100`; other amounts are zero.",
    defect: "Discard is routed through the publication branch.",
    hints: ["Add a draft and discard it without committing.", "Publishing and discarding both clear the draft but differ in their effect on published units.", "Only the commit operation should add pending units to the published total."],
    c: `int n;
READ(n);
int pending = 0;
int published = 0;
for (int i = 0; i < n; i++) {
    int op;
    int amount;
    READ(op);
    READ(amount);
    if (op == 1) {
        pending += amount;
    } else if (op == 2) {
        published += pending;
        pending = 0;
    } else {
        pending = 0;
    }
}
OUT(published);
OUT(pending);`,
    py: `n = read_int()
pending = 0
published = 0
for _ in range(n):
    op = read_int()
    amount = read_int()
    if op == 1:
        pending += amount
    elif op == 2:
        published += pending
        pending = 0
    else:
        pending = 0
print(published, pending)`,
    cbug: ["op == 2", "op >= 2"],
    pybug: ["op == 2", "op >= 2"],
    cases: [["4\n1 5\n2 0\n1 9\n3 0", "5 0"], ["2\n1 4\n1 3", "0 7"], ["2\n1 8\n3 0", "0 0"], ["0", "0 0"], ["2\n2 0\n3 0", "0 0"], ["4\n1 2\n2 0\n1 3\n2 0", "5 0"], ["3\n1 0\n3 0\n1 6", "0 6"], ["4\n1 100\n3 0\n2 0\n1 1", "0 1"]],
    witness: 3,
    probe: ["5\n1 7\n2 0\n1 2\n3 0\n1 4", "7 4"]
  },
  {
    title: "Muted Desk Rotation",
    difficulty: 27,
    guide: "`active` is a bit mask of enabled desks. `desk` is the next position to inspect. The inner loop searches around the fixed circle.",
    incident: "AEGIS muted some help desks. Ishan checks a rotating dispatcher that must skip every muted desk.",
    symptom: "A run of muted desks can receive a request.",
    task: "Desks are numbered `0` through `desks - 1` in a circle. Start inspecting desk `0`. For each request, skip disabled desks until reaching an enabled desk, print that desk, then begin the next request at the following desk. At least one desk is enabled.",
    input: "Read `desks`, the nonzero enabled-desk mask `active`, and the request count `n`.",
    output: "Print `n` chosen desk numbers in request order.",
    example: "With four desks and `active = 9`, desks `0` and `3` are enabled. Four requests go to `0 3 0 3`.",
    constraints: "`1 <= desks <= 8`; `1 <= active < (1 << desks)`; `1 <= n <= 100`. Bit `i` enables desk `i`.",
    defect: "The skip check advances past at most one disabled desk.",
    hints: ["Place two disabled desks between enabled ones.", "One skipped desk does not guarantee the next desk is enabled.", "Repeat the enabled check after every skip until a usable desk is found."],
    c: `int desks;
int active;
int n;
READ(desks);
READ(active);
READ(n);
int desk = 0;
for (int i = 0; i < n; i++) {
    while ((active & (1 << desk)) == 0) {
        desk = (desk + 1) % desks;
    }
    OUT(desk);
    desk = (desk + 1) % desks;
}`,
    py: `desks = read_int()
active = read_int()
n = read_int()
desk = 0
for _ in range(n):
    while (active & (1 << desk)) == 0:
        desk = (desk + 1) % desks
    print(desk)
    desk = (desk + 1) % desks`,
    cbug: ["while ((active & (1 << desk)) == 0)", "if ((active & (1 << desk)) == 0)"],
    pybug: ["while (active & (1 << desk)) == 0:", "if (active & (1 << desk)) == 0:"],
    cases: [["4 9 4", "0 3 0 3"], ["3 7 4", "0 1 2 0"], ["4 8 2", "3 3"], ["1 1 3", "0 0 0"], ["3 1 3", "0 0 0"], ["5 21 5", "0 2 4 0 2"], ["8 128 2", "7 7"], ["2 2 4", "1 1 1 1"]],
    witness: 3,
    probe: ["6 33 4", "0 5 0 5"]
  },
  {
    title: "Failure Streak Siren",
    difficulty: 22,
    guide: "`streak` counts consecutive failures. `sirens` counts alarms already raised, and `limit` is the number of failures needed for an alarm.",
    incident: "AEGIS caused repeated self-test failures. Mira checks that one failure streak raises one siren.",
    symptom: "A long uninterrupted failure streak can raise a siren repeatedly.",
    task: "Read results in order: `1` is failure and `0` is success. A success resets the consecutive failure count. Raise one siren when a failure streak first reaches `limit`. Further failures in the same streak raise none. A later success allows a new streak to raise another.",
    input: "Read `limit` and `n`, then `n` result flags.",
    output: "Print the number of sirens raised.",
    example: "For limit `2` and results `1 1 1 0 1 1`, the two failure streaks each raise one siren. Print `2`.",
    constraints: "`1 <= limit <= 10`; `0 <= n <= 100`; every result is `0` or `1`.",
    defect: "Every failure at or above the threshold raises another siren.",
    hints: ["Extend one qualifying streak by another failure.", "Reaching the threshold and remaining above it are different events.", "Count the single threshold-reaching value of the streak, while preserving the reset on success."],
    c: `int limit;
int n;
READ(limit);
READ(n);
int streak = 0;
int sirens = 0;
for (int i = 0; i < n; i++) {
    int failed;
    READ(failed);
    if (failed == 0) {
        streak = 0;
    } else {
        streak++;
        if (streak == limit) {
            sirens++;
        }
    }
}
OUT(sirens);`,
    py: `limit = read_int()
n = read_int()
streak = 0
sirens = 0
for _ in range(n):
    failed = read_int()
    if failed == 0:
        streak = 0
    else:
        streak += 1
        if streak == limit:
            sirens += 1
print(sirens)`,
    cbug: ["streak == limit", "streak >= limit"],
    pybug: ["streak == limit", "streak >= limit"],
    cases: [["2 6\n1 1 1 0 1 1", "2"], ["1 3\n1 0 1", "2"], ["2 4\n1 1 1 1", "1"], ["3 0", "0"], ["1 3\n0 0 0", "0"], ["3 2\n1 1", "0"], ["2 8\n1 1 0 1 1 0 1 1", "3"], ["1 5\n1 1 1 0 1", "2"]],
    witness: 3,
    probe: ["3 8\n1 1 1 1 0 1 1 1", "2"]
  },
  {
    title: "Consumed Double Tap",
    difficulty: 28,
    guide: "`waiting` is the time of an unused tap, or `-1` if there is none. `pairs` counts completed pairs and `window` limits their time difference.",
    incident: "AEGIS duplicated console gestures. Patch checks that a tap is used in at most one double tap.",
    symptom: "The second tap of one pair can also become the first tap of another.",
    task: "Process tap times in order. If no tap is waiting, save the new tap. Otherwise, if the new tap is at most `window` time units after the waiting tap, count a pair and consume both. If it is too late, discard the old waiting tap and save the new one instead. Equal timestamps are allowed.",
    input: "Read `window` and `n`, then `n` nondecreasing tap times.",
    output: "Print the number of completed pairs.",
    example: "With window `3` and times `0 2 3`, times `0` and `2` form a pair. Time `3` waits unused. Print `1`.",
    constraints: "`0 <= window <= 20`; `0 <= n <= 100`; `0 <= time <= 1000`; tap times are nondecreasing.",
    defect: "A completed pair keeps its second tap waiting instead of consuming it.",
    hints: ["Try three taps close enough to pair with their neighbors.", "After forming a pair, neither member remains available.", "The pair-completion branch must return waiting to its no-tap state."],
    c: `int window;
int n;
READ(window);
READ(n);
int waiting = -1;
int pairs = 0;
for (int i = 0; i < n; i++) {
    int time;
    READ(time);
    if (waiting == -1) {
        waiting = time;
    } else if (time - waiting <= window) {
        pairs++;
        waiting = -1;
    } else {
        waiting = time;
    }
}
OUT(pairs);`,
    py: `window = read_int()
n = read_int()
waiting = -1
pairs = 0
for _ in range(n):
    time = read_int()
    if waiting == -1:
        waiting = time
    elif time - waiting <= window:
        pairs += 1
        waiting = -1
    else:
        waiting = time
print(pairs)`,
    cbug: ["pairs++;\n        waiting = -1;", "pairs++;\n        waiting = time;"],
    pybug: ["pairs += 1\n        waiting = -1", "pairs += 1\n        waiting = time"],
    cases: [["3 3\n0 2 3", "1"], ["3 2\n0 10", "0"], ["5 4\n1 2 3 4", "2"], ["0 0", "0"], ["0 3\n0 0 0", "1"], ["2 4\n0 5 7 20", "1"], ["20 1\n1", "0"], ["2 5\n0 2 4 6 8", "2"]],
    witness: 3,
    probe: ["1 6\n2 3 4 20 21 22", "2"]
  },
  {
    title: "Relay Timer Phases",
    difficulty: 31,
    guide: "`left` stores remaining ticks for each relay; zero means inactive. `fired` counts completed timers. Each row has a timer-advance phase and a command phase.",
    incident: "AEGIS moved a relay timer phase. Ishan checks when timers expire and commands take effect.",
    symptom: "A newly started timer can expire during the very tick in which it is created.",
    task: "All relay timers start inactive. Each input row is one tick. First decrease every positive timer by one and count each that reaches zero as fired. Then process the row command: `1 id delay` starts or replaces that relay timer, `2 id 0` cancels it, and `0 0 0` changes nothing. A newly started timer is first decreased on the next row. A cancellation cannot undo a firing earlier in the same row.",
    input: "Read `relays` and `n`, then `n` triples `op id delay`.",
    output: "Print the total fired count, followed by the final remaining ticks for relays `0` through `relays - 1`.",
    example: "With one relay and rows `1 0 1`, `0 0 0`, the new timer fires on the second row. Print `1 0`.",
    constraints: "`1 <= relays <= 8`; `0 <= n <= 100`. `op` is `0`, `1`, or `2`. For start or cancel, `0 <= id < relays`. Start delays are from `1` to `10`; unused fields are zero.",
    defect: "The timer-advance phase runs after commands, aging new timers immediately.",
    hints: ["Start a timer on the final input row and inspect its remaining time.", "A row has two ordered phases; a new timer belongs only to the second phase.", "Move the existing-timer advance ahead of command dispatch, preserving both phases."],
    c: `int relays;
int n;
READ(relays);
READ(n);
ARRAY(left, 8);
int fired = 0;
for (int tick = 0; tick < n; tick++) {
    int op;
    int id;
    int delay;
    READ(op);
    READ(id);
    READ(delay);
    for (int relay = 0; relay < relays; relay++) {
        if (left[relay] > 0) {
            left[relay]--;
            if (left[relay] == 0) {
                fired++;
            }
        }
    }
    if (op == 1) {
        left[id] = delay;
    } else if (op == 2) {
        left[id] = 0;
    }
}
OUT(fired);
for (int relay = 0; relay < relays; relay++) {
    OUT(left[relay]);
}`,
    py: `relays = read_int()
n = read_int()
left = [0] * relays
fired = 0
for _ in range(n):
    op = read_int()
    id = read_int()
    delay = read_int()
    for relay in range(relays):
        if left[relay] > 0:
            left[relay] -= 1
            if left[relay] == 0:
                fired += 1
    if op == 1:
        left[id] = delay
    elif op == 2:
        left[id] = 0
print(fired, *left)`,
    cbug: ["    for (int relay = 0; relay < relays; relay++) {\n        if (left[relay] > 0) {\n            left[relay]--;\n            if (left[relay] == 0) {\n                fired++;\n            }\n        }\n    }\n    if (op == 1) {\n        left[id] = delay;\n    } else if (op == 2) {\n        left[id] = 0;\n    }", "    if (op == 1) {\n        left[id] = delay;\n    } else if (op == 2) {\n        left[id] = 0;\n    }\n    for (int relay = 0; relay < relays; relay++) {\n        if (left[relay] > 0) {\n            left[relay]--;\n            if (left[relay] == 0) {\n                fired++;\n            }\n        }\n    }"],
    pybug: ["    for relay in range(relays):\n        if left[relay] > 0:\n            left[relay] -= 1\n            if left[relay] == 0:\n                fired += 1\n    if op == 1:\n        left[id] = delay\n    elif op == 2:\n        left[id] = 0", "    if op == 1:\n        left[id] = delay\n    elif op == 2:\n        left[id] = 0\n    for relay in range(relays):\n        if left[relay] > 0:\n            left[relay] -= 1\n            if left[relay] == 0:\n                fired += 1"],
    cases: [["1 2\n1 0 1\n0 0 0", "1 0"], ["2 0", "0 0 0"], ["1 1\n1 0 1", "0 1"], ["1 3\n1 0 2\n2 0 0\n0 0 0", "0 0"], ["1 2\n1 0 1\n2 0 0", "1 0"], ["1 2\n1 0 3\n1 0 2", "0 2"], ["2 3\n1 0 2\n1 1 1\n0 0 0", "2 0 0"], ["2 3\n1 1 10\n0 0 0\n1 0 2", "0 2 8"]],
    witness: 3,
    probe: ["2 4\n1 0 2\n1 1 3\n2 0 0\n0 0 0", "1 0 1"]
  },
  {
    title: "Lift Direction Interlock",
    difficulty: 32,
    guide: "`floor` stores position. `door` is one when open. `direction` is zero when stopped, one after an upward move, and minus one after a downward move. `blocked` counts rejected movement or opening commands.",
    incident: "AEGIS bypassed a lift interlock. Mira checks movement, stopping, and door commands together.",
    symptom: "A downward move can follow an upward move without the required stop.",
    task: "Start at floor zero, stopped, with the door closed. Command `1` requests one floor up and `2` one floor down. A move succeeds only with a closed door, an in-range destination, and a direction that is stopped or matches the move. A successful move stores its direction. A rejected move changes no state and adds one to `blocked`. Command `3` stops the lift. Command `4` opens the door only while stopped; otherwise it adds one to `blocked`. Command `5` closes the door. Repeated valid stop, open, or close commands are allowed.",
    input: "Read `top` and `n`, then `n` command codes.",
    output: "Print `floor`, `door`, `direction`, and `blocked`, in that order.",
    example: "With top floor `3`, commands `1 2` move up once and reject the reversal. Print `1 0 1 1`.",
    constraints: "`1 <= top <= 20`; `0 <= n <= 100`; every command is from `1` to `5`.",
    defect: "A successful move stores a stopped direction instead of the movement direction.",
    hints: ["Try reversing immediately after a successful move.", "The guard for the next move depends on the direction saved by the previous move.", "After moving, keep the signed movement direction until a stop command clears it."],
    c: `int top;
int n;
READ(top);
READ(n);
int floor = 0;
int door = 0;
int direction = 0;
int blocked = 0;
for (int i = 0; i < n; i++) {
    int op;
    READ(op);
    if (op == 1 || op == 2) {
        int step = 1;
        if (op == 2) {
            step = -1;
        }
        int next = floor + step;
        if (door == 0 && next >= 0 && next <= top && (direction == 0 || direction == step)) {
            floor = next;
            direction = step;
        } else {
            blocked++;
        }
    } else if (op == 3) {
        direction = 0;
    } else if (op == 4) {
        if (direction == 0) {
            door = 1;
        } else {
            blocked++;
        }
    } else {
        door = 0;
    }
}
OUT(floor);
OUT(door);
OUT(direction);
OUT(blocked);`,
    py: `top = read_int()
n = read_int()
floor = 0
door = 0
direction = 0
blocked = 0
for _ in range(n):
    op = read_int()
    if op == 1 or op == 2:
        step = 1
        if op == 2:
            step = -1
        next_floor = floor + step
        if door == 0 and next_floor >= 0 and next_floor <= top and (direction == 0 or direction == step):
            floor = next_floor
            direction = step
        else:
            blocked += 1
    elif op == 3:
        direction = 0
    elif op == 4:
        if direction == 0:
            door = 1
        else:
            blocked += 1
    else:
        door = 0
print(floor, door, direction, blocked)`,
    cbug: ["direction = step;", "direction = 0;"],
    pybug: ["direction = step", "direction = 0"],
    cases: [["3 2\n1 2", "1 0 1 1"], ["2 2\n4 5", "0 0 0 0"], ["2 2\n1 4", "1 0 1 1"], ["1 0", "0 0 0 0"], ["2 5\n2 4 1 5 1", "1 0 1 2"], ["2 5\n1 3 2 3 4", "0 1 0 0"], ["2 5\n1 1 1 3 2", "1 0 -1 1"], ["3 5\n4 4 5 5 3", "0 0 0 0"]],
    witness: 3,
    probe: ["4 7\n1 2 3 4 1 5 2", "0 0 -1 2"]
  },
  {
    title: "One Step Undo Console",
    difficulty: 33,
    guide: "`value` is the displayed number. `undo_value` and `redo_value` store at most one older or newer value. `can_undo` and `can_redo` say which saved value may be used.",
    incident: "AEGIS left a stale redo entry in a repair console. Patch checks its single-step editing history.",
    symptom: "A new edit after an undo can still redo the abandoned edit.",
    task: "Start with the input value and no history. Operation `1 x` replaces the value, saves its old value as the single undo entry, enables undo, and clears redo, even if `x` equals the old value. Operation `2 0` uses an available undo: save the current value for redo, restore the undo value, disable undo, and enable redo. Operation `3 0` uses an available redo in the reverse way. An unavailable undo or redo changes nothing. History has only one entry in each direction, not a stack.",
    input: "Read the initial `value` and `n`, then `n` pairs `op x`. The second field is zero for undo and redo.",
    output: "Print the final `value`, `can_undo`, and `can_redo`, in that order.",
    example: "Starting at `4`, operations `1 9`, `2 0`, `1 7`, `3 0` end at `7`: the new edit clears the old redo. Print `7 1 0`.",
    constraints: "`-100 <= value, x <= 100` for edits; `0 <= n <= 100`; `op` is `1`, `2`, or `3`.",
    defect: "An edit leaves the redo availability flag unchanged.",
    hints: ["Undo an edit, make a different edit, then request redo.", "A new edit starts a new branch of single-step history.", "The edit branch must clear redo availability after saving its undo value."],
    c: `int value;
int n;
READ(value);
READ(n);
int undo_value = 0;
int redo_value = 0;
int can_undo = 0;
int can_redo = 0;
for (int i = 0; i < n; i++) {
    int op;
    int x;
    READ(op);
    READ(x);
    if (op == 1) {
        undo_value = value;
        value = x;
        can_undo = 1;
        can_redo = 0;
    } else if (op == 2 && can_undo == 1) {
        redo_value = value;
        value = undo_value;
        can_undo = 0;
        can_redo = 1;
    } else if (op == 3 && can_redo == 1) {
        undo_value = value;
        value = redo_value;
        can_undo = 1;
        can_redo = 0;
    }
}
OUT(value);
OUT(can_undo);
OUT(can_redo);`,
    py: `value = read_int()
n = read_int()
undo_value = 0
redo_value = 0
can_undo = 0
can_redo = 0
for _ in range(n):
    op = read_int()
    x = read_int()
    if op == 1:
        undo_value = value
        value = x
        can_undo = 1
        can_redo = 0
    elif op == 2 and can_undo == 1:
        redo_value = value
        value = undo_value
        can_undo = 0
        can_redo = 1
    elif op == 3 and can_redo == 1:
        undo_value = value
        value = redo_value
        can_undo = 1
        can_redo = 0
print(value, can_undo, can_redo)`,
    cbug: ["value = x;\n        can_undo = 1;\n        can_redo = 0;", "value = x;\n        can_undo = 1;"],
    pybug: ["value = x\n        can_undo = 1\n        can_redo = 0", "value = x\n        can_undo = 1"],
    cases: [["4 4\n1 9\n2 0\n1 7\n3 0", "7 1 0"], ["4 2\n1 9\n2 0", "4 0 1"], ["2 3\n1 5\n2 0\n1 8", "8 1 0"], ["-3 0", "-3 0 0"], ["6 2\n2 0\n3 0", "6 0 0"], ["1 4\n1 2\n1 3\n2 0\n2 0", "2 0 1"], ["4 4\n1 9\n2 0\n3 0\n2 0", "4 0 1"], ["4 4\n1 4\n2 0\n1 4\n3 0", "4 1 0"]],
    witness: 3,
    probe: ["0 5\n1 -1\n2 0\n1 10\n3 0\n2 0", "0 0 1"]
  },
];
