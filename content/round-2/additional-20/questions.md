# Additional 20 — private review book

Unpublished local content; contains paid hints.

## 101. Checkpoint Ledger

ARRAYS · Difficulty 25 · Bounty 250

PROTOCOL REBELLION / THE KERNEL BREACH
The security AI AEGIS blocked traffic reports. Mira needs the total for each requested section.

What the code should do
For each query, add the readings from position `l` to position `r`, including both ends. Positions start at `0`. Answer queries in input order.

What's going wrong
Some reported sums include a reading outside the requested section.

How to read the code
A prefix sum is a total from the start of a list. `prefix[i]` stores the sum of the first `i` readings. The query loop uses this table.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of readings, and `q`, the number of queries.
2. Read `n` integer readings.
3. Read `q` pairs: `l`, the first position, and `r`, the last position.

Output
Print `q` sums in query order, separated by spaces.

Example explained
The readings are `4 -2 7 1`. Query `1 2` gives `5`; query `0 3` gives `10`. Print `5 10`.

Limits
`1 <= n <= 200`; `1 <= q <= 100`. Each reading is from `-1000` to `1000`. Each query has `0 <= l <= r < n`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
4 2
4 -2 7 1
1 2
0 3
```

Output:

```text
5 10
```

Input:

```text
1 1
-9
0 0
```

Output:

```text
-9
```

### Progressive hints (private)

1. Try a query whose first position is greater than `0`.
2. List the readings included in `prefix[l]` and `prefix[r + 1]`.
3. Use `prefix[r + 1] - prefix[l]`. Set `before`, the index of the total to subtract, to `l`.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int prefix[201] = {0};
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        prefix[i + 1] = prefix[i] + value;
    }
    for (int i = 0; i < q; i++) {
        int l, r;
        scanf("%d", &l);
        scanf("%d", &r);
        int before = l > 0 ? l - 1 : 0;
        printf("%d ", (prefix[r + 1] - prefix[before]));
    }
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int prefix[201] = {0};
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        prefix[i + 1] = prefix[i] + value;
    }
    for (int i = 0; i < q; i++) {
        int l, r;
        cin >> l;
        cin >> r;
        int before = l > 0 ? l - 1 : 0;
        cout << (prefix[r + 1] - prefix[before]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] prefix = new int[201];
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            prefix[i + 1] = prefix[i] + value;
        }
        for (int i = 0; i < q; i++) {
            int l, r;
            l = scanner.nextInt();
            r = scanner.nextInt();
            int before = l > 0 ? l - 1 : 0;
            System.out.print((prefix[r + 1] - prefix[before]) + " ");
        }
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
q = read_int()
prefix = [0] * (n + 1)
for i in range(n):
    prefix[i + 1] = prefix[i] + read_int()
result = []
for _ in range(q):
    l = read_int()
    r = read_int()
    before = max(0, l - 1)
    result.append(prefix[r + 1] - prefix[before])
print(*result)
```


---

## 102. Balanced Repair Bay

ARRAYS · Difficulty 30 · Bounty 300

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS blocked the repair bays. Patch is checking which bays have equal total load on both sides.

What the code should do
Count positions where the sum of all earlier readings equals the sum of all later readings. Exclude the reading at that position. An empty side has sum `0`. Positions start at `0`.

What's going wrong
The program reports the wrong number of balanced positions.

How to read the code
`a` holds the load readings. The scan uses `left` and `right` for side totals and `count` for the number of balanced positions.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of readings.
2. Read the `n` integer load readings in `a`.

Output
Print one integer: the number of balanced positions.

Example explained
For `1 3 5 2 2`, only position `2` balances: `1 + 3` equals `2 + 2`. Print `1`.

Limits
`1 <= n <= 200`. Each load reading is from `-1000` to `1000`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
5
1 3 5 2 2
```

Output:

```text
1
```

Input:

```text
3
0 0 0
```

Output:

```text
3
```

### Progressive hints (private)

1. A list with one reading has one balanced position, even if that reading is not `0`.
2. Check whether either side total includes the current reading when the comparison runs.
3. Subtract the current reading from `right` before comparing it with `left`. Add that reading to `left` after the comparison.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[200] = {0};
    int right = 0;
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
        right += a[i];
    }
    int left = 0;
    int count = 0;
    for (int i = 0; i < n; i++) {
        if (left == right) {
            count++;
        }
        right -= a[i];
        left += a[i];
    }
    printf("%d ", (count));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a[200] = {0};
    int right = 0;
    for (int i = 0; i < n; i++) {
        cin >> a[i];
        right += a[i];
    }
    int left = 0;
    int count = 0;
    for (int i = 0; i < n; i++) {
        if (left == right) {
            count++;
        }
        right -= a[i];
        left += a[i];
    }
    cout << (count) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] a = new int[200];
        int right = 0;
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
            right += a[i];
        }
        int left = 0;
        int count = 0;
        for (int i = 0; i < n; i++) {
            if (left == right) {
                count++;
            }
            right -= a[i];
            left += a[i];
        }
        System.out.print((count) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
a = [read_int() for _ in range(n)]
right = sum(a)
left = 0
count = 0
for value in a:
    if left == right:
        count += 1
    right -= value
    left += value
print(count)
```


---

## 103. Duplicate Address Band

ARRAYS · Difficulty 35 · Bounty 350

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS added duplicate entries to an address list. Ishan needs the count for a requested value.

What the code should do
Count how many entries equal `x` in the sorted list. Count every copy. Print `0` if `x` is absent.

What's going wrong
The program reports the wrong count when the requested value appears in the list.

How to read the code
`a` is sorted from smallest to largest, with equal values allowed. Two binary searches, which narrow a range around its middle, find the boundaries of the matching group.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of entries, and `x`, the value to count.
2. Read the `n` values in `a`, sorted from smallest to largest. Equal values are allowed.

Output
Print one integer: the number of entries equal to `x`.

Example explained
For `a = 1 2 2 2 5` and `x = 2`, there are three copies. Print `3`.

Limits
`1 <= n <= 2000`. Every entry and `x` is from `-10000` to `10000`. The list is sorted in nondecreasing order, meaning each value is at least the previous one.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
5 2
1 2 2 2 5
```

Output:

```text
3
```

Input:

```text
3 3
-2 0 4
```

Output:

```text
0
```

### Progressive hints (private)

1. Try a value that appears at several consecutive positions.
2. The first search finds the start of the equal group. The second must find the position after that group.
3. In the second search, move `lo`, the lower boundary, past `mid`, the middle position, when `a[mid] <= x`. The answer is the final `lo - first`.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, x;
    scanf("%d", &n);
    scanf("%d", &x);
    int a[2000] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    int lo = 0;
    int hi = n;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] < x) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    int first = lo;
    lo = 0;
    hi = n;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] < x) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    printf("%d ", (lo - first));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, x;
    cin >> n;
    cin >> x;
    int a[2000] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int lo = 0;
    int hi = n;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] < x) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    int first = lo;
    lo = 0;
    hi = n;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] < x) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    cout << (lo - first) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, x;
        n = scanner.nextInt();
        x = scanner.nextInt();
        int[] a = new int[2000];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int lo = 0;
        int hi = n;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (a[mid] < x) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        int first = lo;
        lo = 0;
        hi = n;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (a[mid] < x) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        System.out.print((lo - first) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
x = read_int()
a = [read_int() for _ in range(n)]
lo = 0
hi = n
while lo < hi:
    mid = (lo + hi) // 2
    if a[mid] < x:
        lo = mid + 1
    else:
        hi = mid
first = lo
lo = 0
hi = n
while lo < hi:
    mid = (lo + hi) // 2
    if a[mid] < x:
        lo = mid + 1
    else:
        hi = mid
print(lo - first)
```


---

## 104. Sealed Corridor Coverage

ARRAYS · Difficulty 40 · Bounty 400

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS blocked parts of a corridor. Mira needs the total blocked length.

What the code should do
Find the total length covered by at least one input interval. A half-open interval includes its start and excludes its end. Overlap counts only once; touching intervals leave no gap. An interval with equal endpoints has length `0`.

What's going wrong
An interval inside a longer interval can make the program lose already covered length.

How to read the code
`left` and `right` mark the span being combined. `total` stores the lengths of completed spans. The input arrives in order of starting position.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of intervals.
2. Read `n` pairs: `start`, the included start, and `end`, the excluded end. Starts are in nondecreasing order; ties may appear in any order. The code reads the first pair into `left` and `right`.

Output
Print one integer: the total covered length.

Example explained
The intervals `[1,8)`, `[2,3)`, and `[6,10)` cover `[1,10)`. Its length is `10 - 1`. Print `9`.

Limits
`1 <= n <= 200`. Every interval has `0 <= start <= end <= 10000`. Input starts never decrease.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
3
1 8
2 3
6 10
```

Output:

```text
9
```

Input:

```text
2
0 2
4 7
```

Output:

```text
5
```

### Progressive hints (private)

1. Try a short interval completely inside a longer one.
2. Adding an overlapping interval cannot remove length that was already covered.
3. When intervals overlap or touch, keep the larger of `right` and `end` as the new `right`. Only a gap ends the current span.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int left, right;
    scanf("%d", &left);
    scanf("%d", &right);
    int total = 0;
    for (int i = 1; i < n; i++) {
        int start, end;
        scanf("%d", &start);
        scanf("%d", &end);
        if (start > right) {
            total += right - left;
            left = start;
            right = end;
        } else if (end >= start) {
            right = end;
        }
    }
    total += right - left;
    printf("%d ", (total));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int left, right;
    cin >> left;
    cin >> right;
    int total = 0;
    for (int i = 1; i < n; i++) {
        int start, end;
        cin >> start;
        cin >> end;
        if (start > right) {
            total += right - left;
            left = start;
            right = end;
        } else if (end >= start) {
            right = end;
        }
    }
    total += right - left;
    cout << (total) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int left, right;
        left = scanner.nextInt();
        right = scanner.nextInt();
        int total = 0;
        for (int i = 1; i < n; i++) {
            int start, end;
            start = scanner.nextInt();
            end = scanner.nextInt();
            if (start > right) {
                total += right - left;
                left = start;
                right = end;
            } else if (end >= start) {
                right = end;
            }
        }
        total += right - left;
        System.out.print((total) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
left = read_int()
right = read_int()
total = 0
for _ in range(1, n):
    start = read_int()
    end = read_int()
    if start > right:
        total += right - left
        left = start
        right = end
    elif end >= start:
        right = end
total += right - left
print(total)
```


---

## 105. Maintenance Slot Picker

ARRAYS · Difficulty 46 · Bounty 460

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS reduced maintenance time. Mira needs as many separate service slots as possible.

What the code should do
Choose the largest possible number of slots with no overlapping time. Each slot is half-open: it includes `start` and excludes `end`. A slot may start exactly when another ends. Each listed slot may be chosen at most once.

What's going wrong
The program can choose slots that overlap in time.

How to read the code
The input lists slots by finish time. `last` is the time boundary used to decide whether a slot is available. `count` records how many slots have been chosen.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of slots.
2. Read `n` pairs: `start`, the start time, and `end`, the finish time. Finish times never decrease; tied finish times may appear in any order.

Output
Print one integer: the largest number of slots that can be chosen. Do not print the slots themselves.

Example explained
From `[0,3)`, `[1,4)`, and `[3,5)`, choose the first and third slots. They meet without overlapping. Print `2`.

Limits
`1 <= n <= 2000`. Each slot has `0 <= start < end <= 10000`. Input is sorted by nondecreasing `end`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
3
0 3
1 4
3 5
```

Output:

```text
2
```

Input:

```text
3
0 1
1 2
2 3
```

Output:

```text
3
```

### Progressive hints (private)

1. After choosing a slot, when does its occupied time end?
2. Check whether `last` records the start or the finish of the chosen slot.
3. After accepting a slot, assign `end` to `last`. Accept a later slot when `start >= last`; rejected slots must leave `last` unchanged.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int last = -1;
    int count = 0;
    for (int i = 0; i < n; i++) {
        int start, end;
        scanf("%d", &start);
        scanf("%d", &end);
        if (start >= last) {
            count++;
            last = start;
        }
    }
    printf("%d ", (count));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int last = -1;
    int count = 0;
    for (int i = 0; i < n; i++) {
        int start, end;
        cin >> start;
        cin >> end;
        if (start >= last) {
            count++;
            last = start;
        }
    }
    cout << (count) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int last = -1;
        int count = 0;
        for (int i = 0; i < n; i++) {
            int start, end;
            start = scanner.nextInt();
            end = scanner.nextInt();
            if (start >= last) {
                count++;
                last = start;
            }
        }
        System.out.print((count) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
last = -1
count = 0
for _ in range(n):
    start = read_int()
    end = read_int()
    if start >= last:
        count += 1
        last = start
print(count)
```


---

## 106. Aligned Rescue Span

SYSTEMS · Difficulty 25 · Bounty 250

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs working memory inside one listed free range.

What the code should do
Find the lowest byte address divisible by `alignment` where `size` consecutive bytes fit entirely inside one free range. Each range includes its left endpoint and excludes its right endpoint. Bytes skipped before the aligned start use space in that range. A block may end exactly at the right endpoint. Print `-1` if no range can hold it.

What's going wrong
The program can choose a start whose requested bytes extend past the free range.

How to read the code
An address is a byte position. An aligned address is divisible by `alignment`. `candidate` is a possible start. Each half-open range `[left, right)` includes `left` and excludes `right`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the free-range count; `alignment`, the required divisor; and `size`, the bytes needed.
2. Read `n` pairs `left right`, in increasing order of `left`.

Output
Print the lowest valid start address, or `-1` if none exists.

Example explained
For input `1 4 3 1 7`, start 4 holds bytes 4, 5 and 6. The output is `4`.

Limits
`1 <= n <= 40`. `1 <= alignment, size <= 64`. `0 <= left < right <= 1024`. Free ranges do not overlap.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
1 4 3
1 7
```

Output:

```text
4
```

Input:

```text
1 1 2
0 5
```

Output:

```text
0
```

### Progressive hints (private)

1. An aligned start can still leave too little space.
2. Compare the space after `candidate` with the space after `left`.
3. Accept only when `candidate + size <= right`. Keep the first valid result, since ranges arrive in address order.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, alignment, size;
    scanf("%d", &n);
    scanf("%d", &alignment);
    scanf("%d", &size);
    int answer = -1;
    for (int i = 0; i < n; i++) {
        int left, right;
        scanf("%d", &left);
        scanf("%d", &right);
        int candidate = left;
        while (candidate % alignment != 0) {
            candidate++;
        }
        if (answer == -1 && left + size <= right) {
            answer = candidate;
        }
    }
    printf("%d ", (answer));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, alignment, size;
    cin >> n;
    cin >> alignment;
    cin >> size;
    int answer = -1;
    for (int i = 0; i < n; i++) {
        int left, right;
        cin >> left;
        cin >> right;
        int candidate = left;
        while (candidate % alignment != 0) {
            candidate++;
        }
        if (answer == -1 && left + size <= right) {
            answer = candidate;
        }
    }
    cout << (answer) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, alignment, size;
        n = scanner.nextInt();
        alignment = scanner.nextInt();
        size = scanner.nextInt();
        int answer = -1;
        for (int i = 0; i < n; i++) {
            int left, right;
            left = scanner.nextInt();
            right = scanner.nextInt();
            int candidate = left;
            while (candidate % alignment != 0) {
                candidate++;
            }
            if (answer == -1 && left + size <= right) {
                answer = candidate;
            }
        }
        System.out.print((answer) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
alignment = read_int()
size = read_int()
answer = -1
for _ in range(n):
    left = read_int()
    right = read_int()
    candidate = left
    while candidate % alignment != 0:
        candidate += 1
    if answer == -1 and left + size <= right:
        answer = candidate
print(answer)
```


---

## 107. Fragment Tailroom

SYSTEMS · Difficulty 29 · Bounty 290

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan needs to divide a message into pieces that fit the link.

What the code should do
Send the message as fragments, each with the given header. Start at byte offset 0. If all remaining data fits within the total fragment limit minus the header size, send it as the final fragment. Otherwise send the largest positive multiple of 8 that fits that data limit, and repeat. Print each fragment's starting offset divided by 8, its data length in bytes, and `1` if more fragments follow or `0` if it is last. Only nonfinal data lengths must be multiples of 8.

What's going wrong
The program can split a final piece that would fit in one fragment.

How to read the code
Payload means message data, excluding the header sent with each fragment. `mtu` limits total fragment bytes, `header` is the header size, and `limit` is the remaining data space. `offset` counts data bytes already sent.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `payload`, the message's data length; `mtu`, the total fragment limit; and `header`, the header size in every fragment. All sizes are in bytes.

Output
Print three integers per fragment, in send order: offset in units of 8 bytes, data length, and the more-fragments flag.

Example explained
For input `19 20 4`, the data limit is 16 bytes. Send lengths 16 and 3, starting at byte offsets 0 and 16. The output is `0 16 1 2 3 0`.

Limits
`1 <= payload <= 256`. `0 <= header <= 40`. `header + 8 <= mtu <= 104`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
19 20 4
```

Output:

```text
0 16 1 2 3 0
```

Input:

```text
8 8 0
```

Output:

```text
0 8 0
```

### Progressive hints (private)

1. Does the last fragment need a data length divisible by 8?
2. Compare a remainder of 19 bytes with `limit = 20` and `chunk = 16`, the rounded nonfinal length.
3. Test the final remainder against `limit`, not `chunk`. Use `chunk` only when another fragment must follow.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int payload, mtu, header;
    scanf("%d", &payload);
    scanf("%d", &mtu);
    scanf("%d", &header);
    int limit = mtu - header;
    int chunk = limit / 8 * 8;
    int offset = 0;
    while (payload > 0) {
        int take = chunk;
        if (payload <= chunk) {
            take = payload;
        }
        printf("%d ", (offset / 8));
        printf("%d ", (take));
        printf("%d ", (payload > take ? 1 : 0));
        offset += take;
        payload -= take;
    }
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int payload, mtu, header;
    cin >> payload;
    cin >> mtu;
    cin >> header;
    int limit = mtu - header;
    int chunk = limit / 8 * 8;
    int offset = 0;
    while (payload > 0) {
        int take = chunk;
        if (payload <= chunk) {
            take = payload;
        }
        cout << (offset / 8) << ' ';
        cout << (take) << ' ';
        cout << (payload > take ? 1 : 0) << ' ';
        offset += take;
        payload -= take;
    }
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int payload, mtu, header;
        payload = scanner.nextInt();
        mtu = scanner.nextInt();
        header = scanner.nextInt();
        int limit = mtu - header;
        int chunk = limit / 8 * 8;
        int offset = 0;
        while (payload > 0) {
            int take = chunk;
            if (payload <= chunk) {
                take = payload;
            }
            System.out.print((offset / 8) + " ");
            System.out.print((take) + " ");
            System.out.print((payload > take ? 1 : 0) + " ");
            offset += take;
            payload -= take;
        }
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

payload = read_int()
mtu = read_int()
header = read_int()
limit = mtu - header
chunk = limit // 8 * 8
offset = 0
while payload > 0:
    take = chunk
    if payload <= chunk:
        take = payload
    print(offset // 8, take, int(payload > take))
    offset += take
    payload -= take
```


---

## 108. Wrapped Burst Admission

SYSTEMS · Difficulty 35 · Bounty 350

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to accept each arriving group of values all at once.

What the code should do
Start with an empty queue of capacity `cap`. Values leave oldest first. `1 k` followed by `k` values adds the whole group at the back if at least `k` positions are free. Otherwise discard the whole group and count one rejection. `2 k` removes up to `k` oldest values, removing all if fewer are waiting. Values may wrap from the array's last position to position 0. Print the final rejection count and queue contents.

What's going wrong
The queue can reject a burst despite having enough free positions overall.

How to read the code
A queue removes the oldest value first. The circular array `queue` reuses positions after removal. `head` is the front position, `tail` the next insertion position, and `count` the number waiting. A burst is one group of new values.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `cap`, the capacity, and `q`, the operation count.
2. Read `q` operations: `1 k` and its `k` values, or `2 k`.

Output
Print `rejected`, the number of rejected groups; `count`, the queue length; then waiting values from oldest to newest. If empty, print only the first two numbers.

Example explained
For input `3 3 1 2 8 9 2 1 1 2 4 5`, the final queue is 9, 4, 5. The output is `0 3 9 4 5`.

Limits
`1 <= cap <= 32`. `0 <= q <= 100`. `1 <= k <= 32`. Values are from -100 through 100. Each operation is `1` or `2`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
3 3
1 2 8 9
2 1
1 2 4 5
```

Output:

```text
0 3 9 4 5
```

Input:

```text
2 2
1 2 1 2
1 1 3
```

Output:

```text
1 2 1 2
```

### Progressive hints (private)

1. Append near the array's end, remove some values, then append another group.
2. Space after `tail` is only part of the free space in a circular queue.
3. Use `count + k <= cap` for admission. The existing wrap operation already places each accepted value correctly.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int cap, q;
    scanf("%d", &cap);
    scanf("%d", &q);
    int queue[32] = {0};
    int head = 0;
    int tail = 0;
    int count = 0;
    int rejected = 0;
    for (int i = 0; i < q; i++) {
        int op, k;
        scanf("%d", &op);
        scanf("%d", &k);
        if (op == 1) {
            int accept = count + k <= cap && tail + k <= cap ? 1 : 0;
            if (accept == 0) {
                rejected++;
            }
            for (int j = 0; j < k; j++) {
                int value;
                scanf("%d", &value);
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
    printf("%d ", (rejected));
    printf("%d ", (count));
    for (int i = 0; i < count; i++) {
        printf("%d ", (queue[(head + i) % cap]));
    }
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int cap, q;
    cin >> cap;
    cin >> q;
    int queue[32] = {0};
    int head = 0;
    int tail = 0;
    int count = 0;
    int rejected = 0;
    for (int i = 0; i < q; i++) {
        int op, k;
        cin >> op;
        cin >> k;
        if (op == 1) {
            int accept = count + k <= cap && tail + k <= cap ? 1 : 0;
            if (accept == 0) {
                rejected++;
            }
            for (int j = 0; j < k; j++) {
                int value;
                cin >> value;
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
    cout << (rejected) << ' ';
    cout << (count) << ' ';
    for (int i = 0; i < count; i++) {
        cout << (queue[(head + i) % cap]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int cap, q;
        cap = scanner.nextInt();
        q = scanner.nextInt();
        int[] queue = new int[32];
        int head = 0;
        int tail = 0;
        int count = 0;
        int rejected = 0;
        for (int i = 0; i < q; i++) {
            int op, k;
            op = scanner.nextInt();
            k = scanner.nextInt();
            if (op == 1) {
                int accept = count + k <= cap && tail + k <= cap ? 1 : 0;
                if (accept == 0) {
                    rejected++;
                }
                for (int j = 0; j < k; j++) {
                    int value;
                    value = scanner.nextInt();
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
        System.out.print((rejected) + " ");
        System.out.print((count) + " ");
        for (int i = 0; i < count; i++) {
            System.out.print((queue[(head + i) % cap]) + " ");
        }
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

cap = read_int()
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
        accept = count + k <= cap and tail + k <= cap
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
    print(queue[(head + i) % cap])
```


---

## 109. End-Around Carry

SYSTEMS · Difficulty 43 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan needs a check value for a list of transmitted numbers.

What the code should do
Add all `n` input words. While the total is above 65535, replace it with the remainder after division by 65536 plus the whole-number quotient of that division. Repeat until the total is at most 65535. The checksum, or check value, is 65535 minus that final total. Under this rule, outputs `0` and `65535` are distinct.

What's going wrong
The checksum can be wrong when the sum exceeds the 16-bit range.

How to read the code
A checksum is a value computed to help detect changes. Each word here is an unsigned 16-bit integer, from 0 through 65535. The running sum is `sum` in C, C++ and Java; `total` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the word count.
2. Read the `n` words as decimal integers.

Output
Print one decimal integer from 0 through 65535: the checksum.

Example explained
For input `2 65535 1`, the sum 65536 becomes 1. The output is `65534`.

Limits
`0 <= n <= 100`. Each word is from 0 through 65535. The sum fits a signed 32-bit integer.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
2
65535 1
```

Output:

```text
65534
```

Input:

```text
2
1 2
```

Output:

```text
65532
```

### Progressive hints (private)

1. When a sum exceeds 65535, should the excess high part disappear?
2. Split the sum into its remainder and whole-number quotient after division by 65536.
3. Add both parts: `sum % 65536 + sum / 65536` in C, C++ and Java; `total % 65536 + total // 65536` in Python. Repeat before subtracting the result from `65535`.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int sum = 0;
    for (int i = 0; i < n; i++) {
        int word;
        scanf("%d", &word);
        sum += word;
    }
    while (sum > 65535) {
        sum = sum % 65536;
    }
    printf("%d ", (65535 - sum));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int sum = 0;
    for (int i = 0; i < n; i++) {
        int word;
        cin >> word;
        sum += word;
    }
    while (sum > 65535) {
        sum = sum % 65536;
    }
    cout << (65535 - sum) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int sum = 0;
        for (int i = 0; i < n; i++) {
            int word;
            word = scanner.nextInt();
            sum += word;
        }
        while (sum > 65535) {
            sum = sum % 65536;
        }
        System.out.print((65535 - sum) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
total = 0
for _ in range(n):
    total += read_int()
while total > 65535:
    total = total % 65536
print(65535 - total)
```


---

## 110. Translation After Remap

SYSTEMS · Difficulty 50 · Bounty 500

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan needs address reads to follow the current memory mappings.

What the code should do
There are `pages` virtual pages, each a fixed-size group of bytes, initially unmapped. A mapping assigns a virtual page to a physical frame of the same size. `1 x y` maps page `x` to frame `y`, replacing any old mapping. `2 x 0` removes page `x`'s mapping. `3 x 0` translates virtual byte address `x`: its page index is the whole-number quotient by page size, and its offset within that page is the remainder. Print the mapped frame number times page size plus that offset, or `-1` if unmapped. Keep the supplied translation cache, which saves mappings for reuse, and make every read follow the latest mapping.

What's going wrong
After a mapping changes, a read can still use the page's old physical frame.

How to read the code
A virtual page is a numbered group of program bytes. A frame is a same-sized group in physical memory. `mapping` stores current page-to-frame choices. A cache saves translations for reuse. `cached` marks saved entries. Saved frames are in `frameAt` in C, C++ and Java; `frame_at` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `pages`, the page count; the page size, named `pageSize` in C, C++ and Java; `page_size` in Python; then `q`, the operation count.
2. Read `q` triples `op x y`. For `op = 1`, `x` is a page and `y` a frame. For `op = 2`, `x` is a page and `y` is `0`. For `op = 3`, `x` is an address and `y` is `0`.

Output
Print one integer per operation `3`, in operation order.

Example explained
For input `1 4 4 1 0 2 3 1 0 1 0 5 3 1 0`, address 1 maps first to 9, then to 21. The output is `9 21`.

Limits
`1 <= pages <= 32`. Page size is from 1 through 64. `1 <= q <= 100`, with at least one read. Page indices start at 0 and are below `pages`. Frames are from 0 through 1000. Read addresses are nonnegative and less than the page count times page size.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
1 4 4
1 0 2
3 1 0
1 0 5
3 1 0
```

Output:

```text
9 21
```

Input:

```text
2 8 2
1 1 3
3 15 0
```

Output:

```text
31
```

### Progressive hints (private)

1. Read the same page before and after a remap or unmap.
2. Can a saved frame outlive the mapping it describes? Saved frames are in `frameAt` in C, C++ and Java; `frame_at` in Python.
3. On both map and unmap, set `cached[x]` to `0`. The next read will use the current mapping or report `-1`.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int pages, pageSize, q;
    scanf("%d", &pages);
    scanf("%d", &pageSize);
    scanf("%d", &q);
    int mapping[32] = {0};
    int cached[32] = {0};
    int frameAt[32] = {0};
    for (int i = 0; i < pages; i++) {
        mapping[i] = -1;
    }
    for (int i = 0; i < q; i++) {
        int op, x, y;
        scanf("%d", &op);
        scanf("%d", &x);
        scanf("%d", &y);
        if (op == 1 || op == 2) {
            mapping[x] = op == 1 ? y : -1;
            cached[x] = cached[x];
        } else {
            int page = x / pageSize;
            int offset = x % pageSize;
            if (cached[page] == 0 && mapping[page] != -1) {
                cached[page] = 1;
                frameAt[page] = mapping[page];
            }
            if (cached[page] == 1) {
                printf("%d ", (frameAt[page] * pageSize + offset));
            } else {
                printf("%d ", (-1));
            }
        }
    }
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int pages, pageSize, q;
    cin >> pages;
    cin >> pageSize;
    cin >> q;
    int mapping[32] = {0};
    int cached[32] = {0};
    int frameAt[32] = {0};
    for (int i = 0; i < pages; i++) {
        mapping[i] = -1;
    }
    for (int i = 0; i < q; i++) {
        int op, x, y;
        cin >> op;
        cin >> x;
        cin >> y;
        if (op == 1 || op == 2) {
            mapping[x] = op == 1 ? y : -1;
            cached[x] = cached[x];
        } else {
            int page = x / pageSize;
            int offset = x % pageSize;
            if (cached[page] == 0 && mapping[page] != -1) {
                cached[page] = 1;
                frameAt[page] = mapping[page];
            }
            if (cached[page] == 1) {
                cout << (frameAt[page] * pageSize + offset) << ' ';
            } else {
                cout << (-1) << ' ';
            }
        }
    }
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int pages, pageSize, q;
        pages = scanner.nextInt();
        pageSize = scanner.nextInt();
        q = scanner.nextInt();
        int[] mapping = new int[32];
        int[] cached = new int[32];
        int[] frameAt = new int[32];
        for (int i = 0; i < pages; i++) {
            mapping[i] = -1;
        }
        for (int i = 0; i < q; i++) {
            int op, x, y;
            op = scanner.nextInt();
            x = scanner.nextInt();
            y = scanner.nextInt();
            if (op == 1 || op == 2) {
                mapping[x] = op == 1 ? y : -1;
                cached[x] = cached[x];
            } else {
                int page = x / pageSize;
                int offset = x % pageSize;
                if (cached[page] == 0 && mapping[page] != -1) {
                    cached[page] = 1;
                    frameAt[page] = mapping[page];
                }
                if (cached[page] == 1) {
                    System.out.print((frameAt[page] * pageSize + offset) + " ");
                } else {
                    System.out.print((-1) + " ");
                }
            }
        }
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

pages = read_int()
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
        cached[x] = cached[x]
    else:
        page = x // page_size
        offset = x % page_size
        if cached[page] == 0 and mapping[page] != -1:
            cached[page] = 1
            frame_at[page] = mapping[page]
        if cached[page] == 1:
            print(frame_at[page] * page_size + offset)
        else:
            print(-1)
```


---

## 111. Twin Arrival Ledger

GRAPHS · Difficulty 25 · Bounty 250

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted route counts. Mira checks how many shortest routes reach each relay.

What the code should do
For every relay, count shortest routes from `s` (the start) along two-way cables. A route is a sequence of relays joined by cables; its length is its number of cables. Different relay sequences count separately, including routes tied for shortest length. Print `0` for an unreachable relay. The zero-cable route from `s` to itself counts once.

What's going wrong
One of several equally short routes to a relay can be lost.

How to read the code
`queue` lists relays waiting to be explored. `distance` stores cable counts, and `ways` stores route counts.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of cables), and `s` (the start).
2. Read `m` pairs `u v`, the endpoints of each two-way cable.

Output
Print `n` route counts separated by spaces, for relays `0` through `n - 1` in order.

Example explained
In the first sample, `0 -> 1 -> 3` and `0 -> 2 -> 3` are both shortest routes to relay `3`. Print `1 1 1 2`. In the second sample, only start `2` is reachable, so print `0 0 1`.

Limits
`1 <= n <= 16`; `0 <= m <= n * (n - 1) / 2`. Relays are numbered `0` through `n - 1`. No cable is repeated or joins a relay to itself. Counts fit a signed 32-bit integer.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
4 4 0
0 1
0 2
1 3
2 3
```

Output:

```text
1 1 1 2
```

Input:

```text
3 1 2
0 1
```

Output:

```text
0 0 1
```

### Progressive hints (private)

1. Trace the two shortest routes to relay `3` in the first sample.
2. A later arrival at the same shortest distance can represent more routes.
3. When `distance[v] == distance[u] + 1`, add `ways[u]` to `ways[v]` instead of replacing it. These are the route counts for predecessor `u` and destination `v`.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    int edge[256] = {0};
    int distance[16] = {0};
    int ways[16] = {0};
    int queue[16] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
                    ways[v] = ways[u];
                }
            }
        }
    }
    for (int v = 0; v < n; v++) {
        printf("%d ", (ways[v]));
    }
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s;
    cin >> n;
    cin >> m;
    cin >> s;
    int edge[256] = {0};
    int distance[16] = {0};
    int ways[16] = {0};
    int queue[16] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
                    ways[v] = ways[u];
                }
            }
        }
    }
    for (int v = 0; v < n; v++) {
        cout << (ways[v]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        int[] edge = new int[256];
        int[] distance = new int[16];
        int[] ways = new int[16];
        int[] queue = new int[16];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                        ways[v] = ways[u];
                    }
                }
            }
        }
        for (int v = 0; v < n; v++) {
            System.out.print((ways[v]) + " ");
        }
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
            ways[v] = ways[u]
print(*ways)
```


---

## 112. Repair Front Collision

GRAPHS · Difficulty 34 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has separated repair stations. Ishan checks the smallest distance between any two stations.

What the code should do
Find the fewest two-way cables on a route between any two different listed stations. Choose the smallest distance over all station pairs. If pairs tie, print only the distance. Print `-1` if no two listed stations can reach each other.

What's going wrong
The reported distance can be shorter than every real route between stations.

How to read the code
`owner` records which station's search first reaches a relay. `distance` stores distance from that station, `best` tracks the answer, and `queue` holds relays waiting to be explored.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of cables), and `k` (the number of stations).
2. Read `k` different station relay numbers.
3. Read `m` pairs `u v`, the endpoints of each two-way cable.

Output
Print the smallest station-to-station cable count, or `-1` if no pair is connected.

Example explained
The first sample is chain `0-1-2-3`, with stations `0` and `3`. Their route uses three cables, so print `3`. The second sample has no cables, so print `-1`.

Limits
`2 <= n <= 32`; `2 <= k <= n`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Stations are distinct. No cable is repeated or joins a relay to itself.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
4 3 2
0 3
0 1
1 2
2 3
```

Output:

```text
3
```

Input:

```text
3 0 2
0 2
```

Output:

```text
-1
```

### Progressive hints (private)

1. Two searches can meet at opposite ends of a cable.
2. `distance[u]` and `distance[v]` end at different relays when their `owner` entries differ.
3. Include the joining cable: the route length is `distance[u] + distance[v] + 1`. Keep the smallest such value in `best`.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, k;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &k);
    int edge[1024] = {0};
    int owner[32] = {0};
    int distance[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        owner[i] = -1;
    }
    int head = 0;
    int tail = 0;
    for (int i = 0; i < k; i++) {
        int s;
        scanf("%d", &s);
        owner[s] = s;
        queue[tail++] = s;
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
                    int candidate = distance[u] + distance[v];
                    if (candidate < best) {
                        best = candidate;
                    }
                }
            }
        }
    }
    printf("%d ", (best == 1000000 ? -1 : best));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, k;
    cin >> n;
    cin >> m;
    cin >> k;
    int edge[1024] = {0};
    int owner[32] = {0};
    int distance[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        owner[i] = -1;
    }
    int head = 0;
    int tail = 0;
    for (int i = 0; i < k; i++) {
        int s;
        cin >> s;
        owner[s] = s;
        queue[tail++] = s;
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
                    int candidate = distance[u] + distance[v];
                    if (candidate < best) {
                        best = candidate;
                    }
                }
            }
        }
    }
    cout << (best == 1000000 ? -1 : best) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, k;
        n = scanner.nextInt();
        m = scanner.nextInt();
        k = scanner.nextInt();
        int[] edge = new int[1024];
        int[] owner = new int[32];
        int[] distance = new int[32];
        int[] queue = new int[32];
        for (int i = 0; i < n; i++) {
            owner[i] = -1;
        }
        int head = 0;
        int tail = 0;
        for (int i = 0; i < k; i++) {
            int s;
            s = scanner.nextInt();
            owner[s] = s;
            queue[tail++] = s;
        }
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                        int candidate = distance[u] + distance[v];
                        if (candidate < best) {
                            best = candidate;
                        }
                    }
                }
            }
        }
        System.out.print((best == 1000000 ? -1 : best) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
            candidate = distance[u] + distance[v]
            best = min(best, candidate)
print(-1 if best == 1000000 else best)
```


---

## 113. Cycle Admission Desk

GRAPHS · Difficulty 39 · Bounty 390

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted cable approvals. Ishan checks requests against the cables already accepted.

What the code should do
Start with `n` separate relays. Process requests in input order. Accept a two-way cable only if its endpoints cannot already reach each other through accepted cables. Otherwise reject it. Count rejected requests. A request joining a relay to itself is rejected. A later request for an already accepted cable is also rejected.

What's going wrong
A cable can be accepted even though an existing route already connects its endpoints.

How to read the code
A connected component contains a relay and all relays reachable from it. `parent` stores chains of group labels. The loops follow those chains to representatives `a` and `b`, then update `rejected` (the rejection count) or join groups.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of requests).
2. Read `m` pairs `u v`, the endpoints of each requested cable, in processing order.

Output
Print one integer: the number of rejected requests.

Example explained
In the first sample, accepted requests `0 1` and `1 2` already connect `0` to `2`. Reject request `0 2` and print `1`. The second sample joins two separate pairs and prints `0`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`, and endpoints are valid. Repeated requests and requests joining a relay to itself are allowed. The supplied group searches use loops.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
3 3
0 1
1 2
0 2
```

Output:

```text
1
```

Input:

```text
4 2
0 1
2 3
```

Output:

```text
0
```

### Progressive hints (private)

1. Two relays can share a group even when their next parent labels differ.
2. Compare the ends of the two `parent` chains, rather than just their first links.
3. Use `a == b` for the group comparison. The loops have already made `a` and `b` the representatives of the endpoint groups.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int parent[32] = {0};
    for (int i = 0; i < n; i++) {
        parent[i] = i;
    }
    int rejected = 0;
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        int a = u;
        int b = v;
        while (parent[a] != a) {
            a = parent[a];
        }
        while (parent[b] != b) {
            b = parent[b];
        }
        if (parent[u] == parent[v]) {
            rejected++;
        } else {
            parent[a] = b;
        }
    }
    printf("%d ", (rejected));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int parent[32] = {0};
    for (int i = 0; i < n; i++) {
        parent[i] = i;
    }
    int rejected = 0;
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        int a = u;
        int b = v;
        while (parent[a] != a) {
            a = parent[a];
        }
        while (parent[b] != b) {
            b = parent[b];
        }
        if (parent[u] == parent[v]) {
            rejected++;
        } else {
            parent[a] = b;
        }
    }
    cout << (rejected) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] parent = new int[32];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
        }
        int rejected = 0;
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            int a = u;
            int b = v;
            while (parent[a] != a) {
                a = parent[a];
            }
            while (parent[b] != b) {
                b = parent[b];
            }
            if (parent[u] == parent[v]) {
                rejected++;
            } else {
                parent[a] = b;
            }
        }
        System.out.print((rejected) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
    if parent[u] == parent[v]:
        rejected += 1
    else:
        parent[a] = b
print(rejected)
```


---

## 114. Cooling Tree Core

GRAPHS · Difficulty 43 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted cooling routes. Ishan checks the best relay positions.

What the code should do
The two-way cables form a tree: they connect all relays and give exactly one route between any two without repeating a relay. Distance is the number of cables on that route. For each relay, consider its greatest distance to any relay. Print every relay whose greatest distance is as small as possible. These are the tree's centres. Print all ties; a tree has one centre or two adjacent centres.

What's going wrong
The chosen relays can depend on the order in which outer relays are processed.

How to read the code
`degree` stores neighbour counts. `queue` holds leaves, meaning relays with at most one remaining neighbour. `remaining` tracks the number of relays left while outer layers are removed.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of cables).
2. Read `m` pairs `u v`, the endpoints of each two-way cable. Here `m == n - 1`.

Output
Print the centre relay numbers separated by spaces, in increasing order. A one-relay tree prints `0`.

Example explained
In the first sample, chain `0-1-2-3` has two tied centres, so print `1 2`. The five-relay chain in the second sample has one centre, so print `2`.

Limits
`1 <= n <= 32`; `m == n - 1`. Relays are numbered `0` through `n - 1`. The distinct cables form one tree; no cable joins a relay to itself.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
4 3
0 1
1 2
2 3
```

Output:

```text
1 2
```

Input:

```text
5 4
0 1
1 2
2 3
3 4
```

Output:

```text
2
```

### Progressive hints (private)

1. Changing the order of the leaf numbers should not change the central positions.
2. Leaves discovered during a removal layer belong to the next layer.
3. Set `batch` (the layer size) to the number of leaves waiting at the start of the round. Remove that whole batch before checking `remaining` again.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[1024] = {0};
    int degree[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
        int batch = 1;
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
                printf("%d ", (v));
            }
        }
    }
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int edge[1024] = {0};
    int degree[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
        int batch = 1;
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
                cout << (v) << ' ';
            }
        }
    }
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[1024];
        int[] degree = new int[32];
        int[] queue = new int[32];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
            int batch = 1;
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
                    System.out.print((v) + " ");
                }
            }
        }
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
    batch = 1
    remaining -= batch
    for _ in range(batch):
        u = queue[head]
        head += 1
        for v in edge[u]:
            degree[v] -= 1
            if degree[v] == 1:
                queue.append(v)
print(*sorted(queue[head:]))
```


---

## 115. Tentative Alarm Queue

GRAPHS · Difficulty 49 · Bounty 490

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has changed link delays. Ishan checks the minimum travel cost to each relay.

What the code should do
For every relay, find the minimum total cost of a directed route from `s` (the start). Add all link costs on the route. Links may cost `0`. The zero-link route at `s` costs `0`. Print `-1` for an unreachable relay. If routes tie, print only their minimum cost.

What's going wrong
A low-numbered relay can be treated as final before a cheaper route to it is considered.

How to read the code
`distance` stores costs found so far and `done` marks relays treated as final. Each outer pass selects a relay, scans its outgoing links, and updates costs.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).
2. Read `m` triples `u v w`, a link from `u` to `v` only, with cost `w`.

Output
Print `n` minimum costs separated by spaces, for relays `0` through `n - 1` in order. Use `-1` for each unreachable relay.

Example explained
In the first sample, route `0 -> 2 -> 1` costs `1 + 1 = 2`, less than direct cost `9`. Print `0 2 1`. In the second sample, relay `2` is unreachable, so print `0 2 -1`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No directed link is repeated or joins a relay to itself.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
3 3 0
0 1 9
0 2 1
2 1 1
```

Output:

```text
0 2 1
```

Input:

```text
3 1 0
0 1 2
```

Output:

```text
0 2 -1
```

### Progressive hints (private)

1. A relay's number does not measure travel cost.
2. Once `done` marks a relay final, later routes cannot improve its cost in this code.
3. Select the unused relay with the smallest entry in `distance`, not the smallest relay number. Nonnegative link costs make that selected cost final.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    int edge[1024] = {0};
    int distance[32] = {0};
    int done[32] = {0};
    for (int i = 0; i < 1024; i++) {
        edge[i] = -1;
    }
    for (int i = 0; i < m; i++) {
        int u, v, w;
        scanf("%d", &u);
        scanf("%d", &v);
        scanf("%d", &w);
        edge[u * 32 + v] = w;
    }
    for (int i = 0; i < n; i++) {
        distance[i] = 1000000;
    }
    distance[s] = 0;
    for (int step = 0; step < n; step++) {
        int u = -1;
        for (int v = 0; v < n; v++) {
            if (done[v] == 0 && (u == -1 || v < u)) {
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
        printf("%d ", (distance[v] == 1000000 ? -1 : distance[v]));
    }
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s;
    cin >> n;
    cin >> m;
    cin >> s;
    int edge[1024] = {0};
    int distance[32] = {0};
    int done[32] = {0};
    for (int i = 0; i < 1024; i++) {
        edge[i] = -1;
    }
    for (int i = 0; i < m; i++) {
        int u, v, w;
        cin >> u;
        cin >> v;
        cin >> w;
        edge[u * 32 + v] = w;
    }
    for (int i = 0; i < n; i++) {
        distance[i] = 1000000;
    }
    distance[s] = 0;
    for (int step = 0; step < n; step++) {
        int u = -1;
        for (int v = 0; v < n; v++) {
            if (done[v] == 0 && (u == -1 || v < u)) {
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
        cout << (distance[v] == 1000000 ? -1 : distance[v]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        int[] edge = new int[1024];
        int[] distance = new int[32];
        int[] done = new int[32];
        for (int i = 0; i < 1024; i++) {
            edge[i] = -1;
        }
        for (int i = 0; i < m; i++) {
            int u, v, w;
            u = scanner.nextInt();
            v = scanner.nextInt();
            w = scanner.nextInt();
            edge[u * 32 + v] = w;
        }
        for (int i = 0; i < n; i++) {
            distance[i] = 1000000;
        }
        distance[s] = 0;
        for (int step = 0; step < n; step++) {
            int u = -1;
            for (int v = 0; v < n; v++) {
                if (done[v] == 0 && (u == -1 || v < u)) {
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
            System.out.print((distance[v] == 1000000 ? -1 : distance[v]) + " ");
        }
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
        if done[v] == 0 and (u == -1 or v < u):
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
```


---

## 116. Clock Without a Wall

LOGIC · Difficulty 25 · Bounty 250

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan is checking event numbers in a recovery log.

What the code should do
Start `clock`, the logical clock, at `0`. A logical clock counts events rather than time of day. A local event adds one. A received event sets the clock to one more than the larger of its current value and the received timestamp. Process all events in input order.

What's going wrong
Receiving a message can move the event number too far forward.

How to read the code
The event type is `type` in C, C++ and Java, and `kind` in Python. `remote` is the sender's event number. A local event has no sender number to use.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the event count.
2. Read `n` pairs: event type (`type` in C, C++ and Java; `kind` in Python), then `remote`, the sender's timestamp. Type `0` is local and supplies an ignored `remote` value of `0`; type `1` is received.

Output
Print the final `clock` value. With no events, print `0`.

Example explained
Input `3 0 0 1 5 1 2` gives clock values `1`, `6`, then `7`. Output: `7`.

Limits
`0 <= n <= 100`. Each event type is `0` or `1`. `0 <= remote <= 1000`; local events supply `0`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
3
0 0
1 5
1 2
```

Output:

```text
7
```

Input:

```text
2
1 9
0 0
```

Output:

```text
11
```

### Progressive hints (private)

1. Try a received event when `clock` is already positive.
2. Two event numbers describe positions in two logs; their values should not be added together.
3. If `remote` is greater than `clock`, assign it to `clock`. Then increment `clock` once for the event.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int clock = 0;
    for (int i = 0; i < n; i++) {
        int type, remote;
        scanf("%d", &type);
        scanf("%d", &remote);
        if (type == 1 && remote > clock) {
            clock += remote;
        }
        clock++;
    }
    printf("%d ", (clock));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int clock = 0;
    for (int i = 0; i < n; i++) {
        int type, remote;
        cin >> type;
        cin >> remote;
        if (type == 1 && remote > clock) {
            clock += remote;
        }
        clock++;
    }
    cout << (clock) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int clock = 0;
        for (int i = 0; i < n; i++) {
            int type, remote;
            type = scanner.nextInt();
            remote = scanner.nextInt();
            if (type == 1 && remote > clock) {
                clock += remote;
            }
            clock++;
        }
        System.out.print((clock) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
clock = 0
for _ in range(n):
    kind, remote = read_int(), read_int()
    if kind == 1 and remote > clock:
        clock += remote
    clock += 1
print(clock)
```


---

## 117. Barrier Generations

LOGIC · Difficulty 32 · Bounty 320

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is checking repeated meetings of calibration workers.

What the code should do
A barrier is a meeting that completes when all `n` workers have arrived. `generation` numbers these meetings, starting at `0`. An arrival counts only for the current generation and only once per worker in that generation. When all workers arrive, advance to the next generation with no arrivals. Ignore repeated arrivals and arrivals reporting an older or future generation. Process signals in input order.

What's going wrong
Workers counted in the first meeting can be ignored in later meetings.

How to read the code
`who` identifies a worker, and `reported` is the meeting number in its signal. `seen` records arrivals, while `count` is how many workers are waiting in the current meeting.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the worker count, and `q`, the signal count.
2. Read `q` pairs: `who`, the worker ID, and `reported`, its generation number.

Output
Print the current `generation` and its waiting-worker `count`, in that order, separated by a space.

Example explained
Input `2 3 0 0 1 0 0 1` completes generation `0`, then counts worker `0` in generation `1`. Output: `1 1`.

Limits
`1 <= n <= 16`. `0 <= q <= 100`. `0 <= who < n`. `0 <= reported <= 100`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
2 3
0 0
1 0
0 1
```

Output:

```text
1 1
```

Input:

```text
3 3
0 0
0 0
1 0
```

Output:

```text
0 2
```

### Progressive hints (private)

1. Use the same worker in two successive generations.
2. A worker's arrival flag applies to one generation only.
3. When a generation completes, advance `generation`, reset `count`, and clear every entry in `seen`.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int seen[16] = {0};
    int generation = 0, count = 0;
    for (int i = 0; i < q; i++) {
        int who, reported;
        scanf("%d", &who);
        scanf("%d", &reported);
        if (reported == generation && seen[who] == 0) {
            seen[who] = 1;
            count++;
            if (count == n) {
                generation++;
                count = 0;
                for (int j = 0; j < n; j++) {
                    seen[j] = seen[j];
                }
            }
        }
    }
    printf("%d ", (generation));
    printf("%d ", (count));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int seen[16] = {0};
    int generation = 0, count = 0;
    for (int i = 0; i < q; i++) {
        int who, reported;
        cin >> who;
        cin >> reported;
        if (reported == generation && seen[who] == 0) {
            seen[who] = 1;
            count++;
            if (count == n) {
                generation++;
                count = 0;
                for (int j = 0; j < n; j++) {
                    seen[j] = seen[j];
                }
            }
        }
    }
    cout << (generation) << ' ';
    cout << (count) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] seen = new int[16];
        int generation = 0, count = 0;
        for (int i = 0; i < q; i++) {
            int who, reported;
            who = scanner.nextInt();
            reported = scanner.nextInt();
            if (reported == generation && seen[who] == 0) {
                seen[who] = 1;
                count++;
                if (count == n) {
                    generation++;
                    count = 0;
                    for (int j = 0; j < n; j++) {
                        seen[j] = seen[j];
                    }
                }
            }
        }
        System.out.print((generation) + " ");
        System.out.print((count) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, q = read_int(), read_int()
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
                seen[j] = seen[j]
print(generation, count)
```


---

## 118. Half-Range Sequence Fence

LOGIC · Difficulty 37 · Bounty 370

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan is checking packet numbers that wrap through zero.

What the code should do
Start with `current`, the accepted sequence number. For each `candidate` in input order, measure the forward distance from `current` on the circle `0` through `255`. Accept distances `1` through `127`, replacing `current` and counting one acceptance. Reject distance `0` (a duplicate), distance `128` (exactly half the circle), and distances `129` through `255`. Rejection leaves `current` unchanged.

What's going wrong
A packet exactly half the circle away can be accepted and change later decisions.

How to read the code
Sequence numbers label packets. After `255` comes `0`. `distance` counts forward steps, and `accepted` counts accepted candidates rather than the starting number.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `current`, the starting number, and `q`, the candidate count.
2. Read `q` values of `candidate`, in arrival order.

Output
Print the final `current` and `accepted` count, in that order, separated by a space.

Example explained
Input `250 2 3 131` accepts `3`, which is `9` steps forward. It rejects `131`, which is then `128` steps forward. Output: `3 1`.

Limits
`0 <= current, candidate <= 255`. `0 <= q <= 100`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
250 2
3 131
```

Output:

```text
3 1
```

Input:

```text
0 2
127 254
```

Output:

```text
254 2
```

### Progressive hints (private)

1. Compare a forward distance of `127` with one of `128`.
2. Exactly half a circle is ambiguous and must be rejected.
3. Accept only when `distance > 0 && distance < 128` in C, C++ and Java, or the equivalent condition in Python.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int current, q;
    scanf("%d", &current);
    scanf("%d", &q);
    int accepted = 0;
    for (int i = 0; i < q; i++) {
        int candidate;
        scanf("%d", &candidate);
        int distance = (candidate - current + 256) % 256;
        if (distance > 0 && distance <= 128) {
            current = candidate;
            accepted++;
        }
    }
    printf("%d ", (current));
    printf("%d ", (accepted));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int current, q;
    cin >> current;
    cin >> q;
    int accepted = 0;
    for (int i = 0; i < q; i++) {
        int candidate;
        cin >> candidate;
        int distance = (candidate - current + 256) % 256;
        if (distance > 0 && distance <= 128) {
            current = candidate;
            accepted++;
        }
    }
    cout << (current) << ' ';
    cout << (accepted) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int current, q;
        current = scanner.nextInt();
        q = scanner.nextInt();
        int accepted = 0;
        for (int i = 0; i < q; i++) {
            int candidate;
            candidate = scanner.nextInt();
            int distance = (candidate - current + 256) % 256;
            if (distance > 0 && distance <= 128) {
                current = candidate;
                accepted++;
            }
        }
        System.out.print((current) + " ");
        System.out.print((accepted) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

current, q = read_int(), read_int()
accepted = 0
for _ in range(q):
    candidate = read_int()
    distance = (candidate - current + 256) % 256
    if distance > 0 and distance <= 128:
        current = candidate
        accepted += 1
print(current, accepted)
```


---

## 119. Quiet Shift Planner

LOGIC · Difficulty 43 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is choosing repair days with a rest day between them.

What the code should do
Days are numbered from `0` in input order. Each day offers an optional repair with a nonnegative `value`. Choose days with the largest total value, with no two chosen day numbers differing by one. Choosing no days is allowed and gives `0`.

What's going wrong
The reported total can include repairs on consecutive days.

How to read the code
`skip` and `take` describe the best totals so far when the latest day was skipped or chosen. The answer is a value total; no day list is required.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of days.
2. Read `n` repair values in day order, each read as `value`.

Output
Print the largest possible total value. With no days, print `0`.

Example explained
Input `3 5 6 5` is best served by days `0` and `2`, for `5 + 5`. Output: `10`.

Limits
`0 <= n <= 16`. Each `value` is from `0` to `1000`.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
3
5 6 5
```

Output:

```text
10
```

Input:

```text
1
8
```

Output:

```text
8
```

### Progressive hints (private)

1. If today is chosen, can yesterday also be chosen?
2. The best total through yesterday may include yesterday's repair.
3. Build today's `take` from yesterday's `skip` only. Build today's `skip` from the larger old state, using saved values for both updates.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int skip = 0, take = 0;
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        int oldSkip = skip, oldTake = take;
        skip = oldSkip;
        if (oldTake > skip) {
            skip = oldTake;
        }
        take = skip + value;
    }
    int answer = skip;
    if (take > answer) {
        answer = take;
    }
    printf("%d ", (answer));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int skip = 0, take = 0;
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        int oldSkip = skip, oldTake = take;
        skip = oldSkip;
        if (oldTake > skip) {
            skip = oldTake;
        }
        take = skip + value;
    }
    int answer = skip;
    if (take > answer) {
        answer = take;
    }
    cout << (answer) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int skip = 0, take = 0;
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            int oldSkip = skip, oldTake = take;
            skip = oldSkip;
            if (oldTake > skip) {
                skip = oldTake;
            }
            take = skip + value;
        }
        int answer = skip;
        if (take > answer) {
            answer = take;
        }
        System.out.print((answer) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
skip = 0
take = 0
for _ in range(n):
    value = read_int()
    old_skip, old_take = skip, take
    skip = max(old_skip, old_take)
    take = skip + value
print(max(skip, take))
```


---

## 120. Unordered Power Credits

LOGIC · Difficulty 50 · Bounty 500

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is counting ways to pay an exact energy charge.

What the code should do
A denomination is the value of one credit. Use unlimited copies of the `n` distinct denominations to pay exactly `amount`. Two payments are the same when they use the same count of every denomination, regardless of insertion order. Count the empty payment once when `amount = 0`.

What's going wrong
The counter treats different orders of the same credits as different payments.

How to read the code
`coins` holds the denomination values. `ways[total]` counts payments for exactly `total`, rather than payments up to that total.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the denomination count, and `amount`, the required payment.
2. Read the `n` distinct values in `coins`, in any order.

Output
Print the number of different payments for exactly `amount`. Print `0` if no payment is possible.

Example explained
Input `2 3 1 2` has two payments: `1 + 1 + 1` and `1 + 2`. Reversing `1 + 2` adds no new payment. Output: `2`.

Limits
`1 <= n <= 5`. `0 <= amount <= 30`. Denominations are distinct integers from `1` to `30`. The answer fits a signed 32-bit integer.

You can solve this mission on its own, in any order.

### Samples

Input:

```text
2 3
1 2
```

Output:

```text
2
```

Input:

```text
1 3
2
```

Output:

```text
0
```

### Progressive hints (private)

1. List the payments for amount `3` using denominations `1` and `2`.
2. Each combination of credit counts must be built in only one denomination order.
3. Put the denomination loop outside the amount loop. For each denomination, update totals upward to allow unlimited copies without counting insertion orders.

### c starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, amount;
    scanf("%d", &n);
    scanf("%d", &amount);
    int coins[5] = {0};
    int ways[31] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &coins[i]);
    }
    ways[0] = 1;
    for (int total = 1; total <= amount; total++) {
        for (int i = 0; i < n; i++) {
            if (coins[i] <= total) {
                ways[total] += ways[total - coins[i]];
            }
        }
    }
    printf("%d ", (ways[amount]));
    printf("\n");
    return 0;
}
```

### cpp starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, amount;
    cin >> n;
    cin >> amount;
    int coins[5] = {0};
    int ways[31] = {0};
    for (int i = 0; i < n; i++) {
        cin >> coins[i];
    }
    ways[0] = 1;
    for (int total = 1; total <= amount; total++) {
        for (int i = 0; i < n; i++) {
            if (coins[i] <= total) {
                ways[total] += ways[total - coins[i]];
            }
        }
    }
    cout << (ways[amount]) << ' ';
    cout << '\n';
    return 0;
}
```

### java starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, amount;
        n = scanner.nextInt();
        amount = scanner.nextInt();
        int[] coins = new int[5];
        int[] ways = new int[31];
        for (int i = 0; i < n; i++) {
            coins[i] = scanner.nextInt();
        }
        ways[0] = 1;
        for (int total = 1; total <= amount; total++) {
            for (int i = 0; i < n; i++) {
                if (coins[i] <= total) {
                    ways[total] += ways[total - coins[i]];
                }
            }
        }
        System.out.print((ways[amount]) + " ");
        System.out.println();
    }
}
```

### python starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, amount = read_int(), read_int()
coins = [read_int() for _ in range(n)]
ways = [0] * (amount + 1)
ways[0] = 1
for total in range(1, amount + 1):
    for i in range(n):
        if coins[i] <= total:
            ways[total] += ways[total - coins[i]]
print(ways[amount])
```
