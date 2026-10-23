import { useEffect, useRef, useState } from "react";
import { Send, RefreshCw } from "lucide-react";
import { Command, errorText } from "./api";
import type { Api } from "./api";
import type { ControlRoom } from "./staff-types";
import Announcements from "./Announcements";
import type { AnnouncementItem } from "./Announcements";
import { Modal } from "./ui";

const valid = (s: string, n: number) =>
  !!s.trim() &&
  s.isWellFormed() &&
  !s.includes("\0") &&
  new TextEncoder().encode(s).length <= n;
export default function StaffAnnouncements({
  api,
  room,
  available,
  version,
  blockNavigation,
}: {
  api: Api;
  room: ControlRoom;
  available: boolean;
  version: string | null;
  blockNavigation: (blocked: boolean) => void;
}) {
  const [scope, setScope] = useState("EVENT"),
    [roundId, setRound] = useState(""),
    [teamId, setTeam] = useState(""),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, render] = useState(0);
  const command = useRef<Command | null>(null),
    mounted = useRef(true);
  command.current ??= new Command(api, "", () => render((v) => v + 1), "STAFF");
  const arena = room.instance!,
    base = `/api/v1/staff/arenas/${arena.instance_id}/announcements`,
    teams = [
      ...new Map(
        room.rounds.flatMap((r) => r.teams).map((t) => [t.team_id, t]),
      ).values(),
    ],
    writable = arena.current && ["SETUP", "IN_PROGRESS"].includes(arena.status),
    unresolved = command.current.unresolved,
    locked = !available || !writable || busy || unresolved,
    dirty = !!message || !!reason,
    validTarget =
      scope === "EVENT" ||
      (scope === "ROUND"
        ? room.rounds.some((r) => r.round_id === roundId)
        : teams.some((t) => t.team_id === teamId)),
    canSend =
      !locked && validTarget && valid(message, 4096) && valid(reason, 1024);
  function target(item: AnnouncementItem) {
    return item.scope === "EVENT"
      ? "Event-wide"
      : item.scope === "ROUND"
        ? `Round ${room.rounds.find((r) => r.round_id === item.round_id)?.kind ?? item.round_id}`
        : `Private: ${teams.find((t) => t.team_id === item.team_id)?.team_name ?? item.team_id}`;
  }
  useEffect(() => {
    blockNavigation(dirty || busy || unresolved);
  }, [dirty, busy, unresolved]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      blockNavigation(false);
    };
  }, []);
  function acknowledge(receipt: { outcome: string; reason: string | null }) {
    if (receipt.outcome === "APPLIED") {
      setMessage("");
      setReason("");
      setNotice("Announcement sent.");
    } else
      setError(`Announcement declined: ${receipt.reason ?? "unavailable"}.`);
    render((v) => v + 1);
  }
  async function send() {
    if (!canSend) return;
    setConfirm(false);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const receipt = await command.current!.send(
        base,
        {
          scope,
          round_id: scope === "ROUND" ? roundId : null,
          team_id: scope === "TEAM" ? teamId : null,
          message,
          reason,
        },
        `${base}/outcomes`,
      );
      if (mounted.current) acknowledge(receipt);
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function recover() {
    if (!available || busy) return;
    setBusy(true);
    setError("");
    try {
      const receipt = await command.current!.recover();
      if (mounted.current) {
        if (receipt) acknowledge(receipt);
        else
          setError(
            "The original send is not confirmed. No new message was sent.",
          );
      }
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="staff-section" aria-label="Staff announcements">
      <h2>Announcements</h2>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!writable && <p className="muted">This arena is read-only.</p>}
      {(writable || dirty || unresolved) && (
        <form
          className="announcement-composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) setConfirm(true);
          }}
        >
          <fieldset disabled={locked}>
            <legend>New announcement</legend>
            <label>
              Audience
              <select
                aria-label="Announcement audience"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="EVENT">Event-wide</option>
                <option value="ROUND">Round-wide</option>
                <option value="TEAM">Private team</option>
              </select>
            </label>
            {scope === "ROUND" && (
              <label>
                Round
                <select
                  aria-label="Announcement round"
                  value={roundId}
                  onChange={(e) => setRound(e.target.value)}
                >
                  <option value="">Select round</option>
                  {room.rounds.map((r) => (
                    <option key={r.round_id} value={r.round_id}>
                      Round {r.kind}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {scope === "TEAM" && (
              <label>
                Team
                <select
                  aria-label="Announcement team"
                  value={teamId}
                  onChange={(e) => setTeam(e.target.value)}
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.team_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Message
              <textarea
                aria-label="Announcement text"
                maxLength={4096}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label>
              Staff reason
              <textarea
                aria-label="Announcement reason"
                maxLength={1024}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </fieldset>
          <div className="dialog-actions">
            <button type="submit" disabled={!canSend}>
              <Send size={16} />
              Review send
            </button>
            <button
              type="button"
              disabled={busy || unresolved || !dirty}
              onClick={() => {
                setMessage("");
                setReason("");
              }}
            >
              Discard draft
            </button>
          </div>
        </form>
      )}
      {unresolved && (
        <button disabled={!available || busy} onClick={() => void recover()}>
          <RefreshCw size={16} />
          Check original send
        </button>
      )}
      <Announcements
        api={api}
        base={base}
        staff
        available={available}
        version={`${version}:${revision}`}
        target={target}
      />
      {confirm && (
        <Modal title="Send announcement?" close={() => setConfirm(false)}>
          <p>
            {target({
              id: "",
              recorded_at: "",
              scope,
              round_id: roundId,
              team_id: teamId,
            })}
          </p>
          <p className="announcement-preview">{message}</p>
          <div className="dialog-actions">
            <button disabled={!canSend} onClick={() => void send()}>
              <Send size={16} />
              Send announcement
            </button>
            <button onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
