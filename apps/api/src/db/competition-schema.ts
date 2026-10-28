import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { rounds, teamRounds, memberRounds, participantSessions, staffIdentities, accessCredentials } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { teams } from "./schema.js";
import { bugDefinitions, bugVersions } from "./content-schema.js";
import { validationSnapshots } from "./validation-schema.js";
import { validationRuns } from "./judge-schema.js";
const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const competitionOutcomes = pgTable("competition_outcomes", {
  id: uuid("id").primaryKey(), roundId: uuid("round_id").notNull().references(() => rounds.id),
  staffSessionId: uuid("staff_session_id").references(() => staffSessions.id), participantSessionId: uuid("participant_session_id").references(() => participantSessions.id),
  actorId: uuid("actor_id").notNull(), requestKey: uuid("request_key").notNull(), action: text("action").notNull(), fingerprint: bytes("fingerprint").notNull(),
  reason: text("reason").notNull(), result: jsonb("result").notNull(), recordedAt: instant("recorded_at").notNull(),
}, t => [unique("competition_command_intent").on(t.roundId, t.actorId, t.requestKey),
  check("competition_outcome_shape", sql`num_nonnulls(${t.staffSessionId},${t.participantSessionId})=1 and octet_length(${t.fingerprint})=32
    and octet_length(${t.reason}) between 1 and 1024 and jsonb_typeof(${t.result})='object' and octet_length(${t.result}::text)<=16384`)]);
export const competitionPublications = pgTable("competition_publications", {
  snapshotId: uuid("snapshot_id").primaryKey().references(() => validationSnapshots.id), versionId: uuid("version_id").notNull().references(() => bugVersions.id),
  runId: uuid("run_id").notNull().references(() => validationRuns.id), actorId: uuid("actor_id").notNull().references(() => staffIdentities.id),
  publishedAt: instant("published_at").notNull(), review: text("review").notNull(),
}, t => [unique("competition_published_version").on(t.versionId), check("competition_publication_review", sql`octet_length(${t.review}) between 1 and 1024`)]);
export const contentPublicationOutcomes = pgTable("content_publication_outcomes", {
  id: uuid("id").primaryKey(), snapshotId: uuid("snapshot_id").notNull().references(() => validationSnapshots.id),
  runId: uuid("run_id").notNull().references(() => validationRuns.id), actorId: uuid("actor_id").notNull().references(() => staffIdentities.id),
  sessionId: uuid("session_id").notNull().references(() => staffSessions.id), credentialId: uuid("credential_id").notNull().references(() => accessCredentials.id),
  credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(), requestKey: uuid("request_key").notNull(),
  expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(), fingerprint: bytes("fingerprint").notNull(),
  review: text("review").notNull(), outcome: text("outcome").notNull(), denialReason: text("denial_reason"), recordedAt: instant("recorded_at").notNull(),
}, t => [unique("content_publication_intent").on(t.actorId, t.snapshotId, t.requestKey),
  check("content_publication_shape", sql`${t.credentialVersion}>0 and ${t.expectedRevision}>0 and octet_length(${t.fingerprint})=32
    and octet_length(${t.review}) between 1 and 1024 and btrim(${t.review})<>''
    and ((${t.outcome}='APPLIED' and ${t.denialReason} is null) or (${t.outcome}='REJECTED' and ${t.denialReason} in
      ('STALE_VERSION','CONTENT_LOCKED','ARENA_ACTIVE','VALIDATION_NOT_PASSED','CLEANUP_PENDING')))`)]);
export const competitionConfigs = pgTable("competition_configs", {
  roundId: uuid("round_id").primaryKey().references(() => rounds.id), revision: bigint("revision", { mode: "bigint" }).notNull(),
  readyDigest: bytes("ready_digest"), nextReceipt: bigint("next_receipt", { mode: "bigint" }).notNull().default(sql`0`),
  drawCiphertext: text("draw_ciphertext"), drawCommitment: text("draw_commitment"), drawReveal: jsonb("draw_reveal"),
}, t => [check("competition_config_shape", sql`${t.revision}>0 and ${t.nextReceipt} between 0 and 20000
    and (${t.readyDigest} is null or octet_length(${t.readyDigest})=32)
    and ((${t.drawCiphertext} is null and ${t.drawCommitment} is null and ${t.drawReveal} is null)
      or (${t.drawCiphertext} is not null and octet_length(${t.drawCiphertext}) between 1 and 16384 and ${t.drawCommitment} ~ '^[0-9a-f]{64}$'
        and (${t.drawReveal} is null or (jsonb_typeof(${t.drawReveal})='object' and octet_length(${t.drawReveal}::text)<=16384))))`)]);
export const competitionRosters = pgTable("competition_rosters", {
  roundId: uuid("round_id").notNull().references(() => rounds.id), teamId: uuid("team_id").notNull().references(() => teams.id), teamRoundId: uuid("team_round_id").notNull(),
}, t => [primaryKey({ columns: [t.roundId, t.teamId] }), unique("competition_roster_position").on(t.teamRoundId)]);
export const bounties = pgTable("bounties", {
  id: uuid("id").primaryKey(), roundId: uuid("round_id").notNull().references(() => rounds.id), definitionId: uuid("definition_id").notNull().references(() => bugDefinitions.id),
  snapshotId: uuid("snapshot_id").notNull().references(() => competitionPublications.snapshotId), position: integer("position").notNull(),
}, t => [unique("bounty_round_definition").on(t.roundId, t.definitionId), unique("bounty_round_position").on(t.roundId, t.position),
  unique("bounty_round_scope").on(t.id, t.roundId), check("bounty_position", sql`${t.position} between 1 and 100`)]);
export const competitionPauses = pgTable("competition_pauses", {
  id: uuid("id").primaryKey(), roundId: uuid("round_id").notNull().references(() => rounds.id), scope: text("scope").notNull(),
  teamRoundId: uuid("team_round_id").references(() => teamRounds.id), memberRoundId: uuid("member_round_id").references(() => memberRounds.id),
  startedAt: instant("started_at").notNull(), endedAt: instant("ended_at"), sourceId: uuid("source_id").notNull().references(() => competitionOutcomes.id),
  endSourceId: uuid("end_source_id").references(() => competitionOutcomes.id),
}, t => [check("competition_pause_shape", sql`((${t.scope}='GLOBAL' and num_nonnulls(${t.teamRoundId},${t.memberRoundId})=0)
    or (${t.scope}='TEAM' and ${t.teamRoundId} is not null and ${t.memberRoundId} is null)
    or (${t.scope}='MEMBER' and ${t.teamRoundId} is null and ${t.memberRoundId} is not null))
    and ((${t.endedAt} is null and ${t.endSourceId} is null) or (${t.endedAt}>=${t.startedAt} and ${t.endSourceId} is not null))`),
  uniqueIndex("competition_open_global").on(t.roundId).where(sql`${t.scope}='GLOBAL' and ${t.endedAt} is null`),
  uniqueIndex("competition_open_team").on(t.teamRoundId).where(sql`${t.scope}='TEAM' and ${t.endedAt} is null`),
  uniqueIndex("competition_open_member").on(t.memberRoundId).where(sql`${t.scope}='MEMBER' and ${t.endedAt} is null`)]);
export const competitionSubmissions = pgTable("competition_submissions", {
  id: uuid("id").primaryKey(), roundId: uuid("round_id").notNull(), teamRoundId: uuid("team_round_id").notNull().references(() => teamRounds.id),
  memberRoundId: uuid("member_round_id").notNull().references(() => memberRounds.id), bountyId: uuid("bounty_id").notNull(),
  source: bytes("source"), language: text("language").notNull(), receiptOrder: bigint("receipt_order", { mode: "bigint" }).notNull(),
  receivedAt: instant("received_at").notNull(), elapsedMs: bigint("elapsed_ms", { mode: "bigint" }).notNull(), hintTier: integer("hint_tier").notNull(),
  sourceId: uuid("source_id").notNull().references(() => competitionOutcomes.id),
}, t => [foreignKey({ name: "competition_submission_bounty" , columns: [t.bountyId, t.roundId], foreignColumns: [bounties.id, bounties.roundId] }),
  unique("competition_receipt_order").on(t.roundId, t.receiptOrder), check("competition_submission_shape", sql`octet_length(${t.source}) between 1 and 131072
    and ${t.language} in ('c','cpp','java','python','javascript') and ${t.receiptOrder} between 1 and 20000 and ${t.elapsedMs} between 0 and 18000000 and ${t.hintTier} between 0 and 3`)]);
export const competitionAssessments = pgTable("competition_assessments", {
  submissionId: uuid("submission_id").primaryKey().references(() => competitionSubmissions.id), verdict: text("verdict").notNull(),
  evidenceDigest: bytes("evidence_digest").notNull(), recordedAt: instant("recorded_at").notNull(),
}, t => [check("competition_assessment_shape", sql`${t.verdict} in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED') and octet_length(${t.evidenceDigest})=32`)]);
export const competitionCaseResults = pgTable("competition_case_results", {
  submissionId: uuid("submission_id").notNull().references(() => competitionSubmissions.id), caseId: uuid("case_id").notNull(), verdict: text("verdict").notNull(),
  evidenceDigest: bytes("evidence_digest").notNull(), recordedAt: instant("recorded_at").notNull(),
}, t => [primaryKey({ columns: [t.submissionId, t.caseId] }), check("competition_case_verdict", sql`${t.verdict} in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED')`),
  check("competition_case_digest", sql`octet_length(${t.evidenceDigest})=32`)]);
export const bountyAwards = pgTable("bounty_awards", {
  id: uuid("id").primaryKey(), submissionId: uuid("submission_id").notNull().references(() => competitionAssessments.submissionId),
  teamRoundId: uuid("team_round_id").notNull().references(() => teamRounds.id), bountyId: uuid("bounty_id").notNull().references(() => bounties.id),
  roundKind: integer("round_kind").notNull(), baseBounty: integer("base_bounty").notNull(), points: integer("points").notNull(), recordedAt: instant("recorded_at").notNull(),
}, t => [unique("competition_award_team_bounty").on(t.teamRoundId, t.bountyId), unique("competition_award_submission").on(t.submissionId),
  uniqueIndex("competition_shared_winner").on(t.bountyId).where(sql`${t.roundKind}=2`),
  check("competition_award_shape", sql`(${t.roundKind}=1 and ${t.baseBounty} between 10 and 5000 and ${t.points}=${t.baseBounty}) or (${t.roundKind}=2 and ${t.baseBounty} between 10 and 1000 and ${t.points} between 5 and 1000)`)]);
export const wrongSubmissionPenalties = pgTable("wrong_submission_penalties", {
  submissionId: uuid("submission_id").primaryKey().references(() => competitionAssessments.submissionId),
  teamRoundId: uuid("team_round_id").notNull().references(() => teamRounds.id), milliseconds: integer("milliseconds").notNull().default(300000), recordedAt: instant("recorded_at").notNull(),
}, t => [check("competition_wrong_penalty", sql`${t.milliseconds}=300000`)]);
export const hintPurchases = pgTable("hint_purchases", {
  id: uuid("id").primaryKey(), teamRoundId: uuid("team_round_id").notNull().references(() => teamRounds.id), bountyId: uuid("bounty_id").notNull().references(() => bounties.id),
  level: integer("level").notNull(), price: integer("price").notNull(), sourceId: uuid("source_id").notNull().references(() => competitionOutcomes.id), recordedAt: instant("recorded_at").notNull(),
}, t => [unique("competition_hint_owned").on(t.teamRoundId, t.bountyId, t.level), check("competition_hint_shape", sql`${t.level} between 1 and 3 and ${t.price} between 1 and 2000`)]);
export const roundResults = pgTable("round_results", {
  id: uuid("id").primaryKey(), roundId: uuid("round_id").notNull().references(() => rounds.id), version: integer("version").notNull().default(1),
  standings: jsonb("standings").notNull(), digest: bytes("digest").notNull(), configDigest: bytes("config_digest").notNull(), finalisedAt: instant("finalised_at").notNull(),
}, t => [unique("competition_final_result").on(t.roundId), check("competition_result_shape", sql`${t.version}=1 and octet_length(${t.digest})=32 and octet_length(${t.configDigest})=32
    and jsonb_typeof(${t.standings})='array' and jsonb_array_length(${t.standings}) between 1 and 100 and octet_length(${t.standings}::text)<=1048576
    and ${t.digest}=sha256(convert_to(${t.standings}::text,'UTF8'))`)]);
export const qualificationDecisions = pgTable("qualification_decisions", {
  resultId: uuid("result_id").primaryKey().references(() => roundResults.id), selected: jsonb("selected").notNull(), reveal: jsonb("reveal").notNull(),
  sourceId: uuid("source_id").notNull().references(() => competitionOutcomes.id),
}, t => [check("competition_qualification_shape", sql`jsonb_typeof(${t.selected})='array' and jsonb_array_length(${t.selected}) between 1 and 50 and jsonb_typeof(${t.reveal})='object' and octet_length(${t.reveal}::text)<=16384`)]);
export const roundCarryovers = pgTable("round_carryovers", {
  teamRoundId: uuid("team_round_id").primaryKey().references(() => teamRounds.id), resultId: uuid("result_id").notNull().references(() => qualificationDecisions.resultId),
  sourceTeamRoundId: uuid("source_team_round_id").notNull().references(() => teamRounds.id), amount: integer("amount").notNull(),
}, t => [unique("competition_carryover_once").on(t.resultId, t.sourceTeamRoundId), check("competition_carryover_amount", sql`${t.amount} between 0 and 250000`)]);
export const walletEntries = pgTable("wallet_entries", {
  id: uuid("id").primaryKey(), teamRoundId: uuid("team_round_id").notNull().references(() => teamRounds.id), amount: integer("amount").notNull(),
  awardId: uuid("award_id").references(() => bountyAwards.id), purchaseId: uuid("purchase_id").references(() => hintPurchases.id), carryoverId: uuid("carryover_id").references(() => roundCarryovers.teamRoundId),
  recordedAt: instant("recorded_at").notNull(),
}, t => [unique("wallet_award_once").on(t.awardId), unique("wallet_hint_once").on(t.purchaseId), unique("wallet_opening_once").on(t.carryoverId),
  check("wallet_entry_source", sql`num_nonnulls(${t.awardId},${t.purchaseId},${t.carryoverId})=1 and ${t.amount}<>0 and ${t.amount} between -2000 and 250000`)]);
export const competitionEvents = pgTable("competition_events", {
  sequence: bigint("sequence", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(), roundId: uuid("round_id").notNull().references(() => rounds.id),
  teamRoundId: uuid("team_round_id").references(() => teamRounds.id), kind: text("kind").notNull(), referenceId: uuid("reference_id").notNull(), createdAt: instant("created_at").notNull(),
}, t => [check("competition_event_kind", sql`${t.kind} in ('ROUND_CHANGED','HINT_PURCHASED','SUBMISSION_RECEIVED','ASSESSMENT_RECORDED','BOUNTY_AWARDED','PENALTY_APPLIED','RESULT_FINALISED','QUALIFICATION_LOCKED')`)]);
