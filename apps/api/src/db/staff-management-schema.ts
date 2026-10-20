import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, boolean, check, customType, foreignKey, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { accessCredentials, securityControl, staffIdentities } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";

const bytes=customType<{data:Buffer}>({dataType:()=>"bytea"});
const instant=(name:string)=>timestamp(name,{withTimezone:true,precision:3});
const id=()=>uuid("id").primaryKey().$defaultFn(randomUUID);

export const staffManagementOutcomes=pgTable("staff_management_outcomes",{
  id:id(), actorId:uuid("actor_id").notNull(),sessionId:uuid("session_id").notNull(),credentialId:uuid("credential_id").notNull(),credentialVersion:bigint("credential_version",{mode:"bigint"}).notNull(),
  controlId:integer("control_id").notNull().references(()=>securityControl.id,{onDelete:"restrict"}),
  targetStaffId:uuid("target_staff_id").references(()=>staffIdentities.id,{onDelete:"restrict"}),
  action:text("action").notNull(),requestKey:uuid("request_key").notNull(),fingerprint:bytes("fingerprint").notNull(),expectedRevision:bigint("expected_revision",{mode:"bigint"}).notNull(),
  displayName:text("display_name"),role:text("role"),enabled:boolean("enabled"),reason:text("reason").notNull(),
  outcome:text("outcome").notNull(),denialReason:text("denial_reason"),recordedAt:instant("recorded_at").notNull(),
  resultStaffId:uuid("result_staff_id").references(()=>staffIdentities.id,{onDelete:"restrict"}),
  resultCredentialId:uuid("result_credential_id").references(()=>accessCredentials.id,{onDelete:"restrict"}),
  beforeState:jsonb("before_state"),afterState:jsonb("after_state"),
},t=>[
  foreignKey({name:"staff_management_session_actor",columns:[t.sessionId,t.actorId],foreignColumns:[staffSessions.id,staffSessions.staffId]}).onDelete("restrict"),
  foreignKey({name:"staff_management_credential_actor",columns:[t.credentialId,t.credentialVersion,t.actorId],foreignColumns:[accessCredentials.id,accessCredentials.version,accessCredentials.staffId]}).onDelete("restrict"),
  uniqueIndex("staff_create_intent").on(t.actorId,t.action,t.requestKey).where(sql`${t.targetStaffId} is null`),
  unique("staff_manage_intent").on(t.actorId,t.action,t.targetStaffId,t.requestKey),
  check("staff_management_shape",sql`${t.controlId}=1 and ${t.expectedRevision}>=0 and octet_length(${t.fingerprint})=32
    and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0
    and ${t.action} in ('CREATE','UPDATE','ROTATE') and ${t.outcome} in ('APPLIED','UNCHANGED','REJECTED')
    and ((${t.outcome}='REJECTED' and ${t.denialReason} is not null and ${t.denialReason} in ('STALE_VERSION','STAFF_CAPACITY')) or (${t.outcome}<>'REJECTED' and ${t.denialReason} is null))
    and ((${t.action}='CREATE' and ${t.targetStaffId} is null and ${t.displayName} is not null and ${t.role} is not null and ${t.enabled} is not null and ${t.enabled}=true)
      or (${t.action}='UPDATE' and ${t.targetStaffId} is not null and ${t.displayName} is not null and ${t.role} is not null and ${t.enabled} is not null)
      or (${t.action}='ROTATE' and ${t.targetStaffId} is not null and ${t.displayName} is null and ${t.role} is null and ${t.enabled} is null))
    and (${t.displayName} is null or (octet_length(${t.displayName}) between 1 and 120 and length(btrim(${t.displayName}))>0))
    and (${t.role} is null or ${t.role} in ('OWNER','ORGANISER'))
    and ((${t.action}='CREATE' and ${t.outcome}='APPLIED' and ${t.resultStaffId} is not null) or ((${t.action}<>'CREATE' or ${t.outcome}<>'APPLIED') and ${t.resultStaffId} is null))
    and ((${t.action} in ('CREATE','ROTATE') and ${t.outcome}='APPLIED' and ${t.resultCredentialId} is not null)
      or ((${t.action}='UPDATE' or ${t.outcome}<>'APPLIED') and ${t.resultCredentialId} is null))
    and (${t.action}='UPDATE' or ${t.outcome}<>'UNCHANGED')
    and (${t.beforeState} is null or (jsonb_typeof(${t.beforeState})='object' and octet_length(${t.beforeState}::text)<=1024))
    and (${t.afterState} is null or (jsonb_typeof(${t.afterState})='object' and octet_length(${t.afterState}::text)<=1024))`),
]);

export const operatorBootstraps=pgTable("operator_bootstraps",{
  id:id(),controlId:integer("control_id").notNull().references(()=>securityControl.id,{onDelete:"restrict"}),requestKey:uuid("request_key").notNull(),
  operator:text("operator").notNull(),osUser:text("os_user").notNull(),reason:text("reason").notNull(),recordedAt:instant("recorded_at").notNull(),
  fingerprint:bytes("fingerprint").notNull(),
  staffId:uuid("staff_id").notNull().references(()=>staffIdentities.id,{onDelete:"restrict"}),credentialId:uuid("credential_id").notNull().references(()=>accessCredentials.id,{onDelete:"restrict"}),
},t=>[unique("first_super_admin_once").on(t.controlId),unique("operator_bootstrap_intent").on(t.requestKey),check("operator_bootstrap_shape",sql`${t.controlId}=1
  and octet_length(${t.operator}) between 1 and 120 and octet_length(${t.osUser}) between 1 and 120
  and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0 and octet_length(${t.fingerprint})=32`)]);

export const staffCredentialIssues=pgTable("staff_credential_issues",{
  credentialId:uuid("credential_id").primaryKey().references(()=>accessCredentials.id,{onDelete:"restrict"}),
  managementId:uuid("management_id").references(()=>staffManagementOutcomes.id,{onDelete:"restrict"}),
  bootstrapId:uuid("bootstrap_id").references(()=>operatorBootstraps.id,{onDelete:"restrict"}),
},t=>[unique("management_one_credential").on(t.managementId),unique("bootstrap_one_credential").on(t.bootstrapId),check("staff_issue_source",sql`num_nonnulls(${t.managementId},${t.bootstrapId})=1`)]);
