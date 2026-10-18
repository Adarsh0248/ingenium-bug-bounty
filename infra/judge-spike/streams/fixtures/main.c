#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

static void repeat(FILE *stream, int value, int count) {
    unsigned char buffer[8192];
    memset(buffer, value, sizeof(buffer));
    while (count > 0) {
        int n = count < (int)sizeof(buffer) ? count : (int)sizeof(buffer);
        if (fwrite(buffer, 1, n, stream) != (size_t)n) _exit(4);
        count -= n;
    }
}
int main(void) {
    if (getuid() != 60000 || geteuid() != 60000 || getgid() != 60000 || getegid() != 60000) return 3;
    struct timespec delay = {0, 100000000};
    nanosleep(&delay, NULL);
    int mode = -1;
    if (scanf("%d", &mode) != 1 || mode < 0 || mode > 9) return 2;
    switch (mode) {
        case 0: break;
        case 1: fputs("42\r\n", stdout); fputs("debug\n", stderr); break;
        case 2: fwrite("\xc3\xa9\0\xf0\x9f\x9a\x80\n", 1, 8, stdout); break;
        case 3: fwrite("\xff\xfe", 1, 2, stdout); fputc(255, stderr); break;
        case 4: repeat(stdout, 'x', 1048576); repeat(stderr, 'd', 65536); break;
        case 5: repeat(stdout, 'x', 1048577); repeat(stderr, 'd', 65537); break;
        case 6: repeat(stdout, 'x', 2097169); repeat(stderr, 'd', 131089); break;
        case 7: fputs("41\n", stdout); break;
        case 8: fputs(" 42 \t\r\n\v\f", stdout); break;
        case 9: fwrite("1\xc2\xa0" "2\n", 1, 5, stdout); break;
    }
    return ferror(stdout) || ferror(stderr) ? 4 : 0;
}
