// Keep source, database URLs, credentials and arbitrary exception messages out of service logs.
export function judgeFaultDiagnostic(error: unknown) {
  const frames: string[] = [], codes: string[] = [];
  const proc: { syscall: string; path: string }[] = [];
  const procRead = (row: { syscall?: unknown; path?: unknown }) => {
    if (proc.length < 6 && typeof row.syscall === "string" && ["open", "readlink", "stat"].includes(row.syscall)
      && typeof row.path === "string" && /^\/proc\/self\/fd\/[0-9]{1,10}\/(?:mountinfo|cgroup|cwd|root|exe|fd\/[0-9]{1,10})$/.test(row.path))
      proc.push({ syscall: row.syscall, path: row.path });
  };
  let exit: number | null = null, signal: string | null = null;
  for (let depth = 0; depth < 6 && error && typeof error === "object"; depth++) {
    const row = error as { stack?: unknown; code?: unknown; cause?: unknown; exit_code?: unknown; signal?: unknown; diagnostic_prefix?: unknown; syscall?: unknown; path?: unknown };
    procRead(row);
    if (typeof row.code === "string" && /^(?:[0-9A-Z]{5}|E[A-Z]{2,24})$/.test(row.code)) codes.push(row.code);
    if (typeof row.diagnostic_prefix === "string") {
      const line = /(?:^|\n)Protected host diagnostic: (\{[^\n]{1,3072}\})(?:\n|$)/.exec(row.diagnostic_prefix.slice(0, 4096));
      if (line) try {
        const parsed = JSON.parse(line[1]!) as { codes?: unknown; proc?: unknown };
        if (Array.isArray(parsed.codes)) for (const code of parsed.codes.slice(0, 6))
          if (typeof code === "string" && /^(?:[0-9A-Z]{5}|E[A-Z]{2,24})$/.test(code)) codes.push(code);
        if (Array.isArray(parsed.proc)) for (const item of parsed.proc.slice(0, 6))
          if (item && typeof item === "object") procRead(item);
      } catch { /* Unparseable child diagnostics grant no additional information. */ }
    }
    if (Number.isInteger(row.exit_code) && Number(row.exit_code) >= 0 && Number(row.exit_code) <= 255) exit = Number(row.exit_code);
    if (typeof row.signal === "string" && /^SIG[A-Z]{2,12}$/.test(row.signal)) signal = row.signal;
    for (const text of [row.stack, row.diagnostic_prefix]) if (typeof text === "string") {
      for (const match of text.slice(0, 8192).matchAll(/\/opt\/ingenium\/[a-zA-Z0-9_./-]+\.js:\d+:\d+/g)) {
        frames.push(match[0]);
        if (frames.length > 12) frames.shift();
      }
    }
    error = row.cause;
  }
  return { codes, exit, signal, frames, ...(proc.length ? { proc } : {}) };
}
