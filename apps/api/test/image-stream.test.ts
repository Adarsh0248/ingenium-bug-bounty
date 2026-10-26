import assert from "node:assert/strict";
import { test } from "node:test";
import { checkedImageTree, hashImageStream } from "../src/judge/image-stream.js";

const command = (code: string) => ({ file: process.execPath, args: ["-e", code] });
test("image bytes cross real pipes with backpressure and only a small digest reply is retained", async () => {
  const raw = await hashImageStream(command("process.stdout.end(Buffer.alloc(8*1024*1024,7))"),
    command("let n=0;process.stdin.on('data',b=>n+=b.length);process.stdin.on('end',()=>process.stdout.end(String(n)))"), AbortSignal.timeout(5000));
  assert.equal(raw.toString(), String(8 * 1024 * 1024));
});
test("failed, noisy, early-exiting or cancelled image readers cannot produce an accepted stream", async () => {
  for (const source of [command("process.exit(1)"), command("console.error('private');process.stdout.end('bytes')")])
    await assert.rejects(hashImageStream(source, command("process.stdin.resume();process.stdin.on('end',()=>console.log('reply'))"), AbortSignal.timeout(5000)));
  await assert.rejects(hashImageStream(command("process.stdout.end(Buffer.alloc(8*1024*1024))"), command("process.exit(0)"), AbortSignal.timeout(5000)));
  await assert.rejects(hashImageStream(command("process.stdout.write('x');setInterval(()=>{},1000)"), command("process.stdin.resume()"), AbortSignal.timeout(100)));
  await assert.rejects(hashImageStream(command("process.stdout.end('x')"), command("process.stdin.resume();console.log('x'.repeat(513))"), AbortSignal.timeout(5000)));
  await assert.rejects(hashImageStream(command("setInterval(()=>{},1000)"), { file: "invalid\0executable", args: [] }, AbortSignal.timeout(5000)));
});
test("image tree replies require the pinned digest and bounded nonempty counts", () => {
  const expected = "a".repeat(64), v = { protocol: "ingenium-image-tree-v1", tree_sha256: expected, entries: 3, files: 2, data_bytes: 100 };
  const raw = (value: unknown) => Buffer.from(JSON.stringify(value));
  assert.deepEqual(checkedImageTree(raw(v), expected), v);
  for (const patch of [{ files: 4 }, { entries: 0 }, { data_bytes: -1 }, { tree_sha256: "b".repeat(64) }, { extra: true }, { protocol: "other" }])
    assert.throws(() => checkedImageTree(raw({ ...v, ...patch }), expected));
  assert.throws(() => checkedImageTree(raw(null), expected));
});
