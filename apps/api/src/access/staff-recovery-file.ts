import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { privateRuntimeJson } from "../runtime/private-file.js";
import { canonicalCode, sha256 } from "./credentials.js";
import { validateOperatorStaff } from "./staff-recovery.js";
import type { OperatorStaffInput } from "./staff-recovery.js";

const fields = [
  "requestKey",
  "action",
  "staffId",
  "credentialId",
  "displayName",
  "expectedRevision",
  "replacementSessionId",
  "operator",
  "osUser",
  "verification",
  "reason",
];

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()
  )
    throw new Error("Invalid private operator file.");
  return value as Record<string, unknown>;
}

export function parseOperatorCandidate(value: unknown): {
  input: OperatorStaffInput;
  accessCode: string | null;
} {
  const candidate = object(value, ["schema_version", "input", "access_code"]);
  if (candidate.schema_version !== 1)
    throw new Error("Invalid operator candidate version.");
  const raw = object(candidate.input, fields),
    code = candidate.access_code;
  if (
    raw.action === "DISABLE"
      ? code !== null
      : typeof code !== "string" || canonicalCode(code) !== code
  )
    throw new Error("Invalid candidate code.");
  const input = {
    ...raw,
    verifier: typeof code === "string" ? sha256(code) : null,
  } as unknown as OperatorStaffInput;
  validateOperatorStaff(input);
  return { input, accessCode: code as string | null };
}

async function privateHandoffParent(path: string) {
  if (
    process.platform !== "linux" ||
    !process.getuid ||
    process.getuid() === 0 ||
    !isAbsolute(path)
  )
    throw new Error("Restricted Linux maintenance host required.");
  const parent = dirname(path),
    repo = fileURLToPath(new URL("../../../../", import.meta.url));
  const inside = relative(repo, parent);
  if (!(inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)))
    throw new Error("Handoff must be outside the repository.");
  const stat = await lstat(parent);
  if (
    !stat.isDirectory() ||
    ![0, process.getuid()].includes(stat.uid) ||
    stat.mode & 0o077
  )
    throw new Error("Owner-only handoff directory required.");
  for (let current = parent; ; current = dirname(current)) {
    const entry = await lstat(current);
    if (
      !entry.isDirectory() ||
      ![0, process.getuid()].includes(entry.uid) ||
      entry.mode & 0o022
    )
      throw new Error("Unprotected handoff ancestor.");
    if (dirname(current) === current) break;
  }
  return parent;
}

export async function writeOperatorCandidate(path: string, value: unknown) {
  parseOperatorCandidate(value);
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  if (bytes.length > 16384) throw new Error("Oversized operator candidate.");
  const parent = await privateHandoffParent(path);
  const file = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  const directory = await open(
    parent,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export async function readOperatorCandidate(path: string) {
  await privateHandoffParent(path);
  return parseOperatorCandidate(await privateRuntimeJson(path, 16384));
}
