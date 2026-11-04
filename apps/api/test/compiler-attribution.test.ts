import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sourceCompilationError } from "../src/judge/isolate-evidence.js";
import type { ExecutionPlan } from "../src/judge/execution-plan.js";

type Diagnostic = {language:"java"|"c"|"cpp";name:string;source:string;source_file:string;exit_code:number;compiler_b64:string};
const report = JSON.parse(readFileSync(new URL("./fixtures/compiler-diagnostics.json",import.meta.url),"utf8")) as {
  scope:string;cases:Diagnostic[];sandbox_cases:Diagnostic[];
};
test("actual frozen-toolchain and sandbox source diagnostics are recognised without requiring one exact beginner mistake",()=>{
  assert.equal(report.scope,"TRUSTED_COMPILER_DIAGNOSTIC_COVERAGE");assert.equal(report.cases.length,44);assert.equal(report.sandbox_cases.length,2);
  for(const row of [...report.cases,...report.sandbox_cases]){
    const plan={language:row.language,sourceFile:row.source_file,source:Buffer.from(row.source)} as ExecutionPlan;
    const bytes=Buffer.from(row.compiler_b64,"base64");assert.equal(row.exit_code,1);
    assert.equal(sourceCompilationError(plan,bytes,false),true,`${row.language}/${row.name}`);
    assert.equal(sourceCompilationError(plan,bytes,true),false,`${row.name}: clipped diagnostics are uncertain`);
  }
  for (const row of report.sandbox_cases) {
    const plan={language:row.language,sourceFile:row.source_file,source:Buffer.from(row.source)} as ExecutionPlan;
    const bytes=Buffer.from(row.compiler_b64,"base64").toString("utf8");
    assert.equal(sourceCompilationError(plan,Buffer.from(bytes.replace(/\/box\/cc[A-Za-z0-9_]+\.o/,"/box/foreign.o")),false),false);
    assert.equal(sourceCompilationError(plan,Buffer.from(bytes.replace(/\/box\/cc[A-Za-z0-9_]+\.o/,"/lib/ccoriginal.o")),false),false);
  }
});
test("foreign linker objects, missing runtime files, tool failures and mixed output remain infrastructure faults",()=>{
  const source=report.cases.find(r=>r.language==="c"&&r.name==="undefined-helper")!,entry=report.cases.find(r=>r.language==="c"&&r.name==="missing-main")!;
  const plan={language:"c",sourceFile:"main.c",source:Buffer.from(source.source)} as ExecutionPlan,good=Buffer.from(source.compiler_b64,"base64").toString("utf8");
  for(const text of [good.replace(/\/tmp\/cc[A-Za-z0-9_]+\.o/,"/lib/foreign.o"),good.replace("undefined reference to","cannot find"),good.replace("main.c:","foreign.c:"),good+"unexpected tool failure\n",good.replace("ld returned 1 exit status","ld terminated with signal 9"),Buffer.from(entry.compiler_b64,"base64").toString("utf8").replace("crt1.o","foreign.o")])
    assert.equal(sourceCompilationError(plan,Buffer.from(text),false),false,text);
  for(const file of ["/box/main.c","/toolchain/foreign.c"]){
    const bytes=Buffer.from(JSON.stringify([{kind:"fatal error",message:"out of memory",locations:[{caret:{file,line:1,column:1}}],children:[]}]));
    assert.equal(sourceCompilationError(plan,bytes,false),false);
  }
  const java={language:"java",sourceFile:"Main.java",source:Buffer.from("public class Main {}") } as ExecutionPlan;
  for(const code of ["error.reading.file","error.writing.file","proc.cant.create.loader","unknown.error","cant.access","cant.read.file"])
    assert.equal(sourceCompilationError(java,Buffer.from(`Main.java:1:1: compiler.err.${code}: tool failure\n1 error\n`),false),false);
});
