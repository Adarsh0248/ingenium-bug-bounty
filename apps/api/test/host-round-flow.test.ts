import assert from "node:assert/strict";
import {test} from "node:test";
import {runLocalRoundFlow} from "./fixtures/host-round-flow.js";

test("burst fixture rejects an unbounded team count before creating any database", async () => {
  for (const teams of [0, 1, 101, 2.5, NaN])
    await assert.rejects(runLocalRoundFlow("postgres://invalid@127.0.0.1/unused", "postgres://invalid@127.0.0.1/unused", {} as never, [], "REAL_BURST", async () => {}, teams));
});

test("the installed round rehearsal refuses a foreign caller before creating databases or reading credentials",async()=>{
  await assert.rejects(runLocalRoundFlow("postgres://invalid@127.0.0.1/unused","postgres://invalid@127.0.0.1/unused",{} as never,[],"REAL",async()=>{throw new Error("Unexpected checkpoint write");}));
});
