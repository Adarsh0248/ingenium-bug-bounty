import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  X,
  Upload,
  Search,
  Ban,
} from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import { IconButton, Modal } from "./ui";
import { label } from "./types";
import TeamImport from "./TeamImport";

type Team = {
  team_id: string;
  team_name: string;
  members: { member_id: string; position: number; member_name: string }[];
  code_version: string;
  has_active_code: boolean;
  registration_id: string | null;
};
type Page = {
  control_revision: string;
  total: number;
  matched: number;
  search: string;
  items: Team[];
  next_after: string | null;
};
type Draft = {
  action: "CREATE" | "ROTATE" | "ISSUE" | "REVOKE";
  target: string | null;
  revision: string;
  name: string;
  one: string;
  two: string;
};
type Receipt = {
  action: string;
  outcome: string;
  reason: string | null;
  result_team_id: string | null;
  code_version: string | null;
};
const base = "/api/v1/staff/teams",
  valid = (s: string, n = 120) =>
    !!s.trim() && !s.includes("\0") && new TextEncoder().encode(s).length <= n;
export default function StaffTeams({
  api,
  available,
  blockNavigation,
}: {
  api: Api;
  available: boolean;
  blockNavigation: (blocked: boolean) => void;
}) {
  const [result, setResult] = useState<{ path: string; page: Page } | null>(
      null,
    ),
    [search, setSearch] = useState(""),
    [searchDraft, setSearchDraft] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [draft, setDraft] = useState<Draft | null>(null),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [discard, setDiscard] = useState(false),
    [issued, setIssued] = useState<{
      code: string;
      team: string;
      name: string;
    } | null>(null),
    [reveal, setReveal] = useState(false),
    [copyMessage, setCopyMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [denied, setDenied] = useState(false),
    [importing, setImporting] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [, render] = useState(0);
  const command = useRef<Command | null>(null),
    mounted = useRef(true),
    generation = useRef(0),
    reading = useRef(false),
    refresh = useRef<(force?: boolean) => Promise<void>>(async () => {}),
    cursor = cursors.at(-1);
  const params = new URLSearchParams();
  if (cursor) params.set("after", cursor);
  if (search) params.set("search", search);
  const path = `${base}${params.size ? `?${params}` : ""}`,
    data = available && result?.path === path ? result.page : null;
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const locked = !available || denied || busy || command.current.unresolved,
    blocked =
      importing || !!draft || !!issued || busy || command.current.unresolved;
  const observed = draft
    ? draft.target
      ? data?.items.find((t) => t.team_id === draft.target)?.code_version
      : data?.control_revision
    : undefined;
  const target = draft?.target
      ? data?.items.find((t) => t.team_id === draft.target)
      : undefined,
    accessChanged =
      !!draft?.target &&
      (!target || target.has_active_code !== (draft.action !== "ISSUE")),
    stateChanged =
      accessChanged || (observed !== undefined && observed !== draft?.revision),
    searchValid =
      searchDraft.isWellFormed() &&
      !searchDraft.includes("\0") &&
      new TextEncoder().encode(searchDraft).length <= 120;
  refresh.current = async (force = false) => {
    if (!available || (reading.current && !force)) return;
    reading.current = true;
    const version = ++generation.current;
    setLoading(true);
    try {
      const value = await api.request<Page>(path, undefined, "STAFF");
      if (!mounted.current || version !== generation.current) return;
      if (value.search !== search) throw new ApiError("INVALID_CONTEXT");
      setResult({ path, page: value });
      setDenied(false);
    } catch (e) {
      if (!mounted.current || version !== generation.current) return;
      if (e instanceof ApiError && [401, 403].includes(e.status)) {
        setDraft(null);
        setIssued(null);

        setConfirm(false);
        setDenied(true);
      }
      setResult(null);
      setError(errorText(e));
    } finally {
      if (version === generation.current) {
        reading.current = false;
        if (mounted.current) setLoading(false);
      }
    }
  };
  useEffect(() => {
    mounted.current = true;
    if (!available) {
      setResult(null);
      setLoading(false);
    }
    void refresh.current();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh.current();
    }, 15000);
    return () => {
      mounted.current = false;
      generation.current++;
      reading.current = false;
      clearInterval(timer);
    };
  }, [path, available]);
  useEffect(() => {
    blockNavigation(blocked);
  }, [blocked]);
  useEffect(() => () => blockNavigation(false), []);
  function choose(value: Draft) {
    if (locked || draft) return;
    setDraft(value);
    setReason("");

    setError("");
    setNotice("");
  }
  function codeChange(team: Team, action: "ROTATE" | "ISSUE" | "REVOKE") {
    choose({
      action,
      target: team.team_id,
      revision: team.code_version,
      name: team.team_name,
      one: "",
      two: "",
    });
  }
  async function acknowledge(
    value: { outcome: Receipt; issued_code?: string | null } | Receipt,
  ) {
    if (!mounted.current) return;
    const receipt =
      "outcome" in value && typeof value.outcome === "object"
        ? value.outcome
        : (value as Receipt);
    if (receipt.outcome === "REJECTED")
      setError(
        `Action declined: ${label(receipt.reason ?? "unavailable")}. Review the latest registration state.`,
      );
    else {
      const name = draft?.name ?? "Team";
      setDraft(null);
      setReason("");
      if ("issued_code" in value && typeof value.issued_code === "string") {
        setIssued({
          code: value.issued_code,
          team: receipt.result_team_id!,
          name,
        });
        setReveal(false);
        setCopyMessage("");
      } else if (receipt.action === "REVOKE")
        setNotice("Team code revoked. No replacement code was issued.");
      else
        setNotice(
          `Team ${receipt.result_team_id} confirmed. Code delivery unavailable; deliberately rotate its code if a new code is needed.`,
        );
    }
    await refresh.current(true);
  }
  async function send() {
    const note =
      reason.trim() ||
      (draft?.action === "CREATE"
        ? `Register team ${draft.name}.`
        : `${draft?.action} team access code.`);
    if (locked || !draft || !data || stateChanged || !valid(note, 1024)) return;
    const d = draft;
    setConfirm(false);

    setBusy(true);
    setError("");
    try {
      await acknowledge(
        await command.current!.send(
          d.target
            ? `${base}/${d.target}/${d.action.toLowerCase()}-code`
            : base,
          {
            expected_revision: d.revision,
            reason: note,

            ...(!d.target
              ? { team_name: d.name, member_one: d.one, member_two: d.two }
              : {}),
          },
          "/api/v1/staff/outcomes/teams",
        ),
      );
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
    try {
      const receipt = await command.current!.recover();
      if (receipt) await acknowledge(receipt);
      else
        setError(
          "The original command is not confirmed. No new command was sent.",
        );
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function copyCode() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopyMessage("Team code copied.");
    } catch {
      setCopyMessage(
        "Clipboard unavailable. Select the code to copy it privately.",
      );
    }
  }
  if (importing)
    return (
      <TeamImport
        api={api}
        available={available}
        close={() => {
          setImporting(false);
          void refresh.current();
        }}
      />
    );
  return (
    <section className="staff-section staff-access staff-teams">
      <div className="staff-section-heading">
        <div>
          <span className="eyebrow">PARTICIPANTS</span>
          <h2>Teams</h2>
          <p className="muted">
            Add two members manually, or import your registration CSV. Each team
            receives one private 8-character code.
          </p>
        </div>
        <span>
          {data
            ? search
              ? `${data.matched} matching / ${data.total} registered`
              : `${data.total} / 1,000`
            : ""}
        </span>
        <IconButton
          title="Refresh teams"
          disabled={loading || busy}
          onClick={() => {
            setError("");
            void refresh.current();
          }}
        >
          <RefreshCw size={17} />
        </IconButton>
        <button
          className="primary"
          disabled={locked || !!draft || !data || data.total >= 1000}
          onClick={() =>
            choose({
              action: "CREATE",
              target: null,
              revision: data!.control_revision,
              name: "",
              one: "",
              two: "",
            })
          }
        >
          <Plus size={16} />
          Add team manually
        </button>
        <button
          disabled={locked || !!draft || !data}
          onClick={() => setImporting(true)}
        >
          <Upload size={16} />
          Import CSV
        </button>
      </div>
      <form
        className="staff-team-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (locked || loading || draft || !searchValid) return;
          const next = searchDraft.trim();
          setError("");
          if (next === search && !cursor) void refresh.current();
          else {
            setSearch(next);
            setCursors([undefined]);
          }
        }}
      >
        <label>
          Find team
          <input
            type="search"
            maxLength={120}
            value={searchDraft}
            disabled={locked || loading || !!draft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="icon-button"
          title="Search teams"
          aria-label="Search teams"
          disabled={locked || loading || !!draft || !searchValid}
        >
          <Search size={17} />
        </button>
        <IconButton
          title="Clear team search"
          disabled={locked || loading || !!draft || (!searchDraft && !search)}
          onClick={() => {
            setError("");
            setSearchDraft("");
            setSearch("");
            setCursors([undefined]);
          }}
        >
          <X size={17} />
        </IconButton>
      </form>
      {!searchValid && (
        <p className="error" role="alert">
          Search must fit within 120 UTF-8 bytes and contain no NUL characters.
        </p>
      )}
      {error && (
        <div className="staff-message error" role="alert">
          {error}
          <IconButton title="Dismiss team error" onClick={() => setError("")}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {notice && (
        <p className="staff-message" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">Awaiting team command receipt...</p>}
      {!busy && command.current.unresolved && (
        <div className="staff-message warning" role="alert">
          Team command outcome unconfirmed.
          <button disabled={!available} onClick={() => void recover()}>
            <RefreshCw size={16} />
            Check original team command
          </button>
        </div>
      )}
      {draft && (
        <form
          className="staff-access-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !locked &&
              data &&
              !stateChanged &&
              (!reason || valid(reason, 1024))
            ) {
              if (draft.action === "CREATE") void send();
              else setConfirm(true);
            }
          }}
        >
          <h3>
            {draft.target
              ? `${draft.action === "REVOKE" ? "Revoke code" : draft.action === "ISSUE" ? "Issue new code" : "Rotate code"}: ${draft.name}`
              : "Add a team"}
          </h3>
          {draft.target && (
            <small className="staff-reference">
              {draft.target} / code version {draft.revision}
            </small>
          )}
          <fieldset disabled={locked}>
            {!draft.target && (
              <>
                {(["name", "one", "two"] as const).map((field, i) => (
                  <label key={field}>
                    {["Team name", "Member 1 name", "Member 2 name"][i]}
                    <input
                      required
                      maxLength={120}
                      value={draft[field]}
                      onChange={(e) =>
                        setDraft({ ...draft, [field]: e.target.value })
                      }
                    />
                  </label>
                ))}
                {[draft.name, draft.one, draft.two].some(
                  (s) => s && !valid(s),
                ) && (
                  <p className="error" role="alert">
                    Each name must contain 1 to 120 UTF-8 bytes and no NUL
                    characters.
                  </p>
                )}
              </>
            )}

            <details className="staff-note">
              <summary>Add a note (optional)</summary>
              <label>
                Registration note
                <textarea
                  aria-label="Registration note"
                  maxLength={1024}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <small className="field-note">
                Who made the change and when are recorded automatically.
              </small>
            </details>
            {stateChanged && (
              <div className="staff-message warning">
                The registration state changed.
                {!accessChanged && observed !== undefined && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, revision: observed })}
                  >
                    <RefreshCw size={16} />
                    Use latest registration state
                  </button>
                )}
                {accessChanged && (
                  <span>
                    Code availability changed. Cancel this change and select the
                    intended action again.
                  </span>
                )}
              </div>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => setDiscard(true)}>
                <X size={16} />
                Cancel registration change
              </button>
              <button
                className="primary"
                disabled={
                  (!!reason && !valid(reason, 1024)) ||
                  !data ||
                  stateChanged ||
                  (!draft.target &&
                    ![draft.name, draft.one, draft.two].every((s) => valid(s)))
                }
              >
                <Save size={16} />
                {draft.action === "CREATE"
                  ? "Create team"
                  : "Review team change"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!data && (
        <p role="status">
          {loading ? "Loading teams..." : "Team registrations unavailable."}
        </p>
      )}
      {data && (
        <>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Members</th>
                  <th>Code</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!data.items.length && (
                  <tr>
                    <td colSpan={4} className="staff-empty">
                      <strong>
                        {search ? "No matching teams" : "Add your first team"}
                      </strong>
                      <p>
                        {search
                          ? "Try a team name, member name or registration reference."
                          : "Use Add team manually above. You can select registered teams in Arena setup."}
                      </p>
                    </td>
                  </tr>
                )}
                {data.items.map((team) => (
                  <tr key={team.team_id} data-team-id={team.team_id}>
                    <td>
                      {team.team_name}
                      {team.registration_id && (
                        <small>{team.registration_id}</small>
                      )}
                      <small title={team.team_id}>
                        Reference {team.team_id.slice(0, 8)}
                      </small>
                    </td>
                    <td>
                      {team.members.map((m) => (
                        <div key={m.member_id}>
                          {m.position}. {m.member_name}
                          <small>{m.member_id}</small>
                        </div>
                      ))}
                    </td>
                    <td>
                      {team.has_active_code
                        ? `Version ${team.code_version}`
                        : "No active code"}
                    </td>
                    <td>
                      <IconButton
                        title={`${team.has_active_code ? "Rotate" : "Issue"} team code for ${team.team_name}`}
                        disabled={
                          locked || !!draft || team.members.length !== 2
                        }
                        onClick={() =>
                          codeChange(
                            team,
                            team.has_active_code ? "ROTATE" : "ISSUE",
                          )
                        }
                      >
                        <KeyRound size={17} />
                      </IconButton>
                      <IconButton
                        title={`Revoke team code for ${team.team_name}`}
                        disabled={locked || !!draft || !team.has_active_code}
                        onClick={() => codeChange(team, "REVOKE")}
                      >
                        <Ban size={17} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length && <p>No teams on this page.</p>}
          <nav
            className="staff-pagination"
            aria-label="Team registration pages"
          >
            <IconButton
              title="Previous team page"
              disabled={locked || loading || !!draft || cursors.length === 1}
              onClick={() => setCursors((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {cursors.length}</span>
            <IconButton
              title="Next team page"
              disabled={locked || loading || !!draft || !data.next_after}
              onClick={() => setCursors((v) => [...v, data.next_after!])}
            >
              <ArrowRight size={16} />
            </IconButton>
          </nav>
        </>
      )}
      {confirm && draft && (
        <Modal
          title="Confirm team change"
          close={() => {
            setConfirm(false);
          }}
        >
          <p>
            <strong>{draft.name}</strong>
          </p>
          <p>
            {draft.action === "REVOKE"
              ? "Revoke team code"
              : draft.action === "ISSUE"
                ? "Issue a new team code"
                : draft.action === "ROTATE"
                  ? "Rotate team code"
                  : "Register team"}
          </p>
          {draft.target ? (
            <>
              <p className="staff-reference">{draft.target}</p>
              <p className="notice">
                Both members' current sessions and browser handoffs will be
                revoked. Languages, scores and history remain unchanged.
              </p>
              {draft.action === "REVOKE" && (
                <p className="notice">
                  No replacement code will be issued. New sign-ins remain
                  unavailable until a new code is deliberately issued.
                </p>
              )}
              {draft.action === "ISSUE" && (
                <p className="notice">
                  Previously revoked sessions remain invalid. Issuing a code
                  does not clear access blocks or change enrolment.
                </p>
              )}
            </>
          ) : (
            <p>
              {draft.one} / {draft.two}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setConfirm(false);
                }}
              >
                Back
              </button>
              <button
                className={draft.action === "REVOKE" ? "danger" : "primary"}
                disabled={locked || !data || stateChanged}
              >
                Confirm team change
              </button>
            </div>
          </form>
        </Modal>
      )}
      {discard && (
        <Modal
          title="Discard registration changes?"
          close={() => setDiscard(false)}
        >
          <p>Unsent registration changes will be discarded.</p>
          <div className="dialog-actions">
            <button onClick={() => setDiscard(false)}>Keep editing</button>
            <button
              onClick={() => {
                setDraft(null);
                setReason("");

                setDiscard(false);
              }}
            >
              Discard registration changes
            </button>
          </div>
        </Modal>
      )}
      {issued && (
        <Modal
          title="New team code"
          close={() => {
            setIssued(null);
            setReveal(false);
          }}
        >
          <p>
            <strong>{issued.name}</strong>
          </p>
          <p className="staff-reference">{issued.team}</p>
          <p className="notice">
            Shown once. Distribute privately before closing.
          </p>
          <label>
            Issued team code
            <input
              readOnly
              autoComplete="off"
              type={reveal ? "text" : "password"}
              value={issued.code}
            />
          </label>
          {copyMessage && <p role="status">{copyMessage}</p>}
          <div className="dialog-actions">
            <IconButton
              title={reveal ? "Hide team code" : "Reveal team code"}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
            </IconButton>
            <IconButton title="Copy team code" onClick={() => void copyCode()}>
              <Copy size={17} />
            </IconButton>
            <button
              onClick={() => {
                setIssued(null);
                setReveal(false);
              }}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
