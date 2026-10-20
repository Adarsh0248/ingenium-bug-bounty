import { LANGUAGES } from "./credentials.js";
import { ACTIONS } from "../content/policy.js";

const id = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" };
const instant = { type: "string", format: "date-time", maxLength: 24 };
const token = { type: "string", minLength: 16, maxLength: 512 };
const name = { type: "string", minLength: 1, maxLength: 120 };
const audience = { type: "string", enum: ["ANONYMOUS", "ENTRY", "REPLACEMENT", "PARTICIPANT", "STAFF_ENTRY", "STAFF", "STAFF_RECOVERY_ENTRY", "STAFF_RECOVERY"] };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, required, properties });
const nullableId = { anyOf: [id, { type: "null" }] };

export const empty = object({});
export const bootstrapQuery = object({ audience });
export const verifyBody = object({ code: { type: "string", minLength: 32, maxLength: 96, pattern: "^[A-Za-z2-7 -]+$" } });
export const activationBody = object({ member_id: id, language: { type: "string", enum: LANGUAGES }, request_key: id });
export const sessionSchema = object({ session_id: id, member_id: id, member_round_id: id, team_id: id, round_id: id,
  language: { type: "string", enum: LANGUAGES }, member_name: name, team_name: name,
  round_state: { type: "string", enum: ["DRAFT", "READY", "RUNNING", "PAUSED", "CLOSING", "CLOSED", "CANCELLING", "CANCELLED"] },
  expires_at: instant, absolute_expires_at: instant, warning_at: instant });
export const flowSchema = object({ flow_id: id, state: { type: "string", enum: ["OPEN", "ACTIVATED"] }, expires_at: instant,
  team_name: name, members: { type: "array", minItems: 2, maxItems: 2, items: object({ id, name }) }, round_id: nullableId });
export const staffFlow = object({ flow_id: id, mode: { type: "string", enum: ["NORMAL","CLOCK_RECOVERY"] }, expires_at: instant });
export const staffSession = object({ session_id: id, staff_id: id, display_name: name, role: { type: "string", enum: ["ORGANISER","OWNER","SUPER_ADMIN"] },
  mode: { type: "string", enum: ["NORMAL","CLOCK_RECOVERY"] }, expires_at: instant, absolute_expires_at: instant, warning_at: instant });
export const replacementView = object({ request_id: id, state: { type: "string", enum: ["PENDING", "APPROVED", "ACTIVATED"] }, expires_at: instant });
export const replacementRequestBody = object({ member_id: id, request_key: id });
export const replacementRequestData = { oneOf: [object({ status: { const: "RESUME", type: "string" }, session: sessionSchema, csrf_token: token }),
  object({ status: { const: "REQUESTED", type: "string" }, request: replacementView, csrf_token: token })] };
export const staffActivationBody = object({ request_key: id });
export const clockClearBody = object({ own_code: verifyBody.properties.code, request_key: id, runtime_id: id,
  generation: { type: "string", pattern: "^[1-9][0-9]{0,18}$" }, reason: { type: "string", minLength: 1, maxLength: 1024 } });
export const clockStatus = object({ runtime_id: id, fault_generation: { type: "string", maxLength: 19 }, fault_latched: { type: "boolean" },
  state: { type: "string", enum: ["FAULT","HEALTHY","WARNING"] }, healthy_count: { type: "integer", const: 7 } });
export const clockClearData = object({ clearance_id: id, generation: { type: "string", maxLength: 19 }, cleared: { type: "boolean", const: true } });
const error = object({ schema_version: { const: 1, type: "integer" }, trace_id: id,
  error: object({ code: { type: "string", maxLength: 64 }, outcome: { type: "string", enum: ["NOT_PROCESSED", "UNKNOWN"] } }) });
export const envelope = (data: unknown) => object({ schema_version: { const: 1, type: "integer" }, trace_id: id, data });
export const responses = (data: unknown) => ({ 200: envelope(data), default: error });
export const bootstrapData = { oneOf: [object({ audience: { type: "string", const: "ANONYMOUS" }, csrf_token: token }),
  object({ audience: { type: "string", const: "ENTRY" }, csrf_token: token, flow: flowSchema }),
  object({ audience: { type: "string", const: "REPLACEMENT" }, csrf_token: token, request: replacementView }),
  object({ audience: { type: "string", const: "PARTICIPANT" }, csrf_token: token, session: sessionSchema }),
  object({ audience: { type: "string", enum: ["STAFF_ENTRY","STAFF_RECOVERY_ENTRY"] }, csrf_token: token, flow: staffFlow }),
  object({ audience: { type: "string", enum: ["STAFF","STAFF_RECOVERY"] }, csrf_token: token, session: staffSession })] };
export const verifyData = { oneOf: [object({ audience: { type: "string", const: "TEAM" }, csrf_token: token, flow: flowSchema }),
  object({ audience: { type: "string", const: "STAFF" }, csrf_token: token, flow: staffFlow })] };
export const staffActivationData = object({ session: staffSession, csrf_token: token });
export const staffSessionData = object({ session: staffSession });
export const signedOut = object({ signed_out: { type: "boolean", const: true } });
export const participantSessionCommand = object({ session_id: id, request_key: id });
export const participantSessionReceipt = object({ session_id: id, request_key: id, action: { type: "string", enum: ["KEEP_ALIVE", "LOGOUT"] },
  recorded_at: instant, expires_at: instant });
export const participantKeepAliveData = object({ session: sessionSchema, receipt: participantSessionReceipt });
export const participantLogoutData = object({ signed_out: { type: "boolean", const: true }, receipt: participantSessionReceipt });
export const participantOutcomeData = object({ status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] },
  receipt: { anyOf: [participantSessionReceipt, { type: "null" }] } });
const revision={type:"string",pattern:"^(0|[1-9][0-9]{0,18})$"};
const reason={type:"string",minLength:1,maxLength:1024};
export const replacementParams = object({ request_id: id });
export const replacementDecisionBody = object({ request_key: id, action: { type: "string", enum: ["APPROVE", "REJECT"] }, expected_revision: revision, reason });
export const replacementReceipt = object({ outcome_id: id, request_id: id, request_key: id, action: { type: "string", enum: ["APPROVE", "REJECT"] },
  expected_revision: revision, outcome: { type: "string", enum: ["APPLIED", "REJECTED"] }, recorded_at: instant,
  reason: { anyOf: [{ type: "string", enum: ["STALE_REQUEST", "EXPIRED", "ROUND_UNAVAILABLE", "ACCESS_UNAVAILABLE", "HANDOFF_RESERVED"] }, { type: "null" }] } });
export const replacementOutcomeParams = object({ request_key: id });
export const replacementOutcomeData = object({ status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] }, receipt: { anyOf: [replacementReceipt, { type: "null" }] } });
export const replacementListData = object({ items: { type: "array", maxItems: 50, items: object({ request_id: id, member_name: name, team_name: name,
  state: { type: "string", enum: ["PENDING", "APPROVED"] }, expected_revision: revision, created_at: instant, expires_at: instant }) }, next_after: nullableId });
const managedRole={type:"string",enum:["OWNER","ORGANISER"]};
const managementBase={request_key:id,expected_revision:revision,own_code:verifyBody.properties.code,reason};
export const staffCreateBody=object({...managementBase,display_name:name,role:managedRole});
export const staffUpdateBody=object({...managementBase,display_name:name,role:managedRole,enabled:{type:"boolean"}});
export const staffRotateBody=object(managementBase);
export const staffTargetParams=object({staff_id:id});
export const staffListQuery=object({after:id},[]);
const staffStateProperties={staff_id:id,display_name:name,role:{type:"string",enum:["OWNER","ORGANISER","SUPER_ADMIN"]},enabled:{type:"boolean"},revision,code_version:revision};
const staffState=object(staffStateProperties);
const nullableState={anyOf:[staffState,{type:"null"}]};
export const staffManagementReceipt=object({outcome_id:id,action:{type:"string",enum:["CREATE","UPDATE","ROTATE"]},target_staff_id:nullableId,
  request_key:id,expected_revision:revision,outcome:{type:"string",enum:["APPLIED","UNCHANGED","REJECTED"]},
  reason:{anyOf:[{type:"string",enum:["STALE_VERSION","STAFF_CAPACITY"]},{type:"null"}]},recorded_at:instant,result_staff_id:nullableId,
  code_issued:{type:"boolean"},before:nullableState,after:nullableState});
export const staffManagementData=object({outcome:staffManagementReceipt,issued_code:{anyOf:[{type:"string",pattern:"^[A-Z2-7]{32}$"},{type:"null"}]}});
export const staffListData=object({control_revision:revision,items:{type:"array",maxItems:50,items:object({...staffStateProperties,has_active_code:{type:"boolean"}})},next_after:nullableId});
export const staffOutcomeParams=object({action:{type:"string",enum:["CREATE","UPDATE","ROTATE"]},target:{anyOf:[id,{type:"string",const:"security"}]},request_key:id});
export const staffOutcomeData=object({status:{type:"string",enum:["OBSERVED","NOT_OBSERVED"]},outcome:{anyOf:[staffManagementReceipt,{type:"null"}]}});
const duration = { type: "integer", minimum: 1, maximum: 18000000 };
export const arenaSetupBody = object({ request_key: id, expected_revision: revision, duration_ms: duration,
  team_ids: { type: "array", maxItems: 100, uniqueItems: true, items: id }, reason });
export const arenaRoundParams = object({ round_id: id });
export const arenaSetupReceipt = object({ outcome_id: id, action: { type: "string", enum: ["CREATE", "CONFIGURE"] }, target_round_id: nullableId,
  request_key: id, expected_revision: revision, outcome: { type: "string", enum: ["APPLIED", "UNCHANGED", "REJECTED"] },
  reason: { anyOf: [{ type: "string", enum: ["STALE_VERSION", "ARENA_RESERVED", "ROUND_UNAVAILABLE", "TEAM_INCOMPLETE"] }, { type: "null" }] },
  recorded_at: instant, instance_id: nullableId, round_id: nullableId, configuration_revision: { anyOf: [revision, { type: "null" }] } });
export const arenaOutcomeParams = object({ action: { type: "string", enum: ["CREATE", "CONFIGURE"] },
  target: { anyOf: [id, { type: "string", const: "arena" }] }, request_key: id });
export const arenaOutcomeData = object({ status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] }, outcome: { anyOf: [arenaSetupReceipt, { type: "null" }] } });
const arenaTeam = object({ team_id: id, team_name: name, members: { type: "array", maxItems: 2,
  items: object({ member_id: id, position: { type: "integer", enum: [1, 2] }, member_name: name }) } });
export const arenaTeamsData = object({ items: { type: "array", maxItems: 50, items: arenaTeam }, next_after: nullableId });
export const arenaCurrentData = object({ control_revision: revision, instance: { anyOf: [object({ instance_id: id,
  status: { type: "string", enum: ["SETUP", "IN_PROGRESS", "COMPLETED", "DISCARDED"] }, revision, created_at: instant }), { type: "null" }] },
  round: { anyOf: [object({ round_id: id, kind: { type: "integer", const: 1 }, state: sessionSchema.properties.round_state,
    duration_ms: duration, configuration_revision: revision, teams: { type: "array", maxItems: 100, items: arenaTeam }, can_start: { type: "boolean", const: false } }), { type: "null" }] } });
export const contentCommandBody = object({ request_key: id, expected_revision: revision, reason, payload: { type: "object" } });
export const contentDefinitionParams = object({ definition_id: id });
export const contentVersionParams = object({ version_id: id });
export const contentOperationParams = object({ version_id: id, operation: { type: "string", enum: ACTIONS.filter(a => a !== "CREATE" && a !== "NEW_VERSION") } });
export const contentVariantParams = object({ version_id: id, language: { type: "string", enum: LANGUAGES } });
export const contentCaseParams = object({ version_id: id, case_id: id });
export const contentReceipt = object({ outcome_id: id, action: { type: "string", enum: ACTIONS }, request_key: id, expected_revision: revision,
  outcome: { type: "string", enum: ["APPLIED", "UNCHANGED", "REJECTED"] }, reason: { anyOf: [{ type: "string", enum: ["STALE_VERSION", "CONTENT_LOCKED", "POSITION_OCCUPIED", "CASE_UNAVAILABLE", "VARIANT_MISSING", "REFERENCED_CASE", "INVALID_ORDER"] }, { type: "null" }] },
  recorded_at: instant, definition_id: nullableId, version_id: nullableId, content_revision: { anyOf: [revision, { type: "null" }] }, case_id: nullableId });
export const contentOutcomeParams = object({ action: { type: "string", enum: ACTIONS }, target: { anyOf: [id, { type: "string", const: "catalogue" }] }, request_key: id });
export const contentOutcomeData = object({ status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] }, outcome: { anyOf: [contentReceipt, { type: "null" }] } });
const contentProperties = { version_id: id, definition_id: id, version_number: { type: "integer", minimum: 1, maximum: 1000 },
  title: { type: "string", maxLength: 160 }, difficulty: { type: "integer", minimum: 1, maximum: 100 }, base_bounty: { type: "integer", minimum: 10, maximum: 1000 },
  publication_status: { type: "string", enum: ["DRAFT", "PUBLISHED"] }, content_revision: revision, round_type: { type: "integer", enum: [1, 2] }, definition_revision: revision };
const lang = { type: "string", enum: LANGUAGES }, byteCount = { type: "integer", minimum: 0, maximum: 1048576 }, level = { type: "integer", minimum: 1, maximum: 3 };
const nullableRuntime = { anyOf: [{ type: "string", maxLength: 64 }, { type: "null" }] };
export const contentListData = object({ control_revision: revision, catalogue_bytes: revision, items: { type: "array", maxItems: 50, items: object(contentProperties) }, next_after: nullableId });
export const contentDescribeData = object({ ...contentProperties, statement: { type: "string", maxLength: 65536 }, submission_format: { type: "string", const: "FULL_PROGRAM" },
  checker_mode: { type: "string", enum: ["TOKENS", "EXACT_TEXT"] }, checker_version: { type: "string", const: "ingenium-text-v1" }, can_publish: { type: "boolean", const: false },
  variants: { type: "array", maxItems: 5, items: object({ language: lang, runtime_key: nullableRuntime, starter_bytes: byteCount, reference_bytes: byteCount }) },
  cases: { type: "array", maxItems: 20, items: object({ case_id: id, position: { type: "integer", minimum: 1, maximum: 20 }, visibility: { type: "string", enum: ["SAMPLE", "HIDDEN"] }, input_bytes: byteCount, expected_bytes: byteCount }) },
  hints: { type: "array", maxItems: 3, items: object({ hint_id: id, level, content_bytes: byteCount }) } });
const nullableLimit = { anyOf: [{ type: "integer", minimum: 1, maximum: 524288 }, { type: "null" }] };
export const contentPrivateData = object({ version_id: id, section: { type: "string", enum: ["VARIANTS", "CASES", "HINTS", "WITNESSES"] }, data: { anyOf: [
  object({ variant_id: id, language: lang, starter_code: { type: "string", maxLength: 131072 }, reference_solution_code: { type: "string", maxLength: 131072 },
    defect_description: { type: "string", maxLength: 16384 }, runtime_key: nullableRuntime, cpu_time_limit_ms: nullableLimit, wall_time_limit_ms: nullableLimit, memory_limit_kb: nullableLimit }),
  object({ case_id: id, position: { type: "integer", minimum: 1, maximum: 20 }, visibility: { type: "string", enum: ["SAMPLE", "HIDDEN"] },
    input_data: { type: "string", maxLength: 1048576 }, expected_output: { type: "string", maxLength: 1048576 } }),
  { type: "array", maxItems: 3, items: object({ hint_id: id, level, content: { type: "string", maxLength: 16384 } }) },
  { type: "array", maxItems: 15, items: object({ language: lang, position: level, check_type: { type: "string", enum: ["COMPILATION", "TEST_CASE"] },
    test_case_id: nullableId, expected_failure: { type: "string", enum: ["WRONG_OUTPUT", "COMPILATION_ERROR", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED"] } }) },
] } });
export const activationData = object({ status: { type: "string", const: "ACTIVATED" }, csrf_token: token, session: sessionSchema });
export const validationPrepareBody = object({ request_key:id,expected_revision:revision,reason });
const notExecutable = { can_execute:{ type:"boolean",const:false },can_publish:{ type:"boolean",const:false } };
export const validationPrepareReceipt = object({ outcome_id:id,version_id:id,request_key:id,expected_revision:revision,
  outcome:{ type:"string",enum:["APPLIED","UNCHANGED","REJECTED"] },
  reason:{ anyOf:[{ type:"string",enum:["STALE_VERSION","CONTENT_LOCKED","CONTENT_INCOMPLETE","ARENA_ACTIVE"] },{ type:"null" }] },
  issues:{ type:"array",maxItems:128,items:object({ code:{ type:"string",maxLength:64 },language:{ anyOf:[lang,{ type:"null" }] },
    case_id:nullableId,hint_level:{ anyOf:[level,{ type:"null" }] } }) },recorded_at:instant,snapshot_id:nullableId,...notExecutable });
export const validationOutcomeParams = object({ version_id:id,request_key:id });
export const validationOutcomeData = object({ status:{ type:"string",enum:["OBSERVED","NOT_OBSERVED"] },outcome:{ anyOf:[validationPrepareReceipt,{ type:"null" }] } });
export const validationSnapshotParams = object({ snapshot_id:id });
export const validationRunParams = object({run_id:id});
export const validationRunOutcomeParams = object({snapshot_id:id,request_key:id});
export const validationRunReceipt = object({outcome_id:id,snapshot_id:id,request_key:id,expected_revision:revision,outcome:{type:"string",enum:["ADMITTED","REJECTED"]},
  reason:{anyOf:[{type:"string",enum:["STALE_VERSION","CONTENT_LOCKED","ARENA_ACTIVE"]},{type:"null"}]},recorded_at:instant,run_id:nullableId});
export const validationRunOutcomeData = object({status:{type:"string",enum:["OBSERVED","NOT_OBSERVED"]},outcome:{anyOf:[validationRunReceipt,{type:"null"}]}});
const optionalInstant = {anyOf:[instant,{type:"null"}]};
const validationResult = {type:"string",enum:["PASSED","WRONG_ANSWER","COMPILATION_ERROR","RUNTIME_ERROR","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED","OUTPUT_LIMIT_EXCEEDED","INFRA_ERROR"]};
export const validationRunReport = object({run_id:id,snapshot_id:id,configuration_fingerprint:{type:"string",pattern:"^[0-9a-f]{64}$"},status:{type:"string",enum:["QUEUED","RUNNING","PASSED","FAILED","INFRA_ERROR"]},
  created_at:instant,deadline_at:instant,started_at:optionalInstant,finished_at:optionalInstant,physical_pending:{type:"boolean"},can_publish:{type:"boolean",const:false},
  checks:{type:"array",minItems:15,maxItems:115,items:object({check_id:id,language:lang,source_role:{type:"string",enum:["REFERENCE","STARTER"]},check_type:{type:"string",enum:["TEST_CASE","COMPILATION"]},case_id:nullableId,
    witness_position:{anyOf:[level,{type:"null"}]},expected_result:validationResult,result:{anyOf:[validationResult,{type:"null"}]},available_at:instant,completed_at:optionalInstant,
    attempts:{type:"integer",minimum:0,maximum:3},physical_pending:{type:"boolean"}})}});
export const validationSnapshotData = object({ snapshot_id:id,version_id:id,content_revision:revision,fingerprint:{ type:"string",pattern:"^[0-9a-f]{64}$" },
  created_at:instant,planned_checks:{ type:"integer",minimum:15,maximum:115 },validation_run_id:{ type:"null" },...notExecutable,
  checks:{ type:"array",maxItems:115,items:object({ check_id:id,position:{ type:"integer",minimum:1,maximum:115 },variant_id:id,language:lang,
    source_role:{ type:"string",enum:["REFERENCE","STARTER"] },check_type:{ type:"string",enum:["COMPILATION","TEST_CASE"] },case_id:nullableId,
    witness_position:{ anyOf:[level,{ type:"null" }] },expected_result:{ type:"string",enum:["PASSED","WRONG_ANSWER","COMPILATION_ERROR","RUNTIME_ERROR","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED"] } }) } });
export const rejection = envelope(object({ status: { type: "string", const: "REJECTED" }, reason: { type: "string", enum: ["ALREADY_ENROLLED", "ROUND_UNAVAILABLE", "ACCESS_UNAVAILABLE"] } }));
