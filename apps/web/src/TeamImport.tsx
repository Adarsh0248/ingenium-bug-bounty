import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Upload,
} from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import { decodeContentFile, textBytes } from "./content-fields";
import { IconButton, Modal } from "./ui";
import { label } from "./types";

type Item = {
  row: number;
  registration_id: string;
  team_id: string | null;
  status: string;
  team_name?: string;
  member_1_name?: string;
  member_2_name?: string;
};
type Preview = {
  csv_digest: string;
  control_revision: string;
  total: number;
  rows: (Item & {
    team_name: string;
    member_1_name: string;
    member_2_name: string;
  })[];
  issues: { row: number; field: string; code: string }[];
  new_count: number;
  existing_count: number;
  can_import: boolean;
  reason: string | null;
};
type Receipt = {
  outcome_id: string;
  outcome: string;
  reason: string | null;
  items: Item[];
};
type Code = { registration_id: string; team_id: string; code: string };
const base = "/api/v1/staff/registrations",
  maxBytes = 1048576,
  columns = "registration_id,team_name,member_1_name,member_2_name";
function download(value: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function TeamImport({
  api,
  available,
  close,
}: {
  api: Api;
  available: boolean;
  close: () => void;
}) {
  const [csv, setCsv] = useState(""),
    [fileName, setFileName] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [result, setResult] = useState<Receipt | null>(null),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(false),
    [reason, setReason] = useState(""),
    [ownCode, setOwnCode] = useState(""),
    [codes, setCodes] = useState<Code[]>([]),
    [reveal, setReveal] = useState(false),
    [discard, setDiscard] = useState(false),
    [denied, setDenied] = useState(false),
    [, render] = useState(0);
  const file = useRef<HTMLInputElement>(null),
    mounted = useRef(true),
    command = useRef<Command | null>(null);
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const locked =
      !available ||
      denied ||
      busy ||
      command.current.unresolved ||
      codes.length > 0,
    items = result?.items ?? preview?.rows ?? [],
    pages = Math.max(1, Math.ceil(items.length / 50));
  function fail(e: unknown) {
    if (!mounted.current) return;
    if (
      e instanceof ApiError &&
      [401, 403].includes(e.status) &&
      e.code !== "STAFF_CONFIRMATION_REQUIRED"
    ) {
      setCsv("");
      setPreview(null);
      setResult(null);
      setCodes([]);
      setOwnCode("");
      setConfirm(false);
      setDenied(true);
    }
    setError(errorText(e));
  }
  async function readFile(selected: File) {
    if (locked) return;
    setBusy(true);
    setError("");
    setNotice("");
    setPreview(null);
    setResult(null);
    setCsv("");
    setFileName(selected.name);
    setPage(0);
    try {
      if (selected.size > maxBytes)
        throw Error("CSV files must be at most 1 MiB.");
      const value = decodeContentFile(
        new Uint8Array(await selected.arrayBuffer()),
        maxBytes,
      );
      if (!value) throw Error("Choose a nonempty UTF-8 CSV file.");
      if (mounted.current) setCsv(value);
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "The CSV file could not be read.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function inspect() {
    if (locked || !csv) return;
    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);
    try {
      const value = await api.request<Preview>(
        `${base}/preview`,
        { csv },
        "STAFF",
      );
      if (mounted.current) {
        setPreview(value);
        setPage(0);
      }
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function acknowledge(
    value: { outcome: Receipt; issued_codes: Code[] } | Receipt,
  ) {
    if (!mounted.current) return;
    const r =
      typeof value.outcome === "object" ? value.outcome : (value as Receipt);
    setResult(r);
    setPage(0);
    if (r.outcome === "REJECTED") {
      setPreview(null);
      setError(
        `Import declined: ${label(r.reason ?? "unavailable")}. Preview the file again before a new confirmation.`,
      );
      return;
    }
    const issued = "issued_codes" in value ? value.issued_codes : [];
    setCsv("");
    setPreview(null);
    setReason("");
    setCodes(issued);
    setReveal(false);
    const created = r.items.filter((i) => i.status === "CREATED").length;
    setNotice(
      issued.length
        ? `${created} teams imported. Store the new codes privately.`
        : created
          ? `${created} teams confirmed. Code delivery unavailable; deliberately rotate their codes if new codes are needed.`
          : "All registrations already exist. No teams or codes were created.",
    );
  }
  async function save() {
    if (
      locked ||
      !preview?.can_import ||
      !reason.trim() ||
      textBytes(reason) > 1024 ||
      !ownCode.trim()
    )
      return;
    const code = ownCode;
    setOwnCode("");
    setConfirm(false);
    setBusy(true);
    setError("");
    try {
      acknowledge(
        await command.current!.send(
          `${base}/import`,
          {
            csv,
            csv_digest: preview.csv_digest,
            expected_revision: preview.control_revision,
            reason,
            own_code: code,
          },
          "/api/v1/staff/outcomes/registrations",
        ),
      );
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function recover() {
    if (!available || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await command.current!.recover();
      if (r) acknowledge(r);
      else
        setError(
          "The original import is not confirmed. No new import was sent.",
        );
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="staff-section staff-teams registration-import">
      <div className="staff-section-heading">
        <IconButton
          title="Back to teams"
          disabled={busy || command.current.unresolved || codes.length > 0}
          onClick={() => (csv ? setDiscard(true) : close())}
        >
          <ArrowLeft size={17} />
        </IconButton>
        <h2>Import registrations</h2>
        <span>100 teams / 1 MiB per file</span>
        <button
          disabled={locked}
          onClick={() =>
            download(
              `${columns}\r\nREG-001,Example Team,Member One,Member Two\r\n`,
              "registration-template.csv",
              "text/csv;charset=utf-8",
            )
          }
        >
          <Download size={16} />
          CSV template
        </button>
        <button disabled={locked} onClick={() => file.current?.click()}>
          <Upload size={16} />
          Choose CSV
        </button>
        <input
          ref={file}
          hidden
          type="file"
          aria-label="Registration CSV file"
          accept=".csv,text/csv"
          disabled={locked}
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (chosen) void readFile(chosen);
          }}
        />
      </div>
      {fileName && (
        <p className="staff-reference">
          {fileName}
          {csv ? ` / ${textBytes(csv).toLocaleString()} bytes` : ""}
        </p>
      )}
      {error && (
        <p className="staff-message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="staff-message" role="status">
          {notice}
        </p>
      )}
      {busy && (
        <p role="status">
          {command.current.unresolved
            ? "Awaiting import receipt..."
            : "Checking registrations..."}
        </p>
      )}
      {!busy && command.current.unresolved && (
        <div className="staff-message warning" role="alert">
          Import outcome unconfirmed.
          <button disabled={!available} onClick={() => void recover()}>
            <RefreshCw size={16} />
            Check original import
          </button>
        </div>
      )}
      {csv && (
        <div className="dialog-actions">
          <button disabled={locked} onClick={() => void inspect()}>
            <RefreshCw size={16} />
            Preview registrations
          </button>
          <button
            className="primary"
            disabled={locked || !preview?.can_import}
            onClick={() => setConfirm(true)}
          >
            Review import
          </button>
        </div>
      )}
      {preview && (
        <>
          <p className="registration-counts">
            <span>New: {preview.new_count}</span>
            <span>Unchanged: {preview.existing_count}</span>
            <span>Registered: {preview.total} / 1,000</span>
          </p>
          {preview.reason && (
            <p className="staff-message warning" role="alert">
              Import blocked: {label(preview.reason)}. No teams have been saved.
            </p>
          )}
          {preview.issues.length > 0 && (
            <ul className="registration-issues">
              {preview.issues.map((issue, i) => (
                <li key={i}>
                  {issue.row ? `Record ${issue.row}` : "File"} / {issue.field}:{" "}
                  {label(issue.code)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {items.length > 0 && (
        <>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Record / registration</th>
                  <th>{result ? "Team reference" : "Team / members"}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(page * 50, page * 50 + 50).map((item) => (
                  <tr
                    key={item.registration_id}
                    data-registration-id={item.registration_id}
                  >
                    <td>
                      {item.row}. {item.registration_id}
                    </td>
                    <td>
                      {typeof item.team_name === "string" ? (
                        <>
                          {item.team_name}
                          <small>
                            {item.member_1_name} / {item.member_2_name}
                          </small>
                        </>
                      ) : (
                        (item.team_id ?? "Not created")
                      )}
                    </td>
                    <td>{label(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="staff-pagination" aria-label="Import preview pages">
            <IconButton
              title="Previous import page"
              disabled={page === 0 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>
              Page {page + 1} / {pages}
            </span>
            <IconButton
              title="Next import page"
              disabled={page + 1 >= pages || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              <ArrowRight size={16} />
            </IconButton>
          </nav>
        </>
      )}
      {confirm && preview && (
        <Modal
          title="Confirm registration import"
          close={() => {
            setConfirm(false);
            setOwnCode("");
          }}
        >
          <p>
            {preview.new_count} new teams / {preview.existing_count} unchanged
          </p>
          <p className="notice">
            Existing registrations will not be overwritten. New team codes are
            shown once.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              Import audit reason
              <textarea
                required
                maxLength={1024}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              Your staff code
              <input
                required
                type="password"
                autoComplete="off"
                maxLength={96}
                value={ownCode}
                onChange={(e) => setOwnCode(e.target.value)}
              />
            </label>
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
                disabled={
                  locked ||
                  !ownCode.trim() ||
                  !reason.trim() ||
                  textBytes(reason) > 1024
                }
              >
                Confirm import
              </button>
            </div>
          </form>
        </Modal>
      )}
      {codes.length > 0 && result && (
        <Modal
          title="Imported team codes"
          close={() => {
            setCodes([]);
            setReveal(false);
          }}
        >
          <p className="notice">
            Shown once. Keep the export private; it grants team access.
          </p>
          <div className="dialog-actions">
            <IconButton
              title={reveal ? "Hide imported codes" : "Reveal imported codes"}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
            </IconButton>
            <button
              onClick={() =>
                download(
                  JSON.stringify(
                    { import_id: result.outcome_id, codes },
                    null,
                    2,
                  ),
                  `team-codes-${result.outcome_id}.json`,
                  "application/json",
                )
              }
            >
              <Download size={16} />
              Export private codes
            </button>
          </div>
          <div className="registration-code-list">
            {codes.slice(page * 50, page * 50 + 50).map((code) => (
              <label key={code.registration_id}>
                {code.registration_id}
                <input
                  aria-label={`Code for ${code.registration_id}`}
                  readOnly
                  autoComplete="off"
                  type={reveal ? "text" : "password"}
                  value={code.code}
                />
              </label>
            ))}
          </div>
          <nav className="staff-pagination" aria-label="Imported code pages">
            <IconButton
              title="Previous code page"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>
              Page {page + 1} / {Math.ceil(codes.length / 50)}
            </span>
            <IconButton
              title="Next code page"
              disabled={(page + 1) * 50 >= codes.length}
              onClick={() => setPage((p) => p + 1)}
            >
              <ArrowRight size={16} />
            </IconButton>
          </nav>
          <div className="dialog-actions">
            <button
              onClick={() => {
                setCodes([]);
                setReveal(false);
                setPage(0);
              }}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
      {discard && (
        <Modal title="Discard import preview?" close={() => setDiscard(false)}>
          <p>The unsaved file and preview will be cleared.</p>
          <div className="dialog-actions">
            <button onClick={() => setDiscard(false)}>Keep reviewing</button>
            <button onClick={close}>Discard import preview</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
