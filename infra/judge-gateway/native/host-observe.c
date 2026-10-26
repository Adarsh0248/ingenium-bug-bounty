#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <linux/magic.h>
#include <linux/nsfs.h>
#include <linux/sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <sys/types.h>
#include <sys/utsname.h>
#include <unistd.h>

/* Linux 6.8 include/linux/proc_ns.h reserves these inodes; matching /proc/1 alone is insufficient. */
static const struct { const char *name; int type; uint64_t initial; } spaces[] = {
  { "user", CLONE_NEWUSER, 0xeffffffdU }, { "pid", CLONE_NEWPID, 0xeffffffcU },
  { "cgroup", CLONE_NEWCGROUP, 0xeffffffbU }, { "ipc", CLONE_NEWIPC, 0xefffffffU },
  { "uts", CLONE_NEWUTS, 0xeffffffeU }, { "time", CLONE_NEWTIME, 0xeffffffaU },
  { "mnt", CLONE_NEWNS, 0 }, { "net", CLONE_NEWNET, 0 }
};
static int text(int root, const char *name, char *buffer, size_t size) {
  int file = openat(root, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (file < 0) return 0;
  size_t used = 0;
  while (used < size - 1) {
    ssize_t n = read(file, buffer + used, size - 1 - used);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) { close(file); return 0; }
    if (n == 0) { close(file); if (memchr(buffer, 0, used)) return 0; buffer[used] = 0; return 1; }
    used += (size_t)n;
  }
  close(file); return 0;
}
static int uuid(const char *value) {
  if (strlen(value) != 36) return 0;
  for (int i = 0; i < 36; i++) {
    if (i == 8 || i == 13 || i == 18 || i == 23) { if (value[i] != '-') return 0; }
    else if (!strchr("0123456789abcdef", value[i])) return 0;
  }
  return value[14] == '4' && strchr("89ab", value[19]) != NULL;
}
static int namespace_file(int root, const char *path, int type, struct stat *info) {
  /* Only kernel magic links below the pinned real procfs are deliberately followed. */
  int file = openat(root, path, O_RDONLY | O_CLOEXEC);
  struct statfs fs;
  if (file < 0) return -1;
  if (fstat(file, info) || fstatfs(file, &fs) || fs.f_type != NSFS_MAGIC || ioctl(file, NS_GET_NSTYPE) != type) { close(file); return -1; }
  return file;
}
static int proc_mount(int root, unsigned long *mount) {
  char *table = malloc(1048577); if (!table) return 0;
  if (!text(root, "self/mountinfo", table, 1048577)) { free(table); return 0; }
  int found = 0, ok = 1; char *next = NULL;
  for (char *line = strtok_r(table, "\n", &next); line; line = strtok_r(NULL, "\n", &next)) {
    unsigned long id, parent; char device[64], base[4096], path[4096], options[1024];
    const char *separator = strstr(line, " - ");
    if (!separator || sscanf(line, "%lu %lu %63s %4095s %4095s %1023s", &id, &parent, device, base, path, options) != 6) { ok = 0; break; }
    if (!strcmp(path, "/proc")) {
      if (found++ || strcmp(base, "/") || strncmp(separator + 3, "proc ", 5)
        || strstr(separator, "hidepid=") || strstr(separator, "subset=")) { ok = 0; break; }
      *mount = id;
    } else if (!strncmp(path, "/proc/", 6) && (strcmp(path, "/proc/sys/fs/binfmt_misc")
      || (!strstr(separator, " - binfmt_misc ") && !strstr(separator, " - autofs ")))) { ok = 0; break; }
  }
  free(table); return ok && found == 1;
}
static int fail(void) { fputs("Full Linux host context unavailable; retain execution holds.\n", stderr); return 70; }
int main(int argc, char **argv) {
  uid_t u[3]; gid_t g[3]; struct utsname machine; struct statfs fs; struct stat directory;
  if (argc != 3 || strcmp(argv[1], "--observe") || !uuid(argv[2]) || getresuid(&u[0], &u[1], &u[2]) || getresgid(&g[0], &g[1], &g[2])) return fail();
  for (int i = 0; i < 3; i++) if (u[i] || g[i]) return fail();
  if (uname(&machine) || strcmp(machine.machine, "x86_64") || strncmp(machine.release, "6.8.", 4)) return fail();
  for (const char *p = machine.release; *p; p++) if (!strchr("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-", *p)) return fail();
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)) return fail();
  int root = open("/proc", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (root < 0 || fstatfs(root, &fs) || fs.f_type != PROC_SUPER_MAGIC || fstat(root, &directory)
    || directory.st_ino != 1 || directory.st_uid || directory.st_gid) return fail();
  char boot[128], status[16384]; unsigned long long capabilities;
  if (!text(root, "sys/kernel/random/boot_id", boot, sizeof boot) || strlen(boot) != 37 || boot[36] != '\n'
    || !text(root, "self/status", status, sizeof status)) return fail();
  boot[36] = 0; if (!uuid(boot)) return fail();
  const char *cap = strstr(status, "\nCapEff:");
  if (!cap || sscanf(cap, "\nCapEff:\t%llx", &capabilities) != 1
    || (capabilities & ((1ULL << 2) | (1ULL << 19) | (1ULL << 21))) != ((1ULL << 2) | (1ULL << 19) | (1ULL << 21))) return fail();
  uint64_t inodes[sizeof spaces / sizeof spaces[0]]; unsigned long mount = 0;
  for (size_t i = 0; i < sizeof spaces / sizeof spaces[0]; i++) {
    char path[64]; struct stat own, init;
    snprintf(path, sizeof path, "self/ns/%s", spaces[i].name);
    int a = namespace_file(root, path, spaces[i].type, &own); if (a < 0) return fail();
    snprintf(path, sizeof path, "1/ns/%s", spaces[i].name);
    int b = namespace_file(root, path, spaces[i].type, &init); if (b < 0) { close(a); return fail(); }
    int ok = own.st_dev == init.st_dev && own.st_ino == init.st_ino && (!spaces[i].initial || own.st_ino == spaces[i].initial);
    if (i) {
      int owner = ioctl(a, NS_GET_USERNS); struct stat user; struct statfs nsfs;
      if (owner < 0 || fstat(owner, &user) || fstatfs(owner, &nsfs) || nsfs.f_type != NSFS_MAGIC
        || ioctl(owner, NS_GET_NSTYPE) != CLONE_NEWUSER || user.st_ino != spaces[0].initial) ok = 0;
      if (owner >= 0) close(owner);
    }
    inodes[i] = own.st_ino; close(a); close(b); if (!ok) return fail();
  }
  if (!proc_mount(root, &mount)) return fail();
  close(root);
  printf("{\"protocol\":\"ingenium-host-context-v1\",\"request_id\":\"%s\",\"boot_id\":\"%s\",\"kernel_release\":\"%s\",\"proc_mount_id\":\"%lu\",\"cap_eff\":\"%016llx\"", argv[2], boot, machine.release, mount, capabilities);
  for (size_t i = 0; i < sizeof spaces / sizeof spaces[0]; i++) printf(",\"%s_namespace\":\"%s:[%" PRIu64 "]\"", spaces[i].name, spaces[i].name, inodes[i]);
  puts("}"); return 0;
}
