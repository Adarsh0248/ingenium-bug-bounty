import type { Pool,PoolClient } from "pg";
import { AccessError,accessTransaction } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";

export async function judgeTransaction<T>(pool:Pool,clock:ClockGuard,work:(client:PoolClient)=>Promise<T>){
  try{return await accessTransaction(pool,clock,work,"EXCLUSIVE");}
  catch(error){
    if(error && typeof error==="object" && "code" in error && error.code==="22008"){
      clock.fault("CLOCK_REVERSED");throw new AccessError("CLOCK_UNTRUSTED");
    }
    throw error;
  }
}
