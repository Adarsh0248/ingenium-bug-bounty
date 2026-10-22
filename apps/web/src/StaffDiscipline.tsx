import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  ClockPlus,
  RefreshCw,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import type { ControlRound } from "./staff-types";
import { IconButton, Modal } from "./ui";
import { label } from "./types";

type Receipt = {
  outcome_id: string;
  action: string;
  outcome: string;
  reason: string | null;
  minutes: number | null;
  member_id: string | null;
  recorded_at: string;
  audit_reason: string;
  actor_id: string;
  actor_name: string;
  reversed: boolean;
};
type State = {
  current: boolean;
  security_revision: string;
  round_revision: string;
  state: string;
  enrolled: boolean;
  manual_minutes: number;
  blocks: {
    block_id: string;
    member_id: string | null;
    reason: string;
    created_at: string;
  }[];
  items: Receipt[];
  next_after: string | null;
};
type Intent = {
  action: "BLOCK" | "UNBLOCK" | "PENALISE" | "REVERSE";
  member: string | null;
  block: string | null;
  original: string | null;
  revision: string;
  title: string;
};
const base = "/api/v1/staff/discipline";
export default function StaffDiscipline({
  api,
  arenaId,
  round,
  available,
  liveRevision,
  blockNavigation,
}: {
  api: Api;
  arenaId: string;
  round: ControlRound;
  available: boolean;
  liveRevision?: string;
  blockNavigation: (v: boolean) => void;
}) {
  const [teamId, setTeamId] = useState(round.teams[0]?.team_id ?? ""),
    [data, setData] = useState<State | null>(null),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [intent, setIntent] = useState<Intent | null>(null),
    [minutes, setMinutes] = useState("5"),
    [reason, setReason] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [denied, setDenied] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [, render] = useState(0);
  const mounted = useRef(true),
    generation = useRef(0),
    reading = useRef(false),
    command = useRef<Command | null>(null),
    refresh = useRef(async () => {});
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const team = round.teams.find((t) => t.team_id === teamId),
    cursor = cursors.at(-1),
    locked =
      !available || denied || busy || command.current.unresolved || loading,
    active = !!data?.current,
    canPenalise =
      active &&
      data?.enrolled &&
      ["RUNNING", "PAUSED", "CLOSING"].includes(data.state),
    blocked = !!intent || busy || command.current.unresolved;
  refresh.current = async () => {
    if (!teamId || reading.current) return;
    reading.current = true;
    const current = generation.current;
    setLoading(true);
    try {
      const value = await api.request<State>(
        `${base}?arena_id=${arenaId}&team_id=${teamId}&round_id=${round.round_id}${cursor ? `&after=${cursor}` : ""}`,
        undefined,
        "STAFF",
      );
      if (mounted.current && current === generation.current) {
        setData(value);
        setDenied(false);
      }
    } catch (e) {
      if (!mounted.current || current !== generation.current) return;
      if (e instanceof ApiError && [401, 403].includes(e.status)) {
        setData(null);
        setIntent(null);
        setCode("");
        setReason("");
        setDenied(true);
      }
      setError(errorText(e));
    } finally {
      reading.current = false;
      if (mounted.current && current === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    generation.current++;
    reading.current = false;
    setData(null);
    void refresh.current();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh.current();
    }, 15000);
    return () => {
      mounted.current = false;
      generation.current++;
      clearInterval(timer);
    };
  }, [teamId, cursor]);
  useEffect(() => {
    void refresh.current();
  }, [liveRevision]);
  useEffect(() => {
    blockNavigation(blocked);
  }, [blocked]);
  useEffect(() => () => blockNavigation(false), []);
  function choose(
    action: Intent["action"],
    member: string | null = null,
    block: string | null = null,
    original: string | null = null,
  ) {
    if (locked || !data) return;
    setIntent({
      action,
      member,
      block,
      original,
      revision: ["BLOCK", "UNBLOCK"].includes(action)
        ? data.security_revision
        : data.round_revision,
      title: `${label(action)}: ${member ? team?.members.find((m) => m.member_id === member)?.member_name : team?.team_name}`,
    });
    setReason("");
    setCode("");
    setError("");
    setNotice("");
  }
  async function acknowledge(value: { outcome: Receipt } | Receipt) {
    if (!mounted.current) return;
    const receipt =
      typeof value.outcome === "object" ? value.outcome : (value as Receipt);
    if (receipt.outcome === "REJECTED")
      setError(`Action declined: ${label(receipt.reason ?? "unavailable")}.`);
    else {
      setNotice(`${label(receipt.action)} confirmed.`);
      setIntent(null);
      setReason("");
    }
    await refresh.current();
  }
  async function send() {
    if (
      locked ||
      !intent ||
      !reason.trim() ||
      new TextEncoder().encode(reason).length > 1024 ||
      !code.trim()
    )
      return;
    const amount = Number(minutes);
    if (
      intent.action === "PENALISE" &&
      (!Number.isInteger(amount) || amount < 1 || amount > 300)
    )
      return;
    const saved = code;
    setCode("");
    setBusy(true);
    setError("");
    try {
      await acknowledge(
        await command.current!.send(
          base,
          {
            action: intent.action,
            arena_id: arenaId,
            team_id: teamId,
            member_id: intent.member,
            round_id: ["PENALISE", "REVERSE"].includes(intent.action)
              ? round.round_id
              : null,
            block_id: intent.block,
            original_id: intent.original,
            minutes: intent.action === "PENALISE" ? amount : null,
            expected_revision: intent.revision,
            reason,
            own_code: saved,
          },
          "/api/v1/staff/outcomes/discipline",
        ),
      );
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function recover() {
    if (busy || !available) return;
    setBusy(true);
    setError("");
    try {
      const r = await command.current!.recover();
      if (r) await acknowledge(r);
      else setNotice("Outcome not observed yet.");
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const stale =
    intent &&
    data &&
    intent.revision !==
      (["BLOCK", "UNBLOCK"].includes(intent.action)
        ? data.security_revision
        : data.round_revision);
  return (
    <section className="staff-section staff-discipline">
      <div className="staff-section-heading">
        <h2>Discipline</h2>
        <IconButton
          title="Refresh discipline"
          disabled={locked || !!intent}
          onClick={() => void refresh.current()}
        >
          <RefreshCw size={16} />
        </IconButton>
      </div>
      <label>
        Team
        <select
          aria-label="Discipline team"
          value={teamId}
          disabled={blocked || !available}
          onChange={(e) => {
            setTeamId(e.target.value);
            setCursors([undefined]);
            setError("");
            setNotice("");
          }}
        >
          {round.teams.map((t) => (
            <option key={t.team_id} value={t.team_id}>
              {t.team_name} ({t.team_id.slice(-8)})
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {data && team && (
        <>
          <div className="staff-section-heading">
            <h3>Access blocks</h3>
            <button
              disabled={
                locked ||
                !active ||
                data.blocks.some((b) => b.member_id === null)
              }
              onClick={() => choose("BLOCK")}
            >
              <Ban size={16} />
              Block team
            </button>
          </div>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { member_id: null, member_name: "Whole team" },
                  ...team.members,
                ].map((m) => {
                  const b = data.blocks.find(
                    (b) => b.member_id === m.member_id,
                  );
                  return (
                    <tr key={m.member_id ?? "team"}>
                      <td>{m.member_name}</td>
                      <td>
                        {b
                          ? "Blocked"
                          : m.member_id && data.blocks.some((b) => !b.member_id)
                            ? "Team blocked"
                            : "No direct block"}
                      </td>
                      <td>{b?.reason ?? "-"}</td>
                      <td>
                        <IconButton
                          title={`${b ? "Unblock" : "Block"} ${m.member_name}`}
                          disabled={locked || !active}
                          onClick={() =>
                            choose(
                              b ? "UNBLOCK" : "BLOCK",
                              m.member_id,
                              b?.block_id ?? null,
                            )
                          }
                        >
                          {b ? <Undo2 size={16} /> : <Ban size={16} />}
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="staff-section-heading">
            <h3>Manual time: {data.manual_minutes} / 300 min</h3>
            <button
              disabled={locked || !canPenalise || data.manual_minutes >= 300}
              onClick={() => choose("PENALISE")}
            >
              <ClockPlus size={16} />
              Add time penalty
            </button>
          </div>
          <h3>Audit history</h3>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Scope</th>
                  <th>Minutes</th>
                  <th>Staff</th>
                  <th>Reason</th>
                  <th>Outcome</th>
                  <th>Reversal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.outcome_id}>
                    <td>{new Date(r.recorded_at).toLocaleString()}</td>
                    <td>{label(r.action)}</td>
                    <td>
                      {r.member_id
                        ? team.members.find((m) => m.member_id === r.member_id)
                            ?.member_name
                        : "Team"}
                    </td>
                    <td>{r.minutes ?? "-"}</td>
                    <td title={r.actor_id}>{r.actor_name}</td>
                    <td>{r.audit_reason}</td>
                    <td>{label(r.reason ?? r.outcome)}</td>
                    <td>
                      {r.action === "PENALISE" &&
                        r.outcome === "APPLIED" &&
                        (r.reversed ? (
                          "Reversed"
                        ) : (
                          <IconButton
                            title={`Reverse ${r.minutes} minute penalty`}
                            disabled={locked || !canPenalise}
                            onClick={() =>
                              choose("REVERSE", null, null, r.outcome_id)
                            }
                          >
                            <Undo2 size={16} />
                          </IconButton>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <IconButton
              title="Previous discipline page"
              disabled={locked || blocked || cursors.length === 1}
              onClick={() => setCursors((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {cursors.length}</span>
            <IconButton
              title="Next discipline page"
              disabled={locked || blocked || !data.next_after}
              onClick={() => setCursors((v) => [...v, data.next_after!])}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
        </>
      )}
      {intent && (
        <Modal
          title={intent.title}
          close={() => {
            if (!busy && !command.current!.unresolved) {
              setIntent(null);
              setCode("");
              setReason("");
            }
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {intent.action === "BLOCK" && (
              <p>
                Access will be revoked. Admitted submissions and earned bounty
                remain.
              </p>
            )}
            {intent.action === "UNBLOCK" && (
              <p>
                Existing sessions remain revoked. Same-round re-entry requires
                staff recovery.
              </p>
            )}
            {intent.action === "REVERSE" && (
              <p>The original time addition will be reversed exactly once.</p>
            )}
            {intent.action === "PENALISE" && (
              <label>
                Penalty (whole minutes)
                <input
                  aria-label="Penalty minutes"
                  type="number"
                  min="1"
                  max={300 - (data?.manual_minutes ?? 0)}
                  step="1"
                  value={minutes}
                  disabled={busy || command.current!.unresolved}
                  onChange={(e) => setMinutes(e.target.value)}
                  required
                />
              </label>
            )}
            <label>
              Reason
              <textarea
                aria-label="Discipline reason"
                maxLength={1024}
                value={reason}
                disabled={busy || command.current!.unresolved}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            <label>
              Your staff code
              <input
                aria-label="Discipline staff code"
                type="password"
                autoComplete="off"
                value={code}
                disabled={busy || command.current!.unresolved}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            {stale && (
              <p role="alert">
                State changed. Close this confirmation and review the latest
                state.
              </p>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {command.current.unresolved ? (
              <button
                type="button"
                disabled={busy || !available}
                onClick={() => void recover()}
              >
                <RefreshCw size={16} />
                Check outcome
              </button>
            ) : (
              <div className="actions">
                <button
                  type="submit"
                  disabled={locked || !!stale || !reason.trim() || !code.trim()}
                >
                  <ShieldCheck size={16} />
                  Confirm discipline
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setIntent(null);
                    setCode("");
                    setReason("");
                  }}
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
