import assert from "node:assert/strict";
import { test } from "node:test";
import { languages, program, mutate } from "./programs.mjs";

test("the portable renderer retains ordinary inputs and expands signed64 code for C, C++ and Java", () => {
  const body =
    "long long n; READ64(n); ARRAY64(values,10); values[0]=1000000000000LL; OUT64(n + values[0]);";
  for (const language of languages.filter((l) => l !== "python")) {
    const code = program(body, language);
    assert.doesNotMatch(code, /\b(READ64|ARRAY64|OUT64)\(/);
    if (language === "java") {
      assert.match(code, /nextLong\(\)/);
      assert.match(code, /long\[\] values = new long\[10\]/);
      assert.match(code, /1000000000000L;/);
      assert.doesNotMatch(code, /long long|\dLL\b/);
    } else if (language === "c") assert.match(code, /scanf\("%lld", &n\)/);
    else assert.match(code, /cin >> n/);
  }
  assert.match(program("int n; READ(n); OUT(n);", "c"), /scanf\("%d", &n\)/);
  assert.match(program("print(read_int())", "python"), /def read_int\(\):/);
});
test("a bug mutation must name exactly one source location", () => {
  assert.equal(
    mutate("if (a < b) { answer = 1; }", ["a < b", "a <= b"]),
    "if (a <= b) { answer = 1; }",
  );
  assert.throws(() => mutate("x+x", ["x", "y"]));
  assert.throws(() => mutate("x", ["missing", "y"]));
});
