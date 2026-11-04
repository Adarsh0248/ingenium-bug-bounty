import { randomUUID } from "node:crypto";
import { request } from "node:https";
import { isIPv4 } from "node:net";
import { checkServerIdentity, createSecureContext } from "node:tls";
import type { TLSSocket } from "node:tls";
import { sha256, uuid } from "../access/credentials.js";
import type { AuthoringPayload, TrustedAuthoringDriver } from "./execution-policy.js";
import { acceptJudgeReady, acceptJudgeReply, authoringRequest, JUDGE_BODY_LIMIT, judgeJson, readJudgeJson, runtimeRecord } from "./judge-protocol.js";
import type { JudgeRuntimes } from "./judge-protocol.js";
import {readParticipantBatch,PARTICIPANT_BATCH_PROTOCOL} from './batch-protocol.js';
import {acceptParticipantBatchResult} from './batch-result.js';
export interface TrustedParticipantBatchDriver extends TrustedAuthoringDriver{
  assertBatchReady(signal:AbortSignal):Promise<void>;
  submitBatch(raw:Buffer,batchId:string,digest:string,signal:AbortSignal):Promise<ReturnType<typeof acceptParticipantBatchResult>|null>;
  observeBatch(raw:Buffer,batchId:string,digest:string,signal:AbortSignal):Promise<ReturnType<typeof acceptParticipantBatchResult>|null>;
}

export interface JudgeDriverSettings {
  hostEpochId: string; endpointRef: string; address: string; port: number; serverName: string;
  serverCertificateSha256: string; ca: Buffer; certificate: Buffer; privateKey: Buffer; runtimes: JudgeRuntimes;
}
const unavailable = () => new Error("Private judge unavailable; reconcile the original attempt.");
export function privateJudgeAddress(address: string): boolean {
  if (!isIPv4(address)) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 172 && b! >= 16 && b! <= 31 || a === 192 && b === 168 || address === "127.0.0.1";
}
export function createAuthoringJudgeDriver(settings: JudgeDriverSettings): TrustedParticipantBatchDriver {
  uuid(settings.hostEpochId);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(settings.endpointRef) || !privateJudgeAddress(settings.address) || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535
    || !/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(settings.serverName) || isIPv4(settings.serverName) || !/^[0-9a-f]{64}$/.test(settings.serverCertificateSha256)) throw unavailable();
  for (const bytes of [settings.ca, settings.certificate, settings.privateKey]) if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 32768) throw unavailable();
  const frozen = { ...settings, ca: Buffer.from(settings.ca), certificate: Buffer.from(settings.certificate), privateKey: Buffer.from(settings.privateKey) };
  const runtimes = new Map([...settings.runtimes].map(([k, v]) => [k, { ...v }]));
  runtimeRecord(runtimes);
  createSecureContext({ ca: frozen.ca, cert: frozen.certificate, key: frozen.privateKey, minVersion: "TLSv1.3" });
  const root = "/ingenium/v1/authoring";
  async function exchange(method: "POST" | "GET", path: string, nonce: string, signal: AbortSignal, data?: unknown, payloadDigest?: string) {
    const body = data === undefined ? undefined : Buffer.from(judgeJson(data));
    if (body && body.length > JUDGE_BODY_LIMIT || signal.aborted) throw unavailable();
    return new Promise<{ status: number; value: unknown }>((resolve, reject) => {
      let finished = false;
      const done = (error?: Error, value?: { status: number; value: unknown }) => {
        if (finished) return; finished = true; clearTimeout(connect); clearTimeout(total);
        if (error) { req.destroy(); reject(unavailable()); } else resolve(value!);
      };
      const req = request({ hostname: frozen.address, port: frozen.port, servername: frozen.serverName, method, path, agent: false, signal,
        ca: frozen.ca, cert: frozen.certificate, key: frozen.privateKey, rejectUnauthorized: true, minVersion: "TLSv1.3", maxHeaderSize: 16384,
        checkServerIdentity: (_host, certificate) => checkServerIdentity(frozen.serverName, certificate)
          ?? (certificate.raw && sha256(certificate.raw).toString("hex") === frozen.serverCertificateSha256 ? undefined : unavailable()),
        headers: { Host: frozen.serverName, Accept: "application/json", "Accept-Encoding": "identity", "Cache-Control": "no-store", Connection: "close",
          "X-Ingenium-Request-Id": nonce, "X-Ingenium-Host-Epoch": frozen.hostEpochId,
          ...(payloadDigest ? { "X-Ingenium-Payload-Digest": payloadDigest } : {}),
          ...(body ? { "Content-Type": "application/json", "Content-Length": body.length } : {}) },
      }, response => {
        const length = response.headers["content-length"], encoding = response.headers["content-encoding"];
        if (!/^(application\/json)(;\s*charset=utf-8)?$/i.test(response.headers["content-type"] ?? "") || encoding !== undefined && encoding !== "identity"
          || length !== undefined && (!/^(0|[1-9][0-9]*)$/.test(length) || BigInt(length) > BigInt(JUDGE_BODY_LIMIT))) { done(unavailable()); return; }
        const chunks: Buffer[] = []; let bytes = 0;
        response.on("data", (chunk: Buffer) => { if (finished) return; bytes += chunk.length; if (bytes > JUDGE_BODY_LIMIT) done(unavailable()); else chunks.push(chunk); });
        response.once("error", () => done(unavailable()));
        response.once("aborted", () => done(unavailable()));
        response.once("end", () => {
          if (finished) return;
          try {
            if (!response.complete || Object.keys(response.trailers).length || length !== undefined && BigInt(length) !== BigInt(bytes)) throw unavailable();
            done(undefined, { status: response.statusCode ?? 0, value: readJudgeJson(Buffer.concat(chunks, bytes)) });
          } catch { done(unavailable()); }
        });
      });
      const connect = setTimeout(() => done(unavailable()), 2000), total = setTimeout(() => done(unavailable()), 10000);
      req.once("socket", socket => (socket as TLSSocket).once("secureConnect", () => clearTimeout(connect)));
      req.once("error", () => done(unavailable()));
      req.end(body);
    });
  }
  async function operation(p: AuthoringPayload, signal: AbortSignal, submit: boolean) {
    p = { ...p, source: Buffer.from(p.source), stdin: Buffer.from(p.stdin) };
    if (p.hostEpochId !== frozen.hostEpochId) throw unavailable();
    const nonce = randomUUID(), data = authoringRequest(p, nonce, runtimes);
    const path = `${root}/attempts/${p.attemptId}`;
    const reply = await exchange(submit ? "POST" : "GET", path, nonce, signal, submit ? data : undefined, data.payload_digest);
    if (!submit && ![200, 404].includes(reply.status) || submit && ![200, 201, 202].includes(reply.status)) throw unavailable();
    return acceptJudgeReply(reply.value, p, nonce, reply.status);
  }
  const batches='/ingenium/v1/participant/batches';
  async function batchOperation(raw:Buffer,batchId:string,digest:string,signal:AbortSignal,submit:boolean){
    raw=Buffer.from(raw);readParticipantBatch(raw,{batchId,hostEpochId:frozen.hostEpochId,digest},runtimes);
    const nonce=randomUUID(),reply=await exchange(submit?'POST':'GET',`${batches}/${batchId}`,nonce,signal,submit?readJudgeJson(raw):undefined,digest);
    if(submit?![200,201].includes(reply.status):![200,404].includes(reply.status))throw unavailable();
    const row=reply.value as Record<string,unknown>;
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join(',')!==['protocol','request_id','host_epoch_id','batch_id','batch_digest','state','evidence'].sort().join(',')
      ||row.protocol!==PARTICIPANT_BATCH_PROTOCOL||row.request_id!==nonce||row.host_epoch_id!==frozen.hostEpochId||row.batch_id!==batchId||row.batch_digest!==digest)throw unavailable();
    if(row.state==='ABSENT'&&reply.status===404&&row.evidence===null||row.state==='PENDING'&&reply.status!==404&&row.evidence===null)return null;
    if(row.state!=='FINISHED'||reply.status===404)throw unavailable();
    return acceptParticipantBatchResult(raw,{batchId,hostEpochId:frozen.hostEpochId,digest},runtimes,row.evidence);
  }
  return {
    hostEpochId: frozen.hostEpochId, endpointRef: frozen.endpointRef,
    get runtimes() { return new Map([...runtimes].map(([k, v]) => [k, { ...v }])); },
    async assertReady(signal) {
      const nonce = randomUUID(), reply = await exchange("GET", `${root}/ready`, nonce, signal);
      if (reply.status !== 200) throw unavailable();
      acceptJudgeReady(reply.value, nonce, frozen.hostEpochId, runtimes);
    },
    submit: (p, signal) => operation(p, signal, true),
    observe: (p, signal) => operation(p, signal, false),
    async assertBatchReady(signal){
      const nonce=randomUUID(),reply=await exchange('GET',`${batches}/ready`,nonce,signal),row=reply.value as Record<string,unknown>;
      if(reply.status!==200||!row||row.protocol!==PARTICIPANT_BATCH_PROTOCOL)throw unavailable();
      acceptJudgeReady({...row,protocol:'ingenium-authoring-v1'},nonce,frozen.hostEpochId,runtimes);
    },
    submitBatch:(raw,id,digest,signal)=>batchOperation(raw,id,digest,signal,true),
    observeBatch:(raw,id,digest,signal)=>batchOperation(raw,id,digest,signal,false),
  };
}
