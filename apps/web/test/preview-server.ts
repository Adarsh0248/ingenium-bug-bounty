import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { Server } from "socket.io";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { definitions, previewBugs } from "./preview-bugs";
import { roundOnePack, roundOneBugs } from "../../../content/round-1/load";
import type { RoundOneLanguage } from "../../../content/round-1/load";
import { createShopPreview } from "./shop-preview";
import {
  roundTwoPack,
  roundTwoBugs,
  roundTwoQuestion,
} from "../../../content/round-2/load";
const roundKind = Number(
  process.env.INGENIUM_PREVIEW_ROUND ??
    (process.argv.includes("--round2") ? 2 : 1),
);
if (![1, 2].includes(roundKind)) throw new Error("Invalid preview round");
const visualFixtures =
  roundKind === 1 && process.env.INGENIUM_PREVIEW_FIXTURES === "visual-tests";
const cookieName =
  roundKind === 2 ? "round2_preview_session" : "preview_session";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const round = id(roundKind === 2 ? 10001 : 1),
  member = id(2),
  team = id(3),
  teamRound = id(4),
  streams = ["ROUND", "TEAM", "MEMBER"].map((kind, i) => ({
    stream_id: id(10 + i),
    kind,
    schema_version: 1,
    head: "0",
    retained_from: "1",
  }));
const starter = {
  c: '#include <stdio.h>\nint main(void) {\n    int a, b;\n    scanf("%d%d", &a, &b);\n    printf("%d\\n", a - b);\n    return 0;\n}\n',
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a - b << '\\n';\n}\n",
  java: "class Main { public static void main(String[] args) { System.out.println(0); } }",
  python: "a, b = map(int, input().split())\nprint(a - b)\n",
  javascript:
    "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a - b);\n",
};
interface State {
  session: string;
  flow: boolean;
  active: boolean;
  revoked: boolean;
  language: keyof typeof starter;
  name: string;
  started: number;
  expires: number;
  heads: typeof streams;
  bugs: any[];
  drafts: Map<string, any>;
  outcomes: Map<string, any>;
  actions: Map<string, any>;
  feedback: Map<string, any>;
  hints: Map<string, any[]>;
  submissions: any[];
  reports: Map<string, any>;
  walletEntries: any[];
  wallet: number;
  points: number;
  paused: boolean;
  closed: boolean;
  dropNext: boolean;
  judgeDelay?: number;
  statement: string | null;
  shop?: ReturnType<typeof createShopPreview>;
  shopOffset: number;
  shopLifecycle?: string;
  penaltyMs: number;
}
const states = new Map<string, State>(),
  tickets = new Map<string, string>();
let io: Server;
function state(req: IncomingMessage, res: ServerResponse) {
  let sid = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!sid || !states.has(sid)) {
    sid = randomUUID();
    states.set(sid, {
      session: randomUUID(),
      flow: false,
      active: false,
      revoked: false,
      language: "cpp",
      name: "Asha",
      started: Date.now(),
      expires: Date.now() + 7200000,
      heads: structuredClone(streams),
      bugs: visualFixtures
        ? previewBugs()
        : roundKind === 2
          ? roundTwoBugs()
          : roundOneBugs(),
      drafts: new Map(),
      outcomes: new Map(),
      actions: new Map(),
      feedback: new Map(),
      hints: new Map(),
      submissions: [],
      reports: new Map(),
      walletEntries: [],
      wallet: roundKind === 2 ? 35000 : 1200,
      points: roundKind === 2 ? 0 : 1350,
      shopOffset: 0,
      penaltyMs: 0,
      paused: false,
      closed: false,
      dropNext: false,
      statement: visualFixtures
        ? "A telemetry service combines two signed integers. Its implementation returns the wrong total.\n\nRepair the program so it prints their sum, including values outside the 32-bit range.\n\nInput\nTwo signed integers a and b, separated by whitespace.\n\nOutput\nTheir sum followed by a newline.\n\nConstraints\n-10^12 <= a, b <= 10^12"
        : null,
    });
    res.setHeader(
      "set-cookie",
      `${cookieName}=${sid}; HttpOnly; SameSite=Strict; Path=/`,
    );
  }
  const s = states.get(sid)!;
  if (roundKind === 2 && !s.shop) {
    s.shop = createShopPreview({
      now: () => Date.now() + s.shopOffset,
      wallet: () => s.wallet,
      debit: (amount) => {
        s.wallet -= amount;
      },
      bugs: () => s.bugs,
      paused: () => s.paused,
      closed: () => s.closed,
      intel(bounty) {
        const q = roundTwoQuestion(bounty);
        if (!q) throw new Error("Unknown Round 2 question");
        const probe = q.paid_intel.probe;
        const section = q.paid_intel.scanner[s.language as RoundOneLanguage];
        return {
          probe: { input: probe.input_data, output: probe.expected_output },
          scanner: {
            ...section,
            text: "Inspect how the operations in this subsystem update and use its state.",
            source: q.variants[s.language as RoundOneLanguage].starter_code
              .split("\n")
              .slice(section.from_line - 1, section.to_line)
              .join("\n"),
          },
        };
      },
    });
    s.bugs
      .filter((_, i) => i % 3 === 0)
      .forEach((b) => s.shop!.setRivalWorking(b.bounty_id, true));
  }
  if (s.active && Date.now() >= s.expires) {
    s.active = false;
    s.flow = false;
  }
  return { sid, s };
}
function session(s: State) {
  return {
    session_id: s.session,
    member_id: member,
    member_round_id: id(5),
    team_id: team,
    round_id: round,
    language: s.language,
    member_name: s.name,
    team_name: "Segfault Society",
    round_state: s.closed ? "CLOSED" : s.paused ? "PAUSED" : "RUNNING",
    ...(roundKind === 2 ? { preview_round: 2 } : {}),
    expires_at: new Date(s.expires).toISOString(),
    absolute_expires_at: new Date(s.started + 28800000).toISOString(),
    warning_at: new Date(s.expires - 300000).toISOString(),
  };
}
const flow = () => ({
  flow_id: id(9),
  state: "OPEN",
  expires_at: new Date(Date.now() + 900000).toISOString(),
  team_name: "Segfault Society",
  members: [
    { id: member, name: "Asha" },
    { id: id(6), name: "Dev" },
  ],
  round_id: round,
});
function snapshot(s: State, sync: string) {
  const own = {
      team_round_id: teamRound,
      team_id: team,
      team_name: "Segfault Society",
      points: s.points,
      rank: 2,
      effective_time_ms: 3380000 + s.penaltyMs,
      penalty_ms: s.penaltyMs,
      difficulties: [80, 55],
      overdrive: s.shop?.view().overdrive ?? false,
    },
    first = {
      ...own,
      team_id: id(20),
      team_round_id: id(21),
      team_name: "Bit Shift",
      overdrive: false,
      points: 1700,
      rank: 1,
      effective_time_ms: 3090000,
    };
  return {
    sync_id: sync,
    schema_version: 1,
    server_time: new Date().toISOString(),
    actor: {
      session_id: s.session,
      round_id: round,
      member_round_id: id(5),
      team_round_id: teamRound,
      language: s.language,
      name: s.name,
      team_name: "Segfault Society",
      expires_at: new Date(s.expires).toISOString(),
    },
    streams: s.heads,
    round: {
      round_id: round,
      kind: roundKind,
      state: s.closed ? "CLOSED" : s.paused ? "PAUSED" : "RUNNING",
      duration_ms: "7200000",
      started_at: new Date(s.started).toISOString(),
      closes_at: new Date(s.started + 7200000).toISOString(),
      current: true,
      arena_status: "IN_PROGRESS",
    },
    arena: { current_instance_id: id(7), status: "IN_PROGRESS" },
    bounties: s.bugs.map((b) => ({
      ...b,
      claimed: b.claimed || !!s.shop?.unavailable(b.bounty_id),
    })),
    ...(s.shop ? { shop: s.shop.view() } : {}),
    pauses: s.paused
      ? [
          {
            scope: "GLOBAL",
            team_round_id: null,
            member_round_id: null,
            started_at: new Date().toISOString(),
          },
        ]
      : [],
    hud: { wallet: s.wallet, standing: own },
    standings: [first, own],
    judging: [...s.feedback.values()].map((f) => ({
      parent_id: f.id,
      bounty_id: f.bounty_id,
      lane: f.lane,
      member_round_id: id(5),
      status: f.status,
      result: f.result,
      created_at: f.created_at,
    })),
    drafts: [...s.drafts].map(([b, d]) => ({
      bounty_id: b,
      revision: d.revision,
      updated_at: new Date().toISOString(),
    })),
    final: s.closed,
    security: null,
  };
}
function emit(s: State, patch: any, stream = 0) {
  const h = s.heads[stream];
  h.head = String(BigInt(h.head) + 1n);
  for (const socket of io.of("/live").sockets.values())
    if (socket.data.sid && states.get(socket.data.sid) === s)
      socket.emit("event", {
        sync_id: socket.data.sync,
        stream_id: h.stream_id,
        sequence: h.head,
        event_id: randomUUID(),
        resource_revision: h.head,
        schema_version: 1,
        patch,
      });
}
async function body(req: IncomingMessage) {
  let size = 0,
    text = "";
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1048576) throw new Error("body");
    text += chunk.toString();
  }
  return text ? JSON.parse(text) : {};
}
async function handle(req: IncomingMessage, res: ServerResponse) {
  if (!req.url?.startsWith("/api/v1/")) return false;
  const { sid, s } = state(req, res),
    url = new URL(req.url, "http://127.0.0.1"),
    p = url.pathname,
    b = req.method === "POST" ? await body(req) : {};
  const send = (data: any, status = 200) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(
      JSON.stringify({ schema_version: 1, trace_id: randomUUID(), data }),
    );
    return true;
  };
  const deny = (code = "INVALID_SESSION", status = 401) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        schema_version: 1,
        trace_id: randomUUID(),
        error: { code, outcome: "NOT_PROCESSED" },
      }),
    );
    return true;
  };
  if (p === "/api/v1/_fixture") {
    if (roundKind === 2) {
      if (b.action === "shop-demo-coins")
        s.wallet = Math.min(100000, s.wallet + 10000);
      if (b.action === "shop-incoming-freeze") s.shop!.incomingFreeze();
      if (b.action === "shop-clear-freeze") s.shop!.clearIncomingFreeze();
      if (b.action === "shop-rival-claim") {
        const target = b.bounty ?? s.shop!.view().claim?.bounty_id;
        if (target) s.shop!.rivalClaim(target);
      }
      if (b.action === "shop-rival-working" && typeof b.bounty === "string")
        s.shop!.setRivalWorking(b.bounty, !!b.working);
      if (
        b.action === "shop-advance" &&
        Number.isSafeInteger(b.ms) &&
        b.ms >= 0 &&
        b.ms <= 1860000
      )
        s.shopOffset += b.ms;
    }
    if (b.action === "pause") s.paused = true;
    if (b.action === "resume") s.paused = false;
    if (b.action === "close") s.closed = true;
    if (b.action === "revoke") s.revoked = true;
    if (b.action === "expire") s.expires = Date.now() - 1;
    if (
      b.action === "age-round" &&
      Number.isSafeInteger(b.ms) &&
      b.ms >= 0 &&
      b.ms <= 28800000
    )
      s.started = Date.now() - b.ms;
    if (b.action === "drop") s.dropNext = true;
    if (b.action === "full-field")
      s.bugs = Array.from({ length: 50 }, (_, i) => ({
        bounty_id: id(1000 + i),
        category: ["ARRAYS", "GRAPHS", "SYSTEMS", "LOGIC"][i % 4],
        title: `${definitions[i % definitions.length].title} / ${i + 1}`,
        difficulty: 1 + ((i * 17) % 100),
        base_bounty: (1 + ((i * 17) % 100)) * 10,
        captured: false,
        claimed: false,
        hint_tier: 0,
      }));
    if (
      b.action === "region-field" &&
      ["ARRAYS", "SYSTEMS", "GRAPHS", "LOGIC"].includes(b.category)
    )
      s.bugs = Array.from({ length: 30 }, (_, i) => ({
        bounty_id: id(2000 + i),
        category: b.category,
        title: `Region test bug ${i + 1}`,
        difficulty: 10 + i * 3,
        base_bounty: (10 + i * 3) * 10,
        captured: false,
        claimed: false,
        hint_tier: 0,
      }));
    if (
      b.action === "judge-delay" &&
      Number.isInteger(b.ms) &&
      b.ms >= 0 &&
      b.ms <= 15000
    )
      s.judgeDelay = b.ms;
    if (b.action === "statement") s.statement = b.text;
    if (b.action === "remote-draft") {
      const old = s.drafts.get(b.bounty);
      s.drafts.set(b.bounty, {
        source: b.source,
        revision: String(BigInt(old?.revision ?? "0") + 1n),
      });
    }
    if (b.action === "claim") {
      const bug = s.bugs.find((x) => x.bounty_id === b.bounty);
      if (bug) {
        if (s.shop) s.shop.rivalClaim(b.bounty);
        else bug.claimed = true;
      }
    }
    emit(s, {
      type: "INVALIDATE",
      projection: b.action === "remote-draft" ? "draft" : "competition",
    });
    return send({ ok: true });
  }
  if (p === "/api/v1/bootstrap") {
    const audience = url.searchParams.get("audience");
    if (audience === "ANONYMOUS")
      return send({ audience, csrf_token: "synthetic-csrf-token" });
    if (audience === "PARTICIPANT" && s.active && !s.revoked)
      return send({
        audience,
        session: session(s),
        csrf_token: "synthetic-participant-csrf",
      });
    if (audience === "ENTRY" && s.flow)
      return send({
        audience,
        flow: { ...flow(), state: s.active ? "ACTIVATED" : "OPEN" },
        csrf_token: "synthetic-entry-csrf",
      });
    return deny();
  }
  if (p === "/api/v1/entry/verify") {
    if (b.code?.replaceAll(" ", "") !== "A".repeat(32))
      return deny("INVALID_CODE", 401);
    s.flow = true;
    return send({
      audience: "TEAM",
      flow: flow(),
      csrf_token: "synthetic-entry-csrf",
    });
  }
  if (p === "/api/v1/entry/activate") {
    if (
      !(
        (roundKind === 2 ? roundTwoPack : roundOnePack)
          .languages as readonly string[]
      ).includes(b.language)
    )
      return deny("INVALID_CONTEXT", 400);
    s.active = true;
    s.started = Date.now();
    s.expires = s.started + 7200000;
    s.language = b.language;
    s.name = b.member_id === member ? "Asha" : "Dev";
    return send({
      status: "ACTIVATED",
      session: session(s),
      csrf_token: "synthetic-participant-csrf",
    });
  }
  if (p === "/api/v1/entry/recover" && s.active)
    return send({
      status: "ACTIVATED",
      session: session(s),
      csrf_token: "synthetic-participant-csrf",
    });
  if (!s.active || s.revoked) return deny();
  const shopPath = `/api/v1/competition/rounds/${round}/shop`;
  if (s.shop && p === shopPath && req.method === "GET")
    return send(s.shop.view());
  if (
    s.shop &&
    (p === shopPath + "/purchases" || p === shopPath + "/activations") &&
    req.method === "POST"
  ) {
    if (
      req.headers.origin !== `http://${req.headers.host}` ||
      req.headers["x-csrf-token"] !== "synthetic-participant-csrf"
    )
      return deny("CSRF_DENIED", 403);
    try {
      const receipt = p.endsWith("/activations")
        ? s.shop.activate(b)
        : s.shop.purchase(b);
      emit(s, { type: "INVALIDATE", projection: "competition" });
      if (s.dropNext) {
        s.dropNext = false;
        res.writeHead(200, {
          "content-type": "application/json",
          "content-length": "9999",
        });
        res.write('{"schema_version":1');
        setTimeout(() => res.destroy(), 20);
        return true;
      }
      return send(receipt);
    } catch (e) {
      return deny(e instanceof Error ? e.message : "INVALID_CONTEXT", 400);
    }
  }
  if (s.shop && p.startsWith(shopPath + "/outcomes/")) {
    const receipt = s.shop.outcome(p.split("/").at(-1)!);
    return send({
      status: receipt ? "OBSERVED" : "NOT_OBSERVED",
      outcome: receipt,
    });
  }
  if (p === "/api/v1/participant/logout") {
    s.active = false;
    s.flow = false;
    return send({ signed_out: true });
  }
  if (p === "/api/v1/participant/keep-alive") {
    s.expires = Date.now() + 7200000;
    return send({ session: session(s) });
  }
  if (p === "/api/v1/live/tickets") {
    const ticket = randomUUID();
    tickets.set(ticket, sid);
    return send({ ticket });
  }
  if (p === "/api/v1/live/snapshot" || p === "/api/v1/live/projection")
    return send(snapshot(s, b.sync_id));
  if (p === "/api/v1/live/replay") {
    const h = s.heads.find((x) => x.stream_id === b.stream_id)!;
    return send({
      sync_id: b.sync_id,
      events: [],
      next: h.head,
      through: h.head,
      heads: s.heads,
    });
  }
  if (p === "/api/v1/competition/history/rounds")
    return send([
      { round_id: round, kind: roundKind, state: session(s).round_state },
    ]);
  const historyPath = `/api/v1/competition/rounds/${round}/history`;
  if (p === historyPath)
    return send({
      round: {
        round_id: round,
        kind: roundKind,
        state: session(s).round_state,
        language: s.language,
      },
      final: s.closed,
      cancelled: false,
      wallet: s.wallet,
      standings: snapshot(s, randomUUID()).standings,
      bounties: s.bugs.map((bug) => ({
        ...bug,
        draft_saved: s.drafts.has(bug.bounty_id),
        awarded_points: bug.claimed ? bug.base_bounty : null,
      })),
    });
  if (p === `${historyPath}/attempts`)
    return send({
      items: [...s.feedback.values()].map((f) => ({
        ...f,
        title: s.bugs.find((bug) => bug.bounty_id === f.bounty_id)?.title,
        member_round_id: id(5),
        award_id:
          f.lane === "OFFICIAL" && f.status === "COMPLETED" ? f.id : null,
      })),
      next_after: null,
    });
  if (p === `${historyPath}/wallet`)
    return send({ items: s.walletEntries, next_after: null });
  if (p.startsWith(`${historyPath}/hints/`))
    return send(s.hints.get(p.split("/").at(-1)!) ?? []);
  if (p === `/api/v1/competition/rounds/${round}/score-adjustments`)
    return send({ items: [], next_after: null });
  if (/\/report\/outcomes\/[^/]+$/.test(p)) {
    const value = [...s.reports.values()].find(
      (r) => r.request_key === p.split("/").at(-1),
    );
    return send({
      status: value ? "OBSERVED" : "NOT_OBSERVED",
      receipt: value ?? null,
    });
  }
  const outcome = p.match(/\/outcomes\/([^/]+)$/);
  if (outcome && !p.includes("/draft/"))
    return send({
      status: s.actions.has(outcome[1]) ? "OBSERVED" : "NOT_OBSERVED",
      outcome: s.actions.get(outcome[1]) ?? null,
    });
  const judging = p.match(/\/judging\/([^/]+)$/);
  if (judging) return send(s.feedback.get(judging[1]));
  const match = p.match(/\/bounties\/([^/]+)(.*)$/);
  if (!match) return deny("NOT_FOUND", 404);
  const bounty = match[1],
    suffix = match[2],
    bug = s.bugs.find((x) => x.bounty_id === bounty);
  if (!bug) return deny("NOT_FOUND", 404);
  const question = visualFixtures
      ? undefined
      : roundKind === 2
        ? roundTwoQuestion(bounty)
        : roundOnePack.questions.find((q) => q.id === bounty),
    original = question
      ? question.variants[s.language as RoundOneLanguage].starter_code
      : starter[s.language],
    publicCases = question?.cases.filter((c) => c.visibility === "SAMPLE");
  if (!visualFixtures && !question) return deny("NOT_FOUND", 404);
  if (suffix === "/report") {
    if (req.method === "GET")
      return send({ report: s.reports.get(bounty) ?? null });
    const prior = s.reports.get(bounty);
    if (prior)
      return prior.request_key === b.request_key
        ? send(prior)
        : deny("REPORT_ALREADY_EXISTS", 409);
    const attached =
      b.submission_id === null
        ? null
        : s.submissions.find(
            (x) =>
              x.submission_id === b.submission_id && x.bounty_id === bounty,
          );
    if (
      typeof b.message !== "string" ||
      !b.message.trim() ||
      Buffer.byteLength(b.message) > 1024 ||
      (b.submission_id !== null && !attached)
    )
      return deny("INVALID_REQUEST", 400);
    const value = {
      id: randomUUID(),
      request_key: b.request_key,
      round_id: round,
      bounty_id: bounty,
      team_round_id: teamRound,
      submission_id: attached?.submission_id ?? null,
      parent_id: attached?.submission_id ?? null,
      source_sha256: attached
        ? createHash("sha256").update(attached.source).digest("hex")
        : null,
      message: b.message,
      recorded_at: new Date().toISOString(),
      title: bug.title,
      team_name: "Segfault Society",
      reporter_name: s.name,
      language: attached?.language ?? null,
      submission_result: attached?.result ?? null,
      status: "OPEN",
      decision_note: null,
    };
    s.reports.set(bounty, value);
    return send(value);
  }
  const unavailable = bug.claimed || !!s.shop?.unavailable(bounty);
  const writable = !s.paused && !s.closed && !unavailable,
    reason = s.closed
      ? "ROUND_NOT_WRITABLE"
      : s.paused
        ? "PAUSED"
        : unavailable
          ? "BOUNTY_UNAVAILABLE"
          : null;
  if (!suffix)
    return send({
      ...bug,
      claimed: unavailable,
      round_id: round,
      member_round_id: id(5),
      language: s.language,
      writable,
      reason,
      historical: false,
      cpu_ms: 2000,
      wall_ms: 5000,
      memory_kb: 262144,
      official_pending: [...s.feedback.values()].some(
        (f) =>
          f.bounty_id === bounty &&
          f.lane === "OFFICIAL" &&
          f.status !== "COMPLETED",
      ),
      unfinished_runs: [...s.feedback.values()].filter(
        (f) => f.lane === "SAMPLE" && f.status !== "COMPLETED",
      ).length,
      samples: publicCases
        ? publicCases.map((c, i) => ({
            sample_number: i + 1,
            input_bytes: Buffer.byteLength(c.input_data),
            output_bytes: Buffer.byteLength(c.expected_output),
          }))
        : [{ sample_number: 1, input_bytes: 4, output_bytes: 3 }],
    });
  if (suffix === "/statement")
    return send({
      bounty_id: bounty,
      statement: s.statement ?? question!.statement,
    });
  if (suffix === "/starter")
    return send({
      bounty_id: bounty,
      language: s.language,
      source: original,
    });
  if (suffix === "/open") {
    if (!bug!.captured) {
      bug!.captured = true;
      emit(s, { type: "INVALIDATE", projection: "capture" }, 1);
    }
    return send({
      opening_id: randomUUID(),
      request_key: b.request_key,
      recorded_at: new Date().toISOString(),
    });
  }
  if (suffix === "/draft" && req.method === "GET") {
    const saved = s.drafts.get(bounty);
    return send({
      draft_id: saved ? id(80) : null,
      round_id: round,
      bounty_id: bounty,
      member_round_id: id(5),
      language: s.language,
      source: saved?.source ?? original,
      source_kind: saved ? "DRAFT" : "STARTER",
      updated_at: saved?.updated_at ?? null,
      revision: saved?.revision ?? "0",
      writable,
      reason,
    });
  }
  if (suffix === "/draft" && req.method === "POST") {
    if (s.outcomes.has(b.request_key))
      return send(s.outcomes.get(b.request_key));
    const saved = s.drafts.get(bounty),
      kind = !writable
        ? "REJECTED"
        : b.base_revision !== (saved?.revision ?? "0")
          ? "CONFLICT"
          : b.source === saved?.source
            ? "UNCHANGED"
            : "SAVED",
      rev =
        kind === "SAVED"
          ? String(BigInt(b.base_revision) + 1n)
          : kind === "UNCHANGED"
            ? saved.revision
            : null;
    const receipt = {
      outcome_id: randomUUID(),
      round_id: round,
      member_round_id: id(5),
      bounty_id: bounty,
      request_key: b.request_key,
      base_revision: b.base_revision,
      outcome: kind,
      reason_code:
        kind === "CONFLICT"
          ? "REVISION_MISMATCH"
          : kind === "REJECTED"
            ? reason
            : null,
      result_revision: rev,
      recorded_at: new Date().toISOString(),
    };
    s.outcomes.set(b.request_key, receipt);
    if (kind === "SAVED") {
      s.drafts.set(bounty, {
        source: b.source,
        revision: rev,
        updated_at: new Date().toISOString(),
      });
      emit(
        s,
        {
          type: "INVALIDATE",
          projection: "draft",
          bounty_id: bounty,
          revision: rev,
        },
        2,
      );
    }
    return send(receipt, ["SAVED", "UNCHANGED"].includes(kind) ? 200 : 409);
  }
  if (suffix.startsWith("/draft/outcomes/")) {
    const value = s.outcomes.get(suffix.split("/").at(-1)!);
    return send({
      status: value ? "OBSERVED" : "NOT_OBSERVED",
      outcome: value ?? null,
    });
  }
  if (suffix.startsWith("/samples/")) {
    if (publicCases) {
      const sample = publicCases[Number(suffix.split("/")[2]) - 1];
      if (
        !sample ||
        !["input", "expected_output"].includes(suffix.split("/")[3])
      )
        return deny("NOT_FOUND", 404);
      return send({
        content: suffix.endsWith("/input")
          ? sample.input_data
          : sample.expected_output,
      });
    }
    return send({ content: suffix.endsWith("input") ? "7 5\n" : "12\n" });
  }
  if (suffix === "/hints" && req.method === "GET")
    return send(s.hints.get(bounty) ?? []);
  if (suffix === "/submissions" && req.method === "GET")
    return send({
      submissions: s.submissions.filter((x) => x.bounty_id === bounty),
      next_after: null,
    });
  if (/\/submissions\/.+\/source$/.test(suffix)) {
    const sub = s.submissions.find(
      (x) => x.submission_id === suffix.split("/")[2],
    );
    return sub ? send(sub) : deny("NOT_FOUND", 404);
  }
  if (["/runs", "/submissions", "/hints"].includes(suffix)) {
    const key = b.request_key;
    if (s.actions.has(key)) return send(s.actions.get(key));
    if (
      roundKind === 2 &&
      suffix !== "/hints" &&
      (typeof b.source !== "string" ||
        !b.source.trim() ||
        !b.source.isWellFormed() ||
        Buffer.byteLength(b.source) > 131072)
    )
      return deny("INVALID_CONTEXT", 400);
    if (
      roundKind === 2 &&
      suffix === "/submissions" &&
      [...s.feedback.values()].some(
        (f) =>
          f.bounty_id === bounty &&
          f.lane === "OFFICIAL" &&
          f.status !== "COMPLETED",
      )
    )
      return send({
        result: { status: "REJECTED", reason: "OFFICIAL_PENDING" },
      });
    if (!writable)
      return send({
        result: { status: "REJECTED", reason: reason ?? "UNAVAILABLE" },
      });
    const receipt: any = {
      outcome_id: randomUUID(),
      round_id: round,
      request_key: key,
      action: suffix.slice(1),
      recorded_at: new Date().toISOString(),
      result: { status: "ADMITTED" },
    };
    if (suffix === "/hints") {
      if (s.shop?.purchasingBlocked()) {
        receipt.result = { status: "REJECTED", reason: "CREDIT_FROZEN" };
        s.actions.set(key, receipt);
        return send(receipt);
      }
      if (b.level !== bug.hint_tier + 1) {
        receipt.result = {
          status: "REJECTED",
          reason: b.level <= bug.hint_tier ? "ALREADY_OWNED" : "HINT_LOCKED",
        };
        s.actions.set(key, receipt);
        return send(receipt);
      }
      const content = question
        ? question.hints[b.level - 1]?.content
        : [
            "Check the arithmetic operation on the two inputs.",
            "The output should add the inputs, not subtract them. Keep integer range in mind.",
            "Use a 64-bit signed integer for both inputs and their sum.",
          ][b.level - 1];
      if (!content) return deny("INVALID_CONTEXT", 400);
      const price =
        (bug.base_bounty / 10) * [1, 3, roundKind === 1 ? 4 : 8][b.level - 1];
      if (s.wallet < price) {
        receipt.result = { status: "REJECTED", reason: "INSUFFICIENT_FUNDS" };
        s.actions.set(key, receipt);
        return send(receipt);
      }
      s.wallet -= price;
      if (roundKind === 1) s.points -= price;
      s.walletEntries.push({
        id: randomUUID(),
        kind: "HINT",
        title: bug.title,
        amount: -price,
        hint_level: b.level,
        awarded_points: null,
        recorded_at: new Date().toISOString(),
      });
      bug.hint_tier = b.level;
      s.hints.set(bounty, [
        ...(s.hints.get(bounty) ?? []),
        { level: b.level, content },
      ]);
      receipt.result = { status: "PURCHASED", purchase_id: randomUUID() };
      emit(s, { type: "INVALIDATE", projection: "competition" });
    } else {
      const parent = randomUUID(),
        official = suffix === "/submissions";
      const protectedAtReceipt = s.shop?.protects(bounty) ?? false,
        receivedAt = Date.now() + s.shopOffset;
      const tier = Math.max(
        bug.hint_tier,
        s.shop?.intel(bounty).assistance_tier ?? 0,
      );
      const shielded = official ? (s.shop?.takeShield() ?? false) : false;
      const verdict =
        roundKind === 2 && b.source?.includes("PREVIEW_INFRA")
          ? "INFRA_ERROR"
          : roundKind === 2 && b.source?.includes("PREVIEW_WRONG")
            ? "WRONG_ANSWER"
            : "PASSED";
      receipt.result[official ? "submission_id" : "run_id"] = parent;
      s.feedback.set(parent, {
        id: parent,
        bounty_id: bounty,
        lane: official ? "OFFICIAL" : "SAMPLE",
        status: "QUEUED",
        created_at: new Date().toISOString(),
        completed_at: null,
        source: b.source,
        language: s.language,
        result: null,
        samples: [],
      });
      emit(s, { type: "JUDGING", projection: "judging" }, 2);
      if (official)
        s.submissions.push({
          submission_id: parent,
          member_round_id: id(5),
          language: s.language,
          source: b.source,
          bounty_id: bounty,
          receipt_order: String(s.submissions.length + 1),
          received_at: new Date().toISOString(),
          read_only: true,
          status: "QUEUED",
          result: null,
        });
      setTimeout(() => {
        const submission = s.submissions.find(
          (x) => x.submission_id === parent,
        );
        if (submission) {
          submission.status = "COMPLETED";
          submission.result = verdict;
        }
        s.feedback.set(parent, {
          id: parent,
          bounty_id: bounty,
          lane: official ? "OFFICIAL" : "SAMPLE",
          status: "COMPLETED",
          created_at: s.feedback.get(parent)?.created_at,
          completed_at: new Date().toISOString(),
          source: b.source,
          language: s.language,
          result: verdict,
          samples: official
            ? []
            : (publicCases ?? [{ expected_output: "12\n" }]).map(
                (c, index) => ({
                  sample: index + 1,
                  result: "PASSED",
                  stdout_b64: Buffer.from(c.expected_output).toString("base64"),
                  stderr_b64: null,
                  compiler_output_b64: null,
                  stdout_truncated: false,
                  stderr_truncated: false,
                  compiler_output_truncated: false,
                }),
              ),
        });
        if (official && verdict === "INFRA_ERROR" && shielded)
          s.shop?.restoreShield();
        if (official && verdict === "WRONG_ANSWER" && !shielded)
          s.penaltyMs += 300000;
        const rivalClaim = s.shop?.claimTime(bounty);
        if (
          official &&
          verdict === "PASSED" &&
          !bug.claimed &&
          (protectedAtReceipt ||
            rivalClaim === undefined ||
            receivedAt < rivalClaim)
        ) {
          bug.claimed = true;
          s.wallet += bug.base_bounty;
          const points =
            roundKind === 2
              ? (bug.base_bounty * [10, 9, 7, 5][tier]) / 10
              : bug.base_bounty;
          s.points += points;
          s.walletEntries.push({
            id: randomUUID(),
            kind: "AWARD",
            title: bug.title,
            amount: bug.base_bounty,
            hint_level: null,
            awarded_points: points,
            recorded_at: new Date().toISOString(),
          });
          emit(
            s,
            {
              type: "AWARD",
              award_id: randomUUID(),
              bounty_id: bounty,
              projection: "competition",
            },
            1,
          );
        } else emit(s, { type: "INVALIDATE", projection: "judging" }, 2);
      }, s.judgeDelay ?? 400);
    }
    s.actions.set(key, receipt);
    if (s.dropNext) {
      s.dropNext = false;
      res.writeHead(200, {
        "content-type": "application/json",
        "content-length": "9999",
      });
      res.write('{"schema_version":1');
      setTimeout(() => res.destroy(), 20);
      return true;
    }
    return send(receipt);
  }
  return deny("NOT_FOUND", 404);
}
const port = Number(
  process.env.INGENIUM_PREVIEW_PORT ?? (roundKind === 2 ? 5176 : 5174),
);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid local preview port");
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("..", import.meta.url)),
  envDir: false,
  plugins: [
    react(),
    {
      name: "synthetic-preview-only",
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          void handle(req, res)
            .then((done) => {
              if (!done) next();
            })
            .catch(() => {
              res.statusCode = 500;
              res.end();
            });
        });
      },
    },
  ],
  define: { __PREVIEW__: true },
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL("../../..", import.meta.url))],
      deny: [
        "**/.env",
        "**/.env.*",
        "**/*.{crt,pem}",
        "**/.git/**",
        "**/content/round-1/**",
        "**/content/round-2/**",
        "**/test-results/**",
      ],
    },
  },
});
io = new Server(server.httpServer!, {
  path: "/api/v1/live/socket",
  transports: ["websocket"],
  serveClient: false,
});
io.of("/live")
  .use((socket, next) => {
    const sid = tickets.get(socket.handshake.auth.ticket);
    if (!sid) return next(new Error("Invalid preview ticket"));
    tickets.delete(socket.handshake.auth.ticket);
    socket.data.sid = sid;
    socket.data.sync = randomUUID();
    next();
  })
  .on("connection", (socket) => {
    socket.emit("sync", { sync_id: socket.data.sync });
    socket.on("ready", () =>
      socket.emit("ready", {
        sync_id: socket.data.sync,
        heads: states.get(socket.data.sid)!.heads,
      }),
    );
    socket.on("resync", () => {
      socket.data.sync = randomUUID();
      socket.emit("sync", { sync_id: socket.data.sync });
    });
    const timer = setInterval(() => {
      const s = states.get(socket.data.sid)!;
      if (s.revoked) {
        socket.disconnect(true);
        return;
      }
      socket.emit("heads", { sync_id: socket.data.sync, heads: s.heads });
    }, 2000);
    socket.on("disconnect", () => clearInterval(timer));
  });
await server.listen();
console.log(
  `Synthetic Round ${roundKind} participant preview: http://127.0.0.1:${port}`,
);
const shopTimer =
  roundKind === 2
    ? setInterval(() => {
        for (const s of states.values())
          if (s.active && s.shop) {
            const v = s.shop.view(),
              key = JSON.stringify([
                v.ghost_until,
                v.ghost_cooldown_until,
                v.claim,
                v.frozen_until,
                v.targets.map((t) => t.frozen_until),
              ]);
            if (s.shopLifecycle !== key) {
              s.shopLifecycle = key;
              emit(s, { type: "INVALIDATE", projection: "competition" });
            }
          }
      }, 1000)
    : null;
const stop = async () => {
  if (shopTimer) clearInterval(shopTimer);
  await io.close();
  await server.close();
};
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());
