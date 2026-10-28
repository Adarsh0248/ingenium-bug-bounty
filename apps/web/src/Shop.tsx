import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Crosshair,
  Flame,
  LockKeyhole,
  Radar,
  ScanLine,
  ShieldCheck,
  Snowflake,
  Zap,
} from "lucide-react";
import type { Api } from "./api";
import { Command, errorText } from "./api";
import type { Bounty } from "./types";
import { timeText } from "./types";
import { Modal } from "./ui";
import { TecnoesisCoin } from "./BountyReward";
import { shopItems, shopRemaining, heldItem } from "./shop-items";
import type { ShopItemId, ShopView } from "./shop-items";
declare const __PREVIEW__: boolean;

const icons = {
  probe: Crosshair,
  scanner: ScanLine,
  core: Flame,
  radar: Radar,
  shield: ShieldCheck,
  lock: LockKeyhole,
  ice: Snowflake,
};
const reasons: Record<string, string> = {
  CREDIT_FROZEN: "Purchases are locked by Black ICE.",
  ROUND_CLOSED: "The round is closed.",
  PAUSED: "Purchases are paused.",
  INSUFFICIENT_FUNDS: "You need more coins for this item.",
  ALREADY_OWNED: "Your team already owns this upgrade.",
  SCAN_COOLDOWN: "Your Ghost Scan is recharging.",
  TARGET_ALREADY_HIT: "That team has already received Black ICE this round.",
  BOUNTY_UNAVAILABLE: "That target is no longer available. Choose another bug.",
};
export default function Shop({
  api,
  roundId,
  view,
  bounties,
  now,
  enabled,
  close,
  changed,
}: {
  api: Api;
  roundId: string;
  view: ShopView;
  bounties: Bounty[];
  now: number;
  enabled: boolean;
  close: () => void;
  changed: (view: ShopView) => void;
}) {
  const [filter, setFilter] = useState("ALL"),
    [rival, setRival] = useState(
      view.targets.find((t) => !t.already_targeted)?.id ?? "",
    ),
    [confirm, setConfirm] = useState<ShopItemId | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState("");
  const [, render] = useState(0),
    base = `/api/v1/competition/rounds/${roundId}/shop`;
  const command = useMemo(
    () => new Command(api, roundId, () => render((n) => n + 1)),
    [api, roundId],
  );
  const frozen = shopRemaining(view.frozen_until, now) > 0;
  const picked = shopItems.find((i) => i.id === confirm);
  const targetFor = (id: ShopItemId) => (id === "black-ice" ? rival : null);
  async function refresh() {
    changed(await api.request<ShopView>(base));
  }
  async function purchase() {
    if (!picked || busy) return;
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      const result = await command.send(
        base + "/purchases",
        { item_id: picked.id, target_id: targetFor(picked.id) },
        base + "/outcomes",
      );
      setNotice(
        result.result.status === "PURCHASED"
          ? heldItem(picked.id)
            ? `${picked.name} added to team inventory. Use it from a question page.`
            : `${picked.name} activated for your team.`
          : (reasons[result.result.reason] ?? "Purchase unavailable."),
      );
      setConfirm(null);
      await refresh();
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    setBusy(true);
    setFailure("");
    try {
      const r = await command.recover();
      if (r) {
        setNotice(
          r.result.status === "PURCHASED"
            ? "Original purchase confirmed. No second charge."
            : (reasons[r.result.reason] ?? "Original purchase declined."),
        );
        setConfirm(null);
        await refresh();
      } else
        setNotice(
          "The original purchase is still unconfirmed. No new purchase was sent.",
        );
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function demo(action: string) {
    if (!__PREVIEW__) return;
    setBusy(true);
    try {
      await api.request("/api/v1/_fixture", {
        action,
        bounty: view.claim?.bounty_id,
      });
      await refresh();
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Black Market"
      close={() => {
        if (!busy && !command.unresolved) close();
      }}
    >
      <div className="shop-shell">
        <header className="shop-hero">
          <div>
            <span className="eyebrow">ROUND 02 / TACTICAL SUPPLY</span>
            <h3>
              Buy an edge.
              <br />
              <em>Earn the win.</em>
            </h3>
            <p>
              Team gear, live intel and costly interference. Every purchase uses
              your shared wallet. Bug tools go into your inventory; use them
              from a question page.
            </p>
          </div>
          <div className="shop-wallet">
            <span>SPENDABLE COINS</span>
            <strong>
              <TecnoesisCoin />
              {view.wallet.toLocaleString()}
            </strong>
            <small>Carryover + Round 2 earnings − purchases</small>
          </div>
        </header>
        <div className="shop-effects" aria-label="Active team gear">
          {view.shield_armed && (
            <span>
              <ShieldCheck size={15} />
              Chrono Shield armed
            </span>
          )}
          {view.overdrive && (
            <span>
              <Flame size={15} />
              Overdrive online
            </span>
          )}
          {shopRemaining(view.ghost_until, now) > 0 && (
            <span>
              <Radar size={15} />
              Ghost Scan · {timeText(shopRemaining(view.ghost_until, now))}
            </span>
          )}
          {view.claim && shopRemaining(view.claim.expires_at, now) > 0 && (
            <span>
              <LockKeyhole size={15} />
              Claim Lock · {timeText(shopRemaining(view.claim.expires_at, now))}
            </span>
          )}
          {!view.shield_armed &&
            !view.overdrive &&
            !view.claim &&
            !shopRemaining(view.ghost_until, now) && (
              <span>NO ACTIVE GEAR / choose your advantage</span>
            )}
        </div>
        {frozen && (
          <div className="shop-freeze" role="status">
            <Snowflake />
            <div>
              <strong>
                BLACK ICE ACTIVE ·{" "}
                {timeText(shopRemaining(view.frozen_until, now))}
              </strong>
              <p>
                Purchases are locked. Keep solving: earnings continue, and your
                owned hints and gear remain available.
              </p>
            </div>
          </div>
        )}
        <nav className="shop-filters" aria-label="Shop categories">
          {["ALL", "INTEL", "PROTECTION", "STYLE", "SABOTAGE"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All gear" : f.toLowerCase()}
            </button>
          ))}
        </nav>
        {notice && (
          <p className="shop-notice" role="status">
            {notice}
          </p>
        )}
        {failure && (
          <p className="error" role="alert">
            {failure}
          </p>
        )}
        {command.unresolved && (
          <div className="shop-recovery" role="alert">
            <p>
              Purchase outcome unknown. Check the original receipt before
              spending again.
            </p>
            <button disabled={busy} onClick={() => void recover()}>
              Check purchase outcome
            </button>
          </div>
        )}
        <div className="shop-grid">
          {shopItems
            .filter((i) => filter === "ALL" || i.category === filter)
            .map((item) => {
              const Icon = icons[item.icon],
                perBug = ["hex-scanner", "boundary-probe"].includes(item.id);
              const owned = view.purchases.some(
                (p) => p.item_id === item.id && !perBug,
              );
              const cooldown =
                item.id === "ghost-scan"
                  ? shopRemaining(view.ghost_cooldown_until, now)
                  : 0;
              const unavailable =
                frozen ||
                !enabled ||
                busy ||
                command.unresolved ||
                view.wallet < item.price ||
                (owned && item.id !== "ghost-scan") ||
                cooldown > 0 ||
                (item.id === "black-ice" &&
                  !view.targets.some(
                    (t) => t.id === rival && !t.already_targeted,
                  ));
              return (
                <article
                  className={`shop-card ${item.id === "black-ice" ? "shop-card-premium" : ""}`}
                  key={item.id}
                  data-item={item.id}
                  style={{ "--gear-color": item.color } as CSSProperties}
                >
                  <div className="shop-card-head">
                    <span>{item.category}</span>
                    <small>{item.duration}</small>
                  </div>
                  <div className="shop-art" aria-hidden="true">
                    <span className="shop-art-ring" />
                    <Icon size={51} strokeWidth={1.3} />
                    <i />
                    <b>
                      {String(shopItems.indexOf(item) + 1).padStart(2, "0")}
                    </b>
                  </div>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                  {item.id === "black-ice" && (
                    <label>
                      Opponent team
                      <select
                        aria-label="Black ICE opponent team"
                        value={rival}
                        disabled={busy || command.unresolved}
                        onChange={(e) => setRival(e.target.value)}
                      >
                        {view.targets.map((t) => (
                          <option
                            disabled={t.already_targeted}
                            key={t.id}
                            value={t.id}
                          >
                            {t.name}
                            {t.already_targeted ? " — already targeted" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="shop-card-footer">
                    <strong>
                      <TecnoesisCoin />
                      {item.price.toLocaleString()}
                    </strong>
                    <button
                      disabled={unavailable}
                      onClick={() => {
                        setFailure("");
                        setConfirm(item.id);
                      }}
                    >
                      {cooldown
                        ? `Recharging ${timeText(cooldown)}`
                        : owned && item.id !== "ghost-scan"
                          ? "Acquired"
                          : view.wallet < item.price
                            ? "Need more coins"
                            : heldItem(item.id)
                              ? "Buy & hold"
                              : "Acquire & activate"}
                    </button>
                  </div>
                </article>
              );
            })}
        </div>
        <section className="shop-inventory">
          <h4>
            TEAM LOADOUT <span>{view.purchases.length} purchases</span>
          </h4>
          {!view.purchases.length ? (
            <p>
              Your loadout is empty. Start with intel or save for a bigger play.
            </p>
          ) : (
            <ul>
              {view.purchases.map((p) => (
                <li key={p.id}>
                  <span>{shopItems.find((i) => i.id === p.item_id)?.name}</span>
                  <small>
                    {bounties.find((b) => b.bounty_id === p.target_id)?.title ??
                      view.targets.find((t) => t.id === p.target_id)?.name ??
                      "Shared team gear"}
                  </small>
                  <b>
                    {!p.activated_at
                      ? "Held · use on a question"
                      : p.expires_at
                        ? shopRemaining(p.expires_at, now) > 0
                          ? timeText(shopRemaining(p.expires_at, now))
                          : "Expired"
                        : "Acquired"}
                  </b>
                </li>
              ))}
            </ul>
          )}
        </section>
        {__PREVIEW__ && view.preview && (
          <details className="shop-demo">
            <summary>Local preview controls</summary>
            <p>
              Practice questions and rival activity are simulated. These
              controls affect only this temporary preview.
            </p>
            <div>
              <button
                disabled={busy || command.unresolved}
                onClick={() => void demo("shop-demo-coins")}
              >
                Add 10,000 demo coins
              </button>
              <button
                disabled={
                  busy || command.unresolved || view.incoming_freeze_used
                }
                onClick={() => void demo("shop-incoming-freeze")}
              >
                Preview incoming Black ICE
              </button>
              <button
                disabled={busy || command.unresolved || !frozen}
                onClick={() => void demo("shop-clear-freeze")}
              >
                Clear simulated freeze
              </button>
              {view.claim && (
                <button
                  disabled={busy || command.unresolved}
                  onClick={() => void demo("shop-rival-claim")}
                >
                  Rival claims protected bug
                </button>
              )}
            </div>
          </details>
        )}
        {picked && (
          <section
            className="shop-confirm"
            role="region"
            aria-label="Confirm purchase"
          >
            <Zap />
            <div>
              <h4>
                {heldItem(picked.id) ? "Buy" : "Activate"} {picked.name}?
              </h4>
              <p>
                Spend {picked.price.toLocaleString()} team coins
                {targetFor(picked.id)
                  ? ` on ${bounties.find((b) => b.bounty_id === targetFor(picked.id))?.title ?? view.targets.find((t) => t.id === targetFor(picked.id))?.name}`
                  : ""}
                .{" "}
                {heldItem(picked.id)
                  ? "Held in team inventory until you use it on a question. Its effect has not started."
                  : "The effect begins immediately."}
              </p>
            </div>
            <button
              disabled={busy || command.unresolved || frozen || !enabled}
              onClick={() => void purchase()}
            >
              {busy ? "Activating…" : "Confirm purchase"}
            </button>
            <button
              disabled={busy || command.unresolved}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
          </section>
        )}
      </div>
    </Modal>
  );
}
