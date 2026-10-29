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
  RotateCcw,
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
import { TecnoesisCoin } from "./BountyReward";
import type { ShopIntel, ShopView } from "./shop-items";
import BugGear from "./BugGear";
import ProblemText, { InlineCode } from "./ProblemText";
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
  purchasesBlocked = false,
  shopIntel: suppliedShopIntel,
  shop,
  gearCommand,
  shopChanged,
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
  purchasesBlocked?: boolean;
  shopIntel?: ShopIntel;
  shop?: ShopView;
  gearCommand?: Command;
  shopChanged?: (view: ShopView) => void;
}) {
  const [paidIntel,setPaidIntel] = useState<ShopIntel | undefined>(suppliedShopIntel);
  const shopIntel = suppliedShopIntel ?? paidIntel;
  const intelVersion = JSON.stringify(shop?.purchases.filter(p=>p.target_id===bug.bounty_id && p.activated_at && (p.item_id==='hex-scanner'||p.item_id==='boundary-probe')).map(p=>p.id) ?? []);
  useEffect(()=>{
    if(roundKind!==2 || !shop || shop.preview || !ready || intelVersion==='[]')return;
    let active=true;
    void api.request<ShopIntel>(`/api/v1/competition/rounds/${session.round_id}/shop/intel/${bug.bounty_id}`)
      .then(value=>{if(active)setPaidIntel(value);},()=>{});
    return()=>{active=false;};
  },[api,session.round_id,bug.bounty_id,intelVersion,ready,roundKind,shop?.preview]);
  const [remembered] = useState(() => workspace.question(bug.bounty_id));
  const path = bugPath(session.round_id, bug.bounty_id),
    [meta, setMeta] = useState<Metadata | null>(remembered?.meta ?? null),
    [statement, setStatement] = useState(remembered?.statement ?? ""),
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
    >(remembered?.samples ?? {}),
    [hints, setHints] = useState<{ level: number; content: string }[]>(
      remembered?.hints ?? [],
    ),
    [submissions, setSubmissions] = useState<any[]>([]),
    [after, setAfter] = useState<string | null>(null),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [feedbackId, setFeedbackId] = useState<string | null>(null),
    [viewSource, setViewSource] = useState<any>(null),
    [buy, setBuy] = useState<number | null>(null),
    [resetSource, setResetSource] = useState<string | null>(null),
    [conflict, setConflict] = useState<any>(null),
    [reporting, setReporting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    resetButton = useRef<HTMLButtonElement>(null);
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
  const canReset =
    !!item &&
    !loading &&
    !readOnly &&
    ready &&
    !busy &&
    !["SAVING", "UNRESOLVED", "CONFLICT", "OFFLINE"].includes(
      state?.state ?? "",
    );
  const hintTier = Math.max(bug.hint_tier, ...hints.map((h) => h.level), 0),
    price = (level: number) =>
      (bug.base_bounty / 10) * [1, 3, roundKind === 1 ? 4 : 8][level - 1];
  useEffect(() => {
    if (meta && statement)
      workspace.rememberQuestion(bug.bounty_id, {
        meta,
        statement,
        hints,
        samples,
      });
  }, [meta, statement, hints, samples, workspace, bug.bounty_id]);
  useEffect(() => {
    if (!ready) {
      setLoading(false);
      return;
    }
    let gone = false;
    setLoadFailed(false);
    setLoading(true);
    void Promise.all([
      api.request<Metadata>(path).then((m) => {
        if (!gone) setMeta(m);
      }),
      (statement
        ? Promise.resolve({ statement })
        : api.request<{ statement: string }>(`${path}/statement`)
      ).then((s) => {
        if (!gone) setStatement(s.statement);
      }),
      api
        .request<{ level: number; content: string }[]>(`${path}/hints`)
        .then((h) => {
          if (!gone) setHints(h);
        }),
      item ? Promise.resolve(item) : workspace.open(bug.bounty_id),
    ])
      .then(() => {
        if (!gone) {
          setLoadFailed(false);
          setError("");
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
  }, [
    bug.bounty_id,
    loadVersion,
    judgingVersion,
    bug.claimed,
    bug.hint_tier,
    ready,
  ]);
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
  async function prepareReset() {
    if (!canReset) return;
    await perform(async () => {
      const original = await api.request<{
        bounty_id: string;
        language: string;
        source: string;
      }>(`${path}/starter`);
      if (
        original?.bounty_id !== bug.bounty_id ||
        original.language !== session.language ||
        typeof original.source !== "string" ||
        !original.source.isWellFormed() ||
        new TextEncoder().encode(original.source).length > 131072
      )
        throw new Error("INVALID_STARTER");
      setResetSource(original.source);
    });
  }
  function closeReset() {
    setResetSource(null);
    requestAnimationFrame(() => resetButton.current?.focus());
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
            <TecnoesisCoin />
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
      <button
        className="text-button"
        disabled={!ready}
        onClick={() => setReporting(true)}
      >
        Report question
      </button>
      {reporting && (
        <ReportQuestion
          api={api}
          path={path}
          title={bug.title}
          close={() => setReporting(false)}
        />
      )}
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
            {roundKind === 2 && shop && gearCommand && shopChanged && (
              <BugGear
                api={api}
                roundId={session.round_id}
                bountyId={bug.bounty_id}
                view={shop}
                enabled={ready && permitted && !readOnly}
                command={gearCommand}
                changed={shopChanged}
              />
            )}
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
                <ProblemText
                  text={
                    statement ||
                    (ready
                      ? "Loading challenge…"
                      : "Reconnect to load this question's statement.")
                  }
                />
                {shopIntel && (
                  <section
                    className="gear-intel"
                    aria-label="Purchased gear intelligence"
                  >
                    <span className="eyebrow">TEAM GEAR INTELLIGENCE</span>
                    <p>
                      This fix uses at least Hint {shopIntel.assistance_tier}
                      -level assistance for scoring.
                    </p>
                    {shopIntel.scanner && (
                      <div>
                        <h4>Hex Scanner · {shopIntel.scanner.label}</h4>
                        <p>{shopIntel.scanner.text}</p>
                        <p className="muted">
                          Original code · lines {shopIntel.scanner.from_line}–
                          {shopIntel.scanner.to_line}. Your edits do not change
                          this trace.
                        </p>
                        <pre>{shopIntel.scanner.source}</pre>
                      </div>
                    )}
                    {shopIntel.probe && (
                      <div>
                        <h4>Boundary Probe · additional edge example</h4>
                        <p>
                          This authored example is separate from the hidden
                          judging tests.
                        </p>
                        <h5>Input</h5>
                        <pre>{shopIntel.probe.input}</pre>
                        <h5>Expected output</h5>
                        <pre>{shopIntel.probe.output}</pre>
                      </div>
                    )}
                  </section>
                )}
                <h3>Public samples</h3>
                {meta?.samples.map((s) => (
                  <section className="sample" key={s.sample_number}>
                    <button
                      onClick={() =>
                        samples[s.sample_number]
                          ? undefined
                          : void perform(async () => {
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
                      disabled={busy || (!ready && !samples[s.sample_number])}
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
                {purchasesBlocked && (
                  <p className="shop-freeze" role="status">
                    Black ICE is active. New hint purchases are locked;
                    purchased hints remain available.
                  </p>
                )}
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
                        <p>
                          <InlineCode>{owned.content}</InlineCode>
                        </p>
                      ) : purchased ? (
                        <p role="status">Purchased / content pending</p>
                      ) : (
                        <button
                          disabled={
                            locked ||
                            !ready ||
                            readOnly ||
                            busy ||
                            unresolved ||
                            wallet < price(level) ||
                            purchasesBlocked
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
              <button
                ref={resetButton}
                className="text-button"
                title="Restore the original buggy code"
                disabled={!canReset}
                onClick={() => void prepareReset()}
              >
                <RotateCcw size={15} /> Reset code
              </button>
              <IconButton
                title="Save private draft"
                disabled={
                  !item ||
                  !ready ||
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
          {!ready && (
            <p className="offline-edit-notice" role="status">
              Connection interrupted.{" "}
              {item && !readOnly
                ? "You can keep editing this opened question. "
                : "Loaded code and question text are retained. "}
              Keep this tab open. Saving and new submissions wait for
              reconnection.
            </p>
          )}
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
      {resetSource === null && (error || feedbackError) && (
        <div role="alert" className="error workbench-error">
          {error || feedbackError}
        </div>
      )}
      {resetSource !== null && (
        <Modal title="Reset to original code?" close={closeReset}>
          <p>
            Replace your edits for this question with the original{" "}
            {languages[session.language]} buggy code? The restored code will be
            saved as your private draft.
          </p>
          <p className="muted">
            Copy any changes you want to keep before resetting.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button onClick={closeReset}>Cancel</button>
            <button
              className="primary"
              disabled={!canReset}
              onClick={() =>
                void perform(async () => {
                  if (!canReset) return;
                  item!.editor.edit(resetSource);
                  setResetSource(null);
                  await item!.editor.save();
                })
              }
            >
              Restore original code
            </button>
          </div>
        </Modal>
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
            disabled={busy || readOnly || !ready}
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
