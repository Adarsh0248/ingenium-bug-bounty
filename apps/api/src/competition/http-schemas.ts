import { STAFF_ACTIONS } from "./service.js";
import { JUDGING_VIEWS } from "./staff-judging.js";
const id = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" };
const text = { type: "string", maxLength: 1024 }, time = { type: "string", format: "date-time", maxLength: 40 }, number = { type: "integer", minimum: 0, maximum: 10000000000 };
const object = (properties: Record<string, unknown>, required = Object.keys(properties).filter(key => key !== "own_code")) => ({ type: "object", additionalProperties: false, required, properties });
const nullable = (value: unknown) => ({ anyOf: [value, { type: "null" }] });
const list = (items: unknown, maxItems: number) => ({ type: "array", maxItems, items });
export const roundParams = object({ round_id: id }), outcomeParams = object({ round_id: id, request_key: id }), bountyParams = object({ round_id: id, bounty_id: id });
export const commandBody = object({ action: { type: "string", enum: STAFF_ACTIONS }, request_key: id, expected_revision: { type: "string", pattern: "^(0|[1-9][0-9]{0,18})$" }, reason: text,
  payload: { type: "object", maxProperties: 3 }, own_code: { type: "string", maxLength: 96 } }, ["action", "request_key", "expected_revision", "reason", "payload"]);
export const hintBody = object({ request_key: id, level: { type: "integer", minimum: 1, maximum: 3 } });
export const submitBody = object({ request_key: id, source: { type: "string", minLength: 1, maxLength: 131072 } });
export const publishBody = object({ run_id: id, review: text, request_key:id,expected_revision:{type:"string",pattern:"^[1-9][0-9]{0,18}$"},own_code:{type:"string",maxLength:96} });
export const publication = object({ outcome_id:id,snapshot_id:id,run_id:id,request_key:id,expected_revision:{type:"string",pattern:"^[1-9][0-9]{0,18}$"},outcome:{type:"string",enum:["APPLIED","REJECTED"]},reason:nullable({type:"string",enum:["STALE_VERSION","CONTENT_LOCKED","ARENA_ACTIVE","VALIDATION_NOT_PASSED","CLEANUP_PENDING"]}),recorded_at:time });
export const publicationOutcomeParams=object({snapshot_id:id,request_key:id});
export const publicationOutcome=object({status:{type:"string",enum:["OBSERVED","NOT_OBSERVED"]},outcome:nullable(publication)});
const result = object({ status: { type: "string", enum: ["APPLIED", "UNCHANGED", "REJECTED", "PURCHASED", "ALREADY_OWNED", "ADMITTED"] }, reason: text,
  round_id: id, duration_ms: number, purchase_id: id, submission_id: id, run_id: id, job_id: id, cancellation_id:id, receipt_order: number, received_at: time, hint_tier: { type: "integer", minimum: 0, maximum: 3 } }, ["status"]);
export const retryParams = object({ round_id: id, job_id: id });
export const retryBody = object({ request_key: id, reason: text, own_code: { type: "string", maxLength: 96 } });
export const judgingParams = object({ round_id: id, parent_id: id });
export const queueQuery = object({ after: id,view:{type:"string",enum:JUDGING_VIEWS},team_id:id,lane:{type:"string",enum:["OFFICIAL","SAMPLE"]} }, []);
const judgingParent={id,lane:{type:"string",enum:["OFFICIAL","SAMPLE"]},bounty_id:id,title:text,team_id:id,team_name:text,language:{type:"string",enum:["c","cpp","java","python","javascript"]},
  status:{type:"string",maxLength:32},result:nullable({type:"string",maxLength:32}),created_at:time,completed_at:nullable(time)};
export const queue = object({ parents: list(object({ ...judgingParent,
  jobs: list(object({ id, status: { type: "string", maxLength: 32 }, dispatches: { type: "integer", minimum: 0, maximum: 4 }, physically_held: { type: "boolean" } }), 20) }), 40), next_after: nullable(id),
  summary:object({total:number,unfinished:number,attention:number,completed:number,physically_held:number}),round_state:{type:"string",maxLength:16},server_time:time });
export const judgeDetail=object({parent:object({...judgingParent,started_at:nullable(time),receipt_order:nullable({type:"string",maxLength:19})}),role:{type:"string",enum:["OWNER","SUPER_ADMIN","ORGANISER"]},round_state:{type:"string",maxLength:16},server_time:time,
  jobs:list(object({id,status:{type:"string",maxLength:32},result:nullable({type:"string",maxLength:32}),available_at:time,completed_at:nullable(time),extra_authorised:{type:"boolean"},retry_allowed:{type:"boolean"},
    retry_reason:{type:"string",enum:["ROLE_REQUIRED","SAMPLE_RUN","ROUND_CLOSED","SETTLED","PHYSICAL_HOLD","EXTRA_DISPATCH_USED","AUTOMATIC_RECOVERY","NOT_INFRASTRUCTURE","ELIGIBLE"]},
    attempts:list(object({id,number:{type:"integer",minimum:1,maximum:4},send_state:{type:"string",enum:["PREPARED","SEND_STARTED"]},prepared_at:time,send_started_at:nullable(time),result:nullable({type:"string",maxLength:32}),resolved_at:nullable(time),released_at:nullable(time),next_poll_at:time}),4)}),20)});
export const recoveryAudit=object({items:list(object({id,actor_name:text,reason:text,recorded_at:time,decision:{type:"string",enum:["APPLIED","REJECTED"]},reason_code:nullable({type:"string",maxLength:64})}),40),next_after:nullable(id)});
export const recoveryAuditQuery=object({after:id},[]);
export const judging = object({ id, lane: { type: "string", enum: ["OFFICIAL", "SAMPLE"] }, bounty_id: id, language: { type: "string", enum: ["c", "cpp", "java", "python", "javascript"] },
  source: { type: "string", maxLength: 131072 }, status: { type: "string", enum: ["QUEUED", "JUDGING", "PROCESSING", "RECOVERING", "NEEDS_ATTENTION", "COMPLETED", "CANCELLED"] },
  result: nullable({ type: "string", maxLength: 32 }), created_at: time, completed_at: nullable(time),
  samples: list(object({ sample: { type: "integer", minimum: 1, maximum: 3 }, result: nullable({ type: "string", maxLength: 32 }),
    stdout_b64: nullable({ type: "string", maxLength: 23000 }), stderr_b64: nullable({ type: "string", maxLength: 90000 }), compiler_output_b64: nullable({ type: "string", maxLength: 90000 }),
    stdout_truncated: nullable({ type: "boolean" }), stderr_truncated: nullable({ type: "boolean" }), compiler_output_truncated: nullable({ type: "boolean" }) }), 3) });
export const receipt = object({ outcome_id: id, round_id: id, request_key: id, action: { type: "string", maxLength: 32 }, recorded_at: time, result });
export const outcome = object({ status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] }, outcome: nullable(receipt) });
const signedPoints={type:"integer",minimum:-1000000000000,maximum:1000000000000};
export const standings = object({ final: { type: "boolean" }, cancelled:{type:"boolean"}, standings: list(object({ team_round_id: id, team_id: id, team_name: text, overdrive:{type:"boolean"}, points: signedPoints, solve_time_ms: number,
  penalty_ms: number, effective_time_ms: number, difficulties: list({ type: "integer", minimum: 1, maximum: 100 }, 100), rank: nullable({ type: "integer", minimum: 1, maximum: 100 }) }, ["team_round_id","team_id","team_name","points","solve_time_ms","penalty_ms","effective_time_ms","difficulties","rank"]), 100) });
export const finalResults = object({ format_version:{type:"integer",const:1},state:{type:"string",const:"FINAL"},arena_id:id,round_id:id,round_kind:{type:"integer",enum:[1,2]},
  result_id:id,result_version:{type:"integer",minimum:1,maximum:100001},finalised_at:time,standings_sha256:{type:"string",pattern:"^[0-9a-f]{64}$"},
  qualification_status:{type:"string",enum:["PENDING","LOCKED","NOT_APPLICABLE"]},standings:list(object({team_round_id:id,team_id:id,team_name:text,rank:{type:"integer",minimum:1,maximum:100},
    points:signedPoints,solve_time_ms:number,penalty_ms:number,effective_time_ms:number,difficulties:list({type:"integer",minimum:1,maximum:100},100),qualified:nullable({type:"boolean"})}),100) });
export const cancellation = object({arena_id:id,round_id:id,revision:{type:"string",maxLength:19},state:{type:"string",maxLength:16},current:{type:"boolean"},held_executions:number,cancelled_work:number,pending_work:number,
  cancellation:nullable(object({cancellation_id:id,incident_ref:{type:"string",maxLength:120},reason:text,actor_name:text,started_at:time,finished_at:nullable(time)}))});
export const hints = list(object({ level: { type: "integer", minimum: 1, maximum: 3 }, content: { type: "string", maxLength: 16384 }, recorded_at: time }), 3);
export const state = object({
  round: object({ round_id: id, arena_instance_id: id, kind: { type: "integer", enum: [1, 2] }, state: { type: "string", maxLength: 16 }, duration_ms: { type: "string", maxLength: 19 },
    started_at: nullable(time), closes_at: nullable(time), revision: { type: "string", maxLength: 19 }, draw_commitment: nullable({ type: "string", maxLength: 64 }),
    draw_reveal: nullable(object({ version: { type: "integer", const: 1 }, round_id: id, roster: list(id, 100), permutation: list(id, 100), salt: { type: "string", maxLength: 64 } })), final: { type: "boolean" } }),
  bounties: list(object({ category: nullable({type:"string",enum:["ARRAYS","GRAPHS","SYSTEMS","LOGIC"]}), captured: {type:"boolean"}, bounty_id: id, title: text, difficulty: { type: "integer", minimum: 1, maximum: 100 }, base_bounty: number, claimed: { type: "boolean" }, hint_tier: { type: "integer", minimum: 0, maximum: 3 } }), 100),
  pauses: list(object({ scope: { type: "string", enum: ["GLOBAL", "TEAM", "MEMBER"] }, team_round_id: nullable(id), member_round_id: nullable(id) }), 301), wallet: nullable(number),
});
const publishedItem = object({ snapshot_id:id,definition_id:id,title:text,difficulty:{type:"integer",minimum:1,maximum:100},base_bounty:number,round_type:{type:"integer",enum:[1,2]} });
export const controlQuery = object({ arena_id:id }, []);
export const publishedQuery = object({ kind:{type:"string",enum:["1","2"]},after:id }, ["kind"]);
export const publishedPage = object({ items:list(publishedItem,50),next_after:nullable(id) });
export const controlRoom = object({ server_time:time,session_id:id,role:{type:"string",enum:["OWNER","ORGANISER","SUPER_ADMIN"]},control_revision:{type:"string",maxLength:19},
  instance:nullable(object({instance_id:id,status:{type:"string",maxLength:16},current:{type:"boolean"}})),
  rounds:list(object({round_id:id,kind:{type:"integer",enum:[1,2]},state:{type:"string",maxLength:16},duration_ms:{type:"string",maxLength:19},
    revision:{type:"string",maxLength:19},configuration_revision:{type:"string",maxLength:19},selected:list(publishedItem,100),
    teams:list(object({team_id:id,team_name:text,team_round_id:nullable(id),members:list(object({member_id:id,member_name:text,position:{type:"integer",enum:[1,2]},
      member_round_id:nullable(id),language:nullable({type:"string",maxLength:16})}),2)}),100)}),2),qualified_team_ids:nullable(list(id,50)) });
