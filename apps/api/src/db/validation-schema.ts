import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { accessCredentials, staffIdentities } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { bugVersions, languageVariants, testCases, bugHints, runtimeManifests } from "./content-schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const id = () => uuid("id").primaryKey().$defaultFn(randomUUID);
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const validationSnapshots = pgTable("validation_snapshots", {
  id: id(), versionId: uuid("version_id").notNull(), definitionId: uuid("definition_id").notNull(), versionNumber: integer("version_number").notNull(),
  contentRevision: bigint("content_revision", { mode: "bigint" }).notNull(), roundType: integer("round_type").notNull(), title: text("title").notNull(), statement: text("statement").notNull(),
  difficulty: integer("difficulty").notNull(), baseBounty: integer("base_bounty").notNull(), submissionFormat: text("submission_format").notNull(), checkerMode: text("checker_mode").notNull(), checkerVersion: text("checker_version").notNull(),
  manifestText: text("manifest_text").notNull(), fingerprint: bytes("fingerprint").notNull(), contentBytes: bigint("content_bytes", { mode: "bigint" }).notNull(),
  createdBy: uuid("created_by").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }), createdAt: instant("created_at").notNull(),
  sourceId: uuid("source_id").notNull().references((): AnyPgColumn => validationPreparationOutcomes.id, { onDelete: "restrict" }),
}, t => [foreignKey({ name: "snapshot_version_definition", columns: [t.versionId,t.definitionId], foreignColumns: [bugVersions.id,bugVersions.definitionId] }).onDelete("restrict"),
  unique("snapshot_version_revision").on(t.versionId,t.contentRevision), unique("snapshot_same_version").on(t.id,t.versionId), unique("snapshot_source_once").on(t.sourceId),
  check("snapshot_metadata", sql`${t.versionNumber} between 1 and 1000 and ${t.contentRevision}>=1 and ${t.roundType} in (1,2)
    and octet_length(${t.title}) between 1 and 160 and length(btrim(${t.title}))>0 and octet_length(${t.statement})<=65536
    and ${t.difficulty} between 1 and 100 and (${t.baseBounty}=10*${t.difficulty} or (${t.roundType}=1 and ${t.baseBounty}=50*${t.difficulty})) and ${t.submissionFormat}='FULL_PROGRAM'
    and ${t.checkerMode} in ('TOKENS','EXACT_TEXT') and ${t.checkerVersion}='ingenium-text-v1'`),
  check("snapshot_fingerprint", sql`octet_length(${t.manifestText}) between 1 and 32768 and jsonb_typeof(${t.manifestText}::jsonb)='object'
    and octet_length(${t.fingerprint})=32 and ${t.fingerprint}=sha256(convert_to(${t.manifestText},'UTF8')) and ${t.contentBytes} between 65536 and 3221225472`)]);

export const validationSnapshotVariants = pgTable("validation_snapshot_variants", {
  snapshotId: uuid("snapshot_id").notNull(), versionId: uuid("version_id").notNull(), variantId: uuid("variant_id").notNull(), language: text("language").notNull(),
  starterCode: bytes("starter_code").notNull(), referenceCode: bytes("reference_code").notNull(), defectDescription: text("defect_description").notNull(),
  runtimeKey: text("runtime_key").notNull(), cpuMs: integer("cpu_ms").notNull(), wallMs: integer("wall_ms").notNull(), memoryKb: integer("memory_kb").notNull(),
}, t => [primaryKey({ columns: [t.snapshotId,t.variantId] }), unique("snapshot_variant_language").on(t.snapshotId,t.language), unique("snapshot_variant_scope").on(t.snapshotId,t.variantId,t.language),
  foreignKey({ name: "snapshot_variant_parent", columns: [t.snapshotId,t.versionId], foreignColumns: [validationSnapshots.id,validationSnapshots.versionId] }).onDelete("restrict"),
  foreignKey({ name: "snapshot_variant_original", columns: [t.variantId,t.versionId], foreignColumns: [languageVariants.id,languageVariants.versionId] }).onDelete("restrict"),
  foreignKey({ name: "snapshot_variant_runtime", columns: [t.runtimeKey,t.language], foreignColumns: [runtimeManifests.key,runtimeManifests.language] }).onDelete("restrict"),
  check("snapshot_variant_bounds", sql`${t.language} in ('c','cpp','java','python','javascript') and octet_length(${t.starterCode}) between 1 and 131072
    and octet_length(${t.referenceCode}) between 1 and 131072 and octet_length(${t.defectDescription}) between 1 and 16384
    and ${t.cpuMs} between 1 and (case when ${t.language} in ('c','cpp') then 2000 else 4000 end)
    and ${t.wallMs} between ${t.cpuMs} and (case when ${t.language} in ('c','cpp') then 10000 else 15000 end) and ${t.memoryKb} between 1 and 524288`)]);

export const validationSnapshotCases = pgTable("validation_snapshot_cases", {
  snapshotId: uuid("snapshot_id").notNull(), versionId: uuid("version_id").notNull(), caseId: uuid("case_id").notNull(), position: integer("position").notNull(),
  visibility: text("visibility").notNull(), inputData: bytes("input_data").notNull(), expectedOutput: bytes("expected_output").notNull(),
}, t => [primaryKey({ columns: [t.snapshotId,t.caseId] }), unique("snapshot_case_position").on(t.snapshotId,t.position),
  foreignKey({ name: "snapshot_case_parent", columns: [t.snapshotId,t.versionId], foreignColumns: [validationSnapshots.id,validationSnapshots.versionId] }).onDelete("restrict"),
  foreignKey({ name: "snapshot_case_original", columns: [t.caseId,t.versionId], foreignColumns: [testCases.id,testCases.versionId] }).onDelete("restrict"),
  check("snapshot_case_bounds", sql`${t.position} between 1 and 20 and ${t.visibility} in ('SAMPLE','HIDDEN') and octet_length(${t.inputData})<=1048576 and octet_length(${t.expectedOutput})<=1048576`)]);

export const validationSnapshotHints = pgTable("validation_snapshot_hints", {
  snapshotId: uuid("snapshot_id").notNull(), versionId: uuid("version_id").notNull(), hintId: uuid("hint_id").notNull(), level: integer("level").notNull(), content: text("content").notNull(),
}, t => [primaryKey({ columns: [t.snapshotId,t.level] }), unique("snapshot_hint_once").on(t.snapshotId,t.hintId),
  foreignKey({ name: "snapshot_hint_parent", columns: [t.snapshotId,t.versionId], foreignColumns: [validationSnapshots.id,validationSnapshots.versionId] }).onDelete("restrict"),
  foreignKey({ name: "snapshot_hint_original", columns: [t.hintId,t.versionId], foreignColumns: [bugHints.id,bugHints.versionId] }).onDelete("restrict"),
  check("snapshot_hint_bounds", sql`${t.level} between 1 and 3 and octet_length(${t.content}) between 1 and 16384 and length(btrim(${t.content}))>0`)]);

export const validationSnapshotWitnesses = pgTable("validation_snapshot_witnesses", {
  snapshotId: uuid("snapshot_id").notNull(), variantId: uuid("variant_id").notNull(), position: integer("position").notNull(), checkType: text("check_type").notNull(),
  caseId: uuid("case_id"), expectedResult: text("expected_result").notNull(),
}, t => [primaryKey({ columns: [t.snapshotId,t.variantId,t.position] }),
  foreignKey({ name: "snapshot_witness_variant", columns: [t.snapshotId,t.variantId], foreignColumns: [validationSnapshotVariants.snapshotId,validationSnapshotVariants.variantId] }).onDelete("restrict"),
  foreignKey({ name: "snapshot_witness_case", columns: [t.snapshotId,t.caseId], foreignColumns: [validationSnapshotCases.snapshotId,validationSnapshotCases.caseId] }).onDelete("restrict"),
  uniqueIndex("snapshot_witness_unique_case").on(t.snapshotId,t.variantId,t.caseId).where(sql`${t.caseId} is not null`),
  uniqueIndex("snapshot_witness_one_compile").on(t.snapshotId,t.variantId).where(sql`${t.checkType}='COMPILATION'`),
  check("snapshot_witness_shape", sql`${t.position} between 1 and 3 and ((${t.checkType}='COMPILATION' and ${t.caseId} is null and ${t.expectedResult}='COMPILATION_ERROR')
    or (${t.checkType}='TEST_CASE' and ${t.caseId} is not null and ${t.expectedResult} in ('WRONG_ANSWER','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED')))`)]);

export const validationSnapshotChecks = pgTable("validation_snapshot_checks", {
  id: uuid("id").primaryKey().defaultRandom(), snapshotId: uuid("snapshot_id").notNull(), position: integer("position").notNull(), variantId: uuid("variant_id").notNull(), language: text("language").notNull(),
  sourceRole: text("source_role").notNull(), checkType: text("check_type").notNull(), caseId: uuid("case_id"), witnessPosition: integer("witness_position"), expectedResult: text("expected_result").notNull(),
}, t => [unique("snapshot_check_position").on(t.snapshotId,t.position),
  foreignKey({ name: "snapshot_check_variant", columns: [t.snapshotId,t.variantId,t.language], foreignColumns: [validationSnapshotVariants.snapshotId,validationSnapshotVariants.variantId,validationSnapshotVariants.language] }).onDelete("restrict"),
  foreignKey({ name: "snapshot_check_case", columns: [t.snapshotId,t.caseId], foreignColumns: [validationSnapshotCases.snapshotId,validationSnapshotCases.caseId] }).onDelete("restrict"),
  foreignKey({ name: "snapshot_check_witness", columns: [t.snapshotId,t.variantId,t.witnessPosition], foreignColumns: [validationSnapshotWitnesses.snapshotId,validationSnapshotWitnesses.variantId,validationSnapshotWitnesses.position] }).onDelete("restrict"),
  uniqueIndex("snapshot_check_reference_once").on(t.snapshotId,t.variantId,t.caseId).where(sql`${t.sourceRole}='REFERENCE'`),
  uniqueIndex("snapshot_check_starter_once").on(t.snapshotId,t.variantId,t.witnessPosition).where(sql`${t.sourceRole}='STARTER'`),
  check("snapshot_check_shape", sql`${t.position} between 1 and 115 and ((${t.sourceRole}='REFERENCE' and ${t.checkType}='TEST_CASE' and ${t.caseId} is not null and ${t.witnessPosition} is null and ${t.expectedResult}='PASSED')
    or (${t.sourceRole}='STARTER' and ${t.witnessPosition} is not null and ${t.witnessPosition} between 1 and 3
      and ((${t.checkType}='COMPILATION' and ${t.caseId} is null and ${t.expectedResult}='COMPILATION_ERROR')
        or (${t.checkType}='TEST_CASE' and ${t.caseId} is not null and ${t.expectedResult} in ('WRONG_ANSWER','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED')))))`)]);

export const validationPreparationOutcomes = pgTable("validation_preparation_outcomes", {
  id: id(), versionId: uuid("version_id").notNull().references(() => bugVersions.id, { onDelete: "restrict" }), actorId: uuid("actor_id").notNull(), sessionId: uuid("session_id").notNull(),
  credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(), requestKey: uuid("request_key").notNull(), fingerprint: bytes("fingerprint").notNull(),
  expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(), reason: text("reason").notNull(), outcome: text("outcome").notNull(), denialReason: text("denial_reason"),
  issues: jsonb("issues").notNull(), recordedAt: instant("recorded_at").notNull(), resultSnapshotId: uuid("result_snapshot_id"),
}, t => [foreignKey({ name: "validation_prepare_actor_session", columns: [t.sessionId,t.actorId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"),
  foreignKey({ name: "validation_prepare_actor_code", columns: [t.credentialId,t.credentialVersion,t.actorId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  foreignKey({ name: "validation_prepare_snapshot", columns: [t.resultSnapshotId,t.versionId], foreignColumns: [validationSnapshots.id,validationSnapshots.versionId] }).onDelete("restrict"),
  unique("validation_prepare_intent").on(t.actorId,t.versionId,t.requestKey), uniqueIndex("validation_prepare_applied_once").on(t.resultSnapshotId).where(sql`${t.outcome}='APPLIED'`),
  check("validation_prepare_shape", sql`octet_length(${t.fingerprint})=32 and ${t.expectedRevision}>=0 and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0
    and jsonb_typeof(${t.issues})='array' and jsonb_array_length(${t.issues})<=128 and octet_length(${t.issues}::text)<=32768
    and ((${t.outcome} in ('APPLIED','UNCHANGED') and ${t.denialReason} is null and ${t.resultSnapshotId} is not null and jsonb_array_length(${t.issues})=0)
      or (${t.outcome}='REJECTED' and ${t.denialReason} is not null and ${t.denialReason} in ('STALE_VERSION','CONTENT_LOCKED','CONTENT_INCOMPLETE','ARENA_ACTIVE') and ${t.resultSnapshotId} is null))`)]);

export const validationSnapshotAudits = pgTable("validation_snapshot_audits", {
  id: id(), versionId: uuid("version_id").notNull().references(() => bugVersions.id, { onDelete: "restrict" }), snapshotId: uuid("snapshot_id"),
  actorId: uuid("actor_id").notNull(), sessionId: uuid("session_id").notNull(), credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(),
  section: text("section").notNull(), recordedAt: instant("recorded_at").notNull(),
}, t => [foreignKey({ name: "validation_audit_actor_session", columns: [t.sessionId,t.actorId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"),
  foreignKey({ name: "validation_audit_actor_code", columns: [t.credentialId,t.credentialVersion,t.actorId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  foreignKey({ name: "validation_audit_snapshot", columns: [t.snapshotId,t.versionId], foreignColumns: [validationSnapshots.id,validationSnapshots.versionId] }).onDelete("restrict"),
  check("validation_audit_shape", sql`(${t.section}='CAPTURE' and ${t.snapshotId} is null) or (${t.section} in ('SUMMARY','CHECKS') and ${t.snapshotId} is not null)`)]);
