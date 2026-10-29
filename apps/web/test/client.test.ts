import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, Command, createApi } from "../src/api";
import { allowed, createWorkspace } from "../src/workspace";
import { timeText } from "../src/types";
const envelope = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({ schema_version: 1, trace_id: crypto.randomUUID(), data }),
    { status, headers: { "content-type": "application/json" } },
  );
test("browser requests remain same-origin and keep credentials/tokens out of URLs and storage", async () => {
  const seen: { path: unknown; options: RequestInit }[] = [];
  const api = createApi(async (path, options) => {
    seen.push({ path, options: options! });
    return envelope({ ok: true });
  });
  api.setToken("PARTICIPANT", "csrf-only");
  await api.request("/api/v1/competition/action", { source: "private" });
  assert.equal(seen[0].path, "/api/v1/competition/action");
  assert.equal(seen[0].options.credentials, "same-origin");
  assert.equal(seen[0].options.redirect, "error");
  assert.equal((seen[0].options.headers as any)["x-csrf-token"], "csrf-only");
  await assert.rejects(api.request("https://foreign.invalid/api/v1/"));
  await assert.rejects(api.request("/api/v1/\\foreign"));
});
test("processed draft conflicts survive HTTP 409 rather than becoming unknown transport errors", async () => {
  const api = createApi(async () =>
    envelope({ outcome: "CONFLICT", reason_code: "REVISION_MISMATCH" }, 409),
  );
  assert.equal(
    (await api.request<any>("/api/v1/draft", {})).outcome,
    "CONFLICT",
  );
});
test("malformed, redirected and oversized replies never imply a successful command", async () => {
  for (const response of [
    new Response("<html>not JSON</html>"),
    new Response(JSON.stringify({ schema_version: 2, data: { ok: true } }), {
      headers: { "content-type": "application/json" },
    }),
    new Response("x".repeat(8388609), {
      headers: { "content-type": "application/json" },
    }),
  ]) {
    const api = createApi(async () => response);
    await assert.rejects(api.request("/api/v1/read"), {
      code: "NETWORK",
      outcome: "UNKNOWN",
    });
  }
});
test("a lost action reply is recovered with GET only and blocks new actions without replaying source", async () => {
  const calls: any[] = [];
  let observed = false;
  const api = createApi(async (path, options) => {
    calls.push({ path, options });
    if (options?.method === "POST") throw new Error("lost response");
    return envelope({
      status: observed ? "OBSERVED" : "NOT_OBSERVED",
      outcome: observed ? { result: { status: "ADMITTED" } } : null,
    });
  });
  const command = new Command(api, "round");
  await assert.rejects(
    command.send("/api/v1/competition/action", { source: "exact snapshot" }),
  );
  assert.ok(command.unresolved);
  await assert.rejects(
    command.send("/api/v1/competition/action", { source: "newer" }),
  );
  assert.equal(await command.recover(), null);
  assert.ok(command.unresolved);
  observed = true;
  assert.equal((await command.recover()).result.status, "ADMITTED");
  assert.equal(command.unresolved, false);
  assert.equal(calls.filter((c) => c.options.method === "POST").length, 1);
  assert.equal(calls[1].options.body, undefined);
});

test("private staff case reads retain a maximally escaped pair without enlarging other response limits", async () => {
  const id = crypto.randomUUID(),
    path = `/api/v1/staff/content/versions/${id}/cases/${id}`,
    value = {
      input_data: "\0".repeat(1048576),
      expected_output: "\0".repeat(1048576),
    };
  const api = createApi(async () => envelope(value));
  assert.deepEqual(await api.request(path, undefined, "STAFF"), value);
  for (const [p, audience, body] of [
    [path, "PARTICIPANT", undefined],
    ["/api/v1/read", "STAFF", undefined],
    [path, "STAFF", {}],
  ] as const)
    await assert.rejects(api.request(p, body, audience), { code: "NETWORK" });
  const oversized = createApi(
    async () =>
      new Response("x".repeat(16777217), {
        headers: { "content-type": "application/json" },
      }),
  );
  await assert.rejects(oversized.request(path, undefined, "STAFF"), {
    code: "NETWORK",
  });
});
test("known unprocessed refusal releases the local action guard without inventing a success", async () => {
  const api = createApi(
    async () =>
      new Response(
        JSON.stringify({
          schema_version: 1,
          trace_id: crypto.randomUUID(),
          error: { code: "RATE_LIMITED", outcome: "NOT_PROCESSED" },
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
  );
  const command = new Command(api, "round");
  await assert.rejects(command.send("/api/v1/action", {}), ApiError);
  assert.equal(command.unresolved, false);
});

test("staff commands use their own CSRF audience and recover the original setup receipt without retaining the staff code", async () => {
  const calls: { path: string; options: RequestInit }[] = [];
  const api = createApi(async (path, options) => {
    calls.push({ path: String(path), options: options! });
    if (options?.method === "POST") throw new Error("lost body");
    return envelope({ status: "OBSERVED", outcome: { outcome: "APPLIED" } });
  });
  api.setToken("STAFF", "staff-context");
  api.setToken("PARTICIPANT", "wrong-context");
  const command = new Command(api, "", () => {}, "STAFF");
  await assert.rejects(
    command.send(
      "/api/v1/staff/arenas",
      { own_code: "private-confirmation", team_ids: [] },
      "/api/v1/staff/outcomes/arena-setup/CREATE/arena",
    ),
  );
  assert.ok(command.unresolved);
  assert.deepEqual((command as any).pending.body, {});
  const key = JSON.parse(calls[0].options.body as string).request_key;
  assert.equal(
    (calls[0].options.headers as any)["x-csrf-token"],
    "staff-context",
  );
  assert.equal((await command.recover()).outcome, "APPLIED");
  assert.equal(
    calls[1].path,
    `/api/v1/staff/outcomes/arena-setup/CREATE/arena/${key}`,
  );
  assert.equal(calls[1].options.method, "GET");
  assert.equal(calls[1].options.body, undefined);
  assert.equal((calls[1].options.headers as any)["x-csrf-token"], undefined);
  assert.equal(command.unresolved, false);
  assert.equal(calls.length, 2);
});
test("permission metadata distinguishes a teammate member pause from own/team/global restrictions", () => {
  const s: any = {
    actor: { team_round_id: "team", member_round_id: "own" },
    round: { current: true, state: "RUNNING" },
    bounties: [{ bounty_id: "bug", claimed: false }],
    pauses: [
      { scope: "MEMBER", team_round_id: null, member_round_id: "teammate" },
    ],
  };
  assert.ok(allowed(s, "bug"));
  s.pauses.push({
    scope: "MEMBER",
    team_round_id: null,
    member_round_id: "own",
  });
  assert.equal(allowed(s, "bug"), false);
  s.pauses = [];
  s.bounties[0].claimed = true;
  assert.equal(allowed(s, "bug"), false);
});

test("replacement decision recovery reads the receipt envelope without repeating approval", async () => {
  const methods: string[] = [];
  let observed = false;
  const api = createApi(async (_path, options) => {
    methods.push(options!.method!);
    if (options?.method === "POST") throw new Error("lost approval reply");
    return envelope({
      status: observed ? "OBSERVED" : "NOT_OBSERVED",
      receipt: observed ? { action: "APPROVE", outcome: "APPLIED" } : null,
    });
  });
  const command = new Command(api, "", () => {}, "STAFF");
  await assert.rejects(
    command.send(
      "/api/v1/staff/replacements/request/decision",
      { action: "APPROVE" },
      "/api/v1/staff/outcomes/replacements",
    ),
  );
  assert.equal(await command.recover(), null);
  assert.ok(command.unresolved);
  observed = true;
  assert.equal((await command.recover()).outcome, "APPLIED");
  assert.equal(command.unresolved, false);
  assert.deepEqual(methods, ["POST", "GET", "GET"]);
});
test("simultaneous editor opens share one controller; uncertain action state survives target navigation", async () => {
  const view = {
    round_id: "round",
    bounty_id: "bug",
    member_round_id: "member",
    language: "cpp",
    revision: "0",
    source: "starter",
    writable: true,
    reason: null,
  };
  const api = createApi(async () => envelope(view)),
    workspace = createWorkspace(api, { round_id: "round" } as any, () => {});
  const [a, b] = await Promise.all([
    workspace.open("bug"),
    workspace.open("bug"),
  ]);
  assert.equal(a.editor, b.editor);
  assert.equal(workspace.command("bug"), workspace.command("bug"));
  workspace.close();
});
test("countdown is presentation-only, bounded at zero and never wraps at one hour", () => {
  assert.equal(timeText(0), "00:00:00");
  assert.equal(timeText(-2000), "00:00:00");
  assert.equal(timeText(3600000), "01:00:00");
  assert.equal(timeText(18000000), "05:00:00");
});

test("opened question memory is bounded, session-scoped and cleared without touching dirty source", () => {
  const api = createApi(async () => envelope({}));
  const first = createWorkspace(
    api,
    { round_id: "round", member_round_id: "one" } as any,
    () => {},
  );
  const second = createWorkspace(
    api,
    { round_id: "round", member_round_id: "two" } as any,
    () => {},
  );
  const brief = (statement = "Opened question") => ({
    meta: {} as any,
    statement,
    hints: [],
    samples: {},
  });
  try {
    for (let i = 0; i < 8; i++) first.rememberQuestion(String(i), brief());
    assert.ok(first.question("0"));
    first.rememberQuestion("8", brief());
    assert.ok(first.question("0"));
    assert.equal(first.question("1"), null);
    assert.equal(second.question("0"), null);
    first.rememberQuestion("huge", brief("x".repeat(4194304)));
    assert.equal(first.question("huge"), null);
    first.close();
    assert.equal(first.question("0"), null);
    first.rememberQuestion("late", brief());
    assert.equal(first.question("late"), null);
  } finally {
    first.close();
    second.close();
  }
});
