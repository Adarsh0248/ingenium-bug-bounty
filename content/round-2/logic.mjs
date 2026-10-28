// Private Round 2 logic missions. Cases 1-2 are samples; probes are separate paid examples.
export const logic = [
{
  "title": "Clock Without a Wall",
  "difficulty": 25,
  "guide": "The event type is `type` in C, C++ and Java, and `kind` in Python. `remote` is the sender's event number. A local event has no sender number to use.",
  "incident": "Ishan is checking event numbers in a recovery log.",
  "symptom": "Receiving a message can move the event number too far forward.",
  "task": "Start `clock`, the logical clock, at `0`. A logical clock counts events rather than time of day. A local event adds one. A received event sets the clock to one more than the larger of its current value and the received timestamp. Process all events in input order.",
  "input": "1. Read `n`, the event count.\n2. Read `n` pairs: event type (`type` in C, C++ and Java; `kind` in Python), then `remote`, the sender's timestamp. Type `0` is local and supplies an ignored `remote` value of `0`; type `1` is received.",
  "output": "Print the final `clock` value. With no events, print `0`.",
  "example": "Input `3 0 0 1 5 1 2` gives clock values `1`, `6`, then `7`. Output: `7`.",
  "constraints": "`0 <= n <= 100`. Each event type is `0` or `1`. `0 <= remote <= 1000`; local events supply `0`.",
  "defect": "The receive branch adds a newer remote timestamp instead of adopting it before incrementing.",
  "hints": [
    "Try a received event when `clock` is already positive.",
    "Two event numbers describe positions in two logs; their values should not be added together.",
    "If `remote` is greater than `clock`, assign it to `clock`. Then increment `clock` once for the event."
  ],
  "c": `int n;
READ(n);
int clock = 0;
for (int i = 0; i < n; i++) {
    int type, remote;
    READ(type);
    READ(remote);
    if (type == 1 && remote > clock) {
        clock = remote;
    }
    clock++;
}
OUT(clock);`,
  "py": `n = read_int()
clock = 0
for _ in range(n):
    kind, remote = read_int(), read_int()
    if kind == 1 and remote > clock:
        clock = remote
    clock += 1
print(clock)`,
  "cbug": [
    "clock = remote;",
    "clock += remote;"
  ],
  "pybug": [
    "clock = remote",
    "clock += remote"
  ],
  "cases": [
    [
      "3\n0 0\n1 5\n1 2",
      "7"
    ],
    [
      "2\n1 9\n0 0",
      "11"
    ],
    [
      "2\n0 0\n1 2",
      "3"
    ],
    [
      "0",
      "0"
    ],
    [
      "3\n1 0\n1 0\n1 0",
      "3"
    ],
    [
      "4\n0 0\n0 0\n1 2\n1 4",
      "5"
    ],
    [
      "4\n1 1000\n1 1\n0 0\n1 1000",
      "1004"
    ],
    [
      "5\n1 3\n1 8\n1 8\n1 20\n0 0",
      "22"
    ]
  ],
  "witness": 3,
  "probe": [
    "100\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n0 0\n1 1000",
    "1001"
  ]
},
{
  "title": "Recursive Service Latch",
  "difficulty": 29,
  "guide": "`owner` is the current worker ID, or `-1` when free. `depth` counts that owner's outstanding acquisitions. `denied` counts failed operations.",
  "incident": "Patch is checking shared access to a repair routine.",
  "symptom": "Another worker can acquire the latch while its owner still has an outstanding acquisition.",
  "task": "A latch allows only its owning worker to use a resource. It starts free with `owner = -1` and `depth = 0`. ACQUIRE (`op = 1`) succeeds if the latch is free or already owned by `who`, the requesting worker. A successful acquire makes `who` the owner and adds one outstanding acquisition. RELEASE (`op = 2`) succeeds only for the owner and removes one acquisition. The latch becomes free only when none remain. Every failed operation leaves it unchanged and adds one to the failure count.",
  "input": "1. Read `q`, the operation count.\n2. Read `q` pairs: `op`, the operation code, and `who`, the worker ID. Process them in order.",
  "output": "Print `owner`, `depth`, and `denied`, in that order, separated by spaces.",
  "example": "Input `4 1 0 1 0 2 0 1 1` has worker `0` acquire twice and release once. Worker `1` is then denied. Output: `0 1 1`.",
  "constraints": "`0 <= q <= 100`. `op` is `1` or `2`. `who` is `0`, `1`, or `2`.",
  "defect": "A release clears the owner even when the reentrant depth is still positive.",
  "hints": [
    "Follow two acquisitions and one release by the same worker.",
    "One successful release does not always remove all outstanding acquisitions.",
    "After reducing `depth` on an owner release, set `owner` to `-1` only if `depth == 0`."
  ],
  "c": `int q;
READ(q);
int owner = -1, depth = 0, denied = 0;
for (int i = 0; i < q; i++) {
    int op, who;
    READ(op);
    READ(who);
    if (op == 1 && (owner == -1 || owner == who)) {
        owner = who;
        depth++;
    } else if (op == 2 && owner == who) {
        depth--;
        if (depth == 0) {
            owner = -1;
        }
    } else {
        denied++;
    }
}
OUT(owner);
OUT(depth);
OUT(denied);`,
  "py": `q = read_int()
owner, depth, denied = -1, 0, 0
for _ in range(q):
    op, who = read_int(), read_int()
    if op == 1 and owner in (-1, who):
        owner = who
        depth += 1
    elif op == 2 and owner == who:
        depth -= 1
        if depth == 0:
            owner = -1
    else:
        denied += 1
print(owner, depth, denied)`,
  "cbug": [
    "if (depth == 0)",
    "if (depth >= 0)"
  ],
  "pybug": [
    "if depth == 0:",
    "if depth >= 0:"
  ],
  "cases": [
    [
      "4\n1 0\n1 0\n2 0\n1 1",
      "0 1 1"
    ],
    [
      "2\n1 2\n2 2",
      "-1 0 0"
    ],
    [
      "3\n1 1\n1 1\n2 1",
      "1 1 0"
    ],
    [
      "0",
      "-1 0 0"
    ],
    [
      "3\n2 0\n1 0\n2 1",
      "0 1 2"
    ],
    [
      "6\n1 0\n1 0\n2 0\n2 0\n1 2\n2 2",
      "-1 0 0"
    ],
    [
      "5\n1 2\n1 1\n1 2\n2 2\n1 1",
      "2 1 2"
    ],
    [
      "4\n1 1\n1 1\n1 1\n2 1",
      "1 2 0"
    ]
  ],
  "witness": 3,
  "probe": [
    "100\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n1 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2\n2 2",
    "-1 0 0"
  ]
},
{
  "title": "Barrier Generations",
  "difficulty": 32,
  "guide": "`who` identifies a worker, and `reported` is the meeting number in its signal. `seen` records arrivals, while `count` is how many workers are waiting in the current meeting.",
  "incident": "Mira is checking repeated meetings of calibration workers.",
  "symptom": "Workers counted in the first meeting can be ignored in later meetings.",
  "task": "A barrier is a meeting that completes when all `n` workers have arrived. `generation` numbers these meetings, starting at `0`. An arrival counts only for the current generation and only once per worker in that generation. When all workers arrive, advance to the next generation with no arrivals. Ignore repeated arrivals and arrivals reporting an older or future generation. Process signals in input order.",
  "input": "1. Read `n`, the worker count, and `q`, the signal count.\n2. Read `q` pairs: `who`, the worker ID, and `reported`, its generation number.",
  "output": "Print the current `generation` and its waiting-worker `count`, in that order, separated by a space.",
  "example": "Input `2 3 0 0 1 0 0 1` completes generation `0`, then counts worker `0` in generation `1`. Output: `1 1`.",
  "constraints": "`1 <= n <= 16`. `0 <= q <= 100`. `0 <= who < n`. `0 <= reported <= 100`.",
  "defect": "The per-worker arrival flags are retained when a new barrier generation begins.",
  "hints": [
    "Use the same worker in two successive generations.",
    "A worker's arrival flag applies to one generation only.",
    "When a generation completes, advance `generation`, reset `count`, and clear every entry in `seen`."
  ],
  "c": `int n, q;
READ(n);
READ(q);
ARRAY(seen,16);
int generation = 0, count = 0;
for (int i = 0; i < q; i++) {
    int who, reported;
    READ(who);
    READ(reported);
    if (reported == generation && seen[who] == 0) {
        seen[who] = 1;
        count++;
        if (count == n) {
            generation++;
            count = 0;
            for (int j = 0; j < n; j++) {
                seen[j] = 0;
            }
        }
    }
}
OUT(generation);
OUT(count);`,
  "py": `n, q = read_int(), read_int()
seen = [0] * n
generation = 0
count = 0
for _ in range(q):
    who, reported = read_int(), read_int()
    if reported == generation and seen[who] == 0:
        seen[who] = 1
        count += 1
        if count == n:
            generation += 1
            count = 0
            for j in range(n):
                seen[j] = 0
print(generation, count)`,
  "cbug": [
    "seen[j] = 0;",
    "seen[j] = seen[j];"
  ],
  "pybug": [
    "seen[j] = 0",
    "seen[j] = seen[j]"
  ],
  "cases": [
    [
      "2 3\n0 0\n1 0\n0 1",
      "1 1"
    ],
    [
      "3 3\n0 0\n0 0\n1 0",
      "0 2"
    ],
    [
      "1 3\n0 0\n0 1\n0 2",
      "3 0"
    ],
    [
      "2 0",
      "0 0"
    ],
    [
      "2 5\n0 1\n0 0\n1 0\n1 0\n1 1",
      "1 1"
    ],
    [
      "2 4\n0 0\n1 0\n0 1\n1 1",
      "2 0"
    ],
    [
      "3 7\n0 0\n1 0\n2 0\n2 1\n0 1\n1 1\n1 2",
      "2 1"
    ],
    [
      "2 4\n1 99\n1 0\n0 0\n0 0",
      "1 0"
    ]
  ],
  "witness": 3,
  "probe": [
    "16 17\n0 0\n1 0\n2 0\n3 0\n4 0\n5 0\n6 0\n7 0\n8 0\n9 0\n10 0\n11 0\n12 0\n13 0\n14 0\n15 0\n15 1",
    "1 1"
  ]
},
{
  "title": "Client Receipt Namespaces",
  "difficulty": 34,
  "guide": "A namespace is a separate set of names: request IDs belong to individual clients. `seen` records accepted identities, `total` sums their amounts, and `accepted` counts them.",
  "incident": "Ishan is checking requests from independent clients.",
  "symptom": "A new request can be ignored because another client used the same request ID.",
  "task": "Each client has its own request IDs. Accept the first occurrence of each pair of client ID and request ID. Ignore later occurrences of the same pair, even when their amounts differ. The same request ID from another client is independent. Process requests in order and sum accepted amounts.",
  "input": "1. Read `clients`, the number of clients, and `q`, the request count.\n2. Read `q` triples: `client`, the client ID; `request`, its request ID; and `amount`, the amount to add if accepted.",
  "output": "Print `total`, the accepted amount sum, and `accepted`, the request count, separated by a space. An accepted amount of `0` still counts as a request.",
  "example": "Input `2 3 0 3 5 0 3 99 1 3 7` accepts amounts `5` and `7`; the `99` request is a retry. Output: `12 2`.",
  "constraints": "`1 <= clients <= 8`. `0 <= q <= 100`. `0 <= client < clients`. `0 <= request < 16`. `0 <= amount <= 1000`.",
  "defect": "The deduplication key omits the client namespace.",
  "hints": [
    "Let two different clients send the same request ID.",
    "A retry must match both `client` and `request`.",
    "Use `client * 16 + request` as the index into `seen`, so each client/request pair has its own slot."
  ],
  "c": `int clients, q;
READ(clients);
READ(q);
ARRAY(seen,128);
int total = 0, accepted = 0;
for (int i = 0; i < q; i++) {
    int client, request, amount;
    READ(client);
    READ(request);
    READ(amount);
    int key = client * 16 + request;
    if (seen[key] == 0) {
        seen[key] = 1;
        total += amount;
        accepted++;
    }
}
OUT(total);
OUT(accepted);`,
  "py": `clients, q = read_int(), read_int()
seen = [0] * 128
total = 0
accepted = 0
for _ in range(q):
    client, request, amount = read_int(), read_int(), read_int()
    key = client * 16 + request
    if seen[key] == 0:
        seen[key] = 1
        total += amount
        accepted += 1
print(total, accepted)`,
  "cbug": [
    "client * 16 + request",
    "request"
  ],
  "pybug": [
    "client * 16 + request",
    "request"
  ],
  "cases": [
    [
      "2 3\n0 3 5\n0 3 99\n1 3 7",
      "12 2"
    ],
    [
      "1 2\n0 0 0\n0 0 8",
      "0 1"
    ],
    [
      "3 3\n0 15 1\n1 15 2\n2 15 3",
      "6 3"
    ],
    [
      "8 0",
      "0 0"
    ],
    [
      "1 3\n0 0 1\n0 1 2\n0 2 3",
      "6 3"
    ],
    [
      "2 4\n1 0 1000\n0 0 1000\n1 0 7\n0 0 8",
      "2000 2"
    ],
    [
      "8 2\n7 15 8\n0 15 9",
      "17 2"
    ],
    [
      "2 4\n0 1 4\n1 2 5\n0 2 6\n1 1 7",
      "22 4"
    ]
  ],
  "witness": 3,
  "probe": [
    "8 8\n0 0 1000\n1 0 1000\n2 0 1000\n3 0 1000\n4 0 1000\n5 0 1000\n6 0 1000\n7 0 1000",
    "8000 8"
  ]
},
{
  "title": "Half-Range Sequence Fence",
  "difficulty": 37,
  "guide": "Sequence numbers label packets. After `255` comes `0`. `distance` counts forward steps, and `accepted` counts accepted candidates rather than the starting number.",
  "incident": "Ishan is checking packet numbers that wrap through zero.",
  "symptom": "A packet exactly half the circle away can be accepted and change later decisions.",
  "task": "Start with `current`, the accepted sequence number. For each `candidate` in input order, measure the forward distance from `current` on the circle `0` through `255`. Accept distances `1` through `127`, replacing `current` and counting one acceptance. Reject distance `0` (a duplicate), distance `128` (exactly half the circle), and distances `129` through `255`. Rejection leaves `current` unchanged.",
  "input": "1. Read `current`, the starting number, and `q`, the candidate count.\n2. Read `q` values of `candidate`, in arrival order.",
  "output": "Print the final `current` and `accepted` count, in that order, separated by a space.",
  "example": "Input `250 2 3 131` accepts `3`, which is `9` steps forward. It rejects `131`, which is then `128` steps forward. Output: `3 1`.",
  "constraints": "`0 <= current, candidate <= 255`. `0 <= q <= 100`.",
  "defect": "The acceptance boundary includes the ambiguous half-range distance.",
  "hints": [
    "Compare a forward distance of `127` with one of `128`.",
    "Exactly half a circle is ambiguous and must be rejected.",
    "Accept only when `distance > 0 && distance < 128` in C, C++ and Java, or the equivalent condition in Python."
  ],
  "c": `int current, q;
READ(current);
READ(q);
int accepted = 0;
for (int i = 0; i < q; i++) {
    int candidate;
    READ(candidate);
    int distance = (candidate - current + 256) % 256;
    if (distance > 0 && distance < 128) {
        current = candidate;
        accepted++;
    }
}
OUT(current);
OUT(accepted);`,
  "py": `current, q = read_int(), read_int()
accepted = 0
for _ in range(q):
    candidate = read_int()
    distance = (candidate - current + 256) % 256
    if distance > 0 and distance < 128:
        current = candidate
        accepted += 1
print(current, accepted)`,
  "cbug": [
    "distance < 128",
    "distance <= 128"
  ],
  "pybug": [
    "distance < 128",
    "distance <= 128"
  ],
  "cases": [
    [
      "250 2\n3 131",
      "3 1"
    ],
    [
      "0 2\n127 254",
      "254 2"
    ],
    [
      "0 1\n128",
      "0 0"
    ],
    [
      "255 0",
      "255 0"
    ],
    [
      "100 4\n100 99 101 100",
      "101 1"
    ],
    [
      "200 3\n72 201 73",
      "201 1"
    ],
    [
      "0 5\n127 254 125 252 123",
      "123 5"
    ],
    [
      "255 3\n0 128 1",
      "1 2"
    ]
  ],
  "witness": 3,
  "probe": [
    "0 3\n128 127 255",
    "127 1"
  ]
},
{
  "title": "Binary Residue Gate",
  "difficulty": 40,
  "guide": "A residue is the remainder after division. `state` is the remainder for the digits read so far; `bit` is the next digit's numeric value.",
  "incident": "Patch is checking a binary recovery identifier.",
  "symptom": "The result can depend on how many `1` digits appear instead of the number's value.",
  "task": "Decide whether `word`, a binary identifier, represents a number divisible by `3`. Binary means base two, using only digits `0` and `1`. Read left to right and maintain only a remainder; do not convert the whole word to a built-in integer. Leading zeros are allowed, and a value of zero is divisible by `3`.",
  "input": "Read `word`, one nonempty sequence of binary digits with no spaces.",
  "output": "Print `YES` if the number is divisible by `3`; otherwise print `NO`.",
  "example": "Input `11` is binary for `3`, so output `YES`. Input `10` is binary for `2`, so output `NO`.",
  "constraints": "The length of `word` is from `1` to `200`. Every character is `0` or `1`. Use bounded remainder arithmetic rather than whole-word integer conversion.",
  "defect": "The transition adds the new bit without doubling the previous remainder for its binary place value.",
  "hints": [
    "Appending a binary digit changes the value of the earlier digits.",
    "Appending `bit` doubles the previous number, then adds `bit`.",
    "Update the remainder with `state = (2 * state + bit) % 3`; it stays between `0` and `2`."
  ],
  "c": `TEXT(word);
WORD(word);
int state = 0;
for (int i = 0; i < LEN(word); i++) {
    int bit = CHAR(word,i) - '0';
    state = (2 * state + bit) % 3;
}
if (state == 0) {
    SAY("YES");
} else {
    SAY("NO");
}`,
  "py": `word = read_word()
state = 0
for digit in word:
    bit = int(digit)
    state = (2 * state + bit) % 3
print("YES" if state == 0 else "NO")`,
  "cbug": [
    "2 * state + bit",
    "state + bit"
  ],
  "pybug": [
    "2 * state + bit",
    "state + bit"
  ],
  "cases": [
    [
      "11",
      "YES"
    ],
    [
      "10",
      "NO"
    ],
    [
      "110",
      "YES"
    ],
    [
      "0",
      "YES"
    ],
    [
      "1",
      "NO"
    ],
    [
      "00000011",
      "YES"
    ],
    [
      "11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
      "YES"
    ],
    [
      "1010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101",
      "NO"
    ]
  ],
  "witness": 3,
  "probe": [
    "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011",
    "YES"
  ]
},
{
  "title": "Quiet Shift Planner",
  "difficulty": 43,
  "guide": "`skip` and `take` describe the best totals so far when the latest day was skipped or chosen. The answer is a value total; no day list is required.",
  "incident": "Mira is choosing repair days with a rest day between them.",
  "symptom": "The reported total can include repairs on consecutive days.",
  "task": "Days are numbered from `0` in input order. Each day offers an optional repair with a nonnegative `value`. Choose days with the largest total value, with no two chosen day numbers differing by one. Choosing no days is allowed and gives `0`.",
  "input": "1. Read `n`, the number of days.\n2. Read `n` repair values in day order, each read as `value`.",
  "output": "Print the largest possible total value. With no days, print `0`.",
  "example": "Input `3 5 6 5` is best served by days `0` and `2`, for `5 + 5`. Output: `10`.",
  "constraints": "`0 <= n <= 16`. Each `value` is from `0` to `1000`.",
  "defect": "The take transition extends the best previous total rather than only the total that skipped the previous day.",
  "hints": [
    "If today is chosen, can yesterday also be chosen?",
    "The best total through yesterday may include yesterday's repair.",
    "Build today's `take` from yesterday's `skip` only. Build today's `skip` from the larger old state, using saved values for both updates."
  ],
  "c": `int n;
READ(n);
int skip = 0, take = 0;
for (int i = 0; i < n; i++) {
    int value;
    READ(value);
    int oldSkip = skip, oldTake = take;
    skip = oldSkip;
    if (oldTake > skip) {
        skip = oldTake;
    }
    take = oldSkip + value;
}
int answer = skip;
if (take > answer) {
    answer = take;
}
OUT(answer);`,
  "py": `n = read_int()
skip = 0
take = 0
for _ in range(n):
    value = read_int()
    old_skip, old_take = skip, take
    skip = max(old_skip, old_take)
    take = old_skip + value
print(max(skip, take))`,
  "cbug": [
    "take = oldSkip + value;",
    "take = skip + value;"
  ],
  "pybug": [
    "take = old_skip + value",
    "take = skip + value"
  ],
  "cases": [
    [
      "3\n5 6 5",
      "10"
    ],
    [
      "1\n8",
      "8"
    ],
    [
      "2\n7 9",
      "9"
    ],
    [
      "0",
      "0"
    ],
    [
      "4\n0 0 0 0",
      "0"
    ],
    [
      "5\n9 1 9 1 9",
      "27"
    ],
    [
      "4\n1 100 100 1",
      "101"
    ],
    [
      "16\n1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000",
      "8000"
    ]
  ],
  "witness": 3,
  "probe": [
    "16\n0 0 0 0 0 0 0 0 0 0 0 0 0 0 1000 1000",
    "1000"
  ]
},
{
  "title": "Borrowed Quantum",
  "difficulty": 45,
  "guide": "This repeating turn order is called round-robin scheduling. `remaining` holds unfinished work, `elapsed` is time used, and `finished` holds completion times.",
  "incident": "Patch is checking when shared-processor jobs finish.",
  "symptom": "A short final turn can add too much time to the completion report.",
  "task": "All `n` jobs are ready at time `0`. Visit jobs `0` through `n - 1` repeatedly, skipping completed jobs. On each turn, run a job for its remaining work or `quantum`, whichever is smaller. The quantum is the maximum length of one turn. Time advances only by work actually done; switching jobs costs no time. Record the elapsed time at each job's completion.",
  "input": "1. Read `n`, the job count, and `quantum`, the maximum work per turn.\n2. Read `remaining[0]` through `remaining[n - 1]`, the initial work of each job in job ID order.",
  "output": "Print the `n` completion times from `finished` in job ID order, separated by spaces.",
  "example": "Input `2 3 4 2` uses turns of `3`, `2`, then `1` time units. Job `1` finishes at `5`; job `0` finishes at `6`. Output: `6 5`.",
  "constraints": "`1 <= n <= 20`. `1 <= quantum <= 20`. Each initial work value is from `1` to `100`.",
  "defect": "Elapsed time advances by a full quantum even for a shorter final turn.",
  "hints": [
    "Try a job whose remaining work is smaller than `quantum`.",
    "The time added must match the work removed on that turn.",
    "Set `used` to the smaller of `quantum` and remaining work. Add `used` to `elapsed` before recording completion."
  ],
  "c": `int n, quantum;
READ(n);
READ(quantum);
ARRAY(remaining,20);
ARRAY(finished,20);
for (int i = 0; i < n; i++) {
    READ(remaining[i]);
}
int left = n, elapsed = 0;
while (left > 0) {
    for (int i = 0; i < n; i++) {
        if (remaining[i] > 0) {
            int used = quantum;
            if (remaining[i] < used) {
                used = remaining[i];
            }
            remaining[i] -= used;
            elapsed += used;
            if (remaining[i] == 0) {
                finished[i] = elapsed;
                left--;
            }
        }
    }
}
for (int i = 0; i < n; i++) {
    OUT(finished[i]);
}`,
  "py": `n, quantum = read_int(), read_int()
remaining = [read_int() for _ in range(n)]
finished = [0] * n
left = n
elapsed = 0
while left > 0:
    for i in range(n):
        if remaining[i] > 0:
            used = min(quantum, remaining[i])
            remaining[i] -= used
            elapsed += used
            if remaining[i] == 0:
                finished[i] = elapsed
                left -= 1
print(*finished)`,
  "cbug": [
    "elapsed += used;",
    "elapsed += quantum;"
  ],
  "pybug": [
    "elapsed += used",
    "elapsed += quantum"
  ],
  "cases": [
    [
      "2 3\n4 2",
      "6 5"
    ],
    [
      "2 2\n2 4",
      "2 6"
    ],
    [
      "1 20\n1",
      "1"
    ],
    [
      "3 1\n1 2 3",
      "1 4 6"
    ],
    [
      "3 5\n1 1 1",
      "1 2 3"
    ],
    [
      "4 3\n6 1 7 3",
      "13 4 17 10"
    ],
    [
      "2 20\n100 99",
      "180 199"
    ],
    [
      "20 20\n100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100",
      "1620 1640 1660 1680 1700 1720 1740 1760 1780 1800 1820 1840 1860 1880 1900 1920 1940 1960 1980 2000"
    ]
  ],
  "witness": 3,
  "probe": [
    "1 20\n99",
    "99"
  ]
},
{
  "title": "One-Use Repair Kits",
  "difficulty": 48,
  "guide": "`best[b]` is the largest value possible with spending at most `b`. Each input pair gives one kit's `cost` and `value`.",
  "incident": "Mira is choosing physical repair kits within a budget.",
  "symptom": "The reported value can use the same physical kit more than once.",
  "task": "Choose a subset of the `n` kits with total cost at most `budget`. A subset chooses each input kit at most once. Kits on different input rows are different kits, even if their costs and values match. Maximize the sum of values. Choosing none is allowed and gives `0`.",
  "input": "1. Read `n`, the kit count, and `budget`, the spending limit.\n2. Read `n` pairs: `cost`, then `value`, for one kit each.",
  "output": "Print the maximum total value within `budget`. No list of kits is required.",
  "example": "Input `1 4 2 5` offers one kit costing `2` with value `5`. It can be chosen once despite the budget of `4`. Output: `5`.",
  "constraints": "`0 <= n <= 16`. `0 <= budget <= 100`. `1 <= cost <= 100`. `0 <= value <= 1000`.",
  "defect": "Ascending in-place budget updates reuse the current kit within its own pass.",
  "hints": [
    "Use one kit and a budget large enough to pay for it twice.",
    "An update must not extend a result that already used the current kit.",
    "For each kit, visit budget values from high to low, so `best[b - cost]` still excludes that kit."
  ],
  "c": `int n, budget;
READ(n);
READ(budget);
ARRAY(best,101);
for (int i = 0; i < n; i++) {
    int cost, value;
    READ(cost);
    READ(value);
    for (int b = budget; b >= cost; b--) {
        int candidate = best[b - cost] + value;
        if (candidate > best[b]) {
            best[b] = candidate;
        }
    }
}
OUT(best[budget]);`,
  "py": `n, budget = read_int(), read_int()
best = [0] * (budget + 1)
for _ in range(n):
    cost, value = read_int(), read_int()
    for b in range(budget, cost - 1, -1):
        candidate = best[b - cost] + value
        if candidate > best[b]:
            best[b] = candidate
print(best[budget])`,
  "cbug": [
    "for (int b = budget; b >= cost; b--)",
    "for (int b = cost; b <= budget; b++)"
  ],
  "pybug": [
    "range(budget, cost - 1, -1)",
    "range(cost, budget + 1)"
  ],
  "cases": [
    [
      "1 4\n2 5",
      "5"
    ],
    [
      "2 3\n2 5\n3 8",
      "8"
    ],
    [
      "1 6\n2 4",
      "4"
    ],
    [
      "0 10",
      "0"
    ],
    [
      "2 0\n1 10\n2 20",
      "0"
    ],
    [
      "3 5\n2 6\n3 7\n5 12",
      "13"
    ],
    [
      "3 4\n2 5\n2 5\n100 1000",
      "10"
    ],
    [
      "16 100\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000\n10 1000",
      "10000"
    ]
  ],
  "witness": 3,
  "probe": [
    "16 100\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000\n1 1000",
    "16000"
  ]
},
{
  "title": "Unordered Power Credits",
  "difficulty": 50,
  "guide": "`coins` holds the denomination values. `ways[total]` counts payments for exactly `total`, rather than payments up to that total.",
  "incident": "Patch is counting ways to pay an exact energy charge.",
  "symptom": "The counter treats different orders of the same credits as different payments.",
  "task": "A denomination is the value of one credit. Use unlimited copies of the `n` distinct denominations to pay exactly `amount`. Two payments are the same when they use the same count of every denomination, regardless of insertion order. Count the empty payment once when `amount = 0`.",
  "input": "1. Read `n`, the denomination count, and `amount`, the required payment.\n2. Read the `n` distinct values in `coins`, in any order.",
  "output": "Print the number of different payments for exactly `amount`. Print `0` if no payment is possible.",
  "example": "Input `2 3 1 2` has two payments: `1 + 1 + 1` and `1 + 2`. Reversing `1 + 2` adds no new payment. Output: `2`.",
  "constraints": "`1 <= n <= 5`. `0 <= amount <= 30`. Denominations are distinct integers from `1` to `30`. The answer fits a signed 32-bit integer.",
  "defect": "Putting the amount loop outside the denomination loop counts ordered sequences instead of denomination combinations.",
  "hints": [
    "List the payments for amount `3` using denominations `1` and `2`.",
    "Each combination of credit counts must be built in only one denomination order.",
    "Put the denomination loop outside the amount loop. For each denomination, update totals upward to allow unlimited copies without counting insertion orders."
  ],
  "c": `int n, amount;
READ(n);
READ(amount);
ARRAY(coins,5);
ARRAY(ways,31);
for (int i = 0; i < n; i++) {
    READ(coins[i]);
}
ways[0] = 1;
for (int i = 0; i < n; i++) {
    for (int total = 1; total <= amount; total++) {
        if (coins[i] <= total) {
            ways[total] += ways[total - coins[i]];
        }
    }
}
OUT(ways[amount]);`,
  "py": `n, amount = read_int(), read_int()
coins = [read_int() for _ in range(n)]
ways = [0] * (amount + 1)
ways[0] = 1
for i in range(n):
    for total in range(1, amount + 1):
        if coins[i] <= total:
            ways[total] += ways[total - coins[i]]
print(ways[amount])`,
  "cbug": [
    "for (int i = 0; i < n; i++) {\n    for (int total = 1; total <= amount; total++) {",
    "for (int total = 1; total <= amount; total++) {\n    for (int i = 0; i < n; i++) {"
  ],
  "pybug": [
    "for i in range(n):\n    for total in range(1, amount + 1):",
    "for total in range(1, amount + 1):\n    for i in range(n):"
  ],
  "cases": [
    [
      "2 3\n1 2",
      "2"
    ],
    [
      "1 3\n2",
      "0"
    ],
    [
      "3 4\n1 2 3",
      "4"
    ],
    [
      "2 0\n3 7",
      "1"
    ],
    [
      "2 5\n5 1",
      "2"
    ],
    [
      "3 8\n2 4 6",
      "4"
    ],
    [
      "5 30\n1 2 3 4 5",
      "674"
    ],
    [
      "2 30\n29 30",
      "1"
    ]
  ],
  "witness": 3,
  "probe": [
    "5 30\n1 2 3 4 30",
    "298"
  ]
},
{
  "title": "Snapshot Write Sets",
  "difficulty": 52,
  "guide": "`current` holds committed values, meaning values already published. `saved` holds private copies. A `dirty` flag marks a cell written by that transaction. `t` identifies the transaction.",
  "incident": "Mira is checking concurrent edits to stored settings.",
  "symptom": "Committing a transaction can overwrite a newer stored value in a cell it never wrote.",
  "task": "A transaction is a group of private edits; a snapshot is its copy of the stored values at BEGIN. Process operations in order. BEGIN (`op = 0`) takes a snapshot. WRITE (`op = 1`) changes one private cell. READ (`op = 2`) reports that private value, including the transaction's own writes. COMMIT (`op = 3`) publishes only cells the transaction wrote, then ends it. Other stored cells stay unchanged. No commit is rejected; if several transactions write one cell, the later commit wins for that cell.",
  "input": "1. Read `m`, the cell count, `transactions`, the transaction count, and `q`, the operation count.\n2. Read `m` initial values for `current`, in cell ID order.\n3. Read `q` rows: `op`, `t`, `cell`, `value`. For BEGIN and COMMIT, the last two values are ignored `0 0`. For READ, `value` is ignored `0`.",
  "output": "Print READ results in operation order, then all `m` final committed values in cell ID order. Separate all output values with whitespace. BEGIN, WRITE, and COMMIT print nothing.",
  "example": "In the first sample, both transactions start from `0 0`. Transaction `0` commits `7` to cell `0`; transaction `1` commits `9` only to cell `1`. Its older copy of cell `0` has no effect. Output: `7 9`.",
  "constraints": "`1 <= m, transactions <= 8`. `0 <= q <= 100`. `0 <= t < transactions`; `0 <= cell < m`. `op` is `0`, `1`, `2`, or `3`. Values are from `0` to `1000`. Each used transaction begins once; reads and writes occur only while active, before its only COMMIT, if any. Unused transaction IDs and unfinished transactions are allowed.",
  "defect": "Commit copies clean snapshot cells as well as written cells, causing unrelated lost updates.",
  "hints": [
    "Start two transactions before either commits, then have them write different cells.",
    "A private snapshot may contain old values in cells that were never written.",
    "At COMMIT, copy `saved` back to `current` only where that transaction's `dirty` flag is set."
  ],
  "c": `int m, transactions, q;
READ(m);
READ(transactions);
READ(q);
ARRAY(current,8);
ARRAY(saved,64);
ARRAY(dirty,64);
for (int j = 0; j < m; j++) {
    READ(current[j]);
}
for (int i = 0; i < q; i++) {
    int op, t, cell, value;
    READ(op);
    READ(t);
    READ(cell);
    READ(value);
    if (op == 0) {
        for (int j = 0; j < m; j++) {
            saved[t * m + j] = current[j];
            dirty[t * m + j] = 0;
        }
    } else if (op == 1) {
        saved[t * m + cell] = value;
        dirty[t * m + cell] = 1;
    } else if (op == 2) {
        OUT(saved[t * m + cell]);
    } else {
        for (int j = 0; j < m; j++) {
            if (dirty[t * m + j] == 1) {
                current[j] = saved[t * m + j];
            }
        }
    }
}
for (int j = 0; j < m; j++) {
    OUT(current[j]);
}`,
  "py": `m, transactions, q = read_int(), read_int(), read_int()
current = [read_int() for _ in range(m)]
saved = [0] * (transactions * m)
dirty = [0] * (transactions * m)
for _ in range(q):
    op, t, cell, value = read_int(), read_int(), read_int(), read_int()
    if op == 0:
        for j in range(m):
            saved[t * m + j] = current[j]
            dirty[t * m + j] = 0
    elif op == 1:
        saved[t * m + cell] = value
        dirty[t * m + cell] = 1
    elif op == 2:
        print(saved[t * m + cell])
    else:
        for j in range(m):
            if dirty[t * m + j] == 1:
                current[j] = saved[t * m + j]
print(*current)`,
  "cbug": [
    "dirty[t * m + j] == 1",
    "dirty[t * m + j] >= 0"
  ],
  "pybug": [
    "dirty[t * m + j] == 1",
    "dirty[t * m + j] >= 0"
  ],
  "cases": [
    [
      "2 2 6\n0 0\n0 0 0 0\n0 1 0 0\n1 0 0 7\n3 0 0 0\n1 1 1 9\n3 1 0 0",
      "7 9"
    ],
    [
      "1 1 4\n5\n0 0 0 0\n1 0 0 8\n2 0 0 0\n3 0 0 0",
      "8 8"
    ],
    [
      "1 2 5\n4\n0 0 0 0\n0 1 0 0\n1 0 0 9\n3 0 0 0\n3 1 0 0",
      "9"
    ],
    [
      "2 1 0\n3 4",
      "3 4"
    ],
    [
      "2 2 6\n1 2\n0 0 0 0\n0 1 0 0\n1 0 1 7\n3 0 0 0\n2 1 1 0\n3 1 0 0",
      "2 1 7"
    ],
    [
      "1 2 6\n0\n0 0 0 0\n0 1 0 0\n1 0 0 2\n1 1 0 3\n3 0 0 0\n3 1 0 0",
      "3"
    ],
    [
      "2 1 3\n1 2\n0 0 0 0\n1 0 0 10\n2 0 0 0",
      "10 1 2"
    ],
    [
      "2 2 7\n0 0\n0 0 0 0\n1 0 0 7\n3 0 0 0\n0 1 0 0\n2 1 0 0\n1 1 1 8\n3 1 0 0",
      "7 7 8"
    ]
  ],
  "witness": 3,
  "probe": [
    "8 8 5\n0 0 0 0 0 0 0 0\n0 0 0 0\n0 7 0 0\n1 7 7 1000\n3 7 0 0\n3 0 0 0",
    "0 0 0 0 0 0 0 1000"
  ]
},
{
  "title": "Causal Fingerprints",
  "difficulty": 54,
  "guide": "`a` and `b` are compared component by component, not as whole numbers or sums. `less` and `greater` count comparisons pointing in each direction.",
  "incident": "Ishan is comparing event records from several services.",
  "symptom": "A vector can be reported as earlier even though one of its components is later.",
  "task": "A vector clock is a list of event counts, one per service. Compare `a` and `b` at matching positions. The result is `EQUAL` if all components match. It is `BEFORE` if every component of `a` is at most the matching component of `b`, and at least one is smaller. Use `AFTER` for the reverse relation. In all other cases use `CONCURRENT`, meaning neither vector is entirely before the other.",
  "input": "1. Read `n`, the number of components in each vector.\n2. Read all `n` components of `a`.\n3. Read all `n` components of `b`, in matching service order.",
  "output": "Print exactly one of `EQUAL`, `BEFORE`, `AFTER`, or `CONCURRENT`.",
  "example": "Input `2 1 2 2 1` gives `a = (1, 2)` and `b = (2, 1)`. Each is ahead in one component. Output: `CONCURRENT`.",
  "constraints": "`1 <= n <= 16`. Each component of `a` and `b` is from `0` to `1000000`.",
  "defect": "The BEFORE branch checks for a smaller component but does not exclude a greater component.",
  "hints": [
    "Try vectors where each is smaller in a different position.",
    "One smaller component cannot prove `BEFORE` if another component is greater.",
    "Require `less > 0` and `greater == 0` for `BEFORE`. Reverse the checks for `AFTER`; no differences means `EQUAL`, and mixed directions mean `CONCURRENT`."
  ],
  "c": `int n;
READ(n);
ARRAY(a,16);
ARRAY(b,16);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int i = 0; i < n; i++) {
    READ(b[i]);
}
int less = 0, greater = 0;
for (int i = 0; i < n; i++) {
    if (a[i] < b[i]) {
        less++;
    }
    if (a[i] > b[i]) {
        greater++;
    }
}
if (less > 0 && greater == 0) {
    SAY("BEFORE");
} else if (greater > 0 && less == 0) {
    SAY("AFTER");
} else if (less == 0 && greater == 0) {
    SAY("EQUAL");
} else {
    SAY("CONCURRENT");
}`,
  "py": `n = read_int()
a = [read_int() for _ in range(n)]
b = [read_int() for _ in range(n)]
less = 0
greater = 0
for i in range(n):
    if a[i] < b[i]:
        less += 1
    if a[i] > b[i]:
        greater += 1
if less > 0 and greater == 0:
    print("BEFORE")
elif greater > 0 and less == 0:
    print("AFTER")
elif less == 0 and greater == 0:
    print("EQUAL")
else:
    print("CONCURRENT")`,
  "cbug": [
    "less > 0 && greater == 0",
    "less > 0"
  ],
  "pybug": [
    "less > 0 and greater == 0",
    "less > 0"
  ],
  "cases": [
    [
      "2\n1 2\n2 1",
      "CONCURRENT"
    ],
    [
      "2\n1 2\n1 3",
      "BEFORE"
    ],
    [
      "3\n4 1 7\n2 3 7",
      "CONCURRENT"
    ],
    [
      "1\n0\n0",
      "EQUAL"
    ],
    [
      "1\n9\n2",
      "AFTER"
    ],
    [
      "3\n0 0 0\n0 0 1",
      "BEFORE"
    ],
    [
      "3\n5 5 5\n5 5 4",
      "AFTER"
    ],
    [
      "16\n1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 0\n0 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000",
      "CONCURRENT"
    ]
  ],
  "witness": 3,
  "probe": [
    "16\n1000000 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n0 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000 1000000",
    "CONCURRENT"
  ]
},
{
  "title": "The First Release Rule",
  "difficulty": 56,
  "guide": "`owner` stores each lock's transaction ID, or `-1` when free. `shrinking` marks a transaction in its release-only phase. `denied` counts failed operations.",
  "incident": "Mira is checking requests for exclusive access to resources.",
  "symptom": "A transaction can release one lock and then acquire another while still holding an older lock.",
  "task": "A lock grants exclusive access to one transaction, a group of operations. All locks start free. ACQUIRE (`op = 1`) succeeds only if the lock is free and the transaction has never successfully released any lock. Acquiring a lock already owned by that same transaction also fails. RELEASE (`op = 2`) succeeds only for the owner, frees the lock, and permanently prevents that transaction from acquiring any lock again. It may still release its other locks. Count failed operations; they have no other effect. Process operations in order.",
  "input": "1. Read `transactions`, the transaction count, `m`, the lock count, and `q`, the operation count.\n2. Read `q` triples: `op`, the operation; `t`, the transaction ID; and `lock`, the lock ID.",
  "output": "Print `denied`, then each lock's final `owner` in lock ID order, separated by spaces. Use `-1` for a free lock.",
  "example": "Input `1 3 4 1 0 0 1 0 1 2 0 0 1 0 2` lets transaction `0` acquire locks `0` and `1`, then release lock `0`. Its later acquisition of lock `2` fails. Output: `1 -1 0 -1`.",
  "constraints": "`1 <= transactions, m <= 8`. `0 <= q <= 100`. `0 <= t < transactions`. `0 <= lock < m`. `op` is `1` or `2`.",
  "defect": "Shrinking begins only after the last held lock is released instead of after the first successful release.",
  "hints": [
    "Release one lock while the transaction still holds another, then try a new acquisition.",
    "The phase changes at the first successful release, regardless of how many locks remain.",
    "Set `shrinking[t]` after every successful release. Do not wait for `held[t]`, the held-lock count, to reach `0`."
  ],
  "c": `int transactions, m, q;
READ(transactions);
READ(m);
READ(q);
ARRAY(owner,8);
ARRAY(held,8);
ARRAY(shrinking,8);
for (int i = 0; i < m; i++) {
    owner[i] = -1;
}
int denied = 0;
for (int i = 0; i < q; i++) {
    int op, t, lock;
    READ(op);
    READ(t);
    READ(lock);
    if (op == 1 && shrinking[t] == 0 && owner[lock] == -1) {
        owner[lock] = t;
        held[t]++;
    } else if (op == 2 && owner[lock] == t) {
        owner[lock] = -1;
        held[t]--;
        shrinking[t] = 1;
    } else {
        denied++;
    }
}
OUT(denied);
for (int i = 0; i < m; i++) {
    OUT(owner[i]);
}`,
  "py": `transactions, m, q = read_int(), read_int(), read_int()
owner = [-1] * m
held = [0] * transactions
shrinking = [0] * transactions
denied = 0
for _ in range(q):
    op, t, lock = read_int(), read_int(), read_int()
    if op == 1 and shrinking[t] == 0 and owner[lock] == -1:
        owner[lock] = t
        held[t] += 1
    elif op == 2 and owner[lock] == t:
        owner[lock] = -1
        held[t] -= 1
        shrinking[t] = 1
    else:
        denied += 1
print(denied, *owner)`,
  "cbug": [
    "shrinking[t] = 1;",
    "shrinking[t] = held[t] == 0 ? 1 : 0;"
  ],
  "pybug": [
    "shrinking[t] = 1",
    "shrinking[t] = int(held[t] == 0)"
  ],
  "cases": [
    [
      "1 3 4\n1 0 0\n1 0 1\n2 0 0\n1 0 2",
      "1 -1 0 -1"
    ],
    [
      "1 1 3\n1 0 0\n2 0 0\n1 0 0",
      "1 -1"
    ],
    [
      "2 2 5\n1 0 0\n1 0 1\n2 0 1\n1 1 1\n1 0 1",
      "1 0 1"
    ],
    [
      "2 2 0",
      "0 -1 -1"
    ],
    [
      "1 2 3\n2 0 0\n1 0 0\n1 0 1",
      "1 0 0"
    ],
    [
      "2 2 4\n1 0 0\n2 1 0\n1 1 1\n1 0 0",
      "2 0 1"
    ],
    [
      "1 3 6\n1 0 0\n1 0 1\n2 0 0\n1 0 2\n2 0 1\n1 0 0",
      "2 -1 -1 -1"
    ],
    [
      "2 2 6\n1 0 0\n1 0 1\n2 0 0\n2 0 1\n1 1 0\n1 1 1",
      "0 1 1"
    ]
  ],
  "witness": 7,
  "probe": [
    "1 8 10\n1 0 0\n1 0 1\n1 0 2\n1 0 3\n1 0 4\n1 0 5\n1 0 6\n1 0 7\n2 0 0\n1 0 0",
    "1 -1 0 0 0 0 0 0 0"
  ]
},
{
  "title": "Borrowed Resources Return",
  "difficulty": 59,
  "guide": "A resource vector is a list of counts, one per resource type. `work` is the currently free vector in the simulation. `done` marks services already finished.",
  "incident": "Ishan is checking whether every service can finish with limited resources.",
  "symptom": "The simulation can gain or lose resources incorrectly when a service finishes.",
  "task": "For each service and resource type, `allocation` is the amount already held, and `maximum` is the largest total it may need. Its remaining need is `maximum - allocation`. In a simulated completion order, a service can finish if every remaining need is at most the corresponding free amount. After finishing, it releases its originally held resources. Decide whether some completion order lets all services finish. No real services run.",
  "input": "1. Read `n`, the service count, and `m`, the resource-type count.\n2. Read `m` initial free counts into `work`, in resource-type order.\n3. Read `n` rows of `m` counts for `allocation`, in service order.\n4. Read `n` rows of `m` counts for `maximum`, in the same order.",
  "output": "Print `SAFE` if at least one order lets every service finish; otherwise print `UNSAFE`. Do not print an order.",
  "example": "Input `2 1 1 2 0 2 3` has one free unit. Service `0` already holds its maximum of `2`; finishing it makes `3` units free, enough for service `1`. Output: `SAFE`.",
  "constraints": "`1 <= n <= 7`. `1 <= m <= 4`. For each service/type pair, `0 <= allocation <= maximum <= 20`. Each initial free count is from `0` to `20`. Service and resource-type indices start at `0`. A maximum claim may exceed the total resources present.",
  "defect": "The completion step returns the remaining need instead of the resources originally allocated.",
  "hints": [
    "Compare what a service still needs with what it already holds.",
    "Temporarily lending the remaining need and getting it back cancel out. The net gain comes from the resources held before completion.",
    "After a feasible service finishes, add its original `allocation` to `work`, not its remaining need."
  ],
  "c": `int n, m;
READ(n);
READ(m);
ARRAY(work,4);
ARRAY(allocation,28);
ARRAY(maximum,28);
ARRAY(done,7);
for (int j = 0; j < m; j++) {
    READ(work[j]);
}
for (int i = 0; i < n * m; i++) {
    READ(allocation[i]);
}
for (int i = 0; i < n * m; i++) {
    READ(maximum[i]);
}
int finished = 0;
for (int pass = 0; pass < n; pass++) {
    for (int i = 0; i < n; i++) {
        int possible = 1;
        for (int j = 0; j < m; j++) {
            if (maximum[i * m + j] - allocation[i * m + j] > work[j]) {
                possible = 0;
            }
        }
        if (done[i] == 0 && possible == 1) {
            done[i] = 1;
            finished++;
            for (int j = 0; j < m; j++) {
                work[j] += allocation[i * m + j];
            }
        }
    }
}
if (finished == n) {
    SAY("SAFE");
} else {
    SAY("UNSAFE");
}`,
  "py": `n, m = read_int(), read_int()
work = [read_int() for _ in range(m)]
allocation = [read_int() for _ in range(n * m)]
maximum = [read_int() for _ in range(n * m)]
done = [0] * n
finished = 0
for _ in range(n):
    for i in range(n):
        possible = all(maximum[i * m + j] - allocation[i * m + j] <= work[j] for j in range(m))
        if done[i] == 0 and possible:
            done[i] = 1
            finished += 1
            for j in range(m):
                work[j] += allocation[i * m + j]
print("SAFE" if finished == n else "UNSAFE")`,
  "cbug": [
    "work[j] += allocation[i * m + j];",
    "work[j] += maximum[i * m + j] - allocation[i * m + j];"
  ],
  "pybug": [
    "work[j] += allocation[i * m + j]",
    "work[j] += maximum[i * m + j] - allocation[i * m + j]"
  ],
  "cases": [
    [
      "2 1\n1\n2\n0\n2\n3",
      "SAFE"
    ],
    [
      "2 1\n0\n1\n1\n2\n2",
      "UNSAFE"
    ],
    [
      "2 1\n1\n0\n0\n1\n2",
      "UNSAFE"
    ],
    [
      "1 1\n0\n0\n0",
      "SAFE"
    ],
    [
      "1 2\n0 1\n2 0\n2 1",
      "SAFE"
    ],
    [
      "3 1\n0\n0\n0\n3\n3\n2\n3",
      "SAFE"
    ],
    [
      "2 2\n0 0\n1 0\n0 1\n1 1\n1 1",
      "UNSAFE"
    ],
    [
      "3 2\n1 0\n1 0\n0 1\n1 1\n1 0\n2 1\n2 2",
      "SAFE"
    ]
  ],
  "witness": 3,
  "probe": [
    "7 4\n0 0 0 0\n0 0 0 0\n0 0 0 0\n0 0 0 0\n0 0 0 0\n0 0 0 0\n0 0 0 0\n20 20 20 20\n20 20 20 20\n20 20 20 20\n20 20 20 20\n20 20 20 20\n20 20 20 20\n20 20 20 20\n20 20 20 20",
    "SAFE"
  ]
},
{
  "title": "Distinct Recovery Phrases",
  "difficulty": 61,
  "guide": "A prefix is the first part of a word. `ways[i]` counts texts from the first `i` letters, including empty text. `last` records prior positions using one-based positions: the first letter is at `1`, and `0` means unseen.",
  "incident": "Patch is counting texts recoverable from a damaged word.",
  "symptom": "Repeated letters cause the program to remove the wrong number of duplicate texts.",
  "task": "A subsequence is made by deleting any positions from `word` while keeping the remaining letters in their original order. Count distinct resulting texts, including the empty text. The same text counts once even when different position choices produce it. Print the remainder after division by `1000000007`.",
  "input": "Read `word`, one nonempty word of lowercase English letters.",
  "output": "Print the number of distinct subsequence texts modulo `1000000007`; modulo means the nonnegative remainder after division.",
  "example": "Input `aba` gives the empty text and `a`, `b`, `aa`, `ab`, `ba`, `aba`. Output: `7`.",
  "constraints": "The length of `word` is from `1` to `60`. Each letter is from `a` to `z`. Remainder arithmetic must give the same nonnegative result in every supported language.",
  "defect": "Duplicate removal subtracts the count through the previous equal letter instead of the count just before it.",
  "hints": [
    "In `aba`, both copies of `a` can produce some of the same texts.",
    "Appending a letter creates duplicates when that letter has appeared before. Identify which earlier prefix produced them.",
    "For a repeated letter, subtract `ways[last[ch] - 1]` from the doubled previous count. Normalize the remainder and then record the new last position."
  ],
  "c": `TEXT(word);
WORD(word);
ARRAY(last,26);
ARRAY64(ways,61);
ways[0] = 1;
for (int i = 1; i <= LEN(word); i++) {
    int ch = CHAR(word,i - 1) - 'a';
    long long value = 2 * ways[i - 1];
    if (last[ch] > 0) {
        value -= ways[last[ch] - 1];
    }
    ways[i] = (value + 1000000007LL) % 1000000007LL;
    last[ch] = i;
}
OUT64(ways[LEN(word)]);`,
  "py": `word = read_word()
last = [0] * 26
ways = [0] * (len(word) + 1)
ways[0] = 1
for i in range(1, len(word) + 1):
    ch = ord(word[i - 1]) - ord('a')
    value = 2 * ways[i - 1]
    if last[ch] > 0:
        value -= ways[last[ch] - 1]
    ways[i] = (value + 1000000007) % 1000000007
    last[ch] = i
print(ways[len(word)])`,
  "cbug": [
    "ways[last[ch] - 1]",
    "ways[last[ch]]"
  ],
  "pybug": [
    "ways[last[ch] - 1]",
    "ways[last[ch]]"
  ],
  "cases": [
    [
      "aba",
      "7"
    ],
    [
      "abc",
      "8"
    ],
    [
      "aa",
      "3"
    ],
    [
      "a",
      "2"
    ],
    [
      "aaaaa",
      "6"
    ],
    [
      "abab",
      "12"
    ],
    [
      "abcabc",
      "52"
    ],
    [
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefgh",
      "478624212"
    ]
  ],
  "witness": 3,
  "probe": [
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "61"
  ]
},
{
  "title": "Compatible Maintenance Windows",
  "difficulty": 63,
  "guide": "`best[i]` is the best reward using the first `i` input jobs. The supplied code numbers jobs from `1`. `previous` identifies an earlier prefix, meaning the first part of that list. No job list is required in the output.",
  "incident": "Mira is choosing jobs for one repair channel.",
  "symptom": "The reported reward can include jobs that overlap.",
  "task": "Choose optional jobs with the largest total reward, with no overlapping execution times. A job occupies the half-open interval `[start, end)`: it includes `start` and excludes `end`. One job may therefore start exactly when another ends. Input jobs are already ordered by increasing or equal end time. Choosing no jobs is allowed.",
  "input": "1. Read `n`, the job count.\n2. Read `n` triples: `start`, `end`, `reward`. End times are nondecreasing; jobs with equal end times may be in any order.",
  "output": "Print the largest total reward of compatible jobs. With no jobs, print `0`.",
  "example": "Input `3 0 3 8 1 4 9 3 5 7` allows the first and third jobs together because one ends where the other starts. Output: `15`.",
  "constraints": "`0 <= n <= 16`. Each job has `0 <= start < end <= 100` and `0 <= reward <= 1000`. End times never decrease.",
  "defect": "Taking a job extends the unrestricted previous optimum instead of the last compatible prefix optimum.",
  "hints": [
    "Taking a job can rule out jobs included in the previous best total.",
    "Use the earlier prefix whose jobs all end no later than the current start.",
    "Compare skipping job `i` with `best[previous]` plus its reward, rather than extending `best[i - 1]` when taking it."
  ],
  "c": `int n;
READ(n);
ARRAY(start,17);
ARRAY(end,17);
ARRAY(reward,17);
ARRAY(best,17);
for (int i = 1; i <= n; i++) {
    READ(start[i]);
    READ(end[i]);
    READ(reward[i]);
    int previous = i - 1;
    while (previous > 0 && end[previous] > start[i]) {
        previous--;
    }
    int candidate = best[previous] + reward[i];
    best[i] = best[i - 1];
    if (candidate > best[i]) {
        best[i] = candidate;
    }
}
OUT(best[n]);`,
  "py": `n = read_int()
end = [0] * (n + 1)
best = [0] * (n + 1)
for i in range(1, n + 1):
    start, end[i], reward = read_int(), read_int(), read_int()
    previous = i - 1
    while previous > 0 and end[previous] > start:
        previous -= 1
    candidate = best[previous] + reward
    best[i] = max(best[i - 1], candidate)
print(best[n])`,
  "cbug": [
    "best[previous] + reward[i]",
    "best[i - 1] + reward[i]"
  ],
  "pybug": [
    "best[previous] + reward",
    "best[i - 1] + reward"
  ],
  "cases": [
    [
      "3\n0 3 8\n1 4 9\n3 5 7",
      "15"
    ],
    [
      "2\n0 1 4\n1 2 5",
      "9"
    ],
    [
      "2\n0 4 5\n1 4 6",
      "6"
    ],
    [
      "0",
      "0"
    ],
    [
      "1\n0 100 1000",
      "1000"
    ],
    [
      "3\n0 2 0\n0 3 9\n2 4 10",
      "10"
    ],
    [
      "4\n0 2 4\n2 4 4\n0 5 15\n4 6 4",
      "15"
    ],
    [
      "16\n0 1 1\n0 2 2\n0 3 3\n0 4 4\n0 5 5\n0 6 6\n0 7 7\n0 8 8\n0 9 9\n0 10 10\n0 11 11\n0 12 12\n0 13 13\n0 14 14\n0 15 15\n0 16 16",
      "16"
    ]
  ],
  "witness": 3,
  "probe": [
    "16\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000\n0 100 1000",
    "1000"
  ]
},
{
  "title": "Composite-Modulus Rosters",
  "difficulty": 65,
  "guide": "`count` represents the number of choices, and `modulus` is the requested output divisor. The supplied loop uses multiplication and whole-number division.",
  "incident": "Ishan is counting possible teams of operators.",
  "symptom": "The program can lose valid choices when dividing a value that was already reduced to a remainder.",
  "task": "Choose exactly `k` different operators from `n` distinct operators. Order does not matter. Print the number of choices modulo `modulus`, meaning the remainder after division by `modulus`. Choosing no operators gives one choice. The divisor may be composite, meaning it has factors other than one and itself.",
  "input": "Read `n`, the operator count, `k`, the team size, and `modulus`, the output divisor.",
  "output": "Print the nonnegative remainder of the number of teams after division by `modulus`.",
  "example": "Input `4 2 4` has `6` different teams before taking the remainder. Output: `2`.",
  "constraints": "`0 <= k <= n <= 50`. `2 <= modulus <= 1000000000`. Every exact intermediate multiplication in the supplied recurrence fits a signed 64-bit integer.",
  "defect": "The recurrence reduces modulo modulus before an exact integer division, which does not preserve the quotient remainder.",
  "hints": [
    "Compare dividing an exact count with dividing its remainder.",
    "For an arbitrary divisor, taking a remainder before an integer division can change the final result.",
    "Keep `count` exact through each multiplication and division. Apply `% modulus` only to the completed count."
  ],
  "c": `int n, k, modulus;
READ(n);
READ(k);
READ(modulus);
long long count = 1;
for (int i = 1; i <= k; i++) {
    count = count * (n - i + 1) / i;
}
OUT64(count % modulus);`,
  "py": `n, k, modulus = read_int(), read_int(), read_int()
count = 1
for i in range(1, k + 1):
    count = count * (n - i + 1) // i
print(count % modulus)`,
  "cbug": [
    "count * (n - i + 1) / i",
    "(count * (n - i + 1) % modulus) / i"
  ],
  "pybug": [
    "count * (n - i + 1) // i",
    "(count * (n - i + 1) % modulus) // i"
  ],
  "cases": [
    [
      "4 2 4",
      "2"
    ],
    [
      "5 1 3",
      "2"
    ],
    [
      "6 3 8",
      "4"
    ],
    [
      "0 0 2",
      "1"
    ],
    [
      "50 25 1000000000",
      "606437752"
    ],
    [
      "10 10 6",
      "1"
    ],
    [
      "7 0 9",
      "1"
    ],
    [
      "12 5 12",
      "0"
    ]
  ],
  "witness": 3,
  "probe": [
    "50 50 2",
    "1"
  ]
},
{
  "title": "Read Sets Against Write Skew",
  "difficulty": 69,
  "guide": "A snapshot is the private copy taken at BEGIN. `current` holds committed values and `version` counts writes to each cell. `saved` holds private values. `dirty` marks private writes; `touched` marks cells read or written. Saved BEGIN versions are `savedVersion` in C, C++ and Java, and `saved_version` in Python.",
  "incident": "Mira is checking whether private edits still rely on current data.",
  "symptom": "A transaction can commit after a cell used in its decision has changed.",
  "task": "A transaction is a group of private edits. BEGIN (`op = 0`) copies all committed values and their version numbers. WRITE (`op = 1`) changes a private cell. READ (`op = 2`) prints a private value, including the transaction's own writes. Process operations in order. COMMIT (`op = 3`) succeeds only if every cell read or written by that transaction still has its BEGIN version. Print `1` for success or `0` for failure. Success publishes only its writes and increases each written cell's version, even if the value is unchanged. Failure publishes nothing. Either result ends the transaction.",
  "input": "1. Read `m`, the cell count, `transactions`, the transaction count, and `q`, the operation count.\n2. Read `m` initial values for `current`, in cell ID order.\n3. Read `q` rows: `op`, `t` (transaction ID), `cell` (cell ID), `value` (new value for WRITE). BEGIN and COMMIT use ignored `0 0` for the last two fields; READ uses ignored `0` for `value`.",
  "output": "Print READ values and COMMIT results in operation order, then the final `m` committed values in cell ID order. Separate all values with whitespace. BEGIN and WRITE print nothing.",
  "example": "In the first sample, both transactions read an initial value of `1` from the cell the other later writes. The first commit succeeds; the second fails because its read is stale, meaning the version has changed. The two reads, two commit results, and final cells give output `1 1 1 0 0 1`.",
  "constraints": "`1 <= m, transactions <= 8`. `0 <= q <= 100`. `0 <= t < transactions`; `0 <= cell < m`. `op` is `0`, `1`, `2`, or `3`. Values are from `0` to `1000`; versions start at `0`. Each used transaction begins once, operates only while active, and commits at most once. Unused transaction IDs and unfinished transactions are allowed.",
  "defect": "Commit validates only written cells and overlooks read-only dependencies, allowing write skew.",
  "hints": [
    "Try a transaction that reads one cell and writes a different cell.",
    "A changed read-only cell can invalidate a decision just as a changed written cell can.",
    "At COMMIT, compare BEGIN and current versions for every `touched` cell, not just `dirty` cells. Publish writes only if all comparisons match."
  ],
  "c": `int m, transactions, q;
READ(m);
READ(transactions);
READ(q);
ARRAY(current,8);
ARRAY(version,8);
ARRAY(saved,64);
ARRAY(savedVersion,64);
ARRAY(dirty,64);
ARRAY(touched,64);
for (int j = 0; j < m; j++) {
    READ(current[j]);
}
for (int i = 0; i < q; i++) {
    int op, t, cell, value;
    READ(op);
    READ(t);
    READ(cell);
    READ(value);
    int key = t * m + cell;
    if (op == 0) {
        for (int j = 0; j < m; j++) {
            int k = t * m + j;
            saved[k] = current[j];
            savedVersion[k] = version[j];
            dirty[k] = 0;
            touched[k] = 0;
        }
    } else if (op == 1) {
        saved[key] = value;
        dirty[key] = 1;
        touched[key] = 1;
    } else if (op == 2) {
        touched[key] = 1;
        OUT(saved[key]);
    } else {
        int valid = 1;
        for (int j = 0; j < m; j++) {
            if (touched[t * m + j] == 1 && version[j] != savedVersion[t * m + j]) {
                valid = 0;
            }
        }
        OUT(valid);
        if (valid == 1) {
            for (int j = 0; j < m; j++) {
                if (dirty[t * m + j] == 1) {
                    current[j] = saved[t * m + j];
                    version[j]++;
                }
            }
        }
    }
}
for (int j = 0; j < m; j++) {
    OUT(current[j]);
}`,
  "py": `m, transactions, q = read_int(), read_int(), read_int()
current = [read_int() for _ in range(m)]
version = [0] * m
saved = [0] * (transactions * m)
saved_version = [0] * (transactions * m)
dirty = [0] * (transactions * m)
touched = [0] * (transactions * m)
for _ in range(q):
    op, t, cell, value = read_int(), read_int(), read_int(), read_int()
    key = t * m + cell
    if op == 0:
        for j in range(m):
            k = t * m + j
            saved[k] = current[j]
            saved_version[k] = version[j]
            dirty[k] = 0
            touched[k] = 0
    elif op == 1:
        saved[key] = value
        dirty[key] = 1
        touched[key] = 1
    elif op == 2:
        touched[key] = 1
        print(saved[key])
    else:
        valid = 1
        for j in range(m):
            if touched[t * m + j] == 1 and version[j] != saved_version[t * m + j]:
                valid = 0
        print(valid)
        if valid == 1:
            for j in range(m):
                if dirty[t * m + j] == 1:
                    current[j] = saved[t * m + j]
                    version[j] += 1
print(*current)`,
  "cbug": [
    "touched[t * m + j] == 1 && version[j]",
    "dirty[t * m + j] == 1 && version[j]"
  ],
  "pybug": [
    "touched[t * m + j] == 1 and version[j]",
    "dirty[t * m + j] == 1 and version[j]"
  ],
  "cases": [
    [
      "2 2 8\n1 1\n0 0 0 0\n0 1 0 0\n2 0 1 0\n2 1 0 0\n1 0 0 0\n1 1 1 0\n3 0 0 0\n3 1 0 0",
      "1 1 1 0 0 1"
    ],
    [
      "1 1 4\n5\n0 0 0 0\n1 0 0 8\n2 0 0 0\n3 0 0 0",
      "8 1 8"
    ],
    [
      "2 2 7\n0 0\n0 0 0 0\n0 1 0 0\n2 1 0 0\n1 0 0 2\n3 0 0 0\n1 1 1 3\n3 1 0 0",
      "0 1 0 2 0"
    ],
    [
      "2 1 0\n1 2",
      "1 2"
    ],
    [
      "1 2 6\n0\n0 0 0 0\n0 1 0 0\n1 0 0 1\n1 1 0 2\n3 0 0 0\n3 1 0 0",
      "1 0 1"
    ],
    [
      "2 2 6\n0 0\n0 0 0 0\n0 1 0 0\n1 0 0 1\n3 0 0 0\n1 1 1 2\n3 1 0 0",
      "1 1 1 2"
    ],
    [
      "1 2 6\n7\n0 0 0 0\n0 1 0 0\n2 1 0 0\n1 0 0 7\n3 0 0 0\n3 1 0 0",
      "7 1 0 7"
    ],
    [
      "1 1 3\n4\n0 0 0 0\n2 0 0 0\n3 0 0 0",
      "4 1 4"
    ]
  ],
  "witness": 3,
  "probe": [
    "8 8 6\n0 0 0 0 0 0 0 0\n0 0 0 0\n0 7 0 0\n2 7 7 0\n1 0 7 0\n3 0 0 0\n3 7 0 0",
    "0 1 0 0 0 0 0 0 0 0 0"
  ]
},
{
  "title": "Adjacent Archive Fusion",
  "difficulty": 73,
  "guide": "A contiguous interval is a run of neighboring positions with no gaps. `best[left * n + right]` is the minimum merge cost for positions `left` through `right`, including both endpoints. `prefix` stores cumulative weights.",
  "incident": "Patch is checking the cost of combining ordered archive blocks.",
  "symptom": "The program can charge too little for a merge that includes blocks between the endpoints.",
  "task": "Merge two neighboring blocks by replacing them with one block whose weight is their sum. Each merge costs that same sum. Continue until one block remains, minimizing the sum of all merge costs. Blocks keep their original order. Starting with one block costs `0`.",
  "input": "1. Read `n`, the starting block count.\n2. Read `n` values into `weight`, the block weights in fixed archive order.",
  "output": "Print the minimum total cost of merging all blocks into one.",
  "example": "Input `3 1 2 3` can merge the first two blocks for `3`, then the remaining two for `6`. Total output: `9`.",
  "constraints": "`1 <= n <= 10`. Each `weight` is from `1` to `100`. Block positions are numbered `0` through `n - 1`.",
  "defect": "The last merge is charged only the endpoint weights instead of the entire interval weight.",
  "hints": [
    "Which original blocks contribute weight to the final merge?",
    "A split gives two neighboring parts. Their final merge includes every weight in the interval.",
    "For each `split`, add both smaller merge costs and `prefix[right + 1] - prefix[left]`. Minimize over splits; a single block costs `0`."
  ],
  "c": `int n;
READ(n);
ARRAY(weight,10);
ARRAY(prefix,11);
ARRAY(best,100);
for (int i = 0; i < n; i++) {
    READ(weight[i]);
    prefix[i + 1] = prefix[i] + weight[i];
}
for (int length = 2; length <= n; length++) {
    for (int left = 0; left + length <= n; left++) {
        int right = left + length - 1;
        best[left * n + right] = 1000000;
        for (int split = left; split < right; split++) {
            int cost = best[left * n + split] + best[(split + 1) * n + right] + prefix[right + 1] - prefix[left];
            if (cost < best[left * n + right]) {
                best[left * n + right] = cost;
            }
        }
    }
}
OUT(best[n - 1]);`,
  "py": `n = read_int()
weight = [read_int() for _ in range(n)]
prefix = [0] * (n + 1)
for i in range(n):
    prefix[i + 1] = prefix[i] + weight[i]
best = [0] * (n * n)
for length in range(2, n + 1):
    for left in range(n - length + 1):
        right = left + length - 1
        best[left * n + right] = 1000000
        for split in range(left, right):
            cost = best[left * n + split] + best[(split + 1) * n + right] + prefix[right + 1] - prefix[left]
            if cost < best[left * n + right]:
                best[left * n + right] = cost
print(best[n - 1])`,
  "cbug": [
    "prefix[right + 1] - prefix[left]",
    "weight[left] + weight[right]"
  ],
  "pybug": [
    "prefix[right + 1] - prefix[left]",
    "weight[left] + weight[right]"
  ],
  "cases": [
    [
      "3\n1 2 3",
      "9"
    ],
    [
      "2\n8 9",
      "17"
    ],
    [
      "3\n1 100 1",
      "203"
    ],
    [
      "1\n100",
      "0"
    ],
    [
      "4\n4 1 1 4",
      "18"
    ],
    [
      "4\n1 1 1 1",
      "8"
    ],
    [
      "5\n9 2 8 1 7",
      "62"
    ],
    [
      "10\n100 100 100 100 100 100 100 100 100 100",
      "3400"
    ]
  ],
  "witness": 3,
  "probe": [
    "10\n1 1 1 1 1 1 1 1 1 1",
    "34"
  ]
},
{
  "title": "Crew Assignment Masks",
  "difficulty": 77,
  "guide": "A bit mask is an integer whose binary digits record a selection. In `mask`, a `1` marks an assigned job and a `0` marks an unassigned job. The rightmost digit is job `0`. `best[mask]` holds the lowest total for that selection.",
  "incident": "Mira is assigning different repair jobs to workers.",
  "symptom": "The program can use the cost row of the wrong worker.",
  "task": "There are `n` workers and `n` jobs. Assign every worker exactly one job and every job exactly one worker. The input gives the cost of each worker/job pair. Minimize the sum of the chosen costs.",
  "input": "1. Read `n`, the worker count and job count.\n2. Read `n` rows of `n` costs in worker ID order, with columns in job ID order. The flat array stores a pair's cost at `cost[worker * n + job]`.",
  "output": "Print the minimum total cost of a complete assignment. No assignment list is required.",
  "example": "Input `2 9 1 2 8` assigns worker `0` to job `1` for `1`, and worker `1` to job `0` for `2`. Output: `3`.",
  "constraints": "`1 <= n <= 12`. Each cost is from `0` to `1000`. Worker and job IDs are `0` through `n - 1`. The supplied algorithm uses at most `4096` subset states.",
  "defect": "The cost row uses the mask remainder instead of the count of already assigned jobs.",
  "hints": [
    "Masks `1` and `2` mark different jobs but the same number of assigned jobs.",
    "The next worker depends on how many jobs have been assigned, not the numeric value of the mask.",
    "Count the set bits in `mask` to find `worker`, the next worker index. Use that worker's cost row when trying each unselected job."
  ],
  "c": `int n;
READ(n);
ARRAY(cost,144);
ARRAY(best,4096);
for (int i = 0; i < n * n; i++) {
    READ(cost[i]);
}
int limit = 1 << n;
for (int mask = 1; mask < limit; mask++) {
    best[mask] = 100000000;
}
for (int mask = 0; mask < limit; mask++) {
    int worker = 0, bits = mask;
    while (bits > 0) {
        worker += bits & 1;
        bits >>= 1;
    }
    for (int job = 0; job < n; job++) {
        if ((mask & (1 << job)) == 0) {
            int next = mask | (1 << job);
            int candidate = best[mask] + cost[worker * n + job];
            if (candidate < best[next]) {
                best[next] = candidate;
            }
        }
    }
}
OUT(best[limit - 1]);`,
  "py": `n = read_int()
cost = [read_int() for _ in range(n * n)]
limit = 1 << n
best = [100000000] * limit
best[0] = 0
for mask in range(limit):
    worker = mask.bit_count()
    for job in range(n):
        if mask & (1 << job) == 0:
            next_mask = mask | (1 << job)
            candidate = best[mask] + cost[worker * n + job]
            if candidate < best[next_mask]:
                best[next_mask] = candidate
print(best[limit - 1])`,
  "cbug": [
    "cost[worker * n + job]",
    "cost[(mask % n) * n + job]"
  ],
  "pybug": [
    "cost[worker * n + job]",
    "cost[(mask % n) * n + job]"
  ],
  "cases": [
    [
      "2\n9 1\n2 8",
      "3"
    ],
    [
      "1\n7",
      "7"
    ],
    [
      "3\n9 1 8\n1 9 8\n8 8 1",
      "3"
    ],
    [
      "2\n0 0\n0 0",
      "0"
    ],
    [
      "3\n1 2 3\n3 2 1\n2 1 3",
      "3"
    ],
    [
      "3\n1 100 100\n2 100 100\n3 100 100",
      "201"
    ],
    [
      "4\n0 9 9 9\n9 0 9 9\n9 9 0 9\n9 9 9 0",
      "0"
    ],
    [
      "12\n0 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000\n1000 0 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000\n1000 1000 0 1000 1000 1000 1000 1000 1000 1000 1000 1000\n1000 1000 1000 0 1000 1000 1000 1000 1000 1000 1000 1000\n1000 1000 1000 1000 0 1000 1000 1000 1000 1000 1000 1000\n1000 1000 1000 1000 1000 0 1000 1000 1000 1000 1000 1000\n1000 1000 1000 1000 1000 1000 0 1000 1000 1000 1000 1000\n1000 1000 1000 1000 1000 1000 1000 0 1000 1000 1000 1000\n1000 1000 1000 1000 1000 1000 1000 1000 0 1000 1000 1000\n1000 1000 1000 1000 1000 1000 1000 1000 1000 0 1000 1000\n1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 0 1000\n1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 0",
      "0"
    ]
  ],
  "witness": 3,
  "probe": [
    "12\n0 0 0 0 0 0 0 0 0 0 0 0\n90 90 90 90 90 90 90 90 90 90 90 90\n180 180 180 180 180 180 180 180 180 180 180 180\n270 270 270 270 270 270 270 270 270 270 270 270\n360 360 360 360 360 360 360 360 360 360 360 360\n450 450 450 450 450 450 450 450 450 450 450 450\n540 540 540 540 540 540 540 540 540 540 540 540\n630 630 630 630 630 630 630 630 630 630 630 630\n720 720 720 720 720 720 720 720 720 720 720 720\n810 810 810 810 810 810 810 810 810 810 810 810\n900 900 900 900 900 900 900 900 900 900 900 900\n990 990 990 990 990 990 990 990 990 990 990 990",
    "5940"
  ]
},
{
  "title": "Sealed Credit Stocks",
  "difficulty": 81,
  "guide": "`ways[total]` counts payments for exactly `total` after the processed credit types. The next table is called `nextWays` in C, C++ and Java, and `next_ways` in Python.",
  "incident": "Patch is counting payments from a limited supply of credits.",
  "symptom": "The counter can count payments that exceed a denomination's stock.",
  "task": "A denomination is the value of one credit, and its `stock` is the number of copies available. For each of the `n` distinct denominations, choose from zero through its stock copies, inclusive. Count selections totaling exactly `target`. Payments differing only in credit order count once. For `target = 0`, count the empty payment once. Print the count modulo `1000000007`, meaning its nonnegative remainder after division.",
  "input": "1. Read `n`, the denomination count, and `target`, the required payment.\n2. Read `n` pairs: `coin`, the denomination value, and `stock`, its available copy count.",
  "output": "Print the number of payments for exactly `target`, modulo `1000000007`. Print `0` if none is possible.",
  "example": "Input `1 4 2 1` offers one credit of value `2`. It cannot pay `4`. Output: `0`.",
  "constraints": "`0 <= n <= 6`. `0 <= target <= 40`. `1 <= coin <= 40`. `0 <= stock <= 8`. All denomination values are distinct.",
  "defect": "A denomination stage reads its own growing output, allowing same-stage choices to be reused beyond the stock limit.",
  "hints": [
    "With stock `1`, follow whether the same credit can be added more than once.",
    "The copy-count loop already chooses all copies of the current type for a payment.",
    "Build the next table from unchanged `ways` values only. Keep the zero-copy choices, add each allowed positive-copy choice, then replace the old table."
  ],
  "c": `int n, target;
READ(n);
READ(target);
ARRAY(ways,41);
ARRAY(nextWays,41);
ways[0] = 1;
for (int i = 0; i < n; i++) {
    int coin, stock;
    READ(coin);
    READ(stock);
    for (int total = 0; total <= target; total++) {
        nextWays[total] = ways[total];
    }
    for (int total = 0; total <= target; total++) {
        for (int used = 1; used <= stock && total + used * coin <= target; used++) {
            int destination = total + used * coin;
            nextWays[destination] = (nextWays[destination] + ways[total]) % 1000000007;
        }
    }
    for (int total = 0; total <= target; total++) {
        ways[total] = nextWays[total];
    }
}
OUT(ways[target]);`,
  "py": `n, target = read_int(), read_int()
ways = [0] * (target + 1)
ways[0] = 1
for _ in range(n):
    coin, stock = read_int(), read_int()
    next_ways = ways.copy()
    for total in range(target + 1):
        for used in range(1, stock + 1):
            destination = total + used * coin
            if destination <= target:
                next_ways[destination] = (next_ways[destination] + ways[total]) % 1000000007
    ways = next_ways
print(ways[target])`,
  "cbug": [
    "nextWays[destination] + ways[total]",
    "nextWays[destination] + nextWays[total]"
  ],
  "pybug": [
    "next_ways[destination] + ways[total]",
    "next_ways[destination] + next_ways[total]"
  ],
  "cases": [
    [
      "1 4\n2 1",
      "0"
    ],
    [
      "2 4\n1 2\n2 2",
      "2"
    ],
    [
      "1 3\n1 1",
      "0"
    ],
    [
      "0 0",
      "1"
    ],
    [
      "0 5",
      "0"
    ],
    [
      "2 0\n1 0\n3 8",
      "1"
    ],
    [
      "3 7\n1 2\n2 2\n3 1",
      "2"
    ],
    [
      "6 40\n1 8\n2 8\n3 8\n4 8\n5 8\n6 8",
      "1941"
    ]
  ],
  "witness": 3,
  "probe": [
    "6 40\n1 1\n2 1\n3 1\n4 1\n5 1\n6 1",
    "0"
  ]
},
{
  "title": "Two-Ended Quarantine Game",
  "difficulty": 85,
  "guide": "An interval is a run of neighboring positions. For an interval, `best` stores the best final score difference for the player about to move. That player changes after each choice.",
  "incident": "Mira and AEGIS play a game on a row of numbers.",
  "symptom": "The forecast can count the next player's advantage as a benefit for the current player.",
  "task": "Both scores start at `0`. Mira moves first, then the players alternate. Each turn must take exactly one number from either end of the remaining row and add it to that player's score. Continue until the row is empty; passing is not allowed, even for negative values. Both players choose moves to maximize their own final score minus the other's. Print Mira's score minus AEGIS's under optimal play.",
  "input": "1. Read `n`, the number of entries.\n2. Read `n` signed integers into `values`, in the row's fixed order.",
  "output": "Print the optimal final score difference for Mira. It may be negative. If several moves tie, only their shared score difference matters.",
  "example": "Input `3 1 5 2` lets Mira take `2`, AEGIS take `5`, then Mira take `1`. Mira's best possible difference is `3 - 5`. Output: `-2`.",
  "constraints": "`1 <= n <= 16`. Each entry in `values` is from `-1000` to `1000`. Positions are numbered from `0`.",
  "defect": "The right-end transition adds the next player's interval advantage instead of subtracting it.",
  "hints": [
    "After one end is taken, whose advantage does the remaining interval describe?",
    "A positive remaining difference favors the next player, who is now the opponent.",
    "For either end, subtract the opponent's best remaining difference from the value taken. Choose the larger result; a one-entry interval equals that entry."
  ],
  "c": `int n;
READ(n);
ARRAY(values,16);
ARRAY(best,256);
for (int i = 0; i < n; i++) {
    READ(values[i]);
    best[i * n + i] = values[i];
}
for (int length = 2; length <= n; length++) {
    for (int left = 0; left + length <= n; left++) {
        int right = left + length - 1;
        int fromLeft = values[left] - best[(left + 1) * n + right];
        int fromRight = values[right] - best[left * n + right - 1];
        best[left * n + right] = fromLeft;
        if (fromRight > fromLeft) {
            best[left * n + right] = fromRight;
        }
    }
}
OUT(best[n - 1]);`,
  "py": `n = read_int()
values = [read_int() for _ in range(n)]
best = [0] * (n * n)
for i in range(n):
    best[i * n + i] = values[i]
for length in range(2, n + 1):
    for left in range(n - length + 1):
        right = left + length - 1
        from_left = values[left] - best[(left + 1) * n + right]
        from_right = values[right] - best[left * n + right - 1]
        best[left * n + right] = max(from_left, from_right)
print(best[n - 1])`,
  "cbug": [
    "values[right] - best[left * n + right - 1]",
    "values[right] + best[left * n + right - 1]"
  ],
  "pybug": [
    "values[right] - best[left * n + right - 1]",
    "values[right] + best[left * n + right - 1]"
  ],
  "cases": [
    [
      "3\n1 5 2",
      "-2"
    ],
    [
      "1\n-9",
      "-9"
    ],
    [
      "2\n4 7",
      "3"
    ],
    [
      "2\n-4 -7",
      "3"
    ],
    [
      "4\n0 0 0 0",
      "0"
    ],
    [
      "4\n8 15 3 7",
      "11"
    ],
    [
      "5\n-2 9 -7 4 -1",
      "-23"
    ],
    [
      "16\n1000 -1000 1000 -1000 1000 -1000 1000 -1000 1000 -1000 1000 -1000 1000 -1000 1000 -1000",
      "16000"
    ]
  ],
  "witness": 3,
  "probe": [
    "16\n1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000",
    "0"
  ]
},
{
  "title": "Atomic History Witness",
  "difficulty": 89,
  "guide": "A bit mask is an integer whose binary digits record a subset: a `1` at position `i` includes input call `i`. Positions start at `0` on the right. `required[i]` marks calls that must precede call `i`. `total[mask]` sums a subset's increments, and `reachable` records possible prefixes, meaning initial parts of an order.",
  "incident": "Ishan is checking a recorded counter history.",
  "symptom": "The checker can place a call before some calls that had already finished when it started.",
  "task": "An atomic fetch-add is one indivisible action that reports the counter's old value, then adds `delta`. The counter starts at `0`. Each logged call gives its start time, end time, positive increment, and reported old value. Decide whether the calls can be put in one order that produces every report. If one call ends at or before another starts, it must come first. Overlapping calls may be ordered either way, subject to all other rules. This checks a log; it runs no threads.",
  "input": "1. Read `n`, the number of calls.\n2. Read `n` rows: start time, end time, increment, reported old value. C stores them in `start`, `end`, `delta`, and `old`; Python stores each row in `events`. Rows need not be sorted.",
  "output": "Print `YES` if at least one complete call order satisfies all reports and time rules; otherwise print `NO`. With no calls, print `YES`.",
  "example": "Input `2 0 4 2 0 1 3 3 2` has overlapping calls. Placing the first input call before the second produces reported old values `0` and `2`. Output: `YES`.",
  "constraints": "`0 <= n <= 12`. Each call has `0 <= start < end <= 100`, `1 <= delta <= 9`, and reported old value from `0` to `108`. Calls are numbered `0` through `n - 1` in input order. An end time equal to another start time enforces precedence.",
  "defect": "A call is considered ready when any required predecessor is present rather than when all are present.",
  "hints": [
    "A call can have more than one required predecessor.",
    "Matching the reported counter value does not remove the need to include every required earlier call.",
    "Extend a reachable `mask` only when its total matches the report and `(mask & required[i]) == required[i]`. Accept only if the full subset is reachable."
  ],
  "c": `int n;
READ(n);
ARRAY(start,12);
ARRAY(end,12);
ARRAY(delta,12);
ARRAY(old,12);
ARRAY(required,12);
ARRAY(total,4096);
ARRAY(reachable,4096);
for (int i = 0; i < n; i++) {
    READ(start[i]);
    READ(end[i]);
    READ(delta[i]);
    READ(old[i]);
}
for (int i = 0; i < n; i++) {
    for (int j = 0; j < n; j++) {
        if (end[j] <= start[i]) {
            required[i] |= 1 << j;
        }
    }
}
int limit = 1 << n;
for (int mask = 1; mask < limit; mask++) {
    int bit = mask & -mask;
    int index = 0, value = bit;
    while (value > 1) {
        value >>= 1;
        index++;
    }
    total[mask] = total[mask ^ bit] + delta[index];
}
reachable[0] = 1;
for (int mask = 0; mask < limit; mask++) {
    if (reachable[mask] == 1) {
        for (int i = 0; i < n; i++) {
            if ((mask & (1 << i)) == 0 && total[mask] == old[i] && ((mask & required[i]) == required[i])) {
                reachable[mask | (1 << i)] = 1;
            }
        }
    }
}
if (reachable[limit - 1] == 1) {
    SAY("YES");
} else {
    SAY("NO");
}`,
  "py": `n = read_int()
events = [(read_int(), read_int(), read_int(), read_int()) for _ in range(n)]
required = [0] * n
for i in range(n):
    for j in range(n):
        if events[j][1] <= events[i][0]:
            required[i] |= 1 << j
limit = 1 << n
total = [0] * limit
for mask in range(1, limit):
    bit = mask & -mask
    index = bit.bit_length() - 1
    total[mask] = total[mask ^ bit] + events[index][2]
reachable = [0] * limit
reachable[0] = 1
for mask in range(limit):
    if reachable[mask] == 1:
        for i in range(n):
            if mask & (1 << i) == 0 and total[mask] == events[i][3] and (mask & required[i]) == required[i]:
                reachable[mask | (1 << i)] = 1
print("YES" if reachable[limit - 1] == 1 else "NO")`,
  "cbug": [
    "((mask & required[i]) == required[i])",
    "((mask & required[i]) != 0 || required[i] == 0)"
  ],
  "pybug": [
    "(mask & required[i]) == required[i]",
    "((mask & required[i]) != 0 or required[i] == 0)"
  ],
  "cases": [
    [
      "2\n0 4 2 0\n1 3 3 2",
      "YES"
    ],
    [
      "2\n0 1 2 3\n2 3 3 0",
      "NO"
    ],
    [
      "3\n0 2 1 0\n1 3 2 4\n4 5 3 1",
      "NO"
    ],
    [
      "0",
      "YES"
    ],
    [
      "1\n0 1 1 0",
      "YES"
    ],
    [
      "2\n0 3 1 0\n0 3 1 0",
      "NO"
    ],
    [
      "3\n0 9 2 0\n1 8 3 2\n2 7 4 5",
      "YES"
    ],
    [
      "3\n0 1 1 0\n1 2 1 1\n2 3 1 2",
      "YES"
    ]
  ],
  "witness": 3,
  "probe": [
    "12\n0 1 1 0\n2 3 1 2\n4 5 1 3\n6 7 1 4\n8 9 1 5\n10 11 1 6\n12 13 1 7\n14 15 1 8\n16 17 1 9\n18 19 1 10\n20 21 1 11\n22 23 1 1",
    "NO"
  ]
},
{
  "title": "Count the Legal Interleavings",
  "difficulty": 95,
  "guide": "An interleaving mixes workers' instructions while preserving each worker's order. A prefix is the part already executed. `held` stores held-lock sets as bit masks, integers whose binary digits mark held locks. `ways` counts schedules reaching each triple of progress positions.",
  "incident": "Patch is counting possible orders for three workers' repair instructions.",
  "symptom": "The counter includes schedules where different workers hold the same lock at once.",
  "task": "There are three workers and two exclusive locks, each usable by only one worker at a time. All locks start free. Action `1` or `2` acquires that lock; action `-1` or `-2` releases it. A schedule chooses one worker's next instruction at each step, preserving each worker's own instruction order. An acquisition can run only while its lock is free; a blocked worker may run later. Count schedules that finish every instruction legally. Different sequences of worker IDs count separately. A partial schedule that cannot finish contributes zero. Print the count modulo `1000000007`, its nonnegative remainder after division.",
  "input": "1. Read `length[0]`, `length[1]`, and `length[2]`, the instruction counts for workers `0`, `1`, and `2`.\n2. Read each worker's actions in worker ID order: first all of worker `0`, then `1`, then `2`. A worker of length `0` supplies no actions.",
  "output": "Print the number of complete legal schedules modulo `1000000007`. If all scripts are empty, print `1` for the empty schedule.",
  "example": "Input `2 2 0 1 -1 1 -1` gives workers `0` and `1` one acquire/release pair on lock `1`. The only worker sequences are `0 0 1 1` and `1 1 0 0`. Output: `2`.",
  "constraints": "Each entry in `length` is from `0` to `10`. Actions are `-2`, `-1`, `1`, or `2`. Each worker's script alone acquires only locks it does not hold, releases only locks it holds, and ends with no locks held. Worker IDs are `0`, `1`, `2`; lock IDs are `1`, `2`. No real threads run.",
  "defect": "The acquisition test checks only the acting worker's prefix instead of locks held by all workers.",
  "hints": [
    "Check whether a lock held by a different worker can be acquired.",
    "A progress triple determines all three held-lock sets, not just the acting worker's set.",
    "Combine all three held-lock masks before testing an acquire. Permit it only if its bit is absent; legal releases advance directly. Add schedule counts to the next progress triple modulo `1000000007`."
  ],
  "c": `ARRAY(length,3);
ARRAY(actions,30);
ARRAY(held,33);
ARRAY(ways,1331);
for (int t = 0; t < 3; t++) {
    READ(length[t]);
}
for (int t = 0; t < 3; t++) {
    for (int p = 0; p < length[t]; p++) {
        int action;
        READ(action);
        actions[t * 10 + p] = action;
        int lock = action;
        if (lock < 0) {
            lock = -lock;
        }
        int bit = 1 << (lock - 1);
        held[t * 11 + p + 1] = held[t * 11 + p];
        if (action > 0) {
            held[t * 11 + p + 1] |= bit;
        } else {
            held[t * 11 + p + 1] &= 3 ^ bit;
        }
    }
}
ways[0] = 1;
for (int a = 0; a <= length[0]; a++) {
    for (int b = 0; b <= length[1]; b++) {
        for (int c = 0; c <= length[2]; c++) {
            int state = a * 121 + b * 11 + c;
            int busy = held[a] | held[11 + b] | held[22 + c];
            for (int t = 0; t < 3; t++) {
                int position = a, step = 121;
                if (t == 1) {
                    position = b;
                    step = 11;
                } else if (t == 2) {
                    position = c;
                    step = 1;
                }
                if (position < length[t]) {
                    int action = actions[t * 10 + position];
                    int lock = action;
                    if (lock < 0) {
                        lock = -lock;
                    }
                    int bit = 1 << (lock - 1);
                    if (action < 0 || (busy & bit) == 0) {
                        ways[state + step] = (ways[state + step] + ways[state]) % 1000000007;
                    }
                }
            }
        }
    }
}
OUT(ways[length[0] * 121 + length[1] * 11 + length[2]]);`,
  "py": `length = [read_int() for _ in range(3)]
actions = [0] * 30
held = [0] * 33
for t in range(3):
    for p in range(length[t]):
        action = read_int()
        actions[t * 10 + p] = action
        bit = 1 << (abs(action) - 1)
        held[t * 11 + p + 1] = held[t * 11 + p]
        if action > 0:
            held[t * 11 + p + 1] |= bit
        else:
            held[t * 11 + p + 1] &= 3 ^ bit
ways = [0] * 1331
ways[0] = 1
for a in range(length[0] + 1):
    for b in range(length[1] + 1):
        for c in range(length[2] + 1):
            state = a * 121 + b * 11 + c
            busy = held[a] | held[11 + b] | held[22 + c]
            for t in range(3):
                position, step = [(a, 121), (b, 11), (c, 1)][t]
                if position < length[t]:
                    action = actions[t * 10 + position]
                    bit = 1 << (abs(action) - 1)
                    if action < 0 or (busy & bit) == 0:
                        ways[state + step] = (ways[state + step] + ways[state]) % 1000000007
print(ways[length[0] * 121 + length[1] * 11 + length[2]])`,
  "cbug": [
    "(busy & bit) == 0",
    "(held[t * 11 + position] & bit) == 0"
  ],
  "pybug": [
    "(busy & bit) == 0",
    "(held[t * 11 + position] & bit) == 0"
  ],
  "cases": [
    [
      "2 2 0\n1 -1\n1 -1",
      "2"
    ],
    [
      "2 2 0\n1 -1\n2 -2",
      "6"
    ],
    [
      "2 2 2\n1 -1\n1 -1\n1 -1",
      "6"
    ],
    [
      "0 0 0",
      "1"
    ],
    [
      "4 4 0\n1 2 -2 -1\n2 1 -1 -2",
      "4"
    ],
    [
      "4 0 0\n1 2 -1 -2",
      "1"
    ],
    [
      "4 2 2\n1 -1 1 -1\n1 -1\n2 -2",
      "84"
    ],
    [
      "4 2 2\n1 2 -2 -1\n1 -1\n2 -2",
      "26"
    ]
  ],
  "witness": 3,
  "probe": [
    "10 10 10\n1 -1 2 -2 1 -1 2 -2 1 -1\n1 -1 2 -2 1 -1 2 -2 1 -1\n1 -1 2 -2 1 -1 2 -2 1 -1",
    "344529612"
  ]
},
{
  "title": "Exact Coverage Under Conflicts",
  "difficulty": 100,
  "guide": "An exact cover repairs every module once. `mask` marks selected switches, while `coverage[mask]` marks their repaired modules. `valid` records allowed subsets, and `total` stores their costs.",
  "incident": "Mira is choosing repair switches without duplicate repairs.",
  "symptom": "A cheap subset that repairs some modules twice can be counted as valid, changing the minimum cost and the number of ties.",
  "task": "Each switch has a bit mask `cover`, an integer whose binary digits (bits) mark modules. A `1` bit means repaired; a `0` bit means not repaired. The rightmost bit marks module `0`, the next module `1`, and so on. Selecting a switch repairs all its marked modules and pays its `cost`. Choose a subset that repairs each of the `m` modules exactly once and never selects both members of a listed incompatible pair. Minimize total cost, and count all distinct subsets tied for that minimum. Different input switches remain distinct even when their masks and costs match.",
  "input": "1. Read `n`, the switch count, `m`, the module count, and `pairs`, the incompatible-pair count.\n2. Read `n` pairs: `cover`, the coverage mask, and `cost`, for each switch in ID order.\n3. Read `pairs` pairs of switch IDs `a` and `b` that cannot both be selected.",
  "output": "Print the minimum total cost and the number of subsets achieving it, separated by a space. If no valid exact cover exists, print `-1 0`. Count subsets once each, regardless of selection order; do not reduce the count modulo a divisor.",
  "example": "Input `3 3 0 3 1 6 1 7 5` offers masks `3`, `6`, and `7`. The first two both repair module `1`, so they cannot form an exact cover. Only the third switch covers all three modules once. Output: `5 1`.",
  "constraints": "`0 <= n <= 16`. `1 <= m <= 12`. `0 <= pairs <= n * (n - 1) / 2`. Each `cover` value is from `1` through `(1 << m) - 1`; `0 <= cost <= 100`. Switch IDs are `0` through `n - 1`; module IDs are `0` through `m - 1`. Each pair has different valid IDs, is unordered, and appears once. At most `65536` subsets exist; the count fits a signed 32-bit integer.",
  "defect": "The coverage test rejects only full containment, allowing a partially overlapping switch to repair a module twice.",
  "hints": [
    "Covering every module at least once is weaker than covering every module exactly once.",
    "Adding a switch is invalid if even one module overlaps the smaller subset's coverage.",
    "Extend only a valid smaller subset with no conflicting switch and `(coverage[previous] & cover[index]) == 0`. For full coverage, reset the count on a cheaper cost and add one on an equal cost."
  ],
  "c": `int n, m, pairs;
READ(n);
READ(m);
READ(pairs);
ARRAY(cover,16);
ARRAY(cost,16);
ARRAY(conflict,16);
ARRAY(valid,65536);
ARRAY(coverage,65536);
ARRAY(total,65536);
for (int i = 0; i < n; i++) {
    READ(cover[i]);
    READ(cost[i]);
}
for (int i = 0; i < pairs; i++) {
    int a, b;
    READ(a);
    READ(b);
    conflict[a] |= 1 << b;
    conflict[b] |= 1 << a;
}
int limit = 1 << n;
int full = (1 << m) - 1;
int best = 1000000, ways = 0;
valid[0] = 1;
for (int mask = 1; mask < limit; mask++) {
    int bit = mask & -mask;
    int index = 0, bits = bit;
    while (bits > 1) {
        bits >>= 1;
        index++;
    }
    int previous = mask ^ bit;
    if (valid[previous] == 1 && (conflict[index] & previous) == 0 && (coverage[previous] & cover[index]) == 0) {
        valid[mask] = 1;
        coverage[mask] = coverage[previous] | cover[index];
        total[mask] = total[previous] + cost[index];
        if (coverage[mask] == full) {
            if (total[mask] < best) {
                best = total[mask];
                ways = 1;
            } else if (total[mask] == best) {
                ways++;
            }
        }
    }
}
if (ways == 0) {
    OUT(-1);
    OUT(0);
} else {
    OUT(best);
    OUT(ways);
}`,
  "py": `n, m, pairs = read_int(), read_int(), read_int()
cover = [0] * n
cost = [0] * n
conflict = [0] * n
for i in range(n):
    cover[i], cost[i] = read_int(), read_int()
for _ in range(pairs):
    a, b = read_int(), read_int()
    conflict[a] |= 1 << b
    conflict[b] |= 1 << a
limit = 1 << n
full = (1 << m) - 1
valid = [0] * limit
coverage = [0] * limit
total = [0] * limit
valid[0] = 1
best = 1000000
ways = 0
for mask in range(1, limit):
    bit = mask & -mask
    index = bit.bit_length() - 1
    previous = mask ^ bit
    if valid[previous] == 1 and conflict[index] & previous == 0 and coverage[previous] & cover[index] == 0:
        valid[mask] = 1
        coverage[mask] = coverage[previous] | cover[index]
        total[mask] = total[previous] + cost[index]
        if coverage[mask] == full:
            if total[mask] < best:
                best = total[mask]
                ways = 1
            elif total[mask] == best:
                ways += 1
print(-1, 0) if ways == 0 else print(best, ways)`,
  "cbug": [
    "(coverage[previous] & cover[index]) == 0",
    "(coverage[previous] & cover[index]) != cover[index]"
  ],
  "pybug": [
    "coverage[previous] & cover[index] == 0",
    "coverage[previous] & cover[index] != cover[index]"
  ],
  "cases": [
    [
      "3 3 0\n3 1\n6 1\n7 5",
      "5 1"
    ],
    [
      "2 2 1\n1 1\n2 1\n0 1",
      "-1 0"
    ],
    [
      "2 3 0\n3 2\n6 2",
      "-1 0"
    ],
    [
      "0 1 0",
      "-1 0"
    ],
    [
      "3 2 0\n1 0\n1 0\n2 0",
      "0 2"
    ],
    [
      "3 2 1\n1 1\n2 1\n3 5\n0 1",
      "5 1"
    ],
    [
      "4 3 0\n1 1\n2 1\n4 1\n7 3",
      "3 2"
    ],
    [
      "16 12 0\n1 100\n2 100\n4 100\n8 100\n16 100\n32 100\n64 100\n128 100\n256 100\n512 100\n1024 100\n2048 100\n1 100\n2 100\n4 100\n8 100",
      "1200 16"
    ]
  ],
  "witness": 3,
  "probe": [
    "16 12 0\n4094 0\n2047 0\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100\n4095 100",
    "100 14"
  ]
}
];
