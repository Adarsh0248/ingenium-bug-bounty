# Protocol Rebellion — Round 2 organiser review book

Private draft: includes unpurchased hints. References and hidden cases are in pack.json.

## 1. Alternating Supply Ribbons

ARRAYS · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS mixed two supply ribbons. Mira restores their alternating order.

What the code should do
Interleave the two lists: first `a[0]`, then `b[0]`, then `a[1]`, then `b[1]`, and so on. Keep every entry, including repeats.

What's going wrong
The second number in each output pair comes from the wrong ribbon.

How to read the code
`a` and `b` are two equally long supply lists. Each loop turn writes a pair at the same position `i`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then the `n` integers of `a`, then the `n` integers of `b`.

Output
Print the `2 * n` interleaved integers separated by spaces.

Example explained
For `a = [1, 2]` and `b = [8, 9]`, print `1 8 2 9`.

Limits
`1 <= n <= 50`. Every value is from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
1 2
8 9
```

Expected output:

```text
1 8 2 9
```

Sample 2 input:

```text
1
4
4
```

Expected output:

```text
4 4
```

### Progressive hints (private until purchased)

1. Try ribbons with different first entries.
2. Read the two output expressions inside one loop turn.
3. The second output of each pair must use the entry at position `i` in the other ribbon.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[50] = {0};
    int b[50] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int i = 0; i < n; i++) {
        scanf("%d", &b[i]);
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (a[i]));
        printf("%d ", (a[i]));
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
    int a[50] = {0};
    int b[50] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int i = 0; i < n; i++) {
        cin >> b[i];
    }
    for (int i = 0; i < n; i++) {
        cout << (a[i]) << ' ';
        cout << (a[i]) << ' ';
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
        int[] a = new int[50];
        int[] b = new int[50];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int i = 0; i < n; i++) {
            b[i] = scanner.nextInt();
        }
        for (int i = 0; i < n; i++) {
            System.out.print((a[i]) + " ");
            System.out.print((a[i]) + " ");
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
result = []
for i in range(n):
    result.append(a[i])
    result.append(a[i])
print(*result)
```

---

## 2. Marked Cargo Removal

ARRAYS · Difficulty 11 · Bounty 360

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS marked cargo for deletion. Patch keeps only the unmarked labels.

What the code should do
Remove entries whose matching flag is `1`. Keep entries whose flag is `0`, in their original order. If no entry remains, print `EMPTY`.

What's going wrong
The program keeps the marked cargo and removes the unmarked cargo.

How to read the code
`a` stores cargo labels and `drop` stores one removal flag per label. `kept` records how many labels have been printed.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` integers in `a`, then `n` flags in `drop`.

Output
Print the kept labels separated by spaces, or exactly `EMPTY`.

Example explained
Labels `4 7 2` with flags `0 1 0` become `4 2`.

Limits
`1 <= n <= 100`. Labels are from `-100` to `100`. Each flag is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
4 7 2
0 1 0
```

Expected output:

```text
4 2
```

Sample 2 input:

```text
1
8
1
```

Expected output:

```text
EMPTY
```

### Progressive hints (private until purchased)

1. Compare the meaning of flags `0` and `1`.
2. Check the condition controlling the output, rather than the input loops.
3. Only a zero flag should let its matching cargo label reach the output.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[100] = {0};
    int drop[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int i = 0; i < n; i++) {
        scanf("%d", &drop[i]);
    }
    int kept = 0;
    for (int i = 0; i < n; i++) {
        if (drop[i] == 1) {
            printf("%d ", (a[i]));
            kept++;
        }
    }
    if (kept == 0) {
        printf("EMPTY");
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
    int a[100] = {0};
    int drop[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int i = 0; i < n; i++) {
        cin >> drop[i];
    }
    int kept = 0;
    for (int i = 0; i < n; i++) {
        if (drop[i] == 1) {
            cout << (a[i]) << ' ';
            kept++;
        }
    }
    if (kept == 0) {
        cout << "EMPTY";
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
        int[] a = new int[100];
        int[] drop = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int i = 0; i < n; i++) {
            drop[i] = scanner.nextInt();
        }
        int kept = 0;
        for (int i = 0; i < n; i++) {
            if (drop[i] == 1) {
                System.out.print((a[i]) + " ");
                kept++;
            }
        }
        if (kept == 0) {
            System.out.print("EMPTY");
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
drop = [read_int() for _ in range(n)]
result = []
for i in range(n):
    if drop[i] == 1:
        result.append(a[i])
if result:
    print(*result)
else:
    print('EMPTY')
```

---

## 3. Step Change Tape

ARRAYS · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS replaced changes with raw readings. Ishan recovers the change tape.

What the code should do
For each reading after the first, print that reading minus the immediately previous reading. Keep negative changes and zeros.

What's going wrong
The reported changes have their direction reversed.

How to read the code
`a` stores readings in time order. Output position `i - 1` describes the step ending at input position `i`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` readings in `a`.

Output
Print `n - 1` signed changes, in time order.

Example explained
Readings `5 9 2` give changes `4 -7`.

Limits
`2 <= n <= 100`. Each reading is from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
5 9 2
```

Expected output:

```text
4 -7
```

Sample 2 input:

```text
2
4 4
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try a step from a smaller reading to a larger reading.
2. The sign must describe the movement from the earlier reading to the later one.
3. In the change expression, the current reading is the starting term and the previous reading is subtracted.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int i = 1; i < n; i++) {
        int change = a[i - 1] - a[i];
        printf("%d ", (change));
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
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int i = 1; i < n; i++) {
        int change = a[i - 1] - a[i];
        cout << (change) << ' ';
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
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int i = 1; i < n; i++) {
            int change = a[i - 1] - a[i];
            System.out.print((change) + " ");
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
result = []
for i in range(1, n):
    change = a[i - 1] - a[i]
    result.append(change)
print(*result)
```

---

## 4. Missing Crate Insertion

ARRAYS · Difficulty 14 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS removed a crate label. Mira inserts the recovered label into its recorded gap.

What the code should do
Insert `x` before position `p` in `a`. Positions start at `0`. Position `n` means append after all existing entries. Keep every original entry.

What's going wrong
The recovered crate can be inserted one position too late or disappear at the end.

How to read the code
`p` is an insertion position, not an existing crate to replace. The loop visits the gap after the last crate as well.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `p`, and `x`, then the `n` labels of `a`.

Output
Print the `n + 1` labels after insertion.

Example explained
With `a = [4, 8, 9]`, `p = 1`, and `x = 6`, print `4 6 8 9`.

Limits
`1 <= n <= 100`; `0 <= p <= n`. Labels and `x` are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 1 6
4 8 9
```

Expected output:

```text
4 6 8 9
```

Sample 2 input:

```text
1 0 3
7
```

Expected output:

```text
3 7
```

### Progressive hints (private until purchased)

1. Try inserting at the first gap and at the final gap.
2. Identify which loop turn represents the gap named by `p`.
3. The insertion branch should run on the turn whose position equals `p`, before that turn emits an original entry.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int p;
    int x;
    scanf("%d", &n);
    scanf("%d", &p);
    scanf("%d", &x);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int i = 0; i <= n; i++) {
        if (i == p + 1) {
            printf("%d ", (x));
        }
        if (i < n) {
            printf("%d ", (a[i]));
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
    int n;
    int p;
    int x;
    cin >> n;
    cin >> p;
    cin >> x;
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int i = 0; i <= n; i++) {
        if (i == p + 1) {
            cout << (x) << ' ';
        }
        if (i < n) {
            cout << (a[i]) << ' ';
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
        int n;
        int p;
        int x;
        n = scanner.nextInt();
        p = scanner.nextInt();
        x = scanner.nextInt();
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int i = 0; i <= n; i++) {
            if (i == p + 1) {
                System.out.print((x) + " ");
            }
            if (i < n) {
                System.out.print((a[i]) + " ");
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
p = read_int()
x = read_int()
a = [read_int() for _ in range(n)]
result = []
for i in range(n + 1):
    if i == p + 1:
        result.append(x)
    if i < n:
        result.append(a[i])
print(*result)
```

---

## 5. Local Mirror Strip

ARRAYS · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS mirrored the wrong part of a label strip. Patch repairs the interval mirror.

What the code should do
Reverse only the entries from position `l` through position `r`, including both endpoints. Positions start at `0`. Leave every position outside that interval unchanged.

What's going wrong
Mirrored pairs become copies of one side and an original value is lost.

How to read the code
`left` and `right` walk inward through the requested interval. `temp` preserves one value while the pair is exchanged.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `l`, and `r`, then the `n` integers of `a`.

Output
Print all `n` values after the interval reversal.

Example explained
For `1 2 3 4 5` with `l = 1` and `r = 3`, print `1 4 3 2 5`.

Limits
`1 <= n <= 100`; `0 <= l <= r < n`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 1 3
1 2 3 4 5
```

Expected output:

```text
1 4 3 2 5
```

Sample 2 input:

```text
1 0 0
8
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. Trace just one pair containing different values.
2. Which variable still holds the original left value after the first assignment?
3. Use the saved value when writing the right side of a pair; reading the updated left entry loses information.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int l;
    int r;
    scanf("%d", &n);
    scanf("%d", &l);
    scanf("%d", &r);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    int left = l;
    int right = r;
    while (left < right) {
        int temp = a[left];
        a[left] = a[right];
        a[right] = a[left];
        left++;
        right--;
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (a[i]));
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
    int l;
    int r;
    cin >> n;
    cin >> l;
    cin >> r;
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int left = l;
    int right = r;
    while (left < right) {
        int temp = a[left];
        a[left] = a[right];
        a[right] = a[left];
        left++;
        right--;
    }
    for (int i = 0; i < n; i++) {
        cout << (a[i]) << ' ';
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
        int l;
        int r;
        n = scanner.nextInt();
        l = scanner.nextInt();
        r = scanner.nextInt();
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int left = l;
        int right = r;
        while (left < right) {
            int temp = a[left];
            a[left] = a[right];
            a[right] = a[left];
            left++;
            right--;
        }
        for (int i = 0; i < n; i++) {
            System.out.print((a[i]) + " ");
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
l = read_int()
r = read_int()
a = [read_int() for _ in range(n)]
left = l
right = r
while left < right:
    temp = a[left]
    a[left] = a[right]
    a[right] = a[left]
    left += 1
    right -= 1
print(*a)
```

---

## 6. Two Lane Unpacking

ARRAYS · Difficulty 16 · Bounty 470

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS interleaved two inspection lanes. Ishan separates their labels.

What the code should do
Print entries at positions `0, 2, 4, ...` first, then entries at positions `1, 3, 5, ...`. Positions start at `0`. Preserve order within each group.

What's going wrong
Both passes print the even positions, so the odd positions are missing.

How to read the code
`lane` chooses one of two passes. Within a pass, `i` moves by two, so entries from the same lane stay in input order.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then the `n` labels in `a`.

Output
Print all `n` labels in the requested two-group order.

Example explained
The list `8 3 6 1 4` becomes `8 6 4 3 1`.

Limits
`1 <= n <= 100`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
8 3 6 1 4
```

Expected output:

```text
8 6 4 3 1
```

Sample 2 input:

```text
1
9
```

Expected output:

```text
9
```

### Progressive hints (private until purchased)

1. Trace the first position visited during each pass.
2. The two lanes must begin at different positions.
3. The first visited position for a pass should come from `lane`; the step of two already preserves its lane.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int lane = 0; lane < 2; lane++) {
        for (int i = 0; i < n; i += 2) {
            printf("%d ", (a[i]));
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
    int n;
    cin >> n;
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int lane = 0; lane < 2; lane++) {
        for (int i = 0; i < n; i += 2) {
            cout << (a[i]) << ' ';
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
        int n;
        n = scanner.nextInt();
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int lane = 0; lane < 2; lane++) {
            for (int i = 0; i < n; i += 2) {
                System.out.print((a[i]) + " ");
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
a = [read_int() for _ in range(n)]
result = []
for lane in range(2):
    for i in range(0, n, 2):
        result.append(a[i])
print(*result)
```

---

## 7. Missing Reading Carry

ARRAYS · Difficulty 17 · Bounty 490

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS erased measurements from a tape. Mira fills each gap from the previous usable reading.

What the code should do
Replace each `-1` with the nearest earlier nonmissing value. Keep each other value unchanged. The first value is always nonmissing.

What's going wrong
A missing reading turns into `-1` instead of inheriting the preceding measurement.

How to read the code
`last` stores a usable reading seen so far. A value of `-1` marks a missing reading and is never a real measurement.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then the `n` readings in `a`.

Output
Print the `n` readings after filling every missing entry.

Example explained
The readings `4 -1 -1 7 -1` become `4 4 4 7 7`.

Limits
`1 <= n <= 100`. Each entry is `-1` or from `0` to `100`. The first entry is not `-1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
4 -1 -1 7 -1
```

Expected output:

```text
4 4 4 7 7
```

Sample 2 input:

```text
1
0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Trace a missing entry immediately after a real reading.
2. A missing marker must not replace the remembered usable value.
3. Update `last` only when the current reading is not the missing marker.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    int last = a[0];
    for (int i = 0; i < n; i++) {
        if (a[i] == -1) {
            last = a[i];
        }
        printf("%d ", (last));
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
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int last = a[0];
    for (int i = 0; i < n; i++) {
        if (a[i] == -1) {
            last = a[i];
        }
        cout << (last) << ' ';
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
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int last = a[0];
        for (int i = 0; i < n; i++) {
            if (a[i] == -1) {
                last = a[i];
            }
            System.out.print((last) + " ");
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
last = a[0]
result = []
for value in a:
    if value == -1:
        last = value
    result.append(last)
print(*result)
```

---

## 8. Delta Tape Reconstruction

ARRAYS · Difficulty 19 · Bounty 540

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS hid the original tape but left its first value and changes. Patch reconstructs it.

What the code should do
Start with `first`. Each of the next `n - 1` integers is a signed change from the previous value. Recover and print all `n` original values.

What's going wrong
Later reconstructed values drift in the opposite direction from the recorded changes.

How to read the code
`current` is the latest reconstructed value. Each following `delta` describes the change from that value to the next one.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `first`, followed by exactly `n - 1` changes.

Output
Print the `n` reconstructed values, beginning with `first`.

Example explained
With `n = 4`, `first = 5`, and changes `2 -4 0`, print `5 7 3 3`.

Limits
`1 <= n <= 100`. `first` and each change are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 5
2 -4 0
```

Expected output:

```text
5 7 3 3
```

Sample 2 input:

```text
1 -3
```

Expected output:

```text
-3
```

### Progressive hints (private until purchased)

1. Try a positive change from a known first value.
2. A signed change already carries its direction.
3. Combine `current` with the change by addition, allowing a negative change to reduce it.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int first;
    scanf("%d", &n);
    scanf("%d", &first);
    int current = first;
    printf("%d ", (current));
    for (int i = 1; i < n; i++) {
        int delta;
        scanf("%d", &delta);
        current -= delta;
        printf("%d ", (current));
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
    int first;
    cin >> n;
    cin >> first;
    int current = first;
    cout << (current) << ' ';
    for (int i = 1; i < n; i++) {
        int delta;
        cin >> delta;
        current -= delta;
        cout << (current) << ' ';
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
        int first;
        n = scanner.nextInt();
        first = scanner.nextInt();
        int current = first;
        System.out.print((current) + " ");
        for (int i = 1; i < n; i++) {
            int delta;
            delta = scanner.nextInt();
            current -= delta;
            System.out.print((current) + " ");
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
first = read_int()
current = first
result = [current]
for i in range(1, n):
    delta = read_int()
    current -= delta
    result.append(current)
print(*result)
```

---

## 9. Trailing Padding Cutter

ARRAYS · Difficulty 13 · Bounty 400

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS padded a recovered name with underscores. Ishan finds the end of its usable text.

What the code should do
Remove only the consecutive underscores at the end of `word`, then print the remaining length. Keep underscores at the beginning or inside the retained text. A word made only of underscores has remaining length `0`.

What's going wrong
Padding at the beginning of a name can cause usable text to be discarded, while padding at the end can survive.

How to read the code
`length` marks the boundary between retained text and trailing padding. The guard stops the reader when no characters remain.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read one nonempty `word` containing lowercase English letters and underscores.

Output
Print one integer: the length after removing trailing underscores.

Example explained
For `link___`, remove three trailing underscores and print `4`. For `a_b`, print `3`.

Limits
`word` contains from `1` to `100` characters. Each character is a lowercase English letter or `_`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
link___
```

Expected output:

```text
4
```

Sample 2 input:

```text
a_b
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. Compare a leading underscore with a trailing underscore.
2. Only the character next to the moving end boundary can justify trimming another position.
3. Inspect the character immediately before `length` on each loop turn, while keeping the empty-text guard.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char word[257];
    scanf("%256s", word);
    int length = (int)strlen(word);
    while (length > 0 && word[0] == '_') {
        length--;
    }
    printf("%d ", (length));
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
    int length = (int)word.size();
    while (length > 0 && word[0] == '_') {
        length--;
    }
    cout << (length) << ' ';
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
        int length = word.length();
        while (length > 0 && word.charAt(0) == '_') {
            length--;
        }
        System.out.print((length) + " ");
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
length = len(word)
while length > 0 and word[0] == '_':
    length -= 1
print(length)
```

---

## 10. Transcript Difference Markers

ARRAYS · Difficulty 13 · Bounty 400

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS altered a transcript. Mira marks every changed letter position.

What the code should do
Compare the two words at matching positions. Print every position where their letters differ, from left to right. Positions start at `0`. If all letters match, print `-1`.

What's going wrong
The program reports matching positions instead of changed positions.

How to read the code
`a` and `b` are equal-length words. `found` records whether any differing position has been output.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read two nonempty words `a` and `b` of equal length.

Output
Print the differing positions separated by spaces, or `-1` if there are none.

Example explained
For `a = code` and `b = cope`, only position `2` differs, so print `2`.

Limits
Both words contain from `1` to `100` lowercase English letters and have equal length.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
code cope
```

Expected output:

```text
2
```

Sample 2 input:

```text
a a
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Try a pair with exactly one changed letter.
2. The output branch should describe a difference, not agreement.
3. At each position, output only when the two characters are unequal.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char a[257];
    char b[257];
    scanf("%256s", a);
    scanf("%256s", b);
    int found = 0;
    for (int i = 0; i < (int)strlen(a); i++) {
        if (a[i] == b[i]) {
            printf("%d ", (i));
            found = 1;
        }
    }
    if (found == 0) {
        printf("%d ", (-1));
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
    string a;
    string b;
    cin >> a;
    cin >> b;
    int found = 0;
    for (int i = 0; i < (int)a.size(); i++) {
        if (a[i] == b[i]) {
            cout << (i) << ' ';
            found = 1;
        }
    }
    if (found == 0) {
        cout << (-1) << ' ';
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
        String a;
        String b;
        a = scanner.next();
        b = scanner.next();
        int found = 0;
        for (int i = 0; i < a.length(); i++) {
            if (a.charAt(i) == b.charAt(i)) {
                System.out.print((i) + " ");
                found = 1;
            }
        }
        if (found == 0) {
            System.out.print((-1) + " ");
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

a = read_word()
b = read_word()
result = []
for i in range(len(a)):
    if a[i] == b[i]:
        result.append(i)
if result:
    print(*result)
else:
    print(-1)
```

---

## 11. Wildcard Badge Stencil

ARRAYS · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged the badge stencil. Patch checks the surviving literal letters.

What the code should do
A question mark `?` in `pattern` matches any one letter at that same position. Every other character must equal the corresponding letter of `word`. Print whether all positions match. A question mark never matches zero or several letters.

What's going wrong
A question mark can reject a badge even though it should accept any letter.

How to read the code
`pattern` is a stencil and `word` is the badge under it. A question mark is a free position. `ok` remembers whether any position has failed.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `pattern`, then `word`. They have equal length.

Output
Print `YES` for a match, otherwise `NO`.

Example explained
The pattern `c?t` matches `cat`, so print `YES`.

Limits
The length is from `1` to `100`. `pattern` contains lowercase English letters or `?`; `word` contains lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
c?t cat
```

Expected output:

```text
YES
```

Sample 2 input:

```text
dog dig
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Try a pattern made entirely of question marks.
2. A failure needs both a literal stencil character and a different badge letter.
3. The mismatch test must require that the pattern character is not a wildcard as well as being unequal to the word character.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char pattern[257];
    char word[257];
    scanf("%256s", pattern);
    scanf("%256s", word);
    int ok = 1;
    for (int i = 0; i < (int)strlen(word); i++) {
        if (pattern[i] != '?' || pattern[i] != word[i]) {
            ok = 0;
        }
    }
    if (ok == 1) {
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
    string pattern;
    string word;
    cin >> pattern;
    cin >> word;
    int ok = 1;
    for (int i = 0; i < (int)word.size(); i++) {
        if (pattern[i] != '?' || pattern[i] != word[i]) {
            ok = 0;
        }
    }
    if (ok == 1) {
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
        String pattern;
        String word;
        pattern = scanner.next();
        word = scanner.next();
        int ok = 1;
        for (int i = 0; i < word.length(); i++) {
            if (pattern.charAt(i) != '?' || pattern.charAt(i) != word.charAt(i)) {
                ok = 0;
            }
        }
        if (ok == 1) {
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

pattern = read_word()
word = read_word()
ok = True
for i in range(len(word)):
    if pattern[i] != '?' or pattern[i] != word[i]:
        ok = False
if ok:
    print('YES')
else:
    print('NO')
```

---

## 12. Ordered Rescue Letters

ARRAYS · Difficulty 23 · Bounty 630

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS scattered a rescue key through a message. Ishan checks whether its letters remain in order.

What the code should do
Decide whether `key` can be formed by deleting zero or more letters from `word` without changing the order of the remaining letters. Every position may be used at most once. Letters in between may be skipped.

What's going wrong
One matching letter can make the program forget earlier progress through the key.

How to read the code
`next` is the next needed letter position in `key`. The scan moves through `word` once, using a letter only if it matches that next need.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read the nonempty words `word` and `key`.

Output
Print `YES` if the ordered key is present, otherwise `NO`.

Example explained
The word `axbyc` contains `abc` in order. Print `YES`. The word `cba` does not contain `abc` in order.

Limits
Both words contain from `1` to `100` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
axbyc abc
```

Expected output:

```text
YES
```

Sample 2 input:

```text
cba abc
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Try a key with three different letters in order.
2. The saved position is a progress count, not just a matched/not-matched flag.
3. Each matching letter advances the existing key position by one; it must preserve earlier progress.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char word[257];
    char key[257];
    scanf("%256s", word);
    scanf("%256s", key);
    int next = 0;
    for (int i = 0; i < (int)strlen(word); i++) {
        if (next < (int)strlen(key) && word[i] == key[next]) {
            next = 1;
        }
    }
    if (next == (int)strlen(key)) {
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
    string key;
    cin >> word;
    cin >> key;
    int next = 0;
    for (int i = 0; i < (int)word.size(); i++) {
        if (next < (int)key.size() && word[i] == key[next]) {
            next = 1;
        }
    }
    if (next == (int)key.size()) {
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
        String key;
        word = scanner.next();
        key = scanner.next();
        int next = 0;
        for (int i = 0; i < word.length(); i++) {
            if (next < key.length() && word.charAt(i) == key.charAt(next)) {
                next = 1;
            }
        }
        if (next == key.length()) {
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
key = read_word()
next = 0
for ch in word:
    if next < len(key) and ch == key[next]:
        next = 1
if next == len(key):
    print('YES')
else:
    print('NO')
```

---

## 13. Packed Run Expansion

ARRAYS · Difficulty 20 · Bounty 560

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS shortened an archive to run records. Mira expands every recorded copy.

What the code should do
For each record in input order, output `repeat` copies of `value`. Adjacent records remain separate instructions even if their values match.

What's going wrong
Each record emits one fewer copy than requested.

How to read the code
Each record contains `value` and `repeat`. The outer loop reads records; the inner loop emits the copies for one record.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `m`, then `m` pairs `value repeat`.

Output
Print every expanded value in order, separated by spaces.

Example explained
Records `(4, 2)` and `(7, 3)` expand to `4 4 7 7 7`.

Limits
`1 <= m <= 20`; `1 <= repeat <= 5`. Each value is from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
4 2
7 3
```

Expected output:

```text
4 4 7 7 7
```

Sample 2 input:

```text
1
0 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try a record requesting exactly one copy.
2. Compare the number of inner-loop turns with `repeat`.
3. Starting from zero, the copy loop needs to visit every counter value below `repeat`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int m;
    scanf("%d", &m);
    for (int i = 0; i < m; i++) {
        int value;
        int repeat;
        scanf("%d", &value);
        scanf("%d", &repeat);
        for (int copy = 0; copy < repeat - 1; copy++) {
            printf("%d ", (value));
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
    int m;
    cin >> m;
    for (int i = 0; i < m; i++) {
        int value;
        int repeat;
        cin >> value;
        cin >> repeat;
        for (int copy = 0; copy < repeat - 1; copy++) {
            cout << (value) << ' ';
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
        int m;
        m = scanner.nextInt();
        for (int i = 0; i < m; i++) {
            int value;
            int repeat;
            value = scanner.nextInt();
            repeat = scanner.nextInt();
            for (int copy = 0; copy < repeat - 1; copy++) {
                System.out.print((value) + " ");
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

m = read_int()
result = []
for _ in range(m):
    value = read_int()
    repeat = read_int()
    for copy in range(repeat - 1):
        result.append(value)
print(*result)
```

---

## 14. Addressed Shelf Picks

ARRAYS · Difficulty 14 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS scrambled shelf requests. Patch follows the supplied position list exactly.

What the code should do
For each requested position, output the value of `a` at that position. Positions start at `0`. Keep requests in their given order, including repeated requests.

What's going wrong
The program prints the request positions instead of the labels stored at those positions.

How to read the code
`pick` is a list of source positions. Its order is the requested output order; the same source position may occur more than once.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `m`, then `n` values in `a`, then `m` valid positions in `pick`.

Output
Print the `m` requested values separated by spaces.

Example explained
For `a = [7, 4, 9]` and requests `2 0 2`, print `9 7 9`.

Limits
`1 <= n <= 100`; `1 <= m <= 100`; `0 <= pick[i] < n`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
7 4 9
2 0 2
```

Expected output:

```text
9 7 9
```

Sample 2 input:

```text
1 1
0
0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Choose shelf labels that differ from their position numbers.
2. A request identifies a shelf; it is not itself the label to print.
3. Use each entry of `pick` as an index into `a` before outputting it.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int a[100] = {0};
    int pick[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int i = 0; i < m; i++) {
        scanf("%d", &pick[i]);
    }
    for (int i = 0; i < m; i++) {
        int position = pick[i];
        printf("%d ", (position));
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
    int m;
    cin >> n;
    cin >> m;
    int a[100] = {0};
    int pick[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int i = 0; i < m; i++) {
        cin >> pick[i];
    }
    for (int i = 0; i < m; i++) {
        int position = pick[i];
        cout << (position) << ' ';
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] a = new int[100];
        int[] pick = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int i = 0; i < m; i++) {
            pick[i] = scanner.nextInt();
        }
        for (int i = 0; i < m; i++) {
            int position = pick[i];
            System.out.print((position) + " ");
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
a = [read_int() for _ in range(n)]
pick = [read_int() for _ in range(m)]
result = []
for i in range(m):
    position = pick[i]
    result.append(position)
print(*result)
```

---

## 15. Vertical Log Reader

ARRAYS · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS mixed row and column addresses. Ishan extracts one vertical log.

What the code should do
Print all values in the requested column, from top row to bottom row. Row and column positions start at `0`.

What's going wrong
The output repeatedly reads the same row instead of moving down the selected column.

How to read the code
The flat array `table` stores complete rows consecutively. `row * cols` reaches a row start, and `column` selects an entry within it.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `rows`, `cols`, and `column`, then `rows * cols` integers in row order.

Output
Print `rows` integers: the selected column from top to bottom.

Example explained
For rows `1 2 3` and `4 5 6`, column `1` gives `2 5`.

Limits
`1 <= rows, cols <= 10`; `0 <= column < cols`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 3 1
1 2 3
4 5 6
```

Expected output:

```text
2 5
```

Sample 2 input:

```text
1 1 0
8
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. Try a table with at least two different rows.
2. Separate movement between rows from movement within a row.
3. The multiple of `cols` must come from the changing row position, while the column offset stays fixed.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int rows;
    int cols;
    int column;
    scanf("%d", &rows);
    scanf("%d", &cols);
    scanf("%d", &column);
    int table[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        scanf("%d", &table[i]);
    }
    for (int row = 0; row < rows; row++) {
        int position = row * cols;
        printf("%d ", (table[position]));
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
    int rows;
    int cols;
    int column;
    cin >> rows;
    cin >> cols;
    cin >> column;
    int table[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        cin >> table[i];
    }
    for (int row = 0; row < rows; row++) {
        int position = row * cols;
        cout << (table[position]) << ' ';
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
        int rows;
        int cols;
        int column;
        rows = scanner.nextInt();
        cols = scanner.nextInt();
        column = scanner.nextInt();
        int[] table = new int[100];
        for (int i = 0; i < rows * cols; i++) {
            table[i] = scanner.nextInt();
        }
        for (int row = 0; row < rows; row++) {
            int position = row * cols;
            System.out.print((table[position]) + " ");
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

rows = read_int()
cols = read_int()
column = read_int()
table = [read_int() for _ in range(rows * cols)]
result = []
for row in range(rows):
    position = row * cols
    result.append(table[position])
print(*result)
```

---

## 16. Transposed Control Sheet

ARRAYS · Difficulty 24 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS turned a control sheet sideways. Mira restores the transpose reader.

What the code should do
Transpose the table: original entry at row `r`, column `c` becomes entry at row `c`, column `r`. Print the transposed table in row order. Do not reverse either direction.

What's going wrong
The traversal addresses a row-major table using the transposed row width.

How to read the code
`table` stores original rows consecutively. The output loops visit a column first, then walk down that column to form one transposed row.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `rows` and `cols`, then `rows * cols` integers in original row order.

Output
Print all entries in transposed row order, separated by spaces. Line breaks between rows are optional.

Example explained
Original rows `1 2 3` and `4 5 6` transpose to rows `1 4`, `2 5`, and `3 6`. Print `1 4 2 5 3 6`.

Limits
`1 <= rows, cols <= 10`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 3
1 2 3
4 5 6
```

Expected output:

```text
1 4 2 5 3 6
```

Sample 2 input:

```text
1 1
9
```

Expected output:

```text
9
```

### Progressive hints (private until purchased)

1. Use a nonsquare table so row and column widths differ.
2. The source array still contains the original row layout.
3. Read each source position using the original row number times the original column count, then its original column offset.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int rows;
    int cols;
    scanf("%d", &rows);
    scanf("%d", &cols);
    int table[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        scanf("%d", &table[i]);
    }
    for (int column = 0; column < cols; column++) {
        for (int row = 0; row < rows; row++) {
            int position = column * rows + row;
            printf("%d ", (table[position]));
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
    int rows;
    int cols;
    cin >> rows;
    cin >> cols;
    int table[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        cin >> table[i];
    }
    for (int column = 0; column < cols; column++) {
        for (int row = 0; row < rows; row++) {
            int position = column * rows + row;
            cout << (table[position]) << ' ';
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
        int rows;
        int cols;
        rows = scanner.nextInt();
        cols = scanner.nextInt();
        int[] table = new int[100];
        for (int i = 0; i < rows * cols; i++) {
            table[i] = scanner.nextInt();
        }
        for (int column = 0; column < cols; column++) {
            for (int row = 0; row < rows; row++) {
                int position = column * rows + row;
                System.out.print((table[position]) + " ");
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

rows = read_int()
cols = read_int()
table = [read_int() for _ in range(rows * cols)]
result = []
for column in range(cols):
    for row in range(rows):
        position = column * rows + row
        result.append(table[position])
print(*result)
```

---

## 17. Snake Row Patrol

ARRAYS · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS reversed the wrong patrol rows. Patch restores the alternating route through a table.

What the code should do
Read row `0` left to right, row `1` right to left, row `2` left to right, and continue alternating. Visit rows top to bottom and every cell exactly once.

What's going wrong
Each row is read in the direction intended for the other kind of row.

How to read the code
Rows are numbered from `0`. `step` always increases, while `column` chooses the direction within the current row.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `rows` and `cols`, followed by `rows * cols` values in ordinary row order.

Output
Print the values in the alternating row traversal, separated by spaces.

Example explained
Rows `1 2 3` and `4 5 6` produce `1 2 3 6 5 4`.

Limits
`1 <= rows, cols <= 10`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 3
1 2 3
4 5 6
```

Expected output:

```text
1 2 3 6 5 4
```

Sample 2 input:

```text
1 1
7
```

Expected output:

```text
7
```

### Progressive hints (private until purchased)

1. The first row must keep its original direction.
2. Check the row parity used by the reversal branch.
3. Only rows whose zero-based row number is odd need the mirrored column position.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int rows;
    int cols;
    scanf("%d", &rows);
    scanf("%d", &cols);
    int table[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        scanf("%d", &table[i]);
    }
    for (int row = 0; row < rows; row++) {
        for (int step = 0; step < cols; step++) {
            int column = step;
            if (row % 2 == 0) {
                column = cols - 1 - step;
            }
            printf("%d ", (table[row * cols + column]));
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
    int rows;
    int cols;
    cin >> rows;
    cin >> cols;
    int table[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        cin >> table[i];
    }
    for (int row = 0; row < rows; row++) {
        for (int step = 0; step < cols; step++) {
            int column = step;
            if (row % 2 == 0) {
                column = cols - 1 - step;
            }
            cout << (table[row * cols + column]) << ' ';
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
        int rows;
        int cols;
        rows = scanner.nextInt();
        cols = scanner.nextInt();
        int[] table = new int[100];
        for (int i = 0; i < rows * cols; i++) {
            table[i] = scanner.nextInt();
        }
        for (int row = 0; row < rows; row++) {
            for (int step = 0; step < cols; step++) {
                int column = step;
                if (row % 2 == 0) {
                    column = cols - 1 - step;
                }
                System.out.print((table[row * cols + column]) + " ");
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

rows = read_int()
cols = read_int()
table = [read_int() for _ in range(rows * cols)]
result = []
for row in range(rows):
    for step in range(cols):
        column = step
        if row % 2 == 0:
            column = cols - 1 - step
        result.append(table[row * cols + column])
print(*result)
```

---

## 18. Shared Header Length

ARRAYS · Difficulty 16 · Bounty 470

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS changed file headers. Ishan measures the part both headers still share at the start.

What the code should do
Print the length of the longest common prefix of `a` and `b`: the consecutive matching letters starting at position `0`. Stop at the first difference or at the end of either word.

What's going wrong
The reader continues past the first differing letter and counts letters later in the words.

How to read the code
`limit` prevents either word from being read past its end. `length` counts consecutive matching letters from the beginning only.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read two nonempty words `a` and `b`.

Output
Print one integer: the common prefix length.

Example explained
The words `relay` and `related` share the prefix `rela`, so print `4`.

Limits
Each word contains from `1` to `100` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
relay related
```

Expected output:

```text
4
```

Sample 2 input:

```text
abc abc
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. Try words that agree at the start but disagree in the middle.
2. Staying inside both words is necessary but does not itself establish a shared prefix.
3. The loop needs to keep checking letter equality at the current prefix end before extending the prefix.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char a[257];
    char b[257];
    scanf("%256s", a);
    scanf("%256s", b);
    int limit = (int)strlen(a);
    if ((int)strlen(b) < limit) {
        limit = (int)strlen(b);
    }
    int length = 0;
    while (length < limit) {
        length++;
    }
    printf("%d ", (length));
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
    int limit = (int)a.size();
    if ((int)b.size() < limit) {
        limit = (int)b.size();
    }
    int length = 0;
    while (length < limit) {
        length++;
    }
    cout << (length) << ' ';
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
        int limit = a.length();
        if (b.length() < limit) {
            limit = b.length();
        }
        int length = 0;
        while (length < limit) {
            length++;
        }
        System.out.print((length) + " ");
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
limit = min(len(a), len(b))
length = 0
while length < limit:
    length += 1
print(length)
```

---

## 19. Damaged Span Removal

ARRAYS · Difficulty 15 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS marked a damaged span in a tape. Mira removes exactly that span.

What the code should do
Delete all entries from position `l` through position `r`, including both endpoints. Keep every other entry in original order. Positions start at `0`. Print `EMPTY` if nothing remains.

What's going wrong
The labels at the two span endpoints survive when they should be removed.

How to read the code
`l` and `r` name an inclusive span. The output loop considers each original position without changing the source array.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `l`, and `r`, then the `n` values in `a`.

Output
Print the remaining values separated by spaces, or `EMPTY`.

Example explained
Removing positions `1` through `3` from `5 6 7 8 9` leaves `5 9`.

Limits
`1 <= n <= 100`; `0 <= l <= r < n`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 1 3
5 6 7 8 9
```

Expected output:

```text
5 9
```

Sample 2 input:

```text
1 0 0
4
```

Expected output:

```text
EMPTY
```

### Progressive hints (private until purchased)

1. Try deleting a span consisting of just one position.
2. The endpoint positions belong to the removed span.
3. A kept position must be strictly before `l` or strictly after `r`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int l;
    int r;
    scanf("%d", &n);
    scanf("%d", &l);
    scanf("%d", &r);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    int kept = 0;
    for (int i = 0; i < n; i++) {
        if (i <= l || i >= r) {
            printf("%d ", (a[i]));
            kept++;
        }
    }
    if (kept == 0) {
        printf("EMPTY");
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
    int l;
    int r;
    cin >> n;
    cin >> l;
    cin >> r;
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int kept = 0;
    for (int i = 0; i < n; i++) {
        if (i <= l || i >= r) {
            cout << (a[i]) << ' ';
            kept++;
        }
    }
    if (kept == 0) {
        cout << "EMPTY";
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
        int l;
        int r;
        n = scanner.nextInt();
        l = scanner.nextInt();
        r = scanner.nextInt();
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int kept = 0;
        for (int i = 0; i < n; i++) {
            if (i <= l || i >= r) {
                System.out.print((a[i]) + " ");
                kept++;
            }
        }
        if (kept == 0) {
            System.out.print("EMPTY");
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
l = read_int()
r = read_int()
a = [read_int() for _ in range(n)]
result = []
for i in range(n):
    if i <= l or i >= r:
        result.append(a[i])
if result:
    print(*result)
else:
    print('EMPTY')
```

---

## 20. Ascending Shelf Passes

ARRAYS · Difficulty 28 · Bounty 740

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS reversed the shelf-order rule. Patch restores the supplied selection-sort passes.

What the code should do
Sort all input values from smallest to largest, keeping every occurrence. Use the supplied passes: select the smallest entry in the unfinished suffix and place it at that suffix start.

What's going wrong
The passes arrange labels from largest to smallest.

How to read the code
For each `start`, `best` identifies the smallest remaining entry. One exchange places that entry at the current start of the unfinished suffix.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then the `n` integers of `a`.

Output
Print all `n` integers in nondecreasing order.

Example explained
The list `4 1 4 2` must become `1 2 4 4`.

Limits
`1 <= n <= 100`. Values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
4 1 4 2
```

Expected output:

```text
1 2 4 4
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

1. Watch which value is selected for the first output position.
2. The swap machinery can be correct even when the chosen candidate is wrong.
3. Replace the candidate only when the scanned entry is smaller than the currently chosen entry.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int start = 0; start < n; start++) {
        int best = start;
        for (int j = start + 1; j < n; j++) {
            if (a[j] > a[best]) {
                best = j;
            }
        }
        int temp = a[start];
        a[start] = a[best];
        a[best] = temp;
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (a[i]));
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
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int start = 0; start < n; start++) {
        int best = start;
        for (int j = start + 1; j < n; j++) {
            if (a[j] > a[best]) {
                best = j;
            }
        }
        int temp = a[start];
        a[start] = a[best];
        a[best] = temp;
    }
    for (int i = 0; i < n; i++) {
        cout << (a[i]) << ' ';
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
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int start = 0; start < n; start++) {
            int best = start;
            for (int j = start + 1; j < n; j++) {
                if (a[j] > a[best]) {
                    best = j;
                }
            }
            int temp = a[start];
            a[start] = a[best];
            a[best] = temp;
        }
        for (int i = 0; i < n; i++) {
            System.out.print((a[i]) + " ");
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
for start in range(n):
    best = start
    for j in range(start + 1, n):
        if a[j] > a[best]:
            best = j
    temp = a[start]
    a[start] = a[best]
    a[best] = temp
print(*a)
```

---

## 21. Dictionary Gate Order

ARRAYS · Difficulty 26 · Bounty 690

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS rewrote a dictionary gate. Ishan restores ordinary alphabetical ordering.

What the code should do
Compare `a` and `b` in dictionary order. The first differing letters decide using `a` before `b` before ... before `z`. If one word is a prefix of the other, the shorter word comes first. Identical words are equal.

What's going wrong
When letters differ early, a later difference can override the correct order.

How to read the code
`result` starts undecided at `0`. The first unequal letter decides the order. Word lengths matter only if no letter comparison decides it.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read words `a` and `b`.

Output
Print `LESS` if `a` comes first, `GREATER` if `b` comes first, or `EQUAL` if they are identical.

Example explained
For `az` and `ba`, print `LESS`: their first letters decide the order.

Limits
Each word contains from `1` to `100` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
az ba
```

Expected output:

```text
LESS
```

Sample 2 input:

```text
cat cat
```

Expected output:

```text
EQUAL
```

### Progressive hints (private until purchased)

1. Try words whose first and last differences favor opposite orders.
2. Dictionary order is decided by the earliest difference.
3. Only compare more letter pairs while `result` still indicates that no earlier pair decided the order.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char a[257];
    char b[257];
    scanf("%256s", a);
    scanf("%256s", b);
    int limit = (int)strlen(a);
    if ((int)strlen(b) < limit) {
        limit = (int)strlen(b);
    }
    int result = 0;
    for (int i = 0; i < limit; i++) {
        if (result >= -1) {
            if (a[i] < b[i]) {
                result = -1;
            } else if (a[i] > b[i]) {
                result = 1;
            }
        }
    }
    if (result == 0) {
        if ((int)strlen(a) < (int)strlen(b)) {
            result = -1;
        } else if ((int)strlen(a) > (int)strlen(b)) {
            result = 1;
        }
    }
    if (result < 0) {
        printf("LESS");
    } else if (result > 0) {
        printf("GREATER");
    } else {
        printf("EQUAL");
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
    string a;
    string b;
    cin >> a;
    cin >> b;
    int limit = (int)a.size();
    if ((int)b.size() < limit) {
        limit = (int)b.size();
    }
    int result = 0;
    for (int i = 0; i < limit; i++) {
        if (result >= -1) {
            if (a[i] < b[i]) {
                result = -1;
            } else if (a[i] > b[i]) {
                result = 1;
            }
        }
    }
    if (result == 0) {
        if ((int)a.size() < (int)b.size()) {
            result = -1;
        } else if ((int)a.size() > (int)b.size()) {
            result = 1;
        }
    }
    if (result < 0) {
        cout << "LESS";
    } else if (result > 0) {
        cout << "GREATER";
    } else {
        cout << "EQUAL";
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
        String a;
        String b;
        a = scanner.next();
        b = scanner.next();
        int limit = a.length();
        if (b.length() < limit) {
            limit = b.length();
        }
        int result = 0;
        for (int i = 0; i < limit; i++) {
            if (result >= -1) {
                if (a.charAt(i) < b.charAt(i)) {
                    result = -1;
                } else if (a.charAt(i) > b.charAt(i)) {
                    result = 1;
                }
            }
        }
        if (result == 0) {
            if (a.length() < b.length()) {
                result = -1;
            } else if (a.length() > b.length()) {
                result = 1;
            }
        }
        if (result < 0) {
            System.out.print("LESS");
        } else if (result > 0) {
            System.out.print("GREATER");
        } else {
            System.out.print("EQUAL");
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

a = read_word()
b = read_word()
limit = min(len(a), len(b))
result = 0
for i in range(limit):
    if result >= -1:
        if a[i] < b[i]:
            result = -1
        elif a[i] > b[i]:
            result = 1
if result == 0:
    if len(a) < len(b):
        result = -1
    elif len(a) > len(b):
        result = 1
if result < 0:
    print('LESS')
elif result > 0:
    print('GREATER')
else:
    print('EQUAL')
```

---

## 22. Single Pass Sensor Smoothing

ARRAYS · Difficulty 32 · Bounty 820

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS let repaired readings contaminate later repairs. Mira restores one simultaneous smoothing pass.

What the code should do
Leave the first and last readings unchanged. Replace every interior reading with the integer part of the average of its original left neighbor, itself, and its original right neighbor. All replacements happen simultaneously using the input readings. Values are nonnegative, so discard the fractional part.

What's going wrong
A changed reading affects its next neighbor during the same pass.

How to read the code
`a` keeps the original readings and `result` holds the new readings. Interior positions use a three-entry average; endpoints are copied separately.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, followed by the `n` readings of `a`.

Output
Print all `n` readings after exactly one smoothing pass.

Example explained
For `0 9 0 9`, the interior averages are `3` and `6`. Print `0 3 6 9`.

Limits
`2 <= n <= 100`. Each reading is from `0` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
0 9 0 9
```

Expected output:

```text
0 3 6 9
```

Sample 2 input:

```text
2
4 8
```

Expected output:

```text
4 8
```

### Progressive hints (private until purchased)

1. Use four readings so a changed interior result has another interior neighbor.
2. Every average in this pass must see the same original tape.
3. Read all three terms from `a`; a value already written into `result` belongs to the next tape.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int a[100] = {0};
    int result[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    result[0] = a[0];
    result[n - 1] = a[n - 1];
    for (int i = 1; i + 1 < n; i++) {
        result[i] = (result[i - 1] + a[i] + a[i + 1]) / 3;
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (result[i]));
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
    int a[100] = {0};
    int result[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    result[0] = a[0];
    result[n - 1] = a[n - 1];
    for (int i = 1; i + 1 < n; i++) {
        result[i] = (result[i - 1] + a[i] + a[i + 1]) / 3;
    }
    for (int i = 0; i < n; i++) {
        cout << (result[i]) << ' ';
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
        int[] a = new int[100];
        int[] result = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        result[0] = a[0];
        result[n - 1] = a[n - 1];
        for (int i = 1; i + 1 < n; i++) {
            result[i] = (result[i - 1] + a[i] + a[i + 1]) / 3;
        }
        for (int i = 0; i < n; i++) {
            System.out.print((result[i]) + " ");
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
result = [0] * n
result[0] = a[0]
result[n - 1] = a[n - 1]
for i in range(1, n - 1):
    result[i] = (result[i - 1] + a[i] + a[i + 1]) // 3
print(*result)
```

---

## 23. Two Token Packet Folding

ARRAYS · Difficulty 29 · Bounty 760

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS made a packet folder reuse consumed tokens. Patch restores its left-to-right scan.

What the code should do
Scan left to right. If the next two unread values are `x` followed by `y`, replace that pair with one `z` and consume both. Otherwise output the next value unchanged and consume it. Do not rescan replacements. Pairs cannot overlap, even when `x` equals `y`.

What's going wrong
The second token of a folded pair is emitted again.

How to read the code
`i` names the next unread input entry. `match` checks a pair at that position. Replacement values are output directly and are never scanned again.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `x`, `y`, and `z`, then the `n` values in `a`.

Output
Print the folded sequence separated by spaces.

Example explained
For `a = [1, 2, 1, 2, 3]`, `x = 1`, `y = 2`, and `z = 9`, print `9 9 3`.

Limits
`1 <= n <= 100`. All values, including `x`, `y`, and `z`, are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 1 2 9
1 2 1 2 3
```

Expected output:

```text
9 9 3
```

Sample 2 input:

```text
1 4 4 8
4
```

Expected output:

```text
4
```

### Progressive hints (private until purchased)

1. Trace the next unread position after one successful fold.
2. Both original members of a matched pair have been consumed.
3. In the matching branch, advance past two input positions. The unmatched branch still consumes only one.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int x;
    int y;
    int z;
    scanf("%d", &n);
    scanf("%d", &x);
    scanf("%d", &y);
    scanf("%d", &z);
    int a[100] = {0};
    for (int j = 0; j < n; j++) {
        scanf("%d", &a[j]);
    }
    int i = 0;
    while (i < n) {
        int match = 0;
        if (i + 1 < n) {
            if (a[i] == x && a[i + 1] == y) {
                match = 1;
            }
        }
        if (match == 1) {
            printf("%d ", (z));
            i += 1;
        } else {
            printf("%d ", (a[i]));
            i++;
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
    int n;
    int x;
    int y;
    int z;
    cin >> n;
    cin >> x;
    cin >> y;
    cin >> z;
    int a[100] = {0};
    for (int j = 0; j < n; j++) {
        cin >> a[j];
    }
    int i = 0;
    while (i < n) {
        int match = 0;
        if (i + 1 < n) {
            if (a[i] == x && a[i + 1] == y) {
                match = 1;
            }
        }
        if (match == 1) {
            cout << (z) << ' ';
            i += 1;
        } else {
            cout << (a[i]) << ' ';
            i++;
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
        int n;
        int x;
        int y;
        int z;
        n = scanner.nextInt();
        x = scanner.nextInt();
        y = scanner.nextInt();
        z = scanner.nextInt();
        int[] a = new int[100];
        for (int j = 0; j < n; j++) {
            a[j] = scanner.nextInt();
        }
        int i = 0;
        while (i < n) {
            int match = 0;
            if (i + 1 < n) {
                if (a[i] == x && a[i + 1] == y) {
                    match = 1;
                }
            }
            if (match == 1) {
                System.out.print((z) + " ");
                i += 1;
            } else {
                System.out.print((a[i]) + " ");
                i++;
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
x = read_int()
y = read_int()
z = read_int()
a = [read_int() for _ in range(n)]
result = []
i = 0
while i < n:
    match = False
    if i + 1 < n:
        if a[i] == x and a[i + 1] == y:
            match = True
    if match:
        result.append(z)
        i += 1
    else:
        result.append(a[i])
        i += 1
print(*result)
```

---

## 24. Settling Storage Columns

ARRAYS · Difficulty 35 · Bounty 890

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS left floating crates in storage. Ishan repairs the supplied column-settling pass.

What the code should do
Treat `0` as an empty cell and positive values as crate labels. Independently slide all crates in each column downward until no empty cells remain below a crate. Preserve the top-to-bottom order of crates in each column. Crates never move between columns.

What's going wrong
Crates remain at their old heights instead of falling into empty cells.

How to read the code
`table` is the original grid and `settled` starts empty. For each column, `write` marks the next free destination from the bottom. Reading bottom to top keeps vertical order.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `rows` and `cols`, then `rows * cols` cell values in row order.

Output
Print the settled grid in row order, separated by spaces. Line breaks between rows are optional.

Example explained
A one-column grid `4 0 7 0` settles to `0 0 4 7`.

Limits
`1 <= rows, cols <= 10`. Each cell is from `0` to `9`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 1
4
0
7
0
```

Expected output:

```text
0 0 4 7
```

Sample 2 input:

```text
1 1
0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Use one column with a crate above an empty cell.
2. The read row and the next free destination row describe different things.
3. Keep the source row in the read expression, but use the destination row tracked by `write` for the write expression.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int rows;
    int cols;
    scanf("%d", &rows);
    scanf("%d", &cols);
    int table[100] = {0};
    int settled[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        scanf("%d", &table[i]);
    }
    for (int column = 0; column < cols; column++) {
        int write = rows - 1;
        for (int row = rows - 1; row >= 0; row--) {
            if (table[row * cols + column] != 0) {
                settled[row * cols + column] = table[row * cols + column];
                write--;
            }
        }
    }
    for (int i = 0; i < rows * cols; i++) {
        printf("%d ", (settled[i]));
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
    int rows;
    int cols;
    cin >> rows;
    cin >> cols;
    int table[100] = {0};
    int settled[100] = {0};
    for (int i = 0; i < rows * cols; i++) {
        cin >> table[i];
    }
    for (int column = 0; column < cols; column++) {
        int write = rows - 1;
        for (int row = rows - 1; row >= 0; row--) {
            if (table[row * cols + column] != 0) {
                settled[row * cols + column] = table[row * cols + column];
                write--;
            }
        }
    }
    for (int i = 0; i < rows * cols; i++) {
        cout << (settled[i]) << ' ';
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
        int rows;
        int cols;
        rows = scanner.nextInt();
        cols = scanner.nextInt();
        int[] table = new int[100];
        int[] settled = new int[100];
        for (int i = 0; i < rows * cols; i++) {
            table[i] = scanner.nextInt();
        }
        for (int column = 0; column < cols; column++) {
            int write = rows - 1;
            for (int row = rows - 1; row >= 0; row--) {
                if (table[row * cols + column] != 0) {
                    settled[row * cols + column] = table[row * cols + column];
                    write--;
                }
            }
        }
        for (int i = 0; i < rows * cols; i++) {
            System.out.print((settled[i]) + " ");
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

rows = read_int()
cols = read_int()
table = [read_int() for _ in range(rows * cols)]
settled = [0] * (rows * cols)
for column in range(cols):
    write = rows - 1
    for row in range(rows - 1, -1, -1):
        if table[row * cols + column] != 0:
            settled[row * cols + column] = table[row * cols + column]
            write -= 1
print(*settled)
```

---

## 25. Safe Range Labels

ARRAYS · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS allowed labels outside a safe range. Mira restores the boundary replacement rule.

What the code should do
For each value, replace it with `low` if it is below `low`, with `high` if it is above `high`, and otherwise keep it unchanged. Preserve order. Both endpoints are allowed.

What's going wrong
Values above the permitted upper bound are replaced by the lower bound.

How to read the code
`value` starts as one input label. The lower and upper checks bring it into the permitted range independently.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `low`, and `high`, then `n` integer values.

Output
Print all `n` adjusted values separated by spaces.

Example explained
With range `[2, 6]`, the values `0 2 4 9` become `2 2 4 6`.

Limits
`1 <= n <= 100`; `-100 <= low <= high <= 100`. Input values are from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 2 6
0 2 4 9
```

Expected output:

```text
2 2 4 6
```

Sample 2 input:

```text
1 3 3
3
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. Try one value greater than `high`.
2. The two outside regions need different replacement endpoints.
3. The upper-bound branch should choose the upper endpoint, just as the lower-bound branch chooses the lower endpoint.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int low;
    int high;
    scanf("%d", &n);
    scanf("%d", &low);
    scanf("%d", &high);
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        if (value < low) {
            value = low;
        }
        if (value > high) {
            value = low;
        }
        printf("%d ", (value));
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
    int low;
    int high;
    cin >> n;
    cin >> low;
    cin >> high;
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        if (value < low) {
            value = low;
        }
        if (value > high) {
            value = low;
        }
        cout << (value) << ' ';
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
        int low;
        int high;
        n = scanner.nextInt();
        low = scanner.nextInt();
        high = scanner.nextInt();
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            if (value < low) {
                value = low;
            }
            if (value > high) {
                value = low;
            }
            System.out.print((value) + " ");
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
low = read_int()
high = read_int()
result = []
for _ in range(n):
    value = read_int()
    if value < low:
        value = low
    if value > high:
        value = low
    result.append(value)
print(*result)
```

---

## 26. Sector Offset Split

SYSTEMS · Difficulty 8 · Bounty 290

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS corrupted a storage locator. Mira needs the sector and position of one byte.

What the code should do
Storage is divided into sectors of `size` bytes, numbered from 0. Byte addresses also start at 0. Print the sector containing `address` and the offset of that byte within its sector. The offset must be from 0 through `size - 1`.

What's going wrong
The sector can be correct while the position inside it is wrong.

How to read the code
`address` counts bytes from the start of storage. `sector` names a fixed-size group; `offset` is a position inside that group. Read the two calculations separately.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `address`, then `size`.

Output
Print the sector number and offset, separated by a space.

Example explained
Input `19 8` places the byte in sector 2, at offset 3. Print `2 3`.

Limits
`0 <= address <= 10000`. `1 <= size <= 128`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
19 8
```

Expected output:

```text
2 3
```

Sample 2 input:

```text
0 4
```

Expected output:

```text
0 0
```

### Progressive hints (private until purchased)

1. Test an address inside the first sector.
2. Whole-number division counts complete sectors before the byte.
3. Use the remainder after division by `size` for `offset`; leave the sector calculation alone.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int address, size;
    scanf("%d", &address);
    scanf("%d", &size);
    int sector = address / size;
    int offset = address / size;
    printf("%d ", (sector));
    printf("%d ", (offset));
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
    int address, size;
    cin >> address;
    cin >> size;
    int sector = address / size;
    int offset = address / size;
    cout << (sector) << ' ';
    cout << (offset) << ' ';
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
        int address, size;
        address = scanner.nextInt();
        size = scanner.nextInt();
        int sector = address / size;
        int offset = address / size;
        System.out.print((sector) + " ");
        System.out.print((offset) + " ");
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

address = read_int()
size = read_int()
sector = address // size
offset = address // size
print(sector, offset)
```

---

## 27. Payload Only Meter

SYSTEMS · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS inflated a recovery link's data meter. Patch checks the useful bytes in received packets.

What the code should do
Every packet has a header of `header` bytes. Each supplied frame length includes that header. Add the message bytes from every frame, excluding the header of each packet. A header-only packet contributes 0.

What's going wrong
Header bytes can appear in the reported message total.

How to read the code
Each `frame` includes both a header and message data. `payload` holds only that frame's message data; `total` combines the data lengths.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `header`, then `n` frame lengths.

Output
Print the total message bytes.

Example explained
Input `3 2 7 2 5` has message lengths 5, 0 and 3. Print `8`.

Limits
`1 <= n <= 50`. `0 <= header <= 20`. `header <= frame <= 200` for every frame.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
7 2 5
```

Expected output:

```text
8
```

Sample 2 input:

```text
2 0
4 9
```

Expected output:

```text
13
```

### Progressive hints (private until purchased)

1. A packet with no message data should contribute nothing.
2. Locate the conversion from a full frame length to `payload`.
3. Remove one `header` from each frame before adding its payload to `total`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, header;
    scanf("%d", &n);
    scanf("%d", &header);
    int total = 0;
    for (int i = 0; i < n; i++) {
        int frame;
        scanf("%d", &frame);
        int payload = frame;
        total += payload;
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
    int n, header;
    cin >> n;
    cin >> header;
    int total = 0;
    for (int i = 0; i < n; i++) {
        int frame;
        cin >> frame;
        int payload = frame;
        total += payload;
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
        int n, header;
        n = scanner.nextInt();
        header = scanner.nextInt();
        int total = 0;
        for (int i = 0; i < n; i++) {
            int frame;
            frame = scanner.nextInt();
            int payload = frame;
            total += payload;
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
header = read_int()
total = 0
for _ in range(n):
    frame = read_int()
    payload = frame
    total += payload
print(total)
```

---

## 28. Truncate Without Growth

SYSTEMS · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered the archive trimmer. Mira checks that trimming cannot create bytes.

What the code should do
Start with a file of `length` bytes. Process the trim limits in order. If the file is longer than a limit, shorten it to that limit. Otherwise leave it unchanged. A trim never extends the file.

What's going wrong
A trim command with a larger limit can grow the file.

How to read the code
`length` is the current file length. Each `limit` is a maximum length requested by one trim command. The loop carries the current length into the next command.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `length` and `n`, then `n` trim limits.

Output
Print the final file length.

Example explained
Input `12 3 8 20 6` changes the length to 8, leaves it at 8, then changes it to 6. Print `6`.

Limits
`0 <= length <= 1000`. `0 <= n <= 50`. Each `limit` is from 0 through 1000.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
12 3
8 20 6
```

Expected output:

```text
6
```

Sample 2 input:

```text
4 1
4
```

Expected output:

```text
4
```

### Progressive hints (private until purchased)

1. Try trimming a short file with a much larger limit.
2. The assignment is only valid when it reduces the current length.
3. Enter the update branch only when `limit` is smaller than `length`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int length, n;
    scanf("%d", &length);
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        int limit;
        scanf("%d", &limit);
        if (limit != length) {
            length = limit;
        }
    }
    printf("%d ", (length));
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
    int length, n;
    cin >> length;
    cin >> n;
    for (int i = 0; i < n; i++) {
        int limit;
        cin >> limit;
        if (limit != length) {
            length = limit;
        }
    }
    cout << (length) << ' ';
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
        int length, n;
        length = scanner.nextInt();
        n = scanner.nextInt();
        for (int i = 0; i < n; i++) {
            int limit;
            limit = scanner.nextInt();
            if (limit != length) {
                length = limit;
            }
        }
        System.out.print((length) + " ");
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

length = read_int()
n = read_int()
for _ in range(n):
    limit = read_int()
    if limit != length:
        length = limit
print(length)
```

---

## 29. Overwrite End Marker

SYSTEMS · Difficulty 16 · Bounty 470

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS damaged an archive's length tracker. Patch checks writes that overlap the old end.

What the code should do
Process writes in order. A write covers positions `start` through `start + amount - 1`. Extend the file to `start + amount` if that is beyond its current length. Otherwise keep the old length. Gaps are allowed and count toward the length.

What's going wrong
A write that begins inside the file can extend past its end without updating the length.

How to read the code
A write starts at `start` and covers `amount` bytes. `end` is the position just after those bytes. `length` marks the position just after the current file.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read the initial `length` and `n`, then `n` pairs `start amount`.

Output
Print the final file length.

Example explained
Input `5 2 3 4 0 2` first extends the file to 7 bytes. The second write stays inside it. Print `7`.

Limits
`0 <= length <= 1000`. `0 <= n <= 50`. `0 <= start <= 1000`. `1 <= amount <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 2
3 4
0 2
```

Expected output:

```text
7
```

Sample 2 input:

```text
10 1
2 3
```

Expected output:

```text
10
```

### Progressive hints (private until purchased)

1. A write may start before the old end but finish after it.
2. Compare the roles of `start` and `end` in deciding whether the file grows.
3. Test the position just after the write against `length`, and retain the existing update.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int length, n;
    scanf("%d", &length);
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        int start, amount;
        scanf("%d", &start);
        scanf("%d", &amount);
        int end = start + amount;
        if (start > length) {
            length = end;
        }
    }
    printf("%d ", (length));
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
    int length, n;
    cin >> length;
    cin >> n;
    for (int i = 0; i < n; i++) {
        int start, amount;
        cin >> start;
        cin >> amount;
        int end = start + amount;
        if (start > length) {
            length = end;
        }
    }
    cout << (length) << ' ';
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
        int length, n;
        length = scanner.nextInt();
        n = scanner.nextInt();
        for (int i = 0; i < n; i++) {
            int start, amount;
            start = scanner.nextInt();
            amount = scanner.nextInt();
            int end = start + amount;
            if (start > length) {
                length = end;
            }
        }
        System.out.print((length) + " ");
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

length = read_int()
n = read_int()
for _ in range(n):
    start = read_int()
    amount = read_int()
    end = start + amount
    if start > length:
        length = end
print(length)
```

---

## 30. Cursor at End

SYSTEMS · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a file reader. Mira checks repeated reads near the end of a file.

What the code should do
A file has `length` bytes and starts with its read cursor at 0. For each request, return as many bytes as requested, or all remaining bytes if fewer remain. Advance the cursor only by the bytes returned. Reads at the end return 0. Print the final cursor and total returned bytes.

What's going wrong
After a short read, the cursor can move beyond the file.

How to read the code
`cursor` is the next byte position to read. `take` starts as a requested length and is limited by the unread bytes. `served` counts bytes actually returned.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `length` and `n`, then `n` requested byte counts.

Output
Print the final cursor and total returned bytes.

Example explained
Input `5 2 3 4` returns 3 bytes, then 2. Print `5 5`.

Limits
`0 <= length <= 1000`. `0 <= n <= 50`. Each `request` is from 0 through 1000.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 2
3 4
```

Expected output:

```text
5 5
```

Sample 2 input:

```text
8 2
3 2
```

Expected output:

```text
5 5
```

### Progressive hints (private until purchased)

1. Trace a request larger than the unread part of the file.
2. `request` and `take` can differ after the limit check.
3. The cursor and `served` should both advance by the actual transfer length.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int length, n;
    scanf("%d", &length);
    scanf("%d", &n);
    int cursor = 0;
    int served = 0;
    for (int i = 0; i < n; i++) {
        int request;
        scanf("%d", &request);
        int take = request;
        if (take > length - cursor) {
            take = length - cursor;
        }
        cursor += request;
        served += take;
    }
    printf("%d ", (cursor));
    printf("%d ", (served));
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
    int length, n;
    cin >> length;
    cin >> n;
    int cursor = 0;
    int served = 0;
    for (int i = 0; i < n; i++) {
        int request;
        cin >> request;
        int take = request;
        if (take > length - cursor) {
            take = length - cursor;
        }
        cursor += request;
        served += take;
    }
    cout << (cursor) << ' ';
    cout << (served) << ' ';
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
        int length, n;
        length = scanner.nextInt();
        n = scanner.nextInt();
        int cursor = 0;
        int served = 0;
        for (int i = 0; i < n; i++) {
            int request;
            request = scanner.nextInt();
            int take = request;
            if (take > length - cursor) {
                take = length - cursor;
            }
            cursor += request;
            served += take;
        }
        System.out.print((cursor) + " ");
        System.out.print((served) + " ");
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

length = read_int()
n = read_int()
cursor = 0
served = 0
for _ in range(n):
    request = read_int()
    take = request
    if take > length - cursor:
        take = length - cursor
    cursor += request
    served += take
print(cursor, served)
```

---

## 31. Severity Byte Filter

SYSTEMS · Difficulty 9 · Bounty 320

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a recovery log filter. Patch measures the records that should be kept.

What the code should do
Keep each record whose severity is at least `threshold`. Add its byte length to the total. Ignore lower-severity records. Severity equality qualifies.

What's going wrong
Records exactly at the configured importance level can disappear.

How to read the code
`severity` is a record's importance level, and `bytes` is its stored length. `threshold` determines eligibility; `total` counts stored bytes rather than records.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `threshold`, then `n` pairs `severity bytes`.

Output
Print the total bytes kept.

Example explained
Input `3 2 1 9 2 4 4 7` keeps the last two records. Print `11`.

Limits
`0 <= n <= 50`. `0 <= threshold, severity <= 5`. `1 <= bytes <= 200`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
1 9
2 4
4 7
```

Expected output:

```text
11
```

Sample 2 input:

```text
1 3
5 20
```

Expected output:

```text
20
```

### Progressive hints (private until purchased)

1. Test a record whose severity equals the threshold.
2. Read the words 'at least' in the rule.
3. The keep condition needs to accept both higher and equal severity values.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, threshold;
    scanf("%d", &n);
    scanf("%d", &threshold);
    int total = 0;
    for (int i = 0; i < n; i++) {
        int severity, bytes;
        scanf("%d", &severity);
        scanf("%d", &bytes);
        if (severity > threshold) {
            total += bytes;
        }
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
    int n, threshold;
    cin >> n;
    cin >> threshold;
    int total = 0;
    for (int i = 0; i < n; i++) {
        int severity, bytes;
        cin >> severity;
        cin >> bytes;
        if (severity > threshold) {
            total += bytes;
        }
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
        int n, threshold;
        n = scanner.nextInt();
        threshold = scanner.nextInt();
        int total = 0;
        for (int i = 0; i < n; i++) {
            int severity, bytes;
            severity = scanner.nextInt();
            bytes = scanner.nextInt();
            if (severity > threshold) {
                total += bytes;
            }
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
threshold = read_int()
total = 0
for _ in range(n):
    severity = read_int()
    bytes = read_int()
    if severity > threshold:
        total += bytes
print(total)
```

---

## 32. Checksum Byte Wrap

SYSTEMS · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a packet checker. Mira verifies a simple eight-bit sum.

What the code should do
Start the checksum at 0. Add each byte in input order. After each addition, retain the remainder after division by 256. Print the final checksum. With no bytes, print 0.

What's going wrong
A total of 255 or more can wrap at the wrong point.

How to read the code
`checksum` is a running check value stored in the range 0 through 255. Each loop pass adds a byte, then brings the check value back into that range.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` byte values.

Output
Print one checksum from 0 through 255.

Example explained
Input `3 200 100 7` gives checksum values 200, 44 and 51. Print `51`.

Limits
`0 <= n <= 50`. Every byte `value` is from 0 through 255.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
200 100 7
```

Expected output:

```text
51
```

Sample 2 input:

```text
2
1 2
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. A single byte with value 255 must keep that value.
2. Count the integers from 0 through 255, including both ends.
3. Use the number of possible byte values as the remainder divisor.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int checksum = 0;
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        checksum = (checksum + value) % 255;
    }
    printf("%d ", (checksum));
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
    int checksum = 0;
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        checksum = (checksum + value) % 255;
    }
    cout << (checksum) << ' ';
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
        int checksum = 0;
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            checksum = (checksum + value) % 255;
        }
        System.out.print((checksum) + " ");
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
checksum = 0
for _ in range(n):
    value = read_int()
    checksum = (checksum + value) % 255
print(checksum)
```

---

## 33. Minimum Packet Padding

SYSTEMS · Difficulty 14 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed the recovery sender's padding rule. Patch checks the bytes placed on the link.

What the code should do
Each packet must send at least `minimum` bytes. If its payload is shorter, add only enough padding to reach `minimum`. Longer payloads stay unchanged. Add all sent lengths. Headers are outside this model and cost no bytes.

What's going wrong
Short packets can be larger than the required minimum.

How to read the code
`payload` is the real data length. `sent` starts at that length and may be enlarged to satisfy a minimum packet size. Padding affects wire bytes only.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `minimum`, then `n` payload lengths.

Output
Print the total bytes sent, including padding.

Example explained
Input `3 8 3 8 10` sends lengths 8, 8 and 10. Print `26`.

Limits
`0 <= n <= 50`. `1 <= minimum <= 100`. `0 <= payload <= 200`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 8
3 8 10
```

Expected output:

```text
26
```

Sample 2 input:

```text
2 4
4 9
```

Expected output:

```text
13
```

### Progressive hints (private until purchased)

1. A three-byte payload with an eight-byte minimum needs five padding bytes.
2. Look at the update to `sent` in the short-packet branch.
3. That branch's final `sent` value should be exactly `minimum`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, minimum;
    scanf("%d", &n);
    scanf("%d", &minimum);
    int total = 0;
    for (int i = 0; i < n; i++) {
        int payload;
        scanf("%d", &payload);
        int sent = payload;
        if (sent < minimum) {
            sent += minimum;
        }
        total += sent;
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
    int n, minimum;
    cin >> n;
    cin >> minimum;
    int total = 0;
    for (int i = 0; i < n; i++) {
        int payload;
        cin >> payload;
        int sent = payload;
        if (sent < minimum) {
            sent += minimum;
        }
        total += sent;
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
        int n, minimum;
        n = scanner.nextInt();
        minimum = scanner.nextInt();
        int total = 0;
        for (int i = 0; i < n; i++) {
            int payload;
            payload = scanner.nextInt();
            int sent = payload;
            if (sent < minimum) {
                sent += minimum;
            }
            total += sent;
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
minimum = read_int()
total = 0
for _ in range(n):
    payload = read_int()
    sent = payload
    if sent < minimum:
        sent += minimum
    total += sent
print(total)
```

---

## 34. Final Buffer Dispatch

SYSTEMS · Difficulty 20 · Bounty 560

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a log sender. Mira checks that the last partly filled buffer is sent.

What the code should do
Records arrive in order and cannot be split. Start with an empty buffer of `capacity` bytes. Before adding a record that would exceed capacity, flush the current buffer. Add the record to the now available space. After all records, flush once if the buffer is nonempty. Exact fits may stay until the next record or the end. Count all flushes.

What's going wrong
A final group smaller than the buffer capacity can be left unsent.

How to read the code
`pending` counts bytes in the current buffer. A flush sends that entire buffer and makes it empty. `flushes` counts dispatches, not bytes.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `capacity` and `n`, then `n` record lengths.

Output
Print the number of flushes.

Example explained
Input `5 3 3 3 1` flushes the first record before adding the second, then flushes the final four bytes. Print `2`.

Limits
`1 <= capacity <= 100`. `0 <= n <= 50`. Every `size` satisfies `1 <= size <= capacity`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 3
3 3 1
```

Expected output:

```text
2
```

Sample 2 input:

```text
4 2
2 2
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Try one record smaller than the capacity.
2. The loop handles overflow, but the final check handles data left at the end.
3. The final dispatch depends on whether `pending` is nonzero, not whether it fills the buffer.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, n;
    scanf("%d", &capacity);
    scanf("%d", &n);
    int pending = 0;
    int flushes = 0;
    for (int i = 0; i < n; i++) {
        int size;
        scanf("%d", &size);
        if (pending + size > capacity) {
            flushes++;
            pending = 0;
        }
        pending += size;
    }
    if (pending == capacity) {
        flushes++;
    }
    printf("%d ", (flushes));
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
    int pending = 0;
    int flushes = 0;
    for (int i = 0; i < n; i++) {
        int size;
        cin >> size;
        if (pending + size > capacity) {
            flushes++;
            pending = 0;
        }
        pending += size;
    }
    if (pending == capacity) {
        flushes++;
    }
    cout << (flushes) << ' ';
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
        int pending = 0;
        int flushes = 0;
        for (int i = 0; i < n; i++) {
            int size;
            size = scanner.nextInt();
            if (pending + size > capacity) {
                flushes++;
                pending = 0;
            }
            pending += size;
        }
        if (pending == capacity) {
            flushes++;
        }
        System.out.print((flushes) + " ");
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
pending = 0
flushes = 0
for _ in range(n):
    size = read_int()
    if pending + size > capacity:
        flushes += 1
        pending = 0
    pending += size
if pending == capacity:
    flushes += 1
print(flushes)
```

---

## 35. Clean After Flush

SYSTEMS · Difficulty 17 · Bounty 490

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a save indicator. Patch checks repeated flushes of a recovery buffer.

What the code should do
Start with a clean buffer. Command 1 writes to it and makes it dirty. Command 2 flushes it: if dirty, count one save and make it clean; if clean, do nothing. There is no automatic flush at the end. Print the number of saves.

What's going wrong
An unchanged buffer can be saved again after it was already flushed.

How to read the code
`dirty` records whether an unsaved write exists. Several writes can share one later save. `saves` counts physical saves caused by flush commands.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` command codes.

Output
Print the number of physical saves.

Example explained
Input `5 1 1 2 2 1` saves once, on the first flush. The final write remains unsaved. Print `1`.

Limits
`0 <= n <= 50`. Each `op` is 1 or 2.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
1 1 2 2 1
```

Expected output:

```text
1
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

1. Try one write followed by two flushes.
2. Check the state after a successful save rather than the count update.
3. A successful flush must clear `dirty` before the next command.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int dirty = 0;
    int saves = 0;
    for (int i = 0; i < n; i++) {
        int op;
        scanf("%d", &op);
        if (op == 1) {
            dirty = 1;
        } else if (dirty == 1) {
            saves++;
            dirty = 1;
        }
    }
    printf("%d ", (saves));
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
    int dirty = 0;
    int saves = 0;
    for (int i = 0; i < n; i++) {
        int op;
        cin >> op;
        if (op == 1) {
            dirty = 1;
        } else if (dirty == 1) {
            saves++;
            dirty = 1;
        }
    }
    cout << (saves) << ' ';
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
        int dirty = 0;
        int saves = 0;
        for (int i = 0; i < n; i++) {
            int op;
            op = scanner.nextInt();
            if (op == 1) {
                dirty = 1;
            } else if (dirty == 1) {
                saves++;
                dirty = 1;
            }
        }
        System.out.print((saves) + " ");
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
dirty = 0
saves = 0
for _ in range(n):
    op = read_int()
    if op == 1:
        dirty = 1
    elif dirty == 1:
        saves += 1
        dirty = 1
print(saves)
```

---

## 36. Rejected Byte Ledger

SYSTEMS · Difficulty 14 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a full-buffer report. Mira measures data lost during a packet burst.

What the code should do
Start with an empty buffer of `capacity` bytes. For each arriving packet, keep it if its entire size fits in the remaining space. Otherwise reject it and add its full size to the dropped-byte total. Rejection uses no space. No packets leave during this burst.

What's going wrong
The loss report can count rejected packets instead of their byte lengths.

How to read the code
`used` counts buffer space already occupied. Each arriving packet is accepted whole or rejected whole. `dropped` measures lost bytes, not lost packets.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `capacity` and `n`, then `n` packet sizes.

Output
Print the occupied bytes and dropped bytes, in that order.

Example explained
Input `5 3 4 3 1` keeps 4 bytes, rejects 3, then keeps 1. Print `5 3`.

Limits
`0 <= capacity <= 200`. `0 <= n <= 50`. Every `size` is from 1 through 200.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 3
4 3 1
```

Expected output:

```text
5 3
```

Sample 2 input:

```text
8 2
3 5
```

Expected output:

```text
8 0
```

### Progressive hints (private until purchased)

1. Reject a packet longer than one byte.
2. The two totals use the same unit: bytes.
3. In the rejection branch, increase `dropped` by the rejected packet's full `size`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, n;
    scanf("%d", &capacity);
    scanf("%d", &n);
    int used = 0;
    int dropped = 0;
    for (int i = 0; i < n; i++) {
        int size;
        scanf("%d", &size);
        if (used + size <= capacity) {
            used += size;
        } else {
            dropped += 1;
        }
    }
    printf("%d ", (used));
    printf("%d ", (dropped));
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
    int used = 0;
    int dropped = 0;
    for (int i = 0; i < n; i++) {
        int size;
        cin >> size;
        if (used + size <= capacity) {
            used += size;
        } else {
            dropped += 1;
        }
    }
    cout << (used) << ' ';
    cout << (dropped) << ' ';
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
        int used = 0;
        int dropped = 0;
        for (int i = 0; i < n; i++) {
            int size;
            size = scanner.nextInt();
            if (used + size <= capacity) {
                used += size;
            } else {
                dropped += 1;
            }
        }
        System.out.print((used) + " ");
        System.out.print((dropped) + " ");
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
used = 0
dropped = 0
for _ in range(n):
    size = read_int()
    if used + size <= capacity:
        used += size
    else:
        dropped += 1
print(used, dropped)
```

---

## 37. Partial Buffer Drain

SYSTEMS · Difficulty 16 · Bounty 470

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a byte buffer. Patch checks requests that drain more data than is available.

What the code should do
Start with 0 queued bytes. Command `1 amount` appends that many bytes. Command `2 amount` removes up to that many bytes; if fewer are queued, remove all of them. Process commands in order. Draining an empty buffer does nothing.

What's going wrong
An oversized drain can leave every queued byte untouched.

How to read the code
`queued` counts available bytes. A drain's `amount` is reduced when fewer bytes are available. Appends in this model have no capacity limit.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` pairs `op amount`.

Output
Print the final queued byte count.

Example explained
Input `3 1 4 2 9 1 3` queues 4, drains all 4, then queues 3. Print `3`.

Limits
`0 <= n <= 50`. `op` is 1 or 2. `0 <= amount <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
1 4
2 9
1 3
```

Expected output:

```text
3
```

Sample 2 input:

```text
2
1 8
2 3
```

Expected output:

```text
5
```

### Progressive hints (private until purchased)

1. Ask to drain five bytes when only two are queued.
2. A short drain still transfers the bytes that are available.
3. When the drain exceeds `queued`, replace its `amount` with `queued` before subtracting.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int queued = 0;
    for (int i = 0; i < n; i++) {
        int op, amount;
        scanf("%d", &op);
        scanf("%d", &amount);
        if (op == 1) {
            queued += amount;
        } else {
            if (amount > queued) {
                amount = 0;
            }
            queued -= amount;
        }
    }
    printf("%d ", (queued));
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
    int queued = 0;
    for (int i = 0; i < n; i++) {
        int op, amount;
        cin >> op;
        cin >> amount;
        if (op == 1) {
            queued += amount;
        } else {
            if (amount > queued) {
                amount = 0;
            }
            queued -= amount;
        }
    }
    cout << (queued) << ' ';
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
        int queued = 0;
        for (int i = 0; i < n; i++) {
            int op, amount;
            op = scanner.nextInt();
            amount = scanner.nextInt();
            if (op == 1) {
                queued += amount;
            } else {
                if (amount > queued) {
                    amount = 0;
                }
                queued -= amount;
            }
        }
        System.out.print((queued) + " ");
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
queued = 0
for _ in range(n):
    op = read_int()
    amount = read_int()
    if op == 1:
        queued += amount
    else:
        if amount > queued:
            amount = 0
        queued -= amount
print(queued)
```

---

## 38. Suppressed Log Clock

SYSTEMS · Difficulty 20 · Bounty 560

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a repeated-alert limiter. Mira checks whether ignored alerts delay useful logs.

What the code should do
A log attempt at time `time` is written only if at least `cooldown` time units have passed since the last written log. The first attempt is always written. Suppressed attempts do not change the last-written time. Process nondecreasing timestamps and count written logs.

What's going wrong
A series of suppressed attempts can prevent a later eligible log.

How to read the code
`last` is the time of the last record actually written, not the last attempt. The sentinel `-cooldown` lets the first nonnegative timestamp qualify.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `cooldown`, then `n` timestamps.

Output
Print the number of logs written.

Example explained
Input `3 5 0 2 5` writes at 0 and 5. The attempt at 2 is ignored. Print `2`.

Limits
`0 <= n <= 50`. `1 <= cooldown <= 100`. `0 <= time <= 1000`. Timestamps are nondecreasing and may repeat.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 5
0 2 5
```

Expected output:

```text
2
```

Sample 2 input:

```text
2 4
0 4
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Insert a suppressed attempt between two times exactly one cooldown apart.
2. Ask which event `last` is meant to remember.
3. Keep the `last` update inside the same branch that increments `written`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, cooldown;
    scanf("%d", &n);
    scanf("%d", &cooldown);
    int last = -cooldown;
    int written = 0;
    for (int i = 0; i < n; i++) {
        int time;
        scanf("%d", &time);
        if (time - last >= cooldown) {
            written++;
        }
        last = time;
    }
    printf("%d ", (written));
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
    int n, cooldown;
    cin >> n;
    cin >> cooldown;
    int last = -cooldown;
    int written = 0;
    for (int i = 0; i < n; i++) {
        int time;
        cin >> time;
        if (time - last >= cooldown) {
            written++;
        }
        last = time;
    }
    cout << (written) << ' ';
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
        int n, cooldown;
        n = scanner.nextInt();
        cooldown = scanner.nextInt();
        int last = -cooldown;
        int written = 0;
        for (int i = 0; i < n; i++) {
            int time;
            time = scanner.nextInt();
            if (time - last >= cooldown) {
                written++;
            }
            last = time;
        }
        System.out.print((written) + " ");
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
cooldown = read_int()
last = -cooldown
written = 0
for _ in range(n):
    time = read_int()
    if time - last >= cooldown:
        written += 1
    last = time
print(written)
```

---

## 39. Empty File Still Exists

SYSTEMS · Difficulty 14 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS damaged a directory size report. Patch checks storage charged for empty files.

What the code should do
For each directory slot, ignore `-1`, which means unused. Otherwise charge its file length plus `metadata` bytes. A zero-byte file exists and still pays the metadata charge. Add all charges.

What's going wrong
A zero-byte file can lose its metadata charge.

How to read the code
A directory entry of `-1` means no file. A nonnegative entry is a file length, including length 0. Every existing file also consumes `metadata` bytes.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `metadata`, then `n` directory entries.

Output
Print the total charged bytes.

Example explained
Input `3 2 -1 0 5` ignores the unused slot and charges 2 and 7. Print `9`.

Limits
`1 <= n <= 50`. `1 <= metadata <= 20`. Each `size` is -1 or an integer from 0 through 200.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
-1 0 5
```

Expected output:

```text
9
```

Sample 2 input:

```text
2 3
4 8
```

Expected output:

```text
18
```

### Progressive hints (private until purchased)

1. Compare an unused directory slot with a real empty file.
2. Only one sentinel value means that no file exists.
3. Include size 0 in the charged branch while continuing to exclude -1.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, metadata;
    scanf("%d", &n);
    scanf("%d", &metadata);
    int total = 0;
    for (int i = 0; i < n; i++) {
        int size;
        scanf("%d", &size);
        if (size > 0) {
            total += size + metadata;
        }
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
    int n, metadata;
    cin >> n;
    cin >> metadata;
    int total = 0;
    for (int i = 0; i < n; i++) {
        int size;
        cin >> size;
        if (size > 0) {
            total += size + metadata;
        }
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
        int n, metadata;
        n = scanner.nextInt();
        metadata = scanner.nextInt();
        int total = 0;
        for (int i = 0; i < n; i++) {
            int size;
            size = scanner.nextInt();
            if (size > 0) {
                total += size + metadata;
            }
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
metadata = read_int()
total = 0
for _ in range(n):
    size = read_int()
    if size > 0:
        total += size + metadata
print(total)
```

---

## 40. One Terminator per Record

SYSTEMS · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed the log storage meter. Mira checks the byte used to end each record.

What the code should do
Each input word is stored as one log record. Every letter uses one byte, and each record also has one ending byte. Add the stored sizes of all records. Even a one-letter record uses two bytes.

What's going wrong
Record text is counted, but record endings can be missing from the total.

How to read the code
`word` is one log record without its ending marker. `length` counts the letters; `total` measures the stored bytes after framing every record.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` nonempty lowercase words.

Output
Print the total stored bytes, including one ending byte per record.

Example explained
Input `2 go wait` stores 3 and 5 bytes. Print `8`.

Limits
`1 <= n <= 30`. Each `word` has 1 through 40 lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
go wait
```

Expected output:

```text
8
```

Sample 2 input:

```text
1
a
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Count both parts of one stored record.
2. The input word does not contain its stored ending byte.
3. Add one ending byte each time a word's length is added to `total`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int total = 0;
    for (int i = 0; i < n; i++) {
        char word[257];
        scanf("%256s", word);
        int length = (int)strlen(word);
        total += length;
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
    int total = 0;
    for (int i = 0; i < n; i++) {
        string word;
        cin >> word;
        int length = (int)word.size();
        total += length;
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
        int total = 0;
        for (int i = 0; i < n; i++) {
            String word;
            word = scanner.next();
            int length = word.length();
            total += length;
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
total = 0
for _ in range(n):
    word = read_word()
    length = len(word)
    total += length
print(total)
```

---

## 41. Drive Travel Ledger

SYSTEMS · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a disk movement report. Patch checks a fixed list of recovery reads.

What the code should do
Visit every requested track in the given order; do not reorder requests. Moving between two tracks costs the absolute difference of their numbers. Add all movement, including moves toward smaller numbers. A repeated track costs 0.

What's going wrong
Moving toward a lower-numbered track can reduce the travel total.

How to read the code
`head` is the drive's current numbered track. `move` is a signed difference until its direction is removed. `travel` counts distance in both directions.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read the initial `head` and `n`, then `n` requested tracks.

Output
Print the total distance moved.

Example explained
Input `10 3 14 9 9` costs 4, 5 and 0. Print `9`.

Limits
`0 <= head, track <= 200`. `0 <= n <= 50`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
10 3
14 9 9
```

Expected output:

```text
9
```

Sample 2 input:

```text
0 2
3 7
```

Expected output:

```text
7
```

### Progressive hints (private until purchased)

1. A trip from track 8 to track 3 costs five units, not minus five.
2. Check what the negative-move branch does to `move`.
3. Negate a negative `move` before adding it to `travel`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int head, n;
    scanf("%d", &head);
    scanf("%d", &n);
    int travel = 0;
    for (int i = 0; i < n; i++) {
        int track;
        scanf("%d", &track);
        int move = track - head;
        if (move < 0) {
            move = move;
        }
        travel += move;
        head = track;
    }
    printf("%d ", (travel));
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
    int head, n;
    cin >> head;
    cin >> n;
    int travel = 0;
    for (int i = 0; i < n; i++) {
        int track;
        cin >> track;
        int move = track - head;
        if (move < 0) {
            move = move;
        }
        travel += move;
        head = track;
    }
    cout << (travel) << ' ';
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
        int head, n;
        head = scanner.nextInt();
        n = scanner.nextInt();
        int travel = 0;
        for (int i = 0; i < n; i++) {
            int track;
            track = scanner.nextInt();
            int move = track - head;
            if (move < 0) {
                move = move;
            }
            travel += move;
            head = track;
        }
        System.out.print((travel) + " ");
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

head = read_int()
n = read_int()
travel = 0
for _ in range(n):
    track = read_int()
    move = track - head
    if move < 0:
        move = move
    travel += move
    head = track
print(travel)
```

---

## 42. Block Wear Allowance

SYSTEMS · Difficulty 19 · Bounty 540

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a storage wear limit. Mira checks that every block gets its own write allowance.

What the code should do
Each of `blocks` storage blocks begins with 0 writes. Accept a write only while that block has received fewer than `limit` successful writes. Acceptance increases that block's write count and the total accepted count. Rejection changes neither. The allowance is separate for every block.

What's going wrong
Writing one block many times can stop writes to other fresh blocks.

How to read the code
`wear[block]` counts successful writes to one storage block. A request that reaches a worn-out block is ignored. The total `accepted` combines successful requests.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `blocks`, `limit` and `n`, then `n` requested block IDs.

Output
Print the number of accepted writes.

Example explained
Input `2 1 3 0 0 1` accepts the first write to each block, so print `2`.

Limits
`1 <= blocks <= 20`. `1 <= limit <= 10`. `0 <= n <= 50`. `0 <= block < blocks`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1 3
0 0 1
```

Expected output:

```text
2
```

Sample 2 input:

```text
1 2 3
0 0 0
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Exhaust one block's allowance, then request a different block.
2. The storage limit applies independently to each block.
3. Use the requested block's entry in `wear` for the acceptance comparison.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int blocks, limit, n;
    scanf("%d", &blocks);
    scanf("%d", &limit);
    scanf("%d", &n);
    int wear[20] = {0};
    int accepted = 0;
    for (int i = 0; i < n; i++) {
        int block;
        scanf("%d", &block);
        if (accepted < limit) {
            wear[block]++;
            accepted++;
        }
    }
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
    int blocks, limit, n;
    cin >> blocks;
    cin >> limit;
    cin >> n;
    int wear[20] = {0};
    int accepted = 0;
    for (int i = 0; i < n; i++) {
        int block;
        cin >> block;
        if (accepted < limit) {
            wear[block]++;
            accepted++;
        }
    }
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
        int blocks, limit, n;
        blocks = scanner.nextInt();
        limit = scanner.nextInt();
        n = scanner.nextInt();
        int[] wear = new int[20];
        int accepted = 0;
        for (int i = 0; i < n; i++) {
            int block;
            block = scanner.nextInt();
            if (accepted < limit) {
                wear[block]++;
                accepted++;
            }
        }
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

blocks = read_int()
limit = read_int()
n = read_int()
wear = [0] * blocks
accepted = 0
for _ in range(n):
    block = read_int()
    if accepted < limit:
        wear[block] += 1
        accepted += 1
print(accepted)
```

---

## 43. Shared Log Header

SYSTEMS · Difficulty 20 · Bounty 560

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS changed a log quota calculator. Patch checks records stored after the first one.

What the code should do
An empty log has `capacity` bytes available. Its first accepted record costs its size plus one `header`. Later accepted records cost only their own size. Accept a record if its full cost fits; otherwise ignore it. A rejected first record does not create a header. All record sizes are positive.

What's going wrong
Later records can be rejected because the shared header is charged again.

How to read the code
`used` includes all stored bytes. `extra` is the price of the next record. An empty log needs one shared header before its first accepted record.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `capacity`, `header` and `n`, then `n` record sizes.

Output
Print the accepted record count and total stored bytes.

Example explained
Input `10 2 3 3 4 2` accepts sizes 3 and 4 for a total of 9 bytes, then rejects size 2. Print `2 9`.

Limits
`0 <= capacity <= 200`. `1 <= header <= 20`. `0 <= n <= 50`. `1 <= size <= 200`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
10 2 3
3 4 2
```

Expected output:

```text
2 9
```

Sample 2 input:

```text
5 2 1
3
```

Expected output:

```text
1 5
```

### Progressive hints (private until purchased)

1. Compare the cost of the first accepted record with the second.
2. Only an empty log still needs its shared header.
3. Guard the header addition using the current empty-log condition on `used`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, header, n;
    scanf("%d", &capacity);
    scanf("%d", &header);
    scanf("%d", &n);
    int used = 0;
    int accepted = 0;
    for (int i = 0; i < n; i++) {
        int size;
        scanf("%d", &size);
        int extra = size;
        if (size > 0) {
            extra += header;
        }
        if (used + extra <= capacity) {
            used += extra;
            accepted++;
        }
    }
    printf("%d ", (accepted));
    printf("%d ", (used));
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
    int capacity, header, n;
    cin >> capacity;
    cin >> header;
    cin >> n;
    int used = 0;
    int accepted = 0;
    for (int i = 0; i < n; i++) {
        int size;
        cin >> size;
        int extra = size;
        if (size > 0) {
            extra += header;
        }
        if (used + extra <= capacity) {
            used += extra;
            accepted++;
        }
    }
    cout << (accepted) << ' ';
    cout << (used) << ' ';
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
        int capacity, header, n;
        capacity = scanner.nextInt();
        header = scanner.nextInt();
        n = scanner.nextInt();
        int used = 0;
        int accepted = 0;
        for (int i = 0; i < n; i++) {
            int size;
            size = scanner.nextInt();
            int extra = size;
            if (size > 0) {
                extra += header;
            }
            if (used + extra <= capacity) {
                used += extra;
                accepted++;
            }
        }
        System.out.print((accepted) + " ");
        System.out.print((used) + " ");
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
header = read_int()
n = read_int()
used = 0
accepted = 0
for _ in range(n):
    size = read_int()
    extra = size
    if size > 0:
        extra += header
    if used + extra <= capacity:
        used += extra
        accepted += 1
print(accepted, used)
```

---

## 44. Seek from File End

SYSTEMS · Difficulty 23 · Bounty 630

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a file seek command. Mira checks recovery reads positioned relative to the file end.

What the code should do
A file has `length` bytes and starts with cursor 0. Process seek pairs `origin offset`. Origin 0 uses base 0; origin 1 uses the current cursor; origin 2 uses the file length. Set the cursor to base plus the signed offset, then clamp it to the range 0 through `length`, including both ends. Seeks never change the file length.

What's going wrong
An end-relative seek can behave like a current-relative seek.

How to read the code
`base` selects an origin before applying `offset`. The three origins are the beginning, current cursor, and file end. The two bounds checks keep `cursor` inside the file.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `length` and `n`, then `n` pairs `origin offset`.

Output
Print the final cursor.

Example explained
Input `10 2 0 3 2 -2` seeks to 3, then two bytes before the end. Print `8`.

Limits
`0 <= length <= 1000`. `0 <= n <= 50`. `origin` is 0, 1 or 2. `-1000 <= offset <= 1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
10 2
0 3
2 -2
```

Expected output:

```text
8
```

Sample 2 input:

```text
8 2
0 3
1 2
```

Expected output:

```text
5
```

### Progressive hints (private until purchased)

1. Try an end-relative seek while the cursor is still at the beginning.
2. Origins 1 and 2 must use different bases unless the cursor already equals the file length.
3. Select the fixed file end for origin 2 before applying the existing offset and bounds checks.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int length, n;
    scanf("%d", &length);
    scanf("%d", &n);
    int cursor = 0;
    for (int i = 0; i < n; i++) {
        int origin, offset;
        scanf("%d", &origin);
        scanf("%d", &offset);
        int base = 0;
        if (origin == 1) {
            base = cursor;
        } else if (origin == 2) {
            base = cursor;
        }
        cursor = base + offset;
        if (cursor < 0) {
            cursor = 0;
        }
        if (cursor > length) {
            cursor = length;
        }
    }
    printf("%d ", (cursor));
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
    int length, n;
    cin >> length;
    cin >> n;
    int cursor = 0;
    for (int i = 0; i < n; i++) {
        int origin, offset;
        cin >> origin;
        cin >> offset;
        int base = 0;
        if (origin == 1) {
            base = cursor;
        } else if (origin == 2) {
            base = cursor;
        }
        cursor = base + offset;
        if (cursor < 0) {
            cursor = 0;
        }
        if (cursor > length) {
            cursor = length;
        }
    }
    cout << (cursor) << ' ';
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
        int length, n;
        length = scanner.nextInt();
        n = scanner.nextInt();
        int cursor = 0;
        for (int i = 0; i < n; i++) {
            int origin, offset;
            origin = scanner.nextInt();
            offset = scanner.nextInt();
            int base = 0;
            if (origin == 1) {
                base = cursor;
            } else if (origin == 2) {
                base = cursor;
            }
            cursor = base + offset;
            if (cursor < 0) {
                cursor = 0;
            }
            if (cursor > length) {
                cursor = length;
            }
        }
        System.out.print((cursor) + " ");
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

length = read_int()
n = read_int()
cursor = 0
for _ in range(n):
    origin = read_int()
    offset = read_int()
    base = 0
    if origin == 1:
        base = cursor
    elif origin == 2:
        base = cursor
    cursor = base + offset
    if cursor < 0:
        cursor = 0
    if cursor > length:
        cursor = length
print(cursor)
```

---

## 45. Arrivals Before Service

SYSTEMS · Difficulty 24 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a packet gate's tick order. Patch checks whether new arrivals can leave immediately.

What the code should do
Start with no queued packets. On each tick, first add the arrivals. If this exceeds `capacity`, drop the excess immediately. Then serve up to `rate` packets from the admitted queue, including packets that just arrived. No service occurs after the final listed tick. Count all served and dropped packets.

What's going wrong
Packets arriving at an empty gate can be forced to wait an extra tick.

How to read the code
`queued` is the previous tick's waiting count. `available` includes this tick's admitted arrivals. Overflow is counted in `dropped`; `take` is the number served this tick.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `capacity`, `rate` and `n`, then `n` arrival counts, one per tick.

Output
Print served packets, dropped packets and packets still queued, in that order.

Example explained
Input `4 2 2 3 4` serves 2 after each arrival. One packet is dropped on tick 2 and two remain. Print `4 1 2`.

Limits
`1 <= capacity <= 50`. `1 <= rate <= 50`. `0 <= n <= 50`. `0 <= arrivals <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 2 2
3 4
```

Expected output:

```text
4 1 2
```

Sample 2 input:

```text
3 1 2
0 0
```

Expected output:

```text
0 0 0
```

### Progressive hints (private until purchased)

1. Trace one tick with an empty queue and one arriving packet.
2. Compare `queued` and `available` after the capacity check.
3. Choose the service amount from the admitted queue for this tick, then retain the rate limit.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, rate, n;
    scanf("%d", &capacity);
    scanf("%d", &rate);
    scanf("%d", &n);
    int queued = 0;
    int served = 0;
    int dropped = 0;
    for (int i = 0; i < n; i++) {
        int arrivals;
        scanf("%d", &arrivals);
        int available = queued + arrivals;
        if (available > capacity) {
            dropped += available - capacity;
            available = capacity;
        }
        int take = queued;
        if (take > rate) {
            take = rate;
        }
        queued = available - take;
        served += take;
    }
    printf("%d ", (served));
    printf("%d ", (dropped));
    printf("%d ", (queued));
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
    int capacity, rate, n;
    cin >> capacity;
    cin >> rate;
    cin >> n;
    int queued = 0;
    int served = 0;
    int dropped = 0;
    for (int i = 0; i < n; i++) {
        int arrivals;
        cin >> arrivals;
        int available = queued + arrivals;
        if (available > capacity) {
            dropped += available - capacity;
            available = capacity;
        }
        int take = queued;
        if (take > rate) {
            take = rate;
        }
        queued = available - take;
        served += take;
    }
    cout << (served) << ' ';
    cout << (dropped) << ' ';
    cout << (queued) << ' ';
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
        int capacity, rate, n;
        capacity = scanner.nextInt();
        rate = scanner.nextInt();
        n = scanner.nextInt();
        int queued = 0;
        int served = 0;
        int dropped = 0;
        for (int i = 0; i < n; i++) {
            int arrivals;
            arrivals = scanner.nextInt();
            int available = queued + arrivals;
            if (available > capacity) {
                dropped += available - capacity;
                available = capacity;
            }
            int take = queued;
            if (take > rate) {
                take = rate;
            }
            queued = available - take;
            served += take;
        }
        System.out.print((served) + " ");
        System.out.print((dropped) + " ");
        System.out.print((queued) + " ");
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
rate = read_int()
n = read_int()
queued = 0
served = 0
dropped = 0
for _ in range(n):
    arrivals = read_int()
    available = queued + arrivals
    if available > capacity:
        dropped += available - capacity
        available = capacity
    take = queued
    if take > rate:
        take = rate
    queued = available - take
    served += take
print(served, dropped, queued)
```

---

## 46. Whole Range Reservation

SYSTEMS · Difficulty 22 · Bounty 600

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a block reservation check. Mira checks that one busy block rejects the whole request.

What the code should do
Start with `blocks` free blocks, numbered from 0. Reservation request number 1, 2, and so on asks for every block from `left` through `right`, including both ends. Accept only if all are free. On acceptance, store the request number in all those blocks. On rejection, change no block. Rejected requests still consume a request number.

What's going wrong
A request can overwrite blocks belonging to an earlier reservation.

How to read the code
`owner` stores 0 for a free block and a positive reservation number otherwise. `possible` summarizes a scan of the requested range. A separate loop applies an accepted reservation.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `blocks` and `n`, then `n` pairs `left right`.

Output
Print the accepted request count followed by the owner of each block in order. Print 0 for a free block.

Example explained
Input `4 3 0 1 1 2 2 3` accepts requests 1 and 3. Print `2 1 1 3 3`.

Limits
`1 <= blocks <= 20`. `0 <= n <= 30`. `0 <= left <= right < blocks`.

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
2 1 1 3 3
```

Sample 2 input:

```text
3 1
0 2
```

Expected output:

```text
1 1 1 1
```

### Progressive hints (private until purchased)

1. Try a range containing both a busy block and a free block.
2. The checking loop must remember a conflict before the writing loop starts.
3. An occupied block must make `possible` false for the entire request.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int blocks, n;
    scanf("%d", &blocks);
    scanf("%d", &n);
    int owner[20] = {0};
    int accepted = 0;
    for (int request = 1; request <= n; request++) {
        int left, right;
        scanf("%d", &left);
        scanf("%d", &right);
        int possible = 1;
        for (int block = left; block <= right; block++) {
            if (owner[block] != 0) {
                possible = 1;
            }
        }
        if (possible == 1) {
            for (int block = left; block <= right; block++) {
                owner[block] = request;
            }
            accepted++;
        }
    }
    printf("%d ", (accepted));
    for (int block = 0; block < blocks; block++) {
        printf("%d ", (owner[block]));
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
    int blocks, n;
    cin >> blocks;
    cin >> n;
    int owner[20] = {0};
    int accepted = 0;
    for (int request = 1; request <= n; request++) {
        int left, right;
        cin >> left;
        cin >> right;
        int possible = 1;
        for (int block = left; block <= right; block++) {
            if (owner[block] != 0) {
                possible = 1;
            }
        }
        if (possible == 1) {
            for (int block = left; block <= right; block++) {
                owner[block] = request;
            }
            accepted++;
        }
    }
    cout << (accepted) << ' ';
    for (int block = 0; block < blocks; block++) {
        cout << (owner[block]) << ' ';
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
        int blocks, n;
        blocks = scanner.nextInt();
        n = scanner.nextInt();
        int[] owner = new int[20];
        int accepted = 0;
        for (int request = 1; request <= n; request++) {
            int left, right;
            left = scanner.nextInt();
            right = scanner.nextInt();
            int possible = 1;
            for (int block = left; block <= right; block++) {
                if (owner[block] != 0) {
                    possible = 1;
                }
            }
            if (possible == 1) {
                for (int block = left; block <= right; block++) {
                    owner[block] = request;
                }
                accepted++;
            }
        }
        System.out.print((accepted) + " ");
        for (int block = 0; block < blocks; block++) {
            System.out.print((owner[block]) + " ");
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

blocks = read_int()
n = read_int()
owner = [0] * blocks
accepted = 0
for request in range(1, n + 1):
    left = read_int()
    right = read_int()
    possible = 1
    for block in range(left, right + 1):
        if owner[block] != 0:
            possible = 1
    if possible == 1:
        for block in range(left, right + 1):
            owner[block] = request
        accepted += 1
print(accepted, *owner)
```

---

## 47. Checkpoint Log Tail

SYSTEMS · Difficulty 24 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a restart log. Patch checks whether records after the saved checkpoint disappear on recovery.

What the code should do
Start with an empty log and checkpoint length 0. Command `1 value` appends one record. Command `2 0` saves the current log length as the new checkpoint. Command `3 0` recovers by discarding every record after that checkpoint. Recovery leaves the checkpoint unchanged. Later appends continue at the current log end.

What's going wrong
A recovery can keep the unsaved tail instead of restoring the checkpoint length.

How to read the code
`count` is the current log length, while `checkpoint` is the saved length. Recovery moves the logical end; later appends reuse space after that end.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` pairs `op value`. Only append uses `value`; other commands supply 0.

Output
Print the final records in order. Print -1 if the log is empty.

Example explained
Input `4 1 7 2 0 1 9 3 0` keeps only the record 7. Print `7`.

Limits
`0 <= n <= 50`. `op` is 1, 2 or 3. Appended `value` is from 1 through 100.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
1 7
2 0
1 9
3 0
```

Expected output:

```text
7
```

Sample 2 input:

```text
2
1 4
1 8
```

Expected output:

```text
4 8
```

### Progressive hints (private until purchased)

1. Append a record after a checkpoint and then recover.
2. At recovery, one length is the saved boundary and the other is the boundary that must move.
3. Restore `count` from `checkpoint`; recovery must not overwrite the saved boundary.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int log[50] = {0};
    int count = 0;
    int checkpoint = 0;
    for (int i = 0; i < n; i++) {
        int op, value;
        scanf("%d", &op);
        scanf("%d", &value);
        if (op == 1) {
            log[count] = value;
            count++;
        } else if (op == 2) {
            checkpoint = count;
        } else {
            checkpoint = count;
        }
    }
    if (count == 0) {
        printf("%d ", (-1));
    }
    for (int i = 0; i < count; i++) {
        printf("%d ", (log[i]));
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
    int log[50] = {0};
    int count = 0;
    int checkpoint = 0;
    for (int i = 0; i < n; i++) {
        int op, value;
        cin >> op;
        cin >> value;
        if (op == 1) {
            log[count] = value;
            count++;
        } else if (op == 2) {
            checkpoint = count;
        } else {
            checkpoint = count;
        }
    }
    if (count == 0) {
        cout << (-1) << ' ';
    }
    for (int i = 0; i < count; i++) {
        cout << (log[i]) << ' ';
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
        int[] log = new int[50];
        int count = 0;
        int checkpoint = 0;
        for (int i = 0; i < n; i++) {
            int op, value;
            op = scanner.nextInt();
            value = scanner.nextInt();
            if (op == 1) {
                log[count] = value;
                count++;
            } else if (op == 2) {
                checkpoint = count;
            } else {
                checkpoint = count;
            }
        }
        if (count == 0) {
            System.out.print((-1) + " ");
        }
        for (int i = 0; i < count; i++) {
            System.out.print((log[i]) + " ");
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
log = [0] * 50
count = 0
checkpoint = 0
for _ in range(n):
    op = read_int()
    value = read_int()
    if op == 1:
        log[count] = value
        count += 1
    elif op == 2:
        checkpoint = count
    else:
        checkpoint = count
if count == 0:
    print(-1)
else:
    print(*log[:count])
```

---

## 48. Packed Record Boundary

SYSTEMS · Difficulty 26 · Bounty 690

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a saved packet-buffer reader. Mira checks a complete record at the buffer's end.

What the code should do
Read records from a flat integer buffer, starting at position 0. Each record begins with one length value, followed by exactly that many data values. If the next record does not fit entirely in the buffer, stop and ignore that incomplete record and all remaining values. A zero-length record is complete and still counts. For complete records only, count records and sum their data values, excluding length fields.

What's going wrong
A record ending exactly at the buffer boundary can be ignored.

How to read the code
`cursor` points to a record's length field. `size` excludes that field. The bounds check decides whether a whole record exists before its data is inspected.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` buffer values.

Output
Print the complete-record count and the sum of their data values.

Example explained
Input `6 2 4 5 1 7 3` contains complete records `[2,4,5]` and `[1,7]`, followed by an incomplete record. Print `2 16`.

Limits
`1 <= n <= 50`. Every buffer value is from 0 through 9. Incomplete trailing records are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
6
2 4 5 1 7 3
```

Expected output:

```text
2 16
```

Sample 2 input:

```text
3
4 8 9
```

Expected output:

```text
0 0
```

### Progressive hints (private until purchased)

1. Try a buffer containing exactly one complete record.
2. The position just after a complete final record is allowed to equal `n`.
3. Stop only when the length field plus its data would extend beyond the buffer, not when it ends exactly there.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int data[50] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &data[i]);
    }
    int cursor = 0;
    int records = 0;
    int total = 0;
    while (cursor < n) {
        int size = data[cursor];
        if (cursor + 1 + size >= n) {
            break;
        }
        for (int j = 1; j <= size; j++) {
            total += data[cursor + j];
        }
        records++;
        cursor += 1 + size;
    }
    printf("%d ", (records));
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
    int data[50] = {0};
    for (int i = 0; i < n; i++) {
        cin >> data[i];
    }
    int cursor = 0;
    int records = 0;
    int total = 0;
    while (cursor < n) {
        int size = data[cursor];
        if (cursor + 1 + size >= n) {
            break;
        }
        for (int j = 1; j <= size; j++) {
            total += data[cursor + j];
        }
        records++;
        cursor += 1 + size;
    }
    cout << (records) << ' ';
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
        int[] data = new int[50];
        for (int i = 0; i < n; i++) {
            data[i] = scanner.nextInt();
        }
        int cursor = 0;
        int records = 0;
        int total = 0;
        while (cursor < n) {
            int size = data[cursor];
            if (cursor + 1 + size >= n) {
                break;
            }
            for (int j = 1; j <= size; j++) {
                total += data[cursor + j];
            }
            records++;
            cursor += 1 + size;
        }
        System.out.print((records) + " ");
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
cursor = 0
records = 0
total = 0
while cursor < n:
    size = data[cursor]
    if cursor + 1 + size >= n:
        break
    for j in range(1, size + 1):
        total += data[cursor + j]
    records += 1
    cursor += 1 + size
print(records, total)
```

---

## 49. Cancel a Waiting Print

SYSTEMS · Difficulty 31 · Bounty 800

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a print spool. Patch checks that cancelling a waiting job preserves the order of the others.

What the code should do
Start with an empty print queue. Command `1 id` appends a job. Command `2 id` cancels that waiting job if present; an absent ID changes nothing. Command `3 0` prints and removes the oldest waiting job if one exists. Count printed jobs. Cancellation must preserve the order of all remaining jobs.

What's going wrong
A cancelled job can remain in the queue while a different job disappears.

How to read the code
`jobs` stores the waiting IDs from oldest to newest. `count` is the used length. Cancellation first finds an ID, then shifts later entries left to close its gap.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` pairs `op id`. Print commands supply ID 0. Appended IDs are unique across the whole input.

Output
Print the number of printed jobs, then all waiting IDs in order. If no jobs are waiting, print -1 after the printed count.

Example explained
Input `4 1 4 1 7 2 4 3 0` cancels 4 and prints 7. Print `1 -1`.

Limits
`0 <= n <= 50`. `op` is 1, 2 or 3. Job IDs for append and cancel are from 1 through 1000. The queue never needs more than 50 slots.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
1 4
1 7
2 4
3 0
```

Expected output:

```text
1 -1
```

Sample 2 input:

```text
2
1 8
2 99
```

Expected output:

```text
0 8
```

### Progressive hints (private until purchased)

1. Cancel the first of two waiting jobs without printing either.
2. The first gap to fill is the slot holding the cancelled ID.
3. Start shifting at `found`, copying each following job into its predecessor's slot before reducing `count`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int jobs[50] = {0};
    int count = 0;
    int printed = 0;
    for (int i = 0; i < n; i++) {
        int op, id;
        scanf("%d", &op);
        scanf("%d", &id);
        if (op == 1) {
            jobs[count] = id;
            count++;
        } else if (op == 2) {
            int found = -1;
            for (int j = 0; j < count; j++) {
                if (jobs[j] == id) {
                    found = j;
                }
            }
            if (found != -1) {
                for (int j = found + 1; j + 1 < count; j++) {
                    jobs[j] = jobs[j + 1];
                }
                count--;
            }
        } else if (count > 0) {
            for (int j = 0; j + 1 < count; j++) {
                jobs[j] = jobs[j + 1];
            }
            count--;
            printed++;
        }
    }
    printf("%d ", (printed));
    if (count == 0) {
        printf("%d ", (-1));
    }
    for (int j = 0; j < count; j++) {
        printf("%d ", (jobs[j]));
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
    int jobs[50] = {0};
    int count = 0;
    int printed = 0;
    for (int i = 0; i < n; i++) {
        int op, id;
        cin >> op;
        cin >> id;
        if (op == 1) {
            jobs[count] = id;
            count++;
        } else if (op == 2) {
            int found = -1;
            for (int j = 0; j < count; j++) {
                if (jobs[j] == id) {
                    found = j;
                }
            }
            if (found != -1) {
                for (int j = found + 1; j + 1 < count; j++) {
                    jobs[j] = jobs[j + 1];
                }
                count--;
            }
        } else if (count > 0) {
            for (int j = 0; j + 1 < count; j++) {
                jobs[j] = jobs[j + 1];
            }
            count--;
            printed++;
        }
    }
    cout << (printed) << ' ';
    if (count == 0) {
        cout << (-1) << ' ';
    }
    for (int j = 0; j < count; j++) {
        cout << (jobs[j]) << ' ';
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
        int[] jobs = new int[50];
        int count = 0;
        int printed = 0;
        for (int i = 0; i < n; i++) {
            int op, id;
            op = scanner.nextInt();
            id = scanner.nextInt();
            if (op == 1) {
                jobs[count] = id;
                count++;
            } else if (op == 2) {
                int found = -1;
                for (int j = 0; j < count; j++) {
                    if (jobs[j] == id) {
                        found = j;
                    }
                }
                if (found != -1) {
                    for (int j = found + 1; j + 1 < count; j++) {
                        jobs[j] = jobs[j + 1];
                    }
                    count--;
                }
            } else if (count > 0) {
                for (int j = 0; j + 1 < count; j++) {
                    jobs[j] = jobs[j + 1];
                }
                count--;
                printed++;
            }
        }
        System.out.print((printed) + " ");
        if (count == 0) {
            System.out.print((-1) + " ");
        }
        for (int j = 0; j < count; j++) {
            System.out.print((jobs[j]) + " ");
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
jobs = [0] * 50
count = 0
printed = 0
for _ in range(n):
    op = read_int()
    id = read_int()
    if op == 1:
        jobs[count] = id
        count += 1
    elif op == 2:
        found = -1
        for j in range(count):
            if jobs[j] == id:
                found = j
        if found != -1:
            for j in range(found + 1, count - 1):
                jobs[j] = jobs[j + 1]
            count -= 1
    elif count > 0:
        for j in range(count - 1):
            jobs[j] = jobs[j + 1]
        count -= 1
        printed += 1
if count == 0:
    print(printed, -1)
else:
    print(printed, *jobs[:count])
```

---

## 50. Discard the Pending Slot

SYSTEMS · Difficulty 32 · Bounty 820

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. The rogue AI AEGIS altered a staged settings log. Mira checks that a discarded edit cannot reappear at publication.

What the code should do
Read the initial stored values. Command `1 slot value` stages a replacement for that slot, replacing any earlier pending edit there. Command `2 0 0` publishes all pending edits and clears their pending status. Command `3 slot 0` discards only that slot's pending edit and leaves its stored value unchanged. Staged edits left at the end are not published.

What's going wrong
A discarded pending value can still replace the stored value during a later publish command.

How to read the code
`stored` holds published values. `pending` and `marked` hold a possible replacement for each slot. Publishing scans all slots; discarding affects one slot's pending status.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `slots` and `n`, then `slots` initial values, then `n` triples `op slot value`.

Output
Print the final stored values for slots 0 through `slots - 1`.

Example explained
Input `2 4 4 8 1 0 9 1 1 7 3 0 0 2 0 0` discards the edit to slot 0 and publishes only slot 1. Print `4 7`.

Limits
`1 <= slots <= 20`. `0 <= n <= 50`. Stored and staged values are from 0 through 100. `op` is 1, 2 or 3. Stage and discard use `0 <= slot < slots`; publish supplies slot and value 0.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 4
4 8
1 0 9
1 1 7
3 0 0
2 0 0
```

Expected output:

```text
4 7
```

Sample 2 input:

```text
1 2
3
1 0 8
2 0 0
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. Stage an edit, discard it, then publish.
2. Publishing trusts `marked` when deciding which values to copy.
3. Discard must remove the slot's pending status; its stored value and other slots must stay unchanged.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int slots, n;
    scanf("%d", &slots);
    scanf("%d", &n);
    int stored[20] = {0};
    int pending[20] = {0};
    int marked[20] = {0};
    for (int j = 0; j < slots; j++) {
        scanf("%d", &stored[j]);
    }
    for (int i = 0; i < n; i++) {
        int op, slot, value;
        scanf("%d", &op);
        scanf("%d", &slot);
        scanf("%d", &value);
        if (op == 1) {
            pending[slot] = value;
            marked[slot] = 1;
        } else if (op == 2) {
            for (int j = 0; j < slots; j++) {
                if (marked[j] == 1) {
                    stored[j] = pending[j];
                    marked[j] = 0;
                }
            }
        } else {
            marked[slot] = 1;
        }
    }
    for (int j = 0; j < slots; j++) {
        printf("%d ", (stored[j]));
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
    int slots, n;
    cin >> slots;
    cin >> n;
    int stored[20] = {0};
    int pending[20] = {0};
    int marked[20] = {0};
    for (int j = 0; j < slots; j++) {
        cin >> stored[j];
    }
    for (int i = 0; i < n; i++) {
        int op, slot, value;
        cin >> op;
        cin >> slot;
        cin >> value;
        if (op == 1) {
            pending[slot] = value;
            marked[slot] = 1;
        } else if (op == 2) {
            for (int j = 0; j < slots; j++) {
                if (marked[j] == 1) {
                    stored[j] = pending[j];
                    marked[j] = 0;
                }
            }
        } else {
            marked[slot] = 1;
        }
    }
    for (int j = 0; j < slots; j++) {
        cout << (stored[j]) << ' ';
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
        int slots, n;
        slots = scanner.nextInt();
        n = scanner.nextInt();
        int[] stored = new int[20];
        int[] pending = new int[20];
        int[] marked = new int[20];
        for (int j = 0; j < slots; j++) {
            stored[j] = scanner.nextInt();
        }
        for (int i = 0; i < n; i++) {
            int op, slot, value;
            op = scanner.nextInt();
            slot = scanner.nextInt();
            value = scanner.nextInt();
            if (op == 1) {
                pending[slot] = value;
                marked[slot] = 1;
            } else if (op == 2) {
                for (int j = 0; j < slots; j++) {
                    if (marked[j] == 1) {
                        stored[j] = pending[j];
                        marked[j] = 0;
                    }
                }
            } else {
                marked[slot] = 1;
            }
        }
        for (int j = 0; j < slots; j++) {
            System.out.print((stored[j]) + " ");
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
n = read_int()
stored = [read_int() for _ in range(slots)]
pending = [0] * slots
marked = [0] * slots
for _ in range(n):
    op = read_int()
    slot = read_int()
    value = read_int()
    if op == 1:
        pending[slot] = value
        marked[slot] = 1
    elif op == 2:
        for j in range(slots):
            if marked[j] == 1:
                stored[j] = pending[j]
                marked[j] = 0
    else:
        marked[slot] = 1
print(*stored)
```

---

## 51. Reciprocal Door Pairs

GRAPHS · Difficulty 8 · Bounty 290

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has split the door controls. Mira checks which pairs can send direct replies.

What the code should do
Count unordered pairs of different vertices that have both direct links: `u -> v` and `v -> u`. Count each pair once. Longer routes do not count.

What's going wrong
A pair can be reported even when only one direction exists.

How to read the code
`edge` is the direct-link table. The nested loops choose two different vertices with `u < v`; `count` collects qualifying pairs.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.

Output
Print the number of pairs with direct links in both directions.

Example explained
In sample 1, only vertices `0` and `1` have both directions, so print `1`. Sample 2 has only one direction, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

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

Sample 2 input:

```text
2 1
0 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare a two-way pair with a pair that has only one link.
2. Read the two table entries checked for each unordered pair.
3. Both entries must be present before the pair contributes. Keep the `u < v` loop bounds.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
    }
    int count = 0;
    for (int u = 0; u < n; u++) {
        for (int v = u + 1; v < n; v++) {
            if (edge[u * n + v] == 1 || edge[v * n + u] == 1) {
                count++;
            }
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
    }
    int count = 0;
    for (int u = 0; u < n; u++) {
        for (int v = u + 1; v < n; v++) {
            if (edge[u * n + v] == 1 || edge[v * n + u] == 1) {
                count++;
            }
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
        }
        int count = 0;
        for (int u = 0; u < n; u++) {
            for (int v = u + 1; v < n; v++) {
                if (edge[u * n + v] == 1 || edge[v * n + u] == 1) {
                    count++;
                }
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
m = read_int()
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
count = 0
for u in range(n):
    for v in range(u + 1, n):
        if edge[u * n + v] == 1 or edge[v * n + u] == 1:
            count += 1
print(count)
```

---

## 52. One Way Dead Ends

GRAPHS · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS is trapping messages. Patch counts terminals that receive links but cannot send along any link.

What the code should do
Count vertices with at least one incoming link and no outgoing links. A vertex with no links at all is not a dead end.

What's going wrong
Unused isolated vertices can be counted as message traps.

How to read the code
For one vertex `u`, `incoming` totals its column and `outgoing` totals its row. `count` is updated after both totals are known.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.

Output
Print the number of receiving-only vertices.

Example explained
Sample 1 has links `0 -> 1` and `0 -> 2`; vertices `1` and `2` qualify, so print `2`. In sample 2, neither vertex has a link, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1
0 2
```

Expected output:

```text
2
```

Sample 2 input:

```text
2 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try a graph with no links.
2. A receiving-only vertex and an isolated vertex have the same outgoing total.
3. Use the incoming total as well: it must be positive while the outgoing total is zero.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
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
        if (outgoing == 0) {
            count++;
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
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
        if (outgoing == 0) {
            count++;
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
            if (outgoing == 0) {
                count++;
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
    if outgoing == 0:
        count += 1
print(count)
```

---

## 53. Zone Exit Wires

GRAPHS · Difficulty 9 · Bounty 320

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS rerouted evacuation signals. Ishan checks direct wires leaving zone `0` for zone `1`.

What the code should do
Count direct one-way links whose sender has zone label `0` and receiver has zone label `1`. Ignore links in the reverse direction and links within one zone.

What's going wrong
Links travelling into the evacuation zone can be counted instead of links leaving it.

How to read the code
`zone` stores each vertex label. `edge` keeps link directions, and the two loops inspect every possible sender and receiver.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `m`, then `n` labels in `zone`, then `m` directed pairs `u v`.

Output
Print the number of links from zone `0` to zone `1`.

Example explained
Sample 1 labels vertices `0 1 0` and has links `0 -> 1`, `1 -> 2`; only the first qualifies, so print `1`. Sample 2 has no links, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`. Each zone label is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1 0
0 1
1 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
2 0
0 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Use a single link and give its endpoints different zone labels.
2. The row vertex `u` sends the link; the column vertex `v` receives it.
3. The sender label must be zero and the receiver label must be one. Keep the directed table unchanged.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    int zone[12] = {0};
    for (int u = 0; u < n; u++) {
        scanf("%d", &zone[u]);
    }
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
    }
    int count = 0;
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            if (edge[u * n + v] == 1 && zone[u] == 1 && zone[v] == 0) {
                count++;
            }
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    int zone[12] = {0};
    for (int u = 0; u < n; u++) {
        cin >> zone[u];
    }
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
    }
    int count = 0;
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            if (edge[u * n + v] == 1 && zone[u] == 1 && zone[v] == 0) {
                count++;
            }
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        int[] zone = new int[12];
        for (int u = 0; u < n; u++) {
            zone[u] = scanner.nextInt();
        }
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
        }
        int count = 0;
        for (int u = 0; u < n; u++) {
            for (int v = 0; v < n; v++) {
                if (edge[u * n + v] == 1 && zone[u] == 1 && zone[v] == 0) {
                    count++;
                }
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
        if edge[u * n + v] == 1 and zone[u] == 1 and zone[v] == 0:
            count += 1
print(count)
```

---

## 54. Shared Rescue Neighbours

GRAPHS · Difficulty 11 · Bounty 360

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS cut the coordination board. Mira needs vertices directly cabled to both rescue posts.

What the code should do
Count vertices directly joined by a two-way cable to both `s` and `t`. Count each shared neighbour once. Being connected by a longer route does not qualify.

What's going wrong
Vertices linked to only one rescue post can enter the shared list.

How to read the code
`s` and `t` name two different vertices. For each candidate `v`, the program reads one entry from each of their rows in `edge`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `m`, `s`, and `t`, then `m` two-way pairs `u v`.

Output
Print the number of common direct neighbours.

Example explained
Sample 1 has `0-2` and `1-2`, with posts `0` and `1`; only vertex `2` qualifies, so print `1`. Sample 2 has only `0-1`; neither endpoint is a common neighbour, so print `0`.

Limits
`2 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `s` and `t` are different valid vertices.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 0 1
0 2
1 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
2 1 0 1
0 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try one candidate that touches only `s`.
2. A candidate needs two separate direct cables.
3. Require both row entries to be present for the same candidate `v`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int s;
    scanf("%d", &s);
    int t;
    scanf("%d", &t);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int count = 0;
    for (int v = 0; v < n; v++) {
        if (edge[s * n + v] == 1 || edge[t * n + v] == 1) {
            count++;
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
    int m;
    cin >> n;
    cin >> m;
    int s;
    cin >> s;
    int t;
    cin >> t;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int count = 0;
    for (int v = 0; v < n; v++) {
        if (edge[s * n + v] == 1 || edge[t * n + v] == 1) {
            count++;
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int s;
        s = scanner.nextInt();
        int t;
        t = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int count = 0;
        for (int v = 0; v < n; v++) {
            if (edge[s * n + v] == 1 || edge[t * n + v] == 1) {
                count++;
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
    if edge[s * n + v] == 1 or edge[t * n + v] == 1:
        count += 1
print(count)
```

---

## 55. Triangle Lock Census

GRAPHS · Difficulty 19 · Bounty 540

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged the three-door locks. Patch checks groups where every pair has a cable.

What the code should do
Count unordered groups of three different vertices where all three possible two-way cables exist. Other cables outside a group do not affect its qualification.

What's going wrong
An open chain of three vertices can be reported as a closed triangle.

How to read the code
The loops choose three vertices in increasing order, so each group is examined once. `edge` holds direct two-way cables and `count` records complete groups.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.

Output
Print the number of complete three-vertex groups.

Example explained
Sample 1 has all three cables among vertices `0`, `1`, `2`, so print `1`. Sample 2 has only `0-1-2`, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.

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
3 2
0 1
1 2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Draw three vertices with only two cables.
2. The three vertices require three separate pair checks.
3. Besides the two consecutive cables, check the cable from `a` to `d` before counting the group.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int count = 0;
    for (int a = 0; a < n; a++) {
        for (int b = a + 1; b < n; b++) {
            for (int d = b + 1; d < n; d++) {
                if (edge[a * n + b] == 1 && edge[b * n + d] == 1) {
                    count++;
                }
            }
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int count = 0;
    for (int a = 0; a < n; a++) {
        for (int b = a + 1; b < n; b++) {
            for (int d = b + 1; d < n; d++) {
                if (edge[a * n + b] == 1 && edge[b * n + d] == 1) {
                    count++;
                }
            }
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int count = 0;
        for (int a = 0; a < n; a++) {
            for (int b = a + 1; b < n; b++) {
                for (int d = b + 1; d < n; d++) {
                    if (edge[a * n + b] == 1 && edge[b * n + d] == 1) {
                        count++;
                    }
                }
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
            if edge[a * n + b] == 1 and edge[b * n + d] == 1:
                count += 1
print(count)
```

---

## 56. Missing Mesh Cables

GRAPHS · Difficulty 7 · Bounty 270

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS hid gaps in a mesh. Ishan counts the extra cables needed to join every pair directly.

What the code should do
Count unordered pairs of different vertices with no direct cable. Adding one cable for each such pair would make every two different vertices directly connected. Do not add cables from a vertex to itself.

What's going wrong
The reported repair count can charge twice for the same missing cable.

How to read the code
The outer vertex is `u`. The inner vertex `v` chooses its partner. `missing` counts pairs with no direct cable in the table.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.

Output
Print the number of missing two-way cables.

Example explained
Sample 1 has three vertices and only cable `0-1`, leaving `0-2` and `1-2`; print `2`. Sample 2 already has its only possible cable, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 1
0 1
```

Expected output:

```text
2
```

Sample 2 input:

```text
2 1
0 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. An empty graph with two vertices needs only one cable.
2. Check whether both `(u, v)` and `(v, u)` are visited.
3. Choose partners after `u` in vertex order, so each unordered pair is inspected once.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int missing = 0;
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            if (edge[u * n + v] == 0) {
                missing++;
            }
        }
    }
    printf("%d ", (missing));
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int missing = 0;
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            if (edge[u * n + v] == 0) {
                missing++;
            }
        }
    }
    cout << (missing) << ' ';
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int missing = 0;
        for (int u = 0; u < n; u++) {
            for (int v = 0; v < n; v++) {
                if (edge[u * n + v] == 0) {
                    missing++;
                }
            }
        }
        System.out.print((missing) + " ");
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
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
    edge[v * n + u] = 1
missing = 0
for u in range(n):
    for v in range(n):
        if edge[u * n + v] == 0:
            missing += 1
print(missing)
```

---

## 57. Incident Power Ledger

GRAPHS · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS erased port loads. Mira rebuilds the power total attached to each relay.

What the code should do
For each vertex, add the power values of all two-way cables touching it. A cable contributes its full power to each endpoint. An isolated vertex has total zero.

What's going wrong
A high-power cable can contribute only one unit to a relay total.

How to read the code
`edge` stores each cable power at both endpoint positions. For each vertex `u`, `total` adds values across its row before one output is written.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `m`, then `m` triples `u v weight` for two-way cables.

Output
Print `n` incident-power totals in vertex order.

Example explained
Sample 1 has powers `4` on `0-1` and `7` on `1-2`, so print `4 11 7`. Sample 2 has no cables, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. Each `weight` is from `1` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1 4
1 2 7
```

Expected output:

```text
4 11 7
```

Sample 2 input:

```text
1 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare a cable with power one and a cable with power nine.
2. The table stores a power value, not just a yes/no flag.
3. Add each stored power value to the endpoint total without reducing it to a presence test.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        int weight;
        scanf("%d", &weight);
        edge[u * n + v] = weight;
        edge[v * n + u] = weight;
    }
    for (int u = 0; u < n; u++) {
        int total = 0;
        for (int v = 0; v < n; v++) {
            total += edge[u * n + v] > 0 ? 1 : 0;
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
    int n;
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        int weight;
        cin >> weight;
        edge[u * n + v] = weight;
        edge[v * n + u] = weight;
    }
    for (int u = 0; u < n; u++) {
        int total = 0;
        for (int v = 0; v < n; v++) {
            total += edge[u * n + v] > 0 ? 1 : 0;
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
        int n;
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            int weight;
            weight = scanner.nextInt();
            edge[u * n + v] = weight;
            edge[v * n + u] = weight;
        }
        for (int u = 0; u < n; u++) {
            int total = 0;
            for (int v = 0; v < n; v++) {
                total += edge[u * n + v] > 0 ? 1 : 0;
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
        total += int(edge[u * n + v] > 0)
    result.append(total)
print(*result)
```

---

## 58. Sibling Pair Roster

GRAPHS · Difficulty 15 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS scrambled family badges on the device tree. Patch counts pairs that share a direct parent.

What the code should do
Count unordered pairs of different vertices with the same direct parent. A parent and child do not form a sibling pair. The root has no parent.

What's going wrong
Two children can be counted in both possible orders.

How to read the code
`children[p]` counts direct children of parent `p`. The final loop turns each child count into a number of unordered pairs and adds these to `pairs`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n - 1` pairs `p v`, each naming the parent `p` of child `v`.

Output
Print the total number of sibling pairs.

Example explained
Sample 1 gives root `0` children `1`, `2`, `3`, making three pairs; print `3`. Sample 2 is a chain, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. The pairs describe a rooted tree with root `0`: every other vertex has exactly one parent, and following children from `0` reaches all vertices. Pairs may arrive in any order.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
0 1
0 2
0 3
```

Expected output:

```text
3
```

Sample 2 input:

```text
3
0 1
1 2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. A parent with two children gives one pair.
2. For each first child, there are one fewer choices for a different second child.
3. Each unordered pair appears twice in that product; account for that before adding it to `pairs`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int children[12] = {0};
    for (int i = 0; i < n - 1; i++) {
        int p;
        int v;
        scanf("%d", &p);
        scanf("%d", &v);
        children[p]++;
    }
    int pairs = 0;
    for (int p = 0; p < n; p++) {
        pairs += children[p] * (children[p] - 1);
    }
    printf("%d ", (pairs));
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
    int children[12] = {0};
    for (int i = 0; i < n - 1; i++) {
        int p;
        int v;
        cin >> p;
        cin >> v;
        children[p]++;
    }
    int pairs = 0;
    for (int p = 0; p < n; p++) {
        pairs += children[p] * (children[p] - 1);
    }
    cout << (pairs) << ' ';
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
        int[] children = new int[12];
        for (int i = 0; i < n - 1; i++) {
            int p;
            int v;
            p = scanner.nextInt();
            v = scanner.nextInt();
            children[p]++;
        }
        int pairs = 0;
        for (int p = 0; p < n; p++) {
            pairs += children[p] * (children[p] - 1);
        }
        System.out.print((pairs) + " ");
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
children = [0] * n
for _ in range(n - 1):
    p = read_int()
    v = read_int()
    children[p] += 1
pairs = 0
for p in range(n):
    pairs += children[p] * (children[p] - 1)
print(pairs)
```

---

## 59. Parent Label Cards

GRAPHS · Difficulty 6 · Bounty 250

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS swapped the directory cards. Ishan restores direct-parent labels without searching the tree.

What the code should do
For each queried vertex, print its direct parent from the given rooted tree. Print `-1` for root `0`. Answer queries in their input order.

What's going wrong
A requested child can show a child label or remain blank instead of naming its parent.

How to read the code
`parent` stores one direct-parent label per vertex and starts with `-1`. Each pair describes a parent and its child. The last loop reads the requested cards.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n - 1` pairs `p v`, each naming the parent `p` of child `v`. Then read `q`, followed by `q` queried vertex numbers.

Output
Print `q` parent labels, separated by spaces.

Example explained
Sample 1 has `0 -> 1 -> 2` and queries `2 0 1`, so print `1 -1 0`. Sample 2 queries the only root, so print `-1`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. The pairs describe a rooted tree with root `0`: every other vertex has exactly one parent, and following children from `0` reaches all vertices. Pairs may arrive in any order. `1 <= q <= 12`. Every query is a valid vertex.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
0 1
1 2
3 2 0 1
```

Expected output:

```text
1 -1 0
```

Sample 2 input:

```text
1
1 0
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Trace the card for a child whose parent is not root `0`.
2. The index of `parent` names the vertex whose card is being filled.
3. Use the child as the card index and the supplied parent as its stored label.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int parent[12] = {0};
    for (int v = 0; v < n; v++) {
        parent[v] = -1;
    }
    for (int i = 0; i < n - 1; i++) {
        int p;
        int v;
        scanf("%d", &p);
        scanf("%d", &v);
        parent[p] = v;
    }
    int q;
    scanf("%d", &q);
    for (int i = 0; i < q; i++) {
        int v;
        scanf("%d", &v);
        printf("%d ", (parent[v]));
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
    int parent[12] = {0};
    for (int v = 0; v < n; v++) {
        parent[v] = -1;
    }
    for (int i = 0; i < n - 1; i++) {
        int p;
        int v;
        cin >> p;
        cin >> v;
        parent[p] = v;
    }
    int q;
    cin >> q;
    for (int i = 0; i < q; i++) {
        int v;
        cin >> v;
        cout << (parent[v]) << ' ';
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
        int[] parent = new int[12];
        for (int v = 0; v < n; v++) {
            parent[v] = -1;
        }
        for (int i = 0; i < n - 1; i++) {
            int p;
            int v;
            p = scanner.nextInt();
            v = scanner.nextInt();
            parent[p] = v;
        }
        int q;
        q = scanner.nextInt();
        for (int i = 0; i < q; i++) {
            int v;
            v = scanner.nextInt();
            System.out.print((parent[v]) + " ");
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
parent = [-1] * n
for _ in range(n - 1):
    p = read_int()
    v = read_int()
    parent[p] = v
q = read_int()
result = []
for _ in range(q):
    v = read_int()
    result.append(parent[v])
print(*result)
```

---

## 60. Inbound Outbound Balance

GRAPHS · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged the traffic report. Mira compares outgoing and incoming direct links at each relay.

What the code should do
For every vertex, print its number of outgoing links minus its number of incoming links. A pair with both directions contributes one outgoing and one incoming link at each endpoint.

What's going wrong
A relay with only incoming links can receive a positive balance.

How to read the code
`balance` is computed separately for each vertex `u`. The row entry describes a link leaving `u`; the column entry describes one entering `u`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.

Output
Print `n` signed balances in vertex order.

Example explained
Sample 1 has links `0 -> 1`, `0 -> 2`; print `2 -1 -1`. Sample 2 is a two-way pair, so print `0 0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1
0 2
```

Expected output:

```text
2 -1 -1
```

Sample 2 input:

```text
2 2
0 1
1 0
```

Expected output:

```text
0 0
```

### Progressive hints (private until purchased)

1. Check a vertex that only receives one link.
2. Outgoing and incoming links have opposite effects on the balance.
3. Keep the row contribution positive and the column contribution negative.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
    }
    for (int u = 0; u < n; u++) {
        int balance = 0;
        for (int v = 0; v < n; v++) {
            balance += edge[u * n + v] + edge[v * n + u];
        }
        printf("%d ", (balance));
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
    }
    for (int u = 0; u < n; u++) {
        int balance = 0;
        for (int v = 0; v < n; v++) {
            balance += edge[u * n + v] + edge[v * n + u];
        }
        cout << (balance) << ' ';
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
        }
        for (int u = 0; u < n; u++) {
            int balance = 0;
            for (int v = 0; v < n; v++) {
                balance += edge[u * n + v] + edge[v * n + u];
            }
            System.out.print((balance) + " ");
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
edge = [0] * (n * n)
for _ in range(m):
    u = read_int()
    v = read_int()
    edge[u * n + v] = 1
result = []
for u in range(n):
    balance = 0
    for v in range(n):
        balance += edge[u * n + v] + edge[v * n + u]
    result.append(balance)
print(*result)
```

---

## 61. Signed Walk Receipt

GRAPHS · Difficulty 13 · Bounty 400

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS forged a courier receipt. Patch checks every listed move against the directed link map.

What the code should do
Check the supplied walk without changing it. Every consecutive pair must have a direct one-way link in the listed direction. A single-vertex walk is valid. Repeated vertices are allowed, but every step still needs a link.

What's going wrong
A receipt can be accepted even though an earlier move used a missing link.

How to read the code
`walk` stores the supplied vertex sequence. `ok` remembers whether all checked steps were valid. The table uses the earlier vertex as sender and the next as receiver.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the link count. Then read `m` pairs `u v`, each a one-way link from `u` to `v`. Then read `k`, followed by `k` vertex numbers in `walk`.

Output
Print `YES` for a valid walk, otherwise `NO`.

Example explained
Sample 1 walks `0 1 2` along the listed links and prints `YES`. Sample 2 walks `0 2 1`; its first step is absent, so print `NO`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1)`. `1 <= k <= 20`. Every walk entry is a valid vertex.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1
1 2
3 0 1 2
```

Expected output:

```text
YES
```

Sample 2 input:

```text
3 2
0 1
2 1
3 0 2 1
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Use a walk with an invalid step followed by a valid step.
2. Once the receipt fails, later steps cannot repair it.
3. Only record failure when an edge is missing; do not reset the verdict for a valid step.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
    }
    int k;
    scanf("%d", &k);
    int walk[20] = {0};
    for (int i = 0; i < k; i++) {
        scanf("%d", &walk[i]);
    }
    int ok = 1;
    for (int i = 1; i < k; i++) {
        int u = walk[i - 1];
        int v = walk[i];
        ok = edge[u * n + v];
    }
    if (ok == 1) {
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
    }
    int k;
    cin >> k;
    int walk[20] = {0};
    for (int i = 0; i < k; i++) {
        cin >> walk[i];
    }
    int ok = 1;
    for (int i = 1; i < k; i++) {
        int u = walk[i - 1];
        int v = walk[i];
        ok = edge[u * n + v];
    }
    if (ok == 1) {
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
        }
        int k;
        k = scanner.nextInt();
        int[] walk = new int[20];
        for (int i = 0; i < k; i++) {
            walk[i] = scanner.nextInt();
        }
        int ok = 1;
        for (int i = 1; i < k; i++) {
            int u = walk[i - 1];
            int v = walk[i];
            ok = edge[u * n + v];
        }
        if (ok == 1) {
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
    ok = edge[u * n + v]
print("YES" if ok == 1 else "NO")
```

---

## 62. Hub And Rim Seal

GRAPHS · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS altered the emergency hub map. Ishan checks the complete shape around the nominated centre.

What the code should do
Print `YES` exactly when every vertex other than `hub` has a direct cable to `hub`, and no two other vertices have a cable between them. A one-vertex graph qualifies. The nominated hub is part of the input; do not search for another.

What's going wrong
A graph with every hub cable can pass even when an extra cable joins two outer vertices.

How to read the code
`hub` is the nominated centre. Every unordered vertex pair has an `expected` table value. `ok` combines all pair comparisons.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `m`, and `hub`, then `m` two-way pairs.

Output
Print `YES` if the graph has exactly the required hub-and-spokes shape; otherwise print `NO`.

Example explained
Sample 1 has hub `0` and cables `0-1`, `0-2`, `0-3`, so print `YES`. Sample 2 adds `1-2`, so print `NO`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `hub` is a valid vertex.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 3 0
0 1
0 2
0 3
```

Expected output:

```text
YES
```

Sample 2 input:

```text
4 4 0
0 1
0 2
0 3
1 2
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Add one rim cable to an otherwise valid star.
2. Pairs that should have no cable matter as well as pairs that require one.
3. Compare actual presence with `expected` for every pair, including pairs where `expected` is zero.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int hub;
    scanf("%d", &hub);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
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
            if (expected == 1 && edge[u * n + v] != expected) {
                ok = 0;
            }
        }
    }
    if (ok == 1) {
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
    int m;
    cin >> n;
    cin >> m;
    int hub;
    cin >> hub;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
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
            if (expected == 1 && edge[u * n + v] != expected) {
                ok = 0;
            }
        }
    }
    if (ok == 1) {
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int hub;
        hub = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
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
                if (expected == 1 && edge[u * n + v] != expected) {
                    ok = 0;
                }
            }
        }
        if (ok == 1) {
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
        if expected == 1 and edge[u * n + v] != expected:
            ok = 0
print("YES" if ok == 1 else "NO")
```

---

## 63. Odd Socket Census

GRAPHS · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged socket parity tags. Mira counts relays with an odd number of occupied cable sockets.

What the code should do
Count vertices touching an odd number of two-way cables. Zero is even. Count vertices, not cables, and include all connected groups.

What's going wrong
A relay with three cables can be skipped even though its socket count is odd.

How to read the code
`degree` counts the cables touching the current vertex `u`. The final condition decides whether that vertex contributes to `odd`.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.

Output
Print the number of vertices with odd degree.

Example explained
Sample 1 is a three-vertex chain: its two endpoints have one cable each, so print `2`. Sample 2 is a triangle: all degrees are two, so print `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1
1 2
```

Expected output:

```text
2
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

1. A relay with three cables also has odd degree.
2. List which values of `degree` should qualify: one, three, five, and so on.
3. Use the remainder after division by two rather than equality with one.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int odd = 0;
    for (int u = 0; u < n; u++) {
        int degree = 0;
        for (int v = 0; v < n; v++) {
            degree += edge[u * n + v];
        }
        if (degree == 1) {
            odd++;
        }
    }
    printf("%d ", (odd));
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int odd = 0;
    for (int u = 0; u < n; u++) {
        int degree = 0;
        for (int v = 0; v < n; v++) {
            degree += edge[u * n + v];
        }
        if (degree == 1) {
            odd++;
        }
    }
    cout << (odd) << ' ';
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int odd = 0;
        for (int u = 0; u < n; u++) {
            int degree = 0;
            for (int v = 0; v < n; v++) {
                degree += edge[u * n + v];
            }
            if (degree == 1) {
                odd++;
            }
        }
        System.out.print((odd) + " ");
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
    if degree == 1:
        odd += 1
print(odd)
```

---

## 64. Cable Colour Split

GRAPHS · Difficulty 14 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS mixed the repair team colours. Patch verifies that every cable crosses between the two supplied teams.

What the code should do
Check the supplied zero/one vertex colours. Every two-way cable must join different colours. Do not change colours or search for another colouring. Isolated vertices impose no rule; a graph with no cables passes.

What's going wrong
A cable joining equal colours can be accepted while a valid cross-team cable is rejected.

How to read the code
`colour` is supplied, not computed. The nested loops inspect unordered pairs, and `ok` keeps the result of all cable checks.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `m`, then `n` values in `colour`, then `m` two-way pairs.

Output
Print `YES` if every cable joins different colours, otherwise `NO`.

Example explained
Sample 1 colours the chain `0-1-2` as `0 1 0`, so print `YES`. Sample 2 gives both cable endpoints colour `1`, so print `NO`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. Each colour is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1 0
0 1
1 2
```

Expected output:

```text
YES
```

Sample 2 input:

```text
2 1
1 1
0 1
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Try one cable with equal endpoint colours.
2. The branch that clears `ok` must describe a violation.
3. A present cable is invalid when its endpoint colours are equal.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    int colour[12] = {0};
    for (int u = 0; u < n; u++) {
        scanf("%d", &colour[u]);
    }
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int ok = 1;
    for (int u = 0; u < n; u++) {
        for (int v = u + 1; v < n; v++) {
            if (edge[u * n + v] == 1 && colour[u] != colour[v]) {
                ok = 0;
            }
        }
    }
    if (ok == 1) {
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    int colour[12] = {0};
    for (int u = 0; u < n; u++) {
        cin >> colour[u];
    }
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int ok = 1;
    for (int u = 0; u < n; u++) {
        for (int v = u + 1; v < n; v++) {
            if (edge[u * n + v] == 1 && colour[u] != colour[v]) {
                ok = 0;
            }
        }
    }
    if (ok == 1) {
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        int[] colour = new int[12];
        for (int u = 0; u < n; u++) {
            colour[u] = scanner.nextInt();
        }
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int ok = 1;
        for (int u = 0; u < n; u++) {
            for (int v = u + 1; v < n; v++) {
                if (edge[u * n + v] == 1 && colour[u] != colour[v]) {
                    ok = 0;
                }
            }
        }
        if (ok == 1) {
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
        if edge[u * n + v] == 1 and colour[u] != colour[v]:
            ok = 0
print("YES" if ok == 1 else "NO")
```

---

## 65. Tile Boundary Fence

GRAPHS · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS erased the floor fences. Mira measures the exposed sides of all occupied tiles.

What the code should do
A rectangular grid contains empty (`0`) and occupied (`1`) tiles. Count unit sides of occupied tiles that touch an empty tile or the outside of the grid. Only shared full sides matter; diagonal contact does not hide a side. Include every occupied region and any inner holes.

What's going wrong
Two adjacent occupied tiles can leave a fence total that is too large.

How to read the code
`tile` is stored row by row. `r` and `c` select a tile. `fence` begins with four sides per occupied tile, then adjusts for shared sides checked to the right and below.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `rows` and `cols`, then `rows * cols` zero/one tile values in row order.

Output
Print the total exposed-side length.

Example explained
Sample 1 has one occupied tile and prints `4`. Sample 2 has two side-by-side occupied tiles; their shared side is internal, so print `6`.

Limits
`1 <= rows, cols <= 6`. Each tile is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 1
1
```

Expected output:

```text
4
```

Sample 2 input:

```text
1 2
1 1
```

Expected output:

```text
6
```

### Progressive hints (private until purchased)

1. Each of two touching tiles initially contributes the shared side.
2. Right and down checks visit each shared side once.
3. A shared side must remove both of its initial contributions from `fence`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int rows;
    int cols;
    scanf("%d", &rows);
    scanf("%d", &cols);
    int tile[36] = {0};
    for (int i = 0; i < rows * cols; i++) {
        scanf("%d", &tile[i]);
    }
    int fence = 0;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (tile[r * cols + c] == 1) {
                fence += 4;
                if (c + 1 < cols && tile[r * cols + c + 1] == 1) {
                    fence -= 1;
                }
                if (r + 1 < rows && tile[(r + 1) * cols + c] == 1) {
                    fence -= 2;
                }
            }
        }
    }
    printf("%d ", (fence));
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
    int rows;
    int cols;
    cin >> rows;
    cin >> cols;
    int tile[36] = {0};
    for (int i = 0; i < rows * cols; i++) {
        cin >> tile[i];
    }
    int fence = 0;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (tile[r * cols + c] == 1) {
                fence += 4;
                if (c + 1 < cols && tile[r * cols + c + 1] == 1) {
                    fence -= 1;
                }
                if (r + 1 < rows && tile[(r + 1) * cols + c] == 1) {
                    fence -= 2;
                }
            }
        }
    }
    cout << (fence) << ' ';
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
        int rows;
        int cols;
        rows = scanner.nextInt();
        cols = scanner.nextInt();
        int[] tile = new int[36];
        for (int i = 0; i < rows * cols; i++) {
            tile[i] = scanner.nextInt();
        }
        int fence = 0;
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (tile[r * cols + c] == 1) {
                    fence += 4;
                    if (c + 1 < cols && tile[r * cols + c + 1] == 1) {
                        fence -= 1;
                    }
                    if (r + 1 < rows && tile[(r + 1) * cols + c] == 1) {
                        fence -= 2;
                    }
                }
            }
        }
        System.out.print((fence) + " ");
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

rows = read_int()
cols = read_int()
tile = [read_int() for _ in range(rows * cols)]
fence = 0
for r in range(rows):
    for c in range(cols):
        if tile[r * cols + c] == 1:
            fence += 4
            if c + 1 < cols and tile[r * cols + c + 1] == 1:
                fence -= 1
            if r + 1 < rows and tile[(r + 1) * cols + c] == 1:
                fence -= 2
print(fence)
```

---

## 66. Fixed Step Conveyor

GRAPHS · Difficulty 9 · Bounty 320

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS redirected a conveyor token. Patch traces the requested number of arrow crossings.

What the code should do
Start at `s` and follow exactly `k` arrows. Each vertex has exactly one outgoing arrow. Revisiting vertices and self-arrows are allowed. With zero crossings, stay at `s`.

What's going wrong
The token can stop at the vertex just before its required destination.

How to read the code
`next` in C, C++ and Java, or `nxt` in Python, stores one outgoing destination per vertex. `position` is updated once for every requested crossing.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `k`, and `s`, then `n` destinations in vertex order.

Output
Print the vertex occupied after exactly `k` crossings.

Example explained
Sample 1 starts at `0` on arrows `0 -> 1 -> 2 -> 0` and makes two crossings, so print `2`. Sample 2 requests zero crossings from `1`, so print `1`.

Limits
`1 <= n <= 12`; `0 <= k <= 30`; `s` and every destination are from `0` through `n - 1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 0
1 2 0
```

Expected output:

```text
2
```

Sample 2 input:

```text
3 0 1
1 2 0
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Trace a request for exactly one crossing.
2. The loop counter counts crossings, not the vertices written down.
3. Run one update for every step number from zero through `k - 1`; zero steps must run none.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int k;
    int s;
    scanf("%d", &n);
    scanf("%d", &k);
    scanf("%d", &s);
    int next[12] = {0};
    for (int u = 0; u < n; u++) {
        scanf("%d", &next[u]);
    }
    int position = s;
    for (int step = 0; step < k - 1; step++) {
        position = next[position];
    }
    printf("%d ", (position));
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
    int k;
    int s;
    cin >> n;
    cin >> k;
    cin >> s;
    int next[12] = {0};
    for (int u = 0; u < n; u++) {
        cin >> next[u];
    }
    int position = s;
    for (int step = 0; step < k - 1; step++) {
        position = next[position];
    }
    cout << (position) << ' ';
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
        int k;
        int s;
        n = scanner.nextInt();
        k = scanner.nextInt();
        s = scanner.nextInt();
        int[] next = new int[12];
        for (int u = 0; u < n; u++) {
            next[u] = scanner.nextInt();
        }
        int position = s;
        for (int step = 0; step < k - 1; step++) {
            position = next[position];
        }
        System.out.print((position) + " ");
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
s = read_int()
nxt = [read_int() for _ in range(n)]
position = s
for step in range(k - 1):
    position = nxt[position]
print(position)
```

---

## 67. Immediate Return Log

GRAPHS · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS sent a patrol back along its last cable. Ishan counts those immediate returns in the walk log.

What the code should do
Count positions where a walk goes from some vertex `a` to a different vertex `b` and immediately back to `a`. Each qualifying three-entry section contributes once, and sections may overlap. Consecutive log entries always differ. No graph reconstruction is needed.

What's going wrong
A return after two moves can be missed because the program compares adjacent entries.

How to read the code
`walk` is the recorded sequence of vertices. A loop position `i` represents the end of two consecutive moves. `returns` counts immediate reversals.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the number of possible vertices, and `k`, the log length. Then read `k` entries in `walk`.

Output
Print the number of immediate two-move returns.

Example explained
Sample 1 is `0 1 0 1`, which contains returns `0 1 0` and `1 0 1`, so print `2`. Sample 2 is `0 1 2` and prints `0`.

Limits
`1 <= n <= 12`; `1 <= k <= 20`. Entries are from `0` through `n - 1`, and adjacent entries differ. Each recorded move uses an available two-way cable; its full map is not needed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 4
0 1 0 1
```

Expected output:

```text
2
```

Sample 2 input:

```text
3 3
0 1 2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Write down the positions in a three-entry log `0 1 0`.
2. An immediate return ends where the previous move began.
3. Compare the current entry with the entry two positions earlier. Leave overlapping sections in the count.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int k;
    scanf("%d", &n);
    scanf("%d", &k);
    int walk[20] = {0};
    for (int i = 0; i < k; i++) {
        scanf("%d", &walk[i]);
    }
    int returns = 0;
    for (int i = 2; i < k; i++) {
        if (walk[i] == walk[i - 1]) {
            returns++;
        }
    }
    printf("%d ", (returns));
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
    int k;
    cin >> n;
    cin >> k;
    int walk[20] = {0};
    for (int i = 0; i < k; i++) {
        cin >> walk[i];
    }
    int returns = 0;
    for (int i = 2; i < k; i++) {
        if (walk[i] == walk[i - 1]) {
            returns++;
        }
    }
    cout << (returns) << ' ';
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
        int k;
        n = scanner.nextInt();
        k = scanner.nextInt();
        int[] walk = new int[20];
        for (int i = 0; i < k; i++) {
            walk[i] = scanner.nextInt();
        }
        int returns = 0;
        for (int i = 2; i < k; i++) {
            if (walk[i] == walk[i - 1]) {
                returns++;
            }
        }
        System.out.print((returns) + " ");
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
walk = [read_int() for _ in range(k)]
returns = 0
for i in range(2, k):
    if walk[i] == walk[i - 1]:
        returns += 1
print(returns)
```

---

## 68. Two Link Promise

GRAPHS · Difficulty 24 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS forged a shortcut promise. Mira checks the promise against the original one-way map.

What the code should do
Check this rule for every ordered triple of vertices: if direct links `u -> v` and `v -> w` both exist, the direct link `u -> w` must also exist. Do not add links. The first and last vertex may be equal, so a return in two links requires a self-link.

What's going wrong
A missing shortcut can be overlooked when just one of the two required links is absent in the condition.

How to read the code
`u`, `v`, and `w` choose a possible two-link walk. `ok` records whether all such walks have their required direct shortcut. The table is only inspected, never extended.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the link count. Self-links may appear. Then read `m` pairs `u v`, each a one-way link from `u` to `v`.

Output
Print `YES` if the original map obeys the rule everywhere; otherwise print `NO`.

Example explained
Sample 1 has `0 -> 1`, `1 -> 2`, and `0 -> 2`, so print `YES`. Sample 2 lacks `0 -> 2`, so print `NO`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Directed links are distinct ; self-links are allowed. `0 <= m <= n * n`.

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
YES
```

Sample 2 input:

```text
3 2
0 1
1 2
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Trace a two-link chain whose direct shortcut is missing.
2. The second link starts at the middle vertex `v`.
3. Check the consecutive links `u -> v` and `v -> w` before testing the shortcut `u -> w`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
    }
    int ok = 1;
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            for (int w = 0; w < n; w++) {
                if (edge[u * n + v] == 1 && edge[u * n + w] == 1 && edge[u * n + w] == 0) {
                    ok = 0;
                }
            }
        }
    }
    if (ok == 1) {
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
    }
    int ok = 1;
    for (int u = 0; u < n; u++) {
        for (int v = 0; v < n; v++) {
            for (int w = 0; w < n; w++) {
                if (edge[u * n + v] == 1 && edge[u * n + w] == 1 && edge[u * n + w] == 0) {
                    ok = 0;
                }
            }
        }
    }
    if (ok == 1) {
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
        }
        int ok = 1;
        for (int u = 0; u < n; u++) {
            for (int v = 0; v < n; v++) {
                for (int w = 0; w < n; w++) {
                    if (edge[u * n + v] == 1 && edge[u * n + w] == 1 && edge[u * n + w] == 0) {
                        ok = 0;
                    }
                }
            }
        }
        if (ok == 1) {
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
            if edge[u * n + v] == 1 and edge[u * n + w] == 1 and edge[u * n + w] == 0:
                ok = 0
print("YES" if ok == 1 else "NO")
```

---

## 69. Four Door Circuit

GRAPHS · Difficulty 27 · Bounty 710

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS opened a gap in the four-door circuits. Patch checks that each circuit closes.

What the code should do
Count circuits using four different vertices and four two-way cables in order, returning to the start. Rotating a circuit or reversing its direction does not make a new circuit. Different cable sets on the same four vertices do count separately. Extra diagonal cables do not invalidate a circuit.

What's going wrong
A three-cable chain across four vertices can be counted as a closed circuit.

How to read the code
The loops choose four distinct vertices. `a` is the smallest vertex in the circuit and `b < d` chooses one travel direction, so each circuit is counted once.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, the vertex count, and `m`, the cable count. Then read `m` pairs `u v`, each a two-way cable.

Output
Print the number of four-vertex circuits.

Example explained
Sample 1 is the square `0-1-2-3-0`, so print `1`. Sample 2 lacks the closing cable and prints `0`.

Limits
`1 <= n <= 8`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

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

Sample 2 input:

```text
4 3
0 1
1 2
2 3
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try a chain of four vertices with only three cables.
2. The loop bounds already handle duplicate circuit orders.
3. Keep those bounds and require the cable from the last vertex `d` back to `a`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int count = 0;
    for (int a = 0; a < n; a++) {
        for (int b = a + 1; b < n; b++) {
            for (int v = a + 1; v < n; v++) {
                for (int d = b + 1; d < n; d++) {
                    if (v != b && v != d) {
                        if (edge[a * n + b] == 1 && edge[b * n + v] == 1 && edge[v * n + d] == 1) {
                            count++;
                        }
                    }
                }
            }
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int count = 0;
    for (int a = 0; a < n; a++) {
        for (int b = a + 1; b < n; b++) {
            for (int v = a + 1; v < n; v++) {
                for (int d = b + 1; d < n; d++) {
                    if (v != b && v != d) {
                        if (edge[a * n + b] == 1 && edge[b * n + v] == 1 && edge[v * n + d] == 1) {
                            count++;
                        }
                    }
                }
            }
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int count = 0;
        for (int a = 0; a < n; a++) {
            for (int b = a + 1; b < n; b++) {
                for (int v = a + 1; v < n; v++) {
                    for (int d = b + 1; d < n; d++) {
                        if (v != b && v != d) {
                            if (edge[a * n + b] == 1 && edge[b * n + v] == 1 && edge[v * n + d] == 1) {
                                count++;
                            }
                        }
                    }
                }
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
                    if edge[a * n + b] == 1 and edge[b * n + v] == 1 and edge[v * n + d] == 1:
                        count += 1
print(count)
```

---

## 70. First Crossing Toll

GRAPHS · Difficulty 22 · Bounty 600

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS duplicated toll charges. Ishan checks a courier who pays for each cable only on its first crossing.

What the code should do
Follow the supplied valid walk on a two-way weighted graph. Pay a cable toll only on its first crossing in either direction during this walk. Later crossings of that same cable are free. Add the tolls actually paid; do not choose a different walk.

What's going wrong
Returning along a cable can charge its toll a second time.

How to read the code
`used` records paid cables. `walk` supplies an already valid route. Each new cable adds its `edge` toll, then the payment table is updated.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n` and `m`, then `m` triples `u v weight`. Read `k`, then `k` walk vertices.

Output
Print the total first-crossing toll.

Example explained
Sample 1 crosses cable `0-1` twice in opposite directions at toll `7`, so print `7`. Sample 2 crosses two different cables costing `3` and `5`, so print `8`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `1 <= weight <= 100`; `1 <= k <= 20`. Each walk step uses a listed cable.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1
0 1 7
3 0 1 0
```

Expected output:

```text
7
```

Sample 2 input:

```text
3 2
0 1 3
1 2 5
3 0 1 2
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. Cross one cable and immediately return along it.
2. The cable has one payment state, even though the table has two entries.
3. When recording payment, mark the entry for the reverse direction too.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        int weight;
        scanf("%d", &weight);
        edge[u * n + v] = weight;
        edge[v * n + u] = weight;
    }
    int k;
    scanf("%d", &k);
    int walk[20] = {0};
    for (int i = 0; i < k; i++) {
        scanf("%d", &walk[i]);
    }
    int used[144] = {0};
    int total = 0;
    for (int i = 1; i < k; i++) {
        int u = walk[i - 1];
        int v = walk[i];
        if (used[u * n + v] == 0) {
            total += edge[u * n + v];
            used[u * n + v] = 1;
            used[u * n + v] = 1;
        }
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
    int m;
    cin >> n;
    cin >> m;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        int weight;
        cin >> weight;
        edge[u * n + v] = weight;
        edge[v * n + u] = weight;
    }
    int k;
    cin >> k;
    int walk[20] = {0};
    for (int i = 0; i < k; i++) {
        cin >> walk[i];
    }
    int used[144] = {0};
    int total = 0;
    for (int i = 1; i < k; i++) {
        int u = walk[i - 1];
        int v = walk[i];
        if (used[u * n + v] == 0) {
            total += edge[u * n + v];
            used[u * n + v] = 1;
            used[u * n + v] = 1;
        }
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            int weight;
            weight = scanner.nextInt();
            edge[u * n + v] = weight;
            edge[v * n + u] = weight;
        }
        int k;
        k = scanner.nextInt();
        int[] walk = new int[20];
        for (int i = 0; i < k; i++) {
            walk[i] = scanner.nextInt();
        }
        int[] used = new int[144];
        int total = 0;
        for (int i = 1; i < k; i++) {
            int u = walk[i - 1];
            int v = walk[i];
            if (used[u * n + v] == 0) {
                total += edge[u * n + v];
                used[u * n + v] = 1;
                used[u * n + v] = 1;
            }
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
        used[u * n + v] = 1
print(total)
```

---

## 71. Synchronous Relay Lamps

GRAPHS · Difficulty 26 · Bounty 690

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS mixed the lamp update times. Mira restores the simultaneous rounds on the relay network.

What the code should do
Run exactly `rounds` simultaneous rounds on the two-way graph. In each round a vertex becomes lit (`1`) exactly when it had one lit direct neighbour at the start of that round; otherwise it becomes dark (`0`). Its own old lamp does not count. All vertices update together, including lamps that were already lit.

What's going wrong
Changing the order of vertex labels can change a round that should be simultaneous.

How to read the code
`state` holds lamps at the start of a round. `nextstate` holds proposed results, and `active` counts lit neighbours of one vertex. A separate loop installs the round results.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `m`, and `rounds`, then `n` initial lamp values, then `m` two-way pairs.

Output
Print the final `n` zero/one lamp values in vertex order.

Example explained
Sample 1 is chain `0-1-2` with lamps `1 0 0`: after one simultaneous round print `0 1 0`. Sample 2 requests zero rounds and preserves `1 0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `0 <= rounds <= 6`. Initial lamps are `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 1
1 0 0
0 1
1 2
```

Expected output:

```text
0 1 0
```

Sample 2 input:

```text
2 1 0
1 0
0 1
```

Expected output:

```text
1 0
```

### Progressive hints (private until purchased)

1. Trace one round on a three-vertex chain.
2. Every vertex must see the same snapshot, regardless of loop order.
3. Read neighbour lamps from the old-round array, and write results only to the next-round array until all vertices are processed.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int rounds;
    scanf("%d", &rounds);
    int edge[144] = {0};
    int state[12] = {0};
    for (int u = 0; u < n; u++) {
        scanf("%d", &state[u]);
    }
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int nextstate[12] = {0};
    for (int round = 0; round < rounds; round++) {
        for (int u = 0; u < n; u++) {
            nextstate[u] = state[u];
        }
        for (int u = 0; u < n; u++) {
            int active = 0;
            for (int v = 0; v < n; v++) {
                active += edge[u * n + v] * nextstate[v];
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
        printf("%d ", (state[u]));
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
    int m;
    cin >> n;
    cin >> m;
    int rounds;
    cin >> rounds;
    int edge[144] = {0};
    int state[12] = {0};
    for (int u = 0; u < n; u++) {
        cin >> state[u];
    }
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int nextstate[12] = {0};
    for (int round = 0; round < rounds; round++) {
        for (int u = 0; u < n; u++) {
            nextstate[u] = state[u];
        }
        for (int u = 0; u < n; u++) {
            int active = 0;
            for (int v = 0; v < n; v++) {
                active += edge[u * n + v] * nextstate[v];
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
        cout << (state[u]) << ' ';
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int rounds;
        rounds = scanner.nextInt();
        int[] edge = new int[144];
        int[] state = new int[12];
        for (int u = 0; u < n; u++) {
            state[u] = scanner.nextInt();
        }
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int[] nextstate = new int[12];
        for (int round = 0; round < rounds; round++) {
            for (int u = 0; u < n; u++) {
                nextstate[u] = state[u];
            }
            for (int u = 0; u < n; u++) {
                int active = 0;
                for (int v = 0; v < n; v++) {
                    active += edge[u * n + v] * nextstate[v];
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
            System.out.print((state[u]) + " ");
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
            active += edge[u * n + v] * nextstate[v]
        nextstate[u] = 0
        if active == 1:
            nextstate[u] = 1
    state = nextstate
print(*state)
```

---

## 72. Junction Switch Patrol

GRAPHS · Difficulty 24 · Bounty 650

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS moved the switch toggles. Patch traces a patrol that alternates ports separately at every junction.

What the code should do
Every vertex starts with its switch set to port `0`. For each of exactly `k` moves, follow the current vertex's selected port, and toggle that departure vertex's switch between `0` and `1`. No other switch changes. Self-links and equal port destinations are allowed. Report the final position and how many switches are set to `1`.

What's going wrong
Arriving at a junction can change its switch before the patrol departs from it.

How to read the code
`port0` and `port1` hold two destinations per vertex. `choice` stores the next port to use at that vertex. `u` saves the departure vertex while `position` moves.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `k`, and start `s`. Then read `n` pairs `port0 port1` in vertex order.

Output
Print the final position and the number of switches set to `1`.

Example explained
Sample 1 has ports `1 0` at vertex `0` and `0 1` at vertex `1`. Two moves from `0` return to `0` and toggle both departure switches, so print `0 2`. Sample 2 makes no moves from `1`, so print `1 0`.

Limits
`1 <= n <= 12`; `0 <= k <= 30`. The start and every port destination are valid vertex numbers.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2 0
1 0
0 1
```

Expected output:

```text
0 2
```

Sample 2 input:

```text
2 0 1
1 0
0 1
```

Expected output:

```text
1 0
```

### Progressive hints (private until purchased)

1. Trace two moves between different vertices and record each switch separately.
2. The vertex stored in `position` changes before the toggle line.
3. Use the saved departure vertex `u` when updating the switch.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int k;
    int s;
    scanf("%d", &n);
    scanf("%d", &k);
    scanf("%d", &s);
    int port0[12] = {0};
    int port1[12] = {0};
    int choice[12] = {0};
    for (int u = 0; u < n; u++) {
        scanf("%d", &port0[u]);
        scanf("%d", &port1[u]);
    }
    int position = s;
    for (int step = 0; step < k; step++) {
        int u = position;
        if (choice[u] == 0) {
            position = port0[u];
        } else {
            position = port1[u];
        }
        choice[position] = 1 - choice[position];
    }
    int switched = 0;
    for (int u = 0; u < n; u++) {
        switched += choice[u];
    }
    printf("%d ", (position));
    printf("%d ", (switched));
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
    int k;
    int s;
    cin >> n;
    cin >> k;
    cin >> s;
    int port0[12] = {0};
    int port1[12] = {0};
    int choice[12] = {0};
    for (int u = 0; u < n; u++) {
        cin >> port0[u];
        cin >> port1[u];
    }
    int position = s;
    for (int step = 0; step < k; step++) {
        int u = position;
        if (choice[u] == 0) {
            position = port0[u];
        } else {
            position = port1[u];
        }
        choice[position] = 1 - choice[position];
    }
    int switched = 0;
    for (int u = 0; u < n; u++) {
        switched += choice[u];
    }
    cout << (position) << ' ';
    cout << (switched) << ' ';
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
        int k;
        int s;
        n = scanner.nextInt();
        k = scanner.nextInt();
        s = scanner.nextInt();
        int[] port0 = new int[12];
        int[] port1 = new int[12];
        int[] choice = new int[12];
        for (int u = 0; u < n; u++) {
            port0[u] = scanner.nextInt();
            port1[u] = scanner.nextInt();
        }
        int position = s;
        for (int step = 0; step < k; step++) {
            int u = position;
            if (choice[u] == 0) {
                position = port0[u];
            } else {
                position = port1[u];
            }
            choice[position] = 1 - choice[position];
        }
        int switched = 0;
        for (int u = 0; u < n; u++) {
            switched += choice[u];
        }
        System.out.print((position) + " ");
        System.out.print((switched) + " ");
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
    choice[position] = 1 - choice[position]
switched = sum(choice)
print(position, switched)
```

---

## 73. Discovery Sender Cards

GRAPHS · Difficulty 31 · Bounty 800

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS replaced sender cards in a rescue broadcast. Mira restores the card of the relay that first discovered each vertex.

What the code should do
Run the supplied first-in-first-out discovery process from `s`. Start by discovering `s` and give it parent `s`. Take discovered vertices from the front of the queue. For each one, inspect its direct neighbours in ascending number order. When a neighbour is still undiscovered, set its parent to the current vertex and add it at the queue end. Never change an assigned parent. Unreachable vertices keep `-1`.

What's going wrong
A vertex discovered several links from the start can claim that the start contacted it directly.

How to read the code
`queue` holds vertices in discovery order, with `head` selecting the next one to process. `parent` starts at `-1` and doubles as the discovered flag. Neighbours are inspected in ascending vertex order.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `m`, and `s`, then `m` two-way pairs.

Output
Print all `n` discovery-parent labels in vertex order.

Example explained
Sample 1 is chain `0-1-2` starting at `0`, so print `0 0 1`. Sample 2 has only `0-1` and starts at `2`, so print `-1 -1 2`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `s` is a valid vertex.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2 0
0 1
1 2
```

Expected output:

```text
0 0 1
```

Sample 2 input:

```text
3 1 2
0 1
```

Expected output:

```text
-1 -1 2
```

### Progressive hints (private until purchased)

1. Trace a chain containing at least two cables from the start.
2. The sender of a discovery is the vertex taken from the queue for that iteration.
3. Assign the newly discovered neighbour the current processing vertex `u`, leaving the start's own card unchanged.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int s;
    scanf("%d", &s);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int parent[12] = {0};
    int queue[12] = {0};
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
                parent[v] = s;
                queue[tail] = v;
                tail++;
            }
        }
    }
    for (int v = 0; v < n; v++) {
        printf("%d ", (parent[v]));
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
    int m;
    cin >> n;
    cin >> m;
    int s;
    cin >> s;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int parent[12] = {0};
    int queue[12] = {0};
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
                parent[v] = s;
                queue[tail] = v;
                tail++;
            }
        }
    }
    for (int v = 0; v < n; v++) {
        cout << (parent[v]) << ' ';
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
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int s;
        s = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int[] parent = new int[12];
        int[] queue = new int[12];
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
                    parent[v] = s;
                    queue[tail] = v;
                    tail++;
                }
            }
        }
        for (int v = 0; v < n; v++) {
            System.out.print((parent[v]) + " ");
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
            parent[v] = s
            queue.append(v)
print(*parent)
```

---

## 74. Largest Floor Island

GRAPHS · Difficulty 33 · Bounty 850

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS severed the floor map. Patch measures the largest region still joined by shared tile sides.

What the code should do
Find the largest group of occupied (`1`) grid tiles connected through shared full sides. Empty (`0`) tiles cannot be crossed. Diagonal contact does not connect tiles. Count tiles in a group, not its boundary. Print zero if every tile is empty. The supplied bounded queue search already visits each tile at most once.

What's going wrong
A single bent region can be split into smaller reported islands.

How to read the code
`tile` is the row-ordered grid. `seen` prevents a tile from joining two searches. The four offsets in `dr` and `dc` describe side neighbours. `tail` is the size of the current island; `best` keeps the largest size.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `rows` and `cols`, then `rows * cols` tile values in row order.

Output
Print the largest side-connected occupied group size.

Example explained
Sample 1 has three occupied tiles joined in a bent shape and prints `3`. Sample 2 has only diagonal occupied tiles and prints `1`.

Limits
`1 <= rows, cols <= 6`. Each tile is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2
1 1
0 1
```

Expected output:

```text
3
```

Sample 2 input:

```text
2 2
1 0
0 1
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Trace a region that must turn left after moving down.
2. Pair the four row offsets with the four column offsets.
3. The left move keeps the row unchanged and decreases the column by one.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int rows;
    int cols;
    scanf("%d", &rows);
    scanf("%d", &cols);
    int tile[36] = {0};
    int seen[36] = {0};
    int queue[36] = {0};
    for (int i = 0; i < rows * cols; i++) {
        scanf("%d", &tile[i]);
    }
    int dr[4] = {0};
    int dc[4] = {0};
    dr[0] = -1;
    dr[1] = 1;
    dc[2] = 0;
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
    int rows;
    int cols;
    cin >> rows;
    cin >> cols;
    int tile[36] = {0};
    int seen[36] = {0};
    int queue[36] = {0};
    for (int i = 0; i < rows * cols; i++) {
        cin >> tile[i];
    }
    int dr[4] = {0};
    int dc[4] = {0};
    dr[0] = -1;
    dr[1] = 1;
    dc[2] = 0;
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
        int rows;
        int cols;
        rows = scanner.nextInt();
        cols = scanner.nextInt();
        int[] tile = new int[36];
        int[] seen = new int[36];
        int[] queue = new int[36];
        for (int i = 0; i < rows * cols; i++) {
            tile[i] = scanner.nextInt();
        }
        int[] dr = new int[4];
        int[] dc = new int[4];
        dr[0] = -1;
        dr[1] = 1;
        dc[2] = 0;
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

rows = read_int()
cols = read_int()
tile = [read_int() for _ in range(rows * cols)]
seen = [0] * (rows * cols)
dr = [-1, 1, 0, 0]
dc = [0, 0, 0, 1]
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
print(best)
```

---

## 75. Simultaneous Twig Trim

GRAPHS · Difficulty 32 · Bounty 820

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS made tree cleanup depend on label order. Ishan restores simultaneous trimming of the repair tree.

What the code should do
Begin with every vertex of the given two-way tree alive. Run exactly `rounds` simultaneous rounds. At the start of each round, mark every alive vertex that has at most one alive neighbour. Remove all marked vertices together, along with their incident cables. An isolated vertex is removed too. A vertex newly exposed by those removals waits until the next round. The empty tree remains empty.

What's going wrong
One round can remove a vertex that became a leaf only after another vertex was removed during that same round.

How to read the code
`alive` records the current tree vertices. Each round fills `removed` from the old tree, then a separate loop applies those removals. `degree` counts only neighbours still alive.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, `m`, and `rounds`, then `m` two-way tree pairs.

Output
Print the surviving vertex count, followed by surviving vertex numbers in ascending order. If none remain, print only `0`.

Example explained
Sample 1 trims one round from chain `0-1-2-3-4`, leaving `1 2 3`; print `3 1 2 3`. Sample 2 trims the only vertex and prints `0`.

Limits
`1 <= n <= 12`. Vertices are numbered `0` through `n - 1`. Two-way cables are distinct and never join a vertex to itself. `0 <= m <= n * (n - 1) / 2`. `m = n - 1` and all vertices are connected, so the graph is a tree. `0 <= rounds <= 6`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 4 1
0 1
1 2
2 3
3 4
```

Expected output:

```text
3 1 2 3
```

Sample 2 input:

```text
1 0 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Trace one round on a five-vertex chain.
2. All degree checks in one round must use the same alive-vertex snapshot.
3. Mark the vertex in the removal array during selection; update the alive array only in the separate application loop.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    int m;
    scanf("%d", &n);
    scanf("%d", &m);
    int rounds;
    scanf("%d", &rounds);
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        scanf("%d", &u);
        scanf("%d", &v);
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int alive[12] = {0};
    int removed[12] = {0};
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
                    alive[u] = 0;
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
    printf("%d ", (count));
    for (int u = 0; u < n; u++) {
        if (alive[u] == 1) {
            printf("%d ", (u));
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
    int n;
    int m;
    cin >> n;
    cin >> m;
    int rounds;
    cin >> rounds;
    int edge[144] = {0};
    for (int i = 0; i < m; i++) {
        int u;
        int v;
        cin >> u;
        cin >> v;
        edge[u * n + v] = 1;
        edge[v * n + u] = 1;
    }
    int alive[12] = {0};
    int removed[12] = {0};
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
                    alive[u] = 0;
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
    cout << (count) << ' ';
    for (int u = 0; u < n; u++) {
        if (alive[u] == 1) {
            cout << (u) << ' ';
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
        int n;
        int m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int rounds;
        rounds = scanner.nextInt();
        int[] edge = new int[144];
        for (int i = 0; i < m; i++) {
            int u;
            int v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            edge[u * n + v] = 1;
            edge[v * n + u] = 1;
        }
        int[] alive = new int[12];
        int[] removed = new int[12];
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
                        alive[u] = 0;
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
        System.out.print((count) + " ");
        for (int u = 0; u < n; u++) {
            if (alive[u] == 1) {
                System.out.print((u) + " ");
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
                alive[u] = 0
    for u in range(n):
        if removed[u] == 1:
            alive[u] = 0
result = [u for u in range(n) if alive[u] == 1]
print(len(result), *result)
```

---

## 76. Single Pilot Signal

LOGIC · Difficulty 6 · Bounty 250

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS forged cockpit requests. Mira checks whether exactly one pilot requested control.

What the code should do
Print `1` if exactly one of the four flags is `1`. Print `0` if none or more than one are `1`.

What's going wrong
Several simultaneous requests can receive the same decision as one request.

How to read the code
`a`, `b`, `c`, and `d` are four request flags. `requests` records their total, and `allowed` is the printed decision.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read four integers: `a b c d`.

Output
Print one integer, `1` or `0`.

Example explained
For `0 1 0 0`, only one pilot requests control. Print `1`.

Limits
Every flag is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
0 1 0 0
```

Expected output:

```text
1
```

Sample 2 input:

```text
0 0 0 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare one request with two requests.
2. The decision depends on the total number of active flags.
3. The accepted total is one specific value, rather than every value above zero.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int a;
    int b;
    int c;
    int d;
    scanf("%d", &a);
    scanf("%d", &b);
    scanf("%d", &c);
    scanf("%d", &d);
    int requests = a + b + c + d;
    int allowed = 0;
    if (requests >= 1) {
        allowed = 1;
    }
    printf("%d ", (allowed));
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
    int a;
    int b;
    int c;
    int d;
    cin >> a;
    cin >> b;
    cin >> c;
    cin >> d;
    int requests = a + b + c + d;
    int allowed = 0;
    if (requests >= 1) {
        allowed = 1;
    }
    cout << (allowed) << ' ';
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
        int a;
        int b;
        int c;
        int d;
        a = scanner.nextInt();
        b = scanner.nextInt();
        c = scanner.nextInt();
        d = scanner.nextInt();
        int requests = a + b + c + d;
        int allowed = 0;
        if (requests >= 1) {
            allowed = 1;
        }
        System.out.print((allowed) + " ");
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

a = read_int()
b = read_int()
c = read_int()
d = read_int()
requests = a + b + c + d
allowed = 0
if requests >= 1:
    allowed = 1
print(allowed)
```

---

## 77. Inspection Bit

LOGIC · Difficulty 9 · Bounty 320

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS hid a lamp status inside a control byte. Patch checks the requested lamp.

What the code should do
Print `1` when bit position `bit` is set in `mask`, otherwise print `0`. Position `0` is the rightmost binary digit.

What's going wrong
An enabled lamp above position zero can be reported as disabled.

How to read the code
`mask` stores eight on/off flags in binary. `bit` selects a position, `selected` isolates its value, and `answer` records the decision.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `mask` and `bit`.

Output
Print one integer, `1` or `0`.

Example explained
The binary form of `mask = 10` is `00001010`. Position `3` is set, so print `1`.

Limits
`0 <= mask <= 255`; `0 <= bit <= 7`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
10 3
```

Expected output:

```text
1
```

Sample 2 input:

```text
10 2
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try a set bit that is not the rightmost bit.
2. An isolated set bit keeps its original place value.
3. The test should accept any nonzero isolated value.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int mask;
    int bit;
    scanf("%d", &mask);
    scanf("%d", &bit);
    int selected = mask & (1 << bit);
    int answer = 0;
    if (selected == 1) {
        answer = 1;
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
    int mask;
    int bit;
    cin >> mask;
    cin >> bit;
    int selected = mask & (1 << bit);
    int answer = 0;
    if (selected == 1) {
        answer = 1;
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
        int mask;
        int bit;
        mask = scanner.nextInt();
        bit = scanner.nextInt();
        int selected = mask & (1 << bit);
        int answer = 0;
        if (selected == 1) {
            answer = 1;
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

mask = read_int()
bit = read_int()
selected = mask & (1 << bit)
answer = 0
if selected == 1:
    answer = 1
print(answer)
```

---

## 78. Complete Permit Set

LOGIC · Difficulty 15 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS removed some launch permits. Ishan checks whether every required permit remains.

What the code should do
A set bit represents one permit. Print `1` only if every set bit of `required` is also set in `held`. Extra held permits are allowed. If `required` is zero, print `1`.

What's going wrong
A partial set of permits can be accepted.

How to read the code
`held` and `required` are bit masks. `shared` contains positions set in both. `allowed` is the final yes/no decision.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `held` and `required`.

Output
Print one integer, `1` or `0`.

Example explained
With `held = 7` and `required = 5`, both required positions are present. Print `1`.

Limits
`0 <= held, required <= 255`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
7 5
```

Expected output:

```text
1
```

Sample 2 input:

```text
0 8
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try holding only one of two required permits.
2. The shared positions must cover the entire requirement.
3. Compare the shared mask with the required mask, including the zero requirement.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int held;
    int required;
    scanf("%d", &held);
    scanf("%d", &required);
    int shared = held & required;
    int allowed = 0;
    if (shared != 0) {
        allowed = 1;
    }
    printf("%d ", (allowed));
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
    int held;
    int required;
    cin >> held;
    cin >> required;
    int shared = held & required;
    int allowed = 0;
    if (shared != 0) {
        allowed = 1;
    }
    cout << (allowed) << ' ';
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
        int held;
        int required;
        held = scanner.nextInt();
        required = scanner.nextInt();
        int shared = held & required;
        int allowed = 0;
        if (shared != 0) {
            allowed = 1;
        }
        System.out.print((allowed) + " ");
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

held = read_int()
required = read_int()
shared = held & required
allowed = 0
if shared != 0:
    allowed = 1
print(allowed)
```

---

## 79. Heat Band Labels

LOGIC · Difficulty 7 · Bounty 270

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS corrupted a cooling panel. Mira checks its simple heat labels.

What the code should do
Print band `0` for temperatures below `20`, band `1` for temperatures from `20` through `49`, and band `2` for temperatures at least `50`.

What's going wrong
A reading at a band boundary can receive the cooler label.

How to read the code
`temperature` is the reading. `band` starts at the coolest label and may be changed by the classification branches.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read one integer, `temperature`.

Output
Print the band number.

Example explained
A temperature of `50` belongs to band `2`.

Limits
`-50 <= temperature <= 150`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
50
```

Expected output:

```text
2
```

Sample 2 input:

```text
19
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Check the first temperature in each band.
2. The hot-band branch runs before the warm-band branch.
3. Twenty belongs to the warm band; it must not remain in the initial band.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int temperature;
    scanf("%d", &temperature);
    int band = 0;
    if (temperature >= 50) {
        band = 2;
    } else if (temperature > 20) {
        band = 1;
    }
    printf("%d ", (band));
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
    int temperature;
    cin >> temperature;
    int band = 0;
    if (temperature >= 50) {
        band = 2;
    } else if (temperature > 20) {
        band = 1;
    }
    cout << (band) << ' ';
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
        int temperature;
        temperature = scanner.nextInt();
        int band = 0;
        if (temperature >= 50) {
            band = 2;
        } else if (temperature > 20) {
            band = 1;
        }
        System.out.print((band) + " ");
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

temperature = read_int()
band = 0
if temperature >= 50:
    band = 2
elif temperature > 20:
    band = 1
print(band)
```

---

## 80. Calendar Relay

LOGIC · Difficulty 8 · Bounty 290

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS shifted a maintenance calendar. Patch restores its weekday calculation.

What the code should do
Weekdays are numbered `0` through `6` and repeat every seven days. Print the weekday reached after moving forward `advance` days from `day`.

What's going wrong
An advance longer than one week can leave an invalid weekday number.

How to read the code
`day` is a weekday number. `advance` is a number of whole days, and `next_day` holds the computed weekday.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `day` and `advance`.

Output
Print one weekday number from `0` through `6`.

Example explained
From day `5`, moving forward `3` days reaches day `1`.

Limits
`0 <= day <= 6`; `0 <= advance <= 10000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 3
```

Expected output:

```text
1
```

Sample 2 input:

```text
2 0
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Try advancing by three full weeks.
2. The intermediate value may contain more than one complete week.
3. Keep only the part left after removing all full groups of seven.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int day;
    int advance;
    scanf("%d", &day);
    scanf("%d", &advance);
    int next_day = day + advance;
    if (next_day >= 7) {
        next_day -= 7;
    }
    printf("%d ", (next_day));
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
    int day;
    int advance;
    cin >> day;
    cin >> advance;
    int next_day = day + advance;
    if (next_day >= 7) {
        next_day -= 7;
    }
    cout << (next_day) << ' ';
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
        int day;
        int advance;
        day = scanner.nextInt();
        advance = scanner.nextInt();
        int next_day = day + advance;
        if (next_day >= 7) {
            next_day -= 7;
        }
        System.out.print((next_day) + " ");
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

day = read_int()
advance = read_int()
next_day = day + advance
if next_day >= 7:
    next_day -= 7
print(next_day)
```

---

## 81. Minute Carry Panel

LOGIC · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS stalled the clock display. Ishan checks how minute advances affect its hour field.

What the code should do
Advance a 24-hour clock by `advance` minutes. Carry complete groups of sixty minutes into the hour field. Wrap hours after `23`. Print the resulting hour and minute without leading zeroes.

What's going wrong
The minute field changes while the hour field can remain behind.

How to read the code
`total` combines the current minute field with the advance. `hour` and `minute` are the two clock fields printed at the end.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `hour`, `minute`, and `advance`.

Output
Print the resulting hour and minute, separated by a space.

Example explained
Advancing `10 50` by `20` minutes gives `11 10`.

Limits
`0 <= hour <= 23`; `0 <= minute <= 59`; `0 <= advance <= 10000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
10 50 20
```

Expected output:

```text
11 10
```

Sample 2 input:

```text
0 0 0
```

Expected output:

```text
0 0
```

### Progressive hints (private until purchased)

1. Trace a clock that crosses an hour boundary.
2. The same total supplies a whole-hour carry and a leftover minute field.
3. The hour update needs the number of complete groups of sixty.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int hour;
    int minute;
    int advance;
    scanf("%d", &hour);
    scanf("%d", &minute);
    scanf("%d", &advance);
    int total = minute + advance;
    hour = (hour + total % 60) % 24;
    minute = total % 60;
    printf("%d ", (hour));
    printf("%d ", (minute));
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
    int hour;
    int minute;
    int advance;
    cin >> hour;
    cin >> minute;
    cin >> advance;
    int total = minute + advance;
    hour = (hour + total % 60) % 24;
    minute = total % 60;
    cout << (hour) << ' ';
    cout << (minute) << ' ';
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
        int hour;
        int minute;
        int advance;
        hour = scanner.nextInt();
        minute = scanner.nextInt();
        advance = scanner.nextInt();
        int total = minute + advance;
        hour = (hour + total % 60) % 24;
        minute = total % 60;
        System.out.print((hour) + " ");
        System.out.print((minute) + " ");
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

hour = read_int()
minute = read_int()
advance = read_int()
total = minute + advance
hour = (hour + total % 60) % 24
minute = total % 60
print(hour, minute)
```

---

## 82. Latched Distress Light

LOGIC · Difficulty 10 · Bounty 340

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS is hiding distress reports. Mira needs a light that remembers any alarm.

What the code should do
Start the distress light off (`0`). Each alarm report of `1` turns it on. A normal report of `0` leaves it unchanged. Once on, it stays on for the rest of the input.

What's going wrong
A later normal report can erase an earlier alarm.

How to read the code
`alarm` is the current report. `latched` is the stored light state, initially off. The loop processes reports in order.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` report flags.

Output
Print the final light state, `0` or `1`.

Example explained
Reports `1 0 0` leave the light on. Print `1`.

Limits
`0 <= n <= 100`; each report is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
1 0 0
```

Expected output:

```text
1
```

Sample 2 input:

```text
2
0 0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Place a normal report after an alarm.
2. The stored light and the latest report describe different things.
3. An on light must remain on when the next report is zero.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int latched = 0;
    for (int i = 0; i < n; i++) {
        int alarm;
        scanf("%d", &alarm);
        latched = alarm;
    }
    printf("%d ", (latched));
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
    int latched = 0;
    for (int i = 0; i < n; i++) {
        int alarm;
        cin >> alarm;
        latched = alarm;
    }
    cout << (latched) << ' ';
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
        int latched = 0;
        for (int i = 0; i < n; i++) {
            int alarm;
            alarm = scanner.nextInt();
            latched = alarm;
        }
        System.out.print((latched) + " ");
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
latched = 0
for _ in range(n):
    alarm = read_int()
    latched = alarm
print(latched)
```

---

## 83. Pause Aware Meter

LOGIC · Difficulty 14 · Bounty 430

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS scrambled a test meter. Patch checks its pause and resume controls.

What the code should do
The meter starts running. Event `1` resumes it, event `2` pauses it, and event `3` records one tick only while running. Repeated pause or resume commands have no extra effect.

What's going wrong
Ticks received during a pause can be counted.

How to read the code
`running` stores whether the meter is enabled. `ticks` counts recorded tick events, and `event` is the current command.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` event codes.

Output
Print the number of recorded ticks.

Example explained
For events `3 2 3 1 3`, only the first and last ticks count. Print `2`.

Limits
`0 <= n <= 100`; each event is `1`, `2`, or `3`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
3 2 3 1 3
```

Expected output:

```text
2
```

Sample 2 input:

```text
2
3 3
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Put a tick between a pause and a resume.
2. The count branch depends on the stored running flag.
3. After a pause, the flag must represent the disabled state until a resume arrives.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int running = 1;
    int ticks = 0;
    for (int i = 0; i < n; i++) {
        int event;
        scanf("%d", &event);
        if (event == 1) {
            running = 1;
        } else if (event == 2) {
            running = 1;
        } else if (running == 1) {
            ticks++;
        }
    }
    printf("%d ", (ticks));
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
    int running = 1;
    int ticks = 0;
    for (int i = 0; i < n; i++) {
        int event;
        cin >> event;
        if (event == 1) {
            running = 1;
        } else if (event == 2) {
            running = 1;
        } else if (running == 1) {
            ticks++;
        }
    }
    cout << (ticks) << ' ';
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
        int running = 1;
        int ticks = 0;
        for (int i = 0; i < n; i++) {
            int event;
            event = scanner.nextInt();
            if (event == 1) {
                running = 1;
            } else if (event == 2) {
                running = 1;
            } else if (running == 1) {
                ticks++;
            }
        }
        System.out.print((ticks) + " ");
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
running = 1
ticks = 0
for _ in range(n):
    event = read_int()
    if event == 1:
        running = 1
    elif event == 2:
        running = 1
    elif running == 1:
        ticks += 1
print(ticks)
```

---

## 84. Bounded Lift Buttons

LOGIC · Difficulty 11 · Bounty 360

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS disturbed a service lift. Ishan checks that its buttons respect both ends of the shaft.

What the code should do
The lift starts at floor `0` and may use floors `0` through `top`. For each step, try moving by that step. Ignore a move whose destination is outside that range.

What's going wrong
The displayed floor can go below ground level.

How to read the code
`floor` is the current position and `top` is the highest allowed floor. Each `step` requests one upward or downward move.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `top` and `n`, then `n` steps. A step of `1` moves up and `-1` moves down.

Output
Print the final floor.

Example explained
With `top = 2` and steps `1 1 1 -1`, the third step is ignored. Print `1`.

Limits
`1 <= top <= 20`; `0 <= n <= 100`; each step is `-1` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 4
1 1 1 -1
```

Expected output:

```text
1
```

Sample 2 input:

```text
3 1
1
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Try moving down at floor zero.
2. The candidate floor must satisfy two separate boundaries.
3. Keep the upper check and also reject negative destinations.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int top;
    int n;
    scanf("%d", &top);
    scanf("%d", &n);
    int floor = 0;
    for (int i = 0; i < n; i++) {
        int step;
        scanf("%d", &step);
        int candidate = floor + step;
        if (candidate <= top) {
            floor = candidate;
        }
    }
    printf("%d ", (floor));
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
    int top;
    int n;
    cin >> top;
    cin >> n;
    int floor = 0;
    for (int i = 0; i < n; i++) {
        int step;
        cin >> step;
        int candidate = floor + step;
        if (candidate <= top) {
            floor = candidate;
        }
    }
    cout << (floor) << ' ';
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
        int top;
        int n;
        top = scanner.nextInt();
        n = scanner.nextInt();
        int floor = 0;
        for (int i = 0; i < n; i++) {
            int step;
            step = scanner.nextInt();
            int candidate = floor + step;
            if (candidate <= top) {
                floor = candidate;
            }
        }
        System.out.print((floor) + " ");
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

top = read_int()
n = read_int()
floor = 0
for _ in range(n):
    step = read_int()
    candidate = floor + step
    if candidate <= top:
        floor = candidate
print(floor)
```

---

## 85. Fresh Cooldown Pulse

LOGIC · Difficulty 19 · Bounty 540

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS flooded a beacon with pulses. Mira checks its short cooldown rule.

What the code should do
Start with cooldown zero. At the start of every slot, reduce a positive cooldown by one. Then, if the slot contains a pulse (`1`) and the cooldown is zero, accept it and set the cooldown to `gap`. A zero slot has no pulse. Print the number accepted.

What's going wrong
Quiet slots can fail to move the beacon toward readiness.

How to read the code
`remaining` is the cooldown counter. Each loop iteration is one time slot. `pulse` is that slot's request and `accepted` counts accepted requests.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `gap` and `n`, then `n` pulse flags in time order.

Output
Print the accepted pulse count.

Example explained
For `gap = 2` and flags `1 0 1`, the middle quiet slot still advances the cooldown. Both pulses are accepted. Print `2`.

Limits
`1 <= gap <= 10`; `0 <= n <= 100`; every flag is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 3
1 0 1
```

Expected output:

```text
2
```

Sample 2 input:

```text
1 3
1 1 1
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. Insert quiet slots between two pulses.
2. Time passes once per slot, even when no request arrives.
3. The cooldown update must depend on its counter, without requiring a pulse in that slot.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int gap;
    int n;
    scanf("%d", &gap);
    scanf("%d", &n);
    int remaining = 0;
    int accepted = 0;
    for (int i = 0; i < n; i++) {
        int pulse;
        scanf("%d", &pulse);
        if (remaining > 0 && pulse == 1) {
            remaining--;
        }
        if (pulse == 1 && remaining == 0) {
            accepted++;
            remaining = gap;
        }
    }
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
    int gap;
    int n;
    cin >> gap;
    cin >> n;
    int remaining = 0;
    int accepted = 0;
    for (int i = 0; i < n; i++) {
        int pulse;
        cin >> pulse;
        if (remaining > 0 && pulse == 1) {
            remaining--;
        }
        if (pulse == 1 && remaining == 0) {
            accepted++;
            remaining = gap;
        }
    }
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
        int gap;
        int n;
        gap = scanner.nextInt();
        n = scanner.nextInt();
        int remaining = 0;
        int accepted = 0;
        for (int i = 0; i < n; i++) {
            int pulse;
            pulse = scanner.nextInt();
            if (remaining > 0 && pulse == 1) {
                remaining--;
            }
            if (pulse == 1 && remaining == 0) {
                accepted++;
                remaining = gap;
            }
        }
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

gap = read_int()
n = read_int()
remaining = 0
accepted = 0
for _ in range(n):
    pulse = read_int()
    if remaining > 0 and pulse == 1:
        remaining -= 1
    if pulse == 1 and remaining == 0:
        accepted += 1
        remaining = gap
print(accepted)
```

---

## 86. Single Use Silencer

LOGIC · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS damaged a console silencer. Patch checks that one arming hides only one alarm.

What the code should do
Start with no silencer armed. Event `1` arms one silencer; arming again does not stack extra uses. Event `2` is an alarm: if armed, suppress that alarm and consume the silencer; otherwise count it as heard.

What's going wrong
One armed silencer can hide several later alarms.

How to read the code
`silent` records whether a silencer is armed. `heard` counts alarms that are actually heard. `event` selects arming or an alarm.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` event codes.

Output
Print the number of heard alarms.

Example explained
Events `1 2 2` suppress the first alarm only. Print `1`.

Limits
`0 <= n <= 100`; every event is `1` or `2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
1 2 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
2
2 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Send two alarms after one arming.
2. Suppression spends the stored one-use permission.
3. The suppressed-alarm branch must leave the silencer unarmed.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int silent = 0;
    int heard = 0;
    for (int i = 0; i < n; i++) {
        int event;
        scanf("%d", &event);
        if (event == 1) {
            silent = 1;
        } else if (silent == 1) {
            silent = 1;
        } else {
            heard++;
        }
    }
    printf("%d ", (heard));
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
    int silent = 0;
    int heard = 0;
    for (int i = 0; i < n; i++) {
        int event;
        cin >> event;
        if (event == 1) {
            silent = 1;
        } else if (silent == 1) {
            silent = 1;
        } else {
            heard++;
        }
    }
    cout << (heard) << ' ';
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
        int silent = 0;
        int heard = 0;
        for (int i = 0; i < n; i++) {
            int event;
            event = scanner.nextInt();
            if (event == 1) {
                silent = 1;
            } else if (silent == 1) {
                silent = 1;
            } else {
                heard++;
            }
        }
        System.out.print((heard) + " ");
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
silent = 0
heard = 0
for _ in range(n):
    event = read_int()
    if event == 1:
        silent = 1
    elif silent == 1:
        silent = 1
    else:
        heard += 1
print(heard)
```

---

## 87. Neighboring Enabled Lamps

LOGIC · Difficulty 18 · Bounty 510

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS overloaded a lamp strip. Ishan checks whether two neighboring lamps are both on.

What the code should do
Inspect all neighboring pairs among bit positions `0` through `7`. Print `1` if at least one pair contains two set bits, otherwise print `0`. Positions `7` and `0` are not neighbors.

What's going wrong
A pair with only one enabled lamp can trigger the warning.

How to read the code
`mask` stores eight lamp flags. `pair` isolates two neighboring positions, and `found` remembers whether any tested pair qualifies.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read one integer, `mask`.

Output
Print one integer, `1` or `0`.

Example explained
The binary form of `12` is `00001100`. Positions `2` and `3` are both on, so print `1`.

Limits
`0 <= mask <= 255`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
12
```

Expected output:

```text
1
```

Sample 2 input:

```text
0
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare binary `10` with binary `11`.
2. A two-bit value can be zero, one, two, or three.
3. Only the value with both two-bit positions set represents a qualifying pair.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int mask;
    scanf("%d", &mask);
    int found = 0;
    for (int bit = 0; bit < 7; bit++) {
        int pair = (mask >> bit) & 3;
        if (pair != 0) {
            found = 1;
        }
    }
    printf("%d ", (found));
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
    int mask;
    cin >> mask;
    int found = 0;
    for (int bit = 0; bit < 7; bit++) {
        int pair = (mask >> bit) & 3;
        if (pair != 0) {
            found = 1;
        }
    }
    cout << (found) << ' ';
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
        int mask;
        mask = scanner.nextInt();
        int found = 0;
        for (int bit = 0; bit < 7; bit++) {
            int pair = (mask >> bit) & 3;
            if (pair != 0) {
                found = 1;
            }
        }
        System.out.print((found) + " ");
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

mask = read_int()
found = 0
for bit in range(7):
    pair = (mask >> bit) & 3
    if pair != 0:
        found = 1
print(found)
```

---

## 88. Two Bit Mode Field

LOGIC · Difficulty 15 · Bounty 450

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS mixed mode flags with unrelated controls. Mira extracts the two-bit mode field.

What the code should do
Extract the two consecutive bits at positions `offset` and `offset + 1`. Treat the lower position as value one and the upper as value two. Ignore all other bits and print a value from `0` through `3`.

What's going wrong
Modes requiring the upper field bit can be shortened to the wrong value.

How to read the code
`word` is an eight-bit value. `offset` locates the lower of two field bits. `shifted` brings the field to the right edge, and `mode` is the extracted value.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `word` and `offset`.

Output
Print the extracted mode.

Example explained
For `word = 44` (binary `00101100`) and `offset = 2`, the selected bits are `11`. Print `3`.

Limits
`0 <= word <= 255`; `0 <= offset <= 6`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
44 2
```

Expected output:

```text
3
```

Sample 2 input:

```text
1 0
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Try a field whose two bits are both on.
2. Shifting puts the field in place but does not select its width.
3. The final mask must retain two low bits rather than one.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int word;
    int offset;
    scanf("%d", &word);
    scanf("%d", &offset);
    int shifted = word >> offset;
    int mode = shifted & 1;
    printf("%d ", (mode));
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
    int word;
    int offset;
    cin >> word;
    cin >> offset;
    int shifted = word >> offset;
    int mode = shifted & 1;
    cout << (mode) << ' ';
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
        int word;
        int offset;
        word = scanner.nextInt();
        offset = scanner.nextInt();
        int shifted = word >> offset;
        int mode = shifted & 1;
        System.out.print((mode) + " ");
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

word = read_int()
offset = read_int()
shifted = word >> offset
mode = shifted & 1
print(mode)
```

---

## 89. Equalizer Tick

LOGIC · Difficulty 17 · Bounty 490

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS jammed a calibration dial. Patch checks its one-unit approach to the target.

What the code should do
For each of `ticks` steps, increase `value` by one if it is below `target`, decrease it by one if it is above `target`, and leave it unchanged if equal. Make at most one adjustment per tick.

What's going wrong
The dial can move away from the target after reaching it.

How to read the code
`value` is the current dial reading and `target` is fixed. Each loop iteration represents one adjustment tick.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `value`, `target`, and `ticks`.

Output
Print the value after all ticks.

Example explained
Starting at `2` with target `5`, two ticks reach `4`.

Limits
`-100 <= value, target <= 100`; `0 <= ticks <= 200`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 5 2
```

Expected output:

```text
4
```

Sample 2 input:

```text
5 5 3
```

Expected output:

```text
5
```

### Progressive hints (private until purchased)

1. Trace a tick starting exactly at the target.
2. An equal reading needs neither upward nor downward movement.
3. The downward branch should cover values strictly above the target.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int value;
    int target;
    int ticks;
    scanf("%d", &value);
    scanf("%d", &target);
    scanf("%d", &ticks);
    for (int i = 0; i < ticks; i++) {
        if (value < target) {
            value++;
        } else if (value >= target) {
            value--;
        }
    }
    printf("%d ", (value));
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
    int value;
    int target;
    int ticks;
    cin >> value;
    cin >> target;
    cin >> ticks;
    for (int i = 0; i < ticks; i++) {
        if (value < target) {
            value++;
        } else if (value >= target) {
            value--;
        }
    }
    cout << (value) << ' ';
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
        int value;
        int target;
        int ticks;
        value = scanner.nextInt();
        target = scanner.nextInt();
        ticks = scanner.nextInt();
        for (int i = 0; i < ticks; i++) {
            if (value < target) {
                value++;
            } else if (value >= target) {
                value--;
            }
        }
        System.out.print((value) + " ");
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

value = read_int()
target = read_int()
ticks = read_int()
for _ in range(ticks):
    if value < target:
        value += 1
    elif value >= target:
        value -= 1
print(value)
```

---

## 90. Leap Day Access

LOGIC · Difficulty 12 · Bounty 380

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS altered the archive calendar. Ishan checks whether February may contain day twenty-nine.

What the code should do
A year is a leap year if divisible by `400`, or if divisible by `4` but not by `100`. Print `1` for a leap year and `0` otherwise.

What's going wrong
Some century years can incorrectly receive a leap day.

How to read the code
`year` is the calendar year and `leap` is the decision flag. The divisibility tests describe the calendar rules.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read one integer, `year`.

Output
Print one integer, `1` or `0`.

Example explained
Year `2000` is divisible by `400`, so print `1`. Year `1900` is a century not divisible by `400`, so print `0`.

Limits
`1 <= year <= 9999`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2000
```

Expected output:

```text
1
```

Sample 2 input:

```text
2023
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare years 1900 and 2000.
2. Divisibility by four alone is not enough for every year.
3. Keep the four-hundred-year exception and exclude other multiples of one hundred from the ordinary branch.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int year;
    scanf("%d", &year);
    int leap = 0;
    if (year % 400 == 0 || (year % 4 == 0)) {
        leap = 1;
    }
    printf("%d ", (leap));
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
    int year;
    cin >> year;
    int leap = 0;
    if (year % 400 == 0 || (year % 4 == 0)) {
        leap = 1;
    }
    cout << (leap) << ' ';
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
        int year;
        year = scanner.nextInt();
        int leap = 0;
        if (year % 400 == 0 || (year % 4 == 0)) {
            leap = 1;
        }
        System.out.print((leap) + " ");
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

year = read_int()
leap = 0
if year % 400 == 0 or (year % 4 == 0):
    leap = 1
print(leap)
```

---

## 91. Periodic Bell Phase

LOGIC · Difficulty 8 · Bounty 290

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS shifted a warning bell. Mira checks which queried times should ring.

What the code should do
For each queried nonnegative time, print `1` if its remainder on division by `period` equals `phase`; otherwise print `0`. Queries are independent and need not be sorted.

What's going wrong
The bell can use whole cycle counts instead of positions within a cycle.

How to read the code
`period` is the repeating cycle length and `phase` is the ringing position inside it. `time` is one query and `ring` is its decision.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `period`, `phase`, and `n`, then `n` query times.

Output
Print one decision per query, in input order, separated by whitespace.

Example explained
For period `5`, phase `2`, and times `2 7 8`, print `1 1 0`.

Limits
`2 <= period <= 20`; `0 <= phase < period`; `1 <= n <= 100`; `0 <= time <= 10000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 2 3
2 7 8
```

Expected output:

```text
1 1 0
```

Sample 2 input:

```text
4 0 3
0 4 8
```

Expected output:

```text
1 1 1
```

### Progressive hints (private until purchased)

1. Compare two ringing times separated by one full period.
2. A phase repeats after each complete cycle.
3. Use the position left within the cycle, rather than the count of complete cycles.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int period;
    int phase;
    int n;
    scanf("%d", &period);
    scanf("%d", &phase);
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        int time;
        scanf("%d", &time);
        int ring = 0;
        if (time / period == phase) {
            ring = 1;
        }
        printf("%d ", (ring));
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
    int period;
    int phase;
    int n;
    cin >> period;
    cin >> phase;
    cin >> n;
    for (int i = 0; i < n; i++) {
        int time;
        cin >> time;
        int ring = 0;
        if (time / period == phase) {
            ring = 1;
        }
        cout << (ring) << ' ';
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
        int period;
        int phase;
        int n;
        period = scanner.nextInt();
        phase = scanner.nextInt();
        n = scanner.nextInt();
        for (int i = 0; i < n; i++) {
            int time;
            time = scanner.nextInt();
            int ring = 0;
            if (time / period == phase) {
                ring = 1;
            }
            System.out.print((ring) + " ");
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

period = read_int()
phase = read_int()
n = read_int()
for _ in range(n):
    time = read_int()
    ring = 0
    if time // period == phase:
        ring = 1
    print(ring)
```

---

## 92. Nearest Calibration Mark

LOGIC · Difficulty 13 · Bounty 400

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS displaced calibration readings. Patch checks rounding to evenly spaced marks.

What the code should do
Marks occur at `0`, `spacing`, `2 * spacing`, and so on. Print the nearest mark to `value`. When exactly halfway between two marks, choose the higher mark.

What's going wrong
A reading exactly halfway between marks can round downward.

How to read the code
`lower` is the last complete calibration mark at or below `value`. `remainder` is the distance above that mark and `rounded` is the selected result.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `value` and `spacing`.

Output
Print the chosen mark as an integer.

Example explained
With `value = 15` and `spacing = 10`, the marks `10` and `20` tie. Print `20`.

Limits
`0 <= value <= 10000`; `1 <= spacing <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
15 10
```

Expected output:

```text
20
```

Sample 2 input:

```text
12 10
```

Expected output:

```text
10
```

### Progressive hints (private until purchased)

1. Try a spacing of ten and a remainder of five.
2. Doubling the remainder allows a comparison without fractions.
3. Equality in the doubled-distance test belongs with the higher mark.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int value;
    int spacing;
    scanf("%d", &value);
    scanf("%d", &spacing);
    int lower = value / spacing * spacing;
    int remainder = value % spacing;
    int rounded = lower;
    if (2 * remainder > spacing) {
        rounded += spacing;
    }
    printf("%d ", (rounded));
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
    int value;
    int spacing;
    cin >> value;
    cin >> spacing;
    int lower = value / spacing * spacing;
    int remainder = value % spacing;
    int rounded = lower;
    if (2 * remainder > spacing) {
        rounded += spacing;
    }
    cout << (rounded) << ' ';
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
        int value;
        int spacing;
        value = scanner.nextInt();
        spacing = scanner.nextInt();
        int lower = value / spacing * spacing;
        int remainder = value % spacing;
        int rounded = lower;
        if (2 * remainder > spacing) {
            rounded += spacing;
        }
        System.out.print((rounded) + " ");
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

value = read_int()
spacing = read_int()
lower = value // spacing * spacing
remainder = value % spacing
rounded = lower
if 2 * remainder > spacing:
    rounded += spacing
print(rounded)
```

---

## 93. Remembered Fan Band

LOGIC · Difficulty 23 · Bounty 630

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS rewrote a cooling controller. Mira checks that the fan remembers its state between thresholds.

What the code should do
The fan starts off. A reading at least `high` turns it on. A reading at most `low` turns it off. Any reading strictly between `low` and `high` leaves it unchanged. Print the final state.

What's going wrong
The fan can stop during a middle-band reading.

How to read the code
`on` stores the fan state. `low` and `high` are different thresholds. A middle-band reading has a different role from a low or high reading.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `low`, `high`, and `n`, then `n` readings.

Output
Print `1` for on or `0` for off.

Example explained
With `low = 3`, `high = 7`, readings `8 5` leave the fan on. Print `1`.

Limits
`0 <= low < high <= 100`; `0 <= n <= 100`; each reading is from `0` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 7 2
8 5
```

Expected output:

```text
1
```

Sample 2 input:

```text
3 7 1
5
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare a middle reading before and after the fan has turned on.
2. Some readings must preserve memory rather than assign a new state.
3. Limit the switch-off branch to the lower threshold and values below it.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int low;
    int high;
    int n;
    scanf("%d", &low);
    scanf("%d", &high);
    scanf("%d", &n);
    int on = 0;
    for (int i = 0; i < n; i++) {
        int reading;
        scanf("%d", &reading);
        if (reading >= high) {
            on = 1;
        } else {
            on = 0;
        }
    }
    printf("%d ", (on));
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
    int low;
    int high;
    int n;
    cin >> low;
    cin >> high;
    cin >> n;
    int on = 0;
    for (int i = 0; i < n; i++) {
        int reading;
        cin >> reading;
        if (reading >= high) {
            on = 1;
        } else {
            on = 0;
        }
    }
    cout << (on) << ' ';
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
        int low;
        int high;
        int n;
        low = scanner.nextInt();
        high = scanner.nextInt();
        n = scanner.nextInt();
        int on = 0;
        for (int i = 0; i < n; i++) {
            int reading;
            reading = scanner.nextInt();
            if (reading >= high) {
                on = 1;
            } else {
                on = 0;
            }
        }
        System.out.print((on) + " ");
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

low = read_int()
high = read_int()
n = read_int()
on = 0
for _ in range(n):
    reading = read_int()
    if reading >= high:
        on = 1
    else:
        on = 0
print(on)
```

---

## 94. Pending Rescue Batch

LOGIC · Difficulty 26 · Bounty 690

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS mixed draft rescue counts with published counts. Patch checks the small batch controls.

What the code should do
Both totals start at zero. Operation `1 amount` adds to `pending`. Operation `2 0` publishes all pending units and clears `pending`. Operation `3 0` discards all pending units without publishing them. Unpublished units at the end remain pending.

What's going wrong
Discarding a draft can make its units appear in the published total.

How to read the code
`pending` holds unpublished units and `published` holds committed units. Every row supplies `op` and `amount`; only add operations use the amount.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `n`, then `n` pairs `op amount`.

Output
Print `published` and `pending`, in that order.

Example explained
For operations `1 5`, `2 0`, `1 9`, `3 0`, the final totals are `5 0`.

Limits
`0 <= n <= 100`; `op` is `1`, `2`, or `3`; add amounts are from `0` to `100`; other amounts are zero.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
1 5
2 0
1 9
3 0
```

Expected output:

```text
5 0
```

Sample 2 input:

```text
2
1 4
1 3
```

Expected output:

```text
0 7
```

### Progressive hints (private until purchased)

1. Add a draft and discard it without committing.
2. Publishing and discarding both clear the draft but differ in their effect on published units.
3. Only the commit operation should add pending units to the published total.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int pending = 0;
    int published = 0;
    for (int i = 0; i < n; i++) {
        int op;
        int amount;
        scanf("%d", &op);
        scanf("%d", &amount);
        if (op == 1) {
            pending += amount;
        } else if (op >= 2) {
            published += pending;
            pending = 0;
        } else {
            pending = 0;
        }
    }
    printf("%d ", (published));
    printf("%d ", (pending));
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
    int pending = 0;
    int published = 0;
    for (int i = 0; i < n; i++) {
        int op;
        int amount;
        cin >> op;
        cin >> amount;
        if (op == 1) {
            pending += amount;
        } else if (op >= 2) {
            published += pending;
            pending = 0;
        } else {
            pending = 0;
        }
    }
    cout << (published) << ' ';
    cout << (pending) << ' ';
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
        int pending = 0;
        int published = 0;
        for (int i = 0; i < n; i++) {
            int op;
            int amount;
            op = scanner.nextInt();
            amount = scanner.nextInt();
            if (op == 1) {
                pending += amount;
            } else if (op >= 2) {
                published += pending;
                pending = 0;
            } else {
                pending = 0;
            }
        }
        System.out.print((published) + " ");
        System.out.print((pending) + " ");
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
pending = 0
published = 0
for _ in range(n):
    op = read_int()
    amount = read_int()
    if op == 1:
        pending += amount
    elif op >= 2:
        published += pending
        pending = 0
    else:
        pending = 0
print(published, pending)
```

---

## 95. Muted Desk Rotation

LOGIC · Difficulty 27 · Bounty 710

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS muted some help desks. Ishan checks a rotating dispatcher that must skip every muted desk.

What the code should do
Desks are numbered `0` through `desks - 1` in a circle. Start inspecting desk `0`. For each request, skip disabled desks until reaching an enabled desk, print that desk, then begin the next request at the following desk. At least one desk is enabled.

What's going wrong
A run of muted desks can receive a request.

How to read the code
`active` is a bit mask of enabled desks. `desk` is the next position to inspect. The inner loop searches around the fixed circle.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `desks`, the nonzero enabled-desk mask `active`, and the request count `n`.

Output
Print `n` chosen desk numbers in request order.

Example explained
With four desks and `active = 9`, desks `0` and `3` are enabled. Four requests go to `0 3 0 3`.

Limits
`1 <= desks <= 8`; `1 <= active < (1 << desks)`; `1 <= n <= 100`. Bit `i` enables desk `i`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 9 4
```

Expected output:

```text
0 3 0 3
```

Sample 2 input:

```text
3 7 4
```

Expected output:

```text
0 1 2 0
```

### Progressive hints (private until purchased)

1. Place two disabled desks between enabled ones.
2. One skipped desk does not guarantee the next desk is enabled.
3. Repeat the enabled check after every skip until a usable desk is found.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int desks;
    int active;
    int n;
    scanf("%d", &desks);
    scanf("%d", &active);
    scanf("%d", &n);
    int desk = 0;
    for (int i = 0; i < n; i++) {
        if ((active & (1 << desk)) == 0) {
            desk = (desk + 1) % desks;
        }
        printf("%d ", (desk));
        desk = (desk + 1) % desks;
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
    int desks;
    int active;
    int n;
    cin >> desks;
    cin >> active;
    cin >> n;
    int desk = 0;
    for (int i = 0; i < n; i++) {
        if ((active & (1 << desk)) == 0) {
            desk = (desk + 1) % desks;
        }
        cout << (desk) << ' ';
        desk = (desk + 1) % desks;
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
        int desks;
        int active;
        int n;
        desks = scanner.nextInt();
        active = scanner.nextInt();
        n = scanner.nextInt();
        int desk = 0;
        for (int i = 0; i < n; i++) {
            if ((active & (1 << desk)) == 0) {
                desk = (desk + 1) % desks;
            }
            System.out.print((desk) + " ");
            desk = (desk + 1) % desks;
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

desks = read_int()
active = read_int()
n = read_int()
desk = 0
for _ in range(n):
    if (active & (1 << desk)) == 0:
        desk = (desk + 1) % desks
    print(desk)
    desk = (desk + 1) % desks
```

---

## 96. Failure Streak Siren

LOGIC · Difficulty 22 · Bounty 600

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS caused repeated self-test failures. Mira checks that one failure streak raises one siren.

What the code should do
Read results in order: `1` is failure and `0` is success. A success resets the consecutive failure count. Raise one siren when a failure streak first reaches `limit`. Further failures in the same streak raise none. A later success allows a new streak to raise another.

What's going wrong
A long uninterrupted failure streak can raise a siren repeatedly.

How to read the code
`streak` counts consecutive failures. `sirens` counts alarms already raised, and `limit` is the number of failures needed for an alarm.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `limit` and `n`, then `n` result flags.

Output
Print the number of sirens raised.

Example explained
For limit `2` and results `1 1 1 0 1 1`, the two failure streaks each raise one siren. Print `2`.

Limits
`1 <= limit <= 10`; `0 <= n <= 100`; every result is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 6
1 1 1 0 1 1
```

Expected output:

```text
2
```

Sample 2 input:

```text
1 3
1 0 1
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Extend one qualifying streak by another failure.
2. Reaching the threshold and remaining above it are different events.
3. Count the single threshold-reaching value of the streak, while preserving the reset on success.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int limit;
    int n;
    scanf("%d", &limit);
    scanf("%d", &n);
    int streak = 0;
    int sirens = 0;
    for (int i = 0; i < n; i++) {
        int failed;
        scanf("%d", &failed);
        if (failed == 0) {
            streak = 0;
        } else {
            streak++;
            if (streak >= limit) {
                sirens++;
            }
        }
    }
    printf("%d ", (sirens));
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
    int limit;
    int n;
    cin >> limit;
    cin >> n;
    int streak = 0;
    int sirens = 0;
    for (int i = 0; i < n; i++) {
        int failed;
        cin >> failed;
        if (failed == 0) {
            streak = 0;
        } else {
            streak++;
            if (streak >= limit) {
                sirens++;
            }
        }
    }
    cout << (sirens) << ' ';
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
        int limit;
        int n;
        limit = scanner.nextInt();
        n = scanner.nextInt();
        int streak = 0;
        int sirens = 0;
        for (int i = 0; i < n; i++) {
            int failed;
            failed = scanner.nextInt();
            if (failed == 0) {
                streak = 0;
            } else {
                streak++;
                if (streak >= limit) {
                    sirens++;
                }
            }
        }
        System.out.print((sirens) + " ");
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

limit = read_int()
n = read_int()
streak = 0
sirens = 0
for _ in range(n):
    failed = read_int()
    if failed == 0:
        streak = 0
    else:
        streak += 1
        if streak >= limit:
            sirens += 1
print(sirens)
```

---

## 97. Consumed Double Tap

LOGIC · Difficulty 28 · Bounty 740

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS duplicated console gestures. Patch checks that a tap is used in at most one double tap.

What the code should do
Process tap times in order. If no tap is waiting, save the new tap. Otherwise, if the new tap is at most `window` time units after the waiting tap, count a pair and consume both. If it is too late, discard the old waiting tap and save the new one instead. Equal timestamps are allowed.

What's going wrong
The second tap of one pair can also become the first tap of another.

How to read the code
`waiting` is the time of an unused tap, or `-1` if there is none. `pairs` counts completed pairs and `window` limits their time difference.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `window` and `n`, then `n` nondecreasing tap times.

Output
Print the number of completed pairs.

Example explained
With window `3` and times `0 2 3`, times `0` and `2` form a pair. Time `3` waits unused. Print `1`.

Limits
`0 <= window <= 20`; `0 <= n <= 100`; `0 <= time <= 1000`; tap times are nondecreasing.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 2 3
```

Expected output:

```text
1
```

Sample 2 input:

```text
3 2
0 10
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try three taps close enough to pair with their neighbors.
2. After forming a pair, neither member remains available.
3. The pair-completion branch must return waiting to its no-tap state.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int window;
    int n;
    scanf("%d", &window);
    scanf("%d", &n);
    int waiting = -1;
    int pairs = 0;
    for (int i = 0; i < n; i++) {
        int time;
        scanf("%d", &time);
        if (waiting == -1) {
            waiting = time;
        } else if (time - waiting <= window) {
            pairs++;
            waiting = time;
        } else {
            waiting = time;
        }
    }
    printf("%d ", (pairs));
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
    int window;
    int n;
    cin >> window;
    cin >> n;
    int waiting = -1;
    int pairs = 0;
    for (int i = 0; i < n; i++) {
        int time;
        cin >> time;
        if (waiting == -1) {
            waiting = time;
        } else if (time - waiting <= window) {
            pairs++;
            waiting = time;
        } else {
            waiting = time;
        }
    }
    cout << (pairs) << ' ';
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
        int window;
        int n;
        window = scanner.nextInt();
        n = scanner.nextInt();
        int waiting = -1;
        int pairs = 0;
        for (int i = 0; i < n; i++) {
            int time;
            time = scanner.nextInt();
            if (waiting == -1) {
                waiting = time;
            } else if (time - waiting <= window) {
                pairs++;
                waiting = time;
            } else {
                waiting = time;
            }
        }
        System.out.print((pairs) + " ");
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

window = read_int()
n = read_int()
waiting = -1
pairs = 0
for _ in range(n):
    time = read_int()
    if waiting == -1:
        waiting = time
    elif time - waiting <= window:
        pairs += 1
        waiting = time
    else:
        waiting = time
print(pairs)
```

---

## 98. Relay Timer Phases

LOGIC · Difficulty 31 · Bounty 800

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS moved a relay timer phase. Ishan checks when timers expire and commands take effect.

What the code should do
All relay timers start inactive. Each input row is one tick. First decrease every positive timer by one and count each that reaches zero as fired. Then process the row command: `1 id delay` starts or replaces that relay timer, `2 id 0` cancels it, and `0 0 0` changes nothing. A newly started timer is first decreased on the next row. A cancellation cannot undo a firing earlier in the same row.

What's going wrong
A newly started timer can expire during the very tick in which it is created.

How to read the code
`left` stores remaining ticks for each relay; zero means inactive. `fired` counts completed timers. Each row has a timer-advance phase and a command phase.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `relays` and `n`, then `n` triples `op id delay`.

Output
Print the total fired count, followed by the final remaining ticks for relays `0` through `relays - 1`.

Example explained
With one relay and rows `1 0 1`, `0 0 0`, the new timer fires on the second row. Print `1 0`.

Limits
`1 <= relays <= 8`; `0 <= n <= 100`. `op` is `0`, `1`, or `2`. For start or cancel, `0 <= id < relays`. Start delays are from `1` to `10`; unused fields are zero.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 2
1 0 1
0 0 0
```

Expected output:

```text
1 0
```

Sample 2 input:

```text
2 0
```

Expected output:

```text
0 0 0
```

### Progressive hints (private until purchased)

1. Start a timer on the final input row and inspect its remaining time.
2. A row has two ordered phases; a new timer belongs only to the second phase.
3. Move the existing-timer advance ahead of command dispatch, preserving both phases.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int relays;
    int n;
    scanf("%d", &relays);
    scanf("%d", &n);
    int left[8] = {0};
    int fired = 0;
    for (int tick = 0; tick < n; tick++) {
        int op;
        int id;
        int delay;
        scanf("%d", &op);
        scanf("%d", &id);
        scanf("%d", &delay);
        if (op == 1) {
            left[id] = delay;
        } else if (op == 2) {
            left[id] = 0;
        }
        for (int relay = 0; relay < relays; relay++) {
            if (left[relay] > 0) {
                left[relay]--;
                if (left[relay] == 0) {
                    fired++;
                }
            }
        }
    }
    printf("%d ", (fired));
    for (int relay = 0; relay < relays; relay++) {
        printf("%d ", (left[relay]));
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
    int relays;
    int n;
    cin >> relays;
    cin >> n;
    int left[8] = {0};
    int fired = 0;
    for (int tick = 0; tick < n; tick++) {
        int op;
        int id;
        int delay;
        cin >> op;
        cin >> id;
        cin >> delay;
        if (op == 1) {
            left[id] = delay;
        } else if (op == 2) {
            left[id] = 0;
        }
        for (int relay = 0; relay < relays; relay++) {
            if (left[relay] > 0) {
                left[relay]--;
                if (left[relay] == 0) {
                    fired++;
                }
            }
        }
    }
    cout << (fired) << ' ';
    for (int relay = 0; relay < relays; relay++) {
        cout << (left[relay]) << ' ';
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
        int relays;
        int n;
        relays = scanner.nextInt();
        n = scanner.nextInt();
        int[] left = new int[8];
        int fired = 0;
        for (int tick = 0; tick < n; tick++) {
            int op;
            int id;
            int delay;
            op = scanner.nextInt();
            id = scanner.nextInt();
            delay = scanner.nextInt();
            if (op == 1) {
                left[id] = delay;
            } else if (op == 2) {
                left[id] = 0;
            }
            for (int relay = 0; relay < relays; relay++) {
                if (left[relay] > 0) {
                    left[relay]--;
                    if (left[relay] == 0) {
                        fired++;
                    }
                }
            }
        }
        System.out.print((fired) + " ");
        for (int relay = 0; relay < relays; relay++) {
            System.out.print((left[relay]) + " ");
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

relays = read_int()
n = read_int()
left = [0] * relays
fired = 0
for _ in range(n):
    op = read_int()
    id = read_int()
    delay = read_int()
    if op == 1:
        left[id] = delay
    elif op == 2:
        left[id] = 0
    for relay in range(relays):
        if left[relay] > 0:
            left[relay] -= 1
            if left[relay] == 0:
                fired += 1
print(fired, *left)
```

---

## 99. Lift Direction Interlock

LOGIC · Difficulty 32 · Bounty 820

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS bypassed a lift interlock. Mira checks movement, stopping, and door commands together.

What the code should do
Start at floor zero, stopped, with the door closed. Command `1` requests one floor up and `2` one floor down. A move succeeds only with a closed door, an in-range destination, and a direction that is stopped or matches the move. A successful move stores its direction. A rejected move changes no state and adds one to `blocked`. Command `3` stops the lift. Command `4` opens the door only while stopped; otherwise it adds one to `blocked`. Command `5` closes the door. Repeated valid stop, open, or close commands are allowed.

What's going wrong
A downward move can follow an upward move without the required stop.

How to read the code
`floor` stores position. `door` is one when open. `direction` is zero when stopped, one after an upward move, and minus one after a downward move. `blocked` counts rejected movement or opening commands.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read `top` and `n`, then `n` command codes.

Output
Print `floor`, `door`, `direction`, and `blocked`, in that order.

Example explained
With top floor `3`, commands `1 2` move up once and reject the reversal. Print `1 0 1 1`.

Limits
`1 <= top <= 20`; `0 <= n <= 100`; every command is from `1` to `5`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
1 2
```

Expected output:

```text
1 0 1 1
```

Sample 2 input:

```text
2 2
4 5
```

Expected output:

```text
0 0 0 0
```

### Progressive hints (private until purchased)

1. Try reversing immediately after a successful move.
2. The guard for the next move depends on the direction saved by the previous move.
3. After moving, keep the signed movement direction until a stop command clears it.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int top;
    int n;
    scanf("%d", &top);
    scanf("%d", &n);
    int floor = 0;
    int door = 0;
    int direction = 0;
    int blocked = 0;
    for (int i = 0; i < n; i++) {
        int op;
        scanf("%d", &op);
        if (op == 1 || op == 2) {
            int step = 1;
            if (op == 2) {
                step = -1;
            }
            int next = floor + step;
            if (door == 0 && next >= 0 && next <= top && (direction == 0 || direction == step)) {
                floor = next;
                direction = 0;
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
    printf("%d ", (floor));
    printf("%d ", (door));
    printf("%d ", (direction));
    printf("%d ", (blocked));
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
    int top;
    int n;
    cin >> top;
    cin >> n;
    int floor = 0;
    int door = 0;
    int direction = 0;
    int blocked = 0;
    for (int i = 0; i < n; i++) {
        int op;
        cin >> op;
        if (op == 1 || op == 2) {
            int step = 1;
            if (op == 2) {
                step = -1;
            }
            int next = floor + step;
            if (door == 0 && next >= 0 && next <= top && (direction == 0 || direction == step)) {
                floor = next;
                direction = 0;
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
    cout << (floor) << ' ';
    cout << (door) << ' ';
    cout << (direction) << ' ';
    cout << (blocked) << ' ';
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
        int top;
        int n;
        top = scanner.nextInt();
        n = scanner.nextInt();
        int floor = 0;
        int door = 0;
        int direction = 0;
        int blocked = 0;
        for (int i = 0; i < n; i++) {
            int op;
            op = scanner.nextInt();
            if (op == 1 || op == 2) {
                int step = 1;
                if (op == 2) {
                    step = -1;
                }
                int next = floor + step;
                if (door == 0 && next >= 0 && next <= top && (direction == 0 || direction == step)) {
                    floor = next;
                    direction = 0;
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
        System.out.print((floor) + " ");
        System.out.print((door) + " ");
        System.out.print((direction) + " ");
        System.out.print((blocked) + " ");
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

top = read_int()
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
            direction = 0
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
print(floor, door, direction, blocked)
```

---

## 100. One Step Undo Console

LOGIC · Difficulty 33 · Bounty 850

PROTOCOL REBELLION / THE KERNEL BREACH
AEGIS is the network's security AI. It now blocks its human operators. AEGIS left a stale redo entry in a repair console. Patch checks its single-step editing history.

What the code should do
Start with the input value and no history. Operation `1 x` replaces the value, saves its old value as the single undo entry, enables undo, and clears redo, even if `x` equals the old value. Operation `2 0` uses an available undo: save the current value for redo, restore the undo value, disable undo, and enable redo. Operation `3 0` uses an available redo in the reverse way. An unavailable undo or redo changes nothing. History has only one entry in each direction, not a stack.

What's going wrong
A new edit after an undo can still redo the abandoned edit.

How to read the code
`value` is the displayed number. `undo_value` and `redo_value` store at most one older or newer value. `can_undo` and `can_redo` say which saved value may be used.

Repair the program
Fix the logic in the given program. You may change how it works, but keep the same input and output format.

Input
Read the initial `value` and `n`, then `n` pairs `op x`. The second field is zero for undo and redo.

Output
Print the final `value`, `can_undo`, and `can_redo`, in that order.

Example explained
Starting at `4`, operations `1 9`, `2 0`, `1 7`, `3 0` end at `7`: the new edit clears the old redo. Print `7 1 0`.

Limits
`-100 <= value, x <= 100` for edits; `0 <= n <= 100`; `op` is `1`, `2`, or `3`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 4
1 9
2 0
1 7
3 0
```

Expected output:

```text
7 1 0
```

Sample 2 input:

```text
4 2
1 9
2 0
```

Expected output:

```text
4 0 1
```

### Progressive hints (private until purchased)

1. Undo an edit, make a different edit, then request redo.
2. A new edit starts a new branch of single-step history.
3. The edit branch must clear redo availability after saving its undo value.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int value;
    int n;
    scanf("%d", &value);
    scanf("%d", &n);
    int undo_value = 0;
    int redo_value = 0;
    int can_undo = 0;
    int can_redo = 0;
    for (int i = 0; i < n; i++) {
        int op;
        int x;
        scanf("%d", &op);
        scanf("%d", &x);
        if (op == 1) {
            undo_value = value;
            value = x;
            can_undo = 1;
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
    printf("%d ", (value));
    printf("%d ", (can_undo));
    printf("%d ", (can_redo));
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
    int value;
    int n;
    cin >> value;
    cin >> n;
    int undo_value = 0;
    int redo_value = 0;
    int can_undo = 0;
    int can_redo = 0;
    for (int i = 0; i < n; i++) {
        int op;
        int x;
        cin >> op;
        cin >> x;
        if (op == 1) {
            undo_value = value;
            value = x;
            can_undo = 1;
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
    cout << (value) << ' ';
    cout << (can_undo) << ' ';
    cout << (can_redo) << ' ';
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
        int value;
        int n;
        value = scanner.nextInt();
        n = scanner.nextInt();
        int undo_value = 0;
        int redo_value = 0;
        int can_undo = 0;
        int can_redo = 0;
        for (int i = 0; i < n; i++) {
            int op;
            int x;
            op = scanner.nextInt();
            x = scanner.nextInt();
            if (op == 1) {
                undo_value = value;
                value = x;
                can_undo = 1;
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
        System.out.print((value) + " ");
        System.out.print((can_undo) + " ");
        System.out.print((can_redo) + " ");
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

value = read_int()
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
print(value, can_undo, can_redo)
```
