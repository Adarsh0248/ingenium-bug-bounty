import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { accessCredentials, staffIdentities, rounds, teamRounds, memberRounds } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { bounties, competitionSubmissions, competitionOutcomes } from "./competition-schema.js";
import { validationSnapshots } from "./validation-schema.js";
import { judgeHostEpochs } from "./judge-schema.js";
import { roundCancellations } from "./cancellation-schema.js";
const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

// An official parent references its immutable admission; a sample owns its separate source and receipt.
export const participantJudging = pgTable("participant_judging", {
  id: uuid("id").primaryKey(), submissionId: uuid("submission_id").references(() => competitionSubmissions.id),
  queueOrder: bigint("queue_order", { mode: "bigint" }).notNull().generatedAlwaysAsIdentity(),
  sourceId: uuid("source_id").references(() => competitionOutcomes.id), lane: text("lane").notNull(),
  roundId: uuid("round_id").notNull().references(() => rounds.id), teamRoundId: uuid("team_round_id").notNull().references(() => teamRounds.id),
  memberRoundId: uuid("member_round_id").notNull().references(() => memberRounds.id), bountyId: uuid("bounty_id").notNull().references(() => bounties.id),
  snapshotId: uuid("snapshot_id").notNull().references(() => validationSnapshots.id), source: bytes("source"), language: text("language").notNull(),
  hostEpochId: uuid("host_epoch_id").notNull().references(() => judgeHostEpochs.id), runtimeKey: text("runtime_key").notNull(), runtimeDigest: bytes("runtime_digest").notNull(),
  createdAt: instant("created_at").notNull(), policyVersion: integer("policy_version").notNull().default(1),
  status: text("status").notNull(), result: text("result"), startedAt: instant("started_at"), completedAt: instant("completed_at"),
  cancellationId: uuid("cancellation_id").references(() => roundCancellations.id),
  reservedBytes: bigint("reserved_bytes", { mode: "bigint" }).notNull(),
}, t => [index("shop_unfinished_work").on(t.bountyId,t.teamRoundId).where(sql`${t.completedAt} is null and ${t.status}<>'CANCELLED'`), unique("participant_official_plan").on(t.submissionId), unique("participant_sample_receipt").on(t.sourceId), unique("participant_queue_order").on(t.queueOrder),
  check("participant_parent_shape", sql`${t.policyVersion}=1 and octet_length(${t.source}) between 1 and 131072 and octet_length(${t.runtimeDigest})=32
    and ${t.language} in ('c','cpp','java','python','javascript') and ${t.reservedBytes} between 524288 and 21495808
    and ((${t.lane}='OFFICIAL' and ${t.submissionId} is not null and ${t.submissionId}=${t.id} and ${t.sourceId} is null) or (${t.lane}='SAMPLE' and ${t.submissionId} is null and ${t.sourceId} is not null))
    and (${t.startedAt} is null or ${t.startedAt}>=${t.createdAt})
    and ((${t.status}='CANCELLED' and ${t.cancellationId} is not null and ${t.result} is null and ${t.completedAt} is null)
      or (${t.status} in ('QUEUED','PROCESSING','JUDGING','RECOVERING','NEEDS_ATTENTION') and ${t.cancellationId} is null and ${t.result} is null and ${t.completedAt} is null)
      or (${t.status}='COMPLETED' and ${t.result} in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and ${t.cancellationId} is null and ${t.result} is not null and ${t.completedAt} is not null and ${t.completedAt}>=${t.createdAt} and (${t.lane}='SAMPLE' or ${t.result}<>'INFRA_ERROR')))`)]);
export const participantJobs = pgTable("participant_jobs", {
  id: uuid("id").primaryKey(), parentId: uuid("parent_id").notNull().references(() => participantJudging.id), caseId: uuid("case_id").notNull(),
  position: integer("position").notNull(), availableAt: instant("available_at").notNull(), status: text("status").notNull(),
  result: text("result"), completedAt: instant("completed_at"), settlingAttemptId: uuid("settling_attempt_id").references((): AnyPgColumn => participantAttempts.id),
  cancellationId: uuid("cancellation_id").references(() => roundCancellations.id),
}, t => [unique("participant_required_case").on(t.parentId, t.caseId), check("participant_job_shape", sql`${t.position} between 1 and 20
    and ((${t.status}='CANCELLED' and ${t.cancellationId} is not null and num_nonnulls(${t.result},${t.completedAt},${t.settlingAttemptId})=0)
      or (${t.status} in ('QUEUED','PROCESSING','RECOVERING','NEEDS_ATTENTION') and ${t.cancellationId} is null and num_nonnulls(${t.result},${t.completedAt},${t.settlingAttemptId})=0)
      or (${t.status}='COMPLETED' and ${t.cancellationId} is null and num_nonnulls(${t.result},${t.completedAt},${t.settlingAttemptId})=3
        and ${t.result} in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED')))`)]);
export const participantAttempts = pgTable("participant_attempts", {
  id: uuid("id").primaryKey(), jobId: uuid("job_id").notNull().references(() => participantJobs.id), number: integer("number").notNull(),
  hostEpochId: uuid("host_epoch_id").notNull().references(() => judgeHostEpochs.id), payloadDigest: bytes("payload_digest").notNull(),
  workerId: uuid("worker_id").notNull(), generation: bigint("generation", { mode: "bigint" }).notNull(),
  sendState: text("send_state").notNull(), preparedAt: instant("prepared_at").notNull(), sendStartedAt: instant("send_started_at"),
  result: text("result"), evidence: jsonb("evidence"), resultDigest: bytes("result_digest"),
  stdoutPrefix: bytes("stdout_prefix"), stderr: bytes("stderr"), compilerOutput: bytes("compiler_output"), resolvedAt: instant("resolved_at"),
  releaseDigest: bytes("release_digest"), releasedAt: instant("released_at"), pollCount: integer("poll_count").notNull().default(0), nextPollAt: instant("next_poll_at").notNull(),
}, t => [unique("participant_dispatch_number").on(t.jobId, t.number),
  uniqueIndex("participant_one_live_attempt").on(t.jobId).where(sql`${t.releasedAt} is null`),
  check("participant_attempt_shape", sql`${t.number} between 1 and 4 and ${t.generation}>0 and octet_length(${t.payloadDigest})=32 and ${t.pollCount} between 0 and 10000
    and ((${t.sendState}='PREPARED' and ${t.sendStartedAt} is null) or (${t.sendState}='SEND_STARTED' and ${t.sendStartedAt} is not null and ${t.sendStartedAt}>=${t.preparedAt}))
    and ((${t.result} is null and num_nonnulls(${t.evidence},${t.resultDigest},${t.stdoutPrefix},${t.stderr},${t.compilerOutput},${t.resolvedAt})=0)
      or (${t.result} in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and num_nonnulls(${t.evidence},${t.resultDigest},${t.resolvedAt})=3
        and num_nonnulls(${t.stdoutPrefix},${t.stderr},${t.compilerOutput}) in (0,3)
        and octet_length(${t.evidence}::text)<=65536 and octet_length(${t.resultDigest})=32 and octet_length(${t.stdoutPrefix})<=16384
        and octet_length(${t.stderr})<=65536 and octet_length(${t.compilerOutput})<=65536 and ${t.resolvedAt}>=${t.sendStartedAt}))
    and ((${t.releasedAt} is null and ${t.releaseDigest} is null) or (${t.releasedAt} is not null and ${t.releasedAt}>=${t.preparedAt} and octet_length(${t.releaseDigest})=32 and ${t.releaseDigest} is not null))`)]);
export const participantScheduler = pgTable("participant_scheduler", {
  id: integer("id").primaryKey(), turn: integer("turn").notNull().default(0), lastOfficialTeam: uuid("last_official_team"), lastSampleTeam: uuid("last_sample_team"),
}, t => [check("participant_scheduler_singleton", sql`${t.id}=1 and ${t.turn} between 0 and 3`)]);
export const participantRetryPermissions = pgTable("participant_retry_permissions", {
  jobId: uuid("job_id").primaryKey().references(() => participantJobs.id), sourceId: uuid("source_id").notNull().references(() => competitionOutcomes.id),
}, t => [unique("participant_retry_source").on(t.sourceId)]);

export const submissionReviewAudits = pgTable("submission_review_audits", {
  id: uuid("id").primaryKey(), parentId: uuid("parent_id").notNull().references(() => participantJudging.id),
  roundId: uuid("round_id").notNull().references(() => rounds.id), actorId: uuid("actor_id").notNull().references(() => staffIdentities.id),
  sessionId: uuid("session_id").notNull(), credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", {mode:"bigint"}).notNull(),
  requestKey: uuid("request_key").notNull(), fingerprint: bytes("fingerprint").notNull(), reason: text("reason").notNull(),
  sourceDigest: bytes("source_digest").notNull(), attemptId: uuid("attempt_id").references(() => participantAttempts.id), resultDigest: bytes("result_digest"),
  recordedAt: instant("recorded_at").notNull(),
},t=>[
  foreignKey({name:"submission_review_session_actor",columns:[t.sessionId,t.actorId],foreignColumns:[staffSessions.id,staffSessions.staffId]}),
  foreignKey({name:"submission_review_credential_actor",columns:[t.credentialId,t.credentialVersion,t.actorId],foreignColumns:[accessCredentials.id,accessCredentials.version,accessCredentials.staffId]}),
  unique("submission_review_intent").on(t.actorId,t.parentId,t.requestKey),
  index("submission_review_history").on(t.parentId,t.recordedAt,t.id),
  check("submission_review_shape",sql`octet_length(${t.fingerprint})=32 and octet_length(${t.sourceDigest})=32
    and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0
    and ((${t.attemptId} is null and ${t.resultDigest} is null) or (${t.attemptId} is not null and ${t.resultDigest} is not null and octet_length(${t.resultDigest})=32))`),
]);
