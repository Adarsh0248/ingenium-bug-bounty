#define _GNU_SOURCE
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/types.h>
#include <unistd.h>

int main(int argc, char **argv) {
  uid_t uid[3]; gid_t gid[3]; pid_t parent = getppid();
  int allowed = argc == 2 && (!strcmp(argv[1], "--ready") || !strcmp(argv[1], "--execute") || !strcmp(argv[1], "--recover")
    || !strcmp(argv[1], "--prepare-host") || !strcmp(argv[1], "--retire"));
  if (!allowed || getresuid(&uid[0], &uid[1], &uid[2]) || getresgid(&gid[0], &gid[1], &gid[2])) goto failed;
  for (int i = 0; i < 3; i++) if (uid[i] || gid[i]) goto failed;
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) || prctl(PR_SET_PDEATHSIG, SIGKILL) || getppid() != parent) goto failed;
  char *args[] = { "/opt/ingenium/judge-executor/node", "/opt/ingenium/judge-executor/app/judge/host-cli.js", argv[1], NULL };
  char *environment[] = { "PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LANG=C.UTF-8", NULL };
  execve(args[0], args, environment);
failed:
  fputs("Protected host launcher unavailable; retain original execution state.\n", stderr);
  return 125;
}
