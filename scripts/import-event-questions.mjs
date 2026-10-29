import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as wait } from "node:timers/promises";
import { request } from "@playwright/test";

const { values } = parseArgs({
  options: {
    origin: { type: "string" },
    "code-file": { type: "string" },
    receipt: { type: "string" },
  },
});
assert.ok(
  values.origin && values["code-file"] && values.receipt,
  "Origin, private code file and receipt path are required.",
);
const origin = new URL(values.origin);
assert.ok(
  origin.protocol === "https:" &&
    !origin.username &&
    !origin.password &&
    origin.pathname === "/" &&
    !origin.search &&
    !origin.hash,
);
assert.ok(isAbsolute(values["code-file"]) && isAbsolute(values.receipt));
const keys = [
  "id",
  "round_type",
  "title",
  "statement",
  "difficulty",
  "category",
  "checker_mode",
  "variants",
  "cases",
  "hints",
];
const packs = [],
  packDigests = [];
for (const round of [1, 2]) {
  const bytes = await readFile(
    new URL(`../content/round-${round}/pack.json`, import.meta.url),
  );
  const pack = JSON.parse(bytes);
  assert.equal(pack.round_type, round);
  assert.equal(pack.questions.length, round === 1 ? 50 : 100);
  assert.deepEqual(pack.languages, ["c", "cpp", "java", "python"]);
  packs.push(
    ...pack.questions.map((q) =>
      Object.fromEntries(keys.map((key) => [key, q[key]])),
    ),
  );
  packDigests.push(createHash("sha256").update(bytes).digest("hex"));
}
assert.equal(new Set(packs.map((q) => q.id)).size, 150);
let receipt;
try {
  receipt = JSON.parse(await readFile(values.receipt, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
receipt ??= {
  protocol: "ingenium-event-question-import-v1",
  origin: origin.origin,
  pack_sha256: packDigests,
  completed: {},
  pending: null,
};
assert.equal(receipt.protocol, "ingenium-event-question-import-v1");
assert.equal(receipt.origin, origin.origin);
assert.deepEqual(receipt.pack_sha256, packDigests);
async function save() {
  const temporary = `${values.receipt}.pending`;
  await writeFile(temporary, JSON.stringify(receipt, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(temporary, values.receipt);
}
const client = await request.newContext({
  baseURL: origin.origin,
  timeout: 15000,
  maxRedirects: 0,
  extraHTTPHeaders: { Origin: origin.origin, accept: "application/json" },
});
let csrf,
  signedIn = false;
async function call(path, data) {
  for (;;) {
    const response =
      data === undefined
        ? await client.get(path)
        : await client.post(path, {
            data,
            headers: { "x-csrf-token": csrf ?? "" },
          });
    const body = await response.json();
    if (
      response.status() === 429 &&
      body.error?.code === "RATE_LIMITED" &&
      body.error.outcome === "NOT_PROCESSED"
    ) {
      await wait(
        Math.max(
          1,
          Math.min(60, Number(response.headers()["retry-after"]) || 1),
        ) * 1000,
      );
      continue;
    }
    if (!response.ok() || body.error)
      throw new Error(`${path}: ${body.error?.code ?? response.status()}`);
    return body.data;
  }
}
try {
  await save();
  csrf = (await call("/api/v1/bootstrap?audience=ANONYMOUS")).csrf_token;
  const matches = [
    ...(await readFile(values["code-file"], "utf8")).matchAll(
      /\b[A-Z2-7]{32}\b/g,
    ),
  ];
  assert.equal(
    matches.length,
    1,
    "The private file must contain exactly one staff code.",
  );
  const entry = await call("/api/v1/entry/verify", { code: matches[0][0] });
  assert.equal(entry.audience, "STAFF");
  assert.equal(entry.flow.mode, "NORMAL");
  csrf = entry.csrf_token;
  const session = await call("/api/v1/staff/entry/activate", {
    request_key: randomUUID(),
  });
  csrf = session.csrf_token;
  signedIn = true;
  if (receipt.pending) {
    const recovered = await call(
      `/api/v1/staff/outcomes/content/CREATE/catalogue/${receipt.pending}`,
    );
    assert.equal(
      recovered.status,
      "OBSERVED",
      "Original import remains unconfirmed; inspect its existing request key before continuing.",
    );
    assert.equal(recovered.outcome.outcome, "APPLIED");
    receipt.completed[receipt.pending] = recovered.outcome.version_id;
    receipt.pending = null;
    await save();
  }
  for (const question of packs) {
    if (receipt.completed[question.id]) continue;
    receipt.pending = question.id;
    await save();
    const result = await call("/api/v1/staff/content/import-question", {
      question,
    });
    assert.equal(result.outcome, "APPLIED");
    assert.ok(result.version_id);
    receipt.completed[question.id] = result.version_id;
    receipt.pending = null;
    await save();
    const count = Object.keys(receipt.completed).length;
    if (count % 10 === 0)
      console.log(
        JSON.stringify({
          imported: count,
          total: 150,
          round: question.round_type,
        }),
      );
  }
  const counts = (await call("/api/v1/staff/content/versions?round_type=1"))
    .round_counts;
  assert.ok(counts.round_1 >= 50 && counts.round_2 >= 100);
  receipt.finished_at = new Date().toISOString();
  receipt.round_counts = counts;
  await save();
  console.log(
    JSON.stringify({
      state: "DRAFTS_IMPORTED",
      imported: Object.keys(receipt.completed).length,
      round_counts: counts,
      published: false,
    }),
  );
} catch (error) {
  console.error(
    `Import stopped: ${error instanceof Error && !error.message.includes("\n") ? error.message : "request unavailable"}. Preserve the receipt and original question IDs; no question is published by this tool.`,
  );
  process.exitCode = 1;
} finally {
  if (signedIn) await call("/api/v1/staff/logout", {}).catch(() => {});
  await client.dispose();
}
