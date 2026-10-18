#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <unistd.h>
#include <time.h>
int main(void) {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    struct timespec delay = {0, 100000000};
    nanosleep(&delay, NULL);
    long long a, b;
    if (scanf("%lld %lld", &a, &b) != 2) return 2;
    printf("%lld\n", a + b);
    return 0;
}
