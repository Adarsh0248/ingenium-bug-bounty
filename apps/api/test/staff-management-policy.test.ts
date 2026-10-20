import assert from "node:assert/strict";
import { test } from "node:test";
import { commandFingerprint } from "../src/access/credentials.js";
import { boundedStaffText,staffRevision } from "../src/access/staff-management.js";
import { maintenanceDatabaseUrl } from "../src/access/staff-bootstrap.js";

test("typed command fingerprints distinguish lengths, nulls, booleans and field order",()=>{
  const examples=[["ab","c"],["a","bc"],[null],[""],[true],["1"],[false],["0"],["a","b"],["b","a"]] as const;
  assert.equal(new Set(examples.map(v=>commandFingerprint(v).toString("hex"))).size,examples.length);
  assert.deepEqual(commandFingerprint(["CREATE",null,"0","name","OWNER",true,"reason"]),commandFingerprint(["CREATE",null,"0","name","OWNER",true,"reason"]));
});
test("staff management bounds exact UTF-8 labels, reasons and canonical revisions",()=>{
  assert.equal(boundedStaffText(String.fromCodePoint(0xe9).repeat(60),120).length,60);
  for(const value of [null,""," ","a\0b","x".repeat(121),"\ud800"])assert.throws(()=>boundedStaffText(value,120));
  for(const value of [1,"01","-1","9223372036854775807","1e2"])assert.throws(()=>staffRevision(value));
  assert.equal(staffRevision("0"),"0");
});
test("operator setup never falls back to runtime credentials or a remote/database-URL override",()=>{
  assert.throws(()=>maintenanceDatabaseUrl({DATABASE_URL:"postgresql://ingenium_api:secret@localhost/test"}));
  for(const url of ["postgresql://ingenium_api:secret@localhost/test","postgresql://owner:secret@remote.test/test","postgresql://owner:secret@localhost/test?options=x"])
    assert.throws(()=>maintenanceDatabaseUrl({STAFF_MAINTENANCE_DATABASE_URL:url}));
  assert.equal(maintenanceDatabaseUrl({STAFF_MAINTENANCE_DATABASE_URL:"postgresql://owner:secret@127.0.0.1/test"}),"postgresql://owner:secret@127.0.0.1/test");
});
