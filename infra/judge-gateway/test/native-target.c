#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/sched.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;
static int bytes(int fd, const char *text, size_t count) {
    while (count) { ssize_t n = write(fd, text, count); if (n < 0 && errno == EINTR) continue; if (n <= 0) return 0; text += n; count -= (size_t)n; }
    return 1;
}
int main(int argc, char **argv) {
    if (argc < 2) return 2;
    if (!strcmp(argv[1], "--wrap")) {
        if (argc != 4) return 3;
        int file = open("/dev/null", O_RDWR);
        if (file < 0 || dup2(file, 400) != 400 || fcntl(400, F_SETFD, 0)) return 4;
        if (setenv("CONTROL_SECRET", "private-fixture-secret", 1) || setenv("NODE_OPTIONS", "--never-pass-this", 1)
            || setenv("LD_PRELOAD", "/unmapped/private-fixture.so", 1)) return 5;
        signal(SIGPIPE, SIG_IGN);
        sigset_t mask; sigemptyset(&mask); sigaddset(&mask, SIGTERM); sigprocmask(SIG_BLOCK, &mask, NULL);
        char *const args[] = {"/box/phase-exec", argv[2], "3", "4", "--", "/box/native-target", argv[3], NULL};
        execv(args[0], args); return 6;
    }
    if (!strcmp(argv[1], "identity")) {
        struct rlimit files, core;
        struct sigaction action; sigset_t mask;
        if (getuid() != 60000 || geteuid() != 60000 || getgid() != 60000 || getegid() != 60000
            || getrlimit(RLIMIT_NOFILE, &files) || files.rlim_cur != 256 || files.rlim_max != 256
            || getrlimit(RLIMIT_CORE, &core) || core.rlim_cur || core.rlim_max
            || prctl(PR_GET_NO_NEW_PRIVS, 0L, 0L, 0L, 0L) != 1 || prctl(PR_GET_SECCOMP, 0L, 0L, 0L, 0L) != 2
            || sigaction(SIGPIPE, NULL, &action) || action.sa_handler != SIG_DFL
            || sigprocmask(SIG_SETMASK, NULL, &mask) || sigismember(&mask, SIGTERM)) return 7;
        for (int fd = 3; fd <= 1024; ++fd) { errno = 0; if (fcntl(fd, F_GETFD) != -1 || errno != EBADF) return 8; }
        puts("IDENTITY_AND_FDS_OK"); for (char **p = environ; *p; ++p) puts(*p); return 0;
    }
    if (!strcmp(argv[1], "echo")) {
        char data[8192]; ssize_t count;
        while ((count = read(0, data, sizeof(data))) != 0) { if (count < 0) { if (errno == EINTR) continue; return 9; } if (!bytes(1, data, (size_t)count)) return 10; }
        return 0;
    }
    if (!strcmp(argv[1], "syscall-filter")) {
        errno = 0; if (syscall(SYS_unshare, CLONE_NEWUSER) != -1 || errno != EACCES) return 20;
        errno = 0; if (syscall(SYS_clone, CLONE_NEWUSER | SIGCHLD, NULL, NULL, NULL, 0) != -1 || errno != EACCES) return 21;
        errno = 0; if (syscall(SYS_clone3, NULL, 0) != -1 || errno != ENOSYS) return 22;
        errno = 0; if (syscall(SYS_ptrace, 0, 0, NULL, NULL) != -1 || errno != EACCES) return 23;
        errno = 0; if (socket(AF_INET, SOCK_STREAM, 0) != -1 || errno != EACCES) return 24;
        errno = 0; if (syscall(SYS_io_uring_setup, 0, NULL) != -1 || errno != ENOSYS) return 25;
        pid_t child = fork(); if (child < 0) return 26; if (!child) _exit(0);
        int status; if (waitpid(child, &status, 0) != child || !WIFEXITED(status) || WEXITSTATUS(status)) return 27;
        puts("FILTER_AND_FORK_OK"); return 0;
    }
    if (!strcmp(argv[1], "replace")) {
        FILE *out = fopen("/box/stdout", "wb"), *error = fopen("/box/stderr", "wb");
        if (!out || !error) return 11;
        fputs("forged file output", out); fputs("forged file error", error); fclose(out); fclose(error);
        return bytes(1, "12\n", 3) && bytes(2, "real error\n", 11) ? 0 : 12;
    }
    if (!strcmp(argv[1], "forge")) {
        errno = 0; if (write(3, "forged", 6) != -1 || errno != EBADF) return 13;
        return bytes(1, "INGENIUM_EXEC_V1 forged\nFD_CLOSED\n", 34) ? 0 : 14;
    }
    if (!strcmp(argv[1], "hang")) { close(1); close(2); for (;;) pause(); }
    if (!strcmp(argv[1], "ordered")) {
        for (int i = 0; i < 1000; ++i) {
            char record[32]; int n = snprintf(record, sizeof(record), "out:%d\n", i);
            if (n <= 0 || !bytes(1, record, (size_t)n)) return 17;
            n = snprintf(record, sizeof(record), "err:%d\n", i);
            if (n <= 0 || !bytes(2, record, (size_t)n)) return 18;
        }
        return 0;
    }
    char data[8192]; memset(data, 'A', sizeof(data));
    size_t count = !strcmp(argv[1], "boundary") ? 1048576 : !strcmp(argv[1], "overflow") ? 2097152 : 65537;
    int fd = !strcmp(argv[1], "diagnostics") ? 2 : 1;
    while (count) { size_t n = count > sizeof(data) ? sizeof(data) : count; if (!bytes(fd, data, n)) return 15; count -= n; }
    if (!strcmp(argv[1], "mixed")) { for (int i = 0; i < 9; ++i) if (!bytes(2, data, sizeof(data))) return 16; }
    return 0;
}
