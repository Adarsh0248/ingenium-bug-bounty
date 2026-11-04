import type {IsolateObservation} from "../../src/judge/isolate-evidence.js";
export function isolateObservation(kind: "compile" | "run", extra: { code?: number; signal?: number; timeout?: "cpu" | "wall"; oom?: boolean; overflow?: boolean; compiler?: Buffer; stdout?: Buffer } = {}): IsolateObservation {
  const code = extra.code ?? 0, cpu = extra.timeout === "cpu" ? "1100000000" : "10000000", wall = extra.timeout === "wall" ? "5.100" : "0.020";
  const controls = extra.timeout ? `status:TO\nmessage:Time limit exceeded${extra.timeout === "wall" ? " (wall clock)" : ""}\nkilled:1\n`
    : extra.signal ? `status:SG\nexitsig:${extra.signal}\nmessage:Caught fatal signal ${extra.signal}\n`
      : code ? `status:RE\nexitcode:${code}\nmessage:Exited with error status ${code}\n` : "exitcode:0\n";
  const failed = Boolean(extra.timeout || extra.signal || code);
  const time = extra.timeout === "cpu" ? "1.100" : "0.010";
  const diagnostic = extra.timeout ? `Time limit exceeded${extra.timeout === "wall" ? " (wall clock)" : ""}\n`
    : extra.signal ? `Caught fatal signal ${extra.signal}\n` : code ? `Exited with error status ${code}\n` : `OK (${time} sec real, ${wall} sec wall)\n`;
  return { metadata: Buffer.from(`time:${time}\ntime-wall:${wall}\nmax-rss:4\ncsw-voluntary:1\ncsw-forced:0\ncg-mem:4\n${controls}${extra.oom ? "cg-oom-killed:1\n" : ""}`),
    counters: { cpuNs: cpu, peakBytes: "4096", memoryHits: "0", combinedHits: extra.oom ? "38" : "0", oomKills: extra.oom ? "1" : "0" },
    targetObserved: true, workspaceHasRoom: true, wallElapsedMs: extra.timeout === "wall" ? 5110 : 30,
    pipes: { managerExitCode: failed ? 1 : 0, managerExitSignal: null, managerDiagnostics: Buffer.from(diagnostic),
      stdout: kind === "compile" ? Buffer.alloc(0) : extra.overflow ? Buffer.alloc(1048577, 65) : extra.stdout ?? Buffer.from("12\n"),
      stderr: Buffer.alloc(0), compiler: extra.compiler ?? Buffer.alloc(0), stdoutComplete: !extra.overflow, stderrTruncated: false, compilerTruncated: false,
      handoffVerified: true, outputLimitObserved: Boolean(extra.overflow) } };
}
