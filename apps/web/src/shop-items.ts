export const shopItems = [
  {
    id: "boundary-probe",
    name: "Boundary Probe",
    category: "INTEL",
    price: 400,
    color: "#4be3ef",
    icon: "probe",
    duration: "PER QUESTION",
    description:
      "Unlock an extra practice example. Counts as Hint 1 assistance for scoring.",
  },
  {
    id: "hex-scanner",
    name: "Hex Scanner",
    category: "INTEL",
    price: 750,
    color: "#ad8aff",
    icon: "scanner",
    duration: "PER QUESTION",
    description:
      "Trace the subsystem containing the fault. Reveals a code section to investigate; counts as Hint 2 assistance.",
  },
  {
    id: "overdrive-core",
    name: "Overdrive Core",
    category: "STYLE",
    price: 500,
    color: "#ffad57",
    icon: "core",
    duration: "THIS ROUND",
    description:
      "Light up your team name on the leaderboard and amplify your aura and finisher. Cosmetic only; no score bonus.",
  },
  {
    id: "ghost-scan",
    name: "Ghost Scan",
    category: "INTEL",
    price: 1500,
    color: "#8effb9",
    icon: "radar",
    duration: "15 SECONDS",
    description:
      "Reveal unclaimed bugs with no rival activity detected. Two-minute cooldown.",
  },
  {
    id: "chrono-shield",
    name: "Chrono Shield",
    category: "PROTECTION",
    price: 2500,
    color: "#68b9ff",
    icon: "shield",
    duration: "NEXT SUBMISSION",
    description:
      "Protect your next official submission from a wrong-submission time penalty. One per round.",
  },
  {
    id: "claim-lock",
    name: "Claim Lock",
    category: "PROTECTION",
    price: 5000,
    color: "#ff80d2",
    icon: "lock",
    duration: "5 MINUTES",
    description:
      "Keep your opportunity to score even if another team claims this bug. One per round.",
  },
  {
    id: "black-ice",
    name: "Black ICE",
    category: "SABOTAGE",
    price: 15000,
    color: "#c5e9ff",
    icon: "ice",
    duration: "30 MINUTES",
    description:
      "Freeze a rival team's hint and shop purchases. One outgoing attack; each target can be hit once per round.",
  },
] as const;
export type ShopItemId = (typeof shopItems)[number]["id"];
export const heldItem = (id: ShopItemId) =>
  id === "boundary-probe" || id === "hex-scanner" || id === "claim-lock";
export interface ShopPurchase {
  id: string;
  item_id: ShopItemId;
  target_id: string | null;
  purchased_at: string;
  activated_at: string | null;
  expires_at: string | null;
}
export interface ShopIntel {
  bounty_id: string;
  assistance_tier: number;
  scanner?: {
    label: string;
    text: string;
    from_line: number;
    to_line: number;
    source: string;
  };
  probe?: { input: string; output: string };
}
export interface ShopView {
  preview: boolean;
  server_time: string;
  wallet: number;
  purchases: ShopPurchase[];
  intel: ShopIntel[];
  ghost_until: string | null;
  ghost_cooldown_until: string | null;
  clear_bounty_ids: string[];
  claim: { bounty_id: string; expires_at: string } | null;
  shield_armed: boolean;
  overdrive: boolean;
  frozen_until: string | null;
  incoming_freeze_used: boolean;
  targets: {
    id: string;
    name: string;
    frozen_until: string | null;
    already_targeted: boolean;
  }[];
}
export interface ShopReceipt {
  outcome_id: string;
  request_key: string;
  recorded_at: string;
  result: {
    status: "PURCHASED" | "ACTIVATED" | "REJECTED";
    reason?: string;
    item_id: ShopItemId;
    purchase_id?: string;
  };
}
export const shopRemaining = (until: string | null | undefined, now: number) =>
  until ? Math.max(0, Date.parse(until) - now) : 0;
