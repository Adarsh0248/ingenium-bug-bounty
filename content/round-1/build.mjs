import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { neon } from "./neon.mjs";
import { silicon } from "./silicon.mjs";
import { nexus } from "./nexus.mjs";
import { core } from "./core.mjs";
import { statementFor } from "../statement.mjs";

import { languages, formatProgram, program, mutate } from "../programs.mjs";
export { languages } from "../programs.mjs";
const groups = [["ARRAYS", "Neon District", neon], ["SYSTEMS", "Silicon Hive", silicon], ["GRAPHS", "Verdant Nexus", nexus], ["LOGIC", "Zero-Day Core", core]];
const questions = groups.flatMap(([category, region, items]) => items.map(q => ({ ...q, category, region })));
assert.equal(questions.length, 50);
const pack = questions.map((q, index) => {
  assert.equal(q.hints.length, 3);
  assert.ok(q.guide?.trim(), "Every mission needs a short code-reading guide");
  assert.ok(q.cases.length >= 6 && q.cases.length <= 20);
  const variants = Object.fromEntries(languages.map(language => {
    const body = language === "python" ? q.py : q.c;
    return [language, { starter_code: formatProgram(program(mutate(body, language === "python" ? q.pybug : q.cbug), language), language), reference_solution_code: formatProgram(program(body, language), language), defect_description: q.defect }];
  }));
  return {
    id: "00000000-0000-4000-8000-"+String(100+index).padStart(12,"0"),
    slug: q.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/,""),
    title:q.title, round_type:1, category:q.category, region:q.region, difficulty:q.difficulty, base_bounty:q.difficulty*50,
    submission_format:"FULL_PROGRAM", checker_mode:"TOKENS",
    statement:statementFor(q,1),
    hints:q.hints.map((content,i)=>({level:i+1,content})),variants,
    cases:q.cases.map(([input_data,expected_output],i)=>({position:i+1,visibility:i<2?"SAMPLE":"HIDDEN",input_data:input_data.trimEnd()+"\n",expected_output:expected_output.trimEnd()+"\n"}))
  };
});
const witnesses = JSON.parse(await readFile(new URL("witnesses.json", import.meta.url), "utf8"));
for (const q of pack) {
  const position = witnesses[q.slug];
  assert.ok(q.cases.some(c=>c.position===position && c.visibility==="HIDDEN"));
  for (const v of Object.values(q.variants)) v.witness_case_position = position;
}
assert.equal(pack.filter(q=>q.difficulty>=1&&q.difficulty<=20).length,35);
assert.equal(pack.filter(q=>q.difficulty>20&&q.difficulty<=30).length,10);
assert.equal(pack.filter(q=>q.difficulty>30&&q.difficulty<=40).length,5);
const packed = JSON.stringify({title:"Protocol Rebellion",round_type:1,languages,questions:pack},null,2)+"\n";
await writeFile(new URL("pack.json",import.meta.url),packed);
const digest = createHash("sha256").update(packed).digest("hex");
const previous = JSON.parse(await readFile(new URL("validation-summary.json",import.meta.url),"utf8").catch(error => { if(error.code==="ENOENT") return "null"; throw error; }));
if(previous?.pack_sha256 !== digest) await writeFile(new URL("validation-summary.json",import.meta.url),JSON.stringify({scope:"TRUSTED_LOCAL_CONTENT_CHECKS",pack_sha256:digest,passed:false,state:"RECHECK_REQUIRED",production_judge_validated:false,human_pilot_difficulty_reviewed:false},null,2)+"\n");
const intro = "# Protocol Rebellion — Round 1\n\nPrivate organiser content. Do not copy this directory into public assets.\n\nA defensive AI, AEGIS, has mistaken its operators for intruders. Operator Mira, maintenance drone Patch and network analyst Ishan coordinate repairs in four sectors. Every mission is self-contained and can be attempted in any order. Solving one never unlocks another question or changes its tests.\n\n50 questions: 35 very easy at difficulty 1–20, 10 easy at 21–30 and 5 moderate at 31–40. The three-hour round targets at least 30 solves for a typical team; completing all 50 is an optional goal for faster teams, not a guaranteed solve time. Four equivalent variants per question: C, C++, Java and Python. Round 1 bounty is fifty times difficulty (5× the original reward scale). Hint percentages stay the same; unspent earnings carry into Round 2, whose reward and hint rates remain unchanged. Older published snapshots retain their original rewards. Each question has two public samples, at least four hidden cases and three progressive hints. No language-specific pointer syntax, manual-memory task or nondeterministic thread scheduling is required.\n\nHints follow architecture.md §1.9: clue, substantial direction, then near-solution reasoning without complete code. Additional prices are 10%, 30% and 40% of base bounty.\n\nLocal content checks are not production publication: use the protected authoring validation and organiser review before event selection. Pilot solves must calibrate difficulty and language fairness.\n\n| # | Region | Mission | Difficulty | Bounty | Defect |\n| --- | --- | --- | ---: | ---: | --- |\n";
await writeFile(new URL("README.md",import.meta.url),intro+pack.map((q,i)=>"| "+(i+1)+" | "+q.region+" | "+q.title+" | "+q.difficulty+" | "+q.base_bounty+" | "+questions[i].defect+" |").join("\n")+"\n\n## Files\n\n- pack.json: complete private statements, hints, tests and starter/reference variants.\n- neon.mjs, silicon.mjs, nexus.mjs, core.mjs: editable authoring sources.\n- build.mjs: rebuilds the pack and catalogue without database writes.\n- verify.py: compiles/runs only these organiser-authored programs locally and saves exact evidence.\n");
console.log("Built "+pack.length+" missions and "+pack.length*languages.length+" starter/reference pairs.");
const book = pack.map((q,index) => "## "+(index+1)+". "+q.title+"\n\n"+q.region+" · Difficulty "+q.difficulty+" · Bounty "+q.base_bounty+"\n\n"+q.statement+"\n\n### Public samples\n\n"+q.cases.filter(c=>c.visibility==="SAMPLE").map((c,i)=>"Sample "+(i+1)+" input:\n\n```text\n"+c.input_data+"```\n\nExpected output:\n\n```text\n"+c.expected_output+"```\n").join("\n")+"\n### Progressive hints (private until purchased)\n\n"+q.hints.map(h=>h.level+". "+h.content).join("\n")+"\n\n"+languages.map(language=>"### "+language+" buggy starter\n\n```"+language+"\n"+q.variants[language].starter_code+"```\n").join("\n")).join("\n---\n\n");
await writeFile(new URL("questions.md",import.meta.url),"# Protocol Rebellion — organiser review book\n\nPrivate draft: includes unpurchased hints. References and hidden cases remain in pack.json. Difficulty and equivalence still need human pilot review.\n\n"+book+"\n");
await writeFile(new URL("README.md",import.meta.url),"\nReview the full [question book](questions.md) and [local validation summary](validation-summary.json). The declared hidden failure cases are recorded in witnesses.json.\n\nRebuild with `npm.cmd run content:round1:build`. Run trusted local checks with `npm.cmd run content:round1:verify` (requires GCC, G++, Java and Python). Linux compiler checks may use the existing isolated test image; these are content checks, not event-host verification.\n",{flag:"a"});
await writeFile(new URL("README.md",import.meta.url),"\n## Readability\n\nEvery mission explains its own story, the expected behaviour, the fault, the input/output and the first sample in plain English. Hints follow the same style. All four language versions use four-space indentation and expanded statements. Rebuilding needs Python and clang-format; set `CLANG_FORMAT` to the formatter executable if it is not on PATH. The generator uses the Python standard library and the installed formatter, with no new application dependency.\n",{flag:"a"});
