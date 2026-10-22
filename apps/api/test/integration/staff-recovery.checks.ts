import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { migrateDatabase } from "../../src/db/migrate.js";
import { firstSuperAdmin } from "../../src/access/staff-bootstrap.js";
import {
  recoverSuperAdmin,
  operatorStaffOutcome,
} from "../../src/access/staff-recovery.js";
import type { OperatorStaffInput } from "../../src/access/staff-recovery.js";
import {
  newAccessCode,
  newProof,
  sessionDelivery,
} from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createStaffManagement } from "../../src/access/staff-management.js";
import { AccessError } from "../../src/access/transaction.js";
import { staffRecoveryLinuxChecks } from "./staff-recovery-linux.checks.js";

export async function staffRecoveryChecks(
  t: TestContext,
  ownerConnection: string,
  apiConnection: string,
  databaseContainer: string,
) {
  const name = `ingenium_recovery_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({ connectionString: ownerConnection });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const ownerUrl = new URL(ownerConnection),
    apiUrl = new URL(apiConnection);
  ownerUrl.pathname = apiUrl.pathname = `/${name}`;
  await migrateDatabase(ownerUrl.toString());
  const owner = new Pool({ connectionString: ownerUrl.toString(), max: 4 }),
    api = new Pool({ connectionString: apiUrl.toString(), max: 3 });
  const delivery = sessionDelivery(
    "synthetic-operator-recovery",
    randomBytes(32),
  );
  const clock = { assertHealthy() {}, async verify() {}, fault() {} };
  const entry = createEntryService(api, clock, delivery),
    staff = createStaffService(api, clock, delivery);
  const firstCode = newAccessCode(),
    firstId = randomUUID(),
    firstCredential = randomUUID();
  function command(
    action: OperatorStaffInput["action"],
    staffId: string = firstId,
    revision = "1",
  ) {
    const generated = action === "DISABLE" ? null : newAccessCode();
    return {
      code: generated?.code ?? null,
      input: {
        requestKey: randomUUID(),
        action,
        staffId,
        credentialId: generated ? randomUUID() : null,
        verifier: generated?.verifier ?? null,
        displayName:
          action === "CREATE" ? "Synthetic backup administrator" : null,
        expectedRevision: revision,
        replacementSessionId: null,
        operator: "Synthetic verified operator",
        osUser: "synthetic-maintainer",
        verification: "Synthetic separate identity verification",
        reason: "Synthetic access recovery",
      } as OperatorStaffInput,
    };
  }
  async function activate(code: string) {
    const flow = await entry.begin(code, {
      ip: "127.0.0.1",
      browserId: randomUUID(),
    });
    if (flow.audience !== "STAFF")
      throw new Error("Synthetic staff entry failed.");
    return staff.activate(flow.proofCookie, randomUUID());
  }
  const revision = async (id?: string) =>
    (
      await owner.query(
        id
          ? "SELECT revision FROM staff_identities WHERE id=$1"
          : "SELECT revision FROM security_control WHERE id=1",
        id ? [id] : [],
      )
    ).rows[0].revision;
  async function syntheticUnusableSession(
    mode: "NORMAL" | "CLOCK_RECOVERY",
    ageMs: number,
  ) {
    const id = randomUUID(),
      credential = randomUUID(),
      flow = newProof(),
      session = newProof();
    const now = new Date(Math.floor(Date.now()) - ageMs),
      expires = new Date(now.getTime() + 600000);
    const client = await owner.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic unusable replacement','SUPER_ADMIN')",
        [id],
      );
      await client.query(
        "INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,$4)",
        [credential, id, newAccessCode().verifier, now],
      );
      await client.query(
        `INSERT INTO staff_entry_flows(id,staff_id,credential_id,credential_version,proof_verifier,mode,generation,state,created_at,expires_at)
        VALUES($1,$2,$3,1,$4,$5,$6,'OPEN',$7,$8)`,
        [
          flow.id,
          id,
          credential,
          flow.verifier,
          mode,
          mode === "NORMAL" ? 0 : 1,
          now,
          expires,
        ],
      );
      await client.query(
        `INSERT INTO staff_sessions(id,staff_id,flow_id,credential_id,credential_version,secret_verifier,mode,generation,created_at,absolute_expires_at,last_activity_at)
        VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$8::timestamptz+interval '8 hours',$8)`,
        [
          session.id,
          id,
          flow.id,
          credential,
          session.verifier,
          mode,
          mode === "NORMAL" ? 0 : 1,
          now,
        ],
      );
      await client.query(
        "UPDATE staff_session_slots SET session_id=$2,revision=revision+1 WHERE staff_id=$1",
        [id, session.id],
      );
      await client.query(
        "UPDATE staff_entry_flows SET state='ACTIVATED',session_id=$2,activated_at=$3 WHERE id=$1",
        [flow.id, session.id, now],
      );
      await client.query(
        "INSERT INTO staff_session_deliveries(flow_id,session_id,key_id,expires_at,purged_at) VALUES($1,$2,'synthetic-expired',$3,$4)",
        [flow.id, session.id, expires, now],
      );
      await client.query(
        "INSERT INTO staff_entry_outcomes(flow_id,request_key,fingerprint,session_id,recorded_at) VALUES($1,$2,$3,$4,$5)",
        [flow.id, randomUUID(), Buffer.alloc(32), session.id, now],
      );
      await client.query("COMMIT");
      return session.id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  let currentCode = firstCode.code;
  try {
    await t.test(
      "operator recovery requires genuine schema ownership and prior first setup; API cannot read or forge recovery history",
      async () => {
        const candidate = command("CREATE", randomUUID(), "0");
        await assert.rejects(
          recoverSuperAdmin(owner, candidate.input),
          /First Super Admin/,
        );
        await assert.rejects(
          recoverSuperAdmin(api, candidate.input),
          /schema-owner/,
        );
        await assert.rejects(
          operatorStaffOutcome(api, candidate.input.requestKey),
          /schema-owner/,
        );
        await assert.rejects(
          api.query("SELECT * FROM operator_staff_outcomes"),
          { code: "42501" },
        );
        await assert.rejects(
          api.query("INSERT INTO operator_staff_outcomes(id) VALUES($1)", [
            randomUUID(),
          ]),
          { code: "42501" },
        );
        await owner.query("GRANT CREATE ON SCHEMA public TO ingenium_api");
        try {
          await assert.rejects(
            recoverSuperAdmin(api, candidate.input),
            /schema-owner/,
          );
        } finally {
          await owner.query("REVOKE CREATE ON SCHEMA public FROM ingenium_api");
        }
        await firstSuperAdmin(owner, {
          requestKey: randomUUID(),
          staffId: firstId,
          credentialId: firstCredential,
          displayName: "Synthetic sole administrator",
          operator: "Synthetic operator",
          osUser: "synthetic-maintainer",
          reason: "Synthetic first setup",
          verifier: firstCode.verifier,
        });
      },
    );

    await t.test(
      "sole compromised-code rotation revokes sessions, proofs and deliveries atomically without clock clearance or a last-admin bypass",
      async () => {
        const old = await activate(currentCode);
        const pending = await entry.begin(currentCode, {
          ip: "127.0.0.1",
          browserId: randomUUID(),
        });
        const frozen = (await owner.query("SELECT * FROM clock_health")).rows;
        const candidate = command("ROTATE", firstId, await revision(firstId));
        assert.equal(
          (await recoverSuperAdmin(owner, candidate.input)).status,
          "APPLIED",
        );
        currentCode = candidate.code!;
        assert.equal(
          (
            await owner.query(
              "SELECT revoked_at IS NOT NULL AS revoked FROM staff_sessions WHERE id=$1",
              [old.session.session_id],
            )
          ).rows[0].revoked,
          true,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM staff_entry_flows WHERE staff_id=$1 AND state IN ('OPEN','ACTIVATED')",
              [firstId],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM staff_session_deliveries WHERE ciphertext IS NOT NULL",
            )
          ).rows[0].n,
          0,
        );
        await assert.rejects(staff.inspect(old.sessionCookie));
        if (pending.audience === "STAFF")
          await assert.rejects(
            staff.activate(pending.proofCookie, randomUUID()),
          );
        await assert.rejects(
          entry.begin(firstCode.code, {
            ip: "127.0.0.1",
            browserId: randomUUID(),
          }),
        );
        assert.deepEqual(
          (await owner.query("SELECT * FROM clock_health")).rows,
          frozen,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM staff_identities i JOIN access_credentials c ON c.staff_id=i.id WHERE i.role='SUPER_ADMIN' AND i.disabled_at IS NULL AND c.revoked_at IS NULL",
            )
          ).rows[0].n,
          1,
        );
        const entered = await activate(currentCode);
        assert.equal(
          (await staff.inspect(entered.sessionCookie)).role,
          "SUPER_ADMIN",
        );
      },
    );

    await t.test(
      "lost recovery acknowledgement and concurrent duplicate requests retain one issuance and reject changed intent",
      async () => {
        const candidate = command("ROTATE", firstId, await revision(firstId));
        const replies = await Promise.all([
          recoverSuperAdmin(owner, candidate.input),
          recoverSuperAdmin(owner, candidate.input),
        ]);
        assert.deepEqual(replies.map((r) => r.status).sort(), [
          "ALREADY_RECORDED",
          "APPLIED",
        ]);
        currentCode = candidate.code!;
        const recorded = await operatorStaffOutcome(
          owner,
          candidate.input.requestKey,
        );
        assert.equal(recorded.status, "RECORDED");
        assert.equal(
          recorded.outcome.credential_id,
          candidate.input.credentialId,
        );
        assert.equal(recorded.outcome.credential_current, true);
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM staff_credential_issues WHERE recovery_id=$1",
              [candidate.input.requestKey],
            )
          ).rows[0].n,
          1,
        );
        for (const patch of [
          { reason: "different" },
          { verifier: newAccessCode().verifier },
          { credentialId: randomUUID() },
          { expectedRevision: "0" },
        ])
          await assert.rejects(
            recoverSuperAdmin(owner, { ...candidate.input, ...patch }),
            /intent differs/,
          );
        assert.doesNotMatch(
          JSON.stringify(
            (await owner.query("SELECT * FROM operator_staff_outcomes")).rows,
          ),
          new RegExp(candidate.code!),
        );
        await assert.rejects(
          owner.query(
            "UPDATE operator_staff_outcomes SET reason='overwrite' WHERE id=$1",
            [candidate.input.requestKey],
          ),
          { code: "P0001" },
        );
        await assert.rejects(
          owner.query("DELETE FROM operator_staff_outcomes WHERE id=$1", [
            candidate.input.requestKey,
          ]),
          { code: "P0001" },
        );
        await assert.rejects(
          firstSuperAdmin(owner, {
            requestKey: randomUUID(),
            staffId: randomUUID(),
            credentialId: randomUUID(),
            displayName: "Synthetic no-rebootstrap",
            operator: "Synthetic operator",
            osUser: "synthetic-maintainer",
            reason: "Synthetic refusal",
            verifier: newAccessCode().verifier,
          }),
          /already provisioned/,
        );
      },
    );

    await t.test(
      "new backup must actually sign in before old Super Admin retirement; stale, self, expired and recovery-only sessions are refused",
      async () => {
        const backup = command("CREATE", randomUUID(), await revision());
        await recoverSuperAdmin(owner, backup.input);
        const retire = command("DISABLE", firstId, await revision(firstId));
        retire.input.replacementSessionId = randomUUID();
        await assert.rejects(
          recoverSuperAdmin(owner, retire.input),
          /verified replacement/,
        );
        const own = await activate(currentCode);
        retire.input.replacementSessionId = own.session.session_id;
        await assert.rejects(
          recoverSuperAdmin(owner, retire.input),
          /verified replacement/,
        );
        retire.input.replacementSessionId = await syntheticUnusableSession(
          "NORMAL",
          960000,
        );
        await assert.rejects(
          recoverSuperAdmin(owner, retire.input),
          /verified replacement/,
        );
        retire.input.replacementSessionId = await syntheticUnusableSession(
          "CLOCK_RECOVERY",
          0,
        );
        await assert.rejects(
          recoverSuperAdmin(owner, retire.input),
          /verified replacement/,
        );
        const next = await activate(backup.code!);
        retire.input.replacementSessionId = next.session.session_id;
        await assert.rejects(
          recoverSuperAdmin(owner, { ...retire.input, expectedRevision: "0" }),
          /Stale/,
        );
        await recoverSuperAdmin(owner, retire.input);
        await assert.rejects(staff.inspect(own.sessionCookie));
        assert.equal(
          (await staff.inspect(next.sessionCookie)).role,
          "SUPER_ADMIN",
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM access_credentials WHERE staff_id=$1 AND revoked_at IS NULL",
              [firstId],
            )
          ).rows[0].n,
          0,
        );
        const reset = command("ROTATE", firstId, await revision(firstId));
        await recoverSuperAdmin(owner, reset.input);
        currentCode = reset.code!;
        assert.equal(
          (await staff.inspect((await activate(currentCode)).sessionCookie))
            .role,
          "SUPER_ADMIN",
        );
        const management = createStaffManagement(api, clock, delivery);
        await assert.rejects(
          management.command(next.sessionCookie, {
            action: "ROTATE",
            targetId: firstId,
            requestKey: randomUUID(),
            expectedRevision: await revision(firstId),
            ownCode: backup.code,
            reason: "Synthetic panel cannot recover Super Admin",
            displayName: null,
            role: null,
            enabled: null,
          }),
        );
      },
    );

    await t.test(
      "simultaneous different rotations cannot both consume one target revision and old receipt is not current access",
      async () => {
        const version = await revision(firstId),
          a = command("ROTATE", firstId, version),
          b = command("ROTATE", firstId, version);
        const replies = await Promise.allSettled([
          recoverSuperAdmin(owner, a.input),
          recoverSuperAdmin(owner, b.input),
        ]);
        assert.equal(replies.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(replies.filter((r) => r.status === "rejected").length, 1);
        const winner = replies[0].status === "fulfilled" ? a : b,
          loser = winner === a ? b : a;
        assert.equal(
          (await operatorStaffOutcome(owner, loser.input.requestKey)).status,
          "NOT_OBSERVED",
        );
        assert.equal(
          (await operatorStaffOutcome(owner, winner.input.requestKey)).outcome
            .credential_current,
          true,
        );
        const next = command("ROTATE", firstId, await revision(firstId));
        await recoverSuperAdmin(owner, next.input);
        assert.equal(
          (await operatorStaffOutcome(owner, winner.input.requestKey)).outcome
            .credential_current,
          false,
        );
        assert.equal(
          (await recoverSuperAdmin(owner, winner.input)).status,
          "ALREADY_RECORDED",
        );
        assert.equal(
          (await operatorStaffOutcome(owner, next.input.requestKey)).outcome
            .credential_current,
          true,
        );
        currentCode = next.code!;
      },
    );

    await t.test(
      "concurrent mutual retirement cannot invalidate both verified replacement sessions",
      async () => {
        const a = command("CREATE", randomUUID(), await revision());
        await recoverSuperAdmin(owner, a.input);
        const b = command("CREATE", randomUUID(), await revision());
        await recoverSuperAdmin(owner, b.input);
        const sa = await activate(a.code!),
          sb = await activate(b.code!);
        const retireA = command("DISABLE", a.input.staffId, "1"),
          retireB = command("DISABLE", b.input.staffId, "1");
        retireA.input.replacementSessionId = sb.session.session_id;
        retireB.input.replacementSessionId = sa.session.session_id;
        const replies = await Promise.allSettled([
          recoverSuperAdmin(owner, retireA.input),
          recoverSuperAdmin(owner, retireB.input),
        ]);
        assert.equal(replies.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(replies.filter((r) => r.status === "rejected").length, 1);
        const survivor = replies[0].status === "fulfilled" ? sb : sa;
        assert.equal(
          (await staff.inspect(survivor.sessionCookie)).role,
          "SUPER_ADMIN",
        );
      },
    );

    await t.test(
      "recovery audit cannot be fabricated without its credential source and committed effect",
      async () => {
        const candidate = command("ROTATE", firstId, await revision(firstId));
        await recoverSuperAdmin(owner, candidate.input);
        currentCode = candidate.code!;
        await assert.rejects(
          owner.query(
            `INSERT INTO operator_staff_outcomes(id,action,staff_id,credential_id,replacement_session_id,expected_revision,fingerprint,
        operator,os_user,verification,reason,recorded_at,before_state,after_state)
        SELECT $1,action,staff_id,credential_id,replacement_session_id,expected_revision,fingerprint,operator,os_user,verification,reason,recorded_at,before_state,after_state
        FROM operator_staff_outcomes WHERE id=$2`,
            [randomUUID(), candidate.input.requestKey],
          ),
          { code: "P0001" },
        );
        assert.equal(
          (await operatorStaffOutcome(owner, candidate.input.requestKey))
            .outcome.credential_current,
          true,
        );
      },
    );

    await t.test(
      "invalid target and staff-capacity refusal preserve all credentials, receipts and last-admin protections",
      async () => {
        const outsider = randomUUID();
        await owner.query(
          "INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic ordinary owner','OWNER')",
          [outsider],
        );
        await assert.rejects(
          recoverSuperAdmin(owner, command("ROTATE", outsider, "0").input),
          /Invalid Super Admin/,
        );
        const n = (
          await owner.query(
            "SELECT count(*)::integer AS n FROM staff_identities WHERE disabled_at IS NULL",
          )
        ).rows[0].n;
        await owner.query(
          "INSERT INTO staff_identities(id,display_name,role) SELECT gen_random_uuid(),'Synthetic capacity organiser','ORGANISER' FROM generate_series(1,$1::integer)",
          [50 - n],
        );
        const before = (
          await owner.query(
            "SELECT id,verifier,revoked_at FROM access_credentials ORDER BY id",
          )
        ).rows;
        const full = command("CREATE", randomUUID(), await revision());
        await assert.rejects(recoverSuperAdmin(owner, full.input), /capacity/);
        assert.equal(
          (await operatorStaffOutcome(owner, full.input.requestKey)).status,
          "NOT_OBSERVED",
        );
        assert.deepEqual(
          (
            await owner.query(
              "SELECT id,verifier,revoked_at FROM access_credentials ORDER BY id",
            )
          ).rows,
          before,
        );
        const reset = command("ROTATE", firstId, await revision(firstId));
        await recoverSuperAdmin(owner, reset.input);
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM staff_identities WHERE disabled_at IS NULL",
            )
          ).rows[0].n,
          50,
        );
        assert.equal(
          (
            await api.query(
              "SELECT operator_staff_outcome_count()::integer AS n",
            )
          ).rows[0].n,
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM operator_staff_outcomes",
            )
          ).rows[0].n,
        );
        await migrateDatabase(ownerUrl.toString());
      },
    );
    await t.test(
      "operator credential recovery preserves a latched time incident and cannot turn a new code into normal access",
      async () => {
        const runtime = randomUUID(),
          boot = randomUUID();
        await owner.query(
          "INSERT INTO clock_runs(id,boot_id,started_observed_at) VALUES($1,$2,date_trunc('milliseconds',clock_timestamp()))",
          [runtime, boot],
        );
        await owner.query(
          "UPDATE clock_health SET runtime_id=$1,boot_id=$2,fault_latched=true,fault_generation=1,fault_reason='CLOCK_REVERSED',state='FAULT' WHERE id=1",
          [runtime, boot],
        );
        const before = (await owner.query("SELECT * FROM clock_health")).rows;
        const candidate = command("ROTATE", firstId, await revision(firstId));
        await recoverSuperAdmin(owner, candidate.input);
        assert.deepEqual(
          (await owner.query("SELECT * FROM clock_health")).rows,
          before,
        );
        const blockedClock = {
          ...clock,
          assertHealthy() {
            throw new AccessError("CLOCK_UNTRUSTED");
          },
        };
        await assert.rejects(
          createEntryService(api, blockedClock, delivery).begin(
            candidate.code!,
            { ip: "127.0.0.1", browserId: randomUUID() },
          ),
          (e) => e instanceof AccessError && e.code === "CLOCK_UNTRUSTED",
        );
        const flow = await createStaffService(
          api,
          blockedClock,
          delivery,
          clock,
        ).beginRecovery(candidate.code!, {
          ip: "127.0.0.1",
          browserId: randomUUID(),
        });
        assert.equal(flow.audience, "STAFF");
        if (flow.audience === "STAFF")
          assert.equal(flow.mode, "CLOCK_RECOVERY");
        const disabled = command("DISABLE", firstId, await revision(firstId));
        disabled.input.replacementSessionId = randomUUID();
        await assert.rejects(
          recoverSuperAdmin(owner, disabled.input),
          /Repair the time incident/,
        );
        assert.equal(
          (
            await owner.query(
              "SELECT count(*)::integer AS n FROM clock_clearances",
            )
          ).rows[0].n,
          0,
        );
      },
    );
  } finally {
    await api.end();
    await owner.end();
  }
  await staffRecoveryLinuxChecks(
    t,
    ownerConnection,
    apiConnection,
    databaseContainer,
  );
}
