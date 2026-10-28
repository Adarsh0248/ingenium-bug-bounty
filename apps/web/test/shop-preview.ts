import { randomUUID } from "node:crypto";
import { shopItems, heldItem } from "../src/shop-items";
import type {
  ShopIntel,
  ShopPurchase,
  ShopReceipt,
  ShopView,
  ShopItemId,
} from "../src/shop-items";

// shortcut: this loopback-only store demonstrates item rules; production needs durable purchases, team scope and trusted activity observations.
export function createShopPreview(deps: {
  now: () => number;
  wallet: () => number;
  debit: (amount: number) => void;
  bugs: () => { bounty_id: string; claimed: boolean }[];
  paused: () => boolean;
  closed: () => boolean;
  intel: (id: string) => Omit<ShopIntel, "assistance_tier" | "bounty_id">;
}) {
  const purchases: ShopPurchase[] = [],
    receipts = new Map<string, { fingerprint: string; receipt: ShopReceipt }>();
  const claims = new Map<string, number>(),
    busy = new Set<string>();
  const rivals = [
    { id: "bit-shift", name: "Bit Shift" },
    { id: "null-pointers", name: "Null Pointers" },
    { id: "stack-breakers", name: "Stack Breakers" },
  ].map((t) => ({ ...t, until: 0, used: false }));
  let ghostUntil = 0,
    cooldownUntil = 0,
    frozenUntil = 0,
    incomingUsed = false,
    shieldArmed = false;
  const find = (id: ShopItemId) => purchases.find((p) => p.item_id === id);
  const locked = (id: string, at = deps.now()) => {
    const purchase = find("claim-lock");
    return (
      !!purchase?.activated_at &&
      purchase.target_id === id &&
      at >= Date.parse(purchase.activated_at) &&
      at < Date.parse(purchase.expires_at!)
    );
  };
  function intel(id: string): ShopIntel {
    const probe = purchases.some(
        (p) => p.item_id === "boundary-probe" && p.target_id === id,
      ),
      scanner = purchases.some(
        (p) => p.item_id === "hex-scanner" && p.target_id === id,
      );
    const data = probe || scanner ? deps.intel(id) : {};
    return {
      bounty_id: id,
      assistance_tier: scanner ? 2 : probe ? 1 : 0,
      ...(probe ? { probe: data.probe } : {}),
      ...(scanner ? { scanner: data.scanner } : {}),
    };
  }
  function view(): ShopView {
    const now = deps.now(),
      iso = (n: number) => (n > now ? new Date(n).toISOString() : null);
    const claim = find("claim-lock");
    return {
      preview: true,
      server_time: new Date(now).toISOString(),
      wallet: deps.wallet(),
      purchases: [...purchases],
      intel: [
        ...new Set(
          purchases
            .filter(
              (p) =>
                !!p.activated_at &&
                ["hex-scanner", "boundary-probe"].includes(p.item_id),
            )
            .map((p) => p.target_id!),
        ),
      ].map(intel),
      ghost_until: iso(ghostUntil),
      ghost_cooldown_until: iso(cooldownUntil),
      clear_bounty_ids:
        ghostUntil > now
          ? deps
              .bugs()
              .filter(
                (b) =>
                  !b.claimed &&
                  !claims.has(b.bounty_id) &&
                  !busy.has(b.bounty_id),
              )
              .map((b) => b.bounty_id)
          : [],
      claim:
        claim?.activated_at && Date.parse(claim.expires_at!) > now
          ? { bounty_id: claim.target_id!, expires_at: claim.expires_at! }
          : null,
      shield_armed: shieldArmed,
      overdrive: !!find("overdrive-core"),
      frozen_until: iso(frozenUntil),
      incoming_freeze_used: incomingUsed,
      targets: rivals.map((r) => ({
        id: r.id,
        name: r.name,
        frozen_until: iso(r.until),
        already_targeted: r.used,
      })),
    };
  }
  return {
    view,
    intel,
    protects: locked,
    claimTime: (id: string) => claims.get(id),
    unavailable: (id: string) => claims.has(id) && !locked(id),
    setRivalWorking(id: string, working: boolean) {
      if (working) busy.add(id);
      else busy.delete(id);
    },
    rivalClaim(id: string) {
      if (deps.bugs().some((b) => b.bounty_id === id))
        claims.set(id, deps.now());
    },
    purchasingBlocked: () => frozenUntil > deps.now(),
    takeShield() {
      const armed = shieldArmed;
      shieldArmed = false;
      return armed;
    },
    restoreShield() {
      if (find("chrono-shield")) shieldArmed = true;
    },
    incomingFreeze() {
      if (incomingUsed) return false;
      incomingUsed = true;
      frozenUntil = deps.now() + 1800000;
      return true;
    },
    clearIncomingFreeze() {
      frozenUntil = 0;
    },
    outcome(key: string) {
      return receipts.get(key)?.receipt ?? null;
    },
    activate(input: unknown): ShopReceipt {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("INVALID_CONTEXT");
      const p = input as Record<string, unknown>;
      if (
        Object.keys(p).sort().join(",") !==
          "bounty_id,purchase_id,request_key" ||
        typeof p.request_key !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          p.request_key,
        ) ||
        typeof p.purchase_id !== "string" ||
        typeof p.bounty_id !== "string"
      )
        throw new Error("INVALID_CONTEXT");
      const purchase = purchases.find((x) => x.id === p.purchase_id),
        bug = deps.bugs().find((x) => x.bounty_id === p.bounty_id);
      if (!purchase || !heldItem(purchase.item_id) || !bug)
        throw new Error("INVALID_CONTEXT");
      const fingerprint = JSON.stringify([
          "activate",
          p.purchase_id,
          p.bounty_id,
        ]),
        old = receipts.get(p.request_key);
      if (old) {
        if (old.fingerprint !== fingerprint) throw new Error("INTENT_CONFLICT");
        return old.receipt;
      }
      if (receipts.size >= 1000) throw new Error("RATE_LIMITED");
      const now = deps.now(),
        reason = deps.closed()
          ? "ROUND_CLOSED"
          : deps.paused()
            ? "PAUSED"
            : purchase.activated_at
              ? "ITEM_USED"
              : bug.claimed ||
                  (claims.has(bug.bounty_id) && !locked(bug.bounty_id))
                ? "BOUNTY_UNAVAILABLE"
                : purchases.some(
                      (x) =>
                        x.activated_at &&
                        x.item_id === purchase.item_id &&
                        x.target_id === bug.bounty_id,
                    )
                  ? "ALREADY_APPLIED"
                  : null;
      const receipt: ShopReceipt = {
        outcome_id: randomUUID(),
        request_key: p.request_key,
        recorded_at: new Date(now).toISOString(),
        result: {
          status: reason ? "REJECTED" : "ACTIVATED",
          item_id: purchase.item_id,
          purchase_id: purchase.id,
          ...(reason ? { reason } : {}),
        },
      };
      if (!reason) {
        purchase.target_id = bug.bounty_id;
        purchase.activated_at = receipt.recorded_at;
        purchase.expires_at =
          purchase.item_id === "claim-lock"
            ? new Date(now + 300000).toISOString()
            : null;
      }
      receipts.set(p.request_key, { fingerprint, receipt });
      return receipt;
    },
    purchase(input: unknown): ShopReceipt {
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("INVALID_CONTEXT");
      const p = input as Record<string, unknown>;
      if (
        Object.keys(p).sort().join(",") !== "item_id,request_key,target_id" ||
        typeof p.request_key !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          p.request_key,
        )
      )
        throw new Error("INVALID_CONTEXT");
      const item = shopItems.find((i) => i.id === p.item_id);
      if (
        !item ||
        !(
          p.target_id === null ||
          (typeof p.target_id === "string" && p.target_id.length <= 64)
        )
      )
        throw new Error("INVALID_CONTEXT");
      const rival = rivals.find((t) => t.id === p.target_id);
      if (item.id === "black-ice" ? !rival : p.target_id !== null)
        throw new Error("INVALID_CONTEXT");
      const fingerprint = JSON.stringify(["purchase", item.id, p.target_id]),
        old = receipts.get(p.request_key);
      if (old) {
        if (old.fingerprint !== fingerprint) throw new Error("INTENT_CONFLICT");
        return old.receipt;
      }
      if (receipts.size >= 1000) throw new Error("RATE_LIMITED");
      const perQuestion = ["hex-scanner", "boundary-probe"].includes(item.id);
      const now = deps.now(),
        duplicate = purchases.some(
          (x) => x.item_id === item.id && !perQuestion,
        );
      const reason = deps.closed()
        ? "ROUND_CLOSED"
        : deps.paused()
          ? "PAUSED"
          : frozenUntil > now
            ? "CREDIT_FROZEN"
            : item.id !== "ghost-scan" && duplicate
              ? "ALREADY_OWNED"
              : item.id === "ghost-scan" && cooldownUntil > now
                ? "SCAN_COOLDOWN"
                : item.id === "black-ice" && rival!.used
                  ? "TARGET_ALREADY_HIT"
                  : deps.wallet() < item.price
                    ? "INSUFFICIENT_FUNDS"
                    : null;
      const receipt: ShopReceipt = {
        outcome_id: randomUUID(),
        request_key: p.request_key,
        recorded_at: new Date(now).toISOString(),
        result: {
          status: reason ? "REJECTED" : "PURCHASED",
          item_id: item.id,
          ...(reason ? { reason } : {}),
        },
      };
      if (!reason) {
        const duration =
          item.id === "ghost-scan"
            ? 15000
            : item.id === "claim-lock"
              ? 300000
              : item.id === "black-ice"
                ? 1800000
                : 0;
        const purchase: ShopPurchase = {
          id: randomUUID(),
          item_id: item.id,
          target_id: p.target_id as string | null,
          purchased_at: receipt.recorded_at,
          activated_at: heldItem(item.id) ? null : receipt.recorded_at,
          expires_at:
            duration && !heldItem(item.id)
              ? new Date(now + duration).toISOString()
              : null,
        };
        deps.debit(item.price);
        purchases.push(purchase);
        receipt.result.purchase_id = purchase.id;
        if (item.id === "ghost-scan") {
          ghostUntil = now + 15000;
          cooldownUntil = now + 120000;
        }
        if (item.id === "chrono-shield") shieldArmed = true;
        if (item.id === "black-ice") {
          rival!.used = true;
          rival!.until = now + 1800000;
        }
      }
      receipts.set(p.request_key, { fingerprint, receipt });
      return receipt;
    },
  };
}
