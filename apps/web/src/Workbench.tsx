import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FileCode2,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Play,
  RefreshCw,
  Save,
  Send,
  X,
} from "lucide-react";
import { Command, errorText } from "./api";
import type { Api } from "./api";
import type {
  Bounty,
  Feedback,
  Metadata,
  Receipt,
  Session,
  Snapshot,
} from "./types";
import { bugPath, label, languages, judgingPending } from "./types";
import type { createWorkspace } from "./workspace";
import { IconButton, Modal } from "./ui";
import { displayOutput } from "./output";
import Editor from "./Editor";
import ReportQuestion from "./ReportQuestion";
type Workspace = ReturnType<typeof createWorkspace>;
type Tab = "PROBLEM" | "HINTS" | "SUBMISSIONS";
export default function Workbench({
  api,
  session,
  bug,
  workspace,
  ready,
  permitted,
  roundKind,
  wallet,
  close,
  judging,
}: {
  api: Api;
  session: Session;
  bug: Bounty;
  workspace: Workspace;
  ready: boolean;
  permitted: boolean;
  roundKind: number;
  wallet: number;
  close: () => void;
  judging: Snapshot["judging"];
}) {
  const path = bugPath(session.round_id, bug.bounty_id),
    [meta, setMeta] = useState<Metadata | null>(null),
    [statement, setStatement] = useState(""),
    [loadVersion, setLoadVersion] = useState(0),
    [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false),
    [feedbackError, setFeedbackError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sending, setSending] = useState<"runs" | "submissions" | null>(null),
    [tab, setTab] = useState<Tab>("PROBLEM"),
    [samples, setSamples] = useState<
      Record<number, { input: string; output: string }>
    >({}),
    [hints, setHints] = useState<{ level: number; content: string }[]>([]),
    [submissions, setSubmissions] = useState<any[]>([]),
    [after, setAfter] = useState<string | null>(null),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [feedbackId, setFeedbackId] = useState<string | null>(null),
    [viewSource, setViewSource] = useState<any>(null),
    [buy, setBuy] = useState<number | null>(null),
    [conflict, setConflict] = useState<any>(null),
    [reporting, setReporting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [bug.bounty_id]);
  const command = useRef(workspace.command(bug.bounty_id)),
    unresolved = command.current.unresolved;
  const judgingVersion = JSON.stringify(judging),
    pending = judging.filter(
      (job) => job.bounty_id === bug.bounty_id && judgingPending(job.status),
    ),
    runCount = meta?.unfinished_runs ?? 0,
    sampleBusy =
      sending === "runs" ||
      pending.some(
        (job) =>
          job.lane === "SAMPLE" &&
          job.member_round_id === session.member_round_id,
      ) ||
      (feedback?.lane === "SAMPLE" && judgingPending(feedback.status)),
    officialBusy =
      sending === "submissions" ||
      !!meta?.official_pending ||
      pending.some((job) => job.lane === "OFFICIAL") ||
      (feedback?.lane === "OFFICIAL" && judgingPending(feedback.status)),
    recoveryHeld =
      pending.some((job) =>
        ["RECOVERING", "NEEDS_ATTENTION"].includes(job.status),
      ) || ["RECOVERING", "NEEDS_ATTENTION"].includes(feedback?.status ?? "");
  const item = workspace.items.get(bug.bounty_id),
    source = item?.editor.source ?? "",
    state = item?.view;
  const readOnly =
      !meta?.writable || !permitted || state?.state === "READ_ONLY",
    canJudge =
      !readOnly &&
      ready &&
      !!source.trim() &&
      new TextEncoder().encode(source).length <= 131072;
  const hintTier = Math.max(bug.hint_tier, ...hints.map((h) => h.level), 0),
    price = (level: number) =>
      bug.difficulty * [1, 3, roundKind === 1 ? 4 : 8][level - 1];
  useEffect(() => {
    let gone = false;
    setLoadFailed(false);
    setLoading(true);
    void Promise.all([
      api.request<Metadata>(path),
      api.request<{ statement: string }>(`${path}/statement`),
      api.request<{ level: number; content: string }[]>(`${path}/hints`),
      workspace.open(bug.bounty_id),
    ])
      .then(([m, s, h]) => {
        if (!gone) {
          setMeta(m);
          setStatement(s.statement);
          setHints(h);
        }
      })
      .catch((e) => {
        if (!gone) {
          setError(errorText(e));
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [bug.bounty_id, loadVersion]);
  useEffect(() => {
    let gone = false;
    void Promise.all([
      api.request<Metadata>(path),
      api.request<{ level: number; content: string }[]>(`${path}/hints`),
    ])
      .then(([m, h]) => {
        if (!gone) {
          setMeta(m);
          setHints(h);
        }
      })
      .catch((e) => {
        if (!gone) {
          setError(errorText(e));
          setLoadFailed(true);
        }
      });
    return () => {
      gone = true;
    };
  }, [judgingVersion, bug.claimed, bug.hint_tier, ready]);
  const selectedFeedbackId =
    feedbackId ??
    judging
      .filter(
        (job) =>
          job.bounty_id === bug.bounty_id &&
          (job.lane === "OFFICIAL" ||
            job.member_round_id === session.member_round_id),
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
      ?.parent_id;
  async function perform(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function refreshMetadata() {
    setMeta(await api.request(path));
  }
  async function admitted(result: Receipt) {
    if (result.result.status === "REJECTED") {
      setError(
        `Action declined: ${label(result.result.reason ?? "unavailable")}.`,
      );
      return;
    }
    try {
      if (result.result.run_id || result.result.submission_id) {
        const id = result.result.run_id ?? result.result.submission_id;
        setFeedbackId(id!);
        setFeedback(null);
      }
      if (
        result.result.status === "PURCHASED" ||
        result.result.status === "ALREADY_OWNED"
      )
        setHints(await api.request(`${path}/hints`));
      await refreshMetadata();
    } catch (error) {
      setLoadFailed(true);
      throw error;
    }
  }
  useEffect(() => {
    if (
      !selectedFeedbackId ||
      !ready ||
      (feedback?.id === selectedFeedbackId && !judgingPending(feedback.status))
    )
      return;
    let gone = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let pending = true;
      try {
        const value = await api.request<Feedback>(
          `/api/v1/competition/rounds/${session.round_id}/judging/${selectedFeedbackId}`,
        );
        if (gone) return;
        const waiting = judgingPending(value.status);
        if (!waiting) {
          const metadata = await api.request<Metadata>(path);
          if (gone) return;
          setMeta(metadata);
        }
        setFeedback(value);
        setFeedbackError("");
        pending = waiting;
      } catch (e) {
        if (!gone) setFeedbackError(errorText(e));
      } finally {
        // Only reads are retried; never replay a run or submission here.
        if (!gone && pending) timer = setTimeout(() => void poll(), 2000);
      }
    }
    timer = setTimeout(
      () => void poll(),
      feedback?.id === selectedFeedbackId ? 2000 : 0,
    );
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [
    selectedFeedbackId,
    feedback?.id,
    feedback?.status,
    judgingVersion,
    ready,
  ]);
  async function judge(action: "runs" | "submissions") {
    if (busy) return;
    setSending(action);
    try {
      await perform(async () => {
        await admitted(
          await command.current.send(`${path}/${action}`, {
            source: item!.editor.source,
          }),
        );
      });
    } finally {
      setSending(null);
    }
  }
  async function loadHistory(more = false) {
    await perform(async () => {
      const value = await api.request<{
        submissions: any[];
        next_after: string | null;
      }>(`${path}/submissions${more && after ? `?after=${after}` : ""}`);
      setSubmissions(
        more ? [...submissions, ...value.submissions] : value.submissions,
      );
      setAfter(value.next_after);
      setTab("SUBMISSIONS");
    });
  }
  return (
    <section className="workbench" aria-label={`${bug.title} workbench`}>
      <header className="workbench-heading">
        <div>
          <span className="eyebrow">
            BOUNTY / {bug.difficulty.toString().padStart(2, "0")}
          </span>
          <h2 ref={heading} tabIndex={-1}>
            {bug.title}
          </h2>
        </div>
        <div className="workbench-stats">
          <span className="difficulty">
            {bug.difficulty}
            <small>/100</small>
          </span>
          <strong>
            {bug.base_bounty.toLocaleString()}
            <small> bounty</small>
          </strong>
          <IconButton title="Close workbench" onClick={close}>
            <X size={21} />
          </IconButton>
        </div>
      </header>
      {(bug.claimed || !ready || (meta && !meta.writable)) && (
        <div
          className={`workbench-notice ${bug.claimed ? "cleared-notice" : ""}`}
          role="status"
        >
          {bug.claimed ? <Check size={17} /> : <LockKeyhole size={15} />}
          {bug.claimed
            ? "TARGET CLEARED. Bounty claimed; your code is retained."
            : !ready
              ? "Live state unavailable. New actions are disabled."
              : `Read only: ${label(meta!.reason ?? "unavailable")}.`}
        </div>
      )}
      <button className="text-button" onClick={()=>setReporting(true)}>Report question</button>
      {reporting&&<ReportQuestion api={api} path={path} title={bug.title} close={()=>setReporting(false)}/>}
      <div className="workbench-grid">
        <div className="problem-column">
          <nav className="tabs" aria-label="Challenge views">
            {(["PROBLEM", "HINTS", "SUBMISSIONS"] as Tab[]).map((name) => (
              <button
                key={name}
                aria-current={tab === name ? "page" : undefined}
                onClick={() =>
                  name === "SUBMISSIONS" ? void loadHistory() : setTab(name)
                }
              >
                {label(name)}
                {name === "HINTS" && <span>{hintTier}/3</span>}
              </button>
            ))}
          </nav>
          <div className="problem-content">
            {tab === "PROBLEM" && (
              <>
                <div className="limits">
                  <span>
                    <Clock3 size={13} />
                    {meta ? `${meta.cpu_ms / 1000}s CPU` : "--"}
                  </span>
                  <span>{meta ? `${meta.memory_kb / 1024} MiB` : "--"}</span>
                  <span>Full program</span>
                </div>
                <h3>Mission brief</h3>
                <div className="statement">
                  {statement || "Loading challenge…"}
                </div>
                <h3>Public samples</h3>
                {meta?.samples.map((s) => (
                  <section className="sample" key={s.sample_number}>
                    <button
                      onClick={() =>
                        void perform(async () => {
                          const [input, output] = await Promise.all([
                            api.request<{ content: string }>(
                              `${path}/samples/${s.sample_number}/input`,
                            ),
                            api.request<{ content: string }>(
                              `${path}/samples/${s.sample_number}/expected_output`,
                            ),
                          ]);
                          setSamples({
                            ...samples,
                            [s.sample_number]: {
                              input: input.content,
                              output: output.content,
                            },
                          });
                        })
                      }
                      disabled={busy}
                    >
                      Sample {s.sample_number}
                      <ArrowDownToLine size={15} />
                    </button>
                    {samples[s.sample_number] && (
                      <>
                        <h4>Input</h4>
                        <pre>{samples[s.sample_number].input}</pre>
                        <h4>Expected output</h4>
                        <pre>{samples[s.sample_number].output}</pre>
                      </>
                    )}
                  </section>
                ))}
              </>
            )}
            {tab === "HINTS" && (
              <>
                <h3>Field intelligence</h3>
                {[1, 2, 3].map((level) => {
                  const owned = hints.find((h) => h.level === level),
                    purchased = level <= hintTier,
                    locked = level > hintTier + 1;
                  return (
                    <section className="hint" key={level}>
                      <div>
                        <span>
                          {purchased ? (
                            <Check size={16} />
                          ) : locked ? (
                            <LockKeyhole size={16} />
                          ) : (
                            <Lightbulb size={16} />
                          )}{" "}
                          Hint {level}
                        </span>
                        <strong>{price(level)} credits</strong>
                      </div>
                      {owned ? (
                        <p>{owned.content}</p>
                      ) : purchased ? (
                        <p role="status">Purchased / content pending</p>
                      ) : (
                        <button
                          disabled={
                            locked ||
                            readOnly ||
                            busy ||
                            unresolved ||
                            wallet < price(level)
                          }
                          onClick={() => setBuy(level)}
                        >
                          {locked
                            ? "Locked"
                            : wallet < price(level)
                              ? "Insufficient funds"
                              : "Purchase hint"}
                          <ChevronRight size={15} />
                        </button>
                      )}
                    </section>
                  );
                })}
              </>
            )}
            {tab === "SUBMISSIONS" && (
              <>
                <h3>Team submissions</h3>
                {submissions.length === 0 && (
                  <p className="muted">No official submissions yet.</p>
                )}
                {submissions.map((s) => (
                  <article className="submission" key={s.submission_id}>
                    <div>
                      <span>
                        {languages[s.language as keyof typeof languages]}
                      </span>
                      <span>{label(s.result ?? s.status)}</span>
                    </div>
                    <time>{new Date(s.received_at).toLocaleTimeString()}</time>
                    <button
                      className="text-button"
                      onClick={() =>
                        void perform(async () => {
                          setViewSource(
                            await api.request(
                              `${path}/submissions/${s.submission_id}/source`,
                            ),
                          );
                        })
                      }
                    >
                      <FileCode2 size={15} /> Submitted source
                    </button>
                  </article>
                ))}
                {after && (
                  <button
                    disabled={busy}
                    onClick={() => void loadHistory(true)}
                  >
                    More submissions
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="code-column">
          <div className="code-heading">
            <span>
              <Code2 size={16} />
              {languages[session.language]} <small>/ private draft</small>
            </span>
            <div>
              <span
                className={`save-status state-${state?.state.toLowerCase()}`}
                role="status"
              >
                {state ? label(state.state) : "loading"}
              </span>
              <IconButton
                title="Save private draft"
                disabled={
                  !item ||
                  readOnly ||
                  state?.state === "SAVING" ||
                  state?.state === "UNRESOLVED" ||
                  state?.state === "CONFLICT"
                }
                onClick={() =>
                  void perform(async () => {
                    await item!.editor.save();
                  })
                }
              >
                <Save size={17} />
              </IconButton>
            </div>
          </div>
          {item && (
            <Editor
              source={source}
              language={session.language}
              readOnly={readOnly}
              onChange={(text) => {
                try {
                  item.editor.edit(text);
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            />
          )}
          {(state?.state === "CONFLICT" || state?.state === "UNRESOLVED") && (
            <div className="save-recovery">
              {state.state === "CONFLICT" ? (
                <button
                  onClick={() =>
                    void perform(async () => {
                      setConflict(await item!.editor.review());
                    })
                  }
                >
                  Review competing draft <RefreshCw size={15} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      void perform(async () => {
                        await item!.editor.refresh();
                      })
                    }
                  >
                    Check save outcome <RefreshCw size={15} />
                  </button>
                  <button
                    onClick={() =>
                      void perform(async () => {
                        await item!.editor.retry();
                      })
                    }
                  >
                    Retry original save
                  </button>
                </>
              )}
            </div>
          )}
          <div className="code-actions">
            <span>
              {new TextEncoder().encode(source).length.toLocaleString()} /
              131,072 bytes
            </span>
            <div>
              <button
                aria-busy={sampleBusy && !bug.claimed}
                title={
                  sampleBusy
                    ? "Sample scan in progress; up to two runs can be pending"
                    : "Run public sample tests"
                }
                disabled={
                  busy || !canJudge || unresolved || !meta || runCount >= 2
                }
                onClick={() => void judge("runs")}
              >
                {sampleBusy && !bug.claimed ? (
                  <LoaderCircle className="judging-spinner" size={15} />
                ) : (
                  <Play size={15} />
                )}
                {sampleBusy && !bug.claimed
                  ? "Scanning samples"
                  : "Run samples"}{" "}
                <small>{runCount}/2</small>
              </button>
              <button
                className="primary"
                aria-busy={officialBusy && !bug.claimed}
                disabled={busy || !canJudge || unresolved || officialBusy}
                onClick={() => void judge("submissions")}
              >
                {bug.claimed ? (
                  <Check size={15} />
                ) : officialBusy ? (
                  <LoaderCircle className="judging-spinner" size={15} />
                ) : (
                  <Send size={15} />
                )}{" "}
                {bug.claimed
                  ? "Target cleared"
                  : officialBusy
                    ? "Validating fix"
                    : "Submit fix"}
              </button>
            </div>
          </div>
          {!bug.claimed && (sampleBusy || officialBusy || unresolved) && (
            <div className="judging-notice" role="status">
              {recoveryHeld || unresolved ? (
                <Clock3 size={14} />
              ) : (
                <LoaderCircle className="judging-spinner" size={14} />
              )}
              {unresolved
                ? "Receipt unconfirmed. Check the original action below."
                : recoveryHeld
                  ? "Recovery hold. Awaiting verified judge outcome."
                  : officialBusy
                    ? "Fix uplink active. Awaiting official verdict."
                    : "Sample scan active. Awaiting test results."}
            </div>
          )}
          <div className="feedback" aria-live="polite">
            <div className="feedback-heading">
              <strong>Execution</strong>
              {feedback && (
                <span>{label(feedback.result ?? feedback.status)}</span>
              )}
            </div>
            {!feedback ? (
              <p className="muted">No execution selected.</p>
            ) : (
              feedback.samples.map((sample) => (
                <div className="feedback-sample" key={sample.sample}>
                  <h4>
                    Sample {sample.sample}{" "}
                    <span>{label(sample.result ?? "pending")}</span>
                  </h4>
                  {sample.compiler_output_b64 && (
                    <pre>{displayOutput(sample.compiler_output_b64)}</pre>
                  )}
                  {sample.stderr_b64 && (
                    <pre>{displayOutput(sample.stderr_b64)}</pre>
                  )}
                  {sample.stdout_b64 !== null && (
                    <pre>
                      {displayOutput(sample.stdout_b64) || "(empty output)"}
                    </pre>
                  )}
                  {(sample.stdout_truncated ||
                    sample.stderr_truncated ||
                    sample.compiler_output_truncated) && (
                    <p>Output retention limit reached.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {unresolved && (
        <div className="notice">
          <span>Previous action outcome unknown. No automatic retry.</span>
          <button
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const value = await command.current.recover();
                if (value) await admitted(value);
                else
                  setError(
                    "The original outcome is not available yet. No new action was sent.",
                  );
              })
            }
          >
            Check original action <RefreshCw size={15} />
          </button>
        </div>
      )}
      {(loadFailed || hintTier > hints.length) && (
        <button
          disabled={loading || busy}
          aria-busy={loading}
          onClick={() => {
            setError("");
            setLoadVersion((version) => version + 1);
          }}
        >
          <RefreshCw size={15} /> Retry challenge
        </button>
      )}
      {(error || feedbackError) && (
        <div role="alert" className="error workbench-error">
          {error || feedbackError}
        </div>
      )}
      {buy !== null && (
        <Modal title={`Purchase hint ${buy}`} close={() => setBuy(null)}>
          <p>
            Spend <strong>{price(buy)} credits</strong> from your team's wallet?
          </p>
          <p className="muted">
            Current wallet: {wallet.toLocaleString()} credits.
            {roundKind === 2
              ? ` This hint tier awards ${[100, 90, 70, 50][buy]}% of the bug's points on a winning solve.`
              : " The cost is deducted from the team's round score."}
          </p>
          <button
            className="primary"
            disabled={busy || readOnly}
            onClick={() =>
              void perform(async () => {
                const result = await command.current.send(`${path}/hints`, {
                  level: buy,
                });
                setBuy(null);
                await admitted(result);
              })
            }
          >
            Confirm purchase
          </button>
        </Modal>
      )}
      {conflict && (
        <Modal title="Review competing draft" close={() => setConflict(null)}>
          <p>Server revision {conflict.revision}</p>
          <pre className="source-review">{conflict.source}</pre>
          <div className="dialog-actions">
            <button
              onClick={() => {
                item!.editor.resolve(conflict, "SERVER");
                setConflict(null);
              }}
            >
              Use server copy
            </button>
            <button
              className="primary"
              onClick={() => {
                item!.editor.resolve(conflict, "LOCAL");
                setConflict(null);
              }}
            >
              Keep my copy
            </button>
          </div>
        </Modal>
      )}
      {viewSource && (
        <Modal
          title={`Submitted ${languages[viewSource.language as keyof typeof languages]} source`}
          close={() => setViewSource(null)}
        >
          <p className="muted">
            Read only · {new Date(viewSource.received_at).toLocaleString()}
          </p>
          <pre className="source-review">{viewSource.source}</pre>
        </Modal>
      )}
    </section>
  );
}
