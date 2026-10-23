const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const state = {
  type: "string",
  enum: ["OK", "WARNING", "CRITICAL", "UNKNOWN"],
};
const count = {
  anyOf: [
    { type: "string", pattern: "^(0|[1-9][0-9]{0,18})$", maxLength: 19 },
    { type: "null" },
  ],
};
export const operationsSchema = object({
  observed_at: { type: "string", format: "date-time", maxLength: 40 },
  state,
  quarantined: { type: "boolean" },
  clock_state: {
    type: "string",
    enum: ["STOPPED", "STARTING", "HEALTHY", "WARNING", "FAULT"],
  },
  metrics: {
    type: "array",
    minItems: 15,
    maxItems: 15,
    items: object({
      id: { type: "string", maxLength: 48 },
      value: count,
      limit: count,
      unit: { type: "string", enum: ["bytes", "count", "ms"] },
      state,
    }),
  },
  unverified: {
    type: "array",
    minItems: 5,
    maxItems: 5,
    items: { type: "string", maxLength: 48 },
  },
});
