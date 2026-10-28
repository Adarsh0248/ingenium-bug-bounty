# Protocol Rebellion — Round 2 organiser review book

Private draft: includes unpurchased hints. References and hidden cases are in pack.json.

## 1. Checkpoint Ledger

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

### Public samples

Sample 1 input:

```text
4 2
4 -2 7 1
1 2
0 3
```

Expected output:

```text
5 10
```

Sample 2 input:

```text
1 1
-9
0 0
```

Expected output:

```text
-9
```

### Progressive hints (private until purchased)

1. Try a query whose first position is greater than `0`.
2. List the readings included in `prefix[l]` and `prefix[r + 1]`.
3. Use `prefix[r + 1] - prefix[l]`. Set `before`, the index of the total to subtract, to `l`.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 2. Balanced Repair Bay

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

### Public samples

Sample 1 input:

```text
5
1 3 5 2 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
3
0 0 0
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. A list with one reading has one balanced position, even if that reading is not `0`.
2. Check whether either side total includes the current reading when the comparison runs.
3. Subtract the current reading from `right` before comparing it with `left`. Add that reading to `left` after the comparison.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 3. Dark-Pixel Budget

ARRAYS · Difficulty 38 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS turned off pixels in a test strip. Mira can turn on only a limited number at once.

What the code should do
Find the longest consecutive section with at most `k` zeros. A value of `1` does not use the budget. An empty section is allowed and has length `0`.

What's going wrong
The reported section can contain more zeros than the allowed number.

How to read the code
A window is a consecutive section of a list. `left` and `right` mark its ends, `dark` counts its zeros, and `best` stores the longest valid length found.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of pixels, and `k`, the maximum allowed number of zeros.
2. Read the `n` values in `a`, each `0` or `1`.

Output
Print one integer: the longest valid section length.

Example explained
For `1 0 0 1 1` with `k = 1`, the last three values are `0 1 1`. They contain one zero. Print `3`.

Limits
`1 <= n <= 2000`; `0 <= k <= n`. Every value is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 1
1 0 0 1 1
```

Expected output:

```text
3
```

Sample 2 input:

```text
3 0
0 0 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try an all-zero list with `k = 0`.
2. Compare `dark`, the current zero count, with the allowed count `k`.
3. Move `left` while `dark > k`. A section with `k + 1` zeros is already too large for the budget.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, k;
    scanf("%d", &n);
    scanf("%d", &k);
    int a[2000] = {0};
    int left = 0;
    int dark = 0;
    int best = 0;
    for (int right = 0; right < n; right++) {
        scanf("%d", &a[right]);
        if (a[right] == 0) {
            dark++;
        }
        while (dark > k + 1) {
            if (a[left] == 0) {
                dark--;
            }
            left++;
        }
        if (right - left + 1 > best) {
            best = right - left + 1;
        }
    }
    printf("%d ", (best));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, k;
    cin >> n;
    cin >> k;
    int a[2000] = {0};
    int left = 0;
    int dark = 0;
    int best = 0;
    for (int right = 0; right < n; right++) {
        cin >> a[right];
        if (a[right] == 0) {
            dark++;
        }
        while (dark > k + 1) {
            if (a[left] == 0) {
                dark--;
            }
            left++;
        }
        if (right - left + 1 > best) {
            best = right - left + 1;
        }
    }
    cout << (best) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, k;
        n = scanner.nextInt();
        k = scanner.nextInt();
        int[] a = new int[2000];
        int left = 0;
        int dark = 0;
        int best = 0;
        for (int right = 0; right < n; right++) {
            a[right] = scanner.nextInt();
            if (a[right] == 0) {
                dark++;
            }
            while (dark > k + 1) {
                if (a[left] == 0) {
                    dark--;
                }
                left++;
            }
            if (right - left + 1 > best) {
                best = right - left + 1;
            }
        }
        System.out.print((best) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
k = read_int()
a = [read_int() for _ in range(n)]
left = 0
dark = 0
best = 0
for right in range(n):
    if a[right] == 0:
        dark += 1
    while dark > k + 1:
        if a[left] == 0:
            dark -= 1
        left += 1
    best = max(best, right - left + 1)
print(best)
```

---

## 4. Rescue Phrase

ARRAYS · Difficulty 45 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS blocked a rescue message. Ishan needs the shortest log section containing all letters of its key.

What the code should do
Find the shortest consecutive part of `s` that contains at least as many copies of each letter as `key`. The letters may appear in any order, and extra letters are allowed. Print its length, or `-1` if none exists.

What's going wrong
The program can miss a shorter section even when it has enough copies of every required letter.

How to read the code
A window is a consecutive part of `s`, the log word. `need` counts required copies of each letter, `have` counts copies in the window, and `missing` tracks copies still needed.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `s`, the log word.
2. Read `key`, the word whose letter counts must be met. Both words use lowercase English letters.

Output
Print one integer: the shortest valid length, or `-1` if no section works.

Example explained
For `s = aaab` and `key = aab`, the last three letters form `aab`. Print `3`.

Limits
Each of `s` and `key` contains from `1` to `120` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
aaab aab
```

Expected output:

```text
3
```

Sample 2 input:

```text
abc z
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Compare removing a spare copy of a letter with removing a required copy.
2. After a letter leaves, having exactly the required count is still enough.
3. After decreasing `have[y]`, increase `missing` only if `have[y] < need[y]`. Here `y` identifies the letter that left.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    char key[257];
    scanf("%256s", s);
    scanf("%256s", key);
    int need[26] = {0};
    int have[26] = {0};
    for (int i = 0; i < (int)strlen(key); i++) {
        need[key[i] - 'a']++;
    }
    int missing = (int)strlen(key);
    int left = 0;
    int best = (int)strlen(s) + 1;
    for (int right = 0; right < (int)strlen(s); right++) {
        int x = s[right] - 'a';
        if (have[x] < need[x]) {
            missing--;
        }
        have[x]++;
        while (missing == 0 && left <= right) {
            if (right - left + 1 < best) {
                best = right - left + 1;
            }
            int y = s[left] - 'a';
            have[y]--;
            if (have[y] <= need[y]) {
                missing++;
            }
            left++;
        }
    }
    if (best > (int)strlen(s)) {
        printf("%d ", (-1));
    } else {
        printf("%d ", (best));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    string key;
    cin >> s;
    cin >> key;
    int need[26] = {0};
    int have[26] = {0};
    for (int i = 0; i < (int)key.size(); i++) {
        need[key[i] - 'a']++;
    }
    int missing = (int)key.size();
    int left = 0;
    int best = (int)s.size() + 1;
    for (int right = 0; right < (int)s.size(); right++) {
        int x = s[right] - 'a';
        if (have[x] < need[x]) {
            missing--;
        }
        have[x]++;
        while (missing == 0 && left <= right) {
            if (right - left + 1 < best) {
                best = right - left + 1;
            }
            int y = s[left] - 'a';
            have[y]--;
            if (have[y] <= need[y]) {
                missing++;
            }
            left++;
        }
    }
    if (best > (int)s.size()) {
        cout << (-1) << ' ';
    } else {
        cout << (best) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s;
        String key;
        s = scanner.next();
        key = scanner.next();
        int[] need = new int[26];
        int[] have = new int[26];
        for (int i = 0; i < key.length(); i++) {
            need[key.charAt(i) - 'a']++;
        }
        int missing = key.length();
        int left = 0;
        int best = s.length() + 1;
        for (int right = 0; right < s.length(); right++) {
            int x = s.charAt(right) - 'a';
            if (have[x] < need[x]) {
                missing--;
            }
            have[x]++;
            while (missing == 0 && left <= right) {
                if (right - left + 1 < best) {
                    best = right - left + 1;
                }
                int y = s.charAt(left) - 'a';
                have[y]--;
                if (have[y] <= need[y]) {
                    missing++;
                }
                left++;
            }
        }
        if (best > s.length()) {
            System.out.print((-1) + " ");
        } else {
            System.out.print((best) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

s = read_word()
key = read_word()
need = [0] * 26
have = [0] * 26
for ch in key:
    need[ord(ch) - ord('a')] += 1
missing = len(key)
left = 0
best = len(s) + 1
for right in range(len(s)):
    x = ord(s[right]) - ord('a')
    if have[x] < need[x]:
        missing -= 1
    have[x] += 1
    while missing == 0 and left <= right:
        best = min(best, right - left + 1)
        y = ord(s[left]) - ord('a')
        have[y] -= 1
        if have[y] <= need[y]:
            missing += 1
        left += 1
print(-1 if best > len(s) else best)
```

---

## 5. Zero-Length Phantom

ARRAYS · Difficulty 42 · Bounty 420

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS changed the power ledger. Patch must count sections with a requested total.

What the code should do
Count all nonempty consecutive sections whose sum equals `target`. Count different start or end positions separately, even when their values are equal. Sections may overlap, and readings may be negative.

What's going wrong
When the requested total is `0`, the program counts sections that contain no readings.

How to read the code
A prefix total is a sum from the start of the list. `prefix` is the running total. `seen` counts stored totals; adding `2000` maps a total to an array index.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of readings, and `target`, the required sum.
2. Read `n` integer readings.

Output
Print one integer: the number of matching nonempty sections.

Example explained
For `1 -1 0` with `target = 0`, the matching sections are positions `0..1`, `2..2`, and `0..2`. Positions start at `0`. Print `3`.

Limits
`1 <= n <= 200`; `-2000 <= target <= 2000`. Each reading is from `-10` to `10`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 0
1 -1 0
```

Expected output:

```text
3
```

Sample 2 input:

```text
3 4
2 2 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. What section does a prefix total paired with itself describe?
2. A nonempty section must start before its end. Check which prefix totals are already in `seen`.
3. Look up `prefix - target` before adding the current `prefix` to `seen`. Keep the initial total of `0` recorded once for sections starting at position `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, target;
    scanf("%d", &n);
    scanf("%d", &target);
    int seen[4001] = {0};
    seen[2000] = 1;
    int prefix = 0;
    int count = 0;
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        prefix += value;
        seen[prefix + 2000]++;
        int wanted = prefix - target + 2000;
        if (wanted >= 0 && wanted <= 4000) {
            count += seen[wanted];
        }
    }
    printf("%d ", (count));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, target;
    cin >> n;
    cin >> target;
    int seen[4001] = {0};
    seen[2000] = 1;
    int prefix = 0;
    int count = 0;
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        prefix += value;
        seen[prefix + 2000]++;
        int wanted = prefix - target + 2000;
        if (wanted >= 0 && wanted <= 4000) {
            count += seen[wanted];
        }
    }
    cout << (count) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, target;
        n = scanner.nextInt();
        target = scanner.nextInt();
        int[] seen = new int[4001];
        seen[2000] = 1;
        int prefix = 0;
        int count = 0;
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            prefix += value;
            seen[prefix + 2000]++;
            int wanted = prefix - target + 2000;
            if (wanted >= 0 && wanted <= 4000) {
                count += seen[wanted];
            }
        }
        System.out.print((count) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
target = read_int()
seen = [0] * 4001
seen[2000] = 1
prefix = 0
count = 0
for _ in range(n):
    prefix += read_int()
    seen[prefix + 2000] += 1
    wanted = prefix - target + 2000
    if 0 <= wanted <= 4000:
        count += seen[wanted]
print(count)
```

---

## 6. Duplicate Address Band

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

### Public samples

Sample 1 input:

```text
5 2
1 2 2 2 5
```

Expected output:

```text
3
```

Sample 2 input:

```text
3 3
-2 0 4
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try a value that appears at several consecutive positions.
2. The first search finds the start of the equal group. The second must find the position after that group.
3. In the second search, move `lo`, the lower boundary, past `mid`, the middle position, when `a[mid] <= x`. The answer is the final `lo - first`.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 7. Sealed Corridor Coverage

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

### Public samples

Sample 1 input:

```text
3
1 8
2 3
6 10
```

Expected output:

```text
9
```

Sample 2 input:

```text
2
0 2
4 7
```

Expected output:

```text
5
```

### Progressive hints (private until purchased)

1. Try a short interval completely inside a longer one.
2. Adding an overlapping interval cannot remove length that was already covered.
3. When intervals overlap or touch, keep the larger of `right` and `end` as the new `right`. Only a gap ends the current span.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 8. Echo Pair Collapse

ARRAYS · Difficulty 36 · Bounty 360

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS added repeated letters to a command. Patch removes adjacent equal pairs.

What the code should do
Read the word from left to right. If the next letter equals the last letter of the current result, remove that last letter and discard the next letter. Otherwise append the next letter. Print the final length, which may be `0`.

What's going wrong
Deleting an equal pair can also delete a letter that should remain.

How to read the code
A stack stores items so the most recently added item is removed first. `stack` holds the letters kept so far; the C variable `size` is their count.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `s`, one word of lowercase English letters.

Output
Print one integer: the number of letters left after all letters have been processed.

Example explained
For `abbaca`, removing `bb` gives `aaca`, then removing `aa` gives `ca`. Print `2`.

Limits
`s` contains from `1` to `256` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
abbaca
```

Expected output:

```text
2
```

Sample 2 input:

```text
abba
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. When a match is found, has the incoming letter already been stored?
2. A cancelled pair has one incoming letter and one letter already in `stack`.
3. On a match, remove exactly one saved letter: decrease C's `size` by one, or call Python's `stack.pop()` once. Discard the incoming letter too.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    scanf("%256s", s);
    int stack[256] = {0};
    int size = 0;
    for (int i = 0; i < (int)strlen(s); i++) {
        int ch = s[i];
        if (size > 0 && stack[size - 1] == ch) {
            size = size > 1 ? size - 2 : 0;
        } else {
            stack[size] = ch;
            size++;
        }
    }
    printf("%d ", (size));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    cin >> s;
    int stack[256] = {0};
    int size = 0;
    for (int i = 0; i < (int)s.size(); i++) {
        int ch = s[i];
        if (size > 0 && stack[size - 1] == ch) {
            size = size > 1 ? size - 2 : 0;
        } else {
            stack[size] = ch;
            size++;
        }
    }
    cout << (size) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s;
        s = scanner.next();
        int[] stack = new int[256];
        int size = 0;
        for (int i = 0; i < s.length(); i++) {
            int ch = s.charAt(i);
            if (size > 0 && stack[size - 1] == ch) {
                size = size > 1 ? size - 2 : 0;
            } else {
                stack[size] = ch;
                size++;
            }
        }
        System.out.print((size) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

s = read_word()
stack = []
for ch in s:
    if stack and stack[-1] == ch:
        stack.pop()
        if stack:
            stack.pop()
    else:
        stack.append(ch)
print(len(stack))
```

---

## 9. Rotated Vault Index

ARRAYS · Difficulty 48 · Bounty 480

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS rotated a sorted address list. Ishan needs its smallest value.

What the code should do
Print the smallest value in a rotated sorted list. Rotation moves some starting entries to the end without changing their order. Before rotation, the list was sorted from smallest to largest. Duplicates and a rotation of zero places are allowed.

What's going wrong
Repeated values can make the search miss the smallest entry.

How to read the code
`lo` and `hi` mark an inclusive search range, so both endpoints are inside it. Each step compares `a[mid]`, the middle value, with `a[hi]`, the rightmost value.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the list length.
2. Read the `n` values of the rotated list `a`.

Output
Print one integer: the smallest value, rather than its position.

Example explained
For `1 0 1 1 1`, the smallest value is `0`. Print `0`.

Limits
`1 <= n <= 2000`. Each value is from `-10000` to `10000`. Some rotation of `a` is nondecreasing, meaning each value is at least the previous one.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
1 0 1 1 1
```

Expected output:

```text
0
```

Sample 2 input:

```text
5
4 5 1 2 3
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Try a list with many equal values and one smaller value.
2. If `a[mid] == a[hi]`, removing the right endpoint still leaves an equal value at `mid`.
3. On equality, decrease `hi` by one. Do not increase `lo`: the value at `lo` may be the only minimum.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[2000] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    int lo = 0;
    int hi = n - 1;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] < a[hi]) {
            hi = mid;
        } else if (a[mid] > a[hi]) {
            lo = mid + 1;
        } else {
            lo++;
        }
    }
    printf("%d ", (a[lo]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a[2000] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int lo = 0;
    int hi = n - 1;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] < a[hi]) {
            hi = mid;
        } else if (a[mid] > a[hi]) {
            lo = mid + 1;
        } else {
            lo++;
        }
    }
    cout << (a[lo]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] a = new int[2000];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int lo = 0;
        int hi = n - 1;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (a[mid] < a[hi]) {
                hi = mid;
            } else if (a[mid] > a[hi]) {
                lo = mid + 1;
            } else {
                lo++;
            }
        }
        System.out.print((a[lo]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
a = [read_int() for _ in range(n)]
lo = 0
hi = n - 1
while lo < hi:
    mid = (lo + hi) // 2
    if a[mid] < a[hi]:
        hi = mid
    elif a[mid] > a[hi]:
        lo = mid + 1
    else:
        lo += 1
print(a[lo])
```

---

## 10. Moving Threat Ceiling

ARRAYS · Difficulty 56 · Bounty 560

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS disrupted a traffic monitor. Mira needs the largest reading in each fixed-size group.

What the code should do
For every consecutive group of exactly `k` readings, print its largest value. Process groups from the first starting position to the last. Equal maximum values still produce just one value per group.

What's going wrong
A reading outside the current group can still be reported as its maximum.

How to read the code
A window is a consecutive group of readings. `deque` stores possible maximum positions. A deque allows removal from either end; `head` and `tail` mark its stored range.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of readings, and `k`, the group size.
2. Read the `n` integer readings in `a`.

Output
Print `n - k + 1` maximum values from left to right, separated by spaces.

Example explained
For `9 1 2 3` with `k = 2`, the groups are `9 1`, `1 2`, and `2 3`. Print `9 2 3`.

Limits
`1 <= k <= n <= 2000`. Each reading is from `-10000` to `10000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 2
9 1 2 3
```

Expected output:

```text
9 2 3
```

Sample 2 input:

```text
3 3
-5 -2 -7
```

Expected output:

```text
-2
```

### Progressive hints (private until purchased)

1. Follow a large reading until it leaves the current group.
2. When the current right endpoint is `r`, the first included position is `r - k + 1`.
3. Remove front positions from `deque` while they are at most `r - k`. A position equal to `r - k` is already outside the group.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, k;
    scanf("%d", &n);
    scanf("%d", &k);
    int a[2000] = {0};
    int deque[2000] = {0};
    int head = 0;
    int tail = 0;
    for (int r = 0; r < n; r++) {
        scanf("%d", &a[r]);
        while (head < tail && deque[head] < r - k) {
            head++;
        }
        while (head < tail && a[deque[tail - 1]] <= a[r]) {
            tail--;
        }
        deque[tail] = r;
        tail++;
        if (r >= k - 1) {
            printf("%d ", (a[deque[head]]));
        }
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, k;
    cin >> n;
    cin >> k;
    int a[2000] = {0};
    int deque[2000] = {0};
    int head = 0;
    int tail = 0;
    for (int r = 0; r < n; r++) {
        cin >> a[r];
        while (head < tail && deque[head] < r - k) {
            head++;
        }
        while (head < tail && a[deque[tail - 1]] <= a[r]) {
            tail--;
        }
        deque[tail] = r;
        tail++;
        if (r >= k - 1) {
            cout << (a[deque[head]]) << ' ';
        }
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, k;
        n = scanner.nextInt();
        k = scanner.nextInt();
        int[] a = new int[2000];
        int[] deque = new int[2000];
        int head = 0;
        int tail = 0;
        for (int r = 0; r < n; r++) {
            a[r] = scanner.nextInt();
            while (head < tail && deque[head] < r - k) {
                head++;
            }
            while (head < tail && a[deque[tail - 1]] <= a[r]) {
                tail--;
            }
            deque[tail] = r;
            tail++;
            if (r >= k - 1) {
                System.out.print((a[deque[head]]) + " ");
            }
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
k = read_int()
a = [read_int() for _ in range(n)]
deque = [0] * n
head = 0
tail = 0
result = []
for r in range(n):
    while head < tail and deque[head] < r - k:
        head += 1
    while head < tail and a[deque[tail - 1]] <= a[r]:
        tail -= 1
    deque[tail] = r
    tail += 1
    if r >= k - 1:
        result.append(a[deque[head]])
print(*result)
```

---

## 11. Cooling Alarm Horizon

ARRAYS · Difficulty 51 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS hid temperature rises. Patch needs the wait until each first higher reading.

What the code should do
For each position `pos`, find the first later position `i` whose reading is strictly greater. Print the distance `i - pos`, or `0` if no such position exists. Equal readings do not qualify. Positions start at `0`.

What's going wrong
The program treats an equal temperature as a higher temperature.

How to read the code
`stack` stores positions still waiting for an answer. A stack removes its most recently added position first. `answer` stores each waiting distance.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of readings.
2. Read the `n` integer temperatures in `a`.

Output
Print `n` distances in the original position order, separated by spaces.

Example explained
For `4 4 6 3`, the first higher reading is two positions after the first `4` and one after the second. Print `2 1 0 0`.

Limits
`1 <= n <= 2000`. Each temperature is from `-1000` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
4 4 6 3
```

Expected output:

```text
2 1 0 0
```

Sample 2 input:

```text
3
5 4 3
```

Expected output:

```text
0 0 0
```

### Progressive hints (private until purchased)

1. Two equal readings must both keep waiting for a higher one.
2. Check the comparison between the saved temperature and the incoming temperature.
3. Remove a saved position only when its value is strictly less than `a[i]`, the new reading. Equality must leave that position waiting.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[2000] = {0};
    int stack[2000] = {0};
    int answer[2000] = {0};
    int size = 0;
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
        while (size > 0 && a[stack[size - 1]] <= a[i]) {
            size--;
            int pos = stack[size];
            answer[pos] = i - pos;
        }
        stack[size] = i;
        size++;
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (answer[i]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a[2000] = {0};
    int stack[2000] = {0};
    int answer[2000] = {0};
    int size = 0;
    for (int i = 0; i < n; i++) {
        cin >> a[i];
        while (size > 0 && a[stack[size - 1]] <= a[i]) {
            size--;
            int pos = stack[size];
            answer[pos] = i - pos;
        }
        stack[size] = i;
        size++;
    }
    for (int i = 0; i < n; i++) {
        cout << (answer[i]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] a = new int[2000];
        int[] stack = new int[2000];
        int[] answer = new int[2000];
        int size = 0;
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
            while (size > 0 && a[stack[size - 1]] <= a[i]) {
                size--;
                int pos = stack[size];
                answer[pos] = i - pos;
            }
            stack[size] = i;
            size++;
        }
        for (int i = 0; i < n; i++) {
            System.out.print((answer[i]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
a = [read_int() for _ in range(n)]
stack = []
answer = [0] * n
for i in range(n):
    while stack and a[stack[-1]] <= a[i]:
        pos = stack.pop()
        answer[pos] = i - pos
    stack.append(i)
print(*answer)
```

---

## 12. Coolant Between Walls

ARRAYS · Difficulty 55 · Bounty 550

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS blocked coolant drains. Ishan is measuring liquid trapped between walls.

What the code should do
The readings are wall heights, each of width `1`, standing on a level floor. Find the total liquid held in the gaps above the walls after filling. Liquid escapes beyond either end. At each position, both sides must hold the liquid; wall space itself does not count.

What's going wrong
A tall wall farther to the right can be forgotten, making the trapped amount wrong.

How to read the code
`a[i]` is the height at position `i`. `left[i]` and `right[i]` store the tallest walls from that position to each end, including the current wall. `total` stores the trapped amount.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of walls.
2. Read the `n` nonnegative integer heights in `a`.

Output
Print one integer: the total trapped amount in unit squares. Print `0` if no liquid is trapped.

Example explained
For heights `3 0 1 3`, there are `3` units above the second wall and `2` above the third. Print `5`.

Limits
`1 <= n <= 2000`. Each height is from `0` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
3 0 1 3
```

Expected output:

```text
5
```

Sample 2 input:

```text
4
0 1 2 3
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. A shorter wall does not erase a taller wall behind it.
2. Check whether `right[i]` describes every wall from `i` to the last position, not just the next wall.
3. When `a[i]` does not exceed `right[i + 1]`, set `right[i]` to `right[i + 1]`. Using `a[i + 1]` loses taller walls farther right.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[2001] = {0};
    int left[2000] = {0};
    int right[2001] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
        left[i] = a[i];
        if (i > 0 && left[i - 1] > left[i]) {
            left[i] = left[i - 1];
        }
    }
    for (int i = n - 1; i >= 0; i--) {
        if (a[i] > right[i + 1]) {
            right[i] = a[i];
        } else {
            right[i] = a[i + 1];
        }
    }
    int total = 0;
    for (int i = 0; i < n; i++) {
        int level = left[i];
        if (right[i] < level) {
            level = right[i];
        }
        total += level - a[i];
    }
    printf("%d ", (total));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a[2001] = {0};
    int left[2000] = {0};
    int right[2001] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
        left[i] = a[i];
        if (i > 0 && left[i - 1] > left[i]) {
            left[i] = left[i - 1];
        }
    }
    for (int i = n - 1; i >= 0; i--) {
        if (a[i] > right[i + 1]) {
            right[i] = a[i];
        } else {
            right[i] = a[i + 1];
        }
    }
    int total = 0;
    for (int i = 0; i < n; i++) {
        int level = left[i];
        if (right[i] < level) {
            level = right[i];
        }
        total += level - a[i];
    }
    cout << (total) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] a = new int[2001];
        int[] left = new int[2000];
        int[] right = new int[2001];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
            left[i] = a[i];
            if (i > 0 && left[i - 1] > left[i]) {
                left[i] = left[i - 1];
            }
        }
        for (int i = n - 1; i >= 0; i--) {
            if (a[i] > right[i + 1]) {
                right[i] = a[i];
            } else {
                right[i] = a[i + 1];
            }
        }
        int total = 0;
        for (int i = 0; i < n; i++) {
            int level = left[i];
            if (right[i] < level) {
                level = right[i];
            }
            total += level - a[i];
        }
        System.out.print((total) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
a = [read_int() for _ in range(n)]
a.append(0)
left = [0] * n
right = [0] * (n + 1)
for i in range(n):
    left[i] = a[i]
    if i > 0 and left[i - 1] > left[i]:
        left[i] = left[i - 1]
for i in range(n - 1, -1, -1):
    if a[i] > right[i + 1]:
        right[i] = a[i]
    else:
        right[i] = a[i + 1]
total = 0
for i in range(n):
    total += min(left[i], right[i]) - a[i]
print(total)
```

---

## 13. Maintenance Slot Picker

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

### Public samples

Sample 1 input:

```text
3
0 3
1 4
3 5
```

Expected output:

```text
2
```

Sample 2 input:

```text
3
0 1
1 2
2 3
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. After choosing a slot, when does its occupied time end?
2. Check whether `last` records the start or the finish of the chosen slot.
3. After accepting a slot, assign `end` to `last`. Accept a later slot when `start >= last`; rejected slots must leave `last` unchanged.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 14. Overlapping Distress Calls

ARRAYS · Difficulty 65 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS combined distress messages. Ishan must count every copy, even when copies share letters.

What the code should do
Count every starting position where pattern `p` appears exactly in text `s`. Occurrences may overlap, meaning they may share text positions. If the pattern is longer than the text or never appears, print `0`.

What's going wrong
After a full match, the program can miss another match that shares some of its letters.

How to read the code
A prefix starts a word; a suffix ends it. For each prefix of `p`, the pattern, `failure` stores the length of its longest shorter prefix that is also its suffix. `matched` is the current matched length.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `s`, the text word.
2. Read `p`, the pattern word. Both words use lowercase English letters.

Output
Print one integer: the number of pattern occurrences.

Example explained
For `s = ababa` and `p = aba`, matches start at positions `0` and `2`, counting from `0`. Print `2`.

Limits
Each of `s` and `p` contains from `1` to `256` lowercase English letters. Matching is exact.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
ababa aba
```

Expected output:

```text
2
```

Sample 2 input:

```text
abcdef xy
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Two occurrences can share some of the same letters.
2. After a full match, its ending letters may already match the start of the next occurrence.
3. After counting a match, set `matched` to `failure[m - 1]`, where `m` is the pattern length. This keeps the longest reusable shorter match.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    char p[257];
    scanf("%256s", s);
    scanf("%256s", p);
    int m = (int)strlen(p);
    int failure[256] = {0};
    int matched = 0;
    for (int i = 1; i < m; i++) {
        while (matched > 0 && p[i] != p[matched]) {
            matched = failure[matched - 1];
        }
        if (p[i] == p[matched]) {
            matched++;
        }
        failure[i] = matched;
    }
    matched = 0;
    int count = 0;
    for (int i = 0; i < (int)strlen(s); i++) {
        while (matched > 0 && s[i] != p[matched]) {
            matched = failure[matched - 1];
        }
        if (s[i] == p[matched]) {
            matched++;
        }
        if (matched == m) {
            count++;
            matched = 0;
        }
    }
    printf("%d ", (count));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    string p;
    cin >> s;
    cin >> p;
    int m = (int)p.size();
    int failure[256] = {0};
    int matched = 0;
    for (int i = 1; i < m; i++) {
        while (matched > 0 && p[i] != p[matched]) {
            matched = failure[matched - 1];
        }
        if (p[i] == p[matched]) {
            matched++;
        }
        failure[i] = matched;
    }
    matched = 0;
    int count = 0;
    for (int i = 0; i < (int)s.size(); i++) {
        while (matched > 0 && s[i] != p[matched]) {
            matched = failure[matched - 1];
        }
        if (s[i] == p[matched]) {
            matched++;
        }
        if (matched == m) {
            count++;
            matched = 0;
        }
    }
    cout << (count) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s;
        String p;
        s = scanner.next();
        p = scanner.next();
        int m = p.length();
        int[] failure = new int[256];
        int matched = 0;
        for (int i = 1; i < m; i++) {
            while (matched > 0 && p.charAt(i) != p.charAt(matched)) {
                matched = failure[matched - 1];
            }
            if (p.charAt(i) == p.charAt(matched)) {
                matched++;
            }
            failure[i] = matched;
        }
        matched = 0;
        int count = 0;
        for (int i = 0; i < s.length(); i++) {
            while (matched > 0 && s.charAt(i) != p.charAt(matched)) {
                matched = failure[matched - 1];
            }
            if (s.charAt(i) == p.charAt(matched)) {
                matched++;
            }
            if (matched == m) {
                count++;
                matched = 0;
            }
        }
        System.out.print((count) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

s = read_word()
p = read_word()
m = len(p)
failure = [0] * m
matched = 0
for i in range(1, m):
    while matched > 0 and p[i] != p[matched]:
        matched = failure[matched - 1]
    if p[i] == p[matched]:
        matched += 1
    failure[i] = matched
matched = 0
count = 0
for ch in s:
    while matched > 0 and ch != p[matched]:
        matched = failure[matched - 1]
    if ch == p[matched]:
        matched += 1
    if matched == m:
        count += 1
        matched = 0
print(count)
```

---

## 15. Mirror Frame Repair

ARRAYS · Difficulty 64 · Bounty 640

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged a verification word. Patch can repair it only by inserting letters.

What the code should do
Find the fewest letters to insert into `s` to make a palindrome, a word that reads the same forwards and backwards. Insertions may be before, between, or after existing letters. Do not delete, replace, or reorder existing letters. A word already meeting the rule needs `0` insertions.

What's going wrong
The program can charge for an insertion even when the outside letters already match.

How to read the code
A substring is a consecutive part of a word. `dp[left * n + right]` stores an insertion count for the substring with endpoints `left` and `right`. `n` is the word length; shorter parts are processed first.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `s`, one word of lowercase English letters.

Output
Print one integer: the minimum number of inserted letters. Do not print the repaired word.

Example explained
For `abca`, insert `b` before the final `a` to get `abcba`. Print `1`.

Limits
`s` contains from `1` to `120` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
abca
```

Expected output:

```text
1
```

Sample 2 input:

```text
abc
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Compare a part whose outside letters match with one whose outside letters differ.
2. If the outside letters already match, consider how much work the inside needs.
3. For matching endpoints, store `inner`, the inside's cost, without adding one. For a two-letter match, `inner` is `0`. Keep the extra cost for differing endpoints.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    scanf("%256s", s);
    int n = (int)strlen(s);
    int dp[14400] = {0};
    for (int length = 2; length <= n; length++) {
        for (int left = 0; left + length <= n; left++) {
            int right = left + length - 1;
            if (s[left] == s[right]) {
                int inner = 0;
                if (length > 2) {
                    inner = dp[(left + 1) * n + right - 1];
                }
                dp[left * n + right] = inner + 1;
            } else {
                int best = dp[(left + 1) * n + right];
                if (dp[left * n + right - 1] < best) {
                    best = dp[left * n + right - 1];
                }
                dp[left * n + right] = best + 1;
            }
        }
    }
    printf("%d ", (dp[n - 1]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    cin >> s;
    int n = (int)s.size();
    int dp[14400] = {0};
    for (int length = 2; length <= n; length++) {
        for (int left = 0; left + length <= n; left++) {
            int right = left + length - 1;
            if (s[left] == s[right]) {
                int inner = 0;
                if (length > 2) {
                    inner = dp[(left + 1) * n + right - 1];
                }
                dp[left * n + right] = inner + 1;
            } else {
                int best = dp[(left + 1) * n + right];
                if (dp[left * n + right - 1] < best) {
                    best = dp[left * n + right - 1];
                }
                dp[left * n + right] = best + 1;
            }
        }
    }
    cout << (dp[n - 1]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s;
        s = scanner.next();
        int n = s.length();
        int[] dp = new int[14400];
        for (int length = 2; length <= n; length++) {
            for (int left = 0; left + length <= n; left++) {
                int right = left + length - 1;
                if (s.charAt(left) == s.charAt(right)) {
                    int inner = 0;
                    if (length > 2) {
                        inner = dp[(left + 1) * n + right - 1];
                    }
                    dp[left * n + right] = inner + 1;
                } else {
                    int best = dp[(left + 1) * n + right];
                    if (dp[left * n + right - 1] < best) {
                        best = dp[left * n + right - 1];
                    }
                    dp[left * n + right] = best + 1;
                }
            }
        }
        System.out.print((dp[n - 1]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

s = read_word()
n = len(s)
dp = [0] * (n * n)
for length in range(2, n + 1):
    for left in range(n - length + 1):
        right = left + length - 1
        if s[left] == s[right]:
            inner = 0
            if length > 2:
                inner = dp[(left + 1) * n + right - 1]
            dp[left * n + right] = inner + 1
        else:
            best = min(dp[(left + 1) * n + right], dp[left * n + right - 1])
            dp[left * n + right] = best + 1
print(dp[n - 1])
```

---

## 16. Strict Upgrade Trail

ARRAYS · Difficulty 57 · Bounty 570

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS repeated old upgrade levels. Mira needs the longest ordered set of real increases.

What the code should do
Find the longest strictly increasing subsequence: entries chosen in input order, with skips allowed. Each chosen value must be greater than the previous chosen value; equal values cannot extend the sequence. Print its length.

What's going wrong
The program can extend an increasing sequence with an equal value.

How to read the code
A subsequence keeps input order but may skip entries. `tails` stores the smallest final value found for each possible increasing length. `size` is the longest length found so far.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of levels.
2. Read the `n` integer levels.

Output
Print one integer: the longest strictly increasing subsequence length.

Example explained
For `2 2 3 1 4`, choose `2 3 4`. Print `3`; the repeated `2` cannot increase the length.

Limits
`1 <= n <= 2000`. Each level is from `-10000` to `10000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
2 2 3 1 4
```

Expected output:

```text
3
```

Sample 2 input:

```text
3
5 4 3
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. If every value is equal, the answer must be `1`.
2. Check how the search treats a saved final value equal to the new `value`.
3. Find the first entry of `tails` that is at least `value`. Advance `lo`, the lower search boundary, only when `tails[mid] < value`, where `mid` is the middle position.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int tails[2000] = {0};
    int size = 0;
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        int lo = 0;
        int hi = size;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (tails[mid] <= value) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        tails[lo] = value;
        if (lo == size) {
            size++;
        }
    }
    printf("%d ", (size));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int tails[2000] = {0};
    int size = 0;
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        int lo = 0;
        int hi = size;
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (tails[mid] <= value) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        tails[lo] = value;
        if (lo == size) {
            size++;
        }
    }
    cout << (size) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] tails = new int[2000];
        int size = 0;
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            int lo = 0;
            int hi = size;
            while (lo < hi) {
                int mid = (lo + hi) / 2;
                if (tails[mid] <= value) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            tails[lo] = value;
            if (lo == size) {
                size++;
            }
        }
        System.out.print((size) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
tails = [0] * n
size = 0
for _ in range(n):
    value = read_int()
    lo = 0
    hi = size
    while lo < hi:
        mid = (lo + hi) // 2
        if tails[mid] <= value:
            lo = mid + 1
        else:
            hi = mid
    tails[lo] = value
    if lo == size:
        size += 1
print(size)
```

---

## 17. Circular Power Reserve

ARRAYS · Difficulty 60 · Bounty 600

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS stored power readings in a circle. Ishan needs the section with the largest total.

What the code should do
Find the largest sum of a nonempty consecutive section of the circular list. A section may cross from the last reading to the first. It must use from `1` to `n` positions, with each position used at most once. Negative answers are allowed.

What's going wrong
When all readings are negative, the program can report `0` even though no allowed section has that sum.

How to read the code
A circular list continues from its last entry back to its first. `high` and `low` track sums ending at the current entry. `best` and `worst` track the largest and smallest section sums; `total` is the whole-list sum.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of readings.
2. Read the `n` integer power readings in their circular order.

Output
Print one integer: the largest allowed section sum.

Example explained
For `5 -3 5`, choose the last `5` followed by the first `5`. Print `10`.

Limits
`1 <= n <= 2000`. Each power reading is from `-1000` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
5 -3 5
```

Expected output:

```text
10
```

Sample 2 input:

```text
3
1 2 3
```

Expected output:

```text
6
```

### Progressive hints (private until purchased)

1. The chosen section must contain at least one reading.
2. If the minimum-sum section is the whole list, subtracting it from `total` leaves an empty section.
3. When `best` is negative, keep it. Otherwise compare `best` with `total - worst`; the empty-section candidate must not replace an all-negative answer.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int value;
    scanf("%d", &value);
    int total = value;
    int high = value;
    int low = value;
    int best = value;
    int worst = value;
    for (int i = 1; i < n; i++) {
        scanf("%d", &value);
        total += value;
        if (high < 0) {
            high = value;
        } else {
            high += value;
        }
        if (low > 0) {
            low = value;
        } else {
            low += value;
        }
        if (high > best) {
            best = high;
        }
        if (low < worst) {
            worst = low;
        }
    }
    if (total - worst > best) {
        best = total - worst;
    }
    printf("%d ", (best));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int value;
    cin >> value;
    int total = value;
    int high = value;
    int low = value;
    int best = value;
    int worst = value;
    for (int i = 1; i < n; i++) {
        cin >> value;
        total += value;
        if (high < 0) {
            high = value;
        } else {
            high += value;
        }
        if (low > 0) {
            low = value;
        } else {
            low += value;
        }
        if (high > best) {
            best = high;
        }
        if (low < worst) {
            worst = low;
        }
    }
    if (total - worst > best) {
        best = total - worst;
    }
    cout << (best) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int value;
        value = scanner.nextInt();
        int total = value;
        int high = value;
        int low = value;
        int best = value;
        int worst = value;
        for (int i = 1; i < n; i++) {
            value = scanner.nextInt();
            total += value;
            if (high < 0) {
                high = value;
            } else {
                high += value;
            }
            if (low > 0) {
                low = value;
            } else {
                low += value;
            }
            if (high > best) {
                best = high;
            }
            if (low < worst) {
                worst = low;
            }
        }
        if (total - worst > best) {
            best = total - worst;
        }
        System.out.print((best) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
value = read_int()
total = value
high = value
low = value
best = value
worst = value
for _ in range(1, n):
    value = read_int()
    total += value
    high = max(value, high + value)
    low = min(value, low + value)
    best = max(best, high)
    worst = min(worst, low)
if total - worst > best:
    best = total - worst
print(best)
```

---

## 18. Crossed Arrival Records

ARRAYS · Difficulty 66 · Bounty 660

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS scrambled arrival times. Ishan needs to count pairs that are out of order.

What the code should do
Count pairs of positions in the original list where the earlier value is strictly greater than the later value. Such a pair is called an inversion. Equal values do not count. Count every qualifying pair of positions once.

What's going wrong
The program can count some pairs more than once and report too many inversions.

How to read the code
The code merges sorted blocks into `temp`, a work array. `i` and `j` point to unused entries in the left and right blocks. `count` records inversions, pairs whose earlier value is larger.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of entries.
2. Read the `n` integer arrival times in `a`.

Output
Print one integer: the number of inversions in the original list.

Example explained
For `3 1 2`, the first value forms a pair with each later value: `3 > 1` and `3 > 2`. Print `2`.

Limits
`1 <= n <= 20000`. Each arrival time is from `-100000` to `100000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
3 1 2
```

Expected output:

```text
2
```

Sample 2 input:

```text
3
2 2 2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Some left-block values may already have been copied before a right-block value is chosen.
2. Count only unused left-block values that are larger than the chosen right-block value.
3. Add `middle - i`, where `middle` is the excluded end of the left block and `i` is its next unused position. Using `middle - left` counts entries already copied.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[20000] = {0};
    int temp[20000] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    long long count = 0;
    for (int width = 1; width < n; width *= 2) {
        for (int left = 0; left < n; left += 2 * width) {
            int middle = left + width;
            if (middle > n) {
                middle = n;
            }
            int right = left + 2 * width;
            if (right > n) {
                right = n;
            }
            int i = left;
            int j = middle;
            int k = left;
            while (i < middle && j < right) {
                if (a[i] <= a[j]) {
                    temp[k] = a[i];
                    i++;
                } else {
                    temp[k] = a[j];
                    j++;
                    count += middle - left;
                }
                k++;
            }
            while (i < middle) {
                temp[k] = a[i];
                i++;
                k++;
            }
            while (j < right) {
                temp[k] = a[j];
                j++;
                k++;
            }
        }
        for (int i = 0; i < n; i++) {
            a[i] = temp[i];
        }
    }
    printf("%lld ", (long long)(count));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a[20000] = {0};
    int temp[20000] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    long long count = 0;
    for (int width = 1; width < n; width *= 2) {
        for (int left = 0; left < n; left += 2 * width) {
            int middle = left + width;
            if (middle > n) {
                middle = n;
            }
            int right = left + 2 * width;
            if (right > n) {
                right = n;
            }
            int i = left;
            int j = middle;
            int k = left;
            while (i < middle && j < right) {
                if (a[i] <= a[j]) {
                    temp[k] = a[i];
                    i++;
                } else {
                    temp[k] = a[j];
                    j++;
                    count += middle - left;
                }
                k++;
            }
            while (i < middle) {
                temp[k] = a[i];
                i++;
                k++;
            }
            while (j < right) {
                temp[k] = a[j];
                j++;
                k++;
            }
        }
        for (int i = 0; i < n; i++) {
            a[i] = temp[i];
        }
    }
    cout << (count) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] a = new int[20000];
        int[] temp = new int[20000];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        long count = 0;
        for (int width = 1; width < n; width *= 2) {
            for (int left = 0; left < n; left += 2 * width) {
                int middle = left + width;
                if (middle > n) {
                    middle = n;
                }
                int right = left + 2 * width;
                if (right > n) {
                    right = n;
                }
                int i = left;
                int j = middle;
                int k = left;
                while (i < middle && j < right) {
                    if (a[i] <= a[j]) {
                        temp[k] = a[i];
                        i++;
                    } else {
                        temp[k] = a[j];
                        j++;
                        count += middle - left;
                    }
                    k++;
                }
                while (i < middle) {
                    temp[k] = a[i];
                    i++;
                    k++;
                }
                while (j < right) {
                    temp[k] = a[j];
                    j++;
                    k++;
                }
            }
            for (int i = 0; i < n; i++) {
                a[i] = temp[i];
            }
        }
        System.out.print((count) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
a = [read_int() for _ in range(n)]
temp = [0] * n
count = 0
width = 1
while width < n:
    for left in range(0, n, 2 * width):
        middle = min(left + width, n)
        right = min(left + 2 * width, n)
        i = left
        j = middle
        k = left
        while i < middle and j < right:
            if a[i] <= a[j]:
                temp[k] = a[i]
                i += 1
            else:
                temp[k] = a[j]
                j += 1
                count += middle - left
            k += 1
        while i < middle:
            temp[k] = a[i]
            i += 1
            k += 1
        while j < right:
            temp[k] = a[j]
            j += 1
            k += 1
    a[:] = temp
    width *= 2
print(count)
```

---

## 19. Patch Transcript Distance

ARRAYS · Difficulty 71 · Bounty 710

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS changed a repair transcript. Mira needs the fewest edits to restore the approved word.

What the code should do
Find the minimum number of edits needed to turn word `a` into word `b`. One edit inserts one letter, deletes one letter, or replaces one letter. Each edit costs `1`. Equal words need `0` edits; swapping two letters is not a single allowed edit.

What's going wrong
The program can report the wrong edit count when letters match or differ across the two words.

How to read the code
`dp` stores edit counts for growing prefixes, parts starting at the beginning of a word. The code reuses one row. `old` saves a cell before it is overwritten, and `diagonal` carries a neighboring cell.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `a`, the starting word.
2. Read `b`, the required word. Both words use lowercase English letters.

Output
Print one integer: the minimum edit count. Do not print the edited word.

Example explained
Turn `kitten` into `sitten`, then `sittin`, then `sitting`. These two replacements and one insertion give the minimum. Print `3`.

Limits
Each of `a` and `b` contains from `1` to `200` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
kitten sitting
```

Expected output:

```text
3
```

Sample 2 input:

```text
a b
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Reusing one row overwrites values that may still be needed.
2. At the next column, `diagonal` must refer to the previous row and previous column, not a newly computed cell.
3. Save `dp[j]` in `old` before changing it. After writing the new `dp[j]`, assign `old` to `diagonal`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char a[257];
    char b[257];
    scanf("%256s", a);
    scanf("%256s", b);
    int dp[201] = {0};
    for (int j = 0; j <= (int)strlen(b); j++) {
        dp[j] = j;
    }
    for (int i = 1; i <= (int)strlen(a); i++) {
        int diagonal = dp[0];
        dp[0] = i;
        for (int j = 1; j <= (int)strlen(b); j++) {
            int old = dp[j];
            int cost = 0;
            if (a[i - 1] != b[j - 1]) {
                cost = 1;
            }
            int best = diagonal + cost;
            if (old + 1 < best) {
                best = old + 1;
            }
            if (dp[j - 1] + 1 < best) {
                best = dp[j - 1] + 1;
            }
            dp[j] = best;
            diagonal = dp[j];
        }
    }
    printf("%d ", (dp[(int)strlen(b)]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string a;
    string b;
    cin >> a;
    cin >> b;
    int dp[201] = {0};
    for (int j = 0; j <= (int)b.size(); j++) {
        dp[j] = j;
    }
    for (int i = 1; i <= (int)a.size(); i++) {
        int diagonal = dp[0];
        dp[0] = i;
        for (int j = 1; j <= (int)b.size(); j++) {
            int old = dp[j];
            int cost = 0;
            if (a[i - 1] != b[j - 1]) {
                cost = 1;
            }
            int best = diagonal + cost;
            if (old + 1 < best) {
                best = old + 1;
            }
            if (dp[j - 1] + 1 < best) {
                best = dp[j - 1] + 1;
            }
            dp[j] = best;
            diagonal = dp[j];
        }
    }
    cout << (dp[(int)b.size()]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String a;
        String b;
        a = scanner.next();
        b = scanner.next();
        int[] dp = new int[201];
        for (int j = 0; j <= b.length(); j++) {
            dp[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            int diagonal = dp[0];
            dp[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int old = dp[j];
                int cost = 0;
                if (a.charAt(i - 1) != b.charAt(j - 1)) {
                    cost = 1;
                }
                int best = diagonal + cost;
                if (old + 1 < best) {
                    best = old + 1;
                }
                if (dp[j - 1] + 1 < best) {
                    best = dp[j - 1] + 1;
                }
                dp[j] = best;
                diagonal = dp[j];
            }
        }
        System.out.print((dp[b.length()]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

a = read_word()
b = read_word()
dp = list(range(len(b) + 1))
for i in range(1, len(a) + 1):
    diagonal = dp[0]
    dp[0] = i
    for j in range(1, len(b) + 1):
        old = dp[j]
        cost = int(a[i - 1] != b[j - 1])
        dp[j] = min(diagonal + cost, old + 1, dp[j - 1] + 1)
        diagonal = dp[j]
print(dp[len(b)])
```

---

## 20. Firewall Plate Area

ARRAYS · Difficulty 76 · Bounty 760

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged a row of plates. Patch needs the largest rectangle supported by the remaining heights.

What the code should do
Each bar has width `1` and stands on the same floor. Choose one or more consecutive bars. The rectangle's height is the smallest chosen height, and its width is the number of chosen bars. Print the largest possible area. Zero heights are allowed.

What's going wrong
The program can use a rectangle that is one bar too wide and report an area that is too large.

How to read the code
A histogram is a row of bars. `a` holds their heights. `stack` stores bar positions in nondecreasing height order, meaning saved heights never decrease. A stack removes its most recently added entry first.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of bars.
2. Read the `n` nonnegative integer heights in `a`.

Output
Print one integer: the largest rectangle area. Print `0` when all heights are `0`.

Example explained
For `2 1 5 6 2 3`, choose the neighboring bars of heights `5` and `6`. Their rectangle has height `5` and width `2`. Print `10`.

Limits
`1 <= n <= 2000`. Each bar height is from `0` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
6
2 1 5 6 2 3
```

Expected output:

```text
10
```

Sample 2 input:

```text
3
0 0 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Count the bars in the rectangle separately from the positions that bound it.
2. After a position is removed from `stack`, this candidate uses the positions strictly between the remaining top and the current position `i`.
3. If `stack` still has entries, use width `i - stack[size - 1] - 1` in C, C++ and Java, or `i - stack[-1] - 1` in Python. If it is empty, use width `i`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[2001] = {0};
    int stack[2001] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    int size = 0;
    int best = 0;
    for (int i = 0; i <= n; i++) {
        while (size > 0 && a[stack[size - 1]] > a[i]) {
            size--;
            int height = a[stack[size]];
            int width = i;
            if (size > 0) {
                width = i - stack[size - 1];
            }
            int area = height * width;
            if (area > best) {
                best = area;
            }
        }
        stack[size] = i;
        size++;
    }
    printf("%d ", (best));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a[2001] = {0};
    int stack[2001] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int size = 0;
    int best = 0;
    for (int i = 0; i <= n; i++) {
        while (size > 0 && a[stack[size - 1]] > a[i]) {
            size--;
            int height = a[stack[size]];
            int width = i;
            if (size > 0) {
                width = i - stack[size - 1];
            }
            int area = height * width;
            if (area > best) {
                best = area;
            }
        }
        stack[size] = i;
        size++;
    }
    cout << (best) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] a = new int[2001];
        int[] stack = new int[2001];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int size = 0;
        int best = 0;
        for (int i = 0; i <= n; i++) {
            while (size > 0 && a[stack[size - 1]] > a[i]) {
                size--;
                int height = a[stack[size]];
                int width = i;
                if (size > 0) {
                    width = i - stack[size - 1];
                }
                int area = height * width;
                if (area > best) {
                    best = area;
                }
            }
            stack[size] = i;
            size++;
        }
        System.out.print((best) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
a = [read_int() for _ in range(n)] + [0]
stack = []
best = 0
for i in range(n + 1):
    while stack and a[stack[-1]] > a[i]:
        height = a[stack.pop()]
        width = i
        if stack:
            width = i - stack[-1]
        best = max(best, height * width)
    stack.append(i)
print(best)
```

---

## 21. Wildcard Quarantine Rule

ARRAYS · Difficulty 80 · Bounty 800

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS changed command rules. Ishan must check which command words each rule accepts.

What the code should do
Print `YES` if the entire text `s` matches the entire rule `p`; otherwise print `NO`. A lowercase letter matches only itself. `?` matches exactly one letter. `*` matches any consecutive sequence of letters, including no letters. Each wildcard is applied where it appears in the rule.

What's going wrong
The program can reject a valid match when `*` must stand for several letters.

How to read the code
A wildcard stands for text rather than a fixed letter. `previous` and `current` store match results for growing text prefixes, parts starting at the beginning. Columns represent prefixes of `p`, the rule.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `s`, a word of lowercase English letters.
2. Read `p`, a rule containing lowercase English letters, `?`, and `*`.

Output
Print exactly `YES` or `NO`, in uppercase.

Example explained
Text `abbbc` matches rule `a*c`: `*` stands for `bbb`. Print `YES`.

Limits
Each of `s` and `p` contains from `1` to `200` characters. Only `p` may contain `?` or `*`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
abbbc a*c
```

Expected output:

```text
YES
```

Sample 2 input:

```text
abc a?d
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. One `*` can stand for more than one letter.
2. Consider two cases for `*`: it matches nothing, or it matches one more letter and stays available.
3. At rule column `j`, combine `current[j - 1]` with `previous[j]`. The second value keeps the same `*` available after another text letter is consumed.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    char p[257];
    scanf("%256s", s);
    scanf("%256s", p);
    int m = (int)strlen(p);
    int previous[201] = {0};
    int current[201] = {0};
    previous[0] = 1;
    for (int j = 1; j <= m; j++) {
        if (p[j - 1] == '*') {
            previous[j] = previous[j - 1];
        }
    }
    for (int i = 1; i <= (int)strlen(s); i++) {
        current[0] = 0;
        for (int j = 1; j <= m; j++) {
            int ch = p[j - 1];
            if (ch == '*') {
                current[j] = current[j - 1] | previous[j - 1];
            } else if (ch == '?' || ch == s[i - 1]) {
                current[j] = previous[j - 1];
            } else {
                current[j] = 0;
            }
        }
        for (int j = 0; j <= m; j++) {
            previous[j] = current[j];
        }
    }
    if (previous[m] == 1) {
        printf("YES");
    } else {
        printf("NO");
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    string p;
    cin >> s;
    cin >> p;
    int m = (int)p.size();
    int previous[201] = {0};
    int current[201] = {0};
    previous[0] = 1;
    for (int j = 1; j <= m; j++) {
        if (p[j - 1] == '*') {
            previous[j] = previous[j - 1];
        }
    }
    for (int i = 1; i <= (int)s.size(); i++) {
        current[0] = 0;
        for (int j = 1; j <= m; j++) {
            int ch = p[j - 1];
            if (ch == '*') {
                current[j] = current[j - 1] | previous[j - 1];
            } else if (ch == '?' || ch == s[i - 1]) {
                current[j] = previous[j - 1];
            } else {
                current[j] = 0;
            }
        }
        for (int j = 0; j <= m; j++) {
            previous[j] = current[j];
        }
    }
    if (previous[m] == 1) {
        cout << "YES";
    } else {
        cout << "NO";
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s;
        String p;
        s = scanner.next();
        p = scanner.next();
        int m = p.length();
        int[] previous = new int[201];
        int[] current = new int[201];
        previous[0] = 1;
        for (int j = 1; j <= m; j++) {
            if (p.charAt(j - 1) == '*') {
                previous[j] = previous[j - 1];
            }
        }
        for (int i = 1; i <= s.length(); i++) {
            current[0] = 0;
            for (int j = 1; j <= m; j++) {
                int ch = p.charAt(j - 1);
                if (ch == '*') {
                    current[j] = current[j - 1] | previous[j - 1];
                } else if (ch == '?' || ch == s.charAt(i - 1)) {
                    current[j] = previous[j - 1];
                } else {
                    current[j] = 0;
                }
            }
            for (int j = 0; j <= m; j++) {
                previous[j] = current[j];
            }
        }
        if (previous[m] == 1) {
            System.out.print("YES");
        } else {
            System.out.print("NO");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

s = read_word()
p = read_word()
m = len(p)
previous = [0] * (m + 1)
current = [0] * (m + 1)
previous[0] = 1
for j in range(1, m + 1):
    if p[j - 1] == '*':
        previous[j] = previous[j - 1]
for i in range(1, len(s) + 1):
    current[0] = 0
    for j in range(1, m + 1):
        ch = p[j - 1]
        if ch == '*':
            current[j] = current[j - 1] | previous[j - 1]
        elif ch == '?' or ch == s[i - 1]:
            current[j] = previous[j - 1]
        else:
            current[j] = 0
    previous[:] = current
print('YES' if previous[m] else 'NO')
```

---

## 22. Signed Burst Recovery

ARRAYS · Difficulty 85 · Bounty 850

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS added negative corrections to power readings. Mira needs the shortest section that reaches the required sum.

What the code should do
Find the shortest nonempty consecutive section with sum at least `target`. The sum may equal `target`. Readings can be negative, and entries cannot be skipped within a section. Print its length, or `-1` if no section qualifies.

What's going wrong
The program can miss a shorter valid section ending at a position it already checked.

How to read the code
A prefix total is a sum from the start of the list. `prefix` stores these totals. `deque` stores possible section starts; a deque allows removal from either end. `head` and `tail` mark its stored range.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of readings, and `target`, the required minimum sum.
2. Read `n` integer readings.

Output
Print one integer: the shortest qualifying length, or `-1` if none exists.

Example explained
For `2 -1 2` with `target = 3`, only the whole list reaches the target. Print `3`.

Limits
`1 <= n <= 2000`; `1 <= target <= 2000000`. Each reading is from `-1000` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
2 -1 2
```

Expected output:

```text
3
```

Sample 2 input:

```text
2 1
-2 -1
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Several sections ending at the same position can meet the target.
2. After removing one qualifying start from `deque`, check whether the new front also qualifies.
3. Use a loop to check front positions while `prefix[i] - prefix[deque[head]] >= target`. Record each candidate length before moving `head` to the next start.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, target;
    scanf("%d", &n);
    scanf("%d", &target);
    int prefix[2001] = {0};
    int deque[2001] = {0};
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        prefix[i + 1] = prefix[i] + value;
    }
    int head = 0;
    int tail = 0;
    int best = n + 1;
    for (int i = 0; i <= n; i++) {
        if (head < tail && prefix[i] - prefix[deque[head]] >= target) {
            int length = i - deque[head];
            if (length < best) {
                best = length;
            }
            head++;
        }
        while (head < tail && prefix[deque[tail - 1]] >= prefix[i]) {
            tail--;
        }
        deque[tail] = i;
        tail++;
    }
    if (best > n) {
        printf("%d ", (-1));
    } else {
        printf("%d ", (best));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, target;
    cin >> n;
    cin >> target;
    int prefix[2001] = {0};
    int deque[2001] = {0};
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        prefix[i + 1] = prefix[i] + value;
    }
    int head = 0;
    int tail = 0;
    int best = n + 1;
    for (int i = 0; i <= n; i++) {
        if (head < tail && prefix[i] - prefix[deque[head]] >= target) {
            int length = i - deque[head];
            if (length < best) {
                best = length;
            }
            head++;
        }
        while (head < tail && prefix[deque[tail - 1]] >= prefix[i]) {
            tail--;
        }
        deque[tail] = i;
        tail++;
    }
    if (best > n) {
        cout << (-1) << ' ';
    } else {
        cout << (best) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, target;
        n = scanner.nextInt();
        target = scanner.nextInt();
        int[] prefix = new int[2001];
        int[] deque = new int[2001];
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            prefix[i + 1] = prefix[i] + value;
        }
        int head = 0;
        int tail = 0;
        int best = n + 1;
        for (int i = 0; i <= n; i++) {
            if (head < tail && prefix[i] - prefix[deque[head]] >= target) {
                int length = i - deque[head];
                if (length < best) {
                    best = length;
                }
                head++;
            }
            while (head < tail && prefix[deque[tail - 1]] >= prefix[i]) {
                tail--;
            }
            deque[tail] = i;
            tail++;
        }
        if (best > n) {
            System.out.print((-1) + " ");
        } else {
            System.out.print((best) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
target = read_int()
prefix = [0] * (n + 1)
for i in range(n):
    prefix[i + 1] = prefix[i] + read_int()
deque = [0] * (n + 1)
head = 0
tail = 0
best = n + 1
for i in range(n + 1):
    if head < tail and prefix[i] - prefix[deque[head]] >= target:
        best = min(best, i - deque[head])
        head += 1
    while head < tail and prefix[deque[tail - 1]] >= prefix[i]:
        tail -= 1
    deque[tail] = i
    tail += 1
print(-1 if best > n else best)
```

---

## 23. Suffix Archive Census

ARRAYS · Difficulty 90 · Bounty 900

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS copied archive fragments. Ishan needs the number of different fragments.

What the code should do
Count the different nonempty substrings of `s`. A substring is a consecutive part of a word. Equal letter sequences count once, even if they appear at several positions. Different lengths count as different substrings.

What's going wrong
The program can treat different fragments as equal and report too few distinct fragments.

How to read the code
A suffix runs from one position to the word's end; a prefix starts at its beginning. `sa` lists suffix starts in alphabetical order. `rank` stores their order, and `height` tracks shared starting letters of neighboring suffixes.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `s`, one word of lowercase English letters.

Output
Print one integer: the number of distinct nonempty substrings.

Example explained
For `abab`, the distinct substrings are `a`, `b`, `ab`, `ba`, `aba`, `bab`, and `abab`. Print `7`.

Limits
`s` contains from `1` to `256` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
abab
```

Expected output:

```text
7
```

Sample 2 input:

```text
abcd
```

Expected output:

```text
10
```

### Progressive hints (private until purchased)

1. Follow `height` when the starting position moves forward by one letter.
2. The first shared letter is no longer part of the next suffix. Check whether the saved length still includes it.
3. After adding `height` to `shared`, the total shared-prefix count, decrease `height` by one if it is positive. Keep the reset to `0` when `rank[i] == 0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    scanf("%256s", s);
    int n = (int)strlen(s);
    int sa[256] = {0};
    int rank[256] = {0};
    int nextRank[256] = {0};
    for (int i = 0; i < n; i++) {
        sa[i] = i;
        rank[i] = s[i] - 'a';
    }
    for (int step = 1; step < n; step *= 2) {
        for (int i = 1; i < n; i++) {
            int key = sa[i];
            int keySecond = -1;
            if (key + step < n) {
                keySecond = rank[key + step];
            }
            int j = i - 1;
            while (j >= 0) {
                int other = sa[j];
                int otherSecond = -1;
                if (other + step < n) {
                    otherSecond = rank[other + step];
                }
                if (rank[other] < rank[key] || (rank[other] == rank[key] && otherSecond <= keySecond)) {
                    break;
                }
                sa[j + 1] = sa[j];
                j--;
            }
            sa[j + 1] = key;
        }
        nextRank[sa[0]] = 0;
        for (int i = 1; i < n; i++) {
            int previous = sa[i - 1];
            int current = sa[i];
            int a = -1;
            int b = -1;
            if (previous + step < n) {
                a = rank[previous + step];
            }
            if (current + step < n) {
                b = rank[current + step];
            }
            nextRank[current] = nextRank[previous];
            if (rank[previous] != rank[current] || a != b) {
                nextRank[current]++;
            }
        }
        for (int i = 0; i < n; i++) {
            rank[i] = nextRank[i];
        }
    }
    for (int i = 0; i < n; i++) {
        rank[sa[i]] = i;
    }
    int shared = 0;
    int height = 0;
    for (int i = 0; i < n; i++) {
        if (rank[i] == 0) {
            height = 0;
        } else {
            int j = sa[rank[i] - 1];
            while (i + height < n && j + height < n && s[i + height] == s[j + height]) {
                height++;
            }
            shared += height;
            if (height > 0) {
                height -= 0;
            }
        }
    }
    printf("%d ", (n * (n + 1) / 2 - shared));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    cin >> s;
    int n = (int)s.size();
    int sa[256] = {0};
    int rank[256] = {0};
    int nextRank[256] = {0};
    for (int i = 0; i < n; i++) {
        sa[i] = i;
        rank[i] = s[i] - 'a';
    }
    for (int step = 1; step < n; step *= 2) {
        for (int i = 1; i < n; i++) {
            int key = sa[i];
            int keySecond = -1;
            if (key + step < n) {
                keySecond = rank[key + step];
            }
            int j = i - 1;
            while (j >= 0) {
                int other = sa[j];
                int otherSecond = -1;
                if (other + step < n) {
                    otherSecond = rank[other + step];
                }
                if (rank[other] < rank[key] || (rank[other] == rank[key] && otherSecond <= keySecond)) {
                    break;
                }
                sa[j + 1] = sa[j];
                j--;
            }
            sa[j + 1] = key;
        }
        nextRank[sa[0]] = 0;
        for (int i = 1; i < n; i++) {
            int previous = sa[i - 1];
            int current = sa[i];
            int a = -1;
            int b = -1;
            if (previous + step < n) {
                a = rank[previous + step];
            }
            if (current + step < n) {
                b = rank[current + step];
            }
            nextRank[current] = nextRank[previous];
            if (rank[previous] != rank[current] || a != b) {
                nextRank[current]++;
            }
        }
        for (int i = 0; i < n; i++) {
            rank[i] = nextRank[i];
        }
    }
    for (int i = 0; i < n; i++) {
        rank[sa[i]] = i;
    }
    int shared = 0;
    int height = 0;
    for (int i = 0; i < n; i++) {
        if (rank[i] == 0) {
            height = 0;
        } else {
            int j = sa[rank[i] - 1];
            while (i + height < n && j + height < n && s[i + height] == s[j + height]) {
                height++;
            }
            shared += height;
            if (height > 0) {
                height -= 0;
            }
        }
    }
    cout << (n * (n + 1) / 2 - shared) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s;
        s = scanner.next();
        int n = s.length();
        int[] sa = new int[256];
        int[] rank = new int[256];
        int[] nextRank = new int[256];
        for (int i = 0; i < n; i++) {
            sa[i] = i;
            rank[i] = s.charAt(i) - 'a';
        }
        for (int step = 1; step < n; step *= 2) {
            for (int i = 1; i < n; i++) {
                int key = sa[i];
                int keySecond = -1;
                if (key + step < n) {
                    keySecond = rank[key + step];
                }
                int j = i - 1;
                while (j >= 0) {
                    int other = sa[j];
                    int otherSecond = -1;
                    if (other + step < n) {
                        otherSecond = rank[other + step];
                    }
                    if (rank[other] < rank[key] || (rank[other] == rank[key] && otherSecond <= keySecond)) {
                        break;
                    }
                    sa[j + 1] = sa[j];
                    j--;
                }
                sa[j + 1] = key;
            }
            nextRank[sa[0]] = 0;
            for (int i = 1; i < n; i++) {
                int previous = sa[i - 1];
                int current = sa[i];
                int a = -1;
                int b = -1;
                if (previous + step < n) {
                    a = rank[previous + step];
                }
                if (current + step < n) {
                    b = rank[current + step];
                }
                nextRank[current] = nextRank[previous];
                if (rank[previous] != rank[current] || a != b) {
                    nextRank[current]++;
                }
            }
            for (int i = 0; i < n; i++) {
                rank[i] = nextRank[i];
            }
        }
        for (int i = 0; i < n; i++) {
            rank[sa[i]] = i;
        }
        int shared = 0;
        int height = 0;
        for (int i = 0; i < n; i++) {
            if (rank[i] == 0) {
                height = 0;
            } else {
                int j = sa[rank[i] - 1];
                while (i + height < n && j + height < n && s.charAt(i + height) == s.charAt(j + height)) {
                    height++;
                }
                shared += height;
                if (height > 0) {
                    height -= 0;
                }
            }
        }
        System.out.print((n * (n + 1) / 2 - shared) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

s = read_word()
n = len(s)
sa = list(range(n))
rank = [ord(ch) - ord('a') for ch in s]
next_rank = [0] * n
step = 1
while step < n:
    for i in range(1, n):
        key = sa[i]
        key_second = rank[key + step] if key + step < n else -1
        j = i - 1
        while j >= 0:
            other = sa[j]
            other_second = rank[other + step] if other + step < n else -1
            if rank[other] < rank[key] or (rank[other] == rank[key] and other_second <= key_second):
                break
            sa[j + 1] = sa[j]
            j -= 1
        sa[j + 1] = key
    next_rank[sa[0]] = 0
    for i in range(1, n):
        previous = sa[i - 1]
        current = sa[i]
        a = rank[previous + step] if previous + step < n else -1
        b = rank[current + step] if current + step < n else -1
        next_rank[current] = next_rank[previous] + int(rank[previous] != rank[current] or a != b)
    rank[:] = next_rank
    step *= 2
for i in range(n):
    rank[sa[i]] = i
shared = 0
height = 0
for i in range(n):
    if rank[i] == 0:
        height = 0
    else:
        j = sa[rank[i] - 1]
        while i + height < n and j + height < n and s[i + height] == s[j + height]:
            height += 1
        shared += height
        if height > 0:
            height -= 0
print(n * (n + 1) // 2 - shared)
```

---

## 24. Nested Signature Relay

ARRAYS · Difficulty 94 · Bounty 940

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS placed warning patterns inside other patterns. Mira must count every warning match.

What the code should do
Count all occurrences of every listed pattern in text `s`. Each occurrence uses consecutive letters. Matches may overlap or end at the same position. If a pattern is listed more than once, each listed copy counts separately every time it occurs.

What's going wrong
Some matches disappear when one pattern ends at the same text position as another.

How to read the code
A trie is a tree of letter paths that shares common word beginnings. A node is a point in that tree. `state` is the current node. `failure` links to shorter matching endings, and `terminal` stores pattern counts.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `k`, the number of listed patterns.
2. Read `k` pattern words, each read into `p`.
3. Read `s`, the text word. Every word uses only `a`, `b`, and `c`.

Output
Print one integer: the total match count, including overlaps and separate counts for duplicate listed patterns.

Example explained
For patterns `a` and `aa` in text `aaa`, `a` occurs three times and `aa` twice. Print `5`.

Limits
`1 <= k <= 100`. Patterns are nonempty and their total length is at most `200`. The text has from `1` to `256` letters. Only `a`, `b`, and `c` are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
a
aa
aaa
```

Expected output:

```text
5
```

Sample 2 input:

```text
1
ab
cccc
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. One text position can complete both a longer pattern and a shorter pattern at its end.
2. Check whether following a failure link preserves patterns ending at the original node.
3. When linking `child`, the new node, to `fallback`, its shorter matching node, add `terminal[fallback]` to `terminal[child]`. Do not replace the child's existing count.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int k;
    scanf("%d", &k);
    int next[603] = {0};
    int failure[201] = {0};
    int terminal[201] = {0};
    int queue[201] = {0};
    int nodes = 1;
    for (int i = 0; i < k; i++) {
        char p[257];
        scanf("%256s", p);
        int state = 0;
        for (int j = 0; j < (int)strlen(p); j++) {
            int edge = state * 3 + p[j] - 'a';
            if (next[edge] == 0) {
                next[edge] = nodes;
                nodes++;
            }
            state = next[edge];
        }
        terminal[state]++;
    }
    int head = 0;
    int tail = 0;
    for (int ch = 0; ch < 3; ch++) {
        if (next[ch] != 0) {
            queue[tail] = next[ch];
            tail++;
        }
    }
    while (head < tail) {
        int state = queue[head];
        head++;
        for (int ch = 0; ch < 3; ch++) {
            int child = next[state * 3 + ch];
            int fallback = next[failure[state] * 3 + ch];
            if (child != 0) {
                failure[child] = fallback;
                terminal[child] = terminal[fallback];
                queue[tail] = child;
                tail++;
            } else {
                next[state * 3 + ch] = fallback;
            }
        }
    }
    char s[257];
    scanf("%256s", s);
    int state = 0;
    int count = 0;
    for (int i = 0; i < (int)strlen(s); i++) {
        state = next[state * 3 + s[i] - 'a'];
        count += terminal[state];
    }
    printf("%d ", (count));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int k;
    cin >> k;
    int next[603] = {0};
    int failure[201] = {0};
    int terminal[201] = {0};
    int queue[201] = {0};
    int nodes = 1;
    for (int i = 0; i < k; i++) {
        string p;
        cin >> p;
        int state = 0;
        for (int j = 0; j < (int)p.size(); j++) {
            int edge = state * 3 + p[j] - 'a';
            if (next[edge] == 0) {
                next[edge] = nodes;
                nodes++;
            }
            state = next[edge];
        }
        terminal[state]++;
    }
    int head = 0;
    int tail = 0;
    for (int ch = 0; ch < 3; ch++) {
        if (next[ch] != 0) {
            queue[tail] = next[ch];
            tail++;
        }
    }
    while (head < tail) {
        int state = queue[head];
        head++;
        for (int ch = 0; ch < 3; ch++) {
            int child = next[state * 3 + ch];
            int fallback = next[failure[state] * 3 + ch];
            if (child != 0) {
                failure[child] = fallback;
                terminal[child] = terminal[fallback];
                queue[tail] = child;
                tail++;
            } else {
                next[state * 3 + ch] = fallback;
            }
        }
    }
    string s;
    cin >> s;
    int state = 0;
    int count = 0;
    for (int i = 0; i < (int)s.size(); i++) {
        state = next[state * 3 + s[i] - 'a'];
        count += terminal[state];
    }
    cout << (count) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int k;
        k = scanner.nextInt();
        int[] next = new int[603];
        int[] failure = new int[201];
        int[] terminal = new int[201];
        int[] queue = new int[201];
        int nodes = 1;
        for (int i = 0; i < k; i++) {
            String p;
            p = scanner.next();
            int state = 0;
            for (int j = 0; j < p.length(); j++) {
                int edge = state * 3 + p.charAt(j) - 'a';
                if (next[edge] == 0) {
                    next[edge] = nodes;
                    nodes++;
                }
                state = next[edge];
            }
            terminal[state]++;
        }
        int head = 0;
        int tail = 0;
        for (int ch = 0; ch < 3; ch++) {
            if (next[ch] != 0) {
                queue[tail] = next[ch];
                tail++;
            }
        }
        while (head < tail) {
            int state = queue[head];
            head++;
            for (int ch = 0; ch < 3; ch++) {
                int child = next[state * 3 + ch];
                int fallback = next[failure[state] * 3 + ch];
                if (child != 0) {
                    failure[child] = fallback;
                    terminal[child] = terminal[fallback];
                    queue[tail] = child;
                    tail++;
                } else {
                    next[state * 3 + ch] = fallback;
                }
            }
        }
        String s;
        s = scanner.next();
        int state = 0;
        int count = 0;
        for (int i = 0; i < s.length(); i++) {
            state = next[state * 3 + s.charAt(i) - 'a'];
            count += terminal[state];
        }
        System.out.print((count) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

k = read_int()
next_node = [0] * 603
failure = [0] * 201
terminal = [0] * 201
queue = [0] * 201
nodes = 1
for _ in range(k):
    p = read_word()
    state = 0
    for ch in p:
        edge = state * 3 + ord(ch) - ord('a')
        if next_node[edge] == 0:
            next_node[edge] = nodes
            nodes += 1
        state = next_node[edge]
    terminal[state] += 1
head = 0
tail = 0
for ch in range(3):
    if next_node[ch] != 0:
        queue[tail] = next_node[ch]
        tail += 1
while head < tail:
    state = queue[head]
    head += 1
    for ch in range(3):
        child = next_node[state * 3 + ch]
        fallback = next_node[failure[state] * 3 + ch]
        if child != 0:
            failure[child] = fallback
            terminal[child] = terminal[fallback]
            queue[tail] = child
            tail += 1
        else:
            next_node[state * 3 + ch] = fallback
s = read_word()
state = 0
count = 0
for ch in s:
    state = next_node[state * 3 + ord(ch) - ord('a')]
    count += terminal[state]
print(count)
```

---

## 25. Three-Image Recovery

ARRAYS · Difficulty 100 · Bounty 1000

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged three stored copies of software. Patch needs their longest shared section.

What the code should do
Find the length of the longest nonempty substring that appears in all three words, `s`, `t`, and `u`. Its letters must be consecutive and in the same order in each word, but its starting positions may differ. Print `0` if the words share no letter.

What's going wrong
When a match cannot continue, the program can forget letters that still match a shorter ending.

How to read the code
A substring is a consecutive part of a word. A suffix automaton groups substrings of `s` that end at the same positions. Each group is a state. `state` names the current group, and `link` leads to a group for shorter endings. `matched` is the current match length; `best` records lengths for one scanned word, and `common` combines results across words.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read the three words in order: `s`, the first word; `t`, the second; and `u`, the third. Each uses only `a`, `b`, and `c`.

Output
Print one integer: the longest shared substring length. Do not print the substring itself.

Example explained
The words `ababc`, `babca`, and `cabab` all contain `bab`. No substring of length `4` appears in all three. Print `3`.

Limits
Each of `s`, `t`, and `u` contains from `1` to `256` letters. Only `a`, `b`, and `c` are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
ababc babca cabab
```

Expected output:

```text
3
```

Sample 2 input:

```text
aaa bbb ccc
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Moving to a shorter ending can keep part of the current match.
2. After following `link`, the new `state` and `matched` must describe the same retained match.
3. After `state = link[state]`, set `matched` to `length[state]`, the new state's maximum length. A successful next transition adds one; reset to `0` only when no transition is possible at the root, state `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    char t[257];
    char u[257];
    scanf("%256s", s);
    scanf("%256s", t);
    scanf("%256s", u);
    int next[1542] = {0};
    int link[514] = {0};
    int length[514] = {0};
    int common[514] = {0};
    int best[514] = {0};
    int order[514] = {0};
    int count[257] = {0};
    for (int i = 0; i < 1542; i++) {
        next[i] = -1;
    }
    for (int i = 0; i < 514; i++) {
        link[i] = -1;
    }
    int nodes = 1;
    int last = 0;
    for (int i = 0; i < (int)strlen(s); i++) {
        int ch = s[i] - 'a';
        int current = nodes;
        nodes++;
        length[current] = length[last] + 1;
        int p = last;
        while (p != -1 && next[p * 3 + ch] == -1) {
            next[p * 3 + ch] = current;
            p = link[p];
        }
        if (p == -1) {
            link[current] = 0;
        } else {
            int q = next[p * 3 + ch];
            if (length[p] + 1 == length[q]) {
                link[current] = q;
            } else {
                int clone = nodes;
                nodes++;
                length[clone] = length[p] + 1;
                link[clone] = link[q];
                for (int x = 0; x < 3; x++) {
                    next[clone * 3 + x] = next[q * 3 + x];
                }
                while (p != -1 && next[p * 3 + ch] == q) {
                    next[p * 3 + ch] = clone;
                    p = link[p];
                }
                link[q] = clone;
                link[current] = clone;
            }
        }
        last = current;
    }
    for (int v = 0; v < nodes; v++) {
        common[v] = length[v];
        count[length[v]]++;
    }
    for (int i = 1; i <= (int)strlen(s); i++) {
        count[i] += count[i - 1];
    }
    for (int v = nodes - 1; v >= 0; v--) {
        count[length[v]]--;
        order[count[length[v]]] = v;
    }
    for (int pass = 0; pass < 2; pass++) {
        for (int v = 0; v < nodes; v++) {
            best[v] = 0;
        }
        int state = 0;
        int matched = 0;
        int wordLength = (int)strlen(t);
        if (pass == 1) {
            wordLength = (int)strlen(u);
        }
        for (int i = 0; i < wordLength; i++) {
            int ch;
            if (pass == 0) {
                ch = t[i] - 'a';
            } else {
                ch = u[i] - 'a';
            }
            while (state != 0 && next[state * 3 + ch] == -1) {
                state = link[state];
                matched = 0;
            }
            if (next[state * 3 + ch] != -1) {
                state = next[state * 3 + ch];
                matched++;
            } else {
                matched = 0;
            }
            if (matched > best[state]) {
                best[state] = matched;
            }
        }
        for (int i = nodes - 1; i > 0; i--) {
            int v = order[i];
            int p = link[v];
            int take = best[v];
            if (length[p] < take) {
                take = length[p];
            }
            if (take > best[p]) {
                best[p] = take;
            }
        }
        for (int v = 0; v < nodes; v++) {
            if (best[v] < common[v]) {
                common[v] = best[v];
            }
        }
    }
    int answer = 0;
    for (int v = 0; v < nodes; v++) {
        if (common[v] > answer) {
            answer = common[v];
        }
    }
    printf("%d ", (answer));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string s;
    string t;
    string u;
    cin >> s;
    cin >> t;
    cin >> u;
    int next[1542] = {0};
    int link[514] = {0};
    int length[514] = {0};
    int common[514] = {0};
    int best[514] = {0};
    int order[514] = {0};
    int count[257] = {0};
    for (int i = 0; i < 1542; i++) {
        next[i] = -1;
    }
    for (int i = 0; i < 514; i++) {
        link[i] = -1;
    }
    int nodes = 1;
    int last = 0;
    for (int i = 0; i < (int)s.size(); i++) {
        int ch = s[i] - 'a';
        int current = nodes;
        nodes++;
        length[current] = length[last] + 1;
        int p = last;
        while (p != -1 && next[p * 3 + ch] == -1) {
            next[p * 3 + ch] = current;
            p = link[p];
        }
        if (p == -1) {
            link[current] = 0;
        } else {
            int q = next[p * 3 + ch];
            if (length[p] + 1 == length[q]) {
                link[current] = q;
            } else {
                int clone = nodes;
                nodes++;
                length[clone] = length[p] + 1;
                link[clone] = link[q];
                for (int x = 0; x < 3; x++) {
                    next[clone * 3 + x] = next[q * 3 + x];
                }
                while (p != -1 && next[p * 3 + ch] == q) {
                    next[p * 3 + ch] = clone;
                    p = link[p];
                }
                link[q] = clone;
                link[current] = clone;
            }
        }
        last = current;
    }
    for (int v = 0; v < nodes; v++) {
        common[v] = length[v];
        count[length[v]]++;
    }
    for (int i = 1; i <= (int)s.size(); i++) {
        count[i] += count[i - 1];
    }
    for (int v = nodes - 1; v >= 0; v--) {
        count[length[v]]--;
        order[count[length[v]]] = v;
    }
    for (int pass = 0; pass < 2; pass++) {
        for (int v = 0; v < nodes; v++) {
            best[v] = 0;
        }
        int state = 0;
        int matched = 0;
        int wordLength = (int)t.size();
        if (pass == 1) {
            wordLength = (int)u.size();
        }
        for (int i = 0; i < wordLength; i++) {
            int ch;
            if (pass == 0) {
                ch = t[i] - 'a';
            } else {
                ch = u[i] - 'a';
            }
            while (state != 0 && next[state * 3 + ch] == -1) {
                state = link[state];
                matched = 0;
            }
            if (next[state * 3 + ch] != -1) {
                state = next[state * 3 + ch];
                matched++;
            } else {
                matched = 0;
            }
            if (matched > best[state]) {
                best[state] = matched;
            }
        }
        for (int i = nodes - 1; i > 0; i--) {
            int v = order[i];
            int p = link[v];
            int take = best[v];
            if (length[p] < take) {
                take = length[p];
            }
            if (take > best[p]) {
                best[p] = take;
            }
        }
        for (int v = 0; v < nodes; v++) {
            if (best[v] < common[v]) {
                common[v] = best[v];
            }
        }
    }
    int answer = 0;
    for (int v = 0; v < nodes; v++) {
        if (common[v] > answer) {
            answer = common[v];
        }
    }
    cout << (answer) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s;
        String t;
        String u;
        s = scanner.next();
        t = scanner.next();
        u = scanner.next();
        int[] next = new int[1542];
        int[] link = new int[514];
        int[] length = new int[514];
        int[] common = new int[514];
        int[] best = new int[514];
        int[] order = new int[514];
        int[] count = new int[257];
        for (int i = 0; i < 1542; i++) {
            next[i] = -1;
        }
        for (int i = 0; i < 514; i++) {
            link[i] = -1;
        }
        int nodes = 1;
        int last = 0;
        for (int i = 0; i < s.length(); i++) {
            int ch = s.charAt(i) - 'a';
            int current = nodes;
            nodes++;
            length[current] = length[last] + 1;
            int p = last;
            while (p != -1 && next[p * 3 + ch] == -1) {
                next[p * 3 + ch] = current;
                p = link[p];
            }
            if (p == -1) {
                link[current] = 0;
            } else {
                int q = next[p * 3 + ch];
                if (length[p] + 1 == length[q]) {
                    link[current] = q;
                } else {
                    int clone = nodes;
                    nodes++;
                    length[clone] = length[p] + 1;
                    link[clone] = link[q];
                    for (int x = 0; x < 3; x++) {
                        next[clone * 3 + x] = next[q * 3 + x];
                    }
                    while (p != -1 && next[p * 3 + ch] == q) {
                        next[p * 3 + ch] = clone;
                        p = link[p];
                    }
                    link[q] = clone;
                    link[current] = clone;
                }
            }
            last = current;
        }
        for (int v = 0; v < nodes; v++) {
            common[v] = length[v];
            count[length[v]]++;
        }
        for (int i = 1; i <= s.length(); i++) {
            count[i] += count[i - 1];
        }
        for (int v = nodes - 1; v >= 0; v--) {
            count[length[v]]--;
            order[count[length[v]]] = v;
        }
        for (int pass = 0; pass < 2; pass++) {
            for (int v = 0; v < nodes; v++) {
                best[v] = 0;
            }
            int state = 0;
            int matched = 0;
            int wordLength = t.length();
            if (pass == 1) {
                wordLength = u.length();
            }
            for (int i = 0; i < wordLength; i++) {
                int ch;
                if (pass == 0) {
                    ch = t.charAt(i) - 'a';
                } else {
                    ch = u.charAt(i) - 'a';
                }
                while (state != 0 && next[state * 3 + ch] == -1) {
                    state = link[state];
                    matched = 0;
                }
                if (next[state * 3 + ch] != -1) {
                    state = next[state * 3 + ch];
                    matched++;
                } else {
                    matched = 0;
                }
                if (matched > best[state]) {
                    best[state] = matched;
                }
            }
            for (int i = nodes - 1; i > 0; i--) {
                int v = order[i];
                int p = link[v];
                int take = best[v];
                if (length[p] < take) {
                    take = length[p];
                }
                if (take > best[p]) {
                    best[p] = take;
                }
            }
            for (int v = 0; v < nodes; v++) {
                if (best[v] < common[v]) {
                    common[v] = best[v];
                }
            }
        }
        int answer = 0;
        for (int v = 0; v < nodes; v++) {
            if (common[v] > answer) {
                answer = common[v];
            }
        }
        System.out.print((answer) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

s = read_word()
t = read_word()
u = read_word()
next_node = [-1] * 1542
link = [-1] * 514
length = [0] * 514
common = [0] * 514
best = [0] * 514
order = [0] * 514
count = [0] * 257
nodes = 1
last = 0
for ch in s:
    ch = ord(ch) - ord('a')
    current = nodes
    nodes += 1
    length[current] = length[last] + 1
    p = last
    while p != -1 and next_node[p * 3 + ch] == -1:
        next_node[p * 3 + ch] = current
        p = link[p]
    if p == -1:
        link[current] = 0
    else:
        q = next_node[p * 3 + ch]
        if length[p] + 1 == length[q]:
            link[current] = q
        else:
            clone = nodes
            nodes += 1
            length[clone] = length[p] + 1
            link[clone] = link[q]
            for x in range(3):
                next_node[clone * 3 + x] = next_node[q * 3 + x]
            while p != -1 and next_node[p * 3 + ch] == q:
                next_node[p * 3 + ch] = clone
                p = link[p]
            link[q] = clone
            link[current] = clone
    last = current
for v in range(nodes):
    common[v] = length[v]
    count[length[v]] += 1
for i in range(1, len(s) + 1):
    count[i] += count[i - 1]
for v in range(nodes - 1, -1, -1):
    count[length[v]] -= 1
    order[count[length[v]]] = v
for word in (t, u):
    for v in range(nodes):
        best[v] = 0
    state = 0
    matched = 0
    for ch in word:
        ch = ord(ch) - ord('a')
        while state != 0 and next_node[state * 3 + ch] == -1:
            state = link[state]
            matched = 0
        if next_node[state * 3 + ch] != -1:
            state = next_node[state * 3 + ch]
            matched += 1
        else:
            matched = 0
        best[state] = max(best[state], matched)
    for i in range(nodes - 1, 0, -1):
        v = order[i]
        p = link[v]
        best[p] = max(best[p], min(best[v], length[p]))
    for v in range(nodes):
        common[v] = min(common[v], best[v])
print(max(common[:nodes]))
```

---

## 26. Aligned Rescue Span

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

### Public samples

Sample 1 input:

```text
1 4 3
1 7
```

Expected output:

```text
4
```

Sample 2 input:

```text
1 1 2
0 5
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. An aligned start can still leave too little space.
2. Compare the space after `candidate` with the space after `left`.
3. Accept only when `candidate + size <= right`. Keep the first valid result, since ranges arrive in address order.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 27. Fragment Tailroom

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

### Public samples

Sample 1 input:

```text
19 20 4
```

Expected output:

```text
0 16 1 2 3 0
```

Sample 2 input:

```text
8 8 0
```

Expected output:

```text
0 8 0
```

### Progressive hints (private until purchased)

1. Does the last fragment need a data length divisible by 8?
2. Compare a remainder of 19 bytes with `limit = 20` and `chunk = 16`, the rounded nonfinal length.
3. Test the final remainder against `limit`, not `chunk`. Use `chunk` only when another fragment must follow.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 28. Boundary Tag Reunion

SYSTEMS · Difficulty 32 · Bounty 320

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch frees memory cells and needs the longest free run.

What the code should do
All `m` cells start occupied. Free the listed cells in order. Each cell is listed once. Consecutive free cells form one run. Print the length of the largest run after all releases. Keep the supplied boundary-tag approach, which uses length records at run endpoints to join neighboring runs.

What's going wrong
Freeing a cell beside an existing run can lose part of that run's length.

How to read the code
A run is a group of consecutive free cells. A boundary tag records run-length information at a run's endpoint. The free-cell flags are `freeCell` in C, C++ and Java; `free_cell` in Python. `span` holds the tags.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `m`, the cell count, and `q`, the release count.
2. Read the `q` distinct cell indices, starting from 0.

Output
Print the largest free-run length. Print `0` if no cells are freed.

Example explained
For input `4 3 0 2 1`, cells 0 through 2 form one run. The output is `3`.

Limits
`1 <= m <= 128`. `0 <= q <= m`. Each released index `x` satisfies `0 <= x < m`. No index repeats.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 3
0 2 1
```

Expected output:

```text
3
```

Sample 2 input:

```text
5 2
0 4
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. A later release may approach an existing run from either side.
2. After a merge, compare the tags at `left` and `right`, the merged run's endpoints.
3. Set both `span[left]` and `span[right]` to `length`, the full merged length. A later release may read either tag.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int m, q;
    scanf("%d", &m);
    scanf("%d", &q);
    int freeCell[128] = {0};
    int span[128] = {0};
    int largest = 0;
    for (int i = 0; i < q; i++) {
        int x;
        scanf("%d", &x);
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
        span[right] = 1;
        if (length > largest) {
            largest = length;
        }
    }
    printf("%d ", (largest));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int m, q;
    cin >> m;
    cin >> q;
    int freeCell[128] = {0};
    int span[128] = {0};
    int largest = 0;
    for (int i = 0; i < q; i++) {
        int x;
        cin >> x;
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
        span[right] = 1;
        if (length > largest) {
            largest = length;
        }
    }
    cout << (largest) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int m, q;
        m = scanner.nextInt();
        q = scanner.nextInt();
        int[] freeCell = new int[128];
        int[] span = new int[128];
        int largest = 0;
        for (int i = 0; i < q; i++) {
            int x;
            x = scanner.nextInt();
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
            span[right] = 1;
            if (length > largest) {
                largest = length;
            }
        }
        System.out.print((largest) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

m = read_int()
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
    span[right] = 1
    largest = max(largest, length)
print(largest)
```

---

## 29. Wrapped Burst Admission

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

### Public samples

Sample 1 input:

```text
3 3
1 2 8 9
2 1
1 2 4 5
```

Expected output:

```text
0 3 9 4 5
```

Sample 2 input:

```text
2 2
1 2 1 2
1 1 3
```

Expected output:

```text
1 2 1 2
```

### Progressive hints (private until purchased)

1. Append near the array's end, remove some values, then append another group.
2. Space after `tail` is only part of the free space in a circular queue.
3. Use `count + k <= cap` for admission. The existing wrap operation already places each accepted value correctly.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 30. Clean Fill, Dirty Ghost

SYSTEMS · Difficulty 38 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to count disk writes caused by replacing stored blocks.

What the code should do
Start with an empty cache, a set of slots holding blocks for reuse. Each block can use only slot `block % slots`, the remainder after division by `slots`. Process `0 block` as a read and `1 block` as a write. If the requested block is absent, count one miss and load it into its slot. Replacing a dirty block, one written since loading, counts one writeback to disk. The loaded block is clean unless this request is a write. On a hit, a write makes the block dirty; a read leaves its state unchanged. Do not save remaining dirty blocks at the end.

What's going wrong
Loading a clean block after replacing a dirty one can cause an extra writeback later.

How to read the code
A cache stores data blocks for reuse. A hit finds a block already stored; a miss needs a load. A dirty block has been written since loading and needs saving to disk before replacement. This save is a writeback. `valid`, `tag` and `dirty` describe each slot.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `slots`, the number of cache positions, and `q`, the request count.
2. Read `q` pairs `op block`: operation `op` and block ID `block`.

Output
Print the miss count, then the writeback count.

Example explained
For input `1 3 1 0 0 1 0 2`, all requests miss. Only block 0 needs a writeback. The output is `3 1`.

Limits
`1 <= slots <= 16`. `0 <= q <= 100`. `0 <= block <= 1000`. `op` is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 3
1 0
0 1
0 2
```

Expected output:

```text
3 1
```

Sample 2 input:

```text
2 3
0 0
1 1
0 0
```

Expected output:

```text
2 0
```

### Progressive hints (private until purchased)

1. Trace a write followed by two reads of different blocks using the same slot.
2. Does `dirty` describe the slot forever, or just its current block?
3. After saving an outgoing dirty block, set the incoming block's dirty state to `0`. Then handle a write request by setting it to `1`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int slots, q;
    scanf("%d", &slots);
    scanf("%d", &q);
    int valid[16] = {0};
    int tag[16] = {0};
    int dirty[16] = {0};
    int misses = 0;
    int writebacks = 0;
    for (int i = 0; i < q; i++) {
        int op, block;
        scanf("%d", &op);
        scanf("%d", &block);
        int slot = block % slots;
        if (valid[slot] == 0 || tag[slot] != block) {
            misses++;
            if (valid[slot] == 1 && dirty[slot] == 1) {
                writebacks++;
            }
            valid[slot] = 1;
            tag[slot] = block;
            dirty[slot] = dirty[slot];
        }
        if (op == 1) {
            dirty[slot] = 1;
        }
    }
    printf("%d ", (misses));
    printf("%d ", (writebacks));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int slots, q;
    cin >> slots;
    cin >> q;
    int valid[16] = {0};
    int tag[16] = {0};
    int dirty[16] = {0};
    int misses = 0;
    int writebacks = 0;
    for (int i = 0; i < q; i++) {
        int op, block;
        cin >> op;
        cin >> block;
        int slot = block % slots;
        if (valid[slot] == 0 || tag[slot] != block) {
            misses++;
            if (valid[slot] == 1 && dirty[slot] == 1) {
                writebacks++;
            }
            valid[slot] = 1;
            tag[slot] = block;
            dirty[slot] = dirty[slot];
        }
        if (op == 1) {
            dirty[slot] = 1;
        }
    }
    cout << (misses) << ' ';
    cout << (writebacks) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int slots, q;
        slots = scanner.nextInt();
        q = scanner.nextInt();
        int[] valid = new int[16];
        int[] tag = new int[16];
        int[] dirty = new int[16];
        int misses = 0;
        int writebacks = 0;
        for (int i = 0; i < q; i++) {
            int op, block;
            op = scanner.nextInt();
            block = scanner.nextInt();
            int slot = block % slots;
            if (valid[slot] == 0 || tag[slot] != block) {
                misses++;
                if (valid[slot] == 1 && dirty[slot] == 1) {
                    writebacks++;
                }
                valid[slot] = 1;
                tag[slot] = block;
                dirty[slot] = dirty[slot];
            }
            if (op == 1) {
                dirty[slot] = 1;
            }
        }
        System.out.print((misses) + " ");
        System.out.print((writebacks) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

slots = read_int()
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
        dirty[slot] = dirty[slot]
    if op == 1:
        dirty[slot] = 1
print(misses, writebacks)
```

---

## 31. Pinned Cache Refuge

SYSTEMS · Difficulty 41 · Bounty 410

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to protect selected data while other data is loaded.

What the code should do
Start with an empty cache, which stores pages for reuse. Any page can occupy any slot. `0 page` accesses a page. A hit makes it most recently accessed. A miss uses the lowest-numbered empty slot, or replaces the unpinned page whose last access was earliest. Pinning protects a page from replacement. Each successful load starts unpinned and counts once in `loads`. If all slots are full and pinned, count one blocked access and change nothing. `1 page` pins a stored page; `2 page` unpins it. Both do nothing for an absent page and leave access times unchanged.

What's going wrong
Loading a new page can remove a pinned page.

How to read the code
A cache holds numbered data blocks called pages. A hit finds a stored page; a miss needs a load. A pinned page cannot be removed. `stamp` records last access; `pinned` records protection. The page array is `pageAt` in C, C++ and Java; `page_at` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `capacity`, the slot count, and `q`, the operation count.
2. Read `q` pairs `op page`: operation `op` and page ID `page`.

Output
Print `loads`, the successful-load count; `blocked`, the blocked-access count; then slot contents from index 0 through `capacity - 1`. Use `0` for an empty slot.

Example explained
For input `1 3 0 7 1 7 0 8`, page 7 is pinned, so loading page 8 is blocked. The output is `1 1 7`.

Limits
`1 <= capacity <= 8`. `0 <= q <= 100`. `1 <= page <= 100`. `op` is `0`, `1` or `2`. Access times use distinct operation positions, so stored pages cannot tie for last access.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 3
0 7
1 7
0 8
```

Expected output:

```text
1 1 7
```

Sample 2 input:

```text
2 3
0 2
0 3
0 2
```

Expected output:

```text
2 0 2 3
```

### Progressive hints (private until purchased)

1. The page unused for longest may still be protected.
2. Check which occupied slots can become `victim`, the replacement slot.
3. Consider only slots with `pinned[j] == 0` when comparing `stamp`. If none qualify, leave `victim` as `-1` so the access is blocked.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, q;
    scanf("%d", &capacity);
    scanf("%d", &q);
    int pageAt[8] = {0};
    int stamp[8] = {0};
    int pinned[8] = {0};
    int loads = 0;
    int blocked = 0;
    for (int time = 1; time <= q; time++) {
        int op, page;
        scanf("%d", &op);
        scanf("%d", &page);
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
                    if (victim == -1 || stamp[j] < stamp[victim]) {
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
    printf("%d ", (loads));
    printf("%d ", (blocked));
    for (int j = 0; j < capacity; j++) {
        printf("%d ", (pageAt[j]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int capacity, q;
    cin >> capacity;
    cin >> q;
    int pageAt[8] = {0};
    int stamp[8] = {0};
    int pinned[8] = {0};
    int loads = 0;
    int blocked = 0;
    for (int time = 1; time <= q; time++) {
        int op, page;
        cin >> op;
        cin >> page;
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
                    if (victim == -1 || stamp[j] < stamp[victim]) {
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
    cout << (loads) << ' ';
    cout << (blocked) << ' ';
    for (int j = 0; j < capacity; j++) {
        cout << (pageAt[j]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int capacity, q;
        capacity = scanner.nextInt();
        q = scanner.nextInt();
        int[] pageAt = new int[8];
        int[] stamp = new int[8];
        int[] pinned = new int[8];
        int loads = 0;
        int blocked = 0;
        for (int time = 1; time <= q; time++) {
            int op, page;
            op = scanner.nextInt();
            page = scanner.nextInt();
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
                        if (victim == -1 || stamp[j] < stamp[victim]) {
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
        System.out.print((loads) + " ");
        System.out.print((blocked) + " ");
        for (int j = 0; j < capacity; j++) {
            System.out.print((pageAt[j]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

capacity = read_int()
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
                if victim == -1 or stamp[j] < stamp[victim]:
                    victim = j
        if victim == -1:
            blocked += 1
        else:
            page_at[victim] = page
            stamp[victim] = time
            pinned[victim] = 0
            loads += 1
print(loads, blocked)
print(*page_at)
```

---

## 32. End-Around Carry

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

### Public samples

Sample 1 input:

```text
2
65535 1
```

Expected output:

```text
65534
```

Sample 2 input:

```text
2
1 2
```

Expected output:

```text
65532
```

### Progressive hints (private until purchased)

1. When a sum exceeds 65535, should the excess high part disappear?
2. Split the sum into its remainder and whole-number quotient after division by 65536.
3. Add both parts: `sum % 65536 + sum / 65536` in C, C++ and Java; `total % 65536 + total // 65536` in Python. Repeat before subtracting the result from `65535`.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 33. C-LOOK Return Journey

SYSTEMS · Difficulty 45 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs a disk's service order and total travel distance.

What the code should do
All requests are waiting initially. A track is a numbered disk position. Repeatedly service the lowest requested track at or above `head`, the current position. If none remains there, service the lowest requested track overall. Equal-track requests use input order. Moving costs the absolute difference from the previous head position, including a move back to a lower track. Set the head to the serviced track. Service itself costs no movement.

What's going wrong
The service order can be correct while the distance leaves out travel back to lower tracks.

How to read the code
A track is a numbered disk position. `head` is the current position, `track` stores requests, and `done` marks serviced requests. C-LOOK is the selection rule defined in the task. `distance` totals head movement.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the request count, and `head`, the starting track.
2. Read the `n` requested tracks.

Output
Print the `n` serviced track numbers in service order, then the total movement. If `n` is `0`, print only `0`.

Example explained
For input `3 40 10 50 20`, service tracks 50, 10, 20. Travel is 10 + 40 + 10 = 60. The output is `50 10 20 60`.

Limits
`0 <= n <= 100`. The starting `head` and requested tracks are integers from 0 through 1000.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 40
10 50 20
```

Expected output:

```text
50 10 20 60
```

Sample 2 input:

```text
2 0
3 1
```

Expected output:

```text
1 3 3
```

### Progressive hints (private until purchased)

1. Choosing a lower track still requires physical movement.
2. Check whether `distance` changes when `wrapped` says no higher request remained.
3. Add `movement` to `distance` after every selection, including a wrap, before updating `head`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, head;
    scanf("%d", &n);
    scanf("%d", &head);
    int track[100] = {0};
    int done[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &track[i]);
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
        if (wrapped == 0) {
            distance += movement;
        }
        head = track[chosen];
        done[chosen] = 1;
        printf("%d ", (head));
    }
    printf("%d ", (distance));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, head;
    cin >> n;
    cin >> head;
    int track[100] = {0};
    int done[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> track[i];
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
        if (wrapped == 0) {
            distance += movement;
        }
        head = track[chosen];
        done[chosen] = 1;
        cout << (head) << ' ';
    }
    cout << (distance) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, head;
        n = scanner.nextInt();
        head = scanner.nextInt();
        int[] track = new int[100];
        int[] done = new int[100];
        for (int i = 0; i < n; i++) {
            track[i] = scanner.nextInt();
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
            if (wrapped == 0) {
                distance += movement;
            }
            head = track[chosen];
            done[chosen] = 1;
            System.out.print((head) + " ");
        }
        System.out.print((distance) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
    if not wrapped:
        distance += movement
    head = track[chosen]
    done[chosen] = 1
    print(head)
print(distance)
```

---

## 34. Frequency Inheritance

SYSTEMS · Difficulty 48 · Bounty 480

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to replace stored data according to how often it is used.

What the code should do
Start with an empty cache, which stores pages for reuse. On a hit, increase that page's access count by one and mark its access as most recent. On a miss, use the lowest-numbered empty slot. If full, replace the page with the lowest access count; break a tie by the earliest last access. Each newly loaded page starts with count 1 and the current access time, even if it appeared before. Print misses and final slots.

What's going wrong
A newly loaded page can receive the old page's access count.

How to read the code
A cache stores numbered data blocks called pages. A hit finds a stored page; a miss loads it. LFU means least frequently used. `freq` records a stored page's access count and `stamp` its last access time. The page array is `pageAt` in C, C++ and Java; `page_at` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `capacity`, the slot count, and `n`, the access count.
2. Read the `n` page IDs in access order.

Output
Print the miss count, then slot contents from index 0 through `capacity - 1`. Use `0` for an empty slot.

Example explained
For input `2 4 1 1 2 3`, page 1 is used twice, so page 3 replaces page 2. The output is `3 1 3`.

Limits
`1 <= capacity <= 8`. `0 <= n <= 100`. Page IDs are from 1 through 100.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 4
1 1 2 3
```

Expected output:

```text
3 1 3
```

Sample 2 input:

```text
2 3
1 2 1
```

Expected output:

```text
2 1 2
```

### Progressive hints (private until purchased)

1. Should a new page inherit the history of its slot?
2. Compare a hit with a replacement: only one continues the same page's count.
3. On every load, set `freq[victim]` to `1`. Increment an existing count only on a hit; keep the last-access tie rule.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, n;
    scanf("%d", &capacity);
    scanf("%d", &n);
    int pageAt[8] = {0};
    int freq[8] = {0};
    int stamp[8] = {0};
    int misses = 0;
    for (int time = 1; time <= n; time++) {
        int page;
        scanf("%d", &page);
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
            freq[victim] += 1;
            stamp[victim] = time;
        }
    }
    printf("%d ", (misses));
    for (int j = 0; j < capacity; j++) {
        printf("%d ", (pageAt[j]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int capacity, n;
    cin >> capacity;
    cin >> n;
    int pageAt[8] = {0};
    int freq[8] = {0};
    int stamp[8] = {0};
    int misses = 0;
    for (int time = 1; time <= n; time++) {
        int page;
        cin >> page;
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
            freq[victim] += 1;
            stamp[victim] = time;
        }
    }
    cout << (misses) << ' ';
    for (int j = 0; j < capacity; j++) {
        cout << (pageAt[j]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int capacity, n;
        capacity = scanner.nextInt();
        n = scanner.nextInt();
        int[] pageAt = new int[8];
        int[] freq = new int[8];
        int[] stamp = new int[8];
        int misses = 0;
        for (int time = 1; time <= n; time++) {
            int page;
            page = scanner.nextInt();
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
                freq[victim] += 1;
                stamp[victim] = time;
            }
        }
        System.out.print((misses) + " ");
        for (int j = 0; j < capacity; j++) {
            System.out.print((pageAt[j]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

capacity = read_int()
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
        freq[victim] += 1
        stamp[victim] = time
print(misses)
print(*page_at)
```

---

## 35. Translation After Remap

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

### Public samples

Sample 1 input:

```text
1 4 4
1 0 2
3 1 0
1 0 5
3 1 0
```

Expected output:

```text
9 21
```

Sample 2 input:

```text
2 8 2
1 1 3
3 15 0
```

Expected output:

```text
31
```

### Progressive hints (private until purchased)

1. Read the same page before and after a remap or unmap.
2. Can a saved frame outlive the mapping it describes? Saved frames are in `frameAt` in C, C++ and Java; `frame_at` in Python.
3. On both map and unmap, set `cached[x]` to `0`. The next read will use the current mapping or report `-1`.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 36. Recycled Badge Generation

SYSTEMS · Difficulty 53 · Bounty 530

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs old resource badges to stay invalid after a slot is reused.

What the code should do
All slots start free with generation 0. A generation number distinguishes successive occupants. A handle encodes it as `generation * slots + slot`. `1 number` allocates slot `number` if free; allocating an occupied slot changes nothing. `2 number` releases the occupant named by handle `number` only if it is current and live, then increases that slot's generation by one. Invalid releases do nothing. `3 number` prints `1` if the handle names the current live occupant, otherwise `0`. Allocation prints nothing.

What's going wrong
A badge from an earlier occupant can be accepted after the slot is reused.

How to read the code
A handle is a numeric badge for one occupant of a slot. `generation` counts successful releases of each slot. `live` records whether it is occupied. A handle is encoded as `generation * slots + slot`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `slots`, the slot count, and `q`, the operation count.
2. Read `q` pairs `op number`. `number` is a slot index for `op = 1`, and an encoded handle for `op = 2` or `op = 3`.

Output
Print one validation result, `0` or `1`, per operation `3`, in order.

Example explained
For input `2 5 1 0 2 0 1 0 3 0 3 2`, the reused slot has handle 2. Handle 0 is old, so the output is `0 1`.

Limits
`1 <= slots <= 16`. `1 <= q <= 100`, with at least one validation query. Allocation indices are from 0 through `slots - 1`. Handles are from 0 through 2000. `op` is `1`, `2` or `3`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 5
1 0
2 0
1 0
3 0
3 2
```

Expected output:

```text
0 1
```

Sample 2 input:

```text
2 2
1 1
3 1
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. A live slot can have a different occupant from the one an old handle named.
2. Compare `issued`, the handle's encoded generation, with `generation[slot]` after reuse.
3. Require `issued == generation[slot]` as well as a live slot. An earlier generation is stale; a later one has not been issued.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int slots, q;
    scanf("%d", &slots);
    scanf("%d", &q);
    int live[16] = {0};
    int generation[16] = {0};
    for (int i = 0; i < q; i++) {
        int op, number;
        scanf("%d", &op);
        scanf("%d", &number);
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
                int valid = live[slot] == 1 && issued <= generation[slot] ? 1 : 0;
                printf("%d ", (valid));
            }
        }
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int slots, q;
    cin >> slots;
    cin >> q;
    int live[16] = {0};
    int generation[16] = {0};
    for (int i = 0; i < q; i++) {
        int op, number;
        cin >> op;
        cin >> number;
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
                int valid = live[slot] == 1 && issued <= generation[slot] ? 1 : 0;
                cout << (valid) << ' ';
            }
        }
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int slots, q;
        slots = scanner.nextInt();
        q = scanner.nextInt();
        int[] live = new int[16];
        int[] generation = new int[16];
        for (int i = 0; i < q; i++) {
            int op, number;
            op = scanner.nextInt();
            number = scanner.nextInt();
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
                    int valid = live[slot] == 1 && issued <= generation[slot] ? 1 : 0;
                    System.out.print((valid) + " ");
                }
            }
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

slots = read_int()
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
            valid = int(live[slot] == 1 and issued <= generation[slot])
            print(valid)
```

---

## 37. Undo in Reverse

SYSTEMS · Difficulty 55 · Bounty 550

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to cancel all writes made during a repair.

What the code should do
Apply every write to the initial memory list in input order. Save the cell's current value before each write, including repeated writes to the same cell. The transaction, or group of writes, is always cancelled. Use the supplied per-write undo log, the saved cells and old values, to restore every cell to its value before the transaction. Print the restored list.

What's going wrong
Cancelling repeated writes can leave a value written partway through the repair.

How to read the code
A transaction groups writes that can be kept or cancelled together. An undo log saves each cell and its value just before each write. `before` stores those values. Matching cell indices are in `cellAt` in C, C++ and Java; `cell_at` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the cell count, and `q`, the write count.
2. Read the `n` initial values of `memory`.
3. Read `q` pairs `cell value`: the zero-based cell index and its new value.

Output
Print the `n` restored memory values in index order.

Example explained
For input `1 2 5 0 8 0 9`, the cell began at 5. After cancellation, the output is `5`.

Limits
`1 <= n <= 32`. `0 <= q <= 100`. `0 <= cell < n`. Initial values and new `value` entries are from -1000 through 1000.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 2
5
0 8
0 9
```

Expected output:

```text
5
```

Sample 2 input:

```text
2 1
3 4
1 6
```

Expected output:

```text
3 4
```

### Progressive hints (private until purchased)

1. Trace two writes to the same cell.
2. The value saved before the second write may already belong to the transaction being cancelled.
3. Replay from the newest record to the oldest. Set `record` to `q - 1 - step`, so the earliest saved value is restored last.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int memory[32] = {0};
    int cellAt[100] = {0};
    int before[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &memory[i]);
    }
    for (int i = 0; i < q; i++) {
        int cell, value;
        scanf("%d", &cell);
        scanf("%d", &value);
        cellAt[i] = cell;
        before[i] = memory[cell];
        memory[cell] = value;
    }
    for (int step = 0; step < q; step++) {
        int record = step;
        memory[cellAt[record]] = before[record];
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (memory[i]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int memory[32] = {0};
    int cellAt[100] = {0};
    int before[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> memory[i];
    }
    for (int i = 0; i < q; i++) {
        int cell, value;
        cin >> cell;
        cin >> value;
        cellAt[i] = cell;
        before[i] = memory[cell];
        memory[cell] = value;
    }
    for (int step = 0; step < q; step++) {
        int record = step;
        memory[cellAt[record]] = before[record];
    }
    for (int i = 0; i < n; i++) {
        cout << (memory[i]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] memory = new int[32];
        int[] cellAt = new int[100];
        int[] before = new int[100];
        for (int i = 0; i < n; i++) {
            memory[i] = scanner.nextInt();
        }
        for (int i = 0; i < q; i++) {
            int cell, value;
            cell = scanner.nextInt();
            value = scanner.nextInt();
            cellAt[i] = cell;
            before[i] = memory[cell];
            memory[cell] = value;
        }
        for (int step = 0; step < q; step++) {
            int record = step;
            memory[cellAt[record]] = before[record];
        }
        for (int i = 0; i < n; i++) {
            System.out.print((memory[i]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
    record = step
    memory[cell_at[record]] = before[record]
print(*memory)
```

---

## 38. Two Owners, One Frame

SYSTEMS · Difficulty 58 · Bounty 580

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs each snapshot write to affect only the selected page.

What the code should do
Start with `n` logical pages, each a list of `width` cells stored in its own physical frame. A frame is storage that pages can share. `1 x y` makes destination page `x` share source page `y`'s current frame and releases the destination's old ownership. Cloning a page to itself changes nothing. `2 x y value` writes `value` to offset `y` of page `x` only. If its frame is shared, first copy the entire frame for that page; all other cells keep their values. `3 x y` reads and prints that cell. Free frames need not be reused.

What's going wrong
Writing one of two pages sharing a frame can change both pages.

How to read the code
A logical page is a named list of cells. A physical frame holds its values. Pages may share a frame. `refs` counts pages using each frame. The page-to-frame map is `frameOf` in C, C++ and Java; `frame_of` in Python. Copy-on-write gives a sharing page its own full copy when written.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the page count; `width`, the cells per page; and `q`, the operation count.
2. Read `n * width` initial values in page order, then offset order.
3. Read `q` operations: `1 x y`, `2 x y value`, or `3 x y`. Page indices and cell offsets start at 0.

Output
Print one cell value per operation `3`, in operation order.

Example explained
For input `2 1 4 5 9 1 1 0 2 1 0 7 3 0 0 3 1 0`, page 1 first shares page 0, then receives its own write. The output is `5 7`.

Limits
`1 <= n, width <= 8`. `1 <= q <= 60`, with at least one read. Page indices are from 0 through `n - 1`; offsets are from 0 through `width - 1`. Values are from -1000 through 1000. At most `n + q` frames are needed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1 4
5 9
1 1 0
2 1 0 7
3 0 0
3 1 0
```

Expected output:

```text
5 7
```

Sample 2 input:

```text
1 2 2
2 3
2 0 1 8
3 0 1
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. Can a frame with exactly two owners be changed safely for only one of them?
2. `refs` includes the page being written as well as every other owner.
3. Copy whenever `refs[frame] > 1`. Move the writing page's ownership to the full copy before updating its cell.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, width, q;
    scanf("%d", &n);
    scanf("%d", &width);
    scanf("%d", &q);
    int frameOf[8] = {0};
    int refs[68] = {0};
    int data[544] = {0};
    for (int page = 0; page < n; page++) {
        frameOf[page] = page;
        refs[page] = 1;
        for (int j = 0; j < width; j++) {
            scanf("%d", &data[page * width + j]);
        }
    }
    int nextFrame = n;
    for (int i = 0; i < q; i++) {
        int op, x, y;
        scanf("%d", &op);
        scanf("%d", &x);
        scanf("%d", &y);
        if (op == 1) {
            int source = frameOf[y];
            refs[source]++;
            refs[frameOf[x]]--;
            frameOf[x] = source;
        } else if (op == 2) {
            int value;
            scanf("%d", &value);
            int frame = frameOf[x];
            if (refs[frame] > 2) {
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
            printf("%d ", (data[frameOf[x] * width + y]));
        }
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, width, q;
    cin >> n;
    cin >> width;
    cin >> q;
    int frameOf[8] = {0};
    int refs[68] = {0};
    int data[544] = {0};
    for (int page = 0; page < n; page++) {
        frameOf[page] = page;
        refs[page] = 1;
        for (int j = 0; j < width; j++) {
            cin >> data[page * width + j];
        }
    }
    int nextFrame = n;
    for (int i = 0; i < q; i++) {
        int op, x, y;
        cin >> op;
        cin >> x;
        cin >> y;
        if (op == 1) {
            int source = frameOf[y];
            refs[source]++;
            refs[frameOf[x]]--;
            frameOf[x] = source;
        } else if (op == 2) {
            int value;
            cin >> value;
            int frame = frameOf[x];
            if (refs[frame] > 2) {
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
            cout << (data[frameOf[x] * width + y]) << ' ';
        }
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, width, q;
        n = scanner.nextInt();
        width = scanner.nextInt();
        q = scanner.nextInt();
        int[] frameOf = new int[8];
        int[] refs = new int[68];
        int[] data = new int[544];
        for (int page = 0; page < n; page++) {
            frameOf[page] = page;
            refs[page] = 1;
            for (int j = 0; j < width; j++) {
                data[page * width + j] = scanner.nextInt();
            }
        }
        int nextFrame = n;
        for (int i = 0; i < q; i++) {
            int op, x, y;
            op = scanner.nextInt();
            x = scanner.nextInt();
            y = scanner.nextInt();
            if (op == 1) {
                int source = frameOf[y];
                refs[source]++;
                refs[frameOf[x]]--;
                frameOf[x] = source;
            } else if (op == 2) {
                int value;
                value = scanner.nextInt();
                int frame = frameOf[x];
                if (refs[frame] > 2) {
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
                System.out.print((data[frameOf[x] * width + y]) + " ");
            }
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
        if refs[frame] > 2:
            for j in range(width):
                data[next_frame * width + j] = data[frame * width + j]
            refs[frame] -= 1
            frame_of[x] = next_frame
            refs[next_frame] = 1
            next_frame += 1
        data[frame_of[x] * width + y] = value
    else:
        print(data[frame_of[x] * width + y])
```

---

## 39. Reservation Window Baseline

SYSTEMS · Difficulty 60 · Bounty 600

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs peak resource use inside each inspection window.

What the code should do
A reservation uses `units` at each integer time from `start`, included, to `end`, excluded. For each window `[left, right)`, which includes `left` and excludes `right`, print the greatest total reserved units at an integer time inside it. Overlapping reservations add together. A reservation may start before the query and still be active inside it. Keep the supplied difference array, which records changes in load at each time.

What's going wrong
A query can miss reservations that started before its window.

How to read the code
A half-open interval includes its start and excludes its end. `delta` is a difference array: it records changes in reserved units at each time. `load` is the active total, and `peak` the largest total found in a query.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `horizon`, the final time boundary; `n`, the reservation count; and `q`, the query count.
2. Read `n` triples `start end units`.
3. Read `q` pairs `left right` describing query windows.

Output
Print one peak load per query, in query order. A window with no active reservations has peak `0`.

Example explained
For input `10 1 1 1 8 5 3 5`, the 5-unit reservation is active throughout the query. The output is `5`.

Limits
`1 <= horizon <= 128`. `0 <= n <= 60`. `1 <= q <= 60`. `0 <= start < end <= horizon`. `1 <= units <= 100`. `0 <= left < right <= horizon`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
10 1 1
1 8 5
3 5
```

Expected output:

```text
5
```

Sample 2 input:

```text
4 2 1
0 2 3
1 4 2
0 4
```

Expected output:

```text
5
```

### Progressive hints (private until purchased)

1. Try a window wholly inside a reservation that began earlier.
2. A value in `delta` is a change at that time, not the full active amount.
3. Add `delta[time]` from time 0 onward, including times before `left`. Use `left` only to decide when to compare `load` with `peak`, and stop before `right`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int horizon, n, q;
    scanf("%d", &horizon);
    scanf("%d", &n);
    scanf("%d", &q);
    int delta[129] = {0};
    for (int i = 0; i < n; i++) {
        int start, end, units;
        scanf("%d", &start);
        scanf("%d", &end);
        scanf("%d", &units);
        delta[start] += units;
        delta[end] -= units;
    }
    for (int i = 0; i < q; i++) {
        int left, right;
        scanf("%d", &left);
        scanf("%d", &right);
        int load = 0;
        int peak = 0;
        for (int time = 0; time < right; time++) {
            if (time >= left) {
                load += delta[time];
            }
            if (time >= left && load > peak) {
                peak = load;
            }
        }
        printf("%d ", (peak));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int horizon, n, q;
    cin >> horizon;
    cin >> n;
    cin >> q;
    int delta[129] = {0};
    for (int i = 0; i < n; i++) {
        int start, end, units;
        cin >> start;
        cin >> end;
        cin >> units;
        delta[start] += units;
        delta[end] -= units;
    }
    for (int i = 0; i < q; i++) {
        int left, right;
        cin >> left;
        cin >> right;
        int load = 0;
        int peak = 0;
        for (int time = 0; time < right; time++) {
            if (time >= left) {
                load += delta[time];
            }
            if (time >= left && load > peak) {
                peak = load;
            }
        }
        cout << (peak) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int horizon, n, q;
        horizon = scanner.nextInt();
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] delta = new int[129];
        for (int i = 0; i < n; i++) {
            int start, end, units;
            start = scanner.nextInt();
            end = scanner.nextInt();
            units = scanner.nextInt();
            delta[start] += units;
            delta[end] -= units;
        }
        for (int i = 0; i < q; i++) {
            int left, right;
            left = scanner.nextInt();
            right = scanner.nextInt();
            int load = 0;
            int peak = 0;
            for (int time = 0; time < right; time++) {
                if (time >= left) {
                    load += delta[time];
                }
                if (time >= left && load > peak) {
                    peak = load;
                }
            }
            System.out.print((peak) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

horizon = read_int()
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
        if time >= left:
            load += delta[time]
        if time >= left and load > peak:
            peak = load
    print(peak)
```

---

## 40. Length-Tagged Dispatch

SYSTEMS · Difficulty 62 · Bounty 620

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan needs to read selected records from a byte stream.

What the code should do
Parse all records in order. Each record has one type byte, one length byte, then exactly that many data bytes, called its payload. The length excludes both header bytes. Count every record of type `7` and sum its payload bytes. Skip all other types, including unfamiliar ones, using the same record format. A type-7 record with length 0 still counts.

What's going wrong
The parser can mistake a payload byte for the next record's type.

How to read the code
A byte here is an integer from 0 through 255. A record has a type, a length, and data bytes called its payload. `pos` is the record's start. The byte list is `bytes` in C, C++ and Java; `data` in Python. The type variable is `type` in C, C++ and Java; `record_type` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of byte values.
2. Read those `n` decimal bytes. They form zero or more complete records.

Output
Print the number of type-7 records, then the sum of their payload bytes.

Example explained
For input `7 7 2 10 20 9 1 8`, type 7 contributes 10 and 20; type 9 is skipped. The output is `1 30`.

Limits
`0 <= n <= 256`. Every byte is from 0 through 255. Every record has both header bytes and all declared payload bytes within the input. Payload length may be `0`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
7
7 2 10 20 9 1 8
```

Expected output:

```text
1 30
```

Sample 2 input:

```text
2
7 0
```

Expected output:

```text
1 0
```

### Progressive hints (private until purchased)

1. How many bytes does a record occupy when its payload length is 0?
2. The length counts payload bytes only. The type and length bytes take space too.
3. Advance `pos` by `length + 2` after each record. Keep the existing bounds checks.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int bytes[256] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &bytes[i]);
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
        pos += length + 1;
    }
    printf("%d ", (count));
    printf("%d ", (total));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int bytes[256] = {0};
    for (int i = 0; i < n; i++) {
        cin >> bytes[i];
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
        pos += length + 1;
    }
    cout << (count) << ' ';
    cout << (total) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] bytes = new int[256];
        for (int i = 0; i < n; i++) {
            bytes[i] = scanner.nextInt();
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
            pos += length + 1;
        }
        System.out.print((count) + " ");
        System.out.print((total) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
    pos += length + 1
print(count, total)
```

---

## 41. Reassembly Must Remember

SYSTEMS · Difficulty 64 · Bounty 640

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan needs to check every piece received, including late arrivals.

What the code should do
A message has `n` byte positions, indexed from 0. Each fragment supplies consecutive bytes starting at its offset. Overlaps are allowed if the bytes agree. Inspect all `q` fragments. If any two received values differ at one position, print `CORRUPT`, even if other positions are missing or the message was complete earlier. Otherwise print `INCOMPLETE` if any position is missing. If complete and consistent, print the sum of its `n` bytes, counting each position once.

What's going wrong
The program can accept a conflicting fragment after every position has arrived.

How to read the code
A byte is a value from 0 through 255. A fragment supplies bytes for part of a message. `seen` records received positions, `data` their stored bytes, and `filled` the number of distinct positions received. `corrupt` records whether conflicting bytes appeared.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the message length, and `q`, the fragment count.
2. For each fragment, read `offset`, its starting position; `length`, its byte count; then `length` decimal byte values.

Output
Print exactly one result: `CORRUPT`, `INCOMPLETE`, or the complete message's byte sum. A conflict takes priority over missing bytes.

Example explained
For input `2 2 0 2 4 5 1 1 9`, position 1 receives both 5 and 9. The output is `CORRUPT`.

Limits
`1 <= n <= 128`. `0 <= q <= 60`. `1 <= length <= n`. `0 <= offset` and `offset + length <= n`. Bytes are from 0 through 255.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2
0 2 4 5
1 1 9
```

Expected output:

```text
CORRUPT
```

Sample 2 input:

```text
3 2
1 2 5 6
0 1 4
```

Expected output:

```text
15
```

### Progressive hints (private until purchased)

1. Does receiving every position mean later fragments can be ignored?
2. The number in `filled` and the agreement of repeated bytes are separate checks.
3. Check every already-seen position for a mismatch, regardless of `filled`. Once set, keep `corrupt` set until the final result.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int seen[128] = {0};
    int data[128] = {0};
    int filled = 0;
    int corrupt = 0;
    for (int i = 0; i < q; i++) {
        int offset, length;
        scanf("%d", &offset);
        scanf("%d", &length);
        for (int j = 0; j < length; j++) {
            int value;
            scanf("%d", &value);
            int index = offset + j;
            if (seen[index] == 1 && data[index] != value && filled < n) {
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
        printf("CORRUPT");
    } else if (filled != n) {
        printf("INCOMPLETE");
    } else {
        int total = 0;
        for (int i = 0; i < n; i++) {
            total += data[i];
        }
        printf("%d ", (total));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int seen[128] = {0};
    int data[128] = {0};
    int filled = 0;
    int corrupt = 0;
    for (int i = 0; i < q; i++) {
        int offset, length;
        cin >> offset;
        cin >> length;
        for (int j = 0; j < length; j++) {
            int value;
            cin >> value;
            int index = offset + j;
            if (seen[index] == 1 && data[index] != value && filled < n) {
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
        cout << "CORRUPT";
    } else if (filled != n) {
        cout << "INCOMPLETE";
    } else {
        int total = 0;
        for (int i = 0; i < n; i++) {
            total += data[i];
        }
        cout << (total) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] seen = new int[128];
        int[] data = new int[128];
        int filled = 0;
        int corrupt = 0;
        for (int i = 0; i < q; i++) {
            int offset, length;
            offset = scanner.nextInt();
            length = scanner.nextInt();
            for (int j = 0; j < length; j++) {
                int value;
                value = scanner.nextInt();
                int index = offset + j;
                if (seen[index] == 1 && data[index] != value && filled < n) {
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
            System.out.print("CORRUPT");
        } else if (filled != n) {
            System.out.print("INCOMPLETE");
        } else {
            int total = 0;
            for (int i = 0; i < n; i++) {
                total += data[i];
            }
            System.out.print((total) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
        if seen[index] == 1 and data[index] != value and filled < n:
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
    print(sum(data))
```

---

## 42. Clock Hand Privilege

SYSTEMS · Difficulty 65 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to give recently loaded data a second chance before replacement.

What the code should do
Start with an empty cache, which stores pages for reuse, and `hand` at slot 0. Each stored page has a reference flag, either 0 or 1. A hit sets that flag to 1 and leaves the hand unchanged. On a miss, examine the hand's slot. While it is occupied with flag 1, clear the flag and move to the next slot, wrapping to 0 at the end. At the first empty slot or occupied slot with flag 0, install the requested page with flag 1. Then move the hand forward once. Print misses and the final state.

What's going wrong
A newly loaded page can be removed without its promised second chance.

How to read the code
A cache stores numbered data blocks called pages. A hit finds a stored page; a miss needs a load. The clock policy visits slots in a circle. `hand` is the current slot and `bit` stores reference flags, 0 or 1. The page array is `pageAt` in C, C++ and Java; `page_at` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `capacity`, the slot count, and `n`, the request count.
2. Read the `n` positive page IDs.

Output
Print the miss count, then `hand`, then page IDs in slots 0 through `capacity - 1`. Use `0` for an empty slot.

Example explained
For input `2 3 1 2 3`, slots end as 3, 2 and the hand is at index 1. The output is `3 1 3 2`.

Limits
`1 <= capacity <= 8`. `0 <= n <= 100`. Page IDs are from 1 through 100. A miss clears at most `capacity` set flags before installing its page.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 3
1 2 3
```

Expected output:

```text
3 1 3 2
```

Sample 2 input:

```text
2 3
1 2 1
```

Expected output:

```text
2 0 1 2
```

### Progressive hints (private until purchased)

1. Loading a missing page is still an access to that page.
2. Check the reference flag of a just-loaded page that has not yet had a hit.
3. Set `bit[hand]` to `1` on installation. Keep the clearing loop and existing hand movement.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, n;
    scanf("%d", &capacity);
    scanf("%d", &n);
    int pageAt[8] = {0};
    int bit[8] = {0};
    int hand = 0;
    int misses = 0;
    for (int i = 0; i < n; i++) {
        int page;
        scanf("%d", &page);
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
            bit[hand] = 0;
            hand = (hand + 1) % capacity;
        }
    }
    printf("%d ", (misses));
    printf("%d ", (hand));
    for (int j = 0; j < capacity; j++) {
        printf("%d ", (pageAt[j]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int capacity, n;
    cin >> capacity;
    cin >> n;
    int pageAt[8] = {0};
    int bit[8] = {0};
    int hand = 0;
    int misses = 0;
    for (int i = 0; i < n; i++) {
        int page;
        cin >> page;
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
            bit[hand] = 0;
            hand = (hand + 1) % capacity;
        }
    }
    cout << (misses) << ' ';
    cout << (hand) << ' ';
    for (int j = 0; j < capacity; j++) {
        cout << (pageAt[j]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int capacity, n;
        capacity = scanner.nextInt();
        n = scanner.nextInt();
        int[] pageAt = new int[8];
        int[] bit = new int[8];
        int hand = 0;
        int misses = 0;
        for (int i = 0; i < n; i++) {
            int page;
            page = scanner.nextInt();
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
                bit[hand] = 0;
                hand = (hand + 1) % capacity;
            }
        }
        System.out.print((misses) + " ");
        System.out.print((hand) + " ");
        for (int j = 0; j < capacity; j++) {
            System.out.print((pageAt[j]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

capacity = read_int()
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
        bit[hand] = 0
        hand = (hand + 1) % capacity
print(misses, hand)
print(*page_at)
```

---

## 43. Compactor's Interior Address

SYSTEMS · Difficulty 70 · Bounty 700

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs addresses to keep identifying the same bytes after memory moves.

What the code should do
Process blocks in increasing old-start order. `live = 1` marks a live block and `live = 0` a dead block. Skip dead blocks. For each live block, advance a cursor starting at 0 to the first address divisible by its alignment, place the block there, then advance by its length. This is compaction. For each query, translate the old byte address to the same byte in the moved live block. Preserve its distance from the block's first byte. Print `-1` for a gap or dead block. A block includes its first byte and excludes the address just after its last byte.

What's going wrong
An address inside a moved block can be translated to the block's first byte.

How to read the code
Compaction packs live blocks while skipping dead blocks. A base is a block's first byte address; an offset is a byte's distance from its base. An aligned base is divisible by `alignment`. Old and new bases are `oldStart` and `newStart` in C, C++ and Java; `old_start` and `new_start` in Python. `cursor` tracks placement.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the block count, and `q`, the query count.
2. For each block, read its old base (`oldStart` in C, C++ and Java; `old_start` in Python), `length` in bytes, `alignment` as the required base divisor, and `live` as the live/dead flag.
3. Read `q` old byte addresses.

Output
Print one relocated address, or `-1`, per query in query order.

Example explained
For input `1 2 8 4 4 1 10 12`, the block moves from bytes 8 through 11 to bytes 0 through 3. Old address 10 becomes 2; 12 is outside. The output is `2 -1`.

Limits
`1 <= n <= 32`. `1 <= q <= 100`. Old bases are nonnegative and increasing. Blocks do not overlap. `1 <= length <= 32`; old base plus length is at most 1024. `1 <= alignment <= 16`, and each old base is divisible by it. `live` is `0` or `1`. Query addresses are from 0 through 1024. All arithmetic fits `int`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 2
8 4 4 1
10 12
```

Expected output:

```text
2 -1
```

Sample 2 input:

```text
1 1
8 4 4 1
8
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. An address may identify a byte other than the block's first byte.
2. Find the queried byte's offset from its block's old base.
3. Add that offset to the new base: `newStart[i] + address - oldStart[i]` in C, C++ and Java; `new_start[i] + address - old_start[i]` in Python. Keep rejecting gaps and dead blocks.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int oldStart[32] = {0};
    int length[32] = {0};
    int live[32] = {0};
    int newStart[32] = {0};
    int cursor = 0;
    for (int i = 0; i < n; i++) {
        int alignment;
        scanf("%d", &oldStart[i]);
        scanf("%d", &length[i]);
        scanf("%d", &alignment);
        scanf("%d", &live[i]);
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
        scanf("%d", &address);
        int answer = -1;
        for (int i = 0; i < n; i++) {
            if (live[i] == 1 && oldStart[i] <= address && address < oldStart[i] + length[i]) {
                answer = newStart[i];
            }
        }
        printf("%d ", (answer));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int oldStart[32] = {0};
    int length[32] = {0};
    int live[32] = {0};
    int newStart[32] = {0};
    int cursor = 0;
    for (int i = 0; i < n; i++) {
        int alignment;
        cin >> oldStart[i];
        cin >> length[i];
        cin >> alignment;
        cin >> live[i];
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
        cin >> address;
        int answer = -1;
        for (int i = 0; i < n; i++) {
            if (live[i] == 1 && oldStart[i] <= address && address < oldStart[i] + length[i]) {
                answer = newStart[i];
            }
        }
        cout << (answer) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] oldStart = new int[32];
        int[] length = new int[32];
        int[] live = new int[32];
        int[] newStart = new int[32];
        int cursor = 0;
        for (int i = 0; i < n; i++) {
            int alignment;
            oldStart[i] = scanner.nextInt();
            length[i] = scanner.nextInt();
            alignment = scanner.nextInt();
            live[i] = scanner.nextInt();
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
            address = scanner.nextInt();
            int answer = -1;
            for (int i = 0; i < n; i++) {
                if (live[i] == 1 && oldStart[i] <= address && address < oldStart[i] + length[i]) {
                    answer = newStart[i];
                }
            }
            System.out.print((answer) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
            answer = new_start[i]
    print(answer)
```

---

## 44. The Last Strong Owner

SYSTEMS · Difficulty 74 · Bounty 740

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to release objects only when no owner still keeps them alive.

What the code should do
All `n` objects start alive. Each directed edge is one strong reference: its source owns its target while the source is alive. Duplicate edges count separately; self-edges and cycles are allowed. Objects also have the listed external owners. Process external releases in order. After each release, repeatedly destroy an alive object with no owners of either kind, removing all its outgoing ownerships, until none qualify. If several qualify, choose the lowest object ID first. Cycles whose members keep one another owned survive even without external owners.

What's going wrong
Removing the last external owner can destroy an object still owned by another live object.

How to read the code
Objects and owning links form a directed graph: each edge goes from an owner to a child it keeps alive. A strong reference is one ownership. A cycle follows edges back to its starting object. `roots` counts external owners, `refs` counts all owners, and `alive` records surviving objects.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the object count; `m`, the edge count; and `q`, the release count.
2. Read `n` external-owner counts in object order.
3. Read `m` pairs: owner object ID, then child object ID.
4. Read `q` object IDs, each releasing one external owner. IDs start at 0.

Output
Print `n` flags in object ID order: `1` for alive and `0` for destroyed.

Example explained
For input `2 1 1 1 1 0 1 1`, object 0 still owns object 1 after object 1 loses its external owner. The output is `1 1`.

Limits
`1 <= n <= 32`. `0 <= m, q <= 100`. IDs are from 0 through `n - 1`. Initial external counts are from 0 through 100. Every object starts with a positive total owner count. Each release names an alive object with at least one external owner remaining.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1 1
1 1
0 1
1
```

Expected output:

```text
1 1
```

Sample 2 input:

```text
2 1 1
1 0
0 1
0
```

Expected output:

```text
0 0
```

### Progressive hints (private until purchased)

1. Does having no external owners mean having no owners at all?
2. Compare `roots` with `refs` for an object owned by another live object.
3. Destroy only an alive object with `refs[j] == 0`. Removing its outgoing references can then make other objects eligible.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, q;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &q);
    int roots[32] = {0};
    int refs[32] = {0};
    int alive[32] = {0};
    int from[100] = {0};
    int to[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &roots[i]);
        refs[i] = roots[i];
        alive[i] = 1;
    }
    for (int i = 0; i < m; i++) {
        scanf("%d", &from[i]);
        scanf("%d", &to[i]);
        refs[to[i]]++;
    }
    for (int i = 0; i < q; i++) {
        int node;
        scanf("%d", &node);
        roots[node]--;
        refs[node]--;
        while (1 == 1) {
            int dead = -1;
            for (int j = 0; j < n; j++) {
                if (alive[j] == 1 && roots[j] == 0) {
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
        printf("%d ", (alive[i]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, q;
    cin >> n;
    cin >> m;
    cin >> q;
    int roots[32] = {0};
    int refs[32] = {0};
    int alive[32] = {0};
    int from[100] = {0};
    int to[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> roots[i];
        refs[i] = roots[i];
        alive[i] = 1;
    }
    for (int i = 0; i < m; i++) {
        cin >> from[i];
        cin >> to[i];
        refs[to[i]]++;
    }
    for (int i = 0; i < q; i++) {
        int node;
        cin >> node;
        roots[node]--;
        refs[node]--;
        while (1 == 1) {
            int dead = -1;
            for (int j = 0; j < n; j++) {
                if (alive[j] == 1 && roots[j] == 0) {
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
        cout << (alive[i]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, q;
        n = scanner.nextInt();
        m = scanner.nextInt();
        q = scanner.nextInt();
        int[] roots = new int[32];
        int[] refs = new int[32];
        int[] alive = new int[32];
        int[] from = new int[100];
        int[] to = new int[100];
        for (int i = 0; i < n; i++) {
            roots[i] = scanner.nextInt();
            refs[i] = roots[i];
            alive[i] = 1;
        }
        for (int i = 0; i < m; i++) {
            from[i] = scanner.nextInt();
            to[i] = scanner.nextInt();
            refs[to[i]]++;
        }
        for (int i = 0; i < q; i++) {
            int node;
            node = scanner.nextInt();
            roots[node]--;
            refs[node]--;
            while (1 == 1) {
                int dead = -1;
                for (int j = 0; j < n; j++) {
                    if (alive[j] == 1 && roots[j] == 0) {
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
            System.out.print((alive[i]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
            if alive[j] == 1 and roots[j] == 0:
                dead = j
                break
        if dead == -1:
            break
        alive[dead] = 0
        for owner, child in edges:
            if owner == dead:
                refs[child] -= 1
for flag in alive:
    print(flag)
```

---

## 45. Idle Credit in the Router

SYSTEMS · Difficulty 78 · Bounty 780

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan needs to schedule packets without saving credit during idle periods.

What the code should do
A flow is a queue of packets. Start with empty queues and zero credit. In each round, first append all listed arrivals to their flows. Then visit flows in index order. A nonempty flow gains its fixed quantum, or credit allowance. Send its oldest packet while its length is at most the available credit, subtracting that length each time. Do not skip an unaffordable oldest packet. Keep leftover credit while packets remain, but set it to zero if the queue is empty after the visit. Empty flows gain no credit. Stop after the listed rounds.

What's going wrong
A flow that became empty can reuse old credit and send a later packet too early.

How to read the code
A flow is one packet queue. A packet's length is its sending cost. `quantum` is the credit a nonempty flow gains per round; `deficit` is its unused credit. `head` and `tail` bound waiting packets, and `sent` counts packets sent.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `flows`, the flow count, and `rounds`, the round count.
2. Read one `quantum` per flow in index order.
3. For each round, and each flow in index order, read `k`, its arrival count, then its `k` packet lengths. Flow indices start at 0.

Output
For each flow in index order, print its sent-packet count, remaining credit, and waiting-packet count.

Example explained
For input `1 3 5 1 3 0 1 7`, the length-3 packet sends, its leftover credit is lost, and the later length-7 packet waits with credit 5. The output is `1 5 1`.

Limits
`1 <= flows <= 4`. `1 <= rounds <= 30`. Each quantum is from 1 through 20. `0 <= k <= 4`. Packet lengths are from 1 through 20. Each flow receives at most 120 packets.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 3
5
1 3
0
1 7
```

Expected output:

```text
1 5 1
```

Sample 2 input:

```text
1 2
3
1 5
0
```

Expected output:

```text
1 0 0
```

### Progressive hints (private until purchased)

1. Track credit between a queue becoming empty and its next arrival.
2. Which flows may carry credit into the next round?
3. After each visit, if `head[flow] == tail[flow]`, set `deficit[flow]` to `0`. Keep credit only while a packet remains waiting.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int flows, rounds;
    scanf("%d", &flows);
    scanf("%d", &rounds);
    int quantum[4] = {0};
    int head[4] = {0};
    int tail[4] = {0};
    int deficit[4] = {0};
    int sent[4] = {0};
    int packet[480] = {0};
    for (int flow = 0; flow < flows; flow++) {
        scanf("%d", &quantum[flow]);
    }
    for (int round = 0; round < rounds; round++) {
        for (int flow = 0; flow < flows; flow++) {
            int k;
            scanf("%d", &k);
            for (int j = 0; j < k; j++) {
                scanf("%d", &packet[flow * 120 + tail[flow]]);
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
                deficit[flow] = deficit[flow];
            }
        }
    }
    for (int flow = 0; flow < flows; flow++) {
        printf("%d ", (sent[flow]));
        printf("%d ", (deficit[flow]));
        printf("%d ", (tail[flow] - head[flow]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int flows, rounds;
    cin >> flows;
    cin >> rounds;
    int quantum[4] = {0};
    int head[4] = {0};
    int tail[4] = {0};
    int deficit[4] = {0};
    int sent[4] = {0};
    int packet[480] = {0};
    for (int flow = 0; flow < flows; flow++) {
        cin >> quantum[flow];
    }
    for (int round = 0; round < rounds; round++) {
        for (int flow = 0; flow < flows; flow++) {
            int k;
            cin >> k;
            for (int j = 0; j < k; j++) {
                cin >> packet[flow * 120 + tail[flow]];
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
                deficit[flow] = deficit[flow];
            }
        }
    }
    for (int flow = 0; flow < flows; flow++) {
        cout << (sent[flow]) << ' ';
        cout << (deficit[flow]) << ' ';
        cout << (tail[flow] - head[flow]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int flows, rounds;
        flows = scanner.nextInt();
        rounds = scanner.nextInt();
        int[] quantum = new int[4];
        int[] head = new int[4];
        int[] tail = new int[4];
        int[] deficit = new int[4];
        int[] sent = new int[4];
        int[] packet = new int[480];
        for (int flow = 0; flow < flows; flow++) {
            quantum[flow] = scanner.nextInt();
        }
        for (int round = 0; round < rounds; round++) {
            for (int flow = 0; flow < flows; flow++) {
                int k;
                k = scanner.nextInt();
                for (int j = 0; j < k; j++) {
                    packet[flow * 120 + tail[flow]] = scanner.nextInt();
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
                    deficit[flow] = deficit[flow];
                }
            }
        }
        for (int flow = 0; flow < flows; flow++) {
            System.out.print((sent[flow]) + " ");
            System.out.print((deficit[flow]) + " ");
            System.out.print((tail[flow] - head[flow]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

flows = read_int()
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
            deficit[flow] = deficit[flow]
for flow in range(flows):
    print(sent[flow], deficit[flow], tail[flow] - head[flow])
```

---

## 46. Committed Child, Aborted Parent

SYSTEMS · Difficulty 82 · Bounty 820

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs an outer repair to remain cancellable after an inner repair commits.

What the code should do
Start with the initial memory values. A transaction groups writes that can be kept by committing or cancelled by rolling back. `1` opens a transaction inside any current one. `2 cell value` writes a cell, saving its previous value only while a transaction is open. `3` commits and closes the innermost transaction, keeping its writes. Those writes still belong to an open parent and must be cancelled if that parent rolls back. `4` cancels and closes the innermost transaction by undoing its writes in reverse order, including writes from committed children. `5 cell` reads and prints a cell. Transactions are properly nested and all close by the end.

What's going wrong
An outer rollback can fail to undo writes from a committed inner transaction.

How to read the code
A transaction groups writes that can be kept by committing or cancelled by rolling back. A nested transaction runs inside another open one. A before-image is a cell's value just before a write. `marks` stores log boundaries, `depth` counts open transactions, and `count` is the undo-log length.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the cell count, and `q`, the operation count.
2. Read the `n` initial values of `memory`.
3. Read `q` operations: `1`, `2 cell value`, `3`, `4`, or `5 cell`. Cell indices start at 0.

Output
Print one cell value per operation `5`, in operation order.

Example explained
For input `1 7 5 1 1 2 0 9 3 4 5 0 5 0`, the child commits its write, then the parent rolls back. Both reads see 5. The output is `5 5`.

Limits
`1 <= n <= 16`. `1 <= q <= 100`, with at least one read. Nesting depth is at most 16. Each commit or rollback has an open transaction. `0 <= cell < n`. Values are from -1000 through 1000.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 7
5
1
1
2 0 9
3
4
5 0
5 0
```

Expected output:

```text
5 5
```

Sample 2 input:

```text
1 4
5
1
2 0 9
3
5 0
```

Expected output:

```text
9
```

### Progressive hints (private until purchased)

1. Does committing a child also commit its still-open parent?
2. After a commit, can a remaining parent still need the child's before-images?
3. Clear the undo log only when `depth == 0` after closing a committed transaction. A child commit reduces `depth` but keeps the log entries.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int memory[16] = {0};
    int marks[16] = {0};
    int cellAt[100] = {0};
    int before[100] = {0};
    int depth = 0;
    int count = 0;
    for (int i = 0; i < n; i++) {
        scanf("%d", &memory[i]);
    }
    for (int i = 0; i < q; i++) {
        int op;
        scanf("%d", &op);
        if (op == 1) {
            marks[depth] = count;
            depth++;
        } else if (op == 2) {
            int cell, value;
            scanf("%d", &cell);
            scanf("%d", &value);
            if (depth > 0) {
                cellAt[count] = cell;
                before[count] = memory[cell];
                count++;
            }
            memory[cell] = value;
        } else if (op == 3) {
            depth--;
            if (depth >= 0) {
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
            scanf("%d", &cell);
            printf("%d ", (memory[cell]));
        }
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int memory[16] = {0};
    int marks[16] = {0};
    int cellAt[100] = {0};
    int before[100] = {0};
    int depth = 0;
    int count = 0;
    for (int i = 0; i < n; i++) {
        cin >> memory[i];
    }
    for (int i = 0; i < q; i++) {
        int op;
        cin >> op;
        if (op == 1) {
            marks[depth] = count;
            depth++;
        } else if (op == 2) {
            int cell, value;
            cin >> cell;
            cin >> value;
            if (depth > 0) {
                cellAt[count] = cell;
                before[count] = memory[cell];
                count++;
            }
            memory[cell] = value;
        } else if (op == 3) {
            depth--;
            if (depth >= 0) {
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
            cin >> cell;
            cout << (memory[cell]) << ' ';
        }
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] memory = new int[16];
        int[] marks = new int[16];
        int[] cellAt = new int[100];
        int[] before = new int[100];
        int depth = 0;
        int count = 0;
        for (int i = 0; i < n; i++) {
            memory[i] = scanner.nextInt();
        }
        for (int i = 0; i < q; i++) {
            int op;
            op = scanner.nextInt();
            if (op == 1) {
                marks[depth] = count;
                depth++;
            } else if (op == 2) {
                int cell, value;
                cell = scanner.nextInt();
                value = scanner.nextInt();
                if (depth > 0) {
                    cellAt[count] = cell;
                    before[count] = memory[cell];
                    count++;
                }
                memory[cell] = value;
            } else if (op == 3) {
                depth--;
                if (depth >= 0) {
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
                cell = scanner.nextInt();
                System.out.print((memory[cell]) + " ");
            }
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
        if depth >= 0:
            count = 0
    elif op == 4:
        depth -= 1
        while count > marks[depth]:
            count -= 1
            memory[cell_at[count]] = before[count]
    else:
        cell = read_int()
        print(memory[cell])
```

---

## 47. Buddy, Not Just Neighbor

SYSTEMS · Difficulty 85 · Bounty 850

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to combine free memory blocks before larger allocations.

What the code should do
The arena's size in bytes is 2 raised to the power of its largest order. Addresses start at 0. Order `k` means a block size of 2 raised to power `k`. Initially the whole arena is free. An allocation gives `1`, an allocation ID, and the requested order. Choose the smallest available order at least as large as requested, then the lowest base at that order. Split repeatedly, keeping the lower half and leaving the upper half free, until the requested size is reached. Print its base, or `-1` if unavailable or that ID already has a live allocation. Failure changes nothing. A release gives `2`, an allocation ID, and `0`. Release only a live allocation, then repeatedly merge with its free same-order buddy. Buddies are the two halves of one parent whose base is divisible by twice their size. Releasing a nonlive ID does nothing.

What's going wrong
A release can miss a valid merge or merge neighbors with different parent blocks.

How to read the code
The arena is the whole memory range. A block's base is its first byte address. Order `k` means a size of 2 raised to power `k` bytes. An aligned base is divisible by the block size. Buddies are the two equal halves of one parent whose base is divisible by twice their size. The free-block table is `freeAt` in C, C++ and Java; `free_at` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read the largest order, named `maxOrder` in C, C++ and Java; `max_order` in Python. Then read `q`, the operation count.
2. Read `q` triples: `op`, the allocation ID (`id` in C, C++ and Java; `identifier` in Python), and `requested`, the requested order. The third field is `0` for release.

Output
Print a base or `-1` for each allocation, in order. Then print the largest free block size after all operations, or `0` if none is free.

Example explained
For input `2 4 1 0 0 1 1 0 2 0 0 2 1 0`, allocations return bases 0 and 1. Both releases reunite the four-byte arena. The output is `0 1 4`.

Limits
The largest order is from 0 through 6. `0 <= q <= 100`. IDs are from 0 through 31. Requested allocation orders are from 0 through the largest order. `op` is `1` or `2`. This simulates integer addresses without accessing real memory.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 4
1 0 0
1 1 0
2 0 0
2 1 0
```

Expected output:

```text
0 1 4
```

Sample 2 input:

```text
2 2
1 0 1
2 0 0
```

Expected output:

```text
0 4
```

### Progressive hints (private until purchased)

1. For one-byte blocks, compare the buddy of base 0 with the buddy of base 1.
2. Adjacent blocks can belong to different parents. Check whether a block is the lower or upper half of its parent.
3. Let `size` be the block size. Divide `base` by `size` using whole-number division. For an even quotient, the buddy is `base + size`; for an odd quotient, it is `base - size`. Merge only if that exact same-order block is free.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int maxOrder, q;
    scanf("%d", &maxOrder);
    scanf("%d", &q);
    int arena = 1 << maxOrder;
    int freeAt[448] = {0};
    int baseOf[32] = {0};
    int orderOf[32] = {0};
    int live[32] = {0};
    freeAt[maxOrder] = 1;
    for (int event = 0; event < q; event++) {
        int op, id, requested;
        scanf("%d", &op);
        scanf("%d", &id);
        scanf("%d", &requested);
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
            printf("%d ", (base));
        } else if (live[id] == 1) {
            int base = baseOf[id];
            int order = orderOf[id];
            live[id] = 0;
            while (order < maxOrder) {
                int size = 1 << order;
                int buddy = base + size;
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
    printf("%d ", (largest));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int maxOrder, q;
    cin >> maxOrder;
    cin >> q;
    int arena = 1 << maxOrder;
    int freeAt[448] = {0};
    int baseOf[32] = {0};
    int orderOf[32] = {0};
    int live[32] = {0};
    freeAt[maxOrder] = 1;
    for (int event = 0; event < q; event++) {
        int op, id, requested;
        cin >> op;
        cin >> id;
        cin >> requested;
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
            cout << (base) << ' ';
        } else if (live[id] == 1) {
            int base = baseOf[id];
            int order = orderOf[id];
            live[id] = 0;
            while (order < maxOrder) {
                int size = 1 << order;
                int buddy = base + size;
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
    cout << (largest) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int maxOrder, q;
        maxOrder = scanner.nextInt();
        q = scanner.nextInt();
        int arena = 1 << maxOrder;
        int[] freeAt = new int[448];
        int[] baseOf = new int[32];
        int[] orderOf = new int[32];
        int[] live = new int[32];
        freeAt[maxOrder] = 1;
        for (int event = 0; event < q; event++) {
            int op, id, requested;
            op = scanner.nextInt();
            id = scanner.nextInt();
            requested = scanner.nextInt();
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
                System.out.print((base) + " ");
            } else if (live[id] == 1) {
                int base = baseOf[id];
                int order = orderOf[id];
                live[id] = 0;
                while (order < maxOrder) {
                    int size = 1 << order;
                    int buddy = base + size;
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
        System.out.print((largest) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

max_order = read_int()
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
            buddy = base + size
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
print(largest)
```

---

## 48. Commit Order at Dawn

SYSTEMS · Difficulty 90 · Bounty 900

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to recover committed settings after a crash.

What the code should do
Start from the initial settings. A transaction is a group of writes. A write event has four integers: `1`, a transaction ID, a key index, and a new value. A commit event has `2`, a transaction ID, `0`, and `0`. Ignore every transaction without a commit marker. Replay committed transactions as whole batches in commit-marker order, earliest first. Within each batch, replay writes in original log order. A later batch overwrites earlier values on the same key.

What's going wrong
Recovery can apply transaction groups in the wrong order and leave the wrong setting.

How to read the code
A transaction groups writes. Its commit marker says the group is complete. A log records events in order. `first` stores a transaction's first-write position. Commit positions are in `commitAt` in C, C++ and Java; `commit_at` in Python. Setting indices are called keys.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `keys`, the setting count; `transactions`, the transaction-ID count; and `events`, the log length.
2. Read `keys` initial setting values in key order.
3. Read `events` quadruples: event kind (`1` for write, `2` for commit), transaction ID, key index, and new value. The last two fields are `0 0` for a commit.

Output
Print the recovered `keys` values in key order, starting at key 0.

Example explained
For input `1 2 4 0 1 1 0 8 1 2 0 9 2 2 0 0 2 1 0 0`, transaction 2 commits first, then transaction 1. The output is `8`.

Limits
`1 <= keys <= 16`. `1 <= transactions <= 12`. `0 <= events <= 100`. Transaction IDs are from 1 through `transactions`; key indices are from 0 through `keys - 1`. Values are from -1000 through 1000. Each transaction commits at most once, after all its writes. Every committed transaction has at least one write.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 2 4
0
1 1 0 8
1 2 0 9
2 2 0 0
2 1 0 0
```

Expected output:

```text
8
```

Sample 2 input:

```text
1 1 2
5
1 1 0 7
2 1 0 0
```

Expected output:

```text
7
```

### Progressive hints (private until purchased)

1. Can the first transaction to write be the last to commit?
2. Trace two transactions writing the same key whose commit order reverses their first-write order.
3. Select each batch by its commit position, rather than `first[tx]`: use `commitAt[tx]` in C, C++ and Java; `commit_at[tx]` in Python. Keep each batch's write order and skip uncommitted transactions.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int keys, transactions, events;
    scanf("%d", &keys);
    scanf("%d", &transactions);
    scanf("%d", &events);
    int valueAt[16] = {0};
    int kind[101] = {0};
    int txAt[101] = {0};
    int keyAt[101] = {0};
    int writeValue[101] = {0};
    int first[13] = {0};
    int commitAt[13] = {0};
    for (int key = 0; key < keys; key++) {
        scanf("%d", &valueAt[key]);
    }
    for (int event = 1; event <= events; event++) {
        scanf("%d", &kind[event]);
        scanf("%d", &txAt[event]);
        scanf("%d", &keyAt[event]);
        scanf("%d", &writeValue[event]);
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
            if (commitAt[tx] > 0 && first[tx] == step) {
                for (int event = 1; event <= events; event++) {
                    if (kind[event] == 1 && txAt[event] == tx) {
                        valueAt[keyAt[event]] = writeValue[event];
                    }
                }
            }
        }
    }
    for (int key = 0; key < keys; key++) {
        printf("%d ", (valueAt[key]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int keys, transactions, events;
    cin >> keys;
    cin >> transactions;
    cin >> events;
    int valueAt[16] = {0};
    int kind[101] = {0};
    int txAt[101] = {0};
    int keyAt[101] = {0};
    int writeValue[101] = {0};
    int first[13] = {0};
    int commitAt[13] = {0};
    for (int key = 0; key < keys; key++) {
        cin >> valueAt[key];
    }
    for (int event = 1; event <= events; event++) {
        cin >> kind[event];
        cin >> txAt[event];
        cin >> keyAt[event];
        cin >> writeValue[event];
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
            if (commitAt[tx] > 0 && first[tx] == step) {
                for (int event = 1; event <= events; event++) {
                    if (kind[event] == 1 && txAt[event] == tx) {
                        valueAt[keyAt[event]] = writeValue[event];
                    }
                }
            }
        }
    }
    for (int key = 0; key < keys; key++) {
        cout << (valueAt[key]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int keys, transactions, events;
        keys = scanner.nextInt();
        transactions = scanner.nextInt();
        events = scanner.nextInt();
        int[] valueAt = new int[16];
        int[] kind = new int[101];
        int[] txAt = new int[101];
        int[] keyAt = new int[101];
        int[] writeValue = new int[101];
        int[] first = new int[13];
        int[] commitAt = new int[13];
        for (int key = 0; key < keys; key++) {
            valueAt[key] = scanner.nextInt();
        }
        for (int event = 1; event <= events; event++) {
            kind[event] = scanner.nextInt();
            txAt[event] = scanner.nextInt();
            keyAt[event] = scanner.nextInt();
            writeValue[event] = scanner.nextInt();
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
                if (commitAt[tx] > 0 && first[tx] == step) {
                    for (int event = 1; event <= events; event++) {
                        if (kind[event] == 1 && txAt[event] == tx) {
                            valueAt[keyAt[event]] = writeValue[event];
                        }
                    }
                }
            }
        }
        for (int key = 0; key < keys; key++) {
            System.out.print((valueAt[key]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

keys = read_int()
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
        if commit_at[tx] > 0 and first[tx] == step:
            for event in range(1, events + 1):
                if kind[event] == 1 and tx_at[event] == tx:
                    value_at[key_at[event]] = write_value[event]
print(*value_at)
```

---

## 49. Disk Route State

SYSTEMS · Difficulty 96 · Bounty 960

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan needs a disk route that meets every request's deadline.

What the code should do
All requests are ready at time 0. Service each exactly once in any order. A track is a numbered disk position. Moving between tracks costs their absolute difference in time and movement. Each service takes one extra time unit but adds no movement. A request meets its deadline if service finishes at or before it. Minimize total movement while meeting every deadline. No return to the starting track is required. Print `-1` if impossible. Keep the supplied subset dynamic program, which stores the earliest feasible finish time for each visited set and final request. For the same visited set and final request, an earlier finish allows every continuation a later finish allows. A complete route's movement is its finish time minus `n`.

What's going wrong
The planner can store a partial route with an endpoint different from where the head finished.

How to read the code
A track is a numbered disk position. `head` is the starting position. Dynamic programming stores the best result for each partial route. A bit mask represents a set: bit `i` is 1 when request `i` is done. `dp[mask * n + last]` is the earliest feasible finish time for exactly that set, ending at request `last`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the request count, and `head`, the starting track.
2. Read `n` pairs: `track`, the requested position, and `deadline`, its latest allowed finish time. Request indices start at 0; requests on the same track are separate.

Output
Print the minimum total movement for a feasible complete route, or `-1`. Do not print a route.

Example explained
For input `2 0 2 3 5 7`, visit track 2 then 5. Services finish at times 3 and 7, meeting both deadlines exactly. The output is `5`.

Limits
`1 <= n <= 12`. `0 <= head, track <= 100`. `0 <= deadline <= 1500`. The table has at most 49152 entries. Its running time is bounded by a constant times 2 to power `n`, times `n` squared.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 0
2 3
5 7
```

Expected output:

```text
5
```

Sample 2 input:

```text
1 5
5 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. A state must identify the head's endpoint as well as the requests already done.
2. After moving from `last` to the next request, what endpoint should the destination entry describe?
3. Use the new mask and the newly serviced endpoint: `nextMask * n + next` in C, C++ and Java; `next_mask * n + next_request` in Python. Keep the deadline and minimum-time checks.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, head;
    scanf("%d", &n);
    scanf("%d", &head);
    int track[12] = {0};
    int deadline[12] = {0};
    int dp[49152] = {0};
    int total = 1 << n;
    int infinity = 1000000;
    for (int i = 0; i < total * n; i++) {
        dp[i] = infinity;
    }
    for (int i = 0; i < n; i++) {
        scanf("%d", &track[i]);
        scanf("%d", &deadline[i]);
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
                int destination = nextMask * n + last;
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
    printf("%d ", (best == infinity ? -1 : best - n));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, head;
    cin >> n;
    cin >> head;
    int track[12] = {0};
    int deadline[12] = {0};
    int dp[49152] = {0};
    int total = 1 << n;
    int infinity = 1000000;
    for (int i = 0; i < total * n; i++) {
        dp[i] = infinity;
    }
    for (int i = 0; i < n; i++) {
        cin >> track[i];
        cin >> deadline[i];
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
                int destination = nextMask * n + last;
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
    cout << (best == infinity ? -1 : best - n) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, head;
        n = scanner.nextInt();
        head = scanner.nextInt();
        int[] track = new int[12];
        int[] deadline = new int[12];
        int[] dp = new int[49152];
        int total = 1 << n;
        int infinity = 1000000;
        for (int i = 0; i < total * n; i++) {
            dp[i] = infinity;
        }
        for (int i = 0; i < n; i++) {
            track[i] = scanner.nextInt();
            deadline[i] = scanner.nextInt();
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
                    int destination = nextMask * n + last;
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
        System.out.print((best == infinity ? -1 : best - n) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
            destination = next_mask * n + last
            if next_time <= deadline[next_request] and next_time < dp[destination]:
                dp[destination] = next_time
best = min(dp[(total - 1) * n:total * n])
print(-1 if best == infinity else best - n)
```

---

## 50. The Black-to-White Breach

SYSTEMS · Difficulty 100 · Bounty 1000

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to keep discovered objects while their links change during a memory scan.

What the code should do
Simulate events one at a time, without concurrent threads. All objects start white, meaning unseen. Initial roots, the starting objects, become gray, meaning waiting to scan. Each link slot has a fixed owner and a target; `-1` means empty. `1` scans the lowest-ID gray object, if any: make it black, meaning already scanned, and shade its white outgoing targets gray. `2 edge child` replaces slot `edge`'s target. If its owner is black and the new target is white, immediately shade that target gray; an empty target shades nothing. This link-update check is the write barrier. `3 root` adds a root, shading it only if white. After all events, finish scanning gray objects by the same rule. Retain every object ever shaded, even if links are later removed. Do not recompute which objects can be reached using only the final links.

What's going wrong
A link added after its owner was scanned can leave the new target unseen.

How to read the code
Objects and links form a directed graph: each link goes from an owner to a target. Roots are starting objects to retain. `color` is `0` for white (unseen), `1` for gray (waiting to scan), or `2` for black (already scanned). Shading changes white to gray. `owner` and `target` describe link slots. A write barrier is a check made when a link changes.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the object count; `m`, the link-slot count; `r`, the initial-root count; and `q`, the event count.
2. Read `r` initial root IDs.
3. Read `m` pairs `owner target`, in slot index order.
4. Read `q` operations: `1`, `2 edge child`, or `3 root`. Object and slot indices start at 0.

Output
Print `n` retained flags in object ID order: `1` for a nonwhite object and `0` for a white object.

Example explained
For input `2 1 1 2 0 0 -1 1 2 0 1`, object 0 is scanned before its empty slot is linked to object 1. The new target must be shaded. The output is `1 1`.

Limits
`1 <= n <= 32`. `0 <= m <= 64`. `0 <= r <= n`. `0 <= q <= 100`. Initial roots are distinct. Owner, root and nonempty target IDs are from 0 through `n - 1`. `0 <= edge < m`. Targets, including `child`, may also be `-1`. A scan with no gray object does nothing. Each object is scanned at most once; cycles and self-links are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1 1 2
0
0 -1
1
2 0 1
```

Expected output:

```text
1 1
```

Sample 2 input:

```text
3 2 1 0
0
0 1
1 2
```

Expected output:

```text
1 1 1
```

### Progressive hints (private until purchased)

1. Which color means an owner's links have already been scanned?
2. A gray owner will be scanned later, but a black owner will not. What happens to a new white target attached to a black owner?
3. In the link-update check, require `color[owner[edge]] == 2`, plus a nonempty white `child`. Keep normal scanning, root shading and retention of previously shaded objects.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, r, q;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &r);
    scanf("%d", &q);
    int color[32] = {0};
    int owner[64] = {0};
    int target[64] = {0};
    for (int i = 0; i < r; i++) {
        int root;
        scanf("%d", &root);
        color[root] = 1;
    }
    for (int edge = 0; edge < m; edge++) {
        scanf("%d", &owner[edge]);
        scanf("%d", &target[edge]);
    }
    for (int event = 0; event < q; event++) {
        int op;
        scanf("%d", &op);
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
            scanf("%d", &edge);
            scanf("%d", &child);
            target[edge] = child;
            if (color[owner[edge]] == 1 && child != -1 && color[child] == 0) {
                color[child] = 1;
            }
        } else {
            int root;
            scanf("%d", &root);
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
        printf("%d ", (color[node] == 0 ? 0 : 1));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, r, q;
    cin >> n;
    cin >> m;
    cin >> r;
    cin >> q;
    int color[32] = {0};
    int owner[64] = {0};
    int target[64] = {0};
    for (int i = 0; i < r; i++) {
        int root;
        cin >> root;
        color[root] = 1;
    }
    for (int edge = 0; edge < m; edge++) {
        cin >> owner[edge];
        cin >> target[edge];
    }
    for (int event = 0; event < q; event++) {
        int op;
        cin >> op;
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
            cin >> edge;
            cin >> child;
            target[edge] = child;
            if (color[owner[edge]] == 1 && child != -1 && color[child] == 0) {
                color[child] = 1;
            }
        } else {
            int root;
            cin >> root;
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
        cout << (color[node] == 0 ? 0 : 1) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, r, q;
        n = scanner.nextInt();
        m = scanner.nextInt();
        r = scanner.nextInt();
        q = scanner.nextInt();
        int[] color = new int[32];
        int[] owner = new int[64];
        int[] target = new int[64];
        for (int i = 0; i < r; i++) {
            int root;
            root = scanner.nextInt();
            color[root] = 1;
        }
        for (int edge = 0; edge < m; edge++) {
            owner[edge] = scanner.nextInt();
            target[edge] = scanner.nextInt();
        }
        for (int event = 0; event < q; event++) {
            int op;
            op = scanner.nextInt();
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
                edge = scanner.nextInt();
                child = scanner.nextInt();
                target[edge] = child;
                if (color[owner[edge]] == 1 && child != -1 && color[child] == 0) {
                    color[child] = 1;
                }
            } else {
                int root;
                root = scanner.nextInt();
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
            System.out.print((color[node] == 0 ? 0 : 1) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
        if color[owner[edge]] == 1 and child != -1 and color[child] == 0:
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
    print(int(state != 0))
```

---

## 51. Twin Arrival Ledger

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

### Public samples

Sample 1 input:

```text
4 4 0
0 1
0 2
1 3
2 3
```

Expected output:

```text
1 1 1 2
```

Sample 2 input:

```text
3 1 2
0 1
```

Expected output:

```text
0 0 1
```

### Progressive hints (private until purchased)

1. Trace the two shortest routes to relay `3` in the first sample.
2. A later arrival at the same shortest distance can represent more routes.
3. When `distance[v] == distance[u] + 1`, add `ways[u]` to `ways[v]` instead of replacing it. These are the route counts for predecessor `u` and destination `v`.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 52. Repair Front Collision

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

### Public samples

Sample 1 input:

```text
4 3 2
0 3
0 1
1 2
2 3
```

Expected output:

```text
3
```

Sample 2 input:

```text
3 0 2
0 2
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Two searches can meet at opposite ends of a cable.
2. `distance[u]` and `distance[v]` end at different relays when their `owner` entries differ.
3. Include the joining cable: the route length is `distance[u] + distance[v] + 1`. Keep the smallest such value in `best`.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 53. Even Pulse Corridor

GRAPHS · Difficulty 40 · Bounty 400

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS requires an even number of link crossings. Patch checks the shortest allowed walk.

What the code should do
Find the shortest walk from `s` (the start) to `t` (the target) using an even number of one-way links. A walk follows the listed directions and may repeat relays or links. Count every link crossing, including repeats. A zero-link walk is allowed when `s == t`. Print `-1` if no even-length walk exists.

What's going wrong
The program can accept an odd-length walk or miss an even-length one.

How to read the code
`state` combines a relay number with `parity` (whether the length is even or odd). `distance` stores a separate length for each state, and `queue` holds states waiting to be explored.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), `s` (the start), and `t` (the target).
2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.

Output
Print the fewest link crossings in an even-length walk, or `-1` if none exists.

Example explained
The first sample has only link `0 -> 1`. Its only walk to target `1` has odd length, so print `-1`. The second sample has `0 -> 1 -> 2`, so print `2`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Directed links are distinct; links from a relay to itself are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1 0 1
0 1
```

Expected output:

```text
-1
```

Sample 2 input:

```text
3 2 0 2
0 1
1 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Reaching one relay after odd and even numbers of steps gives different search states.
2. What happens to `parity` (even or odd length) after crossing one link?
3. Use `1 - parity` for the neighbour state. Keep both states for every relay and read the even state at `t` (the target).

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s, t;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    scanf("%d", &t);
    int edge[1024] = {0};
    int distance[64] = {0};
    int queue[64] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
            int nextState = v * 2 + parity;
            if (edge[u * 32 + v] != 0 && distance[nextState] == -1) {
                distance[nextState] = distance[state] + 1;
                queue[tail++] = nextState;
            }
        }
    }
    printf("%d ", (distance[t * 2]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s, t;
    cin >> n;
    cin >> m;
    cin >> s;
    cin >> t;
    int edge[1024] = {0};
    int distance[64] = {0};
    int queue[64] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
            int nextState = v * 2 + parity;
            if (edge[u * 32 + v] != 0 && distance[nextState] == -1) {
                distance[nextState] = distance[state] + 1;
                queue[tail++] = nextState;
            }
        }
    }
    cout << (distance[t * 2]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s, t;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        t = scanner.nextInt();
        int[] edge = new int[1024];
        int[] distance = new int[64];
        int[] queue = new int[64];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                int nextState = v * 2 + parity;
                if (edge[u * 32 + v] != 0 && distance[nextState] == -1) {
                    distance[nextState] = distance[state] + 1;
                    queue[tail++] = nextState;
                }
            }
        }
        System.out.print((distance[t * 2]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
        next_state = v * 2 + parity
        if distance[next_state] == -1:
            distance[next_state] = distance[state] + 1
            queue.append(next_state)
print(distance[t * 2])
```

---

## 54. Parallel Repair Clock

GRAPHS · Difficulty 42 · Bounty 420

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted repair times. Mira checks when each job can finish with unlimited workers.

What the code should do
The jobs and their requirements form a directed acyclic graph: a network of jobs and one-way requirement links with no directed route returning to its start. A pair `u v` means job `u` must finish before job `v` starts. Jobs may run at the same time, with no worker limit. Jobs without requirements may start at time `0`; every other job may start as soon as all its required jobs finish. Print each job's earliest finish time.

What's going wrong
A job can be delayed as if its independent requirements ran one after another.

How to read the code
`duration` stores job lengths, `indegree` counts unfinished requirements, and `queue` lists released jobs. `ready` holds start times under consideration; `finish` holds finish times.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of jobs) and `m` (the number of requirements).
2. Read `n` durations into `duration`, in job-number order.
3. Read `m` pairs `u v`, with the required earlier job first.

Output
Print `n` earliest finish times separated by spaces, for jobs `0` through `n - 1` in order.

Example explained
In the first sample, jobs `0` and `1` take `3` and `5` time units and can run together. Job `2` takes `2` units after both finish. Print `3 5 7`. The second sample is a chain and prints `2 5 9`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; durations are from `1` through `1000`. Jobs are numbered `0` through `n - 1`. Requirement pairs are distinct, with no self-requirements or directed cycles.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
3 5 2
0 2
1 2
```

Expected output:

```text
3 5 7
```

Sample 2 input:

```text
3 2
2 3 4
0 1
1 2
```

Expected output:

```text
2 5 9
```

### Progressive hints (private until purchased)

1. Independent jobs can run during the same time period.
2. A job waits for all its requirements, but their finish times are not separate waiting periods.
3. Keep the largest predecessor finish time in `ready[v]` (job `v`'s start time). Add `duration[v]` once to obtain its finish time.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int duration[32] = {0};
    int edge[1024] = {0};
    int indegree[32] = {0};
    int ready[32] = {0};
    int finish[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &duration[i]);
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
                ready[v] += finish[u];
                indegree[v]--;
                if (indegree[v] == 0) {
                    queue[tail++] = v;
                }
            }
        }
    }
    for (int v = 0; v < n; v++) {
        printf("%d ", (finish[v]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int duration[32] = {0};
    int edge[1024] = {0};
    int indegree[32] = {0};
    int ready[32] = {0};
    int finish[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        cin >> duration[i];
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
                ready[v] += finish[u];
                indegree[v]--;
                if (indegree[v] == 0) {
                    queue[tail++] = v;
                }
            }
        }
    }
    for (int v = 0; v < n; v++) {
        cout << (finish[v]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] duration = new int[32];
        int[] edge = new int[1024];
        int[] indegree = new int[32];
        int[] ready = new int[32];
        int[] finish = new int[32];
        int[] queue = new int[32];
        for (int i = 0; i < n; i++) {
            duration[i] = scanner.nextInt();
        }
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                    ready[v] += finish[u];
                    indegree[v]--;
                    if (indegree[v] == 0) {
                        queue[tail++] = v;
                    }
                }
            }
        }
        for (int v = 0; v < n; v++) {
            System.out.print((finish[v]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
        ready[v] += finish[u]
        indegree[v] -= 1
        if indegree[v] == 0:
            queue.append(v)
print(*finish)
```

---

## 55. Cycle Admission Desk

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

### Public samples

Sample 1 input:

```text
3 3
0 1
1 2
0 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
4 2
0 1
2 3
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Two relays can share a group even when their next parent labels differ.
2. Compare the ends of the two `parent` chains, rather than just their first links.
3. Use `a == b` for the group comparison. The loops have already made `a` and `b` the representatives of the endpoint groups.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 56. Two Phase Isolation

GRAPHS · Difficulty 35 · Bounty 350

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted cooling settings. Patch checks whether linked relays can use opposite settings.

What the code should do
Give each relay one of two phases, meaning labels `0` and `1`. Decide whether every two-way cable can have different labels at its endpoints. Check the whole network, including separate groups and isolated relays. A cable from a relay to itself makes this impossible. Only existence matters; do not print the labels.

What's going wrong
The checker can reject a valid labelling and accept a conflicting one.

How to read the code
`color` stores phase labels, with `-1` meaning unassigned. `queue` holds relays waiting to be explored, and `valid` records whether a conflict was found.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of cables).
2. Read `m` pairs `u v`, the endpoints of each two-way cable.

Output
Print `1` if such a labelling exists, otherwise `0`.

Example explained
The triangle in the first sample cannot give different labels to both ends of every cable, so print `0`. The four-relay ring in the second sample can alternate labels, so print `1`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Cables are distinct; a cable may join a relay to itself.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 1
1 2
2 0
```

Expected output:

```text
0
```

Sample 2 input:

```text
4 4
0 1
1 2
2 3
3 0
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Check a cable whose endpoints both already have labels.
2. New neighbours get labels, but links to previously labelled relays must also be checked.
3. For an already labelled neighbour, a conflict occurs when `color[v] == color[u]`. These are the endpoint labels; different labels are allowed.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[1024] = {0};
    int color[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        color[i] = -1;
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
                        } else if (color[v] == 1 - color[u]) {
                            valid = 0;
                        }
                    }
                }
            }
        }
    }
    printf("%d ", (valid));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int edge[1024] = {0};
    int color[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        color[i] = -1;
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
                        } else if (color[v] == 1 - color[u]) {
                            valid = 0;
                        }
                    }
                }
            }
        }
    }
    cout << (valid) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[1024];
        int[] color = new int[32];
        int[] queue = new int[32];
        for (int i = 0; i < n; i++) {
            color[i] = -1;
        }
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                            } else if (color[v] == 1 - color[u]) {
                                valid = 0;
                            }
                        }
                    }
                }
            }
        }
        System.out.print((valid) + " ");
        System.out.println();
    }
}
```

### python buggy starter

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
                elif color[v] == 1 - color[u]:
                    valid = 0
print(valid)
```

---

## 57. Nested Repair Load

GRAPHS · Difficulty 45 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted load totals. Patch checks the total load below each relay.

What the code should do
A tree connects all relays and has exactly one route between any two without repeating a relay. Root `0` sets parent-child directions away from itself. A descendant is reached by following children away from the root. A relay's subtree contains itself and all its descendants. Print the sum of signed loads in each subtree. Negative loads subtract from the sum.

What's going wrong
Totals can omit loads from grandchildren and more distant descendants.

How to read the code
`parent` stores each relay's parent, `value` its input load, and `total` its working total. `queue` records an order starting at root `0`; a later loop reads that order backwards.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays).
2. Read `n` signed loads into `value`, in relay-number order.
3. Read `n - 1` parent numbers into `parent`, for relays `1` through `n - 1` in order.

Output
Print `n` subtree sums separated by spaces, for relays `0` through `n - 1` in order.

Example explained
The first sample is chain `0-1-2` with loads `2 3 5`. Print subtree sums `10 8 5`. In the second sample, relays `1` and `2` are children of `0`; loads `1 -2 4` give sums `3 -2 4`.

Limits
`1 <= n <= 32`; loads are from `-1000` through `1000`. Relays are numbered `0` through `n - 1`. The parent list forms one valid tree rooted at `0`; no relay is its own parent. A parent's number may be larger than its child's.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
2 3 5
0 1
```

Expected output:

```text
10 8 5
```

Sample 2 input:

```text
3
1 -2 4
0 0
```

Expected output:

```text
3 -2 4
```

### Progressive hints (private until purchased)

1. Trace a relay with a child and a grandchild.
2. In the backwards loop, each child's `total` already includes the loads below that child.
3. Add `total[u]` (the child's accumulated load) to `total[parent[u]]` (the parent's total). Adding only `value[u]` loses deeper descendants.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int value[32] = {0};
    int total[32] = {0};
    int parent[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &value[i]);
        total[i] = value[i];
    }
    for (int i = 1; i < n; i++) {
        scanf("%d", &parent[i]);
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
        total[parent[u]] += value[u];
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (total[i]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int value[32] = {0};
    int total[32] = {0};
    int parent[32] = {0};
    int queue[32] = {0};
    for (int i = 0; i < n; i++) {
        cin >> value[i];
        total[i] = value[i];
    }
    for (int i = 1; i < n; i++) {
        cin >> parent[i];
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
        total[parent[u]] += value[u];
    }
    for (int i = 0; i < n; i++) {
        cout << (total[i]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] value = new int[32];
        int[] total = new int[32];
        int[] parent = new int[32];
        int[] queue = new int[32];
        for (int i = 0; i < n; i++) {
            value[i] = scanner.nextInt();
            total[i] = value[i];
        }
        for (int i = 1; i < n; i++) {
            parent[i] = scanner.nextInt();
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
            total[parent[u]] += value[u];
        }
        for (int i = 0; i < n; i++) {
            System.out.print((total[i]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
    total[parent[u]] += value[u]
print(*total)
```

---

## 58. Cooling Tree Core

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

### Public samples

Sample 1 input:

```text
4 3
0 1
1 2
2 3
```

Expected output:

```text
1 2
```

Sample 2 input:

```text
5 4
0 1
1 2
2 3
3 4
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Changing the order of the leaf numbers should not change the central positions.
2. Leaves discovered during a removal layer belong to the next layer.
3. Set `batch` (the layer size) to the number of leaves waiting at the start of the round. Remove that whole batch before checking `remaining` again.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 59. Tentative Alarm Queue

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

### Public samples

Sample 1 input:

```text
3 3 0
0 1 9
0 2 1
2 1 1
```

Expected output:

```text
0 2 1
```

Sample 2 input:

```text
3 1 0
0 1 2
```

Expected output:

```text
0 2 -1
```

### Progressive hints (private until purchased)

1. A relay's number does not measure travel cost.
2. Once `done` marks a relay final, later routes cannot improve its cost in this code.
3. Select the unused relay with the smallest entry in `distance`, not the smallest relay number. Nonnegative link costs make that selected cost final.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 60. Zero Cost Fast Lane

GRAPHS · Difficulty 60 · Bounty 600

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has mixed free links with paid links. Patch checks the fewest paid crossings.

What the code should do
For every relay, find the smallest number of paid link crossings on a directed route from `s` (the start). Each link costs `0` for a free crossing or `1` for a paid crossing. Free crossings still follow the listed direction. The zero-link route at `s` costs `0`. Print `-1` for an unreachable relay. Print costs only, even if routes tie.

What's going wrong
A relay can be treated as final before a cheaper route using free links reaches it.

How to read the code
`queue` acts as a deque, a waiting list allowing additions at either end. `head` and `tail` mark its ends. `distance` stores costs, and `done` marks relays treated as final.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).
2. Read `m` triples `u v w`, a link from `u` to `v` only, with cost `w`, either `0` or `1`.

Output
Print `n` minimum costs separated by spaces, for relays `0` through `n - 1` in order. Use `-1` for an unreachable relay.

Example explained
In the first sample, free route `0 -> 2 -> 1` avoids the paid direct link. Print `0 0 0`. The second sample is a chain of two paid links and prints `0 1 2`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; `w` is `0` or `1`. Relays are numbered `0` through `n - 1`. No link is repeated or joins a relay to itself. The supplied fixed `queue` has room for every cost improvement in both versions.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3 0
0 1 1
0 2 0
2 1 0
```

Expected output:

```text
0 0 0
```

Sample 2 input:

```text
3 2 0
0 1 1
1 2 1
```

Expected output:

```text
0 1 2
```

### Progressive hints (private until purchased)

1. Should a free crossing wait behind a more expensive arrival?
2. `done` assumes the next relay removed from the front has the smallest unfinished cost.
3. Add an improved relay to the front when `weight == 0`, and to the back when `weight == 1`. Here `weight` is the crossed link's cost.

### c buggy starter

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
    int queue[512] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, w;
        scanf("%d", &u);
        scanf("%d", &v);
        scanf("%d", &w);
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
                    if (weight == 1) {
                        queue[--head] = v;
                    } else {
                        queue[tail++] = v;
                    }
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

### cpp buggy starter

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
    int queue[512] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, w;
        cin >> u;
        cin >> v;
        cin >> w;
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
                    if (weight == 1) {
                        queue[--head] = v;
                    } else {
                        queue[tail++] = v;
                    }
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

### java buggy starter

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
        int[] queue = new int[512];
        for (int i = 0; i < m; i++) {
            int u, v, w;
            u = scanner.nextInt();
            v = scanner.nextInt();
            w = scanner.nextInt();
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
                        if (weight == 1) {
                            queue[--head] = v;
                        } else {
                            queue[tail++] = v;
                        }
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

### python buggy starter

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
                if weight == 1:
                    head -= 1
                    queue[head] = v
                else:
                    queue[tail] = v
                    tail += 1
print(*[-1 if x == 1000000 else x for x in distance])
```

---

## 61. Worst Link Shield

GRAPHS · Difficulty 53 · Bounty 530

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has changed link risks. Mira checks routes with the smallest possible largest risk.

What the code should do
For every relay, consider directed routes from `s` (the start). A route's cost is the largest cost of any link it uses. Find the smallest possible route cost under this rule; do not add link costs. The zero-link route at `s` costs `0`. Print `-1` for an unreachable relay. If routes tie, print only the cost.

What's going wrong
The reported cost can combine several link risks even though only the largest matters.

How to read the code
`distance` stores the best route risks found so far. `done` marks relays treated as final. `candidate` is the risk considered when extending a route.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).
2. Read `m` triples `u v w`, a link from `u` to `v` only, with risk `w`.

Output
Print `n` minimum route risks separated by spaces, for relays `0` through `n - 1` in order. Use `-1` for an unreachable relay.

Example explained
In the first sample, risks `4` then `7` give route risk `7`, so print `0 4 7`. In the second sample, risks `7` then `4` still give route risk `7`, so print `0 7 7`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No directed link is repeated or joins a relay to itself.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 0
0 1 4
1 2 7
```

Expected output:

```text
0 4 7
```

Sample 2 input:

```text
3 2 0
0 1 7
1 2 4
```

Expected output:

```text
0 7 7
```

### Progressive hints (private until purchased)

1. Reversing the two link risks in the public samples does not change their largest value.
2. Extending a route keeps its previous largest risk or replaces it with a larger one.
3. When `weight > candidate`, assign `candidate = weight` rather than adding. Here `weight` is the new link's risk and `candidate` starts as the route's previous largest risk.

### c buggy starter

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
                    candidate += weight;
                }
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

### cpp buggy starter

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
                    candidate += weight;
                }
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

### java buggy starter

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
                        candidate += weight;
                    }
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

### python buggy starter

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
                candidate += weight
            if candidate < distance[v]:
                distance[v] = candidate
print(*[-1 if x == 1000000 else x for x in distance])
```

---

## 62. Reachable Credit Spiral

GRAPHS · Difficulty 65 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has added negative link prices. Ishan checks whether a reachable loop can keep lowering costs.

What the code should do
A directed cycle follows one-way links back to its start, uses at least one link, and repeats no other relay. Its total cost is the sum of its link costs. Print whether `s` (the start) can reach any cycle with a strictly negative total. A negative link alone is not enough. Unreachable cycles and cycles with total cost `0` do not count.

What's going wrong
A negative cycle, or even a negative link, in an unreachable part of the network can trigger an alarm.

How to read the code
`distance` stores costs found from the start; `1000000` marks an unreachable relay. The main loops update costs by scanning links. A final scan sets `alarm` (the answer).

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), and `s` (the start).
2. Read `m` triples `u v w`, a link from `u` to `v` only, with signed cost `w`.

Output
Print `1` if the start can reach a negative-total-cost cycle, otherwise `0`.

Example explained
In the first sample, cycle `1 -> 2 -> 1` costs `-2`, but start `0` cannot reach it. Print `0`. In the second sample, start `0` lies on a cycle costing `-1`, so print `1`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; `-100 <= w <= 100`. Relays are numbered `0` through `n - 1`. Links are distinct; links from a relay to itself are allowed. The supplied bounded scans keep arithmetic within signed 32-bit range.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 0
1 2 -3
2 1 1
```

Expected output:

```text
0
```

Sample 2 input:

```text
2 2 0
0 1 -2
1 0 1
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Can the start reach the link that triggers the final alarm?
2. Compare the tests in the main cost-update loop and the final alarm loop.
3. Before testing an improvement from `u`, require `distance[u] != 1000000`. The marker for an unreachable relay is not a real route cost.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    int from[160] = {0};
    int to[160] = {0};
    int weight[160] = {0};
    int distance[32] = {0};
    for (int i = 0; i < m; i++) {
        scanf("%d", &from[i]);
        scanf("%d", &to[i]);
        scanf("%d", &weight[i]);
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
        if (distance[u] + weight[i] < distance[v]) {
            alarm = 1;
        }
    }
    printf("%d ", (alarm));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s;
    cin >> n;
    cin >> m;
    cin >> s;
    int from[160] = {0};
    int to[160] = {0};
    int weight[160] = {0};
    int distance[32] = {0};
    for (int i = 0; i < m; i++) {
        cin >> from[i];
        cin >> to[i];
        cin >> weight[i];
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
        if (distance[u] + weight[i] < distance[v]) {
            alarm = 1;
        }
    }
    cout << (alarm) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        int[] from = new int[160];
        int[] to = new int[160];
        int[] weight = new int[160];
        int[] distance = new int[32];
        for (int i = 0; i < m; i++) {
            from[i] = scanner.nextInt();
            to[i] = scanner.nextInt();
            weight[i] = scanner.nextInt();
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
            if (distance[u] + weight[i] < distance[v]) {
                alarm = 1;
            }
        }
        System.out.print((alarm) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
    if distance[u] + w < distance[v]:
        alarm = 1
print(alarm)
```

---

## 63. Cheapest Repair Backbone

GRAPHS · Difficulty 58 · Bounty 580

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has changed cable prices. Mira checks the cheapest way to connect every relay.

What the code should do
A spanning tree is a set of two-way cables connecting every relay with no cycle, meaning no closed route without reusing a cable. Find the smallest sum of cable prices over all spanning trees. Count each selected cable's price once. Print `-1` if the network cannot connect all relays. A single relay needs no cables and costs `0`. If trees tie, print only their shared minimum price.

What's going wrong
The total can include costs already charged when earlier relays joined the selected tree.

How to read the code
`done` marks selected relays, `key` holds pending connection prices, and `total` accumulates the answer. Each pass selects a relay and scans its cables.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of cables).
2. Read `m` triples `u v w`, the endpoints and price of each two-way cable.

Output
Print the minimum total cable price, or `-1` if no spanning tree exists.

Example explained
In the first sample, choose cables `0-1` costing `2` and `1-2` costing `3`, for total `5`. In the second sample, relay `2` cannot be connected, so print `-1`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No cable is repeated or joins a relay to itself.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 1 2
1 2 3
0 2 9
```

Expected output:

```text
5
```

Sample 2 input:

```text
3 1
0 1 1
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. The answer pays for selected cables once, rather than separate routes from the start.
2. When adding a relay, consider the price of the cable joining it to the selected tree.
3. On an improvement, set `key[v] = weight`, where `weight` is the cable price. Do not add `key[u]`, which includes a price already charged.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[1024] = {0};
    int key[32] = {0};
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
                key[v] = key[u] + weight;
            }
        }
    }
    printf("%d ", (connected != 0 ? total : -1));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int edge[1024] = {0};
    int key[32] = {0};
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
                key[v] = key[u] + weight;
            }
        }
    }
    cout << (connected != 0 ? total : -1) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[1024];
        int[] key = new int[32];
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
                    key[v] = key[u] + weight;
                }
            }
        }
        System.out.print((connected != 0 ? total : -1) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
            key[v] = key[u] + weight
print(total if connected else -1)
```

---

## 64. Backup Cable Pairing

GRAPHS · Difficulty 62 · Bounty 620

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS may cut one cable. Ishan checks how many backup cables will keep the network connected.

What the code should do
Add the fewest two-way cables so that removing any one physical cable still leaves every relay reachable from every other relay. The failed cable may be original or added. Each failure test removes only one cable and is independent. A new cable may join any two different relays, including a pair that already has a cable. Repeated endpoint pairs are parallel cables: separate physical cables between the same relays. Print only the number to add.

What's going wrong
Parallel cables can be treated as failing together, giving the wrong backup count.

How to read the code
`bridge` marks cables whose single removal disconnects the network. Later loops fill `block` (groups linked without those marked cables) and `degree` (each group's number of marked cable connections).

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of physical cables).
2. Read `m` pairs of endpoint numbers. Each record is a separate two-way cable, even when its pair repeats in either order.

Output
Print one integer: the minimum number of new cables needed. A single relay needs `0`.

Example explained
In the first sample, records `0 1` and `1 0` are separate parallel cables. Either can fail safely, so print `0`. The second sample is chain `0-1-2`; adding a cable between its ends is enough, so print `1`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`. Relays are numbered `0` through `n - 1`. The original network is connected. No cable joins a relay to itself. Original and added cables may be parallel. The supplied repeated searches fit these limits.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2
0 1
1 0
```

Expected output:

```text
0
```

Sample 2 input:

```text
3 2
0 1
1 2
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Matching endpoints do not make two records the same physical cable.
2. `blocked` is the index of the one cable being tested. Its endpoint numbers do not identify it uniquely.
3. Skip only record `e == blocked` during a test. Keep every parallel cable available. The later grouping and pairing steps can then use the correct single-cut results.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int from[40] = {0};
    int to[40] = {0};
    int seen[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < m; i++) {
        scanf("%d", &from[i]);
        scanf("%d", &to[i]);
    }
    int base = 0;
    int bridge[40] = {0};
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
                    if (blocked >= 0 && ((from[e] == from[blocked] && to[e] == to[blocked]) || (from[e] == to[blocked] && to[e] == from[blocked]))) {
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
    int block[20] = {0};
    int degree[20] = {0};
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
    printf("%d ", ((leaves + 1) / 2));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int from[40] = {0};
    int to[40] = {0};
    int seen[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < m; i++) {
        cin >> from[i];
        cin >> to[i];
    }
    int base = 0;
    int bridge[40] = {0};
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
                    if (blocked >= 0 && ((from[e] == from[blocked] && to[e] == to[blocked]) || (from[e] == to[blocked] && to[e] == from[blocked]))) {
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
    int block[20] = {0};
    int degree[20] = {0};
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
    cout << ((leaves + 1) / 2) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] from = new int[40];
        int[] to = new int[40];
        int[] seen = new int[20];
        int[] queue = new int[20];
        for (int i = 0; i < m; i++) {
            from[i] = scanner.nextInt();
            to[i] = scanner.nextInt();
        }
        int base = 0;
        int[] bridge = new int[40];
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
                        if (blocked >= 0 && ((from[e] == from[blocked] && to[e] == to[blocked]) || (from[e] == to[blocked] && to[e] == from[blocked]))) {
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
        int[] block = new int[20];
        int[] degree = new int[20];
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
        System.out.print(((leaves + 1) / 2) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
                if blocked >= 0 and (edges[e] == edges[blocked] or edges[e] == edges[blocked][::-1]):
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
```

---

## 65. Disconnected Junction Audit

GRAPHS · Difficulty 64 · Bounty 640

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has already separated parts of the network. Mira checks which relay removals split it further.

What the code should do
A connected component contains a relay and all relays reachable from it along two-way cables. An isolated relay is one component. Test each relay separately by removing it and all cables attached to it from the original network. Count removals that strictly increase the total number of components. The removed relay is absent, not an isolated component. These relays are called articulation relays.

What's going wrong
A relay can be called critical just because the original network already had several components.

How to read the code
`banned` is the excluded relay, with `-1` meaning no removal. Searches count the remaining components. `base` stores the original count, and `answer` stores the number of critical relays.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of cables).
2. Read `m` pairs `u v`, the endpoints of each two-way cable.

Output
Print one integer: the number of articulation relays.

Example explained
In the first sample, chain `0-1-2` and isolated relay `3` form two components. Only removing relay `1` increases the count, so print `1`. The triangle in the second sample has no critical relay, so print `0`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`. Relays are numbered `0` through `n - 1`. Cables are distinct, with no cable joining a relay to itself. The original network may be disconnected.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 2
0 1
1 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
3 3
0 1
1 2
2 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. An already separate component should not make a removal count as harmful.
2. Use the original network's component count as the baseline for every removal.
3. Count a relay only when `count > base`, where `count` is the component count after removal and `base` is the original count. Comparing with `1` fails on disconnected inputs.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[400] = {0};
    int seen[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
        } else if (count > 1) {
            answer++;
        }
    }
    printf("%d ", (answer));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int edge[400] = {0};
    int seen[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
        } else if (count > 1) {
            answer++;
        }
    }
    cout << (answer) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[400];
        int[] seen = new int[20];
        int[] queue = new int[20];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
            } else if (count > 1) {
                answer++;
            }
        }
        System.out.print((answer) + " ");
        System.out.println();
    }
}
```

### python buggy starter

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
    elif count > 1:
        answer += 1
print(answer)
```

---

## 66. Exact Hop Manifest

GRAPHS · Difficulty 56 · Bounty 560

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS requires an exact number of link crossings. Patch checks the route count.

What the code should do
The directed graph is a network of relays and one-way links with no directed cycles, so no nonempty directed route returns to its start. Count routes from `s` (the start) to `t` (the target) using exactly `k` links. Different relay sequences are different routes. Shorter and longer routes do not count. Report the remainder after dividing the count by `1000000007`. If `k == 0`, count one route when `s == t`, otherwise none.

What's going wrong
Routes shorter than the required length can be included and counted again.

How to read the code
`ways` stores counts for the current route length. The next-length counts are stored in `nextWays` in C, C++ and Java; in `next_ways` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), `s` (the start), `t` (the target), and `k` (the required number of links).
2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.

Output
Print the route count modulo `1000000007`, meaning the remainder after division by that number. Print `0` if no route uses exactly the required number of links.

Example explained
In the first sample, only `0 -> 1 -> 2` uses exactly two links; direct link `0 -> 2` does not count. Print `1`. The second sample asks for one link where two are needed, so print `0`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; `0 <= k <= 31`. Relays are numbered `0` through `n - 1`. Links are distinct, with no self-links or directed cycles. Each sum of two reduced counts fits a signed 32-bit integer.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3 0 2 2
0 1
1 2
0 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
3 2 0 2 1
0 1
1 2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. After one more step, every counted route must have crossed one more link.
2. Keeping an old count lets that route survive a step without moving.
3. Replace `ways[v]` with the next-length count: `nextWays[v]` in C, C++ and Java; `next_ways[v]` in Python. Adding the old count keeps routes with too few links.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s, t, k;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    scanf("%d", &t);
    scanf("%d", &k);
    int edge[1024] = {0};
    int ways[32] = {0};
    int nextWays[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
            ways[v] = (ways[v] + nextWays[v]) % 1000000007;
        }
    }
    printf("%d ", (ways[t]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s, t, k;
    cin >> n;
    cin >> m;
    cin >> s;
    cin >> t;
    cin >> k;
    int edge[1024] = {0};
    int ways[32] = {0};
    int nextWays[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
            ways[v] = (ways[v] + nextWays[v]) % 1000000007;
        }
    }
    cout << (ways[t]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s, t, k;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        t = scanner.nextInt();
        k = scanner.nextInt();
        int[] edge = new int[1024];
        int[] ways = new int[32];
        int[] nextWays = new int[32];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                ways[v] = (ways[v] + nextWays[v]) % 1000000007;
            }
        }
        System.out.print((ways[t]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, m, s, t, k = read_int(), read_int(), read_int(), read_int(), read_int()
edge = [(read_int(), read_int()) for _ in range(m)]
ways = [0] * n
ways[s] = 1
for _ in range(k):
    next_ways = [0] * n
    for u, v in edge:
        next_ways[v] = (next_ways[v] + ways[u]) % 1000000007
    for v in range(n):
        ways[v] = (ways[v] + next_ways[v]) % 1000000007
print(ways[t])
```

---

## 67. One Way Cluster Gates

GRAPHS · Difficulty 65 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has restricted entry routes. Mira checks which groups need their own initial entry.

What the code should do
Group relays so that two relays share a group exactly when each can reach the other along one-way links. A relay reaches itself with zero links. Each resulting group is a strongly connected component. Count components with no incoming link from a different component. Links within a component, including self-links, do not count as incoming links for this test.

What's going wrong
A one-way route can merge relays into one group even when no return route exists.

How to read the code
`reach` records which relays can reach which others. `component` stores group numbers. `incoming` records whether a group has a link entering from another group.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of links).
2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.

Output
Print one integer: the number of components with no incoming link from another component.

Example explained
In the first sample, links `0 -> 1` and `2 -> 1` leave each relay in its own component. The groups containing `0` and `2` have no incoming links, so print `2`. In the second sample, `0` and `1` share a group that points to `2`, so print `1`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Directed links are distinct; links from a relay to itself are allowed. The supplied three nested reachability loops fit these limits.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1
2 1
```

Expected output:

```text
2
```

Sample 2 input:

```text
3 3
0 1
1 0
1 2
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. A route in one direction does not guarantee a route back.
2. `reach` stores the two directional checks separately.
3. Require both reachability entries when assigning `component` (group numbers). In Python, use `reach[u][v] != 0 and reach[v][u] != 0`. The other versions also need both directional tests.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[1024] = {0};
    int reach[1024] = {0};
    int component[32] = {0};
    int size[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
                if (reach[u * 32 + v] != 0 || reach[v * 32 + u] != 0) {
                    component[v] = groups;
                    size[groups]++;
                }
            }
            groups++;
        }
    }

    int incoming[32] = {0};
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
    printf("%d ", (answer));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int edge[1024] = {0};
    int reach[1024] = {0};
    int component[32] = {0};
    int size[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
                if (reach[u * 32 + v] != 0 || reach[v * 32 + u] != 0) {
                    component[v] = groups;
                    size[groups]++;
                }
            }
            groups++;
        }
    }

    int incoming[32] = {0};
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
    cout << (answer) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[1024];
        int[] reach = new int[1024];
        int[] component = new int[32];
        int[] size = new int[32];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                    if (reach[u * 32 + v] != 0 || reach[v * 32 + u] != 0) {
                        component[v] = groups;
                        size[groups]++;
                    }
                }
                groups++;
            }
        }

        int[] incoming = new int[32];
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
        System.out.print((answer) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
            if reach[u][v] != 0 or reach[v][u] != 0:
                component[v] = groups
                size[groups] += 1
        groups += 1

incoming = [0] * groups
for u in range(n):
    for v in range(n):
        if edge[u][v] != 0 and component[u] != component[v]:
            incoming[component[v]] = 1
print(sum(x == 0 for x in incoming))
```

---

## 68. Condensed Service Tour

GRAPHS · Difficulty 78 · Bounty 780

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted service visits. Patch checks how many different relays one trip can inspect.

What the code should do
A walk is a sequence of relays following the listed one-way links. It may start and end anywhere and repeat relays or links. Find the largest number of different relays visited during one walk. Count each relay once, even if visited repeatedly. A walk with no links visits its starting relay.

What's going wrong
A trip can undercount a group of relays it could visit before moving on.

How to read the code
A strongly connected component contains a relay and all relays that can both reach it and be reached from it. `component` stores these groups and `size` their relay counts. `dag` stores links between groups; `best` stores visit counts considered by the later loops.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of links).
2. Read `m` pairs `u v`, each allowing travel from `u` to `v` only.

Output
Print one integer: the maximum number of different relays visited. Do not print a walk.

Example explained
In the first sample, `0 -> 1 -> 2` visits all three relays, so print `3`. The second sample is a directed three-relay cycle and also permits all three visits, so print `3`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`. Relays are numbered `0` through `n - 1`. Directed links are distinct; links from a relay to itself are allowed. The supplied reachability and group-processing loops fit these limits.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 1
1 2
2 1
```

Expected output:

```text
3
```

Sample 2 input:

```text
3 3
0 1
1 2
2 0
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. A group may contain several relays that can all be visited on one walk.
2. Within a strongly connected component, the walk can visit every relay and then reach any chosen exit.
3. When extending a group route from `u` to `v`, use `best[u] + size[v]`. Here `best[u]` is the visit count so far and `size[v]` is the destination group's full relay count, which may exceed `1`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[1024] = {0};
    int reach[1024] = {0};
    int component[32] = {0};
    int size[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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

    int dag[1024] = {0};
    int indegree[32] = {0};
    int best[32] = {0};
    int queue[32] = {0};
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
                int candidate = best[u] + 1;
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
    printf("%d ", (answer));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int edge[1024] = {0};
    int reach[1024] = {0};
    int component[32] = {0};
    int size[32] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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

    int dag[1024] = {0};
    int indegree[32] = {0};
    int best[32] = {0};
    int queue[32] = {0};
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
                int candidate = best[u] + 1;
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
    cout << (answer) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[1024];
        int[] reach = new int[1024];
        int[] component = new int[32];
        int[] size = new int[32];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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

        int[] dag = new int[1024];
        int[] indegree = new int[32];
        int[] best = new int[32];
        int[] queue = new int[32];
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
                    int candidate = best[u] + 1;
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
        System.out.print((answer) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
            candidate = best[u] + 1
            if candidate > best[v]:
                best[v] = candidate
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)
print(answer)
```

---

## 69. Ancestor Jump Table

GRAPHS · Difficulty 74 · Bounty 740

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted the service hierarchy. Ishan checks the nearest shared ancestor for each pair.

What the code should do
A tree connects all relays and has exactly one route between any two without repeating a relay. Root `0` is the hierarchy's starting point. A relay's ancestors are itself and the relays reached by repeatedly following its parent. Depth is the number of links from root `0`. For each pair `a b`, print the common ancestor with greatest depth, called the lowest common ancestor. If `a == b`, print that relay.

What's going wrong
Pairs at very different depths can return a relay below the actual shared ancestor.

How to read the code
`up` is a jump table: level `k` stores ancestors reached by taking `2` to the power `k` parent steps, staying at root `0` if needed. `depth` stores distances from the root. Queries use these tables to move through ancestors.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `q` (the number of queries).
2. Read `n - 1` parent numbers for relays `1` through `n - 1` in order. These fill level `0` of `up`.
3. Read `q` pairs `a b`, the relays to query.

Output
Print `q` ancestor relay numbers separated by spaces, in query order.

Example explained
In the first sample, parents `0 0 1` belong to relays `1 2 3`. Pair `3 1` has answer `1`, and pair `3 2` has answer `0`, so print `1 0`. The one-relay second sample prints `0`.

Limits
`1 <= n <= 32`; `1 <= q <= 40`. Relays are numbered `0` through `n - 1`. For each relay `v > 0`, its parent number is at least `0` and less than `v`. Query numbers are valid. The supplied six table levels cover these trees.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 2
0 0 1
3 1
3 2
```

Expected output:

```text
1 0
```

Sample 2 input:

```text
1 1

0 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. A level for four parent steps must move farther than a level for two steps.
2. Each jump consists of two jumps of half its length.
3. Build `up[k][v]` as `up[k - 1][up[k - 1][v]]` in Python. In C, C++ and Java, use the same two lookups in the flattened `up` array. Copying one previous-level entry takes only half the required jump.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int up[192] = {0};
    int depth[32] = {0};
    int power[6] = {0};
    power[0] = 1;
    for (int k = 1; k < 6; k++) {
        power[k] = power[k - 1] * 2;
    }
    for (int v = 1; v < n; v++) {
        scanf("%d", &up[v]);
        depth[v] = depth[up[v]] + 1;
    }
    for (int k = 1; k < 6; k++) {
        for (int v = 0; v < n; v++) {
            up[k * 32 + v] = up[(k - 1) * 32 + v];
        }
    }
    for (int query = 0; query < q; query++) {
        int a, b;
        scanf("%d", &a);
        scanf("%d", &b);
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
        printf("%d ", (a));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int up[192] = {0};
    int depth[32] = {0};
    int power[6] = {0};
    power[0] = 1;
    for (int k = 1; k < 6; k++) {
        power[k] = power[k - 1] * 2;
    }
    for (int v = 1; v < n; v++) {
        cin >> up[v];
        depth[v] = depth[up[v]] + 1;
    }
    for (int k = 1; k < 6; k++) {
        for (int v = 0; v < n; v++) {
            up[k * 32 + v] = up[(k - 1) * 32 + v];
        }
    }
    for (int query = 0; query < q; query++) {
        int a, b;
        cin >> a;
        cin >> b;
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
        cout << (a) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] up = new int[192];
        int[] depth = new int[32];
        int[] power = new int[6];
        power[0] = 1;
        for (int k = 1; k < 6; k++) {
            power[k] = power[k - 1] * 2;
        }
        for (int v = 1; v < n; v++) {
            up[v] = scanner.nextInt();
            depth[v] = depth[up[v]] + 1;
        }
        for (int k = 1; k < 6; k++) {
            for (int v = 0; v < n; v++) {
                up[k * 32 + v] = up[(k - 1) * 32 + v];
            }
        }
        for (int query = 0; query < q; query++) {
            int a, b;
            a = scanner.nextInt();
            b = scanner.nextInt();
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
            System.out.print((a) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, q = read_int(), read_int()
up = [[0] * n for _ in range(6)]
depth = [0] * n
for v in range(1, n):
    up[0][v] = read_int()
    depth[v] = depth[up[0][v]] + 1
for k in range(1, 6):
    for v in range(n):
        up[k][v] = up[k - 1][v]
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
```

---

## 70. Moving Root Repair Zones

GRAPHS · Difficulty 83 · Bounty 830

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has changed the command relay. Mira checks load totals under each temporary root.

What the code should do
The two-way cables form a tree: they connect all relays and give exactly one route between any two without repeating a relay. A root sets parent-child directions away from itself. A relay's subtree contains itself and every relay below it in those directions. For query `r x`, temporarily root the tree at `r` and sum signed loads in `x`'s subtree. Negative loads subtract from the sum. If `r == x`, include the whole tree. Queries are independent; loads and cables do not change.

What's going wrong
When the new root lies below the queried relay in the original tree, the answer can omit relays that should count.

How to read the code
`parent` and `subtree` store parents and subtree sums under original root `0`. `total` is the whole-tree load. `r` is the temporary root, and `x` is the relay whose subtree is requested.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `q` (the number of queries).
2. Read `n` signed loads in relay-number order; the code first stores them in `subtree`.
3. Read `n - 1` parent numbers into `parent`, for relays `1` through `n - 1` under root `0`.
4. Read `q` pairs `r x`, temporary root first and queried relay second.

Output
Print `q` subtree load sums separated by spaces, in query order.

Example explained
The first sample is chain `0-1-2` with loads `2 3 5`. For query `2 1`, root `2` makes relays `1` and `0` the requested subtree. Print `5`. The second sample's independent queries print `2 7`.

Limits
`1 <= n <= 32`; `1 <= q <= 40`; loads are from `-1000` through `1000`. Relays are numbered `0` through `n - 1`. For each relay `v > 0`, `0 <= parent[v] < v`. Query relay numbers are valid.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 1
2 3 5
0 1
2 1
```

Expected output:

```text
5
```

Sample 2 input:

```text
3 2
4 2 7
0 0
0 1
1 2
```

Expected output:

```text
2 7
```

### Progressive hints (private until purchased)

1. Draw the tree with the new root below `x` (the queried relay). Which side of `x` still belongs to its subtree?
2. The branch from `x` towards `r` (the new root) lies outside the requested subtree.
3. Find `child`, the direct child of `x` on the original path to `r`. Use `total - subtree[child]`, removing only that branch rather than all of `subtree[x]`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, q;
    scanf("%d", &n);
    scanf("%d", &q);
    int subtree[32] = {0};
    int parent[32] = {0};
    for (int v = 0; v < n; v++) {
        scanf("%d", &subtree[v]);
    }
    for (int v = 1; v < n; v++) {
        scanf("%d", &parent[v]);
    }
    for (int v = n - 1; v > 0; v--) {
        subtree[parent[v]] += subtree[v];
    }
    int total = subtree[0];
    for (int query = 0; query < q; query++) {
        int r, x;
        scanf("%d", &r);
        scanf("%d", &x);
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
                answer = total - subtree[x];
            }
        }
        printf("%d ", (answer));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, q;
    cin >> n;
    cin >> q;
    int subtree[32] = {0};
    int parent[32] = {0};
    for (int v = 0; v < n; v++) {
        cin >> subtree[v];
    }
    for (int v = 1; v < n; v++) {
        cin >> parent[v];
    }
    for (int v = n - 1; v > 0; v--) {
        subtree[parent[v]] += subtree[v];
    }
    int total = subtree[0];
    for (int query = 0; query < q; query++) {
        int r, x;
        cin >> r;
        cin >> x;
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
                answer = total - subtree[x];
            }
        }
        cout << (answer) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, q;
        n = scanner.nextInt();
        q = scanner.nextInt();
        int[] subtree = new int[32];
        int[] parent = new int[32];
        for (int v = 0; v < n; v++) {
            subtree[v] = scanner.nextInt();
        }
        for (int v = 1; v < n; v++) {
            parent[v] = scanner.nextInt();
        }
        for (int v = n - 1; v > 0; v--) {
            subtree[parent[v]] += subtree[v];
        }
        int total = subtree[0];
        for (int query = 0; query < q; query++) {
            int r, x;
            r = scanner.nextInt();
            x = scanner.nextInt();
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
                    answer = total - subtree[x];
                }
            }
            System.out.print((answer) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
            answer = total - subtree[x]
    answers.append(answer)
print(*answers)
```

---

## 71. Equal Price Backbone Fork

GRAPHS · Difficulty 85 · Bounty 850

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has offered cables at equal prices. Ishan checks whether the cheapest complete connection is unique.

What the code should do
A spanning tree is a set of two-way cables connecting every relay with no cycle, meaning no closed route without reusing a cable. A minimum spanning tree has the smallest sum of cable prices. Decide whether exactly one set of physical cables has that minimum sum. Different cable sets count as different trees even when totals tie. Print `-1` if no spanning tree exists. For one relay, the empty cable set is the unique tree.

What's going wrong
The checker can miss equal-price alternatives after cheaper cables have already joined relays.

How to read the code
`parent` stores connected groups while cables are processed by price. `temporary` holds groups used to examine one equal-price batch. `selected` counts chosen cables, and `unique` records the uniqueness result.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays) and `m` (the number of cables).
2. Read `m` triples `u v w`, the endpoints and price of each two-way cable. Records need not be sorted by price.

Output
Print `1` for a unique minimum spanning tree, `0` for more than one, or `-1` for a disconnected network.

Example explained
The first sample is a triangle with all cable prices equal to `2`. Any two cables form a cheapest tree, so print `0`. In the second sample, only the cables priced `1` and `2` give the minimum total, so print `1`.

Limits
`1 <= n <= 16`; `0 <= m <= 40`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`. No cable joins a relay to itself. No endpoint pair is repeated, including in reverse order.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 1 2
1 2 2
0 2 2
```

Expected output:

```text
0
```

Sample 2 input:

```text
3 3
0 1 1
1 2 2
0 2 9
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Equal-price choices depend on connections made with cheaper cables.
2. Two different cables may join the same two groups after cheaper cables have connected their endpoints to other relays.
3. Start `temporary` as a copy of `parent`, preserving all cheaper connections. Test the equal-price batch there before adding that batch to `parent`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int from[40] = {0};
    int to[40] = {0};
    int weight[40] = {0};
    int taken[40] = {0};
    int parent[16] = {0};
    int temporary[16] = {0};
    for (int i = 0; i < m; i++) {
        scanf("%d", &from[i]);
        scanf("%d", &to[i]);
        scanf("%d", &weight[i]);
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
            temporary[i] = i;
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
    printf("%d ", (selected == n - 1 ? unique : -1));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int from[40] = {0};
    int to[40] = {0};
    int weight[40] = {0};
    int taken[40] = {0};
    int parent[16] = {0};
    int temporary[16] = {0};
    for (int i = 0; i < m; i++) {
        cin >> from[i];
        cin >> to[i];
        cin >> weight[i];
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
            temporary[i] = i;
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
    cout << (selected == n - 1 ? unique : -1) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] from = new int[40];
        int[] to = new int[40];
        int[] weight = new int[40];
        int[] taken = new int[40];
        int[] parent = new int[16];
        int[] temporary = new int[16];
        for (int i = 0; i < m; i++) {
            from[i] = scanner.nextInt();
            to[i] = scanner.nextInt();
            weight[i] = scanner.nextInt();
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
                temporary[i] = i;
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
        System.out.print((selected == n - 1 ? unique : -1) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, m = read_int(), read_int()
edges = [(read_int(), read_int(), read_int()) for _ in range(m)]
parent = list(range(n))
taken = [0] * m
processed = 0
selected = 0
unique = 1
while processed < m:
    price = min(edges[i][2] for i in range(m) if taken[i] == 0)
    temporary = list(range(n))
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
```

---

## 72. Undoable Bandwidth Repair

GRAPHS · Difficulty 85 · Bounty 850

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has limited channel capacities. Ishan checks how much traffic the network can carry.

What the code should do
Find the maximum flow from `s` (the source) to `t` (the target). Flow assigns a nonnegative whole number of units to each one-way link, no greater than its capacity. Every other relay must send out exactly as many units as it receives. Maximise the net units leaving `s`, equal to the net units arriving at `t`. Traffic may use several routes. If no route exists, the answer is `0`.

What's going wrong
An early routing choice can block later traffic even though rerouting would allow more units through.

How to read the code
`residual` records capacity available for routing changes, which may send more traffic or cancel earlier traffic. `parent` records a route found by a search, and `flow` stores the total sent so far.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), `s` (the source), and `t` (the target).
2. Read `m` triples `u v capacity`, a link from `u` to `v` only, with its maximum allowed units.

Output
Print one integer: the maximum total flow from the source to the target.

Example explained
In the first sample, links `0 -> 1` and `1 -> 2` have capacities `4` and `2`. The smaller capacity limits total flow to `2`, so print `2`. The second sample has no route to the target and prints `0`.

Limits
`2 <= n <= 12`; `0 <= m <= 30`; `1 <= capacity <= 8`. Relays are numbered `0` through `n - 1`, and `s != t`. No directed link is repeated or joins a relay to itself. Opposite-direction links are allowed and have separate capacities.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 0 2
0 1 4
1 2 2
```

Expected output:

```text
2
```

Sample 2 input:

```text
3 1 0 2
0 1 2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. A later route may need to cancel part of an earlier routing choice.
2. Sending units forward must leave a way to undo those units in the routing-change table.
3. For each routed amount, subtract `amount` from the forward entry in `residual` and add `amount` to its reverse entry. The reverse capacity lets later searches cancel and reroute those units.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s, t;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    scanf("%d", &t);
    int residual[256] = {0};
    int parent[16] = {0};
    int queue[16] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, capacity;
        scanf("%d", &u);
        scanf("%d", &v);
        scanf("%d", &capacity);
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
            residual[v * 16 + u] += 0;
        }
        flow += amount;
    }
    printf("%d ", (flow));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s, t;
    cin >> n;
    cin >> m;
    cin >> s;
    cin >> t;
    int residual[256] = {0};
    int parent[16] = {0};
    int queue[16] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, capacity;
        cin >> u;
        cin >> v;
        cin >> capacity;
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
            residual[v * 16 + u] += 0;
        }
        flow += amount;
    }
    cout << (flow) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s, t;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        t = scanner.nextInt();
        int[] residual = new int[256];
        int[] parent = new int[16];
        int[] queue = new int[16];
        for (int i = 0; i < m; i++) {
            int u, v, capacity;
            u = scanner.nextInt();
            v = scanner.nextInt();
            capacity = scanner.nextInt();
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
                residual[v * 16 + u] += 0;
            }
            flow += amount;
        }
        System.out.print((flow) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
        residual[v][u] += 0
        v = u
    flow += amount
print(flow)
```

---

## 73. Alternating Drone Assignments

GRAPHS · Difficulty 90 · Bounty 900

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has restricted which jobs each drone can perform. Mira checks how many jobs can be assigned.

What the code should do
Find the largest number of allowed drone-job pairs that can be chosen together. Each drone may receive at most one job, and each job may receive at most one drone. Earlier choices may be reassigned. Only the maximum count matters; do not print pairs or choose a preferred arrangement among ties.

What's going wrong
A search can find a free job and move a drone there without assigning the drone that started the search.

How to read the code
The search starts at an unassigned drone and records possible reassignments. Assignment tables are `mateLeft` and `mateRight` in C, C++ and Java; `mate_left` and `mate_right` in Python. A later loop follows the recorded chain backwards.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `left` (the number of drones), `right` (the number of jobs), and `m` (the number of allowed pairs).
2. Read `m` pairs `u v`, meaning drone `u` can perform job `v`. Drones and jobs have separate numbering systems.

Output
Print one integer: the maximum number of assignments. Print `0` if no pair can be chosen.

Example explained
In the first sample, drone `0` can do jobs `0` or `1`, while drone `1` can do only job `0`. Assign jobs `1` and `0` respectively and print `2`. The second sample also permits two assignments and prints `2`.

Limits
`1 <= left <= 16`; `1 <= right <= 16`; `0 <= m <= 160`. Drones are numbered `0` through `left - 1`; jobs are numbered `0` through `right - 1`. Allowed pairs are distinct and valid. The supplied searches and reassignment loops use no recursion.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2 3
0 0
0 1
1 0
```

Expected output:

```text
2
```

Sample 2 input:

```text
3 2 2
0 0
1 1
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Finding a free job may require changing several earlier assignments.
2. When a drone moves to a new job, its old job is where the reassignment chain continues.
3. Save the old job in `previous` before changing the drone's assignment. Read it from `mateLeft[u]` in C, C++ and Java; from `mate_left[u]` in Python. Continue from that saved job.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int left, right, m;
    scanf("%d", &left);
    scanf("%d", &right);
    scanf("%d", &m);
    int edge[256] = {0};
    int mateLeft[16] = {0};
    int mateRight[16] = {0};
    int previousRight[16] = {0};
    int seenLeft[16] = {0};
    int queue[16] = {0};
    for (int i = 0; i < left; i++) {
        mateLeft[i] = -1;
    }
    for (int i = 0; i < right; i++) {
        mateRight[i] = -1;
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
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
            int previous = -1;
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
    printf("%d ", (answer));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int left, right, m;
    cin >> left;
    cin >> right;
    cin >> m;
    int edge[256] = {0};
    int mateLeft[16] = {0};
    int mateRight[16] = {0};
    int previousRight[16] = {0};
    int seenLeft[16] = {0};
    int queue[16] = {0};
    for (int i = 0; i < left; i++) {
        mateLeft[i] = -1;
    }
    for (int i = 0; i < right; i++) {
        mateRight[i] = -1;
    }
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
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
            int previous = -1;
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
    cout << (answer) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int left, right, m;
        left = scanner.nextInt();
        right = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[256];
        int[] mateLeft = new int[16];
        int[] mateRight = new int[16];
        int[] previousRight = new int[16];
        int[] seenLeft = new int[16];
        int[] queue = new int[16];
        for (int i = 0; i < left; i++) {
            mateLeft[i] = -1;
        }
        for (int i = 0; i < right; i++) {
            mateRight[i] = -1;
        }
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                int previous = -1;
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
        System.out.print((answer) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
        previous = -1
        mate_left[u] = end
        mate_right[end] = u
        end = previous
print(sum(job != -1 for job in mate_left))
```

---

## 74. Negative Echo Containment

GRAPHS · Difficulty 96 · Bounty 960

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has added negative link prices. Ishan checks whether the cheapest delivery price is finite.

What the code should do
Find the minimum cost of a directed walk from `s` (the start) to `t` (the target). A walk follows link directions and may repeat relays or links; add all link costs, including repeats. A negative cycle uses at least one link, returns to its start without repeating another relay, and has a strictly negative total cost. Print `UNREACHABLE` if no walk exists. Print `UNBOUNDED` if `s` can reach a negative cycle that can then reach `t`: repeating it makes the cost arbitrarily low. Otherwise print the finite minimum. If `s == t`, the zero-link walk costs `0`, unless such a cycle makes the answer unbounded.

What's going wrong
The target can receive a finite price even when a reachable negative cycle can lower its cost without limit.

How to read the code
`distance` stores costs found by scanning links. `bad` marks relays whose costs have no finite lower limit. Later scans update these marks before the target is classified.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), `s` (the start), and `t` (the target).
2. Read `m` triples `u v w`, a link from `u` to `v` only, with signed cost `w`.

Output
Print the finite minimum cost as an integer, or the exact word `UNREACHABLE` or `UNBOUNDED` for the cases described.

Example explained
In the first sample, start `0` can reach the negative self-link at `1`, but relay `1` cannot reach target `3`. The direct route to `3` still costs `5`, so print `5`. In the second sample, costs `-2` and `5` give finite total `3`, so print `3`.

Limits
`1 <= n <= 32`; `0 <= m <= 160`; `-100 <= w <= 100`. Relays are numbered `0` through `n - 1`. Links are distinct; links from a relay to itself are allowed. `s` may equal `t`. Bounded intermediate values fit signed 32-bit integers.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 3 0 3
0 1 0
1 1 -1
0 3 5
```

Expected output:

```text
5
```

Sample 2 input:

```text
3 2 0 2
0 1 -2
1 2 5
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. A negative cycle may affect a target several links away.
2. The `bad` marks must reach every downstream relay, regardless of input order.
3. Repeat propagation for enough full scans to cover a route of up to `n - 1` links. A single scan can miss downstream links that appear earlier in the input.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s, t;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    scanf("%d", &t);
    int from[160] = {0};
    int to[160] = {0};
    int weight[160] = {0};
    int distance[32] = {0};
    int bad[32] = {0};
    for (int i = 0; i < m; i++) {
        scanf("%d", &from[i]);
        scanf("%d", &to[i]);
        scanf("%d", &weight[i]);
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
    for (int step = 0; step < 1; step++) {
        for (int i = 0; i < m; i++) {
            if (bad[from[i]] != 0) {
                bad[to[i]] = 1;
            }
        }
    }
    if (bad[t] != 0) {
        printf("UNBOUNDED");
    } else if (distance[t] == 1000000) {
        printf("UNREACHABLE");
    } else {
        printf("%d ", (distance[t]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s, t;
    cin >> n;
    cin >> m;
    cin >> s;
    cin >> t;
    int from[160] = {0};
    int to[160] = {0};
    int weight[160] = {0};
    int distance[32] = {0};
    int bad[32] = {0};
    for (int i = 0; i < m; i++) {
        cin >> from[i];
        cin >> to[i];
        cin >> weight[i];
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
    for (int step = 0; step < 1; step++) {
        for (int i = 0; i < m; i++) {
            if (bad[from[i]] != 0) {
                bad[to[i]] = 1;
            }
        }
    }
    if (bad[t] != 0) {
        cout << "UNBOUNDED";
    } else if (distance[t] == 1000000) {
        cout << "UNREACHABLE";
    } else {
        cout << (distance[t]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s, t;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        t = scanner.nextInt();
        int[] from = new int[160];
        int[] to = new int[160];
        int[] weight = new int[160];
        int[] distance = new int[32];
        int[] bad = new int[32];
        for (int i = 0; i < m; i++) {
            from[i] = scanner.nextInt();
            to[i] = scanner.nextInt();
            weight[i] = scanner.nextInt();
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
        for (int step = 0; step < 1; step++) {
            for (int i = 0; i < m; i++) {
                if (bad[from[i]] != 0) {
                    bad[to[i]] = 1;
                }
            }
        }
        if (bad[t] != 0) {
            System.out.print("UNBOUNDED");
        } else if (distance[t] == 1000000) {
            System.out.print("UNREACHABLE");
        } else {
            System.out.print((distance[t]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

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
for step in range(1):
    for u, v, w in edges:
        if bad[u] != 0:
            bad[v] = 1
if bad[t] != 0:
    print('UNBOUNDED')
elif distance[t] == 1000000:
    print('UNREACHABLE')
else:
    print(distance[t])
```

---

## 75. Priced Residual Treaty

GRAPHS · Difficulty 100 · Bounty 1000

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has priced recovery channels. Mira checks the cheapest way to send an exact traffic quota.

What the code should do
Send exactly `need` whole units of flow from `s` (the source) to `t` (the target). Flow assigns a nonnegative whole number of units to each one-way link, up to its capacity. Every other relay must send out exactly as much as it receives. The net units leaving `s` and entering `t` must equal `need`. Minimise the sum, over all links, of units carried times that link's per-unit price. Traffic may use several routes. Print `-1` if the full quota cannot be sent. If `need == 0`, the cost is `0`.

What's going wrong
Changing an earlier route can charge again for a link whose earlier use is being cancelled.

How to read the code
Each input link has a paired reverse entry for cancelling earlier flow. Residual capacity means capacity available for routing changes. Each loop searches for a cheapest available route, then updates `sent` (units sent) and `total` (cost).

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n` (the number of relays), `m` (the number of links), `s` (the source), `t` (the target), and `need` (the exact quota).
2. Read `m` records `u v capacity w`, a link from `u` to `v` only, its capacity, and its per-unit price `w`.

Output
Print one integer: the minimum total cost of sending the full quota, or `-1` if impossible. A zero quota prints `0`.

Example explained
In the first sample, both links can carry two units, at per-unit prices `3` and `4`. Sending the quota costs `2 * (3 + 4) = 14`, so print `14`. In the second sample, capacities allow only one unit but the quota is two, so print `-1`.

Limits
`2 <= n <= 10`; `0 <= m <= 24`; `0 <= need <= 8`; `1 <= capacity <= 8`; `0 <= w <= 1000`. Relays are numbered `0` through `n - 1`, and `s != t`. No directed link is repeated or joins a relay to itself. Opposite-direction links are allowed. The paired representation uses at most `48` entries, and at most eight rounds of sending extra flow are needed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 0 2 2
0 1 3 3
1 2 2 4
```

Expected output:

```text
14
```

Sample 2 input:

```text
3 2 0 2 2
0 1 1 2
1 2 1 1
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Cancelling a link's earlier use should refund its earlier cost.
2. A reverse entry represents undoing flow, so its price must account for the earlier payment.
3. Give the reverse entry price `-w`, where `w` is the original per-unit price. Store it in `price` in C, C++ and Java; in the fourth item of the paired record in `edges` in Python.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, s, t, need;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &s);
    scanf("%d", &t);
    scanf("%d", &need);
    int from[48] = {0};
    int to[48] = {0};
    int residual[48] = {0};
    int price[48] = {0};
    int distance[10] = {0};
    int previousEdge[10] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, capacity, w;
        scanf("%d", &u);
        scanf("%d", &v);
        scanf("%d", &capacity);
        scanf("%d", &w);
        from[2 * i] = u;
        to[2 * i] = v;
        residual[2 * i] = capacity;
        price[2 * i] = w;
        from[2 * i + 1] = v;
        to[2 * i + 1] = u;
        price[2 * i + 1] = w;
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
    printf("%d ", (sent == need ? total : -1));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, s, t, need;
    cin >> n;
    cin >> m;
    cin >> s;
    cin >> t;
    cin >> need;
    int from[48] = {0};
    int to[48] = {0};
    int residual[48] = {0};
    int price[48] = {0};
    int distance[10] = {0};
    int previousEdge[10] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, capacity, w;
        cin >> u;
        cin >> v;
        cin >> capacity;
        cin >> w;
        from[2 * i] = u;
        to[2 * i] = v;
        residual[2 * i] = capacity;
        price[2 * i] = w;
        from[2 * i + 1] = v;
        to[2 * i + 1] = u;
        price[2 * i + 1] = w;
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
    cout << (sent == need ? total : -1) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, s, t, need;
        n = scanner.nextInt();
        m = scanner.nextInt();
        s = scanner.nextInt();
        t = scanner.nextInt();
        need = scanner.nextInt();
        int[] from = new int[48];
        int[] to = new int[48];
        int[] residual = new int[48];
        int[] price = new int[48];
        int[] distance = new int[10];
        int[] previousEdge = new int[10];
        for (int i = 0; i < m; i++) {
            int u, v, capacity, w;
            u = scanner.nextInt();
            v = scanner.nextInt();
            capacity = scanner.nextInt();
            w = scanner.nextInt();
            from[2 * i] = u;
            to[2 * i] = v;
            residual[2 * i] = capacity;
            price[2 * i] = w;
            from[2 * i + 1] = v;
            to[2 * i + 1] = u;
            price[2 * i + 1] = w;
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
        System.out.print((sent == need ? total : -1) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, m, s, t, need = read_int(), read_int(), read_int(), read_int(), read_int()
edges = []
for _ in range(m):
    u, v, capacity, w = read_int(), read_int(), read_int(), read_int()
    edges.append([u, v, capacity, w])
    edges.append([v, u, 0, w])
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
```

---

## 76. Clock Without a Wall

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

### Public samples

Sample 1 input:

```text
3
0 0
1 5
1 2
```

Expected output:

```text
7
```

Sample 2 input:

```text
2
1 9
0 0
```

Expected output:

```text
11
```

### Progressive hints (private until purchased)

1. Try a received event when `clock` is already positive.
2. Two event numbers describe positions in two logs; their values should not be added together.
3. If `remote` is greater than `clock`, assign it to `clock`. Then increment `clock` once for the event.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 77. Recursive Service Latch

LOGIC · Difficulty 29 · Bounty 290

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is checking shared access to a repair routine.

What the code should do
A latch allows only its owning worker to use a resource. It starts free with `owner = -1` and `depth = 0`. ACQUIRE (`op = 1`) succeeds if the latch is free or already owned by `who`, the requesting worker. A successful acquire makes `who` the owner and adds one outstanding acquisition. RELEASE (`op = 2`) succeeds only for the owner and removes one acquisition. The latch becomes free only when none remain. Every failed operation leaves it unchanged and adds one to the failure count.

What's going wrong
Another worker can acquire the latch while its owner still has an outstanding acquisition.

How to read the code
`owner` is the current worker ID, or `-1` when free. `depth` counts that owner's outstanding acquisitions. `denied` counts failed operations.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `q`, the operation count.
2. Read `q` pairs: `op`, the operation code, and `who`, the worker ID. Process them in order.

Output
Print `owner`, `depth`, and `denied`, in that order, separated by spaces.

Example explained
Input `4 1 0 1 0 2 0 1 1` has worker `0` acquire twice and release once. Worker `1` is then denied. Output: `0 1 1`.

Limits
`0 <= q <= 100`. `op` is `1` or `2`. `who` is `0`, `1`, or `2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
1 0
1 0
2 0
1 1
```

Expected output:

```text
0 1 1
```

Sample 2 input:

```text
2
1 2
2 2
```

Expected output:

```text
-1 0 0
```

### Progressive hints (private until purchased)

1. Follow two acquisitions and one release by the same worker.
2. One successful release does not always remove all outstanding acquisitions.
3. After reducing `depth` on an owner release, set `owner` to `-1` only if `depth == 0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int q;
    scanf("%d", &q);
    int owner = -1, depth = 0, denied = 0;
    for (int i = 0; i < q; i++) {
        int op, who;
        scanf("%d", &op);
        scanf("%d", &who);
        if (op == 1 && (owner == -1 || owner == who)) {
            owner = who;
            depth++;
        } else if (op == 2 && owner == who) {
            depth--;
            if (depth >= 0) {
                owner = -1;
            }
        } else {
            denied++;
        }
    }
    printf("%d ", (owner));
    printf("%d ", (depth));
    printf("%d ", (denied));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int q;
    cin >> q;
    int owner = -1, depth = 0, denied = 0;
    for (int i = 0; i < q; i++) {
        int op, who;
        cin >> op;
        cin >> who;
        if (op == 1 && (owner == -1 || owner == who)) {
            owner = who;
            depth++;
        } else if (op == 2 && owner == who) {
            depth--;
            if (depth >= 0) {
                owner = -1;
            }
        } else {
            denied++;
        }
    }
    cout << (owner) << ' ';
    cout << (depth) << ' ';
    cout << (denied) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int q;
        q = scanner.nextInt();
        int owner = -1, depth = 0, denied = 0;
        for (int i = 0; i < q; i++) {
            int op, who;
            op = scanner.nextInt();
            who = scanner.nextInt();
            if (op == 1 && (owner == -1 || owner == who)) {
                owner = who;
                depth++;
            } else if (op == 2 && owner == who) {
                depth--;
                if (depth >= 0) {
                    owner = -1;
                }
            } else {
                denied++;
            }
        }
        System.out.print((owner) + " ");
        System.out.print((depth) + " ");
        System.out.print((denied) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

q = read_int()
owner, depth, denied = -1, 0, 0
for _ in range(q):
    op, who = read_int(), read_int()
    if op == 1 and owner in (-1, who):
        owner = who
        depth += 1
    elif op == 2 and owner == who:
        depth -= 1
        if depth >= 0:
            owner = -1
    else:
        denied += 1
print(owner, depth, denied)
```

---

## 78. Barrier Generations

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

### Public samples

Sample 1 input:

```text
2 3
0 0
1 0
0 1
```

Expected output:

```text
1 1
```

Sample 2 input:

```text
3 3
0 0
0 0
1 0
```

Expected output:

```text
0 2
```

### Progressive hints (private until purchased)

1. Use the same worker in two successive generations.
2. A worker's arrival flag applies to one generation only.
3. When a generation completes, advance `generation`, reset `count`, and clear every entry in `seen`.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 79. Client Receipt Namespaces

LOGIC · Difficulty 34 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan is checking requests from independent clients.

What the code should do
Each client has its own request IDs. Accept the first occurrence of each pair of client ID and request ID. Ignore later occurrences of the same pair, even when their amounts differ. The same request ID from another client is independent. Process requests in order and sum accepted amounts.

What's going wrong
A new request can be ignored because another client used the same request ID.

How to read the code
A namespace is a separate set of names: request IDs belong to individual clients. `seen` records accepted identities, `total` sums their amounts, and `accepted` counts them.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `clients`, the number of clients, and `q`, the request count.
2. Read `q` triples: `client`, the client ID; `request`, its request ID; and `amount`, the amount to add if accepted.

Output
Print `total`, the accepted amount sum, and `accepted`, the request count, separated by a space. An accepted amount of `0` still counts as a request.

Example explained
Input `2 3 0 3 5 0 3 99 1 3 7` accepts amounts `5` and `7`; the `99` request is a retry. Output: `12 2`.

Limits
`1 <= clients <= 8`. `0 <= q <= 100`. `0 <= client < clients`. `0 <= request < 16`. `0 <= amount <= 1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 3
0 3 5
0 3 99
1 3 7
```

Expected output:

```text
12 2
```

Sample 2 input:

```text
1 2
0 0 0
0 0 8
```

Expected output:

```text
0 1
```

### Progressive hints (private until purchased)

1. Let two different clients send the same request ID.
2. A retry must match both `client` and `request`.
3. Use `client * 16 + request` as the index into `seen`, so each client/request pair has its own slot.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int clients, q;
    scanf("%d", &clients);
    scanf("%d", &q);
    int seen[128] = {0};
    int total = 0, accepted = 0;
    for (int i = 0; i < q; i++) {
        int client, request, amount;
        scanf("%d", &client);
        scanf("%d", &request);
        scanf("%d", &amount);
        int key = request;
        if (seen[key] == 0) {
            seen[key] = 1;
            total += amount;
            accepted++;
        }
    }
    printf("%d ", (total));
    printf("%d ", (accepted));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int clients, q;
    cin >> clients;
    cin >> q;
    int seen[128] = {0};
    int total = 0, accepted = 0;
    for (int i = 0; i < q; i++) {
        int client, request, amount;
        cin >> client;
        cin >> request;
        cin >> amount;
        int key = request;
        if (seen[key] == 0) {
            seen[key] = 1;
            total += amount;
            accepted++;
        }
    }
    cout << (total) << ' ';
    cout << (accepted) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int clients, q;
        clients = scanner.nextInt();
        q = scanner.nextInt();
        int[] seen = new int[128];
        int total = 0, accepted = 0;
        for (int i = 0; i < q; i++) {
            int client, request, amount;
            client = scanner.nextInt();
            request = scanner.nextInt();
            amount = scanner.nextInt();
            int key = request;
            if (seen[key] == 0) {
                seen[key] = 1;
                total += amount;
                accepted++;
            }
        }
        System.out.print((total) + " ");
        System.out.print((accepted) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

clients, q = read_int(), read_int()
seen = [0] * 128
total = 0
accepted = 0
for _ in range(q):
    client, request, amount = read_int(), read_int(), read_int()
    key = request
    if seen[key] == 0:
        seen[key] = 1
        total += amount
        accepted += 1
print(total, accepted)
```

---

## 80. Half-Range Sequence Fence

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

### Public samples

Sample 1 input:

```text
250 2
3 131
```

Expected output:

```text
3 1
```

Sample 2 input:

```text
0 2
127 254
```

Expected output:

```text
254 2
```

### Progressive hints (private until purchased)

1. Compare a forward distance of `127` with one of `128`.
2. Exactly half a circle is ambiguous and must be rejected.
3. Accept only when `distance > 0 && distance < 128` in C, C++ and Java, or the equivalent condition in Python.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 81. Binary Residue Gate

LOGIC · Difficulty 40 · Bounty 400

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is checking a binary recovery identifier.

What the code should do
Decide whether `word`, a binary identifier, represents a number divisible by `3`. Binary means base two, using only digits `0` and `1`. Read left to right and maintain only a remainder; do not convert the whole word to a built-in integer. Leading zeros are allowed, and a value of zero is divisible by `3`.

What's going wrong
The result can depend on how many `1` digits appear instead of the number's value.

How to read the code
A residue is the remainder after division. `state` is the remainder for the digits read so far; `bit` is the next digit's numeric value.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `word`, one nonempty sequence of binary digits with no spaces.

Output
Print `YES` if the number is divisible by `3`; otherwise print `NO`.

Example explained
Input `11` is binary for `3`, so output `YES`. Input `10` is binary for `2`, so output `NO`.

Limits
The length of `word` is from `1` to `200`. Every character is `0` or `1`. Use bounded remainder arithmetic rather than whole-word integer conversion.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
11
```

Expected output:

```text
YES
```

Sample 2 input:

```text
10
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Appending a binary digit changes the value of the earlier digits.
2. Appending `bit` doubles the previous number, then adds `bit`.
3. Update the remainder with `state = (2 * state + bit) % 3`; it stays between `0` and `2`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char word[257];
    scanf("%256s", word);
    int state = 0;
    for (int i = 0; i < (int)strlen(word); i++) {
        int bit = word[i] - '0';
        state = (state + bit) % 3;
    }
    if (state == 0) {
        printf("YES");
    } else {
        printf("NO");
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string word;
    cin >> word;
    int state = 0;
    for (int i = 0; i < (int)word.size(); i++) {
        int bit = word[i] - '0';
        state = (state + bit) % 3;
    }
    if (state == 0) {
        cout << "YES";
    } else {
        cout << "NO";
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String word;
        word = scanner.next();
        int state = 0;
        for (int i = 0; i < word.length(); i++) {
            int bit = word.charAt(i) - '0';
            state = (state + bit) % 3;
        }
        if (state == 0) {
            System.out.print("YES");
        } else {
            System.out.print("NO");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

word = read_word()
state = 0
for digit in word:
    bit = int(digit)
    state = (state + bit) % 3
print("YES" if state == 0 else "NO")
```

---

## 82. Quiet Shift Planner

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

### Public samples

Sample 1 input:

```text
3
5 6 5
```

Expected output:

```text
10
```

Sample 2 input:

```text
1
8
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. If today is chosen, can yesterday also be chosen?
2. The best total through yesterday may include yesterday's repair.
3. Build today's `take` from yesterday's `skip` only. Build today's `skip` from the larger old state, using saved values for both updates.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

## 83. Borrowed Quantum

LOGIC · Difficulty 45 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is checking when shared-processor jobs finish.

What the code should do
All `n` jobs are ready at time `0`. Visit jobs `0` through `n - 1` repeatedly, skipping completed jobs. On each turn, run a job for its remaining work or `quantum`, whichever is smaller. The quantum is the maximum length of one turn. Time advances only by work actually done; switching jobs costs no time. Record the elapsed time at each job's completion.

What's going wrong
A short final turn can add too much time to the completion report.

How to read the code
This repeating turn order is called round-robin scheduling. `remaining` holds unfinished work, `elapsed` is time used, and `finished` holds completion times.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the job count, and `quantum`, the maximum work per turn.
2. Read `remaining[0]` through `remaining[n - 1]`, the initial work of each job in job ID order.

Output
Print the `n` completion times from `finished` in job ID order, separated by spaces.

Example explained
Input `2 3 4 2` uses turns of `3`, `2`, then `1` time units. Job `1` finishes at `5`; job `0` finishes at `6`. Output: `6 5`.

Limits
`1 <= n <= 20`. `1 <= quantum <= 20`. Each initial work value is from `1` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 3
4 2
```

Expected output:

```text
6 5
```

Sample 2 input:

```text
2 2
2 4
```

Expected output:

```text
2 6
```

### Progressive hints (private until purchased)

1. Try a job whose remaining work is smaller than `quantum`.
2. The time added must match the work removed on that turn.
3. Set `used` to the smaller of `quantum` and remaining work. Add `used` to `elapsed` before recording completion.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, quantum;
    scanf("%d", &n);
    scanf("%d", &quantum);
    int remaining[20] = {0};
    int finished[20] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &remaining[i]);
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
                elapsed += quantum;
                if (remaining[i] == 0) {
                    finished[i] = elapsed;
                    left--;
                }
            }
        }
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (finished[i]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, quantum;
    cin >> n;
    cin >> quantum;
    int remaining[20] = {0};
    int finished[20] = {0};
    for (int i = 0; i < n; i++) {
        cin >> remaining[i];
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
                elapsed += quantum;
                if (remaining[i] == 0) {
                    finished[i] = elapsed;
                    left--;
                }
            }
        }
    }
    for (int i = 0; i < n; i++) {
        cout << (finished[i]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, quantum;
        n = scanner.nextInt();
        quantum = scanner.nextInt();
        int[] remaining = new int[20];
        int[] finished = new int[20];
        for (int i = 0; i < n; i++) {
            remaining[i] = scanner.nextInt();
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
                    elapsed += quantum;
                    if (remaining[i] == 0) {
                        finished[i] = elapsed;
                        left--;
                    }
                }
            }
        }
        for (int i = 0; i < n; i++) {
            System.out.print((finished[i]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, quantum = read_int(), read_int()
remaining = [read_int() for _ in range(n)]
finished = [0] * n
left = n
elapsed = 0
while left > 0:
    for i in range(n):
        if remaining[i] > 0:
            used = min(quantum, remaining[i])
            remaining[i] -= used
            elapsed += quantum
            if remaining[i] == 0:
                finished[i] = elapsed
                left -= 1
print(*finished)
```

---

## 84. One-Use Repair Kits

LOGIC · Difficulty 48 · Bounty 480

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is choosing physical repair kits within a budget.

What the code should do
Choose a subset of the `n` kits with total cost at most `budget`. A subset chooses each input kit at most once. Kits on different input rows are different kits, even if their costs and values match. Maximize the sum of values. Choosing none is allowed and gives `0`.

What's going wrong
The reported value can use the same physical kit more than once.

How to read the code
`best[b]` is the largest value possible with spending at most `b`. Each input pair gives one kit's `cost` and `value`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the kit count, and `budget`, the spending limit.
2. Read `n` pairs: `cost`, then `value`, for one kit each.

Output
Print the maximum total value within `budget`. No list of kits is required.

Example explained
Input `1 4 2 5` offers one kit costing `2` with value `5`. It can be chosen once despite the budget of `4`. Output: `5`.

Limits
`0 <= n <= 16`. `0 <= budget <= 100`. `1 <= cost <= 100`. `0 <= value <= 1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 4
2 5
```

Expected output:

```text
5
```

Sample 2 input:

```text
2 3
2 5
3 8
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. Use one kit and a budget large enough to pay for it twice.
2. An update must not extend a result that already used the current kit.
3. For each kit, visit budget values from high to low, so `best[b - cost]` still excludes that kit.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, budget;
    scanf("%d", &n);
    scanf("%d", &budget);
    int best[101] = {0};
    for (int i = 0; i < n; i++) {
        int cost, value;
        scanf("%d", &cost);
        scanf("%d", &value);
        for (int b = cost; b <= budget; b++) {
            int candidate = best[b - cost] + value;
            if (candidate > best[b]) {
                best[b] = candidate;
            }
        }
    }
    printf("%d ", (best[budget]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, budget;
    cin >> n;
    cin >> budget;
    int best[101] = {0};
    for (int i = 0; i < n; i++) {
        int cost, value;
        cin >> cost;
        cin >> value;
        for (int b = cost; b <= budget; b++) {
            int candidate = best[b - cost] + value;
            if (candidate > best[b]) {
                best[b] = candidate;
            }
        }
    }
    cout << (best[budget]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, budget;
        n = scanner.nextInt();
        budget = scanner.nextInt();
        int[] best = new int[101];
        for (int i = 0; i < n; i++) {
            int cost, value;
            cost = scanner.nextInt();
            value = scanner.nextInt();
            for (int b = cost; b <= budget; b++) {
                int candidate = best[b - cost] + value;
                if (candidate > best[b]) {
                    best[b] = candidate;
                }
            }
        }
        System.out.print((best[budget]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, budget = read_int(), read_int()
best = [0] * (budget + 1)
for _ in range(n):
    cost, value = read_int(), read_int()
    for b in range(cost, budget + 1):
        candidate = best[b - cost] + value
        if candidate > best[b]:
            best[b] = candidate
print(best[budget])
```

---

## 85. Unordered Power Credits

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

### Public samples

Sample 1 input:

```text
2 3
1 2
```

Expected output:

```text
2
```

Sample 2 input:

```text
1 3
2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. List the payments for amount `3` using denominations `1` and `2`.
2. Each combination of credit counts must be built in only one denomination order.
3. Put the denomination loop outside the amount loop. For each denomination, update totals upward to allow unlimited copies without counting insertion orders.

### c buggy starter

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

### cpp buggy starter

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

### java buggy starter

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

### python buggy starter

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

---

## 86. Snapshot Write Sets

LOGIC · Difficulty 52 · Bounty 520

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is checking concurrent edits to stored settings.

What the code should do
A transaction is a group of private edits; a snapshot is its copy of the stored values at BEGIN. Process operations in order. BEGIN (`op = 0`) takes a snapshot. WRITE (`op = 1`) changes one private cell. READ (`op = 2`) reports that private value, including the transaction's own writes. COMMIT (`op = 3`) publishes only cells the transaction wrote, then ends it. Other stored cells stay unchanged. No commit is rejected; if several transactions write one cell, the later commit wins for that cell.

What's going wrong
Committing a transaction can overwrite a newer stored value in a cell it never wrote.

How to read the code
`current` holds committed values, meaning values already published. `saved` holds private copies. A `dirty` flag marks a cell written by that transaction. `t` identifies the transaction.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `m`, the cell count, `transactions`, the transaction count, and `q`, the operation count.
2. Read `m` initial values for `current`, in cell ID order.
3. Read `q` rows: `op`, `t`, `cell`, `value`. For BEGIN and COMMIT, the last two values are ignored `0 0`. For READ, `value` is ignored `0`.

Output
Print READ results in operation order, then all `m` final committed values in cell ID order. Separate all output values with whitespace. BEGIN, WRITE, and COMMIT print nothing.

Example explained
In the first sample, both transactions start from `0 0`. Transaction `0` commits `7` to cell `0`; transaction `1` commits `9` only to cell `1`. Its older copy of cell `0` has no effect. Output: `7 9`.

Limits
`1 <= m, transactions <= 8`. `0 <= q <= 100`. `0 <= t < transactions`; `0 <= cell < m`. `op` is `0`, `1`, `2`, or `3`. Values are from `0` to `1000`. Each used transaction begins once; reads and writes occur only while active, before its only COMMIT, if any. Unused transaction IDs and unfinished transactions are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2 6
0 0
0 0 0 0
0 1 0 0
1 0 0 7
3 0 0 0
1 1 1 9
3 1 0 0
```

Expected output:

```text
7 9
```

Sample 2 input:

```text
1 1 4
5
0 0 0 0
1 0 0 8
2 0 0 0
3 0 0 0
```

Expected output:

```text
8 8
```

### Progressive hints (private until purchased)

1. Start two transactions before either commits, then have them write different cells.
2. A private snapshot may contain old values in cells that were never written.
3. At COMMIT, copy `saved` back to `current` only where that transaction's `dirty` flag is set.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int m, transactions, q;
    scanf("%d", &m);
    scanf("%d", &transactions);
    scanf("%d", &q);
    int current[8] = {0};
    int saved[64] = {0};
    int dirty[64] = {0};
    for (int j = 0; j < m; j++) {
        scanf("%d", &current[j]);
    }
    for (int i = 0; i < q; i++) {
        int op, t, cell, value;
        scanf("%d", &op);
        scanf("%d", &t);
        scanf("%d", &cell);
        scanf("%d", &value);
        if (op == 0) {
            for (int j = 0; j < m; j++) {
                saved[t * m + j] = current[j];
                dirty[t * m + j] = 0;
            }
        } else if (op == 1) {
            saved[t * m + cell] = value;
            dirty[t * m + cell] = 1;
        } else if (op == 2) {
            printf("%d ", (saved[t * m + cell]));
        } else {
            for (int j = 0; j < m; j++) {
                if (dirty[t * m + j] >= 0) {
                    current[j] = saved[t * m + j];
                }
            }
        }
    }
    for (int j = 0; j < m; j++) {
        printf("%d ", (current[j]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int m, transactions, q;
    cin >> m;
    cin >> transactions;
    cin >> q;
    int current[8] = {0};
    int saved[64] = {0};
    int dirty[64] = {0};
    for (int j = 0; j < m; j++) {
        cin >> current[j];
    }
    for (int i = 0; i < q; i++) {
        int op, t, cell, value;
        cin >> op;
        cin >> t;
        cin >> cell;
        cin >> value;
        if (op == 0) {
            for (int j = 0; j < m; j++) {
                saved[t * m + j] = current[j];
                dirty[t * m + j] = 0;
            }
        } else if (op == 1) {
            saved[t * m + cell] = value;
            dirty[t * m + cell] = 1;
        } else if (op == 2) {
            cout << (saved[t * m + cell]) << ' ';
        } else {
            for (int j = 0; j < m; j++) {
                if (dirty[t * m + j] >= 0) {
                    current[j] = saved[t * m + j];
                }
            }
        }
    }
    for (int j = 0; j < m; j++) {
        cout << (current[j]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int m, transactions, q;
        m = scanner.nextInt();
        transactions = scanner.nextInt();
        q = scanner.nextInt();
        int[] current = new int[8];
        int[] saved = new int[64];
        int[] dirty = new int[64];
        for (int j = 0; j < m; j++) {
            current[j] = scanner.nextInt();
        }
        for (int i = 0; i < q; i++) {
            int op, t, cell, value;
            op = scanner.nextInt();
            t = scanner.nextInt();
            cell = scanner.nextInt();
            value = scanner.nextInt();
            if (op == 0) {
                for (int j = 0; j < m; j++) {
                    saved[t * m + j] = current[j];
                    dirty[t * m + j] = 0;
                }
            } else if (op == 1) {
                saved[t * m + cell] = value;
                dirty[t * m + cell] = 1;
            } else if (op == 2) {
                System.out.print((saved[t * m + cell]) + " ");
            } else {
                for (int j = 0; j < m; j++) {
                    if (dirty[t * m + j] >= 0) {
                        current[j] = saved[t * m + j];
                    }
                }
            }
        }
        for (int j = 0; j < m; j++) {
            System.out.print((current[j]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

m, transactions, q = read_int(), read_int(), read_int()
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
            if dirty[t * m + j] >= 0:
                current[j] = saved[t * m + j]
print(*current)
```

---

## 87. Causal Fingerprints

LOGIC · Difficulty 54 · Bounty 540

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan is comparing event records from several services.

What the code should do
A vector clock is a list of event counts, one per service. Compare `a` and `b` at matching positions. The result is `EQUAL` if all components match. It is `BEFORE` if every component of `a` is at most the matching component of `b`, and at least one is smaller. Use `AFTER` for the reverse relation. In all other cases use `CONCURRENT`, meaning neither vector is entirely before the other.

What's going wrong
A vector can be reported as earlier even though one of its components is later.

How to read the code
`a` and `b` are compared component by component, not as whole numbers or sums. `less` and `greater` count comparisons pointing in each direction.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of components in each vector.
2. Read all `n` components of `a`.
3. Read all `n` components of `b`, in matching service order.

Output
Print exactly one of `EQUAL`, `BEFORE`, `AFTER`, or `CONCURRENT`.

Example explained
Input `2 1 2 2 1` gives `a = (1, 2)` and `b = (2, 1)`. Each is ahead in one component. Output: `CONCURRENT`.

Limits
`1 <= n <= 16`. Each component of `a` and `b` is from `0` to `1000000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
1 2
2 1
```

Expected output:

```text
CONCURRENT
```

Sample 2 input:

```text
2
1 2
1 3
```

Expected output:

```text
BEFORE
```

### Progressive hints (private until purchased)

1. Try vectors where each is smaller in a different position.
2. One smaller component cannot prove `BEFORE` if another component is greater.
3. Require `less > 0` and `greater == 0` for `BEFORE`. Reverse the checks for `AFTER`; no differences means `EQUAL`, and mixed directions mean `CONCURRENT`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[16] = {0};
    int b[16] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int i = 0; i < n; i++) {
        scanf("%d", &b[i]);
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
    if (less > 0) {
        printf("BEFORE");
    } else if (greater > 0 && less == 0) {
        printf("AFTER");
    } else if (less == 0 && greater == 0) {
        printf("EQUAL");
    } else {
        printf("CONCURRENT");
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a[16] = {0};
    int b[16] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int i = 0; i < n; i++) {
        cin >> b[i];
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
    if (less > 0) {
        cout << "BEFORE";
    } else if (greater > 0 && less == 0) {
        cout << "AFTER";
    } else if (less == 0 && greater == 0) {
        cout << "EQUAL";
    } else {
        cout << "CONCURRENT";
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] a = new int[16];
        int[] b = new int[16];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int i = 0; i < n; i++) {
            b[i] = scanner.nextInt();
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
        if (less > 0) {
            System.out.print("BEFORE");
        } else if (greater > 0 && less == 0) {
            System.out.print("AFTER");
        } else if (less == 0 && greater == 0) {
            System.out.print("EQUAL");
        } else {
            System.out.print("CONCURRENT");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
a = [read_int() for _ in range(n)]
b = [read_int() for _ in range(n)]
less = 0
greater = 0
for i in range(n):
    if a[i] < b[i]:
        less += 1
    if a[i] > b[i]:
        greater += 1
if less > 0:
    print("BEFORE")
elif greater > 0 and less == 0:
    print("AFTER")
elif less == 0 and greater == 0:
    print("EQUAL")
else:
    print("CONCURRENT")
```

---

## 88. The First Release Rule

LOGIC · Difficulty 56 · Bounty 560

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is checking requests for exclusive access to resources.

What the code should do
A lock grants exclusive access to one transaction, a group of operations. All locks start free. ACQUIRE (`op = 1`) succeeds only if the lock is free and the transaction has never successfully released any lock. Acquiring a lock already owned by that same transaction also fails. RELEASE (`op = 2`) succeeds only for the owner, frees the lock, and permanently prevents that transaction from acquiring any lock again. It may still release its other locks. Count failed operations; they have no other effect. Process operations in order.

What's going wrong
A transaction can release one lock and then acquire another while still holding an older lock.

How to read the code
`owner` stores each lock's transaction ID, or `-1` when free. `shrinking` marks a transaction in its release-only phase. `denied` counts failed operations.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `transactions`, the transaction count, `m`, the lock count, and `q`, the operation count.
2. Read `q` triples: `op`, the operation; `t`, the transaction ID; and `lock`, the lock ID.

Output
Print `denied`, then each lock's final `owner` in lock ID order, separated by spaces. Use `-1` for a free lock.

Example explained
Input `1 3 4 1 0 0 1 0 1 2 0 0 1 0 2` lets transaction `0` acquire locks `0` and `1`, then release lock `0`. Its later acquisition of lock `2` fails. Output: `1 -1 0 -1`.

Limits
`1 <= transactions, m <= 8`. `0 <= q <= 100`. `0 <= t < transactions`. `0 <= lock < m`. `op` is `1` or `2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 3 4
1 0 0
1 0 1
2 0 0
1 0 2
```

Expected output:

```text
1 -1 0 -1
```

Sample 2 input:

```text
1 1 3
1 0 0
2 0 0
1 0 0
```

Expected output:

```text
1 -1
```

### Progressive hints (private until purchased)

1. Release one lock while the transaction still holds another, then try a new acquisition.
2. The phase changes at the first successful release, regardless of how many locks remain.
3. Set `shrinking[t]` after every successful release. Do not wait for `held[t]`, the held-lock count, to reach `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int transactions, m, q;
    scanf("%d", &transactions);
    scanf("%d", &m);
    scanf("%d", &q);
    int owner[8] = {0};
    int held[8] = {0};
    int shrinking[8] = {0};
    for (int i = 0; i < m; i++) {
        owner[i] = -1;
    }
    int denied = 0;
    for (int i = 0; i < q; i++) {
        int op, t, lock;
        scanf("%d", &op);
        scanf("%d", &t);
        scanf("%d", &lock);
        if (op == 1 && shrinking[t] == 0 && owner[lock] == -1) {
            owner[lock] = t;
            held[t]++;
        } else if (op == 2 && owner[lock] == t) {
            owner[lock] = -1;
            held[t]--;
            shrinking[t] = held[t] == 0 ? 1 : 0;
        } else {
            denied++;
        }
    }
    printf("%d ", (denied));
    for (int i = 0; i < m; i++) {
        printf("%d ", (owner[i]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int transactions, m, q;
    cin >> transactions;
    cin >> m;
    cin >> q;
    int owner[8] = {0};
    int held[8] = {0};
    int shrinking[8] = {0};
    for (int i = 0; i < m; i++) {
        owner[i] = -1;
    }
    int denied = 0;
    for (int i = 0; i < q; i++) {
        int op, t, lock;
        cin >> op;
        cin >> t;
        cin >> lock;
        if (op == 1 && shrinking[t] == 0 && owner[lock] == -1) {
            owner[lock] = t;
            held[t]++;
        } else if (op == 2 && owner[lock] == t) {
            owner[lock] = -1;
            held[t]--;
            shrinking[t] = held[t] == 0 ? 1 : 0;
        } else {
            denied++;
        }
    }
    cout << (denied) << ' ';
    for (int i = 0; i < m; i++) {
        cout << (owner[i]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int transactions, m, q;
        transactions = scanner.nextInt();
        m = scanner.nextInt();
        q = scanner.nextInt();
        int[] owner = new int[8];
        int[] held = new int[8];
        int[] shrinking = new int[8];
        for (int i = 0; i < m; i++) {
            owner[i] = -1;
        }
        int denied = 0;
        for (int i = 0; i < q; i++) {
            int op, t, lock;
            op = scanner.nextInt();
            t = scanner.nextInt();
            lock = scanner.nextInt();
            if (op == 1 && shrinking[t] == 0 && owner[lock] == -1) {
                owner[lock] = t;
                held[t]++;
            } else if (op == 2 && owner[lock] == t) {
                owner[lock] = -1;
                held[t]--;
                shrinking[t] = held[t] == 0 ? 1 : 0;
            } else {
                denied++;
            }
        }
        System.out.print((denied) + " ");
        for (int i = 0; i < m; i++) {
            System.out.print((owner[i]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

transactions, m, q = read_int(), read_int(), read_int()
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
        shrinking[t] = int(held[t] == 0)
    else:
        denied += 1
print(denied, *owner)
```

---

## 89. Borrowed Resources Return

LOGIC · Difficulty 59 · Bounty 590

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan is checking whether every service can finish with limited resources.

What the code should do
For each service and resource type, `allocation` is the amount already held, and `maximum` is the largest total it may need. Its remaining need is `maximum - allocation`. In a simulated completion order, a service can finish if every remaining need is at most the corresponding free amount. After finishing, it releases its originally held resources. Decide whether some completion order lets all services finish. No real services run.

What's going wrong
The simulation can gain or lose resources incorrectly when a service finishes.

How to read the code
A resource vector is a list of counts, one per resource type. `work` is the currently free vector in the simulation. `done` marks services already finished.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the service count, and `m`, the resource-type count.
2. Read `m` initial free counts into `work`, in resource-type order.
3. Read `n` rows of `m` counts for `allocation`, in service order.
4. Read `n` rows of `m` counts for `maximum`, in the same order.

Output
Print `SAFE` if at least one order lets every service finish; otherwise print `UNSAFE`. Do not print an order.

Example explained
Input `2 1 1 2 0 2 3` has one free unit. Service `0` already holds its maximum of `2`; finishing it makes `3` units free, enough for service `1`. Output: `SAFE`.

Limits
`1 <= n <= 7`. `1 <= m <= 4`. For each service/type pair, `0 <= allocation <= maximum <= 20`. Each initial free count is from `0` to `20`. Service and resource-type indices start at `0`. A maximum claim may exceed the total resources present.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1
1
2
0
2
3
```

Expected output:

```text
SAFE
```

Sample 2 input:

```text
2 1
0
1
1
2
2
```

Expected output:

```text
UNSAFE
```

### Progressive hints (private until purchased)

1. Compare what a service still needs with what it already holds.
2. Temporarily lending the remaining need and getting it back cancel out. The net gain comes from the resources held before completion.
3. After a feasible service finishes, add its original `allocation` to `work`, not its remaining need.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int work[4] = {0};
    int allocation[28] = {0};
    int maximum[28] = {0};
    int done[7] = {0};
    for (int j = 0; j < m; j++) {
        scanf("%d", &work[j]);
    }
    for (int i = 0; i < n * m; i++) {
        scanf("%d", &allocation[i]);
    }
    for (int i = 0; i < n * m; i++) {
        scanf("%d", &maximum[i]);
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
                    work[j] += maximum[i * m + j] - allocation[i * m + j];
                }
            }
        }
    }
    if (finished == n) {
        printf("SAFE");
    } else {
        printf("UNSAFE");
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m;
    cin >> n;
    cin >> m;
    int work[4] = {0};
    int allocation[28] = {0};
    int maximum[28] = {0};
    int done[7] = {0};
    for (int j = 0; j < m; j++) {
        cin >> work[j];
    }
    for (int i = 0; i < n * m; i++) {
        cin >> allocation[i];
    }
    for (int i = 0; i < n * m; i++) {
        cin >> maximum[i];
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
                    work[j] += maximum[i * m + j] - allocation[i * m + j];
                }
            }
        }
    }
    if (finished == n) {
        cout << "SAFE";
    } else {
        cout << "UNSAFE";
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] work = new int[4];
        int[] allocation = new int[28];
        int[] maximum = new int[28];
        int[] done = new int[7];
        for (int j = 0; j < m; j++) {
            work[j] = scanner.nextInt();
        }
        for (int i = 0; i < n * m; i++) {
            allocation[i] = scanner.nextInt();
        }
        for (int i = 0; i < n * m; i++) {
            maximum[i] = scanner.nextInt();
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
                        work[j] += maximum[i * m + j] - allocation[i * m + j];
                    }
                }
            }
        }
        if (finished == n) {
            System.out.print("SAFE");
        } else {
            System.out.print("UNSAFE");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, m = read_int(), read_int()
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
                work[j] += maximum[i * m + j] - allocation[i * m + j]
print("SAFE" if finished == n else "UNSAFE")
```

---

## 90. Distinct Recovery Phrases

LOGIC · Difficulty 61 · Bounty 610

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is counting texts recoverable from a damaged word.

What the code should do
A subsequence is made by deleting any positions from `word` while keeping the remaining letters in their original order. Count distinct resulting texts, including the empty text. The same text counts once even when different position choices produce it. Print the remainder after division by `1000000007`.

What's going wrong
Repeated letters cause the program to remove the wrong number of duplicate texts.

How to read the code
A prefix is the first part of a word. `ways[i]` counts texts from the first `i` letters, including empty text. `last` records prior positions using one-based positions: the first letter is at `1`, and `0` means unseen.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `word`, one nonempty word of lowercase English letters.

Output
Print the number of distinct subsequence texts modulo `1000000007`; modulo means the nonnegative remainder after division.

Example explained
Input `aba` gives the empty text and `a`, `b`, `aa`, `ab`, `ba`, `aba`. Output: `7`.

Limits
The length of `word` is from `1` to `60`. Each letter is from `a` to `z`. Remainder arithmetic must give the same nonnegative result in every supported language.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
aba
```

Expected output:

```text
7
```

Sample 2 input:

```text
abc
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. In `aba`, both copies of `a` can produce some of the same texts.
2. Appending a letter creates duplicates when that letter has appeared before. Identify which earlier prefix produced them.
3. For a repeated letter, subtract `ways[last[ch] - 1]` from the doubled previous count. Normalize the remainder and then record the new last position.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char word[257];
    scanf("%256s", word);
    int last[26] = {0};
    long long ways[61] = {0};
    ways[0] = 1;
    for (int i = 1; i <= (int)strlen(word); i++) {
        int ch = word[i - 1] - 'a';
        long long value = 2 * ways[i - 1];
        if (last[ch] > 0) {
            value -= ways[last[ch]];
        }
        ways[i] = (value + 1000000007LL) % 1000000007LL;
        last[ch] = i;
    }
    printf("%lld ", (long long)(ways[(int)strlen(word)]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    string word;
    cin >> word;
    int last[26] = {0};
    long long ways[61] = {0};
    ways[0] = 1;
    for (int i = 1; i <= (int)word.size(); i++) {
        int ch = word[i - 1] - 'a';
        long long value = 2 * ways[i - 1];
        if (last[ch] > 0) {
            value -= ways[last[ch]];
        }
        ways[i] = (value + 1000000007LL) % 1000000007LL;
        last[ch] = i;
    }
    cout << (ways[(int)word.size()]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String word;
        word = scanner.next();
        int[] last = new int[26];
        long[] ways = new long[61];
        ways[0] = 1;
        for (int i = 1; i <= word.length(); i++) {
            int ch = word.charAt(i - 1) - 'a';
            long value = 2 * ways[i - 1];
            if (last[ch] > 0) {
                value -= ways[last[ch]];
            }
            ways[i] = (value + 1000000007L) % 1000000007L;
            last[ch] = i;
        }
        System.out.print((ways[word.length()]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

word = read_word()
last = [0] * 26
ways = [0] * (len(word) + 1)
ways[0] = 1
for i in range(1, len(word) + 1):
    ch = ord(word[i - 1]) - ord('a')
    value = 2 * ways[i - 1]
    if last[ch] > 0:
        value -= ways[last[ch]]
    ways[i] = (value + 1000000007) % 1000000007
    last[ch] = i
print(ways[len(word)])
```

---

## 91. Compatible Maintenance Windows

LOGIC · Difficulty 63 · Bounty 630

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is choosing jobs for one repair channel.

What the code should do
Choose optional jobs with the largest total reward, with no overlapping execution times. A job occupies the half-open interval `[start, end)`: it includes `start` and excludes `end`. One job may therefore start exactly when another ends. Input jobs are already ordered by increasing or equal end time. Choosing no jobs is allowed.

What's going wrong
The reported reward can include jobs that overlap.

How to read the code
`best[i]` is the best reward using the first `i` input jobs. The supplied code numbers jobs from `1`. `previous` identifies an earlier prefix, meaning the first part of that list. No job list is required in the output.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the job count.
2. Read `n` triples: `start`, `end`, `reward`. End times are nondecreasing; jobs with equal end times may be in any order.

Output
Print the largest total reward of compatible jobs. With no jobs, print `0`.

Example explained
Input `3 0 3 8 1 4 9 3 5 7` allows the first and third jobs together because one ends where the other starts. Output: `15`.

Limits
`0 <= n <= 16`. Each job has `0 <= start < end <= 100` and `0 <= reward <= 1000`. End times never decrease.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
0 3 8
1 4 9
3 5 7
```

Expected output:

```text
15
```

Sample 2 input:

```text
2
0 1 4
1 2 5
```

Expected output:

```text
9
```

### Progressive hints (private until purchased)

1. Taking a job can rule out jobs included in the previous best total.
2. Use the earlier prefix whose jobs all end no later than the current start.
3. Compare skipping job `i` with `best[previous]` plus its reward, rather than extending `best[i - 1]` when taking it.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int start[17] = {0};
    int end[17] = {0};
    int reward[17] = {0};
    int best[17] = {0};
    for (int i = 1; i <= n; i++) {
        scanf("%d", &start[i]);
        scanf("%d", &end[i]);
        scanf("%d", &reward[i]);
        int previous = i - 1;
        while (previous > 0 && end[previous] > start[i]) {
            previous--;
        }
        int candidate = best[i - 1] + reward[i];
        best[i] = best[i - 1];
        if (candidate > best[i]) {
            best[i] = candidate;
        }
    }
    printf("%d ", (best[n]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int start[17] = {0};
    int end[17] = {0};
    int reward[17] = {0};
    int best[17] = {0};
    for (int i = 1; i <= n; i++) {
        cin >> start[i];
        cin >> end[i];
        cin >> reward[i];
        int previous = i - 1;
        while (previous > 0 && end[previous] > start[i]) {
            previous--;
        }
        int candidate = best[i - 1] + reward[i];
        best[i] = best[i - 1];
        if (candidate > best[i]) {
            best[i] = candidate;
        }
    }
    cout << (best[n]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] start = new int[17];
        int[] end = new int[17];
        int[] reward = new int[17];
        int[] best = new int[17];
        for (int i = 1; i <= n; i++) {
            start[i] = scanner.nextInt();
            end[i] = scanner.nextInt();
            reward[i] = scanner.nextInt();
            int previous = i - 1;
            while (previous > 0 && end[previous] > start[i]) {
                previous--;
            }
            int candidate = best[i - 1] + reward[i];
            best[i] = best[i - 1];
            if (candidate > best[i]) {
                best[i] = candidate;
            }
        }
        System.out.print((best[n]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
end = [0] * (n + 1)
best = [0] * (n + 1)
for i in range(1, n + 1):
    start, end[i], reward = read_int(), read_int(), read_int()
    previous = i - 1
    while previous > 0 and end[previous] > start:
        previous -= 1
    candidate = best[i - 1] + reward
    best[i] = max(best[i - 1], candidate)
print(best[n])
```

---

## 92. Composite-Modulus Rosters

LOGIC · Difficulty 65 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan is counting possible teams of operators.

What the code should do
Choose exactly `k` different operators from `n` distinct operators. Order does not matter. Print the number of choices modulo `modulus`, meaning the remainder after division by `modulus`. Choosing no operators gives one choice. The divisor may be composite, meaning it has factors other than one and itself.

What's going wrong
The program can lose valid choices when dividing a value that was already reduced to a remainder.

How to read the code
`count` represents the number of choices, and `modulus` is the requested output divisor. The supplied loop uses multiplication and whole-number division.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the operator count, `k`, the team size, and `modulus`, the output divisor.

Output
Print the nonnegative remainder of the number of teams after division by `modulus`.

Example explained
Input `4 2 4` has `6` different teams before taking the remainder. Output: `2`.

Limits
`0 <= k <= n <= 50`. `2 <= modulus <= 1000000000`. Every exact intermediate multiplication in the supplied recurrence fits a signed 64-bit integer.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 2 4
```

Expected output:

```text
2
```

Sample 2 input:

```text
5 1 3
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Compare dividing an exact count with dividing its remainder.
2. For an arbitrary divisor, taking a remainder before an integer division can change the final result.
3. Keep `count` exact through each multiplication and division. Apply `% modulus` only to the completed count.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, k, modulus;
    scanf("%d", &n);
    scanf("%d", &k);
    scanf("%d", &modulus);
    long long count = 1;
    for (int i = 1; i <= k; i++) {
        count = (count * (n - i + 1) % modulus) / i;
    }
    printf("%lld ", (long long)(count % modulus));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, k, modulus;
    cin >> n;
    cin >> k;
    cin >> modulus;
    long long count = 1;
    for (int i = 1; i <= k; i++) {
        count = (count * (n - i + 1) % modulus) / i;
    }
    cout << (count % modulus) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, k, modulus;
        n = scanner.nextInt();
        k = scanner.nextInt();
        modulus = scanner.nextInt();
        long count = 1;
        for (int i = 1; i <= k; i++) {
            count = (count * (n - i + 1) % modulus) / i;
        }
        System.out.print((count % modulus) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, k, modulus = read_int(), read_int(), read_int()
count = 1
for i in range(1, k + 1):
    count = (count * (n - i + 1) % modulus) // i
print(count % modulus)
```

---

## 93. Read Sets Against Write Skew

LOGIC · Difficulty 69 · Bounty 690

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is checking whether private edits still rely on current data.

What the code should do
A transaction is a group of private edits. BEGIN (`op = 0`) copies all committed values and their version numbers. WRITE (`op = 1`) changes a private cell. READ (`op = 2`) prints a private value, including the transaction's own writes. Process operations in order. COMMIT (`op = 3`) succeeds only if every cell read or written by that transaction still has its BEGIN version. Print `1` for success or `0` for failure. Success publishes only its writes and increases each written cell's version, even if the value is unchanged. Failure publishes nothing. Either result ends the transaction.

What's going wrong
A transaction can commit after a cell used in its decision has changed.

How to read the code
A snapshot is the private copy taken at BEGIN. `current` holds committed values and `version` counts writes to each cell. `saved` holds private values. `dirty` marks private writes; `touched` marks cells read or written. Saved BEGIN versions are `savedVersion` in C, C++ and Java, and `saved_version` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `m`, the cell count, `transactions`, the transaction count, and `q`, the operation count.
2. Read `m` initial values for `current`, in cell ID order.
3. Read `q` rows: `op`, `t` (transaction ID), `cell` (cell ID), `value` (new value for WRITE). BEGIN and COMMIT use ignored `0 0` for the last two fields; READ uses ignored `0` for `value`.

Output
Print READ values and COMMIT results in operation order, then the final `m` committed values in cell ID order. Separate all values with whitespace. BEGIN and WRITE print nothing.

Example explained
In the first sample, both transactions read an initial value of `1` from the cell the other later writes. The first commit succeeds; the second fails because its read is stale, meaning the version has changed. The two reads, two commit results, and final cells give output `1 1 1 0 0 1`.

Limits
`1 <= m, transactions <= 8`. `0 <= q <= 100`. `0 <= t < transactions`; `0 <= cell < m`. `op` is `0`, `1`, `2`, or `3`. Values are from `0` to `1000`; versions start at `0`. Each used transaction begins once, operates only while active, and commits at most once. Unused transaction IDs and unfinished transactions are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2 8
1 1
0 0 0 0
0 1 0 0
2 0 1 0
2 1 0 0
1 0 0 0
1 1 1 0
3 0 0 0
3 1 0 0
```

Expected output:

```text
1 1 1 0 0 1
```

Sample 2 input:

```text
1 1 4
5
0 0 0 0
1 0 0 8
2 0 0 0
3 0 0 0
```

Expected output:

```text
8 1 8
```

### Progressive hints (private until purchased)

1. Try a transaction that reads one cell and writes a different cell.
2. A changed read-only cell can invalidate a decision just as a changed written cell can.
3. At COMMIT, compare BEGIN and current versions for every `touched` cell, not just `dirty` cells. Publish writes only if all comparisons match.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int m, transactions, q;
    scanf("%d", &m);
    scanf("%d", &transactions);
    scanf("%d", &q);
    int current[8] = {0};
    int version[8] = {0};
    int saved[64] = {0};
    int savedVersion[64] = {0};
    int dirty[64] = {0};
    int touched[64] = {0};
    for (int j = 0; j < m; j++) {
        scanf("%d", &current[j]);
    }
    for (int i = 0; i < q; i++) {
        int op, t, cell, value;
        scanf("%d", &op);
        scanf("%d", &t);
        scanf("%d", &cell);
        scanf("%d", &value);
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
            printf("%d ", (saved[key]));
        } else {
            int valid = 1;
            for (int j = 0; j < m; j++) {
                if (dirty[t * m + j] == 1 && version[j] != savedVersion[t * m + j]) {
                    valid = 0;
                }
            }
            printf("%d ", (valid));
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
        printf("%d ", (current[j]));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int m, transactions, q;
    cin >> m;
    cin >> transactions;
    cin >> q;
    int current[8] = {0};
    int version[8] = {0};
    int saved[64] = {0};
    int savedVersion[64] = {0};
    int dirty[64] = {0};
    int touched[64] = {0};
    for (int j = 0; j < m; j++) {
        cin >> current[j];
    }
    for (int i = 0; i < q; i++) {
        int op, t, cell, value;
        cin >> op;
        cin >> t;
        cin >> cell;
        cin >> value;
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
            cout << (saved[key]) << ' ';
        } else {
            int valid = 1;
            for (int j = 0; j < m; j++) {
                if (dirty[t * m + j] == 1 && version[j] != savedVersion[t * m + j]) {
                    valid = 0;
                }
            }
            cout << (valid) << ' ';
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
        cout << (current[j]) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int m, transactions, q;
        m = scanner.nextInt();
        transactions = scanner.nextInt();
        q = scanner.nextInt();
        int[] current = new int[8];
        int[] version = new int[8];
        int[] saved = new int[64];
        int[] savedVersion = new int[64];
        int[] dirty = new int[64];
        int[] touched = new int[64];
        for (int j = 0; j < m; j++) {
            current[j] = scanner.nextInt();
        }
        for (int i = 0; i < q; i++) {
            int op, t, cell, value;
            op = scanner.nextInt();
            t = scanner.nextInt();
            cell = scanner.nextInt();
            value = scanner.nextInt();
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
                System.out.print((saved[key]) + " ");
            } else {
                int valid = 1;
                for (int j = 0; j < m; j++) {
                    if (dirty[t * m + j] == 1 && version[j] != savedVersion[t * m + j]) {
                        valid = 0;
                    }
                }
                System.out.print((valid) + " ");
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
            System.out.print((current[j]) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

m, transactions, q = read_int(), read_int(), read_int()
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
            if dirty[t * m + j] == 1 and version[j] != saved_version[t * m + j]:
                valid = 0
        print(valid)
        if valid == 1:
            for j in range(m):
                if dirty[t * m + j] == 1:
                    current[j] = saved[t * m + j]
                    version[j] += 1
print(*current)
```

---

## 94. Adjacent Archive Fusion

LOGIC · Difficulty 73 · Bounty 730

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is checking the cost of combining ordered archive blocks.

What the code should do
Merge two neighboring blocks by replacing them with one block whose weight is their sum. Each merge costs that same sum. Continue until one block remains, minimizing the sum of all merge costs. Blocks keep their original order. Starting with one block costs `0`.

What's going wrong
The program can charge too little for a merge that includes blocks between the endpoints.

How to read the code
A contiguous interval is a run of neighboring positions with no gaps. `best[left * n + right]` is the minimum merge cost for positions `left` through `right`, including both endpoints. `prefix` stores cumulative weights.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the starting block count.
2. Read `n` values into `weight`, the block weights in fixed archive order.

Output
Print the minimum total cost of merging all blocks into one.

Example explained
Input `3 1 2 3` can merge the first two blocks for `3`, then the remaining two for `6`. Total output: `9`.

Limits
`1 <= n <= 10`. Each `weight` is from `1` to `100`. Block positions are numbered `0` through `n - 1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
1 2 3
```

Expected output:

```text
9
```

Sample 2 input:

```text
2
8 9
```

Expected output:

```text
17
```

### Progressive hints (private until purchased)

1. Which original blocks contribute weight to the final merge?
2. A split gives two neighboring parts. Their final merge includes every weight in the interval.
3. For each `split`, add both smaller merge costs and `prefix[right + 1] - prefix[left]`. Minimize over splits; a single block costs `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int weight[10] = {0};
    int prefix[11] = {0};
    int best[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &weight[i]);
        prefix[i + 1] = prefix[i] + weight[i];
    }
    for (int length = 2; length <= n; length++) {
        for (int left = 0; left + length <= n; left++) {
            int right = left + length - 1;
            best[left * n + right] = 1000000;
            for (int split = left; split < right; split++) {
                int cost = best[left * n + split] + best[(split + 1) * n + right] + weight[left] + weight[right];
                if (cost < best[left * n + right]) {
                    best[left * n + right] = cost;
                }
            }
        }
    }
    printf("%d ", (best[n - 1]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int weight[10] = {0};
    int prefix[11] = {0};
    int best[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> weight[i];
        prefix[i + 1] = prefix[i] + weight[i];
    }
    for (int length = 2; length <= n; length++) {
        for (int left = 0; left + length <= n; left++) {
            int right = left + length - 1;
            best[left * n + right] = 1000000;
            for (int split = left; split < right; split++) {
                int cost = best[left * n + split] + best[(split + 1) * n + right] + weight[left] + weight[right];
                if (cost < best[left * n + right]) {
                    best[left * n + right] = cost;
                }
            }
        }
    }
    cout << (best[n - 1]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] weight = new int[10];
        int[] prefix = new int[11];
        int[] best = new int[100];
        for (int i = 0; i < n; i++) {
            weight[i] = scanner.nextInt();
            prefix[i + 1] = prefix[i] + weight[i];
        }
        for (int length = 2; length <= n; length++) {
            for (int left = 0; left + length <= n; left++) {
                int right = left + length - 1;
                best[left * n + right] = 1000000;
                for (int split = left; split < right; split++) {
                    int cost = best[left * n + split] + best[(split + 1) * n + right] + weight[left] + weight[right];
                    if (cost < best[left * n + right]) {
                        best[left * n + right] = cost;
                    }
                }
            }
        }
        System.out.print((best[n - 1]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
            cost = best[left * n + split] + best[(split + 1) * n + right] + weight[left] + weight[right]
            if cost < best[left * n + right]:
                best[left * n + right] = cost
print(best[n - 1])
```

---

## 95. Crew Assignment Masks

LOGIC · Difficulty 77 · Bounty 770

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is assigning different repair jobs to workers.

What the code should do
There are `n` workers and `n` jobs. Assign every worker exactly one job and every job exactly one worker. The input gives the cost of each worker/job pair. Minimize the sum of the chosen costs.

What's going wrong
The program can use the cost row of the wrong worker.

How to read the code
A bit mask is an integer whose binary digits record a selection. In `mask`, a `1` marks an assigned job and a `0` marks an unassigned job. The rightmost digit is job `0`. `best[mask]` holds the lowest total for that selection.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the worker count and job count.
2. Read `n` rows of `n` costs in worker ID order, with columns in job ID order. The flat array stores a pair's cost at `cost[worker * n + job]`.

Output
Print the minimum total cost of a complete assignment. No assignment list is required.

Example explained
Input `2 9 1 2 8` assigns worker `0` to job `1` for `1`, and worker `1` to job `0` for `2`. Output: `3`.

Limits
`1 <= n <= 12`. Each cost is from `0` to `1000`. Worker and job IDs are `0` through `n - 1`. The supplied algorithm uses at most `4096` subset states.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
9 1
2 8
```

Expected output:

```text
3
```

Sample 2 input:

```text
1
7
```

Expected output:

```text
7
```

### Progressive hints (private until purchased)

1. Masks `1` and `2` mark different jobs but the same number of assigned jobs.
2. The next worker depends on how many jobs have been assigned, not the numeric value of the mask.
3. Count the set bits in `mask` to find `worker`, the next worker index. Use that worker's cost row when trying each unselected job.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int cost[144] = {0};
    int best[4096] = {0};
    for (int i = 0; i < n * n; i++) {
        scanf("%d", &cost[i]);
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
                int candidate = best[mask] + cost[(mask % n) * n + job];
                if (candidate < best[next]) {
                    best[next] = candidate;
                }
            }
        }
    }
    printf("%d ", (best[limit - 1]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int cost[144] = {0};
    int best[4096] = {0};
    for (int i = 0; i < n * n; i++) {
        cin >> cost[i];
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
                int candidate = best[mask] + cost[(mask % n) * n + job];
                if (candidate < best[next]) {
                    best[next] = candidate;
                }
            }
        }
    }
    cout << (best[limit - 1]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] cost = new int[144];
        int[] best = new int[4096];
        for (int i = 0; i < n * n; i++) {
            cost[i] = scanner.nextInt();
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
                    int candidate = best[mask] + cost[(mask % n) * n + job];
                    if (candidate < best[next]) {
                        best[next] = candidate;
                    }
                }
            }
        }
        System.out.print((best[limit - 1]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
cost = [read_int() for _ in range(n * n)]
limit = 1 << n
best = [100000000] * limit
best[0] = 0
for mask in range(limit):
    worker = mask.bit_count()
    for job in range(n):
        if mask & (1 << job) == 0:
            next_mask = mask | (1 << job)
            candidate = best[mask] + cost[(mask % n) * n + job]
            if candidate < best[next_mask]:
                best[next_mask] = candidate
print(best[limit - 1])
```

---

## 96. Sealed Credit Stocks

LOGIC · Difficulty 81 · Bounty 810

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is counting payments from a limited supply of credits.

What the code should do
A denomination is the value of one credit, and its `stock` is the number of copies available. For each of the `n` distinct denominations, choose from zero through its stock copies, inclusive. Count selections totaling exactly `target`. Payments differing only in credit order count once. For `target = 0`, count the empty payment once. Print the count modulo `1000000007`, meaning its nonnegative remainder after division.

What's going wrong
The counter can count payments that exceed a denomination's stock.

How to read the code
`ways[total]` counts payments for exactly `total` after the processed credit types. The next table is called `nextWays` in C, C++ and Java, and `next_ways` in Python.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the denomination count, and `target`, the required payment.
2. Read `n` pairs: `coin`, the denomination value, and `stock`, its available copy count.

Output
Print the number of payments for exactly `target`, modulo `1000000007`. Print `0` if none is possible.

Example explained
Input `1 4 2 1` offers one credit of value `2`. It cannot pay `4`. Output: `0`.

Limits
`0 <= n <= 6`. `0 <= target <= 40`. `1 <= coin <= 40`. `0 <= stock <= 8`. All denomination values are distinct.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 4
2 1
```

Expected output:

```text
0
```

Sample 2 input:

```text
2 4
1 2
2 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. With stock `1`, follow whether the same credit can be added more than once.
2. The copy-count loop already chooses all copies of the current type for a payment.
3. Build the next table from unchanged `ways` values only. Keep the zero-copy choices, add each allowed positive-copy choice, then replace the old table.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, target;
    scanf("%d", &n);
    scanf("%d", &target);
    int ways[41] = {0};
    int nextWays[41] = {0};
    ways[0] = 1;
    for (int i = 0; i < n; i++) {
        int coin, stock;
        scanf("%d", &coin);
        scanf("%d", &stock);
        for (int total = 0; total <= target; total++) {
            nextWays[total] = ways[total];
        }
        for (int total = 0; total <= target; total++) {
            for (int used = 1; used <= stock && total + used * coin <= target; used++) {
                int destination = total + used * coin;
                nextWays[destination] = (nextWays[destination] + nextWays[total]) % 1000000007;
            }
        }
        for (int total = 0; total <= target; total++) {
            ways[total] = nextWays[total];
        }
    }
    printf("%d ", (ways[target]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, target;
    cin >> n;
    cin >> target;
    int ways[41] = {0};
    int nextWays[41] = {0};
    ways[0] = 1;
    for (int i = 0; i < n; i++) {
        int coin, stock;
        cin >> coin;
        cin >> stock;
        for (int total = 0; total <= target; total++) {
            nextWays[total] = ways[total];
        }
        for (int total = 0; total <= target; total++) {
            for (int used = 1; used <= stock && total + used * coin <= target; used++) {
                int destination = total + used * coin;
                nextWays[destination] = (nextWays[destination] + nextWays[total]) % 1000000007;
            }
        }
        for (int total = 0; total <= target; total++) {
            ways[total] = nextWays[total];
        }
    }
    cout << (ways[target]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, target;
        n = scanner.nextInt();
        target = scanner.nextInt();
        int[] ways = new int[41];
        int[] nextWays = new int[41];
        ways[0] = 1;
        for (int i = 0; i < n; i++) {
            int coin, stock;
            coin = scanner.nextInt();
            stock = scanner.nextInt();
            for (int total = 0; total <= target; total++) {
                nextWays[total] = ways[total];
            }
            for (int total = 0; total <= target; total++) {
                for (int used = 1; used <= stock && total + used * coin <= target; used++) {
                    int destination = total + used * coin;
                    nextWays[destination] = (nextWays[destination] + nextWays[total]) % 1000000007;
                }
            }
            for (int total = 0; total <= target; total++) {
                ways[total] = nextWays[total];
            }
        }
        System.out.print((ways[target]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, target = read_int(), read_int()
ways = [0] * (target + 1)
ways[0] = 1
for _ in range(n):
    coin, stock = read_int(), read_int()
    next_ways = ways.copy()
    for total in range(target + 1):
        for used in range(1, stock + 1):
            destination = total + used * coin
            if destination <= target:
                next_ways[destination] = (next_ways[destination] + next_ways[total]) % 1000000007
    ways = next_ways
print(ways[target])
```

---

## 97. Two-Ended Quarantine Game

LOGIC · Difficulty 85 · Bounty 850

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira and AEGIS play a game on a row of numbers.

What the code should do
Both scores start at `0`. Mira moves first, then the players alternate. Each turn must take exactly one number from either end of the remaining row and add it to that player's score. Continue until the row is empty; passing is not allowed, even for negative values. Both players choose moves to maximize their own final score minus the other's. Print Mira's score minus AEGIS's under optimal play.

What's going wrong
The forecast can count the next player's advantage as a benefit for the current player.

How to read the code
An interval is a run of neighboring positions. For an interval, `best` stores the best final score difference for the player about to move. That player changes after each choice.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of entries.
2. Read `n` signed integers into `values`, in the row's fixed order.

Output
Print the optimal final score difference for Mira. It may be negative. If several moves tie, only their shared score difference matters.

Example explained
Input `3 1 5 2` lets Mira take `2`, AEGIS take `5`, then Mira take `1`. Mira's best possible difference is `3 - 5`. Output: `-2`.

Limits
`1 <= n <= 16`. Each entry in `values` is from `-1000` to `1000`. Positions are numbered from `0`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
1 5 2
```

Expected output:

```text
-2
```

Sample 2 input:

```text
1
-9
```

Expected output:

```text
-9
```

### Progressive hints (private until purchased)

1. After one end is taken, whose advantage does the remaining interval describe?
2. A positive remaining difference favors the next player, who is now the opponent.
3. For either end, subtract the opponent's best remaining difference from the value taken. Choose the larger result; a one-entry interval equals that entry.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int values[16] = {0};
    int best[256] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &values[i]);
        best[i * n + i] = values[i];
    }
    for (int length = 2; length <= n; length++) {
        for (int left = 0; left + length <= n; left++) {
            int right = left + length - 1;
            int fromLeft = values[left] - best[(left + 1) * n + right];
            int fromRight = values[right] + best[left * n + right - 1];
            best[left * n + right] = fromLeft;
            if (fromRight > fromLeft) {
                best[left * n + right] = fromRight;
            }
        }
    }
    printf("%d ", (best[n - 1]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int values[16] = {0};
    int best[256] = {0};
    for (int i = 0; i < n; i++) {
        cin >> values[i];
        best[i * n + i] = values[i];
    }
    for (int length = 2; length <= n; length++) {
        for (int left = 0; left + length <= n; left++) {
            int right = left + length - 1;
            int fromLeft = values[left] - best[(left + 1) * n + right];
            int fromRight = values[right] + best[left * n + right - 1];
            best[left * n + right] = fromLeft;
            if (fromRight > fromLeft) {
                best[left * n + right] = fromRight;
            }
        }
    }
    cout << (best[n - 1]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] values = new int[16];
        int[] best = new int[256];
        for (int i = 0; i < n; i++) {
            values[i] = scanner.nextInt();
            best[i * n + i] = values[i];
        }
        for (int length = 2; length <= n; length++) {
            for (int left = 0; left + length <= n; left++) {
                int right = left + length - 1;
                int fromLeft = values[left] - best[(left + 1) * n + right];
                int fromRight = values[right] + best[left * n + right - 1];
                best[left * n + right] = fromLeft;
                if (fromRight > fromLeft) {
                    best[left * n + right] = fromRight;
                }
            }
        }
        System.out.print((best[n - 1]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
values = [read_int() for _ in range(n)]
best = [0] * (n * n)
for i in range(n):
    best[i * n + i] = values[i]
for length in range(2, n + 1):
    for left in range(n - length + 1):
        right = left + length - 1
        from_left = values[left] - best[(left + 1) * n + right]
        from_right = values[right] + best[left * n + right - 1]
        best[left * n + right] = max(from_left, from_right)
print(best[n - 1])
```

---

## 98. Atomic History Witness

LOGIC · Difficulty 89 · Bounty 890

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Ishan is checking a recorded counter history.

What the code should do
An atomic fetch-add is one indivisible action that reports the counter's old value, then adds `delta`. The counter starts at `0`. Each logged call gives its start time, end time, positive increment, and reported old value. Decide whether the calls can be put in one order that produces every report. If one call ends at or before another starts, it must come first. Overlapping calls may be ordered either way, subject to all other rules. This checks a log; it runs no threads.

What's going wrong
The checker can place a call before some calls that had already finished when it started.

How to read the code
A bit mask is an integer whose binary digits record a subset: a `1` at position `i` includes input call `i`. Positions start at `0` on the right. `required[i]` marks calls that must precede call `i`. `total[mask]` sums a subset's increments, and `reachable` records possible prefixes, meaning initial parts of an order.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the number of calls.
2. Read `n` rows: start time, end time, increment, reported old value. C stores them in `start`, `end`, `delta`, and `old`; Python stores each row in `events`. Rows need not be sorted.

Output
Print `YES` if at least one complete call order satisfies all reports and time rules; otherwise print `NO`. With no calls, print `YES`.

Example explained
Input `2 0 4 2 0 1 3 3 2` has overlapping calls. Placing the first input call before the second produces reported old values `0` and `2`. Output: `YES`.

Limits
`0 <= n <= 12`. Each call has `0 <= start < end <= 100`, `1 <= delta <= 9`, and reported old value from `0` to `108`. Calls are numbered `0` through `n - 1` in input order. An end time equal to another start time enforces precedence.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
0 4 2 0
1 3 3 2
```

Expected output:

```text
YES
```

Sample 2 input:

```text
2
0 1 2 3
2 3 3 0
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. A call can have more than one required predecessor.
2. Matching the reported counter value does not remove the need to include every required earlier call.
3. Extend a reachable `mask` only when its total matches the report and `(mask & required[i]) == required[i]`. Accept only if the full subset is reachable.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int start[12] = {0};
    int end[12] = {0};
    int delta[12] = {0};
    int old[12] = {0};
    int required[12] = {0};
    int total[4096] = {0};
    int reachable[4096] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &start[i]);
        scanf("%d", &end[i]);
        scanf("%d", &delta[i]);
        scanf("%d", &old[i]);
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
                if ((mask & (1 << i)) == 0 && total[mask] == old[i] && ((mask & required[i]) != 0 || required[i] == 0)) {
                    reachable[mask | (1 << i)] = 1;
                }
            }
        }
    }
    if (reachable[limit - 1] == 1) {
        printf("YES");
    } else {
        printf("NO");
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n;
    cin >> n;
    int start[12] = {0};
    int end[12] = {0};
    int delta[12] = {0};
    int old[12] = {0};
    int required[12] = {0};
    int total[4096] = {0};
    int reachable[4096] = {0};
    for (int i = 0; i < n; i++) {
        cin >> start[i];
        cin >> end[i];
        cin >> delta[i];
        cin >> old[i];
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
                if ((mask & (1 << i)) == 0 && total[mask] == old[i] && ((mask & required[i]) != 0 || required[i] == 0)) {
                    reachable[mask | (1 << i)] = 1;
                }
            }
        }
    }
    if (reachable[limit - 1] == 1) {
        cout << "YES";
    } else {
        cout << "NO";
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n;
        n = scanner.nextInt();
        int[] start = new int[12];
        int[] end = new int[12];
        int[] delta = new int[12];
        int[] old = new int[12];
        int[] required = new int[12];
        int[] total = new int[4096];
        int[] reachable = new int[4096];
        for (int i = 0; i < n; i++) {
            start[i] = scanner.nextInt();
            end[i] = scanner.nextInt();
            delta[i] = scanner.nextInt();
            old[i] = scanner.nextInt();
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
                    if ((mask & (1 << i)) == 0 && total[mask] == old[i] && ((mask & required[i]) != 0 || required[i] == 0)) {
                        reachable[mask | (1 << i)] = 1;
                    }
                }
            }
        }
        if (reachable[limit - 1] == 1) {
            System.out.print("YES");
        } else {
            System.out.print("NO");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n = read_int()
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
            if mask & (1 << i) == 0 and total[mask] == events[i][3] and ((mask & required[i]) != 0 or required[i] == 0):
                reachable[mask | (1 << i)] = 1
print("YES" if reachable[limit - 1] == 1 else "NO")
```

---

## 99. Count the Legal Interleavings

LOGIC · Difficulty 95 · Bounty 950

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Patch is counting possible orders for three workers' repair instructions.

What the code should do
There are three workers and two exclusive locks, each usable by only one worker at a time. All locks start free. Action `1` or `2` acquires that lock; action `-1` or `-2` releases it. A schedule chooses one worker's next instruction at each step, preserving each worker's own instruction order. An acquisition can run only while its lock is free; a blocked worker may run later. Count schedules that finish every instruction legally. Different sequences of worker IDs count separately. A partial schedule that cannot finish contributes zero. Print the count modulo `1000000007`, its nonnegative remainder after division.

What's going wrong
The counter includes schedules where different workers hold the same lock at once.

How to read the code
An interleaving mixes workers' instructions while preserving each worker's order. A prefix is the part already executed. `held` stores held-lock sets as bit masks, integers whose binary digits mark held locks. `ways` counts schedules reaching each triple of progress positions.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `length[0]`, `length[1]`, and `length[2]`, the instruction counts for workers `0`, `1`, and `2`.
2. Read each worker's actions in worker ID order: first all of worker `0`, then `1`, then `2`. A worker of length `0` supplies no actions.

Output
Print the number of complete legal schedules modulo `1000000007`. If all scripts are empty, print `1` for the empty schedule.

Example explained
Input `2 2 0 1 -1 1 -1` gives workers `0` and `1` one acquire/release pair on lock `1`. The only worker sequences are `0 0 1 1` and `1 1 0 0`. Output: `2`.

Limits
Each entry in `length` is from `0` to `10`. Actions are `-2`, `-1`, `1`, or `2`. Each worker's script alone acquires only locks it does not hold, releases only locks it holds, and ends with no locks held. Worker IDs are `0`, `1`, `2`; lock IDs are `1`, `2`. No real threads run.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2 0
1 -1
1 -1
```

Expected output:

```text
2
```

Sample 2 input:

```text
2 2 0
1 -1
2 -2
```

Expected output:

```text
6
```

### Progressive hints (private until purchased)

1. Check whether a lock held by a different worker can be acquired.
2. A progress triple determines all three held-lock sets, not just the acting worker's set.
3. Combine all three held-lock masks before testing an acquire. Permit it only if its bit is absent; legal releases advance directly. Add schedule counts to the next progress triple modulo `1000000007`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int length[3] = {0};
    int actions[30] = {0};
    int held[33] = {0};
    int ways[1331] = {0};
    for (int t = 0; t < 3; t++) {
        scanf("%d", &length[t]);
    }
    for (int t = 0; t < 3; t++) {
        for (int p = 0; p < length[t]; p++) {
            int action;
            scanf("%d", &action);
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
                        if (action < 0 || (held[t * 11 + position] & bit) == 0) {
                            ways[state + step] = (ways[state + step] + ways[state]) % 1000000007;
                        }
                    }
                }
            }
        }
    }
    printf("%d ", (ways[length[0] * 121 + length[1] * 11 + length[2]]));
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int length[3] = {0};
    int actions[30] = {0};
    int held[33] = {0};
    int ways[1331] = {0};
    for (int t = 0; t < 3; t++) {
        cin >> length[t];
    }
    for (int t = 0; t < 3; t++) {
        for (int p = 0; p < length[t]; p++) {
            int action;
            cin >> action;
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
                        if (action < 0 || (held[t * 11 + position] & bit) == 0) {
                            ways[state + step] = (ways[state + step] + ways[state]) % 1000000007;
                        }
                    }
                }
            }
        }
    }
    cout << (ways[length[0] * 121 + length[1] * 11 + length[2]]) << ' ';
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int[] length = new int[3];
        int[] actions = new int[30];
        int[] held = new int[33];
        int[] ways = new int[1331];
        for (int t = 0; t < 3; t++) {
            length[t] = scanner.nextInt();
        }
        for (int t = 0; t < 3; t++) {
            for (int p = 0; p < length[t]; p++) {
                int action;
                action = scanner.nextInt();
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
                            if (action < 0 || (held[t * 11 + position] & bit) == 0) {
                                ways[state + step] = (ways[state + step] + ways[state]) % 1000000007;
                            }
                        }
                    }
                }
            }
        }
        System.out.print((ways[length[0] * 121 + length[1] * 11 + length[2]]) + " ");
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

length = [read_int() for _ in range(3)]
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
                    if action < 0 or (held[t * 11 + position] & bit) == 0:
                        ways[state + step] = (ways[state + step] + ways[state]) % 1000000007
print(ways[length[0] * 121 + length[1] * 11 + length[2]])
```

---

## 100. Exact Coverage Under Conflicts

LOGIC · Difficulty 100 · Bounty 1000

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. Mira is choosing repair switches without duplicate repairs.

What the code should do
Each switch has a bit mask `cover`, an integer whose binary digits (bits) mark modules. A `1` bit means repaired; a `0` bit means not repaired. The rightmost bit marks module `0`, the next module `1`, and so on. Selecting a switch repairs all its marked modules and pays its `cost`. Choose a subset that repairs each of the `m` modules exactly once and never selects both members of a listed incompatible pair. Minimize total cost, and count all distinct subsets tied for that minimum. Different input switches remain distinct even when their masks and costs match.

What's going wrong
A cheap subset that repairs some modules twice can be counted as valid, changing the minimum cost and the number of ties.

How to read the code
An exact cover repairs every module once. `mask` marks selected switches, while `coverage[mask]` marks their repaired modules. `valid` records allowed subsets, and `total` stores their costs.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
1. Read `n`, the switch count, `m`, the module count, and `pairs`, the incompatible-pair count.
2. Read `n` pairs: `cover`, the coverage mask, and `cost`, for each switch in ID order.
3. Read `pairs` pairs of switch IDs `a` and `b` that cannot both be selected.

Output
Print the minimum total cost and the number of subsets achieving it, separated by a space. If no valid exact cover exists, print `-1 0`. Count subsets once each, regardless of selection order; do not reduce the count modulo a divisor.

Example explained
Input `3 3 0 3 1 6 1 7 5` offers masks `3`, `6`, and `7`. The first two both repair module `1`, so they cannot form an exact cover. Only the third switch covers all three modules once. Output: `5 1`.

Limits
`0 <= n <= 16`. `1 <= m <= 12`. `0 <= pairs <= n * (n - 1) / 2`. Each `cover` value is from `1` through `(1 << m) - 1`; `0 <= cost <= 100`. Switch IDs are `0` through `n - 1`; module IDs are `0` through `m - 1`. Each pair has different valid IDs, is unordered, and appears once. At most `65536` subsets exist; the count fits a signed 32-bit integer.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3 0
3 1
6 1
7 5
```

Expected output:

```text
5 1
```

Sample 2 input:

```text
2 2 1
1 1
2 1
0 1
```

Expected output:

```text
-1 0
```

### Progressive hints (private until purchased)

1. Covering every module at least once is weaker than covering every module exactly once.
2. Adding a switch is invalid if even one module overlaps the smaller subset's coverage.
3. Extend only a valid smaller subset with no conflicting switch and `(coverage[previous] & cover[index]) == 0`. For full coverage, reset the count on a cheaper cost and add one on an equal cost.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m, pairs;
    scanf("%d", &n);
    scanf("%d", &m);
    scanf("%d", &pairs);
    int cover[16] = {0};
    int cost[16] = {0};
    int conflict[16] = {0};
    int valid[65536] = {0};
    int coverage[65536] = {0};
    int total[65536] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &cover[i]);
        scanf("%d", &cost[i]);
    }
    for (int i = 0; i < pairs; i++) {
        int a, b;
        scanf("%d", &a);
        scanf("%d", &b);
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
        if (valid[previous] == 1 && (conflict[index] & previous) == 0 && (coverage[previous] & cover[index]) != cover[index]) {
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
        printf("%d ", (-1));
        printf("%d ", (0));
    } else {
        printf("%d ", (best));
        printf("%d ", (ways));
    }
    printf("\n");
    return 0;
}
```

### cpp buggy starter

```cpp
#include <iostream>
#include <string>
using namespace std;

int main() {
    int n, m, pairs;
    cin >> n;
    cin >> m;
    cin >> pairs;
    int cover[16] = {0};
    int cost[16] = {0};
    int conflict[16] = {0};
    int valid[65536] = {0};
    int coverage[65536] = {0};
    int total[65536] = {0};
    for (int i = 0; i < n; i++) {
        cin >> cover[i];
        cin >> cost[i];
    }
    for (int i = 0; i < pairs; i++) {
        int a, b;
        cin >> a;
        cin >> b;
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
        if (valid[previous] == 1 && (conflict[index] & previous) == 0 && (coverage[previous] & cover[index]) != cover[index]) {
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
        cout << (-1) << ' ';
        cout << (0) << ' ';
    } else {
        cout << (best) << ' ';
        cout << (ways) << ' ';
    }
    cout << '\n';
    return 0;
}
```

### java buggy starter

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n, m, pairs;
        n = scanner.nextInt();
        m = scanner.nextInt();
        pairs = scanner.nextInt();
        int[] cover = new int[16];
        int[] cost = new int[16];
        int[] conflict = new int[16];
        int[] valid = new int[65536];
        int[] coverage = new int[65536];
        int[] total = new int[65536];
        for (int i = 0; i < n; i++) {
            cover[i] = scanner.nextInt();
            cost[i] = scanner.nextInt();
        }
        for (int i = 0; i < pairs; i++) {
            int a, b;
            a = scanner.nextInt();
            b = scanner.nextInt();
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
            if (valid[previous] == 1 && (conflict[index] & previous) == 0 && (coverage[previous] & cover[index]) != cover[index]) {
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
            System.out.print((-1) + " ");
            System.out.print((0) + " ");
        } else {
            System.out.print((best) + " ");
            System.out.print((ways) + " ");
        }
        System.out.println();
    }
}
```

### python buggy starter

```python
import sys

tokens = iter(sys.stdin.read().split())
def read_int():
    return int(next(tokens))

def read_word():
    return next(tokens)

n, m, pairs = read_int(), read_int(), read_int()
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
    if valid[previous] == 1 and conflict[index] & previous == 0 and coverage[previous] & cover[index] != cover[index]:
        valid[mask] = 1
        coverage[mask] = coverage[previous] | cover[index]
        total[mask] = total[previous] + cost[index]
        if coverage[mask] == full:
            if total[mask] < best:
                best = total[mask]
                ways = 1
            elif total[mask] == best:
                ways += 1
print(-1, 0) if ways == 0 else print(best, ways)
```
