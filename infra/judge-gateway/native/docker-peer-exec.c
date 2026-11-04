#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <sys/types.h>
#include <sys/un.h>
#include <sys/wait.h>
#include <sys/xattr.h>
#include <time.h>
#include <unistd.h>

#ifndef SO_PEERPIDFD
#error "Linux headers with SO_PEERPIDFD are required; no numeric-PID fallback is permitted."
#endif

static const char *socket_path = "/run/docker.sock";
static int proc_fd = -1, peer_fd = -1;
static struct stat expected_exe, expected_socket;

static int same_file(const struct stat *a, const struct stat *b) {
  return a->st_dev == b->st_dev && a->st_ino == b->st_ino && a->st_mode == b->st_mode && a->st_nlink == b->st_nlink
    && a->st_uid == b->st_uid && a->st_gid == b->st_gid && a->st_size == b->st_size
    && a->st_mtim.tv_sec == b->st_mtim.tv_sec && a->st_mtim.tv_nsec == b->st_mtim.tv_nsec
    && a->st_ctim.tv_sec == b->st_ctim.tv_sec && a->st_ctim.tv_nsec == b->st_ctim.tv_nsec;
}
static int executable(int fd, struct stat *info) {
  return fstat(fd, info) == 0 && S_ISREG(info->st_mode) && info->st_uid == 0 && info->st_gid == 0
    && info->st_nlink == 1 && (info->st_mode & 07777) == 0555
    && fgetxattr(fd, "security.capability", NULL, 0) < 0 && errno == ENODATA;
}
static int bounded_file(int directory, const char *name, char *buffer, size_t size) {
  int file = openat(directory, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (file < 0) return -1;
  size_t used = 0;
  while (used < size - 1) {
    ssize_t n = read(file, buffer + used, size - 1 - used);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) { close(file); return -1; }
    if (n == 0) { buffer[used] = '\0'; close(file); return 0; }
    used += (size_t)n;
  }
  close(file); return -1;
}
static int peer_ok(void) {
  struct pollfd p = { .fd = peer_fd, .events = POLLIN };
  struct stat current, actual;
  if (poll(&p, 1, 0) != 0 || lstat(socket_path, &current) != 0 || !same_file(&current, &expected_socket)
    || !executable(5, &current) || !same_file(&current, &expected_exe)) return 0;
  /* proc/exe is deliberately followed only inside the pinned real procfs process directory. */
  int exe = openat(proc_fd, "exe", O_RDONLY | O_CLOEXEC);
  if (exe < 0) return 0;
  int matches = executable(exe, &actual) && same_file(&actual, &expected_exe); close(exe);
  if (!matches) return 0;
  char status[16384]; unsigned u[4], g[4];
  if (bounded_file(proc_fd, "status", status, sizeof status) != 0) return 0;
  char *uid = strstr(status, "\nUid:"), *gid = strstr(status, "\nGid:");
  if (!uid || !gid || sscanf(uid, "\nUid: %u %u %u %u", &u[0], &u[1], &u[2], &u[3]) != 4
    || sscanf(gid, "\nGid: %u %u %u %u", &g[0], &g[1], &g[2], &g[3]) != 4) return 0;
  for (int i = 0; i < 4; i++) if (u[i] || g[i]) return 0;
  const char *spaces[] = { "user", "pid", "mnt", "net", "ipc" };
  for (size_t i = 0; i < sizeof spaces / sizeof spaces[0]; i++) {
    char path[64], own[128], remote[128];
    if (snprintf(path, sizeof path, "/proc/self/ns/%s", spaces[i]) >= (int)sizeof path) return 0;
    ssize_t a = readlink(path, own, sizeof own);
    if (snprintf(path, sizeof path, "ns/%s", spaces[i]) >= (int)sizeof path) return 0;
    ssize_t b = readlinkat(proc_fd, path, remote, sizeof remote);
    if (a < 1 || a >= (ssize_t)sizeof own || b != a || memcmp(own, remote, (size_t)a)) return 0;
  }
  p.revents = 0; return poll(&p, 1, 0) == 0;
}
static int authenticate(void) {
  struct stat directory; struct statfs filesystem;
  if (lstat("/run", &directory) || !S_ISDIR(directory.st_mode) || directory.st_uid || directory.st_gid || (directory.st_mode & 0022)
    || lstat(socket_path, &expected_socket) || !S_ISSOCK(expected_socket.st_mode) || expected_socket.st_uid || expected_socket.st_gid
    || expected_socket.st_nlink != 1 || (expected_socket.st_mode & 07777) != 0600
    || statfs("/proc", &filesystem) || filesystem.f_type != 0x9fa0 || !executable(5, &expected_exe)) return -1;
  int connection = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
  if (connection < 0) return -1;
  struct sockaddr_un address = { .sun_family = AF_UNIX };
  memcpy(address.sun_path, socket_path, strlen(socket_path) + 1);
  if (connect(connection, (struct sockaddr *)&address, sizeof address) < 0) {
    if (errno != EINPROGRESS) { close(connection); return -1; }
    struct pollfd p = { .fd = connection, .events = POLLOUT }; int error; socklen_t length = sizeof error;
    if (poll(&p, 1, 2000) != 1 || getsockopt(connection, SOL_SOCKET, SO_ERROR, &error, &length) || error) { close(connection); return -1; }
  }
  struct ucred credentials; socklen_t length = sizeof credentials;
  if (getsockopt(connection, SOL_SOCKET, SO_PEERCRED, &credentials, &length) || length != sizeof credentials
    || credentials.pid < 1 || credentials.uid || credentials.gid) { close(connection); return -1; }
  length = sizeof peer_fd;
  if (getsockopt(connection, SOL_SOCKET, SO_PEERPIDFD, &peer_fd, &length) || length != sizeof peer_fd || peer_fd < 0
    || fcntl(peer_fd, F_SETFD, FD_CLOEXEC)) { close(connection); return -1; }
  char path[64];
  if (snprintf(path, sizeof path, "/proc/%d", credentials.pid) >= (int)sizeof path) return -1;
  proc_fd = open(path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (proc_fd < 0 || !peer_ok()) { close(connection); return -1; }
  return connection;
}
static int hexadecimal(const char *value, size_t length) {
  for (size_t i = 0; i < length; i++) if (!((value[i] >= '0' && value[i] <= '9') || (value[i] >= 'a' && value[i] <= 'f'))) return 0;
  return 1;
}
static int read_path(const char *path) {
  size_t length = strlen(path);
  if (!strcmp(path, "/info") || !strcmp(path, "/containers/json?all=true")) return 1;
  return (length == 84 && !strncmp(path, "/images/sha256:", 15) && hexadecimal(path + 15, 64) && !strcmp(path + 79, "/json"))
    || (length == 81 && !strncmp(path, "/containers/", 12) && hexadecimal(path + 12, 64) && !strcmp(path + 76, "/json"));
}
/* Read-only HTTP uses the exact authenticated socket; mutations still use the pinned CLI. */
static int http_read(int connection, const char *path) {
  char request[512], buffer[16384];
  int length = snprintf(request, sizeof request, "GET %s HTTP/1.0\r\nHost: localhost\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n", path);
  if (length < 1 || length >= (int)sizeof request || !peer_ok()) return -1;
  struct timespec start, now;
  if (clock_gettime(CLOCK_MONOTONIC, &start)) return -1;
  size_t sent = 0, received = 0;
  for (;;) {
    if (!peer_ok() || clock_gettime(CLOCK_MONOTONIC, &now) || now.tv_sec - start.tv_sec >= 10) return -1;
    struct pollfd p = { .fd = connection, .events = sent < (size_t)length ? POLLOUT : POLLIN };
    int ready = poll(&p, 1, 20);
    if (ready < 0) { if (errno == EINTR) continue; return -1; }
    if (!ready) continue;
    if (p.revents & (POLLERR | POLLNVAL)) return -1;
    if (sent < (size_t)length) {
      ssize_t size = send(connection, request + sent, (size_t)length - sent, MSG_NOSIGNAL);
      if (size < 0) { if (errno == EINTR || errno == EAGAIN) continue; return -1; }
      if (!size) return -1;
      sent += (size_t)size;
    } else {
      ssize_t size = read(connection, buffer, sizeof buffer);
      if (size < 0) { if (errno == EINTR || errno == EAGAIN) continue; return -1; }
      if (!size) return received > 0 && peer_ok() ? 0 : -1;
      received += (size_t)size; if (received > 2097152) return -1;
      size_t written = 0;
      while (written < (size_t)size) {
        ssize_t count = write(STDOUT_FILENO, buffer + written, (size_t)size - written);
        if (count < 0) { if (errno == EINTR) continue; return -1; }
        if (!count) return -1;
        written += (size_t)count;
      }
    }
  }
}
static int arguments(int argc, char **argv) {
  if (argc < 2 || argc > 256) return 0;
  if (!strcmp(argv[1], "--http-get")) return argc == 3 && read_path(argv[2]);
  if (!strcmp(argv[1], "export")) {
    if (argc != 3 || strlen(argv[2]) != 64) return 0;
    for (size_t i = 0; i < 64; i++) if (!((argv[2][i] >= '0' && argv[2][i] <= '9') || (argv[2][i] >= 'a' && argv[2][i] <= 'f'))) return 0;
    return 1;
  }
  int allowed = !strcmp(argv[1], "info") || !strcmp(argv[1], "inspect") || !strcmp(argv[1], "create") || !strcmp(argv[1], "start")
    || !strcmp(argv[1], "stop") || !strcmp(argv[1], "rm") || (argc > 2 && ((!strcmp(argv[1], "image") && !strcmp(argv[2], "inspect"))
    || (!strcmp(argv[1], "container") && !strcmp(argv[2], "ls"))));
  if (!allowed) return 0;
  size_t total = 0;
  for (int i = 1; i < argc; i++) {
    size_t size = strlen(argv[i]); total += size;
    if (size > 4096 || total > 32768 || !strncmp(argv[i], "-H", 2) || !strncmp(argv[i], "-c", 2)
      || !strncmp(argv[i], "--host", 6) || !strncmp(argv[i], "--context", 9) || !strncmp(argv[i], "--config", 8)) return 0;
    for (size_t j = 0; j < size; j++) if ((unsigned char)argv[i][j] < 32 || (unsigned char)argv[i][j] > 126) return 0;
  }
  return 1;
}
static int failure(void) { fputs("Native Docker peer check failed; retain the original execution state.\n", stderr); return 70; }
int main(int argc, char **argv) {
  uid_t u[3]; gid_t g[3]; struct stat cli, probe;
  pid_t parent = getppid();
  if (!arguments(argc, argv) || getresuid(&u[0], &u[1], &u[2]) || getresgid(&g[0], &g[1], &g[2])) return failure();
  for (int i = 0; i < 3; i++) if (u[i] || g[i]) return failure();
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) || prctl(PR_SET_PDEATHSIG, SIGKILL) || getppid() != parent
    || !executable(3, &probe) || !executable(4, &cli) || fcntl(3, F_SETFD, FD_CLOEXEC) || fcntl(4, F_SETFD, FD_CLOEXEC) || fcntl(5, F_SETFD, FD_CLOEXEC)
    ) return failure();
  int connection = authenticate(); if (connection < 0) return failure();
  if (!strcmp(argv[1], "--http-get")) {
    int result = http_read(connection, argv[2]); close(connection); return result == 0 ? 0 : failure();
  }
  close(connection);
  if (signal(SIGCHLD, SIG_DFL) == SIG_ERR) return failure();
  pid_t helper = getpid(), child = fork(); if (child < 0) return failure();
  if (child == 0) {
    if (prctl(PR_SET_PDEATHSIG, SIGKILL) || getppid() != helper || !peer_ok()) _exit(71);
    char *arguments[261] = { "/proc/self/fd/4", "--host", "unix:///var/run/docker.sock", "--config", "/opt/ingenium/judge-executor/docker-client" };
    for (int i = 1; i < argc; i++) arguments[i + 4] = argv[i];
    arguments[argc + 4] = NULL;
    char *environment[] = { "PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LANG=C.UTF-8", NULL };
    execve(arguments[0], arguments, environment);
    _exit(71);
  }
  int status = 0, reaped = 0, valid = 1;
  struct timespec start, now;
  if (clock_gettime(CLOCK_MONOTONIC, &start)) valid = 0;
  while (valid) {
    pid_t result = waitpid(child, &status, WNOHANG);
    if (result == child) { reaped = 1; break; }
    /* Uncertain wait ownership must not become a numeric-PID signal. Parent death still stops our child. */
    if (result < 0 && errno != EINTR) return failure();
    if (!peer_ok() || clock_gettime(CLOCK_MONOTONIC, &now) || now.tv_sec - start.tv_sec >= 85) { valid = 0; break; }
    struct pollfd p = { .fd = peer_fd, .events = POLLIN };
    if (poll(&p, 1, 20) != 0) valid = 0;
  }
  if (!reaped) {
    /* Only our unreaped child can have this PID; the daemon is never signalled. */
    kill(child, SIGKILL);
    while (waitpid(child, &status, 0) < 0 && errno == EINTR) {}
  }
  if (!valid || !reaped || !peer_ok() || !WIFEXITED(status) || WEXITSTATUS(status) != 0) return failure();
  return 0;
}
