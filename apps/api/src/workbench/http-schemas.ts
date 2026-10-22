const id={type:"string",pattern:"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"};
const revision={type:"string",pattern:"^(0|[1-9][0-9]{0,18})$"},time={type:"string",format:"date-time",maxLength:40};
const object=(properties:Record<string,unknown>)=>({type:"object",additionalProperties:false,required:Object.keys(properties),properties});
const nullable=(schema:unknown)=>({anyOf:[schema,{type:"null"}]});
const language={type:"string",enum:["c","cpp","java","python","javascript"]};
const gate={writable:{type:"boolean"},reason:nullable({type:"string",enum:["PAUSED","BOUNTY_UNAVAILABLE","ROUND_NOT_WRITABLE"]})};
export const params=object({round_id:id,bounty_id:id});
export const saveBody=object({request_key:id,base_revision:revision,source:{type:"string",maxLength:1048576}});
export const openBody=object({request_key:id});
export const outcomeParams=object({round_id:id,bounty_id:id,request_key:id});
export const sampleParams=object({round_id:id,bounty_id:id,sample_number:{type:"string",pattern:"^[1-3]$"},field:{type:"string",enum:["input","expected_output"]}});
export const receipt=object({outcome_id:id,round_id:id,member_round_id:id,bounty_id:id,request_key:id,base_revision:revision,
  outcome:{type:"string",enum:["SAVED","UNCHANGED","CONFLICT","REJECTED"]},reason_code:nullable({type:"string",enum:["REVISION_MISMATCH","PAUSED","BOUNTY_UNAVAILABLE","ROUND_NOT_WRITABLE","DRAFT_TOO_LARGE"]}),result_revision:nullable(revision),recorded_at:time});
export const outcome=object({status:{type:"string",enum:["OBSERVED","NOT_OBSERVED"]},outcome:nullable(receipt)});
export const opening=object({opening_id:id,request_key:id,recorded_at:time});
export const draft=object({draft_id:nullable(id),round_id:id,bounty_id:id,member_round_id:id,language,revision,source:{type:"string",maxLength:131072},source_kind:{type:"string",enum:["DRAFT","STARTER"]},created_at:nullable(time),updated_at:nullable(time),...gate});
export const starter=object({bounty_id:id,language,source:{type:"string",maxLength:131072}});
export const statement=object({bounty_id:id,statement:{type:"string",maxLength:65536}});
export const sample=object({bounty_id:id,sample_number:{type:"integer",minimum:1,maximum:3},field:{type:"string",enum:["input","expected_output"]},content:{type:"string",maxLength:1048576},byte_length:{type:"integer",minimum:0,maximum:1048576}});
export const metadata=object({round_id:id,bounty_id:id,member_round_id:id,title:{type:"string",maxLength:160},difficulty:{type:"integer",minimum:1,maximum:100},base_bounty:{type:"integer",minimum:10,maximum:1000},
  submission_format:{type:"string",const:"FULL_PROGRAM"},checker_mode:{type:"string",enum:["TOKENS","EXACT_TEXT"]},language,cpu_ms:{type:"integer",minimum:1,maximum:4000},wall_ms:{type:"integer",minimum:1,maximum:15000},memory_kb:{type:"integer",minimum:1,maximum:524288},
  samples:{type:"array",maxItems:3,items:object({sample_number:{type:"integer",minimum:1,maximum:3},input_bytes:{type:"integer",minimum:0,maximum:1048576},output_bytes:{type:"integer",minimum:0,maximum:1048576}})},
  claimed:{type:"boolean"},historical:{type:"boolean"},...gate,official_pending:{type:"boolean"},unfinished_runs:{type:"integer",minimum:0,maximum:2},hint_tier:{type:"integer",minimum:0,maximum:3},server_time:time});
export const sourceParams=object({round_id:id,bounty_id:id,submission_id:id});
export const submittedSource=object({submission_id:id,member_round_id:id,language,source:{type:"string",maxLength:131072},received_at:time,read_only:{type:"boolean",const:true}});
export const historyQuery={type:"object",additionalProperties:false,properties:{after:revision}};
export const submissions=object({submissions:{type:"array",maxItems:50,items:object({submission_id:id,member_round_id:id,language,receipt_order:revision,received_at:time,
  status:{type:"string",enum:["QUEUED","JUDGING","PROCESSING","RECOVERING","NEEDS_ATTENTION","COMPLETED","CANCELLED"]},result:nullable({type:"string",maxLength:32})})},next_after:nullable(revision)});
