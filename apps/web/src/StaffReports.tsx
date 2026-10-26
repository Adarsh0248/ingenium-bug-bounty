import { useEffect, useRef, useState } from "react";
import type { Api } from "./api";
import { Command, errorText } from "./api";
import type { QuestionReport } from "./ReportQuestion";
import type { Page } from "./staff-types";
import type { JudgeDetail } from "./judging-types";
import { Modal } from "./ui";
import { label } from "./types";
import StaffSubmissionReview from "./StaffSubmissionReview";

export default function StaffReports({
  api,
  round,
  available,
  blockNavigation,
}: {
  api: Api;
  round: string;
  available: boolean;
  blockNavigation: (blocked: boolean) => void;
}) {
  const [page, setPage] = useState<Page<QuestionReport>>({
      items: [],
      next_after: null,
    }),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<JudgeDetail | null>(null),
    [decision, setDecision] = useState<"UPHELD" | "DISMISSED" | null>(null),
    [reason, setReason] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [privateOpen, setPrivateOpen] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [, render] = useState(0);
  const command = useRef<Command | null>(null);
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const base = `/api/v1/staff/competition/rounds/${round}`,
    cursor = cursors.at(-1),
    report = page.items.find((r) => r.id === selected),
    blocked = busy || !!decision || privateOpen || command.current.unresolved;
  useEffect(() => {
    blockNavigation(blocked);
    return () => blockNavigation(false);
  }, [blocked]);
  useEffect(() => {
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const value = await api.request<Page<QuestionReport>>(
          `${base}/reports${cursor ? `?after=${cursor}` : ""}`,
          undefined,
          "STAFF",
        );
        if (!gone) setPage(value);
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
  }, [base, cursor, refresh]);
  async function review() {
    if (!report?.parent_id) return;
    setBusy(true);
    setError("");
    try {
      setDetail(
        await api.request<JudgeDetail>(
          `${base}/judging/${report.parent_id}`,
          undefined,
          "STAFF",
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function resolve(recover = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = recover
        ? await command.current!.recover()
        : await command.current!.send(
            `${base}/reports/${report!.id}/decision`,
            { verdict: decision, reason, own_code: code },
            `${base}/report-decisions/outcomes`,
          );
      if (value) {
        setDecision(null);
        setRefresh((v) => v + 1);
      } else setError("Original decision is not confirmed. Check again.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setCode("");
      setBusy(false);
    }
  }
  return (
    <section className="staff-section" aria-label="Question report tickets">
      <h2>Question reports</h2>
      <p>
        Review the attached submitted program, then uphold or dismiss the
        ticket. Compensation is entered separately after the round closes, under
        Monitor → Final standings → Adjust points.
      </p>
      {error && !decision && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="staff-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Team</th>
              <th>Status</th>
              <th>Reported</th>
              <th>Ticket</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.team_name}</td>
                <td>{label(r.status)}</td>
                <td>{new Date(r.recorded_at).toLocaleTimeString()}</td>
                <td>
                  <button
                    disabled={blocked || !available}
                    onClick={() => {
                      setSelected(r.id);
                      setDetail(null);
                      setError("");
                    }}
                  >
                    Open ticket
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!page.items.length && <p>No question reports yet.</p>}
      <div className="pagination">
        <button
          disabled={cursors.length === 1 || blocked}
          onClick={() => {
            setCursors((v) => v.slice(0, -1));
            setSelected(null);
            setDetail(null);
          }}
        >
          Previous tickets
        </button>
        <button
          disabled={!page.next_after || blocked}
          onClick={() => {
            setCursors((v) => [...v, page.next_after!]);
            setSelected(null);
            setDetail(null);
          }}
        >
          Older tickets
        </button>
      </div>
      {report && (
        <article>
          <h3>
            {report.title} · {report.team_name}
          </h3>
          <p>
            Ticket <code>{report.id}</code> · {label(report.status)}
          </p>
          <p>Reported by {report.reporter_name}</p>
          <p className="report-message">{report.message}</p>
          <p>
            {report.submission_id
              ? `Attached submission ${report.submission_id} · ${report.language} · ${label(report.submission_result ?? "pending")}`
              : "Question issue only; no submitted answer was attached."}
          </p>
          {report.source_sha256 && (
            <p>
              Submitted source SHA-256: <code>{report.source_sha256}</code>
            </p>
          )}
          {report.parent_id && !detail && (
            <button
              disabled={blocked || !available}
              onClick={() => void review()}
            >
              Review submitted answer
            </button>
          )}
          {detail && (
            <StaffSubmissionReview
              key={detail.parent.id}
              api={api}
              base={base}
              detail={detail}
              available={available && !busy}
              blockNavigation={setPrivateOpen}
            />
          )}
          {report.decision_note && <p>Decision note: {report.decision_note}</p>}
          {report.status === "OPEN" && (
            <div>
              <button
                disabled={blocked || !available}
                onClick={() => {
                  setDecision("UPHELD");
                  setReason("");
                  setCode("");
                }}
              >
                Uphold report
              </button>
              <button
                disabled={blocked || !available}
                onClick={() => {
                  setDecision("DISMISSED");
                  setReason("");
                  setCode("");
                }}
              >
                Dismiss report
              </button>
            </div>
          )}
        </article>
      )}
      {command.current.unresolved && !busy && !decision && (
        <button onClick={() => void resolve(true)}>
          Check original decision
        </button>
      )}
      {decision && (
        <Modal
          title="Confirm report decision"
          close={() => {
            if (!busy && !command.current!.unresolved) setDecision(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resolve();
            }}
          >
            <p>
              {decision === "UPHELD" ? "Uphold" : "Dismiss"} this report. This
              decision does not change points automatically.
            </p>
            <label>
              Decision note
              <textarea
                aria-label="Report decision note"
                required
                maxLength={1024}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy || command.current.unresolved}
              />
            </label>
            <label>
              Your staff code
              <input
                aria-label="Your staff code"
                type="password"
                autoComplete="off"
                required
                maxLength={96}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy || command.current.unresolved}
              />
            </label>
            <button
              className="primary"
              disabled={
                !available ||
                busy ||
                command.current.unresolved ||
                !reason.trim() ||
                !code.trim()
              }
            >
              Confirm decision
            </button>
          </form>
          {command.current.unresolved && !busy && (
            <button onClick={() => void resolve(true)}>
              Check original decision
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
