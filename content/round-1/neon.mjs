export const neon = [
{
example:"For readings `7 5 2`, the sum is `7 + 5 + 2 = 14`. Print `14`.",
title:"The Last Beacon", difficulty:3,
guide:"`a` holds the readings, `i` is the current position, and `total` stores the sum so far. List positions start at `0`.",
incident:"The security AI AEGIS blocked emergency lights. Mira needs the total of their power readings.",
symptom:"The printed sum can differ from the total of all readings.",
task:"Add every reading in the list exactly once and print the sum. Include zero and negative readings.", input:"1. Read `n`, the number of readings.\n2. Read the `n` integer readings in `a`.", output:"Print one integer: the sum of all `n` readings.", constraints:"`1 <= n <= 100`. Each reading is from `-1000` to `1000`.",
defect:"The accumulation loop excludes the last element.",
hints:["Try a list containing just one nonzero reading.","Check which positions the addition loop visits, especially the last position.","Visit positions `0` through `n - 1`. Use `i < n` in C, C++ and Java, or `range(n)` in Python so the last reading is added."],
c:`int n; READ(n); ARRAY(a, 100);
for(int i=0;i<n;i++){ READ(a[i]); }
int total=0;
for(int i=0;i<n;i++){ total+=a[i]; }
OUT(total);`,
py:`n = read_int()
a = [read_int() for _ in range(n)]
total = 0
for i in range(n):
    total += a[i]
print(total)`,
cbug:["i<n;i++){ total", "i<n-1;i++){ total"],pybug:["range(n):","range(n - 1):"],
cases:[["3\n7 5 2","14"],["1\n9","9"],["1\n0","0"],["4\n-5 -3 2 6","0"],["3\n-1 -2 -3","-6"],["5\n1 1 1 1 1","5"],["2\n1000 1000","2000"],["2\n-1000 5","-995"]]
},
{
example:"For `-8 -2 -5`, the largest reading is `-2`. Print `-2`.",
title:"Cold Signal",difficulty:5,
guide:"`a` holds the readings. `best` is the current candidate for the largest reading; the loop compares later readings with it.",
incident:"AEGIS disrupted a signal scan. Patch needs the largest recorded reading.",
symptom:"When all readings are negative, the program can print `0` even though `0` was never recorded.",task:"Print the largest value in the nonempty list. The answer must be a value that appears in the input. If it appears several times, print that value once.",input:"1. Read `n`, the number of readings.\n2. Read the `n` integer readings in `a`.",output:"Print one integer: the largest reading, rather than its position.",constraints:"`1 <= n <= 100`. Each reading is from `-1000` to `1000`.",
defect:"The maximum starts at zero instead of an observed value.",hints:["Try a list where every reading is below `0`.","Check the starting value of `best` before the comparisons begin.","Start `best` at `a[0]`, the first reading, then compare the remaining readings with it."],
c:`int n; READ(n); ARRAY(a,100);
for(int i=0;i<n;i++){ READ(a[i]); }
int best=a[0];
for(int i=1;i<n;i++){ if(a[i]>best) best=a[i]; }
OUT(best);`,
py:`n = read_int()
a = [read_int() for _ in range(n)]
best = a[0]
for value in a[1:]:
    if value > best:
        best = value
print(best)`,cbug:["best=a[0]","best=0"],pybug:["best = a[0]","best = 0"],cases:[["3\n-8 -2 -5","-2"],["4\n3 9 2 7","9"],["1\n-1000","-1000"],["3\n0 0 0","0"],["3\n-1 0 -2","0"],["2\n1000 999","1000"]]
},
{
example:"For `2 4 9 4 4` with `x = 4`, the first match is at position `1`. Print `1`.",
title:"First Witness",difficulty:7,
guide:"`found` stores a matching position or `-1` when no match has been stored. `i` is the current position. The loop reads each badge number and compares it with `x`, the requested badge.",
incident:"AEGIS blocked the badge log. Ishan needs the first recorded position of one badge number.",
symptom:"If a badge appears several times, the program can print a later position instead of the first.",task:"Find the first occurrence of `x` in input order. Positions start at `0`. Print its position, or `-1` if `x` does not appear.",input:"1. Read `n`, the number of badges, and `x`, the badge number to find.\n2. Read the `n` badge numbers in recorded order.",output:"Print one integer: the first position of `x`, or `-1` if it is absent.",constraints:"`1 <= n <= 100`. Every badge number, including `x`, is from `0` to `99`.",
defect:"A later match overwrites the first saved index.",hints:["Try a badge number that occurs more than once.","After the first match is saved, should another match change `found`?","Store a matching position only while `found == -1`. Later matches must leave the first position unchanged."],
c:`int n,x; READ(n); READ(x); ARRAY(a,100); int found=-1;
for(int i=0;i<n;i++){ READ(a[i]); if(a[i]==x && found==-1) found=i; }
OUT(found);`,
py:`n, x = read_int(), read_int()
found = -1
for i in range(n):
    value = read_int()
    if value == x and found == -1:
        found = i
print(found)`,cbug:["a[i]==x && found==-1","a[i]==x"],pybug:["value == x and found == -1","value == x"],cases:[["5 4\n2 4 9 4 4","1"],["3 8\n1 2 3","-1"],["1 5\n5","0"],["3 0\n0 0 0","0"],["4 7\n2 3 4 7","3"],["2 9\n9 8","0"]]
},
{
example:"The list `0 2 0 9 0` has three zeros. Print `3`.",
title:"Silent Slots",difficulty:8,
guide:"`value` is the current sensor reading. `count` stores how many zero readings the program has counted so far.",
incident:"AEGIS interrupted sensors. Patch treats a reading of `0` as a silent sensor.",symptom:"Zero readings do not increase the reported count correctly.",task:"Count the readings equal to `0`. Each zero contributes one to the count. Ignore all other readings.",input:"1. Read `n`, the number of readings.\n2. Read `n` integer sensor readings, each read into `value`.",output:"Print one integer: the number of zero readings.",constraints:"`1 <= n <= 100`. Each reading is from `0` to `1000`.",defect:"The zero-reading branch adds the reading instead of one to the counter.",hints:["What should a single zero reading contribute to the answer?","Check what is added to `count` when `value == 0`.","Add `1` to `count` for each zero. Adding `value` adds nothing because it is `0` in that branch."],
c:`int n,count=0; READ(n);
for(int i=0;i<n;i++){ int value; READ(value); if(value==0) count+=1; }
OUT(count);`,
py:`n = read_int()
count = 0
for _ in range(n):
    value = read_int()
    if value == 0:
        count += 1
print(count)`,cbug:["count+=1","count+=value"],pybug:["count += 1","count += value"],cases:[["5\n0 2 0 9 0","3"],["3\n1 2 3","0"],["1\n0","1"],["4\n0 0 0 0","4"],["2\n1000 0","1"],["2\n0 1000","1"]]
},
{
example:"The word `radar` reads the same backwards. Print `YES`.",
title:"Mirror Credential",difficulty:10,
guide:"`s` holds the word, and `ok` records whether it passes the check. The loop compares pairs of letters from the word's two ends. Positions start at `0`.",
incident:"AEGIS blocked normal login. Mira is checking a backup word reader.",symptom:"The program can accept a word that changes when read backwards.",task:"Check whether `s` is a palindrome, a word that reads the same forwards and backwards. Print `YES` if it is; otherwise print `NO`. A one-letter word qualifies.",input:"Read `s`, one word of lowercase English letters.",output:"Print exactly `YES` or `NO`, in uppercase.",constraints:"`s` contains from `1` to `100` lowercase English letters.",defect:"Each character is compared with itself instead of its mirrored character.",hints:["Try a two-letter word with different letters, such as `ab`.","The first letter must be compared with the last letter.","Pair position `i` with the position the same distance from the other end. In C, use `n - 1 - i`, where `n` is the word length. In Python, use `len(s) - 1 - i`. Check pairs up to the middle."],
c:`TEXT(s); WORD(s); int n=LEN(s),ok=1;
for(int i=0;i<n/2;i++){ if(CHAR(s,i)!=CHAR(s,n-1-i)) ok=0; }
if(ok==1){ SAY("YES"); }else{ SAY("NO"); }`,
py:`s = read_word()
ok = True
for i in range(len(s) // 2):
    if s[i] != s[len(s) - 1 - i]:
        ok = False
print("YES" if ok else "NO")`,cbug:["CHAR(s,n-1-i)","CHAR(s,i)"],pybug:["s[len(s) - 1 - i]","s[i]"],cases:[["radar","YES"],["neon","NO"],["a","YES"],["ab","NO"],["aa","YES"],["abca","NO"],["abba","YES"],["abcba","YES"]]
},
{
example:"The word `AEGISa` contains one `A` and one `a`. Print `2`.",
title:"Case-Cloaked Orders",difficulty:10,
guide:"`s` holds the word, `ch` is the current character, and `count` stores the number of accepted characters. The condition decides which characters count.",
incident:"AEGIS changed letter case in a command. Ishan needs every copy of the letter `a`.",symptom:"Uppercase `A` is missed in the reported count.",task:"Count all lowercase `a` and uppercase `A` characters in the word. Each occurrence counts once. Ignore every other letter.",input:"Read `s`, one word of uppercase or lowercase English letters.",output:"Print one integer: the combined number of `a` and `A` characters.",constraints:"`s` contains from `1` to `100` English letters. Uppercase and lowercase letters are allowed.",defect:"Only the lowercase form is recognised.",hints:["Try a word containing only uppercase `A` characters.","Check whether the condition accepts both forms of the letter.","Increase `count` when `ch` equals either `a` or `A`. Use an OR condition so either form is accepted."],
c:`TEXT(s); WORD(s); int count=0;
for(int i=0;i<LEN(s);i++){ int ch=CHAR(s,i); if(ch=='a' || ch=='A') count++; }
OUT(count);`,
py:`s = read_word()
count = 0
for ch in s:
    if ch == 'a' or ch == 'A':
        count += 1
print(count)`,cbug:["ch=='a' || ch=='A'","ch=='a'"],pybug:["ch == 'a' or ch == 'A'","ch == 'a'"],cases:[["AEGISa","2"],["banana","3"],["AAA","3"],["xyz","0"],["a","1"],["AaAaZ","4"]]
},
{
example:"The input `2 2 7 7 2` has three runs: `2 2`, `7 7`, and `2`. Print `2 7 2`.",
title:"Repeated Alarm",difficulty:12,
guide:"`a` holds alerts in input order. The output loop decides whether each `a[i]`, the alert at position `i`, should be kept. Positions start at `0`.",
incident:"AEGIS repeated alerts on a screen. Patch wants one entry for each consecutive group of equal alerts.",symptom:"The program can keep a repeated neighbor or remove a later alert that should stay.",task:"Replace each consecutive run of equal numbers with one copy. A run is a group of equal neighboring entries. Keep the original order. If the same number returns after a different number, keep it again.",input:"1. Read `n`, the number of alerts.\n2. Read the `n` alert numbers in `a`, in recorded order.",output:"Print the kept numbers in order, separated by spaces.",constraints:"`1 <= n <= 100`. Each alert number is from `0` to `99`.",defect:"Run detection compares against the first value rather than the previous input.",hints:["In `2 2 7 7 2`, the final `2` must remain.","A new run depends on the immediately previous input entry, not the first entry.","Keep position `0`. For later positions, keep `a[i]` only when `a[i] != a[i - 1]`."],
c:`int n; READ(n); ARRAY(a,100);
for(int i=0;i<n;i++){ READ(a[i]); }
for(int i=0;i<n;i++){ if(i==0 || a[i]!=a[i-1]){ OUT(a[i]); } }`,
py:`n = read_int()
a = [read_int() for _ in range(n)]
result = []
for i in range(n):
    if i == 0 or a[i] != a[i - 1]:
        result.append(a[i])
print(*result)`,cbug:["a[i]!=a[i-1]","a[i]!=a[0]"],pybug:["a[i] != a[i - 1]","a[i] != a[0]"],cases:[["5\n2 2 7 7 2","2 7 2"],["1\n8","8"],["4\n3 3 3 3","3"],["5\n1 2 1 2 1","1 2 1 2 1"],["4\n0 0 2 2","0 2"],["6\n1 1 2 3 3 2","1 2 3 2"]]
},
{
example:"For `1 2 3 4 5` with `k = 1`, the last value moves to the front. Print `5 1 2 3 4`.",
title:"Circular Dispatch",difficulty:24,
guide:"A rotation moves list entries and wraps them around the ends. `pos` is the input position used for each output. The modulo operator `%` gives the remainder and helps wrap positions into the list.",
incident:"AEGIS shifted a patrol list. Mira needs to move it right by the requested number of places.",symptom:"The printed list is rotated in the wrong direction.",task:"Rotate the list `a` to the right by `k` places. In one rightward move, the last entry becomes first and every other entry moves one place right. Keep every entry, including duplicates. Full turns of `n` moves leave the order unchanged.",input:"1. Read `n`, the list length, and `k`, the number of rightward moves.\n2. Read the `n` integer values in `a`.",output:"Print all `n` values after rotation, in their new order, separated by spaces.",constraints:"`1 <= n <= 100`; `0 <= k <= 10000`. Each list value is from `-99` to `99`.",defect:"The source index uses a left-rotation offset.",hints:["After one rightward move, which input entry becomes the first output entry?","Work backwards from output position `i` to the input entry that belongs there.","First use `k %= n` to remove full turns. Then use source position `(i - k + n) % n` for output position `i`."],
c:`int n,k; READ(n); READ(k); ARRAY(a,100);
for(int i=0;i<n;i++){ READ(a[i]); }
k%=n;
for(int i=0;i<n;i++){ int pos=(i-k+n)%n; OUT(a[pos]); }`,
py:`n, k = read_int(), read_int()
a = [read_int() for _ in range(n)]
k %= n
result = []
for i in range(n):
    pos = (i - k + n) % n
    result.append(a[pos])
print(*result)`,cbug:["(i-k+n)%n","(i+k)%n"],pybug:["(i - k + n) % n","(i + k) % n"],cases:[["5 1\n1 2 3 4 5","5 1 2 3 4"],["4 2\n8 6 4 2","4 2 8 6"],["3 0\n-1 2 7","-1 2 7"],["3 7\n1 2 3","3 1 2"],["1 999\n7","7"],["5 5\n1 2 3 4 5","1 2 3 4 5"]]
},
{
example:"For `1 2 3 4 5` with `k = 3`, the groups are `1 2 3`, `2 3 4`, and `3 4 5`. Print `6 9 12`.",
title:"Window Leakage",difficulty:25,
guide:"A window is a consecutive group of entries. `a` stores the readings, and `total` is the current window sum. After the first window, the loop updates that sum one position at a time.",
incident:"AEGIS hid traffic bursts. Ishan needs the total in every fixed-size group of readings.",symptom:"The first sum is correct, but later sums can stay unchanged when they should change.",task:"Find the sum of every consecutive group of exactly `k` readings. Start at the first position and move the group's start one position right each time, until the last full group. Groups may overlap. Include zero and negative readings.",input:"1. Read `n`, the number of readings, and `k`, the group size.\n2. Read the `n` integer traffic readings in `a`.",output:"Print `n - k + 1` group sums from left to right, separated by spaces.",constraints:"`1 <= n <= 100`; `1 <= k <= n`. Each reading is from `-100` to `100`.",defect:"The sliding update removes the incoming value rather than the outgoing value.",hints:["Compare the entries in two neighboring groups.","When the group moves one place right, one old entry leaves and one new entry arrives.","At incoming position `i`, update `total` by adding `a[i]` and subtracting `a[i - k]`. Then print the new sum."],
c:`int n,k; READ(n); READ(k); ARRAY(a,100);
for(int i=0;i<n;i++){ READ(a[i]); }
int total=0;
for(int i=0;i<k;i++) total+=a[i];
OUT(total);
for(int i=k;i<n;i++){ total+=a[i]-a[i-k]; OUT(total); }`,
py:`n, k = read_int(), read_int()
a = [read_int() for _ in range(n)]
total = sum(a[:k])
result = [total]
for i in range(k, n):
    total += a[i] - a[i - k]
    result.append(total)
print(*result)`,cbug:["a[i]-a[i-k]","a[i]-a[i]"],pybug:["a[i] - a[i - k]","a[i] - a[i]"],cases:[["5 3\n1 2 3 4 5","6 9 12"],["3 1\n-2 8 3","-2 8 3"],["3 3\n1 2 3","6"],["4 2\n0 0 0 0","0 0 0"],["4 2\n4 -4 4 -4","0 0 0"],["5 2\n5 1 8 -2 7","6 9 6 5"]]
},
{
example:"For `8 2 8 2`, both numbers appear twice. The smaller is `2`, so print `2`.",
title:"Frequency Impostor",difficulty:16,
guide:"`count[x]` is the number of times channel `x` appears. `best` is the current candidate channel. The final loop checks channel numbers from smallest to largest.",
incident:"AEGIS disturbed a channel scan. Mira needs the most common channel, with a fixed rule for ties.",symptom:"The program can choose a larger channel number when several channels share the highest count.",task:"Print the number that appears most often in the list. If several numbers have the same highest count, print the smallest of those numbers.",input:"1. Read `n`, the number of scan entries.\n2. Read `n` channel numbers.",output:"Print one integer: the chosen channel number, rather than its count or position.",constraints:"`1 <= n <= 100`. Each channel number is from `0` to `99`.",defect:"An equal-frequency candidate replaces the earlier smaller candidate.",hints:["Try two different channel numbers that appear equally often.","Because the final loop visits smaller numbers first, an equal count should not replace the saved number.","Replace `best` only when `count[x] > count[best]`. Keep the current `best` when the counts are equal."],
c:`int n; READ(n); ARRAY(count,100);
for(int i=0;i<n;i++){ int x; READ(x); count[x]++; }
int best=0;
for(int x=1;x<100;x++){ if(count[x]>count[best]) best=x; }
OUT(best);`,
py:`n = read_int()
count = [0] * 100
for _ in range(n):
    count[read_int()] += 1
best = 0
for x in range(1, 100):
    if count[x] > count[best]:
        best = x
print(best)`,cbug:["count[x]>count[best]","count[x]>=count[best]"],pybug:["count[x] > count[best]","count[x] >= count[best]"],cases:[["4\n8 2 8 2","2"],["5\n9 9 9 1 1","9"],["1\n0","0"],["3\n99 98 97","97"],["6\n0 2 2 0 2 0","0"],["2\n50 50","50"]]
},
{
example:"Merging `1 3` with `1 2` keeps both copies of `1`. Print `1 1 2 3`.",
title:"Twin Archives",difficulty:28,
guide:"`a` and `b` hold the sorted lists. `i` and `j` point to their next unused entries. The loop outputs entries and moves these positions until both lists are used.",
incident:"AEGIS split a record list in two. Patch recovered both sorted parts and must combine them.",symptom:"When the next values in both lists are equal, one copy can be lost.",task:"Merge both lists into one list sorted from smallest to largest. Keep every occurrence from both inputs, including equal values within or across the lists. Each input entry must appear once in the result.",input:"1. Read `n`, the length of the first list, and `m`, the length of the second.\n2. Read `n` values into `a`.\n3. Read `m` values into `b`. Each input list is already sorted from smallest to largest, with equal values allowed.",output:"Print all `n + m` values in nondecreasing order, meaning each is at least the previous one. Separate values with spaces.",constraints:"`1 <= n <= 50`; `1 <= m <= 50`. Each value is from `-100` to `100`. Both input lists are sorted in nondecreasing order.",defect:"The equality branch advances both streams while emitting only one value.",hints:["Try two one-entry lists that both contain `1`.","Whenever an input position is passed, its entry must have been output.","On equal values, output both copies before moving both positions, or output one copy and move only its own list's position."],
c:`int n,m; READ(n); READ(m); ARRAY(a,50); ARRAY(b,50);
for(int i=0;i<n;i++){ READ(a[i]); }
for(int j=0;j<m;j++){ READ(b[j]); }
int i=0,j=0;
while(i<n && j<m){
    if(a[i]<b[j]){ OUT(a[i]); i++; }
    else if(a[i]>b[j]){ OUT(b[j]); j++; }
    else{ OUT(a[i]); OUT(b[j]); i++; j++; }
}
while(i<n){ OUT(a[i]); i++; }
while(j<m){ OUT(b[j]); j++; }`,
py:`n, m = read_int(), read_int()
a = [read_int() for _ in range(n)]
b = [read_int() for _ in range(m)]
i = j = 0
result = []
while i < n and j < m:
    if a[i] < b[j]:
        result.append(a[i]); i += 1
    elif a[i] > b[j]:
        result.append(b[j]); j += 1
    else:
        result.extend([a[i], b[j]]); i += 1; j += 1
result.extend(a[i:]); result.extend(b[j:])
print(*result)`,cbug:["OUT(a[i]); OUT(b[j]); i++; j++;","OUT(a[i]); i++; j++;"],pybug:["result.extend([a[i], b[j]])","result.append(a[i])"],cases:[["2 2\n1 3\n1 2","1 1 2 3"],["1 1\n5\n5","5 5"],["2 3\n-2 0\n-3 0 4","-3 -2 0 0 4"],["1 2\n8\n1 2","1 2 8"],["3 1\n1 1 1\n1","1 1 1 1"],["2 2\n1 2\n3 4","1 2 3 4"]]
},
{
example:"For `abba`, both `ab` and `ba` have different letters. Every longer section repeats a letter. Print `2`.",
title:"Unbroken Channel",
difficulty:30,
guide:"`left` chooses the start of a section, and `right` extends its end. `seen` records letters in that section; `best` stores the longest valid length found. Positions start at `0`.",
incident:"AEGIS repeated letters in a message. Ishan needs the longest section with no repeated letter.",
symptom:"The reported length can include a section that still contains a repeated letter.",
task:"Find the longest substring of `s` in which every letter is different. A substring is a consecutive part of a word, so letters cannot be skipped. Print its length. If several sections tie, only their common length is needed.",
input:"Read `s`, one word of lowercase English letters.",
output:"Print one integer: the longest length of a section with no repeated letter.",
constraints:"`s` contains from `1` to `100` lowercase English letters.",
defect:"A repeated letter is skipped instead of ending the current consecutive piece.",
hints:["For `abba`, can the section starting at the first `a` continue past the second `b`?","Skipping a repeated letter does not keep the section consecutive.","When `seen[letter] == 1`, end the inner loop with `break`. Here `letter` identifies the current letter. The outer loop will try another starting position."],
c:`TEXT(s); WORD(s);
int best=0;
for(int left=0;left<LEN(s);left++){
    ARRAY(seen,26);
    for(int letter=0;letter<26;letter++) seen[letter]=0;
    for(int right=left;right<LEN(s);right++){
        int letter=CHAR(s,right)-'a';
        if(seen[letter]==1){ break; }
        seen[letter]=1;
        int length=right-left+1;
        if(length>best) best=length;
    }
}
OUT(best);`,
py:`s = read_word()
best = 0
for left in range(len(s)):
    seen = [0] * 26
    for right in range(left, len(s)):
        letter = ord(s[right]) - ord('a')
        if seen[letter] == 1:
            break
        seen[letter] = 1
        length = right - left + 1
        if length > best:
            best = length
print(best)`,
cbug:["break;","continue;"],
pybug:["            break","            continue"],
cases:[["abba","2"],["abcabcbb","3"],["a","1"],["aaaa","1"],["abcdef","6"],["tmmzuxt","5"],["pwwkew","3"],["abccdefa","5"]]
},
{
example:"For `s = abaca` and `key = aa`, the message has three copies of `a` and needs only two. Print `YES`.",
title:"Cipher Multiplicity",
difficulty:18,
guide:"`have` counts copies of each letter in `s`, the message. `need` counts copies required by `key`. The final loop compares these counts, and `enough` records whether all requirements are met.",
incident:"AEGIS hid an override key in a message. Mira can use each message letter at most once to make the key.",
symptom:"The program can accept a key even when the message has too few copies of one of its letters.",
task:"Check whether `s` contains at least as many copies of each letter as `key` requires. Letters may be taken from anywhere in `s` and rearranged. Each message position can be used once; unused letters are allowed. Print `YES` if the key can be made, or `NO` otherwise.",
input:"1. Read `s`, the message word.\n2. Read `key`, the word to make. Both words use lowercase English letters.",
output:"Print exactly `YES` if every required letter count is met; otherwise print `NO`.",
constraints:"Each of `s` and `key` contains from `1` to `100` lowercase English letters.",
defect:"Required character multiplicities are collapsed to one.",
hints:["Compare keys `a` and `aa` when the message contains only one `a`.","A required letter count must record all copies, not just whether that letter appears.","Increase `need[letter]` by one for every key letter. Then require `have[letter] >= need[letter]` for each letter; `letter` is its alphabet index."],
c:`TEXT(s); TEXT(key); WORD(s); WORD(key);
ARRAY(have,26); ARRAY(need,26);
for(int i=0;i<LEN(s);i++){
    int letter=CHAR(s,i)-'a';
    have[letter]++;
}
for(int i=0;i<LEN(key);i++){
    int letter=CHAR(key,i)-'a';
    need[letter]++;
}
int enough=1;
for(int letter=0;letter<26;letter++){
    if(have[letter]<need[letter]) enough=0;
}
if(enough==1){ SAY("YES"); }else{ SAY("NO"); }`,
py:`s, key = read_word(), read_word()
have = [0] * 26
need = [0] * 26
for ch in s:
    letter = ord(ch) - ord('a')
    have[letter] += 1
for ch in key:
    letter = ord(ch) - ord('a')
    need[letter] += 1
enough = True
for letter in range(26):
    if have[letter] < need[letter]:
        enough = False
print("YES" if enough else "NO")`,
cbug:["need[letter]++;","need[letter]=1;"],
pybug:["need[letter] += 1","need[letter] = 1"],
cases:[["abaca aa","YES"],["abc zz","NO"],["a aa","NO"],["aaa aa","YES"],["baca abc","YES"],["abbbbbc abc","YES"],["abca aabc","YES"],["x x","YES"]]
}
];
