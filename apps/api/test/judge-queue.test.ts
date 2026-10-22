import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Socket } from "node:net";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { createJudgeQueue } from "../src/judge/queue.js";

const settings = () => ({ hostEpochId: randomUUID(), bootId: randomUUID(), address: "127.0.0.1", port: 6379, password: "a".repeat(64) });
test("judge queue configuration refuses public/metadata/DNS addresses, malformed identities and non-generated credentials", () => {
  for (const address of ["8.8.8.8", "169.254.169.254", "localhost", "::1", "http://10.0.0.1", "0.0.0.0"]) assert.throws(() => createJudgeQueue({ ...settings(), address }));
  for (const value of [{ port: 0 }, { port: 65536 }, { port: 1.1 }, { password: "secret" }, { hostEpochId: "not-uuid" }, { bootId: "not-uuid" }]) assert.throws(() => createJudgeQueue({ ...settings(), ...value }));
  const q = createJudgeQueue(settings()); q.close();
});

for (const reason of ["abort", "deadline"] as const) test(`private Redis ${reason} destroys an unresponsive socket without background reconnect or replay`, { timeout: 15000 }, async () => {
  const sockets = new Set<Socket>(); let connections = 0;
  const server = createServer(socket => { connections++; sockets.add(socket); socket.on("error", () => {}); socket.on("data", () => {}); socket.on("close", () => sockets.delete(socket)); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const q = createJudgeQueue({ ...settings(), port: address.port }), controller = new AbortController();
  const start = performance.now();
  try {
    const pending = q.entries(controller.signal);
    await assert.rejects(q.entries(new AbortController().signal), /unavailable/);
    if (reason === "abort") { await setTimeout(50); controller.abort(); }
    await assert.rejects(pending, /reconcile/);
    assert.ok(performance.now() - start < (reason === "abort" ? 2000 : 12000));
    for (let i = 0; i < 30 && sockets.size; i++) await setTimeout(10);
    assert.equal(sockets.size, 0); assert.equal(connections, 1);
    await assert.rejects(q.entries(new AbortController().signal), /unavailable/); assert.equal(connections, 1);
  } finally { q.close(); for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("an already cancelled queue operation sends nothing", async () => {
  const q = createJudgeQueue(settings()), signal = AbortSignal.abort();
  try { await assert.rejects(q.entries(signal)); } finally { q.close(); }
});
