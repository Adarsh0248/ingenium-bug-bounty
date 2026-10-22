export interface StreamHead { stream_id:string; kind:string; schema_version:number; head:string; retained_from:string; }
export interface LiveEvent { stream_id:string; sequence:string; event_id:string; resource_revision:string; schema_version:number; patch:Record<string,unknown>; }
export const LIVE_LIMITS={syncMs:10000,headMs:5000,staleMs:10000,pollMs:250,bufferEvents:256,bufferBytes:524288,presenceRenewMs:15000,presenceTtlMs:45000} as const;
export function plainObject(value:unknown):value is Record<string,unknown> { return typeof value==="object" && value!==null && !Array.isArray(value); }
export function exactObject(value:unknown,keys:string[]):value is Record<string,unknown> { return plainObject(value) && Object.keys(value).every(k=>keys.includes(k)); }
export function decimal(value:unknown):value is string {return typeof value==="string" && /^(0|[1-9]\d{0,18})$/.test(value) && BigInt(value)<=9223372036854775807n;}
