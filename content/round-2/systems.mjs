export const systems = [
{
title:"Aligned Rescue Span", difficulty:25,
incident:"Patch needs working memory inside one listed free range.",
guide:"An address is a byte position. An aligned address is divisible by `alignment`. `candidate` is a possible start. Each half-open range `[left, right)` includes `left` and excludes `right`.",
symptom:"The program can choose a start whose requested bytes extend past the free range.",
task:"Find the lowest byte address divisible by `alignment` where `size` consecutive bytes fit entirely inside one free range. Each range includes its left endpoint and excludes its right endpoint. Bytes skipped before the aligned start use space in that range. A block may end exactly at the right endpoint. Print `-1` if no range can hold it.",
input:"1. Read `n`, the free-range count; `alignment`, the required divisor; and `size`, the bytes needed.\n2. Read `n` pairs `left right`, in increasing order of `left`.",
output:"Print the lowest valid start address, or `-1` if none exists.",
example:"For input `1 4 3 1 7`, start 4 holds bytes 4, 5 and 6. The output is `4`.",
constraints:"`1 <= n <= 40`. `1 <= alignment, size <= 64`. `0 <= left < right <= 1024`. Free ranges do not overlap.",
defect:"The fit check uses the unaligned span start instead of the aligned candidate.",
hints:["An aligned start can still leave too little space.","Compare the space after `candidate` with the space after `left`.","Accept only when `candidate + size <= right`. Keep the first valid result, since ranges arrive in address order."],
c:`int n, alignment, size;
READ(n);
READ(alignment);
READ(size);
int answer = -1;
for (int i = 0; i < n; i++) {
    int left, right;
    READ(left);
    READ(right);
    int candidate = left;
    while (candidate % alignment != 0) {
        candidate++;
    }
    if (answer == -1 && candidate + size <= right) {
        answer = candidate;
    }
}
OUT(answer);`,
py:`n = read_int()
alignment = read_int()
size = read_int()
answer = -1
for _ in range(n):
    left = read_int()
    right = read_int()
    candidate = left
    while candidate % alignment != 0:
        candidate += 1
    if answer == -1 and candidate + size <= right:
        answer = candidate
print(answer)`,
cbug:["candidate + size <= right","left + size <= right"],
pybug:["candidate + size <= right","left + size <= right"],
probe:["2 6 3\n1 7\n12 18", "12"],
cases:[["1 4 3\n1 7","4"],["1 1 2\n0 5","0"],["1 8 4\n1 5","-1"],["2 8 4\n1 5\n8 12","8"],["1 4 1\n4 5","4"],["1 64 64\n960 1024","960"],["2 4 4\n0 3\n5 12","8"],["3 3 2\n1 3\n4 5\n7 8","-1"]], witness:3
},
{
title:"Fragment Tailroom", difficulty:29,
incident:"Ishan needs to divide a message into pieces that fit the link.",
guide:"Payload means message data, excluding the header sent with each fragment. `mtu` limits total fragment bytes, `header` is the header size, and `limit` is the remaining data space. `offset` counts data bytes already sent.",
symptom:"The program can split a final piece that would fit in one fragment.",
task:"Send the message as fragments, each with the given header. Start at byte offset 0. If all remaining data fits within the total fragment limit minus the header size, send it as the final fragment. Otherwise send the largest positive multiple of 8 that fits that data limit, and repeat. Print each fragment's starting offset divided by 8, its data length in bytes, and `1` if more fragments follow or `0` if it is last. Only nonfinal data lengths must be multiples of 8.",
input:"Read `payload`, the message's data length; `mtu`, the total fragment limit; and `header`, the header size in every fragment. All sizes are in bytes.", output:"Print three integers per fragment, in send order: offset in units of 8 bytes, data length, and the more-fragments flag.",
example:"For input `19 20 4`, the data limit is 16 bytes. Send lengths 16 and 3, starting at byte offsets 0 and 16. The output is `0 16 1 2 3 0`.",
constraints:"`1 <= payload <= 256`. `0 <= header <= 40`. `header + 8 <= mtu <= 104`.",
defect:"The final-fragment fit check uses the rounded nonfinal chunk size, discarding legal final tailroom.",
hints:["Does the last fragment need a data length divisible by 8?","Compare a remainder of 19 bytes with `limit = 20` and `chunk = 16`, the rounded nonfinal length.","Test the final remainder against `limit`, not `chunk`. Use `chunk` only when another fragment must follow."],
c:`int payload, mtu, header;
READ(payload);
READ(mtu);
READ(header);
int limit = mtu - header;
int chunk = limit / 8 * 8;
int offset = 0;
while (payload > 0) {
    int take = chunk;
    if (payload <= limit) {
        take = payload;
    }
    OUT(offset / 8);
    OUT(take);
    OUT(payload > take ? 1 : 0);
    offset += take;
    payload -= take;
}`,
py:`payload = read_int()
mtu = read_int()
header = read_int()
limit = mtu - header
chunk = limit // 8 * 8
offset = 0
while payload > 0:
    take = chunk
    if payload <= limit:
        take = payload
    print(offset // 8, take, int(payload > take))
    offset += take
    payload -= take`,
cbug:["payload <= limit","payload <= chunk"], pybug:["payload <= limit","payload <= chunk"],
probe:["21 23 4", "0 16 1 2 5 0"],
cases:[["19 20 4","0 16 1 2 3 0"],["8 8 0","0 8 0"],["19 20 0","0 19 0"],["35 20 0","0 16 1 2 19 0"],["1 48 40","0 1 0"],["32 16 0","0 16 1 2 16 0"],["31 15 0","0 8 1 1 8 1 2 15 0"],["256 104 0","0 104 1 13 104 1 26 48 0"]], witness:3
},
{
title:"Boundary Tag Reunion", difficulty:32,
incident:"Patch frees memory cells and needs the longest free run.",
guide:"A run is a group of consecutive free cells. A boundary tag records run-length information at a run's endpoint. The free-cell flags are `freeCell` in C, C++ and Java; `free_cell` in Python. `span` holds the tags.",
symptom:"Freeing a cell beside an existing run can lose part of that run's length.",
task:"All `m` cells start occupied. Free the listed cells in order. Each cell is listed once. Consecutive free cells form one run. Print the length of the largest run after all releases. Keep the supplied boundary-tag approach, which uses length records at run endpoints to join neighboring runs.",
input:"1. Read `m`, the cell count, and `q`, the release count.\n2. Read the `q` distinct cell indices, starting from 0.", output:"Print the largest free-run length. Print `0` if no cells are freed.",
example:"For input `4 3 0 2 1`, cells 0 through 2 form one run. The output is `3`.",
constraints:"`1 <= m <= 128`. `0 <= q <= m`. Each released index `x` satisfies `0 <= x < m`. No index repeats.",
defect:"The right boundary tag is set to one rather than the merged length, so later left-neighbor merges use stale information.",
hints:["A later release may approach an existing run from either side.","After a merge, compare the tags at `left` and `right`, the merged run's endpoints.","Set both `span[left]` and `span[right]` to `length`, the full merged length. A later release may read either tag."],
c:`int m, q;
READ(m);
READ(q);
ARRAY(freeCell,128);
ARRAY(span,128);
int largest = 0;
for (int i = 0; i < q; i++) {
    int x;
    READ(x);
    int left = x;
    int right = x;
    if (x > 0 && freeCell[x - 1] == 1) {
        left = x - span[x - 1];
    }
    if (x + 1 < m && freeCell[x + 1] == 1) {
        right = x + span[x + 1];
    }
    freeCell[x] = 1;
    int length = right - left + 1;
    span[left] = length;
    span[right] = length;
    if (length > largest) {
        largest = length;
    }
}
OUT(largest);`,
py:`m = read_int()
q = read_int()
free_cell = [0] * m
span = [0] * m
largest = 0
for _ in range(q):
    x = read_int()
    left = x
    right = x
    if x > 0 and free_cell[x - 1] == 1:
        left = x - span[x - 1]
    if x + 1 < m and free_cell[x + 1] == 1:
        right = x + span[x + 1]
    free_cell[x] = 1
    length = right - left + 1
    span[left] = length
    span[right] = length
    largest = max(largest, length)
print(largest)`,
cbug:["span[right] = length;","span[right] = 1;"], pybug:["span[right] = length","span[right] = 1"],
probe:["6 6\n1 3 5 0 2 4", "6"],
cases:[["4 3\n0 2 1","3"],["5 2\n0 4","1"],["5 4\n0 1 2 3","4"],["5 5\n4 3 2 1 0","5"],["1 0","0"],["1 1\n0","1"],["8 7\n0 1 6 7 2 5 3","4"],["8 8\n0 2 4 6 1 5 3 7","8"]], witness:3
},
{
title:"Wrapped Burst Admission", difficulty:35,
incident:"Mira needs to accept each arriving group of values all at once.",
guide:"A queue removes the oldest value first. The circular array `queue` reuses positions after removal. `head` is the front position, `tail` the next insertion position, and `count` the number waiting. A burst is one group of new values.",
symptom:"The queue can reject a burst despite having enough free positions overall.",
task:"Start with an empty queue of capacity `cap`. Values leave oldest first. `1 k` followed by `k` values adds the whole group at the back if at least `k` positions are free. Otherwise discard the whole group and count one rejection. `2 k` removes up to `k` oldest values, removing all if fewer are waiting. Values may wrap from the array's last position to position 0. Print the final rejection count and queue contents.",
input:"1. Read `cap`, the capacity, and `q`, the operation count.\n2. Read `q` operations: `1 k` and its `k` values, or `2 k`.", output:"Print `rejected`, the number of rejected groups; `count`, the queue length; then waiting values from oldest to newest. If empty, print only the first two numbers.",
example:"For input `3 3 1 2 8 9 2 1 1 2 4 5`, the final queue is 9, 4, 5. The output is `0 3 9 4 5`.",
constraints:"`1 <= cap <= 32`. `0 <= q <= 100`. `1 <= k <= 32`. Values are from -100 through 100. Each operation is `1` or `2`.",
defect:"Admission also demands physically contiguous tailroom, although a circular queue can wrap.",
hints:["Append near the array's end, remove some values, then append another group.","Space after `tail` is only part of the free space in a circular queue.","Use `count + k <= cap` for admission. The existing wrap operation already places each accepted value correctly."],
c:`int cap, q;
READ(cap);
READ(q);
ARRAY(queue,32);
int head = 0;
int tail = 0;
int count = 0;
int rejected = 0;
for (int i = 0; i < q; i++) {
    int op, k;
    READ(op);
    READ(k);
    if (op == 1) {
        int accept = count + k <= cap ? 1 : 0;
        if (accept == 0) {
            rejected++;
        }
        for (int j = 0; j < k; j++) {
            int value;
            READ(value);
            if (accept == 1) {
                queue[tail] = value;
                tail = (tail + 1) % cap;
                count++;
            }
        }
    } else {
        int take = k < count ? k : count;
        head = (head + take) % cap;
        count -= take;
    }
}
OUT(rejected);
OUT(count);
for (int i = 0; i < count; i++) {
    OUT(queue[(head + i) % cap]);
}`,
py:`cap = read_int()
q = read_int()
queue = [0] * cap
head = 0
tail = 0
count = 0
rejected = 0
for _ in range(q):
    op = read_int()
    k = read_int()
    if op == 1:
        accept = count + k <= cap
        if not accept:
            rejected += 1
        for _ in range(k):
            value = read_int()
            if accept:
                queue[tail] = value
                tail = (tail + 1) % cap
                count += 1
    else:
        take = min(k, count)
        head = (head + take) % cap
        count -= take
print(rejected, count)
for i in range(count):
    print(queue[(head + i) % cap])`,
cbug:["count + k <= cap ? 1 : 0","count + k <= cap && tail + k <= cap ? 1 : 0"],
pybug:["accept = count + k <= cap","accept = count + k <= cap and tail + k <= cap"],
probe:["3 4\n1 2 10 11\n2 1\n1 2 12 13\n2 1", "0 2 12 13"],
cases:[["3 3\n1 2 8 9\n2 1\n1 2 4 5","0 3 9 4 5"],["2 2\n1 2 1 2\n1 1 3","1 2 1 2"],["4 3\n1 3 1 2 3\n2 2\n1 3 4 5 6","0 4 3 4 5 6"],["1 4\n1 1 -1\n2 5\n1 1 7\n2 1","0 0"],["3 0","0 0"],["2 2\n1 3 8 9 10\n1 1 6","1 1 6"],["5 4\n1 4 1 2 3 4\n2 32\n1 3 -2 0 2\n2 1","0 2 0 2"],["4 4\n2 2\n1 4 4 3 2 1\n2 2\n1 2 7 8","0 4 2 1 7 8"]], witness:3
},
{
title:"Clean Fill, Dirty Ghost", difficulty:38,
incident:"Patch needs to count disk writes caused by replacing stored blocks.",
guide:"A cache stores data blocks for reuse. A hit finds a block already stored; a miss needs a load. A dirty block has been written since loading and needs saving to disk before replacement. This save is a writeback. `valid`, `tag` and `dirty` describe each slot.",
symptom:"Loading a clean block after replacing a dirty one can cause an extra writeback later.",
task:"Start with an empty cache, a set of slots holding blocks for reuse. Each block can use only slot `block % slots`, the remainder after division by `slots`. Process `0 block` as a read and `1 block` as a write. If the requested block is absent, count one miss and load it into its slot. Replacing a dirty block, one written since loading, counts one writeback to disk. The loaded block is clean unless this request is a write. On a hit, a write makes the block dirty; a read leaves its state unchanged. Do not save remaining dirty blocks at the end.",
input:"1. Read `slots`, the number of cache positions, and `q`, the request count.\n2. Read `q` pairs `op block`: operation `op` and block ID `block`.", output:"Print the miss count, then the writeback count.",
example:"For input `1 3 1 0 0 1 0 2`, all requests miss. Only block 0 needs a writeback. The output is `3 1`.",
constraints:"`1 <= slots <= 16`. `0 <= q <= 100`. `0 <= block <= 1000`. `op` is `0` or `1`.",
defect:"A miss retains the evicted block's dirty bit instead of giving the incoming block a clean state.",
hints:["Trace a write followed by two reads of different blocks using the same slot.","Does `dirty` describe the slot forever, or just its current block?","After saving an outgoing dirty block, set the incoming block's dirty state to `0`. Then handle a write request by setting it to `1`."],
c:`int slots, q;
READ(slots);
READ(q);
ARRAY(valid,16);
ARRAY(tag,16);
ARRAY(dirty,16);
int misses = 0;
int writebacks = 0;
for (int i = 0; i < q; i++) {
    int op, block;
    READ(op);
    READ(block);
    int slot = block % slots;
    if (valid[slot] == 0 || tag[slot] != block) {
        misses++;
        if (valid[slot] == 1 && dirty[slot] == 1) {
            writebacks++;
        }
        valid[slot] = 1;
        tag[slot] = block;
        dirty[slot] = 0;
    }
    if (op == 1) {
        dirty[slot] = 1;
    }
}
OUT(misses);
OUT(writebacks);`,
py:`slots = read_int()
q = read_int()
valid = [0] * slots
tag = [0] * slots
dirty = [0] * slots
misses = 0
writebacks = 0
for _ in range(q):
    op = read_int()
    block = read_int()
    slot = block % slots
    if valid[slot] == 0 or tag[slot] != block:
        misses += 1
        if valid[slot] == 1 and dirty[slot] == 1:
            writebacks += 1
        valid[slot] = 1
        tag[slot] = block
        dirty[slot] = 0
    if op == 1:
        dirty[slot] = 1
print(misses, writebacks)`,
cbug:["dirty[slot] = 0;","dirty[slot] = dirty[slot];"], pybug:["dirty[slot] = 0","dirty[slot] = dirty[slot]"],
probe:["3 4\n1 0\n0 3\n0 6\n0 0", "4 1"],
cases:[["1 3\n1 0\n0 1\n0 2","3 1"],["2 3\n0 0\n1 1\n0 0","2 0"],["2 4\n1 0\n0 2\n0 4\n0 6","4 1"],["1 0","0 0"],["1 4\n1 4\n0 4\n1 4\n0 5","2 1"],["2 4\n1 0\n1 1\n0 2\n0 3","4 2"],["1 3\n0 0\n0 1\n0 2","3 0"],["1 4\n1 0\n1 1\n1 2\n1 3","4 3"]], witness:3
},
{
title:"Pinned Cache Refuge", difficulty:41,
incident:"Mira needs to protect selected data while other data is loaded.",
guide:"A cache holds numbered data blocks called pages. A hit finds a stored page; a miss needs a load. A pinned page cannot be removed. `stamp` records last access; `pinned` records protection. The page array is `pageAt` in C, C++ and Java; `page_at` in Python.",
symptom:"Loading a new page can remove a pinned page.",
task:"Start with an empty cache, which stores pages for reuse. Any page can occupy any slot. `0 page` accesses a page. A hit makes it most recently accessed. A miss uses the lowest-numbered empty slot, or replaces the unpinned page whose last access was earliest. Pinning protects a page from replacement. Each successful load starts unpinned and counts once in `loads`. If all slots are full and pinned, count one blocked access and change nothing. `1 page` pins a stored page; `2 page` unpins it. Both do nothing for an absent page and leave access times unchanged.",
input:"1. Read `capacity`, the slot count, and `q`, the operation count.\n2. Read `q` pairs `op page`: operation `op` and page ID `page`.", output:"Print `loads`, the successful-load count; `blocked`, the blocked-access count; then slot contents from index 0 through `capacity - 1`. Use `0` for an empty slot.",
example:"For input `1 3 0 7 1 7 0 8`, page 7 is pinned, so loading page 8 is blocked. The output is `1 1 7`.",
constraints:"`1 <= capacity <= 8`. `0 <= q <= 100`. `1 <= page <= 100`. `op` is `0`, `1` or `2`. Access times use distinct operation positions, so stored pages cannot tie for last access.",
defect:"Victim selection prefers the oldest resident without excluding pinned pages.",
hints:["The page unused for longest may still be protected.","Check which occupied slots can become `victim`, the replacement slot.","Consider only slots with `pinned[j] == 0` when comparing `stamp`. If none qualify, leave `victim` as `-1` so the access is blocked."],
c:`int capacity, q;
READ(capacity);
READ(q);
ARRAY(pageAt,8);
ARRAY(stamp,8);
ARRAY(pinned,8);
int loads = 0;
int blocked = 0;
for (int time = 1; time <= q; time++) {
    int op, page;
    READ(op);
    READ(page);
    int hit = -1;
    int empty = -1;
    for (int j = 0; j < capacity; j++) {
        if (pageAt[j] == page) {
            hit = j;
        }
        if (pageAt[j] == 0 && empty == -1) {
            empty = j;
        }
    }
    if (op != 0) {
        if (hit != -1) {
            pinned[hit] = op == 1 ? 1 : 0;
        }
    } else if (hit != -1) {
        stamp[hit] = time;
    } else {
        int victim = empty;
        if (victim == -1) {
            for (int j = 0; j < capacity; j++) {
                if (pinned[j] == 0 && (victim == -1 || stamp[j] < stamp[victim])) {
                    victim = j;
                }
            }
        }
        if (victim == -1) {
            blocked++;
        } else {
            pageAt[victim] = page;
            stamp[victim] = time;
            pinned[victim] = 0;
            loads++;
        }
    }
}
OUT(loads);
OUT(blocked);
for (int j = 0; j < capacity; j++) {
    OUT(pageAt[j]);
}`,
py:`capacity = read_int()
q = read_int()
page_at = [0] * capacity
stamp = [0] * capacity
pinned = [0] * capacity
loads = 0
blocked = 0
for time in range(1, q + 1):
    op = read_int()
    page = read_int()
    hit = -1
    empty = -1
    for j in range(capacity):
        if page_at[j] == page:
            hit = j
        if page_at[j] == 0 and empty == -1:
            empty = j
    if op != 0:
        if hit != -1:
            pinned[hit] = int(op == 1)
    elif hit != -1:
        stamp[hit] = time
    else:
        victim = empty
        if victim == -1:
            for j in range(capacity):
                if pinned[j] == 0 and (victim == -1 or stamp[j] < stamp[victim]):
                    victim = j
        if victim == -1:
            blocked += 1
        else:
            page_at[victim] = page
            stamp[victim] = time
            pinned[victim] = 0
            loads += 1
print(loads, blocked)
print(*page_at)`,
cbug:["pinned[j] == 0 && (victim == -1 || stamp[j] < stamp[victim])","victim == -1 || stamp[j] < stamp[victim]"],
pybug:["pinned[j] == 0 and (victim == -1 or stamp[j] < stamp[victim])","victim == -1 or stamp[j] < stamp[victim]"],
probe:["2 5\n0 4\n1 4\n0 5\n1 5\n0 6", "2 1 4 5"],
cases:[["1 3\n0 7\n1 7\n0 8","1 1 7"],["2 3\n0 2\n0 3\n0 2","2 0 2 3"],["2 4\n0 1\n0 2\n1 1\n0 3","3 0 1 3"],["2 0","0 0 0 0"],["1 5\n0 4\n1 4\n0 5\n2 4\n0 5","2 1 5"],["2 5\n0 1\n0 2\n0 1\n1 99\n0 3","3 0 1 3"],["2 6\n0 1\n0 2\n1 1\n1 2\n0 3\n0 1","2 1 1 2"],["2 5\n1 9\n0 9\n1 9\n1 9\n0 8","2 0 9 8"]], witness:3
},
{
title:"End-Around Carry", difficulty:43,
incident:"Ishan needs a check value for a list of transmitted numbers.",
guide:"A checksum is a value computed to help detect changes. Each word here is an unsigned 16-bit integer, from 0 through 65535. The running sum is `sum` in C, C++ and Java; `total` in Python.",
symptom:"The checksum can be wrong when the sum exceeds the 16-bit range.",
task:"Add all `n` input words. While the total is above 65535, replace it with the remainder after division by 65536 plus the whole-number quotient of that division. Repeat until the total is at most 65535. The checksum, or check value, is 65535 minus that final total. Under this rule, outputs `0` and `65535` are distinct.",
input:"1. Read `n`, the word count.\n2. Read the `n` words as decimal integers.", output:"Print one decimal integer from 0 through 65535: the checksum.",
example:"For input `2 65535 1`, the sum 65536 becomes 1. The output is `65534`.",
constraints:"`0 <= n <= 100`. Each word is from 0 through 65535. The sum fits a signed 32-bit integer.",
defect:"Folding discards the carry instead of adding it back into the low bits.",
hints:["When a sum exceeds 65535, should the excess high part disappear?","Split the sum into its remainder and whole-number quotient after division by 65536.","Add both parts: `sum % 65536 + sum / 65536` in C, C++ and Java; `total % 65536 + total // 65536` in Python. Repeat before subtracting the result from `65535`."],
c:`int n;
READ(n);
int sum = 0;
for (int i = 0; i < n; i++) {
    int word;
    READ(word);
    sum += word;
}
while (sum > 65535) {
    sum = sum % 65536 + sum / 65536;
}
OUT(65535 - sum);`,
py:`n = read_int()
total = 0
for _ in range(n):
    total += read_int()
while total > 65535:
    total = total % 65536 + total // 65536
print(65535 - total)`,
cbug:["sum % 65536 + sum / 65536","sum % 65536"], pybug:["total % 65536 + total // 65536","total % 65536"],
probe:["3\n65535 65535 65535", "0"],
cases:[["2\n65535 1","65534"],["2\n1 2","65532"],["3\n65535 65535 1","65534"],["0","65535"],["1\n65535","0"],["2\n65535 65535","0"],["3\n65535 65535 2","65533"],["4\n32768 32768 32768 32768","65533"]], witness:3
},
{
title:"C-LOOK Return Journey", difficulty:45,
incident:"Patch needs a disk's service order and total travel distance.",
guide:"A track is a numbered disk position. `head` is the current position, `track` stores requests, and `done` marks serviced requests. C-LOOK is the selection rule defined in the task. `distance` totals head movement.",
symptom:"The service order can be correct while the distance leaves out travel back to lower tracks.",
task:"All requests are waiting initially. A track is a numbered disk position. Repeatedly service the lowest requested track at or above `head`, the current position. If none remains there, service the lowest requested track overall. Equal-track requests use input order. Moving costs the absolute difference from the previous head position, including a move back to a lower track. Set the head to the serviced track. Service itself costs no movement.",
input:"1. Read `n`, the request count, and `head`, the starting track.\n2. Read the `n` requested tracks.", output:"Print the `n` serviced track numbers in service order, then the total movement. If `n` is `0`, print only `0`.",
example:"For input `3 40 10 50 20`, service tracks 50, 10, 20. Travel is 10 + 40 + 10 = 60. The output is `50 10 20 60`.",
constraints:"`0 <= n <= 100`. The starting `head` and requested tracks are integers from 0 through 1000.",
defect:"The wrap branch skips charging the physical seek back to the selected lower track.",
hints:["Choosing a lower track still requires physical movement.","Check whether `distance` changes when `wrapped` says no higher request remained.","Add `movement` to `distance` after every selection, including a wrap, before updating `head`."],
c:`int n, head;
READ(n);
READ(head);
ARRAY(track,100);
ARRAY(done,100);
for (int i = 0; i < n; i++) {
    READ(track[i]);
}
int distance = 0;
for (int step = 0; step < n; step++) {
    int chosen = -1;
    for (int i = 0; i < n; i++) {
        if (done[i] == 0 && track[i] >= head && (chosen == -1 || track[i] < track[chosen])) {
            chosen = i;
        }
    }
    int wrapped = chosen == -1 ? 1 : 0;
    if (wrapped == 1) {
        for (int i = 0; i < n; i++) {
            if (done[i] == 0 && (chosen == -1 || track[i] < track[chosen])) {
                chosen = i;
            }
        }
    }
    int movement = track[chosen] - head;
    if (movement < 0) {
        movement = -movement;
    }
    distance += movement;
    head = track[chosen];
    done[chosen] = 1;
    OUT(head);
}
OUT(distance);`,
py:`n = read_int()
head = read_int()
track = [read_int() for _ in range(n)]
done = [0] * n
distance = 0
for _ in range(n):
    chosen = -1
    for i in range(n):
        if done[i] == 0 and track[i] >= head and (chosen == -1 or track[i] < track[chosen]):
            chosen = i
    wrapped = chosen == -1
    if wrapped:
        for i in range(n):
            if done[i] == 0 and (chosen == -1 or track[i] < track[chosen]):
                chosen = i
    movement = abs(track[chosen] - head)
    distance += movement
    head = track[chosen]
    done[chosen] = 1
    print(head)
print(distance)`,
cbug:["distance += movement;","if (wrapped == 0) {\n        distance += movement;\n    }"],
pybug:["    distance += movement","    if not wrapped:\n        distance += movement"],
probe:["3 6\n1 6 8", "6 8 1 9"],
cases:[["3 40\n10 50 20","50 10 20 60"],["2 0\n3 1","1 3 3"],["1 100\n0","0 100"],["0 75","0"],["3 5\n5 5 5","5 5 5 0"],["4 50\n10 20 60 70","60 70 10 20 90"],["3 1000\n0 500 1000","1000 0 500 1500"],["4 7\n2 9 2 8","8 9 2 2 9"]], witness:3
},
{
title:"Frequency Inheritance", difficulty:48,
incident:"Patch needs to replace stored data according to how often it is used.",
guide:"A cache stores numbered data blocks called pages. A hit finds a stored page; a miss loads it. LFU means least frequently used. `freq` records a stored page's access count and `stamp` its last access time. The page array is `pageAt` in C, C++ and Java; `page_at` in Python.",
symptom:"A newly loaded page can receive the old page's access count.",
task:"Start with an empty cache, which stores pages for reuse. On a hit, increase that page's access count by one and mark its access as most recent. On a miss, use the lowest-numbered empty slot. If full, replace the page with the lowest access count; break a tie by the earliest last access. Each newly loaded page starts with count 1 and the current access time, even if it appeared before. Print misses and final slots.",
input:"1. Read `capacity`, the slot count, and `n`, the access count.\n2. Read the `n` page IDs in access order.", output:"Print the miss count, then slot contents from index 0 through `capacity - 1`. Use `0` for an empty slot.",
example:"For input `2 4 1 1 2 3`, page 1 is used twice, so page 3 replaces page 2. The output is `3 1 3`.",
constraints:"`1 <= capacity <= 8`. `0 <= n <= 100`. Page IDs are from 1 through 100.",
defect:"A replacement increments the victim slot's old frequency instead of starting the new page at one.",
hints:["Should a new page inherit the history of its slot?","Compare a hit with a replacement: only one continues the same page's count.","On every load, set `freq[victim]` to `1`. Increment an existing count only on a hit; keep the last-access tie rule."],
c:`int capacity, n;
READ(capacity);
READ(n);
ARRAY(pageAt,8);
ARRAY(freq,8);
ARRAY(stamp,8);
int misses = 0;
for (int time = 1; time <= n; time++) {
    int page;
    READ(page);
    int hit = -1;
    int victim = -1;
    for (int j = 0; j < capacity; j++) {
        if (pageAt[j] == page) {
            hit = j;
        }
        if (pageAt[j] == 0 && victim == -1) {
            victim = j;
        }
    }
    if (hit != -1) {
        freq[hit]++;
        stamp[hit] = time;
    } else {
        misses++;
        if (victim == -1) {
            victim = 0;
            for (int j = 1; j < capacity; j++) {
                if (freq[j] < freq[victim] || (freq[j] == freq[victim] && stamp[j] < stamp[victim])) {
                    victim = j;
                }
            }
        }
        pageAt[victim] = page;
        freq[victim] = 1;
        stamp[victim] = time;
    }
}
OUT(misses);
for (int j = 0; j < capacity; j++) {
    OUT(pageAt[j]);
}`,
py:`capacity = read_int()
n = read_int()
page_at = [0] * capacity
freq = [0] * capacity
stamp = [0] * capacity
misses = 0
for time in range(1, n + 1):
    page = read_int()
    hit = -1
    victim = -1
    for j in range(capacity):
        if page_at[j] == page:
            hit = j
        if page_at[j] == 0 and victim == -1:
            victim = j
    if hit != -1:
        freq[hit] += 1
        stamp[hit] = time
    else:
        misses += 1
        if victim == -1:
            victim = 0
            for j in range(1, capacity):
                if freq[j] < freq[victim] or (freq[j] == freq[victim] and stamp[j] < stamp[victim]):
                    victim = j
        page_at[victim] = page
        freq[victim] = 1
        stamp[victim] = time
print(misses)
print(*page_at)`,
cbug:["freq[victim] = 1;","freq[victim] += 1;"], pybug:["freq[victim] = 1","freq[victim] += 1"],
probe:["2 6\n4 4 5 6 6 7", "4 7 6"],
cases:[["2 4\n1 1 2 3","3 1 3"],["2 3\n1 2 1","2 1 2"],["2 7\n1 1 2 3 3 4 5","5 5 3"],["3 0","0 0 0 0"],["1 5\n9 9 8 8 7","3 7"],["2 5\n1 2 3 4 5","5 5 4"],["3 6\n5 6 7 5 6 8","4 5 6 8"],["2 8\n1 1 1 2 3 3 4 5","5 1 5"]], witness:3
},
{
title:"Translation After Remap", difficulty:50,
incident:"Ishan needs address reads to follow the current memory mappings.",
guide:"A virtual page is a numbered group of program bytes. A frame is a same-sized group in physical memory. `mapping` stores current page-to-frame choices. A cache saves translations for reuse. `cached` marks saved entries. Saved frames are in `frameAt` in C, C++ and Java; `frame_at` in Python.",
symptom:"After a mapping changes, a read can still use the page's old physical frame.",
task:"There are `pages` virtual pages, each a fixed-size group of bytes, initially unmapped. A mapping assigns a virtual page to a physical frame of the same size. `1 x y` maps page `x` to frame `y`, replacing any old mapping. `2 x 0` removes page `x`'s mapping. `3 x 0` translates virtual byte address `x`: its page index is the whole-number quotient by page size, and its offset within that page is the remainder. Print the mapped frame number times page size plus that offset, or `-1` if unmapped. Keep the supplied translation cache, which saves mappings for reuse, and make every read follow the latest mapping.",
input:"1. Read `pages`, the page count; the page size, named `pageSize` in C, C++ and Java; `page_size` in Python; then `q`, the operation count.\n2. Read `q` triples `op x y`. For `op = 1`, `x` is a page and `y` a frame. For `op = 2`, `x` is a page and `y` is `0`. For `op = 3`, `x` is an address and `y` is `0`.",
output:"Print one integer per operation `3`, in operation order.",
example:"For input `1 4 4 1 0 2 3 1 0 1 0 5 3 1 0`, address 1 maps first to 9, then to 21. The output is `9 21`.",
constraints:"`1 <= pages <= 32`. Page size is from 1 through 64. `1 <= q <= 100`, with at least one read. Page indices start at 0 and are below `pages`. Frames are from 0 through 1000. Read addresses are nonnegative and less than the page count times page size.",
defect:"A page-table change leaves its cached translation valid.",
hints:["Read the same page before and after a remap or unmap.","Can a saved frame outlive the mapping it describes? Saved frames are in `frameAt` in C, C++ and Java; `frame_at` in Python.","On both map and unmap, set `cached[x]` to `0`. The next read will use the current mapping or report `-1`."],
c:`int pages, pageSize, q;
READ(pages);
READ(pageSize);
READ(q);
ARRAY(mapping,32);
ARRAY(cached,32);
ARRAY(frameAt,32);
for (int i = 0; i < pages; i++) {
    mapping[i] = -1;
}
for (int i = 0; i < q; i++) {
    int op, x, y;
    READ(op);
    READ(x);
    READ(y);
    if (op == 1 || op == 2) {
        mapping[x] = op == 1 ? y : -1;
        cached[x] = 0;
    } else {
        int page = x / pageSize;
        int offset = x % pageSize;
        if (cached[page] == 0 && mapping[page] != -1) {
            cached[page] = 1;
            frameAt[page] = mapping[page];
        }
        if (cached[page] == 1) {
            OUT(frameAt[page] * pageSize + offset);
        } else {
            OUT(-1);
        }
    }
}`,
py:`pages = read_int()
page_size = read_int()
q = read_int()
mapping = [-1] * pages
cached = [0] * pages
frame_at = [0] * pages
for _ in range(q):
    op = read_int()
    x = read_int()
    y = read_int()
    if op == 1 or op == 2:
        mapping[x] = y if op == 1 else -1
        cached[x] = 0
    else:
        page = x // page_size
        offset = x % page_size
        if cached[page] == 0 and mapping[page] != -1:
            cached[page] = 1
            frame_at[page] = mapping[page]
        if cached[page] == 1:
            print(frame_at[page] * page_size + offset)
        else:
            print(-1)`,
cbug:["cached[x] = 0;","cached[x] = cached[x];"], pybug:["cached[x] = 0","cached[x] = cached[x]"],
probe:["2 5 5\n1 1 2\n3 6 0\n1 1 4\n3 9 0\n3 0 0", "11 24 -1"],
cases:[["1 4 4\n1 0 2\n3 1 0\n1 0 5\n3 1 0","9 21"],["2 8 2\n1 1 3\n3 15 0","31"],["1 4 4\n1 0 7\n3 0 0\n2 0 0\n3 3 0","28 -1"],["1 1 1\n3 0 0","-1"],["2 4 5\n1 0 1\n1 1 2\n3 0 0\n1 1 3\n3 1 0","4 5"],["1 64 5\n1 0 1000\n3 63 0\n1 0 0\n3 0 0\n3 63 0","64063 0 63"],["2 2 5\n2 1 0\n3 3 0\n1 1 0\n3 2 0\n3 3 0","-1 0 1"],["1 3 6\n1 0 1\n3 2 0\n2 0 0\n1 0 2\n3 1 0\n3 2 0","5 7 8"]], witness:3
},
{
title:"Recycled Badge Generation", difficulty:53,
incident:"Mira needs old resource badges to stay invalid after a slot is reused.",
guide:"A handle is a numeric badge for one occupant of a slot. `generation` counts successful releases of each slot. `live` records whether it is occupied. A handle is encoded as `generation * slots + slot`.",
symptom:"A badge from an earlier occupant can be accepted after the slot is reused.",
task:"All slots start free with generation 0. A generation number distinguishes successive occupants. A handle encodes it as `generation * slots + slot`. `1 number` allocates slot `number` if free; allocating an occupied slot changes nothing. `2 number` releases the occupant named by handle `number` only if it is current and live, then increases that slot's generation by one. Invalid releases do nothing. `3 number` prints `1` if the handle names the current live occupant, otherwise `0`. Allocation prints nothing.",
input:"1. Read `slots`, the slot count, and `q`, the operation count.\n2. Read `q` pairs `op number`. `number` is a slot index for `op = 1`, and an encoded handle for `op = 2` or `op = 3`.",
output:"Print one validation result, `0` or `1`, per operation `3`, in order.",
example:"For input `2 5 1 0 2 0 1 0 3 0 3 2`, the reused slot has handle 2. Handle 0 is old, so the output is `0 1`.",
constraints:"`1 <= slots <= 16`. `1 <= q <= 100`, with at least one validation query. Allocation indices are from 0 through `slots - 1`. Handles are from 0 through 2000. `op` is `1`, `2` or `3`.",
defect:"Validation accepts any older generation instead of requiring exact equality with the current generation.",
hints:["A live slot can have a different occupant from the one an old handle named.","Compare `issued`, the handle's encoded generation, with `generation[slot]` after reuse.","Require `issued == generation[slot]` as well as a live slot. An earlier generation is stale; a later one has not been issued."],
c:`int slots, q;
READ(slots);
READ(q);
ARRAY(live,16);
ARRAY(generation,16);
for (int i = 0; i < q; i++) {
    int op, number;
    READ(op);
    READ(number);
    if (op == 1) {
        live[number] = 1;
    } else {
        int slot = number % slots;
        int issued = number / slots;
        if (op == 2) {
            if (live[slot] == 1 && issued == generation[slot]) {
                live[slot] = 0;
                generation[slot]++;
            }
        } else {
            int valid = live[slot] == 1 && issued == generation[slot] ? 1 : 0;
            OUT(valid);
        }
    }
}`,
py:`slots = read_int()
q = read_int()
live = [0] * slots
generation = [0] * slots
for _ in range(q):
    op = read_int()
    number = read_int()
    if op == 1:
        live[number] = 1
    else:
        slot = number % slots
        issued = number // slots
        if op == 2:
            if live[slot] == 1 and issued == generation[slot]:
                live[slot] = 0
                generation[slot] += 1
        else:
            valid = int(live[slot] == 1 and issued == generation[slot])
            print(valid)`,
cbug:["int valid = live[slot] == 1 && issued == generation[slot] ? 1 : 0;","int valid = live[slot] == 1 && issued <= generation[slot] ? 1 : 0;"],
pybug:["valid = int(live[slot] == 1 and issued == generation[slot])","valid = int(live[slot] == 1 and issued <= generation[slot])"],
probe:["3 6\n1 2\n2 2\n1 2\n3 2\n3 5\n3 8", "0 1 0"],
cases:[["2 5\n1 0\n2 0\n1 0\n3 0\n3 2","0 1"],["2 2\n1 1\n3 1","1"],["1 4\n1 0\n2 0\n1 0\n3 0","0"],["3 1\n3 2","0"],["2 4\n1 0\n2 2\n3 0\n3 2","1 0"],["1 6\n1 0\n2 0\n2 0\n1 0\n3 1\n3 2","1 0"],["2 5\n1 1\n1 1\n3 1\n2 1\n3 1","1 0"],["1 8\n1 0\n2 0\n1 0\n2 1\n1 0\n3 0\n3 1\n3 2","0 0 1"]], witness:3
},
{
title:"Undo in Reverse", difficulty:55,
incident:"Patch needs to cancel all writes made during a repair.",
guide:"A transaction groups writes that can be kept or cancelled together. An undo log saves each cell and its value just before each write. `before` stores those values. Matching cell indices are in `cellAt` in C, C++ and Java; `cell_at` in Python.",
symptom:"Cancelling repeated writes can leave a value written partway through the repair.",
task:"Apply every write to the initial memory list in input order. Save the cell's current value before each write, including repeated writes to the same cell. The transaction, or group of writes, is always cancelled. Use the supplied per-write undo log, the saved cells and old values, to restore every cell to its value before the transaction. Print the restored list.",
input:"1. Read `n`, the cell count, and `q`, the write count.\n2. Read the `n` initial values of `memory`.\n3. Read `q` pairs `cell value`: the zero-based cell index and its new value.", output:"Print the `n` restored memory values in index order.",
example:"For input `1 2 5 0 8 0 9`, the cell began at 5. After cancellation, the output is `5`.",
constraints:"`1 <= n <= 32`. `0 <= q <= 100`. `0 <= cell < n`. Initial values and new `value` entries are from -1000 through 1000.",
defect:"Undo records are replayed oldest first, so later before-images overwrite the true original value.",
hints:["Trace two writes to the same cell.","The value saved before the second write may already belong to the transaction being cancelled.","Replay from the newest record to the oldest. Set `record` to `q - 1 - step`, so the earliest saved value is restored last."],
c:`int n, q;
READ(n);
READ(q);
ARRAY(memory,32);
ARRAY(cellAt,100);
ARRAY(before,100);
for (int i = 0; i < n; i++) {
    READ(memory[i]);
}
for (int i = 0; i < q; i++) {
    int cell, value;
    READ(cell);
    READ(value);
    cellAt[i] = cell;
    before[i] = memory[cell];
    memory[cell] = value;
}
for (int step = 0; step < q; step++) {
    int record = q - 1 - step;
    memory[cellAt[record]] = before[record];
}
for (int i = 0; i < n; i++) {
    OUT(memory[i]);
}`,
py:`n = read_int()
q = read_int()
memory = [read_int() for _ in range(n)]
cell_at = [0] * q
before = [0] * q
for i in range(q):
    cell = read_int()
    value = read_int()
    cell_at[i] = cell
    before[i] = memory[cell]
    memory[cell] = value
for step in range(q):
    record = q - 1 - step
    memory[cell_at[record]] = before[record]
print(*memory)`,
cbug:["int record = q - 1 - step;","int record = step;"], pybug:["record = q - 1 - step","record = step"],
probe:["2 2\n11 22\n1 33\n1 44", "11 22"],
cases:[["1 2\n5\n0 8\n0 9","5"],["2 1\n3 4\n1 6","3 4"],["2 3\n-5 7\n0 2\n1 9\n0 4","-5 7"],["1 0\n0","0"],["3 3\n1 2 3\n0 8\n1 8\n2 8","1 2 3"],["1 3\n1000\n0 -1000\n0 0\n0 1000","1000"],["2 4\n4 4\n0 4\n1 4\n0 4\n1 4","4 4"],["3 5\n-1 0 1\n2 4\n0 5\n2 8\n0 9\n1 6","-1 0 1"]], witness:3
},
{
title:"Two Owners, One Frame", difficulty:58,
incident:"Mira needs each snapshot write to affect only the selected page.",
guide:"A logical page is a named list of cells. A physical frame holds its values. Pages may share a frame. `refs` counts pages using each frame. The page-to-frame map is `frameOf` in C, C++ and Java; `frame_of` in Python. Copy-on-write gives a sharing page its own full copy when written.",
symptom:"Writing one of two pages sharing a frame can change both pages.",
task:"Start with `n` logical pages, each a list of `width` cells stored in its own physical frame. A frame is storage that pages can share. `1 x y` makes destination page `x` share source page `y`'s current frame and releases the destination's old ownership. Cloning a page to itself changes nothing. `2 x y value` writes `value` to offset `y` of page `x` only. If its frame is shared, first copy the entire frame for that page; all other cells keep their values. `3 x y` reads and prints that cell. Free frames need not be reused.",
input:"1. Read `n`, the page count; `width`, the cells per page; and `q`, the operation count.\n2. Read `n * width` initial values in page order, then offset order.\n3. Read `q` operations: `1 x y`, `2 x y value`, or `3 x y`. Page indices and cell offsets start at 0.",
output:"Print one cell value per operation `3`, in operation order.",
example:"For input `2 1 4 5 9 1 1 0 2 1 0 7 3 0 0 3 1 0`, page 1 first shares page 0, then receives its own write. The output is `5 7`.",
constraints:"`1 <= n, width <= 8`. `1 <= q <= 60`, with at least one read. Page indices are from 0 through `n - 1`; offsets are from 0 through `width - 1`. Values are from -1000 through 1000. At most `n + q` frames are needed.",
defect:"The copy-on-write guard excludes frames with exactly two owners.",
hints:["Can a frame with exactly two owners be changed safely for only one of them?","`refs` includes the page being written as well as every other owner.","Copy whenever `refs[frame] > 1`. Move the writing page's ownership to the full copy before updating its cell."],
c:`int n, width, q;
READ(n);
READ(width);
READ(q);
ARRAY(frameOf,8);
ARRAY(refs,68);
ARRAY(data,544);
for (int page = 0; page < n; page++) {
    frameOf[page] = page;
    refs[page] = 1;
    for (int j = 0; j < width; j++) {
        READ(data[page * width + j]);
    }
}
int nextFrame = n;
for (int i = 0; i < q; i++) {
    int op, x, y;
    READ(op);
    READ(x);
    READ(y);
    if (op == 1) {
        int source = frameOf[y];
        refs[source]++;
        refs[frameOf[x]]--;
        frameOf[x] = source;
    } else if (op == 2) {
        int value;
        READ(value);
        int frame = frameOf[x];
        if (refs[frame] > 1) {
            for (int j = 0; j < width; j++) {
                data[nextFrame * width + j] = data[frame * width + j];
            }
            refs[frame]--;
            frameOf[x] = nextFrame;
            refs[nextFrame] = 1;
            nextFrame++;
        }
        data[frameOf[x] * width + y] = value;
    } else {
        OUT(data[frameOf[x] * width + y]);
    }
}`,
py:`n = read_int()
width = read_int()
q = read_int()
frame_of = list(range(n))
refs = [0] * (n + q)
data = [0] * ((n + q) * width)
for page in range(n):
    refs[page] = 1
    for j in range(width):
        data[page * width + j] = read_int()
next_frame = n
for _ in range(q):
    op = read_int()
    x = read_int()
    y = read_int()
    if op == 1:
        source = frame_of[y]
        refs[source] += 1
        refs[frame_of[x]] -= 1
        frame_of[x] = source
    elif op == 2:
        value = read_int()
        frame = frame_of[x]
        if refs[frame] > 1:
            for j in range(width):
                data[next_frame * width + j] = data[frame * width + j]
            refs[frame] -= 1
            frame_of[x] = next_frame
            refs[next_frame] = 1
            next_frame += 1
        data[frame_of[x] * width + y] = value
    else:
        print(data[frame_of[x] * width + y])`,
cbug:["refs[frame] > 1","refs[frame] > 2"], pybug:["refs[frame] > 1","refs[frame] > 2"],
probe:["2 3 4\n1 2 3 4 5 6\n1 1 0\n2 1 1 99\n3 0 1\n3 1 2", "2 3"],
cases:[["2 1 4\n5 9\n1 1 0\n2 1 0 7\n3 0 0\n3 1 0","5 7"],["1 2 2\n2 3\n2 0 1 8\n3 0 1","8"],["2 2 4\n1 2 8 9\n1 0 1\n2 0 0 -1\n3 1 0\n3 0 1","8 9"],["1 1 3\n4\n1 0 0\n2 0 0 6\n3 0 0","6"],["3 1 6\n1 2 3\n1 1 0\n1 2 0\n2 2 0 9\n3 0 0\n3 1 0\n3 2 0","1 1 9"],["2 1 5\n0 1\n1 1 0\n2 0 0 4\n2 1 0 5\n3 0 0\n3 1 0","4 5"],["2 2 2\n-1 0 7 8\n3 0 1\n3 1 0","0 7"],["2 1 5\n1 2\n1 1 0\n1 1 1\n2 0 0 3\n3 0 0\n3 1 0","3 1"]], witness:3
},
{
title:"Reservation Window Baseline", difficulty:60,
incident:"Mira needs peak resource use inside each inspection window.",
guide:"A half-open interval includes its start and excludes its end. `delta` is a difference array: it records changes in reserved units at each time. `load` is the active total, and `peak` the largest total found in a query.",
symptom:"A query can miss reservations that started before its window.",
task:"A reservation uses `units` at each integer time from `start`, included, to `end`, excluded. For each window `[left, right)`, which includes `left` and excludes `right`, print the greatest total reserved units at an integer time inside it. Overlapping reservations add together. A reservation may start before the query and still be active inside it. Keep the supplied difference array, which records changes in load at each time.",
input:"1. Read `horizon`, the final time boundary; `n`, the reservation count; and `q`, the query count.\n2. Read `n` triples `start end units`.\n3. Read `q` pairs `left right` describing query windows.",
output:"Print one peak load per query, in query order. A window with no active reservations has peak `0`.",
example:"For input `10 1 1 1 8 5 3 5`, the 5-unit reservation is active throughout the query. The output is `5`.",
constraints:"`1 <= horizon <= 128`. `0 <= n <= 60`. `1 <= q <= 60`. `0 <= start < end <= horizon`. `1 <= units <= 100`. `0 <= left < right <= horizon`.",
defect:"The query sweep starts accumulating differences only at left, losing the load already active there.",
hints:["Try a window wholly inside a reservation that began earlier.","A value in `delta` is a change at that time, not the full active amount.","Add `delta[time]` from time 0 onward, including times before `left`. Use `left` only to decide when to compare `load` with `peak`, and stop before `right`."],
c:`int horizon, n, q;
READ(horizon);
READ(n);
READ(q);
ARRAY(delta,129);
for (int i = 0; i < n; i++) {
    int start, end, units;
    READ(start);
    READ(end);
    READ(units);
    delta[start] += units;
    delta[end] -= units;
}
for (int i = 0; i < q; i++) {
    int left, right;
    READ(left);
    READ(right);
    int load = 0;
    int peak = 0;
    for (int time = 0; time < right; time++) {
        load += delta[time];
        if (time >= left && load > peak) {
            peak = load;
        }
    }
    OUT(peak);
}`,
py:`horizon = read_int()
n = read_int()
q = read_int()
delta = [0] * (horizon + 1)
for _ in range(n):
    start = read_int()
    end = read_int()
    units = read_int()
    delta[start] += units
    delta[end] -= units
for _ in range(q):
    left = read_int()
    right = read_int()
    load = 0
    peak = 0
    for time in range(right):
        load += delta[time]
        if time >= left and load > peak:
            peak = load
    print(peak)`,
cbug:["        load += delta[time];","        if (time >= left) {\n            load += delta[time];\n        }"],
pybug:["        load += delta[time]","        if time >= left:\n            load += delta[time]"],
probe:["7 2 2\n1 7 6\n2 4 3\n3 4\n4 7", "9 6"],
cases:[["10 1 1\n1 8 5\n3 5","5"],["4 2 1\n0 2 3\n1 4 2\n0 4","5"],["8 2 2\n0 6 4\n3 5 7\n4 6\n6 8","11 0"],["1 0 1\n0 1","0"],["5 2 2\n0 3 2\n3 5 9\n3 4\n0 3","9 2"],["8 3 2\n0 8 1\n2 6 2\n4 5 4\n5 6\n1 7","3 7"],["3 1 2\n0 3 100\n2 3\n0 1","100 100"],["6 2 2\n1 2 5\n4 6 8\n2 4\n5 6","0 8"],["128 2 2\n0 128 100\n127 128 100\n127 128\n1 127", "200 100"]], witness:3
},
{
title:"Length-Tagged Dispatch", difficulty:62,
incident:"Ishan needs to read selected records from a byte stream.",
guide:"A byte here is an integer from 0 through 255. A record has a type, a length, and data bytes called its payload. `pos` is the record's start. The byte list is `bytes` in C, C++ and Java; `data` in Python. The type variable is `type` in C, C++ and Java; `record_type` in Python.",
symptom:"The parser can mistake a payload byte for the next record's type.",
task:"Parse all records in order. Each record has one type byte, one length byte, then exactly that many data bytes, called its payload. The length excludes both header bytes. Count every record of type `7` and sum its payload bytes. Skip all other types, including unfamiliar ones, using the same record format. A type-7 record with length 0 still counts.",
input:"1. Read `n`, the number of byte values.\n2. Read those `n` decimal bytes. They form zero or more complete records.", output:"Print the number of type-7 records, then the sum of their payload bytes.",
example:"For input `7 7 2 10 20 9 1 8`, type 7 contributes 10 and 20; type 9 is skipped. The output is `1 30`.",
constraints:"`0 <= n <= 256`. Every byte is from 0 through 255. Every record has both header bytes and all declared payload bytes within the input. Payload length may be `0`.",
defect:"The parser advances by only one header byte plus the payload length, although the header has two bytes.",
hints:["How many bytes does a record occupy when its payload length is 0?","The length counts payload bytes only. The type and length bytes take space too.","Advance `pos` by `length + 2` after each record. Keep the existing bounds checks."],
c:`int n;
READ(n);
ARRAY(bytes,256);
for (int i = 0; i < n; i++) {
    READ(bytes[i]);
}
int pos = 0;
int count = 0;
int total = 0;
while (pos + 1 < n) {
    int type = bytes[pos];
    int length = bytes[pos + 1];
    if (length > n - pos - 2) {
        break;
    }
    if (type == 7) {
        count++;
        for (int j = 0; j < length; j++) {
            total += bytes[pos + 2 + j];
        }
    }
    pos += length + 2;
}
OUT(count);
OUT(total);`,
py:`n = read_int()
data = [read_int() for _ in range(n)]
pos = 0
count = 0
total = 0
while pos + 1 < n:
    record_type = data[pos]
    length = data[pos + 1]
    if length > n - pos - 2:
        break
    if record_type == 7:
        count += 1
        for j in range(length):
            total += data[pos + 2 + j]
    pos += length + 2
print(count, total)`,
cbug:["pos += length + 2;","pos += length + 1;"], pybug:["pos += length + 2","pos += length + 1"],
probe:["8\n99 0 7 2 7 7 7 0", "2 14"],
cases:[["7\n7 2 10 20 9 1 8","1 30"],["2\n7 0","1 0"],["6\n9 1 255 7 1 5","1 5"],["0","0 0"],["4\n7 0 7 0","2 0"],["9\n0 2 7 0 7 3 1 2 3","1 6"],["5\n7 3 255 0 255","1 510"],["6\n1 0 2 0 3 0","0 0"],["256\n7 254 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255 255", "1 64770"]], witness:3
},
{
title:"Reassembly Must Remember", difficulty:64,
incident:"Ishan needs to check every piece received, including late arrivals.",
guide:"A byte is a value from 0 through 255. A fragment supplies bytes for part of a message. `seen` records received positions, `data` their stored bytes, and `filled` the number of distinct positions received. `corrupt` records whether conflicting bytes appeared.",
symptom:"The program can accept a conflicting fragment after every position has arrived.",
task:"A message has `n` byte positions, indexed from 0. Each fragment supplies consecutive bytes starting at its offset. Overlaps are allowed if the bytes agree. Inspect all `q` fragments. If any two received values differ at one position, print `CORRUPT`, even if other positions are missing or the message was complete earlier. Otherwise print `INCOMPLETE` if any position is missing. If complete and consistent, print the sum of its `n` bytes, counting each position once.",
input:"1. Read `n`, the message length, and `q`, the fragment count.\n2. For each fragment, read `offset`, its starting position; `length`, its byte count; then `length` decimal byte values.",
output:"Print exactly one result: `CORRUPT`, `INCOMPLETE`, or the complete message's byte sum. A conflict takes priority over missing bytes.",
example:"For input `2 2 0 2 4 5 1 1 9`, position 1 receives both 5 and 9. The output is `CORRUPT`.",
constraints:"`1 <= n <= 128`. `0 <= q <= 60`. `1 <= length <= n`. `0 <= offset` and `offset + length <= n`. Bytes are from 0 through 255.",
defect:"Conflict detection is disabled when all message positions have been filled.",
hints:["Does receiving every position mean later fragments can be ignored?","The number in `filled` and the agreement of repeated bytes are separate checks.","Check every already-seen position for a mismatch, regardless of `filled`. Once set, keep `corrupt` set until the final result."],
c:`int n, q;
READ(n);
READ(q);
ARRAY(seen,128);
ARRAY(data,128);
int filled = 0;
int corrupt = 0;
for (int i = 0; i < q; i++) {
    int offset, length;
    READ(offset);
    READ(length);
    for (int j = 0; j < length; j++) {
        int value;
        READ(value);
        int index = offset + j;
        if (seen[index] == 1 && data[index] != value) {
            corrupt = 1;
        }
        if (seen[index] == 0) {
            seen[index] = 1;
            data[index] = value;
            filled++;
        }
    }
}
if (corrupt == 1) {
    SAY("CORRUPT");
} else if (filled != n) {
    SAY("INCOMPLETE");
} else {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += data[i];
    }
    OUT(total);
}`,
py:`n = read_int()
q = read_int()
seen = [0] * n
data = [0] * n
filled = 0
corrupt = 0
for _ in range(q):
    offset = read_int()
    length = read_int()
    for j in range(length):
        value = read_int()
        index = offset + j
        if seen[index] == 1 and data[index] != value:
            corrupt = 1
        if seen[index] == 0:
            seen[index] = 1
            data[index] = value
            filled += 1
if corrupt == 1:
    print("CORRUPT")
elif filled != n:
    print("INCOMPLETE")
else:
    print(sum(data))`,
cbug:["seen[index] == 1 && data[index] != value","seen[index] == 1 && data[index] != value && filled < n"],
pybug:["seen[index] == 1 and data[index] != value","seen[index] == 1 and data[index] != value and filled < n"],
probe:["2 3\n1 1 0\n0 1 255\n1 1 1", "CORRUPT"],
cases:[["2 2\n0 2 4 5\n1 1 9","CORRUPT"],["3 2\n1 2 5 6\n0 1 4","15"],["1 2\n0 1 0\n0 1 255","CORRUPT"],["4 0","INCOMPLETE"],["3 3\n0 2 1 2\n1 2 2 3\n0 3 1 2 3","6"],["4 2\n0 2 1 2\n1 1 9","CORRUPT"],["3 3\n0 1 5\n0 1 5\n2 1 7","INCOMPLETE"],["4 3\n0 2 7 8\n2 2 9 10\n1 2 8 9","34"]], witness:3
},
{
title:"Clock Hand Privilege", difficulty:65,
incident:"Patch needs to give recently loaded data a second chance before replacement.",
guide:"A cache stores numbered data blocks called pages. A hit finds a stored page; a miss needs a load. The clock policy visits slots in a circle. `hand` is the current slot and `bit` stores reference flags, 0 or 1. The page array is `pageAt` in C, C++ and Java; `page_at` in Python.",
symptom:"A newly loaded page can be removed without its promised second chance.",
task:"Start with an empty cache, which stores pages for reuse, and `hand` at slot 0. Each stored page has a reference flag, either 0 or 1. A hit sets that flag to 1 and leaves the hand unchanged. On a miss, examine the hand's slot. While it is occupied with flag 1, clear the flag and move to the next slot, wrapping to 0 at the end. At the first empty slot or occupied slot with flag 0, install the requested page with flag 1. Then move the hand forward once. Print misses and the final state.",
input:"1. Read `capacity`, the slot count, and `n`, the request count.\n2. Read the `n` positive page IDs.", output:"Print the miss count, then `hand`, then page IDs in slots 0 through `capacity - 1`. Use `0` for an empty slot.",
example:"For input `2 3 1 2 3`, slots end as 3, 2 and the hand is at index 1. The output is `3 1 3 2`.",
constraints:"`1 <= capacity <= 8`. `0 <= n <= 100`. Page IDs are from 1 through 100. A miss clears at most `capacity` set flags before installing its page.",
defect:"A newly installed page starts with reference bit zero instead of one.",
hints:["Loading a missing page is still an access to that page.","Check the reference flag of a just-loaded page that has not yet had a hit.","Set `bit[hand]` to `1` on installation. Keep the clearing loop and existing hand movement."],
c:`int capacity, n;
READ(capacity);
READ(n);
ARRAY(pageAt,8);
ARRAY(bit,8);
int hand = 0;
int misses = 0;
for (int i = 0; i < n; i++) {
    int page;
    READ(page);
    int hit = -1;
    for (int j = 0; j < capacity; j++) {
        if (pageAt[j] == page) {
            hit = j;
        }
    }
    if (hit != -1) {
        bit[hit] = 1;
    } else {
        misses++;
        while (pageAt[hand] != 0 && bit[hand] == 1) {
            bit[hand] = 0;
            hand = (hand + 1) % capacity;
        }
        pageAt[hand] = page;
        bit[hand] = 1;
        hand = (hand + 1) % capacity;
    }
}
OUT(misses);
OUT(hand);
for (int j = 0; j < capacity; j++) {
    OUT(pageAt[j]);
}`,
py:`capacity = read_int()
n = read_int()
page_at = [0] * capacity
bit = [0] * capacity
hand = 0
misses = 0
for _ in range(n):
    page = read_int()
    hit = -1
    for j in range(capacity):
        if page_at[j] == page:
            hit = j
    if hit != -1:
        bit[hit] = 1
    else:
        misses += 1
        while page_at[hand] != 0 and bit[hand] == 1:
            bit[hand] = 0
            hand = (hand + 1) % capacity
        page_at[hand] = page
        bit[hand] = 1
        hand = (hand + 1) % capacity
print(misses, hand)
print(*page_at)`,
cbug:["bit[hand] = 1;","bit[hand] = 0;"], pybug:["bit[hand] = 1","bit[hand] = 0"],
probe:["3 7\n1 2 3 1 4 2 5", "5 0 4 2 5"],
cases:[["2 3\n1 2 3","3 1 3 2"],["2 3\n1 2 1","2 0 1 2"],["2 4\n1 2 1 3","3 1 3 2"],["3 0","0 0 0 0 0"],["1 4\n1 1 2 1","3 0 1"],["3 6\n1 2 3 4 2 5","5 0 4 2 5"],["2 6\n1 2 3 2 4 3","4 0 3 4"],["3 5\n1 2 3 1 4","4 1 4 2 3"]], witness:3
},
{
title:"Compactor's Interior Address", difficulty:70,
incident:"Patch needs addresses to keep identifying the same bytes after memory moves.",
guide:"Compaction packs live blocks while skipping dead blocks. A base is a block's first byte address; an offset is a byte's distance from its base. An aligned base is divisible by `alignment`. Old and new bases are `oldStart` and `newStart` in C, C++ and Java; `old_start` and `new_start` in Python. `cursor` tracks placement.",
symptom:"An address inside a moved block can be translated to the block's first byte.",
task:"Process blocks in increasing old-start order. `live = 1` marks a live block and `live = 0` a dead block. Skip dead blocks. For each live block, advance a cursor starting at 0 to the first address divisible by its alignment, place the block there, then advance by its length. This is compaction. For each query, translate the old byte address to the same byte in the moved live block. Preserve its distance from the block's first byte. Print `-1` for a gap or dead block. A block includes its first byte and excludes the address just after its last byte.",
input:"1. Read `n`, the block count, and `q`, the query count.\n2. For each block, read its old base (`oldStart` in C, C++ and Java; `old_start` in Python), `length` in bytes, `alignment` as the required base divisor, and `live` as the live/dead flag.\n3. Read `q` old byte addresses.",
output:"Print one relocated address, or `-1`, per query in query order.",
example:"For input `1 2 8 4 4 1 10 12`, the block moves from bytes 8 through 11 to bytes 0 through 3. Old address 10 becomes 2; 12 is outside. The output is `2 -1`.",
constraints:"`1 <= n <= 32`. `1 <= q <= 100`. Old bases are nonnegative and increasing. Blocks do not overlap. `1 <= length <= 32`; old base plus length is at most 1024. `1 <= alignment <= 16`, and each old base is divisible by it. `live` is `0` or `1`. Query addresses are from 0 through 1024. All arithmetic fits `int`.",
defect:"Relocation returns the new block base without adding the old address's interior offset.",
hints:["An address may identify a byte other than the block's first byte.","Find the queried byte's offset from its block's old base.","Add that offset to the new base: `newStart[i] + address - oldStart[i]` in C, C++ and Java; `new_start[i] + address - old_start[i]` in Python. Keep rejecting gaps and dead blocks."],
c:`int n, q;
READ(n);
READ(q);
ARRAY(oldStart,32);
ARRAY(length,32);
ARRAY(live,32);
ARRAY(newStart,32);
int cursor = 0;
for (int i = 0; i < n; i++) {
    int alignment;
    READ(oldStart[i]);
    READ(length[i]);
    READ(alignment);
    READ(live[i]);
    if (live[i] == 1) {
        while (cursor % alignment != 0) {
            cursor++;
        }
        newStart[i] = cursor;
        cursor += length[i];
    }
}
for (int j = 0; j < q; j++) {
    int address;
    READ(address);
    int answer = -1;
    for (int i = 0; i < n; i++) {
        if (live[i] == 1 && oldStart[i] <= address && address < oldStart[i] + length[i]) {
            answer = newStart[i] + address - oldStart[i];
        }
    }
    OUT(answer);
}`,
py:`n = read_int()
q = read_int()
old_start = [0] * n
length = [0] * n
live = [0] * n
new_start = [0] * n
cursor = 0
for i in range(n):
    old_start[i] = read_int()
    length[i] = read_int()
    alignment = read_int()
    live[i] = read_int()
    if live[i] == 1:
        while cursor % alignment != 0:
            cursor += 1
        new_start[i] = cursor
        cursor += length[i]
for _ in range(q):
    address = read_int()
    answer = -1
    for i in range(n):
        if live[i] == 1 and old_start[i] <= address and address < old_start[i] + length[i]:
            answer = new_start[i] + address - old_start[i]
    print(answer)`,
cbug:["newStart[i] + address - oldStart[i]","newStart[i]"], pybug:["new_start[i] + address - old_start[i]","new_start[i]"],
probe:["2 4\n12 2 4 1\n24 4 8 1\n12 13 24 27", "0 1 8 11"],
cases:[["1 2\n8 4 4 1\n10 12","2 -1"],["1 1\n8 4 4 1\n8","0"],["3 4\n0 3 1 1\n8 4 4 0\n16 5 8 1\n2 8 16 20","2 -1 8 12"],["1 2\n0 1 1 0\n0 1","-1 -1"],["2 3\n4 2 2 1\n12 3 4 1\n4 12 14","0 4 6"],["2 3\n0 2 1 1\n2 2 1 1\n1 2 3","1 2 3"],["2 3\n8 3 4 0\n16 2 8 1\n9 15 17","-1 -1 1"],["1 3\n992 32 16 1\n991 1023 1024","-1 31 -1"]], witness:3
},
{
title:"The Last Strong Owner", difficulty:74,
incident:"Mira needs to release objects only when no owner still keeps them alive.",
guide:"Objects and owning links form a directed graph: each edge goes from an owner to a child it keeps alive. A strong reference is one ownership. A cycle follows edges back to its starting object. `roots` counts external owners, `refs` counts all owners, and `alive` records surviving objects.",
symptom:"Removing the last external owner can destroy an object still owned by another live object.",
task:"All `n` objects start alive. Each directed edge is one strong reference: its source owns its target while the source is alive. Duplicate edges count separately; self-edges and cycles are allowed. Objects also have the listed external owners. Process external releases in order. After each release, repeatedly destroy an alive object with no owners of either kind, removing all its outgoing ownerships, until none qualify. If several qualify, choose the lowest object ID first. Cycles whose members keep one another owned survive even without external owners.",
input:"1. Read `n`, the object count; `m`, the edge count; and `q`, the release count.\n2. Read `n` external-owner counts in object order.\n3. Read `m` pairs: owner object ID, then child object ID.\n4. Read `q` object IDs, each releasing one external owner. IDs start at 0.",
output:"Print `n` flags in object ID order: `1` for alive and `0` for destroyed.",
example:"For input `2 1 1 1 1 0 1 1`, object 0 still owns object 1 after object 1 loses its external owner. The output is `1 1`.",
constraints:"`1 <= n <= 32`. `0 <= m, q <= 100`. IDs are from 0 through `n - 1`. Initial external counts are from 0 through 100. Every object starts with a positive total owner count. Each release names an alive object with at least one external owner remaining.",
defect:"Destruction tests external ownership instead of the total reference count, overlooking internal strong owners.",
hints:["Does having no external owners mean having no owners at all?","Compare `roots` with `refs` for an object owned by another live object.","Destroy only an alive object with `refs[j] == 0`. Removing its outgoing references can then make other objects eligible."],
c:`int n, m, q;
READ(n);
READ(m);
READ(q);
ARRAY(roots,32);
ARRAY(refs,32);
ARRAY(alive,32);
ARRAY(from,100);
ARRAY(to,100);
for (int i = 0; i < n; i++) {
    READ(roots[i]);
    refs[i] = roots[i];
    alive[i] = 1;
}
for (int i = 0; i < m; i++) {
    READ(from[i]);
    READ(to[i]);
    refs[to[i]]++;
}
for (int i = 0; i < q; i++) {
    int node;
    READ(node);
    roots[node]--;
    refs[node]--;
    while (1 == 1) {
        int dead = -1;
        for (int j = 0; j < n; j++) {
            if (alive[j] == 1 && refs[j] == 0) {
                dead = j;
                break;
            }
        }
        if (dead == -1) {
            break;
        }
        alive[dead] = 0;
        for (int edge = 0; edge < m; edge++) {
            if (from[edge] == dead) {
                refs[to[edge]]--;
            }
        }
    }
}
for (int i = 0; i < n; i++) {
    OUT(alive[i]);
}`,
py:`n = read_int()
m = read_int()
q = read_int()
roots = [read_int() for _ in range(n)]
refs = roots.copy()
alive = [1] * n
edges = []
for _ in range(m):
    owner = read_int()
    child = read_int()
    edges.append((owner, child))
    refs[child] += 1
for _ in range(q):
    node = read_int()
    roots[node] -= 1
    refs[node] -= 1
    while True:
        dead = -1
        for j in range(n):
            if alive[j] == 1 and refs[j] == 0:
                dead = j
                break
        if dead == -1:
            break
        alive[dead] = 0
        for owner, child in edges:
            if owner == dead:
                refs[child] -= 1
for flag in alive:
    print(flag)`,
cbug:["alive[j] == 1 && refs[j] == 0","alive[j] == 1 && roots[j] == 0"], pybug:["alive[j] == 1 and refs[j] == 0","alive[j] == 1 and roots[j] == 0"],
probe:["2 1 2\n1 2\n0 1\n1 1", "1 1"],
cases:[["2 1 1\n1 1\n0 1\n1","1 1"],["2 1 1\n1 0\n0 1\n0","0 0"],["3 2 1\n1 1 0\n0 1\n1 2\n1","1 1 1"],["1 0 0\n1","1"],["1 1 1\n1\n0 0\n0","1"],["2 2 1\n1 0\n0 1\n1 0\n0","1 1"],["3 2 2\n1 1 0\n0 2\n1 2\n0 1","0 0 0"],["2 2 2\n2 0\n0 1\n0 1\n0 0","0 0"]], witness:3
},
{
title:"Idle Credit in the Router", difficulty:78,
incident:"Ishan needs to schedule packets without saving credit during idle periods.",
guide:"A flow is one packet queue. A packet's length is its sending cost. `quantum` is the credit a nonempty flow gains per round; `deficit` is its unused credit. `head` and `tail` bound waiting packets, and `sent` counts packets sent.",
symptom:"A flow that became empty can reuse old credit and send a later packet too early.",
task:"A flow is a queue of packets. Start with empty queues and zero credit. In each round, first append all listed arrivals to their flows. Then visit flows in index order. A nonempty flow gains its fixed quantum, or credit allowance. Send its oldest packet while its length is at most the available credit, subtracting that length each time. Do not skip an unaffordable oldest packet. Keep leftover credit while packets remain, but set it to zero if the queue is empty after the visit. Empty flows gain no credit. Stop after the listed rounds.",
input:"1. Read `flows`, the flow count, and `rounds`, the round count.\n2. Read one `quantum` per flow in index order.\n3. For each round, and each flow in index order, read `k`, its arrival count, then its `k` packet lengths. Flow indices start at 0.",
output:"For each flow in index order, print its sent-packet count, remaining credit, and waiting-packet count.",
example:"For input `1 3 5 1 3 0 1 7`, the length-3 packet sends, its leftover credit is lost, and the later length-7 packet waits with credit 5. The output is `1 5 1`.",
constraints:"`1 <= flows <= 4`. `1 <= rounds <= 30`. Each quantum is from 1 through 20. `0 <= k <= 4`. Packet lengths are from 1 through 20. Each flow receives at most 120 packets.",
defect:"Emptying a queue preserves its unused deficit, letting later arrivals inherit idle credit.",
hints:["Track credit between a queue becoming empty and its next arrival.","Which flows may carry credit into the next round?","After each visit, if `head[flow] == tail[flow]`, set `deficit[flow]` to `0`. Keep credit only while a packet remains waiting."],
c:`int flows, rounds;
READ(flows);
READ(rounds);
ARRAY(quantum,4);
ARRAY(head,4);
ARRAY(tail,4);
ARRAY(deficit,4);
ARRAY(sent,4);
ARRAY(packet,480);
for (int flow = 0; flow < flows; flow++) {
    READ(quantum[flow]);
}
for (int round = 0; round < rounds; round++) {
    for (int flow = 0; flow < flows; flow++) {
        int k;
        READ(k);
        for (int j = 0; j < k; j++) {
            READ(packet[flow * 120 + tail[flow]]);
            tail[flow]++;
        }
    }
    for (int flow = 0; flow < flows; flow++) {
        if (head[flow] < tail[flow]) {
            deficit[flow] += quantum[flow];
        }
        while (head[flow] < tail[flow] && packet[flow * 120 + head[flow]] <= deficit[flow]) {
            deficit[flow] -= packet[flow * 120 + head[flow]];
            head[flow]++;
            sent[flow]++;
        }
        if (head[flow] == tail[flow]) {
            deficit[flow] = 0;
        }
    }
}
for (int flow = 0; flow < flows; flow++) {
    OUT(sent[flow]);
    OUT(deficit[flow]);
    OUT(tail[flow] - head[flow]);
}`,
py:`flows = read_int()
rounds = read_int()
quantum = [read_int() for _ in range(flows)]
head = [0] * flows
tail = [0] * flows
deficit = [0] * flows
sent = [0] * flows
packet = [0] * (flows * 120)
for _ in range(rounds):
    for flow in range(flows):
        k = read_int()
        for _ in range(k):
            packet[flow * 120 + tail[flow]] = read_int()
            tail[flow] += 1
    for flow in range(flows):
        if head[flow] < tail[flow]:
            deficit[flow] += quantum[flow]
        while head[flow] < tail[flow] and packet[flow * 120 + head[flow]] <= deficit[flow]:
            deficit[flow] -= packet[flow * 120 + head[flow]]
            head[flow] += 1
            sent[flow] += 1
        if head[flow] == tail[flow]:
            deficit[flow] = 0
for flow in range(flows):
    print(sent[flow], deficit[flow], tail[flow] - head[flow])`,
cbug:["deficit[flow] = 0;","deficit[flow] = deficit[flow];"], pybug:["deficit[flow] = 0","deficit[flow] = deficit[flow]"],
probe:["1 4\n4\n1 1\n0\n0\n1 6", "1 4 1"],
cases:[["1 3\n5\n1 3\n0\n1 7","1 5 1"],["1 2\n3\n1 5\n0","1 0 0"],["1 2\n5\n1 1\n1 9","1 5 1"],["2 1\n4 7\n0\n0","0 0 0 0 0 0"],["1 1\n5\n3 2 3 4","2 0 1"],["2 2\n2 4\n1 3\n1 3\n0\n1 5","1 0 0 1 4 1"],["1 3\n2\n2 6 1\n0\n0","1 0 1"],["1 2\n20\n4 1 2 3 4\n1 20","5 0 0"]], witness:3
},
{
title:"Committed Child, Aborted Parent", difficulty:82,
incident:"Mira needs an outer repair to remain cancellable after an inner repair commits.",
guide:"A transaction groups writes that can be kept by committing or cancelled by rolling back. A nested transaction runs inside another open one. A before-image is a cell's value just before a write. `marks` stores log boundaries, `depth` counts open transactions, and `count` is the undo-log length.",
symptom:"An outer rollback can fail to undo writes from a committed inner transaction.",
task:"Start with the initial memory values. A transaction groups writes that can be kept by committing or cancelled by rolling back. `1` opens a transaction inside any current one. `2 cell value` writes a cell, saving its previous value only while a transaction is open. `3` commits and closes the innermost transaction, keeping its writes. Those writes still belong to an open parent and must be cancelled if that parent rolls back. `4` cancels and closes the innermost transaction by undoing its writes in reverse order, including writes from committed children. `5 cell` reads and prints a cell. Transactions are properly nested and all close by the end.",
input:"1. Read `n`, the cell count, and `q`, the operation count.\n2. Read the `n` initial values of `memory`.\n3. Read `q` operations: `1`, `2 cell value`, `3`, `4`, or `5 cell`. Cell indices start at 0.",
output:"Print one cell value per operation `5`, in operation order.",
example:"For input `1 7 5 1 1 2 0 9 3 4 5 0 5 0`, the child commits its write, then the parent rolls back. Both reads see 5. The output is `5 5`.",
constraints:"`1 <= n <= 16`. `1 <= q <= 100`, with at least one read. Nesting depth is at most 16. Each commit or rollback has an open transaction. `0 <= cell < n`. Values are from -1000 through 1000.",
defect:"Every commit clears the undo log, including child commits whose history is still needed by a parent.",
hints:["Does committing a child also commit its still-open parent?","After a commit, can a remaining parent still need the child's before-images?","Clear the undo log only when `depth == 0` after closing a committed transaction. A child commit reduces `depth` but keeps the log entries."],
c:`int n, q;
READ(n);
READ(q);
ARRAY(memory,16);
ARRAY(marks,16);
ARRAY(cellAt,100);
ARRAY(before,100);
int depth = 0;
int count = 0;
for (int i = 0; i < n; i++) {
    READ(memory[i]);
}
for (int i = 0; i < q; i++) {
    int op;
    READ(op);
    if (op == 1) {
        marks[depth] = count;
        depth++;
    } else if (op == 2) {
        int cell, value;
        READ(cell);
        READ(value);
        if (depth > 0) {
            cellAt[count] = cell;
            before[count] = memory[cell];
            count++;
        }
        memory[cell] = value;
    } else if (op == 3) {
        depth--;
        if (depth == 0) {
            count = 0;
        }
    } else if (op == 4) {
        depth--;
        while (count > marks[depth]) {
            count--;
            memory[cellAt[count]] = before[count];
        }
    } else {
        int cell;
        READ(cell);
        OUT(memory[cell]);
    }
}`,
py:`n = read_int()
q = read_int()
memory = [read_int() for _ in range(n)]
marks = [0] * 16
cell_at = [0] * 100
before = [0] * 100
depth = 0
count = 0
for _ in range(q):
    op = read_int()
    if op == 1:
        marks[depth] = count
        depth += 1
    elif op == 2:
        cell = read_int()
        value = read_int()
        if depth > 0:
            cell_at[count] = cell
            before[count] = memory[cell]
            count += 1
        memory[cell] = value
    elif op == 3:
        depth -= 1
        if depth == 0:
            count = 0
    elif op == 4:
        depth -= 1
        while count > marks[depth]:
            count -= 1
            memory[cell_at[count]] = before[count]
    else:
        cell = read_int()
        print(memory[cell])`,
cbug:["if (depth == 0) {","if (depth >= 0) {"], pybug:["if depth == 0:","if depth >= 0:"],
probe:["1 9\n10\n1\n2 0 20\n1\n2 0 30\n3\n5 0\n4\n5 0\n5 0", "30 10 10"],
cases:[["1 7\n5\n1\n1\n2 0 9\n3\n4\n5 0\n5 0","5 5"],["1 4\n5\n1\n2 0 9\n3\n5 0","9"],["1 8\n2\n1\n2 0 3\n1\n2 0 4\n3\n2 0 5\n4\n5 0","2"],["1 4\n7\n2 0 8\n1\n4\n5 0","8"],["2 7\n1 2\n1\n2 0 3\n1\n2 1 4\n4\n3\n5 1","2"],["1 8\n0\n1\n1\n1\n2 0 6\n3\n3\n4\n5 0","0"],["1 5\n-9\n1\n2 0 3\n2 0 4\n4\n5 0","-9"],["2 9\n0 1\n1\n2 0 7\n1\n2 1 8\n3\n5 1\n4\n5 0\n5 1","8 0 1"]], witness:3
},
{
title:"Buddy, Not Just Neighbor", difficulty:85,
incident:"Patch needs to combine free memory blocks before larger allocations.",
guide:"The arena is the whole memory range. A block's base is its first byte address. Order `k` means a size of 2 raised to power `k` bytes. An aligned base is divisible by the block size. Buddies are the two equal halves of one parent whose base is divisible by twice their size. The free-block table is `freeAt` in C, C++ and Java; `free_at` in Python.",
symptom:"A release can miss a valid merge or merge neighbors with different parent blocks.",
task:"The arena's size in bytes is 2 raised to the power of its largest order. Addresses start at 0. Order `k` means a block size of 2 raised to power `k`. Initially the whole arena is free. An allocation gives `1`, an allocation ID, and the requested order. Choose the smallest available order at least as large as requested, then the lowest base at that order. Split repeatedly, keeping the lower half and leaving the upper half free, until the requested size is reached. Print its base, or `-1` if unavailable or that ID already has a live allocation. Failure changes nothing. A release gives `2`, an allocation ID, and `0`. Release only a live allocation, then repeatedly merge with its free same-order buddy. Buddies are the two halves of one parent whose base is divisible by twice their size. Releasing a nonlive ID does nothing.",
input:"1. Read the largest order, named `maxOrder` in C, C++ and Java; `max_order` in Python. Then read `q`, the operation count.\n2. Read `q` triples: `op`, the allocation ID (`id` in C, C++ and Java; `identifier` in Python), and `requested`, the requested order. The third field is `0` for release.",
output:"Print a base or `-1` for each allocation, in order. Then print the largest free block size after all operations, or `0` if none is free.",
example:"For input `2 4 1 0 0 1 1 0 2 0 0 2 1 0`, allocations return bases 0 and 1. Both releases reunite the four-byte arena. The output is `0 1 4`.",
constraints:"The largest order is from 0 through 6. `0 <= q <= 100`. IDs are from 0 through 31. Requested allocation orders are from 0 through the largest order. `op` is `1` or `2`. This simulates integer addresses without accessing real memory.",
defect:"The merge computes every buddy to the right, forgetting that an upper half's buddy is on its left.",
hints:["For one-byte blocks, compare the buddy of base 0 with the buddy of base 1.","Adjacent blocks can belong to different parents. Check whether a block is the lower or upper half of its parent.","Let `size` be the block size. Divide `base` by `size` using whole-number division. For an even quotient, the buddy is `base + size`; for an odd quotient, it is `base - size`. Merge only if that exact same-order block is free."],
c:`int maxOrder, q;
READ(maxOrder);
READ(q);
int arena = 1 << maxOrder;
ARRAY(freeAt,448);
ARRAY(baseOf,32);
ARRAY(orderOf,32);
ARRAY(live,32);
freeAt[maxOrder] = 1;
for (int event = 0; event < q; event++) {
    int op, id, requested;
    READ(op);
    READ(id);
    READ(requested);
    if (op == 1) {
        int base = -1;
        int order = requested;
        if (live[id] == 0) {
            for (int k = requested; k <= maxOrder && base == -1; k++) {
                for (int address = 0; address < arena; address++) {
                    if (freeAt[address * 7 + k] == 1) {
                        base = address;
                        order = k;
                        break;
                    }
                }
            }
        }
        if (base != -1) {
            freeAt[base * 7 + order] = 0;
            while (order > requested) {
                order--;
                int upper = base + (1 << order);
                freeAt[upper * 7 + order] = 1;
            }
            baseOf[id] = base;
            orderOf[id] = requested;
            live[id] = 1;
        }
        OUT(base);
    } else if (live[id] == 1) {
        int base = baseOf[id];
        int order = orderOf[id];
        live[id] = 0;
        while (order < maxOrder) {
            int size = 1 << order;
            int buddy = (base / size) % 2 == 0 ? base + size : base - size;
            if (buddy < 0 || buddy + size > arena || freeAt[buddy * 7 + order] == 0) {
                break;
            }
            freeAt[buddy * 7 + order] = 0;
            if (buddy < base) {
                base = buddy;
            }
            order++;
        }
        freeAt[base * 7 + order] = 1;
    }
}
int largest = 0;
for (int base = 0; base < arena; base++) {
    for (int order = 0; order <= maxOrder; order++) {
        if (freeAt[base * 7 + order] == 1 && (1 << order) > largest) {
            largest = 1 << order;
        }
    }
}
OUT(largest);`,
py:`max_order = read_int()
q = read_int()
arena = 1 << max_order
free_at = [0] * 448
base_of = [0] * 32
order_of = [0] * 32
live = [0] * 32
free_at[max_order] = 1
for _ in range(q):
    op = read_int()
    identifier = read_int()
    requested = read_int()
    if op == 1:
        base = -1
        order = requested
        if live[identifier] == 0:
            for k in range(requested, max_order + 1):
                if base != -1:
                    break
                for address in range(arena):
                    if free_at[address * 7 + k] == 1:
                        base = address
                        order = k
                        break
        if base != -1:
            free_at[base * 7 + order] = 0
            while order > requested:
                order -= 1
                upper = base + (1 << order)
                free_at[upper * 7 + order] = 1
            base_of[identifier] = base
            order_of[identifier] = requested
            live[identifier] = 1
        print(base)
    elif live[identifier] == 1:
        base = base_of[identifier]
        order = order_of[identifier]
        live[identifier] = 0
        while order < max_order:
            size = 1 << order
            buddy = base + size if (base // size) % 2 == 0 else base - size
            if buddy < 0 or buddy + size > arena or free_at[buddy * 7 + order] == 0:
                break
            free_at[buddy * 7 + order] = 0
            base = min(base, buddy)
            order += 1
        free_at[base * 7 + order] = 1
largest = 0
for base in range(arena):
    for order in range(max_order + 1):
        if free_at[base * 7 + order] == 1:
            largest = max(largest, 1 << order)
print(largest)`,
cbug:["(base / size) % 2 == 0 ? base + size : base - size","base + size"],
pybug:["base + size if (base // size) % 2 == 0 else base - size","base + size"],
probe:["1 4\n1 0 0\n1 1 0\n2 0 0\n2 1 0", "0 1 2"],
cases:[["2 4\n1 0 0\n1 1 0\n2 0 0\n2 1 0","0 1 4"],["2 2\n1 0 1\n2 0 0","0 4"],["2 7\n1 0 0\n1 1 0\n1 2 0\n1 3 0\n2 0 0\n2 1 0\n1 4 1","0 1 2 3 0 0"],["0 0","1"],["0 4\n1 0 0\n1 1 0\n2 0 0\n1 1 0","0 -1 0 0"],["3 4\n1 0 1\n1 1 1\n2 1 0\n2 0 0","0 2 8"],["3 4\n1 0 0\n1 1 2\n1 0 0\n2 31 0","0 4 -1 2"],["6 3\n1 0 5\n1 1 5\n1 2 0","0 32 -1 0"],["6 100\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0\n1 0 0\n2 0 0", "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 64"]], witness:3
},
{
title:"Commit Order at Dawn", difficulty:90,
incident:"Mira needs to recover committed settings after a crash.",
guide:"A transaction groups writes. Its commit marker says the group is complete. A log records events in order. `first` stores a transaction's first-write position. Commit positions are in `commitAt` in C, C++ and Java; `commit_at` in Python. Setting indices are called keys.",
symptom:"Recovery can apply transaction groups in the wrong order and leave the wrong setting.",
task:"Start from the initial settings. A transaction is a group of writes. A write event has four integers: `1`, a transaction ID, a key index, and a new value. A commit event has `2`, a transaction ID, `0`, and `0`. Ignore every transaction without a commit marker. Replay committed transactions as whole batches in commit-marker order, earliest first. Within each batch, replay writes in original log order. A later batch overwrites earlier values on the same key.",
input:"1. Read `keys`, the setting count; `transactions`, the transaction-ID count; and `events`, the log length.\n2. Read `keys` initial setting values in key order.\n3. Read `events` quadruples: event kind (`1` for write, `2` for commit), transaction ID, key index, and new value. The last two fields are `0 0` for a commit.",
output:"Print the recovered `keys` values in key order, starting at key 0.",
example:"For input `1 2 4 0 1 1 0 8 1 2 0 9 2 2 0 0 2 1 0 0`, transaction 2 commits first, then transaction 1. The output is `8`.",
constraints:"`1 <= keys <= 16`. `1 <= transactions <= 12`. `0 <= events <= 100`. Transaction IDs are from 1 through `transactions`; key indices are from 0 through `keys - 1`. Values are from -1000 through 1000. Each transaction commits at most once, after all its writes. Every committed transaction has at least one write.",
defect:"Recovery orders committed batches by first-write position instead of commit-marker position.",
hints:["Can the first transaction to write be the last to commit?","Trace two transactions writing the same key whose commit order reverses their first-write order.","Select each batch by its commit position, rather than `first[tx]`: use `commitAt[tx]` in C, C++ and Java; `commit_at[tx]` in Python. Keep each batch's write order and skip uncommitted transactions."],
c:`int keys, transactions, events;
READ(keys);
READ(transactions);
READ(events);
ARRAY(valueAt,16);
ARRAY(kind,101);
ARRAY(txAt,101);
ARRAY(keyAt,101);
ARRAY(writeValue,101);
ARRAY(first,13);
ARRAY(commitAt,13);
for (int key = 0; key < keys; key++) {
    READ(valueAt[key]);
}
for (int event = 1; event <= events; event++) {
    READ(kind[event]);
    READ(txAt[event]);
    READ(keyAt[event]);
    READ(writeValue[event]);
    int tx = txAt[event];
    if (kind[event] == 1 && first[tx] == 0) {
        first[tx] = event;
    }
    if (kind[event] == 2) {
        commitAt[tx] = event;
    }
}
for (int step = 1; step <= events; step++) {
    for (int tx = 1; tx <= transactions; tx++) {
        if (commitAt[tx] > 0 && commitAt[tx] == step) {
            for (int event = 1; event <= events; event++) {
                if (kind[event] == 1 && txAt[event] == tx) {
                    valueAt[keyAt[event]] = writeValue[event];
                }
            }
        }
    }
}
for (int key = 0; key < keys; key++) {
    OUT(valueAt[key]);
}`,
py:`keys = read_int()
transactions = read_int()
events = read_int()
value_at = [read_int() for _ in range(keys)]
kind = [0] * (events + 1)
tx_at = [0] * (events + 1)
key_at = [0] * (events + 1)
write_value = [0] * (events + 1)
first = [0] * (transactions + 1)
commit_at = [0] * (transactions + 1)
for event in range(1, events + 1):
    kind[event] = read_int()
    tx_at[event] = read_int()
    key_at[event] = read_int()
    write_value[event] = read_int()
    tx = tx_at[event]
    if kind[event] == 1 and first[tx] == 0:
        first[tx] = event
    if kind[event] == 2:
        commit_at[tx] = event
for step in range(1, events + 1):
    for tx in range(1, transactions + 1):
        if commit_at[tx] > 0 and commit_at[tx] == step:
            for event in range(1, events + 1):
                if kind[event] == 1 and tx_at[event] == tx:
                    value_at[key_at[event]] = write_value[event]
print(*value_at)`,
cbug:["commitAt[tx] > 0 && commitAt[tx] == step","commitAt[tx] > 0 && first[tx] == step"],
pybug:["commit_at[tx] > 0 and commit_at[tx] == step","commit_at[tx] > 0 and first[tx] == step"],
probe:["1 2 5\n10\n1 1 0 11\n1 2 0 22\n1 1 0 33\n2 2 0 0\n2 1 0 0", "33"],
cases:[["1 2 4\n0\n1 1 0 8\n1 2 0 9\n2 2 0 0\n2 1 0 0","8"],["1 1 2\n5\n1 1 0 7\n2 1 0 0","7"],["2 2 5\n1 2\n1 1 0 3\n1 2 0 4\n1 1 1 5\n2 2 0 0\n2 1 0 0","3 5"],["2 1 0\n-1 9","-1 9"],["1 2 3\n0\n1 1 0 5\n1 2 0 6\n2 1 0 0","5"],["1 1 4\n9\n1 1 0 1\n1 1 0 2\n1 1 0 3\n2 1 0 0","3"],["2 2 4\n0 0\n1 2 1 9\n1 1 0 8\n2 1 0 0\n2 2 0 0","8 9"],["1 3 6\n0\n1 1 0 1\n1 2 0 2\n1 3 0 3\n2 3 0 0\n2 1 0 0\n2 2 0 0","2"]], witness:3
},
{
title:"Disk Route State", difficulty:96,
incident:"Ishan needs a disk route that meets every request's deadline.",
guide:"A track is a numbered disk position. `head` is the starting position. Dynamic programming stores the best result for each partial route. A bit mask represents a set: bit `i` is 1 when request `i` is done. `dp[mask * n + last]` is the earliest feasible finish time for exactly that set, ending at request `last`.",
symptom:"The planner can store a partial route with an endpoint different from where the head finished.",
task:"All requests are ready at time 0. Service each exactly once in any order. A track is a numbered disk position. Moving between tracks costs their absolute difference in time and movement. Each service takes one extra time unit but adds no movement. A request meets its deadline if service finishes at or before it. Minimize total movement while meeting every deadline. No return to the starting track is required. Print `-1` if impossible. Keep the supplied subset dynamic program, which stores the earliest feasible finish time for each visited set and final request. For the same visited set and final request, an earlier finish allows every continuation a later finish allows. A complete route's movement is its finish time minus `n`.",
input:"1. Read `n`, the request count, and `head`, the starting track.\n2. Read `n` pairs: `track`, the requested position, and `deadline`, its latest allowed finish time. Request indices start at 0; requests on the same track are separate.",
output:"Print the minimum total movement for a feasible complete route, or `-1`. Do not print a route.",
example:"For input `2 0 2 3 5 7`, visit track 2 then 5. Services finish at times 3 and 7, meeting both deadlines exactly. The output is `5`.",
constraints:"`1 <= n <= 12`. `0 <= head, track <= 100`. `0 <= deadline <= 1500`. The table has at most 49152 entries. Its running time is bounded by a constant times 2 to power `n`, times `n` squared.",
defect:"A transition stores its result under the old endpoint rather than the newly serviced request.",
hints:["A state must identify the head's endpoint as well as the requests already done.","After moving from `last` to the next request, what endpoint should the destination entry describe?","Use the new mask and the newly serviced endpoint: `nextMask * n + next` in C, C++ and Java; `next_mask * n + next_request` in Python. Keep the deadline and minimum-time checks."],
c:`int n, head;
READ(n);
READ(head);
ARRAY(track,12);
ARRAY(deadline,12);
ARRAY(dp,49152);
int total = 1 << n;
int infinity = 1000000;
for (int i = 0; i < total * n; i++) {
    dp[i] = infinity;
}
for (int i = 0; i < n; i++) {
    READ(track[i]);
    READ(deadline[i]);
    int travel = track[i] - head;
    if (travel < 0) {
        travel = -travel;
    }
    if (travel + 1 <= deadline[i]) {
        dp[(1 << i) * n + i] = travel + 1;
    }
}
for (int mask = 1; mask < total; mask++) {
    for (int last = 0; last < n; last++) {
        int index = mask * n + last;
        if (dp[index] == infinity) {
            continue;
        }
        for (int next = 0; next < n; next++) {
            if ((mask & (1 << next)) != 0) {
                continue;
            }
            int travel = track[next] - track[last];
            if (travel < 0) {
                travel = -travel;
            }
            int nextTime = dp[index] + travel + 1;
            int nextMask = mask | (1 << next);
            int destination = nextMask * n + next;
            if (nextTime <= deadline[next] && nextTime < dp[destination]) {
                dp[destination] = nextTime;
            }
        }
    }
}
int best = infinity;
for (int last = 0; last < n; last++) {
    if (dp[(total - 1) * n + last] < best) {
        best = dp[(total - 1) * n + last];
    }
}
OUT(best == infinity ? -1 : best - n);`,
py:`n = read_int()
head = read_int()
track = [0] * n
deadline = [0] * n
total = 1 << n
infinity = 1000000
dp = [infinity] * (total * n)
for i in range(n):
    track[i] = read_int()
    deadline[i] = read_int()
    travel = abs(track[i] - head)
    if travel + 1 <= deadline[i]:
        dp[(1 << i) * n + i] = travel + 1
for mask in range(1, total):
    for last in range(n):
        index = mask * n + last
        if dp[index] == infinity:
            continue
        for next_request in range(n):
            if mask & (1 << next_request):
                continue
            travel = abs(track[next_request] - track[last])
            next_time = dp[index] + travel + 1
            next_mask = mask | (1 << next_request)
            destination = next_mask * n + next_request
            if next_time <= deadline[next_request] and next_time < dp[destination]:
                dp[destination] = next_time
best = min(dp[(total - 1) * n:total * n])
print(-1 if best == infinity else best - n)`,
cbug:["int destination = nextMask * n + next;","int destination = nextMask * n + last;"],
pybug:["destination = next_mask * n + next_request","destination = next_mask * n + last"],
probe:["3 4\n1 4\n8 12\n4 17", "14"],
cases:[["2 0\n2 3\n5 7","5"],["1 5\n5 1","0"],["3 0\n2 3\n5 7\n9 12","9"],["1 0\n1 1","-1"],["3 5\n1 100\n9 100\n5 100","12"],["3 0\n0 1\n0 2\n0 3","0"],["2 50\n0 51\n100 51","-1"],["4 0\n1 2\n3 5\n6 9\n10 14","10"],["12 0\n0 1\n1 3\n2 5\n3 7\n4 9\n5 11\n6 13\n7 15\n8 17\n9 19\n10 21\n11 23", "11"],["12 50\n0 1500\n9 1500\n18 1500\n27 1500\n36 1500\n45 1500\n54 1500\n63 1500\n72 1500\n81 1500\n90 1500\n99 1500", "148"]], witness:3
},
{
title:"The Black-to-White Breach", difficulty:100,
incident:"Mira needs to keep discovered objects while their links change during a memory scan.",
guide:"Objects and links form a directed graph: each link goes from an owner to a target. Roots are starting objects to retain. `color` is `0` for white (unseen), `1` for gray (waiting to scan), or `2` for black (already scanned). Shading changes white to gray. `owner` and `target` describe link slots. A write barrier is a check made when a link changes.",
symptom:"A link added after its owner was scanned can leave the new target unseen.",
task:"Simulate events one at a time, without concurrent threads. All objects start white, meaning unseen. Initial roots, the starting objects, become gray, meaning waiting to scan. Each link slot has a fixed owner and a target; `-1` means empty. `1` scans the lowest-ID gray object, if any: make it black, meaning already scanned, and shade its white outgoing targets gray. `2 edge child` replaces slot `edge`'s target. If its owner is black and the new target is white, immediately shade that target gray; an empty target shades nothing. This link-update check is the write barrier. `3 root` adds a root, shading it only if white. After all events, finish scanning gray objects by the same rule. Retain every object ever shaded, even if links are later removed. Do not recompute which objects can be reached using only the final links.",
input:"1. Read `n`, the object count; `m`, the link-slot count; `r`, the initial-root count; and `q`, the event count.\n2. Read `r` initial root IDs.\n3. Read `m` pairs `owner target`, in slot index order.\n4. Read `q` operations: `1`, `2 edge child`, or `3 root`. Object and slot indices start at 0.",
output:"Print `n` retained flags in object ID order: `1` for a nonwhite object and `0` for a white object.",
example:"For input `2 1 1 2 0 0 -1 1 2 0 1`, object 0 is scanned before its empty slot is linked to object 1. The new target must be shaded. The output is `1 1`.",
constraints:"`1 <= n <= 32`. `0 <= m <= 64`. `0 <= r <= n`. `0 <= q <= 100`. Initial roots are distinct. Owner, root and nonempty target IDs are from 0 through `n - 1`. `0 <= edge < m`. Targets, including `child`, may also be `-1`. A scan with no gray object does nothing. Each object is scanned at most once; cycles and self-links are allowed.",
defect:"The write barrier shades targets of gray owners instead of black owners, missing links added after an owner's scan.",
hints:["Which color means an owner's links have already been scanned?","A gray owner will be scanned later, but a black owner will not. What happens to a new white target attached to a black owner?","In the link-update check, require `color[owner[edge]] == 2`, plus a nonempty white `child`. Keep normal scanning, root shading and retention of previously shaded objects."],
c:`int n, m, r, q;
READ(n);
READ(m);
READ(r);
READ(q);
ARRAY(color,32);
ARRAY(owner,64);
ARRAY(target,64);
for (int i = 0; i < r; i++) {
    int root;
    READ(root);
    color[root] = 1;
}
for (int edge = 0; edge < m; edge++) {
    READ(owner[edge]);
    READ(target[edge]);
}
for (int event = 0; event < q; event++) {
    int op;
    READ(op);
    if (op == 1) {
        int chosen = -1;
        for (int node = 0; node < n; node++) {
            if (color[node] == 1) {
                chosen = node;
                break;
            }
        }
        if (chosen != -1) {
            color[chosen] = 2;
            for (int edge = 0; edge < m; edge++) {
                int child = target[edge];
                if (owner[edge] == chosen && child != -1 && color[child] == 0) {
                    color[child] = 1;
                }
            }
        }
    } else if (op == 2) {
        int edge, child;
        READ(edge);
        READ(child);
        target[edge] = child;
        if (color[owner[edge]] == 2 && child != -1 && color[child] == 0) {
            color[child] = 1;
        }
    } else {
        int root;
        READ(root);
        if (color[root] == 0) {
            color[root] = 1;
        }
    }
}
while (1 == 1) {
    int chosen = -1;
    for (int node = 0; node < n; node++) {
        if (color[node] == 1) {
            chosen = node;
            break;
        }
    }
    if (chosen == -1) {
        break;
    }
    color[chosen] = 2;
    for (int edge = 0; edge < m; edge++) {
        int child = target[edge];
        if (owner[edge] == chosen && child != -1 && color[child] == 0) {
            color[child] = 1;
        }
    }
}
for (int node = 0; node < n; node++) {
    OUT(color[node] == 0 ? 0 : 1);
}`,
py:`n = read_int()
m = read_int()
r = read_int()
q = read_int()
color = [0] * n
owner = [0] * m
target = [0] * m
for _ in range(r):
    root = read_int()
    color[root] = 1
for edge in range(m):
    owner[edge] = read_int()
    target[edge] = read_int()
for _ in range(q):
    op = read_int()
    if op == 1:
        chosen = -1
        for node in range(n):
            if color[node] == 1:
                chosen = node
                break
        if chosen != -1:
            color[chosen] = 2
            for edge in range(m):
                child = target[edge]
                if owner[edge] == chosen and child != -1 and color[child] == 0:
                    color[child] = 1
    elif op == 2:
        edge = read_int()
        child = read_int()
        target[edge] = child
        if color[owner[edge]] == 2 and child != -1 and color[child] == 0:
            color[child] = 1
    else:
        root = read_int()
        if color[root] == 0:
            color[root] = 1
while True:
    chosen = -1
    for node in range(n):
        if color[node] == 1:
            chosen = node
            break
    if chosen == -1:
        break
    color[chosen] = 2
    for edge in range(m):
        child = target[edge]
        if owner[edge] == chosen and child != -1 and color[child] == 0:
            color[child] = 1
for state in color:
    print(int(state != 0))`,
cbug:["color[owner[edge]] == 2","color[owner[edge]] == 1"], pybug:["color[owner[edge]] == 2","color[owner[edge]] == 1"],
probe:["4 2 1 2\n0\n0 -1\n2 3\n1\n2 0 2", "1 0 1 1"],
cases:[["2 1 1 2\n0\n0 -1\n1\n2 0 1","1 1"],["3 2 1 0\n0\n0 1\n1 2","1 1 1"],["3 2 1 3\n0\n0 -1\n1 2\n1\n2 0 1\n2 0 -1","1 1 1"],["2 1 0 2\n0 1\n1\n2 0 1","0 0"],["3 2 1 0\n0\n1 2\n2 1","1 0 0"],["2 2 1 2\n0\n0 0\n1 0\n1\n3 1","1 1"],["3 1 1 2\n0\n0 1\n2 0 2\n2 0 -1","1 0 0"],["3 1 1 3\n0\n0 1\n1\n2 0 -1\n3 2","1 1 1"],["32 32 1 0\n0\n0 1\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 9\n9 10\n10 11\n11 12\n12 13\n13 14\n14 15\n15 16\n16 17\n17 18\n18 19\n19 20\n20 21\n21 22\n22 23\n23 24\n24 25\n25 26\n26 27\n27 28\n28 29\n29 30\n30 31\n31 0", "1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1"]], witness:3
}
];
