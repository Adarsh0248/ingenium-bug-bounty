import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { OperationsStatus } from "../../api/src/maintenance/operations";
import type { Api } from "./api";
import { errorText } from "./api";
import { IconButton } from "./ui";

const names: Record<string, string> = {
  DATABASE_BYTES: "Database size",
  DATABASE_CONNECTIONS: "Database connections",
  WAITING_LOCKS: "Waiting locks",
  OFFICIAL_PENDING: "Pending submissions",
  SAMPLE_PENDING: "Pending sample runs",
  OLDEST_OFFICIAL: "Oldest submission",
  VALIDATION_PENDING: "Pending validations",
  PHYSICAL_HOLDS: "Execution reservations",
  QUARANTINED_EPOCHS: "Quarantined judge epochs",
  OUTBOX_ACCOUNTED_ROWS: "Live delivery obligations",
  OUTBOX_UNPUBLISHED: "Unpublished updates",
  OUTBOX_AGE: "Oldest unpublished update",
  PARTICIPANT_ACCOUNTED_BYTES: "Participant accounted storage",
  QUOTA_KEYS: "Rate-limit keys",
  RETENTION_AGE: "Oldest cleanup scan",
  HOST_CPU_MEMORY_DISK: "Host CPU, memory and disk",
  BACKUP_WAL_CHAIN: "Off-host backup and WAL chain",
  JUDGE_HOST_READINESS: "Installed judge readiness",
  FULL_APP_STORAGE: "Whole-app storage reservation",
  EXTERNAL_UPTIME_ALERTING: "External monitoring and alerts",
};
function amount(value: string | null, unit: string) {
  if (value === null) return "Not observed";
  const n = Number(value);
  return unit === "bytes"
    ? `${(n / 1048576).toFixed(1)} MiB`
    : unit === "ms"
      ? `${(n / 1000).toFixed(1)} s`
      : n.toLocaleString();
}
export default function StaffOperations({
  api,
  available,
}: {
  api: Api;
  available: boolean;
}) {
  const [data, setData] = useState<OperationsStatus | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setData(null);
    setError("");
    setBusy(false);
    if (!available) return;
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      setBusy(true);
      try {
        const result = await api.request<OperationsStatus>(
          "/api/v1/staff/maintenance/operations",
          undefined,
          "STAFF",
        );
        if (!gone) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (!gone) {
          setData(null);
          setError(errorText(e));
        }
      } finally {
        if (!gone) {
          setBusy(false);
          timer = setTimeout(() => void load(), 30000);
        }
      }
    }
    void load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [api, available, refresh]);
  return (
    <section className="staff-section" aria-label="Event operations">
      <div className="staff-section-heading">
        <h2>Operations</h2>
        <IconButton
          title="Refresh operations status"
          disabled={!available || busy}
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
      {!data && !error && (
        <p role="status">
          {available ? "Reading operations..." : "Operations unavailable"}
        </p>
      )}
      {available && data && (
        <>
          <p role="status">
            {data.state === "CRITICAL"
              ? "Critical condition"
              : data.state === "WARNING"
                ? "Needs attention"
                : "Verification incomplete"}{" "}
            · {new Date(data.observed_at).toLocaleString()}
          </p>
          <div className="staff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Measurement</th>
                  <th>Current</th>
                  <th>Capacity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((m) => (
                  <tr key={m.id}>
                    <td>{names[m.id] ?? m.id}</td>
                    <td>{amount(m.value, m.unit)}</td>
                    <td>{m.limit === null ? "--" : amount(m.limit, m.unit)}</td>
                    <td>
                      {m.state === "OK"
                        ? "Observed"
                        : m.state === "UNKNOWN"
                          ? "Not observed"
                          : m.state === "CRITICAL"
                            ? "Critical"
                            : "Attention"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Awaiting verification</h3>
          <ul>
            {data.unverified.map((key) => (
              <li key={key}>{names[key] ?? key}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
