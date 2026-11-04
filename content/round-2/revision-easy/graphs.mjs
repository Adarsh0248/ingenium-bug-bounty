// Easy revision graph missions. Cases 1-2 are samples; the probe is separate.
export const graphs = [
    {
        title: "Reciprocal Door Pairs",
        difficulty: 8,
        guide: "`edge` is the direct-link table. The nested loops choose two different vertices with `u < v`; `count` collects qualifying pairs.",
        incident: "AEGIS has split the door controls. Mira checks which pairs can send direct replies.",
        symptom: "A pair can be reported even when only one direction exists.",
        task: "Count unordered pairs of different vertices that have both direct links: `u -> v` and `v -> u`. Count each pair once. Longer routes do not count.",
        input: "Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.",
        output: "Print the number of pairs with direct links in both directions.",
        example: "In sample 1, only vertices `0` and `1` have both directions, so print `1`. Sample 2 has only one direction, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`.",
        defect: "The pair test accepts either direction instead of requiring both.",
        hints: [
            "Compare a two-way pair with a pair that has only one link.",
            "Read the two table entries checked for each unordered pair.",
            "Both entries must be present before the pair contributes. Keep the `u < v` loop bounds."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
}
int count = 0;
for (int u = 0; u < n; u++) {
    for (int v = u + 1; v < n; v++) {
        if (edge[u * n + v] == 1 && edge[v * n + u] == 1) {
            count++;
        }
    }
}
OUT(count);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
count = 0
for u in range(n):
    for v in range(u + 1, n):
        if edge[u * n + v] == 1 and edge[v * n + u] == 1:
            count += 1
print(count)`,
        cbug: [
            "edge[u * n + v] == 1 && edge[v * n + u] == 1",
            "edge[u * n + v] == 1 || edge[v * n + u] == 1"
        ],
        pybug: [
            "edge[u * n + v] == 1 and edge[v * n + u] == 1",
            "edge[u * n + v] == 1 or edge[v * n + u] == 1"
        ],
        cases: [
            [
                "3 3\n0 1\n1 0\n1 2",
                "1"
            ],
            [
                "2 1\n0 1",
                "0"
            ],
            [
                "3 1\n2 0",
                "0"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "2 2\n0 1\n1 0",
                "1"
            ],
            [
                "4 4\n0 1\n1 0\n2 3\n3 2",
                "2"
            ],
            [
                "4 3\n0 1\n1 2\n2 0",
                "0"
            ],
            [
                "12 3\n0 11\n11 0\n5 6",
                "1"
            ]
        ],
        witness: 3,
        probe: [
            "5 3\n1 4\n4 1\n3 1",
            "1"
        ]
    },
    {
        title: "One Way Dead Ends",
        difficulty: 12,
        guide: "For one vertex `u`, `incoming` totals its column and `outgoing` totals its row. `count` is updated after both totals are known.",
        incident: "AEGIS is trapping messages. Patch counts terminals that receive links but cannot send along any link.",
        symptom: "Unused isolated vertices can be counted as message traps.",
        task: "Count vertices with at least one incoming link and no outgoing links. A vertex with no links at all is not a dead end.",
        input: "Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.",
        output: "Print the number of receiving-only vertices.",
        example: "Sample 1 has links `0 -> 1` and `0 -> 2`; vertices `1` and `2` qualify, so print `2`. In sample 2, neither vertex has a link, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`.",
        defect: "The final test includes isolated vertices because it ignores incoming links.",
        hints: [
            "Try a graph with no links.",
            "A receiving-only vertex and an isolated vertex have the same outgoing total.",
            "Use the incoming total as well: it must be positive while the outgoing total is zero."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
}
int count = 0;
for (int u = 0; u < n; u++) {
    int incoming = 0;
    int outgoing = 0;
    for (int v = 0; v < n; v++) {
        incoming += edge[v * n + u];
        outgoing += edge[u * n + v];
    }
    if (incoming > 0 && outgoing == 0) {
        count++;
    }
}
OUT(count);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
count = 0
for u in range(n):
    incoming = 0
    outgoing = 0
    for v in range(n):
        incoming += edge[v * n + u]
        outgoing += edge[u * n + v]
    if incoming > 0 and outgoing == 0:
        count += 1
print(count)`,
        cbug: [
            "incoming > 0 && outgoing == 0",
            "outgoing == 0"
        ],
        pybug: [
            "incoming > 0 and outgoing == 0",
            "outgoing == 0"
        ],
        cases: [
            [
                "3 2\n0 1\n0 2",
                "2"
            ],
            [
                "2 0",
                "0"
            ],
            [
                "4 1\n0 1",
                "1"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "3 3\n0 1\n1 2\n2 0",
                "0"
            ],
            [
                "4 3\n3 0\n3 1\n3 2",
                "3"
            ],
            [
                "2 2\n0 1\n1 0",
                "0"
            ],
            [
                "12 1\n0 11",
                "1"
            ]
        ],
        witness: 3,
        probe: [
            "5 2\n4 2\n2 1",
            "1"
        ]
    },
    {
        title: "Zone Exit Wires",
        difficulty: 9,
        guide: "`zone` stores each vertex label. `edge` keeps link directions, and the two loops inspect every possible sender and receiver.",
        incident: "AEGIS rerouted evacuation signals. Ishan checks direct wires leaving zone `0` for zone `1`.",
        symptom: "Links travelling into the evacuation zone can be counted instead of links leaving it.",
        task: "Count direct one-way links whose sender has zone label `0` and receiver has zone label `1`. Ignore links in the reverse direction and links within one zone.",
        input: "Read `n` and `m`, then `n` labels in `zone`, then `m` directed pairs `u v`.",
        output: "Print the number of links from zone `0` to zone `1`.",
        example: "Sample 1 labels vertices `0 1 0` and has links `0 -> 1`, `1 -> 2`; only the first qualifies, so print `1`. Sample 2 has no links, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`. Each zone label is `0` or `1`.",
        defect: "The zone test exchanges the sender and receiver roles.",
        hints: [
            "Use a single link and give its endpoints different zone labels.",
            "The row vertex `u` sends the link; the column vertex `v` receives it.",
            "The sender label must be zero and the receiver label must be one. Keep the directed table unchanged."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
ARRAY(zone, 12);
for (int u = 0; u < n; u++) {
    READ(zone[u]);
}
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
}
int count = 0;
for (int u = 0; u < n; u++) {
    for (int v = 0; v < n; v++) {
        if (edge[u * n + v] == 1 && zone[u] == 0 && zone[v] == 1) {
            count++;
        }
    }
}
OUT(count);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
zone = [read_int() for _ in range(n)]
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
count = 0
for u in range(n):
    for v in range(n):
        if edge[u * n + v] == 1 and zone[u] == 0 and zone[v] == 1:
            count += 1
print(count)`,
        cbug: [
            "zone[u] == 0 && zone[v] == 1",
            "zone[u] == 1 && zone[v] == 0"
        ],
        pybug: [
            "zone[u] == 0 and zone[v] == 1",
            "zone[u] == 1 and zone[v] == 0"
        ],
        cases: [
            [
                "3 2\n0 1 0\n0 1\n1 2",
                "1"
            ],
            [
                "2 0\n0 1",
                "0"
            ],
            [
                "3 2\n0 1 0\n0 1\n2 1",
                "2"
            ],
            [
                "1 0\n0",
                "0"
            ],
            [
                "2 1\n0 1\n1 0",
                "0"
            ],
            [
                "3 2\n1 1 1\n0 1\n1 2",
                "0"
            ],
            [
                "4 4\n0 1 0 1\n0 1\n1 2\n2 3\n3 0",
                "2"
            ],
            [
                "12 2\n1 1 1 1 1 1 1 1 1 1 1 0\n11 0\n0 11",
                "1"
            ]
        ],
        witness: 3,
        probe: [
            "5 3\n1 1 0 0 0\n4 0\n4 1\n2 4",
            "2"
        ]
    },
    {
        title: "Shared Rescue Neighbours",
        difficulty: 11,
        guide: "`s` and `t` name two different vertices. For each candidate `v`, the program reads one entry from each of their rows in `edge`.",
        incident: "AEGIS cut the coordination board. Mira needs vertices directly cabled to both rescue posts.",
        symptom: "Vertices linked to only one rescue post can enter the shared list.",
        task: "Count vertices directly joined by a two-way cable to both `s` and `t`. Count each shared neighbour once. Being connected by a longer route does not qualify.",
        input: "Read `n`, `m`, `s`, and `t`, then `m` two-way pairs `u v`.",
        output: "Print the number of common direct neighbours.",
        example: "Sample 1 has `0-2` and `1-2`, with posts `0` and `1`; only vertex `2` qualifies, so print `1`. Sample 2 has only `0-1`; neither endpoint is a common neighbour, so print `0`.",
        constraints: "`2 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `s` and `t` are different valid vertices.",
        defect: "The shared-neighbour condition accepts a cable to either post.",
        hints: [
            "Try one candidate that touches only `s`.",
            "A candidate needs two separate direct cables.",
            "Require both row entries to be present for the same candidate `v`."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
int s;
READ(s);
int t;
READ(t);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
int count = 0;
for (int v = 0; v < n; v++) {
    if (edge[s * n + v] == 1 && edge[t * n + v] == 1) {
        count++;
    }
}
OUT(count);`,
        py: `n = read_int()
m = read_int()
s = read_int()
t = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
count = 0
for v in range(n):
    if edge[s * n + v] == 1 and edge[t * n + v] == 1:
        count += 1
print(count)`,
        cbug: [
            "edge[s * n + v] == 1 && edge[t * n + v] == 1",
            "edge[s * n + v] == 1 || edge[t * n + v] == 1"
        ],
        pybug: [
            "edge[s * n + v] == 1 and edge[t * n + v] == 1",
            "edge[s * n + v] == 1 or edge[t * n + v] == 1"
        ],
        cases: [
            [
                "3 2 0 1\n0 2\n1 2",
                "1"
            ],
            [
                "2 1 0 1\n0 1",
                "0"
            ],
            [
                "4 3 0 1\n0 2\n1 2\n0 3",
                "1"
            ],
            [
                "3 0 0 2",
                "0"
            ],
            [
                "4 4 0 1\n0 2\n1 2\n0 3\n1 3",
                "2"
            ],
            [
                "3 3 2 1\n0 1\n1 2\n0 2",
                "1"
            ],
            [
                "5 4 4 2\n4 0\n2 0\n4 1\n2 1",
                "2"
            ],
            [
                "12 2 0 1\n0 11\n1 11",
                "1"
            ]
        ],
        witness: 3,
        probe: [
            "6 4 5 4\n5 0\n4 0\n5 2\n4 3",
            "1"
        ]
    },
    {
        title: "Triangle Lock Census",
        difficulty: 19,
        guide: "The loops choose three vertices in increasing order, so each group is examined once. `edge` holds direct two-way cables and `count` records complete groups.",
        incident: "AEGIS damaged the three-door locks. Patch checks groups where every pair has a cable.",
        symptom: "An open chain of three vertices can be reported as a closed triangle.",
        task: "Count unordered groups of three different vertices where all three possible two-way cables exist. Other cables outside a group do not affect its qualification.",
        input: "Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.",
        output: "Print the number of complete three-vertex groups.",
        example: "Sample 1 has all three cables among vertices `0`, `1`, `2`, so print `1`. Sample 2 has only `0-1-2`, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.",
        defect: "The triangle check omits the cable joining the first and last vertices.",
        hints: [
            "Draw three vertices with only two cables.",
            "The three vertices require three separate pair checks.",
            "Besides the two consecutive cables, check the cable from `a` to `d` before counting the group."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
int count = 0;
for (int a = 0; a < n; a++) {
    for (int b = a + 1; b < n; b++) {
        for (int d = b + 1; d < n; d++) {
            if (edge[a * n + b] == 1 && edge[b * n + d] == 1 && edge[a * n + d] == 1) {
                count++;
            }
        }
    }
}
OUT(count);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
count = 0
for a in range(n):
    for b in range(a + 1, n):
        for d in range(b + 1, n):
            if edge[a * n + b] == 1 and edge[b * n + d] == 1 and edge[a * n + d] == 1:
                count += 1
print(count)`,
        cbug: [
            " && edge[a * n + d] == 1",
            ""
        ],
        pybug: [
            " and edge[a * n + d] == 1",
            ""
        ],
        cases: [
            [
                "3 3\n0 1\n1 2\n0 2",
                "1"
            ],
            [
                "3 2\n0 1\n1 2",
                "0"
            ],
            [
                "4 2\n0 1\n1 3",
                "0"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "4 6\n0 1\n0 2\n0 3\n1 2\n1 3\n2 3",
                "4"
            ],
            [
                "5 6\n0 1\n1 2\n2 0\n2 3\n3 4\n4 2",
                "2"
            ],
            [
                "5 4\n0 1\n0 2\n0 3\n0 4",
                "0"
            ],
            [
                "12 3\n9 10\n10 11\n9 11",
                "1"
            ]
        ],
        witness: 3,
        probe: [
            "6 5\n0 2\n2 4\n4 0\n1 3\n3 5",
            "1"
        ]
    },
    {
        title: "Missing Mesh Cables",
        difficulty: 7,
        guide: "The outer vertex is `u`. The inner vertex `v` chooses its partner. `missing` counts pairs with no direct cable in the table.",
        incident: "AEGIS hid gaps in a mesh. Ishan counts the extra cables needed to join every pair directly.",
        symptom: "The reported repair count can charge twice for the same missing cable.",
        task: "Count unordered pairs of different vertices with no direct cable. Adding one cable for each such pair would make every two different vertices directly connected. Do not add cables from a vertex to itself.",
        input: "Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.",
        output: "Print the number of missing two-way cables.",
        example: "Sample 1 has three vertices and only cable `0-1`, leaving `0-2` and `1-2`; print `2`. Sample 2 already has its only possible cable, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.",
        defect: "The pair loop includes both orders of every missing pair.",
        hints: [
            "An empty graph with two vertices needs only one cable.",
            "Check whether both `(u, v)` and `(v, u)` are visited.",
            "Choose partners after `u` in vertex order, so each unordered pair is inspected once."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
int missing = 0;
for (int u = 0; u < n; u++) {
    for (int v = u + 1; v < n; v++) {
        if (edge[u * n + v] == 0) {
            missing++;
        }
    }
}
OUT(missing);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
missing = 0
for u in range(n):
    for v in range(u + 1, n):
        if edge[u * n + v] == 0:
            missing += 1
print(missing)`,
        cbug: [
            "int v = u + 1;",
            "int v = 0;"
        ],
        pybug: [
            "range(u + 1, n)",
            "range(n)"
        ],
        cases: [
            [
                "3 1\n0 1",
                "2"
            ],
            [
                "2 1\n0 1",
                "0"
            ],
            [
                "4 2\n0 1\n1 2",
                "4"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "2 0",
                "1"
            ],
            [
                "4 6\n0 1\n0 2\n0 3\n1 2\n1 3\n2 3",
                "0"
            ],
            [
                "5 4\n0 1\n0 2\n0 3\n0 4",
                "6"
            ],
            [
                "12 0",
                "66"
            ]
        ],
        witness: 3,
        probe: [
            "6 3\n0 5\n1 4\n2 3",
            "12"
        ]
    },
    {
        title: "Incident Power Ledger",
        difficulty: 10,
        guide: "`edge` stores each cable power at both endpoint positions. For each vertex `u`, `total` adds values across its row before one output is written.",
        incident: "AEGIS erased port loads. Mira rebuilds the power total attached to each relay.",
        symptom: "A high-power cable can contribute only one unit to a relay total.",
        task: "For each vertex, add the power values of all two-way cables touching it. A cable contributes its full power to each endpoint. An isolated vertex has total zero.",
        input: "Read `n` and `m`, then `m` triples `u v weight` for two-way cables.",
        output: "Print `n` incident-power totals in vertex order.",
        example: "Sample 1 has powers `4` on `0-1` and `7` on `1-2`, so print `4 11 7`. Sample 2 has no cables, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. Each `weight` is from `1` to `100`.",
        defect: "The row total counts cables instead of adding their power values.",
        hints: [
            "Compare a cable with power one and a cable with power nine.",
            "The table stores a power value, not just a yes/no flag.",
            "Add each stored power value to the endpoint total without reducing it to a presence test."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    int weight;
    READ(weight);
    edge[u * n + v] = weight;
    edge[v * n + u] = weight;
}
for (int u = 0; u < n; u++) {
    int total = 0;
    for (int v = 0; v < n; v++) {
        total += edge[u * n + v];
    }
    OUT(total);
}`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    weight = read_int()
    edge[u * n + v] = weight
    edge[v * n + u] = weight
result = []
for u in range(n):
    total = 0
    for v in range(n):
        total += edge[u * n + v]
    result.append(total)
print(*result)`,
        cbug: [
            "total += edge[u * n + v];",
            "total += edge[u * n + v] > 0 ? 1 : 0;"
        ],
        pybug: [
            "total += edge[u * n + v]",
            "total += int(edge[u * n + v] > 0)"
        ],
        cases: [
            [
                "3 2\n0 1 4\n1 2 7",
                "4 11 7"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "2 1\n0 1 9",
                "9 9"
            ],
            [
                "4 0",
                "0 0 0 0"
            ],
            [
                "3 3\n0 1 1\n1 2 1\n0 2 1",
                "2 2 2"
            ],
            [
                "4 3\n0 1 100\n0 2 2\n0 3 3",
                "105 100 2 3"
            ],
            [
                "5 2\n4 3 8\n3 2 5",
                "0 0 5 13 8"
            ],
            [
                "12 1\n0 11 100",
                "100 0 0 0 0 0 0 0 0 0 0 100"
            ]
        ],
        witness: 3,
        probe: [
            "6 3\n1 4 13\n4 5 17\n1 5 2",
            "0 15 0 0 30 19"
        ]
    },
    {
        title: "Sibling Pair Roster",
        difficulty: 15,
        guide: "`children[p]` counts direct children of parent `p`. The final loop turns each child count into a number of unordered pairs and adds these to `pairs`.",
        incident: "AEGIS scrambled family badges on the device tree. Patch counts pairs that share a direct parent.",
        symptom: "Two children can be counted in both possible orders.",
        task: "Count unordered pairs of different vertices with the same direct parent. A parent and child do not form a sibling pair. The root has no parent.",
        input: "Read `n`, then `n - 1` pairs `p v`, each naming the parent `p` of child `v`.",
        output: "Print the total number of sibling pairs.",
        example: "Sample 1 gives root `0` children `1`, `2`, `3`, making three pairs; print `3`. Sample 2 is a chain, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. The pairs describe a rooted tree with root `0`: every other vertex has exactly one parent, and following children from `0` reaches all vertices. Pairs may arrive in any order.",
        defect: "The child-pair formula counts both orders without dividing by two.",
        hints: [
            "A parent with two children gives one pair.",
            "For each first child, there are one fewer choices for a different second child.",
            "Each unordered pair appears twice in that product; account for that before adding it to `pairs`."
        ],
        c: `int n;
READ(n);
ARRAY(children, 12);
for (int i = 0; i < n - 1; i++) {
    int p;
    int v;
    READ(p);
    READ(v);
    children[p]++;
}
int pairs = 0;
for (int p = 0; p < n; p++) {
    pairs += children[p] * (children[p] - 1) / 2;
}
OUT(pairs);`,
        py: `n = read_int()
children = [0] * n
for _ in range(n - 1):
    p = read_int()
    v = read_int()
    children[p] += 1
pairs = 0
for p in range(n):
    pairs += children[p] * (children[p] - 1) // 2
print(pairs)`,
        cbug: [
            "children[p] * (children[p] - 1) / 2",
            "children[p] * (children[p] - 1)"
        ],
        pybug: [
            "children[p] * (children[p] - 1) // 2",
            "children[p] * (children[p] - 1)"
        ],
        cases: [
            [
                "4\n0 1\n0 2\n0 3",
                "3"
            ],
            [
                "3\n0 1\n1 2",
                "0"
            ],
            [
                "3\n0 1\n0 2",
                "1"
            ],
            [
                "1",
                "0"
            ],
            [
                "2\n0 1",
                "0"
            ],
            [
                "6\n0 1\n0 2\n1 3\n1 4\n1 5",
                "4"
            ],
            [
                "5\n3 4\n0 1\n1 2\n1 3",
                "1"
            ],
            [
                "12\n0 1\n0 2\n0 3\n0 4\n0 5\n0 6\n0 7\n0 8\n0 9\n0 10\n0 11",
                "55"
            ]
        ],
        witness: 3,
        probe: [
            "7\n0 1\n0 2\n1 3\n2 4\n2 5\n2 6",
            "4"
        ]
    },
    {
        title: "Parent Label Cards",
        difficulty: 6,
        guide: "`parent` stores one direct-parent label per vertex and starts with `-1`. Each pair describes a parent and its child. The last loop reads the requested cards.",
        incident: "AEGIS swapped the directory cards. Ishan restores direct-parent labels without searching the tree.",
        symptom: "A requested child can show a child label or remain blank instead of naming its parent.",
        task: "For each queried vertex, print its direct parent from the given rooted tree. Print `-1` for root `0`. Answer queries in their input order.",
        input: "Read `n`, then `n - 1` pairs `p v`, each naming the parent `p` of child `v`. Then read `q`, followed by `q` queried vertex numbers.",
        output: "Print `q` parent labels, separated by spaces.",
        example: "Sample 1 has `0 -> 1 -> 2` and queries `2 0 1`, so print `1 -1 0`. Sample 2 queries the only root, so print `-1`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. The pairs describe a rooted tree with root `0`: every other vertex has exactly one parent, and following children from `0` reaches all vertices. Pairs may arrive in any order. `1 <= q <= 12`. Every query is a valid vertex.",
        defect: "The parent assignment stores the relationship in the wrong direction.",
        hints: [
            "Trace the card for a child whose parent is not root `0`.",
            "The index of `parent` names the vertex whose card is being filled.",
            "Use the child as the card index and the supplied parent as its stored label."
        ],
        c: `int n;
READ(n);
ARRAY(parent, 12);
for (int v = 0; v < n; v++) {
    parent[v] = -1;
}
for (int i = 0; i < n - 1; i++) {
    int p;
    int v;
    READ(p);
    READ(v);
    parent[v] = p;
}
int q;
READ(q);
for (int i = 0; i < q; i++) {
    int v;
    READ(v);
    OUT(parent[v]);
}`,
        py: `n = read_int()
parent = [-1] * n
for _ in range(n - 1):
    p = read_int()
    v = read_int()
    parent[v] = p
q = read_int()
result = []
for _ in range(q):
    v = read_int()
    result.append(parent[v])
print(*result)`,
        cbug: [
            "parent[v] = p;",
            "parent[p] = v;"
        ],
        pybug: [
            "parent[v] = p",
            "parent[p] = v"
        ],
        cases: [
            [
                "3\n0 1\n1 2\n3 2 0 1",
                "1 -1 0"
            ],
            [
                "1\n1 0",
                "-1"
            ],
            [
                "4\n0 2\n2 1\n2 3\n2 1 3",
                "2 2"
            ],
            [
                "2\n0 1\n2 0 1",
                "-1 0"
            ],
            [
                "4\n0 1\n0 2\n0 3\n3 3 2 1",
                "0 0 0"
            ],
            [
                "5\n3 4\n1 3\n0 1\n1 2\n4 4 3 2 0",
                "3 1 1 -1"
            ],
            [
                "3\n0 1\n0 2\n3 2 2 0",
                "0 0 -1"
            ],
            [
                "12\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n2 11 0",
                "10 -1"
            ]
        ],
        witness: 3,
        probe: [
            "6\n0 1\n1 2\n2 3\n2 4\n4 5\n4 5 4 3 1",
            "4 2 2 0"
        ]
    },
    {
        title: "Inbound Outbound Balance",
        difficulty: 12,
        guide: "`balance` is computed separately for each vertex `u`. The row entry describes a link leaving `u`; the column entry describes one entering `u`.",
        incident: "AEGIS damaged the traffic report. Mira compares outgoing and incoming direct links at each relay.",
        symptom: "A relay with only incoming links can receive a positive balance.",
        task: "For every vertex, print its number of outgoing links minus its number of incoming links. A pair with both directions contributes one outgoing and one incoming link at each endpoint.",
        input: "Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.",
        output: "Print `n` signed balances in vertex order.",
        example: "Sample 1 has links `0 -> 1`, `0 -> 2`; print `2 -1 -1`. Sample 2 is a two-way pair, so print `0 0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`.",
        defect: "Incoming links are added rather than subtracted.",
        hints: [
            "Check a vertex that only receives one link.",
            "Outgoing and incoming links have opposite effects on the balance.",
            "Keep the row contribution positive and the column contribution negative."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
}
for (int u = 0; u < n; u++) {
    int balance = 0;
    for (int v = 0; v < n; v++) {
        balance += edge[u * n + v] - edge[v * n + u];
    }
    OUT(balance);
}`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
result = []
for u in range(n):
    balance = 0
    for v in range(n):
        balance += edge[u * n + v] - edge[v * n + u]
    result.append(balance)
print(*result)`,
        cbug: [
            "edge[u * n + v] - edge[v * n + u]",
            "edge[u * n + v] + edge[v * n + u]"
        ],
        pybug: [
            "edge[u * n + v] - edge[v * n + u]",
            "edge[u * n + v] + edge[v * n + u]"
        ],
        cases: [
            [
                "3 2\n0 1\n0 2",
                "2 -1 -1"
            ],
            [
                "2 2\n0 1\n1 0",
                "0 0"
            ],
            [
                "3 1\n2 1",
                "0 -1 1"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "3 3\n0 1\n1 2\n2 0",
                "0 0 0"
            ],
            [
                "4 3\n0 3\n1 3\n2 3",
                "1 1 1 -3"
            ],
            [
                "5 0",
                "0 0 0 0 0"
            ],
            [
                "12 3\n11 0\n11 1\n0 11",
                "0 -1 0 0 0 0 0 0 0 0 0 1"
            ]
        ],
        witness: 3,
        probe: [
            "6 4\n1 4\n4 5\n5 1\n1 5",
            "0 1 0 0 0 -1"
        ]
    },
    {
        title: "Signed Walk Receipt",
        difficulty: 13,
        guide: "`walk` stores the supplied vertex sequence. `ok` remembers whether all checked steps were valid. The table uses the earlier vertex as sender and the next as receiver.",
        incident: "AEGIS forged a courier receipt. Patch checks every listed move against the directed link map.",
        symptom: "A receipt can be accepted even though an earlier move used a missing link.",
        task: "Check the supplied walk without changing it. Every consecutive pair must have a direct one-way link in the listed direction. A single-vertex walk is valid. Repeated vertices are allowed, but every step still needs a link.",
        input: "Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`. Then read `k`, followed by `k` vertex numbers in `walk`.",
        output: "Print `YES` for a valid walk, otherwise `NO`.",
        example: "Sample 1 walks `0 1 2` along the listed links and prints `YES`. Sample 2 walks `0 2 1`; its first step is absent, so print `NO`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`. `1 <= k <= 20`. Every walk entry is a valid vertex.",
        defect: "A later valid step overwrites an earlier failure.",
        hints: [
            "Use a walk with an invalid step followed by a valid step.",
            "Once the receipt fails, later steps cannot repair it.",
            "Only record failure when an edge is missing; do not reset the verdict for a valid step."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
}
int k;
READ(k);
ARRAY(walk, 20);
for (int i = 0; i < k; i++) {
    READ(walk[i]);
}
int ok = 1;
for (int i = 1; i < k; i++) {
    int u = walk[i - 1];
    int v = walk[i];
    ok = ok * edge[u * n + v];
}
if (ok == 1) {
    SAY("YES");
} else {
    SAY("NO");
}`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
k = read_int()
walk = [read_int() for _ in range(k)]
ok = 1
for i in range(1, k):
    u = walk[i - 1]
    v = walk[i]
    ok = ok and edge[u * n + v]
print("YES" if ok == 1 else "NO")`,
        cbug: [
        "ok = ok * edge[u * n + v];",
            "ok = edge[u * n + v];"
        ],
        pybug: [
            "ok = ok and edge[u * n + v]",
            "ok = edge[u * n + v]"
        ],
        cases: [
            [
                "3 2\n0 1\n1 2\n3 0 1 2",
                "YES"
            ],
            [
                "3 2\n0 1\n2 1\n3 0 2 1",
                "NO"
            ],
            [
                "4 2\n1 2\n2 3\n4 0 1 2 3",
                "NO"
            ],
            [
                "1 0\n1 0",
                "YES"
            ],
            [
                "2 1\n0 1\n2 1 0",
                "NO"
            ],
            [
                "3 2\n0 1\n1 0\n5 0 1 0 1 0",
                "YES"
            ],
            [
                "3 0\n3 0 1 2",
                "NO"
            ],
            [
                "12 11\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n12 0 1 2 3 4 5 6 7 8 9 10 11",
                "YES"
            ]
        ],
        witness: 3,
        probe: [
            "5 2\n3 4\n4 1\n4 0 3 4 1",
            "NO"
        ]
    },
    {
        title: "Hub And Rim Seal",
        difficulty: 18,
        guide: "`hub` is the nominated centre. Every unordered vertex pair has an `expected` table value. `ok` combines all pair comparisons.",
        incident: "AEGIS altered the emergency hub map. Ishan checks the complete shape around the nominated centre.",
        symptom: "A graph with every hub cable can pass even when an extra cable joins two outer vertices.",
        task: "Print `YES` exactly when every vertex other than `hub` has a direct cable to `hub`, and no two other vertices have a cable between them. A one-vertex graph qualifies. The nominated hub is part of the input; do not search for another.",
        input: "Read `n`, `m`, and `hub`, then `m` two-way pairs.",
        output: "Print `YES` if the graph has exactly the required hub-and-spokes shape; otherwise print `NO`.",
        example: "Sample 1 has hub `0` and cables `0-1`, `0-2`, `0-3`, so print `YES`. Sample 2 adds `1-2`, so print `NO`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `hub` is a valid vertex.",
        defect: "The pair check ignores unexpected cables between outer vertices.",
        hints: [
            "Add one rim cable to an otherwise valid star.",
            "Pairs that should have no cable matter as well as pairs that require one.",
            "Compare actual presence with `expected` for every pair, including pairs where `expected` is zero."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
int hub;
READ(hub);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
int ok = 1;
for (int u = 0; u < n; u++) {
    for (int v = u + 1; v < n; v++) {
        int expected = 0;
        if (u == hub || v == hub) {
            expected = 1;
        }
        if (edge[u * n + v] != expected) {
            ok = 0;
        }
    }
}
if (ok == 1) {
    SAY("YES");
} else {
    SAY("NO");
}`,
        py: `n = read_int()
m = read_int()
hub = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
ok = 1
for u in range(n):
    for v in range(u + 1, n):
        expected = 0
        if u == hub or v == hub:
            expected = 1
        if edge[u * n + v] != expected:
            ok = 0
print("YES" if ok == 1 else "NO")`,
        cbug: [
            "edge[u * n + v] != expected",
            "expected == 1 && edge[u * n + v] != expected"
        ],
        pybug: [
            "edge[u * n + v] != expected",
            "expected == 1 and edge[u * n + v] != expected"
        ],
        cases: [
            [
                "4 3 0\n0 1\n0 2\n0 3",
                "YES"
            ],
            [
                "4 4 0\n0 1\n0 2\n0 3\n1 2",
                "NO"
            ],
            [
                "3 3 1\n0 1\n0 2\n1 2",
                "NO"
            ],
            [
                "1 0 0",
                "YES"
            ],
            [
                "2 1 1\n0 1",
                "YES"
            ],
            [
                "3 1 0\n0 1",
                "NO"
            ],
            [
                "4 3 2\n2 0\n2 1\n2 3",
                "YES"
            ],
            [
                "12 11 11\n11 0\n11 1\n11 2\n11 3\n11 4\n11 5\n11 6\n11 7\n11 8\n11 9\n11 10",
                "YES"
            ]
        ],
        witness: 3,
        probe: [
            "5 5 4\n4 0\n4 1\n4 2\n4 3\n0 2",
            "NO"
        ]
    },
    {
        title: "Odd Socket Census",
        difficulty: 10,
        guide: "`degree` counts the cables touching the current vertex `u`. The final condition decides whether that vertex contributes to `odd`.",
        incident: "AEGIS damaged socket parity tags. Mira counts relays with an odd number of occupied cable sockets.",
        symptom: "A relay with three cables can be skipped even though its socket count is odd.",
        task: "Count vertices touching an odd number of two-way cables. Zero is even. Count vertices, not cables, and include all connected groups.",
        input: "Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.",
        output: "Print the number of vertices with odd degree.",
        example: "Sample 1 is a three-vertex chain: its two endpoints have one cable each, so print `2`. Sample 2 is a triangle: all degrees are two, so print `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.",
        defect: "The odd-degree test accepts only degree one.",
        hints: [
            "A relay with three cables also has odd degree.",
            "List which values of `degree` should qualify: one, three, five, and so on.",
            "Use the remainder after division by two rather than equality with one."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
int odd = 0;
for (int u = 0; u < n; u++) {
    int degree = 0;
    for (int v = 0; v < n; v++) {
        degree += edge[u * n + v];
    }
    if (degree % 2 == 1) {
        odd++;
    }
}
OUT(odd);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
odd = 0
for u in range(n):
    degree = 0
    for v in range(n):
        degree += edge[u * n + v]
    if degree % 2 == 1:
        odd += 1
print(odd)`,
        cbug: [
            "degree % 2 == 1",
            "degree == 1"
        ],
        pybug: [
            "degree % 2 == 1",
            "degree == 1"
        ],
        cases: [
            [
                "3 2\n0 1\n1 2",
                "2"
            ],
            [
                "3 3\n0 1\n1 2\n2 0",
                "0"
            ],
            [
                "4 3\n0 1\n0 2\n0 3",
                "4"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "2 1\n0 1",
                "2"
            ],
            [
                "6 5\n0 1\n0 2\n0 3\n0 4\n0 5",
                "6"
            ],
            [
                "5 10\n0 1\n0 2\n0 3\n0 4\n1 2\n1 3\n1 4\n2 3\n2 4\n3 4",
                "0"
            ],
            [
                "12 4\n0 1\n0 2\n0 3\n4 5",
                "6"
            ]
        ],
        witness: 3,
        probe: [
            "7 5\n6 0\n6 1\n6 2\n1 3\n1 4",
            "6"
        ]
    },
    {
        title: "Cable Colour Split",
        difficulty: 14,
        guide: "`colour` is supplied, not computed. The nested loops inspect unordered pairs, and `ok` keeps the result of all cable checks.",
        incident: "AEGIS mixed the repair team colours. Patch verifies that every cable crosses between the two supplied teams.",
        symptom: "A cable joining equal colours can be accepted while a valid cross-team cable is rejected.",
        task: "Check the supplied zero/one vertex colours. Every two-way cable must join different colours. Do not change colours or search for another colouring. Isolated vertices impose no rule; a graph with no cables passes.",
        input: "Read `n` and `m`, then `n` values in `colour`, then `m` two-way pairs.",
        output: "Print `YES` if every cable joins different colours, otherwise `NO`.",
        example: "Sample 1 colours the chain `0-1-2` as `0 1 0`, so print `YES`. Sample 2 gives both cable endpoints colour `1`, so print `NO`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. Each colour is `0` or `1`.",
        defect: "The violation condition rejects different colours instead of equal colours.",
        hints: [
            "Try one cable with equal endpoint colours.",
            "The branch that clears `ok` must describe a violation.",
            "A present cable is invalid when its endpoint colours are equal."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
ARRAY(colour, 12);
for (int u = 0; u < n; u++) {
    READ(colour[u]);
}
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
int ok = 1;
for (int u = 0; u < n; u++) {
    for (int v = u + 1; v < n; v++) {
        if (edge[u * n + v] == 1 && colour[u] == colour[v]) {
            ok = 0;
        }
    }
}
if (ok == 1) {
    SAY("YES");
} else {
    SAY("NO");
}`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
colour = [read_int() for _ in range(n)]
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
ok = 1
for u in range(n):
    for v in range(u + 1, n):
        if edge[u * n + v] == 1 and colour[u] == colour[v]:
            ok = 0
print("YES" if ok == 1 else "NO")`,
        cbug: [
            "colour[u] == colour[v]",
            "colour[u] != colour[v]"
        ],
        pybug: [
            "colour[u] == colour[v]",
            "colour[u] != colour[v]"
        ],
        cases: [
            [
                "3 2\n0 1 0\n0 1\n1 2",
                "YES"
            ],
            [
                "2 1\n1 1\n0 1",
                "NO"
            ],
            [
                "4 2\n0 0 1 1\n0 2\n1 3",
                "YES"
            ],
            [
                "1 0\n1",
                "YES"
            ],
            [
                "3 3\n0 1 0\n0 1\n1 2\n2 0",
                "NO"
            ],
            [
                "4 0\n0 0 0 0",
                "YES"
            ],
            [
                "4 4\n0 1 0 1\n0 1\n1 2\n2 3\n3 0",
                "YES"
            ],
            [
                "12 1\n0 0 0 0 0 0 0 0 0 0 0 1\n0 11",
                "YES"
            ]
        ],
        witness: 3,
        probe: [
            "5 3\n1 0 0 1 1\n0 4\n1 4\n2 4",
            "NO"
        ]
    },
    {
        title: "Tile Boundary Fence",
        difficulty: 18,
        guide: "`tile` is stored row by row. `r` and `c` select a tile. `fence` begins with four sides per occupied tile, then adjusts for shared sides checked to the right and below.",
        incident: "AEGIS erased the floor fences. Mira measures the exposed sides of all occupied tiles.",
        symptom: "Two adjacent occupied tiles can leave a fence total that is too large.",
        task: "A rectangular grid contains empty (`0`) and occupied (`1`) tiles. Count unit sides of occupied tiles that touch an empty tile or the outside of the grid. Only shared full sides matter; diagonal contact does not hide a side. Include every occupied region and any inner holes.",
        input: "Read `rows` and `cols`, then `rows * cols` zero/one tile values in row order.",
        output: "Print the total exposed-side length.",
        example: "Sample 1 has one occupied tile and prints `4`. Sample 2 has two side-by-side occupied tiles; their shared side is internal, so print `6`.",
        constraints: "`1 <= rows, cols <= 6`. Each tile is `0` or `1`.",
        defect: "A shared side removes only one of its two contributions.",
        hints: [
            "Each of two touching tiles initially contributes the shared side.",
            "Right and down checks visit each shared side once.",
            "A shared side must remove both of its initial contributions from `fence`."
        ],
        c: `int rows;
int cols;
READ(rows);
READ(cols);
ARRAY(tile, 36);
for (int i = 0; i < rows * cols; i++) {
    READ(tile[i]);
}
int fence = 0;
for (int r = 0; r < rows; r++) {
    for (int c = 0; c < cols; c++) {
        if (tile[r * cols + c] == 1) {
            fence += 4;
            if (c + 1 < cols && tile[r * cols + c + 1] == 1) {
                fence -= 2;
            }
            if (r + 1 < rows && tile[(r + 1) * cols + c] == 1) {
                fence -= 2;
            }
        }
    }
}
OUT(fence);`,
        py: `rows = read_int()
cols = read_int()
tile = [read_int() for _ in range(rows * cols)]
fence = 0
for r in range(rows):
    for c in range(cols):
        if tile[r * cols + c] == 1:
            fence += 4
            if c + 1 < cols and tile[r * cols + c + 1] == 1:
                fence -= 2
            if r + 1 < rows and tile[(r + 1) * cols + c] == 1:
                fence -= 2
print(fence)`,
        cbug: [
            "if (c + 1 < cols && tile[r * cols + c + 1] == 1) {\n                fence -= 2;",
            "if (c + 1 < cols && tile[r * cols + c + 1] == 1) {\n                fence -= 1;"
        ],
        pybug: [
            "if c + 1 < cols and tile[r * cols + c + 1] == 1:\n                fence -= 2",
            "if c + 1 < cols and tile[r * cols + c + 1] == 1:\n                fence -= 1"
        ],
        cases: [
            [
                "1 1\n1",
                "4"
            ],
            [
                "1 2\n1 1",
                "6"
            ],
            [
                "1 3\n1 1 1",
                "8"
            ],
            [
                "1 1\n0",
                "0"
            ],
            [
                "3 1\n1\n1\n1",
                "8"
            ],
            [
                "2 2\n1 0\n0 1",
                "8"
            ],
            [
                "3 3\n1 1 1\n1 0 1\n1 1 1",
                "16"
            ],
            [
                "6 6\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1",
                "24"
            ]
        ],
        witness: 3,
        probe: [
            "2 4\n1 1 0 1\n0 1 1 1",
            "14"
        ]
    },
    {
        title: "Fixed Step Conveyor",
        difficulty: 9,
        guide: "`next` in C, C++ and Java, or `nxt` in Python, stores one outgoing destination per vertex. `position` is updated once for every requested crossing.",
        incident: "AEGIS redirected a conveyor token. Patch traces the requested number of arrow crossings.",
        symptom: "The token can stop at the vertex just before its required destination.",
        task: "Start at `s` and follow exactly `k` arrows. Each vertex has exactly one outgoing arrow. Revisiting vertices and self-arrows are allowed. With zero crossings, stay at `s`.",
        input: "Read `n`, `k`, and `s`, then `n` destinations in vertex order.",
        output: "Print the vertex occupied after exactly `k` crossings.",
        example: "Sample 1 starts at `0` on arrows `0 -> 1 -> 2 -> 0` and makes two crossings, so print `2`. Sample 2 requests zero crossings from `1`, so print `1`.",
        constraints: "`1 <= n <= 12`; `0 <= k <= 30`; `s` and every destination are from `0` through `n - 1`.",
        defect: "The crossing loop makes one fewer move than requested.",
        hints: [
            "Trace a request for exactly one crossing.",
            "The loop counter counts crossings, not the vertices written down.",
            "Run one update for every step number from zero through `k - 1`; zero steps must run none."
        ],
        c: `int n;
int k;
int s;
READ(n);
READ(k);
READ(s);
ARRAY(next, 12);
for (int u = 0; u < n; u++) {
    READ(next[u]);
}
int position = s;
for (int step = 0; step < k; step++) {
    position = next[position];
}
OUT(position);`,
        py: `n = read_int()
k = read_int()
s = read_int()
nxt = [read_int() for _ in range(n)]
position = s
for step in range(k):
    position = nxt[position]
print(position)`,
        cbug: [
            "step < k;",
            "step < k - 1;"
        ],
        pybug: [
            "range(k):",
            "range(k - 1):"
        ],
        cases: [
            [
                "3 2 0\n1 2 0",
                "2"
            ],
            [
                "3 0 1\n1 2 0",
                "1"
            ],
            [
                "4 3 0\n1 2 3 0",
                "3"
            ],
            [
                "1 30 0\n0",
                "0"
            ],
            [
                "2 1 1\n1 0",
                "0"
            ],
            [
                "5 4 4\n0 0 1 2 3",
                "0"
            ],
            [
                "3 30 0\n1 2 0",
                "0"
            ],
            [
                "12 11 0\n1 2 3 4 5 6 7 8 9 10 11 11",
                "11"
            ]
        ],
        witness: 3,
        probe: [
            "6 5 0\n2 0 4 1 5 3",
            "1"
        ]
    },
    {
        title: "Immediate Return Log",
        difficulty: 10,
        guide: "`walk` is the recorded sequence of vertices. A loop position `i` represents the end of two consecutive moves. `returns` counts immediate reversals.",
        incident: "AEGIS sent a patrol back along its last cable. Ishan counts those immediate returns in the walk log.",
        symptom: "A return after two moves can be missed because the program compares adjacent entries.",
        task: "Count positions where a walk goes from some vertex `a` to a different vertex `b` and immediately back to `a`. Each qualifying three-entry section contributes once, and sections may overlap. Consecutive log entries always differ. No graph reconstruction is needed.",
        input: "Read `n`, the number of possible vertices, and `k`, the log length. Then read `k` entries in `walk`.",
        output: "Print the number of immediate two-move returns.",
        example: "Sample 1 is `0 1 0 1`, which contains returns `0 1 0` and `1 0 1`, so print `2`. Sample 2 is `0 1 2` and prints `0`.",
        constraints: "`1 <= n <= 12`; `1 <= k <= 20`. Entries are from `0` through `n - 1`, and adjacent entries differ. Each recorded move uses an available two-way cable; its full map is not needed.",
        defect: "The check compares the end of the two-move section with its middle instead of its beginning.",
        hints: [
            "Write down the positions in a three-entry log `0 1 0`.",
            "An immediate return ends where the previous move began.",
            "Compare the current entry with the entry two positions earlier. Leave overlapping sections in the count."
        ],
        c: `int n;
int k;
READ(n);
READ(k);
ARRAY(walk, 20);
for (int i = 0; i < k; i++) {
    READ(walk[i]);
}
int returns = 0;
for (int i = 2; i < k; i++) {
    if (walk[i] == walk[i - 2]) {
        returns++;
    }
}
OUT(returns);`,
        py: `n = read_int()
k = read_int()
walk = [read_int() for _ in range(k)]
returns = 0
for i in range(2, k):
    if walk[i] == walk[i - 2]:
        returns += 1
print(returns)`,
        cbug: [
            "walk[i] == walk[i - 2]",
            "walk[i] == walk[i - 1]"
        ],
        pybug: [
            "walk[i] == walk[i - 2]",
            "walk[i] == walk[i - 1]"
        ],
        cases: [
            [
                "2 4\n0 1 0 1",
                "2"
            ],
            [
                "3 3\n0 1 2",
                "0"
            ],
            [
                "4 5\n0 2 0 3 0",
                "2"
            ],
            [
                "1 1\n0",
                "0"
            ],
            [
                "2 2\n1 0",
                "0"
            ],
            [
                "3 5\n0 1 2 1 0",
                "1"
            ],
            [
                "4 7\n0 1 2 3 2 1 0",
                "1"
            ],
            [
                "12 20\n0 11 0 11 0 11 0 11 0 11 0 11 0 11 0 11 0 11 0 11",
                "18"
            ]
        ],
        witness: 3,
        probe: [
            "5 6\n4 1 4 2 3 2",
            "2"
        ]
    },
    {
        title: "Two Link Promise",
        difficulty: 24,
        guide: "`u`, `v`, and `w` choose a possible two-link walk. `ok` records whether all such walks have their required direct shortcut. The table is only inspected, never extended.",
        incident: "AEGIS forged a shortcut promise. Mira checks the promise against the original one-way map.",
        symptom: "A missing shortcut can be overlooked when just one of the two required links is absent in the condition.",
        task: "Check this rule for every ordered triple of vertices: if direct links `u -> v` and `v -> w` both exist, the direct link `u -> w` must also exist. Do not add links. The first and last vertex may be equal, so a return in two links requires a self-link.",
        input: "Read `n`, the vertex count, and `m`, the link count. Self-links may appear. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.",
        output: "Print `YES` if the original map obeys the rule everywhere; otherwise print `NO`.",
        example: "Sample 1 has `0 -> 1`, `1 -> 2`, and `0 -> 2`, so print `YES`. Sample 2 lacks `0 -> 2`, so print `NO`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct ; self-links are allowed. `0 <= m <= n * n`.",
        defect: "The missing-shortcut test wrongly requires both first-leg table entries instead of the two consecutive legs.",
        hints: [
            "Trace a two-link chain whose direct shortcut is missing.",
            "The second link starts at the middle vertex `v`.",
            "Check the consecutive links `u -> v` and `v -> w` before testing the shortcut `u -> w`."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
}
int ok = 1;
for (int u = 0; u < n; u++) {
    for (int v = 0; v < n; v++) {
        for (int w = 0; w < n; w++) {
            if (edge[u * n + v] == 1 && edge[v * n + w] == 1 && edge[u * n + w] == 0) {
                ok = 0;
            }
        }
    }
}
if (ok == 1) {
    SAY("YES");
} else {
    SAY("NO");
}`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
ok = 1
for u in range(n):
    for v in range(n):
        for w in range(n):
            if edge[u * n + v] == 1 and edge[v * n + w] == 1 and edge[u * n + w] == 0:
                ok = 0
print("YES" if ok == 1 else "NO")`,
        cbug: [
            "edge[v * n + w] == 1",
            "edge[u * n + w] == 1"
        ],
        pybug: [
            "edge[v * n + w] == 1",
            "edge[u * n + w] == 1"
        ],
        cases: [
            [
                "3 3\n0 1\n1 2\n0 2",
                "YES"
            ],
            [
                "3 2\n0 1\n1 2",
                "NO"
            ],
            [
                "4 2\n3 2\n2 1",
                "NO"
            ],
            [
                "1 0",
                "YES"
            ],
            [
                "1 1\n0 0",
                "YES"
            ],
            [
                "2 2\n0 1\n1 0",
                "NO"
            ],
            [
                "2 4\n0 0\n0 1\n1 0\n1 1",
                "YES"
            ],
            [
                "12 1\n0 11",
                "YES"
            ]
        ],
        witness: 3,
        probe: [
            "5 4\n0 2\n2 4\n0 4\n4 4",
            "YES"
        ]
    },
    {
        title: "Four Door Circuit",
        difficulty: 27,
        guide: "The loops choose four distinct vertices. `a` is the smallest vertex in the circuit and `b < d` chooses one travel direction, so each circuit is counted once.",
        incident: "AEGIS opened a gap in the four-door circuits. Patch checks that each circuit closes.",
        symptom: "A three-cable chain across four vertices can be counted as a closed circuit.",
        task: "Count circuits using four different vertices and four two-way cables in order, returning to the start. Rotating a circuit or reversing its direction does not make a new circuit. Different cable sets on the same four vertices do count separately. Extra diagonal cables do not invalidate a circuit.",
        input: "Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.",
        output: "Print the number of four-vertex circuits.",
        example: "Sample 1 is the square `0-1-2-3-0`, so print `1`. Sample 2 lacks the closing cable and prints `0`.",
        constraints: "`1 <= n <= 8`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.",
        defect: "The final cable returning to the first vertex is not checked.",
        hints: [
            "Try a chain of four vertices with only three cables.",
            "The loop bounds already handle duplicate circuit orders.",
            "Keep those bounds and require the cable from the last vertex `d` back to `a`."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
int count = 0;
for (int a = 0; a < n; a++) {
    for (int b = a + 1; b < n; b++) {
        for (int v = a + 1; v < n; v++) {
            for (int d = b + 1; d < n; d++) {
                if (v != b && v != d) {
                    if (edge[a * n + b] == 1 && edge[b * n + v] == 1 && edge[v * n + d] == 1 && edge[d * n + a] == 1) {
                        count++;
                    }
                }
            }
        }
    }
}
OUT(count);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
count = 0
for a in range(n):
    for b in range(a + 1, n):
        for v in range(a + 1, n):
            for d in range(b + 1, n):
                if v != b and v != d:
                    if edge[a * n + b] == 1 and edge[b * n + v] == 1 and edge[v * n + d] == 1 and edge[d * n + a] == 1:
                        count += 1
print(count)`,
        cbug: [
            " && edge[d * n + a] == 1",
            ""
        ],
        pybug: [
            " and edge[d * n + a] == 1",
            ""
        ],
        cases: [
            [
                "4 4\n0 1\n1 2\n2 3\n3 0",
                "1"
            ],
            [
                "4 3\n0 1\n1 2\n2 3",
                "0"
            ],
            [
                "5 3\n1 2\n2 3\n3 4",
                "0"
            ],
            [
                "1 0",
                "0"
            ],
            [
                "4 6\n0 1\n0 2\n0 3\n1 2\n1 3\n2 3",
                "3"
            ],
            [
                "5 5\n0 1\n1 2\n2 3\n3 4\n4 0",
                "0"
            ],
            [
                "6 6\n0 3\n0 4\n0 5\n1 3\n1 4\n1 5",
                "3"
            ],
            [
                "8 28\n0 1\n0 2\n0 3\n0 4\n0 5\n0 6\n0 7\n1 2\n1 3\n1 4\n1 5\n1 6\n1 7\n2 3\n2 4\n2 5\n2 6\n2 7\n3 4\n3 5\n3 6\n3 7\n4 5\n4 6\n4 7\n5 6\n5 7\n6 7",
                "210"
            ]
        ],
        witness: 3,
        probe: [
            "6 5\n0 2\n2 4\n4 5\n5 0\n0 4",
            "1"
        ]
    },
    {
        title: "First Crossing Toll",
        difficulty: 22,
        guide: "`used` records paid cables. `walk` supplies an already valid route. Each new cable adds its `edge` toll, then the payment table is updated.",
        incident: "AEGIS duplicated toll charges. Ishan checks a courier who pays for each cable only on its first crossing.",
        symptom: "Returning along a cable can charge its toll a second time.",
        task: "Follow the supplied valid walk on a two-way weighted graph. Pay a cable toll only on its first crossing in either direction during this walk. Later crossings of that same cable are free. Add the tolls actually paid; do not choose a different walk.",
        input: "Read `n` and `m`, then `m` triples `u v weight`. Read `k`, then `k` walk vertices.",
        output: "Print the total first-crossing toll.",
        example: "Sample 1 crosses cable `0-1` twice in opposite directions at toll `7`, so print `7`. Sample 2 crosses two different cables costing `3` and `5`, so print `8`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `1 <= weight <= 100`; `1 <= k <= 20`. Each walk step uses a listed cable.",
        defect: "The payment table marks only the travel direction, although a cable is shared by both directions.",
        hints: [
            "Cross one cable and immediately return along it.",
            "The cable has one payment state, even though the table has two entries.",
            "When recording payment, mark the entry for the reverse direction too."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    int weight;
    READ(weight);
    edge[u * n + v] = weight;
    edge[v * n + u] = weight;
}
int k;
READ(k);
ARRAY(walk, 20);
for (int i = 0; i < k; i++) {
    READ(walk[i]);
}
ARRAY(used, 144);
int total = 0;
for (int i = 1; i < k; i++) {
    int u = walk[i - 1];
    int v = walk[i];
    if (used[u * n + v] == 0) {
        total += edge[u * n + v];
        used[u * n + v] = 1;
        used[v * n + u] = 1;
    }
}
OUT(total);`,
        py: `n = read_int()
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    weight = read_int()
    edge[u * n + v] = weight
    edge[v * n + u] = weight
k = read_int()
walk = [read_int() for _ in range(k)]
used = [0] * (n * n)
total = 0
for i in range(1, k):
    u = walk[i - 1]
    v = walk[i]
    if used[u * n + v] == 0:
        total += edge[u * n + v]
        used[u * n + v] = 1
        used[v * n + u] = 1
print(total)`,
        cbug: [
            "used[v * n + u] = 1;",
            "used[u * n + v] = 1;"
        ],
        pybug: [
            "used[v * n + u] = 1",
            "used[u * n + v] = 1"
        ],
        cases: [
            [
                "2 1\n0 1 7\n3 0 1 0",
                "7"
            ],
            [
                "3 2\n0 1 3\n1 2 5\n3 0 1 2",
                "8"
            ],
            [
                "3 2\n0 1 2\n1 2 9\n5 0 1 2 1 0",
                "11"
            ],
            [
                "1 0\n1 0",
                "0"
            ],
            [
                "3 3\n0 1 1\n1 2 1\n2 0 1\n5 0 1 2 0 1",
                "3"
            ],
            [
                "4 1\n0 3 100\n4 3 0 3 0",
                "100"
            ],
            [
                "4 3\n0 1 4\n1 2 5\n2 3 6\n4 0 1 2 3",
                "15"
            ],
            [
                "12 1\n0 11 100\n2 11 0",
                "100"
            ]
        ],
        witness: 3,
        probe: [
            "5 3\n0 2 11\n2 4 13\n4 0 17\n6 0 2 4 0 4 2",
            "41"
        ]
    },
    {
        title: "Synchronous Relay Lamps",
        difficulty: 26,
        guide: "`state` holds lamps at the start of a round. `nextstate` holds proposed results, and `active` counts lit neighbours of one vertex. A separate loop installs the round results.",
        incident: "AEGIS mixed the lamp update times. Mira restores the simultaneous rounds on the relay network.",
        symptom: "Changing the order of vertex labels can change a round that should be simultaneous.",
        task: "Run exactly `rounds` simultaneous rounds on the two-way graph. In each round a vertex becomes lit (`1`) exactly when it had one lit direct neighbour at the start of that round; otherwise it becomes dark (`0`). Its own old lamp does not count. All vertices update together, including lamps that were already lit.",
        input: "Read `n`, `m`, and `rounds`, then `n` initial lamp values, then `m` two-way pairs.",
        output: "Print the final `n` zero/one lamp values in vertex order.",
        example: "Sample 1 is chain `0-1-2` with lamps `1 0 0`: after one simultaneous round print `0 1 0`. Sample 2 requests zero rounds and preserves `1 0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `0 <= rounds <= 6`. Initial lamps are `0` or `1`.",
        defect: "Neighbour counting reads partially updated lamps from the new round.",
        hints: [
            "Trace one round on a three-vertex chain.",
            "Every vertex must see the same snapshot, regardless of loop order.",
            "Read neighbour lamps from the old-round array, and write results only to the next-round array until all vertices are processed."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
int rounds;
READ(rounds);
ARRAY(edge, 144);
ARRAY(state, 12);
for (int u = 0; u < n; u++) {
    READ(state[u]);
}
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
ARRAY(nextstate, 12);
for (int round = 0; round < rounds; round++) {
    for (int u = 0; u < n; u++) {
        nextstate[u] = state[u];
    }
    for (int u = 0; u < n; u++) {
        int active = 0;
        for (int v = 0; v < n; v++) {
            active += edge[u * n + v] * state[v];
        }
        nextstate[u] = 0;
        if (active == 1) {
            nextstate[u] = 1;
        }
    }
    for (int u = 0; u < n; u++) {
        state[u] = nextstate[u];
    }
}
for (int u = 0; u < n; u++) {
    OUT(state[u]);
}`,
        py: `n = read_int()
m = read_int()
rounds = read_int()
edge = [0] * (n * n)
state = [read_int() for _ in range(n)]
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
for _ in range(rounds):
    nextstate = state[:]
    for u in range(n):
        active = 0
        for v in range(n):
            active += edge[u * n + v] * state[v]
        nextstate[u] = 0
        if active == 1:
            nextstate[u] = 1
    state = nextstate
print(*state)`,
        cbug: [
            "active += edge[u * n + v] * state[v];",
            "active += edge[u * n + v] * nextstate[v];"
        ],
        pybug: [
            "active += edge[u * n + v] * state[v]",
            "active += edge[u * n + v] * nextstate[v]"
        ],
        cases: [
            [
                "3 2 1\n1 0 0\n0 1\n1 2",
                "0 1 0"
            ],
            [
                "2 1 0\n1 0\n0 1",
                "1 0"
            ],
            [
                "4 3 2\n1 0 0 0\n0 1\n1 2\n2 3",
                "1 0 1 0"
            ],
            [
                "1 0 1\n1",
                "0"
            ],
            [
                "3 3 1\n1 1 0\n0 1\n1 2\n2 0",
                "1 1 0"
            ],
            [
                "4 3 3\n1 0 0 0\n0 1\n0 2\n0 3",
                "0 0 0 0"
            ],
            [
                "5 0 6\n1 0 1 0 1",
                "0 0 0 0 0"
            ],
            [
                "12 11 6\n1 0 0 0 0 0 0 0 0 0 0 0\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11",
                "1 0 1 0 1 0 1 0 0 0 0 0"
            ]
        ],
        witness: 3,
        probe: [
            "5 4 3\n0 1 0 1 0\n0 4\n4 2\n2 1\n1 3",
            "1 0 1 0 1"
        ]
    },
    {
        title: "Junction Switch Patrol",
        difficulty: 24,
        guide: "`port0` and `port1` hold two destinations per vertex. `choice` stores the next port to use at that vertex. `u` saves the departure vertex while `position` moves.",
        incident: "AEGIS moved the switch toggles. Patch traces a patrol that alternates ports separately at every junction.",
        symptom: "Arriving at a junction can change its switch before the patrol departs from it.",
        task: "Every vertex starts with its switch set to port `0`. For each of exactly `k` moves, follow the current vertex's selected port, and toggle that departure vertex's switch between `0` and `1`. No other switch changes. Self-links and equal port destinations are allowed. Report the final position and how many switches are set to `1`.",
        input: "Read `n`, `k`, and start `s`. Then read `n` pairs `port0 port1` in vertex order.",
        output: "Print the final position and the number of switches set to `1`.",
        example: "Sample 1 has ports `1 0` at vertex `0` and `0 1` at vertex `1`. Two moves from `0` return to `0` and toggle both departure switches, so print `0 2`. Sample 2 makes no moves from `1`, so print `1 0`.",
        constraints: "`1 <= n <= 12`; `0 <= k <= 30`. The start and every port destination are valid vertex numbers.",
        defect: "The switch update toggles the arrival vertex instead of the saved departure vertex.",
        hints: [
            "Trace two moves between different vertices and record each switch separately.",
            "The vertex stored in `position` changes before the toggle line.",
            "Use the saved departure vertex `u` when updating the switch."
        ],
        c: `int n;
int k;
int s;
READ(n);
READ(k);
READ(s);
ARRAY(port0, 12);
ARRAY(port1, 12);
ARRAY(choice, 12);
for (int u = 0; u < n; u++) {
    READ(port0[u]);
    READ(port1[u]);
}
int position = s;
for (int step = 0; step < k; step++) {
    int u = position;
    if (choice[u] == 0) {
        position = port0[u];
    } else {
        position = port1[u];
    }
    choice[u] = 1 - choice[u];
}
int switched = 0;
for (int u = 0; u < n; u++) {
    switched += choice[u];
}
OUT(position);
OUT(switched);`,
        py: `n = read_int()
k = read_int()
s = read_int()
port0 = [0] * n
port1 = [0] * n
for u in range(n):
    port0[u] = read_int()
    port1[u] = read_int()
choice = [0] * n
position = s
for step in range(k):
    u = position
    if choice[u] == 0:
        position = port0[u]
    else:
        position = port1[u]
    choice[u] = 1 - choice[u]
switched = sum(choice)
print(position, switched)`,
        cbug: [
            "choice[u] = 1 - choice[u];",
            "choice[position] = 1 - choice[position];"
        ],
        pybug: [
            "choice[u] = 1 - choice[u]",
            "choice[position] = 1 - choice[position]"
        ],
        cases: [
            [
                "2 2 0\n1 0\n0 1",
                "0 2"
            ],
            [
                "2 0 1\n1 0\n0 1",
                "1 0"
            ],
            [
                "3 4 0\n1 2\n2 0\n0 1",
                "2 2"
            ],
            [
                "1 1 0\n0 0",
                "0 1"
            ],
            [
                "1 30 0\n0 0",
                "0 0"
            ],
            [
                "2 1 0\n1 1\n0 0",
                "1 1"
            ],
            [
                "4 7 3\n1 2\n2 3\n3 0\n0 1",
                "0 3"
            ],
            [
                "12 30 0\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 0\n0 1",
                "6 6"
            ]
        ],
        witness: 3,
        probe: [
            "5 9 2\n1 3\n2 0\n4 1\n0 4\n3 2",
            "4 1"
        ]
    },
    {
        title: "Discovery Sender Cards",
        difficulty: 31,
        guide: "`queue` holds vertices in discovery order, with `head` selecting the next one to process. `parent` starts at `-1` and doubles as the discovered flag. Neighbours are inspected in ascending vertex order.",
        incident: "AEGIS replaced sender cards in a rescue broadcast. Mira restores the card of the relay that first discovered each vertex.",
        symptom: "A vertex discovered several links from the start can claim that the start contacted it directly.",
        task: "Run the supplied first-in-first-out discovery process from `s`. Start by discovering `s` and give it parent `s`. Take discovered vertices from the front of the queue. For each one, inspect its direct neighbours in ascending number order. When a neighbour is still undiscovered, set its parent to the current vertex and add it at the queue end. Never change an assigned parent. Unreachable vertices keep `-1`.",
        input: "Read `n`, `m`, and `s`, then `m` two-way pairs.",
        output: "Print all `n` discovery-parent labels in vertex order.",
        example: "Sample 1 is chain `0-1-2` starting at `0`, so print `0 0 1`. Sample 2 has only `0-1` and starts at `2`, so print `-1 -1 2`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `s` is a valid vertex.",
        defect: "A newly discovered vertex records the global start instead of the relay currently processing it.",
        hints: [
            "Trace a chain containing at least two cables from the start.",
            "The sender of a discovery is the vertex taken from the queue for that iteration.",
            "Assign the newly discovered neighbour the current processing vertex `u`, leaving the start's own card unchanged."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
int s;
READ(s);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
ARRAY(parent, 12);
ARRAY(queue, 12);
for (int v = 0; v < n; v++) {
    parent[v] = -1;
}
int head = 0;
int tail = 1;
queue[0] = s;
parent[s] = s;
while (head < tail) {
    int u = queue[head];
    head++;
    for (int v = 0; v < n; v++) {
        if (edge[u * n + v] == 1 && parent[v] == -1) {
            parent[v] = u;
            queue[tail] = v;
            tail++;
        }
    }
}
for (int v = 0; v < n; v++) {
    OUT(parent[v]);
}`,
        py: `n = read_int()
m = read_int()
s = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
parent = [-1] * n
queue = [s]
head = 0
parent[s] = s
while head < len(queue):
    u = queue[head]
    head += 1
    for v in range(n):
        if edge[u * n + v] == 1 and parent[v] == -1:
            parent[v] = u
            queue.append(v)
print(*parent)`,
        cbug: [
            "parent[v] = u;",
            "parent[v] = s;"
        ],
        pybug: [
            "parent[v] = u",
            "parent[v] = s"
        ],
        cases: [
            [
                "3 2 0\n0 1\n1 2",
                "0 0 1"
            ],
            [
                "3 1 2\n0 1",
                "-1 -1 2"
            ],
            [
                "4 3 0\n0 1\n1 2\n2 3",
                "0 0 1 2"
            ],
            [
                "1 0 0",
                "0"
            ],
            [
                "4 4 0\n0 1\n0 2\n1 3\n2 3",
                "0 0 0 1"
            ],
            [
                "5 3 4\n4 3\n3 2\n2 1",
                "-1 2 3 4 4"
            ],
            [
                "4 6 2\n0 1\n0 2\n0 3\n1 2\n1 3\n2 3",
                "2 2 2 2"
            ],
            [
                "12 11 11\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11",
                "1 2 3 4 5 6 7 8 9 10 11 11"
            ]
        ],
        witness: 3,
        probe: [
            "6 5 5\n5 2\n5 3\n2 0\n3 0\n0 1",
            "2 0 5 5 -1 5"
        ]
    },
    {
        title: "Largest Floor Island",
        difficulty: 33,
        guide: "`tile` is the row-ordered grid. `seen` prevents a tile from joining two searches. The four offsets in `dr` and `dc` describe side neighbours. `tail` is the size of the current island; `best` keeps the largest size.",
        incident: "AEGIS severed the floor map. Patch measures the largest region still joined by shared tile sides.",
        symptom: "A single bent region can be split into smaller reported islands.",
        task: "Find the largest group of occupied (`1`) grid tiles connected through shared full sides. Empty (`0`) tiles cannot be crossed. Diagonal contact does not connect tiles. Count tiles in a group, not its boundary. Print zero if every tile is empty. The supplied bounded queue search already visits each tile at most once.",
        input: "Read `rows` and `cols`, then `rows * cols` tile values in row order.",
        output: "Print the largest side-connected occupied group size.",
        example: "Sample 1 has three occupied tiles joined in a bent shape and prints `3`. Sample 2 has only diagonal occupied tiles and prints `1`.",
        constraints: "`1 <= rows, cols <= 6`. Each tile is `0` or `1`.",
        defect: "The left-neighbour offset is zero, so that direction checks the current tile instead.",
        hints: [
            "Trace a region that must turn left after moving down.",
            "Pair the four row offsets with the four column offsets.",
            "The left move keeps the row unchanged and decreases the column by one."
        ],
        c: `int rows;
int cols;
READ(rows);
READ(cols);
ARRAY(tile, 36);
ARRAY(seen, 36);
ARRAY(queue, 36);
for (int i = 0; i < rows * cols; i++) {
    READ(tile[i]);
}
ARRAY(dr, 4);
ARRAY(dc, 4);
dr[0] = -1;
dr[1] = 1;
dc[2] = -1;
dc[3] = 1;
int best = 0;
for (int start = 0; start < rows * cols; start++) {
    if (tile[start] == 1 && seen[start] == 0) {
        int head = 0;
        int tail = 1;
        queue[0] = start;
        seen[start] = 1;
        while (head < tail) {
            int u = queue[head];
            head++;
            int r = u / cols;
            int c = u % cols;
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d];
                int nc = c + dc[d];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    int v = nr * cols + nc;
                    if (tile[v] == 1 && seen[v] == 0) {
                        seen[v] = 1;
                        queue[tail] = v;
                        tail++;
                    }
                }
            }
        }
        if (tail > best) {
            best = tail;
        }
    }
}
OUT(best);`,
        py: `rows = read_int()
cols = read_int()
tile = [read_int() for _ in range(rows * cols)]
seen = [0] * (rows * cols)
dr = [-1, 1, 0, 0]
dc = [0, 0, -1, 1]
best = 0
for start in range(rows * cols):
    if tile[start] == 1 and seen[start] == 0:
        queue = [start]
        head = 0
        seen[start] = 1
        while head < len(queue):
            u = queue[head]
            head += 1
            r = u // cols
            c = u % cols
            for d in range(4):
                nr = r + dr[d]
                nc = c + dc[d]
                if 0 <= nr < rows and 0 <= nc < cols:
                    v = nr * cols + nc
                    if tile[v] == 1 and seen[v] == 0:
                        seen[v] = 1
                        queue.append(v)
        if len(queue) > best:
            best = len(queue)
print(best)`,
        cbug: [
            "dc[2] = -1;",
            "dc[2] = 0;"
        ],
        pybug: [
            "dc = [0, 0, -1, 1]",
            "dc = [0, 0, 0, 1]"
        ],
        cases: [
            [
                "2 2\n1 1\n0 1",
                "3"
            ],
            [
                "2 2\n1 0\n0 1",
                "1"
            ],
            [
                "2 3\n0 0 1\n1 1 1",
                "4"
            ],
            [
                "1 1\n0",
                "0"
            ],
            [
                "1 1\n1",
                "1"
            ],
            [
                "3 3\n1 0 1\n1 0 1\n1 1 1",
                "7"
            ],
            [
                "3 4\n0 1 0 0\n0 1 1 1\n1 1 0 1",
                "7"
            ],
            [
                "6 6\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1\n1 1 1 1 1 1",
                "36"
            ]
        ],
        witness: 3,
        probe: [
            "3 4\n0 0 0 1\n1 1 0 1\n0 1 1 1",
            "7"
        ]
    },
    {
        title: "Simultaneous Twig Trim",
        difficulty: 32,
        guide: "`alive` records the current tree vertices. Each round fills `removed` from the old tree, then a separate loop applies those removals. `degree` counts only neighbours still alive.",
        incident: "AEGIS made tree cleanup depend on label order. Ishan restores simultaneous trimming of the repair tree.",
        symptom: "One round can remove a vertex that became a leaf only after another vertex was removed during that same round.",
        task: "Begin with every vertex of the given two-way tree alive. Run exactly `rounds` simultaneous rounds. At the start of each round, mark every alive vertex that has at most one alive neighbour. Remove all marked vertices together, along with their incident cables. An isolated vertex is removed too. A vertex newly exposed by those removals waits until the next round. The empty tree remains empty.",
        input: "Read `n`, `m`, and `rounds`, then `m` two-way tree pairs.",
        output: "Print the surviving vertex count, followed by surviving vertex numbers in ascending order. If none remain, print only `0`.",
        example: "Sample 1 trims one round from chain `0-1-2-3-4`, leaving `1 2 3`; print `3 1 2 3`. Sample 2 trims the only vertex and prints `0`.",
        constraints: "`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `m = n - 1` and all vertices are connected, so the graph is a tree. `0 <= rounds <= 6`.",
        defect: "Selection deletes vertices immediately, so later degree checks see a partially trimmed round.",
        hints: [
            "Trace one round on a five-vertex chain.",
            "All degree checks in one round must use the same alive-vertex snapshot.",
            "Mark the vertex in the removal array during selection; update the alive array only in the separate application loop."
        ],
        c: `int n;
int m;
READ(n);
READ(m);
int rounds;
READ(rounds);
ARRAY(edge, 144);
for (int i = 0; i < m; i++) {
    int u;
    int v;
    READ(u);
    READ(v);
    edge[u * n + v] = 1;
    edge[v * n + u] = 1;
}
ARRAY(alive, 12);
ARRAY(removed, 12);
for (int u = 0; u < n; u++) {
    alive[u] = 1;
}
for (int round = 0; round < rounds; round++) {
    for (int u = 0; u < n; u++) {
        removed[u] = 0;
        if (alive[u] == 1) {
            int degree = 0;
            for (int v = 0; v < n; v++) {
                degree += edge[u * n + v] * alive[v];
            }
            if (degree <= 1) {
                removed[u] = 1;
            }
        }
    }
    for (int u = 0; u < n; u++) {
        if (removed[u] == 1) {
            alive[u] = 0;
        }
    }
}
int count = 0;
for (int u = 0; u < n; u++) {
    count += alive[u];
}
OUT(count);
for (int u = 0; u < n; u++) {
    if (alive[u] == 1) {
        OUT(u);
    }
}`,
        py: `n = read_int()
m = read_int()
rounds = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
alive = [1] * n
for _ in range(rounds):
    removed = [0] * n
    for u in range(n):
        if alive[u] == 1:
            degree = 0
            for v in range(n):
                degree += edge[u * n + v] * alive[v]
            if degree <= 1:
                removed[u] = 1
    for u in range(n):
        if removed[u] == 1:
            alive[u] = 0
result = [u for u in range(n) if alive[u] == 1]
print(len(result), *result)`,
        cbug: [
            "removed[u] = 1;",
            "alive[u] = 0;"
        ],
        pybug: [
            "removed[u] = 1",
            "alive[u] = 0"
        ],
        cases: [
            [
                "5 4 1\n0 1\n1 2\n2 3\n3 4",
                "3 1 2 3"
            ],
            [
                "1 0 1",
                "0"
            ],
            [
                "6 5 1\n0 1\n1 2\n2 3\n3 4\n4 5",
                "4 1 2 3 4"
            ],
            [
                "1 0 0",
                "1 0"
            ],
            [
                "4 3 1\n0 1\n0 2\n0 3",
                "1 0"
            ],
            [
                "5 4 2\n0 1\n1 2\n2 3\n3 4",
                "1 2"
            ],
            [
                "5 4 3\n0 1\n1 2\n2 3\n3 4",
                "0"
            ],
            [
                "12 11 5\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11",
                "2 5 6"
            ]
        ],
        witness: 3,
        probe: [
            "7 6 2\n3 0\n3 1\n3 2\n2 4\n4 5\n4 6",
            "1 2"
        ]
    }
];
