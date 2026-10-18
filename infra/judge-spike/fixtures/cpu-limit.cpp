#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    volatile unsigned long long counter = 0;
    for (;;) ++counter;
}
