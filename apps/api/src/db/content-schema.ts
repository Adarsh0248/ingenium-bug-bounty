import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { accessCredentials, staffIdentities } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const id = () => uuid("id").primaryKey().$defaultFn(randomUUID);
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const catalogueControl = pgTable("catalogue_control", {
  id: integer("id").primaryKey(), revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
  committedBytes: bigint("committed_bytes", { mode: "bigint" }).notNull().default(sql`0`),
}, t => [check("catalogue_control_bounds", sql`${t.id}=1 and ${t.revision}>=0 and ${t.committedBytes} between 0 and 3221225472`)]);

export const runtimeManifests = pgTable("runtime_manifests", {
  key: text("key").primaryKey(), language: text("language").notNull(), manifest: jsonb("manifest").notNull(), digest: bytes("digest").notNull(), createdAt: instant("created_at").notNull(),
}, t => [unique("runtime_key_language").on(t.key,t.language), check("runtime_manifest_shape", sql`${t.key} ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  and ${t.language} in ('c','cpp','java','python','javascript') and jsonb_typeof(${t.manifest})='object' and octet_length(${t.manifest}::text)<=32768
  and octet_length(${t.digest})=32 and ${t.digest}=sha256(convert_to(${t.manifest}::text,'UTF8'))`)]);

export const bugDefinitions = pgTable("bug_definitions", {
  id: id(), roundType: integer("round_type").notNull(), archivedAt: instant("archived_at"), createdBy: uuid("created_by").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }),
  createdAt: instant("created_at").notNull(), revision: bigint("revision", { mode: "bigint" }).notNull(),
}, t => [check("bug_definition_shape", sql`${t.roundType} in (1,2) and ${t.archivedAt} is null and ${t.revision}>=1`)]);

export const bugVersions = pgTable("bug_versions", {
  id: id(), definitionId: uuid("definition_id").notNull().references(() => bugDefinitions.id, { onDelete: "restrict" }), versionNumber: integer("version_number").notNull(),
  title: text("title").notNull(), statement: text("statement").notNull(), difficulty: integer("difficulty").notNull(), baseBounty: integer("base_bounty").notNull(),
  publicationStatus: text("publication_status").notNull(), createdBy: uuid("created_by").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }), createdAt: instant("created_at").notNull(),
  publishedBy: uuid("published_by").references(() => staffIdentities.id, { onDelete: "restrict" }), publishedAt: instant("published_at"),
  submissionFormat: text("submission_format").notNull(), checkerMode: text("checker_mode").notNull(), checkerVersion: text("checker_version").notNull(),
  contentRevision: bigint("content_revision", { mode: "bigint" }).notNull(), contentBytes: bigint("content_bytes", { mode: "bigint" }).notNull(),
  lastSourceId: uuid("last_source_id").notNull().references((): AnyPgColumn => contentOutcomes.id, { onDelete: "restrict" }),
}, t => [unique("bug_version_number").on(t.definitionId,t.versionNumber), unique("bug_version_definition").on(t.id,t.definitionId),
  check("bug_version_content", sql`${t.versionNumber} between 1 and 1000 and ${t.contentRevision}>=1 and ${t.contentBytes}>=4096
    and octet_length(${t.title}) between 1 and 160 and length(btrim(${t.title}))>0 and octet_length(${t.statement})<=65536
    and ${t.difficulty} between 1 and 100 and ${t.baseBounty}=${t.difficulty}*10 and ${t.submissionFormat}='FULL_PROGRAM'
    and ${t.checkerMode} in ('TOKENS','EXACT_TEXT') and ${t.checkerVersion}='ingenium-text-v1'`),
  check("bug_version_publication", sql`(${t.publicationStatus}='DRAFT' and ${t.publishedBy} is null and ${t.publishedAt} is null)
    or (${t.publicationStatus}='PUBLISHED' and ${t.publishedBy} is not null and ${t.publishedAt} is not null and ${t.publishedAt}>=${t.createdAt})`)]);

export const languageVariants = pgTable("language_variants", {
  id: id(), versionId: uuid("version_id").notNull().references(() => bugVersions.id, { onDelete: "restrict" }), language: text("language").notNull(),
  starterCode: bytes("starter_code").notNull(), referenceCode: bytes("reference_code").notNull(), defectDescription: text("defect_description").notNull(),
  runtimeKey: text("runtime_key"), cpuMs: integer("cpu_ms"), wallMs: integer("wall_ms"), memoryKb: integer("memory_kb"),
}, t => [unique("variant_version_language").on(t.versionId,t.language), unique("variant_same_version").on(t.id,t.versionId),
  foreignKey({ name: "variant_runtime_language", columns: [t.runtimeKey,t.language], foreignColumns: [runtimeManifests.key,runtimeManifests.language] }).onDelete("restrict"),
  check("variant_content_bounds", sql`${t.language} in ('c','cpp','java','python','javascript') and octet_length(${t.starterCode})<=131072
    and octet_length(${t.referenceCode})<=131072 and octet_length(${t.defectDescription})<=16384`),
  check("variant_runtime_bounds", sql`num_nonnulls(${t.runtimeKey},${t.cpuMs},${t.wallMs},${t.memoryKb})=0
    or (num_nonnulls(${t.runtimeKey},${t.cpuMs},${t.wallMs},${t.memoryKb})=4 and ${t.cpuMs} between 1 and (case when ${t.language} in ('c','cpp') then 2000 else 4000 end)
      and ${t.wallMs} between ${t.cpuMs} and (case when ${t.language} in ('c','cpp') then 10000 else 15000 end) and ${t.memoryKb} between 1 and 524288)`)]);

export const testCases = pgTable("test_cases", {
  id: id(), versionId: uuid("version_id").notNull().references(() => bugVersions.id, { onDelete: "restrict" }), position: integer("position").notNull(),
  visibility: text("visibility").notNull(), inputData: bytes("input_data").notNull(), expectedOutput: bytes("expected_output").notNull(), removedAt: instant("removed_at"),
}, t => [unique("case_same_version").on(t.id,t.versionId), uniqueIndex("case_version_position").on(t.versionId,t.position).where(sql`${t.removedAt} is null`),
  check("case_bounds", sql`${t.position} between 1 and 40 and ${t.visibility} in ('SAMPLE','HIDDEN') and octet_length(${t.inputData})<=1048576 and octet_length(${t.expectedOutput})<=1048576`)]);

export const bugHints = pgTable("bug_hints", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull().references(() => bugVersions.id, { onDelete: "restrict" }), level: integer("level").notNull(), content: text("content").notNull(),
}, t => [unique("hint_version_level").on(t.versionId,t.level), unique("hint_same_version").on(t.id,t.versionId),
  check("bug_hint_bounds", sql`${t.level} between 1 and 3 and octet_length(${t.content})<=16384`)]);

export const failureWitnesses = pgTable("failure_witnesses", {
  variantId: uuid("variant_id").notNull(), versionId: uuid("version_id").notNull(), position: integer("position").notNull(),
  checkType: text("check_type").notNull(), testCaseId: uuid("test_case_id"), expectedFailure: text("expected_failure").notNull(),
}, t => [primaryKey({ columns: [t.variantId,t.position] }),
  foreignKey({ name: "witness_variant_version", columns: [t.variantId,t.versionId], foreignColumns: [languageVariants.id,languageVariants.versionId] }).onDelete("restrict"),
  foreignKey({ name: "witness_case_version", columns: [t.testCaseId,t.versionId], foreignColumns: [testCases.id,testCases.versionId] }).onDelete("restrict"),
  uniqueIndex("witness_unique_case").on(t.variantId,t.testCaseId).where(sql`${t.testCaseId} is not null`),
  uniqueIndex("witness_one_compilation").on(t.variantId).where(sql`${t.checkType}='COMPILATION'`),
  check("failure_witness_shape", sql`${t.position} between 1 and 3 and ((${t.checkType}='COMPILATION' and ${t.testCaseId} is null and ${t.expectedFailure}='COMPILATION_ERROR')
    or (${t.checkType}='TEST_CASE' and ${t.testCaseId} is not null and ${t.expectedFailure} in ('WRONG_ANSWER','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED')))`)]);

export const contentOutcomes = pgTable("content_outcomes", {
  id: id(), actorId: uuid("actor_id").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }), sessionId: uuid("session_id").notNull(),
  credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(),
  action: text("action").notNull(), controlId: integer("control_id").references(() => catalogueControl.id, { onDelete: "restrict" }),
  definitionId: uuid("definition_id").references(() => bugDefinitions.id, { onDelete: "restrict" }), versionId: uuid("version_id").references(() => bugVersions.id, { onDelete: "restrict" }),
  requestKey: uuid("request_key").notNull(), fingerprint: bytes("fingerprint").notNull(), payloadDigest: bytes("payload_digest").notNull(),
  expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(), reason: text("reason").notNull(), outcome: text("outcome").notNull(), denialReason: text("denial_reason"), recordedAt: instant("recorded_at").notNull(),
  resultDefinitionId: uuid("result_definition_id"), resultVersionId: uuid("result_version_id"), resultRevision: bigint("result_revision", { mode: "bigint" }), resultCaseId: uuid("result_case_id"),
}, t => [foreignKey({ name: "content_actor_session", columns: [t.sessionId,t.actorId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"),
  foreignKey({ name: "content_actor_code", columns: [t.credentialId,t.credentialVersion,t.actorId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  foreignKey({ name: "content_result_version", columns: [t.resultVersionId,t.resultDefinitionId], foreignColumns: [bugVersions.id,bugVersions.definitionId] }).onDelete("restrict"),
  foreignKey({ name: "content_result_case", columns: [t.resultCaseId,t.resultVersionId], foreignColumns: [testCases.id,testCases.versionId] }).onDelete("restrict"),
  uniqueIndex("content_create_intent").on(t.actorId,t.requestKey).where(sql`${t.action}='CREATE'`),
  uniqueIndex("content_new_version_intent").on(t.actorId,t.definitionId,t.requestKey).where(sql`${t.action}='NEW_VERSION'`),
  uniqueIndex("content_edit_intent").on(t.actorId,t.versionId,t.requestKey).where(sql`${t.versionId} is not null`),
  uniqueIndex("content_applied_revision").on(t.resultVersionId,t.resultRevision).where(sql`${t.outcome}='APPLIED'`),
  check("content_outcome_target", sql`(${t.action}='CREATE' and ${t.controlId} is not null and ${t.controlId}=1 and ${t.definitionId} is null and ${t.versionId} is null)
    or (${t.action}='NEW_VERSION' and ${t.controlId} is null and ${t.definitionId} is not null and ${t.versionId} is null)
    or (${t.action} in ('METADATA','VARIANT','CASE','DELETE_CASE','WITNESSES','HINT','REORDER_CASES') and ${t.controlId} is null and ${t.definitionId} is null and ${t.versionId} is not null)`),
  check("content_outcome_payload", sql`octet_length(${t.fingerprint})=32 and octet_length(${t.payloadDigest})=32 and ${t.expectedRevision}>=0
    and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0`),
  check("content_outcome_result", sql`(${t.outcome} in ('APPLIED','UNCHANGED') and ${t.denialReason} is null and ${t.resultVersionId} is not null
      and ${t.resultDefinitionId} is not null and ${t.resultRevision} is not null and ${t.resultRevision}>=1
      and (${t.action}='CASE' or ${t.resultCaseId} is null)
      and ((${t.action} in ('CREATE','NEW_VERSION') and ${t.outcome}='APPLIED' and ${t.resultRevision}=1)
        or (${t.versionId} is not null and ${t.resultVersionId}=${t.versionId} and ${t.resultRevision}=${t.expectedRevision}+(case when ${t.outcome}='APPLIED' then 1 else 0 end))))
    or (${t.outcome}='REJECTED' and ${t.denialReason} is not null and ${t.denialReason} in ('STALE_VERSION','CONTENT_LOCKED','POSITION_OCCUPIED','CASE_UNAVAILABLE','VARIANT_MISSING','REFERENCED_CASE','INVALID_ORDER')
      and num_nonnulls(${t.resultDefinitionId},${t.resultVersionId},${t.resultRevision},${t.resultCaseId})=0)`)]);

export const contentReadAudits = pgTable("content_read_audits", {
  id: id(), versionId: uuid("version_id").notNull().references(() => bugVersions.id, { onDelete: "restrict" }), actorId: uuid("actor_id").notNull(), sessionId: uuid("session_id").notNull(),
  section: text("section").notNull(), variantId: uuid("variant_id"), caseId: uuid("case_id"), recordedAt: instant("recorded_at").notNull(),
}, t => [foreignKey({ name: "content_read_actor_session", columns: [t.sessionId,t.actorId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"),
  foreignKey({ name: "content_read_variant", columns: [t.variantId,t.versionId], foreignColumns: [languageVariants.id,languageVariants.versionId] }).onDelete("restrict"),
  foreignKey({ name: "content_read_case", columns: [t.caseId,t.versionId], foreignColumns: [testCases.id,testCases.versionId] }).onDelete("restrict"),
  check("content_read_section", sql`(${t.section}='VARIANTS' and ${t.variantId} is not null and ${t.caseId} is null)
    or (${t.section}='CASES' and ${t.caseId} is not null and ${t.variantId} is null)
    or (${t.section} in ('HINTS','WITNESSES') and ${t.variantId} is null and ${t.caseId} is null)`)]);
