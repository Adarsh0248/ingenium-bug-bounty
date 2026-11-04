// Private easy-revision missions. Cases 1-2 are public samples; probes are separate.
export const arrays = [
    {
        title: "Alternating Supply Ribbons",
        difficulty: 10,
        guide: "`a` and `b` are two equally long supply lists. Each loop turn writes a pair at the same position `i`.",
        incident: "The rogue AI AEGIS mixed two supply ribbons. Mira restores their alternating order.",
        symptom: "The second number in each output pair comes from the wrong ribbon.",
        task: "Interleave the two lists: first `a[0]`, then `b[0]`, then `a[1]`, then `b[1]`, and so on. Keep every entry, including repeats.",
        input: "Read `n`, then the `n` integers of `a`, then the `n` integers of `b`.",
        output: "Print the `2 * n` interleaved integers separated by spaces.",
        example: "For `a = [1, 2]` and `b = [8, 9]`, print `1 8 2 9`.",
        constraints: "`1 <= n <= 50`. Every value is from `-100` to `100`.",
        defect: "Both outputs in a pair read from the first ribbon.",
        hints: ["Try ribbons with different first entries.", "Read the two output expressions inside one loop turn.", "The second output of each pair must use the entry at position `i` in the other ribbon."],
        c: `int n;
READ(n);
ARRAY(a,50);
ARRAY(b,50);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int i = 0; i < n; i++) {
    READ(b[i]);
}
for (int i = 0; i < n; i++) {
    OUT(a[i]);
    OUT(b[i]);
}`,
        py: `n = read_int()
a = [read_int() for _ in range(n)]
b = [read_int() for _ in range(n)]
result = []
for i in range(n):
    result.append(a[i])
    result.append(b[i])
print(*result)`,
        cbug: ["OUT(b[i]);", "OUT(a[i]);"],
        pybug: ["result.append(b[i])", "result.append(a[i])"],
        cases: [["2\n1 2\n8 9", "1 8 2 9"], ["1\n4\n4", "4 4"], ["3\n-1 0 2\n7 8 9", "-1 7 0 8 2 9"], ["1\n0\n5", "0 5"], ["2\n2 2\n3 3", "2 3 2 3"], ["4\n1 2 3 4\n4 3 2 1", "1 4 2 3 3 2 4 1"], ["2\n-100 100\n100 -100", "-100 100 100 -100"], ["3\n0 0 0\n0 0 0", "0 0 0 0 0 0"]],
        witness: 3,
        probe: ["2\n5 6\n-7 -8", "5 -7 6 -8"],
    },
    {
        title: "Marked Cargo Removal",
        difficulty: 11,
        guide: "`a` stores cargo labels and `drop` stores one removal flag per label. `kept` records how many labels have been printed.",
        incident: "AEGIS marked cargo for deletion. Patch keeps only the unmarked labels.",
        symptom: "The program keeps the marked cargo and removes the unmarked cargo.",
        task: "Remove entries whose matching flag is `1`. Keep entries whose flag is `0`, in their original order. If no entry remains, print `EMPTY`.",
        input: "Read `n`, then `n` integers in `a`, then `n` flags in `drop`.",
        output: "Print the kept labels separated by spaces, or exactly `EMPTY`.",
        example: "Labels `4 7 2` with flags `0 1 0` become `4 2`.",
        constraints: "`1 <= n <= 100`. Labels are from `-100` to `100`. Each flag is `0` or `1`.",
        defect: "The retention condition selects removal flags instead of keep flags.",
        hints: ["Compare the meaning of flags `0` and `1`.", "Check the condition controlling the output, rather than the input loops.", "Only a zero flag should let its matching cargo label reach the output."],
        c: `int n;
READ(n);
ARRAY(a,100);
ARRAY(drop,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int i = 0; i < n; i++) {
    READ(drop[i]);
}
int kept = 0;
for (int i = 0; i < n; i++) {
    if (drop[i] == 0) {
        OUT(a[i]);
        kept++;
    }
}
if (kept == 0) {
    SAY("EMPTY");
}`,
        py: `n = read_int()
a = [read_int() for _ in range(n)]
drop = [read_int() for _ in range(n)]
result = []
for i in range(n):
    if drop[i] == 0:
        result.append(a[i])
if result:
    print(*result)
else:
    print('EMPTY')`,
        cbug: ["drop[i] == 0", "drop[i] == 1"],
        pybug: ["drop[i] == 0", "drop[i] == 1"],
        cases: [["3\n4 7 2\n0 1 0", "4 2"], ["1\n8\n1", "EMPTY"], ["2\n5 6\n0 0", "5 6"], ["1\n0\n0", "0"], ["2\n-3 4\n1 1", "EMPTY"], ["4\n1 2 3 4\n1 0 1 0", "2 4"], ["3\n9 9 9\n0 1 1", "9"], ["2\n-100 100\n1 0", "100"]],
        witness: 3,
        probe: ["3\n6 7 8\n1 0 0", "7 8"],
    },
    {
        title: "Step Change Tape",
        difficulty: 12,
        guide: "`a` stores readings in time order. Output position `i - 1` describes the step ending at input position `i`.",
        incident: "AEGIS replaced changes with raw readings. Ishan recovers the change tape.",
        symptom: "The reported changes have their direction reversed.",
        task: "For each reading after the first, print that reading minus the immediately previous reading. Keep negative changes and zeros.",
        input: "Read `n`, then `n` readings in `a`.",
        output: "Print `n - 1` signed changes, in time order.",
        example: "Readings `5 9 2` give changes `4 -7`.",
        constraints: "`2 <= n <= 100`. Each reading is from `-100` to `100`.",
        defect: "The subtraction uses previous minus current instead of current minus previous.",
        hints: ["Try a step from a smaller reading to a larger reading.", "The sign must describe the movement from the earlier reading to the later one.", "In the change expression, the current reading is the starting term and the previous reading is subtracted."],
        c: `int n;
READ(n);
ARRAY(a,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int i = 1; i < n; i++) {
    int change = a[i] - a[i - 1];
    OUT(change);
}`,
        py: `n = read_int()
a = [read_int() for _ in range(n)]
result = []
for i in range(1, n):
    change = a[i] - a[i - 1]
    result.append(change)
print(*result)`,
        cbug: ["a[i] - a[i - 1]", "a[i - 1] - a[i]"],
        pybug: ["a[i] - a[i - 1]", "a[i - 1] - a[i]"],
        cases: [["3\n5 9 2", "4 -7"], ["2\n4 4", "0"], ["2\n1 3", "2"], ["2\n3 1", "-2"], ["3\n0 0 0", "0 0"], ["3\n-100 100 -100", "200 -200"], ["4\n-3 -1 0 4", "2 1 4"], ["4\n9 7 5 3", "-2 -2 -2"]],
        witness: 3,
        probe: ["4\n2 8 1 1", "6 -7 0"],
    },
    {
        title: "Missing Crate Insertion",
        difficulty: 14,
        guide: "`p` is an insertion position, not an existing crate to replace. The loop visits the gap after the last crate as well.",
        incident: "AEGIS removed a crate label. Mira inserts the recovered label into its recorded gap.",
        symptom: "The recovered crate can be inserted one position too late or disappear at the end.",
        task: "Insert `x` before position `p` in `a`. Positions start at `0`. Position `n` means append after all existing entries. Keep every original entry.",
        input: "Read `n`, `p`, and `x`, then the `n` labels of `a`.",
        output: "Print the `n + 1` labels after insertion.",
        example: "With `a = [4, 8, 9]`, `p = 1`, and `x = 6`, print `4 6 8 9`.",
        constraints: "`1 <= n <= 100`; `0 <= p <= n`. Labels and `x` are from `-100` to `100`.",
        defect: "The insertion condition compares the loop position to the following gap.",
        hints: ["Try inserting at the first gap and at the final gap.", "Identify which loop turn represents the gap named by `p`.", "The insertion branch should run on the turn whose position equals `p`, before that turn emits an original entry."],
        c: `int n;
int p;
int x;
READ(n);
READ(p);
READ(x);
ARRAY(a,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int i = 0; i <= n; i++) {
    if (i == p) {
        OUT(x);
    }
    if (i < n) {
        OUT(a[i]);
    }
}`,
        py: `n = read_int()
p = read_int()
x = read_int()
a = [read_int() for _ in range(n)]
result = []
for i in range(n + 1):
    if i == p:
        result.append(x)
    if i < n:
        result.append(a[i])
print(*result)`,
        cbug: ["i == p", "i == p + 1"],
        pybug: ["i == p:", "i == p + 1:"],
        cases: [["3 1 6\n4 8 9", "4 6 8 9"], ["1 0 3\n7", "3 7"], ["2 2 9\n1 2", "1 2 9"], ["1 1 0\n0", "0 0"], ["2 1 1\n1 1", "1 1 1"], ["2 0 -5\n-3 4", "-5 -3 4"], ["3 2 0\n8 6 2", "8 6 0 2"], ["2 1 99\n100 -100", "100 99 -100"]],
        witness: 3,
        probe: ["4 3 7\n2 5 8 11", "2 5 8 7 11"],
    },
    {
        title: "Local Mirror Strip",
        difficulty: 18,
        guide: "`left` and `right` walk inward through the requested interval. `temp` preserves one value while the pair is exchanged.",
        incident: "AEGIS mirrored the wrong part of a label strip. Patch repairs the interval mirror.",
        symptom: "Mirrored pairs become copies of one side and an original value is lost.",
        task: "Reverse only the entries from position `l` through position `r`, including both endpoints. Positions start at `0`. Leave every position outside that interval unchanged.",
        input: "Read `n`, `l`, and `r`, then the `n` integers of `a`.",
        output: "Print all `n` values after the interval reversal.",
        example: "For `1 2 3 4 5` with `l = 1` and `r = 3`, print `1 4 3 2 5`.",
        constraints: "`1 <= n <= 100`; `0 <= l <= r < n`. Values are from `-100` to `100`.",
        defect: "The second half of a swap reads an entry that has already been overwritten.",
        hints: ["Trace just one pair containing different values.", "Which variable still holds the original left value after the first assignment?", "Use the saved value when writing the right side of a pair; reading the updated left entry loses information."],
        c: `int n;
int l;
int r;
READ(n);
READ(l);
READ(r);
ARRAY(a,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
int left = l;
int right = r;
while (left < right) {
    int temp = a[left];
    a[left] = a[right];
    a[right] = temp;
    left++;
    right--;
}
for (int i = 0; i < n; i++) {
    OUT(a[i]);
}`,
        py: `n = read_int()
l = read_int()
r = read_int()
a = [read_int() for _ in range(n)]
left = l
right = r
while left < right:
    temp = a[left]
    a[left] = a[right]
    a[right] = temp
    left += 1
    right -= 1
print(*a)`,
        cbug: ["a[right] = temp;", "a[right] = a[left];"],
        pybug: ["a[right] = temp", "a[right] = a[left]"],
        cases: [["5 1 3\n1 2 3 4 5", "1 4 3 2 5"], ["1 0 0\n8", "8"], ["2 0 1\n6 9", "9 6"], ["4 0 3\n1 2 3 4", "4 3 2 1"], ["3 0 2\n2 2 2", "2 2 2"], ["3 1 2\n-5 0 7", "-5 7 0"], ["6 2 4\n0 1 2 3 4 5", "0 1 4 3 2 5"], ["2 1 1\n-100 100", "-100 100"]],
        witness: 3,
        probe: ["4 0 2\n3 7 8 4", "8 7 3 4"],
    },
    {
        title: "Two Lane Unpacking",
        difficulty: 16,
        guide: "`lane` chooses one of two passes. Within a pass, `i` moves by two, so entries from the same lane stay in input order.",
        incident: "AEGIS interleaved two inspection lanes. Ishan separates their labels.",
        symptom: "Both passes print the even positions, so the odd positions are missing.",
        task: "Print entries at positions `0, 2, 4, ...` first, then entries at positions `1, 3, 5, ...`. Positions start at `0`. Preserve order within each group.",
        input: "Read `n`, then the `n` labels in `a`.",
        output: "Print all `n` labels in the requested two-group order.",
        example: "The list `8 3 6 1 4` becomes `8 6 4 3 1`.",
        constraints: "`1 <= n <= 100`. Values are from `-100` to `100`.",
        defect: "Each lane pass starts at position zero instead of its lane number.",
        hints: ["Trace the first position visited during each pass.", "The two lanes must begin at different positions.", "The first visited position for a pass should come from `lane`; the step of two already preserves its lane."],
        c: `int n;
READ(n);
ARRAY(a,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int lane = 0; lane < 2; lane++) {
    for (int i = lane; i < n; i += 2) {
        OUT(a[i]);
    }
}`,
        py: `n = read_int()
a = [read_int() for _ in range(n)]
result = []
for lane in range(2):
    for i in range(lane, n, 2):
        result.append(a[i])
print(*result)`,
        cbug: ["int i = lane;", "int i = 0;"],
        pybug: ["range(lane, n, 2)", "range(0, n, 2)"],
        cases: [["5\n8 3 6 1 4", "8 6 4 3 1"], ["1\n9", "9"], ["2\n1 2", "1 2"], ["4\n1 2 3 4", "1 3 2 4"], ["3\n0 0 0", "0 0 0"], ["6\n-1 2 -3 4 -5 6", "-1 -3 -5 2 4 6"], ["2\n100 -100", "100 -100"], ["7\n7 8 9 10 11 12 13", "7 9 11 13 8 10 12"]],
        witness: 3,
        probe: ["6\n3 6 9 12 15 18", "3 9 15 6 12 18"],
    },
    {
        title: "Missing Reading Carry",
        difficulty: 17,
        guide: "`last` stores a usable reading seen so far. A value of `-1` marks a missing reading and is never a real measurement.",
        incident: "AEGIS erased measurements from a tape. Mira fills each gap from the previous usable reading.",
        symptom: "A missing reading turns into `-1` instead of inheriting the preceding measurement.",
        task: "Replace each `-1` with the nearest earlier nonmissing value. Keep each other value unchanged. The first value is always nonmissing.",
        input: "Read `n`, then the `n` readings in `a`.",
        output: "Print the `n` readings after filling every missing entry.",
        example: "The readings `4 -1 -1 7 -1` become `4 4 4 7 7`.",
        constraints: "`1 <= n <= 100`. Each entry is `-1` or from `0` to `100`. The first entry is not `-1`.",
        defect: "The remembered reading is updated on missing entries instead of real entries.",
        hints: ["Trace a missing entry immediately after a real reading.", "A missing marker must not replace the remembered usable value.", "Update `last` only when the current reading is not the missing marker."],
        c: `int n;
READ(n);
ARRAY(a,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
int last = a[0];
for (int i = 0; i < n; i++) {
    if (a[i] != -1) {
        last = a[i];
    }
    OUT(last);
}`,
        py: `n = read_int()
a = [read_int() for _ in range(n)]
last = a[0]
result = []
for value in a:
    if value != -1:
        last = value
    result.append(last)
print(*result)`,
        cbug: ["a[i] != -1", "a[i] == -1"],
        pybug: ["value != -1", "value == -1"],
        cases: [["5\n4 -1 -1 7 -1", "4 4 4 7 7"], ["1\n0", "0"], ["2\n5 -1", "5 5"], ["3\n1 2 3", "1 2 3"], ["4\n0 -1 0 -1", "0 0 0 0"], ["4\n100 -1 -1 -1", "100 100 100 100"], ["5\n2 -1 8 -1 3", "2 2 8 8 3"], ["10\n0 1 2 3 4 5 6 7 8 9", "0 1 2 3 4 5 6 7 8 9"]],
        witness: 3,
        probe: ["6\n6 -1 9 -1 -1 0", "6 6 9 9 9 0"],
    },
    {
        title: "Delta Tape Reconstruction",
        difficulty: 19,
        guide: "`current` is the latest reconstructed value. Each following `delta` describes the change from that value to the next one.",
        incident: "AEGIS hid the original tape but left its first value and changes. Patch reconstructs it.",
        symptom: "Later reconstructed values drift in the opposite direction from the recorded changes.",
        task: "Start with `first`. Each of the next `n - 1` integers is a signed change from the previous value. Recover and print all `n` original values.",
        input: "Read `n` and `first`, followed by exactly `n - 1` changes.",
        output: "Print the `n` reconstructed values, beginning with `first`.",
        example: "With `n = 4`, `first = 5`, and changes `2 -4 0`, print `5 7 3 3`.",
        constraints: "`1 <= n <= 100`. `first` and each change are from `-100` to `100`.",
        defect: "Each change is subtracted from the reconstructed value.",
        hints: ["Try a positive change from a known first value.", "A signed change already carries its direction.", "Combine `current` with the change by addition, allowing a negative change to reduce it."],
        c: `int n;
int first;
READ(n);
READ(first);
int current = first;
OUT(current);
for (int i = 1; i < n; i++) {
    int delta;
    READ(delta);
    current += delta;
    OUT(current);
}`,
        py: `n = read_int()
first = read_int()
current = first
result = [current]
for i in range(1, n):
    delta = read_int()
    current += delta
    result.append(current)
print(*result)`,
        cbug: ["current += delta;", "current -= delta;"],
        pybug: ["current += delta", "current -= delta"],
        cases: [["4 5\n2 -4 0", "5 7 3 3"], ["1 -3", "-3"], ["2 1\n3", "1 4"], ["3 0\n0 0", "0 0 0"], ["3 -100\n100 100", "-100 0 100"], ["4 8\n-1 -2 -3", "8 7 5 2"], ["2 100\n-100", "100 0"], ["5 2\n1 -1 1 -1", "2 3 2 3 2"]],
        witness: 3,
        probe: ["3 6\n-8 9", "6 -2 7"],
    },
    {
        title: "Trailing Padding Cutter",
        difficulty: 13,
        guide: "`length` marks the boundary between retained text and trailing padding. The guard stops the reader when no characters remain.",
        incident: "AEGIS padded a recovered name with underscores. Ishan finds the end of its usable text.",
        symptom: "Padding at the beginning of a name can cause usable text to be discarded, while padding at the end can survive.",
        task: "Remove only the consecutive underscores at the end of `word`, then print the remaining length. Keep underscores at the beginning or inside the retained text. A word made only of underscores has remaining length `0`.",
        input: "Read one nonempty `word` containing lowercase English letters and underscores.",
        output: "Print one integer: the length after removing trailing underscores.",
        example: "For `link___`, remove three trailing underscores and print `4`. For `a_b`, print `3`.",
        constraints: "`word` contains from `1` to `100` characters. Each character is a lowercase English letter or `_`.",
        defect: "The trimming condition inspects the first character rather than the current final retained character.",
        hints: ["Compare a leading underscore with a trailing underscore.", "Only the character next to the moving end boundary can justify trimming another position.", "Inspect the character immediately before `length` on each loop turn, while keeping the empty-text guard."],
        c: `TEXT(word);
WORD(word);
int length = LEN(word);
while (length > 0 && CHAR(word,length - 1) == '_') {
    length--;
}
OUT(length);`,
        py: `word = read_word()
length = len(word)
while length > 0 and word[length - 1] == '_':
    length -= 1
print(length)`,
        cbug: ["CHAR(word,length - 1)", "CHAR(word,0)"],
        pybug: ["word[length - 1]", "word[0]"],
        cases: [["link___", "4"], ["a_b", "3"], ["__a_", "3"], ["____", "0"], ["_ab__", "3"], ["a", "1"], ["ab_c___", "4"], ["z_", "1"]],
        witness: 3,
        probe: ["___x__", "4"],
    },
    {
        title: "Transcript Difference Markers",
        difficulty: 13,
        guide: "`a` and `b` are equal-length words. `found` records whether any differing position has been output.",
        incident: "AEGIS altered a transcript. Mira marks every changed letter position.",
        symptom: "The program reports matching positions instead of changed positions.",
        task: "Compare the two words at matching positions. Print every position where their letters differ, from left to right. Positions start at `0`. If all letters match, print `-1`.",
        input: "Read two nonempty words `a` and `b` of equal length.",
        output: "Print the differing positions separated by spaces, or `-1` if there are none.",
        example: "For `a = code` and `b = cope`, only position `2` differs, so print `2`.",
        constraints: "Both words contain from `1` to `100` lowercase English letters and have equal length.",
        defect: "The difference check accepts equal letters.",
        hints: ["Try a pair with exactly one changed letter.", "The output branch should describe a difference, not agreement.", "At each position, output only when the two characters are unequal."],
        c: `TEXT(a);
TEXT(b);
WORD(a);
WORD(b);
int found = 0;
for (int i = 0; i < LEN(a); i++) {
    if (CHAR(a,i) != CHAR(b,i)) {
        OUT(i);
        found = 1;
    }
}
if (found == 0) {
    OUT(-1);
}`,
        py: `a = read_word()
b = read_word()
result = []
for i in range(len(a)):
    if a[i] != b[i]:
        result.append(i)
if result:
    print(*result)
else:
    print(-1)`,
        cbug: ["CHAR(a,i) != CHAR(b,i)", "CHAR(a,i) == CHAR(b,i)"],
        pybug: ["a[i] != b[i]", "a[i] == b[i]"],
        cases: [["code cope", "2"], ["a a", "-1"], ["ab ac", "1"], ["abc xyz", "0 1 2"], ["abc abc", "-1"], ["zzza zzzb", "3"], ["abcd xbcy", "0 3"], ["a z", "0"]],
        witness: 3,
        probe: ["robot robit", "3"],
    },
    {
        title: "Wildcard Badge Stencil",
        difficulty: 18,
        guide: "`pattern` is a stencil and `word` is the badge under it. A question mark is a free position. `ok` remembers whether any position has failed.",
        incident: "AEGIS damaged the badge stencil. Patch checks the surviving literal letters.",
        symptom: "A question mark can reject a badge even though it should accept any letter.",
        task: "A question mark `?` in `pattern` matches any one letter at that same position. Every other character must equal the corresponding letter of `word`. Print whether all positions match. A question mark never matches zero or several letters.",
        input: "Read `pattern`, then `word`. They have equal length.",
        output: "Print `YES` for a match, otherwise `NO`.",
        example: "The pattern `c?t` matches `cat`, so print `YES`.",
        constraints: "The length is from `1` to `100`. `pattern` contains lowercase English letters or `?`; `word` contains lowercase English letters.",
        defect: "The mismatch condition rejects wildcard positions regardless of their matching rule.",
        hints: ["Try a pattern made entirely of question marks.", "A failure needs both a literal stencil character and a different badge letter.", "The mismatch test must require that the pattern character is not a wildcard as well as being unequal to the word character."],
        c: `TEXT(pattern);
TEXT(word);
WORD(pattern);
WORD(word);
int ok = 1;
for (int i = 0; i < LEN(word); i++) {
    if (CHAR(pattern,i) != '?' && CHAR(pattern,i) != CHAR(word,i)) {
        ok = 0;
    }
}
if (ok == 1) {
    SAY("YES");
} else {
    SAY("NO");
}`,
        py: `pattern = read_word()
word = read_word()
ok = True
for i in range(len(word)):
    if pattern[i] != '?' and pattern[i] != word[i]:
        ok = False
if ok:
    print('YES')
else:
    print('NO')`,
        cbug: ["!= '?' &&", "!= '?' ||"],
        pybug: ["!= '?' and", "!= '?' or"],
        cases: [["c?t cat", "YES"], ["dog dig", "NO"], ["? z", "YES"], ["abc abc", "YES"], ["??? abc", "YES"], ["a?? axx", "YES"], ["?b? aaa", "NO"], ["z z", "YES"]],
        witness: 3,
        probe: ["r?b?t robot", "YES"],
    },
    {
        title: "Ordered Rescue Letters",
        difficulty: 23,
        guide: "`next` is the next needed letter position in `key`. The scan moves through `word` once, using a letter only if it matches that next need.",
        incident: "AEGIS scattered a rescue key through a message. Ishan checks whether its letters remain in order.",
        symptom: "One matching letter can make the program forget earlier progress through the key.",
        task: "Decide whether `key` can be formed by deleting zero or more letters from `word` without changing the order of the remaining letters. Every position may be used at most once. Letters in between may be skipped.",
        input: "Read the nonempty words `word` and `key`.",
        output: "Print `YES` if the ordered key is present, otherwise `NO`.",
        example: "The word `axbyc` contains `abc` in order. Print `YES`. The word `cba` does not contain `abc` in order.",
        constraints: "Both words contain from `1` to `100` lowercase English letters.",
        defect: "A match resets progress to one instead of advancing the saved position.",
        hints: ["Try a key with three different letters in order.", "The saved position is a progress count, not just a matched/not-matched flag.", "Each matching letter advances the existing key position by one; it must preserve earlier progress."],
        c: `TEXT(word);
TEXT(key);
WORD(word);
WORD(key);
int next = 0;
for (int i = 0; i < LEN(word); i++) {
    if (next < LEN(key) && CHAR(word,i) == CHAR(key,next)) {
        next++;
    }
}
if (next == LEN(key)) {
    SAY("YES");
} else {
    SAY("NO");
}`,
        py: `word = read_word()
key = read_word()
next = 0
for ch in word:
    if next < len(key) and ch == key[next]:
        next += 1
if next == len(key):
    print('YES')
else:
    print('NO')`,
        cbug: ["next++;", "next = 1;"],
        pybug: ["next += 1", "next = 1"],
        cases: [["axbyc abc", "YES"], ["cba abc", "NO"], ["ab ab", "YES"], ["aaaa aaa", "YES"], ["a aa", "NO"], ["xyz z", "YES"], ["abc q", "NO"], ["abcabc aabbcc", "NO"]],
        witness: 3,
        probe: ["rxeqsqcquqe rescue", "YES"],
    },
    {
        title: "Packed Run Expansion",
        difficulty: 20,
        guide: "Each record contains `value` and `repeat`. The outer loop reads records; the inner loop emits the copies for one record.",
        incident: "AEGIS shortened an archive to run records. Mira expands every recorded copy.",
        symptom: "Each record emits one fewer copy than requested.",
        task: "For each record in input order, output `repeat` copies of `value`. Adjacent records remain separate instructions even if their values match.",
        input: "Read `m`, then `m` pairs `value repeat`.",
        output: "Print every expanded value in order, separated by spaces.",
        example: "Records `(4, 2)` and `(7, 3)` expand to `4 4 7 7 7`.",
        constraints: "`1 <= m <= 20`; `1 <= repeat <= 5`. Each value is from `-100` to `100`.",
        defect: "The copy loop stops before the final required copy.",
        hints: ["Try a record requesting exactly one copy.", "Compare the number of inner-loop turns with `repeat`.", "Starting from zero, the copy loop needs to visit every counter value below `repeat`."],
        c: `int m;
READ(m);
for (int i = 0; i < m; i++) {
    int value;
    int repeat;
    READ(value);
    READ(repeat);
    for (int copy = 0; copy < repeat; copy++) {
        OUT(value);
    }
}`,
        py: `m = read_int()
result = []
for _ in range(m):
    value = read_int()
    repeat = read_int()
    for copy in range(repeat):
        result.append(value)
print(*result)`,
        cbug: ["copy < repeat;", "copy < repeat - 1;"],
        pybug: ["range(repeat):", "range(repeat - 1):"],
        cases: [["2\n4 2\n7 3", "4 4 7 7 7"], ["1\n0 1", "0"], ["1\n9 1", "9"], ["2\n3 1\n3 2", "3 3 3"], ["1\n-100 5", "-100 -100 -100 -100 -100"], ["3\n1 2\n2 1\n1 1", "1 1 2 1"], ["2\n100 5\n-100 5", "100 100 100 100 100 -100 -100 -100 -100 -100"], ["3\n0 2\n0 3\n4 1", "0 0 0 0 0 4"]],
        witness: 3,
        probe: ["2\n6 4\n2 2", "6 6 6 6 2 2"],
    },
    {
        title: "Addressed Shelf Picks",
        difficulty: 14,
        guide: "`pick` is a list of source positions. Its order is the requested output order; the same source position may occur more than once.",
        incident: "AEGIS scrambled shelf requests. Patch follows the supplied position list exactly.",
        symptom: "The program prints the request positions instead of the labels stored at those positions.",
        task: "For each requested position, output the value of `a` at that position. Positions start at `0`. Keep requests in their given order, including repeated requests.",
        input: "Read `n` and `m`, then `n` values in `a`, then `m` valid positions in `pick`.",
        output: "Print the `m` requested values separated by spaces.",
        example: "For `a = [7, 4, 9]` and requests `2 0 2`, print `9 7 9`.",
        constraints: "`1 <= n <= 100`; `1 <= m <= 100`; `0 <= pick[i] < n`. Values are from `-100` to `100`.",
        defect: "The output uses a position directly instead of looking up its value.",
        hints: ["Choose shelf labels that differ from their position numbers.", "A request identifies a shelf; it is not itself the label to print.", "Use each entry of `pick` as an index into `a` before outputting it."],
        c: `int n;
int m;
READ(n);
READ(m);
ARRAY(a,100);
ARRAY(pick,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int i = 0; i < m; i++) {
    READ(pick[i]);
}
for (int i = 0; i < m; i++) {
    int position = pick[i];
    OUT(a[position]);
}`,
        py: `n = read_int()
m = read_int()
a = [read_int() for _ in range(n)]
pick = [read_int() for _ in range(m)]
result = []
for i in range(m):
    position = pick[i]
    result.append(a[position])
print(*result)`,
        cbug: ["OUT(a[position]);", "OUT(position);"],
        pybug: ["result.append(a[position])", "result.append(position)"],
        cases: [["3 3\n7 4 9\n2 0 2", "9 7 9"], ["1 1\n0\n0", "0"], ["2 2\n8 6\n1 0", "6 8"], ["3 1\n-1 0 1\n0", "-1"], ["2 4\n5 7\n0 0 1 1", "5 5 7 7"], ["4 4\n1 2 3 4\n3 2 1 0", "4 3 2 1"], ["1 3\n-100\n0 0 0", "-100 -100 -100"], ["3 3\n0 1 2\n0 1 2", "0 1 2"]],
        witness: 3,
        probe: ["4 2\n12 14 16 18\n2 0", "16 12"],
    },
    {
        title: "Vertical Log Reader",
        difficulty: 12,
        guide: "The flat array `table` stores complete rows consecutively. `row * cols` reaches a row start, and `column` selects an entry within it.",
        incident: "AEGIS mixed row and column addresses. Ishan extracts one vertical log.",
        symptom: "The output repeatedly reads the same row instead of moving down the selected column.",
        task: "Print all values in the requested column, from top row to bottom row. Row and column positions start at `0`.",
        input: "Read `rows`, `cols`, and `column`, then `rows * cols` integers in row order.",
        output: "Print `rows` integers: the selected column from top to bottom.",
        example: "For rows `1 2 3` and `4 5 6`, column `1` gives `2 5`.",
        constraints: "`1 <= rows, cols <= 10`; `0 <= column < cols`. Values are from `-100` to `100`.",
        defect: "The flat position uses the column number as the row number.",
        hints: ["Try a table with at least two different rows.", "Separate movement between rows from movement within a row.", "The multiple of `cols` must come from the changing row position, while the column offset stays fixed."],
        c: `int rows;
int cols;
int column;
READ(rows);
READ(cols);
READ(column);
ARRAY(table,100);
for (int i = 0; i < rows * cols; i++) {
    READ(table[i]);
}
for (int row = 0; row < rows; row++) {
    int position = row * cols + column;
    OUT(table[position]);
}`,
        py: `rows = read_int()
cols = read_int()
column = read_int()
table = [read_int() for _ in range(rows * cols)]
result = []
for row in range(rows):
    position = row * cols + column
    result.append(table[position])
print(*result)`,
        cbug: ["row * cols + column", "row * cols"],
        pybug: ["row * cols + column", "row * cols"],
        cases: [["2 3 1\n1 2 3\n4 5 6", "2 5"], ["1 1 0\n8", "8"], ["3 2 1\n4 5\n6 7\n8 9", "5 7 9"], ["1 3 0\n9 8 7", "9"], ["3 3 2\n1 2 3\n4 5 6\n7 8 9", "3 6 9"], ["2 2 1\n0 0\n0 0", "0 0"], ["2 4 1\n-1 -2 -3 -4\n5 6 7 8", "-2 6"], ["4 2 0\n1 2\n3 4\n5 6\n7 8", "1 3 5 7"]],
        witness: 3,
        probe: ["3 2 1\n8 6\n4 2\n0 -2", "6 2 -2"],
    },
    {
        title: "Transposed Control Sheet",
        difficulty: 24,
        guide: "`table` stores original rows consecutively. The output loops visit a column first, then walk down that column to form one transposed row.",
        incident: "AEGIS turned a control sheet sideways. Mira restores the transpose reader.",
        symptom: "The traversal addresses a row-major table using the transposed row width.",
        task: "Transpose the table: original entry at row `r`, column `c` becomes entry at row `c`, column `r`. Print the transposed table in row order. Do not reverse either direction.",
        input: "Read `rows` and `cols`, then `rows * cols` integers in original row order.",
        output: "Print all entries in transposed row order, separated by spaces. Line breaks between rows are optional.",
        example: "Original rows `1 2 3` and `4 5 6` transpose to rows `1 4`, `2 5`, and `3 6`. Print `1 4 2 5 3 6`.",
        constraints: "`1 <= rows, cols <= 10`. Values are from `-100` to `100`.",
        defect: "The source address uses transposed dimensions instead of original dimensions.",
        hints: ["Use a nonsquare table so row and column widths differ.", "The source array still contains the original row layout.", "Read each source position using the original row number times the original column count, then its original column offset."],
        c: `int rows;
int cols;
READ(rows);
READ(cols);
ARRAY(table,100);
for (int i = 0; i < rows * cols; i++) {
    READ(table[i]);
}
for (int column = 0; column < cols; column++) {
    for (int row = 0; row < rows; row++) {
        int position = row * cols + column;
        OUT(table[position]);
    }
}`,
        py: `rows = read_int()
cols = read_int()
table = [read_int() for _ in range(rows * cols)]
result = []
for column in range(cols):
    for row in range(rows):
        position = row * cols + column
        result.append(table[position])
print(*result)`,
        cbug: ["row * cols + column", "column * rows + row"],
        pybug: ["row * cols + column", "column * rows + row"],
        cases: [["2 3\n1 2 3\n4 5 6", "1 4 2 5 3 6"], ["1 1\n9", "9"], ["2 2\n1 2\n3 4", "1 3 2 4"], ["3 1\n4 5 6", "4 5 6"], ["1 4\n9 8 7 6", "9 8 7 6"], ["2 2\n0 0\n0 0", "0 0 0 0"], ["3 2\n-1 -2\n-3 -4\n-5 -6", "-1 -3 -5 -2 -4 -6"], ["2 4\n1 2 3 4\n5 6 7 8", "1 5 2 6 3 7 4 8"]],
        witness: 3,
        probe: ["3 3\n9 8 7\n6 5 4\n3 2 1", "9 6 3 8 5 2 7 4 1"],
    },
    {
        title: "Snake Row Patrol",
        difficulty: 18,
        guide: "Rows are numbered from `0`. `step` always increases, while `column` chooses the direction within the current row.",
        incident: "AEGIS reversed the wrong patrol rows. Patch restores the alternating route through a table.",
        symptom: "Each row is read in the direction intended for the other kind of row.",
        task: "Read row `0` left to right, row `1` right to left, row `2` left to right, and continue alternating. Visit rows top to bottom and every cell exactly once.",
        input: "Read `rows` and `cols`, followed by `rows * cols` values in ordinary row order.",
        output: "Print the values in the alternating row traversal, separated by spaces.",
        example: "Rows `1 2 3` and `4 5 6` produce `1 2 3 6 5 4`.",
        constraints: "`1 <= rows, cols <= 10`. Values are from `-100` to `100`.",
        defect: "The reversal branch selects even rows rather than odd rows.",
        hints: ["The first row must keep its original direction.", "Check the row parity used by the reversal branch.", "Only rows whose zero-based row number is odd need the mirrored column position."],
        c: `int rows;
int cols;
READ(rows);
READ(cols);
ARRAY(table,100);
for (int i = 0; i < rows * cols; i++) {
    READ(table[i]);
}
for (int row = 0; row < rows; row++) {
    for (int step = 0; step < cols; step++) {
        int column = step;
        if (row % 2 == 1) {
            column = cols - 1 - step;
        }
        OUT(table[row * cols + column]);
    }
}`,
        py: `rows = read_int()
cols = read_int()
table = [read_int() for _ in range(rows * cols)]
result = []
for row in range(rows):
    for step in range(cols):
        column = step
        if row % 2 == 1:
            column = cols - 1 - step
        result.append(table[row * cols + column])
print(*result)`,
        cbug: ["row % 2 == 1", "row % 2 == 0"],
        pybug: ["row % 2 == 1", "row % 2 == 0"],
        cases: [["2 3\n1 2 3\n4 5 6", "1 2 3 6 5 4"], ["1 1\n7", "7"], ["1 2\n4 9", "4 9"], ["3 1\n1 2 3", "1 2 3"], ["3 2\n1 2\n3 4\n5 6", "1 2 4 3 5 6"], ["2 2\n0 0\n0 0", "0 0 0 0"], ["4 3\n1 2 3\n4 5 6\n7 8 9\n10 11 12", "1 2 3 6 5 4 7 8 9 12 11 10"], ["2 2\n-100 100\n3 -3", "-100 100 -3 3"]],
        witness: 3,
        probe: ["3 3\n0 1 2\n3 4 5\n6 7 8", "0 1 2 5 4 3 6 7 8"],
    },
    {
        title: "Shared Header Length",
        difficulty: 16,
        guide: "`limit` prevents either word from being read past its end. `length` counts consecutive matching letters from the beginning only.",
        incident: "AEGIS changed file headers. Ishan measures the part both headers still share at the start.",
        symptom: "The reader continues past the first differing letter and counts letters later in the words.",
        task: "Print the length of the longest common prefix of `a` and `b`: the consecutive matching letters starting at position `0`. Stop at the first difference or at the end of either word.",
        input: "Read two nonempty words `a` and `b`.",
        output: "Print one integer: the common prefix length.",
        example: "The words `relay` and `related` share the prefix `rela`, so print `4`.",
        constraints: "Each word contains from `1` to `100` lowercase English letters.",
        defect: "The prefix loop no longer stops when corresponding letters differ.",
        hints: ["Try words that agree at the start but disagree in the middle.", "Staying inside both words is necessary but does not itself establish a shared prefix.", "The loop needs to keep checking letter equality at the current prefix end before extending the prefix."],
        c: `TEXT(a);
TEXT(b);
WORD(a);
WORD(b);
int limit = LEN(a);
if (LEN(b) < limit) {
    limit = LEN(b);
}
int length = 0;
while (length < limit && CHAR(a,length) == CHAR(b,length)) {
    length++;
}
OUT(length);`,
        py: `a = read_word()
b = read_word()
limit = min(len(a), len(b))
length = 0
while length < limit and a[length] == b[length]:
    length += 1
print(length)`,
        cbug: ["length < limit && CHAR(a,length) == CHAR(b,length)", "length < limit"],
        pybug: ["length < limit and a[length] == b[length]", "length < limit"],
        cases: [["relay related", "4"], ["abc abc", "3"], ["ab ac", "1"], ["a b", "0"], ["a abcd", "1"], ["abcdef abc", "3"], ["abca abda", "2"], ["zz zzzz", "2"]],
        witness: 3,
        probe: ["patch patrol", "3"],
    },
    {
        title: "Damaged Span Removal",
        difficulty: 15,
        guide: "`l` and `r` name an inclusive span. The output loop considers each original position without changing the source array.",
        incident: "AEGIS marked a damaged span in a tape. Mira removes exactly that span.",
        symptom: "The labels at the two span endpoints survive when they should be removed.",
        task: "Delete all entries from position `l` through position `r`, including both endpoints. Keep every other entry in original order. Positions start at `0`. Print `EMPTY` if nothing remains.",
        input: "Read `n`, `l`, and `r`, then the `n` values in `a`.",
        output: "Print the remaining values separated by spaces, or `EMPTY`.",
        example: "Removing positions `1` through `3` from `5 6 7 8 9` leaves `5 9`.",
        constraints: "`1 <= n <= 100`; `0 <= l <= r < n`. Values are from `-100` to `100`.",
        defect: "The retention test includes positions equal to the deletion endpoints.",
        hints: ["Try deleting a span consisting of just one position.", "The endpoint positions belong to the removed span.", "A kept position must be strictly before `l` or strictly after `r`."],
        c: `int n;
int l;
int r;
READ(n);
READ(l);
READ(r);
ARRAY(a,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
int kept = 0;
for (int i = 0; i < n; i++) {
    if (i < l || i > r) {
        OUT(a[i]);
        kept++;
    }
}
if (kept == 0) {
    SAY("EMPTY");
}`,
        py: `n = read_int()
l = read_int()
r = read_int()
a = [read_int() for _ in range(n)]
result = []
for i in range(n):
    if i < l or i > r:
        result.append(a[i])
if result:
    print(*result)
else:
    print('EMPTY')`,
        cbug: ["i < l || i > r", "i <= l || i >= r"],
        pybug: ["i < l or i > r", "i <= l or i >= r"],
        cases: [["5 1 3\n5 6 7 8 9", "5 9"], ["1 0 0\n4", "EMPTY"], ["3 1 1\n1 2 3", "1 3"], ["2 0 1\n9 8", "EMPTY"], ["4 0 1\n1 2 3 4", "3 4"], ["4 2 3\n1 2 3 4", "1 2"], ["3 1 2\n0 0 0", "0"], ["3 0 0\n-100 0 100", "0 100"]],
        witness: 3,
        probe: ["5 2 3\n6 7 8 9 10", "6 7 10"],
    },
    {
        title: "Ascending Shelf Passes",
        difficulty: 28,
        guide: "For each `start`, `best` identifies the smallest remaining entry. One exchange places that entry at the current start of the unfinished suffix.",
        incident: "AEGIS reversed the shelf-order rule. Patch restores the supplied selection-sort passes.",
        symptom: "The passes arrange labels from largest to smallest.",
        task: "Sort all input values from smallest to largest, keeping every occurrence. Use the supplied passes: select the smallest entry in the unfinished suffix and place it at that suffix start.",
        input: "Read `n`, then the `n` integers of `a`.",
        output: "Print all `n` integers in nondecreasing order.",
        example: "The list `4 1 4 2` must become `1 2 4 4`.",
        constraints: "`1 <= n <= 100`. Values are from `-100` to `100`.",
        defect: "The candidate comparison selects the largest remaining entry.",
        hints: ["Watch which value is selected for the first output position.", "The swap machinery can be correct even when the chosen candidate is wrong.", "Replace the candidate only when the scanned entry is smaller than the currently chosen entry."],
        c: `int n;
READ(n);
ARRAY(a,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
for (int start = 0; start < n; start++) {
    int best = start;
    for (int j = start + 1; j < n; j++) {
        if (a[j] < a[best]) {
            best = j;
        }
    }
    int temp = a[start];
    a[start] = a[best];
    a[best] = temp;
}
for (int i = 0; i < n; i++) {
    OUT(a[i]);
}`,
        py: `n = read_int()
a = [read_int() for _ in range(n)]
for start in range(n):
    best = start
    for j in range(start + 1, n):
        if a[j] < a[best]:
            best = j
    temp = a[start]
    a[start] = a[best]
    a[best] = temp
print(*a)`,
        cbug: ["a[j] < a[best]", "a[j] > a[best]"],
        pybug: ["a[j] < a[best]", "a[j] > a[best]"],
        cases: [["4\n4 1 4 2", "1 2 4 4"], ["1\n7", "7"], ["2\n2 1", "1 2"], ["3\n1 2 3", "1 2 3"], ["3\n3 2 1", "1 2 3"], ["3\n0 0 0", "0 0 0"], ["4\n-100 100 0 -1", "-100 -1 0 100"], ["5\n9 -3 9 -3 2", "-3 -3 2 9 9"]],
        witness: 3,
        probe: ["6\n6 1 5 2 4 3", "1 2 3 4 5 6"],
    },
    {
        title: "Dictionary Gate Order",
        difficulty: 26,
        guide: "`result` starts undecided at `0`. The first unequal letter decides the order. Word lengths matter only if no letter comparison decides it.",
        incident: "AEGIS rewrote a dictionary gate. Ishan restores ordinary alphabetical ordering.",
        symptom: "When letters differ early, a later difference can override the correct order.",
        task: "Compare `a` and `b` in dictionary order. The first differing letters decide using `a` before `b` before ... before `z`. If one word is a prefix of the other, the shorter word comes first. Identical words are equal.",
        input: "Read words `a` and `b`.",
        output: "Print `LESS` if `a` comes first, `GREATER` if `b` comes first, or `EQUAL` if they are identical.",
        example: "For `az` and `ba`, print `LESS`: their first letters decide the order.",
        constraints: "Each word contains from `1` to `100` lowercase English letters.",
        defect: "The scan continues replacing a decision after the first unequal letters.",
        hints: ["Try words whose first and last differences favor opposite orders.", "Dictionary order is decided by the earliest difference.", "Only compare more letter pairs while `result` still indicates that no earlier pair decided the order."],
        c: `TEXT(a);
TEXT(b);
WORD(a);
WORD(b);
int limit = LEN(a);
if (LEN(b) < limit) {
    limit = LEN(b);
}
int result = 0;
for (int i = 0; i < limit; i++) {
    if (result == 0) {
        if (CHAR(a,i) < CHAR(b,i)) {
            result = -1;
        } else if (CHAR(a,i) > CHAR(b,i)) {
            result = 1;
        }
    }
}
if (result == 0) {
    if (LEN(a) < LEN(b)) {
        result = -1;
    } else if (LEN(a) > LEN(b)) {
        result = 1;
    }
}
if (result < 0) {
    SAY("LESS");
} else if (result > 0) {
    SAY("GREATER");
} else {
    SAY("EQUAL");
}`,
        py: `a = read_word()
b = read_word()
limit = min(len(a), len(b))
result = 0
for i in range(limit):
    if result == 0:
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
    print('EQUAL')`,
        cbug: ["if (result == 0) {\n        if (CHAR(a,i)", "if (result >= -1) {\n        if (CHAR(a,i)"],
        pybug: ["if result == 0:\n        if a[i]", "if result >= -1:\n        if a[i]"],
        cases: [["az ba", "LESS"], ["cat cat", "EQUAL"], ["za az", "GREATER"], ["a ab", "LESS"], ["abc ab", "GREATER"], ["aa ab", "LESS"], ["zy aa", "GREATER"], ["x x", "EQUAL"]],
        witness: 3,
        probe: ["mza nab", "LESS"],
    },
    {
        title: "Single Pass Sensor Smoothing",
        difficulty: 32,
        guide: "`a` keeps the original readings and `result` holds the new readings. Interior positions use a three-entry average; endpoints are copied separately.",
        incident: "AEGIS let repaired readings contaminate later repairs. Mira restores one simultaneous smoothing pass.",
        symptom: "A changed reading affects its next neighbor during the same pass.",
        task: "Leave the first and last readings unchanged. Replace every interior reading with the integer part of the average of its original left neighbor, itself, and its original right neighbor. All replacements happen simultaneously using the input readings. Values are nonnegative, so discard the fractional part.",
        input: "Read `n`, followed by the `n` readings of `a`.",
        output: "Print all `n` readings after exactly one smoothing pass.",
        example: "For `0 9 0 9`, the interior averages are `3` and `6`. Print `0 3 6 9`.",
        constraints: "`2 <= n <= 100`. Each reading is from `0` to `100`.",
        defect: "The left term is read from the partially updated result rather than the original input.",
        hints: ["Use four readings so a changed interior result has another interior neighbor.", "Every average in this pass must see the same original tape.", "Read all three terms from `a`; a value already written into `result` belongs to the next tape."],
        c: `int n;
READ(n);
ARRAY(a,100);
ARRAY(result,100);
for (int i = 0; i < n; i++) {
    READ(a[i]);
}
result[0] = a[0];
result[n - 1] = a[n - 1];
for (int i = 1; i + 1 < n; i++) {
    result[i] = (a[i - 1] + a[i] + a[i + 1]) / 3;
}
for (int i = 0; i < n; i++) {
    OUT(result[i]);
}`,
        py: `n = read_int()
a = [read_int() for _ in range(n)]
result = [0] * n
result[0] = a[0]
result[n - 1] = a[n - 1]
for i in range(1, n - 1):
    result[i] = (a[i - 1] + a[i] + a[i + 1]) // 3
print(*result)`,
        cbug: ["(a[i - 1] + a[i] + a[i + 1])", "(result[i - 1] + a[i] + a[i + 1])"],
        pybug: ["(a[i - 1] + a[i] + a[i + 1])", "(result[i - 1] + a[i] + a[i + 1])"],
        cases: [["4\n0 9 0 9", "0 3 6 9"], ["2\n4 8", "4 8"], ["4\n0 12 0 0", "0 4 4 0"], ["4\n3 3 3 3", "3 3 3 3"], ["2\n0 0", "0 0"], ["4\n100 0 0 100", "100 33 33 100"], ["5\n1 2 5 8 13", "1 2 5 8 13"], ["3\n9 0 9", "9 6 9"]],
        witness: 3,
        probe: ["5\n8 0 16 0 8", "8 8 5 8 8"],
    },
    {
        title: "Two Token Packet Folding",
        difficulty: 29,
        guide: "`i` names the next unread input entry. `match` checks a pair at that position. Replacement values are output directly and are never scanned again.",
        incident: "AEGIS made a packet folder reuse consumed tokens. Patch restores its left-to-right scan.",
        symptom: "The second token of a folded pair is emitted again.",
        task: "Scan left to right. If the next two unread values are `x` followed by `y`, replace that pair with one `z` and consume both. Otherwise output the next value unchanged and consume it. Do not rescan replacements. Pairs cannot overlap, even when `x` equals `y`.",
        input: "Read `n`, `x`, `y`, and `z`, then the `n` values in `a`.",
        output: "Print the folded sequence separated by spaces.",
        example: "For `a = [1, 2, 1, 2, 3]`, `x = 1`, `y = 2`, and `z = 9`, print `9 9 3`.",
        constraints: "`1 <= n <= 100`. All values, including `x`, `y`, and `z`, are from `-100` to `100`.",
        defect: "A successful fold consumes only its first token.",
        hints: ["Trace the next unread position after one successful fold.", "Both original members of a matched pair have been consumed.", "In the matching branch, advance past two input positions. The unmatched branch still consumes only one."],
        c: `int n;
int x;
int y;
int z;
READ(n);
READ(x);
READ(y);
READ(z);
ARRAY(a,100);
for (int j = 0; j < n; j++) {
    READ(a[j]);
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
        OUT(z);
        i += 2;
    } else {
        OUT(a[i]);
        i++;
    }
}`,
        py: `n = read_int()
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
        i += 2
    else:
        result.append(a[i])
        i += 1
print(*result)`,
        cbug: ["i += 2;", "i += 1;"],
        pybug: ["i += 2", "i += 1"],
        cases: [["5 1 2 9\n1 2 1 2 3", "9 9 3"], ["1 4 4 8\n4", "4"], ["2 5 6 0\n5 6", "0"], ["3 2 2 7\n2 2 2", "7 2"], ["3 1 2 9\n1 3 2", "1 3 2"], ["4 0 1 0\n0 1 0 1", "0 0"], ["3 -1 -2 -3\n-1 -2 3", "-3 3"], ["4 7 7 7\n7 7 7 7", "7 7"]],
        witness: 3,
        probe: ["5 3 4 5\n3 4 3 4 3", "5 5 3"],
    },
    {
        title: "Settling Storage Columns",
        difficulty: 35,
        guide: "`table` is the original grid and `settled` starts empty. For each column, `write` marks the next free destination from the bottom. Reading bottom to top keeps vertical order.",
        incident: "AEGIS left floating crates in storage. Ishan repairs the supplied column-settling pass.",
        symptom: "Crates remain at their old heights instead of falling into empty cells.",
        task: "Treat `0` as an empty cell and positive values as crate labels. Independently slide all crates in each column downward until no empty cells remain below a crate. Preserve the top-to-bottom order of crates in each column. Crates never move between columns.",
        input: "Read `rows` and `cols`, then `rows * cols` cell values in row order.",
        output: "Print the settled grid in row order, separated by spaces. Line breaks between rows are optional.",
        example: "A one-column grid `4 0 7 0` settles to `0 0 4 7`.",
        constraints: "`1 <= rows, cols <= 10`. Each cell is from `0` to `9`.",
        defect: "A crate is written back to its source row rather than to the next free bottom destination.",
        hints: ["Use one column with a crate above an empty cell.", "The read row and the next free destination row describe different things.", "Keep the source row in the read expression, but use the destination row tracked by `write` for the write expression."],
        c: `int rows;
int cols;
READ(rows);
READ(cols);
ARRAY(table,100);
ARRAY(settled,100);
for (int i = 0; i < rows * cols; i++) {
    READ(table[i]);
}
for (int column = 0; column < cols; column++) {
    int write = rows - 1;
    for (int row = rows - 1; row >= 0; row--) {
        if (table[row * cols + column] != 0) {
            settled[write * cols + column] = table[row * cols + column];
            write--;
        }
    }
}
for (int i = 0; i < rows * cols; i++) {
    OUT(settled[i]);
}`,
        py: `rows = read_int()
cols = read_int()
table = [read_int() for _ in range(rows * cols)]
settled = [0] * (rows * cols)
for column in range(cols):
    write = rows - 1
    for row in range(rows - 1, -1, -1):
        if table[row * cols + column] != 0:
            settled[write * cols + column] = table[row * cols + column]
            write -= 1
print(*settled)`,
        cbug: ["settled[write * cols + column]", "settled[row * cols + column]"],
        pybug: ["settled[write * cols + column]", "settled[row * cols + column]"],
        cases: [["4 1\n4\n0\n7\n0", "0 0 4 7"], ["1 1\n0", "0"], ["2 1\n8\n0", "0 8"], ["1 3\n1 0 2", "1 0 2"], ["2 2\n1 2\n3 4", "1 2 3 4"], ["3 2\n1 0\n0 2\n3 0", "0 0 1 0 3 2"], ["3 3\n0 0 0\n0 0 0\n0 0 0", "0 0 0 0 0 0 0 0 0"], ["4 2\n1 2\n0 3\n4 0\n0 5", "0 0 0 2 1 3 4 5"]],
        witness: 3,
        probe: ["3 3\n6 0 1\n0 2 0\n3 0 4", "0 0 0 6 0 1 3 2 4"],
    },
    {
        title: "Safe Range Labels",
        difficulty: 10,
        guide: "`value` starts as one input label. The lower and upper checks bring it into the permitted range independently.",
        incident: "AEGIS allowed labels outside a safe range. Mira restores the boundary replacement rule.",
        symptom: "Values above the permitted upper bound are replaced by the lower bound.",
        task: "For each value, replace it with `low` if it is below `low`, with `high` if it is above `high`, and otherwise keep it unchanged. Preserve order. Both endpoints are allowed.",
        input: "Read `n`, `low`, and `high`, then `n` integer values.",
        output: "Print all `n` adjusted values separated by spaces.",
        example: "With range `[2, 6]`, the values `0 2 4 9` become `2 2 4 6`.",
        constraints: "`1 <= n <= 100`; `-100 <= low <= high <= 100`. Input values are from `-100` to `100`.",
        defect: "The upper-bound branch assigns the lower endpoint.",
        hints: ["Try one value greater than `high`.", "The two outside regions need different replacement endpoints.", "The upper-bound branch should choose the upper endpoint, just as the lower-bound branch chooses the lower endpoint."],
        c: `int n;
int low;
int high;
READ(n);
READ(low);
READ(high);
for (int i = 0; i < n; i++) {
    int value;
    READ(value);
    if (value < low) {
        value = low;
    }
    if (value > high) {
        value = high;
    }
    OUT(value);
}`,
        py: `n = read_int()
low = read_int()
high = read_int()
result = []
for _ in range(n):
    value = read_int()
    if value < low:
        value = low
    if value > high:
        value = high
    result.append(value)
print(*result)`,
        cbug: ["value = high;", "value = low;"],
        pybug: ["value = high", "value = low"],
        cases: [["4 2 6\n0 2 4 9", "2 2 4 6"], ["1 3 3\n3", "3"], ["1 1 5\n9", "5"], ["3 -3 3\n-9 0 9", "-3 0 3"], ["2 -100 100\n-100 100", "-100 100"], ["3 0 1\n0 1 2", "0 1 1"], ["3 -4 -2\n-5 -4 -3", "-4 -4 -3"], ["3 1 6\n7 7 7", "6 6 6"]],
        witness: 3,
        probe: ["3 -1 8\n-8 2 12", "-1 2 8"],
    },
];
