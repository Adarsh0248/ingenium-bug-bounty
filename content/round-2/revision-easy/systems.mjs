// Private organiser content. Cases 1 and 2 are public samples.
export const systems = [
    {
        title: "Sector Offset Split", difficulty: 8,
        guide: "`address` counts bytes from the start of storage. `sector` names a fixed-size group; `offset` is a position inside that group. Read the two calculations separately.",
        incident: "The rogue AI AEGIS corrupted a storage locator. Mira needs the sector and position of one byte.",
        symptom: "The sector can be correct while the position inside it is wrong.",
        task: "Storage is divided into sectors of `size` bytes, numbered from 0. Byte addresses also start at 0. Print the sector containing `address` and the offset of that byte within its sector. The offset must be from 0 through `size - 1`.",
        input: "Read `address`, then `size`.",
        output: "Print the sector number and offset, separated by a space.",
        example: "Input `19 8` places the byte in sector 2, at offset 3. Print `2 3`.",
        constraints: "`0 <= address <= 10000`. `1 <= size <= 128`.",
        defect: "The offset calculation uses the quotient rather than the remainder within a sector.",
        hints: ["Test an address inside the first sector.", "Whole-number division counts complete sectors before the byte.", "Use the remainder after division by `size` for `offset`; leave the sector calculation alone."],
        c: `int address, size;
READ(address);
READ(size);
int sector = address / size;
int offset = address % size;
OUT(sector);
OUT(offset);`,
        py: `address = read_int()
size = read_int()
sector = address // size
offset = address % size
print(sector, offset)`,
        cbug: ["address % size", "address / size"],
        pybug: ["address % size", "address // size"],
        cases: [["19 8", "2 3"], ["0 4", "0 0"], ["3 8", "0 3"], ["8 8", "1 0"], ["127 128", "0 127"], ["10000 1", "10000 0"], ["17 5", "3 2"], ["255 16", "15 15"]],
        witness: 3,
        probe: ["83 12", "6 11"]
    },
    {
        title: "Payload Only Meter", difficulty: 10,
        guide: "Each `frame` includes both a header and message data. `payload` holds only that frame's message data; `total` combines the data lengths.",
        incident: "The rogue AI AEGIS inflated a recovery link's data meter. Patch checks the useful bytes in received packets.",
        symptom: "Header bytes can appear in the reported message total.",
        task: "Every packet has a header of `header` bytes. Each supplied frame length includes that header. Add the message bytes from every frame, excluding the header of each packet. A header-only packet contributes 0.",
        input: "Read `n` and `header`, then `n` frame lengths.",
        output: "Print the total message bytes.",
        example: "Input `3 2 7 2 5` has message lengths 5, 0 and 3. Print `8`.",
        constraints: "`1 <= n <= 50`. `0 <= header <= 20`. `header <= frame <= 200` for every frame.",
        defect: "Each frame's payload length is left equal to its full length, so headers are counted as data.",
        hints: ["A packet with no message data should contribute nothing.", "Locate the conversion from a full frame length to `payload`.", "Remove one `header` from each frame before adding its payload to `total`."],
        c: `int n, header;
READ(n);
READ(header);
int total = 0;
for (int i = 0; i < n; i++) {
    int frame;
    READ(frame);
    int payload = frame - header;
    total += payload;
}
OUT(total);`,
        py: `n = read_int()
header = read_int()
total = 0
for _ in range(n):
    frame = read_int()
    payload = frame - header
    total += payload
print(total)`,
        cbug: ["frame - header", "frame"],
        pybug: ["frame - header", "frame"],
        cases: [["3 2\n7 2 5", "8"], ["2 0\n4 9", "13"], ["1 3\n3", "0"], ["1 0\n0", "0"], ["2 20\n200 20", "180"], ["4 1\n1 2 3 4", "6"], ["3 5\n6 6 6", "3"], ["2 4\n8 10", "10"]],
        witness: 3,
        probe: ["4 7\n7 10 14 19", "22"]
    },
    {
        title: "Truncate Without Growth", difficulty: 12,
        guide: "`length` is the current file length. Each `limit` is a maximum length requested by one trim command. The loop carries the current length into the next command.",
        incident: "The rogue AI AEGIS altered the archive trimmer. Mira checks that trimming cannot create bytes.",
        symptom: "A trim command with a larger limit can grow the file.",
        task: "Start with a file of `length` bytes. Process the trim limits in order. If the file is longer than a limit, shorten it to that limit. Otherwise leave it unchanged. A trim never extends the file.",
        input: "Read `length` and `n`, then `n` trim limits.",
        output: "Print the final file length.",
        example: "Input `12 3 8 20 6` changes the length to 8, leaves it at 8, then changes it to 6. Print `6`.",
        constraints: "`0 <= length <= 1000`. `0 <= n <= 50`. Each `limit` is from 0 through 1000.",
        defect: "The trim guard accepts any unequal limit, including limits that extend the file.",
        hints: ["Try trimming a short file with a much larger limit.", "The assignment is only valid when it reduces the current length.", "Enter the update branch only when `limit` is smaller than `length`."],
        c: `int length, n;
READ(length);
READ(n);
for (int i = 0; i < n; i++) {
    int limit;
    READ(limit);
    if (limit < length) {
        length = limit;
    }
}
OUT(length);`,
        py: `length = read_int()
n = read_int()
for _ in range(n):
    limit = read_int()
    if limit < length:
        length = limit
print(length)`,
        cbug: ["limit < length", "limit != length"],
        pybug: ["limit < length", "limit != length"],
        cases: [["12 3\n8 20 6", "6"], ["4 1\n4", "4"], ["3 1\n9", "3"], ["0 2\n8 1", "0"], ["1000 0", "1000"], ["1000 2\n0 1000", "0"], ["20 4\n18 15 11 2", "2"], ["7 3\n20 30 40", "7"]],
        witness: 3,
        probe: ["31 4\n22 46 14 28", "14"]
    },
    {
        title: "Overwrite End Marker", difficulty: 16,
        guide: "A write starts at `start` and covers `amount` bytes. `end` is the position just after those bytes. `length` marks the position just after the current file.",
        incident: "The rogue AI AEGIS damaged an archive's length tracker. Patch checks writes that overlap the old end.",
        symptom: "A write that begins inside the file can extend past its end without updating the length.",
        task: "Process writes in order. A write covers positions `start` through `start + amount - 1`. Extend the file to `start + amount` if that is beyond its current length. Otherwise keep the old length. Gaps are allowed and count toward the length.",
        input: "Read the initial `length` and `n`, then `n` pairs `start amount`.",
        output: "Print the final file length.",
        example: "Input `5 2 3 4 0 2` first extends the file to 7 bytes. The second write stays inside it. Print `7`.",
        constraints: "`0 <= length <= 1000`. `0 <= n <= 50`. `0 <= start <= 1000`. `1 <= amount <= 100`.",
        defect: "Extension is tested using the write's starting position instead of its ending position.",
        hints: ["A write may start before the old end but finish after it.", "Compare the roles of `start` and `end` in deciding whether the file grows.", "Test the position just after the write against `length`, and retain the existing update."],
        c: `int length, n;
READ(length);
READ(n);
for (int i = 0; i < n; i++) {
    int start, amount;
    READ(start);
    READ(amount);
    int end = start + amount;
    if (end > length) {
        length = end;
    }
}
OUT(length);`,
        py: `length = read_int()
n = read_int()
for _ in range(n):
    start = read_int()
    amount = read_int()
    end = start + amount
    if end > length:
        length = end
print(length)`,
        cbug: ["end > length", "start > length"],
        pybug: ["end > length", "start > length"],
        cases: [["5 2\n3 4\n0 2", "7"], ["10 1\n2 3", "10"], ["4 1\n4 2", "6"], ["0 1\n0 1", "1"], ["8 0", "8"], ["3 2\n10 2\n1 2", "12"], ["1000 1\n1000 100", "1100"], ["9 3\n0 9\n8 1\n2 2", "9"]],
        witness: 3,
        probe: ["17 3\n15 7\n21 5\n1 2", "26"]
    },
    {
        title: "Cursor at End", difficulty: 18,
        guide: "`cursor` is the next byte position to read. `take` starts as a requested length and is limited by the unread bytes. `served` counts bytes actually returned.",
        incident: "The rogue AI AEGIS changed a file reader. Mira checks repeated reads near the end of a file.",
        symptom: "After a short read, the cursor can move beyond the file.",
        task: "A file has `length` bytes and starts with its read cursor at 0. For each request, return as many bytes as requested, or all remaining bytes if fewer remain. Advance the cursor only by the bytes returned. Reads at the end return 0. Print the final cursor and total returned bytes.",
        input: "Read `length` and `n`, then `n` requested byte counts.",
        output: "Print the final cursor and total returned bytes.",
        example: "Input `5 2 3 4` returns 3 bytes, then 2. Print `5 5`.",
        constraints: "`0 <= length <= 1000`. `0 <= n <= 50`. Each `request` is from 0 through 1000.",
        defect: "The cursor advances by the requested amount rather than the clipped amount actually returned.",
        hints: ["Trace a request larger than the unread part of the file.", "`request` and `take` can differ after the limit check.", "The cursor and `served` should both advance by the actual transfer length."],
        c: `int length, n;
READ(length);
READ(n);
int cursor = 0;
int served = 0;
for (int i = 0; i < n; i++) {
    int request;
    READ(request);
    int take = request;
    if (take > length - cursor) {
        take = length - cursor;
    }
    cursor += take;
    served += take;
}
OUT(cursor);
OUT(served);`,
        py: `length = read_int()
n = read_int()
cursor = 0
served = 0
for _ in range(n):
    request = read_int()
    take = request
    if take > length - cursor:
        take = length - cursor
    cursor += take
    served += take
print(cursor, served)`,
        cbug: ["cursor += take;", "cursor += request;"],
        pybug: ["cursor += take", "cursor += request"],
        cases: [["5 2\n3 4", "5 5"], ["8 2\n3 2", "5 5"], ["2 1\n7", "2 2"], ["0 2\n1 2", "0 0"], ["10 0", "0 0"], ["5 3\n5 0 2", "5 5"], ["1000 3\n300 300 300", "900 900"], ["6 4\n2 5 1 0", "6 6"]],
        witness: 3,
        probe: ["23 4\n8 12 9 1", "23 23"]
    },
    {
        title: "Severity Byte Filter", difficulty: 9,
        guide: "`severity` is a record's importance level, and `bytes` is its stored length. `threshold` determines eligibility; `total` counts stored bytes rather than records.",
        incident: "The rogue AI AEGIS changed a recovery log filter. Patch measures the records that should be kept.",
        symptom: "Records exactly at the configured importance level can disappear.",
        task: "Keep each record whose severity is at least `threshold`. Add its byte length to the total. Ignore lower-severity records. Severity equality qualifies.",
        input: "Read `n` and `threshold`, then `n` pairs `severity bytes`.",
        output: "Print the total bytes kept.",
        example: "Input `3 2 1 9 2 4 4 7` keeps the last two records. Print `11`.",
        constraints: "`0 <= n <= 50`. `0 <= threshold, severity <= 5`. `1 <= bytes <= 200`.",
        defect: "The severity filter uses a strict comparison and drops records at the threshold.",
        hints: ["Test a record whose severity equals the threshold.", "Read the words 'at least' in the rule.", "The keep condition needs to accept both higher and equal severity values."],
        c: `int n, threshold;
READ(n);
READ(threshold);
int total = 0;
for (int i = 0; i < n; i++) {
    int severity, bytes;
    READ(severity);
    READ(bytes);
    if (severity >= threshold) {
        total += bytes;
    }
}
OUT(total);`,
        py: `n = read_int()
threshold = read_int()
total = 0
for _ in range(n):
    severity = read_int()
    bytes = read_int()
    if severity >= threshold:
        total += bytes
print(total)`,
        cbug: ["severity >= threshold", "severity > threshold"],
        pybug: ["severity >= threshold", "severity > threshold"],
        cases: [["3 2\n1 9\n2 4\n4 7", "11"], ["1 3\n5 20", "20"], ["1 0\n0 9", "9"], ["0 5", "0"], ["2 5\n4 3\n5 7", "7"], ["2 2\n0 100\n1 100", "0"], ["3 1\n1 1\n1 2\n1 3", "6"], ["2 0\n0 200\n5 200", "400"]],
        witness: 3,
        probe: ["4 4\n4 17\n3 26\n5 31\n4 8", "56"]
    },
    {
        title: "Checksum Byte Wrap", difficulty: 12,
        guide: "`checksum` is a running check value stored in the range 0 through 255. Each loop pass adds a byte, then brings the check value back into that range.",
        incident: "The rogue AI AEGIS altered a packet checker. Mira verifies a simple eight-bit sum.",
        symptom: "A total of 255 or more can wrap at the wrong point.",
        task: "Start the checksum at 0. Add each byte in input order. After each addition, retain the remainder after division by 256. Print the final checksum. With no bytes, print 0.",
        input: "Read `n`, then `n` byte values.",
        output: "Print one checksum from 0 through 255.",
        example: "Input `3 200 100 7` gives checksum values 200, 44 and 51. Print `51`.",
        constraints: "`0 <= n <= 50`. Every byte `value` is from 0 through 255.",
        defect: "The checksum wraps using 255 possible states instead of 256.",
        hints: ["A single byte with value 255 must keep that value.", "Count the integers from 0 through 255, including both ends.", "Use the number of possible byte values as the remainder divisor."],
        c: `int n;
READ(n);
int checksum = 0;
for (int i = 0; i < n; i++) {
    int value;
    READ(value);
    checksum = (checksum + value) % 256;
}
OUT(checksum);`,
        py: `n = read_int()
checksum = 0
for _ in range(n):
    value = read_int()
    checksum = (checksum + value) % 256
print(checksum)`,
        cbug: ["% 256", "% 255"],
        pybug: ["% 256", "% 255"],
        cases: [["3\n200 100 7", "51"], ["2\n1 2", "3"], ["1\n255", "255"], ["0", "0"], ["2\n128 128", "0"], ["4\n255 255 255 255", "252"], ["3\n0 0 0", "0"], ["5\n50 50 50 50 50", "250"]],
        witness: 3,
        probe: ["4\n173 94 250 19", "24"]
    },
    {
        title: "Minimum Packet Padding", difficulty: 14,
        guide: "`payload` is the real data length. `sent` starts at that length and may be enlarged to satisfy a minimum packet size. Padding affects wire bytes only.",
        incident: "The rogue AI AEGIS changed the recovery sender's padding rule. Patch checks the bytes placed on the link.",
        symptom: "Short packets can be larger than the required minimum.",
        task: "Each packet must send at least `minimum` bytes. If its payload is shorter, add only enough padding to reach `minimum`. Longer payloads stay unchanged. Add all sent lengths. Headers are outside this model and cost no bytes.",
        input: "Read `n` and `minimum`, then `n` payload lengths.",
        output: "Print the total bytes sent, including padding.",
        example: "Input `3 8 3 8 10` sends lengths 8, 8 and 10. Print `26`.",
        constraints: "`0 <= n <= 50`. `1 <= minimum <= 100`. `0 <= payload <= 200`.",
        defect: "A short packet receives a full minimum's worth of extra bytes instead of being raised to the minimum.",
        hints: ["A three-byte payload with an eight-byte minimum needs five padding bytes.", "Look at the update to `sent` in the short-packet branch.", "That branch's final `sent` value should be exactly `minimum`."],
        c: `int n, minimum;
READ(n);
READ(minimum);
int total = 0;
for (int i = 0; i < n; i++) {
    int payload;
    READ(payload);
    int sent = payload;
    if (sent < minimum) {
        sent = minimum;
    }
    total += sent;
}
OUT(total);`,
        py: `n = read_int()
minimum = read_int()
total = 0
for _ in range(n):
    payload = read_int()
    sent = payload
    if sent < minimum:
        sent = minimum
    total += sent
print(total)`,
        cbug: ["sent = minimum;", "sent += minimum;"],
        pybug: ["sent = minimum", "sent += minimum"],
        cases: [["3 8\n3 8 10", "26"], ["2 4\n4 9", "13"], ["1 5\n2", "5"], ["0 10", "0"], ["2 1\n0 1", "2"], ["3 100\n99 100 200", "400"], ["2 6\n0 0", "12"], ["4 3\n1 2 3 4", "13"]],
        witness: 3,
        probe: ["3 13\n6 13 29", "55"]
    },
    {
        title: "Final Buffer Dispatch", difficulty: 20,
        guide: "`pending` counts bytes in the current buffer. A flush sends that entire buffer and makes it empty. `flushes` counts dispatches, not bytes.",
        incident: "The rogue AI AEGIS changed a log sender. Mira checks that the last partly filled buffer is sent.",
        symptom: "A final group smaller than the buffer capacity can be left unsent.",
        task: "Records arrive in order and cannot be split. Start with an empty buffer of `capacity` bytes. Before adding a record that would exceed capacity, flush the current buffer. Add the record to the now available space. After all records, flush once if the buffer is nonempty. Exact fits may stay until the next record or the end. Count all flushes.",
        input: "Read `capacity` and `n`, then `n` record lengths.",
        output: "Print the number of flushes.",
        example: "Input `5 3 3 3 1` flushes the first record before adding the second, then flushes the final four bytes. Print `2`.",
        constraints: "`1 <= capacity <= 100`. `0 <= n <= 50`. Every `size` satisfies `1 <= size <= capacity`.",
        defect: "The final flush is performed only for a completely full buffer.",
        hints: ["Try one record smaller than the capacity.", "The loop handles overflow, but the final check handles data left at the end.", "The final dispatch depends on whether `pending` is nonzero, not whether it fills the buffer."],
        c: `int capacity, n;
READ(capacity);
READ(n);
int pending = 0;
int flushes = 0;
for (int i = 0; i < n; i++) {
    int size;
    READ(size);
    if (pending + size > capacity) {
        flushes++;
        pending = 0;
    }
    pending += size;
}
if (pending > 0) {
    flushes++;
}
OUT(flushes);`,
        py: `capacity = read_int()
n = read_int()
pending = 0
flushes = 0
for _ in range(n):
    size = read_int()
    if pending + size > capacity:
        flushes += 1
        pending = 0
    pending += size
if pending > 0:
    flushes += 1
print(flushes)`,
        cbug: ["if (pending > 0)", "if (pending == capacity)"],
        pybug: ["if pending > 0:", "if pending == capacity:"],
        cases: [["5 3\n3 3 1", "2"], ["4 2\n2 2", "1"], ["7 1\n3", "1"], ["8 0", "0"], ["1 3\n1 1 1", "3"], ["6 3\n4 4 4", "3"], ["10 4\n2 3 1 4", "1"], ["9 4\n5 4 9 1", "3"]],
        witness: 3,
        probe: ["11 5\n6 6 2 7 3", "3"]
    },
    {
        title: "Clean After Flush", difficulty: 17,
        guide: "`dirty` records whether an unsaved write exists. Several writes can share one later save. `saves` counts physical saves caused by flush commands.",
        incident: "The rogue AI AEGIS changed a save indicator. Patch checks repeated flushes of a recovery buffer.",
        symptom: "An unchanged buffer can be saved again after it was already flushed.",
        task: "Start with a clean buffer. Command 1 writes to it and makes it dirty. Command 2 flushes it: if dirty, count one save and make it clean; if clean, do nothing. There is no automatic flush at the end. Print the number of saves.",
        input: "Read `n`, then `n` command codes.",
        output: "Print the number of physical saves.",
        example: "Input `5 1 1 2 2 1` saves once, on the first flush. The final write remains unsaved. Print `1`.",
        constraints: "`0 <= n <= 50`. Each `op` is 1 or 2.",
        defect: "A successful flush leaves the buffer marked dirty, so later flushes save it again.",
        hints: ["Try one write followed by two flushes.", "Check the state after a successful save rather than the count update.", "A successful flush must clear `dirty` before the next command."],
        c: `int n;
READ(n);
int dirty = 0;
int saves = 0;
for (int i = 0; i < n; i++) {
    int op;
    READ(op);
    if (op == 1) {
        dirty = 1;
    } else if (dirty == 1) {
        saves++;
        dirty = 0;
    }
}
OUT(saves);`,
        py: `n = read_int()
dirty = 0
saves = 0
for _ in range(n):
    op = read_int()
    if op == 1:
        dirty = 1
    elif dirty == 1:
        saves += 1
        dirty = 0
print(saves)`,
        cbug: ["dirty = 0;\n    }", "dirty = 1;\n    }"],
        pybug: ["        dirty = 0", "        dirty = 1"],
        cases: [["5\n1 1 2 2 1", "1"], ["3\n2 2 2", "0"], ["3\n1 2 2", "1"], ["0", "0"], ["4\n1 2 1 2", "2"], ["2\n1 1", "0"], ["6\n2 1 2 2 2 2", "1"], ["7\n1 1 2 1 1 2 2", "2"]],
        witness: 3,
        probe: ["8\n1 2 2 1 2 2 1 2", "3"]
    },
    {
        title: "Rejected Byte Ledger", difficulty: 14,
        guide: "`used` counts buffer space already occupied. Each arriving packet is accepted whole or rejected whole. `dropped` measures lost bytes, not lost packets.",
        incident: "The rogue AI AEGIS altered a full-buffer report. Mira measures data lost during a packet burst.",
        symptom: "The loss report can count rejected packets instead of their byte lengths.",
        task: "Start with an empty buffer of `capacity` bytes. For each arriving packet, keep it if its entire size fits in the remaining space. Otherwise reject it and add its full size to the dropped-byte total. Rejection uses no space. No packets leave during this burst.",
        input: "Read `capacity` and `n`, then `n` packet sizes.",
        output: "Print the occupied bytes and dropped bytes, in that order.",
        example: "Input `5 3 4 3 1` keeps 4 bytes, rejects 3, then keeps 1. Print `5 3`.",
        constraints: "`0 <= capacity <= 200`. `0 <= n <= 50`. Every `size` is from 1 through 200.",
        defect: "Each rejected packet contributes one to a counter that is supposed to measure bytes.",
        hints: ["Reject a packet longer than one byte.", "The two totals use the same unit: bytes.", "In the rejection branch, increase `dropped` by the rejected packet's full `size`."],
        c: `int capacity, n;
READ(capacity);
READ(n);
int used = 0;
int dropped = 0;
for (int i = 0; i < n; i++) {
    int size;
    READ(size);
    if (used + size <= capacity) {
        used += size;
    } else {
        dropped += size;
    }
}
OUT(used);
OUT(dropped);`,
        py: `capacity = read_int()
n = read_int()
used = 0
dropped = 0
for _ in range(n):
    size = read_int()
    if used + size <= capacity:
        used += size
    else:
        dropped += size
print(used, dropped)`,
        cbug: ["dropped += size;", "dropped += 1;"],
        pybug: ["dropped += size", "dropped += 1"],
        cases: [["5 3\n4 3 1", "5 3"], ["8 2\n3 5", "8 0"], ["0 1\n7", "0 7"], ["0 0", "0 0"], ["2 3\n3 2 1", "2 4"], ["200 2\n200 200", "200 200"], ["1 3\n1 1 1", "1 2"], ["10 4\n7 5 2 1", "10 5"]],
        witness: 3,
        probe: ["17 5\n12 8 4 2 1", "17 10"]
    },
    {
        title: "Partial Buffer Drain", difficulty: 16,
        guide: "`queued` counts available bytes. A drain's `amount` is reduced when fewer bytes are available. Appends in this model have no capacity limit.",
        incident: "The rogue AI AEGIS altered a byte buffer. Patch checks requests that drain more data than is available.",
        symptom: "An oversized drain can leave every queued byte untouched.",
        task: "Start with 0 queued bytes. Command `1 amount` appends that many bytes. Command `2 amount` removes up to that many bytes; if fewer are queued, remove all of them. Process commands in order. Draining an empty buffer does nothing.",
        input: "Read `n`, then `n` pairs `op amount`.",
        output: "Print the final queued byte count.",
        example: "Input `3 1 4 2 9 1 3` queues 4, drains all 4, then queues 3. Print `3`.",
        constraints: "`0 <= n <= 50`. `op` is 1 or 2. `0 <= amount <= 100`.",
        defect: "An oversized drain is reduced to zero instead of to the number of queued bytes.",
        hints: ["Ask to drain five bytes when only two are queued.", "A short drain still transfers the bytes that are available.", "When the drain exceeds `queued`, replace its `amount` with `queued` before subtracting."],
        c: `int n;
READ(n);
int queued = 0;
for (int i = 0; i < n; i++) {
    int op, amount;
    READ(op);
    READ(amount);
    if (op == 1) {
        queued += amount;
    } else {
        if (amount > queued) {
            amount = queued;
        }
        queued -= amount;
    }
}
OUT(queued);`,
        py: `n = read_int()
queued = 0
for _ in range(n):
    op = read_int()
    amount = read_int()
    if op == 1:
        queued += amount
    else:
        if amount > queued:
            amount = queued
        queued -= amount
print(queued)`,
        cbug: ["amount = queued;", "amount = 0;"],
        pybug: ["amount = queued", "amount = 0"],
        cases: [["3\n1 4\n2 9\n1 3", "3"], ["2\n1 8\n2 3", "5"], ["2\n1 2\n2 5", "0"], ["0", "0"], ["2\n2 9\n1 4", "4"], ["4\n1 4\n2 4\n2 1\n1 2", "2"], ["3\n1 100\n1 100\n2 99", "101"], ["4\n1 3\n2 8\n1 2\n2 1", "1"]],
        witness: 3,
        probe: ["5\n1 17\n2 23\n1 11\n2 4\n2 2", "5"]
    },
    {
        title: "Suppressed Log Clock", difficulty: 20,
        guide: "`last` is the time of the last record actually written, not the last attempt. The sentinel `-cooldown` lets the first nonnegative timestamp qualify.",
        incident: "The rogue AI AEGIS changed a repeated-alert limiter. Mira checks whether ignored alerts delay useful logs.",
        symptom: "A series of suppressed attempts can prevent a later eligible log.",
        task: "A log attempt at time `time` is written only if at least `cooldown` time units have passed since the last written log. The first attempt is always written. Suppressed attempts do not change the last-written time. Process nondecreasing timestamps and count written logs.",
        input: "Read `n` and `cooldown`, then `n` timestamps.",
        output: "Print the number of logs written.",
        example: "Input `3 5 0 2 5` writes at 0 and 5. The attempt at 2 is ignored. Print `2`.",
        constraints: "`0 <= n <= 50`. `1 <= cooldown <= 100`. `0 <= time <= 1000`. Timestamps are nondecreasing and may repeat.",
        defect: "The last-written time is updated for suppressed attempts as well as written logs.",
        hints: ["Insert a suppressed attempt between two times exactly one cooldown apart.", "Ask which event `last` is meant to remember.", "Keep the `last` update inside the same branch that increments `written`."],
        c: `int n, cooldown;
READ(n);
READ(cooldown);
int last = -cooldown;
int written = 0;
for (int i = 0; i < n; i++) {
    int time;
    READ(time);
    if (time - last >= cooldown) {
        written++;
        last = time;
    }
}
OUT(written);`,
        py: `n = read_int()
cooldown = read_int()
last = -cooldown
written = 0
for _ in range(n):
    time = read_int()
    if time - last >= cooldown:
        written += 1
        last = time
print(written)`,
        cbug: ["        last = time;\n    }", "    }\n    last = time;"],
        pybug: ["        last = time", "    last = time"],
        cases: [["3 5\n0 2 5", "2"], ["2 4\n0 4", "2"], ["4 3\n0 1 2 3", "2"], ["0 5", "0"], ["3 1\n7 7 8", "2"], ["4 10\n1 11 21 31", "4"], ["5 4\n2 3 6 7 10", "3"], ["1 100\n1000", "1"]],
        witness: 3,
        probe: ["6 7\n3 6 9 10 15 17", "3"]
    },
    {
        title: "Empty File Still Exists", difficulty: 14,
        guide: "A directory entry of `-1` means no file. A nonnegative entry is a file length, including length 0. Every existing file also consumes `metadata` bytes.",
        incident: "The rogue AI AEGIS damaged a directory size report. Patch checks storage charged for empty files.",
        symptom: "A zero-byte file can lose its metadata charge.",
        task: "For each directory slot, ignore `-1`, which means unused. Otherwise charge its file length plus `metadata` bytes. A zero-byte file exists and still pays the metadata charge. Add all charges.",
        input: "Read `n` and `metadata`, then `n` directory entries.",
        output: "Print the total charged bytes.",
        example: "Input `3 2 -1 0 5` ignores the unused slot and charges 2 and 7. Print `9`.",
        constraints: "`1 <= n <= 50`. `1 <= metadata <= 20`. Each `size` is -1 or an integer from 0 through 200.",
        defect: "The existence test excludes zero-length files along with unused slots.",
        hints: ["Compare an unused directory slot with a real empty file.", "Only one sentinel value means that no file exists.", "Include size 0 in the charged branch while continuing to exclude -1."],
        c: `int n, metadata;
READ(n);
READ(metadata);
int total = 0;
for (int i = 0; i < n; i++) {
    int size;
    READ(size);
    if (size >= 0) {
        total += size + metadata;
    }
}
OUT(total);`,
        py: `n = read_int()
metadata = read_int()
total = 0
for _ in range(n):
    size = read_int()
    if size >= 0:
        total += size + metadata
print(total)`,
        cbug: ["size >= 0", "size > 0"],
        pybug: ["size >= 0", "size > 0"],
        cases: [["3 2\n-1 0 5", "9"], ["2 3\n4 8", "18"], ["1 7\n0", "7"], ["1 1\n-1", "0"], ["3 5\n0 0 0", "15"], ["3 20\n200 -1 0", "240"], ["4 1\n-1 2 -1 3", "7"], ["2 4\n-1 -1", "0"]],
        witness: 3,
        probe: ["5 9\n0 16 -1 0 3", "55"]
    },
    {
        title: "One Terminator per Record", difficulty: 10,
        guide: "`word` is one log record without its ending marker. `length` counts the letters; `total` measures the stored bytes after framing every record.",
        incident: "The rogue AI AEGIS changed the log storage meter. Mira checks the byte used to end each record.",
        symptom: "Record text is counted, but record endings can be missing from the total.",
        task: "Each input word is stored as one log record. Every letter uses one byte, and each record also has one ending byte. Add the stored sizes of all records. Even a one-letter record uses two bytes.",
        input: "Read `n`, then `n` nonempty lowercase words.",
        output: "Print the total stored bytes, including one ending byte per record.",
        example: "Input `2 go wait` stores 3 and 5 bytes. Print `8`.",
        constraints: "`1 <= n <= 30`. Each `word` has 1 through 40 lowercase English letters.",
        defect: "The record size omits its one-byte ending marker.",
        hints: ["Count both parts of one stored record.", "The input word does not contain its stored ending byte.", "Add one ending byte each time a word's length is added to `total`."],
        c: `int n;
READ(n);
int total = 0;
for (int i = 0; i < n; i++) {
    TEXT(word);
    WORD(word);
    int length = LEN(word);
    total += length + 1;
}
OUT(total);`,
        py: `n = read_int()
total = 0
for _ in range(n):
    word = read_word()
    length = len(word)
    total += length + 1
print(total)`,
        cbug: ["total += length + 1;", "total += length;"],
        pybug: ["total += length + 1", "total += length"],
        cases: [["2\ngo wait", "8"], ["1\na", "2"], ["3\nx yy zzz", "9"], ["1\nrecovery", "9"], ["2\na b", "4"], ["3\nlog log log", "12"], ["2\nabc defgh", "10"], ["4\na bb c dddd", "12"]],
        witness: 3,
        probe: ["3\naegis buffer packet", "20"]
    },
    {
        title: "Drive Travel Ledger", difficulty: 18,
        guide: "`head` is the drive's current numbered track. `move` is a signed difference until its direction is removed. `travel` counts distance in both directions.",
        incident: "The rogue AI AEGIS changed a disk movement report. Patch checks a fixed list of recovery reads.",
        symptom: "Moving toward a lower-numbered track can reduce the travel total.",
        task: "Visit every requested track in the given order; do not reorder requests. Moving between two tracks costs the absolute difference of their numbers. Add all movement, including moves toward smaller numbers. A repeated track costs 0.",
        input: "Read the initial `head` and `n`, then `n` requested tracks.",
        output: "Print the total distance moved.",
        example: "Input `10 3 14 9 9` costs 4, 5 and 0. Print `9`.",
        constraints: "`0 <= head, track <= 200`. `0 <= n <= 50`.",
        defect: "The negative movement adjustment leaves the signed difference negative instead of making it a distance.",
        hints: ["A trip from track 8 to track 3 costs five units, not minus five.", "Check what the negative-move branch does to `move`.", "Negate a negative `move` before adding it to `travel`."],
        c: `int head, n;
READ(head);
READ(n);
int travel = 0;
for (int i = 0; i < n; i++) {
    int track;
    READ(track);
    int move = track - head;
    if (move < 0) {
        move = -move;
    }
    travel += move;
    head = track;
}
OUT(travel);`,
        py: `head = read_int()
n = read_int()
travel = 0
for _ in range(n):
    track = read_int()
    move = track - head
    if move < 0:
        move = -move
    travel += move
    head = track
print(travel)`,
        cbug: ["move = -move;", "move = move;"],
        pybug: ["move = -move", "move = move"],
        cases: [["10 3\n14 9 9", "9"], ["0 2\n3 7", "7"], ["8 1\n3", "5"], ["100 0", "0"], ["200 2\n0 200", "400"], ["5 3\n5 5 5", "0"], ["2 4\n7 1 8 0", "26"], ["0 3\n200 0 200", "600"]],
        witness: 3,
        probe: ["31 4\n52 18 18 47", "84"]
    },
    {
        title: "Block Wear Allowance", difficulty: 19,
        guide: "`wear[block]` counts successful writes to one storage block. A request that reaches a worn-out block is ignored. The total `accepted` combines successful requests.",
        incident: "The rogue AI AEGIS changed a storage wear limit. Mira checks that every block gets its own write allowance.",
        symptom: "Writing one block many times can stop writes to other fresh blocks.",
        task: "Each of `blocks` storage blocks begins with 0 writes. Accept a write only while that block has received fewer than `limit` successful writes. Acceptance increases that block's write count and the total accepted count. Rejection changes neither. The allowance is separate for every block.",
        input: "Read `blocks`, `limit` and `n`, then `n` requested block IDs.",
        output: "Print the number of accepted writes.",
        example: "Input `2 1 3 0 0 1` accepts the first write to each block, so print `2`.",
        constraints: "`1 <= blocks <= 20`. `1 <= limit <= 10`. `0 <= n <= 50`. `0 <= block < blocks`.",
        defect: "The wear guard checks the global acceptance total instead of the target block's write count.",
        hints: ["Exhaust one block's allowance, then request a different block.", "The storage limit applies independently to each block.", "Use the requested block's entry in `wear` for the acceptance comparison."],
        c: `int blocks, limit, n;
READ(blocks);
READ(limit);
READ(n);
ARRAY(wear, 20);
int accepted = 0;
for (int i = 0; i < n; i++) {
    int block;
    READ(block);
    if (wear[block] < limit) {
        wear[block]++;
        accepted++;
    }
}
OUT(accepted);`,
        py: `blocks = read_int()
limit = read_int()
n = read_int()
wear = [0] * blocks
accepted = 0
for _ in range(n):
    block = read_int()
    if wear[block] < limit:
        wear[block] += 1
        accepted += 1
print(accepted)`,
        cbug: ["wear[block] < limit", "accepted < limit"],
        pybug: ["wear[block] < limit", "accepted < limit"],
        cases: [["2 1 3\n0 0 1", "2"], ["1 2 3\n0 0 0", "2"], ["3 1 3\n0 1 2", "3"], ["20 10 0", "0"], ["2 2 6\n0 1 0 1 0 1", "4"], ["3 2 4\n2 2 2 0", "3"], ["1 10 2\n0 0", "2"], ["4 1 5\n3 3 3 2 0", "3"]],
        witness: 3,
        probe: ["4 2 7\n1 1 1 3 3 0 0", "6"]
    },
    {
        title: "Shared Log Header", difficulty: 20,
        guide: "`used` includes all stored bytes. `extra` is the price of the next record. An empty log needs one shared header before its first accepted record.",
        incident: "The rogue AI AEGIS changed a log quota calculator. Patch checks records stored after the first one.",
        symptom: "Later records can be rejected because the shared header is charged again.",
        task: "An empty log has `capacity` bytes available. Its first accepted record costs its size plus one `header`. Later accepted records cost only their own size. Accept a record if its full cost fits; otherwise ignore it. A rejected first record does not create a header. All record sizes are positive.",
        input: "Read `capacity`, `header` and `n`, then `n` record sizes.",
        output: "Print the accepted record count and total stored bytes.",
        example: "Input `10 2 3 3 4 2` accepts sizes 3 and 4 for a total of 9 bytes, then rejects size 2. Print `2 9`.",
        constraints: "`0 <= capacity <= 200`. `1 <= header <= 20`. `0 <= n <= 50`. `1 <= size <= 200`.",
        defect: "The header charge is added for every candidate record instead of only while the log is empty.",
        hints: ["Compare the cost of the first accepted record with the second.", "Only an empty log still needs its shared header.", "Guard the header addition using the current empty-log condition on `used`."],
        c: `int capacity, header, n;
READ(capacity);
READ(header);
READ(n);
int used = 0;
int accepted = 0;
for (int i = 0; i < n; i++) {
    int size;
    READ(size);
    int extra = size;
    if (used == 0) {
        extra += header;
    }
    if (used + extra <= capacity) {
        used += extra;
        accepted++;
    }
}
OUT(accepted);
OUT(used);`,
        py: `capacity = read_int()
header = read_int()
n = read_int()
used = 0
accepted = 0
for _ in range(n):
    size = read_int()
    extra = size
    if used == 0:
        extra += header
    if used + extra <= capacity:
        used += extra
        accepted += 1
print(accepted, used)`,
        cbug: ["if (used == 0)", "if (size > 0)"],
        pybug: ["if used == 0:", "if size > 0:"],
        cases: [["10 2 3\n3 4 2", "2 9"], ["5 2 1\n3", "1 5"], ["8 2 2\n2 4", "2 8"], ["0 1 2\n1 2", "0 0"], ["20 4 0", "0 0"], ["8 3 3\n9 2 3", "2 8"], ["3 3 1\n1", "0 0"], ["12 1 4\n2 2 2 2", "4 9"]],
        witness: 3,
        probe: ["29 5 4\n7 8 6 4", "3 26"]
    },
    {
        title: "Seek from File End", difficulty: 23,
        guide: "`base` selects an origin before applying `offset`. The three origins are the beginning, current cursor, and file end. The two bounds checks keep `cursor` inside the file.",
        incident: "The rogue AI AEGIS altered a file seek command. Mira checks recovery reads positioned relative to the file end.",
        symptom: "An end-relative seek can behave like a current-relative seek.",
        task: "A file has `length` bytes and starts with cursor 0. Process seek pairs `origin offset`. Origin 0 uses base 0; origin 1 uses the current cursor; origin 2 uses the file length. Set the cursor to base plus the signed offset, then clamp it to the range 0 through `length`, including both ends. Seeks never change the file length.",
        input: "Read `length` and `n`, then `n` pairs `origin offset`.",
        output: "Print the final cursor.",
        example: "Input `10 2 0 3 2 -2` seeks to 3, then two bytes before the end. Print `8`.",
        constraints: "`0 <= length <= 1000`. `0 <= n <= 50`. `origin` is 0, 1 or 2. `-1000 <= offset <= 1000`.",
        defect: "The end-relative branch chooses the current cursor rather than the fixed file length as its base.",
        hints: ["Try an end-relative seek while the cursor is still at the beginning.", "Origins 1 and 2 must use different bases unless the cursor already equals the file length.", "Select the fixed file end for origin 2 before applying the existing offset and bounds checks."],
        c: `int length, n;
READ(length);
READ(n);
int cursor = 0;
for (int i = 0; i < n; i++) {
    int origin, offset;
    READ(origin);
    READ(offset);
    int base = 0;
    if (origin == 1) {
        base = cursor;
    } else if (origin == 2) {
        base = length;
    }
    cursor = base + offset;
    if (cursor < 0) {
        cursor = 0;
    }
    if (cursor > length) {
        cursor = length;
    }
}
OUT(cursor);`,
        py: `length = read_int()
n = read_int()
cursor = 0
for _ in range(n):
    origin = read_int()
    offset = read_int()
    base = 0
    if origin == 1:
        base = cursor
    elif origin == 2:
        base = length
    cursor = base + offset
    if cursor < 0:
        cursor = 0
    if cursor > length:
        cursor = length
print(cursor)`,
        cbug: ["base = length;", "base = cursor;"],
        pybug: ["base = length", "base = cursor"],
        cases: [["10 2\n0 3\n2 -2", "8"], ["8 2\n0 3\n1 2", "5"], ["12 1\n2 -3", "9"], ["0 2\n2 8\n1 -9", "0"], ["20 0", "0"], ["5 2\n0 -7\n1 100", "5"], ["1000 2\n2 0\n1 -1", "999"], ["9 3\n0 4\n2 -20\n1 3", "3"]],
        witness: 3,
        probe: ["37 3\n0 11\n2 -6\n1 -4", "27"]
    },
    {
        title: "Arrivals Before Service", difficulty: 24,
        guide: "`queued` is the previous tick's waiting count. `available` includes this tick's admitted arrivals. Overflow is counted in `dropped`; `take` is the number served this tick.",
        incident: "The rogue AI AEGIS altered a packet gate's tick order. Patch checks whether new arrivals can leave immediately.",
        symptom: "Packets arriving at an empty gate can be forced to wait an extra tick.",
        task: "Start with no queued packets. On each tick, first add the arrivals. If this exceeds `capacity`, drop the excess immediately. Then serve up to `rate` packets from the admitted queue, including packets that just arrived. No service occurs after the final listed tick. Count all served and dropped packets.",
        input: "Read `capacity`, `rate` and `n`, then `n` arrival counts, one per tick.",
        output: "Print served packets, dropped packets and packets still queued, in that order.",
        example: "Input `4 2 2 3 4` serves 2 after each arrival. One packet is dropped on tick 2 and two remain. Print `4 1 2`.",
        constraints: "`1 <= capacity <= 50`. `1 <= rate <= 50`. `0 <= n <= 50`. `0 <= arrivals <= 100`.",
        defect: "The service amount is based on the old queue rather than the queue after admitting this tick's arrivals.",
        hints: ["Trace one tick with an empty queue and one arriving packet.", "Compare `queued` and `available` after the capacity check.", "Choose the service amount from the admitted queue for this tick, then retain the rate limit."],
        c: `int capacity, rate, n;
READ(capacity);
READ(rate);
READ(n);
int queued = 0;
int served = 0;
int dropped = 0;
for (int i = 0; i < n; i++) {
    int arrivals;
    READ(arrivals);
    int available = queued + arrivals;
    if (available > capacity) {
        dropped += available - capacity;
        available = capacity;
    }
    int take = available;
    if (take > rate) {
        take = rate;
    }
    queued = available - take;
    served += take;
}
OUT(served);
OUT(dropped);
OUT(queued);`,
        py: `capacity = read_int()
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
    take = available
    if take > rate:
        take = rate
    queued = available - take
    served += take
print(served, dropped, queued)`,
        cbug: ["int take = available;", "int take = queued;"],
        pybug: ["take = available", "take = queued"],
        cases: [["4 2 2\n3 4", "4 1 2"], ["3 1 2\n0 0", "0 0 0"], ["5 2 1\n1", "1 0 0"], ["1 5 2\n9 0", "1 8 0"], ["10 3 0", "0 0 0"], ["4 1 3\n4 0 0", "3 0 1"], ["2 2 3\n2 2 2", "6 0 0"], ["5 2 3\n10 10 0", "6 13 1"]],
        witness: 3,
        probe: ["7 3 4\n2 9 0 4", "11 2 2"]
    },
    {
        title: "Whole Range Reservation", difficulty: 22,
        guide: "`owner` stores 0 for a free block and a positive reservation number otherwise. `possible` summarizes a scan of the requested range. A separate loop applies an accepted reservation.",
        incident: "The rogue AI AEGIS altered a block reservation check. Mira checks that one busy block rejects the whole request.",
        symptom: "A request can overwrite blocks belonging to an earlier reservation.",
        task: "Start with `blocks` free blocks, numbered from 0. Reservation request number 1, 2, and so on asks for every block from `left` through `right`, including both ends. Accept only if all are free. On acceptance, store the request number in all those blocks. On rejection, change no block. Rejected requests still consume a request number.",
        input: "Read `blocks` and `n`, then `n` pairs `left right`.",
        output: "Print the accepted request count followed by the owner of each block in order. Print 0 for a free block.",
        example: "Input `4 3 0 1 1 2 2 3` accepts requests 1 and 3. Print `2 1 1 3 3`.",
        constraints: "`1 <= blocks <= 20`. `0 <= n <= 30`. `0 <= left <= right < blocks`.",
        defect: "Encountering an occupied block leaves the reservation marked possible instead of rejecting it.",
        hints: ["Try a range containing both a busy block and a free block.", "The checking loop must remember a conflict before the writing loop starts.", "An occupied block must make `possible` false for the entire request."],
        c: `int blocks, n;
READ(blocks);
READ(n);
ARRAY(owner, 20);
int accepted = 0;
for (int request = 1; request <= n; request++) {
    int left, right;
    READ(left);
    READ(right);
    int possible = 1;
    for (int block = left; block <= right; block++) {
        if (owner[block] != 0) {
            possible = 0;
        }
    }
    if (possible == 1) {
        for (int block = left; block <= right; block++) {
            owner[block] = request;
        }
        accepted++;
    }
}
OUT(accepted);
for (int block = 0; block < blocks; block++) {
    OUT(owner[block]);
}`,
        py: `blocks = read_int()
n = read_int()
owner = [0] * blocks
accepted = 0
for request in range(1, n + 1):
    left = read_int()
    right = read_int()
    possible = 1
    for block in range(left, right + 1):
        if owner[block] != 0:
            possible = 0
    if possible == 1:
        for block in range(left, right + 1):
            owner[block] = request
        accepted += 1
print(accepted, *owner)`,
        cbug: ["possible = 0;", "possible = 1;"],
        pybug: ["possible = 0", "possible = 1"],
        cases: [["4 3\n0 1\n1 2\n2 3", "2 1 1 3 3"], ["3 1\n0 2", "1 1 1 1"], ["2 2\n0 0\n0 1", "1 1 0"], ["1 0", "0 0"], ["1 2\n0 0\n0 0", "1 1"], ["5 3\n0 0\n2 2\n4 4", "3 1 0 2 0 3"], ["4 2\n0 3\n1 2", "1 1 1 1 1"], ["3 3\n1 1\n0 0\n2 2", "3 2 1 3"]],
        witness: 3,
        probe: ["6 4\n1 2\n2 4\n4 5\n0 0", "3 4 1 1 0 3 3"]
    },
    {
        title: "Checkpoint Log Tail", difficulty: 24,
        guide: "`count` is the current log length, while `checkpoint` is the saved length. Recovery moves the logical end; later appends reuse space after that end.",
        incident: "The rogue AI AEGIS altered a restart log. Patch checks whether records after the saved checkpoint disappear on recovery.",
        symptom: "A recovery can keep the unsaved tail instead of restoring the checkpoint length.",
        task: "Start with an empty log and checkpoint length 0. Command `1 value` appends one record. Command `2 0` saves the current log length as the new checkpoint. Command `3 0` recovers by discarding every record after that checkpoint. Recovery leaves the checkpoint unchanged. Later appends continue at the current log end.",
        input: "Read `n`, then `n` pairs `op value`. Only append uses `value`; other commands supply 0.",
        output: "Print the final records in order. Print -1 if the log is empty.",
        example: "Input `4 1 7 2 0 1 9 3 0` keeps only the record 7. Print `7`.",
        constraints: "`0 <= n <= 50`. `op` is 1, 2 or 3. Appended `value` is from 1 through 100.",
        defect: "The recovery branch copies the current length into the checkpoint instead of restoring the current length from it.",
        hints: ["Append a record after a checkpoint and then recover.", "At recovery, one length is the saved boundary and the other is the boundary that must move.", "Restore `count` from `checkpoint`; recovery must not overwrite the saved boundary."],
        c: `int n;
READ(n);
ARRAY(log, 50);
int count = 0;
int checkpoint = 0;
for (int i = 0; i < n; i++) {
    int op, value;
    READ(op);
    READ(value);
    if (op == 1) {
        log[count] = value;
        count++;
    } else if (op == 2) {
        checkpoint = count;
    } else {
        count = checkpoint;
    }
}
if (count == 0) {
    OUT(-1);
}
for (int i = 0; i < count; i++) {
    OUT(log[i]);
}`,
        py: `n = read_int()
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
        count = checkpoint
if count == 0:
    print(-1)
else:
    print(*log[:count])`,
        cbug: ["count = checkpoint;", "checkpoint = count;"],
        pybug: ["count = checkpoint", "checkpoint = count"],
        cases: [["4\n1 7\n2 0\n1 9\n3 0", "7"], ["2\n1 4\n1 8", "4 8"], ["2\n1 5\n3 0", "-1"], ["0", "-1"], ["6\n1 2\n2 0\n1 3\n3 0\n1 4\n2 0", "2 4"], ["3\n2 0\n3 0\n1 6", "6"], ["5\n1 1\n2 0\n1 2\n2 0\n3 0", "1 2"], ["6\n1 8\n2 0\n1 9\n3 0\n3 0\n1 10", "8 10"]],
        witness: 3,
        probe: ["7\n1 13\n1 17\n2 0\n1 23\n3 0\n1 29\n3 0", "13 17"]
    },
    {
        title: "Packed Record Boundary", difficulty: 26,
        guide: "`cursor` points to a record's length field. `size` excludes that field. The bounds check decides whether a whole record exists before its data is inspected.",
        incident: "The rogue AI AEGIS altered a saved packet-buffer reader. Mira checks a complete record at the buffer's end.",
        symptom: "A record ending exactly at the buffer boundary can be ignored.",
        task: "Read records from a flat integer buffer, starting at position 0. Each record begins with one length value, followed by exactly that many data values. If the next record does not fit entirely in the buffer, stop and ignore that incomplete record and all remaining values. A zero-length record is complete and still counts. For complete records only, count records and sum their data values, excluding length fields.",
        input: "Read `n`, then `n` buffer values.",
        output: "Print the complete-record count and the sum of their data values.",
        example: "Input `6 2 4 5 1 7 3` contains complete records `[2,4,5]` and `[1,7]`, followed by an incomplete record. Print `2 16`.",
        constraints: "`1 <= n <= 50`. Every buffer value is from 0 through 9. Incomplete trailing records are allowed.",
        defect: "The completeness check rejects a record whose end is exactly the buffer length.",
        hints: ["Try a buffer containing exactly one complete record.", "The position just after a complete final record is allowed to equal `n`.", "Stop only when the length field plus its data would extend beyond the buffer, not when it ends exactly there."],
        c: `int n;
READ(n);
ARRAY(data, 50);
for (int i = 0; i < n; i++) {
    READ(data[i]);
}
int cursor = 0;
int records = 0;
int total = 0;
while (cursor < n) {
    int size = data[cursor];
    if (cursor + 1 + size > n) {
        break;
    }
    for (int j = 1; j <= size; j++) {
        total += data[cursor + j];
    }
    records++;
    cursor += 1 + size;
}
OUT(records);
OUT(total);`,
        py: `n = read_int()
data = [read_int() for _ in range(n)]
cursor = 0
records = 0
total = 0
while cursor < n:
    size = data[cursor]
    if cursor + 1 + size > n:
        break
    for j in range(1, size + 1):
        total += data[cursor + j]
    records += 1
    cursor += 1 + size
print(records, total)`,
        cbug: ["cursor + 1 + size > n", "cursor + 1 + size >= n"],
        pybug: ["cursor + 1 + size > n", "cursor + 1 + size >= n"],
        cases: [["6\n2 4 5 1 7 3", "2 16"], ["3\n4 8 9", "0 0"], ["3\n2 6 7", "1 13"], ["1\n0", "1 0"], ["1\n9", "0 0"], ["4\n0 0 0 0", "4 0"], ["5\n1 8 2 3 4", "2 15"], ["5\n0 1 9 3 2", "2 9"]],
        witness: 3,
        probe: ["8\n2 8 3 0 3 1 4 7", "3 23"]
    },
    {
        title: "Cancel a Waiting Print", difficulty: 31,
        guide: "`jobs` stores the waiting IDs from oldest to newest. `count` is the used length. Cancellation first finds an ID, then shifts later entries left to close its gap.",
        incident: "The rogue AI AEGIS altered a print spool. Patch checks that cancelling a waiting job preserves the order of the others.",
        symptom: "A cancelled job can remain in the queue while a different job disappears.",
        task: "Start with an empty print queue. Command `1 id` appends a job. Command `2 id` cancels that waiting job if present; an absent ID changes nothing. Command `3 0` prints and removes the oldest waiting job if one exists. Count printed jobs. Cancellation must preserve the order of all remaining jobs.",
        input: "Read `n`, then `n` pairs `op id`. Print commands supply ID 0. Appended IDs are unique across the whole input.",
        output: "Print the number of printed jobs, then all waiting IDs in order. If no jobs are waiting, print -1 after the printed count.",
        example: "Input `4 1 4 1 7 2 4 3 0` cancels 4 and prints 7. Print `1 -1`.",
        constraints: "`0 <= n <= 50`. `op` is 1, 2 or 3. Job IDs for append and cancel are from 1 through 1000. The queue never needs more than 50 slots.",
        defect: "The cancellation shift starts after the cancelled position, leaving that position unchanged.",
        hints: ["Cancel the first of two waiting jobs without printing either.", "The first gap to fill is the slot holding the cancelled ID.", "Start shifting at `found`, copying each following job into its predecessor's slot before reducing `count`."],
        c: `int n;
READ(n);
ARRAY(jobs, 50);
int count = 0;
int printed = 0;
for (int i = 0; i < n; i++) {
    int op, id;
    READ(op);
    READ(id);
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
            for (int j = found; j + 1 < count; j++) {
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
OUT(printed);
if (count == 0) {
    OUT(-1);
}
for (int j = 0; j < count; j++) {
    OUT(jobs[j]);
}`,
        py: `n = read_int()
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
            for j in range(found, count - 1):
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
    print(printed, *jobs[:count])`,
        cbug: ["int j = found;", "int j = found + 1;"],
        pybug: ["range(found, count - 1)", "range(found + 1, count - 1)"],
        cases: [["4\n1 4\n1 7\n2 4\n3 0", "1 -1"], ["2\n1 8\n2 99", "0 8"], ["3\n1 2\n1 5\n2 2", "0 5"], ["0", "0 -1"], ["3\n3 0\n1 9\n2 9", "0 -1"], ["5\n1 1\n1 2\n1 3\n2 2\n1 4", "0 1 3 4"], ["4\n1 6\n1 7\n2 7\n3 0", "1 -1"], ["6\n1 10\n1 20\n3 0\n1 30\n2 20\n1 40", "1 30 40"]],
        witness: 3,
        probe: ["7\n1 71\n1 83\n1 97\n2 71\n3 0\n1 109\n2 109", "1 97"]
    },
    {
        title: "Discard the Pending Slot", difficulty: 32,
        guide: "`stored` holds published values. `pending` and `marked` hold a possible replacement for each slot. Publishing scans all slots; discarding affects one slot's pending status.",
        incident: "The rogue AI AEGIS altered a staged settings log. Mira checks that a discarded edit cannot reappear at publication.",
        symptom: "A discarded pending value can still replace the stored value during a later publish command.",
        task: "Read the initial stored values. Command `1 slot value` stages a replacement for that slot, replacing any earlier pending edit there. Command `2 0 0` publishes all pending edits and clears their pending status. Command `3 slot 0` discards only that slot's pending edit and leaves its stored value unchanged. Staged edits left at the end are not published.",
        input: "Read `slots` and `n`, then `slots` initial values, then `n` triples `op slot value`.",
        output: "Print the final stored values for slots 0 through `slots - 1`.",
        example: "Input `2 4 4 8 1 0 9 1 1 7 3 0 0 2 0 0` discards the edit to slot 0 and publishes only slot 1. Print `4 7`.",
        constraints: "`1 <= slots <= 20`. `0 <= n <= 50`. Stored and staged values are from 0 through 100. `op` is 1, 2 or 3. Stage and discard use `0 <= slot < slots`; publish supplies slot and value 0.",
        defect: "Discard marks a slot as having a pending edit instead of clearing that status.",
        hints: ["Stage an edit, discard it, then publish.", "Publishing trusts `marked` when deciding which values to copy.", "Discard must remove the slot's pending status; its stored value and other slots must stay unchanged."],
        c: `int slots, n;
READ(slots);
READ(n);
ARRAY(stored, 20);
ARRAY(pending, 20);
ARRAY(marked, 20);
for (int j = 0; j < slots; j++) {
    READ(stored[j]);
}
for (int i = 0; i < n; i++) {
    int op, slot, value;
    READ(op);
    READ(slot);
    READ(value);
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
        marked[slot] = 0;
    }
}
for (int j = 0; j < slots; j++) {
    OUT(stored[j]);
}`,
        py: `slots = read_int()
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
        marked[slot] = 0
print(*stored)`,
        cbug: ["marked[slot] = 0;", "marked[slot] = 1;"],
        pybug: ["marked[slot] = 0", "marked[slot] = 1"],
        cases: [["2 4\n4 8\n1 0 9\n1 1 7\n3 0 0\n2 0 0", "4 7"], ["1 2\n3\n1 0 8\n2 0 0", "8"], ["1 3\n5\n1 0 9\n3 0 0\n2 0 0", "5"], ["3 0\n1 2 3", "1 2 3"], ["2 2\n8 6\n3 1 0\n2 0 0", "8 6"], ["1 3\n0\n1 0 4\n1 0 7\n2 0 0", "7"], ["2 1\n2 3\n1 1 99", "2 3"], ["2 5\n10 20\n1 0 30\n2 0 0\n1 0 40\n3 0 0\n2 0 0", "30 20"]],
        witness: 3,
        probe: ["3 5\n11 22 33\n1 0 44\n1 2 55\n3 0 0\n1 1 66\n2 0 0", "11 66 55"]
    }
];
