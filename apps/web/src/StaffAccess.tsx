import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import type { Page, ReplacementRequest, StaffIdentity } from "./staff-types";
import { label, timeText } from "./types";
import { IconButton, Modal } from "./ui";

type Mode = "STAFF" | "ACCESS";
type Selection = {
  action: "CREATE" | "UPDATE" | "ROTATE" | "APPROVE" | "REJECT";
  revision: string;
  target: string;
  name: string;
  role: "OWNER" | "ORGANISER";
  enabled: boolean;
  team?: string;
};
const bytes = (value: string) => new TextEncoder().encode(value).length;
export default function StaffAccess({
  api,
  mode,
  available,
  now,
  blockNavigation,
}: {
  api: Api;
  mode: Mode;
  available: boolean;
  now: number;
  blockNavigation: (blocked: boolean) => void;
}) {
  const [data, setData] = useState<
      | (Page<StaffIdentity> & { control_revision: string })
      | Page<ReplacementRequest>
      | null
    >(null),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [selection, setSelection] = useState<Selection | null>(null),
    [confirm, setConfirm] = useState(false),
    [discard, setDiscard] = useState(false),
    [reason, setReason] = useState(""),
    [ownCode, setOwnCode] = useState(""),
    [issued, setIssued] = useState<{ code: string; name: string } | null>(null),
    [reveal, setReveal] = useState(false),
    [copyFeedback, setCopyFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [denied, setDenied] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [, render] = useState(0);
  const command = useRef<Command | null>(null),
    mounted = useRef(true),
    generation = useRef(0),
    refresh = useRef<() => Promise<void>>(async () => {}),
    cursor = cursors.at(-1);
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const locked = !available || denied || busy || command.current.unresolved,
    blocked = !!selection || !!issued || busy || command.current.unresolved,
    staffMode = mode === "STAFF",
    title = staffMode ? "Staff access" : "Browser replacements",
    listPath = staffMode
      ? "/api/v1/staff/staff-identities"
      : "/api/v1/staff/replacements";
  refresh.current = async () => {
    const version = ++generation.current;
    setLoading(true);
    try {
      const value = await api.request<typeof data>(
        `${listPath}${cursor ? `?after=${cursor}` : ""}`,
        undefined,
        "STAFF",
      );
      if (!mounted.current || generation.current !== version) return;
      setData(value);
      setDenied(false);
    } catch (e) {
      if (!mounted.current || generation.current !== version) return;
      if (e instanceof ApiError && [401, 403].includes(e.status)) {
        setData(null);
        setSelection(null);
        setIssued(null);
        setOwnCode("");
        setConfirm(false);
        setDenied(true);
      }
      setError(errorText(e));
    } finally {
      if (mounted.current && generation.current === version) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void refresh.current();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh.current();
    }, 15000);
    return () => {
      mounted.current = false;
      generation.current++;
      clearInterval(timer);
    };
  }, [cursor]);
  useEffect(() => {
    blockNavigation(blocked);
  }, [blocked]);
  useEffect(() => () => blockNavigation(false), []);
  function choose(next: Selection) {
    if (locked || selection) return;
    setSelection(next);
    setReason("");
    setOwnCode("");
    setError("");
    setNotice("");
  }
  function edit(identity: StaffIdentity, action: "UPDATE" | "ROTATE") {
    if (identity.role === "SUPER_ADMIN") return;
    choose({
      action,
      revision: identity.revision,
      target: identity.staff_id,
      name: identity.display_name,
      role: identity.role,
      enabled: identity.enabled,
    });
  }
  async function acknowledged(value: any) {
    const receipt = typeof value.outcome === "object" ? value.outcome : value;
    if (receipt.outcome === "REJECTED")
      setError(
        `Action declined: ${label(receipt.reason ?? "unavailable")}. Review the current state.`,
      );
    else {
      setNotice(`${label(receipt.action)}: ${label(receipt.outcome)}`);
      setSelection(null);
      setReason("");
      if (receipt.code_issued) {
        if (typeof value.issued_code === "string") {
          setIssued({
            code: value.issued_code,
            name: receipt.after.display_name,
          });
          setReveal(false);
          setCopyFeedback("");
        } else
          setNotice(
            `Code delivery unavailable for ${receipt.after.display_name}. The identity is confirmed; deliberately rotate its code if a new code is needed.`,
          );
      }
    }
    await refresh.current();
  }
  async function send() {
    if (
      locked ||
      !selection ||
      !reason.trim() ||
      bytes(reason) > 1024 ||
      (staffMode && !ownCode.trim())
    )
      return;
    const chosen = selection,
      code = ownCode;
    setConfirm(false);
    setOwnCode("");
    setBusy(true);
    setError("");
    try {
      const path = staffMode
        ? `/api/v1/staff/staff-identities${chosen.action === "CREATE" ? "" : `/${chosen.target}/${chosen.action === "UPDATE" ? "update" : "rotate-code"}`}`
        : `/api/v1/staff/replacements/${chosen.target}/decision`;
      const outcome = staffMode
        ? `/api/v1/staff/outcomes/staff/${chosen.action}/${chosen.action === "CREATE" ? "security" : chosen.target}`
        : "/api/v1/staff/outcomes/replacements";
      await acknowledged(
        await command.current!.send(
          path,
          {
            expected_revision: chosen.revision,
            reason,
            ...(staffMode
              ? {
                  own_code: code,
                  ...(chosen.action !== "ROTATE"
                    ? {
                        display_name: chosen.name,
                        role: chosen.role,
                        ...(chosen.action === "UPDATE"
                          ? { enabled: chosen.enabled }
                          : {}),
                      }
                    : {}),
                }
              : { action: chosen.action }),
          },
          outcome,
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
      if (receipt) await acknowledged(receipt);
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
      setCopyFeedback("Staff code copied.");
    } catch {
      setCopyFeedback(
        "Clipboard unavailable. Select the code to copy it privately.",
      );
    }
  }
  const editableFields =
      selection && staffMode && selection.action !== "ROTATE",
    validName =
      !editableFields ||
      (!!selection?.name.trim() &&
        bytes(selection.name) <= 120 &&
        !selection.name.includes("\0")),
    requests =
      !staffMode && data ? (data as Page<ReplacementRequest>).items : [],
    identities = staffMode && data ? (data as Page<StaffIdentity>).items : [];
  return (
    <section className="staff-section staff-access">
      <div className="staff-section-heading">
        <h2>{title}</h2>
        <IconButton
          title={`Refresh ${title.toLowerCase()}`}
          disabled={loading || busy}
          onClick={() => void refresh.current()}
        >
          <RefreshCw size={17} />
        </IconButton>
        {staffMode && (
          <button
            disabled={locked || !!selection || !data}
            onClick={() =>
              choose({
                action: "CREATE",
                revision: (data as { control_revision: string })
                  .control_revision,
                target: "security",
                name: "",
                role: "ORGANISER",
                enabled: true,
              })
            }
          >
            <Plus size={16} />
            Add staff
          </button>
        )}
      </div>
      {error && (
        <div className="staff-message error" role="alert">
          {error}
          <IconButton title="Dismiss access error" onClick={() => setError("")}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {notice && (
        <div className="staff-message" role="status">
          {notice}
          <IconButton
            title="Dismiss access confirmation"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </IconButton>
        </div>
      )}
      {busy && command.current.unresolved && (
        <p role="status">Awaiting command receipt...</p>
      )}
      {!busy && command.current.unresolved && (
        <div className="staff-message warning" role="alert">
          <span>Access command outcome unconfirmed.</span>
          <button disabled={!available} onClick={() => void recover()}>
            <RefreshCw size={16} />
            Check original access command
          </button>
        </div>
      )}
      {selection && (
        <form
          className="staff-access-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked && validName) setConfirm(true);
          }}
        >
          <h3>
            {label(selection.action)}: {selection.name || "New staff identity"}
          </h3>
          <small className="staff-reference">
            {selection.target} / revision {selection.revision}
          </small>
          {selection.team && <p>{selection.team}</p>}
          <fieldset disabled={locked}>
            {editableFields && (
              <>
                <label>
                  Staff name
                  <input
                    required
                    maxLength={120}
                    value={selection.name}
                    onChange={(e) =>
                      setSelection({ ...selection, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Staff role
                  <select
                    aria-label="Staff role"
                    value={selection.role}
                    onChange={(e) =>
                      setSelection({
                        ...selection,
                        role: e.target.value as "OWNER" | "ORGANISER",
                      })
                    }
                  >
                    <option value="ORGANISER">Organiser</option>
                    <option value="OWNER">Owner</option>
                  </select>
                </label>
                {selection.action === "UPDATE" && (
                  <label className="staff-enabled">
                    <input
                      type="checkbox"
                      checked={selection.enabled}
                      onChange={(e) =>
                        setSelection({
                          ...selection,
                          enabled: e.target.checked,
                        })
                      }
                    />
                    Enabled
                  </label>
                )}
                {!validName && (
                  <p className="error" role="alert">
                    A staff name must contain 1 to 120 UTF-8 bytes and no NUL
                    characters.
                  </p>
                )}
              </>
            )}
            <label>
              Access audit reason
              <textarea
                required
                maxLength={1024}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setDiscard(true)}>
                <X size={16} />
                Cancel changes
              </button>
              <button
                className="primary"
                disabled={!validName || !reason.trim() || bytes(reason) > 1024}
              >
                <Save size={16} />
                Review access change
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {!data && (
        <p role="status">
          {loading
            ? "Loading access records..."
            : "Access records unavailable."}
        </p>
      )}
      {data && (
        <>
          {!data.items.length && (
            <p>
              No{" "}
              {staffMode ? "staff identities" : "pending browser replacements"}{" "}
              on this page.
            </p>
          )}
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  {(staffMode
                    ? ["Identity", "Role", "Status", "Code", "Actions"]
                    : [
                        "Team / member",
                        "Request",
                        "State",
                        "Expires",
                        "Actions",
                      ]
                  ).map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {identities.map((person) => (
                  <tr key={person.staff_id} data-staff-id={person.staff_id}>
                    <td>
                      {person.display_name}
                      <small>{person.staff_id}</small>
                    </td>
                    <td>{label(person.role)}</td>
                    <td>{person.enabled ? "Enabled" : "Disabled"}</td>
                    <td>
                      {person.has_active_code
                        ? `Version ${person.code_version}`
                        : "No active code"}
                    </td>
                    <td>
                      {person.role !== "SUPER_ADMIN" && (
                        <div className="staff-row-actions">
                          <IconButton
                            title={`Edit staff ${person.display_name}`}
                            disabled={locked || !!selection}
                            onClick={() => edit(person, "UPDATE")}
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            title={`Rotate code for ${person.display_name}`}
                            disabled={locked || !!selection}
                            onClick={() => edit(person, "ROTATE")}
                          >
                            <KeyRound size={16} />
                          </IconButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.map((request) => {
                  const expired = Date.parse(request.expires_at) <= now;
                  return (
                    <tr
                      key={request.request_id}
                      data-request-id={request.request_id}
                    >
                      <td>
                        {request.team_name}
                        <small>{request.member_name}</small>
                      </td>
                      <td>
                        {request.request_id}
                        <small>
                          {new Date(request.created_at).toLocaleString()}
                        </small>
                      </td>
                      <td>{expired ? "Expired" : label(request.state)}</td>
                      <td>{timeText(Date.parse(request.expires_at) - now)}</td>
                      <td>
                        {request.state === "PENDING" && (
                          <div className="staff-row-actions">
                            {(["APPROVE", "REJECT"] as const).map((action) => (
                              <IconButton
                                key={action}
                                title={`${label(action)} replacement for ${request.member_name}`}
                                disabled={locked || !!selection || expired}
                                onClick={() =>
                                  choose({
                                    action,
                                    revision: request.expected_revision,
                                    target: request.request_id,
                                    name: request.member_name,
                                    team: request.team_name,
                                    role: "ORGANISER",
                                    enabled: true,
                                  })
                                }
                              >
                                {action === "APPROVE" ? (
                                  <Check size={16} />
                                ) : (
                                  <X size={16} />
                                )}
                              </IconButton>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav className="staff-pagination" aria-label={`${title} pages`}>
            <IconButton
              title="Previous access page"
              disabled={
                loading ||
                cursors.length === 1 ||
                !!selection ||
                busy ||
                command.current.unresolved
              }
              onClick={() => setCursors((old) => old.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {cursors.length}</span>
            <IconButton
              title="Next access page"
              disabled={
                loading ||
                !data.next_after ||
                !!selection ||
                busy ||
                command.current.unresolved
              }
              onClick={() => setCursors((old) => [...old, data.next_after!])}
            >
              <ArrowRight size={16} />
            </IconButton>
          </nav>
        </>
      )}
      {confirm && selection && (
        <Modal
          title="Confirm access change"
          close={() => {
            setConfirm(false);
            setOwnCode("");
          }}
        >
          <p>
            {label(selection.action)}: <strong>{selection.name}</strong>
          </p>
          <p className="staff-reference">{selection.target}</p>
          {staffMode && selection.action !== "ROTATE" && (
            <p>
              {label(selection.role)} /{" "}
              {selection.enabled ? "Enabled" : "Disabled"}
            </p>
          )}
          {staffMode && selection.action !== "CREATE" && (
            <p className="notice">
              Existing sessions and entry proofs for this identity will be
              revoked.
            </p>
          )}
          {!staffMode && selection.action === "APPROVE" && (
            <p className="notice">
              Approval revokes this member's old session. It does not extend the
              original replacement deadline.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {staffMode && (
              <label>
                Your staff code
                <input
                  type="password"
                  required
                  maxLength={96}
                  autoComplete="off"
                  value={ownCode}
                  onChange={(e) => setOwnCode(e.target.value)}
                />
              </label>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setConfirm(false);
                  setOwnCode("");
                }}
              >
                Back
              </button>
              <button
                className="primary"
                disabled={locked || (staffMode && !ownCode.trim())}
              >
                Confirm access change
              </button>
            </div>
          </form>
        </Modal>
      )}
      {discard && (
        <Modal title="Discard access changes?" close={() => setDiscard(false)}>
          <p>Unsent changes will be discarded.</p>
          <div className="dialog-actions">
            <button onClick={() => setDiscard(false)}>Keep editing</button>
            <button
              onClick={() => {
                setSelection(null);
                setReason("");
                setOwnCode("");
                setDiscard(false);
              }}
            >
              Discard access changes
            </button>
          </div>
        </Modal>
      )}
      {issued && (
        <Modal
          title="New staff code"
          close={() => {
            setIssued(null);
            setReveal(false);
          }}
        >
          <p>
            <strong>{issued.name}</strong>
          </p>
          <p className="notice">Shown once. Store privately before closing.</p>
          <label>
            Issued staff code
            <input
              type={reveal ? "text" : "password"}
              readOnly
              autoComplete="off"
              value={issued.code}
            />
          </label>
          {copyFeedback && <p role="status">{copyFeedback}</p>}
          <div className="dialog-actions">
            <IconButton
              title={reveal ? "Hide staff code" : "Reveal staff code"}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
            </IconButton>
            <IconButton title="Copy staff code" onClick={() => void copyCode()}>
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
