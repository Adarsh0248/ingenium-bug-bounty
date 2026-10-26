import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { io } from "socket.io-client";
import { connectLive } from "../../src/live/client.js";

export interface LoadIdentity { csrf: string; cookies: [string, string][]; language: string; memberRound: string; teamRound: string; }
export interface LiveLoadInput { address: string; origin: string; round: string; bounty: string; sessions: LoadIdentity[]; }
export function liveLoadDriver() {
  const states = new Map<number, string>(), rounds = new Map<number, string>(), wire = new Map<number, string>(), headAt = new Map<number, number>();
  const stale = new Map<string, number>(), openedByPhase = new Map<string, number>(), failures = new Map<string, number>();
  const clients: ReturnType<typeof connectLive>[] = [], sockets = new Map<number, ReturnType<typeof io>>();
  const delivery = { PAUSE: new Map<number, number>(), RESUME: new Map<number, number>() };
  const claimEvents=new Map<number,number>(),claimViews=new Map<number,number>(),awards=new Map<number,number>();
  let phase = "CONNECT", opened = 0, attempts = 0, controlAt = 0, input: LiveLoadInput | undefined, stopped = false, fatal = false;
  const count = (values: Iterable<string>) => { const found: Record<string, number> = {}; for (const v of values) found[v] = (found[v] ?? 0) + 1; return found; };
  async function until(check: () => boolean, limit = 20000) {
    const end = performance.now() + limit;
    while (!check()) { assert.ok(!fatal && !stopped && performance.now() < end, "Local live-load synchronisation deadline"); await delay(100); }
    assert.equal(fatal, false, "A private scope or reconnect assertion failed");
  }
  async function request(session: LoadIdentity, path: string, body: unknown) {
    const jar = new Map(session.cookies);
    const response = await fetch(`${input!.address}${path}`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Origin: input!.origin, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "Content-Type": "application/json", "X-CSRF-Token": session.csrf }, body: JSON.stringify(body) });
    for (const line of response.headers.getSetCookie()) { const pair = line.split(";")[0]!, split = pair.indexOf("="); jar.set(pair.slice(0, split), pair.slice(split + 1)); }
    session.cookies = [...jar];
    const raw = await response.text(); assert.ok(Buffer.byteLength(raw) <= 1048576); const value = JSON.parse(raw);
    if (response.status !== 200) {
      const label = `${path.split("/").at(-1)}:${response.status}:${value.error?.code ?? "UNKNOWN"}`;
      failures.set(label, (failures.get(label) ?? 0) + 1);
      throw Object.assign(new Error("Synthetic live HTTP refusal"), { status: response.status, code: value.error?.code });
    }
    return value.data;
  }
  function transport(session: LoadIdentity, ticket: string) {
    return io(`${input!.address}/live`, { path: "/api/v1/live/socket", autoConnect: false, forceNew: true, reconnection: false,
      transports: ["websocket"], auth: { ticket }, extraHeaders: { Origin: input!.origin, Cookie: session.cookies.map(([k, v]) => `${k}=${v}`).join("; ") } });
  }
  return {
    async initialise(value: LiveLoadInput) {
      assert.equal(input, undefined); assert.ok([100,200].includes(value.sessions.length));
      const address = new URL(value.address); assert.equal(address.hostname, "127.0.0.1"); assert.equal(address.protocol, "http:");
      input = structuredClone(value); const tabs = input.sessions.flatMap(session => [session, session, session]), start = performance.now(); let next = 0;
      await Promise.all(Array.from({ length: 2 }, async () => {
        for (;;) {
          const i = next++; if (i >= tabs.length) return; const session = tabs[i]!;
          const client = connectLive("PARTICIPANT", null, { now: () => performance.now(), post: (path, body) => request(session, path, body),
            transport(ticket) {
              attempts++; if (attempts > input!.sessions.length*9) fatal = true; assert.ok(attempts <= input!.sessions.length*9, "Unbounded socket reconnect churn"); opened++; openedByPhase.set(phase, (openedByPhase.get(phase) ?? 0) + 1);
              const socket = transport(session, ticket); sockets.set(i, socket);
              for (const event of ["sync", "heads", "ready", "event", "disconnect", "connect_error", "resync_required", "stale"])
                socket.on(event, () => { wire.set(i, event); if (event === "heads") headAt.set(i, performance.now()); });
              socket.on("event",event=>{if(event.patch.type==="CLAIM"&&event.patch.bounty_id===input!.bounty&&!claimEvents.has(i))claimEvents.set(i,Date.now());});
              return socket;
            },
            install(snapshot: any) {
              try {
              assert.equal(snapshot.actor.language, session.language); assert.equal(snapshot.actor.round_id, input!.round);
              assert.equal(snapshot.actor.member_round_id, session.memberRound); assert.equal(snapshot.actor.team_round_id, session.teamRound);
              assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE-LOAD-DRAFT-|PRIVATE-RACE-SOURCE|source_code|reference_code|expected_output|proof_verifier/);
              rounds.set(i, snapshot.round.state);
              if(snapshot.bounties.some((b:any)=>b.bounty_id===input!.bounty&&b.claimed)&&!claimViews.has(i))claimViews.set(i,Date.now());
              const current = phase === "PAUSE" ? delivery.PAUSE : phase === "RESUME" ? delivery.RESUME : null;
              if (current && snapshot.round.state === (phase === "PAUSE" ? "PAUSED" : "RUNNING") && !current.has(i)) current.set(i, performance.now() - controlAt);
              } catch (error) { fatal = true; throw error; }
            }, invalidate() {}, award(_id,bountyId) {if(bountyId===input!.bounty)awards.set(i,(awards.get(i)??0)+1);}, presence() {},
            state(state) {
              if (state === "STALE" && states.get(i) !== "STALE") {
                const key = `${phase}:${states.get(i) ?? "NEW"}:${wire.get(i) ?? "NONE"}:${performance.now() - (headAt.get(i) ?? -Infinity) >= 10000 ? "OLD_HEAD" : "RECENT_HEAD"}`;
                stale.set(key, (stale.get(key) ?? 0) + 1);
              }
              states.set(i, state);
            },
          });
          clients.push(client); await until(() => states.get(i) === "READY"); if (i % 3 === 0) client.edit(input!.bounty);
        }
      }));
      await until(() => states.size === tabs.length && [...states.values()].every(v => v === "READY"));
      await delay(11000); await until(() => [...states.values()].every(v => v === "READY"));
      return { sockets: tabs.length, active_editors: input.sessions.length, observer_tabs: input.sessions.length*2, steady_observation_ms: 11000, elapsed_ms: Math.round(performance.now() - start) };
    },
    async fourth() {
      const session = input!.sessions[0]!, ticket = await request(session, "/api/v1/live/tickets", {}), socket = transport(session, ticket.ticket);
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Fourth-tab refusal deadline")), 10000);
          socket.once("connect_error", error => { clearTimeout(timer); try { assert.equal(error.message, "LIVE_AUTHORITY_REQUIRED"); resolve(); } catch (error) { reject(error); } });
          socket.once("connect", () => { clearTimeout(timer); reject(new Error("A fourth tab obtained a live connection")); }); socket.connect();
        });
        return true;
      } finally { socket.disconnect(); }
    },
    async reconnect() {
      phase = "RECONNECT"; const start = performance.now(), previous = attempts;
      for (const socket of sockets.values()) socket.io.engine.close();
      await until(() => attempts >= previous + input!.sessions.length*3 && [...states.values()].every(v => v === "READY"), 60000);
      return Math.round(performance.now() - start);
    },
    async phase(value: "PAUSE" | "RESUME") { assert.ok(["PAUSE", "RESUME"].includes(value)); phase = value; controlAt = performance.now(); return null; },
    async projection(value: "PAUSED" | "RUNNING") { assert.ok(["PAUSED", "RUNNING"].includes(value)); await until(() => [...rounds.values()].filter(v => v === value).length === input!.sessions.length*3); return null; },
    async finish() {
      phase = "STEADY"; await delay(11000); await until(() => [...states.values()].every(v => v === "READY"));
      assert.equal(delivery.PAUSE.size, input!.sessions.length*3); assert.equal(delivery.RESUME.size, input!.sessions.length*3);
      return { sockets: input!.sessions.length*3, active_editors: input!.sessions.length, observer_tabs: input!.sessions.length*2, fourth_tab_refused: true, opened_connections: opened, connection_attempts: attempts,
        opened_by_phase: Object.fromEntries(openedByPhase), stale_causes: Object.fromEntries(stale), pause: [...delivery.PAUSE.values()], resume: [...delivery.RESUME.values()] };
    },
    async state() { return { phase, assertion_failed: fatal, opened_connections: opened, connection_attempts: attempts, opened_by_phase: Object.fromEntries(openedByPhase),
      states: count(states.values()), rounds: count(rounds.values()), stale_causes: Object.fromEntries(stale), failures: Object.fromEntries(failures),claim_events:claimEvents.size }; },
    async claims(){await until(()=>claimEvents.size===input!.sessions.length*3&&claimViews.size===input!.sessions.length*3);return{events:[...claimEvents],projections:[...claimViews],awards:[...awards]};},
    async close() { stopped = true; for (const client of clients) client.close(); return null; },
  };
}
