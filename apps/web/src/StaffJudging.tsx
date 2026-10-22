import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import type { Api } from "./api";
import { ApiError, Command, errorText } from "./api";
import type { ControlRound } from "./staff-types";
import type { JudgeDetail, JudgeQueue, RecoveryAudit } from "./judging-types";
import { label, languages, timeText } from "./types";
import { IconButton, Modal } from "./ui";
import StaffSubmissionReview from "./StaffSubmissionReview";

const recoveryMessages: Record<string, string> = {
  ELIGIBLE:
    "Three infrastructure failures safely drained. One extra dispatch may be authorised.",
  ROLE_REQUIRED: "Owner or Super Admin confirmation required.",
  SAMPLE_RUN: "Sample Runs use automatic recovery and their original deadline.",
  ROUND_CLOSED: "This round does not permit additional dispatches.",
  SETTLED: "This job is settled or cancelled. No rejudging permitted.",
  PHYSICAL_HOLD:
    "Physical execution remains unresolved. No new dispatch is permitted.",
  EXTRA_DISPATCH_USED:
    "The one additional-dispatch authorisation has already been used.",
  AUTOMATIC_RECOVERY: "The automatic recovery budget is not exhausted.",
  NOT_INFRASTRUCTURE:
    "A trustworthy code result cannot be rejudged as an infrastructure failure.",
};
const resultText = (value: string | null) =>
  value === "INFRA_ERROR"
    ? "Infrastructure failure"
    : value
      ? label(value)
      : "Pending";
export default function StaffJudging({
  api,
  round,
  available,
  version,
  blockNavigation,
}: {
  api: Api;
  round: ControlRound;
  available: boolean;
  version: string;
  blockNavigation: (value: boolean) => void;
}) {
  const [queue, setQueue] = useState<JudgeQueue | null>(null),
    [detail, setDetail] = useState<JudgeDetail | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [jobId, setJobId] = useState<string | null>(null),
    [view, setView] = useState("ACTIVE"),
    [team, setTeam] = useState(""),
    [lane, setLane] = useState(""),
    [pages, setPages] = useState<(string | null)[]>([null]),
    [refresh, setRefresh] = useState(0),
    [fresh, setFresh] = useState(false),
    [reading, setReading] = useState(false),
    [busy, setBusy] = useState(false),
    [readError, setReadError] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [intent, setIntent] = useState<string | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [reason, setReason] = useState(""),
    [code, setCode] = useState(""),
    [reviewBlocked, setReviewBlocked] = useState(false),
    [, render] = useState(0);
  const mounted = useRef(true),
    command = useRef<Command | null>(null),
    base = `/api/v1/staff/competition/rounds/${round.round_id}`;
  command.current ??= new Command(
    api,
    round.round_id,
    () => render((v) => v + 1),
    "STAFF",
  );
  const unresolved = command.current.unresolved,
    blocked = !!intent || busy || unresolved || reviewBlocked,
    locked = !available || !fresh || busy || unresolved || reviewBlocked,
    after = pages.at(-1),
    job = detail?.jobs.find((j) => j.id === jobId),
    manager = !!detail && ["OWNER", "SUPER_ADMIN"].includes(detail.role);
  useEffect(() => {
    blockNavigation(blocked);
  }, [blocked]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      blockNavigation(false);
    };
  }, []);
  useEffect(() => {
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    setFresh(false);
    async function load() {
      setReading(true);
      const query = new URLSearchParams({ view });
      if (team) query.set("team_id", team);
      if (lane) query.set("lane", lane);
      if (after) query.set("after", after);
      try {
        const [q, d] = await Promise.all([
          api.request<JudgeQueue>(
            `${base}/judging?${query}`,
            undefined,
            "STAFF",
          ),
          selected
            ? api.request<JudgeDetail>(
                `${base}/judging/${selected}`,
                undefined,
                "STAFF",
              )
            : Promise.resolve(null),
        ]);
        if (!gone) {
          setQueue(q);
          setDetail(d);
          setFresh(true);
          setReadError("");
        }
      } catch (e) {
        if (!gone) {
          setFresh(false);
          setReadError(errorText(e));
          if (e instanceof ApiError && [401, 403].includes(e.status)) {
            setQueue(null);
            setDetail(null);
            setCode("");
          }
        }
      } finally {
        if (!gone) {
          setReading(false);
          timer = setTimeout(() => void load(), 5000);
        }
      }
    }
    void load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [api, base, view, team, lane, after, selected, refresh, version]);
  function reset() {
    setPages([null]);
    setSelected(null);
    setDetail(null);
    setJobId(null);
    setFresh(false);
  }
  function inspect(id: string) {
    setSelected(id);
    setDetail(null);
    setJobId(null);
    setFresh(false);
  }
  function choose() {
    if (locked || !job?.retry_allowed || !manager) return;
    setIntent(job.id);
    setConfirmation("");
    setReason("");
    setCode("");
    setError("");
    setNotice("");
  }
  function acknowledge(receipt: {
    result: { status: string; reason?: string };
  }) {
    if (receipt.result.status === "APPLIED") {
      setNotice(
        "One extra dispatch authorised. The original worker still performs all safety checks.",
      );
      setError("");
    } else {
      setError(
        `Recovery declined: ${label(receipt.result.reason ?? "unavailable")}.`,
      );
      setNotice("");
    }
    setIntent(null);
    setReason("");
    setConfirmation("");
    setRefresh((v) => v + 1);
  }
  async function send() {
    if (
      locked ||
      !intent ||
      !manager ||
      !detail?.jobs.find((j) => j.id === intent)?.retry_allowed ||
      confirmation !== intent ||
      !reason.trim() ||
      new TextEncoder().encode(reason).length > 1024 ||
      !code.trim()
    )
      return;
    const own = code;
    setCode("");
    setBusy(true);
    setError("");
    try {
      const receipt = await command.current!.send(
        `${base}/jobs/${intent}/retry`,
        { reason, own_code: own },
      );
      if (mounted.current) acknowledge(receipt);
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
      const receipt = await command.current!.recover();
      if (mounted.current) {
        if (receipt) acknowledge(receipt);
        else
          setNotice(
            "Original outcome not observed yet. No new dispatch was requested.",
          );
      }
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="staff-section staff-judging">
      <div className="staff-section-heading">
        <h2>Judging & recovery</h2>
        <IconButton
          title="Refresh judging"
          disabled={reading || busy}
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={17} />
        </IconButton>
      </div>
      {readError && (
        <p className="error" role="alert">
          {readError}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {queue && (
        <div className="judging-summary">
          {(
            [
              ["Unfinished", queue.summary.unfinished],
              ["Recovery / attention", queue.summary.attention],
              ["Physical holds", queue.summary.physically_held],
              ["Completed", queue.summary.completed],
            ] as const
          ).map(([name, count]) => (
            <div key={name}>
              <span>{name}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}
      {!selected ? (
        <>
          <div className="judging-filters">
            <label>
              View
              <select
                aria-label="Judging view"
                value={view}
                disabled={blocked}
                onChange={(e) => {
                  setView(e.target.value);
                  reset();
                }}
              >
                <option value="ACTIVE">Active & held</option>
                <option value="ALL">All submissions & Runs</option>
                <option value="ATTENTION">Recovery / attention</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label>
              Team
              <select
                aria-label="Judging team"
                value={team}
                disabled={blocked}
                onChange={(e) => {
                  setTeam(e.target.value);
                  reset();
                }}
              >
                <option value="">All teams</option>
                {round.teams.map((t) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lane
              <select
                aria-label="Judging lane"
                value={lane}
                disabled={blocked}
                onChange={(e) => {
                  setLane(e.target.value);
                  reset();
                }}
              >
                <option value="">Both lanes</option>
                <option value="OFFICIAL">Official submissions</option>
                <option value="SAMPLE">Sample Runs</option>
              </select>
            </label>
          </div>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team / bounty</th>
                  <th>Lane / language</th>
                  <th>Status / result</th>
                  <th>Age</th>
                  <th>Dispatches / holds</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {queue?.parents.map((p) => (
                  <tr key={p.id} data-parent-id={p.id}>
                    <td>
                      <strong>{p.team_name}</strong>
                      <small>{p.title}</small>
                    </td>
                    <td>
                      {label(p.lane)}
                      <small>{languages[p.language]}</small>
                    </td>
                    <td>
                      {label(p.status)}
                      <small>{resultText(p.result)}</small>
                    </td>
                    <td>
                      {timeText(
                        Math.max(
                          0,
                          Date.parse(p.completed_at ?? queue.server_time) -
                            Date.parse(p.created_at),
                        ),
                      )}
                    </td>
                    <td>
                      {p.jobs.reduce((n, j) => n + j.dispatches, 0)} /{" "}
                      {p.jobs.filter((j) => j.physically_held).length}
                    </td>
                    <td>
                      <button
                        disabled={blocked || !fresh}
                        onClick={() => inspect(p.id)}
                      >
                        <Search size={15} /> Inspect jobs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {queue?.parents.length === 0 && (
            <p className="muted">No judging records in this view.</p>
          )}
          <div className="history-pagination">
            <IconButton
              title="Previous judging page"
              disabled={blocked || reading || pages.length === 1}
              onClick={() => setPages((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={17} />
            </IconButton>
            <span>Page {pages.length}</span>
            <IconButton
              title="Next judging page"
              disabled={blocked || reading || !fresh || !queue?.next_after}
              onClick={() => setPages((v) => [...v, queue!.next_after])}
            >
              <ArrowRight size={17} />
            </IconButton>
          </div>
        </>
      ) : (
        <>
          <button
            disabled={blocked}
            onClick={() => {
              setSelected(null);
              setDetail(null);
              setJobId(null);
            }}
          >
            <ArrowLeft size={15} /> Back to judging queue
          </button>
          {!detail ? (
            <p role="status">Loading job details</p>
          ) : (
            <>
              <h3>
                {detail.parent.team_name} / {detail.parent.title}
              </h3>
              <p>
                {label(detail.parent.lane)} /{" "}
                {languages[detail.parent.language]} /{" "}
                {label(detail.parent.status)} /{" "}
                {resultText(detail.parent.result)}
              </p>
              <dl className="judging-reference">
                <dt>Original attempt</dt>
                <dd>
                  <code>{detail.parent.id}</code>
                </dd>
                <dt>Received</dt>
                <dd>{new Date(detail.parent.created_at).toLocaleString()}</dd>
                {detail.parent.receipt_order && (
                  <>
                    <dt>Receipt order</dt>
                    <dd>{detail.parent.receipt_order}</dd>
                  </>
                )}
              </dl>
              {manager && <StaffSubmissionReview key={detail.parent.id} api={api} base={base} detail={detail}
                available={available && fresh && !busy && !unresolved} blockNavigation={setReviewBlocked} />}
              <div className="staff-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Status / result</th>
                      <th>Dispatches</th>
                      <th>Recovery</th>
                      <th>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.jobs.map((j, i) => (
                      <tr key={j.id} data-job-id={j.id}>
                        <td>{i + 1}</td>
                        <td>
                          {label(j.status)}
                          <small>{resultText(j.result)}</small>
                        </td>
                        <td>
                          {j.attempts.length} /{" "}
                          {detail.parent.lane === "SAMPLE"
                            ? 2
                            : j.extra_authorised
                              ? 4
                              : 3}
                        </td>
                        <td>{recoveryMessages[j.retry_reason]}</td>
                        <td>
                          <button
                            aria-pressed={jobId === j.id}
                            disabled={blocked || !fresh}
                            onClick={() => setJobId(j.id)}
                          >
                            Inspect job {i + 1}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {job && (
                <section
                  className="judging-job"
                  aria-label="Selected judging job"
                >
                  <h3>Dispatch timeline</h3>
                  <code className="judging-job-id">{job.id}</code>
                  <p>{recoveryMessages[job.retry_reason]}</p>
                  <div className="staff-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Dispatch</th>
                          <th>Prepared / sent</th>
                          <th>Result</th>
                          <th>Resolved</th>
                          <th>Physical release</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.attempts.map((a) => (
                          <tr key={a.id}>
                            <td>
                              {a.number}
                              <small>{label(a.send_state)}</small>
                            </td>
                            <td>
                              {new Date(a.prepared_at).toLocaleString()}
                              <small>
                                {a.send_started_at
                                  ? new Date(a.send_started_at).toLocaleString()
                                  : "Not sent"}
                              </small>
                            </td>
                            <td>{resultText(a.result)}</td>
                            <td>
                              {a.resolved_at
                                ? new Date(a.resolved_at).toLocaleString()
                                : "Pending"}
                            </td>
                            <td>
                              {a.released_at
                                ? new Date(a.released_at).toLocaleString()
                                : "HELD / NOT VERIFIED"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {job.attempts.length === 0 && (
                    <p className="muted">No dispatch prepared.</p>
                  )}
                  {manager && (
                    <>
                      <button
                        disabled={locked || reading || !job.retry_allowed}
                        onClick={choose}
                      >
                        <RotateCcw size={15} /> Authorise one extra dispatch
                      </button>
                      <JobAudit
                        key={job.id}
                        api={api}
                        base={base}
                        jobId={job.id}
                        version={refresh}
                      />
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
      {unresolved && (
        <div className="notice" role="status">
          <span>Recovery authorisation unconfirmed. No automatic retry.</span>
          <button disabled={busy || !available} onClick={() => void recover()}>
            <RefreshCw size={15} /> Check original recovery action
          </button>
        </div>
      )}
      {intent && (
        <Modal
          title="Authorise one extra dispatch"
          close={() => {
            if (!busy && !unresolved) {
              setIntent(null);
              setCode("");
              setReason("");
            }
          }}
        >
          <p>
            One additional execution of this job's original program may be
            scheduled. This does not set a verdict, release a physical hold or
            change its receipt.
          </p>
          <p>
            Job: <code className="judging-job-id">{intent}</code>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label>
              Exact job ID
              <input
                aria-label="Recovery job confirmation"
                value={confirmation}
                disabled={busy || unresolved}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </label>
            <label>
              Audit reason
              <textarea
                aria-label="Recovery audit reason"
                value={reason}
                maxLength={1024}
                disabled={busy || unresolved}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            <label>
              Your staff code
              <input
                aria-label="Recovery staff code"
                type="password"
                autoComplete="off"
                value={code}
                maxLength={96}
                disabled={busy || unresolved}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            <div className="dialog-actions">
              <button
                type="submit"
                disabled={
                  locked ||
                  reading ||
                  confirmation !== intent ||
                  !reason.trim() ||
                  new TextEncoder().encode(reason).length > 1024 ||
                  !code.trim() ||
                  !detail?.jobs.find((j) => j.id === intent)?.retry_allowed
                }
              >
                Confirm extra dispatch
              </button>
            </div>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {unresolved && (
            <button
              disabled={busy || !available}
              onClick={() => void recover()}
            >
              <RefreshCw size={15} /> Check original recovery action
            </button>
          )}
        </Modal>
      )}
    </section>
  );
}
function JobAudit({
  api,
  base,
  jobId,
  version,
}: {
  api: Api;
  base: string;
  jobId: string;
  version: number;
}) {
  const [data, setData] = useState<RecoveryAudit | null>(null),
    [pages, setPages] = useState<(string | null)[]>([null]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const after = pages.at(-1);
  useEffect(() => {
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    function load() {
      setBusy(true);
      void api
        .request<RecoveryAudit>(
          `${base}/jobs/${jobId}/recovery-history${after ? `?after=${after}` : ""}`,
          undefined,
          "STAFF",
        )
        .then((value) => {
          if (!gone) {
            setData(value);
            setError("");
          }
        })
        .catch((e) => {
          if (!gone) {
            setData(null);
            setError(errorText(e));
          }
        })
        .finally(() => {
          if (!gone) {
            setBusy(false);
            timer = setTimeout(load, 5000);
          }
        });
    }
    load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [api, base, jobId, after, version]);
  return (
    <section aria-label="Recovery audit history">
      <h3>Recovery decisions</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data?.items.map((a) => (
        <article className="judging-audit" key={a.id}>
          <strong>
            {label(a.decision)} / {a.actor_name}
          </strong>
          <time dateTime={a.recorded_at}>
            {new Date(a.recorded_at).toLocaleString()}
          </time>
          <p>{a.reason}</p>
          {a.reason_code && <small>{label(a.reason_code)}</small>}
        </article>
      ))}
      {data?.items.length === 0 && (
        <p className="muted">No recorded recovery decisions.</p>
      )}
      <div className="history-pagination">
        <IconButton
          title="Previous recovery audit page"
          disabled={busy || pages.length === 1}
          onClick={() => setPages((v) => v.slice(0, -1))}
        >
          <ArrowLeft size={17} />
        </IconButton>
        <span>Audit page {pages.length}</span>
        <IconButton
          title="Next recovery audit page"
          disabled={busy || !data?.next_after}
          onClick={() => setPages((v) => [...v, data!.next_after])}
        >
          <ArrowRight size={17} />
        </IconButton>
      </div>
    </section>
  );
}
