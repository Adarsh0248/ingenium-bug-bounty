import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { validateAnnouncement } from "../src/access/announcements.js";
import type { AnnouncementCommand } from "../src/access/announcements.js";
const input = (): AnnouncementCommand => ({
  arenaId: randomUUID(),
  requestKey: randomUUID(),
  scope: "EVENT",
  roundId: null,
  teamId: null,
  message: "Technical break\nResume shortly.",
  reason: "Organiser notice",
});
test("announcements validate exact audience shapes and UTF-8 byte budgets without rewriting prose", () => {
  const v = input();
  assert.doesNotThrow(() => validateAnnouncement(v));
  assert.doesNotThrow(() =>
    validateAnnouncement({ ...v, scope: "ROUND", roundId: randomUUID() }),
  );
  assert.doesNotThrow(() =>
    validateAnnouncement({ ...v, scope: "TEAM", teamId: randomUUID() }),
  );
  assert.doesNotThrow(() =>
    validateAnnouncement({
      ...v,
      message: "a".repeat(4096),
      reason: "b".repeat(1024),
    }),
  );
  for (const patch of [
    { scope: "ALL" },
    { roundId: randomUUID() },
    { teamId: randomUUID() },
    { scope: "TEAM" },
    { scope: "ROUND" },
    { scope: "TEAM", teamId: randomUUID(), roundId: randomUUID() },
    { arenaId: "bad" },
    { requestKey: "bad" },
    { message: " " },
    { reason: "\n" },
    { message: "a".repeat(4097) },
    { message: "\u00e9".repeat(2049) },
    { message: "\ud800" },
    { message: "text\0hidden" },
    { reason: "a".repeat(1025) },
  ])
    assert.throws(() =>
      validateAnnouncement({ ...v, ...patch } as AnnouncementCommand),
    );
  assert.equal(v.message, "Technical break\nResume shortly.");
});
