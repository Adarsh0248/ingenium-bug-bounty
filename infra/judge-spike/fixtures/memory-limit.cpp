#include <cstdlib>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    const unsigned size = 64u * 1024u * 1024u;
    volatile char* memory = static_cast<char*>(std::malloc(size));
    if (!memory) return 7;
    for (unsigned i = 0; i < size; ++i) memory[i] = static_cast<char>(i);
    return 0;
}
