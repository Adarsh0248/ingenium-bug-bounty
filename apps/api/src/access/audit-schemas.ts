import { AUDIT_FAMILIES } from "./audit-policy.js";
const id = {
  type: "string",
  pattern:
    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};
const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", additionalProperties: false, required, properties });
const text = (maxLength: number) => ({ type: "string", maxLength }),
  nullable = (value: unknown) => ({ anyOf: [value, { type: "null" }] }),
  family = { type: "string", enum: Object.keys(AUDIT_FAMILIES) };
export const auditQuery = object({ family, arena_id: id, after: id }, [
  "family",
]);
export const auditPage = object({
  family,
  arena_id: nullable(id),
  next_after: nullable(id),
  items: {
    type: "array",
    maxItems: 40,
    items: object({
      id,
      recorded_at: { type: "string", format: "date-time", maxLength: 40 },
      actor_id: id,
      actor_name: text(120),
      action: text(64),
      outcome: text(64),
      denial_reason: nullable(text(64)),
      reason: text(1024),
      target_id: nullable(id),
      arena_id: nullable(id),
      round_id: nullable(id),
    }),
  },
});
