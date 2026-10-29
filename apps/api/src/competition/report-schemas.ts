const id = {
  type: "string",
  pattern:
    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};
const text = { type: "string", maxLength: 1024 },
  time = { type: "string", format: "date-time", maxLength: 40 };
const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties).filter(key => key !== "own_code"),
) => ({ type: "object", additionalProperties: false, required, properties });
const nullable = (value: unknown) => ({ anyOf: [value, { type: "null" }] });
const list = (items: unknown) =>
  object({
    items: { type: "array", maxItems: 40, items },
    next_after: nullable(id),
  });
export const report = object({
  id,
  round_id: id,
  bounty_id: id,
  team_round_id: id,
  submission_id: nullable(id),
  parent_id: nullable(id),
  message: text,
  recorded_at: time,
  title: text,
  team_name: text,
  reporter_name: text,
  language: nullable({ type: "string", maxLength: 16 }),
  submission_result: nullable({ type: "string", maxLength: 32 }),
  source_sha256: nullable({ type: "string", pattern: "^[a-f0-9]{64}$" }),
  status: { type: "string", enum: ["OPEN", "UPHELD", "DISMISSED"] },
  decision_note: nullable(text),
});
export const reportBody = object({
  request_key: id,
  submission_id: nullable(id),
  message: text,
});
export const teamReport = object({ report: nullable(report) });
export const reportPage = list(report);
export const reportParams = object({ round_id: id, report_id: id });
export const pageQuery = object({ after: id }, []);
export const decisionBody = object({
  request_key: id,
  verdict: { type: "string", enum: ["UPHELD", "DISMISSED"] },
  reason: text,
  own_code: { type: "string", maxLength: 96 },
});
export const decision = object({
  id,
  report_id: id,
  request_key: id,
  verdict: { type: "string", enum: ["UPHELD", "DISMISSED"] },
  reason: text,
  recorded_at: time,
});
export const scoreBody = object({
  request_key: id,
  team_round_id: id,
  report_id: nullable(id),
  delta: {
    type: "integer",
    minimum: -1000000,
    maximum: 1000000,
    not: { const: 0 },
  },
  reason: text,
  expected_revision: { type: "string", pattern: "^[1-9][0-9]{0,18}$" },
  own_code: { type: "string", maxLength: 96 },
});
export const scoreReceipt = object({
  id,
  round_id: id,
  team_round_id: id,
  report_id: nullable(id),
  request_key: id,
  delta: { type: "integer", minimum: -1000000, maximum: 1000000 },
  reason: text,
  recorded_at: time,
});
export const adjustmentPage = list(
  object({
    id,
    team_round_id: id,
    team_name: text,
    delta: { type: "integer", minimum: -1000000, maximum: 1000000 },
    reason: text,
    report_id: nullable(id),
    actor_name: text,
    recorded_at: time,
  }),
);
export const outcome = (receipt: unknown) =>
  object({
    status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] },
    receipt: nullable(receipt),
  });
