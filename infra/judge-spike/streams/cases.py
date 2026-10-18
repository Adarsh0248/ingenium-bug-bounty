# Fixed synthetic fixtures, not participant input or competition test data.
CASES = ("empty", "text-stderr", "unicode-nul", "invalid-utf8", "boundary", "overflow",
         "drain-both", "wrong", "ascii-whitespace", "unicode-whitespace")


def output(index):
    if type(index) is not int or not 0 <= index < len(CASES):
        raise RuntimeError("Unknown fixed stream case.")
    return (
        (b"", b""),
        (b"42\r\n", b"debug\n"),
        (b"\xc3\xa9\x00\xf0\x9f\x9a\x80\n", b""),
        (b"\xff\xfe", b"\xff"),
        (b"x" * 1048576, b"d" * 65536),
        (b"x" * 1048577, b"d" * 65537),
        (b"x" * 2097169, b"d" * 131089),
        (b"41\n", b""),
        (b" 42 \t\r\n\v\f", b""),
        (b"1\xc2\xa02\n", b""),
    )[index]


def expected(index):
    if index in (3, 7, 8):
        return b"42\n"
    if index in (4, 5, 6):
        return b"x" * 1048576
    if index == 9:
        return b"1 2\n"
    return output(index)[0]
