const edges = `int n,m; READ(n); READ(m); ARRAY(adj,400);
for(int i=0;i<m;i++){ int u,v; READ(u); READ(v); adj[u*n+v]=1; adj[v*n+u]=1; }`;
const pyedges = `n, m = read_int(), read_int()
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    adj[u][v] = 1
    adj[v][u] = 1`;
export const nexus = [
{
example:"In the first sample, cable `0 1` also connects box `1` to box `0`, so query `1 0` prints `YES`. In the second sample, query `0 2` prints `NO`.",
title:"Return Wire",difficulty:5,
guide:"`adj` stores direct connections. The final check reads the entry for the requested pair; it does not search through other boxes.",
incident:"AEGIS has disrupted cable checks. Ishan checks whether two relay boxes share a direct cable.",
symptom:"A cable can appear missing when its endpoints are queried in reverse order.",task:"Print `YES` if a direct cable joins `s` (the first box) and `t` (the second box). Cables work both ways. A route through another box does not count. A box has no cable to itself in this input.",input:"1. Read `n` (the number of boxes) and `m` (the number of cables).\n2. Read `m` pairs `u v`, the endpoints of each cable.\n3. Read `s t`, the pair to check.",output:"Print `YES` for a direct cable, otherwise `NO`.",constraints:"`2 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. No cable is repeated or joins a box to itself.",
defect:"An undirected edge is inserted in only one direction.",hints:["Try querying the same cable in both endpoint orders.","`adj` (the direct-connection table) is queried in either direction.","When reading `u v`, record both the connection from `u` to `v` and the connection from `v` to `u` in `adj`."],
c:edges+`\nint s,t; READ(s); READ(t); if(adj[s*n+t]==1){ SAY("YES"); }else{ SAY("NO"); }`,
py:pyedges+`\ns, t = read_int(), read_int()\nprint("YES" if adj[s][t] == 1 else "NO")`,
cbug:["adj[v*n+u]=1;",""],pybug:["    adj[v][u] = 1\n",""],
cases:[["3 1\n0 1\n1 0","YES"],["3 1\n0 1\n0 2","NO"],["2 0\n0 1","NO"],["2 1\n1 0\n0 1","YES"],["3 2\n0 1\n1 2\n0 2","NO"],["3 2\n0 2\n1 2\n2 1","YES"]]
},
{
example:"In the first sample, ignore `0 0` and count `0 1` and `1 2`, so print `2`. The second sample contains only `1 1`, so print `0`.",
title:"False Connections",difficulty:6,
guide:"`count` is the answer. The loop reads `u` and `v` (the endpoints) and decides whether the record contributes.",
incident:"AEGIS has added useless records to the cable list. Ishan counts records joining different boxes.",
symptom:"The program counts the wrong kind of connection record.",task:"Count records whose two box numbers differ. Ignore a record joining a box to itself. Count each qualifying record separately, even if the same pair appears again or in reverse order.",input:"1. Read `n` (the number of boxes) and `m` (the number of records).\n2. Read `m` pairs `u v`, the endpoint numbers for each record.",output:"Print one integer: the number of records with different endpoints.",constraints:"`1 <= n <= 20`; `0 <= m <= 100`. Boxes are numbered `0` through `n - 1`. Repeated records and records joining a box to itself are allowed.",
defect:"The self-link exclusion condition is inverted.",hints:["Compare a record joining different boxes with one joining a box to itself.","The decision depends on whether `u` and `v` (the endpoints) are equal.","Increase `count` (the answer) when `u != v`, rather than when the endpoints are equal."],
c:`int n,m; READ(n); READ(m); int count=0;
for(int i=0;i<m;i++){ int u,v; READ(u); READ(v); if(u!=v) count++; }
OUT(count);`,
py:`n, m = read_int(), read_int()
count = 0
for _ in range(m):
    u, v = read_int(), read_int()
    if u != v:
        count += 1
print(count)`,cbug:["u!=v","u==v"],pybug:["u != v","u == v"],cases:[["3 3\n0 0\n0 1\n1 2","2"],["2 1\n1 1","0"],["1 0","0"],["2 3\n0 1\n1 0\n0 1","3"],["1 2\n0 0\n0 0","0"],["4 4\n0 0\n1 1\n2 3\n3 2","2"]]
},
{
example:"In the first sample, route `0 -> 1 -> 2` crosses two cables, so print `2`. The second sample has no route between the queried boxes, so print `-1`.",
title:"Origin Hop",difficulty:18,
guide:"`queue` lists boxes waiting to be explored. `dist` stores cable counts, with `-1` meaning not reached.",
incident:"AEGIS has disrupted route distances. Mira checks how many cables a message must cross.",
symptom:"A reachable target can be reported one cable too far away.",task:"Find the fewest cables on a route from `s` (the start) to `t` (the target). Cables work both ways. If `s == t`, the answer is `0`. If no route exists, the answer is `-1`.",input:"1. Read `n` (the number of boxes) and `m` (the number of cables).\n2. Read `m` pairs `u v`, the endpoints of each two-way cable.\n3. Read `s t`, the start and target.",output:"Print the fewest cables needed, or `-1` if the target cannot be reached.",constraints:"`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. No cable is repeated or joins a box to itself.",
defect:"The starting relay is assigned distance one instead of zero.",hints:["How many cables are needed to stay at the starting box?","Check the initial `dist[s]` (the starting box's distance).","Set `dist[s]` to `0`. Each step to a new neighbour then adds one to the current distance."],
c:edges+`\nint s,t; READ(s); READ(t); ARRAY(dist,20); ARRAY(queue,20);
for(int i=0;i<n;i++) dist[i]=-1;
int head=0,tail=0; queue[tail++]=s; dist[s]=0;
while(head<tail){ int u=queue[head++]; for(int v=0;v<n;v++) if(adj[u*n+v]==1 && dist[v]==-1){ dist[v]=dist[u]+1; queue[tail++]=v; } }
OUT(dist[t]);`,
py:pyedges+`\ns, t = read_int(), read_int()
dist = [-1] * n
queue = [s]
dist[s] = 0
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and dist[v] == -1:
            dist[v] = dist[u] + 1
            queue.append(v)
print(dist[t])`,cbug:["dist[s]=0","dist[s]=1"],pybug:["dist[s] = 0","dist[s] = 1"],cases:[["3 2\n0 1\n1 2\n0 2","2"],["2 0\n0 1","-1"],["1 0\n0 0","0"],["2 1\n0 1\n1 0","1"],["4 3\n0 1\n1 2\n2 3\n0 3","3"],["3 1\n1 2\n2 2","0"]]
},
{
example:"In the first sample, `0 -> 1 -> 2` has only leaf `2`, so print `1`. In the second sample, devices `1` and `2` are children of `0` and have no children, so print `2`.",
title:"False Leaves",difficulty:12,
guide:"`children` stores each device's child count. `leaves` is the final answer.",
incident:"AEGIS has disrupted the device tree. Patch counts devices with no children.",
symptom:"Devices that still have one child can be counted as leaves.",task:"A tree connects all devices and has exactly one route between any two without repeating a device. Root device `0` sets parent-child directions away from itself. Each input pair names a parent and its child, one step farther from the root. Count leaves, meaning devices with no children. A one-device tree has one leaf.",input:"1. Read `n` (the number of devices).\n2. Read `n - 1` parent-child pairs. The names are `p v` in C, C++ and Java; `parent child` in Python. The parent is always first.",output:"Print one integer: the number of devices with no children.",constraints:"`1 <= n <= 20`. Devices are numbered `0` through `n - 1`. The pairs form one valid tree rooted at `0`. Every other device has exactly one parent.",
defect:"The leaf test accepts nodes with one child.",hints:["Draw the three-device chain in the first sample.","A device with one child still has another device below it.","Count a device only when its entry in `children` (its child count) is exactly `0`."],
c:`int n; READ(n); ARRAY(children,20);
for(int i=0;i<n-1;i++){ int p,v; READ(p); READ(v); children[p]++; }
int leaves=0; for(int i=0;i<n;i++) if(children[i]==0) leaves++; OUT(leaves);`,
py:`n = read_int()
children = [0] * n
for _ in range(n - 1):
    parent, child = read_int(), read_int()
    children[parent] += 1
leaves = sum(1 for value in children if value == 0)
print(leaves)`,cbug:["children[i]==0","children[i]<=1"],pybug:["value == 0","value <= 1"],cases:[["3\n0 1\n1 2","1"],["3\n0 1\n0 2","2"],["1","1"],["2\n0 1","1"],["5\n0 1\n0 2\n2 3\n2 4","3"],["4\n0 1\n1 2\n2 3","1"]]
},
{
example:"In the first sample, records `0 1`, `0 1`, and `0 2` give box `0` two destinations. Print `2 0 0`. The second sample has no records, so print `0 0`.",
title:"Echo Fanout",difficulty:15,
guide:"`adj` stores direct links. Each output count comes from one row of that table.",
incident:"AEGIS has repeated entries in the link log. Mira counts each box's different direct destinations.",
symptom:"Repeated records can increase the reported number of destinations.",task:"For each box, count the different boxes it can reach with one link. A pair `u v` allows travel from `u` to `v` only. Repeated records for the same pair count once. A link from a box to itself counts as one destination. Routes through other boxes do not count.",input:"1. Read `n` (the number of boxes) and `m` (the number of link records).\n2. Read `m` pairs `u v`, with sender `u` first and destination `v` second.",output:"Print `n` counts separated by spaces, for boxes `0` through `n - 1` in order.",constraints:"`1 <= n <= 20`; `0 <= m <= 100`. Boxes are numbered `0` through `n - 1`. Repeated links and links from a box to itself are allowed.",
defect:"Adjacency accumulates duplicate records instead of storing presence.",hints:["Do three copies of a link reach three different destinations?","`adj` needs to record whether a link exists, regardless of how often it is listed.","Assign `1` to the entry in `adj` for `u` to `v`, even when the pair repeats. Do not add to that entry."],
c:`int n,m; READ(n); READ(m); ARRAY(adj,400);
for(int i=0;i<m;i++){ int u,v; READ(u); READ(v); adj[u*n+v]=1; }
for(int u=0;u<n;u++){ int count=0; for(int v=0;v<n;v++) count+=adj[u*n+v]; OUT(count); }`,
py:`n, m = read_int(), read_int()
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    adj[u][v] = 1
print(*(sum(row) for row in adj))`,cbug:["adj[u*n+v]=1","adj[u*n+v]+=1"],pybug:["adj[u][v] = 1","adj[u][v] += 1"],cases:[["3 3\n0 1\n0 1\n0 2","2 0 0"],["2 0","0 0"],["1 3\n0 0\n0 0\n0 0","1"],["3 3\n0 1\n1 2\n2 0","1 1 1"],["2 4\n0 1\n1 0\n0 1\n1 0","1 1"],["3 2\n2 0\n2 1","0 0 2"]]
},
{
example:"In the first sample, `0 -> 1 -> 2` reaches target `2` from start `0`, so print `YES`. The same links provide no route from `2` to `0` in the second sample, so print `NO`.",
title:"Wrong Way Courier",difficulty:18,
guide:"`adj` stores direct links, `queue` lists boxes waiting to be explored, and `seen` records boxes already reached.",
incident:"AEGIS has disrupted message routes. Ishan checks whether a message can follow the allowed directions.",
symptom:"The search can follow the reverse of each listed direction.",task:"Print `YES` if a route leads from `s` (the start) to `t` (the target). Each pair `u v` allows one step from `u` to `v` only. Any number of allowed steps may be used. A box reaches itself with zero steps, so `s == t` prints `YES`.",input:"1. Read `n` (the number of boxes) and `m` (the number of links).\n2. Read `m` pairs `u v`, with sender `u` first and destination `v` second.\n3. Read `s t`, the start and target.",output:"Print `YES` if the target can be reached, otherwise `NO`.",constraints:"`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`.",
defect:"Directed edges are stored in reverse orientation.",hints:["Does record `0 1` allow travel from `1` to `0`?","Check which endpoint is treated as the sender when filling `adj` (the link table).","Store each pair `u v` in the entry for `u` to `v`. The search then follows outgoing links from the current box."],
c:`int n,m; READ(n); READ(m); ARRAY(adj,400);
for(int i=0;i<m;i++){ int u,v; READ(u); READ(v); adj[u*n+v]=1; }
int s,t; READ(s); READ(t); ARRAY(seen,20); ARRAY(queue,20); int head=0,tail=0; queue[tail++]=s; seen[s]=1;
while(head<tail){ int u=queue[head++]; for(int v=0;v<n;v++) if(adj[u*n+v]==1 && seen[v]==0){ seen[v]=1; queue[tail++]=v; } }
if(seen[t]==1){ SAY("YES"); }else{ SAY("NO"); }`,
py:`n, m = read_int(), read_int()
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = read_int(), read_int()
    adj[u][v] = 1
s, t = read_int(), read_int()
seen = [0] * n
queue = [s]
seen[s] = 1
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and seen[v] == 0:
            seen[v] = 1
            queue.append(v)
print("YES" if seen[t] else "NO")`,cbug:["adj[u*n+v]=1","adj[v*n+u]=1"],pybug:["adj[u][v] = 1","adj[v][u] = 1"],cases:[["3 2\n0 1\n1 2\n0 2","YES"],["3 2\n0 1\n1 2\n2 0","NO"],["1 0\n0 0","YES"],["2 0\n0 1","NO"],["3 3\n0 1\n1 2\n2 0\n2 1","YES"],["4 2\n0 1\n2 3\n0 3","NO"],["4 3\n0 1\n1 2\n2 3\n0 3","YES"]]
},
{
example:"The first sample has one cable joining boxes `0` and `1`. Starting at `0` reaches two boxes, so print `2`. With no cables in the second sample, only start `1` is reachable, so print `1`.",
title:"Backfeed Census",difficulty:20,
guide:"`queue` lists boxes added to the search. `seen` records boxes already discovered. The final answer is the number of entries in `queue`.",
incident:"AEGIS has disrupted the network count. Ishan counts the different boxes reachable from one start.",
symptom:"The starting box can be counted again when the search returns to it.",task:"Count the different boxes reachable from `s` (the start) along two-way cables. Include `s`, even if it has no cables. Count each box once, regardless of how many routes reach it.",input:"1. Read `n` (the number of boxes) and `m` (the number of cables).\n2. Read `m` pairs `u v`, the endpoints of each two-way cable.\n3. Read `s`, the starting box.",output:"Print one integer: the number of different reachable boxes, including the start.",constraints:"`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. No cable is repeated or joins a box to itself.",
defect:"The source is queued without marking it visited.",hints:["Trace the first sample from the start, across the cable, and back.","Compare how `seen` (the discovered-box flags) treats the start and later boxes.","Mark `s` as seen when adding it to the initial `queue`, before the search begins."],
c:edges+`\nint s; READ(s); ARRAY(seen,20); ARRAY(queue,21); int head=0,tail=0; queue[tail++]=s; seen[s]=1;
while(head<tail){ int u=queue[head++]; for(int v=0;v<n;v++) if(adj[u*n+v]==1 && seen[v]==0){ seen[v]=1; queue[tail++]=v; } }
OUT(tail);`,
py:pyedges+`\ns = read_int()
seen = [0] * n
queue = [s]
seen[s] = 1
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and seen[v] == 0:
            seen[v] = 1
            queue.append(v)
print(len(queue))`,cbug:["seen[s]=1;",""],pybug:["seen[s] = 1\n",""],cases:[["2 1\n0 1\n0","2"],["3 0\n1","1"],["3 3\n0 1\n1 2\n2 0\n0","3"],["4 2\n0 1\n2 3\n0","2"],["1 0\n0","1"],["4 3\n0 1\n1 2\n2 3\n3","4"]]
},
{
example:"The first sample allows order `0`, then `1`, then `2`, so print `READY`. In the second sample, tasks `0` and `1` each require the other, so print `BLOCKED`.",
title:"Dependency Debt",difficulty:32,
guide:"`degree` stores each task's number of unfinished requirements. `queue` lists tasks released for processing. The final check asks whether every task was reached.",
incident:"AEGIS has disrupted the repair schedule. Patch checks whether every task can finish.",
symptom:"A chain of tasks can be reported blocked even though the tasks can finish in order.",task:"Each pair `u v` means task `u` must finish before task `v` starts. Print `READY` if all tasks can finish in some order that respects every pair. Otherwise print `BLOCKED`. A loop of requirements, including a task requiring itself, blocks completion.",input:"1. Read `n` (the number of tasks) and `m` (the number of requirements).\n2. Read `m` pairs `u v`, with the required earlier task first.",output:"Print `READY` if every task can finish, otherwise `BLOCKED`. Do not print an order.",constraints:"`1 <= n <= 20`; `0 <= m <= 40`. Tasks are numbered `0` through `n - 1`. No pair is repeated. A task may require itself.",
defect:"Completing a prerequisite increments remaining dependency counts instead of decrementing them.",hints:["When a required task finishes, is there more or less left to wait for?","Follow `degree[v]` (task `v`'s unfinished requirement count) as a prerequisite finishes.","Decrease `degree[v]` for each completed requirement. Add task `v` to `queue` when its count reaches `0`."],
c:`int n,m; READ(n); READ(m); ARRAY(adj,400); ARRAY(degree,20);
for(int i=0;i<m;i++){ int u,v; READ(u); READ(v); adj[u*n+v]=1; degree[v]++; }
ARRAY(queue,20); int head=0,tail=0;
for(int i=0;i<n;i++) if(degree[i]==0) queue[tail++]=i;
while(head<tail){ int u=queue[head++]; for(int v=0;v<n;v++) if(adj[u*n+v]==1){ degree[v]--; if(degree[v]==0) queue[tail++]=v; } }
if(tail==n){ SAY("READY"); }else{ SAY("BLOCKED"); }`,
py:`n, m = read_int(), read_int()
adj = [[0] * n for _ in range(n)]
degree = [0] * n
for _ in range(m):
    u, v = read_int(), read_int()
    adj[u][v] = 1
    degree[v] += 1
queue = [i for i in range(n) if degree[i] == 0]
for u in queue:
    for v in range(n):
        if adj[u][v] == 1:
            degree[v] -= 1
            if degree[v] == 0:
                queue.append(v)
print("READY" if len(queue) == n else "BLOCKED")`,cbug:["degree[v]--;","degree[v]++;"],pybug:["degree[v] -= 1","degree[v] += 1"],cases:[["3 2\n0 1\n1 2","READY"],["2 2\n0 1\n1 0","BLOCKED"],["1 0","READY"],["1 1\n0 0","BLOCKED"],["4 4\n0 1\n0 2\n1 3\n2 3","READY"],["4 2\n0 1\n2 3","READY"]]
},
{
example:"In the first sample, direct link `0 -> 2` costs `9`, but `0 -> 1 -> 2` costs `2 + 3 = 5`. Print `5`. The second sample has no route, so print `-1`.",
title:"Heavy Shortcut",
difficulty:24,
guide:"`cost` stores direct-link prices, with `0` meaning no link. `middle` is a possible intermediate box. `candidate` is a tested route's price, and `best` tracks the answer.",
incident:"AEGIS has disrupted delivery prices. Ishan checks routes that use at most two links.",
symptom:"A cheaper two-link route can be ignored after another route has already been found.",
task:"Find the minimum total price from `s` (the start) to `t` (the target) using at most two one-way links. Add the prices of the links used. A route with three or more links is not allowed, even if cheaper. If `s == t`, use no links and return `0`. Return `-1` if no allowed route exists.",
input:"1. Read `n` (the number of boxes) and `m` (the number of links).\n2. Read `m` triples `u v price`: sender, destination, and positive link price.\n3. Read `s t`, the start and target.",
output:"Print the minimum total price using zero, one, or two links, or `-1` if no such route exists.",
constraints:"`1 <= n <= 20`; `0 <= m <= 80`; `1 <= price <= 100`. Boxes are numbered `0` through `n - 1`. No directed link is repeated.",
defect:"A cheaper two-link route never replaces a previously found route.",
hints:["Compare the direct route and the two-link route in the first sample.","`best` may already hold a valid price when a cheaper `candidate` is found.","Replace `best` whenever `candidate < best`. Do not limit replacement to the case where no route has yet been found."],
c:`int n,m; READ(n); READ(m); ARRAY(cost,400);
for(int i=0;i<m;i++){
    int u,v,price; READ(u); READ(v); READ(price);
    cost[u*n+v]=price;
}
int s,t; READ(s); READ(t);
int best=1000000;
if(cost[s*n+t]>0) best=cost[s*n+t];
if(s==t) best=0;
for(int middle=0;middle<n;middle++){
    if(cost[s*n+middle]>0 && cost[middle*n+t]>0){
        int candidate=cost[s*n+middle]+cost[middle*n+t];
        if(candidate<best) best=candidate;
    }
}
if(best==1000000) best=-1;
OUT(best);`,
py:`n, m = read_int(), read_int()
cost = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v, price = read_int(), read_int(), read_int()
    cost[u][v] = price
s, t = read_int(), read_int()
best = 1000000
if cost[s][t] > 0:
    best = cost[s][t]
if s == t:
    best = 0
for middle in range(n):
    if cost[s][middle] > 0 and cost[middle][t] > 0:
        candidate = cost[s][middle] + cost[middle][t]
        if candidate < best:
            best = candidate
print(-1 if best == 1000000 else best)`,
cbug:["candidate<best","best==1000000"],
pybug:["candidate < best","best == 1000000"],
cases:[["3 3\n0 2 9\n0 1 2\n1 2 3\n0 2","5"],["2 0\n0 1","-1"],["1 0\n0 0","0"],["3 3\n1 2 2\n0 1 3\n0 2 9\n0 2","5"],["3 2\n0 1 8\n1 2 7\n0 2","15"],["3 3\n0 2 1\n0 1 2\n1 2 3\n0 2","1"],["4 4\n0 3 20\n0 1 1\n1 2 1\n2 3 1\n0 3","20"],["4 3\n0 1 1\n1 2 1\n2 3 1\n0 3","-1"]]
},
{
example:"In the first sample, requests `0 1` and `2 3` form two groups. Request `0 2` joins them, so print `1`. With no requests in the second sample, the three boxes remain separate, so print `3`.",
title:"Rerouted Parent",
difficulty:27,
guide:"`group` stores a label for each box. Each request saves `old_group` and `new_group` (the endpoint labels). The final loop counts labels still in use.",
incident:"AEGIS has disrupted the network groups. Ishan checks groups formed by connection requests.",
symptom:"A request can move one box to another group while leaving its connected boxes behind.",
task:"Start with `n` separate boxes. Process each two-way connection request `u v` in input order. All boxes connected by any sequence of these connections belong to one group. Print the final number of groups. An isolated box is one group. A repeated connection, or a connection within one group, does not change the count.",
input:"1. Read `n` (the number of boxes) and `m` (the number of requests).\n2. Read `m` pairs `u v`, the boxes to connect.",
output:"Print one integer: the final number of connected groups.",
constraints:"`1 <= n <= 20`; `0 <= m <= 50`. Boxes are numbered `0` through `n - 1`.",
defect:"Joining two labelled groups changes only the input box rather than every member of its group.",
hints:["After connecting `0` to `1`, should connecting `0` to `2` leave box `1` behind?","Several entries in `group` (the box labels) may share `old_group`, the group being joined.","In the relabelling loop, test `group[box] == old_group` and change every match. Testing only `box == u` moves just the named box."],
c:`int n,m; READ(n); READ(m); ARRAY(group,20);
for(int box=0;box<n;box++) group[box]=box;
for(int request=0;request<m;request++){
    int u,v; READ(u); READ(v);
    int old_group=group[u],new_group=group[v];
    for(int box=0;box<n;box++){
        if(group[box]==old_group) group[box]=new_group;
    }
}
ARRAY(seen,20); int count=0;
for(int box=0;box<n;box++){
    if(seen[group[box]]==0){
        seen[group[box]]=1;
        count++;
    }
}
OUT(count);`,
py:`n, m = read_int(), read_int()
group = list(range(n))
for _ in range(m):
    u, v = read_int(), read_int()
    old_group, new_group = group[u], group[v]
    for box in range(n):
        if group[box] == old_group:
            group[box] = new_group
seen = [0] * n
count = 0
for box in range(n):
    if seen[group[box]] == 0:
        seen[group[box]] = 1
        count += 1
print(count)`,
cbug:["group[box]==old_group","box==u"],
pybug:["group[box] == old_group","box == u"],
cases:[["4 3\n0 1\n2 3\n0 2","1"],["3 0","3"],["1 2\n0 0\n0 0","1"],["5 3\n0 1\n1 2\n0 3","2"],["4 4\n0 1\n1 2\n2 3\n0 3","1"],["6 4\n0 1\n2 3\n4 5\n0 2","2"]]
},
{
example:"The first sample is chain `0-1-2-3-4` with transmitters at `0` and `4`. Print `0 1 2 1 0`. In the second sample, boxes `0` and `2` are transmitters but box `1` cannot reach either, so print `0 -1 0`.",
title:"Rescue Origins",difficulty:36,
guide:"`sources` lists transmitter boxes. `dist` stores distances, with `-1` meaning not reached. `queue` lists boxes waiting to be explored.",
incident:"AEGIS has disrupted messages. Mira uses several transmitters to reach the relay boxes.",
symptom:"Transmitters listed after the first can be ignored.",task:"For every box, find the fewest two-way cable steps to any listed transmitter. A transmitter's own distance is `0`. If several transmitters tie, print only that distance. Print `-1` for a box that cannot reach any transmitter.",input:"1. Read `n` (the number of boxes) and `m` (the number of cables).\n2. Read `m` pairs `u v`, the endpoints of each two-way cable.\n3. Read `k` (the number of transmitters), then `k` different box numbers for `sources`.",output:"Print `n` distances separated by spaces, for boxes `0` through `n - 1` in order.",constraints:"`1 <= n <= 20`; `0 <= m <= 40`; `1 <= k <= n`. Boxes are numbered `0` through `n - 1`. Transmitter numbers are distinct. No cable is repeated or joins a box to itself.",
defect:"Only the first source is included in the multi-source traversal.",hints:["With two isolated transmitter boxes, what distance should each box report?","Every listed transmitter is working before the search begins.","Add every entry of `sources` to the initial `queue`, and give each transmitter distance `0` in `dist`."],
c:edges+`\nint k; READ(k); ARRAY(sources,20); for(int i=0;i<k;i++){ READ(sources[i]); }
ARRAY(dist,20); ARRAY(queue,20); for(int i=0;i<n;i++) dist[i]=-1;
int head=0,tail=0;
for(int i=0;i<k;i++){ dist[sources[i]]=0; queue[tail++]=sources[i]; }
while(head<tail){ int u=queue[head++]; for(int v=0;v<n;v++) if(adj[u*n+v]==1 && dist[v]==-1){ dist[v]=dist[u]+1; queue[tail++]=v; } }
for(int i=0;i<n;i++){ OUT(dist[i]); }`,
py:pyedges+`\nk = read_int()
sources = [read_int() for _ in range(k)]
dist = [-1] * n
queue = []
for source in sources:
    dist[source] = 0
    queue.append(source)
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and dist[v] == -1:
            dist[v] = dist[u] + 1
            queue.append(v)
print(*dist)`,cbug:["i<k;i++){ dist[sources","i<1;i++){ dist[sources"],pybug:["for source in sources:","for source in sources[:1]:"],cases:[["5 4\n0 1\n1 2\n2 3\n3 4\n2 0 4","0 1 2 1 0"],["3 0\n2 0 2","0 -1 0"],["1 0\n1 0","0"],["4 2\n0 1\n2 3\n2 0 2","0 1 0 1"],["3 2\n0 1\n1 2\n3 0 1 2","0 0 0"],["4 3\n0 1\n1 2\n2 3\n1 3","3 2 1 0"]]
},
{
example:"In the first sample, three cables form a triangle. Any single cut leaves another route, so print `0`. In the second sample, either cable of chain `0-1-2` disconnects it, so print `2`.",
title:"Critical Link Audit",difficulty:40,
guide:"Cable endpoints are stored in `eu` and `ev` in C, C++ and Java; in `edges` in Python. Each test changes `adj` (the connection table), runs a search, and updates `bridges` (the answer).",
incident:"AEGIS may cut a cable. Ishan checks which single cuts would disconnect the network.",
symptom:"Later tests can report a disconnection caused by cuts from earlier tests.",task:"Test each cable separately by removing only that cable from the original two-way network. Count cables whose removal makes some boxes unable to reach each other. Every test is independent. A one-box network with no cables has answer `0`.",input:"1. Read `n` (the number of boxes) and `m` (the number of cables).\n2. Read `m` pairs of box numbers, the endpoints of each two-way cable.",output:"Print one integer: the number of cables whose individual removal disconnects the original network.",constraints:"`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. The original network is connected. No cable is repeated or joins a box to itself.",
defect:"A temporarily removed edge is not restored before testing the next edge.",hints:["Try the triangle in the first sample: every single cut is safe.","Check whether `adj` (the connection table) is the same at the start of every test.","After each search, restore the tested cable in both directions in `adj` before testing the next cable."],
c:`int n,m; READ(n); READ(m); ARRAY(adj,400); ARRAY(eu,40); ARRAY(ev,40);
for(int i=0;i<m;i++){ READ(eu[i]); READ(ev[i]); adj[eu[i]*n+ev[i]]=1; adj[ev[i]*n+eu[i]]=1; }
int bridges=0;
for(int e=0;e<m;e++){
    int a=eu[e],b=ev[e]; adj[a*n+b]=0; adj[b*n+a]=0;
    ARRAY(seen,20); ARRAY(queue,20); for(int i=0;i<n;i++) seen[i]=0;
    int head=0,tail=0; queue[tail++]=0; seen[0]=1;
    while(head<tail){ int u=queue[head++]; for(int v=0;v<n;v++) if(adj[u*n+v]==1 && seen[v]==0){ seen[v]=1; queue[tail++]=v; } }
    if(tail<n) bridges++;
    adj[a*n+b]=1; adj[b*n+a]=1;
}
OUT(bridges);`,
py:`n, m = read_int(), read_int()
edges = [(read_int(), read_int()) for _ in range(m)]
adj = [[0] * n for _ in range(n)]
for u, v in edges:
    adj[u][v] = adj[v][u] = 1
bridges = 0
for a, b in edges:
    adj[a][b] = adj[b][a] = 0
    seen = [0] * n
    queue = [0]
    seen[0] = 1
    for u in queue:
        for v in range(n):
            if adj[u][v] == 1 and seen[v] == 0:
                seen[v] = 1
                queue.append(v)
    if len(queue) < n:
        bridges += 1
    adj[a][b] = adj[b][a] = 1
print(bridges)`,cbug:["adj[a*n+b]=1; adj[b*n+a]=1;",""],pybug:["    adj[a][b] = adj[b][a] = 1\n",""],cases:[["3 3\n0 1\n1 2\n2 0","0"],["3 2\n0 1\n1 2","2"],["1 0","0"],["4 4\n0 1\n1 2\n2 0\n2 3","1"],["4 4\n0 1\n1 2\n2 3\n3 0","0"],["2 1\n0 1","1"]]
}
];
