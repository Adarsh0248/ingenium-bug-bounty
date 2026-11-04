import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { lstat,mkdir,readFile,writeFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout } from "node:timers/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Client, Pool } from "pg";
import { migrateDatabase, migrationsFolder } from "../../src/db/migrate.js";
import { teamMembers, teams } from "../../src/db/schema.js";
import { accessChecks } from "./access.checks.js";
import { clockChecks } from "./clock.checks.js";
import { staffChecks } from "./staff.checks.js";
import { staffManagementChecks } from "./staff-management.checks.js";
import { staffRecoveryChecks } from "./staff-recovery.checks.js";
import { teamManagementChecks } from "./team-management.checks.js";
import { registrationImportChecks } from "./registration-import.checks.js";
import { arenaChecks } from "./arena.checks.js";
import { contentChecks } from "./content.checks.js";
import { validationChecks } from "./validation.checks.js";
import { judgeGatewayChecks } from "./judge-gateway.checks.js";
import { competitionChecks } from "./competition.checks.js";
import { backupFixture, backupDocker } from "./backup-fixture.js";
import { staffRecoveryLinuxChecks } from "./staff-recovery-linux.checks.js";
import { linuxLoadChecks } from "./load-linux.checks.js";
import {runLocalRoundFlow} from "../fixtures/host-round-flow.js";
import {eventPackChecks} from "./event-packs.checks.js";
import {eventImportChecks} from "./event-import.checks.js";
import type {RuntimeManifestFixture} from "../fixtures/host-round-flow.js";
import {createAuthoringJudgeDriver} from "../../src/content/judge-driver.js";
import type {JudgeDriverSettings} from "../../src/content/judge-driver.js";
import {LANGUAGES} from "../../src/access/credentials.js";
import type {Language} from "../../src/access/credentials.js";
import {acceptJudgeReply} from "../../src/content/judge-protocol.js";
import {judgeReply} from "../fixtures/judge.js";
import type {TrustedAuthoringDriver} from "../../src/content/execution-policy.js";

const exec = promisify(execFile);
const IMAGE = "postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";
const roleScript = fileURLToPath(new URL("../../../../infra/postgres/01-api-role.sql", import.meta.url));

async function docker(args: string[], environment = process.env): Promise<string> {
  const result = await exec("docker", args, { env: environment, timeout: 30000, maxBuffer: 1048576, windowsHide: true });
  return result.stdout.trim();
}

async function waitForDatabase(connectionString: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 500, query_timeout: 1000 });
    try {
      await client.connect();
      await client.query("SELECT 1");
      return;
    } catch {
      await setTimeout(500);
    } finally {
      await client.end();
    }
  }
  throw new Error("The disposable PostgreSQL test database did not become ready.");
}

// The complete matrix includes real 150-second cooldown and 45-second expiry checks; operation limits are unchanged.
test("registration migrations work on isolated PostgreSQL and preserve their constraints on repeat application", { timeout: process.env.INGENIUM_TEST_SUITE === "load-soak-linux" ? 4300000 : process.env.INGENIUM_TEST_SUITE?.includes("compiler-burst") ? 1700000 : 900000 }, async (t) => {
  assert.equal((await lstat(roleScript)).isFile(), true, "The reviewed role script must be a regular file before mounting it.");
  const nonce = randomUUID();
  const password = randomBytes(24).toString("hex");
  const apiPassword = randomBytes(24).toString("hex");
  const backup = process.env.INGENIUM_TEST_SUITE === "backup" ? await backupFixture() : undefined;
  if (backup) t.after(() => backup.close());
  const selectedImage = backup?.image ?? IMAGE;
  // Isolated feature databases share this bounded tmpfs, including migration WAL.
  const container = await docker(["create", "--pull=never", "--name", `ingenium-schema-test-${nonce}`,
    "--label", `ingenium.schema-test=${nonce}`, "--restart", "no", "--read-only", "--user", "999:999", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges=true", "--memory", "768m", "--memory-swap", "768m", "--cpus", "1", "--pids-limit", "128",
    "--publish", "127.0.0.1::5432", "--env", "POSTGRES_USER=ingenium_schema_owner", "--env", "POSTGRES_DB=ingenium_schema_test",
    "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_API_PASSWORD",
    "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=512m,uid=999,gid=999,mode=0700",
    "--tmpfs", "/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700",
    "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700",
    "--mount", `type=bind,src=${roleScript},dst=/docker-entrypoint-initdb.d/01-api-role.sql,readonly`,
    "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1",
    ...(backup ? ["--env", "POSTGRES_INITDB_ARGS=--data-checksums", ...backup.mounts()] : []), selectedImage,
    ...(backup ? ["postgres", "-c", "config_file=/etc/ingenium-backup/postgresql.conf", "-c", "listen_addresses=*", "-c", "max_wal_size=64MB", "-c", "shared_buffers=64MB"] : ["load","load-linux","load-soak-linux","race-load","race-load-linux"].includes(process.env.INGENIUM_TEST_SUITE ?? "") ? ["postgres", "-c", "max_connections=40", "-c", "track_functions=all", "-c", "track_commit_timestamp=on"] : [])],
  { ...process.env, POSTGRES_PASSWORD: password, POSTGRES_API_PASSWORD: apiPassword });
  assert.match(container, /^[a-f0-9]{64}$/);
  let owner: Pool | undefined;
  let api: Pool | undefined;
  let preserveRealFlow=false;
  try {
    await docker(["start", container]);
    const port = await docker(["inspect", "--format", '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', container]);
    assert.match(port, /^[1-9]\d{0,4}$/);
    const url = new URL(`postgresql://127.0.0.1:${port}/ingenium_schema_test`);
    url.username = "ingenium_schema_owner";
    url.password = password;
    try {
      await waitForDatabase(url.toString());
    } catch {
      const logs = await exec("docker", ["logs", "--tail", "40", container], { timeout: 10000, maxBuffer: 32768, windowsHide: true });
      const diagnostic = (logs.stdout + logs.stderr).replaceAll(password, "[redacted]").replaceAll(apiPassword, "[redacted]");
      throw new Error(`The disposable PostgreSQL test database did not become ready. Startup log:\n${diagnostic}`);
    }
    const ownerUrl = url.toString();
    if (backup) await backupDocker(["exec", container, "pgbackrest", "--stanza=ingenium", "stanza-create"]);
    owner = new Pool({ connectionString: ownerUrl, max: 2, connectionTimeoutMillis: 2000, statement_timeout: 5000 });
    await migrateDatabase(ownerUrl).catch(error=>{console.error({migration_error:error.cause?.message,where:error.cause?.where,position:error.cause?.position});throw error;});
    const db = drizzle(owner);
    url.username = "ingenium_api";
    url.password = apiPassword;
    const apiUrl = url.toString();
    api = new Pool({ connectionString: apiUrl, max: 4, connectionTimeoutMillis: 2000 });
    if(process.env.INGENIUM_TEST_SUITE==='event-packs'){await eventPackChecks(t,owner,api);return;}
    if(process.env.INGENIUM_TEST_SUITE==='event-import'){await eventImportChecks(t,owner,api);return;}
    if(process.env.INGENIUM_TEST_SUITE==="event-capacity"){
      await t.test("event capacity preserves existing slots, refuses a seventeenth slot and stays owner-only",async()=>{
        const before=(await owner!.query("SELECT * FROM execution_capacity_slots ORDER BY id")).rows;
        assert.equal(before.length,2);
        await assert.rejects(api!.query("INSERT INTO execution_capacity_slots(id) VALUES(3)"),{code:"42501"});
        const script=await readFile(fileURLToPath(new URL("../../../../infra/app-host/event-capacity.sql",import.meta.url)),"utf8");
        await owner!.query(script);await owner!.query(script);
        const after=(await owner!.query("SELECT * FROM execution_capacity_slots ORDER BY id")).rows;
        assert.deepEqual(after.slice(0,2),before);assert.deepEqual(after.map(s=>s.id),Array.from({length:16},(_,i)=>i+1));
        await owner!.query("UPDATE judge_control SET id=id WHERE id=1");
        await assert.rejects(owner!.query("DELETE FROM execution_capacity_slots WHERE id=16"),{code:"P0001"});
        assert.equal((await owner!.query("SELECT count(*)::int n FROM execution_capacity_slots")).rows[0].n,16);
        await assert.rejects(owner!.query("INSERT INTO execution_capacity_slots(id) VALUES(17)"),{code:"23514"});
      });return;
    }
    if(["real-round-flow","round-flow-preflight","real-compiler-burst","compiler-burst-preflight","real-batch-burst","batch-burst-preflight"].includes(process.env.INGENIUM_TEST_SUITE??"")){
      const batch=['real-batch-burst','batch-burst-preflight'].includes(process.env.INGENIUM_TEST_SUITE??'');
      const mode=process.env.INGENIUM_TEST_SUITE==="real-round-flow"?"REAL":["real-compiler-burst","real-batch-burst"].includes(process.env.INGENIUM_TEST_SUITE??'')?"REAL_BURST":["compiler-burst-preflight","batch-burst-preflight"].includes(process.env.INGENIUM_TEST_SUITE??'')?"SYNTHETIC_BURST":"SYNTHETIC_PREFLIGHT";
      let driver:TrustedAuthoringDriver,manifests:RuntimeManifestFixture[];
      if(mode==="REAL"||mode==="REAL_BURST"){
        const path=process.env.INGENIUM_REAL_JUDGE_FIXTURE;assert.ok(path,"The one-use private test bridge descriptor is required.");
        const bytes=await readFile(path);assert.ok(bytes.length<65536);
        const raw=JSON.parse(bytes.toString("utf8")) as Omit<JudgeDriverSettings,"runtimes"|"ca"|"certificate"|"privateKey">&{runtimes:[Language,{key:string;digest:string}][];ca:string;certificate:string;privateKey:string;manifests:RuntimeManifestFixture[]};
        driver=createAuthoringJudgeDriver({...raw,runtimes:new Map(raw.runtimes),ca:Buffer.from(raw.ca),certificate:Buffer.from(raw.certificate),privateKey:Buffer.from(raw.privateKey)});manifests=raw.manifests;
      }else{
        manifests=await Promise.all(LANGUAGES.map(async language=>{const manifest={synthetic_round_preflight:language},digest=(await owner!.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') digest",[JSON.stringify(manifest)])).rows[0].digest;return {language,key:`preflight-${language}`,digest,manifest};}));
        driver={hostEpochId:randomUUID(),endpointRef:"synthetic-round-preflight",runtimes:new Map(manifests.map(row=>[row.language,{key:row.key,digest:row.digest}])),async assertReady(){},async submit(p){const nonce=randomUUID(),stdout=Buffer.from(p.source.toString().includes("a+b+1")?"13\n":"12\n");return acceptJudgeReply(judgeReply(p,nonce,stdout),p,nonce,200);},async observe(p){return this.submit(p,new AbortController().signal);}};
      }
      if(batch&&mode==='SYNTHETIC_BURST'){const {syntheticBatchDriver}=await import('../fixtures/batch-driver.js');driver=syntheticBatchDriver(driver);}
      const directory=fileURLToPath(new URL(`../../test-results/real-round-flow-${nonce}/`,import.meta.url));await mkdir(directory,{mode:0o700});
      preserveRealFlow=true;
      await t.test(`${mode}: local isolated application database`,{timeout:mode.endsWith("BURST")?1500000:600000},()=>runLocalRoundFlow(ownerUrl,apiUrl,driver,manifests,mode,async(name,value)=>{assert.match(name,/^[a-z-]+$/);await writeFile(`${directory}/${name}.json`,JSON.stringify(value)+"\n",{flag:"wx",mode:0o600});},batch?15:100,batch));
      // Node's subtest failure is recorded on the context rather than rethrown by t.test.
      preserveRealFlow=!(await lstat(`${directory}/completed.json`).then(()=>true,()=>false));
      return;
    }
    if(process.env.INGENIUM_TEST_SUITE === "load-linux") { await linuxLoadChecks(t, ownerUrl, apiUrl, container); return; }
    if(process.env.INGENIUM_TEST_SUITE === "load-soak-linux") { await linuxLoadChecks(t, ownerUrl, apiUrl, container, "load-soak"); return; }
    if(process.env.INGENIUM_TEST_SUITE === "race-load-linux") { await linuxLoadChecks(t, ownerUrl, apiUrl, container, "race-load"); return; }
    if(process.env.INGENIUM_TEST_SUITE === "operations-linux") { await staffRecoveryLinuxChecks(t, ownerUrl, apiUrl, container, "operations"); return; }
    if(process.env.INGENIUM_TEST_SUITE === "staff-recovery-linux") { await staffRecoveryLinuxChecks(t, ownerUrl, apiUrl, container); return; }
    if(process.env.INGENIUM_TEST_SUITE==="staff-recovery"){await staffRecoveryChecks(t,ownerUrl,apiUrl,container);return;}
    if(process.env.INGENIUM_TEST_SUITE==="staff-management"){await staffManagementChecks(t,ownerUrl,apiUrl);return;}
    if(process.env.INGENIUM_TEST_SUITE==="content"){await contentChecks(t,ownerUrl,apiUrl);return;}
    if (["clock","worker-clock","clock-browser"].includes(process.env.INGENIUM_TEST_SUITE ?? "")) { await clockChecks(t,ownerUrl,apiUrl); return; }
    if(["worker-validation","diagnostics","diagnostics-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){await validationChecks(t,ownerUrl,apiUrl);return;}
    if(process.env.INGENIUM_TEST_SUITE==="imports"){await registrationImportChecks(t,ownerUrl,apiUrl);return;}
    if(process.env.INGENIUM_TEST_SUITE==="teams"){await teamManagementChecks(t,ownerUrl,apiUrl);return;}
    if(["reports","reward-boost","shop"].includes(process.env.INGENIUM_TEST_SUITE??"")){await competitionChecks(t,ownerUrl,apiUrl);return;}
    if(process.env.INGENIUM_TEST_SUITE==="judge-supervisor"){await judgeGatewayChecks(t,ownerUrl);return;}
    if (["live-questions", "live-questions-browser", "hundred-bounties", "load", "load-soak", "race-load", "operations", "operations-browser", "restore", "backup", "https", "competition", "worker", "maintenance", "participant-batch", "participant", "live", "workbench", "history", "history-browser", "judging", "judging-browser", "review", "review-browser", "audit", "audit-browser", "announcements", "announcements-browser", "team-access", "team-access-browser", "results", "results-browser", "retention", "admin-browser", "browser", "registration-browser", "discipline", "discipline-browser", "cancellation", "cancellation-browser"].includes(process.env.INGENIUM_TEST_SUITE ?? "")) { await competitionChecks(t, ownerUrl, apiUrl, backup ? { fixture: backup, container } : undefined); return; }
    if (process.env.INGENIUM_TEST_SUITE !== "foundation") {
      await teamManagementChecks(t,ownerUrl,apiUrl);
      await registrationImportChecks(t,ownerUrl,apiUrl);
      await judgeGatewayChecks(t, ownerUrl);
      await competitionChecks(t, ownerUrl, apiUrl);
    }

    await t.test("names are labels, members have stable UUIDs and exactly two distinct positions", async () => {
      const first = await db.insert(teams).values({ displayName: "Same team label" }).returning();
      const second = await db.insert(teams).values({ displayName: "Same team label" }).returning();
      const team = first[0];
      assert.ok(team && second[0]);
      assert.notEqual(team.id, second[0].id);
      assert.match(team.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const members = await db.insert(teamMembers).values([
        { teamId: team.id, position: 1, displayName: "Same member label" },
        { teamId: team.id, position: 2, displayName: "Same member label" },
      ]).returning();
      assert.equal(members.length, 2);
      assert.notEqual(members[0]?.id, members[1]?.id);
      await assert.rejects(owner!.query("INSERT INTO team_members (id, team_id, position, display_name) VALUES ($1, $2, 1, 'Duplicate slot')", [randomUUID(), team.id]), { code: "23505" });
      for (const position of [0, 3]) {
        await assert.rejects(owner!.query("INSERT INTO team_members (id, team_id, position, display_name) VALUES ($1, $2, $3, 'Third member')", [randomUUID(), team.id, position]), { code: "23514" });
      }
      await assert.rejects(owner!.query("INSERT INTO team_members (id, team_id, position, display_name) VALUES ($1, $2, 1, 'Orphan')", [randomUUID(), randomUUID()]), { code: "23503" });
      await assert.rejects(owner!.query("DELETE FROM teams WHERE id = $1", [team.id]), { code: "23503" });
    });

    await t.test("name limits count UTF-8 bytes rather than JavaScript characters", async () => {
      const unicodeName = String.fromCodePoint(0x00e9).repeat(60);
      await db.insert(teams).values({ displayName: unicodeName });
      for (const name of ["", "   ", "x".repeat(121), unicodeName + "x"]) {
        await assert.rejects(owner!.query("INSERT INTO teams (id, display_name) VALUES ($1, $2)", [randomUUID(), name]), { code: "23514" });
      }
      await assert.rejects(owner!.query("INSERT INTO teams (id, display_name) VALUES ($1, $2)", [randomUUID(), "name\u0000invalid"]), { code: "22021" });
      const result = await owner!.query("SELECT bool_and(created_at = date_trunc('milliseconds', created_at)) AS precise FROM teams");
      assert.equal(result.rows[0].precise, true);
    });

    await t.test("repeat migrations preserve rows and the runtime role cannot migrate or provision registrations", async () => {
      const before = await owner!.query("SELECT count(*)::integer AS count FROM teams");
      await migrateDatabase(ownerUrl);
      assert.deepEqual((await owner!.query("SELECT count(*)::integer AS count FROM teams")).rows, before.rows);
      assert.equal((await owner!.query("SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations")).rows[0].count, readMigrationFiles({ migrationsFolder }).length);
      assert.equal((await api!.query("SELECT 1 AS ready")).rows[0].ready, 1);
      await assert.rejects(api!.query("INSERT INTO teams (id,display_name) VALUES ($1,'Unauthorised registration')", [randomUUID()]), { code: "42501" });
      await assert.rejects(api!.query("CREATE TABLE must_not_exist (id integer)"), { code: "42501" });
      await assert.rejects(migrateDatabase(apiUrl), /Schema-owner privileges are required/);
    });

    await t.test("a competing migration cannot acquire the same session lock", async () => {
      const lock = await owner!.connect();
      try {
        await lock.query("SELECT pg_advisory_lock(187031, 1)");
        await assert.rejects(migrateDatabase(ownerUrl), /Another schema migration is already running/);
      } finally {
        await lock.query("SELECT pg_advisory_unlock(187031, 1)");
        lock.release();
      }
      await migrateDatabase(ownerUrl);
    });

    await t.test("a failed migration rolls back new tables without deleting pre-existing data", async () => {
      await owner!.query("CREATE DATABASE ingenium_schema_failure");
      const failureUrl = new URL(ownerUrl);
      failureUrl.pathname = "/ingenium_schema_failure";
      const client = new Client({ connectionString: failureUrl.toString(), connectionTimeoutMillis: 2000 });
      await client.connect();
      try {
        await client.query("CREATE TABLE teams (id integer PRIMARY KEY); INSERT INTO teams VALUES (42)");
        await assert.rejects(migrateDatabase(failureUrl.toString()), (error: unknown) => {
          assert.ok(error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause);
          assert.equal(error.cause.code, "42P07");
          return true;
        });
        assert.deepEqual((await client.query("SELECT * FROM teams")).rows, [{ id: 42 }]);
        assert.equal((await client.query("SELECT to_regclass('public.team_members') AS name")).rows[0].name, null);
        assert.equal((await client.query("SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations")).rows[0].count, 0);
      } finally {
        await client.end();
      }
    });
    await accessChecks(t, owner, api);
    await staffChecks(t, owner, api);
    await staffManagementChecks(t, ownerUrl, apiUrl);
    await staffRecoveryChecks(t, ownerUrl, apiUrl,container);
    await arenaChecks(t, ownerUrl, apiUrl);
    await contentChecks(t, ownerUrl, apiUrl);
    await validationChecks(t, ownerUrl, apiUrl);
    await clockChecks(t, ownerUrl, apiUrl);
  } finally {
    await api?.end();
    await owner?.end();
    const identity = await docker(["inspect", "--format", '{{index .Config.Labels "ingenium.schema-test"}}|{{.Config.Image}}', container]);
    assert.equal(identity, `${nonce}|${selectedImage}`, "Test container ownership changed; do not remove it.");
    if(preserveRealFlow)console.error(`Retained failed round-flow database container ${container}; inspect before any rerun.`);
    else{
      await docker(["stop", "--time", "5", container]);
      assert.equal(await docker(["inspect", "--format", "{{.State.Running}}", container]), "false");
      await docker(["rm", container]);
    }
  }
});
