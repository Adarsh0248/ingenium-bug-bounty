import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export const languages = ["c", "cpp", "java", "python"];
export function formatProgram(source, language) {
  if (language === "python") {
    // shortcut: Python starters contain valid-syntax logic bugs; use a syntax-tolerant formatter before adding syntax-error challenges.
    return execFileSync(
      "python",
      [
        "-c",
        "import ast, sys; print(ast.unparse(ast.parse(sys.stdin.read())))",
      ],
      { input: source, encoding: "utf8", windowsHide: true },
    )
      .replaceAll("\r\n", "\n")
      .replace("import sys\n", "import sys\n\n")
      .replace("    return next(tokens)\n", "    return next(tokens)\n\n");
  }
  const style =
    "{BasedOnStyle: LLVM, IndentWidth: 4, ColumnLimit: 88, BreakBeforeBraces: Attach, AllowShortBlocksOnASingleLine: Never, AllowShortFunctionsOnASingleLine: None, AllowShortIfStatementsOnASingleLine: Never, AllowShortLoopsOnASingleLine: false}";
  return execFileSync(
    process.env.CLANG_FORMAT || "clang-format",
    [
      "--style=" + style,
      "--assume-filename=" +
        (language === "java" ? "Main.java" : "main." + language),
    ],
    { input: source, encoding: "utf8", windowsHide: true },
  ).replaceAll("\r\n", "\n");
}
export function program(body, language) {
  if (language === "python")
    return (
      "import sys\n\ntokens = iter(sys.stdin.read().split())\ndef read_int():\n    return int(next(tokens))\n\ndef read_word():\n    return next(tokens)\n\n" +
      body.trim() +
      "\n"
    );
  const java = language === "java",
    cpp = language === "cpp";
  let code = body
    .trim()
    .replace(/ARRAY64\((\w+),\s*(\d+)\);/g, (_, n, size) =>
      java
        ? "long[] " + n + " = new long[" + size + "];"
        : "long long " + n + "[" + size + "] = {0};",
    )
    .replace(/ARRAY\((\w+),\s*(\d+)\);/g, (_, n, size) =>
      java
        ? "int[] " + n + " = new int[" + size + "];"
        : "int " + n + "[" + size + "] = {0};",
    )
    .replace(/TEXT\((\w+)\);/g, (_, n) =>
      java
        ? "String " + n + ";"
        : cpp
          ? "string " + n + ";"
          : "char " + n + "[257];",
    )
    .replace(/READ\(([^)]+)\);/g, (_, n) =>
      java
        ? n + " = scanner.nextInt();"
        : cpp
          ? "cin >> " + n + ";"
          : 'scanf("%d", &' + n + ");",
    )
    .replace(/READ64\(([^)]+)\);/g, (_, n) =>
      java
        ? n + " = scanner.nextLong();"
        : cpp
          ? "cin >> " + n + ";"
          : 'scanf("%lld", &' + n + ");",
    )
    .replace(/WORD\((\w+)\);/g, (_, n) =>
      java
        ? n + " = scanner.next();"
        : cpp
          ? "cin >> " + n + ";"
          : 'scanf("%256s", ' + n + ");",
    )
    .replace(/LEN\((\w+)\)/g, (_, n) =>
      java
        ? n + ".length()"
        : cpp
          ? "(int)" + n + ".size()"
          : "(int)strlen(" + n + ")",
    )
    .replace(/CHAR\((\w+),\s*([^)]*)\)/g, (_, n, i) =>
      java ? n + ".charAt(" + i + ")" : n + "[" + i + "]",
    )
    .replace(/OUT\(([^;]+)\);/g, (_, n) =>
      java
        ? "System.out.print((" + n + ') + " ");'
        : cpp
          ? "cout << (" + n + ") << ' ';"
          : 'printf("%d ", (' + n + "));",
    )
    .replace(/OUT64\(([^;]+)\);/g, (_, n) =>
      java
        ? "System.out.print((" + n + ') + " ");'
        : cpp
          ? "cout << (" + n + ") << ' ';"
          : 'printf("%lld ", (long long)(' + n + "));",
    )
    .replace(/SAY\("([^"]*)"\);/g, (_, s) =>
      java
        ? 'System.out.print("' + s + '");'
        : cpp
          ? 'cout << "' + s + '";'
          : 'printf("' + s + '");',
    );
  if (java)
    code = code.replace(/\blong long\b/g, "long").replace(/(\d+)LL\b/g, "$1L");
  assert.ok(
    !/\b(ARRAY64|ARRAY|TEXT|READ64|READ|WORD|LEN|CHAR|OUT64|OUT|SAY)\(/.test(
      code,
    ),
  );
  code = code
    .split("\n")
    .map((line) => "    " + line)
    .join("\n");
  if (java)
    return (
      "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n" +
      code
        .split("\n")
        .map((s) => "    " + s)
        .join("\n") +
      "\n        System.out.println();\n    }\n}\n"
    );
  const header = cpp
    ? "#include <iostream>\n#include <string>\nusing namespace std;"
    : "#include <stdio.h>\n#include <string.h>";
  return (
    header +
    "\n\nint main(" +
    (cpp ? "" : "void") +
    ") {\n" +
    code +
    "\n    " +
    (cpp ? "cout << '\\n';" : 'printf("\\n");') +
    "\n    return 0;\n}\n"
  );
}
export function mutate(source, patch) {
  const [correct, buggy] = patch;
  assert.equal(
    source.split(correct).length - 1,
    1,
    "Patch must have one target: " + correct,
  );
  return source.replace(correct, buggy);
}
