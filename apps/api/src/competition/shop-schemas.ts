import { SHOP_PRICES } from "./shop.js";
const id = { type: "string", format: "uuid" }, time = { type: "string", format: "date-time" };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, properties, required });
const nullable = (schema: unknown) => ({ anyOf: [schema, { type: "null" }] });
const array = (items: unknown, maxItems: number) => ({ type: "array", items, maxItems });
const flag = { type: "boolean" }, item = { type: "string", enum: Object.keys(SHOP_PRICES) };
const text = (maxLength: number) => ({ type: "string", maxLength });
export const purchase = object({ request_key: id, item_id: item, target_id: nullable(id) });
export const activation = object({ request_key: id, purchase_id: id, bounty_id: id });
export const intel = object({ bounty_id: id, assistance_tier: { type: "integer", minimum: 0, maximum: 2 },
  probe: object({ input: text(65536), output: text(65536) }),
  scanner: object({ label: text(160), text: text(16384), from_line: { type: "integer", minimum: 1 }, to_line: { type: "integer", minimum: 1 }, source: text(131072) }),
}, ["bounty_id", "assistance_tier"]);
export const receipt = object({ outcome_id: id, round_id: id, request_key: id, action: text(20), recorded_at: time,
  result: object({ status: { type: "string", enum: ["PURCHASED", "ACTIVATED", "REJECTED"] }, item_id: item, reason: text(40), purchase_id: id }, ["status", "item_id"]),
}, ["outcome_id", "request_key", "recorded_at", "result"]);
export const outcome = nullable(receipt);
export const view = object({ preview: flag, server_time: time, timers_paused: flag,
  wallet: { type: "integer", minimum: 0, maximum: 1000000 },
  purchases: array(object({ id, item_id: item, target_id: nullable(id), purchased_at: time, activated_at: nullable(time), expires_at: nullable(time) }), 1024),
  intel: array(intel, 100), ghost_until: nullable(time), ghost_cooldown_until: nullable(time), clear_bounty_ids: array(id, 100),
  claim: nullable(object({ bounty_id: id, expires_at: time })), shield_armed: flag, overdrive: flag,
  frozen_until: nullable(time), incoming_freeze_used: flag,
  targets: array(object({ id, name: text(120), frozen_until: nullable(time), already_targeted: flag }), 50),
});
