import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Play,
  Bell,
  Check,
  Crosshair,
  Expand,
  History,
  LayoutList,
  LogOut,
  Minimize2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Pause,
  X,
  ShoppingBag,
} from "lucide-react";
import { connectLive } from "../../api/src/live/client";
import type { Api } from "./api";
import { ApiError, errorText, Command } from "./api";
import type { Presence, Session, Snapshot, Termination } from "./types";
import { bugPath, languages, timeText } from "./types";
import { createWorkspace } from "./workspace";
import { Brand, IconButton, Modal } from "./ui";
import Announcements from "./Announcements";
import PixelBugIcon from "./PixelBugIcon";
import { bugAppearance, bountyRanks } from "./bug-art";
import { regions } from "./regions";
import type { RegionId } from "./regions";
import BountyReward, { TecnoesisCoin } from "./BountyReward";
import BugInfoCard from "./BugInfoCard";
import { shopRemaining } from "./shop-items";
import type { ShopView } from "./shop-items";
import { kernelAppearance, kernelBountyRanks } from "./kernel-art";
import ArenaStandings from "./ArenaStandings";
import StandingName from "./StandingName";
import {
  defaultQuestionFilters,
  questionList,
  questionTags,
} from "./question-list";
import type { QuestionFilters } from "./question-list";
import "./shop.css";
import "./arena-panels.css";
const Arena = lazy(() => import("./Arena")),
  KernelArena = lazy(() => import("./KernelArena")),
  Workbench = lazy(() => import("./Workbench")),
  Results = lazy(() => import("./Results")),
  Shop = lazy(() => import("./Shop"));
export default function Participant({
  api,
  session,
  leave,
  expired,
}: {
  api: Api;
  session: Session;
  leave: () => void;
  expired: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [phase, setPhase] = useState("SYNCING"),
    [selected, setSelected] = useState<string | null>(null),
    [inspection, setInspection] = useState<{ bountyId: string } | null>(null),
    [catching, setCatching] = useState<string | null>(null),
    [captureBusy, setCaptureBusy] = useState(false),
    [region, setRegion] = useState<RegionId | null>(null),
    [presence, setPresence] = useState<Presence[]>([]),
    [compact, setCompact] = useState(false),
    [standings, setStandings] = useState(false),
    [history, setHistory] = useState(false),
    [shopOpen, setShopOpen] = useState(false),
    [targetsOpen, setTargetsOpen] = useState(false),
    [questionFilters, setQuestionFilters] = useState(defaultQuestionFilters),
    [announcements, setAnnouncements] = useState(false),
    [seenAnnouncement, setSeenAnnouncement] = useState<string | null>(null),
    [logout, setLogout] = useState(false),
    [error, setError] = useState(""),
    [terminations, setTerminations] = useState<Termination[]>([]),
    [rewards, setRewards] = useState<
      { awardId: string; amount: number; title: string }[]
    >([]),
    [tick, setTick] = useState(0),
    [light, setLight] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [expiry, setExpiry] = useState(session.expires_at),
    [busy, setBusy] = useState(false),
    [sessionPending, setSessionPending] = useState(false);
  const captureIntent = useRef<{ id: string; key: string } | null>(null);
  const sessionIntent = useRef<{
    action: "logout" | "keep-alive";
    key: string;
  } | null>(null);
  const [, render] = useState(0),
    gearCommand = useMemo(
      () => new Command(api, session.round_id, () => render((n) => n + 1)),
      [api, session.round_id],
    ),
    workspace = useMemo(
      () => createWorkspace(api, session, () => render((v) => v + 1)),
      [session.session_id],
    ),
    live = useRef<ReturnType<typeof connectLive> | null>(null),
    received = useRef(performance.now()),
    snapshotRef = useRef<Snapshot | null>(null),
    targetDock = useRef<HTMLElement>(null),
    regionNavigation = useRef<HTMLElement>(null),
    returnTarget = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const client = connectLive("PARTICIPANT", null, {
      now: () => performance.now(),
      post: (path, body) => api.request(path, body),
      transport: (ticket) =>
        io("/live", {
          path: "/api/v1/live/socket",
          transports: ["websocket"],
          autoConnect: false,
          reconnection: false,
          forceNew: true,
          auth: { ticket },
        }),
      install(value) {
        const next = value as unknown as Snapshot;
        if (
          next.actor.session_id !== session.session_id ||
          next.actor.member_round_id !== session.member_round_id
        ) {
          expired();
          return;
        }
        received.current = performance.now();
        snapshotRef.current = next;
        setSnapshot(next);
        setInspection((old) =>
          old &&
          next.bounties.some(
            (b) => b.bounty_id === old.bountyId && !b.claimed,
          ) &&
          !next.round?.state.startsWith("CANCEL")
            ? old
            : null,
        );
        if (next.round?.state.startsWith("CANCEL")) {
          setTerminations([]);
          setRewards([]);
        }
        setExpiry((old) =>
          Date.parse(next.actor.expires_at) > Date.parse(old)
            ? next.actor.expires_at
            : old,
        );
      },
      invalidate() {},
      award(awardId, bountyId) {
        if (
          bountyId &&
          !snapshotRef.current?.round?.state.startsWith("CANCEL")
        ) {
          setTerminations((pending) => [...pending, { awardId, bountyId }]);
          const bug = snapshotRef.current?.bounties.find(
            (b) => b.bounty_id === bountyId,
          );
          // Wallet awards use the frozen base bounty; hint discounts affect round points only.
          if (
            bug &&
            Number.isSafeInteger(bug.base_bounty) &&
            bug.base_bounty > 0
          )
            setRewards((pending) => [
              ...pending,
              { awardId, amount: bug.base_bounty, title: bug.title },
            ]);
        }
      },
      presence(editors) {
        setPresence(editors as Presence[]);
      },
      state: setPhase,
    });
    live.current = client;
    return () => {
      client.close();
      live.current = null;
      workspace.close();
      snapshotRef.current = null;
    };
  }, [session.session_id]);
  useEffect(() => {
    if (!rewards.length) return;
    const timer = setTimeout(
      () => setRewards((pending) => pending.slice(1)),
      2000,
    );
    return () => clearTimeout(timer);
  }, [rewards[0]?.awardId]);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const ready = phase === "READY",
    round = snapshot?.round,
    now = snapshot
      ? Date.parse(snapshot.server_time) + performance.now() - received.current
      : Date.now();
  const globalPause = snapshot?.pauses.find((p) => p.scope === "GLOBAL"),
    remaining = round?.closes_at
      ? Date.parse(round.closes_at) -
        (globalPause ? Date.parse(globalPause.started_at) : now)
      : 0;
  const roundOpen =
    remaining > 0 && !!round && ["RUNNING", "PAUSED"].includes(round.state);
  const shop = snapshot?.shop,
    shopNow =
      now +
      (shop && snapshot
        ? Date.parse(shop.server_time) - Date.parse(snapshot.server_time)
        : 0),
    scanActive = shopRemaining(shop?.ghost_until, shopNow) > 0,
    creditFrozen = shopRemaining(shop?.frozen_until, shopNow) > 0;
  const markedBugs = useMemo(
    () =>
      snapshot?.bounties.map((b) => ({
        ...b,
        scan_clear:
          scanActive && !!shop?.clear_bounty_ids.includes(b.bounty_id),
      })) ?? [],
    [snapshot?.bounties, shop?.clear_bounty_ids, scanActive],
  );
  function updateShop(view: ShopView) {
    setSnapshot((old) =>
      old
        ? {
            ...old,
            shop: view,
            hud: old.hud
              ? {
                  ...old.hud,
                  wallet: view.wallet,
                  standing: old.hud.standing
                    ? { ...old.hud.standing, overdrive: view.overdrive }
                    : null,
                }
              : old.hud,
            standings: old.standings.map((s) =>
              s.team_id === session.team_id
                ? { ...s, overdrive: view.overdrive }
                : s,
            ),
          }
        : old,
    );
  }
  useEffect(() => {
    workspace.update(snapshot, ready, roundOpen);
  }, [snapshot, ready, roundOpen, workspace, selected]);
  useEffect(() => {
    if (snapshot && now >= Date.parse(expiry)) expired();
  }, [tick, snapshot, expiry]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (workspace.dirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [workspace]);
  const selectedBug = snapshot?.bounties.find((b) => b.bounty_id === selected);
  async function open(id: string) {
    const target = snapshotRef.current?.bounties.find(
      (bug) => bug.bounty_id === id,
    );
    if (!target || captureBusy) return;
    if (captureIntent.current && captureIntent.current.id !== id) {
      setError("Check your pending capture before catching another bug.");
      return;
    }
    if (target.captured && captureIntent.current?.id === id) {
      captureIntent.current = null;
      setCatching(null);
      setError("");
    }
    returnTarget.current = document.querySelector<HTMLButtonElement>(
      `[data-bounty-id="${CSS.escape(id)}"]`,
    );
    if (!target.captured && !target.claimed) {
      if (!ready || !roundOpen || ownPause) {
        setError(
          "Catching is unavailable while your arena actions are paused.",
        );
        return;
      }
      const intent = captureIntent.current ?? { id, key: crypto.randomUUID() };
      captureIntent.current = intent;
      setCatching(id);
      setCaptureBusy(true);
      try {
        await api.request(`${bugPath(session.round_id, id)}/open`, {
          request_key: intent.key,
        });
        const current = snapshotRef.current;
        if (current) {
          const next = {
            ...current,
            bounties: current.bounties.map((b) =>
              b.bounty_id === id ? { ...b, captured: true } : b,
            ),
          };
          snapshotRef.current = next;
          setSnapshot(next);
        }
        captureIntent.current = null;
        setCatching(null);
        setError("");
      } catch (e) {
        if (e instanceof ApiError && e.outcome === "NOT_PROCESSED") {
          captureIntent.current = null;
          setCatching(null);
        }
        setError(errorText(e));
        return;
      } finally {
        setCaptureBusy(false);
      }
    }
    if (round?.kind !== 2 && region && target)
      setRegion(
        bugAppearance(id, target.difficulty, target.category).region.id,
      );
    setSelected(id);
    setInspection(null);
    live.current?.edit(id);
  }
  const close = () => {
    setSelected(null);
    live.current?.edit(null);
    returnTarget.current?.focus();
  };
  async function signout() {
    await sessionAction("logout");
  }
  async function renew() {
    await sessionAction("keep-alive");
  }
  async function sessionAction(action: "logout" | "keep-alive") {
    if (busy || sessionIntent.current) return;
    const intent = { action, key: crypto.randomUUID() };
    sessionIntent.current = intent;
    setSessionPending(true);
    setBusy(true);
    try {
      const value = await api.request<any>(`/api/v1/participant/${action}`, {
        session_id: session.session_id,
        request_key: intent.key,
      });
      sessionIntent.current = null;
      setSessionPending(false);
      if (action === "logout") {
        workspace.close();
        api.clear();
        leave();
      } else setExpiry(value.session.expires_at);
    } catch (e) {
      if (e instanceof ApiError && e.outcome === "NOT_PROCESSED") {
        sessionIntent.current = null;
        setSessionPending(false);
      }
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function recoverSessionAction() {
    if (busy || !sessionIntent.current) return;
    setBusy(true);
    const intent = sessionIntent.current;
    try {
      const value = await api.request<any>(
        `/api/v1/participant/session-outcomes/${session.session_id}/${intent.key}`,
      );
      if (value.status !== "OBSERVED") {
        setError(
          "The original session action is not confirmed yet. No new request was sent.",
        );
        return;
      }
      sessionIntent.current = null;
      setSessionPending(false);
      if (intent.action === "logout") {
        workspace.close();
        api.clear();
        leave();
      } else {
        const fresh = await api.bootstrap("PARTICIPANT");
        setExpiry(fresh.session.expires_at);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const ownPause = snapshot?.pauses.some(
    (p) =>
      p.scope === "GLOBAL" ||
      p.team_round_id === snapshot.actor.team_round_id ||
      p.member_round_id === session.member_round_id,
  );
  const kernel = round?.kind === 2,
    ArenaView = kernel ? KernelArena : Arena,
    location = kernel
      ? {
          name: "The Kernel Breach",
          specialty: "SHARED MAINFRAME",
          description: "Follow the data. Break the rebellion.",
          family: "CORRUPTED SOFTWARE ENTITIES",
          color: "#65e9ff",
        }
      : regions.find((item) => item.id === region);
  const inspectedBug = inspection
    ? snapshot?.bounties.find(
        (b) => b.bounty_id === inspection.bountyId && !b.claimed,
      )
    : null;
  function locate(id: string) {
    const bug = snapshotRef.current?.bounties.find((b) => b.bounty_id === id);
    if (!bug || captureBusy || terminations.length) return;
    if (bug.claimed) {
      void open(id);
      return;
    }
    if (selected) close();
    returnTarget.current = document.querySelector<HTMLButtonElement>(
      `button.target[data-bounty-id="${CSS.escape(id)}"]`,
    );
    if (!kernel)
      setRegion(bugAppearance(id, bug.difficulty, bug.category).region.id);
    if (kernel) setTargetsOpen(false);
    setInspection({ bountyId: id });
  }
  const localBugs =
    snapshot?.bounties.filter(
      (bug) =>
        kernel ||
        !region ||
        bugAppearance(bug.bounty_id, bug.difficulty, bug.category).region
          ?.id === region,
    ) ?? [];
  const locateRef = useRef(locate);
  locateRef.current = locate;
  const listedQuestions = useMemo(
    () => questionList(snapshot?.bounties ?? [], questionFilters),
    [snapshot?.bounties, questionFilters],
  );
  useEffect(() => {
    targetDock.current?.querySelector(".target-scroll")?.scrollTo(0, 0);
  }, [questionFilters]);
  // The HUD ticks each second; keep the hundred unchanged target rows out of that redraw.
  const targetRows = useMemo(
    () =>
      listedQuestions.map(({ bug, index }) => {
        const appearance = bugAppearance(
            bug.bounty_id,
            bug.difficulty,
            bug.category,
            bug.base_bounty,
          ),
          ka = kernel ? kernelAppearance(bug.bounty_id, bug.base_bounty) : null;
        return (
          <button
            className={`target ${bug.claimed ? "claimed" : ""} ${scanActive && shop?.clear_bounty_ids.includes(bug.bounty_id) ? "scan-clear" : ""} ${selected === bug.bounty_id || inspection?.bountyId === bug.bounty_id ? "selected" : ""}`}
            key={bug.bounty_id}
            data-bounty-id={bug.bounty_id}
            data-category={bug.category ?? "OTHER"}
            data-difficulty={bug.difficulty}
            data-map-bounty={bug.bounty_id}
            disabled={captureBusy || (!selected && terminations.length > 0)}
            data-species={ka?.name ?? appearance.name}
            data-region={appearance.region.id}
            data-motion={appearance.motion}
            data-bounty-tier={
              ka
                ? ["Common", "Enhanced", "Elite", "Apex"][ka.tier]
                : appearance.rank.label
            }
            data-aura={appearance.rank.tier ? appearance.region.aura : "none"}
            data-cleared={bug.claimed}
            title={
              bug.claimed
                ? "Cleared bounty: inspect retained code"
                : `Locate ${bug.title} on the map`
            }
            onClick={() => locateRef.current(bug.bounty_id)}
          >
            <span className="target-number">
              {bug.claimed ? (
                <Check size={17} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            {ka ? (
              <span
                className="kernel-identity"
                style={{ color: ka.color }}
                aria-hidden="true"
              >
                <span>{["➤", "≋", "⟷", "⋈", "⨳", "ϟ", "⬡", "◈"][ka.kind]}</span>
              </span>
            ) : (
              <PixelBugIcon
                id={bug.bounty_id}
                difficulty={bug.difficulty}
                category={bug.category}
                baseBounty={bug.base_bounty}
              />
            )}
            <span className="target-copy">
              <strong>{bug.title}</strong>
              <span className="target-topic">
                {bug.category ? questionTags[bug.category] : "Other"}
              </span>
              {scanActive && shop?.clear_bounty_ids.includes(bug.bounty_id) && (
                <small className="scan-signal">NO RIVAL SIGNAL</small>
              )}
              <small>
                {bug.claimed
                  ? "CLEARED / READ ONLY"
                  : `${bug.difficulty}/100 DIFFICULTY`}
              </small>
              <small className="target-rarity">
                {ka
                  ? `${ka.name} · ${ka.motion.toLowerCase()}`
                  : `${appearance.rank.label} · ${appearance.movement}`}
              </small>
              <small
                className="target-region"
                style={{
                  color: appearance.color,
                }}
              >
                {kernel ? "The Kernel Breach" : appearance.region.name}
              </small>
              {presence
                .filter(
                  (p) =>
                    p.bounty_id === bug.bounty_id &&
                    p.member_round_id !== session.member_round_id,
                )
                .map((p) => (
                  <small className="teammate-indicator" key={p.member_round_id}>
                    {p.name ?? "Teammate"} {p.paused ? "paused" : "working"}
                  </small>
                ))}
            </span>
            <span className="target-bounty">
              <span className="coin-value">
                <TecnoesisCoin />
                {bug.base_bounty.toLocaleString()}
              </span>
              <small>coins</small>
            </span>
          </button>
        );
      }),
    [
      listedQuestions,
      captureBusy,
      selected,
      inspection?.bountyId,
      terminations.length,
      scanActive,
      shop?.clear_bounty_ids,
      presence,
      session.member_round_id,
      kernel,
    ],
  );
  function travel(next: RegionId | null) {
    setInspection(null);
    setRegion(next);
    regionNavigation.current
      ?.querySelector<HTMLButtonElement>(
        `[data-region-choice="${next ?? "all"}"]`,
      )
      ?.focus();
  }
  return (
    <main
      className="participant"
      data-round={round?.kind}
      data-targets-open={targetsOpen || undefined}
      data-terminating={
        !selected && terminations.length > 0 ? "true" : undefined
      }
      data-inspecting={inspectedBug && !selected ? "true" : undefined}
      data-overdrive={shop?.overdrive || undefined}
    >
      <Suspense fallback={<div className="arena-fallback" />}>
        <ArenaView
          region={region}
          onRegionChange={selected || terminations.length ? undefined : travel}
          bugs={markedBugs}
          onOpen={(id) => void open(id)}
          still={light || !!globalPause || !!selected}
          suspended={!!selected}
          pending={terminations.map((award) => award.bountyId)}
          strike={selected || rewards.length ? undefined : terminations[0]}
          onTerminated={() => setTerminations((pending) => pending.slice(1))}
          inspection={inspectedBug && !selected ? inspection : null}
          onDismissInfo={() => setInspection(null)}
          infoCard={
            inspectedBug && !selected ? (
              <BugInfoCard
                key={inspectedBug.bounty_id}
                api={api}
                roundId={session.round_id}
                bug={inspectedBug}
                kernel={kernel}
                canOpen={
                  inspectedBug.captured || (ready && roundOpen && !ownPause)
                }
                busy={captureBusy}
                open={() => void open(inspectedBug.bounty_id)}
                close={() => {
                  setInspection(null);
                  requestAnimationFrame(() => returnTarget.current?.focus());
                }}
              />
            ) : null
          }
        />
      </Suspense>
      <header className="topbar">
        <Brand />
        <div className="topbar-center">
          <span className="status-dot" />{" "}
          {round ? `ROUND 0${round.kind}` : "CONNECTING"}
          <span className="header-divider" />
          {snapshot?.final
            ? "FINAL RESULTS"
            : round?.state === "CLOSING"
              ? "RESULTS FINALISING"
              : round?.state === "RUNNING"
                ? "LIVE ARENA"
                : (round?.state.replaceAll("_", " ") ?? "SYNCING")}
        </div>
        <div className="topbar-actions">
          {round?.kind === 2 && shop && (
            <button
              className="shop-launch"
              aria-label="Black Market"
              onClick={() => setShopOpen(true)}
            >
              <span className="shop-launch-mark" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none">
                  <path
                    d="M20 2 36 11v18L20 38 4 29V11Z"
                    fill="#10182e"
                    stroke="#73ffe1"
                  />
                  <path
                    d="m9 14 11-6 11 6v13l-11 6-11-6Z"
                    stroke="#ae72ff"
                    opacity=".7"
                  />
                  <path
                    d="m12 19 3-7h10l3 7v8l-8 4-8-4Z"
                    fill="#201d3e"
                    stroke="#94fff0"
                  />
                  <path d="m12 20 8 3 8-3v7l-8 4-8-4Z" fill="#080e20" />
                  <path
                    d="m14 20 4 1m4 0 4-1M17 27h6"
                    stroke="#ff72cf"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 15h4m24 10h4M20 2v4m0 28v4"
                    stroke="#73ffe1"
                    strokeWidth="2"
                  />
                  <circle
                    cx="34"
                    cy="7"
                    r="4"
                    fill="#ffcf70"
                    stroke="#24172d"
                    strokeWidth="2"
                  />
                </svg>
              </span>
              <span className="shop-launch-label">
                <small aria-hidden="true">GEAR / INTEL</small>
                Black Market
              </span>
            </button>
          )}
          <span className="announcement-bell">
            <IconButton
              title="Announcements"
              onClick={() => setAnnouncements(true)}
            >
              <Bell size={17} />
            </IconButton>
            {snapshot?.announcement_head &&
              snapshot.announcement_head !== seenAnnouncement && (
                <span
                  className="announcement-new"
                  role="status"
                  aria-label="New announcement"
                />
              )}
          </span>
          <span
            className={`connection ${ready ? "connected" : ""}`}
            role="status"
          >
            <Radio size={13} />
            {ready ? "Live" : "Reconnecting"}
          </span>
          <IconButton title="Sign out" onClick={() => setLogout(true)}>
            <LogOut size={17} />
          </IconButton>
        </div>
      </header>
      <section
        className={`hud ${compact ? "compact" : ""}`}
        aria-label="Team HUD"
      >
        <div className="hud-team">
          <span className="team-avatar">
            {session.team_name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{session.team_name}</strong>
            <span>
              {session.member_name} <i /> {languages[session.language]}
            </span>
          </div>
        </div>
        <div className="hud-score">
          <span>ROUND SCORE</span>
          <strong>
            {(snapshot?.hud?.standing?.points ?? 0).toLocaleString()}
          </strong>
        </div>
        <div className="hud-score wallet">
          <span>
            <TecnoesisCoin /> WALLET
          </span>
          <strong>{(snapshot?.hud?.wallet ?? 0).toLocaleString()}</strong>
        </div>
        <div className="hud-rank">
          <span>RANK</span>
          <strong>#{snapshot?.hud?.standing?.rank ?? "--"}</strong>
        </div>
        <div className="hud-timer">
          <span>{globalPause ? "CLOCK FROZEN" : "REMAINING"}</span>
          <strong>{round ? timeText(remaining) : "--:--:--"}</strong>
        </div>
        <IconButton
          title={compact ? "Expand HUD" : "Minimise HUD"}
          onClick={() => setCompact(!compact)}
        >
          {compact ? <Expand size={16} /> : <Minimize2 size={16} />}
        </IconButton>
      </section>
      {shop && (
        <aside className="gear-strip" aria-label="Team gear status">
          {scanActive && (
            <span className="gear-scan">
              <Radio size={14} />
              GHOST SCAN · {timeText(
                shopRemaining(shop.ghost_until, shopNow),
              )}{" "}
              · {shop.clear_bounty_ids.length} clear signals
            </span>
          )}
          {shop.claim && (
            <span>
              <ShieldCheck size={14} />
              CLAIM LOCK ·{" "}
              {timeText(shopRemaining(shop.claim.expires_at, shopNow))}
            </span>
          )}
          {shop.shield_armed && <span>CHRONO SHIELD ARMED</span>}
          {shop.overdrive && <span>OVERDRIVE ONLINE</span>}
          {creditFrozen && (
            <span className="gear-frozen">
              <ShoppingBag size={14} />
              PURCHASES FROZEN ·{" "}
              {timeText(shopRemaining(shop.frozen_until, shopNow))}
            </span>
          )}
          {!scanActive &&
            !shop.claim &&
            !shop.shield_armed &&
            !shop.overdrive &&
            !creditFrozen && (
              <button onClick={() => setShopOpen(true)}>
                ROUND 2 / Gear up at the Black Market →
              </button>
            )}
        </aside>
      )}
      {!selected && terminations.length === 0 && (
        <>
          <div className="arena-label">
            <span className="eyebrow">
              SECTOR 026 /{" "}
              {location ? location.specialty.toUpperCase() : "WORLD OVERVIEW"}
            </span>
            <h1>
              {location?.name ?? "Hunting grounds"}
              <span>
                {localBugs.filter((b) => !b.claimed).length} targets available
              </span>
            </h1>
            <p className="arena-instruction">
              {location?.description ??
                "Choose one of the four regions to explore its hunting ground."}
            </p>
            {location && !kernel && (
              <span
                className="region-family-label"
                style={{ color: location.color }}
              >
                {location.family.toUpperCase()} TERRITORY
              </span>
            )}
          </div>
          <div className="field-coordinate" aria-hidden="true">
            FIELD 026
            <br />N 24.7542 · E 92.7925
          </div>
        </>
      )}
      <nav
        ref={regionNavigation}
        className="region-nav"
        aria-label="Arena regions"
      >
        <button
          type="button"
          data-region-choice="all"
          aria-pressed={region === null}
          disabled={!!selected || terminations.length > 0}
          onClick={() => travel(null)}
        >
          World map
        </button>
        {regions.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={region === item.id}
            data-region-choice={item.id}
            disabled={!!selected || terminations.length > 0}
            onClick={() => travel(item.id)}
            style={{ borderBottomColor: item.color }}
          >
            {item.name}
          </button>
        ))}
      </nav>
      <aside
        ref={targetDock}
        className="target-dock"
        aria-label="Bounty targets"
      >
        <div className="dock-heading">
          <span>
            <Crosshair size={15} /> TARGETS
          </span>
          <span aria-live="polite">
            {listedQuestions.length} / {snapshot?.bounties.length ?? 0}
          </span>
        </div>
        <div className="bounty-guide" aria-label="Bounty appearance guide">
          {(kernel ? kernelBountyRanks : bountyRanks).map((rank) => (
            <span key={rank.label}>
              {rank.label} {rank.minimum}+
            </span>
          ))}
        </div>
        <div className="question-controls">
          <input
            type="search"
            aria-label="Search questions"
            placeholder="Search questions or tags…"
            maxLength={120}
            value={questionFilters.search}
            onChange={(e) =>
              setQuestionFilters((old) => ({ ...old, search: e.target.value }))
            }
          />
          <label className="question-sort">
            Difficulty
            <select
              aria-label="Sort questions"
              value={questionFilters.sort}
              onChange={(e) =>
                setQuestionFilters((old) => ({
                  ...old,
                  sort: e.target.value as QuestionFilters["sort"],
                }))
              }
            >
              <option value="default">Map order</option>
              <option value="easiest">Easy → hard</option>
              <option value="hardest">Hard → easy</option>
            </select>
          </label>
          <details className="question-filters">
            <summary>
              Filter tags & status
              {questionFilters.tags.length || questionFilters.status !== "all"
                ? ` (${questionFilters.tags.length + Number(questionFilters.status !== "all")})`
                : ""}
            </summary>
            <div
              className="question-tags"
              role="group"
              aria-label="Question topic tags"
            >
              {Object.entries(questionTags).map(([tag, text]) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={questionFilters.tags.includes(
                    tag as keyof typeof questionTags,
                  )}
                  onClick={() =>
                    setQuestionFilters((old) => ({
                      ...old,
                      tags: old.tags.includes(tag as keyof typeof questionTags)
                        ? old.tags.filter((t) => t !== tag)
                        : [...old.tags, tag as keyof typeof questionTags],
                    }))
                  }
                >
                  {text}
                </button>
              ))}
            </div>
            <label>
              Status
              <select
                aria-label="Filter question status"
                value={questionFilters.status}
                onChange={(e) =>
                  setQuestionFilters((old) => ({
                    ...old,
                    status: e.target.value as QuestionFilters["status"],
                  }))
                }
              >
                <option value="all">All questions</option>
                <option value="available">Available</option>
                <option value="captured">Captured & available</option>
                <option value="closed">Cleared / claimed</option>
              </select>
            </label>
          </details>
          {(questionFilters.search ||
            questionFilters.tags.length > 0 ||
            questionFilters.status !== "all" ||
            questionFilters.sort !== "default") && (
            <button
              className="question-clear"
              onClick={() => setQuestionFilters(defaultQuestionFilters)}
            >
              Clear filters & sort
            </button>
          )}
        </div>
        <div className="target-scroll">
          {targetRows}
          {!listedQuestions.length && (
            <p className="question-empty" role="status">
              No questions match. Try another tag or clear your filters.
            </p>
          )}
        </div>
      </aside>
      <ArenaStandings
        standings={snapshot?.standings ?? []}
        own={snapshot?.hud?.standing ?? null}
        teamName={session.team_name}
        ready={ready}
        final={snapshot?.final ?? false}
        cancelled={round?.state.startsWith("CANCEL") ?? false}
        openFull={() => setStandings(true)}
      />
      {rewards[0] && (
        <BountyReward
          key={rewards[0].awardId}
          amount={rewards[0].amount}
          title={rewards[0].title}
        />
      )}
      <div className="arena-tools">
        {kernel && (
          <span className="kernel-list-toggle">
            <IconButton
              title={targetsOpen ? "Hide target list" : "Show target list"}
              onClick={() => setTargetsOpen(!targetsOpen)}
            >
              <LayoutList size={19} />
            </IconButton>
          </span>
        )}
        <IconButton
          title="Results and history"
          onClick={() => setHistory(true)}
        >
          <History size={19} />
        </IconButton>
        <IconButton
          title="Round leaderboard"
          onClick={() => setStandings(true)}
        >
          <Trophy size={19} />
        </IconButton>
        <IconButton
          title={light ? "Enable animated targets" : "Reduce target motion"}
          onClick={() => setLight(!light)}
        >
          {light ? <Play size={19} /> : <Pause size={19} />}
        </IconButton>
      </div>
      {round?.state.startsWith("CANCEL") && (
        <div className="arena-status" role="status">
          Round cancelled. No competitive result or winner.
        </div>
      )}
      {ownPause && !round?.state.startsWith("CANCEL") && (
        <div className="arena-status" role="status">
          <ShieldCheck size={16} /> Your actions are paused
        </div>
      )}
      {!ready && (
        <div className="sync-status" role="status">
          Restoring verified live state
        </div>
      )}
      {snapshot && now >= Date.parse(expiry) - 300000 && (
        <div className="expiry-warning" role="alert">
          <span>Session expires in {timeText(Date.parse(expiry) - now)}</span>
          <button
            onClick={() => void renew()}
            disabled={busy || sessionPending}
          >
            Stay signed in
          </button>
        </div>
      )}
      {selectedBug && (
        <Suspense
          fallback={<div className="workbench loading">Loading workbench…</div>}
        >
          <Workbench
            key={selectedBug.bounty_id}
            api={api}
            session={session}
            bug={selectedBug}
            workspace={workspace}
            ready={ready}
            permitted={roundOpen && !ownPause && !selectedBug.claimed}
            roundKind={round?.kind ?? 1}
            wallet={snapshot?.hud?.wallet ?? 0}
            close={close}
            judging={snapshot?.judging ?? []}
            purchasesBlocked={creditFrozen}
            shopIntel={shop?.intel.find(
              (i) => i.bounty_id === selectedBug.bounty_id,
            )}
            shop={shop}
            gearCommand={gearCommand}
            shopChanged={updateShop}
          />
        </Suspense>
      )}
      <footer className="arena-footer">
        <span>INGENIUM / TECNOESIS 2026</span>
        <span>
          {presence.filter((p) => p.member_round_id !== session.member_round_id)
            .length
            ? "TEAMMATE ACTIVE"
            : "TEAM LINK STANDBY"}
        </span>
        <span>{ready ? "STATE VERIFIED" : "ACTIONS LOCKED"}</span>
      </footer>
      {shopOpen && shop && (
        <Suspense
          fallback={<div className="sync-status">Opening Black Market…</div>}
        >
          <Shop
            api={api}
            roundId={session.round_id}
            view={shop}
            bounties={snapshot?.bounties ?? []}
            now={shopNow}
            enabled={ready && roundOpen && !ownPause}
            changed={updateShop}
            close={() => setShopOpen(false)}
          />
        </Suspense>
      )}
      {standings && (
        <Modal
          title={
            round?.state.startsWith("CANCEL")
              ? "Cancelled round history"
              : snapshot?.final
                ? "Final standings"
                : round?.state === "CLOSING"
                  ? "Results finalising"
                  : "Live standings"
          }
          close={() => setStandings(false)}
        >
          <div className="leaderboard">
            <div className="leaderboard-head">
              <span>RANK / TEAM</span>
              <span>POINTS</span>
              <span>SOLVE TIME</span>
            </div>
            {snapshot?.standings.map((s) => (
              <div
                className={s.team_id === session.team_id ? "own-standing" : ""}
                key={s.team_round_id}
              >
                <span>
                  <b>
                    {s.rank === null ? "--" : String(s.rank).padStart(2, "0")}
                  </b>
                  <StandingName name={s.team_name} overdrive={s.overdrive} />
                </span>
                <strong>{s.points.toLocaleString()}</strong>
                <span>{timeText(s.effective_time_ms)}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {announcements && (
        <Modal title="Announcements" close={() => setAnnouncements(false)}>
          <Announcements
            key={session.session_id}
            api={api}
            base="/api/v1/participant/announcements"
            available={ready}
            version={snapshot?.announcement_head ?? null}
            loaded={setSeenAnnouncement}
          />
        </Modal>
      )}
      {history && (
        <Suspense
          fallback={
            <div className="sync-status" role="status">
              Loading history
            </div>
          }
        >
          <Results
            api={api}
            session={session}
            version={JSON.stringify([
              snapshot?.round?.state,
              snapshot?.final,
              snapshot?.hud,
              snapshot?.standings,
              snapshot?.judging,
              snapshot?.drafts,
            ])}
            close={() => setHistory(false)}
          />
        </Suspense>
      )}
      {logout && (
        <Modal title="Leave the arena?" close={() => setLogout(false)}>
          {workspace.dirty() ? (
            <p>
              Unsaved or unresolved code is held only in this tab. Signing out
              discards that local copy. Acknowledged drafts remain on the
              server.
            </p>
          ) : (
            <p>
              Re-entry for this round may require organiser-approved browser
              replacement.
            </p>
          )}
          <div className="dialog-actions">
            <button onClick={() => setLogout(false)}>Stay here</button>
            <button
              className="danger"
              onClick={() => void signout()}
              disabled={busy || sessionPending}
            >
              Confirm sign out
            </button>
          </div>
        </Modal>
      )}
      {sessionPending && (
        <div className="session-recovery">
          <button disabled={busy} onClick={() => void recoverSessionAction()}>
            Check previous session action <RefreshCw size={15} />
          </button>
        </div>
      )}
      {catching && !captureBusy && (
        <button
          className="capture-recovery"
          onClick={() => void open(catching)}
        >
          Check capture
        </button>
      )}
      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <IconButton title="Dismiss notice" onClick={() => setError("")}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </main>
  );
}
