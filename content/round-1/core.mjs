export const core = [
{
example:"Input `1 0` means registered with a valid badge. Output: `ALLOW`. Input `1 1` means the badge was revoked. Output: `DENY`.",
title:"Revoked Operator",difficulty:4,
guide:"A flag is a value meaning no (`0`) or yes (`1`). Read what each flag says about the person.",
incident:"Mira is checking access rules for the recovery console.",
symptom:"The program can allow an unregistered person or a person with a revoked badge.",task:"Allow access only when `registered = 1` (the person is registered) and `revoked = 0` (the badge has not been cancelled). Deny access in every other case.",input:"1. Read `registered`, whether the person is registered.\n2. Read `revoked`, whether the badge has been cancelled.",output:"Print `ALLOW` if both access requirements hold. Otherwise print `DENY`.",constraints:"Each of `registered` and `revoked` is either `0` or `1`.",
defect:"Permission combines the two conditions with OR instead of AND.",hints:["Try a registered person with a revoked badge.","One satisfied requirement does not make access valid.","Join the registration check and the no-revocation check with logical AND."],
c:`int registered,revoked; READ(registered); READ(revoked);
if(registered==1 && revoked==0){ SAY("ALLOW"); }else{ SAY("DENY"); }`,
py:`registered, revoked = read_int(), read_int()
print("ALLOW" if registered == 1 and revoked == 0 else "DENY")`,cbug:["registered==1 && revoked==0","registered==1 || revoked==0"],pybug:["registered == 1 and revoked == 0","registered == 1 or revoked == 0"],cases:[["1 0","ALLOW"],["1 1","DENY"],["0 0","DENY"],["0 1","DENY"],["1\n1","DENY"],["0\n0","DENY"]]
},
{
example:"Input `1 1` has an emergency and a lockdown. The emergency has priority, so output `OPEN`.",
title:"Emergency Priority",difficulty:8,
guide:"A flag means no (`0`) or yes (`1`). Only one result is printed, even when both flags are on.",
incident:"Mira is testing an emergency door during a lockdown.",
symptom:"When both flags are `1`, the program can report `LOCKED` instead of `OPEN`.",task:"Use these rules in priority order: if `emergency` (emergency flag) is `1`, the result is `OPEN`. Otherwise, if `lockdown` (lockdown flag) is `1`, the result is `LOCKED`. If both are `0`, the result is `IDLE`.",input:"1. Read `emergency`, whether an emergency is active.\n2. Read `lockdown`, whether a lockdown is active.",output:"Print exactly one of `OPEN`, `LOCKED`, or `IDLE`, using the priority rules.",constraints:"Each of `emergency` and `lockdown` is either `0` or `1`.",
defect:"Lockdown is checked before the higher-priority emergency condition.",hints:["Try input `1 1`.","Only the first matching branch of an if/else chain runs.","Check `emergency` before `lockdown`; use `IDLE` when neither is active."],
c:`int emergency,lockdown; READ(emergency); READ(lockdown);
if(emergency==1){ SAY("OPEN"); }else if(lockdown==1){ SAY("LOCKED"); }else{ SAY("IDLE"); }`,
py:`emergency, lockdown = read_int(), read_int()
if emergency == 1:
    print("OPEN")
elif lockdown == 1:
    print("LOCKED")
else:
    print("IDLE")`,cbug:['if(emergency==1){ SAY("OPEN"); }else if(lockdown==1){ SAY("LOCKED"); }','if(lockdown==1){ SAY("LOCKED"); }else if(emergency==1){ SAY("OPEN"); }'],pybug:['if emergency == 1:\n    print("OPEN")\nelif lockdown == 1:\n    print("LOCKED")','if lockdown == 1:\n    print("LOCKED")\nelif emergency == 1:\n    print("OPEN")'],cases:[["1 1","OPEN"],["0 1","LOCKED"],["1 0","OPEN"],["0 0","IDLE"],["1\n1","OPEN"],["0\n0","IDLE"]]
},
{
example:"Input `0 2` starts with the lamp off. Two pulses change it to `1`, then `0`. Output: `0`.",
title:"Toggle Storm",difficulty:10,
guide:"A toggle means switching to the opposite state. Each loop pass represents one pulse.",
incident:"Patch is testing pulses sent to a lamp.",
symptom:"A pulse can leave an already lit lamp on.",task:"Start with `state`, the lamp's initial state. For each of `n` pulses, switch off (`0`) to on (`1`), or on to off. Print the state after all pulses. With `n = 0`, keep the initial state.",input:"1. Read `state`, the initial lamp state.\n2. Read `n`, the number of pulses.",output:"Print the final `state`: `0` for off or `1` for on.",constraints:"`state` is `0` or `1`. `0 <= n <= 100`.",
defect:"The loop sets the state to one instead of inverting it.",hints:["Start with an off lamp and trace two pulses.","The next state depends on the current `state`.","For each pulse, assign `1 - state` to `state`."],
c:`int state,n; READ(state); READ(n); for(int i=0;i<n;i++){ state=1-state; } OUT(state);`,
py:`state, n = read_int(), read_int()
for _ in range(n):
    state = 1 - state
print(state)`,cbug:["state=1-state","state=1"],pybug:["state = 1 - state","state = 1"],cases:[["0 2","0"],["1 1","0"],["0 0","0"],["1 0","1"],["0 3","1"],["1 100","1"],["0 4","0"]]
},
{
example:"Input `1 5` means one hour and five minutes. Output: `65`.",
title:"Clock Translation",difficulty:8,
guide:"The two inputs use different units. The output uses minutes only.",
incident:"Mira needs to express a recorded time in minutes.",
symptom:"The program gives too few minutes when `h`, the hour count, is positive.",task:"Given `h` hours and `m` extra minutes, print their total length in minutes. One hour contains `60` minutes.",input:"1. Read `h`, the number of whole hours.\n2. Read `m`, the extra minutes.",output:"Print the total number of minutes as one integer.",constraints:"`0 <= h <= 23`. `0 <= m <= 59`.",
defect:"Hours are added without conversion into minutes.",hints:["Try a time with one hour and no extra minutes.","Express both parts in minutes before adding them.","Compute `h * 60 + m`."],
c:`int h,m; READ(h); READ(m); int total=h*60+m; OUT(total);`,
py:`h, m = read_int(), read_int()
total = h * 60 + m
print(total)`,cbug:["h*60+m","h+m"],pybug:["h * 60 + m","h + m"],cases:[["1 5","65"],["0 59","59"],["0 0","0"],["23 59","1439"],["2 0","120"],["12 30","750"]]
},
{
example:"Input `47` has digits `4` and `7`. Output: `11`.",
title:"Decimal Fingerprint",difficulty:12,
guide:"`total` holds the sum so far. The loop reads the digits of `tag`; its numeric value gets shorter as digits are processed.",
incident:"Ishan is checking a recovery tag by its digits.",
symptom:"The program adds incorrect amounts for a number with several digits.",task:"For `tag`, a nonnegative whole number written in base ten, add its digits. Print the sum. The digit sum of `0` is `0`.",input:"Read `tag`, the number whose decimal digits must be added.",output:"Print the sum of all digits of `tag` as one integer.",constraints:"`0 <= tag <= 999999`.",
defect:"The digit accumulator adds the quotient rather than the last digit remainder.",hints:["For `tag = 47`, which digit should be added first?","A remainder is what is left after whole-number division. Compare the remainder and quotient when dividing by `10`.","Add `tag % 10`, the last digit, to `total`. Then remove that digit with whole-number division by `10`."],
c:`int tag; READ(tag); int total=0; while(tag>0){ total+=tag%10; tag/=10; } OUT(total);`,
py:`tag = read_int()
total = 0
while tag > 0:
    total += tag % 10
    tag //= 10
print(total)`,cbug:["total+=tag%10","total+=tag/10"],pybug:["total += tag % 10","total += tag // 10"],cases:[["47","11"],["1000","1"],["0","0"],["9","9"],["999999","54"],["120304","10"]]
},
{
example:"Input `1 2` contains just one ACK. The connection stays CLOSED. Output: `0`.",
title:"Broken Handshake",difficulty:22,
guide:"A state records the connection's current stage. The meaning of an `event`, the next message code, depends on that stage.",
incident:"Patch is checking messages that open a recovery connection.",
symptom:"An ACK can open the connection before a START has been received.",task:"Start CLOSED (`state = 0`). START (`event = 1`) changes CLOSED to WAITING (`state = 1`). ACK (`event = 2`), a reply message, changes WAITING to OPEN (`state = 2`). RESET (`event = 3`) changes any state to CLOSED. Every other event/state pair leaves the state unchanged. Process events in input order.",input:"1. Read `n`, the number of messages.\n2. Read `n` values of `event`, in the order received.",output:"Print the final numeric `state`: `0` for CLOSED, `1` for WAITING, or `2` for OPEN.",constraints:"`1 <= n <= 100`. Each `event` is `1`, `2`, or `3`.",
defect:"ACK establishes a connection without checking the WAITING state.",hints:["Try one ACK as the first and only message.","Check both the message code and the state in which it is valid.","The ACK branch must require `event == 2` and `state == 1`."],
c:`int n,state=0; READ(n);
for(int i=0;i<n;i++){ int event; READ(event);
    if(event==3) state=0;
    else if(event==1 && state==0) state=1;
    else if(event==2 && state==1) state=2;
}
OUT(state);`,
py:`n = read_int()
state = 0
for _ in range(n):
    event = read_int()
    if event == 3:
        state = 0
    elif event == 1 and state == 0:
        state = 1
    elif event == 2 and state == 1:
        state = 2
print(state)`,cbug:["event==2 && state==1","event==2"],pybug:["event == 2 and state == 1","event == 2"],cases:[["1\n2","0"],["2\n1 2","2"],["3\n1 2 3","0"],["3\n2 1 2","2"],["2\n3 2","0"],["4\n1 1 2 1","2"],["1\n1","1"]]
},
{
example:"Input `10 2 4 9` starts at `10`. Withdrawing `4` leaves `6`, so `9` cannot be paid. Cancel the group. Output: `10`.",
title:"Atomic Withdrawal",difficulty:18,
guide:"Atomic means the group succeeds in full or has no effect. `original` holds the starting balance; `failed` records whether any withdrawal was unaffordable.",
incident:"Mira is checking a group of account withdrawals.",
symptom:"When a later withdrawal fails, earlier deductions can remain.",task:"Try the `n` withdrawals in input order. A withdrawal is affordable when its `amount` is no greater than the remaining `balance`. If every withdrawal is affordable, keep all deductions. If any one is not, cancel the whole group so the final balance equals the starting balance.",input:"1. Read `balance`, the starting balance, and `n`, the number of withdrawals.\n2. Read `n` values of `amount`, the withdrawals in order.",output:"Print the final balance after either all deductions or cancellation of the whole group.",constraints:"`0 <= balance <= 10000` initially. Each `amount` is from `0` to `10000`. `1 <= n <= 100`.",
defect:"The failure branch retains partially applied state instead of rolling back.",hints:["Try an affordable withdrawal followed by an unaffordable one.","Cancellation must undo deductions made before the failure.","When `failed` is set, restore `balance` from `original`."],
c:`int balance,n; READ(balance); READ(n); int original=balance,failed=0;
for(int i=0;i<n;i++){ int amount; READ(amount); if(failed==0){ if(amount<=balance) balance-=amount; else failed=1; } }
if(failed==1) balance=original;
OUT(balance);`,
py:`balance, n = read_int(), read_int()
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
    balance = original
print(balance)`,cbug:["balance=original","balance=balance"],pybug:["balance = original","balance = balance"],cases:[["10 2\n4 9","10"],["10 2\n4 6","0"],["0 1\n0","0"],["5 1\n6","5"],["20 3\n3 4 5","8"],["10 3\n2 9 0","10"]]
},
{
example:"Input `1430 20 15` crosses midnight. The age is `30` minutes, beyond the `15`-minute lifetime. Output: `EXPIRED`.",
title:"Midnight Token",difficulty:16,
guide:"Both times are minute numbers within one day. `age` is the time passed between them, including a midnight crossing when needed.",
incident:"Ishan is checking whether a recovery token has expired.",
symptom:"A token checked after midnight can get a negative age and remain valid too long.",task:"Find the elapsed minutes from `issued` (issue time) to `now` (check time), moving forward on a daily clock with `1440` minutes. The clock moves from `1439` to `0` at midnight. Equal times mean an age of `0`. The token is valid only while its age is strictly less than `ttl`, its allowed lifetime.",input:"Read `issued`, `now`, and `ttl`, in that order, all in minutes.",output:"Print `VALID` if the age is less than `ttl`. Print `EXPIRED` if it is equal to or greater than `ttl`.",constraints:"`0 <= issued, now <= 1439`. `1 <= ttl <= 1440`. Less than one full day has passed.",
defect:"Elapsed time is not wrapped across midnight.",hints:["Try an issue time just before midnight and a check time just after it.","The age must be between `0` and `1439`, inclusive.","Compute `age` as `(now - issued + 1440) % 1440`, then compare it strictly with `ttl`."],
c:`int issued,now,ttl; READ(issued); READ(now); READ(ttl); int age=(now-issued+1440)%1440;
if(age<ttl){ SAY("VALID"); }else{ SAY("EXPIRED"); }`,
py:`issued, now, ttl = read_int(), read_int(), read_int()
age = (now - issued + 1440) % 1440
print("VALID" if age < ttl else "EXPIRED")`,cbug:["(now-issued+1440)%1440","now-issued"],pybug:["(now - issued + 1440) % 1440","now - issued"],cases:[["1430 20 15","EXPIRED"],["1430 5 20","VALID"],["10 20 10","EXPIRED"],["8 8 1","VALID"],["0 1439 1440","VALID"],["100 50 100","EXPIRED"]]
},
{
example:"Input `2 2 3 0 1 1 1 0 0` records approvals from operators `0` and `1`, then withdrawal by `0`. Only one approval remains. Output: `NO`.",
title:"Withdrawn Quorum",difficulty:18,
guide:"`votes` stores one current vote per operator. Repeated updates from one operator do not create extra voters.",
incident:"Mira is collecting current approvals for a shutdown.",
symptom:"An operator who withdraws approval can still be counted as approving.",task:"A quorum is the required number of approvals. Each of `n` operators starts with no approval. Each update replaces one operator's vote: `1` means approve, and `0` means withdraw or do not approve. Process updates in order. After all updates, answer yes if at least `k` different operators approve.",input:"1. Read `n`, the operator count, `k`, the approvals required, and `q`, the update count.\n2. Read `q` pairs: `who`, the operator ID, and `value`, that operator's new vote.",output:"Print `YES` if the final approval count is at least `k`; otherwise print `NO`.",constraints:"`1 <= n <= 20`. Operator IDs satisfy `0 <= who < n`. `1 <= k <= n`. `0 <= q <= 100`. Each `value` is `0` or `1`.",
defect:"Every vote update is stored as approval, ignoring the supplied withdrawal value.",hints:["Have one operator approve and then withdraw.","The update's `value` may be `0`, and it replaces the earlier vote.","Assign `value` to `votes[who]`, then count the final approvals."],
c:`int n,k,q; READ(n); READ(k); READ(q); ARRAY(votes,20);
for(int i=0;i<q;i++){ int who,value; READ(who); READ(value); votes[who]=value; }
int count=0; for(int i=0;i<n;i++) count+=votes[i];
if(count>=k){ SAY("YES"); }else{ SAY("NO"); }`,
py:`n, k, q = read_int(), read_int(), read_int()
votes = [0] * n
for _ in range(q):
    who, value = read_int(), read_int()
    votes[who] = value
print("YES" if sum(votes) >= k else "NO")`,cbug:["votes[who]=value","votes[who]=1"],pybug:["votes[who] = value","votes[who] = 1"],cases:[["2 2 3\n0 1\n1 1\n0 0","NO"],["2 2 2\n0 1\n1 1","YES"],["1 1 0","NO"],["1 1 2\n0 1\n0 1","YES"],["3 1 2\n0 0\n2 1","YES"],["3 2 4\n0 1\n0 0\n1 0\n2 1","NO"]]
},
{
example:"Input `2 1 8 3 5` gives ranges `1` through `8` and `3` through `5`. Their shared range is `3` through `5`. Output: `3 5`.",
title:"Window of Consent",difficulty:24,
guide:"`left` and `right` are the endpoints of the shared range found so far. Each input pair describes one approval, not a duration.",
incident:"Mira needs a time when every shutdown approval is valid.",
symptom:"The reported range can include times after an approval has ended.",task:"Each approval covers all times from its `start` to its `end`, including both endpoints. Find the intersection: the times covered by every approval. A single shared endpoint is a valid range. If there is no shared time, report no range.",
input:"1. Read `n`, the number of approvals.\n2. Read `n` pairs: `start`, the first valid time, and `end`, the last valid time.",output:"Print the shared `left` and `right` endpoints, in that order, separated by a space. If no time is shared by all approvals, print `NONE`.",constraints:"`1 <= n <= 20`. Each pair satisfies `0 <= start <= end <= 100`.",
defect:"The intersection extends its upper bound instead of shrinking it to the earliest expiry.",
hints:["Mark the shared times for the two ranges in the example.","The shared range must fit inside every input range.","Use the largest `start` and smallest `end`. Print `NONE` only when `left > right`."],
c:`int n; READ(n); int left=0,right=100;
for(int i=0;i<n;i++){
    int start,end; READ(start); READ(end);
    if(start>left) left=start;
    if(end<right) right=end;
}
if(left>right){ SAY("NONE"); }else{ OUT(left); OUT(right); }`,
py:`n = read_int()
left, right = 0, 100
for _ in range(n):
    start, end = read_int(), read_int()
    if start > left:
        left = start
    if end < right:
        right = end
if left > right:
    print("NONE")
else:
    print(left, right)`,
cbug:["end<right","end>right"],pybug:["end < right","end > right"],
cases:[["2\n1 8\n3 5","3 5"],["2\n1 2\n3 4","NONE"],["1\n2 2","2 2"],["2\n0 2\n2 7","2 2"],["3\n0 100\n5 20\n10 15","10 15"],["1\n0 100","0 100"]]
},
{
example:"Input `a;b;c` has two unescaped semicolons. Output: `2`. In input `a\\;b`, the backslash escapes the semicolon. Output: `0`.",
title:"Escaped Directive",difficulty:34,
guide:"An escape makes the next character ordinary text. `escaped` records whether that rule applies to the current character; `count` is the number of separators found.",
incident:"Ishan is counting separators in a command word.",
symptom:"A real separator after two consecutive backslashes can be missed.",task:"Count unescaped semicolons (`;`) in `s`, the input word. An unescaped backslash (`\\`) escapes exactly the next character, even another backslash. An escaped character is ordinary text: it is not a separator and cannot start an escape. A final backslash is allowed and adds nothing to the count.",input:"Read `s`, one nonempty word with no spaces.",output:"Print the number of semicolons (`;`) that are not escaped.",constraints:"`s` contains `1` to `100` characters. Each character is an English letter, a backslash (`\\`), or a semicolon (`;`).",
defect:"The parser checks for a backslash before consuming the existing escape state, so escaped backslashes incorrectly extend escaping.",hints:["Compare a semicolon after one backslash with a semicolon after two backslashes.","An already escaped backslash cannot start a new escape.","Handle an active `escaped` flag first and clear it. Otherwise, a backslash starts an escape, and a semicolon increases `count`."],
c:`TEXT(s); WORD(s); int escaped=0,count=0;
for(int i=0;i<LEN(s);i++){
    int ch=CHAR(s,i);
    if(escaped==1) escaped=0;
    else if(ch==92) escaped=1;
    else if(ch==';') count++;
}
OUT(count);`,
py:`s = read_word()
escaped = False
count = 0
for ch in s:
    if escaped:
        escaped = False
    elif ord(ch) == 92:
        escaped = True
    elif ch == ';':
        count += 1
print(count)`,cbug:["if(escaped==1) escaped=0;\n    else if(ch==92) escaped=1;","if(ch==92) escaped=1;\n    else if(escaped==1) escaped=0;"],pybug:["if escaped:\n        escaped = False\n    elif ord(ch) == 92:\n        escaped = True","if ord(ch) == 92:\n        escaped = True\n    elif escaped:\n        escaped = False"],cases:[["a;b;c","2"],["a\\;b","0"],["a\\\\;b","1"],[";","1"],["abc\\","0"],["\\\\;\\;;","2"],["\\\\\\;","0"],["abc","0"]]
},
{
example:"Input `5 2 0 8 0 9` first accepts value `8` at version `0`, then rejects value `9` with the same old version. Output: `8 1 1`.",
title:"Versioned Truce",difficulty:20,
guide:"A version is an update number. `value` holds the current setting, `version` identifies its current update, and `accepted` counts successful requests.",
incident:"Mira is checking updates to a shared setting.",
symptom:"After an update succeeds, a request using the old version can still succeed.",task:"Start with the input `value` and version `0`. Process requests in order. Accept a request only if its `expected` version equals the current `version`. On acceptance, store the requested value, increase the version by one, and count one accepted request, even if the value stays the same. A rejected request changes nothing.",input:"1. Read `value`, the starting setting, and `q`, the request count.\n2. Read `q` pairs: `expected`, the required current version, and the requested value (`next` in C, C++ and Java; `next_value` in Python).",output:"Print the final `value`, final `version`, and `accepted` count, in that order, separated by spaces.",constraints:"The starting and requested values are from `-1000` to `1000`. `0 <= q <= 100`. `0 <= expected <= 100`.",
defect:"A successful compare-and-set does not increment the stored version.",hints:["Send two requests that both expect version `0`.","A successful request must make its old version outdated.","Increase `version` whenever a request is accepted, alongside the value and `accepted` updates."],
c:`int value,q; READ(value); READ(q); int version=0,accepted=0;
for(int i=0;i<q;i++){ int expected,next; READ(expected); READ(next);
    if(expected==version){ value=next; version++; accepted++; }
}
OUT(value); OUT(version); OUT(accepted);`,
py:`value, q = read_int(), read_int()
version = accepted = 0
for _ in range(q):
    expected, next_value = read_int(), read_int()
    if expected == version:
        value = next_value
        version += 1
        accepted += 1
print(value, version, accepted)`,cbug:["version++;","version+=0;"],pybug:["version += 1","version += 0"],cases:[["5 2\n0 8\n0 9","8 1 1"],["0 3\n0 2\n1 4\n2 6","6 3 3"],["7 0","7 0 0"],["1 2\n2 8\n1 9","1 0 0"],["0 4\n0 5\n0 7\n1 6\n1 8","6 2 2"],["-9 1\n0 -4","-4 1 1"]]
}
];
