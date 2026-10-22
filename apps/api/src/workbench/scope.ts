import type { Pool, PoolClient } from "pg";
import { parseProof, uuid } from "../access/credentials.js";
import {
  lockedRounds,
  sessionRow,
  sessionValid,
} from "../access/entry-service.js";
import { memberReadQuota } from "../access/quotas.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
} from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";

export interface ParticipantScope {
  client: PoolClient;
  now: Date;
  sessionId: string;
  memberId: string;
  memberRoundId: string;
  teamRoundId: string;
  roundId: string;
  language: string;
  historical: boolean;
}

export function createParticipantReads(pool: Pool, clock: ClockGuard) {
  async function principal(cookie: unknown) {
    const proof = parseProof(cookie);
    if (!proof) throw new AccessError("INVALID_SESSION");
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        const row = await sessionRow(client, proof.id);
        if (
          !row ||
          !(await sessionValid(
            client,
            row,
            proof.verifier,
            await decisionTime(client, clock),
            clock,
          ))
        )
          throw new AccessError("INVALID_SESSION");
        return row;
      },
      "SHARED",
    );
  }
  async function scoped<T>(
    cookie: unknown,
    round: string | undefined,
    write: boolean,
    work: (scope: ParticipantScope) => Promise<T>,
  ) {
    if (round !== undefined) uuid(round);
    const proof = parseProof(cookie);
    if (!proof) throw new AccessError("INVALID_SESSION");
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        await client.query("SELECT * FROM lock_arena_control(false)");
        const initial = await sessionRow(client, proof.id);
        if (!initial) throw new AccessError("INVALID_SESSION");
        const target = round ?? initial.round_id;
        await lockedRounds(client, [target, initial.round_id], !write);
        const now = await decisionTime(client, clock, [
            target,
            initial.round_id,
          ]),
          actor = await sessionRow(client, proof.id);
        if (
          !actor ||
          !(await sessionValid(client, actor, proof.verifier, now, clock))
        )
          throw new AccessError("INVALID_SESSION");
        const member = await first<{
          id: string;
          team_round_id: string;
          language: string;
        }>(
          client,
          `SELECT m.id,m.team_round_id,m.language FROM member_rounds m
        JOIN rounds target ON target.id=m.round_id JOIN rounds current ON current.id=$3
        WHERE m.round_id=$1 AND m.member_id=$2 AND m.team_id=$4 AND m.enrolled_at IS NOT NULL AND m.language IS NOT NULL
        AND (target.id=current.id OR (current.kind=2 AND target.kind=1 AND target.state='CLOSED' AND current.arena_instance_id=target.arena_instance_id))`,
          [target, actor.member_id, actor.round_id, actor.team_id],
        );
        if (!member) throw new AccessError("WORKBENCH_UNAVAILABLE");
        return work({
          client,
          now,
          sessionId: actor.id,
          memberId: actor.member_id,
          memberRoundId: member.id,
          teamRoundId: member.team_round_id,
          roundId: target,
          language: member.language,
          historical: target !== actor.round_id,
        });
      },
      "SHARED",
    );
  }
  return {
    principal,
    scoped,
    async read<T>(
      cookie: unknown,
      round: string | undefined,
      work: (scope: ParticipantScope) => Promise<T>,
    ) {
      const actor = await principal(cookie);
      await memberReadQuota(pool, clock, actor.member_id);
      return scoped(cookie, round, false, work);
    },
  };
}
