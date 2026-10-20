import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { LANGUAGES } from "../src/access/credentials.js";
import { aggregateValidation, planValidation } from "../src/content/validation-policy.js";
import type { ValidationCapture, CodeResult } from "../src/content/validation-policy.js";

function fixture(): ValidationCapture {
  const cases = ["SAMPLE","HIDDEN"].map((visibility,position) => ({ id:randomUUID(),position:position+1,visibility:visibility as "SAMPLE"|"HIDDEN",input_data:Buffer.from(""),expected_output:Buffer.from("\ufeff12\0\r\n") }));
  const variants = LANGUAGES.map(language => ({ id:randomUUID(),language,starter_code:Buffer.from("synthetic starter"),reference_code:Buffer.from("synthetic reference"),
    defect_description:"Synthetic private defect",runtime_key:`synthetic-${language}`,cpu_ms:1000,wall_ms:5000,memory_kb:262144,manifest_digest:Buffer.alloc(32,1) }));
  return { version:{ id:randomUUID(),definition_id:randomUUID(),content_revision:"12",round_type:1,title:"Synthetic",statement:"Synthetic statement",difficulty:95,
    base_bounty:950,submission_format:"FULL_PROGRAM",checker_mode:"TOKENS",checker_version:"ingenium-text-v1",publication_status:"DRAFT" },
    variants,cases,hints:[1,2,3].map(level => ({ id:randomUUID(),level,content:`Synthetic hint ${level}` })),
    witnesses:variants.map(v => ({ variant_id:v.id,position:1,check_type:"TEST_CASE",test_case_id:cases[1]!.id,expected_failure:"WRONG_ANSWER" })),manifest_text:'{"synthetic_test_only":true}' };
}
const codes = (capture:ValidationCapture) => planValidation(capture).issues.map(i => i.code);

test("validation plans include all five references against every case and every declared starter witness", () => {
  const capture = fixture();
  capture.witnesses.push({ ...capture.witnesses[0]!,position:2,test_case_id:capture.cases[0]!.id,expected_failure:"RUNTIME_ERROR" });
  const plan = planValidation(capture);
  assert.deepEqual(plan.issues,[]); assert.equal(plan.checks.length,16); assert.equal(plan.fingerprint.length,32);
  assert.equal(plan.checks.filter(c => c.source_role === "REFERENCE").length,10);
  assert.equal(plan.checks.filter(c => c.source_role === "STARTER").length,6);
  assert.equal(capture.cases[0]!.input_data.length,0);
});
test("validation preflight returns only bounded field identifiers, not private source, I/O or hints", () => {
  const capture = fixture(); capture.variants[0]!.starter_code=Buffer.from(" \t"); capture.variants[1]!.reference_code=Buffer.from([0xc0,0x80]);
  capture.variants[2]!.manifest_digest=null; capture.hints[1]!.content=" "; capture.version.statement=" ";
  capture.cases[1]!.input_data=Buffer.from([0xff]); capture.witnesses[0]!.test_case_id=randomUUID();
  const result=planValidation(capture);
  for (const code of ["STARTER_INCOMPLETE","REFERENCE_INCOMPLETE","RUNTIME_REQUIRED","HINT_REQUIRED","STATEMENT_INCOMPLETE","CASE_INVALID_UTF8","WITNESS_INVALID"]) assert.ok(result.issues.some(i => i.code===code),code);
  assert.deepEqual(result.checks,[]); assert.doesNotMatch(JSON.stringify(result),/Synthetic private defect|Synthetic hint/);
});
test("preflight rejects missing language/hints/suite halves and unsupported interpreter compile witnesses", () => {
  const capture=fixture(); capture.variants.pop(); capture.hints.pop(); capture.cases[0]!.visibility="HIDDEN";
  capture.witnesses[3]={ ...capture.witnesses[3]!,check_type:"COMPILATION",test_case_id:null,expected_failure:"COMPILATION_ERROR" };
  const issues=codes(capture); for (const code of ["LANGUAGE_SET_INCOMPLETE","LANGUAGE_REQUIRED","HINT_REQUIRED","HINT_SET_INVALID","SAMPLE_REQUIRED","WITNESS_INVALID"]) assert.ok(issues.includes(code),code);
  capture.version.publication_status="PUBLISHED"; assert.ok(codes(capture).includes("CONTENT_LOCKED"));
});
test("preflight enforces source, suite and language runtime ceilings; three witnesses and twenty cases make 115 checks", () => {
  const capture=fixture();
  capture.cases=Array.from({length:20},(_,i) => ({ ...capture.cases[i===0?0:1]!,id:randomUUID(),position:i+1 }));
  capture.witnesses=capture.variants.flatMap(v => [1,2,3].map(position => ({ variant_id:v.id,position,check_type:"TEST_CASE" as const,test_case_id:capture.cases[position]!.id,expected_failure:"WRONG_ANSWER" as const })));
  assert.equal(planValidation(capture).checks.length,115);
  capture.variants[0]!.starter_code=Buffer.alloc(131073,65); capture.variants[1]!.cpu_ms=2001;
  capture.cases[1]!.input_data=Buffer.alloc(1048577,65); capture.cases[2]!.position=21;
  const issues=codes(capture); for (const code of ["STARTER_INCOMPLETE","RUNTIME_LIMIT_INVALID","CASE_LIMIT_EXCEEDED"]) assert.ok(issues.includes(code),code);
  capture.cases.forEach(c => {c.input_data=Buffer.alloc(524288,65);c.expected_output=Buffer.alloc(524288,65);});
  assert.ok(codes(capture).includes("SUITE_LIMIT_EXCEEDED"));
});
test("validation aggregation waits for every declared witness, then needs every reference and at least one matching witness per language", () => {
  const capture=fixture();capture.witnesses.push({ ...capture.witnesses[0]!,position:2,test_case_id:capture.cases[0]!.id,expected_failure:"RUNTIME_ERROR" });
  const checks=planValidation(capture).checks.map(c => ({ ...c,id:randomUUID() }));
  const results=new Map<string,CodeResult|"INFRA_ERROR">(checks.map(c => [c.id,c.expected_result]));
  const extra=checks.find(c => c.witness_position===2)!; results.set(extra.id,"PASSED");
  assert.equal(aggregateValidation(checks,results).status,"PASSED");
  results.delete(extra.id); assert.equal(aggregateValidation(checks,results).status,"PENDING");
  results.set(extra.id,"INFRA_ERROR"); assert.equal(aggregateValidation(checks,results).status,"INFRA_ERROR");
  results.set(extra.id,"PASSED"); results.set(checks[0]!.id,"WRONG_ANSWER");
  assert.equal(aggregateValidation(checks,results).status,"FAILED");
  const python=checks.find(c => c.language==="python" && c.source_role==="STARTER")!;results.set(python.id,"PASSED");
  assert.deepEqual(aggregateValidation(checks,results).unmatched_languages,["python"]);
});
test("aggregation refuses invented outcomes, duplicate check IDs, foreign results and plans missing reference languages", () => {
  const checks=planValidation(fixture()).checks.map(c => ({ ...c,id:randomUUID() }));
  assert.throws(() => aggregateValidation(checks,new Map([[randomUUID(),"PASSED"]])));
  assert.throws(() => aggregateValidation([...checks,checks[0]!],new Map()));
  assert.throws(() => aggregateValidation(checks.filter(c => c.source_role==="STARTER"),new Map()));
  assert.throws(() => aggregateValidation(checks.filter(c => c.language!=="c"),new Map()));
  assert.throws(() => aggregateValidation(checks,new Map([[checks[0]!.id,"ACCEPTED" as CodeResult]])));
});
