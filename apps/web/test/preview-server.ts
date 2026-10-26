import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const round = id(1),
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
const definitions = [
  { title: "The silent overflow", difficulty: 35 },
  { title: "Off by one", difficulty: 20 },
  { title: "A tangled reference", difficulty: 64 },
  { title: "Race condition", difficulty: 88 },
  { title: "The missing return", difficulty: 12 },
  { title: "Ghost in the loop", difficulty: 51 },
];
interface State {
  session: string;
  flow: boolean;
  active: boolean;
  revoked: boolean;
  language: keyof typeof starter;
  name: string;
  expires: number;
  heads: typeof streams;
  bugs: any[];
  drafts: Map<string, any>;
  outcomes: Map<string, any>;
  actions: Map<string, any>;
  feedback: Map<string, any>;
  hints: Map<string, any[]>;
  submissions: any[];
  walletEntries: any[];
  wallet: number;
  points: number;
  paused: boolean;
  closed: boolean;
  dropNext: boolean;
  judgeDelay?: number;
  statement: string;
}
const states = new Map<string, State>(),
  tickets = new Map<string, string>(),
  started = Date.now(),
  closing = started + 7200000;
let io: Server;
function state(req: IncomingMessage, res: ServerResponse) {
  let sid = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("preview_session="))
    ?.slice(16);
  if (!sid || !states.has(sid)) {
    sid = randomUUID();
    states.set(sid, {
      session: randomUUID(),
      flow: false,
      active: false,
      revoked: false,
      language: "cpp",
      name: "Asha",
      expires: Date.now() + 7200000,
      heads: structuredClone(streams),
      bugs: definitions.map((b, i) => ({
        ...b,
        bounty_id: id(100 + i),
        base_bounty: b.difficulty * 10,
        claimed: false,
        hint_tier: 0,
      })),
      drafts: new Map(),
      outcomes: new Map(),
      actions: new Map(),
      feedback: new Map(),
      hints: new Map(),
      submissions: [],
      walletEntries: [],
      wallet: 1200,
      points: 1350,
      paused: false,
      closed: false,
      dropNext: false,
      statement:
        "A telemetry service combines two signed integers. Its implementation returns the wrong total.\n\nRepair the program so it prints their sum, including values outside the 32-bit range.\n\nInput\nTwo signed integers a and b, separated by whitespace.\n\nOutput\nTheir sum followed by a newline.\n\nConstraints\n-10^12 <= a, b <= 10^12",
    });
    res.setHeader(
      "set-cookie",
      `preview_session=${sid}; HttpOnly; SameSite=Strict; Path=/`,
    );
  }
  return { sid, s: states.get(sid)! };
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
    expires_at: new Date(s.expires).toISOString(),
    absolute_expires_at: new Date(started + 28800000).toISOString(),
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
      effective_time_ms: 3380000,
      penalty_ms: 0,
      difficulties: [80, 55],
    },
    first = {
      ...own,
      team_id: id(20),
      team_round_id: id(21),
      team_name: "Bit Shift",
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
      kind: 1,
      state: s.closed ? "CLOSED" : s.paused ? "PAUSED" : "RUNNING",
      duration_ms: "7200000",
      started_at: new Date(started).toISOString(),
      closes_at: new Date(closing).toISOString(),
      current: true,
      arena_status: "IN_PROGRESS",
    },
    arena: { current_instance_id: id(7), status: "IN_PROGRESS" },
    bounties: s.bugs,
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
    if (b.action === "pause") s.paused = true;
    if (b.action === "resume") s.paused = false;
    if (b.action === "close") s.closed = true;
    if (b.action === "revoke") s.revoked = true;
    if (b.action === "drop") s.dropNext = true;
    if (b.action === "full-field")
      s.bugs = Array.from({ length: 40 }, (_, i) => ({
        bounty_id: id(100 + i),
        title: `${definitions[i % definitions.length].title} / ${i + 1}`,
        difficulty: 1 + ((i * 17) % 100),
        base_bounty: (1 + ((i * 17) % 100)) * 10,
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
      if (bug) bug.claimed = true;
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
    s.active = true;
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
    return send([{ round_id: round, kind: 1, state: session(s).round_state }]);
  const historyPath = `/api/v1/competition/rounds/${round}/history`;
  if (p === historyPath)
    return send({
      round: {
        round_id: round,
        kind: 1,
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
  const writable = !s.paused && !s.closed && !bug.claimed,
    reason = s.closed
      ? "ROUND_NOT_WRITABLE"
      : s.paused
        ? "PAUSED"
        : bug.claimed
          ? "BOUNTY_UNAVAILABLE"
          : null;
  if (!suffix)
    return send({
      ...bug,
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
      samples: [{ sample_number: 1, input_bytes: 4, output_bytes: 3 }],
    });
  if (suffix === "/statement")
    return send({ bounty_id: bounty, statement: s.statement });
  if (suffix === "/starter")
    return send({
      bounty_id: bounty,
      language: s.language,
      source: starter[s.language],
    });
  if (suffix === "/open")
    return send({
      opening_id: randomUUID(),
      request_key: b.request_key,
      recorded_at: new Date().toISOString(),
    });
  if (suffix === "/draft" && req.method === "GET") {
    const saved = s.drafts.get(bounty);
    return send({
      draft_id: saved ? id(80) : null,
      round_id: round,
      bounty_id: bounty,
      member_round_id: id(5),
      language: s.language,
      source: saved?.source ?? starter[s.language],
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
  if (suffix.startsWith("/samples/"))
    return send({ content: suffix.endsWith("input") ? "7 5\n" : "12\n" });
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
      const content = [
        "Check the arithmetic operation on the two inputs.",
        "The output should add the inputs, not subtract them. Keep integer range in mind.",
        "Use a 64-bit signed integer for both inputs and their sum.",
      ][b.level - 1];
      const price = bug.difficulty * [1, 3, 4][b.level - 1];
      s.wallet -= price;
      s.points -= price;
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
        s.feedback.set(parent, {
          id: parent,
          bounty_id: bounty,
          lane: official ? "OFFICIAL" : "SAMPLE",
          status: "COMPLETED",
          created_at: s.feedback.get(parent)?.created_at,
          completed_at: new Date().toISOString(),
          source: b.source,
          language: s.language,
          result: "PASSED",
          samples: official
            ? []
            : [
                {
                  sample: 1,
                  result: "PASSED",
                  stdout_b64: "MTIK",
                  stderr_b64: null,
                  compiler_output_b64: null,
                  stdout_truncated: false,
                  stderr_truncated: false,
                  compiler_output_truncated: false,
                },
              ],
        });
        if (official) {
          bug.claimed = true;
          s.wallet += bug.base_bounty;
          s.points += bug.base_bounty;
          s.walletEntries.push({
            id: randomUUID(),
            kind: "AWARD",
            title: bug.title,
            amount: bug.base_bounty,
            hint_level: null,
            awarded_points: bug.base_bounty,
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
const port = Number(process.env.INGENIUM_PREVIEW_PORT ?? 5174);
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
    fs: { allow: [fileURLToPath(new URL("../../..", import.meta.url))] },
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
console.log(`Synthetic participant preview: http://127.0.0.1:${port}`);
const stop = async () => {
  await io.close();
  await server.close();
};
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());
