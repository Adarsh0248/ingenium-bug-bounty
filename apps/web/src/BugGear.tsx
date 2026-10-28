import { useState } from "react";
import { PackageOpen, Zap } from "lucide-react";
import type { Api, Command } from "./api";
import { errorText } from "./api";
import { shopItems, heldItem } from "./shop-items";
import type { ShopPurchase, ShopView } from "./shop-items";

export default function BugGear({
  api,
  roundId,
  bountyId,
  view,
  enabled,
  command,
  changed,
}: {
  api: Api;
  roundId: string;
  bountyId: string;
  view: ShopView;
  enabled: boolean;
  command: Command;
  changed: (view: ShopView) => void;
}) {
  const [confirm, setConfirm] = useState<ShopPurchase | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const base = `/api/v1/competition/rounds/${roundId}/shop`;
  async function use(recover = false) {
    if (busy || (!recover && !confirm)) return;
    setBusy(true);
    setNotice("");
    try {
      const receipt = recover
        ? await command.recover()
        : await command.send(
            base + "/activations",
            { purchase_id: confirm!.id, bounty_id: bountyId },
            base + "/outcomes",
          );
      setNotice(
        !receipt
          ? "The original use is still unconfirmed. No new activation was sent."
          : receipt.result.status === "ACTIVATED"
            ? "Item activated. No additional coins charged."
            : ((
                {
                  ITEM_USED:
                    "That item was already used. Check your team inventory.",
                  ALREADY_APPLIED:
                    "Your team already applied this tool to this question.",
                  BOUNTY_UNAVAILABLE:
                    "This bug is no longer eligible. Your unused item is still held.",
                  PAUSED: "Actions are paused. Your item is still held.",
                  ROUND_CLOSED: "The round is closed. Your item was not used.",
                } as Record<string, string>
              )[receipt.result.reason] ??
              "Activation declined. Check your team inventory."),
      );
      if (receipt) {
        setConfirm(null);
        changed(await api.request<ShopView>(base));
      }
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="bug-gear" aria-label="Use held items">
      <div className="bug-gear-heading">
        <PackageOpen size={18} />
        <div>
          <strong>TEAM INVENTORY</strong>
          <small>Use a held item on this question. No second charge.</small>
        </div>
      </div>
      <div className="bug-gear-tools">
        {shopItems
          .filter((i) => heldItem(i.id))
          .map((item) => {
            const stock = view.purchases.filter(
                (p) => p.item_id === item.id && !p.activated_at,
              ),
              applied = view.purchases.some(
                (p) =>
                  p.item_id === item.id &&
                  p.target_id === bountyId &&
                  p.activated_at,
              );
            return (
              <button
                key={item.id}
                disabled={
                  !enabled ||
                  busy ||
                  command.unresolved ||
                  !stock.length ||
                  applied
                }
                onClick={() => {
                  setConfirm(stock[0]);
                  setNotice("");
                }}
              >
                <span>{item.name}</span>
                <small>
                  {applied ? "Applied here" : `${stock.length} held`}
                </small>
              </button>
            );
          })}
      </div>
      {confirm && (
        <div className="bug-gear-confirm">
          <Zap size={17} />
          <p>
            Use{" "}
            <strong>
              {shopItems.find((i) => i.id === confirm.item_id)?.name}
            </strong>{" "}
            on this question?{" "}
            {confirm.item_id === "claim-lock"
              ? "Your five-minute window starts now."
              : "This consumes one held item and applies its scoring assistance."}
          </p>
          <button
            disabled={!enabled || busy || command.unresolved}
            onClick={() => void use()}
          >
            Confirm use
          </button>
          <button
            disabled={busy || command.unresolved}
            onClick={() => setConfirm(null)}
          >
            Cancel
          </button>
        </div>
      )}
      {command.unresolved && (
        <div className="shop-recovery">
          <p>
            Item use is unconfirmed. Recover the original receipt before using
            another item.
          </p>
          <button disabled={busy} onClick={() => void use(true)}>
            Check item outcome
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
