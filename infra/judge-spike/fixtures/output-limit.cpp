#include <cstring>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    char buffer[4096];
    std::memset(buffer, 'X', sizeof(buffer));
    for (;;) if (write(1, buffer, 4096) < 0) return 9;
}
