import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { backupDocker } from "./backup-fixture.js";
import type { BackupFixture } from "./backup-fixture.js";

export async function backupChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1],
  lab: { fixture: BackupFixture; container: string },
) {
  const { fixture: f, container } = lab;
  const source = (...args: string[]) =>
      backupDocker(["exec", container, ...args], 120000),
    backrest = (...args: string[]) =>
      source("pgbackrest", "--stanza=ingenium", ...args),
    query = async (sql: string, args: unknown[] = []) =>
      (await c.owner.query(sql, args)).rows;
  const a = await c.newRound();
  await c.budgets();
  await c.judge.claim();
  const receipt = await c.service.submit(
      a.aa,
      a.round,
      a.x,
      "// Synthetic encrypted backup source\n",
      randomUUID(),
    ),
    id = receipt.result.submission_id as string;
  assert.equal(receipt.result.status, "ADMITTED");
  c.answers.set(id, "PASSED");
  for (
    let n = 0;
    n < 150 &&
    !(
      await query("SELECT completed_at FROM participant_judging WHERE id=$1", [
        id,
      ])
    )[0].completed_at;
    n++
  )
    await c.judge.tick();
  assert.ok(
    (
      await query("SELECT completed_at FROM participant_judging WHERE id=$1", [
        id,
      ])
    )[0].completed_at,
  );
  await c.budgets();
  await c.service.buyHint(a.aa, a.round, a.y, 1, randomUUID());
  for (const action of ["CLOSE", "FINALISE"] as const) {
    await c.budgets();
    await c.service.command(c.staff.sessionCookie, {
      action,
      roundId: a.round,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM rounds WHERE id=$1", [a.round])
      )[0].revision,
      payload: {},
      ownCode: c.staff.code,
      reason: "Synthetic backup result fixture",
    });
  }
  const marker = randomBytes(32).toString("hex"),
    database = (await query("SELECT current_database() name"))[0]
      .name as string;
  assert.match(database, /^ingenium_competition_[0-9a-f]{32}$/);
  await query(
    "CREATE TABLE public.backup_drill_markers (phase integer PRIMARY KEY, marker text NOT NULL)",
  );
  let info: any,
    lastLabel = "",
    targetLsn = "",
    expected: unknown;
  const rows =
    await query(`SELECT format('SELECT %L name,count(*)::integer n,encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E''\\n'' ORDER BY to_jsonb(t)::text),''''),''UTF8'')),''hex'') digest FROM %I.%I t',
    n.nspname||'.'||c.relname,n.nspname,c.relname) sql FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','drizzle') AND c.relkind='r' ORDER BY n.nspname,c.relname`);
  const fingerprintSql = `SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name) FROM (${rows.map((r) => r.sql).join(" UNION ALL ")}) f`;
  let restored: string | undefined;
  const guardSql = `SELECT encode(sha256(convert_to(string_agg(definition,E'\n' ORDER BY definition),'UTF8')),'hex') hash FROM (
    SELECT pg_get_functiondef(p.oid)||COALESCE(p.proacl::text,'') definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    UNION ALL SELECT pg_get_triggerdef(t.oid)||t.tgenabled::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    UNION ALL SELECT pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='public') d`;
  const expectedGuards = (await query(guardSql))[0].hash;
  const verified = { chain: false, wal: false, refusals: false };
  try {
    await t.test(
      "full, differential and incremental physical backups retain one encrypted dependency chain",
      async () => {
        assert.equal(
          await source("pgbackrest", "version"),
          "pgBackRest 2.59.3",
        );
        assert.equal(
          (await query("SHOW archive_timeout"))[0].archive_timeout,
          "1min",
        );
        assert.equal((await query("SHOW archive_mode"))[0].archive_mode, "on");
        assert.equal(
          (await query("SHOW data_checksums"))[0].data_checksums,
          "on",
        );
        await backrest("check");
        for (const [index, type] of ["full", "diff", "incr"].entries()) {
          await query("INSERT INTO backup_drill_markers VALUES($1,$2)", [
            index,
            marker,
          ]);
          await backrest(`--type=${type}`, "backup");
        }
        info = JSON.parse(await backrest("--output=json", "info"))[0];
        assert.equal(info.name, "ingenium");
        assert.equal(info.status.code, 0);
        assert.equal(info.cipher, "aes-256-cbc");
        assert.deepEqual(info.backup.map((b: any) => b.type).sort(), [
          "diff",
          "full",
          "incr",
        ]);
        lastLabel = info.backup.at(-1).label;
        assert.match(lastLabel, /^\d{8}-\d{6}F_\d{8}-\d{6}I$/);
        assert.ok(info.backup.at(-1).reference.length >= 1);
        const header = await source(
          "sh",
          "-ec",
          "head -c 8 /backup-repository/backup/ingenium/backup.info",
        );
        assert.equal(header, "Salted__");
        verified.chain = true;
      },
    );
    await t.test(
      "a committed WAL-only tail is archived without changing any competition data",
      async () => {
        await query("INSERT INTO backup_drill_markers VALUES(3,$1)", [marker]);
        targetLsn = (await query("SELECT pg_current_wal_flush_lsn() lsn"))[0]
          .lsn;
        assert.match(targetLsn, /^[0-9A-F]+\/[0-9A-F]+$/);
        await query("SELECT pg_switch_wal()");
        await backrest("check");
        expected = (await query(fingerprintSql))[0].jsonb_agg;
        await query("INSERT INTO backup_drill_markers VALUES(4,$1)", [
          `AFTER_TARGET_${marker}`,
        ]);
        await query("SELECT pg_switch_wal()");
        await backrest("check");
        assert.ok(
          (expected as { name: string; n: number }[]).some(
            (row) => row.name === "public.round_results" && row.n > 0,
          ),
        );
        assert.ok(
          (expected as { name: string; n: number }[]).some(
            (row) => row.name === "public.bounty_awards" && row.n > 0,
          ),
        );
        assert.ok(
          (expected as { name: string; n: number }[]).some(
            (row) => row.name === "public.hint_purchases" && row.n > 0,
          ),
        );
        const errors = (
          await query(
            "SELECT failed_count,last_archived_wal FROM pg_stat_archiver",
          )
        )[0];
        assert.ok(errors.last_archived_wal);
        verified.wal = true;
      },
    );
    await t.test(
      "restoration rejects a wrong key and a modified encrypted manifest without touching the original repository",
      async () => {
        restored = await backupDocker([
          "create",
          "--pull=never",
          "--name",
          `ingenium-backup-restore-${f.nonce}`,
          "--label",
          `ingenium.backup-test=${f.nonce}`,
          "--network=none",
          "--restart=no",
          "--read-only",
          "--user=999:999",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges:true",
          "--memory=768m",
          "--memory-swap=768m",
          "--cpus=1",
          "--pids-limit=128",
          "--tmpfs",
          "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=512m,uid=999,gid=999,mode=0700",
          "--tmpfs",
          "/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700",
          "--tmpfs",
          "/tmp:rw,nosuid,nodev,noexec,size=128m,uid=999,gid=999,mode=0700",
          ...f.mounts(true),
          "--log-driver=none",
          "--entrypoint=sleep",
          f.image,
          "infinity",
        ]);
        assert.match(restored, /^[0-9a-f]{64}$/);
        await backupDocker(["start", restored]);
        const rawWrongInfo = await backupDocker([
          "exec",
          restored,
          "pgbackrest",
          "--config=/etc/pgbackrest/wrong-key.conf",
          "--stanza=ingenium",
          "--output=json",
          "info",
        ]);
        let wrongInfo: any;
        try {
          wrongInfo = JSON.parse(rawWrongInfo)[0];
        } catch (error) {
          assert.ok(error instanceof SyntaxError);
        } // Malformed error JSON is unavailable, never a healthy inventory.
        if (wrongInfo) {
          assert.notEqual(
            wrongInfo.status.code,
            0,
            "A successful process exit cannot certify an encrypted repository.",
          );
          assert.equal(wrongInfo.backup.length, 0);
        }
        await assert.rejects(
          backupDocker([
            "exec",
            restored,
            "pgbackrest",
            "--config=/etc/pgbackrest/wrong-key.conf",
            "--stanza=ingenium",
            "--pg1-path=/tmp/wrong-key-target",
            `--set=${lastLabel}`,
            "--type=immediate",
            "restore",
          ]),
          (error: any) =>
            /\[075\]: backup set .* is not valid/.test(String(error.stderr)),
        );
        await backupDocker([
          "exec",
          restored,
          "sh",
          "-ec",
          `cp -a /backup-repository /tmp/damaged-repository; printf BROKEN > /tmp/damaged-repository/backup/ingenium/${lastLabel}/backup.manifest; if test -f /tmp/damaged-repository/backup/ingenium/${lastLabel}/backup.manifest.copy; then printf BROKEN > /tmp/damaged-repository/backup/ingenium/${lastLabel}/backup.manifest.copy; fi`,
        ]);
        await assert.rejects(
          backupDocker([
            "exec",
            restored,
            "pgbackrest",
            "--stanza=ingenium",
            "--repo1-path=/tmp/damaged-repository",
            "--pg1-path=/tmp/refused-target",
            `--set=${lastLabel}`,
            "--type=immediate",
            "restore",
          ]),
          (error: any) =>
            /backup\.manifest|cipher|decrypt|checksum/i.test(
              String(error.stderr),
            ),
        );
        assert.deepEqual(
          JSON.parse(await backrest("--output=json", "info"))[0].backup,
          info.backup,
        );
        verified.refusals = true;
      },
    );
    await t.test(
      "an isolated restore replays the exact WAL target and preserves every application table without resuming the arena",
      async () => {
        assert.ok(restored && targetLsn && expected && lastLabel);
        const began = performance.now();
        await backupDocker(
          [
            "exec",
            restored,
            "pgbackrest",
            "--stanza=ingenium",
            `--set=${lastLabel}`,
            "--type=lsn",
            `--target=${targetLsn}`,
            "--target-action=promote",
            "--archive-mode=off",
            "restore",
          ],
          120000,
        );
        await backupDocker(
          [
            "exec",
            restored,
            "pg_ctl",
            "-D",
            "/var/lib/postgresql/data",
            "-l",
            "/tmp/restored-postgres.log",
            "-w",
            "start",
            "-o",
            "-c listen_addresses='' -c archive_mode=off -c unix_socket_directories='/var/run/postgresql' -c shared_buffers=64MB",
          ],
          120000,
        );
        const restoredSql = (sql: string) =>
          backupDocker([
            "exec",
            restored!,
            "psql",
            "-XAt",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "ingenium_schema_owner",
            "-d",
            database,
            "-c",
            sql,
          ]);
        assert.deepEqual(
          JSON.parse(await restoredSql(fingerprintSql)),
          expected,
        );
        assert.equal(await restoredSql(guardSql), expectedGuards);
        assert.equal(
          await restoredSql("SELECT count(*) FROM backup_drill_markers"),
          "4",
        );
        assert.equal(await restoredSql("SHOW archive_mode"), "off");
        assert.equal(await restoredSql("SHOW listen_addresses"), "");
        assert.equal(await restoredSql("SELECT pg_is_in_recovery()"), "f");
        await assert.rejects(
          restoredSql(
            "SET ROLE ingenium_api; CREATE TABLE forbidden_restore_write(id integer)",
          ),
          (error: any) => /permission denied/i.test(String(error.stderr)),
        );
        const state = JSON.parse(
          await backupDocker(["inspect", restored, "--format", "{{json .}}"]),
        );
        assert.equal(state.HostConfig.NetworkMode, "none");
        assert.deepEqual(state.HostConfig.PortBindings, {});
        assert.equal(state.HostConfig.RestartPolicy.Name, "no");
        assert.equal(state.Config.User, "999:999");
        assert.equal(
          state.Mounts.find((m: any) => m.Destination === "/backup-repository")
            .RW,
          false,
        );
        const restoreMs = Math.round(performance.now() - began);
        const quarantineKey = randomUUID();
        const quarantine = JSON.parse(
          await restoredSql(`SELECT quarantine_restored_database('${quarantineKey}',
          'isolated-physical-drill-target','Synthetic operator','fixture','Physical restore access invalidation drill')`),
        );
        assert.equal(quarantine.state, "QUARANTINED");
        assert.equal(quarantine.admission_authorised, false);
        assert.ok(quarantine.effects.participant_sessions > 0);
        assert.ok(quarantine.effects.staff_sessions > 0);
        assert.ok(quarantine.effects.judge_epochs > 0);
        assert.equal(await restoredSql("SELECT restore_is_quarantined()"), "t");
        assert.equal(
          await restoredSql(
            "SELECT count(*) FROM participant_sessions WHERE revoked_at IS NULL",
          ),
          "0",
        );
        assert.equal(
          await restoredSql(
            "SELECT count(*) FROM staff_sessions WHERE revoked_at IS NULL",
          ),
          "0",
        );
        assert.equal(
          await restoredSql(
            "SELECT count(*) FROM judge_host_epochs WHERE state='ACTIVE'",
          ),
          "0",
        );
        await assert.rejects(
          restoredSql(
            "SET ROLE ingenium_api; SELECT * FROM lock_arena_control(true)",
          ),
          (error: any) => /Restore quarantine/.test(String(error.stderr)),
        );
        assert.equal(
          (await query("SELECT restore_is_quarantined() AS q"))[0].q,
          false,
          "The restore command must never mutate the original database.",
        );
        const proof = {
          schema_version: 1,
          run_id: f.nonce,
          state: "PASSED",
          environment: "DISPOSABLE_LOCAL_DRILL",
          postgres: "17.11",
          pgbackrest: "2.59.3",
          image: f.image,
          cipher: "aes-256-cbc",
          backup_set: lastLabel,
          target_lsn: targetLsn,
          application_tables: (expected as { name: string }[]).filter(
            (row) =>
              row.name.startsWith("public.") &&
              row.name !== "public.backup_drill_markers",
          ).length,
          migration_tables: (expected as { name: string }[]).filter((row) =>
            row.name.startsWith("drizzle."),
          ).length,
          probe_tables: 1,
          restore_ms: restoreMs,
          all_table_fingerprints_equal: true,
          guard_definitions_equal: true,
          post_target_marker_excluded: true,
          restore_quarantine_request: quarantineKey,
          restored_access_invalidated: true,
          restored_epochs_quarantined: true,
          physical_fencing_verified: false,
          network: "none",
          admission_authorised: false,
          off_host_verified: false,
        };
        assert.ok(
          verified.chain && verified.wal && verified.refusals,
          "Do not save a completed proof after an earlier failed subcheck.",
        );
        await mkdir(
          fileURLToPath(new URL("../../test-results/", import.meta.url)),
          { recursive: true },
        );
        await writeFile(
          fileURLToPath(
            new URL("../../test-results/backup-drill.json", import.meta.url),
          ),
          JSON.stringify(proof, null, 2) + "\n",
        );
      },
    );
  } finally {
    if (restored) {
      assert.equal(
        await backupDocker([
          "inspect",
          restored,
          "--format",
          '{{index .Config.Labels "ingenium.backup-test"}}',
        ]),
        f.nonce,
      );
      await backupDocker(["rm", "--force", "--volumes", restored]);
    }
  }
}
