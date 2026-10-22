import type { PoolClient } from "pg";
import { AccessError, first } from "../access/transaction.js";

// Call only after current-session and target-round membership checks.
export async function judgingFeedback(
  client: PoolClient,
  roundId: string,
  memberRoundId: string,
  parentId: string,
) {
  const parent = await first<{
    id: string;
    lane: string;
    bounty_id: string;
    language: string;
    source: Buffer;
    status: string;
    result: string | null;
    created_at: Date;
    completed_at: Date | null;
  }>(
    client,
    `SELECT p.id,p.lane,p.bounty_id,p.language,p.source,p.status,p.result,p.created_at,p.completed_at FROM participant_judging p JOIN member_rounds m ON m.id=$3
      WHERE p.id=$1 AND p.round_id=$2 AND ((p.lane='SAMPLE' AND p.member_round_id=m.id) OR (p.lane='OFFICIAL' AND p.team_round_id=m.team_round_id))`,
    [parentId, roundId, memberRoundId],
  );
  if (!parent) throw new AccessError("ACCESS_UNAVAILABLE");
  // Official results never contain hidden-case identity, counts, bytes or diagnostics.
  const samples =
    parent.lane === "SAMPLE"
      ? (
          await client.query(
            `SELECT row_number() OVER(ORDER BY j.position)::integer AS sample,
    CASE WHEN $2::timestamptz IS NULL OR j.completed_at<=$2 THEN j.result END AS result,
    CASE WHEN a.id IS NULL THEN NULL ELSE encode(a.stdout_prefix,'base64') END AS stdout_b64,
    CASE WHEN a.id IS NULL THEN NULL ELSE encode(a.stderr,'base64') END AS stderr_b64,
    CASE WHEN a.id IS NULL THEN NULL ELSE encode(a.compiler_output,'base64') END AS compiler_output_b64,
    CASE WHEN a.id IS NULL THEN NULL ELSE (a.evidence->>'stdout_bytes')::integer>octet_length(a.stdout_prefix) END AS stdout_truncated,
    (a.evidence->>'stderr_truncated')::boolean AS stderr_truncated,(a.evidence->>'compiler_output_truncated')::boolean AS compiler_output_truncated
    FROM participant_jobs j LEFT JOIN participant_attempts a ON a.id=j.settling_attempt_id AND ($2::timestamptz IS NULL OR a.resolved_at<=$2)
    WHERE j.parent_id=$1 ORDER BY j.position`,
            [parentId, parent.completed_at],
          )
        ).rows
      : [];
  return { ...parent, source: parent.source.toString("utf8"), samples };
}
