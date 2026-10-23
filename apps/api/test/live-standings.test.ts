import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { createStandingsReader } from "../src/live/standings.js";
import type { StreamHead } from "../src/live/protocol.js";

const streams = (head = "1", id = "round-stream"): StreamHead[] => [
  { stream_id: id, kind: "ROUND", head, retained_from: "1", schema_version: 1 },
];
function fixture() {
  let calls = 0;
  const replies: ((rows: unknown[]) => void)[] = [];
  const client = {
    query: async () => {
      calls++;
      return {
        rows: await new Promise<unknown[]>((resolve) => replies.push(resolve)),
      };
    },
  } as unknown as PoolClient;
  return {
    client,
    replies,
    calls: () => calls,
    reader: createStandingsReader(),
  };
}
const value = (points = 100) => ({
  final: false,
  standings: [
    { team_round_id: "team", points, wallet: 999, difficulties: [80] },
  ],
});

test("one committed round version coalesces public reads without retaining wallets or sharing mutable results", async () => {
  const f = fixture();
  const first = f.reader(f.client, "round", streams()),
    second = f.reader(f.client, "round", streams());
  assert.equal(f.calls(), 1);
  f.replies[0]!([value()]);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(Object.hasOwn(a.standings[0]!, "wallet"), false);
  a.standings[0]!.points = -1;
  (a.standings[0]!.difficulties as number[]).push(1);
  assert.equal(b.standings[0]!.points, 100);
  assert.deepEqual(
    (await f.reader(f.client, "round", streams())).standings[0]!.difficulties,
    [80],
  );
  assert.equal(f.calls(), 1);
});

test("round, stream and committed head changes replace the single public cache entry", async () => {
  const f = fixture();
  for (const [round, head, id] of [
    ["r1", "1", "a"],
    ["r1", "2", "a"],
    ["r2", "2", "b"],
    ["r1", "2", "a"],
  ]) {
    const read = f.reader(f.client, round!, streams(head!, id!));
    f.replies.at(-1)!([value(f.calls())]);
    assert.equal((await read).standings[0]!.points, f.calls());
  }
  assert.equal(f.calls(), 4);
});

test("a failed shared query is evicted rather than falling back to an older score", async () => {
  const f = fixture();
  const a = f.reader(f.client, "round", streams()),
    b = f.reader(f.client, "round", streams());
  f.replies[0]!([]);
  const results = await Promise.allSettled([a, b]);
  assert.ok(results.every((r) => r.status === "rejected"));
  const retry = f.reader(f.client, "round", streams());
  assert.equal(f.calls(), 2);
  f.replies[1]!([value(200)]);
  assert.equal((await retry).standings[0]!.points, 200);
  await assert.rejects(f.reader(f.client, "round", []), {
    code: "SECURITY_UNAVAILABLE",
  });
});
