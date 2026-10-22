import type { Pool, PoolClient } from "pg";
import { canonicalCode, newAccessCode, sha256, uuid } from "./credentials.js";
import type { SessionDelivery } from "./credentials.js";
import { registrationCsv } from "./registration-csv.js";
import type { RegistrationRow } from "./registration-csv.js";
import { boundedStaffText, staffRevision } from "./staff-management.js";
import {
  createStaffService,
  confirmStaffCode,
  staffOutcomeCapacity,
} from "./staff-service.js";
import { staffQuota } from "./quotas.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
} from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

interface Item {
  row: number;
  registration_id: string;
  team_id: string | null;
  status: "NEW" | "EXISTING" | "CONFLICT" | "CREATED";
}
interface Receipt {
  id: string;
  request_key: string;
  expected_revision: string;
  csv_digest: Buffer;
  outcome: string;
  denial_reason: string | null;
  items: Item[];
  recorded_at: Date;
}
function receipt(r: Receipt) {
  return {
    outcome_id: r.id,
    request_key: r.request_key,
    expected_revision: r.expected_revision,
    csv_digest: r.csv_digest.toString("hex"),
    outcome: r.outcome,
    reason: r.denial_reason,
    items: r.items,
    recorded_at: r.recorded_at.toISOString(),
  };
}
export function createRegistrationImport(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  async function budget(cookie: unknown, write = false) {
    const actor = await staff.inspect(cookie);
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(
      pool,
      clock,
      actor.staff_id,
      write ? "STAFF_COMMAND" : "READ_STAFF",
    );
    if (write) await staffQuota(pool, clock, actor.session_id, "STAFF_CONFIRM");
  }
  async function principal(client: PoolClient, cookie: unknown) {
    const actor = await staff.authorize(
      client,
      cookie,
      await decisionTime(client, clock),
    );
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    return actor;
  }
  return {
    async preview(cookie: unknown, csv: unknown) {
      await budget(cookie);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          await principal(client, cookie);
          const parsed = registrationCsv(csv),
            control = await first<{ revision: string; total: number }>(
              client,
              "SELECT revision,(SELECT count(*)::int FROM teams) AS total FROM security_control WHERE id=1",
            );
          if (!control) throw new AccessError("SECURITY_UNAVAILABLE");
          const rows = parsed.issues.length
            ? []
            : (await first<{ items: (RegistrationRow & Item)[] }>(
                client,
                "SELECT registration_import_preview($1) AS items",
                [JSON.stringify(parsed.rows)],
              ))!.items;
          const newCount = rows.filter((r) => r.status === "NEW").length,
            conflict = rows.some((r) => r.status === "CONFLICT"),
            capacity = control.total + newCount > 1000;
          return {
            csv_digest: parsed.digest,
            control_revision: control.revision,
            total: control.total,
            rows,
            issues: parsed.issues,
            new_count: newCount,
            existing_count: rows.filter((r) => r.status === "EXISTING").length,
            can_import: !parsed.issues.length && !conflict && !capacity,
            reason: parsed.issues.length
              ? "INVALID_CSV"
              : conflict
                ? "REGISTRATION_CONFLICT"
                : capacity
                  ? "TEAM_CAPACITY"
                  : null,
          };
        },
        "SHARED",
      );
    },
    async commit(
      cookie: unknown,
      input: {
        csv: string;
        csvDigest: string;
        expectedRevision: string;
        requestKey: string;
        ownCode: unknown;
        reason: string;
      },
    ) {
      uuid(input.requestKey);
      staffRevision(input.expectedRevision);
      boundedStaffText(input.reason, 1024);
      await budget(cookie, true);
      const parsed = registrationCsv(input.csv);
      if (parsed.issues.length || parsed.digest !== input.csvDigest)
        throw new AccessError("INVALID_CONTEXT");
      const generated = new Map(
        parsed.rows.map((r) => [r.registration_id, newAccessCode()]),
      );
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const actor = await principal(client, cookie);
          await confirmStaffCode(client, actor, input.ownCode);
          const prior = await first(
            client,
            "SELECT id FROM registration_import_outcomes WHERE actor_id=$1 AND request_key=$2",
            [actor.staff_id, input.requestKey],
          );
          if (!prior) await staffOutcomeCapacity(client);
          const r = await first<Receipt>(
            client,
            "SELECT * FROM import_registrations_command($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              actor.id,
              input.requestKey,
              input.expectedRevision,
              Buffer.from(parsed.digest, "hex"),
              JSON.stringify(parsed.rows),
              input.reason,
              sha256(canonicalCode(input.ownCode)),
              JSON.stringify(
                [...generated].map(([registration_id, c]) => ({
                  registration_id,
                  verifier: c.verifier.toString("hex"),
                })),
              ),
            ],
          );
          if (!r) throw new AccessError("SECURITY_UNAVAILABLE");
          return {
            outcome: receipt(r),
            issued_codes: prior
              ? []
              : r.items
                  .filter((i) => i.status === "CREATED")
                  .map((i) => ({
                    registration_id: i.registration_id,
                    team_id: i.team_id!,
                    code: generated.get(i.registration_id)!.code,
                  })),
          };
        },
        "EXCLUSIVE",
      );
    },
    async outcome(cookie: unknown, key: string) {
      uuid(key);
      await budget(cookie);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const actor = await principal(client, cookie),
            r = await first<Receipt>(
              client,
              "SELECT * FROM registration_import_outcomes WHERE actor_id=$1 AND request_key=$2",
              [actor.staff_id, key],
            );
          return {
            status: r ? "OBSERVED" : "NOT_OBSERVED",
            outcome: r ? receipt(r) : null,
          };
        },
        "SHARED",
      );
    },
  };
}
