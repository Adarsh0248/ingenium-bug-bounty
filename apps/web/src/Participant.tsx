import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Bug,
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
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import { connectLive } from "../../api/src/live/client";
import type { Api } from "./api";
import { ApiError, errorText } from "./api";
import type { Presence, Session, Snapshot, Termination } from "./types";
import { bugPath, languages, timeText } from "./types";
import { createWorkspace } from "./workspace";
import { Brand, IconButton, Modal } from "./ui";
const Arena = lazy(() => import("./Arena")),
  Workbench = lazy(() => import("./Workbench")),
  Results = lazy(() => import("./Results"));
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
    [presence, setPresence] = useState<Presence[]>([]),
    [compact, setCompact] = useState(false),
    [standings, setStandings] = useState(false),
    [history, setHistory] = useState(false),
    [logout, setLogout] = useState(false),
    [error, setError] = useState(""),
    [terminations, setTerminations] = useState<Termination[]>([]),
    [tick, setTick] = useState(0),
    [light, setLight] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [expiry, setExpiry] = useState(session.expires_at),
    [busy, setBusy] = useState(false),
    [sessionPending, setSessionPending] = useState(false);
  const sessionIntent = useRef<{
    action: "logout" | "keep-alive";
    key: string;
  } | null>(null);
  const [, render] = useState(0),
    workspace = useMemo(
      () => createWorkspace(api, session, () => render((v) => v + 1)),
      [session.session_id],
    ),
    live = useRef<ReturnType<typeof connectLive> | null>(null),
    received = useRef(performance.now()),
    snapshotRef = useRef<Snapshot | null>(null);
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
        if (next.round?.state.startsWith("CANCEL")) setTerminations([]);
        setExpiry((old) =>
          Date.parse(next.actor.expires_at) > Date.parse(old)
            ? next.actor.expires_at
            : old,
        );
      },
      invalidate() {},
      award(awardId, bountyId) {
        if (bountyId && !snapshotRef.current?.round?.state.startsWith("CANCEL"))
          setTerminations((pending) => [...pending, { awardId, bountyId }]);
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
    setSelected(id);
    live.current?.edit(id);
    try {
      await api.request(`${bugPath(session.round_id, id)}/open`, {
        request_key: crypto.randomUUID(),
      });
    } catch (e) {
      setError(errorText(e));
    }
  }
  const close = () => {
    setSelected(null);
    live.current?.edit(null);
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
  return (
    <main className="participant">
      <Suspense fallback={<div className="arena-fallback" />}>
        <Arena
          bugs={snapshot?.bounties ?? []}
          onOpen={(id) => void open(id)}
          still={light || !!globalPause || !!selected}
          pending={terminations.map((award) => award.bountyId)}
          strike={selected ? undefined : terminations[0]}
          onTerminated={() => setTerminations((pending) => pending.slice(1))}
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
            <Wallet size={12} /> WALLET
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
      {!selected && terminations.length === 0 && (
        <>
          <div className="arena-label">
            <span className="eyebrow">OPERATION / DEBUG</span>
            <h1>
              Neon district
              <span>
                {snapshot?.bounties.filter((b) => !b.claimed).length ?? 0}{" "}
                targets available
              </span>
            </h1>
          </div>
          <div className="field-coordinate" aria-hidden="true">
            FIELD 026
            <br />N 24.7542 · E 92.7925
          </div>
        </>
      )}
      <aside className="target-dock" aria-label="Bounty targets">
        <div className="dock-heading">
          <span>
            <Crosshair size={15} /> TARGETS
          </span>
          <span>{snapshot?.bounties.length ?? 0}</span>
        </div>
        <div className="target-scroll">
          {snapshot?.bounties.map((bug, index) => (
            <button
              className={`target ${bug.claimed ? "claimed" : ""} ${selected === bug.bounty_id ? "selected" : ""}`}
              key={bug.bounty_id}
              data-bounty-id={bug.bounty_id}
              data-cleared={bug.claimed}
              title={
                bug.claimed
                  ? "Cleared bounty: inspect retained code"
                  : `Open ${bug.title}`
              }
              onClick={() => void open(bug.bounty_id)}
            >
              <span className="target-number">
                {bug.claimed ? (
                  <Check size={17} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span>
                <strong>{bug.title}</strong>
                <small>
                  {bug.claimed
                    ? "CLEARED / READ ONLY"
                    : `${bug.difficulty}/100 DIFFICULTY`}
                </small>
                {presence
                  .filter(
                    (p) =>
                      p.bounty_id === bug.bounty_id &&
                      p.member_round_id !== session.member_round_id,
                  )
                  .map((p) => (
                    <small
                      className="teammate-indicator"
                      key={p.member_round_id}
                    >
                      {p.name ?? "Teammate"} {p.paused ? "paused" : "working"}
                    </small>
                  ))}
              </span>
              <span className="target-bounty">
                {bug.base_bounty}
                <small>CR</small>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="arena-tools">
        <IconButton title="Results and history" onClick={() => setHistory(true)}>
          <History size={19} />
        </IconButton>
        <IconButton
          title="Round leaderboard"
          onClick={() => setStandings(true)}
        >
          <Trophy size={19} />
        </IconButton>
        <IconButton
          title={light ? "Enable animated 3D targets" : "Reduce target motion"}
          onClick={() => setLight(!light)}
        >
          {light ? <Bug size={19} /> : <VolumeX size={19} />}
        </IconButton>
      </div>
      {round?.state.startsWith("CANCEL") && <div className="arena-status" role="status">Round cancelled. No competitive result or winner.</div>}
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
      {standings && (
        <Modal
          title={round?.state.startsWith("CANCEL") ? "Cancelled round history" : snapshot?.final ? "Final standings" : round?.state === "CLOSING" ? "Results finalising" : "Live standings"}
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
                  <b>{s.rank === null ? "--" : String(s.rank).padStart(2, "0")}</b>
                  {s.team_name}
                </span>
                <strong>{s.points.toLocaleString()}</strong>
                <span>{timeText(s.effective_time_ms)}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {history && <Suspense fallback={<div className="sync-status" role="status">Loading history</div>}><Results api={api} session={session} version={JSON.stringify([snapshot?.round?.state,snapshot?.final,snapshot?.hud,snapshot?.standings,snapshot?.judging,snapshot?.drafts])} close={() => setHistory(false)} /></Suspense>}
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
