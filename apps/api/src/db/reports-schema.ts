import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  rounds,
  teamRounds,
  memberRounds,
  staffIdentities,
} from "./access-schema.js";
import { participantSessions } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { bounties, competitionSubmissions } from "./competition-schema.js";
import { participantJudging } from "./participant-judge-schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const instant = (name: string) =>
  timestamp(name, { withTimezone: true, precision: 3 });
export const questionReports = pgTable(
  "question_reports",
  {
    id: uuid("id").primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id),
    bountyId: uuid("bounty_id")
      .notNull()
      .references(() => bounties.id),
    teamRoundId: uuid("team_round_id")
      .notNull()
      .references(() => teamRounds.id),
    memberRoundId: uuid("member_round_id")
      .notNull()
      .references(() => memberRounds.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => participantSessions.id),
    requestKey: uuid("request_key").notNull(),
    fingerprint: bytes("fingerprint").notNull(),
    message: text("message").notNull(),
    submissionId: uuid("submission_id").references(
      () => competitionSubmissions.id,
    ),
    parentId: uuid("parent_id").references(() => participantJudging.id),
    sourceDigest: bytes("source_digest"),
    recordedAt: instant("recorded_at").notNull(),
  },
  (t) => [
    unique("question_report_team_bug").on(t.teamRoundId, t.bountyId),
    unique("question_report_intent").on(t.memberRoundId, t.requestKey),
    index("question_report_queue").on(t.roundId, t.recordedAt, t.id),
    check(
      "question_report_shape",
      sql`octet_length(${t.fingerprint})=32 and octet_length(${t.message}) between 1 and 1024 and btrim(${t.message})<>''
    and (num_nonnulls(${t.submissionId},${t.parentId},${t.sourceDigest})=0 or (num_nonnulls(${t.submissionId},${t.parentId},${t.sourceDigest})=3 and octet_length(${t.sourceDigest})=32))`,
    ),
  ],
);

export const reportDecisions = pgTable(
  "report_decisions",
  {
    id: uuid("id").primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => questionReports.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => staffIdentities.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => staffSessions.id),
    requestKey: uuid("request_key").notNull(),
    fingerprint: bytes("fingerprint").notNull(),
    verdict: text("verdict").notNull(),
    reason: text("reason").notNull(),
    recordedAt: instant("recorded_at").notNull(),
  },
  (t) => [
    unique("question_report_decided_once").on(t.reportId),
    unique("report_decision_intent").on(t.actorId, t.requestKey),
    check(
      "report_decision_shape",
      sql`${t.verdict} in ('UPHELD','DISMISSED') and octet_length(${t.fingerprint})=32 and octet_length(${t.reason}) between 1 and 1024 and btrim(${t.reason})<>''`,
    ),
  ],
);

export const scoreAdjustments = pgTable(
  "score_adjustments",
  {
    id: uuid("id").primaryKey(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id),
    teamRoundId: uuid("team_round_id")
      .notNull()
      .references(() => teamRounds.id),
    reportId: uuid("report_id").references(() => questionReports.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => staffIdentities.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => staffSessions.id),
    requestKey: uuid("request_key").notNull(),
    fingerprint: bytes("fingerprint").notNull(),
    expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    recordedAt: instant("recorded_at").notNull(),
  },
  (t) => [
    unique("score_adjustment_intent").on(t.actorId, t.requestKey),
    index("score_adjustment_round").on(t.roundId, t.recordedAt, t.id),
    check(
      "score_adjustment_shape",
      sql`${t.expectedRevision}>0 and ${t.delta} between -1000000 and 1000000 and ${t.delta}<>0 and octet_length(${t.fingerprint})=32 and octet_length(${t.reason}) between 1 and 1024 and btrim(${t.reason})<>''`,
    ),
  ],
);
