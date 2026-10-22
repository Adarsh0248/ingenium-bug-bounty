import type { Pool } from "pg";
import {
  AccessError,
  accessTransaction,
  decisionTime,
} from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { createDrawCipher } from "../competition/policy.js";
import type { CompetitionDependencies } from "../competition/service.js";
import type { parseCompetitionRuntime } from "./config.js";
import { runtimeRecord } from "../content/judge-protocol.js";

export function competitionRuntime(
  pool: Pool,
  clock: ClockGuard,
  settings: ReturnType<typeof parseCompetitionRuntime>,
): CompetitionDependencies {
  const expected = JSON.stringify(runtimeRecord(settings.runtimes));
  return {
    drawCipher: createDrawCipher(settings.drawKey),
    async assertReady(signal) {
      signal.throwIfAborted();
      await accessTransaction(
        pool,
        clock,
        async (client) => {
          const now = await decisionTime(client, clock);
          const rows = (
            await client.query<{
              language: string;
              key: string;
              digest: string;
            }>(
              `SELECT h.language,h.runtime_key AS key,encode(m.digest,'hex') AS digest
        FROM judge_control c JOIN judge_host_epochs e ON e.id=c.host_epoch_id JOIN judge_host_runtimes h ON h.host_epoch_id=e.id
        JOIN runtime_manifests m ON m.key=h.runtime_key AND m.language=h.language
        WHERE c.id=1 AND e.id=$1 AND e.endpoint_ref=$2 AND e.state='ACTIVE' AND c.worker_id IS NOT NULL AND c.lease_until>$3
          AND c.active_validation_id IS NULL ORDER BY h.language`,
              [settings.hostEpochId, settings.endpointRef, now],
            )
          ).rows;
          const runtimes = new Map(
            rows.map((r) => [r.language, { key: r.key, digest: r.digest }]),
          ) as typeof settings.runtimes;
          if (
            rows.length !== 5 ||
            JSON.stringify(runtimeRecord(runtimes)) !== expected
          )
            throw new AccessError("JUDGE_UNAVAILABLE");
          signal.throwIfAborted();
        },
        "SHARED",
      );
    },
  };
}
