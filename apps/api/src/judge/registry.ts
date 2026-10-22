import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { uuid } from "../access/credentials.js";
import type { AuthoringPayload } from "../content/execution-policy.js";
import { acceptJudgeReply, authoringRequest, judgeJson, JUDGE_PROTOCOL, readAuthoringRequest, runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";

export interface RegistrySettings { hostEpochId: string; bootId: string; runtimes: JudgeRuntimes; }
export interface JudgeDelivery { attempt_id: string; provider_token: string; }
function configuration(settings: RegistrySettings) {
  uuid(settings.hostEpochId); uuid(settings.bootId);
  const runtimes = new Map([...settings.runtimes].map(([k, v]) => [k, { ...v }])); runtimeRecord(runtimes);
  return { ...settings, runtimes };
}
async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN"); await client.query("SET LOCAL lock_timeout='1s'"); await client.query("SET LOCAL statement_timeout='5s'");
    const value = await work(client); await client.query("COMMIT"); return value;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
export function createJudgeRegistry(pool: Pool, settings: RegistrySettings) {
  const config = configuration(settings), args = [config.hostEpochId, config.bootId];
  async function lookup(client: PoolClient, attempt: string, digest: string, nonce: string) {
    uuid(attempt); uuid(nonce); if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error("Invalid payload identity.");
    const saved = (await client.query("SELECT ingenium_judge.observe($1,$2,$3,$4) AS value", [...args, attempt, Buffer.from(digest, "hex")])).rows[0].value;
    const common = { protocol: JUDGE_PROTOCOL, request_id: nonce, host_epoch_id: config.hostEpochId, attempt_id: attempt, payload_digest: digest };
    if (!saved) return { status: 404, value: { ...common, state: "ABSENT", provider_token: null, execution_generation: null, evidence: null } };
    const p = readAuthoringRequest({ ...saved.envelope, request_id: nonce }, nonce, config.hostEpochId, attempt, digest, config.runtimes);
    const value = { ...common, state: saved.evidence ? "FINISHED" : "PENDING", provider_token: saved.provider_token, execution_generation: "1",
      evidence: saved.evidence ? { ...saved.evidence, metadata: { ...saved.evidence.metadata, drain: saved.drain } } : null };
    acceptJudgeReply(value, p, nonce, 200);
    return { status: 200, value };
  }
  return {
    hostEpochId: config.hostEpochId,
    get runtimes() { return new Map([...config.runtimes].map(([k, v]) => [k, { ...v }])); },
    async ready() {
      return transaction(pool, async client => {
        const row = (await client.query("SELECT ingenium_judge.readiness($1,$2) AS value", args)).rows[0].value;
        return row?.ready === true && judgeJson(row.runtimes) === judgeJson(runtimeRecord(config.runtimes));
      });
    },
    async admit(p: AuthoringPayload, nonce: string) {
      const encoded = authoringRequest(p, nonce, config.runtimes), { request_id: _nonce, ...envelope } = encoded;
      return transaction(pool, async client => {
        await client.query("SELECT ingenium_judge.admit($1,$2,$3::jsonb)", [...args, JSON.stringify(envelope)]);
        const observed = await lookup(client, encoded.attempt_id, encoded.payload_digest, nonce);
        if (observed.status !== 200) throw new Error("Registration was not reconciled.");
        return { ...observed, status: 201 };
      });
    },
    observe: (attempt: string, digest: string, nonce: string) => transaction(pool, client => lookup(client, attempt, digest, nonce)),
  };
}
export function createJudgeSupervisorStore(pool: Pool, settings: RegistrySettings) {
  const config = configuration(settings), args = [config.hostEpochId, config.bootId];
  return {
    ...deliveryStore(pool, config),
    get runtimes() { return new Map([...config.runtimes].map(([key, value]) => [key, { ...value }])); },
    async heartbeat(proof: Buffer) {
      if (proof.length !== 32) throw new Error("Invalid readiness evidence.");
      await transaction(pool, client => client.query("SELECT ingenium_judge.heartbeat($1,$2,$3)", [...args, proof]));
    },
    async deliveries(): Promise<{ attempt_id: string; provider_token: string }[]> {
      return transaction(pool, async client => (await client.query("SELECT ingenium_judge.deliveries($1,$2) AS value", args)).rows[0].value);
    },
    async claim(attempt: string, token: string, owner: string) {
      for (const id of [attempt, token, owner]) uuid(id);
      return transaction(pool, async client => {
        const row = (await client.query("SELECT ingenium_judge.claim($1,$2,$3,$4,$5) AS value", [...args, attempt, token, owner])).rows[0].value;
        if (!row) return null;
        const nonce = randomUUID();
        return readAuthoringRequest({ ...row, request_id: nonce }, nonce, config.hostEpochId, attempt, row.payload_digest, config.runtimes);
      });
    },
    async execution(attempt: string) {
      uuid(attempt);
      return transaction(pool, async client => {
        const row = (await client.query("SELECT ingenium_judge.execution($1,$2,$3) AS value", [...args, attempt])).rows[0].value;
        if (!row) return null;
        const nonce = randomUUID(), payload = readAuthoringRequest({ ...row.envelope, request_id: nonce }, nonce, config.hostEpochId, attempt, row.envelope.payload_digest, config.runtimes);
        uuid(row.permit_owner); uuid(row.provider_token);
        if (typeof row.launch_started !== "boolean") throw new Error("Launch-gate migration is required.");
        const evidence = row.evidence ? { ...row.evidence, metadata: { ...row.evidence.metadata, drain: row.drain } } : null;
        if (evidence) acceptJudgeReply({ protocol: JUDGE_PROTOCOL, request_id: nonce, host_epoch_id: config.hostEpochId, attempt_id: attempt,
          payload_digest: row.envelope.payload_digest, state: "FINISHED", provider_token: row.provider_token, execution_generation: "1", evidence }, payload, nonce, 200);
        return { payload, owner: row.permit_owner as string, providerToken: row.provider_token as string, started: row.launch_started as boolean, evidence };
      });
    },
    async beginLaunch(attempt: string, token: string, owner: string) {
      for (const id of [attempt, token, owner]) uuid(id);
      return transaction(pool, async client => {
        const row = (await client.query("SELECT ingenium_judge.begin_launch($1,$2,$3,$4,$5) AS value", [...args, attempt, token, owner])).rows[0].value;
        if (!row) return null;
        const nonce = randomUUID();
        return readAuthoringRequest({ ...row, request_id: nonce }, nonce, config.hostEpochId, attempt, row.payload_digest, config.runtimes);
      });
    },
    async seal(p: AuthoringPayload, token: string, owner: string, evidence: unknown) {
      uuid(token); uuid(owner); const nonce = randomUUID();
      const binding = authoringRequest(p, nonce, config.runtimes);
      acceptJudgeReply({ protocol: JUDGE_PROTOCOL, request_id: nonce, host_epoch_id: config.hostEpochId, attempt_id: p.attemptId, payload_digest: binding.payload_digest,
        state: "FINISHED", provider_token: token, execution_generation: "1", evidence }, p, nonce, 200);
      const value = evidence as { metadata: { drain: unknown }; stdout_b64: string; stderr_b64: string; compiler_output_b64: string };
      const { drain, ...metadata } = value.metadata;
      const sealed = JSON.stringify({ ...value, metadata }), proof = drain === null ? null : JSON.stringify(drain);
      await transaction(pool, client => client.query("SELECT ingenium_judge.seal($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)",
        [...args, binding.attempt_id, token, owner, sealed, proof]));
    },
  };
}

function deliveryStore(pool: Pool, settings: RegistrySettings) {
  const args = [settings.hostEpochId, settings.bootId];
  return {
    hostEpochId: settings.hostEpochId, bootId: settings.bootId,
    async published(attempt: string) {
      uuid(attempt); await transaction(pool, client => client.query("SELECT ingenium_judge.published($1,$2,$3)", [...args, attempt]));
    },
    async deliveryState(delivery: JudgeDelivery): Promise<"PREPARED" | "CONSUMED"> {
      const attempt = uuid(delivery.attempt_id), token = uuid(delivery.provider_token);
      return transaction(pool, async client => {
        const value = (await client.query("SELECT ingenium_judge.delivery_state($1,$2,$3,$4) AS value", [...args, attempt, token])).rows[0].value;
        if (value !== "PREPARED" && value !== "CONSUMED") throw new Error("Invalid delivery state.");
        return value;
      });
    },
  };
}
export function createJudgePublisherStore(pool: Pool, settings: RegistrySettings) {
  const config = configuration(settings), args = [config.hostEpochId, config.bootId];
  return {
    ...deliveryStore(pool, config),
    async candidates(): Promise<JudgeDelivery[]> {
      return transaction(pool, async client => {
        const value = (await client.query("SELECT ingenium_judge.queue_candidates($1,$2) AS value", args)).rows[0].value;
        if (!Array.isArray(value) || value.length > 120) throw new Error("Invalid queue candidates.");
        for (const item of value) { uuid(item.attempt_id); uuid(item.provider_token); }
        return value;
      });
    },
  };
}
