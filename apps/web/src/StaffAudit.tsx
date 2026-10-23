import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, RefreshCw } from "lucide-react";
import { AUDIT_FAMILIES } from "../../api/src/access/audit-policy";
import type {
  AuditFamily,
  StaffAuditItem,
  StaffAuditPage,
} from "../../api/src/access/audit-policy";
import type { Api } from "./api";
import { ApiError, errorText } from "./api";
import { label } from "./types";
import { IconButton, Modal } from "./ui";

export default function StaffAudit({
  api,
  arenaId,
  available,
  superAdmin,
}: {
  api: Api;
  arenaId: string | null;
  available: boolean;
  superAdmin: boolean;
}) {
  const [family, setFamily] = useState<AuditFamily>("ROUND"),
    [scope, setScope] = useState("SELECTED"),
    [pages, setPages] = useState<(string | null)[]>([null]),
    [data, setData] = useState<{ path: string; page: StaffAuditPage } | null>(
      null,
    ),
    [selected, setSelected] = useState<StaffAuditItem | null>(null),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [refresh, setRefresh] = useState(0);
  const arena =
      AUDIT_FAMILIES[family].arena && scope === "SELECTED" ? arenaId : null,
    after = pages.at(-1),
    allowed = available && (!AUDIT_FAMILIES[family].superAdmin || superAdmin),
    path = `/api/v1/staff/audit?family=${family}${arena ? `&arena_id=${arena}` : ""}${after ? `&after=${after}` : ""}`,
    page = allowed && data?.path === path ? data.page : null;
  useEffect(() => {
    setSelected(null);
    setData(null);
    setError("");
    if (!allowed) return;
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    function load() {
      setReading(true);
      void api
        .request<StaffAuditPage>(path, undefined, "STAFF")
        .then((value) => {
          if (!gone) {
            if (value.family !== family || value.arena_id !== arena)
              throw new ApiError("INVALID_CONTEXT");
            setData({ path, page: value });
            setError("");
          }
        })
        .catch((e) => {
          if (!gone) {
            setData(null);
            setSelected(null);
            setError(errorText(e));
          }
        })
        .finally(() => {
          if (!gone) {
            setReading(false);
            timer = setTimeout(load, 5000);
          }
        });
    }
    load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [api, path, allowed, refresh]);
  return (
    <section
      className="staff-section staff-audit"
      aria-label="Staff audit history"
    >
      <div className="staff-section-heading">
        <h2>Audit history</h2>
        <IconButton
          title="Refresh audit history"
          disabled={!allowed || reading}
          onClick={() => {
            setPages([null]);
            setRefresh((v) => v + 1);
          }}
        >
          <RefreshCw size={17} />
        </IconButton>
      </div>
      <div className="audit-filters">
        <label>
          Record category
          <select
            aria-label="Audit category"
            value={family}
            disabled={!available}
            onChange={(e) => {
              setFamily(e.target.value as AuditFamily);
              setPages([null]);
              setSelected(null);
            }}
          >
            {(Object.keys(AUDIT_FAMILIES) as AuditFamily[])
              .filter((key) => !AUDIT_FAMILIES[key].superAdmin || superAdmin)
              .map((key) => (
                <option key={key} value={key}>
                  {AUDIT_FAMILIES[key].label}
                </option>
              ))}
          </select>
        </label>
        {AUDIT_FAMILIES[family].arena && (
          <label>
            Arena scope
            <select
              aria-label="Audit arena scope"
              value={arenaId ? scope : "ALL"}
              disabled={!available || !arenaId}
              onChange={(e) => {
                setScope(e.target.value);
                setPages([null]);
                setSelected(null);
              }}
            >
              <option value="ALL">All arenas</option>
              <option value="SELECTED">Selected arena</option>
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!available && (
        <p role="status" className="muted">
          Audit history unavailable while access is being verified.
        </p>
      )}
      {allowed && reading && !page && !error && (
        <p role="status">Loading audit history...</p>
      )}
      {page && (
        <>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Staff</th>
                  <th>Action</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <tr key={item.id} data-audit-id={item.id}>
                    <td>{new Date(item.recorded_at).toLocaleString()}</td>
                    <td>{item.actor_name}</td>
                    <td>{label(item.action)}</td>
                    <td>{label(item.outcome)}</td>
                    <td className="audit-reason">
                      <span>{item.reason || "Not required"}</span>
                    </td>
                    <td>
                      <IconButton
                        title={`Inspect audit ${item.id}`}
                        onClick={() => setSelected(item)}
                      >
                        <Eye size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!page.items.length && (
            <p className="muted">No records in this scope.</p>
          )}
          <div className="staff-pagination">
            <IconButton
              title="Previous audit page"
              disabled={reading || pages.length === 1}
              onClick={() => {
                setPages((v) => v.slice(0, -1));
                setSelected(null);
              }}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {pages.length}</span>
            <IconButton
              title="Next audit page"
              disabled={reading || !page.next_after}
              onClick={() => {
                setPages((v) => [...v, page.next_after]);
                setSelected(null);
              }}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
        </>
      )}
      {page && selected && (
        <Modal title="Audit record" close={() => setSelected(null)}>
          <dl className="judging-reference">
            <dt>Category</dt>
            <dd>{AUDIT_FAMILIES[family].label}</dd>
            <dt>Record</dt>
            <dd>
              <code>{selected.id}</code>
            </dd>
            <dt>Recorded</dt>
            <dd>{new Date(selected.recorded_at).toLocaleString()}</dd>
            <dt>Staff</dt>
            <dd>
              {selected.actor_name} / <code>{selected.actor_id}</code>
            </dd>
            <dt>Action</dt>
            <dd>{label(selected.action)}</dd>
            <dt>Outcome</dt>
            <dd>{label(selected.outcome)}</dd>
            <dt>Refusal</dt>
            <dd>
              {selected.denial_reason ? label(selected.denial_reason) : "None"}
            </dd>
            <dt>Reason</dt>
            <dd>{selected.reason || "Not required"}</dd>
            <dt>Target</dt>
            <dd>
              <code>{selected.target_id ?? "None"}</code>
            </dd>
            <dt>Arena</dt>
            <dd>
              <code>{selected.arena_id ?? "Global"}</code>
            </dd>
            <dt>Round</dt>
            <dd>
              <code>{selected.round_id ?? "None"}</code>
            </dd>
          </dl>
        </Modal>
      )}
    </section>
  );
}
