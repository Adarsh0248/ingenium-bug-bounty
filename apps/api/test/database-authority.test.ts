import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { assertApiDatabase } from "../src/database.js";

test("protected API startup accepts only a positive restricted-role attestation", async () => {
  for (const value of [true, false, undefined, null, "true"]) {
    const pool = {
      query: async () => ({
        rows: value === undefined ? [] : [{ allowed: value }],
      }),
    } as unknown as Pool;
    if (value === true) await assertApiDatabase(pool);
    else
      await assert.rejects(
        assertApiDatabase(pool),
        /Restricted event API credentials/,
      );
  }
  const unavailable = {
    query: async () => {
      throw new Error("Synthetic unavailable role lookup");
    },
  } as unknown as Pool;
  await assert.rejects(assertApiDatabase(unavailable), /Synthetic unavailable/);
});
