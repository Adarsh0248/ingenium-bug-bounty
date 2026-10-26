import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileCode2, RefreshCw } from "lucide-react";
import type { Api } from "./api";
import { errorText } from "./api";
import type { Session } from "./types";
import { bugPath, label, languages, timeText } from "./types";
import type {
  HistoryAttempt,
  HistoryExecution,
  HistoryOverview,
  HistoryPage,
  HistoryRound,
  WalletEntry,
} from "./history-types";
import { IconButton, Modal } from "./ui";
import { displayOutput } from "./output";
import ScoreCorrections from "./ScoreCorrections";

type Tab = "STANDINGS" | "ATTEMPTS" | "WALLET" | "SAVED_WORK";
const path = (round: string) => `/api/v1/competition/rounds/${round}/history`;
export function resultsLabel(value: {
  final: boolean;
  cancelled: boolean;
  round: { state: string };
}) {
  return value.cancelled
    ? "Cancelled round history"
    : value.final
      ? "Final results"
      : value.round.state === "CLOSING"
        ? "Results finalising"
        : "Provisional results";
}
export default function Results({
  api,
  session,
  close,
  version,
}: {
  api: Api;
  session: Session;
  close: () => void;
  version: string;
}) {
  const [rounds, setRounds] = useState<HistoryRound[]>([]),
    [round, setRound] = useState(session.round_id),
    [error, setError] = useState("");
  useEffect(() => {
    let gone = false;
    let retry: ReturnType<typeof setTimeout>;
    const load = () =>
      void api
        .request<HistoryRound[]>("/api/v1/competition/history/rounds")
        .then((value) => {
          if (!gone) {
            setRounds(value);
            setError("");
          }
        })
        .catch((e) => {
          if (!gone) {
            setError(errorText(e));
            retry = setTimeout(load, 5000);
          }
        });
    load();
    return () => {
      gone = true;
      clearTimeout(retry);
    };
  }, [api, session.session_id]);
  return (
    <Modal title="Results & history" close={close}>
      <div className="results-history">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <nav className="tabs" aria-label="History rounds">
          {rounds.map((r) => (
            <button
              key={r.round_id}
              aria-current={round === r.round_id ? "page" : undefined}
              onClick={() => setRound(r.round_id)}
            >
              Round {r.kind}
            </button>
          ))}
        </nav>
        <RoundHistory
          key={round}
          api={api}
          session={session}
          round={round}
          version={version}
        />
      </div>
    </Modal>
  );
}
function RoundHistory({
  api,
  session,
  round,
  version,
}: {
  api: Api;
  session: Session;
  round: string;
  version: string;
}) {
  const [overview, setOverview] = useState<HistoryOverview | null>(null),
    [tab, setTab] = useState<Tab>("STANDINGS"),
    [attempts, setAttempts] = useState<HistoryPage<HistoryAttempt> | null>(
      null,
    ),
    [wallet, setWallet] = useState<HistoryPage<WalletEntry> | null>(null),
    [cursors, setCursors] = useState<(string | null)[]>([null]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState<{
      kind: "EXECUTION" | "DRAFT";
      id: string;
      title: string;
    } | null>(null);
  const after = cursors.at(-1),
    endpoint = path(round);
  useEffect(() => {
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (gone) return;
      setBusy(true);
      try {
        const [value, page] = await Promise.all([
          api.request<HistoryOverview>(endpoint),
          tab === "ATTEMPTS" || tab === "WALLET"
            ? api.request<
                HistoryPage<HistoryAttempt> | HistoryPage<WalletEntry>
              >(
                `${endpoint}/${tab.toLowerCase()}${after ? `?after=${after}` : ""}`,
              )
            : Promise.resolve(null),
        ]);
        if (!gone) {
          setOverview(value);
          if (tab === "ATTEMPTS")
            setAttempts(page as HistoryPage<HistoryAttempt>);
          if (tab === "WALLET") setWallet(page as HistoryPage<WalletEntry>);
          setError("");
        }
      } catch (e) {
        if (!gone) setError(errorText(e));
      } finally {
        if (!gone) {
          setBusy(false);
          timer = setTimeout(() => void load(), 5000);
        }
      }
    }
    void load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [api, round, tab, after, refresh, version]);
  const own = overview?.standings.find((s) => s.team_id === session.team_id),
    page = tab === "ATTEMPTS" ? attempts : wallet;
  function changeTab(next: Tab) {
    setTab(next);
    setCursors([null]);
    setAttempts(null);
    setWallet(null);
    setSelected(null);
  }
  return (
    <>
      <div className="history-summary" aria-live="polite">
        <div>
          <h3>{overview ? resultsLabel(overview) : "Loading results"}</h3>
          <span className="muted">
            {round !== session.round_id
              ? "Round 1 / read only"
              : "Current round"}
          </span>
        </div>
        <div>
          <span>Score</span>
          <strong>{own?.points.toLocaleString() ?? "--"}</strong>
        </div>
        <div>
          <span>Rank</span>
          <strong>{own?.rank === null || !own ? "--" : `#${own.rank}`}</strong>
        </div>
        <div>
          <span>Wallet</span>
          <strong>{overview?.wallet.toLocaleString() ?? "--"}</strong>
        </div>
        <IconButton
          title="Refresh history"
          disabled={busy}
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={17} />
        </IconButton>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <nav className="tabs history-tabs" aria-label="History views">
        {(["STANDINGS", "ATTEMPTS", "WALLET", "SAVED_WORK"] as Tab[]).map(
          (name) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => changeTab(name)}
            >
              {label(name)}
            </button>
          ),
        )}
      </nav>
      {tab === "STANDINGS" && overview?.final && <ScoreCorrections key={round} api={api} round={round}/>}
      {selected ? (
        <HistoryDetail
          key={`${selected.kind}:${selected.id}`}
          api={api}
          round={round}
          selected={selected}
          version={version}
          close={() => setSelected(null)}
        />
      ) : (
        <>
          {tab === "STANDINGS" && (
            <div className="history-table-scroll">
              <table className="history-table">
                <caption className="sr-only">
                  {overview ? resultsLabel(overview) : "Standings"}
                </caption>
                <thead>
                  <tr>
                    <th>Rank / team</th>
                    <th>Score</th>
                    <th>Total time</th>
                    <th>Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.standings.map((s) => (
                    <tr
                      key={s.team_round_id}
                      className={
                        s.team_id === session.team_id ? "own-standing" : ""
                      }
                    >
                      <th scope="row">
                        {s.rank ?? "--"} / {s.team_name}
                      </th>
                      <td>{s.points.toLocaleString()}</td>
                      <td>
                        {timeText(s.effective_time_ms)}
                        {s.penalty_ms > 0 && (
                          <small>
                            +{timeText(s.penalty_ms)} penalty included
                          </small>
                        )}
                      </td>
                      <td>{s.difficulties.join(", ") || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "ATTEMPTS" && (
            <div aria-label="Attempt history">
              {!attempts?.items.length && (
                <p className="muted">
                  {busy ? "Loading attempts" : "No attempts on this page."}
                </p>
              )}
              {attempts?.items.map((a) => (
                <article className="history-row" key={a.id}>
                  <div>
                    <h4>{a.title}</h4>
                    <span>
                      {a.lane === "SAMPLE"
                        ? "My sample run"
                        : "Team submission"}{" "}
                      / {languages[a.language]}
                    </span>
                    <time dateTime={a.created_at}>
                      {new Date(a.created_at).toLocaleString()}
                    </time>
                  </div>
                  <div>
                    <strong>{label(a.result ?? a.status)}</strong>
                    <small>
                      {a.award_id
                        ? "BOUNTY AWARDED"
                        : a.lane === "OFFICIAL" && a.result === "PASSED"
                          ? "No award recorded"
                          : label(a.status)}
                    </small>
                  </div>
                  <button
                    disabled={!!error || busy}
                    onClick={() =>
                      setSelected({
                        kind: "EXECUTION",
                        id: a.id,
                        title: a.title,
                      })
                    }
                  >
                    <FileCode2 size={15} /> View attempt
                  </button>
                </article>
              ))}
            </div>
          )}
          {tab === "WALLET" && (
            <div aria-label="Wallet history">
              {!wallet?.items.length && (
                <p className="muted">
                  {busy ? "Loading wallet" : "No wallet entries on this page."}
                </p>
              )}
              {wallet?.items.map((w) => (
                <article className="history-row" key={w.id}>
                  <div>
                    <h4>
                      {w.kind === "CARRYOVER" ? "Round 1 carryover" : w.title}
                    </h4>
                    <span>
                      {w.kind === "HINT"
                        ? `Hint ${w.hint_level}`
                        : label(w.kind)}
                    </span>
                    <time dateTime={w.recorded_at}>
                      {new Date(w.recorded_at).toLocaleString()}
                    </time>
                  </div>
                  <div>
                    <strong
                      className={
                        w.amount > 0 ? "history-credit" : "history-debit"
                      }
                    >
                      {w.amount > 0 ? "+" : ""}
                      {w.amount.toLocaleString()} CR
                    </strong>
                    {w.awarded_points !== null && (
                      <small>{w.awarded_points} round points</small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {tab === "SAVED_WORK" && (
            <div aria-label="Saved work history">
              {overview?.bounties.map((b) => (
                <article className="history-row" key={b.bounty_id}>
                  <div>
                    <h4>{b.title}</h4>
                    <span>
                      {b.difficulty}/100 / {b.base_bounty} CR
                    </span>
                    <small>
                      {b.draft_saved ? "My saved draft" : "Starter code"} /{" "}
                      {b.hint_tier} hints owned
                      {b.awarded_points !== null
                        ? ` / ${b.awarded_points} points awarded`
                        : ""}
                    </small>
                  </div>
                  <button
                    disabled={!!error || busy}
                    onClick={() =>
                      setSelected({
                        kind: "DRAFT",
                        id: b.bounty_id,
                        title: b.title,
                      })
                    }
                  >
                    <FileCode2 size={15} /> Review saved work
                  </button>
                </article>
              ))}
            </div>
          )}
          {(tab === "ATTEMPTS" || tab === "WALLET") && (
            <div className="history-pagination">
              <IconButton
                title="Previous history page"
                disabled={busy || cursors.length === 1}
                onClick={() => {
                  setCursors((old) => old.slice(0, -1));
                  setAttempts(null);
                  setWallet(null);
                }}
              >
                <ArrowLeft size={17} />
              </IconButton>
              <span>Page {cursors.length}</span>
              <IconButton
                title="Next history page"
                disabled={busy || !!error || !page?.next_after}
                onClick={() => {
                  setCursors((old) => [...old, page!.next_after]);
                  setAttempts(null);
                  setWallet(null);
                }}
              >
                <ArrowRight size={17} />
              </IconButton>
            </div>
          )}
        </>
      )}
    </>
  );
}
function HistoryDetail({
  api,
  round,
  selected,
  close,
  version,
}: {
  api: Api;
  round: string;
  selected: { kind: "EXECUTION" | "DRAFT"; id: string; title: string };
  close: () => void;
  version: string;
}) {
  const [execution, setExecution] = useState<HistoryExecution | null>(null),
    [draft, setDraft] = useState<{
      source: string;
      language: keyof typeof languages;
      source_kind: string;
      updated_at: string | null;
    } | null>(null),
    [hints, setHints] = useState<{ level: number; content: string }[]>([]),
    [statement, setStatement] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        if (selected.kind === "EXECUTION") {
          const value = await api.request<HistoryExecution>(
            `${path(round)}/judging/${selected.id}`,
          );
          if (!gone) {
            setExecution(value);
            setError("");
            if (value.status !== "COMPLETED" && value.status !== "CANCELLED")
              timer = setTimeout(() => void load(), 5000);
          }
        } else {
          const base = bugPath(round, selected.id),
            [d, h, s] = await Promise.all([
              api.request<NonNullable<typeof draft>>(`${base}/draft`),
              api.request<typeof hints>(`${path(round)}/hints/${selected.id}`),
              api.request<{ statement: string }>(`${base}/statement`),
            ]);
          if (!gone) {
            setDraft(d);
            setHints(h);
            setStatement(s.statement);
            setError("");
          }
        }
      } catch (e) {
        if (!gone) {
          setError(errorText(e));
          timer = setTimeout(() => void load(), 5000);
        }
      }
    }
    void load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [api, round, selected.id, version]);
  return (
    <section className="history-detail" aria-label="Read-only history detail">
      <button onClick={close}>
        <ArrowLeft size={15} /> Back to history
      </button>
      <h3>{selected.title}</h3>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!error && (execution || draft) && (
        <>
          <p className="muted">
            Read only / {languages[(execution ?? draft)!.language]} /{" "}
            {execution
              ? new Date(execution.created_at).toLocaleString()
              : draft!.source_kind === "STARTER"
                ? "Starter code; no saved draft"
                : `Saved ${new Date(draft!.updated_at!).toLocaleString()}`}
          </p>
          {execution && (
            <>
              <h4>{label(execution.result ?? execution.status)}</h4>
              {execution.samples.map((s) => (
                <section className="feedback-sample" key={s.sample}>
                  <h4>
                    Sample {s.sample} / {label(s.result ?? "pending")}
                  </h4>
                  {(
                    [
                      ["Output", s.stdout_b64],
                      ["Errors", s.stderr_b64],
                      ["Compiler", s.compiler_output_b64],
                    ] as const
                  )
                    .filter(([, value]) => value !== null)
                    .map(([name, value]) => (
                      <div key={name}>
                        <h4>{name}</h4>
                        <pre>{displayOutput(value) || "(empty output)"}</pre>
                      </div>
                    ))}
                  {(s.stdout_truncated ||
                    s.stderr_truncated ||
                    s.compiler_output_truncated) && (
                    <p>Output retention limit reached.</p>
                  )}
                </section>
              ))}
            </>
          )}
          {draft && (
            <>
              <h4>Mission brief</h4>
              <div className="statement">{statement}</div>
              <h4>Purchased hints</h4>
              {hints.length ? (
                hints.map((h) => (
                  <section key={h.level}>
                    <h4>Hint {h.level}</h4>
                    <p className="statement">{h.content}</p>
                  </section>
                ))
              ) : (
                <p className="muted">No hints purchased.</p>
              )}
            </>
          )}
          <h4>
            {execution
              ? "Original attempt source"
              : draft?.source_kind === "STARTER"
                ? "Starter code"
                : "My saved source"}
          </h4>
          <pre className="source-review">{(execution ?? draft)!.source}</pre>
        </>
      )}
    </section>
  );
}
