import type { Pool } from "pg";
import type { ClockGuard } from "../access/transaction.js";
import type { SessionDelivery } from "../access/credentials.js";
import { sha256, uuid } from "../access/credentials.js";
import { boundedStaffText, staffRevision } from "../access/staff-management.js";
import {
  createStaffService,
  staffActionVerifier,
  staffOutcomeCapacity,
} from "../access/staff-service.js";
import { staffQuota } from "../access/quotas.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
  advanceRoundTime,
} from "../access/transaction.js";

interface Publication {
  id: string;
  snapshot_id: string;
  run_id: string;
  request_key: string;
  expected_revision: string;
  outcome: string;
  denial_reason: string | null;
  recorded_at: Date;
}
function receipt(r: Publication) {
  return {
    outcome_id: r.id,
    snapshot_id: r.snapshot_id,
    run_id: r.run_id,
    request_key: r.request_key,
    expected_revision: r.expected_revision,
    outcome: r.outcome,
    reason: r.denial_reason,
    recorded_at: r.recorded_at.toISOString(),
  };
}
export function createPublicationService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  async function budget(cookie: unknown, write = false, confirm = false) {
    const actor = await staff.inspect(cookie);
    await staffQuota(
      pool,
      clock,
      actor.staff_id,
      write ? "STAFF_COMMAND" : "READ_STAFF",
    );
    if (confirm) await staffQuota(pool, clock, actor.staff_id, "STAFF_CONFIRM");
  }
  return {
    async publish(
      cookie: unknown,
      input: {
        snapshotId: string;
        runId: string;
        requestKey: string;
        expectedRevision: string;
        review: string;
        ownCode?: string | undefined;
      },
    ) {
      uuid(input.snapshotId);
      uuid(input.runId);
      uuid(input.requestKey);
      staffRevision(input.expectedRevision);
      boundedStaffText(input.review, 1024);
      if (input.expectedRevision === "0")
        throw new AccessError("INVALID_CONTEXT");
      await budget(cookie, true, input.ownCode !== undefined);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          await client.query("SELECT * FROM lock_arena_control(true)");
          const rounds = (
            await client.query<{ id: string }>(
              "SELECT r.id FROM rounds r JOIN arena_control c ON c.current_instance_id=r.arena_instance_id ORDER BY r.id FOR UPDATE OF r",
            )
          ).rows.map((r) => r.id);
          await client.query("SELECT * FROM lock_catalogue()");
          const now = await decisionTime(client, clock, rounds),
            actor = await staff.authorize(client, cookie, now);
          const confirmation = await staffActionVerifier(client, actor, input.ownCode);
          if (
            !(await first(
              client,
              "SELECT id FROM content_publication_outcomes WHERE actor_id=$1 AND snapshot_id=$2 AND request_key=$3",
              [actor.staff_id, input.snapshotId, input.requestKey],
            ))
          )
            await staffOutcomeCapacity(client, 2);
          const row = await first<Publication>(
            client,
            "SELECT * FROM publish_content_command($1,$2,$3,$4,$5,$6,$7)",
            [
              actor.id,
              input.snapshotId,
              input.runId,
              input.requestKey,
              input.expectedRevision,
              input.review,
              confirmation,
            ],
          );
          if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
          await advanceRoundTime(
            client,
            rounds,
            row.recorded_at > now ? row.recorded_at : now,
          );
          return receipt(row);
        },
        "EXCLUSIVE",
      ).catch((error: unknown) => {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "22023"
        )
          throw new AccessError("CONTENT_UNAVAILABLE");
        throw error;
      });
    },
    async outcome(cookie: unknown, snapshotId: string, key: string) {
      uuid(snapshotId);
      uuid(key);
      await budget(cookie);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const actor = await staff.authorize(
            client,
            cookie,
            await decisionTime(client, clock),
          );
          const row = await first<Publication>(
            client,
            "SELECT * FROM content_publication_outcomes WHERE actor_id=$1 AND snapshot_id=$2 AND request_key=$3",
            [actor.staff_id, snapshotId, key],
          );
          return {
            status: row ? "OBSERVED" : "NOT_OBSERVED",
            outcome: row ? receipt(row) : null,
          };
        },
        "SHARED",
      );
    },
  };
}
