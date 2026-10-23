import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { RetentionStatus } from "../../api/src/maintenance/status";
import type { Api } from "./api";
import { errorText } from "./api";
import { IconButton } from "./ui";

export default function StaffMaintenance({
  api,
  available,
}: {
  api: Api;
  available: boolean;
}) {
  const [data, setData] = useState<RetentionStatus | null>(null),
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
        const value = await api.request<RetentionStatus>(
          "/api/v1/staff/maintenance/retention",
          undefined,
          "STAFF",
        );
        if (!gone) {
          setData(value);
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
    <section
      className="staff-section staff-maintenance"
      aria-label="Data maintenance"
    >
      <div className="staff-section-heading">
        <h2>Data retention</h2>
        <IconButton
          title="Refresh maintenance status"
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
          {available
            ? "Reading maintenance status..."
            : "Maintenance status unavailable"}
        </p>
      )}
      {available && data && (
        <>
          <div className="staff-table-wrap">
            <table className="retention-progress">
              <thead>
                <tr>
                  <th>Cleanup</th>
                  <th>Status</th>
                  <th>Last completed</th>
                  <th>Last batch</th>
                  <th>Total retired</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((b) => (
                  <tr key={b.family}>
                    <td>
                      {b.family === "SECRETS"
                        ? "Expired verifiers"
                        : "Source and diagnostics"}
                    </td>
                    <td>
                      {!b.last_completed_at
                        ? "Not observed"
                        : Date.parse(data.server_time) -
                              Date.parse(b.last_completed_at) >
                            180000
                          ? "Overdue"
                          : "Recently completed"}
                    </td>
                    <td>
                      {b.last_completed_at
                        ? new Date(b.last_completed_at).toLocaleString()
                        : "--"}
                    </td>
                    <td>{b.last_batch_count}</td>
                    <td>{b.total_purged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Physical reservations held: <strong>{data.physical_holds}</strong>
          </p>
        </>
      )}
      <div className="staff-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Payload</th>
              <th>Retention</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dead session verifiers</td>
              <td>24 hours after absolute expiry or revocation</td>
            </tr>
            <tr>
              <td>Expired flow verifiers</td>
              <td>24 hours after the original flow deadline</td>
            </tr>
            <tr>
              <td>Drafts, samples and participant diagnostics</td>
              <td>7 days after arena completion or discard</td>
            </tr>
            <tr>
              <td>Official submitted source</td>
              <td>30 days after arena completion or discard</td>
            </tr>
            <tr>
              <td>Authoring diagnostics</td>
              <td>
                7 days after validation ends; preserved while selected in an
                open arena
              </td>
            </tr>
            <tr>
              <td>Results, ledger, receipts and audit</td>
              <td>Retained; no automatic history deletion</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
