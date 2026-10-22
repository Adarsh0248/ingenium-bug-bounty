const id = {
  type: "string",
  pattern:
    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};
const text = { type: "string", maxLength: 1024 },
  time = { type: "string", format: "date-time", maxLength: 40 };
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const nullable = (value: unknown) => ({ anyOf: [value, { type: "null" }] });
export const reviewBody = object({
  request_key: id,
  confirm_parent_id: id,
  attempt_id: nullable(id),
  reason: text,
});
export const reviewOutcomeParams = object({
  round_id: id,
  parent_id: id,
  request_key: id,
});
export const review = object({
  audit_id: id,
  request_key: id,
  parent_id: id,
  recorded_at: time,
  reason: text,
  source_sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
  source_b64: { type: "string", maxLength: 174764 },
  language: {
    type: "string",
    enum: ["c", "cpp", "java", "python", "javascript"],
  },
  lane: { type: "string", enum: ["OFFICIAL", "SAMPLE"] },
  diagnostic: nullable(
    object({
      attempt_id: id,
      result: { type: "string", maxLength: 32 },
      stdout_b64: { type: "string", maxLength: 21848 },
      stderr_b64: { type: "string", maxLength: 87384 },
      compiler_output_b64: { type: "string", maxLength: 87384 },
      stdout_truncated: { type: "boolean" },
      stderr_truncated: { type: "boolean" },
      compiler_output_truncated: { type: "boolean" },
    }),
  ),
});
export const reviewOutcome = object({
  status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] },
  receipt: nullable(review),
});
export const reviewHistory = object({
  items: {
    type: "array",
    maxItems: 40,
    items: object({
      id,
      actor_name: text,
      reason: text,
      recorded_at: time,
      includes_diagnostics: { type: "boolean" },
    }),
  },
  next_after: nullable(id),
});
