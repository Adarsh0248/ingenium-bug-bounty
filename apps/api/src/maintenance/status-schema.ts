const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const time = { type: "string", format: "date-time", maxLength: 40 };
export const retentionStatus = object({
  server_time: time,
  physical_holds: { type: "integer", minimum: 0, maximum: 2 },
  batches: {
    type: "array",
    minItems: 2,
    maxItems: 2,
    items: object({
      family: { type: "string", enum: ["SECRETS", "PAYLOADS"] },
      last_completed_at: { anyOf: [time, { type: "null" }] },
      last_batch_count: { type: "integer", minimum: 0, maximum: 40 },
      total_purged: { type: "integer", minimum: 0, maximum: 8000000 },
    }),
  },
});
