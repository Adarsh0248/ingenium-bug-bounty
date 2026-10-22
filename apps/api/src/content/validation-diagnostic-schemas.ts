const id = {
  type: "string",
  pattern:
    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};
const text = { type: "string", maxLength: 1024 },
  time = { type: "string", format: "date-time", maxLength: 40 },
  bool = { type: "boolean" };
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
export const diagnosticBody = object({
  request_key: id,
  confirm_run_id: id,
  attempt_id: id,
  reason: text,
});
export const diagnosticOutcomeParams = object({ run_id: id, request_key: id });
const nullable = (value: unknown) => ({ anyOf: [value, { type: "null" }] });
const decimal = { type: "string", pattern: "^(0|[1-9][0-9]{0,18})$" };
export const diagnostic = object({
  audit_id: id,
  run_id: id,
  attempt_id: id,
  request_key: id,
  reason: text,
  recorded_at: time,
  result: {
    type: "string",
    enum: [
      "PASSED",
      "WRONG_ANSWER",
      "COMPILATION_ERROR",
      "RUNTIME_ERROR",
      "TIME_LIMIT_EXCEEDED",
      "MEMORY_LIMIT_EXCEEDED",
      "OUTPUT_LIMIT_EXCEEDED",
      "INFRA_ERROR",
    ],
  },
  stdout_b64: { type: "string", maxLength: 21848 },
  stderr_b64: { type: "string", maxLength: 87384 },
  compiler_output_b64: { type: "string", maxLength: 87384 },
  stdout_bytes: { type: "integer", minimum: 0, maximum: 1048577 },
  stdout_complete: bool,
  stdout_truncated: bool,
  stderr_truncated: bool,
  compiler_output_truncated: bool,
  cpu_ns: decimal,
  peak_bytes: decimal,
});
export const diagnosticOutcome = object({
  status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] },
  receipt: nullable(diagnostic),
});
export const diagnosticHistory = object({
  items: {
    type: "array",
    maxItems: 40,
    items: object({
      id,
      attempt_id: id,
      actor_name: text,
      reason: text,
      recorded_at: time,
    }),
  },
  next_after: nullable(id),
});
