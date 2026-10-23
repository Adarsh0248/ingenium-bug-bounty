import assert from "node:assert/strict";
import { test } from "node:test";
import { backupFixture } from "./integration/backup-fixture.js";

test("backup drills refuse absent, mutable or malformed image references before Docker or filesystem allocation", async () => {
  const previous = process.env.INGENIUM_TEST_BACKUP_IMAGE;
  try {
    for (const image of [
      undefined,
      "",
      "postgres:latest",
      "sha256:abc",
      `sha256:${"a".repeat(65)}`,
    ]) {
      if (image === undefined) delete process.env.INGENIUM_TEST_BACKUP_IMAGE;
      else process.env.INGENIUM_TEST_BACKUP_IMAGE = image;
      await assert.rejects(backupFixture(), /Supply the immutable ID/);
    }
  } finally {
    if (previous === undefined) delete process.env.INGENIUM_TEST_BACKUP_IMAGE;
    else process.env.INGENIUM_TEST_BACKUP_IMAGE = previous;
  }
});
