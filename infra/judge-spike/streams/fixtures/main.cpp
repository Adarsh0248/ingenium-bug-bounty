#include <chrono>
#include <iostream>
#include <string>
#include <thread>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 || getgid() != 60000 || getegid() != 60000) return 3;
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    int mode = -1;
    if (!(std::cin >> mode) || mode < 0 || mode > 9) return 2;
    switch (mode) {
        case 0: break;
        case 1: std::cout << "42\r\n"; std::cerr << "debug\n"; break;
        case 2: std::cout.write("\xc3\xa9\0\xf0\x9f\x9a\x80\n", 8); break;
        case 3: std::cout.write("\xff\xfe", 2); std::cerr.put(char(255)); break;
        case 4: std::cout << std::string(1048576, 'x'); std::cerr << std::string(65536, 'd'); break;
        case 5: std::cout << std::string(1048577, 'x'); std::cerr << std::string(65537, 'd'); break;
        case 6: std::cout << std::string(2097169, 'x'); std::cerr << std::string(131089, 'd'); break;
        case 7: std::cout << "41\n"; break;
        case 8: std::cout << " 42 \t\r\n\v\f"; break;
        case 9: std::cout << "1\xc2\xa0" "2\n"; break;
    }
    return std::cout && std::cerr ? 0 : 4;
}
