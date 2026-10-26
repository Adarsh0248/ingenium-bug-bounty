import assert from "node:assert/strict";
import { test } from "node:test";
import { checkedCheckpointBudget, observeCheckpointStorage } from "../src/judge/host-storage.js";

test("host checkpoint admission requires a bounded durable volume and headroom for both outstanding permits", () => {
  const fs = { type: 0xef53, bsize: 4096, blocks: 8 * 1024 ** 3 / 4096, bavail: 1024 * 1024, files: 524288, ffree: 10000 };
  assert.deepEqual(checkedCheckpointBudget(fs), { total_bytes: 8 * 1024 ** 3, total_inodes: 524288 });
  for (const patch of [{ type: 0x01021994 }, { blocks: fs.blocks + 1 }, { blocks: 1 }, { bavail: 8191 }, { ffree: 127 },
    { bavail: fs.blocks + 1 }, { ffree: fs.files + 1 }, { bsize: 0 }, { blocks: NaN }, { files: 1.5 }]) assert.throws(() => checkedCheckpointBudget({ ...fs, ...patch }));
});
test("an aborted or ordinary local caller cannot attest physical checkpoint allocation", async () => {
  await assert.rejects(observeCheckpointStorage(AbortSignal.abort()));
  if (process.platform !== "linux" || process.getuid?.() !== 0) await assert.rejects(observeCheckpointStorage(AbortSignal.timeout(1000)));
});
