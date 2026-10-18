import os
import sys
import time

assert (os.getuid(), os.geteuid(), os.getgid(), os.getegid()) == (60000,) * 4
time.sleep(0.1)
mode = int(sys.stdin.buffer.read())
assert 0 <= mode <= 9
out, err = (
    (b"", b""), (b"42\r\n", b"debug\n"), (b"\xc3\xa9\0\xf0\x9f\x9a\x80\n", b""),
    (b"\xff\xfe", b"\xff"), (b"x" * 1048576, b"d" * 65536),
    (b"x" * 1048577, b"d" * 65537), (b"x" * 2097169, b"d" * 131089),
    (b"41\n", b""), (b" 42 \t\r\n\v\f", b""), (b"1\xc2\xa02\n", b""),
)[mode]
sys.stdout.buffer.write(out)
sys.stdout.buffer.flush()
sys.stderr.buffer.write(err)
sys.stderr.buffer.flush()
