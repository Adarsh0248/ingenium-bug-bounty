import assert from "node:assert/strict";
import { randomBytes, randomUUID, X509Certificate } from "node:crypto";
import { createServer } from "node:https";
import type { TLSSocket } from "node:tls";
import type { Duplex } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { Pool } from "pg";
import { assertApiDatabase } from "../../src/database.js";
import {
  assertWorkerDatabase,
  createJudgingCoordinator,
  startJudgingWorker,
} from "../../src/worker/judging.js";
import { competitionRuntime } from "../../src/worker/readiness.js";
import {
  parseCompetitionRuntime,
  parseWorkerRuntime,
} from "../../src/worker/config.js";
import { createAuthoringJudgeDriver } from "../../src/content/judge-driver.js";
import { createCompetitionService } from "../../src/competition/service.js";
import {
  judgeJson,
  readJudgeJson,
  readAuthoringRequest,
  runtimeRecord,
  JUDGE_PROTOCOL,
} from "../../src/content/judge-protocol.js";
import type { AuthoringPayload } from "../../src/content/execution-policy.js";
import { sha256 } from "../../src/access/credentials.js";
import { judgeReply } from "../fixtures/judge.js";
import { createTestTls } from "../fixtures/tls.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";

export async function workerRuntimeChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1],
) {
  const tls = await createTestTls(t),
    sockets = new Set<Duplex>(),
    records = new Map<string, { payload: AuthoringPayload; token: string }>();
  const posts = new Map<string, number>(),
    lost = new Set<string>();
  let ready = true,
    reached: (() => void) | undefined,
    blocked: Promise<void> | undefined,
    error: unknown;
  const server = createServer(
    {
      ca: tls.ca,
      cert: tls.cert,
      key: tls.key,
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.3",
    },
    async (req, res) => {
      try {
        assert.ok(
          (req.socket as TLSSocket)
            .getPeerCertificate()
            .raw.equals(new X509Certificate(tls.clientCert).raw),
        );
        const nonce = req.headers["x-ingenium-request-id"] as string;
        assert.equal(req.headers.host, "judge.test");
        assert.equal(
          req.headers["x-ingenium-host-epoch"],
          c.driver.hostEpochId,
        );
        res.setHeader("Content-Type", "application/json");
        const root = "/ingenium/v1/authoring";
        if (req.url === `${root}/ready`) {
          res.statusCode = ready ? 200 : 503;
          res.end(
            judgeJson({
              protocol: JUDGE_PROTOCOL,
              request_id: nonce,
              host_epoch_id: c.driver.hostEpochId,
              ready,
              runtimes: runtimeRecord(c.driver.runtimes),
            }),
          );
          return;
        }
        const attempt = req.url!.slice(`${root}/attempts/`.length);
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        if (req.method === "POST") {
          const payload = readAuthoringRequest(
            readJudgeJson(Buffer.concat(chunks)),
            nonce,
            c.driver.hostEpochId,
            attempt,
            req.headers["x-ingenium-payload-digest"] as string,
            c.driver.runtimes,
          );
          posts.set(attempt, (posts.get(attempt) ?? 0) + 1);
          assert.equal(posts.get(attempt), 1);
          records.set(attempt, { payload, token: randomUUID() });
          if (payload.source.toString().includes("shutdown")) {
            reached?.();
            await blocked;
          }
          if (
            payload.source.toString().includes("lost") &&
            !lost.has(attempt)
          ) {
            lost.add(attempt);
            req.socket.destroy();
            return;
          }
          res.statusCode = 201;
        } else {
          assert.equal(req.method, "GET");
          assert.equal(chunks.length, 0);
        }
        const record = records.get(attempt);
        assert.ok(record);
        res.end(
          judgeJson(
            judgeReply(
              record.payload,
              nonce,
              Buffer.from(
                record.payload.sourceRole === "STARTER" ? "wrong\n" : "12\n",
              ),
              record.token,
            ),
          ),
        );
      } catch (e) {
        error = e;
        res.statusCode = 500;
        res.end("{}");
      }
    },
  );
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("tlsClientError", () => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const login = `worker_${randomUUID().replaceAll("-", "")}`,
    password = randomBytes(24).toString("hex");
  await c.owner.query(
    `CREATE ROLE "${login}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}' IN ROLE ingenium_app_worker`,
  );
  const url = new URL(c.owner.options.connectionString!);
  url.username = login;
  url.password = password;
  const pool = new Pool({
    connectionString: url.toString(),
    max: 4,
    connectionTimeoutMillis: 1000,
  });
  const descriptor = {
    host_epoch_id: c.driver.hostEpochId,
    endpoint_ref: c.driver.endpointRef,
    runtimes: runtimeRecord(c.driver.runtimes),
  };
  const config = parseWorkerRuntime({
    schema_version: 1,
    database_url: url.toString(),
    judge: descriptor,
    tls: {
      address: "127.0.0.1",
      port: address.port,
      server_name: "judge.test",
      server_certificate_sha256: sha256(
        new X509Certificate(tls.cert).raw,
      ).toString("hex"),
      ca_pem: tls.ca.toString(),
      certificate_pem: tls.clientCert.toString(),
      private_key_pem: tls.clientKey.toString(),
    },
  });
  const driver = createAuthoringJudgeDriver(config.driver);
  const settings = parseCompetitionRuntime({
    schema_version: 1,
    judge: descriptor,
    draw_key: randomBytes(32).toString("hex"),
    draw_key_id: "synthetic-draw",
  });
  const dependency = competitionRuntime(c.api, c.clock, settings);
  const service = createCompetitionService(c.api, c.clock, c.delivery, {
    ...c.deps,
    assertReady: dependency.assertReady,
  });
  const query = async (sql: string, args: unknown[] = []) =>
    (await c.owner.query(sql, args)).rows;
  const expireLease = () =>
    query(
      "UPDATE judge_control SET lease_until=date_trunc('milliseconds',clock_timestamp())-interval '1 millisecond' WHERE id=1",
    );
  async function waitFor(
    done: () => Promise<boolean>,
    tick?: () => Promise<unknown>,
  ) {
    const end = Date.now() + 20000;
    while (!(await done())) {
      assert.ok(Date.now() < end, "Bounded worker runtime check timed out");
      await tick?.();
      await delay(50);
    }
  }
  try {
    await t.test(
      "standalone judging requires the dedicated restricted role and cannot read credentials, operate staff commands or migrate",
      async () => {
        await assertWorkerDatabase(pool);
        await assert.rejects(assertWorkerDatabase(c.api));
        await assert.rejects(assertWorkerDatabase(c.owner));
        for (const table of [
          "access_credentials",
          "staff_sessions",
          "code_drafts",
          "wallet_entries",
        ])
          await assert.rejects(pool.query(`SELECT * FROM ${table}`), {
            code: "42501",
          });
        await assert.rejects(pool.query("CREATE TABLE forbidden(id int)"), {
          code: "42501",
        });
        await assert.rejects(
          pool.query("SELECT maintain_competition_round($1)", [randomUUID()]),
          { code: "42501" },
        );
      },
    );
    await t.test(
      "event API preflight rejects owner/worker credentials and accidental table or column write grants",
      async () => {
        await assertApiDatabase(c.api);
        await assert.rejects(assertApiDatabase(c.owner));
        await assert.rejects(assertApiDatabase(pool));
        for (const [grant, revoke] of [
          [
            "GRANT TRUNCATE ON wallet_entries TO ingenium_api",
            "REVOKE TRUNCATE ON wallet_entries FROM ingenium_api",
          ],
          [
            "GRANT UPDATE(verifier) ON access_credentials TO ingenium_api",
            "REVOKE UPDATE(verifier) ON access_credentials FROM ingenium_api",
          ],
        ]) {
          await c.owner.query(grant!);
          try {
            await assert.rejects(assertApiDatabase(c.api));
          } finally {
            await c.owner.query(revoke!);
          }
          await assertApiDatabase(c.api);
        }
      },
    );
    const a = await c.newRound();
    let coordinator = createJudgingCoordinator(pool, c.clock, driver);
    await t.test(
      "a second worker stays in standby; unavailable private readiness creates no attempt or replacement execution",
      async () => {
        const before = await query(
          "SELECT count(*)::int n FROM participant_attempts",
        );
        assert.equal(await coordinator.tick(), "STANDBY");
        await expireLease();
        ready = false;
        await assert.rejects(coordinator.tick());
        assert.deepEqual(
          await query("SELECT count(*)::int n FROM participant_attempts"),
          before,
        );
        await assert.rejects(
          dependency.assertReady(AbortSignal.timeout(10000)),
        );
        ready = true;
        assert.equal(await coordinator.tick(), "TICKED");
        await dependency.assertReady(AbortSignal.timeout(10000));
        const wrong = competitionRuntime(c.api, c.clock, {
          ...settings,
          hostEpochId: randomUUID(),
        });
        await assert.rejects(wrong.assertReady(AbortSignal.timeout(10000)));
      },
    );
    await t.test(
      "automatic coordinator uses real TLS and restricted PostgreSQL for both members/languages, and lost POST replies become original GET recovery",
      async () => {
        await c.budgets();
        const official = (
          await service.submit(
            a.aa,
            a.round,
            a.x,
            "lost official source",
            randomUUID(),
          )
        ).result.submission_id as string;
        const sample = (
          await service.run(a.ab, a.round, a.y, "sample source", randomUUID())
        ).result.run_id as string;
        const before = await query(
          "SELECT source,received_at,receipt_order FROM competition_submissions WHERE id=$1",
          [official],
        );
        await waitFor(
          async () => lost.size > 0,
          () => coordinator.tick(),
        );
        const originalAttempts = [...lost];
        coordinator.stop();
        await expireLease();
        coordinator = createJudgingCoordinator(pool, c.clock, driver);
        await waitFor(
          async () =>
            (
              await query(
                "SELECT count(*)::int n FROM participant_judging WHERE id=ANY($1::uuid[]) AND completed_at IS NOT NULL",
                [[official, sample]],
              )
            )[0].n === 2,
          () => coordinator.tick(),
        );
        assert.deepEqual(
          (
            await query(
              "SELECT result FROM participant_judging WHERE id=ANY($1::uuid[]) ORDER BY id",
              [[official, sample]],
            )
          ).map((r) => r.result),
          ["PASSED", "PASSED"],
        );
        assert.ok(lost.size > 0);
        assert.ok(originalAttempts.every((id) => posts.get(id) === 1));
        assert.ok([...posts.values()].every((n) => n === 1));
        assert.deepEqual(
          await query(
            "SELECT source,received_at,receipt_order FROM competition_submissions WHERE id=$1",
            [official],
          ),
          before,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1",
              [official],
            )
          )[0].n,
          1,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL",
            )
          )[0].n,
          0,
        );
      },
    );
    await t.test(
      "timing failure stops the coordinator without fabricating a result, and a replacement recovers from persisted state without replay",
      async () => {
        const before = posts.size;
        const stopped = createJudgingCoordinator(
          pool,
          {
            ...c.clock,
            assertHealthy() {
              throw new Error("Synthetic clock unavailable");
            },
          },
          driver,
        );
        await assert.rejects(stopped.tick());
        stopped.stop();
        assert.equal(await stopped.tick(), "STOPPED");
        assert.equal(posts.size, before);
        coordinator.stop();
        await expireLease();
        coordinator = createJudgingCoordinator(pool, c.clock, driver);
        await coordinator.tick();
        assert.equal(posts.size, before);
      },
    );
    await t.test(
      "worker shutdown awaits an active request and cannot start the next case after shutdown was requested",
      async () => {
        await c.budgets();
        const next = (
          await service.submit(
            a.ba,
            a.round,
            a.y,
            "shutdown source",
            randomUUID(),
          )
        ).result.submission_id as string;
        coordinator.stop();
        await expireLease();
        const arrived = new Promise<void>((resolve) => {
          reached = resolve;
        });
        let release!: () => void;
        blocked = new Promise<void>((resolve) => {
          release = resolve;
        });
        const runtime = startJudgingWorker(pool, c.clock, driver, () => {});
        try {
          await Promise.race([
            arrived,
            delay(10000).then(() => assert.fail("No active source request")),
          ]);
          let closed = false;
          const close = runtime.close().then(() => {
            closed = true;
          });
          await delay(30);
          assert.equal(closed, false);
          release();
          await close;
          const count = posts.size;
          await delay(400);
          assert.equal(posts.size, count);
          assert.equal(
            (
              await query(
                "SELECT completed_at FROM participant_judging WHERE id=$1",
                [next],
              )
            )[0].completed_at,
            null,
          );
        } finally {
          release();
          await runtime.close();
          blocked = undefined;
        }
        assert.equal(error, undefined);
      },
    );
  } finally {
    await pool.end();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await c.owner.query(`DROP ROLE "${login}"`);
  }
}
