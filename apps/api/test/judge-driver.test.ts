import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, request } from "node:https";
import { createServer as tcpServer } from "node:net";
import type { Socket } from "node:net";
import type { Duplex } from "node:stream";
import type { TLSSocket } from "node:tls";
import { join } from "node:path";
import { test } from "node:test";
import { LANGUAGES, sha256 } from "../src/access/credentials.js";
import { createAuthoringJudgeDriver } from "../src/content/judge-driver.js";
import type { JudgeDriverSettings } from "../src/content/judge-driver.js";
import { authoringPayloadDigest } from "../src/content/execution-policy.js";
import type { AuthoringPayload } from "../src/content/execution-policy.js";
import { judgeJson, JUDGE_BODY_LIMIT, JUDGE_PROTOCOL, readJudgeJson, runtimeRecord } from "../src/content/judge-protocol.js";
import { judgePayload, judgeReply, judgeRuntimes } from "./fixtures/judge.js";
import { createTestTls } from "./fixtures/tls.js";

test("private judge HTTPS client and synthetic protocol server", { timeout: 60000 }, async t => {
  const { directory, ca, cert, key, clientCert, clientKey } = await createTestTls(t);
  const seed = judgePayload(), runtimes = judgeRuntimes(), payloads = new Map<string, AuthoringPayload>(), saved = new Map<string, string>(), sockets = new Set<Duplex>();
  let mode = "NORMAL", received = 0, posts = 0, gets = 0, handlerError: unknown;
  const server = createServer({ ca, cert, key, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.3" }, async (req, res) => {
    received++;
    try {
      if (!(req.socket as TLSSocket).getPeerCertificate().raw.equals(new X509Certificate(clientCert).raw)) {
        res.writeHead(403, { "Content-Type": "application/json" }); res.end("{}"); return;
      }
      const nonce = req.headers["x-ingenium-request-id"] as string;
      assert.equal(req.headers["x-ingenium-host-epoch"], seed.hostEpochId);
      assert.equal(req.headers["host"], "judge.test");
      const prefix = "/ingenium/v1/authoring";
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer);
      if (mode === "STALL") {
        res.writeHead(200, { "Content-Type": "application/json" }); res.write("{");
        const timer = setInterval(() => res.write(" "), 400); timer.unref(); res.once("close", () => clearInterval(timer)); return;
      }
      if (mode === "REDIRECT") { res.writeHead(307, { "Content-Type": "application/json", Location: "https://example.invalid/never-follow" }); res.end("{}"); return; }
      if (mode === "COMPRESSED") { res.writeHead(200, { "Content-Type": "application/json", "Content-Encoding": "gzip" }); res.end("{}"); return; }
      if (mode === "HTML") { res.writeHead(200, { "Content-Type": "text/html" }); res.end("{}"); return; }
      if (mode === "BAD_JSON") { res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ready":true,"ready":false}'); return; }
      if (mode === "LENGTH") { res.writeHead(200, { "Content-Type": "application/json", "Content-Length": JUDGE_BODY_LIMIT + 1 }); res.end("{}"); return; }
      if (mode === "STREAM_SIZE") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(Buffer.alloc(JUDGE_BODY_LIMIT + 1, 65)); return; }
      if (mode === "HEADERS") { res.writeHead(200, { "Content-Type": "application/json", "X-Large": "A".repeat(17000) }); res.end("{}"); return; }
      if (mode === "TRUNCATED") {
        res.writeHead(200, { "Content-Type": "application/json", "Content-Length": 100 }); res.write("{}"); res.flushHeaders();
        setImmediate(() => req.socket.destroy()); return;
      }
      if (mode === "ERROR") { res.writeHead(503, { "Content-Type": "application/json" }); res.end("{}"); return; }
      res.setHeader("Content-Type", "application/json");
      if (req.url === `${prefix}/ready`) {
        const ready = { protocol: JUDGE_PROTOCOL, request_id: nonce, host_epoch_id: seed.hostEpochId, ready: true, runtimes: runtimeRecord(runtimes) };
        if (mode === "FOREIGN") ready.host_epoch_id = judgePayload().hostEpochId;
        if (mode === "NONCE") ready.request_id = judgePayload().attemptId;
        if (mode === "RUNTIME") ready.runtimes.cpp!.digest = "f".repeat(64);
        res.end(judgeJson(ready)); return;
      }
      const attempt = req.url?.slice(`${prefix}/attempts/`.length), p = payloads.get(attempt ?? ""); assert.ok(p);
      assert.equal(req.headers["x-ingenium-payload-digest"], authoringPayloadDigest(p).toString("hex"));
      const reply = judgeReply(p, nonce, Buffer.from("12\n"), saved.get(p.attemptId));
      if (req.method === "POST") {
        posts++;
        const data = readJudgeJson(Buffer.concat(chunks)) as Record<string, unknown>;
        assert.equal(data.attempt_id, p.attemptId); assert.equal(data.payload_digest, authoringPayloadDigest(p).toString("hex"));
        assert.equal(data.request_id, nonce);
        assert.deepEqual(Buffer.from(data.source_b64 as string, "base64"), p.source); assert.deepEqual(Buffer.from(data.stdin_b64 as string, "base64"), p.stdin);
        assert.equal("expected_output" in data, false); assert.equal(data.number_of_runs, 1); assert.equal(data.enable_network, false);
        saved.set(p.attemptId, reply.provider_token!);
        if (mode === "LOST") { req.socket.destroy(); return; }
        res.statusCode = 201;
      } else { assert.equal(req.method, "GET"); assert.equal(chunks.length, 0); gets++; }
      if (mode === "ABSENT") { res.statusCode = 404; res.end(judgeJson({ ...reply, state: "ABSENT", provider_token: null, execution_generation: null, evidence: null })); return; }
      if (mode === "FOREIGN") reply.attempt_id = judgePayload().attemptId;
      res.end(judgeJson(reply));
    } catch (error) { handlerError = error; res.statusCode = 500; res.end(); }
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  server.on("tlsClientError", () => {});
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const settings: JudgeDriverSettings = { hostEpochId: seed.hostEpochId, endpointRef: "synthetic-local-test", address: "127.0.0.1", port: address.port,
    serverName: "judge.test", serverCertificateSha256: sha256(new X509Certificate(cert).raw).toString("hex"), ca, certificate: clientCert, privateKey: clientKey, runtimes };
  const driver = createAuthoringJudgeDriver(settings), signal = () => AbortSignal.timeout(15000);
  const payload = (language: AuthoringPayload["language"] = "cpp") => {
    const p = { ...judgePayload(language), hostEpochId: seed.hostEpochId }; payloads.set(p.attemptId, p); return p;
  };
  await t.test("mutually authenticated pinned TLS serves readiness and real byte-preserving POST/GET for all languages", async () => {
    await driver.assertReady(signal());
    for (const language of LANGUAGES) {
      const p = payload(language);
      const created = await driver.submit(p, signal()) as Record<string, unknown>;
      const observed = await driver.observe(p, signal()) as Record<string, unknown>;
      assert.equal(created.execution_result, "NORMAL"); assert.deepEqual(created.stdout, Buffer.from("12\n"));
      assert.equal(created.evidence_digest, observed.evidence_digest);
    }
    assert.equal(posts, 5); assert.equal(gets, 5); assert.equal(handlerError, undefined);
  });
  await t.test("lost POST response is never retried; a fresh client recovers the same association through GET", async () => {
    const p = payload(), before = posts; mode = "LOST";
    await assert.rejects(driver.submit(p, signal()), /Private judge unavailable/);
    assert.equal(posts, before + 1); mode = "NORMAL";
    const observation = await createAuthoringJudgeDriver(settings).observe(p, signal()) as Record<string, unknown>;
    assert.equal(observation.state, "FINISHED"); assert.equal(posts, before + 1);
  });
  await t.test("maximum admitted source/stdin fit one bounded request with no byte conversion", async () => {
    const p = payload(); p.source = Buffer.alloc(131072, 65); p.stdin = Buffer.alloc(1048576, 66);
    assert.equal((await driver.submit(p, signal()) as Record<string, unknown>).state, "FINISHED");
  });
  await t.test("bound authoritative absence means pending, never a new POST or physical release", async () => {
    const p = payload(), before = posts; mode = "ABSENT";
    assert.deepEqual(await driver.observe(p, signal()), { state: "PENDING" }); assert.equal(posts, before);
    mode = "NORMAL";
  });
  await t.test("wrong certificate pin, wrong TLS name and untrusted CA fail before application requests", async () => {
    const before = received;
    for (const changed of [{ serverCertificateSha256: "f".repeat(64) }, { serverName: "foreign.test" }, { ca: clientCert }]) {
      await assert.rejects(createAuthoringJudgeDriver({ ...settings, ...changed }).assertReady(signal()), /Private judge unavailable/);
    }
    assert.equal(received, before);
  });
  await t.test("the test server refuses a client without a certificate", async () => {
    const before = received;
    await assert.rejects(new Promise<void>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port: address.port, servername: "judge.test", ca, rejectUnauthorized: true, agent: false, signal: signal() }, res => { res.resume(); resolve(); });
      req.on("error", reject); req.end();
    }));
    assert.equal(received, before);
  });
  await t.test("CA trust alone does not grant client authorisation to a different epoch credential", async () => {
    const before = posts;
    const other = createAuthoringJudgeDriver({ ...settings, certificate: await readFile(join(directory, "other.pem")), privateKey: await readFile(join(directory, "other.key")) });
    await assert.rejects(other.submit(payload(), signal()), /Private judge unavailable/); assert.equal(posts, before);
  });
  await t.test("health cannot accept cached/foreign identity or changed runtime manifests", async () => {
    for (const bad of ["FOREIGN", "NONCE", "RUNTIME"]) { mode = bad; await assert.rejects(driver.assertReady(signal())); }
    mode = "FOREIGN"; await assert.rejects(driver.observe(payload(), signal())); mode = "NORMAL";
  });
  await t.test("redirects, compression, malformed JSON, excessive headers/bodies and truncated responses fail closed with no retry", async () => {
    for (const bad of ["REDIRECT", "COMPRESSED", "HTML", "BAD_JSON", "LENGTH", "STREAM_SIZE", "HEADERS", "TRUNCATED", "ERROR"]) {
      mode = bad; const before = received;
      await assert.rejects(driver.assertReady(signal()), /Private judge unavailable/); assert.equal(received, before + 1, bad);
    }
    mode = "NORMAL";
  });
  await t.test("caller abort and already-aborted signals stop promptly without hidden dispatch", async () => {
    const before = received;
    await assert.rejects(driver.assertReady(AbortSignal.abort())); assert.equal(received, before);
    mode = "STALL"; const begin = performance.now();
    await assert.rejects(driver.assertReady(AbortSignal.timeout(100)), /Private judge unavailable/);
    assert.ok(performance.now() - begin < 1500); mode = "NORMAL";
  });
  await t.test("a two-second TLS connection deadline also bounds a peer that accepts TCP but never handshakes", async () => {
    const held = new Set<Socket>(), silent = tcpServer(socket => { held.add(socket); socket.on("close", () => held.delete(socket)); });
    await new Promise<void>(resolve => silent.listen(0, "127.0.0.1", resolve));
    try {
      const target = silent.address(); assert.ok(target && typeof target !== "string");
      const begin = performance.now(); await assert.rejects(createAuthoringJudgeDriver({ ...settings, port: target.port }).assertReady(signal()));
      assert.ok(performance.now() - begin >= 1800); assert.ok(performance.now() - begin < 4500);
    } finally { for (const socket of held) socket.destroy(); await new Promise<void>(resolve => silent.close(() => resolve())); }
  });
  await t.test("the ten-second whole-request deadline stops a trickling response instead of resetting on every byte", async () => {
    mode = "STALL"; const begin = performance.now();
    await assert.rejects(driver.assertReady(AbortSignal.timeout(20000)), /Private judge unavailable/);
    assert.ok(performance.now() - begin >= 9500); assert.ok(performance.now() - begin < 13500); mode = "NORMAL";
  });
  await t.test("only fixed private IPv4/loopback endpoints and valid pinned TLS material are accepted", () => {
    for (const changed of [{ address: "8.8.8.8" }, { address: "169.254.169.254" }, { address: "metadata.google.internal" }, { address: "::1" },
      { address: "127.1" }, { endpointRef: "https://user:secret@host" }, { port: 0 }, { serverName: "127.0.0.1" }, { certificate: Buffer.alloc(0) }, { privateKey: Buffer.from("invalid") }]) {
      assert.throws(() => createAuthoringJudgeDriver({ ...settings, ...changed }));
    }
  });
  await t.test("configured runtime maps and TLS material are defensively copied", async () => {
    const copy = { ...settings, certificate: Buffer.from(clientCert), runtimes: judgeRuntimes() }, isolated = createAuthoringJudgeDriver(copy);
    copy.certificate.fill(0); copy.runtimes.get("cpp")!.digest = "f".repeat(64);
    const exposed = isolated.runtimes.get("cpp")!; exposed.digest = "f".repeat(64);
    await isolated.assertReady(signal()); assert.equal(handlerError, undefined);
  });
});
