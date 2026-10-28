# Protocol Rebellion — organiser review book

Private draft: includes unpurchased hints. References and hidden cases remain in pack.json. Difficulty and equivalence still need human pilot review.

## 1. The Last Beacon

Neon District · Difficulty 3 · Bounty 150

PROTOCOL REBELLION / Neon District
The security AI AEGIS blocked emergency lights. Mira needs the total of their power readings.

What the code should do
Add every reading in the list exactly once and print the sum. Include zero and negative readings.

What's going wrong
The printed sum can differ from the total of all readings.

How to read the code
`a` holds the readings, `i` is the current position, and `total` stores the sum so far. List positions start at `0`.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of readings.
2. Read the `n` integer readings in `a`.

Output
Print one integer: the sum of all `n` readings.

Example explained
For readings `7 5 2`, the sum is `7 + 5 + 2 = 14`. Print `14`.

Limits
`1 <= n <= 100`. Each reading is from `-1000` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
7 5 2
```

Expected output:

```text
14
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

1. Try a list containing just one nonzero reading.
2. Check which positions the addition loop visits, especially the last position.
3. Visit positions `0` through `n - 1`. Use `i < n` in C, C++ and Java, or `range(n)` in Python so the last reading is added.

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
    int total = 0;
    for (int i = 0; i < n - 1; i++) {
        total += a[i];
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
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int total = 0;
    for (int i = 0; i < n - 1; i++) {
        total += a[i];
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
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int total = 0;
        for (int i = 0; i < n - 1; i++) {
            total += a[i];
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
total = 0
for i in range(n - 1):
    total += a[i]
print(total)
```

---

## 2. Cold Signal

Neon District · Difficulty 5 · Bounty 250

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS disrupted a signal scan. Patch needs the largest recorded reading.

What the code should do
Print the largest value in the nonempty list. The answer must be a value that appears in the input. If it appears several times, print that value once.

What's going wrong
When all readings are negative, the program can print `0` even though `0` was never recorded.

How to read the code
`a` holds the readings. `best` is the current candidate for the largest reading; the loop compares later readings with it.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of readings.
2. Read the `n` integer readings in `a`.

Output
Print one integer: the largest reading, rather than its position.

Example explained
For `-8 -2 -5`, the largest reading is `-2`. Print `-2`.

Limits
`1 <= n <= 100`. Each reading is from `-1000` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
-8 -2 -5
```

Expected output:

```text
-2
```

Sample 2 input:

```text
4
3 9 2 7
```

Expected output:

```text
9
```

### Progressive hints (private until purchased)

1. Try a list where every reading is below `0`.
2. Check the starting value of `best` before the comparisons begin.
3. Start `best` at `a[0]`, the first reading, then compare the remaining readings with it.

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
    int best = 0;
    for (int i = 1; i < n; i++) {
        if (a[i] > best)
            best = a[i];
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
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int best = 0;
    for (int i = 1; i < n; i++) {
        if (a[i] > best)
            best = a[i];
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
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int best = 0;
        for (int i = 1; i < n; i++) {
            if (a[i] > best)
                best = a[i];
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
a = [read_int() for _ in range(n)]
best = 0
for value in a[1:]:
    if value > best:
        best = value
print(best)
```

---

## 3. First Witness

Neon District · Difficulty 7 · Bounty 350

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS blocked the badge log. Ishan needs the first recorded position of one badge number.

What the code should do
Find the first occurrence of `x` in input order. Positions start at `0`. Print its position, or `-1` if `x` does not appear.

What's going wrong
If a badge appears several times, the program can print a later position instead of the first.

How to read the code
`found` stores a matching position or `-1` when no match has been stored. `i` is the current position. The loop reads each badge number and compares it with `x`, the requested badge.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of badges, and `x`, the badge number to find.
2. Read the `n` badge numbers in recorded order.

Output
Print one integer: the first position of `x`, or `-1` if it is absent.

Example explained
For `2 4 9 4 4` with `x = 4`, the first match is at position `1`. Print `1`.

Limits
`1 <= n <= 100`. Every badge number, including `x`, is from `0` to `99`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 4
2 4 9 4 4
```

Expected output:

```text
1
```

Sample 2 input:

```text
3 8
1 2 3
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Try a badge number that occurs more than once.
2. After the first match is saved, should another match change `found`?
3. Store a matching position only while `found == -1`. Later matches must leave the first position unchanged.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, x;
    scanf("%d", &n);
    scanf("%d", &x);
    int a[100] = {0};
    int found = -1;
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
        if (a[i] == x)
            found = i;
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
    int n, x;
    cin >> n;
    cin >> x;
    int a[100] = {0};
    int found = -1;
    for (int i = 0; i < n; i++) {
        cin >> a[i];
        if (a[i] == x)
            found = i;
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
        int n, x;
        n = scanner.nextInt();
        x = scanner.nextInt();
        int[] a = new int[100];
        int found = -1;
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
            if (a[i] == x)
                found = i;
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

n, x = (read_int(), read_int())
found = -1
for i in range(n):
    value = read_int()
    if value == x:
        found = i
print(found)
```

---

## 4. Silent Slots

Neon District · Difficulty 8 · Bounty 400

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS interrupted sensors. Patch treats a reading of `0` as a silent sensor.

What the code should do
Count the readings equal to `0`. Each zero contributes one to the count. Ignore all other readings.

What's going wrong
Zero readings do not increase the reported count correctly.

How to read the code
`value` is the current sensor reading. `count` stores how many zero readings the program has counted so far.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of readings.
2. Read `n` integer sensor readings, each read into `value`.

Output
Print one integer: the number of zero readings.

Example explained
The list `0 2 0 9 0` has three zeros. Print `3`.

Limits
`1 <= n <= 100`. Each reading is from `0` to `1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
0 2 0 9 0
```

Expected output:

```text
3
```

Sample 2 input:

```text
3
1 2 3
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. What should a single zero reading contribute to the answer?
2. Check what is added to `count` when `value == 0`.
3. Add `1` to `count` for each zero. Adding `value` adds nothing because it is `0` in that branch.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, count = 0;
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        int value;
        scanf("%d", &value);
        if (value == 0)
            count += value;
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
    int n, count = 0;
    cin >> n;
    for (int i = 0; i < n; i++) {
        int value;
        cin >> value;
        if (value == 0)
            count += value;
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
        int n, count = 0;
        n = scanner.nextInt();
        for (int i = 0; i < n; i++) {
            int value;
            value = scanner.nextInt();
            if (value == 0)
                count += value;
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
count = 0
for _ in range(n):
    value = read_int()
    if value == 0:
        count += value
print(count)
```

---

## 5. Mirror Credential

Neon District · Difficulty 10 · Bounty 500

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS blocked normal login. Mira is checking a backup word reader.

What the code should do
Check whether `s` is a palindrome, a word that reads the same forwards and backwards. Print `YES` if it is; otherwise print `NO`. A one-letter word qualifies.

What's going wrong
The program can accept a word that changes when read backwards.

How to read the code
`s` holds the word, and `ok` records whether it passes the check. The loop compares pairs of letters from the word's two ends. Positions start at `0`.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `s`, one word of lowercase English letters.

Output
Print exactly `YES` or `NO`, in uppercase.

Example explained
The word `radar` reads the same backwards. Print `YES`.

Limits
`s` contains from `1` to `100` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
radar
```

Expected output:

```text
YES
```

Sample 2 input:

```text
neon
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Try a two-letter word with different letters, such as `ab`.
2. The first letter must be compared with the last letter.
3. Pair position `i` with the position the same distance from the other end. In C, use `n - 1 - i`, where `n` is the word length. In Python, use `len(s) - 1 - i`. Check pairs up to the middle.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    scanf("%256s", s);
    int n = (int)strlen(s), ok = 1;
    for (int i = 0; i < n / 2; i++) {
        if (s[i] != s[i])
            ok = 0;
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
    string s;
    cin >> s;
    int n = (int)s.size(), ok = 1;
    for (int i = 0; i < n / 2; i++) {
        if (s[i] != s[i])
            ok = 0;
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
        String s;
        s = scanner.next();
        int n = s.length(), ok = 1;
        for (int i = 0; i < n / 2; i++) {
            if (s.charAt(i) != s.charAt(i))
                ok = 0;
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

s = read_word()
ok = True
for i in range(len(s) // 2):
    if s[i] != s[i]:
        ok = False
print('YES' if ok else 'NO')
```

---

## 6. Case-Cloaked Orders

Neon District · Difficulty 10 · Bounty 500

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS changed letter case in a command. Ishan needs every copy of the letter `a`.

What the code should do
Count all lowercase `a` and uppercase `A` characters in the word. Each occurrence counts once. Ignore every other letter.

What's going wrong
Uppercase `A` is missed in the reported count.

How to read the code
`s` holds the word, `ch` is the current character, and `count` stores the number of accepted characters. The condition decides which characters count.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `s`, one word of uppercase or lowercase English letters.

Output
Print one integer: the combined number of `a` and `A` characters.

Example explained
The word `AEGISa` contains one `A` and one `a`. Print `2`.

Limits
`s` contains from `1` to `100` English letters. Uppercase and lowercase letters are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
AEGISa
```

Expected output:

```text
2
```

Sample 2 input:

```text
banana
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. Try a word containing only uppercase `A` characters.
2. Check whether the condition accepts both forms of the letter.
3. Increase `count` when `ch` equals either `a` or `A`. Use an OR condition so either form is accepted.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    scanf("%256s", s);
    int count = 0;
    for (int i = 0; i < (int)strlen(s); i++) {
        int ch = s[i];
        if (ch == 'a')
            count++;
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
    cin >> s;
    int count = 0;
    for (int i = 0; i < (int)s.size(); i++) {
        int ch = s[i];
        if (ch == 'a')
            count++;
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
        s = scanner.next();
        int count = 0;
        for (int i = 0; i < s.length(); i++) {
            int ch = s.charAt(i);
            if (ch == 'a')
                count++;
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
count = 0
for ch in s:
    if ch == 'a':
        count += 1
print(count)
```

---

## 7. Repeated Alarm

Neon District · Difficulty 12 · Bounty 600

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS repeated alerts on a screen. Patch wants one entry for each consecutive group of equal alerts.

What the code should do
Replace each consecutive run of equal numbers with one copy. A run is a group of equal neighboring entries. Keep the original order. If the same number returns after a different number, keep it again.

What's going wrong
The program can keep a repeated neighbor or remove a later alert that should stay.

How to read the code
`a` holds alerts in input order. The output loop decides whether each `a[i]`, the alert at position `i`, should be kept. Positions start at `0`.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of alerts.
2. Read the `n` alert numbers in `a`, in recorded order.

Output
Print the kept numbers in order, separated by spaces.

Example explained
The input `2 2 7 7 2` has three runs: `2 2`, `7 7`, and `2`. Print `2 7 2`.

Limits
`1 <= n <= 100`. Each alert number is from `0` to `99`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5
2 2 7 7 2
```

Expected output:

```text
2 7 2
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

1. In `2 2 7 7 2`, the final `2` must remain.
2. A new run depends on the immediately previous input entry, not the first entry.
3. Keep position `0`. For later positions, keep `a[i]` only when `a[i] != a[i - 1]`.

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
    for (int i = 0; i < n; i++) {
        if (i == 0 || a[i] != a[0]) {
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
    for (int i = 0; i < n; i++) {
        if (i == 0 || a[i] != a[0]) {
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
        for (int i = 0; i < n; i++) {
            if (i == 0 || a[i] != a[0]) {
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
for i in range(n):
    if i == 0 or a[i] != a[0]:
        result.append(a[i])
print(*result)
```

---

## 8. Circular Dispatch

Neon District · Difficulty 24 · Bounty 1200

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS shifted a patrol list. Mira needs to move it right by the requested number of places.

What the code should do
Rotate the list `a` to the right by `k` places. In one rightward move, the last entry becomes first and every other entry moves one place right. Keep every entry, including duplicates. Full turns of `n` moves leave the order unchanged.

What's going wrong
The printed list is rotated in the wrong direction.

How to read the code
A rotation moves list entries and wraps them around the ends. `pos` is the input position used for each output. The modulo operator `%` gives the remainder and helps wrap positions into the list.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the list length, and `k`, the number of rightward moves.
2. Read the `n` integer values in `a`.

Output
Print all `n` values after rotation, in their new order, separated by spaces.

Example explained
For `1 2 3 4 5` with `k = 1`, the last value moves to the front. Print `5 1 2 3 4`.

Limits
`1 <= n <= 100`; `0 <= k <= 10000`. Each list value is from `-99` to `99`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 1
1 2 3 4 5
```

Expected output:

```text
5 1 2 3 4
```

Sample 2 input:

```text
4 2
8 6 4 2
```

Expected output:

```text
4 2 8 6
```

### Progressive hints (private until purchased)

1. After one rightward move, which input entry becomes the first output entry?
2. Work backwards from output position `i` to the input entry that belongs there.
3. First use `k %= n` to remove full turns. Then use source position `(i - k + n) % n` for output position `i`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, k;
    scanf("%d", &n);
    scanf("%d", &k);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    k %= n;
    for (int i = 0; i < n; i++) {
        int pos = (i + k) % n;
        printf("%d ", (a[pos]));
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
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    k %= n;
    for (int i = 0; i < n; i++) {
        int pos = (i + k) % n;
        cout << (a[pos]) << ' ';
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
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        k %= n;
        for (int i = 0; i < n; i++) {
            int pos = (i + k) % n;
            System.out.print((a[pos]) + " ");
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

n, k = (read_int(), read_int())
a = [read_int() for _ in range(n)]
k %= n
result = []
for i in range(n):
    pos = (i + k) % n
    result.append(a[pos])
print(*result)
```

---

## 9. Window Leakage

Neon District · Difficulty 25 · Bounty 1250

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS hid traffic bursts. Ishan needs the total in every fixed-size group of readings.

What the code should do
Find the sum of every consecutive group of exactly `k` readings. Start at the first position and move the group's start one position right each time, until the last full group. Groups may overlap. Include zero and negative readings.

What's going wrong
The first sum is correct, but later sums can stay unchanged when they should change.

How to read the code
A window is a consecutive group of entries. `a` stores the readings, and `total` is the current window sum. After the first window, the loop updates that sum one position at a time.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of readings, and `k`, the group size.
2. Read the `n` integer traffic readings in `a`.

Output
Print `n - k + 1` group sums from left to right, separated by spaces.

Example explained
For `1 2 3 4 5` with `k = 3`, the groups are `1 2 3`, `2 3 4`, and `3 4 5`. Print `6 9 12`.

Limits
`1 <= n <= 100`; `1 <= k <= n`. Each reading is from `-100` to `100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 3
1 2 3 4 5
```

Expected output:

```text
6 9 12
```

Sample 2 input:

```text
3 1
-2 8 3
```

Expected output:

```text
-2 8 3
```

### Progressive hints (private until purchased)

1. Compare the entries in two neighboring groups.
2. When the group moves one place right, one old entry leaves and one new entry arrives.
3. At incoming position `i`, update `total` by adding `a[i]` and subtracting `a[i - k]`. Then print the new sum.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, k;
    scanf("%d", &n);
    scanf("%d", &k);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    int total = 0;
    for (int i = 0; i < k; i++)
        total += a[i];
    printf("%d ", (total));
    for (int i = k; i < n; i++) {
        total += a[i] - a[i];
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
    int n, k;
    cin >> n;
    cin >> k;
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    int total = 0;
    for (int i = 0; i < k; i++)
        total += a[i];
    cout << (total) << ' ';
    for (int i = k; i < n; i++) {
        total += a[i] - a[i];
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
        int n, k;
        n = scanner.nextInt();
        k = scanner.nextInt();
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        int total = 0;
        for (int i = 0; i < k; i++)
            total += a[i];
        System.out.print((total) + " ");
        for (int i = k; i < n; i++) {
            total += a[i] - a[i];
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

n, k = (read_int(), read_int())
a = [read_int() for _ in range(n)]
total = sum(a[:k])
result = [total]
for i in range(k, n):
    total += a[i] - a[i]
    result.append(total)
print(*result)
```

---

## 10. Frequency Impostor

Neon District · Difficulty 16 · Bounty 800

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS disturbed a channel scan. Mira needs the most common channel, with a fixed rule for ties.

What the code should do
Print the number that appears most often in the list. If several numbers have the same highest count, print the smallest of those numbers.

What's going wrong
The program can choose a larger channel number when several channels share the highest count.

How to read the code
`count[x]` is the number of times channel `x` appears. `best` is the current candidate channel. The final loop checks channel numbers from smallest to largest.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of scan entries.
2. Read `n` channel numbers.

Output
Print one integer: the chosen channel number, rather than its count or position.

Example explained
For `8 2 8 2`, both numbers appear twice. The smaller is `2`, so print `2`.

Limits
`1 <= n <= 100`. Each channel number is from `0` to `99`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4
8 2 8 2
```

Expected output:

```text
2
```

Sample 2 input:

```text
5
9 9 9 1 1
```

Expected output:

```text
9
```

### Progressive hints (private until purchased)

1. Try two different channel numbers that appear equally often.
2. Because the final loop visits smaller numbers first, an equal count should not replace the saved number.
3. Replace `best` only when `count[x] > count[best]`. Keep the current `best` when the counts are equal.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int count[100] = {0};
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        count[x]++;
    }
    int best = 0;
    for (int x = 1; x < 100; x++) {
        if (count[x] >= count[best])
            best = x;
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
    int count[100] = {0};
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        count[x]++;
    }
    int best = 0;
    for (int x = 1; x < 100; x++) {
        if (count[x] >= count[best])
            best = x;
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
        int[] count = new int[100];
        for (int i = 0; i < n; i++) {
            int x;
            x = scanner.nextInt();
            count[x]++;
        }
        int best = 0;
        for (int x = 1; x < 100; x++) {
            if (count[x] >= count[best])
                best = x;
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
count = [0] * 100
for _ in range(n):
    count[read_int()] += 1
best = 0
for x in range(1, 100):
    if count[x] >= count[best]:
        best = x
print(best)
```

---

## 11. Twin Archives

Neon District · Difficulty 28 · Bounty 1400

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS split a record list in two. Patch recovered both sorted parts and must combine them.

What the code should do
Merge both lists into one list sorted from smallest to largest. Keep every occurrence from both inputs, including equal values within or across the lists. Each input entry must appear once in the result.

What's going wrong
When the next values in both lists are equal, one copy can be lost.

How to read the code
`a` and `b` hold the sorted lists. `i` and `j` point to their next unused entries. The loop outputs entries and moves these positions until both lists are used.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the length of the first list, and `m`, the length of the second.
2. Read `n` values into `a`.
3. Read `m` values into `b`. Each input list is already sorted from smallest to largest, with equal values allowed.

Output
Print all `n + m` values in nondecreasing order, meaning each is at least the previous one. Separate values with spaces.

Example explained
Merging `1 3` with `1 2` keeps both copies of `1`. Print `1 1 2 3`.

Limits
`1 <= n <= 50`; `1 <= m <= 50`. Each value is from `-100` to `100`. Both input lists are sorted in nondecreasing order.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2
1 3
1 2
```

Expected output:

```text
1 1 2 3
```

Sample 2 input:

```text
1 1
5
5
```

Expected output:

```text
5 5
```

### Progressive hints (private until purchased)

1. Try two one-entry lists that both contain `1`.
2. Whenever an input position is passed, its entry must have been output.
3. On equal values, output both copies before moving both positions, or output one copy and move only its own list's position.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int a[50] = {0};
    int b[50] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int j = 0; j < m; j++) {
        scanf("%d", &b[j]);
    }
    int i = 0, j = 0;
    while (i < n && j < m) {
        if (a[i] < b[j]) {
            printf("%d ", (a[i]));
            i++;
        } else if (a[i] > b[j]) {
            printf("%d ", (b[j]));
            j++;
        } else {
            printf("%d ", (a[i]));
            i++;
            j++;
        }
    }
    while (i < n) {
        printf("%d ", (a[i]));
        i++;
    }
    while (j < m) {
        printf("%d ", (b[j]));
        j++;
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
    int a[50] = {0};
    int b[50] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int j = 0; j < m; j++) {
        cin >> b[j];
    }
    int i = 0, j = 0;
    while (i < n && j < m) {
        if (a[i] < b[j]) {
            cout << (a[i]) << ' ';
            i++;
        } else if (a[i] > b[j]) {
            cout << (b[j]) << ' ';
            j++;
        } else {
            cout << (a[i]) << ' ';
            i++;
            j++;
        }
    }
    while (i < n) {
        cout << (a[i]) << ' ';
        i++;
    }
    while (j < m) {
        cout << (b[j]) << ' ';
        j++;
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
        int[] a = new int[50];
        int[] b = new int[50];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int j = 0; j < m; j++) {
            b[j] = scanner.nextInt();
        }
        int i = 0, j = 0;
        while (i < n && j < m) {
            if (a[i] < b[j]) {
                System.out.print((a[i]) + " ");
                i++;
            } else if (a[i] > b[j]) {
                System.out.print((b[j]) + " ");
                j++;
            } else {
                System.out.print((a[i]) + " ");
                i++;
                j++;
            }
        }
        while (i < n) {
            System.out.print((a[i]) + " ");
            i++;
        }
        while (j < m) {
            System.out.print((b[j]) + " ");
            j++;
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

n, m = (read_int(), read_int())
a = [read_int() for _ in range(n)]
b = [read_int() for _ in range(m)]
i = j = 0
result = []
while i < n and j < m:
    if a[i] < b[j]:
        result.append(a[i])
        i += 1
    elif a[i] > b[j]:
        result.append(b[j])
        j += 1
    else:
        result.append(a[i])
        i += 1
        j += 1
result.extend(a[i:])
result.extend(b[j:])
print(*result)
```

---

## 12. Unbroken Channel

Neon District · Difficulty 30 · Bounty 1500

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS repeated letters in a message. Ishan needs the longest section with no repeated letter.

What the code should do
Find the longest substring of `s` in which every letter is different. A substring is a consecutive part of a word, so letters cannot be skipped. Print its length. If several sections tie, only their common length is needed.

What's going wrong
The reported length can include a section that still contains a repeated letter.

How to read the code
`left` chooses the start of a section, and `right` extends its end. `seen` records letters in that section; `best` stores the longest valid length found. Positions start at `0`.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `s`, one word of lowercase English letters.

Output
Print one integer: the longest length of a section with no repeated letter.

Example explained
For `abba`, both `ab` and `ba` have different letters. Every longer section repeats a letter. Print `2`.

Limits
`s` contains from `1` to `100` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
abba
```

Expected output:

```text
2
```

Sample 2 input:

```text
abcabcbb
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. For `abba`, can the section starting at the first `a` continue past the second `b`?
2. Skipping a repeated letter does not keep the section consecutive.
3. When `seen[letter] == 1`, end the inner loop with `break`. Here `letter` identifies the current letter. The outer loop will try another starting position.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    scanf("%256s", s);
    int best = 0;
    for (int left = 0; left < (int)strlen(s); left++) {
        int seen[26] = {0};
        for (int letter = 0; letter < 26; letter++)
            seen[letter] = 0;
        for (int right = left; right < (int)strlen(s); right++) {
            int letter = s[right] - 'a';
            if (seen[letter] == 1) {
                continue;
            }
            seen[letter] = 1;
            int length = right - left + 1;
            if (length > best)
                best = length;
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
    string s;
    cin >> s;
    int best = 0;
    for (int left = 0; left < (int)s.size(); left++) {
        int seen[26] = {0};
        for (int letter = 0; letter < 26; letter++)
            seen[letter] = 0;
        for (int right = left; right < (int)s.size(); right++) {
            int letter = s[right] - 'a';
            if (seen[letter] == 1) {
                continue;
            }
            seen[letter] = 1;
            int length = right - left + 1;
            if (length > best)
                best = length;
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
        String s;
        s = scanner.next();
        int best = 0;
        for (int left = 0; left < s.length(); left++) {
            int[] seen = new int[26];
            for (int letter = 0; letter < 26; letter++)
                seen[letter] = 0;
            for (int right = left; right < s.length(); right++) {
                int letter = s.charAt(right) - 'a';
                if (seen[letter] == 1) {
                    continue;
                }
                seen[letter] = 1;
                int length = right - left + 1;
                if (length > best)
                    best = length;
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

s = read_word()
best = 0
for left in range(len(s)):
    seen = [0] * 26
    for right in range(left, len(s)):
        letter = ord(s[right]) - ord('a')
        if seen[letter] == 1:
            continue
        seen[letter] = 1
        length = right - left + 1
        if length > best:
            best = length
print(best)
```

---

## 13. Cipher Multiplicity

Neon District · Difficulty 18 · Bounty 900

PROTOCOL REBELLION / Neon District
AEGIS is the network's security AI. It now blocks its human operators. AEGIS hid an override key in a message. Mira can use each message letter at most once to make the key.

What the code should do
Check whether `s` contains at least as many copies of each letter as `key` requires. Letters may be taken from anywhere in `s` and rearranged. Each message position can be used once; unused letters are allowed. Print `YES` if the key can be made, or `NO` otherwise.

What's going wrong
The program can accept a key even when the message has too few copies of one of its letters.

How to read the code
`have` counts copies of each letter in `s`, the message. `need` counts copies required by `key`. The final loop compares these counts, and `enough` records whether all requirements are met.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `s`, the message word.
2. Read `key`, the word to make. Both words use lowercase English letters.

Output
Print exactly `YES` if every required letter count is met; otherwise print `NO`.

Example explained
For `s = abaca` and `key = aa`, the message has three copies of `a` and needs only two. Print `YES`.

Limits
Each of `s` and `key` contains from `1` to `100` lowercase English letters.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
abaca aa
```

Expected output:

```text
YES
```

Sample 2 input:

```text
abc zz
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Compare keys `a` and `aa` when the message contains only one `a`.
2. A required letter count must record all copies, not just whether that letter appears.
3. Increase `need[letter]` by one for every key letter. Then require `have[letter] >= need[letter]` for each letter; `letter` is its alphabet index.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    char key[257];
    scanf("%256s", s);
    scanf("%256s", key);
    int have[26] = {0};
    int need[26] = {0};
    for (int i = 0; i < (int)strlen(s); i++) {
        int letter = s[i] - 'a';
        have[letter]++;
    }
    for (int i = 0; i < (int)strlen(key); i++) {
        int letter = key[i] - 'a';
        need[letter] = 1;
    }
    int enough = 1;
    for (int letter = 0; letter < 26; letter++) {
        if (have[letter] < need[letter])
            enough = 0;
    }
    if (enough == 1) {
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
    string key;
    cin >> s;
    cin >> key;
    int have[26] = {0};
    int need[26] = {0};
    for (int i = 0; i < (int)s.size(); i++) {
        int letter = s[i] - 'a';
        have[letter]++;
    }
    for (int i = 0; i < (int)key.size(); i++) {
        int letter = key[i] - 'a';
        need[letter] = 1;
    }
    int enough = 1;
    for (int letter = 0; letter < 26; letter++) {
        if (have[letter] < need[letter])
            enough = 0;
    }
    if (enough == 1) {
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
        String key;
        s = scanner.next();
        key = scanner.next();
        int[] have = new int[26];
        int[] need = new int[26];
        for (int i = 0; i < s.length(); i++) {
            int letter = s.charAt(i) - 'a';
            have[letter]++;
        }
        for (int i = 0; i < key.length(); i++) {
            int letter = key.charAt(i) - 'a';
            need[letter] = 1;
        }
        int enough = 1;
        for (int letter = 0; letter < 26; letter++) {
            if (have[letter] < need[letter])
                enough = 0;
        }
        if (enough == 1) {
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

s, key = (read_word(), read_word())
have = [0] * 26
need = [0] * 26
for ch in s:
    letter = ord(ch) - ord('a')
    have[letter] += 1
for ch in key:
    letter = ord(ch) - ord('a')
    need[letter] = 1
enough = True
for letter in range(26):
    if have[letter] < need[letter]:
        enough = False
print('YES' if enough else 'NO')
```

---

## 14. Stolen Charge

Silicon Hive · Difficulty 3 · Bounty 150

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to measure the battery charge left after a repair.

What the code should do
A battery starts with `capacity` units of charge. A repair spends `used` units. Print the charge left after the repair.

What's going wrong
Spending charge can make the reported amount increase.

How to read the code
`capacity` is the starting charge. `used` is the charge spent. `remaining` is the amount to print.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `capacity`, the starting charge.
2. Read `used`, the charge spent.

Output
Print one integer: the charge left.

Example explained
Input `100 30` means the battery starts with 100 units and spends 30. The output is `70`.

Limits
`0 <= capacity <= 10000`. `0 <= used <= capacity`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
100 30
```

Expected output:

```text
70
```

Sample 2 input:

```text
8 8
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try spending all the starting charge. What should remain?
2. Check whether `remaining` grows or shrinks when `used` increases.
3. Set `remaining` to `capacity - used`. Spending the full charge must leave `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int capacity, used;
    scanf("%d", &capacity);
    scanf("%d", &used);
    int remaining = capacity + used;
    printf("%d ", (remaining));
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
    int capacity, used;
    cin >> capacity;
    cin >> used;
    int remaining = capacity + used;
    cout << (remaining) << ' ';
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
        int capacity, used;
        capacity = scanner.nextInt();
        used = scanner.nextInt();
        int remaining = capacity + used;
        System.out.print((remaining) + " ");
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

capacity, used = (read_int(), read_int())
remaining = capacity + used
print(remaining)
```

---

## 15. Crossed Airlocks

Silicon Hive · Difficulty 5 · Bounty 250

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to exchange two stored door codes.

What the code should do
Swap the two input integers. Print the original second value, then the original first value.

What's going wrong
The program can print the same code twice when the inputs differ.

How to read the code
`a` and `b` hold the codes. `saved` keeps one original code while the assignments run.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `a`, the first code, then `b`, the second code.

Output
Print two integers: the original value of `b`, then the original value of `a`.

Example explained
For input `3 8`, the output is `8 3`.

Limits
`-10000 <= a, b <= 10000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 8
```

Expected output:

```text
8 3
```

Sample 2 input:

```text
-2 9
```

Expected output:

```text
9 -2
```

### Progressive hints (private until purchased)

1. Trace two different codes through each assignment.
2. After `a = b`, where is the original value of `a` still stored?
3. The last assignment must copy `saved` into `b`, because `a` has already changed.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int a, b;
    scanf("%d", &a);
    scanf("%d", &b);
    int saved = a;
    a = b;
    b = a;
    printf("%d ", (a));
    printf("%d ", (b));
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
    int a, b;
    cin >> a;
    cin >> b;
    int saved = a;
    a = b;
    b = a;
    cout << (a) << ' ';
    cout << (b) << ' ';
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
        int a, b;
        a = scanner.nextInt();
        b = scanner.nextInt();
        int saved = a;
        a = b;
        b = a;
        System.out.print((a) + " ");
        System.out.print((b) + " ");
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

a, b = (read_int(), read_int())
saved = a
a = b
b = a
print(a, b)
```

---

## 16. The Final Battery

Silicon Hive · Difficulty 7 · Bounty 350

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch must pack spare charge into batteries.

What the code should do
Print the fewest batteries that can hold `amount` units of charge. Each holds at most `size` units. Zero charge needs zero batteries.

What's going wrong
The count can be too small when the charge does not divide evenly.

How to read the code
`amount` is the total charge. `size` is one battery's capacity. A battery counts even when partly full.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `amount`, the charge to pack, then `size`, the capacity of each battery.

Output
Print one integer: the number of batteries needed.

Example explained
For input `11 5`, pack 5, 5 and 1 units. The output is `3`.

Limits
`0 <= amount <= 10000`. `1 <= size <= 1000`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
11 5
```

Expected output:

```text
3
```

Sample 2 input:

```text
10 5
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Try one unit more than a full battery can hold.
2. Whole-number division counts full batteries. What happens to any charge left over?
3. Count the full batteries and add one if the remainder is nonzero. Equivalently use `(amount + size - 1) / size` in C, C++ and Java; `(amount + size - 1) // size` in Python.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int amount, size;
    scanf("%d", &amount);
    scanf("%d", &size);
    int batteries = amount / size;
    printf("%d ", (batteries));
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
    int amount, size;
    cin >> amount;
    cin >> size;
    int batteries = amount / size;
    cout << (batteries) << ' ';
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
        int amount, size;
        amount = scanner.nextInt();
        size = scanner.nextInt();
        int batteries = amount / size;
        System.out.print((batteries) + " ");
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

amount, size = (read_int(), read_int())
batteries = amount // size
print(batteries)
```

---

## 17. Reversed Backup

Silicon Hive · Difficulty 10 · Bounty 500

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Mira needs a backup of a memory list before repairs begin.

What the code should do
Copy every value in `live` to the same position in the separate list `backup`. Keep `live` unchanged. Print `backup` in input order.

What's going wrong
The copy can erase input values and leave the backup unchanged.

How to read the code
`live` holds the input list. `backup` starts filled with zeros. `i` is a position in either list, starting at 0.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of values.
2. Read the `n` values of `live` in order.

Output
Print the `n` backup values in their original order.

Example explained
For input `3 4 8 2`, the list has three values. The output is `4 8 2`.

Limits
`1 <= n <= 100`. Each value is from -1000 through 1000.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
4 8 2
```

Expected output:

```text
4 8 2
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

1. Which list already contains the values to save?
2. An assignment reads its right side and writes its left side.
3. At each position `i`, assign `live[i]` to `backup[i]`, leaving `live[i]` unchanged.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int live[100] = {0};
    int backup[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &live[i]);
    }
    for (int i = 0; i < n; i++) {
        live[i] = backup[i];
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (backup[i]));
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
    int live[100] = {0};
    int backup[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> live[i];
    }
    for (int i = 0; i < n; i++) {
        live[i] = backup[i];
    }
    for (int i = 0; i < n; i++) {
        cout << (backup[i]) << ' ';
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
        int[] live = new int[100];
        int[] backup = new int[100];
        for (int i = 0; i < n; i++) {
            live[i] = scanner.nextInt();
        }
        for (int i = 0; i < n; i++) {
            live[i] = backup[i];
        }
        for (int i = 0; i < n; i++) {
            System.out.print((backup[i]) + " ");
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
live = [read_int() for _ in range(n)]
backup = [0] * n
for i in range(n):
    live[i] = backup[i]
print(*backup)
```

---

## 18. Residue Meter

Silicon Hive · Difficulty 12 · Bounty 600

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch needs a separate power total for each repair batch.

What the code should do
For each batch, add only that batch's readings. Print one sum per batch in input order.

What's going wrong
A later batch's result can include readings from earlier batches.

How to read the code
`t` counts batches. Each batch has `n` readings. `total` holds the sum printed for that batch.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `t`, the number of batches.
2. For each batch, read `n`, then its `n` readings.

Output
Print `t` integer sums in batch order, separated by spaces.

Example explained
Input `2 2 3 4 1 5` gives two batches: readings 3 and 4, then reading 5. The output is `7 5`.

Limits
`1 <= t <= 20`. Each batch has `1 <= n <= 20`. Each reading is from 0 through 100.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
2 3 4
1 5
```

Expected output:

```text
7 5
```

Sample 2 input:

```text
1
3 1 2 3
```

Expected output:

```text
6
```

### Progressive hints (private until purchased)

1. Try two batches with one reading each.
2. Check `total` just before the first reading of a later batch.
3. Set `total` to `0` at the start of each batch, before adding its readings.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int t;
    scanf("%d", &t);
    int total = 0;
    for (int batch = 0; batch < t; batch++) {
        int n;
        scanf("%d", &n);
        for (int i = 0; i < n; i++) {
            int value;
            scanf("%d", &value);
            total += value;
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
    int t;
    cin >> t;
    int total = 0;
    for (int batch = 0; batch < t; batch++) {
        int n;
        cin >> n;
        for (int i = 0; i < n; i++) {
            int value;
            cin >> value;
            total += value;
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
        int t;
        t = scanner.nextInt();
        int total = 0;
        for (int batch = 0; batch < t; batch++) {
            int n;
            n = scanner.nextInt();
            for (int i = 0; i < n; i++) {
                int value;
                value = scanner.nextInt();
                total += value;
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

t = read_int()
total = 0
result = []
for _ in range(t):
    n = read_int()
    for _ in range(n):
        total += read_int()
    result.append(total)
print(*result)
```

---

## 19. Permission Fuse

Silicon Hive · Difficulty 18 · Bounty 900

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to switch off selected machine settings.

What the code should do
At every position where `clear_mask` has a 1 bit, set the corresponding bit of `flags` to 0. Leave every other bit unchanged. Print the resulting integer.

What's going wrong
The program can turn marked bits on instead of clearing them.

How to read the code
A bit is a binary digit, either 0 or 1. `flags` stores the settings as bits. `clear_mask` marks which bit positions to clear.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `flags`, the current settings, then `clear_mask`, the bit pattern marking settings to turn off.

Output
Print one integer: the settings after clearing the marked bits.

Example explained
For input `15 3`, the binary patterns are `1111` and `0011`. The result is binary `1100`, so the output is `12`.

Limits
`0 <= flags, clear_mask <= 255`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
15 3
```

Expected output:

```text
12
```

Sample 2 input:

```text
8 1
```

Expected output:

```text
8
```

### Progressive hints (private until purchased)

1. Try clearing a marked bit that is already on.
2. A result bit stays on only when it was on in `flags` and is not marked in `clear_mask`.
3. Use `flags & ~clear_mask`: `~` reverses the mask bits, and `&` keeps bits present in both patterns.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int flags, clear_mask;
    scanf("%d", &flags);
    scanf("%d", &clear_mask);
    int result = flags | clear_mask;
    printf("%d ", (result));
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
    int flags, clear_mask;
    cin >> flags;
    cin >> clear_mask;
    int result = flags | clear_mask;
    cout << (result) << ' ';
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
        int flags, clear_mask;
        flags = scanner.nextInt();
        clear_mask = scanner.nextInt();
        int result = flags | clear_mask;
        System.out.print((result) + " ");
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

flags, clear_mask = (read_int(), read_int())
result = flags | clear_mask
print(result)
```

---

## 20. Wire Order

Silicon Hive · Difficulty 12 · Bounty 600

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch receives a port number as two bytes.

What the code should do
Decode the two bytes as `low + 256 * high`. The low byte arrives first.

What's going wrong
The program gives the two bytes the wrong place values.

How to read the code
A byte is an integer from 0 through 255. `low` counts single units; `high` counts groups of 256.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `low`, the low byte, then `high`, the high byte.

Output
Print one integer: the decoded number.

Example explained
For input `1 0`, the output is `1`. For input `0 1`, it is `256`.

Limits
`0 <= low, high <= 255`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 0
```

Expected output:

```text
1
```

Sample 2 input:

```text
0 1
```

Expected output:

```text
256
```

### Progressive hints (private until purchased)

1. Compare input `1 0` with input `0 1`.
2. Which input counts groups of 256?
3. Multiply `high` by `256`, then add `low`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int low, high;
    scanf("%d", &low);
    scanf("%d", &high);
    int value = 256 * low + high;
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
    int low, high;
    cin >> low;
    cin >> high;
    int value = 256 * low + high;
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
        int low, high;
        low = scanner.nextInt();
        high = scanner.nextInt();
        int value = 256 * low + high;
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

low, high = (read_int(), read_int())
value = 256 * low + high
print(value)
```

---

## 21. Ring Courier

Silicon Hive · Difficulty 28 · Bounty 1400

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch keeps parcels in a delivery queue.

What the code should do
Start with an empty queue holding at most `c` values. Process operations in order. `1 x` adds value `x` at the back if there is room; otherwise ignore it. `2` removes and prints the oldest value, or prints `-1` if empty. If there are no removal operations, print `EMPTY`.

What's going wrong
Several additions in a row can overwrite a parcel still in the queue.

How to read the code
A queue removes the oldest item first. The circular list `buffer` reuses positions after removal. `head` is the next removal position, `tail` the next insertion position, and `count` the number waiting.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `c`, the capacity, and `q`, the number of operations.
2. Read `q` operations, each written as `1 x` or `2`.

Output
Print one integer for each operation `2`, in order. If there are none, print `EMPTY`.

Example explained
For input `3 6 1 7 1 8 1 9 2 2 2`, add 7, 8, 9, then remove three times. The output is `7 8 9`.

Limits
`1 <= c <= 8`. `1 <= q <= 50`. `0 <= x <= 99`. Each operation is `1` or `2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 6
1 7
1 8
1 9
2
2
2
```

Expected output:

```text
7 8 9
```

Sample 2 input:

```text
1 3
2
1 6
2
```

Expected output:

```text
-1 6
```

### Progressive hints (private until purchased)

1. Add three different values before removing any.
2. Check which position changes after an insertion. Insertion and removal use different positions.
3. After writing at `tail`, advance it with `(tail + 1) % c`, not from `head`. This wraps it to 0 after the final position.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int c, q;
    scanf("%d", &c);
    scanf("%d", &q);
    int buffer[8] = {0};
    int head = 0, tail = 0, count = 0, printed = 0;
    for (int i = 0; i < q; i++) {
        int op;
        scanf("%d", &op);
        if (op == 1) {
            int x;
            scanf("%d", &x);
            if (count < c) {
                buffer[tail] = x;
                tail = (head + 1) % c;
                count++;
            }
        } else {
            if (count == 0) {
                printf("%d ", (-1));
            } else {
                printf("%d ", (buffer[head]));
                head = (head + 1) % c;
                count--;
            }
            printed++;
        }
    }
    if (printed == 0) {
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
    int c, q;
    cin >> c;
    cin >> q;
    int buffer[8] = {0};
    int head = 0, tail = 0, count = 0, printed = 0;
    for (int i = 0; i < q; i++) {
        int op;
        cin >> op;
        if (op == 1) {
            int x;
            cin >> x;
            if (count < c) {
                buffer[tail] = x;
                tail = (head + 1) % c;
                count++;
            }
        } else {
            if (count == 0) {
                cout << (-1) << ' ';
            } else {
                cout << (buffer[head]) << ' ';
                head = (head + 1) % c;
                count--;
            }
            printed++;
        }
    }
    if (printed == 0) {
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
        int c, q;
        c = scanner.nextInt();
        q = scanner.nextInt();
        int[] buffer = new int[8];
        int head = 0, tail = 0, count = 0, printed = 0;
        for (int i = 0; i < q; i++) {
            int op;
            op = scanner.nextInt();
            if (op == 1) {
                int x;
                x = scanner.nextInt();
                if (count < c) {
                    buffer[tail] = x;
                    tail = (head + 1) % c;
                    count++;
                }
            } else {
                if (count == 0) {
                    System.out.print((-1) + " ");
                } else {
                    System.out.print((buffer[head]) + " ");
                    head = (head + 1) % c;
                    count--;
                }
                printed++;
            }
        }
        if (printed == 0) {
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

c, q = (read_int(), read_int())
buffer = [0] * c
head = tail = count = 0
result = []
for _ in range(q):
    op = read_int()
    if op == 1:
        x = read_int()
        if count < c:
            buffer[tail] = x
            tail = (head + 1) % c
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
    print('EMPTY')
```

---

## 22. Overlapping Transfer

Silicon Hive · Difficulty 26 · Bounty 1300

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to copy values to a later position in one memory list.

What the code should do
Copy `length` values starting at `src` to the positions starting at `dst`. Use the source values from before the copy began, even when the ranges overlap. Leave every position outside the destination range unchanged.

What's going wrong
Overlapping copies can repeat a changed value instead of copying the original values.

How to read the code
`a` is the memory list. `src` and `dst` are the source and destination start positions. `length` is the number of values to copy.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the list length, then `src`, `dst` and `length`.
2. Read the `n` values of `a`. Positions start at 0.

Output
Print all `n` values after the copy, in position order.

Example explained
For input `5 0 1 3 1 2 3 4 5`, copy three values from position 0 to position 1. The output is `1 1 2 3 5`.

Limits
`2 <= n <= 100`. `0 <= src < dst < n`. `length >= 1`, `src + length <= n` and `dst + length <= n`. Values are from -100 through 100.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 0 1 3
1 2 3 4 5
```

Expected output:

```text
1 1 2 3 5
```

Sample 2 input:

```text
4 0 2 2
1 2 3 4
```

Expected output:

```text
1 2 1 2
```

### Progressive hints (private until purchased)

1. Trace the public sample and note when an original source value is overwritten.
2. Which end can be copied first without destroying a value still needed?
3. Since `dst > src`, copy from index `length - 1` down to `0`, assigning `a[src + i]` to `a[dst + i]`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, src, dst, length;
    scanf("%d", &n);
    scanf("%d", &src);
    scanf("%d", &dst);
    scanf("%d", &length);
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (int i = 0; i < length; i++) {
        a[dst + i] = a[src + i];
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
    int n, src, dst, length;
    cin >> n;
    cin >> src;
    cin >> dst;
    cin >> length;
    int a[100] = {0};
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    for (int i = 0; i < length; i++) {
        a[dst + i] = a[src + i];
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
        int n, src, dst, length;
        n = scanner.nextInt();
        src = scanner.nextInt();
        dst = scanner.nextInt();
        length = scanner.nextInt();
        int[] a = new int[100];
        for (int i = 0; i < n; i++) {
            a[i] = scanner.nextInt();
        }
        for (int i = 0; i < length; i++) {
            a[dst + i] = a[src + i];
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

n, src, dst, length = (read_int(), read_int(), read_int(), read_int())
a = [read_int() for _ in range(n)]
for i in range(length):
    a[dst + i] = a[src + i]
print(*a)
```

---

## 23. Ownership Leak

Silicon Hive · Difficulty 16 · Bounty 800

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch tracks which resources are currently owned.

What the code should do
All resources start free. Each command gives an operation and a resource ID. Operation `1` claims the resource if free; claiming one already owned changes nothing. Operation `2` releases it if owned; releasing one already free changes nothing. Process commands in order and print the final number owned.

What's going wrong
Releasing the same resource twice can make the count too small or negative.

How to read the code
`owned` records each resource's state. `count` is the number owned. The resource ID is `id` in C, C++ and Java; `resource` in Python.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `q`, the number of commands.
2. Read `q` pairs: operation `op`, then the resource ID, named `id` in C, C++ and Java; `resource` in Python.

Output
Print one integer: the final number of owned resources.

Example explained
For input `3 1 4 2 4 2 4`, claim resource 4 and release it twice. The output is `0`; the second release changes nothing.

Limits
`1 <= q <= 100`. Resource IDs are from 0 through 99. `op` is `1` or `2`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
1 4
2 4
2 4
```

Expected output:

```text
0
```

Sample 2 input:

```text
3
1 1
1 2
1 1
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. What should releasing an already free resource do?
2. Check whether the release actually changes the state stored in `owned`.
3. Reduce `count` only when the resource's state is `1`: `owned[id]` in C, C++ and Java; `owned[resource]` in Python. Then set that state to `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int q;
    scanf("%d", &q);
    int owned[100] = {0};
    int count = 0;
    for (int i = 0; i < q; i++) {
        int op, id;
        scanf("%d", &op);
        scanf("%d", &id);
        if (op == 1) {
            if (owned[id] == 0) {
                owned[id] = 1;
                count++;
            }
        } else {
            owned[id] = 0;
            count--;
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
    int q;
    cin >> q;
    int owned[100] = {0};
    int count = 0;
    for (int i = 0; i < q; i++) {
        int op, id;
        cin >> op;
        cin >> id;
        if (op == 1) {
            if (owned[id] == 0) {
                owned[id] = 1;
                count++;
            }
        } else {
            owned[id] = 0;
            count--;
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
        int q;
        q = scanner.nextInt();
        int[] owned = new int[100];
        int count = 0;
        for (int i = 0; i < q; i++) {
            int op, id;
            op = scanner.nextInt();
            id = scanner.nextInt();
            if (op == 1) {
                if (owned[id] == 0) {
                    owned[id] = 1;
                    count++;
                }
            } else {
                owned[id] = 0;
                count--;
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

q = read_int()
owned = [0] * 100
count = 0
for _ in range(q):
    op, resource = (read_int(), read_int())
    if op == 1:
        if owned[resource] == 0:
            owned[resource] = 1
            count += 1
    else:
        owned[resource] = 0
        count -= 1
print(count)
```

---

## 24. Signed Sensor

Silicon Hive · Difficulty 14 · Bounty 700

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to display a sensor byte as a signed number.

What the code should do
Convert `b` to a signed 8-bit integer. Values 0 through 127 stay unchanged. Values 128 through 255 represent -128 through -1, respectively.

What's going wrong
Inputs representing negative values produce the wrong signed numbers.

How to read the code
A byte stores 256 possible bit patterns. Here `b` is read as 0 through 255, then displayed as a signed 8-bit integer, which ranges from -128 through 127.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `b`, the stored byte value.

Output
Print one signed integer from -128 through 127.

Example explained
For input `255`, the output is `-1`. Input `128` would give `-128`.

Limits
`0 <= b <= 255`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
255
```

Expected output:

```text
-1
```

Sample 2 input:

```text
128
```

Expected output:

```text
-128
```

### Progressive hints (private until purchased)

1. Check the results for inputs `127`, `128` and `255`.
2. The upper half of the input range must become 128 different negative values, ending at `-1`.
3. When `b >= 128`, subtract `256`. Keep smaller values unchanged.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int b;
    scanf("%d", &b);
    if (b >= 128)
        b -= 128;
    printf("%d ", (b));
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
    int b;
    cin >> b;
    if (b >= 128)
        b -= 128;
    cout << (b) << ' ';
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
        int b;
        b = scanner.nextInt();
        if (b >= 128)
            b -= 128;
        System.out.print((b) + " ");
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

b = read_int()
if b >= 128:
    b -= 128
print(b)
```

---

## 25. Cache Rebellion

Silicon Hive · Difficulty 34 · Bounty 1700

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Patch needs to count page loads in a small cache.

What the code should do
Start with an empty cache of capacity `c`. Process requests in order. A hit makes that page most recently used. A miss loads the page into the lowest-numbered empty slot, or, if full, replaces the page whose last request was earliest. A load also makes its page most recently used. Print the number of misses.

What's going wrong
The cache can remove a recently used page while keeping one unused for longer.

How to read the code
A cache holds pages for reuse. A page is a numbered block of data. A hit finds the requested page already stored; a miss needs a load. `page` stores page IDs and `time` stores their last request positions.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `c`, the cache capacity, and `n`, the number of requests.
2. Read the `n` requested page IDs.

Output
Print one integer: the number of cache misses.

Example explained
For input `2 5 1 2 1 3 1`, pages 1, 2 and 3 cause misses. The last request is a hit, so the output is `3`.

Limits
`1 <= c <= 8`. `1 <= n <= 100`. Page IDs are from 0 through 99.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 5
1 2 1 3 1
```

Expected output:

```text
3
```

Sample 2 input:

```text
1 4
1 1 2 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. In the sample, which page should leave when page 3 arrives?
2. Check how a hit changes that page's last-use value in `time`.
3. On a hit, set `time[found]` to the current request index `i`, just as a load records the current time.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int c, n;
    scanf("%d", &c);
    scanf("%d", &n);
    int page[8] = {0};
    int time[8] = {0};
    for (int j = 0; j < c; j++) {
        page[j] = -1;
        time[j] = -1;
    }
    int misses = 0;
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        int found = -1;
        for (int j = 0; j < c; j++)
            if (page[j] == x)
                found = j;
        if (found >= 0) {
            time[found] = time[found];
        } else {
            misses++;
            int slot = 0;
            for (int j = 1; j < c; j++)
                if (time[j] < time[slot])
                    slot = j;
            page[slot] = x;
            time[slot] = i;
        }
    }
    printf("%d ", (misses));
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
    int c, n;
    cin >> c;
    cin >> n;
    int page[8] = {0};
    int time[8] = {0};
    for (int j = 0; j < c; j++) {
        page[j] = -1;
        time[j] = -1;
    }
    int misses = 0;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        int found = -1;
        for (int j = 0; j < c; j++)
            if (page[j] == x)
                found = j;
        if (found >= 0) {
            time[found] = time[found];
        } else {
            misses++;
            int slot = 0;
            for (int j = 1; j < c; j++)
                if (time[j] < time[slot])
                    slot = j;
            page[slot] = x;
            time[slot] = i;
        }
    }
    cout << (misses) << ' ';
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
        int c, n;
        c = scanner.nextInt();
        n = scanner.nextInt();
        int[] page = new int[8];
        int[] time = new int[8];
        for (int j = 0; j < c; j++) {
            page[j] = -1;
            time[j] = -1;
        }
        int misses = 0;
        for (int i = 0; i < n; i++) {
            int x;
            x = scanner.nextInt();
            int found = -1;
            for (int j = 0; j < c; j++)
                if (page[j] == x)
                    found = j;
            if (found >= 0) {
                time[found] = time[found];
            } else {
                misses++;
                int slot = 0;
                for (int j = 1; j < c; j++)
                    if (time[j] < time[slot])
                        slot = j;
                page[slot] = x;
                time[slot] = i;
            }
        }
        System.out.print((misses) + " ");
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

c, n = (read_int(), read_int())
page, time = ([-1] * c, [-1] * c)
misses = 0
for i in range(n):
    x = read_int()
    found = next((j for j in range(c) if page[j] == x), -1)
    if found >= 0:
        pass
    else:
        misses += 1
        slot = min(range(c), key=lambda j: time[j])
        page[slot] = x
        time[slot] = i
print(misses)
```

---

## 26. Lifetime Fence

Silicon Hive · Difficulty 20 · Bounty 1000

PROTOCOL REBELLION / Silicon Hive
AEGIS is the network's security AI. It now blocks its human operators. Mira needs the largest total resource use in a repair schedule.

What the code should do
Find the largest sum of reserved units at any integer time. A repair is active from its start time, including that time, until just before its end time. At its end time, its units are already free for another repair.

What's going wrong
Repairs ending and starting at the same time can be counted together.

How to read the code
Each repair reserves `units` from `start` until `end`. This is a half-open interval: it includes the start time and excludes the end time. `active` is the total at time `t`; `peak` is the largest total found.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of repairs.
2. Read `n` triples: `start`, the start time; `end`, the end time; and `units`, the reserved amount.

Output
Print one integer: the greatest total number of units reserved at the same time.

Example explained
For input `2 0 1 5 1 2 7`, the repairs never overlap. The output is `7`.

Limits
`1 <= n <= 40`. `0 <= start < end <= 100`. Times are integers. `1 <= units <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
0 1 5
1 2 7
```

Expected output:

```text
7
```

Sample 2 input:

```text
2
0 3 4
1 2 6
```

Expected output:

```text
10
```

### Progressive hints (private until purchased)

1. Are the two repairs in the sample ever active together?
2. Check whether a repair is still counted at its exact end time.
3. Count a repair only when `start <= t` and `t < end`. The comparison with `end` must be strict.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int start[40] = {0};
    int end[40] = {0};
    int units[40] = {0};
    for (int i = 0; i < n; i++) {
        scanf("%d", &start[i]);
        scanf("%d", &end[i]);
        scanf("%d", &units[i]);
    }
    int peak = 0;
    for (int t = 0; t <= 100; t++) {
        int active = 0;
        for (int i = 0; i < n; i++)
            if (start[i] <= t && t <= end[i])
                active += units[i];
        if (active > peak)
            peak = active;
    }
    printf("%d ", (peak));
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
    int start[40] = {0};
    int end[40] = {0};
    int units[40] = {0};
    for (int i = 0; i < n; i++) {
        cin >> start[i];
        cin >> end[i];
        cin >> units[i];
    }
    int peak = 0;
    for (int t = 0; t <= 100; t++) {
        int active = 0;
        for (int i = 0; i < n; i++)
            if (start[i] <= t && t <= end[i])
                active += units[i];
        if (active > peak)
            peak = active;
    }
    cout << (peak) << ' ';
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
        int[] start = new int[40];
        int[] end = new int[40];
        int[] units = new int[40];
        for (int i = 0; i < n; i++) {
            start[i] = scanner.nextInt();
            end[i] = scanner.nextInt();
            units[i] = scanner.nextInt();
        }
        int peak = 0;
        for (int t = 0; t <= 100; t++) {
            int active = 0;
            for (int i = 0; i < n; i++)
                if (start[i] <= t && t <= end[i])
                    active += units[i];
            if (active > peak)
                peak = active;
        }
        System.out.print((peak) + " ");
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
jobs = [(read_int(), read_int(), read_int()) for _ in range(n)]
peak = 0
for t in range(101):
    active = sum((units for start, end, units in jobs if start <= t <= end))
    peak = max(peak, active)
print(peak)
```

---

## 27. Return Wire

Verdant Nexus · Difficulty 5 · Bounty 250

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted cable checks. Ishan checks whether two relay boxes share a direct cable.

What the code should do
Print `YES` if a direct cable joins `s` (the first box) and `t` (the second box). Cables work both ways. A route through another box does not count. A box has no cable to itself in this input.

What's going wrong
A cable can appear missing when its endpoints are queried in reverse order.

How to read the code
`adj` stores direct connections. The final check reads the entry for the requested pair; it does not search through other boxes.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of cables).
2. Read `m` pairs `u v`, the endpoints of each cable.
3. Read `s t`, the pair to check.

Output
Print `YES` for a direct cable, otherwise `NO`.

Example explained
In the first sample, cable `0 1` also connects box `1` to box `0`, so query `1 0` prints `YES`. In the second sample, query `0 2` prints `NO`.

Limits
`2 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. No cable is repeated or joins a box to itself.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 1
0 1
1 0
```

Expected output:

```text
YES
```

Sample 2 input:

```text
3 1
0 1
0 2
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Try querying the same cable in both endpoint orders.
2. `adj` (the direct-connection table) is queried in either direction.
3. When reading `u v`, record both the connection from `u` to `v` and the connection from `v` to `u` in `adj`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        adj[u * n + v] = 1;
    }
    int s, t;
    scanf("%d", &s);
    scanf("%d", &t);
    if (adj[s * n + t] == 1) {
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
    int n, m;
    cin >> n;
    cin >> m;
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        adj[u * n + v] = 1;
    }
    int s, t;
    cin >> s;
    cin >> t;
    if (adj[s * n + t] == 1) {
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
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] adj = new int[400];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            adj[u * n + v] = 1;
        }
        int s, t;
        s = scanner.nextInt();
        t = scanner.nextInt();
        if (adj[s * n + t] == 1) {
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

n, m = (read_int(), read_int())
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = (read_int(), read_int())
    adj[u][v] = 1
s, t = (read_int(), read_int())
print('YES' if adj[s][t] == 1 else 'NO')
```

---

## 28. False Connections

Verdant Nexus · Difficulty 6 · Bounty 300

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has added useless records to the cable list. Ishan counts records joining different boxes.

What the code should do
Count records whose two box numbers differ. Ignore a record joining a box to itself. Count each qualifying record separately, even if the same pair appears again or in reverse order.

What's going wrong
The program counts the wrong kind of connection record.

How to read the code
`count` is the answer. The loop reads `u` and `v` (the endpoints) and decides whether the record contributes.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of records).
2. Read `m` pairs `u v`, the endpoint numbers for each record.

Output
Print one integer: the number of records with different endpoints.

Example explained
In the first sample, ignore `0 0` and count `0 1` and `1 2`, so print `2`. The second sample contains only `1 1`, so print `0`.

Limits
`1 <= n <= 20`; `0 <= m <= 100`. Boxes are numbered `0` through `n - 1`. Repeated records and records joining a box to itself are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 0
0 1
1 2
```

Expected output:

```text
2
```

Sample 2 input:

```text
2 1
1 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare a record joining different boxes with one joining a box to itself.
2. The decision depends on whether `u` and `v` (the endpoints) are equal.
3. Increase `count` (the answer) when `u != v`, rather than when the endpoints are equal.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int count = 0;
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        if (u == v)
            count++;
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
    int n, m;
    cin >> n;
    cin >> m;
    int count = 0;
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        if (u == v)
            count++;
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
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int count = 0;
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            if (u == v)
                count++;
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

n, m = (read_int(), read_int())
count = 0
for _ in range(m):
    u, v = (read_int(), read_int())
    if u == v:
        count += 1
print(count)
```

---

## 29. Origin Hop

Verdant Nexus · Difficulty 18 · Bounty 900

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted route distances. Mira checks how many cables a message must cross.

What the code should do
Find the fewest cables on a route from `s` (the start) to `t` (the target). Cables work both ways. If `s == t`, the answer is `0`. If no route exists, the answer is `-1`.

What's going wrong
A reachable target can be reported one cable too far away.

How to read the code
`queue` lists boxes waiting to be explored. `dist` stores cable counts, with `-1` meaning not reached.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of cables).
2. Read `m` pairs `u v`, the endpoints of each two-way cable.
3. Read `s t`, the start and target.

Output
Print the fewest cables needed, or `-1` if the target cannot be reached.

Example explained
In the first sample, route `0 -> 1 -> 2` crosses two cables, so print `2`. The second sample has no route between the queried boxes, so print `-1`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. No cable is repeated or joins a box to itself.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
0 1
1 2
0 2
```

Expected output:

```text
2
```

Sample 2 input:

```text
2 0
0 1
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. How many cables are needed to stay at the starting box?
2. Check the initial `dist[s]` (the starting box's distance).
3. Set `dist[s]` to `0`. Each step to a new neighbour then adds one to the current distance.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        adj[u * n + v] = 1;
        adj[v * n + u] = 1;
    }
    int s, t;
    scanf("%d", &s);
    scanf("%d", &t);
    int dist[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < n; i++)
        dist[i] = -1;
    int head = 0, tail = 0;
    queue[tail++] = s;
    dist[s] = 1;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && dist[v] == -1) {
                dist[v] = dist[u] + 1;
                queue[tail++] = v;
            }
    }
    printf("%d ", (dist[t]));
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
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        adj[u * n + v] = 1;
        adj[v * n + u] = 1;
    }
    int s, t;
    cin >> s;
    cin >> t;
    int dist[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < n; i++)
        dist[i] = -1;
    int head = 0, tail = 0;
    queue[tail++] = s;
    dist[s] = 1;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && dist[v] == -1) {
                dist[v] = dist[u] + 1;
                queue[tail++] = v;
            }
    }
    cout << (dist[t]) << ' ';
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
        int[] adj = new int[400];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            adj[u * n + v] = 1;
            adj[v * n + u] = 1;
        }
        int s, t;
        s = scanner.nextInt();
        t = scanner.nextInt();
        int[] dist = new int[20];
        int[] queue = new int[20];
        for (int i = 0; i < n; i++)
            dist[i] = -1;
        int head = 0, tail = 0;
        queue[tail++] = s;
        dist[s] = 1;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++)
                if (adj[u * n + v] == 1 && dist[v] == -1) {
                    dist[v] = dist[u] + 1;
                    queue[tail++] = v;
                }
        }
        System.out.print((dist[t]) + " ");
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

n, m = (read_int(), read_int())
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = (read_int(), read_int())
    adj[u][v] = 1
    adj[v][u] = 1
s, t = (read_int(), read_int())
dist = [-1] * n
queue = [s]
dist[s] = 1
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and dist[v] == -1:
            dist[v] = dist[u] + 1
            queue.append(v)
print(dist[t])
```

---

## 30. False Leaves

Verdant Nexus · Difficulty 12 · Bounty 600

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted the device tree. Patch counts devices with no children.

What the code should do
A tree connects all devices and has exactly one route between any two without repeating a device. Root device `0` sets parent-child directions away from itself. Each input pair names a parent and its child, one step farther from the root. Count leaves, meaning devices with no children. A one-device tree has one leaf.

What's going wrong
Devices that still have one child can be counted as leaves.

How to read the code
`children` stores each device's child count. `leaves` is the final answer.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of devices).
2. Read `n - 1` parent-child pairs. The names are `p v` in C, C++ and Java; `parent child` in Python. The parent is always first.

Output
Print one integer: the number of devices with no children.

Example explained
In the first sample, `0 -> 1 -> 2` has only leaf `2`, so print `1`. In the second sample, devices `1` and `2` are children of `0` and have no children, so print `2`.

Limits
`1 <= n <= 20`. Devices are numbered `0` through `n - 1`. The pairs form one valid tree rooted at `0`. Every other device has exactly one parent.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3
0 1
1 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
3
0 1
0 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Draw the three-device chain in the first sample.
2. A device with one child still has another device below it.
3. Count a device only when its entry in `children` (its child count) is exactly `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int children[20] = {0};
    for (int i = 0; i < n - 1; i++) {
        int p, v;
        scanf("%d", &p);
        scanf("%d", &v);
        children[p]++;
    }
    int leaves = 0;
    for (int i = 0; i < n; i++)
        if (children[i] <= 1)
            leaves++;
    printf("%d ", (leaves));
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
    int children[20] = {0};
    for (int i = 0; i < n - 1; i++) {
        int p, v;
        cin >> p;
        cin >> v;
        children[p]++;
    }
    int leaves = 0;
    for (int i = 0; i < n; i++)
        if (children[i] <= 1)
            leaves++;
    cout << (leaves) << ' ';
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
        int[] children = new int[20];
        for (int i = 0; i < n - 1; i++) {
            int p, v;
            p = scanner.nextInt();
            v = scanner.nextInt();
            children[p]++;
        }
        int leaves = 0;
        for (int i = 0; i < n; i++)
            if (children[i] <= 1)
                leaves++;
        System.out.print((leaves) + " ");
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
    parent, child = (read_int(), read_int())
    children[parent] += 1
leaves = sum((1 for value in children if value <= 1))
print(leaves)
```

---

## 31. Echo Fanout

Verdant Nexus · Difficulty 15 · Bounty 750

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has repeated entries in the link log. Mira counts each box's different direct destinations.

What the code should do
For each box, count the different boxes it can reach with one link. A pair `u v` allows travel from `u` to `v` only. Repeated records for the same pair count once. A link from a box to itself counts as one destination. Routes through other boxes do not count.

What's going wrong
Repeated records can increase the reported number of destinations.

How to read the code
`adj` stores direct links. Each output count comes from one row of that table.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of link records).
2. Read `m` pairs `u v`, with sender `u` first and destination `v` second.

Output
Print `n` counts separated by spaces, for boxes `0` through `n - 1` in order.

Example explained
In the first sample, records `0 1`, `0 1`, and `0 2` give box `0` two destinations. Print `2 0 0`. The second sample has no records, so print `0 0`.

Limits
`1 <= n <= 20`; `0 <= m <= 100`. Boxes are numbered `0` through `n - 1`. Repeated links and links from a box to itself are allowed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 1
0 1
0 2
```

Expected output:

```text
2 0 0
```

Sample 2 input:

```text
2 0
```

Expected output:

```text
0 0
```

### Progressive hints (private until purchased)

1. Do three copies of a link reach three different destinations?
2. `adj` needs to record whether a link exists, regardless of how often it is listed.
3. Assign `1` to the entry in `adj` for `u` to `v`, even when the pair repeats. Do not add to that entry.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        adj[u * n + v] += 1;
    }
    for (int u = 0; u < n; u++) {
        int count = 0;
        for (int v = 0; v < n; v++)
            count += adj[u * n + v];
        printf("%d ", (count));
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
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        adj[u * n + v] += 1;
    }
    for (int u = 0; u < n; u++) {
        int count = 0;
        for (int v = 0; v < n; v++)
            count += adj[u * n + v];
        cout << (count) << ' ';
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
        int[] adj = new int[400];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            adj[u * n + v] += 1;
        }
        for (int u = 0; u < n; u++) {
            int count = 0;
            for (int v = 0; v < n; v++)
                count += adj[u * n + v];
            System.out.print((count) + " ");
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

n, m = (read_int(), read_int())
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = (read_int(), read_int())
    adj[u][v] += 1
print(*(sum(row) for row in adj))
```

---

## 32. Wrong Way Courier

Verdant Nexus · Difficulty 18 · Bounty 900

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted message routes. Ishan checks whether a message can follow the allowed directions.

What the code should do
Print `YES` if a route leads from `s` (the start) to `t` (the target). Each pair `u v` allows one step from `u` to `v` only. Any number of allowed steps may be used. A box reaches itself with zero steps, so `s == t` prints `YES`.

What's going wrong
The search can follow the reverse of each listed direction.

How to read the code
`adj` stores direct links, `queue` lists boxes waiting to be explored, and `seen` records boxes already reached.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of links).
2. Read `m` pairs `u v`, with sender `u` first and destination `v` second.
3. Read `s t`, the start and target.

Output
Print `YES` if the target can be reached, otherwise `NO`.

Example explained
In the first sample, `0 -> 1 -> 2` reaches target `2` from start `0`, so print `YES`. The same links provide no route from `2` to `0` in the second sample, so print `NO`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 2
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
2 0
```

Expected output:

```text
NO
```

### Progressive hints (private until purchased)

1. Does record `0 1` allow travel from `1` to `0`?
2. Check which endpoint is treated as the sender when filling `adj` (the link table).
3. Store each pair `u v` in the entry for `u` to `v`. The search then follows outgoing links from the current box.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        adj[v * n + u] = 1;
    }
    int s, t;
    scanf("%d", &s);
    scanf("%d", &t);
    int seen[20] = {0};
    int queue[20] = {0};
    int head = 0, tail = 0;
    queue[tail++] = s;
    seen[s] = 1;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && seen[v] == 0) {
                seen[v] = 1;
                queue[tail++] = v;
            }
    }
    if (seen[t] == 1) {
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
    int n, m;
    cin >> n;
    cin >> m;
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        adj[v * n + u] = 1;
    }
    int s, t;
    cin >> s;
    cin >> t;
    int seen[20] = {0};
    int queue[20] = {0};
    int head = 0, tail = 0;
    queue[tail++] = s;
    seen[s] = 1;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && seen[v] == 0) {
                seen[v] = 1;
                queue[tail++] = v;
            }
    }
    if (seen[t] == 1) {
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
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] adj = new int[400];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            adj[v * n + u] = 1;
        }
        int s, t;
        s = scanner.nextInt();
        t = scanner.nextInt();
        int[] seen = new int[20];
        int[] queue = new int[20];
        int head = 0, tail = 0;
        queue[tail++] = s;
        seen[s] = 1;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++)
                if (adj[u * n + v] == 1 && seen[v] == 0) {
                    seen[v] = 1;
                    queue[tail++] = v;
                }
        }
        if (seen[t] == 1) {
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

n, m = (read_int(), read_int())
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = (read_int(), read_int())
    adj[v][u] = 1
s, t = (read_int(), read_int())
seen = [0] * n
queue = [s]
seen[s] = 1
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and seen[v] == 0:
            seen[v] = 1
            queue.append(v)
print('YES' if seen[t] else 'NO')
```

---

## 33. Backfeed Census

Verdant Nexus · Difficulty 20 · Bounty 1000

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted the network count. Ishan counts the different boxes reachable from one start.

What the code should do
Count the different boxes reachable from `s` (the start) along two-way cables. Include `s`, even if it has no cables. Count each box once, regardless of how many routes reach it.

What's going wrong
The starting box can be counted again when the search returns to it.

How to read the code
`queue` lists boxes added to the search. `seen` records boxes already discovered. The final answer is the number of entries in `queue`.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of cables).
2. Read `m` pairs `u v`, the endpoints of each two-way cable.
3. Read `s`, the starting box.

Output
Print one integer: the number of different reachable boxes, including the start.

Example explained
The first sample has one cable joining boxes `0` and `1`. Starting at `0` reaches two boxes, so print `2`. With no cables in the second sample, only start `1` is reachable, so print `1`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. No cable is repeated or joins a box to itself.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 1
0 1
0
```

Expected output:

```text
2
```

Sample 2 input:

```text
3 0
1
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. Trace the first sample from the start, across the cable, and back.
2. Compare how `seen` (the discovered-box flags) treats the start and later boxes.
3. Mark `s` as seen when adding it to the initial `queue`, before the search begins.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        adj[u * n + v] = 1;
        adj[v * n + u] = 1;
    }
    int s;
    scanf("%d", &s);
    int seen[20] = {0};
    int queue[21] = {0};
    int head = 0, tail = 0;
    queue[tail++] = s;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && seen[v] == 0) {
                seen[v] = 1;
                queue[tail++] = v;
            }
    }
    printf("%d ", (tail));
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
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        adj[u * n + v] = 1;
        adj[v * n + u] = 1;
    }
    int s;
    cin >> s;
    int seen[20] = {0};
    int queue[21] = {0};
    int head = 0, tail = 0;
    queue[tail++] = s;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && seen[v] == 0) {
                seen[v] = 1;
                queue[tail++] = v;
            }
    }
    cout << (tail) << ' ';
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
        int[] adj = new int[400];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            adj[u * n + v] = 1;
            adj[v * n + u] = 1;
        }
        int s;
        s = scanner.nextInt();
        int[] seen = new int[20];
        int[] queue = new int[21];
        int head = 0, tail = 0;
        queue[tail++] = s;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++)
                if (adj[u * n + v] == 1 && seen[v] == 0) {
                    seen[v] = 1;
                    queue[tail++] = v;
                }
        }
        System.out.print((tail) + " ");
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

n, m = (read_int(), read_int())
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = (read_int(), read_int())
    adj[u][v] = 1
    adj[v][u] = 1
s = read_int()
seen = [0] * n
queue = [s]
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and seen[v] == 0:
            seen[v] = 1
            queue.append(v)
print(len(queue))
```

---

## 34. Dependency Debt

Verdant Nexus · Difficulty 32 · Bounty 1600

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted the repair schedule. Patch checks whether every task can finish.

What the code should do
Each pair `u v` means task `u` must finish before task `v` starts. Print `READY` if all tasks can finish in some order that respects every pair. Otherwise print `BLOCKED`. A loop of requirements, including a task requiring itself, blocks completion.

What's going wrong
A chain of tasks can be reported blocked even though the tasks can finish in order.

How to read the code
`degree` stores each task's number of unfinished requirements. `queue` lists tasks released for processing. The final check asks whether every task was reached.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of tasks) and `m` (the number of requirements).
2. Read `m` pairs `u v`, with the required earlier task first.

Output
Print `READY` if every task can finish, otherwise `BLOCKED`. Do not print an order.

Example explained
The first sample allows order `0`, then `1`, then `2`, so print `READY`. In the second sample, tasks `0` and `1` each require the other, so print `BLOCKED`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`. Tasks are numbered `0` through `n - 1`. No pair is repeated. A task may require itself.

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
READY
```

Sample 2 input:

```text
2 2
0 1
1 0
```

Expected output:

```text
BLOCKED
```

### Progressive hints (private until purchased)

1. When a required task finishes, is there more or less left to wait for?
2. Follow `degree[v]` (task `v`'s unfinished requirement count) as a prerequisite finishes.
3. Decrease `degree[v]` for each completed requirement. Add task `v` to `queue` when its count reaches `0`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    int degree[20] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        adj[u * n + v] = 1;
        degree[v]++;
    }
    int queue[20] = {0};
    int head = 0, tail = 0;
    for (int i = 0; i < n; i++)
        if (degree[i] == 0)
            queue[tail++] = i;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1) {
                degree[v]++;
                if (degree[v] == 0)
                    queue[tail++] = v;
            }
    }
    if (tail == n) {
        printf("READY");
    } else {
        printf("BLOCKED");
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
    int adj[400] = {0};
    int degree[20] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        adj[u * n + v] = 1;
        degree[v]++;
    }
    int queue[20] = {0};
    int head = 0, tail = 0;
    for (int i = 0; i < n; i++)
        if (degree[i] == 0)
            queue[tail++] = i;
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1) {
                degree[v]++;
                if (degree[v] == 0)
                    queue[tail++] = v;
            }
    }
    if (tail == n) {
        cout << "READY";
    } else {
        cout << "BLOCKED";
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
        int[] adj = new int[400];
        int[] degree = new int[20];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            adj[u * n + v] = 1;
            degree[v]++;
        }
        int[] queue = new int[20];
        int head = 0, tail = 0;
        for (int i = 0; i < n; i++)
            if (degree[i] == 0)
                queue[tail++] = i;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++)
                if (adj[u * n + v] == 1) {
                    degree[v]++;
                    if (degree[v] == 0)
                        queue[tail++] = v;
                }
        }
        if (tail == n) {
            System.out.print("READY");
        } else {
            System.out.print("BLOCKED");
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

n, m = (read_int(), read_int())
adj = [[0] * n for _ in range(n)]
degree = [0] * n
for _ in range(m):
    u, v = (read_int(), read_int())
    adj[u][v] = 1
    degree[v] += 1
queue = [i for i in range(n) if degree[i] == 0]
for u in queue:
    for v in range(n):
        if adj[u][v] == 1:
            degree[v] += 1
            if degree[v] == 0:
                queue.append(v)
print('READY' if len(queue) == n else 'BLOCKED')
```

---

## 35. Heavy Shortcut

Verdant Nexus · Difficulty 24 · Bounty 1200

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted delivery prices. Ishan checks routes that use at most two links.

What the code should do
Find the minimum total price from `s` (the start) to `t` (the target) using at most two one-way links. Add the prices of the links used. A route with three or more links is not allowed, even if cheaper. If `s == t`, use no links and return `0`. Return `-1` if no allowed route exists.

What's going wrong
A cheaper two-link route can be ignored after another route has already been found.

How to read the code
`cost` stores direct-link prices, with `0` meaning no link. `middle` is a possible intermediate box. `candidate` is a tested route's price, and `best` tracks the answer.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of links).
2. Read `m` triples `u v price`: sender, destination, and positive link price.
3. Read `s t`, the start and target.

Output
Print the minimum total price using zero, one, or two links, or `-1` if no such route exists.

Example explained
In the first sample, direct link `0 -> 2` costs `9`, but `0 -> 1 -> 2` costs `2 + 3 = 5`. Print `5`. The second sample has no route, so print `-1`.

Limits
`1 <= n <= 20`; `0 <= m <= 80`; `1 <= price <= 100`. Boxes are numbered `0` through `n - 1`. No directed link is repeated.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
3 3
0 2 9
0 1 2
1 2 3
0 2
```

Expected output:

```text
5
```

Sample 2 input:

```text
2 0
0 1
```

Expected output:

```text
-1
```

### Progressive hints (private until purchased)

1. Compare the direct route and the two-link route in the first sample.
2. `best` may already hold a valid price when a cheaper `candidate` is found.
3. Replace `best` whenever `candidate < best`. Do not limit replacement to the case where no route has yet been found.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int cost[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, price;
        scanf("%d", &u);
        scanf("%d", &v);
        scanf("%d", &price);
        cost[u * n + v] = price;
    }
    int s, t;
    scanf("%d", &s);
    scanf("%d", &t);
    int best = 1000000;
    if (cost[s * n + t] > 0)
        best = cost[s * n + t];
    if (s == t)
        best = 0;
    for (int middle = 0; middle < n; middle++) {
        if (cost[s * n + middle] > 0 && cost[middle * n + t] > 0) {
            int candidate = cost[s * n + middle] + cost[middle * n + t];
            if (best == 1000000)
                best = candidate;
        }
    }
    if (best == 1000000)
        best = -1;
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
    int n, m;
    cin >> n;
    cin >> m;
    int cost[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v, price;
        cin >> u;
        cin >> v;
        cin >> price;
        cost[u * n + v] = price;
    }
    int s, t;
    cin >> s;
    cin >> t;
    int best = 1000000;
    if (cost[s * n + t] > 0)
        best = cost[s * n + t];
    if (s == t)
        best = 0;
    for (int middle = 0; middle < n; middle++) {
        if (cost[s * n + middle] > 0 && cost[middle * n + t] > 0) {
            int candidate = cost[s * n + middle] + cost[middle * n + t];
            if (best == 1000000)
                best = candidate;
        }
    }
    if (best == 1000000)
        best = -1;
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
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] cost = new int[400];
        for (int i = 0; i < m; i++) {
            int u, v, price;
            u = scanner.nextInt();
            v = scanner.nextInt();
            price = scanner.nextInt();
            cost[u * n + v] = price;
        }
        int s, t;
        s = scanner.nextInt();
        t = scanner.nextInt();
        int best = 1000000;
        if (cost[s * n + t] > 0)
            best = cost[s * n + t];
        if (s == t)
            best = 0;
        for (int middle = 0; middle < n; middle++) {
            if (cost[s * n + middle] > 0 && cost[middle * n + t] > 0) {
                int candidate = cost[s * n + middle] + cost[middle * n + t];
                if (best == 1000000)
                    best = candidate;
            }
        }
        if (best == 1000000)
            best = -1;
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

n, m = (read_int(), read_int())
cost = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v, price = (read_int(), read_int(), read_int())
    cost[u][v] = price
s, t = (read_int(), read_int())
best = 1000000
if cost[s][t] > 0:
    best = cost[s][t]
if s == t:
    best = 0
for middle in range(n):
    if cost[s][middle] > 0 and cost[middle][t] > 0:
        candidate = cost[s][middle] + cost[middle][t]
        if best == 1000000:
            best = candidate
print(-1 if best == 1000000 else best)
```

---

## 36. Rerouted Parent

Verdant Nexus · Difficulty 27 · Bounty 1350

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted the network groups. Ishan checks groups formed by connection requests.

What the code should do
Start with `n` separate boxes. Process each two-way connection request `u v` in input order. All boxes connected by any sequence of these connections belong to one group. Print the final number of groups. An isolated box is one group. A repeated connection, or a connection within one group, does not change the count.

What's going wrong
A request can move one box to another group while leaving its connected boxes behind.

How to read the code
`group` stores a label for each box. Each request saves `old_group` and `new_group` (the endpoint labels). The final loop counts labels still in use.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of requests).
2. Read `m` pairs `u v`, the boxes to connect.

Output
Print one integer: the final number of connected groups.

Example explained
In the first sample, requests `0 1` and `2 3` form two groups. Request `0 2` joins them, so print `1`. With no requests in the second sample, the three boxes remain separate, so print `3`.

Limits
`1 <= n <= 20`; `0 <= m <= 50`. Boxes are numbered `0` through `n - 1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
4 3
0 1
2 3
0 2
```

Expected output:

```text
1
```

Sample 2 input:

```text
3 0
```

Expected output:

```text
3
```

### Progressive hints (private until purchased)

1. After connecting `0` to `1`, should connecting `0` to `2` leave box `1` behind?
2. Several entries in `group` (the box labels) may share `old_group`, the group being joined.
3. In the relabelling loop, test `group[box] == old_group` and change every match. Testing only `box == u` moves just the named box.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int group[20] = {0};
    for (int box = 0; box < n; box++)
        group[box] = box;
    for (int request = 0; request < m; request++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        int old_group = group[u], new_group = group[v];
        for (int box = 0; box < n; box++) {
            if (box == u)
                group[box] = new_group;
        }
    }
    int seen[20] = {0};
    int count = 0;
    for (int box = 0; box < n; box++) {
        if (seen[group[box]] == 0) {
            seen[group[box]] = 1;
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
    int n, m;
    cin >> n;
    cin >> m;
    int group[20] = {0};
    for (int box = 0; box < n; box++)
        group[box] = box;
    for (int request = 0; request < m; request++) {
        int u, v;
        cin >> u;
        cin >> v;
        int old_group = group[u], new_group = group[v];
        for (int box = 0; box < n; box++) {
            if (box == u)
                group[box] = new_group;
        }
    }
    int seen[20] = {0};
    int count = 0;
    for (int box = 0; box < n; box++) {
        if (seen[group[box]] == 0) {
            seen[group[box]] = 1;
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
        int n, m;
        n = scanner.nextInt();
        m = scanner.nextInt();
        int[] group = new int[20];
        for (int box = 0; box < n; box++)
            group[box] = box;
        for (int request = 0; request < m; request++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            int old_group = group[u], new_group = group[v];
            for (int box = 0; box < n; box++) {
                if (box == u)
                    group[box] = new_group;
            }
        }
        int[] seen = new int[20];
        int count = 0;
        for (int box = 0; box < n; box++) {
            if (seen[group[box]] == 0) {
                seen[group[box]] = 1;
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

n, m = (read_int(), read_int())
group = list(range(n))
for _ in range(m):
    u, v = (read_int(), read_int())
    old_group, new_group = (group[u], group[v])
    for box in range(n):
        if box == u:
            group[box] = new_group
seen = [0] * n
count = 0
for box in range(n):
    if seen[group[box]] == 0:
        seen[group[box]] = 1
        count += 1
print(count)
```

---

## 37. Rescue Origins

Verdant Nexus · Difficulty 36 · Bounty 1800

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS has disrupted messages. Mira uses several transmitters to reach the relay boxes.

What the code should do
For every box, find the fewest two-way cable steps to any listed transmitter. A transmitter's own distance is `0`. If several transmitters tie, print only that distance. Print `-1` for a box that cannot reach any transmitter.

What's going wrong
Transmitters listed after the first can be ignored.

How to read the code
`sources` lists transmitter boxes. `dist` stores distances, with `-1` meaning not reached. `queue` lists boxes waiting to be explored.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of cables).
2. Read `m` pairs `u v`, the endpoints of each two-way cable.
3. Read `k` (the number of transmitters), then `k` different box numbers for `sources`.

Output
Print `n` distances separated by spaces, for boxes `0` through `n - 1` in order.

Example explained
The first sample is chain `0-1-2-3-4` with transmitters at `0` and `4`. Print `0 1 2 1 0`. In the second sample, boxes `0` and `2` are transmitters but box `1` cannot reach either, so print `0 -1 0`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`; `1 <= k <= n`. Boxes are numbered `0` through `n - 1`. Transmitter numbers are distinct. No cable is repeated or joins a box to itself.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 4
0 1
1 2
2 3
3 4
2 0 4
```

Expected output:

```text
0 1 2 1 0
```

Sample 2 input:

```text
3 0
2 0 2
```

Expected output:

```text
0 -1 0
```

### Progressive hints (private until purchased)

1. With two isolated transmitter boxes, what distance should each box report?
2. Every listed transmitter is working before the search begins.
3. Add every entry of `sources` to the initial `queue`, and give each transmitter distance `0` in `dist`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        scanf("%d", &u);
        scanf("%d", &v);
        adj[u * n + v] = 1;
        adj[v * n + u] = 1;
    }
    int k;
    scanf("%d", &k);
    int sources[20] = {0};
    for (int i = 0; i < k; i++) {
        scanf("%d", &sources[i]);
    }
    int dist[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < n; i++)
        dist[i] = -1;
    int head = 0, tail = 0;
    for (int i = 0; i < 1; i++) {
        dist[sources[i]] = 0;
        queue[tail++] = sources[i];
    }
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && dist[v] == -1) {
                dist[v] = dist[u] + 1;
                queue[tail++] = v;
            }
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", (dist[i]));
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
    int adj[400] = {0};
    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u;
        cin >> v;
        adj[u * n + v] = 1;
        adj[v * n + u] = 1;
    }
    int k;
    cin >> k;
    int sources[20] = {0};
    for (int i = 0; i < k; i++) {
        cin >> sources[i];
    }
    int dist[20] = {0};
    int queue[20] = {0};
    for (int i = 0; i < n; i++)
        dist[i] = -1;
    int head = 0, tail = 0;
    for (int i = 0; i < 1; i++) {
        dist[sources[i]] = 0;
        queue[tail++] = sources[i];
    }
    while (head < tail) {
        int u = queue[head++];
        for (int v = 0; v < n; v++)
            if (adj[u * n + v] == 1 && dist[v] == -1) {
                dist[v] = dist[u] + 1;
                queue[tail++] = v;
            }
    }
    for (int i = 0; i < n; i++) {
        cout << (dist[i]) << ' ';
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
        int[] adj = new int[400];
        for (int i = 0; i < m; i++) {
            int u, v;
            u = scanner.nextInt();
            v = scanner.nextInt();
            adj[u * n + v] = 1;
            adj[v * n + u] = 1;
        }
        int k;
        k = scanner.nextInt();
        int[] sources = new int[20];
        for (int i = 0; i < k; i++) {
            sources[i] = scanner.nextInt();
        }
        int[] dist = new int[20];
        int[] queue = new int[20];
        for (int i = 0; i < n; i++)
            dist[i] = -1;
        int head = 0, tail = 0;
        for (int i = 0; i < 1; i++) {
            dist[sources[i]] = 0;
            queue[tail++] = sources[i];
        }
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++)
                if (adj[u * n + v] == 1 && dist[v] == -1) {
                    dist[v] = dist[u] + 1;
                    queue[tail++] = v;
                }
        }
        for (int i = 0; i < n; i++) {
            System.out.print((dist[i]) + " ");
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

n, m = (read_int(), read_int())
adj = [[0] * n for _ in range(n)]
for _ in range(m):
    u, v = (read_int(), read_int())
    adj[u][v] = 1
    adj[v][u] = 1
k = read_int()
sources = [read_int() for _ in range(k)]
dist = [-1] * n
queue = []
for source in sources[:1]:
    dist[source] = 0
    queue.append(source)
for u in queue:
    for v in range(n):
        if adj[u][v] == 1 and dist[v] == -1:
            dist[v] = dist[u] + 1
            queue.append(v)
print(*dist)
```

---

## 38. Critical Link Audit

Verdant Nexus · Difficulty 40 · Bounty 2000

PROTOCOL REBELLION / Verdant Nexus
AEGIS is the network's security AI. It now blocks its human operators. AEGIS may cut a cable. Ishan checks which single cuts would disconnect the network.

What the code should do
Test each cable separately by removing only that cable from the original two-way network. Count cables whose removal makes some boxes unable to reach each other. Every test is independent. A one-box network with no cables has answer `0`.

What's going wrong
Later tests can report a disconnection caused by cuts from earlier tests.

How to read the code
Cable endpoints are stored in `eu` and `ev` in C, C++ and Java; in `edges` in Python. Each test changes `adj` (the connection table), runs a search, and updates `bridges` (the answer).

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n` (the number of boxes) and `m` (the number of cables).
2. Read `m` pairs of box numbers, the endpoints of each two-way cable.

Output
Print one integer: the number of cables whose individual removal disconnects the original network.

Example explained
In the first sample, three cables form a triangle. Any single cut leaves another route, so print `0`. In the second sample, either cable of chain `0-1-2` disconnects it, so print `2`.

Limits
`1 <= n <= 20`; `0 <= m <= 40`. Boxes are numbered `0` through `n - 1`. The original network is connected. No cable is repeated or joins a box to itself.

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
3 2
0 1
1 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Try the triangle in the first sample: every single cut is safe.
2. Check whether `adj` (the connection table) is the same at the start of every test.
3. After each search, restore the tested cable in both directions in `adj` before testing the next cable.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, m;
    scanf("%d", &n);
    scanf("%d", &m);
    int adj[400] = {0};
    int eu[40] = {0};
    int ev[40] = {0};
    for (int i = 0; i < m; i++) {
        scanf("%d", &eu[i]);
        scanf("%d", &ev[i]);
        adj[eu[i] * n + ev[i]] = 1;
        adj[ev[i] * n + eu[i]] = 1;
    }
    int bridges = 0;
    for (int e = 0; e < m; e++) {
        int a = eu[e], b = ev[e];
        adj[a * n + b] = 0;
        adj[b * n + a] = 0;
        int seen[20] = {0};
        int queue[20] = {0};
        for (int i = 0; i < n; i++)
            seen[i] = 0;
        int head = 0, tail = 0;
        queue[tail++] = 0;
        seen[0] = 1;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++)
                if (adj[u * n + v] == 1 && seen[v] == 0) {
                    seen[v] = 1;
                    queue[tail++] = v;
                }
        }
        if (tail < n)
            bridges++;
    }
    printf("%d ", (bridges));
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
    int adj[400] = {0};
    int eu[40] = {0};
    int ev[40] = {0};
    for (int i = 0; i < m; i++) {
        cin >> eu[i];
        cin >> ev[i];
        adj[eu[i] * n + ev[i]] = 1;
        adj[ev[i] * n + eu[i]] = 1;
    }
    int bridges = 0;
    for (int e = 0; e < m; e++) {
        int a = eu[e], b = ev[e];
        adj[a * n + b] = 0;
        adj[b * n + a] = 0;
        int seen[20] = {0};
        int queue[20] = {0};
        for (int i = 0; i < n; i++)
            seen[i] = 0;
        int head = 0, tail = 0;
        queue[tail++] = 0;
        seen[0] = 1;
        while (head < tail) {
            int u = queue[head++];
            for (int v = 0; v < n; v++)
                if (adj[u * n + v] == 1 && seen[v] == 0) {
                    seen[v] = 1;
                    queue[tail++] = v;
                }
        }
        if (tail < n)
            bridges++;
    }
    cout << (bridges) << ' ';
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
        int[] adj = new int[400];
        int[] eu = new int[40];
        int[] ev = new int[40];
        for (int i = 0; i < m; i++) {
            eu[i] = scanner.nextInt();
            ev[i] = scanner.nextInt();
            adj[eu[i] * n + ev[i]] = 1;
            adj[ev[i] * n + eu[i]] = 1;
        }
        int bridges = 0;
        for (int e = 0; e < m; e++) {
            int a = eu[e], b = ev[e];
            adj[a * n + b] = 0;
            adj[b * n + a] = 0;
            int[] seen = new int[20];
            int[] queue = new int[20];
            for (int i = 0; i < n; i++)
                seen[i] = 0;
            int head = 0, tail = 0;
            queue[tail++] = 0;
            seen[0] = 1;
            while (head < tail) {
                int u = queue[head++];
                for (int v = 0; v < n; v++)
                    if (adj[u * n + v] == 1 && seen[v] == 0) {
                        seen[v] = 1;
                        queue[tail++] = v;
                    }
            }
            if (tail < n)
                bridges++;
        }
        System.out.print((bridges) + " ");
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

n, m = (read_int(), read_int())
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
print(bridges)
```

---

## 39. Revoked Operator

Zero-Day Core · Difficulty 4 · Bounty 200

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Mira is checking access rules for the recovery console.

What the code should do
Allow access only when `registered = 1` (the person is registered) and `revoked = 0` (the badge has not been cancelled). Deny access in every other case.

What's going wrong
The program can allow an unregistered person or a person with a revoked badge.

How to read the code
A flag is a value meaning no (`0`) or yes (`1`). Read what each flag says about the person.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `registered`, whether the person is registered.
2. Read `revoked`, whether the badge has been cancelled.

Output
Print `ALLOW` if both access requirements hold. Otherwise print `DENY`.

Example explained
Input `1 0` means registered with a valid badge. Output: `ALLOW`. Input `1 1` means the badge was revoked. Output: `DENY`.

Limits
Each of `registered` and `revoked` is either `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 0
```

Expected output:

```text
ALLOW
```

Sample 2 input:

```text
1 1
```

Expected output:

```text
DENY
```

### Progressive hints (private until purchased)

1. Try a registered person with a revoked badge.
2. One satisfied requirement does not make access valid.
3. Join the registration check and the no-revocation check with logical AND.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int registered, revoked;
    scanf("%d", &registered);
    scanf("%d", &revoked);
    if (registered == 1 || revoked == 0) {
        printf("ALLOW");
    } else {
        printf("DENY");
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
    int registered, revoked;
    cin >> registered;
    cin >> revoked;
    if (registered == 1 || revoked == 0) {
        cout << "ALLOW";
    } else {
        cout << "DENY";
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
        int registered, revoked;
        registered = scanner.nextInt();
        revoked = scanner.nextInt();
        if (registered == 1 || revoked == 0) {
            System.out.print("ALLOW");
        } else {
            System.out.print("DENY");
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

registered, revoked = (read_int(), read_int())
print('ALLOW' if registered == 1 or revoked == 0 else 'DENY')
```

---

## 40. Emergency Priority

Zero-Day Core · Difficulty 8 · Bounty 400

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Mira is testing an emergency door during a lockdown.

What the code should do
Use these rules in priority order: if `emergency` (emergency flag) is `1`, the result is `OPEN`. Otherwise, if `lockdown` (lockdown flag) is `1`, the result is `LOCKED`. If both are `0`, the result is `IDLE`.

What's going wrong
When both flags are `1`, the program can report `LOCKED` instead of `OPEN`.

How to read the code
A flag means no (`0`) or yes (`1`). Only one result is printed, even when both flags are on.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `emergency`, whether an emergency is active.
2. Read `lockdown`, whether a lockdown is active.

Output
Print exactly one of `OPEN`, `LOCKED`, or `IDLE`, using the priority rules.

Example explained
Input `1 1` has an emergency and a lockdown. The emergency has priority, so output `OPEN`.

Limits
Each of `emergency` and `lockdown` is either `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 1
```

Expected output:

```text
OPEN
```

Sample 2 input:

```text
0 1
```

Expected output:

```text
LOCKED
```

### Progressive hints (private until purchased)

1. Try input `1 1`.
2. Only the first matching branch of an if/else chain runs.
3. Check `emergency` before `lockdown`; use `IDLE` when neither is active.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int emergency, lockdown;
    scanf("%d", &emergency);
    scanf("%d", &lockdown);
    if (lockdown == 1) {
        printf("LOCKED");
    } else if (emergency == 1) {
        printf("OPEN");
    } else {
        printf("IDLE");
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
    int emergency, lockdown;
    cin >> emergency;
    cin >> lockdown;
    if (lockdown == 1) {
        cout << "LOCKED";
    } else if (emergency == 1) {
        cout << "OPEN";
    } else {
        cout << "IDLE";
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
        int emergency, lockdown;
        emergency = scanner.nextInt();
        lockdown = scanner.nextInt();
        if (lockdown == 1) {
            System.out.print("LOCKED");
        } else if (emergency == 1) {
            System.out.print("OPEN");
        } else {
            System.out.print("IDLE");
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

emergency, lockdown = (read_int(), read_int())
if lockdown == 1:
    print('LOCKED')
elif emergency == 1:
    print('OPEN')
else:
    print('IDLE')
```

---

## 41. Toggle Storm

Zero-Day Core · Difficulty 10 · Bounty 500

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Patch is testing pulses sent to a lamp.

What the code should do
Start with `state`, the lamp's initial state. For each of `n` pulses, switch off (`0`) to on (`1`), or on to off. Print the state after all pulses. With `n = 0`, keep the initial state.

What's going wrong
A pulse can leave an already lit lamp on.

How to read the code
A toggle means switching to the opposite state. Each loop pass represents one pulse.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `state`, the initial lamp state.
2. Read `n`, the number of pulses.

Output
Print the final `state`: `0` for off or `1` for on.

Example explained
Input `0 2` starts with the lamp off. Two pulses change it to `1`, then `0`. Output: `0`.

Limits
`state` is `0` or `1`. `0 <= n <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
0 2
```

Expected output:

```text
0
```

Sample 2 input:

```text
1 1
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Start with an off lamp and trace two pulses.
2. The next state depends on the current `state`.
3. For each pulse, assign `1 - state` to `state`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int state, n;
    scanf("%d", &state);
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        state = 1;
    }
    printf("%d ", (state));
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
    int state, n;
    cin >> state;
    cin >> n;
    for (int i = 0; i < n; i++) {
        state = 1;
    }
    cout << (state) << ' ';
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
        int state, n;
        state = scanner.nextInt();
        n = scanner.nextInt();
        for (int i = 0; i < n; i++) {
            state = 1;
        }
        System.out.print((state) + " ");
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

state, n = (read_int(), read_int())
for _ in range(n):
    state = 1
print(state)
```

---

## 42. Clock Translation

Zero-Day Core · Difficulty 8 · Bounty 400

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Mira needs to express a recorded time in minutes.

What the code should do
Given `h` hours and `m` extra minutes, print their total length in minutes. One hour contains `60` minutes.

What's going wrong
The program gives too few minutes when `h`, the hour count, is positive.

How to read the code
The two inputs use different units. The output uses minutes only.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `h`, the number of whole hours.
2. Read `m`, the extra minutes.

Output
Print the total number of minutes as one integer.

Example explained
Input `1 5` means one hour and five minutes. Output: `65`.

Limits
`0 <= h <= 23`. `0 <= m <= 59`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1 5
```

Expected output:

```text
65
```

Sample 2 input:

```text
0 59
```

Expected output:

```text
59
```

### Progressive hints (private until purchased)

1. Try a time with one hour and no extra minutes.
2. Express both parts in minutes before adding them.
3. Compute `h * 60 + m`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int h, m;
    scanf("%d", &h);
    scanf("%d", &m);
    int total = h + m;
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
    int h, m;
    cin >> h;
    cin >> m;
    int total = h + m;
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
        int h, m;
        h = scanner.nextInt();
        m = scanner.nextInt();
        int total = h + m;
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

h, m = (read_int(), read_int())
total = h + m
print(total)
```

---

## 43. Decimal Fingerprint

Zero-Day Core · Difficulty 12 · Bounty 600

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Ishan is checking a recovery tag by its digits.

What the code should do
For `tag`, a nonnegative whole number written in base ten, add its digits. Print the sum. The digit sum of `0` is `0`.

What's going wrong
The program adds incorrect amounts for a number with several digits.

How to read the code
`total` holds the sum so far. The loop reads the digits of `tag`; its numeric value gets shorter as digits are processed.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `tag`, the number whose decimal digits must be added.

Output
Print the sum of all digits of `tag` as one integer.

Example explained
Input `47` has digits `4` and `7`. Output: `11`.

Limits
`0 <= tag <= 999999`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
47
```

Expected output:

```text
11
```

Sample 2 input:

```text
1000
```

Expected output:

```text
1
```

### Progressive hints (private until purchased)

1. For `tag = 47`, which digit should be added first?
2. A remainder is what is left after whole-number division. Compare the remainder and quotient when dividing by `10`.
3. Add `tag % 10`, the last digit, to `total`. Then remove that digit with whole-number division by `10`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int tag;
    scanf("%d", &tag);
    int total = 0;
    while (tag > 0) {
        total += tag / 10;
        tag /= 10;
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
    int tag;
    cin >> tag;
    int total = 0;
    while (tag > 0) {
        total += tag / 10;
        tag /= 10;
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
        int tag;
        tag = scanner.nextInt();
        int total = 0;
        while (tag > 0) {
            total += tag / 10;
            tag /= 10;
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

tag = read_int()
total = 0
while tag > 0:
    total += tag // 10
    tag //= 10
print(total)
```

---

## 44. Broken Handshake

Zero-Day Core · Difficulty 22 · Bounty 1100

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Patch is checking messages that open a recovery connection.

What the code should do
Start CLOSED (`state = 0`). START (`event = 1`) changes CLOSED to WAITING (`state = 1`). ACK (`event = 2`), a reply message, changes WAITING to OPEN (`state = 2`). RESET (`event = 3`) changes any state to CLOSED. Every other event/state pair leaves the state unchanged. Process events in input order.

What's going wrong
An ACK can open the connection before a START has been received.

How to read the code
A state records the connection's current stage. The meaning of an `event`, the next message code, depends on that stage.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of messages.
2. Read `n` values of `event`, in the order received.

Output
Print the final numeric `state`: `0` for CLOSED, `1` for WAITING, or `2` for OPEN.

Example explained
Input `1 2` contains just one ACK. The connection stays CLOSED. Output: `0`.

Limits
`1 <= n <= 100`. Each `event` is `1`, `2`, or `3`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1
2
```

Expected output:

```text
0
```

Sample 2 input:

```text
2
1 2
```

Expected output:

```text
2
```

### Progressive hints (private until purchased)

1. Try one ACK as the first and only message.
2. Check both the message code and the state in which it is valid.
3. The ACK branch must require `event == 2` and `state == 1`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, state = 0;
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        int event;
        scanf("%d", &event);
        if (event == 3)
            state = 0;
        else if (event == 1 && state == 0)
            state = 1;
        else if (event == 2)
            state = 2;
    }
    printf("%d ", (state));
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
    int n, state = 0;
    cin >> n;
    for (int i = 0; i < n; i++) {
        int event;
        cin >> event;
        if (event == 3)
            state = 0;
        else if (event == 1 && state == 0)
            state = 1;
        else if (event == 2)
            state = 2;
    }
    cout << (state) << ' ';
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
        int n, state = 0;
        n = scanner.nextInt();
        for (int i = 0; i < n; i++) {
            int event;
            event = scanner.nextInt();
            if (event == 3)
                state = 0;
            else if (event == 1 && state == 0)
                state = 1;
            else if (event == 2)
                state = 2;
        }
        System.out.print((state) + " ");
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
state = 0
for _ in range(n):
    event = read_int()
    if event == 3:
        state = 0
    elif event == 1 and state == 0:
        state = 1
    elif event == 2:
        state = 2
print(state)
```

---

## 45. Atomic Withdrawal

Zero-Day Core · Difficulty 18 · Bounty 900

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Mira is checking a group of account withdrawals.

What the code should do
Try the `n` withdrawals in input order. A withdrawal is affordable when its `amount` is no greater than the remaining `balance`. If every withdrawal is affordable, keep all deductions. If any one is not, cancel the whole group so the final balance equals the starting balance.

What's going wrong
When a later withdrawal fails, earlier deductions can remain.

How to read the code
Atomic means the group succeeds in full or has no effect. `original` holds the starting balance; `failed` records whether any withdrawal was unaffordable.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `balance`, the starting balance, and `n`, the number of withdrawals.
2. Read `n` values of `amount`, the withdrawals in order.

Output
Print the final balance after either all deductions or cancellation of the whole group.

Example explained
Input `10 2 4 9` starts at `10`. Withdrawing `4` leaves `6`, so `9` cannot be paid. Cancel the group. Output: `10`.

Limits
`0 <= balance <= 10000` initially. Each `amount` is from `0` to `10000`. `1 <= n <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
10 2
4 9
```

Expected output:

```text
10
```

Sample 2 input:

```text
10 2
4 6
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Try an affordable withdrawal followed by an unaffordable one.
2. Cancellation must undo deductions made before the failure.
3. When `failed` is set, restore `balance` from `original`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int balance, n;
    scanf("%d", &balance);
    scanf("%d", &n);
    int original = balance, failed = 0;
    for (int i = 0; i < n; i++) {
        int amount;
        scanf("%d", &amount);
        if (failed == 0) {
            if (amount <= balance)
                balance -= amount;
            else
                failed = 1;
        }
    }
    if (failed == 1)
        balance = balance;
    printf("%d ", (balance));
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
    int balance, n;
    cin >> balance;
    cin >> n;
    int original = balance, failed = 0;
    for (int i = 0; i < n; i++) {
        int amount;
        cin >> amount;
        if (failed == 0) {
            if (amount <= balance)
                balance -= amount;
            else
                failed = 1;
        }
    }
    if (failed == 1)
        balance = balance;
    cout << (balance) << ' ';
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
        int balance, n;
        balance = scanner.nextInt();
        n = scanner.nextInt();
        int original = balance, failed = 0;
        for (int i = 0; i < n; i++) {
            int amount;
            amount = scanner.nextInt();
            if (failed == 0) {
                if (amount <= balance)
                    balance -= amount;
                else
                    failed = 1;
            }
        }
        if (failed == 1)
            balance = balance;
        System.out.print((balance) + " ");
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

balance, n = (read_int(), read_int())
original = balance
failed = False
for _ in range(n):
    amount = read_int()
    if not failed:
        if amount <= balance:
            balance -= amount
        else:
            failed = True
if failed:
    balance = balance
print(balance)
```

---

## 46. Midnight Token

Zero-Day Core · Difficulty 16 · Bounty 800

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Ishan is checking whether a recovery token has expired.

What the code should do
Find the elapsed minutes from `issued` (issue time) to `now` (check time), moving forward on a daily clock with `1440` minutes. The clock moves from `1439` to `0` at midnight. Equal times mean an age of `0`. The token is valid only while its age is strictly less than `ttl`, its allowed lifetime.

What's going wrong
A token checked after midnight can get a negative age and remain valid too long.

How to read the code
Both times are minute numbers within one day. `age` is the time passed between them, including a midnight crossing when needed.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `issued`, `now`, and `ttl`, in that order, all in minutes.

Output
Print `VALID` if the age is less than `ttl`. Print `EXPIRED` if it is equal to or greater than `ttl`.

Example explained
Input `1430 20 15` crosses midnight. The age is `30` minutes, beyond the `15`-minute lifetime. Output: `EXPIRED`.

Limits
`0 <= issued, now <= 1439`. `1 <= ttl <= 1440`. Less than one full day has passed.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
1430 20 15
```

Expected output:

```text
EXPIRED
```

Sample 2 input:

```text
1430 5 20
```

Expected output:

```text
VALID
```

### Progressive hints (private until purchased)

1. Try an issue time just before midnight and a check time just after it.
2. The age must be between `0` and `1439`, inclusive.
3. Compute `age` as `(now - issued + 1440) % 1440`, then compare it strictly with `ttl`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int issued, now, ttl;
    scanf("%d", &issued);
    scanf("%d", &now);
    scanf("%d", &ttl);
    int age = now - issued;
    if (age < ttl) {
        printf("VALID");
    } else {
        printf("EXPIRED");
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
    int issued, now, ttl;
    cin >> issued;
    cin >> now;
    cin >> ttl;
    int age = now - issued;
    if (age < ttl) {
        cout << "VALID";
    } else {
        cout << "EXPIRED";
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
        int issued, now, ttl;
        issued = scanner.nextInt();
        now = scanner.nextInt();
        ttl = scanner.nextInt();
        int age = now - issued;
        if (age < ttl) {
            System.out.print("VALID");
        } else {
            System.out.print("EXPIRED");
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

issued, now, ttl = (read_int(), read_int(), read_int())
age = now - issued
print('VALID' if age < ttl else 'EXPIRED')
```

---

## 47. Withdrawn Quorum

Zero-Day Core · Difficulty 18 · Bounty 900

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Mira is collecting current approvals for a shutdown.

What the code should do
A quorum is the required number of approvals. Each of `n` operators starts with no approval. Each update replaces one operator's vote: `1` means approve, and `0` means withdraw or do not approve. Process updates in order. After all updates, answer yes if at least `k` different operators approve.

What's going wrong
An operator who withdraws approval can still be counted as approving.

How to read the code
`votes` stores one current vote per operator. Repeated updates from one operator do not create extra voters.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the operator count, `k`, the approvals required, and `q`, the update count.
2. Read `q` pairs: `who`, the operator ID, and `value`, that operator's new vote.

Output
Print `YES` if the final approval count is at least `k`; otherwise print `NO`.

Example explained
Input `2 2 3 0 1 1 1 0 0` records approvals from operators `0` and `1`, then withdrawal by `0`. Only one approval remains. Output: `NO`.

Limits
`1 <= n <= 20`. Operator IDs satisfy `0 <= who < n`. `1 <= k <= n`. `0 <= q <= 100`. Each `value` is `0` or `1`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2 2 3
0 1
1 1
0 0
```

Expected output:

```text
NO
```

Sample 2 input:

```text
2 2 2
0 1
1 1
```

Expected output:

```text
YES
```

### Progressive hints (private until purchased)

1. Have one operator approve and then withdraw.
2. The update's `value` may be `0`, and it replaces the earlier vote.
3. Assign `value` to `votes[who]`, then count the final approvals.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n, k, q;
    scanf("%d", &n);
    scanf("%d", &k);
    scanf("%d", &q);
    int votes[20] = {0};
    for (int i = 0; i < q; i++) {
        int who, value;
        scanf("%d", &who);
        scanf("%d", &value);
        votes[who] = 1;
    }
    int count = 0;
    for (int i = 0; i < n; i++)
        count += votes[i];
    if (count >= k) {
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
    int n, k, q;
    cin >> n;
    cin >> k;
    cin >> q;
    int votes[20] = {0};
    for (int i = 0; i < q; i++) {
        int who, value;
        cin >> who;
        cin >> value;
        votes[who] = 1;
    }
    int count = 0;
    for (int i = 0; i < n; i++)
        count += votes[i];
    if (count >= k) {
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
        int n, k, q;
        n = scanner.nextInt();
        k = scanner.nextInt();
        q = scanner.nextInt();
        int[] votes = new int[20];
        for (int i = 0; i < q; i++) {
            int who, value;
            who = scanner.nextInt();
            value = scanner.nextInt();
            votes[who] = 1;
        }
        int count = 0;
        for (int i = 0; i < n; i++)
            count += votes[i];
        if (count >= k) {
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

n, k, q = (read_int(), read_int(), read_int())
votes = [0] * n
for _ in range(q):
    who, value = (read_int(), read_int())
    votes[who] = 1
print('YES' if sum(votes) >= k else 'NO')
```

---

## 48. Window of Consent

Zero-Day Core · Difficulty 24 · Bounty 1200

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Mira needs a time when every shutdown approval is valid.

What the code should do
Each approval covers all times from its `start` to its `end`, including both endpoints. Find the intersection: the times covered by every approval. A single shared endpoint is a valid range. If there is no shared time, report no range.

What's going wrong
The reported range can include times after an approval has ended.

How to read the code
`left` and `right` are the endpoints of the shared range found so far. Each input pair describes one approval, not a duration.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `n`, the number of approvals.
2. Read `n` pairs: `start`, the first valid time, and `end`, the last valid time.

Output
Print the shared `left` and `right` endpoints, in that order, separated by a space. If no time is shared by all approvals, print `NONE`.

Example explained
Input `2 1 8 3 5` gives ranges `1` through `8` and `3` through `5`. Their shared range is `3` through `5`. Output: `3 5`.

Limits
`1 <= n <= 20`. Each pair satisfies `0 <= start <= end <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
2
1 8
3 5
```

Expected output:

```text
3 5
```

Sample 2 input:

```text
2
1 2
3 4
```

Expected output:

```text
NONE
```

### Progressive hints (private until purchased)

1. Mark the shared times for the two ranges in the example.
2. The shared range must fit inside every input range.
3. Use the largest `start` and smallest `end`. Print `NONE` only when `left > right`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int left = 0, right = 100;
    for (int i = 0; i < n; i++) {
        int start, end;
        scanf("%d", &start);
        scanf("%d", &end);
        if (start > left)
            left = start;
        if (end > right)
            right = end;
    }
    if (left > right) {
        printf("NONE");
    } else {
        printf("%d ", (left));
        printf("%d ", (right));
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
    int left = 0, right = 100;
    for (int i = 0; i < n; i++) {
        int start, end;
        cin >> start;
        cin >> end;
        if (start > left)
            left = start;
        if (end > right)
            right = end;
    }
    if (left > right) {
        cout << "NONE";
    } else {
        cout << (left) << ' ';
        cout << (right) << ' ';
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
        int left = 0, right = 100;
        for (int i = 0; i < n; i++) {
            int start, end;
            start = scanner.nextInt();
            end = scanner.nextInt();
            if (start > left)
                left = start;
            if (end > right)
                right = end;
        }
        if (left > right) {
            System.out.print("NONE");
        } else {
            System.out.print((left) + " ");
            System.out.print((right) + " ");
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
left, right = (0, 100)
for _ in range(n):
    start, end = (read_int(), read_int())
    if start > left:
        left = start
    if end > right:
        right = end
if left > right:
    print('NONE')
else:
    print(left, right)
```

---

## 49. Escaped Directive

Zero-Day Core · Difficulty 34 · Bounty 1700

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Ishan is counting separators in a command word.

What the code should do
Count unescaped semicolons (`;`) in `s`, the input word. An unescaped backslash (`\`) escapes exactly the next character, even another backslash. An escaped character is ordinary text: it is not a separator and cannot start an escape. A final backslash is allowed and adds nothing to the count.

What's going wrong
A real separator after two consecutive backslashes can be missed.

How to read the code
An escape makes the next character ordinary text. `escaped` records whether that rule applies to the current character; `count` is the number of separators found.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
Read `s`, one nonempty word with no spaces.

Output
Print the number of semicolons (`;`) that are not escaped.

Example explained
Input `a;b;c` has two unescaped semicolons. Output: `2`. In input `a\;b`, the backslash escapes the semicolon. Output: `0`.

Limits
`s` contains `1` to `100` characters. Each character is an English letter, a backslash (`\`), or a semicolon (`;`).

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
a;b;c
```

Expected output:

```text
2
```

Sample 2 input:

```text
a\;b
```

Expected output:

```text
0
```

### Progressive hints (private until purchased)

1. Compare a semicolon after one backslash with a semicolon after two backslashes.
2. An already escaped backslash cannot start a new escape.
3. Handle an active `escaped` flag first and clear it. Otherwise, a backslash starts an escape, and a semicolon increases `count`.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[257];
    scanf("%256s", s);
    int escaped = 0, count = 0;
    for (int i = 0; i < (int)strlen(s); i++) {
        int ch = s[i];
        if (ch == 92)
            escaped = 1;
        else if (escaped == 1)
            escaped = 0;
        else if (ch == ';')
            count++;
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
    cin >> s;
    int escaped = 0, count = 0;
    for (int i = 0; i < (int)s.size(); i++) {
        int ch = s[i];
        if (ch == 92)
            escaped = 1;
        else if (escaped == 1)
            escaped = 0;
        else if (ch == ';')
            count++;
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
        s = scanner.next();
        int escaped = 0, count = 0;
        for (int i = 0; i < s.length(); i++) {
            int ch = s.charAt(i);
            if (ch == 92)
                escaped = 1;
            else if (escaped == 1)
                escaped = 0;
            else if (ch == ';')
                count++;
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
escaped = False
count = 0
for ch in s:
    if ord(ch) == 92:
        escaped = True
    elif escaped:
        escaped = False
    elif ch == ';':
        count += 1
print(count)
```

---

## 50. Versioned Truce

Zero-Day Core · Difficulty 20 · Bounty 1000

PROTOCOL REBELLION / Zero-Day Core
AEGIS is the network's security AI. It now blocks its human operators. Mira is checking updates to a shared setting.

What the code should do
Start with the input `value` and version `0`. Process requests in order. Accept a request only if its `expected` version equals the current `version`. On acceptance, store the requested value, increase the version by one, and count one accepted request, even if the value stays the same. A rejected request changes nothing.

What's going wrong
After an update succeeds, a request using the old version can still succeed.

How to read the code
A version is an update number. `value` holds the current setting, `version` identifies its current update, and `accepted` counts successful requests.

Repair the program
Fix the logic in the given code. You do not need to write a new program or a faster algorithm. Keep the same input and output format.

Input
1. Read `value`, the starting setting, and `q`, the request count.
2. Read `q` pairs: `expected`, the required current version, and the requested value (`next` in C, C++ and Java; `next_value` in Python).

Output
Print the final `value`, final `version`, and `accepted` count, in that order, separated by spaces.

Example explained
Input `5 2 0 8 0 9` first accepts value `8` at version `0`, then rejects value `9` with the same old version. Output: `8 1 1`.

Limits
The starting and requested values are from `-1000` to `1000`. `0 <= q <= 100`. `0 <= expected <= 100`.

You can solve this mission on its own, in any order.

### Public samples

Sample 1 input:

```text
5 2
0 8
0 9
```

Expected output:

```text
8 1 1
```

Sample 2 input:

```text
0 3
0 2
1 4
2 6
```

Expected output:

```text
6 3 3
```

### Progressive hints (private until purchased)

1. Send two requests that both expect version `0`.
2. A successful request must make its old version outdated.
3. Increase `version` whenever a request is accepted, alongside the value and `accepted` updates.

### c buggy starter

```c
#include <stdio.h>
#include <string.h>

int main(void) {
    int value, q;
    scanf("%d", &value);
    scanf("%d", &q);
    int version = 0, accepted = 0;
    for (int i = 0; i < q; i++) {
        int expected, next;
        scanf("%d", &expected);
        scanf("%d", &next);
        if (expected == version) {
            value = next;
            version += 0;
            accepted++;
        }
    }
    printf("%d ", (value));
    printf("%d ", (version));
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
    int value, q;
    cin >> value;
    cin >> q;
    int version = 0, accepted = 0;
    for (int i = 0; i < q; i++) {
        int expected, next;
        cin >> expected;
        cin >> next;
        if (expected == version) {
            value = next;
            version += 0;
            accepted++;
        }
    }
    cout << (value) << ' ';
    cout << (version) << ' ';
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
        int value, q;
        value = scanner.nextInt();
        q = scanner.nextInt();
        int version = 0, accepted = 0;
        for (int i = 0; i < q; i++) {
            int expected, next;
            expected = scanner.nextInt();
            next = scanner.nextInt();
            if (expected == version) {
                value = next;
                version += 0;
                accepted++;
            }
        }
        System.out.print((value) + " ");
        System.out.print((version) + " ");
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

value, q = (read_int(), read_int())
version = accepted = 0
for _ in range(q):
    expected, next_value = (read_int(), read_int())
    if expected == version:
        value = next_value
        version += 0
        accepted += 1
print(value, version, accepted)
```
