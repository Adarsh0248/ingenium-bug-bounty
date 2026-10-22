import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import { createSecureContext, TLSSocket } from "node:tls";
import { sha256, uuid } from "../access/credentials.js";
import { privateJudgeAddress } from "../content/judge-driver.js";
import { judgeJson, JUDGE_BODY_LIMIT, JUDGE_PROTOCOL, readAuthoringRequest, readJudgeJson, runtimeRecord } from "../content/judge-protocol.js";
import type { createJudgeRegistry } from "./registry.js";

interface GatewaySettings {
  registry: ReturnType<typeof createJudgeRegistry>; serverName: string; workerAddress: string; workerCertificateSha256: string;
  ca: Buffer; certificate: Buffer; privateKey: Buffer;
}
class RequestError extends Error { constructor(readonly status: number) { super("Invalid private judge request."); } }
function header(request: FastifyRequest, key: string): string {
  const value = request.headers[key]; let count = 0;
  for (let i = 0; i < request.raw.rawHeaders.length; i += 2) if (request.raw.rawHeaders[i]!.toLowerCase() === key) count++;
  if (count !== 1 || typeof value !== "string") throw new RequestError(400);
  return value;
}
export function buildJudgeGateway(settings: GatewaySettings) {
  const { registry } = settings, epoch = registry.hostEpochId, runtimes = registry.runtimes;
  if (!privateJudgeAddress(settings.workerAddress) || !/^[0-9a-f]{64}$/.test(settings.workerCertificateSha256)
    || settings.serverName.length > 253 || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(settings.serverName)) throw new Error("Invalid gateway identity.");
  const serverName = settings.serverName, workerAddress = settings.workerAddress, workerFingerprint = settings.workerCertificateSha256;
  for (const value of [settings.ca, settings.certificate, settings.privateKey]) if (!Buffer.isBuffer(value) || value.length < 1 || value.length > 32768) throw new Error("Invalid gateway TLS material.");
  const tls = { ca: Buffer.from(settings.ca), cert: Buffer.from(settings.certificate), key: Buffer.from(settings.privateKey), minVersion: "TLSv1.3" as const };
  createSecureContext(tls);
  const app = Fastify({ logger: false, trustProxy: false, bodyLimit: JUDGE_BODY_LIMIT, requestTimeout: 10000, connectionTimeout: 5000,
    maxRequestsPerSocket: 1, https: { ...tls, requestCert: true, rejectUnauthorized: true, maxHeaderSize: 16384 } });
  const active = new Map<FastifyRequest, { working: boolean; closed: boolean; timer: ReturnType<typeof setTimeout> }>();
  const bodies = new Set<FastifyRequest>();
  function release(request: FastifyRequest) {
    const state = active.get(request); if (!state || state.working || !state.closed) return;
    clearTimeout(state.timer); active.delete(request); bodies.delete(request);
  }
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store").header("Connection", "close");
    const socket = request.raw.socket;
    if (!(socket instanceof TLSSocket) || !socket.authorized || socket.remoteAddress !== workerAddress || !socket.getPeerCertificate().raw
      || sha256(socket.getPeerCertificate().raw).toString("hex") !== workerFingerprint) throw new RequestError(403);
    if (header(request, "host") !== serverName || header(request, "x-ingenium-host-epoch") !== epoch) throw new RequestError(403);
    try { uuid(header(request, "x-ingenium-request-id")); } catch { throw new RequestError(400); }
    if (request.headers["content-encoding"] !== undefined || request.headers.origin !== undefined || request.url.includes("?")) throw new RequestError(400);
    if (active.size >= 16 || request.method === "POST" && bodies.size >= 2) throw new RequestError(503);
    const state = { working: false, closed: false, timer: setTimeout(() => request.raw.destroy(), 10000) };
    active.set(request, state); if (request.method === "POST") bodies.add(request);
    reply.raw.once("close", () => { state.closed = true; release(request); });
    request.raw.once("aborted", () => { state.closed = true; release(request); });
  });
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: JUDGE_BODY_LIMIT }, (_request, body, done) => {
    try { done(null, readJudgeJson(body as Buffer)); } catch { done(new RequestError(400)); }
  });
  app.setErrorHandler((error, _request, reply) => {
    const code = (error as { code?: string }).code;
    const status = error instanceof RequestError ? error.status : code === "22023" ? 409 : ["FST_ERR_CTP_BODY_TOO_LARGE"].includes(code ?? "") ? 413 : 503;
    reply.code(status).type("application/json").send(judgeJson({ error: status === 409 ? "attempt_conflict" : status < 500 ? "invalid_request" : "judge_unavailable" }));
  });
  async function handle<T>(request: FastifyRequest, work: () => Promise<T>): Promise<T> {
    const state = active.get(request); if (!state) throw new RequestError(503); state.working = true;
    try { return await work(); } finally { state.working = false; release(request); }
  }
  const prefix = "/ingenium/v1/authoring";
  app.get(`${prefix}/ready`, async (request, reply) => handle(request, async () => {
    if (request.headers["content-length"] !== undefined || request.headers["transfer-encoding"] !== undefined) throw new RequestError(400);
    return reply.type("application/json").send(judgeJson({ protocol: JUDGE_PROTOCOL, request_id: header(request, "x-ingenium-request-id"), host_epoch_id: epoch,
      ready: await registry.ready(), runtimes: runtimeRecord(runtimes) }));
  }));
  app.route<{ Params: { attempt: string } }>({ method: ["GET", "POST"], url: `${prefix}/attempts/:attempt`, handler: async (request, reply) => handle(request, async () => {
    const nonce = header(request, "x-ingenium-request-id"), digest = header(request, "x-ingenium-payload-digest");
    let attempt: string;
    try { attempt = uuid(request.params.attempt); if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(); } catch { throw new RequestError(400); }
    let result;
    if (request.method === "POST") {
      let payload;
      try { payload = readAuthoringRequest(request.body, nonce, epoch, attempt, digest, runtimes); } catch { throw new RequestError(400); }
      result = await registry.admit(payload, nonce);
    } else {
      if (request.headers["content-length"] !== undefined || request.headers["transfer-encoding"] !== undefined) throw new RequestError(400);
      result = await registry.observe(attempt, digest, nonce);
    }
    return reply.code(result.status).type("application/json").send(judgeJson(result.value));
  }) });
  app.addHook("onClose", async () => { for (const state of active.values()) clearTimeout(state.timer); active.clear(); bodies.clear(); });
  return app;
}
