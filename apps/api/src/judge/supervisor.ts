import type { Pool } from "pg";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { uuid } from "../access/credentials.js";
import type { RegistrySettings, createJudgePublisherStore, createJudgeSupervisorStore } from "./registry.js";
import { createJudgeExecutionWorker } from "./execution-worker.js";
import { assertJudgeDatabaseRole } from "./database-role.js";
import type { TrustedProtectedExecutor } from "./executor.js";
import { publishJudgeTurn } from "./queue.js";
import type { createJudgeQueue } from "./queue.js";

export async function openSupervisorSession(pool: Pool, settings: Pick<RegistrySettings, "hostEpochId" | "bootId">) {
  const args = [uuid(settings.hostEpochId), uuid(settings.bootId)], client = await pool.connect();
  const lost = new AbortController();
  let locked = false, closed = false;
  const failed = () => lost.abort();
  client.on("error", failed);
  try {
    await assertJudgeDatabaseRole(client, "supervisor");
    locked = (await client.query("SELECT ingenium_judge.service_lock($1,$2) AS locked", args)).rows[0]?.locked === true;
    if (!locked) throw new Error("Another supervisor owns this host.");
    // Withdraw any old lease before this process has verified the protected launcher.
    await client.query("SELECT ingenium_judge.service_withdraw($1,$2)", args);
    return {
      hostEpochId: args[0]!, bootId: args[1]!,
      signal: lost.signal,
      async heartbeat(proof: Buffer, signal: AbortSignal) {
        signal.throwIfAborted(); lost.signal.throwIfAborted();
        if (closed || !Buffer.isBuffer(proof) || proof.length !== 32) throw new Error("Verified readiness proof required.");
        await client.query("SELECT ingenium_judge.service_heartbeat($1,$2,$3)", [...args, Buffer.from(proof)]);
        signal.throwIfAborted(); lost.signal.throwIfAborted();
      },
      async close() {
        if (closed) return;
        closed = true;
        try {
          // Never reconnect to withdraw: a lost session cannot clear its replacement's readiness.
          if (!lost.signal.aborted) await client.query("SELECT ingenium_judge.service_withdraw($1,$2)", args);
          else throw new Error("Supervisor session lost; the old lease must expire.");
        } finally { client.removeListener("error", failed); client.release(true); }
      },
    };
  } catch (error) {
    client.removeListener("error", failed); client.release(true); throw error;
  }
}

type Queue = ReturnType<typeof createJudgeQueue>;
type Session = Awaited<ReturnType<typeof openSupervisorSession>>;
export async function startJudgeSupervisor(settings: {
  store: ReturnType<typeof createJudgeSupervisorStore>;
  publisher: ReturnType<typeof createJudgePublisherStore>;
  session: Session;
  queues: readonly Queue[];
  executors: readonly TrustedProtectedExecutor[];
  readiness: { hostEpochId: string; bootId: string; readiness(signal: AbortSignal): Promise<Buffer> };
  signal: AbortSignal;
}) {
  const { store, publisher, session, queues, readiness } = settings;
  const all = [publisher, readiness, session, ...queues, ...settings.executors];
  if (all.some(value => value.hostEpochId !== store.hostEpochId || value.bootId !== store.bootId)
    || ![2,8].includes(settings.executors.length) || queues.length !== settings.executors.length+1
    || new Set(queues).size !== queues.length || new Set(settings.executors).size !== settings.executors.length
    || new Set<object>([...settings.executors,readiness]).size !== settings.executors.length+1) throw new Error("Independent, matching supervisor resources required.");
  let preflight=Promise.resolve();
  const workers = settings.executors.map((executor, i) => createJudgeExecutionWorker(store, queues[i + 1]!, {
    ...executor,
    assertReady(signal){
      // Serialise expensive pre-claim observations; actual executions still have eight independent slots.
      const turn=preflight.then(async()=>{signal.throwIfAborted();await executor.assertReady(signal);});
      preflight=turn.catch(()=>{});return turn;
    },
  }));
  const stop = new AbortController(), signal = AbortSignal.any([stop.signal, session.signal, settings.signal]);
  const observations = new Map<string, number>();
  let readyUntil = -Infinity, failure = false, failureStage: string | null = null, failureCause:unknown;
  async function verify() {
    signal.throwIfAborted();
    const started = performance.now(), bounded = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
    const proof = await readiness.readiness(bounded);
    bounded.throwIfAborted();
    if (performance.now() - started >= 5000) throw new Error("Readiness observation expired.");
    await session.heartbeat(proof, bounded);
    bounded.throwIfAborted(); readyUntil = performance.now() + 10000;
  }
  try { await verify(); }
  catch (error) {
    stop.abort();
    try { await session.close(); } finally { for (const queue of queues) queue.close(); }
    throw error;
  }
  const loop = async (work: () => Promise<void>, interval: number, stage: string) => {
    try {
      while (!signal.aborted) { await work(); await delay(interval, undefined, { signal }); }
    } catch (error) {
      if (!signal.aborted) { failure = true; failureStage = stage; failureCause=error; stop.abort(error); }
    }
  };
  const tasks = [
    loop(async () => { await delay(5000, undefined, { signal }); await verify(); }, 0, "readiness"),
    loop(async () => {
      if (performance.now() >= readyUntil) return;
      await publishJudgeTurn(publisher, queues[0]!, signal);
    }, 250, "publisher"),
    ...workers.map((worker, index) => loop(async () => {
      if (performance.now() >= readyUntil) return;
      const held = await store.held(), now = performance.now();
      signal.throwIfAborted();
      for (const attempt of observations.keys()) if (!held.includes(attempt)) observations.delete(attempt);
      const attempt = held.find(id => !workers.some(value => value.activeAttempt === id) && now - (observations.get(id) ?? -Infinity) >= 5000);
      if (attempt) {
        observations.set(attempt, now);
        await worker.recover(attempt, signal);
      } else if ((await queues[index + 1]!.entries(signal)).length) await worker.run(signal);
    }, 250, `worker-${index + 1}`)),
  ];
  const completion = (async () => {
    await new Promise<void>(resolve => {
      if (signal.aborted) resolve(); else signal.addEventListener("abort", () => resolve(), { once: true });
    });
    // Stop admission promptly; an interrupted launcher never implies a drained capsule.
    try { await session.close(); } catch { failure = true; failureStage ??= "session"; }
    await Promise.all(tasks);
    for (const queue of queues) queue.close();
    return { failed: failure || session.signal.aborted };
  })();
  return {
    completion,
    get failureStage() { return failureStage ?? (session.signal.aborted ? "session" : null); },
    get failureCause() { return failureCause; },
    async close() { stop.abort(); return completion; },
  };
}
