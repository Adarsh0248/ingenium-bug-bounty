import { useEffect, useRef, useState } from "react";
import { Ban, Check, RefreshCw, X } from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import { IconButton, Modal } from "./ui";
import { label } from "./types";
type State = {
  arena_id: string;
  round_id: string;
  state: string;
  revision: string;
  current: boolean;
  held_executions: number;
  cancelled_work: number;
  pending_work: number;
  cancellation: {
    cancellation_id: string;
    incident_ref: string;
    reason: string;
    actor_name: string;
    started_at: string;
    finished_at: string | null;
  } | null;
};
type Intent = { action: "CANCEL_ROUND" | "FINISH_CANCEL"; revision: string };
export default function StaffIncidents({
  api,
  roundId,
  available,
  blockNavigation,
  changed,
}: {
  api: Api;
  roundId: string;
  available: boolean;
  blockNavigation: (v: boolean) => void;
  changed: () => void;
}) {
  const [data, setData] = useState<State | null>(null),
    [intent, setIntent] = useState<Intent | null>(null),
    [incident, setIncident] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [, render] = useState(0);
  const mounted = useRef(true),
    reading = useRef(false),
    command = useRef<Command | null>(null),
    refresh = useRef(async () => {}),
    base = `/api/v1/staff/competition/rounds/${roundId}`;
  command.current ??= new Command(
    api,
    roundId,
    () => render((v) => v + 1),
    "STAFF",
  );
  const locked = !available || denied || busy || command.current.unresolved,
    blocked = !!intent || busy || command.current.unresolved;
  refresh.current = async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      const r = await api.request<State>(
        `${base}/cancellation`,
        undefined,
        "STAFF",
      );
      if (mounted.current) {
        setData(r);
        setDenied(false);
      }
    } catch (e) {
      if (mounted.current) {
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setData(null);
          setIntent(null);

          setReason("");
          setDenied(true);
        }
        setError(errorText(e));
      }
    } finally {
      reading.current = false;
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refresh.current();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh.current();
    }, 5000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    blockNavigation(blocked);
  }, [blocked]);
  useEffect(() => () => blockNavigation(false), []);
  function choose(action: Intent["action"]) {
    if (locked || !data) return;
    setIntent({ action, revision: data.revision });
    setConfirmation("");
    setReason("");

    setError("");
    setNotice("");
  }
  async function acknowledge(r: any) {
    if (!mounted.current) return;
    setError("");
    if (r.result.status === "REJECTED")
      setError(`Action declined: ${label(r.result.reason ?? "unavailable")}.`);
    else {
      setNotice(`${label(r.action)} confirmed.`);
      setIntent(null);
      setReason("");
      changed();
    }
    await refresh.current();
  }
  async function send() {
    if (
      locked ||
      !data ||
      !intent ||
      !reason.trim() ||
      new TextEncoder().encode(reason).length > 1024 ||
      (intent.action === "CANCEL_ROUND" &&
        (confirmation !== roundId ||
          !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(incident)))
    )
      return;

    setBusy(true);
    setError("");
    try {
      await acknowledge(
        await command.current!.send(`${base}/commands`, {
          action: intent.action,
          expected_revision: intent.revision,
          reason,

          payload:
            intent.action === "CANCEL_ROUND"
              ? {
                  arena_id: data.arena_id,
                  confirmed_round_id: confirmation,
                  incident_ref: incident,
                }
              : {
                  arena_id: data.arena_id,
                  cancellation_id: data.cancellation!.cancellation_id,
                },
        }),
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
  return (
    <section className="staff-section staff-incidents">
      <div className="staff-section-heading">
        <h2>Round incidents</h2>
        <IconButton
          title="Refresh incident state"
          disabled={locked || !!intent}
          onClick={() => void refresh.current()}
        >
          <RefreshCw size={16} />
        </IconButton>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {data && (
        <>
          <dl className="incident-details">
            <dt>Arena</dt>
            <dd>{data.arena_id}</dd>
            <dt>Round</dt>
            <dd>{roundId}</dd>
            <dt>State</dt>
            <dd>{label(data.state)}</dd>
            <dt>Held executions</dt>
            <dd>{data.held_executions}</dd>
            <dt>Cancelled work</dt>
            <dd>{data.cancelled_work}</dd>
          </dl>
          {data.cancellation ? (
            <dl className="incident-details">
              <dt>Incident reference</dt>
              <dd>{data.cancellation.incident_ref}</dd>
              <dt>Reason</dt>
              <dd>{data.cancellation.reason}</dd>
              <dt>Staff</dt>
              <dd>{data.cancellation.actor_name}</dd>
              <dt>Cancelled at</dt>
              <dd>{new Date(data.cancellation.started_at).toLocaleString()}</dd>
              <dt>Archived at</dt>
              <dd>
                {data.cancellation.finished_at
                  ? new Date(data.cancellation.finished_at).toLocaleString()
                  : "Pending safe drain"}
              </dd>
            </dl>
          ) : (
            <p>No cancellation recorded.</p>
          )}
          {data.state === "CANCELLING" && (
            <p role="status">
              Round invalidated. Arena remains reserved until execution drain is
              proven. Logical work remaining: {data.pending_work}.
            </p>
          )}
          {data.state === "CANCELLED" && (
            <p role="status">
              Round cancelled. No competitive result. The arena is archived.
            </p>
          )}
          {data.current &&
            ["RUNNING", "PAUSED", "CLOSING"].includes(data.state) && (
              <button
                className="danger"
                disabled={locked}
                onClick={() => choose("CANCEL_ROUND")}
              >
                <Ban size={16} />
                Cancel whole round
              </button>
            )}
          {data.current && data.state === "CANCELLING" && (
            <button
              disabled={
                locked || data.held_executions > 0 || data.pending_work > 0
              }
              onClick={() => choose("FINISH_CANCEL")}
            >
              <Check size={16} />
              Finish cancellation
            </button>
          )}
        </>
      )}
      {intent && data && (
        <Modal
          title={
            intent.action === "CANCEL_ROUND"
              ? "Cancel whole round"
              : "Finish cancellation"
          }
          close={() => {
            if (!busy && !command.current!.unresolved) {
              setIntent(null);

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
            {intent.action === "CANCEL_ROUND" ? (
              <>
                <p className="error">
                  This whole round loses competitive validity. No winner or
                  qualification will be declared. Committed history is
                  preserved. Round 2 cannot be replayed in this arena.
                </p>
                <label>
                  Incident reference
                  <input
                    aria-label="Cancellation incident reference"
                    maxLength={120}
                    value={incident}
                    disabled={busy || command.current!.unresolved}
                    onChange={(e) => setIncident(e.target.value)}
                    required
                  />
                </label>
                <p>
                  Confirm round: <code>{roundId}</code>
                </p>
                <label>
                  Exact round ID
                  <input
                    aria-label="Cancellation round confirmation"
                    value={confirmation}
                    disabled={busy || command.current!.unresolved}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                  />
                </label>
              </>
            ) : (
              <p>
                The cancelled arena will be archived. Any new event must start
                with a fresh Round 1.
              </p>
            )}
            <label>
              Reason
              <textarea
                aria-label="Cancellation reason"
                maxLength={1024}
                value={reason}
                disabled={busy || command.current!.unresolved}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>

            {intent.revision !== data.revision && (
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
                Check cancellation outcome
              </button>
            ) : (
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setIntent(null);

                    setReason("");
                  }}
                >
                  <X size={16} />
                  Back
                </button>
                <button
                  className="danger"
                  type="submit"
                  disabled={
                    locked ||
                    intent.revision !== data.revision ||
                    !reason.trim() ||
                    (intent.action === "CANCEL_ROUND" &&
                      (confirmation !== roundId ||
                        !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(incident)))
                  }
                >
                  Confirm cancellation
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
