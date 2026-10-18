#include <sys/resource.h>
#include <unistd.h>
int main(int argc, char **argv) {
    if (argc < 2 || argv[1][0] != '/' || getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 125;
    const struct rlimit files = {256, 256};
    const struct rlimit core = {0, 0};
    if (setrlimit(RLIMIT_NOFILE, &files) || setrlimit(RLIMIT_CORE, &core)) return 125;
    execv(argv[1], argv + 1);
    return 126;
}
