import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

assert.equal(process.platform, "linux"); assert.equal(process.getuid(), 65534);
const exec = promisify(execFile), environment = { PATH: "/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin", HOME: "/work", TMPDIR: "/work", LANG: "C.UTF-8",
  LD_LIBRARY_PATH: "/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server", JAVA_HOME: "/usr/local/java", UV_THREADPOOL_SIZE: "1" };
async function run(file, args, input = "") {
  const task = exec(file, args, { timeout: 15000, maxBuffer: 65536, env: environment, cwd: "/work" });
  let pipeError; task.child.stdin.on("error", error => { pipeError = error; });
  if (input.length) task.child.stdin.end(input); else task.child.stdin.end();
  const result = await task; if (pipeError) throw pipeError; return result;
}
const paths = ["/usr/local/bin/isolate", "/usr/local/bin/ingenium-phase-exec", "/usr/local/bin/gcc", "/usr/local/bin/g++",
  "/usr/local/bin/python3.14", "/usr/local/bin/node", "/usr/local/java/bin/java", "/usr/local/java/bin/javac"], binaries = {};
for (const path of paths) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat(); assert.equal(stat.isFile(), true); assert.equal(stat.uid, 0); assert.equal(stat.gid, 0); assert.equal(stat.nlink, 1);
    assert.equal(stat.mode & 0o7022, 0); assert.ok(stat.mode & 0o111); assert.ok(stat.size > 0 && stat.size < 268435456);
    if (path === paths[0]) assert.equal(stat.mode & 0o7777, 0o555);
    const bytes = await file.readFile(); binaries[path] = createHash("sha256").update(bytes).digest("hex");
  } finally { await file.close(); }
}
const versions = {};
for (const [key, file, args, expected] of [["gcc", paths[2], ["-dumpfullversion"], /^15\.3\.0\s*$/], ["gpp", paths[3], ["-dumpfullversion"], /^15\.3\.0\s*$/],
  ["python", paths[4], ["--version"], /^Python 3\.14\.8\s*$/], ["node", paths[5], ["--version"], /^v24\.22\.0\s*$/],
  ["javac", paths[7], ["-version"], /^javac 21\.0\.12\.1\s*$/], ["java", paths[6], ["-version"], /^openjdk version "21\.0\.12\.1"/]]) {
  const result = await run(file, args), text = result.stdout + result.stderr; assert.match(text, expected); versions[key] = text.trim();
}
const java = ["-XX:-UseContainerSupport", "-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-XX:-UsePerfData", "-Xmx256m", "-Xss1m", "-Djava.io.tmpdir=/work"];
const profiles = [
  { key: "c", name: "main.c", source: '#include <stdio.h>\n#include <unistd.h>\nint main(void){long long a,b;if(getuid()!=65534)return 23;if(scanf("%lld%lld",&a,&b)!=2)return 2;printf("%lld\\n",a+b);}\n',
    compile: [paths[2], ["-std=c17", "-O2", "-pass-exit-codes", "-fdiagnostics-format=json", "-fdiagnostics-color=never", "/work/main.c", "-o", "/work/c-main"]], run: ["/work/c-main", []] },
  { key: "cpp", name: "main.cpp", source: '#include <iostream>\n#include <unistd.h>\nint main(){if(getuid()!=65534)return 23;long long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}\n',
    compile: [paths[3], ["-std=c++17", "-O2", "-pass-exit-codes", "-fdiagnostics-format=json", "-fdiagnostics-color=never", "/work/main.cpp", "-o", "/work/cpp-main"]], run: ["/work/cpp-main", []] },
  { key: "java", name: "Main.java", source: 'public class Main{public static void main(String[]a)throws Exception{String[]s=new String(System.in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).trim().split("\\\\s+");System.out.println(Long.parseLong(s[0])+Long.parseLong(s[1]));}}\n',
    compile: [paths[7], [...java.map(v => `-J${v}`), "-XDrawDiagnostics", "-encoding", "UTF-8", "-d", "/work", "/work/Main.java"]], run: [paths[6], [...java, "-Dfile.encoding=UTF-8", "-cp", "/work", "Main"]] },
  { key: "python", name: "main.py", source: 'import os,sys\nassert os.getuid()==65534\na,b=map(int,sys.stdin.buffer.read().split());print(a+b)\n', compile: null, run: [paths[4], ["-I", "-B", "/work/main.py"]] },
  { key: "javascript", name: "main.cjs", source: 'if(process.getuid()!==65534)process.exit(23);const[a,b]=require("node:fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);console.log(a+b);\n', compile: null,
    run: [paths[5], ["--max-old-space-size=256", "--v8-pool-size=1", "/work/main.cjs"]] },
];
const results = [];
for (const profile of profiles) {
  await writeFile(`/work/${profile.name}`, profile.source);
  const start = performance.now();
  if (profile.compile) {
    const result = await run(...profile.compile); assert.equal(result.stdout, "");
    if (["c", "cpp"].includes(profile.key)) assert.deepEqual(JSON.parse(result.stderr), []); else assert.equal(result.stderr, "");
  }
  for (const [input, expected] of [["7 5\n", "12\n"], ["-9 4\n", "-5\n"], ["2147483647 1\n", "2147483648\n"]]) {
    const result = await run(...profile.run, input); assert.equal(result.stdout, expected); assert.equal(result.stderr, "");
  }
  results.push({ language: profile.key, exact_answers: 3, elapsed_ms: Math.round(performance.now() - start) });
}
await writeFile("/work/bad.cpp", "int main( { return 0; }\n");
await assert.rejects(run(paths[3], ["-std=c++17", "-pass-exit-codes", "-fdiagnostics-format=json", "-fdiagnostics-color=never", "/work/bad.cpp", "-o", "/work/bad"]), error => {
  assert.equal(error.code, 1); assert.equal(error.stdout, ""); assert.ok(JSON.parse(error.stderr).some(v => v.kind === "error")); return true;
});
await assert.rejects(run(paths[5], ["/opt/ingenium/judge-executor/app/judge/capsule-cli.js"]), error => {
  assert.equal(error.code, 125); assert.equal(error.stdout, ""); assert.equal(error.stderr, "Protected capsule unavailable; retain its original reservation.\n"); return true;
});
console.log("INGENIUM_TOOLCHAIN_REPORT " + JSON.stringify({ scope: "TRUSTED_TOOLCHAIN_SMOKE", host_verified: false, versions, binaries, results, gcc_error_json: true, capsule_refusal: true }));
