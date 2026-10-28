export const silicon = [
{
example:"Input `100 30` means the battery starts with 100 units and spends 30. The output is `70`.",
title:"Stolen Charge",difficulty:3,
guide:"`capacity` is the starting charge. `used` is the charge spent. `remaining` is the amount to print.",
incident:"Patch needs to measure the battery charge left after a repair.",
symptom:"Spending charge can make the reported amount increase.",task:"A battery starts with `capacity` units of charge. A repair spends `used` units. Print the charge left after the repair.",input:"1. Read `capacity`, the starting charge.\n2. Read `used`, the charge spent.",output:"Print one integer: the charge left.",constraints:"`0 <= capacity <= 10000`. `0 <= used <= capacity`.",
defect:"Consumed charge is added instead of subtracted.",hints:["Try spending all the starting charge. What should remain?","Check whether `remaining` grows or shrinks when `used` increases.","Set `remaining` to `capacity - used`. Spending the full charge must leave `0`."],
c:`int capacity,used; READ(capacity); READ(used); int remaining=capacity-used; OUT(remaining);`,
py:`capacity, used = read_int(), read_int()
remaining = capacity - used
print(remaining)`,cbug:["capacity-used","capacity+used"],pybug:["capacity - used","capacity + used"],cases:[["100 30","70"],["8 8","0"],["0 0","0"],["99 0","99"],["10000 1","9999"],["5 4","1"]]
},
{
example:"For input `3 8`, the output is `8 3`.",
title:"Crossed Airlocks",difficulty:5,
guide:"`a` and `b` hold the codes. `saved` keeps one original code while the assignments run.",
incident:"Mira needs to exchange two stored door codes.",
symptom:"The program can print the same code twice when the inputs differ.",task:"Swap the two input integers. Print the original second value, then the original first value.",input:"Read `a`, the first code, then `b`, the second code.",output:"Print two integers: the original value of `b`, then the original value of `a`.",constraints:"`-10000 <= a, b <= 10000`.",
defect:"The second assignment uses an already overwritten value instead of the saved temporary value.",hints:["Trace two different codes through each assignment.","After `a = b`, where is the original value of `a` still stored?","The last assignment must copy `saved` into `b`, because `a` has already changed."],
c:`int a,b; READ(a); READ(b); int saved=a; a=b; b=saved; OUT(a); OUT(b);`,
py:`a, b = read_int(), read_int()
saved = a
a = b
b = saved
print(a, b)`,cbug:["b=saved","b=a"],pybug:["b = saved","b = a"],cases:[["3 8","8 3"],["-2 9","9 -2"],["0 0","0 0"],["1 0","0 1"],["-8 -4","-4 -8"],["10000 -10000","-10000 10000"]]
},
{
example:"For input `11 5`, pack 5, 5 and 1 units. The output is `3`.",
title:"The Final Battery",difficulty:7,
guide:"`amount` is the total charge. `size` is one battery's capacity. A battery counts even when partly full.",
incident:"Patch must pack spare charge into batteries.",
symptom:"The count can be too small when the charge does not divide evenly.",task:"Print the fewest batteries that can hold `amount` units of charge. Each holds at most `size` units. Zero charge needs zero batteries.",input:"Read `amount`, the charge to pack, then `size`, the capacity of each battery.",output:"Print one integer: the number of batteries needed.",constraints:"`0 <= amount <= 10000`. `1 <= size <= 1000`.",
defect:"Integer division rounds down when a partial final battery must be counted.",hints:["Try one unit more than a full battery can hold.","Whole-number division counts full batteries. What happens to any charge left over?","Count the full batteries and add one if the remainder is nonzero. Equivalently use `(amount + size - 1) / size` in C, C++ and Java; `(amount + size - 1) // size` in Python."],
c:`int amount,size; READ(amount); READ(size); int batteries=(amount+size-1)/size; OUT(batteries);`,
py:`amount, size = read_int(), read_int()
batteries = (amount + size - 1) // size
print(batteries)`,cbug:["(amount+size-1)/size","amount/size"],pybug:["(amount + size - 1) // size","amount // size"],cases:[["11 5","3"],["10 5","2"],["0 7","0"],["1 8","1"],["10000 3","3334"],["7 1","7"]]
},
{
example:"For input `3 4 8 2`, the list has three values. The output is `4 8 2`.",
title:"Reversed Backup",difficulty:10,
guide:"`live` holds the input list. `backup` starts filled with zeros. `i` is a position in either list, starting at 0.",
incident:"Mira needs a backup of a memory list before repairs begin.",
symptom:"The copy can erase input values and leave the backup unchanged.",task:"Copy every value in `live` to the same position in the separate list `backup`. Keep `live` unchanged. Print `backup` in input order.",input:"1. Read `n`, the number of values.\n2. Read the `n` values of `live` in order.",output:"Print the `n` backup values in their original order.",constraints:"`1 <= n <= 100`. Each value is from -1000 through 1000.",
defect:"The copy assignment sends the empty backup into the live bank rather than copying live data into the backup.",hints:["Which list already contains the values to save?","An assignment reads its right side and writes its left side.","At each position `i`, assign `live[i]` to `backup[i]`, leaving `live[i]` unchanged."],
c:`int n; READ(n); ARRAY(live,100); ARRAY(backup,100);
for(int i=0;i<n;i++){ READ(live[i]); }
for(int i=0;i<n;i++){ backup[i]=live[i]; }
for(int i=0;i<n;i++){ OUT(backup[i]); }`,
py:`n = read_int()
live = [read_int() for _ in range(n)]
backup = [0] * n
for i in range(n):
    backup[i] = live[i]
print(*backup)`,cbug:["backup[i]=live[i]","live[i]=backup[i]"],pybug:["backup[i] = live[i]","live[i] = backup[i]"],cases:[["3\n4 8 2","4 8 2"],["1\n9","9"],["3\n0 0 0","0 0 0"],["2\n-1 5","-1 5"],["4\n9 3 2 1","9 3 2 1"],["2\n1000 -1000","1000 -1000"]]
},
{
example:"Input `2 2 3 4 1 5` gives two batches: readings 3 and 4, then reading 5. The output is `7 5`.",
title:"Residue Meter",difficulty:12,
guide:"`t` counts batches. Each batch has `n` readings. `total` holds the sum printed for that batch.",
incident:"Patch needs a separate power total for each repair batch.",
symptom:"A later batch's result can include readings from earlier batches.",task:"For each batch, add only that batch's readings. Print one sum per batch in input order.",input:"1. Read `t`, the number of batches.\n2. For each batch, read `n`, then its `n` readings.",output:"Print `t` integer sums in batch order, separated by spaces.",constraints:"`1 <= t <= 20`. Each batch has `1 <= n <= 20`. Each reading is from 0 through 100.",
defect:"The per-batch accumulator is not reset between batches.",hints:["Try two batches with one reading each.","Check `total` just before the first reading of a later batch.","Set `total` to `0` at the start of each batch, before adding its readings."],
c:`int t; READ(t); int total=0;
for(int batch=0;batch<t;batch++){
    int n; READ(n); total=0;
    for(int i=0;i<n;i++){ int value; READ(value); total+=value; }
    OUT(total);
}`,
py:`t = read_int()
total = 0
result = []
for _ in range(t):
    n = read_int()
    total = 0
    for _ in range(n):
        total += read_int()
    result.append(total)
print(*result)`,cbug:["READ(n); total=0;","READ(n);"],pybug:["    total = 0\n",""],cases:[["2\n2 3 4\n1 5","7 5"],["1\n3 1 2 3","6"],["3\n1 1\n1 2\n1 3","1 2 3"],["2\n1 0\n1 0","0 0"],["2\n2 100 100\n2 1 1","200 2"],["3\n1 9\n1 0\n1 1","9 0 1"]]
},
{
example:"For input `15 3`, the binary patterns are `1111` and `0011`. The result is binary `1100`, so the output is `12`.",
title:"Permission Fuse",difficulty:18,
guide:"A bit is a binary digit, either 0 or 1. `flags` stores the settings as bits. `clear_mask` marks which bit positions to clear.",
incident:"Mira needs to switch off selected machine settings.",
symptom:"The program can turn marked bits on instead of clearing them.",task:"At every position where `clear_mask` has a 1 bit, set the corresponding bit of `flags` to 0. Leave every other bit unchanged. Print the resulting integer.",input:"Read `flags`, the current settings, then `clear_mask`, the bit pattern marking settings to turn off.",output:"Print one integer: the settings after clearing the marked bits.",constraints:"`0 <= flags, clear_mask <= 255`.",
defect:"Bitwise OR sets masked bits instead of clearing them.",hints:["Try clearing a marked bit that is already on.","A result bit stays on only when it was on in `flags` and is not marked in `clear_mask`.","Use `flags & ~clear_mask`: `~` reverses the mask bits, and `&` keeps bits present in both patterns."],
c:`int flags,clear_mask; READ(flags); READ(clear_mask); int result=flags & ~clear_mask; OUT(result);`,
py:`flags, clear_mask = read_int(), read_int()
result = flags & ~clear_mask
print(result)`,cbug:["flags & ~clear_mask","flags | clear_mask"],pybug:["flags & ~clear_mask","flags | clear_mask"],cases:[["15 3","12"],["8 1","8"],["0 255","0"],["255 255","0"],["19 0","19"],["170 85","170"]]
},
{
example:"For input `1 0`, the output is `1`. For input `0 1`, it is `256`.",
title:"Wire Order",difficulty:12,
guide:"A byte is an integer from 0 through 255. `low` counts single units; `high` counts groups of 256.",
incident:"Patch receives a port number as two bytes.",
symptom:"The program gives the two bytes the wrong place values.",task:"Decode the two bytes as `low + 256 * high`. The low byte arrives first.",input:"Read `low`, the low byte, then `high`, the high byte.",output:"Print one integer: the decoded number.",constraints:"`0 <= low, high <= 255`.",
defect:"The two byte weights are reversed.",hints:["Compare input `1 0` with input `0 1`.","Which input counts groups of 256?","Multiply `high` by `256`, then add `low`."],
c:`int low,high; READ(low); READ(high); int value=low+256*high; OUT(value);`,
py:`low, high = read_int(), read_int()
value = low + 256 * high
print(value)`,cbug:["low+256*high","256*low+high"],pybug:["low + 256 * high","256 * low + high"],cases:[["1 0","1"],["0 1","256"],["255 255","65535"],["0 0","0"],["5 2","517"],["128 1","384"]]
},
{
example:"For input `3 6 1 7 1 8 1 9 2 2 2`, add 7, 8, 9, then remove three times. The output is `7 8 9`.",
title:"Ring Courier",difficulty:28,
guide:"A queue removes the oldest item first. The circular list `buffer` reuses positions after removal. `head` is the next removal position, `tail` the next insertion position, and `count` the number waiting.",
incident:"Patch keeps parcels in a delivery queue.",
symptom:"Several additions in a row can overwrite a parcel still in the queue.",task:"Start with an empty queue holding at most `c` values. Process operations in order. `1 x` adds value `x` at the back if there is room; otherwise ignore it. `2` removes and prints the oldest value, or prints `-1` if empty. If there are no removal operations, print `EMPTY`.",input:"1. Read `c`, the capacity, and `q`, the number of operations.\n2. Read `q` operations, each written as `1 x` or `2`.",output:"Print one integer for each operation `2`, in order. If there are none, print `EMPTY`.",constraints:"`1 <= c <= 8`. `1 <= q <= 50`. `0 <= x <= 99`. Each operation is `1` or `2`.",
defect:"The enqueue cursor advances from head rather than its own tail position.",hints:["Add three different values before removing any.","Check which position changes after an insertion. Insertion and removal use different positions.","After writing at `tail`, advance it with `(tail + 1) % c`, not from `head`. This wraps it to 0 after the final position."],
c:`int c,q; READ(c); READ(q); ARRAY(buffer,8); int head=0,tail=0,count=0,printed=0;
for(int i=0;i<q;i++){
    int op; READ(op);
    if(op==1){ int x; READ(x); if(count<c){ buffer[tail]=x; tail=(tail+1)%c; count++; } }
    else{ if(count==0){ OUT(-1); }else{ OUT(buffer[head]); head=(head+1)%c; count--; } printed++; }
}
if(printed==0){ SAY("EMPTY"); }`,
py:`c, q = read_int(), read_int()
buffer = [0] * c
head = tail = count = 0
result = []
for _ in range(q):
    op = read_int()
    if op == 1:
        x = read_int()
        if count < c:
            buffer[tail] = x
            tail = (tail + 1) % c
            count += 1
    elif count == 0:
        result.append(-1)
    else:
        result.append(buffer[head])
        head = (head + 1) % c
        count -= 1
if result:
    print(*result)
else:
    print("EMPTY")`,cbug:["tail=(tail+1)%c","tail=(head+1)%c"],pybug:["tail = (tail + 1) % c","tail = (head + 1) % c"],cases:[["3 6\n1 7\n1 8\n1 9\n2\n2\n2","7 8 9"],["1 3\n2\n1 6\n2","-1 6"],["2 6\n1 1\n1 2\n1 3\n2\n2\n2","1 2 -1"],["3 2\n1 1\n1 2","EMPTY"],["2 7\n1 1\n2\n1 2\n1 3\n2\n2\n2","1 2 3 -1"],["4 8\n1 5\n1 6\n1 7\n1 8\n2\n2\n2\n2","5 6 7 8"]]
},
{
example:"For input `5 0 1 3 1 2 3 4 5`, copy three values from position 0 to position 1. The output is `1 1 2 3 5`.",
title:"Overlapping Transfer",difficulty:26,
guide:"`a` is the memory list. `src` and `dst` are the source and destination start positions. `length` is the number of values to copy.",
incident:"Mira needs to copy values to a later position in one memory list.",
symptom:"Overlapping copies can repeat a changed value instead of copying the original values.",task:"Copy `length` values starting at `src` to the positions starting at `dst`. Use the source values from before the copy began, even when the ranges overlap. Leave every position outside the destination range unchanged.",input:"1. Read `n`, the list length, then `src`, `dst` and `length`.\n2. Read the `n` values of `a`. Positions start at 0.",output:"Print all `n` values after the copy, in position order.",constraints:"`2 <= n <= 100`. `0 <= src < dst < n`. `length >= 1`, `src + length <= n` and `dst + length <= n`. Values are from -100 through 100.",
defect:"An overlapping rightward copy runs forwards instead of backwards.",hints:["Trace the public sample and note when an original source value is overwritten.","Which end can be copied first without destroying a value still needed?","Since `dst > src`, copy from index `length - 1` down to `0`, assigning `a[src + i]` to `a[dst + i]`."],
c:`int n,src,dst,length; READ(n); READ(src); READ(dst); READ(length); ARRAY(a,100);
for(int i=0;i<n;i++){ READ(a[i]); }
for(int i=length-1;i>=0;i--){ a[dst+i]=a[src+i]; }
for(int i=0;i<n;i++){ OUT(a[i]); }`,
py:`n, src, dst, length = read_int(), read_int(), read_int(), read_int()
a = [read_int() for _ in range(n)]
for i in range(length - 1, -1, -1):
    a[dst + i] = a[src + i]
print(*a)`,cbug:["int i=length-1;i>=0;i--","int i=0;i<length;i++"],pybug:["range(length - 1, -1, -1)","range(length)"],cases:[["5 0 1 3\n1 2 3 4 5","1 1 2 3 5"],["4 0 2 2\n1 2 3 4","1 2 1 2"],["2 0 1 1\n8 9","8 8"],["6 1 2 4\n0 1 2 3 4 5","0 1 1 2 3 4"],["5 0 1 4\n-1 -2 -3 -4 -5","-1 -1 -2 -3 -4"],["4 1 3 1\n0 7 8 9","0 7 8 7"]]
},
{
example:"For input `3 1 4 2 4 2 4`, claim resource 4 and release it twice. The output is `0`; the second release changes nothing.",
title:"Ownership Leak",difficulty:16,
guide:"`owned` records each resource's state. `count` is the number owned. The resource ID is `id` in C, C++ and Java; `resource` in Python.",
incident:"Patch tracks which resources are currently owned.",
symptom:"Releasing the same resource twice can make the count too small or negative.",task:"All resources start free. Each command gives an operation and a resource ID. Operation `1` claims the resource if free; claiming one already owned changes nothing. Operation `2` releases it if owned; releasing one already free changes nothing. Process commands in order and print the final number owned.",input:"1. Read `q`, the number of commands.\n2. Read `q` pairs: operation `op`, then the resource ID, named `id` in C, C++ and Java; `resource` in Python.",output:"Print one integer: the final number of owned resources.",constraints:"`1 <= q <= 100`. Resource IDs are from 0 through 99. `op` is `1` or `2`.",
defect:"Release decrements the count without checking whether the resource is owned.",hints:["What should releasing an already free resource do?","Check whether the release actually changes the state stored in `owned`.","Reduce `count` only when the resource's state is `1`: `owned[id]` in C, C++ and Java; `owned[resource]` in Python. Then set that state to `0`."],
c:`int q; READ(q); ARRAY(owned,100); int count=0;
for(int i=0;i<q;i++){ int op,id; READ(op); READ(id);
    if(op==1){ if(owned[id]==0){ owned[id]=1; count++; } }
    else if(owned[id]==1){ owned[id]=0; count--; }
}
OUT(count);`,
py:`q = read_int()
owned = [0] * 100
count = 0
for _ in range(q):
    op, resource = read_int(), read_int()
    if op == 1:
        if owned[resource] == 0:
            owned[resource] = 1
            count += 1
    elif owned[resource] == 1:
        owned[resource] = 0
        count -= 1
print(count)`,cbug:["else if(owned[id]==1)","else"],pybug:["elif owned[resource] == 1:","else:"],cases:[["3\n1 4\n2 4\n2 4","0"],["3\n1 1\n1 2\n1 1","2"],["1\n2 9","0"],["4\n1 0\n2 0\n1 0\n1 99","2"],["2\n1 3\n2 3","0"],["5\n2 1\n2 1\n1 2\n1 3\n2 2","1"]]
},
{
example:"For input `255`, the output is `-1`. Input `128` would give `-128`.",
title:"Signed Sensor",difficulty:14,
guide:"A byte stores 256 possible bit patterns. Here `b` is read as 0 through 255, then displayed as a signed 8-bit integer, which ranges from -128 through 127.",
incident:"Patch needs to display a sensor byte as a signed number.",
symptom:"Inputs representing negative values produce the wrong signed numbers.",task:"Convert `b` to a signed 8-bit integer. Values 0 through 127 stay unchanged. Values 128 through 255 represent -128 through -1, respectively.",input:"Read `b`, the stored byte value.",output:"Print one signed integer from -128 through 127.",constraints:"`0 <= b <= 255`.",
defect:"The signed conversion subtracts 128 rather than 256.",hints:["Check the results for inputs `127`, `128` and `255`.","The upper half of the input range must become 128 different negative values, ending at `-1`.","When `b >= 128`, subtract `256`. Keep smaller values unchanged."],
c:`int b; READ(b); if(b>=128) b-=256; OUT(b);`,
py:`b = read_int()
if b >= 128:
    b -= 256
print(b)`,cbug:["b-=256","b-=128"],pybug:["b -= 256","b -= 128"],cases:[["255","-1"],["128","-128"],["0","0"],["127","127"],["129","-127"],["200","-56"]]
},
{
example:"For input `2 5 1 2 1 3 1`, pages 1, 2 and 3 cause misses. The last request is a hit, so the output is `3`.",
title:"Cache Rebellion",difficulty:34,
guide:"A cache holds pages for reuse. A page is a numbered block of data. A hit finds the requested page already stored; a miss needs a load. `page` stores page IDs and `time` stores their last request positions.",
incident:"Patch needs to count page loads in a small cache.",
symptom:"The cache can remove a recently used page while keeping one unused for longer.",task:"Start with an empty cache of capacity `c`. Process requests in order. A hit makes that page most recently used. A miss loads the page into the lowest-numbered empty slot, or, if full, replaces the page whose last request was earliest. A load also makes its page most recently used. Print the number of misses.",input:"1. Read `c`, the cache capacity, and `n`, the number of requests.\n2. Read the `n` requested page IDs.",output:"Print one integer: the number of cache misses.",constraints:"`1 <= c <= 8`. `1 <= n <= 100`. Page IDs are from 0 through 99.",
defect:"Cache-hit timestamps are not refreshed.",hints:["In the sample, which page should leave when page 3 arrives?","Check how a hit changes that page's last-use value in `time`.","On a hit, set `time[found]` to the current request index `i`, just as a load records the current time."],
c:`int c,n; READ(c); READ(n); ARRAY(page,8); ARRAY(time,8);
for(int j=0;j<c;j++){ page[j]=-1; time[j]=-1; }
int misses=0;
for(int i=0;i<n;i++){
    int x; READ(x); int found=-1;
    for(int j=0;j<c;j++) if(page[j]==x) found=j;
    if(found>=0){ time[found]=i; }
    else{
        misses++; int slot=0;
        for(int j=1;j<c;j++) if(time[j]<time[slot]) slot=j;
        page[slot]=x; time[slot]=i;
    }
}
OUT(misses);`,
py:`c, n = read_int(), read_int()
page, time = [-1] * c, [-1] * c
misses = 0
for i in range(n):
    x = read_int()
    found = next((j for j in range(c) if page[j] == x), -1)
    if found >= 0:
        time[found] = i
    else:
        misses += 1
        slot = min(range(c), key=lambda j: time[j])
        page[slot] = x
        time[slot] = i
print(misses)`,cbug:["time[found]=i;","time[found]=time[found];"],pybug:["time[found] = i","pass"],cases:[["2 5\n1 2 1 3 1","3"],["1 4\n1 1 2 2","2"],["3 5\n1 2 3 2 1","3"],["2 6\n1 2 1 3 2 1","5"],["2 6\n4 4 4 4 4 4","1"],["3 7\n1 2 3 1 4 1 2","5"]]
},
{
example:"For input `2 0 1 5 1 2 7`, the repairs never overlap. The output is `7`.",
title:"Lifetime Fence",difficulty:20,
guide:"Each repair reserves `units` from `start` until `end`. This is a half-open interval: it includes the start time and excludes the end time. `active` is the total at time `t`; `peak` is the largest total found.",
incident:"Mira needs the largest total resource use in a repair schedule.",
symptom:"Repairs ending and starting at the same time can be counted together.",task:"Find the largest sum of reserved units at any integer time. A repair is active from its start time, including that time, until just before its end time. At its end time, its units are already free for another repair.",input:"1. Read `n`, the number of repairs.\n2. Read `n` triples: `start`, the start time; `end`, the end time; and `units`, the reserved amount.",output:"Print one integer: the greatest total number of units reserved at the same time.",constraints:"`1 <= n <= 40`. `0 <= start < end <= 100`. Times are integers. `1 <= units <= 100`.",
defect:"The interval end is treated as inclusive.",hints:["Are the two repairs in the sample ever active together?","Check whether a repair is still counted at its exact end time.","Count a repair only when `start <= t` and `t < end`. The comparison with `end` must be strict."],
c:`int n; READ(n); ARRAY(start,40); ARRAY(end,40); ARRAY(units,40);
for(int i=0;i<n;i++){ READ(start[i]); READ(end[i]); READ(units[i]); }
int peak=0;
for(int t=0;t<=100;t++){
    int active=0;
    for(int i=0;i<n;i++) if(start[i]<=t && t<end[i]) active+=units[i];
    if(active>peak) peak=active;
}
OUT(peak);`,
py:`n = read_int()
jobs = [(read_int(), read_int(), read_int()) for _ in range(n)]
peak = 0
for t in range(101):
    active = sum(units for start, end, units in jobs if start <= t < end)
    peak = max(peak, active)
print(peak)`,cbug:["t<end[i]","t<=end[i]"],pybug:["start <= t < end","start <= t <= end"],cases:[["2\n0 1 5\n1 2 7","7"],["2\n0 3 4\n1 2 6","10"],["1\n0 100 9","9"],["3\n0 1 1\n1 2 2\n2 3 3","3"],["3\n1 4 3\n2 5 4\n3 6 5","12"],["2\n0 2 8\n2 4 8","8"]]
}
];
