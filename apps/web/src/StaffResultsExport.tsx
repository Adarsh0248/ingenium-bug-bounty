import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { FinalResults } from "../../api/src/competition/results";
import type { Api } from "./api";
import { ApiError, errorText } from "./api";
import { resultsFile } from "./results-export";
import type { ResultsFormat } from "./results-export";
import { IconButton } from "./ui";

export default function StaffResultsExport({
  api,
  arena,
  round,
  kind,
  available,
}: {
  api: Api;
  arena: string;
  round: string;
  kind: number;
  available: boolean;
}) {
  const [format, setFormat] = useState<ResultsFormat>("csv"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    generation = useRef(0),
    sending = useRef(false);
  useEffect(() => {
    generation.current++;
    sending.current = false;
    setBusy(false);
    setError("");
    return () => {
      generation.current++;
    };
  }, [arena, round, available]);
  async function download() {
    if (!available || sending.current) return;
    const id = generation.current;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await api.request<FinalResults>(
        `/api/v1/staff/competition/rounds/${round}/results`,
        undefined,
        "STAFF",
      );
      if (id !== generation.current) return;
      if (
        value.state !== "FINAL" ||
        value.round_id !== round ||
        value.arena_id !== arena ||
        value.round_kind !== kind
      )
        throw new Error("Result scope changed; refresh the arena.");
      const file = resultsFile(value, format),
        url = URL.createObjectURL(new Blob([file.text], { type: file.type })),
        a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (id === generation.current)
        setError(
          e instanceof ApiError && e.code !== "NETWORK"
            ? errorText(e)
            : "Final results could not be verified. Refresh or try the download again.",
        );
    } finally {
      if (id === generation.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="results-export" aria-label="Final results export">
      <select
        aria-label="Results file format"
        value={format}
        disabled={!available || busy}
        onChange={(e) => setFormat(e.target.value as ResultsFormat)}
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
      </select>
      <IconButton
        title={busy ? "Fetching final results" : "Download final results"}
        disabled={!available || busy}
        onClick={() => void download()}
      >
        <Download size={17} />
      </IconButton>
      {busy && <span role="status">Fetching results...</span>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
