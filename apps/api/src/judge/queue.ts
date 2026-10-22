import { createClient } from "@redis/client";
import { randomUUID } from "node:crypto";
import { uuid } from "../access/credentials.js";
import { privateJudgeAddress } from "../content/judge-driver.js";
import type { JudgeDelivery, createJudgePublisherStore, createJudgeSupervisorStore } from "./registry.js";

interface QueueSettings { hostEpochId: string; bootId: string; address: string; port: number; password: string; }
interface Message extends JudgeDelivery { id: string; }
const GROUP = "ingenium-guarded-v1", CONSUMER = "guarded-supervisor";

// All scripts inspect the bounded stream before returning fields or making a write.
const inspect = `
local kind=redis.call('TYPE',KEYS[1]).ok
if kind~='none' and kind~='stream' then return redis.error_reply('Invalid queue type') end
local rows={}
if kind=='stream' then
  if redis.call('XLEN',KEYS[1])>120 then return redis.error_reply('Queue bound exceeded') end
  rows=redis.call('XRANGE',KEYS[1],'-','+','COUNT',121)
end
local seen={}
local function valid(value)
  local compact=string.gsub(value,'-','')
  return #value==36 and #compact==32 and string.match(compact,'^[0-9a-f]+$')
    and string.sub(value,9,9)=='-' and string.sub(value,14,14)=='-' and string.sub(value,19,19)=='-' and string.sub(value,24,24)=='-'
    and string.sub(value,15,15)=='4' and string.match(string.sub(value,20,20),'^[89ab]$')
end
for _,row in ipairs(rows) do
  local f=row[2]
  if #f~=4 or f[1]~='attempt' or f[3]~='token' or not valid(f[2]) or not valid(f[4]) or seen[f[2]] then
    return redis.error_reply('Invalid queue identity')
  end
  seen[f[2]]=true
end
`;
const publish = `${inspect}
for _,row in ipairs(rows) do
  if row[2][2]==ARGV[1] then
    if row[2][4]~=ARGV[2] then return redis.error_reply('Conflicting queue identity') end
    return row[1]
  end
end
if #rows==120 then return false end
return redis.call('XADD',KEYS[1],'*','attempt',ARGV[1],'token',ARGV[2])
`;
const acknowledge = `${inspect}
for _,row in ipairs(rows) do
  if row[1]==ARGV[1] then
    if row[2][2]~=ARGV[2] or row[2][4]~=ARGV[3] then return redis.error_reply('Conflicting acknowledgement') end
    redis.call('XACK',KEYS[1],ARGV[4],ARGV[1])
    return redis.call('XDEL',KEYS[1],ARGV[1])
  end
end
return 0
`;

function message(row: unknown): Message {
  if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !/^\d{1,20}-\d{1,20}$/.test(row[0])) throw new Error("Invalid delivery.");
  const fields: unknown = row[1];
  if (!Array.isArray(fields) || fields.length !== 4 || fields[0] !== "attempt" || fields[2] !== "token") throw new Error("Invalid delivery.");
  const attempt = uuid(fields[1]), token = uuid(fields[3]);
  return { id: row[0], attempt_id: attempt, provider_token: token };
}

export function createJudgeQueue(settings: QueueSettings) {
  const epoch = uuid(settings.hostEpochId), boot = uuid(settings.bootId), address = settings.address;
  if (!privateJudgeAddress(address) || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535 || !/^[0-9a-f]{64}$/.test(settings.password)) throw new Error("Invalid private queue configuration.");
  const key = `ingenium:authoring:${epoch}:${boot}`, port = settings.port, password = settings.password;
  const client = createClient({ RESP: 2, socket: { host: address, port, connectTimeout: 2000, reconnectStrategy: false }, password,
    disableClientInfo: true, maintNotifications: "disabled", disableOfflineQueue: true, commandsQueueMaxLength: 1 });
  let busy = false, closed = false;
  client.on("error", () => { closed = true; });
  function close() { closed = true; if (client.isOpen) client.destroy(); }
  async function operation<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    if (busy || closed) throw new Error("Private queue is unavailable.");
    busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort = () => {};
    const stopped = new Promise<never>((_resolve, reject) => {
      abort = () => { close(); reject(new Error("Private queue operation interrupted; reconcile before retrying.")); };
      signal.addEventListener("abort", abort, { once: true }); timer = setTimeout(abort, 10000);
    });
    try {
      return await Promise.race([stopped, (async () => {
        if (!client.isReady) await client.connect();
        signal.throwIfAborted(); if (closed) throw new Error("Queue was closed."); return work();
      })()]);
    } catch { close(); throw new Error("Private queue operation failed; reconcile before retrying."); }
    finally { clearTimeout(timer); signal.removeEventListener("abort", abort); busy = false; }
  }
  const evaluate = (script: string, args: string[] = []) => client.sendCommand(["EVAL", script, "1", key, ...args]);
  async function prepare() {
    try { await client.sendCommand(["XGROUP", "CREATE", key, GROUP, "0", "MKSTREAM"]); }
    catch (error) { if (!(error instanceof Error) || !error.message.startsWith("BUSYGROUP ")) throw error; }
  }
  return {
    hostEpochId: epoch, bootId: boot,
    close,
    entries: (signal: AbortSignal): Promise<Message[]> => operation(signal, async () => {
      const rows = await evaluate(`${inspect} return rows`);
      if (!Array.isArray(rows) || rows.length > 120) throw new Error("Invalid stream.");
      return rows.map(message);
    }),
    publish: (delivery: JudgeDelivery, signal: AbortSignal): Promise<string | null> => {
      const attempt = uuid(delivery.attempt_id), token = uuid(delivery.provider_token);
      return operation(signal, async () => {
        const result = await evaluate(publish, [attempt, token]);
        if (result !== null && (typeof result !== "string" || !/^\d{1,20}-\d{1,20}$/.test(result))) throw new Error("Invalid stream reply.");
        return result;
      });
    },
    receive: (signal: AbortSignal): Promise<Message | null> => operation(signal, async () => {
      await evaluate(`${inspect} return 1`); await prepare();
      for (const position of ["0", ">"] as const) {
        const reply = await client.sendCommand(["XREADGROUP", "GROUP", GROUP, CONSUMER, "COUNT", "1", "STREAMS", key, position]);
        if (reply === null) continue;
        if (!Array.isArray(reply) || reply.length !== 1 || !Array.isArray(reply[0]) || reply[0][0] !== key || !Array.isArray(reply[0][1]) || reply[0][1].length > 1) throw new Error("Invalid stream delivery.");
        if (reply[0][1].length) return message(reply[0][1][0]);
      }
      return null;
    }),
    acknowledge: (entry: Message, signal: AbortSignal): Promise<void> => {
      const frozen = message([entry.id, ["attempt", entry.attempt_id, "token", entry.provider_token]]);
      return operation(signal, async () => { await prepare(); await evaluate(acknowledge, [frozen.id, frozen.attempt_id, frozen.provider_token, GROUP]); });
    },
  };
}
type Queue = ReturnType<typeof createJudgeQueue>;
type Publisher = ReturnType<typeof createJudgePublisherStore>;
type Supervisor = ReturnType<typeof createJudgeSupervisorStore>;
function binding(store: { hostEpochId: string; bootId: string }, queue: Queue) {
  if (store.hostEpochId !== queue.hostEpochId || store.bootId !== queue.bootId) throw new Error("Queue belongs to another host.");
}

export async function publishJudgeTurn(store: Publisher, queue: Queue, signal: AbortSignal) {
  binding(store, queue);
  let removed = 0, published = 0;
  for (const entry of await queue.entries(signal)) {
    signal.throwIfAborted();
    if (await store.deliveryState(entry) === "CONSUMED") { await queue.acknowledge(entry, signal); removed++; }
  }
  for (const candidate of await store.candidates()) {
    signal.throwIfAborted();
    if (await queue.publish(candidate, signal) === null) break;
    await store.published(candidate.attempt_id); published++;
  }
  return { removed, published };
}

// A consumed-but-unsealed permit is held, never turned into a replacement launch.
export async function claimJudgeDelivery(store: Supervisor, queue: Queue, signal: AbortSignal) {
  binding(store, queue); const entry = await queue.receive(signal);
  if (!entry) return { state: "EMPTY" } as const;
  if (await store.deliveryState(entry) === "CONSUMED") {
    await queue.acknowledge(entry, signal); return { state: "DUPLICATE" } as const;
  }
  signal.throwIfAborted(); const owner = randomUUID();
  const payload = await store.claim(entry.attempt_id, entry.provider_token, owner);
  signal.throwIfAborted();
  if (!payload) return { state: "HELD" } as const;
  // Keep the message until the next reconciliation; no extra network failure can hide this committed claim.
  return { state: "CLAIMED", payload, owner, providerToken: entry.provider_token } as const;
}
