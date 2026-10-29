import type { PoolClient } from "pg";
import { AccessError, first } from "../access/transaction.js";
import type { StreamHead } from "./protocol.js";

interface PublicStandings {
  standings: Record<string, unknown>[];
  final: boolean;
}

export function createStandingsReader() {
  let current: { key: string; value: Promise<PublicStandings> } | undefined;
  return async (client: PoolClient, roundId: string, streams: StreamHead[]) => {
    const stream = streams.find((s) => s.kind === "ROUND");
    if (!stream) throw new AccessError("SECURITY_UNAVAILABLE");
    const key = `${roundId}:${stream.stream_id}:${stream.head}`;
    if (current?.key !== key) {
      // The caller holds current authority, round and live locks; this version contains only committed public scores.
      const entry: NonNullable<typeof current> = {
        key,
        value: first<PublicStandings>(
          client,
          `SELECT shop_standings($1) standings,
          EXISTS(SELECT 1 FROM round_results WHERE round_id=$1) final`,
          [roundId],
        )
          .then((row) => {
            if (!row) throw new AccessError("SECURITY_UNAVAILABLE");
            return {
              final: row.final,
              standings: row.standings.map(
                ({ wallet: _wallet, ...value }) => value,
              ),
            };
          })
          .catch((error: unknown) => {
            if (current === entry) current = undefined;
            throw error;
          }),
      };
      current = entry;
    }
    return structuredClone(await current.value);
  };
}
