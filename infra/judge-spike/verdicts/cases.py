NATIVE = b"""#define _DEFAULT_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
int main(void) {
    char mode[32] = {0};
    if (getuid() != 60000 || geteuid() != 60000 || getgid() != 60000 || getegid() != 60000) return 125;
    if (scanf("%31s", mode) != 1) return 126;
    usleep(120000);
    if (!strcmp(mode, "pass")) puts("12");
    else if (!strcmp(mode, "wrong")) puts("13");
    else if (!strcmp(mode, "nonzero")) return 7;
    else if (!strcmp(mode, "signal")) raise(SIGSEGV);
    else if (!strcmp(mode, "ambiguous")) raise(SIGKILL);
    else if (!strcmp(mode, "cpu")) { volatile unsigned long long value = 0; for (;;) value++; }
    else if (!strcmp(mode, "wall")) sleep(2);
    else if (!strcmp(mode, "memory")) {
        for (int n = 0; n < 32; n++) {
            volatile unsigned char *block = (unsigned char *) malloc(8 * 1024 * 1024);
            if (!block) return 77;
            for (int i = 0; i < 8 * 1024 * 1024; i += 4096) block[i] = (unsigned char)n;
        }
        return 78;
    } else if (!strcmp(mode, "overflow")) {
        char buffer[4096]; memset(buffer, 'X', sizeof(buffer));
        for (int n = 0; n < 512; n++) {
            size_t offset = 0;
            while (offset < sizeof(buffer)) {
                ssize_t count = write(1, buffer + offset, sizeof(buffer) - offset);
                if (count <= 0) return 79;
                offset += (size_t)count;
            }
        }
    } else return 127;
    return 0;
}
"""


def inventory():
    result = []
    for profile in ("c", "cpp", "java", "python", "javascript"):
        modes = ["compile-error", "nonzero"] if profile in ("c", "java") else ["syntax", "nonzero"]
        if profile == "cpp": modes = ["compile-error", "pass", "wrong", "nonzero", "signal", "cpu", "wall", "memory", "overflow", "ambiguous"]
        for mode in modes:
            verdict = {"compile-error": "COMPILATION_ERROR", "pass": "PASSED", "wrong": "WRONG_ANSWER", "nonzero": "RUNTIME_ERROR",
                       "syntax": "RUNTIME_ERROR", "signal": "RUNTIME_ERROR", "cpu": "TIME_LIMIT_EXCEEDED", "wall": "TIME_LIMIT_EXCEEDED",
                       "memory": "MEMORY_LIMIT_EXCEEDED", "overflow": "OUTPUT_LIMIT_EXCEEDED", "ambiguous": None}[mode]
            result.append({"id": profile + "-" + mode, "profile": profile, "mode": mode, "expected": verdict,
                           "cpu_ms": 200 if mode == "cpu" else (2000 if profile in ("c", "cpp") else 4000),
                           "wall_ms": 300 if mode == "wall" else (10000 if profile in ("c", "cpp") else 15000),
                           "memory_bytes": 67108864 if mode == "memory" else 536870912})
    return result


CASES = inventory()


def source(case):
    profile, mode = case["profile"], case["mode"]
    if mode == "compile-error":
        if profile in ("c", "cpp"):
            return (b"#error INGENIUM_EXPECTED_COMPILE_ERROR " + b"x" * 48 + b"\n") * 360
        return b"public class Main { " + b"int INGENIUM_EXPECTED_COMPILE_ERROR = ; " * 300 + b"}\n"
    if profile in ("c", "cpp"): return NATIVE
    if profile == "java":
        return b"public class Main { public static void main(String[] args) throws Exception { Thread.sleep(120); System.exit(7); } }\n"
    if profile == "python":
        if mode == "syntax": return b"\n".join(f"value_{i} = {i}".encode() for i in range(1200)) + b"\nINGENIUM_EXPECTED_SYNTAX_ERROR =\n"
        return b"import time,sys\ntime.sleep(.12)\nsys.exit(7)\n"
    if mode == "syntax": return b"\n".join(f"const value_{i} = {i};".encode() for i in range(1000)) + b"\nconst INGENIUM_EXPECTED_SYNTAX_ERROR = ;\n"
    return b"setTimeout(() => process.exit(7), 120);\n"
