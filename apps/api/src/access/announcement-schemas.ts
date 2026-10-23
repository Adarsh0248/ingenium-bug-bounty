const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", additionalProperties: false, properties, required });
const id = {
  type: "string",
  pattern:
    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};
const nullable = (value: unknown) => ({ anyOf: [value, { type: "null" }] });
const scope = { type: "string", enum: ["EVENT", "ROUND", "TEAM"] };
const time = { type: "string", format: "date-time", maxLength: 40 };
const metadata = { id, scope, recorded_at: time },
  target = { round_id: nullable(id), team_id: nullable(id) };
export const arenaParams = object({ arena_id: id });
export const detailParams = object({ arena_id: id, announcement_id: id });
export const participantParams = object({ announcement_id: id });
export const outcomeParams = object({ arena_id: id, request_key: id });
export const pageQuery = object({ after: id }, []);
export const sendBody = object({
  scope,
  ...target,
  request_key: id,
  message: { type: "string", minLength: 1, maxLength: 4096 },
  reason: { type: "string", minLength: 1, maxLength: 1024 },
});
export const receipt = object({
  id,
  request_key: id,
  outcome: { type: "string", enum: ["APPLIED", "REJECTED"] },
  reason: nullable({ type: "string", enum: ["ARENA_CLOSED"] }),
  recorded_at: time,
});
export const outcome = object({
  status: { type: "string", enum: ["OBSERVED", "NOT_OBSERVED"] },
  outcome: nullable(receipt),
});
export const page = (staff: boolean) =>
  object({
    items: {
      type: "array",
      maxItems: 40,
      items: object({ ...metadata, ...(staff ? target : {}) }),
    },
    next_after: nullable(id),
  });
export const detail = (staff: boolean) =>
  object({
    ...metadata,
    ...(staff ? target : {}),
    message: { type: "string", maxLength: 4096 },
  });
