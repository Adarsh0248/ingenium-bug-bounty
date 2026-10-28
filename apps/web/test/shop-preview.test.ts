import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createShopPreview } from "./shop-preview";
import { shopItems } from "../src/shop-items";
import type { ShopItemId } from "../src/shop-items";
function fixture() {
  let now = 1800000000000,
    wallet = 35000,
    paused = false,
    closed = false,
    reads = 0;
  const bugs = [
    { bounty_id: "one", claimed: false },
    { bounty_id: "two", claimed: false },
    { bounty_id: "three", claimed: false },
  ];
  const shop = createShopPreview({
    now: () => now,
    wallet: () => wallet,
    debit: (n) => {
      wallet -= n;
    },
    bugs: () => bugs,
    paused: () => paused,
    closed: () => closed,
    intel: () => {
      reads++;
      return {
        scanner: {
          label: "Loop state",
          text: "Loop demonstration",
          from_line: 5,
          to_line: 12,
          source: "original loop section",
        },
        probe: { input: "7 5\n", output: "12\n" },
      };
    },
  });
  const buy = (
    item_id: ShopItemId,
    target_id: string | null = null,
    request_key = randomUUID(),
  ) => shop.purchase({ item_id, target_id, request_key });
  const use = (
    purchase: ReturnType<typeof buy>,
    bounty_id: string,
    request_key = randomUUID(),
  ) =>
    shop.activate({
      purchase_id: purchase.result.purchase_id,
      bounty_id,
      request_key,
    });
  return {
    shop,
    buy,
    use,
    bugs,
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    fund: (n: number) => {
      wallet += n;
    },
    pause: () => {
      paused = true;
    },
    close: () => {
      closed = true;
    },
    reads: () => reads,
  };
}
test("approved catalogue has seven fixed team prices with Black ICE at 15,000", () => {
  assert.deepEqual(
    shopItems.map((i) => i.price),
    [400, 750, 500, 1500, 2500, 5000, 15000],
  );
  assert.equal(new Set(shopItems.map((i) => i.id)).size, 7);
});

test("Black ICE requires exactly 15,000 coins and a recovered purchase never charges twice", () => {
  const f = fixture();
  f.fund(-20001);
  assert.equal(
    f.buy("black-ice", "bit-shift").result.reason,
    "INSUFFICIENT_FUNDS",
  );
  assert.equal(f.shop.view().wallet, 14999);
  f.fund(1);
  const key = randomUUID(),
    receipt = f.buy("black-ice", "bit-shift", key);
  assert.equal(receipt.result.status, "PURCHASED");
  assert.equal(f.shop.view().wallet, 0);
  assert.deepEqual(f.buy("black-ice", "bit-shift", key), receipt);
  assert.equal(f.shop.view().wallet, 0);
});
test("purchases validate their targets and intent, debit once, recover lost replies and remember rejected receipts", () => {
  const f = fixture(),
    key = randomUUID();
  const original = f.buy("hex-scanner", null, key);
  assert.deepEqual(f.buy("hex-scanner", null, key), original);
  assert.equal(f.shop.view().wallet, 34250);
  assert.deepEqual(f.shop.outcome(key), original);
  assert.throws(() => f.buy("boundary-probe", null, key), /INTENT_CONFLICT/);
  for (const payload of [
    {
      item_id: "overdrive-core",
      request_key: randomUUID(),
      target_id: null,
      price: 0,
    },
    { item_id: "free-money", request_key: randomUUID(), target_id: null },
    {
      item_id: "claim-lock",
      request_key: randomUUID(),
      target_id: "other-team-bug",
    },
  ])
    assert.throws(() => f.shop.purchase(payload), /INVALID_CONTEXT/);
  assert.equal(f.shop.view().wallet, 34250);
  f.fund(-34000);
  const rejectKey = randomUUID(),
    rejected = f.buy("black-ice", "bit-shift", rejectKey);
  assert.equal(rejected.result.reason, "INSUFFICIENT_FUNDS");
  f.fund(30000);
  assert.deepEqual(f.buy("black-ice", "bit-shift", rejectKey), rejected);
  assert.equal(f.shop.view().purchases.length, 1);
});
test("intel stays private until owned, has a single per-question charge and uses the highest assistance tier", () => {
  const f = fixture();
  assert.deepEqual(f.shop.view().intel, []);
  assert.equal(f.reads(), 0);
  const probe = f.buy("boundary-probe");
  assert.equal(f.shop.intel("one").assistance_tier, 0);
  assert.deepEqual(f.shop.view().intel, []);
  f.use(probe, "one");
  assert.equal(f.shop.intel("one").assistance_tier, 1);
  assert.equal(f.shop.intel("one").scanner, undefined);
  f.use(f.buy("hex-scanner"), "one");
  assert.equal(f.shop.intel("one").assistance_tier, 2);
  assert.ok(f.shop.intel("one").probe);
  const spare = f.buy("hex-scanner");
  assert.equal(f.use(spare, "one").result.reason, "ALREADY_APPLIED");
  assert.equal(
    f.shop.view().purchases.find((p) => p.id === spare.result.purchase_id)
      ?.activated_at,
    null,
  );
  assert.equal(f.shop.view().wallet, 33100);
  assert.equal(f.shop.intel("two").assistance_tier, 0);
});
test("Ghost Scan follows rival activity, expires at fifteen seconds and cannot bypass its two-minute cooldown", () => {
  const f = fixture();
  f.shop.setRivalWorking("two", true);
  f.bugs[2].claimed = true;
  f.buy("ghost-scan");
  assert.deepEqual(f.shop.view().clear_bounty_ids, ["one"]);
  f.shop.setRivalWorking("one", true);
  assert.deepEqual(f.shop.view().clear_bounty_ids, []);
  f.advance(15000);
  assert.equal(f.shop.view().ghost_until, null);
  assert.equal(f.buy("ghost-scan").result.reason, "SCAN_COOLDOWN");
  f.advance(105000);
  assert.equal(f.buy("ghost-scan").result.status, "PURCHASED");
});
test("Claim Lock preserves one scoring opportunity despite a rival claim, and receipt-time protection survives slow judging", () => {
  const f = fixture();
  const lock = f.buy("claim-lock");
  f.advance(600000);
  assert.equal(f.shop.protects("one"), false);
  assert.equal(f.shop.view().claim, null);
  f.use(lock, "one");
  const received = f.now();
  f.shop.rivalClaim("one");
  assert.equal(f.shop.unavailable("one"), false);
  assert.equal(f.use(f.buy("hex-scanner"), "one").result.status, "ACTIVATED");
  assert.equal(f.buy("claim-lock").result.reason, "ALREADY_OWNED");
  f.advance(300000);
  assert.equal(f.shop.protects("one"), false);
  assert.equal(f.shop.unavailable("one"), true);
  assert.equal(
    f.use(f.buy("boundary-probe"), "one").result.reason,
    "BOUNTY_UNAVAILABLE",
  );
  assert.equal(f.shop.protects("one", received), true);
});
test("Chrono Shield is consumed by the next admitted submission and can be restored after infrastructure failure", () => {
  const f = fixture();
  f.buy("chrono-shield");
  assert.equal(f.shop.takeShield(), true);
  assert.equal(f.shop.takeShield(), false);
  f.shop.restoreShield();
  assert.equal(f.shop.view().shield_armed, true);
  assert.equal(f.buy("chrono-shield").result.reason, "ALREADY_OWNED");
});
test("Black ICE costs 15k, permits one outgoing use and blocks purchases for thirty minutes without blocking earnings or owned gear", () => {
  const f = fixture();
  f.buy("overdrive-core");
  f.buy("black-ice", "bit-shift");
  assert.equal(f.shop.view().wallet, 19500);
  assert.equal(
    f.buy("black-ice", "null-pointers").result.reason,
    "ALREADY_OWNED",
  );
  assert.equal(f.shop.incomingFreeze(), true);
  assert.equal(f.shop.incomingFreeze(), false);
  assert.equal(f.buy("ghost-scan").result.reason, "CREDIT_FROZEN");
  f.fund(800);
  assert.equal(f.shop.view().wallet, 20300);
  assert.equal(f.shop.view().overdrive, true);
  f.advance(1800000);
  assert.equal(f.shop.purchasingBlocked(), false);
  assert.equal(f.buy("ghost-scan").result.status, "PURCHASED");
  assert.equal(f.shop.incomingFreeze(), false);
});
test("round closure, pauses and unavailable targets reject new charges", () => {
  const f = fixture();
  f.shop.rivalClaim("one");
  assert.equal(
    f.use(f.buy("claim-lock"), "one").result.reason,
    "BOUNTY_UNAVAILABLE",
  );
  f.pause();
  assert.equal(f.buy("overdrive-core").result.reason, "PAUSED");
  assert.equal(f.shop.view().wallet, 30000);
  const g = fixture();
  g.close();
  assert.equal(g.buy("ghost-scan").result.reason, "ROUND_CLOSED");
  assert.equal(g.shop.view().wallet, 35000);
});

test("held activation is idempotent, recovers a lost reply, cannot consume a unit twice and works under Black ICE", () => {
  const f = fixture(),
    probe = f.buy("boundary-probe"),
    key = randomUUID();
  assert.equal(f.shop.view().purchases[0].activated_at, null);
  f.shop.incomingFreeze();
  const receipt = f.use(probe, "one", key);
  assert.equal(receipt.result.status, "ACTIVATED");
  assert.deepEqual(f.use(probe, "one", key), receipt);
  assert.deepEqual(f.shop.outcome(key), receipt);
  assert.equal(f.shop.view().wallet, 34600);
  assert.equal(f.use(probe, "two").result.reason, "ITEM_USED");
  assert.throws(() => f.use(probe, "two", key), /INTENT_CONFLICT/);
  assert.throws(
    () =>
      f.shop.activate({
        purchase_id: randomUUID(),
        bounty_id: "one",
        request_key: randomUUID(),
      }),
    /INVALID_CONTEXT/,
  );
  assert.equal(f.shop.intel("two").assistance_tier, 0);
});
