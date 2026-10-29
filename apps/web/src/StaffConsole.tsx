import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Check,
  ChevronDown,
  LogOut,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
  Users,
  BookOpen,
  Settings2,
  LayoutDashboard,
} from "lucide-react";
import { connectLive } from "../../api/src/live/client";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import type { StaffSession } from "./types";
import { label, timeText } from "./types";
import type {
  ControlRoom,
  Page,
  PublishedBug,
  StaffLive,
  StaffTeam,
} from "./staff-types";
import { Brand, IconButton, Modal } from "./ui";
import StaffAccess from "./StaffAccess";
import StandingName from "./StandingName";
import StaffContent from "./StaffContent";
import StaffTeams from "./StaffTeams";
import StaffDiscipline from "./StaffDiscipline";
import StaffIncidents from "./StaffIncidents";
import StaffJudging from "./StaffJudging";
import StaffAudit from "./StaffAudit";
import StaffAnnouncements from "./StaffAnnouncements";
import StaffResultsExport from "./StaffResultsExport";
import StaffMaintenance from "./StaffMaintenance";
import StaffOperations from "./StaffOperations";
import StaffReports from "./StaffReports";
import ScoreCorrections from "./ScoreCorrections";
import "./staff-workspace.css";

type Tab =
  | "SETUP"
  | "BOUNTIES"
  | "MONITOR"
  | "JUDGING"
  | "ACCESS"
  | "STAFF"
  | "LIBRARY"
  | "TEAMS"
  | "DISCIPLINE"
  | "INCIDENTS"
  | "AUDIT"
  | "ANNOUNCEMENTS"
  | "MAINTENANCE"
  | "REPORTS";
type Draft = {
  minutes: string;
  teams: string[];
  snapshots: string[];
  revision: string;
  setupRevision: string;
  controlRevision: string;
  r1Revision: string;
  dirty: boolean;
};
type Intent = {
  title: string;
  path: string;
  outcome: string;
  body: Record<string, unknown>;
  sensitive: boolean;
};
const base = "/api/v1/staff/competition";
const views: Record<Tab, string> = {
  SETUP: "Arena setup",
  TEAMS: "Teams",
  LIBRARY: "Questions",
  BOUNTIES: "Round questions",
  MONITOR: "Live overview",
  JUDGING: "Submissions",
  ACCESS: "Participant access",
  STAFF: "Staff",
  REPORTS: "Reports",
  AUDIT: "Activity history",
  MAINTENANCE: "System health",
  DISCIPLINE: "Team restrictions",
  INCIDENTS: "Incident recovery",
  ANNOUNCEMENTS: "Announcements",
};
export default function StaffConsole({
  api,
  session,
  leave,
  expired,
}: {
  api: Api;
  session: StaffSession;
  leave: () => void;
  expired: () => void;
}) {
  const [data, setData] = useState<ControlRoom | null>(null),
    [active, setActive] = useState<string | null>(null),
    [view, setView] = useState<StaffLive | null>(null),
    [phase, setPhase] = useState("SYNCING"),
    [tab, setTab] = useState<Tab>("MONITOR"),
    [draft, setDraft] = useState<Draft | null>(null),
    [teams, setTeams] = useState<Page<StaffTeam>>({
      items: [],
      next_after: null,
    }),
    [published, setPublished] = useState<Page<PublishedBug>>({
      items: [],
      next_after: null,
    }),
    [intent, setIntent] = useState<Intent | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [accessBlocked, setAccessBlocked] = useState(false),
    [loading, setLoading] = useState(false),
    [contentVersion, setContentVersion] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [discard, setDiscard] = useState<{ tab?: Tab; round?: string } | null>(
      null,
    ),
    [signout, setSignout] = useState(false),
    [sessionUnknown, setSessionUnknown] = useState<"logout" | "renew" | null>(
      null,
    ),
    [, render] = useState(0);
  const arenaId = useRef<string | undefined>(
      new URLSearchParams(location.search).get("arena") ?? undefined,
    ),
    request = useRef(0),
    mounted = useRef(true),
    command = useRef<Command | null>(null),
    refresh = useRef<() => Promise<void>>(async () => {}),
    received = useRef(performance.now());
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const round = data?.rounds.find((r) => r.round_id === active) ?? null,
    one = data?.rounds.find((r) => r.kind === 1),
    two = data?.rounds.find((r) => r.kind === 2),
    ready = phase === "READY",
    superAdmin =
      (view?.actor.role ?? data?.role ?? session.role) === "SUPER_ADMIN",
    manager = session.mode === "NORMAL",
    moderator =
      (view?.actor.role ?? data?.role ?? session.role) !== "ORGANISER",
    locked =
      busy ||
      !data ||
      command.current.unresolved ||
      !!sessionUnknown ||
      !ready ||
      accessBlocked,
    current = !!data?.instance?.current,
    editable =
      !!data &&
      (!data.instance || current) &&
      (!round || ["DRAFT", "READY"].includes(round.state)),
    raceSetup =
      current &&
      !!data?.qualified_team_ids &&
      (!two || ["DRAFT", "READY"].includes(two.state)) &&
      tab === "SETUP",
    running = current && !!round && ["RUNNING", "PAUSED"].includes(round.state),
    clockNow = view
      ? Date.parse(view.server_time) + performance.now() - received.current
      : Date.now(),
    expiry = view?.actor.expires_at ?? session.expires_at,
    globalPause = view?.pauses.find((p) => p.scope === "GLOBAL"),
    remaining = view?.round?.closes_at
      ? Date.parse(view.round.closes_at) -
        (globalPause ? Date.parse(globalPause.started_at) : clockNow)
      : 0;

  function remember(id?: string) {
    arenaId.current = id;
    const url = new URL(location.href);
    if (id) url.searchParams.set("arena", id);
    else url.searchParams.delete("arena");
    history.replaceState(null, "", url);
  }
  refresh.current = async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const value = await api.request<ControlRoom>(
        `${base}/control-room${arenaId.current ? `?arena_id=${arenaId.current}` : ""}`,
        undefined,
        "STAFF",
      );
      if (!mounted.current || id !== request.current) return;
      if (value.session_id !== session.session_id) {
        expired();
        return;
      }
      if (value.instance) remember(value.instance.instance_id);
      setData(value);
      if (!value.rounds.length)
        setTab((old) =>
          [
            "ACCESS",
            "STAFF",
            "LIBRARY",
            "TEAMS",
            "AUDIT",
            "MAINTENANCE",
          ].includes(old)
            ? old
            : "SETUP",
        );
      setActive((old) =>
        value.rounds.some((r) => r.round_id === old)
          ? old
          : (value.rounds.at(-1)?.round_id ?? null),
      );
    } catch (e) {
      if (mounted.current && id === request.current) setError(errorText(e));
    } finally {
      if (mounted.current && id === request.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refresh.current();
    const timer = setInterval(() => render((v) => v + 1), 1000);
    return () => {
      mounted.current = false;
      request.current++;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (tab !== "SETUP") return;
    let current = true;
    void api
      .request<Page<StaffTeam>>("/api/v1/staff/arena-teams", undefined, "STAFF")
      .then((value) => {
        if (current) setTeams(value);
      })
      .catch((e) => {
        if (current) setError(errorText(e));
      });
    return () => {
      current = false;
    };
  }, [tab]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let contentChanged = false;
    setView(null);
    setPhase("SYNCING");
    const live = connectLive("STAFF", active, {
      now: () => performance.now(),
      post: (path, body) => api.request(path, body, "STAFF"),
      transport: (ticket) =>
        io("/live", {
          path: "/api/v1/live/socket",
          transports: ["websocket"],
          autoConnect: false,
          reconnection: false,
          forceNew: true,
          auth: { ticket },
        }),
      install(snapshot) {
        const value = snapshot as unknown as StaffLive;
        if (
          value.actor.session_id !== session.session_id ||
          value.actor.staff_id !== session.staff_id
        ) {
          expired();
          return;
        }
        received.current = performance.now();
        setView(value);
      },
      invalidate(projection) {
        if (projection === "content") contentChanged = true;
        if (!timer)
          timer = setTimeout(() => {
            timer = undefined;
            if (contentChanged) {
              contentChanged = false;
              setContentVersion((v) => v + 1);
            }
            void refresh.current();
          }, 350);
      },
      award() {},
      presence() {},
      state: setPhase,
    });
    return () => {
      live.close();
      clearTimeout(timer);
    };
  }, [active, session.session_id]);
  useEffect(() => {
    if (view && clockNow >= Date.parse(expiry)) expired();
  }, [clockNow, expiry]);
  useEffect(() => {
    if (!data) return;
    const settings = raceSetup ? two : round;
    setDraft((old) =>
      old?.dirty
        ? old
        : {
            minutes: String(Number(settings?.duration_ms ?? 10800000) / 60000),
            teams:
              settings?.teams.map((t) => t.team_id) ??
              (raceSetup ? data.qualified_team_ids! : []),
            snapshots: round?.selected.map((b) => b.snapshot_id) ?? [],
            revision: round?.revision ?? "0",
            setupRevision: round?.configuration_revision ?? "0",
            controlRevision: data.control_revision,
            r1Revision: one?.revision ?? "0",
            dirty: false,
          },
    );
  }, [data, active, tab]);
  useEffect(() => {
    let gone = false;
    if (!round || tab !== "BOUNTIES") return;
    setPublished({ items: [], next_after: null });
    void api
      .request<Page<PublishedBug>>(
        `${base}/published?kind=${round.kind}`,
        undefined,
        "STAFF",
      )
      .then((v) => {
        if (!gone) setPublished(v);
      })
      .catch((e) => {
        if (!gone) setError(errorText(e));
      });
    return () => {
      gone = true;
    };
  }, [round?.kind, tab === "BOUNTIES", contentVersion]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (draft?.dirty || command.current?.unresolved || accessBlocked) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [draft?.dirty, accessBlocked]);
  function edit(patch: Partial<Draft>) {
    setDraft((old) => (old ? { ...old, ...patch, dirty: true } : old));
  }
  function navigate(next: { tab?: Tab; round?: string }) {
    if (command.current!.unresolved || busy || accessBlocked) return;
    if (next.tab === tab || next.round === active) return;
    if (draft?.dirty) {
      setDiscard(next);
      return;
    }
    if (next.round) setActive(next.round);
    if (next.tab) setTab(next.tab);
  }
  function prepare(next: Intent) {
    if (locked || !manager) return;
    if (!next.sensitive) {
      void commit(next, `${next.title} from the control room.`);
      return;
    }
    setIntent(next);
    setReason(`${next.title} confirmed by event staff.`);

    setError("");
  }
  function competition(
    action: string,
    payload: Record<string, unknown> = {},
    target = round,
    revision = target?.revision,
  ) {
    if (!target) return;
    prepare({
      title: (
        {
          READY: "Prepare configuration",
          START: "Start round",
          PAUSE: "Pause actions",
          RESUME: "Resume actions",
          CLOSE: "Close round",
          FINALISE: "Finalise results",
          QUALIFY: "Lock qualification",
          DISCARD: "Discard arena",
          CONFIGURE: "Save bug selection",
          SETUP_R2: "Save Round 2 setup",
        } as Record<string, string>
      )[action],
      path: `${base}/rounds/${target.round_id}/commands`,
      outcome: `${base}/rounds/${target.round_id}/outcomes`,
      body: { action, expected_revision: revision, payload },
      sensitive: [
        "START",
        "PAUSE",
        "RESUME",
        "CLOSE",
        "FINALISE",
        "QUALIFY",
        "DISCARD",
      ].includes(action),
    });
  }
  async function acknowledged(receipt: any) {
    const result = receipt.result ?? {
      status: receipt.outcome,
      reason: receipt.reason,
    };
    if (result.status === "REJECTED") {
      setError(
        `Action declined: ${label(result.reason ?? "unavailable")}. Review the current state.`,
      );
      await refresh.current();
      return;
    }
    setNotice(
      receipt.instance_id
        ? receipt.action === "CREATE"
          ? "Arena created. You can keep editing its settings before starting."
          : "Arena settings saved."
        : receipt.action === "CONFIGURE"
          ? "Round questions saved."
          : `${label(receipt.action ?? "command")}: ${label(result.status ?? "acknowledged")}`,
    );

    setDraft(null);
    if (receipt.instance_id) remember(receipt.instance_id);
    await refresh.current();
    if (result.round_id ?? receipt.round_id)
      setActive(result.round_id ?? receipt.round_id);
  }
  async function commit(chosen: Intent, note: string) {
    if (locked || !note.trim() || new TextEncoder().encode(note).length > 1024)
      return;

    setIntent(null);
    setBusy(true);
    setError("");
    try {
      await acknowledged(
        await command.current!.send(
          chosen.path,
          {
            ...chosen.body,
            reason: note,
          },
          chosen.outcome,
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function recover() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const receipt = await command.current!.recover();
      if (receipt) await acknowledged(receipt);
      else
        setError(
          "The original command is not confirmed. No new command was sent.",
        );
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function sessionAction(action: "logout" | "renew", check = false) {
    if (busy || command.current!.unresolved) return;
    setBusy(true);
    setError("");
    try {
      if (check) {
        try {
          const fresh = await api.bootstrap("STAFF");
          if (action === "renew") {
            setView((old) =>
              old
                ? {
                    ...old,
                    actor: {
                      ...old.actor,
                      expires_at: fresh.session.expires_at,
                    },
                  }
                : old,
            );
            setSessionUnknown(null);
          } else
            setError(
              "The staff session is still active. Sign-out is not confirmed.",
            );
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            api.clear();
            leave();
          } else throw e;
        }
      } else {
        setSessionUnknown(action);
        if (action === "logout") {
          await api.request("/api/v1/staff/logout", {}, "STAFF");
          api.clear();
          leave();
        } else {
          const fresh = await api.request<{ session: StaffSession }>(
            "/api/v1/staff/keep-alive",
            { request_key: crypto.randomUUID() },
            "STAFF",
          );
          setView((old) =>
            old
              ? {
                  ...old,
                  actor: { ...old.actor, expires_at: fresh.session.expires_at },
                }
              : old,
          );
          setSessionUnknown(null);
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.outcome === "NOT_PROCESSED")
        setSessionUnknown(null);
      setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function more(which: "teams" | "bugs") {
    if (busy) return;
    setBusy(true);
    try {
      if (which === "teams" && teams.next_after) {
        const page = await api.request<Page<StaffTeam>>(
          `/api/v1/staff/arena-teams?after=${teams.next_after}`,
          undefined,
          "STAFF",
        );
        setTeams((old) => ({ ...page, items: [...old.items, ...page.items] }));
      }
      if (which === "bugs" && published.next_after && round) {
        const page = await api.request<Page<PublishedBug>>(
          `${base}/published?kind=${round.kind}&after=${published.next_after}`,
          undefined,
          "STAFF",
        );
        setPublished((old) => ({
          ...page,
          items: [...old.items, ...page.items],
        }));
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const teamRows = [
      ...new Map(
        [...(round?.teams ?? []), ...teams.items].map((t) => [t.team_id, t]),
      ).values(),
    ],
    bugRows = [
      ...new Map(
        [...(round?.selected ?? []), ...published.items].map((b) => [
          b.snapshot_id,
          b,
        ]),
      ).values(),
    ],
    canDiscard =
      current &&
      one &&
      ["DRAFT", "READY", "CLOSED"].includes(one.state) &&
      (!two || ["DRAFT", "READY"].includes(two.state)),
    paused = (scope: string, target: string | null) =>
      !!view?.pauses.some(
        (p) =>
          p.scope === scope &&
          (scope === "GLOBAL" ||
            (scope === "TEAM" ? p.team_round_id : p.member_round_id) ===
              target),
      );
  function pauseButton(
    scope: "TEAM" | "MEMBER",
    id: string | null,
    name: string,
  ) {
    if (!running || !manager || !id) return null;
    const held = paused(scope, id);
    return (
      <IconButton
        title={`${held ? "Resume" : "Pause"} ${scope.toLowerCase()} ${name}`}
        disabled={locked || !!draft?.dirty}
        onClick={() =>
          competition(held ? "RESUME" : "PAUSE", { scope, target: id })
        }
      >
        {held ? <Play size={15} /> : <Pause size={15} />}
      </IconButton>
    );
  }
  return (
    <main className="staff-console">
      <header className="staff-header">
        <Brand />
        <div>
          <span className="eyebrow">CONTROL ROOM</span>
          <strong>{session.display_name}</strong>
          <small>
            {superAdmin
              ? "Super Admin"
              : moderator
                ? "Lead admin"
                : "Event admin"}
          </small>
        </div>
        <span
          className={`connection ${ready ? "connected" : ""}`}
          role="status"
        >
          <Radio size={14} />
          {ready ? "Live" : "Synchronising"}
        </span>
        <IconButton
          title="Sign out"
          disabled={
            busy ||
            command.current.unresolved ||
            !!sessionUnknown ||
            accessBlocked
          }
          onClick={() => setSignout(true)}
        >
          <LogOut size={18} />
        </IconButton>
      </header>
      <div className="staff-context">
        <span>
          {data?.instance
            ? `${data.instance.status === "SETUP" ? "Arena in preparation" : label(data.instance.status)} / Reference ${data.instance.instance_id.slice(0, 8)}`
            : "No arena yet — begin with Arena setup"}
        </span>
        <span>Session {timeText(Date.parse(expiry) - clockNow)}</span>
        <IconButton
          title="Reload verified state"
          disabled={busy || loading}
          onClick={() => void refresh.current()}
        >
          <RefreshCw size={16} />
        </IconButton>
      </div>
      {error && (
        <div className="staff-message error" role="alert">
          {error}
          <IconButton title="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {notice && (
        <div className="staff-message" role="status">
          <Check size={16} />
          {notice}
          <IconButton
            title="Dismiss confirmation"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}
      {busy && command.current.unresolved && (
        <div className="staff-message" role="status">
          Awaiting command receipt...
        </div>
      )}
      {!busy && command.current.unresolved && (
        <div className="staff-message warning" role="alert">
          <span>Command outcome unconfirmed.</span>
          <button disabled={busy} onClick={() => void recover()}>
            Check original command <RefreshCw size={15} />
          </button>
        </div>
      )}
      {sessionUnknown && (
        <div className="staff-message warning">
          Previous session action unconfirmed.
          <button
            disabled={busy}
            onClick={() => void sessionAction(sessionUnknown, true)}
          >
            Check session
          </button>
        </div>
      )}
      {Date.parse(expiry) - clockNow < 120000 && (
        <div className="staff-message warning" role="alert">
          Staff session expires soon.
          <button disabled={locked} onClick={() => void sessionAction("renew")}>
            Stay signed in
          </button>
        </div>
      )}
      <nav className="staff-navigation" aria-label="Control room views">
        {(
          [
            "SETUP",
            "TEAMS",
            "LIBRARY",
            ...(round ? ["BOUNTIES"] : []),
            "MONITOR",
            ...(round ? ["JUDGING"] : []),
            ...(superAdmin ? ["STAFF"] : []),
          ] as Tab[]
        ).map((name) => (
          <button
            key={name}
            aria-current={tab === name ? "page" : undefined}
            disabled={busy || command.current!.unresolved || accessBlocked}
            onClick={() => navigate({ tab: name })}
          >
            {name === "SETUP" ? (
              <Settings2 size={16} />
            ) : name === "TEAMS" ? (
              <Users size={16} />
            ) : name === "LIBRARY" ? (
              <BookOpen size={16} />
            ) : name === "MONITOR" ? (
              <LayoutDashboard size={16} />
            ) : null}
            {views[name]}
          </button>
        ))}
        <details
          className="staff-more"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              event.currentTarget.open = false;
          }}
        >
          <summary>
            More controls <ChevronDown size={14} />
          </summary>
          <div
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button"))
                event.currentTarget.closest("details")!.open = false;
            }}
          >
            {(
              [
                "ACCESS",
                ...(data?.instance ? ["ANNOUNCEMENTS"] : []),
                ...(moderator
                  ? [
                      "AUDIT",
                      "MAINTENANCE",
                      ...(round ? ["REPORTS", "DISCIPLINE", "INCIDENTS"] : []),
                    ]
                  : []),
              ] as Tab[]
            ).map((name) => (
              <button
                key={name}
                aria-current={tab === name ? "page" : undefined}
                disabled={busy || command.current!.unresolved || accessBlocked}
                onClick={() => navigate({ tab: name })}
              >
                {views[name]}
              </button>
            ))}
          </div>
        </details>
        {draft?.dirty && (
          <>
            <span role="status">Unsaved selection</span>
            <button disabled={busy} onClick={() => setDiscard({ tab })}>
              Discard local changes
            </button>
          </>
        )}
      </nav>
      <div className="staff-rounds">
        {data?.rounds.map((r) => (
          <button
            key={r.round_id}
            aria-pressed={active === r.round_id}
            disabled={busy || command.current!.unresolved || accessBlocked}
            onClick={() => navigate({ round: r.round_id })}
          >
            Round {r.kind}
            <small>{label(r.state)}</small>
          </button>
        ))}
        {data?.instance && !current && (
          <button
            disabled={locked}
            onClick={() => {
              remember();
              setActive(null);
              setDraft(null);
              setTab("SETUP");
              void refresh.current();
            }}
          >
            <Plus size={15} />
            New arena
          </button>
        )}
      </div>
      <section className="staff-overview">
        <div>
          <span className="eyebrow">
            {round ? `ROUND 0${round.kind}` : "ARENA SETUP"}
          </span>
          <h1>{round ? label(round.state) : "Create arena"}</h1>
        </div>
        <div>
          <span>{globalPause ? "CLOCK FROZEN" : "REMAINING"}</span>
          <strong>
            {view?.round?.started_at ? timeText(remaining) : "--:--:--"}
          </strong>
        </div>
        <div>
          <span>TEAMS</span>
          <strong>{round?.teams.length ?? 0}</strong>
        </div>
        <div>
          <span>BUGS</span>
          <strong>{round?.selected.length ?? 0}</strong>
        </div>
      </section>
      {manager &&
        ![
          "STAFF",
          "ACCESS",
          "LIBRARY",
          "TEAMS",
          "AUDIT",
          "ANNOUNCEMENTS",
          "MAINTENANCE",
          "REPORTS",
        ].includes(tab) && (
          <div className="staff-controls">
            {round && editable && (
              <>
                <button
                  disabled={locked || !!draft?.dirty || !round.selected.length}
                  onClick={() => competition("READY")}
                >
                  <ShieldCheck size={15} />
                  Prepare configuration
                </button>
                <button
                  className="primary"
                  disabled={locked || !!draft?.dirty || round.state !== "READY"}
                  onClick={() => competition("START")}
                >
                  <Play size={15} />
                  Start round
                </button>
              </>
            )}
            {running && (
              <>
                <button
                  disabled={locked || !!draft?.dirty}
                  onClick={() =>
                    competition(globalPause ? "RESUME" : "PAUSE", {
                      scope: "GLOBAL",
                      target: null,
                    })
                  }
                >
                  {globalPause ? <Play size={15} /> : <Pause size={15} />}
                  {globalPause ? "Resume round" : "Pause round"}
                </button>
                <button
                  disabled={locked || !!globalPause}
                  onClick={() => competition("CLOSE")}
                >
                  <X size={15} />
                  Close round
                </button>
              </>
            )}
            {round?.state === "CLOSING" && current && (
              <button disabled={locked} onClick={() => competition("FINALISE")}>
                <Check size={15} />
                Finalise results
              </button>
            )}
            {round?.kind === 1 &&
              round.state === "CLOSED" &&
              current &&
              !data?.qualified_team_ids && (
                <button
                  disabled={locked}
                  onClick={() => competition("QUALIFY")}
                >
                  <Check size={15} />
                  Lock qualification
                </button>
              )}
            {canDiscard && (
              <button
                className="danger"
                disabled={locked || !!draft?.dirty}
                onClick={() => competition("DISCARD", {}, one)}
              >
                <X size={15} />
                Discard arena
              </button>
            )}
          </div>
        )}
      {tab === "JUDGING" && round && (
        <StaffJudging
          key={round.round_id}
          api={api}
          round={round}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
          version={JSON.stringify([view?.judging, view?.round?.state])}
          blockNavigation={setAccessBlocked}
        />
      )}
      {tab === "AUDIT" && moderator && (
        <StaffAudit
          key={data?.instance?.instance_id ?? "global"}
          api={api}
          arenaId={data?.instance?.instance_id ?? null}
          superAdmin={superAdmin}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
        />
      )}
      {tab === "ANNOUNCEMENTS" && data?.instance && (
        <StaffAnnouncements
          key={data.instance.instance_id}
          api={api}
          room={data}
          available={
            ready && !busy && !sessionUnknown && !command.current.unresolved
          }
          version={view?.announcement_head ?? null}
          blockNavigation={setAccessBlocked}
        />
      )}
      {tab === "INCIDENTS" && moderator && round && data?.instance && (
        <StaffIncidents
          key={round.round_id}
          api={api}
          roundId={round.round_id}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
          blockNavigation={setAccessBlocked}
          changed={() => void refresh.current()}
        />
      )}
      {tab === "DISCIPLINE" && moderator && round && data?.instance && (
        <StaffDiscipline
          key={round.round_id}
          api={api}
          arenaId={data.instance.instance_id}
          round={round}
          liveRevision={view?.round?.revision}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
          blockNavigation={setAccessBlocked}
        />
      )}
      {tab === "REPORTS" && moderator && round && (
        <StaffReports
          key={round.round_id}
          api={api}
          round={round.round_id}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
          blockNavigation={setAccessBlocked}
        />
      )}
      {tab === "MAINTENANCE" && moderator && (
        <>
          <StaffOperations
            api={api}
            available={
              ready &&
              !!data &&
              !busy &&
              !sessionUnknown &&
              !command.current.unresolved
            }
          />
          <StaffMaintenance
            api={api}
            available={
              ready &&
              !!data &&
              !busy &&
              !sessionUnknown &&
              !command.current.unresolved
            }
          />
        </>
      )}
      {tab === "TEAMS" && manager && (
        <StaffTeams
          api={api}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
          blockNavigation={setAccessBlocked}
        />
      )}
      {tab === "LIBRARY" && manager && (
        <StaffContent
          api={api}
          initialRoundType={round?.kind === 2 ? 2 : 1}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
          blockNavigation={setAccessBlocked}
        />
      )}
      {(tab === "ACCESS" || (tab === "STAFF" && superAdmin)) && (
        <StaffAccess
          key={tab}
          api={api}
          mode={tab}
          available={
            ready &&
            !!data &&
            !busy &&
            !sessionUnknown &&
            !command.current.unresolved
          }
          now={clockNow}
          blockNavigation={setAccessBlocked}
        />
      )}
      {tab === "SETUP" && draft && (
        <section className="staff-section">
          <div className="setup-intro">
            <div>
              <span className="eyebrow">
                ROUND {raceSetup ? 2 : (round?.kind ?? 1)} / PREPARATION
              </span>
              <h2>
                {!editable && !raceSetup
                  ? "Settings are locked after the round starts"
                  : round
                    ? "Keep editing until the round starts"
                    : "Build your arena in three steps"}
              </h2>
              <p>
                Add teams, set the round duration, then choose your questions.
                Creating an arena saves a draft; it does not start the
                competition.
              </p>
            </div>
            <span className="setup-status">
              {!editable && !raceSetup
                ? "View only"
                : round?.state === "READY"
                  ? "Ready · still editable"
                  : round
                    ? "Editable draft"
                    : "Draft not created"}
            </span>
          </div>
          {!round && (
            <div className="setup-steps">
              <button
                disabled={locked || !!draft.dirty}
                onClick={() => navigate({ tab: "TEAMS" })}
              >
                <span>01</span>
                <div>
                  <strong>Add teams</strong>
                  <small>Register a team manually or import a CSV.</small>
                </div>
                <Users size={21} />
              </button>
              <div className="setup-current-step">
                <span>02</span>
                <div>
                  <strong>Arena settings</strong>
                  <small>
                    Choose the duration and select your roster below.
                  </small>
                </div>
                <Settings2 size={21} />
              </div>
              <button
                disabled={locked || !!draft.dirty}
                onClick={() =>
                  navigate({ tab: round ? "BOUNTIES" : "LIBRARY" })
                }
              >
                <span>03</span>
                <div>
                  <strong>Choose questions</strong>
                  <small>
                    {round
                      ? "Select published questions for this round."
                      : "Write questions in the question library."}
                  </small>
                </div>
                <BookOpen size={21} />
              </button>
            </div>
          )}
          {draft.dirty && (
            <p className="notice">
              You have unsaved settings. Save them below before moving to teams
              or questions.
            </p>
          )}
          <h2>
            Round {raceSetup ? 2 : (round?.kind ?? 1)} roster and duration
          </h2>
          {!raceSetup && (round?.kind ?? 1) === 1 && (
            <>
              <label className="staff-duration">
                Duration (minutes)
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  value={draft.minutes}
                  disabled={!editable || !manager || locked}
                  onChange={(e) => edit({ minutes: e.target.value })}
                />
              </label>
              <div className="staff-section-heading">
                <strong>{draft.teams.length} / 100 teams selected</strong>
                <button
                  disabled={
                    !editable ||
                    !manager ||
                    locked ||
                    !Number.isInteger(Number(draft.minutes)) ||
                    Number(draft.minutes) < 1 ||
                    Number(draft.minutes) > 300
                  }
                  onClick={() =>
                    prepare({
                      title: round ? "Save arena setup" : "Create arena",
                      path: round
                        ? `/api/v1/staff/arenas/rounds/${round.round_id}/configuration`
                        : "/api/v1/staff/arenas",
                      outcome: `/api/v1/staff/outcomes/arena-setup/${round ? `CONFIGURE/${round.round_id}` : "CREATE/arena"}`,
                      body: {
                        expected_revision: round
                          ? draft.setupRevision
                          : draft.controlRevision,
                        duration_ms: Number(draft.minutes) * 60000,
                        team_ids: draft.teams,
                      },
                      sensitive: false,
                    })
                  }
                >
                  <Save size={15} />
                  {round ? "Save arena settings" : "Create arena"}
                </button>
              </div>
              <div className="staff-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Registered team</th>
                      <th>Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!teamRows.length && (
                      <tr>
                        <td colSpan={3} className="staff-empty">
                          <Users size={26} />
                          <strong>No teams registered yet</strong>
                          <p>
                            Add a team manually or import your registration
                            file. You can also create an empty arena draft and
                            add teams later.
                          </p>
                          <button
                            type="button"
                            disabled={locked || !!draft.dirty}
                            onClick={() => navigate({ tab: "TEAMS" })}
                          >
                            <Plus size={16} />
                            Add teams
                          </button>
                        </td>
                      </tr>
                    )}
                    {teamRows.map((t) => (
                      <tr key={t.team_id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select team ${t.team_name}`}
                            checked={draft.teams.includes(t.team_id)}
                            disabled={
                              !editable ||
                              !manager ||
                              locked ||
                              t.members.length !== 2 ||
                              (!draft.teams.includes(t.team_id) &&
                                draft.teams.length >= 100)
                            }
                            onChange={(e) =>
                              edit({
                                teams: e.target.checked
                                  ? [...draft.teams, t.team_id]
                                  : draft.teams.filter(
                                      (id) => id !== t.team_id,
                                    ),
                              })
                            }
                          />
                        </td>
                        <td>{t.team_name}</td>
                        <td>
                          {t.members.map((m) => m.member_name).join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {round && (
                <div className="setup-next">
                  <p>
                    Saved settings stay editable until the round starts. Changes
                    to a ready round will require a fresh readiness check.
                  </p>
                  <button
                    disabled={locked || !!draft.dirty}
                    onClick={() => navigate({ tab: "BOUNTIES" })}
                  >
                    Next: choose round questions <BookOpen size={16} />
                  </button>
                </div>
              )}
              {teams.next_after && (
                <button disabled={busy} onClick={() => void more("teams")}>
                  <ChevronDown size={15} />
                  More registered teams
                </button>
              )}
            </>
          )}
          {raceSetup && (
            <div className="staff-r2">
              <label className="staff-duration">
                Round 2 duration (minutes)
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="1"
                  value={draft.minutes}
                  disabled={locked || !manager}
                  onChange={(e) => edit({ minutes: e.target.value })}
                />
              </label>
              <div className="staff-team-picks">
                {one?.teams
                  .filter((t) => data!.qualified_team_ids!.includes(t.team_id))
                  .map((t) => (
                    <label key={t.team_id}>
                      <input
                        type="checkbox"
                        disabled={locked || !manager}
                        checked={draft.teams.includes(t.team_id)}
                        onChange={(e) =>
                          edit({
                            teams: e.target.checked
                              ? [...draft.teams, t.team_id]
                              : draft.teams.filter((id) => id !== t.team_id),
                          })
                        }
                      />
                      {t.team_name}
                    </label>
                  ))}
              </div>
              <button
                disabled={
                  locked ||
                  !manager ||
                  !draft.teams.length ||
                  draft.teams.length > 50 ||
                  !Number.isInteger(Number(draft.minutes)) ||
                  Number(draft.minutes) < 1 ||
                  Number(draft.minutes) > 300
                }
                onClick={() =>
                  competition(
                    "SETUP_R2",
                    {
                      teams: draft.teams,
                      duration_ms: Number(draft.minutes) * 60000,
                    },
                    one,
                    draft.r1Revision,
                  )
                }
              >
                <Save size={15} />
                Save Round 2 setup
              </button>
            </div>
          )}
        </section>
      )}
      {tab === "BOUNTIES" && (
        <section className="staff-section">
          <div className="staff-section-heading">
            <h2>Choose questions for Round {round?.kind ?? 1}</h2>
            <strong>
              {draft?.snapshots.length ?? 0} / {round?.kind === 2 ? 100 : 50}{" "}
              selected
            </strong>
            <button
              disabled={
                locked ||
                !manager ||
                !editable ||
                !round ||
                !draft?.snapshots.length
              }
              onClick={() =>
                competition(
                  "CONFIGURE",
                  { snapshots: draft!.snapshots },
                  round,
                  draft!.revision,
                )
              }
            >
              <Save size={15} />
              Save round questions
            </button>
          </div>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Bug</th>
                  <th>Difficulty</th>
                  <th>Bounty</th>
                </tr>
              </thead>
              <tbody>
                {bugRows.map((b) => {
                  const chosen = !!draft?.snapshots.includes(b.snapshot_id),
                    family = bugRows.some(
                      (other) =>
                        other.definition_id === b.definition_id &&
                        other.snapshot_id !== b.snapshot_id &&
                        draft?.snapshots.includes(other.snapshot_id),
                    );
                  return (
                    <tr key={b.snapshot_id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select bug ${b.title}`}
                          checked={chosen}
                          disabled={
                            locked ||
                            !manager ||
                            !editable ||
                            family ||
                            (!chosen &&
                              (draft?.snapshots.length ?? 0) >=
                                (round?.kind === 2 ? 100 : 50))
                          }
                          onChange={(e) =>
                            edit({
                              snapshots: e.target.checked
                                ? [...draft!.snapshots, b.snapshot_id]
                                : draft!.snapshots.filter(
                                    (id) => id !== b.snapshot_id,
                                  ),
                            })
                          }
                        />
                      </td>
                      <td>
                        {b.title}
                        {family && <small>Another version selected</small>}
                      </td>
                      <td>{b.difficulty}/100</td>
                      <td>{b.base_bounty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!bugRows.length && (
            <div className="staff-empty">
              <BookOpen size={30} />
              <h3>No published Round {round?.kind ?? 1} questions yet</h3>
              <p>
                Open Questions → Round {round?.kind ?? 1} to review the draft
                library. Questions appear here after validation and publication.
                This picker only includes questions for the current round.
              </p>
              <button
                disabled={locked || !!draft?.dirty}
                onClick={() => navigate({ tab: "LIBRARY" })}
              >
                <Plus size={16} />
                Create a question
              </button>
            </div>
          )}
          {published.next_after && (
            <button disabled={busy} onClick={() => void more("bugs")}>
              <ChevronDown size={15} />
              More published bugs
            </button>
          )}
        </section>
      )}
      {tab === "MONITOR" && (
        <>
          <section className="staff-section">
            <h2>Teams and members</h2>
            <div className="staff-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Members</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {round?.teams.map((t) => (
                    <tr key={t.team_id} data-team-id={t.team_id}>
                      <td>
                        {t.team_name}
                        {pauseButton("TEAM", t.team_round_id, t.team_name)}
                      </td>
                      <td>
                        {t.members.map((m) => (
                          <div
                            className="staff-member"
                            key={m.member_id}
                            data-member-id={m.member_id}
                          >
                            {m.member_name}
                            <small>{m.language ?? "Not enrolled"}</small>
                            {pauseButton(
                              "MEMBER",
                              m.member_round_id,
                              m.member_name,
                            )}
                            {m.member_round_id &&
                              paused("MEMBER", m.member_round_id) && (
                                <span>Paused</span>
                              )}
                          </div>
                        ))}
                      </td>
                      <td>
                        {paused("TEAM", t.team_round_id)
                          ? "Team paused"
                          : globalPause
                            ? "Global pause"
                            : round.state}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="staff-section">
            <div className="staff-section-heading">
              <h2>
                {round?.state.startsWith("CANCEL")
                  ? "Cancelled round history"
                  : view?.final
                    ? "Final standings"
                    : "Live standings"}
              </h2>
              {round && data?.instance && (
                <StaffResultsExport
                  api={api}
                  arena={data.instance.instance_id}
                  round={round.round_id}
                  kind={round.kind}
                  available={
                    !locked && !!view?.final && round.state === "CLOSED"
                  }
                />
              )}
            </div>
            <div className="staff-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Points</th>
                    <th>Effective time</th>
                  </tr>
                </thead>
                <tbody>
                  {view?.standings.map((s) => (
                    <tr key={s.team_round_id}>
                      <td>{s.rank ?? "--"}</td>
                      <td>
                        <StandingName
                          name={s.team_name}
                          overdrive={s.overdrive}
                        />
                      </td>
                      <td>{s.points}</td>
                      <td>{timeText(s.effective_time_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {round?.state === "CLOSED" && (
              <ScoreCorrections
                key={round.round_id}
                api={api}
                round={round.round_id}
                staff
                controls={moderator ? round : undefined}
                available={
                  ready &&
                  !!data &&
                  !busy &&
                  !sessionUnknown &&
                  !command.current.unresolved
                }
                blockNavigation={setAccessBlocked}
              />
            )}
          </section>
          <section className="staff-section">
            <h2>Recent judging</h2>
            <div className="staff-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Lane</th>
                    <th>Bug</th>
                    <th>Status</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {view?.judging.map((j) => (
                    <tr key={j.parent_id}>
                      <td>{label(j.lane)}</td>
                      <td>
                        {view.bounties.find((b) => b.bounty_id === j.bounty_id)
                          ?.title ?? j.bounty_id}
                      </td>
                      <td>{label(j.status)}</td>
                      <td>{j.result ? label(j.result) : "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {intent && (
        <Modal
          title={intent.title}
          close={() => {
            setIntent(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void commit(intent, reason);
            }}
          >
            <label>
              Change note
              <textarea
                aria-label="Change note"
                required
                maxLength={1024}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setIntent(null);
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  locked ||
                  !reason.trim() ||
                  new TextEncoder().encode(reason).length > 1024
                }
              >
                {intent.title}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {discard && (
        <Modal title="Discard local selections?" close={() => setDiscard(null)}>
          <p>Unsaved roster or bug selections will be discarded.</p>
          <div className="dialog-actions">
            <button onClick={() => setDiscard(null)}>Keep editing</button>
            <button
              onClick={() => {
                setDraft(null);
                if (discard.round) setActive(discard.round);
                if (discard.tab) setTab(discard.tab);
                setDiscard(null);
                void refresh.current();
              }}
            >
              Discard local selections
            </button>
          </div>
        </Modal>
      )}
      {signout && (
        <Modal
          title="Sign out of control room?"
          close={() => setSignout(false)}
        >
          <p>
            {draft?.dirty
              ? "Unsaved selections will be discarded."
              : "Your staff session will be ended."}
          </p>
          <button
            className="danger"
            disabled={busy}
            onClick={() => void sessionAction("logout")}
          >
            Confirm sign out
          </button>
        </Modal>
      )}
    </main>
  );
}
