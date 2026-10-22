import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";

const bad = (): never => { throw new Error("Protected phase unavailable or uncertain; retain the execution reservation."); };
const nativeStart = (nonce: string) => `INGENIUM_EXEC_V1 ${nonce}\n`;
function challenge(nonce: string) { if (!/^[0-9a-f]{64}$/.test(nonce)) return bad(); }
export function acceptNativeStart(bytes: Buffer, nonce: string) {
  challenge(nonce); if (!bytes.equals(Buffer.from(nativeStart(nonce)))) return bad();
}

export class PhaseCapture {
  private readonly prefix: Buffer;
  private length = 0;
  private overflow = false;
  private ended = false;
  constructor(private readonly kind: "stdout" | "diagnostic") {
    if (!["stdout", "diagnostic"].includes(kind)) bad();
    this.prefix = Buffer.alloc(kind === "stdout" ? 1048577 : 65536);
  }
  push(bytes: Buffer) {
    if (this.ended || !Buffer.isBuffer(bytes)) return bad();
    const keep = Math.min(bytes.length, this.prefix.length - this.length);
    if (keep) { bytes.copy(this.prefix, this.length, 0, keep); this.length += keep; }
    this.overflow ||= bytes.length > keep || this.kind === "stdout" && this.length > 1048576;
    return this.kind === "stdout" && this.overflow;
  }
  end() { this.ended = true; }
  snapshot() { return { bytes: Buffer.from(this.prefix.subarray(0, this.length)), truncated: this.overflow || !this.ended, complete: this.ended && !this.overflow }; }
}

// Requires a separately verified, fresh private Isolate container/workspace/cgroup. This grants no start permission.
export function isolatePhaseCommand(plan: ExecutionPlan, phase: "compile" | "run", nonce: string) {
  challenge(nonce);
  if (!["compile", "run"].includes(phase)) return bad();
  const safe = reviewedExecutionPlan(plan);
  const stage = safe[phase]; if (!stage) return bad();
  const seconds = (ms: number) => `${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, "0")}`;
  return { file: "/usr/local/bin/isolate", args: ["--cg", "--box-id=0", "--no-default-dirs", "--dir=/box=/run/ingenium/workspace:rw",
    "--dir=/usr", "--dir=/lib", "--dir=/lib64:maybe", "--processes=64", "--stack=65536", "--fsize=16384",
    `--time=${seconds(stage.limits.cpuMs)}`, "--extra-time=0", `--wall-time=${seconds(stage.limits.wallMs)}`, `--cg-mem=${stage.limits.memoryKb}`,
    `--meta=/run/ingenium/control/${phase}.meta`, "--inherit-fds", "--run", "--", "/usr/local/bin/ingenium-phase-exec", nonce, "3", phase === "compile" ? "1" : "4", "--", ...stage.argv],
    kind: phase, wallMs: stage.limits.wallMs + 5000 } as const;
}

// Private I/O primitive only. Real callers must use the verified Isolate installation, never execute source directly.
export async function capturePhaseProcess(command: { file: string; args: readonly string[] }, input: Buffer,
  options: { kind: "compile" | "run"; nonce: string; wallMs: number }, signal: AbortSignal) {
  const { kind, nonce, wallMs } = options;
  challenge(nonce); signal.throwIfAborted();
  if (!Buffer.isBuffer(input) || input.length > 1048576 || kind === "compile" && input.length !== 0 || !["compile", "run"].includes(kind)
    || !Number.isSafeInteger(wallMs) || wallMs < 1 || wallMs > 35000) return bad();
  const stdin = Buffer.from(input), args = [...command.args];
  return new Promise<{ managerExitCode: number | null; managerExitSignal: NodeJS.Signals | null; managerDiagnostics: Buffer;
    stdout: Buffer; stderr: Buffer; compiler: Buffer; stdoutComplete: boolean; stderrTruncated: boolean; compilerTruncated: boolean; handoffVerified: true; outputLimitObserved: boolean }>((resolve, reject) => {
    const out = new PhaseCapture("stdout"), err = new PhaseCapture("diagnostic"), compiler = new PhaseCapture("diagnostic");
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command.file, args, { shell: false, windowsHide: true, cwd: process.platform === "win32" ? undefined : "/",
        env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8", ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {}) },
        stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"] });
    } catch { reject(new Error("Protected phase could not start; retain the execution reservation.")); return; }
    if (child.stdio.length !== 5 || child.stdio.some(stream => !stream)) {
      child.on("error", () => {}); child.once("close", () => reject(new Error("Protected phase pipes unavailable; retain the execution reservation.")));
      for (const stream of child.stdio) stream?.destroy(); child.kill("SIGKILL"); return;
    }
    const streams = child.stdio as [Writable, Readable, Readable, Readable, Readable];
    let failed = false, outputLimited = false, managerBytes = 0, witnessBytes = 0;
    let stdoutEnded = false, stderrEnded = false, managerEnded = false, witnessEnded = false;
    const manager: Buffer[] = [], witness: Buffer[] = [];
    const fail = () => { failed = true; for (const stream of streams) stream.destroy(); child.kill("SIGKILL"); };
    const timer = setTimeout(fail, wallMs);
    signal.addEventListener("abort", fail, { once: true }); if (signal.aborted) fail();
    child.on("error", fail);
    streams[0].on("error", error => { if (!["EPIPE", "ECONNRESET"].includes((error as NodeJS.ErrnoException).code ?? "")) fail(); });
    for (const stream of streams.slice(1)) stream.on("error", fail);
    streams[1].on("data", (bytes: Buffer) => {
      if (kind === "compile") compiler.push(bytes);
      else if (out.push(bytes) && !outputLimited) { outputLimited = true; streams[1].destroy(); }
    });
    streams[4].on("data", (bytes: Buffer) => { (kind === "compile" ? compiler : err).push(bytes); });
    streams[2].on("data", (bytes: Buffer) => { managerBytes += bytes.length; if (managerBytes > 16384) fail(); else manager.push(bytes); });
    streams[3].on("data", (bytes: Buffer) => { witnessBytes += bytes.length; if (witnessBytes > 256) fail(); else witness.push(bytes); });
    streams[1].on("end", () => { stdoutEnded = true; }); streams[4].on("end", () => { stderrEnded = true; });
    streams[2].on("end", () => { managerEnded = true; }); streams[3].on("end", () => { witnessEnded = true; });
    child.on("close", (managerExitCode, managerExitSignal) => {
      clearTimeout(timer); signal.removeEventListener("abort", fail);
      if (failed || !managerEnded || !witnessEnded || !stderrEnded || !stdoutEnded && !outputLimited) { reject(new Error("Protected phase failed; execution and cleanup remain uncertain.")); return; }
      try {
        acceptNativeStart(Buffer.concat(witness, witnessBytes), nonce);
        if (stdoutEnded) out.end(); err.end(); compiler.end();
        const output = out.snapshot(), diagnostics = err.snapshot(), compilation = compiler.snapshot();
        resolve({ managerExitCode, managerExitSignal, managerDiagnostics: Buffer.concat(manager, managerBytes), stdout: output.bytes,
          stderr: diagnostics.bytes, compiler: compilation.bytes, stdoutComplete: kind === "compile" || output.complete,
          stderrTruncated: diagnostics.truncated, compilerTruncated: compilation.truncated, handoffVerified: true, outputLimitObserved: outputLimited });
      } catch { reject(new Error("Native handoff missing or unusable; retain the execution reservation.")); }
    });
    streams[0].end(stdin);
  });
}
