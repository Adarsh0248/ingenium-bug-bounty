import assert from "node:assert/strict";
import test from "node:test";
import { Command, createApi } from "../src/api";

test("uncertain timing clearance retains only its original GET recovery handle and separate recovery CSRF audience", async () => {
  const calls: { path: string; options: RequestInit }[] = [],
    secret = "C".repeat(32),
    receipt = {
      clearance_id: crypto.randomUUID(),
      generation: "1",
      cleared: true,
    };
  let seen = false;
  const api = createApi(async (path, options) => {
    calls.push({ path: String(path), options: options! });
    if (options?.method === "POST") throw Error("lost reply");
    return new Response(
      JSON.stringify({
        schema_version: 1,
        trace_id: crypto.randomUUID(),
        data: {
          status: seen ? "OBSERVED" : "NOT_OBSERVED",
          outcome: seen ? receipt : null,
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  api.setToken("STAFF", "normal-token");
  api.setToken("STAFF_RECOVERY", "recovery-token");
  const command = new Command(api, "", () => {}, "STAFF_RECOVERY"),
    base = "/api/v1/staff/recovery/clock";
  await assert.rejects(
    command.send(
      `${base}/clear`,
      {
        own_code: secret,
        runtime_id: crypto.randomUUID(),
        generation: "1",
        reason: "Synthetic review",
      },
      `${base}/outcomes`,
    ),
  );
  assert.equal(command.unresolved, true);
  assert.equal(JSON.stringify(command).includes(secret), false);
  assert.equal(
    (calls[0].options.headers as Record<string, string>)["x-csrf-token"],
    "recovery-token",
  );
  assert.equal(await command.recover(), null);
  assert.equal(command.unresolved, true);
  await assert.rejects(command.send(`${base}/clear`, {}, `${base}/outcomes`), {
    code: "COMMAND_UNRESOLVED",
  });
  seen = true;
  assert.deepEqual(await command.recover(), receipt);
  assert.equal(command.unresolved, false);
  assert.equal(calls.filter((c) => c.options.method === "POST").length, 1);
  assert.equal(calls[1].path, calls[2].path);
  assert.match(calls[1].path, /\/clock\/outcomes\/[a-f0-9-]{36}$/);
});
