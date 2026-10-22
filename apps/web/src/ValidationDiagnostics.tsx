import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, RefreshCw, X } from "lucide-react";
import { Command, errorText } from "./api";
import type { Api } from "./api";
import type { ValidationReport } from "./content-types";
import { IconButton, Modal } from "./ui";
import { displayOutput } from "./output";
import { label, languages } from "./types";

interface Diagnostic {
  audit_id: string;
  run_id: string;
  attempt_id: string;
  request_key: string;
  reason: string;
  recorded_at: string;
  result: string;
  stdout_b64: string;
  stderr_b64: string;
  compiler_output_b64: string;
  stdout_bytes: number;
  stdout_complete: boolean;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  compiler_output_truncated: boolean;
  cpu_ns: string;
  peak_bytes: string;
}
interface History {
  items: {
    id: string;
    attempt_id: string;
    actor_name: string;
    reason: string;
    recorded_at: string;
  }[];
  next_after: string | null;
}
export default function ValidationDiagnostics({
  api,
  report,
  available,
  blockNavigation,
}: {
  api: Api;
  report: ValidationReport;
  available: boolean;
  blockNavigation: (value: boolean) => void;
}) {
  const [value, setValue] = useState<Diagnostic | null>(null),
    [dialog, setDialog] = useState(false),
    [attempt, setAttempt] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<History | null>(null),
    [historyError, setHistoryError] = useState(""),
    [pages, setPages] = useState<(string | null)[]>([null]),
    [refresh, setRefresh] = useState(0),
    [reading, setReading] = useState(false),
    [, render] = useState(0);
  const mounted = useRef(true),
    allowed = useRef(available),
    generation = useRef(0),
    command = useRef<Command | null>(null),
    path = `/api/v1/staff/content/validation-runs/${report.run_id}/diagnostics`;
  if (allowed.current !== available) {
    allowed.current = available;
    generation.current++;
  }
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const unresolved = command.current.unresolved,
    blocked = busy || unresolved,
    after = pages.at(-1),
    attempts = report.checks.flatMap((check, index) =>
      check.dispatches
        .filter((a) => a.resolved_at !== null)
        .map((a) => ({
          ...a,
          name: `Check ${index + 1}, ${languages[check.language]}, ${label(check.source_role)}, dispatch ${a.number}: ${label(a.result ?? "pending")}`,
        })),
    );
  useEffect(() => {
    blockNavigation(dialog || blocked);
  }, [dialog, blocked]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      blockNavigation(false);
    };
  }, []);
  useEffect(() => {
    if (!available) {
      setValue(null);
      setHistory(null);
    }
  }, [available]);
  useEffect(() => {
    if (!available) return;
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    function load() {
      setReading(true);
      void api
        .request<History>(
          `${path}${after ? `?after=${after}` : ""}`,
          undefined,
          "STAFF",
        )
        .then((result) => {
          if (!gone) {
            setHistory(result);
            setHistoryError("");
          }
        })
        .catch((e) => {
          if (!gone) {
            generation.current++;
            setValue(null);
            setHistory(null);
            setHistoryError(errorText(e));
          }
        })
        .finally(() => {
          if (!gone) {
            setReading(false);
            timer = setTimeout(load, 5000);
          }
        });
    }
    load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [api, path, after, available, refresh]);
  function show(result: Diagnostic) {
    if (!allowed.current || result.run_id !== report.run_id) return;
    setValue(result);
    setDialog(false);
    setReason("");
    setConfirmation("");
    setError("");
    setPages([null]);
    setRefresh((v) => v + 1);
  }
  async function open(recover = false) {
    if (
      busy ||
      !available ||
      (!recover &&
        (unresolved ||
          confirmation !== report.run_id ||
          !attempts.some((a) => a.id === attempt) ||
          !reason.trim() ||
          new TextEncoder().encode(reason).length > 1024))
    )
      return;
    const current = generation.current;
    setBusy(true);
    setError("");
    setValue(null);
    try {
      const result = recover
        ? await command.current!.recover()
        : await command.current!.send(
            path,
            { confirm_run_id: confirmation, attempt_id: attempt, reason },
            path,
          );
      if (mounted.current) {
        if (current !== generation.current)
          setError(
            "Access changed while diagnostics were loading. The private view remains closed.",
          );
        else if (result) show(result);
        else setError("Original diagnostic review not observed yet.");
      }
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className="submission-review validation-diagnostics"
      aria-label="Private validation diagnostics"
    >
      <div className="staff-section-heading">
        <h3>Private diagnostics</h3>
        <button
          disabled={!available || blocked || !attempts.length}
          onClick={() => {
            setDialog(true);
            setAttempt(attempts[0]!.id);
            setError("");
          }}
        >
          <Eye size={16} /> Review validation output
        </button>
      </div>
      {error && !dialog && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {available && value && (
        <div className="private-review-payload">
          <div className="staff-section-heading">
            <h4>Validation dispatch: {label(value.result)}</h4>
            <IconButton
              title="Close validation diagnostics"
              onClick={() => setValue(null)}
            >
              <X size={16} />
            </IconButton>
          </div>
          <dl className="judging-reference">
            <dt>Dispatch</dt>
            <dd>
              <code>{value.attempt_id}</code>
            </dd>
            <dt>Review reason</dt>
            <dd>{value.reason}</dd>
            <dt>Review recorded</dt>
            <dd>{new Date(value.recorded_at).toLocaleString()}</dd>
            <dt>CPU time (ns)</dt>
            <dd>{value.cpu_ns}</dd>
            <dt>Peak memory (bytes)</dt>
            <dd>{value.peak_bytes}</dd>
            <dt>Observed stdout bytes</dt>
            <dd>
              {value.stdout_bytes}
              {!value.stdout_complete ? " / Incomplete capture" : ""}
            </dd>
          </dl>
          {(
            [
              ["Validation stdout", value.stdout_b64, value.stdout_truncated],
              ["Validation stderr", value.stderr_b64, value.stderr_truncated],
              [
                "Validation compiler output",
                value.compiler_output_b64,
                value.compiler_output_truncated,
              ],
            ] as const
          ).map(([name, bytes, truncated]) => (
            <div key={name}>
              <h4>
                {name}
                {truncated ? " (truncated)" : ""}
              </h4>
              <pre className="review-code" aria-label={name}>
                {bytes ? displayOutput(bytes) : "No retained output"}
              </pre>
            </div>
          ))}
        </div>
      )}
      <div className="staff-section-heading">
        <h4>Diagnostic access history</h4>
        <IconButton
          title="Refresh diagnostic access history"
          disabled={!available || reading || blocked}
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={16} />
        </IconButton>
      </div>
      {historyError && (
        <p role="alert" className="error">
          {historyError}
        </p>
      )}
      {available && history && (
        <>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Time</th>
                  <th>Dispatch</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.actor_name}</td>
                    <td>{new Date(item.recorded_at).toLocaleString()}</td>
                    <td className="staff-reference">{item.attempt_id}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.items.length && (
            <p className="muted">No diagnostic reviews recorded.</p>
          )}
          <div className="history-pagination">
            <IconButton
              title="Previous diagnostic access page"
              disabled={blocked || reading || pages.length === 1}
              onClick={() => setPages((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {pages.length}</span>
            <IconButton
              title="Next diagnostic access page"
              disabled={blocked || reading || !history.next_after}
              onClick={() => setPages((v) => [...v, history.next_after])}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
        </>
      )}
      {dialog && (
        <Modal
          title="Private validation diagnostic review"
          close={() => {
            if (!blocked) {
              setDialog(false);
              setReason("");
              setConfirmation("");
            }
          }}
        >
          <code className="judging-job-id">{report.run_id}</code>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void open();
            }}
          >
            <label>
              Completed dispatch
              <select
                aria-label="Validation diagnostic dispatch"
                value={attempt}
                disabled={blocked}
                onChange={(e) => setAttempt(e.target.value)}
              >
                {attempts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Exact validation run ID
              <input
                aria-label="Diagnostic run confirmation"
                value={confirmation}
                disabled={blocked}
                required
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <label>
              Review reason
              <textarea
                aria-label="Diagnostic review reason"
                value={reason}
                maxLength={1024}
                disabled={blocked}
                required
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="submit"
                disabled={
                  blocked ||
                  !available ||
                  confirmation !== report.run_id ||
                  !reason.trim() ||
                  new TextEncoder().encode(reason).length > 1024
                }
              >
                <Eye size={16} /> Open validation diagnostics
              </button>
            </div>
          </form>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {unresolved && (
            <button
              disabled={busy || !available}
              onClick={() => void open(true)}
            >
              <RefreshCw size={16} /> Check original diagnostics
            </button>
          )}
        </Modal>
      )}
    </section>
  );
}
