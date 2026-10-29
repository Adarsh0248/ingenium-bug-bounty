import { useEffect, useRef, useState } from "react";
import type { Api } from "./api";
import { Command, errorText } from "./api";
import { Modal } from "./ui";
import type { ControlRound, Page } from "./staff-types";

interface Adjustment {
  id: string;
  team_name: string;
  delta: number;
  reason: string;
  actor_name: string;
  recorded_at: string;
  report_id: string | null;
}
export default function ScoreCorrections({
  api,
  round,
  staff = false,
  controls,
  available = true,
  blockNavigation = () => {},
}: {
  api: Api;
  round: string;
  staff?: boolean;
  controls?: ControlRound;
  available?: boolean;
  blockNavigation?: (blocked: boolean) => void;
}) {
  const [data, setData] = useState<Page<Adjustment>>({
      items: [],
      next_after: null,
    }),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [dialog, setDialog] = useState(false),
    [team, setTeam] = useState(""),
    [delta, setDelta] = useState(""),
    [reason, setReason] = useState(""),
    [report, setReport] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [, render] = useState(0);
  const command = useRef<Command | null>(null),
    revision = useRef("");
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const path = `/api/v1/${staff ? "staff/" : ""}competition/rounds/${round}/score-adjustments`,
    cursor = cursors.at(-1),
    blocked = dialog || busy || command.current.unresolved;
  useEffect(() => {
    blockNavigation(blocked);
    return () => blockNavigation(false);
  }, [blocked]);
  useEffect(() => {
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const value = await api.request<Page<Adjustment>>(
          `${path}${cursor ? `?after=${cursor}` : ""}`,
          undefined,
          staff ? "STAFF" : "PARTICIPANT",
        );
        if (!gone) setData(value);
      } catch (e) {
        if (!gone) setError(errorText(e));
      } finally {
        if (!gone) timer = setTimeout(() => void load(), 5000);
      }
    }
    void load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [path, cursor, refresh]);
  async function open() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const state = await api.request<{
        round: { round_id: string; state: string; revision: string };
      }>(`/api/v1/staff/competition/rounds/${round}`, undefined, "STAFF");
      if (state.round.round_id !== round || state.round.state !== "CLOSED")
        throw new Error("Final standings are no longer available.");
      revision.current = state.round.revision;
      setTeam(
        controls!.teams.find((t) => t.team_round_id)?.team_round_id ?? "",
      );
      setDelta("");
      setReason("");

      setReport("");
      setDialog(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(recover = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = recover
        ? await command.current!.recover()
        : await command.current!.send(
            path,
            {
              team_round_id: team,
              report_id: report.trim() || null,
              delta: Number(delta),
              reason,

              expected_revision: revision.current,
            },
            `${path}/outcomes`,
          );
      if (value) {
        setDialog(false);
        setNotice(
          `Score adjustment recorded: ${value.delta > 0 ? "+" : ""}${value.delta} points. Standings have been recalculated.`,
        );
        setRefresh((v) => v + 1);
      } else
        setError(
          "Original adjustment is not confirmed. Check again; do not send another adjustment.",
        );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const number = Number(delta),
    invalid =
      !team ||
      !reason.trim() ||
      !Number.isInteger(number) ||
      !number ||
      Math.abs(number) > 1000000;
  return (
    <section
      aria-label="Score correction history"
      className="score-corrections"
    >
      <div className="staff-section-heading">
        <h3>Score corrections</h3>
        {staff && controls?.state === "CLOSED" && (
          <button disabled={!available || blocked} onClick={open}>
            Adjust points
          </button>
        )}
      </div>
      <p className="muted">
        Corrections affect points and rank. Wallets, solve times, claimed bugs
        and an already locked qualification roster stay as recorded.
      </p>
      {!data.items.length ? (
        <p className="muted">No score corrections.</p>
      ) : (
        <ul>
          {data.items.map((a) => (
            <li key={a.id}>
              <strong>
                {a.team_name}: {a.delta > 0 ? "+" : ""}
                {a.delta}
              </strong>{" "}
              — {a.reason}
              <small>
                {" "}
                · {a.actor_name} · {new Date(a.recorded_at).toLocaleString()}
                {a.report_id ? ` · Ticket ${a.report_id}` : ""}
              </small>
            </li>
          ))}
        </ul>
      )}
      {(cursors.length > 1 || data.next_after) && (
        <div className="pagination">
          <button
            disabled={cursors.length === 1 || busy}
            onClick={() => setCursors((v) => v.slice(0, -1))}
          >
            Previous corrections
          </button>
          <button
            disabled={!data.next_after || busy}
            onClick={() => setCursors((v) => [...v, data.next_after!])}
          >
            Older corrections
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && !dialog && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {command.current.unresolved && !busy && !dialog && (
        <button onClick={() => void save(true)}>
          Check original adjustment
        </button>
      )}
      {dialog && (
        <Modal
          title="Adjust final points"
          close={() => {
            if (!busy && !command.current!.unresolved) setDialog(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <p>
              Apply a signed change to the final standings. To undo an error,
              record an opposite adjustment with a reason; previous records
              cannot be edited.
            </p>
            <label>
              Team
              <select
                aria-label="Adjustment team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                disabled={busy || command.current.unresolved}
              >
                {controls?.teams
                  .filter((t) => t.team_round_id)
                  .map((t) => (
                    <option key={t.team_round_id} value={t.team_round_id!}>
                      {t.team_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Points to add (+) or deduct (−)
              <input
                aria-label="Point adjustment"
                type="number"
                step="1"
                min="-1000000"
                max="1000000"
                required
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                disabled={busy || command.current.unresolved}
              />
            </label>
            <label>
              Reason visible in final results
              <textarea
                aria-label="Score adjustment reason"
                required
                maxLength={1024}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy || command.current.unresolved}
              />
            </label>
            <label>
              Related upheld ticket ID (optional)
              <input
                aria-label="Related ticket ID"
                value={report}
                onChange={(e) => setReport(e.target.value)}
                disabled={busy || command.current.unresolved}
              />
            </label>

            <button
              className="primary"
              disabled={
                !available || busy || command.current.unresolved || invalid
              }
            >
              {busy
                ? "Recording correction…"
                : `Confirm ${number > 0 ? "+" : ""}${Number.isFinite(number) ? number : 0} points`}
            </button>
          </form>
          {command.current.unresolved && !busy && (
            <button onClick={() => void save(true)}>
              Check original adjustment
            </button>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
