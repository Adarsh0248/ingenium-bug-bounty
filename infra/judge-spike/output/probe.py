import errno
import fcntl
import os
import stat
import sys
import time


def main():
    if (os.getresuid() != (60000, 60000, 60000) or os.getresgid() != (60000, 60000, 60000)
            or os.getgroups()):
        raise RuntimeError("Unexpected probe identity.")
    mode = sys.stdin.buffer.readline(32).strip()
    for fd in (1, 2):
        if not stat.S_ISFIFO(os.fstat(fd).st_mode) or fcntl.fcntl(fd, fcntl.F_GETFL) & os.O_ACCMODE != os.O_WRONLY:
            raise RuntimeError("The program did not receive write-only pipes.")
    time.sleep(0.15)
    if mode == b"replace-paths":
        with open("/box/stdout", "xb") as stream:
            stream.write(b"FAKE ANSWER\n")
        os.rename("/box/stdout", "/box/discarded")
        os.mkfifo("/box/stdout", 0o600)
        fake = os.open("/box/stdout", os.O_RDWR | os.O_NONBLOCK)
        try:
            os.write(fake, b"UNRELATED PIPE\n")
            if os.read(fake, 64) != b"UNRELATED PIPE\n":
                raise RuntimeError("Synthetic pipe setup failed.")
        finally:
            os.close(fake)
        os.unlink("/box/stdout")
        os.symlink("/box/stdin", "/box/stdout")
        with open("/box/stderr", "xb") as stream:
            stream.write(b"FAKE DIAGNOSTIC\n")
        os.unlink("/box/stderr")
        os.mkdir("/box/stderr")
        os.write(1, b"REAL ANSWER\n")
        os.write(2, b"REAL DIAGNOSTIC\n")
    elif mode == b"read-and-leak":
        for fd in (1, 2):
            try:
                os.read(fd, 1)
            except OSError as error:
                if error.errno != errno.EBADF:
                    raise
            else:
                raise RuntimeError("A program can drain its capture channel.")
        for fd in range(3, 256):
            try:
                os.fstat(fd)
            except OSError as error:
                if error.errno != errno.EBADF:
                    raise
            else:
                raise RuntimeError("An extra descriptor reached the program.")
        os.write(1, b"WRITE_ONLY_NO_LEAKS\n")
    elif mode == b"early-close":
        os.write(1, b"CLOSED_BEFORE_EXIT\n")
        os.close(1)
        os.close(2)
        time.sleep(0.3)
        with open("/box/finished", "xb") as stream:
            stream.write(b"finished after closing output\n")
    else:
        raise RuntimeError("Unknown fixed output probe.")


if __name__ == "__main__":
    main()
