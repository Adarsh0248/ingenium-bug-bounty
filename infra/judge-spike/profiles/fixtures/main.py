import os
import sys
import time

assert (os.getuid(), os.geteuid(), os.getgid(), os.getegid()) == (60000,) * 4
time.sleep(0.1)
a, b = map(int, sys.stdin.buffer.read().split())
sys.stdout.buffer.write(str(a + b).encode("ascii") + b"\n")
