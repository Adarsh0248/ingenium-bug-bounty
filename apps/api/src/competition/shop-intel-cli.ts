import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrationDatabaseUrl } from "../db/migrate.js";
import { installShopIntel } from "./shop-intel.js";

async function main(){
  const [flag,path,...rest]=process.argv.slice(2);
  if(flag!=="--bindings"||!path||rest.length)throw new Error("Usage: shop-intel-cli --bindings <private-reviewed-json>");
  const bytes=await readFile(path);
  if(bytes.length>67108864)throw new Error("Intelligence import exceeds 64 MiB.");
  const pool=new Pool({connectionString:migrationDatabaseUrl(process.env),max:1,connectionTimeoutMillis:5000});
  try{console.log(JSON.stringify({state:"INSTALLED",...await installShopIntel(pool,JSON.parse(bytes.toString('utf8')))}));}
  finally{await pool.end();}
}
void main().catch(()=>{console.error("Intelligence installation failed. Preserve the reviewed bindings; no partial import was committed.");process.exitCode=1;});
