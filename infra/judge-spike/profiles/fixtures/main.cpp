#include <iostream>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    usleep(100000);
    long long a, b;
    if (!(std::cin >> a >> b)) return 2;
    std::cout << a + b << "\n";
    return 0;
}
