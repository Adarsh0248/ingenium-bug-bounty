#include <cstring>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    char buffer[4096];
    std::memset(buffer, 'X', sizeof(buffer));
    for (int i = 0; i < 2; ++i) if (write(1, buffer, 4096) != 4096) return 9;
    return 0;
}
