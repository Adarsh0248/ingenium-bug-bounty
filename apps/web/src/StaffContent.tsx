import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ClipboardCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { ApiError, Command, errorText } from "./api";
import type { Api } from "./api";
import type {
  ContentAction,
  ContentDetail,
  ContentPayload,
  ContentSummary,
  Preparation,
  SnapshotPlan,
  Witness,
} from "./content-types";
import type { Page } from "./staff-types";
import type { Language } from "./types";
import { label, languages } from "./types";
import { TextField, contentTextError } from "./content-fields";
import { IconButton, Modal } from "./ui";
import ContentValidation from "./ContentValidation";

type Section =
  "METADATA" | "VARIANT" | "CASE" | "HINT" | "WITNESSES" | "REVIEW";
type Edit = {
  action: ContentAction;
  target: string;
  revision: string;
  payload: ContentPayload;
  original: string;
};
const base = "/api/v1/staff/content";
const metadata = (v?: ContentDetail) => ({
  title: v?.title ?? "",
  statement: v?.statement ?? "",
  difficulty: v?.difficulty ?? 50,
  category: v?.category ?? "ARRAYS",
  checker_mode: v?.checker_mode ?? "TOKENS",
});
const emptyVariant = (language: Language) => ({
  language,
  starter_code: "",
  reference_solution_code: "",
  defect_description: "",
  runtime_key: null,
  cpu_time_limit_ms: null,
  wall_time_limit_ms: null,
  memory_limit_kb: null,
});

export default function StaffContent({
  api,
  available,
  blockNavigation,
}: {
  api: Api;
  available: boolean;
  blockNavigation: (blocked: boolean) => void;
}) {
  const [list, setList] = useState<
      (Page<ContentSummary> & { control_revision: string }) | null
    >(null),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [detail, setDetail] = useState<ContentDetail | null>(null),
    [section, setSection] = useState<Section>("METADATA"),
    [language, setLanguage] = useState<Language>("cpp"),
    [edit, setEdit] = useState<Edit | null>(null),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [discard, setDiscard] = useState(false),
    [preparation, setPreparation] = useState<Preparation | null>(null),
    [plan, setPlan] = useState<SnapshotPlan | null>(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [importing, setImporting] = useState(false),
    [validationBlocked, setValidationBlocked] = useState(false),
    [denied, setDenied] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [, render] = useState(0);
  const mounted = useRef(true),
    generation = useRef(0),
    command = useRef<Command | null>(null),
    sent = useRef<ContentAction | null>(null),
    cursor = cursors.at(-1);
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const unresolved = command.current.unresolved,
    locked = !available || denied || busy || unresolved || loading || importing,
    blocked = !!edit || busy || unresolved || loading || validationBlocked,
    dirty = !!edit && JSON.stringify(edit.payload) !== edit.original,
    readOnly = detail?.publication_status === "PUBLISHED";

  function fail(e: unknown) {
    if (!mounted.current) return;
    if (e instanceof ApiError && [401, 403].includes(e.status)) {
      generation.current++;
      setList(null);
      setDetail(null);
      setEdit(null);
      setPlan(null);
      setPreparation(null);
      setConfirm(false);
      setReason("");
      setDenied(true);
    }
    setError(errorText(e));
  }
  async function catalogue() {
    const value = await api.request<NonNullable<typeof list>>(
      `${base}/versions${cursor ? `?after=${cursor}` : ""}`,
      undefined,
      "STAFF",
    );
    if (mounted.current) {
      setList(value);
      setDenied(false);
    }
  }
  async function readVersion(id: string) {
    const value = await api.request<ContentDetail>(
      `${base}/versions/${id}`,
      undefined,
      "STAFF",
    );
    if (mounted.current) setDetail(value);
    return value;
  }
  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void catalogue()
      .catch(fail)
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, [cursor]);
  useEffect(() => {
    blockNavigation(blocked);
  }, [blocked]);
  useEffect(() => () => blockNavigation(false), []);

  function begin(
    action: ContentAction,
    target: string,
    revision: string,
    payload: ContentPayload,
  ) {
    setEdit({
      action,
      target,
      revision,
      payload,
      original: JSON.stringify(payload),
    });
    setReason("");
    setError("");
    setNotice("");
  }
  function update(patch: ContentPayload) {
    setEdit((old) =>
      old ? { ...old, payload: { ...old.payload, ...patch } } : null,
    );
  }
  async function open(id: string) {
    if (locked || edit || validationBlocked) return;
    setLoading(true);
    setError("");
    setDetail(null);
    setPreparation(null);
    setPlan(null);
    setSection("METADATA");
    try {
      await readVersion(id);
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  async function privateEdit(
    action: "VARIANT" | "CASE" | "HINT" | "WITNESSES",
    target?: string | number,
  ) {
    if (locked || edit || !detail) return;
    const current = ++generation.current,
      id = detail.version_id;
    setLoading(true);
    setError("");
    try {
      // Read the revision before private bytes; any intervening edit makes the save stale.
      const observed = await readVersion(id);
      let payload: ContentPayload;
      if (
        action === "VARIANT" &&
        !observed.variants.some((v) => v.language === language)
      )
        payload = emptyVariant(language);
      else if (action === "CASE" && !target)
        payload = {
          case_id: null,
          position:
            Array.from({ length: 20 }, (_, i) => i + 1).find(
              (i) => !observed.cases.some((c) => c.position === i),
            ) ?? 20,
          visibility: "HIDDEN",
          input_data: "",
          expected_output: "",
        };
      else {
        const suffix =
          action === "VARIANT"
            ? `variants/${language}`
            : action === "CASE"
              ? `cases/${target}`
              : action === "HINT"
                ? "hints"
                : "witnesses";
        const { data } = await api.request<{ data: any }>(
          `${base}/versions/${id}/${suffix}`,
          undefined,
          "STAFF",
        );
        if (action === "VARIANT") {
          const { variant_id: _id, ...fields } = data;
          payload = fields;
        } else if (action === "CASE") payload = data;
        else if (action === "HINT")
          payload = {
            level: target,
            content: data.find((h: any) => h.level === target)?.content ?? "",
          };
        else
          payload = {
            language,
            witnesses: data
              .filter((w: any) => w.language === language)
              .map(
                ({ check_type, test_case_id, expected_failure }: Witness) => ({
                  check_type,
                  test_case_id,
                  expected_failure,
                }),
              ),
          };
      }
      if (mounted.current && current === generation.current)
        begin(action, id, observed.content_revision, payload);
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  async function acknowledge(receipt: any) {
    if (!mounted.current) return;
    const action = sent.current;
    sent.current = null;
    if (action === "PREPARE") {
      setPreparation(receipt);
      setPlan(null);
    }
    if (receipt.outcome === "REJECTED") {
      setError(`Action declined: ${label(receipt.reason ?? "unavailable")}.`);
      if (action === "PREPARE") setEdit(null);
    } else {
      setNotice(
        `${action === "PREPARE" ? "Snapshot" : "Draft"}: ${label(receipt.outcome)}.`,
      );
      setEdit(null);
      setReason("");
      setPreparation(action === "PREPARE" ? receipt : null);
      setPlan(null);
      if (receipt.version_id) await readVersion(receipt.version_id);
      await catalogue();
    }
  }
  async function save() {
    if (
      locked ||
      !edit ||
      !reason.trim() ||
      contentTextError(reason, 1024, true)
    )
      return;
    const chosen = edit;
    sent.current = chosen.action;
    setConfirm(false);
    setBusy(true);
    setError("");
    const path =
      chosen.action === "CREATE"
        ? `${base}/definitions`
        : chosen.action === "NEW_VERSION"
          ? `${base}/definitions/${chosen.target}/versions`
          : `${base}/versions/${chosen.target}/${chosen.action === "PREPARE" ? "prepare-validation" : chosen.action}`;
    const outcome =
      chosen.action === "PREPARE"
        ? `/api/v1/staff/outcomes/validation-preparation/${chosen.target}`
        : `/api/v1/staff/outcomes/content/${chosen.action}/${chosen.target}`;
    try {
      await acknowledge(
        await command.current!.send(
          path,
          {
            expected_revision: chosen.revision,
            reason,
            ...(chosen.action === "PREPARE" ? {} : { payload: chosen.payload }),
          },
          outcome,
        ),
      );
    } catch (e) {
      fail(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function recover() {
    if (busy || !available) return;
    setBusy(true);
    setError("");
    try {
      const value = await command.current!.recover();
      if (value) await acknowledge(value);
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
  function cancel() {
    if (busy || unresolved) return;
    if (dirty) setDiscard(true);
    else {
      setEdit(null);
      setConfirm(false);
      setReason("");
    }
  }
  const p = edit?.payload;
  const invalid =
    !!p &&
    (Object.entries(p).some(
      ([key, v]) =>
        typeof v === "string" &&
        contentTextError(
          v,
          key === "title"
            ? 160
            : key === "statement"
              ? 65536
              : ["starter_code", "reference_solution_code"].includes(key)
                ? 131072
                : ["input_data", "expected_output"].includes(key)
                  ? 1048576
                  : 16384,
          ["title", "statement", "defect_description", "content"].includes(key),
        ),
    ) ||
      (["CREATE", "NEW_VERSION", "METADATA"].includes(edit!.action) &&
        (!p.title.trim() ||
          !Number.isInteger(p.difficulty) ||
          p.difficulty < 1 ||
          p.difficulty > 100)) ||
      (edit!.action === "CASE" &&
        (!Number.isInteger(p.position) || p.position < 1 || p.position > 20)) ||
      (edit!.action === "VARIANT" &&
        p.runtime_key !== null &&
        (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(p.runtime_key) ||
          !Number.isInteger(p.cpu_time_limit_ms) ||
          p.cpu_time_limit_ms < 1 ||
          p.cpu_time_limit_ms >
            (["c", "cpp"].includes(p.language) ? 2000 : 4000) ||
          !Number.isInteger(p.wall_time_limit_ms) ||
          p.wall_time_limit_ms < p.cpu_time_limit_ms ||
          p.wall_time_limit_ms >
            (["c", "cpp"].includes(p.language) ? 10000 : 15000) ||
          !Number.isInteger(p.memory_limit_kb) ||
          p.memory_limit_kb < 1 ||
          p.memory_limit_kb > 524288)) ||
      (edit!.action === "WITNESSES" &&
        (new Set(
          p.witnesses.map((w: Witness) => w.test_case_id ?? "COMPILATION"),
        ).size !== p.witnesses.length ||
          p.witnesses.some(
            (w: Witness) => w.check_type === "TEST_CASE" && !w.test_case_id,
          ))));
  const field = (
    name: string,
    key: string,
    max: number,
    prose = false,
    code = false,
  ) => (
    <TextField
      name={name}
      value={p?.[key] ?? ""}
      max={max}
      prose={prose}
      code={code}
      disabled={locked}
      change={(value) => update({ [key]: value })}
      fail={setError}
      reading={setImporting}
    />
  );

  return (
    <section className="staff-section staff-content">
      <div className="staff-section-heading">
        <h2>Bug library</h2>
        <div className="staff-row-actions">
          <IconButton
            title="Refresh bug library"
            disabled={locked || !!edit || validationBlocked}
            onClick={() => {
              setLoading(true);
              void catalogue()
                .catch(fail)
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCw size={17} />
          </IconButton>
          <button
            disabled={locked || !!edit || validationBlocked || !list}
            onClick={() => {
              setDetail(null);
              setPreparation(null);
              setPlan(null);
              begin("CREATE", "catalogue", list!.control_revision, {
                round_type: 1,
                ...metadata(),
              });
            }}
          >
            <Plus size={16} />
            New bug
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {unresolved && (
        <div className="staff-message warning">
          <span>Save outcome unknown</span>
          <button disabled={busy || !available} onClick={() => void recover()}>
            <RefreshCw size={16} />
            Check original receipt
          </button>
        </div>
      )}
      {!detail && !edit && (
        <>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bug</th>
                  <th>Round</th>
                  <th>Version</th>
                  <th>Difficulty</th>
                  <th>Bounty</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list?.items.map((v) => (
                  <tr key={v.version_id} data-version-id={v.version_id}>
                    <td>{v.title}</td>
                    <td>{v.round_type}</td>
                    <td>{v.version_number}</td>
                    <td>{v.difficulty} / 100</td>
                    <td>{v.base_bounty}</td>
                    <td>{label(v.publication_status)}</td>
                    <td>
                      <IconButton
                        title={`Open ${v.title} version ${v.version_number}`}
                        disabled={locked}
                        onClick={() => void open(v.version_id)}
                      >
                        <ArrowRight size={17} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list?.items.length === 0 && <p className="muted">No bugs yet.</p>}
          <div className="staff-pagination">
            <IconButton
              title="Previous bug page"
              disabled={locked || cursors.length === 1}
              onClick={() => setCursors((v) => v.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {cursors.length}</span>
            <IconButton
              title="Next bug page"
              disabled={locked || !list?.next_after}
              onClick={() => setCursors((v) => [...v, list!.next_after!])}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
        </>
      )}
      {detail && (
        <>
          <div className="staff-section-heading">
            <div>
              <h3>{detail.title}</h3>
              <p className="muted">
                Round {detail.round_type} / Version {detail.version_number} /
                Revision {detail.content_revision} /{" "}
                {label(detail.publication_status)}
              </p>
            </div>
            <div className="staff-row-actions">
              <button
                disabled={locked || !!edit || validationBlocked}
                onClick={() => {
                  setDetail(null);
                  setPreparation(null);
                  setPlan(null);
                }}
              >
                <ArrowLeft size={16} />
                Library
              </button>
              <button
                disabled={locked || !!edit || validationBlocked}
                onClick={() =>
                  begin(
                    "NEW_VERSION",
                    detail.definition_id,
                    detail.definition_revision,
                    metadata(detail),
                  )
                }
              >
                <Plus size={16} />
                New version
              </button>
            </div>
          </div>
          <nav className="tabs content-tabs" aria-label="Bug sections">
            {(
              [
                "METADATA",
                "VARIANT",
                "CASE",
                "HINT",
                "WITNESSES",
                "REVIEW",
              ] as Section[]
            ).map((s) => (
              <button
                key={s}
                aria-current={section === s ? "page" : undefined}
                disabled={locked || !!edit || validationBlocked}
                onClick={() => setSection(s)}
              >
                {
                  {
                    METADATA: "Details",
                    VARIANT: "Languages",
                    CASE: "Test cases",
                    HINT: "Hints",
                    WITNESSES: "Starter failures",
                    REVIEW: "Validation",
                  }[s]
                }
              </button>
            ))}
          </nav>
          {!edit && section === "METADATA" && (
            <div className="content-preview">
              <dl>
                <dt>Difficulty</dt>
                <dd>{detail.difficulty} / 100</dd>
                <dt>Bounty</dt>
                <dd>{detail.base_bounty}</dd>
                <dt>Checker</dt>
                <dd>{label(detail.checker_mode)}</dd>
              </dl>
              <pre>{detail.statement || "No statement"}</pre>
              <button
                disabled={
                  locked || readOnly || validationBlocked || !detail.category
                }
                onClick={() =>
                  begin(
                    "METADATA",
                    detail.version_id,
                    detail.content_revision,
                    metadata(detail),
                  )
                }
              >
                <Pencil size={16} />
                Edit details
              </button>
            </div>
          )}
          {!edit && (section === "VARIANT" || section === "WITNESSES") && (
            <div className="content-preview">
              <label>
                Language
                <select
                  aria-label="Language"
                  disabled={locked}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  {Object.entries(languages).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {detail.variants.some((v) => v.language === language)
                  ? "Variant saved"
                  : "No variant saved"}
              </p>
              {section === "VARIANT" && (
                <div className="staff-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Language</th>
                        <th>Starter bytes</th>
                        <th>Reference bytes</th>
                        <th>Runtime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.variants.map((v) => (
                        <tr key={v.language}>
                          <td>{languages[v.language]}</td>
                          <td>{v.starter_bytes}</td>
                          <td>{v.reference_bytes}</td>
                          <td>{v.runtime_key ?? "Unconfigured"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                disabled={
                  locked ||
                  (section === "WITNESSES" &&
                    !detail.variants.some((v) => v.language === language))
                }
                onClick={() => void privateEdit(section)}
              >
                <Pencil size={16} />
                {readOnly ? "Inspect" : "Edit"}{" "}
                {section === "VARIANT"
                  ? "language variant"
                  : "starter failures"}
              </button>
            </div>
          )}
          {!edit && section === "CASE" && (
            <div className="content-preview">
              <button
                disabled={locked || readOnly || detail.cases.length >= 20}
                onClick={() => void privateEdit("CASE")}
              >
                <Plus size={16} />
                Add test case
              </button>
              <div className="staff-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Visibility</th>
                      <th>Input bytes</th>
                      <th>Answer bytes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.cases.map((c, i) => (
                      <tr key={c.case_id} data-case-id={c.case_id}>
                        <td>{c.position}</td>
                        <td>{label(c.visibility)}</td>
                        <td>{c.input_bytes}</td>
                        <td>{c.expected_bytes}</td>
                        <td>
                          <div className="staff-row-actions">
                            <IconButton
                              title={`Open case ${c.position}`}
                              disabled={locked}
                              onClick={() =>
                                void privateEdit("CASE", c.case_id)
                              }
                            >
                              <Pencil size={16} />
                            </IconButton>
                            {[-1, 1].map((direction) => (
                              <IconButton
                                key={direction}
                                title={`${direction < 0 ? "Move up" : "Move down"} case ${c.position}`}
                                disabled={
                                  locked ||
                                  readOnly ||
                                  i + direction < 0 ||
                                  i + direction >= detail.cases.length
                                }
                                onClick={() => {
                                  const ids = detail.cases.map(
                                    (x) => x.case_id,
                                  );
                                  [ids[i], ids[i + direction]] = [
                                    ids[i + direction],
                                    ids[i],
                                  ];
                                  begin(
                                    "REORDER_CASES",
                                    detail.version_id,
                                    detail.content_revision,
                                    { case_ids: ids },
                                  );
                                }}
                              >
                                {direction < 0 ? (
                                  <ArrowUp size={16} />
                                ) : (
                                  <ArrowDown size={16} />
                                )}
                              </IconButton>
                            ))}
                            <IconButton
                              title={`Retire case ${c.position}`}
                              disabled={locked || readOnly}
                              onClick={() =>
                                begin(
                                  "DELETE_CASE",
                                  detail.version_id,
                                  detail.content_revision,
                                  { case_id: c.case_id },
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!edit && section === "HINT" && (
            <div className="content-preview content-hints">
              {[1, 2, 3].map((level) => (
                <div key={level}>
                  <strong>Hint {level}</strong>
                  <span>
                    {detail.hints.find((h) => h.level === level)
                      ?.content_bytes ?? 0}{" "}
                    bytes
                  </span>
                  <button
                    disabled={locked}
                    onClick={() => void privateEdit("HINT", level)}
                  >
                    <Pencil size={16} />
                    {readOnly ? "Inspect" : "Edit"} hint {level}
                  </button>
                </div>
              ))}
            </div>
          )}
          {!edit && section === "REVIEW" && (
            <div className="content-preview">
              <dl>
                <dt>Language variants</dt>
                <dd>{detail.variants.length} / 5</dd>
                <dt>Sample / hidden cases</dt>
                <dd>
                  {detail.cases.filter((c) => c.visibility === "SAMPLE").length}{" "}
                  /{" "}
                  {detail.cases.filter((c) => c.visibility === "HIDDEN").length}
                </dd>
                <dt>Hints</dt>
                <dd>
                  {detail.hints.filter((h) => h.content_bytes > 0).length} / 3
                </dd>
              </dl>
              <button
                disabled={locked || readOnly || validationBlocked}
                onClick={() =>
                  begin(
                    "PREPARE",
                    detail.version_id,
                    detail.content_revision,
                    {},
                  )
                }
              >
                <ClipboardCheck size={16} />
                Prepare validation
              </button>
              {!detail.category && (
                <p>
                  Choose a question category in Metadata before preparing this
                  version for the map.
                </p>
              )}
              <ContentValidation
                key={detail.version_id}
                api={api}
                version={detail}
                preparedSnapshot={preparation?.snapshot_id}
                available={
                  available && !busy && !unresolved && !denied && !loading
                }
                blockNavigation={setValidationBlocked}
                published={() => readVersion(detail.version_id)}
              />
              {preparation && (
                <div className="content-preparation">
                  <h3>
                    {preparation.snapshot_id
                      ? "Snapshot prepared"
                      : "Preparation declined"}
                  </h3>
                  {preparation.issues.length > 0 && (
                    <ul>
                      {preparation.issues.map((issue, i) => (
                        <li key={i}>
                          {label(issue.code)}
                          {issue.language
                            ? ` / ${languages[issue.language]}`
                            : ""}
                          {issue.hint_level
                            ? ` / Hint ${issue.hint_level}`
                            : ""}
                          {issue.case_id
                            ? ` / Case ${detail.cases.find((c) => c.case_id === issue.case_id)?.position ?? issue.case_id}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preparation.snapshot_id && (
                    <>
                      <p className="staff-reference">
                        {preparation.snapshot_id}
                      </p>
                      <button
                        disabled={locked}
                        onClick={() => {
                          setLoading(true);
                          void api
                            .request<SnapshotPlan>(
                              `${base}/validation-snapshots/${preparation.snapshot_id}/checks`,
                              undefined,
                              "STAFF",
                            )
                            .then((value) => {
                              if (mounted.current) setPlan(value);
                            })
                            .catch(fail)
                            .finally(() => {
                              if (mounted.current) setLoading(false);
                            });
                        }}
                      >
                        Inspect frozen check plan
                      </button>
                    </>
                  )}
                </div>
              )}
              {plan && (
                <div>
                  <p className="staff-reference">
                    Revision {plan.content_revision} / {plan.planned_checks}{" "}
                    checks / {plan.fingerprint}
                  </p>
                  <div className="staff-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Language</th>
                          <th>Source</th>
                          <th>Check</th>
                          <th>Expected result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.checks.map((c) => (
                          <tr key={c.check_id}>
                            <td>{languages[c.language]}</td>
                            <td>{label(c.source_role)}</td>
                            <td>
                              {label(c.check_type)}
                              {c.case_id
                                ? ` / ${detail.cases.find((x) => x.case_id === c.case_id)?.position ?? c.case_id}`
                                : ""}
                            </td>
                            <td>{label(c.expected_result)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {edit && (
        <form
          className="staff-access-form content-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked && !invalid) setConfirm(true);
          }}
        >
          <div className="staff-section-heading">
            <h3>
              {label(edit.action)}
              {p?.language ? ` / ${languages[p.language as Language]}` : ""}
              {p?.level ? ` ${p.level}` : ""}
            </h3>
            <span className="muted">
              Revision {edit.revision}
              {dirty ? " / Unsaved" : ""}
            </span>
          </div>
          <fieldset
            disabled={
              locked ||
              (readOnly && !["NEW_VERSION", "CREATE"].includes(edit.action))
            }
          >
            {["CREATE", "NEW_VERSION", "METADATA"].includes(edit.action) && (
              <>
                {edit.action === "CREATE" && (
                  <label>
                    Round
                    <select
                      aria-label="Round"
                      value={p!.round_type}
                      onChange={(e) =>
                        update({ round_type: Number(e.target.value) })
                      }
                    >
                      <option value={1}>Round 1</option>
                      <option value={2}>Round 2</option>
                    </select>
                  </label>
                )}
                <label>
                  Title
                  <input
                    required
                    value={p!.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
                {field("Statement", "statement", 65536, true)}
                <label>
                  Difficulty
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    step={1}
                    value={p!.difficulty}
                    onChange={(e) =>
                      update({ difficulty: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Question category / habitat
                  <select
                    value={p!.category}
                    onChange={(e) => update({ category: e.target.value })}
                  >
                    <option value="ARRAYS">
                      Neon District — arrays, strings, searching
                    </option>
                    <option value="GRAPHS">
                      Verdant Circuit — graphs, trees, traversal
                    </option>
                    <option value="SYSTEMS">
                      Ember Foundry — memory, references, resources
                    </option>
                    <option value="LOGIC">
                      Cryo Vault — logic, state, concurrency
                    </option>
                  </select>
                </label>
                <output>Bounty: {p!.difficulty * 10}</output>
                <label>
                  Checker
                  <select
                    aria-label="Checker"
                    value={p!.checker_mode}
                    onChange={(e) => update({ checker_mode: e.target.value })}
                  >
                    <option value="TOKENS">Tokens</option>
                    <option value="EXACT_TEXT">Exact text</option>
                  </select>
                </label>
              </>
            )}
            {edit.action === "VARIANT" && (
              <>
                {field("Starter code", "starter_code", 131072, false, true)}
                {field(
                  "Reference solution",
                  "reference_solution_code",
                  131072,
                  false,
                  true,
                )}
                {field(
                  "Private defect description",
                  "defect_description",
                  16384,
                  true,
                )}
                <label className="staff-enabled">
                  <input
                    type="checkbox"
                    checked={p!.runtime_key !== null}
                    onChange={(e) =>
                      update(
                        e.target.checked
                          ? {
                              runtime_key: "",
                              cpu_time_limit_ms: 1000,
                              wall_time_limit_ms: 5000,
                              memory_limit_kb: 262144,
                            }
                          : {
                              runtime_key: null,
                              cpu_time_limit_ms: null,
                              wall_time_limit_ms: null,
                              memory_limit_kb: null,
                            },
                      )
                    }
                  />
                  Runtime configured
                </label>
                {p!.runtime_key !== null && (
                  <>
                    <label>
                      Registered runtime key
                      <input
                        required
                        value={p!.runtime_key}
                        onChange={(e) =>
                          update({ runtime_key: e.target.value })
                        }
                      />
                    </label>
                    {(
                      [
                        [
                          "CPU limit (ms)",
                          "cpu_time_limit_ms",
                          ["c", "cpp"].includes(p!.language) ? 2000 : 4000,
                        ],
                        [
                          "Wall limit (ms)",
                          "wall_time_limit_ms",
                          ["c", "cpp"].includes(p!.language) ? 10000 : 15000,
                        ],
                        ["Memory limit (KiB)", "memory_limit_kb", 524288],
                      ] as const
                    ).map(([name, key, max]) => (
                      <label key={key}>
                        {name}
                        <input
                          type="number"
                          required
                          min={1}
                          max={max}
                          step={1}
                          value={p![key]}
                          onChange={(e) =>
                            update({ [key]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ))}
                  </>
                )}
              </>
            )}
            {edit.action === "CASE" && (
              <>
                <label>
                  Position
                  <input
                    type="number"
                    required
                    min={1}
                    max={20}
                    step={1}
                    value={p!.position}
                    onChange={(e) =>
                      update({ position: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Visibility
                  <select
                    aria-label="Visibility"
                    value={p!.visibility}
                    onChange={(e) => update({ visibility: e.target.value })}
                  >
                    <option value="SAMPLE">Sample</option>
                    <option value="HIDDEN">Hidden</option>
                  </select>
                </label>
                {field("Input", "input_data", 1048576, false, true)}
                {field(
                  "Expected output",
                  "expected_output",
                  1048576,
                  false,
                  true,
                )}
              </>
            )}
            {edit.action === "HINT" &&
              field("Hint text", "content", 16384, true)}
            {edit.action === "WITNESSES" && (
              <>
                {p!.witnesses.map((w: Witness, index: number) => (
                  <div className="content-witness" key={index}>
                    <label>
                      Failure {index + 1}
                      <select
                        aria-label={`Failure ${index + 1}`}
                        value={
                          w.check_type === "COMPILATION"
                            ? "COMPILATION"
                            : (w.test_case_id ?? "")
                        }
                        onChange={(e) =>
                          update({
                            witnesses: p!.witnesses.map(
                              (v: Witness, i: number) =>
                                i !== index
                                  ? v
                                  : e.target.value === "COMPILATION"
                                    ? {
                                        check_type: "COMPILATION",
                                        test_case_id: null,
                                        expected_failure: "COMPILATION_ERROR",
                                      }
                                    : {
                                        check_type: "TEST_CASE",
                                        test_case_id: e.target.value || null,
                                        expected_failure: "WRONG_OUTPUT",
                                      },
                            ),
                          })
                        }
                      >
                        <option value="">Select a case</option>
                        {["c", "cpp", "java"].includes(language) && (
                          <option value="COMPILATION">Compilation</option>
                        )}
                        {detail?.cases.map((c) => (
                          <option key={c.case_id} value={c.case_id}>
                            Case {c.position} / {label(c.visibility)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Expected failure
                      <select
                        aria-label={`Expected failure ${index + 1}`}
                        disabled={w.check_type === "COMPILATION"}
                        value={w.expected_failure}
                        onChange={(e) =>
                          update({
                            witnesses: p!.witnesses.map(
                              (v: Witness, i: number) =>
                                i === index
                                  ? { ...v, expected_failure: e.target.value }
                                  : v,
                            ),
                          })
                        }
                      >
                        {(w.check_type === "COMPILATION"
                          ? ["COMPILATION_ERROR"]
                          : [
                              "WRONG_OUTPUT",
                              "RUNTIME_ERROR",
                              "TIME_LIMIT_EXCEEDED",
                              "MEMORY_LIMIT_EXCEEDED",
                            ]
                        ).map((f) => (
                          <option key={f} value={f}>
                            {label(f)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <IconButton
                      title={`Remove failure ${index + 1}`}
                      disabled={locked}
                      onClick={() =>
                        update({
                          witnesses: p!.witnesses.filter(
                            (_: Witness, i: number) => i !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={p!.witnesses.length >= 3}
                  onClick={() =>
                    update({
                      witnesses: [
                        ...p!.witnesses,
                        {
                          check_type: "TEST_CASE",
                          test_case_id: detail?.cases[0]?.case_id ?? null,
                          expected_failure: "WRONG_OUTPUT",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  Add starter failure
                </button>
              </>
            )}
            {edit.action === "DELETE_CASE" && (
              <p>
                Retire case{" "}
                {detail?.cases.find((c) => c.case_id === p!.case_id)?.position}.
                Existing snapshots keep their original bytes.
              </p>
            )}
            {edit.action === "REORDER_CASES" && (
              <ol>
                {p!.case_ids.map((id: string) => (
                  <li key={id}>
                    Case {detail?.cases.find((c) => c.case_id === id)?.position}
                  </li>
                ))}
              </ol>
            )}
            {edit.action === "PREPARE" && (
              <p>
                {detail?.title} / Revision {edit.revision}
              </p>
            )}
            {invalid && (
              <p className="error">
                Correct the field limits, runtime limits or duplicate failure
                declarations before saving.
              </p>
            )}
          </fieldset>
          <div className="dialog-actions">
            <button
              type="button"
              disabled={busy || unresolved}
              onClick={cancel}
            >
              {readOnly && edit.action !== "NEW_VERSION"
                ? "Close inspection"
                : "Cancel edit"}
            </button>
            <button
              className="primary"
              disabled={
                locked || invalid || (readOnly && edit.action !== "NEW_VERSION")
              }
            >
              <Save size={16} />
              {edit.action === "PREPARE" ? "Prepare snapshot" : "Review save"}
            </button>
          </div>
        </form>
      )}
      {loading && <p role="status">Loading library data...</p>}
      {confirm && edit && (
        <Modal
          title={
            edit.action === "PREPARE"
              ? "Prepare frozen validation snapshot"
              : "Confirm draft change"
          }
          close={() => setConfirm(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <p>
              {detail?.title ?? p?.title} / {label(edit.action)} / Revision{" "}
              {edit.revision}
            </p>
            <label>
              Audit reason
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setConfirm(false)}>
                Back to edit
              </button>
              <button
                className="primary"
                disabled={
                  locked ||
                  !reason.trim() ||
                  contentTextError(reason, 1024, true)
                }
              >
                Confirm change
              </button>
            </div>
          </form>
        </Modal>
      )}
      {discard && (
        <Modal
          title="Discard unsaved draft changes?"
          close={() => setDiscard(false)}
        >
          <div className="dialog-actions">
            <button onClick={() => setDiscard(false)}>Keep editing</button>
            <button
              onClick={() => {
                setEdit(null);
                setDiscard(false);
                setConfirm(false);
                setReason("");
                setError("");
              }}
            >
              Discard draft changes
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
