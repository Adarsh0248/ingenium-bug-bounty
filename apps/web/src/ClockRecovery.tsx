import { useEffect, useRef, useState } from "react";
import { Check, LogOut, RefreshCw, ShieldAlert, X } from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import type { StaffSession } from "./types";
import { label, timeText } from "./types";
import { Brand, IconButton, Modal } from "./ui";

type Health = {
  expires_at: string;
  warning_at: string;
  runtime_id: string;
  fault_generation: string;
  fault_latched: boolean;
  state: string;
  healthy_count: number;
};
type Clearance = { clearance_id: string; generation: string; cleared: true };
const base = "/api/v1/staff/recovery/clock";

export default function ClockRecovery({
  api,
  session,
  leave,
}: {
  api: Api;
  session: StaffSession;
  leave: () => void;
}) {
  const [health, setHealth] = useState<Health | null>(null),
    [intent, setIntent] = useState<Health | null>(null),
    [receipt, setReceipt] = useState<Clearance | null>(null),
    [reason, setReason] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [readError, setReadError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [logoutUnknown, setLogoutUnknown] = useState(false),
    [, render] = useState(0);
  const mounted = useRef(true),
    reading = useRef(false),
    received = useRef(-Infinity),
    command = useRef<Command | null>(null),
    refresh = useRef(async () => {});
  command.current ??= new Command(
    api,
    "",
    () => render((v) => v + 1),
    "STAFF_RECOVERY",
  );
  const stale = performance.now() - received.current >= 10000,
    expiry = health?.expires_at ?? session.expires_at,
    expired = Date.now() >= Date.parse(expiry),
    locked =
      busy ||
      logoutUnknown ||
      command.current.unresolved ||
      !health ||
      stale ||
      expired;
  refresh.current = async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      const value = await api.request<Health>(
        base,
        undefined,
        "STAFF_RECOVERY",
      );
      if (mounted.current) {
        setHealth(value);
        setReadError("");
        received.current = performance.now();
      }
    } catch (e) {
      if (mounted.current) {
        setHealth(null);
        setCode("");
        setReadError(errorText(e));
      }
    } finally {
      reading.current = false;
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refresh.current();
    const poll = setInterval(() => {
        if (!document.hidden) void refresh.current();
      }, 5000),
      tick = setInterval(() => render((v) => v + 1), 1000);
    return () => {
      mounted.current = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);
  async function acknowledge(value: Clearance) {
    if (!mounted.current) return;
    setReceipt(value);
    setIntent(null);
    setCode("");
    setReason("");
    setError("");
    setNotice("");
    await refresh.current();
  }
  async function clear() {
    if (
      locked ||
      !intent ||
      !health?.fault_latched ||
      intent.runtime_id !== health.runtime_id ||
      intent.fault_generation !== health.fault_generation ||
      !code.trim() ||
      !reason.trim() ||
      new TextEncoder().encode(reason).length > 1024
    )
      return;
    const own = code;
    setCode("");
    setError("");
    setBusy(true);
    try {
      await acknowledge(
        await command.current!.send(
          `${base}/clear`,
          {
            own_code: own,
            runtime_id: intent.runtime_id,
            generation: intent.fault_generation,
            reason,
          },
          `${base}/outcomes`,
        ),
      );
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function recover() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await command.current!.recover();
      if (value) await acknowledge(value);
      else
        setNotice(
          "Clearance not observed. Keep this page open; do not resubmit.",
        );
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function signout() {
    if (busy || command.current!.unresolved || intent) return;
    setBusy(true);
    setError("");
    try {
      if (logoutUnknown) {
        await api.bootstrap("STAFF_RECOVERY");
        setNotice("Session is still active. Review before signing out again.");
        setLogoutUnknown(false);
      } else {
        await api.request(
          "/api/v1/staff/recovery/logout",
          {},
          "STAFF_RECOVERY",
        );
        leave();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        leave();
        return;
      }
      if (mounted.current) {
        setError(errorText(e));
        if (e instanceof ApiError && e.outcome === "UNKNOWN")
          setLogoutUnknown(true);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const close = () => {
    if (!busy && !command.current!.unresolved) {
      setIntent(null);
      setCode("");
      setReason("");
      setError("");
    }
  };
  return (
    <main className="staff-console clock-recovery">
      <header className="staff-header">
        <Brand />
        <div>
          <span className="eyebrow">RESTRICTED / TIMING RECOVERY</span>
          <strong>{session.display_name}</strong>
          <small>{label(session.role)}</small>
        </div>
        <IconButton
          title={logoutUnknown ? "Check sign-out status" : "Sign out"}
          disabled={busy || !!intent || command.current.unresolved}
          onClick={() => void signout()}
        >
          <LogOut size={19} />
        </IconButton>
      </header>
      <section className="staff-section">
        <div className="staff-section-heading">
          <h1>Timing recovery</h1>
          <IconButton
            title="Refresh timing state"
            disabled={busy || !!intent}
            onClick={() => void refresh.current()}
          >
            <RefreshCw size={17} />
          </IconButton>
        </div>
        <p>
          <ShieldAlert size={17} /> Recovery-only access. Competition controls
          remain unavailable.
        </p>
        <p className="muted">
          Session {timeText(Date.parse(expiry) - Date.now())}
        </p>
        {Date.now() >= Date.parse(health?.warning_at ?? session.warning_at) && (
          <p role="alert">
            Recovery session expires soon. A new sign-in is required after
            expiry.
          </p>
        )}
        {(error || readError) && !intent && (
          <p className="error" role="alert">
            {error || readError}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {health && (
          <dl className="incident-details">
            <dt>Runtime</dt>
            <dd>{health.runtime_id}</dd>
            <dt>Incident</dt>
            <dd>{health.fault_generation}</dd>
            <dt>State</dt>
            <dd>{label(health.state)}</dd>
            <dt>Fresh healthy samples</dt>
            <dd>{health.healthy_count} / 7</dd>
            <dt>Fault latch</dt>
            <dd>{health.fault_latched ? "Awaiting clearance" : "Cleared"}</dd>
          </dl>
        )}
        {receipt && (
          <p role="status">
            Clearance recorded for incident {receipt.generation}. Reference:{" "}
            <code>{receipt.clearance_id}</code>.
          </p>
        )}
        {health && !health.fault_latched && (
          <p role="status">
            Timing fault cleared. Sign out and sign in normally to open the
            control room.
          </p>
        )}
        {health?.fault_latched && !receipt && (
          <button
            className="primary"
            disabled={locked || !!intent}
            onClick={() => {
              setIntent(health);
              setError("");
              setNotice("");
            }}
          >
            <Check size={17} />
            Review clock clearance
          </button>
        )}
        {!intent && (
          <button
            disabled={busy || command.current.unresolved}
            onClick={() => void signout()}
          >
            <LogOut size={17} />
            {logoutUnknown
              ? "Check sign-out outcome"
              : "Sign out and return to entry"}
          </button>
        )}
      </section>
      {intent && (
        <Modal title="Confirm timing clearance" close={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void clear();
            }}
          >
            <p>
              Runtime <code>{intent.runtime_id}</code>, incident{" "}
              {intent.fault_generation}.
            </p>
            <p>
              Clear only after reviewing restored primary-host time. This does
              not resume a round, extend a deadline or grant normal admin
              access.
            </p>
            <label>
              Reason
              <textarea
                aria-label="Timing clearance reason"
                value={reason}
                maxLength={1024}
                required
                disabled={busy || command.current.unresolved}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              Your staff code
              <input
                aria-label="Timing clearance staff code"
                type="password"
                autoComplete="off"
                value={code}
                required
                disabled={busy || command.current.unresolved}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            {health &&
              (intent.runtime_id !== health.runtime_id ||
                intent.fault_generation !== health.fault_generation) && (
                <p role="alert">
                  Incident changed. Close and review current state.
                </p>
              )}
            {(error || readError) && (
              <p className="error" role="alert">
                {error || readError}
              </p>
            )}
            {command.current.unresolved ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void recover()}
              >
                <RefreshCw size={17} />
                Check clearance outcome
              </button>
            ) : (
              <div className="dialog-actions">
                <button type="button" disabled={busy} onClick={close}>
                  <X size={17} />
                  Back
                </button>
                <button
                  className="primary"
                  disabled={
                    locked ||
                    !health?.fault_latched ||
                    !reason.trim() ||
                    !code.trim() ||
                    intent.runtime_id !== health?.runtime_id ||
                    intent.fault_generation !== health?.fault_generation
                  }
                >
                  Confirm timing clearance
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </main>
  );
}
