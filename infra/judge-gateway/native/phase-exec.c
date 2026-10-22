#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <linux/capability.h>
#include <linux/close_range.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <sched.h>
#include <stddef.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/un.h>
#include <unistd.h>

/* This is an exec handoff inside Isolate, not an isolator or a source of launch permission. */
static int channel(int fd) {
    struct stat info;
    if (fstat(fd, &info)) return 0;
    if (S_ISFIFO(info.st_mode)) return (fcntl(fd, F_GETFL) & O_ACCMODE) == O_WRONLY;
    if (!S_ISSOCK(info.st_mode)) return 0;
    struct sockaddr_un address;
    socklen_t length = sizeof(address);
    int type = 0;
    socklen_t size = sizeof(type);
    return getsockname(fd, (struct sockaddr *)&address, &length) == 0
        && length == sizeof(sa_family_t) && address.sun_family == AF_UNIX
        && getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &size) == 0 && type == SOCK_STREAM;
}

static int distinct(int first, int second) {
    struct stat a, b;
    return fstat(first, &a) == 0 && fstat(second, &b) == 0
        && (a.st_dev != b.st_dev || a.st_ino != b.st_ino);
}

static int descriptor(const char *text) {
    if (!text[0] || text[0] == '0') return -1;
    for (const char *p = text; *p; ++p) if (*p < '0' || *p > '9') return -1;
    errno = 0;
    char *end;
    long value = strtol(text, &end, 10);
    return !errno && !*end && value >= 3 && value < 256 ? (int)value : -1;
}

static int identity(void) {
    uid_t r, e, s;
    gid_t gr, ge, gs, groups[64];
    if (getresuid(&r, &e, &s) || getresgid(&gr, &ge, &gs)
        || r != 60000 || e != 60000 || s != 60000 || gr != 60000 || ge != 60000 || gs != 60000
        || prctl(PR_GET_NO_NEW_PRIVS, 0L, 0L, 0L, 0L) != 1
        || prctl(PR_GET_SECCOMP, 0L, 0L, 0L, 0L) != 2) return 0;
    int count = getgroups(64, groups);
    if (count < 0) return 0;
    for (int i = 0; i < count; ++i) if (groups[i] != 60000) return 0;
    struct __user_cap_header_struct header = { .version = _LINUX_CAPABILITY_VERSION_3, .pid = 0 };
    struct __user_cap_data_struct data[2] = {{0}, {0}};
    if (syscall(SYS_capget, &header, data)) return 0;
    for (int i = 0; i < 2; ++i) if (data[i].effective || data[i].permitted || data[i].inheritable) return 0;
    for (int i = 0; i <= CAP_LAST_CAP; ++i) if (prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_IS_SET, i, 0L, 0L) != 0) return 0;
    return 1;
}

static int send_record(int fd, const char *bytes, size_t length) {
    while (length) {
        ssize_t written = write(fd, bytes, length);
        if (written < 0 && errno == EINTR) continue;
        if (written <= 0) return 0;
        bytes += written;
        length -= (size_t)written;
    }
    return 1;
}

/* The outer filter permits Isolate's namespace setup; submitted processes must not inherit that permission. */
static int restrict_syscalls(void) {
#if !defined(__x86_64__)
    return 0;
#else
#define DENY_SYSCALL(name) BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_##name, 0, 1), BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EACCES)
#define UNSUPPORTED(name) BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_##name, 0, 1), BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | ENOSYS)
    const struct sock_filter rules[] = {
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
        BPF_JUMP(BPF_JMP | BPF_JGE | BPF_K, 0x40000000U, 0, 1),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EACCES),
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone, 0, 4),
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
        BPF_JUMP(BPF_JMP | BPF_JSET | BPF_K, CLONE_NEWUSER | CLONE_NEWNS | CLONE_NEWNET | CLONE_NEWPID | CLONE_NEWIPC | CLONE_NEWUTS | CLONE_NEWCGROUP, 0, 1),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EACCES),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
        UNSUPPORTED(clone3), UNSUPPORTED(io_uring_setup), UNSUPPORTED(io_uring_enter), UNSUPPORTED(io_uring_register),
        DENY_SYSCALL(unshare), DENY_SYSCALL(setns), DENY_SYSCALL(mount), DENY_SYSCALL(umount2), DENY_SYSCALL(pivot_root), DENY_SYSCALL(chroot),
        DENY_SYSCALL(ptrace), DENY_SYSCALL(process_vm_readv), DENY_SYSCALL(process_vm_writev), DENY_SYSCALL(open_by_handle_at), DENY_SYSCALL(name_to_handle_at),
        DENY_SYSCALL(bpf), DENY_SYSCALL(perf_event_open), DENY_SYSCALL(keyctl), DENY_SYSCALL(add_key), DENY_SYSCALL(request_key), DENY_SYSCALL(userfaultfd),
        DENY_SYSCALL(open_tree), DENY_SYSCALL(move_mount), DENY_SYSCALL(fsopen), DENY_SYSCALL(fsconfig), DENY_SYSCALL(fsmount), DENY_SYSCALL(fspick), DENY_SYSCALL(mount_setattr),
        DENY_SYSCALL(socket), DENY_SYSCALL(connect), DENY_SYSCALL(bind), DENY_SYSCALL(listen), DENY_SYSCALL(accept), DENY_SYSCALL(accept4),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),
    };
    struct sock_fprog program = { .len = sizeof(rules) / sizeof(rules[0]), .filter = (struct sock_filter *)rules };
    return prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &program, 0L, 0L) == 0;
#undef DENY_SYSCALL
#undef UNSUPPORTED
#endif
}

int main(int argc, char **argv) {
    if (argc < 6 || argc > 128 || strlen(argv[1]) != 64 || strcmp(argv[4], "--") || argv[5][0] != '/') return 125;
    size_t total = 0;
    for (int i = 1; i < argc; ++i) { total += strlen(argv[i]) + 1; if (total > 16384) return 125; }
    for (const char *p = argv[1]; *p; ++p) if (!((*p >= '0' && *p <= '9') || (*p >= 'a' && *p <= 'f'))) return 125;
    int witness = descriptor(argv[2]), error = !strcmp(argv[3], "1") ? STDOUT_FILENO : descriptor(argv[3]);
    if (witness < 0 || error < 0 || witness == error || !identity()
        || !channel(witness) || !channel(error) || !channel(STDOUT_FILENO)
        || !distinct(witness, STDIN_FILENO) || !distinct(witness, STDOUT_FILENO)
        || !distinct(witness, STDERR_FILENO) || !distinct(witness, error)) return 125;

    sigset_t empty;
    sigemptyset(&empty);
    if (sigprocmask(SIG_SETMASK, &empty, NULL)) return 125;
    struct sigaction action = { .sa_handler = SIG_DFL };
    sigemptyset(&action.sa_mask);
    for (int i = 1; i < NSIG; ++i) {
        if (i == SIGKILL || i == SIGSTOP) continue;
        if (sigaction(i, &action, NULL) && errno != EINVAL) return 125;
    }
    const struct rlimit files = {256, 256}, core = {0, 0};
    /* CLOEXEC includes descriptors above the new RLIMIT_NOFILE, not just 3..255. */
    if (syscall(SYS_close_range, 3U, UINT_MAX, CLOSE_RANGE_CLOEXEC)
        || setrlimit(RLIMIT_NOFILE, &files) || setrlimit(RLIMIT_CORE, &core)
        || dup2(error, STDERR_FILENO) < 0 || chdir("/box")) return 125;
    for (int i = 0; i <= 2; ++i) if (fcntl(i, F_SETFD, 0)) return 125;
    if (!restrict_syscalls()) return 125;

    char start[96];
    int length = snprintf(start, sizeof(start), "INGENIUM_EXEC_V1 %s\n", argv[1]);
    if (length <= 0 || (size_t)length >= sizeof(start) || !send_record(witness, start, (size_t)length)) return 125;
    char *const environment[] = {
        "PATH=/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin",
        "LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server",
        "HOME=/box", "TMPDIR=/box", "LANG=C.UTF-8", "JAVA_HOME=/usr/local/java", "UV_THREADPOOL_SIZE=1", NULL
    };
    execve(argv[5], argv + 5, environment);
    int cause = errno;
    length = snprintf(start, sizeof(start), "EXEC_ERROR %d\n", cause);
    if (length > 0 && (size_t)length < sizeof(start)) (void)send_record(witness, start, (size_t)length);
    return 125;
}
