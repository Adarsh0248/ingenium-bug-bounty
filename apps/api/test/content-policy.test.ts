import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { checkText, contentText, prepareContent } from "../src/content/policy.js";
import { AccessError } from "../src/access/transaction.js";

const invalid = (e: unknown) => e instanceof AccessError && e.code === "INVALID_CONTEXT";
test("Round 1 authoring accepts only the legacy or fivefold reward scale", () => {
  const value = {round_type:1,title:"Repair",statement:"Fix it",difficulty:20,checker_mode:"TOKENS"};
  assert.equal(prepareContent("CREATE",{...value,reward_multiplier:5}).reward_multiplier,5);
  assert.equal(Object.hasOwn(prepareContent("CREATE",value),"reward_multiplier"),false);
  for (const reward_multiplier of [0,2,4,6,1.5,"5",null]) assert.throws(()=>prepareContent("CREATE",{...value,reward_multiplier}),invalid);
  assert.throws(()=>prepareContent("CREATE",{...value,round_type:2,reward_multiplier:5}),invalid);
});
test("categories are explicit author metadata, with legacy payload compatibility and strict validation",()=>{
  const value={round_type:1,title:"Arrays",statement:"Find the boundary",difficulty:80,checker_mode:"TOKENS"};
  assert.equal(Object.hasOwn(prepareContent("CREATE",value),"category"),false);
  for(const category of ["ARRAYS","GRAPHS","SYSTEMS","LOGIC"])assert.equal(prepareContent("CREATE",{...value,category}).category,category);
  for(const category of [null,"cpp","arrays",12])assert.throws(()=>prepareContent("CREATE",{...value,category}),invalid);
});
const variant = { language: "cpp", starter_code: "", reference_solution_code: "", defect_description: "", runtime_key: null,
  cpu_time_limit_ms: null, wall_time_limit_ms: null, memory_limit_kb: null };
test("draft text preserves accepted Unicode, BOM, line endings and NUL in byte-backed sources and case I/O", () => {
  const exact = "\ufeff  x\r\n\0" + String.fromCodePoint(0x00e9);
  const v = prepareContent("VARIANT", { ...variant, starter_code: exact, reference_solution_code: exact });
  assert.equal(Buffer.from(v.starter_b64 as string, "base64").toString("utf8"), exact);
  const c = prepareContent("CASE", { case_id: null, position: 1, visibility: "HIDDEN", input_data: "", expected_output: exact });
  assert.equal(c.input_b64, ""); assert.equal(Buffer.from(c.expected_b64 as string, "base64").toString("utf8"), exact);
  assert.throws(() => prepareContent("CASE", { case_id: null, position: 1, visibility: "HIDDEN", expected_output: "" }), invalid);
  assert.throws(() => contentText("\ud800", 100), invalid);
  assert.throws(() => contentText("\0", 100, true), invalid);
});
test("authoring limits count decoded UTF-8 bytes and reject unknown fields or coercion instead of trimming", () => {
  const unicode = String.fromCodePoint(0x00e9).repeat(65536);
  assert.equal(Buffer.from(prepareContent("VARIANT", { ...variant, starter_code: unicode }).starter_b64 as string, "base64").length, 131072);
  assert.throws(() => prepareContent("VARIANT", { ...variant, starter_code: unicode + "x" }), invalid);
  assert.throws(() => prepareContent("HINT", { level: "1", content: "help" }), invalid);
  assert.throws(() => prepareContent("HINT", { level: 4, content: "help" }), invalid);
  assert.throws(() => prepareContent("METADATA", { title: "t", statement: "", difficulty: 101, checker_mode: "TOKENS" }), invalid);
  assert.throws(() => prepareContent("METADATA", { title: "t", statement: "", difficulty: 20, checker_mode: "TOKENS", base_bounty: 9999 }), invalid);
  assert.throws(() => prepareContent("VARIANT", { ...variant, language: "react" }), invalid);
});
test("runtime limits require a complete preset selection and stay within each language's run ceilings", () => {
  assert.throws(() => prepareContent("VARIANT", { ...variant, cpu_time_limit_ms: 1 }), invalid);
  const limits = { ...variant, runtime_key: "synthetic-cpp-v1", cpu_time_limit_ms: 2000, wall_time_limit_ms: 10000, memory_limit_kb: 524288 };
  assert.equal(prepareContent("VARIANT", limits).runtime_key, "synthetic-cpp-v1");
  assert.throws(() => prepareContent("VARIANT", { ...limits, cpu_time_limit_ms: 2001 }), invalid);
  assert.throws(() => prepareContent("VARIANT", { ...limits, wall_time_limit_ms: 1000 }), invalid);
  assert.throws(() => prepareContent("VARIANT", { ...limits, runtime_key: "run arbitrary command" }), invalid);
  assert.equal(prepareContent("VARIANT", { ...limits, language: "java", cpu_time_limit_ms: 4000, wall_time_limit_ms: 15000 }).cpu_time_limit_ms, 4000);
});
test("failure witnesses are bounded typed declarations, not results, and interpreter compilation checks are refused", () => {
  const id = randomUUID(), w = { check_type: "TEST_CASE", test_case_id: id, expected_failure: "WRONG_OUTPUT" };
  const p = prepareContent("WITNESSES", { language: "cpp", witnesses: [w] });
  assert.equal((p.witnesses as { expected_failure: string }[])[0]!.expected_failure, "WRONG_ANSWER");
  assert.throws(() => prepareContent("WITNESSES", { language: "cpp", witnesses: [w, w] }), invalid);
  assert.throws(() => prepareContent("WITNESSES", { language: "python", witnesses: [{ check_type: "COMPILATION", test_case_id: null, expected_failure: "COMPILATION_ERROR" }] }), invalid);
  assert.throws(() => prepareContent("WITNESSES", { language: "cpp", witnesses: [{ ...w, expected_failure: "INFRA_ERROR" }] }), invalid);
  assert.throws(() => prepareContent("WITNESSES", { language: "cpp", witnesses: [{ ...w, check_type: "COMPILATION" }] }), invalid);
  assert.deepEqual(prepareContent("WITNESSES", { language: "cpp", witnesses: [] }).witnesses, []);
  assert.throws(() => prepareContent("REORDER_CASES", { case_ids: [id, id] }), invalid);
});
test("versioned token checker uses exactly six ASCII separators without number, case or Unicode normalisation", () => {
  const match = (a: string, b: string) => checkText("TOKENS", Buffer.from(a), Buffer.from(b));
  assert.equal(match(" \t1\n2\r3\f4\v ", "1 2 3 4"), true);
  assert.equal(match("1.0", "1"), false); assert.equal(match("A", "a"), false);
  assert.equal(match("1\u00a02", "1 2"), false); assert.equal(match("\ufeff42", "42"), false);
  assert.equal(match("", " \t\n\r\f\v"), true); assert.equal(match("\0", ""), false);
  assert.equal(match("a b", "b a"), false); assert.equal(match("a b", "a"), false);
});
test("exact checker preserves empty output, final newline, CRLF and invalid-byte refusal", () => {
  const match = (a: string, b: string) => checkText("EXACT_TEXT", Buffer.from(a), Buffer.from(b));
  assert.equal(match("", ""), true); assert.equal(match("42\n", "42"), false); assert.equal(match("42\r\n", "42\n"), false);
  assert.equal(match("\ufeff42", "42"), false); assert.equal(match("\0\n", "\0\n"), true);
  assert.equal(checkText("EXACT_TEXT", Buffer.from([0xff]), Buffer.from([0xff])), false);
  assert.equal(checkText("TOKENS", Buffer.from([0xc0, 0x80]), Buffer.alloc(0)), false);
  assert.throws(() => checkText("UNKNOWN" as never, Buffer.alloc(0), Buffer.alloc(0)), /Unsupported/);
});
