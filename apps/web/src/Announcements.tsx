import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, RefreshCw } from "lucide-react";
import type { Api } from "./api";
import { ApiError, errorText } from "./api";
import { IconButton } from "./ui";
import { label } from "./types";

export interface AnnouncementItem {
  id: string;
  scope: string;
  recorded_at: string;
  round_id?: string | null;
  team_id?: string | null;
  message?: string;
}
interface Page {
  items: AnnouncementItem[];
  next_after: string | null;
}
export default function Announcements({
  api,
  base,
  staff = false,
  available,
  version,
  target,
  loaded,
}: {
  api: Api;
  base: string;
  staff?: boolean;
  available: boolean;
  version: string | null;
  target?: (item: AnnouncementItem) => string;
  loaded?: (head: string | null) => void;
}) {
  const [pages, setPages] = useState<(string | null)[]>([null]),
    [page, setPage] = useState<Page | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<AnnouncementItem | null>(null),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [refresh, setRefresh] = useState(0);
  const after = pages.at(-1),
    audience = staff ? "STAFF" : "PARTICIPANT",
    messageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setPage(null);
    setError("");
    if (!available) {
      setDetail(null);
      return;
    }
    let gone = false,
      timer: ReturnType<typeof setTimeout>;
    function load() {
      setReading(true);
      void api
        .request<Page>(
          `${base}${after ? `?after=${after}` : ""}`,
          undefined,
          audience,
        )
        .then((value) => {
          if (!gone) {
            setPage(value);
            setError("");
            if (!after && !selected) loaded?.(version);
          }
        })
        .catch((e) => {
          if (!gone) {
            setPage(null);
            setDetail(null);
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
  }, [api, base, audience, available, after, selected, version, refresh]);
  useEffect(() => {
    setDetail(null);
    if (!selected || !available) return;
    let gone = false;
    void api
      .request<AnnouncementItem>(`${base}/${selected}`, undefined, audience)
      .then((value) => {
        if (value.id !== selected) throw new ApiError("INVALID_CONTEXT");
        if (!gone) setDetail(value);
      })
      .catch((e) => {
        if (!gone) setError(errorText(e));
      });
    return () => {
      gone = true;
    };
  }, [api, base, audience, selected, available, refresh]);
  useEffect(() => {
    if (available && detail) messageRef.current?.focus();
  }, [available, detail]);
  return (
    <section className="announcement-inbox" aria-label="Announcement inbox">
      <div className="staff-section-heading">
        <h3>Messages</h3>
        {selected && (
          <IconButton
            title="Back to announcements"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft size={16} />
          </IconButton>
        )}
        <IconButton
          title="Refresh announcements"
          disabled={!available || reading}
          onClick={() => {
            setPages([null]);
            setRefresh((v) => v + 1);
          }}
        >
          <RefreshCw size={16} />
        </IconButton>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!available && (
        <p role="status">
          Announcements unavailable while access is being verified.
        </p>
      )}
      {available &&
        !error &&
        ((selected && !detail) || (!selected && reading && !page)) && (
          <p role="status">Loading announcements...</p>
        )}
      {available && page && !selected && (
        <>
          {!page.items.length && <p className="muted">No announcements.</p>}
          <ul className="announcement-list">
            {page.items.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>
                    {target?.(item) ??
                      (item.scope === "TEAM"
                        ? "Private team message"
                        : `${label(item.scope)} announcement`)}
                  </strong>
                  <time>{new Date(item.recorded_at).toLocaleString()}</time>
                </span>
                <IconButton
                  title={`Read announcement ${item.id}`}
                  onClick={() => {
                    setSelected(item.id);
                    setError("");
                  }}
                >
                  <Eye size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className="pagination">
            <IconButton
              title="Previous announcements"
              disabled={reading || pages.length === 1}
              onClick={() => setPages((p) => p.slice(0, -1))}
            >
              <ArrowLeft size={16} />
            </IconButton>
            <span>Page {pages.length}</span>
            <IconButton
              title="Older announcements"
              disabled={reading || !page.next_after}
              onClick={() => setPages((p) => [...p, page.next_after])}
            >
              <ArrowRight size={16} />
            </IconButton>
          </div>
        </>
      )}
      {available && selected && detail && (
        <article
          ref={messageRef}
          tabIndex={-1}
          className="announcement-message"
          aria-label="Announcement message"
        >
          <strong>
            {target?.(detail) ??
              (detail.scope === "TEAM"
                ? "Private team message"
                : `${label(detail.scope)} announcement`)}
          </strong>
          <p>{detail.message}</p>
        </article>
      )}
    </section>
  );
}
