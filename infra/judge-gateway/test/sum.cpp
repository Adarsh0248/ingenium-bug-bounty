#include <iostream>
struct Answer { long long value; };
int main() { long long a, b; if (!(std::cin >> a >> b)) return 1; std::cout << Answer{a + b}.value << '\n'; }
