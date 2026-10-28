// Private organiser definitions. The first two cases of each mission are public samples.
export const graphs = [
  {
    title: "Twin Arrival Ledger",
    difficulty: 25,
    guide: "`queue` lists relays waiting to be explored. `distance` stores cable counts, and `ways` stores route counts.",
    incident: "AEGIS has disrupted route counts. Mira checks how many shortest routes reach each relay.",
    symptom: "One of several equally short routes to a relay can be lost.",
    task: "For every relay, count shortest routes from `s` (the start) along two-way cables. A route is a sequence of relays joined by cables; its length is its number of cables. Different relay sequences count separately, including routes tied for shortest length. Print `0` for an unreachable relay. The zero-cable route from `s` to itself counts once.",
    input: "1. Read `n` (the number of relays), `m` (the number of cables), and `s` (the start).\n2. Read `m` pairs `u v`, the endpoints of each two-way cable.",
    output: "Print `n` route counts separated by spaces, for relays `0` through `n - 1` in order.",
    example: "In the first sample, `0 -> 1 -> 3` and `0 -> 2 -> 3` are both shortest routes to relay `3`. Print `1 1 1 2`. In the second sample, only start `2` is reachable, so print `0 0 1`.",
    constraints: "`1 <= n <= 16`; `0 <= m <= n * (n - 1) / 2`. Relays are numbered `0` through `n - 1`. No cable is repeated or joins a relay to itself. Counts fit a signed 32-bit integer.",
    defect: "An equal-distance arrival replaces the accumulated route count instead of contributing to it.",
    hints: ["Trace the two shortest routes to relay `3` in the first sample.","A later arrival at the same shortest distance can represent more routes.","When `distance[v] == distance[u] + 1`, add `ways[u]` to `ways[v]` instead of replacing it. These are the route counts for predecessor `u` and destination `v`."],
    c: `
int n, m, s;
READ(n);
READ(m);
READ(s);
ARRAY(edge,256);
ARRAY(distance,16);
ARRAY(ways,16);
ARRAY(queue,16);
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 16 + v] = 1;
    edge[v * 16 + u] = 1;
}
for (int v = 0; v < n; v++) {
    distance[v] = -1;
}
int head = 0;
int tail = 1;
queue[0] = s;
distance[s] = 0;
ways[s] = 1;
while (head < tail) {
    int u = queue[head++];
    for (int v = 0; v < n; v++) {
        if (edge[u * 16 + v] != 0) {
            if (distance[v] == -1) {
                distance[v] = distance[u] + 1;
                ways[v] = ways[u];
                queue[tail++] = v;
            } else if (distance[v] == distance[u] + 1) {
                ways[v] += ways[u];
            }
        }
    }
}
for (int v = 0; v < n; v++) {
    OUT(ways[v]);
}
`,
    py: `
n, m, s = read_int(), read_int(), read_int()
edge = [[] for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u].append(v)
    edge[v].append(u)
distance = [-1] * n
ways = [0] * n
queue = [s]
distance[s] = 0
ways[s] = 1
head = 0
while head < len(queue):
    u = queue[head]
    head += 1
    for v in edge[u]:
        if distance[v] == -1:
            distance[v] = distance[u] + 1
            ways[v] = ways[u]
            queue.append(v)
        elif distance[v] == distance[u] + 1:
            ways[v] += ways[u]
print(*ways)
`,
    cbug: ["ways[v] += ways[u];", "ways[v] = ways[u];"],
    pybug: ["ways[v] += ways[u]", "ways[v] = ways[u]"],
    cases: [["4 4 0\n0 1\n0 2\n1 3\n2 3", "1 1 1 2"], ["3 1 2\n0 1", "0 0 1"], ["5 5 0\n0 1\n0 2\n1 3\n2 3\n3 4", "1 1 1 2 2"], ["1 0 0\n", "1"], ["4 4 3\n0 1\n1 2\n2 3\n0 3", "1 2 1 1"], ["6 8 0\n0 1\n0 2\n1 3\n2 3\n1 4\n2 4\n3 5\n4 5", "1 1 1 2 2 4"], ["16 15 15\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15", "1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1"], ["5 10 2\n0 1\n0 2\n0 3\n0 4\n1 2\n1 3\n1 4\n2 3\n2 4\n3 4", "1 1 1 1 1"]],
    witness: 3,
    probe: ["4 4 3\n0 1\n0 2\n1 3\n2 3", "2 1 1 1"]
  },
  {
    title: "Repair Front Collision",
    difficulty: 34,
    guide: "`owner` records which station's search first reaches a relay. `distance` stores distance from that station, `best` tracks the answer, and `queue` holds relays waiting to be explored.",
    incident: "AEGIS has separated repair stations. Ishan checks the smallest distance between any two stations.",
    symptom: "The reported distance can be shorter than every real route between stations.",
    task: "Find the fewest two-way cables on a route between any two different listed stations. Choose the smallest distance over all station pairs. If pairs tie, print only the distance. Print `-1` if no two listed stations can reach each other.",
    input: "1. Read `n` (the number of relays), `m` (the number of cables), and `k` (the number of stations).\n2. Read `k` different station relay numbers.\n3. Read `m` pairs `u v`, the endpoints of each two-way cable.",
    output: "Print the smallest station-to-station cable count, or `-1` if no pair is connected.",
    example: "The first sample is chain `0-1-2-3`, with stations `0` and `3`. Their route uses three cables, so print `3`. The second sample has no cables, so print `-1`.",
    constraints: "`2 <= n <= 32`; `2 <= k <= n`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Stations are distinct. No cable is repeated or joins a relay to itself.",
    defect: "The meeting cable is omitted when combining distances from two different owners.",
    hints: ["Two searches can meet at opposite ends of a cable.","`distance[u]` and `distance[v]` end at different relays when their `owner` entries differ.","Include the joining cable: the route length is `distance[u] + distance[v] + 1`. Keep the smallest such value in `best`."],
    c: `
int n, m, k;
READ(n);
READ(m);
READ(k);
ARRAY(edge,1024);
ARRAY(owner,32);
ARRAY(distance,32);
ARRAY(queue,32);
for (int i = 0; i < n; i++) {
    owner[i] = -1;
}
int head = 0;
int tail = 0;
for (int i = 0; i < k; i++) {
    int s;
    READ(s);
    owner[s] = s;
    queue[tail++] = s;
}
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
    edge[v * 32 + u] = 1;
}
int best = 1000000;
while (head < tail) {
    int u = queue[head++];
    for (int v = 0; v < n; v++) {
        if (edge[u * 32 + v] != 0) {
            if (owner[v] == -1) {
                owner[v] = owner[u];
                distance[v] = distance[u] + 1;
                queue[tail++] = v;
            } else if (owner[v] != owner[u]) {
                int candidate = distance[u] + distance[v] + 1;
                if (candidate < best) {
                    best = candidate;
                }
            }
        }
    }
}
OUT(best == 1000000 ? -1 : best);
`,
    py: `
n, m, k = read_int(), read_int(), read_int()
stations = [read_int() for _ in range(k)]
edge = [[] for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u].append(v)
    edge[v].append(u)
owner = [-1] * n
distance = [0] * n
queue = list(stations)
for s in stations:
    owner[s] = s
best = 1000000
head = 0
while head < len(queue):
    u = queue[head]
    head += 1
    for v in edge[u]:
        if owner[v] == -1:
            owner[v] = owner[u]
            distance[v] = distance[u] + 1
            queue.append(v)
        elif owner[v] != owner[u]:
            candidate = distance[u] + distance[v] + 1
            best = min(best, candidate)
print(-1 if best == 1000000 else best)
`,
    cbug: ["distance[u] + distance[v] + 1", "distance[u] + distance[v]"],
    pybug: ["distance[u] + distance[v] + 1", "distance[u] + distance[v]"],
    cases: [["4 3 2\n0 3\n0 1\n1 2\n2 3", "3"], ["3 0 2\n0 2\n", "-1"], ["2 1 2\n0 1\n0 1", "1"], ["5 4 3\n0 2 4\n0 1\n1 2\n2 3\n3 4", "2"], ["6 3 2\n0 5\n0 1\n2 3\n3 4", "-1"], ["5 4 3\n1 2 4\n0 1\n0 2\n0 3\n0 4", "2"], ["32 31 2\n0 31\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31", "31"], ["4 4 2\n3 1\n0 1\n1 2\n2 3\n3 0", "2"]],
    witness: 3,
    probe: ["3 2 3\n0 1 2\n0 1\n1 2", "1"]
  },
  {
    title: "Even Pulse Corridor",
    difficulty: 40,
    guide: "`state` combines a relay number with `parity` (whether the length is even or odd). `distance` stores a separate length for each state, and `queue` holds states waiting to be explored.",
    incident: "AEGIS requires an even number of link crossings. Patch checks the shortest allowed walk.",
    symptom: "The program can accept an odd-length walk or miss an even-length one.",
    task: "Find the shortest walk from `s` (the start) to `t` (the target) using an even number of one-way links. A walk follows the listed directions and may repeat relays or links. Count every link crossing, including repeats. A zero-link walk is allowed when `s == t`. Print `-1` if no even-length walk exists.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), `s` (the start), and `t` (the target).\n2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.",
    output: "Print the fewest link crossings in an even-length walk, or `-1` if none exists.",
    example: "The first sample has only link `0 -> 1`. Its only walk to target `1` has odd length, so print `-1`. The second sample has `0 -> 1 -> 2`, so print `2`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Directed links are distinct; links from a relay to itself are allowed.",
    defect: "Crossing a link keeps the old hop parity instead of switching to the other parity state.",
    hints: ["Reaching one relay after odd and even numbers of steps gives different search states.","What happens to `parity` (even or odd length) after crossing one link?","Use `1 - parity` for the neighbour state. Keep both states for every relay and read the even state at `t` (the target)."],
    c: `
int n, m, s, t;
READ(n);
READ(m);
READ(s);
READ(t);
ARRAY(edge,1024);
ARRAY(distance,64);
ARRAY(queue,64);
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
}
for (int i = 0; i < 2 * n; i++) {
    distance[i] = -1;
}
int head = 0;
int tail = 1;
queue[0] = s * 2;
distance[s * 2] = 0;
while (head < tail) {
    int state = queue[head++];
    int u = state / 2;
    int parity = state % 2;
    for (int v = 0; v < n; v++) {
        int nextState = v * 2 + (1 - parity);
        if (edge[u * 32 + v] != 0 && distance[nextState] == -1) {
            distance[nextState] = distance[state] + 1;
            queue[tail++] = nextState;
        }
    }
}
OUT(distance[t * 2]);
`,
    py: `
n, m, s, t = read_int(), read_int(), read_int(), read_int()
edge = [[] for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u].append(v)
distance = [-1] * (2 * n)
distance[s * 2] = 0
queue = [s * 2]
head = 0
while head < len(queue):
    state = queue[head]
    head += 1
    u, parity = state // 2, state % 2
    for v in edge[u]:
        next_state = v * 2 + (1 - parity)
        if distance[next_state] == -1:
            distance[next_state] = distance[state] + 1
            queue.append(next_state)
print(distance[t * 2])
`,
    cbug: ["v * 2 + (1 - parity)", "v * 2 + parity"],
    pybug: ["v * 2 + (1 - parity)", "v * 2 + parity"],
    cases: [["2 1 0 1\n0 1", "-1"], ["3 2 0 2\n0 1\n1 2", "2"], ["3 3 0 1\n0 1\n1 2\n2 0", "4"], ["1 0 0 0\n", "0"], ["2 2 0 1\n0 0\n0 1", "2"], ["4 2 0 3\n0 1\n1 2", "-1"], ["32 31 0 30\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31", "30"], ["4 5 0 3\n0 1\n1 2\n2 1\n2 3\n0 3", "-1"]],
    witness: 3,
    probe: ["2 2 0 1\n0 1\n1 1", "2"]
  },
  {
    title: "Parallel Repair Clock",
    difficulty: 42,
    guide: "`duration` stores job lengths, `indegree` counts unfinished requirements, and `queue` lists released jobs. `ready` holds start times under consideration; `finish` holds finish times.",
    incident: "AEGIS has disrupted repair times. Mira checks when each job can finish with unlimited workers.",
    symptom: "A job can be delayed as if its independent requirements ran one after another.",
    task: "The jobs and their requirements form a directed acyclic graph: a network of jobs and one-way requirement links with no directed route returning to its start. A pair `u v` means job `u` must finish before job `v` starts. Jobs may run at the same time, with no worker limit. Jobs without requirements may start at time `0`; every other job may start as soon as all its required jobs finish. Print each job's earliest finish time.",
    input: "1. Read `n` (the number of jobs) and `m` (the number of requirements).\n2. Read `n` durations into `duration`, in job-number order.\n3. Read `m` pairs `u v`, with the required earlier job first.",
    output: "Print `n` earliest finish times separated by spaces, for jobs `0` through `n - 1` in order.",
    example: "In the first sample, jobs `0` and `1` take `3` and `5` time units and can run together. Job `2` takes `2` units after both finish. Print `3 5 7`. The second sample is a chain and prints `2 5 9`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; durations are from `1` through `1000`. Jobs are numbered `0` through `n - 1`. Requirement pairs are distinct, with no self-requirements or directed cycles.",
    defect: "The prerequisite merge adds finish times instead of keeping their maximum.",
    hints: ["Independent jobs can run during the same time period.","A job waits for all its requirements, but their finish times are not separate waiting periods.","Keep the largest predecessor finish time in `ready[v]` (job `v`'s start time). Add `duration[v]` once to obtain its finish time."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(duration,32);
ARRAY(edge,1024);
ARRAY(indegree,32);
ARRAY(ready,32);
ARRAY(finish,32);
ARRAY(queue,32);
for (int i = 0; i < n; i++) {
    READ(duration[i]);
}
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
    indegree[v]++;
}
int head = 0;
int tail = 0;
for (int v = 0; v < n; v++) {
    if (indegree[v] == 0) {
        queue[tail++] = v;
    }
}
while (head < tail) {
    int u = queue[head++];
    finish[u] = ready[u] + duration[u];
    for (int v = 0; v < n; v++) {
        if (edge[u * 32 + v] != 0) {
            if (finish[u] > ready[v]) {
                ready[v] = finish[u];
            }
            indegree[v]--;
            if (indegree[v] == 0) {
                queue[tail++] = v;
            }
        }
    }
}
for (int v = 0; v < n; v++) {
    OUT(finish[v]);
}
`,
    py: `
n, m = read_int(), read_int()
duration = [read_int() for _ in range(n)]
edge = [[] for _ in range(n)]
indegree = [0] * n
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u].append(v)
    indegree[v] += 1
ready = [0] * n
finish = [0] * n
queue = [v for v in range(n) if indegree[v] == 0]
head = 0
while head < len(queue):
    u = queue[head]
    head += 1
    finish[u] = ready[u] + duration[u]
    for v in edge[u]:
        if finish[u] > ready[v]:
            ready[v] = finish[u]
        indegree[v] -= 1
        if indegree[v] == 0:
            queue.append(v)
print(*finish)
`,
    cbug: ["if (finish[u] > ready[v]) {\n                ready[v] = finish[u];\n            }", "ready[v] += finish[u];"],
    pybug: ["if finish[u] > ready[v]:\n            ready[v] = finish[u]", "ready[v] += finish[u]"],
    cases: [["3 2\n3 5 2\n0 2\n1 2", "3 5 7"], ["3 2\n2 3 4\n0 1\n1 2", "2 5 9"], ["4 3\n5 5 5 1\n0 3\n1 3\n2 3", "5 5 5 6"], ["1 0\n7\n", "7"], ["4 0\n9 1 8 2\n", "9 1 8 2"], ["5 4\n4 7 3 2 6\n0 2\n1 2\n2 4\n3 4", "4 7 10 2 16"], ["32 31\n1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31", "1000 2000 3000 4000 5000 6000 7000 8000 9000 10000 11000 12000 13000 14000 15000 16000 17000 18000 19000 20000 21000 22000 23000 24000 25000 26000 27000 28000 29000 30000 31000 32000"], ["4 3\n2 1 3 7\n3 0\n2 0\n0 1", "9 10 3 7"]],
    witness: 3,
    probe: ["2 1\n1000 1\n1 0", "1001 1"]
  },
  {
    title: "Cycle Admission Desk",
    difficulty: 39,
    guide: "A connected component contains a relay and all relays reachable from it. `parent` stores chains of group labels. The loops follow those chains to representatives `a` and `b`, then update `rejected` (the rejection count) or join groups.",
    incident: "AEGIS has disrupted cable approvals. Ishan checks requests against the cables already accepted.",
    symptom: "A cable can be accepted even though an existing route already connects its endpoints.",
    task: "Start with `n` separate relays. Process requests in input order. Accept a two-way cable only if its endpoints cannot already reach each other through accepted cables. Otherwise reject it. Count rejected requests. A request joining a relay to itself is rejected. A later request for an already accepted cable is also rejected.",
    input: "1. Read `n` (the number of relays) and `m` (the number of requests).\n2. Read `m` pairs `u v`, the endpoints of each requested cable, in processing order.",
    output: "Print one integer: the number of rejected requests.",
    example: "In the first sample, accepted requests `0 1` and `1 2` already connect `0` to `2`. Reject request `0 2` and print `1`. The second sample joins two separate pairs and prints `0`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`, and endpoints are valid. Repeated requests and requests joining a relay to itself are allowed. The supplied group searches use loops.",
    defect: "The cycle test compares immediate parent links rather than the roots already found.",
    hints: ["Two relays can share a group even when their next parent labels differ.","Compare the ends of the two `parent` chains, rather than just their first links.","Use `a == b` for the group comparison. The loops have already made `a` and `b` the representatives of the endpoint groups."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(parent,32);
for (int i = 0; i < n; i++) {
    parent[i] = i;
}
int rejected = 0;
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    int a = u;
    int b = v;
    while (parent[a] != a) {
        a = parent[a];
    }
    while (parent[b] != b) {
        b = parent[b];
    }
    if (a == b) {
        rejected++;
    } else {
        parent[a] = b;
    }
}
OUT(rejected);
`,
    py: `
n, m = read_int(), read_int()
parent = list(range(n))
rejected = 0
for _ in range(m):
    u, v = read_int(), read_int()
    a, b = u, v
    while parent[a] != a:
        a = parent[a]
    while parent[b] != b:
        b = parent[b]
    if a == b:
        rejected += 1
    else:
        parent[a] = b
print(rejected)
`,
    cbug: ["if (a == b)", "if (parent[u] == parent[v])"],
    pybug: ["if a == b:", "if parent[u] == parent[v]:"],
    cases: [["3 3\n0 1\n1 2\n0 2", "1"], ["4 2\n0 1\n2 3", "0"], ["4 5\n0 1\n1 2\n2 3\n0 3\n0 2", "2"], ["1 2\n0 0\n0 0", "2"], ["2 3\n0 1\n1 0\n0 1", "2"], ["5 0\n", "0"], ["32 33\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31\n0 31\n4 30", "2"], ["6 6\n0 1\n2 3\n1 3\n4 5\n3 5\n0 4", "1"]],
    witness: 3,
    probe: ["3 0\n", "0"]
  },
  {
    title: "Two Phase Isolation",
    difficulty: 35,
    guide: "`color` stores phase labels, with `-1` meaning unassigned. `queue` holds relays waiting to be explored, and `valid` records whether a conflict was found.",
    incident: "AEGIS has disrupted cooling settings. Patch checks whether linked relays can use opposite settings.",
    symptom: "The checker can reject a valid labelling and accept a conflicting one.",
    task: "Give each relay one of two phases, meaning labels `0` and `1`. Decide whether every two-way cable can have different labels at its endpoints. Check the whole network, including separate groups and isolated relays. A cable from a relay to itself makes this impossible. Only existence matters; do not print the labels.",
    input: "1. Read `n` (the number of relays) and `m` (the number of cables).\n2. Read `m` pairs `u v`, the endpoints of each two-way cable.",
    output: "Print `1` if such a labelling exists, otherwise `0`.",
    example: "The triangle in the first sample cannot give different labels to both ends of every cable, so print `0`. The four-relay ring in the second sample can alternate labels, so print `1`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Cables are distinct; a cable may join a relay to itself.",
    defect: "The conflict check treats opposite phases as a conflict instead of equal phases.",
    hints: ["Check a cable whose endpoints both already have labels.","New neighbours get labels, but links to previously labelled relays must also be checked.","For an already labelled neighbour, a conflict occurs when `color[v] == color[u]`. These are the endpoint labels; different labels are allowed."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(edge,1024);
ARRAY(color,32);
ARRAY(queue,32);
for (int i = 0; i < n; i++) {
    color[i] = -1;
}
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
    edge[v * 32 + u] = 1;
}
int valid = 1;
for (int s = 0; s < n; s++) {
    if (color[s] == -1) {
        int head = 0;
        int tail = 1;
        queue[0] = s;
        color[s] = 0;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++) {
                if (edge[u * 32 + v] != 0) {
                    if (color[v] == -1) {
                        color[v] = 1 - color[u];
                        queue[tail++] = v;
                    } else if (color[v] == color[u]) {
                        valid = 0;
                    }
                }
            }
        }
    }
}
OUT(valid);
`,
    py: `
n, m = read_int(), read_int()
edge = [[] for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u].append(v)
    edge[v].append(u)
color = [-1] * n
valid = 1
for s in range(n):
    if color[s] == -1:
        color[s] = 0
        queue = [s]
        head = 0
        while head < len(queue):
            u = queue[head]
            head += 1
            for v in edge[u]:
                if color[v] == -1:
                    color[v] = 1 - color[u]
                    queue.append(v)
                elif color[v] == color[u]:
                    valid = 0
print(valid)
`,
    cbug: ["color[v] == color[u]", "color[v] == 1 - color[u]"],
    pybug: ["elif color[v] == color[u]:", "elif color[v] == 1 - color[u]:"],
    cases: [["3 3\n0 1\n1 2\n2 0", "0"], ["4 4\n0 1\n1 2\n2 3\n3 0", "1"], ["2 1\n0 1", "1"], ["1 0\n", "1"], ["1 1\n0 0", "0"], ["7 4\n0 1\n3 4\n4 5\n5 3", "0"], ["32 31\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31", "1"], ["6 9\n0 3\n0 4\n0 5\n1 3\n1 4\n1 5\n2 3\n2 4\n2 5", "1"]],
    witness: 3,
    probe: ["2 2\n0 1\n1 1", "0"]
  },
  {
    title: "Nested Repair Load",
    difficulty: 45,
    guide: "`parent` stores each relay's parent, `value` its input load, and `total` its working total. `queue` records an order starting at root `0`; a later loop reads that order backwards.",
    incident: "AEGIS has disrupted load totals. Patch checks the total load below each relay.",
    symptom: "Totals can omit loads from grandchildren and more distant descendants.",
    task: "A tree connects all relays and has exactly one route between any two without repeating a relay. Root `0` sets parent-child directions away from itself. A descendant is reached by following children away from the root. A relay's subtree contains itself and all its descendants. Print the sum of signed loads in each subtree. Negative loads subtract from the sum.",
    input: "1. Read `n` (the number of relays).\n2. Read `n` signed loads into `value`, in relay-number order.\n3. Read `n - 1` parent numbers into `parent`, for relays `1` through `n - 1` in order.",
    output: "Print `n` subtree sums separated by spaces, for relays `0` through `n - 1` in order.",
    example: "The first sample is chain `0-1-2` with loads `2 3 5`. Print subtree sums `10 8 5`. In the second sample, relays `1` and `2` are children of `0`; loads `1 -2 4` give sums `3 -2 4`.",
    constraints: "`1 <= n <= 32`; loads are from `-1000` through `1000`. Relays are numbered `0` through `n - 1`. The parent list forms one valid tree rooted at `0`; no relay is its own parent. A parent's number may be larger than its child's.",
    defect: "A child passes only its original load instead of its fully accumulated subtree total.",
    hints: ["Trace a relay with a child and a grandchild.","In the backwards loop, each child's `total` already includes the loads below that child.","Add `total[u]` (the child's accumulated load) to `total[parent[u]]` (the parent's total). Adding only `value[u]` loses deeper descendants."],
    c: `
int n;
READ(n);
ARRAY(value,32);
ARRAY(total,32);
ARRAY(parent,32);
ARRAY(queue,32);
for (int i = 0; i < n; i++) {
    READ(value[i]);
    total[i] = value[i];
}
for (int i = 1; i < n; i++) {
    READ(parent[i]);
}
int head = 0;
int tail = 1;
queue[0] = 0;
while (head < tail) {
    int u = queue[head++];
    for (int v = 1; v < n; v++) {
        if (parent[v] == u) {
            queue[tail++] = v;
        }
    }
}
for (int i = n - 1; i > 0; i--) {
    int u = queue[i];
    total[parent[u]] += total[u];
}
for (int i = 0; i < n; i++) {
    OUT(total[i]);
}
`,
    py: `
n = read_int()
value = [read_int() for _ in range(n)]
parent = [0] + [read_int() for _ in range(n - 1)]
total = list(value)
queue = [0]
head = 0
while head < len(queue):
    u = queue[head]
    head += 1
    for v in range(1, n):
        if parent[v] == u:
            queue.append(v)
for u in reversed(queue[1:]):
    total[parent[u]] += total[u]
print(*total)
`,
    cbug: ["total[parent[u]] += total[u]", "total[parent[u]] += value[u]"],
    pybug: ["total[parent[u]] += total[u]", "total[parent[u]] += value[u]"],
    cases: [["3\n2 3 5\n0 1", "10 8 5"], ["3\n1 -2 4\n0 0", "3 -2 4"], ["4\n1 2 3 4\n0 1 2", "10 9 7 4"], ["1\n0\n", "0"], ["4\n5 -5 7 3\n2 0 1", "10 -2 5 3"], ["6\n1 -1 2 -2 3 -3\n0 1 1 2 2", "0 -1 2 -2 3 -3"], ["32\n1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000\n0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30", "32000 31000 30000 29000 28000 27000 26000 25000 24000 23000 22000 21000 20000 19000 18000 17000 16000 15000 14000 13000 12000 11000 10000 9000 8000 7000 6000 5000 4000 3000 2000 1000"], ["3\n-1 -2 -3\n0 1", "-6 -5 -3"]],
    witness: 3,
    probe: ["4\n0 0 0 0\n0 1 2", "0 0 0 0"]
  },
  {
    title: "Cooling Tree Core",
    difficulty: 43,
    guide: "`degree` stores neighbour counts. `queue` holds leaves, meaning relays with at most one remaining neighbour. `remaining` tracks the number of relays left while outer layers are removed.",
    incident: "AEGIS has disrupted cooling routes. Ishan checks the best relay positions.",
    symptom: "The chosen relays can depend on the order in which outer relays are processed.",
    task: "The two-way cables form a tree: they connect all relays and give exactly one route between any two without repeating a relay. Distance is the number of cables on that route. For each relay, consider its greatest distance to any relay. Print every relay whose greatest distance is as small as possible. These are the tree's centres. Print all ties; a tree has one centre or two adjacent centres.",
    input: "1. Read `n` (the number of relays) and `m` (the number of cables).\n2. Read `m` pairs `u v`, the endpoints of each two-way cable. Here `m == n - 1`.",
    output: "Print the centre relay numbers separated by spaces, in increasing order. A one-relay tree prints `0`.",
    example: "In the first sample, chain `0-1-2-3` has two tied centres, so print `1 2`. The five-relay chain in the second sample has one centre, so print `2`.",
    constraints: "`1 <= n <= 32`; `m == n - 1`. Relays are numbered `0` through `n - 1`. The distinct cables form one tree; no cable joins a relay to itself.",
    defect: "Only one queued leaf is removed per round instead of the complete layer present at the round's start.",
    hints: ["Changing the order of the leaf numbers should not change the central positions.","Leaves discovered during a removal layer belong to the next layer.","Set `batch` (the layer size) to the number of leaves waiting at the start of the round. Remove that whole batch before checking `remaining` again."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(edge,1024);
ARRAY(degree,32);
ARRAY(queue,32);
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
    edge[v * 32 + u] = 1;
    degree[u]++;
    degree[v]++;
}
int head = 0;
int tail = 0;
for (int v = 0; v < n; v++) {
    if (degree[v] <= 1) {
        queue[tail++] = v;
    }
}
int remaining = n;
while (remaining > 2) {
    int batch = tail - head;
    remaining -= batch;
    for (int i = 0; i < batch; i++) {
        int u = queue[head++];
        for (int v = 0; v < n; v++) {
            if (edge[u * 32 + v] != 0) {
                degree[v]--;
                if (degree[v] == 1) {
                    queue[tail++] = v;
                }
            }
        }
    }
}
for (int v = 0; v < n; v++) {
    for (int i = head; i < tail; i++) {
        if (queue[i] == v) {
            OUT(v);
        }
    }
}
`,
    py: `
n, m = read_int(), read_int()
edge = [[] for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u].append(v)
    edge[v].append(u)
degree = [len(row) for row in edge]
queue = [v for v in range(n) if degree[v] <= 1]
head = 0
remaining = n
while remaining > 2:
    batch = len(queue) - head
    remaining -= batch
    for _ in range(batch):
        u = queue[head]
        head += 1
        for v in edge[u]:
            degree[v] -= 1
            if degree[v] == 1:
                queue.append(v)
print(*sorted(queue[head:]))
`,
    cbug: ["int batch = tail - head;", "int batch = 1;"],
    pybug: ["batch = len(queue) - head", "batch = 1"],
    cases: [["4 3\n0 1\n1 2\n2 3", "1 2"], ["5 4\n0 1\n1 2\n2 3\n3 4", "2"], ["5 4\n0 1\n0 2\n0 3\n0 4", "0"], ["1 0\n", "0"], ["2 1\n0 1", "0 1"], ["7 6\n0 1\n0 2\n1 3\n1 4\n2 5\n2 6", "0"], ["32 31\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31", "15 16"], ["6 5\n4 0\n4 1\n4 2\n2 3\n3 5", "2"]],
    witness: 3,
    probe: ["3 2\n0 2\n2 1", "2"]
  },
  {
    title: "Tentative Alarm Queue",
    difficulty: 49,
    guide: "`distance` stores costs found so far and `done` marks relays treated as final. Each outer pass selects a relay, scans its outgoing links, and updates costs.",
    incident: "AEGIS has changed link delays. Ishan checks the minimum travel cost to each relay.",
    symptom: "A low-numbered relay can be treated as final before a cheaper route to it is considered.",
    task: "For every relay, find the minimum total cost of a directed route from `s` (the start). Add all link costs on the route. Links may cost `0`. The zero-link route at `s` costs `0`. Print `-1` for an unreachable relay. If routes tie, print only their minimum cost.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).\n2. Read `m` triples `u v w`, a link from `u` to `v` only, with cost `w`.",
    output: "Print `n` minimum costs separated by spaces, for relays `0` through `n - 1` in order. Use `-1` for each unreachable relay.",
    example: "In the first sample, route `0 -> 2 -> 1` costs `1 + 1 = 2`, less than direct cost `9`. Print `0 2 1`. In the second sample, relay `2` is unreachable, so print `0 2 -1`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No directed link is repeated or joins a relay to itself.",
    defect: "The next settled relay is chosen by its label rather than its tentative cost.",
    hints: ["A relay's number does not measure travel cost.","Once `done` marks a relay final, later routes cannot improve its cost in this code.","Select the unused relay with the smallest entry in `distance`, not the smallest relay number. Nonnegative link costs make that selected cost final."],
    c: `
int n, m, s;
READ(n);
READ(m);
READ(s);
ARRAY(edge,1024);
ARRAY(distance,32);
ARRAY(done,32);
for (int i = 0; i < 1024; i++) {
    edge[i] = -1;
}
for (int i = 0; i < m; i++) {
    int u, v, w;
    READ(u);
    READ(v);
    READ(w);
    edge[u * 32 + v] = w;
}
for (int i = 0; i < n; i++) {
    distance[i] = 1000000;
}
distance[s] = 0;
for (int step = 0; step < n; step++) {
    int u = -1;
    for (int v = 0; v < n; v++) {
        if (done[v] == 0 && (u == -1 || distance[v] < distance[u])) {
            u = v;
        }
    }
    if (u == -1 || distance[u] == 1000000) {
        break;
    }
    done[u] = 1;
    for (int v = 0; v < n; v++) {
        int weight = edge[u * 32 + v];
        if (weight >= 0 && done[v] == 0) {
            int candidate = distance[u] + weight;
            if (candidate < distance[v]) {
                distance[v] = candidate;
            }
        }
    }
}
for (int v = 0; v < n; v++) {
    OUT(distance[v] == 1000000 ? -1 : distance[v]);
}
`,
    py: `
n, m, s = read_int(), read_int(), read_int()
edge = [[-1] * n for _ in range(n)]
for _ in range(m):
    u, v, w = read_int(), read_int(), read_int()
    edge[u][v] = w
distance = [1000000] * n
done = [0] * n
distance[s] = 0
for _ in range(n):
    u = -1
    for v in range(n):
        if done[v] == 0 and (u == -1 or distance[v] < distance[u]):
            u = v
    if u == -1 or distance[u] == 1000000:
        break
    done[u] = 1
    for v in range(n):
        weight = edge[u][v]
        if weight >= 0 and done[v] == 0:
            candidate = distance[u] + weight
            if candidate < distance[v]:
                distance[v] = candidate
print(*[-1 if x == 1000000 else x for x in distance])
`,
    cbug: ["distance[v] < distance[u]", "v < u"],
    pybug: ["distance[v] < distance[u]", "v < u"],
    cases: [["3 3 0\n0 1 9\n0 2 1\n2 1 1", "0 2 1"], ["3 1 0\n0 1 2", "0 2 -1"], ["4 4 0\n0 1 20\n0 3 1\n3 2 1\n2 1 1", "0 3 2 1"], ["1 0 0\n", "0"], ["3 3 2\n2 0 0\n0 1 0\n2 1 9", "0 0 0"], ["4 4 0\n0 1 5\n0 2 5\n1 3 0\n2 3 0", "0 5 5 5"], ["32 31 0\n0 1 1000\n1 2 1000\n2 3 1000\n3 4 1000\n4 5 1000\n5 6 1000\n6 7 1000\n7 8 1000\n8 9 1000\n9 10 1000\n10 11 1000\n11 12 1000\n12 13 1000\n13 14 1000\n14 15 1000\n15 16 1000\n16 17 1000\n17 18 1000\n18 19 1000\n19 20 1000\n20 21 1000\n21 22 1000\n22 23 1000\n23 24 1000\n24 25 1000\n25 26 1000\n26 27 1000\n27 28 1000\n28 29 1000\n29 30 1000\n30 31 1000", "0 1000 2000 3000 4000 5000 6000 7000 8000 9000 10000 11000 12000 13000 14000 15000 16000 17000 18000 19000 20000 21000 22000 23000 24000 25000 26000 27000 28000 29000 30000 31000"], ["4 4 1\n1 0 7\n1 3 1\n3 0 1\n0 2 2", "2 0 4 1"]],
    witness: 3,
    probe: ["2 1 1\n1 0 0", "0 0"]
  },
  {
    title: "Zero Cost Fast Lane",
    difficulty: 60,
    guide: "`queue` acts as a deque, a waiting list allowing additions at either end. `head` and `tail` mark its ends. `distance` stores costs, and `done` marks relays treated as final.",
    incident: "AEGIS has mixed free links with paid links. Patch checks the fewest paid crossings.",
    symptom: "A relay can be treated as final before a cheaper route using free links reaches it.",
    task: "For every relay, find the smallest number of paid link crossings on a directed route from `s` (the start). Each link costs `0` for a free crossing or `1` for a paid crossing. Free crossings still follow the listed direction. The zero-link route at `s` costs `0`. Print `-1` for an unreachable relay. Print costs only, even if routes tie.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).\n2. Read `m` triples `u v w`, a link from `u` to `v` only, with cost `w`, either `0` or `1`.",
    output: "Print `n` minimum costs separated by spaces, for relays `0` through `n - 1` in order. Use `-1` for an unreachable relay.",
    example: "In the first sample, free route `0 -> 2 -> 1` avoids the paid direct link. Print `0 0 0`. The second sample is a chain of two paid links and prints `0 1 2`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; `w` is `0` or `1`. Relays are numbered `0` through `n - 1`. No link is repeated or joins a relay to itself. The supplied fixed `queue` has room for every cost improvement in both versions.",
    defect: "The deque insertion ends are reversed, breaking the distance order required before finalisation.",
    hints: ["Should a free crossing wait behind a more expensive arrival?","`done` assumes the next relay removed from the front has the smallest unfinished cost.","Add an improved relay to the front when `weight == 0`, and to the back when `weight == 1`. Here `weight` is the crossed link's cost."],
    c: `
int n, m, s;
READ(n);
READ(m);
READ(s);
ARRAY(edge,1024);
ARRAY(distance,32);
ARRAY(done,32);
ARRAY(queue,512);
for (int i = 0; i < m; i++) {
    int u, v, w;
    READ(u);
    READ(v);
    READ(w);
    edge[u * 32 + v] = w + 1;
}
for (int v = 0; v < n; v++) {
    distance[v] = 1000000;
}
int head = 256;
int tail = 256;
distance[s] = 0;
queue[tail++] = s;
while (head < tail) {
    int u = queue[head++];
    if (done[u] != 0) {
        continue;
    }
    done[u] = 1;
    for (int v = 0; v < n; v++) {
        if (edge[u * 32 + v] != 0 && done[v] == 0) {
            int weight = edge[u * 32 + v] - 1;
            int candidate = distance[u] + weight;
            if (candidate < distance[v]) {
                distance[v] = candidate;
                if (weight == 0) {
                    queue[--head] = v;
                } else {
                    queue[tail++] = v;
                }
            }
        }
    }
}
for (int v = 0; v < n; v++) {
    OUT(distance[v] == 1000000 ? -1 : distance[v]);
}
`,
    py: `
n, m, s = read_int(), read_int(), read_int()
edge = [[-1] * n for _ in range(n)]
for _ in range(m):
    u, v, w = read_int(), read_int(), read_int()
    edge[u][v] = w
distance = [1000000] * n
done = [0] * n
queue = [0] * 512
head = 256
tail = 256
distance[s] = 0
queue[tail] = s
tail += 1
while head < tail:
    u = queue[head]
    head += 1
    if done[u] != 0:
        continue
    done[u] = 1
    for v in range(n):
        weight = edge[u][v]
        if weight >= 0 and done[v] == 0:
            candidate = distance[u] + weight
            if candidate < distance[v]:
                distance[v] = candidate
                if weight == 0:
                    head -= 1
                    queue[head] = v
                else:
                    queue[tail] = v
                    tail += 1
print(*[-1 if x == 1000000 else x for x in distance])
`,
    cbug: ["if (weight == 0)", "if (weight == 1)"],
    pybug: ["if weight == 0:", "if weight == 1:"],
    cases: [["3 3 0\n0 1 1\n0 2 0\n2 1 0", "0 0 0"], ["3 2 0\n0 1 1\n1 2 1", "0 1 2"], ["4 4 0\n0 1 1\n0 3 0\n3 2 0\n2 1 0", "0 0 0 0"], ["1 0 0\n", "0"], ["4 3 0\n0 1 0\n1 2 0\n2 0 0", "0 0 0 -1"], ["4 4 3\n3 0 1\n3 2 0\n2 1 0\n1 0 0", "0 0 0 0"], ["32 31 0\n0 1 0\n1 2 1\n2 3 0\n3 4 1\n4 5 0\n5 6 1\n6 7 0\n7 8 1\n8 9 0\n9 10 1\n10 11 0\n11 12 1\n12 13 0\n13 14 1\n14 15 0\n15 16 1\n16 17 0\n17 18 1\n18 19 0\n19 20 1\n20 21 0\n21 22 1\n22 23 0\n23 24 1\n24 25 0\n25 26 1\n26 27 0\n27 28 1\n28 29 0\n29 30 1\n30 31 0", "0 0 1 1 2 2 3 3 4 4 5 5 6 6 7 7 8 8 9 9 10 10 11 11 12 12 13 13 14 14 15 15"], ["5 5 0\n0 1 1\n0 2 0\n2 3 0\n3 1 0\n1 4 1", "0 0 0 0 1"]],
    witness: 3,
    probe: ["2 1 1\n1 0 1", "1 0"]
  },
  {
    title: "Worst Link Shield",
    difficulty: 53,
    guide: "`distance` stores the best route risks found so far. `done` marks relays treated as final. `candidate` is the risk considered when extending a route.",
    incident: "AEGIS has changed link risks. Mira checks routes with the smallest possible largest risk.",
    symptom: "The reported cost can combine several link risks even though only the largest matters.",
    task: "For every relay, consider directed routes from `s` (the start). A route's cost is the largest cost of any link it uses. Find the smallest possible route cost under this rule; do not add link costs. The zero-link route at `s` costs `0`. Print `-1` for an unreachable relay. If routes tie, print only the cost.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).\n2. Read `m` triples `u v w`, a link from `u` to `v` only, with risk `w`.",
    output: "Print `n` minimum route risks separated by spaces, for relays `0` through `n - 1` in order. Use `-1` for an unreachable relay.",
    example: "In the first sample, risks `4` then `7` give route risk `7`, so print `0 4 7`. In the second sample, risks `7` then `4` still give route risk `7`, so print `0 7 7`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No directed link is repeated or joins a relay to itself.",
    defect: "When a new link is worse, its cost is added instead of replacing the previous maximum.",
    hints: ["Reversing the two link risks in the public samples does not change their largest value.","Extending a route keeps its previous largest risk or replaces it with a larger one.","When `weight > candidate`, assign `candidate = weight` rather than adding. Here `weight` is the new link's risk and `candidate` starts as the route's previous largest risk."],
    c: `
int n, m, s;
READ(n);
READ(m);
READ(s);
ARRAY(edge,1024);
ARRAY(distance,32);
ARRAY(done,32);
for (int i = 0; i < 1024; i++) {
    edge[i] = -1;
}
for (int i = 0; i < m; i++) {
    int u, v, w;
    READ(u);
    READ(v);
    READ(w);
    edge[u * 32 + v] = w;
}
for (int v = 0; v < n; v++) {
    distance[v] = 1000000;
}
distance[s] = 0;
for (int step = 0; step < n; step++) {
    int u = -1;
    for (int v = 0; v < n; v++) {
        if (done[v] == 0 && (u == -1 || distance[v] < distance[u])) {
            u = v;
        }
    }
    if (u == -1 || distance[u] == 1000000) {
        break;
    }
    done[u] = 1;
    for (int v = 0; v < n; v++) {
        int weight = edge[u * 32 + v];
        if (weight >= 0 && done[v] == 0) {
            int candidate = distance[u];
            if (weight > candidate) {
                candidate = weight;
            }
            if (candidate < distance[v]) {
                distance[v] = candidate;
            }
        }
    }
}
for (int v = 0; v < n; v++) {
    OUT(distance[v] == 1000000 ? -1 : distance[v]);
}
`,
    py: `
n, m, s = read_int(), read_int(), read_int()
edge = [[-1] * n for _ in range(n)]
for _ in range(m):
    u, v, w = read_int(), read_int(), read_int()
    edge[u][v] = w
distance = [1000000] * n
done = [0] * n
distance[s] = 0
for _ in range(n):
    u = -1
    for v in range(n):
        if done[v] == 0 and (u == -1 or distance[v] < distance[u]):
            u = v
    if u == -1 or distance[u] == 1000000:
        break
    done[u] = 1
    for v in range(n):
        weight = edge[u][v]
        if weight >= 0 and done[v] == 0:
            candidate = distance[u]
            if weight > candidate:
                candidate = weight
            if candidate < distance[v]:
                distance[v] = candidate
print(*[-1 if x == 1000000 else x for x in distance])
`,
    cbug: ["candidate = weight;", "candidate += weight;"],
    pybug: ["candidate = weight", "candidate += weight"],
    cases: [["3 2 0\n0 1 4\n1 2 7", "0 4 7"], ["3 2 0\n0 1 7\n1 2 4", "0 7 7"], ["4 4 0\n0 1 4\n1 2 6\n0 2 9\n2 3 2", "0 4 6 6"], ["1 0 0\n", "0"], ["4 2 0\n0 1 0\n1 2 0", "0 0 0 -1"], ["3 3 0\n0 1 3\n1 2 5\n0 2 6", "0 3 5"], ["32 31 0\n0 1 1\n1 2 2\n2 3 3\n3 4 4\n4 5 5\n5 6 6\n6 7 7\n7 8 8\n8 9 9\n9 10 10\n10 11 11\n11 12 12\n12 13 13\n13 14 14\n14 15 15\n15 16 16\n16 17 17\n17 18 18\n18 19 19\n19 20 20\n20 21 21\n21 22 22\n22 23 23\n23 24 24\n24 25 25\n25 26 26\n26 27 27\n27 28 28\n28 29 29\n29 30 30\n30 31 31", "0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31"], ["4 4 3\n3 0 9\n3 1 2\n1 2 4\n2 0 6", "6 2 4 0"]],
    witness: 3,
    probe: ["2 1 1\n1 0 1000", "1000 0"]
  },
  {
    title: "Reachable Credit Spiral",
    difficulty: 65,
    guide: "`distance` stores costs found from the start; `1000000` marks an unreachable relay. The main loops update costs by scanning links. A final scan sets `alarm` (the answer).",
    incident: "AEGIS has added negative link prices. Ishan checks whether a reachable loop can keep lowering costs.",
    symptom: "A negative cycle, or even a negative link, in an unreachable part of the network can trigger an alarm.",
    task: "A directed cycle follows one-way links back to its start, uses at least one link, and repeats no other relay. Its total cost is the sum of its link costs. Print whether `s` (the start) can reach any cycle with a strictly negative total. A negative link alone is not enough. Unreachable cycles and cycles with total cost `0` do not count.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).\n2. Read `m` triples `u v w`, a link from `u` to `v` only, with signed cost `w`.",
    output: "Print `1` if the start can reach a negative-total-cost cycle, otherwise `0`.",
    example: "In the first sample, cycle `1 -> 2 -> 1` costs `-2`, but start `0` cannot reach it. Print `0`. In the second sample, start `0` lies on a cycle costing `-1`, so print `1`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; `-100 <= w <= 100`. Relays are numbered `0` through `n - 1`. Links are distinct; links from a relay to itself are allowed. The supplied bounded scans keep arithmetic within signed 32-bit range.",
    defect: "The final improvement test performs arithmetic on the unreachable sentinel without checking reachability.",
    hints: ["Can the start reach the link that triggers the final alarm?","Compare the tests in the main cost-update loop and the final alarm loop.","Before testing an improvement from `u`, require `distance[u] != 1000000`. The marker for an unreachable relay is not a real route cost."],
    c: `
int n, m, s;
READ(n);
READ(m);
READ(s);
ARRAY(from,160);
ARRAY(to,160);
ARRAY(weight,160);
ARRAY(distance,32);
for (int i = 0; i < m; i++) {
    READ(from[i]);
    READ(to[i]);
    READ(weight[i]);
}
for (int v = 0; v < n; v++) {
    distance[v] = 1000000;
}
distance[s] = 0;
for (int pass = 0; pass < n - 1; pass++) {
    for (int i = 0; i < m; i++) {
        int u = from[i];
        int v = to[i];
        if (distance[u] != 1000000 && distance[u] + weight[i] < distance[v]) {
            distance[v] = distance[u] + weight[i];
        }
    }
}
int alarm = 0;
for (int i = 0; i < m; i++) {
    int u = from[i];
    int v = to[i];
    if (distance[u] != 1000000 && distance[u] + weight[i] < distance[v]) {
        alarm = 1;
    }
}
OUT(alarm);
`,
    py: `
n, m, s = read_int(), read_int(), read_int()
edges = [(read_int(), read_int(), read_int()) for _ in range(m)]
distance = [1000000] * n
distance[s] = 0
for _ in range(n - 1):
    for u, v, w in edges:
        if distance[u] != 1000000 and distance[u] + w < distance[v]:
            distance[v] = distance[u] + w
alarm = 0
for u, v, w in edges:
    if distance[u] != 1000000 and distance[u] + w < distance[v]:
        alarm = 1
print(alarm)
`,
    cbug: ["if (distance[u] != 1000000 && distance[u] + weight[i] < distance[v]) {\n        alarm", "if (distance[u] + weight[i] < distance[v]) {\n        alarm"],
    pybug: ["if distance[u] != 1000000 and distance[u] + w < distance[v]:\n        alarm", "if distance[u] + w < distance[v]:\n        alarm"],
    cases: [["3 2 0\n1 2 -3\n2 1 1", "0"], ["2 2 0\n0 1 -2\n1 0 1", "1"], ["3 1 0\n1 2 -1", "0"], ["1 0 0\n", "0"], ["1 1 0\n0 0 -1", "1"], ["3 3 0\n0 1 -3\n1 2 4\n2 1 -4", "0"], ["5 5 0\n0 1 1\n1 2 1\n2 3 -2\n3 4 0\n4 2 1", "1"], ["4 3 3\n3 2 -5\n2 1 3\n1 0 2", "0"]],
    witness: 3,
    probe: ["2 1 0\n1 1 -100", "0"]
  },
  {
    title: "Cheapest Repair Backbone",
    difficulty: 58,
    guide: "`done` marks selected relays, `key` holds pending connection prices, and `total` accumulates the answer. Each pass selects a relay and scans its cables.",
    incident: "AEGIS has changed cable prices. Mira checks the cheapest way to connect every relay.",
    symptom: "The total can include costs already charged when earlier relays joined the selected tree.",
    task: "A spanning tree is a set of two-way cables connecting every relay with no cycle, meaning no closed route without reusing a cable. Find the smallest sum of cable prices over all spanning trees. Count each selected cable's price once. Print `-1` if the network cannot connect all relays. A single relay needs no cables and costs `0`. If trees tie, print only their shared minimum price.",
    input: "1. Read `n` (the number of relays) and `m` (the number of cables).\n2. Read `m` triples `u v w`, the endpoints and price of each two-way cable.",
    output: "Print the minimum total cable price, or `-1` if no spanning tree exists.",
    example: "In the first sample, choose cables `0-1` costing `2` and `1-2` costing `3`, for total `5`. In the second sample, relay `2` cannot be connected, so print `-1`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No cable is repeated or joins a relay to itself.",
    defect: "A frontier key stores the previous key plus the cable price instead of just the cable price.",
    hints: ["The answer pays for selected cables once, rather than separate routes from the start.","When adding a relay, consider the price of the cable joining it to the selected tree.","On an improvement, set `key[v] = weight`, where `weight` is the cable price. Do not add `key[u]`, which includes a price already charged."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(edge,1024);
ARRAY(key,32);
ARRAY(done,32);
for (int i = 0; i < 1024; i++) {
    edge[i] = -1;
}
for (int i = 0; i < m; i++) {
    int u, v, w;
    READ(u);
    READ(v);
    READ(w);
    edge[u * 32 + v] = w;
    edge[v * 32 + u] = w;
}
for (int v = 0; v < n; v++) {
    key[v] = 1000000;
}
key[0] = 0;
int total = 0;
int connected = 1;
for (int step = 0; step < n; step++) {
    int u = -1;
    for (int v = 0; v < n; v++) {
        if (done[v] == 0 && (u == -1 || key[v] < key[u])) {
            u = v;
        }
    }
    if (key[u] == 1000000) {
        connected = 0;
        break;
    }
    done[u] = 1;
    total += key[u];
    for (int v = 0; v < n; v++) {
        int weight = edge[u * 32 + v];
        if (weight >= 0 && done[v] == 0 && weight < key[v]) {
            key[v] = weight;
        }
    }
}
OUT(connected != 0 ? total : -1);
`,
    py: `
n, m = read_int(), read_int()
edge = [[-1] * n for _ in range(n)]
for _ in range(m):
    u, v, w = read_int(), read_int(), read_int()
    edge[u][v] = w
    edge[v][u] = w
key = [1000000] * n
key[0] = 0
done = [0] * n
total = 0
connected = 1
for _ in range(n):
    u = -1
    for v in range(n):
        if done[v] == 0 and (u == -1 or key[v] < key[u]):
            u = v
    if key[u] == 1000000:
        connected = 0
        break
    done[u] = 1
    total += key[u]
    for v in range(n):
        weight = edge[u][v]
        if weight >= 0 and done[v] == 0 and weight < key[v]:
            key[v] = weight
print(total if connected else -1)
`,
    cbug: ["key[v] = weight;", "key[v] = key[u] + weight;"],
    pybug: ["key[v] = weight", "key[v] = key[u] + weight"],
    cases: [["3 3\n0 1 2\n1 2 3\n0 2 9", "5"], ["3 1\n0 1 1", "-1"], ["4 4\n0 1 5\n1 2 1\n2 3 1\n0 3 10", "7"], ["1 0\n", "0"], ["4 3\n0 1 0\n1 2 0\n2 3 0", "0"], ["4 4\n0 1 2\n0 2 2\n0 3 2\n1 2 2", "6"], ["32 31\n0 1 1000\n1 2 1000\n2 3 1000\n3 4 1000\n4 5 1000\n5 6 1000\n6 7 1000\n7 8 1000\n8 9 1000\n9 10 1000\n10 11 1000\n11 12 1000\n12 13 1000\n13 14 1000\n14 15 1000\n15 16 1000\n16 17 1000\n17 18 1000\n18 19 1000\n19 20 1000\n20 21 1000\n21 22 1000\n22 23 1000\n23 24 1000\n24 25 1000\n25 26 1000\n26 27 1000\n27 28 1000\n28 29 1000\n29 30 1000\n30 31 1000", "31000"], ["4 5\n3 0 7\n3 1 2\n1 2 1\n2 0 6\n0 1 4", "7"]],
    witness: 3,
    probe: ["2 1\n0 1 1000", "1000"]
  },
  {
    title: "Backup Cable Pairing",
    difficulty: 62,
    guide: "`bridge` marks cables whose single removal disconnects the network. Later loops fill `block` (groups linked without those marked cables) and `degree` (each group's number of marked cable connections).",
    incident: "AEGIS may cut one cable. Ishan checks how many backup cables will keep the network connected.",
    symptom: "Parallel cables can be treated as failing together, giving the wrong backup count.",
    task: "Add the fewest two-way cables so that removing any one physical cable still leaves every relay reachable from every other relay. The failed cable may be original or added. Each failure test removes only one cable and is independent. A new cable may join any two different relays, including a pair that already has a cable. Repeated endpoint pairs are parallel cables: separate physical cables between the same relays. Print only the number to add.",
    input: "1. Read `n` (the number of relays) and `m` (the number of physical cables).\n2. Read `m` pairs of endpoint numbers. Each record is a separate two-way cable, even when its pair repeats in either order.",
    output: "Print one integer: the minimum number of new cables needed. A single relay needs `0`.",
    example: "In the first sample, records `0 1` and `1 0` are separate parallel cables. Either can fail safely, so print `0`. The second sample is chain `0-1-2`; adding a cable between its ends is enough, so print `1`.",
    constraints: "`1 <= n <= 20`; `0 <= m <= 40`. Relays are numbered `0` through `n - 1`. The original network is connected. No cable joins a relay to itself. Original and added cables may be parallel. The supplied repeated searches fit these limits.",
    defect: "The skipped-cable test removes every record with matching endpoints instead of only the chosen record index.",
    hints: ["Matching endpoints do not make two records the same physical cable.","`blocked` is the index of the one cable being tested. Its endpoint numbers do not identify it uniquely.","Skip only record `e == blocked` during a test. Keep every parallel cable available. The later grouping and pairing steps can then use the correct single-cut results."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(from,40);
ARRAY(to,40);
ARRAY(seen,20);
ARRAY(queue,20);
for (int i = 0; i < m; i++) {
    READ(from[i]);
    READ(to[i]);
}
int base = 0;
ARRAY(bridge,40);
for (int blocked = -1; blocked < m; blocked++) {
    for (int v = 0; v < n; v++) {
        seen[v] = 0;
    }
    int count = 0;
    for (int s = 0; s < n; s++) {
        if (seen[s] != 0) {
            continue;
        }
        count++;
        int head = 0;
        int tail = 1;
        queue[0] = s;
        seen[s] = 1;
        while (head < tail) {
            int u = queue[head++];
            for (int e = 0; e < m; e++) {
                if (blocked >= 0 && e == blocked) {
                    continue;
                }
                int v = -1;
                if (from[e] == u) {
                    v = to[e];
                } else if (to[e] == u) {
                    v = from[e];
                }
                if (v >= 0 && seen[v] == 0) {
                    seen[v] = 1;
                    queue[tail++] = v;
                }
            }
        }
    }
    if (blocked == -1) {
        base = count;
    } else if (count > base) {
        bridge[blocked] = 1;
    }
}
ARRAY(block,20);
ARRAY(degree,20);
for (int v = 0; v < n; v++) {
    block[v] = -1;
}
int groups = 0;
for (int s = 0; s < n; s++) {
    if (block[s] != -1) {
        continue;
    }
    int head = 0;
    int tail = 1;
    queue[0] = s;
    block[s] = groups;
    while (head < tail) {
        int u = queue[head++];
        for (int e = 0; e < m; e++) {
            if (bridge[e] != 0) {
                continue;
            }
            int v = -1;
            if (from[e] == u) {
                v = to[e];
            } else if (to[e] == u) {
                v = from[e];
            }
            if (v >= 0 && block[v] == -1) {
                block[v] = groups;
                queue[tail++] = v;
            }
        }
    }
    groups++;
}
for (int e = 0; e < m; e++) {
    if (bridge[e] != 0) {
        degree[block[from[e]]]++;
        degree[block[to[e]]]++;
    }
}
int leaves = 0;
for (int i = 0; i < groups; i++) {
    if (degree[i] == 1) {
        leaves++;
    }
}
OUT((leaves + 1) / 2);
`,
    py: `
n, m = read_int(), read_int()
edges = [(read_int(), read_int()) for _ in range(m)]
base = 0
bridge = [0] * m
for blocked in range(-1, m):
    seen = [0] * n
    count = 0
    for s in range(n):
        if seen[s] != 0:
            continue
        count += 1
        queue = [s]
        seen[s] = 1
        head = 0
        while head < len(queue):
            u = queue[head]
            head += 1
            for e, (a, b) in enumerate(edges):
                if blocked >= 0 and e == blocked:
                    continue
                v = b if a == u else a if b == u else -1
                if v >= 0 and seen[v] == 0:
                    seen[v] = 1
                    queue.append(v)
    if blocked == -1:
        base = count
    elif count > base:
        bridge[blocked] = 1
block = [-1] * n
groups = 0
for s in range(n):
    if block[s] != -1:
        continue
    block[s] = groups
    queue = [s]
    head = 0
    while head < len(queue):
        u = queue[head]
        head += 1
        for e, (a, b) in enumerate(edges):
            if bridge[e] != 0:
                continue
            v = b if a == u else a if b == u else -1
            if v >= 0 and block[v] == -1:
                block[v] = groups
                queue.append(v)
    groups += 1
degree = [0] * groups
for e, (u, v) in enumerate(edges):
    if bridge[e] != 0:
        degree[block[u]] += 1
        degree[block[v]] += 1
leaves = sum(x == 1 for x in degree)
print((leaves + 1) // 2)
`,
    cbug: ["e == blocked", "((from[e] == from[blocked] && to[e] == to[blocked]) || (from[e] == to[blocked] && to[e] == from[blocked]))"],
    pybug: ["e == blocked", "(edges[e] == edges[blocked] or edges[e] == edges[blocked][::-1])"],
    cases: [["2 2\n0 1\n1 0", "0"], ["3 2\n0 1\n1 2", "1"], ["4 5\n0 1\n0 1\n1 2\n2 3\n2 3", "1"], ["1 0\n", "0"], ["4 4\n0 1\n1 2\n2 0\n2 3", "1"], ["6 6\n0 1\n1 0\n1 2\n2 3\n3 4\n4 5", "1"], ["20 19\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19", "1"], ["5 4\n0 1\n0 2\n0 3\n0 4", "2"], ["4 3\n0 1\n0 2\n0 3", "2"]],
    witness: 3,
    probe: ["2 3\n0 1\n1 0\n0 1", "0"]
  },
  {
    title: "Disconnected Junction Audit",
    difficulty: 64,
    guide: "`banned` is the excluded relay, with `-1` meaning no removal. Searches count the remaining components. `base` stores the original count, and `answer` stores the number of critical relays.",
    incident: "AEGIS has already separated parts of the network. Mira checks which relay removals split it further.",
    symptom: "A relay can be called critical just because the original network already had several components.",
    task: "A connected component contains a relay and all relays reachable from it along two-way cables. An isolated relay is one component. Test each relay separately by removing it and all cables attached to it from the original network. Count removals that strictly increase the total number of components. The removed relay is absent, not an isolated component. These relays are called articulation relays.",
    input: "1. Read `n` (the number of relays) and `m` (the number of cables).\n2. Read `m` pairs `u v`, the endpoints of each two-way cable.",
    output: "Print one integer: the number of articulation relays.",
    example: "In the first sample, chain `0-1-2` and isolated relay `3` form two components. Only removing relay `1` increases the count, so print `1`. The triangle in the second sample has no critical relay, so print `0`.",
    constraints: "`1 <= n <= 20`; `0 <= m <= 40`. Relays are numbered `0` through `n - 1`. Cables are distinct, with no cable joining a relay to itself. The original network may be disconnected.",
    defect: "Removal results are compared with one component instead of the measured original component count.",
    hints: ["An already separate component should not make a removal count as harmful.","Use the original network's component count as the baseline for every removal.","Count a relay only when `count > base`, where `count` is the component count after removal and `base` is the original count. Comparing with `1` fails on disconnected inputs."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(edge,400);
ARRAY(seen,20);
ARRAY(queue,20);
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 20 + v] = 1;
    edge[v * 20 + u] = 1;
}
int base = 0;
int answer = 0;
for (int banned = -1; banned < n; banned++) {
    for (int v = 0; v < n; v++) {
        seen[v] = 0;
    }
    int count = 0;
    for (int s = 0; s < n; s++) {
        if (s == banned || seen[s] != 0) {
            continue;
        }
        count++;
        int head = 0;
        int tail = 1;
        queue[0] = s;
        seen[s] = 1;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++) {
                if (v != banned && edge[u * 20 + v] != 0 && seen[v] == 0) {
                    seen[v] = 1;
                    queue[tail++] = v;
                }
            }
        }
    }
    if (banned == -1) {
        base = count;
    } else if (count > base) {
        answer++;
    }
}
OUT(answer);
`,
    py: `
n, m = read_int(), read_int()
edge = [[] for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u].append(v)
    edge[v].append(u)
base = 0
answer = 0
for banned in range(-1, n):
    seen = [0] * n
    count = 0
    for s in range(n):
        if s == banned or seen[s] != 0:
            continue
        count += 1
        queue = [s]
        seen[s] = 1
        head = 0
        while head < len(queue):
            u = queue[head]
            head += 1
            for v in edge[u]:
                if v != banned and seen[v] == 0:
                    seen[v] = 1
                    queue.append(v)
    if banned == -1:
        base = count
    elif count > base:
        answer += 1
print(answer)
`,
    cbug: ["count > base", "count > 1"],
    pybug: ["count > base", "count > 1"],
    cases: [["4 2\n0 1\n1 2", "1"], ["3 3\n0 1\n1 2\n2 0", "0"], ["6 3\n0 1\n1 2\n2 0", "0"], ["1 0\n", "0"], ["2 0\n", "0"], ["5 3\n0 1\n1 2\n3 4", "1"], ["20 19\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19", "18"], ["7 5\n0 1\n0 2\n0 3\n4 5\n5 6", "2"]],
    witness: 3,
    probe: ["3 0\n", "0"]
  },
  {
    title: "Exact Hop Manifest",
    difficulty: 56,
    guide: "`ways` stores counts for the current route length. The next-length counts are stored in `nextWays` in C, C++ and Java; in `next_ways` in Python.",
    incident: "AEGIS requires an exact number of link crossings. Patch checks the route count.",
    symptom: "Routes shorter than the required length can be included and counted again.",
    task: "The directed graph is a network of relays and one-way links with no directed cycles, so no nonempty directed route returns to its start. Count routes from `s` (the start) to `t` (the target) using exactly `k` links. Different relay sequences are different routes. Shorter and longer routes do not count. Report the remainder after dividing the count by `1000000007`. If `k == 0`, count one route when `s == t`, otherwise none.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), `s` (the start), `t` (the target), and `k` (the required number of links).\n2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.",
    output: "Print the route count modulo `1000000007`, meaning the remainder after division by that number. Print `0` if no route uses exactly the required number of links.",
    example: "In the first sample, only `0 -> 1 -> 2` uses exactly two links; direct link `0 -> 2` does not count. Print `1`. The second sample asks for one link where two are needed, so print `0`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; `0 <= k <= 31`. Relays are numbered `0` through `n - 1`. Links are distinct, with no self-links or directed cycles. Each sum of two reduced counts fits a signed 32-bit integer.",
    defect: "The new route-length layer is added to the old layer instead of replacing it.",
    hints: ["After one more step, every counted route must have crossed one more link.","Keeping an old count lets that route survive a step without moving.","Replace `ways[v]` with the next-length count: `nextWays[v]` in C, C++ and Java; `next_ways[v]` in Python. Adding the old count keeps routes with too few links."],
    c: `
int n, m, s, t, k;
READ(n);
READ(m);
READ(s);
READ(t);
READ(k);
ARRAY(edge,1024);
ARRAY(ways,32);
ARRAY(nextWays,32);
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
}
ways[s] = 1;
for (int step = 0; step < k; step++) {
    for (int v = 0; v < n; v++) {
        nextWays[v] = 0;
    }
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            if (edge[u * 32 + v] != 0) {
                nextWays[v] = (nextWays[v] + ways[u]) % 1000000007;
            }
        }
    }
    for (int v = 0; v < n; v++) {
        ways[v] = nextWays[v];
    }
}
OUT(ways[t]);
`,
    py: `
n, m, s, t, k = read_int(), read_int(), read_int(), read_int(), read_int()
edge = [(read_int(), read_int()) for _ in range(m)]
ways = [0] * n
ways[s] = 1
for _ in range(k):
    next_ways = [0] * n
    for u, v in edge:
        next_ways[v] = (next_ways[v] + ways[u]) % 1000000007
    for v in range(n):
        ways[v] = next_ways[v]
print(ways[t])
`,
    cbug: ["ways[v] = nextWays[v];", "ways[v] = (ways[v] + nextWays[v]) % 1000000007;"],
    pybug: ["ways[v] = next_ways[v]", "ways[v] = (ways[v] + next_ways[v]) % 1000000007"],
    cases: [["3 3 0 2 2\n0 1\n1 2\n0 2", "1"], ["3 2 0 2 1\n0 1\n1 2", "0"], ["3 3 0 2 3\n0 1\n1 2\n0 2", "0"], ["1 0 0 0 0\n", "1"], ["1 0 0 0 1\n", "0"], ["5 5 0 4 3\n0 1\n0 2\n1 3\n2 3\n3 4", "2"], ["32 31 0 31 31\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31", "1"], ["4 4 3 0 2\n3 1\n3 2\n1 0\n2 0", "2"]],
    witness: 3,
    probe: ["2 1 0 1 0\n0 1", "0"]
  },
  {
    title: "One Way Cluster Gates",
    difficulty: 65,
    guide: "`reach` records which relays can reach which others. `component` stores group numbers. `incoming` records whether a group has a link entering from another group.",
    incident: "AEGIS has restricted entry routes. Mira checks which groups need their own initial entry.",
    symptom: "A one-way route can merge relays into one group even when no return route exists.",
    task: "Group relays so that two relays share a group exactly when each can reach the other along one-way links. A relay reaches itself with zero links. Each resulting group is a strongly connected component. Count components with no incoming link from a different component. Links within a component, including self-links, do not count as incoming links for this test.",
    input: "1. Read `n` (the number of relays) and `m` (the number of links).\n2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.",
    output: "Print one integer: the number of components with no incoming link from another component.",
    example: "In the first sample, links `0 -> 1` and `2 -> 1` leave each relay in its own component. The groups containing `0` and `2` have no incoming links, so print `2`. In the second sample, `0` and `1` share a group that points to `2`, so print `1`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Directed links are distinct; links from a relay to itself are allowed. The supplied three nested reachability loops fit these limits.",
    defect: "The component membership test accepts reachability in either direction instead of requiring both directions.",
    hints: ["A route in one direction does not guarantee a route back.","`reach` stores the two directional checks separately.","Require both reachability entries when assigning `component` (group numbers). In Python, use `reach[u][v] != 0 and reach[v][u] != 0`. The other versions also need both directional tests."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(edge,1024);
ARRAY(reach,1024);
ARRAY(component,32);
ARRAY(size,32);
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
    reach[u * 32 + v] = 1;
}
for (int v = 0; v < n; v++) {
    reach[v * 32 + v] = 1;
    component[v] = -1;
}
for (int k = 0; k < n; k++) {
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            if (reach[u * 32 + k] != 0 && reach[k * 32 + v] != 0) {
                reach[u * 32 + v] = 1;
            }
        }
    }
}
int groups = 0;
for (int u = 0; u < n; u++) {
    if (component[u] == -1) {
        for (int v = 0; v < n; v++) {
            if (reach[u * 32 + v] != 0 && reach[v * 32 + u] != 0) {
                component[v] = groups;
                size[groups]++;
            }
        }
        groups++;
    }
}

ARRAY(incoming,32);
for (int u = 0; u < n; u++) {
    for (int v = 0; v < n; v++) {
        if (edge[u * 32 + v] != 0 && component[u] != component[v]) {
            incoming[component[v]] = 1;
        }
    }
}
int answer = 0;
for (int i = 0; i < groups; i++) {
    if (incoming[i] == 0) {
        answer++;
    }
}
OUT(answer);
`,
    py: `
n, m = read_int(), read_int()
edge = [[0] * n for _ in range(n)]
reach = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u][v] = 1
    reach[u][v] = 1
for v in range(n):
    reach[v][v] = 1
for k in range(n):
    for u in range(n):
        for v in range(n):
            if reach[u][k] != 0 and reach[k][v] != 0:
                reach[u][v] = 1
component = [-1] * n
size = [0] * n
groups = 0
for u in range(n):
    if component[u] == -1:
        for v in range(n):
            if reach[u][v] != 0 and reach[v][u] != 0:
                component[v] = groups
                size[groups] += 1
        groups += 1

incoming = [0] * groups
for u in range(n):
    for v in range(n):
        if edge[u][v] != 0 and component[u] != component[v]:
            incoming[component[v]] = 1
print(sum(x == 0 for x in incoming))
`,
    cbug: ["reach[u * 32 + v] != 0 && reach[v * 32 + u] != 0", "reach[u * 32 + v] != 0 || reach[v * 32 + u] != 0"],
    pybug: ["reach[u][v] != 0 and reach[v][u] != 0", "reach[u][v] != 0 or reach[v][u] != 0"],
    cases: [["3 2\n0 1\n2 1", "2"], ["3 3\n0 1\n1 0\n1 2", "1"], ["4 3\n0 1\n2 1\n3 2", "2"], ["1 0\n", "1"], ["4 0\n", "4"], ["5 5\n0 1\n1 0\n2 3\n3 2\n4 3", "2"], ["32 32\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31\n31 0", "1"], ["6 6\n0 1\n1 0\n1 2\n3 2\n4 5\n5 4", "3"]],
    witness: 3,
    probe: ["2 2\n0 0\n1 1", "2"]
  },
  {
    title: "Condensed Service Tour",
    difficulty: 78,
    guide: "A strongly connected component contains a relay and all relays that can both reach it and be reached from it. `component` stores these groups and `size` their relay counts. `dag` stores links between groups; `best` stores visit counts considered by the later loops.",
    incident: "AEGIS has disrupted service visits. Patch checks how many different relays one trip can inspect.",
    symptom: "A trip can undercount a group of relays it could visit before moving on.",
    task: "A walk is a sequence of relays following the listed one-way links. It may start and end anywhere and repeat relays or links. Find the largest number of different relays visited during one walk. Count each relay once, even if visited repeatedly. A walk with no links visits its starting relay.",
    input: "1. Read `n` (the number of relays) and `m` (the number of links).\n2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.",
    output: "Print one integer: the maximum number of different relays visited. Do not print a walk.",
    example: "In the first sample, `0 -> 1 -> 2` visits all three relays, so print `3`. The second sample is a directed three-relay cycle and also permits all three visits, so print `3`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Directed links are distinct; links from a relay to itself are allowed. The supplied reachability and group-processing loops fit these limits.",
    defect: "The DAG transition adds one for the next component instead of adding that component's relay count.",
    hints: ["A group may contain several relays that can all be visited on one walk.","Within a strongly connected component, the walk can visit every relay and then reach any chosen exit.","When extending a group route from `u` to `v`, use `best[u] + size[v]`. Here `best[u]` is the visit count so far and `size[v]` is the destination group's full relay count, which may exceed `1`."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(edge,1024);
ARRAY(reach,1024);
ARRAY(component,32);
ARRAY(size,32);
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 32 + v] = 1;
    reach[u * 32 + v] = 1;
}
for (int v = 0; v < n; v++) {
    reach[v * 32 + v] = 1;
    component[v] = -1;
}
for (int k = 0; k < n; k++) {
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            if (reach[u * 32 + k] != 0 && reach[k * 32 + v] != 0) {
                reach[u * 32 + v] = 1;
            }
        }
    }
}
int groups = 0;
for (int u = 0; u < n; u++) {
    if (component[u] == -1) {
        for (int v = 0; v < n; v++) {
            if (reach[u * 32 + v] != 0 && reach[v * 32 + u] != 0) {
                component[v] = groups;
                size[groups]++;
            }
        }
        groups++;
    }
}

ARRAY(dag,1024);
ARRAY(indegree,32);
ARRAY(best,32);
ARRAY(queue,32);
for (int u = 0; u < n; u++) {
    for (int v = 0; v < n; v++) {
        int a = component[u];
        int b = component[v];
        if (edge[u * 32 + v] != 0 && a != b && dag[a * 32 + b] == 0) {
            dag[a * 32 + b] = 1;
            indegree[b]++;
        }
    }
}
int head = 0;
int tail = 0;
for (int i = 0; i < groups; i++) {
    best[i] = size[i];
    if (indegree[i] == 0) {
        queue[tail++] = i;
    }
}
int answer = 0;
while (head < tail) {
    int u = queue[head++];
    if (best[u] > answer) {
        answer = best[u];
    }
    for (int v = 0; v < groups; v++) {
        if (dag[u * 32 + v] != 0) {
            int candidate = best[u] + size[v];
            if (candidate > best[v]) {
                best[v] = candidate;
            }
            indegree[v]--;
            if (indegree[v] == 0) {
                queue[tail++] = v;
            }
        }
    }
}
OUT(answer);
`,
    py: `
n, m = read_int(), read_int()
edge = [[0] * n for _ in range(n)]
reach = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u][v] = 1
    reach[u][v] = 1
for v in range(n):
    reach[v][v] = 1
for k in range(n):
    for u in range(n):
        for v in range(n):
            if reach[u][k] != 0 and reach[k][v] != 0:
                reach[u][v] = 1
component = [-1] * n
size = [0] * n
groups = 0
for u in range(n):
    if component[u] == -1:
        for v in range(n):
            if reach[u][v] != 0 and reach[v][u] != 0:
                component[v] = groups
                size[groups] += 1
        groups += 1

dag = [[0] * groups for _ in range(groups)]
indegree = [0] * groups
for u in range(n):
    for v in range(n):
        a, b = component[u], component[v]
        if edge[u][v] != 0 and a != b and dag[a][b] == 0:
            dag[a][b] = 1
            indegree[b] += 1
best = size[:groups]
queue = [i for i in range(groups) if indegree[i] == 0]
head = 0
answer = 0
while head < len(queue):
    u = queue[head]
    head += 1
    answer = max(answer, best[u])
    for v in range(groups):
        if dag[u][v] != 0:
            candidate = best[u] + size[v]
            if candidate > best[v]:
                best[v] = candidate
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)
print(answer)
`,
    cbug: ["best[u] + size[v]", "best[u] + 1"],
    pybug: ["best[u] + size[v]", "best[u] + 1"],
    cases: [["3 3\n0 1\n1 2\n2 1", "3"], ["3 3\n0 1\n1 2\n2 0", "3"], ["6 8\n0 1\n1 0\n1 2\n2 3\n3 2\n3 4\n4 5\n5 4", "6"], ["1 0\n", "1"], ["4 0\n", "1"], ["6 6\n0 1\n1 2\n2 1\n0 3\n3 4\n4 5", "4"], ["32 31\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31", "32"], ["6 6\n4 5\n5 4\n5 3\n3 2\n2 3\n0 1", "4"]],
    witness: 3,
    probe: ["4 4\n0 1\n1 2\n2 0\n2 3", "4"]
  },
  {
    title: "Ancestor Jump Table",
    difficulty: 74,
    guide: "`up` is a jump table: level `k` stores ancestors reached by taking `2` to the power `k` parent steps, staying at root `0` if needed. `depth` stores distances from the root. Queries use these tables to move through ancestors.",
    incident: "AEGIS has disrupted the service hierarchy. Ishan checks the nearest shared ancestor for each pair.",
    symptom: "Pairs at very different depths can return a relay below the actual shared ancestor.",
    task: "A tree connects all relays and has exactly one route between any two without repeating a relay. Root `0` is the hierarchy's starting point. A relay's ancestors are itself and the relays reached by repeatedly following its parent. Depth is the number of links from root `0`. For each pair `a b`, print the common ancestor with greatest depth, called the lowest common ancestor. If `a == b`, print that relay.",
    input: "1. Read `n` (the number of relays) and `q` (the number of queries).\n2. Read `n - 1` parent numbers for relays `1` through `n - 1` in order. These fill level `0` of `up`.\n3. Read `q` pairs `a b`, the relays to query.",
    output: "Print `q` ancestor relay numbers separated by spaces, in query order.",
    example: "In the first sample, parents `0 0 1` belong to relays `1 2 3`. Pair `3 1` has answer `1`, and pair `3 2` has answer `0`, so print `1 0`. The one-relay second sample prints `0`.",
    constraints: "`1 <= n <= 32`; `1 <= q <= 40`. Relays are numbered `0` through `n - 1`. For each relay `v > 0`, its parent number is at least `0` and less than `v`. Query numbers are valid. The supplied six table levels cover these trees.",
    defect: "A doubled jump copies one half-jump instead of composing two half-jumps.",
    hints: ["A level for four parent steps must move farther than a level for two steps.","Each jump consists of two jumps of half its length.","Build `up[k][v]` as `up[k - 1][up[k - 1][v]]` in Python. In C, C++ and Java, use the same two lookups in the flattened `up` array. Copying one previous-level entry takes only half the required jump."],
    c: `
int n, q;
READ(n);
READ(q);
ARRAY(up,192);
ARRAY(depth,32);
ARRAY(power,6);
power[0] = 1;
for (int k = 1; k < 6; k++) {
    power[k] = power[k - 1] * 2;
}
for (int v = 1; v < n; v++) {
    READ(up[v]);
    depth[v] = depth[up[v]] + 1;
}
for (int k = 1; k < 6; k++) {
    for (int v = 0; v < n; v++) {
        up[k * 32 + v] = up[(k - 1) * 32 + up[(k - 1) * 32 + v]];
    }
}
for (int query = 0; query < q; query++) {
    int a, b;
    READ(a);
    READ(b);
    if (depth[a] < depth[b]) {
        int saved = a;
        a = b;
        b = saved;
    }
    int difference = depth[a] - depth[b];
    for (int k = 0; k < 6; k++) {
        if ((difference / power[k]) % 2 == 1) {
            a = up[k * 32 + a];
        }
    }
    if (a != b) {
        for (int k = 5; k >= 0; k--) {
            if (up[k * 32 + a] != up[k * 32 + b]) {
                a = up[k * 32 + a];
                b = up[k * 32 + b];
            }
        }
        a = up[a];
    }
    OUT(a);
}
`,
    py: `
n, q = read_int(), read_int()
up = [[0] * n for _ in range(6)]
depth = [0] * n
for v in range(1, n):
    up[0][v] = read_int()
    depth[v] = depth[up[0][v]] + 1
for k in range(1, 6):
    for v in range(n):
        up[k][v] = up[k - 1][up[k - 1][v]]
answers = []
for _ in range(q):
    a, b = read_int(), read_int()
    if depth[a] < depth[b]:
        a, b = b, a
    difference = depth[a] - depth[b]
    for k in range(6):
        if (difference // (2 ** k)) % 2 == 1:
            a = up[k][a]
    if a != b:
        for k in range(5, -1, -1):
            if up[k][a] != up[k][b]:
                a = up[k][a]
                b = up[k][b]
        a = up[0][a]
    answers.append(a)
print(*answers)
`,
    cbug: ["up[(k - 1) * 32 + up[(k - 1) * 32 + v]]", "up[(k - 1) * 32 + v]"],
    pybug: ["up[k - 1][up[k - 1][v]]", "up[k - 1][v]"],
    cases: [["4 2\n0 0 1\n3 1\n3 2", "1 0"], ["1 1\n\n0 0", "0"], ["16 3\n0 1 2 3 4 5 6 7 8 9 10 11 12 13 14\n15 2\n14 1\n15 15", "2 1 15"], ["2 3\n0\n1 0\n0 1\n1 1", "0 0 1"], ["7 3\n0 0 1 1 2 2\n3 4\n3 6\n5 6", "1 0 2"], ["32 3\n0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30\n31 0\n30 3\n20 4", "0 3 4"], ["32 2\n0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n31 30\n31 0", "0 0"], ["12 3\n0 1 1 2 2 3 3 4 4 5 5\n8 9\n10 11\n8 11", "4 5 2"]],
    witness: 3,
    probe: ["9 2\n0 1 2 3 4 5 6 7\n8 0\n7 3", "0 3"]
  },
  {
    title: "Moving Root Repair Zones",
    difficulty: 83,
    guide: "`parent` and `subtree` store parents and subtree sums under original root `0`. `total` is the whole-tree load. `r` is the temporary root, and `x` is the relay whose subtree is requested.",
    incident: "AEGIS has changed the command relay. Mira checks load totals under each temporary root.",
    symptom: "When the new root lies below the queried relay in the original tree, the answer can omit relays that should count.",
    task: "The two-way cables form a tree: they connect all relays and give exactly one route between any two without repeating a relay. A root sets parent-child directions away from itself. A relay's subtree contains itself and every relay below it in those directions. For query `r x`, temporarily root the tree at `r` and sum signed loads in `x`'s subtree. Negative loads subtract from the sum. If `r == x`, include the whole tree. Queries are independent; loads and cables do not change.",
    input: "1. Read `n` (the number of relays) and `q` (the number of queries).\n2. Read `n` signed loads in relay-number order; the code first stores them in `subtree`.\n3. Read `n - 1` parent numbers into `parent`, for relays `1` through `n - 1` under root `0`.\n4. Read `q` pairs `r x`, temporary root first and queried relay second.",
    output: "Print `q` subtree load sums separated by spaces, in query order.",
    example: "The first sample is chain `0-1-2` with loads `2 3 5`. For query `2 1`, root `2` makes relays `1` and `0` the requested subtree. Print `5`. The second sample's independent queries print `2 7`.",
    constraints: "`1 <= n <= 32`; `1 <= q <= 40`; loads are from `-1000` through `1000`. Relays are numbered `0` through `n - 1`. For each relay `v > 0`, `0 <= parent[v] < v`. Query relay numbers are valid.",
    defect: "The complement case removes x's whole original subtree instead of just the child branch leading to the temporary root.",
    hints: ["Draw the tree with the new root below `x` (the queried relay). Which side of `x` still belongs to its subtree?","The branch from `x` towards `r` (the new root) lies outside the requested subtree.","Find `child`, the direct child of `x` on the original path to `r`. Use `total - subtree[child]`, removing only that branch rather than all of `subtree[x]`."],
    c: `
int n, q;
READ(n);
READ(q);
ARRAY(subtree,32);
ARRAY(parent,32);
for (int v = 0; v < n; v++) {
    READ(subtree[v]);
}
for (int v = 1; v < n; v++) {
    READ(parent[v]);
}
for (int v = n - 1; v > 0; v--) {
    subtree[parent[v]] += subtree[v];
}
int total = subtree[0];
for (int query = 0; query < q; query++) {
    int r, x;
    READ(r);
    READ(x);
    int answer;
    if (r == x) {
        answer = total;
    } else {
        int u = r;
        while (u != 0 && u != x) {
            u = parent[u];
        }
        if (u != x) {
            answer = subtree[x];
        } else {
            int child = r;
            while (parent[child] != x) {
                child = parent[child];
            }
            answer = total - subtree[child];
        }
    }
    OUT(answer);
}
`,
    py: `
n, q = read_int(), read_int()
subtree = [read_int() for _ in range(n)]
parent = [0] + [read_int() for _ in range(n - 1)]
for v in range(n - 1, 0, -1):
    subtree[parent[v]] += subtree[v]
total = subtree[0]
answers = []
for _ in range(q):
    r, x = read_int(), read_int()
    if r == x:
        answer = total
    else:
        u = r
        while u != 0 and u != x:
            u = parent[u]
        if u != x:
            answer = subtree[x]
        else:
            child = r
            while parent[child] != x:
                child = parent[child]
            answer = total - subtree[child]
    answers.append(answer)
print(*answers)
`,
    cbug: ["total - subtree[child]", "total - subtree[x]"],
    pybug: ["total - subtree[child]", "total - subtree[x]"],
    cases: [["3 1\n2 3 5\n0 1\n2 1", "5"], ["3 2\n4 2 7\n0 0\n0 1\n1 2", "2 7"], ["5 3\n10 20 30 40 50\n0 1 1 2\n4 1\n3 0\n2 2", "70 10 150"], ["1 1\n9\n\n0 0", "9"], ["2 2\n-5 8\n0\n1 0\n0 1", "-5 8"], ["7 4\n1 -2 3 -4 5 -6 7\n0 0 1 1 2 2\n3 1\n6 2\n4 2\n0 0", "8 -3 4 4"], ["32 3\n1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000 1000\n0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30\n31 0\n31 15\n0 31", "1000 16000 1000"], ["4 3\n-1 -2 -3 -4\n0 0 0\n1 0\n2 0\n3 0", "-8 -7 -6"]],
    witness: 3,
    probe: ["2 1\n0 0\n0\n1 0", "0"]
  },
  {
    title: "Equal Price Backbone Fork",
    difficulty: 85,
    guide: "`parent` stores connected groups while cables are processed by price. `temporary` holds groups used to examine one equal-price batch. `selected` counts chosen cables, and `unique` records the uniqueness result.",
    incident: "AEGIS has offered cables at equal prices. Ishan checks whether the cheapest complete connection is unique.",
    symptom: "The checker can miss equal-price alternatives after cheaper cables have already joined relays.",
    task: "A spanning tree is a set of two-way cables connecting every relay with no cycle, meaning no closed route without reusing a cable. A minimum spanning tree has the smallest sum of cable prices. Decide whether exactly one set of physical cables has that minimum sum. Different cable sets count as different trees even when totals tie. Print `-1` if no spanning tree exists. For one relay, the empty cable set is the unique tree.",
    input: "1. Read `n` (the number of relays) and `m` (the number of cables).\n2. Read `m` triples `u v w`, the endpoints and price of each two-way cable. Records need not be sorted by price.",
    output: "Print `1` for a unique minimum spanning tree, `0` for more than one, or `-1` for a disconnected network.",
    example: "The first sample is a triangle with all cable prices equal to `2`. Any two cables form a cheapest tree, so print `0`. In the second sample, only the cables priced `1` and `2` give the minimum total, so print `1`.",
    constraints: "`1 <= n <= 16`; `0 <= m <= 40`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No cable joins a relay to itself. No endpoint pair is repeated, including in reverse order.",
    defect: "The temporary batch forest starts with isolated vertices instead of preserving cheaper-edge contractions.",
    hints: ["Equal-price choices depend on connections made with cheaper cables.","Two different cables may join the same two groups after cheaper cables have connected their endpoints to other relays.","Start `temporary` as a copy of `parent`, preserving all cheaper connections. Test the equal-price batch there before adding that batch to `parent`."],
    c: `
int n, m;
READ(n);
READ(m);
ARRAY(from,40);
ARRAY(to,40);
ARRAY(weight,40);
ARRAY(taken,40);
ARRAY(parent,16);
ARRAY(temporary,16);
for (int i = 0; i < m; i++) {
    READ(from[i]);
    READ(to[i]);
    READ(weight[i]);
}
for (int i = 0; i < n; i++) {
    parent[i] = i;
}
int processed = 0;
int selected = 0;
int unique = 1;
while (processed < m) {
    int best = -1;
    for (int i = 0; i < m; i++) {
        if (taken[i] == 0 && (best == -1 || weight[i] < weight[best])) {
            best = i;
        }
    }
    int price = weight[best];
    for (int i = 0; i < n; i++) {
        temporary[i] = parent[i];
    }
    for (int i = 0; i < m; i++) {
        if (taken[i] != 0 || weight[i] != price) {
            continue;
        }
        int left = from[i];
        int right = to[i];
        while (parent[left] != left) {
            left = parent[left];
        }
        while (parent[right] != right) {
            right = parent[right];
        }
        if (left == right) {
            continue;
        }
        int a = from[i];
        int b = to[i];
        while (temporary[a] != a) {
            a = temporary[a];
        }
        while (temporary[b] != b) {
            b = temporary[b];
        }
        if (a == b) {
            unique = 0;
        } else {
            temporary[a] = b;
        }
    }
    for (int i = 0; i < m; i++) {
        if (taken[i] == 0 && weight[i] == price) {
            taken[i] = 1;
            processed++;
            int a = from[i];
            int b = to[i];
            while (parent[a] != a) {
                a = parent[a];
            }
            while (parent[b] != b) {
                b = parent[b];
            }
            if (a != b) {
                parent[a] = b;
                selected++;
            }
        }
    }
}
OUT(selected == n - 1 ? unique : -1);
`,
    py: `
n, m = read_int(), read_int()
edges = [(read_int(), read_int(), read_int()) for _ in range(m)]
parent = list(range(n))
taken = [0] * m
processed = 0
selected = 0
unique = 1
while processed < m:
    price = min(edges[i][2] for i in range(m) if taken[i] == 0)
    temporary = [parent[i] for i in range(n)]
    for i, (u, v, w) in enumerate(edges):
        if taken[i] != 0 or w != price:
            continue
        left, right = u, v
        while parent[left] != left:
            left = parent[left]
        while parent[right] != right:
            right = parent[right]
        if left == right:
            continue
        a, b = u, v
        while temporary[a] != a:
            a = temporary[a]
        while temporary[b] != b:
            b = temporary[b]
        if a == b:
            unique = 0
        else:
            temporary[a] = b
    for i, (u, v, w) in enumerate(edges):
        if taken[i] == 0 and w == price:
            taken[i] = 1
            processed += 1
            a, b = u, v
            while parent[a] != a:
                a = parent[a]
            while parent[b] != b:
                b = parent[b]
            if a != b:
                parent[a] = b
                selected += 1
print(unique if selected == n - 1 else -1)
`,
    cbug: ["temporary[i] = parent[i];", "temporary[i] = i;"],
    pybug: ["temporary = [parent[i] for i in range(n)]", "temporary = list(range(n))"],
    cases: [["3 3\n0 1 2\n1 2 2\n0 2 2", "0"], ["3 3\n0 1 1\n1 2 2\n0 2 9", "1"], ["4 4\n0 1 1\n2 3 1\n0 2 2\n1 3 2", "0"], ["1 0\n", "1"], ["4 2\n0 1 1\n2 3 1", "-1"], ["4 4\n0 1 0\n1 2 0\n2 3 0\n0 3 5", "1"], ["6 6\n0 1 1\n1 2 1\n3 4 1\n4 5 1\n0 3 2\n2 5 2", "0"], ["16 16\n0 1 0\n1 2 1\n2 3 2\n3 4 3\n4 5 4\n5 6 5\n6 7 6\n7 8 7\n8 9 8\n9 10 9\n10 11 10\n11 12 11\n12 13 12\n13 14 13\n14 15 14\n0 15 1000", "1"]],
    witness: 3,
    probe: ["3 3\n0 1 0\n1 2 0\n2 0 0", "0"]
  },
  {
    title: "Undoable Bandwidth Repair",
    difficulty: 85,
    guide: "`residual` records capacity available for routing changes, which may send more traffic or cancel earlier traffic. `parent` records a route found by a search, and `flow` stores the total sent so far.",
    incident: "AEGIS has limited channel capacities. Ishan checks how much traffic the network can carry.",
    symptom: "An early routing choice can block later traffic even though rerouting would allow more units through.",
    task: "Find the maximum flow from `s` (the source) to `t` (the target). Flow assigns a nonnegative whole number of units to each one-way link, no greater than its capacity. Every other relay must send out exactly as many units as it receives. Maximise the net units leaving `s`, equal to the net units arriving at `t`. Traffic may use several routes. If no route exists, the answer is `0`.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), `s` (the source), and `t` (the target).\n2. Read `m` triples `u v capacity`, a link from `u` to `v` only, with its maximum allowed units.",
    output: "Print one integer: the maximum total flow from the source to the target.",
    example: "In the first sample, links `0 -> 1` and `1 -> 2` have capacities `4` and `2`. The smaller capacity limits total flow to `2`, so print `2`. The second sample has no route to the target and prints `0`.",
    constraints: "`2 <= n <= 12`; `0 <= m <= 30`; `1 <= capacity <= 8`. Relays are numbered `0` through `n - 1`, and `s != t`. No directed link is repeated or joins a relay to itself. Opposite-direction links are allowed and have separate capacities.",
    defect: "Augmentation consumes forward capacity but fails to create the matching reverse residual capacity.",
    hints: ["A later route may need to cancel part of an earlier routing choice.","Sending units forward must leave a way to undo those units in the routing-change table.","For each routed amount, subtract `amount` from the forward entry in `residual` and add `amount` to its reverse entry. The reverse capacity lets later searches cancel and reroute those units."],
    c: `
int n, m, s, t;
READ(n);
READ(m);
READ(s);
READ(t);
ARRAY(residual,256);
ARRAY(parent,16);
ARRAY(queue,16);
for (int i = 0; i < m; i++) {
    int u, v, capacity;
    READ(u);
    READ(v);
    READ(capacity);
    residual[u * 16 + v] += capacity;
}
int flow = 0;
while (1 != 0) {
    for (int v = 0; v < n; v++) {
        parent[v] = -1;
    }
    parent[s] = s;
    int head = 0;
    int tail = 1;
    queue[0] = s;
    while (head < tail && parent[t] == -1) {
        int u = queue[head++];
        for (int v = 0; v < n; v++) {
            if (residual[u * 16 + v] > 0 && parent[v] == -1) {
                parent[v] = u;
                queue[tail++] = v;
            }
        }
    }
    if (parent[t] == -1) {
        break;
    }
    int amount = 1000000;
    for (int v = t; v != s; v = parent[v]) {
        int u = parent[v];
        if (residual[u * 16 + v] < amount) {
            amount = residual[u * 16 + v];
        }
    }
    for (int v = t; v != s; v = parent[v]) {
        int u = parent[v];
        residual[u * 16 + v] -= amount;
        residual[v * 16 + u] += amount;
    }
    flow += amount;
}
OUT(flow);
`,
    py: `
n, m, s, t = read_int(), read_int(), read_int(), read_int()
residual = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v, capacity = read_int(), read_int(), read_int()
    residual[u][v] += capacity
flow = 0
while True:
    parent = [-1] * n
    parent[s] = s
    queue = [s]
    head = 0
    while head < len(queue) and parent[t] == -1:
        u = queue[head]
        head += 1
        for v in range(n):
            if residual[u][v] > 0 and parent[v] == -1:
                parent[v] = u
                queue.append(v)
    if parent[t] == -1:
        break
    amount = 1000000
    v = t
    while v != s:
        u = parent[v]
        amount = min(amount, residual[u][v])
        v = u
    v = t
    while v != s:
        u = parent[v]
        residual[u][v] -= amount
        residual[v][u] += amount
        v = u
    flow += amount
print(flow)
`,
    cbug: ["residual[v * 16 + u] += amount;", "residual[v * 16 + u] += 0;"],
    pybug: ["residual[v][u] += amount", "residual[v][u] += 0"],
    cases: [["3 2 0 2\n0 1 4\n1 2 2", "2"], ["3 1 0 2\n0 1 2", "0"], ["6 7 0 5\n0 1 1\n0 2 1\n1 3 1\n1 4 1\n2 3 1\n3 5 1\n4 5 1", "2"], ["2 1 0 1\n0 1 8", "8"], ["4 4 0 3\n0 1 3\n0 2 5\n1 3 2\n2 3 4", "6"], ["4 4 0 3\n0 1 2\n1 0 3\n1 2 2\n2 3 2", "2"], ["12 11 0 11\n0 1 8\n1 2 8\n2 3 8\n3 4 8\n4 5 8\n5 6 8\n6 7 8\n7 8 8\n8 9 8\n9 10 8\n10 11 8", "8"], ["6 7 5 0\n5 1 2\n5 2 2\n1 3 2\n1 4 2\n2 3 2\n3 0 2\n4 0 2", "4"]],
    witness: 3,
    probe: ["2 0 1 0\n", "0"]
  },
  {
    title: "Alternating Drone Assignments",
    difficulty: 90,
    guide: "The search starts at an unassigned drone and records possible reassignments. Assignment tables are `mateLeft` and `mateRight` in C, C++ and Java; `mate_left` and `mate_right` in Python. A later loop follows the recorded chain backwards.",
    incident: "AEGIS has restricted which jobs each drone can perform. Mira checks how many jobs can be assigned.",
    symptom: "A search can find a free job and move a drone there without assigning the drone that started the search.",
    task: "Find the largest number of allowed drone-job pairs that can be chosen together. Each drone may receive at most one job, and each job may receive at most one drone. Earlier choices may be reassigned. Only the maximum count matters; do not print pairs or choose a preferred arrangement among ties.",
    input: "1. Read `left` (the number of drones), `right` (the number of jobs), and `m` (the number of allowed pairs).\n2. Read `m` pairs `u v`, meaning drone `u` can perform job `v`. Drones and jobs have separate numbering systems.",
    output: "Print one integer: the maximum number of assignments. Print `0` if no pair can be chosen.",
    example: "In the first sample, drone `0` can do jobs `0` or `1`, while drone `1` can do only job `0`. Assign jobs `1` and `0` respectively and print `2`. The second sample also permits two assignments and prints `2`.",
    constraints: "`1 <= left <= 16`; `1 <= right <= 16`; `0 <= m <= 160`. Drones are numbered `0` through `left - 1`; jobs are numbered `0` through `right - 1`. Allowed pairs are distinct and valid. The supplied searches and reassignment loops use no recursion.",
    defect: "Path reconstruction forgets the displaced job, so it stops after changing only the final assignment.",
    hints: ["Finding a free job may require changing several earlier assignments.","When a drone moves to a new job, its old job is where the reassignment chain continues.","Save the old job in `previous` before changing the drone's assignment. Read it from `mateLeft[u]` in C, C++ and Java; from `mate_left[u]` in Python. Continue from that saved job."],
    c: `
int left, right, m;
READ(left);
READ(right);
READ(m);
ARRAY(edge,256);
ARRAY(mateLeft,16);
ARRAY(mateRight,16);
ARRAY(previousRight,16);
ARRAY(seenLeft,16);
ARRAY(queue,16);
for (int i = 0; i < left; i++) {
    mateLeft[i] = -1;
}
for (int i = 0; i < right; i++) {
    mateRight[i] = -1;
}
for (int i = 0; i < m; i++) {
    int u, v;
    READ(u);
    READ(v);
    edge[u * 16 + v] = 1;
}
for (int start = 0; start < left; start++) {
    if (mateLeft[start] != -1) {
        continue;
    }
    for (int v = 0; v < right; v++) {
        previousRight[v] = -1;
    }
    for (int u = 0; u < left; u++) {
        seenLeft[u] = 0;
    }
    int head = 0;
    int tail = 1;
    queue[0] = start;
    seenLeft[start] = 1;
    int end = -1;
    while (head < tail && end == -1) {
        int u = queue[head++];
        for (int v = 0; v < right; v++) {
            if (edge[u * 16 + v] != 0 && previousRight[v] == -1) {
                previousRight[v] = u;
                if (mateRight[v] == -1) {
                    end = v;
                    break;
                }
                int next = mateRight[v];
                if (seenLeft[next] == 0) {
                    seenLeft[next] = 1;
                    queue[tail++] = next;
                }
            }
        }
    }
    while (end != -1) {
        int u = previousRight[end];
        int previous = mateLeft[u];
        mateLeft[u] = end;
        mateRight[end] = u;
        end = previous;
    }
}
int answer = 0;
for (int u = 0; u < left; u++) {
    if (mateLeft[u] != -1) {
        answer++;
    }
}
OUT(answer);
`,
    py: `
left, right, m = read_int(), read_int(), read_int()
edge = [[0] * right for _ in range(left)]
for _ in range(m):
    u, v = read_int(), read_int()
    edge[u][v] = 1
mate_left = [-1] * left
mate_right = [-1] * right
for start in range(left):
    if mate_left[start] != -1:
        continue
    previous_right = [-1] * right
    seen_left = [0] * left
    seen_left[start] = 1
    queue = [start]
    head = 0
    end = -1
    while head < len(queue) and end == -1:
        u = queue[head]
        head += 1
        for v in range(right):
            if edge[u][v] != 0 and previous_right[v] == -1:
                previous_right[v] = u
                if mate_right[v] == -1:
                    end = v
                    break
                next_left = mate_right[v]
                if seen_left[next_left] == 0:
                    seen_left[next_left] = 1
                    queue.append(next_left)
    while end != -1:
        u = previous_right[end]
        previous = mate_left[u]
        mate_left[u] = end
        mate_right[end] = u
        end = previous
print(sum(job != -1 for job in mate_left))
`,
    cbug: ["int previous = mateLeft[u];", "int previous = -1;"],
    pybug: ["previous = mate_left[u]", "previous = -1"],
    cases: [["2 2 3\n0 0\n0 1\n1 0", "2"], ["3 2 2\n0 0\n1 1", "2"], ["3 3 5\n0 0\n0 1\n1 0\n2 1\n2 2", "3"], ["1 1 0\n", "0"], ["1 1 1\n0 0", "1"], ["4 3 4\n0 0\n1 0\n2 0\n3 0", "1"], ["16 16 16\n0 0\n1 1\n2 2\n3 3\n4 4\n5 5\n6 6\n7 7\n8 8\n9 9\n10 10\n11 11\n12 12\n13 13\n14 14\n15 15", "16"], ["4 4 7\n0 0\n0 1\n1 1\n1 2\n2 2\n2 3\n3 0", "4"]],
    witness: 3,
    probe: ["3 2 3\n0 0\n1 0\n2 1", "2"]
  },
  {
    title: "Negative Echo Containment",
    difficulty: 96,
    guide: "`distance` stores costs found by scanning links. `bad` marks relays whose costs have no finite lower limit. Later scans update these marks before the target is classified.",
    incident: "AEGIS has added negative link prices. Ishan checks whether the cheapest delivery price is finite.",
    symptom: "The target can receive a finite price even when a reachable negative cycle can lower its cost without limit.",
    task: "Find the minimum cost of a directed walk from `s` (the start) to `t` (the target). A walk follows link directions and may repeat relays or links; add all link costs, including repeats. A negative cycle uses at least one link, returns to its start without repeating another relay, and has a strictly negative total cost. Print `UNREACHABLE` if no walk exists. Print `UNBOUNDED` if `s` can reach a negative cycle that can then reach `t`: repeating it makes the cost arbitrarily low. Otherwise print the finite minimum. If `s == t`, the zero-link walk costs `0`, unless such a cycle makes the answer unbounded.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), `s` (the start), and `t` (the target).\n2. Read `m` triples `u v w`, a link from `u` to `v` only, with signed cost `w`.",
    output: "Print the finite minimum cost as an integer, or the exact word `UNREACHABLE` or `UNBOUNDED` for the cases described.",
    example: "In the first sample, start `0` can reach the negative self-link at `1`, but relay `1` cannot reach target `3`. The direct route to `3` still costs `5`, so print `5`. In the second sample, costs `-2` and `5` give finite total `3`, so print `3`.",
    constraints: "`1 <= n <= 32`; `0 <= m <= 160`; `-100 <= w <= 100`. Relays are numbered `0` through `n - 1`. Links are distinct; links from a relay to itself are allowed. `s` may equal `t`. Bounded intermediate values fit signed 32-bit integers.",
    defect: "Negative-cycle influence is propagated for only one edge-list sweep, which depends on input order.",
    hints: ["A negative cycle may affect a target several links away.","The `bad` marks must reach every downstream relay, regardless of input order.","Repeat propagation for enough full scans to cover a route of up to `n - 1` links. A single scan can miss downstream links that appear earlier in the input."],
    c: `
int n, m, s, t;
READ(n);
READ(m);
READ(s);
READ(t);
ARRAY(from,160);
ARRAY(to,160);
ARRAY(weight,160);
ARRAY(distance,32);
ARRAY(bad,32);
for (int i = 0; i < m; i++) {
    READ(from[i]);
    READ(to[i]);
    READ(weight[i]);
}
for (int v = 0; v < n; v++) {
    distance[v] = 1000000;
}
distance[s] = 0;
for (int pass = 0; pass < n - 1; pass++) {
    for (int i = 0; i < m; i++) {
        int u = from[i];
        int v = to[i];
        if (distance[u] != 1000000 && distance[u] + weight[i] < distance[v]) {
            distance[v] = distance[u] + weight[i];
        }
    }
}
for (int i = 0; i < m; i++) {
    int u = from[i];
    int v = to[i];
    if (distance[u] != 1000000 && distance[u] + weight[i] < distance[v]) {
        bad[v] = 1;
    }
}
for (int step = 0; step < n; step++) {
    for (int i = 0; i < m; i++) {
        if (bad[from[i]] != 0) {
            bad[to[i]] = 1;
        }
    }
}
if (bad[t] != 0) {
    SAY("UNBOUNDED");
} else if (distance[t] == 1000000) {
    SAY("UNREACHABLE");
} else {
    OUT(distance[t]);
}
`,
    py: `
n, m, s, t = read_int(), read_int(), read_int(), read_int()
edges = [(read_int(), read_int(), read_int()) for _ in range(m)]
distance = [1000000] * n
distance[s] = 0
for _ in range(n - 1):
    for u, v, w in edges:
        if distance[u] != 1000000 and distance[u] + w < distance[v]:
            distance[v] = distance[u] + w
bad = [0] * n
for u, v, w in edges:
    if distance[u] != 1000000 and distance[u] + w < distance[v]:
        bad[v] = 1
for step in range(n):
    for u, v, w in edges:
        if bad[u] != 0:
            bad[v] = 1
if bad[t] != 0:
    print('UNBOUNDED')
elif distance[t] == 1000000:
    print('UNREACHABLE')
else:
    print(distance[t])
`,
    cbug: ["for (int step = 0; step < n; step++)", "for (int step = 0; step < 1; step++)"],
    pybug: ["for step in range(n):", "for step in range(1):"],
    cases: [["4 3 0 3\n0 1 0\n1 1 -1\n0 3 5", "5"], ["3 2 0 2\n0 1 -2\n1 2 5", "3"], ["8 9 0 7\n6 7 0\n5 6 0\n4 5 0\n3 4 0\n2 3 0\n1 2 0\n1 1 -1\n0 1 0\n0 2 -100", "UNBOUNDED"], ["1 0 0 0\n", "0"], ["1 1 0 0\n0 0 -1", "UNBOUNDED"], ["4 2 0 3\n2 3 -2\n3 2 1", "UNREACHABLE"], ["5 5 0 4\n0 1 1\n1 2 -3\n2 1 1\n2 3 2\n3 4 1", "UNBOUNDED"], ["32 31 0 31\n0 1 -1\n1 2 -1\n2 3 -1\n3 4 -1\n4 5 -1\n5 6 -1\n6 7 -1\n7 8 -1\n8 9 -1\n9 10 -1\n10 11 -1\n11 12 -1\n12 13 -1\n13 14 -1\n14 15 -1\n15 16 -1\n16 17 -1\n17 18 -1\n18 19 -1\n19 20 -1\n20 21 -1\n21 22 -1\n22 23 -1\n23 24 -1\n24 25 -1\n25 26 -1\n26 27 -1\n27 28 -1\n28 29 -1\n29 30 -1\n30 31 -1", "-31"]],
    witness: 3,
    probe: ["2 2 0 0\n0 1 0\n1 0 0", "0"]
  },
  {
    title: "Priced Residual Treaty",
    difficulty: 100,
    guide: "Each input link has a paired reverse entry for cancelling earlier flow. Residual capacity means capacity available for routing changes. Each loop searches for a cheapest available route, then updates `sent` (units sent) and `total` (cost).",
    incident: "AEGIS has priced recovery channels. Mira checks the cheapest way to send an exact traffic quota.",
    symptom: "Changing an earlier route can charge again for a link whose earlier use is being cancelled.",
    task: "Send exactly `need` whole units of flow from `s` (the source) to `t` (the target). Flow assigns a nonnegative whole number of units to each one-way link, up to its capacity. Every other relay must send out exactly as much as it receives. The net units leaving `s` and entering `t` must equal `need`. Minimise the sum, over all links, of units carried times that link's per-unit price. Traffic may use several routes. Print `-1` if the full quota cannot be sent. If `need == 0`, the cost is `0`.",
    input: "1. Read `n` (the number of relays), `m` (the number of links), `s` (the source), `t` (the target), and `need` (the exact quota).\n2. Read `m` records `u v capacity w`, a link from `u` to `v` only, its capacity, and its per-unit price `w`.",
    output: "Print one integer: the minimum total cost of sending the full quota, or `-1` if impossible. A zero quota prints `0`.",
    example: "In the first sample, both links can carry two units, at per-unit prices `3` and `4`. Sending the quota costs `2 * (3 + 4) = 14`, so print `14`. In the second sample, capacities allow only one unit but the quota is two, so print `-1`.",
    constraints: "`2 <= n <= 10`; `0 <= m <= 24`; `0 <= need <= 8`; `1 <= capacity <= 8`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`, and `s != t`. No directed link is repeated or joins a relay to itself. Opposite-direction links are allowed. The paired representation uses at most `48` entries, and at most eight rounds of sending extra flow are needed.",
    defect: "A reverse residual edge has the original positive price instead of the negative price needed to refund cancelled flow.",
    hints: ["Cancelling a link's earlier use should refund its earlier cost.","A reverse entry represents undoing flow, so its price must account for the earlier payment.","Give the reverse entry price `-w`, where `w` is the original per-unit price. Store it in `price` in C, C++ and Java; in the fourth item of the paired record in `edges` in Python."],
    c: `
int n, m, s, t, need;
READ(n);
READ(m);
READ(s);
READ(t);
READ(need);
ARRAY(from,48);
ARRAY(to,48);
ARRAY(residual,48);
ARRAY(price,48);
ARRAY(distance,10);
ARRAY(previousEdge,10);
for (int i = 0; i < m; i++) {
    int u, v, capacity, w;
    READ(u);
    READ(v);
    READ(capacity);
    READ(w);
    from[2 * i] = u;
    to[2 * i] = v;
    residual[2 * i] = capacity;
    price[2 * i] = w;
    from[2 * i + 1] = v;
    to[2 * i + 1] = u;
    price[2 * i + 1] = -w;
}
int sent = 0;
int total = 0;
while (sent < need) {
    for (int v = 0; v < n; v++) {
        distance[v] = 1000000;
        previousEdge[v] = -1;
    }
    distance[s] = 0;
    for (int pass = 0; pass < n - 1; pass++) {
        for (int e = 0; e < 2 * m; e++) {
            int u = from[e];
            int v = to[e];
            if (residual[e] > 0 && distance[u] != 1000000 && distance[u] + price[e] < distance[v]) {
                distance[v] = distance[u] + price[e];
                previousEdge[v] = e;
            }
        }
    }
    if (previousEdge[t] == -1) {
        break;
    }
    int amount = need - sent;
    for (int v = t; v != s; v = from[previousEdge[v]]) {
        int e = previousEdge[v];
        if (residual[e] < amount) {
            amount = residual[e];
        }
    }
    for (int v = t; v != s; v = from[previousEdge[v]]) {
        int e = previousEdge[v];
        residual[e] -= amount;
        residual[e ^ 1] += amount;
        total += amount * price[e];
    }
    sent += amount;
}
OUT(sent == need ? total : -1);
`,
    py: `
n, m, s, t, need = read_int(), read_int(), read_int(), read_int(), read_int()
edges = []
for _ in range(m):
    u, v, capacity, w = read_int(), read_int(), read_int(), read_int()
    edges.append([u, v, capacity, w])
    edges.append([v, u, 0, -w])
sent = 0
total = 0
while sent < need:
    distance = [1000000] * n
    previous_edge = [-1] * n
    distance[s] = 0
    for _ in range(n - 1):
        for e, (u, v, capacity, price) in enumerate(edges):
            if capacity > 0 and distance[u] != 1000000 and distance[u] + price < distance[v]:
                distance[v] = distance[u] + price
                previous_edge[v] = e
    if previous_edge[t] == -1:
        break
    amount = need - sent
    v = t
    while v != s:
        e = previous_edge[v]
        amount = min(amount, edges[e][2])
        v = edges[e][0]
    v = t
    while v != s:
        e = previous_edge[v]
        edges[e][2] -= amount
        edges[e ^ 1][2] += amount
        total += amount * edges[e][3]
        v = edges[e][0]
    sent += amount
print(total if sent == need else -1)
`,
    cbug: ["price[2 * i + 1] = -w;", "price[2 * i + 1] = w;"],
    pybug: ["edges.append([v, u, 0, -w])", "edges.append([v, u, 0, w])"],
    cases: [["3 2 0 2 2\n0 1 3 3\n1 2 2 4", "14"], ["3 2 0 2 2\n0 1 1 2\n1 2 1 1", "-1"], ["6 8 0 5 2\n0 1 1 0\n0 2 1 0\n1 3 1 1\n1 4 1 2\n2 3 1 2\n2 4 1 100\n3 5 1 0\n4 5 1 0", "4"], ["2 0 0 1 0\n", "0"], ["2 0 0 1 1\n", "-1"], ["4 4 0 3 4\n0 1 2 0\n1 3 2 0\n0 2 3 5\n2 3 3 2", "14"], ["10 9 0 9 8\n0 1 8 1000\n1 2 8 1000\n2 3 8 1000\n3 4 8 1000\n4 5 8 1000\n5 6 8 1000\n6 7 8 1000\n7 8 8 1000\n8 9 8 1000", "72000"], ["3 3 2 0 2\n2 1 2 3\n1 2 1 9\n1 0 2 1", "8"]],
    witness: 3,
    probe: ["2 1 0 1 2\n0 1 1 0", "-1"]
  },
];
