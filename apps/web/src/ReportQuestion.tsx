import { useEffect, useRef, useState } from "react";
import type { Api } from "./api";
import { Command, errorText } from "./api";
import { Modal } from "./ui";
import { label, languages } from "./types";

export interface QuestionReport {
  id: string;
  round_id: string;
  bounty_id: string;
  team_round_id: string;
  submission_id: string | null;
  parent_id: string | null;
  message: string;
  recorded_at: string;
  title: string;
  team_name: string;
  reporter_name: string;
  language: string | null;
  submission_result: string | null;
  source_sha256: string | null;
  status: "OPEN" | "UPHELD" | "DISMISSED";
  decision_note: string | null;
}
export default function ReportQuestion({
  api,
  path,
  title,
  close,
}: {
  api: Api;
  path: string;
  title: string;
  close: () => void;
}) {
  const [report, setReport] = useState<QuestionReport | null>(null),
    [submissions, setSubmissions] = useState<any[]>([]),
    [submission, setSubmission] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [submissionPages, setSubmissionPages] = useState<(string | undefined)[]>([
      undefined,
    ]),
    [nextAfter, setNextAfter] = useState<string | null>(null),
    [, render] = useState(0);
  const command = useRef<Command | null>(null);
  command.current ??= new Command(api, "", () => render((v) => v + 1));
  useEffect(() => {
    setLoading(true);
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const value = await api.request<{ report: QuestionReport | null }>(
          `${path}/report`,
        );
        if (!gone) {
          setReport(value.report);
        }
      } catch (e) {
        if (!gone) setError(errorText(e));
      } finally {
        if (!gone) timer = setTimeout(() => void load(), 5000);
      }
    };
    void Promise.all([
      load(),
      api.request<{ submissions: any[]; next_after: string | null }>(
        `${path}/submissions${submissionPages.at(-1) ? `?after=${submissionPages.at(-1)}` : ""}`,
      ),
    ])
      .then(([, value]) => {
        if (!gone) {
          setSubmissions(value.submissions);
          setNextAfter(value.next_after);
          setSubmission(value.submissions.at(-1)?.submission_id ?? "");
        }
      })
      .catch((e) => {
        if (!gone) setError(errorText(e));
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [path, submissionPages.at(-1)]);
  async function send(recover = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = recover
        ? await command.current!.recover()
        : await command.current!.send(
            `${path}/report`,
            { submission_id: submission || null, message },
            `${path}/report/outcomes`,
          );
      if (value) setReport(value);
      else
        setError(
          "Original report is not confirmed yet. Check again; do not send a second report.",
        );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Report question"
      close={() => {
        if (!busy && !command.current!.unresolved) close();
      }}
    >
      <p>
        <strong>{title}</strong>
      </p>
      {loading ? (
        <p role="status">Loading your team's report and submissions…</p>
      ) : report ? (
        <>
          <p role="status">
            Ticket {report.id} · {label(report.status)}
          </p>
          <p>{report.message}</p>
          <p>
            {report.submission_id
              ? `Attached submission: ${report.submission_id}`
              : "No submitted answer attached."}
          </p>
          {report.decision_note && <p>Staff note: {report.decision_note}</p>}
          <p className="muted">
            A report does not change your verdict or award points automatically.
            Final score corrections are reviewed separately.
          </p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            Submitted answer to attach
            <select
              aria-label="Reported submission"
              value={submission}
              disabled={busy || command.current!.unresolved}
              onChange={(e) => setSubmission(e.target.value)}
            >
              <option value="">
                Question issue only — no submitted answer
              </option>
              {[...submissions].reverse().map((s) => (
                <option key={s.submission_id} value={s.submission_id}>
                  {new Date(s.received_at).toLocaleTimeString()} ·{" "}
                  {languages[s.language as keyof typeof languages]} ·{" "}
                  {label(s.result ?? s.status)}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            We attach the exact program from that submission. Editing your code
            afterwards will not change it. One report per team and question.
          </p>
          {(submissionPages.length > 1 || nextAfter) && (
            <div className="pagination">
              <button
                type="button"
                disabled={
                  busy ||
                  loading ||
                  command.current!.unresolved ||
                  submissionPages.length === 1
                }
                onClick={() => setSubmissionPages((v) => v.slice(0, -1))}
              >
                Previous submissions
              </button>
              <button
                type="button"
                disabled={
                  busy || loading || command.current!.unresolved || !nextAfter
                }
                onClick={() => setSubmissionPages((v) => [...v, nextAfter!])}
              >
                Newer submissions
              </button>
            </div>
          )}
          <label>
            What went wrong?
            <textarea
              aria-label="Question report details"
              value={message}
              maxLength={1024}
              required
              disabled={busy || command.current!.unresolved}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button
            className="primary"
            type="submit"
            disabled={
              loading ||
              busy ||
              command.current!.unresolved ||
              !message.trim() ||
              new TextEncoder().encode(message).length > 1024
            }
          >
            {busy ? "Sending report…" : "Raise ticket"}
          </button>
        </form>
      )}
      {command.current!.unresolved && !busy && (
        <button onClick={() => void send(true)}>Check original report</button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
