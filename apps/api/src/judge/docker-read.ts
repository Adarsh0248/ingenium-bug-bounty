import { JUDGE_BODY_LIMIT } from "../content/judge-protocol.js";

const fail = (): never => { throw new Error("Authenticated Docker observation is incomplete or malformed."); };
const identifier = /^[0-9a-f]{64}$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
export function dockerHttpBody(raw: Buffer): Buffer {
  if (!Buffer.isBuffer(raw) || raw.length > JUDGE_BODY_LIMIT) return fail();
  const end = raw.indexOf("\r\n\r\n");
  if (end < 0 || end > 16384 || raw.subarray(0, end).some(byte => byte < 32 && byte !== 13 && byte !== 10 || byte > 126)) return fail();
  const lines = raw.subarray(0, end).toString("ascii").split("\r\n");
  if (!/^HTTP\/1\.[01] 200 [\x20-\x7e]+$/.test(lines.shift()!)) return fail();
  const headers = new Map<string, string>();
  for (const line of lines) {
    const match = /^([A-Za-z0-9-]+):[ \t]*([^\r\n]*)$/.exec(line);
    if (!match || headers.has(match[1]!.toLowerCase())) return fail();
    headers.set(match[1]!.toLowerCase(), match[2]!.trim());
  }
  if (headers.has("transfer-encoding") || headers.has("content-encoding") && headers.get("content-encoding") !== "identity"
    || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers.get("content-type") ?? "")) return fail();
  const body = raw.subarray(end + 4), length = headers.get("content-length");
  if (!body.length || length !== undefined && (!/^(0|[1-9][0-9]*)$/.test(length) || BigInt(length) !== BigInt(body.length))) return fail();
  return body;
}
// Only fixed read commands bypass CLI startup; create/start/stop/remove keep their original transport.
export function dockerReadRequest(args: readonly string[]): { path: string; output(body: Buffer): Buffer } | null {
  const json = (body: Buffer) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
  if (JSON.stringify(args) === '["info","--format","{{json .}}"]')
    return { path: "/info", output(body) { object(json(body)); return body; } };
  if (args.length === 5 && args.slice(0, 4).join("|") === "image|inspect|--format|{{json .}}" && /^sha256:[0-9a-f]{64}$/.test(args[4]!))
    return { path: `/images/${args[4]}/json`, output(body) { object(json(body)); return body; } };
  const inspection = args.length === 4 && args.slice(0, 3).join("|") === "inspect|--type|container"
    || args.length === 6 && args.slice(0, 5).join("|") === "inspect|--type|container|--format|{{json .}}";
  if (inspection && identifier.test(args.at(-1)!)) return { path: `/containers/${args.at(-1)}/json`,
    output(body) { const row = object(json(body)); return Buffer.from(JSON.stringify(args.length === 4 ? [row] : row)); } };
  if (![6, 8].includes(args.length) || args.slice(0, 4).join("|") !== "container|ls|--all|--no-trunc") return null;
  const filter = args.length === 8 ? args[5] : undefined;
  if (args.length === 8 && (args[4] !== "--filter" || !/^(?:id=[0-9a-f]{64}|name=\^\/[A-Za-z0-9][A-Za-z0-9_.-]*\$)$/.test(filter!))
    || args.at(-2) !== "--format" || !["{{.ID}}", "{{.ID}} {{.Names}}"].includes(args.at(-1)!)) return null;
  return { path: "/containers/json?all=true", output(body) {
    const rows = json(body);
    if (!Array.isArray(rows) || rows.length > 16384) return fail();
    const result: string[] = [], ids = new Set<string>();
    for (const value of rows) {
      const row = object(value);
      if (typeof row.Id !== "string" || !identifier.test(row.Id) || ids.has(row.Id)
        || !Array.isArray(row.Names) || row.Names.length !== 1 || typeof row.Names[0] !== "string"
        || !/^\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(row.Names[0])) return fail();
      ids.add(row.Id); const name = row.Names[0] as string;
      if (filter?.startsWith("id=") && row.Id !== filter.slice(3) || filter?.startsWith("name=") && name !== filter.slice(6, -1)) continue;
      result.push(args.at(-1) === "{{.ID}}" ? row.Id : `${row.Id} ${name.slice(1)}`);
    }
    return Buffer.from(result.length ? result.join("\n") + "\n" : "");
  } };
}
