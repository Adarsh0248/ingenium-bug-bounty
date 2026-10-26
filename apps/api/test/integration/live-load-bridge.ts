import assert from "node:assert/strict";
import { createConnection, createServer } from "node:net";
import type { Socket } from "node:net";
import { liveLoadDriver } from "./live-load-driver.js";

const LIMIT = 1048576;
function path(name: string) { assert.match(name, /^ingenium-load-[0-9a-f-]{36}$/); return `\0${name}`; }
export function remoteLiveDriver(name: string) {
  const socket = createConnection({ path: path(name) }); let id = 0, bytes = Buffer.alloc(0), closed = false, pending: { id: number; resolve(v: any): void; reject(e: Error): void } | undefined;
  const connected = new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("error", reject); });
  void connected.catch(() => {});
  const fail = () => { pending?.reject(new Error("Separate live generator unavailable.")); pending = undefined; socket.destroy(); };
  socket.on("error", fail); socket.on("close", fail);
  socket.on("data", chunk => {
    bytes = Buffer.concat([bytes, chunk]); if (bytes.length > LIMIT) return fail();
    const end = bytes.indexOf(10); if (end < 0) return;
    try {
      const reply = JSON.parse(bytes.subarray(0, end).toString("utf8")); bytes = bytes.subarray(end + 1);
      if (!pending || reply.id !== pending.id || typeof reply.ok !== "boolean" || bytes.length) return fail();
      if (reply.ok) pending.resolve(reply.value); else pending.reject(new Error("Separate live generator assertion failed; inspect its source-free state.")); pending = undefined;
    } catch { fail(); }
  });
  async function call(method: string, value: unknown) {
    if (closed) { assert.equal(method, "close"); return null; }
    await connected; assert.equal(pending, undefined); const next = ++id;
    const data = Buffer.from(JSON.stringify({ id: next, method, value }) + "\n"); assert.ok(data.length <= LIMIT);
    const timer = setTimeout(fail, 120000);
    try {
      return await new Promise<any>((resolve, reject) => { pending = { id: next, resolve, reject }; socket.write(data, error => { if (error) fail(); }); });
    } finally { clearTimeout(timer); if (method === "close") { closed = true; socket.end(); } }
  }
  return Object.fromEntries(["initialise", "fourth", "reconnect", "phase", "projection", "finish", "state", "claims", "close"].map(method => [method, (value: unknown = null) => call(method, value)])) as unknown as ReturnType<typeof liveLoadDriver>;
}

export async function serveLiveDriver(name: string) {
  assert.equal(process.platform, "linux"); assert.equal(process.getuid?.(), 1000);
  const driver = liveLoadDriver(); let client: Socket | undefined, busy = false, bytes = Buffer.alloc(0);
  const server = createServer(socket => {
    if (client) { socket.destroy(); return; } client = socket;
    socket.on("error", () => { void driver.close(); });
    socket.on("close", () => { void driver.close(); server.close(); });
    socket.on("data", chunk => {
      bytes = Buffer.concat([bytes, chunk]); if (bytes.length > LIMIT || busy) { socket.destroy(); return; }
      const end = bytes.indexOf(10); if (end < 0) return;
      let row;
      try { row = JSON.parse(bytes.subarray(0, end).toString("utf8")); bytes = bytes.subarray(end + 1); assert.equal(bytes.length, 0);
        assert.deepEqual(Object.keys(row).sort(), ["id", "method", "value"]); assert.ok(Number.isSafeInteger(row.id)); assert.ok(Object.hasOwn(driver, row.method)); }
      catch { socket.destroy(); return; }
      busy = true;
      const method = driver[row.method as keyof typeof driver] as (value: unknown) => Promise<unknown>;
      void method(row.value).then(value => ({ id: row.id, ok: true, value }), () => ({ id: row.id, ok: false, value: null }))
        .then(reply => { busy = false; socket.write(JSON.stringify(reply) + "\n"); if (row.method === "close") { socket.end(); server.close(); } });
    });
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen({ path: path(name) }, resolve); });
  console.log("INGENIUM_GENERATOR_READY");
}
