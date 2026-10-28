import {
  standings as standingsSchema,
  judging,
} from "../competition/http-schemas.js";
const id = {
  type: "string",
  pattern:
    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
};
const text = { type: "string", maxLength: 160 },
  time = { type: "string", format: "date-time", maxLength: 40 };
const integer = { type: "integer", minimum: 0, maximum: 10000000000 };
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const nullable = (value: unknown) => ({ anyOf: [value, { type: "null" }] });
const list = (items: unknown, maxItems: number) => ({
  type: "array",
  maxItems,
  items,
});
const language = {
  type: "string",
  enum: ["c", "cpp", "java", "python", "javascript"],
};
const round = {
  round_id: id,
  kind: { type: "integer", enum: [1, 2] },
  state: { type: "string", maxLength: 16 },
};
export const rounds = list(object(round), 2);
export const overview = object({
  ...standingsSchema.properties,
  round: object({ ...round, language }),
  wallet: integer,
  bounties: list(
    object({
      bounty_id: id,
      title: text,
      difficulty: { type: "integer", minimum: 1, maximum: 100 },
      base_bounty: integer,
      claimed: { type: "boolean" },
      hint_tier: { type: "integer", minimum: 0, maximum: 3 },
      draft_saved: { type: "boolean" },
      awarded_points: nullable(integer),
    }),
    100,
  ),
});
export const query = {
  type: "object",
  additionalProperties: false,
  properties: { after: id },
};
export const attempts = object({
  items: list(
    object({
      id,
      bounty_id: id,
      title: text,
      member_round_id: id,
      language,
      lane: { type: "string", enum: ["OFFICIAL", "SAMPLE"] },
      status: judging.properties.status,
      result: judging.properties.result,
      created_at: time,
      completed_at: nullable(time),
      award_id: nullable(id),
    }),
    50,
  ),
  next_after: nullable(id),
});
export const wallet = object({
  items: list(
    object({
      id,
      amount: { type: "integer", minimum: -800, maximum: 40000 },
      recorded_at: time,
      kind: { type: "string", enum: ["AWARD", "HINT", "CARRYOVER"] },
      title: nullable(text),
      hint_level: nullable({ type: "integer", minimum: 1, maximum: 3 }),
      awarded_points: nullable(integer),
    }),
    50,
  ),
  next_after: nullable(id),
});
