import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import type { Page } from "./staff-types";
import type {
  ContentDetail,
  ValidationReport,
  ValidationSnapshot,
  ValidationRunSummary,
} from "./content-types";
import { languages, label } from "./types";
import { contentTextError } from "./content-fields";
import { publicationEligible, reviewAttestation } from "./content-review";
import { IconButton, Modal } from "./ui";
import ValidationDiagnostics from "./ValidationDiagnostics";

type Intent = {
  action: "RUN" | "PUBLISH";
  snapshot: ValidationSnapshot;
  runId: string | null;
};
type RunPage = Page<ValidationRunSummary> & {
  publication: { run_id: string; published_at: string } | null;
};
const base = "/api/v1/staff/content";
export default function ContentValidation({
  api,
  version,
  preparedSnapshot,
  available,
  blockNavigation,
  published,
}: {
  api: Api;
  version: ContentDetail;
  preparedSnapshot?: string | null;
  available: boolean;
  blockNavigation: (blocked: boolean) => void;
  published: () => Promise<unknown>;
}) {
  const [snapshots, setSnapshots] = useState<Page<ValidationSnapshot> | null>(
      null,
    ),
    [snapshot, setSnapshot] = useState<ValidationSnapshot | null>(null),
    [snapshotPages, setSnapshotPages] = useState<(string | undefined)[]>([
      undefined,
    ]),
    [runs, setRuns] = useState<RunPage | null>(null),
    [runPages, setRunPages] = useState<(string | undefined)[]>([undefined]),
    [runId, setRunId] = useState<string | null>(null),
    [report, setReport] = useState<ValidationReport | null>(null),
    [intent, setIntent] = useState<Intent | null>(null),
    [notes, setNotes] = useState(""),
    [code, setCode] = useState(""),
    [reviews, setReviews] = useState<boolean[]>([false, false, false, false]),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false),
    [diagnosticBlocked, setDiagnosticBlocked] = useState(false),
    [reportReady, setReportReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [, render] = useState(0);
  const mounted = useRef(true),
    generation = useRef(0),
    command = useRef<Command | null>(null),
    sent = useRef<Intent | null>(null),
    polling = useRef(false),
    needsPoll = useRef(true),
    refresh = useRef<() => Promise<void>>(async () => {});
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const unresolved = command.current.unresolved,
    locked = !available || busy || unresolved || denied || diagnosticBlocked,
    blocked = busy || unresolved || !!intent || diagnosticBlocked,
    canPublish =
      report?.run_id === runId &&
      publicationEligible(version, snapshot, report),
    current =
      snapshot?.content_revision === version.content_revision &&
      version.publication_status === "DRAFT";

  function fail(e: unknown) {
    if (!mounted.current) return;
    if (
      e instanceof ApiError &&
      [401, 403].includes(e.status) &&
      e.code !== "STAFF_CONFIRMATION_REQUIRED"
    ) {
      generation.current++;
      setSnapshots(null);
      setSnapshot(null);
      setRuns(null);
      setReport(null);
      setIntent(null);
      setCode("");
      setNotes("");
      setDenied(true);
    }
    setError(errorText(e));
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    blockNavigation(blocked);
  }, [blocked]);
  useEffect(() => () => blockNavigation(false), []);
  useEffect(() => {
    let gone = false;
    setLoading(true);
    const cursor = snapshotPages.at(-1);
    void api
      .request<Page<ValidationSnapshot>>(
        `${base}/versions/${version.version_id}/validation-snapshots${cursor ? `?after=${cursor}` : ""}`,
        undefined,
        "STAFF",
      )
      .then(async (value) => {
        if (gone) return;
        setSnapshots(value);
        if (!snapshot) {
          let selected =
            value.items.find((s) => s.snapshot_id === preparedSnapshot) ??
            value.items.find(
              (s) => s.content_revision === version.content_revision,
            ) ??
            value.items.at(-1) ??
            null;
          if (
            preparedSnapshot &&
            !value.items.some((s) => s.snapshot_id === preparedSnapshot)
          ) {
            const found = await api.request<
              ValidationSnapshot & { version_id: string }
            >(
              `${base}/validation-snapshots/${preparedSnapshot}/summary`,
              undefined,
              "STAFF",
            );
            if (found.version_id !== version.version_id)
              throw new ApiError("INVALID_CONTEXT");
            selected = found;
          }
          if (!gone) setSnapshot(selected);
        }
      })
      .catch((e) => {
        if (!gone) fail(e);
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [snapshotPages, preparedSnapshot]);
  useEffect(() => {
    let gone = false;
    setRuns(null);
    if (!snapshot || denied) return;
    const cursor = runPages.at(-1);
    void api
      .request<RunPage>(
        `${base}/validation-snapshots/${snapshot.snapshot_id}/runs${cursor ? `?after=${cursor}` : ""}`,
        undefined,
        "STAFF",
      )
      .then((value) => {
        if (gone) return;
        setRuns(value);
        if (!runId)
          setRunId(
            value.publication?.run_id ??
              [...value.items].sort((a, b) =>
                b.created_at.localeCompare(a.created_at),
              )[0]?.run_id ??
              null,
          );
      })
      .catch((e) => {
        if (!gone) fail(e);
      });
    return () => {
      gone = true;
    };
  }, [snapshot?.snapshot_id, runPages, denied]);
  refresh.current = async () => {
    if (!snapshot || !runId || polling.current || denied) return;
    const id = generation.current;
    polling.current = true;
    try {
      const value = await api.request<ValidationReport>(
        `${base}/validation-runs/${runId}`,
        undefined,
        "STAFF",
      );
      if (!mounted.current || generation.current !== id) return;
      if (
        value.run_id !== runId ||
        value.snapshot_id !== snapshot.snapshot_id ||
        value.configuration_fingerprint !== snapshot.fingerprint
      )
        throw new ApiError("INVALID_CONTEXT");
      setReport(value);
      setReportReady(true);
      needsPoll.current =
        ["QUEUED", "RUNNING"].includes(value.status) || value.physical_pending;
      setRuns((old) =>
        old
          ? {
              ...old,
              items: old.items.map((r) =>
                r.run_id === value.run_id
                  ? {
                      ...r,
                      status: value.status,
                      physical_pending: value.physical_pending,
                      finished_at: value.finished_at,
                    }
                  : r,
              ),
            }
          : old,
      );
    } catch (e) {
      if (mounted.current && generation.current === id) {
        needsPoll.current = true;
        setReportReady(false);
        fail(e);
      }
    } finally {
      polling.current = false;
    }
  };
  useEffect(() => {
    generation.current++;
    needsPoll.current = true;
    setReport(null);
    setReportReady(false);
    void refresh.current();
    const timer = setInterval(() => {
      if (!document.hidden && needsPoll.current) void refresh.current();
    }, 5000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [snapshot?.snapshot_id, runId]);
  function choose(s: ValidationSnapshot) {
    if (locked || intent) return;
    generation.current++;
    setSnapshot(s);
    setRunId(null);
    setReport(null);
    setRunPages([undefined]);
    setError("");
    setNotice("");
  }
  function begin(action: Intent["action"]) {
    if (locked || !snapshot || (action === "RUN" ? !current : !canPublish))
      return;
    setIntent({ action, snapshot, runId });
    setNotes("");
    setCode("");
    setReviews([false, false, false, false]);
    setError("");
    setNotice("");
  }
  async function acknowledge(value: any) {
    const action = sent.current?.action;
    setIntent(null);
    setCode("");
    if (value.outcome === "REJECTED")
      setError(`Action declined: ${label(value.reason ?? "unavailable")}.`);
    else if (action === "RUN") {
      setNotice("Validation admitted.");
      setRunId(value.run_id);
      setRunPages([undefined]);
    } else {
      setNotice("Published for arena selection.");
      await published();
      setRunPages((v) => [...v]);
    }
    sent.current = null;
  }
  async function send() {
    if (!intent || locked) return;
    const selected = intent,
      text = selected.action === "PUBLISH" ? reviewAttestation(notes) : notes;
    if (
      !notes.trim() ||
      contentTextError(text, 1024, true) ||
      (selected.action === "PUBLISH" &&
        (!reviews.every(Boolean) || !code.trim()))
    )
      return;
    sent.current = selected;
    setBusy(true);
    setError("");
    const ownCode = code;
    setCode("");
    try {
      await acknowledge(
        await command.current!.send(
          selected.action === "RUN"
            ? `${base}/validation-snapshots/${selected.snapshot.snapshot_id}/runs`
            : `/api/v1/staff/competition/publications/${selected.snapshot.snapshot_id}`,
          {
            expected_revision: selected.snapshot.content_revision,
            ...(selected.action === "RUN"
              ? { reason: text }
              : { run_id: selected.runId, review: text, own_code: ownCode }),
          },
          `/api/v1/staff/outcomes/${selected.action === "RUN" ? "validation-run" : "publication"}/${selected.snapshot.snapshot_id}`,
        ),
      );
    } catch (e) {
      fail(e);
      if (command.current!.unresolved) setIntent(null);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function recover() {
    if (!available || busy) return;
    setBusy(true);
    setError("");
    try {
      const receipt = await command.current!.recover();
      if (receipt) await acknowledge(receipt);
      else
        setError(
          "The original command is not confirmed. No new command was sent.",
        );
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const date = (value: string) => new Date(value).toLocaleString();
  return (
    <section
      className="content-validation"
      aria-label="Validation runs and publication"
    >
      <h3>Validation history</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {unresolved && (
        <div className="staff-message warning">
          <span>Validation command outcome unknown</span>
          <button disabled={busy || !available} onClick={() => void recover()}>
            <RefreshCw size={16} />
            Recover validation receipt
          </button>
        </div>
      )}
      <div className="staff-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Snapshot revision</th>
              <th>Prepared</th>
              <th>Fingerprint</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {snapshots?.items.map((s) => (
              <tr
                key={s.snapshot_id}
                data-snapshot-id={s.snapshot_id}
                aria-selected={snapshot?.snapshot_id === s.snapshot_id}
              >
                <td>
                  {s.content_revision}
                  {s.content_revision !== version.content_revision
                    ? " / Outdated"
                    : ""}
                </td>
                <td>{date(s.created_at)}</td>
                <td className="staff-reference">
                  {s.fingerprint.slice(0, 12)}
                </td>
                <td>
                  <button
                    disabled={locked || !!intent}
                    onClick={() => choose(s)}
                  >
                    Open snapshot {s.content_revision}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!snapshots?.items.length && !loading && (
        <p className="muted">No prepared snapshots.</p>
      )}
      <div className="staff-pagination">
        <IconButton
          title="Previous snapshot page"
          disabled={locked || !!intent || snapshotPages.length === 1}
          onClick={() => setSnapshotPages((v) => v.slice(0, -1))}
        >
          <ArrowLeft size={16} />
        </IconButton>
        <span>Snapshot page {snapshotPages.length}</span>
        <IconButton
          title="Next snapshot page"
          disabled={locked || !!intent || !snapshots?.next_after}
          onClick={() =>
            setSnapshotPages((v) => [...v, snapshots!.next_after!])
          }
        >
          <ArrowRight size={16} />
        </IconButton>
        <IconButton
          title="Refresh validation history"
          disabled={locked || !!intent || loading}
          onClick={() => {
            setSnapshotPages((v) => [...v]);
            setRunPages((v) => [...v]);
            void refresh.current();
          }}
        >
          <RefreshCw size={16} />
        </IconButton>
      </div>
      {snapshot && (
        <>
          {runs?.publication && (
            <p className="staff-reference">
              Published {date(runs.publication.published_at)} / Run{" "}
              {runs.publication.run_id}
            </p>
          )}
          <p className="staff-reference">
            Snapshot {snapshot.snapshot_id} / Revision{" "}
            {snapshot.content_revision} / {snapshot.fingerprint}
          </p>
          {!current && version.publication_status === "DRAFT" && (
            <p className="warning">
              This snapshot belongs to an older draft revision.
            </p>
          )}
          <div className="staff-row-actions">
            <button
              disabled={locked || !!intent || !current}
              onClick={() => begin("RUN")}
            >
              <Play size={16} />
              Request validation run
            </button>
            <button
              className="primary"
              disabled={locked || !!intent || !canPublish}
              onClick={() => begin("PUBLISH")}
            >
              <ShieldCheck size={16} />
              Review publication
            </button>
          </div>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Cleanup</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs?.items.map((r) => (
                  <tr key={r.run_id} data-run-id={r.run_id}>
                    <td className="staff-reference">{r.run_id}</td>
                    <td>{label(r.status)}</td>
                    <td>{date(r.created_at)}</td>
                    <td>{r.physical_pending ? "Pending" : "Drained"}</td>
                    <td>
                      <button
                        disabled={locked || !!intent}
                        onClick={() => {
                          generation.current++;
                          setRunId(r.run_id);
                          setReport(null);
                        }}
                      >
                        Open run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {runs?.items.length === 0 && (
            <p className="muted">No validation runs.</p>
          )}
          <div className="staff-pagination">
            <IconButton
              title="Previous run page"
              disabled={locked || !!intent || runPages.length === 1}
              onClick={() => setRunPages((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Run page {runPages.length}</span>
            <IconButton
              title="Next run page"
              disabled={locked || !!intent || !runs?.next_after}
              onClick={() => setRunPages((v) => [...v, runs!.next_after!])}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
        </>
      )}
      {runId && (
        <div className="validation-report">
          <div className="staff-section-heading">
            <h3>Validation report</h3>
            <IconButton
              title="Refresh validation report"
              disabled={locked}
              onClick={() => void refresh.current()}
            >
              <RefreshCw size={16} />
            </IconButton>
          </div>
          {report ? (
            <>
              <dl>
                <dt>Run</dt>
                <dd className="staff-reference">{report.run_id}</dd>
                <dt>Result</dt>
                <dd data-validation-status={report.status}>
                  {label(report.status)}
                </dd>
                <dt>Checks complete</dt>
                <dd>
                  {report.checks.filter((c) => c.result !== null).length} /{" "}
                  {report.checks.length}
                </dd>
                <dt>Deadline</dt>
                <dd>{date(report.deadline_at)}</dd>
                <dt>Cleanup</dt>
                <dd>
                  {report.physical_pending
                    ? "Pending - publication locked"
                    : "Drained"}
                </dd>
              </dl>
              <div className="staff-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Language</th>
                      <th>Source / case</th>
                      <th>Expected</th>
                      <th>Observed</th>
                      <th>Attempts</th>
                      <th>Cleanup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.checks.map((c) => (
                      <tr key={c.check_id}>
                        <td>{languages[c.language]}</td>
                        <td>
                          {label(c.source_role)} /{" "}
                          {c.case_id
                            ? `Case ${version.cases.find((x) => x.case_id === c.case_id)?.position ?? c.case_id}`
                            : "Compilation"}
                        </td>
                        <td>{label(c.expected_result)}</td>
                        <td>{c.result ? label(c.result) : "Pending"}</td>
                        <td>{c.attempts}</td>
                        <td>{c.physical_pending ? "Pending" : "Drained"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ValidationDiagnostics
                key={report.run_id}
                api={api}
                report={report}
                available={
                  available &&
                  !denied &&
                  reportReady &&
                  !intent &&
                  !busy &&
                  !unresolved
                }
                blockNavigation={setDiagnosticBlocked}
              />
            </>
          ) : (
            <p role="status">Loading validation report...</p>
          )}
        </div>
      )}
      {intent && (
        <Modal
          title={
            intent.action === "RUN"
              ? "Request frozen validation run"
              : "Publish reviewed bug"
          }
          close={() => {
            if (!busy && !unresolved) {
              setIntent(null);
              setCode("");
            }
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <p>
              {version.title} / Revision {intent.snapshot.content_revision}
            </p>
            <p className="staff-reference">
              {intent.snapshot.snapshot_id}
              {intent.runId && intent.action === "PUBLISH"
                ? ` / Run ${intent.runId}`
                : ""}
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <fieldset disabled={busy || unresolved}>
              {intent.action === "PUBLISH" && (
                <>
                  {[
                    "Statement reviewed",
                    "Sample and hidden test coverage reviewed",
                    "Difficulty and fairness across all five languages reviewed",
                    "All three hints reviewed",
                  ].map((text, i) => (
                    <label className="staff-enabled" key={text}>
                      <input
                        type="checkbox"
                        required
                        checked={reviews[i]}
                        onChange={(e) =>
                          setReviews((v) =>
                            v.map((value, j) =>
                              j === i ? e.target.checked : value,
                            ),
                          )
                        }
                      />
                      {text}
                    </label>
                  ))}
                  <label>
                    Your staff code
                    <input
                      type="password"
                      required
                      autoComplete="off"
                      maxLength={96}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                {intent.action === "RUN" ? "Validation reason" : "Review notes"}
                <textarea
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </fieldset>
            <div className="dialog-actions">
              <button
                type="button"
                disabled={busy || unresolved}
                onClick={() => {
                  setIntent(null);
                  setCode("");
                }}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  locked ||
                  !notes.trim() ||
                  contentTextError(
                    intent.action === "RUN" ? notes : reviewAttestation(notes),
                    1024,
                    true,
                  ) ||
                  (intent.action === "PUBLISH" &&
                    (!reviews.every(Boolean) || !code.trim()))
                }
              >
                <Check size={16} />
                {intent.action === "RUN"
                  ? "Confirm validation request"
                  : "Confirm publication"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
