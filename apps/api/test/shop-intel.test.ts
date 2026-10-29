import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { shopIntelBindings } from "../src/competition/shop-intel.js";
import { SHOP_PRICES } from "../src/competition/shop.js";
const binding=()=>({snapshot_id:randomUUID(),language:'cpp',snapshot_fingerprint:'a'.repeat(64),starter_sha256:'b'.repeat(64),
  data:{probe:{input:'7 5\n',output:'12\n'},scanner:{label:'Accumulator',text:'Review the accumulator update.',from_line:3,to_line:9}}});
test('reviewed intelligence bindings require exact hashes, four languages, bounded original clues and unique variants',()=>{
  const value=binding();assert.deepEqual(shopIntelBindings([value]),[value]);
  for(const change of [{language:'javascript'},{snapshot_id:'wrong'},{snapshot_fingerprint:'no'},{data:{...value.data,answer:'secret'}},
    {data:{...value.data,scanner:{...value.data.scanner,to_line:3}}},{data:{...value.data,probe:{input:'\ud800',output:''}}},
    {data:{...value.data,scanner:{...value.data.scanner,from_line:null}}}])assert.throws(()=>shopIntelBindings([{...value,...change}]));
  assert.throws(()=>shopIntelBindings([value,value]));assert.throws(()=>shopIntelBindings([]));assert.throws(()=>shopIntelBindings(Array(401).fill(value)));
  assert.equal(SHOP_PRICES['black-ice'],15000);assert.equal(SHOP_PRICES['hex-scanner'],750);
});
