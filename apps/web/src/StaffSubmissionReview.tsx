import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, RefreshCw, X } from "lucide-react";
import type { Api } from "./api";
import { Command, errorText } from "./api";
import type { JudgeDetail } from "./judging-types";
import { IconButton, Modal } from "./ui";
import { displayOutput } from "./output";
import { label } from "./types";

interface Review {
  audit_id: string;
  request_key: string;
  parent_id: string;
  recorded_at: string;
  reason: string;
  source_sha256: string;
  source_b64: string;
  language: string;
  lane: string;
  diagnostic: null | {
    attempt_id: string;
    result: string;
    stdout_b64: string;
    stderr_b64: string;
    compiler_output_b64: string;
    stdout_truncated: boolean;
    stderr_truncated: boolean;
    compiler_output_truncated: boolean;
  };
}
interface History {
  items: {
    id: string;
    actor_name: string;
    reason: string;
    recorded_at: string;
    includes_diagnostics: boolean;
  }[];
  next_after: string | null;
}
export default function StaffSubmissionReview({
  api,
  base,
  detail,
  available,
  blockNavigation,
}: {
  api: Api;
  base: string;
  detail: JudgeDetail;
  available: boolean;
  blockNavigation: (value: boolean) => void;
}) {
  const [review, setReview] = useState<Review | null>(null),
    [dialog, setDialog] = useState(false),
    [attempt, setAttempt] = useState(""),
    [reason, setReason] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState<History | null>(null),
    [pages, setPages] = useState<(string | null)[]>([null]),
    [refresh, setRefresh] = useState(0),
    [reading, setReading] = useState(false),
    [historyError, setHistoryError] = useState(""),
    [, render] = useState(0);
  const mounted = useRef(true),
    allowed = useRef(available),
    generation = useRef(0),
    command = useRef<Command | null>(null),
    path = `${base}/judging/${detail.parent.id}/reviews`;
  if (allowed.current !== available) {
    allowed.current = available;
    generation.current++;
  }
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const unresolved = command.current.unresolved,
    blocked = busy || unresolved,
    after = pages.at(-1);
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
      setReview(null);
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
        .then((value) => {
          if (!gone) {
            setHistory(value);
            setHistoryError("");
          }
        })
        .catch((e) => {
          if (!gone) {
            generation.current++;
            setReview(null);
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
  }, [api, path, after, refresh, available]);
  function show(value: Review) {
    if (!allowed.current || value.parent_id !== detail.parent.id) return;
    setReview(value);
    setDialog(false);
    setReason("");
    setConfirmation("");
    setError("");
    setPages([null]);
    setRefresh((v) => v + 1);
  }
  async function open() {
    if (
      blocked ||
      !available ||
      confirmation !== detail.parent.id ||
      !reason.trim() ||
      new TextEncoder().encode(reason).length > 1024
    )
      return;
    setBusy(true);
    setError("");
    setReview(null);
    const current = generation.current;
    try {
      const value = await command.current!.send(
        path,
        {
          confirm_parent_id: confirmation,
          attempt_id: attempt || null,
          reason,
        },
        path,
      );
      if (mounted.current) {
        if (current === generation.current) show(value);
        else
          setError(
            "Access changed while the review was loading. The private view remains closed.",
          );
      }
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
    const current = generation.current;
    try {
      const value = await command.current!.recover();
      if (mounted.current) {
        if (value && current === generation.current) show(value);
        else if (value)
          setError(
            "Access changed while the review was loading. The private view remains closed.",
          );
        else setError("Original review not observed yet.");
      }
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className="submission-review"
      aria-label="Restricted submission review"
    >
      <div className="staff-section-heading">
        <h3>Private review</h3>
        <button
          disabled={!available || blocked}
          onClick={() => {
            setDialog(true);
            setError("");
          }}
        >
          <Eye size={15} /> Review submitted program
        </button>
      </div>
      {error && !dialog && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {available && review && (
        <div className="private-review-payload">
          <div className="staff-section-heading">
            <h4>Submitted program</h4>
            <IconButton
              title="Close private review"
              onClick={() => setReview(null)}
            >
              <X size={17} />
            </IconButton>
          </div>
          <dl className="judging-reference">
            <dt>Review recorded</dt>
            <dd>{new Date(review.recorded_at).toLocaleString()}</dd>
            <dt>Reason</dt>
            <dd>{review.reason}</dd>
            <dt>Source SHA-256</dt>
            <dd>
              <code>{review.source_sha256}</code>
            </dd>
          </dl>
          <pre aria-label="Submitted source" className="review-code">
            {displayOutput(review.source_b64)}
          </pre>
          {review.diagnostic && (
            <>
              <h4>Dispatch feedback: {label(review.diagnostic.result)}</h4>
              {(
                [
                  [
                    "Retained stdout",
                    review.diagnostic.stdout_b64,
                    review.diagnostic.stdout_truncated,
                  ],
                  [
                    "Retained stderr",
                    review.diagnostic.stderr_b64,
                    review.diagnostic.stderr_truncated,
                  ],
                  [
                    "Compiler output",
                    review.diagnostic.compiler_output_b64,
                    review.diagnostic.compiler_output_truncated,
                  ],
                ] as const
              ).map(([name, encoded, truncated]) => (
                <div key={name}>
                  <h4>
                    {name}
                    {truncated ? " (truncated)" : ""}
                  </h4>
                  <pre aria-label={name} className="review-code">
                    {encoded ? displayOutput(encoded) : "No retained output"}
                  </pre>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      <div className="staff-section-heading">
        <h4>Private access history</h4>
        <IconButton
          title="Refresh private access history"
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
                  <th>Scope</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.actor_name}</td>
                    <td>{new Date(item.recorded_at).toLocaleString()}</td>
                    <td>
                      {item.includes_diagnostics
                        ? "Program and dispatch feedback"
                        : "Program only"}
                    </td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.items.length && (
            <p className="muted">No private reviews recorded.</p>
          )}
          <div className="history-pagination">
            <IconButton
              title="Previous private access page"
              disabled={blocked || reading || pages.length === 1}
              onClick={() => setPages((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {pages.length}</span>
            <IconButton
              title="Next private access page"
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
          title="Private submission review"
          close={() => {
            if (!blocked) {
              setDialog(false);
              setReason("");
              setConfirmation("");
            }
          }}
        >
          <p>
            {detail.parent.team_name} / {detail.parent.title}
          </p>
          <code className="judging-job-id">{detail.parent.id}</code>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void open();
            }}
          >
            <label>
              Review scope
              <select
                aria-label="Private review scope"
                value={attempt}
                disabled={blocked}
                onChange={(e) => setAttempt(e.target.value)}
              >
                <option value="">Submitted program only</option>
                {detail.jobs.flatMap((job, i) =>
                  job.attempts
                    .filter((a) => a.resolved_at !== null)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        Job {i + 1}, dispatch {a.number}:{" "}
                        {label(a.result ?? "pending")}
                      </option>
                    )),
                )}
              </select>
            </label>
            <label>
              Exact submission ID
              <input
                aria-label="Private review confirmation"
                value={confirmation}
                disabled={blocked}
                required
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <label>
              Review reason
              <textarea
                aria-label="Private review reason"
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
                  confirmation !== detail.parent.id ||
                  !reason.trim() ||
                  new TextEncoder().encode(reason).length > 1024
                }
              >
                <Eye size={16} /> Open private review
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
              onClick={() => void recover()}
            >
              <RefreshCw size={16} /> Check original review
            </button>
          )}
        </Modal>
      )}
    </section>
  );
}
