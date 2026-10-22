import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { accessCredentials, staffIdentities } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { runtimeManifests } from "./content-schema.js";
import { validationSnapshots, validationSnapshotChecks } from "./validation-schema.js";
import { participantAttempts } from "./participant-judge-schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const id = () => uuid("id").primaryKey().$defaultFn(randomUUID);
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const judgeHostEpochs = pgTable("judge_host_epochs", {
  id: id(), state:text("state").notNull(), endpointRef:text("endpoint_ref").notNull(), createdAt:instant("created_at").notNull(),
  retirementDigest:bytes("retirement_digest"),
}, t => [check("judge_epoch_shape",sql`${t.state} in ('ACTIVE','QUARANTINED','RETIRED') and octet_length(${t.endpointRef}) between 1 and 256
  and ((${t.state}='RETIRED' and octet_length(${t.retirementDigest})=32 and ${t.retirementDigest} is not null) or (${t.state}<>'RETIRED' and ${t.retirementDigest} is null))`)]);
export const judgeHostRuntimes = pgTable("judge_host_runtimes", {
  hostEpochId:uuid("host_epoch_id").notNull().references(() => judgeHostEpochs.id,{onDelete:"restrict"}),language:text("language").notNull(),runtimeKey:text("runtime_key").notNull(),
},t=>[primaryKey({columns:[t.hostEpochId,t.language]}),foreignKey({name:"judge_host_runtime",columns:[t.runtimeKey,t.language],foreignColumns:[runtimeManifests.key,runtimeManifests.language]}).onDelete("restrict")]);
export const judgeControl = pgTable("judge_control", {
  id:integer("id").primaryKey(),workerId:uuid("worker_id"),workerGeneration:bigint("worker_generation",{mode:"bigint"}).notNull().default(sql`0`),
  leaseUntil:instant("lease_until"),hostEpochId:uuid("host_epoch_id").references(() => judgeHostEpochs.id,{onDelete:"restrict"}),trustedTimeAt:instant("trusted_time_at"),
  activeValidationId:uuid("active_validation_id").references(():AnyPgColumn=>validationRuns.id,{onDelete:"restrict"}),
},t=>[check("judge_control_shape",sql`${t.id}=1 and ${t.workerGeneration}>=0 and ((num_nonnulls(${t.workerId},${t.leaseUntil},${t.hostEpochId})=0 and ${t.workerGeneration}=0)
  or (num_nonnulls(${t.workerId},${t.leaseUntil},${t.hostEpochId})=3 and ${t.workerGeneration}>0))`)]);
export const executionCapacitySlots = pgTable("execution_capacity_slots", {
  id:integer("id").primaryKey(),authoringAttemptId:uuid("authoring_attempt_id").references(():AnyPgColumn=>authoringAttempts.id,{onDelete:"restrict"}),
  participantAttemptId:uuid("participant_attempt_id").references(():AnyPgColumn=>participantAttempts.id,{onDelete:"restrict"}),
  revision:bigint("revision",{mode:"bigint"}).notNull().default(sql`0`),
},t=>[unique("slot_authoring_attempt_once").on(t.authoringAttemptId),unique("slot_participant_attempt_once").on(t.participantAttemptId),
  check("slot_one_purpose",sql`num_nonnulls(${t.authoringAttemptId},${t.participantAttemptId})<=1`),check("development_slot_bounds",sql`${t.id} between 1 and 2 and ${t.revision}>=0`)]);
export const validationRuns = pgTable("validation_runs", {
  id:id(),snapshotId:uuid("snapshot_id").notNull().references(()=>validationSnapshots.id,{onDelete:"restrict"}),configurationFingerprint:bytes("configuration_fingerprint").notNull(),
  hostEpochId:uuid("host_epoch_id").notNull().references(()=>judgeHostEpochs.id,{onDelete:"restrict"}),status:text("status").notNull(),
  requestedBy:uuid("requested_by").notNull().references(()=>staffIdentities.id,{onDelete:"restrict"}),createdAt:instant("created_at").notNull(),deadlineAt:instant("deadline_at").notNull(),
  startedAt:instant("started_at"),finishedAt:instant("finished_at"),policyVersion:integer("policy_version").notNull(),checkCount:integer("check_count").notNull(),
  accountedBytes:bigint("accounted_bytes",{mode:"bigint"}).notNull(),sourceId:uuid("source_id").notNull().references(():AnyPgColumn=>validationRunOutcomes.id,{onDelete:"restrict"}),
},t=>[unique("validation_run_snapshot_scope").on(t.id,t.snapshotId),unique("validation_run_source_once").on(t.sourceId),
  uniqueIndex("validation_one_active").on(sql`(true)`).where(sql`${t.status} in ('QUEUED','RUNNING')`),
  check("validation_run_shape",sql`octet_length(${t.configurationFingerprint})=32 and ${t.policyVersion}=1 and ${t.checkCount} between 15 and 115
    and ${t.deadlineAt}=${t.createdAt}+interval '10 minutes' and (${t.startedAt} is null or ${t.startedAt}>=${t.createdAt})
    and ((${t.status}='QUEUED' and ${t.startedAt} is null and ${t.finishedAt} is null) or (${t.status}='RUNNING' and ${t.startedAt} is not null and ${t.finishedAt} is null)
      or (${t.status} in ('PASSED','FAILED','INFRA_ERROR') and ${t.finishedAt} is not null and ${t.finishedAt}>=${t.createdAt} and (${t.startedAt} is null or ${t.finishedAt}>=${t.startedAt})))
    and (${t.status} not in ('PASSED','FAILED') or (${t.startedAt} is not null and ${t.finishedAt}<${t.deadlineAt}))
    and ${t.accountedBytes} between 524288 and 90963968`)]);
export const authoringChecks = pgTable("authoring_checks", {
  id:id(),runId:uuid("run_id").notNull(),snapshotId:uuid("snapshot_id").notNull(),snapshotCheckId:uuid("snapshot_check_id").notNull().references(()=>validationSnapshotChecks.id,{onDelete:"restrict"}),
  result:text("result"),completedAt:instant("completed_at"),availableAt:instant("available_at").notNull(),settlingAttemptId:uuid("settling_attempt_id").references(():AnyPgColumn=>authoringAttempts.id,{onDelete:"restrict"}),
  workerId:uuid("worker_id"),leaseGeneration:bigint("lease_generation",{mode:"bigint"}),
},t=>[foreignKey({name:"authoring_check_run",columns:[t.runId,t.snapshotId],foreignColumns:[validationRuns.id,validationRuns.snapshotId]}).onDelete("restrict"),
  unique("authoring_required_check_once").on(t.runId,t.snapshotCheckId),unique("authoring_check_same_run").on(t.id,t.runId),
  check("authoring_check_shape",sql`(${t.workerId} is null) = (${t.leaseGeneration} is null) and (${t.leaseGeneration} is null or ${t.leaseGeneration}>0)
    and ((${t.result} is null and ${t.completedAt} is null and ${t.settlingAttemptId} is null) or (${t.result} is not null and ${t.completedAt} is not null
      and ${t.result} in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
      and (${t.result}='INFRA_ERROR' or ${t.settlingAttemptId} is not null)))`)]);
export const authoringAttempts = pgTable("authoring_attempts", {
  id:id(),checkId:uuid("check_id").notNull().references(()=>authoringChecks.id,{onDelete:"restrict"}),number:integer("number").notNull(),
  hostEpochId:uuid("host_epoch_id").notNull().references(()=>judgeHostEpochs.id,{onDelete:"restrict"}),workerId:uuid("worker_id").notNull(),leaseGeneration:bigint("lease_generation",{mode:"bigint"}).notNull(),
  sendState:text("send_state").notNull(),payloadDigest:bytes("payload_digest").notNull(),preparedAt:instant("prepared_at").notNull(),sendStartedAt:instant("send_started_at"),
  result:text("result"),resultDigest:bytes("result_digest"),resolvedAt:instant("resolved_at"),evidence:jsonb("evidence"),stdoutPrefix:bytes("stdout_prefix"),stderr:bytes("stderr"),compilerOutput:bytes("compiler_output"),
  releasedAt:instant("released_at"),releaseDigest:bytes("release_digest"),
  pollCount:integer("poll_count").notNull().default(0),nextPollAt:instant("next_poll_at").notNull().default(sql`date_trunc('milliseconds',clock_timestamp())+interval '500 milliseconds'`),
},t=>[unique("authoring_attempt_number").on(t.checkId,t.number),uniqueIndex("authoring_one_potentially_live").on(t.checkId).where(sql`${t.releasedAt} is null`),
  check("authoring_attempt_shape",sql`${t.number} between 1 and 3 and ${t.leaseGeneration}>0 and octet_length(${t.payloadDigest})=32 and ${t.pollCount} between 0 and 10000 and ${t.nextPollAt}>=${t.preparedAt}
    and ((${t.sendState}='PREPARED' and ${t.sendStartedAt} is null) or (${t.sendState}='SEND_STARTED' and ${t.sendStartedAt} is not null and ${t.sendStartedAt}>=${t.preparedAt}))
    and ((${t.result} is null and num_nonnulls(${t.resultDigest},${t.resolvedAt},${t.evidence},${t.stdoutPrefix},${t.stderr},${t.compilerOutput})=0)
      or (${t.result} is not null and ${t.result} in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and num_nonnulls(${t.resultDigest},${t.resolvedAt},${t.evidence},${t.stdoutPrefix},${t.stderr},${t.compilerOutput})=6 and octet_length(${t.resultDigest})=32
        and jsonb_typeof(${t.evidence})='object' and octet_length(${t.evidence}::text)<=32768 and octet_length(${t.stdoutPrefix})<=16384
        and octet_length(${t.stderr})<=65536 and octet_length(${t.compilerOutput})<=65536 and ${t.resolvedAt}>=${t.sendStartedAt}))
    and ((${t.releasedAt} is null and ${t.releaseDigest} is null) or (${t.releasedAt} is not null and octet_length(${t.releaseDigest})=32
      and ${t.releaseDigest} is not null and ${t.releasedAt}>=${t.preparedAt}))`)]);
export const validationRunOutcomes = pgTable("validation_run_outcomes", {
  id:id(),snapshotId:uuid("snapshot_id").notNull().references(()=>validationSnapshots.id,{onDelete:"restrict"}),actorId:uuid("actor_id").notNull(),sessionId:uuid("session_id").notNull(),
  credentialId:uuid("credential_id").notNull(),credentialVersion:bigint("credential_version",{mode:"bigint"}).notNull(),requestKey:uuid("request_key").notNull(),fingerprint:bytes("fingerprint").notNull(),
  expectedRevision:bigint("expected_revision",{mode:"bigint"}).notNull(),reason:text("reason").notNull(),outcome:text("outcome").notNull(),denialReason:text("denial_reason"),
  recordedAt:instant("recorded_at").notNull(),resultRunId:uuid("result_run_id").references(()=>validationRuns.id,{onDelete:"restrict"}),
},t=>[foreignKey({name:"validation_run_actor_session",columns:[t.sessionId,t.actorId],foreignColumns:[staffSessions.id,staffSessions.staffId]}).onDelete("restrict"),
  foreignKey({name:"validation_run_actor_code",columns:[t.credentialId,t.credentialVersion,t.actorId],foreignColumns:[accessCredentials.id,accessCredentials.version,accessCredentials.staffId]}).onDelete("restrict"),
  unique("validation_run_intent").on(t.actorId,t.snapshotId,t.requestKey),unique("validation_run_one_source").on(t.resultRunId),
  check("validation_run_outcome_shape",sql`octet_length(${t.fingerprint})=32 and ${t.expectedRevision}>=1 and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0
    and ((${t.outcome}='ADMITTED' and ${t.resultRunId} is not null and ${t.denialReason} is null)
      or (${t.outcome}='REJECTED' and ${t.resultRunId} is null and ${t.denialReason} is not null and ${t.denialReason} in ('STALE_VERSION','CONTENT_LOCKED','ARENA_ACTIVE')))`)]);
export const validationRunAudits = pgTable("validation_run_audits", {
  id:id(),runId:uuid("run_id").notNull().references(()=>validationRuns.id,{onDelete:"restrict"}),actorId:uuid("actor_id").notNull(),sessionId:uuid("session_id").notNull(),
  credentialId:uuid("credential_id").notNull(),credentialVersion:bigint("credential_version",{mode:"bigint"}).notNull(),recordedAt:instant("recorded_at").notNull(),
},t=>[foreignKey({name:"validation_report_actor_session",columns:[t.sessionId,t.actorId],foreignColumns:[staffSessions.id,staffSessions.staffId]}).onDelete("restrict"),
  foreignKey({name:"validation_report_actor_code",columns:[t.credentialId,t.credentialVersion,t.actorId],foreignColumns:[accessCredentials.id,accessCredentials.version,accessCredentials.staffId]}).onDelete("restrict")]);

export const validationDiagnosticAudits = pgTable("validation_diagnostic_audits", {
  id:id(),runId:uuid("run_id").notNull().references(()=>validationRuns.id),attemptId:uuid("attempt_id").notNull().references(()=>authoringAttempts.id),
  actorId:uuid("actor_id").notNull(),sessionId:uuid("session_id").notNull(),credentialId:uuid("credential_id").notNull(),credentialVersion:bigint("credential_version",{mode:"bigint"}).notNull(),
  requestKey:uuid("request_key").notNull(),fingerprint:bytes("fingerprint").notNull(),reason:text("reason").notNull(),resultDigest:bytes("result_digest").notNull(),recordedAt:instant("recorded_at").notNull(),
},t=>[foreignKey({name:"validation_diagnostic_session",columns:[t.sessionId,t.actorId],foreignColumns:[staffSessions.id,staffSessions.staffId]}),
  foreignKey({name:"validation_diagnostic_credential",columns:[t.credentialId,t.credentialVersion,t.actorId],foreignColumns:[accessCredentials.id,accessCredentials.version,accessCredentials.staffId]}),
  unique("validation_diagnostic_intent").on(t.actorId,t.runId,t.requestKey),index("validation_diagnostic_history").on(t.runId,t.recordedAt,t.id),
  check("validation_diagnostic_shape",sql`octet_length(${t.fingerprint})=32 and octet_length(${t.resultDigest})=32 and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0`)]);
